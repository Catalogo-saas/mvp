import { checkoutSettingsSchema, createPaymentMethod, deliveryMethodSchema, menuConfigSchema } from "../lib/commerce-settings";
import { designConfigSchema } from "../lib/design-config";
import { createBannerItem, createHomeSection, publicPageConfigSchema } from "../lib/public-page-config";
import { variantCombinations } from "../lib/product-variants";
import { slugify } from "../lib/slug";
import galleries from "./demo-images.json" with { type: "json" };

type GalleryKey = keyof typeof galleries;
type Item = [name: string, price: number, details: string];
type Collection = { slug: GalleryKey; parent: string; name: string; items: Item[]; option?: [string, string[]] };
export type DemoKind = "clothing" | "products";
export const demoIdentities = [
  { kind: "clothing" as const, slug: "demo", email: "demo@landing.test", password: "Ropa1234", name: "NORTE", template: "dana" },
  { kind: "products" as const, slug: "demo-productos", email: "demo-productos@landing.test", password: "Productos1234", name: "NEXO", template: "vene" }
] as const;

// All catalog copy and prices are fictional. Photo origins live in demo-images.json.
const clothingCollections: Collection[] = [
  { slug: "mujer-camisas", parent: "mujer", name: "Camisas y blusas", items: [
    ["Camisa de lino Costa", 59000, "Corte cruzado, manga larga y caída liviana. Una camisa fresca para llevar suelta o dentro del pantalón."],
    ["Camisa contraste Nube", 62000, "Cuello clásico y puños contrastantes. Su silueta relajada acompaña looks de oficina y de fin de semana."],
    ["Camisa Oxford Alba", 68000, "Tejido de algodón con textura, cuello camisero y cierre de botones. Calce recto con espacio para moverte."],
    ["Blusa seda Brisa", 74000, "Silueta fluida sin mangas y terminación suave. Una pieza ligera que funciona sola o debajo de un blazer."],
    ["Camisa clásica Delta", 56000, "Manga larga, cuello clásico y ruedo curvo. Una base versátil para combinar con denim o sastrería."]
  ] },
  { slug: "mujer-remeras", parent: "mujer", name: "Remeras", items: [
    ["Remera manga larga Serena", 34000, "Jersey suave, escote redondo y mangas largas. Un básico para usar durante todo el año."],
    ["Remera entallada Clara", 29000, "Algodón con elasticidad y calce al cuerpo. Terminaciones limpias para combinar con prendas amplias."],
    ["Musculosa esencial Aire", 24000, "Tejido de algodón liviano, breteles anchos y corte recto. Ideal para superponer sin sumar volumen."],
    ["Remera relajada Río", 32000, "Cuello redondo y hombros relajados. La silueta cómoda conserva su forma lavado tras lavado."],
    ["Remera oversized Horizonte", 38000, "Corte amplio con hombro caído y largo extendido. Una prenda cómoda para el día a día."]
  ] },
  { slug: "mujer-vestidos", parent: "mujer", name: "Vestidos", items: [
    ["Vestido cintura elástica Duna", 79000, "Cintura adaptable, falda fluida y largo midi. Cómodo para recorrer la ciudad y salir a cenar."],
    ["Vestido capa Aurora", 98000, "Una silueta amplia con movimiento y detalle de capa. La textura suave acompaña su caída."],
    ["Vestido sin mangas Luna", 85000, "Escote simple, sisas cómodas y línea recta. Un diseño fácil de combinar con capas ligeras."],
    ["Vestido midi Oliva", 92000, "Largo por debajo de la rodilla y corte relajado. Una pieza versátil para llevar de día o de noche."],
    ["Vestido largo Marea", 109000, "Silueta larga y ligera con terminaciones delicadas. Pensado para crear un conjunto completo con una sola prenda."]
  ] },
  { slug: "mujer-pantalones", parent: "mujer", name: "Pantalones", items: [
    ["Pantalón recto Senda", 72000, "Tiro medio, pierna recta y bolsillos laterales. El corte aporta comodidad sin perder estructura."],
    ["Jean recto Índigo", 78000, "Denim de tacto firme con cinco bolsillos y pierna recta. Un esencial para repetir todos los días."],
    ["Pantalón sastrero Prisma", 84000, "Cintura definida y caída recta. Su tejido acompaña conjuntos de trabajo y ocasiones especiales."],
    ["Pantalón crepé Invierno", 89000, "Textura de crepé, corte amplio y terminación cuidada. Una alternativa suave a la sastrería tradicional."],
    ["Jean boyfriend Sur", 76000, "Denim de corte relajado con espacio en cadera y pierna. Se puede llevar con el ruedo doblado."]
  ] },
  { slug: "mujer-tejidos", parent: "mujer", name: "Tejidos", items: [
    ["Polera suave Niebla", 56000, "Cuello alto y tejido flexible. Una primera capa abrigada que conserva una silueta liviana."],
    ["Sweater piqué Arena", 69000, "Tejido con relieve sutil, cuello redondo y calce cómodo. Aporta textura a los conjuntos simples."],
    ["Cardigan abierto Sauce", 74000, "Tejido suave, frente abierto y mangas largas. Una capa fácil para acompañar cambios de temperatura."],
    ["Cardigan recto Sombra", 71000, "Silueta recta y tejido de punto fino. Práctico para combinar con remeras, camisas y vestidos."],
    ["Sweater rayado Faro", 65000, "Rayas de contraste y puños tejidos. Su corte relajado suma una nota gráfica al guardarropa."]
  ] },
  { slug: "mujer-abrigos", parent: "mujer", name: "Abrigos", items: [
    ["Tapado urbano Estación", 149000, "Largo medio, estructura suave y terminaciones prolijas. Un abrigo que completa los looks de invierno."],
    ["Anorak liviano Viento", 119000, "Corte relajado y diseño funcional para superponer. Una capa liviana para media estación."],
    ["Trench fluido Lluvia", 159000, "Silueta larga de caída ligera. El frente amplio permite usarlo abierto o ajustar la cintura."],
    ["Campera con capucha Bosque", 112000, "Una capa suave con capucha y manga larga. Pensada para combinar con básicos del día a día."],
    ["Campera corta Cumbre", 128000, "Corte a la cadera con volumen contenido. Una prenda fácil de sumar sobre tejidos y camisas."]
  ] },
  { slug: "hombre-camisas", parent: "hombre", name: "Camisas", items: [
    ["Camisa índigo Puerto", 64000, "Algodón de textura suave, manga larga y cuello clásico. Un diseño informal con detalles cuidados."],
    ["Camisa clásica Origen", 58000, "Corte recto, botones al frente y puños ajustables. Un esencial para combinar con chinos o jeans."],
    ["Camisa de vestir Noche", 79000, "Cuello definido y frente prolijo. La silueta acompaña conjuntos de sastrería sin restringir el movimiento."],
    ["Camisa relajada Sendero", 62000, "Manga larga y caída cómoda. Se puede llevar cerrada o abierta sobre una remera."],
    ["Camisa textura Trama", 68000, "Tejido con relieve ligero y corte regular. La textura aporta interés a un diseño simple."]
  ] },
  { slug: "hombre-remeras", parent: "hombre", name: "Remeras", items: [
    ["Remera henley Taller", 36000, "Cuello con botones y corte cómodo. Una alternativa al básico de cuello redondo."],
    ["Remera textura Muelle", 39000, "Tejido con textura ligera y terminaciones suaves. Pensada para repetir en distintas combinaciones."],
    ["Remera interlock Base", 33000, "Jersey de tacto suave y estructura firme. Su corte regular funciona como primera capa."],
    ["Remera cuello V Línea", 31000, "Escote en V y manga corta. Una silueta sencilla que acompaña conjuntos informales."],
    ["Remera clásica Norte", 32000, "Cuello redondo y manga corta con detalle gráfico. Un básico cómodo para el fin de semana."]
  ] },
  { slug: "hombre-polos", parent: "hombre", name: "Polos", items: [
    ["Polo bolsillo Paseo", 44000, "Cuello clásico, tapeta corta y bolsillo en el pecho. Una prenda cómoda de corte regular."],
    ["Polo esencial Bahía", 46000, "Manga corta y cuello tejido. Una base prolija para combinar con pantalones de algodón."],
    ["Polo deportivo Circuito", 52000, "Corte cómodo y detalles de inspiración deportiva. Se adapta a looks urbanos relajados."],
    ["Polo piqué Club", 49000, "Textura piqué con bolsillo y terminaciones en cuello y mangas. Pensado para usar a diario."],
    ["Polo regular Costa Sur", 47000, "Tapeta con botones y manga corta. Una alternativa simple para conjuntos de media estación."]
  ] },
  { slug: "hombre-pantalones", parent: "hombre", name: "Pantalones", items: [
    ["Pantalón casual Recorrido", 69000, "Pierna recta y bolsillos funcionales. Un pantalón cómodo para moverte durante el día."],
    ["Pantalón ajustable Calma", 71000, "Cintura con ajuste y corte relajado. Ideal para combinar con prendas de algodón."],
    ["Pantalón textura Cauce", 82000, "Tejido con relieve y silueta regular. La textura suma profundidad a los conjuntos neutros."],
    ["Pantalón amplio Plaza", 78000, "Corte amplio de caída suave. Una alternativa cómoda para llevar con camisas o remeras."],
    ["Pantalón recto Distrito", 75000, "Tiro medio y línea limpia. Un diseño versátil para un guardarropa urbano."]
  ] },
  { slug: "hombre-tejidos", parent: "hombre", name: "Tejidos", items: [
    ["Cardigan cuello chal Refugio", 92000, "Cuello envolvente y frente abierto. Una capa de punto para sumar sobre camisas y remeras."],
    ["Sweater piqué Terreno", 72000, "Punto con textura, cuello redondo y mangas largas. Cómodo para el uso de todos los días."],
    ["Sweater cuello redondo Giro", 79000, "Tejido de punto fino y silueta regular. Una pieza fácil de combinar con sastrería informal."],
    ["Sweater geométrico Norte Alto", 84000, "Tejido con motivo geométrico y corte cómodo. El diseño aporta carácter a conjuntos simples."],
    ["Sweater liviano Valle", 76000, "Punto suave de peso medio y terminaciones tejidas. Una capa versátil para media estación."]
  ] },
  { slug: "hombre-abrigos", parent: "hombre", name: "Abrigos", items: [
    ["Blazer dos botones Urbano", 149000, "Solapas clásicas, cierre de dos botones y corte regular. Sastrería fácil para el día a día."],
    ["Sobrecamisa de trabajo Taller", 109000, "Bolsillos al frente y tejido de estructura firme. Se puede usar como camisa o capa exterior."],
    ["Blazer tres botones Archivo", 159000, "Frente de tres botones y líneas definidas. Una propuesta clásica con silueta cómoda."],
    ["Campera media estación Norte", 129000, "Corte a la cadera y mangas largas. Una capa funcional para acompañar el cambio de temporada."],
    ["Blazer moderno Andén", 155000, "Solapas simples y terminaciones cuidadas. Pensado para combinar con pantalones rectos o denim."]
  ] }
];

