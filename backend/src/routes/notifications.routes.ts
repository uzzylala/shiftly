import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";
import { toSharedNotification } from "../services/notification.service.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

// The reconciliation backstop from the Phase 4 design note: this is what
// runs on mount and on window focus, independent of whatever SSE did or
// didn't deliver while the tab was away.
notificationsRouter.get("/", async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === "true";
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.auth!.sub,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { seq: "desc" },
      take: 100,
    });
    res.json(notifications.map(toSharedNotification));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/:id/read", async (req, res, next) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.auth!.sub },
    });
    if (!notification) {
      throw new HttpError(404, "Notification not found");
    }
    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt ?? new Date() },
    });
    res.json(toSharedNotification(updated));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/read-all", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.auth!.sub, readAt: null },
      data: { readAt: new Date() },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
