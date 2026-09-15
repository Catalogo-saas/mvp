# Especificación futura — Mercado Pago multi-tenant

> **Estado:** diseño aprobado, todavía no implementado.
>
> **Última investigación oficial:** 13 de septiembre de 2026.
>
> Este documento es la fuente de verdad para una futura implementación. Antes de modificar el proyecto, releer `AGENTS.md`, comprobar el estado actual del repositorio y volver a validar en Mercado Pago los contratos de API, requisitos y tarifas que puedan haber cambiado.

## 1. Objetivo

Agregar Mercado Pago como método de pago opcional en cada tienda del SaaS, de manera que:

- cada comerciante vincule su propia cuenta de Mercado Pago mediante OAuth;
- cada cobro se cree usando el `access_token` de ese comerciante;
- el dinero se acredite directamente en la cuenta del comerciante, descontando Mercado Pago su propia comisión;
- la plataforma no reciba, custodie ni distribuya el dinero;
- inicialmente la plataforma no cobre comisión;
- efectivo, transferencia y el flujo por WhatsApp sigan funcionando sin regresiones.

La solución elegida es **Checkout Pro mediante Orders API, dentro del modelo Split de Pagos 1:1/Marketplace**. El comprador sale temporalmente al checkout alojado por Mercado Pago y luego regresa al sitio. Mercado Pago recomienda Orders API para integraciones nuevas; Preferences API queda como flujo clásico/legacy.

Fuentes:

- [Split de Pagos 1:1 — Integrar el checkout](https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace)
- [Checkout Pro — Orders API recomendada](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro-orders/overview)

## 2. Decisiones de producto ya tomadas

Estas decisiones no deben volver a preguntarse al implementar, salvo que el dueño del proyecto solicite cambiarlas explícitamente.

| Tema | Decisión |
| --- | --- |
| Checkout | Checkout Pro con redirección a Mercado Pago |
| API | Orders API (`/v1/orders`), no Preferences API |
| Modelo | Marketplace / Split de Pagos 1:1 |
| Destino del dinero | Cuenta Mercado Pago del comerciante vinculado |
| Comisión de la plataforma | Ninguna; omitir `marketplace_fee` |
| Comisión de Mercado Pago | La paga el comerciante según su configuración y plazo de acreditación |
| Moneda y país inicial | Argentina, ARS |
| Métodos actuales | Efectivo y transferencia continúan disponibles |
| Métodos Mercado Pago | Solo métodos inmediatos; excluir `ticket` para no ofrecer Rapipago/Pago Fácil |
| Procesamiento | Asíncrono permitido (`automatic_async`) para no reducir innecesariamente la aprobación |
| Reserva normal de stock | 5 minutos |
| Pago en procesamiento | Si comenzó dentro de los 5 minutos, mantener la reserva hasta el resultado final |
| WhatsApp en Mercado Pago | No redirigir automáticamente; mostrar solo un CTA opcional de contacto |
| Relación inicial | Una conexión Mercado Pago por tienda y un `collectorId` exclusivo entre tenants |

## 3. Estado actual del proyecto

Al redactar este documento el proyecto utiliza:

- Next.js 16.3.3 con App Router y Route Handlers;
- React 19.2.8 y TypeScript 5.7;
- Prisma 7.9.1 sobre PostgreSQL;
- NextAuth 4.24 con cuentas propias de comerciantes;
- Zod para validación;
- precios, subtotales y totales almacenados como enteros en ARS;
- `tsx`, pero ningún runner de tests configurado.

### Flujo actual de pedidos

1. `components/public-store.tsx` permite elegir `cash` o `transfer`.
2. `POST /api/orders` valida la tienda, disponibilidad horaria, productos, opciones y stock.
3. Los precios se vuelven a calcular en el servidor.
4. Se crea un `Order` con estado `PENDING_WHATSAPP`.
5. El método de pago queda dentro del JSON `Order.checkout`; no existe un campo tipado dedicado.
6. La API devuelve `whatsappUrl` y el frontend abre WhatsApp.

### Comportamiento actual del stock

- `Product.stockQuantity = null` significa stock no limitado.
- El checkout público solo comprueba stock; no lo descuenta al crear una orden pendiente.
- `lib/order-management.ts` descuenta stock cuando una orden pasa a `PAID`, `IN_PREPARATION` o `DELIVERED`, y lo repone al salir de esos estados.
- La lógica futura de reservas debe reemplazar esa inferencia puramente basada en estado por un estado explícito de inventario, evitando un segundo descuento cuando un pago Mercado Pago pasa de pendiente a pagado.

## 4. Costos conocidos

### 4.1 Tarifas de Mercado Pago

La tarifa pública argentina consultada indica que se paga únicamente por venta aprobada. Los valores publicados son:

