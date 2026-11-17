import { clamp, toInt } from "../internal/dotnet.js";
import type { Texture } from "./Texture.js";

/**
 * A cube map: six faces in the order +X, -X, +Y, -Y, +Z, -Z (GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, Vulkan array layers
 * 0–5, D3D12 array slices 0–5). A direction picks the face of its largest component and a point on it, as the OpenGL
 * specification's cube map table says (Vulkan and Direct3D use the same rule), so faces loaded top row first appear
 * the right way up.
 */
export class CubeTexture {
  /**
   * The smaller mip levels, level 1 first (each six faces): rendered one by one (a pre-filtered environment map) or made
   * from level 0 (glGenerateMipmap). Null or empty: the cube map has only level 0.
   */
  readonly mips: readonly (readonly (Texture | null)[])[] | null;

  constructor(readonly faces: readonly (Texture | null)[], init?: { mips?: readonly (readonly (Texture | null)[])[] | null }) {
    this.mips = init?.mips ?? null;
  }

  /**
   * The cube map in a direction; with `lod` at a mip level (textureLod, SampleLevel): the two nearest levels blended
   * (trilinear filtering), the level kept inside the levels there are.
   */
  sample(x: number, y: number, z: number, lod?: number): number[] {
    if (lod === undefined) return sampleFaces(x, y, z, this.faces);
    const levels = 1 + (this.mips?.length ?? 0);
    lod = Number.isNaN(lod) ? 0 : clamp(lod, 0, levels - 1);
    const lower = toInt(Math.floor(lod));
    const t = lod - lower;
    const a = sampleFaces(x, y, z, lower === 0 ? this.faces : this.mips![lower - 1]!);
    if (t <= 0 || lower + 1 >= levels) return a;
    const b = sampleFaces(x, y, z, this.mips![lower]!);
    const r = new Array<number>(4);
    for (let k = 0; k < 4; k++) r[k] = a[k]! + (b[k]! - a[k]!) * t;
    return r;
  }
}

function sampleFaces(x: number, y: number, z: number, faces: readonly (Texture | null)[]): number[] {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let face: number;
  let sc: number, tc: number, ma: number;
  if (ax >= ay && ax >= az) {
    face = x >= 0 ? 0 : 1;
    sc = x >= 0 ? -z : z;
    tc = -y;
    ma = ax;
  } else if (ay >= az) {
    face = y >= 0 ? 2 : 3;
    sc = x;
    tc = y >= 0 ? z : -z;
    ma = ay;
  } else {
    face = z >= 0 ? 4 : 5;
    sc = z >= 0 ? x : -x;
    tc = -y;
    ma = az;
  }
  const tex = face < faces.length ? faces[face] : null;
  if (ma === 0 || face >= faces.length || !tex) return [0, 0, 0, 1];
  return tex.sample(0.5 * (sc / ma + 1), 0.5 * (tc / ma + 1));
}
