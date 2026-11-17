// Port of Commands/Users/UsersCmd.Adduser.cs – the adduser and addgroup commands.

import { Js } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { Sink } from "../../Types/Sink.js";
import * as UsersLib from "../../Users/UsersLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { addGroup, askNewPassword, createUser, dim, isRoot, toId } from "./UsersCmd.js";

const usersGroupInfo = "info: Adding new user `{0}' to supplemental / extra groups `users' ...\ninfo: Adding user `{0}' to group `users' ...\n";

/** Asks for the full name, then whether the information is correct (like adduser does). */
function askFullName(sh: Shell, name: string, io: Sink): void {
  io.out(`Changing the user information for ${name}\nEnter the new value, or press ENTER for the default\n`);
  sh.askText("\tFull Name []: ", (fullName, io2) => {
    io2.out(dim(sh, "users.chfnSkips"));
    sh.ask("Is the information correct? [Y/n] ", true, (yes, io3) => {
      if (!yes) {
        askFullName(sh, name, io3);
        return 0;
      }
      const db = UsersLib.loadDb(sh);
      const entry = db.passwd.find((e) => e.name === name);
      if (entry !== undefined) entry.gecos = `${fullName.trim()},,,`;
      const users = db.group.find((g) => g.name === "users");
      if (users !== undefined) {
        io3.out(usersGroupInfo.replaceAll("{0}", name));
        if (!users.members.includes(name)) users.members.push(name);
      }
      UsersLib.saveDb(sh, db);
      return 0;
    });
    return 0;
  });
}

export const adduser: CommandDef = {
  name: "adduser",
  summary: "Skapar en användare och frågar efter lösenord och namn (Debian)",
  summaryEn: "Create a user, asking for password and name (Debian)",
  man: `NAMN
       adduser - lägg till en användare (eller en användare i en grupp)

SYNOPSIS
       adduser ANVÄNDARE
       adduser ANVÄNDARE GRUPP

BESKRIVNING
       adduser är ett vänligare skript runt useradd som finns i Debian och
       Ubuntu. Det skapar hemkatalog, sätter /bin/bash som skal och frågar
       efter lösenord och fullständigt namn.

       "adduser kim sudo" lägger till en befintlig användare i en grupp.

FLAGGOR
       --disabled-password   sätt inget lösenord (fråga inte)
       --comment TEXT        fullständigt namn (fråga inte); även --gecos
       --shell SKAL          annat skal än /bin/bash
       --home KATALOG        annan hemkatalog
       --system              skapa en systemanvändare

EXEMPEL
       sudo adduser kim
       sudo adduser kim sudo`,
  manEn: `NAME
       adduser - add a user (or a user to a group)

SYNOPSIS
       adduser USER
       adduser USER GROUP

DESCRIPTION
       adduser is a friendlier script around useradd found in Debian and
       Ubuntu. It creates the home directory, sets /bin/bash as the shell
       and asks for a password and full name.

       "adduser kim sudo" adds an existing user to a group.

OPTIONS
       --disabled-password   set no password (don't ask)
       --comment TEXT        full name (don't ask); also --gecos
       --shell SHELL         a shell other than /bin/bash
       --home DIR            another home directory
       --system              create a system user

EXAMPLES
       sudo adduser kim
       sudo adduser kim sudo`,
  run: (ctx) => {
    const sh = ctx.sh;
    // --disabled-password (P), --system (S), --group (G), --no-create-home (N); c, s, h, i and u take values.
    const o2 = UtilCmd.parseOpts(ctx.args, {
      flags: "qPSGN",
      values: "cshiu",
      long: {
        "disabled-password": "P",
        "disabled-login": "P",
        comment: "c",
        gecos: "c",
        shell: "s",
        home: "h",
        system: "S",
        quiet: "q",
        group: "G",
        ingroup: "i",
        "no-create-home": "N",
        uid: "u",
      },
    });
    if (o2.error !== null) {
      ctx.err(`adduser: ${o2.error}\n`);
      return 1;
    }
    if (!isRoot(sh)) {
      ctx.err("fatal: Only root may add a user or group to the system.\n");
      return 1;
    }
    const name = o2.operands.length > 0 ? o2.operands[0]! : null;
    const group = o2.operands.length > 1 ? o2.operands[1]! : null;
    if (name === null || name === "" || o2.operands.length > 2) {
      ctx.err("fatal: Only one or two names allowed.\n");
      return 1;
    }
    if (o2.flags.has("G")) return addGroupDeb(sh, ctx, name, o2.flags.has("S"));
    if (group !== null) {
      // adduser USER GROUP
      const db = UsersLib.loadDb(sh);
      const g = db.group.find((e) => e.name === group);
      if (!db.passwd.some((e) => e.name === name)) {
        ctx.err(`fatal: The user \`${name}' does not exist.\n`);
        return 1;
      }
      if (g === undefined) {
        ctx.err(`fatal: The group \`${group}' does not exist.\n`);
        return 1;
      }
      if (g.members.includes(name)) {
        ctx.err(`info: The user \`${name}' is already a member of \`${group}'.\n`);
        return 0;
      }
      ctx.out(`info: Adding user \`${name}' to group \`${group}' ...\n`);
      g.members.push(name);
      UsersLib.saveDb(sh, db);
      return 0;
    }
    if (!UsersLib.validName(name)) {
      ctx.err(
        "fatal: Please enter a username matching the regular expression\nconfigured via the NAME_REGEX configuration variable.  Use the `--allow-bad-names' option to relax this check or reconfigure NAME_REGEX.\n",
      );
      return 1;
    }
    if (UsersLib.findUser(sh, name) !== null) {
      ctx.err(`fatal: The user \`${name}' already exists.\n`);
      return 1;
    }
    const system = o2.flags.has("S");
    const ingroup = o2.values.get("i") ?? null;
    if (ingroup !== null && ingroup !== "" && UsersLib.findGroup(sh, ingroup) === null) {
      ctx.err(`fatal: The group \`${ingroup}' does not exist.\n`);
      return 1;
    }
    const u = o2.values.get("u");
    const uid = u !== undefined ? toId(Js.number(u)) : null;
    const out = (s: string): void => ctx.out(s);
    out(`info: Adding ${system ? "system " : ""}user \`${name}' ...\n`);
    out(system ? "info: Selecting UID from range 100 to 999 ...\n" : "info: Selecting UID/GID from range 1000 to 59999 ...\n");
    const created = createUser(
      sh,
      new Sink(out, (s) => ctx.err(s)),
      "adduser",
      {
        name,
        uid,
        group: ingroup ?? (system ? "nogroup" : null),
        groups: [],
        comment: o2.values.get("c") ?? "",
        home: o2.values.get("h") ?? (system ? "/nonexistent" : null),
        shell: o2.values.get("s") ?? (system ? "/usr/sbin/nologin" : "/bin/bash"),
        createHome: !system && !o2.flags.has("N"),
        system,
      },
    );
    if (created === null) return 1;
    const { entry, group: ge } = created;
    // The messages are written afterwards but in the same order as the real adduser.
    const info: string[] = [];
    if (!((ingroup !== null && ingroup !== "") || system)) info.push(`info: Adding new group \`${name}' (${Js.num(ge.gid)}) ...`);
    info.push(`info: Adding new user \`${name}' (${Js.num(entry.uid)}) with group \`${ge.name} (${Js.num(ge.gid)})' ...`);
    if (system || o2.flags.has("N")) info.push(`info: Not creating home directory \`${entry.home}'.`);
    else {
      info.push(`info: Creating home directory \`${entry.home}' ...`);
      info.push("info: Copying files from `/etc/skel' ...");
    }
    out(info.join("\n") + "\n");
    if (system) return 0;
    const afterPassword = (io: Sink): number => {
      if (o2.values.get("c") !== undefined) {
        const db = UsersLib.loadDb(sh);
        const users = db.group.find((e) => e.name === "users");
        if (users !== undefined && !users.members.includes(name)) {
          io.out(usersGroupInfo.replaceAll("{0}", name));
          users.members.push(name);
          UsersLib.saveDb(sh, db);
        }
        return 0;
      }
      if (!sh.canAskInteractively()) return 0;
      askFullName(sh, name, io);
      return 0;
    };
    if (o2.flags.has("P") || !sh.canAskInteractively()) return afterPassword(ctx);
    askNewPassword(sh, name, (ok, io) => {
      if (!ok) io.err(dim(sh, "users.noPasswordSet", { user: name }));
      return afterPassword(io);
    });
    return 0;
  },
};

