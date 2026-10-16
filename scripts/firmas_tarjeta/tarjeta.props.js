    } else if (el.tipo === "degradado") {
      var cs = el.colores || ["#001A4D", "#003087"];
      h += '<div class="rejilla">' + campoColor("p-c1", "Color inicial", cs[0]) +
           campoColor("p-c2", "Color final", cs[cs.length - 1]) +
           campoNum("p-ang", "Ángulo °", el.angulo == null ? 35 : el.angulo) + '</div>';
    } else if (el.tipo === "orbe") {
      h += '<div class="rejilla">' + campoColor("p-ocolor", "Color", el.color) +
           '<div class="prop"><label>Intensidad</label><input type="range" id="p-oint" min="5" max="90" value="' +
           Math.round((el.intensidad == null ? 0.5 : el.intensidad) * 100) + '"></div></div>';
    } else if (el.tipo === "patron") {
      h += '<div class="rejilla">' + campoColor("p-pcolor", "Color", el.color) +
           campoNum("p-ptam", "Tamaño del módulo", el.tamano || 240, 10) + '</div>';
    } else if (el.tipo === "imagen" && el.tinte) {
      h += '<div class="rejilla">' + campoColor("p-tinte", "Color", el.tinte) + '</div>';
