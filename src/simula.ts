import { readFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseScenarioCompleto } from "./scenarios/index.js";
import { simula, type ScenarioSimulazione } from "./simulatore/index.js";
import { generateReport } from "./report/index.js";
import { prezziPerDate } from "./prezzi/index.js";
import { applicaOverrideCli } from "./cli/override.js";

function scenariDisponibili(): string[] {
  return readdirSync("scenarios")
    .filter((f) => f.endsWith(".json"))
    .sort();
}

async function simulaFile(percorso: string, overrideArgs: string[] = []): Promise<void> {
  const nome = basename(percorso, ".json");
  console.log(`\nSimulazione: ${nome}`);

  const json = readFileSync(percorso, "utf-8");
  const base = JSON.parse(json) as Record<string, unknown>;
  const merged = applicaOverrideCli(base, overrideArgs);
  const scenarioRaw = parseScenarioCompleto(JSON.stringify(merged));

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

  const risultato = await simula(scenarioSimulazione, prezziPerDate);
  const outputPath = resolve("output", `${nome}.html`);
  await generateReport(risultato, outputPath);
  console.log(`  → ${outputPath}`);
}

async function main() {
  mkdirSync("output", { recursive: true });
  const arg = process.argv[2];

  if (arg === "--all") {
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

  if (arg) {
    const overrideArgs = process.argv.slice(3);
    await simulaFile(resolve(arg), overrideArgs);
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
