# Integridad del checkout

El navegador conserva un carrito, pero la API decide qué productos y combinaciones se pueden comprar, sus precios, descuentos, entrega e impuestos. La cotización y la creación comparten esa validación. Una variante sin precio propio hereda el precio del padre, nunca el mínimo de otra combinación.

## Contratos

`POST /api/storefront/cart/quote` recibe `storeSlug`, hasta 80 líneas `{ lineId: UUID, productId, quantity, selectedOptionIds }` y selecciones opcionales `paymentMethodId` y `deliveryMethodId`. También admite `paymentMethod` heredado cuando identifica un único método activo. No acepta importes del navegador. Cantidades enteras entre 1 y 99 por combinación, máximo 30 opciones sin repetir.

La respuesta incluye líneas actualizadas, `issueDetails` por línea, `valid`, `complete`, `totals`, métodos vigentes y sus costos de entrega calculados. Las líneas inválidas siguen en el carrito del cliente para quitarlas o corregir cantidades. Cotizar no reserva inventario.

Una cotización completa emite `quoteToken`, firmado y válido por diez minutos. `POST /api/orders` requiere este token además del comprador, selecciones, líneas e `idempotencyKey`. La API vuelve a calcular bajo bloqueos: un cambio en condiciones produce `409 QUOTE_CHANGED` con una cotización nueva, sin crear una venta ni descontar stock. El cliente muestra los cambios y exige otro clic. Un token adulterado produce `400 INVALID_QUOTE`.

Campos adicionales de precio, descuento, envío, estados o importes se rechazan. Las respuestas de negocio tienen `code` estable y `error` legible; las fallas técnicas se registran internamente y responden `503 COMMERCE_UNAVAILABLE`.

## Inventario y reintentos

Se bloquea la tienda para lectura y los productos para actualización en orden de ID. Las modificaciones de pedidos toman primero tienda, luego pedido y finalmente productos ordenados. El inventario y la venta se guardan en una única transacción; los conflictos transitorios permiten como máximo tres intentos.

El stock simple es independiente del stock por variante. `null` significa ilimitado. Los pedidos reservan al crearse; cancelar libera una sola vez. No hay vencimiento automático. WhatsApp sigue siendo una consulta sin registro ni reserva.

La clave de idempotencia se vincula con una huella del contenido normalizado. Un reintento idéntico devuelve la misma venta; reutilizar la clave con otro contenido genera `409 IDEMPOTENCY_CONFLICT`. La firma renovada no cambia la huella. El frontend conserva el intento exacto en `sessionStorage` hasta conocer su resultado, y lo recupera al recargar. Las respuestas de cotización atrasadas no reemplazan modificaciones del carrito.

La edición administrativa de ítems recalcula los importes conservando descuento y envío históricos. Pedidos anteriores sin porcentaje guardado lo derivan del subtotal y descuento originales. No se eliminan productos ni combinaciones con reservas abiertas. La actualización manual de stock exige la versión vigente para no sobrescribir una reserva concurrente.

## Despliegue

Aplicar `20261002000000_checkout_integrity`, generar Prisma y desplegar API y frontend juntos. Los clientes antiguos que no envían `quoteToken` deben actualizar la página. La migración revisa datos negativos o cantidades inválidas y falla sin repararlos; no se alteran pedidos anteriores para fabricar una huella de idempotencia.

Configurar `CHECKOUT_QUOTE_SECRET` de al menos 24 caracteres; alternativamente se usa `TRACKING_TOKEN_SECRET` o `NEXTAUTH_SECRET`. No publicar esas claves. Rotarlas invalida cotizaciones pendientes, que deben renovarse. Los importes mantienen la unidad entera ya usada por el proyecto y están limitados al rango de `Int` de PostgreSQL.

No se implementa sincronización con ventas externas: esas ventas deben actualizar este mismo inventario. Tampoco se incorpora aquí un sistema de detección de pedidos spam.

## Verificación

- `pnpm test`: validación de catálogo, cantidades, precios, tokens, descuentos y contratos de pago.
- PostgreSQL real: usar exclusivamente una base local desechable llamada `landing_saas_checkout_test_<sufijo>`, aplicar las migraciones y ejecutar `CHECKOUT_POSTGRES_TESTS=1 DATABASE_URL=<url-de-esa-base> pnpm exec vitest run tests/checkout-postgres.test.ts`. La suite se omite en bases habituales o remotas.
- `pnpm exec playwright test e2e/checkout-integrity.spec.ts e2e/payment-settings.spec.ts`: reconfirmación, recuperación de respuesta perdida, desconexión, stock agotado y respuestas atrasadas en móvil/escritorio. Los fixtures son tenants locales aislados y se eliminan al finalizar; iniciar el servidor de pruebas con SMTP deshabilitado.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
