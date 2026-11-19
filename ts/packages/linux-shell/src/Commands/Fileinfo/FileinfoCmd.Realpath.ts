// Port of Commands/Fileinfo/FileinfoCmd.Realpath.cs – the realpath command: print the full path, without links.

import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { canonical } from "./FileinfoCmd.js";

export const realpath: CommandDef = {
  name: "realpath",
  summary: "Skriver den fullständiga sökvägen utan länkar",
  summaryEn: "Print the full path, without links",
  man: `NAMN
       realpath - skriv den fullständiga sökvägen

SYNOPSIS
       realpath FIL...

BESKRIVNING
       Skriver den absoluta sökvägen till FIL, där alla symboliska
       länkar, . och .. är upplösta.

EXEMPEL
       realpath .
       realpath ~/loggen`,
  manEn: `NAME
       realpath - print the resolved path

SYNOPSIS
       realpath FILE...

DESCRIPTION
       Prints the absolute path to FILE, with every symbolic link, . and
       .. resolved.

EXAMPLES
       realpath .
       realpath ~/thelog`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "emqsz",
      long: { "canonicalize-existing": "e", "canonicalize-missing": "m", quiet: "q" },
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    if (o.operands.length === 0) return UtilCmd.badOption(ctx, "missing operand");
    let code = 0;
    for (const arg of o.operands) {
      const p = canonical(ctx.sh, arg, !o.flags.has("e"));
      if (p === null) {
        if (!o.flags.has("q")) ctx.err(`realpath: ${arg}: No such file or directory\n`);
        code = 1;
      } else ctx.out(p + "\n");
    }
    return code;
  },
};
