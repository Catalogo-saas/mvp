import { notFound } from "next/navigation";
import { Clock3, Mail, MapPin, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StorefrontPage } from "@/components/storefront-page";
import { visibleCategories } from "@/lib/public-categories";
import styles from "@/components/storefront-page.module.css";

export default async function ContactPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = await prisma.store.findFirst({ where: { slug: storeSlug, isPublished: true, owner: { status: "ACTIVE" } }, include: { owner: { select: { email: true } }, categories: { select: { id: true, name: true, slug: true, parentId: true, isVisible: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } } });
  if (!store) notFound();
  return <StorefrontPage store={store} categories={visibleCategories(store.categories)} title="Contacto" description="Estamos para ayudarte con tus consultas y pedidos.">
    <div className={styles.contact}>
      <dl className={styles.contactDetails}>
        <div><Mail size={21}/><div><dt>Escribinos</dt><dd><a href={`mailto:${store.owner.email}`}>{store.owner.email}</a></dd></div></div>
        {store.address && <div><MapPin size={21}/><div><dt>Encontranos</dt><dd>{store.address}</dd></div></div>}
        {store.businessHoursText && <div><Clock3 size={21}/><div><dt>Horarios de atención</dt><dd>{store.businessHoursText}</dd></div></div>}
      </dl>
      <section className={styles.contactCta}><h2>¿En qué podemos ayudarte?</h2><p>Consultanos por un producto o por tu pedido. Escribinos y coordinamos juntos.</p><a href={`https://wa.me/${store.whatsappPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle size={19}/>Escribir por WhatsApp</a></section>
    </div>
  </StorefrontPage>;
}
