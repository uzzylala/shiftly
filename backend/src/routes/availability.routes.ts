import { Router } from "express";
import { createAvailabilityWindowSchema } from "@shiftly/shared";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { authUserFromRequest, requirePermission } from "../middleware/permission.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/errorHandler.js";

export const availabilityRouter = Router();

availabilityRouter.use(requireAuth);

// Manager/HR pass ?employeeId= to inspect one employee's submitted
// availability (needed to judge a shift before assigning it). An employee
// is always scoped to their own regardless of what's requested.
availabilityRouter.get("/", async (req, res, next) => {
  try {
    const authUser = authUserFromRequest(req);
    const requested = req.query.employeeId as string | undefined;

    let employeeId: string;
    if (authUser.role === "employee") {
      if (!authUser.employeeId) {
        res.json([]);
        return;
      }
      employeeId = authUser.employeeId;
    } else {
      if (!requested) {
        throw new HttpError(400, "employeeId query param is required");
      }
      employeeId = requested;
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId: authUser.organizationId },
    });
    if (!employee) {
      throw new HttpError(404, "Employee not found");
    }

    const windows = await prisma.availabilityWindow.findMany({
      where: { employeeId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    res.json(windows);
  } catch (err) {
    next(err);
  }
});

availabilityRouter.post(
  "/",
  requirePermission("availability:submit"),
  validateBody(createAvailabilityWindowSchema),
  async (req, res, next) => {
    try {
      const authUser = authUserFromRequest(req);
      if (!authUser.employeeId) {
        throw new HttpError(422, "This login isn't linked to a roster employee");
      }

      const window = await prisma.availabilityWindow.create({
        data: {
          employeeId: authUser.employeeId,
          dayOfWeek: req.body.dayOfWeek,
          startTime: req.body.startTime,
          endTime: req.body.endTime,
        },
      });
      res.status(201).json(window);
    } catch (err) {
      next(err);
    }
  },
);

availabilityRouter.delete(
  "/:id",
  requirePermission("availability:submit"),
  async (req, res, next) => {
    try {
      const authUser = authUserFromRequest(req);
      const window = await prisma.availabilityWindow.findFirst({
        where: { id: req.params.id, employeeId: authUser.employeeId ?? "__none__" },
      });
      if (!window) {
        throw new HttpError(404, "Availability window not found");
      }
      await prisma.availabilityWindow.delete({ where: { id: window.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
