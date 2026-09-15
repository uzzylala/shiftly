import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../services/token.service.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing bearer token" });
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
