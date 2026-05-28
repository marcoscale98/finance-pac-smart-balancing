import { readFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { parseScenarioCompleto } from "./scenarios/index.js";
import { simula, type ScenarioSimulazione } from "./simulatore/index.js";
import { generateReport } from "./report/index.js";
import { prezziPerDate } from "./prezzi/index.js";
import { parseStoricoAcquistiFineco } from "./storico-fineco/index.js";

interface OpzioniOverride {
  budget?: number;
  alfa?: number;
  durataInMesi?: number;
  grigliaDiAlfa?: number[];
  dataInizio?: string;
  percorsoTransazioniFineco?: string;
}

function scenariDisponibili(): string[] {
  return readdirSync("scenarios")
    .filter((f) => f.endsWith(".json"))
    .sort();
}

async function simulaFile(percorso: string, override: OpzioniOverride = {}): Promise<void> {
  const nome = basename(percorso, ".json");
  console.log(`\nSimulazione: ${nome}`);

  const json = readFileSync(percorso, "utf-8");
  const base = JSON.parse(json) as Record<string, unknown>;

  if (override.budget !== undefined) base.budget = override.budget;
  if (override.alfa !== undefined) base.alfa = override.alfa;
  if (override.durataInMesi !== undefined) base.durataInMesi = override.durataInMesi;
  if (override.grigliaDiAlfa !== undefined) base.grigliaDiAlfa = override.grigliaDiAlfa;
  if (override.dataInizio !== undefined) base.dataInizio = override.dataInizio;
  if (override.percorsoTransazioniFineco !== undefined)
    base.percorsoTransazioniFineco = override.percorsoTransazioniFineco;

  const scenarioRaw = parseScenarioCompleto(JSON.stringify(base));

  const scenarioSimulazione: ScenarioSimulazione = {
    portafoglioIniziale: scenarioRaw.strumenti.map((s) => ({
      ticker: s.ticker,
      pesoTarget: s.pesoTarget,
      quoteAttuali: s.quoteAttuali,
      prezzoCorrente: 0,
    })),
    budget: scenarioRaw.budget,
    durataInMesi: scenarioRaw.durataInMesi,
    grigliaDiAlfa: scenarioRaw.grigliaDiAlfa,
    dataInizio: scenarioRaw.dataInizio,
  };

  let acquisizioniFineco: Map<string, Record<string, number>> | undefined;
  if (scenarioRaw.percorsoTransazioniFineco) {
    const csvPath = resolve(scenarioRaw.percorsoTransazioniFineco);
    const csv = readFileSync(csvPath, "utf-8");
    acquisizioniFineco = parseStoricoAcquistiFineco(csv);
  }

  const risultato = await simula(scenarioSimulazione, prezziPerDate, acquisizioniFineco);
  const outputPath = resolve("output", `${nome}.html`);
  await generateReport(risultato, outputPath);
  console.log(`  → ${outputPath}`);
}

new Command()
  .name("simulazione")
  .description("Simula N iterazioni mensili e genera un report HTML in output/")
  .argument("[scenario]", "Percorso al file scenario JSON (senza arg: menu interattivo)")
  .option("--all", "Esegue tutti gli scenari in scenarios/")
  .option("--budget <n>", "Sovrascrive budget mensile in euro", parseFloat)
  .option("--alfa <n>", "Sovrascrive alfa (0–1)", parseFloat)
  .option("--durataInMesi <n>", "Sovrascrive durataInMesi", (v) => parseInt(v, 10))
  .option("--grigliaDiAlfa <json>", "Sovrascrive grigliaDiAlfa (array JSON)", (v) => JSON.parse(v) as number[])
  .option("--dataInizio <YYYY-MM-DD>", "Sovrascrive dataInizio")
  .option("--percorsoTransazioniFineco <path>", "Sovrascrive percorsoTransazioniFineco")
  .action(async (scenario: string | undefined, opzioni: OpzioniOverride & { all?: boolean }) => {
    mkdirSync("output", { recursive: true });

    if (opzioni.all) {
      let generati = 0;
      for (const file of scenariDisponibili()) {
        try {
          await simulaFile(resolve("scenarios", file));
          generati++;
        } catch (err) {
          console.warn(`  ⚠ Saltato (${err instanceof Error ? err.message : err})`);
        }
      }
      console.log(`\nReport generati in output/ (${generati} su ${scenariDisponibili().length})`);
      return;
    }

    if (scenario) {
      await simulaFile(resolve(scenario), opzioni);
      return;
    }

    const files = scenariDisponibili();
    files.forEach((f, i) => console.log(`  ${i + 1}. ${basename(f, ".json")}`));

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const risposta = await rl.question("\nScenario (numero): ");
    rl.close();

    const idx = parseInt(risposta, 10) - 1;
    const file = files[idx];
    if (isNaN(idx) || !file) {
      console.error("Scelta non valida.");
      process.exit(1);
    }

    await simulaFile(resolve("scenarios", file));
  })
  .parseAsync(process.argv)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
