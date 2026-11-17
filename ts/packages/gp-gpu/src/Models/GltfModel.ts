import type { GpuProject } from "../GpuProject.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { SortedMap } from "../Shading/SortedMap.js";
import { ObjMaterial } from "./ObjMaterial.js";
import { ObjMesh } from "./ObjMesh.js";
import { directoryOf, ObjModel, removeEmpty } from "./ObjModel.js";

/** A node of the tree: its name, its transform (or matrix), its children and its mesh. */
export interface GltfNode {
  readonly name: string;
  readonly translation: number[];
  readonly rotation: number[];
  readonly scale: number[];
  readonly matrix: number[] | null;
  readonly children: number[];
  readonly mesh: number | null;
}

/** A bone of the skin: its node's name and its inverse bind matrix (column-major, glTF's own order). */
export interface GltfBone {
  readonly name: string;
  readonly offsetMatrix: number[];
}

export interface GltfChannel {
  readonly node: string;
  readonly times: number[];
  readonly positions: number[][] | null;
  readonly positionTimes: number[];
  readonly rotations: number[][] | null;
  readonly rotationTimes: number[];
  readonly scales: number[][] | null;
  readonly scaleTimes: number[];
}

export interface GltfAnimation {
  readonly name: string;
  readonly duration: number;
  readonly channels: GltfChannel[];
}

/** A JSON value as System.Text.Json reads it: wrong kinds throw (the loader then reports no model). */
type Json = unknown;

class JsonError extends Error {}

function isObject(e: Json): e is Record<string, Json> {
  return typeof e === "object" && e !== null && !Array.isArray(e);
}

/** JsonElement.TryGetProperty: the property, or undefined (an element that is not an object throws). */
function prop(e: Json, name: string): Json | undefined {
  if (!isObject(e)) throw new JsonError("The requested operation requires an element of type 'Object'.");
  return Object.prototype.hasOwnProperty.call(e, name) ? e[name] : undefined;
}

/** JsonElement.GetProperty: the property (missing throws KeyNotFoundException). */
function need(e: Json, name: string): Json {
  const v = prop(e, name);
  if (v === undefined) throw new JsonError(`The given key '${name}' was not present.`);
  return v;
}

function arr(e: Json): Json[] {
  if (!Array.isArray(e)) throw new JsonError("The requested operation requires an element of type 'Array'.");
  return e;
}

function int32(e: Json): number {
  if (typeof e !== "number" || !Number.isInteger(e) || e < -2147483648 || e > 2147483647) throw new JsonError("Cannot get the value of a token type as an Int32.");
  return e;
}

function dbl(e: Json): number {
  if (typeof e !== "number") throw new JsonError("Cannot get the value of a token type as a Double.");
  return e;
}

function str(e: Json): string | null {
  if (e === null) return null;
  if (typeof e !== "string") throw new JsonError("Cannot get the value of a token type as a String.");
  return e;
}

