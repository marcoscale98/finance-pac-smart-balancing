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

  it("contiene header tabella con tutte le colonne concordate", () => {
    const testo = formattaOutput(output, portafoglio);

    expect(testo).toContain("Strumento");
    expect(testo).toContain("Quote Detenute");
    expect(testo).toContain("Quote Acquistate (Costo)");
    expect(testo).toContain("Quote Finali");
    expect(testo).toContain("Peso Target");
    expect(testo).toContain("Peso Finale");
    expect(testo).toContain("Dev attuale");
    expect(testo).toContain("Dev finale");
    expect(testo).toContain("EXUS.DE");
    expect(testo).toContain("IUSE.MI");
  });

  it("celle combinate: quote acquistate con costo tra parentesi", () => {
    const testo = formattaOutput(output, portafoglio);
    // 3 quote × 95€ = 285.00€
    expect(testo).toContain("3 (285.00€)");
    // 2 quote × 56€ = 112.00€
    expect(testo).toContain("2 (112.00€)");
  });

  it("Dev attuale mostra valore calcolato quando il portafoglio ha quote esistenti", () => {
    // valoreAttuale = 2×95 + 3×56 = 190 + 168 = 358
    // devAttuale EXUS.DE = |190 − 0.6×358| = |190 − 214.8| = 24.80€, pesoAtt = 190/358 ≈ 53.07% → dev% = |53.07% − 60%| = 6.9%
    // devAttuale IUSE.MI = |168 − 0.4×358| = |168 − 143.2| = 24.80€, pesoAtt = 168/358 ≈ 46.93% → dev% = |46.93% − 40%| = 6.9%
    const portafoglioConQuote: InputIterazione["portafoglio"] = [
      { ticker: "EXUS.DE", prezzoCorrente: 95.0, quoteDetenute: 2, pesoTarget: 0.6 },
      { ticker: "IUSE.MI", prezzoCorrente: 56.0, quoteDetenute: 3, pesoTarget: 0.4 },
    ];
    const testo = formattaOutput(output, portafoglioConQuote);
    expect(testo).toContain("24.80€");
    expect(testo).toContain("6.9%");
  });

  it("Dev attuale mostra n/a quando tutte le quoteDetenute sono zero", () => {
    const testo = formattaOutput(output, portafoglio);
    const righe = testo.split("\n").filter((r) => r.includes("EXUS.DE") || r.includes("IUSE.MI"));
    expect(righe.length).toBe(2);
    righe.forEach((r) => expect(r).toContain("n/a"));
  });

  it("colonna Dev attuale appare prima di Dev finale nell'header", () => {
    const testo = formattaOutput(output, portafoglio);
    const header = testo.split("\n")[0]!;
    expect(header.indexOf("Dev attuale")).toBeLessThan(header.indexOf("Dev finale"));
  });

  it("Dev mostra D_€ e D_% nella stessa cella", () => {
    const testo = formattaOutput(output, portafoglio);
    // la cella Dev deve contenere sia € che %
    const righeConDev = testo.split("\n").filter((r) => r.includes("€") && r.includes("%") && !r.includes("Peso"));
    expect(righeConDev.length).toBeGreaterThan(0);
  });

  it("riepilogo contiene riga Deviazione attuale totale", () => {
    const testo = formattaOutput(output, portafoglio);
    expect(testo).toContain("Deviazione attuale totale (D_€):");
  });

  it("riepilogo Deviazione attuale totale mostra n/a quando portafoglio a zero", () => {
    const testo = formattaOutput(output, portafoglio);
    const riga = testo.split("\n").find((r) => r.includes("Deviazione attuale totale"));
    expect(riga).toContain("n/a");
  });

  it("contiene i 4 totali con simbolo € allineato", () => {
    const testo = formattaOutput(output, portafoglio);
    const righe = testo.split("\n");

    const rigaTotaleSpeso = righe.find((r) => r.includes("Totale speso:"));
    const rigaBudgetNonSpeso = righe.find((r) => r.includes("Budget Non Speso"));
    const rigaDevFinale = righe.find((r) => r.includes("Deviazione finale totale"));

    expect(rigaTotaleSpeso).toBeDefined();
    expect(rigaBudgetNonSpeso).toBeDefined();
    expect(rigaDevFinale).toBeDefined();

    // I simboli € del valore devono essere alla stessa colonna (si usa lastIndexOf
    // perché l'etichetta "D_€" contiene già € all'interno)
    const colonnaEuro = (riga: string) => riga.lastIndexOf("€");
    expect(colonnaEuro(rigaTotaleSpeso!)).toBe(colonnaEuro(rigaBudgetNonSpeso!));
    expect(colonnaEuro(rigaTotaleSpeso!)).toBe(colonnaEuro(rigaDevFinale!));
  });

  it("Deviazione finale totale e Deviazione attuale totale hanno il simbolo € allineato (portafoglio non zero)", () => {
    const portafoglioConQuote: InputIterazione["portafoglio"] = [
      { ticker: "EXUS.DE", prezzoCorrente: 95.0, quoteDetenute: 2, pesoTarget: 0.6 },
      { ticker: "IUSE.MI", prezzoCorrente: 56.0, quoteDetenute: 3, pesoTarget: 0.4 },
    ];
    const testo = formattaOutput(output, portafoglioConQuote);
    const righe = testo.split("\n");

    const rigaDevAttuale = righe.find((r) => r.includes("Deviazione attuale totale"));
    const rigaDevFinale = righe.find((r) => r.includes("Deviazione finale totale"));
    const rigaTotaleSpeso = righe.find((r) => r.includes("Totale speso:"));

    expect(rigaDevAttuale).toBeDefined();
    expect(rigaDevFinale).toBeDefined();

    const colonnaEuro = (riga: string) => riga.lastIndexOf("€");
    expect(colonnaEuro(rigaDevAttuale!)).toBe(colonnaEuro(rigaDevFinale!));
    expect(colonnaEuro(rigaDevAttuale!)).toBe(colonnaEuro(rigaTotaleSpeso!));
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
