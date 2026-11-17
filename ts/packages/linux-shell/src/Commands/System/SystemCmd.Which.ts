// Port of Commands/System/SystemCmd.Which.cs – the which command: shows where a command is located.

import { simple } from "./SystemCmd.js";

export const which = simple(
  "which",
  "Visar var ett kommando finns",
  (ctx) => {
    const sh = ctx.sh;
    let code = 0;
    for (const n of ctx.args) {
      const r = sh.resolveCommand(n);
      if (r.kind === "binary" || r.kind === "script") ctx.out(r.path + "\n");
      else {
        code = 1;
        if (sh.distro.family !== "debian") ctx.err(`which: no ${n} in (${sh.env.get("PATH") ?? ""})\n`);
      }
    }
    return code;
  },
  `NAMN
       which - visa den fullständiga sökvägen till ett kommando

BESKRIVNING
       Letar igenom katalogerna i $PATH. Inbyggda skalkommandon (som cd)
       är inga filer och hittas därför inte – använd "type" för dem.

EXEMPEL
       which ls`,
);
