// PBR Theory, "The microfacet model": a smooth and a rough surface magnified – tiny mirrors (microfacets), almost all
// aligned with the normal on the smooth one, in all directions on the rough one. Parallel light rays reflect in about
// the same direction from the smooth surface (a small, sharp highlight) and scatter from the rough one (a wide one).
import { C, PAD, W, arrow, line, perLanguage, svg, t } from "./style.mjs";
import { label, panel, polyline } from "./_advlight.mjs";

export const variants = perLanguage("microfacets");

const GAP = 16, PW = (W - 2 * PAD - GAP) / 2, PH = 250;
export const height = PAD + PH + PAD;

// A surface of facets: their tilts in degrees (fixed numbers, so the picture doesn't change).
const tilts = {
  smooth: [2, -3, 1, 4, -2, 0, 3, -1, -4, 2, 1, -3, 0, 2],
  rough: [24, -30, 12, -18, 35, -8, -26, 20, 6, -34, 28, -14, 16, -22],
};

function scene(x, rough, v) {
  const y = PAD;
  let s = panel(x, y, PW, PH);
  s += label(x + 14, y + 24, rough ? t(v, "Rough", "Grov") : t(v, "Smooth", "Slät"), { size: 21, weight: 650 });
  const list = tilts[rough ? "rough" : "smooth"], fw = (PW - 40) / list.length;
  const base = y + PH - 50;
  // The facets: a polyline, each piece tilted.
  let px = x + 20, py = base;
  const pts = [[px, py]], mids = [];
  for (const a of list) {
    const r = (a * Math.PI) / 180;
    const nx = px + fw, ny = py - Math.tan(r) * fw;
    mids.push([(px + nx) / 2, (py + ny) / 2, r]);
    px = nx; py = ny;
    pts.push([px, py]);
  }
  // Keep the surface level on average.
  const drift = (pts[pts.length - 1][1] - base) / (pts.length - 1);
  const level = pts.map(([a, b], i) => [a, b - drift * i]);
  s += `<path d="M${level.map((p) => p.join(",")).join(" L")} L${x + PW - 20},${y + PH - 12} L${x + 20},${y + PH - 12} Z" fill="${C.grid}"/>`;
  s += polyline(level, { color: C.ink, width: 2.5 });
  // Light from the upper left (45°), reflected by every second facet.
  const lin = [Math.cos(-Math.PI / 4), -Math.sin(-Math.PI / 4)]; // the incoming direction: down and to the right
  for (let i = 1; i < mids.length - 2; i += 2) {
    const [mx, my0] = mids[i];
    const my = my0 - drift * (i + 0.5);
    const a = Math.atan2(level[i + 1][1] - level[i][1], level[i + 1][0] - level[i][0]);
    const n = [Math.sin(a), -Math.cos(a)]; // the facet's normal (up)
    const dd = lin[0] * n[0] + lin[1] * n[1];
    const r = [lin[0] - 2 * dd * n[0], lin[1] - 2 * dd * n[1]];
    if (r[1] > -0.1) continue; // a reflection along or into the surface would hit the next facet
    s += arrow(mx - lin[0] * 64, my - lin[1] * 64, mx - lin[0] * 4, my - lin[1] * 4, { color: C.accent, width: 2 });
    s += arrow(mx, my, mx + r[0] * 64, my + r[1] * 64, { color: C.accent2, width: 2 });
  }
  void line;
  return s;
}

export function draw(v) {
  return svg(height, scene(PAD, false, v) + scene(PAD + PW + GAP, true, v));
}
