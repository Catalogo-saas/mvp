import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { visualSettingsSchema } from "@/lib/design-settings";
import { imageReferenceSchema } from "@/lib/image-upload-contract";
import { normalizePublicPageConfig } from "@/lib/public-page-config";
import { resolveImageReferences,deletePromotedImages,deletePromotedTemporaries } from "@/lib/image-uploads";
import { getMerchantApiAccess } from "@/lib/merchant-authorization";
import { prisma } from "@/lib/prisma";
const schema=visualSettingsSchema.extend({expectedUpdatedAt:z.string().datetime(),homeImages:z.record(z.string(),imageReferenceSchema).default({})});
async function save(request:Request,publish:boolean){
 const access=await getMerchantApiAccess("settings");if(access.error)return access.error;const {store}=access.context;
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Revisá los campos del diseño."},{status:400});
 const {expectedUpdatedAt,...input}=parsed.data;
 if(store.updatedAt.toISOString()!==expectedUpdatedAt)return NextResponse.json({error:"La tienda cambió en otra ventana. Recargá antes de guardar."},{status:409});
 const previous=store.designDraft&&typeof store.designDraft==="object"&&!Array.isArray(store.designDraft)?store.designDraft as Record<string,unknown>:{};
 const promoted:Awaited<ReturnType<typeof resolveImageReferences>>["promoted"]=[];
 let committed=false;
 try{
 const resolve=async(scope:"logos"|"hero",references:typeof input.heroImages,allowed:unknown[])=>{
 const result=await resolveImageReferences({storeId:store.id,scope,references,allowedStoredUrls:allowed.filter((x):x is string=>typeof x==="string")});
 promoted.push(...result.promoted);return result.urls;};
 const logo=await resolve("logos",input.logo?[input.logo]:[],[store.logoUrl,previous.logoUrl]);
 const favicon=await resolve("logos",input.favicon?[input.favicon]:[],[store.faviconUrl,previous.faviconUrl]);
 const heroes=await resolve("hero",input.heroImages,[...store.heroImageUrls,...(Array.isArray(previous.heroImageUrls)?previous.heroImageUrls:[])]);
 const existingSections=[...normalizePublicPageConfig(store.publicPageConfig).homeSections,...normalizePublicPageConfig(previous.publicPageConfig).homeSections];
 const allowedHomeImages=existingSections.flatMap(section=>[...section.images,...(section.bannerItems??[]).map(item=>item.imageUrl),...Object.values(section.categoryImages),...(section.categoryTiles??[]).map(tile=>tile.imageUrl).filter(Boolean)]);
 const sectionUrls=[...new Set(input.publicPageConfig.homeSections.flatMap(section=>[...section.images,...(section.bannerItems??[]).map(item=>item.imageUrl),...Object.values(section.categoryImages),...(section.categoryTiles??[]).map(tile=>tile.imageUrl).filter(Boolean)]).filter(Boolean))];
 const homeRefs=sectionUrls.map(url=>input.homeImages[url]??{kind:"stored" as const,url});
 const resolvedHomeImages=await resolveImageReferences({storeId:store.id,scope:"hero",references:homeRefs,allowedStoredUrls:allowedHomeImages});
 promoted.push(...resolvedHomeImages.promoted);
 const resolvedByUrl=new Map(sectionUrls.map((url,index)=>[url,resolvedHomeImages.urls[index]]));
 const publicPageConfig={...input.publicPageConfig,homeSections:input.publicPageConfig.homeSections.map(section=>{
  const {categoryTiles,...sectionData}=section;
  return {...sectionData,images:section.images.map(url=>resolvedByUrl.get(url)??url),bannerItems:section.bannerItems?.map(item=>({...item,imageUrl:resolvedByUrl.get(item.imageUrl)??item.imageUrl})),categoryImages:Object.fromEntries(Object.entries(section.categoryImages).map(([id,url])=>[id,resolvedByUrl.get(url)??url])),...(categoryTiles!==undefined?{categoryTiles:categoryTiles.map(tile=>({...tile,imageUrl:tile.imageUrl?resolvedByUrl.get(tile.imageUrl)??tile.imageUrl:""}))}:{})};
 })};
 const visual={logoUrl:logo[0]??null,faviconUrl:favicon[0]??null,heroImageUrls:heroes,heroTitle:input.heroTitle,heroSubtitle:input.heroSubtitle,
 theme:{primary:input.primary,accent:input.accent,useTemplateColors:input.useTemplateColors,font:"Inter"},template:input.template,
 designConfig:input.designConfig,publicPageConfig,showCategories:input.showCategories,showFeatured:input.showFeatured,mobileProductColumns:input.mobileProductColumns};
 const updated=await prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "Store" WHERE id = ${store.id} FOR UPDATE`;
 const current=await tx.store.findUniqueOrThrow({where:{id:store.id}});
 if(current.updatedAt.toISOString()!==expectedUpdatedAt)throw Error("La tienda cambió mientras guardabas. Recargá antes de continuar.");
 return tx.store.update({where:{id:store.id},data:publish?{...visual,designDraft:Prisma.DbNull}:{designDraft:visual}});
 });
 committed=true;await deletePromotedTemporaries(promoted).catch(()=>undefined);
 return NextResponse.json({store:{...updated,...visual},published:publish});
 }catch(error){if(!committed)await deletePromotedImages(promoted);return NextResponse.json({error:error instanceof Error?error.message:"No se pudo guardar el diseño."},{status:409});}
}
export async function PATCH(request:Request){return save(request,false);}
export async function POST(request:Request){return save(request,true);}
