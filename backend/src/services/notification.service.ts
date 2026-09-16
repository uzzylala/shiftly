import type { Notification, NotificationType } from "@shiftly/shared";
import type {
  Notification as PrismaNotification,
  Prisma,
} from "../generated/prisma/client.js";
import { pushToUser } from "./sse.service.js";

export function toSharedNotification(row: PrismaNotification): Notification {
  return {
    id: row.id,
    type: row.type as NotificationType,
    message: row.message,
    swapRequestId: row.swapRequestId,
    shiftId: row.shiftId,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

// Writes the Notification row inside the caller's transaction (so it can
// never be sent for a write that gets rolled back), then pushes it over
// SSE once the row exists. The push itself happens after the DB write
// call returns — see routes for why it's issued right after tx.commit,
// not inside the transaction (a push isn't transactional and shouldn't
// block the write waiting on client sockets).
export async function writeNotification(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    type: NotificationType;
    message: string;
    swapRequestId?: string;
    shiftId?: string;
  },
) {
  return tx.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      message: params.message,
      swapRequestId: params.swapRequestId ?? null,
      shiftId: params.shiftId ?? null,
    },
  });
}

export function pushNotification(row: PrismaNotification) {
  // Fire-and-forget: the notification row is already durably written, so a
  // transient publish failure just means the live push is missed — the
  // client's replay-on-reconnect (see events.routes.ts) still delivers it.
  pushToUser(row.userId, {
    seq: row.seq,
    type: "notification",
    data: { notification: toSharedNotification(row) },
  }).catch((err) => {
    console.error("Failed to publish notification push", err);
  });
}
