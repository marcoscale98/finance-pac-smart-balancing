# PAC Smart Balancing

Algoritmo che, dato un portafoglio esistente, un budget mensile e un'allocazione target in percentuali, decide quante quote di ogni strumento finanziario acquistare per avvicinarsi al target spendendo il budget. Pensato per superare i limiti del bilanciamento intelligente di Fineco, che tende a investire molto meno del budget pur di non sbilanciare le percentuali.

## Perimetro

Il PAC di Fineco supporta esclusivamente **ETP (Exchange Traded Product)**: ETF, ETC ed ETN. Tutto il resto è fuori perimetro.

**In perimetro:**
- ETF (Exchange Traded Fund) — es. ETF azionari, ETF obbligazionari, ETF su materie prime
- ETC (Exchange Traded Commodity) — es. ETC sull'oro fisico
- ETN (Exchange Traded Note) — es. ETN su indici esotici
- ETP su criptovalute — es. un ETF o ETP su Bitcoin: rientrano come ETP, non come criptovaluta diretta

**Fuori perimetro:**
- Azioni singole
- Obbligazioni e BTP acquistati direttamente
- Fondi comuni non quotati
- Criptovalute acquistate direttamente (es. BTC su exchange crypto)

> **Nota terminologica**: quando il progetto parla di uno **Strumento** ad alta volatilità come "Bitcoin", intende sempre un ETP su Bitcoin quotato su Fineco, non la criptovaluta diretta.

## Language

**Strumento**:
Un ETP (ETF, ETC o ETN) acquistabile tramite il PAC di Fineco. Si compra a **quote intere**. Azioni singole, obbligazioni dirette e criptovalute non sono **Strumenti** per questo progetto — vedi sezione **Perimetro**.
_Avoid_: titolo, asset, ticker

**Quota**:
Unità minima indivisibile di uno **Strumento**. L'algoritmo decide quante quote acquistare di ciascuno.
_Avoid_: share, unit, frazione

**Quote Detenute**:
Le quote di uno **Strumento** possedute prima di un'**Iterazione**. Input dell'algoritmo.
_Avoid_: quote iniziali, quote precedenti

**Quote Acquistate**:
Le quote di uno **Strumento** acquistate durante un'**Iterazione**. Output principale dell'algoritmo.
_Avoid_: quote comprate, ordine

**Quote Finali**:
Le quote di uno **Strumento** possedute a fine **Iterazione**: `Quote Detenute + Quote Acquistate`. Non sono un output diretto dell'algoritmo — si derivano.
_Avoid_: quote totali, quote risultanti

**Portafoglio**:
L'insieme degli **Strumenti** già posseduti, ciascuno con la quantità di **Quote** detenute e il prezzo corrente.
_Avoid_: account, holdings

**Allocazione Target**:
La distribuzione ideale del **Portafoglio** in percentuali per **Strumento** (es. 40% S&P500, 50% World, 10% Gold). La somma è sempre 100%.
_Avoid_: target, ideal state, mix

**Peso Target** (`t_i`):
La percentuale assegnata a un singolo **Strumento** nell'**Allocazione Target**, espressa come frazione tra 0 e 1.

**Peso Finale**:
La percentuale che un **Strumento** occupa nel **Portafoglio** a fine **Iterazione**: `Valore Finale Strumento / Valore Finale Portafoglio`. Si confronta con il **Peso Target** per valutare quanto l'**Iterazione** si sia avvicinata all'**Allocazione Target**.
_Avoid_: peso effettivo, peso attuale, peso reale, allocazione effettiva

**Budget** (`B`):
L'importo massimo in euro che l'algoritmo può spendere in una singola esecuzione. Vincolo duro: non si sfora mai.

**Iterazione**:
Una singola esecuzione dell'algoritmo, corrispondente tipicamente a un acquisto mensile. Riceve **Portafoglio** + **Budget** + **Allocazione Target**, restituisce le **Quote** da comprare per ogni **Strumento**. Le **Iterazioni** sono indipendenti: il **Budget Non Speso** non viene riportato all'**Iterazione** successiva.

