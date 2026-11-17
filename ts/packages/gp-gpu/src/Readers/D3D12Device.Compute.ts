// D3D12Device.Compute.cs: a part of the C# partial class D3D12Device, as functions that take the device (its fields
// are declared in D3D12Device.ts).
//
// Compute: CreateComputePipelineState, unordered access views, the compute root parameters (descriptor tables, 32-bit
// constants) and Dispatch – run when it is recorded, writing the textures its UAVs name (the frame's draws then
// sample what it wrote).
import { toInt, toLong } from "../internal/dotnet.js";
import { Rasterizer } from "../Raster/Rasterizer.js";
import { StorageImage } from "../Raster/StorageImage.js";
import type * as A from "../Shading/ShaderAst.js";
import { ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import { ShaderRunner } from "../Shading/ShaderRunner.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { CppExec } from "./CppExec.js";
// A cycle with D3D12Device.ts, used only when a function runs (both modules are loaded by then).
import { D3D12Device, type Resource } from "./D3D12Device.js";
import { set } from "./D3D12Device.Debug.js";

export function computeCall(d: D3D12Device, name: string, args: readonly A.Expr[]): ShaderValue | null {
  const n = args.length;
  switch (name) {
    case ".CreateComputePipelineState":
      if (n >= 3) {
        const desc = d.eval(D3D12Device.strip(args[1]!));
        const target = desc === null || desc.fields === null ? null : D3D12Device.outTarget(args[2]!);
        if (desc === null || desc.fields === null || target === null) return null;
        const handle = "cpso#" + (d.computePsos.size + 1);
        const blob = d.blob(desc.fields.get("CS")?.text);
        if (blob !== null) d.computePsos.set(handle, { file: blob.file, entry: blob.entry });
        set(d, target, ShaderValue.str(handle));
        return ShaderValue.str("S_OK");
      }
      break;
    case ".CreateUnorderedAccessView":
      if (n >= 5) {
        const viewed = d.resourceOf(args[1]!);
        if (viewed !== null) d.uavs.set(toLong(d.num(args[4]!)), viewed.id);
        return ShaderValue.scalar(0);
      }
      break;
    case ".SetComputeRootDescriptorTable":
      if (n >= 3) {
        d.computeTables.set(toInt(d.num(args[1]!)), toLong(d.num(args[2]!)));
        return ShaderValue.scalar(0);
      }
      break;
    case ".SetComputeRoot32BitConstants":
      if (n >= 4) {
        const constants = d.eval(D3D12Device.strip(args[3]!))?.clone() ?? null;
        if (constants !== null) d.computeConstants.set(toInt(d.num(args[1]!)), constants);
        return ShaderValue.scalar(0);
      }
      break;
    case ".SetComputeRoot32BitConstant":
      if (n >= 3) {
        const constant = d.eval(args[2]!);
        if (constant !== null) d.computeConstants.set(toInt(d.num(args[1]!)), constant);
        return ShaderValue.scalar(0);
      }
      break;
    case ".SetComputeRootSignature": case ".SetComputeRootConstantBufferView": case ".SetComputeRootShaderResourceView": case ".SetComputeRootUnorderedAccessView":
      return ShaderValue.scalar(0);
    case ".Dispatch":
      if (n >= 4) {
        dispatch(d, toInt(d.num(args[1]!)), toInt(d.num(args[2]!)), toInt(d.num(args[3]!)));
        return ShaderValue.scalar(0);
      }
      break;
  }
  return null;
}

function dispatch(d: D3D12Device, x: number, y: number, z: number): void {
  const cs = d.boundPso === null ? undefined : d.computePsos.get(d.boundPso);
  if (cs === undefined) return;
  let program = d.computePrograms.get(cs.file);
  if (program === undefined) {
    program = null;
    const text = d.project.find(cs.file);
    if (text !== null) {
      try {
        program = ShaderParser.parseProgram(text);
      } catch (e) {
        if (!(e instanceof ShaderSyntaxException)) throw e;
      }
    }
    d.computePrograms.set(cs.file, program);
  }
  if (program === null) return;
  const p: ShaderProgram = program;
  // The root constants: the struct's fields by name, and the cbuffers' fields in order.
  const uniforms = new Map<string, ShaderValue>();
  const numbers: number[] = [];
  for (const value of d.computeConstants.valuesInOrder()) {
    if (value.fields !== null) for (const [k, v] of value.fields) uniforms.set(k, v);
    CppExec.flatten(value, numbers);
  }
  let at = 0;
  for (const field of p.globals.filter((g) => g.block !== null).flatMap((g) => g.block!)) {
    const count = Math.max(1, ShaderRunner.componentCount(field.type));
    if (at + count > numbers.length) break;
    if (!uniforms.has(field.id)) uniforms.set(field.id, count === 1 ? ShaderValue.scalar(numbers[at]!) : ShaderValue.vecOf(numbers.slice(at, at + count)));
    at += count;
  }
  // The read-write textures: register uN through the first compute descriptor table that has a UAV there.
  const images = new Map<string, StorageImage>();
  const written: { resource: Resource; storage: StorageImage }[] = [];
  for (const g of p.globals.filter((g) => g.type.startsWith("RWTexture"))) {
    const register = g.binding ?? 0;
    const resourceId = d.computeTables.valuesInOrder().map((start) => d.uavs.get(start + register) ?? 0).find((id) => id > 0) ?? 0;
    const res = d.resourceAt(resourceId);
    if (res === null) continue;
    const storage = StorageImage.from(res.images[0] ?? null, res.width, Math.max(1, res.height));
    images.set(g.id, storage);
    written.push({ resource: res, storage });
  }
  const exec = d.exec!;
  const errors = Rasterizer.dispatch(p, cs.entry, true, uniforms, images, [x, y, z], exec.runner.time);
  for (const e of errors) exec.runner.output?.("compute shader: " + e);
  for (const { resource: res, storage } of written) {
    if (res.images.length === 0) res.images.push(null);
    res.images[0] = storage.toImage();
    res.float = true;
  }
}
