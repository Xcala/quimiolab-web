/**
 * Recorridos guiados (skill recorrido-guiado) para quien edita el sitio:
 *  - «editor»: edición sobre la página (?edit) — inicio, Nosotros, Contáctenos.
 *  - «panel»:  lista del panel de contenido (/admin/).
 *  - «ficha»:  edición de un artículo, producto, marca o línea en /admin/.
 * La guía escrita completa (cómo entrar, paso a paso) vive en /admin/guia/.
 * Cada recorrido se abre solo la primera vez (se recuerda por id), con ?tour=1 y con el botón «?».
 */
import { iniciarTour, tourVisto } from './tour.js';
import './tour.css';

type Paso = { el?: string; titulo: string; texto: string; logo?: boolean; antes?: () => void };
type Op = { antes?: () => void; alCerrar?: () => void };

export const GUIA = '/admin/guia/';
const logoHtml = '<img src="/favicon.svg" alt="" width="44" height="44">';
const fin = { texto: 'Ver la guía completa: cómo entrar y editar →', href: GUIA };
const movil = () => innerWidth < 980;

/** Abre un recorrido; quita los pasos cuyo elemento no existe en esta pantalla. */
export function abrirRecorrido(id: string, pasos: Paso[], op: Op = {}) {
  let n = 0; // numeración seguida aunque falte algún paso en esta pantalla (p. ej. marcas sin foto)
  const visibles = pasos.filter((p) => !p.el || document.querySelector(p.el)).map((p) => (/^\d+ · /.test(p.titulo) ? { ...p, titulo: p.titulo.replace(/^\d+/, String(++n)) } : p));
  op.antes?.();
  iniciarTour(id, visibles, { logoHtml, fin, alCerrar: () => op.alCerrar?.() });
}
/** true si hay que abrirlo solo: primera vez en este navegador, o ?tour=1 en la dirección (se usa una sola vez). */
export function tocaRecorrido(id: string) {
  const u = new URL(location.href);
  if (u.searchParams.get('tour') === '1') { u.searchParams.delete('tour'); history.replaceState(history.state, '', u.pathname + u.search.replace(/=(&|$)/g, '$1') + u.hash); return true; }
  return !tourVisto(id);
}

