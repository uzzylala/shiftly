import { z } from "zod";

/**
 * Zod schemas shared by the frontend (React Hook Form resolvers, for instant
 * feedback) and the backend (request body validation, the source of truth).
 * Structural validation only here — business-rule validation (double-booking,
 * availability conflicts, max-hours) is introduced in the RBAC/conflict
 * detection phase.
 */

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});

export const createShiftSchema = z
  .object({
    employeeId: z.string().uuid(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => new Date(data.startTime) < new Date(data.endTime), {
    message: "Shift start must be before shift end",
    path: ["endTime"],
  });

export const updateShiftSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) =>
      !data.startTime ||
      !data.endTime ||
      new Date(data.startTime) < new Date(data.endTime),
    { message: "Shift start must be before shift end", path: ["endTime"] },
  );
