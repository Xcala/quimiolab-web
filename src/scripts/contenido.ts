/**
 * Carga pública del contenido editado (todas las páginas marcadas con data-ed-page),
 * arranque del modo edición cuando la URL trae ?edit y vista previa del borrador con ?borrador
 * (la usa el editor dentro de un marco: lo publicado + los cambios guardados en este equipo).
 */
import { leerCache, guardarCache, pedirPagina, aplicar, leerBorrador, conCambios } from '../editor/contenido';
import { firebaseConfig } from '../editor/config';

const main = document.querySelector<HTMLElement>('main[data-ed-page]');
const pagina = main?.dataset.edPage;
const params = new URLSearchParams(location.search);

if (main && pagina) {
  if (params.has('edit')) {
    document.documentElement.classList.add('ql-edit');
    import('../editor/editor').then((m) => m.iniciar(main, pagina)).catch((e) => console.error('Editor:', e));
  } else if (params.has('borrador')) {
    document.documentElement.classList.add('ql-borrador');
    const b = leerBorrador(pagina);
    const pintar = (pub: Record<string, any>) => aplicar(main, pagina, b ? conCambios(pub, b.p, b.s, pagina) : pub);
    (firebaseConfig.projectId ? pedirPagina(pagina) : Promise.resolve({})).then(pintar, () => pintar(leerCache(pagina) || {}));
  } else if (firebaseConfig.projectId) {
    const cache = leerCache(pagina);
    if (cache) aplicar(main, pagina, cache);
    else {
      const correr = () => pedirPagina(pagina).then((d) => { guardarCache(pagina, d); aplicar(main, pagina, d); }).catch(() => { /* sin red o sin reglas: queda lo horneado */ });
      'requestIdleCallback' in window ? requestIdleCallback(correr, { timeout: 1500 }) : setTimeout(correr, 300);
    }
  }
} else if (params.has('edit')) {
  console.info('Esta página no tiene bloques editables.');
}
