// Port of Network/NetworkLib.Web.cs – NetworkLib: answering HTTP requests (curl/wget).

import { Js } from "../Js.js";
import type { Shell } from "../Shell/Shell.js";
import type { HttpResponse } from "./HttpResponse.js";
import { Gateway, ServerIp } from "./NetworkLib.js";
import { html, internetHostByIp, text } from "./NetworkLib.Internet.js";
import { service } from "./NetworkLib.Ports.js";
import type { Page } from "./Page.js";

// ---------- Web pages ----------

const reasons = new Map<number, string>([
  [200, "OK"],
  [301, "Moved Permanently"],
  [400, "Bad Request"],
  [404, "Not Found"],
]);

export function byteLength(s: string): number {
  return Js.utf8Length(s);
}

/** RFC 1123 date ("r" in .NET), e.g. "Tue, 17 Nov 2026 12:00:00 GMT". */
function httpDate(): string {
  return new Date(Js.now()).toUTCString();
}

function makeMyserverPages(): Map<string, Page> {
  const pages = new Map<string, Page>([
    ["/", html("Hello from myserver!", "This page is served by the process <b>myserver</b> on port 8080 of your own computer.")],
    ["/about.html", html("About myserver", "myserver 1.0 is a tiny practice web server. Its log is server.log in your documents folder.")],
    ["/report", text("Report: 12 requests today, 3 errors, 1 slow request.\n")],
  ]);
  pages.set("/index.html", pages.get("/")!);
  return pages;
}

const myserverPages = makeMyserverPages();

const serverPages = new Map<string, Page>([
  ["/", html("server.lan", "The school server. Log in with ssh and your user name, e.g. ssh student@server.lan")],
  ["/hello.txt", text("Hello from the server!\n")],
]);

const routerPages = new Map<string, Page>([["/", html("Router login", "Log in to configure your home router (192.168.1.1).")]]);

/**
 * The answer to an HTTP request. Assumes connect() gave "ok". When the service does not speak HTTP,
 * response is null and error is "not-http", "tls-error" or "empty".
 */
export function httpRequest(
  sh: Shell,
  ip: string,
  port: number,
  https: boolean,
  hostHeader: string,
  path: string,
): { response: HttpResponse | null; error: string | null } {
  const svc = service(sh, ip, port);
  if (svc === "ssh") return { response: null, error: "not-http" };
  if (svc === "dns") return { response: null, error: "empty" };
  if (https && svc !== "https") return { response: null, error: "tls-error" };
  let p = path.split("?")[0]!;
  if (p === "") p = "/";

  if (svc === "myserver") return { response: respond("HTTP/1.0", myserverPages.get(p) ?? null, [{ key: "Server", value: "myserver/1.0" }]), error: null };
  if (ip === ServerIp) return { response: respond("HTTP/1.1", serverPages.get(p) ?? null, [{ key: "Server", value: "nginx/1.26.3" }]), error: null };
  if (ip === Gateway) return { response: respond("HTTP/1.1", routerPages.get(p) ?? null, [{ key: "Server", value: "lighttpd/1.4.76" }]), error: null };

  const host = internetHostByIp(ip)!;
  if (!https && svc === "https") {
    return { response: respond("HTTP/1.1", html("400 The plain HTTP request was sent to HTTPS port", "Use https:// instead."), [], 400), error: null };
  }
  if (!https && host.redirectHttp) {
    const location = `https://${hostHeader}${p}`;
    const body =
      "<html>\r\n<head><title>301 Moved Permanently</title></head>\r\n<body>\r\n<center><h1>301 Moved Permanently</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>\r\n";
    return {
      response: {
        status: 301,
        reason: reasons.get(301)!,
        version: "HTTP/1.1",
        headers: [
          { key: "Server", value: "nginx" },
          { key: "Date", value: httpDate() },
          { key: "Content-Type", value: "text/html" },
          { key: "Content-Length", value: Js.num(byteLength(body)) },
          { key: "Connection", value: "keep-alive" },
          { key: "Location", value: location },
        ],
        body,
      },
      error: null,
    };
  }
  return { response: respond(https ? "HTTP/2" : "HTTP/1.1", host.pages.get(p) ?? null, []), error: null };
}

function respond(version: string, page: Page | null, extra: { key: string; value: string }[], status: number | null = null): HttpResponse {
  const st = status ?? (page !== null ? 200 : 404);
  const p = page ?? html("404 Not Found", "The requested URL was not found on this server.");
  const headers = [
    { key: "Content-Type", value: p.type },
    { key: "Content-Length", value: Js.num(byteLength(p.body)) },
    { key: "Date", value: httpDate() },
    ...extra,
  ];
  const h2 = version === "HTTP/2";
  return {
    status: st,
    reason: reasons.get(st) ?? "",
    version,
    headers: h2 ? headers.map((h) => ({ key: h.key.toLowerCase(), value: h.value })) : headers,
    body: p.body,
  };
}
