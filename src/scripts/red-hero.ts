/**
 * Red de nodos animada en el fondo del hero del home (reemplaza el patrón estático: un solo patrón por sección).
 * Los nodos flotan y se conectan cuando están cerca; los que están cerca del puntero se acercan a él y se
 * enlazan con el cursor. Se pausa fuera de pantalla o con la pestaña oculta; con «reducir movimiento» queda quieta.
 */
const lienzo = document.querySelector<HTMLCanvasElement>('canvas.red-hero');
const hero = lienzo?.closest<HTMLElement>('.hero');

if (lienzo && hero) {
  const ctx = lienzo.getContext('2d')!;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  type Nodo = { x: number; y: number; vx: number; vy: number; r: number };
  let nodos: Nodo[] = [];
  let w = 0, h = 0, dpr = 1;
  const raton = { x: 0, y: 0, activo: false };
  const ENLACE = 150, ALCANCE = 200; // distancias (px) para unir nodos y para atraerlos al puntero

  const medir = () => {
    const r = hero.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    w = r.width; h = r.height;
    lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // densidad según el área: ~1 nodo cada 16.000 px² (menos en celular), con tope
    const n = Math.max(24, Math.min(w < 640 ? 40 : 95, Math.round((w * h) / 16000)));
    while (nodos.length < n) nodos.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: 1.2 + Math.random() * 1.6 });
    nodos.length = n;
    nodos.forEach((p) => { p.x = Math.min(p.x, w); p.y = Math.min(p.y, h); });
  };

  const dibujar = () => {
    ctx.clearRect(0, 0, w, h);
    // enlaces entre nodos
    for (let i = 0; i < nodos.length; i++) {
      const a = nodos[i];
      for (let j = i + 1; j < nodos.length; j++) {
        const b = nodos[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > ENLACE * ENLACE) continue;
        const o = 1 - Math.sqrt(d2) / ENLACE;
        ctx.strokeStyle = `rgba(150, 215, 255, ${o * 0.5})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    // enlaces con el puntero (Azul Brillante)
    if (raton.activo) {
      for (const p of nodos) {
        const dx = p.x - raton.x, dy = p.y - raton.y, d = Math.hypot(dx, dy);
        if (d > ALCANCE) continue;
        ctx.strokeStyle = `rgba(0, 205, 244, ${(1 - d / ALCANCE) * 0.85})`; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(raton.x, raton.y); ctx.stroke();
      }
    }
    // nodos
    for (const p of nodos) {
      const cerca = raton.activo && Math.hypot(p.x - raton.x, p.y - raton.y) < ALCANCE;
      ctx.fillStyle = cerca ? 'rgba(0, 205, 244, 0.95)' : 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath(); ctx.arc(p.x, p.y, cerca ? p.r + 0.8 : p.r, 0, Math.PI * 2); ctx.fill();
    }
  };

  const mover = () => {
    for (const p of nodos) {
      if (raton.activo) { // atracción suave hacia el puntero: los nodos cercanos lo siguen
        const dx = raton.x - p.x, dy = raton.y - p.y, d = Math.hypot(dx, dy);
        if (d < ALCANCE && d > 24) { const f = (1 - d / ALCANCE) * 0.035; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
      }
      p.vx *= 0.985; p.vy *= 0.985; // fricción: vuelven a su deriva lenta
      const v = Math.hypot(p.vx, p.vy);
      if (v < 0.12) { p.vx += (Math.random() - 0.5) * 0.04; p.vy += (Math.random() - 0.5) * 0.04; }
      if (v > 1.6) { p.vx *= 1.6 / v; p.vy *= 1.6 / v; }
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) { p.vx *= -1; p.x = Math.max(0, Math.min(w, p.x)); }
      if (p.y < 0 || p.y > h) { p.vy *= -1; p.y = Math.max(0, Math.min(h, p.y)); }
    }
  };

  let visible = true, corriendo = false;
  const cuadro = () => { if (!visible || document.hidden) { corriendo = false; return; } mover(); dibujar(); requestAnimationFrame(cuadro); };
  const arrancar = () => { if (quieto || corriendo || !visible || document.hidden) return; corriendo = true; requestAnimationFrame(cuadro); };

  medir(); dibujar();
  new ResizeObserver(() => { medir(); dibujar(); }).observe(hero);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; arrancar(); }).observe(hero);
  document.addEventListener('visibilitychange', arrancar);
  hero.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; const r = hero.getBoundingClientRect(); raton.x = e.clientX - r.left; raton.y = e.clientY - r.top; raton.activo = true; if (quieto) dibujar(); });
  hero.addEventListener('pointerleave', () => { raton.activo = false; if (quieto) dibujar(); });
  arrancar();
}
