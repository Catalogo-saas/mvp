import { NextResponse } from "next/server";

import { customerCookieName, customerTokenHash } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const raw = request.headers.get("cookie")?.split("; ").find((item) => item.startsWith(`${customerCookieName(storeSlug)}=`))?.split("=")[1];
  if (raw) await prisma.customerSession.deleteMany({ where: { tokenHash: customerTokenHash(raw), customer: { store: { slug: storeSlug } } } });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(customerCookieName(storeSlug), "", { path: "/", maxAge: 0 });
  return response;
}
