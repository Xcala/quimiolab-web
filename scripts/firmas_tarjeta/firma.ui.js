  /* ── estilo de marca: banda, acentos y tipografía ─────────────────────
     La banda es una imagen (degradado navy, orbe, patrón y endoso): así el
     lenguaje visual llega intacto a Outlook, que no dibuja degradados. */
  var MARCA = { navy: "#001A4D", navy2: "#002468", navy3: "#003087", azul: "#0097D6" };
  var imgsMarca = {};
  function imagenMarca(clave) {
    if (!R.marca || !R.marca[clave]) return null;
    if (imgsMarca[clave]) return imgsMarca[clave];
    var im = new Image();
    im.onload = function () { recursos.bandaClave = null; pintar(); };
    im.src = R.marca[clave];
    return (imgsMarca[clave] = im);
  }
  function cargada(im) { return im && im.complete && im.naturalWidth; }
  function tenida(im, color, ancho) {
    var w = Math.max(1, Math.round(ancho)), h = Math.max(1, Math.round(w * im.naturalHeight / im.naturalWidth));
    var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    var c = cv.getContext("2d"); c.drawImage(im, 0, 0, w, h);
    c.globalCompositeOperation = "source-in"; c.fillStyle = color; c.fillRect(0, 0, w, h);
    return cv;
  }
  function bandaDe(d) {
    if (!d.banda) d.banda = { visible: false, posicion: "abajo", patron: "red-molecular", endoso: true, lema: d.estructura !== "foto" };
    return d.banda;
  }
  function prepararBanda() {
    var d = m(), b = bandaDe(d);
    if (!b.visible) { recursos.banda = null; return; }
    var W = d.ancho, H = 46, k = 2;
    var clave = [W, b.patron, b.endoso, b.lema ? datos.lema : "", d.acento].join("|");
    if (recursos.bandaClave === clave && recursos.banda) return;
    var sd = imagenMarca("sd"), pat = b.patron && b.patron !== "ninguno" ? imagenMarca("patron_" + b.patron) : null;
    var cv = document.createElement("canvas"); cv.width = W * k; cv.height = H * k;
    var c = cv.getContext("2d"); c.scale(k, k);
    var r = 8;
    c.beginPath(); c.moveTo(r, 0); c.arcTo(W, 0, W, H, r); c.arcTo(W, H, 0, H, r); c.arcTo(0, H, 0, 0, r); c.arcTo(0, 0, W, 0, r);
    c.closePath(); c.clip();
    var ang = 35 * Math.PI / 180, L = (Math.abs(W * Math.sin(ang)) + Math.abs(H * Math.cos(ang))) / 2;
    var g = c.createLinearGradient(W / 2 - Math.sin(ang) * L, H / 2 + Math.cos(ang) * L, W / 2 + Math.sin(ang) * L, H / 2 - Math.cos(ang) * L);
    g.addColorStop(0, MARCA.navy); g.addColorStop(0.52, MARCA.navy2); g.addColorStop(1, MARCA.navy3);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    var o = c.createRadialGradient(W - 70, -20, 0, W - 70, -20, 150);
    o.addColorStop(0, "rgba(0,151,214,.55)"); o.addColorStop(0.68, "rgba(0,151,214,0)");
    c.fillStyle = o; c.fillRect(0, 0, W, H);
    if (cargada(pat)) {
      c.save(); c.globalAlpha = 0.16;
      c.fillStyle = c.createPattern(tenida(pat, "#FFFFFF", 130), "repeat"); c.fillRect(0, 0, W, H);
      c.restore();
    }
    c.fillStyle = d.acento; c.fillRect(0, 0, 4, H);
    if (b.lema && datos.lema) {
      c.fillStyle = "#FFFFFF"; c.textBaseline = "middle"; c.textAlign = "left";
      c.font = "500 12px RobotoQL, Roboto, Arial, sans-serif";
      c.fillText(datos.lema, 18, H / 2 + 0.5, W * (b.endoso ? 0.58 : 0.9));
    }
    if (b.endoso && cargada(sd)) {
      var anchoSD = 92, altoSD = anchoSD * sd.naturalHeight / sd.naturalWidth, xd = W - 16 - anchoSD;
      c.drawImage(tenida(sd, "#FFFFFF", anchoSD * k), xd, H / 2 + 1, anchoSD, altoSD);
      c.fillStyle = "rgba(255,255,255,.8)"; c.textBaseline = "alphabetic"; c.textAlign = "left";
      c.font = "700 7px RobotoQL, Roboto, Arial, sans-serif";
      if ("letterSpacing" in c) c.letterSpacing = "1.6px";
      c.fillText("UNA EMPRESA DE", xd, H / 2 - 3);
    }
    try { recursos.banda = { src: cv.toDataURL("image/png"), w: W, h: H }; recursos.bandaClave = clave; }
    catch (e) { recursos.banda = null; }
  }

  var NOTA_TIPO = {
    segura: "Se ve igual en todos los correos.",
    marca: "Poppins y Roboto se ven en Gmail y Outlook web; en Outlook de escritorio solo si están instaladas (si no, puede verse otra letra). Pruébala antes de usarla.",
  };
  function marcarGrupo(selector, atributo, valor) {
    document.querySelectorAll(selector).forEach(function (bt) {
      var on = bt.getAttribute(atributo) === String(valor);
      bt.classList.toggle("on", on); bt.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function pintarMarca() {
    var d = m(), b = bandaDe(d);
    $("d-banda").checked = !!b.visible;
    $("caja-banda").style.display = b.visible ? "" : "none";
    marcarGrupo("[data-banda-pos]", "data-banda-pos", b.posicion || "abajo");
    marcarGrupo("[data-patron]", "data-patron", b.patron || "ninguno");
    $("d-endoso").checked = b.endoso !== false;
    $("d-banda-lema").checked = !!b.lema;
    marcarGrupo("[data-acento]", "data-acento", String(d.acento).toUpperCase());
    marcarGrupo("[data-tipografia]", "data-tipografia", d.tipografia || "segura");
    $("nota-tipo").textContent = NOTA_TIPO[d.tipografia || "segura"];
  }
  function cambioMarca(fn) { fn(); recursos.bandaClave = null; aplicarControles(); pintar(); guardar(); }
  $("d-banda").addEventListener("change", function () { var v = this.checked; cambioMarca(function () { bandaDe(m()).visible = v; }); });
  $("d-endoso").addEventListener("change", function () { var v = this.checked; cambioMarca(function () { bandaDe(m()).endoso = v; }); });
  $("d-banda-lema").addEventListener("change", function () { var v = this.checked; cambioMarca(function () { bandaDe(m()).lema = v; }); });
  document.querySelectorAll("[data-banda-pos]").forEach(function (bt) {
    bt.addEventListener("click", function () { cambioMarca(function () { bandaDe(m()).posicion = bt.getAttribute("data-banda-pos"); }); });
  });
  document.querySelectorAll("[data-patron]").forEach(function (bt) {
    bt.addEventListener("click", function () { cambioMarca(function () { bandaDe(m()).patron = bt.getAttribute("data-patron"); }); });
  });
  document.querySelectorAll("[data-acento]").forEach(function (bt) {
    bt.addEventListener("click", function () { cambioMarca(function () { m().acento = bt.getAttribute("data-acento"); }); });
  });
  document.querySelectorAll("[data-tipografia]").forEach(function (bt) {
    bt.addEventListener("click", function () { cambioMarca(function () { m().tipografia = bt.getAttribute("data-tipografia"); }); });
  });
  $("b-marca").addEventListener("click", function () {
    cambioMarca(function () {
      Object.keys(disenos).forEach(function (e) {
        var d = disenos[e], b = bandaDe(d);
        d.acento = "#0097D6"; d.tinta = MARCA.navy;
        b.visible = true; b.posicion = "abajo"; b.patron = "red-molecular"; b.endoso = true; b.lema = e !== "foto";
      });
    });
  });

