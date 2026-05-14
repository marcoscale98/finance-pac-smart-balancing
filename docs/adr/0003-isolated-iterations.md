# Iterazioni isolate: nessun cash carryover

Ogni **Iterazione** dell'algoritmo è indipendente dalle precedenti. Il **Budget Non Speso** di un'**Iterazione** non viene riportato all'**Iterazione** successiva: ogni mese parte con esattamente `B` euro di **Budget**, indipendentemente da quanto è stato speso il mese prima.

## Considered Options

1. **Cash buffer persistente**: il **Budget Non Speso** si accumula e si somma al **Budget** dell'**Iterazione** successiva. Più realistico (i soldi non spesi rimangono sul conto), ma introduce stato persistente tra **Iterazioni** e complica testing, simulazione e composizione.
2. **Reinvestimento a soglia**: come sopra, ma il buffer si usa solo quando supera una soglia che permette acquisti utili. Aggiunge ulteriore complessità senza benefici significativi rispetto al cash buffer puro.

Scelta l'opzione **isolata** per mantenere ogni **Iterazione** una funzione pura `(Portafoglio, Budget, Allocazione Target, α) → decisione di acquisto`. Il **Simulatore** può comunque concatenare **Iterazioni** consecutive applicando le decisioni di acquisto al portafoglio per produrre lo stato di input dell'**Iterazione** successiva.

## Consequences

- Se l'algoritmo ritiene ottimale lasciare 30€ inutilizzati in un'**Iterazione**, quei 30€ sono "persi" dal punto di vista del modello (anche se nella realtà restano in conto). Questa è un'approssimazione cosciente.
- Quando il modello dovrà evolvere verso un comportamento più realistico (es. per consigliare azioni reali a un utente), introdurre il cash carryover è un'estensione additiva — l'**Iterazione** singola resta funzione pura, il carryover diventa stato esterno gestito dal chiamante.
