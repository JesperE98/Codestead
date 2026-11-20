// Other shells: zsh runs inside bash. The simulator's terminal after zsh (recommended settings) has been started from
// bash – echo $0 says zsh, ps lists bash and zsh, echo $SHELL still says /bin/bash – next to the processes as boxes in
// boxes: the terminal, bash (the login shell, $SHELL) and zsh in it (the shell running now, $0).
import { C, FS, PAD, W, box, code, isRtl, label, perLanguage, svg, terminal, tr } from "./style.mjs";

export const variants = perLanguage("nested-shells");

export const words = {
  terminal: { en: "Terminal", sv: "Terminal", de: "Terminal", fr: "Terminal", es: "Terminal", pt: "Terminal", ru: "Терминал", zh: "终端", ja: "ターミナル", ar: "الطرفية", hi: "Terminal" },
  login: { en: "login shell", sv: "inloggningsskal", de: "Login-Shell", fr: "shell de connexion", es: "shell de inicio", pt: "shell de login", ru: "login shell", zh: "登录 shell", ja: "ログインシェル", ar: "login shell", hi: "login shell" },
  now: { en: "running now", sv: "körs nu", de: "läuft gerade", fr: "en cours", es: "en ejecución", pt: "rodando agora", ru: "запущен сейчас", zh: "正在运行", ja: "いま動いている", ar: "يعمل الآن", hi: "अभी चल रहा है" },
};

export const terminals = {
  zsh: {
    setup: ["sudo apt update", "sudo apt install -y zsh", "zsh", "2"],
    commands: ["echo $0", "ps", "echo $SHELL"],
  },
};

const TW = 392; // the terminal's width
const termHeight = (R) => terminal(0, 0, TW, R.zsh.lines).height;
export const height = (v, R) => Math.max(termHeight(R), 302) + 2 * PAD;

export function draw(v, R) {
  const rtl = isRtl(v);
  const h = height(v, R) - 2 * PAD;
  const tx = rtl ? W - PAD - TW : PAD;
  const t = terminal(tx, PAD, TW, R.zsh.lines, { from: 0 });
  let s = t.svg;
  // The processes: the terminal holds bash, bash holds zsh, zsh holds ps.
  const dx = rtl ? PAD : PAD + TW + 16, dw = W - 2 * PAD - TW - 16;
  const at = (x, inset) => (rtl ? x + dw - inset : x + inset); // a row's start inside a box
  s += box(dx, PAD, dw, h, { style: "muted" });
  s += label(v, at(dx, 14), PAD + 22, tr(v, words.terminal), { weight: 700, color: C.muted });
  // bash
  const bx = dx + 12, by = PAD + 44, bw = dw - 24, bh = h - 56;
  s += box(bx, by, bw, bh, { fill: "#ffffff", stroke: C.z, width: 2 });
  const bAt = (inset) => (rtl ? bx + bw - inset : bx + inset);
  s += code(bAt(14), by + 22, "bash", { weight: 700, color: C.z, anchor: rtl ? "end" : "start" });
  s += label(v, bAt(14), by + 50, tr(v, words.login), { color: C.z, weight: 600, fit: bw - 28 });
  s += code(bAt(14), by + 78, "$SHELL = /bin/bash", { weight: 600, anchor: rtl ? "end" : "start", fit: bw - 20 });
  // zsh
  const zx = bx + 12, zy = by + 100, zw = bw - 24, zh = bh - 112;
  s += box(zx, zy, zw, zh, { style: "accent", width: 2 });
  const zAt = (inset) => (rtl ? zx + zw - inset : zx + inset);
  s += code(zAt(14), zy + 22, "zsh", { weight: 700, color: C.accent, anchor: rtl ? "end" : "start" });
  s += label(v, zAt(14), zy + 50, tr(v, words.now), { color: C.accent, weight: 600, fit: zw - 28 });
  s += code(zAt(14), zy + 78, "$0 = zsh", { weight: 600, anchor: rtl ? "end" : "start" });
  // ps, started by zsh
  const px = zAt(14) - (rtl ? 60 : 0);
  s += box(px, zy + 98, 60, 32, { fill: "#ffffff" }) + code(px + 30, zy + 114, "ps", { anchor: "middle", weight: 600, size: FS });
  return svg(height(v, R), s);
}
