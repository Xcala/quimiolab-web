// Recorrido guiado (product tour) sin dependencias.
// Ilumina una parte de la pantalla y explica para qué sirve, paso a paso.
// Teclado: ← → para moverse, Esc para salir, Tab queda dentro de la tarjeta. En móvil la tarjeta va abajo.
// Origen: Level Studio (Revista Level, 2026). Estilos en tour.css (clases .tg-*).

/**
 * @typedef {Object} Paso
 * @property {string} [el]        Selector del elemento a iluminar. Sin él (o si está oculto): tarjeta centrada.
 * @property {string} titulo
 * @property {string} texto       HTML simple: <p>, <b>, y <p class="tg-ej"><span>Mejor</span> … para ejemplos.
 * @property {boolean} [logo]     Muestra opciones.logoHtml arriba (útil en bienvenida y cierre).
 * @property {() => void} [antes] Se ejecuta antes de mostrar el paso (abrir un panel, cambiar de pestaña…).
 */

/**
 * @typedef {Object} Opciones
 * @property {{ texto: string, href: string }} [fin]  Enlace en el último paso (p. ej. «Leer la guía completa →»).
 * @property {string} [logoHtml]                       HTML del logo para los pasos con logo: true.
 * @property {(id: string) => void} [alCerrar]         Se llama al cerrar (terminar o saltar), p. ej. para analítica.
 * @property {Partial<typeof TEXTOS>} [textos]         Para traducir los botones.
 */

const TEXTOS = {
  saltar: 'Saltar', atras: 'Atrás', siguiente: 'Siguiente', empezar: 'Empezar el recorrido',
  listo: 'Listo', empezarFin: '¡Empezar!', de: 'de',
};

const clave = (id) => `tg-tour-${id}`;

/** true si esta persona ya vio (o saltó) el recorrido `id` en este navegador. */
export const tourVisto = (id) => { try { return localStorage.getItem(clave(id)) === '1'; } catch { return true; } };
const marcar = (id) => { try { localStorage.setItem(clave(id), '1'); } catch {} };

/**
 * Abre el recorrido.
 * @param {string} id        Nombre del recorrido (se recuerda por separado: «editor», «panel»…).
 * @param {Paso[]} pasos
 * @param {Opciones} [op]
 */
