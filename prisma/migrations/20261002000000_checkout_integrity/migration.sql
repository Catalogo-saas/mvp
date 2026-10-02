-- No automatic repairs: refuse the migration if historical data violates invariants.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Product" WHERE "stockQuantity" < 0 OR "basePrice" < 0 OR "promoPrice" < 0)
    OR EXISTS (SELECT 1 FROM "Order" WHERE "total" < 0)
    OR EXISTS (SELECT 1 FROM "OrderItem" WHERE "quantity" < 1 OR "unitPrice" < 0 OR "subtotal" < 0)
  THEN RAISE EXCEPTION 'Checkout integrity preflight failed. Inspect inventory and order amounts before migrating; no records were repaired.';
  END IF;
END $$;

ALTER TABLE "Order" ADD COLUMN "requestFingerprint" TEXT;
ALTER TABLE "Product" ADD CONSTRAINT "Product_nonnegative_stock_prices" CHECK ("stockQuantity" >= 0 AND "basePrice" >= 0 AND "promoPrice" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_nonnegative_total" CHECK ("total" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_valid_quantity_amounts" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "subtotal" >= 0);
