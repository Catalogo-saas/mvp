# Landing SaaS

MVP de SaaS multi-tienda para catálogos mobile-first con pedidos por WhatsApp.

## Stack

- Next.js + TypeScript
- PostgreSQL
- Prisma
- NextAuth con email/password
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

## Usuario demo

- Email: `demo@landing.test`
- Password: `demo1234`
- Tienda: `/demo`

## Mockups HTML

- `/mockups/storefront.html`
- `/mockups/product-options.html`
- `/mockups/checkout.html`
- `/mockups/backoffice.html`

## Documento de contexto

El objetivo y alcance del proyecto están en `docs/PLAN_DE_ACCION.md`.
