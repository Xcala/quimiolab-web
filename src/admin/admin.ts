/**
 * Panel de contenido (/admin/): blog, productos y equipos, marcas y líneas.
 *
 * Datos: la base es el export del WordPress (/admin/datos.json). En Firestore solo vive lo que cambia:
 *  - cms/{tipo__slug}            lo publicado: { tipo, slug, datos } con SOLO los campos distintos a la base
 *                                (+ _nuevo para elementos creados aquí, _oculto para despublicar). Lectura pública.
 *  - cms_borradores/{tipo__slug} lo que alguien está editando (se guarda solo, cualquier equipo lo retoma).
 *  - cms_versiones/{tipo__slug__t} cada publicación, para el historial.
 *  - cms_media/{id}              fotos (WebP ≤ 750 KB como data URL); el build las vuelve archivos (/media/cms/).
 * El sitio toma lo publicado en el siguiente build (scripts/fetch_cms.mjs + src/lib/data.ts).
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, getDoc, getDocs, collection, query, where, serverTimestamp, type Firestore } from 'firebase/firestore';
import './admin.css';
import { firebaseConfig, ADMINS, FOTO_ANCHO_MAX, FOTO_BYTES_MAX } from '../editor/config';

/* ================= tipos de contenido ================= */
type Valor = any;
type Item = Record<string, Valor> & { slug: string };
type Campo = { k: string; t: 'texto' | 'area' | 'fecha' | 'imagen' | 'rico' | 'check' | 'marca' | 'lineas' | 'color'; label: string; ayuda?: string; max?: number; req?: boolean };
type TipoId = 'posts' | 'catalogo' | 'marcas' | 'lineas';
type Tipo = { id: TipoId; nombre: string; singular: string; titulo: string; campos: Campo[]; url: (s: string) => string; crear: boolean; ocultar: boolean; sub: (x: Item) => string };

const TIPOS: Record<TipoId, Tipo> = {
  posts: {
    id: 'posts', nombre: 'Blog', singular: 'artículo', titulo: 'titulo', crear: true, ocultar: true, url: (s) => `/blog/${s}/`,
    sub: (x) => (x.fecha ? new Date(x.fecha).toLocaleDateString('es-CO', { dateStyle: 'medium' }) : ''),
    campos: [
      { k: 'titulo', t: 'texto', label: 'Título', req: true, max: 120, ayuda: 'Claro y con la palabra que la gente buscaría en Google.' },
      { k: 'fecha', t: 'fecha', label: 'Fecha de publicación' },
      { k: 'resumen', t: 'area', label: 'Resumen', max: 300, ayuda: 'Aparece en el listado del blog y en los resultados de Google (máx. 300 caracteres).' },
      { k: 'imagen', t: 'imagen', label: 'Foto de portada' },
      { k: 'contenido_html', t: 'rico', label: 'Contenido del artículo' },
    ],
  },
  catalogo: {
    id: 'catalogo', nombre: 'Productos y equipos', singular: 'producto', titulo: 'nombre', crear: true, ocultar: true, url: (s) => `/producto/${s}/`,
    sub: (x) => `${x.es_equipo ? 'Equipo' : 'Producto'} · ${datos.marcas.find((m) => m.slug === x.marca)?.nombre ?? (x.marca || 'Sin marca')}`,
    campos: [
      { k: 'nombre', t: 'texto', label: 'Nombre', req: true, max: 120 },
      { k: 'es_equipo', t: 'check', label: 'Es un equipo (analizador)', ayuda: 'Los equipos salen en «Equipos» y tienen botón de demostración.' },
      { k: 'marca', t: 'marca', label: 'Marca', req: true },
      { k: 'lineas', t: 'lineas', label: 'Líneas de solución', ayuda: 'En qué líneas aparece. Puede ser más de una.' },
      { k: 'imagen', t: 'imagen', label: 'Foto del producto', ayuda: 'Ideal: fondo blanco, cuadrada.' },
      { k: 'resumen_html', t: 'rico', label: 'Descripción corta', ayuda: 'Lo primero que se lee en la ficha y en Google. Dos o tres frases.' },
      { k: 'descripcion_html', t: 'rico', label: 'Descripción completa', ayuda: 'Características, especificaciones, presentaciones…' },
    ],
  },
  marcas: {
    id: 'marcas', nombre: 'Marcas', singular: 'marca', titulo: 'nombre', crear: true, ocultar: true, url: (s) => `/marcas/${s}/`,
    sub: (x) => x.resumen ? String(x.resumen).slice(0, 80) + (String(x.resumen).length > 80 ? '…' : '') : '',
    campos: [
      { k: 'nombre', t: 'texto', label: 'Nombre de la marca', req: true, max: 80 },
      { k: 'color', t: 'color', label: 'Color de la marca', ayuda: 'El color del aliado según su manual. Se usa en su página y en sus fichas.' },
      { k: 'resumen', t: 'area', label: 'Resumen', max: 300, ayuda: 'Una o dos frases: aparece en el listado de marcas y en Google.' },
      { k: 'intro_html', t: 'rico', label: 'Presentación de la marca' },
    ],
  },
  lineas: {
    id: 'lineas', nombre: 'Líneas', singular: 'línea', titulo: 'nombre', crear: false, ocultar: false, url: (s) => `/soluciones/${s}/`,
    sub: (x) => x.descripcion ? String(x.descripcion).slice(0, 80) + '…' : '',
    campos: [
      { k: 'nombre', t: 'texto', label: 'Nombre', req: true, max: 60 },
      { k: 'descripcion', t: 'area', label: 'Descripción para Google', max: 300 },
      { k: 'intro_html', t: 'rico', label: 'Introducción de la línea' },
    ],
  },
};

/* ================= estado ================= */
type Datos = { catalogo: Item[]; posts: Item[]; marcas: Item[]; lineas: Item[] };
type Doc = { datos: Record<string, Valor>; at?: number; by?: string };
let datos: Datos = { catalogo: [], posts: [], marcas: [], lineas: [] };
const pub: Record<TipoId, Record<string, Doc>> = { posts: {}, catalogo: {}, marcas: {}, lineas: {} };
const borr: Record<TipoId, Record<string, Doc>> = { posts: {}, catalogo: {}, marcas: {}, lineas: {} };
const fotos = new Map<string, string>(); // cms:<id> → data URL (para mostrar en el panel)

