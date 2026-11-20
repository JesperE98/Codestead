// Networking: why getent finds server.lan but dig does not. getent asks as the system does – /etc/hosts first, then
// DNS (hosts: files dns in /etc/nsswitch.conf) – and finds the line the chapter added; dig asks DNS only, which has no
// server.lan. The outputs are the simulator's. No words.
import { C, FS, PAD, W, arrow, arrowPath, code, shared, svg, textWidth } from "./style.mjs";
import { chip, strip } from "./_admin.mjs";

export const variants = shared("hosts-dns");

export const terminals = {
  lookup: {
    setup: ["echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts", "sudo apt update", "sudo apt install -y dnsutils"],
    commands: ["grep hosts /etc/nsswitch.conf", "getent hosts server.lan", "dig +short server.lan"],
  },
};

const COL = (W - 2 * PAD - 24) / 2; // a command's column
const STRIP_Y = PAD + 76;
const HOSTS_Y = STRIP_Y + 54; // the /etc/hosts box's top
const HOSTS_H = 112;
const DNS_Y = HOSTS_Y + HOSTS_H + 40;
const DNS_H = 56;
const OUT_Y = DNS_Y + DNS_H + 52; // the output's middle
export const height = OUT_Y + 24 + PAD;

const text = (rows) => rows.map((row) => row.map((r) => r.text).join(""));

/** The /etc/hosts box: its first line, … and the line the chapter added (green when it is the one found). */
function hosts(x, w, active) {
  const ink = active ? C.ink : C.line;
  let s = `<rect x="${x}" y="${HOSTS_Y}" width="${w}" height="${HOSTS_H}" rx="6" fill="${active ? "#ffffff" : C.card}" stroke="${active ? C.y : C.line}" stroke-width="${active ? 2 : 1.5}"${active ? "" : ` stroke-dasharray="5 4"`}/>`;
  s += code(x + 14, HOSTS_Y + 22, "/etc/hosts", { weight: 800, color: active ? C.y : C.line });
  s += code(x + 14, HOSTS_Y + 52, "127.0.0.1 localhost", { color: ink });
  if (active) s += `<rect x="${x + 8}" y="${HOSTS_Y + 70}" width="${w - 16}" height="30" rx="4" fill="${C.ySoft}"/>`;
  s += code(x + 14, HOSTS_Y + 85, "192.168.1.10 server.lan", { color: ink, weight: active ? 700 : 500 });
  return s;
}

/** The DNS box: asked (dig) with no answer, or not asked (getent found the name before). */
function dns(x, w, asked) {
  let s = `<rect x="${x}" y="${DNS_Y}" width="${w}" height="${DNS_H}" rx="6" fill="${asked ? "#ffffff" : C.card}" stroke="${asked ? C.x : C.line}" stroke-width="${asked ? 2 : 1.5}"${asked ? "" : ` stroke-dasharray="5 4"`}/>`;
  s += code(x + 14, DNS_Y + DNS_H / 2, "DNS", { weight: 800, color: asked ? C.x : C.line });
  s += code(x + 72, DNS_Y + DNS_H / 2, "server.lan ?", { color: asked ? C.ink : C.line });
  if (asked) s += `<path d="M${x + w - 38},${DNS_Y + 16} l22,24 M${x + w - 16},${DNS_Y + 16} l-22,24" stroke="${C.x}" stroke-width="3.5" stroke-linecap="round"/>`;
  return s;
}

export function draw(v, R) {
  const [nss, getent, dig] = R.lookup.lines.map((l) => text(l.output));
  let s = "";
  // At the top: the order the system asks in.
  const nssLine = nss[0].replace(/\s+/g, " ");
  const nw = textWidth(nssLine, FS, true) + 28;
  s += `<rect x="${(W - nw) / 2}" y="${PAD}" width="${nw}" height="40" rx="6" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="1.5"/>`;
  s += code(W / 2, PAD + 20, nssLine, { anchor: "middle", weight: 600 });
  // The two commands, each in its column.
  const ax = PAD, bx = PAD + COL + 24;
  const a = strip(ax + COL / 2, STRIP_Y, "getent hosts server.lan", { anchor: "middle" });
  const b = strip(bx + COL / 2, STRIP_Y, "dig +short server.lan", { anchor: "middle" });
  s += a.svg + b.svg;
  // getent: /etc/hosts, found – DNS is never asked.
  s += hosts(ax, COL, true) + dns(ax + 44, COL - 44, false);
  s += arrow(ax + COL / 2, STRIP_Y + 22, ax + COL / 2, HOSTS_Y - 2, { color: C.y, width: 2.5 });
  s += arrowPath(`M${ax + 20},${HOSTS_Y + HOSTS_H + 2} V${OUT_Y - 12} Q${ax + 20},${OUT_Y} ${ax + 30},${OUT_Y}`, ax + 32, OUT_Y, 1, 0, { color: C.y, width: 2.5 });
  s += chip(ax + 34, OUT_Y, getent[0].replace(/\s+/g, " "), { style: "y" });
  // dig: straight past /etc/hosts to DNS, which has no server.lan – the output is empty.
  s += hosts(bx, COL - 44, false) + dns(bx, COL, true);
  const lane = bx + COL - 22;
  s += arrowPath(`M${bx + COL / 2 + 40},${STRIP_Y + 22} C${bx + COL / 2 + 60},${STRIP_Y + 44} ${lane},${HOSTS_Y - 30} ${lane},${HOSTS_Y + 10} V${DNS_Y - 4}`, lane, DNS_Y - 2, 0, 1, { color: C.x, width: 2.5 });
  s += `<rect x="${bx + COL / 2 - 60}" y="${OUT_Y - 18}" width="120" height="36" rx="6" fill="${C.card}" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  s += arrow(bx + COL / 2, DNS_Y + DNS_H + 2, bx + COL / 2, OUT_Y - 20, { color: C.line, width: 2, dash: "4 3" });
  if (dig.length > 0) throw new Error(`dig printed something: ${dig.join(" / ")}`);
  return svg(height, s);
}

