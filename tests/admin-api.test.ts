import { beforeEach,describe,expect,it,vi } from "vitest";
import { visualSettingsFromStore } from "../lib/design-settings";
import { createBannerItem } from "../lib/public-page-config";
import { nextOrderState } from "../lib/order-state";
import { createPaymentMethod } from "../lib/commerce-settings";
const mocks=vi.hoisted(()=>({
 merchant:vi.fn(),updateStore:vi.fn(),findStore:vi.fn(),findProduct:vi.fn(),updateProduct:vi.fn(),lock:vi.fn(),resolve:vi.fn(),cleanup:vi.fn()
}));
vi.mock("@/lib/merchant",()=>({getMerchantStore:mocks.merchant,getAuthenticatedUser:async()=>await mocks.merchant()?{id:"owner"}:null,getMerchantContext:async()=>{const store=await mocks.merchant();return store?{store,user:{id:"owner"},role:"OWNER"}:null;}}));
vi.mock("@/lib/image-uploads",()=>({resolveImageReferences:mocks.resolve,deletePromotedImages:mocks.cleanup,deletePromotedTemporaries:mocks.cleanup}));
vi.mock("@/lib/prisma",()=>{const tx={$queryRaw:mocks.lock,store:{findUniqueOrThrow:mocks.findStore,update:mocks.updateStore},product:{findFirst:mocks.findProduct,update:mocks.updateProduct}};return {prisma:{...tx,$transaction:async(callback:(tx:unknown)=>unknown)=>callback(tx)}};});
import { PATCH as commercePatch } from "../app/api/admin/commerce-settings/route";
import { POST as createAdminOrder } from "../app/api/admin/orders/route";
import { PATCH as draftPatch,POST as designPublish } from "../app/api/admin/design-draft/route";
import { PATCH as productPatch } from "../app/api/admin/products/[productId]/route";
const store={id:"tenant-a",name:"Mi negocio",slug:"url-estable",updatedAt:new Date("2026-09-23T10:00:00Z"),logoUrl:null,faviconUrl:null,heroImageUrls:[],heroTitle:null,heroSubtitle:null,template:"roma",theme:null,designConfig:null,designDraft:null,publicPageConfig:null,showCategories:true,showFeatured:true,mobileProductColumns:2,acceptCashPayments:true,acceptTransferPayments:false,whatsappOrdersEnabled:false,isPublished:true,deliveryMethods:[{id:"pickup",name:"Retiro",price:0,enabled:true}],checkoutSettings:{cashDiscountPercent:12,requireDni:true}};
const request=(body:unknown)=>new Request("http://localhost/api/test",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();mocks.merchant.mockResolvedValue(store);mocks.findStore.mockResolvedValue(store);mocks.updateStore.mockResolvedValue(store);mocks.resolve.mockResolvedValue({urls:[],promoted:[]});mocks.cleanup.mockResolvedValue(undefined);});
describe("guardado de configuración acotado",()=>{
 it("guarda transferencias independientes sin pisar el proceso de compra",async()=>{
   const methods=[{...createPaymentMethod("transfer","a"),enabled:true,alias:"cuenta.a",discountPercent:5},{...createPaymentMethod("transfer","b"),alias:"cuenta.b",discountPercent:12}];
   expect((await commercePatch(request({checkoutSettings:{paymentMethods:methods}}))).status).toBe(200);
   expect(mocks.updateStore.mock.calls[0][0].data.checkoutSettings).toMatchObject({requireDni:true,paymentMethods:methods});
 });
 it("conserva la colección al guardar ajustes de compra",async()=>{
   const methods=[{...createPaymentMethod("custom","a"),enabled:true}];
   mocks.findStore.mockResolvedValue({...store,acceptCashPayments:false,checkoutSettings:{paymentMethods:methods,requireDni:true}});
   expect((await commercePatch(request({checkoutSettings:{requireDni:false}}))).status).toBe(200);
   expect(mocks.updateStore.mock.calls[0][0].data.checkoutSettings).toMatchObject({paymentMethods:methods,requireDni:false});
 });
 it("rechaza borrar o desactivar el último método aunque los flags heredados estén activos",async()=>{
   for(const methods of [[],[{...createPaymentMethod("cash","a"),enabled:false}]]){
     expect((await commercePatch(request({checkoutSettings:{paymentMethods:methods}}))).status).toBe(400);
   }
   expect(mocks.updateStore).not.toHaveBeenCalled();
 });
 it("permite una colección vacía en una tienda no publicada y rechaza IDs repetidos",async()=>{
   mocks.findStore.mockResolvedValue({...store,isPublished:false});
   expect((await commercePatch(request({checkoutSettings:{paymentMethods:[]}}))).status).toBe(200);
   const method=createPaymentMethod("transfer","a");
   expect((await commercePatch(request({checkoutSettings:{paymentMethods:[method,method]}}))).status).toBe(400);
 });
 it("ya no permite crear ventas manuales",async()=>{const response=await createAdminOrder();expect(response.status).toBe(405);});
 it("actualiza el nombre y elimina cualquier restricción horaria heredada",async()=>{expect((await commercePatch(request({name:"Nuevo nombre"}))).status).toBe(200);const update=mocks.updateStore.mock.calls[0][0];expect(update).toEqual({where:{id:"tenant-a"},data:{name:"Nuevo nombre",restrictBySchedule:false}});});
 it("conserva ajustes de pago al guardar el proceso de compra",async()=>{expect((await commercePatch(request({checkoutSettings:{requireDni:false}}))).status).toBe(200);expect(mocks.updateStore.mock.calls[0][0].data.checkoutSettings).toMatchObject({cashDiscountPercent:12,requireDni:false});});
 it("rechaza modificar slug o visuales desde comercio",async()=>{expect((await commercePatch(request({slug:"otra"}))).status).toBe(400);expect(mocks.updateStore).not.toHaveBeenCalled();});
 it("no permite volver a editar menús desde la API",async()=>{expect((await commercePatch(request({menuConfig:{header:[],footer:[]}}))).status).toBe(400);expect(mocks.updateStore).not.toHaveBeenCalled();});
 it("no admite dejar una tienda publicada sin métodos de pago",async()=>{expect((await commercePatch(request({acceptCashPayments:false,acceptTransferPayments:false}))).status).toBe(400);expect(mocks.updateStore).not.toHaveBeenCalled();});
});
describe("borrador y publicación",()=>{
 const payload=()=>({...visualSettingsFromStore(store),expectedUpdatedAt:store.updatedAt.toISOString()});
 it("guarda solo designDraft, sin alterar la tienda publicada",async()=>{expect((await draftPatch(request(payload()))).status).toBe(200);expect(Object.keys(mocks.updateStore.mock.calls[0][0].data)).toEqual(["designDraft"]);});
 it("conserva el orden y la visibilidad de las secciones de inicio en el borrador",async()=>{const input=payload();const sections=[...input.publicPageConfig.homeSections].reverse();sections[0]={...sections[0],enabled:false};input.publicPageConfig={...input.publicPageConfig,homeSections:sections};expect((await draftPatch(request(input))).status).toBe(200);expect(mocks.updateStore.mock.calls[0][0].data.designDraft.publicPageConfig.homeSections).toEqual(sections);});
 it("resuelve la imagen nueva del banner antes de guardar el borrador",async()=>{mocks.resolve.mockImplementation(async({references}:{references:Array<{kind:string;url?:string}>})=>({urls:references.map(reference=>reference.kind==="stored"?reference.url:"https://cdn.test/banner.jpg"),promoted:[]}));const input=payload();const blob="blob:http://localhost:3000/banner";input.publicPageConfig.homeSections[0]={...input.publicPageConfig.homeSections[0],images:[blob]};expect((await draftPatch(request({...input,homeImages:{[blob]:{kind:"pending",key:"pending/tenant-a/hero/banner.webp"}}}))).status).toBe(200);expect(mocks.updateStore.mock.calls[0][0].data.designDraft.publicPageConfig.homeSections[0].images).toEqual(["https://cdn.test/banner.jpg"]);});
 it("resuelve las imágenes personalizadas y conserva sus ajustes al publicar",async()=>{mocks.resolve.mockImplementation(async({references}:{references:Array<{kind:string;url?:string}>})=>({urls:references.map(reference=>reference.kind==="stored"?reference.url:"https://cdn.test/new-banner.jpg"),promoted:[]}));const input=payload();const blob="blob:http://localhost:3000/new-banner";const item={...createBannerItem(blob,"banner-one"),title:"Nueva promo",desktop:false,link:"/productos"};input.publicPageConfig.homeSections[0]={...input.publicPageConfig.homeSections[0],bannerItems:[item]};expect((await designPublish(request({...input,homeImages:{[blob]:{kind:"pending",key:"pending/tenant-a/hero/new-banner.webp"}}}))).status).toBe(200);expect(mocks.updateStore.mock.calls[0][0].data.publicPageConfig.homeSections[0].bannerItems).toEqual([{...item,imageUrl:"https://cdn.test/new-banner.jpg"}]);});
 it("publica únicamente propiedades visuales",async()=>{expect((await designPublish(request(payload()))).status).toBe(200);const data=mocks.updateStore.mock.calls[0][0].data;expect(data).toHaveProperty("mobileProductColumns",2);for(const key of ["name","slug","whatsappPhone","address","checkoutSettings","deliveryMethods","acceptCashPayments"])expect(data).not.toHaveProperty(key);});
 it("rechaza escrituras con una versión anterior",async()=>{expect((await draftPatch(request({...payload(),expectedUpdatedAt:"2020-01-01T00:00:00Z"}))).status).toBe(409);expect(mocks.updateStore).not.toHaveBeenCalled();});
 it("requiere una tienda autenticada",async()=>{mocks.merchant.mockResolvedValue(null);expect((await draftPatch(request(payload()))).status).toBe(401);});
});
describe("edición rápida",()=>{
 const product={id:"product-a",storeId:"tenant-a",updatedAt:store.updatedAt,basePrice:100,promoPrice:null,stockQuantity:10,variants:[]};
 it("actualiza stock sin eliminar grupos ni imágenes",async()=>{mocks.findProduct.mockResolvedValue(product);mocks.updateProduct.mockResolvedValue({...product,stockQuantity:5});expect((await productPatch(request({stockQuantity:5,expectedUpdatedAt:product.updatedAt.toISOString()}),{params:Promise.resolve({productId:product.id})})).status).toBe(200);expect(mocks.updateProduct.mock.calls[0][0].data).toEqual({stockQuantity:5});expect(mocks.findProduct.mock.calls[0][0].where).toEqual({id:product.id,storeId:"tenant-a"});});
 it("rechaza cambios simultáneos para no pisar stock reservado",async()=>{mocks.findProduct.mockResolvedValue(product);expect((await productPatch(request({stockQuantity:5,expectedUpdatedAt:"2020-01-01T00:00:00Z"}),{params:Promise.resolve({productId:product.id})})).status).toBe(409);expect(mocks.updateProduct).not.toHaveBeenCalled();});
});
describe("estados independientes",()=>{
 const pending={paymentStatus:"PENDING" as const,fulfillmentStatus:"PENDING" as const};
 it("preparar y entregar no confirman el pago",()=>{expect(nextOrderState(pending,{fulfillmentStatus:"PACKED"})).toEqual({paymentStatus:"PENDING",fulfillmentStatus:"PACKED",status:"IN_PREPARATION"});expect(nextOrderState(pending,{status:"DELIVERED"}).paymentStatus).toBe("PENDING");});
 it("confirmar pago no retrocede una entrega",()=>{expect(nextOrderState({...pending,fulfillmentStatus:"DELIVERED"},{paymentStatus:"CONFIRMED"})).toEqual({paymentStatus:"CONFIRMED",fulfillmentStatus:"DELIVERED",status:"DELIVERED"});});
 it("cancelar es coherente en ambos estados",()=>{expect(nextOrderState(pending,{status:"CANCELLED"})).toEqual({paymentStatus:"CANCELLED",fulfillmentStatus:"CANCELLED",status:"CANCELLED"});});
});
