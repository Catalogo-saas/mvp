import type { Metadata } from "next";
import { renderStorePage } from "@/lib/render-public-store-page";

export const metadata: Metadata = { title: "Productos" };
export default function ProductsPage({ params, searchParams }: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ pagina?: string; categoria?: string; q?: string; orden?: string; producto?: string }>;
}) {
  return renderStorePage({ params, searchParams, mode: "catalog" });
}
