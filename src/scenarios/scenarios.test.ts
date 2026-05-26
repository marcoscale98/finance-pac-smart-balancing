import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseScenarioCompleto } from "./index.js";
import { parseScenario } from "../cli/index.js";

const scenarioCompletoValido = JSON.stringify({
  strumenti: [
    { ticker: "EXUS.DE", pesoTarget: 0.405, quoteAttuali: 0 },
    { ticker: "IUSE.MI", pesoTarget: 0.315, quoteAttuali: 0 },
  ],
  budget: 400,
  alfa: 0.5,
  grigliaDiAlfa: [0.25, 0.5, 0.75],
  durataInMesi: 36,
  dataInizio: "2023-01-01",
});

describe("parseScenarioCompleto", () => {
  it("JSON valido → scenario con grigliaDiAlfa, durataInMesi e dataInizio", () => {
    const scenario = parseScenarioCompleto(scenarioCompletoValido);

    expect(scenario.grigliaDiAlfa).toEqual([0.25, 0.5, 0.75]);
    expect(scenario.durataInMesi).toBe(36);
    expect(scenario.dataInizio).toEqual(new Date("2023-01-01"));
    expect(scenario.strumenti).toHaveLength(2);
    expect(scenario.budget).toBe(400);
    expect(scenario.alfa).toBe(0.5);
  });

  it("durataInMesi mancante → throw con messaggio leggibile", () => {
    const senzaDurata = JSON.stringify({
      strumenti: [],
      budget: 400,
      alfa: 0.5,
      grigliaDiAlfa: [0.5],
      dataInizio: "2023-01-01",
    });
    expect(() => parseScenarioCompleto(senzaDurata)).toThrow("durataInMesi");
  });

  it("grigliaDiAlfa mancante → throw con messaggio leggibile", () => {
    const senzaGriglia = JSON.stringify({
      strumenti: [],
      budget: 400,
      alfa: 0.5,
      durataInMesi: 36,
      dataInizio: "2023-01-01",
    });
    expect(() => parseScenarioCompleto(senzaGriglia)).toThrow("grigliaDiAlfa");
  });

  it("grigliaDiAlfa non array → throw con messaggio leggibile", () => {
    const grigliaNonArray = JSON.stringify({
      strumenti: [],
      budget: 400,
      alfa: 0.5,
      grigliaDiAlfa: 0.5,
      durataInMesi: 36,
      dataInizio: "2023-01-01",
    });
    expect(() => parseScenarioCompleto(grigliaNonArray)).toThrow("grigliaDiAlfa");
  });

  it("dataInizio mancante → throw con messaggio leggibile", () => {
    const senzaDataInizio = JSON.stringify({
      strumenti: [],
      budget: 400,
      alfa: 0.5,
      grigliaDiAlfa: [0.5],
      durataInMesi: 36,
    });
    expect(() => parseScenarioCompleto(senzaDataInizio)).toThrow("dataInizio");
  });

  it("dataInizio non stringa → throw con messaggio leggibile", () => {
    const dataInizioNonStringa = JSON.stringify({
      strumenti: [],
      budget: 400,
      alfa: 0.5,
      grigliaDiAlfa: [0.5],
      durataInMesi: 36,
      dataInizio: 20230101,
    });
    expect(() => parseScenarioCompleto(dataInizioNonStringa)).toThrow("dataInizio");
  });
});

describe("parseScenario — quoteAcquistateFineco", () => {
  it("campo presente su tutti gli strumenti → parsato correttamente", () => {
    const json = JSON.stringify({
      strumenti: [
        { ticker: "EXUS.DE", pesoTarget: 0.6, quoteAttuali: 10, quoteAcquistateFineco: 5 },
        { ticker: "IUSE.MI", pesoTarget: 0.4, quoteAttuali: 20, quoteAcquistateFineco: 3 },
      ],
      budget: 400,
      alfa: 0.5,
    });

    const scenario = parseScenario(json);

    expect(scenario.strumenti[0]!.quoteAcquistateFineco).toBe(5);
    expect(scenario.strumenti[1]!.quoteAcquistateFineco).toBe(3);
  });

  it("campo presente solo su alcuni strumenti → lancia errore tutti-o-nessuno", () => {
    const json = JSON.stringify({
      strumenti: [
        { ticker: "EXUS.DE", pesoTarget: 0.6, quoteAttuali: 10, quoteAcquistateFineco: 5 },
        { ticker: "IUSE.MI", pesoTarget: 0.4, quoteAttuali: 20 },
      ],
      budget: 400,
      alfa: 0.5,
    });

    expect(() => parseScenario(json)).toThrow("tutti-o-nessuno");
  });

  it("campo assente su tutti gli strumenti → scenario valido senza errore", () => {
    const json = JSON.stringify({
      strumenti: [
        { ticker: "EXUS.DE", pesoTarget: 0.6, quoteAttuali: 10 },
        { ticker: "IUSE.MI", pesoTarget: 0.4, quoteAttuali: 20 },
      ],
      budget: 400,
      alfa: 0.5,
    });

    const scenario = parseScenario(json);

    expect(scenario.strumenti[0]!.quoteAcquistateFineco).toBeUndefined();
    expect(scenario.strumenti[1]!.quoteAcquistateFineco).toBeUndefined();
  });
});

describe("file scenario JSON", () => {
  const scenarioFiles = [
    "scenario1-marco",
    "scenario2-marco-gold-costoso",
    "scenario3-all-equity",
    "scenario4-strumenti-costosi",
  ];

  for (const name of scenarioFiles) {
    it(`${name}.json esiste ed è valido per CLI e Simulatore`, () => {
      const path = resolve("scenarios", `${name}.json`);
      const json = readFileSync(path, "utf-8");

      expect(() => parseScenario(json)).not.toThrow();
      expect(() => parseScenarioCompleto(json)).not.toThrow();
    });
  }
});
