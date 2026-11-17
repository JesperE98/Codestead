// Port of Commands/Fs/FsCmd.Chown.cs – the chown command: changes the owner of files (requires root).

import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export const chown: CommandDef = {
  name: "chown",
  summary: "Byter ägare på filer (kräver root)",
  man: `NAMN
       chown - byt ägare och grupp på filer (change owner)

SYNOPSIS
       chown [-R] ÄGARE[:GRUPP] FIL...

BESKRIVNING
       Bara root kan byta ägare på filer, så du behöver oftast sudo:
           sudo chown $USER:$USER fil.txt

FLAGGOR
       -R    ändra rekursivt i kataloger`,
  run: (ctx) => {
    const sh = ctx.sh;
    const user = sh.currentUser();
    let recursive = false;
    let spec: string | null = null;
    const files: string[] = [];
    for (const a of ctx.args) {
      if (a === "-R" || a === "--recursive") recursive = true;
      else if (spec === null) spec = a;
      else files.push(a);
    }
    if (spec === null) return UtilCmd.badOption(ctx, "missing operand");
    if (files.length === 0) return UtilCmd.badOption(ctx, `missing operand after '${spec}'`);
    const parts = spec.split(":");
    const owner = parts[0]!;
    const groupSpec = parts.length > 1 ? parts[1]! : null;
    // Users and groups live in /etc/passwd and /etc/group. "kim:" means kim's login group.
    if (owner !== "" && !UsersLib.userExists(sh, owner)) {
      ctx.err(`chown: invalid user: '${spec}'\n`);
      return 1;
    }
    const group = groupSpec === "" && owner !== "" ? (sh.getUser(owner).groups[0] ?? null) : groupSpec;
    if (group !== null && group !== "" && !UsersLib.groupExists(sh, group)) {
      ctx.err(`chown: invalid group: '${spec}'\n`);
      return 1;
    }
    let code = 0;
    const apply = (label: string, node: FsNode): void => {
      // Ordinary users may only change the group of their own files, to a group they belong to.
      const ownGroupChange =
        (owner === "" || owner === user.name) && node.owner === user.name && group !== null && group !== "" && user.groups.includes(group);
      if (user.uid !== 0 && !ownGroupChange) {
        ctx.err(`chown: changing ownership of '${label}': Operation not permitted\n`);
        code = 1;
        return;
      }
      if (owner !== "") node.owner = owner;
      if (group !== null && group !== "") node.group = group;
      if (recursive && node.type === "dir") {
        for (const [n, c] of [...node.children!]) apply(`${label}/${n}`, c);
      }
    };
    for (const f of files) {
      try {
        apply(f, sh.vfs.lookup(sh.resolve(f), user));
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`chown: cannot access '${f}': ${e.message}\n`);
        code = 1;
      }
    }
    return code;
  },
};
