import { describe, expect, it } from "vitest";

import { defaultDesignConfig, normalizeDesignConfig } from "../lib/design-config";

describe("configuración de diseño", () => {
  it("mantiene valores seguros para una tienda anterior", () => {
    expect(normalizeDesignConfig(null)).toEqual(defaultDesignConfig);
    expect(defaultDesignConfig.quickBuyEnabled).toBe(false);
  });

  it("completa las opciones que faltan en un borrador", () => {
    const config = normalizeDesignConfig({ font: "rounded", showSku: true });
    expect(config.font).toBe("rounded");
    expect(config.showSku).toBe(true);
    expect(config.headerSticky).toBe(true);
  });

  it("descarta una configuración inválida", () => {
    expect(normalizeDesignConfig({ logoSize: 999 })).toEqual(defaultDesignConfig);
  });
});
