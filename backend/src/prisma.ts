import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { env } from "./config/env.js";

// Serverless functions reuse a warm instance's module scope across
// invocations, but re-evaluate the module from scratch on a cold start —
// caching on globalThis (rather than a plain module-level const) means a
// warm invocation reuses the existing connection pool instead of opening a
// fresh one every time this module happens to get re-imported.
const globalForPrisma = globalThis as unknown as { shiftlyPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.shiftlyPrisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: env.databaseUrl }) });

globalForPrisma.shiftlyPrisma = prisma;
