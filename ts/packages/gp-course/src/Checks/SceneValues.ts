import type { DrawCall, ShaderValue } from "@codestead/gp-gpu";
import type { CheckContext } from "../CheckContext.js";

// What the draws of a frame hand their shaders, for checks that look at the scene rather than at pixels: a uniform by
// name, a draw's model matrix (where an object is, how big it is), the camera of the view matrix. Every API's reader
// names a draw's uniforms by the shader's names ("model", "pointLights[0].diffuse"; a member of a Vulkan uniform block
// or a D3D12 constant buffer struct by its field). Matrices come back in GLSL's layout whatever the API.

/** A 4×4 matrix in GLSL's layout: 16 numbers, column by column (12, 13 and 14 are the translation). */
export type Mat4 = readonly number[];

/** Three numbers: a position, a direction or a colour. */
export type Vec3 = readonly [number, number, number];

/** A path's parts: "pointLights[1].diffuse" → "pointLights", 1, "diffuse". */
function parts(path: string): (string | number)[] {
  const list: (string | number)[] = [];
  for (const part of path.split(".")) {
    const m = /^(\w+)((?:\[\d+\])*)$/.exec(part);
    if (m === null) return [];
    list.push(m[1]!);
    for (const i of m[2]!.matchAll(/\[(\d+)\]/g)) list.push(Number(i[1]));
  }
  return list;
}

/** The first entry of a draw's uniforms whose name is the path, or ends with "." and the path ("ubo.view"). */
function named(uniforms: Map<string, ShaderValue>, path: string): ShaderValue | null {
  const exact = uniforms.get(path);
  if (exact !== undefined) return exact;
  for (const [k, v] of uniforms) if (k.endsWith("." + path)) return v;
  return null;
}

/**
 * A uniform a draw hands its shaders at a time, by the shader's name: "model", "spotLight.position",
 * "pointLights[0].diffuse" – a whole name as the reader lists it, or a struct, array element and field step by step.
 * Null when the draw has no such value.
 */
export function uniformOf(draw: DrawCall, time: number, path: string): ShaderValue | null {
  const uniforms = draw.uniforms(time);
  const whole = named(uniforms, path);
  if (whole !== null) return whole;
  const steps = parts(path);
  for (let n = steps.length - 1; n >= 1; n--) {
    // The longest leading part the reader lists as one name, then fields and elements.
    const head = steps.slice(0, n).reduce<string>((s, p) => (typeof p === "number" ? `${s}[${p}]` : s === "" ? p : `${s}.${p}`), "");
    let value = named(uniforms, head);
    for (const step of steps.slice(n)) {
      if (value === null) break;
      value = typeof step === "number" ? (value.items?.[step] ?? null) : (value.fields?.get(step) ?? null);
    }
    if (value !== null) return value;
  }
  return null;
}

/** A uniform's three numbers (a vec3, or the first three of a vec4); null when it is not there. */
export function vec3Of(draw: DrawCall, time: number, path: string): Vec3 | null {
  const v = uniformOf(draw, time, path)?.v;
  return v !== null && v !== undefined && v.length >= 3 ? [v[0]!, v[1]!, v[2]!] : null;
}

/** A uniform's number (a float); null when it is not there. */
export function floatOf(draw: DrawCall, time: number, path: string): number | null {
  const v = uniformOf(draw, time, path)?.v;
  return v !== null && v !== undefined && v.length === 1 ? v[0]! : null;
}

/**
 * A 4×4 matrix a draw hands its shaders, in GLSL's layout. HLSL's are stored as the program wrote them for mul(v, M)
 * (D3D12: XMMatrixTranspose of DirectXMath's row-vector matrix), so they are transposed back.
 */
export function matrixOf(draw: DrawCall, time: number, name: string): Mat4 | null {
  const value = uniformOf(draw, time, name);
  const v = value?.v;
  if (value === null || v === null || v === undefined || value.cols !== 4 || v.length !== 16) return null;
  return draw.hlsl ? [0, 1, 2, 3].flatMap((col) => [0, 1, 2, 3].map((row) => v[col + 4 * row]!)) : v;
}

/** Where a model matrix puts the object's centre (its local origin) in the world. */
export function positionOf(m: Mat4): Vec3 {
  return [m[12]!, m[13]!, m[14]!];
}

/** How much a model matrix scales the object: the cube root of the volume factor (1 for a turned but unscaled one). */
export function scaleOf(m: Mat4): number {
  const det =
    m[0]! * (m[5]! * m[10]! - m[9]! * m[6]!) - m[4]! * (m[1]! * m[10]! - m[9]! * m[2]!) + m[8]! * (m[1]! * m[6]! - m[5]! * m[2]!);
  return Math.cbrt(Math.abs(det));
}

/** The largest difference between two matrices' turning and scaling parts (the upper-left 3×3). */
export function turnDifference(a: Mat4, b: Mat4): number {
  let d = 0;
  for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) d = Math.max(d, Math.abs(a[i]! - b[i]!));
  return d;
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function minus(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** The camera of a view matrix: its position in the world, and where the world's origin is in its view (x right, y up, -z ahead). */
export function cameraOf(view: Mat4): { position: Vec3; origin: Vec3 } {
  const t: Vec3 = [view[12]!, view[13]!, view[14]!];
  // The view matrix is [R | t] with a rotation R: the camera sits at -Rᵀt (row i of Rᵀ is column i of R).
  const p = (i: number): number => -(view[4 * i]! * t[0] + view[4 * i + 1]! * t[1] + view[4 * i + 2]! * t[2]);
  return { position: [p(0), p(1), p(2)], origin: t };
}

/**
 * The vec3/vec4 values some draws hand their shaders besides matrices, by name (a block member's last part: "color",
 * "lightColor"), one entry per draw (null where a draw has none of that name): a colour per object, whatever the
 * learner calls it.
 */
export function vectorsByName(draws: readonly DrawCall[], time = 1.0): Map<string, (Vec3 | null)[]> {
  const byName = new Map<string, (Vec3 | null)[]>();
  draws.forEach((d, i) => {
    for (const [key, value] of d.uniforms(time)) {
      const v = value.v;
      if (value.cols !== 0 || v === null || (v.length !== 3 && v.length !== 4)) continue;
      const name = key.slice(key.lastIndexOf(".") + 1);
      const list = byName.get(name) ?? draws.map(() => null);
      list[i] = [v[0]!, v[1]!, v[2]!];
      byName.set(name, list);
    }
  });
  return byName;
}

/** An object the frame draws at a time: its draw call's index and model matrix. */
export interface Placed {
  index: number;
  model: Mat4;
  position: Vec3;
  scale: number;
}

/** The objects the frame draws into the window at a time (draws with a "model" matrix), in draw order. */
export function placedAt(c: CheckContext, time: number): Placed[] {
  const scene = c.sceneAt(time);
  if (!c.shows || scene === null) return [];
  const list: Placed[] = [];
  scene.draws.forEach((d, index) => {
    if (d.target !== null) return;
    const model = matrixOf(d, time, "model");
    if (model !== null) list.push({ index, model, position: positionOf(model), scale: scaleOf(model) });
  });
  return list;
}
