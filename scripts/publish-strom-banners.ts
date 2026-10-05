import "../prisma.config";
import { createHash } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getPublicObjectUrl, getStorageClient } from "../lib/storage";
import catalog from "../prisma/strom-catalog.json";

// Editable copy is stored separately in bannerItems, not baked into the artwork.
const photos = await Promise.all([catalog[0], catalog[6]].map(async product => {
  const response = await fetch(product.image);
  if (!response.ok) throw new Error(`No se pudo leer la foto: ${response.status}`);
  return `data:image/webp;base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
}));
const artwork = {
  desktop: `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="600" viewBox="0 0 1400 600"><rect width="1400" height="600" fill="#ffdf00"/><rect x="820" y="55" width="510" height="490" rx="24" fill="white"/><image href="${photos[0]}" x="825" y="90" width="310" height="410"/><image href="${photos[1]}" x="1080" y="140" width="245" height="345"/></svg>`,
  mobile: `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000" viewBox="0 0 700 1000"><rect width="700" height="1000" fill="#ffdf00"/><rect x="60" y="55" width="580" height="465" rx="24" fill="white"/><image href="${photos[0]}" x="65" y="70" width="355" height="420"/><image href="${photos[1]}" x="360" y="105" width="270" height="355"/></svg>`
};
const urls: Record<string, string> = {};
for (const [name, svg] of Object.entries(artwork)) {
  const hash = createHash("sha256").update(svg).digest("hex").slice(0, 16);
  const key = `hero/cmuvdti9600019pyj3zfcnruy/strom-${name}-${hash}.svg`;
  try {
    await getStorageClient().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: svg, ContentType: "image/svg+xml", CacheControl: "public, max-age=31536000, immutable", IfNoneMatch: "*", Metadata: { source: "ENA and Star Nutrition official product photos; see prisma/strom-catalog.json" } }));
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412) throw error;
  }
  const url = getPublicObjectUrl(key);
  const response = await fetch(url);
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`URL pública inválida: ${response.status}`);
  urls[name] = url;
}
console.log(JSON.stringify(urls));
