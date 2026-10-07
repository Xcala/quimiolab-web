# Quimiolab — Plan de migración a Astro + Firebase (método Revista Level)

Fecha: 2026-09-28 · Responsable técnico: Nicolas (Braindy) · Aprobación de contenido: Quimiolab
Método: skill `migracion-web-astro` (probado en Revista Level, sep. 2026). Regla de oro: **cambiamos cómo se construye el sitio, no lo que Google ve.** Cada URL de hoy responde igual en el sitio nuevo o hace UNA sola 301 a su equivalente exacto.

## 0. Lo que ya está decidido y lo que ya tenemos

| Pregunta del método | Respuesta para Quimiolab |
|---|---|
| Origen | WordPress + WooCommerce en `www.quimiolab.com.co` (sitio en vivo, 1–2 años). Webflow viejo `quimiolab.com` (8 años de SEO) ya extraído por API; hoy solo hace 302 al home. |
| Referencia visual aprobada | Home HTML publicado el 2026-09-12 (`Sitio Web 2026/quimiolab-home-diseno.html` en Drive) + sistema de marca (`CLAUDE.md`, `brand/`). La referencia final será el propio sitio y su página `/sistema`. |
| Carpeta del código | `G:\Mi unidad\Quimiolab\Quimiolab - Agent\web` (decisión 2026-09-28). Respaldo zip en `Quimiolab - Agent\web\_respaldos\`. |
| Cuenta Firebase | `nicolas@braindy.co`, proyecto nuevo `quimiolab-web`, plan Blaze con presupuesto US$10 y avisos 50/90/100 %. |
| Dinámico | Formularios (contacto/cotización, vinculación de proveedores, trabaja con nosotros, inscripción a eventos, denuncias) y búsqueda (Pagefind, estática). **No hay tienda:** los 521 productos son catálogo con botón "Cotizar" (decisión 2026-09-28). |
| CMS | **No.** Braindy publica: contenido en `src/data/*.json`, cada cambio es un build (decisión 2026-09-28). |
| Terceros | Se quedan: GA4/GTM con el mismo ID, píxel de Meta, botón de WhatsApp (enlace, sin script). Se va: todo plugin de WP (incluido el slider de logos con backdoor). |
| Contenido exportado | `quimiolab-contenido-consolidado.md` (1,4 MB): WP = 50 páginas, 57 posts, 521 productos, 26 marcas; Webflow = 17 páginas, 472 productos, 24 equipos, 25 marcas, 65 líneas, 59 posts, 14 eventos científicos, 2 casos, 3 portafolios, 18 banners. Solo URLs de imágenes (no descargadas). |

Nota sobre la carpeta en Drive: `node_modules` y `dist/` deben ir en `.gitignore` y marcarse como "no sincronizar" en Google Drive para escritorio (o vivir en `C:\quimiolab-web-node` con un `junction`), si no el build se vuelve lento y Drive sube miles de archivos.

## 1. Stack fijo

- **Astro** (última estable), salida estática. Islas de **React** solo en: buscador del catálogo con filtros, formulario de cotización, formularios largos (vinculación KYC, trabaja con nosotros con CV), interruptor de tema y aviso de cookies.
- **Pagefind** para la búsqueda global (`/buscar`, `noindex, follow`). Cubre productos, equipos, marcas y blog.
- **Firebase Hosting** con `firebase.json` generado por script (redirecciones, cabeceras, rewrite `/api/form`). **Cloud Functions 2.ª gen** (Node 22) para formularios.
- Contenido en `src/data/`: `marcas.json`, `equipos.json`, `productos.json`, `lineas.json`, `categorias.json`, `posts.json`, `eventos.json`, `casos.json`, `paginas.json`, `image-map.json`.
- Formularios guardan en Firestore `envios` y avisan por SMTP de Workspace a `contactenos@quimiolab.com` (mismo buzón que hoy). Esto reemplaza Fluent Forms + WP Mail SMTP y deja el historial de leads guardado, cosa que hoy no pasa.

## 2. Fase A — Auditoría y línea base (1 semana)

Ya hecho (2026-09-11/12): auditoría pública y con wp-admin, inventario de contenido de ambos sitios, informe y slides de arquitectura, mapa preliminar de redirecciones.

Falta para cerrar la línea base, en este orden:

1. **Rastreo completo del WP en vivo** desde el PC de Nicolas (Screaming Frog o script): URL, estado, title, meta, H1, canonical, palabras, enlaces internos, imágenes. Guardar en Drive `Quimiolab - Agent\web\linea-base\rastreo_2026-MM-DD.csv`. Verificar los puntos que en Level fallaron: canonical (http vs https, doble barra), meta faltantes, H1 múltiples, JSON-LD ausente (WP sin plugin SEO: seguro no hay), sitemap con basura (`/sample-page/`, `/offerings/`, checkout/cart/my-account de WooCommerce), www/no-www.
2. **Search Console 16 meses** por página y consulta (exportar desde la cuenta del cliente; pedir acceso de propietario a Nicolas si no lo tiene) y **GA4 12 meses** por ruta. Anotar el ID de GA4/GTM que hoy carga el WP (leer el `<head>` en vivo).
3. **Wayback CDX** de `quimiolab.com` desde Chrome (bloqueado en el contenedor): años de indexación por URL del Webflow viejo. Con eso se decide qué rutas viejas merecen 301 propia en vez del 302 genérico actual.
4. **`inventario_urls.csv`**: sitemap WP + CMS + GA4 + Search Console + enlaces externos + rutas Webflow con historial. Columnas: `url, origen, estado_hoy, vistas_12m, clics_16m, enlaces_externos, decision (conservar | 301 → destino), destino`. **Ninguna URL sin decisión.**
5. **Exportar de nuevo por API con cuerpo HTML** (el consolidado tiene el texto; para migrar hace falta el HTML de cada post/página/producto con sus etiquetas): `/wp-json/wp/v2/pages|posts?per_page=100&_embed`, `/wp-json/wc/store/v1/products`, taxonomías. Guardar crudo en `export/out/` + `images_manifest.txt` con todas las URLs de `wp-content/uploads` y del CDN de Webflow.

## 3. Fase B — Mapa de URLs (decisión pendiente, ver §11.1)

Política general del método: **las URLs del sitio en vivo no cambian.** Redirigen solo las que desaparecen. https, un solo host (`www.quimiolab.com.co`, como hoy), sin barra final o con barra final según lo que hoy indexa Google (WP usa barra final: se conserva), minúsculas, una sola 301, nunca cadenas.

Propuesta de mapa:

| Hoy (WP) | Sitio nuevo | Decisión |
|---|---|---|
| `/` | `/` | Conservar |
| `/producto/{slug}/` (521) | `/producto/{slug}/` | **Conservar** (ver §11.1). Ficha única; la marca es el eje de navegación y del breadcrumb, no del path. |
| `/marca/{marca}/` (26) | `/marcas/{marca}/` | 301 1:1. Página de marca real: perfil + equipos + productos + contenidos. |
| `/linea-diagnostico/`, `/linea-diagnostico-molecular/`, `/linea-investigacion/`, `/linea-point-of-care/` | `/soluciones/{linea}/` | 301 1:1. Hubs de descubrimiento; enlazan a fichas, no las duplican. |
| `/productos-linea-{x}/`, `/equipos-linea-{x}/` (8) | `/soluciones/{linea}/productos/`, `/soluciones/{linea}/equipos/` | 301 1:1. |
| `/{post-slug}/` (57 posts en raíz) | `/blog/{post-slug}/` | 301 1:1 o **conservar en raíz** (§11.1). |
| `/contactenos/` | `/contactenos/` | Conservar. |
| `/sample-page/`, `/offerings/`, `/cart/`, `/checkout/`, `/my-account/` | — | 301 al padre lógico (`/`, `/productos/`) y fuera del sitemap. |
| `quimiolab.com/*` (Webflow, hoy 302 al home) | ruta equivalente en `.com.co` | 301 por ruta para las que tengan historial (contacto, nosotros, marcas, equipos, productos, blog, eventos). El resto, 301 al home como hoy pero permanente. |
| `en.quimiolab.com` | — | Decisión 2026-09-11 pendiente (§11.3). Recomendado: 301 al home de `.com.co` + solicitud de retiro en Search Console. |

Rutas nuevas (no existen hoy): `/equipos/{slug}/` (24), `/equipos/`, `/productos/`, `/marcas/`, `/eventos/`, `/eventos/{slug}/`, `/casos/`, `/casos/{slug}/`, `/nosotros/`, `/sistema/` (noindex), `/buscar/` (noindex), `/404`.

`redirects.csv` (origen, destino, 301) se genera desde `inventario_urls.csv`; `build_firebase_json.mjs` lo convierte a `firebase.json`. Las redirecciones del Webflow viejo no salen por API: las que existan se exportan a mano desde Site settings › Publishing.

## 4. Fase C — Sistema de diseño en código (1 semana, en paralelo con A)

Parte del home aprobado y del manual de marca, y lo formaliza según la skill:

- **Tokens en 3 capas** en `src/styles/global.css` + `tokens.json` (W3C). Primitivos: `--navy #001A4D`, `--corp #003087`, `--azul #0097D6`, `--claro #C2D8EC`, `--paper #F3F7FB`, `--ink #0B1B3A`, `--ink-2 #4A5A78`, `--line #DCE6F0`. Semánticos: `--canvas`, `--card`, `--ink`, `--action`, `--btn`, `--focus`. De componente solo donde haga falta (chip de aliado: `--aliado` toma el color oficial de la marca representada, regla del manual).
- **Modo oscuro con paleta propia.** El home aprobado ya es dark-first (navy). Para el sitio completo el tema claro es el principal en catálogo y blog (legibilidad de fichas y tablas técnicas) y el oscuro es el alterno; hero, resultados, eventos y contacto mantienen navy en ambos temas. Sin negro ni blanco puros en dark; contraste AA calculado. Tres bloques (`:root`, `[data-theme="dark"]`, `prefers-color-scheme`) + interruptor `role="switch"` + script anti-parpadeo en `<head>`.
- **Cortes cerrados:** 480, 640, 760, 900, 1080, 1180 + escritorio (los de Level). Documentar qué cambia en cada uno. Aprobación en 390, 768, 1280 y 1440 px sin scroll horizontal; áreas táctiles ≥ 44 px.
- **Escalado fluido** (skill `escalado-fluido`): todo en rem, crece solo desde 1440 px (16 → 20 px hasta 1920). Bordes, sombras, pills y media queries en px.
- **Movimiento en tokens** (`--dur-1..4`, `--ease-*`) apagado por `prefers-reduced-motion`. El marquee de marcas del home queda estático con reduced-motion.
- **Íconos** en `src/lib/icons.ts`, cuadrícula 24, un trazo, nombres en español por función (`buscar`, `telefono`, `correo`, `ubicacion`, `whatsapp`, `flecha`, `escudo`, `matraz`, `certificado`…). Los que ya tiene el home se migran tal cual.
- **Estados completos** de botón, campo, vacío, error, esqueleto y alertas; búsqueda sin resultados.
- **Logos:** `#qlogo` y `#qlupa` como componentes `<Logo/>` con `fill="currentColor"` desde los SVG reales de Drive. Logos de aliados siempre sobre placa blanca (regla del manual). Lockup Quimiolab | SD BIOSENSOR como componente fijo.
- **Tipografía:** Poppins 600/700 y Roboto 400/500/700 autohospedadas en `/fonts` (no Google Fonts en producción: velocidad y sin terceros), `font-display: swap`.
- **Guía viva `/sistema`** (noindex) con tokens, íconos, estados y cortes en claro y oscuro.

## 5. Fase D — Datos y plantillas (2 semanas)

`scripts/prep_data.py` convierte `export/out/` en los JSON del sitio:

- Deduplicar productos que están en WP y Webflow (misma referencia/SKU o mismo nombre normalizado); gana WP (en vivo), Webflow aporta campos faltantes (imagen, descripción larga).
- Cada producto: una marca (`marca_slug`), n categorías, línea(s), SKU, ficha técnica (PDF si existe), imágenes.
- Cada equipo: marca, línea, especificaciones, packshot, productos relacionados.
- Limpieza del HTML sin cambiar el texto: quitar clases de WP/Elementor y `w-richtext`, alts basura, enlaces absolutos a `quimiolab.com` y `quimiolab.com.co`, primera imagen del cuerpo si repite la de cabecera; convertir embeds (YouTube) a `<lite-youtube>`.
- Blog: conservar `datePublished`/`dateModified` reales del WP. Nunca refrescar fechas en masa.

Plantillas (Astro):

| Plantilla | Rutas | JSON-LD |
|---|---|---|
| Home | `/` | `Organization` (NIT, dirección, PBX), `WebSite` + `SearchAction` |
| Marca | `/marcas/{slug}/` | `Organization` (la marca) + `BreadcrumbList` + `ItemList` |
| Listados | `/productos/`, `/equipos/`, `/marcas/`, `/soluciones/{linea}/…`, `/blog/`, `/eventos/`, `/casos/` con paginación `?page=2` rastreable | `CollectionPage` + `BreadcrumbList` |
| Ficha de producto | `/producto/{slug}/` | `Product` (sin `offers`: no hay precio público; `brand`, `sku`, `category`) + `BreadcrumbList` |
| Ficha de equipo | `/equipos/{slug}/` | `Product` + `BreadcrumbList` |
| Artículo | `/blog/{slug}/` (o raíz, §11.1) | `Article` + `Person` autor |
| Evento | `/eventos/{slug}/` | `Event` (fecha, modalidad, `EventAttendanceMode`) |
| Caso | `/casos/{slug}/` | `Article` |
| Fijas | `/nosotros/`, `/contactenos/`, `/politica-de-datos/`, `/linea-de-transparencia/`, `/vinculacion/`, `/trabaja-con-nosotros/`, `/denuncias/` | `WebPage` / `ContactPage` |
| Utilidad | `/buscar/`, `/sistema/`, `/404` (estado 404 real, sugiere búsqueda con las palabras de la URL) | — |

En cada página: un solo H1; `title` **idéntico al actual** durante la migración (se optimiza después de la semana 4); meta descripción (generar las que falten desde el extracto, 150–160 caracteres; revisar a mano las 20 con más impresiones); canonical absoluto autorreferente; OG/Twitter; `lang="es-CO"`; sitemap índice por tipo (páginas, productos, equipos, marcas, blog, eventos) + sitemap de imágenes; `robots.txt` con sitemap y user-agents de IA permitidos; `llms.txt` con el catálogo por marca.

## 6. Fase E — Imágenes (en el PC de Nicolas)

- `scripts/download_images.py` lee `images_manifest.txt` y descarga en el PC (el contenedor de Claude no llega a `quimiolab.com.co` ni al CDN de Webflow). Conservar nombre de archivo y alt.
- Convertir a WebP máx. 1600 px; packshots de equipos con fondo transparente se conservan en PNG/WebP con alfa. `src/data/image-map.json` traduce URL vieja → ruta local.
- Los packshots en baja del portafolio no van al sitio; pedir HD a los aliados (nota ya registrada en el proyecto para SD BIOSENSOR).
- `width`/`height` siempre declarados; originales en `archivo/` con regla `ignore` en `firebase.json`.

## 7. Fase F — Consentimiento, medición y formularios

- **Consent Mode v2:** todo denegado por defecto. GTM (con GA4, **mismo ID que hoy**) en modo sin cookies; píxel de Meta solo con permiso de marketing. Elección guardada en `ql-consent = {a, m, t}`, volver a preguntar a los 12 meses, enlace "Preferencias de cookies" en el pie. Botón de WhatsApp: enlace `wa.me`, sin script.
- En vista previa (`PUBLIC_NOINDEX=1`): `noindex` y cero terceros.
- **Cloud Function `formulario`** (Node 22, 2.ª gen) en `/api/form`, con tipos: `contacto`, `cotizacion` (lleva `producto_slug` o lista de referencias), `evento` (con `evento_slug`), `vinculacion` (campos KYC del formulario viejo, sin adjuntos en v1), `trabaja` (enlace a CV en Drive/LinkedIn en v1; adjuntos en v2 con Storage), `denuncia` (sin campos de identificación obligatorios, como exige la política de no retaliación). Validación de origen, tipo, tamaño y correo; honeypot `sitio_web`; límite 10 envíos/IP/hora con IP en hash; guarda en Firestore `envios` con estado del correo; aviso a `contactenos@quimiolab.com` con `reply-to` del remitente. `SMTP_PASS` en Secret Manager.
- `firestore.rules`: nadie lee ni escribe desde el navegador.
- Boletín: el formulario guarda en Firestore; herramienta de envío (Kit o beehiiv) se decide después.

## 8. Fase G — Build, vista previa y revisión

Scripts: `prep_data.py`, `download_images.py`, `build_firebase_json.mjs` (desde `redirects.csv`, tolerando CRLF/BOM), `check_build.mjs` (un H1, canonical, noindex, URLs críticas y redirecciones tras cada build; `fileURLToPath` y barras normalizadas por Windows). `npm run build:preview`, `deploy:preview` (canal de 30 días), `deploy:api`.

Se publica desde PowerShell en el PC de Nicolas con `npm.cmd` y `firebase.cmd` (la red de Claude bloquea `*.googleapis.com` y `*.web.app`). Claude edita en la carpeta conectada y guía comando a comando; secretos con `--data-file`; `functions.yaml` a mano si el deploy de functions se cuelga; respaldo `_respaldo_<qué>_<fecha>/` antes de cambios masivos.

**Lista de URLs críticas para `check_build`** (mínimo): home, `/contactenos/`, `/nosotros/`, `/marcas/`, `/marcas/aesku/`, `/marcas/sd-biosensor/`, `/marcas/the-binding-site/`, `/equipos/`, `/productos/`, `/soluciones/diagnostico/`, `/blog/`, los 20 productos con más clics en Search Console, los 5 posts con más clics, `/politica-de-datos/`, `/linea-de-transparencia/`, `/buscar/` (noindex), `/sistema/` (noindex), `/404`.

**Revisión de la vista previa con Claude en Chrome:** estados HTTP de las páginas clave; 404 real; cada 301 llega al destino sin cadena; 0 imágenes rotas; originales dan 404; `noindex` y sin GTM; modo oscuro persiste; aviso de cookies guarda la elección; 390 px sin desbordes; formulario de prueba de cada tipo llega al correo y queda en Firestore; tabla de escalado en 390/1024/1440/1920/2560. Corregir, republicar y volver a verificar el mismo día.

## 9. Fase H — Lanzamiento y monitoreo

- Martes o miércoles temprano (hora Colombia), lejos de campañas y del cierre de mes comercial. Hosting de WordPress se mantiene **90 días** como reversa.
- D−2: TTL del DNS de `quimiolab.com.co` a 300 s (GoDaddy u otro: confirmar registrador). D−1: congelar contenido en WP y sincronizar el export final. Día D: deploy sin `noindex` → DNS a Firebase Hosting + SSL → prueba automática del inventario → Search Console (sitemap nuevo, inspección de las 20 principales) → GA4 en tiempo real → WP queda en un subdominio interno, sin borrar nada.
- `quimiolab.com` (Webflow) pasa a redirigir con las 301 por ruta desde Firebase (dominio adicional en el mismo Hosting) en vez del 302 genérico al home.
- Reversa si hay errores masivos no corregibles en 2 h en las primeras 48 h.
- Monitoreo diario la semana 1, semanal hasta la semana 8. Oscilación normal −10 a −20 % por 2–4 semanas. Desde la semana 4, mejoras SEO de a una: títulos con poco CTR, fichas no indexadas, enlazado interno marca ↔ producto ↔ solución.
- Después del lanzamiento: **desactivar y borrar el plugin con backdoor** y todo WordPress una vez pasados los 90 días.

## 10. Criterios de aceptación

- 100 % de `inventario_urls.csv` responde 200 o una sola 301 al destino previsto.
- 0 enlaces internos rotos; 0 enlaces a `quimiolab.com` o al CDN de Webflow/WP.
- Cada página: title idéntico al actual, un H1, meta, canonical, JSON-LD válido (prueba de resultados enriquecidos).
- Lighthouse móvil ≥ 90 en home, una ficha de producto, una de equipo y un post; Core Web Vitals en "bueno".
- Sitemap índice leído por Search Console sin errores; RSS del blog funcionando.
- GA4 recibiendo en la misma propiedad desde la primera hora; Consent Mode v2 verificado con el depurador de Tag Assistant.
- Formularios: los 6 tipos guardan en Firestore y llegan al correo con `reply-to`.
- `/sistema` refleja exactamente los tokens y componentes en producción, en claro y oscuro.

## 11. Decisiones pendientes (numeradas)

1. **Path de las fichas de producto y de los posts.** El método manda conservar las URLs en vivo (`/producto/{slug}/` y posts en raíz) para no depender de 578 redirecciones; la arquitectura decidida el 2026-09-11 ponía la marca en el path (`/marcas/{marca}/productos/{slug}`). Recomendación: **conservar `/producto/{slug}/` y mover posts a `/blog/`** (57 redirecciones, ordena el sitio); la marca sigue siendo el eje de navegación, breadcrumb y JSON-LD sin tocar el path de la ficha. Confirmar.
2. Plugin con backdoor en WP: desactivarlo ya (recomendado) o dejarlo hasta el apagado.
3. `en.quimiolab.com`: 301 al home + retiro del índice (recomendado) o revivir contenido en inglés.
4. Casos y Eventos científicos: migrar los 2 casos y 14 eventos históricos como archivo (recomendado) o solo dejar las secciones vacías listas.
5. Portal de usuarios registrados del Webflow 2024: descartar en v1 (recomendado).
6. Zapier: ¿queda acceso a la cuenta vieja para ver el historial de Zaps? Solo informativo; el sitio nuevo guarda leads en Firestore de todas formas.
7. Acceso de propietario a Search Console y GA4 de `quimiolab.com.co` para Nicolas (necesario para la línea base y el día D).
8. Registrador del DNS de `quimiolab.com.co` y `quimiolab.com` (para bajar el TTL en D−2).

## 12. Calendario propuesto

| Semana | Fase | Entregable |
|---|---|---|
| 1 | A + C | Línea base en Drive, `inventario_urls.csv`, tokens + `/sistema` en Astro |
| 2–3 | D + E | JSON del sitio, imágenes locales, plantillas de marca/producto/equipo/blog |
| 4 | F + G | Formularios en Cloud Function, consentimiento, primera vista previa completa |
| 5 | G | Revisión con Claude en Chrome, corrección, aprobación técnica (Nicolas) y de contenido (Quimiolab) |
| 6 | H | Lanzamiento martes/miércoles; monitoreo diario |
| 7–13 | H | Monitoreo semanal; mejoras SEO de a una; apagado de WP al día 90 |

Documentos del Project a mantener: este plan, `WEB_SITIO_ASTRO.md` (bitácora: dónde está todo, qué quedó hecho, publicación paso a paso), `WEB_ESPECIFICACIONES_DESARROLLO.md` y `WEB_SISTEMA_COMPONENTES.md` (se crean al arrancar la Fase C).
