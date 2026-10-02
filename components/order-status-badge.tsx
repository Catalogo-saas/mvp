import { Check, CreditCard, Package, Truck, X } from "lucide-react";
import { fulfillmentLabels, paymentLabels, type AdminOrder } from "@/lib/admin-orders";

export function PaymentBadge({ status }: { status: AdminOrder["paymentStatus"] }) {
  return <span className={`admin-badge order-status-badge ${status === "CONFIRMED" ? "success" : status === "CANCELLED" ? "danger" : "warning"}`}><CreditCard size={16} aria-hidden="true"/>{paymentLabels[status]}</span>;
}
export function DeliveryBadge({ status }: { status: AdminOrder["fulfillmentStatus"] }) {
  const Icon = status === "DELIVERED" ? Check : status === "CANCELLED" ? X : status === "PENDING" ? Package : Truck;
  return <span className={`admin-badge order-status-badge ${status === "DELIVERED" ? "success" : status === "CANCELLED" ? "danger" : status === "PENDING" ? "purple" : "warning"}`}><Icon size={16} aria-hidden="true"/>{fulfillmentLabels[status]}</span>;
}
