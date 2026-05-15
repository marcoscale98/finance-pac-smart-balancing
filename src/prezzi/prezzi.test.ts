import { describe, it, expect } from "vitest";
import { prezzoCorrente, prezziPerDate } from "./index.js";

const reteDisponibile = await fetch("https://query1.finance.yahoo.com")
  .then(() => true)
  .catch(() => false);

const itConRete = reteDisponibile ? it : it.skip;

describe("prezzoCorrente", () => {
  itConRete("restituisce un numero positivo per un ticker noto", async () => {
    const prezzo = await prezzoCorrente("IUSE.MI");
    expect(prezzo).toBeGreaterThan(0);
  });
});

describe("prezziPerDate", () => {
  itConRete("restituisce un array della stessa lunghezza dell'input", async () => {
    const date = [
      new Date("2024-01-15"),
      new Date("2024-02-15"),
      new Date("2024-03-15"),
    ];
    const risultato = await prezziPerDate("IUSE.MI", date);
    expect(risultato).toHaveLength(3);
  });

  itConRete("ogni quotazione ha un prezzo positivo", async () => {
    const date = [
      new Date("2024-01-15"),
      new Date("2024-02-15"),
      new Date("2024-03-15"),
    ];
    const risultato = await prezziPerDate("IUSE.MI", date);
    for (const q of risultato) {
      expect(q.prezzo).toBeGreaterThan(0);
    }
  });
});
