import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseScenarioCompleto } from "./scenarios/index.js";
import { simula, type ScenarioSimulazione } from "./simulatore/index.js";
import { generateReport } from "./report/index.js";
import { prezziPerDate } from "./prezzi/index.js";

const SCENARI = [
  "scenario1-marco",
  "scenario2-marco-gold-costoso",
  "scenario3-all-equity",
  "scenario4-strumenti-costosi",
];

async function main() {
  mkdirSync("output", { recursive: true });

  for (const nome of SCENARI) {
    const percorso = resolve("scenarios", `${nome}.json`);
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

  console.log("\nReport generati in output/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
