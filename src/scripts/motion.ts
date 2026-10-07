/** Capa 1 de movimiento (todo el sitio): aparición al hacer scroll, tilt 3D y foto que "vuela" al post. */
const REVEAL = ['.tarjeta', '.grid > *', '.hub', '.equipo-card', '.garantias > li', '.paso', '.cita', '.post', '.num', '.pilares > li', '[data-reveal]'].join(',');
const TILT: [string, string][] = [['.equipo-card', '.fig'], ['.tarjeta.producto', '.fig'], ['.foto', 'img'], ['.destacado', '.img'], ['[data-tilt-card]', 'img']];
const ARTICLE_PREFIX = '/blog/';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');
let io: IntersectionObserver | null = null, batch = 0, batchTimer = 0;

function setupReveal(root: ParentNode) {
  if (reduce.matches || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('rv-on');
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      el.style.setProperty('--rv-d', `${Math.min(batch, 5) * 70}ms`);
      batch++; clearTimeout(batchTimer); batchTimer = window.setTimeout(() => (batch = 0), 120);
      el.dataset.rv = '1'; io!.unobserve(el);
      el.addEventListener('transitionend', () => { delete el.dataset.rv; el.style.removeProperty('--rv-d'); }, { once: true });
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  const vh = innerHeight;
  root.querySelectorAll<HTMLElement>(REVEAL).forEach((el) => {
    if (el.dataset.rv !== undefined || el.closest('[data-rv]')) return;
    if (el.getBoundingClientRect().top < vh) return; // lo visible al cargar nunca se oculta
    el.dataset.rv = '0'; io!.observe(el);
  });
}

function setupTilt(root: ParentNode) {
  if (reduce.matches || !fine.matches) return;
  for (const [card, media] of TILT) root.querySelectorAll<HTMLElement>(card).forEach((c) => {
    if (c.dataset.tiltReady) return;
    const t = (media ? c.querySelector<HTMLElement>(media) : c) ?? c;
    c.dataset.tiltReady = '1'; t.dataset.tilt = '';
    if (t.tagName !== 'IMG') t.setAttribute('data-tilt-glare', '');
    let raf = 0;
    c.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse') return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = t.getBoundingClientRect();
        const x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
        const max = 5 * Math.min(1, 420 / Math.max(r.width, 1));
        t.style.setProperty('--rx', `${(x * 2 * max).toFixed(2)}deg`); t.style.setProperty('--ry', `${(-y * 2 * max).toFixed(2)}deg`);
        t.style.setProperty('--gx', `${((x + .5) * 100).toFixed(1)}%`); t.style.setProperty('--gy', `${((y + .5) * 100).toFixed(1)}%`);
        t.dataset.tilting = '';
      });
    });
    c.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); delete t.dataset.tilting; t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); });
  });
}

const apply = (root: ParentNode) => { setupReveal(root); setupTilt(root); };
apply(document);
addEventListener('mv:content', (e) => apply(((e as CustomEvent).detail as ParentNode) ?? document));
reduce.addEventListener?.('change', () => { if (reduce.matches) document.querySelectorAll<HTMLElement>('[data-rv]').forEach((el) => delete el.dataset.rv); });

// La foto de la tarjeta "vuela" a la portada del artículo (View Transitions entre documentos).
addEventListener('pageswap', (ev: Event) => {
  const e = ev as Event & { viewTransition?: { finished: Promise<void> }; activation?: { entry?: { url?: string } } };
  const to = e.activation?.entry?.url; if (!e.viewTransition || !to) return;
  const path = new URL(to).pathname; if (!path.startsWith(ARTICLE_PREFIX)) return;
  const link = [...document.querySelectorAll<HTMLAnchorElement>(`a[href="${path}"]`)]
    .find((a) => a.querySelector('img') && a.getBoundingClientRect().bottom > 0 && a.getBoundingClientRect().top < innerHeight);
  const img = link?.querySelector('img'); if (!img) return;
  img.style.viewTransitionName = 'vt-hero';
  e.viewTransition.finished.finally(() => { img.style.viewTransitionName = ''; });
});
