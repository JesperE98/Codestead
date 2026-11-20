// Distributions and families: the three release models on one time line – Ubuntu LTS every other year (stable), Fedora
// every six months (fast-moving) and Arch with no versions at all, only a steady stream of updates (rolling).
import { C, FAMILY, FS, PAD, W, code, isRtl, label, perLanguage, svg, text, tr } from "./style.mjs";

export const variants = perLanguage("release-models");

export const words = {
  stable: { en: "stable", sv: "stabil", de: "stabil", fr: "stable", es: "estable", pt: "estável", ru: "стабильный", zh: "稳定版本", ja: "安定版", ar: "مستقرة", hi: "stable" },
  fast: { en: "fast-moving", sv: "snabbrörlig", de: "schnelllebig", fr: "rapide", es: "de ritmo rápido", pt: "ágil", ru: "быстро меняется", zh: "快速迭代", ja: "速いサイクル", ar: "سريعة التطور", hi: "तेज़ी से बदलने वाला" },
  rolling: { en: "rolling", sv: "rullande", de: "rolling", fr: "en continu", es: "continua", pt: "contínuo", ru: "rolling", zh: "滚动更新", ja: "ローリング", ar: "متجددة", hi: "rolling" },
};

const Y0 = 2023.8, Y1 = 2028.6; // the time line's first and last year
const LABELS = 196; // the row names' column
const ROW = 80;
const TOP = PAD + 8;
const AXIS_Y = TOP + 3 * ROW + 8;
export const height = AXIS_Y + 40 + PAD - 4;

const ROWS = [
  { name: "Ubuntu LTS", model: "stable", color: FAMILY.debian, releases: [[2024.3, "24.04"], [2026.3, "26.04"], [2028.3, "28.04"]] },
  { name: "Fedora", model: "fast", color: FAMILY.redhat, releases: [40, 41, 42, 43, 44, 45, 46, 47, 48].map((n, i) => [2024.3 + i * 0.5, String(n)]) },
  { name: "Arch", model: "rolling", color: FAMILY.arch, releases: [] },
];

export function draw(v) {
  const rtl = isRtl(v);
  // The time line: next to the names, which stand at the start side.
  const tx0 = rtl ? PAD + 14 : PAD + LABELS, tx1 = rtl ? W - PAD - LABELS : W - PAD - 14;
  const X = (year) => tx0 + ((year - Y0) / (Y1 - Y0)) * (tx1 - tx0);
  let s = "";
  // Years: a faint line at the start of each, numbered on the axis.
  for (let y = Math.ceil(Y0); y <= Math.floor(Y1); y++) {
    s += `<line x1="${X(y)}" y1="${TOP}" x2="${X(y)}" y2="${AXIS_Y}" stroke="${C.grid}" stroke-width="1"/>`;
    s += text(X(y), AXIS_Y + 20, String(y), { size: FS, weight: 600, color: C.muted, anchor: "middle" });
  }
  s += `<line x1="${tx0}" y1="${AXIS_Y}" x2="${tx1}" y2="${AXIS_Y}" stroke="${C.line}" stroke-width="1.5"/>`;
  ROWS.forEach((r, i) => {
    const cy = TOP + i * ROW + ROW / 2;
    const lx = rtl ? W - PAD - 6 : PAD + 6;
    s += label(v, lx, cy - 13, r.name, { size: 21, weight: 700, color: r.color, ltr: true, anchor: rtl ? "end" : "start" });
    s += label(v, lx, cy + 15, tr(v, words[r.model]), { color: C.muted, weight: 600, fit: LABELS - 14 });
    const ly = cy + 12; // the lane
    if (r.releases.length === 0) {
      // Rolling: no versions, a steady stream of small updates.
      s += `<line x1="${tx0}" y1="${ly}" x2="${tx1}" y2="${ly}" stroke="${r.color}" stroke-width="6" stroke-linecap="round" opacity="0.35"/>`;
      for (let x = tx0 + 6; x < tx1 - 2; x += 9) s += `<line x1="${x}" y1="${ly - 9}" x2="${x}" y2="${ly + 9}" stroke="${r.color}" stroke-width="2" stroke-linecap="round"/>`;
      return;
    }
    s += `<line x1="${tx0}" y1="${ly}" x2="${tx1}" y2="${ly}" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
    for (const [year, name] of r.releases) {
      const x = X(year);
      s += `<path d="M${x},${ly - 9} l9,9 l-9,9 l-9,-9 z" fill="${r.color}"/>`;
      s += code(x, ly - 26, name, { anchor: "middle", weight: 650, color: C.ink });
    }
  });
  return svg(height, s);
}
