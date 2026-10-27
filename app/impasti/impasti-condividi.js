// Condivisione di una ricetta: immagine disegnata su canvas (niente librerie) o testo semplice.
(function () {
  "use strict";

  const App = window.App;
  const { C, h } = App;

  // Righe della ricetta, uguali per immagine e testo
  function sezioni(r) {
    const nomeLievito = { fresco: "Lievito fresco", secco: "Lievito secco", madre: "Lievito madre" };
    if (r.biga) {
      return [
        { titolo: `Biga (${C.formatta(r.biga.ore, 0)} ore a ${r.biga.temp} °C)`, righe: [
          ["Farina", `${C.grammi(r.biga.farina)} g`],
          ["Acqua", `${C.grammi(r.biga.acqua)} g`],
          ["Lievito fresco", `${C.grammi(r.biga.lievito)} g`],
        ] },
        { titolo: "Impasto finale", righe: [
          ["Biga", "tutta"],
          r.rinfresco.farina >= 0.5 ? ["Farina", `${C.grammi(r.rinfresco.farina)} g`] : null,
          ["Acqua", `${C.grammi(Math.max(r.rinfresco.acqua, 0))} g`],
          ["Sale", `${C.grammi(r.rinfresco.sale)} g`],
          r.rinfresco.olio ? ["Olio", `${C.grammi(r.rinfresco.olio)} g`] : null,
          r.rinfresco.zucchero ? ["Zucchero o malto", `${C.grammi(r.rinfresco.zucchero)} g`] : null,
          r.rinfresco.lievito ? ["Lievito fresco", `${C.grammi(r.rinfresco.lievito)} g`] : null,
        ].filter(Boolean) },
      ];
    }
    return [{ titolo: "Ingredienti", righe: [
      [r.madre ? "Farina da aggiungere" : "Farina", `${C.grammi(r.daAggiungere.farina)} g`],
      ...r.farine.map((f) => [`  ${f.nome} (${C.formatta(f.perc, 0)}%)`, `${C.grammi((r.daAggiungere.farina * f.perc) / 100)} g`]),
      [r.madre ? "Acqua da aggiungere" : "Acqua", `${C.grammi(Math.max(r.daAggiungere.acqua, 0))} g (${C.formatta(r.idratazione, 0)}%)`],
      ["Sale", `${C.grammi(r.sale)} g`],
      r.olio ? ["Olio", `${C.grammi(r.olio)} g`] : null,
      r.zucchero ? ["Zucchero o malto", `${C.grammi(r.zucchero)} g`] : null,
      r.madre ? ["Lievito madre", `${C.grammi(r.madre.grammi)} g`] : [nomeLievito[r.lievito.tipo], `${C.grammi(r.lievito.grammi)} g`],
    ].filter(Boolean) }];
  }

  function comeTesto(nome, r) {
    const righe = [`🍕 ${nome}`, App.riassunto(r), ""];
    sezioni(r).forEach((sz) => {
      righe.push(sz.titolo);
      sz.righe.forEach(([n, v]) => righe.push(`- ${n.trim()}: ${v}`));
      righe.push("");
    });
    righe.push(`Lievitazione (${App.ore(r.oreTotali)}): ${App.testoFasi(r.fasi)}`);
    return righe.join("\n");
  }

  // --- Immagine ---

  const LARGHEZZA = 1080;

  function aCapo(ctx, testo, larghezzaMax) {
    const parole = String(testo).split(" ");
    const righe = [];
    let corrente = "";
    parole.forEach((p) => {
      const prova = corrente ? `${corrente} ${p}` : p;
      if (ctx.measureText(prova).width > larghezzaMax && corrente) {
        righe.push(corrente);
        corrente = p;
      } else corrente = prova;
    });
    if (corrente) righe.push(corrente);
    return righe;
  }

  function disegna(nome, r) {
    const font = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    const blocchi = sezioni(r);
    const misura = document.createElement("canvas").getContext("2d");
    misura.font = `600 34px ${font}`;
    const fasi = aCapo(misura, `${App.testoFasi(r.fasi)}`, LARGHEZZA - 160);
    misura.font = `800 64px ${font}`;
    const titolo = aCapo(misura, nome, LARGHEZZA - 160);
    const altezza = 260 + titolo.length * 76 + blocchi.reduce((s, b) => s + 90 + b.righe.length * 64, 0) + 120 + fasi.length * 46 + 140;

    const canvas = document.createElement("canvas");
    canvas.width = LARGHEZZA;
    canvas.height = altezza;
    const ctx = canvas.getContext("2d");

    // Sfondo color farina e fascia color pomodoro
    ctx.fillStyle = "#fbf4e8";
    ctx.fillRect(0, 0, LARGHEZZA, altezza);
    const fascia = 120 + titolo.length * 76 + 70;
    ctx.fillStyle = "#c8402b";
    ctx.fillRect(0, 0, LARGHEZZA, fascia);
    ctx.fillStyle = "#e98b3a";
    ctx.fillRect(0, fascia, LARGHEZZA, 12);

    let y = 110;
    ctx.fillStyle = "#ffe9df";
    ctx.font = `700 32px ${font}`;
    ctx.fillText(`🍕 Impasti · ${C.STILI[r.stile].nome}`, 80, y);
    y += 80;
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 64px ${font}`;
    titolo.forEach((t) => { ctx.fillText(t, 80, y); y += 76; });
    ctx.font = `500 32px ${font}`;
    ctx.fillStyle = "#ffe9df";
    ctx.fillText(App.riassunto(r), 80, y - 10);

    y = fascia + 100;
    blocchi.forEach((b) => {
      ctx.fillStyle = "#c8402b";
      ctx.font = `800 38px ${font}`;
      ctx.fillText(b.titolo, 80, y);
      y += 30;
      b.righe.forEach(([n, v], i) => {
        y += 64;
        if (i % 2 === 0) {
          ctx.fillStyle = "#f3e7d3";
          ctx.fillRect(60, y - 46, LARGHEZZA - 120, 64);
        }
        ctx.fillStyle = "#2b211b";
        ctx.font = `${n.startsWith("  ") ? "500 32px" : "600 36px"} ${font}`;
        ctx.textAlign = "left";
        ctx.fillText(n.trim(), n.startsWith("  ") ? 120 : 80, y);
        ctx.font = `800 38px ${font}`;
        ctx.textAlign = "right";
        ctx.fillText(v, LARGHEZZA - 80, y);
        ctx.textAlign = "left";
      });
      y += 90;
    });

    ctx.fillStyle = "#3c7a3e";
    ctx.font = `800 36px ${font}`;
    ctx.fillText(`Lievitazione · ${App.ore(r.oreTotali)}`, 80, y);
    y += 54;
    ctx.fillStyle = "#5c4d42";
    ctx.font = `600 34px ${font}`;
    fasi.forEach((t) => { ctx.fillText(t, 80, y); y += 46; });

    ctx.fillStyle = "#9a8676";
    ctx.font = `500 28px ${font}`;
    ctx.fillText("Fatto con Impasti", 80, altezza - 60);
    return canvas;
  }

  function nomeFile(nome) {
    return `${String(nome).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ricetta"}.png`;
  }

  async function apri({ nome, risultato }) {
    const canvas = disegna(nome, risultato);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
    const url = URL.createObjectURL(blob);
    const file = new File([blob], nomeFile(nome), { type: "image/png" });
    const puoCondividere = Boolean(navigator.canShare && navigator.canShare({ files: [file] }));
    const pulsanti = [];
    if (puoCondividere) pulsanti.push({ testo: "Condividi immagine", valore: "immagine" });
    pulsanti.push({ testo: "Scarica immagine", valore: "scarica", classe: puoCondividere ? "btn" : "btn-primary" });
    pulsanti.push({ testo: "Copia testo", valore: "testo", classe: "btn" });
    const scelta = await App.finestra({
      titolo: "Condividi la ricetta",
      contenuto: h("img", { class: "share-preview", src: url, alt: `Anteprima della ricetta ${nome}` }),
      pulsanti,
    });
    try {
      if (scelta === "immagine") await navigator.share({ files: [file], title: nome });
      if (scelta === "scarica") {
        const a = h("a", { href: url, download: file.name });
        document.body.append(a);
        a.click();
        a.remove();
      }
      if (scelta === "testo") await testo(nome, comeTesto(nome, risultato));
    } catch (e) {
      if (e.name !== "AbortError") App.avviso("Condivisione non riuscita", "errore");
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }

  // Testo: negli appunti se il browser lo permette (serve https), altrimenti da selezionare a mano
  async function testo(titolo, contenuto) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(contenuto);
        App.avviso("Copiato: incollalo dove vuoi");
        return;
      } catch { /* si passa alla selezione a mano */ }
    }
    const area = h("textarea", { class: "share-text", rows: 12, readonly: true }, contenuto);
    const attesa = App.finestra({ titolo, contenuto: [h("p", { class: "hint" }, "Seleziona il testo e copialo."), area] });
    area.focus();
    area.select();
    await attesa;
  }

  window.Condividi = { apri, testo, comeTesto };
})();
