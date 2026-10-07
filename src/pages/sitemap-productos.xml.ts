import type { APIRoute } from 'astro';
import { productos, paginar } from '../lib/data';
import { xmlUrlset, respuesta } from '../lib/sitemap';
export const GET: APIRoute = () => respuesta(xmlUrlset([...paginar(productos, 24).slice(1).map((_, i) => ({ loc: `/productos/pagina/${i + 2}/` })), ...productos.map((p) => ({ loc: p.url, img: p.imagen?.src }))]));
