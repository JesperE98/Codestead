// Port of Parser/Tokens/Tok.cs – lexer token: the tokens the tokenizer produces, told apart by "t".

import type { ArithTok } from "./ArithTok.js";
import type { HdBodyTok } from "./HdBodyTok.js";
import type { OpTok } from "./OpTok.js";
import type { WordTok } from "./WordTok.js";

/** A token: "word", "op", "arith" or "hdbody" (see t). */
export type Tok = WordTok | OpTok | ArithTok | HdBodyTok;
