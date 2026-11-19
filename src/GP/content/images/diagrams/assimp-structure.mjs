// Assimp, after the quiz about the two meshes: what Assimp's importer makes of planet.obj – the aiScene owns the
// meshes (mMeshes) and the materials (mMaterials); the root node has a child node per object of the file, and a node
// only holds indices into the scene's mMeshes; each aiMesh has its vertex data, its faces and the index of its
// material. Language-free (Assimp's names and the file's).
import { C, PAD, W, arrowPath, svg } from "./style.mjs";
import { code } from "./_lighting.mjs";

export const variants = [{ out: "assimp-structure.webp", lang: "en" }];
export const height = 452;

function node(x, y, w, h, title, lines, o = {}) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${o.fill ?? "#fff"}" stroke="${o.stroke ?? C.boxStroke}" stroke-width="1.5"/>`;
  s += code(x + 12, y + 20, title, { weight: 700, color: o.color ?? C.ink });
  lines.forEach((l, i) => (s += code(x + 12, y + 48 + i * 25, l, { color: C.muted })));
  return s;
}

export function draw() {
  let s = "";
  // The scene: a frame around everything.
  s += `<rect x="${PAD}" y="${PAD}" width="${W - 2 * PAD}" height="${height - 2 * PAD}" rx="8" fill="none" stroke="${C.ink}" stroke-width="1.5"/>`;
  s += code(PAD + 14, PAD + 22, "aiScene", { weight: 700, size: 21 });
  // Left: the nodes.
  const nx = PAD + 18, nw = 250;
  s += code(nx + 2, PAD + 56, "mRootNode →", { color: C.muted });
  s += node(nx, PAD + 72, nw, 64, "aiNode (root)", ["mChildren"], { stroke: C.line });
  s += node(nx + 30, PAD + 166, nw - 30, 66, "aiNode planet", ["mMeshes: [0]"], {});
  s += node(nx + 30, PAD + 252, nw - 30, 66, "aiNode rings", ["mMeshes: [1]"], {});
  for (const y of [PAD + 199, PAD + 285]) s += arrowPath(`M${nx + 14},${PAD + 136} L${nx + 14},${y} L${nx + 28},${y}`, nx + 28, y, 1, 0, { color: C.line, width: 1.5 });
  // Right: the scene's arrays.
  const ax = 330, aw = W - PAD - 18 - ax;
  s += code(ax, PAD + 52, "mMeshes", { weight: 650, color: C.accent });
  s += node(ax, PAD + 66, aw, 162, "[0] aiMesh planet", ["mVertices, mNormals", "mTextureCoords", "mFaces", "mMaterialIndex"], { stroke: C.accent, fill: "#fffaf5", color: C.accent });
  s += node(ax, PAD + 238, aw, 36, "[1] aiMesh rings", [], { stroke: C.accent, fill: "#fffaf5", color: C.accent });
  s += code(ax, PAD + 304, "mMaterials", { weight: 650, color: C.accent2 });
  s += node(ax, PAD + 318, aw, 36, "aiMaterial planet", [], { stroke: C.accent2, fill: "#faf7ff", color: C.accent2 });
  s += node(ax, PAD + 362, aw, 36, "aiMaterial rings", [], { stroke: C.accent2, fill: "#faf7ff", color: C.accent2 });
  // A node's index → the mesh; the mesh's material index → the material.
  s += arrowPath(`M${nx + nw},${PAD + 214} C${ax - 30},${PAD + 214} ${ax - 40},${PAD + 90} ${ax},${PAD + 90}`, ax, PAD + 90, 1, 0, { color: C.accent, width: 2, dash: "5 4" });
  s += arrowPath(`M${nx + nw},${PAD + 300} C${ax - 30},${PAD + 300} ${ax - 40},${PAD + 256} ${ax},${PAD + 256}`, ax, PAD + 256, 1, 0, { color: C.accent, width: 2, dash: "5 4" });
  const my = PAD + 66 + 48 + 3 * 25;
  s += arrowPath(`M${ax + 200},${my + 2} C${W - PAD - 6},${my + 2} ${W - PAD - 6},${PAD + 336} ${ax + aw},${PAD + 336}`, ax + aw, PAD + 336, -1, 0, { color: C.accent2, width: 2, dash: "5 4" });
  return svg(height, s);
}
