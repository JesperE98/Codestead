// Networking: the simulated home network – your computer, the server and the router in 192.168.1.0/24, the internet
// behind the router – and the two routes of `ip route` (the simulator's): the local network directly, everything else
// via the gateway. (After the questions in the text: it shows their answers.)
import { C, FS, PAD, W, arrowPath, code, label, perLanguage, svg, tag, terminal, textWidth, tr } from "./style.mjs";
import { chip, computer, words as adminWords } from "./_admin.mjs";

export const variants = perLanguage("home-network");

export const words = {
  yourComputer: adminWords.yourComputer,
  server: adminWords.server,
  router: { en: "the router (gateway)", sv: "routern (gatewayen)", de: "der Router (Gateway)", fr: "le routeur (passerelle)", es: "el router (puerta de enlace)", pt: "o roteador (gateway)", ru: "роутер (шлюз)", zh: "路由器（网关）", ja: "ルーター（ゲートウェイ）", ar: "الموجّه (البوابة)", hi: "router (gateway)" },
  lan: { en: "local network", sv: "lokalt nätverk", de: "lokales Netzwerk", fr: "réseau local", es: "red local", pt: "rede local", ru: "локальная сеть", zh: "局域网", ja: "ローカルネットワーク", ar: "الشبكة المحلية", hi: "local network" },
  internet: { en: "internet", sv: "internet", de: "Internet", fr: "Internet", es: "internet", pt: "internet", ru: "интернет", zh: "互联网", ja: "インターネット", ar: "الإنترنت", hi: "internet" },
};

export const terminals = { route: { commands: ["ip route"] } };

const LAN = { x0: PAD, y0: PAD + 18, x1: 476, y1: 360 };
const DIRECT = C.y, VIA = C.accent;
const termTop = LAN.y1 + 20;
export const height = (v, R) => termTop + terminal(0, 0, W, R.route.lines, { hidePrompt: false }).height + PAD;

/** A router: a box with two antennas and lights, (x, y) its top left. */
function router(x, y, w, h) {
  let s = `<path d="M${x + 22},${y} l-8,-22 M${x + w - 22},${y} l8,-22" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="${VIA}" stroke-width="2.5"/>`;
  for (let i = 0; i < 4; i++) s += `<circle cx="${x + 22 + i * 18}" cy="${y + h / 2}" r="4" fill="${i < 2 ? C.y : C.line}"/>`;
  return s;
}

/** A device's address (code) and word under it, centred at x. */
function caption(v, x, y, ip, word, color = C.ink) {
  return code(x, y, ip, { anchor: "middle", weight: 700, color }) + label(v, x, y + 26, word, { anchor: "middle", color: C.muted, weight: 600, fit: 250 });
}

export function draw(v, R) {
  let s = "";
  // The local network.
  s += `<rect x="${LAN.x0}" y="${LAN.y0}" width="${LAN.x1 - LAN.x0}" height="${LAN.y1 - LAN.y0}" rx="10" fill="${C.ySoft}" fill-opacity="0.5" stroke="${DIRECT}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  const lan = tr(v, words.lan);
  const lanW = Math.round(textWidth(lan) + 28);
  s += tag(v, LAN.x0 + 18, LAN.y0, lan, { color: DIRECT, stroke: DIRECT });
  s += chip(LAN.x0 + 18 + lanW + 8, LAN.y0, "192.168.1.0/24", { style: "y", h: 31 });
  // The three computers.
  const me = { x: 50, y: 150, w: 156, h: 56 };
  s += computer(v, me.x, me.y, me.w, "ubuntu", null, { color: C.accent2, h: me.h });
  s += caption(v, me.x + me.w / 2, me.y + me.h + 36, "192.168.1.42", tr(v, words.yourComputer), C.accent2);
  const srv = { x: 300, y: 228, w: 140, h: 50 };
  s += computer(v, srv.x, srv.y, srv.w, "server", null, { h: srv.h });
  s += caption(v, srv.x + srv.w / 2, srv.y + srv.h + 34, "192.168.1.10", tr(v, words.server));
  const rt = { x: 316, y: 80, w: 108, h: 40 };
  s += router(rt.x, rt.y, rt.w, rt.h);
  s += caption(v, rt.x + rt.w / 2, rt.y + rt.h + 22, "192.168.1.1", tr(v, words.router));
  // The internet, behind the router.
  const cx = 606, cy = 120;
  s += `<path d="M${cx - 80},${cy + 46} a34,34 0 0 1 -6,-66 a44,44 0 0 1 72,-34 a42,42 0 0 1 76,18 a32,32 0 0 1 22,82 z" fill="#ffffff" stroke="${C.boxStroke}" stroke-width="2"/>`;
  s += label(v, cx, cy - 44, tr(v, words.internet), { anchor: "middle", weight: 700, fit: 170 });
  s += chip(cx, cy - 8, "example.com", { anchor: "middle", h: 32 }) + chip(cx, cy + 30, "1.1.1.1", { anchor: "middle", h: 32 });
  // The routes: the local network directly (green), everything else via the gateway (orange).
  const mx = me.x + me.w + 6;
  s += arrowPath(`M${mx},${me.y + 40} C${mx + 50},${me.y + 40} ${srv.x - 60},${srv.y + 25} ${srv.x - 8},${srv.y + 25}`, srv.x - 8, srv.y + 25, 1, 0, { color: DIRECT, width: 3 });
  s += arrowPath(`M${mx},${me.y + 16} C${mx + 50},${me.y + 16} ${rt.x - 60},${rt.y + 20} ${rt.x - 8},${rt.y + 20}`, rt.x - 8, rt.y + 20, 1, 0, { color: VIA, width: 3 });
  s += arrowPath(`M${rt.x + rt.w + 6},${rt.y + 20} C${rt.x + rt.w + 40},${rt.y + 20} ${cx - 120},${cy + 10} ${cx - 92},${cy + 10}`, cx - 92, cy + 10, 1, 0, { color: VIA, width: 3 });
  // ip route, with the two routes marked in the arrows' colours.
  const lines = R.route.lines;
  const rows = lines[0].output.map((row) => row.map((r) => r.text).join(""));
  const marks = [
    { row: 1, col: 0, len: "default via 192.168.1.1".length, color: VIA, opacity: 0.45 },
    { row: 2, col: 0, len: rows[1].indexOf(" "), color: DIRECT, opacity: 0.5 },
  ];
  s += terminal(PAD, termTop, W - 2 * PAD, lines, { cut: Math.floor((W - 2 * PAD - 28) / (FS * 0.6)), marks }).svg;
  return svg(height(v, R), s);
}
