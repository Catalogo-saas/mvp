import { NextResponse } from "next/server";
import { z } from "zod";

import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  productIds: z.array(z.string()).min(1).max(500),
  action: z.enum(["show", "hide", "feature", "unfeature"])
});

export async function POST(request: Request) {
  const store = await getMerchantStore();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  const data = result.data.action === "show" ? { isVisible: true } : result.data.action === "hide" ? { isVisible: false } : result.data.action === "feature" ? { isFeatured: true } : { isFeatured: false };
  const updated = await prisma.product.updateMany({ where: { storeId: store.id, id: { in: result.data.productIds } }, data });
  return NextResponse.json({ updated: updated.count });
}
