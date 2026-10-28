# pizzapp — Impasti e ImpastiPLUS

Due app per l'impasto della pizza, in un solo container Docker sul Raspberry Pi. Ricette, farine, foto e impostazioni stanno sul Pi, quindi sono le stesse dal telefono e dal computer.

- Pagina: `https://pizzapp.<tailnet>.ts.net` dalla tailnet (indirizzo della repo `ingressi-https`), oppure `http://IP-DEL-PI:8090` (o `http://vito:8090`) come riserva. Si apre anche dal riquadro **Impasti** della homepage.
- La prima pagina fa scegliere l'app:
  - **Impasti** (`/impasti/`): calcolatore per stili, pianificazione, diario con cotture e consigli, farine con codice a barre, lievito madre, statistiche;
  - **ImpastiPLUS** (`/impastiplus/`): il calcolatore completo, con le stesse dosi di PizzApp, utilità e ricette con foto.
- I vecchi indirizzi di Impasti (`/#/diario` e simili) rimandano da soli a `/impasti/`.
- Su iPhone: Safari → Condividi → "Aggiungi alla schermata Home". Si può aggiungere la pagina di scelta o direttamente una delle due app.

## Impasti

- **Calcola**: cinque stili.
  - **Pizza Facile**: quante pizze, quante ore, frigo sì o no, che forno hai.
  - **Verace napoletana**: 55,5-62,5% d'acqua, sale a 50 g per litro, panetti da 200-280 g.
  - **Pizza in biga**: dosi della biga e dell'impasto finale.
  - **Pizza in teglia**: dosi dalla misura della teglia.
  - **Personalizzata**: tutto a mano, con lievito fresco, secco o madre.

  Per ogni stile si può scegliere un mix di farine, e il calcolatore dà i grammi di ognuna e la forza (W) media, con un avviso se la farina è debole per i tempi scelti.
- **Quanto tempo hai**: in ogni stile si scrivono le **ore dall'impasto al pasto**, oppure si sceglie 4, 6, 8, 12, 24 o 48 h, e se si usa il frigo. Il resto lo calcola l'app:
  - come dividere le fasi: puntata, frigo, appretto;
  - il lievito;
  - la farina consigliata (W) per quei tempi;
  - il **programma**: cosa fare e dopo quante ore dall'inizio dell'impasto, fino a "a tavola".

  In Biga, Teglia e Personalizzata le fasi si possono anche scrivere a mano ("Fase per fase"). Passando da un modo all'altro si parte da quello che c'era.
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
- **Modello del lievito**: interruttore tra **Impasti** (la curva spiegata più sotto, modificabile) e **PizzApp** (lo stesso modello di ImpastiPLUS, con il ritocco da −50% a +50%). Si cambia in **Altro → Impostazioni** o al volo sotto le dosi, per confrontare.

Promemoria e notifiche per ora non ci sono.

## ImpastiPLUS

- **Calcola** in una pagina sola:
  - panielli, anche di due misure;
  - Verace o Teglia;
  - fino a 6 farine con le loro percentuali, scelte tra quelle della scheda Farine di Impasti;
  - acqua, sale e grassi in %;
  - ore e temperatura a temperatura ambiente e, se serve, in frigo;
  - cinque lieviti: fresco (LBF), secco istantaneo (LSI), secco attivo (LSA), madre solido (LMS), madre liquido (LML);
  - pasta di riporto da aggiungere, con forza bassa o alta, e da tenere per la volta dopo;
  - **poolish**, **biga** e **autolisi**;
  - scarto.

  Le dosi sono divise per fasi (poolish, biga, autolisi, impasto). Ci sono avvisi per la lievitazione eccessiva (il prefermento ha già quasi tutto il lievito) e per le percentuali sbagliate.
- **Impostazioni**: si accendono solo i campi che si usano. C'è anche il ritocco del lievito (da −50% a +50%) e lo schermo sempre acceso (in https).
- **Ricette**: si salvano con nome e nota; con lo stesso nome chiede se sostituire. Si aprono nel calcolatore, si copiano o condividono come testo, e si può aggiungere una **foto**: la pagina la rimpicciolisce (JPEG, al massimo 1600 px) e la salva sul Pi.
- **Utilità**:
  - temperatura dell'acqua per avere l'impasto alla temperatura voluta, secondo l'impastatrice;
  - percentuali di due farine per una W voluta;
  - W di un mix fino a 4 farine;
  - impasto per una teglia rettangolare o tonda.
