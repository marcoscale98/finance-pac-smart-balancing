import { describe, it, expect } from "vitest";
import { decideIterazione } from "./index.js";

describe("decideIterazione", () => {
  it("Fineco-style: strumento costoso con alfa=0.25 spende significativamente più di alfa=0.75", () => {
    // Portafoglio vuoto, target 50/50, GOLD a 350€ non comprabile in proporzione
    // alfa=0.75 (minimizza deviazione): comprare solo WORLD rompe il 50/50 → preferisce
    //   non comprare nulla (V=0, D_€=0, U=400, costo=0.25*400=100) rispetto a 5 WORLD
    //   (D_€=400, U=0, costo=0.75*400=300). Spesa=0.
    // alfa=0.25 (minimizza budget non speso): 5 WORLD (U=0, D_€=400, costo=0.25*400=100)
    //   è preferibile a non comprare nulla (costo=0.75*400=300). Spesa=400€.
    const portafoglio = [
      { ticker: "WORLD", prezzoCorrente: 80,  quoteAttuali: 0, pesoTarget: 0.5 },
      { ticker: "GOLD",  prezzoCorrente: 350, quoteAttuali: 0, pesoTarget: 0.5 },
    ];
    const budget = 400;

    const outputSpendiTutto = decideIterazione({ portafoglio, budget, alfa: 0.25 });
    const outputRibilancia  = decideIterazione({ portafoglio, budget, alfa: 0.75 });

    const spesaAlfa025 = budget - outputSpendiTutto.budgetNonSpeso;
    const spesaAlfa075 = budget - outputRibilancia.budgetNonSpeso;

    // alfa=0.25 spende 400€, alfa=0.75 spende 0€
    expect(spesaAlfa025).toBeGreaterThan(spesaAlfa075 + 50);
  });

  it("alfa=0 produce spesa >= alfa=1 a parità di scenario", () => {
    const base = {
      portafoglio: [
        { ticker: "A", prezzoCorrente: 70, quoteAttuali: 0, pesoTarget: 0.6 },
        { ticker: "B", prezzoCorrente: 30, quoteAttuali: 0, pesoTarget: 0.4 },
      ],
      budget: 200,
    };

    const outputSpendiTutto = decideIterazione({ ...base, alfa: 0 });
    const outputRibilancia = decideIterazione({ ...base, alfa: 1 });

    const spesaAlfa0 = base.budget - outputSpendiTutto.budgetNonSpeso;
    const spesaAlfa1 = base.budget - outputRibilancia.budgetNonSpeso;

    expect(spesaAlfa0).toBeGreaterThanOrEqual(spesaAlfa1);
  });

  it("U e D_€ restituiti sono coerenti con ricalcolo esterno", () => {
    const portafoglio = [
      { ticker: "A", prezzoCorrente: 40, quoteAttuali: 1, pesoTarget: 0.7 },
      { ticker: "B", prezzoCorrente: 15, quoteAttuali: 2, pesoTarget: 0.3 },
    ];
    const budget = 120;

    const output = decideIterazione({ portafoglio, budget, alfa: 0.5 });

    // Ricalcolo indipendente
    const prezzi: Record<string, number> = { A: 40, B: 15 };
    const quoteFinali: Record<string, number> = {};
    for (const s of portafoglio) {
      const acquisto = output.acquisti.find((a) => a.ticker === s.ticker)!;
      quoteFinali[s.ticker] = s.quoteAttuali + acquisto.quoteAcquistare;
    }

    const valoreFinale = portafoglio.reduce(
      (acc, s) => acc + quoteFinali[s.ticker]! * prezzi[s.ticker]!,
      0,
    );
    const deviazioneAttesa = portafoglio.reduce((acc, s) => {
      const vEff = quoteFinali[s.ticker]! * prezzi[s.ticker]!;
      const vTarget = s.pesoTarget * valoreFinale;
      return acc + Math.abs(vEff - vTarget);
    }, 0);
    const speso = portafoglio.reduce(
      (acc, s) => acc + (quoteFinali[s.ticker]! - s.quoteAttuali) * prezzi[s.ticker]!,
      0,
    );
    const uAtteso = budget - speso;

    expect(output.budgetNonSpeso).toBeCloseTo(uAtteso);
    expect(output.deviazione).toBeCloseTo(deviazioneAttesa);
  });

  it("funzione di costo: U e D_€ corrispondono al calcolo manuale", () => {
    // Portafoglio: A=100€ (2 quote * 50€), B=60€ (3 quote * 20€) → totale 160€
    // Acquisti: A=1 quota (50€), B=2 quote (40€) → speso 90€
    // Portafoglio finale: A=150€, B=100€ → totale 250€
    // Target: A=60% → 150€, B=40% → 100€
    // Deviazione: |150−150| + |100−100| = 0
    // U = 100 − 90 = 10
    // Costo (alfa=0.5): 0.5 * 10 + 0.5 * 0 = 5
    // Verifichiamo che l'output rispecchi U=10 e D_€=0
    const output = decideIterazione({
      portafoglio: [
        { ticker: "A", prezzoCorrente: 50, quoteAttuali: 2, pesoTarget: 0.6 },
        { ticker: "B", prezzoCorrente: 20, quoteAttuali: 3, pesoTarget: 0.4 },
      ],
      budget: 100,
      alfa: 0.5,
    });

    // Con alfa=0.5, la combo (A:1, B:2) ha costo 5 — se l'algoritmo restituisce
    // U=10 e D_€=0 significa che ha scelto quella combinazione ottimale
    expect(output.budgetNonSpeso).toBe(10);
    expect(output.deviazione).toBeCloseTo(0);
  });

  it("allocazione degenere (1 strumento al 100%): acquista solo quello strumento", () => {
    const output = decideIterazione({
      portafoglio: [
        { ticker: "UNICO", prezzoCorrente: 40, quoteAttuali: 0, pesoTarget: 1 },
        { ticker: "ZERO", prezzoCorrente: 25, quoteAttuali: 0, pesoTarget: 0 },
      ],
      budget: 100,
      alfa: 0.5,
    });

    const acquistoUnico = output.acquisti.find((a) => a.ticker === "UNICO");
    const acquistoZero = output.acquisti.find((a) => a.ticker === "ZERO");
    expect(acquistoUnico!.quoteAcquistare).toBeGreaterThan(0);
    expect(acquistoZero!.quoteAcquistare).toBe(0);
  });

  it("portafoglio vuoto (quoteAttuali = 0): acquista almeno una quota se il budget lo permette", () => {
    const output = decideIterazione({
      portafoglio: [
        { ticker: "A", prezzoCorrente: 50, quoteAttuali: 0, pesoTarget: 0.5 },
        { ticker: "B", prezzoCorrente: 30, quoteAttuali: 0, pesoTarget: 0.5 },
      ],
      budget: 100,
      alfa: 0,
    });

    const totaleAcquistato = output.acquisti.reduce(
      (acc, a) => acc + a.quoteAcquistare,
      0,
    );
    expect(totaleAcquistato).toBeGreaterThan(0);
  });

  it("strumento con prezzo > budget riceve 0 quote", () => {
    const output = decideIterazione({
      portafoglio: [
        { ticker: "GOLD", prezzoCorrente: 450, quoteAttuali: 0, pesoTarget: 0.1 },
        { ticker: "SP500", prezzoCorrente: 50, quoteAttuali: 0, pesoTarget: 0.9 },
      ],
      budget: 400,
      alfa: 0.5,
    });

    const acquistoGold = output.acquisti.find((a) => a.ticker === "GOLD");
    expect(acquistoGold!.quoteAcquistare).toBe(0);
  });

  it("le quote acquistate sono sempre interi non negativi", () => {
    const output = decideIterazione({
      portafoglio: [
        { ticker: "A", prezzoCorrente: 37, quoteAttuali: 2, pesoTarget: 0.5 },
        { ticker: "B", prezzoCorrente: 13, quoteAttuali: 5, pesoTarget: 0.5 },
      ],
      budget: 150,
      alfa: 0.5,
    });

    for (const acquisto of output.acquisti) {
      expect(acquisto.quoteAcquistare).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(acquisto.quoteAcquistare)).toBe(true);
    }
  });

  it("vincolo duro: la spesa non supera mai il budget", () => {
    const output = decideIterazione({
      portafoglio: [
        { ticker: "A", prezzoCorrente: 30, quoteAttuali: 0, pesoTarget: 0.6 },
        { ticker: "B", prezzoCorrente: 17, quoteAttuali: 0, pesoTarget: 0.4 },
      ],
      budget: 100,
      alfa: 0,
    });

    const speso = output.acquisti.reduce(
      (acc, a, i) => acc + a.quoteAcquistare * [30, 17][i]!,
      0,
    );
    expect(speso).toBeLessThanOrEqual(100);
  });

  it("1 strumento: acquista quante quote rientrano nel budget", () => {
    // Budget 100€, 1 strumento a 30€ → max 3 quote (90€ spesi, 10€ non spesi)
    const output = decideIterazione({
      portafoglio: [
        { ticker: "A", prezzoCorrente: 30, quoteAttuali: 0, pesoTarget: 1 },
      ],
      budget: 100,
      alfa: 0,
    });

    expect(output.acquisti).toHaveLength(1);
    expect(output.acquisti[0]!.ticker).toBe("A");
    expect(output.acquisti[0]!.quoteAcquistare).toBe(3);
    expect(output.budgetNonSpeso).toBe(10);
  });
});
