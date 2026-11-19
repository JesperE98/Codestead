// Port of Shell/ExpansionError.cs – error thrown while expanding a word (e.g. ${X:?message}); stops the command.

export class ExpansionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpansionError";
  }
}
