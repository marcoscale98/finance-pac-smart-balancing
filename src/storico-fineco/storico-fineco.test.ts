import { describe, it, expect } from "vitest";
import { parseStoricoAcquistiFineco } from "./index.js";

describe("parseStoricoAcquistiFineco", () => {
  it("CSV valido → Map indicizzata per YYYY-MM con quote per ticker", () => {
    const csv = [
      "data,EXUS.DE,IUSE.MI",
      "2024-04-15,2,1",
      "2024-05-10,3,2",
    ].join("\n");

    const risultato = parseStoricoAcquistiFineco(csv);

    expect(risultato.size).toBe(2);
    expect(risultato.get("2024-04")).toEqual({ "EXUS.DE": 2, "IUSE.MI": 1 });
    expect(risultato.get("2024-05")).toEqual({ "EXUS.DE": 3, "IUSE.MI": 2 });
  });

  it("valori con spazi attorno → trim applicato, valori numerici corretti", () => {
    const csv = [
      " data , EXUS.DE , IUSE.MI ",
      " 2024-04-15 , 2 , 1 ",
    ].join("\n");

    const risultato = parseStoricoAcquistiFineco(csv);

    expect(risultato.get("2024-04")).toEqual({ "EXUS.DE": 2, "IUSE.MI": 1 });
  });

  it("date diverse nello stesso mese → stessa entry YYYY-MM", () => {
    const csv = [
      "data,EXUS.DE",
      "2024-04-01,1",
      "2024-04-15,2",
    ].join("\n");

    const risultato = parseStoricoAcquistiFineco(csv);

    expect(risultato.size).toBe(1);
    expect(risultato.get("2024-04")).toEqual({ "EXUS.DE": 2 });
  });

  it("due righe con stesso anno-mese → viene tenuta l'ultima", () => {
    const csv = [
      "data,EXUS.DE",
      "2024-04-01,1",
      "2024-04-15,5",
    ].join("\n");

    const risultato = parseStoricoAcquistiFineco(csv);

    expect(risultato.get("2024-04")).toEqual({ "EXUS.DE": 5 });
  });

  it("CSV senza colonna 'data' → errore chiaro", () => {
    const csv = [
      "EXUS.DE,IUSE.MI",
      "2,1",
    ].join("\n");

    expect(() => parseStoricoAcquistiFineco(csv)).toThrow("data");
  });

  it("CSV vuoto → errore chiaro", () => {
    expect(() => parseStoricoAcquistiFineco("")).toThrow();
  });
});
