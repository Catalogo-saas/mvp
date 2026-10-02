import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getMerchantApiAccess } from "@/lib/merchant-authorization";
import { prisma } from "@/lib/prisma";
import { canManageStoreUser } from "@/lib/store-permissions";
import { isUniqueConstraintError, storeUserSelect, storeUserSummary, updateStoreUserSchema } from "@/lib/store-team";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const access = await getMerchantApiAccess("users");
  if (access.error) return access.error;
  const { userId } = await params;
  const { context } = access;
  if (!canManageStoreUser(context.user.id, context.store.ownerId, userId)) {
    return NextResponse.json({ error: "No podés modificar al titular ni tu propia cuenta desde esta sección." }, { status: 403 });
  }
  const result = updateStoreUserSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: "Revisá los datos del usuario.", fields: result.error.flatten().fieldErrors }, { status: 400 });
  const { password, role, ...data } = result.data;
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  try {
    const user = await prisma.$transaction(async tx => {
      const member = await tx.storeMember.findFirst({ where: { userId, storeId: context.store.id },
        include: { user: { select: { email: true } } } });
      if (!member) return null;
      const revoke = !!passwordHash || data.status === "SUSPENDED" || (data.email !== undefined && data.email !== member.user.email);
      const updated = await tx.user.update({ where: { id: userId }, data: { ...data,
        ...(passwordHash ? { passwordHash } : {}), ...(revoke ? { authVersion: { increment: 1 } } : {}) }, select: storeUserSelect });
      if (role !== undefined) await tx.storeMember.update({ where: { userId }, data: { role } });
      return storeUserSummary(updated, role ?? member.role);
    });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Ese email ya está en uso.", fields: { email: ["Elegí otro email."] } }, { status: 409 });
    console.error("[store-team] Failed to update user", error);
    return NextResponse.json({ error: "No pudimos guardar los cambios. Intentá nuevamente." }, { status: 500 });
  }
}
