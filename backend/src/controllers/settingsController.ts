import type { Request, Response } from "express";
import { z } from "zod";

import { Settings } from "../models/Settings.js";
import type { AuthRequest } from "../middleware/auth.js";

const updateSettingsSchema = z.object({
  onlineOrdersEnabled: z.boolean().optional(),
  deliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
  closedMessage: z.string().trim().min(1).max(500).optional(),
  reopenAt: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
});

function serializeSettings(settings: ISettingsLike) {
  return {
    id: settings._id,
    onlineOrdersEnabled: settings.onlineOrdersEnabled,
    deliveryEnabled: settings.deliveryEnabled,
    pickupEnabled: settings.pickupEnabled,
    closedMessage: settings.closedMessage,
    reopenAt: settings.reopenAt,
  };
}

export const getSettings = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const settings = await Settings.getSingleton();
    res.status(200).json({
      settings: serializeSettings(settings as unknown as ISettingsLike),
    });
  } catch (error) {
    console.error("Get settings failed:", error);
    res.status(500).json({ message: "Unable to fetch settings" });
  }
};

export const updateSettings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid settings data",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.onlineOrdersEnabled !== undefined) {
      updates.onlineOrdersEnabled = parsed.data.onlineOrdersEnabled;
    }
    if (parsed.data.deliveryEnabled !== undefined) {
      updates.deliveryEnabled = parsed.data.deliveryEnabled;
    }
    if (parsed.data.pickupEnabled !== undefined) {
      updates.pickupEnabled = parsed.data.pickupEnabled;
    }
    if (parsed.data.closedMessage !== undefined) {
      updates.closedMessage = parsed.data.closedMessage;
    }
    if (parsed.data.reopenAt !== undefined) {
      updates.reopenAt = parsed.data.reopenAt;
    }

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: updates },
      {
        returnDocument: "after",
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    res.status(200).json({
      message: "Settings updated successfully",
      settings: serializeSettings(settings as unknown as ISettingsLike),
    });
  } catch (error) {
    console.error("Update settings failed:", error);
    res.status(500).json({ message: "Unable to update settings" });
  }
};

interface ISettingsLike {
  _id: unknown;
  onlineOrdersEnabled: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  closedMessage: string;
  reopenAt: Date | null;
}
