import { Router } from "express";
import { createEmployeeSchema } from "@shiftly/shared";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/errorHandler.js";

export const employeesRouter = Router();

employeesRouter.use(requireAuth);

employeesRouter.get("/", async (req, res, next) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { name: "asc" },
    });
    res.json(employees);
  } catch (err) {
    next(err);
  }
});

employeesRouter.post(
  "/",
  validateBody(createEmployeeSchema),
  async (req, res, next) => {
    try {
      const employee = await prisma.employee.create({
        data: {
          name: req.body.name,
          organizationId: req.auth!.organizationId,
        },
      });
      res.status(201).json(employee);
    } catch (err) {
      next(err);
    }
  },
);

employeesRouter.delete("/:id", async (req, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, organizationId: req.auth!.organizationId },
    });
    if (!employee) {
      throw new HttpError(404, "Employee not found");
    }
    await prisma.employee.delete({ where: { id: employee.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
