import type { Prisma } from "@/lib/generated/prisma/client";
import type { serializeAdminOrder } from "@/lib/admin-order-data";
export type AdminOrder=ReturnType<typeof serializeAdminOrder>;
export const paymentLabels={PENDING:"Pago pendiente",CONFIRMED:"Pago confirmado",CANCELLED:"Pago cancelado"};
export const fulfillmentLabels={PENDING:"Por empaquetar",PACKED:"Por enviar",SHIPPED:"Enviado",DELIVERED:"Entregado",CANCELLED:"Cancelado"};
export function orderListWhere(storeId:string,params:URLSearchParams):Prisma.OrderWhereInput{
 const sale = params.get("sale") ?? (params.get("archived") === "1" ? "archived" : "open");
 const saleWhere: Prisma.OrderWhereInput = sale === "all" ? {} : sale === "unread" ? { readAt: null } : sale === "archived" ? { archivedAt: { not: null } } : sale === "cancelled" ? { status: "CANCELLED" } : { archivedAt: null, status: { not: "CANCELLED" } };
 const q=params.get("q")?.trim();const payment=params.get("payment");const fulfillment=params.get("fulfillment");
 const from=params.get("from"),to=params.get("to");const min=params.get("min"),max=params.get("max");
 return {storeId,...saleWhere,...(q?{OR:[{code:{contains:q,mode:"insensitive" as const}},{customerName:{contains:q,mode:"insensitive" as const}},{customerPhone:{contains:q}},{customerEmail:{contains:q,mode:"insensitive" as const}}]}:{}),
 ...(payment&&["PENDING","CONFIRMED","CANCELLED"].includes(payment)?{paymentStatus:payment as "PENDING"}:{}),
 ...(fulfillment&&["PENDING","PACKED","SHIPPED","DELIVERED","CANCELLED"].includes(fulfillment)?{fulfillmentStatus:fulfillment as "PENDING"}:{}),
 ...((from&&/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&/^\d{4}-\d{2}-\d{2}$/.test(to))?{createdAt:{...(from&&Number.isFinite(Date.parse(from))?{gte:new Date(from+"T03:00:00Z")}:{}),...(to&&Number.isFinite(Date.parse(to))?{lt:new Date(Date.parse(to+"T03:00:00Z")+86400000)}:{})}}:{}),
 ...(min||max?{total:{...(min&&Number.isFinite(Number(min))?{gte:Math.max(0,Number(min))}:{}),...(max&&Number.isFinite(Number(max))?{lte:Math.max(0,Number(max))}:{})}}:{})
 };
}
