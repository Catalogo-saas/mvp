# Landing SaaS

MVP de SaaS multi-tienda para catálogos mobile-first con pedidos por WhatsApp.

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

4. Crear schema y datos demo:

   ```bash
   pnpm prisma:migrate
   pnpm prisma:generate
   pnpm seed
   ```

5. Iniciar app:

   ```bash
   pnpm dev
   ```

## Crear el primer superadmin

Configurá `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` y ejecutá:

```bash
pnpm superadmin:bootstrap
```

Las cuentas de comercios y sus tiendas se crean luego desde `/superadmin`; no existe registro público.

## Usuario demo

- Email: `demo@landing.test`
- Password: `demo1234`
- Tienda: `/demo`

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

Para crear o actualizar el tenant ecommerce de demostración:

```bash
DEMO_TENANT_PASSWORD="una-clave-segura" pnpm demo:seed
```

Por defecto se crea con el email `demo-ecommerce@landing.test` y la URL pública `/demo-ecommerce`.

## Documento de contexto

El objetivo y alcance del proyecto están en `docs/PLAN_DE_ACCION.md`.
