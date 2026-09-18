import { uploadFailureReportSchema } from "@/lib/image-upload-contract";
import { getMerchantStore } from "@/lib/merchant";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return new Response(null, { status: 401 });
  }

  const result = uploadFailureReportSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return new Response(null, { status: 400 });
  }

  console.error("[image-upload] Direct upload failed", {
    storeId: store.id,
    ...result.data
  });

  return new Response(null, { status: 204 });
}
