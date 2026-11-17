import { clamp, toInt } from "../internal/dotnet.js";

// The C# code computes in 64-bit integers (long); every value here stays far below 2^53, so plain numbers with
// Math.trunc for the divisions give the same results. The bit operations are on values below 2^31.
const FracBits = 16;
const One = 1 << FracBits;
const Half = One / 2;

/** The domain points (u, v) and the triangles (indices into them, counter-clockwise unless cw). */
export interface Mesh {
  readonly points: [number, number][];
  readonly triangles: number[][];
}

/** How the points of an edge with one level are placed (D3D's TESS_FACTOR_CONTEXT). */
class Edge {
  odd = false;
  halfFraction = 0;
  numHalfPoints = 0;
  splitPoint = 0;
  invFloorSegments = 0;
  invCeilSegments = 0;

  /** The number of points along the edge, both ends included. */
  get points(): number {
    return this.odd ? this.numHalfPoints * 2 : this.numHalfPoints * 2 + 1;
  }

  static of(level: number, odd: boolean): Edge {
    const e = new Edge();
    e.odd = odd;
    const fxp = Math.trunc(level * One);
    let half = Math.trunc((fxp + 1) / 2);
    if (odd || half === Half) half += Half;
    const floor = half - (half % One);
    const ceil = half + One - 1 - ((half + One - 1) % One);
    e.halfFraction = half - floor;
    e.numHalfPoints = toInt(ceil / One);
    if (ceil === floor) e.splitPoint = e.numHalfPoints + 1;
    else if (odd) e.splitPoint = floor === One ? 0 : (removeMsb(toInt(floor / One) - 1) << 1) + 1;
    else e.splitPoint = (removeMsb(toInt(floor / One)) << 1) + 1;
    let floorSegments = toInt(Math.trunc((floor * 2) / One)), ceilSegments = toInt(Math.trunc((ceil * 2) / One));
    if (odd) {
      floorSegments -= 1;
      ceilSegments -= 1;
    }
    e.invFloorSegments = floorSegments <= 0 ? 0 : Math.trunc((One + Math.trunc(floorSegments / 2)) / floorSegments);
    e.invCeilSegments = ceilSegments <= 0 ? 0 : Math.trunc((One + Math.trunc(ceilSegments / 2)) / ceilSegments);
    return e;
  }

  /** Where point `point` (0 … points - 1) lies on the edge, 0 … 1. */
  place(point: number): number {
    let flip = false;
    if (point >= this.numHalfPoints) {
      point = (this.numHalfPoints << 1) - point;
      if (this.odd) point -= 1;
      flip = true;
    }
    if (point === this.numHalfPoints) return 0.5;
    const onCeil = point;
    let onFloor = point;
    if (point > this.splitPoint) onFloor -= 1;
    const locFloor = onFloor * this.invFloorSegments, locCeil = onCeil * this.invCeilSegments;
    // (… + Half) >> FracBits on a long: a floor division by 2^16.
    let loc = Math.floor((locFloor * (One - this.halfFraction) + locCeil * this.halfFraction + Half) / One);
    if (flip) loc = One - loc;
    return clamp(loc / One, 0, 1);
  }

  all(): number[] {
    return Array.from({ length: this.points }, (_, i) => this.place(i));
  }
}

function removeMsb(x: number): number {
  if (x <= 0) return 0;
  const msb = 1 << (31 - Math.clz32(x));
  return x & ~msb;
}

/**
 * The levels as the tessellator uses them for a spacing: clamped to its range (fractional odd 1 … 63, fractional even
 * 2 … 64, equal 1 … 64, rounded up to a whole number), and whether points are placed with odd parity.
 */
function levelOf(level: number, spacing: string, lower = Number.NaN): { level: number; odd: boolean } {
  if (Number.isNaN(level)) level = 1;
  switch (spacing) {
    case "fractional_odd":
      return { level: clamp(level, Number.isNaN(lower) ? 1 : lower, 63), odd: true };
    case "fractional_even":
      return { level: clamp(level, 2, 64), odd: false };
    default:
      level = Math.ceil(clamp(level, 1, 64) - 1e-9);
      return { level, odd: (toInt(level) & 1) === 1 };
  }
}

