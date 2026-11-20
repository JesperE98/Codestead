// Other shells: the family tree of the chapter's table on a time line – sh (1979), bash (1989) and zsh (1990) in the
// Bourne shell's line and POSIX-compatible; fish (2005) on its own, with its own syntax.
import { C, FS, MONO, PAD, W, esc, isRtl, label, perLanguage, svg, text, textWidth, tr } from "./style.mjs";

export const variants = perLanguage("shell-family");

export const words = {
  posix: { en: "POSIX-compatible", sv: "POSIX-kompatibla", de: "POSIX-kompatibel", fr: "compatibles POSIX", es: "compatibles con POSIX", pt: "compatíveis com POSIX", ru: "совместимы с POSIX", zh: "兼容 POSIX", ja: "POSIX 互換", ar: "متوافقة مع POSIX", hi: "POSIX-compatible" },
  own: { en: "its own syntax", sv: "egen syntax", de: "eigene Syntax", fr: "sa propre syntaxe", es: "su propia sintaxis", pt: "sintaxe própria", ru: "свой синтаксис", zh: "自己的语法", ja: "独自の構文", ar: "صياغته الخاصة", hi: "अपना syntax" },
};

const Y0 = 1975, Y1 = 2010;
const X0 = PAD + 20, X1 = W - PAD - 20;
const X = (year) => X0 + ((year - Y0) / (Y1 - Y0)) * (X1 - X0);
const TOP = PAD + 44;
const LANE = 56;
const AXIS_Y = TOP + 3 * LANE + 20;
export const height = AXIS_Y + 42 + PAD - 6;

const SHELLS = [
  { name: "sh", year: 1979, lane: 0, from: null },
  { name: "bash", year: 1989, lane: 1, from: "sh" },
  { name: "zsh", year: 1990, lane: 2, from: "sh" },
  { name: "fish", year: 2005, lane: 1, from: null },
];

export function draw(v) {
  let s = "";
  const pillW = (n) => textWidth(n, 21, true) + 30;
  const pos = Object.fromEntries(SHELLS.map((sh) => [sh.name, { x: X(sh.year), y: TOP + sh.lane * LANE + LANE / 2 }]));
  // The regions: POSIX-compatible (sh, bash, zsh) and fish on its own.
  const rx0 = X(1976.2), rx1 = X(1997.5);
  s += `<rect x="${rx0}" y="${PAD}" width="${rx1 - rx0}" height="${AXIS_Y - PAD - 10}" rx="12" fill="${C.zSoft}" fill-opacity="0.6" stroke="${C.z}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  s += label(v, isRtl(v) ? rx1 - 14 : rx0 + 14, PAD + 20, tr(v, words.posix), { weight: 700, color: C.z, fit: rx1 - rx0 - 28 });
  const fx0 = X(1999.3), fx1 = X(2009.8);
  s += `<rect x="${fx0}" y="${PAD}" width="${fx1 - fx0}" height="${AXIS_Y - PAD - 10}" rx="12" fill="${C.accentSoft}" fill-opacity="0.6" stroke="${C.accent}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  s += label(v, (fx0 + fx1) / 2, PAD + 20, tr(v, words.own), { anchor: "middle", weight: 700, color: C.accent, fit: fx1 - fx0 - 12 });
  // The time line.
  for (let y = 1980; y <= Y1; y += 10) {
    s += `<line x1="${X(y)}" y1="${AXIS_Y - 6}" x2="${X(y)}" y2="${AXIS_Y + 6}" stroke="${C.line}" stroke-width="1.5"/>`;
    s += text(X(y), AXIS_Y + 24, String(y), { size: FS, weight: 600, color: C.muted, anchor: "middle" });
  }
  s += `<line x1="${X0}" y1="${AXIS_Y}" x2="${X1}" y2="${AXIS_Y}" stroke="${C.line}" stroke-width="1.5"/>`;
  // Descent: from sh to bash and zsh.
  for (const sh of SHELLS.filter((x) => x.from)) {
    const a = pos[sh.from], b = pos[sh.name];
    s += `<path d="M${a.x},${a.y + 18} V${b.y} H${b.x - pillW(sh.name) / 2 - 2}" fill="none" stroke="${C.z}" stroke-width="2"/>`;
  }
  // The shells: a pill at the year (a tick on the time line under it).
  for (const sh of SHELLS) {
    const { x, y } = pos[sh.name];
    const w = pillW(sh.name);
    const color = sh.name === "fish" ? C.accent : C.z;
    s += `<line x1="${x}" y1="${y + 18}" x2="${x}" y2="${AXIS_Y}" stroke="${color}" stroke-width="1" stroke-dasharray="2 3" opacity="0.6"/>`;
    s += `<rect x="${x - w / 2}" y="${y - 18}" width="${w}" height="36" rx="18" fill="#ffffff" stroke="${color}" stroke-width="2"/>`;
    s += `<text x="${x}" y="${y}" font-size="21" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}">${esc(sh.name)}</text>`;
    s += text(x + w / 2 + 8, y, String(sh.year), { size: FS, weight: 600, color: C.muted });
  }
  return svg(height, s);
}
