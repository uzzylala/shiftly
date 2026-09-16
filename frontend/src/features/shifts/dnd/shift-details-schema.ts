import { z } from "zod";

// Location/status/note only — day, time, and employee come from wherever
// the shift was dropped or picked in the command palette, not from this form.
export const shiftDetailsSchema = z.object({
  durationMinutes: z.coerce.number().int().min(30).max(12 * 60),
  location: z.string().trim().min(1, "Location is required").max(200),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  note: z.string().max(500).optional(),
});

export type ShiftDetailsValues = z.infer<typeof shiftDetailsSchema>;

export const DURATION_OPTIONS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 480, label: "8 hours" },
  { minutes: 600, label: "10 hours" },
  { minutes: 720, label: "12 hours" },
];
