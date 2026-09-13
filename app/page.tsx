import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  MessageCircle,
  PackageCheck,
  Palette,
  Settings2,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Store,
  type LucideIcon
} from "lucide-react";

import { getSalesWhatsappUrl, marketingConfig } from "@/lib/marketing";

import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Tu tienda online, con tu marca y sin vueltas",
  description:
    "Mostrá tus productos, recibí pedidos ordenados y administrá tu negocio desde un solo lugar. Una tienda online pensada para comercios argentinos.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Tu tienda online, con tu marca y sin vueltas",
    description: "Catálogo, carrito, pedidos y gestión para comercios argentinos.",
    type: "website",
    images: [{ url: "/og.png", width: 1792, height: 1024, alt: "Tu tienda online con catálogo mobile y panel de gestión" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Tu tienda online, con tu marca y sin vueltas",
    description: "Catálogo, carrito, pedidos y gestión para comercios argentinos.",
    images: ["/og.png"]
  }
};

const features: Array<{ icon: LucideIcon; title: string; text: string; tag: string }> = [
  {
    icon: ShoppingBag,
    title: "Un catálogo que da ganas de comprar",
    text: "Organizá productos por categorías, sumá varias fotos y destacá promociones con precios claros.",
    tag: "Catálogo"
  },
  {
    icon: SlidersHorizontal,
    title: "Variantes y opciones, bien resueltas",
    text: "Talles, colores, medidas o extras. Cada cliente elige lo que necesita antes de hacer el pedido.",
    tag: "Productos"
  },
  {
    icon: PackageCheck,
    title: "Stock siempre a la vista",
    text: "Controlá unidades disponibles y evitá seguir ofreciendo productos que ya no tenés.",
    tag: "Inventario"
  },
  {
    icon: MessageCircle,
    title: "Pedidos claros por WhatsApp",
    text: "El cliente arma el carrito y te escribe con productos, cantidades, entrega y total ya ordenados.",
    tag: "Ventas"
  },
  {
    icon: LayoutDashboard,
    title: "Todo el negocio en un panel",
    text: "Revisá pedidos, actualizá estados y administrá tu catálogo desde el celular o la computadora.",
    tag: "Gestión"
  },
  {
    icon: Clock3,
    title: "Vendé con tus propias reglas",
    text: "Configurá horarios, retiro o envío, beneficios por monto y medios de pago según tu forma de trabajar.",
    tag: "Configuración"
  }
];

const steps = [
  { number: "01", title: "Armamos tu espacio", text: "Cargás tu identidad, tus datos y la forma en que trabaja tu negocio." },
  { number: "02", title: "Publicás tus productos", text: "Sumás fotos, precios, categorías, stock y todas las opciones de cada producto." },
  { number: "03", title: "Compartís tu tienda", text: "Usás un solo link en Instagram, WhatsApp, redes o donde ya estén tus clientes." },
  { number: "04", title: "Recibís pedidos listos", text: "Cada compra queda registrada en el panel y llega ordenada a tu WhatsApp." }
];

const faqs = [
  {
    question: "¿Mis clientes tienen que descargar una aplicación?",
    answer: "No. Entran a tu tienda desde cualquier link y compran directamente desde el navegador del celular o la computadora."
  },
  {
    question: "¿Puedo usar los colores y el logo de mi negocio?",
    answer: "Sí. Podés personalizar logo, colores, portada, textos e imágenes para que la tienda se sienta realmente tuya."
  },
  {
    question: "¿Cómo recibo los pedidos?",
    answer: "El pedido queda guardado en tu panel y el cliente abre un mensaje de WhatsApp con todos los datos listos para enviarte."
  },
  {
    question: "¿Puedo ofrecer retiro, envío y transferencia?",
    answer: "Sí. Configurás las modalidades de entrega y podés mostrar los datos de transferencia para coordinar el pago con cada cliente."
  }
];

