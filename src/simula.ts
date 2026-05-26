import { readFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseScenarioCompleto } from "./scenarios/index.js";
import { simula, type ScenarioSimulazione } from "./simulatore/index.js";
import { generateReport } from "./report/index.js";
import { prezziPerDate } from "./prezzi/index.js";

function scenariDisponibili(): string[] {
  return readdirSync("scenarios")
    .filter((f) => f.endsWith(".json"))
    .sort();
}

async function simulaFile(percorso: string): Promise<void> {
  const nome = basename(percorso, ".json");
  console.log(`\nSimulazione: ${nome}`);

  const json = readFileSync(percorso, "utf-8");
  const scenarioRaw = parseScenarioCompleto(json);

  const scenarioSimulazione: ScenarioSimulazione = {
    portafoglioIniziale: scenarioRaw.strumenti.map((s) => ({
      ticker: s.ticker,
      pesoTarget: s.pesoTarget,
      quoteDetenute: s.quoteDetenute,
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
    for (const file of scenariDisponibili())
      await simulaFile(resolve("scenarios", file));
    console.log("\nReport generati in output/");
    return;
  }

  if (arg) {
    await simulaFile(resolve(arg));
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
