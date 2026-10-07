/**
 * Contenido publicado desde el editor in situ, horneado en el HTML al momento del build.
 * `scripts/fetch_content.mjs` (prebuild) llena src/data/contenido.json desde Firestore;
 * si no hay red o aún no hay nada publicado, el archivo queda {} y se usa lo del código.
 */
import contenido from '../data/contenido.json';

export type DocEd = { content?: string | null; href?: string | null; alt?: string | null; pos?: string | null; sections?: string | null };
const docs = contenido as Record<string, DocEd>;

export const ed = (id: string): DocEd => docs[id] ?? {};
export const edTexto = (id: string) => { const c = ed(id).content; return typeof c === 'string' && c ? c : undefined; };
