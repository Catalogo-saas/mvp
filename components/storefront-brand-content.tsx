"use client";

/* eslint-disable @next/next/no-img-element */

import { PackageCheck, RotateCcw, Ruler } from "lucide-react";

import type { StorefrontProduct, StorefrontStore } from "@/components/public-store";
import { getEffectiveProductPrice } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { normalizePublicPageConfig, safeSocialUrl, type PublicSectionId } from "@/lib/public-page-config";

export function StorefrontBrandSection({
  section,
  store,
  products,
  onOpenProduct
}: {
  section: PublicSectionId;
  store: StorefrontStore;
  products: StorefrontProduct[];
  onOpenProduct: (product: StorefrontProduct) => void;
}) {
  const config = normalizePublicPageConfig(store.publicPageConfig);

  if (section === "featured") {
    if (!store.showFeatured) return null;
    const featured = products.filter((product) => product.isFeatured).slice(0, 4);
    const featuredProducts = featured.length ? featured : products.slice(0, 4);
    if (!featuredProducts.length) return null;
    return (
      <section className="mx-auto w-full max-w-7xl border-t border-black/10 px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-labelledby="featured-title">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--store-primary)]">Selección especial</p><h2 id="featured-title" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{config.featuredTitle}</h2></div>
          <a className="hidden text-sm font-black underline underline-offset-4 sm:block" href="#catalogo">Ver todo</a>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {featuredProducts.map((product) => (
            <button key={product.id} type="button" className="group min-w-0 text-left" onClick={() => onOpenProduct(product)}>
              <span className="block aspect-[4/5] overflow-hidden rounded-2xl bg-black/5">{product.imageUrls[0] ? <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}</span>
              <strong className="mt-3 block truncate text-sm">{product.name}</strong>
              <span className="mt-1 block text-sm font-black">{formatMoney(getEffectiveProductPrice(product))}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (section === "info" && config.info.enabled && (config.info.shipping || config.info.returns || config.info.sizeGuide)) {
    const items = [
      config.info.shipping ? { icon: PackageCheck, title: "Envíos", text: config.info.shipping } : null,
      config.info.returns ? { icon: RotateCcw, title: "Cambios", text: config.info.returns } : null,
      config.info.sizeGuide ? { icon: Ruler, title: "Guía de talles", text: config.info.sizeGuide } : null
    ].filter((item): item is { icon: typeof PackageCheck; title: string; text: string } => Boolean(item));
    return <section className="mx-auto grid w-full max-w-7xl gap-3 px-4 py-12 sm:grid-cols-3 sm:px-6 sm:py-16 lg:px-8" aria-label="Información útil">{items.map((item) => <article className="rounded-2xl border border-black/10 bg-white p-5" key={item.title}><item.icon size={20} aria-hidden="true" /><h2 className="mt-4 text-base font-black">{item.title}</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-black/60">{item.text}</p></article>)}</section>;
  }

  return null;
}

export function StoreSocialLinks({ store, className = "", linkClassName = "", layoutClassName = "flex flex-wrap" }: { store: StorefrontStore; className?: string; linkClassName?: string; layoutClassName?: string }) {
  const social = normalizePublicPageConfig(store.publicPageConfig).socials;
  const links = [
    { href: safeSocialUrl(social.instagram), label: "Instagram", iconSrc: "/social/instagram.svg" },
    { href: safeSocialUrl(social.tiktok), label: "TikTok", iconSrc: "/social/tiktok.svg" },
    { href: safeSocialUrl(social.facebook), label: "Facebook", iconSrc: "/social/facebook.svg" }
  ].filter((item) => item.href);
  if (!links.length) return null;
  return <nav className={`${layoutClassName} min-w-0 gap-2 ${className}`} aria-label="Redes sociales">{links.map(({ href, label, iconSrc }) => <a key={label} className={`inline-flex min-w-0 items-center gap-2 rounded-full border border-black/15 px-3 py-2 text-xs font-black ${linkClassName}`} href={href} target="_blank" rel="noreferrer"><img src={iconSrc} alt="" aria-hidden="true" className="h-4 w-4 shrink-0" />{label}</a>)}</nav>;
}
