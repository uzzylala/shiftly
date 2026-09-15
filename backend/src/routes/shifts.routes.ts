import { Router } from "express";
import { createShiftSchema, updateShiftSchema } from "@shiftly/shared";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/errorHandler.js";

export const shiftsRouter = Router();

shiftsRouter.use(requireAuth);

// Optional ?start=&end= ISO bounds to scope the calendar view's query.
shiftsRouter.get("/", async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const shifts = await prisma.shift.findMany({
      where: {
        organizationId: req.auth!.organizationId,
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

      const shift = await prisma.shift.create({
        data: {
          organizationId: req.auth!.organizationId,
          employeeId: req.body.employeeId,
          startTime: new Date(req.body.startTime),
          endTime: new Date(req.body.endTime),
          note: req.body.note ?? null,
        },
      });
      res.status(201).json(shift);
    } catch (err) {
      next(err);
    }
  },
);

shiftsRouter.patch(
  "/:id",
  validateBody(updateShiftSchema),
  async (req, res, next) => {
    try {
      const existing = await prisma.shift.findFirst({
        where: { id: req.params.id, organizationId: req.auth!.organizationId },
      });
      if (!existing) {
        throw new HttpError(404, "Shift not found");
      }

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

      const shift = await prisma.shift.update({
        where: { id: existing.id },
        data: {
          ...(req.body.employeeId ? { employeeId: req.body.employeeId } : {}),
          ...(req.body.startTime
            ? { startTime: new Date(req.body.startTime) }
            : {}),
          ...(req.body.endTime ? { endTime: new Date(req.body.endTime) } : {}),
          ...(req.body.note !== undefined ? { note: req.body.note } : {}),
        },
      });
      res.json(shift);
    } catch (err) {
      next(err);
    }
  },
);

shiftsRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.shift.findFirst({
      where: { id: req.params.id, organizationId: req.auth!.organizationId },
    });
    if (!existing) {
      throw new HttpError(404, "Shift not found");
    }
    await prisma.shift.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
