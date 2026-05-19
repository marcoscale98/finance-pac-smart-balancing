import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const ticker = process.argv[2];
if (!ticker) {
  console.error("Uso: npm run listino <ticker>");
  process.exit(1);
}

const risultato = await yf.chart(ticker, {
  period1: new Date("2000-01-01"),
  period2: new Date(),
  interval: "1mo",
});

const prima = risultato.quotes[0]?.date;
if (!prima) {
  console.log(`${ticker}: nessun dato disponibile su Yahoo Finance`);
} else {
  console.log(`${ticker}: prima quotazione disponibile = ${prima.toISOString().slice(0, 10)}`);
}
