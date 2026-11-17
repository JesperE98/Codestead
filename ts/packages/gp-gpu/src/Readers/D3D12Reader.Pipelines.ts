// D3D12Reader.Pipelines.cs: a part of the C# partial class D3D12Reader, as functions that take the reader (its fields
// are declared in D3D12Reader.ts).
//
// Several pipeline state objects (the lit object and the lamp): each CreateGraphicsPipelineState(…, &name) takes the
// vertex and pixel shaders compiled last before it and the rasterizer / depth fields set before it.
import { formatDouble, parseInt32 } from "../internal/dotnet.js";
import { escapeRegex } from "../internal/regex.js";
import { CullMode } from "../Scene/CullMode.js";
import { Topology } from "../Scene/Topology.js";
import { ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import type { ShaderValue } from "../Shading/ShaderValue.js";
import { CppSource, type FieldAssignment } from "./CppSource.js";
import type { D3D12Device } from "./D3D12Device.js";
import { depthEnabled } from "./D3D12Reader.Draw.js";
import type { D3D12Reader } from "./D3D12Reader.js";
import { PipelineInfo } from "./PipelineInfo.js";
import { PipelineState } from "./PipelineState.js";

/** A shader of a pipeline: its program and entry point. */
export interface Stage {
  readonly program: ShaderProgram;
  readonly entry: string;
}

/** The last element of a list, or undefined (LINQ's LastOrDefault of a tuple: check `value` / the element). */
const last = <T>(list: readonly T[]): T | undefined => list[list.length - 1];

const BlendFields = ["IndependentBlendEnable", "BlendEnable", "SrcBlend", "DestBlend", "BlendOp", "SrcBlendAlpha", "DestBlendAlpha", "BlendOpAlpha", "RenderTargetWriteMask"];
const TargetBlendFields = ["BlendEnable", "SrcBlend", "DestBlend", "BlendOp", "SrcBlendAlpha", "DestBlendAlpha", "BlendOpAlpha", "RenderTargetWriteMask"];

/**
 * A depth/stencil or blend field set before an offset – unless the whole state was reset to its defaults after it
 * (psoDesc.DepthStencilState = CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT), psoDesc.BlendState = CD3DX12_BLEND_DESC(…)).
 */
export function stateField(r: D3D12Reader, field: string, before: number): string | null {
  const assign = last(r.src.fieldAssignments(field).filter((a) => a.offset < before));
  if (assign === undefined) return null;
  const group = BlendFields.includes(field) ? "BlendState" : "DepthStencilState";
  const reset = last(r.src.fieldAssignments(group).filter((a) => a.offset < before));
  return reset !== undefined && reset.offset > assign.offset ? null : assign.value;
}

/**
 * A blend field of BlendState.RenderTarget[`index`] set before an offset (as stateField); a field written for no
 * particular target counts for target 0.
 */
function targetField(r: D3D12Reader, field: string, before: number, index: number): string | null {
  if (!TargetBlendFields.includes(field)) return stateField(r, field, before);
  const forTarget = (a: FieldAssignment): boolean => {
    const m = /RenderTarget\[\s*(\d+)\s*\]$/.exec(a.target);
    return m !== null ? parseInt32(m[1]!) === index : index === 0;
  };
  const assign = last(r.src.fieldAssignments(field).filter((a) => a.offset < before && forTarget(a)));
  if (assign === undefined) return null;
  const reset = last(r.src.fieldAssignments("BlendState").filter((a) => a.offset < before));
  return reset !== undefined && reset.offset > assign.offset ? null : assign.value;
}

/** A value of a description as text: its text, else its first number (invariant culture). */
function textOf(v: ShaderValue | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v.text ?? (v.v !== null && v.v.length > 0 ? formatDouble(v.v[0]!) : null);
}

/** The blend description of BlendState.RenderTarget[i] in a created description (the device saw it). */
function runtimeTarget(desc: ShaderValue, index: number): (name: string) => string | null {
  const targets = find(desc, "RenderTarget", 0)?.items ?? null;
  const element = targets !== null && index < targets.length ? targets[index]! : null;
  return (name) => textOf(element?.fields?.get(name));
}

/** Does the pipeline state description created at an offset have a geometry shader (its GS field set to bytecode)? */
export function usesGeometry(r: D3D12Reader, before: number): boolean {
  return usesStage(r, "GS", before);
}

/** Does the description created at an offset set a stage's field (GS, HS, DS) to bytecode? */
export function usesStage(r: D3D12Reader, field: string, before: number): boolean {
  const value = r.src.fieldValueBefore(field, before);
  return value !== null && !/^\{\s*\}$|^D3D12_SHADER_BYTECODE\s*\{\s*\}$|nullptr/.test(value);
}

/** A program parsed from text, or null when it does not parse. */
function parse(text: string, entry: string): Stage | null {
  try {
    return { program: ShaderParser.parseProgram(text), entry };
  } catch (e) {
    if (e instanceof ShaderSyntaxException) return null;
    throw e;
  }
}

const isTrue = (s: string): boolean => s === "TRUE" || s === "true" || s === "1";

/** A PSO as the device saw it made: its blobs' files and entry points, its description's state. */
export function runtimePso(r: D3D12Reader, device: D3D12Device, handle: string): PipelineInfo | null {
  const known = r.runtimePsos.get(handle);
  if (known !== undefined) return known;
  let result: PipelineInfo | null = null;
  const desc = device.createdPsos.get(handle);
  if (desc !== undefined) {
    const stage = (field: string): Stage | null => {
      const blob = device.blob(desc.fields!.get(field)?.text);
      const text = blob === null ? null : r.project.find(blob.file);
      if (blob === null || text === null) return null;
      return parse(text, blob.entry);
    };
    const field = (name: string): string | null => textOf(find(desc, name, 0));
    const vs = stage("VS");
    const ps: Stage = stage("PS") ?? { program: ShaderParser.parseProgram("void PSMain() { }"), entry: "PSMain" };
    const gs = stage("GS");
    const hs = stage("HS");
    const ds = stage("DS");
    if (vs !== null) {
      const cull = field("CullMode") ?? "D3D12_CULL_MODE_BACK";
      const depth = field("DepthEnable") ?? "TRUE";
      result = new PipelineInfo(handle, vs.program, ps.program, vs.entry, ps.entry,
        cull.includes("NONE") ? CullMode.None : cull.includes("FRONT") ? CullMode.Front : CullMode.Back,
        isTrue(field("FrontCounterClockwise") ?? "FALSE"),
        (field("FillMode") ?? "SOLID").includes("WIREFRAME"),
        isTrue(depth),
        Topology.Triangles,
        {
          // C#'s Field(f)! : the null-forgiving operator, the value may be null.
          state: PipelineState.d3d12((f) => field(f), (f) => {
            const v = field(f);
            return v !== null ? r.src.int(v) : null;
          }, (i) => runtimeTarget(desc, i)),
          gs: gs?.program ?? null,
          gsEntry: gs?.entry ?? "main",
          tcs: hs !== null && ds !== null ? hs.program : null,
          tes: hs !== null && ds !== null ? ds.program : null,
          tcsEntry: hs?.entry ?? "main",
          tesEntry: ds?.entry ?? "main",
        });
    }
  }
  r.runtimePsos.set(handle, result);
  return result;
}

/** A field of a description by its name, anywhere in it (BlendState → RenderTarget[0] → DestBlend). */
function find(v: ShaderValue | null | undefined, name: string, depth: number): ShaderValue | null {
  if (v === null || v === undefined || depth > 6) return null;
  const f = v.fields;
  if (f !== null) {
    const direct = f.get(name);
    if (direct !== undefined) return direct;
    for (const child of f.values()) {
      const found = find(child, name, depth + 1);
      if (found !== null) return found;
    }
  }
  const items = v.items;
  if (items !== null && items.length > 0) return find(items[0], name, depth + 1);
  return null;
}

export function pipelines(r: D3D12Reader): Map<string, PipelineInfo> {
  const src = r.src;
  const result = new Map<string, PipelineInfo>();
  const compiles = src.calls("D3DCompileFromFile");
  for (const create of src.calls(".CreateGraphicsPipelineState")) {
    const nm = /&\s*(\w+)/.exec(create.arg(1));
    const name = nm !== null ? nm[1]! : null;
    if (name === null) continue;
    const stage = (prefix: string): Stage | null => {
      // The blob the description names (psoDesc.PS = CD3DX12_SHADER_BYTECODE(depthPixelShader.Get())), else the
      // last shader of that kind compiled before. The blob is D3DCompileFromFile's ppCode, its 8th argument.
      const field = src.fieldValueBefore(prefix.slice(0, 2).toUpperCase(), create.offset) ?? "";
      const bm = /(\w+)\s*\.\s*Get\s*\(/.exec(field);
      const blob = bm !== null ? bm[1]! : null;
      const named = blob === null ? undefined
        : last(compiles.filter((x) => x.offset < create.offset && new RegExp(String.raw`\b` + escapeRegex(blob) + String.raw`\b`).test(x.arg(7))));
      const c = named ?? last(compiles.filter((x) => x.offset < create.offset && (CppSource.stringArg(x.arg(4)) ?? "").startsWith(prefix)));
      if (c === undefined) return null;
      const text = r.project.find(src.stringValue(c.arg(0), c.offset) ?? "");
      if (text === null) return null;
      return parse(text, CppSource.stringArg(c.arg(3)) ?? "main");
    };
    const vs = stage("vs_");
    // No pixel shader (a depth-only pass: psoDesc.PS = CD3DX12_SHADER_BYTECODE(nullptr, 0)): an empty one.
    const psField = src.fieldValueBefore("PS", create.offset) ?? "";
    const ps = /nullptr|^\{\s*\}$/.test(psField) ? { program: ShaderParser.parseProgram("void PSMain() { }"), entry: "PSMain" } : stage("ps_");
    // A geometry shader when the description sets one (psoDesc.GS = CD3DX12_SHADER_BYTECODE(geometryShader.Get())).
    const gs = usesGeometry(r, create.offset) ? stage("gs_") : null;
    const hs = usesStage(r, "HS", create.offset) ? stage("hs_") : null;
    const ds = hs !== null && usesStage(r, "DS", create.offset) ? stage("ds_") : null;
    if (vs === null || ps === null) continue;
    const field = (f: string, fallback: string): string => src.fieldValueBefore(f, create.offset) ?? fallback;
    const cull = field("CullMode", "D3D12_CULL_MODE_BACK");
    result.set(name, new PipelineInfo(name, vs.program, ps.program, vs.entry, ps.entry,
      cull.includes("NONE") ? CullMode.None : cull.includes("FRONT") ? CullMode.Front : CullMode.Back,
      (src.int(field("FrontCounterClockwise", "FALSE")) ?? 0) !== 0,
      field("FillMode", "SOLID").includes("WIREFRAME"),
      depthEnabled(r, create.offset),
      Topology.Triangles,
      {
        state: PipelineState.d3d12((f) => stateField(r, f, create.offset), (f) => {
          const v = stateField(r, f, create.offset);
          return v !== null ? src.int(v) : null;
        }, (i) => (f) => targetField(r, f, create.offset, i)),
        gs: gs?.program ?? null,
        gsEntry: gs?.entry ?? "main",
        tcs: ds !== null ? (hs?.program ?? null) : null,
        tes: ds?.program ?? null,
        tcsEntry: hs?.entry ?? "main",
        tesEntry: ds?.entry ?? "main",
      }));
  }
  return result;
}
