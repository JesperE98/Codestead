// Hello Triangle, "Vertex input": the chapter's three vertices in normalized device coordinates – with the API's y
// direction (up in OpenGL and Direct3D, down in Vulkan) and the order of the vertices in the buffer (its winding) –
// and where the viewport transform puts them in the 800 × 600 window. Language-free (coordinates only).
import { BOLD, C, PAD, W, arrow, badge, grid, line, perApi, pill, svg, text } from "./style.mjs";

export const variants = perApi("ndc-triangle", ["opengl", "vulkan", "d3d12"], false);
export const height = 318;

const vertices = {
  opengl: [[-0.5, -0.5], [0.5, -0.5], [0.0, 0.5]],
  vulkan: [[0.0, -0.5], [0.5, 0.5], [-0.5, 0.5]],
  d3d12: [[0.0, 0.5], [0.5, -0.5], [-0.5, -0.5]],
};

export function draw(v) {
  let s = "";
  const yDown = v.api === "vulkan";
  const verts = vertices[v.api];
  // NDC: a square from −1 to 1.
  const S = 240, nx = PAD + 50, ny = PAD + 24;
  const P = ([x, y]) => [nx + ((x + 1) / 2) * S, ny + (yDown ? (y + 1) / 2 : (1 - y) / 2) * S];
  s += text(nx, PAD + 8, "NDC", { weight: 700, size: 15 });
  s += `<rect x="${nx}" y="${ny}" width="${S}" height="${S}" fill="#fff" stroke="${C.boxStroke}"/>`;
  s += grid(nx, ny, S, S, S / 4);
  const [cx, cy] = P([0, 0]);
  s += arrow(nx - 10, cy, nx + S + 24, cy, { color: C.x, width: 1.5 });
  s += text(nx + S + 28, cy, "*x*", { size: 15, weight: 600, color: C.x });
  s += arrow(cx, yDown ? ny - 10 : ny + S + 10, cx, yDown ? ny + S + 22 : ny - 22, { color: C.y, width: 1.5 });
  s += text(cx + 10, yDown ? ny + S + 18 : ny - 16, "*y*", { size: 15, weight: 600, color: C.y });
  // The edges' values.
  const edge = (x, y, label, anchor = "middle") => text(x, y, label, { size: 12.5, color: C.muted, anchor });
  s += edge(nx, ny + S + 14, "−1") + edge(nx + S, ny + S + 14, "1");
  s += edge(nx - 8, yDown ? ny : ny + S, "−1", "end") + edge(nx - 8, yDown ? ny + S : ny, "1", "end");
  // The triangle, its vertices in buffer order and the way round they go.
  const pts = verts.map(P);
  s += `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="${C.accent}" fill-opacity="0.18" stroke="${C.accent}" stroke-width="${BOLD}" stroke-linejoin="round"/>`;
  pts.forEach(([px, py], i) => {
    const [vx, vy] = verts[i];
    const below = yDown ? vy > 0 : vy < 0;
    s += badge(px, py, i, { r: 9 });
    s += pill(px + (vx < 0 ? -12 : vx > 0 ? 12 : 0), py + (below ? 22 : -22), `(${vx.toFixed(1)}, ${vy.toFixed(1)})`, { mono: true, size: 12, anchor: vx < 0 ? "end" : vx > 0 ? "start" : "middle" });
  });
  // Winding on the screen: the order 0 → 1 → 2 goes counter-clockwise in OpenGL, clockwise in the others. An arrow
  // along each edge, just outside the triangle, shows the way round.
  const [tx, ty] = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3];
  pts.forEach(([ax, ay], i) => {
    const [bx, by] = pts[(i + 1) % 3];
    const mx = (ax + bx) / 2, my = (ay + by) / 2, len = Math.hypot(bx - ax, by - ay);
    const dx = (bx - ax) / len, dy = (by - ay) / len;
    const out = Math.hypot(mx - tx, my - ty), ox = ((mx - tx) / out) * 14, oy = ((my - ty) / out) * 14;
    s += arrow(mx + ox - dx * 14, my + oy - dy * 14, mx + ox + dx * 14, my + oy + dy * 14, { color: C.accent2, width: 2 });
  });

  // The window, in pixels from the top left corner.
  const ww = 300, wh = 225, wx = W - PAD - ww - 10, wy = PAD + 34;
  s += arrow(nx + S + 52, cy, wx - 14, cy, { color: C.line, width: 2 });
  s += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="4" fill="${C.clear}"/>`;
  s += text(wx, PAD + 8, "800 × 600 px", { weight: 700, size: 15 });
  const W2 = (px, py) => [wx + (px / 800) * ww, wy + (py / 600) * wh];
  const pix = verts.map(([x, y]) => [Math.round(((x + 1) / 2) * 800), Math.round((yDown ? (y + 1) / 2 : (1 - y) / 2) * 600)]);
  const wpts = pix.map(([px, py]) => W2(px, py));
  s += `<polygon points="${wpts.map((p) => p.join(",")).join(" ")}" fill="${C.accent}" stroke="${C.accent}" stroke-width="1.5" stroke-linejoin="round"/>`;
  wpts.forEach(([px, py], i) => {
    const [x] = verts[i];
    const top = py < wy + wh / 2;
    s += pill(px + (x < 0 ? -6 : x > 0 ? 6 : 0), py + (top ? -16 : 16), `(${pix[i][0]}, ${pix[i][1]})`, { mono: true, size: 12, anchor: x < 0 ? "end" : x > 0 ? "start" : "middle" });
  });
  s += line(wx, wy, wx + 22, wy, { color: "#ffffff", width: 1.5 }) + line(wx, wy, wx, wy + 22, { color: "#ffffff", width: 1.5 });
  s += `<circle cx="${wx}" cy="${wy}" r="3" fill="${C.ink}"/>`;
  s += text(wx - 6, wy - 10, "(0, 0)", { size: 12.5, color: C.muted, anchor: "end" });
  return svg(height, s);
}
