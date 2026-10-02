import { notFound } from "next/navigation";
import { CommerceSettingsForm } from "@/components/commerce-settings-form";
import { requireMerchantPage } from "@/lib/merchant-authorization";
import { normalizeDeliveryMethods } from "@/lib/commerce-settings";

export default async function DeliveryMethodPage({ params }: { params: Promise<{ methodId: string }> }) {
  const { methodId } = await params;
  const { store } = await requireMerchantPage("settings");
  if (!normalizeDeliveryMethods(store.deliveryMethods).some(method => method.id === methodId)) notFound();
  return <CommerceSettingsForm key={methodId} store={store} section="entregas" methodId={methodId}/>;
}
