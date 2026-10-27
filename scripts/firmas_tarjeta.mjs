// Genera /admin/firmas/ y /admin/tarjeta/ (src/admin/herramientas/*.html, envueltas por src/pages/admin/{firmas,tarjeta}/index.astro) (firma de correo y tarjeta virtual del equipo) a partir de los
// HTML autónomos de la skill «firma-y-tarjeta-virtual» (versión Grupo Alternativas), con la marca Quimiolab:
// logos, colores, textos institucionales, vCard y llaves de guardado. Los datos de cada persona viven en el
// navegador de quien edita (localStorage + «Guardar mi trabajo» en un archivo); no hay Firebase aquí.
//   node scripts/firmas_tarjeta.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import vm from 'node:vm';
import sharp from 'sharp';
import { marcaFirma, marcaTarjeta } from './firmas_tarjeta/marca.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(homedir(), '.claude/skills/firma-y-tarjeta-virtual/assets/originales-html');
const sitio = JSON.parse(readFileSync(join(raiz, 'src/data/sitio.json'), 'utf8'));

const NAVY = '#001A4D', ACENTO = '#0097D6', ACENTO_HOVER = '#0074A8';
const WEB = 'quimiolab.com', WEB_URL = 'https://www.quimiolab.com';
const PBX = '+57 (601) 805 4082', PBX_VCARD = '+57 601 805 4082';
const DIRECCION = 'Calle 77 # 28B-13, Santa Sofía · Bogotá D.C., Colombia';
const LEMA = sitio.tagline; // «Transformando la Experiencia, todos los días.»
// Texto genérico de confidencialidad: confirmar con Quimiolab si tienen uno oficial
const AVISO = 'Este mensaje y sus archivos adjuntos son confidenciales y de uso exclusivo de su destinatario.';

const uri = (buf) => 'data:image/png;base64,' + buf.toString('base64');
const b64 = (s) => Buffer.from(s.slice('data:image/png;base64,'.length), 'base64');

// Logo oficial (mismas rutas que LogoQuimiolab.astro) en PNG navy y blanco
const svgLogo = readFileSync(join(raiz, 'src/components/LogoQuimiolab.astro'), 'utf8');
const trazos = [...svgLogo.matchAll(/<path[^>]*\sd="([^"]+)"[^>]*>/g)].map((m) => m[1]);
const logo = async (color, ancho) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5102.36 841.44">${trazos.map((d) => `<path fill="${color}" d="${d}"/>`).join('')}</svg>`;
  return uri(await sharp(Buffer.from(svg), { density: (72 * ancho / 5102.36) * 3 }).resize({ width: ancho }).png().toBuffer());
};
const PROPORCION_LOGO = (841.44 / 5102.36).toFixed(6);

// Íconos: conserva el alfa y cambia el color
const tenir = async (dataUri, hex) => {
  const { data, info } = await sharp(b64(dataUri)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; }
  return uri(await sharp(data, { raw: info }).png().toBuffer());
};

// QR de respaldo de la firma (se regenera en el navegador con el destino elegido): con la misma librería del HTML
const qrRespaldo = async (html, texto) => {
  const lib = html.match(/<script>(var qrcode=function\(\)[\s\S]*?)<\/script>/)[1];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(lib + ';this.qrcode=qrcode;', ctx);
  const q = ctx.qrcode(0, 'M'); q.addData(texto, 'Byte'); q.make();
  const n = q.getModuleCount(), celda = 4, borde = 2, lado = (n + borde * 2) * celda;
  const px = Buffer.alloc(lado * lado * 4, 255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x))
    for (let dy = 0; dy < celda; dy++) for (let dx = 0; dx < celda; dx++) {
      const i = (((y + borde) * celda + dy) * lado + (x + borde) * celda + dx) * 4;
      px[i] = 0x00; px[i + 1] = 0x1a; px[i + 2] = 0x4d;
    }
  return uri(await sharp(px, { raw: { width: lado, height: lado, channels: 4 } }).resize(160, 160, { kernel: 'nearest' }).png().toBuffer());
};

// Reemplazo que exige encontrar el texto (si la plantilla cambia, falla en vez de dejar marca vieja)
const cambiar = (s, de, a, todas = false) => {
  if (!s.includes(de)) throw new Error(`No se encontró: ${de.slice(0, 80)}`);
  return todas ? s.split(de).join(a) : s.replace(de, a);
};
// Reemplaza la data URI que sigue a un marcador de contexto
const cambiarImagen = (s, marcador, nueva) => {
  const i = s.indexOf(marcador); if (i < 0) throw new Error(`Marcador de imagen no encontrado: ${marcador}`);
  const ini = s.indexOf('data:image/png;base64,', i); const fin = s.indexOf('"', ini);
  return s.slice(0, ini) + nueva + s.slice(fin);
};
const imagenTras = (s, marcador) => { const ini = s.indexOf('data:image/png;base64,', s.indexOf(marcador)); return s.slice(ini, s.indexOf('"', ini)); };
const comunes = (s) => {
  for (const [de, a] of [['"ga_firmas_archivo', '"ql_firmas_archivo'], ['"ga_tarjeta_archivo', '"ql_tarjeta_archivo'], ['.ga.json', '.quimiolab.json'], ['PoppinsGA', 'PoppinsQL'], ['#01236B', NAVY], ['#01236b', NAVY], ['#FF8811', ACENTO], ['#e87a08', ACENTO_HOVER]]) s = s.split(de).join(a);
  s = s.split('del Grupo Alternativas').join('de Quimiolab').split('Grupo Alternativas').join('Quimiolab');
  s = s.split('nombre@grupoalternativas.com').join('nombre@quimiolab.com').split('https://grupoalternativas.com').join(WEB_URL).split('grupoalternativas.com').join(WEB);
  // la página es una herramienta interna: que no la indexen
  return cambiar(s, '<title>', '<meta name="robots" content="noindex, nofollow">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<title>');
};

