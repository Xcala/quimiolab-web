import type { APIRoute } from 'astro';
import { marcas, lineas, equipos, productos, posts, sitio, marcaPorSlug } from '../lib/data';
// Versión extensa de /llms.txt: cada equipo, producto y artículo con su resumen, para que los asistentes de IA citen datos correctos
const limpio = (t: unknown) => String(t ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const item = (p: (typeof productos)[number] | (typeof equipos)[number]) => {
  const marca = marcaPorSlug(p.marca)?.nombre;
  return `### [${p.nombre}](${sitio.url}${p.url})\n${marca ? `Marca: ${marca}. ` : ''}${(p as any).invima ? `Registro sanitario INVIMA ${(p as any).invima}. ` : ''}${limpio(p.resumen)}`.trim();
};
export const GET: APIRoute = () => new Response(`# Quimiolab — catálogo completo
> ${sitio.descripcion}

Quimiolab es una empresa colombiana (Bogotá, fundada en 1996, parte de SD Biosensor) que representa marcas de diagnóstico in vitro en Colombia, con soporte técnico local y acompañamiento científico. Solo catálogo y cotización: precios y disponibilidad se piden en ${sitio.url}/contactenos/, por WhatsApp (+${sitio.whatsapp}) o al correo ${sitio.correo_formularios}.

## Soluciones
${lineas.map((l) => `### [${l.nombre}](${sitio.url}${l.url})\n${limpio(l.descripcion)}`).join('\n\n')}

## Marcas
${marcas.filter((m) => m.n_equipos + m.n_productos > 0).map((m) => `- [${m.nombre}](${sitio.url}${m.url}): ${m.n_equipos} equipos, ${m.n_productos} productos`).join('\n')}

## Equipos
${equipos.map(item).join('\n\n')}

## Productos
${productos.map(item).join('\n\n')}

## Blog científico
${posts.map((p) => `- [${p.titulo}](${sitio.url}${p.url}) (${p.fecha.slice(0, 10)}): ${limpio(p.resumen)}`).join('\n')}

## Contacto
${sitio.razon_social} · NIT ${sitio.nit} · ${sitio.direccion} · PBX ${sitio.pbx} · ${sitio.correo}
`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
