import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

/*
|--------------------------------------------------------------------------
| CLOUDINARY CONFIGURATION
|--------------------------------------------------------------------------
| Securely configures Cloudinary using environment variables.
| The API secret is only used server-side to generate signed upload
| signatures. It is never returned to the browser.
|--------------------------------------------------------------------------
*/

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

export function configureCloudinary(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in backend/.env.",
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
    api_key: process.env.CLOUDINARY_API_KEY!.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET!.trim(),
    secure: true,
  });
}

/*
|--------------------------------------------------------------------------
| SIGNED UPLOAD SIGNATURE
|--------------------------------------------------------------------------
| Generates the server-side signature required by Cloudinary's direct
| unsigned/signed upload flow from the browser.
|--------------------------------------------------------------------------
*/

export interface UploadSignature {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export function getUploadSignature(): UploadSignature {
  configureCloudinary();

  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = "sv-bakery/products";

  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
    },
    process.env.CLOUDINARY_API_SECRET!.trim(),
  );

  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY!.trim(),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
    folder,
  };
}

/*
|--------------------------------------------------------------------------
| VERIFY CLOUDINARY URL
|--------------------------------------------------------------------------
| Lightweight check that a URL looks like a Cloudinary secure delivery URL.
|--------------------------------------------------------------------------
*/

export function isCloudinaryUrl(url: string): boolean {
  return /^https:\/\/res\.cloudinary\.com\//.test(url);
}

/*
|--------------------------------------------------------------------------
| EXTRACT PUBLIC ID
|--------------------------------------------------------------------------
| Extracts the Cloudinary public ID from a secure_url for potential
| future deletion flows.
|--------------------------------------------------------------------------
*/

export function extractPublicId(secureUrl: string): string | null {
  const match = secureUrl.match(/^https:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
  return match?.[1] ?? null;
}

export type { UploadApiResponse };
