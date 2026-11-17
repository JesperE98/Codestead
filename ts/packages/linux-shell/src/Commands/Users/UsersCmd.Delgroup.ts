// Port of Commands/Users/UsersCmd.Delgroup.cs – the delgroup command (Debian): removes a group.

import type { CommandDef } from "../../Types/CommandDef.js";
import { Sink } from "../../Types/Sink.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { delGroup, isRoot } from "./UsersCmd.js";

function replaceFirst(s: string, find: string, repl: string): string {
  const i = s.indexOf(find);
  return i < 0 ? s : s.slice(0, i) + repl + s.slice(i + find.length);
}

export const delgroup: CommandDef = {
  name: "delgroup",
  summary: "Tar bort en grupp (Debian)",
  summaryEn: "Remove a group (Debian)",
  man: `NAMN
       delgroup - ta bort en grupp

SYNOPSIS
       delgroup GRUPP`,
  manEn: `NAME
       delgroup - remove a group

SYNOPSIS
       delgroup GROUP`,
  run: (ctx) => {
    const sh = ctx.sh;
    if (!isRoot(sh)) {
      ctx.err("fatal: Only root may remove a user or group from the system.\n");
      return 1;
    }
    const name = ctx.args.length > 0 ? ctx.args[0]! : null;
    if (name === null || name === "") return 1;
    if (UsersLib.findGroup(sh, name) === null) {
      ctx.err(`fatal: The group \`${name}' does not exist.\n`);
      return 3;
    }
    const code = delGroup(
      sh,
      new Sink(
        (s) => ctx.out(s),
        (s) => ctx.err(replaceFirst(s, "groupdel: ", "fatal: ")),
      ),
      "groupdel",
      name,
    );
    if (code === 0) ctx.out(`info: Removing group \`${name}' ...\n`);
    return code;
  },
};
