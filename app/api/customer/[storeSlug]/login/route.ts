import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { customerCookieName, customerTokenHash, newCustomerToken } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Credenciales inválidas." }, { status: 400 });
  const customer = await prisma.customer.findFirst({ where: { email: parsed.data.email.toLowerCase(), store: { slug: storeSlug } } });
  if (!customer || !await bcrypt.compare(parsed.data.password, customer.passwordHash)) return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  if (!customer.emailVerifiedAt) return NextResponse.json({ error: "Verificá tu correo antes de ingresar." }, { status: 403 });
  const token = newCustomerToken();
  await prisma.customerSession.create({ data: { customerId: customer.id, tokenHash: customerTokenHash(token), expiresAt: new Date(Date.now() + 30 * 86400000) } });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(customerCookieName(storeSlug), token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  return response;
}
