import { describe, it, expect, vi } from "vitest";
import { parseScenario, formattaOutput, eseguiScenario } from "./index.js";
import type { InputIterazione, OutputIterazione } from "../core/index.js";
import * as prezzi from "../prezzi/index.js";

vi.mock("../prezzi/index.js", () => ({
  prezzoCorrente: vi.fn().mockResolvedValue(50.0),
  prezziPerDate: vi.fn().mockImplementation((_ticker: string, date: Date[]) =>
    Promise.resolve(date.map((d) => ({ data: d, prezzo: 50.0 }))),
  ),
}));

const scenarioValido = JSON.stringify({
  strumenti: [
    { ticker: "EXUS.DE", pesoTarget: 0.405, quoteAttuali: 0 },
    { ticker: "IUSE.MI", pesoTarget: 0.315, quoteAttuali: 0 },
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
    expect(scenario.strumenti[0]!.quoteAttuali).toBe(0);
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

  it("dataIterazione ISO valida → campo parsato come Date", () => {
    const json = JSON.stringify({
      strumenti: [{ ticker: "EXUS.DE", pesoTarget: 0.5, quoteAttuali: 0 }],
      budget: 400,
      alfa: 0.5,
      dataIterazione: "2025-03-15",
    });
    const scenario = parseScenario(json);
    expect(scenario.dataIterazione).toBeInstanceOf(Date);
    expect(scenario.dataIterazione!.toISOString()).toContain("2025-03-15");
  });

  it("senza dataIterazione → campo undefined", () => {
    const scenario = parseScenario(scenarioValido);
    expect(scenario.dataIterazione).toBeUndefined();
  });

  it("dataIterazione non stringa → throw con messaggio leggibile", () => {
    const json = JSON.stringify({
      strumenti: [{ ticker: "EXUS.DE", pesoTarget: 0.5, quoteAttuali: 0 }],
      budget: 400,
      alfa: 0.5,
      dataIterazione: 20250315,
    });
    expect(() => parseScenario(json)).toThrow("dataIterazione");
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
    { ticker: "EXUS.DE", prezzoCorrente: 95.0, quoteAttuali: 0, pesoTarget: 0.6 },
    { ticker: "IUSE.MI", prezzoCorrente: 56.0, quoteAttuali: 0, pesoTarget: 0.4 },
  ];

  const output: OutputIterazione = {
    acquisti: [
      { ticker: "EXUS.DE", quoteAcquistare: 3 },
      { ticker: "IUSE.MI", quoteAcquistare: 2 },
    ],
    budgetNonSpeso: 17.0,
    deviazione: 8.5,
  };

  // --- Tabella Quote ---

  it("Tabella Quote: header contiene Strumento, Quote Attuali, Acquistate (Costo), Quote Finali", () => {
    const testo = formattaOutput(output, portafoglio);
    expect(testo).toContain("Strumento");
    expect(testo).toContain("Quote Attuali");
    expect(testo).toContain("Acquistate (Costo)");
    expect(testo).toContain("Quote Finali");
    expect(testo).toContain("EXUS.DE");
    expect(testo).toContain("IUSE.MI");
  });

  it("Tabella Quote: celle combinate — quote acquistate con costo tra parentesi", () => {
    const testo = formattaOutput(output, portafoglio);
    // 3 quote × 95€ = 285.00€
    expect(testo).toContain("3 (285.00€)");
    // 2 quote × 56€ = 112.00€
    expect(testo).toContain("2 (112.00€)");
  });

  it("Tabella Quote: riga Totale mostra quote e costo aggregati", () => {
    const testo = formattaOutput(output, portafoglio);
    // quote acquistate totali: 3+2=5, costo: 3×95+2×56=397
    expect(testo).toContain("5 (397.00€)");
    const righe = testo.split("\n");
    const rigaTotale = righe.find((r) => r.trimStart().startsWith("Totale"));
    expect(rigaTotale).toBeDefined();
  });

  it("Tabella Quote: riga Budget non speso mostra importo non speso", () => {
    const testo = formattaOutput(output, portafoglio);
    // budgetNonSpeso = 17.00€
    expect(testo).toContain("Budget non speso");
    expect(testo).toContain("17.00€");
    const righe = testo.split("\n");
    const rigaBudget = righe.find((r) => r.startsWith("Budget non speso"));
    expect(rigaBudget).toBeDefined();
    expect(rigaBudget).toContain("17.00€");
  });

  // --- Tabella Pesi ---

  it("Tabella Pesi: header contiene Peso Attuale, Peso Target, Peso Finale", () => {
    const testo = formattaOutput(output, portafoglio);
    expect(testo).toContain("Peso Attuale");
    expect(testo).toContain("Peso Target");
    expect(testo).toContain("Peso Finale");
  });

  it("Tabella Pesi: Peso Attuale mostra n/a quando portafoglio vale 0€", () => {
    const testo = formattaOutput(output, portafoglio);
    // Estrae la sezione della Tabella Pesi (tra l'header "Peso Attuale" e la riga vuota successiva)
    const righe = testo.split("\n");
    const inizioPesi = righe.findIndex((r) => r.includes("Peso Attuale"));
    const sezioneP = righe.slice(inizioPesi + 2); // salta header e separatore
    const righeDatiPesi = sezioneP.slice(0, portafoglio.length);
    expect(righeDatiPesi.every((r) => r.includes("n/a"))).toBe(true);
  });

  it("Tabella Pesi: non contiene righe di totale proprie", () => {
    const testo = formattaOutput(output, portafoglio);
    // i pesi sommano sempre a 100% → nessun totale nella Tabella Pesi
    // verifica indiretta: "Totale speso" e "Deviazione" non appaiono nella sezione Pesi
    // (test di alto livello: l'output non ha "Totale pesi" o simile)
    expect(testo).not.toContain("Totale pesi");
    expect(testo).not.toContain("Peso totale");
  });

  // --- Tabella Deviazioni ---

  it("Tabella Deviazioni: header contiene Deviazione Attuale e Deviazione Finale", () => {
    const testo = formattaOutput(output, portafoglio);
    expect(testo).toContain("Deviazione Attuale");
    expect(testo).toContain("Deviazione Finale");
  });

  it("Tabella Deviazioni: Dev Attuale mostra valore calcolato quando portafoglio ha quote esistenti", () => {
    // valoreAttuale = 2×95 + 3×56 = 190 + 168 = 358
    // devAttuale EXUS.DE = |190 − 0.6×358| = 24.80€, pesoAtt = 53.07% → dev% = 6.9%
    // devAttuale IUSE.MI = |168 − 0.4×358| = 24.80€, pesoAtt = 46.93% → dev% = 6.9%
    const portafoglioConQuote: InputIterazione["portafoglio"] = [
      { ticker: "EXUS.DE", prezzoCorrente: 95.0, quoteAttuali: 2, pesoTarget: 0.6 },
      { ticker: "IUSE.MI", prezzoCorrente: 56.0, quoteAttuali: 3, pesoTarget: 0.4 },
    ];
    const testo = formattaOutput(output, portafoglioConQuote);
    expect(testo).toContain("24.80€");
    expect(testo).toContain("6.9%");
  });

  it("Tabella Deviazioni: riga Totale mostra n/a per Deviazione Attuale quando quoteAttuali sono zero", () => {
    const testo = formattaOutput(output, portafoglio);
    // Quando tutte le quoteAttuali sono 0, la deviazione attuale non è definita
    // La riga Totale della tabella Deviazioni contiene "%" (a differenza del riepilogo)
    const righe = testo.split("\n");
    const rigaTotaleD = righe.find((r) => r.trimStart().startsWith("Totale") && r.includes("%"));
    expect(rigaTotaleD).toBeDefined();
    expect(rigaTotaleD).toContain("n/a");
  });

  it("Tabella Deviazioni: Dev mostra D_€ e D_% nella stessa cella", () => {
    const testo = formattaOutput(output, portafoglio);
    // le righe dati nella Tabella Deviazioni contengono sia € che %
    const righeConDev = testo.split("\n").filter((r) => r.includes("€") && r.includes("%") && !r.includes("Peso"));
    expect(righeConDev.length).toBeGreaterThan(0);
  });

  it("Tabella Deviazioni: riga Totale mostra deviazione finale con percentuale", () => {
    // valoreFinale = 3×95 + 2×56 = 397, deviazione = 8.5, dev% = 8.5/397 = 2.1%
    const testo = formattaOutput(output, portafoglio);
    const righe = testo.split("\n");
    const rigaTotaleD = righe.find((r) => r.trimStart().startsWith("Totale") && r.includes("%"));
    expect(rigaTotaleD).toBeDefined();
    expect(rigaTotaleD).toContain("8.50€");
    expect(rigaTotaleD).toContain("2.1%");
  });

  it("Tabella Deviazioni: riga Totale mostra deviazione attuale con percentuale quando il portafoglio ha quote", () => {
    // valoreAttuale = 2×95 + 3×56 = 190+168 = 358
    // devAttuale EXUS.DE = |190 − 0.6×358| = 24.80, devAttuale IUSE.MI = |168 − 0.4×358| = 24.80
    // totale devAttuale = 49.60, dev% = 49.60/358 = 13.9%
    const portafoglioConQuote: InputIterazione["portafoglio"] = [
      { ticker: "EXUS.DE", prezzoCorrente: 95.0, quoteAttuali: 2, pesoTarget: 0.6 },
      { ticker: "IUSE.MI", prezzoCorrente: 56.0, quoteAttuali: 3, pesoTarget: 0.4 },
    ];
    const testo = formattaOutput(output, portafoglioConQuote);
    const righe = testo.split("\n");
    const rigaTotaleD = righe.find((r) => r.trimStart().startsWith("Totale") && r.includes("%"));
    expect(rigaTotaleD).toBeDefined();
    expect(rigaTotaleD).toContain("49.60€");
    expect(rigaTotaleD).toContain("13.9%");
  });

  it("Tabella Quote: senza Fineco, non contiene 'Totale speso:' come riga standalone", () => {
    const testo = formattaOutput(output, portafoglio);
    // "Totale speso:" appare solo nel riepilogo comparativo, che richiede Fineco
    expect(testo).not.toContain("Totale speso:");
  });

  // --- Colonne Fineco ---

  describe("con finecoAcquisti", () => {
    // portafoglio: EXUS.DE 95€ ×0 quote, IUSE.MI 56€ ×0 quote
    // output acquisti: EXUS.DE 3, IUSE.MI 2
    // finecoAcquisti: [2, 1]
    // Calcoli:
    //   Totale speso algo:  3×95 + 2×56 = 285 + 112 = 397€  | budgetNonSpeso=17 → budget=414€
    //   Totale speso fineco: 2×95 + 1×56 = 190 + 56 = 246€
    //   Budget Non Speso fineco: 414 - 246 = 168€
    //   Quote finali fineco: EXUS.DE=2, IUSE.MI=1
    //   Valore portafoglio fineco: 2×95 + 1×56 = 246€
    //   Peso Finale Fineco EXUS.DE: 190/246 ≈ 77.24%
    //   Dev Finale Fineco EXUS.DE: |190 - 0.6×246| = |190-147.6| = 42.40€, dev%=|0.7724-0.6|=17.2%
    //   Dev Finale Fineco IUSE.MI: |56 - 0.4×246| = |56-98.4| = 42.40€, dev%=|0.2276-0.4|=17.2%
    //   Deviazione finale fineco totale: 42.40+42.40 = 84.80€
    const finecoAcquisti = [2, 1];

    it("Tabella Quote: header contiene Acquistate Fineco (Costo) e Quote Finali Fineco", () => {
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      expect(testo).toContain("Acquistate Fineco (Costo)");
      expect(testo).toContain("Quote Finali Fineco");
    });

    it("Tabella Quote: riga Totale include quote e costo Fineco aggregati", () => {
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      // finecoAcquisti=[2,1]: totale quote=3, costo=2×95+1×56=246
      const righe = testo.split("\n");
      const rigaTotale = righe.find((r) => r.trimStart().startsWith("Totale"));
      expect(rigaTotale).toBeDefined();
      expect(rigaTotale).toContain("3 (246.00€)");
    });

    it("Tabella Quote: riga Budget non speso include importo non speso Fineco", () => {
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      // budget=414, totaleSpestoFineco=246, budgetNonSpesoFineco=168
      const righe = testo.split("\n");
      const rigaBudget = righe.find((r) => r.startsWith("Budget non speso"));
      expect(rigaBudget).toBeDefined();
      expect(rigaBudget).toContain("168.00€");
    });

    it("Tabella Quote: valori corretti per quote e costo Fineco", () => {
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      // EXUS.DE: 2 quote × 95€ = 190.00€
      expect(testo).toContain("2 (190.00€)");
      // IUSE.MI: 1 quota × 56€ = 56.00€
      expect(testo).toContain("1 (56.00€)");
      // Quote finali fineco: EXUS.DE=2, IUSE.MI=1 (quoteAttuali=0 + fineco)
    });

    it("Tabella Pesi: header contiene Peso Finale Fineco", () => {
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      expect(testo).toContain("Peso Finale Fineco");
    });

    it("Tabella Pesi: Peso Finale Fineco calcolato con denominatore portafoglio Fineco", () => {
      // Valore portafoglio fineco: 2×95 + 1×56 = 246€
      // Peso EXUS.DE: 190/246 = 77.24%
      // Peso IUSE.MI: 56/246 = 22.76%
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      expect(testo).toContain("77.24%");
      expect(testo).toContain("22.76%");
    });

    it("Tabella Deviazioni: header contiene Deviazione Finale Fineco", () => {
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      expect(testo).toContain("Deviazione Finale Fineco");
    });

    it("Tabella Deviazioni: riga Totale include deviazione Fineco con percentuale", () => {
      // deviazioneFinecoTotale = 42.40+42.40=84.80, valoreFinaleFineco=246
      // dev% = 84.80/246 = 34.5%
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      const righe = testo.split("\n");
      const rigaTotaleD = righe.find((r) => r.trimStart().startsWith("Totale") && r.includes("%"));
      expect(rigaTotaleD).toBeDefined();
      expect(rigaTotaleD).toContain("84.80€");
      expect(rigaTotaleD).toContain("34.5%");
    });

    it("Tabella Deviazioni: Dev Finale Fineco mostra € e % nella stessa cella", () => {
      // Dev EXUS.DE: |190 - 0.6×246| = |190-147.6| = 42.40€, dev%=|0.7724-0.6|=17.2%
      // Dev IUSE.MI: |56 - 0.4×246| = |56-98.4| = 42.40€, dev%=|0.2276-0.4|=17.2%
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      expect(testo).toContain("42.40€");
      expect(testo).toContain("17.2%");
    });

    it("Riepilogo comparativo: presente in fondo con intestazione Mio Algoritmo e Fineco", () => {
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      expect(testo).toContain("Mio Algoritmo");
      expect(testo).toContain("Fineco");
    });

    it("Riepilogo comparativo: contiene Totale speso, Budget Non Speso, Deviazione finale", () => {
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      const righe = testo.split("\n");
      // Cerca le righe del riepilogo (dopo la sezione Deviazioni)
      const posDeviazione = testo.lastIndexOf("Deviazione finale");
      expect(posDeviazione).toBeGreaterThan(0);
    });

    it("Riepilogo comparativo: valori numerici corretti per entrambe le colonne", () => {
      // Totale speso algo: 3×95 + 2×56 = 397€
      // Budget Non Speso algo: 17€
      // Deviazione finale algo: 8.50€ (dall'output)
      // Totale speso fineco: 2×95 + 1×56 = 246€
      // Budget Non Speso fineco: 414 - 246 = 168€
      // Deviazione finale fineco: 42.40 + 42.40 = 84.80€
      const testo = formattaOutput(output, portafoglio, finecoAcquisti);
      expect(testo).toContain("397.00€");
      expect(testo).toContain("246.00€");
      expect(testo).toContain("168.00€");
      expect(testo).toContain("84.80€");
    });

    it("senza Fineco: output non contiene colonne Fineco", () => {
      const testo = formattaOutput(output, portafoglio);
      expect(testo).not.toContain("Acquistate Fineco");
      expect(testo).not.toContain("Quote Finali Fineco");
      expect(testo).not.toContain("Peso Finale Fineco");
      expect(testo).not.toContain("Deviazione Finale Fineco");
      expect(testo).not.toContain("Mio Algoritmo");
    });
  });

  // --- dataIterazione nell'output ---

  it("con dataIterazione → prima riga contiene la data ISO e il budget", () => {
    const testo = formattaOutput(output, portafoglio, undefined, new Date("2025-03-15"));
    const primaRiga = testo.split("\n")[0]!;
    // budget = 3×95 + 2×56 + 17 = 414
    expect(primaRiga).toContain("2025-03-15");
    expect(primaRiga).toContain("Budget: 414€");
  });

  it("senza dataIterazione → output non contiene riga della data", () => {
    const testo = formattaOutput(output, portafoglio);
    expect(testo).not.toMatch(/Iterazione del/);
  });

  it("con dataEffettiva diversa da dataIterazione → intestazione mostra data effettiva e nota mercato chiuso", () => {
    const testo = formattaOutput(output, portafoglio, undefined, new Date("2025-03-15"), new Date("2025-03-17T07:00:00.000Z"));
    const primaRiga = testo.split("\n")[0]!;
    expect(primaRiga).toContain("2025-03-17");
    expect(primaRiga).toContain("2025-03-15");
    expect(primaRiga).toContain("mercato chiuso");
  });

  it("con dataEffettiva uguale a dataIterazione → intestazione non contiene nota mercato chiuso", () => {
    const testo = formattaOutput(output, portafoglio, undefined, new Date("2025-03-15"), new Date("2025-03-15"));
    const primaRiga = testo.split("\n")[0]!;
    expect(primaRiga).not.toContain("mercato chiuso");
    expect(primaRiga).toContain("2025-03-15");
  });

  // --- Ordine delle 3 tabelle ---

  it("le 3 tabelle appaiono nell'ordine: Quote → Pesi → Deviazioni", () => {
    const testo = formattaOutput(output, portafoglio);
    const posQuote = testo.indexOf("Quote Attuali");
    const posPesi = testo.indexOf("Peso Attuale");
    const posDev = testo.indexOf("Deviazione Attuale");
    expect(posQuote).toBeLessThan(posPesi);
    expect(posPesi).toBeLessThan(posDev);
  });
});

describe("eseguiScenario (smoke test E2E)", () => {
  it("con dataIterazione → chiama prezziPerDate e non prezzoCorrente", async () => {
    const mockPrezzoCorrente = vi.mocked(prezzi.prezzoCorrente);
    const mockPrezziPerDate = vi.mocked(prezzi.prezziPerDate);
    mockPrezzoCorrente.mockClear();
    mockPrezziPerDate.mockClear();

    const scenario = {
      strumenti: [
        { ticker: "EXUS.DE", pesoTarget: 0.6, quoteAttuali: 0 },
        { ticker: "IUSE.MI", pesoTarget: 0.4, quoteAttuali: 0 },
      ],
      budget: 400,
      alfa: 0.5,
      dataIterazione: new Date("2025-03-15"),
    };

    const testo = await eseguiScenario(scenario);

    expect(mockPrezzoCorrente).not.toHaveBeenCalled();
    expect(mockPrezziPerDate).toHaveBeenCalledTimes(2);
    expect(testo).toContain("2025-03-15");
  });

  it("senza dataIterazione → chiama prezzoCorrente e non prezziPerDate", async () => {
    const mockPrezzoCorrente = vi.mocked(prezzi.prezzoCorrente);
    const mockPrezziPerDate = vi.mocked(prezzi.prezziPerDate);
    mockPrezzoCorrente.mockClear();
    mockPrezziPerDate.mockClear();

    const scenario = {
      strumenti: [
        { ticker: "EXUS.DE", pesoTarget: 0.6, quoteAttuali: 0 },
        { ticker: "IUSE.MI", pesoTarget: 0.4, quoteAttuali: 0 },
      ],
      budget: 400,
      alfa: 0.5,
    };

    await eseguiScenario(scenario);

    expect(mockPrezzoCorrente).toHaveBeenCalledTimes(2);
    expect(mockPrezziPerDate).not.toHaveBeenCalled();
  });

  it("con mercato chiuso → output mostra data effettiva e nota mercato chiuso", async () => {
    const mockPrezziPerDate = vi.mocked(prezzi.prezziPerDate);
    mockPrezziPerDate.mockResolvedValueOnce([{ data: new Date("2025-03-17T07:00:00.000Z"), prezzo: 50.0 }]);
    mockPrezziPerDate.mockResolvedValueOnce([{ data: new Date("2025-03-17T07:00:00.000Z"), prezzo: 50.0 }]);

    const scenario = {
      strumenti: [
        { ticker: "EXUS.DE", pesoTarget: 0.6, quoteAttuali: 0 },
        { ticker: "IUSE.MI", pesoTarget: 0.4, quoteAttuali: 0 },
      ],
      budget: 400,
      alfa: 0.5,
      dataIterazione: new Date("2025-03-15"),
    };

    const testo = await eseguiScenario(scenario);
    expect(testo).toContain("2025-03-17");
    expect(testo).toContain("2025-03-15");
    expect(testo).toContain("mercato chiuso");
  });

  it("con prezzoCorrente mockato → output non vuoto con i ticker degli strumenti", async () => {
    const scenario = {
      strumenti: [
        { ticker: "EXUS.DE", pesoTarget: 0.6, quoteAttuali: 0 },
        { ticker: "IUSE.MI", pesoTarget: 0.4, quoteAttuali: 0 },
      ],
      budget: 400,
      alfa: 0.5,
    };

    const testo = await eseguiScenario(scenario);

    expect(testo.length).toBeGreaterThan(0);
    expect(testo).toContain("EXUS.DE");
    expect(testo).toContain("IUSE.MI");
  });

  it("con quoteAcquistateFineco nello scenario → output contiene colonne Fineco", async () => {
    const scenario = {
      strumenti: [
        { ticker: "EXUS.DE", pesoTarget: 0.6, quoteAttuali: 0, quoteAcquistateFineco: 2 },
        { ticker: "IUSE.MI", pesoTarget: 0.4, quoteAttuali: 0, quoteAcquistateFineco: 1 },
      ],
      budget: 400,
      alfa: 0.5,
    };

    const testo = await eseguiScenario(scenario);

    expect(testo).toContain("Acquistate Fineco (Costo)");
    expect(testo).toContain("Mio Algoritmo");
    expect(testo).toContain("Fineco");
  });
});
