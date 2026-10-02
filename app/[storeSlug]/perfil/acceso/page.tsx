import { redirect } from "next/navigation";

export default async function AccessPage({ params, searchParams }: { params: Promise<{ storeSlug: string }>; searchParams: Promise<{ mode?: string }> }) {
  const [{ storeSlug }, { mode }] = await Promise.all([params, searchParams]);
  redirect(`/${storeSlug}?cuenta=${mode === "register" ? "register" : "login"}`);
}
