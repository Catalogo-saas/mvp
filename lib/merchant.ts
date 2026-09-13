import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, status: true }
  });
  return user?.status === "ACTIVE" ? user.id : null;
}

export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, status: true }
  });
  return user?.status === "ACTIVE" ? user : null;
}

export async function getSuperAdminUser() {
  const user = await getAuthenticatedUser();
  return user?.role === "SUPER_ADMIN" ? user : null;
}

export async function getMerchantStore() {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "MERCHANT") {
    return null;
  }

  return prisma.store.findUnique({
    where: { ownerId: user.id }
  });
}
