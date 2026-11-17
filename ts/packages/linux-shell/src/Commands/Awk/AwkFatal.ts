// Port of Commands/Awk/AwkFatal.cs – awk: a fatal error while the program runs.

export class AwkFatal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AwkFatal";
  }
}
