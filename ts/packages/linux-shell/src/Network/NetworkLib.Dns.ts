// Port of Network/NetworkLib.Dns.cs – NetworkLib: DNS, /etc/hosts and name lookups.

import type { Shell } from "../Shell/Shell.js";
import type { DnsAnswer } from "./DnsAnswer.js";
import { Gateway, isIPv4, linkUp, usesResolved } from "./NetworkLib.js";
import { internetHostByIp, internetHostByName, normName } from "./NetworkLib.Internet.js";
import { reach } from "./NetworkLib.Routing.js";
import type { Resolved } from "./Resolved.js";

// ---------- DNS ----------

const nameserverRe = /^\s*nameserver\s+(\S+)/;

/** The name server in /etc/resolv.conf (the first "nameserver ..." line), or null. */
export function nameserver(sh: Shell): string | null {
  const conf = readSystemFile(sh, "/etc/resolv.conf");
  if (conf === null) return null;
  for (const line of conf.split("\n")) {
    const m = nameserverRe.exec(line);
    if (m) return m[1]!;
  }
  return null;
}

/** Does the address answer DNS queries (and can it be reached)? */
export function isDnsServer(sh: Shell, ip: string): boolean {
  if (ip === "127.0.0.53") return usesResolved(sh.distro);
  if (reach(sh, ip) !== "ok") return false;
  if (ip === Gateway) return true;
  return internetHostByIp(ip)?.dns ?? false;
}

/**
 * Asks a DNS server (by default the one in /etc/resolv.conf). null means the server could not be
 * reached. DNS only knows the internet – not /etc/hosts and not names on the local network.
 * (Two overloads in C#: dnsQuery(sh, name) and dnsQuery(sh, name, server).)
 */
export function dnsQuery(sh: Shell, name: string, server: string | null | undefined = undefined): DnsAnswer | null {
  if (server === undefined) server = nameserver(sh);
  if (!server || !isDnsServer(sh, server)) return null;
  // The stub on 127.0.0.53 always answers, but needs the network to ask further.
  if (!linkUp(sh)) return { status: "SERVFAIL", a: [], aaaa: [] };
  const n = normName(name);
  if (n === "localhost") return { status: "NOERROR", a: ["127.0.0.1"], aaaa: ["::1"] };
  const host = internetHostByName(n);
  if (!host) return { status: "NXDOMAIN", a: [], aaaa: [] };
  return { status: "NOERROR", a: host.a, aaaa: host.aaaa ?? [] };
}

/** Reverse lookup (PTR) in DNS: IP address → name. */
export function dnsReverse(ip: string): string | null {
  if (ip === "127.0.0.1") return "localhost";
  return internetHostByIp(ip)?.names[0] ?? null;
}

export function readSystemFile(sh: Shell, path: string): string | null {
  const node = sh.vfs.tryLookup(path, sh.rootUser());
  return node?.type === "file" ? (node.content ?? "") : null;
}

/** The lines of /etc/hosts as [ip, names...]. */
export function hostsEntries(sh: Shell): { ip: string; names: string[] }[] {
  const content = readSystemFile(sh, "/etc/hosts") ?? "";
  const entries: { ip: string; names: string[] }[] = [];
  for (const raw of content.split("\n")) {
    // Regex.Replace(raw, "", 1): only the first comment (there is only one: ".*" runs to the end of the line).
    const fields = raw
      .replace(/#.*/, "")
      .trim()
      .split(/\s+/)
      .filter((f) => f !== "");
    if (fields.length >= 2) entries.push({ ip: fields[0]!, names: fields.slice(1) });
  }
  return entries;
}

/** Looks up a name the way the system does: first /etc/hosts, then DNS. IPv4 only. */
export function resolveHost(sh: Shell, name: string): Resolved {
  if (isIPv4(name)) return { ok: true, ip: name, name, source: "literal" };
  const n = normName(name);
  for (const e of hostsEntries(sh)) {
    if (isIPv4(e.ip) && e.names.some((x) => x.toLowerCase() === n)) return { ok: true, ip: e.ip, name, source: "hosts" };
  }
  const answer = dnsQuery(sh, n);
  if (answer === null || answer.status === "SERVFAIL") return { ok: false, error: "tempfail" };
  if (answer.a.length === 0) return { ok: false, error: "notfound" };
  return { ok: true, ip: answer.a[0]!, name, source: "dns" };
}

/** Text for a failed lookup, as glibc writes it. */
export function resolveErrorText(error: string): string {
  return error === "notfound" ? "Name or service not known" : "Temporary failure in name resolution";
}

/** The name replies from an address are shown with (like ping does): /etc/hosts first, then DNS. */
export function reverseName(sh: Shell, ip: string): string | null {
  for (const e of hostsEntries(sh)) if (e.ip === ip) return e.names[0]!;
  if (ip === Gateway && usesResolved(sh.distro)) return "_gateway";
  return dnsReverse(ip);
}
