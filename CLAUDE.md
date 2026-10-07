# Quimiolab — sitio web nuevo (Astro + Firebase Hosting)

Lee esto antes de tocar nada. Es el contexto que antes vivía en Claude Cowork.

## Qué es
Migración de www.quimiolab.com.co (WordPress) a un sitio estático en **Astro 7** desplegado en **Firebase Hosting** (proyecto `quimiolab-web`, cuenta nicolas@braindy.co). Cliente: Quimiolab (Bogotá, diagnóstico in vitro, empresa de SD Biosensor). Agencia: Braindy (Nicolas). Idioma del código, comentarios y commits: **español**.

- Vista previa pública: https://quimiolab-web--vista-previa-9l92itmo.web.app (canal `vista-previa`, se renueva con `npm run deploy:preview`).
- Producción: https://quimiolab-web.web.app (vacío hasta el lanzamiento; el dominio se conecta al final).
- Bitácora completa de decisiones: `WEB_SITIO_ASTRO.md` en la raíz (copiada del proyecto de Cowork). Léela cuando una decisión no sea obvia.

## Comandos
- `npm install` — una vez (y cuando cambie `package.json`).
- `npm run dev` — desarrollo en http://localhost:4321
- `npm run build` — build completo: `prebuild` baja el contenido publicado por el cliente (Firestore → `src/data/contenido.json`), `astro build`, aplica orden de secciones, Pagefind y `scripts/check_build.mjs` (H1 único, canonical, enlaces rotos, redirecciones). **Debe terminar en `check_build: OK`.**
- `npm run deploy:preview` — build con `noindex` + `firebase.json` + deploy al canal de vista previa.
- `npm run deploy` — producción (solo cuando Nicolas lo pida explícitamente).
- `npm run data` — regenera `src/data/*.json` desde `export/` (WordPress) y reaplica el mapa de imágenes.
- `npm run images` — descarga imágenes del WP/Webflow a `public/media/` (ya hecho: 485/486).
- Python no está instalado en el PC; usa Node para scripts nuevos.

## Estructura
- `src/pages/` — rutas (`index`, `nosotros`, `contactenos`, `equipos`, `productos`, `marcas/[slug]`, `producto/[slug]`, `soluciones/[linea]`, `blog/[slug]`, `buscar`, `sistema`…).
- `src/layouts/Base.astro` — head, SEO, consentimiento (Consent Mode v2), GTM solo en producción, scroll arriba, botones flotantes.
- `src/components/` — `Ed/EdImg/EdLink` (editor in situ), `Imagen`, `FormularioContacto`, `Header`, `Footer`, logos (SVG reales con `fill="currentColor"`).
- `src/styles/global.css` — sistema de diseño (tokens, tema oscuro, escalado fluido, patrones, glass, bento); `motion.css` + `src/scripts/motion.ts` + `gsap-hero.ts` — movimiento en 3 capas.
- `src/editor/` — editor in situ (`config.ts` es lo único que se configura por marca).
- `src/data/*.json` — contenido del CMS exportado (no editar a mano; viene de `scripts/prep_data.py` o `npm run data`).
- `public/media/` (fotos WP en WebP), `public/marcas/` (logos aliados), `public/patrones/` (patrones del manual), `public/img/`.
- `scripts/` — build y utilidades; `firestore.rules`; `redirects.csv` → `firebase.json` (generado, no editar a mano).
- `/sistema/` (noindex) documenta el sistema de diseño en vivo.

