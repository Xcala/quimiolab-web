import { sitio } from './data';

export const organizacion = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${sitio.url}/#organizacion`,
  name: sitio.razon_social,
  alternateName: 'Quimiolab',
  url: sitio.url,
  logo: `${sitio.url}/logo-quimiolab.png`,
  taxID: sitio.nit,
  telephone: sitio.pbx_tel,
  email: sitio.correo,
  address: { '@type': 'PostalAddress', streetAddress: 'Calle 77 # 28B-13, Santa Sofía', addressLocality: 'Bogotá', addressCountry: 'CO' },
  foundingDate: '1996',
  description: sitio.descripcion,
  areaServed: { '@type': 'Country', name: 'Colombia' },
  parentOrganization: { '@type': 'Organization', name: 'SD Biosensor', url: 'https://www.sdbiosensor.com' },
  knowsAbout: ['Diagnóstico in vitro', 'Laboratorio clínico', 'Pruebas rápidas', 'Inmunoensayo', 'Biología molecular', 'Banco de sangre', 'Registro sanitario INVIMA'],
  contactPoint: [
    { '@type': 'ContactPoint', contactType: 'sales', telephone: `+${sitio.whatsapp}`, email: sitio.correo_formularios, areaServed: 'CO', availableLanguage: 'es' },
    { '@type': 'ContactPoint', contactType: 'customer service', telephone: sitio.pbx_tel, email: sitio.correo, areaServed: 'CO', availableLanguage: 'es' },
  ],
  sameAs: ['https://www.linkedin.com/company/quimiolabsas/', 'https://www.instagram.com/quimiolab_sas/', 'https://www.youtube.com/@quimiolab4921'],
});

export const sitioWeb = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${sitio.url}/#sitio`,
  url: sitio.url,
  name: 'Quimiolab',
  inLanguage: 'es-CO',
  potentialAction: { '@type': 'SearchAction', target: `${sitio.url}/buscar/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
});

export const migas = (items: { nombre: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.nombre, item: `${sitio.url}${it.url}` })),
});

export const productoLd = (p: { nombre: string; url: string; resumen: string; imagen: any; marca_nombre: string | null }) => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: p.nombre,
  url: `${sitio.url}${p.url}`,
  description: p.resumen,
  image: p.imagen?.src,
  brand: p.marca_nombre ? { '@type': 'Brand', name: p.marca_nombre } : undefined,
  manufacturer: p.marca_nombre ? { '@type': 'Organization', name: p.marca_nombre } : undefined,
});

export const articuloLd = (a: { titulo: string; url: string; fecha: string; modificado: string; resumen: string; imagen: any }) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: a.titulo,
  url: `${sitio.url}${a.url}`,
  datePublished: a.fecha,
  dateModified: a.modificado,
  description: a.resumen,
  image: a.imagen?.src,
  inLanguage: 'es-CO',
  author: { '@type': 'Organization', name: 'Quimiolab' },
  publisher: { '@id': `${sitio.url}/#organizacion` },
});
