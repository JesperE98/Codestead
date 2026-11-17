// Port of Commands/Users/UsersCmd.Useradd.cs – the useradd command: creates a new user (needs root).

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { checkGroups, createUser, daysOf, defaults, denied, dim, isInteger, isRoot, shadowFor, splitList, toId } from "./UsersCmd.js";

const upperRe = /[A-ZÅÄÖåäö]/;

export const useradd: CommandDef = {
  name: "useradd",
  summary: "Skapar en ny användare (kräver root)",
  summaryEn: "Create a new user (needs root)",
  man: `NAMN
       useradd - skapa en ny användare

SYNOPSIS
       useradd [FLAGGOR] ANVÄNDARE

BESKRIVNING
       Lägger till användaren i /etc/passwd, /etc/shadow och (med en egen
       grupp med samma namn) i /etc/group. Nya användare får nästa lediga
       UID från 1000 och uppåt. Kontot har inget lösenord förrän du sätter
       ett med passwd.

       Standardvärdena skiljer sig mellan distributionerna: i Debian och
       Arch skapas ingen hemkatalog utan -m, och i Debian blir skalet
       /bin/sh om du inte anger -s. Fedora skapar hemkatalogen automatiskt.

FLAGGOR
       -m           skapa hemkatalogen (och kopiera filerna i /etc/skel)
       -M           skapa ingen hemkatalog
       -s SKAL      inloggningsskal, t.ex. /bin/bash
       -G GRUPPER   extra grupper, kommaseparerade (t.ex. sudo,utvecklare)
       -g GRUPP     primär grupp i stället för en egen grupp
       -c TEXT      kommentar, oftast det fullständiga namnet
       -d KATALOG   annan hemkatalog än /home/ANVÄNDARE
       -u UID       välj UID själv
       -r           systemanvändare (UID under 1000, ingen hemkatalog)
       -D           visa standardvärdena

EXEMPEL
       sudo useradd -m -s /bin/bash kim
       sudo useradd -m -c "Kim Svensson" -G utvecklare kim`,
  manEn: `NAME
       useradd - create a new user

SYNOPSIS
       useradd [OPTIONS] USER

DESCRIPTION
       Adds the user to /etc/passwd, /etc/shadow and (with a private group
       of the same name) to /etc/group. New users get the next free UID
       from 1000 upwards. The account has no password until you set one
       with passwd.

       The defaults differ between distributions: Debian and Arch create
       no home directory without -m, and on Debian the shell is /bin/sh
       unless you give -s. Fedora creates the home directory by default.

OPTIONS
       -m           create the home directory (copying the files in /etc/skel)
       -M           do not create a home directory
       -s SHELL     login shell, e.g. /bin/bash
       -G GROUPS    supplementary groups, comma separated (e.g. sudo,developers)
       -g GROUP     primary group instead of a private group
       -c TEXT      comment, usually the full name
       -d DIR       home directory other than /home/USER
       -u UID       choose the UID yourself
       -r           system user (UID below 1000, no home directory)
       -D           show the defaults

EXAMPLES
       sudo useradd -m -s /bin/bash kim
       sudo useradd -m -c "Kim Svensson" -G developers kim`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "mMrDUN",
      values: "sGgcdue",
      long: {
        "create-home": "m",
        "no-create-home": "M",
        system: "r",
        defaults: "D",
        "user-group": "U",
        "no-user-group": "N",
        shell: "s",
        groups: "G",
        gid: "g",
        comment: "c",
        "home-dir": "d",
        uid: "u",
        expiredate: "e",
      },
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error, 2);
    const d = defaults(sh);
    if (o.flags.has("D")) {
      ctx.out(`GROUP=100\nHOME=/home\nINACTIVE=-1\nEXPIRE=\nSHELL=${d.shell}\nSKEL=/etc/skel\nCREATE_MAIL_SPOOL=no\n`);
      return 0;
    }
    if (o.operands.length !== 1) {
      ctx.err("Usage: useradd [options] LOGIN\n       useradd -D\n\nTry 'man useradd' for the options.\n");
      return 2;
    }
    const name = o.operands[0]!;
    if (!isRoot(sh)) return denied(ctx);
    if (!UsersLib.validName(name)) {
      ctx.err(`useradd: invalid user name '${name}': use --badname to ignore\n`);
      if (upperRe.test(name)) ctx.err(dim(sh, "users.lowercaseNames"));
      return 3;
    }
    if (UsersLib.findUser(sh, name) !== null) {
      ctx.err(`useradd: user '${name}' already exists\n`);
      return 9;
    }
    const groups = splitList(o.values.get("G"));
    if (!checkGroups(ctx, sh, "useradd", groups)) return 6;
    const u = o.values.get("u");
    const uid = u !== undefined ? Js.number(u) : null;
    if (uid !== null && !isInteger(uid)) {
      ctx.err(`useradd: invalid user ID '${o.values.get("u")}'\n`);
      return 3;
    }
    const system = o.flags.has("r");
    const created = createUser(sh, ctx, "useradd", {
      name,
      uid: uid === null ? null : toId(uid),
      group: o.values.get("g") ?? null,
      groups,
      comment: o.values.get("c") ?? "",
      home: o.values.get("d") ?? null,
      shell: o.values.get("s") ?? d.shell,
      createHome: o.flags.has("m") || (d.createHome && !system && !o.flags.has("M")),
      system,
    });
    if (created === null) return 6;
    const e = o.values.get("e");
    if (e !== undefined && e !== "") {
      const db = UsersLib.loadDb(sh);
      const days = daysOf(e);
      if (Number.isFinite(days)) shadowFor(db, name).expire = Js.num(days);
      UsersLib.saveDb(sh, db);
    }
    return 0;
  },
};
