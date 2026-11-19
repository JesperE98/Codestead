// D3D12Reader.Draw.cs: a part of the C# partial class D3D12Reader, as functions that take the reader (its fields are
// declared in D3D12Reader.ts).
//
// The draw call: shaders compiled with D3DCompileFromFile, the input layout, the vertex and index data copied into
// upload buffers, the rasterizer state of the pipeline state object, root constants and the Draw*Instanced call.
import { VulkanReader } from "./VulkanReader.js";
import { isDigit, parseInt32, toInt, trimChars, trimNet } from "../internal/dotnet.js";
import { escapeRegex, matchesAll } from "../internal/regex.js";
import { GltfModel } from "../Models/GltfModel.js";
import { ModelFiles } from "../Models/ModelFiles.js";
import { ObjModel } from "../Models/ObjModel.js";
import { CullMode } from "../Scene/CullMode.js";
import { DrawCall, type VertexData } from "../Scene/DrawCall.js";
import { ClearOp, CopyOp, type FrameOp } from "../Scene/FrameOp.js";
import { RenderTarget } from "../Scene/RenderTarget.js";
import { SimNote } from "../Scene/SimNote.js";
import { Topology } from "../Scene/Topology.js";
import type * as A from "../Shading/ShaderAst.js";
import { ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import type { CubeTexture } from "../Textures/CubeTexture.js";
import { SamplerState } from "../Textures/SamplerState.js";
import { Texture } from "../Textures/Texture.js";
import type { CppCall } from "./CppCall.js";
import { CppSource } from "./CppSource.js";
import { D3D12Device, DrawState } from "./D3D12Device.js";
import { pipelines, runtimePso, stateField, usesGeometry, usesStage, type Stage } from "./D3D12Reader.Pipelines.js";
import type { D3D12Reader } from "./D3D12Reader.js";
import { DrawTextures } from "./DrawTextures.js";
import { FrameRecorder, type RecordedDraw } from "./FrameRecorder.js";
import { GameFrames } from "./GameFrames.js";
import { GlReader } from "./GlReader.js";
import { PipelineInfo } from "./PipelineInfo.js";
import { PipelineState } from "./PipelineState.js";
import { StbImage } from "./StbImage.js";
import { StructLayout } from "./StructLayout.js";
import { TextureBinding } from "./TextureBinding.js";

type TextureLookup = (name: string, u: number, v: number) => number[];
type CubeLookup = (name: string, x: number, y: number, z: number) => number[] | null;

/** An element of an input layout: (semantic, input slot, byte offset, floats, per instance, step rate). */
interface LayoutElement {
  readonly semantic: string;
  readonly slot: number;
  readonly offset: number;
  readonly comps: number;
  readonly instance: boolean;
  readonly step: number;
}

/** LINQ's Skip(s).Take(n) (a negative count takes nothing, a negative skip skips nothing). */
function skipTake<T>(list: readonly T[], skip: number, take: number): T[] {
  const s = Math.max(0, skip);
  return list.slice(s, s + Math.max(0, take));
}

/** GroupBy(o => o.BeforeDraw).ToDictionary(…): the ops by the draw they come before, in first-seen order. */
function byDraw(ops: readonly FrameOp[]): Map<number, FrameOp[]> {
  const map = new Map<number, FrameOp[]>();
  for (const o of ops) {
    const list = map.get(o.beforeDraw);
    if (list === undefined) map.set(o.beforeDraw, [o]);
    else list.push(o);
  }
  return map;
}

/** Register numbers of the named globals: GroupBy(g => g.Id).ToDictionary(g => g.Key, g => g.First().Binding ?? 0). */
function registersOf(globals: readonly A.Global[], names: readonly string[]): Map<string, number> {
  const registers = new Map<string, number>();
  for (const g of globals) if (names.includes(g.id) && !registers.has(g.id)) registers.set(g.id, g.binding ?? 0);
  return registers;
}

/** The smallest value, or 0 for none (DefaultIfEmpty(0).Min()). */
const minOr0 = (values: Iterable<number>): number => {
  const list = [...values];
  return list.length === 0 ? 0 : Math.min(...list);
};

export function draw(r: D3D12Reader): void {
  const src = r.src, scene = r.scene, project = r.project, time = r.time;
  // The draws the command list records (PopulateCommandList) come first: a Mesh::Draw elsewhere is called from there.
  // Recorded: in PopulateCommandList or a helper it calls (learnopengl's renderScene as RenderScene()).
  const recording = new Set<string>(["PopulateCommandList"]);
  for (const queue = [...recording]; queue.length > 0;) {
    const fn = queue.shift()!;
    for (const other of src.functions.keys())
      if (!recording.has(other) && src.callsFunction(fn, other)) {
        recording.add(other);
        queue.push(other);
      }
  }
  const recorded = (c: CppCall): boolean => {
    const at = src.functionAt(c.offset);
    return at !== null && recording.has(at);
  };
  const draws = src.calls(".DrawInstanced");
  const indexedDraws = src.calls(".DrawIndexedInstanced");
  // A Model (learnopengl's Model class ported): m_model.Draw(m_commandList.Get()) draws its meshes.
  // (Through a member or a pointer too: entity.pModel->Draw(commandList) – the member's declared type.)
  const modelDraw = src.calls(".Draw").find((c) => recorded(c) && c.target !== null
    && (src.declaredType(/(\w+)\s*(?:\[[^\]]*\])?\s*$/.exec(c.target)?.[1] ?? "") ?? "").includes("Model")) ?? null;
  // With a PopulateCommandList, only what it records is drawn (a Mesh::Draw nobody calls yet draws nothing).
  const recordsHere = src.functions.has("PopulateCommandList");
  const drawCall = draws.find(recorded) ?? (modelDraw === null && !recordsHere ? (draws[0] ?? null) : null);
  const drawIndexed = indexedDraws.find(recorded) ?? (modelDraw === null && !recordsHere ? (indexedDraws[0] ?? null) : null);
  const call = drawIndexed ?? drawCall ?? modelDraw;
  if (call === null) return;
  const modelOnly = call === modelDraw;
  if (!r.has("CreateGraphicsPipelineState")) {
    scene.notes.push(SimNote.error("dxNoPso", ["call", call.name]));
    return;
  }
  if (!r.has("SetGraphicsRootSignature")) {
    scene.notes.push(SimNote.error("dxNoRootSignature", ["call", call.name]));
    return;
  }
  if (!r.has("RSSetViewports") || !r.has("RSSetScissorRects")) {
    scene.notes.push(SimNote.warning("dxNoViewport"));
    return;
  }
  const vsInfo = compile(r, "vs_");
  const psInfo = compile(r, "ps_");
  if (vsInfo === null || psInfo === null) return;
  const { program: vs, entry: vsEntry } = vsInfo;
  const { program: ps, entry: psEntry } = psInfo;
  const gsInfo = usesGeometry(r, Number.MAX_SAFE_INTEGER) ? compile(r, "gs_") : null;
  // Tessellation: a hull and a domain shader in the description (psoDesc.HS / DS set to bytecode).
  const hsInfo = usesStage(r, "HS", Number.MAX_SAFE_INTEGER) ? compile(r, "hs_") : null;
  const dsInfo = hsInfo !== null && usesStage(r, "DS", Number.MAX_SAFE_INTEGER) ? compile(r, "ds_") : null;

  const vertices: VertexData[] = [];
  const entry = vs.findFunction(vsEntry);
  const needsInput = entry !== null && entry.params.some((p) => (p.semantic !== null && p.semantic.slice(0, 3).toUpperCase() !== "SV_")
    || vs.findStruct(p.type) !== null);
  // The vertex data: from the vertex buffer views the command list sets (the device model), else from the array
  // copied into the vertex buffer (the earlier chapters' single buffer).
  const notesBefore = scene.notes.length;
  const staticVertices = !needsInput || modelOnly || vertexData(r, vertices);

  let indices: number[] | null = null;
  let first = 0, count: number, instances: number;
  let missingIndices = false;
  if (modelOnly) {
    count = 0;
    instances = 1;
  } else if (call === drawIndexed) {
    // Without an index array copied into a buffer here, the device model may still find the indices (a
    // mesh's index buffer view): only an error if it does not.
    missingIndices = !r.has("IASetIndexBuffer") || indexData(r) === null;
    count = src.int(call.arg(0)) ?? 0;
    instances = src.int(call.arg(1)) ?? 1;
    const start = src.int(call.arg(2)) ?? 0;
    indices = skipTake(indexData(r) ?? [], start, count).map((d) => toInt(d));
  } else {
    count = src.int(call.arg(0)) ?? 0;
    instances = src.int(call.arg(1)) ?? 1;
    first = src.int(call.arg(2)) ?? 0;
  }

  const topology = src.calls(".IASetPrimitiveTopology")[0]?.arg(0) ?? null;
  if (topology === null) {
    scene.notes.push(SimNote.warning("dxNoTopology"));
    return;
  }
  // The rasterizer state: CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT) culls back faces, front = clockwise.
  const cull = src.lastFieldValue("CullMode") ?? "D3D12_CULL_MODE_BACK";
  const fill = src.lastFieldValue("FillMode") ?? "D3D12_FILL_MODE_SOLID";
  const frontCcwValue = src.lastFieldValue("FrontCounterClockwise");
  const frontCcw = frontCcwValue !== null && (src.int(frontCcwValue) ?? 0) !== 0;
  const depth = depthEnabled(r, Number.MAX_SAFE_INTEGER);
  const state = PipelineState.d3d12((f) => stateField(r, f, Number.MAX_SAFE_INTEGER), (f) => {
    const v = stateField(r, f, Number.MAX_SAFE_INTEGER);
    return v !== null ? src.int(v) : null;
  });

  const textures = modelOnly ? null : texturesOf(r, vs, ps);
  const cullMode = cull.includes("NONE") ? CullMode.None : cull.includes("FRONT") ? CullMode.Front : CullMode.Back;
  const topo = topologyOf(topology);

  // Run the frame: OnUpdate and the recorded command list (each draw with the root constants set before it).
  const blocks = VulkanReader.allShaderBlocks(project, [".hlsl"], vs, ps);
  const device = new D3D12Device(src, project);
  const recorder = new FrameRecorder(src, time, scene, blocks, true, device, project);
  recorder.setup();
  if (device.windowSrgb) scene.windowSrgb = true;
  // A game: the frames before the shown one (OnUpdate with the frame's input, without drawing).
  GameFrames.runWin32(src, recorder, time);
  for (const fn of ["OnUpdate"].filter((f) => src.functions.has(f))) recorder.run(fn);
  // The command list is recorded in PopulateCommandList (draws may sit in a helper it calls).
  // A program that reads the debug layer's info queue after ExecuteCommandLists (learnopengl's "Debugging"): the
  // whole OnRender, so the check after the frame's commands runs too.
  const onRender = src.uses("GetNumStoredMessages") ? src.functionBody("OnRender") : null;
  const wholeRender = onRender !== null && onRender.includes("PopulateCommandList");
  const recordFn = wholeRender ? "OnRender" : src.functions.has("PopulateCommandList") ? "PopulateCommandList" : src.functionAt(call.offset);
  if (recordFn !== null) recorder.run(recordFn);
  const buffer = recorder.bufferContents();
  const stateOf = (d: RecordedDraw): DrawState | null => (d.state instanceof DrawState ? d.state : null);
  const deviceVertices = needsInput && !modelOnly && recorder.draws.some((d) => {
    const st = stateOf(d);
    return st !== null && st.vertexBuffers.size > 0 && device.read(st.vertexBuffers.values().next().value!.address, 0, 1) !== null;
  });
  if (missingIndices && !(deviceVertices && recorder.draws.some((d) => d.indexed && stateOf(d)?.indexBuffer != null))) {
    scene.notes.push(SimNote.error("dxNoIndexBuffer"));
    return;
  }
  if (!staticVertices && !deviceVertices) return;
  if (deviceVertices) scene.notes.splice(notesBefore, scene.notes.length - notesBefore);
  const indexDataList = drawIndexed !== null && !deviceVertices ? indexData(r) : null;
  const layouts = deviceVertices ? inputLayouts(r) : [];
  // Render targets the frame draws into, clears and resolves (the device model's ops, by recorded draw).
  // The ops recorded during the setup (the first SetupOps) belong to the setup draws; the others to the frame.
  const opsByDraw = byDraw(device.ops.slice(recorder.setupOps));
  const setupOpsByDraw = byDraw(device.ops.slice(0, recorder.setupOps));
  const pipelineMap = recorder.draws.some((d) => d.pipeline !== null) ? pipelines(r) : new Map<string, PipelineInfo>();
  if (recorder.draws.length > 0) {
    const fallback = constants(r, vs, ps);
    for (let di = 0; di < recorder.draws.length; di++) {
      const d = recorder.draws[di]!;
      const setupOps = setupOpsByDraw.get(di);
      if (setupOps !== undefined) addOps(r, setupOps, device);
      if (di === recorder.setupDraws && di > 0) {
        // The setup's draws and ops end here (the ops after its last draw came just above).
        for (const [, late] of [...setupOpsByDraw].filter(([k]) => k > di).sort(([a], [b]) => a - b)) addOps(r, late, device);
        [scene.setupDraws, scene.setupOps] = [scene.draws.length, scene.ops.length];
      }
      const ops = opsByDraw.get(di);
      if (ops !== undefined) addOps(r, ops, device);
      const ds = stateOf(d);
      // Descriptor tables set while the command list had no descriptor heap: the draw sees no constants and
      // no textures – nothing of it shows (the debug layer's message #708).
      if (ds !== null && ds.noHeap) continue;
      // With several pipeline state objects, the draw uses the one set before it.
      let pl = d.pipeline !== null && pipelineMap.size > 1 ? (pipelineMap.get(d.pipeline) ?? null) : null;
      // PSOs the reading of the code cannot follow (a map of shaders, a Compile helper): the one the device saw set.
      if (pl === null && device.createdPsos.size > Math.max(1, pipelineMap.size) && ds !== null && ds.pso !== null)
        pl = runtimePso(r, device, ds.pso);
      if (d.model) {
        const mValues = new Map(fallback(time));
        for (const [k, v] of buffer) mValues.set(k, v);
        for (const [k, v] of d.constants) mValues.set(k, v);
        rootCbvValues(r, device, d, blocks, mValues);
        // The model's meshes go where the command list draws now (an off-screen G-buffer too).
        const modelTarget = ds?.target ?? null;
        if (modelTarget !== null) registerTarget(r, device, modelTarget);
        modelDraws(r, pl?.vs ?? vs, pl?.fs ?? ps, pl?.vsEntry ?? vsEntry, pl?.fsEntry ?? psEntry, mValues, pl?.cull ?? cullMode, pl?.frontCcw ?? frontCcw, pl?.depthTest ?? depth,
          pl !== null ? pl.gs : (gsInfo?.program ?? null), pl !== null ? pl.gsEntry : (gsInfo?.entry ?? "main"), d, modelTarget);
        continue;
      }
      const values = new Map(fallback(time));
      for (const [k, v] of buffer) values.set(k, v);
      for (const [k, v] of d.constants) values.set(k, v);
      rootCbvValues(r, device, d, blocks, values);
      const dvs = pl?.vs ?? vs;
      const dps = pl?.fs ?? ps;
      let dVertices = vertices;
      let dIndices: number[] | null = d.indexed && indexDataList !== null ? skipTake(indexDataList, d.first, d.count).map((x) => toInt(x)) : null;
      let perInstance: VertexData[] | null = null;
      let stepRate = 1;
      if (deviceVertices && ds !== null) {
        const ib = ds.indexBuffer;
        if (d.indexed && ib !== null)
          dIndices = Array.from({ length: Math.max(0, d.count) }, (_, k) => toInt(device.readIndex(ib.address, (d.first + k) * ib.bytes, ib.bytes) ?? 0));
        // Only the vertices the indices reach (a strip of a large grid), the indices counted from the lowest.
        const baseVertex = d.indexed && dIndices !== null && dIndices.length > 0 && !dvs.names.has("SV_VertexID") ? Math.min(...dIndices) : 0;
        if (baseVertex > 0) for (let k = 0; k < dIndices!.length; k++) dIndices![k]! -= baseVertex;
        const vertexCount = d.indexed ? (dIndices !== null && dIndices.length > 0 ? Math.max(...dIndices) + 1 : 0) : d.first + d.count;
        [dVertices, perInstance, stepRate] = deviceVerticesOf(device, ds, chooseLayout(layouts, dvs, pl?.vsEntry ?? vsEntry), vertexCount, Math.max(1, d.instances), baseVertex);
      }
      r.deviceTextureSizes = null;
      const dhs = pl !== null ? pl.tcs : (hsInfo?.program ?? null);
      const dds = pl !== null ? pl.tes : (dsInfo?.program ?? null);
      const [deviceTextures, deviceCubes] = ds !== null && ds.tables.size > 0
        ? deviceTexturesOf(r, device, ds, PipelineInfo.merged(dvs, dhs, dds, pl !== null ? pl.gs : (gsInfo?.program ?? null)), dps) : [null, null];
      const textureSizes = deviceTextures === null ? null : r.deviceTextureSizes;
      const target = ds?.target ?? null;
      if (target !== null) registerTarget(r, device, target);
      const fixed = pl?.state ?? state;
      const st = fixed.stencil;
      scene.draws.push(new DrawCall({
        target,
        geometryShader: pl !== null ? pl.gs : (gsInfo?.program ?? null),
        geometryEntry: pl !== null ? pl.gsEntry : (gsInfo?.entry ?? "main"),
        tessControlShader: dds !== null ? dhs : null,
        tessControlEntry: pl !== null ? pl.tcsEntry : (hsInfo?.entry ?? "main"),
        tessEvalShader: dhs !== null ? dds : null,
        tessEvalEntry: pl !== null ? pl.tesEntry : (dsInfo?.entry ?? "main"),
        patchVertices: patchPoints(ds?.topology ?? topology),
        instanceVertices: perInstance,
        instanceDivisor: stepRate,
        cubeTextures: deviceCubes,
        cubeTexturesLod: deviceCubes === null ? null : r.deviceCubeLod,
        textureImages: textureSizes,
        vertexShader: dvs,
        fragmentShader: dps,
        vertexEntry: pl?.vsEntry ?? vsEntry,
        fragmentEntry: pl?.fsEntry ?? psEntry,
        hlsl: true,
        vertices: dVertices,
        indices: dIndices,
        first: d.indexed ? 0 : d.first,
        count: d.count,
        instances: Math.max(1, d.instances),
        topology: ds?.topology != null ? topologyOf(ds.topology) : topo,
        uniforms: () => values,
        cull: pl?.cull ?? cullMode,
        frontCcw: pl?.frontCcw ?? frontCcw,
        wireframe: pl?.wireframe ?? fill.includes("WIREFRAME"),
        depthTest: pl?.depthTest ?? depth,
        depthFunc: fixed.depthFunc,
        depthWrite: fixed.depthWrite,
        stencil: st !== null ? st.with({ ref: d.stencilRef ?? st.ref }) : null,
        blend: fixed.blend,
        attachmentBlends: fixed.attachments,
        textures: deviceTextures ?? perDrawTextures(r, pl?.vs ?? vs, pl?.fs ?? ps, d.bound) ?? (pl === null ? textures : (texturesOf(r, pl.vs, pl.fs) ?? textures)),
      }));
    }
    if (recorder.setupDraws > 0 && recorder.setupDraws >= recorder.draws.length) {
      // Nothing but the setup was drawn: its last ops, and the frame's ops after them.
      const tail = setupOpsByDraw.get(recorder.draws.length);
      if (tail !== undefined) addOps(r, tail, device);
      [scene.setupDraws, scene.setupOps] = [scene.draws.length, scene.ops.length];
    }
    const lastOps = opsByDraw.get(recorder.draws.length);
    if (lastOps !== undefined) addOps(r, lastOps, device);
    // Textures found through the device model's descriptors: the load-order count does not apply.
    if (recorder.draws.some((d) => {
      const ts = stateOf(d);
      if (ts === null || ts.tables.size === 0) return false;
      const handles = [...ts.tables.values()];
      return [...device.srvs.keys()].some((k) => handles.includes(k));
    })) {
      const kept = scene.notes.filter((n) => n.key !== "tooFewTextures");
      scene.notes.length = 0;
      scene.notes.push(...kept);
    }
    if (recorder.runner.usedTime || src.usedTime) scene.animated = true;
    return;
  }
  scene.draws.push(new DrawCall({
    vertexShader: vs,
    fragmentShader: ps,
    vertexEntry: vsEntry,
    fragmentEntry: psEntry,
    hlsl: true,
    vertices,
    indices,
    first,
    count: indices?.length ?? count,
    instances: Math.max(1, instances),
    topology: topo,
    uniforms: constants(r, vs, ps),
    cull: cullMode,
    frontCcw,
    wireframe: fill.includes("WIREFRAME"),
    depthTest: depth,
    textures,
  }));
  for (const d of scene.draws) d.uniforms(1.0);
  if (src.usedTime) scene.animated = true;
}

