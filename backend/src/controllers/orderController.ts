import type { Request, Response } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";

import { Order } from "../models/Order.js";
import type { IOrder, IOrderItem } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Settings } from "../models/Settings.js";
import type { AuthRequest } from "../middleware/auth.js";
import {
  InventoryUnavailableError,
  reserveInventory,
  restoreInventory,
} from "../services/inventory.js";
import { recalculateCustomerMetrics } from "../services/customerMetrics.js";
import { getRazorpayKeyId, getRazorpayKeySecret } from "../services/razorpay.js";
import { ONLINE_RESERVATION_TTL_MS } from "../services/inventoryExpiry.js";
import {
  validateSlot,
  DEFAULT_PROPOSAL_EXPIRY_MS,
  parseCheckoutSlot,
} from "../services/slotValidation.js";

type ProductRecord = {
  _id: mongoose.Types.ObjectId;
  name: string;
  price: number;
  stock: number;
  cost?: number;
  availability:
    | "AVAILABLE"
    | "OUT_OF_STOCK"
    | "DISABLED";
  active: boolean;
};

const orderItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
});

const createOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(100).optional(),

  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()).optional(),

  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number").optional(),

  fulfillmentType: z.enum([
    "DELIVERY",
    "PICKUP",
  ]),

  address: z
    .object({
      addressLine: z.string().trim().min(3),
      city: z.string().trim().min(2),
      pincode: z.string().trim().min(4),
    })
    .optional(),

  scheduledDate: z.string().trim().min(1),

  scheduledTime: z.string().trim().min(1),

  paymentMethod: z.enum([
    "COD",
    "ONLINE",
    "PAY_AT_STORE",
  ]),

  items: z.array(orderItemSchema).min(1).max(20),

  // Optional customer acquisition source attribution (marketing analytics).
  acquisitionSource: z.string().trim().max(100).optional(),
});

const guestTrackingSchema = z.object({
  orderNumber: z.string().trim().min(1),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter the phone number used at checkout"),
});

class OrderRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class OrderStatusError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/*
|--------------------------------------------------------------------------
| UPDATE ORDER STATUS VALIDATION
|--------------------------------------------------------------------------
*/

const updateOrderStatusSchema = z.object({
  status: z.enum([
    "PLACED",
    "PAYMENT_CONFIRMED",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "READY_FOR_PICKUP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "COLLECTED",
    "CANCELLED",
  ]),
});

type OrderStatusValue = z.infer<
  typeof updateOrderStatusSchema
>["status"];

/*
|--------------------------------------------------------------------------
| ALLOWED STATUS TRANSITIONS
|--------------------------------------------------------------------------
| Delivery flow:
| PLACED -> PAYMENT_CONFIRMED -> CONFIRMED -> PREPARING -> READY
|        -> OUT_FOR_DELIVERY -> DELIVERED
|
| Pickup flow:
| PLACED -> PAYMENT_CONFIRMED -> CONFIRMED -> PREPARING -> READY_FOR_PICKUP
|        -> COLLECTED
|
| Cancellation is only allowed from active,
| pre-delivery states. DELIVERED, COLLECTED, and CANCELLED
| are terminal.
|
| Transitions are further restricted by fulfillment type:
| - DELIVERY orders cannot enter READY_FOR_PICKUP or COLLECTED.
| - PICKUP orders cannot enter READY, OUT_FOR_DELIVERY, or DELIVERED.
|--------------------------------------------------------------------------
*/

const allowedStatusTransitions: Record<
  OrderStatusValue,
  OrderStatusValue[]
> = {
  PLACED: [
    "PAYMENT_CONFIRMED",
    "CONFIRMED",
    "CANCELLED",
  ],
  PAYMENT_CONFIRMED: [
    "CONFIRMED",
    "CANCELLED",
  ],
  CONFIRMED: [
    "PREPARING",
    "CANCELLED",
  ],
  PREPARING: [
    "READY",
    "READY_FOR_PICKUP",
    "CANCELLED",
  ],
  READY: [
    "OUT_FOR_DELIVERY",
    "CANCELLED",
  ],
  READY_FOR_PICKUP: [
    "COLLECTED",
    "CANCELLED",
  ],
  OUT_FOR_DELIVERY: [
    "DELIVERED",
  ],
  DELIVERED: [],
  COLLECTED: [],
  CANCELLED: [],
};

