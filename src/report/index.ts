import { writeFile } from "fs/promises";
import type { SimulationResult } from "../simulatore/index.js";

const COLORI = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"];

export async function generateReport(
  result: SimulationResult,
  outputPath: string,
): Promise<void> {
  const html = buildHtml(result);
  await writeFile(outputPath, html, "utf-8");
}

export { buildHtml };

function etichette(result: SimulationResult): string[] {
  const prima = result.serieAlfa[0];
  if (!prima || prima.mesi.length === 0) return [];
  return prima.mesi.map((m) =>
    m.data.toLocaleDateString("it-IT", { year: "numeric", month: "short" }),
  );
}

function dataset(
  label: string,
  dati: number[],
  colore: string,
  opzioni: Record<string, unknown> = {},
) {
  return JSON.stringify({
    label,
    data: dati,
    borderColor: colore,
    backgroundColor: colore + "33",
    borderWidth: 2,
    pointRadius: 3,
    tension: 0.3,
    fill: false,
    ...opzioni,
  });
}

function grafico(id: string, titolo: string, datasetsJs: string, labelY: string, didascalia?: string): string {
  return `
    <div class="chart-wrap">
      <h2>${titolo}</h2>
      ${didascalia ? `<p class="didascalia">${didascalia}</p>` : ""}
      <canvas id="${id}"></canvas>
    </div>
    <script>
      new Chart(document.getElementById('${id}'), {
        type: 'line',
        data: {
          labels: ETICHETTE,
          datasets: [${datasetsJs}]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'top' } },
          scales: {
            y: {
              title: { display: true, text: '${labelY}' }
            }
          }
        }
      });
    </script>`;
}

