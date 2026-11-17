// Port of Commands/System/SystemCmd.Unalias.cs – the unalias command: removes an alias.

import { simple } from "./SystemCmd.js";

export const unalias = simple(
  "unalias",
  "Tar bort ett alias",
  (ctx) => {
    if (ctx.args.length > 0 && ctx.args[0] === "-a") {
      ctx.sh.aliases.clear();
      return 0;
    }
    let code = 0;
    for (const a of ctx.args) {
      if (ctx.sh.aliases.has(a)) ctx.sh.aliases.delete(a);
      else {
        ctx.err(`bash: unalias: ${a}: not found\n`);
        code = 1;
      }
    }
    return code;
  },
  null,
  true,
);