const productCollections: Collection[] = [
  { slug: "decoracion-objetos", parent: "decoracion", name: "Objetos y floreros", option: ["Terminación", ["Mate", "Satinada"]], items: [
    ["Florero cerámico Luna", 28000, "Silueta redondeada de cerámica. Funciona como objeto decorativo o para acompañar un pequeño ramo."],
    ["Florero de vidrio Claro", 24000, "Vidrio transparente de líneas simples. Una pieza versátil para flores frescas o ramas secas."],
    ["Florero artesanal Marea", 34000, "Vidrio de formas suaves con una presencia escultórica. Ideal como centro de mesa."],
    ["Candelabro minimal Arco", 21000, "Una pieza de líneas definidas para sostener una vela. Se puede combinar en pares de distinta altura."],
    ["Portavela metálico Bronce", 26000, "Terminación metálica y base estable. Aporta una nota cálida a estantes y mesas auxiliares."]
  ] },
  { slug: "decoracion-textiles", parent: "decoracion", name: "Textiles y láminas", items: [
    ["Funda de almohadón Botánica", 19500, "Diseño con motivo botánico y formato cuadrado. Incluye funda desmontable; relleno no incluido."],
    ["Funda de almohadón Trama", 22000, "Una funda de textura suave para renovar el sillón. Cierre discreto y costuras cuidadas."],
    ["Manta tejida Refugio", 49000, "Textil suave para acompañar el sillón o el pie de cama. Una capa ligera que suma textura."],
    ["Lámina mapa Ciudad", 18000, "Una composición gráfica inspirada en mapas urbanos. Se entrega sin marco para elegir la presentación."],
    ["Marco magnético Línea", 25000, "Sistema de varillas para colgar láminas sin un marco tradicional. Un formato liviano y fácil de instalar."]
  ] },
  { slug: "cocina-vajilla", parent: "cocina", name: "Vajilla", option: ["Presentación", ["Unidad", "Set de 2"]], items: [
    ["Taza de porcelana Alba", 14500, "Taza de líneas sencillas para café con leche. Terminación lisa y asa cómoda."],
    ["Azucarera cerámica Nube", 17500, "Recipiente con tapa para acompañar el servicio de té o café. Diseño compacto para la mesa."],
    ["Ensaladera gres Tierra", 32000, "Bol amplio de gres esmaltado. Ideal para ensaladas, frutas o platos para compartir."],
    ["Plato de porcelana Origen", 16000, "Plato de uso diario con borde suave. Se combina con piezas lisas o vajilla de color."],
    ["Bowl cerámico Ritual", 13500, "Formato pequeño para cereales, postres o preparaciones individuales. Una pieza práctica para todos los días."]
  ] },
  { slug: "cocina-preparacion", parent: "cocina", name: "Preparación y servicio", items: [
    ["Tetera de diseño Pausa", 39000, "Una pieza para preparar y servir té en la mesa. Tapa desmontable y asa de agarre cómodo."],
    ["Cafetera de filtro Ritual", 68000, "Formato de jarra para preparar café filtrado. Se desmonta para facilitar la limpieza."],
    ["Jarra térmica Mesa", 59000, "Jarra con tapa para servir bebidas calientes. Su formato se integra a la mesa de desayuno."],
    ["Tabla con bandeja Encuentro", 42000, "Tabla de madera con bandeja de servicio. Ideal para presentar quesos, pan y pequeñas preparaciones."],
    ["Jarra de agua Fresca", 36000, "Una jarra de líneas curvas para llevar agua a la mesa. Diseño simple de uso cotidiano."]
  ] },
  { slug: "organizacion-contenedores", parent: "organizacion", name: "Cajas y contenedores", option: ["Formato", ["Individual", "Dúo"]], items: [
    ["Contenedor cerámico Orden", 23000, "Recipiente con tapa para organizar pequeños objetos o ingredientes secos. Terminación de fácil limpieza."],
    ["Frasco vidrio y corcho Aire", 19000, "Vidrio transparente con tapa de corcho. Permite ver el contenido sin abrir el recipiente."],
    ["Caja organizadora Brote", 45000, "Contenedor de diseño modular para reunir objetos de uso frecuente. Se puede ubicar en muebles o estantes."],
    ["Caja cerámica Trazo", 26000, "Una caja con tapa y detalle gráfico. Pensada para ordenar pequeños accesorios en la mesa o la cocina."],
    ["Organizador de escritorio Tiempo", 31000, "Soporte para mantener a mano objetos pequeños. Una pieza de diseño para escritorio o mesa de luz."]
  ] },
  { slug: "organizacion-muebles", parent: "organizacion", name: "Muebles y estantes", option: ["Acabado", ["Natural", "Oscuro"]], items: [
    ["Aparador modular Senda", 389000, "Mueble bajo de guardado con líneas simples. Combina espacio cerrado con una superficie de apoyo."],
    ["Estantería abierta Vertical", 159000, "Estantes abiertos para libros, plantas y objetos. Un formato ligero para organizar el living."],
    ["Vitrina vidrio y metal Prisma", 249000, "Mueble de guardado con frente de vidrio. Permite organizar y exhibir piezas de uso diario."],
    ["Estante de pared Giro", 68000, "Una repisa de pared de formato compacto. Ideal para sumar guardado en espacios pequeños."],
    ["Cajonera compacta Cubo", 229000, "Mueble con cajones para ordenar objetos fuera de la vista. Superficie superior útil como apoyo."]
  ] },
  { slug: "iluminacion-mesa", parent: "iluminacion", name: "Lámparas de mesa y pie", option: ["Color", ["Negro", "Blanco"]], items: [
    ["Lámpara de mesa Dynamo", 79000, "Pantalla orientable y base compacta. Una luz puntual para escritorios y mesas de lectura."],
    ["Lámpara de mesa Twist", 89000, "Silueta de líneas curvas y base estable. Una pieza que ilumina y acompaña la decoración."],
    ["Lámpara de mesa Urban", 84000, "Diseño de pantalla simple para luz de apoyo. Ideal para mesas auxiliares o de noche."],
    ["Lámpara de pie Dynamo", 149000, "Formato de pie con pantalla orientable. Pensada para crear un rincón de lectura."],
    ["Lámpara de pie Urban", 159000, "Una luminaria de líneas limpias para el living. Se combina con las piezas de mesa de la colección."]
  ] },
  { slug: "iluminacion-colgantes", parent: "iluminacion", name: "Lámparas colgantes", option: ["Color", ["Grafito", "Blanco"]], items: [
    ["Colgante Bloom", 109000, "Pantalla de forma orgánica para iluminación central. Ideal para mesas y rincones de encuentro."],
    ["Colgante Dynamo 32", 119000, "Pantalla amplia de líneas simples. Aporta una luz definida sobre la mesa de comedor."],
    ["Colgante Mini 16", 69000, "Luminaria compacta para colocar sola o en una serie. Una opción para barras y mesas auxiliares."],
    ["Colgante Urban 24", 99000, "Una pantalla de tamaño medio con perfil suave. Se integra a cocinas y comedores."],
    ["Colgante Urban Mini", 74000, "Formato pequeño para iluminar espacios puntuales. Combina con otras piezas de la línea Urban."]
  ] },
  { slug: "audio-auriculares", parent: "audio", name: "Auriculares", option: ["Color", ["Negro", "Plata"]], items: [
    ["Auriculares inalámbricos Pulse", 189000, "Formato de vincha con almohadillas envolventes. Una propuesta para escuchar música durante el día."],
    ["Auriculares de viaje Silence", 249000, "Diseño cerrado y ajuste de vincha. Pensados para acompañar sesiones largas de escucha."],
    ["Auriculares con base Home", 159000, "Conjunto de auriculares y base para uso en casa. Una solución cómoda para audio personal."],
    ["Auriculares Bluetooth Move", 179000, "Formato inalámbrico con controles integrados. Su diseño liviano acompaña el uso cotidiano."],
    ["Auriculares envolventes Studio", 219000, "Vincha ajustable y almohadillas amplias. Pensados para disfrutar música con comodidad."]
  ] },
  { slug: "audio-parlantes", parent: "audio", name: "Parlantes", option: ["Color", ["Negro", "Blanco"]], items: [
    ["Parlante inalámbrico Room", 229000, "Formato compacto de sobremesa para llevar música al living. Diseño discreto y controles simples."],
    ["Parlante compacto Corner", 169000, "Una pieza de audio pequeña para estantes o escritorio. Pensada para espacios cotidianos."],
    ["Parlante de mesa Sound 20", 199000, "Diseño de sobremesa y frente texturado. Una propuesta para integrar audio y decoración."],
    ["Parlante de living Sound 50", 329000, "Formato amplio para ubicar sobre un mueble. Una pieza central para el rincón de música."],
    ["Parlante portátil Escape", 149000, "Diseño compacto para acompañar distintos espacios. Fácil de ubicar en una mesa o estante."]
  ] },
  { slug: "tecnologia-movil", parent: "tecnologia", name: "Accesorios móviles", items: [
    ["Batería recargable Studio", 59000, "Una batería de repuesto para equipos compatibles. Revisá el formato de conexión antes de elegir."],
    ["Cargador de pared Connect", 29000, "Adaptador de alimentación para uso cotidiano. Incluye el adaptador; el cable se elige por separado."],
    ["Batería magnética Go", 79000, "Formato compacto para acompañar dispositivos compatibles. Una propuesta para sumar energía fuera de casa."],
    ["Funda de silicona Plum", 24000, "Funda de tacto suave con acceso a botones. Consultá la compatibilidad del modelo antes de elegir."],
    ["Monopie móvil Travel", 39000, "Soporte extensible para fotografía con dispositivos móviles. Un accesorio fácil de transportar."]
  ] },
  { slug: "tecnologia-estudio", parent: "tecnologia", name: "Estudio y soportes", items: [
    ["Micrófono de escritorio Voice", 129000, "Micrófono compacto con base para escritorio. Un formato cómodo para conversaciones y grabación."],
    ["Micrófono para cámara Focus", 189000, "Formato direccional para montar en equipos compatibles. Revisá la conexión de tu cámara."],
    ["Micrófono de solapa Clip", 89000, "Diseño pequeño para sujetar a la ropa. Una solución discreta para grabaciones con dispositivos compatibles."],
    ["Soporte de pie Screen", 119000, "Una base de apoyo para pantallas compatibles. Verificá medidas y montaje antes de instalar."],
    ["Soporte de pared Slim", 69000, "Sistema de pared para pantallas compatibles. Incluye soporte; instalación no incluida."]
  ] }
];

