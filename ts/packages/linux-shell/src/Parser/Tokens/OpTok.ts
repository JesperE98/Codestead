// Port of Parser/Tokens/OpTok.cs – lexer token: an operator (| && ; > ...) or a newline.

export interface OpTok {
  t: "op";
  v: string;
}