## Reglas de marca (no negociables)
- Lenguaje visual 2026: degradados navy (#001A4D → #002468 → #003087), orbes difuminados, glass, bento, equipo protagonista, un solo patrón por sección (4–7 % claro, 12–18 % oscuro). Regla de color 60/30/10 con los acentos del manual (`--brillante`, `--teal`, `--verde`, `--amarillo`…) y el color de cada aliado/línea.
- La **Q-lupa** es el isotipo exacto (`LogoQLupa.astro`): solo cambia color y opacidad, nunca se redibuja.
- Logos de aliados **siempre en placa blanca**, en su proporción, nunca dos aliados en una misma composición. Endoso "Una empresa de SD Biosensor" solo en piezas de Quimiolab, no en piezas de otros aliados.
- Tipografía: Poppins 700 para titulares (tracking −0,025em), Roboto para texto; eyebrows Roboto 700 mayúscula tracking 0,2em. Negritas de escaneo: 2–3 `<strong>` por párrafo clave.
- Todo en `rem`; escalado fluido 16→20 px entre 1440 y 1920. Sin scroll horizontal en 390/768/1366/1920. Contraste AA. `prefers-reduced-motion` respetado.
- Pie siempre abajo (`body` flex column + `main { flex: 1 0 auto }`). Toda navegación abre arriba.

## Editor in situ (el cliente edita sin código)
Home, Nosotros y Contáctenos. Entrada con `?edit` → Google Sign-In → correos de `ADMINS` en `src/editor/config.ts` (misma lista en `firestore.rules`). Datos en Firestore `page_contents` (un documento por bloque + `layout__<página>`). Los visitantes reciben lo publicado por un script de 8 KB (REST + caché 10 min) y cada build lo hornea en el HTML.
- Marcar bloques: `<Ed id="pagina_seccion_elemento" as="h2">…</Ed>`, `<EdImg id=… src=… alt=… />`, `<EdLink id=… href=…><Ed id=…>texto</Ed></EdLink>`, secciones `data-ed-sec="clave" data-ed-label="Nombre"`, página `<Base editable="clave">`.
- **Los ids nunca se renombran** (el cliente perdería ese contenido). El valor por defecto es siempre lo que está en el código.
- Probar la interfaz sin Firebase: `npx cross-env PUBLIC_ED_DEMO=1 npm run build` + `npm run preview` → `/?edit`.
- Estado: Firebase Auth/Firestore/app web aún por configurar en la consola (ver README "Editor in situ"). Confirmar si "Lady" es leidy.carrillo@ o ladylaura.garcia@.

## Seguridad y datos
- Nunca guardes contraseñas, tokens ni credenciales en el repo ni en archivos de memoria. Secretos (SMTP, etc.) van a Secret Manager en la Fase F.
- No intentes iniciar sesión en wp-admin/Webflow/consolas desde scripts; eso lo hace Nicolas a mano.
- `firebase.json` se genera con `npm run firebase:json`; el rewrite a `/api/form` solo aparece cuando exista `functions/`.

## Pendientes principales
1. Configurar Firebase para el editor (Auth Google + dominios, Firestore, app web → `apiKey`/`appId` en `src/editor/config.ts`, `firebase deploy --only firestore:rules`).
2. Fase F: Cloud Function `formulario` (honeypot, límite por IP, validación país/idioma, aviso a contactenos@) + Secret Manager. Hoy el formulario falla al enviar.
3. Páginas faltantes: `/trabaja-con-nosotros/`, `/linea-de-transparencia/`, `/vinculacion/`, `/eventos/`, `/politica-de-datos/` (contenido en el consolidado del Webflow viejo).
4. Datos de relleno a reemplazar con el cliente: WhatsApp `573000000000`, horario, sello ISO/ICONTEC, año de fundación (1996 vs 1992), logos de clientes para prueba social, PDF del catálogo 2026.
5. Medición: reutilizar GTM `GTM-PHGTFJG`, decidir GA4 (G-MXQPSS996H o G-HHFRJLTQWH), píxel Meta 1194049767926479; conseguir accesos.
6. Una imagen fallida en `export/imagenes-fallidas.txt`.

## Cómo trabajar aquí
- Antes de cambiar diseño, mira `/sistema/` y `global.css`; reutiliza tokens y clases existentes.
- Después de cada cambio: `npm run build` (OK) y revisión visual en 1366 y 390 con `npm run dev`. Para cambios de layout, captura antes/después.
- Commits pequeños en español ("hero: título más corto", "editor: panel de destino").
- Cuando una tarea termine, agrega una entrada breve en `WEB_SITIO_ASTRO.md` (bitácora) con fecha.
