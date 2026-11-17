/**
 * C#'s SortedDictionary&lt;double, T&gt;: the entries ordered by key (Comparer&lt;double&gt;.Default: NaN first, -0 equal
 * to 0). A std::map of the C++ the runner reads is one.
 */
export class SortedMap<T> {
  private keysSorted: number[] = [];
  private readonly values = new Map<number, T>();

  constructor(copy?: SortedMap<T>) {
    if (copy) {
      this.keysSorted = copy.keysSorted.slice();
      for (const [k, v] of copy.values) this.values.set(k, v);
    }
  }

  get count(): number {
    return this.keysSorted.length;
  }

  has(key: number): boolean {
    return this.values.has(norm(key));
  }

  get(key: number): T | undefined {
    return this.values.get(norm(key));
  }

  /** map[key] = value: replaces the value of a key there already, else inserts it in order. */
  set(key: number, value: T): void {
    key = norm(key);
    if (!this.values.has(key)) this.keysSorted.splice(this.lowerBound(key), 0, key);
    this.values.set(key, value);
  }

  delete(key: number): boolean {
    key = norm(key);
    if (!this.values.delete(key)) return false;
    const i = this.lowerBound(key);
    this.keysSorted.splice(i, 1);
    return true;
  }

  clear(): void {
    this.keysSorted = [];
    this.values.clear();
  }

  /** The keys in order. */
  keys(): readonly number[] {
    return this.keysSorted;
  }

  /** The values in key order. */
  valuesInOrder(): T[] {
    return this.keysSorted.map((k) => this.values.get(k)!);
  }

  /** The entry at a position in key order (Enumerable.ElementAt). */
  elementAt(i: number): [number, T] {
    const k = this.keysSorted[i];
    if (k === undefined) throw new RangeError("Index was out of range.");
    return [k, this.values.get(k)!];
  }

  *entries(): IterableIterator<[number, T]> {
    for (const k of this.keysSorted) yield [k, this.values.get(k)!];
  }

  private lowerBound(key: number): number {
    let lo = 0, hi = this.keysSorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (compare(this.keysSorted[mid]!, key) < 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}

/** -0 and 0 are one key (as Comparer&lt;double&gt; and a JavaScript Map treat them). */
const norm = (k: number): number => (k === 0 ? 0 : k);

/** Comparer&lt;double&gt;.Default: NaN before every number. */
function compare(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  if (a === b) return 0;
  const an = Number.isNaN(a), bn = Number.isNaN(b);
  return an && bn ? 0 : an ? -1 : 1;
}
