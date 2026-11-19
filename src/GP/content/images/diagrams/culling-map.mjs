// Frustum Culling, seen from above at 2.0 s: the grid of 101 planets turned by 40°, the camera at (3, 6, 12) looking
// down 25° along −z, and each planet's bounding sphere tested against the frustum exactly as the chapter's program does
// it (sphere from the planet model's vertices, scaled by the global matrix). Left the culling frustum with its far plane
// at 15 (8 drawn), right the camera's own with the far plane at 100 (37 drawn). The shaded wedge is the frustum's
// footprint on the ground plane y = 0 (the camera looks down, so the near ground is cut off at the bottom edge).
import { readFileSync } from "node:fs";
import { C, PAD, W, dot, perLanguage, svg, t } from "./style.mjs";
import { label } from "./_practice.mjs";

export const variants = perLanguage("culling-map");
const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = PW * 1.12;
export const height = PAD + PH + 46 + PAD - 6;

const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, k) => a.map((x) => x * k);
const dotp = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));

function sphere() {
  const obj = readFileSync(new URL("../../projects/opengl/frustum-culling/solution/models/planet.obj", import.meta.url), "utf8");
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const l of obj.split("\n")) if (l.startsWith("v ")) l.trim().split(/\s+/).slice(1, 4).map(Number).forEach((x, i) => { min[i] = Math.min(min[i], x); max[i] = Math.max(max[i], x); });
  const c = mul(add(min, max), 0.5);
  return { c, r: Math.hypot(...sub(max, c)) };
}

function frustum(far) {
  const pos = [3, 6, 12], yaw = (-90 * Math.PI) / 180, pitch = (-25 * Math.PI) / 180;
  const front = norm([Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)]);
  const right = norm(cross(front, [0, 1, 0])), up = norm(cross(right, front));
  const hv = far * Math.tan((45 * Math.PI) / 360), hh = hv * (800 / 600), ff = mul(front, far);
  const plane = (p, n) => { const nn = norm(n); return { n: nn, d: dotp(nn, p) }; };
  return { pos, front, planes: [plane(add(pos, mul(front, 0.1)), front), plane(add(pos, ff), mul(front, -1)),
    plane(pos, cross(sub(ff, mul(right, hh)), up)), plane(pos, cross(up, add(ff, mul(right, hh)))),
    plane(pos, cross(right, sub(ff, mul(up, hv)))), plane(pos, cross(add(ff, mul(up, hv)), right))] };
}

function planets() {
  const a = (40 * Math.PI) / 180, R = ([x, y, z]) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
  const s = sphere(), list = [{ c: R(s.c), r: s.r }];
  for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) list.push({ c: R(add([x * 5 - 22.5, 0, z * 5 - 22.5], mul(s.c, 0.5))), r: s.r * 0.5 });
  return list;
}

export function draw(v) {
  const list = planets();
  let s = "";
  [15, 100].forEach((far, i) => {
    const f = frustum(far);
    const inside = (p) => f.planes.every((pl) => dotp(pl.n, p.c) - pl.d > -p.r);
    const x0 = PAD + i * (PW + GAP), k = PW / 66; // 66 world units across
    const g = ([wx, , wz]) => [x0 + PW / 2 + (wx - 1) * k, PAD + PH * 0.58 + (wz - 4) * k];
    s += `<clipPath id="cm${i}"><rect x="${x0}" y="${PAD}" width="${PW}" height="${PH}" rx="6"/></clipPath><g clip-path="url(#cm${i})">`;
    s += `<rect x="${x0}" y="${PAD}" width="${PW}" height="${PH}" fill="#fff"/>`;
    // the footprint of the four side planes and the far plane on y = 0
    let poly = [[-60, -60], [60, -60], [60, 60], [-60, 60]]; // clipped by each plane on y = 0
    for (const pl of f.planes) {
      const val = ([x, z]) => pl.n[0] * x + pl.n[2] * z - pl.d, out = [];
      poly.forEach((a, j) => {
        const b = poly[(j + 1) % poly.length], va = val(a), vb = val(b);
        if (va >= 0) out.push(a);
        if ((va >= 0) !== (vb >= 0)) { const u = va / (va - vb); out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
      });
      poly = out;
    }
    if (poly.length) s += `<path d="${poly.map(([x, z], j) => `${j ? "L" : "M"}${g([x, 0, z]).join(",")}`).join(" ")} Z" fill="${C.accentSoft}"/>`;
    let n = 0;
    for (const p of list) {
      const [px, py] = g(p.c), on = inside(p);
      if (on) n++;
      s += `<circle cx="${px}" cy="${py}" r="${p.r * k}" fill="${on ? C.accent : "none"}" fill-opacity="${on ? 0.85 : 0}" stroke="${on ? C.accent : C.line}" stroke-width="1.2"/>`;
    }
    const [cx, cy] = g(f.pos);
    s += dot(cx, cy, { r: 6, color: C.ink }) + `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 26}" stroke="${C.ink}" stroke-width="2.5"/>`;
    s += `</g><rect x="${x0}" y="${PAD}" width="${PW}" height="${PH}" rx="6" fill="none" stroke="${C.boxStroke}"/>`;
    s += label(x0 + PW / 2, PAD + PH + 24, t(v, `far plane ${far}: ${n} / 101 drawn`, `fjärrplan ${far}: ${n} / 101 ritas`), { anchor: "middle", fit: PW });
  });
  return svg(height, s);
}
