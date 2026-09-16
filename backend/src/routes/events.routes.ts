import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  consumeTicket,
  issueTicket,
  registerConnection,
} from "../services/sse.service.js";
import { toSharedNotification } from "../services/notification.service.js";

export const eventsRouter = Router();

// Authenticated normally (Bearer header) — mints a short-lived, single-use
// ticket for the one request EventSource itself can't attach a header to.
eventsRouter.post("/ticket", requireAuth, async (req, res) => {
  res.json({ ticket: await issueTicket(req.auth!.sub) });
});

// Serverless functions get killed at their platform's max execution
// duration regardless of what the client wants — ending the stream a little
// early, on our own terms, means the client sees a clean close and
// reconnects with a fresh ticket instead of an abrupt mid-write cutoff.
const STREAM_LIFETIME_MS = 50_000;

// EventSource can only ever send a plain GET with no custom headers on the
// initial connect, so this route is deliberately outside requireAuth and
// authenticates via the one-time ticket instead.
eventsRouter.get("/stream", async (req, res) => {
  const ticket = req.query.ticket as string | undefined;
  const userId = ticket ? await consumeTicket(ticket) : null;
  if (!userId) {
    res.status(401).json({ message: "Invalid or expired stream ticket" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 2000\n\n");

  // A single-use ticket means the client can't rely on EventSource's own
  // silent reconnect (it would just replay the already-consumed ticket) —
  // reconnection is managed client-side with a fresh ticket each time, so
  // the replay cursor travels as a query param it controls, not only the
  // browser-managed Last-Event-ID header (kept as a fallback for the rare
  // case the browser does reconnect the same instance after a blip).
  const lastEventId =
    (req.headers["last-event-id"] as string | undefined) ??
    (req.query.lastEventId as string | undefined);
  if (lastEventId && !Number.isNaN(Number(lastEventId))) {
    const missed = await prisma.notification.findMany({
      where: { userId, seq: { gt: Number(lastEventId) } },
      orderBy: { seq: "asc" },
    });
    for (const row of missed) {
      res.write(
        `id: ${row.seq}\nevent: notification\ndata: ${JSON.stringify({ notification: toSharedNotification(row) })}\n\n`,
      );
    }
  }

  const unregister = await registerConnection(userId, res);
  const closeTimer = setTimeout(() => res.end(), STREAM_LIFETIME_MS);
  req.on("close", () => {
    clearTimeout(closeTimer);
    void unregister();
  });
});
