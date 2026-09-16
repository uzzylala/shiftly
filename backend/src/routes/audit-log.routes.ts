import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const auditLogRouter = Router();

auditLogRouter.use(requireAuth);

// ?shiftId= narrows to one shift's history; otherwise the org's most recent
// changes across all shifts.
auditLogRouter.get(
  "/",
  requirePermission("auditLog:view"),
  async (req, res, next) => {
    try {
      const shiftId = req.query.shiftId as string | undefined;
      const entries = await prisma.auditLog.findMany({
        where: {
          organizationId: req.auth!.organizationId,
          ...(shiftId ? { shiftId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      res.json(entries);
    } catch (err) {
      next(err);
    }
  },
);
