// D3D12Device.cs. The other parts of the C# partial class are modules of functions that take the device:
// D3D12Device.Compute.ts, D3D12Device.Debug.ts, D3D12Device.Pipelines.ts (their fields are declared here, marked
// with the part they belong to).
import { clamp, roundEven, toByte, toInt, toLong, tryParseInt } from "../internal/dotnet.js";
import type { GpuProject } from "../GpuProject.js";
import { GltfModel } from "../Models/GltfModel.js";
import { ModelFiles } from "../Models/ModelFiles.js";
import type { ObjMesh } from "../Models/ObjMesh.js";
import { ObjModel } from "../Models/ObjModel.js";
import { Rasterizer } from "../Raster/Rasterizer.js";
import { ClearOp, CopyOp, type FrameOp } from "../Scene/FrameOp.js";
import * as A from "../Shading/ShaderAst.js";
import { ShaderRuntimeException } from "../Shading/ShaderErrors.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { SortedMap } from "../Shading/SortedMap.js";
import { CubeTexture } from "../Textures/CubeTexture.js";
import { Image } from "../Textures/Image.js";
import type { SamplerState } from "../Textures/SamplerState.js";
import { Texture } from "../Textures/Texture.js";
import { CppExec } from "./CppExec.js";
import type { CppSource } from "./CppSource.js";
import { computeCall } from "./D3D12Device.Compute.js";
import { checkSrv, debugLayerCall, tableWithoutHeap, type DebugMessage } from "./D3D12Device.Debug.js";
import { blobOf, pipelineCall, type ShaderBlob } from "./D3D12Device.Pipelines.js";
import { FormatChannels } from "./FormatChannels.js";
import type { IDeviceModel } from "./IDeviceModel.js";
import { StbImage } from "./StbImage.js";
import { StructLayout } from "./StructLayout.js";

/** A resource the program creates: a buffer with its bytes, a texture with its images, a render target. */
export class Resource {
  id = 0;
  buffer = false;
  width = 0;
  height = 0;
  arraySize = 1;
  samples = 1;
  float = false;
  depth = false;
  window = false;
  srgb = false;
  format = "";
  /** A buffer's contents by byte offset (4-byte numbers; 2-byte for 16-bit index data). (C#: SortedDictionary&lt;long, double&gt;.) */
  readonly memory = new SortedMap<number>();
  /** A texture's images (one per array slice: six for a cube map). */
  readonly images: (Image | null)[] = [];

  get targetId(): string {
    return "res:" + this.id;
  }

  /**
   * Mip levels that hold a picture: drawn into one by one through render target views of single mip slices – the
   * render targets "res:N~level" hold levels 1 and up.
   */
  targetLevels = 1;
  /** The texture is drawn into through views of single array slices (one cube face per view). */
  perSlice = false;

  constructor(init: { id: number; buffer?: boolean; width?: number; height?: number }) {
    this.id = init.id;
    if (init.buffer !== undefined) this.buffer = init.buffer;
    if (init.width !== undefined) this.width = init.width;
    if (init.height !== undefined) this.height = init.height;
  }

  levelTarget(level: number): string {
    return level > 0 ? `${this.targetId}~${level}` : this.targetId;
  }
}

/** A vertex buffer view set on the command list: its GPU address and stride. */
export interface VertexBufferView {
  readonly address: number;
  readonly stride: number;
}

/** An index buffer view: its GPU address and bytes per index. */
export interface IndexBufferView {
  readonly address: number;
  readonly bytes: number;
}

/**
 * What is set on the command list when a draw is recorded. (A C# record.)
 * `target`: the render target the descriptor named when the draw was recorded (a program may write another view into
 * the same descriptor for its next pass: one RTV slot for every face of a cube map); null for the window.
 */
export class DrawState {
  constructor(
    readonly renderTarget: number | null,
    readonly vertexBuffers: ReadonlyMap<number, VertexBufferView>,
    readonly indexBuffer: IndexBufferView | null,
    readonly tables: ReadonlyMap<number, number>,
    readonly rootCbvs: ReadonlyMap<number, number> | null = null,
    readonly target: string | null = null,
    readonly topology: string | null = null,
    readonly noHeap: boolean = false,
    readonly pso: string | null = null,
  ) {}
}

const AddressUnit = 1e9;
const HeapUnit = 1e6;

/** GP_D3D12_DEBUG set: every call the device model sees is printed (C#: Console.Error). */
const Debug = typeof process !== "undefined" && process.env?.["GP_D3D12_DEBUG"] !== undefined;

const isNullName = (e: A.Expr | undefined): boolean => e instanceof A.Name && (e.id === "nullptr" || e.id === "NULL");

/**
 * A small model of a Direct3D 12 device, for the simulator: while the program's setup (LoadPipeline, LoadAssets and
 * the helpers they call) and its command list recording run in the C++ runner, it follows the resources the program
 * creates (buffers with their bytes, textures with their images, render targets), the descriptors it writes into
 * heaps (SRVs, RTVs, DSVs) and, per draw, the render target, vertex and index buffer views and descriptor tables that
 * are set. GPU addresses and CPU pointers are numbers (resource × 10⁹ + byte offset); descriptor handles are numbers
 * too (heap × 10⁶ + index; every descriptor increment is 1).
 */
export class D3D12Device implements IDeviceModel {
  /** @internal */ readonly src: CppSource;
  /** @internal */ readonly project: GpuProject;
  private readonly resources: Resource[] = [];
  /** @internal */ readonly heaps = new Map<string, number>();
  private readonly images = new Map<string, Image | null>();
  /** SRVs by handle: the resource and whether it is viewed as a cube map. */
  readonly srvs = new Map<number, { resource: number; cube: boolean }>();
  /** Resources drawn as a further render target of another one's target: resource → (target, attachment). */
  private readonly attachmentOf = new Map<number, { target: string; attachment: number }>();
  /** Per render target: how many colour attachments, and whether a depth stencil view is bound with it. */
  private readonly targetShape = new Map<string, { colors: number; depth: boolean }>();

  shapeOf(target: string): { colors: number; depth: boolean } | null {
    return this.targetShape.get(target) ?? null;
  }

