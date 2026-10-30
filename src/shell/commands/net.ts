// Nätverkskommandon: ip, ping, ss, dig, host, nslookup, getent, traceroute,
// curl, wget och övningsservern minserver. Själva nätverket finns i ../network.ts.

import type { CmdCtx, CommandDef } from '../types';
import {
  byteLength,
  connect,
  dnsQuery,
  dnsReverse,
  hops,
  hostsEntries,
  httpRequest,
  IFACE,
  interfaces,
  isIPv4,
  listeners,
  nameserver,
  neighbours,
  reach,
  readSystemFile,
  resolveErrorText,
  resolveHost,
  reverseName,
  routes,
  rtt,
  SERVICE_NAMES,
  setLinkUp,
  linkUp,
  myIp,
  GATEWAY,
  ttl,
  type Connect,
  type HttpResponse,
} from '../network';
import { procName } from '../procs';
import { basename } from '../vfs';
import { badOption, COLOR, fsMessage, parseOpts } from './util';

const note = (ctx: CmdCtx, text: { sv: string; en: string }) => ctx.err(`${COLOR.dim}${ctx.sh.msg(text)}${COLOR.reset}\n`);
const isRoot = (ctx: CmdCtx) => ctx.sh.currentUser().uid === 0;
const ms = (n: number) => n.toFixed(n < 1 ? 3 : n < 10 ? 2 : 1);

// ---------- ip ----------

const IP_OBJECTS = ['address', 'route', 'link', 'neighbour', 'neighbor', 'help'];

function ipAddr(ctx: CmdCtx, brief: boolean, only4: boolean, dev: string | undefined): number {
  const list = interfaces(ctx.sh).filter((i) => !dev || i.name === dev);
  if (dev && !list.length) {
    ctx.err(`Device "${dev}" does not exist.\n`);
    return 1;
  }
  for (const i of list) {
    if (brief) {
      const addrs = [...i.inet.map((a) => `${a.addr}/${a.prefix}`), ...(only4 ? [] : i.inet6.map((a) => `${a.addr}/${a.prefix}`))];
      ctx.out(`${i.name.padEnd(16)} ${i.state.padEnd(14)} ${addrs.join(' ')} \n`);
      continue;
    }
    ctx.out(`${i.index}: ${i.name}: <${i.flags}> mtu ${i.mtu} qdisc ${i.qdisc} state ${i.state} group default qlen 1000\n`);
    if (!only4) ctx.out(`    link/${i.linkType} ${i.mac} brd ${i.brd}\n`);
    for (const a of i.inet) {
      ctx.out(`    inet ${a.addr}/${a.prefix}${a.brd ? ` brd ${a.brd}` : ''} scope ${a.scope}${a.extra ? ' ' + a.extra : ''} ${i.name}\n`);
      ctx.out(`       valid_lft ${a.lft} preferred_lft ${a.lft}\n`);
    }
    if (only4) continue;
    for (const a of i.inet6) {
      ctx.out(`    inet6 ${a.addr}/${a.prefix} scope ${a.scope} ${a.extra} \n`);
      ctx.out(`       valid_lft forever preferred_lft forever\n`);
    }
  }
  return 0;
}

function ipLink(ctx: CmdCtx, brief: boolean, args: string[]): number {
  const sh = ctx.sh;
  const [cmd = 'show', ...rest] = args;
  const words = rest.filter((w) => w !== 'dev');
  if (cmd === 'set') {
    const [dev, state] = words;
    if (!dev || !interfaces(sh).some((i) => i.name === dev)) {
      ctx.err(dev ? `Cannot find device "${dev}"\n` : 'Not enough information: "dev" argument is required.\n');
      return 1;
    }
    if (state !== 'up' && state !== 'down') {
      ctx.err(`Error: either "dev" is duplicate, or "${state ?? ''}" is a garbage.\n`);
      return 255;
    }
    if (!isRoot(ctx)) {
      ctx.err('RTNETLINK answers: Operation not permitted\n');
      return 2;
    }
    if (dev === IFACE) setLinkUp(sh, state === 'up');
    return 0;
  }
  if (cmd !== 'show' && cmd !== 'list' && cmd !== 'ls') {
    ctx.err(`Command "${cmd}" is unknown, try "ip link help".\n`);
    return 255;
  }
  const dev = words[0];
  const list = interfaces(sh).filter((i) => !dev || i.name === dev);
  if (dev && !list.length) {
    ctx.err(`Device "${dev}" does not exist.\n`);
    return 1;
  }
  for (const i of list) {
    if (brief) {
      ctx.out(`${i.name.padEnd(16)} ${i.state.padEnd(14)} ${i.mac} <${i.flags}> \n`);
      continue;
    }
    ctx.out(`${i.index}: ${i.name}: <${i.flags}> mtu ${i.mtu} qdisc ${i.qdisc} state ${i.state} mode DEFAULT group default qlen 1000\n`);
    ctx.out(`    link/${i.linkType} ${i.mac} brd ${i.brd}\n`);
  }
  return 0;
}

function ipRoute(ctx: CmdCtx, args: string[]): number {
  const sh = ctx.sh;
  const [cmd = 'show', target] = args;
  if (cmd === 'show' || cmd === 'list' || cmd === 'ls') {
    for (const r of routes(sh)) ctx.out(r + ' \n');
    return 0;
  }
  if (cmd === 'get') {
    if (!target || !isIPv4(target)) {
      ctx.err(`Error: inet prefix is expected rather than "${target ?? ''}".\n`);
      return 1;
    }
    const uid = sh.currentUser().uid;
    if (target.startsWith('127.') || target === myIp(sh)) {
      ctx.out(`local ${target} dev lo src ${target.startsWith('127.') ? '127.0.0.1' : target} uid ${uid} \n    cache <local> \n`);
      return 0;
    }
    if (!linkUp(sh)) {
      ctx.err('RTNETLINK answers: Network is unreachable\n');
      return 2;
    }
    const via = target.startsWith('192.168.1.') ? '' : `via ${GATEWAY} `;
    ctx.out(`${target} ${via}dev ${IFACE} src ${myIp(sh)} uid ${uid} \n    cache \n`);
    return 0;
  }
  if (['add', 'del', 'delete', 'change', 'replace', 'flush'].includes(cmd)) {
    if (!isRoot(ctx)) {
      ctx.err('RTNETLINK answers: Operation not permitted\n');
      return 2;
    }
    note(ctx, { sv: '(Att ändra rutter stöds inte i simulatorn.)', en: '(Changing routes is not supported in the simulator.)' });
    return 1;
  }
  ctx.err(`Command "${cmd}" is unknown, try "ip route help".\n`);
  return 255;
}

