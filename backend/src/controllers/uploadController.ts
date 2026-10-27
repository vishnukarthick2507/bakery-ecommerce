import type { Request, Response } from "express";

import {
  getUploadSignature,
  isCloudinaryConfigured,
} from "../services/cloudinary.js";
import type { AuthRequest } from "../middleware/auth.js";

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

    if (!isCloudinaryConfigured()) {
      res.status(503).json({
        message:
          "Image upload is not configured. Please contact the bakery administrator.",
      });
      return;
    }

    const signature = getUploadSignature();

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
    console.error("Upload signature failed:", error);
    res.status(500).json({ message: "Unable to generate upload signature" });
  }
};
