// Render text: the game's three states and what moves the game between them – ENTER in the menu, the last life lost
// or the level completed while playing, ENTER on the win screen.
import { BOLD, C, PAD, W, arrow, arrowPath, box, perLanguage, svg, t } from "./style.mjs";
import { label } from "./_practice.mjs";

export const variants = perLanguage("game-states");
export const height = 380;

export function draw(v) {
  const bw = 200, bh = 60;
  const menu = [PAD + 40, 130], active = [W - PAD - 40 - bw, 130], win = [(W - bw) / 2, 290];
  let s = box(menu[0], menu[1], bw, bh, { style: "accent2", label: "`GAME_MENU`", size: 19 });
  s += box(active[0], active[1], bw, bh, { style: "accent", label: "`GAME_ACTIVE`", size: 19 });
  s += box(win[0], win[1], bw, bh, { style: "y", label: "`GAME_WIN`", size: 19 });
  // the start
  s += arrow(menu[0] + bw / 2, PAD + 30, menu[0] + bw / 2, menu[1] - 4, { color: C.ink, width: BOLD });
  s += label(menu[0] + bw / 2 + 14, PAD + 40, t(v, "start", "start"), { color: C.muted });
  // menu → active (above), active → menu (below)
  const ax = menu[0] + bw, bx = active[0];
  s += arrowPath(`M${ax},${menu[1] + 14} C${ax + 80},${menu[1] - 40} ${bx - 80},${menu[1] - 40} ${bx},${menu[1] + 14}`, bx, menu[1] + 14, 1, 0.9, { color: C.ink, width: BOLD });
  s += label(W / 2, menu[1] - 34, "ENTER", { anchor: "middle", weight: 700 });
  s += arrow(bx, menu[1] + 46, ax + 4, menu[1] + 46, { color: C.bad, width: BOLD });
  s += label(W / 2, menu[1] + 70, t(v, "last life lost", "sista livet förlorat"), { anchor: "middle", color: C.bad });
  // active → win, win → menu
  s += arrow(active[0] + 40, active[1] + bh + 4, win[0] + bw - 30, win[1] - 4, { color: C.good, width: BOLD });
  s += label((active[0] + win[0] + bw) / 2 + 18, (active[1] + bh + win[1]) / 2, t(v, "level complete", "banan klar"), { color: C.good });
  s += arrow(win[0] + 30, win[1] - 4, menu[0] + bw - 40, menu[1] + bh + 4, { color: C.ink, width: BOLD });
  s += label((win[0] + menu[0] + bw) / 2 - 22, (menu[1] + bh + win[1]) / 2, "ENTER", { anchor: "end", weight: 700 });
  return svg(height, s);
}
