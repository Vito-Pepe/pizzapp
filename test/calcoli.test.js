const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../app/impasti/impasti-calcoli.js");

const vicino = (a, b, tolleranza, msg) => assert.ok(Math.abs(a - b) <= tolleranza, `${msg || ""} ${a} invece di ${b}`);

// Tutti gli ingredienti messi insieme devono dare il peso dell'impasto
function sommaIngredienti(r) {
  if (r.biga) return r.biga.farina + r.biga.acqua + r.biga.lievito + r.rinfresco.farina + r.rinfresco.acqua + r.rinfresco.sale + r.rinfresco.olio + r.rinfresco.zucchero + r.rinfresco.lievito;
  const madre = r.madre ? r.madre.grammi : 0;
  return r.daAggiungere.farina + r.daAggiungere.acqua + madre + r.sale + r.olio + r.zucchero + (r.lievito.tipo === "madre" ? 0 : r.lievito.grammi);
}

test("velocità della lievitazione", () => {
  vicino(C.velocita(20), 1, 1e-9);
  vicino(C.velocita(4), 0.19, 0.02, "frigo");
  vicino(C.velocita(30), 2.58, 0.05, "30 °C");
  assert.equal(C.velocita(40), C.velocita(32), "sopra i 32 °C non accelera");
});

test("curva predefinita del lievito", () => {
  vicino(C.dosePredefinita(8), 3.5, 0.05);
  vicino(C.dosePredefinita(24), 0.9, 0.03);
  assert.ok(C.dosePredefinita(2) > C.dosePredefinita(4));
  assert.equal(C.curvaPredefinita().length, 10);
});

test("curva personalizzata: punti, interpolazione, estrapolazione", () => {
  const curva = [{ ore: 4, dose: 8 }, { ore: 8, dose: 4 }, { ore: 16, dose: 2 }];
  vicino(C.doseDaCurva(8, curva), 4, 1e-9, "sul punto");
  vicino(C.doseDaCurva(Math.sqrt(4 * 8), curva), Math.sqrt(8 * 4), 1e-9, "a metà in scala log");
  vicino(C.doseDaCurva(32, curva), 1, 1e-9, "oltre l'ultimo punto, con la pendenza dell'ultimo tratto");
  vicino(C.doseDaCurva(2, curva), 16, 1e-9, "prima del primo punto");
  assert.equal(C.curvaValida([{ ore: 4, dose: 2 }]), null, "un punto solo non basta");
  vicino(C.doseDaCurva(8, [{ ore: 4, dose: 0 }]), C.dosePredefinita(8), 1e-9, "curva non valida: si usa la predefinita");
});

test("il frigo conta meno ore", () => {
  const ambiente = C.doseLievito({ fasi: [{ ore: 24, temp: 20 }] }).dose;
  const frigo = C.doseLievito({ fasi: [{ ore: 2, temp: 20 }, { ore: 18, temp: 4 }, { ore: 4, temp: 20 }] }).dose;
  assert.ok(frigo > ambiente, "con il frigo serve più lievito a parità di ore");
});

test("Pizza Facile: i conti tornano", () => {
  const r = C.calcola({ stile: "facile", panetti: 6, peso: 250, facile: { ore: 24, frigo: true } });
  vicino(r.totale, 1500, 1e-6);
  vicino(sommaIngredienti(r), 1500, 1e-6, "somma");
  vicino(r.acqua / r.farina, 0.67, 1e-9, "forno di casa: 67%");
  assert.deepEqual(r.fasi.map((f) => f.fase), ["puntata", "frigo", "appretto"]);
  assert.equal(r.oreTotali, 24);
  assert.ok(r.lievito.grammi > 1 && r.lievito.grammi < 6, `lievito ${r.lievito.grammi}`);
});

test("Pizza Facile senza frigo", () => {
  const r = C.calcola({ stile: "facile", panetti: 2, peso: 250, facile: { ore: 8, frigo: false } });
  assert.deepEqual(r.fasi.map((f) => [f.fase, f.ore]), [["puntata", 2], ["appretto", 6]]);
});

