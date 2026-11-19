// Port of Commands/Users/UsersCmd.Getent.cs – the getent command: looks up users, groups and host names.

import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { FsError } from "../../Vfs/FsError.js";

/** "#.*" in .NET: the dot stops only at \n. */
const hashCommentRe = /#[^\n]*/;
const wsRe = /\s+/;

export const getent: CommandDef = {
  name: "getent",
  summary: "Slår upp användare, grupper och värdnamn",
  summaryEn: "Look up users, groups and host names",
  man: `NAMN
       getent - slå upp poster i systemets databaser

SYNOPSIS
       getent DATABAS [NYCKEL]...

BESKRIVNING
       Databaserna passwd, group, shadow och hosts. Utan NYCKEL visas
       alla poster. Fungerar även när användarna kommer från en server
       (t.ex. LDAP) och inte bara från /etc/passwd.

EXEMPEL
       getent passwd kim
       getent group sudo`,
  manEn: `NAME
       getent - get entries from the system databases

SYNOPSIS
       getent DATABASE [KEY]...

DESCRIPTION
       The databases passwd, group, shadow and hosts. Without KEY all
       entries are shown. Also works when users come from a server (e.g.
       LDAP) and not just from /etc/passwd.

EXAMPLES
       getent passwd kim
       getent group sudo`,
  run: (ctx) => {
    const sh = ctx.sh;
    const db = ctx.args.length > 0 ? ctx.args[0]! : null;
    const keys = ctx.args.slice(1);
    if (db === null || db === "") {
      ctx.err("getent: wrong number of arguments\nTry `getent --help' or `getent --usage' for more information.\n");
      return 1;
    }
    let lines: { keys: (string | null)[]; line: string }[];
    if (db === "passwd" || db === "group" || db === "shadow") {
      const path = `/etc/${db}`;
      let text: string;
      try {
        text = sh.vfs.readFile(path, sh.currentUser());
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        return 2;
      }
      lines = text
        .split("\n")
        .filter((l) => l.trim() !== "" && !l.startsWith("#"))
        .map((l) => {
          const f = l.split(":");
          const k = db === "shadow" ? [f[0]!] : [f[0]!, f.length > 2 ? f[2]! : null];
          return { keys: k, line: l };
        });
    } else if (db === "hosts") {
      const text = sh.vfs.tryLookup("/etc/hosts", UsersLib.Root)?.content ?? "";
      lines = text
        .split("\n")
        .map((l) => l.replace(hashCommentRe, "").trim())
        .filter((l) => l !== "")
        .map((l) => {
          const parts = l.split(wsRe);
          const ip = parts[0]!;
          const names = parts.slice(1);
          const k: (string | null)[] = [ip, ...names];
          return { keys: k, line: `${ip.padEnd(15)} ${names.join(" ")}` };
        });
    } else {
      ctx.err(`Unknown database: ${db}\nTry \`getent --help' or \`getent --usage' for more information.\n`);
      return 1;
    }
    if (keys.length === 0) {
      for (const l of lines) ctx.out(l.line + "\n");
      return 0;
    }
    let code = 0;
    for (const k of keys) {
      const hit = lines.find((l) => l.keys.includes(k));
      if (hit !== undefined) ctx.out(hit.line + "\n");
      else code = 2;
    }
    return code;
  },
};
