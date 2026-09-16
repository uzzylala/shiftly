import { Router } from "express";
import {
  canPerformSwapAction,
  createSwapRequestSchema,
  findShiftConflicts,
  hasBlockingConflict,
  type SwapAction,
  type SwapRequest,
} from "@shiftly/shared";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { authUserFromRequest, requirePermission } from "../middleware/permission.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/errorHandler.js";
import { recordShiftAudit } from "../services/audit.service.js";
import {
  loadConflictContext,
  toSharedShift,
} from "../services/shift-conflict.service.js";
import {
  pushNotification,
  writeNotification,
} from "../services/notification.service.js";
import type { SwapRequest as PrismaSwapRequest } from "../generated/prisma/client.js";

export const swapRequestsRouter = Router();

swapRequestsRouter.use(requireAuth);

function toSharedSwap(row: PrismaSwapRequest): SwapRequest {
  return {
    id: row.id,
    organizationId: row.organizationId,
    shiftId: row.shiftId,
    requesterId: row.requesterId,
    coworkerId: row.coworkerId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// GET /?status= — employees see swaps where they're requester or coworker;
// manager/HR see the whole organization's (e.g. filtered to
// accepted_by_coworker for a "needs my approval" queue).
swapRequestsRouter.get("/", async (req, res, next) => {
  try {
    const authUser = authUserFromRequest(req);
    const status = req.query.status as string | undefined;

    const rows = await prisma.swapRequest.findMany({
      where: {
        organizationId: authUser.organizationId,
        ...(authUser.role === "employee"
          ? {
              OR: [
                { requesterId: authUser.employeeId ?? "__none__" },
                { coworkerId: authUser.employeeId ?? "__none__" },
              ],
            }
          : {}),
        ...(status ? { status: status as PrismaSwapRequest["status"] } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(toSharedSwap));
  } catch (err) {
    next(err);
  }
});

swapRequestsRouter.post(
  "/",
  requirePermission("swap:request"),
  validateBody(createSwapRequestSchema),
  async (req, res, next) => {
    try {
      const authUser = authUserFromRequest(req);
      const { shiftId, coworkerId } = req.body as {
        shiftId: string;
        coworkerId: string;
      };

      if (coworkerId === authUser.employeeId) {
        throw new HttpError(422, "You can't request a swap with yourself");
      }

      const shift = await prisma.shift.findFirst({
        where: { id: shiftId, organizationId: authUser.organizationId },
      });
      if (!shift || shift.employeeId !== authUser.employeeId) {
        throw new HttpError(422, "That shift isn't yours to offer");
      }

      const coworker = await prisma.employee.findFirst({
        where: { id: coworkerId, organizationId: authUser.organizationId },
      });
      if (!coworker) {
        throw new HttpError(422, "Coworker not found in this organization");
      }

      const swap = await prisma.$transaction(async (tx) => {
        const created = await tx.swapRequest.create({
          data: {
            organizationId: authUser.organizationId,
            shiftId,
            requesterId: authUser.employeeId!,
            coworkerId,
          },
        });

        if (coworker.userId) {
          const notification = await writeNotification(tx, {
            userId: coworker.userId,
            type: "swap:requested",
            message: `${authUser.name} wants to swap a shift with you.`,
            swapRequestId: created.id,
            shiftId: shift.id,
          });
          pushNotification(notification);
        }

        return created;
      });

      res.status(201).json(toSharedSwap(swap));
    } catch (err) {
      next(err);
    }
  },
);

async function loadSwapOr404(id: string, organizationId: string) {
  const swap = await prisma.swapRequest.findFirst({
    where: { id, organizationId },
  });
  if (!swap) throw new HttpError(404, "Swap request not found");
  return swap;
}

function requireAction(
  authUser: ReturnType<typeof authUserFromRequest>,
  swap: PrismaSwapRequest,
  action: SwapAction,
) {
  if (!canPerformSwapAction(authUser, swap, action)) {
    throw new HttpError(
      403,
      `You can't ${action} this swap request in its current state`,
    );
  }
}

swapRequestsRouter.post("/:id/accept", async (req, res, next) => {
  try {
    const authUser = authUserFromRequest(req);
    const swap = await loadSwapOr404(req.params.id, authUser.organizationId);
    requireAction(authUser, swap, "accept");

    if (!swap.shiftId) {
      throw new HttpError(
        422,
        "This swap can no longer be completed — the shift it referenced no longer exists",
      );
    }

    const shift = await prisma.shift.findUnique({ where: { id: swap.shiftId } });
    if (!shift) {
      throw new HttpError(
        422,
        "This swap can no longer be completed — the shift it referenced no longer exists",
      );
    }

    const managers = await prisma.user.findMany({
      where: { organizationId: authUser.organizationId, role: "manager" },
    });
    const requester = await prisma.employee.findUnique({
      where: { id: swap.requesterId },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.swapRequest.update({
        where: { id: swap.id },
        data: { status: "accepted_by_coworker" },
      });

      if (requester?.userId) {
        const n = await writeNotification(tx, {
          userId: requester.userId,
          type: "swap:accepted",
          message: `${authUser.name} accepted your swap request — awaiting manager approval.`,
          swapRequestId: swap.id,
          shiftId: shift.id,
        });
        pushNotification(n);
      }
      for (const manager of managers) {
        const n = await writeNotification(tx, {
          userId: manager.id,
          type: "swap:accepted",
          message: `A shift swap needs your approval.`,
          swapRequestId: swap.id,
          shiftId: shift.id,
        });
        pushNotification(n);
      }

      return result;
    });

    res.json(toSharedSwap(updated));
  } catch (err) {
    next(err);
  }
});

swapRequestsRouter.post("/:id/decline", async (req, res, next) => {
  try {
    const authUser = authUserFromRequest(req);
    const swap = await loadSwapOr404(req.params.id, authUser.organizationId);
    requireAction(authUser, swap, "decline");

    const requester = await prisma.employee.findUnique({
      where: { id: swap.requesterId },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.swapRequest.update({
        where: { id: swap.id },
        data: { status: "declined_by_coworker" },
      });
      if (requester?.userId) {
        const n = await writeNotification(tx, {
          userId: requester.userId,
          type: "swap:declined",
          message: `${authUser.name} declined your swap request.`,
          swapRequestId: swap.id,
        });
        pushNotification(n);
      }
      return result;
    });

    res.json(toSharedSwap(updated));
  } catch (err) {
    next(err);
  }
});

swapRequestsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const authUser = authUserFromRequest(req);
    const swap = await loadSwapOr404(req.params.id, authUser.organizationId);
    requireAction(authUser, swap, "cancel");

    const otherEmployeeId =
      authUser.employeeId === swap.requesterId ? swap.coworkerId : swap.requesterId;
    const other = await prisma.employee.findUnique({
      where: { id: otherEmployeeId },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.swapRequest.update({
        where: { id: swap.id },
        data: { status: "cancelled" },
      });
      if (other?.userId) {
        const n = await writeNotification(tx, {
          userId: other.userId,
          type: "swap:cancelled",
          message: `${authUser.name} cancelled a shift swap.`,
          swapRequestId: swap.id,
        });
        pushNotification(n);
      }
      return result;
    });

    res.json(toSharedSwap(updated));
  } catch (err) {
    next(err);
  }
});

swapRequestsRouter.post("/:id/reject", async (req, res, next) => {
  try {
    const authUser = authUserFromRequest(req);
    const swap = await loadSwapOr404(req.params.id, authUser.organizationId);
    requireAction(authUser, swap, "reject");

    const [requester, coworker] = await Promise.all([
      prisma.employee.findUnique({ where: { id: swap.requesterId } }),
      prisma.employee.findUnique({ where: { id: swap.coworkerId } }),
    ]);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.swapRequest.update({
        where: { id: swap.id },
        data: { status: "rejected_by_manager" },
      });
      for (const employee of [requester, coworker]) {
        if (employee?.userId) {
          const n = await writeNotification(tx, {
            userId: employee.userId,
            type: "swap:rejected",
            message: `The manager rejected a shift swap.`,
            swapRequestId: swap.id,
          });
          pushNotification(n);
        }
      }
      return result;
    });

    res.json(toSharedSwap(updated));
  } catch (err) {
    next(err);
  }
});

