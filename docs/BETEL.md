# Betel · Indumentaria & Hogar

Tienda real sobre la plantilla Dana, publicada en `/betel`, con categorías Indumentaria y Hogar. Se inicializó sin productos; en la verificación actual el catálogo contiene `SHORT DE JEAN`, incorporado fuera de esta actualización de banners. El correo titular es `estefaniadaianagomez@gmail.com`; también aparece en la página de contacto existente. WhatsApp: +54 381 348-8267.

Esta documentación describe la configuración de Betel y su extensión de los componentes existentes. `DESIGN.md` y `.impeccable/design.json` continúan documentando Strom; Betel conserva la tipografía, los layouts y el editor de Dana.

## Estado de la entrega

[Betel está publicada](https://catalogo-web-ar.vercel.app/betel), con respuesta HTTP 200 verificada. La cuenta titular, las categorías, la configuración y el logo están publicados. Los banners actuales muestran fotografías de indumentaria alojadas en R2; su lectura pública se verificó byte por byte contra los JPEG locales antes de actualizar la configuración de producción. El logo original suministrado por el comercio se conserva sin cambios; su hash se verificó en la entrega inicial.

La entrega inicial revisó localmente las correcciones compartidas de Contacto, color del copyright, placeholders y fondo del banner personalizado de Dana en móvil. Sus capturas no acreditaban el despliegue de ese código. La actualización actual de fotografías se aplicó a los datos de Betel y se verificó directamente en producción; no requirió un nuevo despliegue de la aplicación.

## Configuración

| Ajuste | Valor |
| --- | --- |
| Fondo | Crema `#F8EDE2` |
| Principal | Cobre oscuro `#8C4F37` |
| Secundario | Rosa `#D5A095` |
| Texto | Marrón `#4B2415` |
| Tipografía | Serif de Dana, Libre Baskerville |
| Logo | Original del comercio, 96 px, conservado sin cambios |
| Cabecera / pie | Crema / rosa |
| Productos | Imagen vertical, radio 8 px, dos columnas en móvil |

Los contrastes de texto sobre crema, blanco sobre cobre y texto sobre rosa son 11,65:1, 6,39:1 y 5,95:1. El banner tiene altura media, texto marrón y una superficie crema al 95 % (`#F8EDE2F2`) ajustada al texto. El texto se ubica a media altura a la izquierda en escritorio y arriba al centro en móvil. Título, descripción y enlace al catálogo se conservan y siguen editándose desde el panel. Las categorías destacadas quedan deshabilitadas hasta contar con imágenes. El grupo de productos se oculta cuando el catálogo está vacío.

La versión local revisada en la entrega inicial incluía el enlace estándar a Contacto en la navegación compartida, el menú móvil y el pie, con los menús personalizados retirados. También corregía el color de los textos pequeños del pie y los placeholders y el fondo de los banners personalizados de Dana en móvil. La revisión actual se limita a los banners.

Pagos, entregas, descuentos, envío gratis y pedidos por WhatsApp quedan deshabilitados hasta que el titular configure las condiciones reales. Los enlaces de contacto por WhatsApp están disponibles. No se cargan pedidos, clientes ni productos ficticios.

## Fotografías del banner

| Dispositivo | Fuente | JPEG publicado |
| --- | --- | --- |
| Escritorio | [Jessica Povoa · Pexels 24380104](https://www.pexels.com/photo/brown-and-beige-skirts-hanging-on-coathangers-24380104/) | 2000 × 800 px |
| Móvil | [RDNE Stock project · Pexels 8581406](https://www.pexels.com/photo/clothes-hanging-on-a-clothing-rack-8581406/) | 1000 × 1200 px |

Se usan bajo la [licencia de Pexels](https://www.pexels.com/license/) como imágenes ilustrativas de indumentaria, sin atribuir esas prendas al inventario del comercio. Las fuentes y dimensiones están en [`prisma/betel-banners.ts`](../prisma/betel-banners.ts); los archivos [`desktop.jpg`](../prisma/betel-assets/desktop.jpg) y [`mobile.jpg`](../prisma/betel-assets/mobile.jpg) llevan procedencia incrustada en comentarios JPEG mediante `Impeccable embed-prompt`. El escaneo de procedencia encontró dos imágenes y ninguna sin metadatos.

El actualizador [`scripts/update-betel-banners.ts`](../scripts/update-betel-banners.ts) se ejecuta con `pnpm betel:banners` para validar la identidad y los banners sin escribir. `pnpm betel:banners --apply` carga las fotos con claves basadas en su hash, verifica sus bytes por HTTPS y actualiza únicamente los dos elementos originales `betel-desktop` y `betel-mobile` de `betel-hero` y su presentación. Rechaza una identidad distinta o banners ausentes, renombrados o duplicados, y usa `updatedAt` para evitar sobrescribir cambios concurrentes. Conserva los textos editados, campos futuros, logo, catálogo, credenciales y configuración restante. Los SVG anteriores permanecen en R2.

## Inicialización

La configuración y el alta transaccional están en [`prisma/betel-seed.ts`](../prisma/betel-seed.ts); el comando de ejecución y la carga de imágenes, en [`scripts/seed-betel-tenant.ts`](../scripts/seed-betel-tenant.ts).

Configurar `BETEL_OWNER_PASSWORD` únicamente en el entorno de ejecución y `BETEL_LOGO_PATH` con la ruta al PNG o JPEG original. No guardar la contraseña en archivos del repositorio ni documentarla. Luego ejecutar `pnpm betel:seed`.

El comando usa `DIRECT_URL` si está configurada. Con Prisma Postgres y solo `DATABASE_URL`, utiliza el hostname directo `db.prisma.io` con las mismas credenciales, siguiendo la [documentación de conexiones de Prisma](https://www.prisma.io/docs/postgres/database/connection-pooling); no cambia la conexión de la aplicación. En otros proveedores conserva la URL configurada.

Las imágenes se alojan bajo `logos/<storeId>/` y `hero/<storeId>/`, con claves que incluyen un hash de contenido y metadatos de procedencia. Se comprueba su lectura pública HTTPS antes de publicar la tienda. El logo se sube conservando sus bytes originales. El inicializador sigue usando los fondos SVG definidos en `prisma/betel-seed.ts` para el alta inicial; la actualización de fotografías es un comando separado.

El alta del usuario, la tienda y las categorías se realiza en una transacción con bloqueo exclusivo del inicializador. Un error revierte los cambios de base; los archivos ya subidos a R2 pueden quedar sin referencias si la transacción falla. El comando no sobrescribe objetos existentes. Repetirlo conserva contraseña, estado de publicación, configuración, catálogo y datos comerciales. Un correo o slug asociado a otra identidad aborta antes de escribir o subir imágenes.

## Dirección visual

THESIS: identidad cálida de indumentaria y hogar, con el logo original como firma y la información real del comercio como contenido.

OWN-WORLD: fondo crema, cobre en acciones, marrón en texto y rosa en el pie; tipografía, navegación y componentes de Dana.

STORY: reconocer Betel, explorar el catálogo y encontrar su contacto actual.

FIRST VIEWPORT: logo original centrado en la cabecera y banner de altura media con fotografías de prendas en beige y marrón. En escritorio, encuadre panorámico de una percha de indumentaria; en móvil, un segundo encuadre de prendas y accesorios. El texto editable existente se conserva sobre una superficie crema ajustada al texto, a la izquierda en escritorio y arriba al centro en móvil.

FORM: extensión configurada de Dana; dirección fijada por el logo del usuario y el plan aprobado. No requiere una plantilla nueva.

FINISH: comprobar el resultado en escritorio y móvil y conservar el sistema de Dana. “unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance”. DESIGN.md se conserva porque no cambia el sistema visual.

## Verificación

La revisión final de esta actualización devolvió `SHIP`, sin hallazgos materiales dentro del alcance visual del banner. Las capturas [`betel-banner-desktop.png`](../.impeccable/review/betel-banner-desktop.png) y [`betel-banner-mobile.png`](../.impeccable/review/betel-banner-mobile.png) se generaron directamente contra producción. La revisión de capturas es evidencia visual estática, no una auditoría completa de la tienda.

- 250 pruebas unitarias aprobadas y 24 omitidas. Las cinco nuevas pruebas de transformación cubren conservación, textos personalizados y campos futuros, idempotencia, IDs ausentes o duplicados y URLs HTTPS; pasaron con la configuración final.
- Typecheck y ESLint de los archivos afectados aprobados.
- Dos casos Playwright aprobados contra producción en 3,2 s, en escritorio y móvil: fotos correctas y decodificadas, presentación y texto preservados y ausencia de desborde horizontal.
- Detector de diseño sin hallazgos (`[]`); procedencia completa en ambos JPEG. No se repitió el build completo porque esta actualización no cambia componentes compartidos de ejecución.

Para repetir la verificación pública del banner: `BETEL_QA=1 PLAYWRIGHT_BASE_URL=https://catalogo-web-ar.vercel.app pnpm exec playwright test e2e/betel-banners.spec.ts --workers=1`.

La entrega inicial también obtuvo `SHIP` sobre el código y las capturas locales [`betel-desktop.png`](../.impeccable/review/betel-desktop.png) y [`betel-mobile.png`](../.impeccable/review/betel-mobile.png). En esa etapa pasaron 219 pruebas unitarias, cuatro pruebas de integración en PostgreSQL aislado (rollback, conservación de otros tenants y cambios posteriores, contraseña hasheada y catálogo inicial vacío), cuatro casos E2E de navegación a Contacto e ingreso al panel, build y typecheck. El lint de esa entrega no tuvo errores y registró nueve advertencias preexistentes. Esa evidencia histórica no describe el despliegue actual.

Para repetir los controles de código: `pnpm test`, `pnpm typecheck`, `pnpm lint` y `pnpm build`. La integración requiere `BETEL_SEED_TEST_DATABASE_URL` con una base local nueva llamada `betel_seed_test` o `betel_seed_test_*`, con el esquema aplicado y sin identidades Betel; ejecutar `pnpm exec vitest run tests/betel-seed.integration.test.ts`.

Para los E2E, configurar `BETEL_QA=1`, `PLAYWRIGHT_BASE_URL` de la instancia que contiene Betel y la contraseña del titular solo en `BETEL_OWNER_PASSWORD`; ejecutar `pnpm exec playwright test e2e/betel.spec.ts`. El archivo desactiva las trazas para no registrar las credenciales.
