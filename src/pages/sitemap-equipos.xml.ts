import type { APIRoute } from 'astro';
import { equipos } from '../lib/data';
import { xmlUrlset, respuesta } from '../lib/sitemap';
export const GET: APIRoute = () => respuesta(xmlUrlset(equipos.map((p) => ({ loc: p.url, img: p.imagen?.src }))));
