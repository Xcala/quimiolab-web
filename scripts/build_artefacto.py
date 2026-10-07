"""Arma la carpeta del artefacto (claude.ai) a partir de dist/.

Copia un subconjunto de páginas, vuelve relativos los enlaces y rutas de assets,
renombra _astro → astro (el host no admite rutas que empiecen por "_"),
sustituye las imágenes externas (CDN viejo) por un placeholder SVG (CSP del host),
quita GTM y deja index.html sin envoltorio html/head/body (el host lo agrega).

Uso: python scripts/build_artefacto.py [destino]   (por defecto ../artefacto)
"""
import os, re, shutil, sys, urllib.parse

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(RAIZ, 'dist')
DEST = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(RAIZ), 'artefacto')
TITULO = 'Quimiolab Sitio Astro'

PAGINAS = ['', 'blog', 'blog/dia-mundial-de-la-tuberculosis-estrategia-end-tb-2', 'buscar', 'contactenos', 'equipos',
           'marcas', 'marcas/aesku', 'marcas/sd-biosensor', 'marcas/vircell', 'nosotros',
           'producto/helios-convencional', 'producto/optilite', 'producto/virclia-lotus', 'productos', 'sistema',
           'soluciones', 'soluciones/diagnostico', 'soluciones/diagnostico/productos']
CARPETAS_ASSETS = ['img', 'marcas', 'patrones', 'media', '_astro']
ARCHIVOS_ASSETS = ['favicon.svg', 'og-quimiolab.jpg', '404.html']

PLACEHOLDER = 'data:image/svg+xml;base64,' + __import__('base64').b64encode(
    ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#E3EEF8"/>'
     '<text x="200" y="158" text-anchor="middle" font-family="Roboto,Arial" font-size="18" fill="#4A5A78">Imagen (Fase E)</text></svg>').encode()).decode()

def rel(prefix, ruta):
    """Ruta absoluta del sitio → relativa desde la página."""
    ruta = ruta.replace('/_astro/', '/astro/')
    return (prefix or './') + ruta.lstrip('/')

def procesar_html(html, profundidad, es_index):
    prefix = '../' * profundidad
    # enlaces y assets con ruta absoluta del sitio (no protocolo)
    html = re.sub(r'(href|src|poster)="/(?!/)([^"]*)"', lambda m: f'{m.group(1)}="{rel(prefix, "/" + m.group(2))}"', html)
    html = re.sub(r'(srcset|content)="/(?!/)([^"]*)"', lambda m: f'{m.group(1)}="{rel(prefix, "/" + m.group(2))}"', html)
    html = re.sub(r'url\(/(?!/)([^)]*)\)', lambda m: f'url({rel(prefix, "/" + m.group(1))})', html)
    # imágenes externas → placeholder
    html = re.sub(r'src="https?://[^"]+\.(?:jpe?g|png|gif|webp|svg)[^"]*"', f'src="{PLACEHOLDER}"', html, flags=re.I)
    html = re.sub(r'\ssrcset="https?://[^"]*"', '', html)
    # GTM y consent scripts de terceros
    html = re.sub(r'<script[^>]*>[^<]*googletagmanager[^<]*</script>', '', html)
    html = re.sub(r'<noscript><iframe[^>]*googletagmanager[^<]*</iframe></noscript>', '', html)
    html = html.replace('rel="canonical" href="' + rel(prefix, '/'), 'rel="canonical" href="https://www.quimiolab.com.co/')
    if es_index:
        html = re.sub(r'<title>[^<]*</title>', f'<title>{TITULO}</title>', html, count=1)
        head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
        body = re.search(r'<body[^>]*>(.*?)</body>', html, re.S).group(1)
        html = head + body
    return html

