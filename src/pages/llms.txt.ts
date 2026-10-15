import type { APIRoute } from 'astro';
import { marcas, lineas, equipos, productos, posts, sitio } from '../lib/data';
// Resumen del sitio para modelos de lenguaje (formato llmstxt.org); la versión extensa está en /llms-full.txt
export const GET: APIRoute = () => new Response(`# Quimiolab
> ${sitio.descripcion}

Quimiolab (${sitio.razon_social}, NIT ${sitio.nit}) es una empresa colombiana con sede en Bogotá, fundada en 1996 y parte de SD Biosensor. Representa en Colombia ${marcas.length} marcas de diagnóstico in vitro y ofrece ${equipos.length} equipos y ${productos.length} productos (reactivos, pruebas rápidas, controles y consumibles) para laboratorios clínicos, hospitales, bancos de sangre y centros de investigación. Incluye registro sanitario INVIMA, instalación, capacitación, soporte técnico local y acompañamiento científico. El sitio es catálogo y cotización: no hay venta en línea ni precios publicados.

- Sitio oficial: ${sitio.url}/ (quimiolab.com.co redirige aquí)
- Catálogo completo con descripciones: ${sitio.url}/llms-full.txt
- Cotizaciones: ${sitio.url}/contactenos/ · WhatsApp +${sitio.whatsapp} · ${sitio.correo_formularios}
- PBX ${sitio.pbx} · ${sitio.direccion}

## Soluciones (líneas de negocio)
${lineas.map((l) => `- [${l.nombre}](${sitio.url}${l.url}): ${l.descripcion}`).join('\n')}

## Marcas representadas
${marcas.filter((m) => m.n_equipos + m.n_productos > 0).map((m) => `- [${m.nombre}](${sitio.url}${m.url}): ${m.n_equipos} equipos, ${m.n_productos} productos`).join('\n')}

## Equipos
${equipos.map((e) => `- [${e.nombre}](${sitio.url}${e.url}) — ${e.marca_nombre}`).join('\n')}

## Empresa
- [Nosotros](${sitio.url}/nosotros/): historia, certificaciones y equipo
- [Contáctenos](${sitio.url}/contactenos/): formulario de cotización, teléfonos y dirección
- [Blog científico](${sitio.url}/blog/): ${posts.length} artículos sobre diagnóstico clínico

## Optional
- [Productos](${sitio.url}/productos/): listado completo de reactivos y pruebas
- [Trabaja con nosotros](${sitio.url}/trabaja-con-nosotros/)
- [Línea de transparencia](${sitio.url}/linea-de-transparencia/)
- [Política de tratamiento de datos](${sitio.url}/politica-de-datos/)
`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
