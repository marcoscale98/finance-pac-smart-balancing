import { parseScenario, type Scenario } from "../cli/index.js";

export interface ScenarioCompleto extends Scenario {
  grigliaDiAlfa: number[];
  durataInMesi: number;
  dataInizio: Date;
  percorsoTransazioniFineco?: string;
}

export function parseScenarioCompleto(json: string): ScenarioCompleto {
  const base = parseScenario(json);

  let dati: Record<string, unknown>;
  try {
    dati = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error("Scenario non valido: JSON malformato");
  }

  if (!Array.isArray(dati["grigliaDiAlfa"])) {
    throw new Error("Scenario non valido: grigliaDiAlfa deve essere un array");
  }

  if (typeof dati["durataInMesi"] !== "number") {
    throw new Error("Scenario non valido: durataInMesi deve essere un numero");
  }

  if (typeof dati["dataInizio"] !== "string") {
    throw new Error("Scenario non valido: dataInizio deve essere una stringa ISO (es. \"2023-01-01\")");
  }

  const percorsoTransazioniFineco =
    typeof dati["percorsoTransazioniFineco"] === "string"
      ? dati["percorsoTransazioniFineco"]
      : undefined;

  return {
    ...base,
    grigliaDiAlfa: dati["grigliaDiAlfa"] as number[],
    durataInMesi: dati["durataInMesi"],
    dataInizio: new Date(dati["dataInizio"]),
    ...(percorsoTransazioniFineco !== undefined && { percorsoTransazioniFineco }),
  };
}
