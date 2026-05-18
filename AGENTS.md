## Mandatory Rules

- Code Language: Italian — usa italiano per tutti gli identifier, commenti e messaggi. Rispetta il glossario in `CONTEXT.md`.
- Use Context7 MCP server for Libraries docs
- Use Deepwiki for querying Github codebases of famous open source projects

## Setup

Dopo aver clonato il repo o creato un nuovo worktree, installare le skill locali:

```bash
npx skills experimental_install
```

## Commands

```bash
npm test               # esegui test suite (Vitest)
npm run test:watch     # test in watch mode
npm run typecheck      # tsc --noEmit
npm run cli <scenario> # esegui CLI su un file scenario JSON (es. scenarios/scenario1-marco.json)
npm run simulate:all   # simula tutti e 4 gli scenari e genera HTML in output/
```

Per eseguire un singolo file di test:

```bash
npx vitest run src/core/core.test.ts
```

## Architecture

Il sistema risolve il **Problema Fineco**: il PAC intelligente di Fineco investe molto meno del budget pur di non sbilanciare i pesi. La soluzione è una funzione di costo che bilancia Budget Non Speso (`U`) e Deviazione in euro (`D_€`):

```
Costo = (1 − α) * U + α * D_€
```

`α` (Preferenza Utente, 0–1) è l'unico parametro soggettivo. Il comportamento adattivo emerge naturalmente dalla formula.

### Moduli

- **`src/core/`** — algoritmo puro `decideIterazione(input): output`. Ricerca esaustiva su tutte le combinazioni di quote acquistabili. Funzione pura, niente I/O.
- **`src/prezzi/`** — Adapter Pattern verso `yahoo-finance2`. Espone `prezzoCorrente(ticker)` e `prezziPerDate(ticker, date[])`. Sostituibile senza toccare il core.
- **`src/cli/`** — CLI di Validazione: legge un file scenario JSON, chiama `prezzoCorrente` + `decideIterazione`, stampa tabella ASCII.
- **`src/simulatore/`** — simula N iterazioni mensili consecutive per una griglia di valori α, accumulando metriche di portafoglio.
- **`src/report/`** — genera HTML con 3 grafici Chart.js a partire dal `SimulationResult` del simulatore.
- **`src/scenarios/`** — parser JSON per scenari completi (con `durataInMesi`, `grigliaDiAlfa`, `dataInizio`).
- **`src/simula-tutti.ts`** — script batch che esegue i 4 scenari in `scenarios/` e scrive gli HTML in `output/`.

### Flusso dati

```
Scenario JSON → parseScenarioCompleto
    ├── CLI: prezzoCorrente → decideIterazione → tabella ASCII
    └── Simulatore: prezziPerDate (×N mesi) → decideIterazione (×N mesi × N α) → SimulationResult → HTML
```

### Decisioni architetturali rilevanti

- `docs/adr/0001` — Deviazione in euro (non %) per allineamento con il Budget; α soggettivo, senza soglia di maturità
- `docs/adr/0002` — TypeScript + `yahoo-finance2` (schema validation runtime); core = libreria pura
- `docs/adr/0003` — Iterazioni indipendenti: Budget Non Speso non riportato; simulatore concatena come stato esterno

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `marcoscale98/finance-pac-smart-balancing`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: one `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.
