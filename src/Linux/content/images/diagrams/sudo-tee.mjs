// Users, permissions and sudo: the chapter's trap. In `sudo echo "text" > /etc/file` it is your shell, running as you,
// that opens the file for > – and is refused, so echo (which sudo would run as root) never starts. In
// `echo … | sudo tee -a /etc/hosts` tee runs as root and opens the file itself. Commands, users and the simulator's
// error message only: no words.
import { C, FS, PAD, W, arrow, code, perLanguage, svg, textWidth, world } from "./style.mjs";
import { cmdStrip, fileChip, mark, userTag, userTagWidth } from "./_system.mjs";

export const variants = perLanguage("sudo-tee");

const BOX_H = 82;
const ROW1 = PAD + 20; // the first command's strip (middle)
const P1 = ROW1 + 40; // its processes' top
const ROW2 = P1 + BOX_H + 30 + BOX_H + 56; // the second command's strip
const P2 = ROW2 + 40;
export const height = P2 + BOX_H + PAD;

/** A process: its program's name and the user it runs as; (x, y) is the top left. Returns { svg, w }. */
function proc(x, y, name, user, o = {}) {
  const w = Math.max(textWidth(name, FS + 2, true), userTagWidth(user)) + 28;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${BOX_H}" rx="8" fill="${o.dim ? C.card : "#ffffff"}" stroke="${o.dim ? C.line : C.boxStroke}" stroke-width="1.5"${o.dim ? ` stroke-dasharray="5 4"` : ""}/>`;
  s += code(x + w / 2, y + 22, name, { anchor: "middle", size: FS + 2, weight: 700, color: o.dim ? C.line : C.ink });
  const tag = userTag(x + (w - userTagWidth(user)) / 2, y + 56, user, o.dim ? { color: C.line } : {});
  s += o.dim ? `<g opacity="0.8">${tag}</g>` : tag;
  return { svg: s, w };
}

export function draw(v) {
  const user = world(v.lang).names.user;
  let s = "";
  // 1. sudo echo "text" > /etc/file: bash (you) opens the file and is refused; echo never runs.
  s += cmdStrip(PAD, ROW1, `sudo echo "text" > /etc/file`).svg;
  const bash = proc(PAD, P1, "bash", user);
  s += bash.svg;
  const fileX = 430;
  const fy = P1 + 30;
  s += arrow(PAD + bash.w + 6, fy, fileX - 8, fy, { color: C.bad, width: 2.5 });
  s += code((PAD + bash.w + fileX) / 2, fy - 18, ">", { anchor: "middle", color: C.bad, weight: 800, size: 22 });
  const f1 = fileChip(fileX, fy, "/etc/file");
  s += f1.svg + mark(fileX + f1.w + 22, fy, false);
  s += code(fileX, fy + 40, "Permission denied", { color: C.bad, weight: 600, fit: W - PAD - fileX });
  // sudo would have started echo as root – but the line stops before that.
  const ex = PAD + 150, ey = P1 + BOX_H + 30;
  s += `<path d="M${PAD + 40},${P1 + BOX_H} V${ey + BOX_H / 2} H${ex - 10}" fill="none" stroke="${C.line}" stroke-width="2" stroke-dasharray="5 4"/>`;
  s += code(PAD + 52, ey + BOX_H / 2 - 16, "sudo", { color: C.line, weight: 700 });
  s += proc(ex, ey, "echo", "root", { dim: true }).svg;
  s += mark(ex + proc(0, 0, "echo", "root").w + 24, ey + BOX_H / 2, false, { color: C.line });

  // 2. echo … | sudo tee -a /etc/hosts: tee runs as root and opens the file itself.
  s += `<line x1="${PAD}" y1="${ROW2 - 34}" x2="${W - PAD}" y2="${ROW2 - 34}" stroke="${C.grid}" stroke-width="1"/>`;
  s += cmdStrip(PAD, ROW2, `echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts`).svg;
  const echo = proc(PAD, P2, "echo", user);
  s += echo.svg;
  const teeX = PAD + echo.w + 66;
  const ty = P2 + 30;
  s += arrow(PAD + echo.w + 6, ty, teeX - 6, ty, { color: C.y, width: 2.5 });
  s += code(PAD + echo.w + 30, ty - 18, "|", { anchor: "middle", color: C.y, weight: 800, size: 22 });
  const tee = proc(teeX, P2, "tee", "root", {});
  s += tee.svg;
  const hostsX = teeX + tee.w + 66;
  s += arrow(teeX + tee.w + 6, ty, hostsX - 6, ty, { color: C.good, width: 2.5 });
  s += code(teeX + tee.w + 33, ty - 18, "-a", { anchor: "middle", color: C.good, weight: 800 });
  const f2 = fileChip(hostsX, ty, "/etc/hosts");
  s += f2.svg + mark(hostsX + f2.w + 22, ty, true);
  return svg(height, s);
}
