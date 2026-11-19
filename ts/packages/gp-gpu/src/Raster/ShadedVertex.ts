import type { ShaderValue } from "../Shading/ShaderValue.js";

/**
 * A vertex after the vertex (or geometry) shader: its clip-space position, its outputs (by name, by "@location" and by
 * "block:Type" for interface blocks) and the gl_PointSize it wrote. `layer`: the layer of a layered target the
 * primitive goes to (gl_Layer, SV_RenderTargetArrayIndex).
 */
export class ShadedVertex {
  constructor(readonly clip: number[], readonly outputs: Map<string, ShaderValue>, readonly pointSize: number | null = null, readonly layer: number = 0) {}
}
