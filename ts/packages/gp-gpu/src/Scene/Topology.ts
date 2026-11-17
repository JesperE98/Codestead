/** How vertices are put together into primitives. */
export enum Topology {
  Triangles,
  TriangleStrip,
  TriangleFan,
  Lines,
  LineStrip,
  Points,
  /** Patches of control points for the tessellation stages (GL_PATCHES, a patch list, an N_CONTROL_POINT_PATCHLIST). */
  Patches,
}
