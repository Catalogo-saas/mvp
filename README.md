# Landing SaaS

SaaS multi-tienda mobile-first con checkout, seguimiento de pedidos y modo opcional de pedidos por WhatsApp.

La configuración necesaria para las cargas directas de imágenes está documentada en [`docs/R2_DIRECT_UPLOADS.md`](docs/R2_DIRECT_UPLOADS.md).

## Stack

- Next.js + TypeScript
- PostgreSQL
- Prisma
- NextAuth con email/password y roles de comerciante/superadmin
- RustFS S3-compatible
- Tailwind CSS

## Arranque local

1. Copiar variables:

   ```bash
   cp .env.example .env
   ```

   Prisma 7 lee `DATABASE_URL` desde `prisma.config.ts` y `.env`. Next.js también puede leer `.env.local`, pero para este proyecto usá `.env` en desarrollo local.

2. Levantar servicios:

   ```bash
   docker compose up -d postgres rustfs
   ```

3. Instalar dependencias:

   ```bash
   pnpm install
   ```

4. Crear el esquema y, solo en una base de desarrollo o pruebas, cargar datos demo:

   ```bash
   pnpm prisma:migrate
   pnpm prisma:generate
   pnpm seed
   ```

5. Iniciar app:

   ```bash
   pnpm dev
   ```

Para solicitar comprobantes de pago, configurá `S3_PRIVATE_BUCKET` con un bucket distinto de `S3_BUCKET`. Creá ese bucket en el almacenamiento S3 compatible y mantenelo privado, sin política de lectura pública ni URL de archivos públicos. Los comprobantes se validan y se sirven únicamente desde rutas autenticadas. Aplicá las migraciones antes de habilitar esta opción en una instalación existente.

## Crear el primer superadmin

Configurá `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` y ejecutá:

```bash
pnpm superadmin:bootstrap
```

Las cuentas de comercios y sus tiendas se crean luego desde `/superadmin`; no existe registro público.

## Equipo de la tienda

La sección `/gestion/usuarios` permite al titular y a los administradores crear y editar miembros, cambiar sus permisos y suspender o reactivar su acceso. Cada miembro pertenece a una sola tienda y usa un email único en la plataforma. Quien crea la cuenta define la contraseña y comparte las credenciales con el nuevo usuario.

- **Titular:** acceso completo; su cuenta está protegida en esta sección.
- **Administrador:** acceso completo y gestión de otros miembros; no puede modificar su propia cuenta desde Usuarios.
- **Operador:** Inicio, Ventas, Productos, Categorías y Clientes.

Suspender una cuenta, cambiar su email o restablecer su contraseña invalida sus sesiones anteriores. Reactivarla requiere un nuevo ingreso. Si se suspende al titular, todo su equipo pierde acceso a la tienda.

En instalaciones existentes, aplicá la migración `20261002010000_store_team` con `pnpm exec prisma migrate deploy` y regenerá el cliente con `pnpm prisma:generate` antes de iniciar la nueva versión. Las cuentas titulares existentes conservan su acceso.

## Tiendas demo

| Tienda | URL | Administrador | Contraseña |
| --- | --- | --- | --- |
| NORTE · Ropa de mujer y hombre · Dana | `/demo` | `demo@landing.test` | `Ropa1234` |
| NEXO · Hogar y tecnología · Vene | `/demo-productos` | `demo-productos@landing.test` | `Productos1234` |

Ejecutá `pnpm seed` o `pnpm demo:seed` para reconstruir ambas demos. Cada una contiene 60 productos, 12 subcategorías, novedades y ofertas, galerías de fotos, variantes, inventario, promociones y siete secciones de portada. Incluyen efectivo, transferencia con descuento, pago a convenir, retiro gratuito y envío con umbral de gratuidad.

Cada tienda incluye diez clientes registrados, 24 pedidos con diferentes estados y 300 eventos de navegación durante los últimos 30 días. Los clientes usan `cliente1@norte.example.invalid` a `cliente10@norte.example.invalid` (o `nexo.example.invalid`) y la misma contraseña de su demo. Estos datos permiten explorar clientes recurrentes, ventas, reservas de stock y seguimiento.

**Cada ejecución elimina y reemplaza todos los datos de estas dos tiendas**, incluidos cambios manuales, clientes, sesiones, pedidos, miembros y configuración. Restablece las contraseñas e invalida las sesiones administrativas anteriores. Valida ambas identidades antes de borrar y ejecuta la reconstrucción en una transacción; ante una URL o cuenta perteneciente a otro comerciante, aborta. Conserva las demás tiendas, cuentas y el antiguo tenant `/demo-ecommerce`, si existe.

La carga agrupa las inserciones y las reservas de inventario para reducir viajes a la base, especialmente si es remota. La transacción tiene un límite de diez minutos; si falla o vence ese tiempo, se revierten ambas demos completas. El aviso del driver sobre `sslmode` es independiente de ese límite: no desactives la validación SSL para resolver un timeout del seed.

