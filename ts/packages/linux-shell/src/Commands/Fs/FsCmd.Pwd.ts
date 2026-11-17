// Port of Commands/Fs/FsCmd.Pwd.cs – the pwd command: prints the current directory.

import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";

export const pwd: CommandDef = {
  name: "pwd",
  builtin: true,
  summary: "Skriver ut aktuell katalog",
  man: `NAMN
       pwd - skriv ut namnet på aktuell katalog (print working directory)

SYNOPSIS
       pwd [-P]

BESKRIVNING
       Skriver ut den absoluta sökvägen till katalogen du står i.

FLAGGOR
       -P   visa den verkliga sökvägen, utan symboliska länkar`,
  run: (ctx) => {
    // pwd -P: the real path, without symbolic links (cd follows them but remembers the way you came).
    if (ctx.args.includes("-P")) {
      try {
        ctx.out(ctx.sh.vfs.realPath(ctx.sh.cwd, ctx.sh.currentUser()) + "\n");
        return 0;
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        // The directory is gone: show the path as it is.
      }
    }
    ctx.out(ctx.sh.cwd + "\n");
    return 0;
  },
};