/*
|--------------------------------------------------------------------------
| GENERATE ORDER NUMBER
|--------------------------------------------------------------------------
*/

function generateOrderNumber(): string {
  const timestamp = Date.now()
    .toString()
    .slice(-8);

  const random = Math.floor(
    1000 + Math.random() * 9000,
  );

  return `SV-${timestamp}-${random}`;
}

/*
|--------------------------------------------------------------------------
| CREATE ORDER
|--------------------------------------------------------------------------
| POST /api/orders
|--------------------------------------------------------------------------
*/

export const createOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = createOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid order data",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const idempotencyKey = z.uuid().safeParse(req.get("Idempotency-Key"));

  if (!idempotencyKey.success) {
    res.status(400).json({ message: "A valid Idempotency-Key header is required" });
    return;
  }

  const data = parsed.data;

  // All checkouts (guest and authenticated) require a name, email, and phone.
  // Guest checkout no longer requires OTP verification.
  if (!data.customerName || !data.email || !data.phone) {
    res.status(400).json({
      message: "Checkout requires a name, valid email, and valid phone number",
    });
    return;
  }

  if (data.paymentMethod === "ONLINE" && (!getRazorpayKeyId() || !getRazorpayKeySecret())) {
    res.status(503).json({
      message: "Online payments are not configured yet. Please choose Cash on Delivery.",
    });
    return;
  }

  if (data.fulfillmentType === "DELIVERY" && !data.address) {
    res.status(400).json({
      message: "Delivery address is required for delivery orders",
    });
    return;
  }

  // PAY_AT_STORE is only valid for PICKUP orders.
  if (data.paymentMethod === "PAY_AT_STORE" && data.fulfillmentType !== "PICKUP") {
    res.status(400).json({
      message: "Pay at Store is only available for pickup orders.",
    });
    return;
  }

  const settings = await Settings.getSingleton();

  if (!settings.onlineOrdersEnabled) {
    res.status(403).json({
      message: settings.closedMessage || "Online ordering is currently disabled.",
    });
    return;
  }

  if (data.fulfillmentType === "DELIVERY" && !settings.deliveryEnabled) {
    res.status(403).json({
      message: "Delivery is currently not available.",
    });
    return;
  }

  if (data.fulfillmentType === "PICKUP" && !settings.pickupEnabled) {
    res.status(403).json({
      message: "Pickup is currently not available.",
    });
    return;
  }

  const parsedSlot = parseCheckoutSlot(
    data.scheduledDate,
    data.scheduledTime,
  );

  if (!parsedSlot) {
    res.status(400).json({
      message: "Invalid scheduled date or time.",
    });
    return;
  }

  const slotValidation = validateSlot(parsedSlot, data.fulfillmentType);

  if (!slotValidation.valid) {
    res.status(400).json({
      message: slotValidation.error ?? "Invalid slot time.",
    });
    return;
  }

  const customerSnapshot = req.customer
    ? {
        name: req.customer.name,
        email: req.customer.email ?? "",
        phone: req.customer.phone ?? "",
      }
    : {
        name: data.customerName,
        email: data.email,
        phone: data.phone,
      };

  const productIds = data.items.map((item) => item.productId);

  if (productIds.some((id) => !mongoose.isValidObjectId(id))) {
    res.status(400).json({ message: "Invalid product ID" });
    return;
  }

  const quantityByProduct = new Map<string, number>();

  for (const item of data.items) {
    quantityByProduct.set(
      item.productId,
      (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }

  if ([...quantityByProduct.values()].some((quantity) => quantity > 20)) {
    res.status(400).json({ message: "A maximum of 20 units per product can be ordered" });
    return;
  }

  const idempotencyHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        userId: req.customer?.id ?? null,
        customer: customerSnapshot,
        fulfillmentType: data.fulfillmentType,
        address: data.address ?? null,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        paymentMethod: data.paymentMethod,
        items: data.items.map(
          ({ productId, variantId, quantity }) => ({
            productId,
            variantId,
            quantity,
          }),
        ),
      }),
    )
    .digest("hex");

  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const existingOrder = await Order.findOne({
        idempotencyKey: idempotencyKey.data,
      })
        .select("+idempotencyHash")
        .session(session);

      if (existingOrder) {
        const sameOwner =
          (existingOrder.userId?.toString() ?? null) ===
          (req.customer?.id ?? null);

        if (
          !sameOwner ||
          existingOrder.idempotencyHash !== idempotencyHash
        ) {
          throw new OrderRequestError(
            "Idempotency key was already used for a different order",
            409,
          );
        }

        return {
          order: existingOrder,
          replayed: true,
        };
      }

      const products = (await Product.find({
        _id: { $in: productIds },
        active: true,
      })
        .session(session)
        .lean()
        .exec()) as unknown as ProductRecord[];

      const productMap = new Map(
        products.map((product) => [product._id.toString(), product]),
      );

      const orderItems: IOrderItem[] = data.items.map((item) => {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new OrderRequestError(
            `Product not found: ${item.productName}`,
            400,
          );
        }

        if (product.availability !== "AVAILABLE") {
          throw new OrderRequestError(
            `${product.name} is currently unavailable`,
            400,
          );
        }

        const requestedQuantity =
          quantityByProduct.get(item.productId) ?? item.quantity;

        if (product.stock < requestedQuantity) {
          throw new OrderRequestError(
            `Only ${product.stock} unit(s) of ${product.name} are available`,
            400,
          );
        }

        const itemTotal = product.price * item.quantity;

        return {
          productId: product._id,
          productName: product.name,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: product.price,
          itemTotal,
          totalPrice: itemTotal,
          // Capture the current product cost at order creation time.
          // Optional — missing if product cost was never recorded.
          ...(product.cost !== undefined ? { costSnapshot: product.cost } : {}),
        };
      });

      const subtotal = orderItems.reduce(
        (sum, item) => sum + item.itemTotal,
        0,
      );

      if (
        data.paymentMethod === "COD" &&
        settings.codMaxAmount !== null &&
        subtotal > settings.codMaxAmount
      ) {
        throw new OrderRequestError(
          "Please pay online to place this order.",
          400,
        );
      }

      await reserveInventory(
        session,
        orderItems,
        undefined,
        req.customer ? new mongoose.Types.ObjectId(req.customer.id) : undefined,
      );

      const orderData = {
        orderNumber: generateOrderNumber(),
        idempotencyKey: idempotencyKey.data,
        idempotencyHash,
        inventoryStatus: "RESERVED" as const,
        reconciliationStatus: "NONE" as const,

        ...(data.paymentMethod === "ONLINE"
          ? {
              reservationExpiresAt: new Date(
                Date.now() + ONLINE_RESERVATION_TTL_MS,
              ),
            }
          : {}),

        ...(req.customer
          ? {
              userId: new mongoose.Types.ObjectId(req.customer.id),
            }
          : {}),

        customer: customerSnapshot,
        customerName: customerSnapshot.name,
        phone: customerSnapshot.phone,
        fulfillmentType: data.fulfillmentType,

        ...(data.fulfillmentType === "DELIVERY" && data.address
          ? { address: data.address }
          : {}),

        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        requestedSlot: parsedSlot,
        confirmedSlot: parsedSlot,
        paymentMethod: data.paymentMethod,
        paymentStatus: "PENDING" as const,
        orderStatus: "PLACED" as const,
        items: orderItems,
        subtotal,
        deliveryFee: 0,
        totalAmount: subtotal,

        // Optional acquisition source attribution.
        ...(data.acquisitionSource ? { acquisitionSource: data.acquisitionSource } : {}),
      };

      const createdOrder = new Order(orderData);
      await createdOrder.save({ session });

      return {
        order: createdOrder,
        replayed: false,
      };
    });

    if (!result) {
      throw new Error("Order transaction completed without an order");
    }

    const { order, replayed } = result;

    // Recalculate customer metrics for authenticated customers.
    // Best-effort: metrics recalculation failure must not block order creation.
    if (!replayed && req.customer) {
      try {
        await recalculateCustomerMetrics(
          new mongoose.Types.ObjectId(req.customer.id),
        );
      } catch {
        // Non-fatal: metrics can be recalculated via scheduled job.
      }
    }

    res.status(replayed ? 200 : 201).json({
      message: replayed
        ? "Order request already processed"
        : "Order created successfully",
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof OrderRequestError) {
      res.status(error.status).json({ message: error.message });
      return;
    }

    if (error instanceof InventoryUnavailableError) {
      res.status(400).json({
        message: "Product stock changed; review your cart and try again",
      });
      return;
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      try {
        const existingOrder = await Order.findOne({
          idempotencyKey: idempotencyKey.data,
        }).select("+idempotencyHash");

        const sameOwner =
          (existingOrder?.userId?.toString() ?? null) ===
          (req.customer?.id ?? null);

        if (
          existingOrder &&
          sameOwner &&
          existingOrder.idempotencyHash === idempotencyHash
        ) {
          res.status(200).json({
            message: "Order request already processed",
            order: {
              id: existingOrder._id,
              orderNumber: existingOrder.orderNumber,
              status: existingOrder.orderStatus,
              paymentStatus: existingOrder.paymentStatus,
              totalAmount: existingOrder.totalAmount,
              createdAt: existingOrder.createdAt,
            },
          });
          return;
        }
      } catch {
        // Fall through to the generic order error.
      }
    }

    console.error("Create order failed:", error);

    res.status(500).json({
      message: "Unable to create order",
    });
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| GET ORDER BY ORDER NUMBER
|--------------------------------------------------------------------------
*/

export const getOrderByNumber = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const orderNumber = String(req.params.orderNumber ?? "").trim();

    if (!orderNumber) {
      res.status(400).json({ message: "Order number is required" });
      return;
    }

    const order = await Order.findOne({
      orderNumber: orderNumber.toUpperCase(),
    }).lean();

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    if (!order.userId) {
      res.status(401).json({
        message:
          "Guest order tracking requires the phone number used at checkout",
      });
      return;
    }

    if (order.userId.toString() !== req.customer?.id) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    res.status(200).json({
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customer?.name ?? order.customerName,
        customer: order.customer,
        phone: order.customer?.phone ?? order.phone,
        fulfillmentType: order.fulfillmentType,
        address: order.address,
        scheduledDate: order.scheduledDate,
        scheduledTime: order.scheduledTime,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        inventoryStatus: order.inventoryStatus,
        items: order.items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get order failed:", error);
    res.status(500).json({ message: "Unable to fetch order" });
  }
};

export const trackGuestOrder = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = guestTrackingSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Enter a valid order number and checkout phone number",
    });
    return;
  }

  try {
    const order = await Order.findOne({
      orderNumber: parsed.data.orderNumber.toUpperCase(),
      phone: parsed.data.phone,
      userId: { $exists: false },
    }).lean();

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    res.status(200).json({
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customer?.name ?? order.customerName,
        customer: order.customer,
        phone: order.customer?.phone ?? order.phone,
        fulfillmentType: order.fulfillmentType,
        address: order.address,
        scheduledDate: order.scheduledDate,
        scheduledTime: order.scheduledTime,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        items: order.items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    console.error("Guest order tracking failed:", error);
    res.status(500).json({ message: "Unable to fetch order" });
  }
};

export const getMyOrders = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  if (!req.customer) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const orders = await Order.find({ userId: req.customer.id })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ orders });
  } catch (error) {
    console.error("Get customer orders failed:", error);
    res.status(500).json({ message: "Unable to fetch orders" });
  }
};

