-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('requested', 'accepted_by_coworker', 'declined_by_coworker', 'cancelled', 'rejected_by_manager', 'approved_by_manager', 'finalized', 'finalize_failed');

-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shiftId" TEXT,
    "requesterId" TEXT NOT NULL,
    "coworkerId" TEXT NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "swapRequestId" TEXT,
    "shiftId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SwapRequest_organizationId_status_idx" ON "SwapRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SwapRequest_requesterId_idx" ON "SwapRequest"("requesterId");

-- CreateIndex
CREATE INDEX "SwapRequest_coworkerId_idx" ON "SwapRequest"("coworkerId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_seq_key" ON "Notification"("seq");

-- CreateIndex
CREATE INDEX "Notification_userId_seq_idx" ON "Notification"("userId", "seq");

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_coworkerId_fkey" FOREIGN KEY ("coworkerId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

