-- AlterTable
ALTER TABLE "PriceAlert" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "lastNotifiedAmount" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "PriceAlert_tripId_key" ON "PriceAlert"("tripId");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_idx" ON "PriceAlert"("userId");

-- CreateIndex
CREATE INDEX "PriceAlert_active_idx" ON "PriceAlert"("active");

