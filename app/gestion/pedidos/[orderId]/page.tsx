import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/order-detail";
import { adminOrderInclude,serializeAdminOrder } from "@/lib/admin-order-data";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { orderListWhere } from "@/lib/admin-orders";
export default async function OrderDetailPage({params,searchParams}:{params:Promise<{orderId:string}>;searchParams:Promise<{back?:string}>}){
 const store=await getMerchantStore();if(!store)return null;const {orderId}=await params;
 const order=await prisma.order.findFirst({where:{id:orderId,storeId:store.id},include:adminOrderInclude});if(!order)notFound();
 const query=await searchParams;const back=query.back&&/^\/gestion\/pedidos(?:\?|$)/.test(query.back)?query.back:"/gestion/pedidos";
 const filters = new URLSearchParams(back.split("?")[1] ?? "");
 const where = orderListWhere(store.id, filters);
 const [previous, next] = await Promise.all([
   prisma.order.findFirst({ where: { AND: [where, { OR: [{ createdAt: { gt: order.createdAt } }, { createdAt: order.createdAt, id: { gt: order.id } }] }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } }),
   prisma.order.findFirst({ where: { AND: [where, { OR: [{ createdAt: { lt: order.createdAt } }, { createdAt: order.createdAt, id: { lt: order.id } }] }] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } })
 ]);
 return <OrderDetail key={order.id} order={serializeAdminOrder(order,store.slug)} back={back} previousId={previous?.id ?? null} nextId={next?.id ?? null}/>;
}
