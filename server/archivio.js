// Archivio dei dati in un file JSON nel volume Docker (/data/impasti.json).
// Ogni scrittura passa da un file temporaneo e un rename, così il file non resta mai a metà.
// Una copia per giorno in /data/backup (le ultime 14).
const fs = require("node:fs");
const path = require("node:path");

const COLLEZIONI = ["ricette", "farine", "madri"];
const GIORNI_BACKUP = 14;

// Farine generiche di partenza: tipi, non marche. Si possono modificare o eliminare.
const FARINE_INIZIALI = [
  { id: "gen-00-debole", nome: "Tipo 00 debole", tipo: "00", W: 180, proteine: 10, note: "Per impasti brevi, poche ore" },
  { id: "gen-00-media", nome: "Tipo 00 media", tipo: "00", W: 260, proteine: 11.5, note: "Va bene per la maggior parte delle pizze, fino a 24 ore" },
  { id: "gen-0-forte", nome: "Tipo 0 forte", tipo: "0", W: 320, proteine: 12.5, note: "Per maturazioni lunghe in frigo" },
  { id: "gen-manitoba", nome: "Manitoba", tipo: "manitoba", W: 380, proteine: 14, note: "Molto forte: di solito in mix con una farina più debole" },
  { id: "gen-tipo1", nome: "Tipo 1", tipo: "1", W: 280, proteine: 12, note: "Più fibre e sapore; assorbe più acqua" },
  { id: "gen-integrale", nome: "Integrale", tipo: "integrale", W: 250, proteine: 12, note: "Meglio in mix (10-30%): assorbe molta acqua" },
  { id: "gen-semola", nome: "Semola rimacinata", tipo: "semola", W: 220, proteine: 12, note: "Per spolverare in stesura o in piccola parte nell'impasto" },
];

function statoIniziale() {
  const ora = new Date().toISOString();
  const farine = {};
  FARINE_INIZIALI.forEach((f) => { farine[f.id] = { ...f, marca: "", preferita: false, creata: ora, aggiornata: ora }; });
  return { versione: 1, ricette: {}, farine, madri: {}, impostazioni: {} };
}

function normalizza(dati) {
  const stato = { versione: 1, ricette: {}, farine: {}, madri: {}, impostazioni: {} };
  if (!dati || typeof dati !== "object") return stato;
  COLLEZIONI.forEach((c) => {
    const v = dati[c];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.entries(v).forEach(([id, r]) => { if (idValido(id) && r && typeof r === "object" && !Array.isArray(r)) stato[c][id] = { ...r, id }; });
    } else if (Array.isArray(v)) {
      v.forEach((r) => { if (r && idValido(r.id)) stato[c][r.id] = r; });
    }
  });
  if (dati.impostazioni && typeof dati.impostazioni === "object" && !Array.isArray(dati.impostazioni)) stato.impostazioni = dati.impostazioni;
  return stato;
}

function idValido(id) {
  return typeof id === "string" && /^[a-z0-9-]{1,64}$/.test(id);
}

class Archivio {
  constructor(cartella) {
    this.cartella = cartella;
    this.file = path.join(cartella, "impasti.json");
    this.cartellaBackup = path.join(cartella, "backup");
    this.coda = Promise.resolve();
    fs.mkdirSync(this.cartellaBackup, { recursive: true });
    if (fs.existsSync(this.file)) {
      this.stato = normalizza(JSON.parse(fs.readFileSync(this.file, "utf8")));
    } else {
      this.stato = statoIniziale();
      this.scriviSubito();
    }
  }

  // Le scritture vanno in fila: mai due insieme sullo stesso file
  salva() {
    this.coda = this.coda.then(() => this.scriviSubito()).catch((e) => console.error("Salvataggio non riuscito:", e));
    return this.coda;
  }

  scriviSubito() {
    this.backupDelGiorno();
    const tmp = `${this.file}.tmp`;
    const fd = fs.openSync(tmp, "w");
    try {
      fs.writeSync(fd, JSON.stringify(this.stato));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, this.file);
  }

  backupDelGiorno() {
    if (!fs.existsSync(this.file)) return;
    const oggi = new Date().toISOString().slice(0, 10);
    const copia = path.join(this.cartellaBackup, `impasti-${oggi}.json`);
    if (!fs.existsSync(copia)) {
      fs.copyFileSync(this.file, copia);
      const vecchie = fs.readdirSync(this.cartellaBackup).filter((f) => /^impasti-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
      vecchie.slice(0, Math.max(vecchie.length - GIORNI_BACKUP, 0)).forEach((f) => fs.unlinkSync(path.join(this.cartellaBackup, f)));
    }
  }

  tutto() {
    return this.stato;
  }

  metti(collezione, id, record) {
    const ora = new Date().toISOString();
    const prima = this.stato[collezione][id];
    this.stato[collezione][id] = { ...record, id, creata: prima?.creata || record.creata || ora, aggiornata: ora };
    return this.salva().then(() => this.stato[collezione][id]);
  }

  togli(collezione, id) {
    const esisteva = Boolean(this.stato[collezione][id]);
    delete this.stato[collezione][id];
    return this.salva().then(() => esisteva);
  }

  impostazioni(valori) {
    this.stato.impostazioni = valori;
    return this.salva().then(() => this.stato.impostazioni);
  }

  // "sostituisci": i dati importati prendono il posto di tutto; "unisci": si aggiungono, a parità di id vince l'importato
  importa(dati, modo) {
    const nuovi = normalizza(dati);
    if (modo === "sostituisci") {
      this.stato = nuovi;
    } else {
      COLLEZIONI.forEach((c) => Object.assign(this.stato[c], nuovi[c]));
      if (Object.keys(nuovi.impostazioni).length) this.stato.impostazioni = { ...this.stato.impostazioni, ...nuovi.impostazioni };
    }
    return this.salva().then(() => ({ ricette: Object.keys(nuovi.ricette).length, farine: Object.keys(nuovi.farine).length, madri: Object.keys(nuovi.madri).length }));
  }
}

module.exports = { Archivio, COLLEZIONI, idValido, normalizza, FARINE_INIZIALI };