/** Acceso a datos: Firestore, o memoria en el modo demo. */
type Almacen = {
  todos(col: string): Promise<{ id: string; d: Record<string, Valor> }[]>;
  donde(col: string, campos: Record<string, string>): Promise<{ id: string; d: Record<string, Valor> }[]>;
  uno(col: string, id: string): Promise<Record<string, Valor> | null>;
  poner(col: string, id: string, d: Record<string, Valor>): Promise<void>;
  quitar(col: string, id: string): Promise<void>;
};
const firestore = (db: Firestore): Almacen => ({
  async todos(col) { return (await getDocs(collection(db, col))).docs.map((x) => ({ id: x.id, d: x.data() })); },
  async donde(col, campos) { return (await getDocs(query(collection(db, col), ...Object.entries(campos).map(([k, v]) => where(k, '==', v))))).docs.map((x) => ({ id: x.id, d: x.data() })); },
  async uno(col, id) { const s = await getDoc(doc(db, col, id)); return s.exists() ? s.data() : null; },
  async poner(col, id, d) { await setDoc(doc(db, col, id), { ...d, at: serverTimestamp() }); },
  async quitar(col, id) { await deleteDoc(doc(db, col, id)); },
});
const memoria = (): Almacen => {
  const m = new Map<string, Map<string, Record<string, Valor>>>();
  const c = (col: string) => { if (!m.has(col)) m.set(col, new Map()); return m.get(col)!; };
  return {
    async todos(col) { return [...c(col)].map(([id, d]) => ({ id, d })); },
    async donde(col, campos) { return [...c(col)].filter(([, d]) => Object.entries(campos).every(([k, v]) => d[k] === v)).map(([id, d]) => ({ id, d })); },
    async uno(col, id) { return c(col).get(id) ?? null; },
    async poner(col, id, d) { c(col).set(id, { ...d, at: { toMillis: () => Date.now() } }); },
    async quitar(col, id) { c(col).delete(id); },
  };
};

/* ================= utilidades ================= */
const h = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const boton = (cls: string, html: string, titulo?: string) => { const b = h('button', cls, html) as HTMLButtonElement; b.type = 'button'; if (titulo) { b.title = titulo; b.setAttribute('aria-label', titulo); } return b; };
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const igual = (a: Valor, b: Valor) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const idDoc = (t: TipoId, slug: string) => `${t}__${slug}`;
const textoDe = (html: string) => { const d = h('div'); d.innerHTML = html || ''; return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'sin-titulo';
const millis = (x: Valor) => (typeof x?.toMillis === 'function' ? x.toMillis() : typeof x === 'number' ? x : 0);
const cuando = (t?: number) => (t ? new Date(t).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const ic = (d: string) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  atras: ic('<path d="m15 18-6-6 6-6"/>'), mas: ic('<path d="M12 5v14M5 12h14"/>'), buscar: ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  reloj: ic('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'), ojo: ic('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  externo: ic('<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'), check: ic('<path d="m5 12 5 5L20 7"/>'), x: ic('<path d="M18 6 6 18M6 6l12 12"/>'),
  negrita: ic('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'), cursiva: ic('<path d="M19 4h-9M14 20H5M15 4 9 20"/>'),
  lista: ic('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'),
  numerada: ic('<path d="M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'), enlace: ic('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>'),
  limpiar: ic('<path d="M4 7V4h16v3M9 20h6M12 4v16"/><path d="m3 3 18 18"/>'), foto: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
  lapiz: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
};

/** HTML del editor enriquecido → solo etiquetas que el sitio sabe mostrar (sin estilos pegados de Word, etc.). */
const PERMITIDAS: Record<string, string[]> = { P: [], H2: [], H3: [], H4: [], STRONG: [], EM: [], A: ['href'], UL: [], OL: [], LI: [], BR: [], BLOCKQUOTE: [], IMG: ['src', 'alt', 'width', 'height'], TABLE: [], THEAD: [], TBODY: [], TR: [], TH: [], TD: [], FIGURE: [], FIGCAPTION: [] };
function sanear(html: string): string {
  const raiz = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild!;
  const limpiar = (n: Element) => {
    for (const hijo of Array.from(n.children)) {
      let el = hijo;
      if (el.tagName === 'B' || el.tagName === 'I' || el.tagName === 'H1') { // equivalencias
        const nuevo = document.createElement(el.tagName === 'B' ? 'strong' : el.tagName === 'I' ? 'em' : 'h2');
        nuevo.append(...Array.from(el.childNodes)); el.replaceWith(nuevo); el = nuevo;
      }
      const ok = PERMITIDAS[el.tagName];
      if (!ok) { limpiar(el); el.replaceWith(...Array.from(el.childNodes)); continue; }
      for (const a of Array.from(el.attributes)) if (!ok.includes(a.name)) el.removeAttribute(a.name);
      if (el.tagName === 'A') { const href = el.getAttribute('href') || ''; if (!/^(https?:|mailto:|tel:|\/)/.test(href)) el.removeAttribute('href'); else if (/^https?:/.test(href) && !href.includes('quimiolab.com')) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); } }
      limpiar(el);
    }
  };
  limpiar(raiz);
  return raiz.innerHTML.replace(/<p>(\s|&nbsp;|<br>)*<\/p>/g, '').trim();
}

/* ================= arranque y acceso ================= */
let alm: Almacen; let usuario = '';
let raiz: HTMLElement;
const toast = (() => { let c: HTMLElement | null = null; return (msg: string, error = false) => { if (!c) { c = h('div', 'adm-toasts'); c.setAttribute('role', 'status'); document.body.append(c); } const t = h('div', 'adm-toast' + (error ? ' error' : ''), msg); c.append(t); setTimeout(() => t.classList.add('ver'), 10); setTimeout(() => { t.classList.remove('ver'); setTimeout(() => t.remove(), 300); }, error ? 6000 : 3500); }; })();

