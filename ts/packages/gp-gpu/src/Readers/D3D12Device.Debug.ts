// D3D12Device.Debug.cs: a part of the C# partial class D3D12Device, as functions that take the device (its fields are
// declared in D3D12Device.ts).
//
// The debug layer (learnopengl's "Debugging" in Direct3D 12): the messages it makes for the two mistakes the chapter's
// program has (a descriptor table set while no descriptor heap is, and a shader resource view with 0 mip levels), the
// info queue that stores them (ID3D12InfoQueue), the callback it calls right away (ID3D12InfoQueue1::
// RegisterMessageCallback) and the names objects get with SetName – in the debug layer's own wording.
import { hex64, toInt, toLong } from "../internal/dotnet.js";
import * as A from "../Shading/ShaderAst.js";
import { ShaderRuntimeException } from "../Shading/ShaderErrors.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
// A cycle with D3D12Device.ts, used only when a function runs (both modules are loaded by then).
import { D3D12Device } from "./D3D12Device.js";

/** A message of the debug layer. (A C# record.) */
export class DebugMessage {
  constructor(readonly category: string, readonly severity: string, readonly id: number, readonly description: string) {}
}

/** D3D12Device's descriptor handle unit (heap × 10⁶ + index). */
const HeapUnit = 1e6;

const InfoQueueHandle = "infoqueue:";

/** The debug layer's calls and the info queue's; null: not one of them. */
export function debugLayerCall(d: D3D12Device, name: string, args: readonly A.Expr[]): ShaderValue | null {
  const n = args.length;
  const onQueue = (): boolean => n >= 1 && d.eval(D3D12Device.strip(args[0]!))?.text?.startsWith(InfoQueueHandle) === true;
  switch (name) {
    case ".EnableDebugLayer":
      d.debugLayer = true;
      return ShaderValue.scalar(0);
    case ".As": {
      const target = n >= 2 ? D3D12Device.outTarget(args[1]!) : null;
      if (target !== null && targetType(d, target)?.includes("InfoQueue") === true) {
        // The device's info queue exists only with the debug layer (otherwise As fails and the pointer stays empty).
        if (!d.debugLayer && !d.src.uses("EnableDebugLayer")) return ShaderValue.str("E_NOINTERFACE");
        d.exec!.runner.assign(target, ShaderValue.str(InfoQueueHandle + ++d.infoQueues));
        return ShaderValue.str("S_OK");
      }
      break;
    }
    case "SUCCEEDED":
      if (n >= 1) return ShaderValue.scalar(succeeded(d.eval(args[0]!)) ? 1 : 0);
      break;
    case "FAILED":
      if (n >= 1) return ShaderValue.scalar(succeeded(d.eval(args[0]!)) ? 0 : 1);
      break;
    case "IsDebuggerPresent":
      // The simulator is no debugger: a break on a severity would end the program.
      return ShaderValue.scalar(0);
    case ".SetBreakOnSeverity": case ".SetBreakOnCategory": case ".SetBreakOnID": case ".PushStorageFilter": case ".UnregisterMessageCallback":
      if (onQueue()) return ShaderValue.str("S_OK");
      break;
    case ".RegisterMessageCallback":
      if (onQueue() && n >= 2) {
        const fn = D3D12Device.strip(args[1]!);
        d.messageCallback = fn instanceof A.Name && d.src.functions.has(fn.id) ? fn.id : null;
        if (n >= 5) set(d, args[4]!, ShaderValue.integer(1));
        return ShaderValue.str("S_OK");
      }
      break;
    case ".GetNumStoredMessages":
      if (onQueue()) return ShaderValue.integer(d.storedMessages.length);
      break;
    case ".GetMessage":
      if (onQueue() && n >= 4) {
        const index = toInt(d.num(args[1]!));
        if (index < 0 || index >= d.storedMessages.length) return ShaderValue.str("E_INVALIDARG");
        const m = d.storedMessages[index]!;
        // First call (no message yet): the size of the D3D12_MESSAGE with its text after it.
        set(d, args[3]!, ShaderValue.integer(32 + m.description.length + 1));
        const out = args[2]!;
        if (!(out instanceof A.Name && (out.id === "nullptr" || out.id === "NULL")))
          set(d, out, D3D12Device.desc(["Category", ShaderValue.str(m.category)], ["Severity", ShaderValue.str(m.severity)], ["ID", ShaderValue.integer(m.id)],
            ["pDescription", ShaderValue.str(m.description)], ["DescriptionByteLength", ShaderValue.integer(m.description.length + 1)]));
        return ShaderValue.str("S_OK");
      }
      break;
    case ".ClearStoredMessages":
      if (onQueue()) {
        d.storedMessages.length = 0;
        return ShaderValue.scalar(0);
      }
      break;
    case ".SetName":
      if (n >= 2) {
        const label = d.eval(args[1]!)?.text ?? null;
        if (label === null) return ShaderValue.str("S_OK");
        d.objectNames.set(objectKey(d, args[0]!), label);
        return ShaderValue.str("S_OK");
      }
      break;
    case ".SetDescriptorHeaps":
      d.heapsSet = true;
      return null;
    case ".Reset":
      if (n >= 3) {
        // A command list's Reset(allocator, pipeline state): no heap and no tables set any more.
        d.heapsSet = d.tablesWithoutHeap = false;
        return null;
      }
      break;
  }
  return null;
}

