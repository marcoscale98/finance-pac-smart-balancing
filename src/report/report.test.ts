import { describe, it, expect } from "vitest";
import type { SimulationResult, MetricaMensile } from "../simulatore/index.js";

// buildHtml è privata — la testiamo tramite generateReport su un path fittizio?
// No: estraiamo buildHtml come export named per testabilità.
// Per ora importiamo direttamente la funzione interna tramite un re-export di test.
// Alternativa: esportiamo buildHtml da report/index.ts per testabilità.
import { buildHtml } from "./index.js";

const puntoInizio: MetricaMensile = {
  data: new Date("2023-12-15"),
  valorePortafoglio: 500,
  spesaCumulativa: 0,
  budgetTeoricoConsumato: 0,
  budgetNonSpeso: 0,
  deviazioneMedia: 10,
  deviazioneMediaPercentuale: 0.02,
};

const metriche1mese: MetricaMensile[] = [
  {
    data: new Date("2024-01-15"),
    valorePortafoglio: 100,
    spesaCumulativa: 100,
    budgetTeoricoConsumato: 100,
    budgetNonSpeso: 0,
    deviazioneMedia: 0,
    deviazioneMediaPercentuale: 0,
  },
];

const resultConFineco: SimulationResult = {
  serieAlfa: [{ alfa: 0.5, mesi: metriche1mese }],
  serieFineco: metriche1mese,
  puntoInizio,
};

const resultSenzaFineco: SimulationResult = {
  serieAlfa: [{ alfa: 0.5, mesi: metriche1mese }],
  puntoInizio,
};

describe("buildHtml — puntoInizio", () => {
  it("la prima etichetta sull'asse X corrisponde alla data di puntoInizio", () => {
    const html = buildHtml(resultSenzaFineco);
    const etichette = JSON.parse(html.match(/const ETICHETTE = (\[.*?\]);/)![1]!);
    expect(etichette[0]).toBe(
      puntoInizio.data.toLocaleDateString("it-IT", { year: "numeric", month: "short" }),
    );
  });

  it("il primo valore nel dataset 'Valore portafoglio' è puntoInizio.valorePortafoglio", () => {
    const html = buildHtml(resultSenzaFineco);
    // Il dataset del grafico g1 (α=0.5) deve avere 500 come primo punto
    expect(html).toContain('"data":[500,');
  });
});

describe("buildHtml — dataset Fineco", () => {
  it("con serieFineco: tutti e 5 i grafici contengono dataset con label Fineco e colore #000000", () => {
    const html = buildHtml(resultConFineco);

    // Fineco deve apparire come label in 5 dataset (uno per grafico)
    const matchLabel = html.match(/"label":"Fineco"/g);
    expect(matchLabel).toHaveLength(5);

    // Il colore nero deve apparire in tutti e 5 i dataset Fineco
    const matchColore = html.match(/"borderColor":"#000000"/g);
    expect(matchColore).toHaveLength(5);
  });

  it("senza serieFineco: il report non contiene dataset Fineco", () => {
    const html = buildHtml(resultSenzaFineco);
    expect(html).not.toContain('"label":"Fineco"');
    expect(html).not.toContain('"borderColor":"#000000"');
  });
});
