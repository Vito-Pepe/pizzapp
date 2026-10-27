// Avvio: legge i dati dal Pi e mostra la sezione dell'indirizzo (#/calcola, #/diario, ...).
(async function () {
  "use strict";

  const App = window.App;
  const { h } = App;
  const main = document.getElementById("vista");

  App.configura({
    nome: "Impasti",
    schede: [
      { id: "calcola", testo: "Calcola", icona: "🧮" },
      { id: "pianifica", testo: "Pianifica", icona: "⏰" },
      { id: "diario", testo: "Diario", icona: "📒" },
      { id: "farine", testo: "Farine", icona: "🌾" },
      { id: "altro", testo: "Altro", icona: "☰" },
    ],
    schedaDi: { madre: "altro", statistiche: "altro", impostazioni: "altro" },
  });
  App.disegnaSchede();
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

  // Tornando sull'app dopo un po' si rileggono i dati: un altro dispositivo può averli cambiati.
  // La pagina aperta non si ridisegna, per non perdere quello che si sta scrivendo.
  let nascosta = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") nascosta = Date.now();
    else if (nascosta && Date.now() - nascosta > 60000) App.carica().catch(() => {});
  });
})();
