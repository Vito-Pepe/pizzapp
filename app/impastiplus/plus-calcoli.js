// Calcoli di ImpastiPLUS: le dosi come le dà PizzApp (stessa logica, riscritta da zero),
// più le utilità (temperatura dell'acqua, W, teglia). Nessuna dipendenza dalla pagina.
(function (radice) {
  "use strict";

  const LP = typeof module !== "undefined" && module.exports ? require("../comune/lievito-pizzapp.js") : radice.LievitoPizzapp;

  const LIEVITI = {
    LBF: { sigla: "LBF", nome: "Lievito di birra fresco", breve: "Fresco" },
    LSI: { sigla: "LSI", nome: "Lievito di birra secco istantaneo", breve: "Secco istantaneo" },
    LSA: { sigla: "LSA", nome: "Lievito di birra secco attivo", breve: "Secco attivo" },
    LMS: { sigla: "LMS", nome: "Lievito madre solido", breve: "Madre solido" },
    LML: { sigla: "LML", nome: "Lievito madre liquido", breve: "Madre liquido" },
  };

  // Quanto la pasta di riporto (da un impasto precedente) sostituisce il lievito, per ogni punto %
  const FORZA_PDR = { bassa: 0.0029, alta: 0.0058 };

  // Calore dato dall'impastatrice (gradi), per la temperatura dell'acqua
  const IMPASTATRICI = [
    { id: "forcella", nome: "Forcella", attrito: 3 },
    { id: "spirale", nome: "Spirale", attrito: 9 },
    { id: "planetaria", nome: "Planetaria", attrito: 9 },
    { id: "bracci", nome: "Bracci tuffanti", attrito: 6 },
    { id: "mani", nome: "A mano", attrito: 1 },
  ];

  const PREDEFINITO = {
    panielli: 4, peso: 250, panielli2: 2, peso2: 180,
    tipo: "verace",
    farine: [{ id: "", perc: 100 }, { id: "", perc: 0 }, { id: "", perc: 0 }, { id: "", perc: 0 }, { id: "", perc: 0 }, { id: "", perc: 0 }],
    acqua: 60, sale: 3, grassi: 0,
    hta: 8, ta: 20, htc: 0, tc: 5,
    lievito: "LBF",
    pdrIn: 0, pdrForza: "bassa", pdrOut: 0,
    poolish: { perc: 30, ore: 4 },
    biga: { perc: 30 },
    autolisi: { perc: 50, acqua: 55 },
    scarto: 0,
  };

  // Campi da mostrare (Impostazioni): spenti, non contano nel calcolo
  const OPZIONI = {
    dueMisure: false, numFarine: 1, grassi: false, tc: false, pdrIn: false, pdrOut: false,
    poolish: false, biga: false, autolisi: false, scarto: false, coeff: 1, schermo: false,
  };

  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

  function calcola(inputGrezzo, opzioniGrezze = {}, farineDb = []) {
    const i = { ...PREDEFINITO, ...inputGrezzo };
    const o = { ...OPZIONI, ...opzioniGrezze };
    const avvisi = [];
    const errori = [];
    const coeff = Math.min(Math.max(num(o.coeff, 1), 0.5), 1.5);

    // Peso dell'impasto: panielli (anche di due misure) + pasta da tenere da parte, più lo scarto
    const pdrOut = o.pdrOut ? Math.max(num(i.pdrOut), 0) : 0;
    const scarto = o.scarto ? Math.min(Math.max(num(i.scarto), 0), 5) : 0;
    const panielli = Math.max(Math.round(num(i.panielli, 1)), 1) * Math.max(num(i.peso), 0) + (o.dueMisure ? Math.max(Math.round(num(i.panielli2)), 0) * Math.max(num(i.peso2), 0) : 0);
    const totale = (panielli + pdrOut) * (1 + scarto / 100);
    const pdrPerc = o.pdrIn ? Math.min(Math.max(num(i.pdrIn), 0), 20) : 0;
    const pdrIn = (totale * pdrPerc) / 100;

    const acqua = Math.min(Math.max(num(i.acqua, 60), 40), 100);
    const sale = Math.min(Math.max(num(i.sale, 3), 0), 6);
    const grassi = o.grassi ? Math.min(Math.max(num(i.grassi), 0), 10) : 0;
    const ingredienti = acqua + sale + grassi;

    // Lievitazione: a temperatura ambiente (TA) e, se acceso, a temperatura controllata (TC, il frigo)
    const hta = Math.max(num(i.hta, 8), 1);
    const ta = num(i.ta, 20);
    const conTc = o.tc && num(i.htc) > 0;
    const fasi = [{ ore: hta, temp: ta }];
    if (conTc) fasi.push({ ore: num(i.htc), temp: num(i.tc, 5) });
    const oreTotali = fasi.reduce((s, f) => s + f.ore, 0);

    // % di lievito sulla farina secondo il modello
    const tipoLievito = LIEVITI[i.lievito] ? i.lievito : "LBF";
    const forza = o.pdrIn ? FORZA_PDR[i.pdrForza] || 0 : 0;
    let perc;
    if (tipoLievito === "LMS" || tipoLievito === "LML") {
      perc = LP.percMadre(fasi, tipoLievito === "LML");
    } else {
      perc = LP.percFresco(fasi) - forza * pdrPerc;
      const tSecco = conTc && ta < num(i.tc, 5) ? num(i.tc, 5) : ta;
      perc *= LP.fattoreSecco(tipoLievito, tSecco);
    }
    perc = Math.max(perc, 0);

    const conPoolish = Boolean(o.poolish);
    const conBiga = Boolean(o.biga);
    const teglia = i.tipo === "teglia";
    const d = LP.dosaggio({ totale: totale - pdrIn, ingredienti, perc, teglia, acqua, coeff, prefermento: conPoolish || conBiga });
    const lievito = d.grammi;
    let farina = d.farina;

    // Il lievito madre porta farina e acqua: si tolgono dagli ingredienti
    let madre = null;
    if (tipoLievito === "LMS" || tipoLievito === "LML") {
      madre = tipoLievito === "LMS" ? { farina: (lievito * 2) / 3, acqua: lievito / 3 } : { farina: lievito / 2, acqua: lievito / 2 };
      farina = (totale - pdrIn) / (1 + ingredienti / 100) - madre.farina;
    }
    const farinaConMadre = farina + (madre ? madre.farina : 0);
    const acquaTotale = (farinaConMadre * acqua) / 100 - (madre ? madre.acqua : 0);
    const saleG = (farinaConMadre * sale) / 100;
    const grassiG = (farinaConMadre * grassi) / 100;

    // Prefermenti e autolisi: parte della farina (e dell'acqua) lavora prima
    const fattorePre = tipoLievito === "LSI" ? 0.45 : tipoLievito === "LSA" ? 0.54 : 1;
    const autolisi = o.autolisi ? (() => {
      const f = (farina * Math.min(Math.max(num(i.autolisi?.perc, 50), 0), 100)) / 100;
      return { farina: f, acqua: (f * Math.min(Math.max(num(i.autolisi?.acqua, 55), 0), 100)) / 100, perc: num(i.autolisi?.perc, 50), percAcqua: num(i.autolisi?.acqua, 55) };
    })() : null;
    const poolish = conPoolish ? (() => {
      const ore = Math.max(num(i.poolish?.ore, 4), 0);
      const f = ore > 0 ? (farina * Math.min(Math.max(num(i.poolish?.perc, 30), 0), 100)) / 100 : 0;
      return { farina: f, acqua: f, lievito: ((f * 3.9 * Math.exp(-0.23 * ore)) / 100) * fattorePre, ore, perc: num(i.poolish?.perc, 30) };
    })() : null;
    const biga = conBiga ? (() => {
      const f = (farina * Math.min(Math.max(num(i.biga?.perc, 30), 0), 100)) / 100;
      return { farina: f, acqua: f * 0.45, lievito: (f / 100) * fattorePre, perc: num(i.biga?.perc, 30) };
    })() : null;

    const lievitoPre = (poolish ? poolish.lievito : 0) + (biga ? biga.lievito : 0);
    if ((poolish && lievito - poolish.lievito < 0.25 * lievito) || (biga && lievito - biga.lievito < 0.25 * lievito)) {
      avvisi.push("Attenzione: rischio di lievitazione eccessiva. Nel prefermento c'è già quasi tutto il lievito che serve all'impasto: riduci la sua percentuale o accorcia i suoi tempi.");
    }
    const percPre = (poolish ? poolish.perc : 0) + (biga ? biga.perc : 0);
    if (autolisi && autolisi.perc + percPre > 100) errori.push("Autolisi e prefermenti insieme superano il 100% della farina.");
    if (poolish && biga && percPre > 100) errori.push("Poolish e biga insieme superano il 100% della farina.");

    // Farine del mix
    const n = Math.min(Math.max(Math.round(num(o.numFarine, 1)), 1), 6);
    const scelte = (i.farine || PREDEFINITO.farine).slice(0, n);
    while (scelte.length < n) scelte.push({ id: "", perc: 0 });
    const somma = scelte.reduce((s, f) => s + num(f.perc), 0);
    if (n > 1 && Math.abs(somma - 100) > 0.001) errori.push(somma > 100 ? "Farine: la somma delle percentuali supera il 100%." : "Farine: la somma delle percentuali non arriva al 100%.");
    const farinaImpasto = farina - (autolisi ? autolisi.farina : 0) - (poolish ? poolish.farina : 0) - (biga ? biga.farina : 0);
    const farine = scelte.map((f, k) => {
      const db = farineDb.find((x) => x.id === f.id);
      const perc = n === 1 ? 100 : num(f.perc);
      return { nome: db ? db.nome : `Farina ${k + 1}`, W: db?.W ? Number(db.W) : null, perc, grammi: (farinaImpasto * perc) / 100 };
    });
    const wMedio = farine.every((f) => f.W) && (n === 1 || Math.abs(somma - 100) < 0.001) ? farine.reduce((s, f) => s + (f.W * f.perc) / 100, 0) : null;

    const acquaImpasto = acquaTotale - (poolish ? poolish.acqua : 0) - (biga ? biga.acqua : 0) - (autolisi ? autolisi.acqua : 0);
    if (acquaImpasto < -0.5) errori.push("L'acqua dei prefermenti e dell'autolisi supera quella dell'impasto: abbassa le loro percentuali o alza l'idratazione.");

    return {
      input: i,
      opzioni: o,
      totale,
      panielli,
      scarto,
      pdrIn,
      pdrPerc,
      pdrOut,
      tipoLievito,
      perc,
      lievito,
      farina: farinaConMadre,
      acqua: acquaTotale + (madre ? madre.acqua : 0),
      sale: saleG,
      grassi: grassiG,
      madre,
      autolisi,
      poolish,
      biga,
      impasto: {
        farine,
        farina: farinaImpasto,
        acqua: acquaImpasto,
        sale: saleG,
        grassi: grassiG,
        lievito: madre ? lievito : Math.max(lievito - lievitoPre, 0),
        pdrIn,
      },
      oreTotali,
      wMedio,
      wConsigliata: wConsigliata(oreTotali),
      avvisi,
      errori,
    };
  }

  // --- Utilità ---

  // Forza consigliata per la durata della lievitazione (W ≈ 76·ln(ore) + 87)
  function wConsigliata(ore) {
    return ore > 0 ? 75.806 * Math.log(ore) + 87.446 : null;
  }

  // Temperatura dell'acqua per avere l'impasto alla temperatura voluta (mai sotto i 4 °C)
  function temperaturaAcqua({ voluta, ambiente, attrito }) {
    return Math.max(num(voluta) * 3 - num(ambiente) - (num(ambiente) - 1) - num(attrito), 4);
  }

  // Percentuali di due farine per arrivare alla W voluta
  function dueFarine({ voluta, w1, w2 }) {
    const a = num(w1);
    const b = num(w2);
    const w = num(voluta);
    if (a === b || w < Math.min(a, b) || w > Math.max(a, b)) return null;
    const p2 = (100 * (w - a)) / (b - a);
    return { p1: 100 - p2, p2 };
  }

  // W del mix di più farine
  function wMix(righe) {
    const somma = righe.reduce((s, r) => s + num(r.perc), 0);
    return { somma, w: righe.reduce((s, r) => s + (num(r.perc) * num(r.w)) / 100, 0) };
  }

  // Impasto per una teglia: 0,5 g per cm², da ritoccare tra −20% e +20%
  function pesoTeglia({ forma, lato1, lato2, diametro, ritocco = 0 }) {
    const area = forma === "tonda" ? Math.PI * Math.pow(num(diametro) / 2, 2) : num(lato1) * num(lato2);
    return { area, peso: area * 0.5 * (1 + Math.min(Math.max(num(ritocco), -20), 20) / 100) };
  }

  // Grammi del lievito con i decimali che servono (come PizzApp)
  function grammiLievito(g) {
    const dec = g > 100 ? 0 : g > 10 ? 1 : g > 0.1 ? 2 : 3;
    return formatta(g, dec);
  }

  function formatta(n, decimali = 0) {
    if (n == null || !Number.isFinite(n)) return "–";
    return Number(n).toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: decimali });
  }

  const CalcoliPlus = { LIEVITI, FORZA_PDR, IMPASTATRICI, PREDEFINITO, OPZIONI, calcola, wConsigliata, temperaturaAcqua, dueFarine, wMix, pesoTeglia, grammiLievito, formatta };
  if (typeof module !== "undefined" && module.exports) module.exports = CalcoliPlus;
  else radice.CalcoliPlus = CalcoliPlus;
})(typeof window !== "undefined" ? window : globalThis);
