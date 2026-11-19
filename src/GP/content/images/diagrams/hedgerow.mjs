// The 2D Game: Hedgerow – the finished game's parts, labelled on a frame the simulator draws from the course's own
// project (Powerups, at 1.5 s: the six test power-ups falling, the ball coming down after its bounce off a stone).
import { C, PAD, W, image, line, perLanguage, pill, svg, t } from "./style.mjs";

export const variants = perLanguage("hedgerow");
const IW = W - 2 * PAD, K = IW / 800;
export const height = PAD + 600 * K + PAD;
export const lossy = true;
export const quality = 75;
export const renders = { game: { api: "opengl", chapter: "powerups", width: Math.round(IW * 2), times: [1.5] } };

export function draw(v, R) {
  const g = (x, y) => [PAD + x * K, PAD + y * K];
  let s = image(R.game[0].href, PAD, PAD, IW, 600 * K);
  // label at (lx, ly) in the game's pixels, with a leader to (tx, ty)
  const tag = (lx, ly, tx, ty, en, sv, anchor = "middle") => {
    const [ax, ay] = g(lx, ly), [bx, by] = g(tx, ty);
    let r = tx === null ? "" : line(ax, ay, bx, by, { color: "#ffffff", width: 2 }) + `<circle cx="${bx}" cy="${by}" r="4" fill="#fff"/>`;
    return r + pill(ax, ay, t(v, en, sv), { size: 19, anchor });
  };
  s += tag(400, 75, null, null, "blocks: destroyed when hit", "block: förstörs när de träffas");
  s += tag(160, 262, 80, 210, "solid stone", "solid sten");
  s += tag(640, 252, 505, 262, "ball", "boll");
  s += tag(300, 318, 466, 322, "particles", "partiklar");
  s += tag(345, 450, 345, 400, "power-ups", "power-ups");
  s += tag(250, 560, 375, 588, "paddle", "racket");
  return svg(height, s);
}
