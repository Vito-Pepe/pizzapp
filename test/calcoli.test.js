const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../app/impasti/impasti-calcoli.js");

const vicino = (a, b, tolleranza, msg) => assert.ok(Math.abs(a - b) <= tolleranza, `${msg || ""} ${a} invece di ${b}`);
// Il programma con gli spazi normali al posto di quelli che non vanno a capo (tra numero e g)
const programma = (r) => {
  const p = C.programma(r);
  return { ...p, passi: p.passi.map((x) => ({ ...x, testo: x.testo.replace(/\u00a0/g, " ") })) };
};

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
  const testi = p.passi.map((x) => x.testo.replace(/\u00a0/g, " "));
  assert.ok(testi.some((t) => /^Fai 4 panetti da 250 g e mettili in frigo/.test(t)), testi.join(" | "));
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

test("tempo a disposizione: impasto, fasi, stesura e cottura fanno le ore che hai", () => {
  for (const stile of Object.keys(C.STILI)) {
    for (const ore of [3, 4.5, 8, 11, 24, 48, 96]) {
      for (const frigo of [true, false]) {
        const r = C.calcola({ stile, tempo: { modo: "ore", ore, frigo } });
        const { min, max } = C.limitiTempo(stile);
        const atteso = Math.min(Math.max(ore, min), max);
        vicino(C.tempoDaFasi(r.fasi), atteso, 1e-9, `${stile}, ${ore} ore:`);
        assert.ok(r.fasi.every((f) => f.ore > 0), `${stile}, ${ore} ore: fasi vuote`);
        vicino(C.programma(r).pasto, atteso, 1e-9, `${stile}, ${ore} ore, programma:`);
        const inizio = new Date("2026-11-01T10:00:00");
        const piano = C.pianifica(r, { inizio });
        if (stile !== "biga") vicino(piano.fine.getTime() - inizio.getTime(), atteso * 3600000, 1, "si mangia dopo le ore che hai");
      }
    }
  }
});

test("tempo a disposizione: come si dividono le fasi", () => {
  const fasi = (input) => C.calcola(input).fasi.map((f) => [f.fase, f.ore]);
  const tempo = (ore, frigo, extra = {}) => fasi({ stile: "personalizzata", tempo: { modo: "ore", ore, frigo }, ...extra });
  assert.deepEqual(tempo(24, true), [["puntata", 1], ["frigo", 18], ["appretto", 4]], "con il frigo");
  assert.deepEqual(tempo(48, true), [["puntata", 1], ["frigo", 41], ["appretto", 5]], "maturazione lunga: 5 ore di appretto");
  assert.deepEqual(tempo(10, true), [["puntata", 2], ["appretto", 7]], "con meno di 11 ore niente frigo");
  assert.deepEqual(tempo(10, false), [["puntata", 2], ["appretto", 7]]);
  assert.deepEqual(tempo(5, false), [["puntata", 1], ["appretto", 3]]);
  assert.deepEqual(tempo(3, false), [["puntata", 0.5], ["appretto", 1.5]], "il minimo: 3 ore");
  assert.deepEqual(tempo(1, false), [["puntata", 0.5], ["appretto", 1.5]], "sotto le 3 ore si conta 3");
  assert.deepEqual(fasi({ stile: "teglia", tempo: { modo: "ore", ore: 30, frigo: true } }), [["puntata", 1], ["frigo", 25], ["appretto", 3]], "in teglia 3 ore di appretto");
  assert.deepEqual(fasi({ stile: "biga", tempo: { modo: "ore", ore: 8, frigo: false } }), [["puntata", 1], ["appretto", 6]], "dopo la biga un'ora di puntata");
  // La Verace: solo a temperatura ambiente, alla sua temperatura, da 6 a 24 ore di lievitazione
  const verace = C.calcola({ stile: "verace", verace: { temp: 24 }, tempo: { modo: "ore", ore: 30, frigo: true } });
  assert.deepEqual(verace.fasi.map((f) => [f.fase, f.ore, f.temp]), [["puntata", 2, 24], ["appretto", 22, 24]]);
  // Le temperature vengono dalle impostazioni
  const caldo = C.calcola({ stile: "facile", tempo: { modo: "ore", ore: 24, frigo: true } }, { tempAmbiente: 26, tempFrigo: 6 });
  assert.deepEqual(caldo.fasi.map((f) => f.temp), [26, 6, 26]);
  // Con le fasi a mano il tempo non conta
  assert.deepEqual(tempo(8, false, { tempo: { modo: "fasi", ore: 8 }, fasi: { puntata: { ore: 3, temp: 20 }, appretto: { ore: 5, temp: 20 } } }), [["puntata", 3], ["appretto", 5]]);
});