/** Assigns to a variable of the program; a target the runner cannot write is left alone. */
export function set(d: D3D12Device, target: A.Expr, value: ShaderValue): void {
  try {
    d.exec!.runner.assign(D3D12Device.strip(target), value);
  } catch (e) {
    if (!(e instanceof ShaderRuntimeException)) throw e;
  }
}

function succeeded(v: ShaderValue | null): boolean {
  const t = v?.text ?? null;
  if (t !== null) return t === "S_OK" || t === "S_FALSE" || (!t.startsWith("E_") && !t.startsWith("DXGI_ERROR"));
  return v === null || v.v === null || v.v.length === 0 || v.v[0]! >= 0;
}

function targetType(d: D3D12Device, target: A.Expr): string | null {
  if (target instanceof A.Name) return d.src.declaredType(target.id);
  if (target instanceof A.Member) return d.src.declaredType(target.field);
  return null;
}

/** What SetName names: a resource by its id, anything else (a heap, the root signature) by its variable. */
function objectKey(d: D3D12Device, e: A.Expr): string {
  const r = d.resourceOf(e);
  return r !== null ? "res:" + r.id : d.heapName(e);
}

/** The debug layer reports a message: stored in the info queue, and given to the callback right away. */
function report(d: D3D12Device, category: string, severity: string, id: number, description: string): void {
  if (!d.debugLayer && !d.src.uses("EnableDebugLayer")) return;
  d.storedMessages.push(new DebugMessage(category, severity, id, description));
  if (d.messageCallback === null) return;
  const text = description.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
  d.exec!.run(`${d.messageCallback}(${category}, ${severity}, ${id}, "${text}", nullptr);`);
}

/** {x:X16}: 16 upper-case hexadecimal digits. */
const hex16 = (x: number): string => hex64(x, true).padStart(16, "0");

/** A descriptor table set while the command list has no descriptor heap: message #708, and nothing drawn. */
export function tableWithoutHeap(d: D3D12Device, handle: number): void {
  d.tablesWithoutHeap = true;
  let heap = "heap";
  for (const [k, start] of d.heaps)
    if (handle >= start && handle < start + HeapUnit) {
      heap = k;
      break;
    }
  const heapName = d.objectNames.get(heap) ?? "Unnamed ID3D12DescriptorHeap Object";
  const heapAddress = 0x0000020B6E3A4F10 + toLong((d.heaps.get(heap) ?? 0) / HeapUnit) * 0x10000;
  const handleAddress = 0x0000020B6E5B3000 + toLong(handle % HeapUnit) * 32;
  report(d, "D3D12_MESSAGE_CATEGORY_EXECUTION", "D3D12_MESSAGE_SEVERITY_ERROR", 708,
    `CGraphicsCommandList::SetGraphicsRootDescriptorTable: The descriptor heap (0x${hex16(heapAddress)}:'${heapName}') containing handle 0x${hex16(handleAddress)} is different from currently set descriptor heap 0x0000000000000000:'(nullptr)'.`);
}

/** A 2D shader resource view with 0 mip levels (a zeroed description): message #31, and the view reads 0. */
export function checkSrv(d: D3D12Device, desc: ShaderValue | null, handle: number): void {
  d.invalidSrvs.delete(handle);
  const f = desc?.fields ?? null;
  if (f === null || f.get("ViewDimension")?.text !== "D3D12_SRV_DIMENSION_TEXTURE2D") return;
  const mips = f.get("Texture2D")?.fields?.get("MipLevels") ?? null;
  if ((mips !== null && mips.v !== null && mips.v.length > 0 && mips.v[0] !== 0) || (mips?.text ?? null) !== null) return;
  d.invalidSrvs.add(handle);
  report(d, "D3D12_MESSAGE_CATEGORY_STATE_CREATION", "D3D12_MESSAGE_SEVERITY_ERROR", 31,
    "ID3D12Device::CreateShaderResourceView: The Dimensions of the View are invalid due to at least one of the following conditions. MostDetailedMip (value = 0) must be between 0 and MipLevels-1 of the Texture Resource, 0, inclusively. With the current MostDetailedMip, MipLevels (value = 0) must be between 1 and 1, inclusively, or -1 to default to all mips from MostDetailedMip, in order that the View fit on the Texture.");
}
