// Trae del WordPress en vivo páginas sueltas que deben conservar su URL exacta (registros sanitarios INVIMA,
// que van en los QR de los equipos, y páginas como /molbio/) y las agrega o actualiza en src/data/paginas.json.
// Descarga sus imágenes a public/media/ en WebP para que no dependan del WordPress.
//   node scripts/importar_paginas_wp.mjs            → todos los registros sanitarios + EXTRA
//   node scripts/importar_paginas_wp.mjs slug1 slug2 → solo esos
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const WP = 'https://www.quimiolab.com.co/wp-json/wp/v2';
const EXTRA = ['molbio']; // páginas raíz con contenido propio que no son marca del catálogo
const archivo = join(raiz, 'src', 'data', 'paginas.json');
const paginas = JSON.parse(readFileSync(archivo, 'utf8'));
const decodificar = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&rsquo;|&lsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
const json = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`); return r.json(); };

async function todosLosRegistros() {
  const out = []; for (let p = 1; p < 20; p++) {
    const r = await fetch(`${WP}/pages?per_page=100&page=${p}&_fields=slug`); if (!r.ok) break;
    const a = await r.json(); if (!a.length) break; out.push(...a.map((x) => x.slug).filter((s) => s.startsWith('registro-sanitario'))); if (a.length < 100) break;
  }
  return out;
}

/** Descarga una imagen del WP a /media/<nombre>-<hash>.webp (como las del resto del sitio). */
async function imagenLocal(url) {
  const limpio = url.split('?')[0];
  const base = decodeURIComponent(limpio.split('/').pop()).replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const nombre = `${base}-${createHash('md5').update(limpio).digest('hex').slice(0, 8)}.webp`;
  const destino = join(raiz, 'public', 'media', nombre);
  if (!existsSync(destino)) {
    const r = await fetch(limpio, { signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`imagen ${r.status} ${limpio}`);
    await sharp(Buffer.from(await r.arrayBuffer())).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(destino);
  }
  return `/media/${nombre}`;
}

/** Limpieza básica del HTML del editor de WordPress (sin clases, estilos ni contenedores vacíos; enlaces sin rastreadores). */
async function limpiar(html) {
  let h = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\s(class|style|id|data-[\w-]+|srcset|sizes|decoding|loading|fetchpriority)="[^"]*"/g, '');
  const urls = [...new Set([...h.matchAll(/src="(https?:\/\/(?:www\.)?quimiolab\.com\.co\/wp-content\/uploads\/[^"]+)"/g)].map((m) => m[1]))];
  for (const u of urls) h = h.split(u).join(await imagenLocal(u));
  h = h.replace(/href="(https?:\/\/[^"]+?)[?&]utm_[^"]*"/g, 'href="$1"');
  h = h.replace(/href="https?:\/\/(?:www\.)?quimiolab\.com\.co(\/[^"]*)"/g, 'href="$1"');
  h = h.replace(/<(\/?)h1>/g, '<$1h2>'); // el H1 lo pone la plantilla: el del contenido baja a H2
  h = h.replace(/<\/?(div|span|section)[^>]*>/g, '').replace(/<p>\s*<\/p>/g, '').replace(/\n{3,}/g, '\n\n');
  return h.trim();
}

const pedidos = process.argv.slice(2);
const slugs = pedidos.length ? pedidos : [...new Set([...(await todosLosRegistros()), ...EXTRA])];
let nuevos = 0, actualizados = 0;
for (const slug of slugs) {
  const [pg] = await json(`${WP}/pages?slug=${encodeURIComponent(slug)}&_fields=slug,title,content,modified,status`);
  if (!pg || pg.status !== 'publish') { console.warn(`  sin publicar o no existe: ${slug}`); continue; }
  const item = { slug, url: `/${slug}/`, titulo: decodificar(pg.title.rendered.replace(/<[^>]+>/g, '')).trim(), contenido_html: await limpiar(pg.content.rendered), modificado: pg.modified };
  const i = paginas.findIndex((p) => p.slug === slug);
  if (i < 0) { paginas.push(item); nuevos++; console.log(`  + ${slug}`); }
  else if (paginas[i].modificado !== item.modificado) { paginas[i] = item; actualizados++; console.log(`  ~ ${slug}`); }
}
writeFileSync(archivo, JSON.stringify(paginas, null, 1));
console.log(`páginas: ${nuevos} nuevas, ${actualizados} actualizadas (${paginas.length} en total)`);
