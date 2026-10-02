import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getAuthenticatedUser, getMerchantContext } from "@/lib/merchant";
import { hasStorePermission, type StorePermission } from "@/lib/store-permissions";

export async function getMerchantApiAccess(permission: StorePermission) {
  const user = await getAuthenticatedUser();
  if (!user) return { context: null, error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const context = await getMerchantContext();
  if (!context || !hasStorePermission(context.role, permission)) {
    return { context: null, error: NextResponse.json({ error: "No tenés permisos para esta acción." }, { status: 403 }) };
  }
  return { context, error: null };
}

export async function requireMerchantPage(permission: StorePermission) {
  if (!(await getAuthenticatedUser())) redirect("/login");
  const context = await getMerchantContext();
  if (!context) redirect("/onboarding");
  if (!hasStorePermission(context.role, permission)) redirect("/gestion");
  return context;
}
