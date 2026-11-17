// Port of Commands/Net/NetCmd.Wget.cs – the wget command: download files from the web.

import { Js } from "../../Js.js";
import type { HttpResponse } from "../../Network/HttpResponse.js";
import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { header, joinUrl, parseUrl, saveFile, type Url } from "./NetCmd.js";

const anySchemeRe = /^[A-Za-z0-9_]+:\/\//;

/** The local time as "yyyy-MM-dd HH:mm:ss". */
function wgetTime(): string {
  const d = Js.localNow();
  return `${String(d.getFullYear()).padStart(4, "0")}-${Js.pad2(d.getMonth() + 1)}-${Js.pad2(d.getDate())} ${Js.hhmmss(d)}`;
}

function humanBytes(n: number): string {
  return n < 1024 ? Js.num(n) : `${Js.toFixed(n / 1024.0, 1)}K`;
}

const why = new Map<string, string>([
  ["refused", "Connection refused"],
  ["timeout", "Connection timed out"],
  ["netunreach", "Network is unreachable"],
  ["hostunreach", "No route to host"],
]);

export const wget: CommandDef = {
  name: "wget",
  summary: "Laddar ner filer från webben",
  summaryEn: "Download files from the web",
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
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "qcnvV",
      values: "OPt",
      long: { quiet: "q", continue: "c", verbose: "v", version: "V", "output-document": "O", "directory-prefix": "P", tries: "t" },
    });
    if (o.error !== null) {
      ctx.err(`wget: ${o.error}\nUsage: wget [OPTION]... [URL]...\n\nTry \`wget --help' for more options.\n`);
      return 2;
    }
    if (o.flags.has("V")) {
      ctx.out("GNU Wget 1.25.0 built on linux-gnu.\n");
      return 0;
    }
    const raw = o.operands[0] ?? null;
    if (!raw) {
      ctx.err("wget: missing URL\nUsage: wget [OPTION]... [URL]...\n\nTry `wget --help' for more options.\n");
      return 1;
    }
    const quiet = o.flags.has("q");
    const log = (s: string): void => {
      if (!quiet) ctx.err(s);
    };
    let current = raw;
    let res: HttpResponse | null = null;
    let url: Url | null = null;
    for (let redirects = 0; ; redirects++) {
      const { url: u, error: uerr, scheme: uscheme } = parseUrl(current);
      if (u === null) {
        ctx.err(uerr === "protocol" ? `${current}: Unsupported scheme ‘${uscheme ?? ""}’.\n` : `${current}: Invalid URL.\n`);
        return 1;
      }
      url = u;
      const port = Js.num(u.port);
      const shown = anySchemeRe.test(current) ? current : `http://${current}`;
      log(`--${wgetTime()}--  ${shown}\n`);
      let ipAddr = u.host;
      if (!NetworkLib.isIPv4(u.host)) {
        const resolved = NetworkLib.resolveHost(sh, u.host);
        if (!resolved.ok) {
          log(`Resolving ${u.host} (${u.host})... failed: ${NetworkLib.resolveErrorText(resolved.error)}.\n`);
          ctx.err(`wget: unable to resolve host address ‘${u.host}’\n`);
          return 4;
        }
        ipAddr = resolved.ip;
        log(`Resolving ${u.host} (${u.host})... ${ipAddr}\n`);
      }
      const where = NetworkLib.isIPv4(u.host) ? `${u.host}:${port}` : `${u.host} (${u.host})|${ipAddr}|:${port}`;
      const c = NetworkLib.connect(sh, ipAddr, NetworkLib.toPort(u.port));
      if (c !== "ok") {
        const reason = why.get(c)!;
        log(`Connecting to ${where}... failed: ${reason}.\n`);
        if (quiet) ctx.err(`wget: ${u.host}: ${reason}\n`);
        return 4;
      }
      log(`Connecting to ${where}... connected.\n`);
      const { response: r, error: herr } = NetworkLib.httpRequest(sh, ipAddr, NetworkLib.toPort(u.port), u.scheme === "https", u.hostPort, u.path);
      if (herr === "tls-error") {
        ctx.err("OpenSSL: error:0A00010B:SSL routines::wrong version number\nUnable to establish SSL connection.\n");
        return 4;
      }
      if (herr === "not-http" || herr === "empty") {
        log("HTTP request sent, awaiting response... No data received.\n");
        return 4;
      }
      const resp = r!;
      log(`HTTP request sent, awaiting response... ${resp.status} ${resp.reason}\n`);
      const location = header(resp, "location");
      if (resp.status >= 300 && resp.status < 400 && location) {
        if (redirects >= 20) {
          ctx.err("20 redirections exceeded.\n");
          return 8;
        }
        current = joinUrl(u, location);
        log(`Location: ${current} [following]\n`);
        continue;
      }
      res = resp;
      break;
    }
    if (res.status >= 400) {
      ctx.err(`${wgetTime()} ERROR ${res.status}: ${res.reason}.\n\n`);
      return 8;
    }
    const size = NetworkLib.byteLength(res.body);
    const type = (header(res, "content-type") ?? "text/plain").split(";")[0];
    log(`Length: ${size}${size < 1024 ? "" : ` (${humanBytes(size)})`} [${type}]\n`);
    let target = o.values.get("O") ?? null;
    if (target === "-") {
      log("Saving to: ‘STDOUT’\n\n");
      ctx.out(res.body);
      log(`\n${wgetTime()} (12.4 MB/s) - written to stdout [${size}/${size}]\n\n`);
      return 0;
    }
    if (target === null) {
      const path = url!.path.split("?")[0]!;
      const name = path.endsWith("/") ? "index.html" : VfsLib.basename(path);
      const dirOpt = o.values.get("P");
      const dir = dirOpt ? (dirOpt.endsWith("/") ? dirOpt.slice(0, -1) : dirOpt) + "/" : "";
      target = dir + name;
      for (let n = 1; sh.vfs.tryLookup(sh.resolve(target), sh.rootUser()) !== null; n++) target = `${dir}${name}.${n}`;
    }
    log(`Saving to: ‘${target}’\n\n`);
    const err = saveFile(ctx, target, res.body);
    if (err !== null) {
      ctx.err(`${target}: ${err}\n`);
      return 3;
    }
    log(`${VfsLib.basename(target).padEnd(18)} 100%[===================>]  ${humanBytes(size).padStart(6)}  --.-KB/s    in 0s      \n\n`);
    log(`${wgetTime()} (12.4 MB/s) - ‘${target}’ saved [${size}/${size}]\n\n`);
    return 0;
  },
};
