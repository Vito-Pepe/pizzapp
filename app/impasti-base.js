// Base dell'interfaccia: elementi, dati dal Pi, navigazione, finestre e messaggi.
// Le viste (calcola, diario, farine, ...) si registrano con App.vista(nome, funzione).
(function () {
  "use strict";

  const C = window.Calcoli;

  // --- Elementi ---

  const PROPRIETA = new Set(["value", "checked", "disabled", "selected", "indeterminate", "open"]);

  function h(tag, props, ...figli) {
    const el = document.createElement(tag);
    impostaProps(el, props);
    aggiungi(el, figli);
    return el;
  }

  function s(tag, props, ...figli) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    impostaProps(el, props);
    aggiungi(el, figli);
    return el;
  }

  function impostaProps(el, props) {
    if (!props) return;
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") el.setAttribute("class", v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (PROPRIETA.has(k)) el[k] = v;
      else el.setAttribute(k, v === true ? "" : String(v));
    }
  }

  function aggiungi(el, figli) {
    figli.flat(Infinity).forEach((c) => {
      if (c == null || c === false) return;
      el.append(c instanceof Node ? c : String(c));
    });
  }

  // --- Memoria del browser (comodità per questo dispositivo: la bozza del calcolatore) ---

  function leggiLocale(chiave, predefinito) {
    try {
      const v = localStorage.getItem(chiave);
      return v ? JSON.parse(v) : predefinito;
    } catch {
      return predefinito;
    }
  }

  function scriviLocale(chiave, valore) {
    try {
      localStorage.setItem(chiave, JSON.stringify(valore));
    } catch {
      // senza memoria si perde solo la bozza
    }
  }

  // --- Dati sul Pi ---

  async function chiama(metodo, percorso, corpo) {
    const r = await fetch(`api/${percorso}`, {
      method: metodo,
      headers: corpo !== undefined ? { "Content-Type": "application/json" } : {},
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
    let json = null;
    try { json = await r.json(); } catch { /* risposta vuota */ }
    if (!r.ok) throw new Error(json?.errore || `Errore ${r.status}`);
    return json;
  }

  const dati = { ricette: {}, farine: {}, madri: {}, impostazioni: {} };

  async function carica() {
    const st = await chiama("GET", "stato");
    Object.assign(dati, st);
  }

  // Salva un record: subito in pagina, poi sul Pi. Se il Pi non risponde lo dice.
  async function salva(collezione, record) {
    dati[collezione][record.id] = record;
    try {
      const salvato = await chiama("PUT", `${collezione}/${record.id}`, record);
      dati[collezione][record.id] = salvato;
      return salvato;
    } catch (e) {
      avviso(`Non salvato: ${e.message}. Controlla la connessione e riprova.`, "errore");
      throw e;
    }
  }

  async function elimina(collezione, id) {
    const prima = dati[collezione][id];
    delete dati[collezione][id];
    try {
      await chiama("DELETE", `${collezione}/${id}`, {});
    } catch (e) {
      if (prima) dati[collezione][id] = prima;
      avviso(`Non eliminato: ${e.message}`, "errore");
      throw e;
    }
  }

  async function salvaImpostazioni(valori) {
    dati.impostazioni = valori;
    try {
      dati.impostazioni = await chiama("PUT", "impostazioni", valori);
    } catch (e) {
      avviso(`Impostazioni non salvate: ${e.message}`, "errore");
    }
  }

  function impostazioni() {
    return { tempAmbiente: 20, tempFrigo: 4, sale: 25, lievito: "fresco", oreRinfrescoMadre: 4, ...dati.impostazioni };
  }

  function farineDb() {
    return Object.values(dati.farine);
  }

  function nuovoId() {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // --- Date ---

  const fmtGiorno = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const fmtOra = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });
  const fmtData = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const fmtRelativo = new Intl.RelativeTimeFormat("it-IT", { numeric: "auto" });

  function stessoGiorno(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function giornoOra(d) {
    const data = new Date(d);
    const oggi = new Date();
    const domani = new Date(oggi.getTime() + 86400000);
    const ieri = new Date(oggi.getTime() - 86400000);
    let giorno = fmtGiorno.format(data);
    if (stessoGiorno(data, oggi)) giorno = "oggi";
    else if (stessoGiorno(data, domani)) giorno = "domani";
    else if (stessoGiorno(data, ieri)) giorno = "ieri";
    return { giorno, ora: fmtOra.format(data) };
  }

  function data(d) {
    return fmtData.format(new Date(d));
  }

  function relativo(d) {
    const diff = (new Date(d).getTime() - Date.now()) / 1000;
    const a = Math.abs(diff);
    if (a < 60) return "adesso";
    if (a < 3600) return fmtRelativo.format(Math.round(diff / 60), "minute");
    if (a < 86400 * 2) return fmtRelativo.format(Math.round(diff / 3600), "hour");
    return fmtRelativo.format(Math.round(diff / 86400), "day");
  }

  function ore(n) {
    if (!Number.isFinite(n)) return "–";
    if (n < 1) return `${Math.round(n * 60)} min`;
    const intere = Math.floor(n);
    const min = Math.round((n - intere) * 60);
    return min ? `${intere} h ${min} min` : `${intere} h`;
  }

  // Valore per <input type="datetime-local"> nell'ora locale
  function perInputData(d) {
    const x = new Date(d);
    const p = (n) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
  }

  // --- Messaggi e finestre ---

  let timerAvviso = null;

  function avviso(testo, tipo = "ok") {
    const box = document.getElementById("avviso");
    box.textContent = testo;
    box.className = `toast toast-${tipo}`;
    box.hidden = false;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(() => { box.hidden = true; }, tipo === "errore" ? 6000 : 3000);
  }

  // Finestra modale: contenuto + pulsanti. Restituisce una promessa con il valore del pulsante premuto.
  // "pronto" riceve la funzione per chiuderla da codice, "allaChiusura" viene chiamata comunque si chiuda.
  function finestra({ titolo, contenuto, pulsanti = [{ testo: "Chiudi", valore: null }], classe = "", pronto, allaChiusura }) {
    return new Promise((ok) => {
      const dialogo = h("dialog", { class: `dialog ${classe}` });
      let chiusa = false;
      const chiudi = (valore) => {
        if (chiusa) return;
        chiusa = true;
        allaChiusura?.();
        dialogo.close();
        dialogo.remove();
        ok(valore);
      };
      aggiungi(dialogo, [
        h("div", { class: "dialog-head" },
          h("h2", null, titolo),
          h("button", { class: "icon-btn", type: "button", "aria-label": "Chiudi", onclick: () => chiudi(null) }, "✕")),
        h("div", { class: "dialog-body" }, contenuto),
        pulsanti.length ? h("div", { class: "dialog-actions" }, pulsanti.map((p) =>
          h("button", { class: `btn ${p.classe || (p.valore ? "btn-primary" : "btn-ghost")}`, type: "button", onclick: () => chiudi(typeof p.valore === "function" ? p.valore() : p.valore) }, p.testo))) : null,
      ]);
      dialogo.addEventListener("cancel", (e) => { e.preventDefault(); chiudi(null); });
      document.body.append(dialogo);
      dialogo.showModal();
      pronto?.(chiudi);
    });
  }

  function conferma(titolo, testo, siTesto = "Sì", classe = "btn-danger") {
    return finestra({
      titolo,
      contenuto: h("p", null, testo),
      pulsanti: [{ testo: "Annulla", valore: false }, { testo: siTesto, valore: true, classe }],
    });
  }

  // --- Campi dei moduli ---

  function prendi(obj, percorso) {
    return percorso.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function metti(obj, percorso, valore) {
    const chiavi = percorso.split(".");
    let o = obj;
    chiavi.slice(0, -1).forEach((k) => {
      if (o[k] == null || typeof o[k] !== "object") o[k] = {};
      o = o[k];
    });
    o[chiavi[chiavi.length - 1]] = valore;
  }

  // Campo numerico legato a una proprietà di un oggetto (es. "fasi.puntata.ore")
  function campoNumero({ oggetto, percorso, etichetta, unita, min, max, passo = 1, aiuto, cambia, vuoto = false }) {
    const id = `c-${percorso.replace(/\./g, "-")}-${Math.random().toString(36).slice(2, 7)}`;
    const valore = prendi(oggetto, percorso);
    const input = h("input", {
      id, type: "number", inputmode: passo < 1 ? "decimal" : "numeric", min, max, step: passo,
      value: valore == null ? "" : String(valore),
      oninput: () => {
        const v = input.value === "" ? (vuoto ? null : 0) : Number(input.value.replace(",", "."));
        if (input.value !== "" && !Number.isFinite(v)) return;
        metti(oggetto, percorso, v);
        cambia?.(v);
      },
    });
    return h("div", { class: "field" },
      h("label", { for: id }, etichetta),
      h("div", { class: "input-unit" }, input, unita ? h("span", { class: "unit" }, unita) : null),
      aiuto ? h("p", { class: "hint" }, aiuto) : null);
  }

  // Scelta tra poche opzioni, a pulsanti
  function sceltaPulsanti({ opzioni, valore, cambia, etichetta, classe = "" }) {
    const box = h("div", { class: `segmented ${classe}`, role: "group", "aria-label": etichetta || null });
    opzioni.forEach((o) => {
      box.append(h("button", {
        type: "button", class: "seg", "aria-pressed": String(o.valore === valore),
        onclick: () => {
          box.querySelectorAll(".seg").forEach((b) => b.setAttribute("aria-pressed", "false"));
          box.querySelector(`[data-v="${CSS.escape(String(o.valore))}"]`)?.setAttribute("aria-pressed", "true");
          cambia(o.valore);
        },
        dataset: { v: String(o.valore) },
      }, o.testo));
    });
    return etichetta ? h("div", { class: "field" }, h("span", { class: "label" }, etichetta), box) : box;
  }

  function interruttore({ etichetta, aiuto, valore, cambia }) {
    const input = h("input", { type: "checkbox", checked: Boolean(valore), onchange: () => cambia(input.checked) });
    return h("label", { class: "switch" }, input, h("span", { class: "switch-track", "aria-hidden": "true" }),
      h("span", null, h("strong", null, etichetta), aiuto ? h("span", { class: "hint" }, aiuto) : null));
  }

  function stelle({ valore = 0, cambia, etichetta }) {
    const box = h("div", { class: "stars", role: cambia ? "radiogroup" : "img", "aria-label": cambia ? etichetta : `${etichetta || "Voto"}: ${valore} su 5` });
    for (let i = 1; i <= 5; i++) {
      const piena = i <= valore;
      if (cambia) {
        box.append(h("button", {
          type: "button", class: `star ${piena ? "on" : ""}`, role: "radio", "aria-checked": String(i === valore), "aria-label": `${i} su 5`,
          onclick: () => {
            const nuovo = i === valore ? 0 : i;
            valore = nuovo;
            box.querySelectorAll(".star").forEach((b, j) => { b.classList.toggle("on", j < nuovo); b.setAttribute("aria-checked", String(j + 1 === nuovo)); });
            cambia(nuovo);
          },
        }, "★"));
      } else {
        box.append(h("span", { class: `star ${piena ? "on" : ""}`, "aria-hidden": "true" }, "★"));
      }
    }
    return box;
  }

  function vuoto(icona, titolo, testo, azione) {
    return h("div", { class: "empty" }, h("div", { class: "empty-icon", "aria-hidden": "true" }, icona), h("h3", null, titolo), h("p", null, testo), azione || null);
  }

  // --- Navigazione ---

  const viste = {};
  const SCHEDE = [
    { id: "calcola", testo: "Calcola", icona: "🧮" },
    { id: "pianifica", testo: "Pianifica", icona: "⏰" },
    { id: "diario", testo: "Diario", icona: "📒" },
    { id: "farine", testo: "Farine", icona: "🌾" },
    { id: "altro", testo: "Altro", icona: "☰" },
  ];
  const SCHEDA_DI = { madre: "altro", statistiche: "altro", impostazioni: "altro" };

  function vista(nome, fn) {
    viste[nome] = fn;
  }

  function vai(hash) {
    if (location.hash === hash) mostra();
    else location.hash = hash;
  }

  function mostra() {
    const [nome = "calcola", ...resto] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const fn = viste[nome] || viste.calcola;
    const scheda = SCHEDA_DI[nome] || (viste[nome] ? nome : "calcola");
    document.querySelectorAll(".tab").forEach((t) => {
      if (t.dataset.scheda === scheda) t.setAttribute("aria-current", "page");
      else t.removeAttribute("aria-current");
    });
    const main = document.getElementById("vista");
    main.textContent = "";
    const contenuto = fn(...resto.map(decodeURIComponent));
    main.append(contenuto);
    document.title = `${main.querySelector("h1")?.textContent || "Impasti"} · Impasti`;
    window.scrollTo(0, 0);
  }

  function disegnaSchede() {
    const nav = document.getElementById("schede");
    SCHEDE.forEach((t) => nav.append(h("a", { class: "tab", href: `#/${t.id}`, dataset: { scheda: t.id } },
      h("span", { class: "tab-icon", "aria-hidden": "true" }, t.icona), h("span", { class: "tab-label" }, t.testo))));
  }

  function testata(titolo, sottotitolo, azioni) {
    return h("header", { class: "page-head" },
      h("div", null, h("h1", null, titolo), sottotitolo ? h("p", { class: "lead" }, sottotitolo) : null),
      azioni ? h("div", { class: "page-actions" }, azioni) : null);
  }

  window.App = {
    C, h, s, leggiLocale, scriviLocale, dati, carica, salva, elimina, salvaImpostazioni, impostazioni, farineDb, nuovoId, chiama,
    giornoOra, data, relativo, ore, perInputData, avviso, finestra, conferma,
    prendi, metti, campoNumero, sceltaPulsanti, interruttore, stelle, vuoto,
    vista, vai, mostra, disegnaSchede, testata,
  };
})();
