// Flatpak, Snap and AppImage: a Flatpak for the whole system or just for you. Without options it goes to
// /var/lib/flatpak and every user sees it; with --user it goes to ~/.local/share/flatpak, only you see it, and the user
// installation has its own remotes (so Flathub is added with --user too).
import { C, FS, PAD, W, box, code, folder, isRtl, label, perLanguage, svg, textWidth, tr, world } from "./style.mjs";
import { cmd } from "./_distro.mjs";

export const variants = perLanguage("flatpak-user");

export const words = {
  system: { en: "For the whole system", sv: "För hela systemet", de: "Für das ganze System", fr: "Pour tout le système", es: "Para todo el sistema", pt: "Para o sistema inteiro", ru: "Для всей системы", zh: "为整个系统", ja: "システム全体", ar: "للنظام كله", hi: "पूरे system के लिए" },
  user: { en: "Just for you", sv: "Bara för dig", de: "Nur für dich", fr: "Juste pour vous", es: "Solo para ti", pt: "Só para você", ru: "Только для вас", zh: "只为你自己", ja: "自分だけ", ar: "لك وحدك", hi: "सिर्फ़ आपके लिए" },
  remotes: { en: "remotes", sv: "remotes", de: "Remotes", fr: "remotes", es: "remotes", pt: "remotes", ru: "источники", zh: "remote", ja: "リモート", ar: "المصادر البعيدة", hi: "remotes" },
  ownRemotes: { en: "its own remotes", sv: "egna remotes", de: "eigene Remotes", fr: "ses propres remotes", es: "sus propios remotes", pt: "os próprios remotes", ru: "свои источники", zh: "自己的 remote", ja: "独自のリモート", ar: "مصادره البعيدة الخاصة", hi: "अपने remotes" },
};

const GAP = 16;
const COL = (W - 2 * PAD - GAP) / 2;
export const height = PAD + 306 + PAD;

/** A person (a user) with its head's middle at (x, y). */
function person(x, y, on) {
  const fill = on ? C.accent : "#d5dae2";
  return `<circle cx="${x}" cy="${y}" r="9" fill="${fill}"/>` +
    `<path d="M${x - 15},${y + 30} q0,-17 15,-17 q15,0 15,17 z" fill="${fill}"/>`;
}

function panel(v, x, kind) {
  const rtl = isRtl(v);
  const user = kind === "user";
  const n = world(v.lang).names;
  const at = (dx, w = 0) => (rtl ? x + COL - dx - w : x + dx);
  let s = box(x, PAD, COL, height - 2 * PAD, user ? { style: "accent2" } : { fill: "#ffffff" });
  s += label(v, at(16), PAD + 26, tr(v, words[kind]), { weight: 700, size: 21, fit: COL - 32 });
  // The command.
  const command = user ? "flatpak install --user" : "flatpak install";
  const cw = textWidth(command, FS, true) + 24;
  s += cmd(at(16, cw), PAD + 72, command).svg;
  // Where the programs go.
  const path = user ? "~/.local/share/flatpak/" : "/var/lib/flatpak/";
  const pw = textWidth(path, FS, true);
  s += folder(at(16, 24), PAD + 120 - 9) + code(at(48, pw), PAD + 120, path, { weight: 650 });
  // The remotes: the user installation has its own list.
  const rl = tr(v, user ? words.ownRemotes : words.remotes);
  const chipW = textWidth("flathub", FS, true) + 22;
  const room = COL - 28 - chipW - 10;
  s += label(v, at(14), PAD + 168, rl, { weight: 600, color: C.muted, fit: room });
  const lw = Math.min(textWidth(rl, FS), room);
  s += `<rect x="${at(14 + lw + 10, chipW)}" y="${PAD + 168 - 15}" width="${chipW}" height="30" rx="15" fill="#ffffff" stroke="${user ? C.accent2 : C.boxStroke}" stroke-width="1.5"/>`;
  s += code(at(14 + lw + 10, chipW) + chipW / 2, PAD + 168, "flathub", { anchor: "middle", weight: 600 });
  // Who sees the programs: every user, or only you.
  s += `<line x1="${x + 14}" y1="${PAD + 200}" x2="${x + COL - 14}" y2="${PAD + 200}" stroke="${C.grid}" stroke-width="1"/>`;
  [0, 1, 2].forEach((i) => {
    const px = at(64 + i * 54);
    s += person(px, PAD + 228, !user || i === 0);
  });
  s += code(at(64), PAD + 286, n.user, { anchor: "middle", weight: 650, color: C.accent });
  return s;
}

export function draw(v) {
  const [a, b] = isRtl(v) ? [PAD + COL + GAP, PAD] : [PAD, PAD + COL + GAP];
  return svg(height, panel(v, a, "system") + panel(v, b, "user"));
}
