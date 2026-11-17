// Port of Commands/System/SystemCmd.Hostname.cs – the hostname command: show the system's host name.

import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";

export const hostname: CommandDef = {
  name: "hostname",
  summary: "Visar datorns namn",
  run: (ctx) => {
    if (ctx.args.includes("-I") || ctx.args.includes("--all-ip-addresses")) {
      ctx.out(NetworkLib.myIp(ctx.sh) + " \n");
      return 0;
    }
    if (ctx.args.includes("-i") || ctx.args.includes("--ip-address")) {
      ctx.out("127.0.1.1\n");
      return 0;
    }
    ctx.out(ctx.sh.distro.hostname + "\n");
    return 0;
  },
  man: `NAMN
       hostname - visa systemets värdnamn

BESKRIVNING
       Namnet finns också i filen /etc/hostname.

FLAGGOR
       -I       visa datorns IP-adresser (utom 127.0.0.1)`,
  builtin: false,
  summaryEn: "Show the system's host name",
  manEn: `NAME
       hostname - show the system's host name

DESCRIPTION
       The name is also stored in the file /etc/hostname.

OPTIONS
       -I       show the computer's IP addresses (except 127.0.0.1)`,
};
