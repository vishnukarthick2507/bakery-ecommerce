import mongoose from "mongoose";

import { Order } from "../models/Order.js";
import { sendRescheduleExpiryAlert, isBrevoConfigured } from "./emailService.js";

export const PROPOSAL_EXPIRY_SCAN_INTERVAL_MS = 30 * 1000;
export const MAX_NOTIFICATION_ATTEMPTS = 5;
export const NOTIFICATION_CLAIM_LEASE_MS = 2 * 60 * 1000; // 2 minutes (exceeds 15s Brevo timeout with generous safety margin)

/**
 * AT-LEAST-ONCE DELIVERY & PROVIDER IDEMPOTENCY NOTE:
 *
 * The Brevo transactional email API (POST /v3/smtp/email) does not support a native idempotency key header.
 * If Brevo successfully accepts an email, but the backend process crashes or is killed before the
 * database update setting `expiryNotificationStatus: "SENT"` is committed to MongoDB, the claim lease
 * will eventually expire after NOTIFICATION_CLAIM_LEASE_MS (2 minutes).
 *
 * Another worker instance or subsequent sweep will recover the expired lease and re-attempt delivery,
 * which may result in a duplicate email to the admin. This is a deliberate design trade-off prioritizing
 * guaranteed delivery (at-least-once) over potential silent message loss (at-most-once).
 * If the provider adds idempotency support in the future, pass an idempotency key derived from `proposalId`.
 */

// Approved Phase 5 retry schedule (delay before the NEXT attempt after a failure):
//   Attempt 1 failed -> retry after 1 minute
//   Attempt 2 failed -> retry after 5 minutes
//   Attempt 3 failed -> retry after 15 minutes
//   Attempt 4 failed -> retry after 30 minutes
//   Attempt 5 failed -> terminal failure; no further retry.
const BACKOFF_SCHEDULE_MINUTES = [1, 5, 15, 30] as const;

export function calculateBackoffMs(attemptNumber: number): number {
  const index = attemptNumber - 1;
const minutes =
    index >= 0 && index < BACKOFF_SCHEDULE_MINUTES.length
      ? BACKOFF_SCHEDULE_MINUTES[index]!
      : BACKOFF_SCHEDULE_MINUTES[BACKOFF_SCHEDULE_MINUTES.length - 1]!;
  return minutes * 60 * 1000;
}

export function isNotificationConfigured(): { configured: boolean; reason?: string } {
  const recipient = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!recipient) {
    return { configured: false, reason: "ADMIN_NOTIFICATION_EMAIL is not configured." };
  }
  if (!isBrevoConfigured()) {
    return { configured: false, reason: "Brevo API key is not configured." };
  }
  return { configured: true };
}