/**
 * Textures: each Texture2D (by register t0, t1 …) reads the next image loaded with stbi_load. It needs the chain of
 * D3D12HelloTexture: a texture resource filled from an upload buffer, a shader resource view in a shader-visible
 * heap, SetDescriptorHeaps and a descriptor table – and a sampler (static samplers in the root signature).
 */
function texturesOf(r: D3D12Reader, vs: ShaderProgram, ps: ShaderProgram): TextureLookup | null {
  const scene = r.scene;
  const names = TextureBinding.shaderTextures(vs, ps);
  if (names.length === 0) return null;
  const missing = [
    { call: "CreateShaderResourceView", key: "dxNoSrv" },
    { call: "SetDescriptorHeaps", key: "dxNoDescriptorHeaps" },
    { call: "SetGraphicsRootDescriptorTable", key: "dxNoDescriptorTable" },
  ].find((m) => !r.has(m.call));
  if (missing !== undefined) {
    scene.notes.push(SimNote.error(missing.key, ["name", names[0]!]));
    return () => [0, 0, 0, 1];
  }
  if (!r.has("UpdateSubresources") && !r.has("CopyTextureRegion")) scene.notes.push(SimNote.error("dxNoTextureUpload"));
  const images = StbImage.inLoadOrder(r.src, r.project, scene);
  // A Model's textures come from its .mtl file, not from stbi_load calls with a file name.
  if (images.length < names.length && !r.src.code.includes("aiProcess_"))
    scene.notes.push(SimNote.warning("tooFewTextures", ["count", String(names.length)], ["loaded", String(images.length)]));
  const sampler = samplersByRegister(r, vs, ps);
  return TextureBinding.bind(names, images, (_, name) => sampler(name));
}

