import type { APIRoute } from 'astro';
import { sitio } from '../lib/data';
import { respuesta } from '../lib/sitemap';
export const GET: APIRoute = () => respuesta(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['paginas', 'marcas', 'productos', 'equipos', 'blog'].map((s) => `<sitemap><loc>${sitio.url}/sitemap-${s}.xml</loc></sitemap>`).join('')}</sitemapindex>`);