const ip: CommandDef = {
  name: 'ip',
  summary: 'Visar och ändrar nätverksgränssnitt, adresser och rutter',
  summaryEn: 'Show and manipulate network interfaces, addresses and routes',
  man: `NAMN
       ip - visa och ändra nätverksinställningar

SYNOPSIS
       ip [-br] [-4] OBJEKT [KOMMANDO]

BESKRIVNING
       ip kommer från paketet iproute2 (iproute i Fedora) och har ersatt
       de gamla kommandona ifconfig och route. Objektet kan förkortas.

OBJEKT
       address (a)    IP-adresser på gränssnitten
       link (l)       gränssnitten själva (nätverkskorten)
       route (r)      routingtabellen – bl.a. standard-gatewayen
       neigh (n)      grannar i det lokala nätet (ARP-tabellen)

FLAGGOR
       -br      kort format, en rad per gränssnitt
       -4       bara IPv4

EXEMPEL
       ip a                        visa alla adresser
       ip -br a                    kort översikt
       ip route                    visa rutter och gateway
       ip route get 1.1.1.1        vilken väg tar paketen dit?
       sudo ip link set enp0s3 down   stäng av nätverkskortet
       sudo ip link set enp0s3 up     sätt på det igen`,
  manEn: `NAME
       ip - show and manipulate network settings

SYNOPSIS
       ip [-br] [-4] OBJECT [COMMAND]

DESCRIPTION
       ip comes from the iproute2 package (iproute on Fedora) and replaces
       the old ifconfig and route commands. Objects may be abbreviated.

OBJECTS
       address (a)    IP addresses on the interfaces
       link (l)       the interfaces themselves (network cards)
       route (r)      the routing table – including the default gateway
       neigh (n)      neighbours on the local network (ARP table)

OPTIONS
       -br      brief output, one line per interface
       -4       IPv4 only

EXAMPLES
       ip a                        show all addresses
       ip -br a                    short overview
       ip route                    show routes and the gateway
       ip route get 1.1.1.1        which way do packets go?
       sudo ip link set enp0s3 down   turn the network card off
       sudo ip link set enp0s3 up     turn it on again`,
  run(ctx) {
    const args = [...ctx.args];
    let brief = false;
    let only4 = false;
    while (args[0]?.startsWith('-')) {
      const f = args.shift()!;
      if (f === '-br' || f === '-brief' || f === '--brief') brief = true;
      else if (f === '-4') only4 = true;
      else if (['-6', '-c', '-color', '--color', '-s', '-d', '-details'].includes(f) || f.startsWith('-color=') || f.startsWith('--color=')) continue;
      else if (f === '-V' || f === '-Version') {
        ctx.out('ip utility, iproute2-6.14.0, libbpf 1.5.0\n');
        return 0;
      } else {
        ctx.err(`Option "${f}" is unknown, try "ip -help".\n`);
        return 255;
      }
    }
    const objWord = args.shift();
    if (!objWord) {
      ctx.err('Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | neighbour | route | ... }\n       OPTIONS := { -4 | -6 | -br[ief] | -c[olor] | -s[tatistics] | ... }\n');
      return 255;
    }
    const obj = IP_OBJECTS.find((o) => o.startsWith(objWord));
    switch (obj) {
      case 'address': {
        const [cmd = 'show', ...rest] = args;
        if (cmd === 'show' || cmd === 'list' || cmd === 'ls') return ipAddr(ctx, brief, only4, rest.filter((w) => w !== 'dev')[0]);
        if (['add', 'del', 'delete', 'flush', 'change', 'replace'].includes(cmd)) {
          if (!isRoot(ctx)) {
            ctx.err('RTNETLINK answers: Operation not permitted\n');
            return 2;
          }
          note(ctx, { sv: '(Att ändra adresser stöds inte i simulatorn.)', en: '(Changing addresses is not supported in the simulator.)' });
          return 1;
        }
        ctx.err(`Command "${cmd}" is unknown, try "ip address help".\n`);
        return 255;
      }
      case 'link':
        return ipLink(ctx, brief, args);
      case 'route':
        return ipRoute(ctx, args);
      case 'neighbour':
      case 'neighbor':
        for (const n of neighbours(ctx.sh)) ctx.out(n + ' \n');
        return 0;
      case 'help':
        ctx.out('Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | neighbour | route | ... }\n');
        return 0;
      default:
        ctx.err(`Object "${objWord}" is unknown, try "ip help".\n`);
        return 1;
    }
  },
};

// ---------- ping ----------

