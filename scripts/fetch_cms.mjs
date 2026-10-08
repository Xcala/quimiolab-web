// Prebuild: baja lo publicado desde el panel /admin/ (colección `cms` de Firestore, lectura pública por REST)
// a src/data/cms.json y convierte las fotos subidas (`cms:<id>` → colección `cms_media`) en archivos
// public/media/cms/<id>.webp, para que el sitio sirva imágenes normales. Sin red → conserva lo último y sigue.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'src', 'data', 'cms.json');
const carpetaMedia = join(raiz, 'public', 'media', 'cms');
const cfg = readFileSync(join(raiz, 'src', 'editor', 'config.ts'), 'utf8');
const projectId = (cfg.match(/projectId:\s*'([^']*)'/) || [])[1];
const apiKey = (cfg.match(/apiKey:\s*'([^']*)'/) || [])[1];
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const valor = (v) => {
  if (!v || typeof v !== 'object') return undefined;
  if ('stringValue' in v) return v.stringValue; if ('nullValue' in v) return null; if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue; if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, valor(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor);
  return undefined;
};
const leer = async (ruta) => { const r = await fetch(`${base}/${ruta}${apiKey ? `${ruta.includes('?') ? '&' : '?'}key=${apiKey}` : ''}`, { signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(`HTTP ${r.status} en ${ruta}`); return r.json(); };

if (!projectId) { if (!existsSync(destino)) writeFileSync(destino, '{}\n'); console.log('cms: sin proyecto Firebase'); process.exit(0); }
try {
  const out = {}; let token = '', n = 0;
  do {
    const j = await leer(`cms?pageSize=300${token ? `&pageToken=${token}` : ''}`);
    for (const d of j.documents || []) {
      const f = Object.fromEntries(Object.entries(d.fields || {}).map(([k, x]) => [k, valor(x)]));
      if (!f.tipo || !f.slug || !f.datos) continue;
      (out[f.tipo] ||= {})[f.slug] = f.datos; n++;
    }
    token = j.nextPageToken || '';
  } while (token);
  // fotos: cms:<id> → /media/cms/<id>.webp (se descargan una sola vez)
  mkdirSync(carpetaMedia, { recursive: true });
  let fotos = 0;
  const resolver = async (img) => {
    if (!img || typeof img.src !== 'string' || !img.src.startsWith('cms:')) return img;
    const id = img.src.slice(4).replace(/[^\w-]/g, '');
    const archivo = join(carpetaMedia, `${id}.webp`);
    if (!existsSync(archivo)) {
      const m = await leer(`cms_media/${id}`);
      const data = valor(m.fields?.data) || '';
      const b64 = data.split(',')[1]; if (!b64) throw new Error(`foto ${id} vacía`);
      writeFileSync(archivo, Buffer.from(b64, 'base64')); fotos++;
    }
    return { ...img, src: `/media/cms/${id}.webp` };
  };
  for (const items of Object.values(out)) for (const d of Object.values(items)) {
    if (d.imagen) d.imagen = await resolver(d.imagen);
    if (Array.isArray(d.imagenes)) d.imagenes = await Promise.all(d.imagenes.map(resolver));
  }
  writeFileSync(destino, JSON.stringify(out, null, 1) + '\n');
  console.log(`cms: ${n} elemento(s) publicados desde el panel, ${fotos} foto(s) nuevas`);
} catch (e) {
  if (!existsSync(destino)) writeFileSync(destino, '{}\n');
  console.warn(`cms: no se pudo leer Firestore (${e.message}); se usa lo ya guardado`);
}
