import { Router } from "express";
import {
  createShiftSchema,
  findShiftConflicts,
  hasBlockingConflict,
  updateShiftSchema,
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

export const shiftsRouter = Router();

shiftsRouter.use(requireAuth);

// Optional ?start=&end= ISO bounds to scope the calendar view's query.
// Employees are always scoped to their own shifts regardless of what's
// requested — this is the enforcement point, not the client's UI.
shiftsRouter.get("/", async (req, res, next) => {
  try {
    const authUser = authUserFromRequest(req);
    const { start, end } = req.query as { start?: string; end?: string };

    const shifts = await prisma.shift.findMany({
      where: {
        organizationId: authUser.organizationId,
        ...(authUser.role === "employee"
          ? { employeeId: authUser.employeeId ?? "__none__" }
          : {}),
        ...(start || end
          ? {
              startTime: {
                ...(start ? { gte: new Date(start) } : {}),
                ...(end ? { lte: new Date(end) } : {}),
              },
            }
          : {}),
      },
      orderBy: { startTime: "asc" },
      include: { employee: true },
    });
    res.json(shifts);
  } catch (err) {
    next(err);
  }
});

shiftsRouter.post(
  "/",
  requirePermission("shift:create"),
  validateBody(createShiftSchema),
  async (req, res, next) => {
    try {
      const employee = await prisma.employee.findFirst({
        where: {
          id: req.body.employeeId,
          organizationId: req.auth!.organizationId,
        },
      });
      if (!employee) {
        throw new HttpError(422, "Employee does not belong to this organization");
      }

      const context = await loadConflictContext(
        req.auth!.organizationId,
        req.body.employeeId,
      );
      const conflicts = findShiftConflicts(
        {
          employeeId: req.body.employeeId,
          startTime: req.body.startTime,
          endTime: req.body.endTime,
        },
        context,
      );
      if (hasBlockingConflict(conflicts)) {
        throw new HttpError(422, "Shift conflicts with availability or an existing shift", conflicts);
      }

      const shift = await prisma.$transaction(async (tx) => {
        const created = await tx.shift.create({
          data: {
            organizationId: req.auth!.organizationId,
            employeeId: req.body.employeeId,
            startTime: new Date(req.body.startTime),
            endTime: new Date(req.body.endTime),
            location: req.body.location,
            status: req.body.status,
            note: req.body.note ?? null,
          },
        });
        await recordShiftAudit(tx, {
          organizationId: req.auth!.organizationId,
          shiftId: created.id,
          actorUserId: req.auth!.sub,
          actorName: req.auth!.name,
          action: "created",
          before: null,
          after: toSharedShift(created),
        });
        return created;
      });

      res.status(201).json(shift);
    } catch (err) {
      next(err);
    }
  },
);

shiftsRouter.patch(
  "/:id",
  requirePermission("shift:update"),
  validateBody(updateShiftSchema),
  async (req, res, next) => {
    try {
      const existing = await prisma.shift.findFirst({
        where: { id: req.params.id, organizationId: req.auth!.organizationId },
      });
      if (!existing) {
        throw new HttpError(404, "Shift not found");
      }

      const targetEmployeeId = req.body.employeeId ?? existing.employeeId;
      if (req.body.employeeId) {
        const employee = await prisma.employee.findFirst({
          where: {
            id: req.body.employeeId,
            organizationId: req.auth!.organizationId,
          },
        });
        if (!employee) {
          throw new HttpError(422, "Employee does not belong to this organization");
        }
      }

      const context = await loadConflictContext(
        req.auth!.organizationId,
        targetEmployeeId,
      );
      const conflicts = findShiftConflicts(
        {
          employeeId: targetEmployeeId,
          startTime: req.body.startTime ?? existing.startTime.toISOString(),
          endTime: req.body.endTime ?? existing.endTime.toISOString(),
          excludeShiftId: existing.id,
        },
        context,
      );
      if (hasBlockingConflict(conflicts)) {
        throw new HttpError(422, "Shift conflicts with availability or an existing shift", conflicts);
      }

      const shift = await prisma.$transaction(async (tx) => {
        const updated = await tx.shift.update({
          where: { id: existing.id },
          data: {
            ...(req.body.employeeId ? { employeeId: req.body.employeeId } : {}),
            ...(req.body.startTime
              ? { startTime: new Date(req.body.startTime) }
              : {}),
            ...(req.body.endTime ? { endTime: new Date(req.body.endTime) } : {}),
            ...(req.body.location ? { location: req.body.location } : {}),
            ...(req.body.status ? { status: req.body.status } : {}),
            ...(req.body.note !== undefined ? { note: req.body.note } : {}),
          },
        });
        await recordShiftAudit(tx, {
          organizationId: req.auth!.organizationId,
          shiftId: updated.id,
          actorUserId: req.auth!.sub,
          actorName: req.auth!.name,
          action: "updated",
          before: toSharedShift(existing),
          after: toSharedShift(updated),
        });
        return updated;
      });

      res.json(shift);
    } catch (err) {
      next(err);
    }
  },
);

shiftsRouter.delete(
  "/:id",
  requirePermission("shift:delete"),
  async (req, res, next) => {
    try {
      const existing = await prisma.shift.findFirst({
        where: { id: req.params.id, organizationId: req.auth!.organizationId },
      });
      if (!existing) {
        throw new HttpError(404, "Shift not found");
      }

      await prisma.$transaction(async (tx) => {
        await tx.shift.delete({ where: { id: existing.id } });
        await recordShiftAudit(tx, {
          organizationId: req.auth!.organizationId,
          shiftId: existing.id,
          actorUserId: req.auth!.sub,
          actorName: req.auth!.name,
          action: "deleted",
          before: toSharedShift(existing),
          after: null,
        });
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