const ping: CommandDef = {
  name: 'ping',
  summary: 'Skickar testpaket till en dator och väntar på svar',
  summaryEn: 'Send test packets to a host and wait for replies',
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
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, { flags: 'qn46vOD', values: 'ciWswtI' });
    if (o.error) {
      ctx.err(`ping: ${o.error}\n`);
      return 2;
    }
    const target = o.operands[0];
    if (!target) {
      ctx.err('ping: usage error: Destination address required\n');
      return 1;
    }
    let count = 4;
    const limited = o.values.c !== undefined;
    if (limited) {
      count = Number(o.values.c);
      if (!Number.isInteger(count) || count < 1) {
        ctx.err(`ping: invalid argument: '${o.values.c}': out of range: 1 <= value <= 9223372036854775807\n`);
        return 1;
      }
      count = Math.min(count, 1000);
    }
    const r = resolveHost(sh, target);
    if (!r.ok) {
      ctx.err(`ping: ${target}: ${resolveErrorText(r.error)}\n`);
      return 2;
    }
    const dest = r.ip === '0.0.0.0' ? '127.0.0.1' : r.ip;
    const status = reach(sh, dest);
    if (status === 'netunreach') {
      ctx.err('ping: connect: Network is unreachable\n');
      return 2;
    }
    const numeric = o.flags.has('n') || r.source === 'literal';
    const from = numeric ? dest : `${reverseName(sh, dest) ?? target} (${dest})`;
    ctx.out(`PING ${target} (${dest}) 56(84) bytes of data.\n`);
    const times: number[] = [];
    let errors = 0;
    for (let seq = 1; seq <= count; seq++) {
      if (status === 'ok') {
        const t = rtt(sh, dest, seq);
        times.push(t);
        if (!o.flags.has('q')) ctx.out(`64 bytes from ${from}: icmp_seq=${seq} ttl=${ttl(sh, dest)} time=${ms(t)} ms\n`);
      } else if (status === 'hostunreach') {
        errors++;
        if (!o.flags.has('q')) ctx.out(`From ${myIp(sh)} icmp_seq=${seq} Destination Host Unreachable\n`);
      }
    }
    if (!limited) ctx.out('^C\n');
    const elapsed = count === 1 ? 0 : (count - 1) * 1000 + Math.round(times.reduce((a, b) => a + b, 0) / count) + (status === 'ok' ? 2 : 40);
    const loss = Math.round(((count - times.length) / count) * 100);
    ctx.out(
      `\n--- ${target} ping statistics ---\n` +
        `${count} packets transmitted, ${times.length} received, ${errors ? `+${errors} errors, ` : ''}${loss}% packet loss, time ${elapsed}ms\n`,
    );
    if (times.length) {
      const min = Math.min(...times);
      const max = Math.max(...times);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const mdev = Math.sqrt(times.reduce((a, b) => a + (b - avg) ** 2, 0) / times.length);
      ctx.out(`rtt min/avg/max/mdev = ${[min, avg, max, mdev].map((x) => x.toFixed(3)).join('/')} ms\n`);
    } else if (errors) {
      ctx.out(`pipe ${Math.min(count, 4)}\n`);
    }
    if (!limited && ctx.isTTY) {
      note(ctx, {
        sv: '(I en riktig terminal fortsätter ping tills du trycker Ctrl+C. Med -c 4 skickas bara fyra paket.)',
        en: '(In a real terminal ping keeps going until you press Ctrl+C. With -c 4 only four packets are sent.)',
      });
    }
    return times.length ? 0 : 1;
  },
};

// ---------- ss ----------

const ss: CommandDef = {
  name: 'ss',
  summary: 'Visar nätverksanslutningar och lyssnande portar',
  summaryEn: 'Show network sockets and listening ports',
  man: `NAMN
       ss - visa sockets (nätverksanslutningar och portar)

SYNOPSIS
       ss [-tulpna]

BESKRIVNING
       ss ersätter det äldre netstat. Den vanligaste kombinationen är
       "ss -tulpn": vilka program lyssnar på vilka portar?

FLAGGOR
       -t   TCP
       -u   UDP
       -l   bara lyssnande (listening) sockets
       -p   visa vilken process som äger porten (alla processer kräver sudo)
       -n   visa portnummer i stället för tjänstenamn (22 i stället för ssh)
       -a   visa både lyssnande och anslutna

EXEMPEL
       ss -tulpn
       sudo ss -tlpn`,
  manEn: `NAME
       ss - show sockets (network connections and ports)

SYNOPSIS
       ss [-tulpna]

DESCRIPTION
       ss replaces the older netstat. The most common combination is
       "ss -tulpn": which programs are listening on which ports?

OPTIONS
       -t   TCP
       -u   UDP
       -l   listening sockets only
       -p   show the process using the socket (all processes need sudo)
       -n   numeric ports instead of service names (22 instead of ssh)
       -a   show both listening and connected sockets

EXAMPLES
       ss -tulpn
       sudo ss -tlpn`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, {
      flags: 'tulpnaH4',
      long: { tcp: 't', udp: 'u', listening: 'l', processes: 'p', numeric: 'n', all: 'a', 'no-header': 'H' },
    });
    if (o.error) return badOption(ctx, o.error);
    const f = o.flags;
    const wantTcp = f.has('t') || !f.has('u');
    const wantUdp = f.has('u') || !f.has('t');
    const listening = f.has('l') || f.has('a');
    const user = sh.currentUser();
    const rows = listening
      ? listeners(sh).filter((l) => (l.proto === 'tcp' ? wantTcp : wantUdp) && (!f.has('4') || !l.addr.startsWith('[')))
      : [];
    const port = (n: number) => (f.has('n') ? String(n) : (SERVICE_NAMES[n] ?? String(n)));
    const peer = (addr: string) => (addr.startsWith('[') ? '[::]:*' : '0.0.0.0:*');
    let hidden = false;
    const lines = rows.map((l) => {
      let procCol = '';
      if (f.has('p')) {
        if (user.uid === 0 || l.proc.user === user.name) procCol = `users:(("${procName(l.proc)}",pid=${l.proc.pid},fd=${l.fd}))`;
        else hidden = true;
      }
      const state = l.proto === 'tcp' ? 'LISTEN' : 'UNCONN';
      const backlog = l.proto === 'tcp' ? (procName(l.proc) === 'sshd' ? '128' : '4096') : '0';
      return `${l.proto.padEnd(6)}${state.padEnd(7)}0      ${backlog.padEnd(7)}${`${l.addr}:${port(l.port)}`.padStart(18)} ${peer(l.addr).padStart(13)} ${procCol}`.trimEnd();
    });
    if (!f.has('H')) ctx.out(`Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process\n`);
    for (const line of lines) ctx.out(line + '\n');
    if (hidden && ctx.isTTY) {
      note(ctx, {
        sv: '(Processkolumnen är tom för processer som andra användare äger. Kör "sudo ss -tulpn" för att se alla.)',
        en: '(The process column is empty for processes owned by other users. Run "sudo ss -tulpn" to see all of them.)',
      });
    }
    if (!listening && ctx.isTTY) {
      note(ctx, {
        sv: '(Inga öppna anslutningar just nu. Lägg till -l för att se portar som lyssnar, t.ex. "ss -tulpn".)',
        en: '(No open connections right now. Add -l to see listening ports, e.g. "ss -tulpn".)',
      });
    }
    return 0;
  },
};

// ---------- DNS: dig, host, nslookup ----------

const DIG_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'PTR', 'ANY'];

function reverseZone(ip: string): string {
  return ip.split('.').reverse().join('.') + '.in-addr.arpa';
}

/** Vilken DNS-server som ska användas: @server, annars /etc/resolv.conf. */
function pickServer(ctx: CmdCtx, explicit: string | undefined): string | null {
  if (explicit) {
    if (isIPv4(explicit)) return explicit;
    const r = resolveHost(ctx.sh, explicit);
    return r.ok ? r.ip : null;
  }
  return nameserver(ctx.sh);
}

