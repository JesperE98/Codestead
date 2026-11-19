// Port of Commands/System/SystemCmd.Bash.cs – the bash and sh commands.

import type { CmdCtx } from "../../Types/CmdCtx.js";
import { FsError } from "../../Vfs/FsError.js";
import * as ShellsCmd from "../Shells/ShellsCmd.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { simple } from "./SystemCmd.js";

function runBash(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const first = ctx.args.length > 0 ? ctx.args[0]! : null;
  const rest = ctx.args.slice(1);
  if (first === "--version") {
    ctx.out("GNU bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)\n");
    return 0;
  }
  if (first === "-c") return sh.runScript(rest.length > 0 ? rest[0]! : "", "bash", rest.slice(1), ctx, false, "bash");
  if (first === null || first === "") {
    const started = ShellsCmd.startBash(ctx);
    if (started !== null) return started;
    ctx.out(`${UtilCmd.Color.dim}${sh.msg("system.alreadyBash")}${UtilCmd.Color.reset}\n`);
    return 0;
  }
  let content: string;
  try {
    content = sh.vfs.readFile(sh.resolve(first), sh.currentUser());
  } catch (e) {
    if (!(e instanceof FsError)) throw e;
    ctx.err(`bash: ${first}: ${e.message}\n`);
    return 127;
  }
  return sh.runScript(content, first, rest, ctx, false, "bash");
}

export const bash = simple("bash", "Kör ett skript i ett nytt bash-skal", runBash, `NAMN
       bash - GNU Bourne-Again SHell

SYNOPSIS
       bash SKRIPT [ARGUMENT]...
       bash -c 'KOMMANDO'

BESKRIVNING
       bash är skalet du skriver kommandon i. "bash skript.sh" kör ett
       skript utan att det behöver vara körbart (chmod +x).`);
