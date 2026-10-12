import type { Request, Response } from "express";
import { z } from "zod";

import { CustomCakeRequest } from "../models/CustomCakeRequest.js";

const customCakeRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),

  phone: z
    .string()
    .trim()
    .min(8)
    .max(20)
    .regex(
      /^[+0-9\s-]+$/,
      "Phone number can only contain digits, spaces, + and -",
    ),

  flavour: z.string().trim().min(2).max(100),

  weight: z.string().trim().min(1).max(50),

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

    const request = await CustomCakeRequest.create({
      ...parsed.data,
      referenceNumber: generateReferenceNumber(),
    });

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
| GET ALL CUSTOM CAKE REQUESTS
|--------------------------------------------------------------------------
| GET /api/custom-cake-requests
|--------------------------------------------------------------------------
*/

export const getAllCustomCakeRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const requests = await CustomCakeRequest.find()
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ requests });
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