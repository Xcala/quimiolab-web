#!/usr/bin/env python3
"""Convierte el export crudo del WordPress (export/quimiolab-wp-export-*.json)
en los JSON que consume el sitio Astro (src/data/*.json) y genera redirects.csv.

Uso:  python scripts/prep_data.py [ruta-al-export.json]
"""
import csv
import glob
import html
import json
import os
import re
import sys
import unicodedata
from urllib.parse import unquote
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORT = sys.argv[1] if len(sys.argv) > 1 else sorted(glob.glob(os.path.join(ROOT, "export", "quimiolab-wp-export-*.json")))[-1]
OUT = os.path.join(ROOT, "src", "data")
os.makedirs(OUT, exist_ok=True)

SITE = "https://www.quimiolab.com.co"
e = json.load(open(EXPORT, encoding="utf-8"))

# ---------------------------------------------------------------- utilidades
def strip_tags(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()

def clean_html(s):
    """Limpia el HTML del CMS sin tocar el texto: quita clases/estilos/ids del
    builder, wrappers vacíos y enlaces absolutos al dominio viejo."""
    if not s:
        return ""
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", s, flags=re.S | re.I)
    s = re.sub(r'\s(class|style|id|data-[a-z-]+|aria-hidden|loading|decoding|fetchpriority|sizes|srcset)="[^"]*"', "", s)
    s = re.sub(r"<(/?)(section|figure|figcaption|span)\b[^>]*>", "", s)
    s = re.sub(r"<(/?)h1\b", r"<\1h2", s)  # el H1 lo pone la plantilla; el del CMS baja a H2
    s = re.sub(r"<div\b[^>]*>|</div>", "", s)
    for _ in range(3):
        s = re.sub(r"<(p|h[1-6]|li|ul|ol)>\s*(&nbsp;|​|\s)*</\1>", "", s)
    s = re.sub(r"https?://(www\.)?quimiolab\.com\.co/(?!wp-content/)", "/", s)
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    return s

def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s

def excerpt(s, n=160):
    t = strip_tags(s)
    if len(t) <= n:
        return t
    cut = t[:n].rsplit(" ", 1)[0]
    return cut.rstrip(",;:.") + "…"

def media_index():
    idx = {}
    for m in e["media"]:
        idx[m["src"]] = m
        idx[m["id"]] = m
    return idx

MEDIA = media_index()

def img_info(src):
    m = MEDIA.get(src)
    return {"src": src, "w": m.get("w") if m else None, "h": m.get("h") if m else None, "alt": (m.get("alt") if m else "") or ""}

# ---------------------------------------------------------------- líneas (categorías de producto)
pages = {p["slug"]: p for p in e["pages"]}
LINEAS_DEF = [
    ("diagnostico", "Diagnóstico", "linea-diagnostico"),
    ("diagnostico-molecular", "Diagnóstico molecular", "linea-diagnostico-molecular"),
    ("investigacion", "Investigación", "linea-investigacion"),
    ("point-of-care", "Point of Care", "linea-point-of-care"),
]
lineas = []
for slug, nombre, page_slug in LINEAS_DEF:
    pg = pages.get(page_slug, {})
    lineas.append({
        "slug": slug,
        "nombre": nombre,
        "url": f"/soluciones/{slug}/",
        "titulo_seo": strip_tags(pg.get("title", "")) or nombre,
        "descripcion": excerpt(pg.get("content", ""), 220),
        "intro_html": clean_html(pg.get("content", "")),
        "url_wp": f"/{page_slug}/",
    })

# ---------------------------------------------------------------- productos y equipos
productos, equipos = [], []
for p in e["products"]:
    tags = [t["slug"] for t in p.get("tags", [])]
    cats = [c["slug"] for c in p.get("categories", [])]
    brand = (p.get("brands") or [{}])[0]
    imgs = [img_info(i["src"]) | {"alt": i.get("alt") or i.get("name") or p["name"]} for i in p.get("images", [])]
    slug = unquote(p["slug"])  # WP guarda %ce%b1 (α) y %c2%b7 (·); la URL pública es la decodificada
    item = {
        "slug": slug,
        "slug_wp": p["slug"],
        "nombre": html.unescape(p["name"]),
        "url": f"/producto/{slug}/",
        "marca": brand.get("slug"),
        "marca_nombre": brand.get("name"),
        "lineas": [c for c in cats if c != "sin-categorizar"],
        "familia": [t for t in tags if t.startswith("standard-")],
        "resumen": excerpt(p.get("short_description", ""), 200),
        "resumen_html": clean_html(p.get("short_description", "")),
        "descripcion_html": clean_html(p.get("description", "")),
        "imagenes": imgs,
        "imagen": imgs[0] if imgs else None,
        "es_equipo": "equipo" in tags,
    }
    (equipos if item["es_equipo"] else productos).append(item)

productos.sort(key=lambda x: x["nombre"].lower())
equipos.sort(key=lambda x: x["nombre"].lower())

# ---------------------------------------------------------------- marcas
# Nombre oficial y color de acento por aliado (manual de marca, sección "Marcas representadas").
BRAND_META = {
    "aesku": ("AESKU", "#98B830"), "vircell": ("Vircell", "#009673"), "sd-biosensor": ("SD BIOSENSOR", "#004A98"),
    "diasorin": ("Diasorin", "#06255B"), "thermo-fisher": ("Thermo Fisher", "#EF4135"), "binding-site": ("The Binding Site", "#FCEA19"),
    "diapro": ("Dia.Pro", "#00AEEA"), "gold-standard": ("Gold Standard", "#FBD726"), "stratec": ("STRATEC", "#E30613"),
    "fujirebio": ("Fujirebio", "#4878B4"), "elitechgroup": ("ELITechGroup", "#74C043"), "genmark": ("GenMark", "#555555"),
    "genolution": ("Genolution", "#FFDA00"), "tianlong": ("Xi'an Tianlong", "#004BA0"), "mp-biomedicals": ("MP Biomedicals", "#1E55AA"),
    "abm": ("abm", "#EC751A"), "ningbo-hls-medical": ("Ningbo HLS Medical", "#1E1914"), "college-of-american-pathologist": ("College of American Pathologists", "#009ABF"),
    "meridian-bioscience": ("Meridian Bioscience", "#7A2A8F"), "quidel": ("Quidel", "#00A0DF"), "abclonal": ("ABclonal", "#1F6FB2"),
    "amplyus": ("Amplyus", "#2B7BBB"), "celltrazone": ("Celltrazone", "#3C8DBC"), "gemini": ("Gemini", "#0097D6"),
    "genosolution": ("Genosolution", "#2E9E6B"), "macherey-nagel": ("Macherey-Nagel", "#00AEEF"),
}
BRAND_PAGE_ALIASES = {"elitechgroup": "elitech-group", "vircell": "vircell", "binding-site": "binding-site"}
def brand_intro(slug):
    pg = pages.get(BRAND_PAGE_ALIASES.get(slug, slug))
    if not pg:
        return "", ""
    c = pg["content"]
    # el texto institucional va antes de los listados "Buscar Equipos"/"Productos"
    cut = re.search(r"<form\b|>\s*Buscar\s*<|Buscar Equipos|Estos son los equipos|Estos son los productos", c)
    intro = c[: cut.start()] if cut else c
    intro = re.sub(r"<img\b[^>]*>", "", intro)  # los logos/fotos del intro ya van en la placa de marca
    intro = re.sub(r"<(p|h[1-6])>\s*" + re.escape(html.unescape(pages.get(BRAND_PAGE_ALIASES.get(slug, slug), {}).get("title", {}).get("rendered", "") if isinstance(pages.get(BRAND_PAGE_ALIASES.get(slug, slug), {}).get("title"), dict) else "")) + r"\s*</\1>", "", intro, count=1)
    h = clean_html(intro)
    h = re.sub(r"<a\b[^>]*>\s*</a>", "", h)                                  # anclas vacías
    h = re.sub(r"<p>\s*([A-ZÁÉÍÓÚÑ0-9 .&·'-]{2,32})\s*</p>", lambda m: f'<p class="eyebrow">{m.group(1).title() if m.group(1).isupper() and len(m.group(1)) > 12 else m.group(1)}</p>', h)  # rótulos en mayúsculas del builder
    h = re.sub(r"\s*​", "", h)
    return h, excerpt(re.sub(r'<p class="eyebrow">[^<]*</p>', "", h), 220)

by_brand_p = Counter(x["marca"] for x in productos)
by_brand_e = Counter(x["marca"] for x in equipos)
marcas = []
for b in e["pbrands"]:
    intro_html, resumen = brand_intro(b["slug"])
    marcas.append({
        "slug": b["slug"],
        "nombre": BRAND_META.get(b["slug"], (html.unescape(b["name"]),))[0],
        "nombre_wp": html.unescape(b["name"]),
        "color": BRAND_META.get(b["slug"], (None, "#0097D6"))[1],
        "url": f"/marcas/{b['slug']}/",
        "resumen": resumen,
        "intro_html": intro_html,
        "n_productos": by_brand_p.get(b["slug"], 0),
        "n_equipos": by_brand_e.get(b["slug"], 0),
        "lineas": sorted({l for x in productos + equipos if x["marca"] == b["slug"] for l in x["lineas"]}),
        "pagina_wp": f"/{BRAND_PAGE_ALIASES.get(b['slug'], b['slug'])}/" if pages.get(BRAND_PAGE_ALIASES.get(b['slug'], b['slug'])) else None,
        "taxonomia_wp": f"/marca/{b['slug']}/",
    })
marcas.sort(key=lambda m: (-(m["n_productos"] + m["n_equipos"]), m["nombre"].lower()))

# ---------------------------------------------------------------- blog
posts = []
for p in e["posts"]:
    fm = MEDIA.get(p.get("featured_media"))
    posts.append({
        "slug": p["slug"],
        "url": f"/blog/{p['slug']}/",
        "url_wp": f"/{p['slug']}/",
        "titulo": html.unescape(strip_tags(p["title"])),
        "fecha": p["date"],
        "modificado": p["modified"],
        "resumen": excerpt(p.get("excerpt") or p.get("content", ""), 180),
        "contenido_html": clean_html(p.get("content", "")),
        "imagen": img_info(fm["src"]) if fm else None,
    })
posts.sort(key=lambda x: x["fecha"], reverse=True)

# ---------------------------------------------------------------- páginas fijas
FIJAS = {
    "nosotros": "/nosotros/",
    "contactenos": "/contactenos/",
    "politica-de-denuncias-y-no-retaliacion": "/politica-de-denuncias-y-no-retaliacion/",
}
paginas = []
for slug, pg in pages.items():
    if slug in FIJAS or slug.startswith("registro-sanitario"):
        paginas.append({
            "slug": slug,
            "url": FIJAS.get(slug, f"/{slug}/"),
            "titulo": html.unescape(strip_tags(pg["title"])),
            "contenido_html": clean_html(pg["content"]),
            "modificado": pg["modified"],
        })

# ---------------------------------------------------------------- redirecciones
redirects = []
def add(src, dst):
    if src != dst:
        redirects.append((src, dst, 301))
for m in marcas:
    add(m["taxonomia_wp"], m["url"])
    add(m["pagina_wp"] or f"/{m['slug']}/", m["url"])  # la página raíz de marca del WP (exista o no hoy)
add("/euformatics/", "/marcas/")  # marca descontinuada, enlazada desde la línea molecular
for p in posts:
    add(p["url_wp"], p["url"])
for l in lineas:
    add(l["url_wp"], l["url"])
    add(f"/productos-{l['url_wp'].strip('/')}/", f"{l['url']}productos/")
    add(f"/equipos-{l['url_wp'].strip('/')}/", f"{l['url']}equipos/")
for c in e["pcats"]:
    if c["slug"] != "sin-categorizar":
        add(f"/categoria-producto/{c['slug']}/", f"/soluciones/{c['slug']}/")
for junk, dst in [("/sample-page/", "/"), ("/offerings/", "/"), ("/tienda/", "/productos/"),
                  ("/carrito/", "/productos/"), ("/finalizar-compra/", "/productos/"), ("/mi-cuenta/", "/contactenos/"),
                  ("/home/", "/"), ("/blog/", "/blog/")]:
    add(junk, dst)
for t in ("producto", "producto-sd", "equipo", "standard-f", "standard-q", "standard-m", "standard-e"):
    add(f"/etiqueta-producto/{t}/", "/productos/")

# ---------------------------------------------------------------- reescribir enlaces internos del CMS a las rutas nuevas
MAPA = {o: d for o, d, _ in redirects}
def reenlazar(s):
    def rep(m):
        h = m.group(1)
        base = h if h.endswith("/") else h + "/"
        if base in MAPA:
            return f'href="{MAPA[base]}"'
        if base.startswith("/evento-cientifico/"):
            return 'href="/eventos/"'
        return m.group(0)
    return re.sub(r'href="(/[^"#?]*)"', rep, s or "")
for col in (productos, equipos):
    for x in col:
        x["resumen_html"] = reenlazar(x["resumen_html"]); x["descripcion_html"] = reenlazar(x["descripcion_html"])
for m in marcas: m["intro_html"] = reenlazar(m["intro_html"])
for l in lineas: l["intro_html"] = reenlazar(l["intro_html"])
for p in posts: p["contenido_html"] = reenlazar(p["contenido_html"])
for p in paginas: p["contenido_html"] = reenlazar(p["contenido_html"])

# ---------------------------------------------------------------- escribir
def dump(name, obj):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)