export function iniciarTour(id, pasos, op = {}) {
  const T = { ...TEXTOS, ...(op.textos || {}) };
  document.querySelector('.tg-tour')?.remove();
  const capa = document.createElement('div');
  capa.className = 'tg-tour';
  capa.innerHTML = `
    <div class="tg-velo" aria-hidden="true"></div>
    <div class="tg-foco" aria-hidden="true"></div>
    <div class="tg-card" role="dialog" aria-modal="true" aria-labelledby="tg-t" tabindex="-1">
      <div class="tg-logo" hidden></div>
      <p class="tg-n"></p>
      <h2 id="tg-t" class="tg-h"></h2>
      <div class="tg-x"></div>
      <div class="tg-dots" aria-hidden="true">${pasos.map(() => '<span></span>').join('')}</div>
      <div class="tg-acc">
        <button type="button" class="tg-skip"></button>
        <span style="flex:1"></span>
        <button type="button" class="tg-btn tg-btn-o tg-prev"></button>
        <button type="button" class="tg-btn tg-btn-p tg-next"></button>
      </div>
    </div>`;
  document.body.append(capa);
  const foco = capa.querySelector('.tg-foco');
  const velo = capa.querySelector('.tg-velo');
  // El oscurecido es un velo con un hueco recortado (no una sombra gigante: Chrome no pinta sombras de miles de px).
  const hueco = (x, y, w, h, r) => `path(evenodd, 'M0 0H${innerWidth}V${innerHeight}H0Z M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z')`;
  const card = capa.querySelector('.tg-card');
  const logoBox = capa.querySelector('.tg-logo');
  if (op.logoHtml) logoBox.innerHTML = op.logoHtml;
  const prevBtn = capa.querySelector('.tg-prev');
  const nextBtn = capa.querySelector('.tg-next');
  const skipBtn = capa.querySelector('.tg-skip');
  prevBtn.textContent = T.atras; skipBtn.textContent = T.saltar;
  const anterior = document.activeElement;
  const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0;
  let objetivo = null;

  // Ubica el foco sobre el elemento y la tarjeta donde no lo tape: abajo, arriba, a un lado o al fondo.
  function ubicar() {
    const movil = innerWidth < 640;
    if (!objetivo || !objetivo.getClientRects().length) {
      foco.style.cssText = 'top:50%;left:50%;width:0;height:0;';
      velo.style.clipPath = 'none';
      capa.classList.add('centro');
      card.style.cssText = '';
      return;
    }
    capa.classList.remove('centro');
    const r = objetivo.getBoundingClientRect();
    const m = 8;
    foco.style.cssText = `top:${r.top - m}px;left:${r.left - m}px;width:${r.width + m * 2}px;height:${r.height + m * 2}px;`;
    velo.style.clipPath = hueco(r.left - m, r.top - m, r.width + m * 2, r.height + m * 2, Math.min(20, (r.height + m * 2) / 2));
    // en móvil la fija el CSS al fondo; si el elemento está abajo (p. ej. una barra fija), la tarjeta va arriba
    if (movil) { card.style.cssText = ''; capa.classList.toggle('arriba', r.top > innerHeight / 2); return; }
    const cw = Math.min(380, innerWidth - 32);
    const ch = card.offsetHeight || 260;
    const cabe = {
      abajo: r.bottom + 18 + ch <= innerHeight - 16, arriba: r.top - 18 - ch >= 16,
      der: r.right + 24 + cw <= innerWidth - 16, izq: r.left - 24 - cw >= 16,
    };
    let top; let left;
    if (cabe.abajo) { top = r.bottom + 18; left = r.left + r.width / 2 - cw / 2; }
    else if (cabe.arriba) { top = r.top - ch - 18; left = r.left + r.width / 2 - cw / 2; }
    else if (cabe.der || cabe.izq) {
      // Elemento alto (portada, cuerpo de texto, barra lateral): la tarjeta va al lado, sin taparlo.
      top = Math.max(16, Math.min(innerHeight - ch - 16, r.top + Math.min(r.height, innerHeight) / 2 - ch / 2));
      left = cabe.der ? r.right + 24 : r.left - cw - 24;
    } else { top = innerHeight - ch - 16; left = r.left + r.width / 2 - cw / 2; }
    left = Math.max(16, Math.min(innerWidth - cw - 16, left));
    card.style.cssText = `top:${top}px;left:${left}px;width:${cw}px;`;
  }

  function mostrar(n) {
    i = Math.max(0, Math.min(pasos.length - 1, n));
    const p = pasos[i];
    p.antes?.();
    objetivo = p.el ? document.querySelector(p.el) : null;
    if (objetivo && objetivo.hidden) objetivo = null;
    capa.querySelector('.tg-n').textContent = `${i + 1} ${T.de} ${pasos.length}`;
    capa.querySelector('#tg-t').textContent = p.titulo;
    capa.querySelector('.tg-x').innerHTML = p.texto;
    logoBox.hidden = !(p.logo && op.logoHtml);
    capa.querySelectorAll('.tg-dots span').forEach((d, k) => d.classList.toggle('on', k === i));
    prevBtn.hidden = i === 0;
    const ultimo = i === pasos.length - 1;
    nextBtn.textContent = ultimo ? (op.fin ? T.empezarFin : T.listo) : i === 0 ? T.empezar : T.siguiente;
    skipBtn.hidden = ultimo;
    let finLink = capa.querySelector('.tg-fin');
    if (ultimo && op.fin) {
      if (!finLink) { finLink = document.createElement('a'); finLink.className = 'tg-fin'; capa.querySelector('.tg-x').after(finLink); }
      finLink.href = op.fin.href; finLink.textContent = op.fin.texto;
    } else finLink?.remove();
    if (objetivo && innerWidth < 640) {
      // En móvil la tarjeta va abajo: el elemento sube a la parte de arriba de la pantalla.
      window.scrollBy({ top: objetivo.getBoundingClientRect().top - 130, behavior: 'auto' });
    } else if (objetivo) {
      const r = objetivo.getBoundingClientRect();
      if (r.top < 90 || r.bottom > innerHeight - 40) {
        objetivo.scrollIntoView({ block: r.height > innerHeight * 0.6 ? 'start' : 'center', behavior: sinMovimiento() ? 'auto' : 'smooth' });
      }
    }
    ubicar();
    setTimeout(ubicar, 380); // después del scroll suave
    card.focus({ preventScroll: true });
  }

  function cerrar() {
    marcar(id);
    removeEventListener('resize', ubicar); removeEventListener('scroll', ubicar, true); removeEventListener('keydown', teclas, true);
    capa.classList.add('sale');
    setTimeout(() => capa.remove(), 220);
    anterior?.focus?.({ preventScroll: true });
    op.alCerrar?.(id);
  }

  function teclas(e) {
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); i === pasos.length - 1 ? cerrar() : mostrar(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); mostrar(i - 1); }
    else if (e.key === 'Tab') { // el foco no sale de la tarjeta
      const f = [...card.querySelectorAll('button:not([hidden]), a[href]')];
      if (!f.length) return;
      const idx = f.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }

  nextBtn.addEventListener('click', () => (i === pasos.length - 1 ? cerrar() : mostrar(i + 1)));
  prevBtn.addEventListener('click', () => mostrar(i - 1));
  skipBtn.addEventListener('click', cerrar);
  addEventListener('resize', ubicar); addEventListener('scroll', ubicar, true); addEventListener('keydown', teclas, true);
  requestAnimationFrame(() => { capa.classList.add('in'); mostrar(0); });
}

/**
 * Atajo para conectar un recorrido: se abre solo la primera vez, con ?tour=1 en la URL,
 * y con cualquier botón que tenga [data-tour-ayuda].
 * @param {string} id
 * @param {Paso[] | (() => Paso[])} pasos  Función si los pasos dependen de datos que cargan después.
 * @param {Opciones & { auto?: boolean, retraso?: number }} [op]
 */
export function conectarTour(id, pasos, op = {}) {
  const abrir = () => iniciarTour(id, typeof pasos === 'function' ? pasos() : pasos, op);
  document.querySelectorAll('[data-tour-ayuda]').forEach((b) => b.addEventListener('click', abrir));
  const pedido = new URLSearchParams(location.search).get('tour') === '1';
  if (pedido || (op.auto !== false && !tourVisto(id))) setTimeout(abrir, op.retraso ?? 700);
  return abrir;
}