export const demoCustomerNames = ["Lucía Fernández", "Mateo Suárez", "Valentina Romero", "Santiago Pérez", "Camila Torres", "Joaquín Medina", "Sofía Acosta", "Tomás Ríos", "Martina Silva", "Nicolás Vega"];

// Illustrative dimensions and compatibility are authored with each demo product, not live manufacturer claims.
const productSpecifications: Partial<Record<GalleryKey, string[]>> = {
  "decoracion-objetos": ["Cerámica · Alto: 18 cm · Boca: 7 cm", "Vidrio · Alto: 24 cm · Diámetro: 12 cm", "Vidrio · Alto: 20 cm · Diámetro: 14 cm", "Metal · Alto: 22 cm · Para una vela de 2 cm", "Metal · Alto: 12 cm · Diámetro de base: 9 cm"],
  "decoracion-textiles": ["Funda de algodón · 50 × 50 cm · Sin relleno", "Funda tejida · 45 × 45 cm · Sin relleno", "Tejido suave · 130 × 170 cm", "Papel ilustración · 30 × 40 cm · Sin marco", "Varillas magnéticas · Ancho: 40 cm · Cordón incluido"],
  "cocina-vajilla": ["Porcelana · Capacidad: 300 ml", "Cerámica · Capacidad: 250 ml", "Gres · Diámetro: 24 cm · Capacidad: 2 litros", "Porcelana · Diámetro: 26 cm", "Cerámica · Diámetro: 14 cm · Capacidad: 450 ml"],
  "cocina-preparacion": ["Capacidad: 800 ml · Tapa desmontable", "Capacidad: 1 litro · Filtro reutilizable", "Capacidad: 1 litro · Tapa dosificadora", "Tabla: 35 × 20 cm · Bandeja desmontable", "Capacidad: 1,2 litros · Asa de agarre"],
  "organizacion-contenedores": ["Capacidad: 700 ml · Alto: 15 cm", "Capacidad: 1 litro · Tapa de corcho", "Caja modular · 30 × 20 × 18 cm", "Caja con tapa · 14 × 10 × 8 cm", "Base de madera · 18 × 10 × 12 cm"],
  "organizacion-muebles": ["120 × 40 × 70 cm · Entrega armada", "65 × 30 × 160 cm · Estantes abiertos", "80 × 35 × 120 cm · Frente de vidrio", "60 × 20 cm · Fijación a pared", "60 × 40 × 70 cm · Tres cajones"],
  "iluminacion-mesa": ["Alto: 45 cm · Rosca E27", "Alto: 38 cm · Rosca E27", "Alto: 42 cm · Rosca E14", "Alto: 140 cm · Rosca E27", "Alto: 150 cm · Rosca E27"],
  "iluminacion-colgantes": ["Diámetro: 30 cm · Cable: 150 cm", "Diámetro: 32 cm · Cable: 150 cm", "Diámetro: 16 cm · Cable: 120 cm", "Diámetro: 24 cm · Cable: 150 cm", "Diámetro: 15 cm · Cable: 120 cm"],
  "audio-auriculares": ["Conexión inalámbrica · Vincha ajustable · Cable de carga incluido", "Formato envolvente · Vincha ajustable · Estuche incluido", "Base de conexión para uso doméstico · Alimentación incluida", "Conexión Bluetooth · Controles en la vincha", "Formato cerrado · Almohadillas suaves · Cable incluido"],
  "audio-parlantes": ["Sobremesa · 24 × 16 × 12 cm · Alimentación incluida", "Formato compacto · 15 × 15 × 12 cm", "Sobremesa · 18 × 18 × 13 cm", "Living · 40 × 20 × 15 cm", "Compacto · 22 × 14 × 12 cm"],
  "tecnologia-movil": ["Batería para equipo de audio compatible · Formato: 6 × 3 × 2 cm", "Adaptador de pared · Puerto USB · Cable no incluido", "Batería de conexión magnética · Para dispositivos compatibles", "Funda para formato iPhone 12 · Color ciruela", "Soporte extensible · Altura: 30 a 100 cm · Adaptador móvil incluido"],
  "tecnologia-estudio": ["Micrófono digital de sobremesa · Base incluida", "Micrófono para cámara · Montaje superior · Cable incluido", "Micrófono de solapa · Clip incluido · Conexión móvil", "Base para pantalla compatible · Montaje posterior", "Soporte para pantalla compatible · Fijación a pared"]
};

