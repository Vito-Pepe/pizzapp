const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

const cartellaDati = fs.mkdtempSync(path.join(os.tmpdir(), "impasti-test-"));
let porta;
let processo;
let finto;

function portaLibera() {
  return new Promise((ok) => {
    const s = net.createServer().listen(0, () => {
      const p = s.address().port;
      s.close(() => ok(p));
    });
  });
}

// Open Food Facts finto: un solo prodotto conosciuto
function avviaFinto() {
  return new Promise((ok) => {
    finto = http.createServer((req, res) => {
      if (req.url.startsWith("/api/v2/product/8001234567890.json")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: 1, product: { product_name_it: "Farina di grano tenero tipo 00 per pizza", brands: "Mulino Prova, Altro", nutriments: { proteins_100g: 12.5 }, quantity: "1 kg" } }));
      } else if (req.url.startsWith("/api/v2/product/8000000000000.json")) {
        res.writeHead(500);
        res.end();
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: 0 }));
      }
    }).listen(0, () => ok(finto.address().port));
  });
}

async function avvia() {
  porta = await portaLibera();
  const offPorta = finto.address().port;
  processo = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], {
    env: { ...process.env, PORT: String(porta), DATA_DIR: cartellaDati, OFF_URL: `http://127.0.0.1:${offPorta}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((ok) => processo.stdout.on("data", (d) => String(d).includes("in ascolto") && ok()));
}

function ferma() {
  return new Promise((ok) => {
    processo.once("exit", ok);
    processo.kill("SIGTERM");
  });
}

async function chiama(metodo, percorso, corpo, intestazioni = {}) {
  const r = await fetch(`http://127.0.0.1:${porta}${percorso}`, {
    method: metodo,
    headers: corpo !== undefined ? { "Content-Type": "application/json", ...intestazioni } : intestazioni,
    body: corpo !== undefined ? (typeof corpo === "string" ? corpo : JSON.stringify(corpo)) : undefined,
  });
  const testo = await r.text();
  let json = null;
  try { json = JSON.parse(testo); } catch { /* non JSON */ }
  return { stato: r.status, json, testo, intestazioni: r.headers };
}

test.before(async () => {
  await avviaFinto();
  await avvia();
});

test.after(async () => {
  await ferma();
  finto.close();
  fs.rmSync(cartellaDati, { recursive: true, force: true });
});

test("stato iniziale con le farine generiche", async () => {
  const r = await chiama("GET", "/api/stato");
  assert.equal(r.stato, 200);
  assert.equal(Object.keys(r.json.farine).length, 7);
  assert.deepEqual(r.json.ricette, {});
});

test("salvare, leggere ed eliminare una ricetta", async () => {
  const salva = await chiama("PUT", "/api/ricette/abc123", { nome: "Prova", stile: "facile", input: { panetti: 4 } });
  assert.equal(salva.stato, 200);
  assert.equal(salva.json.id, "abc123");
  assert.ok(salva.json.creata && salva.json.aggiornata);
  const stato = await chiama("GET", "/api/stato");
  assert.equal(stato.json.ricette.abc123.nome, "Prova");
  const creata = stato.json.ricette.abc123.creata;
  const ancora = await chiama("PUT", "/api/ricette/abc123", { nome: "Prova 2" });
  assert.equal(ancora.json.creata, creata, "la data di creazione resta");
  const via = await chiama("DELETE", "/api/ricette/abc123", {});
  assert.deepEqual(via.json, { ok: true, esisteva: true });
});

test("scritture rifiutate", async () => {
  assert.equal((await chiama("PUT", "/api/ricette/x1", "{}", { "Content-Type": "text/plain" })).stato, 415);
  assert.equal((await chiama("PUT", "/api/ricette/x1", {}, { "Sec-Fetch-Site": "cross-site" })).stato, 403);
  assert.equal((await chiama("PUT", "/api/ricette/NON_VALIDO", {})).stato, 400);
  assert.equal((await chiama("PUT", "/api/ricette/x1", [1, 2])).stato, 400);
  assert.equal((await chiama("PUT", "/api/ricette/x1", "{rotto")).stato, 400);
  assert.equal((await chiama("PUT", "/api/sconosciuta/x1", {})).stato, 404);
  assert.equal((await chiama("PUT", "/api/ricette/x1", { testo: "x".repeat(1100000) })).stato, 413);
});

