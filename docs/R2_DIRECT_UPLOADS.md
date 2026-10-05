# Cargas directas de imágenes a Cloudflare R2

Al seleccionar imágenes, el navegador empieza a optimizarlas y subirlas directamente a R2 mediante URLs `PUT` prefirmadas agrupadas. Se guardan inicialmente bajo `pending/` y el guardado reutiliza ese trabajo ya iniciado. Luego, la API valida los objetos en paralelo y los copia al prefijo definitivo.

La optimización solicita WebP, pero el navegador puede devolver PNG o JPEG. Antes de subir, el cliente detecta el formato real a partir de los bytes y usa el MIME y la extensión correspondientes. Las imágenes optimizadas mantienen el límite de 2 MB y 2560 píxeles; los GIF se conservan sin recomprimir y admiten hasta 10 MB. El servidor comprueba que el contenido coincida con el MIME declarado.

## CORS del bucket

En **R2 → landing-saas → Settings → CORS Policy**, configurar los orígenes exactos desde los que se usa el panel. No agregar aquí la URL pública `r2.dev`: es el destino de lectura del bucket, no el origen de la aplicación que realiza la carga.

```json
[
  {
    "AllowedOrigins": [
      "https://catalogo-web-ar.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Los orígenes no deben terminar en `/`. Si el panel se publica en un dominio propio, agregar ese origen exacto en la misma lista. Evitar habilitar todos los previews de Vercel mediante un comodín; agregar únicamente los entornos que realmente deban subir archivos.

No usar el dominio público `r2.dev` para la URL prefirmada. El backend la genera contra `S3_ENDPOINT`; `PUBLIC_FILE_BASE_URL` se utiliza solamente para las URLs públicas finales.

## Limpieza de temporales

En **R2 → landing-saas → Settings → Object lifecycle rules**, crear una regla habilitada con:

- Nombre: `Delete abandoned pending uploads`
- Prefix: `pending/`
- Acción: eliminar objetos después de `1 day`

Esta regla solo afecta cargas que nunca fueron promovidas. Las imágenes definitivas se guardan en `products/`, `logos/`, `hero/` o `categories/`.

## Verificación de despliegue

1. Confirmar que `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` y `PUBLIC_FILE_BASE_URL` están cargadas en Vercel.
2. Subir una fotografía JPG de más de 4,5 MB desde Productos y comprobar que se guarda correctamente. El resultado será WebP, PNG o JPEG según la compresión del navegador, con una extensión y un MIME que coincidan con sus bytes.
3. Repetir con logo, hero y categoría.
4. En DevTools, comprobar que el `PUT` va directamente a `r2.cloudflarestorage.com` y que las llamadas a `/api/admin/*` envían JSON sin archivos.
5. Repetir con una imagen WebP desde Chromium y desde un navegador que use WebKit, verificando también el caso en que la compresión devuelve PNG.

Después de desplegar una corrección de formato, recargar el formulario y volver a seleccionar las imágenes para generar nuevas cargas temporales. Las cargas anteriores mal etiquetadas se eliminan mediante la regla de limpieza de `pending/`.
