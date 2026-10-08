// Post-build: aplica el layout publicado desde el editor (layout__<página>) al HTML de dist:
// orden, secciones ocultas, fondo/patrón elegidos y secciones agregadas desde plantillas,
// para que el visitante y Google vean lo mismo sin esperar al JavaScript.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconciliar, admiteFondo, clasesSeccion, htmlPatron, htmlPlantilla } from '../src/editor/secciones.mjs';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const contenido = JSON.parse(readFileSync(join(raiz, 'src', 'data', 'contenido.json'), 'utf8'));
const rutas = { home: 'index.html', nosotros: 'nosotros/index.html', contactenos: 'contactenos/index.html' };
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rePatron = /<span class="patron[ "][^>]*><\/span>/g;

/** Fondo/patrón sobre el HTML de una sección del código; guarda el original para el editor. */
function conFondo(html, s) {
  const apertura = html.match(/^<section\b[^>]*>/)[0];
  const orig = (apertura.match(/\sclass="([^"]*)"/) || [, ''])[1];
  if (!(s.bg || s.patron) || !admiteFondo(orig.split(/\s+/))) return html;
  const resto = html.slice(apertura.length);
  const patronOrig = (resto.match(rePatron) || []).join('');
  const clases = clasesSeccion(orig.split(/\s+/).filter(Boolean), s).join(' ');
  let nueva = apertura.includes(' class="') ? apertura.replace(/\sclass="[^"]*"/, ` class="${clases}"`) : apertura.replace(/^<section/, `<section class="${clases}"`);
  nueva = nueva.replace(/>$/, ` data-ed-orig-clases="${attr(orig)}" data-ed-orig-patron="${attr(patronOrig)}">`);
  const cuerpo = s.patron ? htmlPatron(s.patron) + resto.replace(rePatron, '') : resto;
  return nueva + cuerpo;
}

let n = 0;
for (const [pagina, ruta] of Object.entries(rutas)) {
  const layout = contenido[`layout__${pagina}`]?.sections; if (!layout) continue;
  const archivo = join(raiz, 'dist', ruta); if (!existsSync(archivo)) continue;
  let guardado; try { guardado = JSON.parse(layout); } catch { continue; }
  let html = readFileSync(archivo, 'utf8');
  const m = html.match(/<main[^>]*data-ed-page[^>]*>([\s\S]*?)<\/main>/); if (!m) continue;
  const cuerpo = m[1];
  // secciones de primer nivel (no hay <section> anidadas en estas páginas)
  const re = /<section\b[^>]*data-ed-sec="([^"]+)"[^>]*>[\s\S]*?<\/section>/g;
  const encontradas = []; let x; while ((x = re.exec(cuerpo))) encontradas.push({ key: x[1], ini: x.index, fin: x.index + x[0].length, seccion: x[0] });
  if (!encontradas.length) continue;
  // cada sección arrastra lo que la sigue hasta la próxima (p. ej. la franja de marcas); lo de después de la última se queda al final
  const grupos = new Map(encontradas.map((e, i) => [e.key, { seccion: e.seccion, extra: i < encontradas.length - 1 ? cuerpo.slice(e.fin, encontradas[i + 1].ini) : '' }]));
  const prefijo = cuerpo.slice(0, encontradas[0].ini), sufijo = cuerpo.slice(encontradas.at(-1).fin);
  const secciones = reconciliar(guardado, encontradas.map((e) => e.key));
  const partes = secciones.map((s) => {
    if (s.tpl) return htmlPlantilla(pagina, s, contenido);
    const g = grupos.get(s.key); if (!g) return '';
    let sec = conFondo(g.seccion, s);
    if (s.hidden) sec = sec.replace(/^<section\b/, '<section hidden');
    return sec + g.extra;
  });
  html = html.replace(cuerpo, () => prefijo + partes.join('') + sufijo); writeFileSync(archivo, html); n++;
}
console.log(`layout: ${n} página(s) con orden, fondos y secciones agregadas aplicados`);
