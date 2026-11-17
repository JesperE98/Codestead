// Port of Commands/Script/ScriptCmd.Set.cs – the set command: shows variables or changes shell settings.

import type { CommandDef } from "../../Types/CommandDef.js";
import * as SystemCmd from "../System/SystemCmd.js";
import * as TextCmd from "../Text/TextCmd.js";

// SystemCmd.sortedEntries (C# SystemCmd.SortedEntries, in SystemCmd.cs) belongs to the System group, which another
// agent ports in parallel; until that branch is merged the stub does not have it, hence the optional lookup.
// TODO(wave 2 merge): call SystemCmd.sortedEntries directly.
type SortedEntries = (obj: Map<string, string>) => [string, string][];
const system = SystemCmd as unknown as { sortedEntries?: SortedEntries };

export const set: CommandDef = {
  name: "set",
  builtin: true,
  summary: "Visar variabler eller ändrar skalets inställningar",
  man: `NAMN
       set - visa variabler eller ändra inställningar i skalet

SYNOPSIS
       set
       set -- ARGUMENT...
       set -e / -u / -x / -o pipefail

BESKRIVNING
       Utan argument listas alla variabler. "set -- a b c" sätter $1, $2, $3.
       Flaggorna -e (avbryt vid fel), -u och -x är vanliga överst i skript.
       I simulatorn godtas de men har ingen effekt ännu.`,
  run: (ctx) => {
    const sh = ctx.sh;
    if (ctx.args.length === 0) {
      for (const [k, v] of system.sortedEntries!(sh.env)) ctx.out(`${k}=${TextCmd.hasJsWhitespace(v) ? `'${v}'` : v}\n`);
      return 0;
    }
    const dd = ctx.args.indexOf("--");
    if (dd >= 0) sh.setArgs(ctx.args.slice(dd + 1));
    return 0;
  },
};