function buildHtml(result: SimulationResult): string {
  const labels = etichette(result);
  const { serieAlfa, serieFineco } = result;

  const dsFineco = serieFineco
    ? dataset("Fineco", serieFineco.map((m) => Math.round(m.valorePortafoglio * 100) / 100), "#000000")
    : null;
  const dsFinecoSpesa = serieFineco
    ? dataset("Fineco", serieFineco.map((m) => Math.round(m.spesaCumulativa * 100) / 100), "#000000")
    : null;
  const dsFinecoBudgetNonSpeso = serieFineco
    ? dataset("Fineco", serieFineco.map((m) => Math.round(m.budgetNonSpeso * 100) / 100), "#000000")
    : null;
  const dsFinecoDeviazione = serieFineco
    ? dataset("Fineco", serieFineco.map((m) => Math.round(m.deviazioneMedia * 100) / 100), "#000000")
    : null;
  const dsFinecoDeviazionePerc = serieFineco
    ? dataset("Fineco", serieFineco.map((m) => Math.round(m.deviazioneMediaPercentuale * 10000) / 100), "#000000")
    : null;

  // Grafico 1: Valore portafoglio
  const dsValore = [
    ...serieAlfa.map((serie, i) =>
      dataset(
        `α = ${serie.alfa}`,
        serie.mesi.map((m) => Math.round(m.valorePortafoglio * 100) / 100),
        COLORI[i % COLORI.length]!,
      ),
    ),
    ...(dsFineco ? [dsFineco] : []),
  ].join(",\n");

  // Grafico 2: Budget cumulativo teorico vs effettivo
  const budgetTeorico =
    serieAlfa[0]?.mesi.map((m) => Math.round(m.budgetTeoricoConsumato * 100) / 100) ?? [];
  const dsTeoricoBase = dataset("Budget teorico", budgetTeorico, "#6b7280", {
    borderDash: [6, 3],
  });
  const dsEffettivi = serieAlfa
    .map((serie, i) =>
      dataset(
        `Effettivo α = ${serie.alfa}`,
        serie.mesi.map((m) => Math.round(m.spesaCumulativa * 100) / 100),
        COLORI[i % COLORI.length]!,
      ),
    )
    .join(",\n");
  const dsBudget = [dsTeoricoBase, dsEffettivi, ...(dsFinecoSpesa ? [dsFinecoSpesa] : [])].join(",\n");

  // Grafico 3: Budget non speso mensile
  const dsBudgetNonSpeso = [
    ...serieAlfa.map((serie, i) =>
      dataset(
        `α = ${serie.alfa}`,
        serie.mesi.map((m) => Math.round(m.budgetNonSpeso * 100) / 100),
        COLORI[i % COLORI.length]!,
      ),
    ),
    ...(dsFinecoBudgetNonSpeso ? [dsFinecoBudgetNonSpeso] : []),
  ].join(",\n");

  // Grafico 4: Deviazione media in euro
  const dsDeviazione = [
    ...serieAlfa.map((serie, i) =>
      dataset(
        `α = ${serie.alfa}`,
        serie.mesi.map((m) => Math.round(m.deviazioneMedia * 100) / 100),
        COLORI[i % COLORI.length]!,
      ),
    ),
    ...(dsFinecoDeviazione ? [dsFinecoDeviazione] : []),
  ].join(",\n");

  // Grafico 5: Deviazione media percentuale
  const dsDeviazionePerc = [
    ...serieAlfa.map((serie, i) =>
      dataset(
        `α = ${serie.alfa}`,
        serie.mesi.map((m) => Math.round(m.deviazioneMediaPercentuale * 10000) / 100),
        COLORI[i % COLORI.length]!,
      ),
    ),
    ...(dsFinecoDeviazionePerc ? [dsFinecoDeviazionePerc] : []),
  ].join(",\n");

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>PAC Smart Balancing — Report Simulazione</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f8fafc; color: #1e293b; padding: 2rem; }
    h1 { margin-bottom: 1.5rem; font-size: 1.5rem; }
    .leggenda { background: #fff; border-radius: 8px; padding: 1.25rem 1.5rem; margin-bottom: 2rem;
                box-shadow: 0 1px 3px rgba(0,0,0,.1); max-width: 900px;
                border-left: 4px solid #3b82f6; }
    .leggenda h2 { font-size: 1rem; margin-bottom: 0.75rem; color: #1e293b; }
    .leggenda dl { display: grid; grid-template-columns: auto 1fr; gap: 0.4rem 1rem; font-size: 0.9rem; }
    .leggenda dt { font-weight: 600; color: #3b82f6; white-space: nowrap; }
    .leggenda dd { color: #475569; }
    .chart-wrap { background: #fff; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;
                  box-shadow: 0 1px 3px rgba(0,0,0,.1); max-width: 900px; }
    h2 { font-size: 1.1rem; margin-bottom: 0.5rem; color: #475569; }
    .didascalia { font-size: 0.82rem; color: #94a3b8; margin-bottom: 1rem; font-style: italic; }
  </style>
</head>
<body>
  <h1>PAC Smart Balancing — Report Simulazione</h1>
  <div class="leggenda">
    <h2>Parametro α — Preferenza Utente</h2>
    <dl>
      <dt>α vicino a 0</dt>
      <dd>Priorità al <strong>budget speso</strong>: il sistema investe quasi tutto il budget disponibile ogni mese, anche a costo di allontanarsi dai pesi target. Ideale se vuoi che il capitale lavori subito.</dd>
      <dt>α vicino a 1</dt>
      <dd>Priorità al <strong>bilanciamento</strong>: il sistema acquista solo ciò che riduce la deviazione dai pesi target, anche se questo significa spendere meno del budget. Ideale se vuoi mantenere l'allocazione il più possibile fedele alla strategia.</dd>
    </dl>
  </div>
  <script>const ETICHETTE = ${JSON.stringify(labels)};</script>
  ${grafico("g1", "Valore del portafoglio nel tempo", dsValore, "€")}
  ${grafico("g2", "Budget cumulativo: teorico vs speso", dsBudget, "€")}
  ${grafico("g3", "Budget non speso per mese", dsBudgetNonSpeso, "€")}
  ${grafico("g4", "Deviazione media dai target nel tempo (€)", dsDeviazione, "€ (media per strumento)", "Scostamento medio in euro tra il Valore Finale e il Valore Target di ciascuno strumento. Il Valore Target è la quota del portafoglio che lo strumento dovrebbe occupare secondo l'Allocazione Target (es. 40% World, 30% S&amp;P500…).")}
  ${grafico("g5", "Deviazione media dai target nel tempo (%)", dsDeviazionePerc, "% (media per strumento)", "Stesso scostamento del grafico precedente, espresso in punti percentuali rispetto al valore totale del portafoglio — equivale alla differenza media tra Peso Finale e Peso Target di ciascuno strumento.")}
</body>
</html>`;
}
