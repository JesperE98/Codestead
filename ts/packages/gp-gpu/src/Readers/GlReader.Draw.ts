// GlReader.Draw.cs: glDrawArrays and glDrawElements: the vertex data comes from the bound vertex array object, as on a
// real GPU.
import { parseInt32, toInt } from "../internal/dotnet.js";
import { GltfModel } from "../Models/GltfModel.js";
import { ModelFiles } from "../Models/ModelFiles.js";
import type { ObjModel } from "../Models/ObjModel.js";
import { Rasterizer } from "../Raster/Rasterizer.js";
import { CullMode } from "../Scene/CullMode.js";
import { DrawCall, type VertexData } from "../Scene/DrawCall.js";
import { SimNote } from "../Scene/SimNote.js";
import { Topology } from "../Scene/Topology.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { CubeTexture } from "../Textures/CubeTexture.js";
import { SamplerState } from "../Textures/SamplerState.js";
import { Texture } from "../Textures/Texture.js";
import { attachmentBlends, blockUniforms, drawTarget } from "./GlReader.Advanced.js";
import { boneAttributes, extractsBones, vaoOf } from "./GlReader.Calls.js";
import type { GlReader } from "./GlReader.js";
import type { ProgramObject } from "./GlState.js";

type Sample2D = (name: string, u: number, v: number) => number[];
type SampleCube = (name: string, x: number, y: number, z: number) => number[] | null;