export const getMyOrderByNumber = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  if (!req.customer) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const orderNumber = String(req.params.orderNumber ?? "")
      .trim()
      .toUpperCase();

    const order = await Order.findOne({
      orderNumber,
      userId: req.customer.id,
    }).lean();

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    res.status(200).json({ order });
  } catch (error) {
    console.error("Get customer order failed:", error);
    res.status(500).json({ message: "Unable to fetch order" });
  }
};

const orderQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  paymentMethod: z
    .enum(["COD", "ONLINE", "PAY_AT_STORE"])
    .optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED"]).optional(),
  orderStatus: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const getAllOrders = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const parsed = orderQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid query parameters",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const {
      page,
      limit,
      search,
      paymentMethod,
      paymentStatus,
      orderStatus,
      startDate,
      endDate,
    } = parsed.data;

    const pageNum = page !== undefined ? parseInt(page, 10) : undefined;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : undefined;
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const effectivePage = pageNum ?? 1;
    const effectiveLimit = limitNum ?? DEFAULT_LIMIT;
    const hasPagination = true;

    const filter: Record<string, unknown> = {};

    if (search) {
      const searchTerm = search.trim();
      filter.$or = [
        { orderNumber: { $regex: searchTerm, $options: "i" } },
        { customerName: { $regex: searchTerm, $options: "i" } },
        { phone: { $regex: searchTerm, $options: "i" } },
      ];
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (orderStatus) {
      filter.orderStatus = orderStatus;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      filter.createdAt = dateFilter;
    }

    const countQuery = Order.countDocuments(filter);
    let safePage = Math.max(1, effectivePage);
    let safeLimit = Math.min(MAX_LIMIT, Math.max(1, effectiveLimit));

    const findQuery = Order.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    if (hasPagination) {
      const skip = (safePage - 1) * safeLimit;
      findQuery.skip(skip).limit(safeLimit);
    }

    const [orders, total] = await Promise.all([findQuery, countQuery]);

    if (hasPagination) {
      res.status(200).json({
        orders,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
        },
      });
    } else {
      res.status(200).json({ orders });
    }
  } catch (error) {
    console.error("Get all orders failed:", error);
    res.status(500).json({ message: "Unable to fetch orders" });
  }
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const orderNumber = String(req.params.orderNumber ?? "")
      .trim()
      .toUpperCase();

    if (!orderNumber) {
      res.status(400).json({ message: "Order number is required" });
      return;
    }

    const parsed = updateOrderStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid order status",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const nextStatus = parsed.data.status;
    let order: IOrder | undefined;

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const currentOrder = await Order.findOne({ orderNumber }).session(
          session,
        );

        if (!currentOrder) {
          throw new OrderStatusError("Order not found", 404);
        }

        const currentStatus = currentOrder.orderStatus as OrderStatusValue;
        const allowed = allowedStatusTransitions[currentStatus] ?? [];

        if (!allowed.includes(nextStatus)) {
          throw new OrderStatusError(
            `Cannot change order status from ${currentStatus} to ${nextStatus}`,
            400,
          );
        }

        if (
          currentOrder.fulfillmentType === "DELIVERY" &&
          (nextStatus === "READY_FOR_PICKUP" || nextStatus === "COLLECTED")
        ) {
          throw new OrderStatusError(
            `Delivery orders cannot transition to ${nextStatus}`,
            400,
          );
        }

        if (
          currentOrder.fulfillmentType === "PICKUP" &&
          (nextStatus === "READY" ||
            nextStatus === "OUT_FOR_DELIVERY" ||
            nextStatus === "DELIVERED")
        ) {
          throw new OrderStatusError(
            `Pickup orders cannot transition to ${nextStatus}`,
            400,
          );
        }

        if (
          currentOrder.inventoryStatus === "RELEASED" &&
          nextStatus !== "CANCELLED"
        ) {
          throw new OrderStatusError(
            "Inventory was released; this order cannot progress",
            409,
          );
        }

        if (
          nextStatus === "CANCELLED" &&
          currentOrder.inventoryStatus === "RESERVED"
        ) {
          await restoreInventory(
            session,
            currentOrder.items,
            new mongoose.Types.ObjectId(currentOrder._id),
          );
          currentOrder.inventoryStatus = "RELEASED";
          currentOrder.reservationExpiresAt = undefined;
        } else if (
          (nextStatus === "DELIVERED" || nextStatus === "COLLECTED") &&
          currentOrder.inventoryStatus === "RESERVED"
        ) {
          currentOrder.inventoryStatus = "COMMITTED";
          currentOrder.reservationExpiresAt = undefined;
        }

        if (
          nextStatus === "CANCELLED" &&
          currentOrder.paymentStatus === "PAID"
        ) {
          currentOrder.reconciliationStatus = "REVIEW_REQUIRED";
          currentOrder.reconciliationReason =
            "Paid order was cancelled; confirm customer refund or another resolution manually.";
        }

        currentOrder.orderStatus = nextStatus;
        await currentOrder.save({ session });
        order = currentOrder;
      });
    } catch (error) {
      if (error instanceof OrderStatusError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!order) {
      throw new Error("Order status transaction completed without an order");
    }

    res.status(200).json({
      message: "Order status updated successfully",
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        inventoryStatus: order.inventoryStatus,
        reconciliationStatus: order.reconciliationStatus,
        reconciliationReason: order.reconciliationReason,
        paymentStatus: order.paymentStatus,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update order status failed:", error);
    res.status(500).json({ message: "Unable to update order status" });
  }
};

export const markOrderPaid = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const orderNumber = String(req.params.orderNumber ?? "")
      .trim()
      .toUpperCase();

    if (!orderNumber) {
      res.status(400).json({ message: "Order number is required" });
      return;
    }

    if (!req.admin) {
      res.status(401).json({ message: "Admin authentication required" });
      return;
    }

    const adminId = req.admin.id;
    const session = await mongoose.startSession();

    let result: { alreadyPaid: boolean; order: IOrder } | undefined;

    try {
      result = await session.withTransaction(async () => {
        const order = await Order.findOne({ orderNumber }).session(session);

        if (!order) {
          throw new OrderStatusError("Order not found", 404);
        }

        if (order.paymentMethod !== "PAY_AT_STORE") {
          throw new OrderStatusError(
            "Mark Paid is only available for Pay at Store orders",
            400,
          );
        }

        if (order.paymentStatus === "PAID") {
          order.paidAt = order.paidAt ?? new Date();
          order.paidBy =
            order.paidBy ?? new mongoose.Types.ObjectId(adminId);

          await order.save({ session });

          return { alreadyPaid: true, order };
        }

        if (order.paymentStatus !== "PENDING") {
          throw new OrderStatusError(
            `Cannot mark payment as paid from ${order.paymentStatus}`,
            400,
          );
        }

        order.paymentStatus = "PAID";
        order.paidAt = new Date();
        order.paidBy = new mongoose.Types.ObjectId(adminId);

        if (order.inventoryStatus === "RESERVED") {
          order.inventoryStatus = "COMMITTED";
          order.reservationExpiresAt = undefined;
        }

        await order.save({ session });

        return { alreadyPaid: false, order };
      });
    } catch (error) {
      if (error instanceof OrderStatusError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!result) {
      throw new Error("Mark order paid transaction completed without an order");
    }

    const { alreadyPaid, order } = result;

    if (alreadyPaid) {
      res.status(200).json({
        message: "Order was already marked as paid",
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
          paidAt: order.paidAt,
          paidBy: order.paidBy,
        },
      });
      return;
    }

    res.status(200).json({
      message: "Order marked as paid",
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        paidAt: order.paidAt,
        paidBy: order.paidBy,
      },
    });
  } catch (error) {
    console.error("Mark order paid failed:", error);
    res.status(500).json({ message: "Unable to mark order as paid" });
  }
};

