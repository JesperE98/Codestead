// Port of Commands/Users/UsersCmd.Gpasswd.cs – the gpasswd command: adds or removes members of a group.

import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { isRoot, splitList } from "./UsersCmd.js";

export const gpasswd: CommandDef = {
  name: "gpasswd",
  summary: "Lägger till eller tar bort medlemmar i en grupp",
  summaryEn: "Add or remove members of a group",
  man: `NAMN
       gpasswd - administrera /etc/group

SYNOPSIS
       gpasswd -a ANVÄNDARE GRUPP
       gpasswd -d ANVÄNDARE GRUPP

FLAGGOR
       -a ANVÄNDARE   lägg till användaren i gruppen
       -d ANVÄNDARE   ta bort användaren ur gruppen
       -M LISTA       sätt hela medlemslistan (kommaseparerad)

EXEMPEL
       sudo gpasswd -a kim utvecklare
       sudo gpasswd -d kim utvecklare`,
  manEn: `NAME
       gpasswd - administer /etc/group

SYNOPSIS
       gpasswd -a USER GROUP
       gpasswd -d USER GROUP

OPTIONS
       -a USER   add the user to the group
       -d USER   remove the user from the group
       -M LIST   set the whole member list (comma separated)

EXAMPLES
       sudo gpasswd -a kim developers
       sudo gpasswd -d kim developers`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, { values: "adM", long: { add: "a", delete: "d", members: "M" } });
    if (o.error !== null || o.operands.length !== 1 || o.values.size !== 1) {
      ctx.err(
        "Usage: gpasswd [option] GROUP\n\nOptions:\n  -a, --add USER                add USER to GROUP\n  -d, --delete USER             remove USER from GROUP\n  -M, --members USER,...        set the list of members of GROUP\n",
      );
      return 2;
    }
    const groupName = o.operands[0]!;
    if (!isRoot(sh)) {
      ctx.err("gpasswd: Permission denied.\n");
      return 1;
    }
    const db = UsersLib.loadDb(sh);
    const group = db.group.find((g) => g.name === groupName);
    if (group === undefined) {
      ctx.err(`gpasswd: group '${groupName}' does not exist in /etc/group\n`);
      return 3;
    }
    const a = o.values.get("a") ?? null;
    const d = o.values.get("d") ?? null;
    const mv = o.values.get("M");
    const users = mv !== undefined ? splitList(mv) : [(a ?? d)!];
    for (const u of users) {
      if (!db.passwd.some((e) => e.name === u)) {
        ctx.err(`gpasswd: user '${u}' does not exist\n`);
        return 3;
      }
    }
    if (a !== null) {
      ctx.out(`Adding user ${a} to group ${groupName}\n`);
      if (!group.members.includes(a)) group.members.push(a);
    } else if (d !== null) {
      if (!group.members.includes(d)) {
        ctx.err(`gpasswd: user '${d}' is not a member of '${groupName}'\n`);
        return 3;
      }
      ctx.out(`Removing user ${d} from group ${groupName}\n`);
      group.members = group.members.filter((m) => m !== d);
    } else {
      group.members = users;
    }
    UsersLib.saveDb(sh, db);
    return 0;
  },
};