export async function processPendingExpiryNotifications(now = new Date()): Promise<{
  sentCount: number;
  failedCount: number;
  skippedCount: number;
}> {
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  // Find orders with proposals that need notification
  const orders = await Order.find({
    "rescheduleProposals": {
      $elemMatch: {
        status: "EXPIRED",
        expiryNotificationStatus: { $in: ["PENDING", "FAILED"] },
        expiryNotificationAttempts: { $lt: MAX_NOTIFICATION_ATTEMPTS },
        $or: [
          { expiryNotificationNextRetryAt: { $exists: false } },
          { expiryNotificationNextRetryAt: null },
          { expiryNotificationNextRetryAt: { $lte: now } },
        ],
      },
    },
  })
    .select("_id orderNumber rescheduleProposals proposedSlot orderStatus customer customerName phone confirmedSlot")
    .limit(100)
    .lean();

  for (const orderDoc of orders) {
    const orderId = orderDoc._id;
    const proposals = (orderDoc as unknown as {
      rescheduleProposals: Array<{
        proposalId: string;
        status: string;
        expiresAt: Date;
        proposedSlot: Date;
        reason: string;
        proposedAt: Date;
        proposedBy: mongoose.Types.ObjectId;
        expiryNotificationStatus?: string;
        expiryNotificationAttempts?: number;
        expiryNotificationNextRetryAt?: Date | null;
        expiryNotificationSentAt?: Date | null;
        expiryNotificationLastError?: string | null;
      }>;
    }).rescheduleProposals ?? [];

    for (const proposal of proposals) {
      if (proposal.status !== "EXPIRED") continue;
      if (proposal.expiryNotificationStatus === "SENT") continue;
      if (
        proposal.expiryNotificationStatus !== "PENDING" &&
        proposal.expiryNotificationStatus !== "FAILED"
      ) {
        continue;
      }
      const attemptsSoFar = proposal.expiryNotificationAttempts ?? 0;
      if (attemptsSoFar >= MAX_NOTIFICATION_ATTEMPTS) continue;

      if (
        proposal.expiryNotificationNextRetryAt &&
        new Date(proposal.expiryNotificationNextRetryAt).getTime() > now.getTime()
      ) {
        // Still within retry delay or lease duration
        continue;
      }

      // Configuration check BEFORE the atomic claim lease so that a
      // misconfiguration never consumes a real delivery attempt and never
      // enters the retry loop. A config error is terminal: it is marked
      // FAILED with a clear diagnostic, the attempt counter is set to the
      // maximum so future sweeps exclude it, and no email is ever sent.
      const configCheck = isNotificationConfigured();
      if (!configCheck.configured) {
        console.warn(`Reschedule expiry notification blocked: ${configCheck.reason}`);
        await Order.updateOne(
          { _id: orderId },
          {
            $set: {
              "rescheduleProposals.$[p].expiryNotificationStatus": "FAILED",
              "rescheduleProposals.$[p].expiryNotificationAttempts":
                MAX_NOTIFICATION_ATTEMPTS,
              "rescheduleProposals.$[p].expiryNotificationLastError": `Configuration error: ${configCheck.reason}`,
            },
            $unset: {
              "rescheduleProposals.$[p].expiryNotificationNextRetryAt": "",
            },
          },
          {
            arrayFilters: [{ "p.proposalId": proposal.proposalId }],
          },
        );
        failedCount += 1;
        continue;
      }

      // Step 2: Atomic Claim Lease
      const leaseExpiresAt = new Date(now.getTime() + NOTIFICATION_CLAIM_LEASE_MS);
      const claimResult = await Order.updateOne(
        {
          _id: orderId,
          rescheduleProposals: {
            $elemMatch: {
              proposalId: proposal.proposalId,
              status: "EXPIRED",
              expiryNotificationStatus: { $in: ["PENDING", "FAILED"] },
              expiryNotificationAttempts: { $lt: MAX_NOTIFICATION_ATTEMPTS },
              $or: [
                { expiryNotificationNextRetryAt: { $exists: false } },
                { expiryNotificationNextRetryAt: null },
                { expiryNotificationNextRetryAt: { $lte: now } },
              ],
            },
          },
        },
        {
          $inc: { "rescheduleProposals.$[p].expiryNotificationAttempts": 1 },
          $set: {
            "rescheduleProposals.$[p].expiryNotificationNextRetryAt": leaseExpiresAt,
            "rescheduleProposals.$[p].expiryNotificationStatus": "PENDING",
          },
        },
        {
          arrayFilters: [{ "p.proposalId": proposal.proposalId }],
        },
      );

      if (claimResult.matchedCount === 0) {
        // Another instance claimed this proposal concurrently
        skippedCount += 1;
        continue;
      }

      const currentAttempts = attemptsSoFar + 1;

      // Prepare notification payload
      const orderDocCast = orderDoc as unknown as {
        orderNumber: string;
        customerName: string;
        phone?: string;
        customer?: { email?: string };
        confirmedSlot?: Date | null;
      };

      const notificationInput: {
        orderNumber: string;
        customerName: string;
        customerPhone?: string;
        customerEmail?: string;
        originalSlot?: Date | null;
        proposedSlot: Date;
        expiresAt: Date;
      } = {
        orderNumber: orderDocCast.orderNumber,
        customerName: orderDocCast.customerName,
        proposedSlot: new Date(proposal.proposedSlot),
        expiresAt: new Date(proposal.expiresAt),
      };
      if (orderDocCast.phone) {
        notificationInput.customerPhone = orderDocCast.phone;
      }
      if (orderDocCast.customer?.email) {
        notificationInput.customerEmail = orderDocCast.customer.email;
      }
      if (orderDocCast.confirmedSlot !== undefined) {
        notificationInput.originalSlot = orderDocCast.confirmedSlot;
      }

      let sendSuccess = false;
      let deliveryError: string | undefined;

      try {
        sendSuccess = await sendRescheduleExpiryAlert(notificationInput);
        if (!sendSuccess) {
          deliveryError = "Email provider rejected or timed out.";
        }
      } catch (err: unknown) {
        sendSuccess = false;
        deliveryError = err instanceof Error ? err.message : String(err);
      }

      if (sendSuccess) {
        await Order.updateOne(
          { _id: orderId },
          {
            $set: {
              "rescheduleProposals.$[p].expiryNotificationStatus": "SENT",
              "rescheduleProposals.$[p].expiryNotificationSentAt": new Date(),
            },
            $unset: {
              "rescheduleProposals.$[p].expiryNotificationNextRetryAt": "",
              "rescheduleProposals.$[p].expiryNotificationLastError": "",
            },
          },
          {
            arrayFilters: [{ "p.proposalId": proposal.proposalId }],
          },
        );
        sentCount += 1;
      } else {
        failedCount += 1;
        if (currentAttempts < MAX_NOTIFICATION_ATTEMPTS) {
          const backoffMs = calculateBackoffMs(currentAttempts);
          const nextRetryAt = new Date(now.getTime() + backoffMs);
          await Order.updateOne(
            { _id: orderId },
            {
              $set: {
                "rescheduleProposals.$[p].expiryNotificationStatus": "FAILED",
                "rescheduleProposals.$[p].expiryNotificationNextRetryAt": nextRetryAt,
                "rescheduleProposals.$[p].expiryNotificationLastError": deliveryError ?? "Delivery failed",
              },
            },
            {
              arrayFilters: [{ "p.proposalId": proposal.proposalId }],
            },
          );
        } else {
          // Terminal failure: maximum retry attempts reached
          await Order.updateOne(
            { _id: orderId },
            {
              $set: {
                "rescheduleProposals.$[p].expiryNotificationStatus": "FAILED",
                "rescheduleProposals.$[p].expiryNotificationLastError": `Terminal failure: maximum delivery attempts (${MAX_NOTIFICATION_ATTEMPTS}) reached. Last error: ${deliveryError ?? "Delivery failed"}`,
              },
              $unset: {
                "rescheduleProposals.$[p].expiryNotificationNextRetryAt": "",
              },
            },
            {
              arrayFilters: [{ "p.proposalId": proposal.proposalId }],
            },
          );
        }
      }
    }
  }

  return { sentCount, failedCount, skippedCount };
}

