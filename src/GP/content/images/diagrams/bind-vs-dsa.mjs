// DSA: what a call edits. With bind to edit, glBufferData names a target, and the context's binding decides which
// buffer is filled – whatever was bound last. With direct state access the call names the buffer itself.
import { BOLD, C, PAD, W, arrow, box, perLanguage, svg, t } from "./style.mjs";
import { code, label } from "./_practice.mjs";

export const variants = perLanguage("bind-vs-dsa");
export const height = 330;

export function draw(v) {
  let s = "";
  const r1 = PAD + 34, r2 = 214, ch = 74;
  s += label(PAD, PAD + 8, t(v, "bind to edit", "bind för att ändra"), { weight: 700 });
  s += box(PAD, r1, 300, ch, { style: "plain" });
  s += code(PAD + 14, r1 + 24, "glBufferData(");
  s += code(PAD + 14, r1 + 50, "  GL_ARRAY_BUFFER, …)");
  s += box(340, r1 - 6, 236, ch + 12, { style: "muted" });
  s += label(458, r1 + 14, t(v, "context", "kontexten"), { anchor: "middle", color: C.muted, weight: 500 });
  s += box(350, r1 + 32, 216, 38, { style: "accent2", label: "`GL_ARRAY_BUFFER`", size: 19 });
  s += box(600, r1, 100, ch / 2, { style: "accent", label: "`VBO`", size: 19 });
  s += box(600, r1 + ch / 2 + 10, 100, ch / 2, { style: "plain", label: "`EBO`", size: 19, opacity: 0.6 });
  s += arrow(PAD + 302, r1 + ch / 2, 348, r1 + 51, { color: C.ink, width: BOLD });
  s += arrow(568, r1 + 51, 598, r1 + ch / 4, { color: C.accent2, width: BOLD });
  s += label(580, r1 + ch + 30, t(v, "the one bound last", "den som bands sist"), { anchor: "middle", color: C.accent2, weight: 500 });
  s += label(PAD, r2 + 8, "DSA", { weight: 700 });
  s += box(PAD, r2 + 26, 300, ch, { style: "plain" });
  s += code(PAD + 14, r2 + 50, "glNamedBufferStorage(");
  s += code(PAD + 14, r2 + 76, "  VBO, …)");
  s += box(600, r2 + 26 + ch / 4, 100, ch / 2, { style: "accent", label: "`VBO`", size: 19 });
  s += arrow(PAD + 302, r2 + 26 + ch / 2, 598, r2 + 26 + ch / 2, { color: C.ink, width: BOLD });
  return svg(height, s);
}