export async function iniciar(el: HTMLElement) {
  raiz = el;
  document.documentElement.classList.add('adm-on');
  const demo = import.meta.env.PUBLIC_ED_DEMO === '1';
  if (demo) { alm = memoria(); usuario = 'demo@braindy.co'; await cargar(); return; }
  if (!firebaseConfig.apiKey) { pantalla('Falta configurar Firebase', 'El panel usa el mismo <code>firebaseConfig</code> que el editor (src/editor/config.ts).'); return; }
  const app = initializeApp(firebaseConfig, 'admin');
  const auth = getAuth(app);
  alm = firestore(getFirestore(app));
  let listo = false;
  onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) { pantalla('Panel de contenido', 'Entra con tu cuenta de Google autorizada para editar el blog, los productos, las marcas y las líneas.', [{ texto: 'Entrar con Google', primario: true, fn: () => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => alert('No se pudo iniciar sesión: ' + (e?.message || e))) }]); return; }
    const correo = (user.email || '').toLowerCase();
    if (!ADMINS.map((a) => a.toLowerCase()).includes(correo)) { pantalla('Esta cuenta no puede editar', `Entraste como <b>${esc(correo)}</b>, que no está en la lista de personas autorizadas. Pide a Braindy que la agregue.`, [{ texto: 'Salir', fn: () => signOut(auth) }]); return; }
    if (listo) return; listo = true; usuario = correo;
    try { await cargar(); } catch (e) { console.error(e); pantalla('No se pudo cargar el contenido', 'Revisa tu conexión y vuelve a intentar.'); }
    (window as any).__salirAdmin = () => signOut(auth).then(() => location.reload());
  });
}

function pantalla(titulo: string, html: string, botones: { texto: string; fn: () => void; primario?: boolean }[] = []) {
  document.querySelector('.adm-arranque')?.remove();
  raiz.innerHTML = '';
  const t = h('div', 'adm-pantalla', `<div class="adm-tarjeta"><span class="adm-marca">Quimiolab · Panel</span><h2>${titulo}</h2><p>${html}</p></div>`);
  const fila = h('div', 'adm-fila'); botones.forEach((b) => { const x = boton('adm-btn' + (b.primario ? ' adm-btn-p' : ''), b.texto); x.addEventListener('click', b.fn); fila.append(x); });
  const volver = h('a', 'adm-btn', 'Ver el sitio'); volver.setAttribute('href', '/'); fila.append(volver);
  t.querySelector('.adm-tarjeta')!.append(fila); raiz.append(t);
}

async function cargar() {
  document.querySelector('.adm-arranque')?.remove();
  raiz.innerHTML = '<div class="adm-pantalla"><p>Cargando contenido…</p></div>';
  const [base, publicados, borradores] = await Promise.all([fetch('/admin/datos.json').then((r) => r.json()), alm.todos('cms'), alm.todos('cms_borradores')]);
  datos = base;
  for (const { d } of publicados) if (d.tipo in pub) pub[d.tipo as TipoId][d.slug] = { datos: d.datos || {}, at: millis(d.at), by: d.by };
  for (const { d } of borradores) if (d.tipo in borr) borr[d.tipo as TipoId][d.slug] = { datos: d.datos || {}, at: millis(d.at), by: d.by };
  montar();
}

/* ================= vistas ================= */
let cuerpo: HTMLElement;
function montar() {
  raiz.innerHTML = '';
  const app = h('div', 'adm');
  const cab = h('header', 'adm-cab');
  cab.innerHTML = `<a class="adm-logo" href="#/catalogo"><b>Quimiolab</b><span>Panel de contenido</span></a>`;
  const nav = h('nav', 'adm-nav'); nav.setAttribute('aria-label', 'Secciones');
  (Object.values(TIPOS)).forEach((t) => { const a = h('a', '', t.nombre); a.setAttribute('href', `#/${t.id}`); a.dataset.tipo = t.id; nav.append(a); });
  const der = h('div', 'adm-der');
  const paginas = h('a', 'adm-btn adm-btn-claro', `${I.lapiz}<span>Editar páginas</span>`); paginas.setAttribute('href', '/?edit'); paginas.title = 'Inicio, Nosotros y Contáctenos se editan sobre la página';
  const quien = h('span', 'adm-quien', esc(usuario));
  const salir = boton('adm-btn adm-btn-claro', 'Salir'); salir.addEventListener('click', () => (window as any).__salirAdmin?.() ?? (location.href = '/'));
  der.append(paginas, quien, salir);
  cab.append(nav, der);
  const aviso = h('div', 'adm-aviso', '<b>Cómo se publica:</b> lo que publiques aquí queda guardado al instante y aparece en el sitio con la siguiente actualización (la hace Braindy; pronto será automática).');
  cuerpo = h('main', 'adm-cuerpo');
  app.append(cab, aviso, cuerpo); raiz.append(app);
  addEventListener('hashchange', ruta); ruta();
}

