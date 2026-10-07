import type { APIRoute } from 'astro';
import { marcas } from '../lib/data';
import { xmlUrlset, respuesta } from '../lib/sitemap';
export const GET: APIRoute = () => respuesta(xmlUrlset(marcas.map((m) => ({ loc: m.url }))));
