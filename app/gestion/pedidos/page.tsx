import { OrderList } from "@/components/order-list";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { adminOrderInclude,serializeAdminOrder } from "@/lib/admin-order-data";
import { orderListWhere } from "@/lib/admin-orders";
import { paginationQuery } from "@/lib/admin-list-query";
import { redirect } from "next/navigation";
export default async function OrdersPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const store=await getMerchantStore();if(!store)return null;
 const query=await searchParams;const params=new URLSearchParams();Object.entries(query).forEach(([key,value])=>{if(typeof value==="string")params.set(key,value);});
 if(params.get("orderId"))redirect("/gestion/pedidos/"+encodeURIComponent(params.get("orderId")!));
 const {page:requested,pageSize}=paginationQuery(params);const where=orderListWhere(store.id,params);
 const total=await prisma.order.count({where});const page=Math.min(requested,Math.max(1,Math.ceil(total/pageSize)));
 const orders=await prisma.order.findMany({where,include:adminOrderInclude,orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(page-1)*pageSize,take:pageSize});
 return <OrderList key={params.toString()} orders={orders.map(order=>serializeAdminOrder(order,store.slug))} page={page} pageSize={pageSize} total={total}/>;
}
