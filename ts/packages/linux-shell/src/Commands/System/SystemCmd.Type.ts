// Port of Commands/System/SystemCmd.Type.cs – the type command: shows what a command name is (alias, builtin, file).

import * as IndexCmd from "../IndexCmd.js";
import { simple } from "./SystemCmd.js";

export const typeCmd = simple(
  "type",
  "Visar vad ett kommandonamn är (alias, inbyggt, fil)",
  (ctx) => {
    const sh = ctx.sh;
    let code = 0;
    for (const n of ctx.args) {
      const alias = sh.aliases.get(n);
      if (alias !== undefined) ctx.out(`${n} is aliased to \`${alias}'\n`);
      else if (sh.functions.has(n)) ctx.out(`${n} is a function\n`);
      else if (IndexCmd.commands().get(n)?.builtin === true) ctx.out(`${n} is a shell builtin\n`);
      else {
        const r = sh.resolveCommand(n);
        if (r.kind === "binary" || r.kind === "script") ctx.out(`${n} is ${r.path}\n`);
        else {
          ctx.err(`bash: type: ${n}: not found\n`);
          code = 1;
        }
      }
    }
    return code;
  },
  `NAMN
       type - visa hur ett kommandonamn tolkas

EXEMPEL
       type cd      cd is a shell builtin
       type ls      ls is /usr/bin/ls`,
  true,
);
