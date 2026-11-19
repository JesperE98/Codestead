// Setting up your IDE, "The folders": the suggested layout (a folder per chapter, a shared libs folder) and why the
// program must run in the chapter folder – a relative path such as "shaders/vert.spv" is looked up in the working
// directory, and the build folder doesn't have the file. One variant per API (its files and its example path).
import { C, PAD, W, arrow, perApi, pill, svg, t, text } from "./style.mjs";

export const variants = perApi("working-directory", ["opengl", "vulkan", "d3d12"], true);
export const height = 286;

const files = {
  opengl: { shaders: ["shader.vs", "shader.fs"], path: '"shader.vs"', found: "shader.vs" },
  vulkan: { shaders: ["shaders/shader.vert", "shaders/vert.spv"], path: '"shaders/vert.spv"', found: "shaders/vert.spv" },
  d3d12: { shaders: ["shaders.hlsl"], path: 'L"shaders.hlsl"', found: "shaders.hlsl" },
};

export function draw(v) {
  const f = files[v.api];
  let s = "";
  // The folder tree, on the left.
  const x0 = PAD + 14, lh = 24;
  let y = PAD + 22;
  const rows = [];
  const row = (depth, name, o = {}) => {
    rows.push({ depth, name, y, ...o });
    y += lh;
  };
  row(0, t(v, "course/", "kurs/"), { folder: true });
  row(1, "libs/", { folder: true, note: t(v, "shared by all chapters", "delas av alla kapitel") });
  row(1, "hello-triangle/", { folder: true, wd: true });
  row(2, "main.cpp");
  for (const sh of f.shaders) row(2, sh, { hit: sh === f.found });
  row(2, "container.png");
  row(2, "build/", { folder: true, build: true, note: t(v, "or cmake-build-debug, out, x64 …", "eller cmake-build-debug, out, x64 …") });
  row(3, v.api === "d3d12" ? "main.exe" : t(v, "your program", "ditt program"), { exe: true });
  s += `<rect x="${PAD}" y="${PAD}" width="370" height="${height - 2 * PAD}" rx="8" fill="#fff" stroke="${C.boxStroke}"/>`;
  for (const r of rows) {
    const x = x0 + r.depth * 20;
    if (r.depth > 0) s += `<path d="M${x - 12},${r.y - lh + 8} L${x - 12},${r.y} L${x - 4},${r.y}" fill="none" stroke="${C.boxStroke}"/>`;
    if (r.wd) s += `<rect x="${x - 6}" y="${r.y - 11}" width="${r.name.length * 7.6 + 16}" height="22" rx="5" fill="${C.accentSoft}" stroke="${C.accent}"/>`;
    if (r.build) s += `<rect x="${x - 6}" y="${r.y - 11}" width="${r.name.length * 7.6 + 16}" height="22" rx="5" fill="${C.xSoft}" stroke="${C.x}" stroke-dasharray="4 3"/>`;
    s += text(x, r.y, r.name, { mono: true, size: 12.5, weight: r.folder ? 700 : 500, color: r.exe ? C.muted : C.ink });
    if (r.note) s += text(x + r.name.length * 7.6 + 18, r.y, r.note, { size: 12, color: C.muted });
  }
  // On the right: the same relative path from the two working directories.
  const rx = 404, rw = W - PAD - rx;
  const buildRow = rows.find((r) => r.build), hitRow = rows.find((r) => r.hit);
  s += text(rx, PAD + 16, t(v, "The program opens", "Programmet öppnar"), { size: 13, weight: 600 });
  s += pill(rx, PAD + 40, f.path, { mono: true, size: 12 });
  const caseBox = (y, ok, title, line2) => {
    const color = ok ? C.good : C.bad;
    let c = `<rect x="${rx}" y="${y}" width="${rw}" height="66" rx="8" fill="#fff" stroke="${color}" stroke-width="1.5"/>`;
    c += text(rx + 14, y + 20, title, { size: 13, weight: 650, fit: rw - 50 });
    c += text(rx + 14, y + 44, line2, { size: 12, color: C.muted, fit: rw - 24 });
    c += text(rx + rw - 16, y + 20, ok ? "✓" : "✗", { size: 20, weight: 700, color, anchor: "middle" });
    return c;
  };
  const yOk = PAD + 70, yBad = PAD + 152;
  s += caseBox(yOk, true, t(v, "Working directory: the chapter folder", "Arbetskatalog: kapitelmappen"), t(v, `finds hello-triangle/${f.found}`, `hittar hello-triangle/${f.found}`));
  s += caseBox(yBad, false, t(v, "Working directory: the build folder", "Arbetskatalog: byggmappen"), t(v, `looks for build/${f.found} – not there`, `letar efter build/${f.found} – finns inte`));
  // Arrows from the cases to the folders they mean.
  // Where a row's text ends (the build folder's note included), for the arrows to point at.
  const end = (r) => x0 + r.depth * 20 + r.name.length * 7.6 + (r.note ? 18 + r.note.length * 6.5 : 14);
  s += arrow(rx - 4, yOk + 33, end(hitRow) + 4, hitRow.y, { color: C.good, width: 1.5 });
  s += arrow(rx - 4, yBad + 33, end(buildRow) + 8, buildRow.y, { color: C.bad, width: 1.5, dash: "4 3" });
  return svg(height, s);
}