/** Adds a point and a triangle (counter-clockwise in (u, v), or clockwise for cw) to a mesh being built. */
function builder(cw: boolean): { points: [number, number][]; triangles: number[][]; add: (u: number, v: number) => number; tri: (a: number, b: number, c: number) => void } {
  const points: [number, number][] = [];
  const triangles: number[][] = [];
  return {
    points,
    triangles,
    add(u, v) {
      points.push([u, v]);
      return points.length - 1;
    },
    tri(a, b, c) {
      // Counter-clockwise in (u, v) (u to the right, v up), or clockwise for cw.
      const pa = points[a]!, pb = points[b]!, pc = points[c]!;
      const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1]);
      if (Math.abs(area) < 1e-14) return;
      if (area > 0 === cw) [b, c] = [c, b];
      triangles.push([a, b, c]);
    },
  };
}

/**
 * The fixed-function tessellator between the control (hull) and the evaluation (domain) shader: it cuts a patch's
 * domain into triangles by the tessellation levels and gives the (u, v) of each new vertex. Where the points go along an
 * edge follows Direct3D 11's reference tessellator, which Mesa (llvmpipe, lavapipe) and the Direct3D drivers use:
 * levels in 16.16 fixed point, fractional odd / even spacing with the two shorter segments placed symmetrically. The
 * inside of a quad is the grid of the inside levels' points; its outer ring is joined to the edges' points (that joining
 * is the simulator's own, close to but not exactly the drivers' pattern).
 */
