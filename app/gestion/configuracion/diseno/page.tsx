import { DesignEditor } from "@/components/design-editor";
import { requireMerchantPage } from "@/lib/merchant-authorization";
import { mergeVisualDraft } from "@/lib/design-settings";
import { prisma } from "@/lib/prisma";
export default async function DesignSettingsPage(){const {store}=await requireMerchantPage("settings");const visual=mergeVisualDraft(store,store.designDraft);const [categories,products]=await Promise.all([prisma.category.findMany({where:{storeId:store.id},select:{id:true,name:true,parentId:true},orderBy:{sortOrder:"asc"}}),prisma.product.findMany({where:{storeId:store.id,isVisible:true},select:{id:true,name:true},orderBy:{sortOrder:"asc"}})]);return <DesignEditor store={{...visual,updatedAt:store.updatedAt.toISOString(),hasDraft:Boolean(store.designDraft)}} categories={categories} products={products}/>;}