export function demoPhoto(id: string, width = 1600) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
}

export function buildDemoCatalog(kind: DemoKind) {
  const clothing = kind === "clothing";
  const collections = clothing ? clothingCollections : productCollections;
  const roots = clothing ? [["mujer", "Mujer"], ["hombre", "Hombre"]] : [
    ["decoracion", "Decoración"], ["cocina", "Cocina"], ["organizacion", "Organización"],
    ["iluminacion", "Iluminación"], ["audio", "Audio"], ["tecnologia", "Tecnología"]
  ];
  const categories = [
    ...roots.map(([slug, name]) => ({ slug, name, parentSlug: null as string | null, imageUrl: galleries[collections.find(c => c.parent === slug)!.slug][0].images[0] })),
    ...collections.map(c => ({ slug: c.slug as string, name: c.name, parentSlug: c.parent as string | null, imageUrl: galleries[c.slug][0].images[0] })),
    { slug: "novedades", name: "Novedades", parentSlug: null, imageUrl: galleries[collections[2].slug][0].images[0] },
    { slug: "ofertas", name: "Ofertas", parentSlug: null, imageUrl: galleries[collections[0].slug][0].images[0] }
  ];
  const products = collections.flatMap((collection, collectionIndex) => collection.items.map(([name, basePrice, details], itemIndex) => {
    const index = collectionIndex * 5 + itemIndex;
    const imageUrls = galleries[collection.slug][itemIndex].images;
    const specifications = clothing
      ? collection.slug.includes("pantalones") ? "Guía orientativa: 38: cintura 72–76 cm; 40: 77–81 cm; 42: 82–86 cm; 44: 87–91 cm. Medí una prenda de calce similar antes de elegir."
        : "Guía orientativa: S: pecho 88–94 cm; M: 95–101 cm; L: 102–108 cm; XL: 109–115 cm. Las medidas son de contorno corporal."
      : productSpecifications[collection.slug]![itemIndex] + (collection.parent === "iluminacion" ? " · Lámpara para 220 V · Bombilla no incluida" : "");
    const promoPrice = index % 4 === 0 ? Math.round(basePrice * .8) : null;
    const groups = clothing ? [
      { name: "Talle", selectionType: "SINGLE" as const, options: (collection.slug.includes("pantalones") ? ["38", "40", "42", "44"] : ["S", "M", "L", "XL"]).map(name => ({ name })) },
      { name: "Color", selectionType: "SINGLE" as const, options: ["Natural", "Negro", "Azul"].map(name => ({ name })) }
    ] : collection.option ? [{ name: collection.option[0], selectionType: "SINGLE" as const, options: collection.option[1].map(name => ({ name })) }] : [];
    const variants = variantCombinations(groups).map(({ key }, variantIndex) => {
      const regular = basePrice + (variantIndex === 1 && !clothing ? Math.round(basePrice * .15) : 0);
      return {
        key, basePrice: regular, promoPrice: promoPrice === null ? null : Math.round(regular * .8),
        stockQuantity: index >= 58 ? 0 : index >= 55 ? 3 : variantIndex === 2 && index % 7 === 0 ? 0 : 18 + index % 9,
        isVisible: !(index === 11 && variantIndex === 3), imageUrl: imageUrls[variantIndex % imageUrls.length], imageIndex: variantIndex % imageUrls.length
      };
    });
    return {
      name, slug: index === 0 && clothing ? "camisa-lino" : index === 34 && clothing ? "remera-clasica" : slugify(name),
      description: `${details}\n\n${specifications}\n\n${clothing ? "Cuidados: lavar con agua fría, secar a la sombra y evitar el blanqueador." : "Cuidados: limpiar con un paño suave y seguir las indicaciones de uso. Consultá medidas y compatibilidad antes de elegir."}\n\nProducto de demostración: características, precios y disponibilidad son ficticios.`,
      categorySlug: collection.slug, assignedSlugs: [collection.slug, ...(index % 3 === 0 ? ["novedades"] : []), ...(promoPrice !== null ? ["ofertas"] : [])],
      basePrice, promoPrice, imageUrls, sku: `${clothing ? "NORTE" : "NEXO"}-${String(index + 1).padStart(3, "0")}`,
      stockQuantity: variants.length ? null : index >= 58 ? 0 : index >= 55 ? 3 : index === 49 ? null : 28 + index % 12,
      variants, groups, isVisible: true, isFeatured: index % 5 === 0, freeShipping: !clothing && [25, 27, 45].includes(index), sortOrder: index
    };
  }));
  return { categories, products, rootSlugs: roots.map(([slug]) => slug) };
}

