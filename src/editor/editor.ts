/**
 * Modo edición (?edit): el administrador entra con Google, toca lo que quiere cambiar y publica.
 * Se carga solo en modo edición; los visitantes nunca descargan Firebase.
 *
 * Qué se edita: textos [data-ed] (con negrita, destacado y enlaces), fotos [data-ed-img],
 * destinos de botones [data-ed-link] y secciones [data-ed-sec] (orden, ocultar, fondo, agregar, borrar).
 *
 * Estado = cambios pendientes (id#campo → valor; '' = volver al original) + secciones.
 * - Cada cambio entra al historial (deshacer/rehacer) y se guarda como borrador en este equipo.
 * - «Vista previa» muestra el borrador en un marco, en escritorio o celular, sin controles.
 * - «Publicar» escribe todo en un batch y guarda una versión completa en page_versions;
 *   el «Historial» permite cargar una versión (o el diseño original) como borrador.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getFirestore, writeBatch, doc, setDoc, getDocs, collection, query, where, serverTimestamp, type Firestore } from 'firebase/firestore';
import './editor.css';
import { firebaseConfig, ADMINS, COLECCION, PAGINAS, WHATSAPP, FOTO_ANCHO_MAX, FOTO_BYTES_MAX } from './config';
import { pedirPagina, aplicar, aplicarSecciones, aplicarEnlace, reconciliar, keysCodigo, limpiarCache, guardarCache, leerBorrador, guardarBorrador, borrarBorrador, conCambios, type Contenido, type Seccion } from './contenido';
import { FONDOS, PATRONES, PLANTILLAS, admiteFondo, htmlPlantilla, nuevaKey } from './secciones.mjs';
import { abrirRecorrido, tocaRecorrido, pasosEditor, GUIA } from '../tour/recorridos';

const VERSIONES = 'page_versions';
type Campo = 'content' | 'href' | 'alt' | 'pos' | 'sections';
type Estado = { p: [string, string][]; s: Seccion[] };
const h = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const boton = (cls: string, html: string, titulo?: string) => { const b = h('button', cls, html) as HTMLButtonElement; b.type = 'button'; if (titulo) { b.title = titulo; b.setAttribute('aria-label', titulo); } return b; };
const ic = (d: string, w = 2) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const svg = {
  lapiz: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  foto: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
  enlace: ic('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>'),
  arriba: ic('<path d="m18 15-6-6-6 6"/>', 2.2),
  abajo: ic('<path d="m6 9 6 6 6-6"/>', 2.2),
  ojo: ic('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  ojoNo: ic('<path d="M17.9 17.9A10.5 10.5 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 5.1-5.9"/><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2"/><path d="m2 2 20 20"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/>'),
  pincel: ic('<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 1.7-3c-.4-.6-.2-1.5.6-1.8.3-.1.6-.2 1-.2H17a5 5 0 0 0 5-5c0-5.5-4.5-10-10-10Z"/>'),
  mas: ic('<path d="M12 5v14M5 12h14"/>', 2.2),
  basura: ic('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  check: ic('<path d="m5 12 5 5L20 7"/>', 2.4),
  x: ic('<path d="M18 6 6 18M6 6l12 12"/>', 2.2),
  deshacer: ic('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  rehacer: ic('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  reloj: ic('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'),
  vista: ic('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  movil: ic('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
  resaltar: ic('<path d="M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4"/><rect x="8" y="8" width="8" height="8" rx="1"/>'),
  negrita: ic('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>', 2.4),
  cursiva: ic('<path d="M19 4h-9M14 20H5M15 4 9 20"/>', 2.2),
  limpiar: ic('<path d="M4 7V4h16v3M9 20h6M12 4v16"/><path d="m3 3 18 18"/>'),
  google: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>',
};

export async function iniciar(main: HTMLElement, pagina: string) {
  document.documentElement.classList.add('ql-edit');
  const toast = montarToast();
  // Modo demo (solo builds con PUBLIC_ED_DEMO=1): prueba la interfaz sin Firebase; «Publicar» no guarda nada.
  const demo = import.meta.env.PUBLIC_ED_DEMO === '1';
  if (!firebaseConfig.apiKey && !demo) { tarjeta('Falta configurar Firebase', '<p>El editor necesita el <code>firebaseConfig</code> del proyecto <b>quimiolab-web</b> en <code>src/editor/config.ts</code>.</p>'); return; }
  const app = initializeApp(demo ? { apiKey: 'demo', projectId: 'demo' } : firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let arrancado = false;
  if (demo) { arrancar({ email: 'demo@braindy.co', uid: 'demo' } as User, db, true, toast, main, pagina).catch(console.error); return; }

  onAuthStateChanged(auth, (user) => {
    if (!user) { pedirIngreso(auth); return; }
    const correo = (user.email || '').toLowerCase();
    if (!ADMINS.map((a) => a.toLowerCase()).includes(correo)) {
      tarjeta('Esta cuenta no puede editar', `<p>Entraste como <b>${correo}</b>, que no está en la lista de personas autorizadas. Pide a Braindy que la agregue.</p>`, [{ texto: 'Salir', fn: () => signOut(auth).then(() => location.href = location.pathname) }]);
      return;
    }
    if (arrancado) return; arrancado = true;
    quitarTarjeta();
    arrancar(user, db, false, toast, main, pagina).catch((e) => { console.error(e); toast('No se pudo cargar el contenido publicado. Revisa las reglas de Firestore.', true); });
  });
}

async function arrancar(user: User, db: Firestore, demo: boolean, toast: (m: string, e?: boolean) => void, main: HTMLElement, pagina: string) {
  limpiarCache();
  let publicado: Contenido = {};
  try { publicado = await pedirPagina(pagina); } catch (e) { console.warn('Sin contenido publicado aún', e); }
  aplicar(main, pagina, publicado, true);

  /* ================= estado, historial y borrador ================= */
  let pendientes = new Map<string, string>();
  let secciones: Seccion[] = reconciliar(safeJSON(publicado[`layout__${pagina}`]?.sections), keysCodigo(main));
  const seccionesPublicadas = () => reconciliar(safeJSON(publicado[`layout__${pagina}`]?.sections), keysCodigo(main));
  const foto = (): Estado => ({ p: [...pendientes], s: JSON.parse(JSON.stringify(secciones)) });
  const historia: string[] = []; let pos = -1; let tecleo: number | undefined;
  const registrar = () => {
    clearTimeout(tecleo); tecleo = undefined;
    const e = JSON.stringify(foto()); if (historia[pos] === e) return;
    historia.splice(pos + 1); historia.push(e); if (historia.length > 120) historia.shift(); pos = historia.length - 1;
    refrescarBarra();
  };
  let guardado: number | undefined, avisoPesado = false;
  const guardarLuego = () => {
    clearTimeout(guardado);
    guardado = window.setTimeout(() => {
      if (!pendientes.size && JSON.stringify(secciones) === JSON.stringify(seccionesPublicadas())) { borrarBorrador(pagina); return; }
      const ok = guardarBorrador(pagina, { t: Date.now(), ...foto() });
      if (!ok && !avisoPesado) { avisoPesado = true; toast('Una foto es muy pesada para guardarla en el borrador: publícala pronto para no perderla.', true); }
      refrescarBarra(true);
    }, 400);
  };
  /** Un cambio del usuario. `tecleando` agrupa las letras de una misma edición en un solo paso del historial. */
  const set = (id: string, campo: Campo, valor: string, tecleando = false) => {
    pendientes.set(`${id}#${campo}`, valor);
    if (tecleando) { clearTimeout(tecleo); tecleo = window.setTimeout(registrar, 700); } else registrar();
    guardarLuego(); refrescarBarra();
  };

  /* lo publicado de cada bloque (para deshacer hasta el principio) */
  const base = { txt: new Map<string, string>(), img: new Map<string, { src: string; alt: string; pos: string }>(), href: new Map<string, string>() };
  const capturarBase = (root: ParentNode, forzar = false) => {
    root.querySelectorAll<HTMLElement>('[data-ed]').forEach((el) => { if (forzar || !base.txt.has(el.dataset.ed!)) base.txt.set(el.dataset.ed!, el.innerHTML); });
    root.querySelectorAll<HTMLImageElement>('[data-ed-img]').forEach((img) => { if (forzar || !base.img.has(img.dataset.edImg!)) base.img.set(img.dataset.edImg!, { src: img.getAttribute('src') || '', alt: img.alt, pos: img.style.objectPosition }); });
    root.querySelectorAll<HTMLAnchorElement>('[data-ed-link]').forEach((a) => { if (forzar || !base.href.has(a.dataset.edLink!)) base.href.set(a.dataset.edLink!, a.getAttribute('href') || ''); });
  };

  /** Pinta un estado completo (deshacer, rehacer, borrador, versión). */
  const pintarEstado = (e: Estado) => {
    pendientes = new Map(e.p); secciones = JSON.parse(JSON.stringify(e.s));
    aplicarSecciones(main, secciones, true, pagina, conCambios(publicado, pendientes));
    activar(main);
    const v = (id: string, campo: Campo) => pendientes.get(`${id}#${campo}`);
    main.querySelectorAll<HTMLElement>('[data-ed]').forEach((el) => {
      const id = el.dataset.ed!, x = v(id, 'content');
      const html = x ? x : x === '' ? el.dataset.edDef ?? base.txt.get(id) ?? '' : base.txt.get(id);
      if (html !== undefined && el.innerHTML !== html) el.innerHTML = html;
    });
    main.querySelectorAll<HTMLImageElement>('[data-ed-img]').forEach((img) => {
      const id = img.dataset.edImg!, b = base.img.get(id), c = v(id, 'content'), a = v(id, 'alt'), p = v(id, 'pos');
      const src = c ? c : c === '' ? img.dataset.edOrig || '' : b?.src || '';
      if (src && img.getAttribute('src') !== src) { img.removeAttribute('srcset'); img.src = src; }
      img.alt = a ? a : a === '' ? img.dataset.edOrigAlt ?? '' : b?.alt ?? img.alt;
      img.style.objectPosition = p ? p : p === '' ? '' : b?.pos ?? '';
    });
    main.querySelectorAll<HTMLAnchorElement>('[data-ed-link]').forEach((a) => { const x = v(a.dataset.edLink!, 'href') || base.href.get(a.dataset.edLink!); if (x) aplicarEnlace(a, x); });
    cerrarPanel(); barrasSeccion(); refrescarBarra(); pedirUbicar();
  };
  const deshacer = () => { if (tecleo) registrar(); if (pos <= 0) return; pos--; pintarEstado(JSON.parse(historia[pos])); guardarLuego(); };
  const rehacer = () => { if (pos >= historia.length - 1) return; pos++; pintarEstado(JSON.parse(historia[pos])); guardarLuego(); };

  /* ================= textos ================= */
  const activarTextos = (root: ParentNode) => root.querySelectorAll<HTMLElement>('[data-ed]:not([data-ed-on])').forEach((el) => {
    el.dataset.edOn = ''; el.contentEditable = 'true'; el.spellcheck = true; el.classList.add('ql-ed-txt');
    el.setAttribute('aria-label', 'Texto editable');
    el.addEventListener('input', () => set(el.dataset.ed!, 'content', limpiarHTML(el.innerHTML), true));
    el.addEventListener('keydown', (e) => {
      const bloque = /^(P|DIV|LI|BLOCKQUOTE)$/.test(el.tagName);
      if (e.key === 'Enter') { if (!bloque || e.shiftKey) { e.preventDefault(); if (bloque) document.execCommand('insertLineBreak'); } }
      if (e.key === ' ' && el.tagName === 'SUMMARY') { e.preventDefault(); document.execCommand('insertText', false, ' '); } // no plegar la pregunta al escribir
      if (e.key === 'Escape') el.blur();
    });
    el.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') || ''); });
    el.addEventListener('blur', () => { if (tecleo) registrar(); });
  });
  const abrirDesplegables = (root: ParentNode) => root.querySelectorAll('details').forEach((d) => (d.open = true));
  // En modo edición los enlaces no navegan ni las preguntas se pliegan; tocar una foto abre su panel
  main.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('a') || t.closest('form') || t.closest('summary')) e.preventDefault();
    const img = t.closest<HTMLImageElement>('[data-ed-img]'); if (img) { e.preventDefault(); panelFoto(img); }
  }, true);
  main.addEventListener('submit', (e) => e.preventDefault(), true);

  /* ================= capa de chips (fotos, destinos, secciones) ================= */
  const capa = h('div', 'ql-ed-capa'); document.body.append(capa);
  type Chip = { el: HTMLElement; ancla: HTMLElement; pos: 'foto' | 'enlace' | 'seccion' };
  const chips: Chip[] = [];
  const activarChips = (root: ParentNode) => {
    root.querySelectorAll<HTMLImageElement>('[data-ed-img]:not([data-ed-chip])').forEach((img) => {
      img.dataset.edChip = '';
      const c = boton('ql-ed-chip', `${svg.foto}<span>${img.dataset.edFondo !== undefined ? 'Cambiar foto de fondo' : 'Cambiar foto'}</span>`);
      c.addEventListener('click', () => panelFoto(img));
      capa.append(c); chips.push({ el: c, ancla: img, pos: 'foto' });
    });
    root.querySelectorAll<HTMLAnchorElement>('[data-ed-link]:not([data-ed-chip])').forEach((a) => {
      a.dataset.edChip = '';
      const c = boton('ql-ed-chip ql-ed-chip-enlace', `${svg.enlace}<span>Destino</span>`);
      c.addEventListener('click', () => panelEnlace(a));
      capa.append(c); chips.push({ el: c, ancla: a, pos: 'enlace' });
    });
  };
  const activar = (root: ParentNode) => { capturarBase(root); activarTextos(root); abrirDesplegables(root); activarChips(root); };

  const barrasSeccion = () => {
    chips.filter((c) => c.pos === 'seccion').forEach((c) => { c.el.remove(); chips.splice(chips.indexOf(c), 1); });
    const total = secciones.length;
    secciones.forEach((s, i) => {
      const sec = main.querySelector<HTMLElement>(`[data-ed-sec="${s.key}"]`); if (!sec) return;
      const b = h('div', 'ql-ed-seccion', `<b>${sec.dataset.edLabel || s.key}</b>`);
      const mk = (icono: string, tit: string, fn: () => void, off = false) => { const x = boton('ql-ed-ib', icono, tit); x.disabled = off; x.addEventListener('click', fn); b.append(x); };
      if (total > 1) {
        mk(svg.arriba, 'Subir sección', () => mover(i, -1), i === 0);
        mk(svg.abajo, 'Bajar sección', () => mover(i, 1), i === total - 1);
      }
      mk(s.hidden ? svg.ojo : svg.ojoNo, s.hidden ? 'Mostrar sección' : 'Ocultar sección', () => { s.hidden = !s.hidden; guardarLayout(); });
      const clasesBase = sec.dataset.edTpl ? ['seccion'] : (sec.dataset.edOrigClases ?? sec.className).split(/\s+/);
      if (admiteFondo(clasesBase)) mk(svg.pincel, 'Fondo de la sección', () => panelFondo(s, sec));
      mk(svg.mas, 'Agregar una sección debajo', () => panelAgregar(i));
      if (s.tpl) mk(svg.basura, 'Borrar esta sección', () => borrar(i));
      if (s.hidden) b.append(h('i', '', 'Oculta'));
      capa.append(b); chips.push({ el: b, ancla: sec, pos: 'seccion' });
    });
    ubicar();
  };
  const mover = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= secciones.length) return; [secciones[i], secciones[j]] = [secciones[j], secciones[i]]; guardarLayout(); };
  const guardarLayout = () => { aplicarSecciones(main, secciones, true, pagina); set(`layout__${pagina}`, 'sections', JSON.stringify(secciones)); barrasSeccion(); };

  /* qué controles se ven: los del elemento bajo el puntero/dedo, los del panel abierto, o todos con «Resaltar» */
  let px = -1, py = -1; let enPanel: HTMLElement | null = null;
  const contiene = (r: DOMRect, m = 0) => px >= r.left - m && px <= r.right + m && py >= r.top - m && py <= r.bottom + m;
  const ubicar = () => {
    const vh = innerHeight, cabecera = 96, guia = document.documentElement.classList.contains('ql-ed-guia');
    const vista = document.documentElement.classList.contains('ql-ed-previa');
    // la sección bajo el puntero (la más interna)
    let secActiva: HTMLElement | null = null;
    for (const c of chips) if (c.pos === 'seccion' && c.ancla.isConnected && contiene(c.ancla.getBoundingClientRect())) secActiva = c.ancla;
    for (const c of [...chips]) {
      if (!c.ancla.isConnected) { c.el.remove(); chips.splice(chips.indexOf(c), 1); continue; }
      const r = c.ancla.getBoundingClientRect();
      const enPantalla = r.bottom > 40 && r.top < vh - 60 && r.width > 0 && !c.ancla.closest('[aria-hidden]:not([aria-hidden="false"])') && getComputedStyle(c.ancla).visibility !== 'hidden';
      const fondo = c.pos === 'foto' && c.ancla.dataset.edFondo !== undefined;
      const cerca = c.pos === 'seccion' ? c.ancla === secActiva : fondo ? !!secActiva?.contains(c.ancla) : contiene(r, 12);
      const visible = !vista && enPantalla && (guia || cerca || enPanel === c.ancla);
      c.el.style.display = visible ? '' : 'none'; if (!visible) continue;
      if (c.pos === 'foto') { c.el.style.left = `${r.left + 8}px`; c.el.style.top = `${Math.min(r.bottom - 40, vh - 48)}px`; }
      else if (c.pos === 'enlace') { c.el.style.left = `${Math.max(8, r.right - c.el.offsetWidth)}px`; c.el.style.top = `${r.top - 30}px`; }
      else { c.el.style.left = `${Math.max(8, r.left + 16)}px`; c.el.style.top = `${Math.max(cabecera, r.top + 12)}px`; if (r.bottom < cabecera + 60) c.el.style.display = 'none'; }
    }
  };
  let tick = false; const pedirUbicar = () => { if (!tick) { tick = true; requestAnimationFrame(() => { ubicar(); tick = false; }); } };
  const seguir = (e: PointerEvent) => {
    // sobre la capa de controles, el panel o la barra se conserva lo que estaba activo
    if ((e.target as HTMLElement).closest('.ql-ed-capa, .ql-ed-panel, .ql-ed-barra, .ql-ed-formato')) return;
    px = e.clientX; py = e.clientY; pedirUbicar();
  };
  addEventListener('pointermove', seguir, { passive: true }); addEventListener('pointerdown', seguir, { passive: true });
  addEventListener('scroll', pedirUbicar, { passive: true }); addEventListener('resize', pedirUbicar);
  new ResizeObserver(pedirUbicar).observe(document.body);
  setInterval(ubicar, 800);

  /* ================= barra de formato (al seleccionar texto) ================= */
  const formato = h('div', 'ql-ed-formato'); formato.hidden = true; document.body.append(formato);
  const bNegrita = boton('ql-ed-fb', svg.negrita, 'Negrita (palabras clave)');
  const bCursiva = boton('ql-ed-fb', svg.cursiva, 'Destacado');
  const bEnlace = boton('ql-ed-fb', svg.enlace, 'Enlace');
  const bLimpiar = boton('ql-ed-fb', svg.limpiar, 'Quitar formato');
  const urlForm = h('form', 'ql-ed-fl') as HTMLFormElement; urlForm.hidden = true;
  const urlIn = h('input') as HTMLInputElement; urlIn.type = 'text'; urlIn.placeholder = 'https://… o /pagina/'; urlIn.setAttribute('aria-label', 'Dirección del enlace');
  const urlOk = boton('ql-ed-fb ql-ed-fb-ok', svg.check, 'Aplicar enlace'); urlOk.type = 'submit';
  urlForm.append(urlIn, urlOk);
  formato.append(bNegrita, bCursiva, bEnlace, bLimpiar, urlForm);
  let rangoGuardado: Range | null = null;
  const txtDeSeleccion = () => {
    const sel = getSelection(); if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    const n = sel.anchorNode, el = (n instanceof HTMLElement ? n : n?.parentElement)?.closest<HTMLElement>('.ql-ed-txt');
    const f = sel.focusNode, el2 = (f instanceof HTMLElement ? f : f?.parentElement)?.closest<HTMLElement>('.ql-ed-txt');
    return el && el === el2 ? el : null;
  };
  document.addEventListener('selectionchange', () => {
    if (formato.contains(document.activeElement)) return;
    const el = txtDeSeleccion(); if (!el) { formato.hidden = true; urlForm.hidden = true; return; }
    const r = getSelection()!.getRangeAt(0).getBoundingClientRect();
    bEnlace.hidden = !!el.closest('a'); // no se anidan enlaces dentro de botones
    formato.hidden = false;
    const w = formato.offsetWidth;
    formato.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    formato.style.top = `${r.top > 120 ? r.top - formato.offsetHeight - 8 : r.bottom + 8}px`;
  });
  const emitir = (el: HTMLElement) => set(el.dataset.ed!, 'content', limpiarHTML(el.innerHTML));
  const envolver = (tag: 'strong' | 'em') => {
    const el = txtDeSeleccion(); if (!el) return;
    const rango = getSelection()!.getRangeAt(0);
    const dentro = (rango.commonAncestorContainer instanceof HTMLElement ? rango.commonAncestorContainer : rango.commonAncestorContainer.parentElement)?.closest(tag === 'strong' ? 'strong, b' : 'em, i');
    if (dentro && el.contains(dentro) && dentro !== el) { dentro.replaceWith(...Array.from(dentro.childNodes)); emitir(el); }
    else document.execCommand('insertHTML', false, `<${tag}>${esc(rango.toString())}</${tag}>`);
    formato.hidden = true;
  };
  for (const [b, fn] of [[bNegrita, () => envolver('strong')], [bCursiva, () => envolver('em')], [bLimpiar, () => { const el = txtDeSeleccion(); if (el) document.execCommand('insertText', false, getSelection()!.toString()); }]] as const) {
    b.addEventListener('mousedown', (e) => e.preventDefault()); // conserva la selección
    b.addEventListener('click', fn);
  }
  bEnlace.addEventListener('mousedown', (e) => e.preventDefault());
  bEnlace.addEventListener('click', () => {
    const el = txtDeSeleccion(); if (!el) return;
    const sel = getSelection()!, a = (sel.anchorNode?.parentElement)?.closest('a');
    if (a && el.contains(a)) { a.replaceWith(...Array.from(a.childNodes)); emitir(el); formato.hidden = true; return; }
    rangoGuardado = sel.getRangeAt(0).cloneRange(); urlForm.hidden = false; urlIn.value = ''; urlIn.focus();
  });
  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = urlIn.value.trim();
    if (!/^(https?:\/\/|mailto:|tel:|\/)/.test(url)) { toast('El enlace debe empezar por https://, / (página del sitio), mailto: o tel:', true); return; }
    if (!rangoGuardado) return;
    const el = (rangoGuardado.commonAncestorContainer instanceof HTMLElement ? rangoGuardado.commonAncestorContainer : rangoGuardado.commonAncestorContainer.parentElement)?.closest<HTMLElement>('.ql-ed-txt');
    el?.focus(); const sel = getSelection()!; sel.removeAllRanges(); sel.addRange(rangoGuardado);
    const ext = /^https?:/.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
    document.execCommand('insertHTML', false, `<a href="${esc(url)}"${ext}>${esc(rangoGuardado.toString())}</a>`);
    urlForm.hidden = true; formato.hidden = true; rangoGuardado = null;
  });

  /* ================= panel lateral ================= */
  const panel = h('aside', 'ql-ed-panel'); panel.hidden = true; document.body.append(panel);
  const cerrarPanel = () => { panel.hidden = true; enPanel = null; pedirUbicar(); };
  const abrir = (titulo: string, cuerpo: HTMLElement, ancla: HTMLElement | null = null) => {
    panel.innerHTML = ''; const cab = h('div', 'ql-ed-panel-cab', `<b>${titulo}</b>`);
    const cerrar = boton('ql-ed-ib', svg.x, 'Cerrar'); cerrar.addEventListener('click', cerrarPanel);
    cab.append(cerrar); panel.append(cab, cuerpo); panel.hidden = false; enPanel = ancla; pedirUbicar();
  };

  function panelFoto(img: HTMLImageElement) {
    const id = img.dataset.edImg!;
    const orig = { src: img.dataset.edOrig || img.getAttribute('src') || '', alt: img.dataset.edOrigAlt ?? '' };
    const cuerpo = h('div', 'ql-ed-cuerpo');
    const vista = h('div', 'ql-ed-vista'); const pre = new Image(); pre.src = img.currentSrc || img.src; pre.alt = ''; vista.append(pre);
    const acciones = h('div', 'ql-ed-fila');
    const subir = h('label', 'ql-ed-btn ql-ed-btn-p', 'Subir foto'); const file = h('input') as HTMLInputElement; file.type = 'file'; file.accept = 'image/*'; file.hidden = true; subir.append(file);
    const original = boton('ql-ed-btn', 'Original');
    acciones.append(subir, original);
    const url = h('label', 'ql-ed-campo', '<span>O pega el enlace de una imagen</span>'); const urlFoto = h('input') as HTMLInputElement; urlFoto.type = 'url'; urlFoto.placeholder = 'https://…'; url.append(urlFoto);
    const alt = h('label', 'ql-ed-campo', '<span>Descripción (para accesibilidad y Google)</span>'); const altIn = h('input') as HTMLInputElement; altIn.type = 'text'; altIn.value = img.alt; altIn.maxLength = 140; alt.append(altIn);
    const posL = h('div', 'ql-ed-campo', '<span>Encuadre: qué parte de la foto se ve si se recorta</span>'); const grid = h('div', 'ql-ed-grid');
    const posiciones = ['left top', 'center top', 'right top', 'left center', 'center center', 'right center', 'left bottom', 'center bottom', 'right bottom'];
    const actual = img.style.objectPosition || 'center center';
    posiciones.forEach((p) => { const b = boton('ql-ed-pos' + (p === actual ? ' activa' : ''), '', p); b.addEventListener('click', () => { grid.querySelectorAll('.activa').forEach((x) => x.classList.remove('activa')); b.classList.add('activa'); img.style.objectPosition = p; set(id, 'pos', p); }); grid.append(b); });
    posL.append(grid);
    const nota = h('p', 'ql-ed-nota', 'Las fotos se optimizan automáticamente (WebP, máx. 1600 px). Se ven en el sitio cuando publiques.');
    cuerpo.append(vista, acciones, url, alt, posL, nota);

    const poner = (src: string) => { img.removeAttribute('srcset'); img.src = src; pre.src = src; set(id, 'content', src); pedirUbicar(); };
    file.addEventListener('change', async () => { const f = file.files?.[0]; if (!f) return; subir.textContent = 'Optimizando…'; try { poner(await comprimir(f)); toast('Foto lista. Recuerda publicar.'); } catch { toast('No se pudo procesar esa imagen.', true); } subir.textContent = 'Subir foto'; subir.append(file); });
    urlFoto.addEventListener('change', () => { if (urlFoto.value.startsWith('http')) poner(urlFoto.value.trim()); });
    altIn.addEventListener('input', () => { img.alt = altIn.value; set(id, 'alt', altIn.value, true); });
    original.addEventListener('click', () => { img.removeAttribute('srcset'); img.src = orig.src; pre.src = orig.src; img.alt = orig.alt; altIn.value = orig.alt; img.style.objectPosition = ''; grid.querySelectorAll('.activa').forEach((x) => x.classList.remove('activa')); pendientes.set(`${id}#alt`, ''); pendientes.set(`${id}#pos`, ''); set(id, 'content', ''); });
    abrir(img.dataset.edFondo !== undefined ? 'Foto de fondo' : 'Cambiar foto', cuerpo, img);
  }

  function panelEnlace(a: HTMLAnchorElement) {
    const id = a.dataset.edLink!;
    const href = a.getAttribute('href') || '';
    const cuerpo = h('div', 'ql-ed-cuerpo');
    const tipoL = h('label', 'ql-ed-campo', '<span>¿A dónde lleva este botón?</span>'); const tipo = h('select') as HTMLSelectElement;
    [['pagina', 'Una página de este sitio'], ['whatsapp', 'WhatsApp'], ['web', 'Otro sitio web'], ['correo', 'Un correo'], ['tel', 'Un teléfono']].forEach(([v, t]) => tipo.append(new Option(t, v)));
    tipoL.append(tipo);
    const det = h('div');
    const pagL = h('label', 'ql-ed-campo', '<span>Página</span>'); const pag = h('select') as HTMLSelectElement; PAGINAS.forEach((p) => pag.append(new Option(p.nombre, p.url))); pagL.append(pag);
    const numL = h('label', 'ql-ed-campo', '<span>Número de WhatsApp (con indicativo, sin +)</span>'); const num = h('input') as HTMLInputElement; num.type = 'tel'; num.value = WHATSAPP; numL.append(num);
    const msgL = h('label', 'ql-ed-campo', '<span>Mensaje que llega escrito</span>'); const msg = h('input') as HTMLInputElement; msg.type = 'text'; msg.value = 'Hola Quimiolab, quisiera información sobre '; msgL.append(msg);
    const webL = h('label', 'ql-ed-campo', '<span>Dirección completa</span>'); const web = h('input') as HTMLInputElement; web.type = 'url'; web.placeholder = 'https://…'; webL.append(web);
    const mailL = h('label', 'ql-ed-campo', '<span>Correo</span>'); const mail = h('input') as HTMLInputElement; mail.type = 'email'; mailL.append(mail);
    const telL = h('label', 'ql-ed-campo', '<span>Teléfono</span>'); const tel = h('input') as HTMLInputElement; tel.type = 'tel'; telL.append(tel);
    const actual = h('p', 'ql-ed-nota', `Ahora lleva a: <code>${esc(href)}</code>`);
    const aplicarBtn = boton('ql-ed-btn ql-ed-btn-p', 'Aplicar destino');
    if (href.startsWith('https://wa.me/')) { tipo.value = 'whatsapp'; const u = new URL(href); num.value = u.pathname.slice(1); msg.value = decodeURIComponent(u.searchParams.get('text') || ''); }
    else if (href.startsWith('mailto:')) { tipo.value = 'correo'; mail.value = href.slice(7); }
    else if (href.startsWith('tel:')) { tipo.value = 'tel'; tel.value = href.slice(4); }
    else if (/^https?:/.test(href)) { tipo.value = 'web'; web.value = href; }
    else { tipo.value = 'pagina'; pag.value = PAGINAS.some((p) => p.url === href) ? href : '/'; }
    const pintar = () => { det.innerHTML = ''; det.append(...({ pagina: [pagL], whatsapp: [numL, msgL], web: [webL], correo: [mailL], tel: [telL] } as Record<string, HTMLElement[]>)[tipo.value]); };
    tipo.addEventListener('change', pintar); pintar();
    aplicarBtn.addEventListener('click', () => {
      let nuevo = '';
      if (tipo.value === 'pagina') nuevo = pag.value;
      if (tipo.value === 'whatsapp') nuevo = `https://wa.me/${num.value.replace(/\D/g, '')}?text=${encodeURIComponent(msg.value)}`;
      if (tipo.value === 'web') nuevo = web.value.trim();
      if (tipo.value === 'correo') nuevo = `mailto:${mail.value.trim()}`;
      if (tipo.value === 'tel') nuevo = `tel:${tel.value.replace(/[^\d+]/g, '')}`;
      if (!nuevo || (tipo.value === 'web' && !/^https?:\/\//.test(nuevo))) { toast('Revisa el destino: falta el dato o no es válido.', true); return; }
      aplicarEnlace(a, nuevo); set(id, 'href', nuevo); actual.innerHTML = `Ahora lleva a: <code>${esc(nuevo)}</code>`; toast('Destino cambiado. Recuerda publicar.');
    });
    cuerpo.append(tipoL, det, aplicarBtn, actual);
    abrir('Destino del botón', cuerpo, a);
  }

  function panelFondo(s: Seccion, sec: HTMLElement) {
    const cuerpo = h('div', 'ql-ed-cuerpo');
    const pinta = () => {
      cuerpo.innerHTML = '';
      const fondos = h('div', 'ql-ed-fondos');
      const opcion = (nombre: string, muestra: string, activo: boolean, fn: () => void) => { const b = boton('ql-ed-fondo' + (activo ? ' activa' : ''), `<i style="background:${muestra}"></i><span>${nombre}</span>`); b.addEventListener('click', () => { fn(); guardarLayout(); pinta(); }); return b; };
      if (!s.tpl) fondos.append(opcion('Como el diseño', 'repeating-linear-gradient(45deg,#e5ecf5 0 6px,#fff 6px 12px)', !s.bg, () => delete s.bg));
      FONDOS.forEach((f) => fondos.append(opcion(f.nombre, f.muestra, s.bg === f.id || (!!s.tpl && !s.bg && f.id === 'blanco'), () => (s.bg = f.id))));
      const pats = h('div', 'ql-ed-fila ql-ed-chips');
      const pat = (id: string | undefined, nombre: string, activo: boolean) => { const b = boton('ql-ed-btn' + (activo ? ' ql-ed-btn-p' : ''), nombre); b.addEventListener('click', () => { if (id) s.patron = id; else delete s.patron; guardarLayout(); pinta(); }); pats.append(b); };
      if (!s.tpl) pat(undefined, 'Como el diseño', !s.patron);
      PATRONES.forEach((p) => pat(p.id, p.nombre, s.patron === p.id || (!!s.tpl && !s.patron && p.id === 'ninguno')));
      cuerpo.append(h('p', 'ql-ed-campo', '<span>Color de fondo</span>'), fondos, h('p', 'ql-ed-campo', '<span>Patrón (uno por sección; se ve suave sobre el fondo)</span>'), pats, h('p', 'ql-ed-nota', 'Solo colores y patrones del manual de marca, para que el sitio no pierda coherencia.'));
    };
    pinta();
    abrir(`Fondo · ${sec.dataset.edLabel || s.key}`, cuerpo, sec);
  }

  function panelAgregar(i: number) {
    const cuerpo = h('div', 'ql-ed-cuerpo');
    cuerpo.append(h('p', 'ql-ed-nota', 'Elige el tipo de sección. Aparece debajo con textos de ejemplo que luego cambias como cualquier otro.'));
    const lista = h('div', 'ql-ed-plantillas');
    PLANTILLAS.forEach((t) => {
      const b = boton('ql-ed-plantilla', `<b>${t.nombre}</b><span>${t.descripcion}</span>`);
      b.addEventListener('click', () => {
        const s: Seccion = { key: nuevaKey(), tpl: t.id, ...(t.bg ? { bg: t.bg } : {}) };
        const tmp = document.createElement('template'); tmp.innerHTML = htmlPlantilla(pagina, s);
        const nodo = tmp.content.firstElementChild as HTMLElement;
        const ref = main.querySelector<HTMLElement>(`[data-ed-sec="${secciones[i].key}"]`);
        (ref ?? main.lastElementChild!).after(nodo);
        secciones.splice(i + 1, 0, s);
        activar(nodo);
        // los textos de ejemplo se guardan para que la sección quede igual al publicar
        nodo.querySelectorAll<HTMLElement>('[data-ed]').forEach((el) => pendientes.set(`${el.dataset.ed}#content`, el.innerHTML.trim()));
        guardarLayout(); cerrarPanel();
        nodo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast(`Sección «${t.nombre}» agregada. Cambia sus textos y publica.`);
      });
      lista.append(b);
    });
    cuerpo.append(lista);
    abrir('Agregar sección', cuerpo);
  }

  function borrar(i: number) {
    const s = secciones[i];
    const sec = main.querySelector<HTMLElement>(`[data-ed-sec="${s.key}"]`);
    if (!confirm(`¿Borrar la sección «${sec?.dataset.edLabel || 'agregada'}»? Se quita del sitio al publicar (puedes deshacerlo).`)) return;
    secciones.splice(i, 1);
    for (const k of [...pendientes.keys()]) if (k.startsWith(`${pagina}_${s.key}_`)) pendientes.delete(k);
    guardarLayout(); cerrarPanel(); toast('Sección borrada. Publica para que se quite del sitio.');
  }

  /* ================= historial de versiones publicadas ================= */
  async function panelHistorial() {
    const cuerpo = h('div', 'ql-ed-cuerpo', '<p class="ql-ed-nota">Cargando versiones…</p>');
    abrir('Historial', cuerpo);
    let versiones: { id: string; at: number; by: string; cambios: number; docs: string }[] = [];
    try {
      if (!demo) {
        const snap = await getDocs(query(collection(db, VERSIONES), where('page', '==', pagina)));
        versiones = snap.docs.map((d) => { const x = d.data(); return { id: d.id, at: x.at?.toMillis?.() ?? 0, by: x.by || '', cambios: x.cambios || 0, docs: x.docs || '{}' }; }).sort((a, b) => b.at - a.at).slice(0, 30);
      }
    } catch (e) { console.error(e); cuerpo.innerHTML = '<p class="ql-ed-nota">No se pudo leer el historial. Revisa tu conexión.</p>'; return; }
    cuerpo.innerHTML = '';
    cuerpo.append(h('p', 'ql-ed-nota', 'Cada vez que alguien publica queda una versión. Al cargar una, se abre como <b>borrador</b>: revísala y publica para que quede en el sitio.'));
    const lista = h('div', 'ql-ed-versiones');
    const cargar = (docs: Contenido | null, nombre: string) => {
      if ((pendientes.size || JSON.stringify(secciones) !== JSON.stringify(seccionesPublicadas())) && !confirm('Tienes cambios sin publicar. ¿Reemplazarlos por esta versión?')) return;
      const nuevo = new Map<string, string>();
      const ids = new Set([...Object.keys(publicado), ...Object.keys(docs || {})].filter((k) => !k.startsWith('layout__')));
      for (const id of ids) for (const campo of ['content', 'href', 'alt', 'pos'] as const) {
        const meta = docs?.[id]?.[campo] ?? null, hoy = publicado[id]?.[campo] ?? null;
        if (meta !== hoy) nuevo.set(`${id}#${campo}`, meta ?? '');
      }
      const s = reconciliar(safeJSON(docs?.[`layout__${pagina}`]?.sections), keysCodigo(main));
      if (JSON.stringify(s) !== JSON.stringify(seccionesPublicadas())) nuevo.set(`layout__${pagina}#sections`, JSON.stringify(s));
      pintarEstado({ p: [...nuevo], s }); registrar(); guardarLuego();
      toast(`${nombre} cargada como borrador. Revisa y publica.`);
    };
    versiones.forEach((v, i) => {
      const fecha = v.at ? new Date(v.at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';
      const fila = h('div', 'ql-ed-version', `<div><b>${fecha}</b><span>${esc(v.by)} · ${v.cambios} cambio${v.cambios === 1 ? '' : 's'}${i === 0 ? ' · <em>en el sitio</em>' : ''}</span></div>`);
      if (i > 0) { const b = boton('ql-ed-btn', 'Cargar'); b.addEventListener('click', () => cargar(safeJSON(v.docs), 'Versión')); fila.append(b); }
      lista.append(fila);
    });
    if (!versiones.length) lista.append(h('p', 'ql-ed-nota', demo ? 'Modo demo: aquí aparecen las versiones publicadas.' : 'Aún no hay versiones: la primera se guarda cuando publiques.'));
    const original = boton('ql-ed-btn', 'Volver al diseño original'); original.addEventListener('click', () => cargar(null, 'El diseño original'));
    cuerpo.append(lista, h('p', 'ql-ed-campo', '<span>Empezar de cero</span>'), original, h('p', 'ql-ed-nota', 'Carga los textos, fotos y secciones tal como los entregó Braindy (las secciones agregadas se quitan).'));
  }

  /* ================= vista previa (escritorio / celular) ================= */
  function vistaPrevia() {
    clearTimeout(guardado); guardarBorrador(pagina, { t: Date.now(), ...foto() });
    document.documentElement.classList.add('ql-ed-previa'); pedirUbicar();
    const velo = h('div', 'ql-ed-previa-velo');
    const barra = h('div', 'ql-ed-previa-barra', '<b>Vista previa</b><span>Así se verá al publicar</span>');
    const esc_ = boton('ql-ed-btn ql-ed-btn-p', `${svg.vista}<span>Escritorio</span>`);
    const cel = boton('ql-ed-btn', `${svg.movil}<span>Celular</span>`);
    const cerrar = boton('ql-ed-btn', `${svg.x}<span>Volver a editar</span>`);
    const marco = h('div', 'ql-ed-previa-marco');
    const iframe = h('iframe') as HTMLIFrameElement; iframe.title = 'Vista previa del borrador'; iframe.src = `${location.pathname}?borrador=1`;
    marco.append(iframe);
    const modo = (m: 'escritorio' | 'celular') => { marco.classList.toggle('celular', m === 'celular'); esc_.classList.toggle('ql-ed-btn-p', m === 'escritorio'); cel.classList.toggle('ql-ed-btn-p', m === 'celular'); };
    esc_.addEventListener('click', () => modo('escritorio')); cel.addEventListener('click', () => modo('celular'));
    const salir = () => { velo.remove(); document.documentElement.classList.remove('ql-ed-previa'); removeEventListener('keydown', teclaEsc); pedirUbicar(); };
    const teclaEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') salir(); };
    cerrar.addEventListener('click', salir); addEventListener('keydown', teclaEsc);
    const grupo = h('div', 'ql-ed-fila'); grupo.append(esc_, cel, cerrar); barra.append(grupo);
    velo.append(barra, marco); document.body.append(velo);
    if (innerWidth < 700) modo('celular');
  }

  /* ================= barra de edición ================= */
  const barra = h('div', 'ql-ed-barra');
  const info = h('div', 'ql-ed-info'); barra.append(info);
  const acciones = h('div', 'ql-ed-acciones');
  const bDeshacer = boton('ql-ed-ib', svg.deshacer, 'Deshacer (Ctrl+Z)');
  const bRehacer = boton('ql-ed-ib', svg.rehacer, 'Rehacer (Ctrl+Shift+Z)');
  const bResaltar = boton('ql-ed-ib', svg.resaltar, 'Resaltar todo lo editable');
  const bHistorial = boton('ql-ed-ib', svg.reloj, 'Historial de versiones');
  const bVista = boton('ql-ed-btn ql-ed-btn-vista', `${svg.vista}<span>Vista previa</span>`, 'Vista previa en escritorio y celular');
  const ayuda = boton('ql-ed-ib', '<b>?</b>', 'Ver el recorrido: cómo editar');
  const descartar = boton('ql-ed-btn ql-ed-btn-sec', 'Descartar');
  const publicar = boton('ql-ed-btn ql-ed-btn-p', `${svg.check}<span>Publicar</span>`);
  const salir = boton('ql-ed-ib', svg.x, 'Salir del modo edición');
  const sep = () => h('span', 'ql-ed-sep');
  bDeshacer.dataset.tour = 'deshacer'; bResaltar.dataset.tour = 'resaltar'; bHistorial.dataset.tour = 'historial'; bVista.dataset.tour = 'vista'; publicar.dataset.tour = 'publicar';
  acciones.append(bDeshacer, bRehacer, sep(), bResaltar, bHistorial, ayuda, sep(), bVista, descartar, publicar, salir); barra.append(acciones); document.body.append(barra);
  let guardadoEn = 0;
  const refrescarBarra = (recienGuardado = false) => {
    if (recienGuardado) guardadoEn = Date.now();
    const n = pendientes.size;
    const estado = n ? `${n} cambio${n === 1 ? '' : 's'} sin publicar` : 'Sin cambios';
    info.innerHTML = `${svg.lapiz}<span>Editando <b>${nombrePagina(pagina)}</b></span><em>${estado}${n && guardadoEn ? ' · borrador guardado' : ''}</em>`;
    publicar.disabled = !n; descartar.disabled = !n;
    bDeshacer.disabled = pos <= 0 && !tecleo; bRehacer.disabled = pos >= historia.length - 1;
  };
  bDeshacer.addEventListener('click', deshacer); bRehacer.addEventListener('click', rehacer);
  bResaltar.addEventListener('click', () => { const on = document.documentElement.classList.toggle('ql-ed-guia'); bResaltar.classList.toggle('activo', on); bResaltar.setAttribute('aria-pressed', String(on)); ubicar(); });
  bHistorial.addEventListener('click', () => { panelHistorial(); });
  bVista.addEventListener('click', vistaPrevia);
  ayuda.addEventListener('click', () => recorrido());
  descartar.addEventListener('click', () => {
    if (!confirm('¿Descartar todos los cambios sin publicar? (El borrador se borra.)')) return;
    borrarBorrador(pagina); pintarEstado({ p: [], s: seccionesPublicadas() }); registrar(); toast('Cambios descartados.');
  });
  salir.addEventListener('click', () => {
    clearTimeout(guardado); if (pendientes.size) guardarBorrador(pagina, { t: Date.now(), ...foto() });
    location.href = location.pathname;
  });
  // atajos: deshacer/rehacer propios (el del navegador no conoce fotos, botones ni secciones)
  addEventListener('keydown', (e) => {
    if (document.documentElement.classList.contains('ql-ed-previa')) return;
    const mod = e.ctrlKey || e.metaKey; if (!mod) return;
    const k = e.key.toLowerCase();
    if ((target(e) as HTMLElement).closest('.ql-ed-panel input, .ql-ed-panel select, .ql-ed-formato input')) return; // dentro de un campo del panel, el del navegador
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); deshacer(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); rehacer(); }
  }, true);

  publicar.addEventListener('click', async () => {
    if (tecleo) registrar();
    if (!pendientes.size) return;
    const porDoc: Record<string, Record<string, string | null>> = {};
    for (const [k, v] of pendientes) { const [id, campo] = k.split('#'); (porDoc[id] ||= {})[campo] = v === '' ? null : v; }
    if (Object.values(porDoc).some((d) => (d.content || '').length > 900_000)) { toast('Una foto es demasiado pesada. Súbela de nuevo desde «Cambiar foto».', true); return; }
    publicar.disabled = true; publicar.querySelector('span')!.textContent = 'Publicando…';
    try {
      if (demo) { await new Promise((r) => setTimeout(r, 600)); throw new Error('demo'); }
      const batch = writeBatch(db);
      for (const [id, campos] of Object.entries(porDoc)) batch.set(doc(db, COLECCION, id), { ...campos, page: pagina, updatedAt: serverTimestamp(), updatedBy: user.email || user.uid }, { merge: true });
      await batch.commit();
      for (const [id, campos] of Object.entries(porDoc)) publicado[id] = { ...(publicado[id] || {}), ...campos, page: pagina } as any;
      guardarCache(pagina, publicado);
      // versión completa de la página para el historial (sin fotos subidas si no cabe en un documento)
      try {
        let docs = JSON.stringify(publicado);
        if (docs.length > 900_000) { const ligero: Contenido = {}; for (const [k, v] of Object.entries(publicado)) ligero[k] = v.content?.startsWith('data:') ? { ...v, content: undefined } : v; docs = JSON.stringify(ligero); }
        await setDoc(doc(db, VERSIONES, `${pagina}__${Date.now()}`), { page: pagina, at: serverTimestamp(), by: user.email || user.uid, cambios: Object.keys(porDoc).length, docs });
      } catch (e) { console.warn('No se guardó la versión en el historial', e); }
      pendientes.clear(); borrarBorrador(pagina); capturarBase(main, true);
      historia.length = 0; pos = -1; registrar();
      toast('¡Listo! Los cambios ya están publicados.');
    } catch (e: any) {
      if (e?.message === 'demo') toast('Modo demo: aquí se publicaría en Firestore.', true);
      else { console.error(e); toast('No se pudo publicar. Revisa tu conexión y que tu cuenta esté autorizada.', true); }
    } finally { publicar.querySelector('span')!.textContent = 'Publicar'; refrescarBarra(); }
  });

  /* ================= arranque ================= */
  activar(main);
  barrasSeccion();
  const borrador = leerBorrador(pagina);
  if (borrador && (borrador.p.length || JSON.stringify(borrador.s) !== JSON.stringify(secciones))) {
    registrar(); // primer paso del historial = lo publicado, para poder deshacer el borrador
    pintarEstado({ p: borrador.p, s: reconciliar(borrador.s, keysCodigo(main)) });
    const cuando = new Date(borrador.t).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
    toast(`Recuperamos tu borrador del ${cuando} (${borrador.p.length} cambio${borrador.p.length === 1 ? '' : 's'} sin publicar).`);
  }
  registrar(); refrescarBarra();
  // al entrar se resaltan un momento los elementos editables, para que se entienda qué se puede tocar
  document.documentElement.classList.add('ql-ed-guia'); ubicar();
  const quitarGuia = () => { if (!bResaltar.classList.contains('activo') && !document.querySelector('.tg-tour')) { document.documentElement.classList.remove('ql-ed-guia'); ubicar(); } };
  setTimeout(quitarGuia, 2200);

  /* recorrido guiado: se abre solo la primera vez (o con ?tour=1) y con el botón «?» */
  function recorrido() {
    cerrarPanel();
    // marca los elementos de esta página que explica el recorrido
    main.querySelectorAll('[data-tour]').forEach((x) => x.removeAttribute('data-tour'));
    main.querySelector('[data-ed]')?.setAttribute('data-tour', 'texto');
    Array.from(main.querySelectorAll('[data-ed-img]:not([data-ed-fondo])')).find((i) => getComputedStyle(i).visibility !== 'hidden')?.setAttribute('data-tour', 'foto');
    main.querySelector('[data-ed-link]')?.setAttribute('data-tour', 'boton');
    chips.forEach((c) => delete c.el.dataset.tour);
    const barra = chips.find((c) => c.pos === 'seccion' && c.el.querySelector('[title="Fondo de la sección"]')) || chips.find((c) => c.pos === 'seccion');
    if (barra) barra.el.dataset.tour = 'seccion';
    const seccion = () => { if (!barra) return; barra.ancla.scrollIntoView({ block: 'start' }); scrollBy(0, -110); ubicar(); };
    abrirRecorrido('editor', pasosEditor({ seccion }), {
      antes: () => { document.documentElement.classList.add('ql-ed-guia'); ubicar(); }, // durante el recorrido se ve todo lo editable
      alCerrar: () => { setTimeout(quitarGuia, 300); scrollTo({ top: 0 }); },
    });
  }
  if (tocaRecorrido('editor')) setTimeout(recorrido, 900);
}

