// Port of Commands/Script/ScriptCmd.LoopControl.cs – the break and continue commands.

import { Js } from "../../Js.js";
import { LoopSignal } from "../../Signals/LoopSignal.js";
import type { CommandDef } from "../../Types/CommandDef.js";

export function loopControl(kind: "break" | "continue"): CommandDef {
  return {
    name: kind,
    builtin: true,
    summary: kind === "break" ? "Avbryter en loop" : "Hoppar till nästa varv i en loop",
    man:
      "NAMN\n" +
      `       ${kind} - ${kind === "break" ? "avbryt en for-, while- eller until-loop" : "hoppa direkt till nästa varv i en loop"}\n` +
      "\n" +
      "SYNOPSIS\n" +
      `       ${kind} [N]\n` +
      "\n" +
      "BESKRIVNING\n" +
      "       Med N påverkas N nivåer av nästlade loopar.",
    run: (ctx) => {
      if (ctx.sh.loopDepth === 0) {
        ctx.err(`bash: ${kind}: only meaningful in a \`for', \`while', or \`until' loop\n`);
        return 0;
      }
      const v = Js.number(ctx.args.length > 0 ? ctx.args[0] : "1");
      const n = Math.max(1, Number.isNaN(v) || v === 0 ? 1 : v);
      throw new LoopSignal(kind, Math.trunc(Math.min(n, ctx.sh.loopDepth)));
    },
  };
}
