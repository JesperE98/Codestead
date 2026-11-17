import type { ObjMaterial } from "./ObjMaterial.js";

/** One mesh of an OBJ model: its material and its vertices (position, normal, texture coordinate) and indices. */
export class ObjMesh {
  readonly name: string;
  readonly material: ObjMaterial | null;
  readonly positions: number[][] = [];
  readonly normals: number[][] = [];
  readonly texCoords: number[][] = [];
  readonly indices: number[] = [];
  /** A skinned mesh (glTF's JOINTS_0 / WEIGHTS_0): per vertex four bone indices (the skin's joints) and weights. */
  joints: number[][] | null = null;
  weights: number[][] | null = null;

  constructor(init: { name?: string; material?: ObjMaterial | null } = {}) {
    this.name = init.name ?? "";
    this.material = init.material ?? null;
  }
}
