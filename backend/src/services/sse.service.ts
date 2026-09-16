import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * Serverless-safe replacement for an in-memory connection registry: a push
 * (e.g. a manager approving a swap) can land on a different instance than
 * the one holding the target user's open SSE connection, so both the
 * ticket store and the push itself go through Redis instead of a local Map.
 *
 * One shared client handles ordinary request/response commands (ticket
 * issue/consume, publish). Redis subscriptions occupy a connection for as
 * long as they're active, so each SSE stream gets its own dedicated
 * connection via `.duplicate()` rather than sharing this one.
 */
const globalForRedis = globalThis as unknown as { shiftlyRedis?: Redis };

const redis = globalForRedis.shiftlyRedis ?? new Redis(env.redisUrl);
globalForRedis.shiftlyRedis = redis;

const HEARTBEAT_MS = 25_000;

function channelFor(userId: string): string {
  return `shiftly:notify:${userId}`;
}

export async function registerConnection(
  userId: string,
  res: Response,
): Promise<() => Promise<void>> {
  const subscriber = redis.duplicate();
  await subscriber.subscribe(channelFor(userId));
  subscriber.on("message", (_channel: string, payload: string) => {
    res.write(payload);
  });

  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, HEARTBEAT_MS);

  return async () => {
    clearInterval(heartbeat);
    await subscriber.unsubscribe();
    subscriber.disconnect();
  };
}

export async function pushToUser(
  userId: string,
  event: { seq: number; type: string; data: unknown },
) {
  const payload = `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  // Fire-and-forget by design: a push with no subscriber currently connected
  // is simply lost, same as the old in-memory version. That's fine — the
  // notification itself is already durably written to Postgres, and a
  // reconnecting client replays anything it missed via `lastEventId`.
  await redis.publish(channelFor(userId), payload);
}

// Short-lived, single-use tickets for opening the SSE stream. EventSource
// can't send an Authorization header, so the client mints one of these
// through a normally-authenticated call and puts it in the stream URL
// instead of the real access token — a leaked ticket is worthless a minute
// later, a leaked access token is not.
const TICKET_TTL_MS = 60_000;

export async function issueTicket(userId: string): Promise<string> {
  const ticket = randomUUID();
  await redis.set(`shiftly:ticket:${ticket}`, userId, "PX", TICKET_TTL_MS);
  return ticket;
}

export async function consumeTicket(ticket: string): Promise<string | null> {
  // Atomic read-and-delete — the ticket is single-use regardless of outcome,
  // so a duplicate/replayed request can never succeed even if it arrives
  // concurrently with the legitimate one.
  const userId = await redis.getdel(`shiftly:ticket:${ticket}`);
  return userId ?? null;
}
