"use client";

import { useRouter } from "next/navigation";

export function CustomerLogout({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  return <button type="button" className="text-sm font-semibold underline" onClick={async () => { await fetch(`/api/customer/${storeSlug}/logout`, { method: "POST" }); router.push(`/${storeSlug}/perfil/acceso`); router.refresh(); }}>Cerrar sesión</button>;
}