dump("lineas.json", lineas)
dump("marcas.json", marcas)
dump("productos.json", productos)
dump("equipos.json", equipos)
dump("posts.json", posts)
dump("paginas.json", paginas)
dump("sitio.json", {
    "nombre": "Quimiolab",
    "razon_social": "Quimiolab S.A.S.",
    "nit": "830.024.737-4",
    "direccion": "Calle 77 # 28B-13, Santa Sofía, Bogotá, Colombia",
    "pbx": "(601) 805 4082",
    "pbx_tel": "+576018054082",
    "correo": "contactenos@quimiolab.com",
    "correo_datos": "tratamientodedatos@quimiolab.com",
    "tagline": "Transformando la Experiencia, todos los días.",
    "descripcion": "Soluciones integrales e innovadoras para el diagnóstico clínico y la investigación. Representantes directos en Colombia de las marcas más prestigiosas en diagnóstico in vitro.",
    "url": SITE,
    "gtm": "GTM-PHGTFJG",
    "exportado": e.get("exportedAt"),
})
with open(os.path.join(ROOT, "redirects.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["origen", "destino", "codigo"])
    seen = set()
    for r in redirects:
        if r[0] not in seen:
            seen.add(r[0]); w.writerow(r)

print(f"líneas {len(lineas)} · marcas {len(marcas)} · productos {len(productos)} · equipos {len(equipos)} · posts {len(posts)} · páginas {len(paginas)} · redirecciones {len(seen)}")
print("marcas con página WP:", sum(1 for m in marcas if m["pagina_wp"]), "· productos sin imagen:", sum(1 for p in productos if not p["imagen"]))