const dig: CommandDef = {
  name: 'dig',
  summary: 'Frågar DNS om ett namn',
  summaryEn: 'DNS lookup utility',
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
  run(ctx) {
    const sh = ctx.sh;
    let server: string | undefined;
    let short = false;
    let type = 'A';
    let name: string | undefined;
    let reverse = false;
    const args = [...ctx.args];
    while (args.length) {
      const a = args.shift()!;
      if (a.startsWith('@')) server = a.slice(1);
      else if (a === '+short') short = true;
      else if (a.startsWith('+')) continue;
      else if (a === '-x') {
        reverse = true;
        name = args.shift();
        type = 'PTR';
      } else if (a === '-t') type = (args.shift() ?? 'A').toUpperCase();
      else if (a.startsWith('-')) {
        ctx.err(`Invalid option: ${a}\nUsage:  dig [@global-server] [domain] [q-type] [q-class] {q-opt}\n`);
        return 1;
      } else if (name !== undefined && DIG_TYPES.includes(a.toUpperCase())) type = a.toUpperCase();
      else if (name === undefined) name = a;
    }
    if (name === undefined) {
      name = '.';
      type = 'NS';
    }
    const qname = reverse && name && isIPv4(name) ? reverseZone(name) : name;
    const srv = pickServer(ctx, server);
    const answer = srv ? dnsQuery(sh, reverse ? 'unused.invalid' : name, srv) : null;
    if (!srv || !answer) {
      const s = srv ?? server ?? '127.0.0.1';
      ctx.out(`;; communications error to ${s}#53: timed out\n;; communications error to ${s}#53: timed out\n;; communications error to ${s}#53: timed out\n\n; <<>> DiG 9.20.13 <<>> ${ctx.args.join(' ')}\n;; global options: +cmd\n;; no servers could be reached\n`);
      return 9;
    }
    let status = answer.status;
    let records: string[] = [];
    if (reverse) {
      const ptr = name && isIPv4(name) ? dnsReverse(name) : null;
      if (answer.status !== 'SERVFAIL') status = ptr ? 'NOERROR' : 'NXDOMAIN';
      if (ptr) records = [ptr + '.'];
    } else if (type === 'A') records = answer.a;
    else if (type === 'AAAA') records = answer.aaaa;
    else if (type === 'ANY') records = [...answer.a, ...answer.aaaa];
    if (short) {
      for (const r of records) ctx.out(r + '\n');
      return 0;
    }
    const fq = qname.endsWith('.') ? qname : qname + '.';
    const rtype = (r: string) => (reverse ? 'PTR' : r.includes(':') ? 'AAAA' : 'A');
    const id = 10_000 + Math.floor((byteLength(fq) * 7919) % 50_000);
    let out =
      `\n; <<>> DiG 9.20.13 <<>> ${ctx.args.join(' ')}\n;; global options: +cmd\n;; Got answer:\n` +
      `;; ->>HEADER<<- opcode: QUERY, status: ${status}, id: ${id}\n` +
      `;; flags: qr rd ra; QUERY: 1, ANSWER: ${records.length}, AUTHORITY: ${records.length || status === 'SERVFAIL' ? 0 : 1}, ADDITIONAL: 1\n\n` +
      `;; OPT PSEUDOSECTION:\n; EDNS: version: 0, flags:; udp: 65494\n;; QUESTION SECTION:\n;${fq}\t\t\tIN\t${type}\n\n`;
    if (records.length) {
      out += ';; ANSWER SECTION:\n';
      for (const r of records) out += `${fq}\t\t${reverse ? 3600 : 300}\tIN\t${rtype(r)}\t${r}\n`;
      out += '\n';
    } else if (status === 'NXDOMAIN' || status === 'NOERROR') {
      const zone = reverse ? 'in-addr.arpa.' : fq.split('.').slice(-2).join('.') || '.';
      out += `;; AUTHORITY SECTION:\n${zone}\t\t\t900\tIN\tSOA\ta.root-servers.net. nstld.verisign-grs.com. 2026103000 1800 900 604800 86400\n\n`;
    }
    const time = srv === '127.0.0.53' && records.length ? 0 : 8 + (id % 30);
    out += `;; Query time: ${time} msec\n;; SERVER: ${srv}#53(${srv}) (UDP)\n;; WHEN: ${new Date().toUTCString()}\n;; MSG SIZE  rcvd: ${40 + fq.length + records.length * 16}\n\n`;
    ctx.out(out);
    return 0;
  },
};

const host: CommandDef = {
  name: 'host',
  summary: 'Slår upp ett namn eller en IP-adress i DNS',
  summaryEn: 'DNS lookup utility (short and simple)',
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
  run(ctx) {
    const o = parseOpts(ctx.args, { flags: 'av46', values: 't' });
    if (o.error) return badOption(ctx, o.error);
    const [name, server] = o.operands;
    if (!name) {
      ctx.err('Usage: host [-aCdilrTvVw] [-c class] [-N ndots] [-t type] [-W time]\n            [-R number] [-m flag] [-p port] hostname [server]\n');
      return 1;
    }
    const srv = pickServer(ctx, server);
    const answer = srv ? dnsQuery(ctx.sh, isIPv4(name) ? 'unused.invalid' : name, srv) : null;
    if (!srv || !answer) {
      ctx.out(`;; communications error to ${srv ?? server}#53: timed out\n;; no servers could be reached\n`);
      return 1;
    }
    if (server) ctx.out(`Using domain server:\nName: ${server}\nAddress: ${srv}#53\nAliases: \n\n`);
    if (answer.status === 'SERVFAIL') {
      ctx.out(`Host ${name} not found: 2(SERVFAIL)\n`);
      return 1;
    }
    if (isIPv4(name)) {
      const ptr = dnsReverse(name);
      if (!ptr) {
        ctx.out(`Host ${reverseZone(name)} not found: 3(NXDOMAIN)\n`);
        return 1;
      }
      ctx.out(`${reverseZone(name)} domain name pointer ${ptr}.\n`);
      return 0;
    }
    if (answer.status === 'NXDOMAIN') {
      ctx.out(`Host ${name} not found: 3(NXDOMAIN)\n`);
      return 1;
    }
    const t = o.values.t?.toUpperCase();
    if (!t || t === 'A') for (const a of answer.a) ctx.out(`${name} has address ${a}\n`);
    if (!t || t === 'AAAA') for (const a of answer.aaaa) ctx.out(`${name} has IPv6 address ${a}\n`);
    if (t && t !== 'A' && t !== 'AAAA') ctx.out(`${name} has no ${t} record\n`);
    return 0;
  },
};

