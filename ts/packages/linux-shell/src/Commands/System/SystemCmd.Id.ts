// Port of Commands/System/SystemCmd.Id.cs – the id command: shows user and group IDs.

import { Js } from "../../Js.js";
import * as UsersLib from "../../Users/UsersLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { simple } from "./SystemCmd.js";

export const id = simple(
  "id",
  "Visar användar- och grupp-id",
  (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, { flags: "ugGnr", long: { user: "u", group: "g", groups: "G", name: "n", real: "r" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const name = o.operands.length > 0 ? o.operands[0]! : sh.currentUser().name;
    if (o.operands.length > 0 && !UsersLib.userExists(sh, name)) {
      ctx.err(`id: '${name}': no such user\n`);
      return 1;
    }
    const u = sh.getUser(name);
    const gid = (g: string): string => {
      const n = UsersLib.gidOf(sh, g);
      return n !== null ? Js.num(n) : g;
    };
    const show = (n: string, label: string): string => (o.flags.has("n") ? label : n);
    const primary = u.groups[0] ?? "";
    if (o.flags.has("u")) ctx.out(show(Js.num(u.uid), u.name) + "\n");
    else if (o.flags.has("g")) ctx.out(show(gid(primary), primary) + "\n");
    else if (o.flags.has("G")) ctx.out(u.groups.map((g) => show(gid(g), g)).join(" ") + "\n");
    else ctx.out(`uid=${Js.num(u.uid)}(${u.name}) gid=${gid(primary)}(${primary}) groups=${u.groups.map((g) => `${gid(g)}(${g})`).join(",")}\n`);
    return 0;
  },
  `NAMN
       id - visa användar-id (uid), grupp-id (gid) och grupper

SYNOPSIS
       id [FLAGGOR] [ANVÄNDARE]

BESKRIVNING
       Uppgifterna kommer från /etc/passwd och /etc/group.

FLAGGOR
       -u    bara användar-id
       -g    bara primär grupp-id
       -G    alla grupp-id
       -n    namn i stället för nummer (med -u, -g eller -G)`,
);
