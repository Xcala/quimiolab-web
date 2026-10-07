/**
 * Carga pública del contenido editado (todas las páginas marcadas con data-ed-page)
 * y arranque del modo edición cuando la URL trae ?edit.
 */
import { leerCache, guardarCache, pedirPagina, aplicar } from '../editor/contenido';
import { firebaseConfig } from '../editor/config';

const main = document.querySelector<HTMLElement>('main[data-ed-page]');
const pagina = main?.dataset.edPage;
const quiereEditar = new URLSearchParams(location.search).has('edit');

if (main && pagina) {
  if (quiereEditar) {
    document.documentElement.classList.add('ql-edit');
    import('../editor/editor').then((m) => m.iniciar(main, pagina)).catch((e) => console.error('Editor:', e));
  } else if (firebaseConfig.projectId) {
    const cache = leerCache(pagina);
    if (cache) aplicar(main, pagina, cache);
    else {
      const correr = () => pedirPagina(pagina).then((d) => { guardarCache(pagina, d); aplicar(main, pagina, d); }).catch(() => { /* sin red o sin reglas: queda lo horneado */ });
      'requestIdleCallback' in window ? requestIdleCallback(correr, { timeout: 1500 }) : setTimeout(correr, 300);
    }
  }
} else if (quiereEditar) {
  console.info('Esta página no tiene bloques editables.');
}
