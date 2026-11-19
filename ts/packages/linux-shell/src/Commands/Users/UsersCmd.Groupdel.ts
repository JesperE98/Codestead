// Port of Commands/Users/UsersCmd.Groupdel.cs – the groupdel command: deletes a group (needs root).

import type { CommandDef } from "../../Types/CommandDef.js";
import { delGroup, isRoot } from "./UsersCmd.js";

export const groupdel: CommandDef = {
  name: "groupdel",
  summary: "Tar bort en grupp (kräver root)",
  summaryEn: "Delete a group (needs root)",
  man: `NAMN
       groupdel - ta bort en grupp

SYNOPSIS
       groupdel GRUPP

BESKRIVNING
       Det går inte att ta bort en grupp som är någons primära grupp.`,
  manEn: `NAME
       groupdel - delete a group

SYNOPSIS
       groupdel GROUP

DESCRIPTION
       A group that is someone's primary group cannot be removed.`,
  run: (ctx) => {
    if (ctx.args.length !== 1 || ctx.args[0]!.startsWith("-")) {
      ctx.err("Usage: groupdel [options] GROUP\n");
      return 2;
    }
    if (!isRoot(ctx.sh)) {
      ctx.err("groupdel: Permission denied.\ngroupdel: cannot lock /etc/group; try again later.\n");
      return 10;
    }
    return delGroup(ctx.sh, ctx, "groupdel", ctx.args[0]!);
  },
};