const templateGroups = [
  {
    title: "Para todo tipo de productos",
    description: "Una base versátil para mostrar categorías, promociones, variantes y stock con claridad.",
    templates: [
      {
        name: "Ecommerce",
        description: "Una vidriera moderna y flexible, pensada para catálogos de cualquier rubro.",
        image: "/template-previews/ecommerce.jpg",
        href: "/mockups/template-ecommerce.html"
      }
    ]
  },
  {
    title: "Moda y belleza",
    description: "Diseños con personalidad para marcas donde la estética y la fotografía son protagonistas.",
    templates: [
      {
        name: "Boutique Soft",
        description: "Cálida, cercana y delicada, con curvas y una paleta suave.",
        image: "/template-previews/boutique-soft.jpg",
        href: "/mockups/template-boutique-soft.html"
      },
      {
        name: "Premium Minimal",
        description: "Fotografía dominante, aire editorial y una grilla limpia de producto.",
        image: "/template-previews/premium-minimal.jpg",
        href: "/mockups/template-premium-minimal.html"
      },
      {
        name: "Beauty Pop",
        description: "Joven, colorida y enérgica para marcas que buscan destacarse.",
        image: "/template-previews/beauty-pop.jpg",
        href: "/mockups/template-beauty-pop.html"
      }
    ]
  },
  {
    title: "Infantil",
    description: "Seis universos visuales creados para indumentaria, accesorios y productos para bebés.",
    templates: [
      {
        name: "Nido Natural",
        description: "Serena y orgánica, con tonos tierra y formas suaves.",
        image: "/template-previews/baby-natural.jpg",
        href: "/mockups/template-baby-natural.html"
      },
      {
        name: "Petit Atelier",
        description: "Clásica y editorial, con una estética de boutique refinada.",
        image: "/template-previews/baby-atelier.jpg",
        href: "/mockups/template-baby-atelier.html"
      },
      {
        name: "Mundo Mini",
        description: "Lúdica y enérgica, con bloques de color y formas gráficas.",
        image: "/template-previews/baby-mini.jpg",
        href: "/mockups/template-baby-mini.html"
      },
      {
        name: "Cielito",
        description: "Pastel y soñadora, inspirada en nubes, estrellas y juegos.",
        image: "/template-previews/baby-cielito.jpg",
        href: "/mockups/template-baby-cielito.html"
      },
      {
        name: "Bosque de Sueños",
        description: "Un pequeño cuento ilustrado con naturaleza y tonos cálidos.",
        image: "/template-previews/baby-bosque.jpg",
        href: "/mockups/template-baby-bosque.html"
      },
      {
        name: "Dulce Abrazo",
        description: "Texturas, costuras y módulos suaves con espíritu artesanal.",
        image: "/template-previews/baby-abrazo.jpg",
        href: "/mockups/template-baby-abrazo.html"
      }
    ]
  }
] as const;