const proposeSlotSchema = z.object({
  time: z.string().datetime({
    message: "Valid ISO datetime is required",
  }),
  note: z.string().trim().max(500).optional(),
});

const RESCHEDULE_ELIGIBLE_STATUSES: OrderStatusValue[] = [
  "PLACED",
  "PAYMENT_CONFIRMED",
  "CONFIRMED",
];

export const proposeSlot = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ message: "Admin authentication required" });
      return;
    }

    const adminId = req.admin.id;
    const orderId = String(req.params.id ?? "").trim();

    if (!mongoose.isValidObjectId(orderId)) {
      res.status(400).json({ message: "Invalid order ID" });
      return;
    }

    const parsed = proposeSlotSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid proposal data",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { time: proposedTimeStr, note } = parsed.data;
    const proposedTime = new Date(proposedTimeStr);
    const session = await mongoose.startSession();

    let result: { order: IOrder } | undefined;

    try {
      result = await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);

        if (!order) {
          throw new OrderStatusError("Order not found", 404);
        }

        const slotValidation = validateSlot(
          proposedTime,
          order.fulfillmentType,
        );

        if (!slotValidation.valid) {
          throw new OrderStatusError(
            slotValidation.error ?? "Invalid slot time.",
            400,
          );
        }

        if (
          order.proposedSlot &&
          order.proposedSlot.status === "PENDING"
        ) {
          throw new OrderStatusError(
            "A pending proposal already exists for this order",
            409,
          );
        }

        if (
          !RESCHEDULE_ELIGIBLE_STATUSES.includes(
            order.orderStatus as OrderStatusValue,
          )
        ) {
          throw new OrderStatusError(
            `Cannot reschedule an order in ${order.orderStatus} status`,
            400,
          );
        }

        if (
          order.confirmedSlot &&
          proposedTime.getTime() === order.confirmedSlot.getTime()
        ) {
          throw new OrderStatusError(
            "Proposed time is the same as the current confirmed slot",
            400,
          );
        }

        const now = new Date();
        const expiresAt = new Date(
          now.getTime() + DEFAULT_PROPOSAL_EXPIRY_MS(),
        );

        order.reschedulePreviousStatus = order.orderStatus;
        order.orderStatus = "RESCHEDULE_PROPOSED";
        order.proposedSlot = {
          time: proposedTime,
          note: note ?? "",
          proposedBy: new mongoose.Types.ObjectId(adminId),
          proposedAt: now,
          status: "PENDING",
          expiresAt,
        };

        await order.save({ session });

        return { order };
      });
    } catch (error) {
      if (error instanceof OrderStatusError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!result) {
      throw new Error("Propose slot transaction completed without an order");
    }

    const { order } = result;

    res.status(200).json({
      message: "Slot proposal created successfully",
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        proposedSlot: order.proposedSlot,
        requestedSlot: order.requestedSlot,
        confirmedSlot: order.confirmedSlot,
      },
    });
  } catch (error) {
    console.error("Propose slot failed:", error);
    res.status(500).json({ message: "Unable to propose slot" });
  }
};

