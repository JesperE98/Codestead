// Port of Commands/Users/UsersCmd.Groupadd.cs – the groupadd command: creates a new group (needs root).

import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { addGroup, isRoot } from "./UsersCmd.js";

export const groupadd: CommandDef = {
  name: "groupadd",
  summary: "Skapar en ny grupp (kräver root)",
  summaryEn: "Create a new group (needs root)",
  man: `NAMN
       groupadd - skapa en ny grupp

SYNOPSIS
       groupadd [-g GID] [-r] GRUPP

BESKRIVNING
       Lägger till gruppen i /etc/group. Nya grupper får nästa lediga GID
       från 1000 och uppåt. Lägg till medlemmar med "usermod -aG" eller
       "gpasswd -a".

FLAGGOR
       -g GID   välj grupp-id själv
       -r       systemgrupp (GID under 1000)
       -f       inget fel om gruppen redan finns

EXEMPEL
       sudo groupadd utvecklare`,
  manEn: `NAME
       groupadd - create a new group

SYNOPSIS
       groupadd [-g GID] [-r] GROUP

DESCRIPTION
       Adds the group to /etc/group. New groups get the next free GID from
       1000 upwards. Add members with "usermod -aG" or "gpasswd -a".

OPTIONS
       -g GID   choose the group ID yourself
       -r       system group (GID below 1000)
       -f       no error if the group already exists

EXAMPLES
       sudo groupadd developers`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, { flags: "rf", values: "g", long: { system: "r", force: "f", gid: "g" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error, 2);
    if (o.operands.length !== 1) {
      ctx.err("Usage: groupadd [options] GROUP\n\nTry 'man groupadd' for the options.\n");
      return 2;
    }
    if (!isRoot(sh)) {
      ctx.err("groupadd: Permission denied.\ngroupadd: cannot lock /etc/group; try again later.\n");
      return 10;
    }
    if (o.flags.has("f") && UsersLib.findGroup(sh, o.operands[0]!) !== null) return 0;
    return addGroup(sh, ctx, "groupadd", o.operands[0]!, o.flags.has("r"), o.values.get("g") ?? null);
  },
};
