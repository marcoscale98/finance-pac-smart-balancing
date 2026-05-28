# ADR 0004 — Override dei campi dello scenario da CLI

**Stato**: Accepted  
**Data**: 2026-05-28

## Contesto

Il **Simulatore** legge la configurazione da un file scenario JSON. Con l'introduzione del campo opzionale `percorsoTransazioniFineco` (confronto con Fineco), è emersa la necessità di poter specificare quel percorso anche da riga di comando — per esempio per usare un CSV diverso senza modificare il JSON, o per passare il parametro in modo one-shot.

Invece di aggiungere un flag dedicato `--fineco`, si è scelto di stabilire un principio generale.

## Decisione

Qualsiasi campo dello scenario JSON può essere sovrascritto da un argomento CLI con la forma `--chiave valore`. La CLI ha sempre precedenza sul JSON. La coercizione del tipo avviene così:

1. Se il valore inizia con `[` o `{` → `JSON.parse` (array e oggetti)
2. Se il valore è interpretabile come numero → `Number(valore)`
3. Altrimenti → stringa

Il campo `strumenti` (array di oggetti complessi) è escluso dall'override CLI per complessità.

## Alternative considerate

**Flag dedicato `--fineco <path>`**: più semplice da implementare oggi, ma crea precedente di flag ad-hoc per ogni campo. Porta a una CLI inconsistente man mano che crescono i parametri.

**Solo campo JSON**: nessun override CLI. Più semplice, ma costringe a modificare il file per ogni variazione one-shot.

## Conseguenze

- Ogni nuovo campo del JSON è automaticamente sovrascrivibile da CLI, senza codice aggiuntivo.
- Il parsing degli argomenti CLI deve gestire la coercizione del tipo in modo robusto.
- L'utente deve conoscere i nomi esatti dei campi JSON per usare gli override — nessun alias breve.
