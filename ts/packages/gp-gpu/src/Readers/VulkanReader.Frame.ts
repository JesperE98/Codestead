// One frame: the clear value of the render pass, the graphics pipeline and the draw command recorded in
// recordCommandBuffer, with its vertex/index buffers and push constants. (VulkanReader.Frame.cs: a part of the partial
// class VulkanReader, as functions of the reader.)
import { parseInt32, toInt, trimChars, trimNet } from "../internal/dotnet.js";
import { escapeRegex, matchesAll } from "../internal/regex.js";
import { ModelFiles } from "../Models/ModelFiles.js";
import { ObjModel } from "../Models/ObjModel.js";
import { CullMode } from "../Scene/CullMode.js";
import { DrawCall } from "../Scene/DrawCall.js";
import type { FrameOp } from "../Scene/FrameOp.js";
import { SimNote } from "../Scene/SimNote.js";
import type * as A from "../Shading/ShaderAst.js";
import { ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { SamplerState } from "../Textures/SamplerState.js";
import { Texture } from "../Textures/Texture.js";
import { DrawTextures } from "./DrawTextures.js";
import { FrameRecorder } from "./FrameRecorder.js";
import { GameFrames } from "./GameFrames.js";
import { PipelineInfo } from "./PipelineInfo.js";
import { PipelineState } from "./PipelineState.js";
import { StbImage } from "./StbImage.js";
import { StructLayout, type StructField } from "./StructLayout.js";
import { TextureBinding } from "./TextureBinding.js";
import { DrawState, VulkanDevice } from "./VulkanDevice.js";
import { addDeviceOps, allShaderBlocks, deviceTextures, deviceVertices, registerTarget } from "./VulkanReader.Device.js";
import { parameters, pipelines, runtimePipeline } from "./VulkanReader.Pipelines.js";
import { topologyOf, type VulkanReader } from "./VulkanReader.js";

type VertexMap = Map<string, ShaderValue>;
type TextureLookup = (name: string, u: number, v: number) => number[];

/** LINQ's Skip(n).Take(m) of a list. */
function skipTake<T>(list: readonly T[], skip: number, take: number): T[] {
  const from = Math.max(0, skip);
  return list.slice(from, from + Math.max(0, take));
}

/** C#'s CullMode from a VkCullModeFlags name. */
function cullOf(cull: string): CullMode {
  return cull.includes("FRONT_AND_BACK") ? CullMode.FrontAndBack : cull.includes("BACK") ? CullMode.Back : cull.includes("FRONT") ? CullMode.Front : CullMode.None;
}

export function frame(r: VulkanReader, dynamicRendering: boolean): void {
  const src = r.src, scene = r.scene;
  // The clear colour: VkClearValue clearColor = {{{0.2f, 0.3f, 0.3f, 1.0f}}}; and loadOp CLEAR.
  const begin = src.calls(dynamicRendering ? "vkCmdBeginRendering" : "vkCmdBeginRenderPass")[0] ?? null;
  const end = src.calls(dynamicRendering ? "vkCmdEndRendering" : "vkCmdEndRenderPass")[0] ?? null;
  if (begin === null || end === null) {
    scene.notes.push(SimNote.info("vkNoRenderPassBegin"));
    return;
  }
  // The colour attachment's loadOp (not a resolve or depth attachment's: they are DONT_CARE / their own).
  // (several render passes – a blur pass that overwrites everything may not care – : the window's pass clearing is enough)
  const colorLoadOps = src.fieldAssignments("loadOp").filter((a) => !/resolve|depth/i.test(a.target)).map((a) => a.value);
  const loadOp = colorLoadOps.find((v) => v.includes("CLEAR")) ?? colorLoadOps[colorLoadOps.length - 1] ?? src.lastFieldValue("loadOp");
  const clearVar = /\bVkClearValue\s+(\w+)/.exec(src.code);
  // std::array<VkClearValue, 2> clearValues{}; clearValues[0].color = {{0.2f, 0.3f, 0.3f, 1.0f}};
  const colorField = /(\w+)\s*\[\s*0\s*\]\s*\.\s*color\s*=\s*(\{[^;]*\})\s*;/.exec(src.code);
  const clearNumbers = colorField !== null ? src.numbers(colorField[2]!) : clearVar !== null ? src.numbers(clearVar[1]!) : null;
  if (loadOp !== null && loadOp.includes("CLEAR") && clearNumbers !== null && clearNumbers.length >= 4)
    scene.clearColor = [clearNumbers[0]!, clearNumbers[1]!, clearNumbers[2]!, clearNumbers[3]!];
  else if (loadOp !== null && !loadOp.includes("CLEAR"))
    scene.notes.push(SimNote.warning("vkLoadOpNotClear", ["value", loadOp]));
  draw(r, begin.offset, end.offset);
}

/**
 * The function that records the frame's command buffer: the one with the render pass's begin, or – when a helper of
 * the program begins the pass (a post-processor's BeginRender) – the caller up the chain that calls
 * vkBeginCommandBuffer (vulkan-tutorial's recordCommandBuffer).
 */
function recordFunction(r: VulkanReader, fn: string | null): string | null {
  const src = r.src;
  let current = fn;
  for (let depth = 0; current !== null && depth < 6; depth++) {
    const body = src.functionBody(current);
    if (body !== null && body.includes("vkBeginCommandBuffer")) return current;
    const callee = current.split("#")[0]!;
    const re = new RegExp(String.raw`(?<![\w.>])` + escapeRegex(callee) + String.raw`\s*\(`);
    current = [...src.functions.keys()].find((f) => {
      if (f.split("#")[0] === callee) return false;
      const b = src.functionBody(f);
      return b !== null && re.test(b);
    }) ?? null;
  }
  return fn;
}

function draw(r: VulkanReader, beginOffset: number, _endOffset: number): void {
  const src = r.src, scene = r.scene, project = r.project;
  const drawCall = src.calls("vkCmdDraw")[0] ?? null;
  const drawIndexed = src.calls("vkCmdDrawIndexed")[0] ?? null;
  const call = drawIndexed ?? drawCall;
  if (call === null) return;
  // A draw in the same function must be between the render pass's begin and end (a helper called from there,
  // learnopengl's renderScene, is followed when the frame is recorded).
  const begins = src.calls(src.uses("vkCmdBeginRendering") ? "vkCmdBeginRendering" : "vkCmdBeginRenderPass").map((b) => b.offset);
  const ends = src.calls(src.uses("vkCmdEndRendering") ? "vkCmdEndRendering" : "vkCmdEndRenderPass").map((e) => e.offset);
  const passes = begins.slice(0, Math.min(begins.length, ends.length)).map((b, i) => [b, ends[i]!] as const);
  if (src.functionAt(call.offset) === src.functionAt(beginOffset) && !passes.some(([first, second]) => call.offset > first && call.offset < second)) {
    scene.notes.push(SimNote.error("vkDrawOutsideRenderPass", ["call", call.name]));
    return;
  }
  if (!r.reached("vkCreateGraphicsPipelines") || !src.hasCall("vkCmdBindPipeline")) {
    scene.notes.push(SimNote.error("vkNoPipelineBound", ["call", call.name]));
    return;
  }
  // Dynamic viewport and scissor must be set before drawing.
  for (const [state, setter] of [["VK_DYNAMIC_STATE_VIEWPORT", "vkCmdSetViewport"], ["VK_DYNAMIC_STATE_SCISSOR", "vkCmdSetScissor"]] as const)
    if (src.uses(state) && !src.hasCall(setter)) {
      scene.notes.push(SimNote.error("vkDynamicStateNotSet", ["state", state], ["call", setter]));
      return;
    }

  let vs = shader(r, ".vert", "vert");
  let fs = shader(r, ".frag", "frag");
  // One pipeline: its own shaders (by the file names it was created with), not just the first in the project.
  const created = pipelines(r);
  const only = created.size === 1 ? [...created.values()][0]! : null;
  if (only !== null) {
    vs = only.vs;
    fs = only.fs;
  }
  if (vs === null || fs === null) return;

  const inputs = vs.globals.filter((g) => g.storage === "in");
  const vertices: VertexMap[] = [];
  // The vertex data: from the buffers the command buffer binds (the device model), else from `vertices`.
  const notesBefore = scene.notes.length;
  const staticVertices = inputs.length === 0 || vertexData(r, inputs, vertices);
  const notesAfterVertices = scene.notes.length;

  let indices: number[] | null = null;
  let first = 0, count: number;
  let instances: number;
  if (call === drawIndexed) {
    if (!src.hasCall("vkCmdBindIndexBuffer")) {
      scene.notes.push(SimNote.error("vkNoIndexBuffer"));
      return;
    }
    const data = r.modelIndices ?? src.numbers("indices") ?? [];
    count = src.int(call.arg(1)) ?? 0;
    instances = src.int(call.arg(2)) ?? 1;
    const firstIndex = src.int(call.arg(3)) ?? 0;
    indices = skipTake(data, firstIndex, count).map((d) => toInt(d));
  } else {
    count = src.int(call.arg(1)) ?? 0;
    instances = src.int(call.arg(2)) ?? 1;
    first = src.int(call.arg(3)) ?? 0;
  }
  if (staticVertices && inputs.length > 0 && vertices.length < (indices === null ? first + count : indices.length === 0 ? 0 : maxOf(indices) + 1))
    scene.notes.push(SimNote.warning("readsPastEnd", ["call", call.name], ["line", String(call.line)]));

  const cull = src.lastFieldValue("cullMode") ?? "VK_CULL_MODE_NONE";
  const front = src.lastFieldValue("frontFace") ?? "VK_FRONT_FACE_COUNTER_CLOCKWISE";
  const polygon = src.lastFieldValue("polygonMode") ?? "VK_POLYGON_MODE_FILL";
  const wireframe = polygon.includes("LINE");
  if (wireframe && !/fillModeNonSolid\s*=\s*VK_TRUE/.test(src.code))
    scene.notes.push(SimNote.error("vkFillModeNonSolid"));

  const uniforms = pushConstants(r, vs, fs);
  const textures = texturesOf(r, vs, fs);
  const cullMode = cullOf(cull);
  const frontCcw = !front.includes("_CLOCKWISE") || front.includes("COUNTER_CLOCKWISE");
  const topology = topologyOf(src.lastFieldValue("topology") ?? "TRIANGLE_LIST");
  const depthTest = /depthTestEnable\s*=\s*VK_TRUE/.test(src.code);
  const pipeState = PipelineState.vulkan((f) => src.lastFieldValue(f), (f) => {
    const v = src.lastFieldValue(f);
    return v !== null ? src.int(v) : null;
  });

  // Run the frame: the uniform buffer update and the recorded commands (each draw with its push constants).
  const blocks = allShaderBlocks(project, [".vert", ".frag", ".geom", ".tesc", ".tese"], vs, fs);
  const device = new VulkanDevice(project, src, { windowWidth: scene.width, windowHeight: scene.height });
  const recorder = new FrameRecorder(src, r.time, scene, blocks, false, device, project);
  recorder.setup();
  if (device.windowSrgb) scene.windowSrgb = true;
  // A game: the frames before the shown one (its input and update, without drawing).
  const recordFn = recordFunction(r, src.functionAt(beginOffset) ?? src.functionAt(call.offset));
  GameFrames.runGlfw(src, recorder, r.time, [...updateFunctions(r, blocks), "drawFrame", recordFn ?? "drawFrame"]);
  for (const fn of updateFunctions(r, blocks)) recorder.run(fn);
  if (recordFn !== null) recorder.run(recordFn);
  const buffer = recorder.bufferContents();
  const firstBuffer = (st: DrawState): { buffer: string; offset: number } => st.vertexBuffers.values().next().value!;
  const deviceVerticesUsed = inputs.length > 0 && recorder.draws.some((d) => d.state instanceof DrawState && d.state.vertexBuffers.size > 0
    && device.read(firstBuffer(d.state).buffer, firstBuffer(d.state).offset, 1) !== null);
  if (!staticVertices && !deviceVerticesUsed) return;
  // The device model reads the bound buffers: what the static reading of `vertices` said does not apply.
  if (deviceVerticesUsed) scene.notes.splice(notesBefore, notesAfterVertices - notesBefore);
  // The ops recorded during the setup (the first SetupOps) belong to the setup draws; the others to the frame.
  const groupByDraw = (ops: FrameOp[]): Map<number, FrameOp[]> => {
    const map = new Map<number, FrameOp[]>();
    for (const o of ops) {
      const list = map.get(o.beforeDraw);
      if (list === undefined) map.set(o.beforeDraw, [o]);
      else list.push(o);
    }
    return map;
  };
  const opsByDraw = groupByDraw(device.ops.slice(recorder.setupOps));
  const setupOpsByDraw = groupByDraw(device.ops.slice(0, recorder.setupOps));
  const indexData = drawIndexed !== null ? (r.modelIndices ?? src.numbers("indices")) : null;
  const pipelineMap = recorder.draws.some((d) => d.pipeline !== null) ? pipelines(r) : new Map<string, PipelineInfo>();
  if (recorder.draws.length > 0) {
    for (let di = 0; di < recorder.draws.length; di++) {
      const d = recorder.draws[di]!;
      const setupOps = setupOpsByDraw.get(di);
      if (setupOps !== undefined) addDeviceOps(r, setupOps, device);
      if (di === recorder.setupDraws && di > 0) {
        // The setup's draws and ops end here (the ops after its last draw came just above).
        for (const [, late] of [...setupOpsByDraw].filter(([k]) => k > di).sort(([a], [b]) => a - b)) addDeviceOps(r, late, device);
        scene.setupDraws = scene.draws.length;
        scene.setupOps = scene.ops.length;
      }
      const ops = opsByDraw.get(di);
      if (ops !== undefined) addDeviceOps(r, ops, device);
      // With several pipelines, the draw uses the one bound before it.
      let pl: PipelineInfo | null = d.pipeline !== null && pipelineMap.size > 1 ? (pipelineMap.get(d.pipeline) ?? null) : null;
      // Pipelines the reading of the code cannot follow (kept in a map): the one the device saw bound.
      if (pl === null && (created.size === 0 || device.createdPipelines.size > created.size) && d.state instanceof DrawState && d.state.pipeline !== null)
        pl = runtimePipeline(r, device, d.state.pipeline);
      // One pipeline: its own state (a helper's parameters: createPipeline(…, VK_PRIMITIVE_TOPOLOGY_POINT_LIST, …)).
      const one = pl === null ? only : null;
      const dvs = pl?.vs ?? vs;
      const dfs = pl?.fs ?? fs;
      let dVertices = vertices;
      let dIndices: number[] | null = d.indexed && indexData !== null ? skipTake(indexData, d.first, d.count).map((x) => toInt(x)) : null;
      let perInstance: VertexMap[] | null = null;
      const ds = d.state instanceof DrawState ? d.state : null;
      if (deviceVerticesUsed && ds !== null && ds.vertexBuffers.size > 0) {
        const ib = ds.indexBuffer;
        if (d.indexed && ib !== null)
          dIndices = Array.from({ length: Math.max(0, d.count) }, (_, k) => toInt(device.readIndex(ib.buffer, ib.offset + (d.first + k) * ib.bytes) ?? 0));
        // Only the vertices the indices reach (a strip of a large grid), the indices counted from the lowest.
        const baseVertex = d.indexed && dIndices !== null && dIndices.length > 0 && !dvs.names.has("gl_VertexIndex") ? minOf(dIndices) : 0;
        if (baseVertex > 0) for (let k = 0; k < dIndices!.length; k++) dIndices![k] = dIndices![k]! - baseVertex;
        const vertexCount = d.indexed ? (dIndices !== null && dIndices.length > 0 ? maxOf(dIndices) + 1 : 0) : d.first + d.count;
        [dVertices, perInstance] = deviceVertices(r, device, ds, vertexCount, Math.max(1, d.instances), baseVertex);
      } else if (pl !== null) {
        const dInputs = dvs.globals.filter((g) => g.storage === "in");
        dVertices = [];
        if (dInputs.length > 0 && !vertexData(r, dInputs, dVertices)) continue;
      }
      r.deviceTextureSizes = null;
      const owner = pl ?? only;
      const [devTextures, deviceCubes] = ds !== null
        ? deviceTextures(r, device, ds, PipelineInfo.merged(dvs, owner?.tcs ?? null, owner?.tes ?? null, pl !== null ? pl.gs : (only?.gs ?? null)), dfs) : [null, null];
      const textureSizes = devTextures === null ? null : r.deviceTextureSizes;
      const target = device.targetOf(ds?.framebuffer);
      if (target !== null) registerTarget(r, device, target);
      const values = new Map(buffer);
      for (const [k, v] of d.constants) values.set(k, v);
      const fixed = pl?.state ?? one?.state ?? pipeState;
      scene.draws.push(new DrawCall({
        vertexShader: dvs,
        fragmentShader: dfs,
        geometryShader: pl !== null ? pl.gs : (only?.gs ?? null),
        tessControlShader: owner?.tes != null ? owner.tcs : null,
        tessEvalShader: owner?.tes ?? null,
        patchVertices: owner?.patchPoints ?? 3,
        matchByLocation: true,
        vertices: dVertices,
        indices: dIndices,
        instanceVertices: perInstance,
        target,
        cubeTextures: deviceCubes,
        cubeTexturesLod: devTextures === null ? null : r.deviceCubeLod,
        textureImages: textureSizes,
        first: d.indexed ? 0 : d.first,
        count: d.count,
        instances: Math.max(1, d.instances),
        topology: pl?.topology ?? one?.topology ?? topology,
        uniforms: () => values,
        cull: pl?.cull ?? one?.cull ?? cullMode,
        frontCcw: pl?.frontCcw ?? one?.frontCcw ?? frontCcw,
        wireframe: pl?.wireframe ?? one?.wireframe ?? wireframe,
        depthTest: pl?.depthTest ?? one?.depthTest ?? depthTest,
        depthFunc: fixed.depthFunc,
        depthWrite: fixed.depthWrite,
        stencil: fixed.stencil !== null ? fixed.stencil.with({ ref: d.stencilRef ?? fixed.stencil.ref }) : null,
        blend: fixed.blend,
        attachmentBlends: fixed.attachments,
        textures: devTextures ?? perDrawTextures(r, dvs, dfs, d.bound) ?? (pl === null ? textures : (texturesOf(r, dvs, dfs) ?? textures)),
      }));
    }
    if (recorder.setupDraws > 0 && recorder.setupDraws >= recorder.draws.length) {
      // Nothing but the setup was drawn: its last ops, and the frame's ops after them.
      const tail = setupOpsByDraw.get(recorder.draws.length);
      if (tail !== undefined) addDeviceOps(r, tail, device);
      scene.setupDraws = scene.draws.length;
      scene.setupOps = scene.ops.length;
    }
    const lastOps = opsByDraw.get(recorder.draws.length);
    if (lastOps !== undefined) addDeviceOps(r, lastOps, device);
    if (recorder.draws.some((d) => d.state instanceof DrawState && d.state.sets.size > 0 && device.hasSet(d.state.sets.get(0) ?? "")))
      removeAll(scene.notes, (n) => n.key === "tooFewTextures" || n.key === "vkNoImageCopy");
    if (recorder.runner.usedTime) scene.animated = true;
    return;
  }
  scene.draws.push(new DrawCall({
    vertexShader: vs,
    fragmentShader: fs,
    matchByLocation: true,
    vertices,
    indices,
    first,
    count: indices?.length ?? count,
    instances: Math.max(1, instances),
    topology,
    uniforms,
    cull: cullMode,
    frontCcw,
    wireframe,
    depthTest,
    depthFunc: pipeState.depthFunc,
    depthWrite: pipeState.depthWrite,
    stencil: pipeState.stencil,
    blend: pipeState.blend,
    textures,
  }));
  for (const d of scene.draws) d.uniforms(1.0);
  if (src.usedTime) scene.animated = true;
}

function minOf(list: readonly number[]): number {
  let m = list[0]!;
  for (const x of list) if (x < m) m = x;
  return m;
}

function maxOf(list: readonly number[]): number {
  let m = list[0]!;
  for (const x of list) if (x > m) m = x;
  return m;
}

/** List.RemoveAll. */
function removeAll<T>(list: T[], match: (item: T) => boolean): void {
  let j = 0;
  for (const item of list) if (!match(item)) list[j++] = item;
  list.length = j;
}

/**
 * Textures: each sampler2D (by binding) reads the next image loaded with stbi_load. It takes the whole chain of the
 * tutorial: a texture image filled from a staging buffer, an image view, a sampler and a descriptor set bound when
 * drawing; without one of them the shader reads nothing (black) and the validation layer complains. (C#'s Textures.)
 */
function texturesOf(r: VulkanReader, vs: ShaderProgram, fs: ShaderProgram): TextureLookup | null {
  const src = r.src, scene = r.scene;
  const names = TextureBinding.shaderTextures(vs, fs);
  if (names.length === 0) return null;
  const missing = ([
    ["vkCreateDescriptorSetLayout", "vkNoDescriptorSetLayout"],
    ["vkUpdateDescriptorSets", "vkNoDescriptorWrite"],
    ["vkCmdBindDescriptorSets", "vkNoDescriptorBind"],
    ["vkCreateSampler", "vkNoSampler"],
    ["vkCmdCopyBufferToImage", "vkNoImageCopy"],
  ] as const).find(([c]) => !src.hasCall(c));
  if (missing !== undefined) {
    scene.notes.push(SimNote.error(missing[1], ["name", names[0]!]));
    return () => [0, 0, 0, 1];
  }
  if (!src.hasCall("vkCmdPipelineBarrier")) scene.notes.push(SimNote.error("vkNoLayoutTransition"));
  const images = StbImage.inLoadOrder(src, r.project, scene);
  if (images.length < names.length) scene.notes.push(SimNote.warning("tooFewTextures", ["count", String(names.length)], ["loaded", String(images.length)]));
  // Each vkCreateSampler(…, &name) takes the sampler fields set before it; each binding gets the sampler of the
  // image info its descriptor write points to (info.sampler = name; descriptorWrites[i].pImageInfo = &info).
  const samplers = samplersOf(r);
  // GroupBy(…).ToDictionary(…, Last): the last value of each key, the keys in first-seen order.
  const infoSampler = new Map<string, string>();
  for (const m of matchesAll(/(\w+)\s*\.\s*sampler\s*=\s*(\w+)/g, src.code)) infoSampler.set(m[1]!, m[2]!);
  const writeInfo = new Map<string, string>();
  for (const m of matchesAll(/descriptorWrites\s*\[\s*(\d+)\s*\]\s*\.\s*pImageInfo\s*=\s*&\s*(\w+)/g, src.code)) writeInfo.set(m[1]!, m[2]!);
  const writeBinding = new Map<string, number>();
  for (const m of matchesAll(/descriptorWrites\s*\[\s*(\d+)\s*\]\s*\.\s*dstBinding\s*=\s*(\d+)/g, src.code)) writeBinding.set(m[1]!, parseInt32(m[2]!));
  const bindingOf = new Map<string, number>();
  for (const g of [...vs.globals, ...fs.globals]) if (names.includes(g.id) && !bindingOf.has(g.id)) bindingOf.set(g.id, g.binding ?? 0);
  const fallback = samplers.values().next().value ?? SamplerState.Default;
  return TextureBinding.bind(names, images, (texture) => {
    const wanted = bindingOf.get(texture) ?? 0;
    const write = [...writeBinding].find(([, b]) => b === wanted)?.[0];
    const info = write !== undefined ? writeInfo.get(write) : undefined;
    const samplerName = info !== undefined ? infoSampler.get(info) : undefined;
    const state = samplerName !== undefined ? samplers.get(samplerName) : undefined;
    return state ?? fallback;
  });
}

/**
 * Each vkCreateSampler(…, &amp;name) with the sampler fields set before it – also in a helper called once per sampler,
 * createTextureSampler(VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, transparentSampler), with the call's arguments.
 */
function samplersOf(r: VulkanReader): Map<string, SamplerState> {
  const src = r.src;
  const samplers = new Map<string, SamplerState>();
  for (const create of src.calls("vkCreateSampler")) {
    const name = trimNet(trimChars(trimNet(create.arg(3)), "&", true, false));
    const fn = src.functionAt(create.offset);
    const params = fn === null ? [] : parameters(r, fn);
    if (fn !== null && params.includes(name)) {
      const { start } = src.functions.get(fn)!;
      for (const call of src.calls(fn)) {
        const sub = (x: string): string => {
          const i = params.indexOf(trimNet(x));
          return i >= 0 ? trimNet(call.arg(i)) : x;
        };
        const callName = trimNet(trimChars(sub(name), "&", true, false));
        samplers.set(callName, TextureBinding.fromFields((f) => {
          const values = src.fieldAssignments(f).filter((a) => a.offset >= start && a.offset < create.offset).map((a) => sub(a.value));
          return values[values.length - 1] ?? null;
        }, false));
      }
      continue;
    }
    samplers.set(name, TextureBinding.fromFields((f) => src.fieldValueBefore(f, create.offset), false));
  }
  return samplers;
}

/**
 * The textures of one draw when its descriptor set (bound with vkCmdBindDescriptorSets) was written by a helper
 * with a view made by a texture-loading helper (see DrawTextures); null otherwise.
 */
function perDrawTextures(r: VulkanReader, vs: ShaderProgram, fs: ShaderProgram, bound: ReadonlyMap<number, string> | null): TextureLookup | null {
  const setText = bound?.get(0);
  if (setText === undefined) return null;
  r.drawTextures ??= new DrawTextures(r.src, r.project);
  if (!r.drawTextures.any) return null;
  const samplers = samplersOf(r);
  const set = r.drawTextures.vulkanSet(setText, (n) => samplers.get(n) ?? null);
  if (set === null) return null;
  const bindingOf = new Map<string, number>();
  for (const g of [...vs.globals, ...fs.globals]) if (g.type.startsWith("sampler") && !bindingOf.has(g.id)) bindingOf.set(g.id, g.binding ?? 0);
  const textures = new Map<string, Texture>();
  for (const [name, binding] of bindingOf) {
    const t = set.get(binding);
    if (t !== undefined) textures.set(name, new Texture(t.image, t.sampler, { components: t.image.channels === 4 ? 4 : 3 }));
  }
  return (id, u, v) => textures.get(id.split("|")[0]!)?.sample(u, v) ?? [0, 0, 0, 1];
}

/** The functions that fill a uniform buffer struct (updateUniformBuffer): they declare a variable of a block's type. */
function updateFunctions(r: VulkanReader, blocks: readonly A.Global[]): string[] {
  const src = r.src;
  const list: string[] = [];
  for (const b of blocks.filter((b) => !b.pushConstant)) {
    const re = new RegExp(String.raw`\b` + escapeRegex(b.type) + String.raw`\s+\w+\s*[{=;]`);
    for (const f of src.functions.keys()) {
      const body = src.functionBody(f);
      if (body !== null && re.test(body)) list.push(f);
    }
  }
  return [...new Set(list)];
}

/** The shader loaded from "shaders/vert.spv" is the one built from the project's .vert file. */
function shader(r: VulkanReader, extension: string, spvHint: string): ShaderProgram | null {
  const src = r.src;
  // readFile("shaders/vert.spv"), or a helper called with the file names: createPipeline("shaders/lighting.vert.spv", …).
  const loaded = src.hasCall("readFile") && new RegExp('"[^"\\n]*' + escapeRegex(spvHint) + '[^"\\n]*\\.spv"').test(src.code);
  const file = [...r.project.files.keys()].find((k) => k.endsWith(extension));
  if (!loaded || file === undefined) {
    r.scene.notes.push(SimNote.error("vkShaderNotLoaded", ["file", `shaders/${spvHint}.spv`]));
    return null;
  }
  try {
    return ShaderParser.parseProgram(r.project.files.get(file)!);
  } catch (e) {
    if (!(e instanceof ShaderSyntaxException)) throw e;
    return null; // The build already reported it.
  }
}

/** The vertices: std::vector&lt;Vertex&gt; vertices = { … } mapped to locations by getAttributeDescriptions. */
function vertexData(r: VulkanReader, inputs: A.Global[], into: VertexMap[]): boolean {
  const src = r.src, scene = r.scene;
  if (!src.hasCall("vkCmdBindVertexBuffers") || !/vertexBindingDescriptionCount\s*=\s*[^0\s;]/.test(src.code)) {
    scene.notes.push(SimNote.error("vkNoVertexInput", ["name", inputs[0]!.id], ["location", String(inputs[0]!.location ?? 0)]));
    return false;
  }
  const type = src.declaredType("vertices") ?? "";
  const structName = /<\s*(\w+)\s*>/.exec(type)?.[1] ?? "";
  const fields = structName === "" ? null : StructLayout.fields(src, structName);
  if (fields !== null && src.hasCall("LoadObj")) {
    if (!modelVertices(r, fields, into)) return false;
    // indices.size() and vertices.size() are the loaded model's.
    const vertexCount = into.length;
    // (Only when the program does not give them a value itself: the SSAO chapter's own room vertices.)
    src.extra = (name) => {
      if (name === "indices" && src.initializer("indices") === null) return ShaderValue.array(r.modelIndices!.map((x) => ShaderValue.scalar(x)));
      if (name === "vertices" && src.initializer("vertices") === null) return ShaderValue.array(Array.from({ length: vertexCount }, () => ShaderValue.scalar(0)));
      return null;
    };
    return true;
  }
  const init = src.initializer("vertices");
  if (fields === null || init === null) {
    scene.notes.push(SimNote.error("vkNoVertexInput", ["name", inputs[0]!.id], ["location", String(inputs[0]!.location ?? 0)]));
    return false;
  }
  // location → field, from attributeDescriptions[i].location = L; attributeDescriptions[i].offset = offsetof(Vertex, field);
  const locationOf = new Map<string, number>();
  const locs = attributeLocations(r);
  for (const m of matchesAll(/attributeDescriptions\s*\[\s*(\d+)\s*\]\s*\.\s*offset\s*=\s*offsetof\s*\(\s*\w+\s*,\s*(\w+)\s*\)/g, src.code)) {
    const loc = locs.get(m[1]!);
    if (loc !== undefined) locationOf.set(m[2]!, loc);
  }
  const arraySize = /std::array\s*<\s*VkVertexInputAttributeDescription\s*,\s*(\d+)\s*>/.exec(src.code);
  const described = arraySize !== null ? parseInt32(arraySize[1]!) : locs.size;
  const locationValues = new Set(locationOf.values());
  for (const input of inputs) {
    const loc = input.location ?? 0;
    const provided = locs.size > 0 ? locationValues.has(loc) && loc < Math.max(described, 1) : loc < fields.length;
    if (!provided) scene.notes.push(SimNote.error("vkAttributeMissing", ["name", input.id], ["location", String(loc)]));
  }
  const value = src.evaluate(init);
  if (value === null || (value.items === null && value.v === null)) return false;
  const items = value.items ?? [value];
  for (const item of items) {
    const nums: number[] = [];
    flatten(item, nums);
    const dict: VertexMap = new Map();
    let at = 0;
    for (let f = 0; f < fields.length; f++) {
      const { name, floats } = fields[f]!;
      const comps = nums.slice(at, at + Math.max(0, floats));
      at += floats;
      const loc = locationOf.get(name) ?? f;
      if (locs.size === 0 || locationOf.has(name)) dict.set(String(loc), ShaderValue.vecOf(comps));
    }
    into.push(dict);
  }
  return true;
}

/** attributeDescriptions[i].location = L: i → L (the last assignment of each i, the i in first-seen order). */
function attributeLocations(r: VulkanReader): Map<string, number> {
  const locs = new Map<string, number>();
  for (const m of matchesAll(/attributeDescriptions\s*\[\s*(\d+)\s*\]\s*\.\s*location\s*=\s*(\d+)/g, r.src.code)) locs.set(m[1]!, parseInt32(m[2]!));
  return locs;
}

/**
 * vulkan-tutorial's loadModel: tinyobj::LoadObj fills vertices and indices – positions, texCoord with v flipped
 * (1 - v), colour white, a normal when the Vertex struct has one, and a material index (shapes' material_ids) in a
 * field named like materialIndex / texIndex – for every mesh of the file.
 */
function modelVertices(r: VulkanReader, fields: StructField[], into: VertexMap[]): boolean {
  const src = r.src;
  const path = ModelFiles.path(src);
  const model = path === null ? null : ObjModel.load(r.project, path);
  if (model === null) {
    r.scene.notes.push(SimNote.error("modelFileMissing", ["file", path ?? "?"]));
    return false;
  }
  const locs = attributeLocations(r);
  const locationOf = new Map<string, number>();
  for (const m of matchesAll(/attributeDescriptions\s*\[\s*(\d+)\s*\]\s*\.\s*offset\s*=\s*offsetof\s*\(\s*\w+\s*,\s*(\w+)\s*\)/g, src.code)) {
    const loc = locs.get(m[1]!);
    if (loc !== undefined) locationOf.set(m[2]!, loc);
  }
  r.modelIndices = [];
  for (const mesh of model.meshes) {
    const baseVertex = into.length;
    for (let i = 0; i < mesh.positions.length; i++) {
      const dict: VertexMap = new Map();
      for (let f = 0; f < fields.length; f++) {
        const name = fields[f]!.name;
        const lower = name.toLowerCase();
        const value = lower.includes("material") || lower.includes("index") ? ShaderValue.scalar(mesh.material?.index ?? -1)
          : lower.includes("pos") ? ShaderValue.vecOf(mesh.positions[i]!)
          : lower.includes("tex") || lower.includes("uv") ? ShaderValue.vec(mesh.texCoords[i]![0]!, 1 - mesh.texCoords[i]![1]!)
          : lower.includes("normal") ? ShaderValue.vecOf(mesh.normals[i]!)
          : ShaderValue.vec(1, 1, 1);
        dict.set(String(locationOf.get(name) ?? f), value);
      }
      into.push(dict);
    }
    for (const x of mesh.indices) r.modelIndices.push(x + baseVertex);
  }
  return true;
}

function flatten(v: ShaderValue, into: number[]): void {
  if (v.v !== null) into.push(...v.v);
  else if (v.packed !== null) for (const x of v.packed) into.push(x);
  else {
    const items = v.items;
    if (items !== null) for (const i of items) flatten(i, into);
  }
}

/**
 * Push constants: the shader's layout(push_constant) block type matches a C++ struct of the same name; the
 * fields assigned to a variable of that type (pc.color = glm::vec4(…)) are the values, at any time.
 */
function pushConstants(r: VulkanReader, vs: ShaderProgram, fs: ShaderProgram): (time: number) => Map<string, ShaderValue> {
  const src = r.src, scene = r.scene;
  const block = [...vs.globals, ...fs.globals].find((g) => g.pushConstant && g.block !== null);
  if (block === undefined) return () => new Map();
  if (!src.hasCall("vkCmdPushConstants")) {
    scene.notes.push(SimNote.warning("vkPushConstantsNotPushed", ["type", block.type]));
    return () => new Map();
  }
  if (!/pushConstantRangeCount\s*=\s*[1-9]/.test(src.code))
    scene.notes.push(SimNote.error("vkNoPushConstantRange"));
  const variables = new Set(matchesAll(new RegExp(String.raw`\b` + escapeRegex(block.type) + String.raw`\s+(\w+)\s*(?:\{[^;]*\}|=[^;]*)?\s*;`, "g"), src.code).map((m) => m[1]!));
  const assignments: { field: string; expr: string }[] = [];
  for (const field of block.block!)
    for (const a of src.fieldAssignments(field.id))
      if (variables.has(a.target)) assignments.push({ field: field.id, expr: a.value });
  return (t) => {
    const d = new Map<string, ShaderValue>();
    for (const { field, expr } of assignments) {
      const v = src.evaluate(expr, t);
      if (v !== null) d.set(field, v);
    }
    return d;
  };
}
