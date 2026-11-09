import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

/*
|--------------------------------------------------------------------------
| REQUEST ID MIDDLEWARE
|--------------------------------------------------------------------------
| Generates a unique request ID for every incoming request and attaches it
| to req.id and the response header X-Request-ID. This enables request
| tracing across logs and error reporting without exposing internal details
| to clients.
|--------------------------------------------------------------------------
*/

export function requestIdMiddleware(
  req: Request & { id?: string },
  res: Response,
  next: NextFunction,
): void {
  const requestId = crypto.randomBytes(16).toString("hex");

  req.id = requestId;

  res.setHeader("X-Request-ID", requestId);

  next();
}

export function getRequestId(req: Request): string | undefined {
  return (req as Request & { id?: string }).id;
}