let salirConCambios: (() => boolean) | null = null;
function ruta() {
  if (salirConCambios && !salirConCambios()) return;
  salirConCambios = null;
  const [, t = 'catalogo', slug] = location.hash.split('/');
  const tipo = (t in TIPOS ? t : 'catalogo') as TipoId;
  raiz.querySelectorAll<HTMLAnchorElement>('.adm-nav a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.tipo === tipo));
  window.scrollTo(0, 0);
  if (slug) editar(tipo, decodeURIComponent(slug)); else lista(tipo);
}

/** Valor actual = base + publicado + borrador. */
function actual(t: TipoId, slug: string): Item | null {
  const b = datos[t].find((x) => x.slug === slug);
  const p = pub[t][slug]?.datos, d = borr[t][slug]?.datos;
  if (!b && !p?._nuevo && !d?._nuevo) return null;
  return { ...(b || { slug }), ...(p || {}), ...(d || {}), slug };
}
function estados(t: TipoId, slug: string) {
  const p = pub[t][slug]?.datos, d = borr[t][slug]?.datos;
  return { borrador: !!d, nuevo: !!(d?._nuevo || p?._nuevo), oculto: !!((d ?? p)?._oculto), editado: !!p && Object.keys(p).some((k) => !k.startsWith('_')), sinPublicar: !!d?._nuevo && !p };
}
function todos(t: TipoId): Item[] {
  const slugs = new Set([...datos[t].map((x) => x.slug), ...Object.keys(pub[t]), ...Object.keys(borr[t])]);
  return [...slugs].map((s) => actual(t, s)).filter(Boolean) as Item[];
}
const urlFoto = (img: any) => { const src = img?.src || ''; return src.startsWith('cms:') ? fotos.get(src) || '' : src; };
async function cargarFoto(src: string) {
  if (!src.startsWith('cms:') || fotos.has(src)) return fotos.get(src) || src;
  const d = await alm.uno('cms_media', src.slice(4)); const data = d?.data || ''; fotos.set(src, data); return data;
}

/* ---------- lista ---------- */
function lista(t: TipoId) {
  const tipo = TIPOS[t];
  cuerpo.innerHTML = '';
  const cab = h('div', 'adm-titulo', `<h1>${tipo.nombre}</h1>`);
  if (tipo.crear) { const nuevo = boton('adm-btn adm-btn-p', `${I.mas}<span>Nuevo ${tipo.singular}</span>`); nuevo.addEventListener('click', () => (location.hash = `#/${t}/nuevo`)); cab.append(nuevo); }
  const filtros = h('div', 'adm-filtros');
  const busca = h('label', 'adm-busca', I.buscar); const q = h('input') as HTMLInputElement; q.type = 'search'; q.placeholder = `Buscar ${tipo.nombre.toLowerCase()}…`; q.setAttribute('aria-label', 'Buscar'); busca.append(q);
  const estado = h('select', 'adm-select') as HTMLSelectElement; estado.setAttribute('aria-label', 'Filtrar por estado');
  [['', 'Todos'], ['borrador', 'Con borrador sin publicar'], ['editado', 'Editados en el panel'], ['nuevo', 'Creados en el panel'], ['oculto', 'Ocultos']].forEach(([v, n]) => estado.append(new Option(n, v)));
  filtros.append(busca, estado);
  let marca: HTMLSelectElement | null = null, clase: HTMLSelectElement | null = null;
  if (t === 'catalogo') {
    clase = h('select', 'adm-select') as HTMLSelectElement; clase.setAttribute('aria-label', 'Productos o equipos');
    [['', 'Productos y equipos'], ['equipo', 'Solo equipos'], ['producto', 'Solo productos']].forEach(([v, n]) => clase!.append(new Option(n, v)));
    marca = h('select', 'adm-select') as HTMLSelectElement; marca.setAttribute('aria-label', 'Marca'); marca.append(new Option('Todas las marcas', ''));
    todos('marcas').sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach((m) => marca!.append(new Option(m.nombre, m.slug)));
    filtros.append(clase, marca);
  }
  const conteo = h('p', 'adm-conteo');
  const ul = h('ul', 'adm-lista');
  const mas = boton('adm-btn', 'Mostrar más');
  let limite = 60;
  const pintar = () => {
    const txt = normalizar(q.value);
    let items = todos(t).filter((x) => {
      const e = estados(t, x.slug);
      if (estado.value && !e[estado.value as keyof typeof e]) return false;
      if (clase?.value && (clase.value === 'equipo') !== !!x.es_equipo) return false;
      if (marca?.value && x.marca !== marca.value) return false;
      return !txt || normalizar(`${x[tipo.titulo]} ${x.slug} ${x.marca || ''}`).includes(txt);
    });
    if (t === 'posts') items.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    else items.sort((a, b) => Number(estados(t, b.slug).borrador) - Number(estados(t, a.slug).borrador) || String(a[tipo.titulo]).localeCompare(String(b[tipo.titulo])));
    conteo.textContent = `${items.length} ${items.length === 1 ? tipo.singular : tipo.nombre.toLowerCase()}`;
    ul.innerHTML = '';
    for (const x of items.slice(0, limite)) {
      const e = estados(t, x.slug);
      const li = h('li');
      const a = h('a', 'adm-fila-item'); a.setAttribute('href', `#/${t}/${encodeURIComponent(x.slug)}`);
      const src = urlFoto(x.imagen);
      const insignias = [e.borrador && '<i class="i-borrador">Borrador</i>', e.sinPublicar && '<i class="i-nuevo">Sin publicar</i>', !e.sinPublicar && e.nuevo && '<i class="i-nuevo">Nuevo</i>', e.editado && !e.nuevo && '<i class="i-editado">Editado</i>', e.oculto && '<i class="i-oculto">Oculto</i>'].filter(Boolean).join('');
      a.innerHTML = `${t === 'marcas' ? `<span class="adm-mini adm-color" style="background:${esc(x.color || '#0062B8')}"></span>` : t === 'lineas' ? '' : `<span class="adm-mini">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : I.foto}</span>`}<span class="adm-txt"><b>${esc(x[tipo.titulo] || '(sin título)')}</b><span>${esc(tipo.sub(x))}</span></span><span class="adm-insignias">${insignias}</span>`;
      if (x.imagen?.src?.startsWith('cms:') && !src) cargarFoto(x.imagen.src).then((d) => { const img = a.querySelector('.adm-mini'); if (img && d) img.innerHTML = `<img src="${d}" alt="">`; });
      li.append(a); ul.append(li);
    }
    mas.hidden = items.length <= limite;
  };
  [q, estado, marca, clase].forEach((x) => x?.addEventListener('input', () => { limite = 60; pintar(); }));
  mas.addEventListener('click', () => { limite += 120; pintar(); });
  cuerpo.append(cab, filtros, conteo, ul, mas);
  pintar(); q.focus();
}

