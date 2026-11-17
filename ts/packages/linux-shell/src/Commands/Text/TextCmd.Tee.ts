// Port of Commands/Text/TextCmd.Tee.cs – the tee command: writes input both to the screen and to files.

import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export const tee: CommandDef = {
  name: "tee",
  summary: "Skriver indata både till skärmen och till filer",
  man: `NAMN
       tee - läs från standard input och skriv till både standard output och filer

SYNOPSIS
       tee [-a] [FIL]...

FLAGGOR
       -a    lägg till i filerna i stället för att skriva över

EXEMPEL
       ls | tee lista.txt
       echo "127.0.0.1 test" | sudo tee -a /etc/hosts

TIPS
       "sudo echo text > /etc/fil" fungerar inte, eftersom det är ditt eget
       skal (inte sudo) som öppnar filen. Använd "echo text | sudo tee /etc/fil".`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "a", long: { append: "a" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const data = ctx.stdin ?? "";
    const sh = ctx.sh;
    let code = 0;
    for (const f of o.operands) {
      try {
        sh.vfs.writeFile(sh.resolve(f), data, sh.currentUser(), o.flags.has("a"));
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`tee: ${f}: ${e.message}\n`);
        code = 1;
      }
    }
    ctx.out(data);
    return code;
  },
};
