/**
 * Secciones del editor in situ: fondos, patrones y plantillas de secciones nuevas.
 * Módulo compartido (JS plano) entre el editor, el script de visitantes y el build
 * (`scripts/aplicar_layout.mjs`), para que una sección se vea igual en los tres.
 *
 * El layout de cada página (`layout__<página>.sections`) es una lista de
 *   { key, hidden?, bg?, patron?, tpl? }
 * - key: id de la sección (`data-ed-sec`); las agregadas usan `x<aleatorio>`.
 * - bg / patron: undefined = el del código; 'ninguno' quita el patrón.
 * - tpl: plantilla de una sección agregada. Sus textos/fotos/botones son bloques
 *   normales de page_contents con id `<página>_<key>_<campo>`.
 */

/** Fondos del sistema de marca (no se puede salir de la paleta). */
export const FONDOS = [
  { id: 'blanco', nombre: 'Blanco', clases: [], muestra: 'var(--canvas)' },
  { id: 'gris', nombre: 'Gris claro', clases: ['seccion-2'], muestra: 'var(--canvas-2)' },
  { id: 'nube', nombre: 'Nube', clases: ['nube'], muestra: 'linear-gradient(180deg, var(--hielo), var(--nube))' },
  { id: 'tinte', nombre: 'Tinte azul', clases: ['tinte'], muestra: 'linear-gradient(180deg, var(--canvas), color-mix(in srgb, var(--azul-500) 14%, var(--canvas)))' },
  { id: 'navy', nombre: 'Navy de marca', clases: ['seccion-navy'], muestra: 'var(--grad-navy)' },
];
const CLASES_FONDO = ['seccion-2', 'nube', 'tinte', 'tinte-2', 'seccion-navy'];

/** Un solo patrón por sección; la opacidad la pone el fondo (claro 4–7 %, oscuro 12–18 %). */
export const PATRONES = [
  { id: 'ninguno', nombre: 'Sin patrón' },
  { id: 'adn', nombre: 'ADN' },
  { id: 'red', nombre: 'Red molecular' },
  { id: 'microplaca', nombre: 'Microplaca' },
  { id: 'ondas', nombre: 'Ondas' },
  { id: 'cromatograma', nombre: 'Cromatograma' },
  { id: 'q', nombre: 'Retícula Q' },
];

/** Solo las secciones de contenido aceptan otro fondo (no la portada, la franja de garantías ni el contacto). */
export const admiteFondo = (clases) => clases.includes('seccion') && !clases.includes('contacto');

/** Clases finales de una sección según el fondo y patrón elegidos. */
export function clasesSeccion(clases, s) {
  let out = [...clases];
  if (s.bg) { out = out.filter((c) => !CLASES_FONDO.includes(c)); out.push(...(FONDOS.find((f) => f.id === s.bg)?.clases || [])); }
  if (s.patron) { out = out.filter((c) => c !== 'con-patron'); if (s.patron !== 'ninguno') out.push('con-patron'); }
  return [...new Set(out)];
}
export const htmlPatron = (id) => (id && id !== 'ninguno' ? `<span class="patron patron-${id}" data-ed-patron></span>` : '');

/* ---------- plantillas ---------- */
const FOTO = '/img/investigacion.jpg';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * `v(campo, defecto, tipo)` devuelve lo publicado o el valor por defecto.
 * tipo: 'texto' (HTML) | 'href' | 'img' ({src, alt, pos}).
 */
