import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import type { ApiErrorBody } from "@shiftly/shared";

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const body: ApiErrorBody = {
        message: "Validation failed",
        details: result.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      };
      res.status(422).json(body);
      return;
    }
    req.body = result.data;
    next();
  };
}
