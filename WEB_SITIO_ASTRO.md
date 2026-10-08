# Quimiolab — Sitio nuevo en Astro: bitácora y estado

Plan: `claude/WEB_PLAN_MIGRACION_SEO.md`. Método: skill `migracion-web-astro`.

## Dónde está todo
- Código: `G:\Mi unidad\Quimiolab\Quimiolab - Agent\web\` (por crear; excluir `node_modules` y `dist` de la sincronización de Drive).
- Export crudo del WP: `web\export\quimiolab-wp-export-2026-09-30.json` (6,7 MB) + `web\export\images_manifest.txt` (1.883 URLs). Descargados a Descargas el 2026-09-30 desde la sesión de wp-admin; Nicolas los mueve a la carpeta.
- Línea base: `web\linea-base\` — CSV de leads de Fluent Forms (Contact Form Demo, 1.216 entradas al 2026-09-30).
- Diseño aprobado del home: `Quimiolab\Sitio Web 2026\quimiolab-home-diseno.html` y Artifact "Quimiolab Home".
- Contenido consolidado (texto plano, ambos sitios): `Quimiolab\quimiolab-contenido-consolidado.md`.
- Firebase: proyecto por crear (`quimiolab-web`, cuenta nicolas@braindy.co, Blaze con presupuesto US$10).

## Bitácora

### 2026-09-30 — Fase A desde wp-admin (sesión de Nicolas en Chrome)
- **Medición actual en el WP: no existe.** El home en vivo no carga GA4, GTM, píxel de Meta ni Clarity. Corrección del mismo día (Nicolas: "la de Webflow sí tenía"): verificado en Wayback, **el Webflow viejo sí medía** y esos IDs son los que se reutilizan en el sitio nuevo:
  - Snapshot 2023-11-30: `UA-175314292-1` (Universal Analytics, ya apagado por Google), `GTM-PHGTFJG`, píxel de Meta `1194049767926479`.
  - Snapshot 2025-01-18: dos propiedades GA4 `G-MXQPSS996H` y `G-HHFRJLTQWH` (una debería ser la migrada desde la UA, la otra creada aparte: revisar en la cuenta de Google Analytics cuál tiene el historial y cuál se descarta), `GTM-PHGTFJG` y el mismo píxel.
  - El contenedor `GTM-PHGTFJG` sigue publicado hoy y contiene solo etiquetas de **Google Ads** (conversión `AW-378194507` con 4 etiquetas de conversión + conversion linker); no lleva GA4 dentro.
  - Consecuencia: **reutilizar** `GTM-PHGTFJG` (agregando la etiqueta GA4 de la propiedad con historial) y el píxel `1194049767926479`; no crear cuentas nuevas. Hay un hueco de datos desde que el sitio pasó a WordPress (1–2 años sin medición). Se necesita acceso a la cuenta de Google Analytics/Tag Manager/Ads de Quimiolab (¿quién es propietario?).
- **SEO on-page del home hoy:** `<title>` = "Quimiolab – Quimiolab", sin meta descripción, **0 H1**, 0 JSON-LD, canonical correcto (`https://www.quimiolab.com.co/`), sin `hreflang`, sin `meta robots`. Tema Astra + Spectra. Esto confirma que "title idéntico al actual" no aplica para el home: hay que escribirlo (excepción documentada a la regla de la skill; para productos y posts sí se conserva el title actual).
- **Sitemap real (`/wp-sitemap.xml`): 662 URLs** = 57 posts + 50 páginas + 521 productos + 1 categoría + 19 marcas + 5 categorías de producto + 7 etiquetas de producto + 2 autores. Base del `inventario_urls.csv`. Las 2 URLs de autor y las 7 de etiqueta no se conservan (301 al padre).
- **Hallazgo nuevo:** 3 páginas `registro-sanitario-no-invima2025dm-0031196-serial-…` (registros sanitarios INVIMA por serial de equipo). Probablemente son destino de códigos QR impresos en etiquetas: **se conservan con la URL exacta**, sin redirección.
- **Export completo con HTML** hecho por REST API pública (`/wp/v2/pages|posts|media|categories|product_cat|product_brand`) y WooCommerce Store API (`/wc/store/v1/products`): 50 páginas (46 con contenido), 57 posts (57 con contenido), 521 productos (521 con imagen y marca; 514 con descripción corta, **solo 22 con descripción larga**, **0 con SKU**), 26 marcas, 5 categorías, 509 medios. `images_manifest.txt`: 1.883 URLs (15 PDF); hosts: quimiolab.com.co, uploads-ssl.webflow.com (imágenes todavía servidas desde el CDN del Webflow viejo: hay que descargarlas antes de que desaparezcan), minsalud.gov.co, ins.gov.co, gco.iarc.fr.
- **Plugins (14):** activos Duplicate Page, Fluent Forms 6.2.14 + Pro Add On 5.0.0 (incompatible, pide actualizar), Spectra Legacy, Plantillas de inicio (Astra Sites), WooCommerce 11.1.2, WP All Import, WP Chat App (WhatsApp), WP Mail SMTP; inactivos Blogger Importer, Max Mega Menu, OttoKit, Presto Player.
- **Seguridad:** `WP Logo Showcase Responsive Slider and Carousel 3.8.7.1` (Essential Plugin, backdoor confirmado) **desactivado el 2026-09-30** con autorización de Nicolas. Sigue instalado (borrar tras respaldo). Pendiente revisar en el servidor si existe `wp-comments-posts.php` y cambios en `wp-config.php` (el aviso de WordPress.org dice que su limpieza automática no garantiza nada).
- **Leads:** Fluent Forms "Contact Form Demo" tiene 1.216 entradas (eran 1.098 el 11 de septiembre: ~120 en 19 días). Las más recientes son **spam en inglés** (Reino Unido, "changing my box color", enlaces a sitios ajenos): el formulario no tiene protección efectiva. Refuerza honeypot + límite por IP + validación de origen en la Cloud Function, y sugiere filtrar el CSV antes de usarlo como historial. Exportado a CSV con todos los campos. "Denuncias" (6) y "Demo" (1) no se exportaron (el selector de formulario no cambió desde la automatización; hacerlo a mano si se quieren).
- **robots.txt:** estándar de WooCommerce, con sitemap declarado.
- **Definiciones de los 3 formularios exportadas** (Tools → Export forms, no las entradas) a `web\export\forms\`: `fluentform-1-contact-form-demo.json` (Nombre, Email*, Teléfono móvil*, País*, Ciudad, Entidad*, Mensaje*, aceptación de términos; notifica a contactenos@quimiolab.com, asunto "Notificación Contacto Página Web"), `fluentform-3-denuncias.json` (Nombre, Email, Identificación, Teléfono, Descripción*, Área/persona involucrada, adjunto de evidencias, términos*; notifica a contactenos@), `fluentform-4-demo.json` (Nombre, Email, Teléfono, "Marca de interés" select, mensaje, imagen; notifica a contacto@quimiolab.com — buzón distinto, confirmar si existe). **Ninguno tiene honeypot ni captcha activos**, lo que explica el spam. Son la especificación de campos para la Cloud Function `formulario`.
- **Entradas exportadas** (CSV, 2026-09-30) a `web\linea-base\`: Contact Form 1.219 entradas (2025-11-25 → 2026-09-30, o sea el formulario solo tiene 10 meses de historial), Denuncias 6 (5 son spam de gmail con texto aleatorio + 1 prueba de Sandra Mican), Demo 1 (vacía). Clasificación automática del Contact Form (`…-clasificado.csv`, columna `clasificacion`): **~45 leads reales (3,7 %)**, 736 con país distinto de Colombia (Sierra Leone 131, Alemania 73, Polonia 68, Georgia 61, UK 53…), 437 con URL en el mensaje. Los leads reales son casi todos solicitudes de cotización de insumos/kits desde Colombia. Conclusión: el buzón contactenos@ recibe ~6 spam/día; en el sitio nuevo la Cloud Function debe validar país/idioma además de honeypot y límite por IP, y conviene un aviso de "bloqueado" en Firestore para auditar sin molestar al cliente.

### 2026-09-30 — Fases C y D: proyecto Astro construido y copiado a Drive
- **Código en `G:\Mi unidad\Quimiolab\Quimiolab - Agent\web\`** (101 archivos; `node_modules` y `dist` no van a Drive: `.gitignore`). Astro 7.3.5 + Pagefind 1.5.2, salida estática, `trailingSlash: always`. README con los comandos de PowerShell.
- **Build verificado en el contenedor:** 654 páginas en ~2 s; `check_build.mjs` OK (1 H1 por página, canonical, meta, noindex donde toca, 28 URLs críticas, 0 enlaces internos rotos, 140 redirecciones sin cadenas ni destinos inexistentes). Capturas a 1366 y 390 px sin scroll horizontal en home, marca, producto, listado, sistema, blog y solución.
- **Datos:** `scripts/prep_data.py` convierte el export en `src/data/*.json` + `redirects.csv`. Hallazgos al procesar: los **19 equipos son productos WP con etiqueta "Equipo"** (viven en `/producto/{slug}/`, se conservan); 24 slugs con caracteres codificados (`%ce%b1` = α, `%c2%b7` = ·) se decodifican para el path; 23 marcas tenían página propia en raíz (`/aesku/`, `/vircell/`…) con texto institucional que ahora alimenta `/marcas/{slug}/`; el CMS traía `<h1>` dentro del contenido (se baja a H2); nombres de marca normalizados al manual (Vircell, Dia.Pro, ELITechGroup…) con su color de acento.
- **Rutas finales:** conservadas `/producto/{slug}/` (521), `/contactenos/`, `/nosotros/`, `/politica-de-denuncias-y-no-retaliacion/`, 3 registros INVIMA (noindex). Nuevas: `/marcas/`, `/marcas/{slug}/` (26), `/equipos/`, `/productos/` + `/productos/pagina/N/` (21 páginas de 24), `/soluciones/`, `/soluciones/{linea}/` (+ `/productos/` y `/equipos/`), `/blog/` + `/blog/pagina/N/` + `/blog/{slug}/` (57), `/buscar/` (Pagefind, noindex), `/sistema/` (noindex), `/404`. 301: `/marca/x/` y `/x/` → `/marcas/x/`; posts raíz → `/blog/`; `/linea-*` → `/soluciones/*`; `/categoria-producto/*`, etiquetas, tienda/carrito/checkout/mi-cuenta, sample-page, offerings, `/euformatics/`.
- **SEO/LLM:** JSON-LD Organization + WebSite/SearchAction en todas; BreadcrumbList; Product (sin offers), Brand, Article, ContactPage. Sitemap índice + 5 sitemaps (con imágenes), `robots.txt` (bloquea /buscar, /sistema, /api; permite GPTBot/ClaudeBot/PerplexityBot), `llms.txt`, RSS del blog.
- **Sistema de diseño:** `global.css` con tokens primitivos → semánticos, tema oscuro propio (3 bloques), escalado fluido 16→20 px de 1440 a 1920, tokens de movimiento, estados completos; `/sistema/` documenta color, tipografía, logos, botones, campos, alertas, íconos (28), componentes y cortes (480/640/760/860/900/980/1080). Logos Quimiolab y SD BIOSENSOR como componentes `fill=currentColor` desde los SVG reales; 21 logos de aliados extraídos del manual de marca v2_11 a `public/marcas/`.
- **Consentimiento y medición:** Consent Mode v2 (todo denegado; `ql-consent` {a,m,t}, 12 meses; "Preferencias de cookies" en el pie); GTM `GTM-PHGTFJG` solo en producción (`PUBLIC_NOINDEX=1` lo apaga). La etiqueta GA4 y el píxel van dentro del contenedor GTM (pendiente 11).
- **Formularios:** `FormularioContacto.astro` (contacto y cotización con producto) envía JSON a `/api/form` con honeypot `sitio_web`; validación en cliente con mensajes en español; `firebase.json` ya trae el rewrite a la función `formulario`. **La Cloud Function todavía no existe** (Fase F).
- **Imágenes:** siguen apuntando al CDN del WP/Webflow (Fase E pendiente: `download_images.py` en el PC → WebP → `image-map.json`). `Imagen.astro` ya declara width/height.
- Datos de relleno a reemplazar: número de WhatsApp `573000000000`, horario "8:00 a. m. – 5:00 p. m.", sello "ICONTEC · ISO 9001" (confirmar norma vigente). Nota: el WP dice "Fundada en 1996" (el Webflow viejo decía 1992): se usó 1996; confirmar con el cliente.

### 2026-09-30 — Lenguaje visual 2026 aplicado al sitio
- Tokens nuevos en `global.css`: `--grad-navy` / `--grad-navy-v` (#001A4D → #002468 → #003087, 35°/160°), `--navy-700 #002468`, `--inst-500 #044495`, `--sd-500 #004A98`, radio y gutter bento (1 rem / 0,8125 rem), `--sombra-bento`, `--sombra-glass`. Clases: `.seccion-navy` ahora lleva degradado + 2 orbes difuminados (`::before/::after`, azul marca), `.orbe`/`.orbe-sd` (tercer orbe, solo portada y cierre), `.glass` y `.glass-oscuro`, `.tinte`/`.tinte-2` (blanco → color del aliado al 14 %), `.bento`, `.endoso` (UNA EMPRESA DE + SD Biosensor), `.qlupa-deco`. Titulares Poppins 700 tracking −0,025em; eyebrows Roboto 700 tracking 0,2em; negritas de la prosa en navy.
- Home: hero en degradado con 3 orbes (uno SD), foto de fondo blur 6 px, endoso SD arriba a la derecha, cifras y testimonios en glass, catálogo sobre tinte, tarjeta de equipos con Q-lupa decorativa, contacto en degradado con orbes. Footer: degradado navy con orbe y endoso "Una empresa de SD Biosensor" en vez del lockup de distribuidor.
- Ficha de producto/equipo: hero a sangre en degradado navy con esquinas inferiores redondeadas, **Q-lupa oficial en el color del aliado detrás del equipo**, brillo del aliado aclarado, packshot delante (se monta sobre la tarjeta glass de la intro), logo del aliado en placa blanca arriba a la derecha, título display a la izquierda; página de contenido con tinte del aliado al 14 %; garantías con palabras clave en negrita navy.
- Página de marca: cabecera en degradado navy con Q-lupa del color del aliado y brillo; intro sobre tinte del aliado.
- `/sistema` tiene la sección "0. Lenguaje visual 2026" con demos de degradado, glass, tinte y endoso.
- Nota técnica: los estilos scoped de Astro no alcanzan a los componentes hijos (`LogoQLupa`); las reglas de tamaño/posición de la Q-lupa van con `:global(.q-hero)` dentro del contenedor. Artifact "Quimiolab Sitio Astro" republicado (v3) con este lenguaje.
- Pendiente con el cliente (del lineamiento): fórmula oficial del endoso ("Una empresa de" vs "Compañía del grupo") y logo negativo oficial de SD Biosensor.

### 2026-09-30 — Acentos, campañas y patrones (corrección "muy azul")

Nicolas: el sitio estaba muy azul; faltaban los colores de acento del manual, los patrones y los fondos de las piezas de social y del portafolio (regla 60/30/10, ver `feedback_color_60_30_10`). Aplicado:

- **Patrones del sistema** extraídos del manual `brand/quimiolab-sistema-de-marca-v3_00.html` → `public/patrones/` (adn, reticula-q, lente, red-molecular, ondas, microplaca, cromatograma en SVG + `panel-adn-diagonal.webp` rasterizado a 1600×900 desde el SVG de 1 MB). Se usan como **máscara** (`.patron` + `.patron-adn`… dentro de `.con-patron` o `.seccion-navy`) para colorearse con `--patron-color`; 4–7 % en claro, 12–18 % en oscuro (`.patron-oscuro`); un patrón por sección.
- **Tokens nuevos** en `global.css`: acentos del manual (`--brillante` #00CDF4, `--amarillo` #FFCB2B, `--teal`, `--verde`, `--verdoso`, `--nube`, `--hielo`…), degradado oficial de marca `--grad-marca` (#0075DA → #00C0E4, ahora en el botón primario y avatares), colores de campaña por tema clínico (`--camp-*`) y color por línea: Diagnóstico = verde #319638, Diagnóstico molecular = teal #0E8CA9, Investigación = violeta #6B3FA0, Point of Care = naranja #E8622A (`--linea-{slug}`).
- **Duotono** (`.duotono`): foto en escala de grises + color de campaña en *screen*, como en el manual (sombras al color, luces claras). Se usa en los hubs del home, en las tarjetas de `/soluciones/` y en la portada de cada línea.
- **Home** por sección: hero con el panel de ADN diagonal (16 %) y eyebrow/énfasis en Azul Brillante; hubs en duotono con chip blanco, punto y barra en el color de la línea; catálogos sobre tinte + microplaca (4,5 %), tarjeta de equipos navy con retícula Q; nosotros sobre `.nube` con la textura "ADN clara" (hélice blanca) y pilares en rosa/teal/verde; resultados con red molecular y signos "+" y comillas en amarillo; blog con cromatograma suave; contacto con ondas; pie con retícula Q y degradado corregido (ya no iba a navy más oscuro).
- Líneas, marcas, fichas de producto, nosotros, contáctenos, marcas y blog llevan su patrón (aliado/campaña) sobre el tinte. `/sistema/` documenta acentos, campañas, patrones y duotono.
- Bug arreglado de paso: las alertas del formulario (`.alerta[hidden]`) se mostraban siempre porque `display:flex` le ganaba al atributo `hidden`.
- Nuevo `scripts/build_artefacto.py` (dist → carpeta del artefacto: enlaces relativos, `_astro`→`astro`, placeholders para imágenes externas, sin GTM). Artefacto "Quimiolab Sitio Astro" republicado (v4).

### 2026-09-30 — Patrones más sutiles, scroll arriba y pasada UX (skills escalado-fluido, negritas-escaneo, ui-ux-pro-max)

- Nicolas: demasiadas texturas. Quedan solo en hero del home (panel ADN 10 %), "Nosotros" (ADN clara al 50 %), "Resultados" (red molecular 8 %) y en las cabeceras navy de líneas, marcas y fichas (7–8 %). Sin patrón en catálogos, blog, contacto, listados ni en el pie, que vuelve a su degradado original.
- Toda navegación a otra página abre arriba (script en `Base.astro`: `scrollTo(0,0)` al cargar salvo en `back_forward` o con `#ancla`, para conservar el scroll al volver atrás).
- **escalado-fluido**: ya cumplía (todo en rem, clamp 16→20 px entre 1440 y 1920). Medición: raíz 16 px hasta 1440, 18 px a 1680, 20 px desde 1920; contenedor 1200→1500 px; sin saltos. Se corrigió un desborde horizontal entre 981 y 1100 px (menú completo no cabía): el menú colapsa a hamburguesa desde 1100 px.
- **negritas-escaneo**: `<strong>` en leads y textos de hubs/pilares del home (2–3 fragmentos por párrafo, en el color de texto principal; blanco sobre navy), regla global `p strong { color: var(--marca) }`.
- **ui-ux-pro-max** (checklist §1–§3 y §5): feedback de pulsación en botones (`scale(.98)`), `touch-action: manipulation`, tap targets ≥ 44 px en listas y sugerencias del hero, `scroll-margin-top` para anclas bajo el menú fijo. Ya existían: focus visible 3 px, `prefers-reduced-motion`, labels visibles + autocomplete + errores junto al campo, `aria-current` en el menú, skip link, width/height en imágenes, fuentes con `display=swap`.
- Artefacto republicado (v5); archivos en Drive.

### 2026-09-30 — Home orientado a conversión (diagnóstico UX/UI + neuromarketing aplicado)

Nueva estructura del home, en este orden: hero → franja de confianza → franja de marcas → equipos protagonistas → soluciones por línea → nosotros + cifras + testimonios (navy) → micro-compromisos → blog (destacado + lista) → contacto.

- **Hero**: titular orientado al resultado ("Equipos y reactivos de diagnóstico con soporte científico en Colombia"), lead con el costo de no actuar, buscador como acción principal, un solo CTA primario ("Solicitar cotización" → `/contactenos/?tema=cotizacion`), enlace secundario a equipos y promesa de respuesta el mismo día hábil. A la derecha, el equipo protagonista (Helios, `public/img/helios.png`) sobre la Q-lupa con brillo, logo AESKU en placa y mini-ficha glass. Las cifras salieron del hero.
- **Franja de confianza** (`.garantias`, bento de 6): INVIMA, ISO 9001, respuesta el mismo día hábil, soporte técnico en Bogotá con cobertura nacional, capacitación incluida, +30 años.
- **Equipos protagonistas**: carrusel con scroll-snap de 6 equipos (Helios, Optilite, VirClia Lotus, ELITe InGenius, F2400, Kryptor Compact Plus) con halo en el color del aliado, logo en placa, "Ficha técnica" y "Solicitar demo" (→ `#cotizar` de la ficha).
- **Cifras con contexto** en "Nosotros": +30 años, marcas, plataformas con soporte, referencias (salen de los datos, no inventadas). Se retiraron "+30.000 pruebas / +15.000 pacientes" del sitio viejo por no ser comparables para un comprador de laboratorio.
- **Micro-compromisos** (`#siguiente-paso`): Catálogo 2026 en PDF, Demo de 20 min, Disponibilidad de una referencia → todos van a `/contactenos/?tema=…`; el formulario preselecciona el tema desde la URL (`FormularioContacto.astro`) y tiene dos temas nuevos: `catalogo` y `disponibilidad`.
- **Header**: CTA "Cotizar" (antes "Contáctenos"). **WhatsApp flotante** global (`BotonWhatsApp.astro` en `Base.astro`, número placeholder `573000000000`).
- **Blog**: artículo destacado con imagen en duotono teal + lista de 3.
- Íconos nuevos: `reloj`, `mapa`, `sello`.

**Pendientes con el cliente que abre este home**: logos de clientes para una franja de prueba social (Compensar, VID, RVG…, con permiso); número real de WhatsApp comercial; confirmar que "Registro INVIMA en todos los productos", "capacitación incluida" y "respuesta el mismo día hábil" son promesas que Quimiolab puede sostener; PDF del catálogo 2026 para el envío automático (o enlace de descarga directa).

### 2026-09-30 — Movimiento web en 3 capas (skill movimiento-web) + Fase E ejecutada

- **Fase E**: Nicolas corrió `npm run images` en `C:\quimiolab-web` (copia local del proyecto; `node_modules` no puede vivir en Drive: Drive corrompe la instalación). 485/486 imágenes descargadas a `public/media/` en WebP y `src/data/*.json` reescritos; una fallida en `export/imagenes-fallidas.txt`. Flujo de trabajo: código en Drive, ejecución en `C:\quimiolab-web` (`robocopy … /E /XD node_modules dist .astro` para traer cambios; `robocopy` de `public\media` y `src\data` de vuelta).
- **Capa 1** (todo el sitio): `src/styles/motion.css` + `src/scripts/motion.ts` (cargado desde `Base.astro`): aparición al hacer scroll (solo lo que está bajo el primer pantallazo, escalonado 70 ms), tilt 3D con mouse en `.equipo-card .fig`, `.tarjeta.producto .fig`, `.foto img`, `.destacado .img` (máx. 5°, con glare), parallax CSS nativo en la foto de Nosotros (`data-parallax`).
- **Capa 2**: View Transitions (`@view-transition { navigation: auto }`), menú fijo (`.cabecera-sitio` = `site-nav`), foto del post que "vuela" de la tarjeta a `#hero-img` (`Imagen` acepta `id`; `blog/[slug]` pasa `heroImg` a Base para el `<link rel="expect">`).
- **Capa 3**: GSAP 3 (ScrollTrigger + SplitText) solo en la home (`<Base gsap>` → `<html data-gsap>`; `gsap-hero.ts` importado bajo demanda). Home: H1 y títulos de sección `words`, hero `rise`, escena y sello `pop`, franja de confianza `fan`, cifras `count`. Sin `type` (el H1 es el LCP) y sin scroll infinito.
- Verificado con Playwright: CLS 0, tareas largas 0 ms, sin desbordes a 390/1366, nada oculto con reduced-motion ni sin JS. `/sistema/` tiene la sección "Movimiento" con la tabla de atributos. Respaldo previo en `_respaldo_motion_2026-09-30/` (contenedor).
- Ojo: el artefacto de claude.ai no ejecuta scripts, así que ahí no se ven las animaciones; se revisan con `npm run dev` en el PC.

### 2026-09-30 — Vista previa publicada en Firebase Hosting

- Proyecto Firebase creado por Nicolas con `firebase projects:create quimiolab-web` (cuenta nicolas@braindy.co). `.firebaserc` → `quimiolab-web`.
- Canal `vista-previa`: **https://quimiolab-web--vista-previa-9l92itmo.web.app** (expira 2026-10-30). 1.901 archivos, 654 páginas, `noindex, follow` en todas (verificado), 140 redirecciones, sin rewrite al formulario (el envío falla hasta la Fase F).
- Flujo para actualizar: en `C:\quimiolab-web` → `robocopy` desde Drive + `npm run deploy:preview`; la URL se mantiene. `build:preview` ahora es `cross-env PUBLIC_NOINDEX=1 npm run build` para que `check_build` sepa que es vista previa.
- Los avisos "Unable to add channel domain to Firebase Auth" son normales (el sitio no usa Auth).
- Sitio de producción reservado en `https://quimiolab-web.web.app` (aún vacío); el dominio se conecta al final de la migración.

### 2026-09-30 — Ajustes tras la primera revisión de Nicolas en la vista previa

- **Equipos del home**: ya no es carrusel con barra de scroll en escritorio; retícula de 3 columnas (2 filas, 6 equipos), 2 columnas en tablet y carrusel con snap sin barra visible solo en móvil (< 640 px). Packshots con `mix-blend-mode: multiply` para que el fondo blanco de las fotos se funda con el tinte del aliado.
- **Pie siempre abajo** (`global.css`): `body { min-height: 100dvh; display: flex; flex-direction: column }` + `main { flex: 1 0 auto }`. Verificado en 1366/1920/390. Propuesta de skill `pie-siempre-abajo` para reutilizar.
- **Blog**: WordPress repetía la portada como primera imagen del cuerpo (misma foto en otro tamaño); `blog/[slug].astro` la quita comparando el nombre base. 0 de 57 posts con duplicado.
- **Páginas de línea** (`soluciones/[linea]`): descripción de portada escrita a mano (la del CMS era un pegote de kickers); la intro del CMS se corta antes del bloque de logos de marcas (que ya se muestra aparte) y se diagrama a dos columnas (kicker en color de campaña + título | párrafo).
- **Slider del hero**: los puntos son radios + labels, así funcionan también sin JS (artefacto): al elegir uno se detiene la rotación CSS y muestra ese equipo; la Q-lupa y el brillo toman el color del aliado por CSS (`--c0…--c4` + keyframes) y por JS en el sitio real.
- Artefacto v16. Para actualizar la vista previa de Firebase: `robocopy` + `npm run deploy:preview`.

### 2026-10-07 — Hero simplificado, botón «volver arriba», contraste y **editor in situ** (skill editor-in-situ)

- Hero: H1 global «La ciencia detrás de cada resultado» (2 líneas), lead con las 4 áreas, sin eyebrow, sin «Frecuentes» ni promesa; mini-ficha del slider siempre en placa blanca (en tema oscuro quedaba navy sobre navy). `BotonArriba.astro` en todas las páginas (aparece tras una pantalla, sobre el de WhatsApp). Artefacto v19.
- **Editor in situ para el cliente** (home, nosotros, contáctenos), adaptado del skill `editor-in-situ` (Tinyroots, React) a Astro estático **en TypeScript puro, sin React**:
  - Entrada: `/?edit`, `/nosotros/?edit`, `/contactenos/?edit` → Google Sign-In (Firebase Auth) → solo correos de `ADMINS` (`src/editor/config.ts`) y de `firestore.rules`. Lista actual: nicolas@braindy.co, leidy.carrillo@, daniela.pava@, liliana.ramirez@, danilo.cabrera@ (quimiolab.com) y felipe.na@sdbiosensor.com. Pendiente confirmar si «Lady» es Leidy Carrillo o Lady Laura García (ladylaura.garcia@quimiolab.com).
  - Qué se edita: textos (contentEditable, 65 bloques en home, 12 en nosotros, 13 en contáctenos), fotos (subir → WebP ≤ 1600 px/≤ 750 KB como data URL, enlace, encuadre 3×3, alt, «Original»), destino de botones (página del sitio, WhatsApp, web, correo, teléfono), secciones (subir/bajar/ocultar; 8 en home, 3 en nosotros). Sin plantillas de secciones nuevas (fase 2 si el cliente las pide).
  - Datos: colección `page_contents`, un documento por bloque `{content, href, alt, pos, page, updatedAt, updatedBy}` + `layout__<página>` `{sections}`; borrador en memoria → **Publicar** en un batch; «Descartar» recarga; aviso al salir con cambios.
  - Cómo llega a los visitantes: script de 8 KB (`src/scripts/contenido.ts`) en toda página con `data-ed-page` lee lo publicado por REST de Firestore (sin SDK) con caché de 10 min en localStorage y lo aplica; además el build hornea lo publicado en el HTML (`prebuild` → `scripts/fetch_content.mjs` → `src/data/contenido.json`; `scripts/aplicar_layout.mjs` reordena/oculta secciones en `dist`). El bundle de Firebase (500 KB) solo se descarga con `?edit`.
  - Marcado: componentes `Ed`, `EdImg`, `EdLink` (`src/components/`), ids `pagina_seccion_elemento` (nunca se renombran), `data-ed-sec`/`data-ed-label` en secciones, `<Base editable="home">`. En modo edición no corre GSAP ni navegan los enlaces.
  - Verificado con Playwright: sin `?edit` el HTML es idéntico; con `?edit` (modo demo `PUBLIC_ED_DEMO=1`) chips, barras, paneles y contador funcionan en 1366 y 390 px; sin errores de consola.
  - **Pendiente de Nicolas en la consola de Firebase** (pasos en `README.md`): habilitar Google en Authentication + dominios autorizados, crear la base de Firestore, crear la app web y pegar `apiKey`/`appId` en `src/editor/config.ts`, `firebase deploy --only firestore:rules`, `npm install` (nueva dependencia `firebase`) y `npm run deploy:preview`. Hasta entonces `?edit` muestra «Falta configurar Firebase» y el sitio público no cambia.

### 2026-10-08 — Paso a Claude Code, repositorio en GitHub y Firebase del editor

- Proyecto en `C:\quimiolab-web` con git; repositorio privado **https://github.com/Xcala/quimiolab-web** (rama `main`). `linea-base/` (leads con datos personales) y `desktop.ini` quedan fuera de git (`.gitignore`).
- `src/editor/config.ts` con `apiKey` y `appId` de la app web (valores públicos; la protección real son las reglas). `firebase.json` regenerado (ahora incluye `firestore`) y `firebase deploy --only firestore:rules` publicado.
- Vista previa actualizada con `npm run deploy:preview` (`check_build: OK`; vence el 2026-11-05).
- Falta en la consola: Google habilitado en Authentication + dominios autorizados (vista previa, `localhost`, luego `www.quimiolab.com.co`); opcional restringir la `apiKey` por referente en Google Cloud.

### 2026-10-08 — Editor in situ, fase 2: fondos, secciones nuevas y más fotos

Nicolas probó el editor en la vista previa (entra con Google y edita textos) y pidió: cambiar fotos, fondos, agregar y quitar secciones, y un CMS para el contenido dinámico. Plan acordado en 4 fases: (1) editor de páginas, (2) fotos en Firebase Storage, (3) panel `/admin/` para blog, productos/equipos, marcas y líneas sobre Firestore, (4) build + deploy automático al publicar. **Fase 1 hecha:**
- `src/editor/secciones.mjs` (JS plano, compartido por editor, script de visitantes y `scripts/aplicar_layout.mjs`): fondos de la marca (blanco, gris, nube, tinte, navy), patrones (uno por sección) y 8 plantillas (texto + foto, foto + texto, llamado a la acción, cifras, tres tarjetas, testimonio, solo texto, preguntas frecuentes). Estilos `.pl-*` en `global.css`.
- `layout__<página>.sections` ahora guarda `{ key, hidden?, bg?, patron?, tpl? }`. Las secciones agregadas usan `key = x<aleatorio>` y sus bloques son documentos normales `<página>_<key>_<campo>`. Se borran con la papelera; las del diseño original solo se ocultan.
- Barra de cada sección: subir/bajar, ocultar, **fondo** (solo secciones `.seccion` de contenido; «Como el diseño» vuelve al original guardado en `data-ed-orig-clases`/`data-ed-orig-patron`), **+ agregar debajo**, **borrar** (agregadas).
- Fotos nuevas editables en home: fondo del hero (`home_hero_fondo`), 5 packshots del slider (`home_slide_<k>_foto`), fondo de contacto (`home_contacto_fondo`). Contáctenos tiene sección `principal` para poder agregar secciones.
- Reordenar mueve cada sección con lo que la sigue hasta la próxima (la franja de marcas va pegada a «Garantías»); antes, en el navegador, la franja se iba al final.
- Build: `aplicar_layout.mjs` hornea orden, ocultas, fondos/patrones y secciones agregadas con lo publicado. Verificado con contenido simulado, en el editor demo (1366 y 390, claro y oscuro, sin scroll horizontal) y en la vista de visitante con caché.
- Probar sin Firebase: configuración `dev-editor-demo` en `.claude/launch.json` (`PUBLIC_ED_DEMO=1`, puerto 4322) → `/?edit`.

## Decisiones tomadas
- 2026-09-28: Astro + Firebase; catálogo sin pagos; sin CMS (Braindy publica); GA4/GTM + Meta + WhatsApp; código en Drive.
- 2026-09-30: rutas: conservar `/producto/{slug}/`, posts a `/blog/`; plantillas directo en Astro (sin HTML aprobable). Plugin con backdoor desactivado. Medición: reutilizar GTM-PHGTFJG, la GA4 con historial (G-MXQPSS996H o G-HHFRJLTQWH) y el píxel 1194049767926479 del Webflow viejo.
- 2026-10-07: el cliente sí edita contenido (home, nosotros, contáctenos) con el editor in situ sobre Firestore; el catálogo, blog y líneas siguen saliendo del export/CMS (Braindy publica).

## Pendientes (numerados, continúan los del plan)
9. Mover `quimiolab-wp-export-2026-09-30.json`, `images_manifest.txt` y el CSV de Fluent Forms de Descargas a `web\export\` y `web\linea-base\`.
10. Descargar las imágenes del manifiesto en el PC (script `download_images.py`), con prioridad las 
    de `uploads-ssl.webflow.com`.
11. Conseguir acceso a Google Analytics, Tag Manager (GTM-PHGTFJG) y Google Ads (378194507) de Quimiolab; decidir cuál de las dos GA4 se conserva y agregar su etiqueta al contenedor.
12. Search Console de `quimiolab.com.co`: confirmar si existe propiedad y quién es propietario (sin analítica es probable que tampoco haya Search Console).
13. Revisión de archivos del servidor (hosting) por el backdoor; borrar el plugin tras respaldo.
14. Los 3 registros sanitarios INVIMA: confirmar con Quimiolab si hay QR impresos apuntando a esas URLs.
15. Descripciones largas de producto: solo 22 de 521; decidir si se redactan (Braindy) o se toman de los PDF/fichas de los aliados.
16. Correr el proyecto en el PC (`npm.cmd install` + `npm.cmd run dev` en `Quimiolab - Agent\web`) y revisar visualmente con imágenes reales (en el contenedor no cargan: egress bloqueado).
17. Páginas pendientes: `/politica-de-datos/`, `/linea-de-transparencia/`, `/vinculacion/`, `/trabaja-con-nosotros/`, `/eventos/` (contenido del Webflow viejo en el consolidado).
18. Fase E (imágenes), Fase F (Cloud Function `formulario` + `firestore.rules` + Secret Manager), proyecto Firebase `quimiolab-web` y canal de vista previa.
19. Reemplazar datos de relleno: WhatsApp, horario, certificación ISO, año de fundación (1996 vs 1992).
20. Editor in situ: configurar Firebase (Auth Google, Firestore, app web, reglas), confirmar el correo de «Lady», avisar al equipo de Quimiolab cómo entrar; fase 2 si piden plantillas de secciones nuevas o fotos en Storage.