// The one route where a human action ("approve") and a system action
// ("finalize") happen back to back — see the Phase 4 design note. A manager
// only ever calls this; finalized/finalize_failed are never client-chosen.
swapRequestsRouter.post("/:id/approve", async (req, res, next) => {
  try {
    const authUser = authUserFromRequest(req);
    const swap = await loadSwapOr404(req.params.id, authUser.organizationId);
    requireAction(authUser, swap, "approve");

    if (!swap.shiftId) {
      throw new HttpError(
        422,
        "This swap can no longer be completed — the shift it referenced no longer exists",
      );
    }
    const shift = await prisma.shift.findUnique({ where: { id: swap.shiftId } });
    if (!shift) {
      throw new HttpError(
        422,
        "This swap can no longer be completed — the shift it referenced no longer exists",
      );
    }

    // Guards the "approve" transition itself: would putting the coworker
    // into this slot conflict with their own shifts or availability?
    const context = await loadConflictContext(
      authUser.organizationId,
      swap.coworkerId,
    );
    const conflicts = findShiftConflicts(
      {
        employeeId: swap.coworkerId,
        startTime: shift.startTime.toISOString(),
        endTime: shift.endTime.toISOString(),
        excludeShiftId: shift.id,
      },
      context,
    );
    if (hasBlockingConflict(conflicts)) {
      throw new HttpError(
        422,
        "Can't approve — this would conflict with the coworker's availability or an existing shift",
        conflicts,
      );
    }

    const [requester, coworker] = await Promise.all([
      prisma.employee.findUnique({ where: { id: swap.requesterId } }),
      prisma.employee.findUnique({ where: { id: swap.coworkerId } }),
    ]);

    const result = await prisma.$transaction(async (tx) => {
      await tx.swapRequest.update({
        where: { id: swap.id },
        data: { status: "approved_by_manager" },
      });

      // The reassignment itself — a genuine last-moment failure here (the
      // shift or coworker vanished in the instant between the guard query
      // above and this write) is what finalize_failed exists for, not a
      // repeat of the same check.
      try {
        const reassigned = await tx.shift.update({
          where: { id: shift.id },
          data: { employeeId: swap.coworkerId },
        });
        await recordShiftAudit(tx, {
          organizationId: authUser.organizationId,
          shiftId: reassigned.id,
          actorUserId: authUser.id,
          actorName: authUser.name,
          action: "updated",
          before: toSharedShift(shift),
          after: toSharedShift(reassigned),
        });
        const finalizedSwap = await tx.swapRequest.update({
          where: { id: swap.id },
          data: { status: "finalized" },
        });
        return { swap: finalizedSwap, ok: true as const };
      } catch {
        const failedSwap = await tx.swapRequest.update({
          where: { id: swap.id },
          data: { status: "finalize_failed" },
        });
        return { swap: failedSwap, ok: false as const };
      }
    });

    const type = result.ok ? "swap:finalized" : "swap:finalize_failed";
    const message = result.ok
      ? "Your shift swap was approved and finalized."
      : "Your shift swap was approved but couldn't be applied — please open a new request.";

    await Promise.all(
      [requester, coworker].map(async (employee) => {
        if (!employee?.userId) return;
        const n = await prisma.notification.create({
          data: {
            userId: employee.userId,
            type,
            message,
            swapRequestId: swap.id,
            shiftId: shift.id,
          },
        });
        pushNotification(n);
      }),
    );

    res.json(toSharedSwap(result.swap));
  } catch (err) {
    next(err);
  }
});
