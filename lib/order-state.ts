type Payment="PENDING"|"CONFIRMED"|"CANCELLED";
type Fulfillment="PENDING"|"PACKED"|"SHIPPED"|"DELIVERED"|"CANCELLED";
type Status="PENDING_WHATSAPP"|"PAID"|"IN_PREPARATION"|"DELIVERED"|"CANCELLED";
export function nextOrderState(current:{paymentStatus:Payment;fulfillmentStatus:Fulfillment},patch:{status?:Status;paymentStatus?:Payment;fulfillmentStatus?:Fulfillment}){
 const cancelled=patch.status==="CANCELLED"||patch.paymentStatus==="CANCELLED"||patch.fulfillmentStatus==="CANCELLED";
 const paymentStatus:Payment=cancelled?"CANCELLED":patch.paymentStatus??(patch.status==="PAID"?"CONFIRMED":current.paymentStatus);
 const fulfillmentStatus:Fulfillment=cancelled?"CANCELLED":patch.fulfillmentStatus??(patch.status==="IN_PREPARATION"?"PACKED":patch.status==="DELIVERED"?"DELIVERED":current.fulfillmentStatus);
 const status:Status=cancelled?"CANCELLED":fulfillmentStatus==="DELIVERED"?"DELIVERED":fulfillmentStatus==="PACKED"||fulfillmentStatus==="SHIPPED"?"IN_PREPARATION":paymentStatus==="CONFIRMED"?"PAID":"PENDING_WHATSAPP";
 return {paymentStatus,fulfillmentStatus,status};
}
