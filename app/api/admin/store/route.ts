import { NextResponse } from "next/server";
import { z } from "zod";

import { BusinessType } from "@/lib/generated/prisma/enums";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2).max(90),
  description: z.string().max(500).optional(),
  whatsappPhone: z.string().min(8).max(30),
  businessType: z.nativeEnum(BusinessType),
  logoUrl: z.string().url().optional().or(z.literal("")),
  heroTitle: z.string().max(120).optional(),
  heroSubtitle: z.string().max(220).optional(),
  address: z.string().max(180).optional(),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

export async function PATCH(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: {
      name: result.data.name,
      description: result.data.description,
      whatsappPhone: result.data.whatsappPhone,
      businessType: result.data.businessType,
      logoUrl: result.data.logoUrl || null,
      heroTitle: result.data.heroTitle,
      heroSubtitle: result.data.heroSubtitle,
      address: result.data.address,
      theme: {
        primary: result.data.primary,
        accent: result.data.accent,
        font: "Inter"
      }
    }
  });

  return NextResponse.json({ store: updated });
}
