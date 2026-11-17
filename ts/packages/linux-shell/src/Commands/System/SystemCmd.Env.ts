// Port of Commands/System/SystemCmd.Env.cs – the env and printenv commands.

import type { CommandDef } from "../../Types/CommandDef.js";
import { simple, sortedEntries } from "./SystemCmd.js";

export function envCmd(name: string): CommandDef {
  return simple(
    name,
    "Visar miljövariabler",
    (ctx) => {
      const env = ctx.sh.env;
      if (name === "printenv" && ctx.args.length > 0) {
        let code = 0;
        for (const k of ctx.args) {
          const v = env.get(k);
          if (v !== undefined) ctx.out(v + "\n");
          else code = 1;
        }
        return code;
      }
      for (const [k, v] of sortedEntries(env)) ctx.out(`${k}=${v}\n`);
      return 0;
    },
    "NAMN\n" +
      `       ${name} - visa miljövariabler\n` +
      "\n" +
      "SYNOPSIS\n" +
      `       ${name === "env" ? "env" : "printenv [VARIABEL]..."}\n` +
      "\n" +
      "BESKRIVNING\n" +
      "       Miljövariabler är namngivna värden som program kan läsa, t.ex.\n" +
      "       HOME (din hemkatalog), PATH (var kommandon letas efter) och USER.",
  );
}
