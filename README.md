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

## Usuario demo

- Email: `demo@landing.test`
- Password inicial: `demo1234`
- Tienda: `/demo`

`pnpm seed` crea la tienda con checkout en efectivo, entrega personalizada y diseño editable. No modifica cuentas, tiendas ni productos que ya existan; una tienda demo creada con la configuración anterior debe actualizarse desde `/gestion/configuracion` y `/gestion/configuracion/diseno`. No ejecutes este seed en una base pública: la contraseña inicial es conocida.

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

Para crear el tenant ecommerce de demostración o completar datos que le falten:

```bash
DEMO_TENANT_PASSWORD="una-clave-segura" pnpm demo:seed
```

Por defecto se crea con el email `demo-ecommerce@landing.test` y la URL pública `/demo-ecommerce`.
El seed ecommerce usa el diseño Dana, checkout en efectivo, entrega personalizada y un producto con stock por variante. Al repetirlo conserva contraseñas, configuración y productos ya existentes.

## Documento de contexto

El objetivo y alcance del proyecto están en `docs/PLAN_DE_ACCION.md`.
