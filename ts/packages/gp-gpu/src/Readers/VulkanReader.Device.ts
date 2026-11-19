// Draws built from the device model (VulkanDevice): the vertex and index buffers bound at each draw, the descriptor
// set's images (textures, cube maps, render targets drawn earlier in the frame) and the render pass's framebuffer.
// (VulkanReader.Device.cs: a part of the partial class VulkanReader, as functions of the reader.)
import { parseInt32, trimNet } from "../internal/dotnet.js";
import { matchesAll } from "../internal/regex.js";
import type { GpuProject } from "../GpuProject.js";
import { ClearOp, CopyOp, type FrameOp } from "../Scene/FrameOp.js";
import { RenderTarget } from "../Scene/RenderTarget.js";
import type * as A from "../Shading/ShaderAst.js";
import { ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { StructLayout } from "./StructLayout.js";
import type { DrawState, VulkanDevice } from "./VulkanDevice.js";
import type { VulkanReader } from "./VulkanReader.js";

/**
 * The uniform blocks / cbuffers of every shader of the project (with several pipelines, the first shader alone
 * may have none), each block type once.
 */
export function allShaderBlocks(project: GpuProject, extensions: string[], ...known: ShaderProgram[]): A.Global[] {
  const programs: ShaderProgram[] = [...known];
  for (const [path, text] of project.files) {
    if (!extensions.some((e) => path.endsWith(e))) continue;
    try {
      programs.push(ShaderParser.parseProgram(text));
    } catch (e) {
      if (!(e instanceof ShaderSyntaxException)) throw e;
    }
  }
  // GroupBy(type | pushConstant).Select(First): the first of each, in first-seen order.
  const seen = new Set<string>();
  const result: A.Global[] = [];
  for (const g of programs.flatMap((p) => p.globals)) {
    if (g.block === null) continue;
    const key = g.type + "|" + g.pushConstant;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(g);
  }
  return result;
}

/** A vertex attribute: location, binding, byte offset, floats, per instance. (A C# record.) */
class VkAttribute {
  constructor(readonly location: number, readonly binding: number, readonly offset: number, readonly comps: number, readonly instance: boolean) {}
}

/** The vertex input of the program: its attributes and the bindings' strides. */
export interface VkLayout {
  attributes: VkAttribute[];
  strides: Map<number, number>;
}

/**
 * The vertex input of the program: attributeDescriptions[i].location / binding / format / offset and the bindings'
 * strides and input rates (bindingDescription.stride = sizeof(Vertex), bindingDescriptions[1].inputRate = …).
 */
function deviceLayout(r: VulkanReader): VkLayout {
  const src = r.src;
  const field = (name: string, index: string, fallback: number): number => {
    const all = matchesAll(new RegExp(String.raw`attributeDescriptions\s*\[\s*` + index + String.raw`\s*\]\s*\.\s*` + name + String.raw`\s*=\s*([^;]+);`, "g"), src.code);
    const m = all[all.length - 1];
    return m === undefined ? fallback : (sizeExpr(r, m[1]!) ?? fallback);
  };
  const attributes: VkAttribute[] = [];
  const indices = [...new Set(matchesAll(/attributeDescriptions\s*\[\s*(\d+)\s*\]\s*\.\s*location/g, src.code).map((m) => m[1]!))];
  const bindingRates = new Map<number, boolean>();
  const strides = new Map<number, number>();
  for (const b of matchesAll(/(bindingDescriptions?)(?:\s*\[\s*(\d+)\s*\])?\s*\.\s*(binding|stride|inputRate)\s*=\s*([^;]+);/g, src.code)) {
    const idx = b[2] !== undefined ? parseInt32(b[2]) : 0;
    switch (b[3]) {
      case "stride":
        strides.set(idx, sizeExpr(r, b[4]!) ?? 0);
        break;
      case "inputRate":
        bindingRates.set(idx, b[4]!.includes("INSTANCE"));
        break;
    }
  }
  for (const i of indices) {
    const formats = matchesAll(new RegExp(String.raw`attributeDescriptions\s*\[\s*` + i + String.raw`\s*\]\s*\.\s*format\s*=\s*(\w+)`, "g"), src.code);
    const format = formats[formats.length - 1]?.[1] ?? "";
    const comps = matchesAll(/[RGBA]\d+/g, format).length;
    const binding = field("binding", i, 0);
    attributes.push(new VkAttribute(field("location", i, parseInt32(i)), binding, field("offset", i, 0), Math.max(1, comps), bindingRates.get(binding) ?? false));
  }
  return { attributes, strides };
}

/** A size or offset: a number, sizeof(Vertex) / sizeof(glm::vec3), offsetof(Vertex, texCoord). */
function sizeExpr(r: VulkanReader, text: string): number | null {
  const src = r.src;
  text = trimNet(text);
  const off = /^offsetof\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)$/.exec(text);
  const fields = off !== null ? StructLayout.fields(src, off[1]!) : null;
  if (off !== null && fields !== null) {
    let at = 0;
    for (const f of fields) {
      if (f.name === off[2]) return at * 4;
      at += f.floats;
    }
    return null;
  }
  const size = /^sizeof\s*\(\s*([\w:]+)\s*\)$/.exec(text);
  if (size !== null) {
    const type = size[1]!.replaceAll("glm::", "");
    const fs = StructLayout.fields(src, type);
    if (fs !== null) return fs.reduce((sum, f) => sum + f.floats, 0) * 4;
    return StructLayout.floatsOf(type) * 4;
  }
  // Regex.Replace(text, @"static_cast<\w+>\((.*)\)$", "$1"): the first match only can end at the end.
  return src.int(text.replace(/static_cast<\w+>\(([^\n]*)\)$/, (_, inner: string) => inner));
}

