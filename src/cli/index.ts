import { readFileSync } from "node:fs";
import { prezzoCorrente } from "../prezzi/index.js";
import { decideIterazione, type InputIterazione } from "../core/index.js";

export interface StrumentoScenario {
  ticker: string;
  pesoTarget: number;
  quoteAttuali: number;
  quoteAcquistateFineco?: number;
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
      typeof (s as Record<string, unknown>)["quoteAttuali"] !== "number"
    ) {
      throw new Error(
        `Scenario non valido: strumento [${i}] mancante di ticker, pesoTarget o quoteAttuali`,
      );
    }
    const sr = s as { ticker: string; pesoTarget: number; quoteAttuali: number; quoteAcquistateFineco?: number };
    const strumento: StrumentoScenario = { ticker: sr.ticker, pesoTarget: sr.pesoTarget, quoteAttuali: sr.quoteAttuali };
    if (sr.quoteAcquistateFineco !== undefined) {
      strumento.quoteAcquistateFineco = sr.quoteAcquistateFineco;
    }
    return strumento;
  });

  const conFineco = strumenti.filter((s) => s.quoteAcquistateFineco !== undefined).length;
  if (conFineco > 0 && conFineco < strumenti.length) {
    throw new Error(
      "Scenario non valido: quoteAcquistateFineco deve essere presente su tutti gli strumenti o su nessuno (regola tutti-o-nessuno)",
    );
  }

  return { strumenti, budget: raw.budget, alfa: raw.alfa };
}

