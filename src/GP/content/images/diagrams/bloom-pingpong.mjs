// Bloom, "Gaussian blur": the ten blur passes between the two ping-pong buffers. The first pass reads the bright colour
// buffer; each horizontal pass draws into buffer 1 and each vertical one into buffer 0, reading the other – so the
// tenth pass, a vertical one, leaves the result in buffer 0 (pingpong[!horizontal]).
import { C, PAD, W, arrow, perLanguage, svg, t, text } from "./style.mjs";
import { label } from "./_advlight.mjs";

export const variants = perLanguage("bloom-pingpong");

export const height = PAD + 190 + PAD;

export function draw(v) {
  let s = "";
  const lane = (y) => y;
  const y1 = lane(PAD + 66), y0 = lane(PAD + 150); // buffer 1 above, buffer 0 below
  const x0 = PAD + 150, step = (W - PAD - x0 - 30) / 10;
  // The lanes.
  s += text(PAD, PAD + 18, t(v, "bright buffer", "ljus buffert"), { size: 19, weight: 600, color: C.accent });
  s += text(PAD, y1, "pingpong[1]", { size: 19, mono: true, weight: 600 });
  s += text(PAD, y0, "pingpong[0]", { size: 19, mono: true, weight: 600 });
  s += `<line x1="${x0 - 10}" y1="${y1}" x2="${W - PAD}" y2="${y1}" stroke="${C.grid}" stroke-width="10" stroke-linecap="round"/>`;
  s += `<line x1="${x0 - 10}" y1="${y0}" x2="${W - PAD}" y2="${y0}" stroke="${C.grid}" stroke-width="10" stroke-linecap="round"/>`;
  // Pass i (1 … 10): odd passes are horizontal (into buffer 1), even ones vertical (into buffer 0).
  let fromX = x0 - 10, fromY = PAD + 18;
  for (let i = 1; i <= 10; i++) {
    const h = i % 2 === 1;
    const x = x0 + (i - 0.5) * step, y = h ? y1 : y0;
    s += arrow(fromX, fromY, x - 4, y + (h ? 8 : -8) * 0, { color: h ? C.accent : C.accent2, width: 2 });
    s += `<circle cx="${x}" cy="${y}" r="15" fill="${h ? C.accent : C.accent2}"/>`;
    s += text(x, y + 0.5, h ? "H" : "V", { size: 19, weight: 700, color: "#fff", anchor: "middle" });
    fromX = x + 6; fromY = y;
  }
  s += label(W - PAD, y0 + 30, t(v, "pass 10: the result", "pass 10: resultatet"), { anchor: "end", color: C.accent2 });
  s += label(x0 + step * 0.5 - 14, PAD + 18, t(v, "H: horizontal, V: vertical", "H: horisontellt, V: vertikalt"), { color: C.muted });
  return svg(height, s);
}
