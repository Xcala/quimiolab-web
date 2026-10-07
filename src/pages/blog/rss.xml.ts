import type { APIRoute } from 'astro';
import { posts, sitio } from '../../lib/data';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const GET: APIRoute = () => {
  const items = posts.slice(0, 30).map((p) => `<item><title>${esc(p.titulo)}</title><link>${sitio.url}${p.url}</link><guid>${sitio.url}${p.url}</guid><pubDate>${new Date(p.fecha).toUTCString()}</pubDate><description>${esc(p.resumen)}</description></item>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Blog científico de Quimiolab</title><link>${sitio.url}/blog/</link><description>Artículos sobre diagnóstico clínico, autoinmunidad, enfermedades infecciosas y biología molecular.</description><language>es-CO</language>${items}</channel></rss>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
