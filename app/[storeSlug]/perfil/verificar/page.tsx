import Link from "next/link";

import { CustomerVerifyButton } from "@/components/customer-verify-button";

export default async function VerifyPage({ params, searchParams }: { params: Promise<{ storeSlug: string }>; searchParams: Promise<{ token?: string | string[] }> }) {
  const { storeSlug } = await params;
  const { token } = await searchParams;
  return <main className="container-page min-h-dvh py-8"><section className="panel mx-auto mt-8 max-w-md p-6"><h1 className="text-2xl font-bold">Verificar correo</h1><p className="mt-2 text-sm text-muted">Confirmá tu correo para acceder a tus compras.</p>{typeof token === "string" ? <CustomerVerifyButton storeSlug={storeSlug} token={token} /> : <p className="mt-5 text-red-700">El enlace no es válido.</p>}<Link className="mt-5 block text-center text-sm underline" href={`/${storeSlug}`}>Volver a la tienda</Link></section></main>;
}
