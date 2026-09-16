import { z } from "zod";

/**
 * Zod schemas shared by the frontend (React Hook Form resolvers, for instant
 * feedback) and the backend (request body validation, the source of truth).
 * Structural validation only here. Business-rule validation (double-booking,
 * availability conflicts) lives in conflicts.ts since it needs data beyond
 * the request body (the employee's other shifts and submitted availability).
 */

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const createSwapRequestSchema = z.object({
  shiftId: z.string().uuid(),
  coworkerId: z.string().uuid(),
});

// email/password are optional, but must arrive together — a manager either
// grants a login in the same step as adding the employee, or doesn't.
const employeeLoginFields = {
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
};

export const createEmployeeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    ...employeeLoginFields,
  })
  .refine((data) => Boolean(data.email) === Boolean(data.password), {
    message: "Email and password must be set together",
    path: ["password"],
  });

export const updateEmployeeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120).optional(),
    ...employeeLoginFields,
  })
  .refine((data) => Boolean(data.email) === Boolean(data.password), {
    message: "Email and password must be set together",
    path: ["password"],
  });

export const dayOfWeekSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm");

export const createAvailabilityWindowSchema = z
  .object({
    dayOfWeek: dayOfWeekSchema,
    startTime: timeStringSchema,
    endTime: timeStringSchema,
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "Start must be before end",
    path: ["endTime"],
  });

export const shiftStatusSchema = z.enum([
  "scheduled",
  "completed",
  "cancelled",
]);

export const createShiftSchema = z
  .object({
    employeeId: z.string().uuid(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    location: z.string().trim().min(1, "Location is required").max(200),
    status: shiftStatusSchema.default("scheduled"),
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
    location: z.string().trim().min(1, "Location is required").max(200).optional(),
    status: shiftStatusSchema.optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) =>
      !data.startTime ||
      !data.endTime ||
      new Date(data.startTime) < new Date(data.endTime),
    { message: "Shift start must be before shift end", path: ["endTime"] },
  );