function piezas(pagina, key, v) {
  const id = (c) => `${pagina}_${key}_${c}`;
  const t = (c, tag, def, extra = '') => `<${tag} data-ed="${id(c)}"${extra}>${v(id(c), 'content', def)}</${tag}>`;
  const btn = (c, def, href, clase = 'btn btn-primario') => `<a data-ed-link="${id(c)}" class="${clase}" href="${esc(v(id(c), 'href', href))}"><span data-ed="${id(c)}">${v(id(c), 'content', def)}</span></a>`;
  const img = (c, alt, w = 900, h = 700) => { const src = v(id(c), 'content', FOTO); const a = v(id(c), 'alt', alt); const pos = v(id(c), 'pos', ''); return `<img data-ed-img="${id(c)}" data-ed-orig="${FOTO}" data-ed-orig-alt="${esc(alt)}" src="${esc(src)}" alt="${esc(a)}" width="${w}" height="${h}" loading="lazy"${pos ? ` style="object-position:${esc(pos)}"` : ''} />`; };
  return { t, btn, img };
}

export const PLANTILLAS = [
  {
    id: 'texto-foto', nombre: 'Texto + foto', descripcion: 'Título, párrafo y botón con una foto al lado.',
    html: (p) => `<div class="wrap pl-split">
  <div>${p.t('eyebrow', 'span', 'Nueva sección', ' class="eyebrow"')}${p.t('titulo', 'h2', 'Un título claro sobre lo que ofrecemos')}${p.t('texto', 'p', 'Explica en dos o tres frases <strong>el beneficio principal</strong> y qué debe hacer la persona después.', ' class="lead"')}${p.btn('boton', 'Solicitar cotización', '/contactenos/?tema=cotizacion')}</div>
  <div class="pl-foto">${p.img('foto', 'Foto de la sección')}</div>
</div>`,
  },
  {
    id: 'foto-texto', nombre: 'Foto + texto', descripcion: 'Igual que la anterior, con la foto a la izquierda.',
    html: (p) => `<div class="wrap pl-split pl-invertido">
  <div class="pl-foto">${p.img('foto', 'Foto de la sección')}</div>
  <div>${p.t('eyebrow', 'span', 'Nueva sección', ' class="eyebrow"')}${p.t('titulo', 'h2', 'Un título claro sobre lo que ofrecemos')}${p.t('texto', 'p', 'Explica en dos o tres frases <strong>el beneficio principal</strong> y qué debe hacer la persona después.', ' class="lead"')}${p.btn('boton', 'Conocer más', '/nosotros/', 'btn btn-secundario')}</div>
</div>`,
  },
  {
    id: 'cta', nombre: 'Llamado a la acción', descripcion: 'Franja con un mensaje fuerte y un botón.', bg: 'navy',
    html: (p) => `<div class="wrap pl-cta">
  <div>${p.t('titulo', 'h2', '¿Listo para ver el equipo con tus muestras?')}${p.t('texto', 'p', 'Agenda una <strong>demostración de 20 minutos</strong> con un especialista.', ' class="lead"')}</div>
  ${p.btn('boton', 'Agendar demo', '/contactenos/?tema=demo')}
</div>`,
  },
  {
    id: 'cifras', nombre: 'Cifras', descripcion: 'Tres números con su explicación.',
    html: (p) => `<div class="wrap">
  <div class="cabecera"><div>${p.t('eyebrow', 'span', 'En cifras', ' class="eyebrow"')}${p.t('titulo', 'h2', 'Resultados que nos respaldan')}</div></div>
  <div class="bento pl-cifras">${[1, 2, 3].map((n) => `<div class="pl-cifra">${p.t(`cifra${n}`, 'b', ['+30', '26', '24 h'][n - 1], ' class="tabular"')}${p.t(`cifra${n}_texto`, 'p', ['años en el mercado colombiano', 'marcas representadas', 'tiempo de respuesta'][n - 1])}</div>`).join('')}</div>
</div>`,
  },
  {
    id: 'tarjetas', nombre: 'Tres tarjetas', descripcion: 'Tres beneficios o servicios con enlace.',
    html: (p) => `<div class="wrap">
  <div class="cabecera"><div>${p.t('eyebrow', 'span', 'Servicios', ' class="eyebrow"')}${p.t('titulo', 'h2', 'Lo que hacemos por tu laboratorio')}</div></div>
  <div class="bento pl-tarjetas">${[1, 2, 3].map((n) => `<div class="pl-tarjeta">${p.t(`t${n}_titulo`, 'h3', ['Instalación', 'Capacitación', 'Soporte técnico'][n - 1])}${p.t(`t${n}_texto`, 'p', ['Ponemos el equipo a punto en tu laboratorio.', 'Tu equipo aprende a sacarle el máximo provecho.', 'Ingenieros en Bogotá con cobertura nacional.'][n - 1])}${p.btn(`t${n}_enlace`, 'Saber más', '/contactenos/', 'btn btn-enlace')}</div>`).join('')}</div>
</div>`,
  },
  {
    id: 'testimonio', nombre: 'Testimonio', descripcion: 'Una cita destacada de un cliente.',
    html: (p) => `<div class="wrap pl-testimonio">
  <blockquote>${p.t('cita', 'p', 'Escribe aquí lo que dijo el cliente sobre el servicio de Quimiolab.')}<footer>${p.t('nombre', 'b', 'Nombre del cliente')}${p.t('cargo', 'span', 'Cargo · Institución')}</footer></blockquote>
</div>`,
  },
  {
    id: 'texto', nombre: 'Solo texto', descripcion: 'Título y párrafos largos (políticas, historia, avisos).',
    html: (p) => `<div class="wrap">
  ${p.t('eyebrow', 'span', 'Información', ' class="eyebrow"')}${p.t('titulo', 'h2', 'Título de la sección')}
  ${p.t('texto', 'div', '<p>Escribe aquí el contenido. Usa <strong>negritas</strong> en las ideas clave para que se lea de un vistazo.</p>', ' class="prosa"')}
</div>`,
  },
  {
    id: 'preguntas', nombre: 'Preguntas frecuentes', descripcion: 'Cuatro preguntas que se despliegan.',
    html: (p) => `<div class="wrap pl-preguntas">
  <div>${p.t('eyebrow', 'span', 'Preguntas frecuentes', ' class="eyebrow"')}${p.t('titulo', 'h2', 'Resolvemos tus dudas')}</div>
  <div>${[1, 2, 3, 4].map((n) => `<details>${p.t(`p${n}`, 'summary', ['¿Cuánto tarda una cotización?', '¿Ofrecen capacitación?', '¿Tienen soporte fuera de Bogotá?', '¿Los productos tienen registro INVIMA?'][n - 1])}${p.t(`r${n}`, 'p', 'Escribe aquí la respuesta.')}</details>`).join('')}</div>
</div>`,
  },
];

