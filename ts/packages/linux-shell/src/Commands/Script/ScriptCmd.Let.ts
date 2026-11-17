// Port of Commands/Script/ScriptCmd.Let.cs – the let command: does integer arithmetic.

import { ArithError } from "../../Arith/ArithError.js";
import * as ArithLib from "../../Arith/ArithLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";

export const letCmd: CommandDef = {
  name: "let",
  builtin: true,
  summary: "Räknar med heltal",
  man: `NAMN
       let - räkna med heltal

SYNOPSIS
       let UTTRYCK...

EXEMPEL
       let "summa = 2 + 3"
       let i++

TIPS
       Det vanligaste sättet idag är (( i++ )) eller summa=$(( 2 + 3 )).`,
  run: (ctx) => {
    let last = 0n;
    for (const expr of ctx.args) {
      try {
        last = ArithLib.evalArith(ctx.sh.expandString(expr), { get: (n) => ctx.sh.getVar(n), set: (n, v) => ctx.sh.setVar(n, v) });
      } catch (e) {
        if (!(e instanceof ArithError)) throw e;
        ctx.err(`bash: let: ${expr}: ${e.message}\n`);
        return 1;
      }
    }
    return last !== 0n ? 0 : 1;
  },
};