/**
 * The textures of one draw when the descriptor table bound before it starts at a heap slot whose texture a
 * loading helper put there (LoadTexture("metal.png", …, 2)): register tk reads slot N + k. Null otherwise.
 */
function perDrawTextures(r: D3D12Reader, vs: ShaderProgram, ps: ShaderProgram, bound: ReadonlyMap<number, string> | null): TextureLookup | null {
  if (bound === null || bound.size === 0) return null;
  const drawTextures = r.drawTextures ??= new DrawTextures(r.src, r.project);
  if (!drawTextures.hasSlots) return null;
  const names = TextureBinding.shaderTextures(vs, ps);
  if (names.length === 0) return null;
  const registers = registersOf([...vs.globals, ...ps.globals], names);
  // OrderByDescending(b => b.Key): stable, the keys are distinct.
  for (const [, text] of [...bound].sort(([a], [b]) => b - a)) {
    const slot = drawTextures.d3d12Slot(text);
    if (slot === null || drawTextures.slotImage(slot + minOr0(registers.values())) === null) continue;
    const samplers = samplersByRegister(r, vs, ps);
    const cache = new Map<string, Texture | null>();
    return (id, u, v) => {
      let t = cache.get(id);
      if (t === undefined) {
        const parts = id.split("|");
        const reg = registers.get(parts[0]!);
        const image = reg !== undefined ? drawTextures.slotImage(slot + reg) : null;
        t = image === null ? null : new Texture(image, samplers(parts.length > 1 ? parts[1]! : null), { components: image.channels === 4 ? 4 : 3 });
        cache.set(id, t);
      }
      return t !== null ? t.sample(u, v) : [0, 0, 0, 1];
    };
  }
  return null;
}