Configurá `DATABASE_URL`. `TRACKING_TOKEN_SECRET` (o `NEXTAUTH_SECRET`) debe tener al menos 24 caracteres. Si configurás `CHECKOUT_QUOTE_SECRET`, también debe cumplir ese mínimo. El seed valida los secretos antes de modificar datos. No envía correos ni mensajes y no necesita almacenamiento de archivos para las fotos. Las credenciales demo son conocidas: usá una base de desarrollo o una instalación dedicada a demostraciones.

El catálogo y los datos comerciales son ficticios. Las galerías externas tienen su origen documentado en `prisma/demo-images.json`: imágenes de catálogos públicos de demostración Shopify y [DummyJSON](https://dummyjson.com/docs/products); los banners usan fotografías de [Unsplash](https://unsplash.com). El seed usa un manifiesto estático, sin consultar esas APIs al ejecutarse. Las fotografías requieren conexión a sus CDN. Los datos de pago, teléfonos, direcciones y enlaces sociales son ilustrativos; no realices pagos reales.

Para verificar reconstrucción, aislamiento, contraseñas, importes y stock en una base temporal que tenga las migraciones aplicadas:

```bash
DEMO_SEED_TEST_DATABASE_URL="postgresql://usuario:clave@localhost:5432/landing_demo_seed_test" pnpm test
```

La prueba de integración exige una base local llamada `landing_demo_seed_test` o `landing_demo_seed_test_*` para evitar ejecutarse sobre la base de trabajo. Usa secretos propios para sus fixtures: antes de probar en navegador, reconstruí esa base con `pnpm seed`, configurando `DATABASE_URL` de pruebas y los mismos secretos de seguimiento y checkout que usará el servidor. Luego iniciá la app contra esa misma base y ejecutá `DEMO_QA=1 DEMO_SEED_TEST_DATABASE_URL="postgresql://usuario:clave@localhost:5432/landing_demo_seed_test" pnpm exec playwright test e2e/demo-stores.spec.ts`, usando el mismo `TRACKING_TOKEN_SECRET` que el servidor y `PLAYWRIGHT_BASE_URL` si no está en `http://127.0.0.1:3100`.

## Propuesta Strom

`pnpm strom:seed` crea `/strom` con 24 productos y seis categorías sobre la plantilla existente Vene. Amarillo/negro, banners por dispositivo, textos y secciones se definen en los mismos ajustes que usa el editor; no existe una plantilla exclusiva de Strom. Es independiente de `pnpm seed`: conserva las otras tiendas y, al repetirlo, conserva credenciales, productos existentes, stock, clientes y pedidos. Convierte una sola vez la antigua plantilla `strom` a Vene, conservando las secciones y banners personalizados. Después conserva la configuración visual. Si el slug o el email pertenecen a otra identidad, aborta. La primera ejecución muestra la contraseña generada para `strom-demo@landing.test`; no se guarda en el repositorio.

Las 24 fotos, el logo y los banners están alojados en Cloudflare R2 con URLs públicas HTTPS, sin archivos en `public/strom`. `prisma/strom-catalog.json` registra las URLs alojadas, la procedencia original y cuáles productos se identificaron en Instagram de Strom; `prisma/strom-brand.json` registra el logo y los banners. `scripts/publish-strom-banners.ts` compone el fondo de los banners a partir de las fotos originales; el texto queda separado y editable. El seed usa estos manifiestos sin descargar ni subir imágenes. Al repetirlo, migra únicamente las referencias antiguas `/strom/*.webp` a las URLs públicas, preservando imágenes personalizadas y los demás datos.

Precios, promociones, opciones, stock, pagos y entregas son ilustrativos. `checkoutSettings.demoMode` identifica esta demostración: el checkout registra pedidos, reserva stock y muestra seguimiento, sin enviar correos ni solicitar pagos reales. El registro de clientes por correo está deshabilitado en esta demo; la compra es como invitado. Los enlaces de contacto y consulta mayorista apuntan al WhatsApp real, pero no envían mensajes automáticamente. La demo no se incluye en el sitemap y solicita no indexación.

## Betel

`pnpm betel:seed` crea la tienda real `/betel` sobre Dana, con el logo original, colores crema/cobre/rosa, categorías Indumentaria y Hogar y catálogo vacío. Configurá `BETEL_OWNER_PASSWORD` en el entorno y `BETEL_LOGO_PATH` con la ruta al logo original PNG/JPEG. La contraseña no se registra ni se restablece al repetir. El comando usa la conexión directa de Prisma Postgres para el alta, valida la identidad, verifica las imágenes públicas y conserva los datos existentes. Pagos y entregas quedan pendientes de configuración. Ver [configuración y funcionamiento de Betel](docs/BETEL.md).

## Mockups HTML

- `/mockups/storefront.html`
- `/mockups/product-options.html`
- `/mockups/checkout.html`
- `/mockups/backoffice.html`
- `/mockups/store-templates.html`
- `/mockups/template-ecommerce.html`
- `/mockups/template-food.html`
- `/mockups/template-beauty-pop.html`
- `/mockups/template-premium-minimal.html`
- `/mockups/template-boutique-soft.html`

`pnpm demo:seed` es un alias compatible del seed principal y reconstruye las dos demos de la tabla. Las antiguas variables `DEMO_TENANT_*` ya no seleccionan otro tenant.

## Documento de contexto

El objetivo y alcance del proyecto están en `docs/PLAN_DE_ACCION.md`.
