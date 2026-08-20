import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function getMerchantStore() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  return prisma.store.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" }
  });
}
