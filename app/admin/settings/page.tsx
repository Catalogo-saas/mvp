import { StoreSettingsForm } from "@/components/store-settings-form";
import { getMerchantStore } from "@/lib/merchant";

export default async function AdminSettingsPage() {
  const store = await getMerchantStore();
  if (!store) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="panel p-6">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Tienda</p>
        <h1 className="mt-2 text-3xl font-black">Configuración</h1>
        <p className="mt-2 text-muted">Datos públicos, WhatsApp, logo y colores.</p>
      </header>
      <StoreSettingsForm store={store} />
    </div>
  );
}