  /** A depth resource → the first off-screen target drawn with it; a target → the target whose depth it shares. */
  private readonly depthUsers = new Map<number, string>();
  private readonly depthOfTarget = new Map<string, string>();

  /** The channels each colour attachment of a target keeps (an R8_UNORM revealage texture: 1), or null. */
  channelsOf(target: string, colors: number): number[] | null {
    const formats: (string | null)[] = new Array<string | null>(Math.max(1, colors)).fill(null);
    for (const r of this.resources.filter((r) => r.targetId === target)) formats[0] = r.format;
    for (const [id, { target: t, attachment: k }] of this.attachmentOf) {
      const attached = t === target && k < formats.length ? this.resourceAt(id) : null;
      if (attached !== null) formats[k] = attached.format;
    }
    return FormatChannels.list(formats.map((f) => FormatChannels.of(f)));
  }

  /** The target whose depth buffer a target uses too (both drawn with one depth stencil view), or null. */
  depthOf(target: string): string | null {
    return this.depthOfTarget.get(target) ?? null;
  }

  /** SRVs that read their texture as sRGB (an _SRGB view format, or the resource's own). */
  private readonly srgbSrvs = new Set<number>();

  /** The back buffer's render target view has an _SRGB format: what is drawn into the window is encoded. */
  windowSrgb = false;
  readonly rtvs = new Map<number, number>();
  /** Render target views of one array slice (a cube map's face) and/or mip level: handle → (slice, level). */
  private readonly rtvSlices = new Map<number, { slice: number; level: number }>();
  readonly dsvs = new Map<number, number>();
  private flip = false;
  /** @internal */ exec: CppExec | null = null;

  // The command list's state while recording.
  private renderTarget: number | null = null;
  private readonly vertexBuffers = new Map<number, VertexBufferView>();
  private indexBuffer: IndexBufferView | null = null;
  private readonly tables = new Map<number, number>();
  private readonly rootCbvs = new Map<number, number>();
  /** The primitive topology set last (IASetPrimitiveTopology): a program may change it between draws. */
  private topology: string | null = null;

  /** Clears and copies recorded so far: (draw count then, the op, with targets as resource ids "res:N"). */
  readonly ops: FrameOp[] = [];
  drawCount: () => number = () => 0;

  // ---------- D3D12Device.Debug.cs ----------
  /** @internal */ readonly storedMessages: DebugMessage[] = [];
  /** @internal */ readonly objectNames = new Map<string, string>();
  /** @internal */ readonly invalidSrvs = new Set<number>();
  /** @internal */ debugLayer = false;
  /** @internal */ heapsSet = false;
  /** @internal */ tablesWithoutHeap = false;
  /** @internal */ messageCallback: string | null = null;
  /** @internal */ infoQueues = 0;

  // ---------- D3D12Device.Pipelines.cs ----------
  /** @internal */ readonly blobs: ShaderBlob[] = [];
  /** @internal */ boundPso: string | null = null;
  /** Every PSO made: its handle → its description (D3D12_GRAPHICS_PIPELINE_STATE_DESC, the blobs as "blob#k"). */
  readonly createdPsos = new Map<string, ShaderValue>();

  /** A compiled shader blob's file, entry point and target ("blob#k"). */
  blob(handle: string | null | undefined): ShaderBlob | null {
    return blobOf(this, handle);
  }

  // ---------- D3D12Device.Compute.cs ----------
  /** Compute PSOs: handle → the compute shader's file and entry point. */
  /** @internal */ readonly computePsos = new Map<string, { file: string; entry: string }>();
  /** UAVs by descriptor handle: the resource. */
  /** @internal */ readonly uavs = new Map<number, number>();
  /** @internal */ readonly computeTables = new SortedMap<number>();
  /** @internal */ readonly computeConstants = new SortedMap<ShaderValue>();
  /** @internal */ readonly computePrograms = new Map<string, ShaderProgram | null>();

  constructor(src: CppSource, project: GpuProject) {
    this.src = src;
    this.project = project;
  }

  attach(exec: CppExec): void {
    this.exec = exec;
  }

  resourceAt(id: number): Resource | null {
    return id >= 1 && id <= this.resources.length ? this.resources[id - 1]! : null;
  }

  get allResources(): readonly Resource[] {
    return this.resources;
  }

  snapshot(): DrawState {
    const rt = this.renderTarget;
    return new DrawState(rt, new Map(this.vertexBuffers), this.indexBuffer, new Map(this.tables), new Map(this.rootCbvs),
      rt !== null ? this.targetOf(rt) : null, this.topology, this.tablesWithoutHeap, this.boundPso);
  }

  /** @internal */
  eval(e: A.Expr): ShaderValue | null {
    try {
      return this.exec!.runner.evalArg(e);
    } catch (x) {
      if (x instanceof ShaderRuntimeException) return null;
      throw x;
    }
  }

  /** @internal */
  num(e: A.Expr): number {
    const v = this.eval(e);
    return v !== null && v.v !== null && v.v.length > 0 ? v.v[0]! : 0;
  }

  /** @internal */
  static strip(e: A.Expr): A.Expr {
    if (e instanceof A.Unary && (e.op === "&" || e.op === "*")) return D3D12Device.strip(e.operand);
    if (e instanceof A.Call && (e.function_ === "Get" || e.function_ === ".Get") && e.args.length === 1) return D3D12Device.strip(e.args[0]!);
    return e;
  }

  /** The variable an IID_PPV_ARGS(&amp;x) or reinterpret_cast&lt;…&gt;(&amp;x) argument writes to. @internal */
  static outTarget(e: A.Expr): A.Expr | null {
    if (e instanceof A.Call && (e.function_ === "IID_PPV_ARGS" || e.function_ === "reinterpret_cast" || e.function_ === "static_cast") && e.args.length === 1)
      return D3D12Device.outTarget(e.args[0]!);
    if (e instanceof A.Unary && e.op === "&") return e.operand;
    if (e instanceof A.Binary && e.op === ">") return D3D12Device.outTarget(e.right);
    // The parser keeps no address-of: &x arrives as x.
    if (e instanceof A.Name || e instanceof A.Member || e instanceof A.IndexOf) return e;
    return null;
  }

