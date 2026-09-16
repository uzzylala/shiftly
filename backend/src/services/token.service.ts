import jwt from "jsonwebtoken";
import type { AuthUser } from "@shiftly/shared";
import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: AuthUser["role"];
  organizationId: string;
  employeeId: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
}

export function signAccessToken(user: AuthUser): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    employeeId: user.employeeId,
  };
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl,
  } as jwt.SignOptions);
}

export function signRefreshToken(user: AuthUser): string {
  const payload: RefreshTokenPayload = { sub: user.id };
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenTtl,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
}