const archivos = readdirSync(origen);
const leer = (prefijo) => readFileSync(join(origen, archivos.find((f) => f.startsWith(prefijo))), 'utf8');
const logoColor600 = await logo(NAVY, 600), logoColor1040 = await logo(NAVY, 1040), logoBlanco1040 = await logo('#FFFFFF', 1040);

/* ── Firma de correo ─────────────────────────────────────────────── */
let f = leer('Firmas_');
f = cambiarImagen(f, '<header><img', await logo('#FFFFFF', 600)); // cabecera navy: logo blanco
f = cambiarImagen(f, 'id="logo-mini"', logoColor600);
f = cambiarImagen(f, 'GAF_RECURSOS = {', logoColor600);
f = cambiar(f, 'logoProporcion: 0.164167', `logoProporcion: ${PROPORCION_LOGO}`);
f = cambiarImagen(f, '  qr: "', await qrRespaldo(f, WEB_URL));
for (const icono of ['pbx', 'cel', 'correo', 'direccion', 'web']) f = cambiarImagen(f, `"${icono}": "`, await tenir(imagenTras(f, `"${icono}": "`), ACENTO));
f = cambiar(f, 'ext: "000",', 'ext: "",'); // la extensión la pone cada persona
f = cambiar(f, 'var LLAVE = "ga_firmas_v2";', 'var LLAVE = "ql_firmas_v1";');
f = cambiar(f, 'pbx: "PBX: +57 (601) 746 0503"', `pbx: "PBX: ${PBX}"`);
f = cambiar(f, 'direccion: "Calle 79 B N° 8 - 21 · Bogotá D.C., Colombia"', `direccion: "${DIRECCION}"`);
f = cambiar(f, 'lema: "El crecimiento de tu negocio depende de sus ingredientes"', `lema: "${LEMA}"`);
f = cambiar(f, 'aviso: "Este mensaje y sus archivos adjuntos son confidenciales y de uso exclusivo de su destinatario."', `aviso: "${AVISO}"`);
f = comunes(f);

/* ── Tarjeta virtual ─────────────────────────────────────────────── */
let t = leer('Tarjeta_');
t = cambiarImagen(t, 'id="logo-mini"', logoColor600);
t = cambiarImagen(t, 'GA_RECURSOS = {', logoColor1040);
t = cambiarImagen(t, 'logoBlanco: "', logoBlanco1040);
for (const icono of ['telefonoOscuro', 'correoOscuro']) t = cambiarImagen(t, `${icono}: "`, await tenir(imagenTras(t, `${icono}: "`), NAVY));
t = cambiar(t, 'var LLAVE = "ga_tarjeta_virtual_v2";', 'var LLAVE = "ql_tarjeta_virtual_v1";');
t = cambiar(t, 'var LLAVE_ANTERIOR = "ga_tarjeta_virtual_v1";', 'var LLAVE_ANTERIOR = "ql_tarjeta_virtual_v0";');
t = cambiar(t, '"ORG:Grupo Alternativas"', `"ORG:${sitio.razon_social}"`);
t = cambiar(t, '"TEL;TYPE=WORK:+57 601 746 0503"', `"TEL;TYPE=WORK:${PBX_VCARD}"`);
t = cambiar(t, '"ADR;TYPE=WORK:;;Calle 79 B N° 8 - 21;"', '"ADR;TYPE=WORK:;;Calle 77 # 28B-13 Santa Sofía;"');
t = comunes(t);

/* ── sistema visual de quimiolab.com y panel por pasos (scripts/firmas_tarjeta/) ── */
const logoBlanco600 = await logo('#FFFFFF', 600);
f = marcaFirma(f, { logoBlanco: logoBlanco600, logoColor: logoColor600, foto: imagenTras(f, '  foto: "') });
t = marcaTarjeta(t, { logoBlanco: logoBlanco600, logoColor: logoColor600 });

for (const [carpeta, html] of [['firmas', f], ['tarjeta', t]]) {
  if (/grupo ?alternativas/i.test(html)) throw new Error(`Quedó texto de Grupo Alternativas en ${carpeta}`);
  mkdirSync(join(raiz, 'src/admin/herramientas'), { recursive: true });
  writeFileSync(join(raiz, 'src/admin/herramientas', carpeta + '.html'), html);
  console.log(`src/admin/herramientas/${carpeta}.html · ${Math.round(html.length / 1024)} KB`);
}
