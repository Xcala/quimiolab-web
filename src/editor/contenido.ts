/**
 * Contenido publicado desde el editor: lectura pública (REST de Firestore, sin SDK),
 * caché en el navegador y aplicación sobre los bloques marcados en el HTML.
 *
 * Se carga en TODAS las páginas marcadas como editables (es pequeño: no trae Firebase).
 * El HTML ya trae horneado lo publicado al momento del último deploy; esto solo cubre
 * lo publicado después, para que el cliente vea sus cambios sin esperar un deploy.
 */
import { firebaseConfig, COLECCION, CACHE_MIN } from './config';

export type Doc = { content?: string | null; href?: string | null; alt?: string | null; pos?: string | null; sections?: string | null; page?: string };
export type Contenido = Record<string, Doc>;
export type Seccion = { key: string; hidden?: boolean };

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
  if (d.content && img.getAttribute('src') !== d.content) { img.removeAttribute('srcset'); img.src = d.content; }
  if (typeof d.alt === 'string') img.alt = d.alt;
  if (d.pos) img.style.objectPosition = d.pos; else if (d.pos === null) img.style.objectPosition = '';
}
export function aplicarEnlace(a: HTMLAnchorElement, href: string) {
  if (a.getAttribute('href') === href) return;
  a.setAttribute('href', href);
  if (esExterno(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } else { a.removeAttribute('target'); }
}

/** Orden y visibilidad de secciones: reconcilia lo guardado con lo que hay en el código. */
export function reconciliar(guardado: Seccion[] | null, keys: string[]): Seccion[] {
  if (!guardado) return keys.map((key) => ({ key }));
  const validas = guardado.filter((s) => keys.includes(s.key));
  keys.forEach((k, i) => { if (!validas.some((s) => s.key === k)) validas.splice(Math.min(i, validas.length), 0, { key: k }); });
  return validas;
}
export function aplicarSecciones(main: HTMLElement, secciones: Seccion[], modoEdicion = false) {
  const nodos = new Map<string, HTMLElement>();
  main.querySelectorAll<HTMLElement>('[data-ed-sec]').forEach((s) => nodos.set(s.dataset.edSec!, s));
  let anterior: HTMLElement | null = null;
  for (const s of secciones) {
    const n = nodos.get(s.key); if (!n) continue;
    if (modoEdicion) { n.hidden = false; n.classList.toggle('ql-ed-oculta', !!s.hidden); } else n.hidden = !!s.hidden;
    const esperado = anterior ? anterior.nextElementSibling : main.firstElementChild;
    // la sección debe ir justo después de la anterior (saltando nodos que no son secciones editables)
    if (anterior) { if (anterior.nextElementSibling !== n) anterior.after(n); }
    else if (esperado !== n && n.previousElementSibling && nodos.has((n.previousElementSibling as HTMLElement).dataset.edSec || '')) main.prepend(n);
    anterior = n;
  }
}

/** Aplica un conjunto de documentos a la página actual. */
export function aplicar(main: HTMLElement, pagina: string, docs: Contenido, modoEdicion = false) {
  for (const [id, d] of Object.entries(docs)) {
    if (id.startsWith('layout__')) continue;
    main.querySelectorAll<HTMLElement>(`[data-ed="${id}"]`).forEach((el) => { if (typeof d.content === 'string' && d.content) aplicarTexto(el, d.content); });
    main.querySelectorAll<HTMLImageElement>(`[data-ed-img="${id}"]`).forEach((img) => aplicarImagen(img, d));
    main.querySelectorAll<HTMLAnchorElement>(`[data-ed-link="${id}"]`).forEach((a) => { if (d.href) aplicarEnlace(a, d.href); });
  }
  const layout = docs[`layout__${pagina}`];
  const keys = Array.from(main.querySelectorAll<HTMLElement>('[data-ed-sec]')).map((s) => s.dataset.edSec!);
  if (layout?.sections && keys.length) {
    try { aplicarSecciones(main, reconciliar(JSON.parse(layout.sections), keys), modoEdicion); } catch { /* JSON roto: se ignora */ }
  }
}
