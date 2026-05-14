# Funzione di costo: deviazione in euro, niente soglia di maturità

L'algoritmo minimizza `Costo = (1 − α) * U + α * D_€` con vincolo duro `Σ q_i * p_i ≤ B`, dove `U` è il **Budget Non Speso** e `D_€` è la **Deviazione** totale (in euro) tra portafoglio dopo acquisti e **Allocazione Target**. La **Preferenza Utente** `α` è una costante fissa scelta dall'utente (default 0.5), non una funzione del valore del portafoglio.

## Considered Options

1. **Misurare la Deviazione in percentuali** invece che in euro: scartata perché percentuali e budget (in euro) non si parlano sulla stessa scala e richiederebbero normalizzazioni arbitrarie.
2. **Funzione adattiva `α(V) = V / (V + K)`** con `K` = "soglia di maturità" del portafoglio: scartata perché `K` è un parametro tecnico difficile da calibrare e la stessa adattività emerge naturalmente dal fatto che `U` è limitato dal **Budget** mentre `D_€` cresce col portafoglio.
3. **Gerarchia rigida** (prima massimizzare la spesa, poi minimizzare la deviazione): scartata perché non riflette il fatto che la stessa quota di squilibrio ha impatti diversi su portafogli di dimensioni diverse.
4. **Quote frazionarie**: non disponibili sul broker target (Fineco), quindi vincolo di interezza obbligatorio.

## Consequences

- `α` è un parametro **soggettivo**, non tecnico: rappresenta la preferenza dell'utente tra "stare investito" e "rispettare i target". Per questo il **Simulatore** esiste — aiuta a esplorare quale `α` funziona meglio su scenari realistici.
- Il comportamento "spendi quasi tutto il budget nelle prime **Iterazioni**, ribilancia con cura man mano che il portafoglio cresce" emerge senza parametri di soglia.
- La forma `(1 − α) * U + α * D_€` con `α = 0.5` è equivalente a minimizzare `U + D_€` (entrambi in euro): la costante moltiplicativa non cambia l'ottimo.
