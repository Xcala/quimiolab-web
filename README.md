# Quimiolab — sitio web en Astro

Sitio estático (Astro 7) + Firebase Hosting. Método: skill `migracion-web-astro`. Plan y bitácora en el Project de Claude
(`WEB_PLAN_MIGRACION_SEO.md`, `WEB_SITIO_ASTRO.md`).

## Correr en el PC (PowerShell)
```
npm.cmd install
npm.cmd run data          # export/*.json → src/data/*.json + redirects.csv
npm.cmd run dev           # http://localhost:4321
npm.cmd run build         # dist/ + índice de Pagefind + check_build
npm.cmd run build:preview # igual, con noindex y sin GTM (para el canal de vista previa)
npm.cmd run firebase:json # genera firebase.json desde redirects.csv
```
Requisitos: Node 22, Python 3 (para `prep_data.py`), Firebase CLI (`firebase.cmd`) con la cuenta nicolas@braindy.co.

## Carpetas
- `export/` — export crudo del WordPress (JSON), manifiesto de imágenes y definiciones de formularios. **No se edita.**
- `scripts/prep_data.py` — limpia el HTML del CMS y arma los JSON del sitio. Cualquier cambio de contenido se hace en el JSON del export o en el script, nunca a mano en `src/data/`.
- `src/data/` — datos generados (no editar a mano).
- `src/styles/global.css` — tokens (primitivos → semánticos), tema oscuro, escalado fluido, base y componentes CSS.
- `src/lib/` — datos, íconos, SEO (JSON-LD), sitemaps.
- `src/components/`, `src/layouts/Base.astro`, `src/pages/` — plantillas. `/sistema/` es la guía viva (noindex).
- `public/marcas/` — logos de aliados (del manual de marca). `public/img/` — fotos del home con tratamiento de marca.
- `redirects.csv` — origen, destino, código. Generado por `prep_data.py`; se puede completar a mano (Excel: CRLF/BOM tolerados).

## Rutas
Se conservan `/producto/{slug}/` (521, incluidos los 19 equipos con etiqueta *Equipo*), `/contactenos/`, `/nosotros/` y los 3 registros sanitarios INVIMA.
Cambian con 301: `/marca/x/` y `/x/` → `/marcas/x/`; posts en raíz → `/blog/{slug}/`; `/linea-*` → `/soluciones/*/`; basura de WooCommerce → `/` o `/productos/`.

## Editor in situ (el cliente edita sin código)

Home, Nosotros y Contáctenos se editan desde la propia página: abrir la URL con `?edit` (p. ej. `https://www.quimiolab.com.co/?edit`),
entrar con Google (correos de `src/editor/config.ts` → `ADMINS`, los mismos de `firestore.rules`), tocar textos, «Cambiar foto»,
«Destino» de botones y la barra de cada sección (subir, bajar, ocultar). Nada se ve hasta **Publicar** (un batch en Firestore,
colección `page_contents`, un documento por bloque + `layout__<página>`).

Cómo llega al sitio: los visitantes cargan un script pequeño (`src/scripts/contenido.ts`) que aplica lo publicado (REST, caché 10 min).
Además `npm run build` hornea lo publicado en el HTML (`scripts/fetch_content.mjs` → `src/data/contenido.json`, y
`scripts/aplicar_layout.mjs` para el orden de secciones), así Google ve lo mismo tras cada deploy.

Para marcar un bloque nuevo: `<Ed id="pagina_seccion_elemento" as="h2">…</Ed>`, `<EdImg id=… src=… alt=… />`,
`<EdLink id=… href=…><Ed id=…>texto</Ed></EdLink>`, secciones con `data-ed-sec="clave" data-ed-label="Nombre"` y la página con
`<Base editable="clave-pagina">`. Los ids no se renombran nunca (el cliente perdería ese contenido).

Configuración (una vez, consola de Firebase → quimiolab-web):
1. Authentication → Sign-in method → Google → habilitar. Dominios autorizados: `quimiolab.com.co`, `www.quimiolab.com.co`, `quimiolab-web.web.app`, el canal `vista-previa`.
2. Firestore Database → crear base (modo producción, `(default)`, región `us-central1` o `southamerica-east1`).
3. Configuración del proyecto → Tus apps → agregar app web → copiar `apiKey` y `appId` a `src/editor/config.ts`.
4. `firebase deploy --only firestore:rules` (sube `firestore.rules`).
5. `npm install` en `C:\quimiolab-web` (nueva dependencia `firebase`), luego `npm run deploy:preview` como siempre.

Probar la interfaz sin Firebase: `cross-env PUBLIC_ED_DEMO=1 npm run build` y abrir `/?edit` (Publicar no guarda).

## Pendiente
- Fase E: `npm run images` (= `node scripts/download_images.mjs`, usa sharp; no necesita Python): descarga las imágenes del WP viejo y de Webflow a `public/media/` en WebP, escribe `src/data/image-map.json` y reescribe `src/data/*.json`. `npm run data` vuelve a aplicar el mapa después de regenerar los datos.
- Cloud Function `formulario` (`functions/`) + `firestore.rules`.
- Páginas: `/politica-de-datos/`, `/linea-de-transparencia/`, `/vinculacion/`, `/trabaja-con-nosotros/`, `/eventos/` (contenido del Webflow viejo en `quimiolab-contenido-consolidado.md`).
- Número real de WhatsApp comercial (hoy `573000000000` de relleno) y horario de atención.
- Fuentes autohospedadas (hoy Google Fonts).
