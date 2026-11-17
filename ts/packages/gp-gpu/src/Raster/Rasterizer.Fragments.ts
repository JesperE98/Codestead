// Rasterising triangles, lines and points into fragments, and the per-sample operations after the fragment shader:
// the stencil test, the depth test, blending and the write into the framebuffer – in the order OpenGL, Vulkan and
// Direct3D define them.
import { clamp, toInt } from "../internal/dotnet.js";
import { BlendFactor } from "../Scene/BlendFactor.js";
import { BlendOp } from "../Scene/BlendOp.js";
import type { BlendState } from "../Scene/BlendState.js";
import { CompareFunc } from "../Scene/CompareFunc.js";
import { CullMode } from "../Scene/CullMode.js";
import type { DrawCall } from "../Scene/DrawCall.js";
import { StencilOp } from "../Scene/StencilOp.js";
import type { StencilState } from "../Scene/StencilState.js";
import type { Framebuffer } from "./Framebuffer.js";
import type { ShadedVertex } from "./ShadedVertex.js";
import type { Derivatives, Stages } from "./Stages.js";

/**
 * Shades the fragments of a set-up primitive in the rows `from` up to (not including) `to` of its framebuffer, with
 * `stages` (those of the thread that runs it in C#; the draw's own here).
 */
export type Fill = (stages: Stages, from: number, to: number) => void;

/** A set-up primitive (null: culled or off screen) and the size of its bounding box in pixels. */
export interface SetUp {
  readonly fill: Fill | null;
  readonly pixels: number;
}

/** Distance to the near plane in clip space (OpenGL: z ≥ -w, Vulkan and Direct3D: z ≥ 0). */
export function nearDistance(v: ShadedVertex, zMinusOneToOne: boolean): number {
  return zMinusOneToOne ? v.clip[2]! + v.clip[3]! : v.clip[2]!;
}

function toScreen(vs: ShadedVertex[], fb: Framebuffer, yDown: boolean, zMinusOneToOne: boolean): { sx: number[]; sy: number[]; sz: number[]; invW: number[] } {
  const n = vs.length;
  const sx = new Array<number>(n), sy = new Array<number>(n), sz = new Array<number>(n), invW = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const c = vs[i]!.clip;
    const nx = c[0]! / c[3]!, ny = c[1]! / c[3]!, nz = c[2]! / c[3]!;
    sx[i] = ((nx + 1) / 2) * fb.width;
    sy[i] = yDown ? ((1 + ny) / 2) * fb.height : ((1 - ny) / 2) * fb.height;
    sz[i] = zMinusOneToOne ? (nz + 1) / 2 : nz;
    invW[i] = 1 / c[3]!;
  }
  return { sx, sy, sz, invW };
}

