import "../prisma.config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { getPublicObjectUrl, getStorageClient } from "../lib/storage";
import { betelBannerArtwork, seedBetel, type BetelBrand } from "../prisma/betel-seed";

function connectionString() {
  const value = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!value) throw new Error("Configurá DATABASE_URL o DIRECT_URL.");
  const url = new URL(value);
  // Prisma documents the direct host for administrative tooling on this same DB.
  if (!process.env.DIRECT_URL && url.hostname === "pooled.db.prisma.io") url.hostname = "db.prisma.io";
  return url.toString();
}

async function prepareBrand(storeId: string): Promise<BetelBrand> {
  const path = process.env.BETEL_LOGO_PATH;
  if (!path) throw new Error("Configurá BETEL_LOGO_PATH con el archivo original del logo de Betel.");
  const logo = await readFile(path);
  const png = logo.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = logo.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (!png && !jpeg || logo.length > 10 * 1024 * 1024) throw new Error("El logo debe ser un archivo PNG o JPEG de hasta 10 MB.");
  const client = getStorageClient();
  const upload = async (scope: "logos" | "hero", name: string, body: Buffer | string, contentType: string, source: string) => {
    const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
    const dot = name.lastIndexOf(".");
    const key = `${scope}/${storeId}/betel-${name.slice(0, dot)}-${hash}${name.slice(dot)}`;
    try {
      await client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable", IfNoneMatch: "*", Metadata: { source }
      }));
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412) throw error;
    }
    const url = getPublicObjectUrl(key);
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`La imagen pública de Betel no está accesible (${response.status}).`);
    return url;
  };
  const [logoUrl, desktopBannerUrl, mobileBannerUrl] = await Promise.all([
    upload("logos", png ? "logo.png" : "logo.jpeg", logo, png ? "image/png" : "image/jpeg", "Original Betel logo supplied by the merchant; uploaded without changes"),
    upload("hero", "desktop.svg", betelBannerArtwork.desktop, "image/svg+xml", "Original vector background in prisma/betel-seed.ts; approved Betel palette"),
    upload("hero", "mobile.svg", betelBannerArtwork.mobile, "image/svg+xml", "Original vector background in prisma/betel-seed.ts; approved Betel palette")
  ]);
  return { logoUrl, desktopBannerUrl, mobileBannerUrl };
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString(), connectionTimeoutMillis: 10000 }) });
seedBetel(prisma, { password: process.env.BETEL_OWNER_PASSWORD, prepareBrand })
  .then(result => {
    console.log(`${result.created ? "Creado" : "Verificado"}: /${result.slug}. Administrador: ${result.email}. Publicado: ${result.isPublished ? "sí" : "no"}.`);
    if (!result.created) console.log("Credenciales, catálogo y configuración existentes conservados.");
  })
  .catch(error => {
    const message = error instanceof Error ? error.message : "Error al crear Betel.";
    console.error(message.replace(/postgres(?:ql)?:\/\/\S+/g, "[conexión privada]"));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
