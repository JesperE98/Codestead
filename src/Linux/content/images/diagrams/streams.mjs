// Redirection and pipes: the three standard streams as pipes – stdin (0) from the keyboard into the program, stdout (1)
// and stderr (2) out of it, both to the screen.
import { C, FS_TITLE, PAD, box, label, perLanguage, svg, tr } from "./style.mjs";
import { keyboard, pipe, screen, streamTag, words as pipeWords } from "./_pipes.mjs";

export const variants = perLanguage("streams");

export const words = { keyboard: pipeWords.keyboard, screen: pipeWords.screen, program: pipeWords.program };

export const height = 226;

export function draw(v) {
  let s = "";
  const kx = PAD + 6, kw = 130, ky = 74;
  s += keyboard(v, kx, ky, kw, tr(v, words.keyboard));
  const px = 262, pw = 160, py = 54, ph = 104;
  s += box(px, py, pw, ph, { style: "accent" });
  s += label(v, px + pw / 2, py + ph / 2, tr(v, words.program), { anchor: "middle", size: FS_TITLE, weight: 700, fit: pw - 16 });
  const sx = 566, sw = 134, sy = 34, sh = 140;
  // The screen shows what both stdout (green lines) and stderr (a red line) write.
  let inside = "";
  [[0, C.y, 0.8], [1, C.y, 0.55], [2, C.y, 0.7], [3, C.x, 0.9], [4, C.y, 0.65]].forEach(([i, color, f]) => {
    inside += `<rect x="${sx + 12}" y="${sy + 16 + i * 22}" width="${(sw - 24) * f}" height="9" rx="3" fill="${color}" opacity="0.85"/>`;
  });
  s += screen(v, sx, sy, sw, sh, tr(v, words.screen), inside);
  // stdin: keyboard → program.
  const inY = ky + 23;
  s += pipe(`M${kx + kw + 4},${inY} H${px - 4}`, 0, px - 4, inY, 1, 0);
  s += streamTag((kx + kw + px) / 2, inY - 32, 0);
  // stdout and stderr: program → screen.
  const outY = py + 30, errY = py + ph - 30;
  s += pipe(`M${px + pw + 4},${outY} H${sx - 4}`, 1, sx - 4, outY, 1, 0);
  s += pipe(`M${px + pw + 4},${errY} H${sx - 4}`, 2, sx - 4, errY, 1, 0);
  s += streamTag((px + pw + sx) / 2, outY - 30, 1);
  s += streamTag((px + pw + sx) / 2, errY + 30, 2);
  return svg(height, s);
}
