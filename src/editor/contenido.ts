/**
 * Contenido publicado desde el editor: lectura pública (REST de Firestore, sin SDK),
 * caché en el navegador y aplicación sobre los bloques marcados en el HTML.
 *
 * Se carga en TODAS las páginas marcadas como editables (es pequeño: no trae Firebase).
 * El HTML ya trae horneado lo publicado al momento del último deploy; esto solo cubre
 * lo publicado después, para que el cliente vea sus cambios sin esperar un deploy.
 */
import { firebaseConfig, COLECCION, CACHE_MIN } from './config';
import { reconciliar as reconciliarSecciones, admiteFondo, clasesSeccion, htmlPatron, htmlPlantilla } from './secciones.mjs';

export type Doc = { content?: string | null; href?: string | null; alt?: string | null; pos?: string | null; sections?: string | null; page?: string };
export type Contenido = Record<string, Doc>;
export type Seccion = { key: string; hidden?: boolean; bg?: string; patron?: string; tpl?: string };

const LS = 'ql_pc_v2:';

/* ---------- caché ---------- */
export function leerCache(pagina: string): Contenido | null {
  try {
    const raw = localStorage.getItem(LS + pagina);
    if (!raw) return null;
    const { t, d } = JSON.parse(raw);
    return Date.now() - t < CACHE_MIN * 60_000 ? d : null;
  } catch { return null; }
}
export function guardarCache(pagina: string, d: Contenido) {
  try { localStorage.setItem(LS + pagina, JSON.stringify({ t: Date.now(), d })); }
  catch {
    // sin espacio: guarda sin las fotos subidas (data URL), que son lo pesado
    try {
      const ligero: Contenido = {};
      for (const [k, v] of Object.entries(d)) ligero[k] = v.content?.startsWith('data:') ? { ...v, content: undefined } : v;
      localStorage.setItem(LS + pagina, JSON.stringify({ t: Date.now(), d: ligero }));
    } catch { /* bloqueado */ }
  }
}
export function limpiarCache() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(LS)).forEach((k) => localStorage.removeItem(k)); } catch { /* nada */ }
}

/* ---------- borrador (cambios sin publicar, guardados en este equipo) ---------- */
export type Borrador = { t: number; p: [string, string][]; s: Seccion[] };
const LS_BORRADOR = 'ql_ed_borrador_v1:';
export function leerBorrador(pagina: string): Borrador | null {
  try { const b = JSON.parse(localStorage.getItem(LS_BORRADOR + pagina) || 'null'); return b && Array.isArray(b.p) && Array.isArray(b.s) ? b : null; } catch { return null; }
}
/** Devuelve false si no cupo completo (fotos muy pesadas): se guarda sin ellas. */
export function guardarBorrador(pagina: string, b: Borrador): boolean {
  try { localStorage.setItem(LS_BORRADOR + pagina, JSON.stringify(b)); return true; }
  catch {
    try { localStorage.setItem(LS_BORRADOR + pagina, JSON.stringify({ ...b, p: b.p.filter(([, v]) => !v.startsWith('data:')) })); } catch { /* bloqueado */ }
    return false;
  }
}
export function borrarBorrador(pagina: string) { try { localStorage.removeItem(LS_BORRADOR + pagina); } catch { /* nada */ } }
/** Lo publicado + los cambios pendientes (id#campo → valor; '' = volver al original). */
export function conCambios(publicado: Contenido, cambios: Iterable<[string, string]>, secciones?: Seccion[], pagina?: string): Contenido {
  const d: Contenido = {};
  for (const [id, v] of Object.entries(publicado)) d[id] = { ...v };
  for (const [k, v] of cambios) { const [id, campo] = k.split('#'); (d[id] ||= {} as Doc)[campo as keyof Doc] = (v === '' ? null : v) as any; }
  if (secciones && pagina) d[`layout__${pagina}`] = { ...(d[`layout__${pagina}`] || {}), sections: JSON.stringify(secciones) };
  return d;
}

/* ---------- lectura REST (lectura pública en las reglas) ---------- */
const base = () => `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const key = () => (firebaseConfig.apiKey ? `?key=${firebaseConfig.apiKey}` : '');

function valor(v: any): any {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return decodificar(v.mapValue.fields);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor);
  return undefined;
}
export function decodificar(fields: Record<string, any> | undefined): Doc {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = valor(v);
  return out;
}

/** Todos los bloques de una página (los documentos llevan el campo `page`). */
export async function pedirPagina(pagina: string): Promise<Contenido> {
  const res = await fetch(`${base()}:runQuery${key()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: COLECCION }], where: { fieldFilter: { field: { fieldPath: 'page' }, op: 'EQUAL', value: { stringValue: pagina } } }, limit: 500 } }),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  const filas = await res.json();
  const out: Contenido = {};
  for (const f of filas) {
    if (!f.document) continue;
    const id = String(f.document.name).split('/').pop()!;
    out[id] = decodificar(f.document.fields);
  }
  return out;
}

/* ---------- aplicar al DOM ---------- */
const esExterno = (h: string) => /^(https?:)?\/\//.test(h) && !h.startsWith(location.origin);

