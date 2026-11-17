// Port of Codestead.Terminal/AnsiSegment.cs – a piece of terminal text with its ANSI attributes.

/** A piece of terminal text with the same ANSI attributes. */
export interface AnsiSegment {
  text: string;
  fg: number;
  bg: number;
  bold: boolean;
  dim: boolean;
}
