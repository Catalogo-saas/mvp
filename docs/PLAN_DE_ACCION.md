# Plan de acción — SaaS de catálogos con pedidos por WhatsApp

## Objetivo

Crear un SaaS multi-tienda donde cada comercio tenga una página pública mobile-first para mostrar productos, armar carrito y confirmar pedidos por WhatsApp, sin pagos online ni logística integrada.

## Stack decidido

- Next.js full-stack + TypeScript.
- PostgreSQL.
- Prisma ORM.
- NextAuth/Auth.js con email y contraseña.
- RustFS como storage S3-compatible para logos e imágenes.
- Tailwind CSS.
- VPS con Docker Compose y reverse proxy.

## Alcance MVP

- Login con email y contraseña; las cuentas se crean desde el superadmin.
- Alta, edición, baja, reactivación y borrado de tenants desde `/superadmin`.
- Página pública por ruta `/{storeSlug}`.
- Backoffice en `/gestion`.
- Gestión de datos de tienda, categorías y productos.
- Productos con grupos de opciones/extras configurables:
  - selección simple o múltiple;
  - obligatorio u opcional;
  - ajuste de precio por opción;
  - ejemplos: colores, talles, guarniciones, agregados.
- Carrito público.
- Checkout breve.
- Guardado del pedido como `PENDING_WHATSAPP`.
- Redirección a WhatsApp con resumen, total y código de pedido.
- SEO básico: metadata dinámica, Open Graph, sitemap, robots, canonical y JSON-LD `Product`.
- Mockups HTML estáticos para validar diseño antes de profundizar la UI final.

## Fuera de alcance MVP

- Google OAuth.
- Pasarela de pagos.
- Envíos automáticos.
- Facturación.
- Stock por variante.
- Dominios propios por tienda.
- WhatsApp Cloud API.
- Tests unitarios automatizados.

## Flujo público

1. El cliente entra a `/{storeSlug}`.
2. Navega categorías/productos.
3. Selecciona opciones/extras.
4. Agrega productos al carrito.
5. Completa nombre, teléfono, modalidad y notas.
6. El sistema guarda el pedido.
7. Se abre WhatsApp del comercio con el mensaje armado.

## Flujo backoffice

1. El superadmin crea la cuenta y la tienda.
2. El comerciante inicia sesión con las credenciales asignadas.
3. Administra datos de tienda, productos, categorías, opciones y extras.
4. Revisa, crea y edita pedidos.

## Modelo de datos resumido

- `User`: cuenta del comerciante.
- `Store`: tienda, slug, WhatsApp, rubro, tema y template.
- `Category`: categorías ordenables por tienda.
- `Product`: producto visible/oculto con precio base e imágenes.
- `OptionGroup`: grupo de opciones por producto.
- `ProductOption`: opción/extras con ajuste de precio.
- `Order`: pedido con datos del cliente, total y estado.
- `OrderItem`: snapshot del producto y opciones elegidas.

## Storage y deploy

- RustFS expone API S3-compatible.
- La app usa `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` y `PUBLIC_FILE_BASE_URL`.
- Docker Compose levanta app, PostgreSQL y RustFS.
- Backups periódicos de PostgreSQL y volumen de objetos.

## Diseño

El diseño se basa en:

- catálogo y pedido por WhatsApp similar a Puro Sabor;
- patrones simplificados de Shopify/Tienda Nube;
- mobile-first real;
- templates por rubro: comida, retail y servicios.

Antes de profundizar la UI final se deben validar mockups HTML ubicados en `public/mockups/`.

## Criterios de aceptación manual

- Crear tenant con email/password, tienda y WhatsApp desde el superadmin.
- Dar de baja/reactivar un tenant y comprobar el bloqueo del acceso y la tienda pública.
- Crear producto con opciones/extras.
- Ver tienda pública en mobile y desktop.
- Agregar producto al carrito.
- Confirmar pedido.
- Ver pedido en backoffice.
- Confirmar que el link de WhatsApp incluye código, productos, opciones, total y datos del cliente.
- Revisar metadata, sitemap y páginas de producto.

## Decisiones pendientes

- Definir identidad visual final.
- Decidir si se agrega editor visual simple después del MVP.
- Decidir si los dominios propios entran en una fase posterior.
