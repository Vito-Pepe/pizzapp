// Calcolatore dell'impasto, risultato con le dosi e pianificazione "a che ora vuoi mangiare".
(function () {
  "use strict";

  const App = window.App;
  const { C, h } = App;
  const G = window.Grafici;
  const CHIAVE = "impasti-bozze";
  const CHIAVE_PIANO = "impasti-piano";

  // Una bozza per stile: cambiando stile non si perdono i valori degli altri
  const bozze = App.leggiLocale(CHIAVE, null) || { stile: "facile" };
  if (!C.STILI[bozze.stile]) bozze.stile = "facile";

  function bozza(stile = bozze.stile) {
    if (!bozze[stile] || bozze[stile].stile !== stile) bozze[stile] = C.predefinito(stile, App.impostazioni());
    return bozze[stile];
  }

  function salvaBozze() {
    App.scriviLocale(CHIAVE, bozze);
  }

  function calcolaInput(input) {
    return C.calcola(input, App.impostazioni(), App.farineDb());
  }

  App.caricaInCalcolatore = (input) => {
    bozze.stile = input.stile;
    bozze[input.stile] = JSON.parse(JSON.stringify(input));
    salvaBozze();
    App.vai("#/calcola");
  };

  App.calcolaInput = calcolaInput;

  // --- Calcolatore ---

  App.vista("calcola", () => {
    const pagina = h("div", { class: "page" });
    const corpo = h("div");
    pagina.append(App.testata("Calcola l'impasto", "Scegli lo stile, poi quante pizze e quanto tempo hai"), sceltaStile(), corpo);

    function disegna() {
      const y = window.scrollY;
      corpo.textContent = "";
      const risultatoBox = h("div", { class: "result-wrap", "aria-live": "polite" });
      const aggiorna = () => {
        salvaBozze();
        risultatoBox.textContent = "";
        risultatoBox.append(vistaRisultato(calcolaInput(bozza()), { azioni: true }));
      };
      corpo.append(h("p", { class: "hint style-desc" }, C.STILI[bozze.stile].descrizione), modulo(bozza(), aggiorna, disegna), risultatoBox);
      aggiorna();
      window.scrollTo(0, y);
    }

    function sceltaStile() {
      const box = h("div", { class: "style-picker", role: "group", "aria-label": "Stile dell'impasto" });
      Object.entries(C.STILI).forEach(([id, st]) => {
        box.append(h("button", {
          type: "button", class: "style-chip", "aria-pressed": String(id === bozze.stile),
          onclick: () => {
            bozze.stile = id;
            box.querySelectorAll(".style-chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.stile === id)));
            disegna();
          },
          dataset: { stile: id },
        }, h("span", { class: "chip-icon", "aria-hidden": "true" }, st.icona), st.nome));
      });
      return box;
    }

    disegna();
    return pagina;
  });

  function sezione(titolo, ...figli) {
    return h("fieldset", { class: "panel" }, h("legend", null, titolo), ...figli);
  }

  function riga(...campi) {
    return h("div", { class: "row" }, ...campi);
  }

  // Modulo dello stile: "aggiorna" ricalcola le dosi, "ridisegna" ricostruisce il modulo (per le scelte che lo cambiano)
  function modulo(b, aggiorna, ridisegna) {
    const imp = App.impostazioni();
    const num = (percorso, etichetta, unita, opz = {}) => App.campoNumero({ oggetto: b, percorso, etichetta, unita, cambia: aggiorna, ...opz });
    const box = h("div", { class: "form" });

    // Quanto impasto
    if (b.stile === "teglia") {
      b.teglia = { ...C.predefinito("teglia").teglia, ...b.teglia };
      box.append(sezione("Teglie",
        App.sceltaPulsanti({ etichetta: "Forma", valore: b.teglia.forma, opzioni: [{ valore: "rettangolare", testo: "Rettangolare" }, { valore: "tonda", testo: "Tonda" }], cambia: (v) => { b.teglia.forma = v; salvaBozze(); ridisegna(); } }),
        b.teglia.forma === "tonda"
          ? riga(num("teglia.diametro", "Diametro", "cm", { min: 10, max: 60 }), num("teglia.numero", "Teglie", "", { min: 1, max: 10 }))
          : riga(num("teglia.lato1", "Lato corto", "cm", { min: 10, max: 80 }), num("teglia.lato2", "Lato lungo", "cm", { min: 10, max: 80 }), num("teglia.numero", "Teglie", "", { min: 1, max: 10 })),
        num("teglia.grammatura", "Impasto per cm²", "g", { min: 0.3, max: 1, passo: 0.01, aiuto: "0,45 sottile · 0,55 classica · 0,65 alta e soffice" })));
    } else {
      box.append(sezione("Quante pizze",
        riga(num("panetti", "Panetti", "", { min: 1, max: 60 }),
          num("peso", "Peso di un panetto", "g", { min: 100, max: 1000, passo: 5, aiuto: b.stile === "verace" ? "Per la Verace: da 200 a 280 g" : "Una pizza tonda da 30-33 cm: 230-280 g" }))));
    }

    // Tempi
    if (b.stile === "facile") {
      b.facile = { ore: 24, frigo: true, ...b.facile };
      const orari = [6, 8, 12, 24, 48, 72];
      box.append(sezione("Quanto tempo hai",
        App.sceltaPulsanti({ etichetta: "Dall'impasto alla cottura", valore: b.facile.ore, opzioni: orari.map((o) => ({ valore: o, testo: `${o} h` })), cambia: (v) => { b.facile.ore = v; salvaBozze(); ridisegna(); }, classe: "wrap" }),
        b.facile.ore >= 10
          ? App.interruttore({ etichetta: "Uso il frigo", aiuto: "Più ore in frigo, più sapore e digeribilità", valore: b.facile.frigo, cambia: (v) => { b.facile.frigo = v; aggiorna(); } })
          : h("p", { class: "hint" }, "Con meno di 10 ore la lievitazione è tutta a temperatura ambiente."),
        h("p", { class: "hint" }, `Temperatura di casa: ${imp.tempAmbiente} °C, frigo: ${imp.tempFrigo} °C (si cambiano in Altro → Impostazioni).`)));
    } else if (b.stile === "verace") {
      b.verace = { ore: 8, temp: imp.tempAmbiente, ...b.verace };
      box.append(sezione("Lievitazione",
        riga(num("verace.ore", "Ore totali", "h", { min: 6, max: 24, aiuto: "2 ore di puntata, il resto di appretto" }), num("verace.temp", "Temperatura", "°C", { min: 10, max: 32 }))));
    } else {
      if (b.stile === "biga") {
        b.biga = { ...C.predefinito("biga").biga, ...b.biga };
        box.append(sezione("Biga",
          riga(num("biga.percentuale", "Farina nella biga", "%", { min: 10, max: 100, aiuto: "100%: tutta la farina va nella biga" }), num("biga.idratazione", "Acqua della biga", "%", { min: 35, max: 60, aiuto: "Di solito 44-50%" })),
          riga(num("biga.lievito", "Lievito nella biga", "%", { min: 0, max: 5, passo: 0.1, aiuto: "Classico: 1% per 16-20 ore a 16-18 °C" }), num("biga.ore", "Ore della biga", "h", { min: 4, max: 72 }), num("biga.temp", "Temperatura", "°C", { min: 2, max: 30 }))));
      }
      b.fasi = { puntata: { ore: 0, temp: imp.tempAmbiente }, frigo: { ore: 0, temp: imp.tempFrigo }, appretto: { ore: 0, temp: imp.tempAmbiente }, ...b.fasi };
      const fase = (id, nome, aiuto) => h("div", { class: "phase-row" },
        h("div", { class: "phase-name" }, h("strong", null, nome), h("span", { class: "hint" }, aiuto)),
        riga(num(`fasi.${id}.ore`, "Ore", "h", { min: 0, max: 96, passo: 0.5, cambia: () => { aggiorna(); if (id === "frigo") aggiornaStaglio(); } }), num(`fasi.${id}.temp`, "Temperatura", "°C", { min: 0, max: 35 })));
      const staglio = h("div");
      const aggiornaStaglio = () => {
        staglio.textContent = "";
        if ((b.fasi.frigo?.ore || 0) > 0) {
          staglio.append(App.sceltaPulsanti({ etichetta: "Quando fai i panetti", valore: b.staglio || "prima", opzioni: [{ valore: "prima", testo: "Prima del frigo" }, { valore: "dopo", testo: "Dopo il frigo" }], cambia: (v) => { b.staglio = v; aggiorna(); } }));
        }
      };
      aggiornaStaglio();
      box.append(sezione(b.stile === "biga" ? "Dopo l'impasto finale" : "Lievitazione",
        fase("puntata", "Puntata", "L'impasto intero riposa coperto"),
        fase("frigo", "Frigo", "Facoltativo: 0 ore per non usarlo"),
        fase("appretto", "Appretto", "I panetti lievitano prima della stesura"),
        staglio));
    }

    // Ingredienti
    const ingredienti = sezione("Ingredienti");
    if (b.stile === "facile") {
      ingredienti.append(
        App.sceltaPulsanti({ etichetta: "Forno", valore: b.forno, opzioni: Object.entries(C.FORNI).map(([id, f]) => ({ valore: id, testo: f.nome })), cambia: (v) => { b.forno = v; b.idratazione = C.FORNI[v].idratazione; b.olio = C.FORNI[v].olio; aggiorna(); }, classe: "wrap" }),
        App.sceltaPulsanti({ etichetta: "Lievito", valore: b.lievito === "secco" ? "secco" : "fresco", opzioni: [{ valore: "fresco", testo: "Fresco (cubetto)" }, { valore: "secco", testo: "Secco (bustina)" }], cambia: (v) => { b.lievito = v; aggiorna(); } }),
        h("p", { class: "hint" }, "Il forno sceglie l'idratazione e l'olio: per quelli di casa serve un impasto più idratato e un filo d'olio."));
    } else {
      const campi = [num("idratazione", b.stile === "biga" ? "Idratazione totale" : "Idratazione", "%", { min: 40, max: 100, aiuto: b.stile === "verace" ? "Tradizione: da 55,5 a 62,5%" : "Acqua rispetto alla farina" })];
      if (b.stile === "verace") campi.push(num("salePerLitro", "Sale per litro d'acqua", "g", { min: 30, max: 70, aiuto: "Tradizione: 40-60 g" }));
      else campi.push(num("sale", "Sale", "g/kg", { min: 0, max: 60, passo: 0.5, aiuto: "Grammi per kg di farina" }));
      ingredienti.append(riga(...campi));
      if (b.stile !== "verace") {
        ingredienti.append(riga(num("olio", "Olio", "g/kg", { min: 0, max: 100 }), num("zucchero", "Zucchero o malto", "g/kg", { min: 0, max: 50 })));
      }
      if (b.stile === "biga") {
        ingredienti.append(num("biga.lievitoRinfresco", "Lievito fresco nell'impasto finale", "g/kg", { min: 0, max: 10, passo: 0.1, aiuto: "Facoltativo: un po' di spinta in più, di solito 0" }));
      } else {
        const tipi = b.stile === "verace"
          ? [{ valore: "fresco", testo: "Fresco" }, { valore: "madre", testo: "Lievito madre" }]
          : [{ valore: "fresco", testo: "Fresco" }, { valore: "secco", testo: "Secco" }, { valore: "madre", testo: "Lievito madre" }];
        ingredienti.append(App.sceltaPulsanti({ etichetta: "Lievito", valore: b.lievito, opzioni: tipi, cambia: (v) => { b.lievito = v; salvaBozze(); ridisegna(); } }));
        if (b.lievito === "madre") {
          b.madre = { percentuale: null, idratazione: 100, ...b.madre };
          ingredienti.append(riga(
            num("madre.percentuale", "Lievito madre", "%", { min: 1, max: 50, vuoto: true, aiuto: "Sulla farina. Vuoto: lo suggerisco io in base ai tempi" }),
            num("madre.idratazione", "Idratazione del lievito madre", "%", { min: 40, max: 130, aiuto: "100% liquido o a pasta morbida, 50% solido" })));
        }
      }
      if (b.stile === "personalizzata") {
        ingredienti.append(
          num("scarto", "Impasto in più", "%", { min: 0, max: 20, passo: 0.5, aiuto: "Per quello che resta nella ciotola, di solito 1-3%" }),
          App.sceltaPulsanti({ etichetta: "Forno", valore: b.forno, opzioni: Object.entries(C.FORNI).map(([id, f]) => ({ valore: id, testo: f.nome })), cambia: (v) => { b.forno = v; aggiorna(); }, classe: "wrap" }));
      }
    }
    box.append(ingredienti, sezioneFarine(b, aggiorna, ridisegna));
    return box;
  }

  // Mix di farine: facoltativo, serve per i grammi di ogni farina e la W media
  function sezioneFarine(b, aggiorna, ridisegna) {
    const db = App.farineDb().sort((x, y) => (y.preferita ? 1 : 0) - (x.preferita ? 1 : 0) || x.nome.localeCompare(y.nome, "it"));
    b.farine = Array.isArray(b.farine) ? b.farine.filter((f) => db.some((d) => d.id === f.id)) : [];
    const sez = sezione("Farine");
    if (!db.length) {
      sez.append(h("p", { class: "hint" }, "Non ci sono farine salvate: aggiungile nella scheda Farine."));
      return sez;
    }
    const opzioni = (scelta) => db.map((f) => h("option", { value: f.id, selected: f.id === scelta }, `${f.preferita ? "★ " : ""}${f.nome}${f.marca ? ` (${f.marca})` : ""}${f.W ? ` · W ${f.W}` : ""}`));
    b.farine.forEach((f, i) => {
      const select = h("select", { "aria-label": `Farina ${i + 1}`, onchange: () => { f.id = select.value; aggiorna(); } }, opzioni(f.id));
      sez.append(h("div", { class: "flour-row" },
        select,
        App.campoNumero({ oggetto: f, percorso: "perc", etichetta: "Parte", unita: "%", min: 1, max: 100, cambia: aggiorna }),
        h("button", { type: "button", class: "icon-btn", "aria-label": "Togli questa farina", onclick: () => { b.farine.splice(i, 1); salvaBozze(); ridisegna(); } }, "✕")));
    });
    sez.append(
      h("button", { type: "button", class: "btn btn-ghost btn-small", onclick: () => { b.farine.push({ id: db[0].id, perc: b.farine.length ? 20 : 100 }); salvaBozze(); ridisegna(); } }, "+ Aggiungi farina"),
      h("p", { class: "hint" }, b.farine.length ? "Le parti si normalizzano a 100%: 70 e 30 oppure 7 e 3 danno lo stesso mix." : "Facoltativo: scegli le farine per avere i grammi di ognuna e la forza (W) media."));
    return sez;
  }

  // --- Risultato ---

  function cella(testo, classe) {
    return h("td", { class: classe || null }, testo);
  }

  function rigaIngrediente(nome, grammi, nota, classe) {
    return h("tr", { class: classe || null }, h("th", { scope: "row" }, nome), cella(`${C.grammi(grammi)} g`, "num"), cella(nota || "", "note"));
  }

  function tabellaDosi(righe) {
    return h("table", { class: "doses" }, h("tbody", null, righe.filter(Boolean)));
  }

  function nomeLievito(tipo) {
    return { fresco: "Lievito fresco", secco: "Lievito secco", madre: "Lievito madre" }[tipo];
  }

  function righeFarine(r, farinaTotale) {
    return r.farine.map((f) => rigaIngrediente(`· ${f.nome}`, (farinaTotale * f.perc) / 100, `${C.formatta(f.perc, 0)}%${f.W ? ` · W ${f.W}` : ""}`, "sub"));
  }

  function riassunto(r) {
    const i = r.input;
    if (r.teglia) {
      const misura = i.teglia.forma === "tonda" ? `tonda da ${i.teglia.diametro} cm` : `${i.teglia.lato1}×${i.teglia.lato2} cm`;
      return `${r.teglia.numero} ${r.teglia.numero === 1 ? "teglia" : "teglie"} ${misura} · ${C.grammi(r.teglia.perTeglia)} g di impasto ciascuna`;
    }
    return `${i.panetti} ${Number(i.panetti) === 1 ? "panetto" : "panetti"} da ${i.peso} g · ${C.grammi(r.totale)} g di impasto${r.scarto ? ` (con ${C.formatta(r.scarto, 1)}% in più)` : ""}`;
  }

  function testoFasi(fasi) {
    return fasi.map((f) => `${C.NOMI_FASI[f.fase].split(" (")[0]} ${App.ore(f.ore)} a ${f.temp} °C`).join(" → ");
  }

  function vistaRisultato(r, { azioni = false, ricetta = null } = {}) {
    const box = h("section", { class: "panel result", "aria-label": "Dosi" });
    box.append(h("div", { class: "result-head" },
      h("h2", null, "Dosi"),
      h("p", { class: "lead" }, riassunto(r))));

    if (r.biga) {
      box.append(
        h("h3", null, `Biga · ${C.formatta(r.biga.ore, 0)} ore a ${r.biga.temp} °C`),
        tabellaDosi([
          rigaIngrediente("Farina", r.biga.farina, `${C.formatta(r.biga.percentuale, 0)}% del totale`),
          ...(r.rinfresco.farina < 0.5 ? righeFarine(r, r.biga.farina) : []),
          rigaIngrediente("Acqua", r.biga.acqua, `${C.formatta(r.biga.idratazione, 0)}%`),
          rigaIngrediente("Lievito fresco", r.biga.lievito, `${C.formatta(r.input.biga?.lievito ?? 1, 1)}% della farina della biga`),
        ]),
        h("h3", null, "Impasto finale"),
        tabellaDosi([
          h("tr", null, h("th", { scope: "row" }, "Biga"), cella("tutta", "num"), cella("", "note")),
          r.rinfresco.farina >= 0.5 ? rigaIngrediente("Farina", r.rinfresco.farina) : null,
          ...(r.rinfresco.farina >= 0.5 ? righeFarine(r, r.rinfresco.farina) : []),
          rigaIngrediente("Acqua", Math.max(r.rinfresco.acqua, 0), `per arrivare al ${C.formatta(r.idratazione, 0)}%`),
          rigaIngrediente("Sale", r.rinfresco.sale, `${C.formatta(r.saleGkg, 1)} g/kg`),
          r.rinfresco.olio ? rigaIngrediente("Olio", r.rinfresco.olio) : null,
          r.rinfresco.zucchero ? rigaIngrediente("Zucchero o malto", r.rinfresco.zucchero) : null,
          r.rinfresco.lievito ? rigaIngrediente("Lievito fresco", r.rinfresco.lievito) : null,
        ]),
        h("p", { class: "hint" }, `In tutto: ${C.grammi(r.farina)} g di farina e ${C.grammi(r.acqua)} g d'acqua. Aggiungi l'acqua alla biga poco per volta, il sale verso la fine.`));
    } else {
      box.append(tabellaDosi([
        rigaIngrediente(r.madre ? "Farina da aggiungere" : "Farina", r.daAggiungere.farina, r.madre ? `${C.grammi(r.farina)} g in tutto` : ""),
        ...righeFarine(r, r.daAggiungere.farina),
        rigaIngrediente(r.madre ? "Acqua da aggiungere" : "Acqua", Math.max(r.daAggiungere.acqua, 0), `${C.formatta(r.idratazione, 1)}%`),
        rigaIngrediente("Sale", r.sale, `${C.formatta(r.saleGkg, 1)} g/kg`),
        r.olio ? rigaIngrediente("Olio", r.olio, `${C.formatta(r.input.olio, 0)} g/kg`) : null,
        r.zucchero ? rigaIngrediente("Zucchero o malto", r.zucchero) : null,
        r.madre
          ? rigaIngrediente("Lievito madre", r.madre.grammi, `${C.formatta(r.madre.percentuale, 0)}%${r.input.madre?.percentuale == null ? " (suggerito)" : ""}`, "yeast")
          : rigaIngrediente(nomeLievito(r.lievito.tipo), r.lievito.grammi, `${C.formatta(r.lievito.tipo === "secco" ? r.lievito.doseFresco / 3 : r.lievito.doseFresco, 2)} g/kg`, "yeast"),
        h("tr", { class: "total" }, h("th", { scope: "row" }, "Totale"), cella(`${C.grammi(r.totale)} g`, "num"), cella("", "note")),
      ]));
    }

    if (r.wMedio) box.append(h("p", { class: "hint" }, `Forza media delle farine: W ${Math.round(r.wMedio)}. Per ${App.ore(r.oreTotali + (r.biga ? r.biga.ore : 0))} di maturazione è consigliata una W ${r.consigliW.min}-${r.consigliW.max}.`));
    if (r.avvisi.length) box.append(h("ul", { class: "warnings" }, r.avvisi.map((a) => h("li", null, a))));

    box.append(h("div", { class: "phases-line" }, h("strong", null, `${r.biga ? "Dopo l'impasto finale" : "Lievitazione"}: ${App.ore(r.oreTotali)}`), h("span", null, testoFasi(r.fasi))));
    if (!r.biga) box.append(h("p", { class: "hint" }, `Equivale a ${C.formatta(r.oreEquivalenti, 1)} ore a 20 °C. La dose di lievito è un'indicazione: la curva si ritocca in Altro → Impostazioni.`));

    box.append(grafici(r));

    if (azioni) {
      box.append(h("div", { class: "actions" },
        h("button", { type: "button", class: "btn btn-primary", onclick: () => App.vai("#/pianifica") }, "⏰ Pianifica"),
        h("button", { type: "button", class: "btn", onclick: () => salvaNelDiario(r) }, "💾 Salva nel diario"),
        h("button", { type: "button", class: "btn", onclick: () => window.Condividi.apri({ nome: C.STILI[r.stile].nome, risultato: r }) }, "📤 Condividi")));
    } else if (ricetta) {
      box.append(h("p", { class: "hint" }, "Dosi calcolate quando hai salvato la ricetta."));
    }
    return box;
  }

  App.vistaRisultato = vistaRisultato;
  App.testoFasi = testoFasi;
  App.riassunto = riassunto;

  function grafici(r) {
    const box = h("div", { class: "charts" });
    const imp = App.impostazioni();
    if (!r.biga && r.lievito.tipo !== "madre") {
      const base = C.doseDaCurva(r.oreEquivalenti, imp.curva);
      const correzione = base ? r.lievito.doseFresco / base : 1;
      const xMax = Math.max(72, Math.ceil(r.oreEquivalenti * 1.25));
      const punti = [];
      for (let x = 2; x <= xMax; x += 0.5) punti.push({ x, y: C.doseDaCurva(x, imp.curva) * correzione });
      const yMax = Math.max(C.doseDaCurva(4, imp.curva) * correzione, r.lievito.doseFresco * 1.3);
      box.append(G.linea({
        titolo: "Lievito fresco in base alla durata (g per kg di farina, ore a 20 °C)",
        punti, xMin: 2, xMax, yMax,
        formatoX: (v) => `${C.formatta(v, 0)} h`,
        formatoY: (v) => C.formatta(v, v < 10 ? 1 : 0),
        descrivi: (p) => `${C.formatta(p.x, 1)} ore → ${C.formatta(p.y, 2)} g/kg`,
        marcatore: { x: r.oreEquivalenti, y: r.lievito.doseFresco, etichetta: `La tua: ${C.formatta(r.lievito.doseFresco, 1)} g/kg` },
        intestazioni: ["Ore a 20 °C", "g/kg"],
        righe: C.ORE_CURVA_TABELLA.map((o) => [C.formatta(o, 0), C.formatta(C.doseDaCurva(o, imp.curva) * correzione, 2)]),
      }));
    }
    if (r.fasi.length) {
      const punti = [];
      let t = 0;
      r.fasi.forEach((f) => { punti.push({ x: t, y: f.temp, fase: f }); t += f.ore; });
      const temps = r.fasi.map((f) => f.temp);
      box.append(G.linea({
        titolo: "Temperatura durante la lievitazione (°C)",
        punti, gradino: true, xMin: 0, xMax: t, yMin: 0, yMax: Math.max(...temps, 10) * 1.2,
        formatoX: (v) => `${C.formatta(v, 0)} h`,
        formatoY: (v) => C.formatta(v, 0),
        descrivi: (p) => `${C.NOMI_FASI[p.fase.fase].split(" (")[0]}: ${p.fase.temp} °C per ${App.ore(p.fase.ore)}`,
        intestazioni: ["Fase", "Ore", "°C"],
        righe: r.fasi.map((f) => [C.NOMI_FASI[f.fase].split(" (")[0], C.formatta(f.ore, 1), C.formatta(f.temp, 0)]),
      }));
    }
    return box;
  }

  async function salvaNelDiario(r) {
    const nome = h("input", { type: "text", value: `${C.STILI[r.stile].nome} del ${App.data(new Date())}`, maxlength: 80, "aria-label": "Nome della ricetta" });
    const note = h("textarea", { rows: 3, maxlength: 4000, placeholder: "Note (facoltative): farina usata, come hai impastato…", "aria-label": "Note" });
    const ok = await App.finestra({
      titolo: "Salva nel diario",
      contenuto: [h("div", { class: "field" }, h("label", null, "Nome"), nome), h("div", { class: "field" }, h("label", null, "Note"), note)],
      pulsanti: [{ testo: "Annulla", valore: false }, { testo: "Salva", valore: true }],
    });
    if (!ok) return;
    const ricetta = {
      id: App.nuovoId(),
      nome: nome.value.trim() || C.STILI[r.stile].nome,
      stile: r.stile,
      input: JSON.parse(JSON.stringify(r.input)),
      risultato: JSON.parse(JSON.stringify({ ...r, input: undefined })),
      preferita: false,
      note: note.value.trim(),
      cotture: [],
    };
    await App.salva("ricette", ricetta);
    App.avviso("Salvata nel diario");
  }

  // --- Pianificazione ---

  App.vista("pianifica", (idRicetta) => {
    const ricetta = idRicetta ? App.dati.ricette[idRicetta] : null;
    const input = ricetta ? ricetta.input : bozza();
    const r = calcolaInput(input);
    const imp = App.impostazioni();
    const durata = C.pianifica(r, { inizio: new Date() }, imp).ore;
    const salvato = App.leggiLocale(CHIAVE_PIANO, {});

    let modo = salvato.modo === "inizio" ? "inizio" : "mangiare";
    let quando = salvato.quando ? new Date(salvato.quando) : null;
    if (!quando || Number.isNaN(quando.getTime()) || (modo === "mangiare" && quando.getTime() - durata * 3600000 < Date.now() - 3600000)) {
      quando = prossimaCena(durata);
      modo = "mangiare";
    }

    const pagina = h("div", { class: "page" });
    const esito = h("div", { "aria-live": "polite" });
    const inputQuando = h("input", { type: "datetime-local", value: App.perInputData(quando), "aria-label": "Data e ora", onchange: () => { quando = new Date(inputQuando.value); disegna(); } });
    const campoQuando = h("div", { class: "field" }, h("label", null, "Quando vuoi mangiare?"), inputQuando);

    function disegna() {
      App.scriviLocale(CHIAVE_PIANO, { modo, quando: quando.toISOString() });
      campoQuando.hidden = modo === "inizio";
      esito.textContent = "";
      const piano = C.pianifica(r, modo === "inizio" ? { inizio: new Date() } : { mangiare: quando }, imp);
      esito.append(vistaPiano(piano, r, ricetta));
    }

    pagina.append(
      App.testata("Pianifica", "Dimmi a che ora vuoi mangiare: ti dico quando impastare"),
      h("div", { class: "panel plan-source" },
        h("div", null,
          h("span", { class: "hint" }, ricetta ? "Ricetta del diario" : "Impasto del calcolatore"),
          h("strong", null, ricetta ? ricetta.nome : C.STILI[r.stile].nome),
          h("span", { class: "hint" }, `${riassunto(r)} · ${App.ore(durata)} in tutto`)),
        h("a", { class: "btn btn-ghost btn-small", href: ricetta ? `#/diario/${ricetta.id}` : "#/calcola" }, "Cambia")),
      h("div", { class: "panel" },
        App.sceltaPulsanti({ etichetta: "Come vuoi organizzarti", valore: modo, opzioni: [{ valore: "mangiare", testo: "Scelgo l'ora di cena" }, { valore: "inizio", testo: "Inizio adesso" }], cambia: (v) => { modo = v; disegna(); } }),
        campoQuando),
      esito);
    disegna();
    return pagina;
  });

  // Le 20:00 del primo giorno in cui c'è abbastanza tempo
  function prossimaCena(durata) {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    while (d.getTime() - durata * 3600000 < Date.now()) d.setDate(d.getDate() + 1);
    return d;
  }

  function vistaPiano(piano, r, ricetta) {
    const box = h("div");
    const inizio = App.giornoOra(piano.inizio);
    const fine = App.giornoOra(piano.fine);
    const passato = piano.inizio.getTime() < Date.now() - 5 * 60000;
    box.append(h("div", { class: `panel plan-summary ${passato ? "late" : ""}` },
      h("p", { class: "hint" }, "Inizia"),
      h("p", { class: "big" }, `${inizio.giorno} alle ${inizio.ora}`),
      h("p", { class: "hint" }, `Si mangia ${fine.giorno} alle ${fine.ora}`),
      passato ? h("p", { class: "warning-text" }, `Per quell'ora avresti dovuto iniziare ${App.relativo(piano.inizio)}: scegli un'ora più tardi o accorcia i tempi nel calcolatore.`) : null));

    // Passi in ordine, con giorno e ora
    const lista = h("ol", { class: "steps" });
    let giornoPrima = "";
    piano.passi.forEach((p) => {
      const q = App.giornoOra(p.quando);
      if (q.giorno !== giornoPrima) {
        lista.append(h("li", { class: "step-day" }, q.giorno));
        giornoPrima = q.giorno;
      }
      lista.append(h("li", { class: "step" }, h("time", { datetime: p.quando.toISOString() }, q.ora), h("span", null, p.testo)));
    });
    box.append(h("section", { class: "panel" }, h("h2", null, "Cosa fare e quando"), lista));

    // Barre delle fasi, in proporzione alla durata
    const totale = piano.fine - piano.inizio;
    const barre = h("div", { class: "gantt", role: "list" });
    piano.barre.forEach((b) => {
      const sinistra = ((b.inizio - piano.inizio) / totale) * 100;
      const larghezza = Math.max(((b.fine - b.inizio) / totale) * 100, 1.5);
      const barra = h("div", { class: `gantt-bar fase-${b.fase}` });
      barra.style.left = `${sinistra}%`;
      barra.style.width = `${larghezza}%`;
      const da = App.giornoOra(b.inizio);
      barre.append(h("div", { class: "gantt-row", role: "listitem" },
        h("div", { class: "gantt-label" }, h("strong", null, b.nome), h("span", { class: "hint" }, `${da.giorno} ${da.ora} · ${App.ore(b.ore)}${b.temp != null ? ` a ${b.temp} °C` : ""}`)),
        h("div", { class: "gantt-track" }, barra)));
    });
    box.append(h("section", { class: "panel" }, h("h2", null, "Le fasi"), barre));

    const testo = [`${ricetta ? ricetta.nome : C.STILI[r.stile].nome}: ${riassunto(r)}`, ""]
      .concat(piano.passi.map((p) => { const q = App.giornoOra(p.quando); return `${q.giorno} ${q.ora} – ${p.testo}`; }))
      .join("\n");
    box.append(h("div", { class: "actions" },
      h("button", { type: "button", class: "btn", onclick: () => window.Condividi.testo("Programma", testo) }, "📋 Copia il programma"),
      ricetta ? h("button", { type: "button", class: "btn", onclick: async () => { await App.salva("ricette", { ...ricetta, piano: { inizio: piano.inizio.toISOString(), mangiare: piano.fine.toISOString() } }); App.avviso("Programma salvato nella ricetta"); } }, "💾 Salva nella ricetta") : null));
    return box;
  }
})();
