import sitio from '../data/sitio.json';
import lineas from '../data/lineas.json';
import marcas from '../data/marcas.json';
import productos from '../data/productos.json';
import equipos from '../data/equipos.json';
import posts from '../data/posts.json';
import paginas from '../data/paginas.json';

export type Imagen = { src: string; w: number | null; h: number | null; alt: string };
export type Producto = (typeof productos)[number];
export type Equipo = (typeof equipos)[number];
export type Marca = (typeof marcas)[number];
export type Linea = (typeof lineas)[number];
export type Post = (typeof posts)[number];

export { sitio, lineas, marcas, productos, equipos, posts, paginas };

export const catalogo = [...productos, ...equipos];
export const marcaPorSlug = (slug: string | null | undefined) => marcas.find((m) => m.slug === slug);
export const lineaPorSlug = (slug: string) => lineas.find((l) => l.slug === slug);
export const productosDeMarca = (slug: string) => productos.filter((p) => p.marca === slug);
export const equiposDeMarca = (slug: string) => equipos.filter((p) => p.marca === slug);
export const productosDeLinea = (slug: string) => productos.filter((p) => p.lineas.includes(slug));
export const equiposDeLinea = (slug: string) => equipos.filter((p) => p.lineas.includes(slug));
export const marcasConCatalogo = marcas.filter((m) => m.n_productos + m.n_equipos > 0);
export const logoMarca = (slug: string) => {
  const conLogo: Record<string, string> = {
    'aesku': 'png', 'binding-site': 'png', 'diapro': 'png', 'vircell': 'png', 'gold-standard': 'png', 'stratec': 'svg',
    'diasorin': 'svg', 'meridian-bioscience': 'svg', 'thermo-fisher': 'svg', 'fujirebio': 'png', 'elitechgroup': 'png',
    'genmark': 'png', 'genolution': 'png', 'tianlong': 'png', 'mp-biomedicals': 'png', 'macherey-nagel': 'svg',
    'abm': 'png', 'amplyus': 'svg', 'sd-biosensor': 'png', 'ningbo-hls-medical': 'png', 'college-of-american-pathologist': 'svg',
  };
  return conLogo[slug] ? `/marcas/${slug}.${conLogo[slug]}` : null;
};

export const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
export const fechaCorta = (iso: string) => {
  const d = new Date(iso);
  return { dia: d.getDate().toString().padStart(2, '0'), mes: d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '') };
};
export const paginar = <T,>(items: T[], porPagina: number) => {
  const paginas: T[][] = [];
  for (let i = 0; i < items.length; i += porPagina) paginas.push(items.slice(i, i + porPagina));
  return paginas.length ? paginas : [[]];
};