let isSweeping = false;

export async function expireProposals(
  now = new Date(),
  options: { bypassSweepingLock?: boolean } = {},
): Promise<number> {
  if (isSweeping && !options.bypassSweepingLock) {
    return 0;
  }

  if (!options.bypassSweepingLock) {
    isSweeping = true;
  }
  let expiredCount = 0;

  try {
    // 1. Find orders that have at least one pending proposal past its expiry.
    const expiredOrders = await Order.find({
      "rescheduleProposals": {
        $elemMatch: {
          status: "PENDING",
          expiresAt: { $lte: now },
        },
      },
    })
      .select("_id orderNumber rescheduleProposals proposedSlot reschedulePreviousStatus orderStatus customer customerName phone")
      .limit(100)
      .lean();

    for (const orderDoc of expiredOrders) {
      const orderId = orderDoc._id;
      const proposals = (orderDoc as unknown as {
        rescheduleProposals: Array<{
          proposalId: string;
          status: string;
          expiresAt: Date;
          proposedSlot: Date;
          reason: string;
          proposedAt: Date;
          proposedBy: mongoose.Types.ObjectId;
        }>;
      }).rescheduleProposals ?? [];

      for (const proposal of proposals) {
        if (proposal.status !== "PENDING") continue;
        if (new Date(proposal.expiresAt).getTime() > now.getTime()) continue;

        // Atomic claim: transition this specific proposal from PENDING to EXPIRED.
        // Also initialize notification tracking state to PENDING so it can be reliably delivered.
        const claimResult = await Order.updateOne(
          {
            _id: orderId,
            "rescheduleProposals": {
              $elemMatch: {
                proposalId: proposal.proposalId,
                status: "PENDING",
                expiresAt: { $lte: now },
              },
            },
          },
          {
            $set: {
              "rescheduleProposals.$[p].status": "EXPIRED",
              "proposedSlot.status": "EXPIRED",
              "rescheduleProposals.$[p].expiryNotificationStatus": "PENDING",
              "rescheduleProposals.$[p].expiryNotificationAttempts": 0,
              "rescheduleProposals.$[p].expiryNotificationNextRetryAt": now,
            },
          },
          {
            arrayFilters: [{ "p.proposalId": proposal.proposalId }],
          },
        );

        if (claimResult.matchedCount === 0) {
          // Another instance already claimed this proposal.
          continue;
        }

        // Restore the order's previous valid status.
        const previousStatus = (orderDoc as unknown as {
          reschedulePreviousStatus: string;
          orderStatus: string;
        }).reschedulePreviousStatus;

        await Order.updateOne(
          { _id: orderId },
          {
            $set: {
              orderStatus: previousStatus,
            },
            $unset: {
              reschedulePreviousStatus: "",
            },
          },
        );

        expiredCount += 1;
      }
    }

    // 2. Deliver pending notifications and process retries for expired proposals.
    await processPendingExpiryNotifications(now);
  } catch (error) {
    console.error("Proposal expiry sweep failed:", error);
  } finally {
    if (!options.bypassSweepingLock) {
      isSweeping = false;
    }
  }

  return expiredCount;
}

let proposalExpiryTimer: ReturnType<typeof setInterval> | null = null;

export function startProposalExpiryWorker(): void {
  const runSweep = (): void => {
    void expireProposals().catch(() => {
      console.error("Proposal expiry sweep failed");
    });
  };

  runSweep();
  proposalExpiryTimer = setInterval(runSweep, PROPOSAL_EXPIRY_SCAN_INTERVAL_MS);
  proposalExpiryTimer.unref();
}

export function stopProposalExpiryWorker(): void {
  if (proposalExpiryTimer) {
    clearInterval(proposalExpiryTimer);
    proposalExpiryTimer = null;
  }
}
