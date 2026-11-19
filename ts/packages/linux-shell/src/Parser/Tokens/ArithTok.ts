// Port of Parser/Tokens/ArithTok.cs – lexer token: an arithmetic command (( ... )).

export interface ArithTok {
  t: "arith";
  expr: string;
}
