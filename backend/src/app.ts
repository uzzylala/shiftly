import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { employeesRouter } from "./routes/employees.routes.js";
import { shiftsRouter } from "./routes/shifts.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/shifts", shiftsRouter);

  app.use(errorHandler);

  return app;
}
