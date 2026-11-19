// Port of Parser/Tokens/HdBodyTok.cs – lexer token: the body of a here-document.

export interface HdBodyTok {
  t: "hdbody";
  body: string;
  quoted: boolean;
}
