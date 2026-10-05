import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { customerTokenHash } from "@/lib/customer-auth";
import { isMailConfigured, sendCustomerVerification } from "@/lib/order-mail";
import { prisma } from "@/lib/prisma";
import { normalizeCheckoutSettings } from "@/lib/commerce-settings";

const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254), password: z.string().min(8).max(120) });

export async function POST(request: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá nombre, correo y contraseña (mínimo 8 caracteres)." }, { status: 400 });
  const store = await prisma.store.findFirst({ where: { slug: storeSlug, isPublished: true }, include: { owner: { select: { email: true } } } });
  if (!store) return NextResponse.json({ error: "Tienda no encontrada." }, { status: 404 });
  if (normalizeCheckoutSettings(store.checkoutSettings).demoMode) return NextResponse.json({ error: "Esta tienda es una demostración. Podés probar la compra sin registrarte; no se envían correos." }, { status: 403 });
  if (!isMailConfigured()) return NextResponse.json({ error: "El registro no está disponible hasta configurar el correo de la tienda." }, { status: 503 });
  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.customer.findUnique({ where: { storeId_email: { storeId: store.id, email } } });
  if (existing?.emailVerifiedAt) return NextResponse.json({ error: "Ya existe una cuenta con este correo. Iniciá sesión." }, { status: 409 });
  const token = randomBytes(24).toString("base64url");
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.customer.upsert({
    where: { storeId_email: { storeId: store.id, email } },
    create: { storeId: store.id, email, name: parsed.data.name, passwordHash, verificationTokenHash: customerTokenHash(token), verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    update: { name: parsed.data.name, passwordHash, verificationTokenHash: customerTokenHash(token), verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
  });
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const verifyUrl = new URL(`/${encodeURIComponent(storeSlug)}/perfil/verificar?token=${token}`, origin).toString();
  const delivered = await sendCustomerVerification({ email, storeName: store.name, sellerEmail: store.owner.email, verifyUrl });
  if (!delivered) return NextResponse.json({ error: "No se pudo enviar la verificación. Intentá registrarte nuevamente más tarde." }, { status: 502 });
  return NextResponse.json({ ok: true, message: "Revisá tu correo para verificar la cuenta." }, { status: 201 });
}
