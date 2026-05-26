# Stack: TypeScript + yahoo-finance2

Il progetto è implementato in **TypeScript** (runtime Node) e usa la libreria `yahoo-finance2` per recuperare prezzi correnti e serie storiche da Yahoo Finance. La valuta è EUR (gli **Strumenti** sono ETF UCITS quotati su mercati europei: Borsa Italiana `.MI`, XETRA `.DE`, ecc.) — niente conversioni di cambio.

## Considered Options

1. **Python + `yfinance`**: ecosistema finanziario più ricco, ma `yfinance` si basa su scraping fragile e nel 2025 ha subito ban IP e rotture frequenti, con manutenzione reattiva (patch dopo le rotture).
2. **API ufficiali a pagamento** (EODHD, Alpha Vantage, Twelve Data): più stabili e con SLA, ma sovradimensionate per un progetto personale e con costi/limiti sul free tier.
3. **CSV manuali**: massima affidabilità ma incompatibile con il **Simulatore**, che richiede serie storiche estese.

Scelto **TypeScript + `yahoo-finance2`** perché la libreria implementa **schema validation runtime**: quando Yahoo cambia gli endpoint, la libreria segnala esplicitamente lo schema invalido invece di rompersi silenziosamente. Manutentori attivi (~100k download/settimana, supporto Node 20+), tipizzazione TypeScript end-to-end, multi-runtime (Node/Bun/Deno).

## Consequences

- L'algoritmo core è una **libreria TypeScript pura** (zero I/O, prezzi passati come input). La sorgente prezzi è isolata in uno strato esterno e può essere sostituita senza toccare la logica.
- Se Yahoo dovesse diventare inutilizzabile, il refactor consiste nel sostituire il modulo prezzi (es. con EODHD a pagamento), non l'algoritmo.
- La scelta di TypeScript permette di riutilizzare la libreria sia nell'**Esecutore di Iterazione** sia in una eventuale UI web futura (fase 2), senza port di linguaggio.