/** D3D_PRIMITIVE_TOPOLOGY_4_CONTROL_POINT_PATCHLIST → 4. */
function patchPoints(name: string | null): number {
  const m = name !== null ? /(\d+)_CONTROL_POINT/.exec(name) : null;
  return m !== null ? parseInt32(m[1]!) : 3;
}

/** D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP, …_LINESTRIP, …_TRIANGLELIST, …_POINTLIST (no underscore before STRIP). */
function topologyOf(name: string): Topology {
  if (name.includes("CONTROL_POINT_PATCHLIST")) return Topology.Patches;
  if (name.includes("TRIANGLESTRIP")) return Topology.TriangleStrip;
  if (name.includes("LINESTRIP")) return Topology.LineStrip;
  return GlReader.topologyOf(name);
}

/** ClearOp's record equality (Color compared by reference, as a C# record compares an array). */
function sameClear(a: ClearOp, b: FrameOp): boolean {
  return b instanceof ClearOp && a.beforeDraw === b.beforeDraw && a.target === b.target && a.color === b.color
    && a.depth === b.depth && a.stencil === b.stencil && a.attachment === b.attachment;
}

/** Clears and resolves of the device model, in the scene's draw numbering (a Model draw adds several draws). */
function addOps(r: D3D12Reader, ops: readonly FrameOp[], device: D3D12Device): void {
  const scene = r.scene;
  for (const op of ops) {
    const at = scene.draws.length;
    if (op instanceof ClearOp) {
      const c = op;
      if (c.target !== null) registerTarget(r, device, c.target);
      scene.ops.push(c.with({ beforeDraw: at }));
      // The first clear of the window is the frame's clear colour.
      const lastOp = scene.ops[scene.ops.length - 1]!;
      if (c.target === null && c.color !== null && scene.draws.length === 0
        && !scene.ops.some((o) => o instanceof ClearOp && o.target === null && !sameClear(o, lastOp))) scene.clearColor ??= c.color;
    } else if (op instanceof CopyOp) {
      const cp = op;
      if (cp.from !== null) registerTarget(r, device, cp.from);
      if (cp.to !== null) registerTarget(r, device, cp.to);
      scene.ops.push(cp.with({ beforeDraw: at }));
    }
  }
}

