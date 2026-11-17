// Port of Commands/System/SystemCmd.Source.cs – the source and . commands.

import type { CmdCtx } from "../../Types/CmdCtx.js";
import { withDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import { simple } from "./SystemCmd.js";

function runSource(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const file = ctx.args.length > 0 ? ctx.args[0]! : null;
  const rest = ctx.args.slice(1);
  if (file === null || file === "") {
    ctx.err("bash: source: filename argument required\n");
    return 2;
  }
  let content: string;
  try {
    content = sh.vfs.readFile(sh.resolve(file), sh.currentUser());
  } catch (e) {
    if (!(e instanceof FsError)) throw e;
    ctx.err(`bash: ${file}: ${e.message}\n`);
    return 1;
  }
  return sh.runScript(content, file, rest, ctx, true);
}

export const source = simple("source", "Kör ett skript i det aktuella skalet", runSource, `NAMN
       source - läs in och kör kommandon från en fil i det aktuella skalet

BESKRIVNING
       Till skillnad från att köra ett skript påverkar source ditt skal:
       alias, variabler och cd stannar kvar. Används ofta så här:
           source ~/.bashrc
       Punkt (.) är en kortare variant: . ~/.bashrc`, true);

export const dot = withDef(source, { name: "." });