function intOr(e: Json, name: string, fallback = 0): number {
  const v = prop(e, name);
  return v !== undefined ? int32(v) : fallback;
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** The models read so far, by the bytes of their .gltf file (C#'s ConditionalWeakTable). */
const Cache = new WeakMap<Uint8Array, GltfModel>();

/**
 * A glTF 2.0 model (.gltf with its .bin buffers and images next to it) read the way assimp 5 reads it: its meshes as
 * ObjModel meshes (with the skin's bone ids and weights per vertex), the node tree, the skin's bones and the
 * animations – and as the aiScene a program walks (scene()): mRootNode, mMeshes with mBones, mAnimations with their
 * aiNodeAnim channels (key times in milliseconds, mTicksPerSecond 1000), mMaterials.
 */
export class GltfModel {
  readonly model: ObjModel;
  readonly nodes: GltfNode[] = [];
  rootNode = 0;
  readonly bones: GltfBone[] = [];
  readonly animations: GltfAnimation[] = [];
  /** The mesh of each glTF mesh (one per primitive). */
  private readonly meshPrimitives: number[][] = [];

  /** The field of an aiMaterial value that holds its texture files by type. */
  static readonly MaterialTextures = "\u0001textures";

  private constructor() {
    this.model = new ObjModel();
    this.model.gltf = this;
  }

  static isGltf(path: string): boolean {
    return path.toLowerCase().endsWith(".gltf");
  }

  /** The model at a path of the project, or null (missing, not glTF). */
  static load(project: GpuProject, path: string): GltfModel | null {
    return GltfModel.loadFrom((p) => project.findAsset(p), path);
  }

  static loadFrom(readBytes: (path: string) => Uint8Array | null, path: string): GltfModel | null {
    const bytes = readBytes(path);
    if (bytes === null) return null;
    const cached = Cache.get(bytes);
    if (cached !== undefined) return cached;
    try {
      const model = GltfModel.read(readBytes, path, bytes);
      Cache.set(bytes, model);
      return model;
    } catch {
      // JsonException, KeyNotFoundException, InvalidOperationException, IndexOutOfRangeException, ArgumentException,
      // FormatException in C#.
      return null;
    }
  }

  private static read(readBytes: (path: string) => Uint8Array | null, path: string, bytes: Uint8Array): GltfModel {
    const model = new GltfModel();
    const root: Json = JSON.parse(new TextDecoder().decode(bytes));
    const dir = directoryOf(path);
    const near = (uri: string): string => (dir.length > 0 ? dir + "/" + uri : uri);
    const buffers: Uint8Array[] = [];
    const bufs = prop(root, "buffers");
    if (bufs !== undefined)
      for (const b of arr(bufs)) {
        const u = prop(b, "uri");
        const uri = u !== undefined ? (str(u) ?? "") : "";
        if (uri.startsWith("data:")) buffers.push(fromBase64(uri.slice(uri.indexOf(",") + 1)));
        else buffers.push(readBytes(near(uri)) ?? new Uint8Array(0));
      }
    const bv = prop(root, "bufferViews");
    const views = bv !== undefined ? arr(bv) : [];
    const acc = prop(root, "accessors");
    const accessors = acc !== undefined ? arr(acc) : [];
    const at = <T>(list: readonly T[], i: number): T => {
      if (i < 0 || i >= list.length) throw new RangeError("Index was out of range.");
      return list[i]!;
    };

    // An accessor's elements as numbers (normalised integers stay integers: joint ids).
    const readAccessor = (index: number): number[][] => {
      const a = at(accessors, index);
      const count = intOr(a, "count");
      const typeName = str(need(a, "type")) ?? "SCALAR";
      const comps = typeName === "VEC2" ? 2 : typeName === "VEC3" ? 3 : typeName === "VEC4" ? 4 : typeName === "MAT4" ? 16 : typeName === "MAT3" ? 9 : typeName === "MAT2" ? 4 : 1;
      const type = intOr(a, "componentType", 5126);
      const size = type === 5120 || type === 5121 ? 1 : type === 5122 || type === 5123 ? 2 : 4;
      const result: number[][] = [];
      const viewIndex = prop(a, "bufferView");
      if (viewIndex === undefined) {
        for (let i = 0; i < count; i++) result.push(new Array<number>(comps).fill(0));
        return result;
      }
      const view = at(views, int32(viewIndex));
      const data = at(buffers, intOr(view, "buffer"));
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const start = intOr(view, "byteOffset") + intOr(a, "byteOffset");
      let stride = intOr(view, "byteStride", comps * size);
      if (stride === 0) stride = comps * size;
      for (let i = 0; i < count; i++) {
        const v = new Array<number>(comps);
        for (let k = 0; k < comps; k++) {
          const o = start + i * stride + k * size;
          if (o < 0 || o + size > data.length) throw new RangeError("Index was out of range.");
          v[k] = type === 5120 ? dv.getInt8(o)
            : type === 5121 ? dv.getUint8(o)
            : type === 5122 ? dv.getInt16(o, true)
            : type === 5123 ? dv.getUint16(o, true)
            : type === 5125 ? dv.getUint32(o, true)
            : dv.getFloat32(o, true);
        }
        result.push(v);
      }
      return result;
    };

    // Materials: the base colour texture's image.
    const im = prop(root, "images");
    const images = im !== undefined ? arr(im).map((i) => { const u = prop(i, "uri"); return u !== undefined ? str(u) : null; }) : [];
    const tx = prop(root, "textures");
    const textures = tx !== undefined ? arr(tx).map((t) => intOr(t, "source", -1)) : [];
    const materials: ObjMaterial[] = [];
    const mats = prop(root, "materials");
    if (mats !== undefined)
      for (const m of arr(mats)) {
        let map: string | null = null;
        let color = [1, 1, 1];
        const pbr = prop(m, "pbrMetallicRoughness");
        if (pbr !== undefined) {
          const bct = prop(pbr, "baseColorTexture");
          if (bct !== undefined) {
            const ti = intOr(bct, "index", -1);
            if (ti >= 0 && ti < textures.length) {
              const ii = textures[ti]!;
              if (ii >= 0 && ii < images.length) map = images[ii]!;
            }
          }
          const f = prop(pbr, "baseColorFactor");
          if (f !== undefined) color = arr(f).slice(0, 3).map(dbl);
        }
        const n = prop(m, "name");
        const name = n !== undefined ? (str(n) ?? "") : "";
        const material = new ObjMaterial({ name, index: materials.length, diffuse: color, diffuseMap: map });
        materials.push(material);
        model.model.materials.set(name.length > 0 ? name : "material" + materials.length, material);
      }

    // Meshes: one model mesh per primitive. assimp turns glTF's texture coordinates to v-up (v = 1 - v).
    const meshes = prop(root, "meshes");
    if (meshes !== undefined)
      for (const mesh of arr(meshes)) {
        const list: number[] = [];
        const mn = prop(mesh, "name");
        const meshName = mn !== undefined ? (str(mn) ?? "") : "";
        for (const prim of arr(need(mesh, "primitives"))) {
          const attrs = need(prim, "attributes");
          const positions = readAccessor(intOr(attrs, "POSITION"));
          const ni = prop(attrs, "NORMAL"), ui = prop(attrs, "TEXCOORD_0"), ji = prop(attrs, "JOINTS_0"), wi = prop(attrs, "WEIGHTS_0");
          const normals = ni !== undefined ? readAccessor(int32(ni)) : null;
          const uvs = ui !== undefined ? readAccessor(int32(ui)) : null;
          const joints = ji !== undefined ? readAccessor(int32(ji)) : null;
          const weights = wi !== undefined ? readAccessor(int32(wi)) : null;
          const ix = prop(prim, "indices");
          const indices = ix !== undefined ? readAccessor(int32(ix)).map((v) => Math.trunc(v[0]!)) : positions.map((_, i) => i);
          const materialIndex = intOr(prim, "material", -1);
          const objMesh = new ObjMesh({ name: meshName, material: materialIndex >= 0 && materialIndex < materials.length ? materials[materialIndex]! : null });
          for (let v = 0; v < positions.length; v++) {
            objMesh.positions.push(positions[v]!);
            objMesh.normals.push(normals !== null ? at(normals, v) : [0, 0, 0]);
            objMesh.texCoords.push(uvs !== null ? [at(uvs, v)[0]!, 1 - at(uvs, v)[1]!] : [0, 0]);
          }
          if (joints !== null && weights !== null) {
            objMesh.joints = joints.map((j) => j.map((x) => Math.trunc(x)));
            objMesh.weights = weights;
          }
          objMesh.indices.push(...indices);
          list.push(model.model.meshes.length);
          model.model.meshes.push(objMesh);
        }
        model.meshPrimitives.push(list);
      }

    // Nodes.
    const nodes = prop(root, "nodes");
    if (nodes !== undefined)
      for (const n of arr(nodes)) {
        const vec = (name: string, fallback: number[]): number[] => {
          const p = prop(n, name);
          return p !== undefined ? arr(p).map(dbl) : fallback;
        };
        const nn = prop(n, "name"), mx = prop(n, "matrix"), ch = prop(n, "children"), me = prop(n, "mesh");
        model.nodes.push({
          name: nn !== undefined ? (str(nn) ?? "") : "",
          translation: vec("translation", [0, 0, 0]),
          rotation: vec("rotation", [0, 0, 0, 1]),
          scale: vec("scale", [1, 1, 1]),
          matrix: mx !== undefined ? arr(mx).map(dbl) : null,
          children: ch !== undefined ? arr(ch).map(int32) : [],
          mesh: me !== undefined ? int32(me) : null,
        });
      }
    const sceneIndex = intOr(root, "scene");
    const scenes = prop(root, "scenes");
    let rootNodes: number[] = [];
    if (scenes !== undefined && sceneIndex < arr(scenes).length) {
      const sn = prop(at(arr(scenes), sceneIndex), "nodes");
      if (sn !== undefined) rootNodes = arr(sn).map(int32);
    }
    if (rootNodes.length === 1) model.rootNode = rootNodes[0]!;
    else {
      // Several roots: assimp makes a ROOT node above them.
      model.nodes.push({ name: "ROOT", translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1], matrix: null, children: rootNodes, mesh: null });
      model.rootNode = model.nodes.length - 1;
    }

    // The skin's bones in its joint order, their inverse bind matrices.
    const skins = prop(root, "skins");
    if (skins !== undefined && arr(skins).length > 0) {
      const skin = arr(skins)[0];
      const jointNodes = arr(need(skin, "joints")).map(int32);
      const ib = prop(skin, "inverseBindMatrices");
      const ibm = ib !== undefined ? readAccessor(int32(ib)) : null;
      for (let j = 0; j < jointNodes.length; j++)
        model.bones.push({ name: at(model.nodes, jointNodes[j]!).name, offsetMatrix: ibm !== null && j < ibm.length ? ibm[j]! : identity() });
    }

    // Animations: one channel per animated node (assimp's order: the last node first), times in seconds here.
    const anims = prop(root, "animations");
    if (anims !== undefined)
      for (const a of arr(anims)) {
        const samplers = arr(need(a, "samplers"));
        const byNode = new Map<number, Map<string, { times: number[]; values: number[][] }>>();
        let duration = 0;
        for (const c of arr(need(a, "channels"))) {
          const target = need(c, "target");
          const node = prop(target, "node");
          if (node === undefined) continue;
          const sampler = at(samplers, intOr(c, "sampler"));
          const times = readAccessor(intOr(sampler, "input")).map((t) => t[0]!);
          const values = readAccessor(intOr(sampler, "output"));
          duration = Math.max(duration, times.length === 0 ? 0 : times.reduce((x, y) => Math.max(x, y)));
          let tracks = byNode.get(int32(node));
          if (tracks === undefined) byNode.set(int32(node), (tracks = new Map()));
          tracks.set(str(need(target, "path")) ?? "", { times, values });
        }
        const channels: GltfChannel[] = [];
        for (const node of [...byNode.keys()].sort((x, y) => y - x)) {
          const tracks = byNode.get(node)!;
          const tr = tracks.get("translation"), ro = tracks.get("rotation"), sc = tracks.get("scale");
          channels.push({
            node: at(model.nodes, node).name, times: [],
            positions: tr?.values ?? null, positionTimes: tr?.times ?? [],
            rotations: ro?.values ?? null, rotationTimes: ro?.times ?? [],
            scales: sc?.values ?? null, scaleTimes: sc?.times ?? [],
          });
        }
        const an = prop(a, "name");
        model.animations.push({ name: an !== undefined ? (str(an) ?? "") : "", duration, channels });
      }
    removeEmpty(model.model.meshes);
    return model;
  }

  /** A node's own transform, column-major: its matrix, or translation × rotation × scale. */
  static localMatrix(n: GltfNode): number[] {
    if (n.matrix !== null && n.matrix.length === 16) return n.matrix;
    const x = n.rotation[0]!, y = n.rotation[1]!, z = n.rotation[2]!, w = n.rotation[3]!;
    const r = [
      [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
      [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
      [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
    ];
    const result = new Array<number>(16).fill(0);
    for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) result[col * 4 + row] = r[row]![col]! * n.scale[col]!;
    result[12] = n.translation[0]!;
    result[13] = n.translation[1]!;
    result[14] = n.translation[2]!;
    result[15] = 1;
    return result;
  }

  // ---------- the aiScene a program walks ----------

  /**
   * The aiScene of assimp's ReadFile: flipUvs is aiProcess_FlipUVs (the texture coordinates back to v-down). Shared: the
   * program's pointers into it are not copies.
   */
  scene(flipUvs: boolean): ShaderValue {
    const nodeValue = (index: number, depth: number): ShaderValue => {
      const n = this.nodes[index]!;
      const meshes = n.mesh !== null && n.mesh < this.meshPrimitives.length ? this.meshPrimitives[n.mesh]! : [];
      const children = depth > 64 ? [] : n.children.filter((c) => c >= 0 && c < this.nodes.length).map((c) => nodeValue(c, depth + 1));
      return S([
        ["mName", ShaderValue.str(n.name)],
        ["mTransformation", aiMatrix(GltfModel.localMatrix(n))],
        ["mNumChildren", ShaderValue.integer(children.length)],
        ["mChildren", ShaderValue.array(children)],
        ["mNumMeshes", ShaderValue.integer(meshes.length)],
        ["mMeshes", ShaderValue.array(meshes.map((m) => ShaderValue.integer(m)))],
      ]);
    };
    const meshValues = this.model.meshes.map((mesh) => {
      const bones: ShaderValue[] = [];
      for (let b = 0; b < this.bones.length && mesh.joints !== null; b++) {
        const weights: ShaderValue[] = [];
        for (let v = 0; v < mesh.positions.length; v++)
          for (let k = 0; k < 4; k++)
            if (mesh.joints[v]![k] === b && mesh.weights![v]![k]! > 0)
              weights.push(S([["mVertexId", ShaderValue.integer(v)], ["mWeight", ShaderValue.scalar(mesh.weights![v]![k]!)]]));
        bones.push(S([
          ["mName", ShaderValue.str(this.bones[b]!.name)],
          ["mOffsetMatrix", aiMatrix(this.bones[b]!.offsetMatrix)],
          ["mNumWeights", ShaderValue.integer(weights.length)],
          ["mWeights", ShaderValue.array(weights)],
        ]));
      }
      const uvs = mesh.texCoords.map((t) => vec3([t[0]!, flipUvs ? 1 - t[1]! : t[1]!, 0]));
      return S([
        ["mName", ShaderValue.str(mesh.name)],
        ["mNumVertices", ShaderValue.integer(mesh.positions.length)],
        ["mVertices", ShaderValue.array(mesh.positions.map(vec3))],
        ["mNormals", ShaderValue.array(mesh.normals.map(vec3))],
        ["mTangents", ShaderValue.array(mesh.positions.map(() => vec3([1, 0, 0])))],
        ["mBitangents", ShaderValue.array(mesh.positions.map(() => vec3([0, 0, 1])))],
        ["mTextureCoords", ShaderValue.array([ShaderValue.array(uvs), ...Array.from({ length: 7 }, () => ShaderValue.scalar(0))])],
        ["mNumFaces", ShaderValue.integer(Math.trunc(mesh.indices.length / 3))],
        ["mFaces", ShaderValue.array(Array.from({ length: Math.trunc(mesh.indices.length / 3) }, (_, f) => S([
          ["mNumIndices", ShaderValue.integer(3)],
          ["mIndices", ShaderValue.array([ShaderValue.integer(mesh.indices[f * 3]!), ShaderValue.integer(mesh.indices[f * 3 + 1]!), ShaderValue.integer(mesh.indices[f * 3 + 2]!)])],
        ])))],
        ["mMaterialIndex", ShaderValue.integer(mesh.material?.index ?? 0)],
        ["mNumBones", ShaderValue.integer(bones.length)],
        ["mBones", ShaderValue.array(bones)],
      ]);
    });
    const materials = [...this.model.materials.values()].sort((a, b) => a.index - b.index).map((m) => S([
      ["mName", ShaderValue.str(m.name)],
      // What GetTextureCount / GetTexture answer: the files by texture type.
      [GltfModel.MaterialTextures, S([
        ["aiTextureType_DIFFUSE", ShaderValue.array(m.diffuseMap !== null ? [ShaderValue.str(m.diffuseMap)] : [])],
        ["aiTextureType_BASE_COLOR", ShaderValue.array(m.diffuseMap !== null ? [ShaderValue.str(m.diffuseMap)] : [])],
      ])],
    ]));
    // Times in milliseconds, 1000 ticks per second (assimp 5's glTF importer).
    const keys = (values: number[][] | null, times: number[], quaternion: boolean): ShaderValue => ShaderValue.array((values ?? []).map((v, i) => S([
      ["mTime", ShaderValue.scalar(i < times.length ? times[i]! * 1000 : 0)],
      ["mValue", quaternion
        ? S([["x", ShaderValue.scalar(v[0]!)], ["y", ShaderValue.scalar(v[1]!)], ["z", ShaderValue.scalar(v[2]!)], ["w", ShaderValue.scalar(v[3]!)]])
        : vec3(v)],
    ])));
    const animations = this.animations.map((a) => S([
      ["mName", ShaderValue.str(a.name)],
      ["mDuration", ShaderValue.scalar(a.duration * 1000)],
      ["mTicksPerSecond", ShaderValue.scalar(1000)],
      ["mNumChannels", ShaderValue.integer(a.channels.length)],
      ["mChannels", ShaderValue.array(a.channels.map((c) => S([
        ["mNodeName", ShaderValue.str(c.node)],
        ["mNumPositionKeys", ShaderValue.integer(c.positions?.length ?? 0)],
        ["mPositionKeys", keys(c.positions, c.positionTimes, false)],
        ["mNumRotationKeys", ShaderValue.integer(c.rotations?.length ?? 0)],
        ["mRotationKeys", keys(c.rotations, c.rotationTimes, true)],
        ["mNumScalingKeys", ShaderValue.integer(c.scales?.length ?? 0)],
        ["mScalingKeys", keys(c.scales, c.scaleTimes, false)],
      ])))],
    ]));
    return new ShaderValue({
      fields: new Map([
        ["mFlags", ShaderValue.integer(0)],
        ["mRootNode", nodeValue(this.rootNode, 0)],
        ["mNumMeshes", ShaderValue.integer(meshValues.length)],
        ["mMeshes", ShaderValue.array(meshValues)],
        ["mNumMaterials", ShaderValue.integer(materials.length)],
        ["mMaterials", ShaderValue.array(materials)],
        ["mNumAnimations", ShaderValue.integer(animations.length)],
        ["mAnimations", ShaderValue.array(animations)],
      ]),
      shared: true,
    });
  }

  /**
   * A vertex's bones as learnopengl's ExtractBoneWeightForVertices leaves them: the bones (ids = their place in the
   * skin) in the order assimp lists them, each in the next free slot, at most four; the rest -1 with weight 0.
   */
  static vertexBones(mesh: ObjMesh, v: number): { ids: number[]; weights: number[] } {
    const ids = [-1, -1, -1, -1], weights = [0, 0, 0, 0];
    if (mesh.joints === null || mesh.weights === null) return { ids, weights };
    const seen = new Set<number>();
    const influences: { bone: number; weight: number }[] = [];
    for (let k = 0; k < 4; k++) {
      if (!(mesh.weights[v]![k]! > 0)) continue;
      const bone = mesh.joints[v]![k]!;
      // GroupBy(bone).First(): the first influence of a bone.
      if (seen.has(bone)) continue;
      seen.add(bone);
      influences.push({ bone, weight: mesh.weights[v]![k]! });
    }
    influences.sort((a, b) => a.bone - b.bone);
    for (let k = 0; k < Math.min(4, influences.length); k++) {
      ids[k] = influences[k]!.bone;
      weights[k] = influences[k]!.weight;
    }
    return { ids, weights };
  }

  /**
   * The model's m_BoneInfoMap as learnopengl's Model fills it: bone name → BoneInfo { id, offset } – the offset as GLM's
   * column-major matrix, or (directX) as DirectXMath's row-vector one.
   */
  boneInfoMap(directX: boolean): ShaderValue {
    const map = new SortedMap<ShaderValue>();
    for (let b = 0; b < this.bones.length; b++) {
      const m = this.bones[b]!.offsetMatrix;
      const offset = directX ? Array.from({ length: 16 }, (_, i) => m[(i % 4) * 4 + Math.trunc(i / 4)]!) : m.slice();
      map.set(ShaderValue.mapKey(ShaderValue.str(this.bones[b]!.name)), ShaderValue.struct(new Map([
        ["id", ShaderValue.integer(b)],
        ["offset", ShaderValue.matrix(4, offset)],
      ])));
    }
    return new ShaderValue({ map });
  }
}

function identity(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function S(fields: [string, ShaderValue][]): ShaderValue {
  return ShaderValue.struct(new Map(fields));
}

function vec3(v: number[]): ShaderValue {
  return S([["x", ShaderValue.scalar(v[0]!)], ["y", ShaderValue.scalar(v[1]!)], ["z", ShaderValue.scalar(v.length > 2 ? v[2]! : 0)]]);
}

/** assimp's aiMatrix4x4 (a1 … d4, row by row) from a column-major matrix. */
function aiMatrix(m: number[]): ShaderValue {
  const f = new Map<string, ShaderValue>();
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) f.set(`${String.fromCharCode(97 + row)}${col + 1}`, ShaderValue.scalar(m[col * 4 + row]!));
  return ShaderValue.struct(f);
}
