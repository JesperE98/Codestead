// Port of Commands/Run/RunCmd.Nohup.cs – the nohup command: run a command that keeps running after you log out.

import type { CommandDef } from "../../Types/CommandDef.js";
import { IO } from "../../Types/IO.js";
import { FsError } from "../../Vfs/FsError.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as RunCmd from "./RunCmd.js";

export const nohup: CommandDef = {
  name: "nohup",
  summary: "Kör ett kommando som fortsätter när du loggar ut",
  summaryEn: "Run a command that keeps running after you log out",
  man: `NAMN
       nohup - kör ett kommando som inte stoppas när du loggar ut

SYNOPSIS
       nohup KOMMANDO [ARGUMENT]...

BESKRIVNING
       När du loggar ut (eller stänger terminalen eller ssh-
       anslutningen) får dina program signalen SIGHUP ("hang up") och
       avslutas. nohup gör att KOMMANDO struntar i den signalen.

       Utdata som skulle ha visats i terminalen hamnar i stället i
       filen nohup.out. Sätt & sist för att köra kommandot i bakgrunden.

EXEMPEL
       nohup ./lang-jobb.sh &
       nohup ./lang-jobb.sh > jobb.log 2>&1 &`,
  manEn: `NAME
       nohup - run a command that is not stopped when you log out

SYNOPSIS
       nohup COMMAND [ARGUMENT]...

DESCRIPTION
       When you log out (or close the terminal or the ssh connection), your
       programs get the signal SIGHUP ("hang up") and exit. nohup makes
       COMMAND ignore that signal.

       Output that would have been shown in the terminal goes to the file
       nohup.out instead. Put & last to run the command in the background.

EXAMPLES
       nohup ./long-job.sh &
       nohup ./long-job.sh > job.log 2>&1 &`,
  run: (ctx) => {
    const args = [...ctx.args];
    if (args.length > 0 && args[0] === "--") args.shift();
    if (args.length === 0) {
      ctx.err("nohup: missing operand\nTry 'nohup --help' for more information.\n");
      return 125;
    }
    const sh = ctx.sh;
    if (!ctx.isTTY) return RunCmd.exec(ctx, "nohup", args, new IO(ctx.outFn, ctx.errFn, null, false));
    // Output to the terminal goes to nohup.out (in the home directory if this one is not writable).
    const user = sh.currentUser();
    let file = sh.resolve("nohup.out");
    let label = "nohup.out";
    const here = sh.vfs.tryLookup(sh.cwd, user);
    if (here === null || !VfsLib.hasPerm(here, user, "w")) {
      file = `${user.home}/nohup.out`;
      label = file;
    }
    let output = "";
    ctx.err(`nohup: ignoring input and appending output to '${label}'\n`);
    const code = RunCmd.exec(
      ctx,
      "nohup",
      args,
      new IO(
        (s) => (output += s),
        (s) => (output += s),
        null,
        false,
      ),
    );
    try {
      sh.vfs.writeFile(file, output, user, true);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`nohup: failed to open '${label}': ${e.message}\n`);
      return 125;
    }
    return code;
  },
};
