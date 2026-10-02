import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "./prisma";
import { CheckoutError } from "./checkout-validation";

export async function lockStore(tx: Prisma.TransactionClient, storeId: string) {
  await tx.$queryRaw`SELECT id FROM "Store" WHERE id = ${storeId} FOR SHARE`;
}
export async function lockProducts(tx: Prisma.TransactionClient, storeId: string, productIds: Array<string | null>) {
  // Acquire all product locks before touching inventory, independent of cart line order.
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))].sort();
  if (!ids.length) return;
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE "storeId" = ${storeId} AND id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
}

function transient(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  if (["P2034", "40P01", "40001"].includes(String(record.code)) || [record.sqlState, record.originalCode].some(value => ["40P01", "40001"].includes(String(value)))) return true;
  return [record.cause, record.meta, record.driverAdapterError].some(transient);
}

export async function commerceTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await prisma.$transaction(callback, { maxWait: 10000, timeout: 15000 }); }
    catch (error) { if (!transient(error) || attempt === 2) throw error; }
  }
  throw new Error("Unreachable transaction state");
}

export function commerceError(error: unknown) {
  if (error instanceof CheckoutError) return { status: error.status, body: { code: error.code, error: error.message } };
  console.error("[commerce] Transaction failed", error);
  return { status: 503, body: { code: "COMMERCE_UNAVAILABLE", error: "No pudimos completar la operación. Intentá nuevamente." } };
}