/** @internal */
export function draw(r: GlReader, mode: string, indexType: string | null, first: number, count: number, call: string, line: number, instances = 1): void {
  // A frame before the one shown (a game's earlier frames): what it draws is not kept.
  if (r.discardDraws) return;
  const gl = r.gl;
  const scene = r.scene;
  const lineText = String(line);
  const program = gl.currentProgram !== null ? gl.programs.get(gl.currentProgram) : undefined;
  if (program === undefined) {
    scene.notes.push(SimNote.error("noProgram", ["call", call], ["line", lineText]));
    return;
  }
  if (!program.linked || program.vertex === null || program.fragment === null) return;
  const vao = vaoOf(r);
  if (vao === null) {
    scene.notes.push(SimNote.error("noVaoBound", ["call", call], ["line", lineText]));
    return;
  }
  let indices: number[] | null = null;
  if (indexType !== null) {
    const data = vao.elementBuffer !== null ? gl.buffers.get(vao.elementBuffer) ?? null : null;
    if (data === null) {
      scene.notes.push(SimNote.error("noElementBuffer", ["line", lineText]));
      return;
    }
    const size = indexType.includes("SHORT") ? 2 : indexType.includes("BYTE") ? 1 : 4;
    const skip = Math.trunc(first / size);
    if (skip + count > data.length) {
      scene.notes.push(SimNote.warning("tooManyIndices", ["count", String(count)], ["have", String(data.length)]));
      count = Math.max(0, data.length - skip);
    }
    // Skip(skip).Take(count): a negative skip is 0, a negative count takes nothing.
    const from = Math.max(0, skip);
    indices = data.slice(from, from + Math.max(0, count)).map((d) => toInt(d));
    first = 0;
  }
  // Indexed: only the vertices the indices reach (a strip of a 65,536-vertex terrain reads 512 of them), the
  // indices counted from the lowest.
  let baseVertex = 0;
  if (indices !== null && indices.length > 0 && !program.vertex.names.has("gl_VertexID")) {
    let lowest = indices[0]!;
    for (const i of indices) if (i < lowest) lowest = i;
    if (lowest > 0) {
      baseVertex = lowest;
      for (let i = 0; i < indices.length; i++) indices[i]! -= lowest;
    }
  }
  let vertexCount: number;
  if (indices === null) vertexCount = first + count;
  else if (indices.length === 0) vertexCount = 0;
  else {
    let highest = indices[0]!;
    for (const i of indices) if (i > highest) highest = i;
    vertexCount = highest + 1;
  }

  // The vertex shader's inputs, by location.
  const inputs = program.vertex.globals.filter((g) => g.storage === "in");
  const vertices: VertexData[] = [];
  let pastEnd = false;
  for (let v = 0; v < vertexCount; v++) {
    const dict: VertexData = new Map();
    for (const [loc, attr] of vao.attributes) {
      const data = attr.buffer !== null ? gl.buffers.get(attr.buffer) ?? null : null;
      if (attr.divisor > 0 || !attr.enabled || data === null) continue;
      const stride = attr.strideBytes === 0 ? attr.size : Math.trunc(attr.strideBytes / 4);
      const start = Math.trunc(attr.offsetBytes / 4) + (v + baseVertex) * stride;
      const comps = new Array<number>(attr.size).fill(0);
      for (let k = 0; k < attr.size; k++) {
        if (start + k < data.length) comps[k] = data[start + k]!;
        else pastEnd = true;
      }
      dict.set(String(loc), ShaderValue.vecOf(comps));
    }
    vertices.push(dict);
  }
  if (pastEnd) scene.notes.push(SimNote.warning("readsPastEnd", ["call", call], ["line", lineText]));
  for (const input of inputs) {
    const loc = input.location ?? inputs.indexOf(input);
    const a = vao.attributes.get(loc);
    if (a === undefined || !a.enabled) scene.notes.push(SimNote.warning("attribDisabled", ["location", String(loc)], ["name", input.id]));
  }

  // Per-instance attributes (glVertexAttribDivisor): one value per instance (per divisor instances).
  let perInstance: VertexData[] | null = null;
  let divisor = 1;
  for (const [loc, attr] of vao.attributes) {
    if (!(attr.divisor > 0 && attr.enabled)) continue;
    const data = attr.buffer !== null ? gl.buffers.get(attr.buffer) ?? null : null;
    if (data === null) continue;
    divisor = attr.divisor;
    const stride = attr.strideBytes === 0 ? attr.size : Math.trunc(attr.strideBytes / 4);
    const n = Math.max(1, Math.trunc((instances + divisor - 1) / divisor));
    perInstance ??= Array.from({ length: n }, () => new Map<string, ShaderValue>());
    for (let i = 0; i < n && i < perInstance.length; i++) {
      const start = Math.trunc(attr.offsetBytes / 4) + i * stride;
      perInstance[i]!.set(String(loc), ShaderValue.vecOf(Array.from({ length: attr.size }, (_, k) => (start + k < data.length ? data[start + k]! : 0))));
    }
  }

  const made = makeDraw(r, program, vertices, indices, indices === null ? first : 0, indices?.length ?? count, topologyOf(mode), instances, perInstance, divisor);
  // Before the render loop, what is drawn into a framebuffer object stays for every frame (a capture pass).
  if (r.inLoop || made.target !== null) scene.draws.push(made);
  else r.setupDraws.push(made);
}

