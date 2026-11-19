// Port of Commands/System/SystemCmd.Alias.cs – the alias command: creates a shortcut for a command.

import { simple, sortedEntries } from "./SystemCmd.js";

export const alias = simple(
  "alias",
  "Skapar ett kortkommando för ett kommando",
  (ctx) => {
    const aliases = ctx.sh.aliases;
    if (ctx.args.length === 0) {
      for (const [k, v] of sortedEntries(aliases)) ctx.out(`alias ${k}='${v}'\n`);
      return 0;
    }
    let code = 0;
    for (const a of ctx.args) {
      const eq = a.indexOf("=");
      const v = aliases.get(a);
      if (eq > 0) aliases.set(a.slice(0, eq), a.slice(eq + 1));
      else if (v !== undefined) ctx.out(`alias ${a}='${v}'\n`);
      else {
        ctx.err(`bash: alias: ${a}: not found\n`);
        code = 1;
      }
    }
    return code;
  },
  `NAMN
       alias - skapa kortkommandon

SYNOPSIS
       alias NAMN='KOMMANDO'
       alias

EXEMPEL
       alias ll='ls -la'
       alias ..='cd ..'

BESKRIVNING
       Utan argument listas alla alias. Lägg alias i ~/.bashrc för att
       spara dem permanent.`,
  true,
);
