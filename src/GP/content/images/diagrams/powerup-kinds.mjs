// Powerups: the six kinds – the course's light pill textures tinted with each kind's colour, as the sprite shader does,
// their type string, what they do and how long (a duration of 0 lasts until the ball is lost).
import { C, PAD, W, line, perLanguage, svg, t } from "./style.mjs";
import { code, gameTexture, label, tintFilter } from "./_practice.mjs";

export const variants = perLanguage("powerup-kinds");
const RH = 50;
export const height = PAD + 6 * RH + PAD - 4;

const kinds = (v) => [
  ["speed", "powerup_speed", [0.5, 0.5, 1.0], t(v, "ball 20 % faster", "bollen 20 % snabbare"), 0],
  ["sticky", "powerup_sticky", [1.0, 0.5, 1.0], t(v, "ball sticks to the paddle", "bollen fastnar på racketen"), 20],
  ["pass-through", "powerup_pass", [0.5, 1.0, 0.5], t(v, "ball goes through blocks", "bollen går genom blocken"), 10],
  ["pad-size-increase", "powerup_increase", [1.0, 0.6, 0.4], t(v, "paddle 50 px wider", "racketen 50 px bredare"), 0],
  ["confuse", "powerup_confuse", [1.0, 0.3, 0.3], t(v, "the confuse effect", "effekten confuse"), 15],
  ["chaos", "powerup_chaos", [0.9, 0.25, 0.25], t(v, "the chaos effect", "effekten chaos"), 15],
];

export function draw(v) {
  const list = kinds(v);
  let s = `<defs>${list.map(([n, , c]) => tintFilter(`p-${n}`, c)).join("")}</defs>`;
  list.forEach(([name, tex, , what, secs], i) => {
    const y = PAD + i * RH + RH / 2;
    if (i > 0) s += line(PAD, y - RH / 2, W - PAD, y - RH / 2, { color: C.grid, width: 1 });
    s += `<image href="${gameTexture(tex)}" x="${PAD}" y="${y - 15}" width="90" height="30" preserveAspectRatio="none" filter="url(#p-${name})"/>`;
    s += code(PAD + 106, y, `"${name}"`, { weight: 600 });
    s += label(PAD + 352, y, what, { weight: 500, fit: 240 });
    s += label(W - PAD, y, secs === 0 ? t(v, "lasting", "bestående") : `${secs} s`, { anchor: "end", color: secs >= 15 && name !== "sticky" && name !== "pass-through" ? C.bad : C.muted });
  });
  return svg(height, s);
}
