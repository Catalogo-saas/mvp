import Link from "next/link";
import { Building2, CreditCard, MessageCircle, ShoppingBag, Truck, Palette, ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-ui";
import { requireMerchantPage } from "@/lib/merchant-authorization";
const sections=[
 {slug:"general",title:"General",text:"Nombre, datos de tu negocio y publicación.",icon:Building2},
 {slug:"pagos",title:"Métodos de pago",text:"Efectivo, transferencia y descuentos.",icon:CreditCard},
 {slug:"whatsapp",title:"Pedidos por WhatsApp",text:"Número de contacto y forma de recibir pedidos.",icon:MessageCircle},
 {slug:"compra",title:"Proceso de compra",text:"Datos del cliente, compra mínima y avisos.",icon:ShoppingBag},
 {slug:"entregas",title:"Envíos y entregas",text:"Costos, zonas y condiciones de entrega.",icon:Truck}
];
export default async function SettingsPage(){await requireMerchantPage("settings");return <><AdminPageHeader title="Configuración" description="Todo lo que tu negocio necesita para funcionar."/><div className="settings-hub">{sections.map(({slug,title,text,icon:Icon})=><Link key={slug} href={"/gestion/configuracion/"+slug} className="settings-card"><span className="settings-icon"><Icon size={22}/></span><div><h2>{title}</h2><p>{text}</p></div><ChevronRight size={17}/></Link>)}</div><Link className="settings-design-link" href="/gestion/configuracion/diseno"><Palette size={24}/><div><h2>Personalizá tu tienda</h2><p>Logo, colores y secciones, con una vista previa en vivo.</p></div><ChevronRight size={18}/></Link></>;}