/** Sets up a triangle (null: culled or off screen) and the size of its bounding box in pixels. */
export function triangle(v0: ShadedVertex, v1: ShadedVertex, v2: ShadedVertex, draw: DrawCall, fb: Framebuffer, yDown: boolean, zMinusOneToOne: boolean): SetUp {
  const vs = [v0, v1, v2];
  if (vs.some((v) => v.clip[3]! <= 1e-9)) return { fill: null, pixels: 0 };
  const { sx, sy, sz, invW } = toScreen(vs, fb, yDown, zMinusOneToOne);
  // Signed area on screen (y down): negative means counter-clockwise as you look at the screen.
  const area = (sx[1]! - sx[0]!) * (sy[2]! - sy[0]!) - (sx[2]! - sx[0]!) * (sy[1]! - sy[0]!);
  if (Math.abs(area) < 1e-12) return { fill: null, pixels: 0 };
  const ccw = area < 0;
  const front = draw.frontCcw ? ccw : !ccw;
  if (draw.cull === CullMode.FrontAndBack || (draw.cull === CullMode.Back && !front) || (draw.cull === CullMode.Front && front)) return { fill: null, pixels: 0 };
  if (draw.wireframe) {
    // Wireframe (glPolygonMode GL_LINE, VK_POLYGON_MODE_LINE, D3D12_FILL_MODE_WIREFRAME): the triangle's three edges as
    // lines one pixel wide, after the facing test.
    const edges = [line(v0, v1, draw, fb, yDown, zMinusOneToOne), line(v1, v2, draw, fb, yDown, zMinusOneToOne), line(v2, v0, draw, fb, yDown, zMinusOneToOne)];
    return {
      fill: (stages, from, to) => {
        for (const edge of edges) edge.fill?.(stages, from, to);
      },
      pixels: edges[0]!.pixels + edges[1]!.pixels + edges[2]!.pixels,
    };
  }

  const width = fb.width, height = fb.height;
  const minX = Math.max(0, toInt(Math.floor(linqMin(sx)))), maxX = Math.min(width - 1, toInt(Math.ceil(linqMax(sx))));
  const minY = Math.max(0, toInt(Math.floor(linqMin(sy)))), maxY = Math.min(height - 1, toInt(Math.ceil(linqMax(sy))));
  if (minX > maxX || minY > maxY) return { fill: null, pixels: 0 };
  const pixels = (maxX - minX + 1) * (maxY - minY + 1);
  const weights = (x: number, y: number): [number, number, number] => {
    const w0 = ((sx[2]! - sx[1]!) * (y - sy[1]!) - (sy[2]! - sy[1]!) * (x - sx[1]!)) / area;
    const w1 = ((sx[0]! - sx[2]!) * (y - sy[2]!) - (sy[0]! - sy[2]!) * (x - sx[2]!)) / area;
    return [w0, w1, 1 - w0 - w1];
  };
  // The top-left rule: a sample exactly on an edge belongs to the triangle only when that edge is a top edge
  // (horizontal, the triangle below it) or a left edge (the triangle to its right) – so the shared diagonal of a quad's
  // two triangles is drawn once, not twice (which additive blending would show).
  const ownsEdge = (i: number): boolean => {
    const a = (i + 1) % 3, b = (i + 2) % 3;
    if (Math.abs(sy[a]! - sy[b]!) < 1e-12) return sy[i]! > sy[a]!;
    const edgeX = sx[a]! + ((sy[i]! - sy[a]!) * (sx[b]! - sx[a]!)) / (sy[b]! - sy[a]!);
    return sx[i]! > edgeX;
  };
  const own0 = ownsEdge(0), own1 = ownsEdge(1), own2 = ownsEdge(2);
  const onEdge = 1e-9;
  const covers = (w0: number, w1: number, w2: number): boolean =>
    (w0 > onEdge || (w0 >= -onEdge && own0)) && (w1 > onEdge || (w1 >= -onEdge && own1)) && (w2 > onEdge || (w2 >= -onEdge && own2));
  return {
    fill: (stages, from, to) => {
      if (from > maxY || to <= minY) return;
      const zs = new Array<number>(fb.samples).fill(0);
      for (let py = Math.max(minY, from); py <= maxY && py < to; py++) {
        for (let px = minX; px <= maxX; px++) {
          let mask = 0;
          for (let s = 0; s < fb.samples; s++) {
            const [w0, w1, w2] = weights(px + fb.pattern[s]![0], py + fb.pattern[s]![1]);
            if (!covers(w0, w1, w2)) continue;
            mask |= 1 << s;
            zs[s] = w0 * sz[0]! + w1 * sz[1]! + w2 * sz[2]!;
          }
          if (mask === 0) continue;
          const x = px + 0.5, y = py + 0.5;
          const [c0, c1, c2] = weights(x, y);
          const z = c0 * sz[0]! + c1 * sz[1]! + c2 * sz[2]!;
          // Perspective-correct weights.
          let p0 = c0 * invW[0]!, p1 = c1 * invW[1]!, p2 = c2 * invW[2]!;
          const sum = p0 + p1 + p2;
          p0 /= sum;
          p1 /= sum;
          p2 /= sum;
          // The weights one pixel to the right and one down: how the varyings change across pixels (a GPU's
          // derivatives, for the mip level of a texture read).
          const [rx0, rx1, rx2] = perspective(weights(x + 1, y), invW);
          const [ry0, ry1, ry2] = perspective(weights(x, y + 1), invW);
          const derivatives: Derivatives = [rx0 - p0, rx1 - p1, rx2 - p2, ry0 - p0, ry1 - p1, ry2 - p2];
          writeFragment(fb, py * width + px, mask, zs, draw, stages, () => stages.fragment(vs, p0, p1, p2, x, y, z, sum, front, derivatives));
        }
      }
    },
    pixels,
  };
}

