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

export interface SimulationResult {
  serieAlfa: SerieAlfa[];
  serieFineco?: MetricaMensile[];
  puntoInizio: MetricaMensile;
}

type FnPrezziPerDate = (ticker: string, date: Date[]) => Promise<Quotazione[]>;

function annoMese(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function calcolaDeviazione(portafoglio: Strumento[], valorePortafoglio: number): number {
  return portafoglio.reduce((acc, s) => {
    const valoreEffettivo = s.quoteAttuali * s.prezzoCorrente;
    const valoreTarget = s.pesoTarget * valorePortafoglio;
    return acc + Math.abs(valoreEffettivo - valoreTarget);
  }, 0);
}

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

async function simulaFineco(
  scenario: ScenarioSimulazione,
  date: Date[],
  prezziPerDate: FnPrezziPerDate,
  acquisizioniFineco: Map<string, Record<string, number>>,
): Promise<MetricaMensile[]> {
  let portafoglio: Strumento[] = scenario.portafoglioIniziale.map((s) => ({ ...s }));
  const mesi: MetricaMensile[] = [];
  let spesaCumulativa = 0;

  for (let i = 0; i < date.length; i++) {
    const dataNominale = date[i]!;
    const chiave = annoMese(dataNominale);
    const acquistiMese = acquisizioniFineco.get(chiave);

    if (!acquistiMese) break;

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

    const spesaMese = portafoglio.reduce((acc, s) => {
      return acc + (acquistiMese[s.ticker] ?? 0) * s.prezzoCorrente;
    }, 0);

    portafoglio = portafoglio.map((s) => ({
      ...s,
      quoteAttuali: s.quoteAttuali + (acquistiMese[s.ticker] ?? 0),
    }));

    spesaCumulativa += spesaMese;

    const valorePortafoglio = portafoglio.reduce(
      (acc, s) => acc + s.quoteAttuali * s.prezzoCorrente,
      0,
    );

    const deviazione = calcolaDeviazione(portafoglio, valorePortafoglio);
    const dataEffettiva = quotazioni[portafoglio[0]!.ticker]!.data;

    mesi.push({
      data: dataEffettiva,
      valorePortafoglio,
      spesaCumulativa,
      budgetTeoricoConsumato: (i + 1) * scenario.budget,
      budgetNonSpeso: Math.max(0, scenario.budget - spesaMese),
      deviazioneMedia: deviazione / portafoglio.length,
      deviazioneMediaPercentuale: valorePortafoglio > 0
        ? (deviazione / valorePortafoglio) / portafoglio.length
        : 0,
    });
  }

  return mesi;
}

async function calcolaPuntoInizio(
  scenario: ScenarioSimulazione,
  prezziPerDate: FnPrezziPerDate,
): Promise<MetricaMensile> {
  const dataNominale = new Date(scenario.dataInizio);
  dataNominale.setMonth(dataNominale.getMonth() - 1);

  const quotazioni: Record<string, Quotazione> = {};
  for (const s of scenario.portafoglioIniziale) {
    const risultati = await prezziPerDate(s.ticker, [dataNominale]);
    if (risultati.length === 0) {
      throw new Error(`Prezzo mancante per ${s.ticker} al ${dataNominale.toISOString()}`);
    }
    quotazioni[s.ticker] = risultati[0]!;
  }

  const dataEffettiva = quotazioni[scenario.portafoglioIniziale[0]!.ticker]!.data;
  const portafoglio = scenario.portafoglioIniziale.map((s) => ({
    ...s,
    prezzoCorrente: quotazioni[s.ticker]!.prezzo,
  }));
  const valorePortafoglio = portafoglio.reduce(
    (acc, s) => acc + s.quoteAttuali * s.prezzoCorrente,
    0,
  );
  const deviazione = calcolaDeviazione(portafoglio, valorePortafoglio);

  return {
    data: dataEffettiva,
    valorePortafoglio,
    spesaCumulativa: 0,
    budgetTeoricoConsumato: 0,
    budgetNonSpeso: 0,
    deviazioneMedia: portafoglio.length > 0 ? deviazione / portafoglio.length : 0,
    deviazioneMediaPercentuale: valorePortafoglio > 0
      ? (deviazione / valorePortafoglio) / portafoglio.length
      : 0,
  };
}

export async function simula(
  scenario: ScenarioSimulazione,
  prezziPerDate: FnPrezziPerDate,
  acquisizioniFineco?: Map<string, Record<string, number>>,
): Promise<SimulationResult> {
  const date = dateIterazioni(scenario.dataInizio, scenario.durataInMesi);
  const [serieAlfa, puntoInizio] = await Promise.all([
    Promise.all(scenario.grigliaDiAlfa.map((alfa) => simulaSerie(alfa, scenario, date, prezziPerDate))),
    calcolaPuntoInizio(scenario, prezziPerDate),
  ]);
  if (!acquisizioniFineco) return { serieAlfa, puntoInizio };
  const serieFineco = await simulaFineco(scenario, date, prezziPerDate, acquisizioniFineco);
  return { serieAlfa, serieFineco, puntoInizio };
}
