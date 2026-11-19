// Port of Arith/ArithError.cs – error in an arithmetic expression ($(( ... )), (( ... ))).

export class ArithError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArithError";
  }
}
