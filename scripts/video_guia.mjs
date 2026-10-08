// Graba los videos de la guía (/admin/guia/) con el editor y el panel reales, en modo demo (no toca datos).
// Requisitos: servidor demo corriendo (.claude/launch.json → dev-editor-demo, puerto 4322), Chrome instalado y ffmpeg.
//   node scripts/video_guia.mjs            → public/video/guia-editor.mp4 y guia-panel.mp4 (+ póster .jpg)
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE || 'http://localhost:4322';
const salida = join(raiz, 'public', 'video');
const W = 1280, H = 720;
mkdirSync(salida, { recursive: true });

// Cursor visible, clics con onda, subtítulos y tarjetas de título (Playwright no graba el puntero).
const capas = `
(() => {
  try { ['editor', 'panel', 'ficha'].forEach((t) => localStorage.setItem('tg-tour-' + t, '1')); if (window === top) Object.keys(localStorage).filter((k) => k.startsWith('ql_ed_borrador')).forEach((k) => localStorage.removeItem(k)); } catch {} // el marco de la vista previa sí necesita el borrador
  const css = document.createElement('style');
  css.textContent = \`
    #v-cursor { position: fixed; z-index: 2147483646; width: 22px; height: 22px; margin: -3px 0 0 -3px; pointer-events: none; transition: transform .08s; }
    #v-cursor svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }
    .v-onda { position: fixed; z-index: 2147483645; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; border: 3px solid #00CDF4; pointer-events: none; animation: v-onda .5s ease-out forwards; }
    @keyframes v-onda { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
    #v-cap { position: fixed; z-index: 2147483644; left: 50%; top: 18px; transform: translateX(-50%); max-width: 80%; padding: 12px 22px; border-radius: 999px; background: rgba(0,26,77,.94); color: #fff; font: 600 22px/1.3 Poppins, Roboto, sans-serif; letter-spacing: -.01em; text-align: center; box-shadow: 0 12px 30px rgba(0,0,0,.35); opacity: 0; transition: opacity .25s; pointer-events: none; }
    #v-cap.ver { opacity: 1; }
    #v-cap b { color: #00CDF4; }
    #v-tarjeta { position: fixed; inset: 0; z-index: 2147483643; display: grid; place-items: center; background: linear-gradient(35deg, #001A4D, #002468 55%, #003087); color: #fff; font-family: Poppins, Roboto, sans-serif; text-align: center; opacity: 0; transition: opacity .35s; pointer-events: none; }
    #v-tarjeta.ver { opacity: 1; }
    #v-tarjeta small { display: block; font: 700 15px Roboto, sans-serif; letter-spacing: .2em; text-transform: uppercase; color: #00CDF4; margin-bottom: 14px; }
    #v-tarjeta h1 { margin: 0; font-size: 54px; line-height: 1.1; letter-spacing: -.025em; color: #fff; }
    #v-tarjeta p { margin: 16px 0 0; font-size: 22px; color: #C2D8EC; font-weight: 500; }
    .ql-ed-toast.error { display: none !important; } /* el aviso «modo demo» no se muestra en el video */
  \`;
  const montar = () => {
    document.head.append(css);
    const c = document.createElement('div'); c.id = 'v-cursor';
    c.innerHTML = '<svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2l17 10-8 2-4 8z" fill="#fff" stroke="#001A4D" stroke-width="2" stroke-linejoin="round"/></svg>';
    const cap = document.createElement('div'); cap.id = 'v-cap';
    const t = document.createElement('div'); t.id = 'v-tarjeta';
    document.body.append(c, cap, t);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', (e) => { const o = document.createElement('div'); o.className = 'v-onda'; o.style.left = e.clientX + 'px'; o.style.top = e.clientY + 'px'; document.body.append(o); setTimeout(() => o.remove(), 600); c.style.transform = 'scale(.85)'; }, true);
    addEventListener('mouseup', () => (c.style.transform = ''), true);
  };
  if (document.body) montar(); else addEventListener('DOMContentLoaded', montar);
})();`;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function grabar(nombre, guion) {
  const dir = join(tmpdir(), `video-${nombre}-${Date.now()}`);
  const navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await navegador.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: 'light', locale: 'es-CO' });
  await ctx.addInitScript(capas);
  const page = await ctx.newPage();
  // captura de cuadros con el screencast de Chrome (DevTools); el video se arma con el ffmpeg del sistema
  mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const cuadros = []; let grabando = false;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const archivo = join(dir, `f${String(cuadros.length).padStart(6, '0')}.jpg`);
    writeFileSync(archivo, Buffer.from(data, 'base64')); cuadros.push({ archivo, t: metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  const empezar = async () => { if (grabando) return; grabando = true; await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 1 }); };
  const h = {
    page,
    async cap(texto, ms = 0) { await page.evaluate((t) => { const c = document.getElementById('v-cap'); if (!t) { c.classList.remove('ver'); return; } c.innerHTML = t; c.classList.add('ver'); }, texto); if (ms) await espera(ms); },
    async tarjeta(kicker, titulo, texto, ms = 3200) {
      await empezar();
      await page.evaluate(([k, t, p]) => { const el = document.getElementById('v-tarjeta'); el.innerHTML = `<div><small>${k}</small><h1>${t}</h1>${p ? `<p>${p}</p>` : ''}</div>`; el.classList.add('ver'); }, [kicker, titulo, texto]);
      await espera(ms);
      await page.evaluate(() => document.getElementById('v-tarjeta').classList.remove('ver')); await espera(400);
    },
    async ir(sel, opciones = {}) {
      const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => {});
      const b = await el.boundingBox(); if (!b) throw new Error('sin caja: ' + sel);
      await page.mouse.move(b.x + b.width * (opciones.fx ?? 0.5), b.y + b.height * (opciones.fy ?? 0.5), { steps: 28 }); await espera(250);
      return b;
    },
    async clic(sel, opciones) { await h.ir(sel, opciones); await page.mouse.down(); await espera(90); await page.mouse.up(); await espera(450); },
    async scroll(y) { await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), y); await espera(1100); },
    espera,
  };
  await guion(h);
  await cdp.send('Page.stopScreencast').catch(() => {}); await espera(300);
  await ctx.close(); await navegador.close();
  // cuadros con su duración real → MP4 a 25 fps (H.264, inicio rápido) + póster
  const ruta = (a) => a.replace(/\\/g, '/');
  const lista = cuadros.map((c, i) => `file '${ruta(c.archivo)}'\nduration ${((cuadros[i + 1]?.t ?? c.t + 1) - c.t).toFixed(3)}`).join('\n') + `\nfile '${ruta(cuadros.at(-1).archivo)}'\n`;
  writeFileSync(join(dir, 'lista.txt'), lista);
  const mp4 = join(salida, `${nombre}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'lista.txt'), '-vf', `fps=25,scale=${W}:${H}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.2', '-i', mp4, '-frames:v', '1', '-q:v', '4', join(salida, `${nombre}.jpg`)]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`✓ ${mp4}`);
}