AVISO = """<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Página no incluida en la vista previa</title>
<style>body{margin:0;font-family:Roboto,Arial,sans-serif;background:linear-gradient(35deg,#001A4D,#002468 52%,#003087);color:#fff;min-height:100vh;display:grid;place-items:center;padding:1rem}
.c{max-width:34rem;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:1rem;padding:2rem;backdrop-filter:blur(10px)}h1{font-family:Poppins,Arial,sans-serif;font-size:1.5rem;margin:0 0 .75rem}p{line-height:1.55;color:#C2D8EC}a{color:#00CDF4;font-weight:700}</style></head>
<body><div class="c"><h1>Esta página no está en la vista previa</h1><p>El artefacto solo incluye una muestra de páginas (home, listados, 3 fichas de producto, 3 marcas, un artículo). En el sitio completo esta ruta existe y funciona; se revisa en <code>localhost:4321</code> o en la URL de vista previa de Firebase.</p><p><a href="javascript:history.back()">← Volver</a> · <a href="__RAIZ__">Ir al inicio</a></p></div></body></html>"""

def reenlazar_faltantes(dest_dir, paginas):
    """Los enlaces a páginas que no están en el artefacto van a la página de aviso."""
    incluidas = {'/' + (p + '/' if p else '') for p in paginas} | {'/no-incluido/'}
    for root, _, fs in os.walk(dest_dir):
        for f in fs:
            if not f.endswith('.html'):
                continue
            ruta = os.path.join(root, f)
            rel_dir = os.path.relpath(root, dest_dir).replace('\\', '/')
            base = '/' if rel_dir == '.' else '/' + rel_dir + '/'
            prof = 0 if rel_dir == '.' else rel_dir.count('/') + 1
            prefix = '../' * prof
            html = open(ruta, encoding='utf-8').read()
            def rep(m):
                href = m.group(1)
                if href.startswith(('http', 'mailto:', 'tel:', '#', 'javascript:', 'data:')):
                    return m.group(0)
                limpio = href.split('#')[0].split('?')[0]
                if not limpio or not limpio.endswith('/'):
                    return m.group(0)  # assets, rss, sitemaps…
                absoluto = os.path.normpath(os.path.join(base, limpio)).replace('\\', '/')
                if not absoluto.endswith('/'):
                    absoluto += '/'
                if absoluto in incluidas:
                    return m.group(0)
                return f'href="{prefix or "./"}no-incluido/"'
            nuevo = re.sub(r'href="([^"]*)"', rep, html)
            if nuevo != html:
                open(ruta, 'w', encoding='utf-8').write(nuevo)

def main():
    if os.path.isdir(DEST):
        shutil.rmtree(DEST)
    os.makedirs(DEST)
    for c in CARPETAS_ASSETS:
        src = os.path.join(DIST, c)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(DEST, c.lstrip('_')), ignore=shutil.ignore_patterns('*.html'))
            if c == 'marcas':  # solo los logos; las páginas de marca se procesan aparte
                for d in [x for x in os.listdir(os.path.join(DEST, c)) if os.path.isdir(os.path.join(DEST, c, x))]:
                    shutil.rmtree(os.path.join(DEST, c, d))
    for a in ARCHIVOS_ASSETS:
        if os.path.exists(os.path.join(DIST, a)):
            shutil.copy(os.path.join(DIST, a), os.path.join(DEST, a))
    # css: rutas absolutas → relativas a astro/
    for f in os.listdir(os.path.join(DEST, 'astro')):
        p = os.path.join(DEST, 'astro', f)
        if f.endswith('.css'):
            css = open(p, encoding='utf-8').read()
            css = re.sub(r'url\(/(?!/)([^)]*)\)', r'url(../\1)', css)
            open(p, 'w', encoding='utf-8').write(css)
    n = 0
    for pag in PAGINAS:
        src = os.path.join(DIST, pag, 'index.html')
        if not os.path.exists(src):
            print('falta', pag); continue
        prof = 0 if pag == '' else pag.count('/') + 1
        html = procesar_html(open(src, encoding='utf-8').read(), prof, pag == '')
        dest = os.path.join(DEST, pag, 'index.html')
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, 'w', encoding='utf-8').write(html); n += 1
    # 404 y marcas/*.html no aplican; quitar logos que no son assets de página no hace falta
    os.makedirs(os.path.join(DEST, 'no-incluido'), exist_ok=True)
    open(os.path.join(DEST, 'no-incluido', 'index.html'), 'w', encoding='utf-8').write(AVISO.replace('__RAIZ__', '../'))
    reenlazar_faltantes(DEST, PAGINAS)
    print(f'artefacto: {n} páginas en {DEST}')

if __name__ == '__main__':
    main()
