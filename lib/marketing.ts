export const marketingConfig = {
  brandName: "Tu tienda online",
  salesWhatsappPhone: "543812482028",
  salesWhatsappMessage: "Hola, quiero conocer más sobre la tienda online para mi negocio.",
  demoStorePath: "/demo",
  demoStores: [
    { label: "Demo de ropa", path: "/demo" },
    { label: "Demo de productos", path: "/demo-productos" }
  ]
} as const;

export function getSalesWhatsappUrl() {
  return `https://wa.me/${marketingConfig.salesWhatsappPhone}?text=${encodeURIComponent(marketingConfig.salesWhatsappMessage)}`;
}
