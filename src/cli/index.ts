import { readFileSync } from "node:fs";
import { prezzoCorrente, prezziPerDate } from "../prezzi/index.js";
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
  dataIterazione?: Date;
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

  if (
    (dati as Record<string, unknown>)["dataIterazione"] !== undefined &&
    typeof (dati as Record<string, unknown>)["dataIterazione"] !== "string"
  ) {
    throw new Error("Scenario non valido: dataIterazione deve essere una stringa ISO (es. \"2025-03-15\")");
  }

  const raw = dati as { strumenti: unknown[]; budget: number; alfa: number; dataIterazione?: string };

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

  const risultato: Scenario = { strumenti, budget: raw.budget, alfa: raw.alfa };
  if (raw.dataIterazione !== undefined) {
    risultato.dataIterazione = new Date(raw.dataIterazione);
  }
  return risultato;
}

export function formattaOutput(
  output: ReturnType<typeof decideIterazione>,
  portafoglio: InputIterazione["portafoglio"],
  finecoAcquisti?: number[],
  dataIterazione?: Date,
): string {
  const valoreAttuale = portafoglio.reduce((acc, s) => acc + s.quoteAttuali * s.prezzoCorrente, 0);
  const valoreFinale = portafoglio.reduce(
    (acc, s, i) => acc + (s.quoteAttuali + output.acquisti[i]!.quoteAcquistare) * s.prezzoCorrente,
    0,
  );

  // Calcoli Fineco (opzionali)
  const valoreFinaleFineco = finecoAcquisti
    ? portafoglio.reduce((acc, s, i) => acc + (s.quoteAttuali + finecoAcquisti[i]!) * s.prezzoCorrente, 0)
    : undefined;
  const totaleSpeso = portafoglio.reduce(
    (acc, s, i) => acc + output.acquisti[i]!.quoteAcquistare * s.prezzoCorrente,
    0,
  );
  const totaleSpestoFineco = finecoAcquisti
    ? portafoglio.reduce((acc, s, i) => acc + finecoAcquisti[i]! * s.prezzoCorrente, 0)
    : undefined;
  const budget = totaleSpeso + output.budgetNonSpeso;

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

    // Colonne Fineco (calcolate solo se presenti)
    const quoteFinaliFineco = finecoAcquisti ? s.quoteAttuali + finecoAcquisti[i]! : undefined;
    const costoFineco = finecoAcquisti ? finecoAcquisti[i]! * s.prezzoCorrente : undefined;
    const valoreFinFineco = quoteFinaliFineco !== undefined ? quoteFinaliFineco * s.prezzoCorrente : undefined;
    const pesoFinFineco =
      valoreFinaleFineco !== undefined && valoreFinaleFineco > 0 && valoreFinFineco !== undefined
        ? valoreFinFineco / valoreFinaleFineco
        : undefined;
    const devFinEuroFineco =
      valoreFinFineco !== undefined && valoreFinaleFineco !== undefined
        ? Math.abs(valoreFinFineco - s.pesoTarget * valoreFinaleFineco)
        : undefined;
    const devFinPercFineco =
      pesoFinFineco !== undefined ? Math.abs(pesoFinFineco - s.pesoTarget) : undefined;

    return {
      ticker: acquisto.ticker,
      // Tabella Quote
      attuali: String(s.quoteAttuali),
      acquistateCosto: `${acquisto.quoteAcquistare} (${costo.toFixed(2)}€)`,
      finali: String(quoteFinali),
      acquistateFinecoCosto:
        costoFineco !== undefined && quoteFinaliFineco !== undefined
          ? `${finecoAcquisti![i]!} (${costoFineco.toFixed(2)}€)`
          : undefined,
      finaliFineco: quoteFinaliFineco !== undefined ? String(quoteFinaliFineco) : undefined,
      // Tabella Pesi
      pesoAttuale,
      pesoTarget: `${(s.pesoTarget * 100).toFixed(2)}%`,
      pesoFinale: `${(pesoFin * 100).toFixed(2)}%`,
      pesoFinaleFineco:
        pesoFinFineco !== undefined ? `${(pesoFinFineco * 100).toFixed(2)}%` : undefined,
      // Tabella Deviazioni
      devAttuale,
      devFinale: `${devFinEuro.toFixed(2)}€ (${(devFinPerc * 100).toFixed(1)}%)`,
      devFinaleFineco:
        devFinEuroFineco !== undefined && devFinPercFineco !== undefined
          ? `${devFinEuroFineco.toFixed(2)}€ (${(devFinPercFineco * 100).toFixed(1)}%)`
          : undefined,
    };
  });

  const sep = (n: number) => "-".repeat(n);
  const col = (s: string, n: number) => s.padStart(n);

  // --- Tabella Quote ---
  const HDR_Q = {
    strumento: "Strumento",
    attuali: "Quote Attuali",
    acquistateCosto: "Acquistate (Costo)",
    acquistateFinecoCosto: "Acquistate Fineco (Costo)",
    finali: "Quote Finali",
    finaliFineco: "Quote Finali Fineco",
  };
  const wQ = {
    strumento: Math.max(HDR_Q.strumento.length, ...datiRighe.map((r) => r.ticker.length)),
    attuali: Math.max(HDR_Q.attuali.length, ...datiRighe.map((r) => r.attuali.length)),
    acquistateCosto: Math.max(HDR_Q.acquistateCosto.length, ...datiRighe.map((r) => r.acquistateCosto.length)),
    acquistateFinecoCosto: finecoAcquisti
      ? Math.max(HDR_Q.acquistateFinecoCosto.length, ...datiRighe.map((r) => r.acquistateFinecoCosto?.length ?? 0))
      : 0,
    finali: Math.max(HDR_Q.finali.length, ...datiRighe.map((r) => r.finali.length)),
    finaliFineco: finecoAcquisti
      ? Math.max(HDR_Q.finaliFineco.length, ...datiRighe.map((r) => r.finaliFineco?.length ?? 0))
      : 0,
  };

  const colFineco = (s: string | undefined, w: number) => (s !== undefined ? ` | ${col(s, w)}` : "");

  const headerQ =
    `${HDR_Q.strumento.padEnd(wQ.strumento)} | ${col(HDR_Q.attuali, wQ.attuali)} | ` +
    `${col(HDR_Q.acquistateCosto, wQ.acquistateCosto)}` +
    (finecoAcquisti ? ` | ${col(HDR_Q.acquistateFinecoCosto, wQ.acquistateFinecoCosto)}` : "") +
    ` | ${col(HDR_Q.finali, wQ.finali)}` +
    (finecoAcquisti ? ` | ${col(HDR_Q.finaliFineco, wQ.finaliFineco)}` : "");
  const separatoreQ =
    `${sep(wQ.strumento)}-|-${sep(wQ.attuali)}-|-${sep(wQ.acquistateCosto)}` +
    (finecoAcquisti ? `-|-${sep(wQ.acquistateFinecoCosto)}` : "") +
    `-|-${sep(wQ.finali)}` +
    (finecoAcquisti ? `-|-${sep(wQ.finaliFineco)}` : "");
  const righeQ = datiRighe.map(
    (r) =>
      `${r.ticker.padEnd(wQ.strumento)} | ${col(r.attuali, wQ.attuali)} | ` +
      `${col(r.acquistateCosto, wQ.acquistateCosto)}` +
      colFineco(r.acquistateFinecoCosto, wQ.acquistateFinecoCosto) +
      ` | ${col(r.finali, wQ.finali)}` +
      colFineco(r.finaliFineco, wQ.finaliFineco),
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
    pesoFinaleFineco: "Peso Finale Fineco",
  };
  const wP = {
    strumento: Math.max(HDR_P.strumento.length, ...datiRighe.map((r) => r.ticker.length)),
    pesoAttuale: Math.max(HDR_P.pesoAttuale.length, ...datiRighe.map((r) => r.pesoAttuale.length)),
    pesoTarget: Math.max(HDR_P.pesoTarget.length, ...datiRighe.map((r) => r.pesoTarget.length)),
    pesoFinale: Math.max(HDR_P.pesoFinale.length, ...datiRighe.map((r) => r.pesoFinale.length)),
    pesoFinaleFineco: finecoAcquisti
      ? Math.max(HDR_P.pesoFinaleFineco.length, ...datiRighe.map((r) => r.pesoFinaleFineco?.length ?? 0))
      : 0,
  };
  const headerP =
    `${HDR_P.strumento.padEnd(wP.strumento)} | ${col(HDR_P.pesoAttuale, wP.pesoAttuale)} | ` +
    `${col(HDR_P.pesoTarget, wP.pesoTarget)} | ${col(HDR_P.pesoFinale, wP.pesoFinale)}` +
    (finecoAcquisti ? ` | ${col(HDR_P.pesoFinaleFineco, wP.pesoFinaleFineco)}` : "");
  const separatoreP =
    `${sep(wP.strumento)}-|-${sep(wP.pesoAttuale)}-|-${sep(wP.pesoTarget)}-|-${sep(wP.pesoFinale)}` +
    (finecoAcquisti ? `-|-${sep(wP.pesoFinaleFineco)}` : "");
  const righeP = datiRighe.map(
    (r) =>
      `${r.ticker.padEnd(wP.strumento)} | ${col(r.pesoAttuale, wP.pesoAttuale)} | ` +
      `${col(r.pesoTarget, wP.pesoTarget)} | ${col(r.pesoFinale, wP.pesoFinale)}` +
      colFineco(r.pesoFinaleFineco, wP.pesoFinaleFineco),
  );

  // --- Tabella Deviazioni ---
  const HDR_D = {
    strumento: "Strumento",
    devAttuale: "Dev Attuale",
    devFinale: "Dev Finale",
    devFinaleFineco: "Dev Finale Fineco",
  };
  const wD = {
    strumento: Math.max(HDR_D.strumento.length, ...datiRighe.map((r) => r.ticker.length)),
    devAttuale: Math.max(HDR_D.devAttuale.length, ...datiRighe.map((r) => r.devAttuale.length)),
    devFinale: Math.max(HDR_D.devFinale.length, ...datiRighe.map((r) => r.devFinale.length)),
    devFinaleFineco: finecoAcquisti
      ? Math.max(HDR_D.devFinaleFineco.length, ...datiRighe.map((r) => r.devFinaleFineco?.length ?? 0))
      : 0,
  };
  const headerD =
    `${HDR_D.strumento.padEnd(wD.strumento)} | ${col(HDR_D.devAttuale, wD.devAttuale)} | ` +
    `${col(HDR_D.devFinale, wD.devFinale)}` +
    (finecoAcquisti ? ` | ${col(HDR_D.devFinaleFineco, wD.devFinaleFineco)}` : "");
  const separatoreD =
    `${sep(wD.strumento)}-|-${sep(wD.devAttuale)}-|-${sep(wD.devFinale)}` +
    (finecoAcquisti ? `-|-${sep(wD.devFinaleFineco)}` : "");
  const righeD = datiRighe.map(
    (r) =>
      `${r.ticker.padEnd(wD.strumento)} | ${col(r.devAttuale, wD.devAttuale)} | ` +
      `${col(r.devFinale, wD.devFinale)}` +
      colFineco(r.devFinaleFineco, wD.devFinaleFineco),
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

  // --- Riepilogo comparativo (solo con Fineco) ---
  const deviazioneFinecoTotale =
    finecoAcquisti && valoreFinaleFineco !== undefined
      ? portafoglio.reduce((acc, s, i) => {
          const valFin = (s.quoteAttuali + finecoAcquisti[i]!) * s.prezzoCorrente;
          return acc + Math.abs(valFin - s.pesoTarget * valoreFinaleFineco);
        }, 0)
      : undefined;

  const righeRiepilogo: string[] = [];
  if (finecoAcquisti && totaleSpestoFineco !== undefined && deviazioneFinecoTotale !== undefined) {
    const budgetNonSpesoFineco = budget - totaleSpestoFineco;
    const colLabel = 28;
    const colAlgo = 16;
    const colFin = 12;
    const intestazione =
      `${"".padEnd(colLabel)}${"Mio Algoritmo".padStart(colAlgo)}${"Fineco".padStart(colFin)}`;
    const rigaRiepilogo = (label: string, valAlgo: string, valFin: string) =>
      `${label.padEnd(colLabel)}${valAlgo.padStart(colAlgo)}${valFin.padStart(colFin)}`;
    righeRiepilogo.push(
      intestazione,
      rigaRiepilogo("Totale speso:", `${totaleSpeso.toFixed(2)}€`, `${totaleSpestoFineco.toFixed(2)}€`),
      rigaRiepilogo("Budget Non Speso (U):", `${output.budgetNonSpeso.toFixed(2)}€`, `${budgetNonSpesoFineco.toFixed(2)}€`),
      rigaRiepilogo("Deviazione finale (D_€):", `${output.deviazione.toFixed(2)}€`, `${deviazioneFinecoTotale.toFixed(2)}€`),
    );
  }

  const intestazioneData = dataIterazione
    ? [`Iterazione del ${dataIterazione.toISOString().slice(0, 10)}`, ""]
    : [];

  return [
    ...intestazioneData,
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
    ...(righeRiepilogo.length > 0 ? ["", ...righeRiepilogo] : []),
  ].join("\n");
}

