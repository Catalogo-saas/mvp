# Publicación del comercio mobile-first

Esta implementación reemplaza el flujo inicial centrado en WhatsApp por un checkout con pedidos, efectivo o transferencia, sin pasarela de pago. WhatsApp sigue disponible como modo directo configurable. El plan MVP original en `PLAN_DE_ACCION.md` queda como referencia histórica.

## Antes de desplegar

1. Hacer una copia recuperable de PostgreSQL y comprobar que se pueda restaurar antes de cualquier cambio de esquema. En la base local configurada, `pnpm exec prisma migrate status` confirma que las 11 migraciones están aplicadas. Verificar cada otro entorno por separado.
2. Configurar `TRACKING_TOKEN_SECRET` con al menos 24 caracteres y mantenerlo estable. Cambiarlo invalida los enlaces de seguimiento ya enviados.
3. Configurar `NEXT_PUBLIC_APP_URL` con el origen público correcto; se usa en los enlaces de correo y seguimiento.
4. Configurar `GMAIL_SMTP_USER` y `GMAIL_SMTP_APP_PASSWORD` con una cuenta autorizada para envío SMTP. Sin ellos, los pedidos se guardan, pero no salen correos y el registro de compradores queda deshabilitado.
5. En un entorno distinto, comprobar el estado con `pnpm exec prisma migrate status` y aplicar `pnpm exec prisma migrate deploy` solo si faltan migraciones y ya se verificó el respaldo.
6. Si se activa la solicitud de comprobante de transferencia, crear un bucket privado y configurar `S3_PRIVATE_BUCKET` separado de `S3_BUCKET`. No habilitar lectura pública para ese bucket.

Los scripts `pnpm seed` y `pnpm demo:seed` crean datos de prueba que falten y conservan las configuraciones ya editadas. `pnpm seed` instala una cuenta con contraseña inicial conocida: usarlo solo en desarrollo o pruebas. Ninguno de los scripts se ejecutó como parte de esta actualización.

## Verificación manual mínima

- Abrir `/gestion` en 390 px y escritorio: debe mostrar el resumen del negocio. `/gestion/pedidos` contiene la lista de ventas. Comprobar navegación inferior fija, categorías, productos, configuración, editor y estadísticas.
- Guardar borrador del diseño, recargar y confirmar que la tienda pública no cambió; publicar y comprobar logo, favicon, colores, tipografía, encabezado, tarjeta, pie y template en móvil.
- Crear categorías de ejemplo; deben aparecer “Ropa para hombre”, “Ropa para mujer” y “Ropa para niños”, con subcategorías repetidas sin error de URL.
- Crear un producto físico con variantes y stock por combinación; comprar una combinación y comprobar decremento. Cancelar y comprobar restitución.
- Configurar efectivo y transferencia por separado, una entrega personalizada, descuentos e instrucciones. Confirmar un pedido desde móvil y verificar que la redirección vaya a `/{storeSlug}/compra/proceso/orden?hash=...`.
- Comprobar correo de comprador con enlace de seguimiento y correo de vendedor con enlace a la venta. Actualizar pago y entrega y comprobar cronología y nuevo correo al comprador.
- Activar pedidos directos por WhatsApp: confirmar que abre WhatsApp y no crea una orden de checkout normal.
- Registrar un comprador, verificar el correo y revisar “Mis compras”.
- Comprobar 7/30/90 días y rango personalizado en estadísticas.

La verificación end-to-end del checkout y del correo requiere datos de prueba y credenciales SMTP válidas en el entorno donde se despliegue.

## Plantillas Roma, Dana y Vene

- Roma: logo centrado, portada contenida, Poppins y carrusel de destacados en mobile.
- Dana: encabezado en dos filas, portada completa, Libre Baskerville y carrusel de destacados en mobile.
- Vene: logo a la izquierda, portada completa, Manrope/Sora y grilla de destacados configurable en mobile.
- Categorías y contacto heredan el estilo elegido. Los contadores de categorías incluyen productos visibles de todas las subcategorías, sin duplicados.
- La opción de tipografía `template` usa las fuentes propias; `serif`, `sans` y `rounded` siguen disponibles. No hace falta una migración de base para este valor JSON.
- Elegir una plantilla en el editor aplica su paleta y tipografía en el borrador. No reemplaza fotos, textos ni datos comerciales y no publica automáticamente.

Para pruebas aisladas en una base **local**, crear datos con `pnpm exec tsx --env-file=.env scripts/template-qa-fixtures.ts`. La matriz E2E se habilita con `TEMPLATE_QA=1 pnpm exec playwright test e2e/storefront-templates.spec.ts` y cubre 360, 390, 768, 1024 y 1440 px, menú, filtros, carrito y páginas secundarias. No confirma compras. Al terminar, ejecutar el mismo script con `cleanup` para eliminar exclusivamente las tres tiendas temporales y sus cuentas.
