import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getMerchantApiAccess } from "@/lib/merchant-authorization";
import { prisma } from "@/lib/prisma";
import { createStoreUserSchema, isUniqueConstraintError, listStoreUsers, storeUserSelect, storeUserSummary } from "@/lib/store-team";

export async function GET(request: Request) {
  const access = await getMerchantApiAccess("users");
  if (access.error) return access.error;
  return NextResponse.json(await listStoreUsers(access.context, new URL(request.url).searchParams));
}

export async function POST(request: Request) {
  const access = await getMerchantApiAccess("users");
  if (access.error) return access.error;
  const result = createStoreUserSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: "Revisá el nombre, email y contraseña.", fields: result.error.flatten().fieldErrors }, { status: 400 });
  const { password, role, ...data } = result.data;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    // Nested creation keeps the account and membership in one transaction.
    const user = await prisma.user.create({ data: { ...data, passwordHash, role: "MERCHANT", status: "ACTIVE",
      membership: { create: { storeId: access.context.store.id, role } } }, select: storeUserSelect });
    return NextResponse.json({ user: storeUserSummary(user, role) }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Ese email ya está en uso.", fields: { email: ["Elegí otro email."] } }, { status: 409 });
    console.error("[store-team] Failed to create user", error);
    return NextResponse.json({ error: "No pudimos crear el usuario. Intentá nuevamente." }, { status: 500 });
  }
}
