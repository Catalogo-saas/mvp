import { getServerSession } from "next-auth";
import { cache } from "react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { StoreRole } from "@/lib/store-permissions";

export async function getCurrentUserId() {
  return (await getAuthenticatedUser())?.id ?? null;
}

export const getAuthenticatedUser = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, status: true, authVersion: true }
  });
  return user?.status === "ACTIVE" && user.authVersion === (session.user.authVersion ?? 0) ? user : null;
});

export async function getSuperAdminUser() {
  const user = await getAuthenticatedUser();
  return user?.role === "SUPER_ADMIN" ? user : null;
}

export const getMerchantContext = cache(async () => {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "MERCHANT") {
    return null;
  }

  const store = await prisma.store.findFirst({
    where: {
      owner: { role: "MERCHANT", status: "ACTIVE" },
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }]
    },
    include: { members: { where: { userId: user.id }, select: { role: true } } }
  });
  if (!store) return null;
  const { members, ...record } = store;
  const role: StoreRole = record.ownerId === user.id ? "OWNER" : members[0].role;
  return { user, store: record, role };
});

export async function getMerchantStore() {
  return (await getMerchantContext())?.store ?? null;
}
