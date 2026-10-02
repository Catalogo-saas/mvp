import { z } from "zod";
import { variantCombinationSchema } from "@/lib/product-variants";

export const quickProductSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  basePrice: z.number().int().min(0).max(999999999).optional(),
  promoPrice: z.number().int().min(1).max(999999999).nullable().optional(),
  stockQuantity: z.number().int().min(0).max(999999).nullable().optional(),
  isVisible: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  variants: z.array(variantCombinationSchema).max(100).optional()
}).strict();

export function validateQuickPrices(product: { basePrice: number; promoPrice: number | null; variants: Array<{ basePrice: number | null; promoPrice: number | null }> }) {
  if (product.promoPrice !== null && product.promoPrice >= product.basePrice) throw new Error("La oferta debe ser menor que el precio.");
  for (const variant of product.variants) if (variant.promoPrice !== null && variant.promoPrice >= (variant.basePrice ?? product.basePrice)) throw new Error("Revisá la oferta de las variantes.");
}
