import { notFound } from "next/navigation";
import { CommerceSettingsForm } from "@/components/commerce-settings-form";
import { requireMerchantPage } from "@/lib/merchant-authorization";
import { normalizePaymentMethods } from "@/lib/commerce-settings";

export default async function PaymentMethodPage({ params }: { params: Promise<{ methodId: string }> }) {
  const { methodId } = await params;
  const { store } = await requireMerchantPage("settings");
  if (!normalizePaymentMethods(store).some(method => method.id === methodId)) notFound();
  return <CommerceSettingsForm key={methodId} store={store} section="pagos" methodId={methodId}/>;
}