export const acceptProposal = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.customer) {
      res.status(401).json({ message: "Customer authentication required" });
      return;
    }

    const customerId = req.customer.id;
    const orderId = String(req.params.id ?? "").trim();

    if (!mongoose.isValidObjectId(orderId)) {
      res.status(400).json({ message: "Invalid order ID" });
      return;
    }

    const session = await mongoose.startSession();

    let result: { expired: boolean; order: IOrder } | undefined;

    try {
      result = await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);

        if (!order) {
          throw new OrderStatusError("Order not found", 404);
        }

        if (order.userId && order.userId.toString() !== customerId) {
          throw new OrderStatusError("Order not found", 404);
        }

        if (!order.proposedSlot) {
          throw new OrderStatusError(
            "No proposal exists for this order",
            400,
          );
        }

        const confirmedSlotTime = order.proposedSlot.time;

        if (order.proposedSlot.status !== "PENDING") {
          throw new OrderStatusError(
            `Proposal is already ${order.proposedSlot.status.toLowerCase()}`,
            400,
          );
        }

        const now = new Date();

        if (
          order.proposedSlot.expiresAt &&
          order.proposedSlot.expiresAt.getTime() <= now.getTime()
        ) {
          order.proposedSlot.status = "EXPIRED";
          order.orderStatus =
            order.reschedulePreviousStatus ?? "CONFIRMED";
          await order.save({ session });
          return { expired: true, order };
        }

        if (
          ["DELIVERED", "COLLECTED", "CANCELLED"].includes(
            order.orderStatus,
          )
        ) {
          throw new OrderStatusError(
            "Cannot accept proposal for this order",
            400,
          );
        }

        const previousConfirmedSlot = order.confirmedSlot;
        order.confirmedSlot = confirmedSlotTime;
        order.proposedSlot.status = "ACCEPTED";

        order.slotHistory = [
          ...(order.slotHistory ?? []),
          {
            from: previousConfirmedSlot ?? order.requestedSlot ?? now,
            to: order.proposedSlot.time,
            reason: "Customer accepted reschedule proposal",
            by: customerId,
            at: now,
          },
        ];

        const previousStatus = order.reschedulePreviousStatus;

        if (previousStatus === "PLACED") {
          order.orderStatus = "CONFIRMED";
        } else if (previousStatus === "PAYMENT_CONFIRMED") {
          order.orderStatus = "PAYMENT_CONFIRMED";
        } else {
          order.orderStatus = "CONFIRMED";
        }

        order.scheduledDate =
          confirmedSlotTime.toISOString().split("T")[0] ?? "";

        order.scheduledTime =
          confirmedSlotTime.toISOString().split("T")[1]?.split(".")[0] ??
          "10:00:00";

        order.reschedulePreviousStatus = undefined;

        await order.save({ session });

        return { expired: false, order };
      });
    } catch (error) {
      if (error instanceof OrderStatusError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!result) {
      throw new Error("Accept proposal transaction completed without an order");
    }

    const { expired, order } = result;

    if (expired) {
      res.status(400).json({ message: "Proposal has expired" });
      return;
    }

    res.status(200).json({
      message: "Proposal accepted successfully",
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        requestedSlot: order.requestedSlot,
        confirmedSlot: order.confirmedSlot,
        scheduledDate: order.scheduledDate,
        scheduledTime: order.scheduledTime,
        proposedSlot: order.proposedSlot,
        slotHistory: order.slotHistory,
      },
    });
  } catch (error) {
    console.error("Accept proposal failed:", error);
    res.status(500).json({ message: "Unable to accept proposal" });
  }
};

