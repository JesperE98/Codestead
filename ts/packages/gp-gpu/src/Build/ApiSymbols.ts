import { symbolList } from "../internal/resources.js";

const cache = new Map<string, Set<string>>();

/** The names each API declares (symbols/&lt;api&gt;.txt, from the real headers) and a "did you mean" for typos. */
export const ApiSymbols = {
  for(list: string): Set<string> {
    let set = cache.get(list);
    if (set !== undefined) return set;
    set = new Set<string>();
    const text = symbolList(list);
    // StreamReader.ReadLine splits at \n, \r and \r\n.
    if (text !== null) for (const line of text.split(/\r\n|\r|\n/)) if (line.length > 0) set.add(line);
    cache.set(list, set);
    return set;
  },

  /** The closest known name (edit distance ≤ 2, or the same ignoring case), or null. */
  suggest(name: string, known: Iterable<string>): string | null {
    let best: string | null = null;
    let bestDistance = 2147483647;
    const upper = name.toUpperCase();
    for (const k of known) {
      if (Math.abs(k.length - name.length) > 2) continue;
      // string.Equals(k, name, OrdinalIgnoreCase).
      if (k.length === name.length && k.toUpperCase() === upper) return k;
      const d = distance(name, k, bestDistance);
      if (d < bestDistance || (d === bestDistance && best !== null && k < best)) {
        bestDistance = d;
        best = k;
      }
    }
    return bestDistance <= 2 ? best : null;
  },
};

function distance(a: string, b: string, limit: number): number {
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(Math.min(cur[j - 1]! + 1, prev[j]! + 1), prev[j - 1]! + cost);
      rowMin = Math.min(rowMin, cur[j]!);
    }
    if (rowMin > Math.min(limit, 3)) return 2147483647;
    [prev, cur] = [cur, prev];
  }
  return prev[b.length]!;
}
