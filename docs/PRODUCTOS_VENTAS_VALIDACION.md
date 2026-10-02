# Productos y ventas — implementación y validación

Referencia: recorridos de Tienda Negocio inspeccionados mediante MCP y capturas del pedido. Se conserva la identidad visual del panel actual.

## Alcance implementado

- Menús anclados en los tres puntos del catálogo y de cada producto, con teclado, Escape y cierre al hacer clic afuera. Sin modal de acciones.
- Búsqueda automática con debounce de 300 ms, sincronización con URL, reinicio de página y cancelación de consultas anteriores.
- Filtros de productos por categoría, stock, oferta, variantes, imágenes y visibilidad; orden por catálogo, fecha, nombre, precio efectivo y SKU. Sin campos de peso, dimensiones o tipo de producto.
- Filtros de productos y ventas a pantalla completa en mobile, con edición temporal hasta Aplicar y reinicio de filtros sin borrar la búsqueda.
- Estado visible/oculto con iconos, sin controles de producto destacado ni línea de precio/stock redundante en mobile.
- Resumen de propiedades con chips, valor personalizado que se convierte en input y ordenamiento mediante asa de arrastre o teclado.
- Categorías jerárquicas de hasta tres niveles y múltiples rutas, sin creación de categorías desde el producto.
- Galería completa, vista ampliada, portada, ordenamiento y adición/eliminación de imágenes en el borrador del producto. Se mantiene el límite existente de seis fotos y la asociación de imagen por variante.
- Guardado de producto de ancho completo en mobile, con espacio para alcanzar los últimos campos.
- Listado mobile de ventas y detalle por bloques: pago, envío, compra, notas del cliente, cliente, envío, facturación, seguimiento e historial. Sin adjuntar factura ni notas internas.
- Estado de venta abierta, no leída, archivada o cancelada. Navegación anterior/siguiente dentro del contexto del listado.
- Contador de ventas no leídas en navegación mobile y escritorio: todas las no leídas, incluso archivadas o canceladas. Actualización al leer, al volver al foco, al navegar y cada 30 segundos con la pestaña visible.

## Migración y despliegue

La migración `20260929000000_order_read_state` agrega `Order.readAt` nullable y un índice compuesto por tienda/lectura. Las ventas existentes y nuevas empiezan sin leer. Fue aplicada únicamente en la base local configurada.

En otros entornos, verificar el respaldo y aplicar `pnpm exec prisma migrate deploy`, regenerar Prisma y reiniciar el proceso antes de servir esta versión. El cliente Prisma cacheado por un proceso de desarrollo anterior no reconoce el campo nuevo hasta reiniciarse.

La lectura usa un endpoint independiente y un UPDATE parametrizado que no modifica la versión comercial `updatedAt`, ni stock, estados, eventos o correos. Es idempotente y está restringido al tenant autenticado. No se marca una venta por prefetchear su enlace; requiere montar el detalle con la pestaña visible.

## Verificación realizada

- `pnpm test`: 99 pruebas, 20 archivos, todas aprobadas. Incluyen filtros, ordenamiento, aislamiento por tenant y contrato de lectura sin efectos comerciales.
- `pnpm typecheck`: aprobado.
- `pnpm lint`: sin errores; persiste una advertencia previa en `components/public-store.tsx` sobre navegación interna.
- `pnpm build`: compilación de producción aprobada.
- MCP/Chrome: catálogo y detalle de ventas en escritorio; mobile a 390 px y listado a 320 px sin desbordamiento horizontal.
- Menús sin diálogo, filtros full screen, búsqueda sin Enter, categorías en cascada, galería, reordenamiento de variantes con ratón y teclado, guardado y últimos campos visibles.
- Guardado real de un producto QA con nueva propiedad/valor, orden de variantes, orden de fotos y múltiples categorías: se conservaron visibilidad, precios, stock e imagen de las variantes existentes.
- Ventas QA abiertas, archivadas y canceladas incluidas en No leídos; contador y listado actualizados al abrir/volver. Comparación en base: `updatedAt`, estado, stock reservado y cantidad de eventos permanecen iguales.

Los fixtures locales se crean con `pnpm exec tsx scripts/commerce-workflow-qa.ts`, se inspeccionan con `inspect` y se eliminan con `cleanup`. El script restringe sus operaciones a una base local y a IDs propios con prefijo `qa_commerce_workflow_`; no modifica datos existentes.
