// Modello del lievito di PizzApp, ricostruito per uso personale e riscritto qui da zero.
// Lo usano ImpastiPLUS (sempre) e Impasti (se in Impostazioni si sceglie "PizzApp").
// Browser: window.LievitoPizzapp; test: require.
(function (radice) {
  "use strict";

  const N = 1.4496535328056595;

  // "Tempo caratteristico" a una temperatura: più fa caldo, più è corto (si dimezza ogni 5,4 °C circa)
  function k(temp) {
    return 2.52766 * Math.exp(-0.12816 * temp);
  }

  // Velocità rispetto a 20 °C, per confrontare il modello con le "ore a 20 °C" di Impasti
  function velocita(temp) {
    return k(20) / k(temp);
  }

  // Lievito di birra fresco, in % sulla farina, per una serie di fasi [{ore, temp}].
  // Con una fase sola: (k/ore)^1,45. Con temperatura ambiente e frigo PizzApp converte le ore della
  // prima fase in ore equivalenti alla seconda e le somma: è la stessa cosa di sommare ore/k per ogni fase.
  function percFresco(fasi) {
    const somma = fasi.reduce((s, f) => s + (f.ore > 0 ? f.ore / k(f.temp) : 0), 0);
    return somma > 0 ? Math.pow(somma, -N) * 100 : 0;
  }

  // Lievito secco: istantaneo (LSI) e attivo (LSA) rendono di più con il caldo
  function fattoreSecco(tipo, temp) {
    if (tipo === "LSI") return 1 / (0.0643 * temp + 1);
    if (tipo === "LSA") return 1 / (0.042 * temp + 1);
    return 1;
  }

  // Lievito madre: due curve (a polinomi) in funzione della temperatura
  function P(t) {
    return 0.00159331210952735 * t ** 4 - 0.163153907011014 * t ** 3 + 6.51108858674971 * t ** 2 - 120.920943205013 * t + 902.459330136656;
  }
  function Q(t) {
    return -0.000343046132670815 * t ** 4 + 0.0352173329513804 * t ** 3 - 1.4114518234581 * t ** 2 + 26.3558449944149 * t - 197.88697208344;
  }

  // Lievito madre in % sulla farina: solido (LMS) o liquido (LML, tre quarti del solido).
  // Le fasi si percorrono in ordine: le ore già fatte diventano ore equivalenti alla fase dopo.
  function percMadre(fasi, liquido = false) {
    let x = null;
    fasi.filter((f) => f.ore > 0).forEach((f) => {
      const t = Math.min(Math.max(f.temp, 1), 35);
      const ore = x == null ? f.ore : f.ore + Q(t) * Math.log(x) + P(t);
      x = Math.exp((ore - P(t)) / Q(t));
    });
    if (x == null) return 0;
    return Math.min(liquido ? 0.75 * x : x, 100);
  }

  // Grammi di lievito per un impasto, come li calcola PizzApp:
  // - la % diventa grammi con un ritocco sul peso della farina (1,8 · farina^-0,1);
  // - Verace ×0,9; Teglia ×2,2, calcolata sull'acqua e non sulla farina;
  // - con biga o poolish metà lievito (non per la Teglia, come in PizzApp);
  // - coeff è il ritocco dell'utente (da 0,5 a 1,5).
  // totale = impasto senza pasta di riporto; ingredienti = acqua + sale + grassi, in % sulla farina.
  function dosaggio({ totale, ingredienti, perc, teglia = false, acqua = 0, coeff = 1, prefermento = false }) {
    const tp = teglia ? 2.2 : 0.9;
    const f0 = totale / (1 + (ingredienti + perc) / 100);
    let grammi = coeff * tp * 1.8 * Math.pow(f0, -0.1) * ((f0 * perc) / 100);
    if (prefermento) grammi *= 0.5;
    const farina = totale / (1 + (ingredienti + (100 * grammi) / f0) / 100);
    if (teglia) grammi = coeff * tp * 1.8 * Math.pow(farina, -0.1) * ((((farina * acqua) / 100) * perc) / 100);
    return { grammi, farina };
  }

  const Modello = { N, k, velocita, percFresco, fattoreSecco, P, Q, percMadre, dosaggio };
  if (typeof module !== "undefined" && module.exports) module.exports = Modello;
  else radice.LievitoPizzapp = Modello;
})(typeof window !== "undefined" ? window : globalThis);
