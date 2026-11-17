// Port of Commands/System/SystemCmd.Groups.cs – the groups command: shows which groups you belong to.

import * as UsersLib from "../../Users/UsersLib.js";
import { simple } from "./SystemCmd.js";

export const groups = simple(
  "groups",
  "Visar vilka grupper du tillhör",
  (ctx) => {
    const sh = ctx.sh;
    if (ctx.args.length === 0) {
      ctx.out(sh.currentUser().groups.join(" ") + "\n");
      return 0;
    }
    let code = 0;
    for (const name of ctx.args) {
      if (!UsersLib.userExists(sh, name)) {
        ctx.err(`groups: '${name}': no such user\n`);
        code = 1;
        continue;
      }
      ctx.out(`${name} : ${sh.getUser(name).groups.join(" ")}\n`);
    }
    return code;
  },
  `NAMN
       groups - visa vilka grupper en användare tillhör

SYNOPSIS
       groups [ANVÄNDARE]...

BESKRIVNING
       Medlemmar i gruppen sudo (Debian/Ubuntu) eller wheel (Arch/Fedora)
       får använda sudo. Grupperna står i /etc/group.`,
);
