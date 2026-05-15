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
  const righe: string[] = [];

  for (const acquisto of output.acquisti) {
    const strumento = portafoglio.find((s) => s.ticker === acquisto.ticker)!;
    const costo = acquisto.quoteAcquistare * strumento.prezzoCorrente;

    righe.push(
      `${acquisto.ticker}: acquista ${acquisto.quoteAcquistare} quote → ${costo.toFixed(2)}€`,
    );
  }

  const totaleSpeso = portafoglio.reduce((acc, s, i) => {
    return acc + output.acquisti[i]!.quoteAcquistare * s.prezzoCorrente;
  }, 0);

  const larghezzaLabel = 26;
  const valoriTotali = [
    `${totaleSpeso.toFixed(2)}€`,
    `${output.budgetNonSpeso.toFixed(2)}€`,
    `${output.deviazione.toFixed(2)}€`,
  ];
  const maxLarghezzaValore = Math.max(...valoriTotali.map((v) => v.length));
  const formattaRiga = (label: string, valore: string) =>
    `${label.padEnd(larghezzaLabel)}${valore.padStart(maxLarghezzaValore)}`;

  righe.push("");
  righe.push(formattaRiga("Totale speso:", valoriTotali[0]!));
  righe.push(formattaRiga("Budget Non Speso (U):", valoriTotali[1]!));
  righe.push(formattaRiga("Deviazione totale (D_€):", valoriTotali[2]!));

  return righe.join("\n");
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