  /** @internal */
  resourceOf(e: A.Expr): Resource | null {
    const v = this.eval(D3D12Device.strip(e));
    const t = v?.text ?? null;
    if (t !== null && t.startsWith("res:")) {
      const id = tryParseInt(t.slice(4));
      if (id !== null) return this.resourceAt(id);
    }
    if (v !== null && v.v !== null && v.v.length > 0 && v.v[0]! >= AddressUnit) return this.resourceAt(toInt(v.v[0]! / AddressUnit));
    return null;
  }

  private newResource(target: A.Expr, desc: ShaderValue | null): Resource {
    const r = new Resource({ id: this.resources.length + 1 });
    this.resources.push(r);
    const f = desc?.fields ?? null;
    if (f !== null) {
      const text = (k: string): string => f.get(k)?.text ?? "";
      const int = (k: string, fallback: number): number => {
        const x = f.get(k);
        return x !== undefined && x.v !== null && x.v.length > 0 ? toInt(x.v[0]!) : fallback;
      };
      r.buffer = text("Dimension").includes("BUFFER");
      r.width = int("Width", 0);
      r.height = int("Height", 1);
      r.arraySize = Math.max(1, int("DepthOrArraySize", 1));
      const format = text("Format");
      r.format = format;
      r.float = format.includes("FLOAT") && !format.startsWith("DXGI_FORMAT_D");
      r.srgb = format.includes("_SRGB");
      r.depth = format.startsWith("DXGI_FORMAT_D") || text("Flags").includes("DEPTH_STENCIL");
      const c = f.get("SampleDesc")?.fields?.get("Count");
      if (c !== undefined && c.v !== null && c.v.length > 0) r.samples = toInt(c.v[0]!);
    }
    this.exec!.runner.assign(target, ShaderValue.str("res:" + r.id));
    return r;
  }

  /** @internal */
  static desc(...fields: [string, ShaderValue][]): ShaderValue {
    return ShaderValue.struct(new Map(fields));
  }

