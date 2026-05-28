export function applicaOverrideCli(
  base: Record<string, unknown>,
  args: string[],
): Record<string, unknown> {
  const risultato = { ...base };
  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      const chiave = arg.slice(2);
      const valore = args[i + 1];
      if (valore !== undefined) {
        if (chiave !== "strumenti") {
          risultato[chiave] = coerciValore(valore);
        }
        i += 2;
        continue;
      }
    }
    i++;
  }
  return risultato;
}

function coerciValore(valore: string): unknown {
  if (valore.startsWith("[") || valore.startsWith("{")) {
    return JSON.parse(valore);
  }
  if (valore.trim() !== "" && !isNaN(Number(valore))) {
    return Number(valore);
  }
  return valore;
}
