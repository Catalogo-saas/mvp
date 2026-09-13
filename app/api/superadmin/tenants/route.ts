import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getSuperAdminUser } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { reservedSlugs, slugify } from "@/lib/slug";
import { normalizeArgentineWhatsAppPhone } from "@/lib/store-settings";
import { createTenantSchema, getTenantSummaries } from "@/lib/tenant-admin";
import { isBabyTemplate, templateOriginalColors } from "@/lib/catalog";

export async function GET() {
  if (!(await getSuperAdminUser())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return NextResponse.json({ tenants: await getTenantSummaries() });
}

export async function POST(request: Request) {
  if (!(await getSuperAdminUser())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const result = createTenantSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Revisá los datos obligatorios." }, { status: 400 });
  }

  const slug = slugify(result.data.slug);
  if (!slug || reservedSlugs.has(slug)) {
    return NextResponse.json({ error: "La URL elegida no está disponible." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(result.data.password, 10);
  try {
    const store = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          name: result.data.ownerName,
          email: result.data.email.toLowerCase(),
          passwordHash,
          role: "MERCHANT",
          status: result.data.status
        }
      });
      const originalColors = isBabyTemplate(result.data.template) ? templateOriginalColors[result.data.template] : null;
      return tx.store.create({
        data: {
          ownerId: owner.id,
          name: result.data.storeName,
          slug,
          whatsappPhone: normalizeArgentineWhatsAppPhone(result.data.whatsappPhone),
          businessType: result.data.businessType,
          template: result.data.template,
          ...(originalColors ? { theme: { ...originalColors, font: "Inter", useTemplateColors: true } } : {}),
          isPublished: result.data.isPublished,
          heroTitle: result.data.storeName,
          heroSubtitle: "Catálogo online con pedidos por WhatsApp",
          categories: { create: { name: "Destacados", slug: "destacados" } }
        }
      });
    });
    const tenant = (await getTenantSummaries()).find((item) => item.id === store.id);
    return NextResponse.json({ tenant }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "El email o la URL ya están en uso." }, { status: 409 });
  }
}
