import Link from "next/link";
import { ArrowRight, MessageCircle, Palette, SearchCheck, ShoppingBag } from "lucide-react";

export default function HomePage() {
  return (
    <main>
      <section className="container-page py-8 md:py-12">
        <nav className="mb-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-tight">
            Landing<span className="text-brand">SaaS</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary hidden sm:inline-flex">
              Ingresar
            </Link>
            <Link href="/register" className="btn-primary">
              Crear tienda
            </Link>
          </div>
        </nav>

        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-800">
              MVP para catálogos con pedidos por WhatsApp
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
              Tiendas simples para vender sin pasarela de pagos.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              Cargá productos, opciones y extras. Tus clientes arman el carrito y confirman el pedido directo por WhatsApp.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary">
                Empezar MVP <ArrowRight size={18} />
              </Link>
              <Link href="/mockups/storefront.html" className="btn-secondary">
                Ver mockups
              </Link>
            </div>
          </div>

          <div className="panel overflow-hidden p-4">
            <div className="rounded-[28px] border border-line bg-white p-4">
              <div className="rounded-3xl bg-ink p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/60">Tienda demo</p>
                    <h2 className="text-2xl font-black">Puro Demo</h2>
                  </div>
                  <div className="rounded-full bg-white/15 p-3">
                    <ShoppingBag />
                  </div>
                </div>
                <div className="mt-6 rounded-2xl bg-white p-4 text-ink">
                  <p className="text-sm font-bold text-brand">Hamburguesa clásica</p>
                  <p className="mt-1 text-sm text-muted">Papas + bacon + extra cheddar</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-black">$10.400</span>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">
                      WhatsApp
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page grid gap-4 pb-16 md:grid-cols-3">
        {[
          { icon: ShoppingBag, title: "Catálogo flexible", text: "Productos, categorías, variantes, opciones y extras." },
          { icon: MessageCircle, title: "Pedido por WhatsApp", text: "Se guarda el pedido y se abre el mensaje ya armado." },
          { icon: SearchCheck, title: "SEO y compartir", text: "Metadata dinámica, OG cards, sitemap y páginas compartibles." },
          { icon: Palette, title: "Templates por rubro", text: "Comida, retail, servicios y multirubro desde el MVP." }
        ].map((feature) => (
          <article key={feature.title} className="panel p-6">
            <feature.icon className="text-brand" />
            <h3 className="mt-4 text-xl font-black">{feature.title}</h3>
            <p className="mt-2 leading-7 text-muted">{feature.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
