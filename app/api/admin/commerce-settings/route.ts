import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSettingsSchema, deliveryMethodSchema, normalizeCheckoutSettings, normalizeDeliveryMethods, normalizePaymentMethods } from "@/lib/commerce-settings";
import { isCompleteArgentineLocalPhone, normalizeArgentineWhatsAppPhone, normalizeBusinessHours } from "@/lib/store-settings";
import { getMerchantApiAccess } from "@/lib/merchant-authorization";
import { prisma } from "@/lib/prisma";
const schema=z.object({
 name:z.string().trim().min(2).max(90),description:z.string().trim().max(500).nullable(),
 whatsappPhone:z.string().refine(isCompleteArgentineLocalPhone),acceptCashPayments:z.boolean(),acceptTransferPayments:z.boolean(),whatsappOrdersEnabled:z.boolean(),
 checkoutSettings:checkoutSettingsSchema.partial(),deliveryMethods:z.array(deliveryMethodSchema).max(20),
 paymentAccountHolder:z.string().trim().max(120).nullable(),paymentProvider:z.string().trim().max(120).nullable(),paymentAlias:z.string().trim().max(120).nullable(),paymentCbu:z.string().trim().max(30).nullable(),
 address:z.string().trim().max(180).nullable(),businessHoursText:z.string().trim().max(300).nullable(),restrictBySchedule:z.boolean(),businessHours:z.unknown(),
 taxRatePercent:z.number().int().min(0).max(100),showPricesWithoutTax:z.boolean(),isPublished:z.boolean()
}).partial().strict();
export async function PATCH(request:Request){
 const access=await getMerchantApiAccess("settings");if(access.error)return access.error;const {store}=access.context;
 const result=schema.safeParse(await request.json().catch(()=>null));if(!result.success)return NextResponse.json({error:"Revisá los datos de configuración."},{status:400});
 try {
 const updated=await prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "Store" WHERE id = ${store.id} FOR UPDATE`;
 const current=await tx.store.findUniqueOrThrow({where:{id:store.id}});
 const input=result.data;
 if(input.restrictBySchedule===true)throw Error("La restricción por horarios ya no está disponible.");
 const merged={...current,...input};
 const mergedCheckoutSettings={...normalizeCheckoutSettings(current.checkoutSettings),...input.checkoutSettings};
 if(merged.isPublished&&!merged.whatsappOrdersEnabled){
   // Las tiendas ya publicadas pueden completar su configuración inicial por pasos.
   const activatingNormalCheckout = !current.isPublished || current.whatsappOrdersEnabled;
   const requiresPaymentMethod = activatingNormalCheckout || normalizePaymentMethods(current).some(method => method.enabled);
   const requiresDeliveryMethod = activatingNormalCheckout || normalizeDeliveryMethods(current.deliveryMethods).some(method => method.enabled);
   if(requiresPaymentMethod&&!normalizePaymentMethods({...merged,checkoutSettings:mergedCheckoutSettings}).some(method=>method.enabled))throw Error("Activá al menos un método de pago manual antes de publicar la compra normal.");
   if(requiresDeliveryMethod&&!normalizeDeliveryMethods(merged.deliveryMethods).some(m=>m.enabled))throw Error("Activá al menos una forma de entrega.");
 }
 if(input.deliveryMethods){
 if(new Set(input.deliveryMethods.map(m=>m.id)).size!==input.deliveryMethods.length)throw Error("Las formas de entrega deben tener identificadores únicos.");
 }
 const {checkoutSettings,businessHours,whatsappPhone,...data}=input;
 return tx.store.update({where:{id:store.id},data:{...data,
 ...(input.deliveryMethods?{deliveryMethods:normalizeDeliveryMethods(input.deliveryMethods)}:{}),
 restrictBySchedule:false,
 ...(checkoutSettings?{checkoutSettings:mergedCheckoutSettings}:{}),
 ...(businessHours!==undefined?{businessHours:normalizeBusinessHours(businessHours)}:{}),
 ...(whatsappPhone!==undefined?{whatsappPhone:normalizeArgentineWhatsAppPhone(whatsappPhone)}:{})
 }});
 });
 return NextResponse.json({store:updated});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"No se pudo guardar."},{status:400});}
}
