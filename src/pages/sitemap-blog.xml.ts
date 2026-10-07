import type { APIRoute } from 'astro';
import { posts, paginar } from '../lib/data';
import { xmlUrlset, respuesta } from '../lib/sitemap';
export const GET: APIRoute = () => respuesta(xmlUrlset([...paginar(posts, 12).slice(1).map((_, i) => ({ loc: `/blog/pagina/${i + 2}/` })), ...posts.map((p) => ({ loc: p.url, lastmod: p.modificado, img: p.imagen?.src }))]));
