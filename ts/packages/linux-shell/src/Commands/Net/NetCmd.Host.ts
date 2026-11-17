// Port of Commands/Net/NetCmd.Host.cs – the host command: DNS lookup utility (short and simple).

import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { pickServer, reverseZone } from "./NetCmd.js";

export const host: CommandDef = {
  name: "host",
  summary: "Slår upp ett namn eller en IP-adress i DNS",
  summaryEn: "DNS lookup utility (short and simple)",
  man: `NAMN
       host - enkelt DNS-uppslag

SYNOPSIS
       host NAMN [SERVER]
       host IP-ADRESS

BESKRIVNING
       Visar vilka adresser ett namn har – eller vilket namn en IP-adress
       har (omvänt uppslag). Finns i samma paket som dig.

EXEMPEL
       host example.com
       host 1.1.1.1`,
  manEn: `NAME
       host - simple DNS lookup

SYNOPSIS
       host NAME [SERVER]
       host IP-ADDRESS

DESCRIPTION
       Shows which addresses a name has – or which name an IP address has
       (reverse lookup). Comes in the same package as dig.

EXAMPLES
       host example.com
       host 1.1.1.1`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "av46", values: "t" });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const name = o.operands[0] ?? null;
    const server = o.operands[1] ?? null;
    if (!name) {
      ctx.err("Usage: host [-aCdilrTvVw] [-c class] [-N ndots] [-t type] [-W time]\n            [-R number] [-m flag] [-p port] hostname [server]\n");
      return 1;
    }
    const srv = pickServer(ctx, server);
    const answer = srv !== null ? NetworkLib.dnsQuery(ctx.sh, NetworkLib.isIPv4(name) ? "unused.invalid" : name, srv) : null;
    if (srv === null || answer === null) {
      ctx.out(`;; communications error to ${srv ?? server ?? "undefined"}#53: timed out\n;; no servers could be reached\n`);
      return 1;
    }
    if (server) ctx.out(`Using domain server:\nName: ${server}\nAddress: ${srv}#53\nAliases: \n\n`);
    if (answer.status === "SERVFAIL") {
      ctx.out(`Host ${name} not found: 2(SERVFAIL)\n`);
      return 1;
    }
    if (NetworkLib.isIPv4(name)) {
      const ptr = NetworkLib.dnsReverse(name);
      if (ptr === null) {
        ctx.out(`Host ${reverseZone(name)} not found: 3(NXDOMAIN)\n`);
        return 1;
      }
      ctx.out(`${reverseZone(name)} domain name pointer ${ptr}.\n`);
      return 0;
    }
    if (answer.status === "NXDOMAIN") {
      ctx.out(`Host ${name} not found: 3(NXDOMAIN)\n`);
      return 1;
    }
    const t = o.values.get("t")?.toUpperCase();
    if (!t || t === "A") for (const a of answer.a) ctx.out(`${name} has address ${a}\n`);
    if (!t || t === "AAAA") for (const a of answer.aaaa) ctx.out(`${name} has IPv6 address ${a}\n`);
    if (t && t !== "A" && t !== "AAAA") ctx.out(`${name} has no ${t} record\n`);
    return 0;
  },
};
