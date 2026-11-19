// OpenGL, "State machine": the context as a set of settings; state-changing functions write into it, state-using
// functions read from it when they run – glClearColor sets the clear colour that glClear later fills the window with.
import { C, PAD, W, arrow, box, perLanguage, svg, t, text } from "./style.mjs";

export const variants = perLanguage("opengl-state");
export const height = 250;

export function draw(v) {
  let s = "";
  const top = PAD + 34;
  const rowH = 38;
  // Left: state-changing functions; middle: the context; right: state-using functions.
  const lx = PAD, lw = 186, cx = 240, cw = 262, rx = W - PAD - 160, rw = 160;
  s += text(lx + lw / 2, PAD + 12, t(v, "State-changing", "Tillståndsändrande"), { anchor: "middle", weight: 650, size: 14, fit: lw });
  s += text(cx + cw / 2, PAD + 12, t(v, "The context", "Kontexten"), { anchor: "middle", weight: 650, size: 14 });
  s += text(rx + rw / 2, PAD + 12, t(v, "State-using", "Tillståndsanvändande"), { anchor: "middle", weight: 650, size: 14, fit: rw + 20 });

  const state = [
    ["glClearColor(…)", t(v, "clear colour", "rensningsfärg"), "0.2, 0.3, 0.3, 1.0"],
    ["glUseProgram(…)", t(v, "shader program", "shaderprogram"), "shaderProgram"],
    ["glBindVertexArray(…)", t(v, "bound VAO", "bundet VAO"), "VAO"],
    ["glPolygonMode(…)", t(v, "polygon mode", "polygonläge"), "GL_FILL"],
  ];
  s += `<rect x="${cx}" y="${top - 8}" width="${cw}" height="${state.length * rowH + 8}" rx="8" fill="${C.accentSoft}" stroke="${C.accent}" stroke-width="1.5"/>`;
  state.forEach(([call, name, value], i) => {
    const y = top + i * rowH;
    s += box(lx, y, lw, rowH - 10, { label: call, mono: true, size: 12, weight: 500 });
    s += arrow(lx + lw + 4, y + (rowH - 10) / 2, cx - 4, y + (rowH - 10) / 2, { color: C.accent, width: 1.5 });
    s += `<rect x="${cx + 10}" y="${y}" width="${cw - 20}" height="${rowH - 10}" rx="5" fill="#fff" stroke="${C.boxStroke}"/>`;
    s += text(cx + 20, y + (rowH - 10) / 2, name, { size: 12, color: C.muted, fit: 100 });
    s += text(cx + cw - 20, y + (rowH - 10) / 2, value, { size: 12, mono: true, anchor: "end", fit: cw - 130 });
  });
  // The state-using calls read what they need.
  const uses = [
    ["glClear(…)", [0]],
    ["glDrawArrays(…)", [1, 2, 3]],
  ];
  uses.forEach(([call, rows], i) => {
    const y = top + 18 + i * 2 * rowH;
    s += box(rx, y, rw, rowH - 10, { label: call, mono: true, size: 12, weight: 500, style: "accent2" });
    for (const r of rows) {
      const ry = top + r * rowH + (rowH - 10) / 2;
      s += arrow(cx + cw + 4, ry, rx - 4, y + (rowH - 10) / 2, { color: C.accent2, width: 1.2 });
    }
  });
  s += text(cx + cw / 2, top + state.length * rowH + 22, t(v, "…and many more settings", "…och många fler inställningar"), { anchor: "middle", size: 12, color: C.muted });
  return svg(height, s);
}
