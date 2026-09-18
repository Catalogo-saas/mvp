# Cargas directas de imágenes a Cloudflare R2

Las imágenes se optimizan en el navegador, se suben directamente a R2 mediante una URL `PUT` prefirmada y se guardan inicialmente bajo `pending/`. Al guardar el producto o la configuración, la API valida el objeto y lo copia al prefijo definitivo.

## CORS del bucket

En **R2 → landing-saas → Settings → CORS Policy**, configurar los orígenes reales desde los que se usa el panel. Reemplazar `https://tu-dominio.com` y agregar explícitamente cualquier dominio de preview que deba funcionar.

```json
[
  {
    "AllowedOrigins": [
      "https://tu-dominio.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

No usar el dominio público `r2.dev` para la URL prefirmada. El backend la genera contra `S3_ENDPOINT`; `PUBLIC_FILE_BASE_URL` se utiliza solamente para las URLs públicas finales.

## Limpieza de temporales

En **R2 → landing-saas → Settings → Object lifecycle rules**, crear una regla habilitada con:

- Nombre: `Delete abandoned pending uploads`
- Prefix: `pending/`
- Acción: eliminar objetos después de `1 day`

Esta regla solo afecta cargas que nunca fueron promovidas. Las imágenes definitivas se guardan en `products/`, `logos/`, `hero/` o `categories/`.

## Verificación de despliegue

1. Confirmar que `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` y `PUBLIC_FILE_BASE_URL` están cargadas en Vercel.
2. Subir una fotografía JPG de más de 4,5 MB desde Productos y comprobar que termina publicada como WebP.
3. Repetir con logo, hero y categoría.
4. En DevTools, comprobar que el `PUT` va directamente a `r2.cloudflarestorage.com` y que las llamadas a `/api/admin/*` envían JSON sin archivos.

