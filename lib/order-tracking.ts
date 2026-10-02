import { createHash, createHmac } from "node:crypto";

export function createTrackingToken(orderId: string, storeId: string) {
  const secret = process.env.TRACKING_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 24) throw new Error("Configurá TRACKING_TOKEN_SECRET para habilitar seguimiento de pedidos.");
  return createHmac("sha256", secret).update(`${storeId}:${orderId}`).digest("base64url");
}

export function hashTrackingToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function trackingPath(storeSlug: string, token: string) {
  return `/${encodeURIComponent(storeSlug)}/compra/proceso/orden?hash=${encodeURIComponent(token)}`;
}

export function absoluteTrackingUrl(origin: string, storeSlug: string, token: string) {
  return new URL(trackingPath(storeSlug, token), origin).toString();
}
