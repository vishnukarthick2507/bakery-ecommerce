import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { CustomCakeRequest } from "../models/CustomCakeRequest.js";
import { Order } from "../models/Order.js";

import { generateOrderNumber } from "./orderController.js";
import { validateSlot } from "../services/slotValidation.js";
import type { AuthRequest } from "../middleware/auth.js";

const customCakeRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),

  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),

  flavour: z.string().trim().min(2).max(100),

  weight: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d+)?\s*(?:kg)?$/i, "Enter a weight in kilograms")
    .refine((value) => {
      const kilograms = Number(value.toLowerCase().replace("kg", "").trim());
      return Number.isFinite(kilograms) && kilograms >= 0.1 && kilograms <= 5;
    }, "Cake weight must be between 0.1 kg and 5 kg"),

  theme: z.string().trim().min(2).max(200),

  messageOnCake: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value ?? ""),

  instructions: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value ?? ""),

  referenceImageUrl: z
    .union([z.url().max(500), z.literal("")])
    .optional()
    .transform((value) => value ?? ""),
});

const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "CONTACTED", "CLOSED"]),
});

const proposeProposalSchema = z.object({
  proposedPrice: z
    .number()
    .positive("Price must be a positive number")
    .finite("Price must be a valid number"),

  proposedDeliveryDate: z
    .string()
    .trim()
    .min(1, "Delivery date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Delivery date must be in YYYY-MM-DD format"),

  proposedDeliveryTime: z
    .string()
    .trim()
    .min(1, "Delivery time is required"),

  adminNotes: z
    .string()
    .trim()
    .max(1000, "Admin notes must not exceed 1000 characters")
    .optional()
    .default(""),
});

const respondProposalSchema = z.object({
  response: z.enum(["CONFIRMED", "DECLINED"]),
});

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function isRequestOwnedByCustomer(requestPhone: string, customerPhone: string): boolean {
  return normalizePhone(requestPhone) !== "" && normalizePhone(requestPhone) === normalizePhone(customerPhone);
}

function generateReferenceNumber(): string {
  const timestamp = Date.now().toString().slice(-6);

  const random = Math.floor(100 + Math.random() * 900);

  return `CC-${timestamp}-${random}`;
}

/*
|--------------------------------------------------------------------------
| CREATE CUSTOM CAKE REQUEST
|--------------------------------------------------------------------------
| POST /api/custom-cake-requests
|--------------------------------------------------------------------------
*/

export const createCustomCakeRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const parsed = customCakeRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Please check the form and try again",
        errors: parsed.error.flatten(),
      });

      return;
    }

    let request: InstanceType<typeof CustomCakeRequest> | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        request = await CustomCakeRequest.create({
          ...parsed.data,
          referenceNumber: generateReferenceNumber(),
        });
        break;
      } catch (createError) {
        const isDuplicateReferenceNumber =
          typeof createError === "object" &&
          createError !== null &&
          "code" in createError &&
          (createError as { code?: number }).code === 11000 &&
          "keyPattern" in createError &&
          typeof (createError as { keyPattern?: unknown }).keyPattern === "object" &&
          (createError as { keyPattern?: Record<string, unknown> }).keyPattern !== null &&
          "referenceNumber" in ((createError as { keyPattern?: Record<string, unknown> }).keyPattern ?? {});

        if (!isDuplicateReferenceNumber || attempt === 4) {
          throw createError;
        }
      }
    }

    if (!request) {
      throw new Error("Failed to generate a unique reference number");
    }

    res.status(201).json({
      message: "Custom cake request received",

      request: {
        id: request._id,
        referenceNumber: request.referenceNumber,
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (error) {
    console.error("Create custom cake request failed:", error);

    res.status(500).json({
      message:
        "Unable to submit your request right now. Please call or WhatsApp us instead.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL CUSTOM CAKE REQUESTS (PAGINATED, ADMIN ONLY)
|--------------------------------------------------------------------------
| GET /api/custom-cake-requests?page=1&limit=20
|--------------------------------------------------------------------------
| Backward-compatible pagination. When page/limit are omitted, returns
| all requests (existing behavior preserved).
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| GET MY CUSTOM CAKE REQUESTS (CUSTOMER ONLY)
|--------------------------------------------------------------------------
| GET /api/custom-cake-requests/my
| Returns requests belonging to the authenticated customer (matched by phone).
|--------------------------------------------------------------------------
*/
export const getMyCustomCakeRequests = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.customer) {
      res.status(401).json({ message: "Customer authentication required" });
      return;
    }

    const phone = normalizePhone(req.customer.phone || "");
    if (!phone) {
      res.status(400).json({ message: "Customer phone number is required" });
      return;
    }

    const requests = await CustomCakeRequest.find({
      $or: [{ phone }, { phone: req.customer.phone }],
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ requests });
  } catch (error) {
    console.error("Get my custom cake requests failed:", error);
    res.status(500).json({ message: "Unable to fetch requests" });
  }
};

/*
|--------------------------------------------------------------------------
| GET CUSTOM CAKE REQUEST BY ID (ADMIN OR OWNING CUSTOMER)
|--------------------------------------------------------------------------
| GET /api/custom-cake-requests/:id
|--------------------------------------------------------------------------
*/
export const getCustomCakeRequestById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }

    const request = await CustomCakeRequest.findById(id).lean();
    if (!request) {
      res.status(404).json({ message: "Request not found" });
      return;
    }

    if (req.admin) {
      res.status(200).json({ request });
      return;
    }

    if (req.customer && isRequestOwnedByCustomer(request.phone, req.customer.phone || "")) {
      res.status(200).json({ request });
      return;
    }

    if (req.customer) {
      res.status(403).json({ message: "You are not authorized to view this request" });
      return;
    }

    res.status(401).json({ message: "Authentication required" });
  } catch (error) {
    console.error("Get custom cake request by id failed:", error);
    res.status(500).json({ message: "Unable to fetch request" });
  }
};

const customCakePaginationSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.page !== undefined) {
        const n = parseInt(data.page, 10);
        if (!Number.isFinite(n) || n < 1) return false;
      }
      if (data.limit !== undefined) {
        const n = parseInt(data.limit, 10);
        if (!Number.isFinite(n) || n < 1) return false;
      }
      return true;
    },
    {
      message: "Page and limit must be positive integers",
    },
  );

export const getAllCustomCakeRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const parsed = customCakePaginationSchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid query parameters",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { page, limit, search } = parsed.data;
    const pageNum = page !== undefined ? parseInt(page, 10) : undefined;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : undefined;
    const hasPagination = pageNum !== undefined && limitNum !== undefined;

    const searchTerm = search?.trim() ?? "";
    const filter: Record<string, unknown> = {};

    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { phone: { $regex: searchTerm, $options: "i" } },
        { referenceNumber: { $regex: searchTerm, $options: "i" } },
        { flavour: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const countQuery = CustomCakeRequest.countDocuments(filter);
    const findQuery = CustomCakeRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    if (hasPagination) {
      const safePage = Math.max(1, pageNum);
      const safeLimit = Math.min(100, Math.max(1, limitNum));
      const skip = (safePage - 1) * safeLimit;

      findQuery.skip(skip).limit(safeLimit);
    }

    const [requests, total] = await Promise.all([findQuery, countQuery]);

    if (hasPagination) {
      res.status(200).json({
        requests,
        pagination: {
          page: Math.max(1, pageNum),
          limit: Math.min(100, Math.max(1, limitNum)),
          total,
          totalPages: Math.ceil(total / Math.min(100, Math.max(1, limitNum))),
        },
      });
    } else {
      res.status(200).json({ requests });
    }
  } catch (error) {
    console.error("Get custom cake requests failed:", error);

    res.status(500).json({
      message: "Unable to fetch requests",
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE CUSTOM CAKE REQUEST STATUS
|--------------------------------------------------------------------------
| PATCH /api/custom-cake-requests/:id/status
|--------------------------------------------------------------------------
*/

export const updateCustomCakeRequestStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const parsed = updateStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid status",
        errors: parsed.error.flatten(),
      });

      return;
    }

    const request = await CustomCakeRequest.findByIdAndUpdate(
      id,
      { $set: { status: parsed.data.status } },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean();

    if (!request) {
      res.status(404).json({
        message: "Request not found",
      });

      return;
    }

    res.status(200).json({
      message: "Status updated successfully",
      request,
    });
  } catch (error) {
    console.error("Update custom cake request status failed:", error);

    res.status(500).json({
      message: "Unable to update status",
    });
  }
};

