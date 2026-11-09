import type { Request, Response } from "express";
import { z } from "zod";

import { User } from "../models/User.js";
import type { AuthRequest } from "../middleware/auth.js";

const customerPaginationSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

const toggleActiveSchema = z.object({
  active: z.boolean(),
});

/*
|--------------------------------------------------------------------------
| GET ALL CUSTOMERS (ADMIN ONLY)
|--------------------------------------------------------------------------
| GET /api/admin/customers?page=1&limit=20&search=term
|--------------------------------------------------------------------------
*/

export const getAllCustomers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const parsed = customerPaginationSchema.safeParse(req.query);

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
        { email: { $regex: searchTerm, $options: "i" } },
        { phone: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const countQuery = User.countDocuments(filter);
    const findQuery = User.find(filter)
      .select("name email phone active createdAt updatedAt tokenVersion")
      .sort({ createdAt: -1 })
      .lean();

    if (hasPagination) {
      const safePage = Math.max(1, pageNum);
      const safeLimit = Math.min(100, Math.max(1, limitNum));
      const skip = (safePage - 1) * safeLimit;

      findQuery.skip(skip).limit(safeLimit);
    }

    const [customers, total] = await Promise.all([findQuery, countQuery]);

    if (hasPagination) {
      res.status(200).json({
        customers: customers.map((c) => ({
          id: c._id.toString(),
          name: c.name,
          email: c.email,
          phone: c.phone,
          active: c.active,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
        pagination: {
          page: Math.max(1, pageNum),
          limit: Math.min(100, Math.max(1, limitNum)),
          total,
          totalPages: Math.ceil(total / Math.min(100, Math.max(1, limitNum))),
        },
      });
    } else {
      res.status(200).json({
        customers: customers.map((c) => ({
          id: c._id.toString(),
          name: c.name,
          email: c.email,
          phone: c.phone,
          active: c.active,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      });
    }
  } catch (error) {
    console.error("Get all customers failed:", error);
    res.status(500).json({ message: "Unable to fetch customers" });
  }
};

/*
|--------------------------------------------------------------------------
| TOGGLE CUSTOMER ACTIVE STATUS (ADMIN ONLY)
|--------------------------------------------------------------------------
| PATCH /api/admin/customers/:id/active
|--------------------------------------------------------------------------
*/

export const toggleCustomerActive = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const customerId = Array.isArray(id) ? id[0] : id;

    if (!customerId || typeof customerId !== "string") {
      res.status(400).json({ message: "Invalid customer ID" });
      return;
    }

    const parsed = toggleActiveSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid request",
        errors: parsed.error.flatten(),
      });
      return;
    }

    if (!mongooseIsValidObjectId(customerId)) {
      res.status(400).json({ message: "Invalid customer ID" });
      return;
    }

    const { active } = parsed.data;

    const customer = await User.findByIdAndUpdate(
      customerId,
      { $set: { active } },
      {
        returnDocument: "after",
        select: "name email phone active",
      },
    ).lean();

    if (!customer) {
      res.status(404).json({ message: "Customer not found" });
      return;
    }

    res.status(200).json({
      message: `Customer ${active ? "activated" : "deactivated"} successfully`,
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        active: customer.active,
      },
    });
  } catch (error) {
    console.error("Toggle customer active failed:", error);
    res.status(500).json({ message: "Unable to update customer" });
  }
};

function mongooseIsValidObjectId(id: string): boolean {
  const mongoose = require("mongoose");
  return mongoose.Types.ObjectId.isValid(id);
}
