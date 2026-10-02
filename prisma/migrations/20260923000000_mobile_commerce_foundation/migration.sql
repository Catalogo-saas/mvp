CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'PACKED', 'DELIVERED', 'CANCELLED');

ALTER TABLE "Store"
  ADD COLUMN "faviconUrl" TEXT,
  ADD COLUMN "designConfig" JSONB NOT NULL DEFAULT '{"font":"serif","iconStyle":"regular","headerSticky":true,"logoSize":44,"productImageRatio":"portrait","productImageFit":"cover","cardRadius":0,"showSku":false,"footerText":""}',
  ADD COLUMN "acceptCashPayments" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappOrdersEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "checkoutSettings" JSONB NOT NULL DEFAULT '{"requirePhone":true,"requireDni":false,"requireBilling":false,"allowNotes":true,"minimumAmount":null,"showFreeShippingProgress":false,"showLowStock":false}',
  ADD COLUMN "deliveryMethods" JSONB NOT NULL DEFAULT '[{"id":"default","name":"A convenir","description":"Coordiná la entrega con el vendedor","price":null,"enabled":true}]',
  ADD COLUMN "designDraft" JSONB,
  ADD COLUMN "menuConfig" JSONB NOT NULL DEFAULT '{"header":[{"label":"Inicio","href":"/"},{"label":"Productos","href":"/#catalogo"},{"label":"Contacto","href":"/contacto"},{"label":"Categorías","href":"/categorias"}],"footer":[]}',
  ADD COLUMN "taxRatePercent" INTEGER NOT NULL DEFAULT 21,
  ADD COLUMN "showPricesWithoutTax" BOOLEAN NOT NULL DEFAULT false;

-- Existing stores offered cash implicitly; preserve their checkout until each merchant edits it.
UPDATE "Store" SET "acceptCashPayments" = true;
ALTER TABLE "Store" ALTER COLUMN "template" SET DEFAULT 'roma';
UPDATE "Store" SET "template" = CASE WHEN "template" IN ('boutique-soft','beauty-pop') THEN 'vene' WHEN "template" IN ('premium-minimal','baby-natural','baby-atelier','baby-bosque') THEN 'dana' ELSE 'roma' END;
UPDATE "Store" SET "designConfig" = jsonb_set("designConfig", '{font}', to_jsonb(CASE "template" WHEN 'dana' THEN 'sans' WHEN 'vene' THEN 'rounded' ELSE 'serif' END));

ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "_ProductAssignments" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_ProductAssignments_AB_unique" ON "_ProductAssignments"("A", "B");
CREATE INDEX "_ProductAssignments_B_index" ON "_ProductAssignments"("B");
ALTER TABLE "_ProductAssignments" ADD CONSTRAINT "_ProductAssignments_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ProductAssignments" ADD CONSTRAINT "_ProductAssignments_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "_ProductAssignments"("A", "B") SELECT "categoryId", "id" FROM "Product" WHERE "categoryId" IS NOT NULL;

ALTER TABLE "Product"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "freeShipping" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "variants" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "OrderItem" ADD COLUMN "variantKey" TEXT;

ALTER TABLE "Order"
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "trackingTokenHash" TEXT,
  ADD COLUMN "clientRequestId" TEXT,
  ADD COLUMN "stockReserved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "customerEmail" TEXT;
CREATE UNIQUE INDEX "Order_trackingTokenHash_key" ON "Order"("trackingTokenHash");
CREATE UNIQUE INDEX "Order_storeId_clientRequestId_key" ON "Order"("storeId", "clientRequestId");
UPDATE "Order" SET
  "paymentStatus" = CASE WHEN "status" IN ('PAID', 'IN_PREPARATION', 'DELIVERED') THEN 'CONFIRMED'::"PaymentStatus" WHEN "status" = 'CANCELLED' THEN 'CANCELLED'::"PaymentStatus" ELSE 'PENDING'::"PaymentStatus" END,
  "fulfillmentStatus" = CASE WHEN "status" = 'DELIVERED' THEN 'DELIVERED'::"FulfillmentStatus" WHEN "status" = 'IN_PREPARATION' THEN 'PACKED'::"FulfillmentStatus" WHEN "status" = 'CANCELLED' THEN 'CANCELLED'::"FulfillmentStatus" ELSE 'PENDING'::"FulfillmentStatus" END;

CREATE TABLE "OrderEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "emailVerifiedAt" TIMESTAMP(3),
  "verificationTokenHash" TEXT,
  "verificationExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Customer_storeId_email_key" ON "Customer"("storeId", "email");
CREATE UNIQUE INDEX "Customer_verificationTokenHash_key" ON "Customer"("verificationTokenHash");
CREATE TABLE "CustomerSession" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");
CREATE INDEX "CustomerSession_customerId_expiresAt_idx" ON "CustomerSession"("customerId", "expiresAt");