  /** Handles a call during setup or recording; null when it is not one this model follows. */
  hook(name: string, args: readonly A.Expr[]): ShaderValue | null {
    const exec = this.exec;
    if (exec === null) return null;
    if (Debug && name !== "ThrowIfFailed") console.error(`[d3d12] ${name}(${args.map((a) => this.eval(a)?.toString() ?? "?").join(", ")})`);
    const answered = debugLayerCall(this, name, args);
    if (answered !== null) return answered;
    const made = pipelineCall(this, name, args);
    if (made !== null) return made;
    const computed = computeCall(this, name, args);
    if (computed !== null) return computed;
    const n = args.length;
    const desc = D3D12Device.desc;
    const strip = D3D12Device.strip;
    switch (name) {
      case "ThrowIfFailed":
        if (n >= 1) {
          this.eval(args[0]!);
          return ShaderValue.scalar(0);
        }
        break;
      case "CD3DX12_RESOURCE_DESC::Buffer":
        if (n >= 1) return desc(["Dimension", ShaderValue.str("D3D12_RESOURCE_DIMENSION_BUFFER")], ["Width", ShaderValue.scalar(this.num(args[0]!))]);
        break;
      case "CD3DX12_RESOURCE_DESC::Tex2D":
        if (n >= 3)
          return desc(["Dimension", ShaderValue.str("D3D12_RESOURCE_DIMENSION_TEXTURE2D")], ["Format", this.eval(args[0]!) ?? ShaderValue.str("")],
            ["Width", ShaderValue.scalar(this.num(args[1]!))], ["Height", ShaderValue.scalar(this.num(args[2]!))],
            ["DepthOrArraySize", ShaderValue.scalar(n > 3 ? this.num(args[3]!) : 1)],
            ["SampleDesc", desc(["Count", ShaderValue.scalar(n > 5 ? Math.max(1, this.num(args[5]!)) : 1)])],
            ["Flags", n > 7 ? this.eval(args[7]!) ?? ShaderValue.str("") : ShaderValue.str("")]);
        break;
      case ".CreateCommittedResource": {
        const created = n >= 7 ? D3D12Device.outTarget(args[6]!) : null;
        if (created !== null) {
          this.newResource(created, this.eval(strip(args[3]!)));
          return ShaderValue.scalar(0);
        }
        break;
      }
      case ".GetBuffer": {
        const backBuffer = n >= 3 ? D3D12Device.outTarget(args[2]!) : null;
        if (backBuffer !== null) {
          this.newResource(backBuffer, null).window = true;
          return ShaderValue.scalar(0);
        }
        break;
      }
      case ".GetGPUVirtualAddress":
        if (n >= 1) {
          const res = this.resourceOf(args[0]!);
          return res !== null ? ShaderValue.scalar(res.id * AddressUnit) : ShaderValue.scalar(0);
        }
        break;
      case ".Map": {
        const pointer = n >= 4 ? D3D12Device.outTarget(args[3]!) : null;
        if (pointer !== null) {
          const mapped = this.resourceOf(args[0]!);
          if (mapped !== null) exec.runner.assign(pointer, ShaderValue.scalar(mapped.id * AddressUnit));
          return ShaderValue.scalar(0);
        }
        break;
      }
      case "memcpy":
        if (n >= 2) {
          this.write(args[0]!, args[1]!, n > 2 ? args[2]! : null);
          return ShaderValue.scalar(0);
        }
        break;
      case ".CopyBufferRegion":
        if (n >= 6) {
          const dst = this.resourceOf(args[1]!);
          const srcRes = dst === null ? null : this.resourceOf(args[3]!);
          if (dst === null || srcRes === null) return ShaderValue.scalar(0);
          const dstOff = toLong(this.num(args[2]!)), srcOff = toLong(this.num(args[4]!)), bytes = toLong(this.num(args[5]!));
          for (const [k, v] of [...srcRes.memory.entries()].filter(([key]) => key >= srcOff && key < srcOff + bytes)) dst.memory.set(k - srcOff + dstOff, v);
          return ShaderValue.scalar(0);
        }
        break;
      case ".CopyResource":
        if (n >= 3) {
          const dst = this.resourceOf(args[1]!);
          const srcRes = dst === null ? null : this.resourceOf(args[2]!);
          if (dst !== null && srcRes !== null) {
            for (const [k, v] of [...srcRes.memory.entries()]) dst.memory.set(k, v);
            if (srcRes.images.length > 0) dst.images.push(...srcRes.images);
          }
          return ShaderValue.scalar(0);
        }
        break;
      case "UpdateSubresources":
        if (n >= 7) {
          this.updateSubresources(args);
          return ShaderValue.scalar(0);
        }
        break;
      case "stbi_set_flip_vertically_on_load":
        if (n >= 1) {
          if (this.num(args[0]!) !== 0) this.flip = true;
          else {
            const t = this.eval(args[0]!)?.text;
            this.flip = t === "true" || t === "TRUE";
          }
          return ShaderValue.scalar(0);
        }
        break;
      case "stbi_load": case "stbi_loadf":
        if (n >= 5) {
          const path = this.eval(args[0]!)?.text ?? null;
          if (path === null) return ShaderValue.scalar(0);
          const wanted = toInt(this.num(args[4]!));
          const image = StbImage.load(this.project, path, this.flip, wanted);
          const key = `img:${this.images.size}:${path}`;
          this.images.set(key, image);
          if (image !== null) {
            exec.runner.assign(strip(args[1]!), ShaderValue.scalar(image.width));
            exec.runner.assign(strip(args[2]!), ShaderValue.scalar(image.height));
            const fileChannels = StbImage.fileChannels(this.project, path);
            exec.runner.assign(strip(args[3]!), ShaderValue.scalar(fileChannels));
            // The bytes, read through a pointer (pixelOffset[0]): the channels asked for (0: the file's).
            exec.runner.pointerRead ??= (handle, at) => {
              const img = this.images.get(handle);
              return img !== undefined && img !== null ? StbImage.byte(img, img.channels, at) : null;
            };
          }
          return ShaderValue.str(key);
        }
        break;
      case ".GetDescriptorHandleIncrementSize":
        return ShaderValue.scalar(1);
      case ".GetCPUDescriptorHandleForHeapStart": case ".GetGPUDescriptorHandleForHeapStart":
        if (n >= 1) {
          const heap = this.heapName(args[0]!);
          let at = this.heaps.get(heap);
          if (at === undefined) this.heaps.set(heap, at = (this.heaps.size + 1) * HeapUnit);
          return ShaderValue.scalar(at);
        }
        break;
      case "CD3DX12_CPU_DESCRIPTOR_HANDLE": case "CD3DX12_GPU_DESCRIPTOR_HANDLE":
        if (n >= 1) {
          if (n === 1) return ShaderValue.scalar(this.num(args[0]!));
          if (n === 2) return ShaderValue.scalar(this.num(args[0]!) + this.num(args[1]!));
          return ShaderValue.scalar(this.num(args[0]!) + this.num(args[1]!) * this.num(args[2]!));
        }
        break;
      case ".Offset":
        if (n >= 2) {
          const a = this.num(args[0]!), b = this.num(args[1]!);
          exec.runner.assign(args[0]!, ShaderValue.scalar(a + b * (n > 2 ? this.num(args[2]!) : 1)));
          return ShaderValue.scalar(0);
        }
        break;
      case ".CreateShaderResourceView":
        if (n >= 4) {
          const viewed = this.resourceOf(args[1]!);
          if (viewed !== null) {
            const d = isNullName(args[2]) ? null : this.eval(strip(args[2]!));
            const cube = d?.fields?.get("ViewDimension")?.text?.includes("TEXTURECUBE") === true;
            this.srvs.set(toLong(this.num(args[3]!)), { resource: viewed.id, cube });
            checkSrv(this, d, toLong(this.num(args[3]!)));
            const srvFormat = d?.fields?.get("Format")?.text ?? null;
            if (srvFormat !== null ? srvFormat.includes("_SRGB") : viewed.srgb) this.srgbSrvs.add(toLong(this.num(args[3]!)));
            else this.srgbSrvs.delete(toLong(this.num(args[3]!)));
          }
          return ShaderValue.scalar(0);
        }
        break;
      case ".CreateRenderTargetView":
        if (n >= 4) {
          const rt = this.resourceOf(args[1]!);
          if (rt !== null) this.createRenderTargetView(rt, args);
          return ShaderValue.scalar(0);
        }
        break;
      case ".CreateDepthStencilView":
        if (n >= 4) {
          const ds = this.resourceOf(args[1]!);
          if (ds !== null) this.dsvs.set(toLong(this.num(args[3]!)), ds.id);
          return ShaderValue.scalar(0);
        }
        break;

      // ---------- recording ----------
      case ".OMSetRenderTargets":
        if (n >= 3) {
          this.omSetRenderTargets(args);
          return ShaderValue.scalar(0);
        }
        break;
      case ".ClearRenderTargetView":
        if (n >= 3) {
          const color = this.eval(strip(args[2]!));
          const rgba: number[] = [];
          if (color !== null) CppExec.flatten(color, rgba);
          // One view's target: an RTV that is attachment k of the render targets set (OMSetRenderTargets with
          // several) clears that attachment only; the first one attachment 0.
          const rtvHandle = toLong(this.num(args[1]!));
          const viewed = this.rtvs.get(rtvHandle);
          const att = viewed !== undefined ? this.attachmentOf.get(viewed) : undefined;
          let cleared: string | null, attachment: number | null;
          if (att !== undefined) [cleared, attachment] = [att.target, att.attachment];
          else {
            const single = this.targetOf(rtvHandle);
            const shape = single !== null ? this.targetShape.get(single) : undefined;
            [cleared, attachment] = [this.targetOf(rtvHandle), shape !== undefined && shape.colors > 1 ? 0 : null];
          }
          this.ops.push(new ClearOp(this.drawCount(), cleared, rgba.length >= 3 ? rgba.slice() : null, null, null, attachment));
          return ShaderValue.scalar(0);
        }
        break;
      case ".ClearDepthStencilView":
        if (n >= 5) {
          const flags = (this.eval(args[2]!)?.text ?? "") + " " + flagNames(args[2]!).join(" ");
          const depth = flags.includes("DEPTH"), stencil = flags.includes("STENCIL");
          const t = this.renderTarget;
          this.ops.push(new ClearOp(this.drawCount(), t !== null ? this.targetOf(t) : null, null, depth ? this.num(args[3]!) : null, stencil ? toInt(this.num(args[4]!)) : null));
          return ShaderValue.scalar(0);
        }
        break;
      case ".IASetPrimitiveTopology":
        if (n >= 2) {
          const a = args[1]!;
          this.topology = this.eval(a)?.text ?? (a instanceof A.Name ? a.id : this.topology);
          return ShaderValue.scalar(0);
        }
        break;
      case ".IASetVertexBuffers":
        if (n >= 4) {
          const start = toInt(this.num(args[1]!)), count = toInt(this.num(args[2]!));
          const views = this.eval(strip(args[3]!));
          const list = views?.items ?? (views === null ? [] : [views]);
          for (let i = 0; i < count && i < list.length; i++) {
            const f = list[i]!.fields;
            if (f === null) continue;
            this.vertexBuffers.set(start + i, { address: toLong(f.get("BufferLocation")?.x ?? 0), stride: toInt(f.get("StrideInBytes")?.x ?? 0) });
          }
          return ShaderValue.scalar(0);
        }
        break;
      case ".IASetIndexBuffer":
        if (n >= 2) {
          const f = this.eval(strip(args[1]!))?.fields ?? null;
          if (f !== null)
            this.indexBuffer = { address: toLong(f.get("BufferLocation")?.x ?? 0), bytes: (f.get("Format")?.text ?? "").includes("R16") ? 2 : 4 };
          return ShaderValue.scalar(0);
        }
        break;
      case ".SetGraphicsRootConstantBufferView":
        if (n >= 3) {
          this.rootCbvs.set(toInt(this.num(args[1]!)), toLong(this.num(args[2]!)));
          return ShaderValue.scalar(0);
        }
        break;
      case ".Load":
        if (n >= 6) {
          const objPath = this.eval(args[1]!)?.text ?? null;
          if (objPath !== null && (objPath.toLowerCase().endsWith(".obj") || GltfModel.isGltf(objPath))) {
            this.loadModel(args[0]!, objPath, args[4]!, toInt(this.num(args[5]!)));
            return ShaderValue.scalar(0);
          }
        }
        break;
      case ".SetGraphicsRootDescriptorTable":
        if (n >= 3) {
          this.tables.set(toInt(this.num(args[1]!)), toLong(this.num(args[2]!)));
          if (!this.heapsSet) tableWithoutHeap(this, toLong(this.num(args[2]!)));
          return null; // the frame recorder records it too
        }
        break;
      case ".ResolveSubresource":
        if (n >= 5) {
          const dst = this.resourceOf(args[1]!);
          const from = dst === null ? null : this.resourceOf(args[3]!);
          if (dst !== null && from !== null) this.ops.push(new CopyOp(this.drawCount(), from.window ? null : from.targetId, dst.window ? null : dst.targetId));
          return ShaderValue.scalar(0);
        }
        break;
    }
    return null;
  }

