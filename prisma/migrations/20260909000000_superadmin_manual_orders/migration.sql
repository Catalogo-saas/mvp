CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'MERCHANT');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "OrderSource" AS ENUM ('STOREFRONT', 'BACKOFFICE');

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MERCHANT',
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Order"
  ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'STOREFRONT';

UPDATE "Store" SET "template" = 'food' WHERE "template" = 'quick-menu';
UPDATE "Store" SET "template" = 'ecommerce' WHERE "template" = 'market';
ALTER TABLE "Store" ALTER COLUMN "template" SET DEFAULT 'ecommerce';

CREATE UNIQUE INDEX "Store_ownerId_key" ON "Store"("ownerId");
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");
