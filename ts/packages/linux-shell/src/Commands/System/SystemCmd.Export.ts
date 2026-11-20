// Port of Commands/System/SystemCmd.Export.cs – the export command: makes a variable an environment variable.

import { simple, sortedEntries } from "./SystemCmd.js";

const identifierRe = /^[A-Za-z_][A-Za-z0-9_]*$/;
const usage = "export: usage: export [-fn] [name[=value] ...] or export -p\n";

export const exportCmd = simple(
  "export",
  "Sätter en miljövariabel",
  (ctx) => {
    const sh = ctx.sh;
    let unexport = false;
    let print = false;
    let i = 0;
    for (; i < ctx.args.length; i++) {
      const a = ctx.args[i]!;
      if (a === "--") {
        i++;
        break;
      }
      if (!a.startsWith("-") || a === "-") break;
      for (const c of a.slice(1)) {
        if (c === "n") unexport = true;
        else if (c === "p") print = true;
        else {
          ctx.err(`bash: export: -${c}: invalid option\n${usage}`);
          return 2;
        }
      }
    }
    const names = ctx.args.slice(i);
    // export and export -p list the environment variables (an exported name without a value has no ="...").
    if (names.length === 0 && (print || !unexport)) {
      const values = sortedEntries(sh.env).filter(([k]) => sh.exported.has(k));
      const unset = [...sh.exported].filter((k) => !sh.env.has(k)).map((k): [string, string | null] => [k, null]);
      const all: [string, string | null][] = [...values, ...unset].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      for (const [k, v] of all) ctx.out(v === null ? `declare -x ${k}\n` : `declare -x ${k}="${v}"\n`);
      return 0;
    }
    let code = 0;
    for (const a of names) {
      const eq = a.indexOf("=");
      const key = eq >= 0 ? a.slice(0, eq) : a;
      if (!identifierRe.test(key)) {
        ctx.err(`bash: export: \`${a}': not a valid identifier\n`);
        code = 1;
        continue;
      }
      if (eq >= 0) sh.setVar(key, a.slice(eq + 1));
      // export -n NAME: still a variable in this shell, but no longer passed on to programs.
      if (unexport) sh.exported.delete(key);
      else sh.exported.add(key);
    }
    return code;
  },
  `NAMN
       export - gör en variabel tillgänglig för program som startas

SYNOPSIS
       export NAMN=VÄRDE
       export NAMN
       export -n NAMN
       export -p

EXEMPEL
       export EDITOR=nano
       export PATH="$HOME/bin:$PATH"

BESKRIVNING
       En variabel som du skapar med NAMN=värde finns bara i ditt skal.
       export gör den till en miljövariabel: program och skript som skalet
       startar (t.ex. bash -c '...' eller ./skript.sh) får en kopia av den.
       export -n tar bort exporten men behåller variabeln, och export -p
       (eller bara export) listar miljövariablerna.

       Variabler som sätts med export gäller bara i den aktuella sessionen.
       Lägg raden i ~/.bashrc om den ska gälla varje gång du öppnar en terminal.`,
  true,
);
