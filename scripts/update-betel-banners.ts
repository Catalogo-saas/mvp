import "../prisma.config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { getPublicObjectUrl, getStorageClient } from "../lib/storage";
import { betelIdentity } from "../prisma/betel-seed";
import { betelFashionBanners, betelFashionSources } from "../prisma/betel-banners";

function connectionString() {
  const value = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!value) throw new Error("Configurá DATABASE_URL o DIRECT_URL.");
  const url = new URL(value);
  if (!process.env.DIRECT_URL && url.hostname === "pooled.db.prisma.io") url.hostname = "db.prisma.io";
  return url.toString();
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString(), connectionTimeoutMillis: 10000 }) });

async function main() {
  const store = await prisma.store.findUnique({ where: { slug: betelIdentity.slug }, select: {
    id: true, updatedAt: true, publicPageConfig: true,
    owner: { select: { email: true, role: true, status: true } }
  } });
  if (!store || store.owner.email.toLowerCase() !== betelIdentity.email || store.owner.role !== "MERCHANT" || store.owner.status !== "ACTIVE") {
    throw new Error("No se pudo confirmar la identidad del titular de /betel. No se modificó ninguna tienda.");
  }
  betelFashionBanners(store.publicPageConfig, {
    desktopBannerUrl: betelFashionSources.desktop.download,
    mobileBannerUrl: betelFashionSources.mobile.download
  });
  if (!process.argv.includes("--apply")) {
    console.log("Identidad y banners de /betel verificados. Ejecutá con --apply para cargar las fotos y actualizar solo los banners.");
    return;
  }
  const client = getStorageClient();
  const upload = async (device: "desktop" | "mobile") => {
    const source = betelFashionSources[device];
    const body = await readFile(new URL(`../prisma/betel-assets/${source.file}`, import.meta.url));
    if (!body.subarray(0, 3).equals(Buffer.from([255, 216, 255])) || body.length > 2 * 1024 * 1024) {
      throw new Error(`La foto ${device} debe ser JPEG de hasta 2 MB.`);
    }
    const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
    const key = `hero/${store.id}/betel-fashion-${device}-${hash}.jpg`;
    try {
      await client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable", IfNoneMatch: "*",
        Metadata: { source: source.origin, author: source.author, license: "https://www.pexels.com/license/", usage: "Illustrative fashion banner; not merchant inventory" }
      }));
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412) throw error;
    }
    const url = getPublicObjectUrl(key);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/jpeg")) {
      throw new Error(`La foto ${device} no está disponible públicamente (${response.status}).`);
    }
    const published = Buffer.from(await response.arrayBuffer());
    if (!published.equals(body)) throw new Error(`La foto ${device} publicada no coincide con el archivo verificado.`);
    return url;
  };
  const [desktopBannerUrl, mobileBannerUrl] = await Promise.all([upload("desktop"), upload("mobile")]);
  const publicPageConfig = betelFashionBanners(store.publicPageConfig, { desktopBannerUrl, mobileBannerUrl });
  const result = await prisma.store.updateMany({
    where: { id: store.id, updatedAt: store.updatedAt },
    data: { publicPageConfig }
  });
  if (result.count !== 1) throw new Error("La tienda cambió durante la carga. No se sobrescribió su configuración; volvé a verificar antes de repetir.");
  console.log("Banners de /betel actualizados. Logo, textos, catálogo, credenciales y demás configuraciones conservados.");
  console.log(JSON.stringify({ desktopBannerUrl, mobileBannerUrl }));
}

main().catch(error => {
  console.error((error instanceof Error ? error.message : "No se actualizaron los banners.").replace(/postgres(?:ql)?:\/\/\S+/g, "[conexión privada]"));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
