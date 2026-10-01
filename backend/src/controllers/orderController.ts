import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { Order } from "../models/Order.js";
import type { IOrderItem } from "../models/Order.js";
import { Product } from "../models/Product.js";

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
  customerName: z.string().trim().min(2),

  phone: z.string().trim().min(5),

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

  items: z.array(orderItemSchema).min(1),
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
  req: Request,
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
        item.quantity
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

      customerName:
        data.customerName,

      phone:
        data.phone,

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
    req: Request,
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

      res.status(200).json({
        order: {
          id: order._id,

          orderNumber:
            order.orderNumber,

          customerName:
            order.customerName,

          phone:
            order.phone,

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

      // Update MongoDB
      const order =
        await Order.findOneAndUpdate(
          {
            orderNumber,
          },
          {
            $set: {
              orderStatus:
                parsed.data.status,
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