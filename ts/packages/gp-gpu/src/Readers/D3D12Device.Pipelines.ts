// D3D12Device.Pipelines.cs: a part of the C# partial class D3D12Device, as functions that take the device (its
// fields are declared in D3D12Device.ts).
//
// Pipeline state objects as the program makes them: the shaders each one was compiled from (D3DCompileFromFile's file
// and entry point) and its description – for programs whose PSOs the reader cannot follow by name (a std::map of
// shaders, a Compile helper with a blend parameter). The CD3DX12 description helpers give their D3D12_DEFAULT values,
// so the fields the program changes afterwards are there too.
import { tryParseInt } from "../internal/dotnet.js";
import * as A from "../Shading/ShaderAst.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
// A cycle with D3D12Device.ts, used only when a function runs (both modules are loaded by then).
import { D3D12Device } from "./D3D12Device.js";
import { set } from "./D3D12Device.Debug.js";

/** A compiled shader blob: D3DCompileFromFile's file, entry point and target. (C#: a (File, Entry, Target) tuple.) */
export interface ShaderBlob {
  readonly file: string;
  readonly entry: string;
  readonly target: string;
}

/** A compiled shader blob's file, entry point and target ("blob#k"). */
export function blobOf(d: D3D12Device, handle: string | null | undefined): ShaderBlob | null {
  if (handle === null || handle === undefined || !handle.startsWith("blob#")) return null;
  const k = tryParseInt(handle.slice(5));
  return k !== null && k >= 1 && k <= d.blobs.length ? d.blobs[k - 1]! : null;
}

const str = ShaderValue.str;

export function pipelineCall(d: D3D12Device, name: string, args: readonly A.Expr[]): ShaderValue | null {
  const { strip, outTarget, desc } = D3D12Device;
  const n = args.length;
  switch (name) {
    case "D3DCompileFromFile":
      if (n >= 8) {
        const file = d.eval(args[0]!)?.text ?? null;
        if (file === null) return null;
        d.blobs.push({ file, entry: d.eval(args[3]!)?.text ?? "main", target: d.eval(args[4]!)?.text ?? "" });
        const blob = outTarget(args[7]!);
        if (blob !== null) set(d, blob, str("blob#" + d.blobs.length));
        return str("S_OK");
      }
      break;
    case "CD3DX12_SHADER_BYTECODE":
      if (n >= 1) {
        // The bytecode of a blob: the blob itself (vertexShader.Get()); CD3DX12_SHADER_BYTECODE(nullptr, 0): none.
        const a = args[0]!;
        return a instanceof A.Name && (a.id === "nullptr" || a.id === "NULL") ? str("") : d.eval(strip(a)) ?? str("");
      }
      break;
    case "CD3DX12_BLEND_DESC":
      if (n === 1) {
        const target = (): ShaderValue => desc(["BlendEnable", str("FALSE")], ["LogicOpEnable", str("FALSE")],
          ["SrcBlend", str("D3D12_BLEND_ONE")], ["DestBlend", str("D3D12_BLEND_ZERO")], ["BlendOp", str("D3D12_BLEND_OP_ADD")],
          ["SrcBlendAlpha", str("D3D12_BLEND_ONE")], ["DestBlendAlpha", str("D3D12_BLEND_ZERO")], ["BlendOpAlpha", str("D3D12_BLEND_OP_ADD")],
          ["LogicOp", str("D3D12_LOGIC_OP_NOOP")], ["RenderTargetWriteMask", str("D3D12_COLOR_WRITE_ENABLE_ALL")]);
        return desc(["AlphaToCoverageEnable", str("FALSE")], ["IndependentBlendEnable", str("FALSE")],
          ["RenderTarget", ShaderValue.array(Array.from({ length: 8 }, () => target()))]);
      }
      break;
    case "CD3DX12_RASTERIZER_DESC":
      if (n === 1)
        return desc(["FillMode", str("D3D12_FILL_MODE_SOLID")], ["CullMode", str("D3D12_CULL_MODE_BACK")],
          ["FrontCounterClockwise", str("FALSE")], ["DepthClipEnable", str("TRUE")]);
      break;
    case "CD3DX12_DEPTH_STENCIL_DESC":
      if (n === 1)
        return desc(["DepthEnable", str("TRUE")], ["DepthWriteMask", str("D3D12_DEPTH_WRITE_MASK_ALL")],
          ["DepthFunc", str("D3D12_COMPARISON_FUNC_LESS")], ["StencilEnable", str("FALSE")]);
      break;
    case ".CreateGraphicsPipelineState":
      if (n >= 3) {
        const description = d.eval(strip(args[1]!));
        const target = description === null || description.fields === null ? null : outTarget(args[2]!);
        if (description === null || description.fields === null || target === null) return null;
        const handle = "pso#" + (d.createdPsos.size + 1);
        d.createdPsos.set(handle, description.clone());
        set(d, target, str(handle));
        return str("S_OK");
      }
      break;
    case ".SetPipelineState":
      if (n >= 2) {
        d.boundPso = d.eval(strip(args[1]!))?.text ?? null;
        return null; // the frame recorder records it too
      }
      break;
    case ".Reset":
      if (n >= 3) {
        d.boundPso = d.eval(strip(args[2]!))?.text ?? null;
        return null;
      }
      break;
  }
  return null;
}