- **Guida**: come si usa, glossario delle sigle, da dove vengono le dosi.

**Il lievito in ImpastiPLUS** (modello di PizzApp, riscritto in `app/comune/lievito-pizzapp.js`):
- **Lievito fresco**: in % sulla farina vale (2,528·e^(−0,128·T) / ore)^1,45. Con temperatura ambiente e frigo, le ore delle due fasi si sommano pesate per la temperatura.
- **Lieviti secchi**: dividono per un fattore che cresce con la temperatura. Il **lievito madre** ha curve a parte.
- **Dalla % ai grammi**: ritocco 1,8·farina^−0,1; Verace ×0,9; Teglia ×2,2 calcolata sull'acqua.
- **Prefermenti**: con biga o poolish il lievito dell'impasto si dimezza. La biga ha l'1% di lievito sulla sua farina; il poolish 3,9%·e^(−0,23·ore).
- **Pasta di riporto**: toglie lo 0,29% (forza bassa) o lo 0,58% (alta) di lievito per ogni punto %.

Il calcolo completo è in `app/impastiplus/plus-calcoli.js`, i test in `test/plus.test.js` e `test/lievito-pizzapp.test.js`.

## Come sono calcolate le dosi di Impasti

- **Percentuali sulla farina**: acqua = farina × idratazione; sale, olio e zucchero in grammi per kg di farina. La farina si ricava in modo che la somma degli ingredienti dia il peso dell'impasto (panetti × peso, oppure superficie della teglia × grammi per cm²).
- **Lievito madre**: la sua farina e la sua acqua si tolgono da quelle da aggiungere. **Biga**: biga e impasto finale insieme danno l'idratazione totale.
- **Lievito secco**: un terzo del fresco.
- **Lievito e temperatura**: ogni fase vale come le sue ore moltiplicate per la velocità della lievitazione a quella temperatura, rispetto a 20 °C (legge di Arrhenius: 4 °C ≈ un quinto, 30 °C ≈ 2,5 volte; sopra i 32 °C non accelera più).
- **La curva**: grammi di lievito fresco per kg di farina in funzione delle "ore a 20 °C". Di partenza vale 3,5 g/kg a 8 ore e 0,9 g/kg a 24 ore, con una piccola correzione per sale e idratazione.
- **Tempo a disposizione**: dalle ore dall'impasto al pasto (da 3 a 96) si tolgono mezz'ora per impastare e mezz'ora per stendere e cuocere; il resto è lievitazione.
  - **Con il frigo** (da 11 ore in su): 1 ora di puntata, poi il frigo, poi 4 ore di appretto (5 se la lievitazione supera le 30 ore, 3 in teglia).
  - **Senza frigo**: 2 ore di puntata (1 sotto le 6 ore di lievitazione e dopo una biga, mezz'ora sotto le 3), il resto di appretto.
  - La **Verace** lievita solo a temperatura ambiente, da 7 a 25 ore dall'impasto al pasto.
  - Le ricette Pizza Facile e Verace salvate prima contavano solo le ore di lievitazione: si riaprono con un'ora in più e le stesse dosi.

Le dosi di lievito sono indicazioni: farina, temperatura vera e forno fanno la differenza. Se i tuoi impasti lievitano sempre troppo o troppo poco, ritocca la curva in **Altro → Impostazioni**: vale per tutte le ricette nuove.

Il codice dei calcoli è in `app/impasti/impasti-calcoli.js`, i test in `test/calcoli.test.js`.

## I dati

Tutto sta nel volume Docker `pizzapp_dati`:
- `impasti.json` contiene le ricette di Impasti e di ImpastiPLUS, farine, lieviti madre e impostazioni;
- `backup/` contiene una copia al giorno di `impasti.json`, le ultime 14;
- `foto/` contiene le foto delle ricette di ImpastiPLUS, che non entrano in `impasti.json` né nell'esportazione.

Ogni salvataggio scrive un file nuovo e poi lo sostituisce, così il file non resta mai a metà.

Backup completo dal Pi, foto comprese:

```bash
docker run --rm -v pizzapp_dati:/data -v "$HOME":/backup alpine tar czf /backup/pizzapp-dati.tgz -C /data .
```

Dalla pagina: in Impasti, **Altro → Impostazioni → Esporta tutto** scarica un file `.json` con i dati di tutte e due le app, foto escluse. **Importa da file** lo rimette, aggiungendo o sostituendo tutto.

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
- **Foto**: accettate solo come JPEG, fino a circa 4 MB, con un nome casuale.

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
