// Collision resolution: the ball flying up into a brick from below. Left: the vector from the ball's centre C to the
// closest point P points up the screen, (0, −8); of learnopengl's compass – drawn in the game's coordinates, where y
// points down, so "UP" (0, 1) points down the screen – it is closest to DOWN (0, −1). Right: the resolution moves the
// ball down by the penetration, radius − ‖P − C‖, until it just touches, and reverses its vertical velocity.
import { C, PAD, W, arrow, dot, line, perLanguage, svg, t } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = perLanguage("resolve-direction");
export const height = 420;

function scene(s0, x0, ballY, v, after) {
  let s = s0;
  const by = 120, r = 62.5;
  s += `<rect x="${x0 + 20}" y="${PAD + 40}" width="${200}" height="${by - PAD - 40}" rx="4" fill="${C.zSoft}" stroke="${C.z}" stroke-width="2"/>`;
  s += `<circle cx="${x0 + 120}" cy="${ballY}" r="${r}" fill="${C.ySoft}" stroke="${C.y}" stroke-width="2" opacity="0.95"/>`;
  s += dot(x0 + 120, ballY, { r: 5 });
  if (!after) {
    s += arrow(x0 + 120, ballY, x0 + 120, by + 3, { color: C.accent, width: 3 });
    s += dot(x0 + 120, by, { r: 5, color: C.accent });
    s += label(x0 + 108, by + 14, "*P*", { color: C.accent, anchor: "end" });
    s += label(x0 + 132, ballY + 4, "*C*");
    s += code(x0 + 194, (ballY + by) / 2 + 20, "(0, −8)", { color: C.accent, weight: 700 });
  } else {
    s += line(x0 + 10, by, x0 + 230, by, { color: C.accent, width: 1.5, dash: "4 3" });
    s += arrow(x0 + 120, ballY, x0 + 120, ballY + 90, { color: C.accent2, width: 3 });
    s += code(x0 + 132, ballY + 70, "Velocity.y", { color: C.accent2, weight: 600 });
  }
  return s;
}

export function draw(v) {
  let s = "";
  const r = 62.5, by = 120;
  // left: the vector and the compass
  s = scene(s, PAD, by + 40, v, false); // ‖P − C‖ = 8 of the radius 12.5, drawn 5 times as large
  // the compass in the game's coordinates (y down)
  const cx = 360, cy = 250, L = 64;
  s += label(cx, PAD + 22, t(v, "learnopengl's compass", "learnopengls kompass"), { anchor: "middle" });
  s += label(cx, PAD + 48, t(v, "(y points down)", "(y pekar nedåt)"), { anchor: "middle", color: C.muted, weight: 500 });
  const dirs = [["UP", 0, 1], ["RIGHT", 1, 0], ["DOWN", 0, -1], ["LEFT", -1, 0]];
  for (const [n, dx, dy] of dirs) {
    const hit = n === "DOWN";
    s += arrow(cx, cy, cx + dx * L, cy + dy * L, { color: hit ? C.accent : C.line, width: hit ? 3 : 2 });
    s += code(cx + dx * (L + 14), cy + dy * (L + 18), n, { anchor: dx > 0 ? "start" : dx < 0 ? "end" : "middle", color: hit ? C.accent : C.muted, weight: hit ? 700 : 500 });
  }
  // right: after the resolution
  const x1 = W - PAD - 240;
  s = scene(s, x1, by + r, v, true);
  s += label(x1 + 120, height - PAD - 10, t(v, "moved down by 4.5", "flyttad 4,5 nedåt"), { anchor: "middle", fit: 300 });
  s += label(PAD + 120, height - PAD - 10, t(v, "penetration: 12.5 − 8 = 4.5", "inträngning: 12,5 − 8 = 4,5"), { anchor: "middle", fit: 300 });
  return svg(height, s);
}
