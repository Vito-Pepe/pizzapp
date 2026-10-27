// ImpastiPLUS: calcolatore completo (come PizzApp), ricette con foto, utilità, impostazioni e guida.
(async function () {
  "use strict";

  const App = window.App;
  const P = window.CalcoliPlus;
  const { h } = App;
  const CHIAVE_BOZZA = "impastiplus-bozza";
  const CHIAVE_UTILITA = "impastiplus-utilita";

  const bozza = { ...JSON.parse(JSON.stringify(P.PREDEFINITO)), ...App.leggiLocale(CHIAVE_BOZZA, {}) };

  function opzioni() {
    return { ...P.OPZIONI, ...(App.dati.impostazioni.plus || {}) };
  }

  function salvaBozza() {
    App.scriviLocale(CHIAVE_BOZZA, bozza);
  }

  function calcolaBozza() {
    return P.calcola(bozza, opzioni(), App.farineDb());
  }

  const g = (n) => `${P.formatta(n, 0)} g`;
  const gl = (n) => `${P.grammiLievito(n)} g`;
  const pc = (n, d = 1) => `${P.formatta(n, d)}%`;

  function riassunto(r) {
    const i = r.input;
    const o = r.opzioni;
    let t = `${i.panielli} ${Number(i.panielli) === 1 ? "paniello" : "panielli"} da ${i.peso} g`;
    if (o.dueMisure && Number(i.panielli2) > 0) t += ` + ${i.panielli2} da ${i.peso2} g`;
    t += ` · ${g(r.totale)} di impasto`;
    if (r.scarto) t += ` (con ${r.scarto}% di scarto)`;
    return t;
  }

  function descrizioneTempi(r) {
    const i = r.input;
    const ta = `${i.hta} h a ${i.ta} °C`;
    return r.opzioni.tc && Number(i.htc) > 0 ? `${ta} + ${i.htc} h a ${i.tc} °C` : ta;
  }

  // --- Calcola ---

  App.vista("calcola", () => {
    const pagina = h("div", { class: "page" });
    const corpo = h("div", { class: "form" });
    const risultato = h("div", { "aria-live": "polite" });
    const aggiorna = () => {
      salvaBozza();
      risultato.textContent = "";
      risultato.append(vistaRisultato(calcolaBozza(), { azioni: true }));
    };
    const ridisegna = () => {
      const y = window.scrollY;
      corpo.textContent = "";
      corpo.append(...modulo(aggiorna, ridisegna));
      aggiorna();
      window.scrollTo(0, y);
    };
    pagina.append(App.testata("Calcola", "Le dosi per l'impasto, con i campi che usi (si scelgono in Impostazioni)"), corpo, risultato);
    ridisegna();
    return pagina;
  });

  function sezione(titolo, ...figli) {
    return h("fieldset", { class: "panel" }, h("legend", null, titolo), ...figli);
  }

  function modulo(aggiorna, ridisegna) {
    const o = opzioni();
    const num = (percorso, etichetta, unita, opz = {}) => App.campoNumero({ oggetto: bozza, percorso, etichetta, unita, cambia: aggiorna, ...opz });
    const riga = (...c) => h("div", { class: "row" }, ...c);
    const sezioni = [];

    sezioni.push(sezione("Panielli",
      riga(num("panielli", "Numero", "", { min: 1, max: 200 }), num("peso", "Peso", "g", { min: 10, max: 1500, passo: 5 })),
      o.dueMisure ? riga(num("panielli2", "Numero (seconda misura)", "", { min: 0, max: 200 }), num("peso2", "Peso (seconda misura)", "g", { min: 10, max: 1500, passo: 5 })) : null,
      App.sceltaPulsanti({ etichetta: "Tipo di pizza", valore: bozza.tipo, opzioni: [{ valore: "verace", testo: "Verace" }, { valore: "teglia", testo: "Teglia" }], cambia: (v) => { bozza.tipo = v; aggiorna(); } })));

    // Farine: con più farine si sceglie la percentuale di ognuna
    const db = App.farineDb().sort((a, b) => a.nome.localeCompare(b.nome, "it"));
    const n = Math.min(Math.max(Math.round(Number(o.numFarine) || 1), 1), 6);
    while (bozza.farine.length < 6) bozza.farine.push({ id: "", perc: 0 });
    const righeFarine = [];
    for (let k = 0; k < n; k++) {
      const f = bozza.farine[k];
      const sel = h("select", { "aria-label": `Farina ${k + 1}`, onchange: () => { f.id = sel.value; aggiorna(); } },
        h("option", { value: "", selected: !f.id }, `Farina ${k + 1}`),
        db.map((x) => h("option", { value: x.id, selected: x.id === f.id }, `${x.nome}${x.W ? ` · W ${x.W}` : ""}`)));
      righeFarine.push(n > 1
        ? h("div", { class: "flour-row" }, sel, App.campoNumero({ oggetto: f, percorso: "perc", etichetta: "Parte", unita: "%", min: 1, max: 99, cambia: aggiorna }), h("span"))
        : h("div", { class: "field" }, sel));
    }
    sezioni.push(sezione(n > 1 ? "Farine" : "Farina", ...righeFarine,
      h("p", { class: "hint" }, n > 1 ? "Le percentuali devono fare 100%. Le farine sono quelle della scheda Farine di Impasti." : "Facoltativo: scegli la farina dall'elenco di Impasti per vederne nome e W. Per un mix, aumenta il numero di farine in Impostazioni.")));

    sezioni.push(sezione("Ingredienti",
      riga(num("acqua", "Acqua", "%", { min: 40, max: 100, aiuto: "Idratazione, sulla farina" }), num("sale", "Sale", "%", { min: 0, max: 6, passo: 0.1 })),
      o.grassi ? num("grassi", "Grassi (olio, strutto)", "%", { min: 0, max: 10, passo: 0.1 }) : null));

    sezioni.push(sezione("Lievitazione",
      riga(num("hta", "Ore a temperatura ambiente", "h", { min: 1, max: 100 }), num("ta", "Temperatura ambiente", "°C", { min: 10, max: 40, passo: 0.5 })),
      o.tc ? riga(num("htc", "Ore a temperatura controllata", "h", { min: 0, max: 100, aiuto: "Per esempio in frigo" }), num("tc", "Temperatura controllata", "°C", { min: 1, max: 20, passo: 0.5 })) : null,
      App.sceltaPulsanti({ etichetta: "Lievito", valore: bozza.lievito, classe: "wrap", opzioni: Object.values(P.LIEVITI).map((l) => ({ valore: l.sigla, testo: l.sigla })), cambia: (v) => { bozza.lievito = v; aggiorna(); } }),
      h("div", { class: "yeast-names" }, Object.values(P.LIEVITI).map((l) => [h("b", null, l.sigla), h("span", null, l.nome)]))));

    if (o.pdrIn || o.pdrOut) {
      sezioni.push(sezione("Pasta di riporto",
        o.pdrIn ? riga(num("pdrIn", "Da aggiungere", "%", { min: 0, max: 20, aiuto: "Dell'impasto totale, da un impasto precedente" }),
          App.sceltaPulsanti({ etichetta: "Forza", valore: bozza.pdrForza, opzioni: [{ valore: "bassa", testo: "Bassa" }, { valore: "alta", testo: "Alta" }], cambia: (v) => { bozza.pdrForza = v; aggiorna(); } })) : null,
        o.pdrOut ? num("pdrOut", "Da tenere per la prossima volta", "g", { min: 0, max: 500, passo: 10, aiuto: "Si aggiunge all'impasto e si toglie prima di fare i panielli" }) : null));
    }

    if (o.poolish || o.biga || o.autolisi) {
      sezioni.push(sezione("Prefermenti",
        o.poolish ? riga(num("poolish.perc", "Farina nel poolish", "%", { min: 10, max: 100 }), num("poolish.ore", "Ore del poolish", "h", { min: 1, max: 24 })) : null,
        o.biga ? num("biga.perc", "Farina nella biga", "%", { min: 10, max: 100, aiuto: "Biga con il 45% d'acqua e l'1% di lievito" }) : null,
        o.autolisi ? riga(num("autolisi.perc", "Farina nell'autolisi", "%", { min: 20, max: 100 }), num("autolisi.acqua", "Acqua dell'autolisi", "%", { min: 40, max: 100, aiuto: "Sulla farina dell'autolisi" })) : null));
    }

    if (o.scarto) {
      sezioni.push(sezione("Scarto",
        App.sceltaPulsanti({ etichetta: "Impasto in più per quello che resta nella ciotola", valore: Number(bozza.scarto) || 0, classe: "wrap", opzioni: [0, 1, 2, 3, 4, 5].map((v) => ({ valore: v, testo: `${v}%` })), cambia: (v) => { bozza.scarto = v; aggiorna(); } })));
    }
    return sezioni.filter(Boolean);
  }

  // --- Risultato ---

  function riga(nome, valore, nota, classe) {
    return h("tr", { class: classe || null }, h("th", { scope: "row" }, nome), h("td", { class: "num" }, valore), h("td", { class: "note" }, nota || ""));
  }

  function tabella(righe) {
    return h("table", { class: "doses" }, h("tbody", null, righe.filter(Boolean)));
  }

  function vistaRisultato(r, { azioni = false, ricetta = null } = {}) {
    const box = h("section", { class: "panel result", "aria-label": "Dosi" });
    const farineSbagliate = r.errori.some((e) => e.startsWith("Farine"));
    box.append(h("div", { class: "result-head" }, h("h2", null, "Dosi"), h("p", { class: "lead" }, riassunto(r))));
    if (r.errori.length) box.append(h("ul", { class: "errors" }, r.errori.map((e) => h("li", null, e))));

    if (r.poolish) {
      box.append(h("h3", null, `Poolish · ${r.poolish.ore} ore`), tabella([
        riga("Farina", g(r.poolish.farina), `${r.poolish.perc}% della farina`),
        riga("Acqua", g(r.poolish.acqua), "pari alla farina"),
        riga(P.LIEVITI[r.tipoLievito].nome, gl(r.poolish.lievito), "", "yeast"),
      ]));
    }
    if (r.biga) {
      box.append(h("h3", null, "Biga"), tabella([
        riga("Farina", g(r.biga.farina), `${r.biga.perc}% della farina`),
        riga("Acqua", g(r.biga.acqua), "45%"),
        riga(P.LIEVITI[r.tipoLievito].nome, gl(r.biga.lievito), "1% della farina della biga", "yeast"),
      ]));
    }
    if (r.autolisi) {
      box.append(h("h3", null, "Autolisi"), tabella([
        riga("Farina", g(r.autolisi.farina), `${r.autolisi.perc}% della farina`),
        riga("Acqua", g(r.autolisi.acqua), `${r.autolisi.percAcqua}% della sua farina`),
      ]));
    }

    const m = r.impasto;
    const conPre = r.poolish || r.biga || r.autolisi;
    if (conPre) box.append(h("h3", null, "Impasto"));
    box.append(tabella([
      ...m.farine.map((f) => riga(m.farine.length > 1 ? `${f.nome} (${P.formatta(f.perc, 0)}%)` : f.nome === "Farina 1" ? "Farina" : f.nome, farineSbagliate ? "–" : g(f.grammi), f.W ? `W ${f.W}` : "")),
      h("tr", null, h("th", { scope: "row" }, "Acqua"), h("td", { class: `num ${m.acqua < -0.5 ? "neg" : ""}` }, g(m.acqua)), h("td", { class: "note" }, conPre ? "" : pc(r.input.acqua, 0))),
      riga("Sale", `${P.formatta(m.sale, m.sale < 10 ? 1 : 0)} g`, pc(r.input.sale)),
      r.opzioni.grassi && m.grassi ? riga("Grassi", g(m.grassi), pc(r.input.grassi)) : null,
      r.pdrIn ? riga("Pasta di riporto", g(r.pdrIn), `${r.pdrPerc}% · forza ${r.input.pdrForza}`) : null,
      riga(P.LIEVITI[r.tipoLievito].nome, gl(m.lievito), r.madre ? `${P.formatta((r.lievito / r.farina) * 100, 1)}% sulla farina` : `${P.formatta(r.perc, 3)}% (modello)`, "yeast"),
      r.pdrOut ? riga("Da tenere da parte", g(r.pdrOut), "pasta di riporto per la prossima volta") : null,
      h("tr", { class: "total" }, h("th", { scope: "row" }, "Totale"), h("td", { class: "num" }, g(r.totale)), h("td", { class: "note" }, "")),
    ]));

    box.append(h("p", { class: "hint" }, `In tutto ${g(r.farina)} di farina e ${g(r.acqua)} d'acqua${r.madre ? " (comprese quelle del lievito madre)" : ""}. Lievitazione: ${descrizioneTempi(r)}.`));
    const wTxt = [r.wMedio ? `W del mix: ${Math.round(r.wMedio)}.` : null, r.wConsigliata ? `Per ${r.oreTotali} ore è consigliata una W intorno a ${Math.round(r.wConsigliata / 10) * 10}.` : null].filter(Boolean).join(" ");
    if (wTxt) box.append(h("p", { class: "hint" }, wTxt));
    if (r.opzioni.coeff && Number(r.opzioni.coeff) !== 1) box.append(h("p", { class: "hint" }, `Lievito ritoccato del ${Number(r.opzioni.coeff) > 1 ? "+" : "−"}${Math.round(Math.abs(Number(r.opzioni.coeff) - 1) * 100)}% (Impostazioni).`));
    if (r.avvisi.length) box.append(h("ul", { class: "warnings" }, r.avvisi.map((a) => h("li", null, a))));

    if (azioni) {
      box.append(h("div", { class: "actions" },
        h("button", { type: "button", class: "btn btn-primary", onclick: () => salvaRicetta(r) }, "💾 Salva"),
        h("button", { type: "button", class: "btn", onclick: () => copia(r) }, "📋 Copia"),
        h("button", { type: "button", class: "btn", onclick: () => condividi(r) }, "📤 Condividi")));
    } else if (ricetta) {
      box.append(h("p", { class: "hint" }, `Ricetta salvata il ${App.data(ricetta.creata || Date.now())}.`));
    }
    return box;
  }

  function testo(r, nome) {
    const righe = [`🧮 ${nome || "ImpastiPLUS"}`, riassunto(r), `Lievitazione: ${descrizioneTempi(r)} · ${P.LIEVITI[r.tipoLievito].nome}`, ""];
    const sez = (titolo, voci) => { righe.push(titolo); voci.filter(Boolean).forEach(([n, v]) => righe.push(`- ${n}: ${v}`)); righe.push(""); };
    if (r.poolish) sez(`Poolish (${r.poolish.ore} ore)`, [["Farina", g(r.poolish.farina)], ["Acqua", g(r.poolish.acqua)], ["Lievito", gl(r.poolish.lievito)]]);
    if (r.biga) sez("Biga", [["Farina", g(r.biga.farina)], ["Acqua", g(r.biga.acqua)], ["Lievito", gl(r.biga.lievito)]]);
    if (r.autolisi) sez("Autolisi", [["Farina", g(r.autolisi.farina)], ["Acqua", g(r.autolisi.acqua)]]);
    const m = r.impasto;
    sez("Impasto", [
      ...m.farine.map((f) => [m.farine.length > 1 ? `${f.nome} (${P.formatta(f.perc, 0)}%)` : f.nome === "Farina 1" ? "Farina" : f.nome, g(f.grammi)]),
      ["Acqua", g(m.acqua)], ["Sale", `${P.formatta(m.sale, 1)} g`],
      m.grassi ? ["Grassi", g(m.grassi)] : null,
      r.pdrIn ? ["Pasta di riporto", g(r.pdrIn)] : null,
      [P.LIEVITI[r.tipoLievito].nome, gl(m.lievito)],
      r.pdrOut ? ["Da tenere da parte", g(r.pdrOut)] : null,
    ]);
    return righe.join("\n").trim();
  }

  async function copia(r, nome) {
    const t = testo(r, nome);
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(t);
        App.avviso("Copiata: incollala dove vuoi");
        return;
      } catch { /* si passa alla selezione a mano */ }
    }
    const area = h("textarea", { class: "share-text", rows: 12, readonly: true }, t);
    const attesa = App.finestra({ titolo: "Copia la ricetta", contenuto: [h("p", { class: "hint" }, "Seleziona il testo e copialo."), area] });
    area.focus();
    area.select();
    await attesa;
  }

  async function condividi(r, nome) {
    const t = testo(r, nome);
    if (navigator.share) {
      try {
        await navigator.share({ title: nome || "ImpastiPLUS", text: t });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    await copia(r, nome);
  }

  // --- Ricette ---

  function ricette() {
    return Object.values(App.dati.plus || {}).sort((a, b) => String(b.aggiornata || b.creata).localeCompare(String(a.aggiornata || a.creata)));
  }

  async function salvaRicetta(r) {
    const nome = h("input", { type: "text", maxlength: 80, placeholder: "Es. Margherita del sabato", "aria-label": "Nome" });
    const nota = h("textarea", { rows: 3, maxlength: 2000, placeholder: "Nota (facoltativa)", "aria-label": "Nota" });
    const ok = await App.finestra({
      titolo: "Salva la ricetta",
      contenuto: [h("div", { class: "field" }, h("label", null, "Nome"), nome), h("div", { class: "field" }, h("label", null, "Nota"), nota)],
      pulsanti: [{ testo: "Annulla", valore: false }, { testo: "Salva", valore: true }],
      pronto: () => nome.focus(),
    });
    if (!ok) return;
    const titolo = nome.value.trim() || `Ricetta del ${App.data(new Date())}`;
    const esistente = ricette().find((x) => x.nome.toLocaleLowerCase("it") === titolo.toLocaleLowerCase("it"));
    if (esistente && !(await App.conferma("Ricetta esistente", `Esiste già una ricetta "${esistente.nome}": vuoi sostituirla?`, "Sostituisci", "btn-primary"))) return;
    const record = {
      ...(esistente || {}),
      id: esistente ? esistente.id : App.nuovoId(),
      nome: titolo,
      nota: nota.value.trim() || (esistente ? esistente.nota : ""),
      input: JSON.parse(JSON.stringify(bozza)),
      opzioni: JSON.parse(JSON.stringify(r.opzioni)),
      risultato: JSON.parse(JSON.stringify({ ...r, input: undefined, opzioni: undefined })),
    };
    await App.salva("plus", record);
    App.avviso(esistente ? "Ricetta sostituita" : "Ricetta salvata");
  }

  // Apre una ricetta nel calcolatore: valori e campi che usava
  function apri(ricetta) {
    Object.assign(bozza, JSON.parse(JSON.stringify(ricetta.input || {})));
    salvaBozza();
    const campi = ["dueMisure", "numFarine", "grassi", "tc", "pdrIn", "pdrOut", "poolish", "biga", "autolisi", "scarto"];
    const da = ricetta.opzioni || {};
    const nuove = { ...opzioni() };
    campi.forEach((c) => { if (c in da) nuove[c] = da[c]; });
    App.salvaImpostazioniPlus(nuove).finally(() => App.vai("#/calcola"));
  }

  // Foto: rimpicciolita nel browser (al massimo 1600 px, JPEG) e salvata sul Pi
  function rimpicciolisci(file) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const lato = 1600;
        const scala = Math.min(1, lato / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scala);
        c.height = Math.round(img.naturalHeight * scala);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("Immagine non leggibile")); };
      img.src = url;
    });
  }

  async function aggiungiFoto(ricetta, dopo) {
    const input = h("input", { type: "file", accept: "image/*", class: "visually-hidden" });
    input.addEventListener("change", async () => {
      const file = input.files[0];
      input.remove();
      if (!file) return;
      try {
        App.avviso("Carico la foto…");
        const dati = await rimpicciolisci(file);
        const { id } = await App.chiama("POST", "foto", { dati });
        const vecchia = ricetta.foto;
        await App.salva("plus", { ...ricetta, foto: id });
        if (vecchia) App.chiama("DELETE", `foto/${vecchia}`, {}).catch(() => {});
        App.avviso("Foto salvata");
        dopo?.();
      } catch (e) {
        App.avviso(`Foto non salvata: ${e.message}`, "errore");
      }
    });
    document.body.append(input);
    input.click();
  }

  App.vista("ricette", () => {
    const pagina = h("div", { class: "page" });
    const lista = h("div", { class: "cards" });
    let cerca = "";
    const normale = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

    function disegna() {
      lista.textContent = "";
      const q = normale(cerca);
      const tutte = ricette().filter((r) => !q || normale(`${r.nome} ${r.nota}`).includes(q));
      if (!tutte.length) {
        lista.append(ricette().length
          ? h("p", { class: "hint center" }, "Nessuna ricetta corrisponde alla ricerca.")
          : App.vuoto("📒", "Nessuna ricetta", "Calcola un impasto e premi \"Salva\": qui ritrovi le tue ricette, anche con la foto.", h("a", { class: "btn btn-primary", href: "#/calcola" }, "Vai al calcolo")));
        return;
      }
      tutte.forEach((r) => {
        const res = r.risultato && r.input ? { ...r.risultato, input: r.input, opzioni: r.opzioni || {} } : null;
        const foto = r.foto
          ? h("button", { type: "button", class: "thumb-btn", "aria-label": `Foto di ${r.nome}`, onclick: () => App.finestra({ titolo: r.nome, contenuto: h("img", { class: "photo-full", src: `/api/foto/${r.foto}.jpg`, alt: `Foto di ${r.nome}` }) }) },
            h("img", { class: "thumb", src: `/api/foto/${r.foto}.jpg`, alt: "", loading: "lazy" }))
          : h("span", { class: "card-icon", "aria-hidden": "true" }, "🍕");
        lista.append(h("article", { class: "recipe-card" },
          h("div", { class: "recipe-top" }, foto,
            h("div", { class: "card-body" },
              h("strong", null, r.nome),
              res ? h("span", { class: "hint" }, `${riassunto(res)} · ${descrizioneTempi(res)} · ${P.LIEVITI[res.tipoLievito]?.sigla || ""}`) : null,
              r.nota ? h("span", { class: "hint" }, r.nota) : null,
              h("span", { class: "hint" }, App.data(r.aggiornata || r.creata || Date.now())))),
          h("div", { class: "recipe-actions" },
            h("button", { type: "button", class: "btn btn-primary btn-small", onclick: () => apri(r) }, "Apri"),
            h("button", { type: "button", class: "btn btn-small", onclick: () => aggiungiFoto(r, disegna) }, r.foto ? "📷 Cambia foto" : "📷 Foto"),
            res ? h("button", { type: "button", class: "btn btn-small", onclick: () => copia(res, r.nome) }, "📋 Copia") : null,
            res ? h("button", { type: "button", class: "btn btn-small", "aria-label": `Condividi ${r.nome}`, onclick: () => condividi(res, r.nome) }, "📤") : null,
            h("button", {
              type: "button", class: "btn btn-ghost btn-small btn-danger-text", "aria-label": `Elimina ${r.nome}`, onclick: async () => {
                if (!(await App.conferma("Eliminare la ricetta?", `"${r.nome}"${r.foto ? " e la sua foto" : ""} spariranno.`, "Elimina"))) return;
                await App.elimina("plus", r.id).catch(() => {});
                if (r.foto) App.chiama("DELETE", `foto/${r.foto}`, {}).catch(() => {});
                disegna();
              },
            }, "🗑️"))));
      });
    }

    const ricerca = h("input", { type: "search", placeholder: "Cerca per nome o nota…", "aria-label": "Cerca una ricetta", oninput: () => { cerca = ricerca.value; disegna(); } });
    pagina.append(App.testata("Ricette", "Le ricette salvate: aprile nel calcolatore o aggiungi una foto"), h("div", { class: "search" }, ricerca), lista);
    disegna();
    return pagina;
  });

  // --- Utilità ---

  App.vista("utilita", () => {
    const u = { voluta: 24, ambiente: 20, impastatrice: "mani", wVoluta: 300, w1: 260, w2: 380, mix: [{ perc: 50, w: 300 }, { perc: 50, w: 200 }, { perc: 0, w: 0 }, { perc: 0, w: 0 }], forma: "rettangolare", lato1: 30, lato2: 40, diametro: 32, ritocco: 0, ...App.leggiLocale(CHIAVE_UTILITA, {}) };
    const salva = () => App.scriviLocale(CHIAVE_UTILITA, u);
    const num = (percorso, etichetta, unita, cambia, opz = {}) => App.campoNumero({ oggetto: u, percorso, etichetta, unita, cambia: () => { salva(); cambia(); }, ...opz });
    const pagina = h("div", { class: "page" }, App.testata("Utilità", "Temperatura dell'acqua, forza delle farine e impasto per la teglia"));

    // Temperatura dell'acqua
    const esitoAcqua = h("p", { class: "big-result", "aria-live": "polite" });
    const aggAcqua = () => {
      const imp = P.IMPASTATRICI.find((x) => x.id === u.impastatrice) || P.IMPASTATRICI[4];
      esitoAcqua.textContent = `Acqua a ${P.formatta(P.temperaturaAcqua({ voluta: u.voluta, ambiente: u.ambiente, attrito: imp.attrito }), 1)} °C`;
    };
    const sel = h("select", { "aria-label": "Impastatrice", onchange: () => { u.impastatrice = sel.value; salva(); aggAcqua(); } }, P.IMPASTATRICI.map((x) => h("option", { value: x.id, selected: x.id === u.impastatrice }, x.nome)));
    pagina.append(h("section", { class: "panel" },
      h("h2", null, "🌡️ Temperatura dell'acqua"),
      h("p", { class: "hint" }, "Per arrivare alla temperatura voluta dell'impasto a fine impastamento (di solito 23-25 °C)."),
      h("div", { class: "row" }, num("voluta", "Impasto voluto", "°C", aggAcqua, { min: 10, max: 40, passo: 0.5 }), num("ambiente", "Temperatura ambiente", "°C", aggAcqua, { min: 10, max: 40, passo: 0.5 })),
      h("div", { class: "field" }, h("label", null, "Impastatrice"), sel),
      esitoAcqua));
    aggAcqua();

    // Calcolo della W
    const esitoDue = h("p", { class: "result-line", "aria-live": "polite" });
    const aggDue = () => {
      const x = P.dueFarine({ voluta: u.wVoluta, w1: u.w1, w2: u.w2 });
      esitoDue.textContent = x ? `Farina 1: ${P.formatta(x.p1, 0)}% · Farina 2: ${P.formatta(x.p2, 0)}%` : "La W voluta deve stare tra quelle delle due farine.";
    };
    const esitoMix = h("p", { class: "result-line", "aria-live": "polite" });
    const aggMix = () => {
      const x = P.wMix(u.mix);
      esitoMix.textContent = Math.abs(x.somma - 100) > 0.001 ? `Le percentuali fanno ${P.formatta(x.somma, 0)}%: devono fare 100%.` : `W del mix: ${P.formatta(x.w, 0)}`;
    };
    pagina.append(h("section", { class: "panel" },
      h("h2", null, "💪 Calcolo della W"),
      h("h3", null, "Due farine per una W voluta"),
      h("div", { class: "row" }, num("wVoluta", "W voluta", "", aggDue, { min: 100, max: 500, passo: 10 }), num("w1", "W farina 1", "", aggDue, { min: 100, max: 500, passo: 10 }), num("w2", "W farina 2", "", aggDue, { min: 100, max: 500, passo: 10 })),
      esitoDue,
      h("h3", null, "W di un mix (fino a 4 farine)"),
      u.mix.map((_, k) => h("div", { class: "w-row" }, num(`mix.${k}.perc`, `Farina ${k + 1}: %`, "%", aggMix, { min: 0, max: 100 }), num(`mix.${k}.w`, `Farina ${k + 1}: W`, "", aggMix, { min: 0, max: 500, passo: 10 }))),
      esitoMix));
    aggDue();
    aggMix();

    // Impasto per la teglia
    const esitoTeglia = h("p", { class: "big-result", "aria-live": "polite" });
    const misure = h("div");
    const aggTeglia = () => {
      esitoTeglia.textContent = `${P.formatta(P.pesoTeglia(u).peso, 0)} g di impasto`;
    };
    const disegnaMisure = () => {
      misure.textContent = "";
      misure.append(u.forma === "tonda"
        ? num("diametro", "Diametro", "cm", aggTeglia, { min: 5, max: 100 })
        : h("div", { class: "row" }, num("lato1", "Lato 1", "cm", aggTeglia, { min: 5, max: 100 }), num("lato2", "Lato 2", "cm", aggTeglia, { min: 5, max: 100 })));
      aggTeglia();
    };
    pagina.append(h("section", { class: "panel" },
      h("h2", null, "🟫 Impasto per la teglia"),
      App.sceltaPulsanti({ etichetta: "Forma", valore: u.forma, opzioni: [{ valore: "rettangolare", testo: "Rettangolare" }, { valore: "tonda", testo: "Tonda" }], cambia: (v) => { u.forma = v; salva(); disegnaMisure(); } }),
      misure,
      App.sceltaPulsanti({ etichetta: "Più alta o più bassa", valore: Number(u.ritocco) || 0, classe: "wrap", opzioni: [-20, -15, -10, -5, 0, 5, 10, 15, 20].map((v) => ({ valore: v, testo: `${v > 0 ? "+" : ""}${v}%` })), cambia: (v) => { u.ritocco = v; salva(); aggTeglia(); } }),
      esitoTeglia,
      h("p", { class: "hint" }, "0,5 g di impasto per cm² di teglia, da aumentare o diminuire fino al 20% per una pizza più alta o più bassa.")));
    disegnaMisure();
    return pagina;
  });

  // --- Impostazioni ---

  App.vista("impostazioni", () => {
    const o = opzioni();
    let timer = null;
    const salva = () => {
      clearTimeout(timer);
      timer = setTimeout(() => App.salvaImpostazioniPlus({ ...o }).then(() => { App.avviso("Impostazioni salvate"); schermo(); }), 500);
    };
    const voce = (chiave, etichetta, aiuto) => App.interruttore({ etichetta, aiuto, valore: o[chiave], cambia: (v) => { o[chiave] = v; salva(); } });
    const valoriCoeff = [];
    for (let v = 0.5; v <= 1.501; v += 0.05) valoriCoeff.push(Math.round(v * 100) / 100);
    const coeff = h("select", { "aria-label": "Ritocco del lievito", onchange: () => { o.coeff = Number(coeff.value); salva(); } },
      valoriCoeff.map((v) => h("option", { value: String(v), selected: Math.abs(v - (Number(o.coeff) || 1)) < 0.001 }, v === 1 ? "0%" : `${v > 1 ? "+" : "−"}${Math.round(Math.abs(v - 1) * 100)}%`)));
    return h("div", { class: "page" },
      App.testata("Impostazioni", "Accendi solo i campi che usi: la pagina di calcolo resta semplice"),
      h("section", { class: "panel form" },
        h("h2", null, "Campi del calcolo"),
        App.sceltaPulsanti({ etichetta: "Numero di farine", valore: Number(o.numFarine) || 1, classe: "wrap", opzioni: [1, 2, 3, 4, 5, 6].map((n) => ({ valore: n, testo: String(n) })), cambia: (v) => { o.numFarine = v; salva(); } }),
        voce("dueMisure", "Due misure di panielli", "Per esempio panielli per adulti e per bambini"),
        voce("grassi", "Grassi", "Olio o strutto, in % sulla farina"),
        voce("tc", "Temperatura controllata", "Ore e temperatura in frigo (o in cella)"),
        voce("pdrIn", "Pasta di riporto da aggiungere", "Impasto avanzato da una volta precedente"),
        voce("pdrOut", "Pasta di riporto da tenere", "Grammi da mettere da parte per la prossima volta"),
        voce("poolish", "Poolish", "Prefermento liquido (farina e acqua in pari peso)"),
        voce("biga", "Biga", "Prefermento solido (45% d'acqua, 1% di lievito)"),
        voce("autolisi", "Autolisi", "Farina e acqua a riposo senza lievito"),
        voce("scarto", "Scarto", "Impasto in più per quello che resta nella ciotola")),
      h("section", { class: "panel form" },
        h("h2", null, "Lievito e schermo"),
        h("div", { class: "field" }, h("label", null, "Ritocco del lievito"), coeff, h("p", { class: "hint" }, "Più o meno lievito rispetto al modello, per tutte le dosi.")),
        voce("schermo", "Schermo sempre acceso", "Mentre ImpastiPLUS è aperta (funziona dall'indirizzo https)")),
      h("p", { class: "hint center" }, "Le impostazioni stanno sul Pi: sono le stesse da tutti i dispositivi."));
  });

  // --- Guida ---

  App.vista("guida", () => h("div", { class: "page" },
    App.testata("Guida"),
    h("section", { class: "panel" },
      h("h2", null, "Come si usa"),
      h("ol", { class: "plain-list" },
        h("li", null, "In Impostazioni accendi i campi che ti servono (frigo, prefermenti, più farine…)."),
        h("li", null, "In Calcola scegli panielli, idratazione, sale, ore e temperatura, e il tipo di lievito: le dosi si aggiornano mentre scrivi."),
        h("li", null, "Con poolish, biga o autolisi le dosi sono divise per fasi: prima il prefermento, poi l'impasto."),
        h("li", null, "Salva la ricetta per ritrovarla, aggiungi una foto, copiala o condividila."))),
    h("section", { class: "panel" },
      h("h2", null, "Glossario"),
      h("dl", { class: "glossary" },
        h("dt", null, "LBF · lievito di birra fresco"), h("dd", null, "Il classico cubetto da 25 g, da tenere in frigo."),
        h("dt", null, "LSI · lievito secco istantaneo"), h("dd", null, "Granulato disidratato, si mette direttamente nella farina."),
        h("dt", null, "LSA · lievito secco attivo"), h("dd", null, "Disidratato, va sciolto prima in un po' d'acqua tiepida."),
        h("dt", null, "LMS · lievito madre solido"), h("dd", null, "Pasta madre con il 50% d'acqua sulla farina."),
        h("dt", null, "LML · lievito madre liquido"), h("dd", null, "Lievito madre con pari peso di farina e acqua (100%)."),
        h("dt", null, "PdR · pasta di riporto"), h("dd", null, "Un pezzo di impasto di una volta precedente: aggiunge sapore e un po' di spinta."),
        h("dt", null, "Poolish"), h("dd", null, "Prefermento liquido: farina e acqua in pari peso con poco lievito, qualche ora prima dell'impasto. Rende l'impasto più estensibile."),
        h("dt", null, "Biga"), h("dd", null, "Prefermento asciutto (45% d'acqua, 1% di lievito), di solito 16-24 ore al fresco. Dà profumo, leggerezza e croccantezza; vuole una farina forte."),
        h("dt", null, "Autolisi"), h("dd", null, "Farina e acqua lasciate a riposo senza lievito: la farina assorbe meglio l'acqua e l'impasto si lavora prima."),
        h("dt", null, "TA e TC"), h("dd", null, "Temperatura ambiente e temperatura controllata (per esempio il frigo)."),
        h("dt", null, "W"), h("dd", null, "La forza della farina: più è alta, più regge tempi lunghi e tanta acqua."),
        h("dt", null, "Verace e Teglia"), h("dd", null, "Pizza napoletana (idratazione media, panielli stesi a mano) e pizza in teglia alla romana (idratazione alta, cotta in teglia)."))),
    h("section", { class: "panel" },
      h("h2", null, "Da dove vengono le dosi"),
      h("p", null, "ImpastiPLUS calcola il lievito con lo stesso modello dell'app PizzApp: ore e temperatura (anche in due fasi, ambiente e frigo), tipo di lievito, tipo di pizza e quantità di farina. Le dosi sono un'indicazione: se i tuoi impasti lievitano sempre troppo o troppo poco, usa il ritocco del lievito in Impostazioni.")),
    h("p", { class: "center" }, h("a", { class: "btn", href: "/" }, "‹ Torna alla scelta dell'app"))));

  // --- Schermo sempre acceso ---

  let blocco = null;
  async function schermo() {
    try {
      if (opzioni().schermo && "wakeLock" in navigator && window.isSecureContext) {
        if (!blocco) {
          blocco = await navigator.wakeLock.request("screen");
          blocco.addEventListener("release", () => { blocco = null; });
        }
      } else if (blocco) {
        await blocco.release();
        blocco = null;
      }
    } catch {
      blocco = null;
    }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") schermo(); });

  // --- Avvio ---

  App.configura({
    nome: "ImpastiPLUS",
    schede: [
      { id: "calcola", testo: "Calcola", icona: "🧮" },
      { id: "ricette", testo: "Ricette", icona: "📒" },
      { id: "utilita", testo: "Utilità", icona: "🧰" },
      { id: "impostazioni", testo: "Impostazioni", icona: "⚙️" },
      { id: "guida", testo: "Guida", icona: "📖" },
    ],
  });
  App.disegnaSchede();
  const main = document.getElementById("vista");
  main.append(h("p", { class: "loading" }, "Carico i dati…"));
  try {
    await App.carica();
  } catch (e) {
    main.textContent = "";
    main.append(App.vuoto("📡", "Il Pi non risponde", `Non riesco a leggere i dati (${e.message}). Controlla la connessione e riprova.`,
      h("button", { type: "button", class: "btn btn-primary", onclick: () => location.reload() }, "Riprova")));
    return;
  }
  window.addEventListener("hashchange", App.mostra);
  App.mostra();
  schermo();
})();
