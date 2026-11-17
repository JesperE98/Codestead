// Port of Commands/Fs/FsCmd.Mkdir.cs – the mkdir command: creates directories.

import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export const mkdir: CommandDef = {
  name: "mkdir",
  summary: "Skapar kataloger",
  man: `NAMN
       mkdir - skapa kataloger (make directory)

SYNOPSIS
       mkdir [FLAGGA]... KATALOG...

FLAGGOR
       -p, --parents   skapa även föräldrakataloger som saknas, och ge
                       inget fel om katalogen redan finns
       -v, --verbose   berätta om varje katalog som skapas

EXEMPEL
       mkdir -p projekt/src/test`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "pv", long: { parents: "p", verbose: "v" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    if (o.operands.length === 0) return UtilCmd.badOption(ctx, "missing operand");
    const sh = ctx.sh;
    const user = sh.currentUser();
    let code = 0;
    for (const t of o.operands) {
      const path = sh.resolve(t);
      try {
        if (o.flags.has("p")) {
          const segs = path.split("/").filter((s) => s !== "");
          let cur = "";
          for (const seg of segs) {
            cur += "/" + seg;
            const existing = sh.vfs.tryLookup(cur, user);
            if (existing !== null) {
              if (existing.type !== "dir") throw new FsError("ENOTDIR");
              continue;
            }
            sh.vfs.mkdir(cur, user);
            if (o.flags.has("v")) ctx.out(`mkdir: created directory '${cur}'\n`);
          }
        } else {
          sh.vfs.mkdir(path, user);
          if (o.flags.has("v")) ctx.out(`mkdir: created directory '${t}'\n`);
        }
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`mkdir: cannot create directory '${t}': ${e.message}\n`);
        code = 1;
      }
    }
    return code;
  },
};
