import type { AuditAction, Shift } from "@shiftly/shared";
import type { Prisma } from "../generated/prisma/client.js";

export async function recordShiftAudit(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    shiftId: string;
    actorUserId: string;
    actorName: string;
    action: AuditAction;
    before: Shift | null;
    after: Shift | null;
  },
) {
  await tx.auditLog.create({
    data: {
      organizationId: params.organizationId,
      shiftId: params.shiftId,
      actorUserId: params.actorUserId,
      actorName: params.actorName,
      action: params.action,
      before:
        (params.before as unknown as Prisma.InputJsonValue | undefined) ??
        undefined,
      after:
        (params.after as unknown as Prisma.InputJsonValue | undefined) ??
        undefined,
    },
  });
}