/** An off-screen render target of the device model ("res:N") in the scene, with its size and format. */
function registerTarget(r: D3D12Reader, device: D3D12Device, id: string): void {
  const scene = r.scene;
  // "res:N~2@3": mip level 2 of resource N (half the size per level), array slice / cube face 3. The target is
  // registered per level; its slices are found through it.
  const levelId = id.includes("@") ? id.slice(0, id.indexOf("@")) : id;
  if (scene.targets.has(levelId)) return;
  const found = device.targetResource(id);
  if (found === null) return;
  const { resource: res, level } = found;
  // A texture array drawn into slice by slice in one pass (a point shadow's cube map: SV_RenderTargetArrayIndex)
  // has layers; drawn into through a view per slice (a cube map's faces one by one), each slice is its own target.
  const shape = device.shapeOf(id) ?? device.shapeOf(levelId);
  scene.targets.set(levelId, new RenderTarget(levelId, {
    width: Math.max(1, res.width >> level),
    height: Math.max(1, res.height >> level),
    colorAttachments: shape?.colors ?? 1,
    depth: shape?.depth ?? true,
    stencil: shape?.depth ?? true,
    samples: Math.max(1, res.samples),
    float: res.float,
    layers: res.perSlice ? 1 : Math.max(1, res.arraySize),
    depthOf: device.depthOf(levelId),
    channels: device.channelsOf(levelId, shape?.colors ?? 1),
  }));
  const owner = device.depthOf(levelId);
  if (owner !== null) registerTarget(r, device, owner);
}

/** Parses one element of an input layout ({ "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, … }) into its parts. */
function layoutItems(layout: string): string[][] {
  const t = trimNet(layout);
  return CppSource.splitArgs(t.slice(1, -1)).map((item) => CppSource.splitArgs(trimChars(trimChars(trimNet(item), "{", true, false), "}", false, true)));
}