test("lievito secco: un terzo del fresco", () => {
  const base = { stile: "personalizzata", panetti: 4, peso: 250 };
  const fresco = C.calcola({ ...base, lievito: "fresco" });
  const secco = C.calcola({ ...base, lievito: "secco" });
  vicino(secco.lievito.grammi / fresco.lievito.grammi, 1 / 3, 0.01);
  vicino(sommaIngredienti(secco), 1000, 1e-6);
});

test("lievito madre: farina e acqua del lievito si tolgono dagli ingredienti", () => {
  const r = C.calcola({ stile: "personalizzata", panetti: 4, peso: 250, idratazione: 65, lievito: "madre", madre: { percentuale: 20, idratazione: 100 } });
  vicino(r.madre.grammi, r.farina * 0.2, 1e-9);
  vicino(r.daAggiungere.farina + r.madre.farina, r.farina, 1e-9);
  vicino(r.daAggiungere.acqua + r.madre.acqua, r.acqua, 1e-9);
  vicino(sommaIngredienti(r), 1000, 1e-6, "somma");
  const auto = C.calcola({ stile: "personalizzata", panetti: 4, peso: 250, lievito: "madre" });
  assert.equal(auto.madre.percentuale, auto.madre.suggerita, "senza percentuale si usa quella suggerita");
});

test("biga: biga + rinfresco = impasto", () => {
  const r = C.calcola({ stile: "biga", panetti: 6, peso: 260, idratazione: 70, biga: { percentuale: 100, idratazione: 45, lievito: 1, ore: 18, temp: 18 } });
  vicino(sommaIngredienti(r), 1560, 1e-6, "somma");
  vicino(r.biga.acqua, r.biga.farina * 0.45, 1e-9);
  vicino(r.biga.lievito, r.biga.farina * 0.01, 1e-9);
  vicino(r.rinfresco.farina, 0, 1e-9, "biga al 100%: nel rinfresco solo acqua e sale");
  vicino(r.biga.acqua + r.rinfresco.acqua, r.farina * 0.7, 1e-9);
  const meta = C.calcola({ stile: "biga", panetti: 6, peso: 260, biga: { percentuale: 50 } });
  vicino(meta.biga.farina, meta.farina / 2, 1e-9);
});

test("biga: avviso se l'idratazione totale è più bassa di quella della biga", () => {
  const r = C.calcola({ stile: "biga", idratazione: 40, biga: { percentuale: 100, idratazione: 50 } });
  assert.ok(r.avvisi.some((a) => a.includes("idratazione totale")));
});

test("teglia: peso dalla superficie", () => {
  const r = C.calcola({ stile: "teglia", teglia: { forma: "rettangolare", lato1: 30, lato2: 40, numero: 2, grammatura: 0.55 } });
  vicino(r.totale, 30 * 40 * 0.55 * 2, 1e-6);
  vicino(r.teglia.perTeglia, 660, 1e-6);
  const tonda = C.calcola({ stile: "teglia", teglia: { forma: "tonda", diametro: 30, numero: 1, grammatura: 0.5 } });
  vicino(tonda.totale, Math.PI * 225 * 0.5, 1e-6);
});

test("Verace: sale a 50 g per litro d'acqua, niente olio", () => {
  const r = C.calcola({ stile: "verace", panetti: 4, peso: 250, idratazione: 60, olio: 30, verace: { ore: 8, temp: 22 } });
  vicino(r.sale, r.acqua * 0.05, 1e-9);
  assert.equal(r.olio, 0);
  vicino(sommaIngredienti(r), 1000, 1e-6);
  assert.deepEqual(r.fasi.map((f) => [f.fase, f.ore, f.temp]), [["puntata", 2, 22], ["appretto", 6, 22]]);
});

test("scarto: impasto in più", () => {
  const r = C.calcola({ stile: "personalizzata", panetti: 4, peso: 250, scarto: 2 });
  vicino(r.totale, 1020, 1e-6);
});

