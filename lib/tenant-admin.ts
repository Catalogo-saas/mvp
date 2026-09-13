import { z } from "zod";

import { normalizeStoreTemplate, storeTemplates } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { isCompleteArgentineLocalPhone } from "@/lib/store-settings";

export const businessTypes = ["FOOD", "RETAIL", "SERVICES", "MIXED"] as const;
export const userStatuses = ["ACTIVE", "SUSPENDED"] as const;

const baseTenantSchema = z.object({
  ownerName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(180),
  storeName: z.string().trim().min(2).max(90),
  slug: z.string().trim().min(2).max(64),
  whatsappPhone: z.string().refine(isCompleteArgentineLocalPhone),
  businessType: z.enum(businessTypes),
  template: z.enum(storeTemplates),
  status: z.enum(userStatuses).default("ACTIVE"),
  isPublished: z.boolean().default(true)
});

export const createTenantSchema = baseTenantSchema.extend({
  password: z.string().min(8).max(120)
});

export const updateTenantSchema = baseTenantSchema.extend({
  password: z.string().min(8).max(120).optional().or(z.literal(""))
});

export async function getTenantSummaries() {
  const stores = await prisma.store.findMany({
    where: { owner: { role: "MERCHANT" } },
    include: {
      owner: { select: { id: true, name: true, email: true, status: true, createdAt: true } },
      _count: { select: { products: true, orders: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return stores.map((store) => ({
    id: store.id,
    ownerId: store.owner.id,
    ownerName: store.owner.name ?? "",
    email: store.owner.email,
    status: store.owner.status,
    storeName: store.name,
    slug: store.slug,
    whatsappPhone: store.whatsappPhone,
    businessType: store.businessType,
    template: normalizeStoreTemplate(store.template),
    isPublished: store.isPublished,
    productsCount: store._count.products,
    ordersCount: store._count.orders,
    createdAt: store.createdAt.toISOString()
  }));
}

export async function getTenantSummary(tenantId: string) {
  const tenants = await getTenantSummaries();
  return tenants.find((tenant) => tenant.id === tenantId) ?? null;
}

export type TenantSummary = Awaited<ReturnType<typeof getTenantSummaries>>[number];
