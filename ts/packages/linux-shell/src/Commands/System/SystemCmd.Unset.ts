// Port of Commands/System/SystemCmd.Unset.cs – the unset command: removes a variable or function.

import { simple } from "./SystemCmd.js";

export const unset = simple(
  "unset",
  "Tar bort en variabel eller funktion",
  (ctx) => {
    let functions = false;
    for (const k of ctx.args) {
      if (k === "-f") functions = true;
      else if (k === "-v") functions = false;
      else if (functions) ctx.sh.functions.delete(k);
      else ctx.sh.env.delete(k);
    }
    return 0;
  },
  `NAMN
       unset - ta bort en variabel eller funktion

SYNOPSIS
       unset NAMN...
       unset -f FUNKTION...`,
  true,
);
