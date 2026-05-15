import { describe, it, expect, vi } from "vitest";
import { parseScenario, formattaOutput, eseguiScenario } from "./index.js";
import type { InputIterazione, OutputIterazione } from "../core/index.js";

vi.mock("../prezzi/index.js", () => ({
  prezzoCorrente: vi.fn().mockResolvedValue(50.0),
}));

const scenarioValido = JSON.stringify({
  strumenti: [
    { ticker: "EXUS.DE", pesoTarget: 0.405, quoteDetenute: 0 },
    { ticker: "IUSE.MI", pesoTarget: 0.315, quoteDetenute: 0 },
  ],
  budget: 400,
  alfa: 0.5,
});

describe("parseScenario", () => {
  it("JSON valido → scenario parsato con strumenti, budget, alfa", () => {
    const scenario = parseScenario(scenarioValido);

    expect(scenario.strumenti).toHaveLength(2);
    expect(scenario.strumenti[0]!.ticker).toBe("EXUS.DE");
    expect(scenario.strumenti[0]!.pesoTarget).toBe(0.405);
    expect(scenario.strumenti[0]!.quoteDetenute).toBe(0);
    expect(scenario.budget).toBe(400);
    expect(scenario.alfa).toBe(0.5);
  });

  it("JSON malformato → throw con messaggio leggibile", () => {
    expect(() => parseScenario("{broken json")).toThrow("JSON malformato");
  });

  it("campo obbligatorio mancante → throw con messaggio leggibile", () => {
    const senzaBudget = JSON.stringify({ strumenti: [], alfa: 0.5 });
    expect(() => parseScenario(senzaBudget)).toThrow("campi obbligatori mancanti");
  });

  it("strumento con campo mancante → throw con messaggio leggibile", () => {
    const conStrumentoIncompleto = JSON.stringify({
      strumenti: [{ ticker: "EXUS.DE", pesoTarget: 0.5 }],
      budget: 400,
      alfa: 0.5,
    });
    expect(() => parseScenario(conStrumentoIncompleto)).toThrow("strumento [0]");
  });
});

describe("formattaOutput", () => {
  const portafoglio: InputIterazione["portafoglio"] = [
    { ticker: "EXUS.DE", prezzoCorrente: 95.0, quoteDetenute: 0, pesoTarget: 0.6 },
    { ticker: "IUSE.MI", prezzoCorrente: 56.0, quoteDetenute: 0, pesoTarget: 0.4 },
  ];

  const output: OutputIterazione = {
    acquisti: [
      { ticker: "EXUS.DE", quoteAcquistare: 3 },
      { ticker: "IUSE.MI", quoteAcquistare: 2 },
    ],
    budgetNonSpeso: 17.0,
    deviazione: 8.5,
  };

  it("contiene header tabella, ticker e quote per ogni strumento", () => {
    const testo = formattaOutput(output, portafoglio);

    expect(testo).toContain("Strumento");
    expect(testo).toContain("Quote");
    expect(testo).toContain("Costo");
    expect(testo).toContain("D_€");
    expect(testo).toContain("EXUS.DE");
    expect(testo).toContain("IUSE.MI");
    // le quote compaiono come numeri nella colonna Quote
    expect(testo).toMatch(/\|\s*3\s*\|/);
    expect(testo).toMatch(/\|\s*2\s*\|/);
  });

  it("contiene i 3 totali con simbolo € allineato", () => {
    const testo = formattaOutput(output, portafoglio);
    const righe = testo.split("\n");

    const rigaTotaleSpeso = righe.find((r) => r.includes("Totale speso:"));
    const rigaBudgetNonSpeso = righe.find((r) => r.includes("Budget Non Speso"));
    const rigaDeviazione = righe.find((r) => r.includes("Deviazione totale"));

    expect(rigaTotaleSpeso).toBeDefined();
    expect(rigaBudgetNonSpeso).toBeDefined();
    expect(rigaDeviazione).toBeDefined();

    // I simboli € del valore devono essere alla stessa colonna (si usa lastIndexOf
    // perché l'etichetta "D_€" contiene già € all'interno)
    const colonnaEuro = (riga: string) => riga.lastIndexOf("€");
    expect(colonnaEuro(rigaTotaleSpeso!)).toBe(colonnaEuro(rigaBudgetNonSpeso!));
    expect(colonnaEuro(rigaTotaleSpeso!)).toBe(colonnaEuro(rigaDeviazione!));
  });
});

describe("eseguiScenario (smoke test E2E)", () => {
  it("con prezzoCorrente mockato → output non vuoto con i ticker degli strumenti", async () => {
    const scenario = {
      strumenti: [
        { ticker: "EXUS.DE", pesoTarget: 0.6, quoteDetenute: 0 },
        { ticker: "IUSE.MI", pesoTarget: 0.4, quoteDetenute: 0 },
      ],
      budget: 400,
      alfa: 0.5,
    };

    const testo = await eseguiScenario(scenario);

    expect(testo.length).toBeGreaterThan(0);
    expect(testo).toContain("EXUS.DE");
    expect(testo).toContain("IUSE.MI");
  });
});
