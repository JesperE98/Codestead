// Users and groups: the chapter's question – kim is in sudo and the developers group; usermod -aG backup adds backup,
// usermod -G backup sets the supplementary groups to backup alone. kim's primary group is not touched by either.
// (After the question in the text: it shows the answer.)
import { C, FS, MONO, PAD, W, esc, isRtl, label, perLanguage, svg, textWidth, tr, world } from "./style.mjs";
import { DARK, chip, chipWidth } from "./_admin.mjs";

export const variants = perLanguage("usermod-ag");

export const words = {
  primary: { en: "primary group", sv: "primär grupp", de: "primäre Gruppe", fr: "groupe principal", es: "grupo principal", pt: "grupo primário", ru: "основная группа", zh: "主组", ja: "プライマリグループ", ar: "المجموعة الأساسية", hi: "primary group" },
  supplementary: { en: "supplementary groups", sv: "extra grupper", de: "zusätzliche Gruppen", fr: "groupes secondaires", es: "grupos secundarios", pt: "grupos suplementares", ru: "дополнительные группы", zh: "附加组", ja: "補助グループ", ar: "المجموعات الإضافية", hi: "supplementary groups" },
};

const ROW = 128; // a command and the groups after it
const TOP = PAD + 6;
const LABELS = 70; // under the first row: which groups are which
export const height = TOP + 3 * ROW + LABELS - 4 + PAD;

/** A command strip whose parts can have their own colours: parts [[text, colour?]]. (x, y) its left middle. */
function strip(x, y, parts) {
  const all = parts.map((p) => p[0]).join("");
  const w = textWidth(all, FS, true) + 28;
  const spans = parts.map(([t, color]) => `<tspan fill="${color ?? "#e6edf3"}"${color ? ` font-weight="800"` : ""}>${esc(t)}</tspan>`).join("");
  return `<rect x="${x}" y="${y - 21}" width="${w}" height="42" rx="6" fill="${DARK}"/>` +
    `<text x="${x + 14}" y="${y}" font-size="${FS}" font-weight="500" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre">${spans}</text>`;
}

export function draw(v) {
  const rtl = isRtl(v);
  const dev = world(v.lang).names.devGroup;
  const rows = [
    { cmd: [["groups kim"]], groups: [["sudo", "plain"], [dev, "plain"]] },
    { cmd: [["sudo usermod -"], ["a", C.accent], ["G backup kim"]], groups: [["sudo", "plain"], [dev, "plain"], ["backup", "accent"]] },
    { cmd: [["sudo usermod -G backup kim"]], groups: [["sudo", "gone"], [dev, "gone"], ["backup", "accent"]] },
  ];
  // The chips: kim (the primary group) first, then the supplementary groups; in Arabic from the right.
  const x0 = PAD + 24;
  const place = (items) => {
    let at = 0;
    return items.map(([s, style]) => {
      const w = chipWidth(s);
      const x = rtl ? W - x0 - at - w : x0 + at;
      at += w + (s === "kim" ? 34 : 10);
      return { s, style, x, w };
    });
  };
  let s = "";
  rows.forEach((r, i) => {
    const y = TOP + i * ROW + (i > 0 ? LABELS : 0);
    s += strip(rtl ? W - PAD - (textWidth(r.cmd.map((p) => p[0]).join(""), FS, true) + 28) : PAD, y + 21, r.cmd);
    const cy = y + 21 + 56;
    const chips = place([["kim", "grey"], ...r.groups]);
    // A short line from the command down to its groups.
    const lx = rtl ? W - PAD - 12 : PAD + 12;
    s += `<path d="M${lx},${y + 42} V${cy} H${rtl ? chips[0].x + chips[0].w : chips[0].x}" fill="none" stroke="${C.line}" stroke-width="1.5"/>`;
    for (const c of chips) s += chip(c.x, cy, c.s, { style: c.style });
    // A cross over the groups -G took away.
    for (const c of chips.filter((c) => c.style === "gone")) s += `<path d="M${c.x + 6},${cy - 12} l${c.w - 12},24" stroke="${C.bad}" stroke-width="2.5" stroke-linecap="round"/>`;
    // Under the first row: which chip is the primary group and which are the supplementary ones.
    if (i === 0) {
      const k = chips[0], rest = chips.slice(1);
      const a = Math.min(...rest.map((c) => c.x)), b = Math.max(...rest.map((c) => c.x + c.w));
      s += `<path d="M${a},${cy + 24} v6 H${b} v-6" fill="none" stroke="${C.muted}" stroke-width="1.5"/>`;
      s += label(v, rtl ? b : a, cy + 46, tr(v, words.supplementary), { color: C.muted, weight: 600 });
      const kx = k.x + k.w / 2;
      s += `<path d="M${kx},${cy + 20} V${cy + 70}" fill="none" stroke="${C.muted}" stroke-width="1.5"/>`;
      s += label(v, rtl ? kx - 8 : kx + 8, cy + 72, tr(v, words.primary), { color: C.muted, weight: 600 });
    }
  });
  return svg(height, s);
}
