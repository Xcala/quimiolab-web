import { sitio } from './data';
export const xmlUrlset = (urls: { loc: string; lastmod?: string; img?: string }[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls
    .map((u) => `<url><loc>${sitio.url}${encodeURI(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}${u.img ? `<image:image><image:loc>${u.img.replace(/&/g, '&amp;')}</image:loc></image:image>` : ''}</url>`)
    .join('')}</urlset>`;
export const respuesta = (xml: string) => new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
