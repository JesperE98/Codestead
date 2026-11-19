// Rendering Sprites, DrawSprite's model matrix step by step, with the chapter's numbers: the unit quad scaled to
// 300 × 400, moved by half its size so that its centre is at the origin, turned 45° (clockwise on the screen: the
// game's y points down), moved back, and moved to (200, 200). The steps are numbered in the order they act on a
// vertex – the matrix written last in the code acts first.
import { C, PAD, W, arrow, badge, dot, perLanguage, svg, t, text } from "./style.mjs";
import { gameTexture, label, tintFilter } from "./_practice.mjs";

export const variants = perLanguage("sprite-steps");
export const lossy = true; // the ball texture
const PW = 206, GX = (W - 2 * PAD - 3 * PW) / 2;
const WX0 = -260, WX1 = 600, WY0 = -260, WY1 = 650; // the world range each panel shows
const K = PW / (WX1 - WX0), PH = (WY1 - WY0) * K;
const TOP = PAD + 46, ROWH = PH + 50;
export const height = TOP + 2 * ROWH + PAD + 14;

const steps = (v) => [
  { tr: "scale(300 400)", text: t(v, "scale to 300 × 400", "skala till 300 × 400") },
  { tr: "translate(-150 -200) scale(300 400)", text: t(v, "move by −(150, 200)", "flytta −(150, 200)") },
  { tr: "rotate(45) translate(-150 -200) scale(300 400)", text: t(v, "turn 45°", "vrid 45°") },
  { tr: "translate(150 200) rotate(45) translate(-150 -200) scale(300 400)", text: t(v, "move by +(150, 200)", "flytta +(150, 200)") },
  { tr: "translate(200 200) translate(150 200) rotate(45) translate(-150 -200) scale(300 400)", text: t(v, "move to (200, 200)", "flytta till (200, 200)") },
];

export function draw(v) {
  const ball = gameTexture("ball");
  let s = `<defs>${tintFilter("green", [0, 1, 0])}</defs>`;
  // The formula: the matrix next to the vertex acts first.
  const f = [["*model*", 0], ["=", 1], ["*T*", 5], ["·", 0], ["*T*", 4], ["·", 0], ["*R*", 3], ["·", 0], ["*T*", 2], ["·", 0], ["*S*", 1]];
  let fx = W / 2 - 150;
  for (const [p, n] of f) {
    s += text(fx, PAD + 14, p, { size: 22, weight: 650, anchor: "middle" });
    if (n > 1 || (n === 1 && p !== "=")) s += badge(fx, PAD + 40, n, { r: 10 });
    fx += p === "*model*" ? 52 : p === "=" ? 40 : 26;
  }
  steps(v).forEach((st, i) => {
    const row = i < 3 ? 0 : 1, col = row === 0 ? i : i - 3;
    const x = row === 0 ? PAD + col * (PW + GX) : W / 2 - PW - GX / 2 + col * (PW + GX);
    const y = TOP + 26 + row * ROWH;
    const px = (wx) => x + (wx - WX0) * K, py = (wy) => y + (wy - WY0) * K;
    s += `<rect x="${x}" y="${y}" width="${PW}" height="${PH}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
    // the axes through the origin; y points down
    s += arrow(px(0), py(0), px(WX1 - 30), py(0), { color: C.x, width: 1.5 }) + arrow(px(0), py(0), px(0), py(WY1 - 30), { color: C.y, width: 1.5 });
    s += `<g transform="translate(${px(0)} ${py(0)}) scale(${K}) ${st.tr}"><image href="${ball}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" filter="url(#green)"/>` +
      `<rect x="0" y="0" width="1" height="1" fill="none" stroke="${C.accent}" stroke-width="${2 / (K * 300)}" vector-effect="non-scaling-stroke"/></g>`;
    s += dot(px(0), py(0), { r: 4 });
    s += badge(x + 16, y + 16, i + 1, { r: 11 });
    s += label(x + PW / 2, y + PH + 22, st.text, { anchor: "middle", fit: PW + GX - 4 });
  });
  return svg(height, s);
}
