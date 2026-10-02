import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { CommerceSettingsForm, type SettingsSection } from "@/components/commerce-settings-form";
import { requireMerchantPage } from "@/lib/merchant-authorization";
export default async function SettingsSectionPage({params}:{params:Promise<{section:string}>}) {
 const {section}=await params;
 if(section==="horarios")redirect("/gestion/configuracion/general");
 if(!["general","pagos","whatsapp","compra","entregas","horarios"].includes(section))notFound();
 const {store}=await requireMerchantPage("settings");
 return <CommerceSettingsForm key={section} store={store} section={section as SettingsSection}/>;
}
