  /* ───────────── estilo de marca con un clic ───────────── */
  var MARCA_COMPLETA = { visual: "marca", patron: "red-molecular", acento: "#0097D6", qlupa: true, endoso: true };
  var NOMBRE_VISUAL = { marca: "ESTILO QUIMIOLAB 2026", claro: "ESTILO QUIMIOLAB CLARO", clasico: "ESTILO PLANO" };

  function marcar(selector, atributo, valor) {
    document.querySelectorAll(selector).forEach(function (b) {
      var on = b.getAttribute(atributo) === String(valor);
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function pintarMarca() {
    var aj = A.ajustes, visual = aj.visual || "marca";
    marcar("[data-visual]", "data-visual", visual);
    marcar("[data-patron]", "data-patron", aj.patron || "ninguno");
    marcar("[data-acento]", "data-acento", aj.acento || "#0097D6");
    $("c-qlupa").checked = !!aj.qlupa;
    $("c-endoso").checked = aj.endoso !== false;
    $("caja-patron").style.display = visual === "clasico" ? "none" : "";
    $("caja-color").style.display = visual === "clasico" ? "" : "none";
    $("c-qlupa").parentNode.style.display = visual === "clasico" ? "none" : "";
    $("chip-estilo").textContent = NOMBRE_VISUAL[visual] || "";
  }
  function cambiarMarca(cambios) {
    if (!confirmarReconstruccion()) { aplicarAjustes(); return; }
    for (var k in cambios) A.ajustes[k] = cambios[k];
    aplicarAjustes(); A.reconstruir(); A.guardar();
  }
  document.querySelectorAll("[data-visual]").forEach(function (b) {
    b.addEventListener("click", function () { cambiarMarca({ visual: b.getAttribute("data-visual") }); });
  });
  document.querySelectorAll("[data-patron]").forEach(function (b) {
    b.addEventListener("click", function () { cambiarMarca({ patron: b.getAttribute("data-patron") }); });
  });
  document.querySelectorAll("[data-acento]").forEach(function (b) {
    b.addEventListener("click", function () { cambiarMarca({ acento: b.getAttribute("data-acento") }); });
  });
  $("c-qlupa").addEventListener("change", function () { cambiarMarca({ qlupa: this.checked }); });
  $("c-endoso").addEventListener("change", function () { cambiarMarca({ endoso: this.checked }); });
  $("b-marca").addEventListener("click", function () { cambiarMarca(MARCA_COMPLETA); });

