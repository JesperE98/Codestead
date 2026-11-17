// Port of Parser/Ast/Part.cs – syntax tree: one part of a word (unquoted, 'single' or "double" quoted text).

export interface Part {
  /** Raw text. Unquoted and "double-quoted" parts still contain $VAR, $(...) etc. */
  text: string;
  /** "none", "single" or "double". */
  quoted: "none" | "single" | "double";
}
