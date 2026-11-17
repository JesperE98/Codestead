// Port of Commands/Script/ScriptCmd.Return.cs – the return command: ends a function with an exit status.

import { Js } from "../../Js.js";
import { ReturnSignal } from "../../Signals/ReturnSignal.js";
import type { CommandDef } from "../../Types/CommandDef.js";

export const returnCmd: CommandDef = {
  name: "return",
  builtin: true,
  summary: "Avslutar en funktion med en slutkod",
  man: `NAMN
       return - avsluta en funktion

SYNOPSIS
       return [SLUTKOD]

BESKRIVNING
       Avslutar funktionen. Slutkoden (0–255) blir funktionens $?.
       Utan argument används slutkoden från det senaste kommandot.`,
  run: (ctx) => {
    if (ctx.sh.funcDepth === 0 && ctx.sh.scriptDepth === 0) {
      ctx.err("bash: return: can only `return' from a function or sourced script\n");
      return 1;
    }
    // n & 255 converts n with ToInt32 first, like the C# JsToInt32.
    throw new ReturnSignal(ctx.args.length > 0 ? Js.number(ctx.args[0]) & 255 : ctx.sh.lastExit);
  },
};