test("tempo a disposizione: Pizza Facile e Verace salvate prima danno le stesse dosi", () => {
  for (const [ore, frigo] of [[24, true], [10, true], [8, false], [6, false], [48, true]]) {
    const prima = C.calcola({ stile: "facile", facile: { ore, frigo } });
    const ora = C.calcola({ stile: "facile", tempo: { modo: "ore", ore: ore + 1, frigo } });
    assert.deepEqual(ora.fasi, prima.fasi, `${ore} ore`);
    vicino(ora.lievito.grammi, prima.lievito.grammi, 1e-9);
  }
  const prima = C.calcola({ stile: "verace", verace: { ore: 12, temp: 22 } });
  const ora = C.calcola({ stile: "verace", verace: { temp: 22 }, tempo: { modo: "ore", ore: 13, frigo: false } });
  assert.deepEqual(ora.fasi, prima.fasi);
  // Senza tempo nell'impasto (ricette vecchie) restano le fasi di prima, non quelle predefinite
  assert.deepEqual(C.calcola({ stile: "teglia" }).fasi.map((f) => f.ore), [2, 24, 3]);
  assert.deepEqual(C.calcola({ stile: "facile", facile: { ore: 72, frigo: true } }).fasi.map((f) => f.ore), [1, 66, 5]);
});

test("programma: i passi in ore dall'impasto", () => {
  const r = C.calcola({ stile: "facile", forno: "casa", tempo: { modo: "ore", ore: 24, frigo: true } });
  const p = C.programma(r);
  const quando = (inizio) => p.passi.find((x) => x.testo.replace(/\u00a0/g, " ").startsWith(inizio))?.dopo;
  assert.equal(quando("Impasta"), 0);
  assert.equal(quando("Fai 4 panetti da 250 g e mettili in frigo"), 1.5);
  assert.equal(quando("Togli i panetti dal frigo"), 19.5);
  assert.equal(quando("Accendi il forno"), 22.5);
  assert.equal(quando("Stendi"), 23.5);
  assert.equal(p.pasto, 24);
  // La biga si prepara prima dell'impasto: ore con il segno meno
  const biga = C.programma(C.calcola({ stile: "biga", tempo: { modo: "ore", ore: 6, frigo: false } }));
  assert.equal(biga.passi[0].dopo, -18);
  assert.ok(biga.passi[0].testo.startsWith("Prepara la biga"));
  assert.equal(biga.pasto, 6);
});

