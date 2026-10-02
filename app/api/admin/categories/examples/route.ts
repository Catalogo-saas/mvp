import { NextResponse } from "next/server";

import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const examples: Record<string, string[]> = {
  "Ropa para hombre": ["Pantalones", "Remeras", "Zapatos"],
  "Ropa para mujer": ["Pantalones", "Vestidos", "Zapatos"],
  "Ropa para niños": []
};

export async function POST() {
  const store = await getMerchantStore();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await prisma.$transaction(async (tx) => {
    for (const [name, children] of Object.entries(examples)) {
      const root = await tx.category.upsert({ where: { storeId_slug: { storeId: store.id, slug: slugify(name) } }, update: {}, create: { storeId: store.id, name, slug: slugify(name) } });
      for (const childName of children) {
        const slug = `${slugify(name)}-${slugify(childName)}`;
        await tx.category.upsert({ where: { storeId_slug: { storeId: store.id, slug } }, update: { name: childName, parentId: root.id }, create: { storeId: store.id, name: childName, slug, parentId: root.id } });
      }
    }
  });
  return NextResponse.json({ ok: true });
}
