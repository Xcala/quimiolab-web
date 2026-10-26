// Sistema visual de quimiolab.com sobre las dos herramientas (firma y tarjeta): CSS y cuerpo nuevos
// (mismos id, así la lógica original sigue funcionando) y parches de JS para la marca.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '../..');
const pieza = (n) => readFileSync(join(aqui, n), 'utf8');
const fuente = (archivo) => 'data:font/woff2;base64,' + readFileSync(join(raiz, 'public/fuentes', archivo)).toString('base64');
const svgUri = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
const trazosDe = (componente) => [...readFileSync(join(raiz, 'src/components', componente), 'utf8').matchAll(/<path[^>]*\sd="([^"]+)"[^>]*>/g)].map((m) => m[1]);
const svgBlanco = (viewBox, w, h, trazos) => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}">${trazos.map((d) => `<path fill="#fff" d="${d}"/>`).join('')}</svg>`);

// isotipo y endoso exactos (mismas rutas que los componentes del sitio), en blanco: el lienzo los tiñe
const QLUPA = svgBlanco('0 0 2267.74 2267.72', 1000, 1000, trazosDe('LogoQLupa.astro'));
const SD = svgBlanco('0 0 355.09 38.24', 710, 77, trazosDe('LogoSDBiosensor.astro'));
// patrones del manual (public/patrones), sin metadatos
const PATRONES = [['red-molecular', 'Red molecular'], ['adn', 'ADN'], ['reticula-q', 'Retícula Q'], ['ondas', 'Ondas'], ['microplaca', 'Microplaca'], ['cromatograma', 'Cromatograma']];
const recursosPatron = Object.fromEntries(PATRONES.map(([slug]) => ['patron_' + slug,
  svgUri(readFileSync(join(raiz, 'public/patrones', slug + '.svg'), 'utf8').replace(/<metadata>[\s\S]*?<\/metadata>/, ''))]));
// acentos del manual (el 10 % de la regla 60/30/10)
const ACENTOS = [['#0097D6', 'Azul Quimiolab'], ['#00CDF4', 'Azul brillante'], ['#0E8CA9', 'Teal científico'], ['#00946E', 'Verde'], ['#FFCB2B', 'Amarillo']];
const htmlPatrones = '<button class="patron-op" type="button" data-patron="ninguno"><span class="m"></span>Ninguno</button>' +
  PATRONES.map(([slug, nombre]) => `<button class="patron-op" type="button" data-patron="${slug}"><span class="m" style="--p:url(/patrones/${slug}.svg)"></span>${nombre}</button>`).join('');
const htmlAcentos = ACENTOS.map(([hex, nombre]) => `<button class="acento" type="button" data-acento="${hex}" title="${nombre}" aria-label="${nombre}" style="background:${hex}"></button>`).join('');
const caraRoboto = `@font-face{font-family:'RobotoQL';src:url(${fuente('roboto.woff2')}) format('woff2');font-weight:100 900;font-style:normal;font-display:block;}\n`;

const cambiar = (s, de, a) => {
  if (!s.includes(de)) throw new Error(`No se encontró: ${de.slice(0, 90)}`);
  return s.replace(de, () => a);
};
// reemplaza <style> y <body> por los de la marca; conserva las @font-face embebidas de la plantilla
const vestir = (html, { body, css, logoBlanco, logoColor, foto }) => {
  const iniCuerpo = html.indexOf('<body>'), finCuerpo = html.indexOf('<script>var qrcode');
  if (iniCuerpo < 0 || finCuerpo < 0) throw new Error('No se encontró el cuerpo de la plantilla');
  const cuerpo = pieza(body).replace(/{{PATRONES}}/g, htmlPatrones).replace(/{{ACENTOS}}/g, htmlAcentos)
    .replace('{{LOGO_BLANCO}}', logoBlanco).replace('{{LOGO_COLOR}}', logoColor).replace('{{FOTO}}', foto || '');
  html = html.slice(0, iniCuerpo) + cuerpo + html.slice(finCuerpo);
  const iniEstilo = html.indexOf('<style>') + '<style>'.length, finEstilo = html.indexOf('</style>');
  const caras = (html.slice(iniEstilo, finEstilo).match(/@font-face\{[^}]*\}/g) || []).join('\n');
  return html.slice(0, iniEstilo) + '\n' + caras + '\n' + caraRoboto + pieza('comun.css') + pieza(css) + html.slice(finEstilo);
};