export function demoCommerce(kind: DemoKind) {
  const clothing = kind === "clothing";
  const freeAbove = clothing ? 150000 : 200000;
  const address = `${clothing ? "Showroom NORTE" : "Espacio NEXO"} de demostración · Palermo, CABA`;
  const checkoutSettings = checkoutSettingsSchema.parse({
    showFreeShippingProgress: true, showLowStock: true, requirePhone: true, allowNotes: true,
    transferDiscountPercent: 10, cashDiscountPercent: 0, acceptSellerPayment: true,
    paymentMethods: [
      { ...createPaymentMethod("cash", "demo-cash"), name: "Efectivo al retirar", discountPercent: 0, description: "Probá el pago al retirar en nuestro showroom demo.", instructions: "Pedido de demostración. No se cobra ni se entrega mercadería real." },
      { ...createPaymentMethod("transfer", "demo-transfer"), name: "Transferencia · 10% de descuento", discountPercent: 10, accountHolder: "CUENTA FICTICIA DE DEMOSTRACIÓN", provider: "Banco de demostración", alias: "DEMO.NO.TRANSFERIR", description: "Simulá una transferencia con 10% de descuento. No realices pagos reales.", instructions: "Los datos bancarios son ficticios. No realices transferencias. Este pedido sirve únicamente para explorar la demo.", requestReceipt: false },
      { ...createPaymentMethod("seller", "demo-seller"), name: "A convenir", description: "Explorá el flujo de pago coordinado con la tienda.", instructions: "Pedido ficticio. La tienda demo no procesa compras reales." }
    ]
  });
  const deliveryMethods = [
    deliveryMethodSchema.parse({ id: "demo-pickup", type: "pickup", name: "Retiro en showroom", price: 0, enabled: true, description: "Retiro gratuito en el espacio de demostración.", pickupDetails: `${address}. Lunes a viernes de 10 a 19 h; sábados de 10 a 14 h. Dirección ficticia.` }),
    deliveryMethodSchema.parse({ id: "demo-shipping", type: "custom", name: "Envío a domicilio", price: clothing ? 6500 : 7900, enabled: true, description: "Envío de demostración a todo el país.", freeShippingEnabled: true, freeAbove, deliveryTimeEnabled: true, estimatedTime: "De 3 a 5 días hábiles", minDays: 3, maxDays: 5 })
  ];
  return { checkoutSettings, deliveryMethods, freeAbove, address };
}

