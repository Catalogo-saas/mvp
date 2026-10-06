import "../prisma.config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../lib/generated/prisma/client";
import { getPublicObjectUrl, getStorageClient } from "../lib/storage";
import brand from "../prisma/strom-brand.json";
import { stromBannerIdentity, stromBannerSources, updateStromBannerUrls } from "../prisma/strom-banners";

function connectionString() {
  const value = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!value) throw new Error("Configurá DATABASE_URL o DIRECT_URL.");
  const url = new URL(value);
  if (!process.env.DIRECT_URL && url.hostname === "pooled.db.prisma.io") url.hostname = "db.prisma.io";
  return url.toString();
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString(), connectionTimeoutMillis: 10000 }) });

async function main() {
  const store = await prisma.store.findUnique({ where: { slug: stromBannerIdentity.slug }, select: {
    id: true, updatedAt: true, publicPageConfig: true, isPublished: true, template: true,
    owner: { select: { email: true, role: true, status: true } }
  } });
  if (!store || store.id !== stromBannerIdentity.storeId || store.owner.email.toLowerCase() !== stromBannerIdentity.ownerEmail || store.owner.role !== "MERCHANT" || store.owner.status !== "ACTIVE" || !store.isPublished || store.template !== "vene") {
    throw new Error("No se pudo confirmar el tenant demo publicado /strom. No se modificó ninguna tienda.");
  }

  updateStromBannerUrls(store.publicPageConfig, { desktop: brand.desktopBannerUrl, mobile: brand.mobileBannerUrl });
  const photos = {
    desktop: await readFile(new URL(`../prisma/strom-assets/${stromBannerSources.desktop.file}`, import.meta.url)),
    mobile: await readFile(new URL(`../prisma/strom-assets/${stromBannerSources.mobile.file}`, import.meta.url))
  };
  if (!photos.desktop.subarray(0, 3).equals(Buffer.from([255, 216, 255])) || !photos.mobile.subarray(0, 3).equals(Buffer.from([255, 216, 255])) || photos.desktop.length > 5 * 1024 * 1024 || photos.mobile.length > 5 * 1024 * 1024) {
    throw new Error("Las fotos de Strom no tienen el formato esperado o superan 5 MB.");
  }

  if (!process.argv.includes("--apply")) {
    console.log("/strom verificado. Banners a sangre: escritorio 2000×700 y móvil 900×1360, con la foto cubriendo el área completa.");
    console.log("Ejecutá con --apply para subir las fotos a R2 y actualizar imagen, encuadre y contraste de los dos banners.");
    return;
  }

  const client = getStorageClient();
  const upload = async (device: "desktop" | "mobile") => {
    const source = stromBannerSources[device];
    const photo = photos[device];
    const hash = createHash("sha256").update(photo).digest("hex").slice(0, 16);
    const key = `hero/${store.id}/strom-${device}-fullbleed-${hash}.jpg`;
    try {
      await client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET, Key: key, Body: photo, ContentType: source.contentType,
        CacheControl: "public, max-age=31536000, immutable", IfNoneMatch: "*",
        Metadata: { source: source.source, author: source.author, license: "https://www.pexels.com/license/", usage: "Illustrative sports nutrition banner; not Strom product inventory or endorsement" }
      }));
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412) throw error;
    }
    const url = getPublicObjectUrl(key);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith(source.contentType)) {
      throw new Error(`El banner ${device} no está disponible públicamente (${response.status}).`);
    }
    if (!Buffer.from(await response.arrayBuffer()).equals(photo)) throw new Error(`El banner ${device} publicado no coincide con la foto verificada.`);
    return url;
  };

  const [desktop, mobile] = await Promise.all([upload("desktop"), upload("mobile")]);
  const publicPageConfig = updateStromBannerUrls(store.publicPageConfig, { desktop, mobile });
  const result = await prisma.store.updateMany({
    where: { id: store.id, updatedAt: store.updatedAt },
    data: { publicPageConfig: publicPageConfig as Prisma.InputJsonValue }
  });
  if (result.count !== 1) throw new Error("Strom cambió durante la carga. No se sobrescribió su configuración; verificá antes de repetir.");
  console.log("Banners de /strom actualizados a foto completa. Textos, enlaces, productos y demás secciones conservados.");
  console.log(JSON.stringify({ desktop, mobile }));
}

main().catch(error => {
  console.error((error instanceof Error ? error.message : "No se actualizaron los banners.").replace(/postgres(?:ql)?:\/\/\S+/g, "[conexión privada]"));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