/*
|--------------------------------------------------------------------------
| PROPOSE CUSTOM CAKE DELIVERY (ADMIN ONLY)
|--------------------------------------------------------------------------
| PATCH /api/custom-cake-requests/:id/propose
| Admin proposes a price, delivery date/time, and notes for a pending
| custom cake request. Transitions status from PENDING to CONTACTED.
*/
export const proposeProposal = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ message: "Admin authentication required" });
      return;
    }

    const { id } = req.params;

    const parsed = proposeProposalSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid proposal data",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { proposedPrice, proposedDeliveryDate, proposedDeliveryTime, adminNotes } =
      parsed.data;

    // Validate delivery date is valid and not in the past
    const deliveryDate = new Date(proposedDeliveryDate);
    if (isNaN(deliveryDate.getTime())) {
      res.status(400).json({
        message: "Invalid delivery date",
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deliveryDate < today) {
      res.status(400).json({
        message: "Delivery date must be today or in the future",
      });
      return;
    }

    const request = await CustomCakeRequest.findById(id).lean();

    if (!request) {
      res.status(404).json({
        message: "Request not found",
      });
      return;
    }

    // Only PENDING requests can receive a proposal
    if (request.status !== "PENDING") {
      res.status(409).json({
        message:
          "Cannot propose on a request that has already been contacted or resolved",
      });
      return;
    }

    const updated = await CustomCakeRequest.findByIdAndUpdate(
      id,
      {
        $set: {
          proposedPrice,
          proposedDeliveryDate,
          proposedDeliveryTime,
          adminNotes: adminNotes || "",
          status: "CONTACTED",
          adminContactedAt: new Date(),
          customerConfirmed: "PENDING",
          customerConfirmedAt: null,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean();

    if (!updated) {
      res.status(404).json({
        message: "Request not found",
      });
      return;
    }

    res.status(200).json({
      message: "Proposal submitted successfully",
      request: {
        id: updated._id,
        referenceNumber: updated.referenceNumber,
        status: updated.status,
        proposedPrice: updated.proposedPrice,
        proposedDeliveryDate: updated.proposedDeliveryDate,
        proposedDeliveryTime: updated.proposedDeliveryTime,
        adminNotes: updated.adminNotes,
        customerConfirmed: updated.customerConfirmed,
        adminContactedAt: updated.adminContactedAt,
      },
    });
  } catch (error) {
    console.error("Propose custom cake proposal failed:", error);

    res.status(500).json({
      message: "Unable to submit proposal",
    });
  }
};

/*
|--------------------------------------------------------------------------
| RESPOND TO CUSTOM CAKE PROPOSAL (CUSTOMER ONLY)
|--------------------------------------------------------------------------
| PATCH /api/custom-cake-requests/:id/respond
| Authenticated customer accepts or declines an admin proposal.
| Only the customer whose phone matches the request can respond.
*/
export const respondProposal = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.customer) {
      res.status(401).json({ message: "Customer authentication required" });
      return;
    }

    const { id } = req.params;

    const parsed = respondProposalSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid response data",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { response } = parsed.data;

    const request = await CustomCakeRequest.findById(id).lean();

    if (!request) {
      res.status(404).json({
        message: "Request not found",
      });
      return;
    }

    // Only the customer whose phone matches the request can respond
    if (!isRequestOwnedByCustomer(request.phone, req.customer.phone || "")) {
      res.status(403).json({
        message: "You are not authorized to respond to this request",
      });
      return;
    }

    // Only CONTACTED requests can receive a customer response
    if (request.status !== "CONTACTED") {
      res.status(409).json({
        message:
          "Cannot respond to a request that has not been contacted or has already been resolved",
      });
      return;
    }

    // Only pending responses can be accepted/declined
    if (request.customerConfirmed !== "PENDING") {
      res.status(409).json({
        message: "This proposal has already been responded to",
      });
      return;
    }

    const updated = await CustomCakeRequest.findByIdAndUpdate(
      id,
      {
        $set: {
          customerConfirmed: response,
          customerConfirmedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean();

    if (!updated) {
      res.status(404).json({
        message: "Request not found",
      });
      return;
    }

    res.status(200).json({
      message: `Proposal ${response.toLowerCase()} successfully`,
      request: {
        id: updated._id,
        referenceNumber: updated.referenceNumber,
        status: updated.status,
        customerConfirmed: updated.customerConfirmed,
        customerConfirmedAt: updated.customerConfirmedAt,
      },
    });
  } catch (error) {
    console.error("Respond to custom cake proposal failed:", error);

    res.status(500).json({
      message: "Unable to respond to proposal",
    });
  }
};
/*
|--------------------------------------------------------------------------
| CONVERT CUSTOM CAKE REQUEST TO ORDER (ADMIN ONLY)
|--------------------------------------------------------------------------
| PATCH /api/custom-cake-requests/:id/convert
| Converts an accepted custom cake proposal into a normal Order.
| - Only CONTACTED requests with customerConfirmed = CONFIRMED are eligible.
| - Creates a PAY_AT_STORE, paymentStatus=PENDING, orderStatus=PLACED Order.
| - Links Order.customCakeRequestId and (when reliably matched) Order.userId.
| - Database-enforced idempotency/concurrency via atomic claim on the request.
| - No product inventory reservation (made-to-order). No payment capture/emails.
*/
export const convertCustomCakeRequestToOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  if (!req.admin) {
    res.status(401).json({ message: "Admin authentication required" });
    return;
  }

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id || !mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid custom cake request id" });
    return;
  }

  const requestId = new mongoose.Types.ObjectId(id);
  const claimedAt = new Date();
  const session = await mongoose.startSession();

  try {
    let responseStatus = 201;
    let resultOrder: any = null;
    let idempotentReplay = false;

    await session.withTransaction(async () => {
      // Atomic claim: only an unconverted, eligible request can be claimed.
      // This provides DB-enforced idempotency and safe concurrent handling.
      const claimed = await CustomCakeRequest.findOneAndUpdate(
        {
          _id: requestId,
          status: "CONTACTED",
          customerConfirmed: "CONFIRMED",
          $or: [{ convertedOrderId: null }, { convertedOrderId: { $exists: false } }],
        },
        { $set: { convertedAt: claimedAt } },
        { returnDocument: "after", session },
      ).lean();

      if (!claimed) {
        const existing = await CustomCakeRequest.findById(requestId)
          .session(session)
          .lean();

        if (!existing) {
          const err = new Error("NOT_FOUND");
          (err as any).status = 404;
          throw err;
        }

        if (existing.convertedOrderId) {
          const linkedOrder = await Order.findById(existing.convertedOrderId)
            .session(session)
            .lean();

          if (linkedOrder) {
            responseStatus = 200;
            resultOrder = linkedOrder;
            idempotentReplay = true;
            return;
          }

          const err = new Error("CONVERSION_INCONSISTENT");
          (err as any).status = 409;
          throw err;
        }

        const err = new Error("NOT_ELIGIBLE");
        (err as any).status = 409;
        throw err;
      }

      // Validate required proposal fields from the accepted request.
      if (
        typeof claimed.proposedPrice !== "number" ||
        !Number.isFinite(claimed.proposedPrice) ||
        claimed.proposedPrice <= 0 ||
        !claimed.proposedDeliveryDate ||
        !claimed.proposedDeliveryTime
      ) {
        await CustomCakeRequest.updateOne(
          { _id: requestId, convertedOrderId: null },
          { $set: { convertedAt: null } },
          { session },
        );
        const err = new Error("MISSING_PROPOSAL");
        (err as any).status = 400;
        throw err;
      }

      // Parse and validate the proposed slot using existing slot rules.
      const [year, month, day] = String(claimed.proposedDeliveryDate)
        .split("-")
        .map(Number);
      const rawTime = String(claimed.proposedDeliveryTime || "").trim();
      // Accept a single time ("2:00 PM") or extract the first time token from a range ("2:00 PM - 4:00 PM")
      const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

      if (!year || !month || !day || !timeMatch) {
        await CustomCakeRequest.updateOne(
          { _id: requestId, convertedOrderId: null },
          { $set: { convertedAt: null } },
          { session },
        );
        const err = new Error("INVALID_SLOT");
        (err as any).status = 400;
        throw err;
      }

      let hours = parseInt(timeMatch[1]!, 10);
      const minutes = parseInt(timeMatch[2]!, 10);
      const period = timeMatch[3]!.toUpperCase();
      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      // Interpret proposed time in IST (store timezone) for slot validation.
      const IST_OFFSET_MINUTES = 5 * 60 + 30;
      const utcMillis = Date.UTC(year, month - 1, day, hours, minutes) - IST_OFFSET_MINUTES * 60 * 1000;
      const proposedSlot = new Date(utcMillis);
      const slotValidation = validateSlot(proposedSlot, "PICKUP");

      if (!slotValidation.valid || isNaN(proposedSlot.getTime())) {
        await CustomCakeRequest.updateOne(
          { _id: requestId, convertedOrderId: null },
          { $set: { convertedAt: null } },
          { session },
        );
        const err = new Error(slotValidation.error || "INVALID_SLOT");
        (err as any).status = 400;
        (err as any).messageText = slotValidation.error || "Proposed delivery slot is invalid";
        throw err;
      }

      // Security hardening: do NOT auto-link a User by phone number match alone.
      // Phone ownership is not verified for custom cake requests and matching can
      // be ambiguous. Only set Order.userId when a reliable, verified customer
      // ownership association is available on the request (none in this flow).
      const linkedUserId: mongoose.Types.ObjectId | undefined = undefined;

      const amount = Number(claimed.proposedPrice);
      const scheduledDate = String(claimed.proposedDeliveryDate);
      const scheduledTime = String(claimed.proposedDeliveryTime).trim();
      const flavour = String(claimed.flavour || "Custom Cake").trim();
      const itemName = `Custom Cake - ${flavour}`;

      const order = new Order({
        orderNumber: generateOrderNumber(),
        customCakeRequestId: requestId,
        ...(linkedUserId ? { userId: linkedUserId } : {}),
        inventoryStatus: "COMMITTED",
        reconciliationStatus: "NONE",
        customer: {
          name: claimed.name,
          email: "",
          phone: claimed.phone,
        },
        customerName: claimed.name,
        phone: claimed.phone,
        fulfillmentType: "PICKUP",
        scheduledDate,
        scheduledTime,
        requestedSlot: proposedSlot,
        confirmedSlot: proposedSlot,
        paymentMethod: "PAY_AT_STORE",
        paymentStatus: "PENDING",
        orderStatus: "PLACED",
        items: [
          {
            productName: itemName,
            variantId: "custom-cake",
            quantity: 1,
            unitPrice: amount,
            itemTotal: amount,
            totalPrice: amount,
          },
        ],
        subtotal: amount,
        deliveryFee: 0,
        totalAmount: amount,
      });

      await order.save({ session });

      await CustomCakeRequest.updateOne(
        { _id: requestId, convertedOrderId: null },
        { $set: { convertedOrderId: order._id, convertedAt: claimedAt } },
        { session },
      );

      responseStatus = 201;
      resultOrder = order.toObject();
      idempotentReplay = false;
    });

    if (!resultOrder) {
      throw new Error("Conversion completed without an order");
    }

    res.status(responseStatus).json({
      message: idempotentReplay
        ? "Custom cake request already converted"
        : "Custom cake request converted to order successfully",
      requestId: id,
      order: {
        id: resultOrder._id,
        orderNumber: resultOrder.orderNumber,
        orderStatus: resultOrder.orderStatus,
        paymentStatus: resultOrder.paymentStatus,
        paymentMethod: resultOrder.paymentMethod,
        fulfillmentType: resultOrder.fulfillmentType,
        totalAmount: resultOrder.totalAmount,
        scheduledDate: resultOrder.scheduledDate,
        scheduledTime: resultOrder.scheduledTime,
        customCakeRequestId: resultOrder.customCakeRequestId,
        userId: resultOrder.userId ?? null,
      },
    });
  } catch (error: any) {
    const status = error?.status;
    if (status === 404) {
      res.status(404).json({ message: "Request not found" });
      return;
    }
    if (error?.message === "NOT_ELIGIBLE") {
      res.status(409).json({
        message: "Only CONTACTED requests with customer confirmation can be converted",
      });
      return;
    }
    if (error?.message === "CONVERSION_INCONSISTENT") {
      res.status(409).json({ message: "Request conversion is in an inconsistent state" });
      return;
    }
    if (error?.message === "MISSING_PROPOSAL") {
      res.status(400).json({ message: "Accepted proposal details are missing or invalid" });
      return;
    }
    if (error?.message === "INVALID_SLOT" || status === 400) {
      res.status(400).json({ message: error?.messageText || "Proposed delivery slot is invalid" });
      return;
    }

    console.error("Convert custom cake request to order failed:", error);
    res.status(500).json({ message: "Unable to convert custom cake request to order" });
  } finally {
    await session.endSession();
  }
};
