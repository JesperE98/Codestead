// Collision resolution, tunnelling: a fast ball moves further in one frame than a thin brick is thick. The collision
// test sees only the positions of frame n and frame n + 1 – neither overlaps the brick – and the ball passes through.
import { C, PAD, W, arrow, svg } from "./style.mjs";
import { label } from "./_practice.mjs";

export const variants = [{ out: "tunnelling.webp", lang: "en" }];
export const height = 250;

export function draw() {
  const y = 120, r = 34;
  let s = `<rect x="${W / 2 - 12}" y="${PAD + 10}" width="24" height="${height - 2 * PAD - 20}" rx="3" fill="${C.zSoft}" stroke="${C.z}" stroke-width="2"/>`;
  const xs = [W / 2 - 260, W / 2 - 90, W / 2 + 90, W / 2 + 260];
  s += arrow(xs[0], y, xs[3] + r + 30, y, { color: C.line, width: 2, dash: "6 5" });
  xs.forEach((x, i) => {
    const now = i === 1 || i === 2;
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${now ? C.ySoft : "none"}" stroke="${C.y}" stroke-width="2"${now ? "" : ' stroke-dasharray="5 4"'} opacity="${now ? 1 : 0.6}"/>`;
    const name = ["*n* − 1", "*n*", "*n* + 1", "*n* + 2"][i];
    s += label(x, y + r + 28, name, { anchor: "middle", color: now ? C.ink : C.muted });
  });
  return svg(height, s);
}
