// Revisión tras cada build: un H1, canonical, noindex donde toca, URLs críticas y redirecciones.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');
const errores = [];
const aviso = [];

const criticas = ['/', '/contactenos/', '/nosotros/', '/marcas/', '/marcas/aesku/', '/marcas/sd-biosensor/', '/marcas/binding-site/', '/marcas/vircell/', '/equipos/', '/productos/', '/productos/pagina/2/', '/soluciones/', '/soluciones/diagnostico/', '/soluciones/diagnostico/productos/', '/blog/', '/producto/helios-convencional/', '/producto/virclia-lotus/', '/producto/optilite/', '/politica-de-denuncias-y-no-retaliacion/', '/registro-sanitario-no-invima2025dm-0031196-serial-m05p41pab8706/', '/buscar/', '/sistema/', '/404.html', '/sitemap-index.xml', '/sitemap-productos.xml', '/blog/rss.xml', '/llms.txt', '/robots.txt'];
const noindex = ['/buscar/', '/sistema/', '/admin/', '/404.html', '/registro-sanitario-no-invima2025dm-0031196-serial-m05p41pab8706/'];
const archivo = (ruta) => (ruta.endsWith('/') ? join(dist, ruta, 'index.html') : join(dist, ruta));

for (const ruta of criticas) {
  const f = archivo(ruta);
  if (!existsSync(f)) { errores.push(`falta ${ruta}`); continue; }
  if (!f.endsWith('.html')) continue;
  const html = readFileSync(f, 'utf8');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) errores.push(`${ruta}: ${h1} H1`);
  if (!/<link rel="canonical" href="https:\/\/www\.quimiolab\.com\.co\//.test(html)) errores.push(`${ruta}: canonical ausente o incorrecto`);
  if (!/<meta name="description" content="[^"]{20,}/.test(html)) errores.push(`${ruta}: meta descripción ausente`);
  const esNoindex = /name="robots" content="noindex/.test(html);
  if (noindex.includes(ruta) && !esNoindex) errores.push(`${ruta}: debería ser noindex`);
  if (!noindex.includes(ruta) && esNoindex && process.env.PUBLIC_NOINDEX !== '1') errores.push(`${ruta}: noindex en producción`);
  if (/quimiolab\.com\.co\/wp-content|uploads-ssl\.webflow\.com/.test(html)) aviso.push(`${ruta}: imágenes aún en el CDN viejo (Fase E pendiente)`);
  if (/href="https?:\/\/(www\.)?quimiolab\.com\/[^"]/.test(html)) errores.push(`${ruta}: enlace al dominio viejo quimiolab.com`);
}

// Todas las páginas: un H1 y sin enlaces internos rotos
let total = 0, sinH1 = 0; const rotos = new Set();
const rutas = new Set();
const recorrer = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) recorrer(p); else if (n === 'index.html') rutas.add(p.slice(dist.length).replace(/\\/g, '/').replace(/index\.html$/, '')); } };
recorrer(dist);
for (const ruta of rutas) {
  total++;
  const html = readFileSync(join(dist, ruta, 'index.html'), 'utf8');
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) sinH1++;
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const h = decodeURI(m[1]);
    if (h.startsWith('/wp-content/') || h.startsWith('/api/') || h.startsWith('/pagefind/') || h.startsWith('/marcas/') && /\.(png|svg)$/.test(h) || /\.(xml|txt|css|js|jpg|png|svg|webp|ico)$/.test(h)) continue;
    const ok = existsSync(join(dist, h, 'index.html')) || existsSync(join(dist, h));
    if (!ok) rotos.add(h);
  }
}
if (sinH1) errores.push(`${sinH1} páginas sin H1 único`);
const pendientes = ['/trabaja-con-nosotros/', '/linea-de-transparencia/', '/vinculacion/', '/politica-de-datos/', '/eventos/'];
for (const r of rotos) (pendientes.includes(r) ? aviso : errores).push(`enlace roto: ${r}`);

// Redirecciones: origen y destino no pueden ser la misma ruta ni encadenarse
if (existsSync(join(raiz, 'redirects.csv'))) {
  const filas = readFileSync(join(raiz, 'redirects.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(','));
  const origenes = new Set(filas.map((f) => f[0]));
  for (const [o, d] of filas) {
    if (o === d) errores.push(`redirección a sí misma: ${o}`);
    if (origenes.has(d)) errores.push(`cadena de redirecciones: ${o} → ${d}`);
    if (!pendientes.includes(d) && !existsSync(join(dist, decodeURI(d), 'index.html')) && !existsSync(join(dist, decodeURI(d)))) errores.push(`destino inexistente: ${o} → ${d}`);
  }
  console.log(`redirecciones: ${filas.length}`);
}

console.log(`páginas: ${total} · URLs críticas: ${criticas.length}`);
for (const a of [...new Set(aviso)].slice(0, 12)) console.log('aviso:', a);
if (aviso.length > 12) console.log(`… y ${aviso.length - 12} avisos más`);
if (errores.length) { console.error('\nERRORES:'); errores.forEach((e) => console.error(' -', e)); process.exit(1); }
console.log('check_build: OK');
