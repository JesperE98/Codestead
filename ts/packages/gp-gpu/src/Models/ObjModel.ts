import { parseDouble, parseInt32, splitNoEmpty, trimNet } from "../internal/dotnet.js";
import type { GpuProject } from "../GpuProject.js";
import { GltfModel } from "./GltfModel.js";
import { ObjMaterial } from "./ObjMaterial.js";
import { ObjMesh } from "./ObjMesh.js";

/** Path.GetDirectoryName of a path with forward slashes ("" for a bare name). */
export function directoryOf(path: string): string {
  const p = path.replaceAll("\\", "/");
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

/**
 * A Wavefront OBJ model with its MTL materials, read the way Assimp (aiProcess_Triangulate) and tinyobjloader read it:
 * one mesh per object/material, polygons as triangle fans, a vertex per distinct position/uv/normal triple.
 */
export class ObjModel {
  readonly meshes: ObjMesh[] = [];
  /** The materials by name, in the order they were read. */
  readonly materials = new Map<string, ObjMaterial>();
  /** A glTF model's skeleton, node tree and animations (null for an OBJ model). */
  gltf: GltfModel | null = null;

  /** The model at a path of the project (its .mtl and textures next to it), or null. */
  static load(project: GpuProject, path: string): ObjModel | null {
    // A glTF model (.gltf + .bin): read as assimp reads it.
    if (GltfModel.isGltf(path)) return GltfModel.load(project, path)?.model ?? null;
    const bytes = project.findAsset(path);
    if (bytes === null) return null;
    const model = new ObjModel();
    const dir = directoryOf(path);
    const text = new TextDecoder().decode(bytes);
    const positions: number[][] = [];
    const uvs: number[][] = [];
    const normals: number[][] = [];
    let current: ObjMesh | null = null;
    let objectName = "";
    const map = new Map<string, number>();
    const currentMesh = (material: string): ObjMesh => {
      if (current === null || (current.material?.name ?? null) !== material || current.name !== objectName) {
        current = new ObjMesh({ name: objectName, material: model.materials.get(material) ?? null });
        model.meshes.push(current);
        map.clear();
      }
      return current;
    };
    let material = "";
    for (const raw of text.split("\n")) {
      const line = trimNet(raw);
      if (line.length === 0 || line[0] === "#") continue;
      const parts = splitNoEmpty(line, " ");
      const D = (i: number): number => (i < parts.length ? parseDouble(parts[i]!) : 0);
      switch (parts[0]) {
        case "v": positions.push([D(1), D(2), D(3)]); break;
        case "vt": uvs.push([D(1), D(2)]); break;
        case "vn": normals.push([D(1), D(2), D(3)]); break;
        case "o": case "g": objectName = parts.length > 1 ? parts[1]! : ""; current = null; break;
        case "usemtl": material = parts.length > 1 ? parts[1]! : ""; current = null; break;
        case "mtllib":
          if (parts.length > 1) {
            const mtl = project.findAsset(dir.length > 0 ? dir + "/" + parts[1] : parts[1]!);
            if (mtl !== null) readMtl(new TextDecoder().decode(mtl), model);
          }
          break;
        case "f": {
          const mesh = currentMesh(material);
          const corner: number[] = [];
          for (let i = 1; i < parts.length; i++) {
            let index = map.get(parts[i]!);
            if (index === undefined) {
              const ids = parts[i]!.split("/");
              const ix = (k: number, count: number): number => {
                if (!(k < ids.length && ids[k]!.length > 0)) return -1;
                const n = parseInt32(ids[k]!);
                return n < 0 ? count + n : n - 1;
              };
              const pi = ix(0, positions.length), ti = ix(1, uvs.length), ni = ix(2, normals.length);
              index = mesh.positions.length;
              mesh.positions.push(pi >= 0 && pi < positions.length ? positions[pi]! : [0, 0, 0]);
              mesh.texCoords.push(ti >= 0 && ti < uvs.length ? uvs[ti]! : [0, 0]);
              mesh.normals.push(ni >= 0 && ni < normals.length ? normals[ni]! : [0, 0, 0]);
              map.set(parts[i]!, index);
            }
            corner.push(index);
          }
          for (let i = 1; i + 1 < corner.length; i++) mesh.indices.push(corner[0]!, corner[i]!, corner[i + 1]!);
          break;
        }
      }
    }
    removeEmpty(model.meshes);
    return model;
  }
}

/** meshes.RemoveAll(m => m.Indices.Count == 0). */
export function removeEmpty(meshes: ObjMesh[]): void {
  for (let i = meshes.length - 1; i >= 0; i--) if (meshes[i]!.indices.length === 0) meshes.splice(i, 1);
}

function readMtl(text: string, model: ObjModel): void {
  let m: ObjMaterial | null = null;
  for (const raw of text.split("\n")) {
    const parts = splitNoEmpty(trimNet(raw), " ");
    if (parts.length < 2 || parts[0]!.startsWith("#")) continue;
    const rgb = (): number[] => parts.slice(1, 4).map((p) => parseDouble(p));
    switch (parts[0]) {
      case "newmtl":
        m = new ObjMaterial({ name: parts[1]!, index: model.materials.size });
        model.materials.set(parts[1]!, m);
        break;
      case "Kd": if (m !== null) m.diffuse = rgb(); break;
      case "Ks": if (m !== null) m.specular = rgb(); break;
      case "Ns": if (m !== null) m.shininess = parseDouble(parts[1]!); break;
      case "map_Kd": if (m !== null) m.diffuseMap = parts[parts.length - 1]!; break;
      case "map_Ks": if (m !== null) m.specularMap = parts[parts.length - 1]!; break;
      case "map_Bump": case "bump": case "norm": if (m !== null) m.normalMap = parts[parts.length - 1]!; break;
    }
  }
}