/* ---------------- editor in situ (?edit) ---------------- */
export const pasosEditor = (preparar: { seccion: () => void }): Paso[] => [
  { logo: true, titulo: 'Te damos la bienvenida al editor',
    texto: '<p>En dos minutos te mostramos cómo cambiar <b>textos, fotos, botones y secciones</b> de esta página, sin saber de código.</p><p>No hay riesgo: nada sale al sitio hasta que pulses <b>Publicar</b>, y todo se guarda solo como borrador.</p>' },
  { el: '[data-tour="texto"]', titulo: '1 · Los textos',
    texto: '<p>Haz clic en cualquier texto y escribe, como en un documento. Al pasar el mouse se marca con un borde lo que se puede cambiar.</p><p>Al seleccionar palabras aparece una barra para <b>negrita</b>: úsala en <b>2 o 3 palabras clave por párrafo</b>. Los títulos, de máximo dos líneas.</p><p class="tg-ej"><span>Mejor</span> «Respuesta el <b>mismo día hábil</b>»<br><span>Que</span> todo el párrafo en negrita</p>' },
  { el: '[data-tour="foto"]', titulo: '2 · Las fotos',
    texto: '<p>Toca una foto para cambiarla: súbela desde tu equipo o el celular y se optimiza sola.</p><p>Usa fotos <b>horizontales de al menos 1.600 px</b> de ancho, propias o con permiso. Escribe en la descripción <b>qué muestra</b> (la leen Google y quienes no ven la imagen).</p>' },
  { el: '[data-tour="boton"]', titulo: '3 · Los botones',
    texto: '<p>El chip <b>Destino</b> de cada botón decide a dónde lleva: una página del sitio, WhatsApp con un mensaje ya escrito, otra web, un correo o un teléfono.</p><p>El texto del botón se edita como cualquier texto: corto y con verbo, de <b>2 a 4 palabras</b>.</p><p class="tg-ej"><span>Mejor</span> «Solicitar cotización»<br><span>Que</span> «Haga clic aquí para más información»</p>' },
  { el: '[data-tour="seccion"]', titulo: '4 · Las secciones', antes: preparar.seccion,
    texto: '<p>Cada bloque de la página tiene esta barra: flechas para <b>subir o bajar</b>, el ojo para <b>ocultar</b>, el pincel para el <b>fondo y el patrón</b> y <b class="tg-ico">+</b> para <b>agregar una sección</b> debajo (texto + foto, cifras, preguntas…).</p><p>Las secciones que agregues se borran con la papelera. Alterna fondos claros y oscuros para que la página respire.</p>' },
  { el: '[data-tour="resaltar"]', titulo: '5 · ¿Qué puedo cambiar?',
    texto: '<p>Este botón marca a la vez <b>todo lo editable</b> de la página: textos, fotos, botones y secciones. Tócalo otra vez para ocultar las marcas.</p>' },
  { el: '[data-tour="deshacer"]', titulo: '6 · Deshacer sin miedo',
    texto: '<p>Las flechas deshacen y rehacen (también <b>Ctrl+Z</b> y <b>Ctrl+Shift+Z</b>), para textos, fotos, secciones y fondos.</p><p>Tus cambios se guardan solos como <b>borrador en este equipo</b>: si cierras la pestaña, al volver los recuperas.</p>' },
  { el: '[data-tour="vista"]', titulo: '7 · Vista previa',
    texto: '<p>Mira la página como la verá un visitante, sin bordes ni botones, en <b>escritorio y en celular</b>.</p><p>Revísala siempre en celular antes de publicar: buena parte de las visitas llega desde el teléfono.</p>' },
  { el: '[data-tour="historial"]', titulo: '8 · Historial',
    texto: '<p>Cada publicación queda guardada con fecha y autor. Si algo salió mal, carga una versión anterior (o el diseño original) y vuelve a publicar.</p>' },
  { el: '[data-tour="publicar"]', titulo: '9 · Publicar',
    texto: '<p>Cuando estés conforme, pulsa <b>Publicar</b>. Los visitantes ven los cambios en <b>máximo 10 minutos</b>.</p><p>¿Cambiaste de idea antes de publicar? <b>Descartar</b> vuelve a lo que está en el sitio.</p>' },
  { logo: true, titulo: '¡Listo para editar!',
    texto: '<p>El botón <b class="tg-ico">?</b> de la barra repite este recorrido cuando quieras.</p><p>El blog, los productos, las marcas y las líneas se editan en el <b>panel de contenido</b> (quimiolab.com.co<b>/admin/</b>).</p>' },
];

/* ---------------- panel de contenido: lista ---------------- */
export const pasosPanel = (): Paso[] => [
  { logo: true, titulo: 'Panel de contenido',
    texto: '<p>Aquí editas el <b>blog, los productos y equipos, las marcas y las líneas</b>. En un minuto te mostramos cómo.</p><p>Todo se guarda solo como borrador y nada sale al sitio hasta que pulses <b>Publicar</b>.</p>' },
  { el: '[data-tour="pestanas"]', titulo: '1 · Qué quieres editar',
    texto: '<p>Cada pestaña es una lista: <b>Blog</b>, <b>Productos y equipos</b>, <b>Marcas</b> y <b>Líneas</b>.</p>' },
  { el: '[data-tour="buscar"]', titulo: '2 · Buscar',
    texto: '<p>Escribe parte del nombre o de la marca. No importan las tildes ni las mayúsculas.</p><p class="tg-ej"><span>Ejemplos</span> «virclia», «freelite», «aesku»</p>' },
  { el: '[data-tour="filtros"]', titulo: '3 · Filtrar',
    texto: '<p>Muestra solo lo que tiene <b>borrador sin publicar</b>, lo editado, lo creado aquí o lo oculto. En productos también filtras por marca o solo equipos.</p><p><b>Truco:</b> antes de terminar el día, filtra por «Con borrador» para no dejar nada a medias.</p>' },
  { el: '[data-tour="lista"]', titulo: '4 · Abrir un elemento',
    texto: '<p>Toca una fila para editarla. Las etiquetas te dicen su estado: <b>Borrador</b> (cambios sin publicar), <b>Editado</b>, <b>Nuevo</b> u <b>Oculto</b>.</p>' },
  { el: '[data-tour="nuevo"]', titulo: '5 · Crear',
    texto: '<p>Crea un artículo, un producto o una marca desde cero. Llena primero lo obligatorio (<b>*</b>): desde ese momento se guarda solo.</p>' },
  { el: '[data-tour="paginas"]', titulo: '6 · Inicio, Nosotros y Contáctenos',
    texto: '<p>Esas tres páginas no están aquí: se editan <b>directamente sobre la página</b>. Este botón te lleva al editor.</p>' },
  { logo: true, titulo: '¡A editar!',
    texto: '<p>El botón <b class="tg-ico">?</b> de arriba repite este recorrido. Cuando abras tu primer elemento te mostramos cómo editarlo y publicarlo.</p>' },
];