| Plazo de acreditación | Tarifa publicada | Costo aproximado sobre ARS 100.000 | Neto aproximado |
| --- | ---: | ---: | ---: |
| 35 días | 1,49% + IVA | ARS 1.803 | ARS 98.197 |
| 18 días | 3,39% + IVA | ARS 4.102 | ARS 95.898 |
| 10 días | 4,39% + IVA | ARS 5.312 | ARS 94.688 |
| Inmediata | 6,29% + IVA | ARS 7.611 | ARS 92.389 |

Los ejemplos suponen IVA del 21% y no incluyen impuestos provinciales. La tarifa real puede variar por provincia, medio de pago y plazo elegido por cada vendedor. Debe volver a verificarse al implementar y cada comercio debe confirmar su costo dentro de Mercado Pago.

No se encontró un cargo fijo público de alta o abono mensual para Checkout. La página oficial indica “solo pagás por venta aprobada”. En Split 1:1, la comisión de Mercado Pago se descuenta primero del vendedor. Como esta plataforma no cobrará comisión, debe omitirse `marketplace_fee`.

Fuentes:

- [Mercado Pago Argentina — Checkout y costos](https://www.mercadopago.com.ar/herramientas-para-vender/check-out)
- [Orden de descuentos en Split 1:1](https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace)

### 4.2 Esfuerzo de desarrollo estimado

Estimación no oficial para una implementación productiva completa:

- **80 a 120 horas**;
- aproximadamente **2 a 3 semanas** para una persona con experiencia;
- a USD 30/h: USD 2.400 a USD 3.600;
- a USD 50/h: USD 4.000 a USD 6.000.

La estimación incluye OAuth, cifrado, persistencia, checkout, webhooks, conciliación, reservas de stock, UI, pruebas y salida controlada. No incluye soporte posterior, impuestos ni posibles costos del hosting o scheduler.

## 5. Requisitos externos

### 5.1 Cuenta de la plataforma

El propietario del SaaS debe:

1. tener una cuenta de Mercado Pago habilitada para operar;
2. crear una aplicación desde “Tus integraciones”;
3. elegir `Pagos online`;
4. elegir `Checkout Pro`;
5. elegir el modelo `Marketplace`;
6. seleccionar Orders API cuando el panel solicite la API;
7. habilitar Authorization Code con PKCE;
8. configurar una Redirect URL OAuth estática y HTTPS;
9. configurar notificaciones Webhook de Orders y de vinculación/desvinculación de vendedores;
10. obtener credenciales de prueba y, luego, activar las de producción.

### 5.2 Cuenta de cada comerciante

Cada comercio debe tener:

- una cuenta vendedora de Mercado Pago Argentina;
- nivel de identificación KYC 6;
- acceso a la aplicación móvil o web de Mercado Pago;
- capacidad de iniciar sesión y aceptar el consentimiento OAuth.

El comerciante **no** debe copiar ni entregar su Access Token, contraseña o credenciales a la plataforma. La autorización se realiza exclusivamente en Mercado Pago.

Fuentes:

- [Requisitos previos de Split 1:1](https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/prerequisites)
- [Crear la configuración Marketplace](https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/create-configuration)
- [OAuth y PKCE](https://www.mercadopago.com.ar/developers/es/docs/security/oauth/creation)

### 5.3 Infraestructura

Se necesita:

- dominio productivo con HTTPS válido;
- PostgreSQL disponible para conexiones, órdenes y bandeja de webhooks;
- un scheduler que invoque un endpoint interno al menos una vez por minuto;
- almacenamiento seguro de secretos en el proveedor de despliegue;
- logs y alertas sin datos de tarjeta ni tokens;
- política de privacidad y términos accesibles públicamente.

## 6. Variables de entorno futuras

Agregar solo al implementar, nunca ahora:

```dotenv
MP_CLIENT_ID=""
MP_CLIENT_SECRET=""
MP_WEBHOOK_SECRET=""
MP_TOKEN_ENCRYPTION_KEY=""
CRON_SECRET=""
```

Reglas:

- `MP_TOKEN_ENCRYPTION_KEY` debe ser una clave aleatoria de 32 bytes codificada en Base64.
- Ninguna variable secreta puede usar prefijo `NEXT_PUBLIC_`.
- El `client_secret`, los tokens OAuth y la clave de cifrado nunca deben llegar al navegador, logs o respuestas de API.
- Las URLs públicas se construyen desde la URL canónica ya configurada por la aplicación; no se aceptan hosts aportados por el cliente.

## 7. Modelo de datos propuesto

Los nombres pueden adaptarse a las convenciones reales de Prisma, pero la semántica y las restricciones son obligatorias.

### 7.1 Enumeraciones

```text
OrderPaymentMethod
  CASH
  TRANSFER
  MERCADOPAGO

OrderStatus
  + PENDING_PAYMENT

InventoryState
  UNRESERVED
  HELD
  COMMITTED
  RELEASED

MercadoPagoConnectionStatus
  ACTIVE
  RECONNECT_REQUIRED
  DISCONNECTED

PaymentAttemptStatus
  CREATING
  READY
  PROCESSING
  APPROVED
  REJECTED
  CANCELLED
  EXPIRED
  REFUNDED
  PARTIALLY_REFUNDED
  REVIEW_REQUIRED
```

### 7.2 Cambios en `Store`

Agregar:

- `acceptMercadoPago Boolean @default(false)`.
- Relación opcional uno a uno con `MercadoPagoConnection`.

La tienda solo puede habilitar Mercado Pago cuando la conexión está `ACTIVE` y sus tokens siguen siendo utilizables.

### 7.3 `MercadoPagoConnection`

Campos mínimos:

- `id`;
- `storeId @unique`;
- `collectorId @unique`;
- `accessTokenEncrypted @db.Text`;
- `refreshTokenEncrypted @db.Text`;
- `tokenKeyVersion`;
- `scope`;
- `liveMode`;
- `expiresAt`;
- `status`;
- `connectedAt`, `lastRefreshedAt`, `disconnectedAt`;
- `createdAt`, `updatedAt`.

No reutilizar el modelo `Account` de NextAuth: una conexión de pagos tiene otro ciclo de vida, permisos y requisitos de auditoría.

### 7.4 `MercadoPagoOAuthState`

Registro efímero para cada intento de conexión:

- `stateHash @unique`;
- `storeId` y `userId`;
- `pkceVerifierEncrypted`;
- `expiresAt` con vigencia máxima de 10 minutos;
- `usedAt` para impedir replay;
- timestamps.

Nunca incluir `storeId`, `userId` ni información sensible directamente en `state`. El valor enviado debe ser aleatorio y opaco.

### 7.5 Cambios en `Order`

Agregar:

- `paymentMethod OrderPaymentMethod`;
- `inventoryState InventoryState`;
- `reservedUntil DateTime?`;
- `clientRequestId String?`;
- relación opcional con `PaymentAttempt`.

Restricción única compuesta para nuevas solicitudes: `@@unique([storeId, clientRequestId])`. Los flujos de Mercado Pago exigen `clientRequestId`; efectivo y transferencia pueden mantenerlo opcional por compatibilidad.

### 7.6 `PaymentAttempt`

Para esta primera versión existe un intento de Mercado Pago por orden.

Campos mínimos:

- `id`;
- `orderId @unique`;
- `connectionId`;
- `provider = "mercadopago"`;
- `mpOrderId @unique` cuando ya exista;
- `externalReference @unique`, derivada del ID local del intento y de máximo 64 caracteres;
- `idempotencyKey @unique`, UUID v4;
- `checkoutUrl @db.Text`;
- `publicStatusTokenHash @unique`;
- `amount Int`, en la misma unidad que `Order.total`;
- `currency = "ARS"`;
- `status`;
- `providerStatus` y `providerStatusDetail`;
- `lastSyncedAt`, `approvedAt`, `terminalAt`;
- `createdAt`, `updatedAt`.

El monto se envía a Mercado Pago como string decimal con dos posiciones, por ejemplo `1500.00`. No convertir silenciosamente el modelo actual a centavos dentro de esta tarea.

### 7.7 `MercadoPagoWebhookEvent`

Bandeja persistente para procesamiento confiable:

- identificador único de notificación o `x-request-id`;
- `dataId` de la order;
- `userId`/collector informado;
- tipo de evento;
- payload mínimo JSON;
- `receivedAt`;
- `processingStartedAt` y `leaseExpiresAt`;
- `processedAt`;
- `attemptCount`;
- `lastError` sanitizado.

No usar solamente `data.id` como clave de deduplicación porque una misma order puede generar más de una actualización válida.

## 8. Migración y compatibilidad

La migración debe ser aditiva y segura:

1. crear enumeraciones y tablas nuevas;
2. agregar campos nuevos inicialmente con default o nullable;
3. rellenar `Order.paymentMethod` desde `checkout->>'paymentMethod'`:
   - `transfer` → `TRANSFER`;
   - cualquier otro valor histórico → `CASH`;
4. rellenar `inventoryState`:
   - `PAID`, `IN_PREPARATION`, `DELIVERED` → `COMMITTED`;
   - `PENDING_WHATSAPP`, `CANCELLED` → `UNRESERVED`;
5. volver obligatorio `paymentMethod` después del backfill;
6. dejar `acceptMercadoPago = false` para todas las tiendas existentes;
7. regenerar Prisma Client.

La migración no debe modificar totales, checkout snapshots ni estados históricos. Antes de aplicarla en producción se necesita backup de PostgreSQL y ensayo sobre una copia de datos.

## 9. Contratos HTTP propuestos

### 9.1 Vinculación del comerciante

#### `GET /api/admin/integrations/mercadopago/connect`

- Requiere sesión `MERCHANT` activa y tienda propia.
- Genera `state`, `code_verifier` y `code_challenge` S256.
- Guarda el estado efímero asociado a usuario y tienda.
- Redirige al consentimiento oficial de Mercado Pago.

#### `GET /api/admin/integrations/mercadopago/callback?code=...&state=...`

- Requiere la misma sesión que inició la conexión.
- Valida hash, pertenencia, expiración y uso único de `state`.
- Intercambia el código usando `code_verifier`.
- Valida que existan `access_token`, `refresh_token`, `user_id`, `scope` y expiración.
- Rechaza si ese `collectorId` ya pertenece a otra tienda.
- Cifra los tokens y crea/actualiza la conexión.
- Redirige a la configuración con un resultado no sensible.

El authorization code dura 10 minutos y los tokens duran aproximadamente 180 días. Cada renovación devuelve también un nuevo `refresh_token`, que debe reemplazarse atómicamente.

#### `DELETE /api/admin/integrations/mercadopago`

- Deshabilita inmediatamente nuevos checkouts.
- Rechaza la desconexión definitiva si existen intentos `CREATING`, `READY` o `PROCESSING`.
- Cuando no quedan pagos abiertos, elimina los ciphertexts locales y conserva solo metadatos de auditoría no secretos.
- Informa al vendedor que también puede revocar la autorización desde Mercado Pago.

Fuente: [Gestión y revocación de Access Tokens](https://www.mercadopago.com.ar/developers/es/docs/security/oauth/management)

### 9.2 Configuración de tienda

Extender `PATCH /api/admin/store` con `acceptMercadoPago`.

Reglas:

- no aceptar `true` sin conexión `ACTIVE`;
- marcar automáticamente `false` si el token queda revocado o requiere reconexión;
- nunca devolver tokens al cliente;
- devolver solo estado, `collectorId` parcialmente oculto, `connectedAt` y `expiresAt`.

### 9.3 Creación de pedidos

Extender `POST /api/orders`:

```ts
type PaymentMethod = "cash" | "transfer" | "mercadopago";

type CreateOrderRequest = {
  // Campos actuales sin cambios.
  paymentMethod: PaymentMethod;
  clientRequestId?: string; // UUID obligatorio para mercadopago.
};

type CreateOrderResponse =
  | {
      kind: "whatsapp";
      orderId: string;
      code: string;
      whatsappUrl: string;
    }
  | {
      kind: "mercadopago";
      orderId: string;
      code: string;
      checkoutUrl: string;
      statusToken: string;
    };
```

Agregar `kind` a efectivo/transferencia es compatible con el flujo actual mientras se mantenga `whatsappUrl`.

### 9.4 Estado público del pago

#### `GET /api/payments/mercadopago/status?token=...`

- El token es aleatorio, de alta entropía; en base se guarda únicamente su hash.
- Devuelve solo `orderCode`, estado público, total, moneda y fecha de actualización.
- No devuelve teléfono, dirección, tokens OAuth, IDs internos ni payloads del proveedor.
- Si la conciliación está desactualizada, puede consultar Mercado Pago con rate limit antes de responder.

### 9.5 Webhook

#### `POST /api/webhooks/mercadopago`

- Valida `x-signature` usando el secreto configurado y los datos indicados por Mercado Pago.
- Rechaza firmas inválidas.
- Resuelve el tenant por el `user_id`/collector de la notificación.
- Persiste el evento de forma idempotente.
- Responde `200` rápidamente; no realiza toda la lógica crítica dentro de la ventana HTTP.
- El worker consulta luego `GET /v1/orders/{id}` con el token del vendedor. El body del webhook y los parámetros de retorno nunca son la fuente final del estado.

Mercado Pago solicita una respuesta 200/201 dentro de 22 segundos y reintenta cuando no la recibe.

Fuente: [Notificaciones de pago de Orders](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/payment-notifications)

### 9.6 Mantenimiento interno

#### `POST /api/internal/mercadopago/maintenance`

- Protegido mediante `Authorization: Bearer ${CRON_SECRET}` con comparación constante.
- Ejecutado una vez por minuto.
- Procesa eventos webhook pendientes por lotes y con lease para evitar dos workers sobre la misma fila.
- Reintenta creaciones ambiguas con la misma idempotency key.
- Concilia reservas vencidas antes de liberar stock.
- Reconsulta pagos `PROCESSING`.
- Una ejecución diaria renueva tokens que vencen dentro de 30 días.
- Nunca falla el lote completo por un solo tenant.

## 10. Flujo OAuth detallado

1. El comerciante pulsa “Conectar Mercado Pago”.
2. El servidor verifica sesión, rol, estado del usuario y propiedad de la tienda.
3. Genera:
   - `state`: 32 bytes aleatorios;
   - `code_verifier`: 43–128 caracteres permitidos;
   - `code_challenge = BASE64URL(SHA256(code_verifier))`;
   - vencimiento de 10 minutos.
4. Guarda hash de `state` y cifra el verifier.
5. Redirige a Mercado Pago con `response_type=code`, `client_id`, redirect estático, `state`, `code_challenge` y `code_challenge_method=S256`.
6. Mercado Pago muestra el consentimiento al vendedor.
7. El callback valida sesión y `state`, consume el registro y canjea `code` en `/oauth/token`.
8. Guarda `user_id` como `collectorId` y cifra tokens con AES-256-GCM.
9. La tarjeta de configuración pasa a “Conectado”, pero el método solo se ofrece públicamente cuando `acceptMercadoPago` también está activo.

Para el cifrado usar IV aleatorio de 12 bytes, authentication tag y associated data compuesta por `storeId`, tipo de token y versión de clave. Un formato válido sería `v1:<iv>:<tag>:<ciphertext>`, con componentes Base64URL.

## 11. Creación de una order de Mercado Pago

### 11.1 Transacción local

1. Validar body con Zod.
2. Cargar la tienda publicada y activa, conexión `ACTIVE`, productos y opciones pertenecientes a ese tenant.
3. Recalcular el total en servidor usando la lógica del catálogo; nunca aceptar montos del navegador.
4. Agrupar la demanda por `productId`, porque el mismo producto puede aparecer más de una vez.
5. Dentro de una transacción PostgreSQL:
   - reutilizar la respuesta existente si `(storeId, clientRequestId)` ya fue creado;
   - descontar cada stock limitado con una condición atómica `stockQuantity >= demanda`;
   - abortar toda la transacción si un producto no tiene disponibilidad;
   - crear `Order` en `PENDING_PAYMENT`, `inventoryState = HELD` y `reservedUntil = now + 5 minutos`;
   - crear `PaymentAttempt` en `CREATING`, con UUID de idempotencia y token público hasheado.
6. La reserva se considera aplicada una sola vez. Cambiar luego a `PAID` no vuelve a descontar.

### 11.2 Solicitud a Mercado Pago

Usar `fetch` del servidor detrás de un adaptador propio y pequeño; no es necesario introducir el SDK para este conjunto reducido de endpoints.

```json
{
  "type": "online",
  "processing_mode": "manual",
  "capture_mode": "automatic_async",
  "total_amount": "1500.00",
  "external_reference": "mp_<paymentAttemptId>",
  "expiration_time": "PT5M",
  "items": [
    {
      "title": "Producto",
      "unit_price": "1500.00",
      "quantity": 1,
      "unit_measure": "unit",
      "total_amount": "1500.00"
    }
  ],
  "config": {
    "notification_url": "https://dominio.example/api/webhooks/mercadopago",
    "online": {
      "success_url": "https://dominio.example/pago/mercadopago?result=success&token=<opaque>",
      "failure_url": "https://dominio.example/pago/mercadopago?result=failure&token=<opaque>",
      "pending_url": "https://dominio.example/pago/mercadopago?result=pending&token=<opaque>",
      "auto_return": "all"
    },
    "payment_method": {
      "not_allowed_types": ["ticket"]
    }
  }
}
```

Enviar:

- `Authorization: Bearer <access_token cifrado del vendedor, descifrado solo en memoria>`;
- `X-Idempotency-Key: <UUID persistido>`;
- `Content-Type: application/json`.

No enviar `marketplace_fee`. Tampoco agregar `payer` mientras el checkout local no solicite email: si se envía `payer`, Mercado Pago exige `payer.email`.

Guardar el `id` y `checkout_url` devueltos. Verificar que `user_id` corresponda al `collectorId` esperado y que moneda y total coincidan antes de entregar la URL al navegador.

Fuentes:

- [Crear y configurar una order](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/create-order)
- [Referencia POST `/v1/orders`](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/create-order/post)
- [Configurar URLs de retorno](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/web-integration/configure-back-urls)
- [Excluir medios de pago](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/additional-settings/exclude-payment-methods)
- [Definir vigencia de la order](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/additional-settings/define-order-validity)

### 11.3 Fallos al crear

- `4xx` definitivo y validado: marcar intento rechazado/cancelado, orden `CANCELLED` y liberar stock en una transacción idempotente.
- Timeout, conexión cortada o `5xx`: el resultado es ambiguo. No liberar inmediatamente; reintentar con exactamente la misma idempotency key.
- Si el reintento devuelve la order existente, guardar sus IDs y continuar.
- Si no puede resolverse antes del vencimiento, consultar por referencia/ID antes de cancelar y liberar.

## 12. Estados, conciliación e inventario

La verdad de pago es la order obtenida desde la API de Mercado Pago. Aplicar las transiciones dentro de una transacción y usando el estado de inventario como guardia idempotente.

| Estado Mercado Pago | Estado local de pago | `Order.status` | Inventario | Acción |
| --- | --- | --- | --- | --- |
| `created/created` | `READY` | `PENDING_PAYMENT` | `HELD` | Esperar al comprador |
| `processing/*` | `PROCESSING` | `PENDING_PAYMENT` | `HELD` | Conservar reserva y conciliar |
| `processed/accredited` | `APPROVED` | `PAID` | `COMMITTED` | Confirmar pago sin descontar otra vez |
| `failed/*` | `REJECTED` | `CANCELLED` | `RELEASED` | Reponer exactamente una vez |
| `canceled/canceled` | `CANCELLED` o `EXPIRED` | `CANCELLED` | `RELEASED` | Reponer exactamente una vez |
| `processed/refunded` o `refunded/refunded` | `REFUNDED` | Conservar estado operativo | Sin cambio automático | Alertar al comercio |
| devolución parcial | `PARTIALLY_REFUNDED` | Conservar estado operativo | Sin cambio automático | Alertar al comercio |

Reglas adicionales:

- No ejecutar acciones irreversibles usando solo la URL de retorno.
- Si a los 5 minutos la order sigue `created`, intentar cancelarla en Mercado Pago, confirmar el resultado mediante GET y recién entonces liberar stock.
- Si a los 5 minutos está `processing`, mantener stock. Alertar si supera 30 minutos, pero no liberar mientras el proveedor no informe un estado terminal.
- Si Mercado Pago no responde durante la conciliación, conservar el stock para evitar vender una unidad que podría estar pagada.
- Si llega una aprobación después de que el stock ya fue liberado, intentar recuperarlo atómicamente. Si no alcanza, marcar `REVIEW_REQUIRED`, mantener la orden como pagada y alertar al comerciante para cumplir o reembolsar.
- Reembolsos y contracargos posteriores no reponen stock automáticamente porque el producto podría haber sido preparado o entregado.
- En órdenes Mercado Pago, el administrador no puede marcar manualmente un pago pendiente como pagado. Las transiciones financieras vienen del proveedor.
- El administrador sí puede pasar una orden ya pagada a `IN_PREPARATION` y `DELIVERED`.
- Una cancelación iniciada por el comercio debe cancelar primero la order remota y liberar stock únicamente después de confirmación terminal.

Fuente: [Estados de una order de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/payment-management/status/order-status)

## 13. Interfaz de usuario

### 13.1 Configuración del comercio

Agregar una tarjeta “Mercado Pago” con:

- estado `No conectado`, `Conectado`, `Requiere reconexión` o `Desconectado`;
- botón `Conectar Mercado Pago`;
- botón `Reconectar` cuando corresponda;
- switch `Aceptar Mercado Pago`, deshabilitado sin conexión activa;
- botón `Desconectar`;
- identificación parcial del collector y fecha de vencimiento;
- explicación de que Mercado Pago acredita el dinero directamente y descuenta su comisión.

No mostrar tokens, scopes crudos ni errores internos.

### 13.2 Checkout público

- Mostrar Mercado Pago solo cuando la tienda esté publicada, el dueño activo, `acceptMercadoPago = true` y la conexión `ACTIVE`.
- Mantener efectivo y transferencia tal como están.
- Al confirmar Mercado Pago, deshabilitar doble submit, enviar un `clientRequestId` generado una vez y reutilizarlo ante reintentos de red.
- Al recibir `checkoutUrl`, navegar en la misma pestaña a Mercado Pago.
- Si la creación está en estado ambiguo, mostrar “Estamos preparando el pago” y consultar el estado; no crear otra orden.

### 13.3 Página de resultado

Mostrar estados simples:

- pago aprobado;
- pago en proceso;
- pago rechazado/cancelado;
- sesión vencida;
- se necesita revisión.

La página consulta el endpoint propio con el token opaco y puede hacer polling breve. Los parámetros `result`, `status` o `collection_status` de la URL sirven solo para UX; nunca autorizan una transición de base de datos.

No abrir WhatsApp automáticamente. Se puede ofrecer “Contactar a la tienda” como acción secundaria.

### 13.4 Backoffice de pedidos

- Identificar el método Mercado Pago y el estado financiero separado del estado operativo.
- Mostrar ID externo abreviado, última conciliación y alertas.
- Ocultar acciones manuales que contradigan un pago abierto.
- Destacar `REVIEW_REQUIRED`, reembolsos parciales y contracargos.

## 14. Seguridad obligatoria

- Todo el código que lee secretos o tokens debe vivir en módulos server-only.
- Cifrar tokens en reposo con autenticación; no basta Base64.
- No guardar tokens dentro de `Store`, `Account`, cookies, localStorage, URLs o JSON de checkout.
- No registrar headers `Authorization`, respuestas completas de OAuth ni URLs que contengan el token público de estado.
- Validar sesión, rol y propiedad del tenant en todos los endpoints administrativos.
- Usar comparación constante para secretos de webhook/cron cuando corresponda.
- Validar firma del webhook antes de persistirlo.
- Después del webhook, consultar la order oficial y comprobar:
  - `mpOrderId`;
  - `external_reference`;
  - `user_id`/collector;
  - aplicación esperada si el campo está disponible;
  - moneda `ARS`;
  - monto exacto;
  - pertenencia de la orden al tenant.
- Los handlers de retorno y estado no exponen PII.
- Aplicar rate limiting a conexión OAuth, callback, creación de órdenes y consulta pública.
- Sanitizar mensajes externos antes de guardarlos en `lastError` o mostrarlos.
- Diseñar rotación de `MP_TOKEN_ENCRYPTION_KEY` mediante `tokenKeyVersion`; descifrar versiones anteriores y re-cifrar durante renovación o mantenimiento.

## 15. Renovación y conexiones inválidas

- Revisar diariamente conexiones que vencen dentro de 30 días.
- Renovar con `grant_type=refresh_token`.
- Reemplazar `access_token`, `refresh_token` y `expiresAt` en una sola transacción.
- Usar una marca o control optimista para impedir dos renovaciones concurrentes del mismo refresh token.
- Ante `401` confirmado o refresh inválido:
  - marcar `RECONNECT_REQUIRED`;
  - desactivar Mercado Pago para nuevas compras;
  - conservar metadatos e intentos existentes;
  - mostrar al comerciante que debe reconectar.
- Procesar las notificaciones de desautorización de la aplicación para aplicar la misma transición.

Fuente: [Renovar Access Token](https://www.mercadopago.com.ar/developers/es/docs/split-payments/additional-content/security/oauth/renewal)

## 16. Pruebas requeridas

El proyecto no tiene runner de tests. Para reducir dependencias, comenzar con `node:test` ejecutado mediante `tsx`; simular Mercado Pago detrás del adaptador de API. No efectuar llamadas reales desde tests unitarios.

### 16.1 Unitarias

- cifrado/descifrado y rechazo de ciphertext adulterado;
- hashing y consumo único de OAuth `state`;
- generación PKCE S256;
- traducción de todos los estados del proveedor;
- guardas de transición de `inventoryState`;
- cálculo y serialización del monto ARS;
- validación de firma webhook;
- sanitización de errores.

### 16.2 Integración con base de datos

- aislamiento estricto entre tenants;
- rechazo de un `collectorId` ya vinculado;
- backfill correcto de órdenes históricas;
- dos solicitudes con el mismo `clientRequestId` devuelven la misma orden;
- dos compradores disputando la última unidad: solo uno reserva;
- múltiples líneas del mismo producto se agregan antes de validar stock;
- aprobación no vuelve a descontar una reserva;
- cancelación/webhook duplicado repone stock una sola vez;
- eventos duplicados y fuera de orden no retroceden un estado terminal;
- procesamiento previo al minuto 5 conserva la reserva;
- order creada y vencida libera solo tras confirmación remota;
- aprobación tardía con y sin stock disponible;
- renovación concurrente de token;
- una falla de un tenant no bloquea el lote del worker.

### 16.3 Contratos HTTP

- sesión y roles en endpoints administrativos;
- `state` ausente, vencido, reutilizado o de otro usuario;
- webhook con firma inválida;
- webhook válido con collector, referencia, monto o moneda incorrectos;
- timeout/5xx al crear y reintento con la misma idempotency key;
- respuesta discriminada para WhatsApp y Mercado Pago;
- endpoint público no filtra PII.

### 16.4 Prueba oficial y producción

- usar cuentas de prueba vendedora y compradora distintas;
- probar tarjetas aprobada, rechazada y en procesamiento;
- usar el simulador oficial de Webhooks;
- probar retorno success/failure/pending;
- verificar efectivo, transferencia y WhatsApp;
- ejecutar `pnpm lint`, `pnpm typecheck` y `pnpm build`;
- realizar una compra productiva real de importe mínimo;
- verificar acreditación en la cuenta correcta;
- realizar un reembolso desde Mercado Pago y comprobar su conciliación local.

Fuentes:

- [Compra de prueba de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/integration-test/test-purchase-with-card)
- [Salir a producción](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/go-to-production)

## 17. Observabilidad y operación

Registrar métricas o logs estructurados, siempre sin secretos:

- conexiones activas y que requieren reconexión;
- tokens próximos a vencer;
- órdenes creadas, aprobadas, rechazadas y en procesamiento;
- latencia y errores por endpoint de Mercado Pago;
- webhooks inválidos, pendientes y con reintentos;
- reservas vencidas sin conciliar;
- pagos en proceso por más de 30 minutos;
- diferencias de monto, moneda, referencia o collector;
- casos `REVIEW_REQUIRED`.

Alertas mínimas:

- webhook backlog mayor a 5 minutos;
- token que vence en menos de 7 días y no pudo renovarse;
- pago aprobado sin stock;
- reserva vencida que no puede consultarse/cancelarse;
- discrepancia de identidad o monto;
- tasa sostenida de errores 401, 429 o 5xx.

No depender únicamente de logs efímeros: los intentos, eventos y últimos errores sanitizados deben quedar auditables en PostgreSQL.

## 18. Estrategia de despliegue

1. Implementar y probar migración sobre una copia de la base.
2. Desplegar tablas, servicios y UI con `acceptMercadoPago = false`.
3. Configurar aplicación, OAuth, secretos, HTTPS, webhook y scheduler en producción.
4. Vincular una cuenta de prueba y completar la matriz de pruebas.
5. Habilitar una única tienda piloto.
6. Hacer un pago real mínimo y un reembolso.
7. Monitorear al menos un ciclo completo de pago, procesamiento, expiración y renovación simulada.
8. Habilitar gradualmente más tiendas.
9. Mantener un interruptor por tienda; ante una incidencia global, ocultar Mercado Pago sin afectar efectivo o transferencia.

No activar públicamente el método si faltan webhook, scheduler, cifrado o conciliación.

## 19. Criterios de aceptación

La integración estará terminada únicamente cuando:

- un comerciante pueda vincular y reconectar su cuenta sin compartir credenciales;
- otra tienda no pueda ver ni utilizar esa conexión;
- una compra cree la order con el token del vendedor correcto;
- el dinero llegue a ese vendedor y la plataforma no cobre comisión;
- el checkout no ofrezca pagos `ticket`;
- el stock quede reservado por cinco minutos sin overselling;
- un pago aprobado comprometa stock sin doble descuento;
- rechazo, cancelación o expiración repongan exactamente una vez;
- pagos en proceso se concilien sin liberar prematuramente;
- URLs de retorno y webhooks falsificados no puedan marcar una orden pagada;
- duplicados y reintentos no creen dos cobros ni dos órdenes locales;
- efectivo, transferencia, WhatsApp y administración actual sigan funcionando;
- el comercio vea estados y alertas comprensibles;
- lint, typecheck, build y pruebas estén verdes;
- el piloto productivo acredite y reembolse correctamente.

## 20. Fuera de alcance de esta primera integración

- cobrar comisión para la plataforma;
- modelo Split 1:N;
- Checkout API/Bricks embebido;
- guardar tarjetas;
- suscripciones o pagos recurrentes;
- pagos en otros países o monedas;
- Rapipago, Pago Fácil u otros métodos offline;
- facturación fiscal automática;
- stock por variante;
- reembolso automático por falta de stock;
- panel financiero o liquidaciones avanzadas;
- múltiples intentos de Mercado Pago sobre una misma orden local.

Si se decide cobrar comisión más adelante, deberá diseñarse como una fase separada: validar contrato/comercialización, agregar configuración auditada de comisión y recién entonces enviar `marketplace_fee`.

## 21. Orden recomendado de implementación

1. Volver a revisar documentación oficial y APIs contra la fecha de implementación.
2. Diseñar migración y pruebas de invariantes de inventario.
3. Crear adaptador server-only de Mercado Pago, cifrado y manejo de errores.
4. Implementar conexión OAuth completa y renovación.
5. Implementar modelos de conexión, intentos y webhook inbox.
6. Refactorizar stock al modelo `InventoryState` sin cambiar el flujo actual.
7. Extender creación de pedidos e integrar `/v1/orders`.
8. Implementar webhook, worker y conciliación.
9. Agregar configuración, checkout, página de resultado y backoffice.
10. Completar pruebas, observabilidad y despliegue piloto.

## 22. Índice de fuentes oficiales

- [Requisitos de Split de Pagos 1:1](https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/prerequisites)
- [Crear configuración Marketplace](https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/create-configuration)
- [Integrar Checkout en Split 1:1](https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace)
- [Introducción a OAuth](https://www.mercadopago.com.ar/developers/es/docs/security/oauth/introduction)
- [Authorization Code y PKCE](https://www.mercadopago.com.ar/developers/es/docs/security/oauth/creation)
- [Buenas prácticas OAuth](https://www.mercadopago.com.ar/developers/es/docs/split-payments/additional-content/security/oauth/best-practices)
- [Renovación de Access Token](https://www.mercadopago.com.ar/developers/es/docs/split-payments/additional-content/security/oauth/renewal)
- [Gestión y revocación de tokens](https://www.mercadopago.com.ar/developers/es/docs/security/oauth/management)
- [Checkout Pro: Orders API recomendada](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro-orders/overview)
- [Crear y configurar una order](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/create-order)
- [Referencia de creación de order](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/create-order/post)
- [URLs de retorno](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/web-integration/configure-back-urls)
- [Excluir medios de pago](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/additional-settings/exclude-payment-methods)
- [Vigencia de la order](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/additional-settings/define-order-validity)
- [Webhooks de Orders](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/payment-notifications)
- [Estados de Orders](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/payment-management/status/order-status)
- [Pruebas de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/integration-test/test-purchase-with-card)
- [Salida a producción](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/go-to-production)
- [Tarifas públicas de Checkout en Argentina](https://www.mercadopago.com.ar/herramientas-para-vender/check-out)
