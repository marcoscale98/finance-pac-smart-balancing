import { decideIterazione } from "../core/index.js";
import type { Strumento } from "../core/index.js";
import type { Quotazione } from "../prezzi/index.js";

export interface ScenarioSimulazione {
  portafoglioIniziale: Strumento[];
  budget: number;
  durataInMesi: number;
  grigliaDiAlfa: number[];
  dataInizio: Date;
}

export interface MetricaMensile {
  data: Date;
  valorePortafoglio: number;
  spesaCumulativa: number;
  budgetTeoricoConsumato: number;
  budgetNonSpeso: number;
  deviazioneMedia: number;
  deviazioneMediaPercentuale: number;
}

export interface SerieAlfa {
  alfa: number;
  mesi: MetricaMensile[];
}

export type SimulationResult = SerieAlfa[];

type FnPrezziPerDate = (ticker: string, date: Date[]) => Promise<Quotazione[]>;

function dateIterazioni(dataInizio: Date, durataInMesi: number): Date[] {
  return Array.from({ length: durataInMesi }, (_, i) => {
    const d = new Date(dataInizio);
    d.setMonth(d.getMonth() + i);
    return d;
  });
}

async function simulaSerie(
  alfa: number,
  scenario: ScenarioSimulazione,
  date: Date[],
  prezziPerDate: FnPrezziPerDate,
): Promise<SerieAlfa> {
  let portafoglio: Strumento[] = scenario.portafoglioIniziale.map((s) => ({ ...s }));
  const mesi: MetricaMensile[] = [];
  let spesaCumulativa = 0;

  for (let i = 0; i < date.length; i++) {
    const dataNominale = date[i]!;

    const quotazioni: Record<string, Quotazione> = {};
    for (const s of portafoglio) {
      const risultati = await prezziPerDate(s.ticker, [dataNominale]);
      if (risultati.length === 0) {
        throw new Error(`Prezzo mancante per ${s.ticker} al ${dataNominale.toISOString()}`);
      }
      quotazioni[s.ticker] = risultati[0]!;
    }

    portafoglio = portafoglio.map((s) => ({
      ...s,
      prezzoCorrente: quotazioni[s.ticker]!.prezzo,
    }));

    const dataEffettiva = quotazioni[portafoglio[0]!.ticker]!.data;

    const output = decideIterazione({ portafoglio, budget: scenario.budget, alfa });

    portafoglio = portafoglio.map((s) => {
      const acquisto = output.acquisti.find((a) => a.ticker === s.ticker)!;
      return { ...s, quoteAttuali: s.quoteAttuali + acquisto.quoteAcquistare };
    });

    spesaCumulativa += scenario.budget - output.budgetNonSpeso;

    const valorePortafoglio = portafoglio.reduce(
      (acc, s) => acc + s.quoteAttuali * s.prezzoCorrente,
      0,
    );

    mesi.push({
      data: dataEffettiva,
      valorePortafoglio,
      spesaCumulativa,
      budgetTeoricoConsumato: (i + 1) * scenario.budget,
      budgetNonSpeso: output.budgetNonSpeso,
      deviazioneMedia: output.deviazione / portafoglio.length,
      deviazioneMediaPercentuale: valorePortafoglio > 0
        ? (output.deviazione / valorePortafoglio) / portafoglio.length
        : 0,
    });
  }

  return { alfa, mesi };
}

export async function simula(
  scenario: ScenarioSimulazione,
  prezziPerDate: FnPrezziPerDate,
): Promise<SimulationResult> {
  const date = dateIterazioni(scenario.dataInizio, scenario.durataInMesi);
  return Promise.all(
    scenario.grigliaDiAlfa.map((alfa) => simulaSerie(alfa, scenario, date, prezziPerDate)),
  );
}