/* ---------- edición ---------- */
async function editar(t: TipoId, slugRuta: string) {
  const tipo = TIPOS[t];
  const esNuevo = slugRuta === 'nuevo';
  let slug = esNuevo ? '' : slugRuta;
  const base = esNuevo ? null : datos[t].find((x) => x.slug === slug) || null;
  const valores: Item = esNuevo ? { slug: '', ...(t === 'posts' ? { fecha: new Date().toISOString().slice(0, 19) } : {}), ...(t === 'catalogo' ? { lineas: [], es_equipo: false } : {}), ...(t === 'marcas' ? { color: '#0062B8' } : {}) } : (actual(t, slug) as Item);
  if (!valores) { cuerpo.innerHTML = `<div class="adm-vacio"><h1>No encontramos ese elemento</h1><p><a href="#/${t}">Volver a ${tipo.nombre}</a></p></div>`; return; }
  const yaPublicado = () => !!pub[t][slug];
  const nuevoDeAqui = () => esNuevo || !!(pub[t][slug]?.datos._nuevo || borr[t][slug]?.datos._nuevo);
  for (const c of tipo.campos) if (c.t === 'imagen' && valores[c.k]?.src?.startsWith('cms:')) await cargarFoto(valores[c.k].src);

  cuerpo.innerHTML = '';
  const barra = h('div', 'adm-barra');
  const volver = h('a', 'adm-btn adm-btn-ic', I.atras); volver.setAttribute('href', `#/${t}`); volver.setAttribute('aria-label', `Volver a ${tipo.nombre}`);
  const tit = h('div', 'adm-barra-tit', `<span>${tipo.nombre}</span><b></b>`);
  const estadoTxt = h('em', 'adm-estado');
  const bHist = boton('adm-btn adm-btn-ic', I.reloj, 'Historial de publicaciones');
  const bVer = h('a', 'adm-btn adm-btn-ic', I.externo); bVer.setAttribute('target', '_blank'); bVer.setAttribute('rel', 'noopener'); bVer.title = 'Ver la página publicada';
  const bPrev = boton('adm-btn adm-btn-ic adm-solo-movil', I.ojo, 'Vista previa');
  const bDesc = boton('adm-btn', 'Descartar borrador');
  const bPub = boton('adm-btn adm-btn-p', `${I.check}<span>Publicar</span>`);
  barra.append(volver, tit, estadoTxt, bHist, bVer, bPrev, bDesc, bPub);

  const grid = h('div', 'adm-editor');
  const form = h('form', 'adm-form') as HTMLFormElement; form.noValidate = true;
  const prev = h('aside', 'adm-prev'); prev.setAttribute('aria-label', 'Vista previa');
  grid.append(form, prev);
  cuerpo.append(barra, grid);

  /* campos */
  const lectores: Record<string, () => Valor> = {};
  const marcarCambio = () => { pintarPrev(); programarGuardado(); };
  for (const c of tipo.campos) {
    const campo = h('div', 'adm-campo'); const id = `f-${c.k}`;
    const etiqueta = h('label', '', `${esc(c.label)}${c.req ? ' <i>*</i>' : ''}`); etiqueta.setAttribute('for', id);
    const ayuda = c.ayuda ? h('p', 'adm-ayuda', esc(c.ayuda)) : null;
    let control: HTMLElement;
    const v = valores[c.k];
    if (c.t === 'texto' || c.t === 'fecha') {
      const inp = h('input') as HTMLInputElement; inp.id = id; inp.type = c.t === 'fecha' ? 'date' : 'text'; if (c.max) inp.maxLength = c.max;
      inp.value = c.t === 'fecha' ? String(v || '').slice(0, 10) : String(v ?? '');
      inp.addEventListener('input', marcarCambio);
      lectores[c.k] = () => (c.t === 'fecha' ? (inp.value ? `${inp.value}T${String(valores.fecha || 'T09:00:00').split('T')[1] || '09:00:00'}` : valores.fecha) : inp.value.trim());
      control = inp;
    } else if (c.t === 'area') {
      const ta = h('textarea') as HTMLTextAreaElement; ta.id = id; ta.rows = 3; if (c.max) ta.maxLength = c.max; ta.value = String(v ?? '');
      const cnt = h('span', 'adm-cuenta'); const contar = () => (cnt.textContent = `${ta.value.length}${c.max ? ` / ${c.max}` : ''}`); contar();
      ta.addEventListener('input', () => { contar(); marcarCambio(); });
      lectores[c.k] = () => ta.value.trim();
      control = h('div', 'adm-area'); control.append(ta, cnt);
    } else if (c.t === 'check') {
      const lab = h('label', 'adm-check'); const inp = h('input') as HTMLInputElement; inp.type = 'checkbox'; inp.id = id; inp.checked = !!v; lab.append(inp, document.createTextNode(' Sí'));
      inp.addEventListener('change', marcarCambio); lectores[c.k] = () => inp.checked; control = lab;
    } else if (c.t === 'color') {
      const fila = h('div', 'adm-color-campo'); const inp = h('input') as HTMLInputElement; inp.type = 'color'; inp.id = id; inp.value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#0062B8';
      const hex = h('input') as HTMLInputElement; hex.type = 'text'; hex.value = inp.value; hex.maxLength = 7; hex.setAttribute('aria-label', 'Código del color');
      inp.addEventListener('input', () => { hex.value = inp.value; marcarCambio(); }); hex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { inp.value = hex.value; marcarCambio(); } });
      fila.append(inp, hex); lectores[c.k] = () => inp.value.toUpperCase(); control = fila;
    } else if (c.t === 'marca') {
      const sel = h('select', 'adm-select') as HTMLSelectElement; sel.id = id; sel.append(new Option('Elige la marca…', ''));
      todos('marcas').sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach((m) => sel.append(new Option(m.nombre, m.slug)));
      sel.value = v || ''; sel.addEventListener('change', marcarCambio); lectores[c.k] = () => sel.value; control = sel;
    } else if (c.t === 'lineas') {
      const fila = h('div', 'adm-checks'); const sel = new Set<string>(Array.isArray(v) ? v : []);
      todos('lineas').forEach((l) => { const lab = h('label', 'adm-check'); const inp = h('input') as HTMLInputElement; inp.type = 'checkbox'; inp.value = l.slug; inp.checked = sel.has(l.slug); inp.addEventListener('change', marcarCambio); lab.append(inp, document.createTextNode(` ${l.nombre}`)); fila.append(lab); });
      lectores[c.k] = () => Array.from(fila.querySelectorAll<HTMLInputElement>('input:checked')).map((i) => i.value); control = fila;
    } else if (c.t === 'imagen') {
      control = campoImagen(v, marcarCambio, (fn) => (lectores[c.k] = fn));
    } else {
      control = campoRico(String(v ?? ''), marcarCambio, (fn) => (lectores[c.k] = fn), id);
    }
    campo.append(etiqueta); if (ayuda) campo.append(ayuda); campo.append(control); form.append(campo);
  }
  // slug (dirección): solo editable mientras el elemento nunca se ha publicado
  const campoSlug = h('div', 'adm-campo');
  const slugIn = h('input') as HTMLInputElement; slugIn.id = 'f-slug'; slugIn.maxLength = 80; slugIn.value = slug;
  campoSlug.innerHTML = `<label for="f-slug">Dirección de la página</label>`;
  const pre = h('div', 'adm-slug', `<span>quimiolab.com.co${esc(tipo.url('').replace(/\/$/, ''))}/</span>`); pre.append(slugIn, h('span', '', '/'));
  const slugAyuda = h('p', 'adm-ayuda');
  campoSlug.append(pre, slugAyuda); form.append(campoSlug);
  const refrescarSlug = () => {
    const fijo = yaPublicado() || !nuevoDeAqui();
    slugIn.readOnly = fijo;
    slugAyuda.textContent = fijo ? 'La dirección no cambia una vez publicada (Google y otros sitios ya la enlazan).' : 'Se crea con el título. Puedes ajustarla antes de publicar por primera vez.';
  };
  slugIn.addEventListener('input', () => { slugIn.value = slugify(slugIn.value).slice(0, 80); slugEditado = true; });
  let slugEditado = !esNuevo;
  if (esNuevo) form.querySelector<HTMLInputElement>(`#f-${tipo.titulo}`)?.addEventListener('input', (e) => { if (!slugEditado) slugIn.value = slugify((e.target as HTMLInputElement).value); });
  refrescarSlug();
  // visible / oculto
  let oculto = !!valores._oculto;
  if (tipo.ocultar) {
    const campoVis = h('div', 'adm-campo adm-visible');
    const lab = h('label', 'adm-check'); const inp = h('input') as HTMLInputElement; inp.type = 'checkbox'; inp.checked = !oculto; lab.append(inp, document.createTextNode(` Visible en el sitio`));
    inp.addEventListener('change', () => { oculto = !inp.checked; marcarCambio(); });
    campoVis.append(lab, h('p', 'adm-ayuda', 'Si lo ocultas, su página deja de existir al publicar (puedes volver a mostrarlo cuando quieras).'));
    form.append(campoVis);
  }

  /* diferencias contra la base y estado */
  const leer = (): Record<string, Valor> => {
    const out: Record<string, Valor> = {};
    for (const c of tipo.campos) out[c.k] = lectores[c.k]?.();
    if (t === 'catalogo' && out.resumen_html !== undefined) out.resumen = textoDe(out.resumen_html);
    return out;
  };
  const diff = (): Record<string, Valor> => {
    const v = leer(); const d: Record<string, Valor> = {};
    for (const [k, x] of Object.entries(v)) if (!base || !igual(x, base[k])) d[k] = x;
    if (!base) d._nuevo = true;
    if (oculto) d._oculto = true;
    return d;
  };
  const refrescar = () => {
    const e = slug ? estados(t, slug) : { borrador: true, sinPublicar: true, oculto, nuevo: true, editado: false };
    tit.querySelector('b')!.textContent = String(leer()[tipo.titulo] || `Nuevo ${tipo.singular}`);
    const b = slug ? borr[t][slug] : undefined, p = slug ? pub[t][slug] : undefined;
    estadoTxt.textContent = !slug ? 'Completa lo obligatorio (*) para guardar' : guardando ? 'Guardando…' : e.sinPublicar ? 'Sin publicar · borrador guardado' : b ? `Borrador sin publicar${b.by ? ` · ${b.by.split('@')[0]}` : ''}` : p ? `Publicado ${cuando(p.at)}` : 'Como en el sitio original';
    bDesc.hidden = !b; bPub.disabled = !b && !esNuevo;
    bVer.hidden = !slug || e.sinPublicar; if (slug) bVer.setAttribute('href', tipo.url(slug));
    bHist.disabled = !slug;
  };

  /* guardado automático del borrador */
  let guardando = false, temporizador: number | undefined, pendiente = false;
  const programarGuardado = () => { pendiente = true; clearTimeout(temporizador); temporizador = window.setTimeout(guardarBorrador, 1200); refrescar(); };
  async function guardarBorrador() {
    clearTimeout(temporizador);
    if (!pendiente) return;
    const v = leer();
    for (const c of tipo.campos) if (c.req && !v[c.k] && esNuevo && !slug) return; // un elemento nuevo se crea cuando tiene lo obligatorio
    if (!slug) { // primer guardado de un elemento nuevo: se fija la dirección
      let s = slugIn.value || slugify(String(v[tipo.titulo] || '')); const usados = new Set(todos(t).map((x) => x.slug)); let n = 2; const raizSlug = s;
      while (usados.has(s)) s = `${raizSlug}-${n++}`;
      slug = s; slugIn.value = s; history.replaceState(null, '', `#/${t}/${encodeURIComponent(s)}`);
    } else if (nuevoDeAqui() && !yaPublicado() && slugIn.value && slugIn.value !== slug && !todos(t).some((x) => x.slug === slugIn.value)) {
      await alm.quitar('cms_borradores', idDoc(t, slug)); delete borr[t][slug]; // renombrar un borrador nuevo
      slug = slugIn.value; history.replaceState(null, '', `#/${t}/${encodeURIComponent(slug)}`);
    }
    pendiente = false; guardando = true; refrescar();
    const d = diff();
    try {
      const p = pub[t][slug]?.datos;
      if (p ? igual(d, p) : !Object.keys(d).length) { await alm.quitar('cms_borradores', idDoc(t, slug)); delete borr[t][slug]; }
      else { await alm.poner('cms_borradores', idDoc(t, slug), { tipo: t, slug, datos: d, by: usuario }); borr[t][slug] = { datos: d, at: Date.now(), by: usuario }; }
    } catch (e) { console.error(e); pendiente = true; toast('No se pudo guardar el borrador. Revisa tu conexión.', true); }
    guardando = false; refrescar(); refrescarSlug();
  }
  salirConCambios = () => { if (pendiente) { guardarBorrador(); } return true; };
  addEventListener('beforeunload', () => { if (pendiente) guardarBorrador(); }, { once: true });

  /* acciones */
  bPub.addEventListener('click', async () => {
    const v = leer();
    const falta = tipo.campos.find((c) => c.req && !v[c.k]); if (falta) { toast(`Falta «${falta.label}».`, true); form.querySelector<HTMLElement>(`#f-${falta.k}`)?.focus(); return; }
    pendiente = true; await guardarBorrador();
    if (!slug) return;
    const d = diff();
    bPub.disabled = true; bPub.querySelector('span')!.textContent = 'Publicando…';
    try {
      if (!Object.keys(d).length) { await alm.quitar('cms', idDoc(t, slug)); delete pub[t][slug]; }
      else { await alm.poner('cms', idDoc(t, slug), { tipo: t, slug, datos: d, by: usuario }); pub[t][slug] = { datos: d, at: Date.now(), by: usuario }; }
      await alm.quitar('cms_borradores', idDoc(t, slug)); delete borr[t][slug];
      try { await alm.poner('cms_versiones', `${idDoc(t, slug)}__${Date.now()}`, { tipo: t, slug, datos: JSON.stringify(d), by: usuario }); } catch (e) { console.warn('Sin versión en el historial', e); }
      toast(oculto ? 'Publicado: quedará oculto en el sitio.' : '¡Publicado! Aparece en el sitio con la siguiente actualización.');
    } catch (e) { console.error(e); toast('No se pudo publicar. Revisa tu conexión y que tu cuenta esté autorizada.', true); }
    bPub.querySelector('span')!.textContent = 'Publicar'; refrescar(); refrescarSlug();
  });
  bDesc.addEventListener('click', async () => {
    if (!confirm(nuevoDeAqui() && !yaPublicado() ? '¿Borrar este borrador? El elemento nuevo se elimina.' : '¿Descartar los cambios sin publicar y volver a lo publicado?')) return;
    pendiente = false; clearTimeout(temporizador);
    await alm.quitar('cms_borradores', idDoc(t, slug)); delete borr[t][slug];
    toast('Borrador descartado.');
    if (nuevoDeAqui() && !yaPublicado()) location.hash = `#/${t}`; else editar(t, slug);
  });
  bHist.addEventListener('click', async () => {
    const versiones = (await alm.donde('cms_versiones', { tipo: t, slug })).map((x) => ({ at: millis(x.d.at), by: x.d.by, datos: x.d.datos })).sort((a, b) => b.at - a.at);
    const dlg = h('dialog', 'adm-dialogo') as HTMLDialogElement;
    dlg.innerHTML = `<div class="adm-dlg-cab"><b>Historial</b></div><p class="adm-ayuda">Cada publicación queda guardada. Al restaurar una, se carga como borrador: revísala y publica.</p>`;
    const ul = h('ul', 'adm-versiones');
    versiones.forEach((v, i) => {
      const li = h('li', '', `<div><b>${cuando(v.at)}</b><span>${esc(v.by || '')}${i === 0 && pub[t][slug] ? ' · <em>publicada</em>' : ''}</span></div>`);
      if (i > 0 || !pub[t][slug]) { const b = boton('adm-btn', 'Restaurar'); b.addEventListener('click', async () => { let d: Record<string, Valor> = {}; try { d = JSON.parse(v.datos); } catch { /* vacía */ } await alm.poner('cms_borradores', idDoc(t, slug), { tipo: t, slug, datos: d, by: usuario }); borr[t][slug] = { datos: d, at: Date.now(), by: usuario }; dlg.close(); toast('Versión cargada como borrador.'); editar(t, slug); }); li.append(b); }
      ul.append(li);
    });
    if (!versiones.length) ul.append(h('li', 'adm-ayuda', 'Aún no hay publicaciones desde el panel.'));
    if (base) { const li = h('li', '', '<div><b>Original del sitio</b><span>Como venía del sitio anterior</span></div>'); const b = boton('adm-btn', 'Restaurar'); b.addEventListener('click', async () => { const d = oculto ? { _oculto: true } : {}; await alm.poner('cms_borradores', idDoc(t, slug), { tipo: t, slug, datos: d, by: usuario }); borr[t][slug] = { datos: d, at: Date.now(), by: usuario }; dlg.close(); toast('Original cargado como borrador. Publica para aplicarlo.'); editar(t, slug); }); li.append(b); ul.append(li); }
    const cerrar = boton('adm-btn', 'Cerrar'); cerrar.addEventListener('click', () => dlg.close());
    dlg.append(ul, cerrar); document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove()); dlg.showModal();
  });
  bPrev.addEventListener('click', () => { prev.classList.toggle('abierta'); });
  form.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); pendiente = true; guardarBorrador(); } });

  /* vista previa con los estilos del sitio */
  function pintarPrev() {
    const v = leer(); const img = urlFoto(v.imagen);
    const marcaN = t === 'catalogo' ? todos('marcas').find((m) => m.slug === v.marca) : null;
    let html = '';
    if (t === 'posts') html = `<span class="chip">Blog</span><h1 class="adm-prev-h1">${esc(v.titulo || 'Título del artículo')}</h1><p class="muted">${esc(v.fecha ? new Date(v.fecha).toLocaleDateString('es-CO', { dateStyle: 'long' }) : '')}</p>${img ? `<img class="adm-prev-img" src="${esc(img)}" alt="">` : ''}<div class="prosa">${v.contenido_html || '<p class="muted">Aquí va el contenido…</p>'}</div>`;
    if (t === 'catalogo') html = `${marcaN ? `<span class="chip chip-aliado" style="--aliado:${esc(marcaN.color)}">${esc(marcaN.nombre)}</span>` : ''}<h1 class="adm-prev-h1">${esc(v.nombre || 'Nombre del producto')}</h1>${img ? `<img class="adm-prev-img adm-prev-producto" src="${esc(img)}" alt="">` : ''}<div class="prosa">${v.resumen_html || ''}${v.descripcion_html ? `<h2>Descripción</h2>${v.descripcion_html}` : ''}</div>`;
    if (t === 'marcas') html = `<div class="adm-prev-marca" style="--aliado:${esc(v.color)}"><span class="eyebrow">Marca aliada</span><h1 class="adm-prev-h1">${esc(v.nombre || 'Marca')}</h1><p class="lead">${esc(v.resumen || '')}</p></div><div class="prosa">${v.intro_html || ''}</div>`;
    if (t === 'lineas') html = `<span class="eyebrow">Línea</span><h1 class="adm-prev-h1">${esc(v.nombre)}</h1><p class="lead">${esc(v.descripcion || '')}</p><div class="prosa">${v.intro_html || ''}</div>`;
    prev.innerHTML = `<div class="adm-prev-cab"><b>Vista previa</b><span>con los estilos del sitio</span></div><div class="adm-prev-hoja">${html}</div>`;
    refrescar();
  }
  pintarPrev();
}

