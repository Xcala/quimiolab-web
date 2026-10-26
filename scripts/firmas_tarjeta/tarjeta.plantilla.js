  /* ── marca Quimiolab ──────────────────────────────────────────────── */
  var MARCA = { navy: "#001A4D", navy2: "#002468", navy3: "#003087", azul: "#0097D6",
                brillante: "#00CDF4", hielo: "#E0F4FB", gris: "#4A5878" };

  function rgba(hex, a) {
    var n = parseInt(String(hex).slice(1), 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  // tinta legible sobre un color (navy sobre acentos claros como el amarillo, blanco sobre el resto)
  function tintaSobre(hex) {
    var n = parseInt(String(hex).slice(1), 16);
    var l = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] > 0.4 ? MARCA.navy : "#FFFFFF";
  }
  // imagen teñida de un color conservando su transparencia (patrones, Q-lupa, endoso); se guarda en caché
  function tenida(img, color, ancho) {
    if (!img || !img.complete || !img.naturalWidth) return null;
    var w = Math.max(1, Math.round(ancho || img.naturalWidth));
    var h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth));
    var cache = img.__tintes || (img.__tintes = {}), clave = color + "|" + w;
    if (cache[clave]) return cache[clave];
    var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    var cc = cv.getContext("2d");
    cc.drawImage(img, 0, 0, w, h);
    cc.globalCompositeOperation = "source-in"; cc.fillStyle = color; cc.fillRect(0, 0, w, h);
    return (cache[clave] = cv);
  }

  /* ── plantilla institucional ──────────────────────────────────────── */
  var n = 0;
  function id() { return "e" + (++n) + "_" + Math.random().toString(36).slice(2, 6); }

  // visual: «marca» (degradado navy, orbes y patrón), «claro» (blanco → hielo con panel navy) o «clasico» (plano)
  function plantilla(m, aj, estilo) {
    var W = 620, H = estilo === "foto" ? 1200 : 1010;
    var visual = aj.visual || "marca", marca = visual !== "clasico", inv = visual === "claro";
    var base = marca ? MARCA.navy : aj.color;
    var acento = aj.acento || ORANGE, sobreAcento = tintaSobre(acento);
    var tapa = inv ? base : "#FFFFFF";
    var tinta = inv ? base : "#FFFFFF";
    var suave = inv ? MARCA.gris : "rgba(255,255,255,.82)";
    var past = inv ? rgba(base, 0.07) : (marca ? "rgba(255,255,255,.10)" : aclarar(base, 0.11));
    var bordePast = marca && !inv ? "rgba(255,255,255,.22)" : null;      // glass sobre el degradado
    var F = aj.fuente, conFoto = estilo === "foto";
    var altoTapa = (conFoto ? 0.635 : 0.44) * W;
    var capas = [];
    function agregar(el) { el.id = id(); capas.push(el); return el; }
    var degradadoNavy = [MARCA.navy, MARCA.navy2, MARCA.navy3], paradas = [0, 0.52, 1];

    // fondo
    if (inv) agregar({ tipo: "degradado", nombre: "Fondo claro", x: 0, y: 0, w: W, h: H, radio: 34,
                       colores: ["#FFFFFF", MARCA.hielo], angulo: 180 });
    else if (marca) agregar({ tipo: "degradado", nombre: "Fondo degradado", x: 0, y: 0, w: W, h: H, radio: 34,
                              colores: degradadoNavy, paradas: paradas, angulo: 35 });
    else agregar({ tipo: "rect", nombre: "Fondo", x: 0, y: 0, w: W, h: H, radio: 34, relleno: base });

    if (marca && !inv) {
      agregar({ tipo: "orbe", nombre: "Orbe", x: W * 0.42, y: altoTapa + 10, w: W * 0.95, h: W * 0.95,
                color: MARCA.azul, intensidad: 0.5 });
      agregar({ tipo: "orbe", nombre: "Orbe 2", x: -W * 0.42, y: H - W * 0.6, w: W * 0.8, h: W * 0.8,
                color: MARCA.azul, intensidad: 0.32 });
    }
    if (marca && aj.patron && aj.patron !== "ninguno") {
      agregar({ tipo: "patron", nombre: "Patrón", src: "patron_" + aj.patron, x: 0, y: 0, w: W, h: H, radio: 34,
                color: inv ? MARCA.azul : "#FFFFFF", opacidad: inv ? 0.07 : 0.14, tamano: 240 });
    }
    if (marca && aj.qlupa) {
      var lq = W * 0.86;
      agregar({ tipo: "imagen", nombre: "Q-lupa", src: "qlupa", tinte: inv ? MARCA.azul : MARCA.brillante,
                opacidad: inv ? 0.07 : 0.1, x: W - lq * 0.6, y: H - lq * 0.74, w: lq, h: lq });
    }

    // panel superior y esquina de acento
    if (inv) agregar({ tipo: "degradado", nombre: "Panel superior", x: 0, y: 0, w: W, h: altoTapa,
                       radios: { tl: 34, tr: 34, br: 78, bl: 0 }, colores: degradadoNavy, paradas: paradas, angulo: 35 });
    else agregar({ tipo: "rect", nombre: "Panel superior", x: 0, y: 0, w: W, h: altoTapa,
                   radios: { tl: 34, tr: 34, br: 78, bl: 0 }, relleno: tapa });
    // el recorte cóncavo es un círculo de radio «corte»: no puede bajar más que el panel
    var corte = Math.min(W * 0.235, altoTapa * 0.5);
    agregar({ tipo: "esquina", nombre: "Esquina de acento", x: W - W * 0.30, y: 0,
              w: W * 0.30, h: corte, relleno: acento, recorte: inv ? MARCA.navy3 : tapa });

    var lw = W * (conFoto ? 0.42 : 0.52) * (aj.logo / 100);
    var lh = lw * (aj.logoAlto || (104.09 / 634.43));
    var fuenteLogo = aj.logoPropio ? "logoPropio" : (inv ? "logoBlanco" : "logo");
    var yLogo = altoTapa * (conFoto ? 0.20 : 0.30) - lh / 2;
    agregar({ tipo: "imagen", nombre: "Logo", src: fuenteLogo, x: (W - lw) / 2, y: yLogo, w: lw, h: lh });

    // endoso «Una empresa de SD Biosensor» (solo en piezas de Quimiolab)
    if (aj.endoso !== false && !aj.logoPropio) {
      var yE = yLogo + lh + 16, colE = inv ? "rgba(255,255,255,.78)" : MARCA.gris, anchoSD = 128;
      agregar({ tipo: "texto", nombre: "Endoso", texto: "UNA EMPRESA DE", familia: "texto", x: W * 0.2, y: yE,
                w: W * 0.6, h: 14, tamano: 10, peso: 700, espaciado: 0.25, color: colE, alineado: "centro" });
      agregar({ tipo: "imagen", nombre: "SD Biosensor", src: "sd", tinte: inv ? "#FFFFFF" : MARCA.navy,
                x: (W - anchoSD) / 2, y: yE + 18, w: anchoSD, h: anchoSD * (38.24 / 355.09) });
    }

    var y;
    if (conFoto) {
      var r = W * 0.19 * (aj.foto / 100);
      agregar({ tipo: "imagen", nombre: "Foto", src: "foto", forma: "circulo",
                x: W / 2 - r - 7, y: altoTapa * 0.92 - r - 7, w: (r + 7) * 2, h: (r + 7) * 2,
                aro: acento, aroGrosor: 5, aroFondo: inv ? MARCA.navy2 : tapa });
      y = altoTapa * 0.92 + r + 40 * F;
    } else {
      y = altoTapa + 52 * F;
    }

    // Nombres largos: primero se achica la letra hasta 26 px; si aún no cabe, pasa a dos líneas y baja el resto
    var tamNombre = 33 * F, lineasNombre = 1, anchoNombre = W * 0.88;
    var textoNombre = aj.caso === "mayus" ? String(m.nombre).toUpperCase() : String(m.nombre);
    var medidor = document.createElement("canvas").getContext("2d");
    var mide = function (t) { medidor.font = "700 " + t + "px PoppinsQL, Poppins, Arial, sans-serif"; return medidor.measureText(textoNombre).width * 1.02; };
    while (tamNombre > 26 * F && mide(tamNombre) > anchoNombre) tamNombre -= 0.5;
    if (mide(tamNombre) > anchoNombre) { tamNombre = 30 * F; lineasNombre = 2; }
    var altoNombre = (lineasNombre === 1 ? 44 : 44 + tamNombre * 1.15) * F;
    agregar({ tipo: "texto", nombre: "Nombre", campo: "nombre", texto: m.nombre, familia: "display",
              caso: aj.caso, x: W * 0.06, y: y, w: anchoNombre, h: altoNombre, espaciado: -0.025,
              tamano: tamNombre, peso: 700, color: tinta, alineado: "centro", interlineado: 1.15 });
    y += altoNombre;
    agregar({ tipo: "linea", nombre: "Raya", x: W / 2 - 24, y: y, w: 48, h: 4, trazo: acento, grosor: 4, punta: "round" });
    y += 22 * F;
    agregar({ tipo: "texto", nombre: "Cargo", campo: "cargo", texto: m.cargo, familia: "texto",
              x: W * 0.08, y: y, w: W * 0.84, h: 56 * F, tamano: 22 * F, peso: 400,
              color: suave, alineado: "centro", interlineado: 1.4 });
    y += 66 * F;

    var anchoP = W * 0.82, xP = (W - anchoP) / 2, altoP = 58;
    [["cel", m.cel, "telefono"], ["correo", m.correo, "correo"]].forEach(function (par) {
      if (!par[1]) return;
      // el texto llena el alto de la pastilla; si no cabe a lo ancho (correos largos) se achica
      var tamP = 22 * F;
      medidor.font = "500 " + tamP + "px RobotoQL, Roboto, Arial, sans-serif";
      var anchoT = medidor.measureText(String(par[1])).width;
      if (anchoT > anchoP - 92) tamP = Math.max(15, tamP * (anchoP - 92) / anchoT);
      agregar({ tipo: "rect", nombre: "Pastilla " + par[0], x: xP, y: y, w: anchoP, h: altoP,
                radio: altoP / 2, relleno: past, trazo: bordePast, grosor: bordePast ? 1 : 0 });
      agregar({ tipo: "imagen", nombre: "Icono " + par[0], src: par[2] + (inv ? "Oscuro" : ""),
                x: xP + 24, y: y + altoP / 2 - 12, w: 24, h: 24 });
      agregar({ tipo: "texto", nombre: "Texto " + par[0], campo: par[0], texto: par[1], familia: "texto",
                x: xP + 58, y: y + altoP / 2 - tamP * 0.55, w: anchoP - 84, h: tamP * 1.3,
                tamano: tamP, peso: 500, color: tinta, alineado: "centro" });
      y += altoP + 13;
    });
    y += 10;

    var ladoQR = W * 0.30 * (aj.qr / 100), pad = 20, caja = ladoQR + pad * 2;
    var xQ = (W - caja) / 2;
    agregar({ tipo: "rect", nombre: "Tarjeta QR", x: xQ, y: y, w: caja, h: caja + 26, radio: 16, relleno: "#FFFFFF" });
    agregar({ tipo: "qr", nombre: "Código QR", x: xQ + pad, y: y + pad, w: ladoQR, h: ladoQR, relleno: MARCA.navy });
    agregar({ tipo: "esquineros", nombre: "Esquineros", x: xQ + 9, y: y + 9,
              w: caja - 18, h: caja - 18, trazo: acento === "#FFCB2B" ? MARCA.azul : acento, grosor: 3, largo: 17 });
    agregar({ tipo: "texto", nombre: "Escanéame", texto: "ESCANÉAME", familia: "texto",
              x: xQ, y: y + caja + 3, w: caja, h: 18 * F, tamano: 12 * F, peso: 700, espaciado: 0.2,
              color: MARCA.navy, alineado: "centro" });
    y += caja + 26 + 22;

    var anchoB = W * 0.66, altoB = 56, tamB = 18 * F;
    agregar({ tipo: "rect", nombre: "Botón web", x: (W - anchoB) / 2, y: y, w: anchoB, h: altoB,
              radio: altoB / 2, relleno: acento });
    agregar({ tipo: "texto", nombre: "Texto web", texto: "quimiolab.com", familia: "texto",
              x: (W - anchoB) / 2, y: y + altoB / 2 - tamB * 0.55, w: anchoB, h: tamB * 1.3,
              tamano: tamB, peso: 700, color: sobreAcento, alineado: "centro" });

    return { w: W, h: H, radio: 34, capas: capas };
  }
