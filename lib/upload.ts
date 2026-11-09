/*
|--------------------------------------------------------------------------
| CLOUDINARY DIRECT UPLOAD (CLIENT)
|--------------------------------------------------------------------------
| Shared helper used by both Admin (product images) and Customers
| (custom-cake reference photos) to upload files directly to Cloudinary
| after receiving a signed upload signature from the backend.
|
| The Cloudinary API secret never reaches the browser: the backend signs
| each request and returns only the timestamp, apiKey, cloudName, folder
| and signature. Files are sent straight to Cloudinary via XMLHttpRequest
| so upload progress can be reported.
|--------------------------------------------------------------------------
*/

export interface UploadSignature {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export interface UploadOptions {
  /** Called with an integer 0-100 as the file uploads. */
  onProgress?: (percent: number) => void;
  /** Abort the in-flight upload. */
  signal?: AbortSignal;
}

/** Fetch a signed upload signature from the backend (cookie-authenticated). */
export async function fetchUploadSignature(
  endpoint: string,
): Promise<UploadSignature> {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(data.message || "Unable to get upload authorization");
  }

  const data = (await response.json()) as {
    signature?: UploadSignature;
  };

  if (!data.signature) {
    throw new Error("Unable to get upload authorization");
  }

  return data.signature;
}

/** Upload a single file directly to Cloudinary. Returns the secure_url. */
export function uploadFileToCloudinary(
  file: File,
  signature: UploadSignature,
  options: UploadOptions = {},
): Promise<string> {
  const { onProgress, signal } = options;

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signature.apiKey);
    formData.append("timestamp", String(signature.timestamp));
    formData.append("signature", signature.signature);
    formData.append("folder", signature.folder);

    const xhr = new XMLHttpRequest();

    const abort = () => {
      xhr.abort();
      reject(new Error("Upload aborted"));
    };

    if (signal) {
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText) as {
            secure_url?: string;
            error?: { message?: string };
          };
          if (result.secure_url) {
            resolve(result.secure_url);
          } else {
            reject(
              new Error(
                result.error?.message || "Image upload failed",
              ),
            );
          }
        } catch {
          reject(new Error("Image upload failed: invalid response"));
        }
      } else {
        try {
          const result = JSON.parse(xhr.responseText) as {
            error?: { message?: string };
          };
          reject(
            new Error(
              result.error?.message ||
                `Upload failed (${xhr.status})`,
            ),
          );
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Image upload failed: network error"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted"));
    });

    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    );
    xhr.send(formData);
  });
}
