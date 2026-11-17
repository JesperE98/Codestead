// Port of Parser/Ast/Redirect.cs – syntax tree: a redirection (> file, 2>&1, << END ...).

import type { Word } from "./Word.js";

export interface Redirect {
  /** > >> < 2> 2>> 2>&1 >&2 &> << <<- <<< */
  op: string;
  target?: Word | null;
  /** The text of a here-document (<< END ... END). */
  body?: string | null;
  /** Should $VAR be expanded in the here-document? (Not if the end word is quoted.) */
  expand?: boolean | null;
}
