// Port of Commands/Fs/FsCmd.Rmdir.cs – the rmdir command: removes empty directories.

import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export const rmdir: CommandDef = {
  name: "rmdir",
  summary: "Tar bort tomma kataloger",
  man: `NAMN
       rmdir - ta bort tomma kataloger

SYNOPSIS
       rmdir KATALOG...

BESKRIVNING
       Tar bort katalogen bara om den är tom. Använd rm -r för att ta bort
       en katalog med innehåll.`,
  run: (ctx) => {
    if (ctx.args.length === 0) return UtilCmd.badOption(ctx, "missing operand");
    const sh = ctx.sh;
    const user = sh.currentUser();
    let code = 0;
    for (const t of ctx.args) {
      try {
        const path = sh.resolve(t);
        const node = sh.vfs.lookup(path, user, false);
        if (node.type !== "dir") throw new FsError("ENOTDIR");
        if (node.children!.size > 0) throw new FsError("ENOTEMPTY");
        sh.vfs.remove(path, user);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`rmdir: failed to remove '${t}': ${e.message}\n`);
        code = 1;
      }
    }
    return code;
  },
};
