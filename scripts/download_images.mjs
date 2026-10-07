/**
 * Fase E — imágenes locales (versión Node, sin Python).
 * Descarga las imágenes que el contenido todavía apunta al WordPress viejo (www.quimiolab.com.co) y al
 * CDN de Webflow, las convierte a WebP en public/media/ y reescribe src/data/*.json para servirlas
 * desde el mismo dominio.
 *
 *   npm run images              descarga + convierte + reescribe
 *   npm run images -- --solo-mapa   solo reescribe con lo ya descargado
 *
 * Idempotente: lo ya descargado no se repite. Mapa en src/data/image-map.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(RAIZ, 'src', 'data');
const MEDIA = path.join(RAIZ, 'public', 'media');
const MAPA = path.join(DATA, 'image-map.json');
const HOSTS = ['www.quimiolab.com.co', 'quimiolab.com.co', 'uploads-ssl.webflow.com', 'cdn.prod.website-files.com'];
const EXT_IMG = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'];
const ANCHO_MAX = 1600;
const CALIDAD = 82;
const SOLO_MAPA = process.argv.includes('--solo-mapa');
const URL_RE = new RegExp('https?://(?:' + HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|') + ')/[^\\s"\'\\\\<>)]+', 'g');

const esImagen = (u) => EXT_IMG.some((e) => new URL(u).pathname.toLowerCase().endsWith(e));
const nombreLocal = (u) => {
  const ruta = decodeURIComponent(new URL(u).pathname);
  const ext = path.extname(ruta).toLowerCase();
  const base = (path.basename(ruta, path.extname(ruta)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)) || 'img';
  const h = crypto.createHash('md5').update(u).digest('hex').slice(0, 8);
  return `${base}-${h}${ext === '.svg' || ext === '.gif' ? ext : '.webp'}`;
};
const archivosData = () => fs.readdirSync(DATA).filter((f) => f.endsWith('.json') && f !== 'image-map.json');

function recogerUrls() {
  const urls = new Set();
  for (const f of archivosData()) {
    const texto = fs.readFileSync(path.join(DATA, f), 'utf8');
    for (const m of texto.matchAll(URL_RE)) {
      const u = m[0].replace(/\\\//g, '/').replace(/[.,;]+$/, '');
      if (esImagen(u)) urls.add(u);
    }
  }
  return [...urls].sort();
}

async function descargar(u, destino) {
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Quimiolab migracion)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (destino.endsWith('.svg') || destino.endsWith('.gif')) { fs.writeFileSync(destino, buf); return; }
  await sharp(buf).rotate().resize({ width: ANCHO_MAX, withoutEnlargement: true }).webp({ quality: CALIDAD, effort: 6 }).toFile(destino);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(MEDIA, { recursive: true });
  const mapa = fs.existsSync(MAPA) ? JSON.parse(fs.readFileSync(MAPA, 'utf8')) : {};
  const urls = recogerUrls();
  console.log(`${urls.length} imágenes referenciadas en src/data`);
  const fallidas = [];
  if (!SOLO_MAPA) {
    let i = 0;
    for (const u of urls) {
      i++;
      const nombre = nombreLocal(u);
      const destino = path.join(MEDIA, nombre);
      if (fs.existsSync(destino)) { mapa[u] = '/media/' + nombre; continue; }
      try {
        await descargar(u, destino);
        mapa[u] = '/media/' + nombre;
        console.log(`[${i}/${urls.length}] ${nombre}`);
        await dormir(150);
      } catch (e) {
        fallidas.push([u, String(e.message || e)]);
        console.log(`[${i}/${urls.length}] FALLÓ ${u}: ${e.message || e}`);
      }
    }
    fs.writeFileSync(MAPA, JSON.stringify(mapa, null, 1));
  }
  let cambios = 0;
  for (const f of archivosData()) {
    const p = path.join(DATA, f);
    const texto = fs.readFileSync(p, 'utf8');
    let nuevo = texto;
    for (const [u, local] of Object.entries(mapa)) {
      if (nuevo.includes(u)) nuevo = nuevo.split(u).join(local);
      const ue = u.replace(/\//g, '\\/');
      if (nuevo.includes(ue)) nuevo = nuevo.split(ue).join(local.replace(/\//g, '\\/'));
    }
    if (nuevo !== texto) { fs.writeFileSync(p, nuevo); cambios++; }
  }
  console.log(`mapa: ${Object.keys(mapa).length} imágenes · JSON reescritos: ${cambios} · fallidas: ${fallidas.length}`);
  if (fallidas.length) {
    fs.mkdirSync(path.join(RAIZ, 'export'), { recursive: true });
    fs.writeFileSync(path.join(RAIZ, 'export', 'imagenes-fallidas.txt'), fallidas.map(([u, e]) => `${u}\t${e}`).join('\n'));
    console.log('lista de fallidas en export/imagenes-fallidas.txt');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
