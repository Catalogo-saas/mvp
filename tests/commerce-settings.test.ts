import { describe, expect, it } from "vitest";

import { normalizeCheckoutSettings, normalizeDeliveryMethods, normalizeMenuConfig } from "../lib/commerce-settings";

describe("commerce settings", () => {
  it("starts with minimal checkout fields and one custom delivery", () => {
    const checkout = normalizeCheckoutSettings({});
    expect(checkout.requirePhone).toBe(true);
    expect(checkout.requireDni).toBe(false);
    expect(checkout.requireBilling).toBe(false);
    const delivery = normalizeDeliveryMethods(null);
    expect(delivery).toHaveLength(1);
    expect(delivery[0].name).toBe("A convenir");
    expect(delivery[0].price).toBeNull();
    expect(delivery[0].type).toBe("custom");
  });

  it("upgrades old custom deliveries and fixes their coverage to Argentina", () => {
    const [delivery] = normalizeDeliveryMethods([{ id: "old", name: "Correo", description: "", price: 1200, enabled: true, coverage: "Buenos Aires", minAmount: 5000, maxAmount: null, freeAbove: 20000, estimatedTime: "1 a 3 días" }]);
    expect(delivery).toMatchObject({ type: "custom", coverage: "Argentina", amountLimitEnabled: true, freeShippingEnabled: true, deliveryTimeEnabled: true, minDays: 1, maxDays: 3 });
  });

  it("ignores retired shipping progress without resetting saved checkout preferences", () => {
    const checkout = normalizeCheckoutSettings({ showFreeShippingProgress: true, requirePhone: false, requireDni: true, showLowStock: true, minimumAmount: 25000 });
    expect(checkout).not.toHaveProperty("showFreeShippingProgress");
    expect(checkout).toMatchObject({ requirePhone: false, requireDni: true, showLowStock: true, minimumAmount: 25000 });
  });

  it("normalizes pickup as free and preserves its location and hours", () => {
    const [pickup] = normalizeDeliveryMethods([{ id: "pickup", type: "pickup", name: "Local", pickupDetails: "Córdoba 100 · 9 a 18 h", enabled: true, price: 400 }]);
    expect(pickup).toMatchObject({ type: "pickup", price: 0, coverage: "Argentina", pickupDetails: "Córdoba 100 · 9 a 18 h" });
  });

  it("rejects unsafe menu links and keeps defaults", () => {
    expect(normalizeMenuConfig({ header: [{ label: "Malo", href: "javascript:alert(1)" }], footer: [] }).header[0].label).toBe("Inicio");
  });

  it("ignores previously customized menu links", () => {
    expect(normalizeMenuConfig({ header: [{ label: "Otro", href: "/otro" }], footer: [] }).header.map(item => item.label)).toEqual(["Inicio", "Productos"]);
  });
});
