"""Fase E — imágenes locales.

Descarga todas las imágenes que el contenido todavía apunta al WordPress viejo (www.quimiolab.com.co)
y al CDN de Webflow (uploads-ssl.webflow.com), las convierte a WebP en `public/media/` y reescribe
`src/data/*.json` para que el sitio las sirva desde el mismo dominio.

Correr en el PC (el contenedor de Claude no alcanza esos CDN):
    pip install requests pillow
    python scripts/download_images.py            # descarga + convierte + reescribe JSON
    python scripts/download_images.py --solo-mapa  # solo reescribe con lo ya descargado

Idempotente: lo ya descargado no se vuelve a bajar. El mapa queda en `src/data/image-map.json`;
`npm run data` (prep_data.py) regenera los JSON desde el export, así que después de correrlo hay que
volver a ejecutar `python scripts/download_images.py --solo-mapa` (o el script completo).
"""
import hashlib, io, json, os, re, sys, time, urllib.parse

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RAIZ, 'src', 'data')
MEDIA = os.path.join(RAIZ, 'public', 'media')
MAPA = os.path.join(DATA, 'image-map.json')
HOSTS = ('www.quimiolab.com.co', 'quimiolab.com.co', 'uploads-ssl.webflow.com', 'cdn.prod.website-files.com')
EXT_IMG = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif')
ANCHO_MAX = 1600           # ancho máximo al convertir (las fotos de hero del WP vienen a 1920)
CALIDAD = 82
SOLO_MAPA = '--solo-mapa' in sys.argv

URL_RE = re.compile(r'https?://(?:' + '|'.join(re.escape(h) for h in HOSTS) + r')/[^\s"\'\\<>)]+')


def es_imagen(url):
    ruta = urllib.parse.urlparse(url).path.lower()
    return ruta.endswith(EXT_IMG)


def nombre_local(url):
    """Nombre estable y legible: <slug del archivo>-<hash corto>.<ext>"""
    ruta = urllib.parse.unquote(urllib.parse.urlparse(url).path)
    base, ext = os.path.splitext(os.path.basename(ruta))
    base = re.sub(r'[^a-z0-9]+', '-', base.lower()).strip('-')[:60] or 'img'
    h = hashlib.md5(url.encode()).hexdigest()[:8]
    ext = ext.lower()
    ext_final = ext if ext in ('.svg', '.gif') else '.webp'
    return f'{base}-{h}{ext_final}'


def recoger_urls():
    urls = set()
    for f in os.listdir(DATA):
        if not f.endswith('.json') or f == 'image-map.json':
            continue
        texto = open(os.path.join(DATA, f), encoding='utf-8').read()
        for u in URL_RE.findall(texto):
            u = u.replace('\\/', '/').rstrip('.,;')
            if es_imagen(u):
                urls.add(u)
    return sorted(urls)


def descargar(url, destino):
    import requests
    from PIL import Image
    r = requests.get(url, timeout=60, headers={'User-Agent': 'Mozilla/5.0 (Quimiolab migracion)'})
    r.raise_for_status()
    if destino.endswith(('.svg', '.gif')):
        open(destino, 'wb').write(r.content)
        return
    im = Image.open(io.BytesIO(r.content))
    if im.mode in ('P', 'LA') or (im.mode == 'RGBA'):
        im = im.convert('RGBA')
    else:
        im = im.convert('RGB')
    if im.width > ANCHO_MAX:
        im = im.resize((ANCHO_MAX, round(im.height * ANCHO_MAX / im.width)), Image.LANCZOS)
    im.save(destino, 'WEBP', quality=CALIDAD, method=6)


def main():
    os.makedirs(MEDIA, exist_ok=True)
    mapa = json.load(open(MAPA, encoding='utf-8')) if os.path.exists(MAPA) else {}
    urls = recoger_urls()
    print(f'{len(urls)} imágenes referenciadas en src/data')
    fallidas = []
    if not SOLO_MAPA:
        for i, u in enumerate(urls, 1):
            nombre = nombre_local(u)
            destino = os.path.join(MEDIA, nombre)
            if os.path.exists(destino):
                mapa[u] = '/media/' + nombre
                continue
            try:
                descargar(u, destino)
                mapa[u] = '/media/' + nombre
                print(f'[{i}/{len(urls)}] {nombre}')
                time.sleep(0.15)
            except Exception as e:  # noqa
                fallidas.append((u, str(e)))
                print(f'[{i}/{len(urls)}] FALLÓ {u}: {e}')
        json.dump(mapa, open(MAPA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # reescribir JSON de datos
    cambios = 0
    for f in os.listdir(DATA):
        if not f.endswith('.json') or f == 'image-map.json':
            continue
        p = os.path.join(DATA, f)
        texto = open(p, encoding='utf-8').read()
        nuevo = texto
        for u, local in mapa.items():
            if u in nuevo:
                nuevo = nuevo.replace(u, local)
            ue = u.replace('/', '\\/')
            if ue in nuevo:
                nuevo = nuevo.replace(ue, local.replace('/', '\\/'))
        if nuevo != texto:
            open(p, 'w', encoding='utf-8').write(nuevo)
            cambios += 1
    print(f'mapa: {len(mapa)} imágenes · JSON reescritos: {cambios} · fallidas: {len(fallidas)}')
    if fallidas:
        open(os.path.join(RAIZ, 'export', 'imagenes-fallidas.txt'), 'w', encoding='utf-8').write('\n'.join(f'{u}\t{e}' for u, e in fallidas))
        print('lista de fallidas en export/imagenes-fallidas.txt')


if __name__ == '__main__':
    main()
