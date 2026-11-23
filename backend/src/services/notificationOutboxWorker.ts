import { claimJob, processJob, recoverExpiredLeases } from "./notificationOutboxService.js";
import { logger } from "../lib/logger.js";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_LEASE_RECOVERY_INTERVAL_MS = 60_000;
const DEFAULT_SHUTDOWN_DRAIN_TIMEOUT_MS = 10_000;

let workerTimer: ReturnType<typeof setInterval> | null = null;
let recoveryTimer: ReturnType<typeof setInterval> | null = null;
let isPolling = false;
let stopping = false;
let inFlightPoll: Promise<void> | null = null;
let workerId: string | null = null;

function getWorkerId(): string {
  if (workerId) return workerId;
  const random = Math.random().toString(36).slice(2, 10);
  workerId = `outbox-worker:${process.pid}:${random}`;
  return workerId;
}

async function pollOnce(): Promise<void> {
  if (stopping || isPolling) return;
  isPolling = true;
  const id = getWorkerId();
  try {
    // Process a small batch per tick to avoid long blocking loops.
    for (let i = 0; i < 10; i += 1) {
      if (stopping) break;
      const job = await claimJob(id);
      if (!job) break;
      if (stopping) {
        // A claimed job remains PROCESSING with lease; lease recovery handles interruption safely.
        // Do not mark as delivered.
        break;
      }
      await processJob(job);
    }
  } catch (error) {
    logger.error("Notification outbox worker poll failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isPolling = false;
  }
}

function startPoll(): void {
  if (stopping || inFlightPoll) return;
  inFlightPoll = pollOnce().finally(() => {
    inFlightPoll = null;
  });
}

async function recoverOnce(): Promise<void> {
  if (stopping) return;
  try {
    await recoverExpiredLeases();
  } catch (error) {
    logger.error("Notification outbox lease recovery failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startNotificationOutboxWorker(options?: {
  pollIntervalMs?: number;
  leaseRecoveryIntervalMs?: number;
}): void {
  if (workerTimer || recoveryTimer || stopping) {
    // Allow restart only after a clean stop; ignore duplicate starts while active/stopping.
    if (stopping) return;
    return;
  }
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const leaseRecoveryIntervalMs = options?.leaseRecoveryIntervalMs ?? DEFAULT_LEASE_RECOVERY_INTERVAL_MS;

  stopping = false;
  void recoverOnce();
  startPoll();
  workerTimer = setInterval(() => {
    startPoll();
  }, pollIntervalMs);
  recoveryTimer = setInterval(() => {
    void recoverOnce();
  }, leaseRecoveryIntervalMs);
  // Do not keep Node alive solely for background worker in tests/scripts that want clean exit.
  (workerTimer as any).unref?.();
  (recoveryTimer as any).unref?.();
  logger.info("Notification outbox worker started", { workerId: getWorkerId(), pollIntervalMs, leaseRecoveryIntervalMs });
}

export async function stopNotificationOutboxWorker(options?: { drainTimeoutMs?: number }): Promise<void> {
  if (!workerTimer && !recoveryTimer && !inFlightPoll && !stopping) {
    return;
  }
  stopping = true;

  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  if (recoveryTimer) {
    clearInterval(recoveryTimer);
    recoveryTimer = null;
  }

  const drainTimeoutMs = options?.drainTimeoutMs ?? DEFAULT_SHUTDOWN_DRAIN_TIMEOUT_MS;
  const inflight = inFlightPoll;
  if (inflight) {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        inflight.catch(() => undefined),
        new Promise<void>((resolve) => {
          timeoutHandle = setTimeout(() => {
            logger.warn("Notification outbox worker drain timed out; interrupted jobs will be recovered by lease expiry", {
              drainTimeoutMs,
            });
            resolve();
          }, drainTimeoutMs);
          (timeoutHandle as any).unref?.();
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  isPolling = false;
  stopping = false;
  inFlightPoll = null;
  logger.info("Notification outbox worker stopped");
}

export function isNotificationOutboxWorkerRunning(): boolean {
  return Boolean(workerTimer || recoveryTimer || inFlightPoll || isPolling);
}
