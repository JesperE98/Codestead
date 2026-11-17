// Port of Commands/Fileinfo/FileinfoCmd.Readlink.cs – the readlink command: print where a symbolic link points.

import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { canonical } from "./FileinfoCmd.js";

export const readlink: CommandDef = {
  name: "readlink",
  summary: "Visar vart en symbolisk länk pekar",
  summaryEn: "Print where a symbolic link points",
  man: `NAMN
       readlink - visa vart en symbolisk länk pekar

SYNOPSIS
       readlink [-f] FIL...

BESKRIVNING
       Skriver ut sökvägen som står i länken, precis som den skrevs
       med ln -s. Är FIL ingen länk skrivs inget ut (slutstatus 1).

FLAGGOR
       -f   följ alla länkar och skriv den fullständiga sökvägen
            (som realpath)`,
  manEn: `NAME
       readlink - print where a symbolic link points

SYNOPSIS
       readlink [-f] FILE...

DESCRIPTION
       Prints the path stored in the link, exactly as it was written with
       ln -s. If FILE is not a link, nothing is printed (exit status 1).

OPTIONS
       -f   follow every link and print the full path (like realpath)`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "femnqsvz",
      long: { canonicalize: "f", "canonicalize-existing": "e", "canonicalize-missing": "m" },
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    if (o.operands.length === 0) return UtilCmd.badOption(ctx, "missing operand");
    const sh = ctx.sh;
    let code = 0;
    for (const arg of o.operands) {
      if (o.flags.has("f") || o.flags.has("e") || o.flags.has("m")) {
        const p = canonical(sh, arg, !o.flags.has("e"));
        if (p === null) code = 1;
        else ctx.out(p + "\n");
        continue;
      }
      const node = sh.vfs.tryLookupLink(sh.resolve(arg), sh.currentUser());
      if (node?.type === "link") ctx.out((node.content ?? "") + "\n");
      else code = 1;
    }
    return code;
  },
};
