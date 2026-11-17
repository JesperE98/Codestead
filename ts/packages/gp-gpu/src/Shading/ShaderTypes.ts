// ShaderRunner's static type helpers (ShaderRunner.ComponentCount, MatrixSize, Swizzle), in a module of their own so
// the parser can use them without importing the runner.
import { ShaderValue } from "./ShaderValue.js";

const componentCounts = new Map<string, number>();

/** Number of components of a scalar or vector type (0 = not one). */
export function componentCount(type: string): number {
  let n = componentCounts.get(type);
  if (n === undefined) {
    n = findComponentCount(type);
    componentCounts.set(type, n);
  }
  return n;
}

const scalarTypes = new Set([
  "float", "double", "int", "uint", "bool", "half", "min16float", "FLOAT", "UINT", "INT", "GLfloat", "GLint", "GLuint", "unsigned",
  "uint32_t", "int32_t", "uint16_t", "size_t", "auto", "dword", "DWORD",
]);
const vectorPrefixes = ["vec", "ivec", "uvec", "bvec", "dvec", "float", "int", "uint", "half", "bool", "double", "XMFLOAT", "XMINT", "XMUINT", "min16float"];

function findComponentCount(type: string): number {
  if (scalarTypes.has(type)) return 1;
  if (ShaderValue.isIntType(type)) return 1;
  // GLM's and assimp's quaternions: (x, y, z, w).
  if (type === "quat" || type === "fquat" || type === "dquat" || type === "aiQuaternion") return 4;
  for (const prefix of vectorPrefixes) {
    const last = type.charCodeAt(type.length - 1);
    if (type.startsWith(prefix) && type.length === prefix.length + 1 && last >= 50 && last <= 52) return last - 48;
  }
  return 0;
}

/** The size of a square matrix type (mat4, float4x4, XMFLOAT4X4, XMMATRIX), or 0. */
export function matrixSize(type: string): number {
  switch (type) {
    // (mat4x4 is mat4's other name in GLSL and GLM.)
    case "mat2": case "mat2x2": case "float2x2": case "dmat2":
      return 2;
    case "mat3": case "mat3x3": case "float3x3": case "XMFLOAT3X3": case "dmat3":
      return 3;
    case "mat4": case "mat4x4": case "float4x4": case "XMFLOAT4X4": case "XMMATRIX": case "dmat4": case "dmat4x4":
      return 4;
    default:
      return 0;
  }
}

const swizzles = new Map<string, number[] | null>();

/** The component indices of a swizzle (.xyz, .rgba, .stpq), or null. */
export function swizzle(s: string): number[] | null {
  if (s.length === 0 || s.length > 4) return null;
  let r = swizzles.get(s);
  if (r === undefined) {
    r = findSwizzle(s);
    swizzles.set(s, r);
  }
  return r;
}

function findSwizzle(s: string): number[] | null {
  if (s.length === 0 || s.length > 4) return null;
  const r = new Array<number>(s.length);
  for (const set of ["xyzw", "rgba", "stpq"]) {
    let ok = true;
    for (let i = 0; i < s.length && ok; i++) {
      r[i] = set.indexOf(s[i]!);
      ok = r[i]! >= 0;
    }
    if (ok) return r;
  }
  return null;
}
