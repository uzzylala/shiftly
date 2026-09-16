import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { employeesRouter } from "./routes/employees.routes.js";
import { shiftsRouter } from "./routes/shifts.routes.js";
import { availabilityRouter } from "./routes/availability.routes.js";
import { auditLogRouter } from "./routes/audit-log.routes.js";
import { swapRequestsRouter } from "./routes/swap-requests.routes.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { eventsRouter } from "./routes/events.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/shifts", shiftsRouter);
  app.use("/api/availability", availabilityRouter);
  app.use("/api/audit-log", auditLogRouter);
  app.use("/api/swap-requests", swapRequestsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/events", eventsRouter);

  app.use(errorHandler);

  return app;
}
