import { z } from "zod";

const deliveryMethodBaseSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(["custom", "pickup"]).default("custom"),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(250).default(""),
  price: z.number().int().min(0).max(999999999).nullable(),
  enabled: z.boolean(),
  pickupDetails: z.string().trim().max(300).default(""),
  amountLimitEnabled: z.boolean().default(false),
  freeShippingEnabled: z.boolean().default(false),
  deliveryTimeEnabled: z.boolean().default(false),
  freeAbove: z.number().int().min(0).max(999999999).nullable().default(null),
  minAmount: z.number().int().min(0).max(999999999).nullable().default(null),
  maxAmount: z.number().int().min(0).max(999999999).nullable().default(null),
  coverage: z.string().max(250).default("Argentina"),
  estimatedTime: z.string().max(120).default(""),
  minDays: z.number().int().min(1).max(365).nullable().default(null),
  maxDays: z.number().int().min(1).max(365).nullable().default(null)
});
export const deliveryMethodSchema = deliveryMethodBaseSchema.superRefine((method, context) => {
  if (method.type === "pickup" && method.price !== 0) context.addIssue({ code: "custom", path: ["price"], message: "El retiro en sucursal no tiene costo." });
  if (method.type === "pickup" && method.enabled && !method.pickupDetails.trim()) context.addIssue({ code: "custom", path: ["pickupDetails"], message: "Ingresá la dirección y los horarios de atención." });
  if (method.type === "custom" && method.amountLimitEnabled && method.minAmount !== null && method.maxAmount !== null && method.minAmount > method.maxAmount) {
    context.addIssue({ code: "custom", path: ["maxAmount"], message: "El monto máximo no puede ser menor al mínimo." });
  }
  if (method.type === "custom" && method.deliveryTimeEnabled && (method.minDays === null || method.maxDays === null || method.maxDays < method.minDays)) {
    context.addIssue({ code: "custom", path: ["maxDays"], message: "Revisá el rango de días de entrega." });
  }
  if (method.type === "custom" && method.freeShippingEnabled && method.freeAbove === null) {
    context.addIssue({ code: "custom", path: ["freeAbove"], message: "Ingresá el monto mínimo para el envío gratis." });
  }
});

export const paymentMethodTypeSchema = z.enum(["cash", "transfer", "seller", "custom"]);
export const paymentMethodSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: paymentMethodTypeSchema,
  enabled: z.boolean(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(""),
  instructions: z.string().max(1000).default(""),
  discountPercent: z.number().min(0).max(100).default(0),
  accountHolder: z.string().trim().max(120).default(""),
  provider: z.string().trim().max(120).default(""),
  alias: z.string().trim().max(120).default(""),
  cbu: z.string().trim().max(30).default(""),
  requestReceipt: z.boolean().default(false)
});
export const paymentMethodsSchema = z.array(paymentMethodSchema).max(20).refine(
  methods => new Set(methods.map(method => method.id)).size === methods.length,
  "Las formas de pago deben tener identificadores únicos."
);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentMethodType = PaymentMethod["type"];

export const checkoutSettingsSchema = z.object({
  demoMode: z.boolean().default(false),
  paymentMethods: paymentMethodsSchema.optional(),
  requirePhone: z.boolean().default(true),
  requireDni: z.boolean().default(false),
  requireBilling: z.boolean().default(false),
  allowNotes: z.boolean().default(true),
  minimumAmount: z.number().int().min(0).max(999999999).nullable().default(null),
  showLowStock: z.boolean().default(false),
  lowStockThreshold: z.number().int().min(1).max(999999).default(5),
  cashName: z.string().trim().min(2).max(80).default("Efectivo"),
  transferName: z.string().trim().min(2).max(80).default("Transferencia o depósito bancario"),
  cashDescription: z.string().trim().max(500).default('Después de hacer clic en "Finalizar el pedido", nos comunicaremos contigo para confirmar el pago.'),
  transferDescription: z.string().trim().max(500).default('Después de hacer clic en "Finalizar el pedido", nos comunicaremos contigo para confirmar el pago.'),
  cashDiscountPercent: z.number().min(0).max(100).default(10),
  transferDiscountPercent: z.number().min(0).max(100).default(0),
  cashInstructions: z.string().max(1000).default("¡Gracias por tu compra! Recordá que el pago se realiza al momento de retirar el pedido."),
  transferInstructions: z.string().max(1000).default("¡Gracias por tu compra!\n\nUna vez realizada la transferencia, enviá el comprobante de pago al numero de whatsapp:"),
  requestTransferReceipt: z.boolean().default(false),
  acceptSellerPayment: z.boolean().default(false),
  sellerName: z.string().trim().min(2).max(80).default("Acordar con el vendedor"),
  sellerDescription: z.string().trim().max(500).default("Coordiná el pago directamente con el vendedor."),
  sellerInstructions: z.string().max(1000).default("¡Gracias por tu compra! Nos pondremos en contacto para acordar el pago."),
  sellerDiscountPercent: z.number().min(0).max(100).default(0),
  acceptCustomPayment: z.boolean().default(false),
  customName: z.string().trim().min(2).max(80).default("Personalizado"),
  customDescription: z.string().trim().max(500).default("El vendedor te indicará cómo realizar el pago."),
  customInstructions: z.string().max(1000).default("¡Gracias por tu compra! Seguí las instrucciones de pago de la tienda."),
  customDiscountPercent: z.number().min(0).max(100).default(0)
});

export const defaultCheckoutSettings = checkoutSettingsSchema.parse({});
export const defaultDeliveryMethods = [deliveryMethodSchema.parse({
  id: "default", type: "custom", name: "A convenir", description: "Coordiná la entrega con el vendedor", price: null, enabled: true
})];

