// Port of Commands/Users/UsersCmd.Chgrp.cs – the chgrp command: changes the group of files.

import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export const chgrp: CommandDef = {
  name: "chgrp",
  summary: "Byter grupp på filer",
  summaryEn: "Change the group of files",
  man: `NAMN
       chgrp - byt grupp på filer

SYNOPSIS
       chgrp [-R] GRUPP FIL...

BESKRIVNING
       Du får byta grupp på dina egna filer till en grupp som du själv är
       medlem i. root får byta till vilken grupp som helst.

FLAGGOR
       -R    ändra rekursivt i kataloger

EXEMPEL
       chgrp utvecklare projekt.txt
       sudo chgrp -R utvecklare /srv/projekt`,
  manEn: `NAME
       chgrp - change the group of files

SYNOPSIS
       chgrp [-R] GROUP FILE...

DESCRIPTION
       You may change the group of your own files to a group you are a
       member of. root may change to any group.

OPTIONS
       -R    operate recursively on directories

EXAMPLES
       chgrp developers project.txt
       sudo chgrp -R developers /srv/project`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, { flags: "Rv", long: { recursive: "R", verbose: "v" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    if (o.operands.length === 0) return UtilCmd.badOption(ctx, "missing operand");
    const group = o.operands[0]!;
    const files = o.operands.slice(1);
    if (files.length === 0) return UtilCmd.badOption(ctx, `missing operand after '${group}'`);
    if (UsersLib.findGroup(sh, group) === null) {
      ctx.err(`chgrp: invalid group: '${group}'\n`);
      return 1;
    }
    const user = sh.currentUser();
    let code = 0;
    const apply = (label: string, node: FsNode): void => {
      if (user.uid !== 0 && (node.owner !== user.name || !user.groups.includes(group))) {
        ctx.err(`chgrp: changing group of '${label}': Operation not permitted\n`);
        code = 1;
        return;
      }
      node.group = group;
      if (o.flags.has("R") && node.type === "dir") for (const [n, c] of node.children!) apply(`${label}/${n}`, c);
    };
    for (const f of files) {
      try {
        apply(f, sh.vfs.lookup(sh.resolve(f), user));
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`chgrp: cannot access '${f}': ${e.message}\n`);
        code = 1;
      }
    }
    return code;
  },
};