export const declineProposal = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.customer) {
      res.status(401).json({ message: "Customer authentication required" });
      return;
    }

    const customerId = req.customer.id;
    const orderId = String(req.params.id ?? "").trim();

    if (!mongoose.isValidObjectId(orderId)) {
      res.status(400).json({ message: "Invalid order ID" });
      return;
    }

    const session = await mongoose.startSession();

    let result: { expired: boolean; order: IOrder } | undefined;

    try {
      result = await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);

        if (!order) {
          throw new OrderStatusError("Order not found", 404);
        }

        if (order.userId && order.userId.toString() !== customerId) {
          throw new OrderStatusError("Order not found", 404);
        }

        if (!order.proposedSlot) {
          throw new OrderStatusError(
            "No proposal exists for this order",
            400,
          );
        }

        if (order.proposedSlot.status !== "PENDING") {
          throw new OrderStatusError(
            `Proposal is already ${order.proposedSlot.status.toLowerCase()}`,
            400,
          );
        }

        const now = new Date();

        if (
          order.proposedSlot.expiresAt &&
          order.proposedSlot.expiresAt.getTime() <= now.getTime()
        ) {
          order.proposedSlot.status = "EXPIRED";
          order.orderStatus =
            order.reschedulePreviousStatus ?? "CONFIRMED";
          await order.save({ session });
          return { expired: true, order };
        }

        if (
          ["DELIVERED", "COLLECTED", "CANCELLED"].includes(
            order.orderStatus,
          )
        ) {
          throw new OrderStatusError(
            "Cannot decline proposal for this order",
            400,
          );
        }

        order.proposedSlot.status = "DECLINED";

        order.slotHistory = [
          ...(order.slotHistory ?? []),
          {
            from: order.confirmedSlot ?? order.requestedSlot ?? now,
            to: order.confirmedSlot ?? order.requestedSlot ?? now,
            reason: "Customer declined reschedule proposal",
            by: customerId,
            at: now,
          },
        ];

        order.orderStatus =
          order.reschedulePreviousStatus ?? "CONFIRMED";

        order.reschedulePreviousStatus = undefined;

        await order.save({ session });

        return { expired: false, order };
      });
    } catch (error) {
      if (error instanceof OrderStatusError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!result) {
      throw new Error("Decline proposal transaction completed without an order");
    }

    const { expired, order } = result;

    if (expired) {
      res.status(400).json({ message: "Proposal has expired" });
      return;
    }

    res.status(200).json({
      message: "Proposal declined",
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        requestedSlot: order.requestedSlot,
        confirmedSlot: order.confirmedSlot,
        proposedSlot: order.proposedSlot,
        slotHistory: order.slotHistory,
      },
      nextAction:
        order.paymentMethod === "PAY_AT_STORE"
          ? "Awaiting payment at store"
          : order.paymentStatus === "PENDING"
            ? "Complete payment or contact the bakery"
            : "Order remains active",
    });
  } catch (error) {
    console.error("Decline proposal failed:", error);
    res.status(500).json({ message: "Unable to decline proposal" });
  }
};
