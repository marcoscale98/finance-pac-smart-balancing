import { describe, it, expect, vi } from "vitest";
import { simula } from "./index.js";
import type { ScenarioSimulazione } from "./index.js";
import type { Quotazione } from "../prezzi/index.js";

describe("simula", () => {
  it("1 α, 1 mese: SimulationResult rispecchia l'output di decideIterazione", async () => {
    const dataIterazione = new Date("2024-01-15");

    const prezziPerDateMock = vi.fn().mockImplementation(
      async (ticker: string, _date: Date[]): Promise<Quotazione[]> => {
        const prezzi: Record<string, number> = { A: 50, B: 20 };
        return [{ data: dataIterazione, prezzo: prezzi[ticker]! }];
      },
    );

    const scenario: ScenarioSimulazione = {
      portafoglioIniziale: [
        { ticker: "A", prezzoCorrente: 50, quoteAttuali: 2, pesoTarget: 0.6 },
        { ticker: "B", prezzoCorrente: 20, quoteAttuali: 3, pesoTarget: 0.4 },
      ],
      budget: 100,
      durataInMesi: 1,
      grigliaDiAlfa: [0.5],
      dataInizio: new Date("2024-01-15"),
    };

    const risultato = await simula(scenario, prezziPerDateMock);

    expect(risultato).toHaveLength(1);
    const serie = risultato[0]!;
    expect(serie.alfa).toBe(0.5);

    expect(serie.mesi).toHaveLength(1);
    const metrica = serie.mesi[0]!;

    expect(metrica.data).toEqual(dataIterazione);

    // decideIterazione({A:50×2, B:20×3}, budget=100, alfa=0.5) → acquista A:1, B:2
    // Quote finali: A=3 (150€), B=5 (100€) → totale 250€
    // Spesa: 1×50 + 2×20 = 90€
    // Deviazione: 0 (target A=60%=150€ ✓, target B=40%=100€ ✓)
    expect(metrica.valorePortafoglio).toBeCloseTo(250);
    expect(metrica.spesaCumulativa).toBeCloseTo(90);
    expect(metrica.budgetTeoricoConsumato).toBeCloseTo(100);
    expect(metrica.deviazioneMedia).toBeCloseTo(0);
  });

  it("2 mesi: il portafoglio del secondo mese parte dalle quote acquistate nel primo", async () => {
    // Unico strumento a 100€, budget 100€ → ogni mese acquista 1 quota
    // Dopo mese 1: 1 quota (100€)
    // Dopo mese 2: 2 quote (200€)
    const dataM1 = new Date("2024-01-15");
    const dataM2 = new Date("2024-02-15");

    const prezziPerDateMock = vi.fn().mockImplementation(
      async (_ticker: string, date: Date[]): Promise<Quotazione[]> =>
        date.map((d) => ({ data: d, prezzo: 100 })),
    );

    const scenario: ScenarioSimulazione = {
      portafoglioIniziale: [
        { ticker: "A", prezzoCorrente: 100, quoteAttuali: 0, pesoTarget: 1 },
      ],
      budget: 100,
      durataInMesi: 2,
      grigliaDiAlfa: [0],
      dataInizio: dataM1,
    };

    const risultato = await simula(scenario, prezziPerDateMock);
    const mesi = risultato[0]!.mesi;

    expect(mesi).toHaveLength(2);
    expect(mesi[0]!.valorePortafoglio).toBeCloseTo(100);  // 1 quota × 100€
    expect(mesi[1]!.valorePortafoglio).toBeCloseTo(200);  // 2 quote × 100€
    expect(mesi[1]!.data).toEqual(dataM2);
  });

  it("nessun carryover: ogni mese inizia con B euro esatti, non B + budget non speso del mese precedente", async () => {
    // 1 strumento a 90€, budget 100€ → acquista 1 quota (spende 90€, avanza 10€)
    // Con carryover, il mese 2 partirebbe con 110€ → acquisterebbe ancora 1 quota
    // Senza carryover, il mese 2 parte con 100€ → acquisterebbe ancora 1 quota
    // La distinzione si vede sulla spesaCumulativa: senza carryover = 90+90=180€
    // Con carryover ipotetico = 90+90=180€ (stesso numero in questo caso)
    // Usiamo prezzo 60€ per far emergere la differenza:
    // Budget 100€, prezzo 60€ → 1 quota (60€), avanza 40€
    // Senza carryover: mese 2 → 1 quota (60€). spesaCumulativa = 60+60 = 120€
    // Con carryover (errato): mese 2 parte da 140€ → 2 quote (120€). spesaCumulativa = 60+120 = 180€
    const prezziPerDateMock = vi.fn().mockImplementation(
      async (_ticker: string, date: Date[]): Promise<Quotazione[]> =>
        date.map((d) => ({ data: d, prezzo: 60 })),
    );

    const scenario: ScenarioSimulazione = {
      portafoglioIniziale: [
        { ticker: "A", prezzoCorrente: 60, quoteAttuali: 0, pesoTarget: 1 },
      ],
      budget: 100,
      durataInMesi: 2,
      grigliaDiAlfa: [0],
      dataInizio: new Date("2024-01-15"),
    };

    const risultato = await simula(scenario, prezziPerDateMock);
    const mesi = risultato[0]!.mesi;

    // Senza carryover: spesa totale = 60 + 60 = 120€
    expect(mesi[1]!.spesaCumulativa).toBeCloseTo(120);
  });

  it("griglia [0.25, 0.5, 0.75] produce 3 serie con alfa distinti", async () => {
    // Scenario Fineco: GOLD costoso → alfa diversi producono spese diverse
    const prezziPerDateMock = vi.fn().mockImplementation(
      async (ticker: string, date: Date[]): Promise<Quotazione[]> => {
        const prezzi: Record<string, number> = { WORLD: 80, GOLD: 350 };
        return date.map((d) => ({ data: d, prezzo: prezzi[ticker]! }));
      },
    );

    const scenario: ScenarioSimulazione = {
      portafoglioIniziale: [
        { ticker: "WORLD", prezzoCorrente: 80,  quoteAttuali: 0, pesoTarget: 0.5 },
        { ticker: "GOLD",  prezzoCorrente: 350, quoteAttuali: 0, pesoTarget: 0.5 },
      ],
      budget: 400,
      durataInMesi: 1,
      grigliaDiAlfa: [0.25, 0.5, 0.75],
      dataInizio: new Date("2024-01-15"),
    };

    const risultato = await simula(scenario, prezziPerDateMock);

    expect(risultato).toHaveLength(3);
    expect(risultato[0]!.alfa).toBe(0.25);
    expect(risultato[1]!.alfa).toBe(0.5);
    expect(risultato[2]!.alfa).toBe(0.75);

    // alfa=0.25 spende tutto (minimizza U), alfa=0.75 spende 0 (minimizza D_€)
    const spesa025 = risultato[0]!.mesi[0]!.spesaCumulativa;
    const spesa075 = risultato[2]!.mesi[0]!.spesaCumulativa;
    expect(spesa025).toBeGreaterThan(spesa075 + 50);
  });

  it("buco nei prezzi: se prezziPerDate restituisce array vuoto, simula lancia un errore", async () => {
    const prezziPerDateMock = vi.fn().mockResolvedValue([]);

    const scenario: ScenarioSimulazione = {
      portafoglioIniziale: [
        { ticker: "A", prezzoCorrente: 50, quoteAttuali: 0, pesoTarget: 1 },
      ],
      budget: 100,
      durataInMesi: 1,
      grigliaDiAlfa: [0.5],
      dataInizio: new Date("2024-01-15"),
    };

    await expect(simula(scenario, prezziPerDateMock)).rejects.toThrow(
      "Prezzo mancante per A",
    );
  });
});
