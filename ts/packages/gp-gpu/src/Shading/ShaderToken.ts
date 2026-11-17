// ShaderToken.cs and ShaderTokenKind.cs.

/** The kinds of ShaderToken. */
export enum ShaderTokenKind {
  Identifier,
  Number,
  String,
  Symbol,
  End,
}

/** A token of a shader (or of a C++ expression): its kind, its text and the line it is on (1-based). */
export class ShaderToken {
  constructor(readonly kind: ShaderTokenKind, readonly text: string, readonly line: number) {}

  is(text: string): boolean {
    return this.text === text && this.kind !== ShaderTokenKind.End;
  }

  /** The record struct's `with { … }`. */
  with(changes: { kind?: ShaderTokenKind; text?: string; line?: number }): ShaderToken {
    return new ShaderToken(changes.kind ?? this.kind, changes.text ?? this.text, changes.line ?? this.line);
  }

  toString(): string {
    return this.text;
  }
}
