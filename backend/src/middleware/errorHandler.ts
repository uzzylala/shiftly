import type { NextFunction, Request, Response } from "express";
import type { ApiErrorBody } from "@shiftly/shared";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
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
    const body: ApiErrorBody = { message: err.message };
    res.status(err.status).json(body);
    return;
  }

  console.error(err);
  const body: ApiErrorBody = { message: "Internal server error" };
  res.status(500).json(body);
}
