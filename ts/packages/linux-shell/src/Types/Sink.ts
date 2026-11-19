// Port of Types/Sink.cs (src/shell/types.ts) – where a command writes: standard output and standard error.

/** Where a command writes: standard output and standard error. */
export class Sink {
  constructor(
    public outFn: (s: string) => void,
    public errFn: (s: string) => void,
  ) {}

  out(s: string): void {
    this.outFn(s);
  }

  err(s: string): void {
    this.errFn(s);
  }

  /** A sink that throws everything away ({ out: () => {}, err: () => {} }). */
  static null(): Sink {
    return new Sink(
      () => {},
      () => {},
    );
  }
}