/** Every input layout of the program: (semantic, input slot, byte offset, floats, per instance, step rate). */
function inputLayouts(r: D3D12Reader): LayoutElement[][] {
  const src = r.src;
  const result: LayoutElement[][] = [];
  for (const m of matchesAll(/D3D12_INPUT_ELEMENT_DESC\s+(\w+)\s*\[/g, src.code)) {
    const layout = src.initializer(m[1]!);
    if (layout === null) continue;
    const elements: LayoutElement[] = [];
    const nextOffset = new Map<number, number>();
    for (const parts of layoutItems(layout)) {
      if (parts.length < 5) continue;
      const semantic = (CppSource.stringArg(parts[0]!) ?? "").toUpperCase() + (src.int(parts[1]!) ?? 0);
      const comps = components(parts[2]!);
      const slot = src.int(parts[3]!) ?? 0;
      const offset = parts[4]!.includes("APPEND_ALIGNED") ? (nextOffset.get(slot) ?? 0) : (src.int(parts[4]!) ?? 0);
      nextOffset.set(slot, offset + comps * 4);
      const instance = parts.length > 5 && parts[5]!.includes("INSTANCE");
      const step = parts.length > 6 ? Math.max(1, src.int(parts[6]!) ?? 1) : 1;
      elements.push({ semantic, slot, offset, comps, instance, step });
    }
    result.push(elements);
  }
  return result;
}

/** The input layout that feeds a vertex shader best: the one with the most of its input semantics. */
function chooseLayout(layouts: LayoutElement[][], vs: ShaderProgram, entry: string): LayoutElement[] {
  const f = vs.findFunction(entry);
  // C#: a HashSet with OrdinalIgnoreCase; every name in it and in the layouts is upper case already.
  const wanted = new Set<string>();
  if (f !== null)
    for (const p of f.params) {
      if (p.semantic !== null) wanted.add(rasterizerSemantic(p.semantic));
      const st = vs.findStruct(p.type);
      if (st !== null) for (const field of st.fields.filter((x) => x.semantic !== null)) wanted.add(rasterizerSemantic(field.semantic!));
    }
  // OrderByDescending(matches).ThenBy(|count − wanted|).FirstOrDefault(): the first of the best (a stable order).
  let best: LayoutElement[] | null = null;
  let bestMatches = 0, bestDistance = 0;
  for (const l of layouts) {
    const matches = l.filter((e) => wanted.has(e.semantic.toUpperCase())).length;
    const distance = Math.abs(l.length - wanted.size);
    if (best === null || matches > bestMatches || (matches === bestMatches && distance < bestDistance)) {
      best = l;
      bestMatches = matches;
      bestDistance = distance;
    }
  }
  return best ?? [];
}

const rasterizerSemantic = (s: string): string => (isDigit(s[s.length - 1]) ? s.toUpperCase() : s.toUpperCase() + "0");

/** Vertices (and per-instance values) read from the vertex buffers bound at the draw, through the layout. */
function deviceVerticesOf(device: D3D12Device, state: DrawState, layout: LayoutElement[], count: number, instances: number, baseVertex = 0): [VertexData[], VertexData[] | null, number] {
  const vertices: VertexData[] = [];
  const perVertex = layout.filter((e) => !e.instance);
  for (let i = 0; i < count; i++) {
    const dict: VertexData = new Map();
    for (const e of perVertex) {
      const vb = state.vertexBuffers.get(e.slot);
      const v = vb !== undefined ? device.read(vb.address, (i + baseVertex) * vb.stride + e.offset, e.comps) : null;
      if (v !== null) dict.set(e.semantic, ShaderValue.vecOf(v));
    }
    vertices.push(dict);
  }
  const perInstance = layout.filter((e) => e.instance);
  if (perInstance.length === 0) return [vertices, null, 1];
  const step = perInstance[0]!.step;
  const instanceData: VertexData[] = [];
  for (let i = 0; i < Math.trunc((instances + step - 1) / step); i++) {
    const dict: VertexData = new Map();
    for (const e of perInstance) {
      const vb = state.vertexBuffers.get(e.slot);
      const v = vb !== undefined ? device.read(vb.address, i * vb.stride + e.offset, e.comps) : null;
      if (v !== null) dict.set(e.semantic, ShaderValue.vecOf(v));
    }
    instanceData.push(dict);
  }
  return [vertices, instanceData, step];
}

/**
 * The textures of a draw through its descriptor tables: register tk of a table starting at handle h reads the
 * SRV at h + k – a loaded image, a cube map (TextureCube) or a render target drawn earlier in the frame.
 */
function deviceTexturesOf(r: D3D12Reader, device: D3D12Device, state: DrawState, vs: ShaderProgram, ps: ShaderProgram): [TextureLookup | null, CubeLookup | null] {
  const names = TextureBinding.shaderTextures(vs, ps);
  if (names.length === 0) return [null, null];
  const registers = registersOf([...vs.globals, ...ps.globals], names);
  const lowest = minOr0(registers.values());
  // OrderByDescending(t => t.Key): stable, the keys are distinct.
  const start = [...state.tables].sort(([a], [b]) => b - a).map(([, h]) => h).find((h) => device.srvs.has(h + lowest));
  if (start === undefined) return [null, null];
  const sampler = samplersByRegister(r, vs, ps);
  const flat = new Map<string, Texture | null>();
  const cubes = new Map<string, CubeTexture | null>();
  const lookup = (id: string): [Texture | null, CubeTexture | null] => {
    const parts = id.split("|");
    if (!flat.has(id)) {
      // "name@k": slice k of a Texture2DArray.
      const at = parts[0]!.indexOf("@");
      const name = at < 0 ? parts[0]! : parts[0]!.slice(0, at);
      const layer = at < 0 ? 0 : parseInt32(parts[0]!.slice(at + 1));
      const reg = registers.get(name);
      const [t, c] = reg !== undefined ? device.textureAt(tableHandle(r, state, reg) ?? start + reg, sampler(parts.length > 1 ? parts[1]! : null), layer) : [null, null];
      flat.set(id, t);
      cubes.set(id, c);
    }
    return [flat.get(id)!, cubes.get(id)!];
  };
  r.deviceTextureSizes = (id) => lookup(id)[0]?.image ?? null;
  r.deviceCubeLod = (id, x, y, z, lod) => {
    const c = lookup(id)[1];
    return c !== null ? c.sample(x, y, z, lod) : null;
  };
  return [(id, u, v) => {
    const t = lookup(id)[0];
    return t !== null ? t.sample(u, v) : [0, 0, 0, 1];
  }, (id, x, y, z) => {
    const c = lookup(id)[1];
    return c !== null ? c.sample(x, y, z) : null;
  }];
}

/**
 * The descriptor of an SRV register through the root signature: the root parameter whose table's SRV range covers the
 * register (ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 1); rootParameters[3].InitAsDescriptorTable(1, &amp;ranges[2])),
 * at the handle bound to it – several tables per draw (bloom's scene and bloomBlur). Null when the code does not say.
 */
function tableHandle(r: D3D12Reader, state: DrawState, register: number): number | null {
  const tables = r.srvTables ??= srvTablesOf(r);
  for (const { param, base: baseRegister, count } of tables) {
    const handle = state.tables.get(param);
    if (register >= baseRegister && register < baseRegister + count && handle !== undefined) return handle + (register - baseRegister);
  }
  return null;
}

function srvTablesOf(r: D3D12Reader): { param: number; base: number; count: number }[] {
  const src = r.src;
  const ranges = new Map<string, { base: number; count: number }>();
  for (const m of matchesAll(/(\w+(?:\[\d+\])?)\s*\.\s*Init\s*\(\s*D3D12_DESCRIPTOR_RANGE_TYPE_SRV\s*,\s*([^,]+),\s*([^,)]+)/g, src.code)) {
    const count = src.int(m[2]!);
    const baseRegister = src.int(m[3]!);
    if (count !== null && baseRegister !== null) ranges.set(m[1]!.replace(/\s+/g, ""), { base: baseRegister, count });
  }
  const list: { param: number; base: number; count: number }[] = [];
  for (const m of matchesAll(/rootParameters\s*\[\s*(\d+)\s*\]\s*\.\s*InitAsDescriptorTable\s*\(\s*\d+\s*,\s*&\s*(\w+(?:\s*\[\s*\d+\s*\])?)/g, src.code)) {
    const range = ranges.get(m[2]!.replace(/\s+/g, ""));
    if (range !== undefined) list.push({ param: parseInt32(m[1]!), base: range.base, count: range.count });
  }
  return list;
}

/**
 * Static samplers: each description (sampler, samplers[0], samplers[1] …) by its ShaderRegister – a description
 * copied from another (samplers[1] = samplers[0];) keeps the other's fields it does not set itself. The HLSL
 * Sample(…) call names the sampler, whose register picks the description.
 */
function samplersByRegister(r: D3D12Reader, vs: ShaderProgram, ps: ShaderProgram): (name: string | null) => SamplerState {
  const src = r.src;
  const byRegister = new Map<number, SamplerState>();
  const targets = [...new Set([...src.fieldAssignments("Filter").map((a) => a.target), ...src.fieldAssignments("AddressU").map((a) => a.target)])];
  const copied = (t: string): string | null =>
    new RegExp(String.raw`(?<![\w.])` + escapeRegex(t) + String.raw`\s*=\s*([A-Za-z_]\w*(?:\[\d+\])?)\s*;`).exec(src.code)?.[1] ?? null;
  const fieldOf = (t: string, f: string, depth = 0): string | null => {
    const own = src.fieldAssignments(f).filter((a) => a.target === t).map((a) => a.value).at(-1);
    if (own !== undefined) return own;
    const from = depth < 3 ? copied(t) : null;
    return from !== null ? fieldOf(from, f, depth + 1) : null;
  };
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]!;
    // LastOrDefault() of the registers (int?): the last one, null too; then the index in the name, else the position.
    const registers = src.fieldAssignments("ShaderRegister").filter((a) => a.target === t).map((a) => src.int(a.value));
    const im = /\[(\d+)\]/.exec(t);
    const reg = registers.at(-1) ?? (im !== null ? parseInt32(im[1]!) : i);
    byRegister.set(reg, TextureBinding.fromFields((f) => fieldOf(t, f), true));
  }
  const samplerRegister = new Map<string, number>();
  for (const g of [...vs.globals, ...ps.globals])
    if (g.type.startsWith("SamplerState") && !samplerRegister.has(g.id)) samplerRegister.set(g.id, g.binding ?? 0);
  const fallback = byRegister.get(0) ?? byRegister.values().next().value ?? SamplerState.Default;
  return (name) => {
    const reg = name !== null ? samplerRegister.get(name) : undefined;
    const st = reg !== undefined ? byRegister.get(reg) : undefined;
    return st ?? fallback;
  };
}

