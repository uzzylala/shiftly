import { Router } from "express";
import bcrypt from "bcryptjs";
import { createEmployeeSchema, updateEmployeeSchema } from "@shiftly/shared";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/errorHandler.js";

export const employeesRouter = Router();

employeesRouter.use(requireAuth);

function toEmployeeResponse(employee: {
  id: string;
  organizationId: string;
  name: string;
  userId: string | null;
  createdAt: Date;
}) {
  return {
    id: employee.id,
    organizationId: employee.organizationId,
    name: employee.name,
    hasLogin: employee.userId !== null,
    createdAt: employee.createdAt,
  };
}

employeesRouter.get(
  "/",
  requirePermission("employee:view"),
  async (req, res, next) => {
    try {
      const employees = await prisma.employee.findMany({
        where: { organizationId: req.auth!.organizationId },
        orderBy: { name: "asc" },
      });
      res.json(employees.map(toEmployeeResponse));
    } catch (err) {
      next(err);
    }
  },
);

employeesRouter.post(
  "/",
  requirePermission("employee:manage"),
  validateBody(createEmployeeSchema),
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body as {
        name: string;
        email?: string;
        password?: string;
      };

      if (email) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          throw new HttpError(422, "A login with that email already exists");
        }
      }

      const employee = await prisma.$transaction(async (tx) => {
        const user = email
          ? await tx.user.create({
              data: {
                email,
                passwordHash: await bcrypt.hash(password!, 10),
                name,
                role: "employee",
                organizationId: req.auth!.organizationId,
              },
            })
          : null;

        return tx.employee.create({
          data: {
            name,
            organizationId: req.auth!.organizationId,
            userId: user?.id,
          },
        });
      });

      res.status(201).json(toEmployeeResponse(employee));
    } catch (err) {
      next(err);
    }
  },
);

employeesRouter.patch(
  "/:id",
  requirePermission("employee:manage"),
  validateBody(updateEmployeeSchema),
  async (req, res, next) => {
    try {
      const employee = await prisma.employee.findFirst({
        where: { id: req.params.id, organizationId: req.auth!.organizationId },
      });
      if (!employee) {
        throw new HttpError(404, "Employee not found");
      }

      const { name, email, password } = req.body as {
        name?: string;
        email?: string;
        password?: string;
      };

      const updated = await prisma.$transaction(async (tx) => {
        if (email) {
          const existing = await tx.user.findUnique({ where: { email } });
          if (existing && existing.id !== employee.userId) {
            throw new HttpError(422, "A login with that email already exists");
          }

          if (employee.userId) {
            await tx.user.update({
              where: { id: employee.userId },
              data: {
                email,
                passwordHash: await bcrypt.hash(password!, 10),
                ...(name ? { name } : {}),
              },
            });
          } else {
            const user = await tx.user.create({
              data: {
                email,
                passwordHash: await bcrypt.hash(password!, 10),
                name: name ?? employee.name,
                role: "employee",
                organizationId: req.auth!.organizationId,
              },
            });
            await tx.employee.update({
              where: { id: employee.id },
              data: { userId: user.id },
            });
          }
        }

        return tx.employee.update({
          where: { id: employee.id },
          data: {
            ...(name ? { name } : {}),
          },
        });
      });

      res.json(toEmployeeResponse(updated));
    } catch (err) {
      next(err);
    }
  },
);

employeesRouter.delete(
  "/:id",
  requirePermission("employee:manage"),
  async (req, res, next) => {
    try {
      const employee = await prisma.employee.findFirst({
        where: { id: req.params.id, organizationId: req.auth!.organizationId },
      });
      if (!employee) {
        throw new HttpError(404, "Employee not found");
      }
      // Removing the roster entry also revokes its login, if any — a
      // former employee shouldn't keep an active session into the org.
      await prisma.$transaction(async (tx) => {
        await tx.employee.delete({ where: { id: employee.id } });
        if (employee.userId) {
          await tx.user.delete({ where: { id: employee.userId } });
        }
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
