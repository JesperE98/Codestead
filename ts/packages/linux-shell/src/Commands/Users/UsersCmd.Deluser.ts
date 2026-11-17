// Port of Commands/Users/UsersCmd.Deluser.cs – the deluser command (Debian): removes a user, or a user from a group.

import type { CommandDef } from "../../Types/CommandDef.js";
import { Sink } from "../../Types/Sink.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { deleteUser, isRoot } from "./UsersCmd.js";

export const deluser: CommandDef = {
  name: "deluser",
  summary: "Tar bort en användare, eller en användare ur en grupp (Debian)",
  summaryEn: "Remove a user, or a user from a group (Debian)",
  man: `NAMN
       deluser - ta bort en användare (eller en användare ur en grupp)

SYNOPSIS
       deluser [--remove-home] ANVÄNDARE
       deluser ANVÄNDARE GRUPP

EXEMPEL
       sudo deluser --remove-home vikarie
       sudo deluser kim sudo`,
  manEn: `NAME
       deluser - remove a user (or a user from a group)

SYNOPSIS
       deluser [--remove-home] USER
       deluser USER GROUP

EXAMPLES
       sudo deluser --remove-home substitute
       sudo deluser kim sudo`,
  run: (ctx) => {
    const sh = ctx.sh;
    if (!isRoot(sh)) {
      ctx.err("fatal: Only root may remove a user or group from the system.\n");
      return 1;
    }
    const removeHome = ctx.args.includes("--remove-home") || ctx.args.includes("--remove-all-files");
    const rest = ctx.args.filter((a) => !a.startsWith("--"));
    const name = rest.length > 0 ? rest[0]! : null;
    const group = rest.length > 1 ? rest[1]! : null;
    if (name === null || name === "") {
      ctx.err("fatal: No options allowed after names.\n");
      return 1;
    }
    const db = UsersLib.loadDb(sh);
    if (!db.passwd.some((e) => e.name === name)) {
      ctx.err(`fatal: The user \`${name}' does not exist.\n`);
      return 2;
    }
    if (group !== null) {
      const g = db.group.find((e) => e.name === group);
      if (g === undefined) {
        ctx.err(`fatal: The group \`${group}' does not exist.\n`);
        return 3;
      }
      if (!g.members.includes(name)) {
        ctx.err(`fatal: The user \`${name}' is not a member of group \`${group}'.\n`);
        return 6;
      }
      ctx.out(`info: Removing user \`${name}' from group \`${group}' ...\n`);
      g.members = g.members.filter((m) => m !== name);
      UsersLib.saveDb(sh, db);
      return 0;
    }
    if (removeHome) ctx.out("info: Looking for files to backup/remove ...\ninfo: Removing files ...\n");
    ctx.out(`info: Removing crontab ...\ninfo: Removing user \`${name}' ...\n`);
    const quiet = new Sink(
      () => {},
      (s) => {
        if (!s.includes("mail spool")) ctx.err(s);
      },
    );
    return deleteUser(sh, quiet, "userdel", name, removeHome, false);
  },
};
