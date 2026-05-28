import { describe, it, expect } from "vitest";
import { applicaOverrideCli } from "./override.js";

describe("applicaOverrideCli", () => {
  it("applica un valore stringa", () => {
    const risultato = applicaOverrideCli({}, ["--percorso", "data/fineco.csv"]);
    expect(risultato).toEqual({ percorso: "data/fineco.csv" });
  });

  it("converte un valore numerico intero", () => {
    const risultato = applicaOverrideCli({}, ["--durataInMesi", "3"]);
    expect(risultato).toEqual({ durataInMesi: 3 });
  });

  it("converte un valore numerico decimale", () => {
    const risultato = applicaOverrideCli({}, ["--alfa", "0.5"]);
    expect(risultato).toEqual({ alfa: 0.5 });
  });

  it("converte un valore JSON array", () => {
    const risultato = applicaOverrideCli({}, ["--grigliaDiAlfa", "[0.25,0.75]"]);
    expect(risultato).toEqual({ grigliaDiAlfa: [0.25, 0.75] });
  });

  it("converte un valore JSON object", () => {
    const risultato = applicaOverrideCli({}, ["--config", '{"chiave":"valore"}']);
    expect(risultato).toEqual({ config: { chiave: "valore" } });
  });

  it("ignora silenziosamente il campo strumenti", () => {
    const risultato = applicaOverrideCli({}, ["--strumenti", "[{...}]", "--durataInMesi", "3"]);
    expect(risultato).toEqual({ durataInMesi: 3 });
  });

  it("non interpreta argomenti senza -- come override (es. path scenario)", () => {
    const risultato = applicaOverrideCli({}, ["scenarios/mio.json", "--durataInMesi", "3"]);
    expect(risultato).toEqual({ durataInMesi: 3 });
  });

  it("preserva i campi base non sovrascritti", () => {
    const risultato = applicaOverrideCli({ durataInMesi: 21, budget: 100 }, ["--durataInMesi", "3"]);
    expect(risultato).toEqual({ durataInMesi: 3, budget: 100 });
  });
});
