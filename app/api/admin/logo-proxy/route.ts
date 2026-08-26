import { NextResponse } from "next/server";

import { getMerchantStore } from "@/lib/merchant";

export async function GET(request: Request) {
  const store = await getMerchantStore();
  if (!store?.logoUrl) {
    return NextResponse.json({ error: "Logo no configurado" }, { status: 404 });
  }

  const requestedUrl = new URL(request.url).searchParams.get("url");
  if (!requestedUrl || requestedUrl !== store.logoUrl) {
    return NextResponse.json({ error: "Logo no permitido" }, { status: 403 });
  }

  const response = await fetch(requestedUrl, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json({ error: "No se pudo cargar el logo" }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "El archivo no es una imagen" }, { status: 400 });
  }

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": contentType
    }
  });
}
