import { Router } from "express";
import bcrypt from "bcryptjs";
import { loginSchema, type AuthUser, type LoginResponse } from "@shiftly/shared";
import { prisma } from "../prisma.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/errorHandler.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../services/token.service.js";

export const authRouter = Router();

function toAuthUser(user: {
  id: string;
  email: string;
  name: string;
  role: AuthUser["role"];
  organizationId: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  };
}

authRouter.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new HttpError(401, "Invalid email or password");
    }

    const authUser = toAuthUser(user);
    const body: LoginResponse = {
      user: authUser,
      accessToken: signAccessToken(authUser),
      refreshToken: signRefreshToken(authUser),
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      throw new HttpError(400, "Missing refresh token");
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new HttpError(401, "Invalid refresh token");
    }

    const authUser = toAuthUser(user);
    res.json({
      accessToken: signAccessToken(authUser),
      refreshToken: signRefreshToken(authUser),
    });
  } catch {
    next(new HttpError(401, "Invalid or expired refresh token"));
  }
});
