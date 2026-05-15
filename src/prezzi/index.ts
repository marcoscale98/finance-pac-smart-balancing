import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

export interface Quotazione {
  data: Date;
  prezzo: number;
}

export async function prezzoCorrente(ticker: string): Promise<number> {
  const risultato = await yf.quote(ticker);
  return risultato.regularMarketPrice!;
}

export async function prezziPerDate(ticker: string, date: Date[]): Promise<Quotazione[]> {
  if (date.length === 0) return [];

  const da = new Date(Math.min(...date.map((d) => d.getTime())));
  const a = new Date(Math.max(...date.map((d) => d.getTime())));

  const risultato = await yf.chart(ticker, {
    period1: da,
    period2: a,
    interval: "1d",
  });

  const candele = risultato.quotes;

  return date.map((dataRichiesta) => {
    const piuVicina = candele.reduce((migliore, riga) => {
      const distMigliore = Math.abs(migliore.date.getTime() - dataRichiesta.getTime());
      const distRiga = Math.abs(riga.date.getTime() - dataRichiesta.getTime());
      return distRiga < distMigliore ? riga : migliore;
    });
    return { data: piuVicina.date, prezzo: piuVicina.close! };
  });
}
