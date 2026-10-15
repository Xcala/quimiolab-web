// Auditoría SEO de dist/: título, meta descripción y Open Graph de cada página indexable.
//   node scripts/auditar_meta.mjs [salida.csv]
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..'); const dist = join(raiz, 'dist');
const paginas = []; const recorrer = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) recorrer(p); else if (f === 'index.html') paginas.push(p); } }; recorrer(dist);
const meta = (h, re) => { const m = h.match(re); return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : ''; };
const filas = []; const problemas = {}; const titulos = new Map(); const descs = new Map();
const marcar = (tipo, ruta) => (problemas[tipo] ||= []).push(ruta);
for (const archivo of paginas) {
  const h = readFileSync(archivo, 'utf8'); const ruta = '/' + archivo.slice(dist.length + 1).split('\\').join('/').replace(/index\.html$/, '');
  if (/name="robots" content="noindex/.test(h)) continue;
  const t = meta(h, /<title>([^<]*)<\/title>/), d = meta(h, /<meta name="description" content="([^"]*)"/);
  const ot = meta(h, /property="og:title" content="([^"]*)"/), od = meta(h, /property="og:description" content="([^"]*)"/), oi = meta(h, /property="og:image" content="([^"]*)"/), ou = meta(h, /property="og:url" content="([^"]*)"/);
  if (!t) marcar('sin título', ruta); else if (t.length > 65) marcar('título > 65 caracteres', ruta); else if (t.length < 20) marcar('título < 20 caracteres', ruta);
  if (!d) marcar('sin descripción', ruta); else if (d.length > 165) marcar('descripción > 165', ruta); else if (d.length < 70) marcar('descripción < 70', ruta);
  if (!ot || !od || !oi || !ou) marcar('Open Graph incompleto', ruta);
  if (oi) { const local = oi.replace(/^https?:\/\/[^/]+/, ''); if (!existsSync(join(raiz, 'public', decodeURI(local))) && !existsSync(join(dist, decodeURI(local)))) marcar('og:image no existe', ruta); }
  const canon = meta(h, /rel="canonical" href="([^"]*)"/).replace(/^https?:\/\/[^/]+/, '');
  if (!canon || canon === ruta) { titulos.set(t, [...(titulos.get(t) || []), ruta]); descs.set(d, [...(descs.get(d) || []), ruta]); } // las copias con canonical a otra URL no cuentan
  filas.push([ruta, t, t.length, d, d.length, oi]);
}
for (const [t, rs] of titulos) if (t && rs.length > 1) rs.forEach((r) => marcar('título duplicado', r));
for (const [d, rs] of descs) if (d && rs.length > 1) rs.forEach((r) => marcar('descripción duplicada', r));
console.log(`${filas.length} páginas indexables`);
for (const [k, v] of Object.entries(problemas)) console.log(`- ${k}: ${v.length}  ej. ${v.slice(0, 4).join('  ')}`);
if (process.argv[2]) writeFileSync(process.argv[2], 'ruta,titulo,largo_titulo,descripcion,largo_desc,og_image\n' + filas.map((f) => f.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n');
