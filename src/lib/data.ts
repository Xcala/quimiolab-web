import sitio from '../data/sitio.json';
import baseLineas from '../data/lineas.json';
import baseMarcas from '../data/marcas.json';
import baseProductos from '../data/productos.json';
import baseEquipos from '../data/equipos.json';
import basePosts from '../data/posts.json';
import paginas from '../data/paginas.json';
// Lo publicado desde el panel /admin/ (scripts/fetch_cms.mjs): solo los campos cambiados + elementos nuevos/ocultos
import cms from '../data/cms.json';

export type Imagen = { src: string; w: number | null; h: number | null; alt: string };
export type Producto = (typeof baseProductos)[number];
export type Equipo = (typeof baseEquipos)[number];
export type Marca = (typeof baseMarcas)[number];
export type Linea = (typeof baseLineas)[number];
export type Post = (typeof basePosts)[number];

/* ---------- base del export + cambios del panel ---------- */
type Diff = Record<string, any> & { _nuevo?: boolean; _oculto?: boolean };
const C = cms as unknown as Partial<Record<'catalogo' | 'posts' | 'marcas' | 'lineas', Record<string, Diff>>>;
function fusionar<T extends { slug: string }>(base: T[], diffs: Record<string, Diff> | undefined, completar: (x: any) => T): T[] {
  if (!diffs) return base;
  const out = base.map((b) => (diffs[b.slug] ? completar({ ...b, ...diffs[b.slug] }) : b));
  for (const [slug, d] of Object.entries(diffs)) if (d._nuevo && !base.some((b) => b.slug === slug)) out.push(completar({ slug, ...d }));
  return out.filter((x) => !(x as any)._oculto);
}
const lineas: Linea[] = fusionar(baseLineas, C.lineas, (x) => ({ ...x, url: `/soluciones/${x.slug}/` }));
let marcas: Marca[] = fusionar(baseMarcas as Marca[], C.marcas, (x) => ({ lineas: [], intro_html: '', resumen: '', color: '#0062B8', n_productos: 0, n_equipos: 0, nombre_wp: x.nombre, pagina_wp: '', taxonomia_wp: '', ...x, url: `/marcas/${x.slug}/` }));
const catalogoTodo = fusionar([...baseProductos, ...baseEquipos] as Producto[], C.catalogo, (x) => {
  const imagen = x.imagen ?? null;
  const resto = (x.imagenes || []).filter((i: Imagen) => i?.src !== imagen?.src);
  return { familia: [], lineas: [], resumen: '', resumen_html: '', descripcion_html: '', slug_wp: x.slug, es_equipo: false, ...x,
    url: `/producto/${x.slug}/`, marca_nombre: marcas.find((m) => m.slug === x.marca)?.nombre ?? x.marca_nombre ?? '', imagen, imagenes: imagen ? [imagen, ...resto] : resto };
});
const productos = catalogoTodo.filter((p) => !p.es_equipo);
const equipos = catalogoTodo.filter((p) => p.es_equipo) as Equipo[];
// conteos de cada marca según el catálogo ya combinado
marcas = marcas.map((m) => ({ ...m, n_productos: productos.filter((p) => p.marca === m.slug).length, n_equipos: equipos.filter((p) => p.marca === m.slug).length }));
const posts: Post[] = fusionar(basePosts, C.posts, (x) => ({ imagen: null, contenido_html: '', resumen: '', url_wp: '', modificado: x.fecha, ...x, url: `/blog/${x.slug}/` }))
  .sort((a, b) => b.fecha.localeCompare(a.fecha));

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
