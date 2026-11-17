// Compute shaders: a dispatch of work groups, each of local_size_x × y × z invocations ([numthreads(x, y, z)]); the
// shaders write storage images (imageStore, RWTexture2D[xy] = …). C# runs the rows of work groups on every core; here
// they run one after another, in the same order of rows.
import { clamp, tryParseInt } from "../internal/dotnet.js";
import type * as A from "../Shading/ShaderAst.js";
import { ShaderRuntimeException } from "../Shading/ShaderErrors.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import { ShaderRunner } from "../Shading/ShaderRunner.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import type { Image } from "../Textures/Image.js";
import { setUniform } from "./Stages.js";
import type { StorageImage } from "./StorageImage.js";

/**
 * Runs a compute shader over `groups` work groups with the uniforms (by name, as for draws), the storage images by the
 * shader's names for them, and the textures it samples. Returns the errors it ran into.
 */
export function dispatch(program: ShaderProgram, entry: string, hlsl: boolean, uniforms: Map<string, ShaderValue>,
  images: ReadonlyMap<string, StorageImage>, groups: [number, number, number], time: number,
  textures: ((name: string, u: number, v: number) => number[]) | null = null, textureImages: ((name: string) => Image | null) | null = null): string[] {
  const errors: string[] = [];
  const size = program.localSize.slice();
  let hlslEntry: A.Function | null = null;
  if (hlsl) {
    hlslEntry = program.findFunction(entry);
    if (hlslEntry === null) {
      errors.push(`the compute shader has no function '${entry}'`);
      return errors;
    }
    const threads = program.attribute(entry, "numthreads");
    if (threads !== null && threads.length >= 1)
      for (let k = 0; k < 3; k++) {
        const n = k < threads.length ? tryParseInt(threads[k]!) : null;
        size[k] = n !== null ? Math.max(1, n) : 1;
      }
  } else if (program.findFunction("main") === null) {
    errors.push("the compute shader has no main()");
    return errors;
  }
  const gx = clamp(groups[0], 0, 65535), gy = clamp(groups[1], 0, 65535), gz = clamp(groups[2], 0, 65535);
  if (gx * gy * gz === 0) return errors;
  // Writes out of the image are dropped, reads out of it are 0 (robust access, as the drivers do).
  const load = (name: string, x: number, y: number): number[] | null => {
    const img = images.get(name);
    if (img === undefined || x < 0 || y < 0 || x >= img.width || y >= img.height) return null;
    const i = (y * img.width + x) * 4;
    return img.data.slice(i, i + 4);
  };
  const store = (name: string, x: number, y: number, value: number[]): void => {
    const img = images.get(name);
    if (img === undefined || x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    if (value.length < 4) throw new RangeError("Specified argument was out of the range of valid values.");
    const i = (y * img.width + x) * 4;
    for (let k = 0; k < 4; k++) img.data[i + k] = value[k]!;
  };
  const imageSize = (name: string): [number, number] | null => {
    const img = images.get(name);
    return img !== undefined ? [img.width, img.height] : null;
  };
  const numGroups = ShaderValue.vec(gx, gy, gz);
  const groupSize = ShaderValue.vec(size[0]!, size[1]!, size[2]!);
  // One runner per worker in C# (made once per thread); one for the whole dispatch here.
  let runner: ShaderRunner | null = null;
  const makeRunner = (): ShaderRunner => {
    const r = new ShaderRunner(program, { time, imageLoad: load, imageStore: store, imageSize, sample: textures, textureImage: textureImages });
    for (const [k, v] of uniforms) setUniform(r, k, v);
    return r;
  };
  // One task per row of work groups (y, z); every invocation of a group in order.
  for (let row = 0; row < gy * gz; row++) {
    runner ??= makeRunner();
    const wy = row % gy, wz = Math.trunc(row / gy);
    try {
      for (let wx = 0; wx < gx; wx++)
        for (let lz = 0; lz < size[2]!; lz++)
          for (let ly = 0; ly < size[1]!; ly++)
            for (let lx = 0; lx < size[0]!; lx++) {
              const global = ShaderValue.vec(wx * size[0]! + lx, wy * size[1]! + ly, wz * size[2]! + lz);
              const local = ShaderValue.vec(lx, ly, lz);
              const group = ShaderValue.vec(wx, wy, wz);
              const index = (lz * size[1]! + ly) * size[0]! + lx;
              if (hlsl) {
                const r = runner;
                const args = hlslEntry!.params.map((p) => {
                  switch ((p.semantic ?? "").toUpperCase()) {
                    case "SV_DISPATCHTHREADID": return global;
                    case "SV_GROUPTHREADID": return local;
                    case "SV_GROUPID": return group;
                    case "SV_GROUPINDEX": return ShaderValue.integer(index);
                    default: return r.default(p.type);
                  }
                });
                runner.call(hlslEntry!.id, args);
              } else {
                runner.globals.set("gl_GlobalInvocationID", global);
                runner.globals.set("gl_LocalInvocationID", local);
                runner.globals.set("gl_WorkGroupID", group);
                runner.globals.set("gl_NumWorkGroups", numGroups);
                runner.globals.set("gl_WorkGroupSize", groupSize);
                runner.globals.set("gl_LocalInvocationIndex", ShaderValue.integer(index));
                runner.call("main", []);
              }
            }
    } catch (e) {
      if (!(e instanceof ShaderRuntimeException)) throw e;
      if (errors.length < 5) errors.push(e.line > 0 ? `line ${e.line}: ${e.message}` : e.message);
    }
  }
  return errors;
}