/* ---------- campo: foto ---------- */
function campoImagen(v: any, cambio: () => void, registrar: (fn: () => Valor) => void) {
  let img: { src: string; w: number | null; h: number | null; alt: string } | null = v?.src ? { ...v } : null;
  const caja = h('div', 'adm-foto');
  const vista = h('div', 'adm-foto-vista');
  const acciones = h('div', 'adm-fila');
  const subir = h('label', 'adm-btn adm-btn-p', `${I.foto}<span>Subir foto</span>`); const file = h('input') as HTMLInputElement; file.type = 'file'; file.accept = 'image/*'; file.hidden = true; subir.append(file);
  const quitar = boton('adm-btn', 'Quitar');
  const alt = h('input') as HTMLInputElement; alt.type = 'text'; alt.maxLength = 140; alt.placeholder = 'Descripción de la foto (para accesibilidad y Google)'; alt.setAttribute('aria-label', 'Descripción de la foto');
  acciones.append(subir, quitar);
  const pintar = () => { const u = urlFoto(img); vista.innerHTML = u ? `<img src="${esc(u)}" alt="">` : `<span>${I.foto} Sin foto</span>`; quitar.hidden = !img; alt.hidden = !img; alt.value = img?.alt || ''; };
  file.addEventListener('change', async () => {
    const f = file.files?.[0]; if (!f) return;
    const span = subir.querySelector('span')!; span.textContent = 'Optimizando…';
    try {
      const { data, w, h: alto } = await comprimir(f);
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      await alm.poner('cms_media', id, { data, w, h: alto, by: usuario });
      fotos.set(`cms:${id}`, data);
      img = { src: `cms:${id}`, w, h: alto, alt: img?.alt || f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') };
      pintar(); cambio(); toast('Foto subida.');
    } catch (e) { console.error(e); toast('No se pudo subir esa foto.', true); }
    span.textContent = 'Subir foto'; file.value = '';
  });
  quitar.addEventListener('click', () => { img = null; pintar(); cambio(); });
  alt.addEventListener('input', () => { if (img) { img.alt = alt.value; cambio(); } });
  registrar(() => (img ? { ...img } : null));
  pintar();
  caja.append(vista, acciones, alt, h('p', 'adm-ayuda', 'Se optimiza sola (WebP, máx. 1600 px). Usa fotos propias o con permiso de la marca.'));
  return caja;
}

/* ---------- campo: texto enriquecido ---------- */
function campoRico(html: string, cambio: () => void, registrar: (fn: () => Valor) => void, id: string) {
  const caja = h('div', 'adm-rico');
  const barra = h('div', 'adm-rico-barra'); barra.setAttribute('role', 'toolbar'); barra.setAttribute('aria-label', 'Formato del texto');
  const area = h('div', 'adm-rico-area prosa'); area.contentEditable = 'true'; area.id = id; area.setAttribute('role', 'textbox'); area.setAttribute('aria-multiline', 'true'); area.innerHTML = html || '<p><br></p>';
  const bloque = h('select', 'adm-select adm-rico-bloque') as HTMLSelectElement; bloque.setAttribute('aria-label', 'Tipo de párrafo');
  [['p', 'Párrafo'], ['h2', 'Título'], ['h3', 'Subtítulo'], ['blockquote', 'Cita']].forEach(([v, n]) => bloque.append(new Option(n, v)));
  bloque.addEventListener('change', () => { area.focus(); document.execCommand('formatBlock', false, bloque.value); tocado = true; cambio(); });
  const mk = (icono: string, tit: string, fn: () => void) => { const b = boton('adm-rb', icono, tit); b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', () => { fn(); tocado = true; cambio(); }); barra.append(b); };
  barra.append(bloque);
  mk(I.negrita, 'Negrita (palabras clave)', () => document.execCommand('bold'));
  mk(I.cursiva, 'Cursiva', () => document.execCommand('italic'));
  mk(I.lista, 'Lista', () => document.execCommand('insertUnorderedList'));
  mk(I.numerada, 'Lista numerada', () => document.execCommand('insertOrderedList'));
  mk(I.enlace, 'Enlace', () => {
    const sel = getSelection(); if (!sel || sel.isCollapsed) { toast('Selecciona primero el texto del enlace.', true); return; }
    const url = prompt('Dirección del enlace (https://… o /pagina/ del sitio):', 'https://'); if (!url) return;
    if (!/^(https?:\/\/|mailto:|tel:|\/)/.test(url.trim())) { toast('El enlace debe empezar por https://, / , mailto: o tel:', true); return; }
    document.execCommand('createLink', false, url.trim());
  });
  mk(I.limpiar, 'Quitar formato', () => { document.execCommand('removeFormat'); document.execCommand('unlink'); });
  document.addEventListener('selectionchange', () => {
    const n = getSelection()?.anchorNode; if (!n || !area.contains(n)) return;
    const b = (n instanceof Element ? n : n.parentElement)?.closest('h2, h3, blockquote, p');
    bloque.value = b && area.contains(b) ? b.tagName.toLowerCase() : 'p';
  });
  let tocado = false; // si no se toca, se conserva el HTML original tal cual (no se reescribe lo del WordPress)
  area.addEventListener('input', () => { tocado = true; cambio(); });
  area.addEventListener('paste', (e) => {
    e.preventDefault();
    const d = e.clipboardData; const rico = d?.getData('text/html');
    if (rico) document.execCommand('insertHTML', false, sanear(rico)); // conserva negritas, listas y enlaces; quita estilos
    else document.execCommand('insertText', false, d?.getData('text/plain') || '');
  });
  registrar(() => (tocado ? sanear(area.innerHTML) : html));
  caja.append(barra, area);
  return caja;
}

/** Convierte una foto a WebP y la reduce hasta caber en un documento de Firestore. */
async function comprimir(file: File): Promise<{ data: string; w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  let escala = Math.min(1, FOTO_ANCHO_MAX / bmp.width), calidad = 0.82, data = '', w = 0, alto = 0;
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('canvas'); w = c.width = Math.round(bmp.width * escala); alto = c.height = Math.round(bmp.height * escala);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    data = c.toDataURL('image/webp', calidad); if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', calidad);
    if (data.length * 0.75 <= FOTO_BYTES_MAX) break;
    if (calidad > 0.55) calidad -= 0.1; else escala *= 0.8;
  }
  bmp.close();
  return { data, w, h: alto };
}
