import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ returnTo?: string }>;

function safeReturnTo(value: string | undefined, role: "SUPER_ADMIN" | "MERCHANT") {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  if (role === "SUPER_ADMIN" && value.startsWith("/superadmin")) {
    return value;
  }
  if (role === "MERCHANT" && value.startsWith("/gestion")) {
    return value;
  }
  return null;
}

export default async function PanelRouterPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, status: true }
  });
  if (!user || user.status !== "ACTIVE") {
    redirect("/login?error=inactive");
  }

  const { returnTo } = await searchParams;
  redirect(safeReturnTo(returnTo, user.role) ?? (user.role === "SUPER_ADMIN" ? "/superadmin" : "/gestion"));
}
