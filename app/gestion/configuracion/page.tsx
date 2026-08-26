import { StoreSettingsForm } from "@/components/store-settings-form";
import { getMerchantStore } from "@/lib/merchant";

export default async function GestionSettingsPage() {
  const store = await getMerchantStore();
  if (!store) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="panel hidden p-6 md:block">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Configuración</p>
        <h1 className="mt-2 text-3xl font-black">Configuración de la tienda</h1>
        <p className="mt-2 text-muted">Datos públicos, WhatsApp, pagos, horarios, logo y colores.</p>
      </header>
      <StoreSettingsForm store={store} />
    </div>
  );
}