function WhatsappLink({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <a href={getSalesWhatsappUrl()} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}

function StorePhone({
  src = "/demo-store-mobile.png",
  alt = "Tienda NORTE vista desde un celular",
  priority = false
}: {
  src?: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <div className={styles.phone}>
      <Image src={src} alt={alt} width={390} height={844} className={styles.phoneScreenshot} priority={priority} />
    </div>
  );
}

function DemoDesktopPreview() {
  return (
    <div className={styles.realDesktop}>
      <div className={styles.browserBar}><span /><span /><span /><small>tutienda.com/norte</small></div>
      <Image src="/demo-store-desktop.png" alt="Tienda NORTE funcionando en una computadora" width={1440} height={900} className={styles.desktopScreenshot} priority />
    </div>
  );
}

function DashboardPreview() {
  const orders = [
    ["#1048", "Valentina R.", "$73.400", "Nuevo"],
    ["#1047", "Martín S.", "$38.200", "Preparando"],
    ["#1046", "Ana L.", "$52.900", "Entregado"]
  ];

  return (
    <div className={styles.dashboard} aria-label="Ejemplo del panel de gestión visto desde una computadora">
      <aside className={styles.dashboardSidebar}>
        <div className="flex items-center gap-2 text-white">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#d9f99d] text-[#17352f]"><Store size={16} /></span>
          <span className="text-xs font-black">Mi tienda</span>
        </div>
        <div className="mt-8 space-y-2">
          {[LayoutDashboard, ShoppingBag, Shirt, Settings2].map((Icon, index) => (
            <span key={index} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[9px] font-bold ${index === 0 ? "bg-white/10 text-white" : "text-white/50"}`}>
              <Icon size={13} /> {['Resumen', 'Pedidos', 'Productos', 'Configuración'][index]}
            </span>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1 bg-[#f6f8f5] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#1b7766]">Resumen</p>
            <p className="mt-1 text-sm font-black text-[#17352f]">Buen día, Estudio Norte</p>
          </div>
          <span className="rounded-full bg-white px-3 py-2 text-[8px] font-bold shadow-sm">Ver tienda ↗</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[["Pedidos", "28"], ["Ventas", "$486k"], ["Productos", "64"]].map(([label, value], index) => (
            <div key={label} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <span className={`mb-2 grid h-6 w-6 place-items-center rounded-lg ${index === 1 ? "bg-[#d9f99d]" : "bg-[#e4efec]"}`}>
                {index === 0 ? <ShoppingBag size={11} /> : index === 1 ? <Banknote size={11} /> : <Shirt size={11} />}
              </span>
              <p className="text-[8px] font-bold text-slate-400">{label}</p>
              <p className="mt-0.5 text-sm font-black text-[#17352f]">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-black text-[#17352f]">Últimos pedidos</p>
            <span className="text-[8px] font-bold text-[#1b7766]">Ver todos</span>
          </div>
          <div className="space-y-1">
            {orders.map(([code, name, total, status], index) => (
              <div key={code} className="grid grid-cols-[0.7fr_1.2fr_0.8fr_1fr] items-center gap-2 border-t border-slate-100 py-2 text-[8px] first:border-0">
                <strong>{code}</strong><span className="truncate text-slate-500">{name}</span><strong>{total}</strong>
                <span className={`justify-self-start rounded-full px-2 py-1 font-bold ${index === 0 ? "bg-orange-50 text-orange-600" : index === 1 ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-700"}`}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className={styles.salesPage}>
      <header className={styles.siteHeader}>
        <div className="mx-auto flex h-[72px] w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label={`${marketingConfig.brandName}, inicio`}>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#17352f] text-[#d9f99d]"><Store size={20} strokeWidth={2.4} /></span>
            <span className="text-[15px] font-black tracking-[-0.02em] text-[#17352f] sm:text-lg">{marketingConfig.brandName}</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-[#50645e] lg:flex" aria-label="Navegación principal">
            <a href="#funcionalidades" className="transition hover:text-[#17352f]">Funcionalidades</a>
            <a href="#plantillas" className="transition hover:text-[#17352f]">Plantillas</a>
            <a href="#personalizacion" className="transition hover:text-[#17352f]">Personalización</a>
            <a href="#como-funciona" className="transition hover:text-[#17352f]">Cómo funciona</a>
            <a href="#preguntas" className="transition hover:text-[#17352f]">Preguntas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-full px-4 py-2.5 text-sm font-black text-[#17352f] transition hover:bg-[#edf3f0] sm:inline-flex">Ingresar</Link>
            <WhatsappLink className={styles.headerCta}><MessageCircle size={16} /> <span className="hidden sm:inline">Hablemos</span><span className="sm:hidden">Consultar</span></WhatsappLink>
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] items-center gap-12 pb-20 pt-14 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16 lg:pb-28 lg:pt-20">
          <div className="relative z-10">
            <p className={styles.eyebrow}><Sparkles size={14} /> Hecho para vender en Argentina</p>
            <h1 className="mt-6 max-w-[720px] text-[clamp(2.85rem,8vw,5.8rem)] font-black leading-[0.94] tracking-[-0.065em] text-[#17352f]">
              Tu tienda online, <span className={styles.heroAccent}>con tu marca</span> y sin vueltas.
            </h1>
            <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-[#50645e] sm:text-xl">
              Mostrá tus productos como se merecen. Tus clientes arman el carrito y vos recibís cada pedido ordenado, listo para cerrar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <WhatsappLink className={styles.primaryCta}><MessageCircle size={19} /> Quiero mi tienda <ArrowRight size={18} /></WhatsappLink>
              <a href="#recorrido" className={styles.secondaryCta}>Ver cómo funciona <ChevronRight size={18} /></a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[#50645e]">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={17} className="text-[#1b7766]" /> Sin aplicaciones</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={17} className="text-[#1b7766]" /> Pensada para celular</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={17} className="text-[#1b7766]" /> Lista para compartir</span>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.orbitOne} />
            <div className={styles.orbitTwo} />
            <div className={styles.dashboardWrap}><DemoDesktopPreview /></div>
            <div className={styles.phoneWrap}><StorePhone priority /></div>
            <div className={styles.orderToast}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#d9f99d] text-[#17352f]"><Check size={18} strokeWidth={3} /></span>
              <span><strong className="block text-xs text-[#17352f]">Nuevo pedido #1048</strong><small className="text-[10px] font-bold text-slate-400">Hace unos segundos</small></span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.promiseBar} aria-label="Beneficios principales">
        <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-5 py-7 sm:grid-cols-3 sm:py-9">
          {[['Tu identidad', 'Logo, colores y portada a tu manera.'], ['Tu forma de vender', 'Retiro, envío, efectivo o transferencia.'], ['Tus clientes', 'Sin intermediarios ni cuentas obligatorias.']].map(([title, text], index) => (
            <div key={title} className="flex gap-3 sm:border-l sm:border-white/15 sm:pl-6 first:border-0 first:pl-0">
              <span className="mt-0.5 text-sm font-black text-[#d9f99d]">0{index + 1}</span>
              <div><h2 className="font-black text-white">{title}</h2><p className="mt-1 text-sm leading-6 text-white/60">{text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="recorrido" className="scroll-mt-24 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-[1180px]">
          <div className="mx-auto max-w-3xl text-center">
            <p className={styles.sectionLabel}>Dos lados, una sola experiencia</p>
            <h2 className={styles.sectionTitle}>Simple para quien compra.<br />Claro para quien vende.</h2>
            <p className={styles.sectionText}>Tu cliente ve una tienda rápida y profesional. Vos tenés el control de cada producto y cada pedido desde un panel fácil de usar.</p>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            <article className={`${styles.showcaseCard} ${styles.customerCard}`}>
              <div className="max-w-sm">
                <span className={styles.miniLabel}><Smartphone size={14} /> Para tus clientes</span>
                <h3 className="mt-5 text-3xl font-black tracking-[-0.04em] text-[#17352f]">Comprar se siente natural.</h3>
                <p className="mt-3 leading-7 text-[#60736c]">Buscan, eligen variantes, suman al carrito y confirman todo desde el celular.</p>
              </div>
              <div className="mt-10 flex justify-center lg:justify-end"><StorePhone src="/demo-catalog-mobile.png" alt="Catálogo y productos de la tienda NORTE en celular" /></div>
            </article>
            <article className={`${styles.showcaseCard} ${styles.merchantCard}`}>
              <div className="max-w-sm">
                <span className={styles.miniLabel}><LayoutDashboard size={14} /> Para tu negocio</span>
                <h3 className="mt-5 text-3xl font-black tracking-[-0.04em] text-[#17352f]">Administrar deja de ser un lío.</h3>
                <p className="mt-3 leading-7 text-[#60736c]">Productos, pedidos y configuración viven juntos, siempre actualizados.</p>
              </div>
              <div className="mt-12 min-w-[560px] origin-left scale-[0.64] sm:scale-75 lg:scale-[0.68]"><DashboardPreview /></div>
            </article>
          </div>
          <div className="mt-7 text-center">
            <Link href={marketingConfig.demoStorePath} className={styles.demoLink} prefetch={false}>Explorar una tienda de ejemplo <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="scroll-mt-24 bg-[#eef3f0] px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-[1180px]">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <p className={styles.sectionLabel}>Todo lo que necesitás</p>
              <h2 className={`${styles.sectionTitle} !text-left`}>Una tienda que también te ordena.</h2>
              <p className={`${styles.sectionText} !mx-0 !text-left`}>Menos mensajes de ida y vuelta. Más información lista para vender y trabajar todos los días.</p>
              <WhatsappLink className={`${styles.secondaryCta} mt-7 border-[#bfd0ca] bg-transparent`}>Consultar por mi negocio <ArrowRight size={17} /></WhatsappLink>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <article key={feature.title} className={styles.featureCard}>
                  <div className="flex items-start justify-between gap-4">
                    <span className={styles.featureIcon}><feature.icon size={21} /></span>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#8a9c95]">{feature.tag}</span>
                  </div>
                  <h3 className="mt-8 text-xl font-black leading-tight tracking-[-0.03em] text-[#17352f]">{feature.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-6 text-[#60736c]">{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="plantillas" className={styles.templatesSection}>
        <div className="mx-auto max-w-[1180px]">
          <div className="mx-auto max-w-3xl text-center">
            <p className={styles.sectionLabel}>Elegí cómo mostrar tu marca</p>
            <h2 className={styles.sectionTitle}>Una tienda que se siente hecha para vos.</h2>
            <p className={styles.sectionText}>Explorá cada diseño con productos, categorías y carrito. Elegí una plantilla para recorrerla completa.</p>
          </div>

          <div className={styles.templateGroups}>
            {templateGroups.map((group) => (
              <section key={group.title} className={styles.templateGroup} aria-labelledby={`templates-${group.title.toLowerCase().replaceAll(" ", "-")}`}>
                <div className={styles.templateGroupHeader}>
                  <div>
                    <h3 id={`templates-${group.title.toLowerCase().replaceAll(" ", "-")}`}>{group.title}</h3>
                    <p>{group.description}</p>
                  </div>
                  <span>{group.templates.length} {group.templates.length === 1 ? "diseño" : "diseños"}</span>
                </div>
                <div className={styles.templateGrid}>
                  {group.templates.map((template) => (
                    <a key={template.name} href={template.href} className={styles.templateCard} aria-label={`Ver la plantilla ${template.name} completa`}>
                      <span className={styles.templateImage}>
                        <Image src={template.image} alt={`Vista previa de la plantilla ${template.name}`} fill sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 50vw, 380px" />
                      </span>
                      <span className={styles.templateContent}>
                        <span>
                          <strong>{template.name}</strong>
                          <small>{template.description}</small>
                        </span>
                        <span className={styles.templateAction}>Ver completa <ArrowRight size={16} /></span>
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section id="personalizacion" className="scroll-mt-24 overflow-hidden px-4 py-20 sm:py-28">
        <div className="mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="order-2 lg:order-1">
            <div className={styles.customizer}>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div><p className="text-[10px] font-black uppercase tracking-widest text-[#1b7766]">Personalización</p><p className="mt-1 text-sm font-black text-[#17352f]">Hacé que se vea como vos</p></div>
                <span className="rounded-full bg-[#17352f] px-3 py-2 text-[9px] font-black text-white">Guardar cambios</span>
              </div>
              <div className="grid sm:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-5 p-5">
                  <div><p className={styles.fieldLabel}>Logo de tu negocio</p><div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d9f99d]"><Shirt size={18} /></span><span className="text-[10px] font-bold text-slate-500">estudio-norte.png</span></div></div>
                  <div><p className={styles.fieldLabel}>Color principal</p><div className="mt-2 flex gap-2">{['#17352f', '#1b7766', '#d9f99d', '#f15b3f'].map((color, index) => <span key={color} className={`h-8 w-8 rounded-full border-4 border-white shadow ${index === 0 ? 'ring-2 ring-[#17352f]' : ''}`} style={{ backgroundColor: color }} />)}</div></div>
                  <div><p className={styles.fieldLabel}>Portada</p><div className="mt-2 h-16 rounded-xl bg-gradient-to-r from-[#17352f] to-[#1b7766] p-3 text-[9px] font-bold text-white/80">Nueva temporada<br /><strong className="text-white">Ya disponible</strong></div></div>
                  <div className="rounded-xl bg-[#edf3f0] p-3 text-[10px] font-bold leading-5 text-[#50645e]"><Palette className="mb-2 text-[#1b7766]" size={16} />Logo, colores, portada, categorías y textos desde un mismo lugar.</div>
                </div>
                <div className="grid place-items-center bg-[#dce7e2] p-6"><div className="scale-[0.78]"><StorePhone /></div></div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className={styles.sectionLabel}>Tu negocio, no el nuestro</p>
            <h2 className={`${styles.sectionTitle} !text-left`}>Que tu tienda tenga tu forma de ser.</h2>
            <p className={`${styles.sectionText} !mx-0 !text-left`}>No vendés dentro de un catálogo ajeno. Tenés un espacio propio para que tu marca se reconozca desde el primer vistazo.</p>
            <ul className="mt-8 space-y-4">
              {["Colores, logo y portada de tu marca", "Categorías con imágenes y orden propio", "Una o dos columnas de productos en celular", "Información de envío, retiro, horarios y pagos"].map((item) => <li key={item} className="flex items-center gap-3 font-bold text-[#344b44]"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#d9f99d] text-[#17352f]"><Check size={14} strokeWidth={3} /></span>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 bg-[#17352f] px-4 py-20 text-white sm:py-28">
        <div className="mx-auto max-w-[1180px]">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d9f99d]">De cero a vendiendo</p>
            <h2 className="mt-5 text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-6xl">Una forma simple de poner tu negocio online.</h2>
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <article key={step.number} className="relative border-t border-white/20 pt-6">
                <div className="flex items-center justify-between"><span className="text-xs font-black text-[#d9f99d]">{step.number}</span>{index < steps.length - 1 ? <ArrowRight className="hidden text-white/25 lg:block" size={18} /> : null}</div>
                <h3 className="mt-8 text-xl font-black">{step.title}</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-white/60">{step.text}</p>
              </article>
            ))}
          </div>
          <div className={styles.whatsappFlow}>
            <div className="max-w-md">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#d9f99d]"><MessageCircle size={14} /> Pedido listo</span>
              <h3 className="mt-6 text-3xl font-black tracking-[-0.035em] sm:text-4xl">WhatsApp es el cierre, no el catálogo.</h3>
              <p className="mt-4 leading-7 text-white/65">Tu cliente ya eligió todo antes de escribirte. Vos recibís un mensaje claro y el pedido también queda guardado en el panel.</p>
            </div>
            <div className={styles.realCart}>
              <Image src="/demo-cart-mobile.png" alt="Carrito y checkout reales de la tienda NORTE" width={390} height={844} />
            </div>
          </div>
        </div>
      </section>

      <section id="preguntas" className="scroll-mt-24 px-4 py-20 sm:py-28">
        <div className="mx-auto grid max-w-[1000px] gap-12 lg:grid-cols-[0.65fr_1.35fr]">
          <div>
            <p className={styles.sectionLabel}>Preguntas frecuentes</p>
            <h2 className={`${styles.sectionTitle} !text-left !text-4xl`}>Lo importante, bien claro.</h2>
            <p className={`${styles.sectionText} !mx-0 !text-left !text-base`}>Si tu negocio trabaja de otra forma, conversemos. La idea es que la herramienta se adapte a vos.</p>
          </div>
          <div className="divide-y divide-[#dce5e1] border-y border-[#dce5e1]">
            {faqs.map((faq, index) => (
              <details key={faq.question} className={styles.faq} open={index === 0}>
                <summary><span>{faq.question}</span><span className={styles.faqPlus}>+</span></summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-6 sm:pb-8">
        <div className={styles.finalCta}>
          <div className="relative z-10 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#17352f]/60">Tu próxima vidriera está online</p>
            <h2 className="mt-5 text-4xl font-black leading-[1] tracking-[-0.05em] text-[#17352f] sm:text-6xl">Hagamos una tienda que se sienta tuya.</h2>
            <p className="mt-5 max-w-xl font-semibold leading-7 text-[#344b44]">Contanos qué vendés y cómo trabajás. Te mostramos cómo llevarlo a una experiencia simple para vos y para tus clientes.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <WhatsappLink className={styles.darkCta}><MessageCircle size={19} /> Hablar por WhatsApp <ArrowRight size={18} /></WhatsappLink>
              <Link href={marketingConfig.demoStorePath} className={styles.lightCta} prefetch={false}>Ver tienda de ejemplo</Link>
            </div>
          </div>
          <div className={styles.ctaDecoration}><ShoppingBag size={160} strokeWidth={1.1} /></div>
        </div>
      </section>

      <footer className="px-4 pb-24 pt-10 sm:pb-10">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-7 border-t border-[#dce5e1] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17352f] text-[#d9f99d]"><Store size={18} /></span><span className="font-black text-[#17352f]">{marketingConfig.brandName}</span></Link>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-[#60736c]"><a href="#funcionalidades">Funcionalidades</a><a href="#plantillas">Plantillas</a><a href="#personalizacion">Personalización</a><Link href="/login">Ingresar</Link></div>
          <p className="text-xs font-bold text-[#8a9c95]">Hecho para comercios argentinos.</p>
        </div>
      </footer>

      <WhatsappLink className={styles.mobileSticky}><MessageCircle size={18} /> Quiero mi tienda <ArrowRight size={17} /></WhatsappLink>
    </main>
  );
}