**Valore Finale**:
Il valore in euro di uno **Strumento** a fine **Iterazione**: `Quote Finali × Prezzo Corrente`. Il **Valore Finale Portafoglio** è la somma dei Valori Finali di tutti gli Strumenti.
_Avoid_: valore effettivo, valore attuale

**Valore Target**:
Il valore in euro che uno **Strumento** dovrebbe avere a fine **Iterazione** per rispettare esattamente il suo **Peso Target**: `Peso Target × Valore Finale Portafoglio`.
_Avoid_: valore ideale, valore obiettivo

**Deviazione Attuale** (`D_€^att`):
Lo scostamento in euro tra il **Valore** corrente di uno **Strumento** (basato sulle **Quote Detenute**) e il suo **Valore Target** calcolato sul **Portafoglio** attuale: `|quoteDetenute × prezzoCorrente − pesoTarget × valoreAttualePortafoglio|`. Misura da dove si parte prima di ogni **Iterazione**. Non è definita quando il **Portafoglio** vale 0€ (nessuna **Quota** detenuta).
_Avoid_: deviazione corrente, deviazione iniziale

**Deviazione** (`D_€`):
Lo scostamento in euro tra il **Valore Finale** di uno **Strumento** e il suo **Valore Target**: `|Valore Finale − Valore Target|`. Senza qualificatori, "Deviazione" si intende sempre in euro.

**Deviazione Percentuale** (`D_%`):
La **Deviazione** espressa in punti percentuali: `D_€ / Valore Finale Portafoglio`. Equivale a `|Peso Finale − Peso Target|`.

**Budget Non Speso** (`U`):
La parte del **Budget** che l'algoritmo decide di non investire in questa **Iterazione**. `U = B − speso`.

**Preferenza Utente** (`α`):
Numero fisso tra 0 e 1 che bilancia i due obiettivi dell'algoritmo: minimizzare il **Budget Non Speso** vs minimizzare la **Deviazione**. Default 0.5 (peso uguale). Non dipende dalla dimensione del portafoglio.

**Problema Fineco**:
Comportamento del PAC intelligente di Fineco che, per non sbilanciare i pesi, investe molto meno del budget disponibile, rallentando la crescita del portafoglio e indirettamente rendendo più difficile il futuro ribilanciamento. Osservato in particolare nelle prime **Iterazioni** quando uno o più **Strumenti** hanno una **Quota** costosa rispetto al **Budget** (es. Budget 400€, Gold con Peso Target 10% ma una Quota da 350€): in questi casi Fineco riduce drasticamente l'investimento totale invece di accettare temporaneamente una **Deviazione**. È il problema che questo progetto vuole risolvere.

**CLI di Validazione**:
Strumento da linea di comando per eseguire **Iterazioni** singole del **Mio Algoritmo** su scenari specifici e mostrarne il risultato (quote da acquistare, **Budget Non Speso**, **Deviazione** residua). Il confronto con il PAC di Fineco avviene **esternamente**: l'utente lancia lo stesso scenario sull'app Fineco sul telefono e confronta i due risultati a mano. La CLI non simula Fineco — il **Problema Fineco** è osservato empiricamente, non riprodotto in codice.

**Simulatore**:
Strumento per esplorare il comportamento del **Mio Algoritmo** su molte **Iterazioni** consecutive (range temporale: **6 mesi - 5 anni**), variando la **Preferenza Utente** `α`. Produce grafici comparativi per metriche chiave (valore portafoglio, budget investito teorico vs effettivo, deviazione media nel tempo). Non confronta strategie diverse: confronta versioni dello stesso algoritmo con `α` diversi. Il range è intenzionalmente limitato perché il **Problema Fineco** si manifesta nelle prime **Iterazioni** (portafoglio piccolo, **Quote** costose rispetto al **Budget**): orizzonti più lunghi diluiscono il segnale che il **Simulatore** deve mostrare. Griglia di default per `α`: `0.25`, `0.50`, `0.75` (esplora rispettivamente preferenze "spendi più dei target", "neutro", "rispetta più i target").

