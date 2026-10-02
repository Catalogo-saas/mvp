import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getSuperAdminUser } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { reservedSlugs, slugify } from "@/lib/slug";
import { deletePublicObject, getPublicObjectKeyFromUrl } from "@/lib/storage";
import { normalizeArgentineWhatsAppPhone } from "@/lib/store-settings";
import { getTenantSummary, updateTenantSchema } from "@/lib/tenant-admin";
import { templateOriginalColors } from "@/lib/catalog";
import { normalizePaymentMethods } from "@/lib/commerce-settings";

type Params = Promise<{ tenantId: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  if (!(await getSuperAdminUser())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { tenantId } = await params;
  const existing = await prisma.store.findFirst({
    where: { id: tenantId, owner: { role: "MERCHANT" } },
    include: { owner: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const result = updateTenantSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Revisá los datos obligatorios." }, { status: 400 });
  }
  const slug = slugify(result.data.slug);
  if (!slug || reservedSlugs.has(slug)) {
    return NextResponse.json({ error: "La URL elegida no está disponible." }, { status: 400 });
  }
  if (result.data.isPublished && !existing.whatsappOrdersEnabled && !normalizePaymentMethods(existing).some(method => method.enabled)) {
    return NextResponse.json({ error: "El vendedor debe activar al menos un método de pago antes de publicar." }, { status: 400 });
  }

  try {
    const passwordHash = result.data.password ? await bcrypt.hash(result.data.password, 10) : null;
    const templateChanged = existing.template !== result.data.template;
    const currentTheme = existing.theme && typeof existing.theme === "object" && !Array.isArray(existing.theme)
      ? existing.theme as Record<string, unknown>
      : {};
    const originalColors = templateOriginalColors[result.data.template];
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.ownerId },
        data: {
          name: result.data.ownerName,
          email: result.data.email.toLowerCase(),
          status: result.data.status,
          ...((passwordHash || result.data.status === "SUSPENDED" || existing.owner.email !== result.data.email.toLowerCase()) ? { authVersion: { increment: 1 } } : {}),
          ...(passwordHash ? { passwordHash } : {})
        }
      }),
      prisma.store.update({
        where: { id: existing.id },
        data: {
          name: result.data.storeName,
          slug,
          whatsappPhone: normalizeArgentineWhatsAppPhone(result.data.whatsappPhone),
          businessType: result.data.businessType,
          template: result.data.template,
          ...(templateChanged && originalColors ? { theme: { ...currentTheme, useTemplateColors: true } } : {}),
          isPublished: result.data.isPublished
        }
      })
    ]);
    return NextResponse.json({ tenant: await getTenantSummary(existing.id) });
  } catch {
    return NextResponse.json({ error: "El email o la URL ya están en uso." }, { status: 409 });
  }
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  if (!(await getSuperAdminUser())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { tenantId } = await params;
  const existing = await prisma.store.findFirst({
    where: { id: tenantId, owner: { role: "MERCHANT" } },
    include: {
      owner: true,
      categories: { select: { imageUrl: true } },
      products: { select: { imageUrls: true } }
    }
  });
  if (!existing) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (body?.confirmation !== existing.slug) {
    return NextResponse.json({ error: `Escribí ${existing.slug} para confirmar.` }, { status: 400 });
  }

  const urls = [
    existing.logoUrl,
    ...existing.heroImageUrls,
    ...existing.categories.map((category) => category.imageUrl),
    ...existing.products.flatMap((product) => product.imageUrls)
  ].filter((url): url is string => Boolean(url));
  const keys = Array.from(new Set(urls.map(getPublicObjectKeyFromUrl).filter((key): key is string => Boolean(key))));

  await prisma.user.delete({ where: { id: existing.ownerId } });
  const cleanup = await Promise.allSettled(keys.map((key) => deletePublicObject(key)));
  const cleanupWarnings = cleanup.filter((result) => result.status === "rejected").length;
  return NextResponse.json({ ok: true, cleanupWarnings });
}
