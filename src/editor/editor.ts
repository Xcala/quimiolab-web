/**
 * Modo edición (?edit): el administrador entra con Google, toca lo que quiere cambiar y publica.
 * Se carga solo en modo edición; los visitantes nunca descargan Firebase.
 *
 * Qué se edita: textos [data-ed], fotos [data-ed-img], destinos de botones [data-ed-link]
 * y orden/visibilidad de secciones [data-ed-sec]. Todo queda pendiente en memoria hasta «Publicar»
 * (un solo batch en Firestore). «Descartar» vuelve a lo publicado.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getFirestore, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import './editor.css';
import { firebaseConfig, ADMINS, COLECCION, PAGINAS, WHATSAPP, FOTO_ANCHO_MAX, FOTO_BYTES_MAX } from './config';
import { pedirPagina, aplicar, aplicarSecciones, aplicarEnlace, reconciliar, limpiarCache, guardarCache, type Contenido, type Seccion } from './contenido';

type Campo = 'content' | 'href' | 'alt' | 'pos' | 'sections';
const h = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const svg = {
  lapiz: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  foto: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  enlace: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>',
  arriba: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  abajo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  ojo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  ojoNo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.5 10.5 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 5.1-5.9"/><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2"/><path d="m2 2 20 20"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
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
  if (demo) { arrancar({ email: 'demo@braindy.co', uid: 'demo' } as User).catch(console.error); return; }

  onAuthStateChanged(auth, (user) => {
    if (!user) { pedirIngreso(auth); return; }
    const correo = (user.email || '').toLowerCase();
    if (!ADMINS.map((a) => a.toLowerCase()).includes(correo)) {
      tarjeta('Esta cuenta no puede editar', `<p>Entraste como <b>${correo}</b>, que no está en la lista de personas autorizadas. Pide a Braindy que la agregue.</p>`, [{ texto: 'Salir', fn: () => signOut(auth).then(() => location.href = location.pathname) }]);
      return;
    }
    if (arrancado) return; arrancado = true;
    quitarTarjeta();
    arrancar(user).catch((e) => { console.error(e); toast('No se pudo cargar el contenido publicado. Revisa las reglas de Firestore.', true); });
  });

  async function arrancar(user: User) {
    limpiarCache();
    let publicado: Contenido = {};
    try { publicado = await pedirPagina(pagina); } catch (e) { console.warn('Sin contenido publicado aún', e); }
    aplicar(main, pagina, publicado, true);

    /* ---------- estado ---------- */
    const pendientes = new Map<string, string>();
    const set = (id: string, campo: Campo, valor: string) => { pendientes.set(`${id}#${campo}`, valor); refrescarBarra(); };
    const keys = () => Array.from(main.querySelectorAll<HTMLElement>('[data-ed-sec]')).map((s) => s.dataset.edSec!);
    let secciones: Seccion[] = reconciliar(safeJSON(publicado[`layout__${pagina}`]?.sections), keys());

    /* ---------- textos ---------- */
    main.querySelectorAll<HTMLElement>('[data-ed]').forEach((el) => {
      el.contentEditable = 'true'; el.spellcheck = true; el.classList.add('ql-ed-txt');
      el.setAttribute('aria-label', 'Texto editable');
      el.addEventListener('input', () => set(el.dataset.ed!, 'content', el.innerHTML.trim()));
      el.addEventListener('keydown', (e) => {
        const bloque = /^(P|DIV|LI|BLOCKQUOTE)$/.test(el.tagName);
        if (e.key === 'Enter') { if (!bloque || e.shiftKey) { e.preventDefault(); if (bloque) document.execCommand('insertLineBreak'); } }
        if (e.key === 'Escape') el.blur();
      });
      el.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') || ''); });
    });
    // En modo edición los enlaces no navegan: tocar un botón es para editarlo
    main.addEventListener('click', (e) => { const a = (e.target as HTMLElement).closest('a'); if (a) e.preventDefault(); const f = (e.target as HTMLElement).closest('form'); if (f) e.preventDefault(); }, true);
    main.addEventListener('submit', (e) => e.preventDefault(), true);

    /* ---------- capa de chips (fotos, destinos, secciones) ---------- */
    const capa = h('div', 'ql-ed-capa'); document.body.append(capa);
    type Chip = { el: HTMLElement; ancla: HTMLElement; pos: 'foto' | 'enlace' | 'seccion' };
    const chips: Chip[] = [];

    main.querySelectorAll<HTMLImageElement>('[data-ed-img]').forEach((img) => {
      const c = h('button', 'ql-ed-chip', `${svg.foto}<span>Cambiar foto</span>`); c.type = 'button';
      c.addEventListener('click', () => panelFoto(img));
      capa.append(c); chips.push({ el: c, ancla: img, pos: 'foto' });
    });
    main.querySelectorAll<HTMLAnchorElement>('[data-ed-link]').forEach((a) => {
      const c = h('button', 'ql-ed-chip ql-ed-chip-enlace', `${svg.enlace}<span>Destino</span>`); c.type = 'button';
      c.addEventListener('click', () => panelEnlace(a));
      capa.append(c); chips.push({ el: c, ancla: a, pos: 'enlace' });
    });
    const barrasSeccion = () => {
      chips.filter((c) => c.pos === 'seccion').forEach((c) => { c.el.remove(); chips.splice(chips.indexOf(c), 1); });
      const total = secciones.length; if (total < 2) return;
      secciones.forEach((s, i) => {
        const sec = main.querySelector<HTMLElement>(`[data-ed-sec="${s.key}"]`); if (!sec) return;
        const b = h('div', 'ql-ed-seccion');
        b.innerHTML = `<b>${sec.dataset.edLabel || s.key}</b>`;
        const mk = (ic: string, tit: string, fn: () => void, off = false) => { const x = h('button', 'ql-ed-ib', ic); x.type = 'button'; x.title = tit; x.setAttribute('aria-label', tit); x.disabled = off; x.addEventListener('click', fn); b.append(x); };
        mk(svg.arriba, 'Subir sección', () => mover(i, -1), i === 0);
        mk(svg.abajo, 'Bajar sección', () => mover(i, 1), i === total - 1);
        mk(s.hidden ? svg.ojo : svg.ojoNo, s.hidden ? 'Mostrar sección' : 'Ocultar sección', () => { s.hidden = !s.hidden; guardarLayout(); });
        if (s.hidden) b.append(h('i', '', 'Oculta'));
        capa.append(b); chips.push({ el: b, ancla: sec, pos: 'seccion' });
      });
      ubicar();
    };
    const mover = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= secciones.length) return; [secciones[i], secciones[j]] = [secciones[j], secciones[i]]; guardarLayout(); };
    const guardarLayout = () => { aplicarSecciones(main, secciones, true); set(`layout__${pagina}`, 'sections', JSON.stringify(secciones)); barrasSeccion(); };

    const ubicar = () => {
      const vh = innerHeight, cabecera = 96;
      for (const c of chips) {
        const r = c.ancla.getBoundingClientRect();
        const visible = r.bottom > 40 && r.top < vh - 60 && r.width > 0;
        c.el.style.display = visible ? '' : 'none'; if (!visible) continue;
        if (c.pos === 'foto') { c.el.style.left = `${r.left + 8}px`; c.el.style.top = `${Math.min(r.bottom - 40, vh - 48)}px`; }
        else if (c.pos === 'enlace') { c.el.style.left = `${Math.max(8, r.right - c.el.offsetWidth)}px`; c.el.style.top = `${r.top - 30}px`; }
        else { c.el.style.left = `${Math.max(8, r.left + 16)}px`; c.el.style.top = `${Math.max(cabecera, r.top + 12)}px`; if (r.bottom < cabecera + 60) c.el.style.display = 'none'; }
      }
    };
    let tick = false; const pedirUbicar = () => { if (!tick) { tick = true; requestAnimationFrame(() => { ubicar(); tick = false; }); } };
    addEventListener('scroll', pedirUbicar, { passive: true }); addEventListener('resize', pedirUbicar);
    new ResizeObserver(pedirUbicar).observe(document.body);
    setInterval(ubicar, 800);
    barrasSeccion(); ubicar();

    /* ---------- panel lateral ---------- */
    const panel = h('aside', 'ql-ed-panel'); panel.hidden = true; document.body.append(panel);
    const abrir = (titulo: string, cuerpo: HTMLElement) => { panel.innerHTML = ''; const cab = h('div', 'ql-ed-panel-cab', `<b>${titulo}</b>`); const cerrar = h('button', 'ql-ed-ib', svg.x); cerrar.type = 'button'; cerrar.setAttribute('aria-label', 'Cerrar'); cerrar.addEventListener('click', () => (panel.hidden = true)); cab.append(cerrar); panel.append(cab, cuerpo); panel.hidden = false; };

    function panelFoto(img: HTMLImageElement) {
      const id = img.dataset.edImg!;
      const orig = { src: img.dataset.edOrig || img.getAttribute('src') || '', alt: img.dataset.edOrigAlt ?? '' };
      const cuerpo = h('div', 'ql-ed-cuerpo');
      const vista = h('div', 'ql-ed-vista'); const pre = new Image(); pre.src = img.currentSrc || img.src; pre.alt = ''; vista.append(pre);
      const acciones = h('div', 'ql-ed-fila');
      const subir = h('label', 'ql-ed-btn ql-ed-btn-p', 'Subir foto'); const file = h('input') as HTMLInputElement; file.type = 'file'; file.accept = 'image/*'; file.hidden = true; subir.append(file);
      const original = h('button', 'ql-ed-btn', 'Original'); original.type = 'button';
      acciones.append(subir, original);
      const url = h('label', 'ql-ed-campo', '<span>O pega el enlace de una imagen</span>'); const urlIn = h('input') as HTMLInputElement; urlIn.type = 'url'; urlIn.placeholder = 'https://…'; url.append(urlIn);
      const alt = h('label', 'ql-ed-campo', '<span>Descripción (para accesibilidad y Google)</span>'); const altIn = h('input') as HTMLInputElement; altIn.type = 'text'; altIn.value = img.alt; altIn.maxLength = 140; alt.append(altIn);
      const posL = h('div', 'ql-ed-campo', '<span>Encuadre: qué parte de la foto se ve si se recorta</span>'); const grid = h('div', 'ql-ed-grid');
      const posiciones = ['left top', 'center top', 'right top', 'left center', 'center center', 'right center', 'left bottom', 'center bottom', 'right bottom'];
      const actual = img.style.objectPosition || 'center center';
      posiciones.forEach((p) => { const b = h('button', 'ql-ed-pos' + (p === actual ? ' activa' : '')); b.type = 'button'; b.title = p; b.addEventListener('click', () => { grid.querySelectorAll('.activa').forEach((x) => x.classList.remove('activa')); b.classList.add('activa'); img.style.objectPosition = p; set(id, 'pos', p); }); grid.append(b); });
      posL.append(grid);
      const nota = h('p', 'ql-ed-nota', 'Las fotos se optimizan automáticamente (WebP, máx. 1600 px). Se ven en el sitio cuando publiques.');
      cuerpo.append(vista, acciones, url, alt, posL, nota);

      const poner = (src: string) => { img.removeAttribute('srcset'); img.src = src; pre.src = src; set(id, 'content', src); pedirUbicar(); };
      file.addEventListener('change', async () => { const f = file.files?.[0]; if (!f) return; subir.textContent = 'Optimizando…'; try { poner(await comprimir(f)); toast('Foto lista. Recuerda publicar.'); } catch { toast('No se pudo procesar esa imagen.', true); } subir.textContent = 'Subir foto'; subir.append(file); });
      urlIn.addEventListener('change', () => { if (urlIn.value.startsWith('http')) poner(urlIn.value.trim()); });
      altIn.addEventListener('input', () => { img.alt = altIn.value; set(id, 'alt', altIn.value); });
      original.addEventListener('click', () => { img.removeAttribute('srcset'); img.src = orig.src; pre.src = orig.src; img.alt = orig.alt; altIn.value = orig.alt; img.style.objectPosition = ''; grid.querySelectorAll('.activa').forEach((x) => x.classList.remove('activa')); set(id, 'content', ''); set(id, 'alt', ''); set(id, 'pos', ''); });
      abrir('Cambiar foto', cuerpo);
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
      const actual = h('p', 'ql-ed-nota', `Ahora lleva a: <code>${href}</code>`);
      const aplicarBtn = h('button', 'ql-ed-btn ql-ed-btn-p', 'Aplicar destino'); aplicarBtn.type = 'button';
      // estado inicial a partir del href actual
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
        aplicarEnlace(a, nuevo); set(id, 'href', nuevo); actual.innerHTML = `Ahora lleva a: <code>${nuevo}</code>`; toast('Destino cambiado. Recuerda publicar.');
      });
      cuerpo.append(tipoL, det, aplicarBtn, actual);
      abrir('Destino del botón', cuerpo);
    }

    /* ---------- barra de edición ---------- */
    const barra = h('div', 'ql-ed-barra');
    const info = h('div', 'ql-ed-info'); barra.append(info);
    const acciones = h('div', 'ql-ed-acciones');
    const ayuda = h('button', 'ql-ed-btn', '?'); ayuda.type = 'button'; ayuda.title = 'Cómo funciona';
    const descartar = h('button', 'ql-ed-btn', 'Descartar'); descartar.type = 'button';
    const publicar = h('button', 'ql-ed-btn ql-ed-btn-p', `${svg.check}<span>Publicar</span>`); publicar.type = 'button';
    const salir = h('button', 'ql-ed-ib', svg.x); salir.type = 'button'; salir.setAttribute('aria-label', 'Salir del modo edición');
    acciones.append(ayuda, descartar, publicar, salir); barra.append(acciones); document.body.append(barra);
    const refrescarBarra = () => { const n = pendientes.size; info.innerHTML = `${svg.lapiz}<span>Editando <b>${nombrePagina(pagina)}</b></span><em>${n ? `${n} cambio${n === 1 ? '' : 's'} sin publicar` : 'Sin cambios'}</em>`; (publicar as HTMLButtonElement).disabled = !n; (descartar as HTMLButtonElement).disabled = !n; };
    refrescarBarra();
    ayuda.addEventListener('click', () => abrir('Cómo editar', h('div', 'ql-ed-cuerpo', `
      <ol class="ql-ed-ayuda">
        <li><b>Textos:</b> toca cualquier texto con borde punteado y escribe. Enter solo hace salto de línea en párrafos.</li>
        <li><b>Fotos:</b> botón «Cambiar foto» → sube una desde tu equipo o celular, pega un enlace, elige el encuadre y escribe la descripción. «Original» la devuelve.</li>
        <li><b>Botones:</b> «Destino» → elige a qué página, WhatsApp, web o correo lleva.</li>
        <li><b>Secciones:</b> la barra de cada bloque las sube, baja u oculta. Nada se borra: lo oculto se puede volver a mostrar.</li>
        <li><b>Publicar</b> guarda todo de una vez. Hasta entonces nadie ve tus cambios. <b>Descartar</b> vuelve a lo publicado.</li>
        <li>Otros visitantes ven lo nuevo en máximo 10 minutos. Google lo indexa con la siguiente actualización del sitio.</li>
      </ol>`)));
    descartar.addEventListener('click', () => { if (confirm('¿Descartar todos los cambios sin publicar?')) location.reload(); });
    salir.addEventListener('click', () => { if (pendientes.size && !confirm('Tienes cambios sin publicar. ¿Salir de todos modos?')) return; pendientes.clear(); location.href = location.pathname; });
    addEventListener('beforeunload', (e) => { if (pendientes.size) { e.preventDefault(); e.returnValue = ''; } });

    publicar.addEventListener('click', async () => {
      if (!pendientes.size) return;
      const porDoc: Record<string, Record<string, string | null>> = {};
      for (const [k, v] of pendientes) { const [id, campo] = k.split('#'); (porDoc[id] ||= {})[campo] = v === '' ? null : v; }
      if (Object.values(porDoc).some((d) => (d.content || '').length > 900_000)) { toast('Una foto es demasiado pesada. Súbela de nuevo desde «Cambiar foto».', true); return; }
      (publicar as HTMLButtonElement).disabled = true; publicar.querySelector('span')!.textContent = 'Publicando…';
      try {
        if (demo) { await new Promise((r) => setTimeout(r, 600)); throw new Error('demo'); }
        const batch = writeBatch(db);
        for (const [id, campos] of Object.entries(porDoc)) batch.set(doc(db, COLECCION, id), { ...campos, page: pagina, updatedAt: serverTimestamp(), updatedBy: user.email || user.uid }, { merge: true });
        await batch.commit();
        for (const [id, campos] of Object.entries(porDoc)) publicado[id] = { ...(publicado[id] || {}), ...campos, page: pagina } as any;
        guardarCache(pagina, publicado);
        pendientes.clear(); refrescarBarra();
        toast('¡Listo! Los cambios ya están publicados.');
      } catch (e: any) {
        if (e?.message === 'demo') toast('Modo demo: aquí se publicaría en Firestore.', true);
        else { console.error(e); toast('No se pudo publicar. Revisa tu conexión y que tu cuenta esté autorizada.', true); }
      } finally { publicar.querySelector('span')!.textContent = 'Publicar'; refrescarBarra(); }
    });
  }
}