export function demoDesign(kind: DemoKind) {
  return designConfigSchema.parse({
    font: "template", productImageRatio: kind === "clothing" ? "portrait" : "square", productImageFit: kind === "clothing" ? "cover" : "contain",
    cardRadius: kind === "clothing" ? 0 : 12, quickBuyEnabled: true, floatingCartEnabled: true, showSku: true,
    footerText: "Tienda de demostración. Catálogo, clientes, pedidos, dirección y medios de pago ficticios. No se realizan ventas ni envíos reales.",
    footerColors: { mode: "primary" }, announcementColors: { mode: "primary" }
  });
}

export function demoMenu() {
  // Storefront navigation derives category branches automatically; use its supported page routes.
  return menuConfigSchema.parse({ header: [{ label: "Inicio", href: "/" }, { label: "Productos", href: "/productos" }, { label: "Contacto", href: "/contacto" }], footer: [{ label: "Inicio", href: "/" }, { label: "Productos", href: "/productos" }, { label: "Contacto", href: "/contacto" }] });
}

export function demoHome(kind: DemoKind, categoryIds: Map<string, string>, productIds: Map<string, string>) {
  const clothing = kind === "clothing";
  const catalog = buildDemoCatalog(kind);
  const resolve = (map: Map<string, string>, slug: string) => { const id = map.get(slug); if (!id) throw new Error(`Referencia demo inexistente: ${slug}`); return id; };
  const hero = createHomeSection("banners", "demo-hero");
  const desktop = demoPhoto(clothing ? "photo-1445205170230-053b83016050" : "photo-1600210492486-724fe5c67fb0");
  hero.bannerHeight = "large";
  hero.bannerAutoplay = false;
  hero.bannerItems = [
    { ...createBannerItem(desktop, "hero-desktop"), desktop: true, mobile: false, title: clothing ? "Vestir el ahora." : "Tu espacio, a tu manera.", description: clothing ? "Prendas para acompañarte. Descubrí la colección de mujer y hombre." : "Diseño para tu hogar. Tecnología para tu día a día.", link: "/productos", position: "middle-left", backgroundColor: "#00000099" },
    { ...createBannerItem(clothing ? catalog.products[10].imageUrls[0] : desktop, "hero-mobile"), desktop: false, mobile: true, title: clothing ? "Vestir el ahora." : "Tu espacio, a tu manera.", description: clothing ? "Descubrí tu próxima prenda favorita." : "Hogar y tecnología con personalidad.", link: "/productos", position: "bottom-left", backgroundColor: "#000000B3", fitBackgroundToText: true }
  ];
  const benefits = createHomeSection("purchaseInfo", "demo-benefits");
  benefits.infoColors.mode = "secondary";
  benefits.infoItems = [
    { icon: "truck", title: "Envío gratis", text: `Desde $${clothing ? "150.000" : "200.000"} en compras` },
    { icon: "transfer", title: "10% con transferencia", text: "Explorá los descuentos del checkout" },
    { icon: "store", title: "Retiro sin costo", text: "En nuestro showroom de demostración" },
    { icon: "return", title: clothing ? "Cambios de talle" : "Comprá con información", text: clothing ? "Guía de talles y política de cambios" : "Medidas, variantes y detalles en cada ficha" }
  ];
  const categories = createHomeSection("featuredCategories", "demo-categories");
  categories.categoryLayout = clothing ? "four-top" : "three-even";
  categories.categorySpacing = "normal";
  categories.categoryColors = { mode: "primary", background: "#ffffff", text: "#242424" };
  const tiles = clothing ? ["mujer", "hombre", "mujer-tejidos", "hombre-abrigos"] : catalog.rootSlugs;
  categories.categoryIds = tiles.map(slug => resolve(categoryIds, slug));
  categories.categoryTiles = tiles.map((slug, i) => ({ id: `tile-${i}`, categoryId: resolve(categoryIds, slug), title: catalog.categories.find(c => c.slug === slug)!.name, imageUrl: catalog.categories.find(c => c.slug === slug)!.imageUrl }));
  categories.categoryImages = Object.fromEntries(categories.categoryTiles.map(t => [t.categoryId, t.imageUrl]));
  const group = (id: string, title: string, indices: number[], layout: "grid" | "carousel") => ({
    ...createHomeSection("productGroup", id), title, layout, productIds: indices.map(index => resolve(productIds, catalog.products[index].slug))
  });
  const campaign = createHomeSection("banners", "demo-campaign");
  campaign.bannerHeight = "medium";
  campaign.bannerAutoplay = false;
  campaign.bannerItems = [{ ...createBannerItem(demoPhoto(clothing ? "photo-1490481651871-ab68de25d43d" : "photo-1556912172-45b7abe8b7e1"), "campaign"), title: clothing ? "Menos vueltas. Más estilo." : "El placer de lo cotidiano.", description: clothing ? "Descubrí los esenciales que combinan con vos." : "Objetos que hacen de tu casa tu lugar favorito.", link: clothing ? "/productos?categoria=hombre" : "/productos?categoria=cocina", position: "middle-left", backgroundColor: "#000000B3", fitBackgroundToText: true }];
  return publicPageConfigSchema.parse({
    version: 3, homeSections: [hero, benefits, categories, group("demo-featured", clothing ? "Esenciales de temporada" : "Elegidos para tu espacio", [0, 5, 10, 15, 20, 25, 30, 35], "grid"), campaign,
      group("demo-new", "Recién llegados", [3, 9, 12, 18, 24, 33, 39, 45], "carousel"), group("demo-offers", "Oportunidades para aprovechar", [0, 8, 16, 24, 32, 40, 48, 52], "grid")],
    announcement: { enabled: true, text: "TIENDA DEMO · 10% con transferencia · No realices pagos reales" },
    info: { enabled: true, shipping: `Envíos ficticios de 3 a 5 días hábiles. Gratis desde $${clothing ? "150.000" : "200.000"}. Retiro gratuito en showroom.`, returns: "Política ficticia: cambios dentro de los 30 días con el producto sin uso y su embalaje. Esta demo no procesa devoluciones reales.", sizeGuide: clothing ? "Referencia demo: S: pecho 88–94 cm; M: 95–101 cm; L: 102–108 cm; XL: 109–115 cm. Pantalones: 38: cintura 72–76 cm; 40: 77–81 cm; 42: 82–86 cm; 44: 87–91 cm. Las medidas son orientativas; verificá el calce de cada prenda." : "Consultá el formato, las medidas y las opciones de cada producto. En accesorios tecnológicos revisá siempre la conexión y la compatibilidad. Los datos de esta tienda son ilustrativos." },
    socials: { instagram: `https://example.invalid/${clothing ? "norte" : "nexo"}/instagram`, tiktok: "", facebook: "" },
    featuredTitle: clothing ? "Esenciales de temporada" : "Elegidos para tu espacio", categoriesTitle: clothing ? "Tu próximo look empieza acá" : "Explorá tu mundo"
  });
}