const solo = process.argv[2]; // node scripts/video_guia.mjs guia-editor → graba solo ese
/* ---------------- video 1: editar una página ---------------- */
if (!solo || solo === 'guia-editor') await grabar('guia-editor', async (v) => {
  const { page } = v;
  await page.goto(`${BASE}/?edit`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.ql-ed-barra'); await v.espera(2600); // pasa el resaltado inicial
  await v.tarjeta('Guía · Quimiolab', 'Cómo editar una página', 'Inicio, Nosotros y Contáctenos · en un minuto');
  await v.cap('Entra a <b>quimiolab.com.co/?edit</b> con tu correo de Quimiolab: te llega un enlace para entrar', 3400);
  await v.cap('Pasa el mouse: se marca lo que puedes cambiar');
  await v.ir('[data-ed="home_hero_titulo"]', { fx: 0.3 }); await v.espera(900);
  await v.ir('[data-ed="home_hero_lead"]', { fx: 0.4 }); await v.espera(1400);
  // texto
  await v.cap('<b>Textos:</b> haz clic y escribe');
  const lead = page.locator('[data-ed="home_hero_lead"]');
  const caja = await lead.boundingBox();
  await page.mouse.move(caja.x + caja.width - 8, caja.y + caja.height - 12, { steps: 20 }); await page.mouse.click(caja.x + caja.width - 8, caja.y + caja.height - 12);
  await page.keyboard.press('End'); await v.espera(300);
  await page.keyboard.type(' Asesoría en todo el país.', { delay: 70 }); await v.espera(900);
  // negrita
  await v.cap('Selecciona palabras para ponerlas en <b>negrita</b>');
  for (let i = 0; i < 'todo el país'.length + 1; i++) await page.keyboard.press('Shift+ArrowLeft', { delay: 25 });
  await v.espera(700);
  await v.clic('.ql-ed-formato [title^="Negrita"]'); await v.espera(1200);
  await page.keyboard.press('Escape');
  // foto
  await v.cap('<b>Fotos:</b> tócalas para cambiarlas');
  await v.clic('.slide.activa [data-ed-img]', { fy: 0.45 }); await v.espera(900);
  await page.setInputFiles('.ql-ed-panel input[type=file]', join(raiz, 'public', 'img', 'molecular.jpg'));
  await v.cap('Sube una foto: se optimiza sola', 2200);
  await v.ir('.ql-ed-panel .ql-ed-grid'); await v.cap('Elige el encuadre y escribe qué muestra', 1800);
  await v.clic('.ql-ed-panel-cab .ql-ed-ib');
  // botón
  await v.cap('<b>Botones:</b> «Destino» decide a dónde llevan');
  await v.ir('[data-ed-link="home_hero_btn_cotizar"]'); await v.espera(500);
  await v.clic('.ql-ed-chip-enlace >> visible=true'); await v.espera(700);
  await page.selectOption('.ql-ed-panel select', 'whatsapp'); await v.espera(900);
  await v.clic('.ql-ed-panel .ql-ed-btn-p'); await v.espera(900);
  await v.clic('.ql-ed-panel-cab .ql-ed-ib');
  // secciones: fondo
  await v.scroll(await page.evaluate(() => document.querySelector('#soluciones').getBoundingClientRect().top + scrollY - 80));
  await v.cap('<b>Secciones:</b> súbelas, bájalas, ocúltalas o cambia su fondo');
  await v.ir('#soluciones .cabecera', { fx: 0.2 }); await v.espera(900);
  await v.clic('.ql-ed-seccion:visible [title="Fondo de la sección"]'); await v.espera(700);
  await v.clic('.ql-ed-fondo:has-text("Nube")'); await v.espera(900);
  await v.clic('.ql-ed-chips .ql-ed-btn:has-text("Microplaca")'); await v.espera(1300);
  await v.clic('.ql-ed-panel-cab .ql-ed-ib');
  // agregar sección
  await v.cap('Con <b>+</b> agregas una sección nueva con el diseño de la marca');
  await v.ir('#soluciones .cabecera', { fx: 0.2 });
  await v.clic('.ql-ed-seccion:visible [title="Agregar una sección debajo"]'); await v.espera(800);
  await v.clic('.ql-ed-plantilla:has-text("Cifras")'); await v.espera(2200);
  // deshacer
  await v.cap('¿Te equivocaste? <b>Deshacer</b> (o Ctrl+Z)');
  await v.clic('[data-tour="deshacer"]'); await v.espera(1500);
  await v.clic('.ql-ed-barra [title^="Rehacer"]'); await v.espera(1300);
  // vista previa
  await v.cap('<b>Vista previa</b> en escritorio y celular');
  await v.clic('[data-tour="vista"]'); await v.espera(2200);
  await v.clic('.ql-ed-previa-barra button:has-text("Celular")'); await v.espera(2600);
  await v.clic('.ql-ed-previa-barra button:has-text("Volver a editar")');
  // publicar
  await v.cap('Cuando esté listo, <b>Publicar</b>: en 10 minutos está en el sitio');
  await v.clic('[data-tour="publicar"]'); await v.espera(2400);
  await v.cap('');
  await v.tarjeta('Listo', 'Todo se guarda solo como borrador', 'El botón ? repite el recorrido · Guía: quimiolab.com.co/admin/guia/', 3600);
});

/* ---------------- video 2: panel de contenido ---------------- */
if (!solo || solo === 'guia-panel') await grabar('guia-panel', async (v) => {
  const { page } = v;
  await page.goto(`${BASE}/admin/#/catalogo`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.adm-fila-item'); await v.espera(800);
  await v.tarjeta('Guía · Quimiolab', 'Panel de contenido', 'Blog, productos, marcas y líneas');
  await v.cap('Entra a <b>quimiolab.com.co/admin/</b> con tu correo de Quimiolab: te llega un enlace para entrar', 3200);
  await v.cap('Elige qué editar en las pestañas');
  await v.ir('.adm-nav a[data-tipo="posts"]'); await v.espera(700); await v.ir('.adm-nav a[data-tipo="catalogo"]'); await v.espera(900);
  await v.cap('<b>Busca</b> por nombre o marca, sin preocuparte por las tildes');
  await v.clic('.adm-busca input'); await page.keyboard.type('virclia lotus', { delay: 90 }); await v.espera(1200);
  await v.cap('Toca una fila para editarla');
  await v.clic('.adm-fila-item'); await v.espera(1500);
  await v.cap('Edita los campos: la <b>vista previa</b> se actualiza sola');
  await v.clic('#f-nombre', { fx: 0.9 }); await page.keyboard.press('End'); await page.keyboard.type(' · equipo de quimioluminiscencia', { delay: 55 }); await v.espera(1600);
  await v.cap('Todo se guarda solo como <b>borrador</b>');
  await v.ir('[data-tour="estado"]'); await v.espera(2200);
  await v.cap('<b>Publicar</b> lo pone en el sitio. El historial guarda cada versión');
  await v.clic('[data-tour="publicar"]'); await v.espera(1800);
  await v.ir('[data-tour="historial"]'); await v.espera(1400);
  await v.cap('Con <b>Nuevo</b> creas artículos, productos o marcas');
  await v.clic('.adm-barra a[aria-label^="Volver"]'); await v.espera(900);
  await v.ir('[data-tour="nuevo"]'); await v.espera(1800);
  await v.cap('');
  await v.tarjeta('Listo', 'Así de fácil', 'El botón ? repite el recorrido · Guía: quimiolab.com.co/admin/guia/', 3400);
});