/* ── tarjeta ─────────────────────────────────────────────────────── */
export function marcaTarjeta(t, { logoBlanco, logoColor }) {
  t = vestir(t, { body: 'tarjeta.body.html', css: 'tarjeta.css', logoBlanco, logoColor });
  t = cambiar(t, 'window.GA_RECURSOS = {', 'window.GA_RECURSOS = {\n' +
    Object.entries({ qlupa: QLUPA, sd: SD, ...recursosPatron }).map(([k, v]) => `  "${k}": "${v}",`).join('\n'));
  t = cambiar(t, '["logo", "logoBlanco", "foto", "telefono", "correo",\n   "telefonoOscuro", "correoOscuro"].forEach(function (nombre) {',
    'Object.keys(window.GA_RECURSOS).forEach(function (nombre) {');
  t = cambiar(t, 'return (el.peso || 400) + " " + (el.tamano * k) + "px PoppinsQL, Arial, sans-serif";',
    'return (el.peso || 400) + " " + (el.tamano * k) + "px " +\n      (el.familia === "texto" ? "RobotoQL, Roboto, Arial, sans-serif" : "PoppinsQL, Poppins, Arial, sans-serif");');
  t = cambiar(t, '        c.font = fuenteDe(el, k);\n',
    '        c.font = fuenteDe(el, k);\n        if ("letterSpacing" in c) c.letterSpacing = ((el.espaciado || 0) * el.tamano * k) + "px";\n');
  t = cambiar(t, [
    '        if (img && img.complete && img.naturalWidth) {',
    '          if (el.forma === "circulo") {',
    '            var lado = Math.min(img.naturalWidth, img.naturalHeight);',
    '            c.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2,'].join('\n'), [
    '        if (el.tinte && img && img.complete && img.naturalWidth) img = tenida(img, el.tinte, Math.max(8, w));',
    '        if (img && (img.tagName === "CANVAS" || (img.complete && img.naturalWidth))) {',
    '          if (el.forma === "circulo") {',
    '            var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, lado = Math.min(iw, ih);',
    '            c.drawImage(img, (iw - lado) / 2, (ih - lado) / 2,'].join('\n'));
  t = cambiar(t, '      case "texto": {', pieza('tarjeta.casos.js') + '      case "texto": {');
  const finPlantilla = '    return { w: W, h: H, radio: 34, capas: capas };\n  }\n';
  const ini = t.indexOf('  /* ── plantilla institucional ──'), fin = t.indexOf(finPlantilla);
  if (ini < 0 || fin < 0) throw new Error('No se encontró la plantilla de la tarjeta');
  t = t.slice(0, ini) + pieza('tarjeta.plantilla.js') + t.slice(fin + finPlantilla.length);
  const ajustesMarca = 'visual: "marca", patron: "red-molecular", acento: "#0097D6", qlupa: true, endoso: true';
  t = cambiar(t, 'qr: 100, qrTipo: "vcard", caso: "mayus", logoPropio: null };',
    `qr: 100, qrTipo: "vcard", caso: "mayus", logoPropio: null,\n                  ${ajustesMarca} };`);
  t = cambiar(t, 'logo: 100, qr: 100, qrTipo: "vcard", caso: "mayus" };',
    `logo: 100, qr: 100, qrTipo: "vcard", caso: "mayus",\n                       ${ajustesMarca} };`);
  t = cambiar(t, '    } else if (el.tipo === "qr") {', pieza('tarjeta.props.js') + '    } else if (el.tipo === "qr") {');
  t = cambiar(t, '    alCambiar("p-arogrosor", function (v) { seleccion.aroGrosor = parseFloat(v) || 0; });\n', [
    '    alCambiar("p-arogrosor", function (v) { seleccion.aroGrosor = parseFloat(v) || 0; });',
    '    alCambiar("p-c1", function (v) { seleccion.colores = (seleccion.colores || ["#001A4D", "#003087"]).slice(); seleccion.colores[0] = v; });',
    '    alCambiar("p-c2", function (v) { seleccion.colores = (seleccion.colores || ["#001A4D", "#003087"]).slice(); seleccion.colores[seleccion.colores.length - 1] = v; });',
    '    alCambiar("p-ang", function (v) { seleccion.angulo = parseFloat(v) || 0; });',
    '    alCambiar("p-ocolor", function (v) { seleccion.color = v; });',
    '    alCambiar("p-oint", function (v) { seleccion.intensidad = (parseFloat(v) || 0) / 100; });',
    '    alCambiar("p-pcolor", function (v) { seleccion.color = v; });',
    '    alCambiar("p-ptam", function (v) { seleccion.tamano = Math.max(40, parseFloat(v) || 240); });',
    '    alCambiar("p-tinte", function (v) { seleccion.tinte = v; });', ''].join('\n'));
  t = cambiar(t, '  function aplicarAjustes() {', pieza('tarjeta.ui.js') + '  function aplicarAjustes() {');
  t = cambiar(t, '    $("c-qr-tipo").value = A.ajustes.qrTipo;\n    $("c-caso").value = A.ajustes.caso;\n  }',
    '    $("c-qr-tipo").value = A.ajustes.qrTipo;\n    $("c-caso").value = A.ajustes.caso;\n    pintarMarca();\n  }');
  // El tamaño del nombre depende de su largo: al cambiar de persona se rehace la plantilla (salvo diseño libre)
  t = cambiar(t, '    A.recursos.imagenes.foto.src = m.foto || window.GA_RECURSOS.foto;\n    A.pintar(); A.pintarPropiedades();',
    '    A.recursos.imagenes.foto.src = m.foto || window.GA_RECURSOS.foto;\n    if (!A.editado) { A.reconstruir(); return; }\n    A.pintar(); A.pintarPropiedades();');
  t = cambiar(t, '"Nuevo miembro" : "Editar miembro"', '"Nueva persona" : "Editar persona"');
  return t;
}

