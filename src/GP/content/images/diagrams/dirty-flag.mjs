// Scene Graph, the dirty flag: a small tree in which one entity's local transform changed. updateSelfAndChild walks the
// whole tree, but recomputes only the dirty entity and everything below it (their global matrices contain its matrix);
// the clean entities elsewhere are only visited.
import { C, PAD, W, box, line, perLanguage, svg, t } from "./style.mjs";
import { label } from "./_practice.mjs";

export const variants = perLanguage("dirty-flag");
export const height = 400;

export function draw(v) {
  const nodes = { root: [W / 2, 50], a: [W / 2 - 170, 140], b: [W / 2 + 170, 140], a1: [W / 2 - 250, 230], a2: [W / 2 - 90, 230], b1: [W / 2 + 90, 230], b2: [W / 2 + 250, 230], b21: [W / 2 + 250, 310] };
  const edges = [["root", "a"], ["root", "b"], ["a", "a1"], ["a", "a2"], ["b", "b1"], ["b", "b2"], ["b2", "b21"]];
  const recompute = new Set(["b", "b1", "b2", "b21"]);
  let s = "";
  for (const [p, c] of edges) s += line(nodes[p][0], nodes[p][1], nodes[c][0], nodes[c][1], { color: recompute.has(c) ? C.accent : C.line, width: recompute.has(c) ? 2.5 : 1.5 });
  for (const [k, [x, y]] of Object.entries(nodes)) {
    const style = k === "b" ? "accent" : recompute.has(k) ? "accent" : "muted";
    s += box(x - 34, y - 20, 68, 40, { style, width: k === "b" ? 3 : 1.5, r: 20 });
    if (k === "b") s += label(x + 46, y - 4, t(v, "dirty", "dirty"), { color: C.accent, weight: 700 });
  }
  s += box(PAD, height - PAD - 34, 30, 30, { style: "accent", r: 15 }) + label(PAD + 40, height - PAD - 19, t(v, "matrix recomputed", "matrisen räknas om"));
  s += box(W / 2 + 40, height - PAD - 34, 30, 30, { style: "muted", r: 15 }) + label(W / 2 + 80, height - PAD - 19, t(v, "only visited", "bara besökt"));
  return svg(height, s);
}
