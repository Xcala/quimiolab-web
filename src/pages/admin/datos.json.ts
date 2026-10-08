// Datos base del export (sin los cambios del panel): el panel /admin/ calcula contra esto qué cambió.
import productos from '../../data/productos.json';
import equipos from '../../data/equipos.json';
import posts from '../../data/posts.json';
import marcas from '../../data/marcas.json';
import lineas from '../../data/lineas.json';

export function GET() {
  const catalogo = [...productos, ...equipos].map(({ slug, nombre, es_equipo, marca, lineas, resumen, resumen_html, descripcion_html, imagen, url }) => ({ slug, nombre, es_equipo, marca, lineas, resumen, resumen_html, descripcion_html, imagen, url }));
  const p = posts.map(({ slug, titulo, fecha, resumen, contenido_html, imagen, url }) => ({ slug, titulo, fecha, resumen, contenido_html, imagen, url }));
  const m = marcas.map(({ slug, nombre, color, resumen, intro_html, url }) => ({ slug, nombre, color, resumen, intro_html, url }));
  const l = lineas.map(({ slug, nombre, descripcion, intro_html, url }) => ({ slug, nombre, descripcion, intro_html, url }));
  return new Response(JSON.stringify({ catalogo, posts: p, marcas: m, lineas: l }), { headers: { 'Content-Type': 'application/json' } });
}
