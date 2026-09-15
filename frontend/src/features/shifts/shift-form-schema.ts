import { z } from "zod";

/**
 * Form-level schema. Mirrors @shiftly/shared's createShiftSchema but works
 * with <input type="datetime-local"> values (no timezone/offset) instead of
 * full ISO 8601 strings, converting to ISO at submit time.
 */
export const shiftFormSchema = z
  .object({
    employeeId: z.string().min(1, "Choose an employee"),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    note: z.string().max(500).optional(),
  })
  .refine((data) => new Date(data.startTime) < new Date(data.endTime), {
    message: "Shift start must be before shift end",
    path: ["endTime"],
  });

export type ShiftFormValues = z.infer<typeof shiftFormSchema>;