/* ── firma ───────────────────────────────────────────────────────── */
export function marcaFirma(f, { logoBlanco, logoColor, foto }) {
  f = vestir(f, { body: 'firma.body.html', css: 'firma.css', logoBlanco, logoColor, foto });
  f = cambiar(f, '<style>\n', `<style>\n@font-face{font-family:'PoppinsQL';src:url(${fuente('poppins-700.woff2')}) format('woff2');font-weight:700;font-style:normal;font-display:swap;}\n`);
  f = cambiar(f, 'window.GAF_RECURSOS = {', 'window.GAF_RECURSOS = {\n  marca: ' + JSON.stringify({ sd: SD, ...recursosPatron }) + ',');
  f = cambiar(f, "    function td(contenido, tam, alto, color, peso, pad) {\n      return '<tr><td' + al + ' style=\"font-family:' + f +",
    "    function td(contenido, tam, alto, color, peso, pad, fam) {\n      return '<tr><td' + al + ' style=\"font-family:' + (fam || f) +");
  f = cambiar(f, 'return td(esc(aplicarCaso(d.nombre, d.caso)) || "&nbsp;", 12, 15, m.tinta, "bold", "0");',
    'return td(esc(aplicarCaso(d.nombre, d.caso)) || "&nbsp;", 12, 15, m.tinta, "bold", "0", m.fuenteTitulo);');
  f = cambiar(f, '      aviso: { visible: false },\n    };',
    '      aviso: { visible: false },\n      tipografia: "segura",\n      banda: { visible: true, posicion: "abajo", patron: "red-molecular", endoso: true, lema: estructura !== "foto" },\n    };');
  f = cambiar(f, '  function construir(m, d, R) {', '  function construirBase(m, d, R) {');
  f = cambiar(f, '  return {\n    porDefecto: porDefecto,', pieza('firma.construir.js') + '  return {\n    porDefecto: porDefecto,');
  f = cambiar(f, '    recursos.iconos = cacheIconos[color] || recursos.iconosBase;\n',
    '    recursos.iconos = cacheIconos[color] || recursos.iconosBase;\n    prepararBanda();\n');
  const anclaUI = '  document.querySelectorAll("[data-estructura]").forEach(function (b) {\n    b.addEventListener("click", function () {';
  f = cambiar(f, anclaUI, pieza('firma.ui.js') + anclaUI);
  f = cambiar(f, '    $("caja-pie").style.display = d.pie.visible ? "" : "none";\n    pintarListas();\n  }',
    '    $("caja-pie").style.display = d.pie.visible ? "" : "none";\n    pintarMarca();\n    pintarListas();\n  }');
  // el título del diseño es el nombre en negrita de la tarjeta, sin la descripción
  for (const v of ['b', 'x']) f = f.split(`${v}.textContent.trim()`).join(`(${v}.querySelector("b") || ${v}).textContent.trim()`);
  f = cambiar(f, '  aplicarControles();\n  pintar();\n\n  window.GAF_APP = {',
    '  aplicarControles();\n  pintar();\n  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { recursos.bandaClave = null; pintar(); });\n\n  window.GAF_APP = {');
  return f;
}
