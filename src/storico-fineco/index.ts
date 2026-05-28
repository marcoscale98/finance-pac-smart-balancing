export function parseStoricoAcquistiFineco(csv: string): Map<string, Record<string, number>> {
  const righe = csv.split("\n").map((r) => r.trim()).filter((r) => r.length > 0);
  const [intestazione, ...datiRighe] = righe;

  if (!intestazione) {
    throw new Error("Storico Acquisti non valido: CSV vuoto");
  }

  const colonne = intestazione.split(",").map((c) => c.trim());
  const indiceData = colonne.indexOf("data");

  if (indiceData === -1) {
    throw new Error("Storico Acquisti non valido: colonna 'data' mancante");
  }

  const tickers = colonne.filter((_, i) => i !== indiceData);
  const risultato = new Map<string, Record<string, number>>();

  for (const riga of datiRighe) {
    const valori = riga.split(",").map((v) => v.trim());
    const dataStr = valori[indiceData];

    if (!dataStr) continue;

    const annoMese = dataStr.slice(0, 7);
    const entry: Record<string, number> = {};

    for (const ticker of tickers) {
      const idx = colonne.indexOf(ticker);
      const valore = valori[idx];
      entry[ticker] = valore ? Number(valore) : 0;
    }

    risultato.set(annoMese, entry);
  }

  return risultato;
}
