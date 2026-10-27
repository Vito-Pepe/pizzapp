// Server di Impasti: pagine dell'app e API per ricette, farine, lievito madre e impostazioni.
// Nessuna dipendenza esterna. I dati stanno in un file JSON nel volume (vedi archivio.js).
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { Archivio, COLLEZIONI, idValido } = require("./archivio");

const PORTA = Number(process.env.PORT) || 3000;
const CARTELLA_DATI = process.env.DATA_DIR || "/data";
const CARTELLA_APP = path.resolve(process.env.APP_DIR || path.join(__dirname, "..", "app"));
// Database pubblico delle etichette, per le farine lette dal codice a barre
const OFF_URL = process.env.OFF_URL || "https://world.openfoodfacts.org";
const MAX_CORPO = 1024 * 1024;
const MAX_IMPORTA = 10 * 1024 * 1024;

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const INTESTAZIONI = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const archivio = new Archivio(CARTELLA_DATI);

function rispondi(res, stato, corpo, extra = {}) {
  const testo = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
  res.writeHead(stato, { ...INTESTAZIONI, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(testo);
}

function errore(res, stato, messaggio) {
  rispondi(res, stato, { errore: messaggio });
}

function leggiCorpo(req, limite) {
  return new Promise((ok, ko) => {
    let dimensione = 0;
    const pezzi = [];
    const leggi = (p) => {
      dimensione += p.length;
      if (dimensione > limite) {
        // Si smette di tenere i dati (il resto viene scartato) e si risponde subito
        req.off("data", leggi);
        req.resume();
        ko(Object.assign(new Error("Dati troppo grandi"), { stato: 413 }));
        return;
      }
      pezzi.push(p);
    };
    req.on("data", leggi);
    req.on("end", () => {
      try {
        ok(JSON.parse(Buffer.concat(pezzi).toString("utf8") || "null"));
      } catch {
        ko(Object.assign(new Error("JSON non valido"), { stato: 400 }));
      }
    });
    req.on("error", ko);
  });
}

function oggetto(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

// --- Farine dal codice a barre (Open Food Facts) ---

function numero(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
}

function tipoFarina(testo) {
  const t = String(testo || "").toLowerCase();
  if (/manitoba/.test(t)) return "manitoba";
  if (/integral/.test(t)) return "integrale";
  if (/semol/.test(t)) return "semola";
  if (/tipo\s*00|\b00\b/.test(t)) return "00";
  if (/tipo\s*0\b|\b0\b/.test(t)) return "0";
  if (/tipo\s*1\b/.test(t)) return "1";
  if (/tipo\s*2\b/.test(t)) return "2";
  return "";
}

async function cercaCodice(codice) {
  const campi = "product_name,product_name_it,generic_name_it,brands,nutriments,quantity";
  const r = await fetch(`${OFF_URL}/api/v2/product/${codice}.json?fields=${campi}`, {
    headers: { "User-Agent": "Impasti/1.0 (app di casa per gli impasti della pizza)" },
    signal: AbortSignal.timeout(8000),
  });
  if (r.status === 404) return { trovata: false, codice };
  if (!r.ok) throw new Error(`Open Food Facts ha risposto ${r.status}`);
  const j = await r.json();
  if (j.status !== 1 || !oggetto(j.product)) return { trovata: false, codice };
  const p = j.product;
  const nome = String(p.product_name_it || p.product_name || p.generic_name_it || "").trim().slice(0, 120);
  return {
    trovata: true,
    codice,
    nome,
    marca: String(p.brands || "").split(",")[0].trim().slice(0, 80),
    proteine: numero(p.nutriments?.proteins_100g),
    quantita: String(p.quantity || "").slice(0, 40),
    tipo: tipoFarina(`${nome} ${p.generic_name_it || ""}`),
  };
}

// --- API ---

async function api(req, res, url) {
  const parti = url.pathname.split("/").filter(Boolean).slice(1);
  const metodo = req.method;

  // Le scritture arrivano solo dalla pagina stessa: JSON obbligatorio (dagli altri siti
  // il browser chiede prima il permesso, che qui non c'è) e niente richieste da altri siti.
  if (metodo !== "GET" && metodo !== "HEAD") {
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) return errore(res, 415, "Serve Content-Type: application/json");
    if (req.headers["sec-fetch-site"] === "cross-site") return errore(res, 403, "Richiesta da un altro sito");
  }

  if (metodo === "GET" && parti[0] === "salute") return rispondi(res, 200, { ok: true });
  if (metodo === "GET" && parti[0] === "stato" && parti.length === 1) return rispondi(res, 200, archivio.tutto());

  if (parti[0] === "impostazioni" && parti.length === 1 && metodo === "PUT") {
    const corpo = await leggiCorpo(req, MAX_CORPO);
    if (!oggetto(corpo)) return errore(res, 400, "Impostazioni non valide");
    return rispondi(res, 200, await archivio.impostazioni(corpo));
  }

  if (COLLEZIONI.includes(parti[0]) && parti.length === 2) {
    const [collezione, id] = parti;
    if (!idValido(id)) return errore(res, 400, "Identificativo non valido");
    if (metodo === "PUT") {
      const corpo = await leggiCorpo(req, MAX_CORPO);
      if (!oggetto(corpo)) return errore(res, 400, "Dati non validi");
      return rispondi(res, 200, await archivio.metti(collezione, id, corpo));
    }
    if (metodo === "DELETE") return rispondi(res, 200, { ok: true, esisteva: await archivio.togli(collezione, id) });
  }

  if (metodo === "GET" && parti[0] === "esporta" && parti.length === 1) {
    const giorno = new Date().toISOString().slice(0, 10);
    return rispondi(res, 200, JSON.stringify({ app: "impasti", esportato: new Date().toISOString(), ...archivio.tutto() }, null, 2), {
      "Content-Disposition": `attachment; filename="impasti-${giorno}.json"`,
    });
  }

  if (metodo === "POST" && parti[0] === "importa" && parti.length === 1) {
    const corpo = await leggiCorpo(req, MAX_IMPORTA);
    if (!oggetto(corpo) || !oggetto(corpo.dati)) return errore(res, 400, "File non valido");
    return rispondi(res, 200, await archivio.importa(corpo.dati, corpo.modo === "sostituisci" ? "sostituisci" : "unisci"));
  }

  if (metodo === "GET" && parti[0] === "codice" && parti.length === 2) {
    if (!/^\d{8,14}$/.test(parti[1])) return errore(res, 400, "Codice a barre non valido");
    try {
      return rispondi(res, 200, await cercaCodice(parti[1]));
    } catch (e) {
      console.error("Ricerca del codice non riuscita:", e.message);
      return errore(res, 502, "Open Food Facts non risponde: riprova più tardi o inserisci i dati a mano");
    }
  }

  return errore(res, 404, "Non trovato");
}

// --- File dell'app ---

function statico(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") return errore(res, 405, "Metodo non permesso");
  let percorso;
  try {
    percorso = decodeURIComponent(url.pathname);
  } catch {
    return errore(res, 400, "Indirizzo non valido");
  }
  if (percorso.endsWith("/")) percorso += "index.html";
  const file = path.resolve(CARTELLA_APP, `.${percorso}`);
  if (!file.startsWith(CARTELLA_APP + path.sep)) return errore(res, 404, "Non trovato");
  fs.stat(file, (err, info) => {
    if (err || !info.isFile()) {
      res.writeHead(404, { ...INTESTAZIONI, "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Non trovato");
    }
    const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const intestazioni = {
      ...INTESTAZIONI,
      "Content-Type": TIPI[path.extname(file)] || "application/octet-stream",
      // Sempre la versione più recente dopo un aggiornamento dal Pi (il browser chiede se è cambiata)
      "Cache-Control": "no-cache",
      ETag: etag,
    };
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, intestazioni);
      return res.end();
    }
    res.writeHead(200, { ...intestazioni, "Content-Length": info.size });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    api(req, res, url).catch((e) => {
      if (e.stato === 413) res.setHeader("Connection", "close");
      if (!res.headersSent) errore(res, e.stato || 500, e.stato ? e.message : "Errore del server");
      if (!e.stato) console.error(e);
    });
  } else {
    statico(req, res, url);
  }
});

server.listen(PORTA, () => console.log(`Impasti in ascolto sulla porta ${PORTA}, dati in ${CARTELLA_DATI}`));

// Allo spegnimento del container finisce le scritture in corso
function chiudi() {
  server.close();
  archivio.coda.finally(() => process.exit(0));
}
process.on("SIGTERM", chiudi);
process.on("SIGINT", chiudi);

module.exports = { server, tipoFarina };
