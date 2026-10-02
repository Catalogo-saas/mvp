import { notFound, redirect } from "next/navigation";
import { PublicStore } from "@/components/public-store";
import { prisma } from "@/lib/prisma";
import { visibleCategories } from "@/lib/public-categories";
import { getPublicProductPage, publicProductInclude, publicProductOrder, publicProductPageSize } from "@/lib/public-product-query";
import { normalizePublicPageConfig } from "@/lib/public-page-config";
import { getStoreCustomer } from "@/lib/customer-auth";

type Params = Promise<{ storeSlug: string }>;

export async function renderStorePage({ params, searchParams, mode }: { params: Params; searchParams: Promise<{ pagina?: string; categoria?: string; q?: string; orden?: string; producto?: string }>; mode: "home" | "catalog" }) {
  const { storeSlug } = await params;
  const search = await searchParams;
  if (search.producto) redirect(`/${storeSlug}/producto/${encodeURIComponent(search.producto)}`);
  if (mode === "home" && Object.keys(search).some(key => ["pagina", "categoria", "q", "orden"].includes(key))) {
    const query = new URLSearchParams(Object.entries(search).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    redirect(`/${storeSlug}/productos?${query}`);
  }
  const paged = Number.parseInt(search.pagina ?? "1", 10);
  const initialPage = Number.isFinite(paged) ? Math.min(100, Math.max(1, paged)) : 1;
  const store = await prisma.store.findFirst({
    where: { slug: storeSlug, isPublished: true, owner: { status: "ACTIVE" } },
    include: {
      categories: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
    }
  });

  if (!store) {
    notFound();
  }
  const commerce = ["roma", "dana", "vene"].includes(store.template);
  const homeProductIds = normalizePublicPageConfig(store.publicPageConfig).homeSections.flatMap(section => section.type === "productGroup" ? section.productIds : []);
  const publicCategories = visibleCategories(store.categories);
  const [catalog, featuredProducts, categoryAssignments, promotions, customer] = await Promise.all([
    commerce ? getPublicProductPage({ storeId: store.id, categories: publicCategories, query: search.q ?? "", category: search.categoria ?? "all", sort: search.orden ?? "default", page: 1, take: initialPage * publicProductPageSize }) : prisma.product.findMany({ where: { storeId: store.id, isVisible: true }, include: publicProductInclude, orderBy: publicProductOrder("default") }).then(products => ({ products, total: products.length })),
    prisma.product.findMany({ where: { storeId: store.id, isVisible: true, OR: [{ isFeatured: true }, { id: { in: homeProductIds } }] }, include: publicProductInclude, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 200 }),
    prisma.product.findMany({ where: { storeId: store.id, isVisible: true }, select: { id: true, freeShipping: true, categoryId: true, assignedCategories: { select: { id: true } } } }),
    commerce ? getPublicProductPage({ storeId: store.id, categories: publicCategories, query: "", category: "promos", sort: "default", page: 1, take: 1 }) : Promise.resolve({ total: 0 }),
    getStoreCustomer(store.slug)
  ]);
  const products = catalog.products;
  const totalProducts = catalog.total;
  const availableCategoryIds = Array.from(new Set(categoryAssignments.flatMap(product =>
    [product.categoryId, ...product.assignedCategories.map(category => category.id)].filter((id): id is string => Boolean(id))
  )));

  return (
    <PublicStore
      mode={mode}
      store={{
        name: store.name,
        slug: store.slug,
        whatsappPhone: store.whatsappPhone,
        description: store.description,
        heroTitle: store.heroTitle,
        heroSubtitle: store.heroSubtitle,
        logoUrl: store.logoUrl,
        template: store.template,
        theme: store.theme,
        designConfig: store.designConfig,
        mobileProductColumns: store.mobileProductColumns,
        heroImageUrls: store.heroImageUrls,
        showCategories: store.showCategories,
        showFeatured: store.showFeatured,
        freeShippingEnabled: store.freeShippingEnabled,
        freeShippingThreshold: store.freeShippingThreshold,
        acceptTransferPayments: store.acceptTransferPayments,
        acceptCashPayments: store.acceptCashPayments,
        whatsappOrdersEnabled: store.whatsappOrdersEnabled,
        signedIn: Boolean(customer),
        checkoutSettings: store.checkoutSettings,
        deliveryMethods: store.deliveryMethods,
        menuConfig: store.menuConfig,
        taxRatePercent: store.taxRatePercent,
        showPricesWithoutTax: store.showPricesWithoutTax,
        freeShippingProductIds: categoryAssignments.filter((product) => product.freeShipping).map((product) => product.id),
        paymentAccountHolder: store.acceptTransferPayments ? store.paymentAccountHolder : null,
        paymentProvider: store.acceptTransferPayments ? store.paymentProvider : null,
        paymentAlias: store.acceptTransferPayments ? store.paymentAlias : null,
        paymentCbu: store.acceptTransferPayments ? store.paymentCbu : null,
        address: store.address,
        businessHoursText: store.businessHoursText,
        publicPageConfig: store.publicPageConfig,
        availability: { isOpen: true, label: "" }
      }}
      products={products}
      featuredProducts={featuredProducts}
      totalProducts={commerce ? totalProducts : undefined}
      initialPage={initialPage}
      availableCategoryIds={availableCategoryIds}
      hasPromosFromServer={promotions.total > 0}
      categories={publicCategories}
    />
  );
}
