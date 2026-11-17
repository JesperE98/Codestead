// Port of Commands/Users/UsersCmd.Chpasswd.cs – the chpasswd command: sets passwords from "user:password" lines.

import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { isRoot, setPassword } from "./UsersCmd.js";

export const chpasswd: CommandDef = {
  name: "chpasswd",
  summary: 'Sätter lösenord från rader "användare:lösenord" (kräver root)',
  summaryEn: 'Set passwords from "user:password" lines (needs root)',
  man: `NAMN
       chpasswd - sätt lösenord för många användare på en gång

SYNOPSIS
       echo 'ANVÄNDARE:LÖSENORD' | sudo chpasswd

BESKRIVNING
       Läser rader på formen användare:lösenord från standard in.
       Praktiskt i skript.`,
  manEn: `NAME
       chpasswd - update passwords in batch

SYNOPSIS
       echo 'USER:PASSWORD' | sudo chpasswd

DESCRIPTION
       Reads lines of the form user:password from standard input.
       Handy in scripts.`,
  run: (ctx) => {
    const sh = ctx.sh;
    if (!isRoot(sh)) {
      ctx.err("chpasswd: Permission denied.\nchpasswd: cannot lock /etc/shadow; try again later.\n");
      return 1;
    }
    let code = 0;
    const lines = (ctx.stdin ?? "").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim() === "") continue;
      const colon = line.indexOf(":");
      const name = line.slice(0, colon);
      if (colon < 0) {
        ctx.err(`chpasswd: line ${i + 1}: missing new password\n`);
        code = 1;
      } else if (UsersLib.findUser(sh, name) === null) {
        ctx.err(`chpasswd: line ${i + 1}: user '${name}' does not exist\n`);
        code = 1;
      } else setPassword(sh, name, line.slice(colon + 1));
    }
    return code;
  },
};