/** Enumerable.Min over doubles: a NaN anywhere is the result. */
function linqMin(values: number[]): number {
  let value = values[0]!;
  for (let i = 1; i < values.length; i++) {
    const x = values[i]!;
    if (x < value) value = x;
    else if (Number.isNaN(x)) return x;
  }
  return value;
}

/** Enumerable.Max over doubles: NaN counts as smaller than every number. */
function linqMax(values: number[]): number {
  let value = values[0]!;
  for (let i = 1; i < values.length; i++) {
    const x = values[i]!;
    if (x > value || Number.isNaN(value)) value = x;
  }
  return value;
}

function perspective(c: [number, number, number], invW: number[]): [number, number, number] {
  const p0 = c[0] * invW[0]!, p1 = c[1] * invW[1]!, p2 = c[2] * invW[2]!, sum = p0 + p1 + p2;
  return sum === 0 ? [0, 0, 0] : [p0 / sum, p1 / sum, p2 / sum];
}

/**
 * Sets up a line one pixel wide (glLineWidth beyond 1 is not part of the core profile) and the number of steps along
 * it.
 */
export function line(a: ShadedVertex, b: ShadedVertex, draw: DrawCall, fb: Framebuffer, yDown: boolean, zMinusOneToOne: boolean): SetUp {
  const vs = [a, b, b];
  if (a.clip[3]! <= 1e-9 || b.clip[3]! <= 1e-9) return { fill: null, pixels: 0 };
  const { sx, sy, sz, invW } = toScreen([a, b], fb, yDown, zMinusOneToOne);
  const dx = sx[1]! - sx[0]!, dy = sy[1]! - sy[0]!;
  const steps = Math.max(1, toInt(Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))));
  const full = (1 << fb.samples) - 1;
  return {
    fill: (stages, from, to) => {
      const zs = new Array<number>(fb.samples).fill(0);
      let last = -1;
      // The whole line is walked; the pixels in the rows asked for are shaded.
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const x = sx[0]! + dx * t, y = sy[0]! + dy * t;
        const px = toInt(Math.floor(x)), py = toInt(Math.floor(y));
        if (px < 0 || py < 0 || px >= fb.width || py >= fb.height) continue;
        const index = py * fb.width + px;
        if (index === last) continue;
        last = index;
        if (py < from || py >= to) continue;
        const z = sz[0]! + (sz[1]! - sz[0]!) * t;
        zs.fill(z);
        const q0 = (1 - t) * invW[0]!, q1 = t * invW[1]!, sum = q0 + q1;
        const p0 = q0 / sum, p1 = q1 / sum;
        writeFragment(fb, index, full, zs, draw, stages, () => stages.fragment(vs, p0, p1, 0, px + 0.5, py + 0.5, z, sum, true));
      }
    },
    pixels: steps,
  };
}

/**
 * Sets up a point: a square of gl_PointSize (or glPointSize) pixels around the vertex (null: clipped or off screen), and
 * the size of the square in pixels.
 */
export function point(v: ShadedVertex, draw: DrawCall, fb: Framebuffer, scale: number, yDown: boolean, zMinusOneToOne: boolean): SetUp {
  if (v.clip[3]! <= 1e-9 || nearDistance(v, zMinusOneToOne) < 0) return { fill: null, pixels: 0 };
  const { sx, sy, sz, invW } = toScreen([v], fb, yDown, zMinusOneToOne);
  let size = (draw.programPointSize && v.pointSize !== null ? v.pointSize : draw.pointSize) / scale;
  size = Math.max(size, 1 / scale);
  const half = size / 2;
  const vs = [v, v, v];
  const minX = Math.max(0, toInt(Math.floor(sx[0]! - half))), maxX = Math.min(fb.width - 1, toInt(Math.ceil(sx[0]! + half)));
  const minY = Math.max(0, toInt(Math.floor(sy[0]! - half))), maxY = Math.min(fb.height - 1, toInt(Math.ceil(sy[0]! + half)));
  if (minX > maxX || minY > maxY) return { fill: null, pixels: 0 };
  return {
    fill: (stages, from, to) => {
      if (from > maxY || to <= minY) return;
      const zs = new Array<number>(fb.samples).fill(sz[0]!);
      for (let py = Math.max(minY, from); py <= maxY && py < to; py++)
        for (let px = minX; px <= maxX; px++) {
          let mask = 0;
          for (let s = 0; s < fb.samples; s++) {
            const x = px + fb.pattern[s]![0], y = py + fb.pattern[s]![1];
            if (x >= sx[0]! - half && x < sx[0]! + half && y >= sy[0]! - half && y < sy[0]! + half) mask |= 1 << s;
          }
          if (mask === 0) continue;
          const cx = px, cy = py;
          writeFragment(fb, py * fb.width + px, mask, zs, draw, stages, () => stages.fragment(vs, 1, 0, 0, cx + 0.5, cy + 0.5, sz[0]!, invW[0]!, true));
        }
    },
    pixels: (maxX - minX + 1) * (maxY - minY + 1),
  };
}

