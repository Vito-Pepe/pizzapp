const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../app/impastiplus/plus-calcoli.js");
const LP = require("../app/comune/lievito-pizzapp.js");

const vicino = (a, b, tolleranza, msg) => assert.ok(Math.abs(a - b) <= tolleranza, `${msg || ""} ${a} invece di ${b}`);

// Tutto quello che va nell'impasto, prefermenti compresi
function somma(r) {
  const m = r.impasto;
  let s = m.farine.reduce((a, f) => a + f.grammi, 0) + m.acqua + m.sale + m.grassi + m.lievito + m.pdrIn;
  if (r.poolish) s += r.poolish.farina + r.poolish.acqua + r.poolish.lievito;
  if (r.biga) s += r.biga.farina + r.biga.acqua + r.biga.lievito;
  if (r.autolisi) s += r.autolisi.farina + r.autolisi.acqua;
  return s;
}

test("impasto base come PizzApp (4 × 250 g, 60%, sale 3%, 8 ore a 20 °C)", () => {
  const r = P.calcola({ panielli: 4, peso: 250 });
  vicino(r.totale, 1000, 1e-9);
  vicino(r.perc, LP.percFresco([{ ore: 8, temp: 20 }]), 1e-12);
  const atteso = LP.dosaggio({ totale: 1000, ingredienti: 63, perc: r.perc });
  vicino(r.lievito, atteso.grammi, 1e-9);
  vicino(r.impasto.farina, atteso.farina, 1e-9);
  vicino(somma(r), 1000, 0.05, "somma");
  vicino(r.impasto.acqua / r.impasto.farina, 0.6, 1e-9);
});

test("due misure di panielli, pasta da tenere e scarto", () => {
  const r = P.calcola({ panielli: 4, peso: 250, panielli2: 2, peso2: 150, pdrOut: 100, scarto: 2 }, { dueMisure: true, pdrOut: true, scarto: true });
  vicino(r.totale, (1000 + 300 + 100) * 1.02, 1e-9);
  const spenti = P.calcola({ panielli: 4, peso: 250, panielli2: 2, peso2: 150, pdrOut: 100, scarto: 2 });
  vicino(spenti.totale, 1000, 1e-9, "campi spenti non contano");
});

test("frigo: come il modello a due fasi", () => {
  const r = P.calcola({ hta: 6, ta: 20, htc: 18, tc: 4 }, { tc: true });
  vicino(r.perc, LP.percFresco([{ ore: 6, temp: 20 }, { ore: 18, temp: 4 }]), 1e-12);
  assert.equal(r.oreTotali, 24);
});

test("secco istantaneo e attivo", () => {
  const f = P.calcola({});
  vicino(P.calcola({ lievito: "LSI" }).perc, f.perc * LP.fattoreSecco("LSI", 20), 1e-12);
  vicino(P.calcola({ lievito: "LSA" }).perc, f.perc * LP.fattoreSecco("LSA", 20), 1e-12);
  // se il frigo è più caldo dell'ambiente conta la sua temperatura (come PizzApp)
  const r = P.calcola({ lievito: "LSI", ta: 12, htc: 10, tc: 18 }, { tc: true });
  vicino(r.perc, LP.percFresco([{ ore: 8, temp: 12 }, { ore: 10, temp: 18 }]) * LP.fattoreSecco("LSI", 18), 1e-12);
});

test("lievito madre solido e liquido: farina e acqua del lievito tolte", () => {
  for (const tipo of ["LMS", "LML"]) {
    const r = P.calcola({ lievito: tipo });
    assert.ok(r.madre);
    vicino(r.madre.farina + r.madre.acqua, r.lievito, 1e-9);
    vicino(somma(r), 1000, 1e-6, tipo);
  }
  const s = P.calcola({ lievito: "LMS" });
  vicino(s.madre.farina, (s.lievito * 2) / 3, 1e-9, "solido: 2/3 farina");
});

test("Teglia: lievito calcolato sull'acqua", () => {
  const v = P.calcola({ acqua: 80 });
  const t = P.calcola({ acqua: 80, tipo: "teglia" });
  assert.ok(t.lievito > v.lievito * 1.5, `${t.lievito} vs ${v.lievito}`);
});

test("pasta di riporto: meno lievito, entra nell'impasto", () => {
  const senza = P.calcola({});
  const con = P.calcola({ pdrIn: 10, pdrForza: "alta" }, { pdrIn: true });
  vicino(con.pdrIn, 100, 1e-9);
  vicino(con.perc, senza.perc - 0.0058 * 10, 1e-12);
  vicino(somma(con), 1000, 0.05);
});

