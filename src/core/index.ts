export interface Strumento {
  ticker: string;
  prezzoCorrente: number;
  quoteDetenute: number;
  pesoTarget: number;
}

export interface InputIterazione {
  portafoglio: Strumento[];
  budget: number;
  alfa: number;
}

export interface OutputIterazione {
  acquisti: { ticker: string; quoteAcquistare: number }[];
  budgetNonSpeso: number;
  deviazione: number;
}

export function decideIterazione(input: InputIterazione): OutputIterazione {
  const { portafoglio, budget, alfa } = input;

  let miglioreAcquisti: number[] = portafoglio.map(() => 0);
  let miglioriCosto = Infinity;

  function enumerate(indice: number, budgetRimanente: number, acquisti: number[]): void {
    if (indice === portafoglio.length) {
      const u = budgetRimanente;

      const valoreFinale = portafoglio.reduce(
        (acc, s, i) => acc + (s.quoteDetenute + acquisti[i]!) * s.prezzoCorrente,
        0,
      );
      const d = portafoglio.reduce((acc, s, i) => {
        const valoreEffettivo = (s.quoteDetenute + acquisti[i]!) * s.prezzoCorrente;
        const valoreTarget = s.pesoTarget * valoreFinale;
        return acc + Math.abs(valoreEffettivo - valoreTarget);
      }, 0);

      const costo = (1 - alfa) * u + alfa * d;
      if (costo < miglioriCosto) {
        miglioriCosto = costo;
        miglioreAcquisti = [...acquisti];
      }
      return;
    }

    const strumento = portafoglio[indice]!;
    const maxQuote = Math.floor(budgetRimanente / strumento.prezzoCorrente);
    for (let q = 0; q <= maxQuote; q++) {
      acquisti[indice] = q;
      enumerate(indice + 1, budgetRimanente - q * strumento.prezzoCorrente, acquisti);
    }
  }

  enumerate(0, budget, portafoglio.map(() => 0));

  const speso = miglioreAcquisti.reduce(
    (acc, q, i) => acc + q * portafoglio[i]!.prezzoCorrente,
    0,
  );
  const budgetNonSpeso = budget - speso;

  const valoreFinale = portafoglio.reduce(
    (acc, s, i) => acc + (s.quoteDetenute + miglioreAcquisti[i]!) * s.prezzoCorrente,
    0,
  );
  const deviazione = portafoglio.reduce((acc, s, i) => {
    const valoreEffettivo = (s.quoteDetenute + miglioreAcquisti[i]!) * s.prezzoCorrente;
    const valoreTarget = s.pesoTarget * valoreFinale;
    return acc + Math.abs(valoreEffettivo - valoreTarget);
  }, 0);

  return {
    acquisti: portafoglio.map((s, i) => ({
      ticker: s.ticker,
      quoteAcquistare: miglioreAcquisti[i]!,
    })),
    budgetNonSpeso,
    deviazione,
  };
}
