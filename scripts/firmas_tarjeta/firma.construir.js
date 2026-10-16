  // tipografía de marca opcional y banda Quimiolab (imagen) arriba o abajo de la firma
  function construir(m, d, R) {
    var mm = {}; for (var k in m) mm[k] = m[k];
    if (m.tipografia === "marca") {
      mm.fuente = "Roboto, Arial, Helvetica, sans-serif"; mm.fuenteTitulo = "Poppins, Arial, Helvetica, sans-serif";
    }
    var html = construirBase(mm, d, R), b = m.banda;
    if (!b || !b.visible || !R.banda) return html;
    var fila = '<tr><td colspan="2" style="padding:' + (b.posicion === "arriba" ? "0 0 14px" : "14px 0 0") +
      ';"><img src="' + R.banda.src + '" width="' + R.banda.w + '" height="' + R.banda.h +
      '" alt="Quimiolab" style="display:block;border:0;width:' + R.banda.w + "px;height:" + R.banda.h + 'px;"></td></tr>';
    return b.posicion === "arriba" ? html.replace(/^(<table[^>]*>)/, "$1" + fila)
                                   : html.replace(/<\/table>$/, fila + "</table>");
  }

