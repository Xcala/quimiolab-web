import type { APIRoute } from 'astro';
import { marcas, lineas, equipos, productos, sitio } from '../lib/data';
export const GET: APIRoute = () => new Response(`# Quimiolab
> ${sitio.descripcion}

Empresa colombiana (Bogotá) fundada en 1996. Representante directo de ${marcas.length} marcas de diagnóstico in vitro. Catálogo: ${equipos.length} equipos y ${productos.length} productos. Solo catálogo y cotización, sin venta en línea.

## Soluciones
${lineas.map((l) => `- [${l.nombre}](${sitio.url}${l.url}): ${l.descripcion}`).join('\n')}

## Marcas representadas
${marcas.map((m) => `- [${m.nombre}](${sitio.url}${m.url}): ${m.n_equipos} equipos, ${m.n_productos} productos`).join('\n')}

## Equipos
${equipos.map((e) => `- [${e.nombre}](${sitio.url}${e.url}) — ${e.marca_nombre}`).join('\n')}

## Contacto
- ${sitio.url}/contactenos/ · PBX ${sitio.pbx} · ${sitio.correo}
`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
