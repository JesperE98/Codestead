// GitHub's release downloads for packaging/native-update-test.sh, inside its container: the container's /etc/hosts
// sends github.com and objects.githubusercontent.com here, and the container trusts the test's throw-away CA, so the
// hub downloads its update from the real addresses (nothing in the app can point it elsewhere). As GitHub does,
// https://github.com/<repo>/releases/download/<tag>/<file> redirects to the download host, which serves
// <release-dir>/<tag>/<file>; while <release-dir>/../redirect-away exists, it redirects the files it names (one name a
// line; empty: every file) to elsewhere.test instead (which serves the same files), which the app must refuse. Every
// request is logged.
// Run with the installed app's Electron as Node:
//   ELECTRON_RUN_AS_NODE=1 /opt/<id>/<exe>.bin native-update-server.cjs <release-dir> <cert.pem> <key.pem> <owner/repo>
"use strict";
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const [root, cert, key, repo] = process.argv.slice(2);
if (!repo) throw new Error("Usage: native-update-server.cjs <release-dir> <cert.pem> <key.pem> <owner/repo>");
const releases = `/${repo}/releases/download/`;
const assets = "/test-release-asset/";
const base = path.resolve(root);

https
  .createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, (req, res) => {
    const host = (req.headers.host || "").replace(/:\d+$/, "");
    const url = new URL(req.url || "/", `https://${host}`);
    console.log(`${req.method} https://${host}${url.pathname}`);
    if (host === "github.com" && url.pathname.startsWith(releases)) {
      const away = path.join(base, "..", "redirect-away");
      const names = fs.existsSync(away) ? fs.readFileSync(away, "utf8").split("\n").filter((n) => n !== "") : null;
      const file = decodeURIComponent(url.pathname.split("/").pop() || "");
      const to = names !== null && (names.length === 0 || names.includes(file)) ? "elsewhere.test" : "objects.githubusercontent.com";
      res.writeHead(302, { location: `https://${to}${assets}${url.pathname.slice(releases.length)}?test=1` });
      res.end();
      return;
    }
    if ((host === "objects.githubusercontent.com" || host === "elsewhere.test") && url.pathname.startsWith(assets)) {
      const file = path.resolve(base, decodeURIComponent(url.pathname.slice(assets.length)));
      const stat = file.startsWith(base + path.sep) && fs.existsSync(file) ? fs.statSync(file) : null;
      if (stat !== null && stat.isFile()) {
        res.writeHead(200, { "content-type": "application/octet-stream", "content-length": String(stat.size) });
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
  })
  .listen(443, "127.0.0.1", () => console.log("listening on 127.0.0.1:443"));
