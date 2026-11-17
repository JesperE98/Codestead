// Port of Commands/Net/NetCmd.Traceroute.cs – the traceroute command: print the route packets take to a host.

import { Js } from "../../Js.js";
import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export const traceroute: CommandDef = {
  name: "traceroute",
  summary: "Visar vägen (routrarna) paketen tar till en dator",
  summaryEn: "Print the route packets take to a host",
  man: `NAMN
       traceroute - visa vägen till en dator

SYNOPSIS
       traceroute [-n] VÄRD

BESKRIVNING
       Visar varje router (hopp) på vägen och hur lång tid det tar att nå
       den. Första hoppet är din gateway. "* * *" betyder att routern inte
       svarar – det är vanligt och behöver inte vara ett fel.

FLAGGOR
       -n   visa bara IP-adresser

EXEMPEL
       traceroute example.com`,
  manEn: `NAME
       traceroute - print the route to a host

SYNOPSIS
       traceroute [-n] HOST

DESCRIPTION
       Shows every router (hop) along the way and how long it takes to
       reach it. The first hop is your gateway. "* * *" means the router
       does not answer – this is common and not necessarily an error.

OPTIONS
       -n   numeric output, IP addresses only

EXAMPLES
       traceroute example.com`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, { flags: "nI46", values: "mqw" });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const target = o.operands[0] ?? null;
    if (!target) {
      ctx.err("Usage:\n  traceroute [ -46dFITnreAUDV ] [ -f first_ttl ] [ -m max_ttl ] host [ packetlen ]\n");
      return 2;
    }
    const resolved = NetworkLib.resolveHost(sh, target);
    if (!resolved.ok) {
      ctx.err(`${target}: ${NetworkLib.resolveErrorText(resolved.error)}\nCannot handle "host" cmdline arg \`${target}' on position 1 (argc 1)\n`);
      return 2;
    }
    const r = resolved;
    const status = NetworkLib.reach(sh, r.ip);
    if (status === "netunreach") {
      ctx.err("connect: Network is unreachable\n");
      return 1;
    }
    let m = Js.number(o.values.get("m") ?? "30");
    if (Number.isNaN(m) || m === 0) m = 30;
    const max = Math.min(m, 30);
    ctx.out(`traceroute to ${target} (${r.ip}), ${Js.num(max)} hops max, 60 byte packets\n`);
    const path = NetworkLib.hops(sh, r.ip);
    for (let i = 0; i < max; i++) {
      const hop = i < path.length ? path[i]! : null;
      const n = Js.num(i + 1).padStart(2);
      if (hop === null || (status !== "ok" && i === path.length - 1 && hop === r.ip)) {
        ctx.out(`${n}  * * *\n`);
        if (status === "ok" && i >= path.length) break;
        continue;
      }
      const name = o.flags.has("n") ? hop : `${NetworkLib.reverseName(sh, hop) ?? hop} (${hop})`;
      const base = hop === r.ip ? NetworkLib.rtt(sh, hop, 1) : 0.4 + i * 2.7;
      const t = [1, 2, 3].map((k) => `${Js.toFixed(base + k * 0.031, 3)} ms`).join("  ");
      ctx.out(`${n}  ${name}  ${t}\n`);
      if (hop === r.ip) break;
    }
    return 0;
  },
};
