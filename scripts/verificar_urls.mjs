// Verifica que cada URL antigua (una por línea en el archivo dado) funcione en el sitio nuevo:
// existe la página en dist/ o hay una redirección (firebase.json) que termina en una página existente.
//   node scripts/verificar_urls.mjs lista.txt [salida.csv]
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const redirects = JSON.parse(readFileSync(join(raiz, 'firebase.json'), 'utf8')).hosting.redirects || [];
// patrón de Firebase (** , * , :param) → expresión regular
const aRegex = (src) => new RegExp('^' + src
  .replace(/[.+^${}()|[\]\\]/g, '\\$&')
  .replace(/:(\w+)\\\*/g, '§§').replace(/\*\*/g, '§§').replace(/\*/g, '[^/]*').replace(/§§/g, '.*')
  .replace(/:(\w+)/g, '[^/]+') + '$');
const reglas = redirects.map((r) => ({ ...r, re: aRegex(r.source) }));
const existe = (p) => { const d = decodeURIComponent(p); return existsSync(join(raiz, 'dist', d, 'index.html')) || existsSync(join(raiz, 'dist', d)) && !d.endsWith('/'); };
const lista = readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const filas = []; const res = { ok: 0, redir: 0, roto: 0 };
for (const u of [...new Set(lista)]) {
  let p; try { p = new URL(u, 'https://www.quimiolab.com').pathname; } catch { continue; }
  if (!p.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(p)) p += '/';
  let destino = p, estado = '', saltos = 0;
  // mismo orden que Firebase Hosting: primero las redirecciones (la primera que coincide), después los archivos
  while (saltos < 5) {
    const r = reglas.find((x) => x.re.test(destino) || x.re.test(decodeURIComponent(destino)));
    if (r) { destino = r.destination.split('?')[0]; saltos++; continue; }
    if (existe(destino)) { estado = saltos ? 'redirige' : 'existe'; break; }
    estado = 'ROTO'; break;
  }
  if (!estado) estado = 'ROTO (cadena)';
  estado === 'existe' ? res.ok++ : estado === 'redirige' ? res.redir++ : res.roto++;
  filas.push([u, p, estado, destino]);
}
if (process.argv[3]) writeFileSync(process.argv[3], 'url_antigua,ruta,estado,destino_final\n' + filas.map((f) => f.map((x) => `"${x}"`).join(',')).join('\n') + '\n');
console.log(`${filas.length} URLs: ${res.ok} existen igual, ${res.redir} redirigen a una página existente, ${res.roto} rotas`);
filas.filter((f) => f[2].startsWith('ROTO')).forEach((f) => console.log('  ROTA:', f[1]));
