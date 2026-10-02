import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/merchant";

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
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?error=inactive");
  }

  const { returnTo } = await searchParams;
  redirect(safeReturnTo(returnTo, user.role) ?? (user.role === "SUPER_ADMIN" ? "/superadmin" : "/gestion"));
}