  private updateSubresources(args: readonly A.Expr[]): void {
    const dst = this.resourceOf(args[1]!);
    if (dst === null) return;
    const data = this.eval(D3D12Device.strip(args[6]!));
    const list = data?.items ?? (data === null ? [] : [data]);
    const first = toInt(this.num(args[4]!)), count = toInt(Math.max(1, this.num(args[5]!)));
    for (let i = 0; i < Math.min(count, list.length); i++) {
      const item = list[i]!;
      const pDataValue = item.fields?.get("pData") ?? null;
      const pData = pDataValue?.text ?? null;
      let image = pData !== null ? (this.images.get(pData) ?? null) : null;
      // Data the program computed (the SSAO noise: XMFLOAT4 noise[16]): its numbers, four per texel (RGBA).
      if (image === null && pDataValue !== null && pData === null && dst.width > 0) {
        const numbers: number[] = [];
        CppExec.flatten(pDataValue, numbers);
        const w = dst.width, h = Math.max(1, dst.height);
        if (numbers.length >= w * h) {
          const per = clamp(Math.trunc(numbers.length / (w * h)), 1, 4);
          // An 8-bit UNORM format: the numbers are bytes, 0–255 (a glyph atlas of unsigned chars).
          const ofBytes = dst.format.includes("UNORM") && !dst.format.includes("16") && numbers.some((v) => v > 1);
          const floats = new Array<number>(w * h * 4).fill(0);
          const bytes = new Uint8Array(w * h * 4);
          for (let t = 0; t < w * h; t++)
            for (let k = 0; k < 4; k++) {
              const v = k < per ? numbers[t * per + k]! / (ofBytes ? 255.0 : 1.0) : (k === 3 ? 1 : 0);
              floats[t * 4 + k] = v;
              bytes[t * 4 + k] = toByte(roundEven(clamp(v, 0, 1) * 255));
            }
          image = new Image(w, h, 4, bytes, floats);
        }
      }
      while (dst.images.length <= first + i) dst.images.push(null);
      dst.images[first + i] = image;
    }
  }

  private createRenderTargetView(rt: Resource, args: readonly A.Expr[]): void {
    const rtvHandle = toLong(this.num(args[3]!));
    this.rtvs.set(rtvHandle, rt.id);
    const rtvDesc = isNullName(args[2]) ? null : this.eval(D3D12Device.strip(args[2]!));
    // A view of one array slice (D3D12_RTV_DIMENSION_TEXTURE2DARRAY with ArraySize 1: a cube map's face)
    // and/or one mip level: draws through it go into that face and level.
    this.rtvSlices.delete(rtvHandle);
    const arrayView = rtvDesc?.fields?.get("Texture2DArray") ?? null;
    const flatView = rtvDesc?.fields?.get("Texture2D") ?? null;
    const isArrayView = rtvDesc?.fields?.get("ViewDimension")?.text?.includes("TEXTURE2DARRAY") === true;
    const level = toInt((isArrayView ? arrayView : flatView)?.fields?.get("MipSlice")?.x ?? 0);
    const slice = isArrayView ? toInt(arrayView?.fields?.get("FirstArraySlice")?.x ?? 0) : 0;
    const oneSlice = isArrayView && (arrayView?.fields?.get("ArraySize")?.x ?? 0) === 1;
    if (!rt.window && (oneSlice || level > 0)) {
      this.rtvSlices.set(rtvHandle, { slice: oneSlice ? slice : 0, level });
      if (oneSlice) rt.perSlice = true;
      rt.targetLevels = Math.max(rt.targetLevels, level + 1);
    }
    // A back buffer viewed as _SRGB: what is drawn into the window is encoded.
    const rtvFormat = rtvDesc?.fields?.get("Format")?.text ?? null;
    if (rt.window && rtvFormat !== null) this.windowSrgb = rtvFormat.includes("_SRGB");
  }

