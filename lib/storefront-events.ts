import { z } from "zod";

export const storefrontEventTypes = [
  "STOREFRONT_VIEW",
  "PRODUCT_VIEW",
  "ADD_TO_CART",
  "CHECKOUT_STARTED",
  "WHATSAPP_HANDOFF"
] as const;

export type StorefrontEventType = (typeof storefrontEventTypes)[number];

export const storefrontEventSchema = z.object({
  storeSlug: z.string().trim().min(1).max(64),
  productId: z.string().trim().max(64).optional().nullable(),
  type: z.enum(storefrontEventTypes),
  sessionId: z.string().trim().min(8).max(80).optional().nullable()
});
