// Flatpak, Snap and AppImage: what a sandbox means. A program from the distribution's packages or an AppImage runs as
// you and reaches your whole home directory and the network; a Flatpak or a (strict) snap runs in a sandbox and only
// reaches what it has been allowed – here the network and the downloads folder, not your documents or ~/.ssh.
import { C, FS, PAD, W, arrow, box, code, folder, isRtl, label, line, perLanguage, svg, tag, textWidth, tr, world } from "./style.mjs";
import { lock } from "./_distro.mjs";

export const variants = perLanguage("sandbox");

export const words = {
  distro: { en: "Distribution package", sv: "Distributionens paket", de: "Distributionspaket", fr: "Paquet de la distribution", es: "Paquete de la distribución", pt: "Pacote da distribuição", ru: "Пакет дистрибутива", zh: "发行版软件包", ja: "ディストリビューションのパッケージ", ar: "حزمة التوزيعة", hi: "Distribution package" },
  sandbox: { en: "sandbox", sv: "sandlåda", de: "Sandbox", fr: "bac à sable", es: "sandbox", pt: "sandbox", ru: "песочница", zh: "沙盒", ja: "サンドボックス", ar: "العزل", hi: "sandbox" },
  program: { en: "program", sv: "program", de: "Programm", fr: "programme", es: "programa", pt: "programa", ru: "программа", zh: "程序", ja: "プログラム", ar: "البرنامج", hi: "program" },
  network: { en: "network", sv: "nätverket", de: "Netzwerk", fr: "réseau", es: "la red", pt: "a rede", ru: "сеть", zh: "网络", ja: "ネットワーク", ar: "الشبكة", hi: "network" },
};

const PANEL = 214, GAP = 14;
const ROW = 40;
export const height = PAD + 2 * PANEL + GAP + PAD;

/** A globe (the network) with its middle at (x, y). */
function globe(x, y, r = 10) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#e0e9fb" stroke="${C.z}" stroke-width="1.5"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="${r * 0.45}" ry="${r}" fill="none" stroke="${C.z}" stroke-width="1.2"/>` +
    `<path d="M${x - r},${y} h${2 * r} M${x - r * 0.85},${y - r * 0.5} h${r * 1.7} M${x - r * 0.85},${y + r * 0.5} h${r * 1.7}" stroke="${C.z}" stroke-width="1.1"/>`;
}

function panel(v, y, sandboxed) {
  const rtl = isRtl(v);
  const n = world(v.lang).names;
  // x of something w wide that starts dx from the start side.
  const at = (dx, w = 0) => (rtl ? W - PAD - dx - w : PAD + dx);
  let s = box(PAD, y, W - 2 * PAD, PANEL, sandboxed ? { style: "y" } : { fill: "#ffffff" });
  const head = sandboxed ? "Flatpak · Snap" : `${tr(v, words.distro)} · AppImage`;
  s += label(v, at(16), y + 24, head, { weight: 700, size: 21, fit: W - 2 * PAD - 32 });
  // The resources, one per row at the end side.
  const items = [
    { kind: "dir", name: `~/${n.documents}/`, ok: !sandboxed },
    { kind: "dir", name: "~/.ssh/", ok: !sandboxed },
    { kind: "dir", name: `~/${n.downloads}/`, ok: true },
    { kind: "net", name: tr(v, words.network), ok: true },
  ];
  const ry = (i) => y + 64 + i * ROW;
  const resX = 400; // from the start side
  // The program, in the middle of the rows.
  const py = (ry(0) + ry(3)) / 2;
  const prog = tr(v, words.program);
  const pw = Math.max(textWidth(prog, FS) + 32, 130);
  s += box(at(40, pw), py - 22, pw, 44, { style: "accent" });
  s += label(v, at(40, pw) + pw / 2, py, prog, { anchor: "middle", weight: 700, fit: pw - 12 });
  // The sandbox: a wall around the program.
  const wallEnd = 40 + pw + 92; // from the start side
  if (sandboxed) {
    const wx = at(22, wallEnd - 22);
    s += `<rect x="${wx}" y="${py - 62}" width="${wallEnd - 22}" height="124" rx="10" fill="none" stroke="${C.good}" stroke-width="3.5" stroke-dasharray="10 5"/>`;
    s += lock(at(30, 16), py - 56, C.good);
    s += tag(v, at(54), py - 48, tr(v, words.sandbox), { anchor: rtl ? "end" : "start", color: C.good, stroke: C.good, size: FS });
  }
  items.forEach((it, i) => {
    const yy = ry(i);
    const x0 = rtl ? at(40, pw) : at(40 + pw);
    const x1 = rtl ? at(resX) + 4 : at(resX) - 4;
    const color = it.ok ? C.good : C.bad;
    if (it.ok) s += arrow(x0, py, x1, yy, { color, width: 2 });
    else {
      // Stopped at the wall.
      const wx = at(wallEnd);
      const t = (wallEnd - 40 - pw) / (resX - 40 - pw);
      const wy = py + (yy - py) * t;
      s += line(wx, wy, x1, yy, { color: C.line, width: 1.5, dash: "4 4" });
      s += line(x0, py, wx, wy, { color, width: 2 });
      s += `<path d="M${wx - 7},${wy - 7} l14,14 M${wx + 7},${wy - 7} l-14,14" stroke="${C.bad}" stroke-width="3" stroke-linecap="round"/>`;
    }
    // The resource: a folder and its path, or the network.
    const ix = rtl ? at(resX, 24) : at(resX);
    if (it.kind === "dir") {
      s += folder(ix, yy - 9, it.ok ? {} : { fill: "#eef0f3", stroke: C.line });
      const tw = textWidth(it.name, FS, true);
      s += code(rtl ? at(resX + 34, tw) : at(resX + 34), yy, it.name, { color: it.ok ? C.ink : C.muted, weight: 600, fit: W - 2 * PAD - resX - 40 });
    } else {
      s += globe(ix + 12, yy);
      s += label(v, at(resX + 34), yy, it.name, { weight: 600 });
    }
  });
  return s;
}

export function draw(v) {
  return svg(height, panel(v, PAD, false) + panel(v, PAD + PANEL + GAP, true));
}
