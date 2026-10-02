import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { hashTrackingToken } from "@/lib/order-tracking";
import { prisma } from "@/lib/prisma";

export function customerCookieName(storeSlug: string) {
  return `customer_session_${storeSlug}`;
}

export function newCustomerToken() {
  return randomBytes(32).toString("base64url");
}

export function customerTokenHash(token: string) {
  return hashTrackingToken(token);
}

export async function getStoreCustomer(storeSlug: string) {
  const raw = (await cookies()).get(customerCookieName(storeSlug))?.value;
  if (!raw || !/^[A-Za-z0-9_-]{40,50}$/.test(raw)) return null;
  const session = await prisma.customerSession.findUnique({
    where: { tokenHash: customerTokenHash(raw) }, include: { customer: { include: { store: { select: { slug: true } } } } }
  });
  if (!session || session.expiresAt < new Date() || !session.customer.emailVerifiedAt || session.customer.store.slug !== storeSlug) return null;
  return session.customer;
}