export function aplicarTexto(el: HTMLElement, html: string) { if (el.innerHTML !== html) el.innerHTML = html; }
export function aplicarImagen(img: HTMLImageElement, d: Doc) {
  const src = d.content || (d.content === null ? img.dataset.edOrig : undefined);
  if (src && img.getAttribute('src') !== src) { img.removeAttribute('srcset'); img.src = src; }
  if (typeof d.alt === 'string') img.alt = d.alt; else if (d.alt === null) img.alt = img.dataset.edOrigAlt ?? img.alt;
  if (d.pos) img.style.objectPosition = d.pos; else if (d.pos === null) img.style.objectPosition = '';
}
export function aplicarEnlace(a: HTMLAnchorElement, href: string) {
  if (a.getAttribute('href') === href) return;
  a.setAttribute('href', href);
  if (esExterno(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } else { a.removeAttribute('target'); }
}

/** Orden, visibilidad, fondos y secciones agregadas: reconcilia lo guardado con lo que hay en el código. */
export const reconciliar = (guardado: Seccion[] | null, keys: string[]): Seccion[] => reconciliarSecciones(guardado, keys);

/** Claves de las secciones que vienen del código (las agregadas llevan data-ed-tpl). */
export const keysCodigo = (main: HTMLElement) => Array.from(main.querySelectorAll<HTMLElement>('[data-ed-sec]:not([data-ed-tpl])')).map((s) => s.dataset.edSec!);

/** Fondo y patrón elegidos; el original del código se recuerda en data-ed-orig-* (el build también lo escribe). */
export function aplicarFondo(n: HTMLElement, s: Seccion) {
  const base = n.dataset.edTpl ? ['seccion', 'pl'] : (n.dataset.edOrigClases ??= n.className).split(/\s+/).filter(Boolean);
  if (!admiteFondo(base)) return;
  const patrones = () => Array.from(n.children).filter((c) => c.classList.contains('patron'));
  if (!n.dataset.edTpl && n.dataset.edOrigPatron === undefined) n.dataset.edOrigPatron = patrones().map((p) => p.outerHTML).join('');
  const extra = Array.from(n.classList).filter((c) => c.startsWith('ql-ed-'));
  n.className = [...clasesSeccion(base, s), ...extra].join(' ');
  patrones().forEach((p) => p.remove());
  const html = s.patron ? htmlPatron(s.patron) : n.dataset.edTpl ? '' : n.dataset.edOrigPatron || '';
  if (html) n.insertAdjacentHTML('afterbegin', html);
}

/** Bloque que se mueve con cada sección: la sección y lo que la sigue hasta la próxima (p. ej. la franja de marcas). */
function grupo(n: HTMLElement): Element[] {
  const out: Element[] = [n]; let x = n.nextElementSibling;
  while (x && !(x as HTMLElement).dataset?.edSec) { out.push(x); x = x.nextElementSibling; }
  return x ? out : [n]; // lo que va después de la última sección se queda al final
}

export function aplicarSecciones(main: HTMLElement, secciones: Seccion[], modoEdicion = false, pagina = main.dataset.edPage || '', docs: Contenido = {}) {
  const nodos = new Map<string, HTMLElement>();
  main.querySelectorAll<HTMLElement>('[data-ed-sec]').forEach((s) => nodos.set(s.dataset.edSec!, s));
  const enDom = Array.from(nodos.values());
  if (!enDom.length) return;
  // secciones agregadas borradas → fuera; agregadas que aún no están en el HTML → se crean
  for (const [k, n] of nodos) if (n.dataset.edTpl && !secciones.some((s) => s.key === k)) { n.remove(); nodos.delete(k); }
  for (const s of secciones) {
    if (!s.tpl || nodos.has(s.key)) continue;
    const t = document.createElement('template'); t.innerHTML = htmlPlantilla(pagina, s, docs);
    const n = t.content.firstElementChild as HTMLElement | null; if (n) nodos.set(s.key, n);
  }
  const primero = enDom.find((n) => n.isConnected)!;
  const ancla = document.createComment('ed'); primero.before(ancla);
  const grupos = secciones.map((s) => nodos.get(s.key)).filter(Boolean).map((n) => (n!.isConnected ? grupo(n!) : [n!]));
  let ultimo: ChildNode = ancla;
  for (const g of grupos) for (const el of g) { if (ultimo.nextSibling !== el) ultimo.after(el); ultimo = el; }
  ancla.remove();
  for (const s of secciones) {
    const n = nodos.get(s.key); if (!n) continue;
    if (s.bg || s.patron || n.dataset.edOrigClases !== undefined || n.dataset.edTpl) aplicarFondo(n, s);
    if (modoEdicion) { n.hidden = false; n.classList.toggle('ql-ed-oculta', !!s.hidden); } else n.hidden = !!s.hidden;
  }
}

/** Aplica un conjunto de documentos a la página actual. */
export function aplicar(main: HTMLElement, pagina: string, docs: Contenido, modoEdicion = false) {
  // primero las secciones (crea las agregadas), luego los bloques, que también llenan las nuevas
  const layout = docs[`layout__${pagina}`];
  if (layout?.sections) {
    try { aplicarSecciones(main, reconciliar(JSON.parse(layout.sections), keysCodigo(main)), modoEdicion, pagina, docs); } catch { /* JSON roto: se ignora */ }
  }
  for (const [id, d] of Object.entries(docs)) {
    if (id.startsWith('layout__')) continue;
    main.querySelectorAll<HTMLElement>(`[data-ed="${id}"]`).forEach((el) => {
      if (typeof d.content === 'string' && d.content) aplicarTexto(el, d.content);
      else if (d.content === null && el.dataset.edDef !== undefined) aplicarTexto(el, el.dataset.edDef); // volvió al original
    });
    main.querySelectorAll<HTMLImageElement>(`[data-ed-img="${id}"]`).forEach((img) => aplicarImagen(img, d));
    main.querySelectorAll<HTMLAnchorElement>(`[data-ed-link="${id}"]`).forEach((a) => { if (d.href) aplicarEnlace(a, d.href); });
  }
}
