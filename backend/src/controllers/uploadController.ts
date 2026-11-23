import type { Request, Response } from "express";

import {
  getUploadSignature,
  isCloudinaryConfigured,
} from "../services/cloudinary.js";
import type { AuthRequest } from "../middleware/auth.js";
import { isUatExternalSideEffectsBlocked } from "../config/uatSafeMode.js";
import { logUatSuppressed } from "../services/uatSafetyLog.js";

/*
|--------------------------------------------------------------------------
| UPLOAD SIGNATURE (ADMIN ONLY)
|--------------------------------------------------------------------------
| POST /api/admin/uploads/signature
|
| Generates a server-side Cloudinary signed upload signature. The frontend
| uses these parameters to upload an image directly to Cloudinary. The
| Cloudinary API secret is never returned to the browser.
|--------------------------------------------------------------------------
*/

export const getUploadSignatureController = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ message: "Admin authentication required" });
      return;
    }

    if (isUatExternalSideEffectsBlocked()) {
      logUatSuppressed("cloudinary.admin_upload_signature");
      res.status(403).json({
        message: "External upload operations are blocked in UAT_SAFE_MODE.",
        code: "UAT_SAFE_MODE_EXTERNAL_BLOCKED",
      });
      return;
    }

    if (!isCloudinaryConfigured()) {
      res.status(503).json({
        message:
          "Image upload is not configured. Please contact the bakery administrator.",
      });
      return;
    }

    const signature = getUploadSignature({ folder: "sv-bakery/products" });

    res.status(200).json({
      message: "Upload signature generated",
      signature: {
        timestamp: signature.timestamp,
        signature: signature.signature,
        apiKey: signature.apiKey,
        cloudName: signature.cloudName,
        folder: signature.folder,
      },
    });
  } catch (error) {
    console.error("Admin upload signature failed:", error);
    res.status(500).json({ message: "Unable to generate upload signature" });
  }
};

/*
|--------------------------------------------------------------------------
| CUSTOMER UPLOAD SIGNATURE (CUSTOMER ONLY)
|--------------------------------------------------------------------------
| POST /api/customer/uploads/signature
|
| Generates a server-side Cloudinary signed upload signature so an
| authenticated customer can upload a custom-cake reference photo
| directly to Cloudinary. The Cloudinary API secret is never returned
| to the browser.
|--------------------------------------------------------------------------
*/

export const getCustomerUploadSignatureController = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.customer) {
      res.status(401).json({ message: "Customer authentication required" });
      return;
    }

    if (isUatExternalSideEffectsBlocked()) {
      logUatSuppressed("cloudinary.customer_upload_signature");
      res.status(403).json({
        message: "External upload operations are blocked in UAT_SAFE_MODE.",
        code: "UAT_SAFE_MODE_EXTERNAL_BLOCKED",
      });
      return;
    }

    if (!isCloudinaryConfigured()) {
      res.status(503).json({
        message:
          "Image upload is not configured. Please contact the bakery administrator.",
      });
      return;
    }

    const signature = getUploadSignature({
      folder: "sv-bakery/custom-cakes",
    });

    res.status(200).json({
      message: "Upload signature generated",
      signature: {
        timestamp: signature.timestamp,
        signature: signature.signature,
        apiKey: signature.apiKey,
        cloudName: signature.cloudName,
        folder: signature.folder,
      },
    });
  } catch (error) {
    console.error("Customer upload signature failed:", error);
    res.status(500).json({ message: "Unable to generate upload signature" });
  }
};
