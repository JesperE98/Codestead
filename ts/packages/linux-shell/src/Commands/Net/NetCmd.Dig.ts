// Port of Commands/Net/NetCmd.Dig.cs – the dig command: DNS lookup utility.

import { Js } from "../../Js.js";
import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { pickServer, reverseZone } from "./NetCmd.js";

const digTypes = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA", "PTR", "ANY"];

/** DateTime.ToString("r"): RFC 1123, e.g. "Tue, 17 Nov 2026 12:00:00 GMT". */
function utcString(): string {
  return new Date(Js.now()).toUTCString();
}

export const dig: CommandDef = {
  name: "dig",
  summary: "Frågar DNS om ett namn",
  summaryEn: "DNS lookup utility",
  man: `NAMN
       dig - fråga en DNS-server

SYNOPSIS
       dig [@SERVER] NAMN [TYP] [+short]
       dig -x IP-ADRESS

BESKRIVNING
       dig frågar DNS direkt och visar hela svaret. Den bryr sig inte om
       /etc/hosts – för att se vad systemet slår upp, använd getent hosts.
       dig finns i paketet dnsutils (Debian/Ubuntu), bind (Arch) eller
       bind-utils (Fedora).

FLAGGOR
       +short     visa bara svaret (IP-adresserna)
       @SERVER    fråga en viss DNS-server, t.ex. @1.1.1.1
       TYP        A (IPv4, standard), AAAA (IPv6) ...
       -x IP      omvänt uppslag: vilket namn har adressen?

EXEMPEL
       dig example.com
       dig +short example.com
       dig @8.8.8.8 debian.org AAAA`,
  manEn: `NAME
       dig - query a DNS server

SYNOPSIS
       dig [@SERVER] NAME [TYPE] [+short]
       dig -x IP-ADDRESS

DESCRIPTION
       dig asks DNS directly and shows the whole answer. It ignores
       /etc/hosts – to see what the system resolves, use getent hosts.
       dig is in the package dnsutils (Debian/Ubuntu), bind (Arch) or
       bind-utils (Fedora).

OPTIONS
       +short     show only the answer (the IP addresses)
       @SERVER    ask a specific DNS server, e.g. @1.1.1.1
       TYPE       A (IPv4, default), AAAA (IPv6) ...
       -x IP      reverse lookup: which name does the address have?

EXAMPLES
       dig example.com
       dig +short example.com
       dig @8.8.8.8 debian.org AAAA`,
  run: (ctx) => {
    const sh = ctx.sh;
    let server: string | null = null;
    let short = false;
    let type = "A";
    let name: string | null = null;
    let reverse = false;
    const args = [...ctx.args];
    const shift = (): string | null => args.shift() ?? null;
    while (args.length > 0) {
      const a = shift()!;
      if (a.startsWith("@")) server = a.slice(1);
      else if (a === "+short") short = true;
      else if (a.startsWith("+")) continue;
      else if (a === "-x") {
        reverse = true;
        name = shift();
        type = "PTR";
      } else if (a === "-t") type = (shift() ?? "A").toUpperCase();
      else if (a.startsWith("-")) {
        ctx.err(`Invalid option: ${a}\nUsage:  dig [@global-server] [domain] [q-type] [q-class] {q-opt}\n`);
        return 1;
      } else if (name !== null && digTypes.includes(a.toUpperCase())) type = a.toUpperCase();
      else if (name === null) name = a;
    }
    if (name === null) {
      name = ".";
      type = "NS";
    }
    const qname = reverse && name !== "" && NetworkLib.isIPv4(name) ? reverseZone(name) : name;
    const srv = pickServer(ctx, server);
    const answer = srv !== null ? NetworkLib.dnsQuery(sh, reverse ? "unused.invalid" : name, srv) : null;
    if (srv === null || answer === null) {
      const s = srv ?? server ?? "127.0.0.1";
      ctx.out(
        `;; communications error to ${s}#53: timed out\n;; communications error to ${s}#53: timed out\n;; communications error to ${s}#53: timed out\n\n; <<>> DiG 9.20.13 <<>> ${ctx.args.join(" ")}\n;; global options: +cmd\n;; no servers could be reached\n`,
      );
      return 9;
    }
    let status = answer.status;
    let records: string[] = [];
    if (reverse) {
      const ptr = name !== "" && NetworkLib.isIPv4(name) ? NetworkLib.dnsReverse(name) : null;
      if (answer.status !== "SERVFAIL") status = ptr !== null ? "NOERROR" : "NXDOMAIN";
      if (ptr !== null) records = [ptr + "."];
    } else if (type === "A") records = answer.a;
    else if (type === "AAAA") records = answer.aaaa;
    else if (type === "ANY") records = [...answer.a, ...answer.aaaa];
    if (short) {
      for (const rec of records) ctx.out(rec + "\n");
      return 0;
    }
    const fq = qname.endsWith(".") ? qname : qname + ".";
    const rType = (rec: string): string => (reverse ? "PTR" : rec.includes(":") ? "AAAA" : "A");
    const id = 10_000 + ((NetworkLib.byteLength(fq) * 7919) % 50_000);
    let out =
      `\n; <<>> DiG 9.20.13 <<>> ${ctx.args.join(" ")}\n;; global options: +cmd\n;; Got answer:\n` +
      `;; ->>HEADER<<- opcode: QUERY, status: ${status}, id: ${id}\n` +
      `;; flags: qr rd ra; QUERY: 1, ANSWER: ${records.length}, AUTHORITY: ${records.length !== 0 || status === "SERVFAIL" ? 0 : 1}, ADDITIONAL: 1\n\n` +
      `;; OPT PSEUDOSECTION:\n; EDNS: version: 0, flags:; udp: 65494\n;; QUESTION SECTION:\n;${fq}\t\t\tIN\t${type}\n\n`;
    if (records.length > 0) {
      out += ";; ANSWER SECTION:\n";
      for (const rec of records) out += `${fq}\t\t${reverse ? 3600 : 300}\tIN\t${rType(rec)}\t${rec}\n`;
      out += "\n";
    } else if (status === "NXDOMAIN" || status === "NOERROR") {
      let zone = reverse ? "in-addr.arpa." : fq.split(".").slice(-2).join(".");
      if (zone === "") zone = ".";
      out += `;; AUTHORITY SECTION:\n${zone}\t\t\t900\tIN\tSOA\ta.root-servers.net. nstld.verisign-grs.com. 2026103000 1800 900 604800 86400\n\n`;
    }
    const time = srv === "127.0.0.53" && records.length > 0 ? 0 : 8 + (id % 30);
    out += `;; Query time: ${time} msec\n;; SERVER: ${srv}#53(${srv}) (UDP)\n;; WHEN: ${utcString()}\n;; MSG SIZE  rcvd: ${40 + fq.length + records.length * 16}\n\n`;
    ctx.out(out);
    return 0;
  },
};