/**
 * A Model::Draw (the course's port of learnopengl's Model class): one draw per mesh, vertices by the input layout's
 * semantics (POSITION, NORMAL, TEXCOORD – v flipped with aiProcess_FlipUVs), and the mesh's diffuse / specular maps
 * as the shader's first and second Texture2D.
 */
function modelDraws(r: D3D12Reader, vs: ShaderProgram, ps: ShaderProgram, vsEntry: string, psEntry: string, values: Map<string, ShaderValue>, cull: CullMode, frontCcw: boolean,
  depth: boolean, gs: ShaderProgram | null = null, gsEntry = "main", recorded: RecordedDraw | null = null, target: string | null = null): void {
  const src = r.src, scene = r.scene, project = r.project;
  // The model of the draw: the .obj its Load call names (m_rock.Load("models/rock.obj", …)), else the first one.
  const modelName = recorded?.modelName ?? null;
  const lm = modelName !== null ? new RegExp(escapeRegex(modelName) + String.raw`\s*(?:\.|->)\s*Load\s*\(\s*"([^"]+\.(?:obj|gltf))"`).exec(src.code) : null;
  const path = lm !== null ? lm[1]! : ModelFiles.path(src);
  const model = path === null ? null : ObjModel.load(project, path);
  if (model === null) {
    scene.notes.push(SimNote.error("modelFileMissing", ["file", path ?? "?"]));
    return;
  }
  const flipUv = ModelFiles.flipUVs(src, project);
  const textureNames = TextureBinding.shaderTextures(vs, ps);
  for (const mesh of model.meshes) {
    const vertices: VertexData[] = mesh.positions.map((pos, i) => new Map<string, ShaderValue>([
      ["POSITION0", ShaderValue.vecOf(pos)],
      ["NORMAL0", ShaderValue.vecOf(mesh.normals[i]!)],
      ["TEXCOORD0", ShaderValue.vec(mesh.texCoords[i]![0]!, flipUv ? 1 - mesh.texCoords[i]![1]! : mesh.texCoords[i]![1]!)],
    ]));
    // A skinned model: the bone ids and weights (BLENDINDICES, BLENDWEIGHT) as the class's
    // ExtractBoneWeightForVertices leaves them (ids -1 when it does not read them).
    if (mesh.joints !== null) {
      const extracts = /\bExtractBoneWeightForVertices\s*\([^)]*\)\s*;/.test(src.code);
      for (let i = 0; i < vertices.length; i++) {
        const { ids, weights } = extracts ? GltfModel.vertexBones(mesh, i) : { ids: [-1, -1, -1, -1], weights: [0, 0, 0, 0] };
        vertices[i]!.set("BLENDINDICES0", ShaderValue.vecOf(ids));
        vertices[i]!.set("BLENDWEIGHT0", ShaderValue.vecOf(weights));
      }
    }
    const maps = [mesh.material?.diffuseMap ?? null, mesh.material?.specularMap ?? null, mesh.material?.normalMap ?? null]
      .map((f) => ModelFiles.texture(project, path!, f, false));
    scene.draws.push(new DrawCall({
      target,
      vertexShader: vs,
      fragmentShader: ps,
      vertexEntry: vsEntry,
      fragmentEntry: psEntry,
      geometryShader: gs,
      geometryEntry: gsEntry,
      hlsl: true,
      vertices,
      indices: mesh.indices.slice(),
      count: mesh.indices.length,
      uniforms: () => values,
      cull,
      frontCcw,
      depthTest: depth,
      textures: (id, u, v) => {
        const name = id.split("|")[0]!;
        const i = textureNames.indexOf(name);
        const t = i >= 0 && i < maps.length ? maps[i]! : null;
        return t !== null ? t.sample(u, v) : [0, 0, 0, 1];
      },
    }));
  }
}

/**
 * Is the depth test on in the PSO description set before an offset? CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT) turns it
 * on; a later DepthEnable = FALSE / TRUE decides.
 */
export function depthEnabled(r: D3D12Reader, before: number): boolean {
  const src = r.src;
  const field = src.fieldAssignments("DepthEnable").filter((a) => a.offset < before).at(-1);
  const desc = src.fieldAssignments("DepthStencilState").filter((a) => a.offset < before && a.value.includes("D3D12_DEFAULT")).at(-1);
  if (desc !== undefined && (field === undefined || desc.offset > field.offset)) return true;
  return field !== undefined && (src.int(field.value) ?? 0) !== 0;
}

/** The shader compiled for a target ("vs_5_0", "ps_5_0"): D3DCompileFromFile(L"shaders.hlsl", …, "VSMain", "vs_5_0", …). */
function compile(r: D3D12Reader, targetPrefix: string): Stage | null {
  const src = r.src, scene = r.scene;
  for (const c of src.calls("D3DCompileFromFile")) {
    const target = CppSource.stringArg(c.arg(4)) ?? "";
    if (!target.startsWith(targetPrefix)) continue;
    const file = src.stringValue(c.arg(0), c.offset) ?? "";
    const entry = CppSource.stringArg(c.arg(3)) ?? "main";
    const text = r.project.find(file);
    if (text === null) {
      scene.notes.push(SimNote.error("shaderFileMissing", ["file", file]));
      return null;
    }
    try {
      const program = ShaderParser.parseProgram(text);
      if (program.findFunction(entry) === null) {
        scene.notes.push(SimNote.error("dxNoEntryPoint", ["entry", entry], ["file", file]));
        return null;
      }
      return { program, entry };
    } catch (e) {
      if (e instanceof ShaderSyntaxException) return null; // The build reported it.
      throw e;
    }
  }
  scene.notes.push(SimNote.error("dxShaderNotCompiled", ["target", targetPrefix + "5_0"]));
  return null;
}