/* ---------- utilidades ---------- */
const nombrePagina = (p: string) => ({ home: 'la página de inicio', nosotros: 'Nosotros', contactenos: 'Contáctenos' } as Record<string, string>)[p] || p;
const safeJSON = (s: unknown) => { try { return typeof s === 'string' ? JSON.parse(s) : null; } catch { return null; } };

function montarToast() {
  const c = h('div', 'ql-ed-toasts'); document.body.append(c);
  return (msg: string, error = false) => { const t = h('div', 'ql-ed-toast' + (error ? ' error' : ''), msg); c.append(t); setTimeout(() => t.classList.add('ver'), 10); setTimeout(() => { t.classList.remove('ver'); setTimeout(() => t.remove(), 300); }, error ? 6000 : 3500); };
}
function tarjeta(titulo: string, html: string, botones: { texto: string; fn: () => void; primario?: boolean }[] = []) {
  quitarTarjeta();
  const fondo = h('div', 'ql-ed-velo'); const t = h('div', 'ql-ed-tarjeta', `<h2>${titulo}</h2>${html}`);
  const fila = h('div', 'ql-ed-fila');
  botones.forEach((b) => { const x = h('button', 'ql-ed-btn' + (b.primario ? ' ql-ed-btn-p' : ''), b.texto); x.type = 'button'; x.addEventListener('click', b.fn); fila.append(x); });
  const volver = h('a', 'ql-ed-btn', 'Ver el sitio'); volver.setAttribute('href', location.pathname); fila.append(volver);
  t.append(fila); fondo.append(t); document.body.append(fondo);
}
function quitarTarjeta() { document.querySelector('.ql-ed-velo')?.remove(); }
function pedirIngreso(auth: ReturnType<typeof getAuth>) {
  tarjeta('Editar esta página', '<p>Entra con tu cuenta de Google autorizada. Verás el sitio tal cual y podrás tocar lo que quieras cambiar.</p>', [{ texto: `${svg.google} Entrar con Google`, primario: true, fn: () => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => alert('No se pudo iniciar sesión: ' + (e?.message || e))) }]);
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
