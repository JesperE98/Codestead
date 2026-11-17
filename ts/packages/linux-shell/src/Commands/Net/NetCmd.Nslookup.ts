// Port of Commands/Net/NetCmd.Nslookup.cs – the nslookup command: query DNS name servers (older tool).

import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { pickServer, reverseZone } from "./NetCmd.js";

export const nslookup: CommandDef = {
  name: "nslookup",
  summary: "Slår upp ett namn i DNS (äldre verktyg)",
  summaryEn: "Query DNS name servers (older tool)",
  man: `NAMN
       nslookup - fråga DNS (finns även i Windows)

SYNOPSIS
       nslookup NAMN [SERVER]

BESKRIVNING
       Ett äldre verktyg som finns på nästan alla system, även Windows och
       macOS. "Non-authoritative answer" betyder att svaret kommer från en
       mellanlagrad kopia och inte direkt från domänens egen DNS-server.

EXEMPEL
       nslookup example.com
       nslookup archlinux.org 1.1.1.1`,
  manEn: `NAME
       nslookup - query DNS (also exists on Windows)

SYNOPSIS
       nslookup NAME [SERVER]

DESCRIPTION
       An older tool found on almost every system, including Windows and
       macOS. "Non-authoritative answer" means the answer came from a cached
       copy and not directly from the domain's own DNS server.

EXAMPLES
       nslookup example.com
       nslookup archlinux.org 1.1.1.1`,
  run: (ctx) => {
    const words = ctx.args.filter((a) => !a.startsWith("-"));
    const name = words[0] ?? null;
    const server = words[1] ?? null;
    if (!name) {
      ctx.err(`${UtilCmd.Color.dim}${ctx.sh.msg("net.nslookupInteractive")}${UtilCmd.Color.reset}\n`);
      return 1;
    }
    const srv = pickServer(ctx, server);
    const answer = srv !== null ? NetworkLib.dnsQuery(ctx.sh, NetworkLib.isIPv4(name) ? "unused.invalid" : name, srv) : null;
    if (srv === null || answer === null) {
      ctx.out(`;; communications error to ${srv ?? server ?? "undefined"}#53: timed out\n;; no servers could be reached\n\n`);
      return 1;
    }
    ctx.out(`Server:\t\t${srv}\nAddress:\t${srv}#53\n\n`);
    if (answer.status === "SERVFAIL") {
      ctx.out(`** server can't find ${name}: SERVFAIL\n\n`);
      return 1;
    }
    if (NetworkLib.isIPv4(name)) {
      const ptr = NetworkLib.dnsReverse(name);
      if (ptr === null) {
        ctx.out(`** server can't find ${reverseZone(name)}: NXDOMAIN\n\n`);
        return 1;
      }
      ctx.out(`Non-authoritative answer:\n${reverseZone(name)}\tname = ${ptr}.\n\nAuthoritative answers can be found from:\n\n`);
      return 0;
    }
    if (answer.status === "NXDOMAIN") {
      ctx.out(`** server can't find ${name}: NXDOMAIN\n\n`);
      return 1;
    }
    ctx.out("Non-authoritative answer:\n");
    for (const a of answer.a) ctx.out(`Name:\t${name}\nAddress: ${a}\n`);
    for (const a of answer.aaaa) ctx.out(`Name:\t${name}\nAddress: ${a}\n`);
    ctx.out("\n");
    return 0;
  },
};