/** A draw with the program's shaders and uniforms, its textures and the current fixed-function state. */
function makeDraw(r: GlReader, program: ProgramObject, vertices: VertexData[], indices: number[] | null, first: number, count: number,
  topology: Topology, instances = 1, perInstance: VertexData[] | null = null, divisor = 1, textures: Sample2D | null = null): DrawCall {
  const gl = r.gl;
  const uniforms = [...program.uniforms];
  const blocks = blockUniforms(r, program);
  // A model brings its own textures (its materials): the texture units are not read then.
  const [samplerFn, cubes] = textures === null ? samplers(r, program) : [null, null];
  const sizes = textures === null ? r.samplerSizes : null;
  const cubesLod = textures === null ? r.samplerCubeLod : null;
  return new DrawCall({
    vertexShader: program.vertex!,
    fragmentShader: program.fragment!,
    geometryShader: program.geometry,
    tessControlShader: program.tessEval !== null ? program.tessControl : null,
    tessEvalShader: program.tessEval,
    patchVertices: gl.patchVertices,
    vertices,
    indices,
    first,
    count,
    instances: Math.max(1, instances),
    instanceVertices: perInstance,
    instanceDivisor: divisor,
    topology,
    uniforms: (t) => {
      const d = new Map(blocks);
      for (const [name, f] of uniforms) {
        const value = f(t);
        if (value !== null) d.set(name, value);
      }
      return d;
    },
    cull: !gl.cullFace ? CullMode.None : gl.cullFaceMode === "GL_FRONT" ? CullMode.Front : gl.cullFaceMode === "GL_FRONT_AND_BACK" ? CullMode.FrontAndBack : CullMode.Back,
    frontCcw: gl.frontCcw,
    wireframe: gl.wireframe,
    depthTest: gl.depthTest,
    depthFunc: gl.depthFunc,
    depthWrite: gl.depthMask,
    stencil: gl.stencilTest ? gl.stencil : null,
    blend: gl.blend ? gl.blendState : null,
    attachmentBlends: attachmentBlends(r),
    colorMask: gl.colorMask.slice(),
    pointSize: gl.pointSize,
    programPointSize: gl.programPointSize,
    target: drawTarget(r),
    textures: textures ?? samplerFn,
    cubeTextures: cubes,
    cubeTexturesLod: cubesLod,
    textureImages: sizes,
  });
}

/**
 * The textures the shaders sample: each sampler2D uniform reads the texture unit its value names (0 unless set with
 * glUniform1i / setInt), and the texture bound to that unit now. An incomplete texture reads black.
 */
