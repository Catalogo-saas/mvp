ALTER TABLE "Order" ADD COLUMN "readAt" TIMESTAMP(3);
CREATE INDEX "Order_storeId_readAt_idx" ON "Order"("storeId", "readAt");
