// Port of Parser/Tokens/WordTok.cs – lexer token: a word.

import type { Word } from "../Ast/Word.js";

export interface WordTok {
  t: "word";
  w: Word;
}
