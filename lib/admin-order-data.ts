import type { Prisma } from "@/lib/generated/prisma/client";
import { createTrackingToken, trackingPath } from "@/lib/order-tracking";
export const adminOrderInclude={items:true,events:{orderBy:{createdAt:"asc" as const}}};
export function serializeAdminOrder(order:Prisma.OrderGetPayload<{include:typeof adminOrderInclude}>,slug:string){
 return {...order,createdAt:order.createdAt.toISOString(),updatedAt:order.updatedAt.toISOString(),readAt:order.readAt?.toISOString()??null,
 trackingPath:order.trackingTokenHash?trackingPath(slug,createTrackingToken(order.id,order.storeId)):null,
 events:order.events.map(event=>({...event,createdAt:event.createdAt.toISOString()}))};
}
