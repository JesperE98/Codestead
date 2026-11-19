// Transformations, "Combining matrices": M = T · R · S applied to the container, one step at a time – scale by 0.5,
// rotate a quarter turn, move by (0.5, −0.5): the chapter's own numbers. The matrix next to the vertex acts first, so
// the steps are numbered from the right. Language-free (maths only).
import { C, PAD, W, arrow, asset, badge, line, svg, text } from "./style.mjs";

export const variants = [{ out: "transform-steps.webp", lang: "en" }];
export const height = 290;

const crate = asset("opengl/textures/solution/container.png");
const face = asset("opengl/textures/solution/awesomeface.png");
const P = 140; // a panel's size: x and y from −1 to 1
const GAP = (W - 2 * PAD - 4 * P) / 3;

function panel(x, y, { scale, angle, tx, ty }) {
  const u = P / 2; // one unit
  const cx = x + P / 2 + tx * u, cy = y + P / 2 - ty * u;
  let s = `<rect x="${x}" y="${y}" width="${P}" height="${P}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
  s += line(x + 8, y + P / 2, x + P - 8, y + P / 2, { color: C.grid, width: 1 });
  s += line(x + P / 2, y + 8, x + P / 2, y + P - 8, { color: C.grid, width: 1 });
  s += arrow(x + P / 2, y + P / 2, x + P / 2 + u * 0.9, y + P / 2, { color: C.x, width: 1.5 });
  s += arrow(x + P / 2, y + P / 2, x + P / 2, y + P / 2 - u * 0.9, { color: C.y, width: 1.5 });
  const side = u * scale;
  // SVG rotates clockwise for positive angles on screen (y down); the maths' counter-clockwise turn is −angle.
  s += `<g transform="translate(${cx} ${cy}) rotate(${-angle})" opacity="0.92">` +
    `<image href="${crate}" x="${-side / 2}" y="${-side / 2}" width="${side}" height="${side}"/>` +
    `<image href="${face}" x="${-side / 2}" y="${-side / 2}" width="${side}" height="${side}"/></g>`;
  return s;
}

export function draw() {
  let s = "";
  const steps = [
    { label: "*v*", sub: "", scale: 1, angle: 0, tx: 0, ty: 0 },
    { label: "*S* *v*", sub: "×0.5", scale: 0.5, angle: 0, tx: 0, ty: 0 },
    { label: "*R* *S* *v*", sub: "90°", scale: 0.5, angle: 90, tx: 0, ty: 0 },
    { label: "*T* *R* *S* *v*", sub: "(0.5, −0.5)", scale: 0.5, angle: 90, tx: 0.5, ty: -0.5 },
  ];
  const top = PAD + 64;
  // The formula, with the order in which its matrices act.
  const fx = W / 2;
  const parts = [["*M*", -84], ["=", -58], ["*T*", -30], ["·", -10], ["*R*", 10], ["·", 30], ["*S*", 50]];
  for (const [p, dx] of parts) s += text(fx + dx, PAD + 14, p, { size: 19, weight: 650, anchor: "middle" });
  for (const [n, dx] of [[3, -30], [2, 10], [1, 50]]) s += badge(fx + dx, PAD + 42, n);
  steps.forEach((st, i) => {
    const x = PAD + i * (P + GAP);
    s += panel(x, top, st);
    s += text(x + P / 2, top + P + 18, st.label, { size: 15, weight: 600, anchor: "middle" });
    if (st.sub) {
      s += badge(x + P / 2 - 30, top + P + 40, i, { r: 8 });
      s += text(x + P / 2 - 18, top + P + 40, st.sub, { size: 13, color: C.accent, weight: 600 });
    }
    if (i < 3) s += arrow(x + P + 8, top + P / 2, x + P + GAP - 8, top + P / 2, { color: C.line, width: 2 });
  });
  return svg(height, s);
}
