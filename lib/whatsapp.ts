import { formatMoney } from "@/lib/money";

type WhatsAppOrderItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  options: Array<{ groupName: string; optionName: string; priceDelta: number }>;
};

export function normalizeWhatsAppPhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export function buildWhatsAppOrderUrl(input: {
  phone: string;
  storeName: string;
  code: string;
  customerName: string;
  customerPhone: string;
  fulfillment: string;
  notes?: string | null;
  paymentMethod?: "cash" | "transfer";
  paymentDetails?: {
    accountHolder?: string | null;
    provider?: string | null;
    alias?: string | null;
    cbu?: string | null;
  };
  items: WhatsAppOrderItem[];
  total: number;
}) {
  const lines = [
    `Hola ${input.storeName}, quiero confirmar el pedido #${input.code}`,
    "",
    `Cliente: ${input.customerName}`,
    `Teléfono: ${input.customerPhone}`,
    `Modalidad: ${input.fulfillment}`,
    input.paymentMethod === "transfer" ? "Método de pago: Transferencia" : "Método de pago: Efectivo",
    input.paymentMethod === "transfer" && input.paymentDetails?.provider ? `Proveedor: ${input.paymentDetails.provider}` : null,
    input.paymentMethod === "transfer" && input.paymentDetails?.alias ? `Alias: ${input.paymentDetails.alias}` : null,
    input.paymentMethod === "transfer" && input.paymentDetails?.cbu ? `CBU/CVU: ${input.paymentDetails.cbu}` : null,
    input.paymentMethod === "transfer" && input.paymentDetails?.accountHolder ? `Titular: ${input.paymentDetails.accountHolder}` : null,
    input.notes ? `Notas: ${input.notes}` : null,
    "",
    "Pedido:",
    ...input.items.flatMap((item) => [
      `- ${item.quantity}x ${item.productName} (${formatMoney(item.unitPrice)})`,
      ...item.options.map((option) => {
        const delta = option.priceDelta ? ` +${formatMoney(option.priceDelta)}` : "";
        return `  • ${option.groupName}: ${option.optionName}${delta}`;
      }),
      `  Subtotal: ${formatMoney(item.subtotal)}`
    ]),
    "",
    `Total: ${formatMoney(input.total)}`
  ].filter(Boolean);

  return `https://wa.me/${normalizeWhatsAppPhone(input.phone)}?text=${encodeURIComponent(lines.join("\n"))}`;
}
