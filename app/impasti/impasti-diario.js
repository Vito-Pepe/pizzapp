// Diario: ricette salvate, preferite, ricerca, note, cotture con voti e consigli.
(function () {
  "use strict";

  const App = window.App;
  const { C, h } = App;

  function normale(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function risultatoDi(ricetta) {
    if (ricetta.risultato && ricetta.risultato.fasi) return { ...ricetta.risultato, input: ricetta.input };
    return App.calcolaInput(ricetta.input || { stile: ricetta.stile });
  }

  function votoMedio(ricetta) {
    const voti = (ricetta.cotture || []).flatMap((c) => Object.values(c.voti || {})).filter((v) => v > 0);
    return voti.length ? voti.reduce((s, v) => s + v, 0) / voti.length : 0;
  }

  App.votoMedio = votoMedio;
  App.risultatoDi = risultatoDi;

  function descrizioneBreve(ricetta) {
    const i = ricetta.input || {};
    const r = ricetta.risultato || {};
    const parti = [C.STILI[ricetta.stile]?.nome || "Impasto"];
    if (ricetta.stile === "teglia" && r.teglia) parti.push(`${r.teglia.numero} ${r.teglia.numero === 1 ? "teglia" : "teglie"}`);
    else if (i.panetti) parti.push(`${i.panetti}×${i.peso} g`);
    if (r.idratazione) parti.push(`${C.formatta(r.idratazione, 0)}%`);
    if (r.oreTotali) parti.push(App.ore(r.oreTotali + (r.biga ? r.biga.ore : 0)));
    return parti.join(" · ");
  }

  function pulsantePreferita(ricetta, dopo) {
    const b = h("button", {
      type: "button", class: `fav ${ricetta.preferita ? "on" : ""}`, "aria-pressed": String(Boolean(ricetta.preferita)),
      "aria-label": ricetta.preferita ? "Togli dalle preferite" : "Aggiungi alle preferite",
      onclick: async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nuova = { ...App.dati.ricette[ricetta.id], preferita: !ricetta.preferita };
        ricetta.preferita = nuova.preferita;
        b.classList.toggle("on", ricetta.preferita);
        b.setAttribute("aria-pressed", String(ricetta.preferita));
        b.setAttribute("aria-label", ricetta.preferita ? "Togli dalle preferite" : "Aggiungi alle preferite");
        await App.salva("ricette", nuova).catch(() => {});
        dopo?.();
      },
    }, "★");
    return b;
  }

  // --- Elenco ---

  App.vista("diario", (id) => (id ? dettaglio(id) : elenco()));

  function elenco() {
    const pagina = h("div", { class: "page" });
    const tutte = Object.values(App.dati.ricette);
    let filtro = "tutte";
    let cerca = "";
    const lista = h("div", { class: "cards" });

    function disegnaLista() {
      lista.textContent = "";
      const q = normale(cerca);
      const trovate = tutte
        .filter((r) => filtro === "tutte" || (filtro === "preferite" ? r.preferita : r.stile === filtro))
        .filter((r) => !q || normale([r.nome, r.note, C.STILI[r.stile]?.nome, ...(r.risultato?.farine || []).map((f) => f.nome), ...(r.cotture || []).map((c) => c.note)].join(" ")).includes(q))
        .sort((a, b) => String(b.aggiornata || b.creata).localeCompare(String(a.aggiornata || a.creata)));
      if (!trovate.length) {
        lista.append(h("p", { class: "hint center" }, tutte.length ? "Nessuna ricetta corrisponde alla ricerca." : ""));
        return;
      }
      trovate.forEach((r) => {
        const voto = votoMedio(r);
        lista.append(h("div", { class: "card" },
          h("a", { class: "card-main", href: `#/diario/${r.id}` },
            h("span", { class: "card-icon", "aria-hidden": "true" }, C.STILI[r.stile]?.icona || "🍕"),
            h("span", { class: "card-body" },
              h("strong", null, r.nome),
              h("span", { class: "hint" }, descrizioneBreve(r)),
              h("span", { class: "card-meta" },
                voto ? App.stelle({ valore: Math.round(voto), etichetta: "Voto medio" }) : null,
                h("span", { class: "hint" }, `${(r.cotture || []).length ? `${r.cotture.length} ${r.cotture.length === 1 ? "cottura" : "cotture"} · ` : ""}${App.data(r.creata || Date.now())}`)))),
          pulsantePreferita(r, () => { if (filtro === "preferite") disegnaLista(); })));
      });
    }

    pagina.append(App.testata("Diario", "Le tue ricette e come sono venute"));
    if (!tutte.length) {
      pagina.append(App.vuoto("📒", "Il diario è vuoto", "Calcola un impasto e premi \"Salva nel diario\": qui potrai segnare come è venuta ogni pizza.",
        h("a", { class: "btn btn-primary", href: "#/calcola" }, "Calcola un impasto")));
      return pagina;
    }
    const stili = [...new Set(tutte.map((r) => r.stile))];
    const ricerca = h("input", { type: "search", placeholder: "Cerca per nome, farina, note…", "aria-label": "Cerca nel diario", oninput: () => { cerca = ricerca.value; disegnaLista(); } });
    pagina.append(
      h("div", { class: "search" }, ricerca),
      App.sceltaPulsanti({ valore: filtro, classe: "wrap filters", etichetta: null, opzioni: [{ valore: "tutte", testo: "Tutte" }, { valore: "preferite", testo: "★ Preferite" }, ...stili.map((st) => ({ valore: st, testo: C.STILI[st]?.nome || st }))], cambia: (v) => { filtro = v; disegnaLista(); } }),
      lista);
    disegnaLista();
    return pagina;
  }

  // --- Scheda della ricetta ---

  function dettaglio(id) {
    const ricetta = App.dati.ricette[id];
    const pagina = h("div", { class: "page" });
    if (!ricetta) {
      pagina.append(App.vuoto("🤷", "Ricetta non trovata", "Forse è stata eliminata da un altro dispositivo.", h("a", { class: "btn", href: "#/diario" }, "Torna al diario")));
      return pagina;
    }
    const r = risultatoDi(ricetta);
    const titolo = h("h1", null, ricetta.nome);

    async function rinomina() {
      const input = h("input", { type: "text", value: ricetta.nome, maxlength: 80, "aria-label": "Nome" });
      const ok = await App.finestra({ titolo: "Rinomina", contenuto: input, pulsanti: [{ testo: "Annulla", valore: false }, { testo: "Salva", valore: true }] });
      if (!ok || !input.value.trim()) return;
      ricetta.nome = input.value.trim();
      titolo.textContent = ricetta.nome;
      await App.salva("ricette", ricetta);
    }

    async function elimina() {
      if (!(await App.conferma("Eliminare la ricetta?", `"${ricetta.nome}" e le sue cotture spariranno dal diario.`, "Elimina"))) return;
      await App.elimina("ricette", ricetta.id);
      App.avviso("Ricetta eliminata");
      App.vai("#/diario");
    }

    const note = h("textarea", { rows: 3, maxlength: 4000, placeholder: "Farina usata, come hai impastato, cosa cambiare la prossima volta…", "aria-label": "Note" }, ricetta.note || "");
    note.addEventListener("change", async () => {
      ricetta.note = note.value.trim();
      await App.salva("ricette", ricetta).then(() => App.avviso("Note salvate")).catch(() => {});
    });

    pagina.append(
      h("a", { class: "back", href: "#/diario" }, "← Diario"),
      h("header", { class: "page-head" },
        h("div", null, titolo, h("p", { class: "lead" }, `${descrizioneBreve(ricetta)} · salvata il ${App.data(ricetta.creata || Date.now())}`)),
        h("div", { class: "page-actions" }, pulsantePreferita(ricetta))),
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn btn-primary", onclick: () => App.caricaInCalcolatore(ricetta.input) }, "🔁 Rifai"),
        h("a", { class: "btn", href: `#/pianifica/${ricetta.id}` }, "⏰ Pianifica"),
        h("button", { type: "button", class: "btn", onclick: () => window.Condividi.apri({ nome: ricetta.nome, risultato: r }) }, "📤 Condividi"),
        h("button", { type: "button", class: "btn btn-ghost", onclick: rinomina }, "✏️ Rinomina"),
        h("button", { type: "button", class: "btn btn-ghost btn-danger-text", onclick: elimina }, "🗑️ Elimina")),
      ricetta.piano ? h("p", { class: "panel plan-note" }, `⏰ Programmata: inizio ${App.giornoOra(ricetta.piano.inizio).giorno} alle ${App.giornoOra(ricetta.piano.inizio).ora}, si mangia ${App.giornoOra(ricetta.piano.mangiare).giorno} alle ${App.giornoOra(ricetta.piano.mangiare).ora}`) : "",
      h("section", { class: "panel" }, h("h2", null, "Note"), note),
      sezioneCotture(ricetta),
      App.vistaRisultato(r, { ricetta }));
    return pagina;
  }

  // --- Cotture ---

  function sezioneCotture(ricetta) {
    const box = h("section", { class: "panel" });
    const lista = h("div", { class: "bakes" });

    function disegna() {
      lista.textContent = "";
      const cotture = ricetta.cotture || [];
      if (!cotture.length) lista.append(h("p", { class: "hint" }, "Dopo aver cotto questa pizza, segna com'è venuta: ti do qualche consiglio per la prossima volta."));
      cotture.forEach((c) => lista.append(vistaCottura(ricetta, c, disegna)));
    }

    box.append(
      h("div", { class: "section-head" }, h("h2", null, "Cotture"),
        h("button", { type: "button", class: "btn btn-primary btn-small", onclick: async () => { if (await nuovaCottura(ricetta)) disegna(); } }, "+ Ho cotto questa pizza")),
      lista);
    disegna();
    return box;
  }

  async function nuovaCottura(ricetta) {
    const cottura = { id: App.nuovoId(), data: new Date().toISOString().slice(0, 10), voti: {}, problemi: [], note: "" };
    const dataInput = h("input", { type: "date", value: cottura.data, "aria-label": "Data", onchange: () => { cottura.data = dataInput.value; } });
    const voti = C.VOTI.map((v) => h("div", { class: "vote-row" }, h("span", null, v.nome), App.stelle({ valore: 0, etichetta: v.nome, cambia: (n) => { cottura.voti[v.id] = n; } })));
    const problemi = h("div", { class: "checks" }, C.PROBLEMI.map((p) => {
      const cb = h("input", { type: "checkbox", onchange: () => { cottura.problemi = cb.checked ? [...cottura.problemi, p.id] : cottura.problemi.filter((x) => x !== p.id); } });
      return h("label", { class: "check" }, cb, h("span", null, p.nome));
    }));
    const note = h("textarea", { rows: 2, maxlength: 2000, placeholder: "Com'era? Cosa hai notato?", "aria-label": "Note sulla cottura" });
    const ok = await App.finestra({
      titolo: "Com'è venuta?",
      contenuto: [
        h("div", { class: "field" }, h("label", null, "Quando"), dataInput),
        h("div", { class: "votes" }, voti),
        h("div", { class: "field" }, h("span", { class: "label" }, "Qualcosa non andava? (facoltativo)"), problemi),
        h("div", { class: "field" }, h("label", null, "Note"), note),
      ],
      pulsanti: [{ testo: "Annulla", valore: false }, { testo: "Salva", valore: true }],
    });
    if (!ok) return false;
    cottura.note = note.value.trim();
    ricetta.cotture = [cottura, ...(ricetta.cotture || [])].sort((a, b) => String(b.data).localeCompare(String(a.data)));
    await App.salva("ricette", ricetta).catch(() => {});
    const consigli = C.consigliCottura(cottura);
    if (consigli.length) {
      await App.finestra({ titolo: "Consigli per la prossima volta", contenuto: listaConsigli(consigli) });
    } else {
      App.avviso("Cottura salvata");
    }
    return true;
  }

  function listaConsigli(consigli) {
    return h("ul", { class: "tips" }, consigli.map((c) => h("li", null, h("strong", null, c.titolo), h("p", null, c.testo))));
  }

  function vistaCottura(ricetta, c, ridisegna) {
    const consigli = C.consigliCottura(c);
    const nomiProblemi = (c.problemi || []).map((id) => C.PROBLEMI.find((p) => p.id === id)?.nome).filter(Boolean);
    return h("article", { class: "bake" },
      h("div", { class: "bake-head" },
        h("strong", null, App.data(c.data)),
        h("button", {
          type: "button", class: "icon-btn", "aria-label": "Elimina questa cottura",
          onclick: async () => {
            if (!(await App.conferma("Eliminare la cottura?", `La cottura del ${App.data(c.data)} sparirà dal diario.`, "Elimina"))) return;
            ricetta.cotture = ricetta.cotture.filter((x) => x.id !== c.id);
            await App.salva("ricette", ricetta).catch(() => {});
            ridisegna();
          },
        }, "🗑️")),
      h("div", { class: "votes compact" }, C.VOTI.filter((v) => c.voti?.[v.id]).map((v) => h("div", { class: "vote-row" }, h("span", null, v.nome), App.stelle({ valore: c.voti[v.id], etichetta: v.nome })))),
      nomiProblemi.length ? h("div", { class: "chips" }, nomiProblemi.map((n) => h("span", { class: "chip" }, n))) : null,
      c.note ? h("p", null, c.note) : null,
      consigli.length ? h("details", { class: "tips-box" }, h("summary", null, `Consigli (${consigli.length})`), listaConsigli(consigli)) : null);
  }
})();
