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

    expect(risultato.serieAlfa).toHaveLength(1);
    const serie = risultato.serieAlfa[0]!;
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
    const mesi = risultato.serieAlfa[0]!.mesi;

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
    const mesi = risultato.serieAlfa[0]!.mesi;

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

    expect(risultato.serieAlfa).toHaveLength(3);
    expect(risultato.serieAlfa[0]!.alfa).toBe(0.25);
    expect(risultato.serieAlfa[1]!.alfa).toBe(0.5);
    expect(risultato.serieAlfa[2]!.alfa).toBe(0.75);

    // alfa=0.25 spende tutto (minimizza U), alfa=0.75 spende 0 (minimizza D_€)
    const spesa025 = risultato.serieAlfa[0]!.mesi[0]!.spesaCumulativa;
    const spesa075 = risultato.serieAlfa[2]!.mesi[0]!.spesaCumulativa;
    expect(spesa025).toBeGreaterThan(spesa075 + 50);
  });

  it("con acquisizioniFineco completa (K = N): serieFineco ha N mesi con metriche corrette", async () => {
    // 1 strumento A a 100€, CSV acquista 1 quota a gennaio 2024
    // Portafoglio iniziale: 0 quote
    // Dopo mese 1: 1 quota × 100€ = 100€, spesa = 100€, deviazione = 0 (unico strumento)
    const dataMese = new Date("2024-01-15");

    const prezziPerDateMock = vi.fn().mockImplementation(
      async (_ticker: string, date: Date[]): Promise<Quotazione[]> =>
        date.map((d) => ({ data: d, prezzo: 100 })),
    );

    const acquisizioniFineco = new Map<string, Record<string, number>>();
    acquisizioniFineco.set("2024-01", { A: 1 });

    const scenario: ScenarioSimulazione = {
      portafoglioIniziale: [
        { ticker: "A", prezzoCorrente: 100, quoteAttuali: 0, pesoTarget: 1 },
      ],
      budget: 100,
      durataInMesi: 1,
      grigliaDiAlfa: [0.5],
      dataInizio: dataMese,
    };

    const risultato = await simula(scenario, prezziPerDateMock, acquisizioniFineco);

    expect(risultato.serieFineco).toHaveLength(1);
    const mese = risultato.serieFineco![0]!;
    expect(mese.valorePortafoglio).toBeCloseTo(100);
    expect(mese.spesaCumulativa).toBeCloseTo(100);
    expect(mese.budgetTeoricoConsumato).toBeCloseTo(100);
    expect(mese.deviazioneMedia).toBeCloseTo(0);
    expect(mese.deviazioneMediaPercentuale).toBeCloseTo(0);
  });

  it("con acquisizioniFineco parziale (K < N): serieFineco si tronca a K mesi", async () => {
    // CSV copre solo gennaio 2024, simulazione dura 2 mesi
    const prezziPerDateMock = vi.fn().mockImplementation(
      async (_ticker: string, date: Date[]): Promise<Quotazione[]> =>
        date.map((d) => ({ data: d, prezzo: 100 })),
    );

    const acquisizioniFineco = new Map<string, Record<string, number>>();
    acquisizioniFineco.set("2024-01", { A: 1 });
    // nessuna riga per "2024-02"

    const scenario: ScenarioSimulazione = {
      portafoglioIniziale: [
        { ticker: "A", prezzoCorrente: 100, quoteAttuali: 0, pesoTarget: 1 },
      ],
      budget: 100,
      durataInMesi: 2,
      grigliaDiAlfa: [0.5],
      dataInizio: new Date("2024-01-15"),
    };

    const risultato = await simula(scenario, prezziPerDateMock, acquisizioniFineco);

    expect(risultato.serieFineco).toHaveLength(1);
    expect(risultato.serieAlfa[0]!.mesi).toHaveLength(2);
  });

  it("senza acquisizioniFineco: serieFineco è undefined", async () => {
    const prezziPerDateMock = vi.fn().mockImplementation(
      async (_ticker: string, date: Date[]): Promise<Quotazione[]> =>
        date.map((d) => ({ data: d, prezzo: 100 })),
    );

    const scenario: ScenarioSimulazione = {
      portafoglioIniziale: [
        { ticker: "A", prezzoCorrente: 100, quoteAttuali: 0, pesoTarget: 1 },
      ],
      budget: 100,
      durataInMesi: 1,
      grigliaDiAlfa: [0.5],
      dataInizio: new Date("2024-01-15"),
    };

    const risultato = await simula(scenario, prezziPerDateMock);
    expect(risultato.serieFineco).toBeUndefined();
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

  describe("puntoInizio", () => {
    it("data: è la data effettiva di mercato al mese precedente a dataInizio", async () => {
      const dataInizio = new Date("2024-02-15");
      const dataEffettivaInizio = new Date("2024-01-14"); // giorno di mercato più vicino al 2024-01-15

      const prezziPerDateMock = vi.fn().mockImplementation(
        async (_ticker: string, date: Date[]): Promise<Quotazione[]> =>
          date.map((d) => ({
            data: d.toISOString().slice(0, 7) === "2024-01" ? dataEffettivaInizio : d,
            prezzo: 100,
          })),
      );

      const scenario: ScenarioSimulazione = {
        portafoglioIniziale: [
          { ticker: "A", prezzoCorrente: 100, quoteAttuali: 1, pesoTarget: 1 },
        ],
        budget: 100,
        durataInMesi: 1,
        grigliaDiAlfa: [0.5],
        dataInizio,
      };

      const risultato = await simula(scenario, prezziPerDateMock);
      expect(risultato.puntoInizio.data).toEqual(dataEffettivaInizio);
    });

    it("valorePortafoglio: somma quote iniziali × prezzo al mese precedente", async () => {
      // A: 2 quote × 50€ = 100€, B: 3 quote × 20€ = 60€ → totale 160€
      const prezziPerDateMock = vi.fn().mockImplementation(
        async (ticker: string, date: Date[]): Promise<Quotazione[]> => {
          const prezzi: Record<string, number> = { A: 50, B: 20 };
          return date.map((d) => ({ data: d, prezzo: prezzi[ticker]! }));
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
        dataInizio: new Date("2024-02-15"),
      };

      const risultato = await simula(scenario, prezziPerDateMock);
      expect(risultato.puntoInizio.valorePortafoglio).toBeCloseTo(160);
    });

    it("spesaCumulativa, budgetTeoricoConsumato, budgetNonSpeso sono tutti 0", async () => {
      const prezziPerDateMock = vi.fn().mockImplementation(
        async (_ticker: string, date: Date[]): Promise<Quotazione[]> =>
          date.map((d) => ({ data: d, prezzo: 100 })),
      );

      const scenario: ScenarioSimulazione = {
        portafoglioIniziale: [
          { ticker: "A", prezzoCorrente: 100, quoteAttuali: 1, pesoTarget: 1 },
        ],
        budget: 100,
        durataInMesi: 1,
        grigliaDiAlfa: [0.5],
        dataInizio: new Date("2024-02-15"),
      };

      const risultato = await simula(scenario, prezziPerDateMock);
      expect(risultato.puntoInizio.spesaCumulativa).toBe(0);
      expect(risultato.puntoInizio.budgetTeoricoConsumato).toBe(0);
      expect(risultato.puntoInizio.budgetNonSpeso).toBe(0);
    });

    it("deviazioneMedia: riflette lo sbilanciamento iniziale prima di qualsiasi acquisto", async () => {
      // A: 1 quota × 100€ = 100€ (peso 100%), target 60% → portafoglio vale solo A
      // ma con B a 0 quote: valorePortafoglio = 100€
      // deviazioneA = |100 - 0.6×100| = 40, deviazioneB = |0 - 0.4×100| = 40
      // deviazioneMedia = (40+40)/2 = 40
      const prezziPerDateMock = vi.fn().mockImplementation(
        async (_ticker: string, date: Date[]): Promise<Quotazione[]> =>
          date.map((d) => ({ data: d, prezzo: 100 })),
      );

      const scenario: ScenarioSimulazione = {
        portafoglioIniziale: [
          { ticker: "A", prezzoCorrente: 100, quoteAttuali: 1, pesoTarget: 0.6 },
          { ticker: "B", prezzoCorrente: 100, quoteAttuali: 0, pesoTarget: 0.4 },
        ],
        budget: 100,
        durataInMesi: 1,
        grigliaDiAlfa: [0.5],
        dataInizio: new Date("2024-02-15"),
      };

      const risultato = await simula(scenario, prezziPerDateMock);
      expect(risultato.puntoInizio.deviazioneMedia).toBeCloseTo(40);
      expect(risultato.puntoInizio.deviazioneMediaPercentuale).toBeCloseTo(0.4); // 40/100
    });
  });
});
