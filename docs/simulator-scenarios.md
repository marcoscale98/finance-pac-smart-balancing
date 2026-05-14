# Scenari del Simulatore

Quattro scenari di riferimento per il **Simulatore**, scelti per coprire casi diversi del **Problema Fineco**. Tutti partono da **Portafoglio** vuoto e usano la griglia α default `[0.25, 0.50, 0.75]`.

## Scenario 1 — "Marco" (caso reale)

Configurazione attuale del portafoglio personale di Marco. Serve a validare l'algoritmo sul caso d'uso primario.

| Strumento | Ticker | Peso Target |
|---|---|---|
| World ex-US | `EXUS.DE` | 40.50% |
| S&P 500 | `IUSE.MI` | 31.50% |
| Emerging Markets | `XMME.DE` | 18.00% |
| Gold (economico) | `GBSE.MI` | 10.00% |

- **Budget**: 400€/mese
- **Durata**: 3 anni
- **Caratteristica**: 4 strumenti, Quote tutte relativamente economiche

## Scenario 2 — "All-equity diversificato"

Profilo di un utente puramente azionario con portafoglio ampio. Verifica che l'algoritmo si comporti bene anche quando il **Problema Fineco** non è dominante.

| Strumento | Peso Target |
|---|---|
| S&P 500 | 50% |
| World ex-US | 25% |
| Emerging Markets | 15% |
| Europe | 10% |

- **Budget**: 300€/mese
- **Durata**: 5 anni
- **Caratteristica**: spazio di ricerca più ampio, Quote economiche

(Ticker da scegliere in fase implementativa tra ETF UCITS rappresentativi.)

## Scenario 3 — "Marco con Gold costoso"

Variante dello Scenario 1 in cui il **Gold** è sostituito con `SGLD.MI` (Invesco Physical Gold), con **Quota** più cara di `GBSE.MI`. Stesso portafoglio e stessi pesi target, ma il vincolo "10% in Gold" diventa molto più difficile da rispettare nelle prime **Iterazioni** → stress sul **Problema Fineco** con la composizione reale di Marco.

| Strumento | Ticker | Peso Target |
|---|---|---|
| World ex-US | `EXUS.DE` | 40.50% |
| S&P 500 | `IUSE.MI` | 31.50% |
| Emerging Markets | `XMME.DE` | 18.00% |
| Gold (costoso) | `SGLD.MI` | 10.00% |

- **Budget**: 400€/mese
- **Durata**: 3 anni

## Scenario 4 — "Strumenti costosi" (stress test)

Portafoglio composto solo da ETF con **Quota** sopra i 200€. Esaspera il **Problema Fineco**: ogni acquisto pesa tanto sul **Budget**, il vincolo di interezza delle **Quote** è severo.

- 2-3 strumenti, tutti con Quota > 200€
- **Allocazione Target**: 60% / 30% / 10%
- **Budget**: 500€/mese
- **Durata**: 2 anni
- **Caratteristica**: limite teorico dell'algoritmo

(Ticker da scegliere in fase implementativa.)
