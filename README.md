# pizzapp — Impasti

**Impasti** è un calcolatore e diario degli impasti per la pizza, che gira in Docker sul Raspberry Pi. Ricette, farine e lievito madre stanno sul Pi, quindi sono gli stessi dal telefono e dal computer.

- Pagina: `https://pizzapp.<tailnet>.ts.net` dalla tailnet (indirizzo della repo `ingressi-https`), oppure `http://IP-DEL-PI:8090` (o `http://vito:8090`) come riserva.
- Si apre anche dal riquadro **Impasti** della homepage.
- Su iPhone: Safari → Condividi → "Aggiungi alla schermata Home".

## Cosa fa

- **Calcola**: cinque stili.
  - **Pizza Facile**: quante pizze, quante ore, frigo sì o no, che forno hai.
  - **Verace napoletana**: 55,5-62,5% d'acqua, sale a 50 g per litro, panetti da 200-280 g.
  - **Pizza in biga**: dosi della biga e dell'impasto finale.
  - **Pizza in teglia**: dosi dalla misura della teglia.
  - **Personalizzata**: tutto a mano, con lievito fresco, secco o madre.

  Per ogni stile si può scegliere un mix di farine, e il calcolatore dà i grammi di ognuna e la forza (W) media, con un avviso se la farina è debole per i tempi scelti.
- **Lievito in base a ore e temperatura**: le fasi (puntata, frigo, appretto) diventano "ore a 20 °C" e la dose viene da una curva. Ci sono due grafici, la curva con la tua ricetta e la temperatura durante la lievitazione.
- **Pianifica**: "a che ora vuoi mangiare?" dà l'ora d'inizio, i passi (impasta, frigo, panetti, accendi il forno, inforna) con giorno e ora, e le fasi in barre. C'è anche la modalità "inizio adesso".
- **Diario**:
  - ricette salvate con le dosi, preferite, ricerca, note;
  - "Ho cotto questa pizza": voti (sapore, stesura, cottura) e problemi (si strappava, pallida, fondo bruciato…), con i consigli per la volta dopo;
  - "Rifai" riporta la ricetta nel calcolatore.
- **Farine**:
  - elenco con tipo, W, proteine, P/L e acqua consigliata;
  - preferite;
  - **codice a barre**: si inquadra il sacco con la fotocamera (o si scrive il numero) e i dati arrivano da [Open Food Facts](https://world.openfoodfacts.org). La W di solito non c'è: si completa a mano, oppure si usa la stima dalle proteine.
- **Lievito madre**:
  - rinfreschi segnati con un tocco;
  - calcolo del rinfresco per avere i grammi che servono;
  - guida per crearlo da zero.
- **Statistiche**: ricette, pizze cotte, voti, idratazione media, farina più usata, problemi più frequenti.
- **Condividi**: la ricetta come immagine (dal telefono va dritta su WhatsApp e simili) o come testo.
- **Impostazioni**:
  - temperatura di casa e del frigo;
  - curva del lievito modificabile punto per punto;
  - esportazione e importazione di tutti i dati in un file JSON.

Promemoria e notifiche per ora non ci sono.

## Come sono calcolate le dosi

- **Percentuali sulla farina**: acqua = farina × idratazione; sale, olio e zucchero in grammi per kg di farina. La farina si ricava in modo che la somma degli ingredienti dia il peso dell'impasto (panetti × peso, oppure superficie della teglia × grammi per cm²).
- **Lievito madre**: la sua farina e la sua acqua si tolgono da quelle da aggiungere. **Biga**: biga e impasto finale insieme danno l'idratazione totale.
- **Lievito secco**: un terzo del fresco.
- **Lievito e temperatura**: ogni fase vale come le sue ore moltiplicate per la velocità della lievitazione a quella temperatura, rispetto a 20 °C (legge di Arrhenius: 4 °C ≈ un quinto, 30 °C ≈ 2,5 volte; sopra i 32 °C non accelera più).
- **La curva**: grammi di lievito fresco per kg di farina in funzione delle "ore a 20 °C". Di partenza vale 3,5 g/kg a 8 ore e 0,9 g/kg a 24 ore, con una piccola correzione per sale e idratazione.

Le dosi di lievito sono indicazioni: farina, temperatura vera e forno fanno la differenza. Se i tuoi impasti lievitano sempre troppo o troppo poco, ritocca la curva in **Altro → Impostazioni**: vale per tutte le ricette nuove.

Il codice dei calcoli è in `app/impasti-calcoli.js`, i test in `test/calcoli.test.js`.

## I dati

Tutto sta nel volume Docker `pizzapp_dati`:
- `impasti.json` contiene ricette, farine, lieviti madre e impostazioni;
- `backup/` contiene una copia al giorno, le ultime 14.

Ogni salvataggio scrive un file nuovo e poi lo sostituisce, così il file non resta mai a metà.

Backup completo dal Pi:

```bash
docker run --rm -v pizzapp_dati:/data -v "$HOME":/backup alpine tar czf /backup/pizzapp-dati.tgz -C /data .
```

Dalla pagina: **Altro → Impostazioni → Esporta tutto** scarica un file `.json`. **Importa da file** lo rimette, aggiungendo o sostituendo tutto.

## Installazione sul Raspberry Pi

```bash
cd ~
git clone https://github.com/Vito-Pepe/pizzapp.git
cd pizzapp
docker compose up -d --build
curl -s http://127.0.0.1:8090/api/salute
```

Risposta attesa: `{"ok":true}`.

Aggiornamento automatico ogni 5 minuti (senza sudo):

```bash
(crontab -l 2>/dev/null; echo "*/5 * * * * cd $HOME/pizzapp && ./update.sh >> $HOME/pizzapp/update.log 2>&1") | crontab -
```

Indirizzo HTTPS senza porta: servizio `pizzapp` nella repo `ingressi-https`. Serve anche alla **fotocamera per il codice a barre**: il browser la permette solo in HTTPS. Da `http://…:8090` il numero si scrive a mano.

## Sicurezza

- **Niente password**, come le altre app di casa: la pagina è raggiungibile solo dalla rete di casa e dalla tailnet, mai da Internet.
- **Container**: filesystem in sola lettura (si scrive solo nel volume dei dati e in `/tmp`), utente `node` senza privilegi, nessuna capacità di Linux, `no-new-privileges`, limite di processi.
- **Pagina**: non carica niente da altri siti (Content-Security-Policy `default-src 'self'`) e non usa cookie.
- **Scritture**: accettate solo in JSON e solo dalla pagina stessa.
- **Unico collegamento verso Internet**: la ricerca del codice a barre su Open Food Facts, fatta dal server.

## Sviluppo

Senza dipendenze: basta Node 22.

```bash
npm test                                  # test dei calcoli e del server
DATA_DIR=/tmp/impasti PORT=3000 npm start # http://localhost:3000
```

La libreria per leggere i codici a barre è [ZXing](https://github.com/zxing-js/library) 0.21.3, in `app/vendor/` con la sua licenza.

## Porte

| Uso | Porta |
|---|---|
| Pagina e API (LAN e tailnet, http) | 8090 (8080–8089 sono di altre app) |