const nslookup: CommandDef = {
  name: 'nslookup',
  summary: 'Slår upp ett namn i DNS (äldre verktyg)',
  summaryEn: 'Query DNS name servers (older tool)',
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
  run(ctx) {
    const [name, server] = ctx.args.filter((a) => !a.startsWith('-'));
    if (!name) {
      ctx.err(`${COLOR.dim}${ctx.sh.msg({ sv: '(Det interaktiva läget stöds inte i simulatorn. Skriv t.ex.  nslookup example.com)', en: '(Interactive mode is not supported in the simulator. Type e.g.  nslookup example.com)' })}${COLOR.reset}\n`);
      return 1;
    }
    const srv = pickServer(ctx, server);
    const answer = srv ? dnsQuery(ctx.sh, isIPv4(name) ? 'unused.invalid' : name, srv) : null;
    if (!srv || !answer) {
      ctx.out(`;; communications error to ${srv ?? server}#53: timed out\n;; no servers could be reached\n\n`);
      return 1;
    }
    ctx.out(`Server:\t\t${srv}\nAddress:\t${srv}#53\n\n`);
    if (answer.status === 'SERVFAIL') {
      ctx.out(`** server can't find ${name}: SERVFAIL\n\n`);
      return 1;
    }
    if (isIPv4(name)) {
      const ptr = dnsReverse(name);
      if (!ptr) {
        ctx.out(`** server can't find ${reverseZone(name)}: NXDOMAIN\n\n`);
        return 1;
      }
      ctx.out(`Non-authoritative answer:\n${reverseZone(name)}\tname = ${ptr}.\n\nAuthoritative answers can be found from:\n\n`);
      return 0;
    }
    if (answer.status === 'NXDOMAIN') {
      ctx.out(`** server can't find ${name}: NXDOMAIN\n\n`);
      return 1;
    }
    ctx.out('Non-authoritative answer:\n');
    for (const a of answer.a) ctx.out(`Name:\t${name}\nAddress: ${a}\n`);
    for (const a of answer.aaaa) ctx.out(`Name:\t${name}\nAddress: ${a}\n`);
    ctx.out('\n');
    return 0;
  },
};

const getent: CommandDef = {
  name: 'getent',
  summary: 'Slår upp i systemets databaser (hosts, passwd, group)',
  summaryEn: 'Get entries from system databases (hosts, passwd, group)',
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
       getent passwd elev`,
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
       getent passwd elev`,
  run(ctx) {
    const sh = ctx.sh;
    const [db, ...keys] = ctx.args;
    if (!db) {
      ctx.err("Usage: getent [OPTION...] database [key ...]\nTry `getent --help' or `getent --usage' for more information.\n");
      return 1;
    }
    if (db === 'hosts' || db === 'ahosts') {
      if (!keys.length) {
        for (const e of hostsEntries(sh)) ctx.out(`${e.ip.padEnd(15)} ${e.names.join(' ')}\n`);
        return 0;
      }
      let code = 0;
      for (const k of keys) {
        const r = resolveHost(sh, k);
        if (!r.ok) {
          code = 2;
          continue;
        }
        const entry = hostsEntries(sh).find((e) => e.ip === r.ip && e.names.some((n) => n.toLowerCase() === k.toLowerCase()));
        ctx.out(`${r.ip.padEnd(15)} ${entry ? entry.names.join(' ') : k}\n`);
      }
      return code;
    }
    if (db === 'passwd' || db === 'group') {
      const lines = (readSystemFile(sh, `/etc/${db}`) ?? '').split('\n').filter(Boolean);
      if (!keys.length) {
        for (const l of lines) ctx.out(l + '\n');
        return 0;
      }
      let code = 0;
      for (const k of keys) {
        const line = lines.find((l) => l.split(':')[0] === k || l.split(':')[2] === k);
        if (line) ctx.out(line + '\n');
        else code = 2;
      }
      return code;
    }
    ctx.err(`Unknown database: ${db}\nTry \`getent --help' or \`getent --usage' for more information.\n`);
    return 1;
  },
};

// ---------- traceroute ----------

const traceroute: CommandDef = {
  name: 'traceroute',
  summary: 'Visar vägen (routrarna) paketen tar till en dator',
  summaryEn: 'Print the route packets take to a host',
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
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, { flags: 'nI46', values: 'mqw' });
    if (o.error) return badOption(ctx, o.error);
    const target = o.operands[0];
    if (!target) {
      ctx.err('Usage:\n  traceroute [ -46dFITnreAUDV ] [ -f first_ttl ] [ -m max_ttl ] host [ packetlen ]\n');
      return 2;
    }
    const r = resolveHost(sh, target);
    if (!r.ok) {
      ctx.err(`${target}: ${resolveErrorText(r.error)}\nCannot handle "host" cmdline arg \`${target}' on position 1 (argc 1)\n`);
      return 2;
    }
    const status = reach(sh, r.ip);
    if (status === 'netunreach') {
      ctx.err('connect: Network is unreachable\n');
      return 1;
    }
    const max = Math.min(Number(o.values.m ?? 30) || 30, 30);
    ctx.out(`traceroute to ${target} (${r.ip}), ${max} hops max, 60 byte packets\n`);
    const path = hops(sh, r.ip);
    for (let i = 0; i < max; i++) {
      const hop = i < path.length ? path[i] : null;
      const n = String(i + 1).padStart(2);
      if (hop === null || (status !== 'ok' && i === path.length - 1 && hop === r.ip)) {
        ctx.out(`${n}  * * *\n`);
        if (status === 'ok' && i >= path.length) break;
        continue;
      }
      const name = o.flags.has('n') ? hop : `${reverseName(sh, hop) ?? hop} (${hop})`;
      const base = hop === r.ip ? rtt(sh, hop, 1) : 0.4 + i * 2.7;
      const t = [1, 2, 3].map((k) => `${(base + k * 0.031).toFixed(3)} ms`).join('  ');
      ctx.out(`${n}  ${name}  ${t}\n`);
      if (hop === r.ip) break;
    }
    return 0;
  },
};

// ---------- URL:er, curl och wget ----------

interface Url {
  scheme: 'http' | 'https';
  host: string;
  port: number;
  path: string;
  /** Värden som den skrevs, med port om den angavs ("localhost:8080"). */
  hostPort: string;
}