function samplers(r: GlReader, program: ProgramObject): [Sample2D | null, SampleCube | null] {
  const gl = r.gl;
  const scene = r.scene;
  r.samplerSizes = null;
  r.samplerCubeLod = null;
  const stages = program.allStages;
  const cubeSamplers = new Set(stages.flatMap((s) => s.globals).filter((u) => u.storage === "uniform" && u.type.startsWith("samplerCube")).map((u) => u.id));
  const samplerList = [...new Set(stages.flatMap((s) => samplerNames(s)))];
  if (samplerList.length === 0) return [null, null];
  const bound = new Map<string, Texture | null>();
  const layerCounts = new Map<string, number>();
  const cubes = new Map<string, CubeTexture>();
  // layout (binding = N) uniform sampler2D …: unit N unless the program sets the uniform itself.
  const bindings = new Map<string, number>();
  for (const u of stages.flatMap((s) => s.globals))
    if (u.storage === "uniform" && u.binding !== null && u.block === null && !bindings.has(u.id)) bindings.set(u.id, u.binding);
  for (const name of samplerList) {
    const f = program.uniforms.get(name);
    const v = f !== undefined ? f(1.0) : null;
    const unit = v !== null ? toInt(v.x) : unitOf(bindings, name);
    let texture: Texture | null = null;
    // The unit's binding of the sampler's kind (a cube map and a 2D texture can be bound to one unit).
    const ofKind = cubeSamplers.has(name) ? gl.unitsCube : gl.units2D;
    const texName = ofKind.get(unit) ?? gl.units.get(unit);
    const t = texName !== undefined ? gl.textureObjects.get(texName) : undefined;
    if (t !== undefined && (t.image !== null || t.isCube || t.framebuffer !== null)) {
      const sampler = new SamplerState(t.wrapS, t.wrapT, !t.magFilter.includes("NEAREST"), t.border);
      const cubeFbo = t.framebuffer;
      if (!t.complete) scene.notes.push(SimNote.warning("textureIncomplete", ["name", name], ["filter", t.minFilter]));
      else if (t.isCube && cubeFbo !== null) {
        // A cube map a layered framebuffer draws into (point shadows): face i is layer i.
        const [attachment, depth] = [t.attachment, t.isDepth];
        const level = (target: string): (Texture | null)[] => Array.from({ length: 6 }, (_, face) =>
          new Texture(() => Rasterizer.targetImage(face === 0 ? target : target + "@" + face, attachment, depth), sampler, { components: 4 }));
        // Mip levels (drawn one by one or made by glGenerateMipmap) are read when the filter uses them.
        const mipmapped = t.targetLevels > 1 && t.minFilter.includes("MIPMAP") && cubeFbo.startsWith("tex:");
        cubes.set(name, new CubeTexture(level(cubeFbo), {
          mips: mipmapped ? Array.from({ length: t.targetLevels - 1 }, (_, i) => level(`${cubeFbo}~${i + 1}`)) : null,
        }));
        continue;
      } else if (t.isCube) {
        cubes.set(name, new CubeTexture(t.faces.map((face) => (face === null ? null : new Texture(face, sampler, { components: t.components })))));
        continue;
      } else if (t.framebuffer !== null) {
        // A texture a framebuffer object draws into: what has been drawn so far in this frame (a texture
        // array: each layer, "fbo@layer", read as "name@layer").
        const fbo = t.framebuffer;
        const [attachment, depth] = [t.attachment, t.isDepth];
        texture = new Texture(() => Rasterizer.targetImage(fbo, attachment, depth), sampler, { components: 4 });
        for (let layer = 1; layer < t.layers; layer++) {
          const layerTarget = fbo + "@" + layer;
          bound.set(name + "@" + layer, new Texture(() => Rasterizer.targetImage(layerTarget, attachment, depth), sampler, { components: 4 }));
        }
        if (t.layers > 1) bound.set(name + "@0", texture);
        layerCounts.set(name, t.layers);
      } else texture = new Texture(t.image!, sampler, {
        components: t.components,
        srgb: t.srgb,
        // glGenerateMipmap and a *_MIPMAP_* minification filter: a minified texture reads its smaller levels.
        mipmapped: t.mipmaps && t.minFilter.includes("MIPMAP"),
        mipLinear: t.minFilter.endsWith("MIPMAP_LINEAR"),
      });
    } else scene.notes.push(SimNote.warning("noTextureOnUnit", ["name", name], ["unit", String(unit)]));
    bound.set(name, texture);
  }
  r.samplerSizes = (name) => bound.get(name)?.image ?? null;
  r.samplerCubeLod = cubes.size === 0 ? null : (name, x, y, z, lod) => cubes.get(name)?.sample(x, y, z, lod) ?? null;
  // A layer past the array's last reads the last one (GLSL clamps the layer).
  const layer = (name: string): Texture | null => {
    if (bound.has(name)) return bound.get(name)!;
    const at = name.lastIndexOf("@");
    const layers = at < 0 ? undefined : layerCounts.get(name.slice(0, at));
    if (layers === undefined) return null;
    return bound.get(name.slice(0, at) + "@" + (layers - 1)) ?? null;
  };
  return [
    (name, u, v) => layer(name)?.sample(u, v) ?? [0, 0, 0, 1],
    cubes.size === 0 ? null : (name, x, y, z) => cubes.get(name)?.sample(x, y, z) ?? null,
  ];
}

/** The unit a sampler's layout (binding = N) names: an array's element i is unit N + i. */
function unitOf(bindings: Map<string, number>, sampler: string): number {
  const unit = bindings.get(sampler);
  if (unit !== undefined) return unit;
  const element = /^(\w+)\[(\d+)\]$/.exec(sampler);
  const first = element !== null ? bindings.get(element[1]!) : undefined;
  return element !== null && first !== undefined ? first + parseInt32(element[2]!) : 0;
}

/**
 * @internal Model::Draw(shader) of learnopengl.com: each mesh drawn with its vertices (location 0 position, 1 normal, 2
 * texture coordinates) and its material's textures as texture_diffuse1, texture_specular1, texture_normal1.
 */
