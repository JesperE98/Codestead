// Port of Parser/Ast/Word.cs – syntax tree: a shell word made of quoted and unquoted parts.

import type { Part } from "./Part.js";

export interface Word {
  parts: Part[];
  raw: string;
}