test("impostazioni", async () => {
  const r = await chiama("PUT", "/api/impostazioni", { tempAmbiente: 22, curva: [{ ore: 8, dose: 3 }, { ore: 24, dose: 1 }] });
  assert.equal(r.stato, 200);
  assert.equal((await chiama("GET", "/api/stato")).json.impostazioni.tempAmbiente, 22);
});

test("esportare e importare", async () => {
  await chiama("PUT", "/api/ricette/r1", { nome: "Uno" });
  const esp = await chiama("GET", "/api/esporta");
  assert.match(esp.intestazioni.get("content-disposition"), /attachment; filename="impasti-\d{4}-\d{2}-\d{2}\.json"/);
  const dati = JSON.parse(esp.testo);
  assert.equal(dati.ricette.r1.nome, "Uno");

  const unisci = await chiama("POST", "/api/importa", { modo: "unisci", dati: { ricette: { r2: { nome: "Due" } } } });
  assert.equal(unisci.json.ricette, 1);
  let stato = (await chiama("GET", "/api/stato")).json;
  assert.ok(stato.ricette.r1 && stato.ricette.r2, "unisci tiene le vecchie");

  await chiama("POST", "/api/importa", { modo: "sostituisci", dati: { ricette: [{ id: "r3", nome: "Tre" }], farine: {} } });
  stato = (await chiama("GET", "/api/stato")).json;
  assert.deepEqual(Object.keys(stato.ricette), ["r3"]);
  assert.deepEqual(stato.farine, {});
  assert.equal((await chiama("POST", "/api/importa", { modo: "unisci", dati: "no" })).stato, 400);
});

test("farina dal codice a barre", async () => {
  const r = await chiama("GET", "/api/codice/8001234567890");
  assert.deepEqual(r.json, { trovata: true, codice: "8001234567890", nome: "Farina di grano tenero tipo 00 per pizza", marca: "Mulino Prova", proteine: 12.5, quantita: "1 kg", tipo: "00" });
  assert.deepEqual((await chiama("GET", "/api/codice/8009999999999")).json, { trovata: false, codice: "8009999999999" });
  assert.equal((await chiama("GET", "/api/codice/8000000000000")).stato, 502);
  assert.equal((await chiama("GET", "/api/codice/abc")).stato, 400);
});

test("file dell'app e intestazioni di sicurezza", async () => {
  const r = await chiama("GET", "/");
  assert.equal(r.stato, 200);
  assert.match(r.intestazioni.get("content-type"), /text\/html/);
  assert.match(r.intestazioni.get("content-security-policy"), /default-src 'self'/);
  assert.equal(r.intestazioni.get("referrer-policy"), "no-referrer");
  const etag = r.intestazioni.get("etag");
  assert.equal((await chiama("GET", "/", undefined, { "If-None-Match": etag })).stato, 304);
  assert.equal((await chiama("GET", "/impasti-calcoli.js")).stato, 200);
  assert.equal((await chiama("GET", "/../server/server.js")).stato, 404);
  assert.equal((await chiama("GET", "/%2e%2e/server/server.js")).stato, 404);
  assert.equal((await chiama("GET", "/non-esiste.js")).stato, 404);
});

test("i dati restano dopo il riavvio, con il backup del giorno", async () => {
  await chiama("PUT", "/api/madri/m1", { nome: "Pasta madre" });
  await ferma();
  await avvia();
  const stato = (await chiama("GET", "/api/stato")).json;
  assert.equal(stato.madri.m1.nome, "Pasta madre");
  const backup = fs.readdirSync(path.join(cartellaDati, "backup"));
  assert.ok(backup.some((f) => /^impasti-\d{4}-\d{2}-\d{2}\.json$/.test(f)));
});