  private omSetRenderTargets(args: readonly A.Expr[]): void {
    const n = args.length;
    const strip = D3D12Device.strip;
    let rtv: ShaderValue | null = null;
    if (this.num(args[1]!) > 0 && (rtv = this.eval(strip(args[2]!))) !== null) {
      const items = rtv.items;
      this.renderTarget = toLong(items !== null && items.length > 0 ? items[0]!.x : rtv.x);
    } else this.renderTarget = null;
    // No render target, only a depth stencil view (a shadow map's depth pass): the draws go into the
    // texture behind that view (written as -handle - 1).
    if (this.renderTarget === null && n >= 5 && !isNullName(args[4])) {
      const dsv = this.eval(strip(args[4]!));
      if (dsv !== null && dsv.v !== null && dsv.v.length > 0) {
        const depthOnly = this.dsvs.get(toLong(dsv.v[0]!));
        const depthRes = depthOnly !== undefined ? this.resourceAt(depthOnly) : null;
        if (depthRes !== null && !depthRes.window && this.srvOf(depthRes.id)) this.renderTarget = -toLong(dsv.v[0]!) - 1;
      }
    }
    // Several render targets (bloom's bright colour: SV_TARGET1): RTV k is attachment k of the first one's target.
    const firstRtv = this.renderTarget;
    const mrtTarget = firstRtv !== null && firstRtv >= 0 ? this.targetOf(firstRtv) : null;
    if (firstRtv !== null && mrtTarget !== null) {
      const count = toInt(this.num(args[1]!));
      const single = n >= 4 && (this.eval(args[3]!)?.x ?? 0) !== 0;
      const listed = this.eval(strip(args[2]!))?.items ?? null;
      for (let k = 1; k < count; k++) {
        const handle = single || listed === null || k >= listed.length ? firstRtv + k : toLong(listed[k]!.x);
        const extra = this.rtvs.get(handle);
        if (extra !== undefined) this.attachmentOf.set(extra, { target: mrtTarget, attachment: k });
      }
      const hasDsv = n >= 5 && !isNullName(args[4]);
      const old = this.targetShape.get(mrtTarget);
      this.targetShape.set(mrtTarget, { colors: Math.max(1, count), depth: hasDsv || (old !== undefined && old.depth) });
      // One depth buffer for two targets (weighted blended OIT's transparent pass tests against the opaque
      // pass's depth): the second uses the first one's.
      if (hasDsv) {
        const dsvHandle = this.eval(strip(args[4]!));
        const depthResource = dsvHandle !== null && dsvHandle.v !== null && dsvHandle.v.length > 0 ? this.dsvs.get(toLong(dsvHandle.v[0]!)) : undefined;
        if (depthResource !== undefined) {
          const firstUser = this.depthUsers.get(depthResource);
          if (firstUser === undefined) this.depthUsers.set(depthResource, mrtTarget);
          else if (firstUser !== mrtTarget) this.depthOfTarget.set(mrtTarget, firstUser);
        }
      }
    }
  }

