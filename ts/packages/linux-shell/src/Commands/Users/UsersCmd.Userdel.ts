// Port of Commands/Users/UsersCmd.Userdel.cs – the userdel command: deletes a user (needs root).

import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { deleteUser, denied, isRoot } from "./UsersCmd.js";

export const userdel: CommandDef = {
  name: "userdel",
  summary: "Tar bort en användare (kräver root)",
  summaryEn: "Delete a user (needs root)",
  man: `NAMN
       userdel - ta bort ett användarkonto

SYNOPSIS
       userdel [-r] ANVÄNDARE

BESKRIVNING
       Tar bort användaren ur /etc/passwd, /etc/shadow och /etc/group.
       Utan -r ligger hemkatalogen och filerna kvar.

FLAGGOR
       -r    ta också bort hemkatalogen
       -f    ta bort även om användaren är inloggad

EXEMPEL
       sudo userdel -r vikarie`,
  manEn: `NAME
       userdel - delete a user account

SYNOPSIS
       userdel [-r] USER

DESCRIPTION
       Removes the user from /etc/passwd, /etc/shadow and /etc/group.
       Without -r the home directory and files are left behind.

OPTIONS
       -r    also remove the home directory
       -f    remove even if the user is logged in

EXAMPLES
       sudo userdel -r substitute`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "rf", long: { remove: "r", force: "f" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error, 2);
    if (o.operands.length !== 1) {
      ctx.err(
        "Usage: userdel [options] LOGIN\n\nOptions:\n  -f, --force    force removal of files, even if not owned by user\n  -r, --remove   remove home directory and mail spool\n",
      );
      return 2;
    }
    if (!isRoot(ctx.sh)) return denied(ctx);
    return deleteUser(ctx.sh, ctx, "userdel", o.operands[0]!, o.flags.has("r"), o.flags.has("f"));
  },
};
