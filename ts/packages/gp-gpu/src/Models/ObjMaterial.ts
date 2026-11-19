/** A material of an MTL file: its colours and texture files. */
export class ObjMaterial {
  readonly name: string;
  /** The material's place in the MTL file (tinyobjloader's material_ids). */
  readonly index: number;
  diffuse: number[] = [1, 1, 1];
  specular: number[] = [0, 0, 0];
  shininess = 32;
  diffuseMap: string | null = null;
  specularMap: string | null = null;
  normalMap: string | null = null;

  constructor(init: { name?: string; index?: number; diffuse?: number[]; diffuseMap?: string | null } = {}) {
    this.name = init.name ?? "";
    this.index = init.index ?? 0;
    if (init.diffuse !== undefined) this.diffuse = init.diffuse;
    if (init.diffuseMap !== undefined) this.diffuseMap = init.diffuseMap;
  }
}