/**
 * The per-sample operations for a fragment covering the samples in `mask`: depth clipping, the stencil test, the depth
 * test, the stencil update, the depth write, blending and the colour write. The fragment shader runs once (`shade`;
 * null = discarded) – and not at all when every sample fails a test that changes nothing.
 */
function writeFragment(fb: Framebuffer, pixel: number, mask: number, zs: number[], draw: DrawCall, stages: Stages, shade: () => (number[] | null)[] | null): void {
  // A fragment shader that writes its depth (gl_FragDepth, SV_Depth): it runs first, its depth is tested.
  if (stages.writesDepth) {
    if (mask === 0) return;
    const shaded = shade();
    const written = stages.fragDepth;
    if (shaded === null || written === null) return;
    zs = new Array<number>(zs.length).fill(written);
    shade = () => shaded;
  }
  const samples = fb.samples;
  for (let s = 0; s < samples; s++) if ((mask & (1 << s)) !== 0 && (zs[s]! < -1e-7 || zs[s]! > 1 + 1e-7)) mask &= ~(1 << s);
  if (mask === 0) return;
  const stencil = draw.stencil;
  const passes = (idx: number, s: number): boolean =>
    (stencil === null || stencilPasses(stencil, fb.stencil[idx]!)) && (!draw.depthTest || !fb.hasDepth || compare(draw.depthFunc, zs[s]!, fb.depth[idx]!));
  const sideEffectsOnFail = stencil !== null && (stencil.stencilFail !== StencilOp.Keep || stencil.depthFail !== StencilOp.Keep);
  if (!sideEffectsOnFail) {
    let any = false;
    for (let s = 0; s < samples && !any; s++) if ((mask & (1 << s)) !== 0 && passes(pixel * samples + s, s)) any = true;
    if (!any) return;
  }
  const colors = shade();
  if (colors === null) return;
  for (let s = 0; s < samples; s++) {
    if ((mask & (1 << s)) === 0) continue;
    const idx = pixel * samples + s;
    if (stencil !== null && !stencilPasses(stencil, fb.stencil[idx]!)) {
      updateStencil(fb, idx, stencil, stencil.stencilFail);
      continue;
    }
    if (draw.depthTest && fb.hasDepth && !compare(draw.depthFunc, zs[s]!, fb.depth[idx]!)) {
      if (stencil !== null) updateStencil(fb, idx, stencil, stencil.depthFail);
      continue;
    }
    if (stencil !== null) updateStencil(fb, idx, stencil, stencil.pass);
    if (draw.depthTest && draw.depthWrite && fb.hasDepth) fb.depth[idx] = clamp(zs[s]!, 0, 1);
    for (let a = 0; a < fb.colors.length && a < colors.length; a++) {
      const color = colors[a];
      if (color !== null && color !== undefined) {
        const blends = draw.attachmentBlends;
        writeColor(fb, fb.colors[a]!, idx * 4, color, draw, blends !== null && a < blends.length ? blends[a]! : draw.blend);
      }
    }
  }
}

function compare(func: CompareFunc, value: number, stored: number): boolean {
  switch (func) {
    case CompareFunc.Never: return false;
    case CompareFunc.Less: return value < stored;
    case CompareFunc.Equal: return Math.abs(value - stored) < 1e-9;
    case CompareFunc.LessEqual: return value <= stored + 1e-9;
    case CompareFunc.Greater: return value > stored;
    case CompareFunc.NotEqual: return Math.abs(value - stored) >= 1e-9;
    case CompareFunc.GreaterEqual: return value >= stored - 1e-9;
    default: return true;
  }
}

