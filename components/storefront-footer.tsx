"use client";

import { CreditCard, MapPin, Store, Truck } from "lucide-react";
import type { MouseEvent } from "react";
import { normalizePaymentMethods, normalizeDeliveryMethods } from "@/lib/commerce-settings";
import { normalizeDesignConfig } from "@/lib/design-config";
import type { StorefrontStore } from "@/components/public-store";
import { StoreSocialLinks } from "@/components/storefront-brand-content";
import styles from "./commerce-storefront.module.css";

export function StorefrontFooter({ store, onNavigatePreview }: {
  store: StorefrontStore;
  onNavigatePreview?: (event: MouseEvent<HTMLAnchorElement>, path: string) => void;
}) {
  const design = normalizeDesignConfig(store.designConfig);
  const payments = normalizePaymentMethods(store).filter(method => method.enabled);
  const deliveries = normalizeDeliveryMethods(store.deliveryMethods).filter(method => method.enabled);
  const href = (path: string) => `/${store.slug}${path === "/" ? "" : path}`;
  const pages: Array<[string, string]> = [["Inicio", "/"], ["Productos", "/productos"], ["Contacto", "/contacto"]];

  return <footer className={styles.footer} id="store-contact">
    <div className={styles.footerInner}>
      {design.footerOptions.showMenu && <nav aria-label="Páginas"><h2>Páginas</h2>{pages.map(([label, path]) => <div key={path}><a href={href(path)} onClick={event => onNavigatePreview?.(event, path)}>{label}</a></div>)}</nav>}
      {(design.footerOptions.showContact || design.footerOptions.showSocials) && <div>
        {design.footerOptions.showContact && <><h2>Contacto</h2>{store.address && <p><MapPin size={16}/>{store.address}</p>}<a href={"https://wa.me/" + store.whatsappPhone.replace(/\D/g, "")} target="_blank" rel="noreferrer">{store.whatsappPhone}</a>{store.businessHoursText && <p>{store.businessHoursText}</p>}</>}
        {design.footerOptions.showSocials && <StoreSocialLinks store={store}/>}
      </div>}
      {(design.footerOptions.showPaymentMethods || design.footerOptions.showDeliveryMethods) && <div>
        {design.footerOptions.showPaymentMethods && <><h2>Medios de pago</h2><div className={styles.paymentBadges}>{payments.length ? payments.map(method => <span key={method.id}><CreditCard size={15}/>{method.name}</span>) : <span>Consultanos</span>}</div></>}
        {design.footerOptions.showDeliveryMethods && <><h2 className={styles.deliveryTitle}>Formas de entrega</h2><div className={styles.paymentBadges}>{deliveries.map(method => <span key={method.id} title={method.type === "pickup" ? method.pickupDetails : method.description}>{method.type === "pickup" ? <Store size={15}/> : <Truck size={15}/>} {method.name}</span>)}</div></>}
      </div>}
    </div>
    {design.footerText && <p className={styles.footerText}>{design.footerText}</p>}
    <div className={styles.copyright}>© {new Date().getFullYear()} {store.name}. Todos los derechos reservados.</div>
  </footer>;
}
