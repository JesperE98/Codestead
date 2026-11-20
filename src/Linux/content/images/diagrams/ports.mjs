// Networking: an address points out the computer, a port the program on it. The learner's computer with the ports
// sudo ss -tulpn shows listening (22 sshd, 8080 myserver) and port 80, where nothing listens: curl reaches myserver on
// 8080 and gets "Couldn't connect" on 80 – the simulator's output. No words.
import { C, PAD, W, arrow, code, shared, svg } from "./style.mjs";
import { chip, chipWidth, strip } from "./_admin.mjs";

export const variants = shared("ports");

export const terminals = {
  ports: {
    setup: ["sudo apt update", "sudo apt install -y curl"],
    commands: ["sudo ss -tulpn", "curl http://localhost:8080", "curl http://localhost"],
  },
};

const BX = 404, BW = W - PAD - BX; // the computer
const TOP = PAD + 24; // the roof's top
const ROOF = 92;
const ROW = 84;
const DOOR_W = 62, DOOR_H = 56;
const ROWS_Y = TOP + ROOF + 16;
export const height = ROWS_Y + 3 * ROW + PAD - 6;

const text = (rows) => rows.map((row) => row.map((r) => r.text).join(""));

export function draw(v, R) {
  const [ss, ok, refused] = R.ports.lines.map((l) => text(l.output));
  // The listening ports and their programs, from ss: users:(("sshd",pid=733,fd=3)).
  const listening = new Map();
  for (const row of ss) {
    const m = /\d+\.\d+\.\d+\.\d+:(\d+)\s.*users:\(\("([^"]+)"/.exec(row);
    if (m) listening.set(Number(m[1]), m[2]);
  }
  if (!ok.some((l) => l.includes("myserver"))) throw new Error("curl did not reach myserver");
  const error = /Couldn't connect to server/.exec(refused[0])?.[0];
  if (!error) throw new Error(`curl on port 80: ${refused[0]}`);
  let s = "";
  // The computer: a house whose address is its IP address.
  const bottom = height - PAD + 4;
  s += `<path d="M${BX},${TOP + ROOF} L${BX + BW / 2},${TOP} L${BX + BW},${TOP + ROOF} Z" fill="${C.accent2Soft}" stroke="${C.accent2}" stroke-width="2" stroke-linejoin="round"/>`;
  s += code(BX + BW / 2, TOP + ROOF - 44, "192.168.1.42", { anchor: "middle", weight: 800, color: C.accent2 });
  s += code(BX + BW / 2, TOP + ROOF - 18, "localhost", { anchor: "middle", weight: 600, color: C.accent2 });
  s += `<rect x="${BX}" y="${TOP + ROOF}" width="${BW}" height="${bottom - TOP - ROOF}" fill="#ffffff" stroke="${C.accent2}" stroke-width="2"/>`;
  // The doors: a port each; a program behind it if one listens.
  const ports = [22, 80, 8080];
  ports.forEach((port, i) => {
    const y = ROWS_Y + i * ROW + DOOR_H / 2;
    const prog = listening.get(port);
    const color = prog ? C.y : C.line;
    s += `<rect x="${BX - DOOR_W / 2}" y="${y - DOOR_H / 2}" width="${DOOR_W}" height="${DOOR_H}" rx="6" fill="${prog ? C.ySoft : C.card}" stroke="${color}" stroke-width="2.5"${prog ? "" : ` stroke-dasharray="5 4"`}/>`;
    s += code(BX, y, String(port), { anchor: "middle", weight: 800, color: prog ? C.y : C.muted });
    if (prog) {
      s += `<path d="M${BX + DOOR_W / 2},${y} H${BX + DOOR_W / 2 + 24}" stroke="${C.y}" stroke-width="2.5"/>`;
      s += chip(BX + DOOR_W / 2 + 24, y, prog, { style: "y" });
    }
  });
  // The clients: curl to 8080 gets in, curl to 80 finds nobody there.
  const y80 = ROWS_Y + ROW + DOOR_H / 2, y8080 = ROWS_Y + 2 * ROW + DOOR_H / 2;
  s += strip(PAD, y8080, "curl http://localhost:8080").svg;
  s += arrow(PAD + chipWidth("curl http://localhost:8080") + 10, y8080, BX - DOOR_W / 2 - 6, y8080, { color: C.y, width: 3 });
  const st = strip(PAD, y80 - 14, "curl http://localhost");
  s += st.svg;
  s += arrow(PAD + st.w + 10, y80 - 14, BX - DOOR_W / 2 - 6, y80 - 6, { color: C.x, width: 3 });
  s += `<path d="M${BX - DOOR_W / 2 - 40},${y80 - 26} l20,20 M${BX - DOOR_W / 2 - 20},${y80 - 26} l-20,20" stroke="${C.x}" stroke-width="3.5" stroke-linecap="round"/>`;
  s += code(PAD + 4, y80 + 24, error, { color: C.x, weight: 600 });
  return svg(height, s);
}