test("poolish, biga e autolisi", () => {
  // Poolish corto: il suo lievito supera quello di tutto l'impasto, come in PizzApp scatta l'avviso
  const corto = P.calcola({ poolish: { perc: 30, ore: 4 } }, { poolish: true });
  assert.ok(corto.poolish.lievito > corto.lievito);
  assert.ok(corto.avvisi.some((a) => a.includes("lievitazione eccessiva")));
  assert.equal(corto.impasto.lievito, 0);

  const r = P.calcola({ poolish: { perc: 30, ore: 16 }, autolisi: { perc: 50, acqua: 55 } }, { poolish: true, autolisi: true });
  const F = r.farina;
  assert.equal(r.avvisi.length, 0);
  vicino(r.poolish.farina, F * 0.3, 1e-9);
  vicino(r.poolish.acqua, r.poolish.farina, 1e-9);
  vicino(r.poolish.lievito, (r.poolish.farina * 3.9 * Math.exp(-0.23 * 16)) / 100, 1e-9);
  vicino(r.autolisi.farina, F * 0.5, 1e-9);
  vicino(r.autolisi.acqua, r.autolisi.farina * 0.55, 1e-9);
  vicino(r.impasto.farina, F * 0.2, 1e-9);
  vicino(somma(r), 1000, 0.05, "somma con poolish e autolisi");
  // con un prefermento il lievito totale è la metà
  vicino(r.lievito, LP.dosaggio({ totale: 1000, ingredienti: 63, perc: r.perc, prefermento: true }).grammi, 1e-9);

  const b = P.calcola({ biga: { perc: 20 }, hta: 3 }, { biga: true });
  assert.equal(b.avvisi.length, 0);
  vicino(b.biga.acqua, b.biga.farina * 0.45, 1e-9);
  vicino(b.biga.lievito, b.biga.farina / 100, 1e-9);
  vicino(somma(b), 1000, 0.05, "somma con biga");
});

test("avvisi ed errori", () => {
  const troppo = P.calcola({ biga: { perc: 100 }, hta: 24 }, { biga: true });
  assert.ok(troppo.avvisi.some((a) => a.includes("lievitazione eccessiva")));
  assert.equal(troppo.impasto.lievito, 0);
  const oltre = P.calcola({ poolish: { perc: 60, ore: 4 }, autolisi: { perc: 50, acqua: 55 } }, { poolish: true, autolisi: true });
  assert.ok(oltre.errori.some((e) => e.includes("100%")));
  const farine = P.calcola({ farine: [{ id: "", perc: 70 }, { id: "", perc: 20 }] }, { numFarine: 2 });
  assert.ok(farine.errori.some((e) => e.includes("non arriva al 100%")));
  const ok = P.calcola({ farine: [{ id: "a", perc: 70 }, { id: "b", perc: 30 }] }, { numFarine: 2 }, [{ id: "a", nome: "A", W: 300 }, { id: "b", nome: "B", W: 200 }]);
  assert.equal(ok.errori.length, 0);
  vicino(ok.wMedio, 270, 1e-9);
  assert.deepEqual(ok.impasto.farine.map((f) => f.nome), ["A", "B"]);
});

test("ritocco del lievito", () => {
  vicino(P.calcola({}, { coeff: 1.3 }).lievito, P.calcola({}).lievito * 1.3, 0.01);
});

test("utilità: acqua, W, teglia", () => {
  assert.equal(P.temperaturaAcqua({ voluta: 24, ambiente: 20, attrito: 9 }), 24);
  assert.equal(P.temperaturaAcqua({ voluta: 18, ambiente: 28, attrito: 9 }), 4, "mai sotto i 4 °C");
  assert.deepEqual(P.dueFarine({ voluta: 300, w1: 200, w2: 400 }), { p1: 50, p2: 50 });
  assert.equal(P.dueFarine({ voluta: 500, w1: 200, w2: 400 }), null);
  assert.deepEqual(P.wMix([{ perc: 60, w: 300 }, { perc: 40, w: 200 }]), { somma: 100, w: 260 });
  vicino(P.pesoTeglia({ forma: "rettangolare", lato1: 30, lato2: 40 }).peso, 600, 1e-9);
  vicino(P.pesoTeglia({ forma: "tonda", diametro: 30, ritocco: 20 }).peso, Math.PI * 225 * 0.5 * 1.2, 1e-9);
  vicino(P.wConsigliata(8), 245, 1);
  assert.equal(P.grammiLievito(2.345), "2,35");
  assert.equal(P.grammiLievito(12.34), "12,3");
});
