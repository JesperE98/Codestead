// OIT: Weighted Blended, the four passes of a frame and what each does with the four targets: the solid pass writes the
// opaque colour and depth; the transparent pass tests the depth without writing it, adds into the accumulation target
// and multiplies the revealage target by 1 − α; the composite pass reads both and blends over the opaque colour; the
// final pass copies the opaque colour to the window.
import { C, PAD, W, badge, box, line, perLanguage, svg, t } from "./style.mjs";
import { label } from "./_practice.mjs";

export const variants = perLanguage("wb-passes");
const HW = 190, CW = (W - 2 * PAD - HW) / 4, HH = 64, RH = 58;
export const height = PAD + HH + 4 * RH + PAD;

export function draw(v) {
  const cols = t(v, [["opaque", "colour"], ["depth"], ["accumu-", "lation"], ["revealage"]], [["ogenom-", "skinlig färg"], ["djup"], ["ackumu-", "lering"], ["revealage"]]);
  const W_ = t(v, "write", "skriv"), R_ = t(v, "read", "läs");
  const rows = [
    [t(v, "solid", "solida"), [[W_, "w"], [W_, "w"], null, null]],
    [t(v, "transparent", "genomskinliga"), [null, ["test", "t"], [t(v, "add", "addera"), "w"], ["× (1 − *α*)", "w"]]],
    [t(v, "composite", "komposit"), [[t(v, "blend", "blenda"), "w"], null, [R_, "r"], [R_, "r"]]],
    [t(v, "final", "sista"), [[t(v, "read → window", "läs → fönster"), "r"], null, null, null]],
  ];
  let s = "";
  cols.forEach((c, i) => {
    const x = PAD + HW + i * CW + CW / 2;
    c.forEach((w, k) => (s += label(x, PAD + (c.length === 1 ? HH / 2 - 4 : 16 + k * 24), w, { anchor: "middle", fit: CW - 6, color: C.muted })));
  });
  rows.forEach(([name, cells], r) => {
    const y = PAD + HH + r * RH;
    s += line(PAD, y, W - PAD, y, { color: C.grid, width: 1.5 });
    s += badge(PAD + 14, y + RH / 2, r + 1, { r: 11 });
    s += label(PAD + 34, y + RH / 2, name, { fit: HW - 40 });
    cells.forEach((c, i) => {
      if (!c) return;
      const [txt, kind] = c, x = PAD + HW + i * CW + 6, w = (i === 0 && r === 3) ? 2 * CW - 12 : CW - 12;
      s += box(x, y + 9, w, RH - 18, { style: kind === "w" ? "accent" : kind === "r" ? "accent2" : "muted", label: txt, size: 19, weight: 600 });
    });
  });
  return svg(height, s);
}
