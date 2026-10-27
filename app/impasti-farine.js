// Farine (anche dal codice a barre, con Open Food Facts) e lievito madre.
(function () {
  "use strict";

  const App = window.App;
  const { C, h } = App;

  const TIPI = [
    ["00", "Tipo 00"], ["0", "Tipo 0"], ["1", "Tipo 1"], ["2", "Tipo 2"], ["integrale", "Integrale"],
    ["manitoba", "Manitoba"], ["semola", "Semola"], ["altro", "Altro"],
  ];
  const nomeTipo = (t) => (TIPI.find(([id]) => id === t) || [null, ""])[1];

  function normale(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  // --- Elenco delle farine ---

  App.vista("farine", (id) => {
    if (id === "nuova") return modulo(null);
    if (id) return modulo(App.dati.farine[id] || null, id);
    return elenco();
  });

  function elenco() {
    const pagina = h("div", { class: "page" });
    const lista = h("div", { class: "cards" });
    let cerca = "";
    let soloPreferite = false;

    function disegna() {
      lista.textContent = "";
      const q = normale(cerca);
      const farine = App.farineDb()
        .filter((f) => !soloPreferite || f.preferita)
        .filter((f) => !q || normale(`${f.nome} ${f.marca} ${nomeTipo(f.tipo)} ${f.note}`).includes(q))
        .sort((a, b) => (b.preferita ? 1 : 0) - (a.preferita ? 1 : 0) || a.nome.localeCompare(b.nome, "it"));
      if (!farine.length) lista.append(h("p", { class: "hint center" }, App.farineDb().length ? "Nessuna farina corrisponde." : "Nessuna farina salvata."));
      farine.forEach((f) => {
        const dettagli = [nomeTipo(f.tipo), f.W ? `W ${f.W}` : null, f.proteine ? `${C.formatta(f.proteine, 1)}% proteine` : null].filter(Boolean).join(" · ");
        lista.append(h("div", { class: "card" },
          h("a", { class: "card-main", href: `#/farine/${f.id}` },
            h("span", { class: "card-icon", "aria-hidden": "true" }, "🌾"),
            h("span", { class: "card-body" },
              h("strong", null, f.nome, f.marca ? h("span", { class: "brand" }, ` · ${f.marca}`) : null),
              dettagli ? h("span", { class: "hint" }, dettagli) : null,
              f.W ? h("span", { class: "hint" }, `Adatta a ${C.durataPerW(f.W)}`) : null)),
          pulsantePreferita(f, () => { if (soloPreferite) disegna(); })));
      });
    }

    const ricerca = h("input", { type: "search", placeholder: "Cerca una farina…", "aria-label": "Cerca una farina", oninput: () => { cerca = ricerca.value; disegna(); } });
    pagina.append(
      App.testata("Farine", "Forza, proteine e tempi adatti a ogni farina", [
        h("a", { class: "btn btn-primary btn-small", href: "#/farine/nuova" }, "+ Nuova"),
        h("button", { type: "button", class: "btn btn-small", onclick: scansiona }, "📷 Codice a barre"),
      ]),
      h("div", { class: "search" }, ricerca),
      App.sceltaPulsanti({ valore: "tutte", classe: "filters", opzioni: [{ valore: "tutte", testo: "Tutte" }, { valore: "preferite", testo: "★ Preferite" }], cambia: (v) => { soloPreferite = v === "preferite"; disegna(); } }),
      lista,
      h("p", { class: "hint" }, "La W (forza) di solito è scritta sul sacco o sul sito del mulino. Più è alta, più la farina regge tempi lunghi e tanta acqua."));
    disegna();
    return pagina;
  }

  function pulsantePreferita(f, dopo) {
    const b = h("button", {
      type: "button", class: `fav ${f.preferita ? "on" : ""}`, "aria-pressed": String(Boolean(f.preferita)), "aria-label": f.preferita ? "Togli dalle preferite" : "Aggiungi alle preferite",
      onclick: async () => {
        f.preferita = !f.preferita;
        b.classList.toggle("on", f.preferita);
        b.setAttribute("aria-pressed", String(f.preferita));
        await App.salva("farine", { ...f }).catch(() => {});
        dopo?.();
      },
    }, "★");
    return b;
  }

  // --- Modulo di una farina ---

  let daCodice = null;

  function modulo(farina, idCercato) {
    const pagina = h("div", { class: "page" });
    if (idCercato && !farina) {
      pagina.append(App.vuoto("🤷", "Farina non trovata", "Forse è stata eliminata.", h("a", { class: "btn", href: "#/farine" }, "Torna alle farine")));
      return pagina;
    }
    const f = farina ? { ...farina } : { id: App.nuovoId(), nome: "", marca: "", tipo: "00", W: null, PL: null, proteine: null, idratazioneMin: null, idratazioneMax: null, codice: "", note: "", preferita: false };
    let infoCodice = null;
    if (!farina && daCodice) {
      infoCodice = daCodice;
      Object.assign(f, {
        nome: daCodice.nome || "", marca: daCodice.marca || "", tipo: daCodice.tipo || f.tipo, proteine: daCodice.proteine || null, codice: daCodice.codice,
        note: daCodice.quantita ? `Confezione: ${daCodice.quantita}` : "",
      });
      daCodice = null;
    }

    const testo = (campo, etichetta, opz = {}) => {
      const input = h("input", { type: "text", value: f[campo] || "", maxlength: opz.max || 80, required: opz.richiesto, inputmode: opz.inputmode, oninput: () => { f[campo] = input.value; } });
      return h("div", { class: "field" }, h("label", null, etichetta), input);
    };
    const stima = h("div");
    const num = (campo, etichetta, unita, opz = {}) => App.campoNumero({ oggetto: f, percorso: campo, etichetta, unita, vuoto: true, cambia: campo === "proteine" || campo === "W" ? aggiornaStima : null, ...opz });

    function aggiornaStima() {
      stima.textContent = "";
      const s = C.stimaW(f.proteine);
      if (s && !f.W) {
        const media = Math.round((s.min + s.max) / 2 / 10) * 10;
        stima.append(h("p", { class: "hint" }, `Dalle proteine la W stimata è ${s.min}-${s.max} (solo indicativa). `,
          h("button", { type: "button", class: "link", onclick: () => { f.W = media; pagina.querySelector("[data-campo=W] input").value = String(media); aggiornaStima(); } }, `Usa ${media}`)));
      } else if (f.W) {
        stima.append(h("p", { class: "hint" }, `Con W ${f.W}: ${C.durataPerW(f.W)}.`));
      }
    }

    const tipo = h("select", { "aria-label": "Tipo", onchange: () => { f.tipo = tipo.value; } }, TIPI.map(([id, nome]) => h("option", { value: id, selected: id === f.tipo }, nome)));
    const campoW = num("W", "Forza (W)", "", { min: 50, max: 500, passo: 10 });
    campoW.dataset.campo = "W";
    const note = h("textarea", { rows: 3, maxlength: 2000, "aria-label": "Note", oninput: () => { f.note = note.value; } }, f.note || "");

    async function salva() {
      if (!String(f.nome).trim()) {
        App.avviso("Scrivi almeno il nome della farina", "errore");
        return;
      }
      f.nome = String(f.nome).trim();
      await App.salva("farine", f);
      App.avviso("Farina salvata");
      App.vai("#/farine");
    }

    async function elimina() {
      if (!(await App.conferma("Eliminare la farina?", `"${f.nome}" sparirà dall'elenco. Le ricette già salvate non cambiano.`, "Elimina"))) return;
      await App.elimina("farine", f.id);
      App.vai("#/farine");
    }

    pagina.append(
      h("a", { class: "back", href: "#/farine" }, "← Farine"),
      App.testata(farina ? f.nome : "Nuova farina", infoCodice ? (infoCodice.trovata ? "Trovata su Open Food Facts: controlla e completa la W, se è scritta sul sacco" : "Codice non trovato su Open Food Facts: inserisci i dati a mano") : null),
      h("div", { class: "panel form" },
        h("div", { class: "row" }, testo("nome", "Nome", { richiesto: true }), testo("marca", "Marca o mulino")),
        h("div", { class: "row" }, h("div", { class: "field" }, h("label", null, "Tipo"), tipo), campoW),
        h("div", { class: "row" }, num("proteine", "Proteine", "g/100 g", { min: 5, max: 20, passo: 0.1 }), num("PL", "P/L", "", { min: 0.1, max: 3, passo: 0.05, aiuto: "Facoltativo" })),
        stima,
        h("div", { class: "row" }, num("idratazioneMin", "Acqua consigliata: da", "%", { min: 40, max: 100 }), num("idratazioneMax", "fino a", "%", { min: 40, max: 100 })),
        testo("codice", "Codice a barre", { max: 14, inputmode: "numeric" }),
        h("div", { class: "field" }, h("label", null, "Note"), note)),
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn btn-primary", onclick: salva }, "💾 Salva"),
        farina ? h("button", { type: "button", class: "btn btn-ghost btn-danger-text", onclick: elimina }, "🗑️ Elimina") : null));
    aggiornaStima();
    return pagina;
  }

  // --- Codice a barre ---

  let zxingPronto = null;

  function caricaZxing() {
    if (window.ZXing) return Promise.resolve();
    if (!zxingPronto) {
      zxingPronto = new Promise((ok, ko) => {
        const sc = h("script", { src: "vendor/zxing-0.21.3.min.js" });
        sc.onload = ok;
        sc.onerror = () => { zxingPronto = null; ko(new Error("Lettore non caricato")); };
        document.head.append(sc);
      });
    }
    return zxingPronto;
  }

  async function cercaCodice(codice) {
    const pulito = String(codice).replace(/\D/g, "");
    if (!/^\d{8,14}$/.test(pulito)) {
      App.avviso("Il codice a barre ha da 8 a 14 cifre", "errore");
      return false;
    }
    try {
      daCodice = await App.chiama("GET", `codice/${pulito}`);
    } catch (e) {
      App.avviso(e.message, "errore");
      daCodice = { trovata: false, codice: pulito };
    }
    const giaSalvata = App.farineDb().find((f) => f.codice === pulito);
    if (giaSalvata) {
      daCodice = null;
      App.avviso("Questa farina è già nell'elenco");
      App.vai(`#/farine/${giaSalvata.id}`);
      return true;
    }
    App.vai("#/farine/nuova");
    return true;
  }

  async function scansiona() {
    const video = h("video", { class: "scanner-video", playsinline: true, muted: true, autoplay: true });
    const stato = h("p", { class: "hint", "aria-live": "polite" });
    const manuale = h("input", { type: "text", inputmode: "numeric", placeholder: "Es. 8001234567890", maxlength: 14, "aria-label": "Numero del codice a barre" });
    let lettore = null;
    let chiudiFinestra = null;
    const cerca = async () => {
      if (await cercaCodice(manuale.value)) chiudiFinestra?.(null);
    };
    manuale.addEventListener("keydown", (e) => { if (e.key === "Enter") cerca(); });
    const fotocamera = Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia);

    App.finestra({
      titolo: "Leggi il codice a barre",
      classe: "scanner",
      contenuto: [
        fotocamera ? h("div", { class: "scanner-box" }, video, h("div", { class: "scanner-frame", "aria-hidden": "true" })) : h("p", { class: "warning-text" }, "La fotocamera funziona solo aprendo l'app in https (l'indirizzo pizzapp…ts.net). Da qui puoi scrivere il numero sotto il codice a barre."),
        fotocamera ? stato : null,
        h("div", { class: "field" }, h("label", null, "Oppure scrivi il numero sotto il codice a barre"),
          h("div", { class: "input-unit" }, manuale, h("button", { type: "button", class: "btn btn-small", onclick: cerca }, "Cerca"))),
      ],
      pulsanti: [],
      pronto: async (chiudi) => {
        chiudiFinestra = chiudi;
        if (!fotocamera) return;
        stato.textContent = "Avvio la fotocamera…";
        try {
          await caricaZxing();
          lettore = new window.ZXing.BrowserMultiFormatReader();
          await lettore.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, video, async (risultato) => {
            if (!risultato || !lettore) return;
            const codice = risultato.getText();
            lettore.reset();
            lettore = null;
            stato.textContent = `Letto ${codice}: cerco la farina…`;
            if (await cercaCodice(codice)) chiudi(null);
          });
          stato.textContent = "Inquadra il codice a barre del sacco, tenendolo dritto e ben illuminato.";
        } catch (e) {
          stato.textContent = e.name === "NotAllowedError" ? "Permesso per la fotocamera negato: puoi scrivere il numero qui sotto." : "Fotocamera non disponibile: scrivi il numero qui sotto.";
        }
      },
      allaChiusura: () => {
        lettore?.reset();
        lettore = null;
      },
    });
  }

  // --- Lievito madre ---

  App.vista("madre", () => {
    const pagina = h("div", { class: "page" });
    const madri = Object.values(App.dati.madri).sort((a, b) => String(a.creata).localeCompare(String(b.creata)));
    pagina.append(
      h("a", { class: "back", href: "#/altro" }, "← Altro"),
      App.testata("Lievito madre", "Rinfreschi e dosi per il tuo lievito madre", [h("button", { type: "button", class: "btn btn-primary btn-small", onclick: () => modificaMadre(null) }, "+ Nuovo")]));
    if (!madri.length) {
      pagina.append(App.vuoto("🫙", "Nessun lievito madre", "Aggiungi il tuo lievito madre per segnare i rinfreschi e calcolare le dosi. Non ce l'hai? Qui sotto c'è come crearlo."));
    }
    madri.forEach((m) => pagina.append(schedaMadre(m)));
    pagina.append(guida());
    return pagina;
  });

  function statoMadre(m) {
    if (!m.ultimoRinfresco) return "Segna il primo rinfresco con il pulsante qui sotto.";
    const oreFa = (Date.now() - new Date(m.ultimoRinfresco).getTime()) / 3600000;
    if (oreFa < 3) return "Appena rinfrescato: di solito raddoppia in 3-6 ore a 24-26 °C.";
    if (oreFa < 12) return "Rinfrescato da poco: usalo quando è al massimo (raddoppiato, con la cupola).";
    if (oreFa < 24 * 7) return "Prima di usarlo fai un rinfresco e aspetta che raddoppi.";
    return "In frigo da più di una settimana: fai 2-3 rinfreschi prima di usarlo.";
  }

  function schedaMadre(m) {
    const r = { madre: 1, farina: 1, acqua: 1, ...m.rapporto };
    const calcolo = { serve: 100, scorta: 50 };
    const esito = h("p", { class: "result-line" });
    const aggiorna = () => {
      const x = C.rinfrescoMadre({ ...calcolo, rapporto: r });
      esito.textContent = `Rinfresca ${C.grammi(x.madre)} g di lievito madre con ${C.grammi(x.farina)} g di farina e ${C.grammi(x.acqua)} g d'acqua: avrai ${C.grammi(x.totale)} g.`;
    };
    aggiorna();
    const ultimo = m.ultimoRinfresco ? App.giornoOra(m.ultimoRinfresco) : null;
    return h("section", { class: "panel" },
      h("div", { class: "section-head" },
        h("div", null, h("h2", null, m.nome), h("p", { class: "hint" }, `Idratazione ${C.formatta(Number(m.idratazione) || 100, 0)}% · rinfresco ${r.madre}:${r.farina}:${r.acqua} (madre:farina:acqua)`)),
        h("button", { type: "button", class: "btn btn-ghost btn-small", onclick: () => modificaMadre(m) }, "✏️ Modifica")),
      h("p", null, ultimo ? h("strong", null, `Ultimo rinfresco: ${ultimo.giorno} alle ${ultimo.ora} (${App.relativo(m.ultimoRinfresco)})`) : h("strong", null, "Nessun rinfresco segnato")),
      h("p", { class: "hint" }, statoMadre(m)),
      h("div", { class: "actions" }, h("button", {
        type: "button", class: "btn btn-primary", onclick: async () => {
          const ora = new Date().toISOString();
          await App.salva("madri", { ...m, ultimoRinfresco: ora, rinfreschi: [ora, ...(m.rinfreschi || [])].slice(0, 50) }).catch(() => {});
          App.avviso("Rinfresco segnato");
          App.mostra();
        },
      }, "✅ Ho rinfrescato adesso")),
      h("div", { class: "subpanel" },
        h("h3", null, "Quanto rinfrescare"),
        h("div", { class: "row" },
          App.campoNumero({ oggetto: calcolo, percorso: "serve", etichetta: "Mi servono", unita: "g", min: 0, max: 5000, cambia: aggiorna, aiuto: "Per la ricetta" }),
          App.campoNumero({ oggetto: calcolo, percorso: "scorta", etichetta: "Da tenere", unita: "g", min: 0, max: 2000, cambia: aggiorna, aiuto: "Per il prossimo rinfresco" })),
        esito),
      (m.rinfreschi || []).length > 1 ? h("details", null, h("summary", null, "Rinfreschi precedenti"),
        h("ul", { class: "plain" }, m.rinfreschi.slice(0, 10).map((d) => { const q = App.giornoOra(d); return h("li", null, `${q.giorno} alle ${q.ora}`); }))) : null,
      m.note ? h("p", { class: "hint" }, m.note) : null);
  }

  async function modificaMadre(m) {
    const dati = m ? { ...m, rapporto: { madre: 1, farina: 1, acqua: 1, ...m.rapporto } } : { id: App.nuovoId(), nome: "Lievito madre", idratazione: 100, rapporto: { madre: 1, farina: 1, acqua: 1 }, note: "", rinfreschi: [] };
    const nome = h("input", { type: "text", value: dati.nome, maxlength: 60, "aria-label": "Nome" });
    const note = h("textarea", { rows: 2, maxlength: 1000, "aria-label": "Note", placeholder: "Farina che usi per i rinfreschi, dove lo tieni…" }, dati.note || "");
    const scelta = await App.finestra({
      titolo: m ? "Modifica lievito madre" : "Nuovo lievito madre",
      contenuto: [
        h("div", { class: "field" }, h("label", null, "Nome"), nome),
        App.campoNumero({ oggetto: dati, percorso: "idratazione", etichetta: "Idratazione", unita: "%", min: 40, max: 130, aiuto: "100%: liquido o a pasta morbida (pari farina e acqua). 50%: solido" }),
        h("span", { class: "label" }, "Rinfresco (madre : farina : acqua)"),
        h("div", { class: "row" },
          App.campoNumero({ oggetto: dati, percorso: "rapporto.madre", etichetta: "Madre", min: 0.1, max: 10, passo: 0.1 }),
          App.campoNumero({ oggetto: dati, percorso: "rapporto.farina", etichetta: "Farina", min: 0.1, max: 10, passo: 0.1 }),
          App.campoNumero({ oggetto: dati, percorso: "rapporto.acqua", etichetta: "Acqua", min: 0, max: 10, passo: 0.1 })),
        h("div", { class: "field" }, h("label", null, "Note"), note),
      ],
      pulsanti: [
        ...(m ? [{ testo: "Elimina", valore: "elimina", classe: "btn-ghost btn-danger-text" }] : []),
        { testo: "Annulla", valore: false },
        { testo: "Salva", valore: "salva" },
      ],
    });
    if (scelta === "salva") {
      await App.salva("madri", { ...dati, nome: nome.value.trim() || "Lievito madre", note: note.value.trim() }).catch(() => {});
      App.mostra();
    }
    if (scelta === "elimina" && (await App.conferma("Eliminare il lievito madre?", `"${m.nome}" e i suoi rinfreschi spariranno.`, "Elimina"))) {
      await App.elimina("madri", m.id).catch(() => {});
      App.mostra();
    }
  }

  function guida() {
    return h("details", { class: "panel guide" },
      h("summary", null, "Crea il tuo lievito madre"),
      h("ol", null,
        h("li", null, h("strong", null, "Giorno 1: "), "in un barattolo di vetro mescola 50 g di farina (meglio tipo 1 o integrale, più ricche di lieviti naturali) e 50 g d'acqua a 25-28 °C. Copri senza chiudere ermeticamente e lascia a temperatura ambiente."),
        h("li", null, h("strong", null, "Ogni 24 ore: "), "tieni 50 g del composto, butta il resto e aggiungi 50 g di farina e 50 g d'acqua. Mescola bene e segna il livello con un elastico."),
        h("li", null, h("strong", null, "Dopo 5-10 giorni: "), "quando dopo ogni rinfresco raddoppia in 4-6 ore, con tante bollicine e un profumo acidulo gradevole, è pronto."),
        h("li", null, h("strong", null, "Poi: "), "tienilo in frigo e rinfrescalo una volta a settimana. Prima di usarlo fai un rinfresco e aspetta che raddoppi.")),
      h("p", { class: "hint" }, "I primi giorni può gonfiarsi molto e poi fermarsi: è normale, continua con i rinfreschi."));
  }
})();
