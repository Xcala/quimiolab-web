/**
 * Editor in situ — lo único que se adapta por marca.
 *
 * 1. firebaseConfig: Consola de Firebase → proyecto quimiolab-web → Configuración del proyecto →
 *    "Tus apps" → Agregar app web → copiar el objeto `firebaseConfig`. Son valores públicos (van al navegador).
 * 2. ADMINS: correos (Google) que pueden entrar con ?edit. La misma lista va en `firestore.rules`
 *    (allí es donde realmente se protege la escritura); cambiar ambas cuando se agregue a alguien.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: 'quimiolab-web.firebaseapp.com',
  projectId: 'quimiolab-web',
  appId: '',
};

export const ADMINS = [
  'nicolas@braindy.co',
  'leidy.carrillo@quimiolab.com',
  'daniela.pava@quimiolab.com',
  'liliana.ramirez@quimiolab.com',
  'danilo.cabrera@quimiolab.com',
  'felipe.na@sdbiosensor.com',
];

/** Colección de contenido editado: un documento por bloque + `layout__<página>` por página. */
export const COLECCION = 'page_contents';

/** Minutos que el navegador guarda el contenido publicado antes de volver a pedirlo. */
export const CACHE_MIN = 10;

/** Páginas que el cliente puede elegir como destino de un botón. */
export const PAGINAS = [
  { url: '/', nombre: 'Inicio' },
  { url: '/contactenos/', nombre: 'Contáctenos' },
  { url: '/contactenos/?tema=cotizacion', nombre: 'Contáctenos · cotización' },
  { url: '/contactenos/?tema=demo', nombre: 'Contáctenos · demo de equipo' },
  { url: '/contactenos/?tema=catalogo', nombre: 'Contáctenos · catálogo PDF' },
  { url: '/contactenos/?tema=disponibilidad', nombre: 'Contáctenos · disponibilidad' },
  { url: '/equipos/', nombre: 'Equipos' },
  { url: '/productos/', nombre: 'Productos' },
  { url: '/marcas/', nombre: 'Marcas' },
  { url: '/soluciones/', nombre: 'Soluciones' },
  { url: '/soluciones/diagnostico/', nombre: 'Línea diagnóstico' },
  { url: '/soluciones/diagnostico-molecular/', nombre: 'Línea diagnóstico molecular' },
  { url: '/soluciones/investigacion/', nombre: 'Línea investigación' },
  { url: '/soluciones/point-of-care/', nombre: 'Línea point of care' },
  { url: '/nosotros/', nombre: 'Nosotros' },
  { url: '/blog/', nombre: 'Blog' },
];

/** WhatsApp por defecto cuando el cliente elige ese destino (sin el +). */
export const WHATSAPP = '573000000000';

/** Tamaño máximo de las fotos subidas: se convierten a WebP y se reducen hasta caber. */
export const FOTO_ANCHO_MAX = 1600;
export const FOTO_BYTES_MAX = 750_000;
