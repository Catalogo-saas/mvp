import Link from "next/link";
import type { ReactNode } from "react";
import { normalizeDesignConfig } from "@/lib/design-config";
import { normalizeMenuConfig } from "@/lib/commerce-settings";
import { normalizePublicPageConfig } from "@/lib/public-page-config";
import { storefrontAppearance } from "./storefront-appearance";
import { StorefrontPageNav } from "./storefront-page-nav";
import styles from "./commerce-storefront.module.css";
import pageStyles from "./storefront-page.module.css";

type PageStore = {
  name: string; slug: string; template: string; theme: unknown; designConfig: unknown;
  menuConfig: unknown; publicPageConfig: unknown; logoUrl: string | null;
};

export function StorefrontPage({ store, title, description, children, categories = [] }: { store: PageStore; title: string; description: string; children: ReactNode; categories?: Array<{ id: string; name: string; slug: string; parentId: string | null }> }) {
  const design = normalizeDesignConfig(store.designConfig);
  const page = normalizePublicPageConfig(store.publicPageConfig);
  const menus = normalizeMenuConfig(store.menuConfig);
  const href = (path: string) => /^https?:\/\//.test(path) ? path : `/${store.slug}${path === "/" ? "" : path}`;
  const footerLinks = [...(menus.footer.length ? menus.footer : menus.header), { label: "Contacto", href: "/contacto" }];
  return <div {...storefrontAppearance(store)}>
    {page.announcement.enabled && page.announcement.text && <div className={styles.announcement}>{page.announcement.text}</div>}
    <StorefrontPageNav store={store} categories={categories}/>
    <main className={pageStyles.main}>
      <nav aria-label="Ubicación" className={pageStyles.breadcrumb}><Link href={`/${store.slug}`}>Inicio</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span></nav>
      <div className={pageStyles.title}><h1>{title}</h1><p>{description}</p></div>
      {children}
    </main>
    <footer className={pageStyles.footer}>
      {design.footerOptions.showMenu && <nav aria-label="Enlaces de la tienda">{footerLinks.map((item, index) => <Link href={href(item.href)} key={index}>{item.label}</Link>)}</nav>}
      {design.footerText && <p>{design.footerText}</p>}
      <small>© {new Date().getFullYear()} {store.name}</small>
    </footer>
  </div>;
}
