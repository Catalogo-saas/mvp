import { mergeVisualDraft } from "@/lib/design-settings";
import { DesignPreviewBridge } from "@/components/design-preview-bridge";
import { requireMerchantPage } from "@/lib/merchant-authorization";
import { prisma } from "@/lib/prisma";

export default async function DesignPreviewPage() {
  const { store: merchant } = await requireMerchantPage("settings");
  const store = await prisma.store.findUnique({
    where: { id: merchant.id },
    include: { categories: { orderBy: { sortOrder: "asc" } }, products: { where: { isVisible: true }, include: { category: true, assignedCategories: true, optionGroups: { include: { options: true } } }, orderBy: { sortOrder: "asc" } } }
  });
  if (!store) return null;
  const draft = mergeVisualDraft(store,store.designDraft);
  return <DesignPreviewBridge store={{
    name: typeof draft.name === "string" ? draft.name : store.name, slug: store.slug, whatsappPhone: store.whatsappPhone,
    description: typeof draft.description === "string" ? draft.description : store.description,
    heroTitle: typeof draft.heroTitle === "string" ? draft.heroTitle : store.heroTitle, heroSubtitle: typeof draft.heroSubtitle === "string" ? draft.heroSubtitle : store.heroSubtitle,
    logoUrl: draft.logoUrl === null ? null : typeof draft.logoUrl === "string" ? draft.logoUrl : store.logoUrl,
    template: typeof draft.template === "string" ? draft.template : store.template,
    designConfig: draft.designConfig ?? store.designConfig,
    theme: draft.theme ?? store.theme, mobileProductColumns: draft.mobileProductColumns === 1 || draft.mobileProductColumns === 2 ? draft.mobileProductColumns : store.mobileProductColumns,
    heroImageUrls: Array.isArray(draft.heroImageUrls) ? draft.heroImageUrls.filter((url): url is string => typeof url === "string") : store.heroImageUrls,
    showCategories: typeof draft.showCategories === "boolean" ? draft.showCategories : store.showCategories,
    showFeatured: typeof draft.showFeatured === "boolean" ? draft.showFeatured : store.showFeatured, freeShippingEnabled: store.freeShippingEnabled,
    freeShippingThreshold: store.freeShippingThreshold, acceptCashPayments: store.acceptCashPayments,
    acceptTransferPayments: store.acceptTransferPayments, whatsappOrdersEnabled: store.whatsappOrdersEnabled,
    checkoutSettings: store.checkoutSettings, deliveryMethods: store.deliveryMethods, menuConfig: store.menuConfig,
    taxRatePercent: store.taxRatePercent, showPricesWithoutTax: store.showPricesWithoutTax,
    freeShippingProductIds: store.products.filter((product) => product.freeShipping).map((product) => product.id),
    paymentAccountHolder: store.paymentAccountHolder, paymentProvider: store.paymentProvider, paymentAlias: store.paymentAlias,
    paymentCbu: store.paymentCbu, address: store.address, businessHoursText: store.businessHoursText,
    publicPageConfig: draft.publicPageConfig ?? store.publicPageConfig, availability: { isOpen: true, label: "" }, isPreview: true
  }} products={store.products} categories={store.categories} />;
}
