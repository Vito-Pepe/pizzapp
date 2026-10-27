// Calcoli degli impasti: dosi, lievito per tempo e temperatura, fasi, pianificazione e consigli.
// Nessuna dipendenza dalla pagina: lo usano il browser (window.Calcoli) e i test (require).
(function (radice) {
  "use strict";

  const TEMP_RIF = 20;

  // --- Lievitazione ---

  // Velocità della lievitazione rispetto a 20 °C (legge di Arrhenius, circa 70 kJ/mol):
  // a 4 °C è circa un quinto, a 30 °C circa due volte e mezza. Sopra i 32 °C non accelera più.
  function velocita(temp) {
    const t = Math.min(Math.max(Number(temp) || 0, 0), 32);
    return Math.exp((70000 / 8.314) * (1 / (TEMP_RIF + 273.15) - 1 / (t + 273.15)));
  }

  // Ore "come se fossero a 20 °C": somma delle ore di ogni fase pesate per la sua velocità
  function oreEquivalenti(fasi) {
    return fasi.reduce((s, f) => s + (Number(f.ore) || 0) * velocita(f.temp), 0);
  }

  // Curva predefinita: grammi di lievito fresco per kg di farina in funzione delle ore a 20 °C.
  // Taratura iniziale: 8 ore -> 3,5 g/kg, 24 ore -> 0,9 g/kg (valori d'uso comune).
  const CURVA_A = 45.7;
  const CURVA_B = 1.236;
  const ORE_CURVA = [2, 4, 6, 8, 12, 18, 24, 36, 48, 72];

  function dosePredefinita(ore) {
    return CURVA_A * Math.pow(Math.max(ore, 0.5), -CURVA_B);
  }

  function curvaPredefinita() {
    return ORE_CURVA.map((ore) => ({ ore, dose: arrotonda(dosePredefinita(ore), 2) }));
  }

  function curvaValida(curva) {
    if (!Array.isArray(curva)) return null;
    const punti = curva
      .map((p) => ({ ore: Number(p.ore), dose: Number(p.dose) }))
      .filter((p) => p.ore > 0 && p.dose > 0)
      .sort((a, b) => a.ore - b.ore)
      .filter((p, i, l) => i === 0 || p.ore !== l[i - 1].ore);
    return punti.length >= 2 ? punti : null;
  }

  // Dose dalla curva (personalizzata o predefinita): interpolazione in scala logaritmica,
  // come una retta su carta log-log; fuori dai punti prosegue con la pendenza dell'estremo.
  function doseDaCurva(ore, curva) {
    const punti = curvaValida(curva);
    if (!punti) return dosePredefinita(ore);
    const x = Math.log(Math.max(ore, 0.25));
    let i = punti.findIndex((p) => p.ore >= Math.exp(x));
    if (i === -1) i = punti.length - 1;
    else if (i === 0) i = 1;
    const a = punti[i - 1];
    const b = punti[i];
    const t = (x - Math.log(a.ore)) / (Math.log(b.ore) - Math.log(a.ore));
    return Math.exp(Math.log(a.dose) + t * (Math.log(b.dose) - Math.log(a.dose)));
  }

  // Grammi di lievito fresco per kg di farina per l'impasto finale.
  // Il sale frena il lievito, un impasto più idratato lievita un po' più in fretta.
  function doseLievito({ fasi, sale = 25, idratazione = 65, curva = null }) {
    const ore = oreEquivalenti(fasi);
    const correzione = Math.max(0.9, 1 + (sale - 25) / 200) * (1 - (idratazione - 65) / 200);
    const dose = doseDaCurva(ore, curva) * correzione;
    return { oreEquivalenti: ore, dose: Math.min(Math.max(dose, 0.05), 60) };
  }

  // Lievito madre suggerito, in % sulla farina, partendo dalla dose di lievito fresco
  function madreSuggerita(doseFresco) {
    return arrotonda(Math.min(Math.max(doseFresco * 5.7, 2), 40), 0);
  }

  // --- Stili di impasto e valori di partenza ---

  const STILI = {
    facile: { nome: "Pizza Facile", icona: "🍕", descrizione: "Poche scelte: quante pizze, quanto tempo e che forno hai" },
    verace: { nome: "Verace napoletana", icona: "🇮🇹", descrizione: "Le dosi della tradizione napoletana: 60% d'acqua, sale a 50 g per litro" },
    biga: { nome: "Pizza in biga", icona: "🫓", descrizione: "Prima una biga asciutta che matura, poi l'impasto finale" },
    teglia: { nome: "Pizza in teglia", icona: "🟫", descrizione: "Dosi calcolate dalla misura della teglia, idratazione alta" },
    personalizzata: { nome: "Personalizzata", icona: "🧪", descrizione: "Tutti i valori a mano: idratazione, fasi, lievito e mix di farine" },
  };

  const FORNI = {
    casa: { nome: "Forno di casa", idratazione: 67, olio: 20 },
    fornetto: { nome: "Fornetto per pizza (400 °C)", idratazione: 63, olio: 0 },
    legna: { nome: "Forno a legna", idratazione: 60, olio: 0 },
  };

  function predefinito(stile, imp = {}) {
    const ta = Number(imp.tempAmbiente) || 20;
    const tf = Number(imp.tempFrigo) || 4;
    const base = {
      stile,
      panetti: 4,
      peso: 250,
      scarto: 0,
      idratazione: 65,
      sale: Number(imp.sale) || 25,
      olio: 0,
      zucchero: 0,
      lievito: imp.lievito === "secco" ? "secco" : "fresco",
      madre: { percentuale: null, idratazione: 100 },
      farine: [],
      fasi: {
        puntata: { ore: 2, temp: ta },
        frigo: { ore: 0, temp: tf },
        appretto: { ore: 6, temp: ta },
      },
      staglio: "prima",
      forno: "casa",
    };
    if (stile === "facile") {
      return { ...base, facile: { ore: 24, frigo: true }, forno: "casa", idratazione: FORNI.casa.idratazione, olio: FORNI.casa.olio };
    }
    if (stile === "verace") {
      return { ...base, panetti: 4, peso: 250, idratazione: 60, salePerLitro: 50, forno: "legna", verace: { ore: 8, temp: ta } };
    }
    if (stile === "biga") {
      return {
        ...base, idratazione: 70,
        biga: { percentuale: 100, idratazione: 45, lievito: 1, ore: 18, temp: 18, lievitoRinfresco: 0 },
        fasi: { puntata: { ore: 1, temp: ta }, frigo: { ore: 0, temp: tf }, appretto: { ore: 4, temp: ta } },
      };
    }
    if (stile === "teglia") {
      return {
        ...base, idratazione: 75, olio: 30, sale: 25,
        teglia: { forma: "rettangolare", lato1: 30, lato2: 40, diametro: 32, numero: 1, grammatura: 0.55 },
        fasi: { puntata: { ore: 2, temp: ta }, frigo: { ore: 24, temp: tf }, appretto: { ore: 3, temp: ta } },
      };
    }
    return { ...base, fasi: { puntata: { ore: 2, temp: ta }, frigo: { ore: 22, temp: tf }, appretto: { ore: 4, temp: ta } } };
  }

  // Fasi di lievitazione dell'impasto finale, in ordine. Pizza Facile e Verace le ricavano da poche scelte.
  function fasiLievitazione(input, imp = {}) {
    const ta = Number(imp.tempAmbiente) || 20;
    const tf = Number(imp.tempFrigo) || 4;
    if (input.stile === "facile") {
      const ore = Math.max(Number(input.facile?.ore) || 24, 3);
      if (input.facile?.frigo && ore >= 10) {
        const appretto = ore >= 30 ? 5 : 4;
        return [
          { fase: "puntata", ore: 1, temp: ta },
          { fase: "frigo", ore: ore - 1 - appretto, temp: tf },
          { fase: "appretto", ore: appretto, temp: ta },
        ];
      }
      const puntata = ore >= 6 ? 2 : 1;
      return [
        { fase: "puntata", ore: puntata, temp: ta },
        { fase: "appretto", ore: ore - puntata, temp: ta },
      ];
    }
    if (input.stile === "verace") {
      const ore = Math.min(Math.max(Number(input.verace?.ore) || 8, 6), 24);
      const temp = Number(input.verace?.temp) || ta;
      return [
        { fase: "puntata", ore: 2, temp },
        { fase: "appretto", ore: ore - 2, temp },
      ];
    }
    const f = input.fasi || {};
    return ["puntata", "frigo", "appretto"]
      .map((fase) => ({ fase, ore: Math.max(Number(f[fase]?.ore) || 0, 0), temp: Number(f[fase]?.temp ?? (fase === "frigo" ? tf : ta)) }))
      .filter((x) => x.ore > 0);
  }

  // --- Calcolo delle dosi ---

  function calcola(inputGrezzo, imp = {}, farineDb = []) {
    const input = { ...predefinito(inputGrezzo?.stile || "personalizzata", imp), ...inputGrezzo };
    const avvisi = [];

    // Impasto totale
    let totale;
    let teglia = null;
    if (input.stile === "teglia") {
      const t = { ...predefinito("teglia").teglia, ...input.teglia };
      const area = t.forma === "tonda" ? Math.PI * Math.pow((Number(t.diametro) || 0) / 2, 2) : (Number(t.lato1) || 0) * (Number(t.lato2) || 0);
      const numero = Math.max(Math.round(Number(t.numero) || 1), 1);
      const perTeglia = area * (Number(t.grammatura) || 0.55);
      totale = perTeglia * numero;
      teglia = { area, numero, perTeglia };
    } else {
      totale = Math.max(Math.round(Number(input.panetti) || 1), 1) * Math.max(Number(input.peso) || 0, 0);
    }
    const scarto = Math.min(Math.max(Number(input.scarto) || 0, 0), 20);
    const totaleConScarto = totale * (1 + scarto / 100);

    const h = Math.min(Math.max(Number(input.idratazione) || 0, 40), 100) / 100;
    let sale = Math.max(Number(input.sale) || 0, 0);
    if (input.stile === "verace") sale = (Number(input.salePerLitro) || 50) * h;
    const olio = input.stile === "verace" ? 0 : Math.max(Number(input.olio) || 0, 0);
    const zucchero = input.stile === "verace" ? 0 : Math.max(Number(input.zucchero) || 0, 0);
    const extra = (sale + olio + zucchero) / 1000;

    // Lievito dell'impasto finale (sulle fasi di puntata, frigo e appretto)
    const fasi = fasiLievitazione(input, imp);
    const oreTotali = fasi.reduce((s, f) => s + f.ore, 0);
    const { oreEquivalenti: oreEq, dose } = doseLievito({ fasi, sale, idratazione: h * 100, curva: imp.curva });
    const tipo = input.stile === "biga" ? "fresco" : ["fresco", "secco", "madre"].includes(input.lievito) ? input.lievito : "fresco";

    let biga = null;
    let rinfresco = null;
    let madre = null;
    let lievitoGrammi = 0;
    let farina;

    if (input.stile === "biga") {
      const b = { ...predefinito("biga").biga, ...input.biga };
      const pb = Math.min(Math.max(Number(b.percentuale) || 0, 10), 100) / 100;
      const hb = Math.min(Math.max(Number(b.idratazione) || 45, 35), 60) / 100;
      const yb = Math.min(Math.max(Number(b.lievito) || 0, 0), 5) / 100;
      const yr = Math.max(Number(b.lievitoRinfresco) || 0, 0) / 1000;
      farina = totaleConScarto / (1 + h + extra + pb * yb + yr);
      const fb = farina * pb;
      biga = { farina: fb, acqua: fb * hb, lievito: fb * yb, ore: Number(b.ore) || 18, temp: Number(b.temp) || 18, percentuale: pb * 100, idratazione: hb * 100 };
      rinfresco = {
        farina: farina - fb,
        acqua: farina * h - fb * hb,
        sale: farina * sale / 1000,
        olio: farina * olio / 1000,
        zucchero: farina * zucchero / 1000,
        lievito: farina * yr,
      };
      if (rinfresco.acqua < 0) avvisi.push("L'idratazione totale è più bassa di quella della biga: alzala o abbassa l'acqua della biga.");
      lievitoGrammi = biga.lievito + rinfresco.lievito;
      if (biga.ore < 12) avvisi.push("Una biga di meno di 12 ore matura poco: di solito si fanno 16-24 ore a 16-18 °C.");
    } else if (tipo === "madre") {
      const m = (input.madre?.percentuale != null && input.madre.percentuale !== "" ? Number(input.madre.percentuale) : madreSuggerita(dose)) / 100;
      const hm = (Number(input.madre?.idratazione) || 100) / 100;
      farina = totaleConScarto / (1 + h + extra);
      const grammi = farina * m;
      madre = { grammi, farina: grammi / (1 + hm), acqua: (grammi * hm) / (1 + hm), percentuale: m * 100, suggerita: madreSuggerita(dose), idratazione: hm * 100 };
      if (farina * h - madre.acqua < 0) avvisi.push("Con questa quantità di lievito madre l'acqua non basta: riduci il lievito madre o alza l'idratazione.");
    } else {
      const y = tipo === "secco" ? dose / 3 : dose;
      farina = totaleConScarto / (1 + h + extra + y / 1000);
      lievitoGrammi = (farina * y) / 1000;
    }

    const acqua = farina * h;
    const daAggiungere = {
      farina: madre ? farina - madre.farina : farina,
      acqua: madre ? acqua - madre.acqua : acqua,
    };

    // Farine del mix (percentuali sulla farina da aggiungere)
    const mix = mixFarine(input.farine, farineDb);
    const farine = mix.map((f) => ({ ...f, grammi: (biga ? biga.farina + rinfresco.farina : daAggiungere.farina) * f.perc / 100 }));
    const wMedio = mix.length && mix.every((f) => f.W) ? mix.reduce((s, f) => s + f.W * f.perc / 100, 0) : null;

    // Avvisi utili
    const consigliW = intervalloW(oreTotali + (biga ? biga.ore : 0));
    if (wMedio && wMedio < consigliW.min - 20) {
      avvisi.push(`La farina (W ${Math.round(wMedio)}) è debole per ${Math.round(oreTotali + (biga ? biga.ore : 0))} ore: meglio una farina da W ${consigliW.min}-${consigliW.max}, o tempi più brevi.`);
    }
    if (input.stile !== "teglia" && h > 0.72 && input.forno !== "casa") avvisi.push("Sopra il 72% di idratazione l'impasto è difficile da stendere: aggiungi l'acqua poco per volta e fai qualche giro di pieghe.");
    if (oreTotali < 3) avvisi.push("Con meno di 3 ore la pizza sarà poco digeribile: se puoi, allunga i tempi.");
    if (tipo !== "madre" && lievitoGrammi > 0 && lievitoGrammi < 1) {
      avvisi.push(`Il lievito è poco (${formatta(lievitoGrammi, 2)} g): sciogli 1 g di lievito in 100 g d'acqua dell'impasto e usane ${Math.round(lievitoGrammi * 100)} g.`);
    }
    if (input.stile === "verace" && (input.peso < 200 || input.peso > 280)) avvisi.push("Per la Verace i panetti vanno da 200 a 280 g.");

    return {
      stile: input.stile,
      input,
      totale: totaleConScarto,
      scarto,
      farina,
      acqua,
      daAggiungere,
      sale: (farina * sale) / 1000,
      saleGkg: sale,
      olio: (farina * olio) / 1000,
      zucchero: (farina * zucchero) / 1000,
      idratazione: h * 100,
      lievito: { tipo, grammi: lievitoGrammi, doseFresco: dose, percentuale: tipo === "madre" ? madre.percentuale : ((lievitoGrammi / farina) * 100) },
      madre,
      biga,
      rinfresco,
      teglia,
      farine,
      wMedio,
      consigliW,
      fasi,
      oreTotali,
      oreEquivalenti: oreEq,
      avvisi,
    };
  }

  function mixFarine(scelte, farineDb) {
    if (!Array.isArray(scelte) || !scelte.length) return [];
    const righe = scelte
      .map((s) => {
        const f = farineDb.find((x) => x.id === s.id);
        return f ? { id: f.id, nome: f.nome, marca: f.marca || "", W: Number(f.W) || null, perc: Math.max(Number(s.perc) || 0, 0) } : null;
      })
      .filter(Boolean)
      .filter((r) => r.perc > 0);
    const somma = righe.reduce((s, r) => s + r.perc, 0);
    return somma ? righe.map((r) => ({ ...r, perc: (r.perc / somma) * 100 })) : [];
  }

  // --- Farine ---

  // Forza consigliata per la durata totale della maturazione
  function intervalloW(ore) {
    if (ore <= 8) return { min: 170, max: 230 };
    if (ore <= 12) return { min: 220, max: 270 };
    if (ore <= 24) return { min: 250, max: 310 };
    if (ore <= 48) return { min: 290, max: 350 };
    return { min: 330, max: 400 };
  }

  // Stima indicativa della W dalle proteine in etichetta (g per 100 g)
  function stimaW(proteine) {
    const p = Number(proteine);
    if (!p) return null;
    if (p < 10) return { min: 140, max: 190 };
    if (p < 11) return { min: 180, max: 230 };
    if (p < 12) return { min: 220, max: 270 };
    if (p < 13) return { min: 260, max: 310 };
    if (p < 14) return { min: 300, max: 350 };
    return { min: 340, max: 400 };
  }

  function durataPerW(W) {
    const w = Number(W);
    if (!w) return "";
    if (w < 200) return "impasti brevi, fino a 6-8 ore";
    if (w < 250) return "fino a 10-12 ore";
    if (w < 300) return "fino a 24 ore, anche con frigo";
    if (w < 350) return "24-48 ore, bene con il frigo";
    return "maturazioni lunghe, 48-72 ore";
  }

  // --- Lievito madre ---

  // Rinfresco per ottenere "serve" grammi di lievito madre (più una scorta), con un rapporto madre:farina:acqua
  function rinfrescoMadre({ serve, scorta = 50, rapporto = { madre: 1, farina: 1, acqua: 1 } }) {
    const r = { madre: Number(rapporto.madre) || 1, farina: Number(rapporto.farina) || 1, acqua: Number(rapporto.acqua) || 0 };
    const totale = Math.max(Number(serve) || 0, 0) + Math.max(Number(scorta) || 0, 0);
    const parti = r.madre + r.farina + r.acqua;
    return { madre: (totale * r.madre) / parti, farina: (totale * r.farina) / parti, acqua: (totale * r.acqua) / parti, totale };
  }

  // --- Pianificazione ---

  const NOMI_FASI = {
    rinfrescoMadre: "Rinfresco del lievito madre",
    biga: "Maturazione della biga",
    impasto: "Impasto",
    puntata: "Puntata (lievitazione in massa)",
    frigo: "Frigo",
    appretto: "Appretto (panetti)",
    cottura: "Stesura e cottura",
  };

  // Ricostruisce le fasi complete (anche preparazione e cottura) a partire dal risultato del calcolo
  function fasiComplete(risultato, imp = {}) {
    const ta = Number(imp.tempAmbiente) || 20;
    const fasi = [];
    if (risultato.biga) fasi.push({ fase: "biga", ore: risultato.biga.ore, temp: risultato.biga.temp });
    if (risultato.madre) fasi.push({ fase: "rinfrescoMadre", ore: Number(imp.oreRinfrescoMadre) || 4, temp: Math.max(ta, 24) });
    fasi.push({ fase: "impasto", ore: 0.5, temp: ta });
    risultato.fasi.forEach((f) => fasi.push({ ...f }));
    fasi.push({ fase: "cottura", ore: 0.5, temp: null });
    return fasi;
  }

  // Orari di ogni fase: dall'ora in cui si vuole mangiare (all'indietro) o dall'ora di inizio (in avanti)
  function pianifica(risultato, { mangiare, inizio } = {}, imp = {}) {
    const fasi = fasiComplete(risultato, imp);
    const durata = fasi.reduce((s, f) => s + f.ore, 0) * 3600000;
    const t0 = inizio ? new Date(inizio).getTime() : new Date(mangiare).getTime() - durata;
    let t = t0;
    const barre = fasi.map((f) => {
      const b = { ...f, nome: NOMI_FASI[f.fase], inizio: new Date(t), fine: new Date(t + f.ore * 3600000) };
      t += f.ore * 3600000;
      return b;
    });
    const staglioPrima = risultato.input?.staglio !== "dopo";
    const passi = [];
    const usaForno = risultato.input?.forno === "casa" || risultato.stile === "teglia";
    barre.forEach((b, i) => {
      if (b.fase === "rinfrescoMadre") passi.push({ quando: b.inizio, testo: `Rinfresca il lievito madre: sarà al massimo in circa ${formatta(b.ore, 0)} ore` });
      if (b.fase === "biga") passi.push({ quando: b.inizio, testo: `Prepara la biga e lasciala a ${b.temp} °C` });
      if (b.fase === "impasto") passi.push({ quando: b.inizio, testo: risultato.biga ? "Impasto finale: unisci la biga con gli ingredienti del rinfresco" : "Impasta" });
      if (b.fase === "puntata") passi.push({ quando: b.inizio, testo: `Copri l'impasto e lascialo a ${b.temp} °C` });
      if (b.fase === "frigo") {
        passi.push({ quando: b.inizio, testo: staglioPrima ? "Fai i panetti e mettili in frigo, coperti" : "Metti l'impasto in frigo, coperto" });
        passi.push({ quando: b.fine, testo: staglioPrima ? "Togli i panetti dal frigo" : "Togli l'impasto dal frigo" });
      }
      if (b.fase === "appretto") {
        const daFrigo = barre[i - 1]?.fase === "frigo";
        if (!daFrigo || !staglioPrima) passi.push({ quando: b.inizio, testo: risultato.stile === "teglia" ? "Fai i panetti (uno per teglia) e lasciali riposare" : "Fai i panetti (staglio)" });
      }
      if (b.fase === "cottura") {
        if (usaForno) passi.push({ quando: new Date(b.inizio.getTime() - 3600000), testo: "Accendi il forno al massimo, con la pietra o la teglia dentro" });
        passi.push({ quando: b.inizio, testo: risultato.stile === "teglia" ? "Stendi nella teglia e inforna" : "Stendi, condisci e inforna" });
      }
    });
    passi.sort((a, b) => a.quando - b.quando);
    return { barre, passi, inizio: new Date(t0), fine: new Date(t), ore: durata / 3600000 };
  }

  // --- Dopo la cottura: problemi e consigli ---

  const PROBLEMI = [
    { id: "appiccicoso", nome: "Impasto troppo appiccicoso", consiglio: "Abbassa l'idratazione di 2-3 punti o usa una farina più forte. Con idratazioni alte aggiungi l'ultima parte d'acqua poco per volta e fai 2-3 giri di pieghe a distanza di 15 minuti." },
    { id: "strappa", nome: "Si strappava in stesura", consiglio: "La maglia del glutine non era abbastanza formata: impasta più a lungo o aggiungi qualche giro di pieghe. Se la farina è debole per i tempi che hai scelto, accorcia la maturazione o passa a una farina con W più alta." },
    { id: "ritira", nome: "Si ritirava, troppo elastico", consiglio: "I panetti avevano bisogno di più riposo: allunga l'appretto di 1-2 ore, oppure toglili dal frigo prima, così arrivano alla stesura a temperatura ambiente." },
    { id: "basso", nome: "Poco sviluppo, cornicione basso", consiglio: "La lievitazione non è bastata: aumenta il lievito del 15-20% o le ore a temperatura ambiente. Controlla anche che il forno fosse ben caldo e che in stesura non hai schiacciato il bordo." },
    { id: "collassato", nome: "Panetti troppo lievitati o collassati", consiglio: "Il lievito era troppo per i tempi o la temperatura: riducilo del 20-30% o accorcia l'appretto. Con il caldo tieni i panetti in un posto più fresco." },
    { id: "bruciato", nome: "Fondo bruciato", consiglio: "Il fondo prendeva troppo calore: nel forno di casa inforna un livello più in alto o accorcia il tempo sulla pietra; togli zucchero o malto se li hai usati." },
    { id: "pallida", nome: "Pizza pallida", consiglio: "Forno poco caldo o impasto troppo maturo. Preriscalda più a lungo (almeno 45-60 minuti); nel forno di casa un filo d'olio o un cucchiaino di malto aiutano la doratura." },
    { id: "gommosa", nome: "Gommosa o dura", consiglio: "Di solito è una cottura troppo lunga a temperatura bassa. Nel forno di casa sali al 65-70% di idratazione, aggiungi un filo d'olio e cuoci alla temperatura massima, con la pietra ben calda." },
    { id: "lievito", nome: "Sapore di lievito o alcolico", consiglio: "Troppo lievito per la maturazione: riducilo e allunga i tempi in frigo, così il sapore viene dalla maturazione e non dal lievito." },
    { id: "piatto", nome: "Sapore piatto", consiglio: "La maturazione era breve: allunga i tempi con meno lievito, anche con qualche ora di frigo, e controlla il sale (25-30 g per kg di farina)." },
    { id: "pesante", nome: "Pesante da digerire", consiglio: "Impasto poco maturo: allunga la maturazione e scegli una farina adatta ai tempi lunghi (W più alta)." },
  ];

  const VOTI = [
    { id: "sapore", nome: "Sapore" },
    { id: "stesura", nome: "Lavorabilità in stesura" },
    { id: "cottura", nome: "Cottura e sviluppo" },
  ];

  function consigliCottura(cottura) {
    const scelti = new Set(cottura?.problemi || []);
    const consigli = PROBLEMI.filter((p) => scelti.has(p.id)).map((p) => ({ titolo: p.nome, testo: p.consiglio }));
    const v = cottura?.voti || {};
    if (!consigli.length && Object.values(v).some((x) => x && x <= 2)) {
      if (v.stesura <= 2) consigli.push({ titolo: "Lavorabilità", testo: "Se era difficile da stendere, segna cosa succedeva (si strappava, si ritirava, era appiccicoso): ti dico cosa cambiare." });
      if (v.cottura <= 2) consigli.push({ titolo: "Cottura", testo: "Indica se era pallida, bruciata sotto, gommosa o bassa: ogni caso ha un rimedio diverso." });
      if (v.sapore <= 2) consigli.push({ titolo: "Sapore", testo: "Indica se sapeva di lievito o era piatta: dipende da quanto lievito e quanto tempo." });
    }
    return consigli;
  }

  // --- Numeri ---

  function arrotonda(n, decimali = 0) {
    const f = Math.pow(10, decimali);
    return Math.round(n * f) / f;
  }

  function formatta(n, decimali = 0) {
    if (n == null || !Number.isFinite(n)) return "–";
    return Number(n).toLocaleString("it-IT", { minimumFractionDigits: decimali, maximumFractionDigits: decimali });
  }

  // Grammi leggibili: niente decimali per le quantità grandi, qualcuno per lievito e sale
  function grammi(n) {
    if (n == null || !Number.isFinite(n)) return "–";
    if (n < 1) return formatta(n, 2);
    if (n < 10) return formatta(n, 1);
    return formatta(n, 0);
  }

  const Calcoli = {
    velocita, oreEquivalenti, dosePredefinita, curvaPredefinita, curvaValida, doseDaCurva, doseLievito, madreSuggerita,
    ORE_CURVA_TABELLA: ORE_CURVA,
    STILI, FORNI, predefinito, fasiLievitazione, calcola, mixFarine,
    intervalloW, stimaW, durataPerW, rinfrescoMadre,
    NOMI_FASI, fasiComplete, pianifica, PROBLEMI, VOTI, consigliCottura,
    arrotonda, formatta, grammi,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Calcoli;
  else radice.Calcoli = Calcoli;
})(typeof window !== "undefined" ? window : globalThis);