function stencilPasses(st: StencilState, stored: number): boolean {
  const r = st.ref & st.readMask, v = stored & st.readMask;
  switch (st.func) {
    case CompareFunc.Never: return false;
    case CompareFunc.Less: return r < v;
    case CompareFunc.Equal: return r === v;
    case CompareFunc.LessEqual: return r <= v;
    case CompareFunc.Greater: return r > v;
    case CompareFunc.NotEqual: return r !== v;
    case CompareFunc.GreaterEqual: return r >= v;
    default: return true;
  }
}

function updateStencil(fb: Framebuffer, idx: number, st: StencilState, op: StencilOp): void {
  const old = fb.stencil[idx]!;
  let value: number;
  switch (op) {
    case StencilOp.Zero: value = 0; break;
    case StencilOp.Replace: value = st.ref; break;
    case StencilOp.Increment: value = Math.min(255, old + 1); break;
    case StencilOp.IncrementWrap: value = (old + 1) & 0xff; break;
    case StencilOp.Decrement: value = Math.max(0, old - 1); break;
    case StencilOp.DecrementWrap: value = (old - 1) & 0xff; break;
    case StencilOp.Invert: value = ~old & 0xff; break;
    default: value = old; break;
  }
  fb.stencil[idx] = ((old & ~st.writeMask) | (value & st.writeMask)) & 0xff;
}

function writeColor(fb: Framebuffer, buffer: Float64Array, o: number, src: number[], draw: DrawCall, blend: BlendState | null): void {
  // A vec3 output leaves alpha at 1.
  const s = [src.length > 0 ? src[0]! : 0, src.length > 1 ? src[1]! : 0, src.length > 2 ? src[2]! : 0, src.length > 3 ? src[3]! : 1];
  if (!fb.float) for (let k = 0; k < 4; k++) s[k] = clamp(Number.isNaN(s[k]!) ? 0 : s[k]!, 0, 1);
  let result = s;
  if (blend !== null) {
    const d = [buffer[o]!, buffer[o + 1]!, buffer[o + 2]!, buffer[o + 3]!];
    const constant = blend.constant ?? [0, 0, 0, 0];
    result = new Array<number>(4);
    for (let k = 0; k < 4; k++) {
      const alpha = k === 3;
      const fs = factor(alpha ? blend.srcAlpha : blend.srcColor, k, s, d, constant);
      const fd = factor(alpha ? blend.dstAlpha : blend.dstColor, k, s, d, constant);
      switch (alpha ? blend.alphaOp : blend.colorOp) {
        case BlendOp.Subtract: result[k] = s[k]! * fs - d[k]! * fd; break;
        case BlendOp.ReverseSubtract: result[k] = d[k]! * fd - s[k]! * fs; break;
        case BlendOp.Min: result[k] = Math.min(s[k]!, d[k]!); break;
        case BlendOp.Max: result[k] = Math.max(s[k]!, d[k]!); break;
        default: result[k] = s[k]! * fs + d[k]! * fd; break;
      }
    }
  }
  for (let k = 0; k < 4; k++)
    if (k >= draw.colorMask.length || draw.colorMask[k]) buffer[o + k] = fb.float ? result[k]! : clamp(Number.isNaN(result[k]!) ? 0 : result[k]!, 0, 1);
}

function factor(f: BlendFactor, k: number, s: number[], d: number[], c: number[]): number {
  switch (f) {
    case BlendFactor.Zero: return 0;
    case BlendFactor.One: return 1;
    case BlendFactor.SrcColor: return s[k]!;
    case BlendFactor.OneMinusSrcColor: return 1 - s[k]!;
    case BlendFactor.DstColor: return d[k]!;
    case BlendFactor.OneMinusDstColor: return 1 - d[k]!;
    case BlendFactor.SrcAlpha: return s[3]!;
    case BlendFactor.OneMinusSrcAlpha: return 1 - s[3]!;
    case BlendFactor.DstAlpha: return d[3]!;
    case BlendFactor.OneMinusDstAlpha: return 1 - d[3]!;
    case BlendFactor.ConstantColor: return c[k]!;
    case BlendFactor.OneMinusConstantColor: return 1 - c[k]!;
    case BlendFactor.ConstantAlpha: return c[3]!;
    case BlendFactor.OneMinusConstantAlpha: return 1 - c[3]!;
    default: return 1;
  }
}
