// Port of Commands/System/SystemCmd.Export.cs – the export command: sets an environment variable.

import { simple, sortedEntries } from "./SystemCmd.js";

const identifierRe = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const exportCmd = simple(
  "export",
  "Sätter en miljövariabel",
  (ctx) => {
    const env = ctx.sh.env;
    if (ctx.args.length === 0 || ctx.args[0] === "-p") {
      for (const [k, v] of sortedEntries(env)) ctx.out(`declare -x ${k}="${v}"\n`);
      return 0;
    }
    for (const a of ctx.args) {
      const eq = a.indexOf("=");
      const key = eq >= 0 ? a.slice(0, eq) : a;
      if (!identifierRe.test(key)) {
        ctx.err(`bash: export: \`${a}': not a valid identifier\n`);
        return 1;
      }
      if (eq >= 0) env.set(key, a.slice(eq + 1));
      else if (!env.has(key)) env.set(key, "");
    }
    return 0;
  },
  `NAMN
       export - gör en variabel tillgänglig för program som startas

SYNOPSIS
       export NAMN=VÄRDE

EXEMPEL
       export EDITOR=nano
       export PATH="$HOME/bin:$PATH"

BESKRIVNING
       Variabler som sätts med export gäller bara i den aktuella sessionen.
       Lägg raden i ~/.bashrc om den ska gälla varje gång du öppnar en terminal.`,
  true,
);
