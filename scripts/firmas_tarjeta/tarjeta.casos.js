      case "degradado": {
        // degradado lineal del lenguaje 2026 (navy 20–75°, nunca a negro); el ángulo se lee como en CSS
        var rg = radios(el), ang = (el.angulo == null ? 35 : el.angulo) * Math.PI / 180;
        var gcx = x + w / 2, gcy = y + h / 2;
        var largo = (Math.abs(w * Math.sin(ang)) + Math.abs(h * Math.cos(ang))) / 2;
        var lg = c.createLinearGradient(gcx - Math.sin(ang) * largo, gcy + Math.cos(ang) * largo,
                                        gcx + Math.sin(ang) * largo, gcy - Math.cos(ang) * largo);
        var cols = el.colores || ["#001A4D", "#002468", "#003087"];
        var pars = el.paradas || cols.map(function (_, i) { return cols.length > 1 ? i / (cols.length - 1) : 0; });
        cols.forEach(function (col, i) { lg.addColorStop(pars[i], col); });
        rr(c, x, y, w, h, { tl: rg.tl * k, tr: rg.tr * k, br: rg.br * k, bl: rg.bl * k });
        c.fillStyle = lg; c.fill();
        break;
      }
      case "orbe": {
        // orbe difuminado: se funde a transparente antes del borde
        var orx = w / 2, ory = h / 2, ocx = x + orx, ocy = y + ory, om = Math.max(Math.abs(orx), Math.abs(ory));
        var og = c.createRadialGradient(ocx, ocy, 0, ocx, ocy, om);
        og.addColorStop(0, rgba(el.color || "#0097D6", el.intensidad == null ? 0.55 : el.intensidad));
        og.addColorStop(0.68, rgba(el.color || "#0097D6", 0));
        c.fillStyle = og; c.fillRect(x, y, w, h);
        break;
      }
      case "patron": {
        // patrón del manual en mosaico, teñido y con opacidad baja (un solo patrón por pieza)
        var mod = tenida(rec.imagenes[el.src], el.color || "#FFFFFF", (el.tamano || 240) * k);
        if (mod) {
          var rp = radios(el);
          rr(c, x, y, w, h, { tl: rp.tl * k, tr: rp.tr * k, br: rp.br * k, bl: rp.bl * k });
          c.clip();
          c.fillStyle = c.createPattern(mod, "repeat");
          c.translate(x, y); c.fillRect(0, 0, w, h);
        }
        break;
      }
