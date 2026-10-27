// Altro: statistiche, impostazioni (temperature, curva del lievito), esportazione e importazione.
(function () {
  "use strict";

  const App = window.App;
  const { C, h } = App;
  const G = window.Grafici;
  const BREVI = { facile: "Facile", verace: "Verace", biga: "Biga", teglia: "Teglia", personalizzata: "Personal." };

  App.vista("altro", () => h("div", { class: "page" },
    App.testata("Altro"),
    h("nav", { class: "menu", "aria-label": "Altre sezioni" },
      voce("#/madre", "🫙", "Lievito madre", "Rinfreschi e dosi del tuo lievito madre"),
      voce("#/statistiche", "📊", "Statistiche", "Quante pizze, voti, farine e problemi più frequenti"),
      voce("#/impostazioni", "⚙️", "Impostazioni", "Temperature di casa, curva del lievito, esporta e importa i dati")),
    h("p", { class: "hint center" }, "Impasti · le dosi sono indicazioni: farina, cucina e forno fanno la differenza.")));

  function voce(href, icona, titolo, testo) {
    return h("a", { class: "menu-item", href }, h("span", { class: "card-icon", "aria-hidden": "true" }, icona), h("span", { class: "card-body" }, h("strong", null, titolo), h("span", { class: "hint" }, testo)), h("span", { class: "chev", "aria-hidden": "true" }, "›"));
  }

  // --- Statistiche ---

  App.vista("statistiche", () => {
    const pagina = h("div", { class: "page" }, h("a", { class: "back", href: "#/altro" }, "← Altro"), App.testata("Statistiche", "Come vanno i tuoi impasti"));
    const ricette = Object.values(App.dati.ricette);
    const cotture = ricette.flatMap((r) => (r.cotture || []).map((c) => ({ ...c, ricetta: r })));
    if (!ricette.length) {
      pagina.append(App.vuoto("📊", "Ancora nessun dato", "Salva qualche ricetta nel diario e segna le cotture: qui vedrai come vanno i tuoi impasti.", h("a", { class: "btn btn-primary", href: "#/calcola" }, "Calcola un impasto")));
      return pagina;
    }
    const voti = cotture.flatMap((c) => Object.values(c.voti || {})).filter((v) => v > 0);
    const idratazioni = ricette.map((r) => r.risultato?.idratazione).filter(Number.isFinite);
    const media = (l) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : null);

    pagina.append(h("div", { class: "tiles" },
      tessera("Ricette salvate", C.formatta(ricette.length, 0)),
      tessera("Pizze cotte", C.formatta(cotture.length, 0), "cotture segnate nel diario"),
      tessera("Voto medio", voti.length ? `${C.formatta(media(voti), 1)} / 5` : "–"),
      tessera("Idratazione media", idratazioni.length ? `${C.formatta(media(idratazioni), 0)}%` : "–")));

    // Stile e farina più usati
    const conta = (lista) => lista.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map());
    const stili = [...conta(ricette.map((r) => r.stile)).entries()].sort((a, b) => b[1] - a[1]);
    const grammiFarine = new Map();
    ricette.forEach((r) => (r.risultato?.farine || []).forEach((f) => grammiFarine.set(f.nome, (grammiFarine.get(f.nome) || 0) + (f.grammi || 0))));
    const farinaTop = [...grammiFarine.entries()].sort((a, b) => b[1] - a[1])[0];
    pagina.append(h("section", { class: "panel" },
      h("p", null, h("strong", null, "Stile più usato: "), `${C.STILI[stili[0][0]]?.nome || stili[0][0]} (${stili[0][1]} ${stili[0][1] === 1 ? "ricetta" : "ricette"})`),
      farinaTop ? h("p", null, h("strong", null, "Farina più usata: "), `${farinaTop[0]} (${C.formatta(farinaTop[1] / 1000, 1)} kg in tutto)`) : h("p", { class: "hint" }, "Scegli le farine nel calcolatore per sapere quale usi di più.")));

    if (cotture.length) {
      // Cotture negli ultimi 12 mesi
      const mesi = [];
      const oggi = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
        mesi.push({ chiave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, d });
      }
      const perMese = conta(cotture.map((c) => String(c.data).slice(0, 7)));
      const fmtMese = new Intl.DateTimeFormat("it-IT", { month: "short" });
      const fmtMeseLungo = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
      pagina.append(h("section", { class: "panel" }, G.colonne({
        titolo: "Pizze cotte negli ultimi 12 mesi",
        barre: mesi.map((m) => ({ etichetta: fmtMese.format(m.d).replace(".", ""), valore: perMese.get(m.chiave) || 0, dettaglio: `${fmtMeseLungo.format(m.d)}: ${perMese.get(m.chiave) || 0}` })),
        formato: (v) => C.formatta(v, 0),
      })));

      // Voto medio per stile
      const perStile = new Map();
      cotture.forEach((c) => {
        const v = Object.values(c.voti || {}).filter((x) => x > 0);
        if (v.length) perStile.set(c.ricetta.stile, [...(perStile.get(c.ricetta.stile) || []), ...v]);
      });
      if (perStile.size) {
        pagina.append(h("section", { class: "panel" }, G.colonne({
          titolo: "Voto medio per stile (su 5)",
          barre: [...perStile.entries()].map(([st, v]) => ({ etichetta: BREVI[st] || st, valore: media(v), dettaglio: `${C.STILI[st]?.nome || st}: ${C.formatta(media(v), 1)} su 5 (${v.length} voti)` })),
          formato: (v) => C.formatta(v, 1),
        })));
      }

      // Problemi più frequenti
      const problemi = [...conta(cotture.flatMap((c) => c.problemi || [])).entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (problemi.length) {
        pagina.append(h("section", { class: "panel" }, h("h2", null, "Problemi più frequenti"),
          h("ul", { class: "plain" }, problemi.map(([id, n]) => {
            const p = C.PROBLEMI.find((x) => x.id === id);
            return p ? h("li", null, h("details", null, h("summary", null, `${p.nome} · ${n} ${n === 1 ? "volta" : "volte"}`), h("p", null, p.consiglio))) : null;
          }))));
      }
    } else {
      pagina.append(h("p", { class: "hint" }, "Segna le cotture nel diario (\"Ho cotto questa pizza\") per vedere voti e grafici."));
    }
    return pagina;
  });

  function tessera(etichetta, valore, nota) {
    return h("div", { class: "tile" }, h("span", { class: "tile-label" }, etichetta), h("strong", { class: "tile-value" }, valore), nota ? h("span", { class: "hint" }, nota) : null);
  }

  // --- Impostazioni ---

  App.vista("impostazioni", () => {
    const imp = App.impostazioni();
    let timer = null;
    const salva = () => {
      clearTimeout(timer);
      timer = setTimeout(() => App.salvaImpostazioni({ ...imp }).then(() => App.avviso("Impostazioni salvate")), 700);
    };
    const num = (percorso, etichetta, unita, opz = {}) => App.campoNumero({ oggetto: imp, percorso, etichetta, unita, cambia: salva, ...opz });

    const pagina = h("div", { class: "page" },
      h("a", { class: "back", href: "#/altro" }, "← Altro"),
      App.testata("Impostazioni", "Valgono per tutti i dispositivi"),
      h("fieldset", { class: "panel" }, h("legend", null, "Casa tua"),
        h("div", { class: "row" },
          num("tempAmbiente", "Temperatura di casa", "°C", { min: 10, max: 32, aiuto: "Dove lievitano gli impasti" }),
          num("tempFrigo", "Temperatura del frigo", "°C", { min: 0, max: 12, aiuto: "Di solito 4-6 °C" })),
        h("div", { class: "row" },
          num("sale", "Sale predefinito", "g/kg", { min: 0, max: 60, passo: 0.5 }),
          num("oreRinfrescoMadre", "Ore tra rinfresco e impasto", "h", { min: 1, max: 24, passo: 0.5, aiuto: "Per il lievito madre" })),
        App.sceltaPulsanti({ etichetta: "Lievito predefinito", valore: imp.lievito, opzioni: [{ valore: "fresco", testo: "Fresco" }, { valore: "secco", testo: "Secco" }], cambia: (v) => { imp.lievito = v; salva(); } }),
        h("p", { class: "hint" }, "Le nuove temperature valgono per gli impasti nuovi. Per una bozza già aperta nel calcolatore cambia le temperature delle fasi.")),
      editorCurva(imp, salva),
      sezioneDati());
    return pagina;
  });

  function editorCurva(imp, salvaTutto) {
    const box = h("section", { class: "panel" });
    let punti = (C.curvaValida(imp.curva) || C.curvaPredefinita()).map((p) => ({ ...p }));
    const grafico = h("div");
    const tabella = h("div", { class: "curve-table" });

    function salva() {
      const valida = C.curvaValida(punti);
      if (!valida) {
        App.avviso("Servono almeno due punti con ore e dose maggiori di zero", "errore");
        return;
      }
      const predefinita = C.curvaPredefinita();
      const uguale = valida.length === predefinita.length && valida.every((p, i) => p.ore === predefinita[i].ore && Math.abs(p.dose - predefinita[i].dose) < 0.005);
      imp.curva = uguale ? null : valida;
      salvaTutto();
      disegnaGrafico();
    }

    function disegnaGrafico() {
      grafico.textContent = "";
      const curva = C.curvaValida(punti);
      if (!curva) return;
      const xMax = Math.max(72, ...curva.map((p) => p.ore));
      const linea = [];
      for (let x = 1; x <= xMax; x += 0.5) linea.push({ x, y: C.doseDaCurva(x, curva) });
      grafico.append(G.linea({
        titolo: "Lievito fresco per durata (g per kg di farina, ore a 20 °C)",
        punti: linea, xMin: 1, xMax, yMax: Math.max(C.doseDaCurva(3, curva), 4),
        formatoX: (v) => `${C.formatta(v, 0)} h`, formatoY: (v) => C.formatta(v, v < 10 ? 1 : 0),
        descrivi: (p) => `${C.formatta(p.x, 1)} ore → ${C.formatta(p.y, 2)} g/kg`,
      }));
    }

    function disegnaTabella() {
      tabella.textContent = "";
      tabella.append(h("div", { class: "curve-row head" }, h("span", null, "Ore a 20 °C"), h("span", null, "g/kg di lievito fresco"), h("span")));
      punti.forEach((p, i) => {
        tabella.append(h("div", { class: "curve-row" },
          App.campoNumero({ oggetto: p, percorso: "ore", etichetta: `Ore, punto ${i + 1}`, min: 0.5, max: 200, passo: 0.5, cambia: salva }),
          App.campoNumero({ oggetto: p, percorso: "dose", etichetta: `Dose, punto ${i + 1}`, min: 0.01, max: 60, passo: 0.01, cambia: salva }),
          h("button", { type: "button", class: "icon-btn", "aria-label": `Togli il punto ${i + 1}`, disabled: punti.length <= 2, onclick: () => { punti.splice(i, 1); disegnaTabella(); salva(); } }, "✕")));
      });
    }

    box.append(
      h("h2", null, "Curva del lievito"),
      h("p", { class: "hint" }, "Quanto lievito fresco serve, per kg di farina, in base alle ore di lievitazione a 20 °C. Il frigo e le altre temperature vengono convertiti in \"ore a 20 °C\". Se i tuoi impasti lievitano sempre troppo o troppo poco, abbassa o alza i valori: valgono per tutte le ricette nuove."),
      grafico,
      tabella,
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn btn-ghost btn-small", onclick: () => { const u = punti[punti.length - 1]; punti.push({ ore: Math.round(u.ore * 1.5), dose: C.arrotonda(u.dose / 1.6, 2) }); disegnaTabella(); salva(); } }, "+ Aggiungi un punto"),
        h("button", { type: "button", class: "btn btn-ghost btn-small", onclick: async () => { if (await App.conferma("Ripristinare la curva?", "Torna ai valori iniziali dell'app.", "Ripristina", "btn-primary")) { punti = C.curvaPredefinita(); disegnaTabella(); salva(); } } }, "↺ Ripristina")));
    disegnaTabella();
    disegnaGrafico();
    return box;
  }

  function sezioneDati() {
    const file = h("input", { type: "file", accept: "application/json,.json", class: "visually-hidden", "aria-label": "File da importare" });
    file.addEventListener("change", async () => {
      const f = file.files[0];
      file.value = "";
      if (!f) return;
      let dati;
      try {
        dati = JSON.parse(await f.text());
      } catch {
        App.avviso("Il file non è un'esportazione di Impasti", "errore");
        return;
      }
      const n = (k) => Object.keys(dati?.[k] || {}).length;
      const modo = await App.finestra({
        titolo: "Importare i dati?",
        contenuto: h("p", null, `Nel file ci sono ${n("ricette")} ricette, ${n("farine")} farine e ${n("madri")} lieviti madre. "Aggiungi" li unisce a quelli che hai; "Sostituisci tutto" cancella i dati attuali e tiene solo quelli del file.`),
        pulsanti: [{ testo: "Annulla", valore: null }, { testo: "Sostituisci tutto", valore: "sostituisci", classe: "btn-danger" }, { testo: "Aggiungi", valore: "unisci" }],
      });
      if (!modo) return;
      try {
        await App.chiama("POST", "importa", { modo, dati });
        await App.carica();
        App.avviso("Dati importati");
        App.mostra();
      } catch (e) {
        App.avviso(`Importazione non riuscita: ${e.message}`, "errore");
      }
    });
    return h("section", { class: "panel" },
      h("h2", null, "I tuoi dati"),
      h("p", { class: "hint" }, "Ricette, farine, lieviti madre e impostazioni stanno sul Raspberry Pi, con una copia automatica al giorno. Puoi anche scaricarli in un file."),
      h("div", { class: "actions" },
        h("a", { class: "btn", href: "api/esporta", download: "" }, "⬇️ Esporta tutto"),
        h("button", { type: "button", class: "btn", onclick: () => file.click() }, "⬆️ Importa da file"),
        file));
  }
})();
