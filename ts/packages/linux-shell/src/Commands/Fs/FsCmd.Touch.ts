// Port of Commands/Fs/FsCmd.Touch.cs – the touch command: creates empty files or updates their timestamp.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import * as VfsLib from "../../Vfs/VfsLib.js";

export const touch: CommandDef = {
  name: "touch",
  summary: "Skapar tomma filer eller uppdaterar tidsstämpeln",
  man: `NAMN
       touch - ändra tidsstämpel på filer, eller skapa tomma filer

SYNOPSIS
       touch FIL...

BESKRIVNING
       Om FIL inte finns skapas en tom fil. Om den finns uppdateras dess
       ändringstid till nu.`,
  run: (ctx) => {
    if (ctx.args.length === 0) {
      ctx.err("touch: missing file operand\nTry 'touch --help' for more information.\n");
      return 1;
    }
    const sh = ctx.sh;
    const user = sh.currentUser();
    let code = 0;
    for (const t of ctx.args) {
      const path = sh.resolve(t);
      try {
        const node = sh.vfs.tryLookup(path, user);
        if (node !== null) {
          if (!VfsLib.hasPerm(node, user, "w") && node.owner !== user.name && user.uid !== 0) throw new FsError("EACCES");
          node.mtime = Js.now();
        } else {
          sh.vfs.writeFile(path, "", user);
        }
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`touch: cannot touch '${t}': ${e.message}\n`);
        code = 1;
      }
    }
    return code;
  },
};
