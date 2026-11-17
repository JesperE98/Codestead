// Port of Commands/Script/ScriptCmd.Local.cs – the local command: creates a variable that only exists inside the
// function.

import type { CommandDef } from "../../Types/CommandDef.js";

export const local: CommandDef = {
  name: "local",
  builtin: true,
  summary: "Skapar en variabel som bara finns i funktionen",
  man: `NAMN
       local - skapa en lokal variabel i en funktion

SYNOPSIS
       local NAMN[=VÄRDE]...

BESKRIVNING
       En lokal variabel försvinner när funktionen är klar och påverkar
       inte en variabel med samma namn utanför funktionen.`,
  run: (ctx) => {
    for (const a of ctx.args) {
      const eq = a.indexOf("=");
      const name = eq >= 0 ? a.slice(0, eq) : a;
      if (!ctx.sh.declareLocal(name, eq >= 0 ? a.slice(eq + 1) : null)) {
        ctx.err("bash: local: can only be used in a function\n");
        return 1;
      }
    }
    return 0;
  },
};
