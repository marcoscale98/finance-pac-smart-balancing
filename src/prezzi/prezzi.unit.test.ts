import { describe, it, expect, vi } from "vitest";
import { prezziPerDate } from "./index.js";

const mockChart = vi.hoisted(() => vi.fn());

vi.mock("yahoo-finance2", () => ({
  default: vi.fn().mockReturnValue({
    chart: mockChart,
    quote: vi.fn(),
    suppressNotices: vi.fn(),
  }),
}));

describe("prezziPerDate (unit)", () => {
  it("restituisce il giorno successivo quando la data cade su un weekend", async () => {
    const venerdi = new Date("2025-03-14");
    const lunedi = new Date("2025-03-17");
    mockChart.mockResolvedValue({
      quotes: [
        { date: venerdi, close: 100 },
        { date: lunedi, close: 101 },
      ],
    });

    const sabato = new Date("2025-03-15");
    const risultato = await prezziPerDate("TEST", [sabato]);

    expect(risultato).toEqual([{ data: lunedi, prezzo: 101 }]);
  });

  it("restituisce la candela esatta quando la data coincide con un giorno di mercato", async () => {
    const lunedi = new Date("2025-03-17");
    const martedi = new Date("2025-03-18");
    mockChart.mockResolvedValue({
      quotes: [
        { date: lunedi, close: 101 },
        { date: martedi, close: 102 },
      ],
    });

    const risultato = await prezziPerDate("TEST", [lunedi]);

    expect(risultato).toEqual([{ data: lunedi, prezzo: 101 }]);
  });

  it("lancia RangeError quando la data è oltre la fine dei dati disponibili", async () => {
    const venerdi = new Date("2025-03-14");
    mockChart.mockResolvedValue({
      quotes: [{ date: venerdi, close: 100 }],
    });

    const lunedi = new Date("2025-03-17");
    await expect(prezziPerDate("TEST", [lunedi])).rejects.toThrow(RangeError);
    await expect(prezziPerDate("TEST", [lunedi])).rejects.toThrow("2025-03-17");
  });
});
