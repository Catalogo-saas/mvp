"use client";
/* eslint-disable @next/next/no-img-element */
import { ArrowDown, ArrowUpRight, Zap } from "lucide-react";
import type { StorefrontCategory, StorefrontStore } from "./public-store";
import { getBannerItems, safeBannerLink, type HomeSection } from "@/lib/public-page-config";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";
import styles from "./strom-storefront.module.css";

export function StromHero({ store, section }: { store: StorefrontStore; section: HomeSection }) {
  const banner = getBannerItems(section)[0];
  const title = banner?.title || section.title || store.heroTitle;
  const description = banner?.description || section.description || store.heroSubtitle;
  const images = banner ? [banner.imageUrl] : store.heroImageUrls;
  const link = safeBannerLink(banner?.link || "/productos", store.slug);
  return <section className={styles.hero}>
    <div className={styles.heroInner}>
      <div className={styles.copy}><h1>{title}</h1><p>{description}</p>
        <div className={styles.actions}><a className={styles.primary} href={link}>Explorar productos <ArrowUpRight size={22}/></a><a className={styles.secondary} href={`/${store.slug}/productos?categoria=creatinas`}>Ver creatinas <ArrowUpRight size={18}/></a></div>
        <a className={styles.scroll} href="#strom-categories"><ArrowDown size={18}/> Encontrá lo tuyo</a>
      </div>
      <div className={styles.stage} aria-label="Selección de suplementos">
        <Zap className={styles.bolt} strokeWidth={1.2} aria-hidden="true"/>
        {images[0] && <img className={styles.mainProduct} src={images[0]} alt="Producto destacado de la tienda" fetchPriority="high"/>}
        {images[1] && <img className={styles.sideProduct} src={images[1]} alt="Creatina Star Nutrition" fetchPriority="high"/>}
        <span className={styles.stageCaption}>STROM<span>SUPLEMENTOS</span></span>
      </div>
    </div>
    <div className={styles.strip}><span>Proteínas</span><Zap size={17}/><span>Creatinas</span><Zap size={17}/><span>Preentrenos</span><Zap size={17}/><span>Bienestar</span><Zap size={17}/><span>Accesorios</span></div>
  </section>;
}

export function StromCategories({ store, section, categories }: { store: StorefrontStore; section: HomeSection; categories: StorefrontCategory[] }) {
  const tiles = section.categoryTiles ?? (section.categoryIds.length ? section.categoryIds.map(categoryId => ({ id: categoryId, categoryId, title: "", imageUrl: "" })) : categories.map(category => ({ id: category.id, categoryId: category.id, title: "", imageUrl: "" })));
  return <section id="strom-categories" className={styles.categories}><div className={styles.sectionHead}><h2>{section.title || "Encontrá lo tuyo"}</h2><a href={`/${store.slug}/productos`}>Todo el catálogo <ArrowUpRight size={18}/></a></div><div className={styles.categoryGrid}>{tiles.map(tile => {
    const category = categories.find(item => item.id === tile.categoryId);
    if (!category) return null;
    const image = tile.imageUrl || section.categoryImages[category.id] || category.imageUrl;
    return <a key={tile.id} href={`/${store.slug}/productos?categoria=${encodeURIComponent(category.slug)}`} className={styles.category}>{image && <img src={image} alt="" loading="lazy"/>}<span>{tile.title || category.name}<ArrowUpRight size={21}/></span></a>;
  })}</div></section>;
}

export function StromWholesale({ store }: { store: StorefrontStore }) {
  const whatsapp = `https://wa.me/${normalizeWhatsAppPhone(store.whatsappPhone)}?text=${encodeURIComponent("Hola Strom, quisiera consultar por venta mayorista.")}`;
  return <section className={styles.wholesale}><div><h2>Tu equipo.<br/>Nuestra energía.</h2><p>¿Tenés un gimnasio, un local o un equipo? Consultá a Strom por venta mayorista.</p></div><a href={whatsapp} target="_blank" rel="noreferrer">Consultar por mayor <ArrowUpRight size={23}/></a></section>;
}

export function DemoNotice() {
  return <p className={styles.demo}>Tienda de demostración. Precios, promociones, stock y entregas ilustrativos. No realices pagos reales.</p>;
}
