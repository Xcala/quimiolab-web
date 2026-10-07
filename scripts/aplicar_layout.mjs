// Post-build: aplica orden y secciones ocultas (layout__<página>) al HTML de dist,
// para que el visitante y Google vean lo mismo sin esperar al JavaScript.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const contenido = JSON.parse(readFileSync(join(raiz, 'src', 'data', 'contenido.json'), 'utf8'));
const rutas = { home: 'index.html', nosotros: 'nosotros/index.html', contactenos: 'contactenos/index.html' };
let n = 0;
for (const [pagina, ruta] of Object.entries(rutas)) {
  const layout = contenido[`layout__${pagina}`]?.sections; if (!layout) continue;
  const archivo = join(raiz, 'dist', ruta); if (!existsSync(archivo)) continue;
  let secciones; try { secciones = JSON.parse(layout); } catch { continue; }
  let html = readFileSync(archivo, 'utf8');
  const m = html.match(/<main[^>]*data-ed-page[^>]*>([\s\S]*?)<\/main>/); if (!m) continue;
  const cuerpo = m[1];
  // bloques: cada <section … data-ed-sec="k" …>…</section> de primer nivel (sin secciones anidadas en estas páginas)
  const re = /<section\b[^>]*data-ed-sec="([^"]+)"[^>]*>[\s\S]*?<\/section>/g;
  const bloques = new Map(); let x; while ((x = re.exec(cuerpo))) bloques.set(x[1], { html: x[0], idx: x.index });
  if (!bloques.size) continue;
  const keys = [...bloques.keys()];
  const validas = secciones.filter((s) => keys.includes(s.key));
  keys.forEach((k, i) => { if (!validas.some((s) => s.key === k)) validas.splice(Math.min(i, validas.length), 0, { key: k }); });
  // reemplaza cada bloque original por el que corresponde en el nuevo orden
  const orden = validas.map((s) => { let h = bloques.get(s.key).html; if (s.hidden) h = h.replace(/^<section\b/, '<section hidden'); return h; });
  let i = 0; const nuevo = cuerpo.replace(re, () => orden[i++]);
  html = html.replace(cuerpo, nuevo); writeFileSync(archivo, html); n++;
}
console.log(`layout: ${n} página(s) con orden/ocultas aplicado`);