/* ---------- utilidades ---------- */
const nombrePagina = (p: string) => ({ home: 'la página de inicio', nosotros: 'Nosotros', contactenos: 'Contáctenos' } as Record<string, string>)[p] || p;
const safeJSON = (s: unknown) => { try { return typeof s === 'string' ? JSON.parse(s) : null; } catch { return null; } };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const target = (e: Event) => (e.target instanceof Element ? e.target : document.body);
/** HTML que se guarda: negritas como <strong>, destacados como <em>, sin estilos ni spans que mete el navegador. */
function limpiarHTML(html: string) {
  return html.trim()
    .replace(/<b(\s[^>]*)?>/gi, '<strong>').replace(/<\/b>/gi, '</strong>')
    .replace(/<i(\s[^>]*)?>/gi, '<em>').replace(/<\/i>/gi, '</em>')
    .replace(/<span[^>]*>|<\/span>/gi, '')
    .replace(/\s(style|class)="[^"]*"/gi, '')
    .replace(/\sdata-astro-[\w-]+(="[^"]*")?/gi, '');
}

function montarToast() {
  const c = h('div', 'ql-ed-toasts'); c.setAttribute('role', 'status'); document.body.append(c);
  return (msg: string, error = false) => { const t = h('div', 'ql-ed-toast' + (error ? ' error' : ''), msg); c.append(t); setTimeout(() => t.classList.add('ver'), 10); setTimeout(() => { t.classList.remove('ver'); setTimeout(() => t.remove(), 300); }, error ? 6000 : 4000); };
}
function tarjeta(titulo: string, html: string, botones: { texto: string; fn: () => void; primario?: boolean }[] = []) {
  quitarTarjeta();
  const fondo = h('div', 'ql-ed-velo'); const t = h('div', 'ql-ed-tarjeta', `<h2>${titulo}</h2>${html}`);
  const fila = h('div', 'ql-ed-fila');
  botones.forEach((b) => { const x = boton('ql-ed-btn' + (b.primario ? ' ql-ed-btn-p' : ''), b.texto); x.addEventListener('click', b.fn); fila.append(x); });
  const volver = h('a', 'ql-ed-btn', 'Ver el sitio'); volver.setAttribute('href', location.pathname); fila.append(volver);
  t.append(fila); fondo.append(t); document.body.append(fondo);
}
function quitarTarjeta() { document.querySelector('.ql-ed-velo')?.remove(); }
function pedirIngreso(auth: ReturnType<typeof getAuth>) {
  tarjeta('Editar esta página', `<p>Entra con tu cuenta de Google autorizada. Verás el sitio tal cual y podrás tocar lo que quieras cambiar.</p><p class="ql-ed-nota">¿Primera vez? <a href="${GUIA}">Mira cómo entrar y editar, paso a paso</a>.</p>`, [{ texto: `${svg.google} Entrar con Google`, primario: true, fn: () => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => alert('No se pudo iniciar sesión: ' + (e?.message || e))) }]);
}

/** Convierte una foto a WebP y la reduce hasta caber en un documento de Firestore. */
async function comprimir(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  let escala = Math.min(1, FOTO_ANCHO_MAX / bmp.width), calidad = 0.82, data = '';
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    data = c.toDataURL('image/webp', calidad); if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', calidad);
    if (data.length * 0.75 <= FOTO_BYTES_MAX) break;
    if (calidad > 0.55) calidad -= 0.1; else escala *= 0.8;
  }
  bmp.close();
  return data;
}
