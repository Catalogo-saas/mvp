import { z } from "zod";
import { storeTemplates, normalizeStoreTemplate, getStoreThemeColors } from "@/lib/catalog";
import { designConfigSchema, normalizeDesignConfig } from "@/lib/design-config";
import { imageReferenceSchema } from "@/lib/image-upload-contract";
import { normalizePublicPageConfig, publicPageConfigSchema } from "@/lib/public-page-config";

export const visualSettingsSchema=z.object({
 logo:imageReferenceSchema.nullable(),favicon:imageReferenceSchema.nullable(),heroImages:z.array(imageReferenceSchema).max(3),
 heroTitle:z.string().max(120),heroSubtitle:z.string().max(220),primary:z.string().regex(/^#[0-9a-fA-F]{6}$/),accent:z.string().regex(/^#[0-9a-fA-F]{6}$/),
 useTemplateColors:z.boolean(),template:z.enum(storeTemplates),designConfig:designConfigSchema,publicPageConfig:publicPageConfigSchema,
 showCategories:z.boolean(),showFeatured:z.boolean(),mobileProductColumns:z.union([z.literal(1),z.literal(2)])
}).strict();
export type VisualSettings=z.infer<typeof visualSettingsSchema>;
export type VisualStore={logoUrl:string|null;faviconUrl:string|null;heroImageUrls:string[];heroTitle:string|null;heroSubtitle:string|null;theme:unknown;template:string;designConfig:unknown;publicPageConfig:unknown;showCategories:boolean;showFeatured:boolean;mobileProductColumns:number};
export function visualSettingsFromStore(store:VisualStore):VisualSettings{
 const colors=getStoreThemeColors(store.template,store.theme);
 return {logo:store.logoUrl?{kind:"stored",url:store.logoUrl}:null,favicon:store.faviconUrl?{kind:"stored",url:store.faviconUrl}:null,
 heroImages:store.heroImageUrls.map(url=>({kind:"stored",url})),heroTitle:store.heroTitle??"",heroSubtitle:store.heroSubtitle??"",
 primary:colors.customPrimary,accent:colors.customAccent,useTemplateColors:colors.useTemplateColors,template:normalizeStoreTemplate(store.template),
 designConfig:normalizeDesignConfig(store.designConfig),publicPageConfig:normalizePublicPageConfig(store.publicPageConfig),
 showCategories:store.showCategories,showFeatured:store.showFeatured,mobileProductColumns:store.mobileProductColumns===2?2:1};
}
export const visualStoreKeys=["logoUrl","faviconUrl","heroImageUrls","heroTitle","heroSubtitle","theme","template","designConfig","publicPageConfig","showCategories","showFeatured","mobileProductColumns"] as const;
export function mergeVisualDraft<T extends VisualStore>(store:T,draft:unknown):T{
 if(!draft||typeof draft!=="object"||Array.isArray(draft))return store;
 const values=draft as Record<string,unknown>;
 return {...store,...Object.fromEntries(visualStoreKeys.filter(key=>values[key]!==undefined).map(key=>[key,values[key]]))};
}
