// Port of Network/NetworkLib.Internet.cs – NetworkLib: the pretend internet – its hosts and their web pages.

import type { Page } from "./Page.js";

// ---------- Internet ----------

export interface NetHost {
  names: string[];
  a: string[];
  aaaa?: string[] | null;
  /** http:// redirects to https:// (301). */
  redirectHttp?: boolean;
  /** Answers DNS queries (port 53). */
  dns?: boolean;
  pages: Map<string, Page>;
}

export function html(title: string, text: string): Page {
  return {
    type: "text/html; charset=UTF-8",
    body:
      `<!doctype html>\n<html>\n<head>\n    <title>${title}</title>\n    <meta charset="utf-8">\n</head>\n<body>\n` +
      `<h1>${title}</h1>\n<p>${text}</p>\n</body>\n</html>\n`,
  };
}

export function text(body: string): Page {
  return { type: "text/plain; charset=utf-8", body };
}

const example: Page = {
  type: "text/html",
  body: `<!doctype html>
<html>
<head>
    <title>Example Domain</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
<div>
    <h1>Example Domain</h1>
    <p>This domain is for use in documentation examples without needing permission.
    Avoid use in operations.</p>
    <p><a href="https://iana.org/domains/example">Learn more</a></p>
</div>
</body>
</html>
`,
};

const cheatsheet = text(`Linux network cheat sheet
=========================
ip a                 show your IP addresses
ip route             show the routing table (default gateway)
ping -c 3 HOST       is HOST reachable?
dig +short NAME      look up the IP address of NAME
ss -tulpn            which ports are listening?
curl URL             fetch a web page
wget URL             download a file
ssh USER@HOST CMD    run CMD on another computer
`);

const internet: NetHost[] = [
  {
    names: ["example.com", "www.example.com"],
    a: ["203.0.113.10"],
    aaaa: ["2001:db8::10"],
    pages: new Map([
      ["/", example],
      ["/index.html", example],
      ["/cheatsheet.txt", cheatsheet],
    ]),
  },
  {
    names: ["linux.org", "www.linux.org"],
    a: ["203.0.113.20"],
    redirectHttp: true,
    pages: new Map([["/", html("Linux.org", "Friendly Linux forum. Welcome, beginners!")]]),
  },
  {
    names: ["archlinux.org", "www.archlinux.org"],
    a: ["203.0.113.30"],
    aaaa: ["2001:db8::30"],
    redirectHttp: true,
    pages: new Map([["/", html("Arch Linux", "A simple, lightweight distribution.")]]),
  },
  {
    names: ["debian.org", "www.debian.org"],
    a: ["198.51.100.20"],
    aaaa: ["2001:db8:1::20"],
    redirectHttp: true,
    pages: new Map([["/", html("Debian -- The Universal Operating System", "Debian is a free operating system for your computer.")]]),
  },
  {
    names: ["ubuntu.com", "www.ubuntu.com"],
    a: ["198.51.100.30"],
    redirectHttp: true,
    pages: new Map([["/", html("Enterprise Open Source and Linux | Ubuntu", "Ubuntu is the modern, open source operating system on Linux.")]]),
  },
  {
    names: ["fedoraproject.org", "www.fedoraproject.org"],
    a: ["198.51.100.40"],
    redirectHttp: true,
    pages: new Map([["/", html("Fedora Linux", "An innovative platform for hardware, clouds and containers.")]]),
  },
  {
    names: ["kernel.org", "www.kernel.org"],
    a: ["198.51.100.50"],
    redirectHttp: true,
    pages: new Map([["/", html("The Linux Kernel Archives", "This site is operated by the Linux Kernel Organization.")]]),
  },
  {
    names: ["one.one.one.one"],
    a: ["1.1.1.1", "1.0.0.1"],
    dns: true,
    redirectHttp: true,
    pages: new Map([["/", html("1.1.1.1 — The free app that makes your Internet faster.", "Cloudflare DNS resolver.")]]),
  },
  {
    names: ["dns.google"],
    a: ["8.8.8.8", "8.8.4.4"],
    dns: true,
    redirectHttp: true,
    pages: new Map([["/", html("Google Public DNS", "Free, global DNS resolution service.")]]),
  },
];

export function normName(name: string): string {
  const n = name.toLowerCase();
  return n.endsWith(".") ? n.slice(0, -1) : n;
}

export function internetHostByName(name: string): NetHost | null {
  const n = normName(name);
  return internet.find((h) => h.names.includes(n)) ?? null;
}

export function internetHostByIp(ip: string): NetHost | null {
  return internet.find((h) => h.a.includes(ip)) ?? null;
}
