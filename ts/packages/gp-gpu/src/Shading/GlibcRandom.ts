/**
 * rand() / srand() as glibc implements them (the additive feedback generator of random_r, TYPE_3), so a program that
 * seeds with srand(42) gets the same numbers as on Linux – learnopengl's asteroid field is built from them.
 * (The state is C# ints: sums wrap at 32 bits, `| 0` here.)
 */
export class GlibcRandom {
  private i: number;
  private state: number[] = [];

  /** `seed` is a C# uint (0 … 2^32 - 1). */
  constructor(seed: number) {
    if (seed === 0) seed = 1;
    this.state.push(seed | 0);
    for (let k = 1; k < 31; k++) {
      // r[k] = (16807 * r[k-1]) % 2147483647, computed without overflow (Schrage), as glibc does.
      const prev = this.state[k - 1]!;
      const hi = Math.trunc(prev / 127773), lo = prev % 127773;
      let word = 16807 * lo - 2836 * hi;
      if (word < 0) word += 2147483647;
      this.state.push(word | 0);
    }
    for (let k = 31; k < 34; k++) this.state.push(this.state[k - 31]!);
    // The first 310 outputs are thrown away.
    for (let k = 34; k < 344; k++) this.state.push((this.state[k - 31]! + this.state[k - 3]!) | 0);
    this.i = 344;
  }

  next(): number {
    const value = (this.state[this.i - 31]! + this.state[this.i - 3]!) | 0;
    this.state.push(value);
    this.i++;
    if (this.state.length > 4096) {
      this.state.splice(0, this.state.length - 64);
      this.i = this.state.length;
    }
    return value >>> 1;
  }
}
