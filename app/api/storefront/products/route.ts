import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { visibleCategories } from "@/lib/public-categories";
import { getPublicProductPage, publicProductPageSize } from "@/lib/public-product-query";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("storeSlug") ?? "";
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  const store = await prisma.store.findFirst({ where: { slug, isPublished: true, owner: { status: "ACTIVE" } }, select: { id: true, categories: { select: { id: true, slug: true, parentId: true, isVisible: true } } } });
  if (!store) return NextResponse.json({ error: "Tienda no disponible." }, { status: 404 });
  const { products, total } = await getPublicProductPage({ storeId: store.id, categories: visibleCategories(store.categories), query: params.get("q") ?? "", category: params.get("category") ?? "all", sort: params.get("sort") ?? "default", page });
  return NextResponse.json({ products, page, total, hasMore: page * publicProductPageSize < total }, { headers: { "Cache-Control": "no-store" } });
}