/* ---------------- panel de contenido: ficha ---------------- */
export const pasosFicha = (): Paso[] => [
  { logo: true, titulo: 'Así se edita un elemento',
    texto: '<p>Nueve pasos rápidos para editar y publicar sin errores. Lo que escribas se guarda solo.</p>' },
  { el: '[data-tour="campos"]', titulo: '1 · Los campos',
    texto: '<p>Los campos con <b>*</b> son obligatorios. Debajo de cada uno hay una ayuda con lo que conviene escribir.</p><p class="tg-ej"><span>Título</span> claro, con la palabra que la gente buscaría en Google, de <b>40 a 70 caracteres</b>.</p>' },
  { el: '[data-tour="foto"]', titulo: '2 · La foto',
    texto: '<p>Sube una foto <b>propia o con permiso de la marca</b>; se convierte sola a un formato liviano.</p><p>Productos: <b>fondo blanco y cuadrada</b>. Blog: <b>horizontal</b>. Escribe en la descripción qué muestra.</p>' },
  { el: '[data-tour="rico"]', titulo: '3 · Dar formato al texto',
    texto: '<p>Elige <b>Título</b> para abrir una parte nueva (uno cada 3 a 5 párrafos), <b>negrita</b> para 2 o 3 palabras clave por párrafo, listas para características y el eslabón para enlazar.</p><p><b>Truco:</b> puedes pegar desde Word o Google Docs: se conservan negritas, listas y enlaces y se quitan los estilos raros.</p>' },
  { el: '[data-tour="direccion"]', titulo: '4 · La dirección',
    texto: '<p>Es el enlace de la página. Se crea con el título y <b>no cambia una vez publicada</b>, para no romper enlaces de Google ni de otros sitios.</p>' },
  { el: '[data-tour="visible"]', titulo: '5 · Visible u oculto',
    texto: '<p>Desmárcalo para <b>ocultar</b> algo sin borrarlo, por ejemplo un producto que ya no se vende. Al publicar, su página deja de existir; puedes mostrarla de nuevo cuando quieras.</p>' },
  { el: '[data-tour="vista"]', titulo: '6 · Vista previa',
    texto: '<p>Así se verá con el diseño del sitio. Se actualiza mientras escribes.</p>' },
  { el: '[data-tour="estado"]', titulo: '7 · Guardado automático',
    texto: '<p>Aquí ves si hay cambios sin publicar. El borrador se guarda solo cada segundo, <b>en la nube</b>: puedes seguir desde otro equipo.</p>' },
  { el: '[data-tour="historial"]', titulo: '8 · Historial',
    texto: '<p>Cada publicación queda guardada. Desde aquí restauras una versión anterior o el contenido original del sitio.</p>' },
  { el: '[data-tour="publicar"]', titulo: '9 · Publicar',
    texto: '<p>Pone tus cambios en el sitio. Hoy aparecen con la siguiente actualización (la hace Braindy); pronto será automática, en pocos minutos.</p><p><b>Descartar borrador</b> vuelve a lo publicado.</p>' },
  { logo: true, titulo: '¡Eso es todo!',
    texto: '<p>El botón <b class="tg-ico">?</b> de arriba repite este recorrido. Si tienes dudas, la guía completa tiene el paso a paso.</p>' },
];
export const esMovil = movil;
