import { describe,expect,it } from "vitest";
import { categoryPath,categoryTreeVersion,validateCategoryTree } from "../lib/category-tree";
import { paginationQuery,productListWhere } from "../lib/admin-list-query";
import { orderListWhere } from "../lib/admin-orders";
import { quickProductSchema,validateQuickPrices } from "../lib/product-quick-edit";
import { mergeVisualDraft,visualSettingsFromStore,visualSettingsSchema } from "../lib/design-settings";
const node=(id:string,name:string,parentId:string|null=null)=>({id,name,parentId,sortOrder:0});
describe("árbol de categorías",()=>{
 it("mantiene nombres iguales en ramas distintas y muestra la ruta completa",()=>{const nodes=[node("a","Ropa"),node("b","Mujer","a"),node("c","Pantalones","b"),node("d","Hombre","a"),node("e","Pantalones","d")];expect(()=>validateCategoryTree(nodes)).not.toThrow();expect(categoryPath("e",nodes)).toBe("Ropa / Hombre / Pantalones");});
 it("rechaza ciclos, padres inexistentes y más de tres niveles",()=>{expect(()=>validateCategoryTree([node("a","A","b"),node("b","B","a")])).toThrow();expect(()=>validateCategoryTree([node("a","A","missing")])).toThrow();expect(()=>validateCategoryTree([node("a","A"),node("b","B","a"),node("c","C","b"),node("d","D","c")])).toThrow("tres niveles");});
 it("rechaza nombres repetidos entre hermanos e IDs duplicados",()=>{expect(()=>validateCategoryTree([node("a"," Ropa "),node("b","ropa")])).toThrow();expect(()=>validateCategoryTree([node("a","Ropa"),node("a","Zapatos")])).toThrow();});
 it("versiona independientemente del orden y detecta cambios",()=>{const nodes=[{id:"a",updatedAt:"2026-01-01T00:00:00Z"},{id:"b",updatedAt:"2026-01-02T00:00:00Z"}];expect(categoryTreeVersion(nodes)).toBe(categoryTreeVersion([...nodes].reverse()));expect(categoryTreeVersion(nodes)).not.toBe(categoryTreeVersion(nodes.slice(1)));});
});
describe("listas de gestión",()=>{
 it("limita la paginación a tamaños seguros",()=>{expect(paginationQuery(new URLSearchParams())).toEqual({page:1,pageSize:25,skip:0,take:25});expect(paginationQuery(new URLSearchParams("page=2&pageSize=10")).skip).toBe(10);expect(paginationQuery(new URLSearchParams("page=-10&pageSize=10000")).pageSize).toBe(25);expect(paginationQuery(new URLSearchParams("page=NaN")).page).toBe(1);});
 it("conserva el alcance de tienda al combinar filtros",()=>{const where=productListWhere("tenant-a",new URLSearchParams("q=ROPA&category=cat-1&visibility=hidden&stock=out"));expect(where.storeId).toBe("tenant-a");expect(where.AND).toHaveLength(3);expect(JSON.stringify(where)).toContain('"isVisible":false');});
 it("filtra pago y entrega de forma independiente dentro de ventas abiertas",()=>{const where=orderListWhere("tenant-a",new URLSearchParams("payment=PENDING&fulfillment=DELIVERED"));expect(where).toMatchObject({storeId:"tenant-a",paymentStatus:"PENDING",fulfillmentStatus:"DELIVERED",archivedAt:null,status:{not:"CANCELLED"}});});
 it("usa días de Argentina para los filtros de fechas",()=>{const where=orderListWhere("a",new URLSearchParams("from=2026-09-01&to=2026-09-02"));expect(where.createdAt).toEqual({gte:new Date("2026-09-01T03:00:00Z"),lt:new Date("2026-09-03T03:00:00Z")});});
});
describe("edición rápida de productos",()=>{
 it("exige una versión y no admite reemplazar opciones desde la edición rápida",()=>{expect(quickProductSchema.safeParse({stockQuantity:0}).success).toBe(false);expect(quickProductSchema.safeParse({stockQuantity:0,expectedUpdatedAt:"2026-01-01T00:00:00Z"}).success).toBe(true);expect(quickProductSchema.safeParse({optionGroups:[],expectedUpdatedAt:"2026-01-01T00:00:00Z"}).success).toBe(false);});
 it("valida ofertas de producto y variante contra el precio efectivo",()=>{expect(()=>validateQuickPrices({basePrice:100,promoPrice:100,variants:[]})).toThrow();expect(()=>validateQuickPrices({basePrice:100,promoPrice:null,variants:[{basePrice:null,promoPrice:100}]})).toThrow();expect(()=>validateQuickPrices({basePrice:100,promoPrice:80,variants:[{basePrice:90,promoPrice:70}]})).not.toThrow();});
});
describe("contrato de diseño",()=>{
 const store={name:"Mi negocio",slug:"url-estable",whatsappPhone:"541112345678",acceptCashPayments:true,logoUrl:null,faviconUrl:null,heroImageUrls:[],heroTitle:null,heroSubtitle:null,theme:{primary:"#123456",accent:"#abcdef"},template:"roma",designConfig:null,publicPageConfig:null,showCategories:true,showFeatured:true,mobileProductColumns:2};
 it("permite una columna y quitar un logo en el borrador",()=>{const merged=mergeVisualDraft({...store,logoUrl:"https://example.com/logo.png"},{mobileProductColumns:1,logoUrl:null});expect(merged.mobileProductColumns).toBe(1);expect(merged.logoUrl).toBeNull();});
 it("ignora datos comerciales y URL dentro de un borrador",()=>{const merged=mergeVisualDraft(store,{name:"No",slug:"otra",acceptCashPayments:false,whatsappPhone:"000",heroTitle:"Nueva portada"});expect(merged).toMatchObject({name:store.name,slug:store.slug,acceptCashPayments:true,whatsappPhone:store.whatsappPhone,heroTitle:"Nueva portada"});});
 it("publica el mismo contrato visual que el borrador y rechaza campos comerciales",()=>{const visual=visualSettingsFromStore(store);expect(visualSettingsSchema.safeParse(visual).success).toBe(true);expect(visualSettingsSchema.safeParse({...visual,name:"No sobrescribir"}).success).toBe(false);});
});
