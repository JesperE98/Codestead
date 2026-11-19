// Port of Commands/Net/NetCmd.Getent.cs – the getent command: get entries from system databases (hosts, passwd,
// group).

import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";

export const getent: CommandDef = {
  name: "getent",
  summary: "Slår upp i systemets databaser (hosts, passwd, group)",
  summaryEn: "Get entries from system databases (hosts, passwd, group)",
  man: `NAMN
       getent - slå upp i systemets databaser

SYNOPSIS
       getent DATABAS [NYCKEL...]

BESKRIVNING
       Frågar på samma sätt som vanliga program gör. "getent hosts NAMN"
       visar vilken adress systemet använder för ett namn – först från
       /etc/hosts och sedan från DNS.

DATABASER
       hosts     värdnamn och IP-adresser
       passwd    användare (/etc/passwd)
       group     grupper (/etc/group)

EXEMPEL
       getent hosts example.com
       getent hosts localhost
       getent passwd $USER`,
  manEn: `NAME
       getent - get entries from system databases

SYNOPSIS
       getent DATABASE [KEY...]

DESCRIPTION
       Looks things up the same way ordinary programs do. "getent hosts
       NAME" shows which address the system uses for a name – first from
       /etc/hosts and then from DNS.

DATABASES
       hosts     host names and IP addresses
       passwd    users (/etc/passwd)
       group     groups (/etc/group)

EXAMPLES
       getent hosts example.com
       getent hosts localhost
       getent passwd $USER`,
  run: (ctx) => {
    const sh = ctx.sh;
    const db = ctx.args[0] ?? null;
    const keys = ctx.args.slice(1);
    if (!db) {
      ctx.err("Usage: getent [OPTION...] database [key ...]\nTry `getent --help' or `getent --usage' for more information.\n");
      return 1;
    }
    if (db === "hosts" || db === "ahosts") {
      if (keys.length === 0) {
        for (const e of NetworkLib.hostsEntries(sh)) ctx.out(`${e.ip.padEnd(15)} ${e.names.join(" ")}\n`);
        return 0;
      }
      let code = 0;
      for (const k of keys) {
        const r = NetworkLib.resolveHost(sh, k);
        if (!r.ok) {
          code = 2;
          continue;
        }
        const entry = NetworkLib.hostsEntries(sh).filter((e) => e.ip === r.ip && e.names.some((n) => n.toLowerCase() === k.toLowerCase()));
        ctx.out(`${r.ip.padEnd(15)} ${entry.length > 0 ? entry[0]!.names.join(" ") : k}\n`);
      }
      return code;
    }
    if (db === "passwd" || db === "group") {
      const lines = (NetworkLib.readSystemFile(sh, `/etc/${db}`) ?? "").split("\n").filter((l) => l !== "");
      if (keys.length === 0) {
        for (const l of lines) ctx.out(l + "\n");
        return 0;
      }
      let code = 0;
      for (const k of keys) {
        const line = lines.find((l) => l.split(":")[0] === k || l.split(":")[2] === k);
        if (line !== undefined) ctx.out(line + "\n");
        else code = 2;
      }
      return code;
    }
    ctx.err(`Unknown database: ${db}\nTry \`getent --help' or \`getent --usage' for more information.\n`);
    return 1;
  },
};
