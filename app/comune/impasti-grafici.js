// Grafici SVG senza librerie: linea (anche a gradini) e colonne.
// Ogni grafico ha la descrizione al tocco o al passaggio del mouse e una tabella con i numeri.
(function () {
  "use strict";

  const { h, s } = window.App;
  const L = 360; // larghezza del disegno: misura di un telefono, si allarga sugli schermi grandi
  const M = { su: 14, destra: 14, giu: 30, sinistra: 40 };

  function tacche(min, max, quante = 4) {
    const passoGrezzo = (max - min) / quante || 1;
    const potenza = Math.pow(10, Math.floor(Math.log10(passoGrezzo)));
    const passo = [1, 2, 2.5, 5, 10].map((m) => m * potenza).find((p) => p >= passoGrezzo) || passoGrezzo;
    const out = [];
    for (let v = Math.ceil(min / passo) * passo; v <= max + passo * 1e-9; v += passo) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }

  function tabella(intestazioni, righe) {
    return h("details", { class: "chart-table" },
      h("summary", null, "Vedi i numeri"),
      h("table", null,
        h("thead", null, h("tr", null, intestazioni.map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", null, righe.map((r) => h("tr", null, r.map((c) => h("td", null, c)))))));
  }

  // Linea: punti [{x, y}], marcatore facoltativo {x, y, etichetta}
  function linea({ titolo, punti, formatoX, formatoY, descrivi, marcatore, gradino = false, altezza = 190, xMin, xMax, yMin = 0, yMax, intestazioni, righe }) {
    const A = altezza;
    const x0 = xMin ?? Math.min(...punti.map((p) => p.x));
    const x1 = xMax ?? Math.max(...punti.map((p) => p.x));
    const yAlto = yMax ?? Math.max(...punti.map((p) => p.y), marcatore?.y || 0) * 1.1;
    const yt = tacche(yMin, yAlto);
    const y1 = Math.max(yAlto, yt[yt.length - 1]);
    const sx = (x) => M.sinistra + ((x - x0) / (x1 - x0 || 1)) * (L - M.sinistra - M.destra);
    const sy = (y) => A - M.giu - ((Math.min(y, y1) - yMin) / (y1 - yMin || 1)) * (A - M.su - M.giu);

    const visibili = punti.filter((p) => p.x >= x0 && p.x <= x1);
    let d = "";
    visibili.forEach((p, i) => {
      if (i === 0) d += `M${sx(p.x)},${sy(p.y)}`;
      else if (gradino) d += `H${sx(p.x)}V${sy(p.y)}`;
      else d += `L${sx(p.x)},${sy(p.y)}`;
    });
    if (gradino && visibili.length) d += `H${sx(x1)}`;
    const ultimoX = gradino ? x1 : visibili[visibili.length - 1].x;
    const area = `${d}L${sx(ultimoX)},${sy(yMin)}L${sx(visibili[0].x)},${sy(yMin)}Z`;
    const idClip = `clip-${Math.random().toString(36).slice(2, 8)}`;

    const svg = s("svg", { viewBox: `0 0 ${L} ${A}`, class: "chart", role: "img", "aria-label": titolo },
      s("defs", null, s("clipPath", { id: idClip }, s("rect", { x: M.sinistra, y: M.su - 2, width: L - M.sinistra - M.destra, height: A - M.su - M.giu + 2 }))),
      yt.map((v) => s("g", null,
        s("line", { class: "grid", x1: M.sinistra, x2: L - M.destra, y1: sy(v), y2: sy(v) }),
        s("text", { class: "tick", x: M.sinistra - 6, y: sy(v) + 4, "text-anchor": "end" }, formatoY(v, true)))),
      tacche(x0, x1, 5).map((v) => s("text", { class: "tick", x: sx(v), y: A - M.giu + 16, "text-anchor": "middle" }, formatoX(v, true))),
      s("g", { "clip-path": `url(#${idClip})` },
        s("path", { class: "area", d: area }),
        s("path", { class: "line", d })),
      marcatore ? s("g", null,
        s("line", { class: "marker-guide", x1: sx(marcatore.x), x2: sx(marcatore.x), y1: sy(marcatore.y), y2: sy(yMin) }),
        s("circle", { class: "dot", cx: sx(marcatore.x), cy: sy(marcatore.y), r: 5 }),
        marcatore.etichetta ? s("text", { class: "dot-label", x: Math.min(sx(marcatore.x) + 9, L - M.destra - 4), y: Math.max(sy(marcatore.y) - 9, M.su + 8), "text-anchor": sx(marcatore.x) > L * 0.7 ? "end" : "start" }, marcatore.etichetta) : null) : null);

    // Descrizione al tocco: linea verticale e punto sul valore più vicino
    const guida = s("line", { class: "crosshair", y1: M.su, y2: A - M.giu, visibility: "hidden" });
    const punto = s("circle", { class: "dot", r: 4, visibility: "hidden" });
    const zona = s("rect", { class: "hit", x: M.sinistra, y: 0, width: L - M.sinistra - M.destra, height: A - M.giu });
    svg.append(guida, punto, zona);
    const fumetto = h("div", { class: "tooltip", hidden: true });
    const box = h("div", { class: "chart-box" }, svg, fumetto);

    function vicino(evento) {
      const r = svg.getBoundingClientRect();
      const xSvg = ((evento.clientX - r.left) / r.width) * L;
      const xDato = x0 + ((xSvg - M.sinistra) / (L - M.sinistra - M.destra)) * (x1 - x0);
      let migliore = visibili[0];
      visibili.forEach((p) => {
        if (gradino ? p.x <= xDato : Math.abs(p.x - xDato) < Math.abs(migliore.x - xDato)) migliore = p;
      });
      const px = gradino ? Math.min(Math.max(xDato, x0), x1) : migliore.x;
      guida.setAttribute("x1", sx(px));
      guida.setAttribute("x2", sx(px));
      punto.setAttribute("cx", sx(px));
      punto.setAttribute("cy", sy(migliore.y));
      guida.setAttribute("visibility", "visible");
      punto.setAttribute("visibility", "visible");
      fumetto.textContent = descrivi({ ...migliore, x: px });
      fumetto.hidden = false;
      const sinistra = (sx(px) / L) * r.width;
      fumetto.style.left = `${Math.min(Math.max(sinistra, 70), r.width - 70)}px`;
    }
    zona.addEventListener("pointermove", vicino);
    zona.addEventListener("pointerdown", vicino);
    zona.addEventListener("pointerleave", () => {
      guida.setAttribute("visibility", "hidden");
      punto.setAttribute("visibility", "hidden");
      fumetto.hidden = true;
    });

    return h("figure", { class: "chart-figure" },
      h("figcaption", null, titolo), box,
      intestazioni ? tabella(intestazioni, righe) : null);
  }

  // Colonne: barre [{etichetta, valore, dettaglio}]
  function colonne({ titolo, barre, formato, altezza = 180 }) {
    const A = altezza;
    const max = Math.max(...barre.map((b) => b.valore), 1);
    const yt = tacche(0, max, 3);
    const y1 = Math.max(max, yt[yt.length - 1]);
    const sy = (v) => A - M.giu - (v / y1) * (A - M.su - M.giu);
    const banda = (L - M.sinistra - M.destra) / barre.length;
    const larghezza = Math.min(24, banda * 0.6);
    const iMax = barre.reduce((m, b, i) => (b.valore > barre[m].valore ? i : m), 0);
    const fumetto = h("div", { class: "tooltip", hidden: true });

    const svg = s("svg", { viewBox: `0 0 ${L} ${A}`, class: "chart", role: "img", "aria-label": titolo },
      yt.map((v) => s("g", null,
        s("line", { class: "grid", x1: M.sinistra, x2: L - M.destra, y1: sy(v), y2: sy(v) }),
        s("text", { class: "tick", x: M.sinistra - 6, y: sy(v) + 4, "text-anchor": "end" }, formato(v)))));
    barre.forEach((b, i) => {
      const cx = M.sinistra + banda * (i + 0.5);
      const alto = sy(b.valore);
      const base = sy(0);
      const r = Math.min(4, (base - alto) / 2);
      // Estremità arrotondata in alto, squadrata sulla base
      const d = b.valore > 0
        ? `M${cx - larghezza / 2},${base}V${alto + r}Q${cx - larghezza / 2},${alto} ${cx - larghezza / 2 + r},${alto}H${cx + larghezza / 2 - r}Q${cx + larghezza / 2},${alto} ${cx + larghezza / 2},${alto + r}V${base}Z`
        : "";
      const g = s("g", { class: "bar-group" },
        d ? s("path", { class: "bar", d }) : null,
        s("text", { class: "tick", x: cx, y: A - M.giu + 16, "text-anchor": "middle" }, b.etichetta),
        (i === iMax || i === barre.length - 1) && b.valore > 0 ? s("text", { class: "bar-value", x: cx, y: alto - 6, "text-anchor": "middle" }, formato(b.valore)) : null,
        s("rect", { class: "hit", x: cx - banda / 2, y: 0, width: banda, height: A - M.giu }));
      const mostra = (e) => {
        const r2 = svg.getBoundingClientRect();
        fumetto.textContent = b.dettaglio || `${b.etichetta}: ${formato(b.valore)}`;
        fumetto.hidden = false;
        fumetto.style.left = `${Math.min(Math.max((cx / L) * r2.width, 70), r2.width - 70)}px`;
        svg.querySelectorAll(".bar-group").forEach((x) => x.classList.toggle("dim", x !== g));
        e.preventDefault?.();
      };
      g.addEventListener("pointerenter", mostra);
      g.addEventListener("pointerdown", mostra);
      g.addEventListener("pointerleave", () => {
        fumetto.hidden = true;
        svg.querySelectorAll(".bar-group").forEach((x) => x.classList.remove("dim"));
      });
      svg.append(g);
    });
    svg.append(s("line", { class: "axis", x1: M.sinistra, x2: L - M.destra, y1: sy(0), y2: sy(0) }));

    return h("figure", { class: "chart-figure" },
      h("figcaption", null, titolo),
      h("div", { class: "chart-box" }, svg, fumetto),
      tabella(["", "Valore"], barre.map((b) => [b.dettaglio || b.etichetta, formato(b.valore)])));
  }

  window.Grafici = { linea, colonne };
})();
