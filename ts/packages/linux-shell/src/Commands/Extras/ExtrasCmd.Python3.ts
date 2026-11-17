// Port of Commands/Extras/ExtrasCmd.Python3.cs – the python3 command: the Python programming language.

import type { CommandDef } from "../../Types/CommandDef.js";
import { note } from "./ExtrasCmd.js";

export const python3: CommandDef = {
  name: "python3",
  summary: "Programspråket Python",
  man: `NAMN
       python3 - tolk för programspråket Python

BESKRIVNING
       I simulatorn stöds "python3 --version". Ett interaktivt Python-läge
       finns inte ännu.`,
  run: (ctx) => {
    const v = ctx.sh.installed.get("python")?.split("-")[0] ?? "3.12.3";
    const first = ctx.args.length > 0 ? ctx.args[0] : null;
    if (first === "--version" || first === "-V") {
      ctx.out(`Python ${v}\n`);
      return 0;
    }
    note(ctx, ctx.sh.msg("extras.pythonInteractive", { version: v }));
    return 0;
  },
};