test("passi dettagliati: impasto in quattro momenti con i grammi, panetti, controllo, forno e condimento", () => {
  const r = C.calcola({ stile: "facile", panetti: 6, peso: 250, forno: "casa", tempo: { modo: "ore", ore: 8, frigo: false } });
  const p = programma(r);
  const quando = (re) => p.passi.find((x) => re.test(x.testo))?.dopo;
  const minuti = (ore) => Math.round(ore * 60);
  assert.equal(minuti(quando(/^Impasta: sciogli il lievito fresco \(\d,\d g\) in \d+ g d'acqua/)), 0);
  assert.equal(minuti(quando(/^Aggiungi la farina poco per volta: \d+ g/)), 5);
  assert.equal(minuti(quando(/^Aggiungi il sale: \d+ g, poi l'olio: \d+ g/)), 10, "forno di casa: c'è l'olio");
  assert.equal(minuti(quando(/^Impasta finché è liscio/)), 15);
  assert.equal(minuti(quando(/^Copri l'impasto/)), 30);
  assert.equal(quando(/^Fai 6 panetti da 250 g$/), 2.5, "staglio dopo la puntata di 2 ore");
  assert.equal(quando(/^Controlla i panetti/), 2.5 + 2.5, "a metà dei 5 h di appretto");
  assert.equal(quando(/^Accendi il forno al massimo/), 6.5, "un'ora prima");
  assert.equal(quando(/^Prepara il condimento/), 7);
  assert.equal(quando(/^Stendi la prima pizza/), 7.5);
  assert.ok(p.passi.find((x) => x.testo.startsWith("Stendi la prima")).nota.includes("6-8 minuti"));
  assert.ok(p.passi.every((x) => typeof x.testo === "string" && x.testo.length > 5));
  for (let i = 1; i < p.passi.length; i++) assert.ok(p.passi[i].dopo >= p.passi[i - 1].dopo, "in ordine");
  assert.ok(!p.passi.some((x) => /pieghe/.test(x.testo)), "al 67% niente pieghe");
  // Impasto idratato: pieghe ogni 20 minuti nella puntata; fornetto e forno a legna con i loro tempi
  const idratato = programma(C.calcola({ stile: "personalizzata", idratazione: 72, forno: "fornetto", tempo: { modo: "ore", ore: 24, frigo: true } }));
  const pieghe = idratato.passi.filter((x) => /giro di pieghe/.test(x.testo)).map((x) => minuti(x.dopo));
  assert.deepEqual(pieghe, [50, 70], "puntata di un'ora dopo la mezz'ora d'impasto: pieghe a 20 e 40 minuti");
  assert.equal(idratato.passi.find((x) => x.testo.startsWith("Accendi il fornetto")).dopo, 23.5 - 0.5);
  const legna = programma(C.calcola({ stile: "verace", tempo: { modo: "ore", ore: 10 } }));
  assert.equal(legna.passi.find((x) => x.testo.startsWith("Accendi il forno a legna")).dopo, 9.5 - 1.5);
  assert.ok(legna.passi.find((x) => x.testo.startsWith("Stendi")).nota.includes("60-90 secondi"));
  // Teglia: panetti uno per teglia, pieghe e cottura in teglia
  const teglia = programma(C.calcola({ stile: "teglia", teglia: { forma: "rettangolare", lato1: 30, lato2: 40, numero: 2, grammatura: 0.55 }, tempo: { modo: "ore", ore: 30, frigo: true } }));
  assert.ok(teglia.passi.some((x) => /^Fai 2 panetti da 660 g \(uno per teglia\) e mettili in frigo/.test(x.testo)), teglia.passi.map((x) => x.testo).join(" | "));
  assert.ok(teglia.passi.some((x) => /giro di pieghe/.test(x.testo)));
  assert.ok(teglia.passi.some((x) => x.testo.startsWith("Stendi l'impasto nella teglia")));
  // Biga e lievito madre: i loro grammi nei passi
  const biga = C.calcola({ stile: "biga", tempo: { modo: "ore", ore: 6 } });
  const pb = programma(biga);
  assert.ok(pb.passi[0].testo.includes(`${C.grammi(biga.biga.farina)} g di farina`));
  assert.ok(pb.passi.some((x) => /^Impasto finale: spezzetta la biga/.test(x.testo)));
  const madre = C.calcola({ stile: "personalizzata", lievito: "madre", tempo: { modo: "ore", ore: 10 } });
  const pm = programma(madre);
  assert.ok(pm.passi[0].testo.startsWith(`Rinfresca il lievito madre: te ne servono ${C.grammi(madre.madre.grammi)} g`));
  assert.ok(pm.passi.some((x) => x.testo.startsWith(`Impasta: sciogli il lievito madre (${C.grammi(madre.madre.grammi)} g)`)));
});

test("ore contate in due modi: fino al pasto o solo lievitazione (come prima)", () => {
  assert.deepEqual(C.limitiTempo("facile", "lievitazione"), { min: 2, max: 95, frigoDa: 10 });
  assert.deepEqual(C.limitiTempo("verace", "lievitazione"), { min: 6, max: 24, frigoDa: 10 });
  assert.equal(C.convertiOre(24, "pasto", "lievitazione"), 23);
  assert.equal(C.convertiOre(23, "lievitazione", "pasto"), 24);
  assert.equal(C.convertiOre(8, "pasto", "pasto"), 8);
  // "24 ore di lievitazione" come la Pizza Facile di prima: stesse fasi, un'ora in più al pasto
  for (const [ore, frigo] of [[24, true], [8, false], [48, true], [10, true]]) {
    const prima = C.calcola({ stile: "facile", facile: { ore, frigo } });
    const lievitazione = C.calcola({ stile: "facile", tempo: { modo: "ore", conta: "lievitazione", ore, frigo } });
    const pasto = C.calcola({ stile: "facile", tempo: { modo: "ore", conta: "pasto", ore: C.convertiOre(ore, "lievitazione", "pasto"), frigo } });
    assert.deepEqual(lievitazione.fasi, prima.fasi, `${ore} ore di lievitazione`);
    assert.deepEqual(pasto.fasi, prima.fasi);
    assert.equal(C.programma(lievitazione).pasto, ore + 1);
  }
  // Senza conta valgono le ore fino al pasto
  assert.deepEqual(C.calcola({ stile: "facile", tempo: { modo: "ore", ore: 24, frigo: true } }).fasi.map((f) => f.ore), [1, 18, 4]);
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