export function drawModel(r: GlReader, model: ObjModel, path: string, shader: string, line: number): void {
  const program = r.gl.programs.get(shader);
  if (program === undefined || !program.linked || program.vertex === null || program.fragment === null) {
    r.scene.notes.push(SimNote.error("noProgram", ["call", "Draw"], ["line", String(line)]));
    return;
  }
  const flipUv = ModelFiles.flipUVs(r.src, r.project);
  const flipImages = /stbi_set_flip_vertically_on_load\s*\(\s*(?:true|1)\s*\)/.test(r.src.code);
  for (const mesh of model.meshes) {
    // A model drawn many times (a scene graph's hundred planets) is read and its textures loaded once.
    let made = r.meshData.get(mesh);
    if (made === undefined) {
      const meshVertices: VertexData[] = mesh.positions.map((p, i) => new Map([
        ["0", ShaderValue.vecOf(p)],
        ["1", ShaderValue.vecOf(mesh.normals[i]!)],
        ["2", ShaderValue.vec(mesh.texCoords[i]![0]!, flipUv ? 1 - mesh.texCoords[i]![1]! : mesh.texCoords[i]![1]!)],
      ]));
      // A skinned model (model_animation.h): the bone ids and weights at mesh.h's locations.
      const { ids: idsAt, weights: weightsAt } = boneAttributes(r);
      const extracted = extractsBones(r);
      for (let i = 0; i < meshVertices.length && (idsAt !== null || weightsAt !== null); i++) {
        const { ids, weights } = extracted ? GltfModel.vertexBones(mesh, i) : { ids: [-1, -1, -1, -1], weights: [0, 0, 0, 0] };
        if (idsAt !== null) meshVertices[i]!.set(String(idsAt), ShaderValue.vecOf(ids));
        if (weightsAt !== null) meshVertices[i]!.set(String(weightsAt), ShaderValue.vecOf(weights));
      }
      const meshMaps = new Map<string, Texture | null>([
        ["texture_diffuse1", ModelFiles.texture(r.project, path, mesh.material?.diffuseMap ?? null, flipImages, true)],
        ["texture_specular1", ModelFiles.texture(r.project, path, mesh.material?.specularMap ?? null, flipImages, true)],
        ["texture_normal1", ModelFiles.texture(r.project, path, mesh.material?.normalMap ?? null, flipImages, true)],
      ]);
      made = { vertices: meshVertices, maps: meshMaps };
      r.meshData.set(mesh, made);
    }
    const { vertices, maps } = made;
    const d = makeDraw(r, program, vertices, mesh.indices.slice(), 0, mesh.indices.length, Topology.Triangles, 1, null, 1,
      (name, u, v) => maps.get(name)?.sample(u, v) ?? [0, 0, 0, 1]);
    if (r.inLoop) r.scene.draws.push(d);
    else r.setupDraws.push(d);
  }
}

/** The sampler uniforms of a shader, with struct fields ("material.diffuse") and array elements ("maps[1]"). */
function samplerNames(shader: ShaderProgram): string[] {
  const of = (type: string, path: string, arraySize: number): string[] => {
    const paths = arraySize > 0 ? Array.from({ length: arraySize }, (_, i) => `${path}[${i}]`) : [path];
    if (type.startsWith("sampler")) return paths;
    const st = shader.findStruct(type);
    if (st !== null) return paths.flatMap((p) => st.fields.flatMap((f) => of(f.type, p + "." + f.id, f.arraySize)));
    return [];
  };
  return shader.globals.filter((g) => g.storage === "uniform" && g.block === null).flatMap((g) => of(g.type, g.id, g.arraySize));
}

/** @internal The topology a draw mode names. */
export function topologyOf(mode: string): Topology {
  if (mode.includes("PATCHES")) return Topology.Patches;
  if (mode.includes("TRIANGLE_STRIP")) return Topology.TriangleStrip;
  if (mode.includes("TRIANGLE_FAN")) return Topology.TriangleFan;
  if (mode.includes("TRIANGLE")) return Topology.Triangles;
  if (mode.includes("LINE_STRIP") || mode.includes("LINE_LOOP")) return Topology.LineStrip;
  if (mode.includes("LINE")) return Topology.Lines;
  if (mode.includes("POINT")) return Topology.Points;
  return Topology.Triangles;
}
