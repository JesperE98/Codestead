// Port of Commands/System/SystemCmd.Exit.cs – the exit and logout commands.

import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import { withDef } from "../../Types/CommandDef.js";
import { simple } from "./SystemCmd.js";

/** A JS number passed on as an integer exit code (NaN becomes 0). */
function toInt(n: number): number {
  return Number.isNaN(n) ? 0 : n >= 2147483647 ? 2147483647 : n <= -2147483648 ? -2147483648 : Math.trunc(n);
}

function runExit(ctx: CmdCtx): number {
  const n = Js.number(ctx.args.length > 0 ? ctx.args[0] : "0");
  return ctx.sh.exit(Number.isNaN(n) ? 0 : toInt(n), ctx);
}

export const exitCmd = simple("exit", "Avslutar skalet (eller lämnar root-skalet)", runExit, `NAMN
       exit - avsluta skalet

BESKRIVNING
       Om du blivit root med "sudo -i" tar exit dig tillbaka till din
       vanliga användare.`, true);

export const logout = withDef(exitCmd, { name: "logout", summary: "Loggar ut från ett inloggningsskal" });