**Mio Algoritmo**:
La soluzione implementata in questo progetto, definita dalla **Funzione di Costo** descritta sotto. Si contrappone al PAC di Fineco (il **Problema Fineco**) e ai PAC tradizionali (allocazione fissa in euro per **Strumento**, senza ribilanciamento).

## Relationships

- Un **Portafoglio** contiene molti **Strumenti**, ciascuno con un numero intero di **Quote**
- Un'**Allocazione Target** assegna un **Peso Target** a ogni **Strumento**
- Un'**Iterazione** prende un **Portafoglio**, un **Budget** e un'**Allocazione Target** e produce una decisione di acquisto (quante **Quote** per ogni **Strumento**)
- L'**Iterazione** minimizza una funzione di costo che combina **Budget Non Speso** e **Deviazione**, pesati dalla **Preferenza Utente**

## Funzione di costo

L'algoritmo minimizza:

```
Costo = (1 − α) * U + α * D_€

U   = Budget Non Speso (in euro)
D_€ = Deviazione totale dai target (in euro)
α   = Preferenza Utente (costante tra 0 e 1)
```

Vincolo duro: la spesa totale non supera mai il **Budget**.

Il comportamento adattivo (privilegiare spendere quando il portafoglio è piccolo, privilegiare il ribilanciamento quando è grande) emerge naturalmente: `U` è limitato dal **Budget**, mentre `D_€` cresce con la dimensione del portafoglio. Non serve quindi un parametro di "soglia di maturità".

## Example dialogue

> **Dev:** "Se l'**Allocazione Target** prevede 10% di Gold ma una **Quota** di Gold costa più del 10% del **Budget**, l'algoritmo cosa fa?"
> **Marco:** "Compra zero Quote di Gold in quella **Iterazione** e accetta una **Deviazione** maggiore su Gold, perché l'altra opzione sarebbe sforare la percentuale in modo grossolano. Nelle **Iterazioni** successive, quando il **Portafoglio** crescerà, la stessa quota di Gold peserà meno e tornerà acquistabile senza creare squilibri."

**Adapter Prezzi**:
Modulo separato e sostituibile che espone due funzioni al resto del sistema. Non contiene logica di business — è un adattatore puro verso la sorgente dati esterna (`yahoo-finance2`). Cambiare sorgente dati richiede solo modificare questo modulo.
- `prezzoCorrente(ticker)` — prezzo corrente di uno **Strumento**; usata dalla **CLI di Validazione**.
- `prezziPerDate(ticker, date[])` — dato un array di date specifiche (es. una per ogni mese del **Simulatore**), restituisce il prezzo di ciascuna. Internamente interroga la sorgente sul range `[min, max]` e mappa il giorno più vicino per ogni data richiesta.
_Avoid_: `getCurrentPrice`, `getHistoricalPrices`, serie storica generica.

**Quotazione**:
Una coppia `{ data: Date; prezzo: number }` — il prezzo di uno **Strumento** in un determinato giorno. Unità restituita da `prezziPerDate`.
_Avoid_: `PricePoint`, `HistoricalEntry`.

## Flagged ambiguities

- "Budget" inizialmente è stato discusso sia come "tetto massimo" sia come "obiettivo di spesa" — risolto: è un **vincolo duro** (mai sforare), e l'algoritmo è incentivato a spendere il più possibile tramite il termine `U` nella funzione di costo.
- "Deviazione" senza qualificatori si intende sempre in euro (**D_€**). La variante percentuale esiste ed è chiamata esplicitamente **Deviazione Percentuale** (**D_%**), equivalente a `|Peso Finale − Peso Target|`.