/** Vertices (and per-instance values) from the buffers bound at a draw, keyed by location. */
export function deviceVertices(r: VulkanReader, device: VulkanDevice, state: DrawState, count: number, instances: number, baseVertex = 0): [Map<string, ShaderValue>[], Map<string, ShaderValue>[] | null] {
  r.layout ??= deviceLayout(r);
  let { attributes, strides } = r.layout;
  // The pipeline's own vertex input (what vkCreateGraphicsPipelines was given), when the device model has it.
  const pipe = device.pipelineOf(state.pipeline);
  if (pipe !== null && pipe.attributes.length > 0) {
    attributes = pipe.attributes.map((a) => new VkAttribute(a.location, a.binding, a.offset, a.comps, pipe.bindings.get(a.binding)?.instance === true));
    strides = new Map([...pipe.bindings].map(([k, b]) => [k, b.stride]));
  }
  const read = (a: VkAttribute[], n: number, first: number): Map<string, ShaderValue>[] => {
    const list: Map<string, ShaderValue>[] = [];
    for (let i = 0; i < n; i++) {
      const dict = new Map<string, ShaderValue>();
      for (const at of a) {
        const vb = state.vertexBuffers.get(at.binding);
        const v = vb !== undefined ? device.read(vb.buffer, vb.offset + (i + first) * (strides.get(at.binding) ?? 0) + at.offset, at.comps) : null;
        if (v !== null) dict.set(String(at.location), ShaderValue.vecOf(v));
      }
      list.push(dict);
    }
    return list;
  };
  const vertices = read(attributes.filter((a) => !a.instance), count, baseVertex);
  const perInstance = attributes.filter((a) => a.instance);
  return [vertices, perInstance.length === 0 ? null : read(perInstance, instances, 0)];
}

type TextureLookup = (name: string, u: number, v: number) => number[];
type CubeLookup = (name: string, x: number, y: number, z: number) => number[] | null;

/** The textures of a draw: each sampler's binding in the bound descriptor set (set 0). */
export function deviceTextures(r: VulkanReader, device: VulkanDevice, state: DrawState, vs: ShaderProgram, fs: ShaderProgram): [TextureLookup | null, CubeLookup | null] {
  r.deviceCubeLod = null;
  const set = state.sets.get(0);
  if (set === undefined || !device.hasSet(set)) return [null, null];
  const globals = [...vs.globals, ...fs.globals];
  const bindings = new Map<string, number>();
  for (const g of globals) if (g.type.startsWith("sampler") && !bindings.has(g.id)) bindings.set(g.id, g.binding ?? 0);
  if (bindings.size === 0) return [null, null];
  const found = new Map<string, ReturnType<VulkanDevice["textureAt"]>>();
  for (const [k, b] of bindings) found.set(k, device.textureAt(set, b));
  const nameOf = (id: string): string => id.split("|")[0]!;
  r.deviceTextureSizes = (id) => found.get(nameOf(id))?.texture?.image ?? null;
  if ([...found.values()].every((v) => v === null)) return [null, null];
  // "name@k": layer k of a sampler2DArray, looked up when first read.
  for (const array of [...bindings.keys()].filter((k) => globals.some((g) => g.id === k && g.type.includes("Array"))))
    for (let layer = 0; layer < 16; layer++) found.set(array + "@" + layer, device.textureAt(set, bindings.get(array)!, layer));
  r.deviceCubeLod = (id, x, y, z, lod) => found.get(nameOf(id))?.cube?.sample(x, y, z, lod) ?? null;
  return [
    (id, u, v) => found.get(nameOf(id))?.texture?.sample(u, v) ?? [0, 0, 0, 1],
    (id, x, y, z) => found.get(nameOf(id))?.cube?.sample(x, y, z) ?? null,
  ];
}

/** The device model's clears in the scene's draw numbering, with their targets registered. */
export function addDeviceOps(r: VulkanReader, ops: Iterable<FrameOp>, device: VulkanDevice): void {
  const scene = r.scene;
  for (const op of ops) {
    if (op instanceof ClearOp) {
      if (op.target !== null) registerTarget(r, device, op.target);
      scene.ops.push(op.with({ beforeDraw: scene.draws.length }));
    } else if (op instanceof CopyOp) {
      if (op.from !== null) registerTarget(r, device, op.from);
      if (op.to !== null) registerTarget(r, device, op.to);
      scene.ops.push(op.with({ beforeDraw: scene.draws.length }));
    }
  }
}

export function registerTarget(r: VulkanReader, device: VulkanDevice, id: string): void {
  const scene = r.scene;
  // "img:N~2@3": mip level 2 of image N (half the size per level), cube face / array layer 3. The target is
  // registered per level; its layers are found through it.
  const levelId = id.includes("@") ? id.slice(0, id.indexOf("@")) : id;
  if (scene.targets.has(levelId)) return;
  const found = device.targetImage(id);
  if (found === null) return;
  const { image: img, level } = found;
  const shape = device.shapeOf(id) ?? device.shapeOf(levelId);
  // Drawn into layer by layer through its own framebuffers (a cube map's faces): each layer is a target of its
  // own; a layered framebuffer (gl_Layer) has them all.
  const layers = img.perLayer ? 1 : Math.max(1, img.layers);
  scene.targets.set(levelId, new RenderTarget(levelId, {
    width: Math.max(1, img.width >> level), height: Math.max(1, img.height >> level), colorAttachments: shape?.colors ?? 1, depth: shape?.depth ?? true,
    stencil: shape?.depth ?? true, samples: Math.max(1, img.samples), float: img.float, layers, channels: device.channelsOf(levelId, shape?.colors ?? 1),
  }));
}