function components(format: string): number {
  const m = /DXGI_FORMAT_((?:[RGBA]\d+)+)_/.exec(format);
  return m !== null ? matchesAll(/[RGBA]\d+/g, m[1]!).length : 4;
}

/** The vertex array copied into the vertex buffer, laid out by the input layout (semantic → floats at a byte offset). */
function vertexData(r: D3D12Reader, into: VertexData[]): boolean {
  const src = r.src, scene = r.scene;
  const layoutName = /D3D12_INPUT_ELEMENT_DESC\s+(\w+)\s*\[/.exec(src.code);
  const layout = layoutName !== null ? src.initializer(layoutName[1]!) : null;
  if (layout === null || !r.has("IASetVertexBuffers")) {
    scene.notes.push(SimNote.error("dxNoInputLayout"));
    return false;
  }
  const elements: { semantic: string; offset: number; comps: number }[] = [];
  let nextOffset = 0;
  for (const parts of layoutItems(layout)) {
    if (parts.length < 5) continue;
    const semantic = (CppSource.stringArg(parts[0]!) ?? "").toUpperCase() + (src.int(parts[1]!) ?? 0);
    const comps = components(parts[2]!);
    const offset = parts[4]!.includes("APPEND_ALIGNED") ? nextOffset : (src.int(parts[4]!) ?? 0);
    nextOffset = offset + comps * 4;
    elements.push({ semantic, offset, comps });
  }
  const source = vertexArrayName(r);
  const init = source !== null ? src.initializer(source) : null;
  const value = init !== null ? src.evaluate(init) : null;
  if (value === null) {
    scene.notes.push(SimNote.error("dxNoVertexData"));
    return false;
  }
  for (const item of value.items ?? [value]) {
    const nums: number[] = [];
    flatten(item, nums);
    const dict: VertexData = new Map();
    for (const { semantic, offset, comps } of elements) dict.set(semantic, ShaderValue.vecOf(skipTake(nums, Math.trunc(offset / 4), comps)));
    into.push(dict);
  }
  return true;
}

function flatten(v: ShaderValue, into: number[]): void {
  if (v.v !== null) into.push(...v.v);
  else if (v.packed !== null) into.push(...v.packed);
  else {
    const items = v.items;
    if (items !== null) for (const i of items) flatten(i, into);
  }
}

const isIndexType = (type: string | null): boolean => type !== null
  && /^(?:UINT16|uint16_t|UINT|uint32_t|DWORD|WORD|unsigned(?:int|short)?|std::(?:vector|array)<(?:UINT16|uint16_t|UINT|uint32_t|DWORD|WORD)[^>]*>)$/.test(type);

/** The names of the arrays copied with memcpy (&amp;vertices[0], indices.data() → the variable). */
const memcpySources = (r: D3D12Reader): string[] =>
  r.src.calls("memcpy").map((c) => trimChars(trimNet(c.arg(1)), "&", true, false).replace(/\.data\(\)$|\[0\]$/, ""));

/** The arrays copied with memcpy into the mapped buffers: the vertex array is the one that is not of an index type. */
function vertexArrayName(r: D3D12Reader): string | null {
  const src = r.src;
  return memcpySources(r).find((n) => /^\w+$/.test(n) && !isIndexType(src.declaredType(n)) && (src.initializer(n)?.trimStart().startsWith("{") ?? false)) ?? null;
}

function indexData(r: D3D12Reader): number[] | null {
  const src = r.src;
  const name = memcpySources(r).find((n) => /^\w+$/.test(n) && isIndexType(src.declaredType(n)));
  return name === undefined ? null : src.numbers(name);
}

/**
 * Constants: an HLSL cbuffer whose name matches a C++ struct; the fields assigned to a variable of that type
 * (constants.color = XMFLOAT4(…)) are its values. They must reach the GPU (root constants or a constant buffer).
 */
function constants(r: D3D12Reader, vs: ShaderProgram, ps: ShaderProgram): (time: number) => Map<string, ShaderValue> {
  const src = r.src;
  const blocks = [...vs.globals, ...ps.globals].filter((g) => g.block !== null);
  if (blocks.length === 0) return () => new Map();
  const assignments: { field: string; expr: string }[] = [];
  for (const block of blocks) {
    const variables = new Set(matchesAll(new RegExp(String.raw`\b` + escapeRegex(block.type) + String.raw`\s+(\w+)\s*(?:\{[^;]*\}|=[^;]*)?\s*;`, "g"), src.code).map((m) => m[1]!));
    if (variables.size === 0) continue;
    if (!r.has("SetGraphicsRoot32BitConstants") && !r.has("SetGraphicsRootConstantBufferView") && !r.has("SetGraphicsRootDescriptorTable"))
      r.scene.notes.push(SimNote.warning("dxConstantsNotSet", ["type", block.type]));
    for (const field of block.block!)
      for (const a of src.fieldAssignments(field.id))
        if (variables.has(a.target)) assignments.push({ field: field.id, expr: a.value });
  }
  return (t) => {
    const d = new Map<string, ShaderValue>();
    for (const { field, expr } of assignments) {
      const v = src.evaluate(expr, t);
      if (v !== null) d.set(field, v);
    }
    return d;
  };
}

/**
 * The cbuffers bound as root constant buffer views (SetGraphicsRootConstantBufferView(i, address)): root parameter i
 * is rootParameters[i].InitAsConstantBufferView(register), its values read from the buffer's memory.
 */
function rootCbvValues(r: D3D12Reader, device: D3D12Device, d: RecordedDraw, blocks: readonly A.Global[], values: Map<string, ShaderValue>): void {
  const state = d.state instanceof DrawState ? d.state : null;
  const cbvs = state?.rootCbvs ?? null;
  if (cbvs === null || cbvs.size === 0) return;
  for (const [param, address] of cbvs) {
    const m = matchesAll(new RegExp(String.raw`(\w+)\s*\[\s*` + param + String.raw`\s*\]\s*\.\s*InitAsConstantBufferView\s*\(\s*(\d+)`, "g"), r.src.code).at(-1);
    const register = m === undefined ? param : parseInt32(m[2]!);
    const block = blocks.find((b) => b.binding === register && b.block !== null);
    if (block === undefined) continue;
    const read = device.cbufferAt(address, block.block!, (t) => StructLayout.floatsOf(t));
    if (read !== null) for (const [k, v] of read) values.set(k, v);
  }
}
