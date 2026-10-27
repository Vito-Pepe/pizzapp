const test = require("node:test");
const assert = require("node:assert/strict");
const LP = require("../app/comune/lievito-pizzapp.js");
const C = require("../app/impasti/impasti-calcoli.js");

const vicino = (a, b, tolleranza, msg) => assert.ok(Math.abs(a - b) <= tolleranza, `${msg || ""} ${a} invece di ${b}`);

// Riferimento: i passaggi a due fasi (temperatura ambiente, poi frigo) come li fa PizzApp
const kk = (t) => 2.52766 * Math.exp(-0.12816 * t);
function riferimentoFresco(hTA, ta, hTC, tc) {
  const y1 = Math.pow(kk(ta) / hTA, 1.4496535328056595);
  if (!hTC) return y1 * 100;
  const heq = kk(tc) * Math.pow(y1, -0.68982);
  return Math.pow(kk(tc) / (hTC + heq), 1.4496535328056595) * 100;
}
function riferimentoMadre(hTA, ta, hTC, tc, liquido) {
  const x1 = Math.exp((hTA - LP.P(ta)) / LP.Q(ta));
  let x = x1;
  if (hTC) {
    const heq = Math.log(x1) * LP.Q(tc) + LP.P(tc);
    x = Math.exp((hTC + heq - LP.P(tc)) / LP.Q(tc));
  }
  return liquido ? 0.75 * x : x;
}

test("fresco: una fase", () => {
  vicino(LP.percFresco([{ ore: 8, temp: 20 }]), riferimentoFresco(8, 20), 1e-12);
  vicino(LP.percFresco([{ ore: 8, temp: 20 }]), 0.4581, 0.0005, "8 ore a 20 °C");
});

test("fresco: temperatura ambiente + frigo come in PizzApp", () => {
  for (const [a, ta, b, tc] of [[6, 20, 18, 4], [2, 22, 46, 5], [10, 18, 24, 6]]) {
    vicino(LP.percFresco([{ ore: a, temp: ta }, { ore: b, temp: tc }]), riferimentoFresco(a, ta, b, tc), 1e-6, `${a}h+${b}h`);
  }
  // l'ordine delle fasi non conta
  vicino(LP.percFresco([{ ore: 2, temp: 20 }, { ore: 18, temp: 4 }, { ore: 4, temp: 20 }]), riferimentoFresco(6, 20, 18, 4), 1e-6);
});

test("lievito madre solido e liquido", () => {
  vicino(LP.percMadre([{ ore: 8, temp: 20 }]), riferimentoMadre(8, 20), 1e-9);
  vicino(LP.percMadre([{ ore: 8, temp: 20 }], true), riferimentoMadre(8, 20, 0, 0, true), 1e-9);
  vicino(LP.percMadre([{ ore: 6, temp: 20 }, { ore: 18, temp: 4 }]), riferimentoMadre(6, 20, 18, 4), 1e-9);
  assert.ok(LP.percMadre([{ ore: 24, temp: 20 }]) < LP.percMadre([{ ore: 8, temp: 20 }]), "più ore, meno lievito madre");
});

test("secco istantaneo e attivo", () => {
  vicino(LP.fattoreSecco("LSI", 20), 1 / 2.286, 1e-9);
  vicino(LP.fattoreSecco("LSA", 20), 1 / 1.84, 1e-9);
  assert.equal(LP.fattoreSecco("LBF", 20), 1);
});

test("grammi: Verace, prefermento e Teglia", () => {
  const base = { totale: 1000, ingredienti: 67.5, perc: 0.4581 };
  const v = LP.dosaggio(base);
  vicino(v.grammi, 2.33, 0.01, "Verace");
  vicino(LP.dosaggio({ ...base, prefermento: true }).grammi, v.grammi / 2, 0.01, "metà con biga o poolish");
  const t = LP.dosaggio({ ...base, teglia: true, acqua: 65 });
  vicino(t.grammi, 2.2 * 1.8 * Math.pow(t.farina, -0.1) * t.farina * 0.65 * 0.004581, 1e-9, "Teglia sull'acqua");
  vicino(LP.dosaggio({ ...base, coeff: 1.2 }).grammi, v.grammi * 1.2, 0.01, "ritocco +20%");
});

test("Impasti con il modello PizzApp", () => {
  const fasi = { puntata: { ore: 2, temp: 20 }, frigo: { ore: 18, temp: 4 }, appretto: { ore: 4, temp: 20 } };
  const input = { stile: "personalizzata", panetti: 4, peso: 250, idratazione: 65, sale: 25, fasi };
  const imp = C.calcola(input, { modello: "impasti" });
  const pz = C.calcola(input, { modello: "pizzapp" });
  assert.equal(imp.modello, "impasti");
  assert.equal(pz.modello, "pizzapp");
  vicino(pz.lievito.grammi, 2.2, 0.05, "come PizzApp");
  assert.notEqual(Math.round(imp.lievito.grammi * 100), Math.round(pz.lievito.grammi * 100));
  vicino(C.calcola(input, { modello: "pizzapp", coeffPizzapp: 0.5 }).lievito.grammi, pz.lievito.grammi / 2, 0.02, "coefficiente");
  const secco = C.calcola({ ...input, lievito: "secco" }, { modello: "pizzapp" });
  vicino(secco.lievito.grammi / pz.lievito.grammi, LP.fattoreSecco("LSI", 20), 0.01, "secco");
  const madre = C.calcola({ ...input, lievito: "madre" }, { modello: "pizzapp" });
  assert.ok(madre.madre.suggerita > 5 && madre.madre.suggerita <= 80, `madre ${madre.madre.suggerita}`);
  // il grafico usa la curva del modello scelto
  vicino(C.doseBase(8, { modello: "pizzapp" }), 4.581, 0.01);
  vicino(C.doseBase(8, {}), 3.5, 0.05);
});
