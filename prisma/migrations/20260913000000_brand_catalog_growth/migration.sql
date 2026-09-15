ALTER TABLE "Store"
ADD COLUMN "publicPageConfig" JSONB NOT NULL DEFAULT '{"version":2,"sections":["featured","categories","catalog","info"],"announcement":{"enabled":false,"text":""},"info":{"enabled":false,"shipping":"","returns":"","sizeGuide":""},"socials":{"instagram":"","tiktok":"","facebook":""},"featuredTitle":"Elegidos para vos","categoriesTitle":""}';

ALTER TABLE "Product"
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "StorefrontEvent" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "productId" TEXT,
  "type" TEXT NOT NULL,
  "sessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorefrontEvent_storeId_type_createdAt_idx" ON "StorefrontEvent"("storeId", "type", "createdAt");
CREATE INDEX "StorefrontEvent_storeId_productId_createdAt_idx" ON "StorefrontEvent"("storeId", "productId", "createdAt");

ALTER TABLE "StorefrontEvent" ADD CONSTRAINT "StorefrontEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorefrontEvent" ADD CONSTRAINT "StorefrontEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
