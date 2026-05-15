import { readFileSync } from "node:fs";
import { prezzoCorrente } from "../prezzi/index.js";
import { decideIterazione, type InputIterazione } from "../core/index.js";

export interface StrumentoScenario {
  ticker: string;
  pesoTarget: number;
  quoteDetenute: number;
}

export interface Scenario {
  strumenti: StrumentoScenario[];
  budget: number;
  alfa: number;
}

export function parseScenario(json: string): Scenario {
  let dati: unknown;
  try {
    dati = JSON.parse(json);
  } catch {
    throw new Error("Scenario non valido: JSON malformato");
  }

  if (
    typeof dati !== "object" ||
    dati === null ||
    !Array.isArray((dati as Record<string, unknown>)["strumenti"]) ||
    typeof (dati as Record<string, unknown>)["budget"] !== "number" ||
    typeof (dati as Record<string, unknown>)["alfa"] !== "number"
  ) {
    throw new Error("Scenario non valido: campi obbligatori mancanti (strumenti, budget, alfa)");
  }

  const raw = dati as { strumenti: unknown[]; budget: number; alfa: number };

  const strumenti = raw.strumenti.map((s, i) => {
    if (
      typeof s !== "object" ||
      s === null ||
      typeof (s as Record<string, unknown>)["ticker"] !== "string" ||
      typeof (s as Record<string, unknown>)["pesoTarget"] !== "number" ||
      typeof (s as Record<string, unknown>)["quoteDetenute"] !== "number"
    ) {
      throw new Error(
        `Scenario non valido: strumento [${i}] mancante di ticker, pesoTarget o quoteDetenute`,
      );
    }
    const sr = s as { ticker: string; pesoTarget: number; quoteDetenute: number };
    return { ticker: sr.ticker, pesoTarget: sr.pesoTarget, quoteDetenute: sr.quoteDetenute };
  });

  return { strumenti, budget: raw.budget, alfa: raw.alfa };
}

export function formattaOutput(
  output: ReturnType<typeof decideIterazione>,
  portafoglio: InputIterazione["portafoglio"],
): string {
  // Calcola valore finale portafoglio per la D_€ per strumento
  const valoreFinale = portafoglio.reduce(
    (acc, s, i) => acc + (s.quoteDetenute + output.acquisti[i]!.quoteAcquistare) * s.prezzoCorrente,
    0,
  );

  // Dati riga per ogni strumento
  const datiRighe = output.acquisti.map((acquisto, i) => {
    const s = portafoglio[i]!;
    const quoteFinali = s.quoteDetenute + acquisto.quoteAcquistare;
    const costo = acquisto.quoteAcquistare * s.prezzoCorrente;
    const valoreEff = quoteFinali * s.prezzoCorrente;
    const deviazione = Math.abs(valoreEff - s.pesoTarget * valoreFinale);
    return {
      ticker: acquisto.ticker,
      detenute: String(s.quoteDetenute),
      acquistate: String(acquisto.quoteAcquistare),
      finali: String(quoteFinali),
      costo: `${costo.toFixed(2)}€`,
      deviazione: `${deviazione.toFixed(2)}€`,
    };
  });

  // Larghezze colonne (dinamiche sul contenuto)
  const w = {
    strumento: Math.max("Strumento".length, ...datiRighe.map((r) => r.ticker.length)),
    detenute: Math.max("Detenute".length, ...datiRighe.map((r) => r.detenute.length)),
    acquistate: Math.max("Acquistate".length, ...datiRighe.map((r) => r.acquistate.length)),
    finali: Math.max("Finali".length, ...datiRighe.map((r) => r.finali.length)),
    costo: Math.max("Costo".length, ...datiRighe.map((r) => r.costo.length)),
    deviazione: Math.max("D_€".length, ...datiRighe.map((r) => r.deviazione.length)),
  };

  const sep = (n: number) => "-".repeat(n);
  const header =
    `${"Strumento".padEnd(w.strumento)} | ${"Detenute".padStart(w.detenute)} | ` +
    `${"Acquistate".padStart(w.acquistate)} | ${"Finali".padStart(w.finali)} | ` +
    `${"Costo".padStart(w.costo)} | ${"D_€".padStart(w.deviazione)}`;
  const separatore =
    `${sep(w.strumento)}-|-${sep(w.detenute)}-|-${sep(w.acquistate)}-|-` +
    `${sep(w.finali)}-|-${sep(w.costo)}-|-${sep(w.deviazione)}`;

  const righeTabella = datiRighe.map(
    (r) =>
      `${r.ticker.padEnd(w.strumento)} | ${r.detenute.padStart(w.detenute)} | ` +
      `${r.acquistate.padStart(w.acquistate)} | ${r.finali.padStart(w.finali)} | ` +
      `${r.costo.padStart(w.costo)} | ${r.deviazione.padStart(w.deviazione)}`,
  );

  // Totali con € allineati
  const totaleSpeso = portafoglio.reduce(
    (acc, s, i) => acc + output.acquisti[i]!.quoteAcquistare * s.prezzoCorrente,
    0,
  );
  const valoriTotali = [
    `${totaleSpeso.toFixed(2)}€`,
    `${output.budgetNonSpeso.toFixed(2)}€`,
    `${output.deviazione.toFixed(2)}€`,
  ];
  const maxLarghezzaValore = Math.max(...valoriTotali.map((v) => v.length));
  const larghezzaLabel = 26;
  const formattaRigaTotale = (label: string, valore: string) =>
    `${label.padEnd(larghezzaLabel)}${valore.padStart(maxLarghezzaValore)}`;

  return [
    header,
    separatore,
    ...righeTabella,
    "",
    formattaRigaTotale("Totale speso:", valoriTotali[0]!),
    formattaRigaTotale("Budget Non Speso (U):", valoriTotali[1]!),
    formattaRigaTotale("Deviazione totale (D_€):", valoriTotali[2]!),
  ].join("\n");
}

export async function eseguiScenario(scenario: Scenario): Promise<string> {
  const portafoglio: InputIterazione["portafoglio"] = await Promise.all(
    scenario.strumenti.map(async (s) => ({
      ticker: s.ticker,
      prezzoCorrente: await prezzoCorrente(s.ticker),
      quoteDetenute: s.quoteDetenute,
      pesoTarget: s.pesoTarget,
    })),
  );

  const output = decideIterazione({ portafoglio, budget: scenario.budget, alfa: scenario.alfa });
  return formattaOutput(output, portafoglio);
}

async function main(args: string[]): Promise<void> {
  const percorso = args[0];
  if (!percorso) {
    console.error("Uso: cli <path/to/scenario.json>");
    process.exit(1);
  }

  let scenario: Scenario;
  try {
    const contenuto = readFileSync(percorso, "utf-8");
    scenario = parseScenario(contenuto);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const testo = await eseguiScenario(scenario);
  console.log(testo);
}

// Esegui solo quando invocato direttamente (non durante i test)
const isEntryPoint =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("cli/index.ts") || process.argv[1].endsWith("cli/index.js"));

if (isEntryPoint) {
  main(process.argv.slice(2));
}
