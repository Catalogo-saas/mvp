import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publicOrderItemSchema } from "@/lib/checkout-validation";
import { buildCheckoutQuote } from "@/lib/checkout-quote";
import { commerceError } from "@/lib/commerce-transaction";

const requestSchema = z.object({
  storeSlug: z.string().min(2).max(128),
  items: z.array(publicOrderItemSchema.extend({ lineId: z.string().uuid() })).max(80)
    .refine(lines => new Set(lines.map(line => line.lineId)).size === lines.length),
  paymentMethodId: z.string().min(1).max(80).optional(),
  paymentMethod: z.enum(["cash", "transfer", "seller", "custom"]).optional(),
  deliveryMethodId: z.string().min(1).max(80).optional()
}).strict();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_CART", error: "El carrito no es válido." }, { status: 400 });
  try {
    const store = await prisma.store.findFirst({ where: { slug: parsed.data.storeSlug, isPublished: true, owner: { status: "ACTIVE" } } });
    if (!store) return NextResponse.json({ code: "STORE_UNAVAILABLE", error: "La tienda no está disponible." }, { status: 404 });
    const { quote } = await buildCheckoutQuote(prisma, store, parsed.data.items, parsed.data);
    return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = commerceError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
