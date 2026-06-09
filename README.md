# PAC Smart Balancing

> Su 4 iterazioni mensili reali (set–dic 2025) di un portafoglio personale a 4 ETF, l'algoritmo con α=0.25 ha investito **il 98% del budget programmato** contro **il 63% del PAC Smart di Fineco**, mantenendo la deviazione finale dai pesi target al **2.0%** contro il **5.0%** di Fineco.

## Il problema

Il PAC Smart di Fineco bilancia automaticamente un portafoglio multi-ETF, ma per non sbilanciare i pesi tende a investire molto meno del budget pianificato. Sui 4 mesi misurati ha lasciato non investito il 37% del capitale disponibile: cash che non lavora.

## La soluzione

Una funzione di costo a un solo parametro soggettivo α ∈ [0, 1]:

```
Costo = (1 − α) · U + α · D_€
```

dove:
- `U` = budget non speso (€)
- `D_€` = deviazione assoluta dai pesi target (€)
- `α` = preferenza utente — quanto pesa la deviazione rispetto al cash non investito

α basso → priorità a investire tutto il budget. α alto → priorità ai pesi target. Niente soglie magiche né scelte hardcoded.

## Disclaimer

Confronto su 4 iterazioni mensili (set–dic 2025) per un portafoglio personale a 4 ETF con budget 600/600/600/700€. Non è un backtest storico su decenni: è una misura su dati reali del periodo. La metodologia è riproducibile su qualsiasi altro portafoglio definendo uno scenario JSON in `scenarios/`.

## Quickstart

```bash
npm install
npm run iterazione scenarios/scenario1.json   # singola iterazione
npm run simulazione:all                       # simula tutti gli scenari, HTML in output/
```

## Architettura

Vedi [`AGENTS.md`](AGENTS.md) e [`docs/adr/`](docs/adr/).
