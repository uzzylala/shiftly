import type { NextFunction, Request, Response } from "express";
import type { ApiErrorBody, ConflictReason } from "@shiftly/shared";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public conflicts?: ConflictReason[],
  ) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    const body: ApiErrorBody = {
      message: err.message,
      ...(err.conflicts ? { conflicts: err.conflicts } : {}),
    };
    res.status(err.status).json(body);
    return;
  }

  console.error(err);
  const body: ApiErrorBody = { message: "Internal server error" };
  res.status(500).json(body);
}