test("mix di farine e W media", () => {
  const db = [{ id: "a", nome: "A", W: 300 }, { id: "b", nome: "B", W: 200 }];
  const r = C.calcola({ stile: "personalizzata", panetti: 4, peso: 250, farine: [{ id: "a", perc: 3 }, { id: "b", perc: 1 }] }, {}, db);
  vicino(r.wMedio, 275, 1e-9);
  vicino(r.farine[0].grammi + r.farine[1].grammi, r.daAggiungere.farina, 1e-9);
  vicino(r.farine[0].perc, 75, 1e-9);
});

test("avviso per farina debole con tempi lunghi", () => {
  const db = [{ id: "debole", nome: "Debole", W: 180 }];
  const r = C.calcola({ stile: "personalizzata", farine: [{ id: "debole", perc: 100 }], fasi: { puntata: { ore: 2, temp: 20 }, frigo: { ore: 46, temp: 4 }, appretto: { ore: 4, temp: 20 } } }, {}, db);
  assert.ok(r.avvisi.some((a) => a.includes("debole")));
});

test("pianificazione all'indietro dall'ora in cui si mangia", () => {
  const r = C.calcola({ stile: "personalizzata", fasi: { puntata: { ore: 2, temp: 20 }, frigo: { ore: 20, temp: 4 }, appretto: { ore: 4, temp: 20 } }, forno: "casa" });
  const mangiare = new Date("2026-11-01T20:00:00");
  const p = C.pianifica(r, { mangiare });
  assert.equal(p.fine.getTime(), mangiare.getTime());
  assert.equal(p.ore, 0.5 + 26 + 0.5);
  assert.equal(p.inizio.getTime(), mangiare.getTime() - 27 * 3600000);
  const testi = p.passi.map((x) => x.testo);
  assert.ok(testi.some((t) => t.startsWith("Fai i panetti e mettili in frigo")));
  assert.ok(testi.some((t) => t.startsWith("Accendi il forno")));
  for (let i = 1; i < p.passi.length; i++) assert.ok(p.passi[i].quando >= p.passi[i - 1].quando, "passi in ordine");
});

test("pianificazione in avanti, con biga e lievito madre", () => {
  const inizio = new Date("2026-11-01T08:00:00");
  const biga = C.pianifica(C.calcola({ stile: "biga" }), { inizio });
  assert.equal(biga.barre[0].fase, "biga");
  assert.equal(biga.inizio.getTime(), inizio.getTime());
  const madre = C.pianifica(C.calcola({ stile: "personalizzata", lievito: "madre" }), { inizio }, { oreRinfrescoMadre: 5 });
  assert.equal(madre.barre[0].fase, "rinfrescoMadre");
  assert.equal(madre.barre[0].ore, 5);
});

test("consigli dopo la cottura", () => {
  const c = C.consigliCottura({ problemi: ["collassato", "bruciato"], voti: { sapore: 4 } });
  assert.equal(c.length, 2);
  const solo = C.consigliCottura({ problemi: [], voti: { stesura: 1 } });
  assert.equal(solo[0].titolo, "Lavorabilità");
  assert.equal(C.consigliCottura({ voti: { sapore: 5 } }).length, 0);
});

test("rinfresco del lievito madre", () => {
  const r = C.rinfrescoMadre({ serve: 150, scorta: 30, rapporto: { madre: 1, farina: 1, acqua: 1 } });
  vicino(r.madre + r.farina + r.acqua, 180, 1e-9);
  vicino(r.madre, 60, 1e-9);
  const solido = C.rinfrescoMadre({ serve: 100, scorta: 0, rapporto: { madre: 1, farina: 2, acqua: 1 } });
  vicino(solido.farina, 50, 1e-9);
});

test("farine: W consigliata e stima dalle proteine", () => {
  assert.deepEqual(C.intervalloW(24), { min: 250, max: 310 });
  assert.deepEqual(C.stimaW(12.5), { min: 260, max: 310 });
  assert.equal(C.stimaW(null), null);
});

test("numeri in italiano", () => {
  assert.equal(C.grammi(0.456), "0,46");
  assert.equal(C.grammi(3.24), "3,2");
  assert.equal(C.grammi(1234.4), "1234");
  assert.equal(C.grammi(12345), "12.345");
});
