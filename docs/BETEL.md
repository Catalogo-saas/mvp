# Betel · Indumentaria & Hogar

Tienda real sobre la plantilla Dana, publicada en `/betel`, con categorías Indumentaria y Hogar y sin productos iniciales. El correo titular es `estefaniadaianagomez@gmail.com`; también aparece en la página de contacto existente. WhatsApp: +54 381 348-8267.

Esta documentación describe la configuración de Betel y su extensión de los componentes existentes. `DESIGN.md` y `.impeccable/design.json` continúan documentando Strom; Betel conserva la tipografía, los layouts y el editor de Dana.

## Estado de la entrega

[Betel está publicada](https://catalogo-web-ar.vercel.app/betel), con respuesta HTTP 200 verificada. La cuenta titular, las categorías, la configuración, el logo y los banners ya están publicados. Se comprobó que el hash de los bytes del logo alojado en R2 coincide con el archivo original suministrado por el comercio.

Las correcciones compartidas de Contacto, color del copyright, placeholders y fondo del banner personalizado de Dana en móvil están en la versión local revisada. Requieren el despliegue normal de la aplicación para que producción coincida con las capturas de esta entrega; publicar los datos del tenant no despliega esos cambios de código.

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

Los contrastes de texto sobre crema, blanco sobre cobre y texto sobre rosa son 11,65:1, 6,39:1 y 5,95:1. Los banners son fondos SVG originales; título, descripción y enlace se editan desde el panel. Las categorías destacadas quedan deshabilitadas hasta contar con imágenes. El grupo de productos no se muestra mientras el catálogo está vacío.

La versión local revisada incluye el enlace estándar a Contacto en la navegación compartida, el menú móvil y el pie. Los menús personalizados siguen retirados. Los textos pequeños del pie y los placeholders respetan el color configurado; los banners personalizados de Dana respetan su fondo también en móvil.

Pagos, entregas, descuentos, envío gratis y pedidos por WhatsApp quedan deshabilitados hasta que el titular configure las condiciones reales. Los enlaces de contacto por WhatsApp están disponibles. No se cargan pedidos, clientes ni productos ficticios.

## Inicialización

La configuración y el alta transaccional están en [`prisma/betel-seed.ts`](../prisma/betel-seed.ts); el comando de ejecución y la carga de imágenes, en [`scripts/seed-betel-tenant.ts`](../scripts/seed-betel-tenant.ts).

Configurar `BETEL_OWNER_PASSWORD` únicamente en el entorno de ejecución y `BETEL_LOGO_PATH` con la ruta al PNG o JPEG original. No guardar la contraseña en archivos del repositorio ni documentarla. Luego ejecutar `pnpm betel:seed`.

El comando usa `DIRECT_URL` si está configurada. Con Prisma Postgres y solo `DATABASE_URL`, utiliza el hostname directo `db.prisma.io` con las mismas credenciales, siguiendo la [documentación de conexiones de Prisma](https://www.prisma.io/docs/postgres/database/connection-pooling); no cambia la conexión de la aplicación. En otros proveedores conserva la URL configurada.

Las imágenes se alojan bajo `logos/<storeId>/` y `hero/<storeId>/`, con claves que incluyen un hash de contenido y metadatos de procedencia. Se comprueba su lectura pública HTTPS antes de publicar la tienda. El logo se sube conservando sus bytes originales; el SVG está definido en `prisma/betel-seed.ts`.

El alta del usuario, la tienda y las categorías se realiza en una transacción con bloqueo exclusivo del inicializador. Un error revierte los cambios de base; los archivos ya subidos a R2 pueden quedar sin referencias si la transacción falla. El comando no sobrescribe objetos existentes. Repetirlo conserva contraseña, estado de publicación, configuración, catálogo y datos comerciales. Un correo o slug asociado a otra identidad aborta antes de escribir o subir imágenes.

## Dirección visual

THESIS: identidad cálida de indumentaria y hogar, con el logo original como firma y la información real del comercio como contenido.

OWN-WORLD: fondo crema, cobre en acciones, marrón en texto y rosa en el pie; tipografía, navegación y componentes de Dana.

STORY: reconocer Betel, acceder al catálogo cuando tenga productos y encontrar su contacto actual.

FIRST VIEWPORT: logo centrado de 96 px en la cabecera, navegación existente y banner crema con “Indumentaria & Hogar” y “Estilo para vos y tu hogar”.

FORM: extensión configurada de Dana; dirección fijada por el logo del usuario y el plan aprobado. No requiere una plantilla nueva.

FINISH: comprobar el resultado en escritorio y móvil, conservar el sistema de Dana y registrar la procedencia del logo y los fondos.

## Verificación

La revisión final devolvió `SHIP` para el código local y el render de escritorio y móvil. Las capturas completas revisadas son [`betel-desktop.png`](../.impeccable/review/betel-desktop.png) y [`betel-mobile.png`](../.impeccable/review/betel-mobile.png); reflejan la versión local, no el despliegue actual.

- 219 pruebas unitarias aprobadas después de las correcciones compartidas.
- 4 pruebas de integración aprobadas en PostgreSQL aislado: rollback, conservación de otros tenants y cambios posteriores, contraseña hasheada y catálogo inicial vacío.
- 4 casos E2E aprobados en escritorio y móvil, incluyendo navegación real a Contacto e ingreso del titular al panel.
- Build y typecheck aprobados; lint sin errores y con 9 advertencias preexistentes.

Para repetir los controles de código: `pnpm test`, `pnpm typecheck`, `pnpm lint` y `pnpm build`. La integración requiere `BETEL_SEED_TEST_DATABASE_URL` con una base local nueva llamada `betel_seed_test` o `betel_seed_test_*`, con el esquema aplicado y sin identidades Betel; ejecutar `pnpm exec vitest run tests/betel-seed.integration.test.ts`.

Para los E2E, configurar `BETEL_QA=1`, `PLAYWRIGHT_BASE_URL` de la instancia que contiene Betel y la contraseña del titular solo en `BETEL_OWNER_PASSWORD`; ejecutar `pnpm exec playwright test e2e/betel.spec.ts`. El archivo desactiva las trazas para no registrar las credenciales.
