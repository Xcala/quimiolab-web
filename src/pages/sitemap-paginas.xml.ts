import type { APIRoute } from 'astro';
import { lineas, paginas, sitio } from '../lib/data';
import { xmlUrlset, respuesta } from '../lib/sitemap';
export const GET: APIRoute = () => respuesta(xmlUrlset([
  { loc: '/', lastmod: sitio.exportado }, { loc: '/nosotros/' }, { loc: '/contactenos/' }, { loc: '/marcas/' }, { loc: '/productos/' }, { loc: '/equipos/' }, { loc: '/soluciones/' }, { loc: '/blog/' },
  ...lineas.flatMap((l) => [{ loc: l.url }, { loc: `${l.url}productos/` }, { loc: `${l.url}equipos/` }]),
  ...paginas.filter((p) => !['nosotros', 'contactenos'].includes(p.slug) && !p.slug.startsWith('registro-sanitario')).map((p) => ({ loc: p.url, lastmod: p.modificado })),
]));