export function formattaOutput(
  output: ReturnType<typeof decideIterazione>,
  portafoglio: InputIterazione["portafoglio"],
): string {
  const valoreAttuale = portafoglio.reduce((acc, s) => acc + s.quoteAttuali * s.prezzoCorrente, 0);
  const valoreFinale = portafoglio.reduce(
    (acc, s, i) => acc + (s.quoteAttuali + output.acquisti[i]!.quoteAcquistare) * s.prezzoCorrente,
    0,
  );

  // Dati riga per ogni strumento
  const datiRighe = output.acquisti.map((acquisto, i) => {
    const s = portafoglio[i]!;
    const quoteFinali = s.quoteAttuali + acquisto.quoteAcquistare;
    const costo = acquisto.quoteAcquistare * s.prezzoCorrente;
    const valoreFin = quoteFinali * s.prezzoCorrente;
    const pesoFin = valoreFinale > 0 ? valoreFin / valoreFinale : 0;
    const devFinEuro = Math.abs(valoreFin - s.pesoTarget * valoreFinale);
    const devFinPerc = Math.abs(pesoFin - s.pesoTarget);

    const pesoAttuale =
      valoreAttuale === 0
        ? "n/a"
        : `${((s.quoteAttuali * s.prezzoCorrente / valoreAttuale) * 100).toFixed(2)}%`;

    const devAttuale =
      valoreAttuale === 0
        ? "n/a"
        : (() => {
            const valoreAtt = s.quoteAttuali * s.prezzoCorrente;
            const devAtt = Math.abs(valoreAtt - s.pesoTarget * valoreAttuale);
            const pesoAtt = valoreAtt / valoreAttuale;
            const devAttPerc = Math.abs(pesoAtt - s.pesoTarget);
            return `${devAtt.toFixed(2)}€ (${(devAttPerc * 100).toFixed(1)}%)`;
          })();

    return {
      ticker: acquisto.ticker,
      // Tabella Quote
      attuali: String(s.quoteAttuali),
      acquistateCosto: `${acquisto.quoteAcquistare} (${costo.toFixed(2)}€)`,
      finali: String(quoteFinali),
      // Tabella Pesi
      pesoAttuale,
      pesoTarget: `${(s.pesoTarget * 100).toFixed(2)}%`,
      pesoFinale: `${(pesoFin * 100).toFixed(2)}%`,
      // Tabella Deviazioni
      devAttuale,
      devFinale: `${devFinEuro.toFixed(2)}€ (${(devFinPerc * 100).toFixed(1)}%)`,
    };
  });

  const sep = (n: number) => "-".repeat(n);
  const col = (s: string, n: number) => s.padStart(n);

  // --- Tabella Quote ---
  const HDR_Q = {
    strumento: "Strumento",
    attuali: "Quote Attuali",
    acquistateCosto: "Acquistate (Costo)",
    finali: "Quote Finali",
  };
  const wQ = {
    strumento: Math.max(HDR_Q.strumento.length, ...datiRighe.map((r) => r.ticker.length)),
    attuali: Math.max(HDR_Q.attuali.length, ...datiRighe.map((r) => r.attuali.length)),
    acquistateCosto: Math.max(HDR_Q.acquistateCosto.length, ...datiRighe.map((r) => r.acquistateCosto.length)),
    finali: Math.max(HDR_Q.finali.length, ...datiRighe.map((r) => r.finali.length)),
  };
  const headerQ =
    `${HDR_Q.strumento.padEnd(wQ.strumento)} | ${col(HDR_Q.attuali, wQ.attuali)} | ` +
    `${col(HDR_Q.acquistateCosto, wQ.acquistateCosto)} | ${col(HDR_Q.finali, wQ.finali)}`;
  const separatoreQ =
    `${sep(wQ.strumento)}-|-${sep(wQ.attuali)}-|-${sep(wQ.acquistateCosto)}-|-${sep(wQ.finali)}`;
  const righeQ = datiRighe.map(
    (r) =>
      `${r.ticker.padEnd(wQ.strumento)} | ${col(r.attuali, wQ.attuali)} | ` +
      `${col(r.acquistateCosto, wQ.acquistateCosto)} | ${col(r.finali, wQ.finali)}`,
  );

  const totaleSpeso = portafoglio.reduce(
    (acc, s, i) => acc + output.acquisti[i]!.quoteAcquistare * s.prezzoCorrente,
    0,
  );
  const valoriTotaliQ = [`${totaleSpeso.toFixed(2)}€`, `${output.budgetNonSpeso.toFixed(2)}€`];
  const maxLarghezzaQ = Math.max(...valoriTotaliQ.map((v) => v.length));
  const larghezzaLabelQ = 24;
  const rigaTotaleQ = (label: string, valore: string) =>
    `${label.padEnd(larghezzaLabelQ)}${valore.padStart(maxLarghezzaQ)}`;

  // --- Tabella Pesi ---
  const HDR_P = {
    strumento: "Strumento",
    pesoAttuale: "Peso Attuale",
    pesoTarget: "Peso Target",
    pesoFinale: "Peso Finale",
  };
  const wP = {
    strumento: Math.max(HDR_P.strumento.length, ...datiRighe.map((r) => r.ticker.length)),
    pesoAttuale: Math.max(HDR_P.pesoAttuale.length, ...datiRighe.map((r) => r.pesoAttuale.length)),
    pesoTarget: Math.max(HDR_P.pesoTarget.length, ...datiRighe.map((r) => r.pesoTarget.length)),
    pesoFinale: Math.max(HDR_P.pesoFinale.length, ...datiRighe.map((r) => r.pesoFinale.length)),
  };
  const headerP =
    `${HDR_P.strumento.padEnd(wP.strumento)} | ${col(HDR_P.pesoAttuale, wP.pesoAttuale)} | ` +
    `${col(HDR_P.pesoTarget, wP.pesoTarget)} | ${col(HDR_P.pesoFinale, wP.pesoFinale)}`;
  const separatoreP =
    `${sep(wP.strumento)}-|-${sep(wP.pesoAttuale)}-|-${sep(wP.pesoTarget)}-|-${sep(wP.pesoFinale)}`;
  const righeP = datiRighe.map(
    (r) =>
      `${r.ticker.padEnd(wP.strumento)} | ${col(r.pesoAttuale, wP.pesoAttuale)} | ` +
      `${col(r.pesoTarget, wP.pesoTarget)} | ${col(r.pesoFinale, wP.pesoFinale)}`,
  );

  // --- Tabella Deviazioni ---
  const HDR_D = {
    strumento: "Strumento",
    devAttuale: "Dev Attuale",
    devFinale: "Dev Finale",
  };
  const wD = {
    strumento: Math.max(HDR_D.strumento.length, ...datiRighe.map((r) => r.ticker.length)),
    devAttuale: Math.max(HDR_D.devAttuale.length, ...datiRighe.map((r) => r.devAttuale.length)),
    devFinale: Math.max(HDR_D.devFinale.length, ...datiRighe.map((r) => r.devFinale.length)),
  };
  const headerD =
    `${HDR_D.strumento.padEnd(wD.strumento)} | ${col(HDR_D.devAttuale, wD.devAttuale)} | ` +
    `${col(HDR_D.devFinale, wD.devFinale)}`;
  const separatoreD =
    `${sep(wD.strumento)}-|-${sep(wD.devAttuale)}-|-${sep(wD.devFinale)}`;
  const righeD = datiRighe.map(
    (r) =>
      `${r.ticker.padEnd(wD.strumento)} | ${col(r.devAttuale, wD.devAttuale)} | ` +
      `${col(r.devFinale, wD.devFinale)}`,
  );

  const devAttualeTotal =
    valoreAttuale === 0
      ? null
      : portafoglio.reduce((acc, s) => {
          const valoreAtt = s.quoteAttuali * s.prezzoCorrente;
          return acc + Math.abs(valoreAtt - s.pesoTarget * valoreAttuale);
        }, 0);
  const valoriTotaliD = [
    devAttualeTotal !== null ? `${devAttualeTotal.toFixed(2)}€` : "n/a",
    `${output.deviazione.toFixed(2)}€`,
  ];
  const maxLarghezzaD = Math.max(...valoriTotaliD.filter((v) => v !== "n/a").map((v) => v.length));
  const larghezzaLabelD = 32;
  const rigaTotaleD = (label: string, valore: string) =>
    `${label.padEnd(larghezzaLabelD)}${valore.padStart(maxLarghezzaD)}`;

  return [
    headerQ,
    separatoreQ,
    ...righeQ,
    "",
    rigaTotaleQ("Totale speso:", valoriTotaliQ[0]!),
    rigaTotaleQ("Budget Non Speso (U):", valoriTotaliQ[1]!),
    "",
    headerP,
    separatoreP,
    ...righeP,
    "",
    headerD,
    separatoreD,
    ...righeD,
    "",
    rigaTotaleD("Deviazione attuale totale (D_€):", valoriTotaliD[0]!),
    rigaTotaleD("Deviazione finale totale (D_€):", valoriTotaliD[1]!),
  ].join("\n");
}

export async function eseguiScenario(scenario: Scenario): Promise<string> {
  const portafoglio: InputIterazione["portafoglio"] = await Promise.all(
    scenario.strumenti.map(async (s) => ({
      ticker: s.ticker,
      prezzoCorrente: await prezzoCorrente(s.ticker),
      quoteAttuali: s.quoteAttuali,
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
