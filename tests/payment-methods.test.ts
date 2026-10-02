import { describe, expect, it } from "vitest";
import { createPaymentMethod, normalizePaymentMethods, paymentMethodsSchema, paymentMethodSnapshot, resolvePaymentMethod } from "../lib/commerce-settings";

const legacy = {
  acceptCashPayments: true, acceptTransferPayments: true,
  checkoutSettings: { transferName: "Banco original", transferDiscountPercent: 7, transferInstructions: "Usar esta cuenta", requestTransferReceipt: true },
  paymentAccountHolder: "Ana", paymentProvider: "Banco", paymentAlias: "ana.cuenta", paymentCbu: "123"
};
const transfer = (id: string) => ({ ...createPaymentMethod("transfer", id), enabled: true });

describe("métodos de pago independientes", () => {
  it("conserva la configuración heredada y genera identificadores estables", () => {
    const methods = normalizePaymentMethods(legacy);
    expect(methods.map(method => method.id)).toEqual(["legacy-cash", "legacy-transfer"]);
    expect(methods[1]).toMatchObject({ name: "Banco original", discountPercent: 7, instructions: "Usar esta cuenta", accountHolder: "Ana", provider: "Banco", alias: "ana.cuenta", cbu: "123", requestReceipt: true });
    expect(normalizePaymentMethods(legacy)).toEqual(methods);
  });

  it("crea cada tipo activo con valores independientes de las cuentas existentes", () => {
    for (const type of ["cash", "transfer", "seller", "custom"] as const) {
      expect(createPaymentMethod(type, "new")).toMatchObject({ id: "new", type, enabled: true, alias: "", requestReceipt: false });
    }
  });

  it("admite tipos y nombres repetidos pero rechaza IDs duplicados, descuentos inválidos y más de 20 métodos", () => {
    const a = transfer("a"), b = transfer("b");
    expect(paymentMethodsSchema.safeParse([a, b]).success).toBe(true);
    expect(paymentMethodsSchema.safeParse([a, a]).success).toBe(false);
    expect(paymentMethodsSchema.safeParse([{ ...a, discountPercent: 101 }]).success).toBe(false);
    expect(paymentMethodsSchema.safeParse(Array.from({ length: 21 }, (_, i) => transfer(String(i)))).success).toBe(false);
  });

  it("una colección vacía o inválida nunca reactiva los métodos heredados", () => {
    for (const paymentMethods of [[], [{ id: "invalid" }], null]) {
      expect(normalizePaymentMethods({ ...legacy, checkoutSettings: { paymentMethods } })).toEqual([]);
    }
  });

  it("resuelve por ID sin recurrir a otro método activo ni a otra tienda", () => {
    const store = { ...legacy, checkoutSettings: { paymentMethods: [transfer("a"), { ...transfer("b"), enabled: false }] } };
    expect(resolvePaymentMethod(store, { paymentMethodId: "a" })?.id).toBe("a");
    expect(resolvePaymentMethod(store, { paymentMethodId: "b" })).toBeUndefined();
    expect(resolvePaymentMethod(store, { paymentMethodId: "foreign", paymentMethod: "transfer" })).toBeUndefined();
    expect(resolvePaymentMethod(store, { paymentMethodId: "a", paymentMethod: "cash" })).toBeUndefined();
  });

  it("solo acepta la selección antigua si hay una única instancia activa del tipo", () => {
    const store = { ...legacy, checkoutSettings: { paymentMethods: [transfer("a"), transfer("b")] } };
    expect(resolvePaymentMethod(store, { paymentMethod: "transfer" })).toBeUndefined();
    store.checkoutSettings.paymentMethods[1].enabled = false;
    expect(resolvePaymentMethod(store, { paymentMethod: "transfer" })?.id).toBe("a");
    expect(resolvePaymentMethod(legacy, { paymentMethod: "transfer" })?.alias).toBe("ana.cuenta");
  });

  it("el snapshot del pedido conserva cuenta e instrucciones tras editar o eliminar el método", () => {
    const method = { ...transfer("a"), alias: "cuenta.original", instructions: "Instrucciones originales", requestReceipt: true };
    const snapshot = paymentMethodSnapshot(method);
    method.alias = "otra.cuenta";
    method.instructions = "Otras instrucciones";
    method.requestReceipt = false;
    expect(snapshot).toMatchObject({ paymentMethodId: "a", paymentMethod: "transfer", paymentInstructions: "Instrucciones originales", requestReceipt: true, paymentDetails: { alias: "cuenta.original" } });
    expect(paymentMethodSnapshot({ ...method, type: "cash" })).toMatchObject({ paymentDetails: null, requestReceipt: false });
  });
});
