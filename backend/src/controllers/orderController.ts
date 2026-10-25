import type { Request, Response } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";

import { Order } from "../models/Order.js";
import type { IOrderItem } from "../models/Order.js";
import { Product } from "../models/Product.js";
import type { AuthRequest } from "../middleware/auth.js";
import {
  InventoryUnavailableError,
  reserveInventory,
  restoreInventory,
} from "../services/inventory.js";
import { getRazorpayKeyId, getRazorpayKeySecret } from "../services/razorpay.js";
import { ONLINE_RESERVATION_TTL_MS } from "../services/inventoryExpiry.js";

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
    "OUT_FOR_DELIVERY",
    "DELIVERED",
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
| PLACED -> CONFIRMED -> PREPARING -> READY
|        -> OUT_FOR_DELIVERY -> DELIVERED
|
| Cancellation is only allowed from active,
| pre-delivery states. DELIVERED and CANCELLED
| are terminal.
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
    "CANCELLED",
  ],
  READY: [
    "OUT_FOR_DELIVERY",
    "CANCELLED",
  ],
  OUT_FOR_DELIVERY: [
    "DELIVERED",
  ],
  DELIVERED: [],
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

  if (data.fulfillmentType === "DELIVERY" && !data.address) {
    res.status(400).json({
      message: "Delivery address is required for delivery orders",
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
          } else if (nextStatus === "DELIVERED" && currentOrder.inventoryStatus === "RESERVED") {
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