function addGroupDeb(sh: Shell, ctx: Sink, name: string, system: boolean): number {
  if (UsersLib.findGroup(sh, name) !== null) {
    ctx.err(`fatal: The group \`${name}' already exists.\n`);
    return 1;
  }
  const code = addGroup(sh, ctx, "addgroup", name, system);
  if (code === 0)
    ctx.out(
      `info: Selecting GID from range ${system ? "100 to 999" : "1000 to 59999"} ...\ninfo: Adding group \`${name}' (GID ${Js.num(UsersLib.findGroup(sh, name)!.gid)}) ...\n`,
    );
  return code;
}

export const addgroup: CommandDef = {
  name: "addgroup",
  summary: "Skapar en grupp (Debian)",
  summaryEn: "Create a group (Debian)",
  man: `NAMN
       addgroup - skapa en grupp

SYNOPSIS
       addgroup [--system] GRUPP

BESKRIVNING
       Debians vänligare variant av groupadd.`,
  manEn: `NAME
       addgroup - create a group

SYNOPSIS
       addgroup [--system] GROUP

DESCRIPTION
       Debian's friendlier variant of groupadd.`,
  run: (ctx) => {
    const sh = ctx.sh;
    if (!isRoot(sh)) {
      ctx.err("fatal: Only root may add a user or group to the system.\n");
      return 1;
    }
    const system = ctx.args.includes("--system");
    const names = ctx.args.filter((a) => !a.startsWith("--"));
    if (names.length === 2) return adduser.run(new CmdCtx(ctx, ctx.sh, "adduser", names));
    if (names.length !== 1) {
      ctx.err("fatal: Only one or two names allowed.\n");
      return 1;
    }
    return addGroupDeb(sh, ctx, names[0]!, system);
  },
};
