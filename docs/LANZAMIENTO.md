# Lanzamiento de www.quimiolab.com — lo que falta (tu parte)

**Dónde vamos:** el sitio nuevo ya está publicado en producción (https://quimiolab-web.web.app) con todo listo para el dominio **www.quimiolab.com** (canonical, sitemaps, Google Tag Manager). Solo falta conectar los dominios. Hasta que cambies los DNS, los visitantes siguen viendo el WordPress: no hay prisa ni riesgo mientras tanto.

## Lo que ya quedó hecho (Claude)
- **Mapa de URLs completo** (`docs/mapa-urls.csv`, 798 URLs): las 664 del WordPress en vivo + rutas del Webflow viejo de quimiolab.com. Probadas en Firebase: **todas responden 200 con una sola redirección como máximo**, sin bucles.
- Traídos del WordPress los **2 registros sanitarios INVIMA creados el 15-oct** (QR de equipos) y la página **/molbio/**, con sus imágenes.
- PDF de la **política de datos** y la última imagen que dependían del WordPress, ahora en el sitio nuevo. Ya no queda contenido apuntando al WordPress.
- Páginas nuevas: **/politica-de-datos/**, **/trabaja-con-nosotros/**, **/linea-de-transparencia/**, **/vinculacion/** (texto del Webflow; revisar con Quimiolab). /eventos/ → /blog/.
- **WhatsApp** real en todo el sitio: +57 321 482 4921 (principal) y +57 313 269 1485.
- **Formularios**: cada solicitud se guarda y aparece en el panel → pestaña **Solicitudes** (con anti-spam). El aviso por correo a milacontigo@quimiolab.com queda pendiente (ver al final).
- Dominio principal cambiado a **www.quimiolab.com** en todo el código; guía, recorridos y videos actualizados.

---

## Paso 1 y 2 — Firebase ✅ (hecho por Claude el 15-oct)
- Hosting: agregados **www.quimiolab.com** (principal) y **quimiolab.com**, **quimiolab.com.co**, **www.quimiolab.com.co** (los tres redirigen a www.quimiolab.com). Estado: «Requiere configuración» hasta que cambien los DNS.
- Authentication → Dominios autorizados: agregados **www.quimiolab.com** y **quimiolab.com**.

## Paso 3 — DNS de quimiolab.com en GoDaddy (10 min)
Abre https://dcc.godaddy.com/control/portfolio → **quimiolab.com** → **DNS**.

1. Pestaña **Reenvío** (Forwarding): **elimina** el reenvío del dominio hacia www.quimiolab.com.co.
2. Pestaña **Registros DNS**, deja exactamente esto para el sitio:

| Tipo | Nombre | Valor | Qué hacer |
|---|---|---|---|
| A | @ | 199.36.158.100 | agregar (borra los A `15.197.225.128` y `3.33.251.168`) |
| TXT | @ | hosting-site=quimiolab-web | agregar (sin borrar los otros TXT) |
| CNAME | www | quimiolab-web.web.app | reemplaza lo que haya en `www` (hoy A `15.197.225.128` / `3.33.251.168`) |

3. **NO toques** estos (correo de Quimiolab en Microsoft 365):
   - MX `@` → `quimiolab-com.mail.protection.outlook.com`
   - TXT `@` → `v=spf1 include:spf.protection.outlook.com -all` y `MS=ms66876403`
   - CNAME `autodiscover`, `selector1._domainkey`, `selector2._domainkey` y cualquier otro que mencione outlook / microsoft.

## Paso 4 — DNS de quimiolab.com.co en ColombiaHosting (10 min)
cPanel de ColombiaHosting → **Zone Editor** → **quimiolab.com.co**.

1. **Primero el correo de .com.co** (hoy depende de la IP del WordPress):
   - `mail`: cambia el CNAME (→ `quimiolab.com.co`) por un **A** `mail` → `190.8.176.146`.
   - **MX** de `quimiolab.com.co`: cámbialo a `mail.quimiolab.com.co` (prioridad 0).
2. Después el sitio:

| Tipo | Nombre | Valor | Qué hacer |
|---|---|---|---|
| A | quimiolab.com.co (@) | 199.36.158.100 | reemplaza el A `190.8.176.146` |
| TXT | quimiolab.com.co (@) | hosting-site=quimiolab-web | agregar (sin borrar el SPF) |
| CNAME | www | quimiolab-web.web.app | reemplaza el CNAME `www` → `quimiolab.com.co` |

3. **No canceles el hosting de ColombiaHosting** todavía: el WordPress queda como respaldo en `190.8.176.146` y el correo .com.co sigue ahí.

## Paso 5 — Esperar y comprobar (de 15 min a 24 h)
Firebase emite los certificados solo. En la lista de dominios el estado pasa a **«Conectado»**.
✔ Cuando estén conectados, abre: https://www.quimiolab.com · https://quimiolab.com.co/aesku/ (debe llegar a /marcas/aesku/) · https://www.quimiolab.com.co/producto/optilite/
Y pega en Claude Code:
> Los dominios ya están conectados en Firebase. Verifica en vivo, sobre https://www.quimiolab.com, todas las URLs de docs/mapa-urls.csv y que quimiolab.com, quimiolab.com.co y www.quimiolab.com.co redirijan con 301 conservando la ruta. Revisa también que el correo de quimiolab.com siga apuntando a Outlook (MX). Dime si algo falla.

## Paso 6 — Google Search Console (10 min)
1. https://search.google.com/search-console → **Agregar propiedad** → **Dominio** → `quimiolab.com` → copia el TXT y agrégalo en GoDaddy (como en el paso 3) → **Verificar**.
2. **Sitemaps** → envía `https://www.quimiolab.com/sitemap-index.xml`.
3. Si ya existe la propiedad de `quimiolab.com.co`: entra a ella → **Configuración → Cambio de dirección** → nuevo sitio `www.quimiolab.com`. Así Google traslada el posicionamiento del .com.co al .com.

---

## Pendientes después del lanzamiento
1. **Correo de los formularios a milacontigo@quimiolab.com**: necesito una credencial de envío (un buzón SMTP de Microsoft 365 de Quimiolab, o una cuenta de Resend/SendGrid). Mientras tanto, todo queda en el panel → Solicitudes (no se pierde nada).
2. **Registros sanitarios nuevos**: Quimiolab creaba en el WordPress una página por serial de equipo (QR). Tras el cambio, esas páginas se crean en el sitio nuevo: hoy con `node scripts/importar_paginas_wp.mjs` (si siguen en el WP) o agregando la opción al panel (recomendado).
3. **Revisar con Quimiolab**: textos de política de datos, trabaja con nosotros, línea de transparencia y vinculación; vigencia del certificado ICONTEC ISO 9001 que dice el sitio; horario; correo `lineadetransparencia@quimiolab.com` (venía del Webflow).
4. **Publicación automática** del panel (fase 4): hoy lo publicado en `/admin/` aparece con el siguiente deploy.
5. **Historial del Webflow**: el Archivo de Internet bloqueó las consultas. Cuando responda, refinar las redirecciones por ruta de quimiolab.com (hoy cubiertas por prefijo: /marca/, /equipo/, /evento-cientifico/…).
