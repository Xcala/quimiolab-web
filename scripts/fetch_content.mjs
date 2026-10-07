// Prebuild: baja lo publicado desde el editor in situ (Firestore, lectura pública por REST)
// a src/data/contenido.json para hornearlo en el HTML. Sin red o sin proyecto → {} y sigue.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'src', 'data', 'contenido.json');
const cfg = readFileSync(join(raiz, 'src', 'editor', 'config.ts'), 'utf8');
const projectId = (cfg.match(/projectId:\s*'([^']*)'/) || [])[1];
const apiKey = (cfg.match(/apiKey:\s*'([^']*)'/) || [])[1];
const coleccion = (cfg.match(/COLECCION = '([^']*)'/) || [])[1] || 'page_contents';
const valor = (v) => { if (!v) return undefined; if ('stringValue' in v) return v.stringValue; if ('nullValue' in v) return null; if ('booleanValue' in v) return v.booleanValue; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue; if ('timestampValue' in v) return v.timestampValue; return undefined; };
const guardar = (obj) => writeFileSync(destino, JSON.stringify(obj, null, 1) + '\n');
if (!projectId) { guardar({}); console.log('contenido: sin proyecto Firebase, {}'); process.exit(0); }
try {
  const out = {}; let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${coleccion}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}${apiKey ? `&key=${apiKey}` : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    for (const d of j.documents || []) { const id = d.name.split('/').pop(); const f = {}; for (const [k, v] of Object.entries(d.fields || {})) { const x = valor(v); if (x !== undefined) f[k] = x; } out[id] = f; }
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  guardar(out);
  console.log(`contenido: ${Object.keys(out).length} bloque(s) publicados horneados`);
} catch (e) {
  // No se borra lo que ya había: un build sin red conserva el último contenido conocido
  let previo = 0; try { previo = Object.keys(JSON.parse(readFileSync(destino, 'utf8'))).length; } catch { guardar({}); }
  console.warn(`contenido: no se pudo leer Firestore (${e.message}); se usa lo ya guardado (${previo} bloques)`);
}
