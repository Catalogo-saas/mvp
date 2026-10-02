import { NextResponse } from "next/server";
import { z } from "zod";

import { customerTokenHash } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const parsed = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{30,60}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enlace inválido." }, { status: 400 });
  const customer = await prisma.customer.findFirst({ where: { verificationTokenHash: customerTokenHash(parsed.data.token), verificationExpiresAt: { gt: new Date() }, store: { slug: storeSlug } } });
  if (!customer) return NextResponse.json({ error: "El enlace caducó o no es válido." }, { status: 400 });
  await prisma.customer.update({ where: { id: customer.id }, data: { emailVerifiedAt: new Date(), verificationTokenHash: null, verificationExpiresAt: null } });
  return NextResponse.json({ ok: true });
}
