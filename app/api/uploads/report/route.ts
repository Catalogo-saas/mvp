import { uploadFailureReportSchema } from "@/lib/image-upload-contract";
import { getMerchantApiAccess } from "@/lib/merchant-authorization";
import { hasStorePermission } from "@/lib/store-permissions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await getMerchantApiAccess("operate");
  if (access.error) return access.error;
  const { store, role } = access.context;

  const result = uploadFailureReportSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return new Response(null, { status: 400 });
  }
  if ((result.data.scope === "logos" || result.data.scope === "hero") && !hasStorePermission(role, "settings")) {
    return new Response(null, { status: 403 });
  }

  console.error("[image-upload] Direct upload failed", {
    storeId: store.id,
    ...result.data
  });

  return new Response(null, { status: 204 });
}
