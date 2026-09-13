ALTER TABLE "Store"
  ADD COLUMN "heroImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "showCategories" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "freeShippingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "freeShippingThreshold" INTEGER NOT NULL DEFAULT 35000,
  ADD COLUMN "acceptTransferPayments" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "businessHoursText" TEXT;

ALTER TABLE "Category"
  ADD COLUMN "imageUrl" TEXT;
