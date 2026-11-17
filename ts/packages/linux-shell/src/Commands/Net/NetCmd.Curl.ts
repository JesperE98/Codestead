// Port of Commands/Net/NetCmd.Curl.cs – the curl command: transfer data from or to a server (URL).

import { Js } from "../../Js.js";
import type { HttpResponse } from "../../Network/HttpResponse.js";
import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { header, joinUrl, note, parseUrl, saveFile, type Url } from "./NetCmd.js";

const quotedRe = /'(.+?)'/;

function statusLine(r: HttpResponse): string {
  return r.version === "HTTP/2" ? `HTTP/2 ${r.status}` : `${r.version} ${r.status} ${r.reason}`;
}

function headerText(r: HttpResponse): string {
  return [statusLine(r), ...r.headers.map((h) => `${h.key}: ${h.value}`)].join("\n") + "\n\n";
}

function connectError(kind: string, host: string, port: string): string {
  switch (kind) {
    case "refused":
    case "netunreach":
      return `curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server`;
    case "hostunreach":
      return `curl: (7) Failed to connect to ${host} port ${port} after 3071 ms: Couldn't connect to server`;
    default:
      return `curl: (28) Failed to connect to ${host} port ${port} after 134023 ms: Timeout was reached`;
  }
}

export const curl: CommandDef = {
  name: "curl",
  summary: "Hämtar data från en webbadress (URL)",
  summaryEn: "Transfer data from or to a server (URL)",
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
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "sSLIifvOkV#",
      values: "oHAXdmwe",
      long: {
        silent: "s",
        "show-error": "S",
        location: "L",
        head: "I",
        include: "i",
        fail: "f",
        verbose: "v",
        "remote-name": "O",
        insecure: "k",
        version: "V",
        output: "o",
        header: "H",
        "user-agent": "A",
        request: "X",
        data: "d",
        "max-time": "m",
        "write-out": "w",
        referer: "e",
      },
    });
    if (o.error !== null) {
      const qm = quotedRe.exec(o.error);
      const opt = qm ? qm[1]! : o.error;
      ctx.err(`curl: option ${opt.startsWith("-") ? opt : "-" + opt}: is unknown\ncurl: try 'curl --help' or 'curl --manual' for more information\n`);
      return 2;
    }
    const f = o.flags;
    if (f.has("V")) {
      ctx.out(
        "curl 8.15.0 (x86_64-pc-linux-gnu) libcurl/8.15.0 OpenSSL/3.5.1 zlib/1.3.1 brotli/1.1.0 zstd/1.5.7 libidn2/2.3.8 nghttp2/1.66.0\nProtocols: dict file ftp ftps http https imap imaps mqtt pop3 pop3s rtsp smtp smtps telnet tftp ws wss\n",
      );
      return 0;
    }
    const raw = o.operands[0] ?? null;
    if (!raw) {
      ctx.err("curl: try 'curl --help' or 'curl --manual' for more information\n");
      return 2;
    }
    const silent = f.has("s") && !f.has("S");
    const fail = (code: number, msg: string): number => {
      if (!silent) ctx.err(msg + "\n");
      return code;
    };
    let current = raw;
    let response: HttpResponse | null = null;
    let headersOut = "";
    let url: Url | null = null;
    for (let redirects = 0; ; redirects++) {
      const { url: u, error: uerr, scheme: uscheme } = parseUrl(current);
      if (u === null) {
        return uerr === "protocol" ? fail(1, `curl: (1) Protocol "${uscheme ?? ""}" not supported`) : fail(3, "curl: (3) URL rejected: Malformed input to a URL function");
      }
      url = u;
      const port = Js.num(u.port);
      const r = NetworkLib.resolveHost(sh, u.host);
      if (!r.ok) return fail(6, `curl: (6) Could not resolve host: ${u.host}`);
      if (f.has("v")) ctx.err(`*   Trying ${r.ip}:${port}...\n`);
      const c = NetworkLib.connect(sh, r.ip, NetworkLib.toPort(u.port));
      if (c !== "ok") return fail(c === "timeout" ? 28 : 7, connectError(c, u.host, port));
      const { response: res, error: herr } = NetworkLib.httpRequest(sh, r.ip, NetworkLib.toPort(u.port), u.scheme === "https", u.hostPort, u.path);
      if (herr === "not-http") return fail(1, "curl: (1) Received HTTP/0.9 when not allowed");
      if (herr === "tls-error") return fail(35, "curl: (35) OpenSSL/3.5.1: error:0A00010B:SSL routines::wrong version number");
      if (herr === "empty") return fail(52, "curl: (52) Empty reply from server");
      const resp = res!;
      if (f.has("v")) {
        const method = f.has("I") ? "HEAD" : "GET";
        ctx.err(
          `* Connected to ${u.host} (${r.ip}) port ${port}\n` +
            (u.scheme === "https" ? "* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384\n" : "") +
            `> ${method} ${u.path} ${resp.version === "HTTP/2" ? "HTTP/2" : "HTTP/1.1"}\n> Host: ${u.hostPort}\n> User-Agent: curl/8.15.0\n> Accept: */*\n>\n` +
            headerText(resp)
              .trimEnd()
              .split("\n")
              .map((l) => `< ${l}\n`)
              .join("") +
            "<\n",
        );
      }
      response = resp;
      if (f.has("I") || f.has("i")) headersOut += headerText(resp);
      const location = header(resp, "location");
      if (f.has("L") && resp.status >= 300 && resp.status < 400 && location) {
        if (redirects >= 50) return fail(47, "curl: (47) Maximum (50) redirects followed");
        current = joinUrl(u, location);
        continue;
      }
      break;
    }
    const resp = response!;
    if (f.has("f") && resp.status >= 400) return fail(22, `curl: (22) The requested URL returned error: ${resp.status}`);
    const body = f.has("I") ? "" : resp.body;
    const output = headersOut + body;
    let target = o.values.get("o") ?? null;
    if (f.has("O") && target === null) {
      target = VfsLib.basename(url!.path.split("?")[0]!);
      if (target === "" || url!.path.endsWith("/")) return fail(23, "curl: (23) Remote file name has no length");
    }
    if (target !== null && target !== "-") {
      const err = saveFile(ctx, target, output);
      if (err !== null) {
        if (!silent) ctx.err(`Warning: Failed to open the file ${target}: ${err}\n`);
        return fail(23, "curl: (23) Failure writing output to destination");
      }
      if (!f.has("s")) {
        const size = Js.num(NetworkLib.byteLength(output));
        const speed = Js.num(NetworkLib.byteLength(output) * 9);
        ctx.err(
          "  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n" +
            "                                 Dload  Upload   Total   Spent    Left  Speed\n" +
            `100 ${size.padStart(5)}  100 ${size.padStart(5)}    0     0  ${speed.padStart(5)}      0 --:--:-- --:--:-- --:--:--  ${speed.padStart(5)}\n`,
        );
      }
    } else {
      ctx.out(output);
    }
    if (!f.has("L") && !f.has("s") && resp.status >= 300 && resp.status < 400 && ctx.isTTY) {
      const loc = header(resp, "location") ?? "undefined";
      note(ctx, "net.curlRedirect", { status: resp.status, reason: resp.reason, location: loc });
    }
    return 0;
  },
};