  /**
   * The course's Model::Load(path, device, commandList, heap, firstDescriptor) – learnopengl's Model ported: per mesh a
   * vertex buffer (position, normal, texture coordinates: 32 bytes a vertex), a 32-bit index buffer and two SRVs (the
   * diffuse and specular maps) at firstDescriptor + 2 × mesh; model.meshes[i].vertexBufferView / indexBufferView /
   * srvHandle / indices then hold them, for code that draws the meshes itself (the asteroid field).
   */
  private loadModel(target: A.Expr, path: string, heapExpr: A.Expr, firstDescriptor: number): void {
    const model = ObjModel.load(this.project, path);
    if (model === null) return;
    const flipUv = ModelFiles.flipUVs(this.src, this.project);
    const heap = this.heapName(heapExpr);
    let heapStart = this.heaps.get(heap);
    if (heapStart === undefined) this.heaps.set(heap, heapStart = (this.heaps.size + 1) * HeapUnit);
    const meshes: ShaderValue[] = [];
    for (let m = 0; m < model.meshes.length; m++) {
      const mesh = model.meshes[m]!;
      const vb = new Resource({ id: this.resources.length + 1, buffer: true });
      this.resources.push(vb);
      for (let v = 0; v < mesh.positions.length; v++) {
        const tc = mesh.texCoords[v]!;
        const values = [...mesh.positions[v]!, ...mesh.normals[v]!, tc[0]!, flipUv ? 1 - tc[1]! : tc[1]!];
        for (let k = 0; k < 8; k++) {
          // C# indexes the array: a vertex with fewer than 8 numbers throws.
          if (k >= values.length) throw new RangeError("Index was outside the bounds of the array.");
          vb.memory.set(v * 32 + k * 4, values[k]!);
        }
      }
      const ib = new Resource({ id: this.resources.length + 1, buffer: true });
      this.resources.push(ib);
      for (let k = 0; k < mesh.indices.length; k++) ib.memory.set(k * 4, mesh.indices[k]!);
      const slot = toLong(heapStart) + firstDescriptor + 2 * m;
      for (const [file, offset] of [[mesh.material?.diffuseMap ?? null, 0], [mesh.material?.specularMap ?? null, 1]] as const) {
        const tex = new Resource({ id: this.resources.length + 1, width: 1, height: 1 });
        this.resources.push(tex);
        tex.images.push(ModelFiles.texture(this.project, path, file, false)?.image ?? null);
        this.srvs.set(slot + offset, { resource: tex.id, cube: false });
      }
      const desc = D3D12Device.desc;
      meshes.push(ShaderValue.struct(new Map<string, ShaderValue>([
        ["vertexBufferView", desc(["BufferLocation", ShaderValue.scalar(vb.id * AddressUnit)], ["StrideInBytes", ShaderValue.scalar(32)], ["SizeInBytes", ShaderValue.scalar(mesh.positions.length * 32)])],
        ["indexBufferView", desc(["BufferLocation", ShaderValue.scalar(ib.id * AddressUnit)], ["Format", ShaderValue.str("DXGI_FORMAT_R32_UINT")], ["SizeInBytes", ShaderValue.scalar(mesh.indices.length * 4)])],
        ["srvHandle", ShaderValue.scalar(slot)],
        ["indices", ShaderValue.array(mesh.indices.map((i) => ShaderValue.integer(i)))],
        ["vertices", this.modelVertices(mesh, flipUv)],
      ])));
    }
    // The meshes are the device's: a copy of a struct that points at the model (Entity's Model* pModel) shares them.
    const modelValue = new Map<string, ShaderValue>([["meshes", new ShaderValue({ items: meshes, shared: true })]]);
    // A skinned model whose class reads the bones (learnopengl's model_animation.h): its bones by name and their count.
    const gltf = model.gltf;
    if (gltf !== null) {
      const extracts = /\bExtractBoneWeightForVertices\s*\([^)]*\)\s*;/.test(this.src.code);
      modelValue.set("m_BoneInfoMap", extracts ? gltf.boneInfoMap(true) : new ShaderValue({ map: new SortedMap<ShaderValue>() }));
      modelValue.set("m_BoneCounter", ShaderValue.integer(extracts ? gltf.bones.length : 0));
    }
    this.exec!.runner.assign(target, ShaderValue.struct(modelValue));
  }

  /**
   * A mesh's vertices as the program's Vertex struct (position, normal, texture coordinates by their names), for code
   * that reads them (a bounding volume around the model).
   */
  private modelVertices(mesh: ObjMesh, flipUv: boolean): ShaderValue {
    const fields = StructLayout.fields(this.src, "Vertex")?.map((f) => f.name) ?? ["position", "normal", "texCoord"];
    return ShaderValue.array(mesh.positions.map((_, v) => {
      const map = new Map<string, ShaderValue>();
      for (const f of fields) {
        // ToDictionary: a field named twice throws.
        if (map.has(f)) throw new Error(`An item with the same key has already been added. Key: ${f}`);
        const lower = f.toLowerCase();
        map.set(f, lower.includes("pos") ? ShaderValue.vecOf(mesh.positions[v]!.slice())
          : lower.includes("normal") ? ShaderValue.vecOf(mesh.normals[v]!.slice())
          : lower.includes("tex") || lower.includes("uv") ? ShaderValue.vec(mesh.texCoords[v]![0]!, flipUv ? 1 - mesh.texCoords[v]![1]! : mesh.texCoords[v]![1]!)
          : ShaderValue.vec(0, 0, 0));
      }
      return ShaderValue.struct(map);
    }));
  }

  /**
   * The values of a cbuffer bound as a root constant buffer view, read from the buffer's memory with HLSL's packing:
   * 16-byte rows, a vector never crosses a row, every array element starts a new row; matrices are read as stored
   * (the program stores them transposed for column_major HLSL). A cbuffer matrix: HLSL packs it column by column
   * (column_major), the runner's own order.
   */
  cbufferAt(address: number, fields: readonly A.Field[], components: (type: string) => number): Map<string, ShaderValue> | null {
    const res = address < AddressUnit ? null : this.resourceAt(toInt(address / AddressUnit));
    if (res === null) return null;
    const baseOffset = address - res.id * AddressUnit;
    const get = (at: number): number => res.memory.get(baseOffset + at) ?? 0;
    const matrixOf = (v: number[]): ShaderValue => ShaderValue.matrix(v.length === 16 ? 4 : 3, v);
    const values = new Map<string, ShaderValue>();
    let offset = 0;
    for (const f of fields) {
      const n = components(f.type);
      const matrix = n === 16 || n === 9;
      if (f.arraySize > 0) {
        offset = Math.trunc((offset + 15) / 16) * 16;
        const items: ShaderValue[] = [];
        for (let i = 0; i < f.arraySize; i++) {
          const v = new Array<number>(n).fill(0);
          for (let k = 0; k < n; k++) v[k] = get(offset + k * 4);
          items.push(matrix ? matrixOf(v) : ShaderValue.vecOf(v));
          offset += Math.max(16, Math.trunc((n * 4 + 15) / 16) * 16);
        }
        values.set(f.id, ShaderValue.array(items));
        continue;
      }
      const bytes = n * 4;
      if (matrix || Math.trunc(offset / 16) !== Math.trunc((offset + bytes - 1) / 16)) offset = Math.trunc((offset + 15) / 16) * 16;
      const value = new Array<number>(n).fill(0);
      for (let k = 0; k < n; k++) value[k] = get(offset + k * 4);
      values.set(f.id, matrix ? matrixOf(value) : ShaderValue.vecOf(value));
      offset += bytes;
    }
    return values;
  }

  /** @internal */
  heapName(e: A.Expr): string {
    const s = D3D12Device.strip(e);
    if (s instanceof A.Name) return s.id;
    if (s instanceof A.Member) return s.field;
    if (s instanceof A.Call && s.function_ === ".Get" && s.args.length === 1) return this.heapName(s.args[0]!);
    return "heap";
  }

  /** The render target id of an RTV handle: null for a swap chain buffer (the window). */
  targetOf(handle: number): string | null {
    if (handle < 0) {
      const d = this.dsvs.get(-handle - 1);
      const dr = d !== undefined ? this.resourceAt(d) : null;
      return dr !== null && !dr.window ? dr.targetId : null;
    }
    const id = this.rtvs.get(handle);
    const r = id !== undefined ? this.resourceAt(id) : null;
    if (r === null || r.window) return null;
    // "res:N", "res:N~2" for mip level 2, "…@3" for array slice (cube face) 3.
    const view = this.rtvSlices.get(handle);
    if (view === undefined) return r.targetId;
    const level = r.levelTarget(view.level);
    return view.slice > 0 ? level + "@" + view.slice : level;
  }

  /** The resource behind a target id ("res:N~2@3"), and the mip level it names. */
  targetResource(id: string): { resource: Resource; level: number } | null {
    const m = /^res:(\d+)(?:~(\d+))?(?:@\d+)?$/.exec(id);
    if (m === null) return null;
    const r = this.resourceAt(parseIntOrThrow(m[1]!));
    return r !== null ? { resource: r, level: m[2] !== undefined ? parseIntOrThrow(m[2]) : 0 } : null;
  }

  /** A recorded draw goes to an off-screen target (not to the window). */
  offscreen(state: unknown): boolean {
    return state instanceof DrawState && state.target !== null;
  }

  /** A resource some shader resource view reads (a depth texture that is sampled later). */
  private srvOf(resource: number): boolean {
    for (const v of this.srvs.values()) if (v.resource === resource) return true;
    return false;
  }

  /** memcpy into a mapped buffer: the numbers of the source, 4 bytes each (2 for 16-bit index data). */
  private write(dst: A.Expr, from: A.Expr, size: A.Expr | null): void {
    const dv = this.eval(dst);
    const address = dv !== null && dv.v !== null && dv.v.length > 0 ? dv.v[0]! : 0;
    const res = address < AddressUnit ? null : this.resourceAt(toInt(address / AddressUnit));
    if (res === null) return;
    const offset = toLong(address - res.id * AddressUnit);
    const value = this.eval(D3D12Device.strip(from));
    if (value === null) return;
    const numbers: number[] = [];
    CppExec.flatten(value, numbers, true);
    let bytes = 4;
    const stripped = D3D12Device.strip(from);
    if (stripped instanceof A.Name) {
      const type = this.src.declaredType(stripped.id);
      if (type !== null && /16|WORD|short/i.test(type)) bytes = 2;
    }
    const limit = size === null ? Number.MAX_VALUE : toLong(this.num(size));
    for (let i = 0; i < numbers.length && i * bytes < limit; i++) res.memory.set(offset + i * bytes, numbers[i]!);
  }

  /** The numbers of a buffer from a GPU address on: count values, stride bytes apart, comps each. */
  read(address: number, byteOffset: number, comps: number): number[] | null {
    const res = address < AddressUnit ? null : this.resourceAt(toInt(address / AddressUnit));
    if (res === null) return null;
    const at = address - res.id * AddressUnit + byteOffset;
    const r = new Array<number>(comps).fill(0);
    for (let k = 0; k < comps; k++) r[k] = res.memory.get(at + k * 4) ?? 0;
    return r;
  }

  readIndex(address: number, byteOffset: number, bytes: number): number | null {
    void bytes;
    const res = address < AddressUnit ? null : this.resourceAt(toInt(address / AddressUnit));
    if (res === null) return null;
    const at = address - res.id * AddressUnit + byteOffset;
    return res.memory.get(at) ?? null;
  }

  /**
   * The texture a shader register reads through a descriptor table: a loaded image, a cube map or a render target.
   * `layer`: the slice a Texture2DArray read names (its third coordinate): slice k of a render target is "res:N@k".
   */
  textureAt(handle: number, sampler: SamplerState, layer = 0): [Texture | null, CubeTexture | null] {
    const srv = this.srvs.get(handle);
    const res = srv !== undefined ? this.resourceAt(srv.resource) : null;
    if (srv === undefined || res === null) return [null, null];
    if (layer > 0 && !srv.cube && res.images.length === 0 && !res.buffer && !res.window) {
      const slice = res.targetId + "@" + Math.min(layer, res.arraySize - 1);
      const sliceDepth = res.depth;
      return [new Texture(() => Rasterizer.targetImage(slice, 0, sliceDepth), sampler, { components: 4 }), null];
    }
    // An invalid view (the debug layer's message #31): the shader reads 0.
    if (this.invalidSrvs.has(handle)) return [new Texture(new Image(1, 1, 4, new Uint8Array(4)), sampler, { components: 4 }), null];
    if (srv.cube && res.images.every((i) => i === null) && !res.buffer && !res.window) {
      // A cube map drawn into (point shadows): face i is slice i of the target.
      const cubeDepth = res.depth;
      const level = (target: string): (Texture | null)[] => Array.from({ length: 6 }, (_, face) =>
        new Texture(() => Rasterizer.targetImage(face === 0 ? target : target + "@" + face, 0, cubeDepth), sampler, { components: 4 }));
      // Its mip levels, when they were drawn: read by SampleLevel.
      return [null, new CubeTexture(level(res.targetId), {
        mips: res.targetLevels > 1 ? Array.from({ length: res.targetLevels - 1 }, (_, i) => level(res.levelTarget(i + 1))) : null,
      })];
    }
    if (srv.cube) return [null, new CubeTexture(res.images.map((i) => (i === null ? null : new Texture(i, sampler, { components: i.channels === 4 ? 4 : 3 }))))];
    const att = this.attachmentOf.get(res.id);
    if (att !== undefined) return [new Texture(() => Rasterizer.targetImage(att.target, att.attachment, false), sampler, { components: 4 }), null];
    const image = res.images[0] ?? null;
    if (image !== null) return [new Texture(image, sampler, { components: image.channels === 4 ? 4 : 3, srgb: this.srgbSrvs.has(handle) }), null];
    if (res.images.length === 0 && !res.buffer) {
      const id = res.targetId;
      const depth = res.depth;
      return [new Texture(() => Rasterizer.targetImage(id, 0, depth), sampler, { components: 4 }), null];
    }
    return [null, null];
  }
}

/** The names in a flags expression (D3D12_CLEAR_FLAG_DEPTH | D3D12_CLEAR_FLAG_STENCIL). */
function flagNames(e: A.Expr): string[] {
  if (e instanceof A.Name) return [e.id];
  if (e instanceof A.Binary) return [...flagNames(e.left), ...flagNames(e.right)];
  return [];
}

/** int.Parse of digits the regular expression matched (an overflow throws, as in C#). */
function parseIntOrThrow(s: string): number {
  const v = tryParseInt(s);
  if (v === null) throw new RangeError("Value was either too large or too small for an Int32.");
  return v;
}