/**
 * HTML completo de una sección agregada. `docs` = contenido publicado (id → {content, href, alt, pos}).
 * Sin docs se pinta con los textos por defecto.
 */
export function htmlPlantilla(pagina, s, docs = {}) {
  const tpl = PLANTILLAS.find((t) => t.id === s.tpl); if (!tpl) return '';
  const v = (id, campo, def) => { const x = docs[id]?.[campo]; return typeof x === 'string' && x ? x : def; };
  const clases = clasesSeccion(['seccion', 'pl'], s);
  return `<section class="${clases.join(' ')}" data-ed-sec="${s.key}" data-ed-label="${esc(tpl.nombre)}" data-ed-tpl="${tpl.id}"${s.hidden ? ' hidden' : ''}>${htmlPatron(s.patron)}${tpl.html(piezas(pagina, s.key, v))}</section>`;
}

export const nuevaKey = () => 'x' + Math.random().toString(36).slice(2, 8);

/** Orden guardado + secciones del código que falten; descarta claves que ya no existen (salvo las agregadas). */
export function reconciliar(guardado, keys) {
  if (!Array.isArray(guardado)) return keys.map((key) => ({ key }));
  const validas = guardado.filter((s) => s && (keys.includes(s.key) || (s.tpl && PLANTILLAS.some((t) => t.id === s.tpl))));
  keys.forEach((k, i) => { if (!validas.some((s) => s.key === k)) validas.splice(Math.min(i, validas.length), 0, { key: k }); });
  return validas;
}
