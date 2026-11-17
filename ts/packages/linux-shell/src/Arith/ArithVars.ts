// Port of Arith/ArithVars.cs – how arithmetic reads and writes shell variables.

export interface ArithVars {
  get: (name: string) => string | null | undefined;
  set: (name: string, value: string) => void;
}