export const Tessellator = {
  /** "fractional_odd_spacing" / HLSL "fractional_odd" → "fractional_odd"; equal spacing / "integer" / "pow2" → "equal". */
  spacing(spacing: string | null): string {
    if (spacing !== null && spacing.toLowerCase().includes("odd")) return "fractional_odd";
    if (spacing !== null && spacing.toLowerCase().includes("even")) return "fractional_even";
    return "equal";
  },

  /**
   * A quad patch: outer levels for the edges u = 0, v = 0, u = 1, v = 1 (GLSL gl_TessLevelOuter[0 … 3], HLSL
   * SV_TessFactor[0 … 3]), inner levels along u and along v. Null: the patch is culled (an outer level ≤ 0).
   */
  quad(outer: number[], inner: number[], spacing: string, cw: boolean): Mesh | null {
    if (outer.length < 4 || outer.slice(0, 4).some((o) => !(o > 0))) return null;
    const o = outer.slice(0, 4).map((x) => levelOf(x, spacing));
    const innerU = inner.length > 0 ? inner[0]! : 1, innerV = inner.length > 1 ? inner[1]! : innerU;
    // Fractional odd: when any level ends up above 1, the inside levels are at least a little above 1, so there is a
    // ring of inside points to join the edges to (D3D's "picture frame").
    let lower = Number.NaN;
    const epsilon = 1.0 / (1 << 16);
    if (spacing === "fractional_odd" && (o.some((x) => x.level > 1 + epsilon / 2) || innerU > 1 + epsilon / 2 || innerV > 1 + epsilon / 2)) lower = 1 + epsilon;
    const iu = levelOf(innerU, spacing, lower);
    const iv = levelOf(innerV, spacing, lower);
    const b = builder(cw);
    const { points, add, tri } = b;
    // Every level 1: the quad as two triangles.
    if (o.every((x) => x.level <= 1) && iu.level <= 1 && iv.level <= 1) {
      const c00 = add(0, 0), c10 = add(1, 0), c11 = add(1, 1), c01 = add(0, 1);
      tri(c00, c10, c01);
      tri(c10, c11, c01);
      return { points, triangles: b.triangles };
    }
    const pu = Edge.of(iu.level, iu.odd).all();
    const pv = Edge.of(iv.level, iv.odd).all();
    const nu = pu.length, nv = pv.length;
    // The inside: the grid of the inside levels' points without its outer ring.
    const grid: number[][] = Array.from({ length: nu }, () => new Array<number>(nv).fill(0));
    for (let i = 1; i < nu - 1; i++) for (let j = 1; j < nv - 1; j++) grid[i]![j] = add(pu[i]!, pv[j]!);
    const midU = (nu - 1) / 2.0, midV = (nv - 1) / 2.0;
    for (let i = 1; i < nu - 2; i++)
      for (let j = 1; j < nv - 2; j++) {
        const a = grid[i]![j]!, bb = grid[i + 1]![j]!, c = grid[i + 1]![j + 1]!, d = grid[i]![j + 1]!;
        // The diagonals mirror at the middle, so the pattern is the same in each quarter.
        const lowU = i + 0.5 < midU, lowV = j + 0.5 < midV;
        if (lowU === lowV) {
          tri(a, bb, c);
          tri(a, c, d);
        } else {
          tri(a, bb, d);
          tri(bb, c, d);
        }
      }
    // The edges' points (corners shared), and the inside ring's side next to each edge.
    const corner00 = add(0, 0), corner10 = add(1, 0), corner11 = add(1, 1), corner01 = add(0, 1);
    const edgePoints = (edge: number, from: number, to: number): number[] => {
      const e = Edge.of(o[edge]!.level, o[edge]!.odd);
      const list = [from];
      for (let k = 1; k < e.points - 1; k++) {
        const t = e.place(k);
        list.push(edge === 0 ? add(0, t) : edge === 1 ? add(t, 0) : edge === 2 ? add(1, t) : add(t, 1));
      }
      list.push(to);
      return list;
    };
    // Each side runs in increasing u or v; the ring side likewise.
    const bottom = edgePoints(1, corner00, corner10);
    const right = edgePoints(2, corner10, corner11);
    const top = edgePoints(3, corner01, corner11);
    const left = edgePoints(0, corner00, corner01);
    const hasRing = nu > 2 && nv > 2;
    if (!hasRing) {
      // No inside points (an inside level of 1 with even spacing): a fan from the centre.
      const centre = add(0.5, 0.5);
      for (const side of [bottom, right, top, left]) for (let k = 0; k + 1 < side.length; k++) tri(centre, side[k]!, side[k + 1]!);
      return { points, triangles: b.triangles };
    }
    const ringBottom = Array.from({ length: nu - 2 }, (_, i) => grid[i + 1]![1]!);
    const ringTop = Array.from({ length: nu - 2 }, (_, i) => grid[i + 1]![nv - 2]!);
    const ringLeft = Array.from({ length: nv - 2 }, (_, j) => grid[1]![j + 1]!);
    const ringRight = Array.from({ length: nv - 2 }, (_, j) => grid[nu - 2]![j + 1]!);
    // Joins an edge's points to the ring side beside it: walking both in order, the one whose next point comes first
    // along the side advances (each step one triangle).
    const stitch = (outerSide: number[], ringSide: number[], along: (p: number) => number): void => {
      let a = 0, bb = 0;
      while (a < outerSide.length - 1 || bb < ringSide.length - 1) {
        // Ties (the middle of a symmetric pattern) go to the edge in the first half and to the ring in the second, so
        // the two halves mirror each other.
        const outerMid = a < outerSide.length - 1 ? (along(outerSide[a]!) + along(outerSide[a + 1]!)) / 2 : Number.MAX_VALUE;
        const ringMid = bb < ringSide.length - 1 ? (along(ringSide[bb]!) + along(ringSide[bb + 1]!)) / 2 : Number.MAX_VALUE;
        const advanceOuter = Math.abs(outerMid - ringMid) < 1e-12 ? outerMid < 0.5 : outerMid < ringMid;
        if (advanceOuter) {
          tri(outerSide[a]!, outerSide[a + 1]!, ringSide[bb]!);
          a++;
        } else {
          tri(outerSide[a]!, ringSide[bb + 1]!, ringSide[bb]!);
          bb++;
        }
      }
    };
    stitch(bottom, ringBottom, (p) => points[p]![0]);
    stitch(top, ringTop, (p) => points[p]![0]);
    stitch(left, ringLeft, (p) => points[p]![1]);
    stitch(right, ringRight, (p) => points[p]![1]);
    return { points, triangles: b.triangles };
  },

  /**
   * A triangle patch: outer levels for the edges u = 0, v = 0, w = 0, one inner level. Rings of points from the edges
   * inwards, each ring's sides joined to the next ring's (the simulator's own joining).
   */
  triangle(outer: number[], inner: number[], spacing: string, cw: boolean): Mesh | null {
    if (outer.length < 3 || outer.slice(0, 3).some((o) => !(o > 0))) return null;
    const o = outer.slice(0, 3).map((x) => levelOf(x, spacing));
    const ii = levelOf(inner.length > 0 ? inner[0]! : 1, spacing, spacing === "fractional_odd" && o.some((x) => x.level > 1) ? 1 + 1.0 / (1 << 16) : Number.NaN);
    const b = builder(cw);
    const { points, add, tri } = b;
    // Barycentric (u, v, w = 1 - u - v); corners u = 1, v = 1, w = 1.
    const cu = add(1, 0);
    const cv = add(0, 1);
    const cw0 = add(0, 0);
    if (o.every((x) => x.level <= 1) && ii.level <= 1) {
      tri(cu, cv, cw0);
      return { points, triangles: b.triangles };
    }
    // Edge u = 0 runs from w (0,0) to v (0,1); v = 0 from u (1,0) to w; w = 0 from v to u.
    const side = (edge: number, from: number, to: number, at: (t: number) => [number, number]): number[] => {
      const e = Edge.of(o[edge]!.level, o[edge]!.odd);
      const list = [from];
      for (let k = 1; k < e.points - 1; k++) {
        const [u, v] = at(e.place(k));
        list.push(add(u, v));
      }
      list.push(to);
      return list;
    };
    const sides = [
      side(0, cw0, cv, (t) => [0, t]),
      side(1, cu, cw0, (t) => [1 - t, 0]),
      side(2, cv, cu, (t) => [t, 1 - t]),
    ];
    // The inside: rings of the inner level's points, each a smaller triangle.
    const inside = Edge.of(ii.level, ii.odd).all();
    const n = inside.length - 1;
    const rings = Math.trunc(n / 2);
    const ringsList: number[][][] = [];
    for (let r = 1; r <= rings; r++) {
      // Ring r: the triangle whose corners lie at depth r (barycentric coordinates from the inner points).
      const d = inside[r]!;
      const scale = 1 - 3 * d;
      if (scale <= 1e-9) {
        ringsList.push([[add(1.0 / 3, 1.0 / 3)], [], []]);
        break;
      }
      const segments = n - 2 * r;
      const bary = (a: number, bb: number, _c: number): [number, number] => [d + a * scale, d + bb * scale];
      const corners = [bary(0, 0, 1), bary(1, 0, 0), bary(0, 1, 0)];
      const rw = add(corners[0]![0], corners[0]![1]), ru = add(corners[1]![0], corners[1]![1]), rv = add(corners[2]![0], corners[2]![1]);
      const ringSide = (from: number, to: number, at: (t: number) => [number, number]): number[] => {
        const list = [from];
        for (let k = 1; k < segments; k++) {
          const t = (inside[r + k]! - inside[r]!) / Math.max(1e-12, inside[n - r]! - inside[r]!);
          const [u, v] = at(t);
          list.push(add(u, v));
        }
        list.push(to);
        return list;
      };
      ringsList.push([
        ringSide(rw, rv, (t) => bary(0, t, 1 - t)),
        ringSide(ru, rw, (t) => bary(1 - t, 0, t)),
        ringSide(rv, ru, (t) => bary(t, 1 - t, 0)),
      ]);
    }
    const pos = (s: number[], k: number): number => (s.length <= 1 ? 0.5 : dist(s[0]!, s[k]!) / Math.max(1e-12, dist(s[0]!, s[s.length - 1]!)));
    const dist = (a: number, bb: number): number => Math.sqrt(Math.pow(points[a]![0] - points[bb]![0], 2) + Math.pow(points[a]![1] - points[bb]![1], 2));
    const join = (outerSide: number[], innerSide: number[]): void => {
      // Both sides run the same way; positions compared by their share of the side's length.
      let a = 0, bb = 0;
      while (a < outerSide.length - 1 || bb < innerSide.length - 1) {
        const advanceOuter = bb >= innerSide.length - 1 || (a < outerSide.length - 1 && (pos(outerSide, a) + pos(outerSide, a + 1)) / 2 <= (pos(innerSide, bb) + pos(innerSide, bb + 1)) / 2);
        if (advanceOuter) {
          tri(outerSide[a]!, outerSide[a + 1]!, innerSide[bb]!);
          a++;
        } else {
          tri(outerSide[a]!, innerSide[bb + 1]!, innerSide[bb]!);
          bb++;
        }
      }
    };
    let outerRing = sides;
    for (const ring of ringsList) {
      if (ring[1]!.length === 0) {
        // The centre point.
        for (const s of outerRing) for (let k = 0; k + 1 < s.length; k++) tri(ring[0]![0]!, s[k]!, s[k + 1]!);
        outerRing = [];
        break;
      }
      for (let s = 0; s < 3; s++) join(outerRing[s]!, ring[s]!);
      outerRing = ring;
    }
    if (outerRing.length === 3 && outerRing[0]!.length > 0 && ringsList.length > 0 && ringsList[ringsList.length - 1]![1]!.length > 0) {
      // The innermost ring: a triangle (or a point already handled).
      const last = outerRing;
      if (last[0]!.length === 2 && last[1]!.length === 2 && last[2]!.length === 2) tri(last[0]![0]!, last[1]![0]!, last[2]![0]!);
      else {
        const centre = add(1.0 / 3, 1.0 / 3);
        for (const s of last) for (let k = 0; k + 1 < s.length; k++) tri(centre, s[k]!, s[k + 1]!);
      }
    } else if (ringsList.length === 0) {
      const centre = add(1.0 / 3, 1.0 / 3);
      for (const s of sides) for (let k = 0; k + 1 < s.length; k++) tri(centre, s[k]!, s[k + 1]!);
    }
    return { points, triangles: b.triangles };
  },
};
