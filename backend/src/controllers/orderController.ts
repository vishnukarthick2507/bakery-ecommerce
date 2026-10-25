import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { Order } from "../models/Order.js";
import type { IOrderItem } from "../models/Order.js";
import { Product } from "../models/Product.js";
import type { AuthRequest } from "../middleware/auth.js";

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
  try {
    // Validate request body
    const parsed =
      createOrderSchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid order data",
        errors:
          parsed.error.flatten(),
      });

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

    // Delivery orders must have an address
    if (
      data.fulfillmentType ===
        "DELIVERY" &&
      !data.address
    ) {
      res.status(400).json({
        message:
          "Delivery address is required for delivery orders",
      });

      return;
    }

    // Get product IDs
    const productIds =
      data.items.map(
        (item) => item.productId,
      );

    // Validate MongoDB IDs
    const invalidId =
      productIds.find(
        (id) =>
          !mongoose.isValidObjectId(
            id,
          ),
      );

    if (invalidId) {
      res.status(400).json({
        message: `Invalid product ID: ${invalidId}`,
      });

      return;
    }

    // Fetch products from MongoDB
    const products =
      (await Product.find({
        _id: {
          $in: productIds,
        },
        active: true,
      })
        .lean()
        .exec()) as unknown as ProductRecord[];

    // Create product lookup map
    const productMap =
      new Map<string, ProductRecord>(
        products.map(
          (
            product: ProductRecord,
          ) => [
            product._id.toString(),
            product,
          ],
        ),
      );

    const orderItems: IOrderItem[] =
      [];

    const quantityByProduct = new Map<string, number>();
    for (const item of data.items) {
      quantityByProduct.set(
        item.productId,
        (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }

    if ([...quantityByProduct.values()].some((quantity) => quantity > 20)) {
      res.status(400).json({
        message: "A maximum of 20 units per product can be ordered",
      });
      return;
    }

    // Validate every item
    for (const item of data.items) {
      const product =
        productMap.get(
          item.productId,
        );

      if (!product) {
        res.status(400).json({
          message: `Product not found: ${item.productName}`,
        });

        return;
      }

      // Check availability
      if (
        product.availability !==
        "AVAILABLE"
      ) {
        res.status(400).json({
          message: `${product.name} is currently unavailable`,
        });

        return;
      }

      // Check stock
      if (
        product.stock <
        (quantityByProduct.get(item.productId) ?? item.quantity)
      ) {
        res.status(400).json({
          message: `Only ${product.stock} unit(s) of ${product.name} are available`,
        });

        return;
      }

      // Price comes from MongoDB
      const unitPrice =
        product.price;

      const totalPrice =
        unitPrice *
        item.quantity;

      orderItems.push({
        productId:
          product._id,

        productName:
          product.name,

        variantId:
          item.variantId,

        quantity:
          item.quantity,

        unitPrice,

        itemTotal: totalPrice,

        totalPrice,
      });
    }

    // Calculate subtotal
    const subtotal =
      orderItems.reduce(
        (sum, item) =>
          sum + item.totalPrice,
        0,
      );

    // Delivery fee
    const deliveryFee = 0;

    // Final amount
    const totalAmount =
      subtotal +
      deliveryFee;

    // Prepare order
    const orderData = {
      orderNumber:
        generateOrderNumber(),

      ...(req.customer ? { userId: req.customer.id } : {}),

      customer: {
        ...customerSnapshot,
      },

      customerName:
        customerSnapshot.name,

      phone:
        customerSnapshot.phone,

      fulfillmentType:
        data.fulfillmentType,

      ...(data.fulfillmentType ===
        "DELIVERY" &&
      data.address
        ? {
            address:
              data.address,
          }
        : {}),

      scheduledDate:
        data.scheduledDate,

      scheduledTime:
        data.scheduledTime,

      paymentMethod:
        data.paymentMethod,

      paymentStatus:
        "PENDING" as const,

      orderStatus:
        "PLACED" as const,

      items:
        orderItems,

      subtotal,

      deliveryFee,

      totalAmount,
    };

    // Save to MongoDB
    const order =
      await Order.create(
        orderData,
      );

    // Response
    res.status(201).json({
      message:
        "Order created successfully",

      order: {
        id: order._id,

        orderNumber:
          order.orderNumber,

        status:
          order.orderStatus,

        paymentStatus:
          order.paymentStatus,

        totalAmount:
          order.totalAmount,

        createdAt:
          order.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Create order failed:",
      error,
    );

    res.status(500).json({
      message:
        "Unable to create order",
    });
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

      // Load the order to enforce transition rules
      const existingOrder =
        await Order.findOne({
          orderNumber,
        }).lean();

      if (!existingOrder) {
        res.status(404).json({
          message:
            "Order not found",
        });

        return;
      }

      const currentStatus =
        existingOrder.orderStatus as OrderStatusValue;

      const allowed =
        allowedStatusTransitions[
          currentStatus
        ] ?? [];

      if (
        !allowed.includes(nextStatus)
      ) {
        res.status(400).json({
          message: `Cannot change order status from ${currentStatus} to ${nextStatus}`,
          allowedTransitions:
            allowed,
        });

        return;
      }

      // Update MongoDB
      const order =
        await Order.findOneAndUpdate(
          {
            orderNumber,
          },
          {
            $set: {
              orderStatus:
                nextStatus,
            },
          },
          {
            new: true,
            runValidators: true,
          },
        ).lean();

      if (!order) {
        res.status(404).json({
          message:
            "Order not found",
        });

        return;
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