export function normalizeCheckoutSettings(value: unknown) {
  return checkoutSettingsSchema.catch(defaultCheckoutSettings).parse(value);
}

type PaymentStore = {
  checkoutSettings: unknown;
  acceptCashPayments: boolean;
  acceptTransferPayments: boolean;
  paymentAccountHolder?: string | null;
  paymentProvider?: string | null;
  paymentAlias?: string | null;
  paymentCbu?: string | null;
};

function legacyPayment(type: PaymentMethodType, settings: z.infer<typeof checkoutSettingsSchema>, store?: PaymentStore): PaymentMethod {
  return paymentMethodSchema.parse({
    id: `legacy-${type}`, type, enabled: true,
    name: settings[`${type}Name`], description: settings[`${type}Description`],
    instructions: settings[`${type}Instructions`], discountPercent: settings[`${type}DiscountPercent`],
    ...(type === "transfer" ? {
      accountHolder: store?.paymentAccountHolder ?? "", provider: store?.paymentProvider ?? "",
      alias: store?.paymentAlias ?? "", cbu: store?.paymentCbu ?? "", requestReceipt: settings.requestTransferReceipt
    } : {})
  });
}

export function createPaymentMethod(type: PaymentMethodType, id: string): PaymentMethod {
  return { ...legacyPayment(type, defaultCheckoutSettings), id, enabled: true };
}

export function normalizePaymentMethods(store: PaymentStore): PaymentMethod[] {
  // Presence, including an empty array, makes the collection authoritative.
  const raw = store.checkoutSettings;
  if (raw && typeof raw === "object" && "paymentMethods" in raw && raw.paymentMethods !== undefined) {
    const parsed = paymentMethodsSchema.safeParse(raw.paymentMethods);
    return parsed.success ? parsed.data : [];
  }
  const settings = normalizeCheckoutSettings(raw);
  const enabled: Record<PaymentMethodType, boolean> = {
    cash: store.acceptCashPayments, transfer: store.acceptTransferPayments,
    seller: settings.acceptSellerPayment, custom: settings.acceptCustomPayment
  };
  return paymentMethodTypeSchema.options.filter(type => enabled[type]).map(type => legacyPayment(type, settings, store));
}

export function resolvePaymentMethod(store: PaymentStore, selection: { paymentMethodId?: string; paymentMethod?: PaymentMethodType }): PaymentMethod | undefined {
  const methods = normalizePaymentMethods(store).filter(method => method.enabled);
  if (selection.paymentMethodId) {
    return methods.find(method => method.id === selection.paymentMethodId && (!selection.paymentMethod || method.type === selection.paymentMethod));
  }
  const matches = methods.filter(method => method.type === selection.paymentMethod);
  return matches.length === 1 ? matches[0] : undefined;
}

export function paymentMethodSnapshot(method: PaymentMethod) {
  return {
    paymentMethodId: method.id, paymentMethod: method.type, paymentName: method.name,
    paymentDescription: method.description, paymentInstructions: method.instructions,
    requestReceipt: method.type === "transfer" && method.requestReceipt,
    paymentDetails: method.type === "transfer" ? {
      accountHolder: method.accountHolder, provider: method.provider, alias: method.alias, cbu: method.cbu
    } : null
  };
}

export function normalizeDeliveryMethods(value: unknown) {
  return strictDeliveryMethods(value).catch(defaultDeliveryMethods).parse(value);
}

export function strictDeliveryMethods(value: unknown) {
  const legacySafe = Array.isArray(value) ? value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const method = item as Record<string, unknown>;
    return {
      ...method,
      type: method.type === "pickup" ? "pickup" : "custom",
      coverage: "Argentina",
      amountLimitEnabled: typeof method.amountLimitEnabled === "boolean" ? method.amountLimitEnabled : method.minAmount != null || method.maxAmount != null,
      freeShippingEnabled: typeof method.freeShippingEnabled === "boolean" ? method.freeShippingEnabled : method.freeAbove != null,
      deliveryTimeEnabled: typeof method.deliveryTimeEnabled === "boolean" ? method.deliveryTimeEnabled : Boolean(method.estimatedTime),
      ...(method.deliveryTimeEnabled === true || typeof method.deliveryTimeEnabled !== "boolean" && Boolean(method.estimatedTime) ? { minDays: method.minDays ?? 1, maxDays: method.maxDays ?? 3 } : {}),
      ...(method.type === "pickup" ? { price: 0 } : {})
    };
  }) : value;
  return z.preprocess(() => legacySafe, z.array(deliveryMethodSchema).max(20).refine(methods => new Set(methods.map(method => method.id)).size === methods.length));
}

export const menuItemSchema: z.ZodType<{ label: string; href: string; children?: Array<{ label: string; href: string }> }> = z.object({
  label: z.string().trim().min(1).max(50),
  href: z.string().trim().min(1).max(500).refine((href) => href.startsWith("/") || /^https?:\/\//.test(href)),
  children: z.array(z.object({
    label: z.string().trim().min(1).max(50),
    href: z.string().trim().min(1).max(500).refine((href) => href.startsWith("/") || /^https?:\/\//.test(href))
  })).max(12).optional()
});

export const menuConfigSchema = z.object({
  header: z.array(menuItemSchema).max(20),
  footer: z.array(menuItemSchema).max(20)
});

export const defaultMenuConfig: z.infer<typeof menuConfigSchema> = {
  header: [
    { label: "Inicio", href: "/" },
    { label: "Productos", href: "/productos" }
  ],
  footer: [
    { label: "Inicio", href: "/" },
    { label: "Productos", href: "/productos" }
  ]
};

export function normalizeMenuConfig(_value: unknown) {
  void _value;
  return defaultMenuConfig;
}
