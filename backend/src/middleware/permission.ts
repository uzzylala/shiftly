import type { NextFunction, Request, Response } from "express";
import { can, type Action, type AuthUser } from "@shiftly/shared";
import { HttpError } from "./errorHandler.js";

// req.auth is the verified JWT payload — same shape as AuthUser, keyed as
// `sub` instead of `id`. This is the one place that gap gets bridged so the
// shared policy table can be reused as-is on the server.
export function authUserFromRequest(req: Request): AuthUser {
  const auth = req.auth!;
  return {
    id: auth.sub,
    email: auth.email,
    name: auth.name,
    role: auth.role,
    organizationId: auth.organizationId,
    employeeId: auth.employeeId,
  };
}

export function requirePermission(action: Action) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!can(authUserFromRequest(req), action)) {
      next(new HttpError(403, "Not permitted"));
      return;
    }
    next();
  };
}
