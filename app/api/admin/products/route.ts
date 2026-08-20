import { NextResponse } from "next/server";
import { z } from "zod";

import { SelectionType } from "@/lib/generated/prisma/enums";
import { getMerchantStore } from "@/lib/merchant";
import { parsePriceToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const optionGroupSchema = z.object({
  name: z.string().min(1).max(60),
  selectionType: z.nativeEnum(SelectionType),
  isRequired: z.boolean().default(false),
  options: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        priceDelta: z.coerce.number().int().min(0).default(0)
      })
    )
    .max(30)
});

const schema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(800).optional(),
  basePrice: z.union([z.number(), z.string()]),
  imageUrl: z.string().url().optional().or(z.literal("")),
  categoryName: z.string().min(1).max(80).default("Destacados"),
  isVisible: z.boolean().default(true),
  optionGroups: z.array(optionGroupSchema).max(12).default([])
});

export async function GET() {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    include: {
      category: true,
      optionGroups: {
        include: { options: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });

  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const productSlug = slugify(result.data.name);
  const categorySlug = slugify(result.data.categoryName) || "destacados";

  const category = await prisma.category.upsert({
    where: { storeId_slug: { storeId: store.id, slug: categorySlug } },
    update: { name: result.data.categoryName },
    create: {
      storeId: store.id,
      name: result.data.categoryName,
      slug: categorySlug
    }
  });

  const existing = await prisma.product.findUnique({
    where: { storeId_slug: { storeId: store.id, slug: productSlug } }
  });

  const product = await prisma.product.create({
    data: {
      storeId: store.id,
      categoryId: category.id,
      name: result.data.name,
      slug: existing ? `${productSlug}-${Date.now().toString(36)}` : productSlug,
      description: result.data.description,
      basePrice: parsePriceToCents(String(result.data.basePrice)),
      imageUrls: result.data.imageUrl ? [result.data.imageUrl] : [],
      isVisible: result.data.isVisible,
      optionGroups: {
        create: result.data.optionGroups.map((group, groupIndex) => ({
          name: group.name,
          selectionType: group.selectionType,
          isRequired: group.isRequired,
          minSelections: group.isRequired ? 1 : 0,
          sortOrder: groupIndex,
          options: {
            create: group.options.map((option, optionIndex) => ({
              name: option.name,
              priceDelta: option.priceDelta,
              sortOrder: optionIndex
            }))
          }
        }))
      }
    },
    include: {
      optionGroups: { include: { options: true } }
    }
  });

  return NextResponse.json({ product });
}
