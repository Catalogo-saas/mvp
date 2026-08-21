-- Store settings: payments, schedule restriction and mobile product layout.
ALTER TABLE "Store"
  ADD COLUMN "paymentAccountHolder" TEXT,
  ADD COLUMN "paymentProvider" TEXT,
  ADD COLUMN "paymentAlias" TEXT,
  ADD COLUMN "paymentCbu" TEXT,
  ADD COLUMN "restrictBySchedule" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "businessHours" JSONB NOT NULL DEFAULT '{"timezone":"America/Argentina/Buenos_Aires","days":{"monday":[],"tuesday":[],"wednesday":[],"thursday":[],"friday":[],"saturday":[],"sunday":[]}}',
  ADD COLUMN "mobileProductColumns" INTEGER NOT NULL DEFAULT 1;

-- Order statuses: replace CONFIRMED with PAID and add DELIVERED.
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING_WHATSAPP', 'PAID', 'DELIVERED', 'CANCELLED');

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus_new"
  USING (
    CASE
      WHEN "status"::text = 'CONFIRMED' THEN 'PAID'
      ELSE "status"::text
    END
  )::"OrderStatus_new";

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";

ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING_WHATSAPP';
