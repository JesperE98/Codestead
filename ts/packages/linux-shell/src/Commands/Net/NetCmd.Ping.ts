// Port of Commands/Net/NetCmd.Ping.cs – the ping command: send test packets to a host and wait for replies.

import { Js } from "../../Js.js";
import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { isInteger, note } from "./NetCmd.js";

function ms(n: number): string {
  return Js.toFixed(n, n < 1 ? 3 : n < 10 ? 2 : 1);
}

/** Math.round */
function round(x: number): number {
  return Math.floor(x + 0.5);
}

export const ping: CommandDef = {
  name: "ping",
  summary: "Skickar testpaket till en dator och väntar på svar",
  summaryEn: "Send test packets to a host and wait for replies",
  man: `NAMN
       ping - kontrollera om en dator går att nå

SYNOPSIS
       ping [-c ANTAL] [-q] VÄRD

BESKRIVNING
       Skickar ICMP "echo request"-paket och visar svaren och hur lång tid
       de tog (time=... ms). Utan -c fortsätter ping tills du trycker
       Ctrl+C. Sist visas en sammanfattning med hur många paket som
       försvann (packet loss).

FLAGGOR
       -c ANTAL   skicka bara ANTAL paket
       -q         visa bara sammanfattningen
       -n         visa bara IP-adresser, inga namn

EXEMPEL
       ping -c 3 192.168.1.1
       ping -c 4 example.com`,
  manEn: `NAME
       ping - check whether a host can be reached

SYNOPSIS
       ping [-c COUNT] [-q] HOST

DESCRIPTION
       Sends ICMP "echo request" packets and shows the replies and how long
       they took (time=... ms). Without -c, ping keeps going until you press
       Ctrl+C. Finally a summary shows how many packets were lost.

OPTIONS
       -c COUNT   send only COUNT packets
       -q         quiet, show only the summary
       -n         numeric output, no names

EXAMPLES
       ping -c 3 192.168.1.1
       ping -c 4 example.com`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, { flags: "qn46vOD", values: "ciWswtI" });
    if (o.error !== null) {
      ctx.err(`ping: ${o.error}\n`);
      return 2;
    }
    const target = o.operands[0] ?? null;
    if (!target) {
      ctx.err("ping: usage error: Destination address required\n");
      return 1;
    }
    let count = 4;
    const cv = o.values.get("c");
    const limited = cv !== undefined;
    if (limited) {
      const c = Js.number(cv);
      if (!isInteger(c) || c < 1) {
        ctx.err(`ping: invalid argument: '${cv}': out of range: 1 <= value <= 9223372036854775807\n`);
        return 1;
      }
      count = Math.min(c, 1000);
    }
    const resolved = NetworkLib.resolveHost(sh, target);
    if (!resolved.ok) {
      ctx.err(`ping: ${target}: ${NetworkLib.resolveErrorText(resolved.error)}\n`);
      return 2;
    }
    const r = resolved;
    const dest = r.ip === "0.0.0.0" ? "127.0.0.1" : r.ip;
    const status = NetworkLib.reach(sh, dest);
    if (status === "netunreach") {
      ctx.err("ping: connect: Network is unreachable\n");
      return 2;
    }
    const numeric = o.flags.has("n") || r.source === "literal";
    const from = numeric ? dest : `${NetworkLib.reverseName(sh, dest) ?? target} (${dest})`;
    ctx.out(`PING ${target} (${dest}) 56(84) bytes of data.\n`);
    const times: number[] = [];
    let errors = 0;
    for (let seq = 1; seq <= count; seq++) {
      if (status === "ok") {
        const t = NetworkLib.rtt(sh, dest, seq);
        times.push(t);
        if (!o.flags.has("q")) ctx.out(`64 bytes from ${from}: icmp_seq=${seq} ttl=${NetworkLib.ttl(sh, dest)} time=${ms(t)} ms\n`);
      } else if (status === "hostunreach") {
        errors++;
        if (!o.flags.has("q")) ctx.out(`From ${NetworkLib.myIp(sh)} icmp_seq=${seq} Destination Host Unreachable\n`);
      }
    }
    if (!limited) ctx.out("^C\n");
    const total = times.reduce((s, t) => s + t, 0);
    const elapsed = count === 1 ? 0 : (count - 1) * 1000 + round(total / count) + (status === "ok" ? 2 : 40);
    const loss = round(((count - times.length) / count) * 100);
    ctx.out(
      `\n--- ${target} ping statistics ---\n` +
        `${count} packets transmitted, ${times.length} received, ${errors !== 0 ? `+${errors} errors, ` : ""}${Js.num(loss)}% packet loss, time ${Js.num(elapsed)}ms\n`,
    );
    if (times.length > 0) {
      const min = Math.min(...times);
      const max = Math.max(...times);
      const avg = total / times.length;
      const mdev = Math.sqrt(times.reduce((s, b) => s + Math.pow(b - avg, 2), 0) / times.length);
      ctx.out(`rtt min/avg/max/mdev = ${[min, avg, max, mdev].map((x) => Js.toFixed(x, 3)).join("/")} ms\n`);
    } else if (errors !== 0) {
      ctx.out(`pipe ${Math.min(count, 4)}\n`);
    }
    if (!limited && ctx.isTTY) {
      note(ctx, "net.pingCtrlC");
    }
    return times.length > 0 ? 0 : 1;
  },
};
