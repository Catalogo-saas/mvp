import {
  Banknote,
  CreditCard,
  House,
  Landmark,
  LockKeyhole,
  Mail,
  MessageCircle,
  Phone,
  RotateCcw,
  Shield,
  Store,
  Tag,
  Truck,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import type { PurchaseInfoIcon } from "@/lib/public-page-config";

export const purchaseInfoIconOptions: Array<{ value: PurchaseInfoIcon; label: string; icon: LucideIcon }> = [
  { value: "truck", label: "Envío", icon: Truck },
  { value: "card", label: "Pago", icon: WalletCards },
  { value: "shield", label: "Seguridad", icon: Shield },
  { value: "onlinePayment", label: "Pago online", icon: CreditCard },
  { value: "securePayment", label: "Pago seguro", icon: LockKeyhole },
  { value: "home", label: "Compra en casa", icon: House },
  { value: "discount", label: "Descuentos", icon: Tag },
  { value: "return", label: "Devolución", icon: RotateCcw },
  { value: "store", label: "Local", icon: Store },
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Teléfono", icon: Phone },
  { value: "whatsapp", label: "Whatsapp", icon: MessageCircle },
  { value: "transfer", label: "Transferencia", icon: Landmark },
  { value: "cash", label: "Efectivo", icon: Banknote }
];

export function purchaseInfoIcon(value: PurchaseInfoIcon): LucideIcon {
  return purchaseInfoIconOptions.find((option) => option.value === value)?.icon ?? Truck;
}