export async function eseguiScenario(scenario: Scenario): Promise<string> {
  let portafoglio: InputIterazione["portafoglio"];

  if (scenario.dataIterazione !== undefined) {
    const data = scenario.dataIterazione;
    const quotazioni = await Promise.all(
      scenario.strumenti.map((s) => prezziPerDate(s.ticker, [data])),
    );
    portafoglio = scenario.strumenti.map((s, i) => ({
      ticker: s.ticker,
      prezzoCorrente: quotazioni[i]![0]!.prezzo,
      quoteAttuali: s.quoteAttuali,
      pesoTarget: s.pesoTarget,
    }));
  } else {
    portafoglio = await Promise.all(
      scenario.strumenti.map(async (s) => ({
        ticker: s.ticker,
        prezzoCorrente: await prezzoCorrente(s.ticker),
        quoteAttuali: s.quoteAttuali,
        pesoTarget: s.pesoTarget,
      })),
    );
  }

  const finecoAcquisti = scenario.strumenti[0]?.quoteAcquistateFineco !== undefined
    ? scenario.strumenti.map((s) => s.quoteAcquistateFineco!)
    : undefined;

  const output = decideIterazione({ portafoglio, budget: scenario.budget, alfa: scenario.alfa });
  return formattaOutput(output, portafoglio, finecoAcquisti, scenario.dataIterazione);
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
