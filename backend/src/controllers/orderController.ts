import type { Request, Response } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";

import { Order } from "../models/Order.js";
import type { IOrderItem } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Settings } from "../models/Settings.js";
import type { AuthRequest } from "../middleware/auth.js";
import {
  InventoryUnavailableError,
  reserveInventory,
  restoreInventory,
} from "../services/inventory.js";
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
  if (
    !req.customer &&
    (!data.customerName || !data.email || !data.phone)
  ) {
    res.status(400).json({
      message: "Guest checkout requires a name, valid email, and valid phone number",
    });
    return;
  }

  if (data.paymentMethod === "ONLINE" && (!getRazorpayKeyId() || !getRazorpayKeySecret())) {
    res.status(503).json({
      message: "Online payments are not configured yet. Please choose Cash on Delivery.",
    });
    return;
  }

  // Online payments require an authenticated customer session (OTP verified).
  // COD and PAY_AT_STORE remain available to guests per existing checkout rules.
  if (data.paymentMethod === "ONLINE" && !req.customer) {
    res.status(401).json({
      message: "Customer authentication required for online payments. Please verify your identity.",
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

  /*
  |--------------------------------------------------------------------------
  | ONLINE ORDERING SETTINGS ENFORCEMENT (Feature 3)
  |--------------------------------------------------------------------------
  | Backend enforcement is authoritative. The frontend UI must not be the
  | only protection. Reject before any inventory is reserved.
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | PARSE AND VALIDATE SCHEDULED SLOT (Feature 4)
  |--------------------------------------------------------------------------
  | Construct the authoritative slot Date on the backend from the
  | checkout's scheduledDate + scheduledTime strings. Validate it against
  | business rules before any inventory is reserved.
  |--------------------------------------------------------------------------
  */

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
        email: req.customer.email,
        phone: req.customer.phone,
      }
    : {
        name: data.customerName!,
        email: data.email!,
        phone: data.phone!,
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

  const idempotencyHash = crypto.createHash("sha256").update(JSON.stringify({
    userId: req.customer?.id ?? null,
    customer: customerSnapshot,
    fulfillmentType: data.fulfillmentType,
    address: data.address ?? null,
    scheduledDate: data.scheduledDate,
    scheduledTime: data.scheduledTime,
    paymentMethod: data.paymentMethod,
    items: data.items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
  })).digest("hex");

  let order: Awaited<ReturnType<typeof Order.findById>> = null;
  let replayed = false;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const existingOrder = await Order.findOne({ idempotencyKey: idempotencyKey.data })
        .select("+idempotencyHash")
        .session(session);

      if (existingOrder) {
        const sameOwner = (existingOrder.userId?.toString() ?? null) === (req.customer?.id ?? null);
        if (!sameOwner || existingOrder.idempotencyHash !== idempotencyHash) {
          throw new OrderRequestError("Idempotency key was already used for a different order", 409);
        }
        order = existingOrder;
        replayed = true;
        return;
      }

      const products = (await Product.find({
        _id: { $in: productIds },
        active: true,
      }).session(session).lean().exec()) as unknown as ProductRecord[];

      const productMap = new Map(products.map((product) => [product._id.toString(), product]));
      const orderItems: IOrderItem[] = data.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new OrderRequestError(`Product not found: ${item.productName}`, 400);
        }
        if (product.availability !== "AVAILABLE") {
          throw new OrderRequestError(`${product.name} is currently unavailable`, 400);
        }

        const requestedQuantity = quantityByProduct.get(item.productId) ?? item.quantity;
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
        };
      });

      await reserveInventory(session, orderItems);

      const subtotal = orderItems.reduce((sum, item) => sum + item.itemTotal, 0);
      const orderData = {
        orderNumber: generateOrderNumber(),
        idempotencyKey: idempotencyKey.data,
        idempotencyHash,
        inventoryStatus: "RESERVED" as const,
        reconciliationStatus: "NONE" as const,
        ...(data.paymentMethod === "ONLINE"
          ? { reservationExpiresAt: new Date(Date.now() + ONLINE_RESERVATION_TTL_MS) }
          : {}),
        ...(req.customer ? { userId: req.customer.id } : {}),
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
      };

      const [createdOrder] = await Order.create([orderData], { session });
      order = createdOrder;
    });

    if (!order) {
      throw new Error("Order transaction completed without an order");
    }

    res.status(replayed ? 200 : 201).json({
      message: replayed ? "Order request already processed" : "Order created successfully",
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
      res.status(400).json({ message: "Product stock changed; review your cart and try again" });
      return;
    }

    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      try {
        const existingOrder = await Order.findOne({ idempotencyKey: idempotencyKey.data })
          .select("+idempotencyHash");
        const sameOwner = (existingOrder?.userId?.toString() ?? null) === (req.customer?.id ?? null);
        if (existingOrder && sameOwner && existingOrder.idempotencyHash === idempotencyHash) {
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

    console.error(
      "Create order failed:",
      error,
    );

    res.status(500).json({
      message:
        "Unable to create order",
    });
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| GET ORDER BY ORDER NUMBER
|--------------------------------------------------------------------------
| GET /api/orders/SV-44171646-7698
|--------------------------------------------------------------------------
*/

export const getOrderByNumber =
  async (
    req: AuthRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const orderNumber =
        String(
          req.params
            .orderNumber ?? "",
        ).trim();

      if (!orderNumber) {
        res.status(400).json({
          message:
            "Order number is required",
        });

        return;
      }

      const order =
        await Order.findOne({
          orderNumber:
            orderNumber.toUpperCase(),
        }).lean();

      if (!order) {
        res.status(404).json({
          message:
            "Order not found",
        });

        return;
      }

      if (!order.userId) {
        res.status(401).json({
          message: "Guest order tracking requires the phone number used at checkout",
        });
        return;
      }

      if (
        order.userId &&
        order.userId.toString() !== req.customer?.id
      ) {
        res.status(404).json({ message: "Order not found" });
        return;
      }

      res.status(200).json({
        order: {
          id: order._id,

          orderNumber:
            order.orderNumber,

          customerName:
            order.customer?.name ?? order.customerName,

          customer: order.customer,

          phone:
            order.customer?.phone ?? order.phone,

          fulfillmentType:
            order.fulfillmentType,

          address:
            order.address,

          scheduledDate:
            order.scheduledDate,

          scheduledTime:
            order.scheduledTime,

          paymentMethod:
            order.paymentMethod,

          paymentStatus:
            order.paymentStatus,

          orderStatus:
            order.orderStatus,

          inventoryStatus:
            order.inventoryStatus,

          items:
            order.items,

          subtotal:
            order.subtotal,

          deliveryFee:
            order.deliveryFee,

          totalAmount:
            order.totalAmount,

          createdAt:
            order.createdAt,

          updatedAt:
            order.updatedAt,
        },
      });
    } catch (error) {
      console.error(
        "Get order failed:",
        error,
      );

      res.status(500).json({
        message:
          "Unable to fetch order",
      });
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

/*
|--------------------------------------------------------------------------
| GET ALL ORDERS
|--------------------------------------------------------------------------
| GET /api/orders
|--------------------------------------------------------------------------
*/

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
    const orderNumber = String(req.params.orderNumber ?? "").trim().toUpperCase();
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

export const getAllOrders =
  async (
    _req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const orders =
        await Order.find()
          .sort({
            createdAt: -1,
          })
          .lean();

      res.status(200).json({
        orders,
      });
    } catch (error) {
      console.error(
        "Get all orders failed:",
        error,
      );

      res.status(500).json({
        message:
          "Unable to fetch orders",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| UPDATE ORDER STATUS
|--------------------------------------------------------------------------
| PATCH /api/orders/:orderNumber/status
|--------------------------------------------------------------------------
| Body:
| {
|   "status": "CONFIRMED"
| }
|--------------------------------------------------------------------------
*/

export const updateOrderStatus =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const orderNumber =
        String(
          req.params
            .orderNumber ?? "",
        )
          .trim()
          .toUpperCase();

      if (!orderNumber) {
        res.status(400).json({
          message:
            "Order number is required",
        });

        return;
      }

      // Validate status
      const parsed =
        updateOrderStatusSchema.safeParse(
          req.body,
        );

      if (!parsed.success) {
        res.status(400).json({
          message:
            "Invalid order status",
          errors:
            parsed.error.flatten(),
        });

        return;
      }

      const nextStatus =
        parsed.data.status;
      let order: Awaited<ReturnType<typeof Order.findById>> = null;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const currentOrder = await Order.findOne({ orderNumber }).session(session);
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

          // Fulfillment-type-specific restrictions.
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

          if (nextStatus === "CANCELLED" && currentOrder.inventoryStatus === "RESERVED") {
            await restoreInventory(session, currentOrder.items);
            currentOrder.inventoryStatus = "RELEASED";
            currentOrder.reservationExpiresAt = undefined;
          } else if (
            (nextStatus === "DELIVERED" || nextStatus === "COLLECTED") &&
            currentOrder.inventoryStatus === "RESERVED"
          ) {
            currentOrder.inventoryStatus = "COMMITTED";
            currentOrder.reservationExpiresAt = undefined;
          }

          if (nextStatus === "CANCELLED" && currentOrder.paymentStatus === "PAID") {
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
        message:
          "Order status updated successfully",

        order: {
          id: order._id,

          orderNumber:
            order.orderNumber,

          orderStatus:
            order.orderStatus,

          inventoryStatus:
            order.inventoryStatus,

          reconciliationStatus:
            order.reconciliationStatus,

          reconciliationReason:
            order.reconciliationReason,

          paymentStatus:
            order.paymentStatus,

          updatedAt:
            order.updatedAt,
        },
      });
    } catch (error) {
      console.error(
        "Update order status failed:",
        error,
      );

      res.status(500).json({
        message:
          "Unable to update order status",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| MARK PAYMENT PAID (ADMIN, PAY_AT_STORE ONLY)
|--------------------------------------------------------------------------
| POST /api/orders/:orderNumber/mark-paid
| Body: {}
|
| Manually marks a PAY_AT_STORE order as PAID. Records a server-side
| paidAt timestamp and the admin who performed the action. Idempotent:
| marking an already-paid order again does not overwrite paidAt.
|--------------------------------------------------------------------------
*/

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
    try {
      await session.withTransaction(async () => {
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

        // Idempotent: if already paid, do not overwrite paidAt/paidBy.
        if (order.paymentStatus === "PAID") {
          order.paidAt = order.paidAt ?? new Date();
          order.paidBy = order.paidBy ?? adminId;
          await order.save({ session });
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

        if (order.paymentStatus !== "PENDING") {
          throw new OrderStatusError(
            `Cannot mark payment as paid from ${order.paymentStatus}`,
            400,
          );
        }

        order.paymentStatus = "PAID";
        order.paidAt = new Date();
        order.paidBy = new mongoose.Types.ObjectId(adminId);

        // Commit inventory once payment is received.
        if (order.inventoryStatus === "RESERVED") {
          order.inventoryStatus = "COMMITTED";
          order.reservationExpiresAt = undefined;
        }

        await order.save({ session });
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
  } catch (error) {
    console.error("Mark order paid failed:", error);
    res.status(500).json({ message: "Unable to mark order as paid" });
  }
};

/*
|--------------------------------------------------------------------------
| PROPOSE SLOT (ADMIN)
|--------------------------------------------------------------------------
| POST /api/admin/orders/:id/propose-slot
| Body: { "time": "ISO string", "note": "optional" }
|
| Admin proposes an alternative delivery/pickup time.
|--------------------------------------------------------------------------
*/

const proposeSlotSchema = z.object({
  time: z.string().datetime({ message: "Valid ISO datetime is required" }),
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
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);
        if (!order) {
          throw new OrderStatusError("Order not found", 404);
        }

        // Validate slot with actual fulfillment type
        const slotValidation = validateSlot(
          proposedTime,
          order.fulfillmentType,
        );
        if (!slotValidation.valid) {
          throw new OrderStatusError(slotValidation.error ?? "Invalid slot time.", 400);
        }

        // No existing PENDING proposal (check before eligibility so we
        // return 409 even if the order is in RESCHEDULE_PROPOSED state)
        if (
          order.proposedSlot &&
          order.proposedSlot.status === "PENDING"
        ) {
          throw new OrderStatusError(
            "A pending proposal already exists for this order",
            409,
          );
        }

        // Order must be eligible for rescheduling
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

        // Proposed time must not be identical to current confirmed slot
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

        // Record previous status for later restoration
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
  } catch (error) {
    console.error("Propose slot failed:", error);
    res.status(500).json({ message: "Unable to propose slot" });
  }
};

/*
|--------------------------------------------------------------------------
| ACCEPT PROPOSAL (CUSTOMER)
|--------------------------------------------------------------------------
| POST /api/orders/:id/proposal/accept
|
| Customer accepts the proposed slot.
|--------------------------------------------------------------------------
*/

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
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);
        if (!order) {
          throw new OrderStatusError("Order not found", 404);
        }

        // Verify customer ownership
        if (
          order.userId &&
          order.userId.toString() !== customerId
        ) {
          res.status(404).json({ message: "Order not found" });
          return;
        }

        // Proposal must exist
        if (!order.proposedSlot) {
          throw new OrderStatusError("No proposal exists for this order", 400);
        }

        // Proposal must be PENDING
        if (order.proposedSlot.status !== "PENDING") {
          throw new OrderStatusError(
            `Proposal is already ${order.proposedSlot.status.toLowerCase()}`,
            400,
          );
        }

        // Proposal must not be expired
        const now = new Date();
        if (
          order.proposedSlot.expiresAt &&
          order.proposedSlot.expiresAt.getTime() <= now.getTime()
        ) {
          order.proposedSlot.status = "EXPIRED";
          order.orderStatus =
            order.reschedulePreviousStatus ?? "CONFIRMED";
          await order.save({ session });
          throw new OrderStatusError("Proposal has expired", 400);
        }

        // Order must not be in a terminal state
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

        // Accept the proposal
        const previousConfirmedSlot = order.confirmedSlot;
        order.confirmedSlot = order.proposedSlot.time;
        order.proposedSlot.status = "ACCEPTED";

        // Record history
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

        // Restore appropriate order status
        const previousStatus = order.reschedulePreviousStatus;
        if (previousStatus === "PLACED") {
          order.orderStatus = "CONFIRMED";
        } else if (previousStatus === "PAYMENT_CONFIRMED") {
          order.orderStatus = "PAYMENT_CONFIRMED";
        } else {
          order.orderStatus = "CONFIRMED";
        }

        // Sync existing scheduledDate/scheduledTime for backward compatibility
        order.scheduledDate = order.confirmedSlot
          .toISOString()
          .split("T")[0];
        order.scheduledTime = order.confirmedSlot
          .toISOString()
          .split("T")[1]?.split(".")[0] ?? "10:00:00";

        // Clear the previous status tracker
        order.reschedulePreviousStatus = undefined;

        await order.save({ session });

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
  } catch (error) {
    console.error("Accept proposal failed:", error);
    res.status(500).json({ message: "Unable to accept proposal" });
  }
};

/*
|--------------------------------------------------------------------------
| DECLINE PROPOSAL (CUSTOMER)
|--------------------------------------------------------------------------
| POST /api/orders/:id/proposal/decline
|
| Customer declines the proposed slot.
|--------------------------------------------------------------------------
*/

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
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);
        if (!order) {
          throw new OrderStatusError("Order not found", 404);
        }

        // Verify customer ownership
        if (
          order.userId &&
          order.userId.toString() !== customerId
        ) {
          res.status(404).json({ message: "Order not found" });
          return;
        }

        // Proposal must exist
        if (!order.proposedSlot) {
          throw new OrderStatusError("No proposal exists for this order", 400);
        }

        // Proposal must be PENDING
        if (order.proposedSlot.status !== "PENDING") {
          throw new OrderStatusError(
            `Proposal is already ${order.proposedSlot.status.toLowerCase()}`,
            400,
          );
        }

        // Proposal must not be expired
        const now = new Date();
        if (
          order.proposedSlot.expiresAt &&
          order.proposedSlot.expiresAt.getTime() <= now.getTime()
        ) {
          order.proposedSlot.status = "EXPIRED";
          order.orderStatus =
            order.reschedulePreviousStatus ?? "CONFIRMED";
          await order.save({ session });
          throw new OrderStatusError("Proposal has expired", 400);
        }

        // Order must not be in a terminal state
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

        // Decline the proposal
        order.proposedSlot.status = "DECLINED";

        // Record history
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

        // Restore previous order status
        order.orderStatus =
          order.reschedulePreviousStatus ?? "CONFIRMED";
        order.reschedulePreviousStatus = undefined;

        await order.save({ session });

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
  } catch (error) {
    console.error("Decline proposal failed:", error);
    res.status(500).json({ message: "Unable to decline proposal" });
  }
};