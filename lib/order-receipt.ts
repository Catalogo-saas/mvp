import { getPrivateObject } from "@/lib/storage";

export const receiptMaxBytes = 10 * 1024 * 1024;

export function receiptMime(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

export async function receiptDownload(key: string, name: string | null, mime: string | null) {
  const object = await getPrivateObject(key);
  if (!object.Body) return new Response("No disponible", { status: 404 });
  const bytes = await object.Body.transformToByteArray();
  const safeName = (name ?? "comprobante").replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response(new Uint8Array(bytes).buffer, { headers: { "Content-Type": mime ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${safeName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