function parseUrl(raw: string): Url | { error: 'protocol'; scheme: string } | { error: 'malformed' } {
  let rest = raw;
  let scheme = 'http';
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(raw);
  if (m) {
    scheme = m[1].toLowerCase();
    rest = raw.slice(m[0].length);
  }
  if (scheme !== 'http' && scheme !== 'https') return { error: 'protocol', scheme: m![1] };
  const slash = rest.search(/[/?#]/);
  const hostPort = slash < 0 ? rest : rest.slice(0, slash);
  let path = slash < 0 ? '/' : rest.slice(slash);
  if (!path.startsWith('/')) path = '/' + path;
  const hp = /^([^:@]+)(?::(\d+))?$/.exec(hostPort.replace(/^.*@/, ''));
  if (!hp) return { error: 'malformed' };
  const port = hp[2] ? Number(hp[2]) : scheme === 'https' ? 443 : 80;
  return { scheme, host: hp[1].toLowerCase(), port, path: path.replace(/#.*/, ''), hostPort };
}

function joinUrl(base: Url, location: string): string {
  if (/^https?:\/\//i.test(location)) return location;
  return `${base.scheme}://${base.hostPort}${location.startsWith('/') ? location : '/' + location}`;
}

function statusLine(r: HttpResponse): string {
  return r.version === 'HTTP/2' ? `HTTP/2 ${r.status}` : `${r.version} ${r.status} ${r.reason}`;
}

function headerText(r: HttpResponse): string {
  return [statusLine(r), ...r.headers.map(([k, v]) => `${k}: ${v}`)].join('\n') + '\n\n';
}

const header = (r: HttpResponse, name: string) => r.headers.find(([k]) => k.toLowerCase() === name)?.[1];

function connectError(kind: Exclude<Connect, 'ok'>, host: string, port: number): string {
  switch (kind) {
    case 'refused':
    case 'netunreach':
      return `curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server`;
    case 'hostunreach':
      return `curl: (7) Failed to connect to ${host} port ${port} after 3071 ms: Couldn't connect to server`;
    case 'timeout':
      return `curl: (28) Failed to connect to ${host} port ${port} after 134023 ms: Timeout was reached`;
  }
}

/** Var curl ska spara: -o FIL, -O (filnamnet i URL:en) eller standard ut. */
function saveFile(ctx: CmdCtx, path: string, content: string): string | null {
  try {
    ctx.sh.vfs.writeFile(ctx.sh.resolve(path), content, ctx.sh.currentUser());
    return null;
  } catch (e) {
    return fsMessage(e);
  }
}

const curl: CommandDef = {
  name: 'curl',
  summary: 'Hämtar data från en webbadress (URL)',
  summaryEn: 'Transfer data from or to a server (URL)',
  man: `NAMN
       curl - hämta (eller skicka) data via en URL

SYNOPSIS
       curl [FLAGGOR] URL

BESKRIVNING
       curl skriver det den hämtar direkt i terminalen (standard ut), så
       att det går att skicka vidare i en pipe. Använd -o eller -O för att
       spara till en fil.

FLAGGOR
       -o FIL   spara till FIL
       -O       spara med filnamnet från URL:en
       -I       visa bara svarshuvudena (headers)
       -i       visa svarshuvudena före innehållet
       -L       följ omdirigeringar (301/302)
       -s       tyst: ingen förloppsmätare och inga felmeddelanden
       -S       visa fel även med -s
       -f       misslyckas (kod 22) om servern svarar med ett fel, t.ex. 404
       -v       visa hela samtalet med servern

EXEMPEL
       curl http://localhost:8080
       curl -I https://example.com
       curl -L http://linux.org
       curl -o sida.html https://example.com`,
  manEn: `NAME
       curl - transfer data from or to a URL

SYNOPSIS
       curl [OPTIONS] URL

DESCRIPTION
       curl writes what it fetches straight to the terminal (standard
       output), so that it can be piped further. Use -o or -O to save it to
       a file.

OPTIONS
       -o FILE  write to FILE
       -O       write to a file named like the remote file
       -I       show the response headers only
       -i       include the response headers before the body
       -L       follow redirects (301/302)
       -s       silent: no progress meter and no error messages
       -S       show errors even with -s
       -f       fail (exit code 22) on server errors such as 404
       -v       verbose, show the whole conversation with the server

EXAMPLES
       curl http://localhost:8080
       curl -I https://example.com
       curl -L http://linux.org
       curl -o page.html https://example.com`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, {
      flags: 'sSLIifvOkV#',
      values: 'oHAXdmwe',
      long: {
        silent: 's',
        'show-error': 'S',
        location: 'L',
        head: 'I',
        include: 'i',
        fail: 'f',
        verbose: 'v',
        'remote-name': 'O',
        insecure: 'k',
        version: 'V',
        output: 'o',
        header: 'H',
        'user-agent': 'A',
        request: 'X',
        data: 'd',
        'max-time': 'm',
        'write-out': 'w',
        referer: 'e',
      },
    });
    if (o.error) {
      const opt = /'(.+?)'/.exec(o.error)?.[1] ?? o.error;
      ctx.err(`curl: option ${opt.startsWith('-') ? opt : '-' + opt}: is unknown\ncurl: try 'curl --help' or 'curl --manual' for more information\n`);
      return 2;
    }
    const f = o.flags;
    if (f.has('V')) {
      ctx.out(`curl 8.15.0 (x86_64-pc-linux-gnu) libcurl/8.15.0 OpenSSL/3.5.1 zlib/1.3.1 brotli/1.1.0 zstd/1.5.7 libidn2/2.3.8 nghttp2/1.66.0\nProtocols: dict file ftp ftps http https imap imaps mqtt pop3 pop3s rtsp smtp smtps telnet tftp ws wss\n`);
      return 0;
    }
    const raw = o.operands[0];
    if (!raw) {
      ctx.err("curl: try 'curl --help' or 'curl --manual' for more information\n");
      return 2;
    }
    const silent = f.has('s') && !f.has('S');
    const fail = (code: number, msg: string) => {
      if (!silent) ctx.err(msg + '\n');
      return code;
    };
    let current = raw;
    let response: HttpResponse | null = null;
    let headersOut = '';
    let url: Url | null = null;
    for (let redirects = 0; ; redirects++) {
      const u = parseUrl(current);
      if ('error' in u) {
        return u.error === 'protocol'
          ? fail(1, `curl: (1) Protocol "${u.scheme}" not supported`)
          : fail(3, 'curl: (3) URL rejected: Malformed input to a URL function');
      }
      url = u;
      const r = resolveHost(sh, u.host);
      if (!r.ok) return fail(6, `curl: (6) Could not resolve host: ${u.host}`);
      if (f.has('v')) ctx.err(`*   Trying ${r.ip}:${u.port}...\n`);
      const c = connect(sh, r.ip, u.port);
      if (c !== 'ok') return fail(c === 'timeout' ? 28 : 7, connectError(c, u.host, u.port));
      const res = httpRequest(sh, r.ip, u.port, u.scheme === 'https', u.hostPort, u.path);
      if (res === 'not-http') return fail(1, 'curl: (1) Received HTTP/0.9 when not allowed');
      if (res === 'tls-error') return fail(35, 'curl: (35) OpenSSL/3.5.1: error:0A00010B:SSL routines::wrong version number');
      if (res === 'empty') return fail(52, 'curl: (52) Empty reply from server');
      if (f.has('v')) {
        const method = f.has('I') ? 'HEAD' : 'GET';
        ctx.err(
          `* Connected to ${u.host} (${r.ip}) port ${u.port}\n` +
            (u.scheme === 'https' ? `* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384\n` : '') +
            `> ${method} ${u.path} ${res.version === 'HTTP/2' ? 'HTTP/2' : 'HTTP/1.1'}\n> Host: ${u.hostPort}\n> User-Agent: curl/8.15.0\n> Accept: */*\n>\n` +
            headerText(res).trimEnd().split('\n').map((l) => `< ${l}\n`).join('') +
            '<\n',
        );
      }
      response = res;
      if (f.has('I') || f.has('i')) headersOut += headerText(res);
      const location = header(res, 'location');
      if (f.has('L') && res.status >= 300 && res.status < 400 && location) {
        if (redirects >= 50) return fail(47, 'curl: (47) Maximum (50) redirects followed');
        current = joinUrl(u, location);
        continue;
      }
      break;
    }
    const res = response!;
    if (f.has('f') && res.status >= 400) return fail(22, `curl: (22) The requested URL returned error: ${res.status}`);
    const body = f.has('I') ? '' : res.body;
    const output = headersOut + body;
    let target = o.values.o;
    if (f.has('O') && target === undefined) {
      target = basename(url!.path.split('?')[0]);
      if (!target || url!.path.endsWith('/')) return fail(23, 'curl: (23) Remote file name has no length');
    }
    if (target !== undefined && target !== '-') {
      const err = saveFile(ctx, target, output);
      if (err) {
        if (!silent) ctx.err(`Warning: Failed to open the file ${target}: ${err}\n`);
        return fail(23, 'curl: (23) Failure writing output to destination');
      }
      if (!f.has('s')) {
        const size = String(byteLength(output));
        ctx.err(
          '  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n' +
            '                                 Dload  Upload   Total   Spent    Left  Speed\n' +
            `100 ${size.padStart(5)}  100 ${size.padStart(5)}    0     0  ${String(Number(size) * 9).padStart(5)}      0 --:--:-- --:--:-- --:--:--  ${String(Number(size) * 9).padStart(5)}\n`,
        );
      }
    } else {
      ctx.out(output);
    }
    if (!f.has('L') && !f.has('s') && res.status >= 300 && res.status < 400 && ctx.isTTY) {
      note(ctx, {
        sv: `(Servern svarade ${res.status} ${res.reason} – sidan har flyttat till ${header(res, 'location')}. Lägg till -L så följer curl efter.)`,
        en: `(The server answered ${res.status} ${res.reason} – the page has moved to ${header(res, 'location')}. Add -L to make curl follow it.)`,
      });
    }
    return 0;
  },
};

function wgetTime(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function humanBytes(n: number): string {
  return n < 1024 ? `${n}` : `${(n / 1024).toFixed(1)}K`;
}

const wget: CommandDef = {
  name: 'wget',
  summary: 'Laddar ner filer från webben',
  summaryEn: 'Download files from the web',
  man: `NAMN
       wget - ladda ner filer från webben

SYNOPSIS
       wget [-q] [-O FIL] [-P KATALOG] URL

BESKRIVNING
       wget sparar alltid det den hämtar som en fil (till skillnad från
       curl, som skriver i terminalen). Filnamnet tas från URL:en, och
       index.html används om URL:en slutar med /. wget följer
       omdirigeringar automatiskt.

FLAGGOR
       -O FIL      spara som FIL (-O - skriver till standard ut)
       -P KATALOG  spara i KATALOG
       -q          tyst

EXEMPEL
       wget https://example.com/cheatsheet.txt
       wget -O exempel.html https://example.com`,
  manEn: `NAME
       wget - download files from the web

SYNOPSIS
       wget [-q] [-O FILE] [-P DIRECTORY] URL

DESCRIPTION
       wget always saves what it fetches as a file (unlike curl, which
       writes to the terminal). The file name is taken from the URL, and
       index.html is used when the URL ends with /. wget follows redirects
       automatically.

OPTIONS
       -O FILE       save as FILE (-O - writes to standard output)
       -P DIRECTORY  save in DIRECTORY
       -q            quiet

EXAMPLES
       wget https://example.com/cheatsheet.txt
       wget -O example.html https://example.com`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, {
      flags: 'qcnvV',
      values: 'OPt',
      long: { quiet: 'q', continue: 'c', verbose: 'v', version: 'V', 'output-document': 'O', 'directory-prefix': 'P', tries: 't' },
    });
    if (o.error) {
      ctx.err(`wget: ${o.error}\nUsage: wget [OPTION]... [URL]...\n\nTry \`wget --help' for more options.\n`);
      return 2;
    }
    if (o.flags.has('V')) {
      ctx.out('GNU Wget 1.25.0 built on linux-gnu.\n');
      return 0;
    }
    const raw = o.operands[0];
    if (!raw) {
      ctx.err("wget: missing URL\nUsage: wget [OPTION]... [URL]...\n\nTry `wget --help' for more options.\n");
      return 1;
    }
    const quiet = o.flags.has('q');
    const log = (s: string) => {
      if (!quiet) ctx.err(s);
    };
    let current = raw;
    let res: HttpResponse | null = null;
    let url: Url | null = null;
    for (let redirects = 0; ; redirects++) {
      const u = parseUrl(current);
      if ('error' in u) {
        ctx.err(u.error === 'protocol' ? `${current}: Unsupported scheme ‘${u.scheme}’.\n` : `${current}: Invalid URL.\n`);
        return 1;
      }
      url = u;
      const shown = /^\w+:\/\//.test(current) ? current : `http://${current}`;
      log(`--${wgetTime()}--  ${shown}\n`);
      let ipAddr = u.host;
      if (!isIPv4(u.host)) {
        const r = resolveHost(sh, u.host);
        if (!r.ok) {
          log(`Resolving ${u.host} (${u.host})... failed: ${resolveErrorText(r.error)}.\n`);
          ctx.err(`wget: unable to resolve host address ‘${u.host}’\n`);
          return 4;
        }
        ipAddr = r.ip;
        log(`Resolving ${u.host} (${u.host})... ${ipAddr}\n`);
      }
      const where = isIPv4(u.host) ? `${u.host}:${u.port}` : `${u.host} (${u.host})|${ipAddr}|:${u.port}`;
      const c = connect(sh, ipAddr, u.port);
      if (c !== 'ok') {
        const why = { refused: 'Connection refused', timeout: 'Connection timed out', netunreach: 'Network is unreachable', hostunreach: 'No route to host' }[c];
        log(`Connecting to ${where}... failed: ${why}.\n`);
        if (quiet) ctx.err(`wget: ${u.host}: ${why}\n`);
        return 4;
      }
      log(`Connecting to ${where}... connected.\n`);
      const r = httpRequest(sh, ipAddr, u.port, u.scheme === 'https', u.hostPort, u.path);
      if (r === 'tls-error') {
        ctx.err('OpenSSL: error:0A00010B:SSL routines::wrong version number\nUnable to establish SSL connection.\n');
        return 4;
      }
      if (r === 'not-http' || r === 'empty') {
        log('HTTP request sent, awaiting response... No data received.\n');
        return 4;
      }
      log(`HTTP request sent, awaiting response... ${r.status} ${r.reason}\n`);
      const location = header(r, 'location');
      if (r.status >= 300 && r.status < 400 && location) {
        if (redirects >= 20) {
          ctx.err('20 redirections exceeded.\n');
          return 8;
        }
        current = joinUrl(u, location);
        log(`Location: ${current} [following]\n`);
        continue;
      }
      res = r;
      break;
    }
    if (res.status >= 400) {
      ctx.err(`${wgetTime()} ERROR ${res.status}: ${res.reason}.\n\n`);
      return 8;
    }
    const size = byteLength(res.body);
    const type = (header(res, 'content-type') ?? 'text/plain').split(';')[0];
    log(`Length: ${size}${size < 1024 ? '' : ` (${humanBytes(size)})`} [${type}]\n`);
    let target = o.values.O;
    if (target === '-') {
      log('Saving to: ‘STDOUT’\n\n');
      ctx.out(res.body);
      log(`\n${wgetTime()} (12.4 MB/s) - written to stdout [${size}/${size}]\n\n`);
      return 0;
    }
    if (target === undefined) {
      const path = url!.path.split('?')[0];
      const name = path.endsWith('/') ? 'index.html' : basename(path);
      const dir = o.values.P ? o.values.P.replace(/\/$/, '') + '/' : '';
      target = dir + name;
      for (let n = 1; sh.vfs.tryLookup(sh.resolve(target), sh.rootUser()); n++) target = `${dir}${name}.${n}`;
    }
    log(`Saving to: ‘${target}’\n\n`);
    const err = saveFile(ctx, target, res.body);
    if (err) {
      ctx.err(`${target}: ${err}\n`);
      return 3;
    }
    log(`${basename(target).padEnd(18)} 100%[===================>]  ${humanBytes(size).padStart(6)}  --.-KB/s    in 0s      \n\n`);
    log(`${wgetTime()} (12.4 MB/s) - ‘${target}’ saved [${size}/${size}]\n\n`);
    return 0;
  },
};

// ---------- minserver ----------

const minserver: CommandDef = {
  name: 'minserver',
  summary: 'Startar övningsservern (en liten webbserver)',
  summaryEn: 'Start the practice server (a tiny web server)',
  man: `NAMN
       minserver - en liten webbserver att öva på

SYNOPSIS
       minserver [--port PORT]

BESKRIVNING
       Startar en webbserver som körs i bakgrunden (som en tjänst) och
       lyssnar på port 8080. Prova "curl http://localhost:8080" och
       "ss -tlpn". Portar under 1024 kräver root.

EXEMPEL
       minserver
       minserver --port 9090
       pkill minserver`,
  manEn: `NAME
       minserver - a tiny web server to practise with

SYNOPSIS
       minserver [--port PORT]

DESCRIPTION
       Starts a web server that runs in the background (as a service) and
       listens on port 8080. Try "curl http://localhost:8080" and
       "ss -tlpn". Ports below 1024 require root.

EXAMPLES
       minserver
       minserver --port 9090
       pkill minserver`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, { values: 'p', long: { port: 'p' } });
    if (o.error) return badOption(ctx, o.error);
    const port = Number(o.values.p ?? 8080);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      ctx.err(`minserver: invalid port '${o.values.p}'\n`);
      return 2;
    }
    if (listeners(sh).some((l) => l.proto === 'tcp' && l.port === port)) {
      ctx.err(`minserver: bind 0.0.0.0:${port}: Address already in use\n`);
      return 1;
    }
    if (port < 1024 && !isRoot(ctx)) {
      ctx.err(`minserver: bind 0.0.0.0:${port}: Permission denied\n`);
      return 1;
    }
    const pid = sh.proc.nextPid++;
    sh.proc.procs.push({
      pid,
      ppid: 1,
      user: sh.currentUser().name,
      cmd: `/usr/local/bin/minserver --port ${port}`,
      cpu: 0.3,
      mem: 1.2,
      vsz: 182_340,
      rss: 24_116,
      tty: '?',
      stat: 'Ssl',
      start: new Date().toTimeString().slice(0, 5),
      time: '0:00',
    });
    ctx.out(`minserver 1.0: listening on http://0.0.0.0:${port}/ (pid ${pid})\n`);
    if (ctx.isTTY) {
      note(ctx, {
        sv: `(minserver körs nu i bakgrunden. Prova  curl http://localhost:${port}  – och stoppa den med  pkill minserver)`,
        en: `(minserver now runs in the background. Try  curl http://localhost:${port}  – and stop it with  pkill minserver)`,
      });
    }
    return 0;
  },
};

export const NET_COMMANDS: CommandDef[] = [ip, ping, ss, dig, host, nslookup, getent, traceroute, curl, wget, minserver];
