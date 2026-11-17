import { clamp, parseInt32, roundEven, toByte, toInt, toLong, tryParseInt } from "../internal/dotnet.js";
import { matchesAll } from "../internal/regex.js";
import type { GpuProject } from "../GpuProject.js";
import { Rasterizer } from "../Raster/Rasterizer.js";
import { ClearOp, CopyOp, type FrameOp } from "../Scene/FrameOp.js";
import * as A from "../Shading/ShaderAst.js";
import { ShaderRuntimeException } from "../Shading/ShaderErrors.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { CubeTexture } from "../Textures/CubeTexture.js";
import { Image } from "../Textures/Image.js";
import { SamplerState } from "../Textures/SamplerState.js";
import { Texture } from "../Textures/Texture.js";
import { CppExec } from "./CppExec.js";
import type { CppSource } from "./CppSource.js";
import { FormatChannels } from "./FormatChannels.js";
import type { IDeviceModel } from "./IDeviceModel.js";
import { StbImage } from "./StbImage.js";
import { TextureBinding } from "./TextureBinding.js";
import { computeCall } from "./VulkanDevice.Compute.js";
import { checkVertexInputs, validationCall } from "./VulkanDevice.Debug.js";
import { bytesPerTexel, copy, floatsPerTexel, read, readIndex, write } from "./VulkanDevice.Memory.js";

/**
 * The bytes of a VkDeviceMemory: numbers by byte offset, images memcpy'd in, and long runs of numbers. (C#'s
 * VulkanDevice.Memory. `bytes` is a SortedDictionary&lt;long, double&gt; there; nothing here depends on its order but
 * `range`, which sorts.)
 */
export class Memory {
  readonly bytes = new Map<number, number>();
  /** Images copied in with memcpy (stb_image pixels), by byte offset. */
  readonly images = new Map<number, string>();
  /**
   * Long runs of numbers written at once (memcpy of a CPU-filled texture's 1.92 million floats): where they start,
   * the bytes per number and the numbers – kept as arrays instead of one entry per number.
   */
  readonly runs: { start: number; step: number; values: number[] }[] = [];

  private static readonly RunFrom = 1024;

  /** The number at a byte offset (C#'s TryGet: undefined when there is none). */
  tryGet(at: number): number | undefined {
    const direct = this.bytes.get(at);
    if (direct !== undefined) return direct;
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const { start, step, values } = this.runs[i]!;
      const d = at - start;
      if (d >= 0 && d % step === 0 && d / step < values.length) return values[d / step]!;
    }
    return undefined;
  }

  /** Does anything lie in [from, to)? */
  any(from: number, to: number): boolean {
    for (const k of this.bytes.keys()) if (k >= from && k < to) return true;
    return this.runs.some((r) => r.start < to && r.start + r.values.length * r.step > from);
  }

  write(at: number, step: number, numbers: readonly number[]): void {
    if (numbers.length < Memory.RunFrom) {
      for (let i = 0; i < numbers.length; i++) this.set(at + i * step, numbers[i]!);
      return;
    }
    const end = at + numbers.length * step;
    for (const k of [...this.bytes.keys()].filter((k) => k >= at && k < end)) this.bytes.delete(k);
    this.runs.push({ start: at, step, values: numbers.slice() });
  }

  set(at: number, value: number): void {
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const { start, step, values } = this.runs[i]!;
      const d = at - start;
      if (d >= 0 && d % step === 0 && d / step < values.length) {
        values[d / step] = value;
        return;
      }
    }
    this.bytes.set(at, value);
  }

  /** The numbers in [from, from + bytes), with their offsets. */
  *range(from: number, bytes: number): Generator<{ at: number; value: number }> {
    for (const r of this.runs)
      for (let i = Math.max(0, Math.trunc((from - r.start + r.step - 1) / r.step)); i < r.values.length; i++) {
        const at = r.start + i * r.step;
        if (at >= from + bytes) break;
        yield { at, value: r.values[i]! };
      }
    for (const k of [...this.bytes.keys()].filter((k) => k >= from && k < from + bytes).sort((a, b) => a - b)) yield { at: k, value: this.bytes.get(k)! };
  }
}

export class ImageObject {
  id = 0;
  window = false;
  width = 0;
  height = 0;
  layers = 1;
  samples = 1;
  cube = false;
  depth = false;
  float = false;
  srgb = false;
  format = "";
  readonly layerImages: (Image | null)[] = [];
  get targetId(): string {
    return "img:" + this.id;
  }
  /**
   * Mip levels that hold a picture: drawn into one by one (a view of one level in a framebuffer) or made from
   * the level above (vkCmdBlitImage) – the render targets "img:N~level" hold levels 1 and up.
   */
  targetLevels = 1;
  /** The image is drawn into through views of single layers (one cube face per framebuffer). */
  perLayer = false;
  /** A loaded image whose smaller mip levels were made with vkCmdBlitImage (vulkan-tutorial's generateMipmaps). */
  mipmapped = false;

  levelTarget(level: number): string {
    return level > 0 ? `${this.targetId}~${level}` : this.targetId;
  }
}

/** A vertex buffer bound (vkCmdBindVertexBuffers): the buffer and the byte offset. */
export interface BoundBuffer {
  readonly buffer: string;
  readonly offset: number;
}

/** The index buffer bound (vkCmdBindIndexBuffer): the buffer, the byte offset and the bytes per index. */
export interface BoundIndexBuffer extends BoundBuffer {
  readonly bytes: number;
}

/** What is bound when a draw is recorded. (A C# record.) */
export class DrawState {
  constructor(
    readonly framebuffer: string | null,
    readonly vertexBuffers: ReadonlyMap<number, BoundBuffer>,
    readonly indexBuffer: BoundIndexBuffer | null,
    readonly sets: ReadonlyMap<number, string>,
    readonly pipeline: string | null = null,
  ) {}
}

/** A vertex attribute of a pipeline: location, binding, byte offset, numbers. (A C# record.) */
export class Attribute {
  constructor(readonly location: number, readonly binding: number, readonly offset: number, readonly comps: number) {}
}

/**
 * What vkCreateGraphicsPipelines was given: the vertex input (attributes; bindings' stride and per-instance rate)
 * and the rasterization sample count. (A C# record.)
 */
export class Pipeline {
  constructor(readonly attributes: Attribute[], readonly bindings: Map<number, { stride: number; instance: boolean }>, readonly samples: number) {}
}

const Debug = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.["GP_VK_DEBUG"] !== undefined;

/** An image view: the image, whether it is viewed as a cube map, its first layer and its mip level. */
interface ViewInfo {
  image: string;
  cube: boolean;
  layer: number;
  level: number;
}

/**
 * A small model of a Vulkan device, for the simulator: while the program's setup (initVulkan and the helpers it calls)
 * and its command buffer recording run in the C++ runner, it follows buffers and their memory (the bytes copied into
 * them, staging copies, vkCmdUpdateBuffer), images with their layers (textures, cube maps, off-screen colour images),
 * image views, samplers, framebuffers and descriptor sets, and per draw the render pass's framebuffer and clear values,
 * the vertex and index buffers and the descriptor set bound. Handles are strings ("buf:3", "img:2" …); mapped
 * pointers are numbers (memory × 10⁹ + byte offset).
 *
 * (A C# partial class: VulkanDevice.Compute.ts, VulkanDevice.Debug.ts and VulkanDevice.Memory.ts hold the other parts as
 * functions of the device; the members they use are internal.)
 */
export class VulkanDevice implements IDeviceModel {
  /** Every pipeline made: its handle → the SPIR-V files of its stages and its VkGraphicsPipelineCreateInfo. */
  readonly createdPipelines = new Map<string, { files: string[]; info: ShaderValue }>();

  private readonly pipelines = new Map<string, Pipeline>();
  private boundPipeline: string | null = null;

  pipelineOf(handle: string | null): Pipeline | null {
    return handle !== null ? (this.pipelines.get(handle) ?? null) : null;
  }

  /** @internal */
  static readonly AddressUnit = 1e9;

  /** @internal */
  readonly memories: Memory[] = [];
  /** @internal */
  readonly buffers = new Map<string, { memory: number; offset: number }>();
  /** @internal */
  readonly images: ImageObject[] = [];
  /** Image views: the image and whether it is viewed as a cube map. @internal */
  readonly views = new Map<string, ViewInfo>();
  /** Image views with an sRGB format. */
  private readonly srgbViews = new Set<string>();

  /** The swap chain's images have an sRGB format: what is drawn into them is encoded. */
  private windowSrgbField = false;
  get windowSrgb(): boolean {
    return this.windowSrgbField;
  }
  private readonly samplers = new Map<string, SamplerState>();
  /** Framebuffers: their colour attachment's view (the render pass's colour attachment, else the first). */
  private readonly framebuffers = new Map<string, string>();
  /** Framebuffers whose render pass resolves the (multisampled) colour attachment: the resolve attachment's view. */
  private readonly resolves = new Map<string, string>();
  /** Render passes: the first subpass's colour attachment and resolve attachment (indices into the framebuffer's attachments). */
  private readonly renderPasses = new Map<string, { color: number; resolve: number | null; colors: number[] }>();
  /** Per render pass: each attachment's loadOp, and which attachment is the depth one. */
  private readonly passLoads = new Map<string, { loadOps: string[]; depth: number | null }>();
  /** Per framebuffer: its render pass and its attachments' views. */
  private readonly framebufferInfo = new Map<string, { pass: string | null; views: (string | null)[] }>();
  /** Which target drew into a depth image last (null: the window): a later pass that loads it continues from it. */
  private readonly depthOwner = new Map<string, string | null>();
  /**
   * The images behind a framebuffer's further colour attachments (multiple render targets: bloom's bright colour):
   * image → (the target of the first colour attachment, the attachment number).
   */
  private readonly attachmentOf = new Map<string, { target: string; attachment: number }>();
  /** Per render target (its first colour image): how many colour attachments, and whether it has a depth attachment. */
  private readonly targetShape = new Map<string, { colors: number; depth: boolean }>();

  shapeOf(target: string): { colors: number; depth: boolean } | null {
    return this.targetShape.get(target) ?? null;
  }

  /** The channels each colour attachment of a target keeps (an R8_UNORM revealage image: 1), or null. */
  channelsOf(target: string, colors: number): number[] | null {
    const formats = new Array<string | null>(Math.max(1, colors)).fill(null);
    for (const img of this.images.filter((i) => i.targetId === target)) formats[0] = img.format;
    for (const [image, { target: t, attachment: k }] of this.attachmentOf) {
      const attached = this.imageOf(image);
      if (t === target && k < formats.length && attached !== null) formats[k] = attached.format;
    }
    return FormatChannels.list(formats.map((f) => FormatChannels.of(f)));
  }

  private resolveView: string | null = null;
  /** Descriptor sets: binding → (image view, sampler). @internal */
  readonly sets = new Map<string, Map<number, { view: string | null; sampler: string | null }>>();
  /** @internal */
  readonly loaded = new Map<string, Image | null>();
  /** The channels per pixel of the bytes stbi_load returned for an image (as the program reads them). */
  private readonly pointerChannels = new Map<string, number>();
  private counter = 0;
  private flip = false;
  /** @internal */
  exec: CppExec | null = null;

  private framebuffer: string | null = null;
  private readonly vertexBuffers = new Map<number, BoundBuffer>();
  private indexBuffer: BoundIndexBuffer | null = null;
  private readonly boundSets = new Map<number, string>();

  readonly ops: FrameOp[] = [];
  drawCount: () => number = () => 0;

  // ---------- the other parts' state (VulkanDevice.Compute.cs, VulkanDevice.Debug.cs) ----------

  /** Compute pipelines: handle → the SPIR-V file of their shader. @internal */
  readonly computePipelines = new Map<string, string>();
  /** @internal */
  boundCompute: string | null = null;
  /** @internal */
  readonly computeSets = new Map<number, string>();
  /** @internal */
  computeConstants: ShaderValue | null = null;
  /** @internal */
  readonly computePrograms = new Map<string, ShaderProgram | null>();

  /** @internal */
  messengerCallback: string | null = null;
  /** @internal */
  messengerSeverities = 0;
  /** @internal */
  readonly shaderFiles: string[] = [];
  /** @internal */
  readonly moduleFiles = new Map<string, string>();
  /** @internal */
  readonly objectNames = new Map<string, string>();

  /** The window's size (the swap chain's extent). (C#'s init-only properties.) */
  readonly windowWidth: number;
  readonly windowHeight: number;

  /** @internal */
  readonly project: GpuProject;
  /** @internal */
  readonly src: CppSource;

  constructor(project: GpuProject, src: CppSource, init: { windowWidth?: number; windowHeight?: number } = {}) {
    this.project = project;
    this.src = src;
    this.windowWidth = init.windowWidth ?? 800;
    this.windowHeight = init.windowHeight ?? 600;
  }

  attach(exec: CppExec): void {
    this.exec = exec;
  }

  snapshot(): DrawState {
    return new DrawState(this.framebuffer, new Map(this.vertexBuffers), this.indexBuffer, new Map(this.boundSets), this.boundPipeline);
  }

  /** @internal */
  newHandle(kind: string): string {
    return `${kind}:${++this.counter}`;
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
  handle(e: A.Expr): string | null {
    return this.eval(e)?.text ?? null;
  }

  /** @internal */
  static strip(e: A.Expr): A.Expr {
    if (e instanceof A.Unary && (e.op === "&" || e.op === "*")) return VulkanDevice.strip(e.operand);
    return e instanceof A.Call && e.function_ === ".data" && e.args.length === 1 ? e.args[0]! : e;
  }

  /** @internal */
  set(target: A.Expr, value: ShaderValue): void {
    this.exec!.runner.assign(VulkanDevice.strip(target), value);
  }

  /** A new handle of a kind, stored in the target; the handle. (C#'s Set(Expr, string) overload.) @internal */
  setHandle(target: A.Expr, kind: string): string {
    const handle = this.newHandle(kind);
    this.set(target, ShaderValue.str(handle));
    return handle;
  }

  /** @internal */
  static text(v: ShaderValue | null | undefined, field: string): string | null {
    return v?.fields?.get(field)?.text ?? null;
  }

  /** @internal */
  static number(v: ShaderValue | null | undefined, field: string): number | null {
    const x = v?.fields?.get(field)?.v;
    return x !== undefined && x !== null && x.length > 0 ? x[0]! : null;
  }

  /** @internal */
  static field(v: ShaderValue | null | undefined, field: string): ShaderValue | null {
    return v?.fields?.get(field) ?? null;
  }

  /** @internal */
  static items(v: ShaderValue | null | undefined): ShaderValue[] {
    if (v === null || v === undefined) return [];
    return v.items ?? [v];
  }

  hook(name: string, args: readonly A.Expr[]): ShaderValue | null {
    if (this.exec === null) return null;
    if (Debug) console.error(`[vk] ${name}(${args.map((a) => {
      const v = this.eval(a);
      const t = v === null ? "?" : v.toString();
      return t.length > 80 ? t.slice(0, 80) + "…" : t;
    }).join(", ")})`);
    const answered = validationCall(this, name, args);
    if (answered !== null) return answered;
    const computed = computeCall(this, name, args);
    if (computed !== null) return computed;
    const { text: Text, number: Number_, field: Field, items: Items, strip: Strip } = VulkanDevice;
    const ok = (): ShaderValue => ShaderValue.str("VK_SUCCESS");
    switch (name) {
      case "vkCreateBuffer":
        if (args.length < 4) break;
        this.buffers.set(this.setHandle(args[3]!, "buf"), { memory: -1, offset: 0 });
        return ok();
      case "vkAllocateMemory":
        if (args.length < 4) break;
        this.memories.push(new Memory());
        this.set(args[3]!, ShaderValue.str("mem:" + this.memories.length));
        return ok();
      case "vkBindBufferMemory": {
        if (args.length < 4) break;
        const b = this.handle(args[1]!);
        const m = b === null ? null : memoryIndex(this.handle(args[2]!));
        if (b !== null && m !== null) this.buffers.set(b, { memory: m, offset: toLong(this.num(args[3]!)) });
        return ok();
      }
      case "vkMapMemory": {
        if (args.length < 6) break;
        const mm = memoryIndex(this.handle(args[1]!));
        if (mm !== null) this.set(args[5]!, ShaderValue.scalar((mm + 1) * VulkanDevice.AddressUnit + this.num(args[2]!)));
        return ok();
      }
      case "memcpy":
        if (args.length < 2) break;
        write(this, args[0]!, args[1]!, args.length > 2 ? args[2]! : null);
        return ShaderValue.scalar(0);
      case "vkCmdCopyBuffer":
        if (args.length < 5) break;
        for (const region of Items(this.eval(Strip(args[4]!))))
          copy(this, this.handle(args[1]!), toLong(Number_(region, "srcOffset") ?? 0), this.handle(args[2]!), toLong(Number_(region, "dstOffset") ?? 0), toLong(Number_(region, "size") ?? 0));
        return ShaderValue.scalar(0);
      case "vkCmdUpdateBuffer": {
        if (args.length < 5) break;
        const ub = this.handle(args[1]!);
        const place = ub === null ? undefined : this.buffers.get(ub);
        if (place !== undefined && place.memory >= 0) {
          const data = this.eval(Strip(args[4]!));
          if (data !== null) {
            const numbers: number[] = [];
            CppExec.flatten(data, numbers);
            const at = place.offset + toLong(this.num(args[2]!));
            this.memories[place.memory]!.write(at, 4, numbers);
          }
        }
        return ShaderValue.scalar(0);
      }
      case "stbi_set_flip_vertically_on_load": {
        if (args.length < 1) break;
        this.flip = this.num(args[0]!) !== 0 || ["true", "TRUE"].includes(this.eval(args[0]!)?.text ?? "");
        return ShaderValue.scalar(0);
      }
      case "stbi_load": case "stbi_loadf": {
        if (args.length < 5) break;
        const path = this.eval(args[0]!)?.text ?? null;
        if (path === null) return ShaderValue.scalar(0);
        const image = StbImage.load(this.project, path, this.flip, 4);
        const key = `pixels:${this.loaded.size}:${path}`;
        this.loaded.set(key, image);
        if (image !== null) {
          // The channels the file has (stb_image reports them whatever it was asked for); the bytes come
          // with the channels asked for (0: the file's) – read through a pointer (pixelOffset[0]).
          const fileChannels = StbImage.fileChannels(this.project, path), wanted = toInt(this.num(args[4]!));
          this.pointerChannels.set(key, wanted > 0 && wanted <= 4 ? wanted : fileChannels);
          this.set(args[1]!, ShaderValue.scalar(image.width));
          this.set(args[2]!, ShaderValue.scalar(image.height));
          this.set(args[3]!, ShaderValue.scalar(fileChannels));
          this.exec.runner.pointerRead ??= (handle, at) => {
            const img = this.loaded.get(handle);
            const ch = this.pointerChannels.get(handle);
            return img !== undefined && img !== null && ch !== undefined ? StbImage.byte(img, ch, at) : null;
          };
        }
        return ShaderValue.str(key);
      }
      case "vkCreateImage": {
        if (args.length < 4) break;
        const info = this.eval(Strip(args[1]!));
        const img = new ImageObject();
        img.id = this.images.length + 1;
        this.images.push(img);
        const extent = Field(info, "extent");
        img.width = toInt(Number_(extent, "width") ?? 0);
        img.height = toInt(Number_(extent, "height") ?? 0);
        img.layers = toInt(Math.max(1, Number_(info, "arrayLayers") ?? 1));
        img.cube = (Text(info, "flags") ?? "").includes("CUBE");
        const samples = Text(info, "samples") ?? "";
        const sm = /(\d+)_BIT/.exec(samples);
        img.samples = sm !== null ? parseInt32(sm[1]!) : 1;
        const format = Text(info, "format") ?? "";
        img.depth = format.includes("_D16") || format.includes("_D24") || format.includes("_D32");
        // SFLOAT and UFLOAT (B10G11R11_UFLOAT_PACK32: an HDR target without sign or alpha) keep values above 1.
        img.float = format.includes("FLOAT") && !img.depth;
        img.srgb = format.includes("_SRGB");
        img.format = format;
        this.set(args[3]!, ShaderValue.str(img.targetId));
        return ok();
      }
      case "vkGetSwapchainImagesKHR": {
        if (args.length < 4 || (args[3] instanceof A.Name && args[3].id === "nullptr")) break;
        const count = toInt(Math.max(1, this.num(args[2]!)));
        const list: ShaderValue[] = [];
        for (let i = 0; i < count; i++) {
          const img = new ImageObject();
          img.id = this.images.length + 1;
          img.window = true;
          this.images.push(img);
          list.push(ShaderValue.str(img.targetId));
        }
        this.set(args[3]!, ShaderValue.array(list));
        return ok();
      }
      case "vkCmdCopyBufferToImage": {
        if (args.length < 6) break;
        const dst = this.imageOf(this.handle(args[2]!));
        const srcBuffer = dst === null ? null : this.handle(args[1]!);
        const place = srcBuffer === null ? undefined : this.buffers.get(srcBuffer);
        if (dst === null || srcBuffer === null || place === undefined || place.memory < 0) return ShaderValue.scalar(0);
        const mem = this.memories[place.memory]!;
        const layerBytes = dst.width * dst.height * 4;
        for (const region of Items(this.eval(Strip(args[5]!)))) {
          const offset = place.offset + toLong(Number_(region, "bufferOffset") ?? 0);
          const sub = Field(region, "imageSubresource");
          const first = toInt(Number_(sub, "baseArrayLayer") ?? 0), count = toInt(Math.max(1, Number_(sub, "layerCount") ?? 1));
          for (let l = 0; l < count; l++) {
            const key = mem.images.get(offset + l * layerBytes);
            let image: Image | null = key !== undefined && this.loaded.has(key) ? this.loaded.get(key)! : null;
            // Pixels the program made itself (a glyph atlas): the bytes in the buffer, by the image's format.
            const bpp = bytesPerTexel(dst.format);
            if (image === null && bpp > 0 && dst.width > 0 && dst.height > 0) {
              const start = offset + l * dst.width * dst.height * bpp;
              if (mem.any(start, start + dst.width * dst.height * bpp)) {
                const w = dst.width, h = dst.height;
                const rgba = new Uint8Array(w * h * 4);
                for (let t = 0; t < w * h; t++)
                  for (let k = 0; k < 4; k++)
                    rgba[t * 4 + k] = k < bpp ? toByte(clamp(mem.tryGet(start + t * bpp + k) ?? 0, 0, 255)) : k === 3 ? 255 : 0;
                image = new Image(w, h, bpp === 4 ? 4 : bpp, rgba);
              }
            }
            // Floats the program made (a CPU-filled R32G32B32A32_SFLOAT texture, LTC tables): 4 bytes each.
            const fpt = floatsPerTexel(dst.format);
            if (image === null && fpt > 0 && dst.width > 0 && dst.height > 0) {
              const start = offset + l * dst.width * dst.height * fpt * 4;
              if (mem.any(start, start + dst.width * dst.height * fpt * 4)) {
                const w = dst.width, h = dst.height;
                const floats = new Array<number>(w * h * 4);
                const rgba = new Uint8Array(w * h * 4);
                for (let t = 0; t < w * h; t++)
                  for (let k = 0; k < 4; k++) {
                    const v = k < fpt ? (mem.tryGet(start + (t * fpt + k) * 4) ?? 0) : k === 3 ? 1 : 0;
                    floats[t * 4 + k] = v;
                    rgba[t * 4 + k] = toByteRounded(v);
                  }
                image = new Image(w, h, 4, rgba, floats);
              }
            }
            while (dst.layerImages.length <= first + l) dst.layerImages.push(null);
            dst.layerImages[first + l] = image;
          }
        }
        return ShaderValue.scalar(0);
      }
      case "vkCmdBlitImage": {
        if (args.length < 7) break;
        // A mip level made from the level above (vulkan-tutorial's generateMipmaps), of an image that was drawn
        // into: each layer's smaller copy is the average of the pixels it covers.
        const from = this.imageOf(this.handle(args[1]!));
        if (from === null || from.window) return ShaderValue.scalar(0);
        const to = this.imageOf(this.handle(args[3]!));
        if (to === null || to.window) return ShaderValue.scalar(0);
        if (to.layerImages.some((i) => i !== null) || from.layerImages.some((i) => i !== null)) {
          // A loaded texture's levels made from level 0: sampled with mip levels from now on.
          if (from === to) to.mipmapped = true;
          return ShaderValue.scalar(0);
        }
        for (const region of Items(this.eval(Strip(args[6]!)))) {
          const srcSub = Field(region, "srcSubresource");
          const dstSub = Field(region, "dstSubresource");
          const srcLevel = toInt(Number_(srcSub, "mipLevel") ?? 0), dstLevel = toInt(Number_(dstSub, "mipLevel") ?? 0);
          const srcLayer = toInt(Number_(srcSub, "baseArrayLayer") ?? 0), dstLayer = toInt(Number_(dstSub, "baseArrayLayer") ?? 0);
          const layers = toInt(Math.max(1, Number_(dstSub, "layerCount") ?? 1));
          for (let l = 0; l < layers; l++) {
            const layer = (level: string, n: number): string => (n > 0 ? level + "@" + n : level);
            this.ops.push(new CopyOp(this.drawCount(), layer(from.levelTarget(srcLevel), srcLayer + l), layer(to.levelTarget(dstLevel), dstLayer + l), true, false, true));
          }
          to.targetLevels = Math.max(to.targetLevels, dstLevel + 1);
          if (layers > 1 || dstLayer > 0) to.perLayer = true;
        }
        return ShaderValue.scalar(0);
      }
      case "vkCreateImageView": {
        if (args.length < 4) break;
        const info = this.eval(Strip(args[1]!));
        const view = this.setHandle(args[3]!, "view");
        // The first array layer (a cube map's face) and mip level the view shows: a framebuffer made with it draws
        // into that face and level.
        const range = Field(info, "subresourceRange");
        const cubeView = (Text(info, "viewType") ?? "").includes("CUBE");
        const baseLayer = toInt(Number_(range, "baseArrayLayer") ?? 0), baseLevel = toInt(Number_(range, "baseMipLevel") ?? 0);
        this.views.set(view, { image: Text(info, "image") ?? "", cube: cubeView, layer: baseLayer, level: baseLevel });
        const layered = this.imageOf(Text(info, "image"));
        if (!cubeView && layered !== null && layered.layers > 1 && (Number_(range, "layerCount") ?? 1) <= 1) layered.perLayer = true;
        if ((Text(info, "format") ?? "").includes("_SRGB")) this.srgbViews.add(view);
        return ok();
      }
      case "vkCreateSampler": {
        if (args.length < 4) break;
        const info = this.eval(Strip(args[1]!));
        const sampler = this.setHandle(args[3]!, "smp");
        this.samplers.set(sampler, TextureBinding.fromFields((f) => info?.fields?.get(f)?.text ?? null, false));
        return ok();
      }
      case "vkCreateRenderPass": {
        if (args.length < 4) break;
        const info = this.eval(Strip(args[1]!));
        const subpass = Items(Field(info, "pSubpasses"))[0] ?? null;
        const colorRefs = take(Items(Field(subpass, "pColorAttachments")), toInt(Number_(subpass, "colorAttachmentCount") ?? 2147483647))
          .map((c) => toInt(Number_(c, "attachment") ?? 0));
        const color = colorRefs.length > 0 ? colorRefs[0]! : 0;
        const resolve = Number_(Items(Field(subpass, "pResolveAttachments"))[0] ?? null, "attachment");
        const rp = this.setHandle(args[3]!, "rp");
        this.renderPasses.set(rp, { color, resolve: resolve === null ? null : toInt(resolve), colors: colorRefs });
        const depthRef = Number_(Field(subpass, "pDepthStencilAttachment"), "attachment");
        this.passLoads.set(rp, { loadOps: Items(Field(info, "pAttachments")).map((a) => Text(a, "loadOp") ?? ""), depth: depthRef === null ? null : toInt(depthRef) });
        return ok();
      }
      case "vkCreateFramebuffer": {
        if (args.length < 4) break;
        const info = this.eval(Strip(args[1]!));
        const attachments = Items(Field(info, "pAttachments"));
        const fb = this.setHandle(args[3]!, "fb");
        this.framebufferInfo.set(fb, { pass: Text(info, "renderPass"), views: attachments.map((a) => a.text) });
        const rpName = Text(info, "renderPass");
        const pass = (rpName !== null ? this.renderPasses.get(rpName) : undefined) ?? { color: 0, resolve: null, colors: [0] };
        const colorView = pass.color < attachments.length ? attachments[pass.color]!.text : null;
        if (colorView !== null) {
          this.framebuffers.set(fb, colorView);
          // A view of a mip level: that level is drawn into.
          const cv = this.views.get(colorView);
          const leveled = cv !== undefined && cv.level > 0 ? this.imageOf(cv.image) : null;
          if (cv !== undefined && leveled !== null) leveled.targetLevels = Math.max(leveled.targetLevels, cv.level + 1);
        }
        const ri = pass.resolve;
        if (ri !== null && ri < attachments.length && attachments[ri]!.text !== null) this.resolves.set(fb, attachments[ri]!.text!);
        // The target's shape: its colour attachments (further ones are read as attachments 1, 2 … of it) and
        // whether any attachment is a depth image (a ping-pong blur pass has none: no depth test).
        const target = this.targetOf(fb);
        if (target !== null) {
          for (let k = 1; k < pass.colors.length; k++) {
            const extra = pass.colors[k]! < attachments.length ? attachments[pass.colors[k]!]!.text : null;
            const ev = extra !== null ? this.views.get(extra) : undefined;
            if (ev !== undefined) this.attachmentOf.set(ev.image, { target, attachment: k });
          }
          const depth = attachments.some((a) => {
            const v = a.text !== null ? this.views.get(a.text) : undefined;
            return v !== undefined && this.imageOf(v.image)?.depth === true;
          });
          // (Another framebuffer of the same image – a later pass without depth, weighted blended OIT's
          // composite into the opaque image – keeps the depth buffer the first one gave it.)
          const before = this.targetShape.get(target);
          this.targetShape.set(target, before !== undefined
            ? { colors: Math.max(before.colors, Math.max(1, pass.colors.length)), depth: before.depth || depth } : { colors: Math.max(1, pass.colors.length), depth });
        }
        return ok();
      }
      case "vkAllocateDescriptorSets": {
        if (args.length < 3) break;
        const info = this.eval(Strip(args[1]!));
        const count = toInt(Math.max(1, Number_(info, "descriptorSetCount") ?? 1));
        if ((args[2] instanceof A.Call && args[2].function_ === ".data") || count > 1)
          this.set(args[2]!, ShaderValue.array(Array.from({ length: count }, () => ShaderValue.str(this.newHandle("set")))));
        else this.setHandle(args[2]!, "set");
        return ok();
      }
      case "vkUpdateDescriptorSets":
        if (args.length < 3) break;
        for (const w of Items(this.eval(Strip(args[2]!)))) {
          const set = Text(w, "dstSet");
          const info = Field(w, "pImageInfo");
          if (set === null || info === null) continue;
          const first = Items(info)[0] ?? null;
          let bindings = this.sets.get(set);
          if (bindings === undefined) this.sets.set(set, (bindings = new Map()));
          bindings.set(toInt(Number_(w, "dstBinding") ?? 0), { view: Text(first, "imageView"), sampler: Text(first, "sampler") });
        }
        return ShaderValue.scalar(0);

      // ---------- the physical device and the swap chain ----------
      case "vkGetPhysicalDeviceProperties": {
        if (args.length < 2) break;
        // The simulated device: up to 4 samples per pixel for colour and depth attachments.
        const counts = "VK_SAMPLE_COUNT_1_BIT|VK_SAMPLE_COUNT_2_BIT|VK_SAMPLE_COUNT_4_BIT";
        const limits = new Map<string, ShaderValue>([
          ["framebufferColorSampleCounts", ShaderValue.str(counts)],
          ["framebufferDepthSampleCounts", ShaderValue.str(counts)],
          ["maxSamplerAnisotropy", ShaderValue.scalar(16)],
          // lavapipe's limits.
          ["maxTessellationGenerationLevel", ShaderValue.integer(64)],
          ["maxTessellationPatchSize", ShaderValue.integer(32)],
          ["maxComputeWorkGroupCount", ShaderValue.array([ShaderValue.integer(65535), ShaderValue.integer(65535), ShaderValue.integer(65535)])],
          ["maxComputeWorkGroupSize", ShaderValue.array([ShaderValue.integer(1024), ShaderValue.integer(1024), ShaderValue.integer(1024)])],
          ["maxComputeWorkGroupInvocations", ShaderValue.integer(1024)],
          ["maxComputeSharedMemorySize", ShaderValue.integer(32768)],
          ["maxImageDimension2D", ShaderValue.integer(16384)],
        ]);
        this.set(args[1]!, ShaderValue.struct(new Map([["limits", ShaderValue.struct(limits)]])));
        return ShaderValue.scalar(0);
      }
      case "vkEnumeratePhysicalDevices":
        if (args.length < 3) break;
        // One GPU: the simulated one.
        if (args[2] instanceof A.Name && (args[2].id === "nullptr" || args[2].id === "NULL")) this.set(args[1]!, ShaderValue.scalar(1));
        else this.set(args[2]!, ShaderValue.array([ShaderValue.str("gpu:1")]));
        return ok();
      case "isDeviceSuitable":
        // The simulated GPU has the queues, extensions and swap chain support the tutorial asks for.
        return ShaderValue.scalar(1);
      case "chooseSwapSurfaceFormat": {
        // The format the program asks for (availableFormat.format == VK_FORMAT_B8G8R8A8_UNORM): the simulated
        // surface offers it.
        const wanted = /\.format\s*==\s*(VK_FORMAT_\w+)/.exec(this.src.functionBody("chooseSwapSurfaceFormat") ?? "");
        if (wanted === null) return null;
        return ShaderValue.struct(new Map([
          ["format", ShaderValue.str(wanted[1]!)],
          ["colorSpace", ShaderValue.str("VK_COLOR_SPACE_SRGB_NONLINEAR_KHR")],
        ]));
      }
      case "vkCreateSwapchainKHR":
        if (args.length < 2) break;
        this.windowSrgbField = (Text(this.eval(Strip(args[1]!)), "imageFormat") ?? "").includes("_SRGB");
        return null;
      case "vkGetPhysicalDeviceFormatProperties": {
        if (args.length < 3) break;
        // The simulated GPU supports every format for what the tutorial asks of it.
        const features = "VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT|VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT|VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT|VK_FORMAT_FEATURE_COLOR_ATTACHMENT_BIT|VK_FORMAT_FEATURE_COLOR_ATTACHMENT_BLEND_BIT|VK_FORMAT_FEATURE_TRANSFER_SRC_BIT|VK_FORMAT_FEATURE_TRANSFER_DST_BIT|VK_FORMAT_FEATURE_BLIT_SRC_BIT|VK_FORMAT_FEATURE_BLIT_DST_BIT";
        this.set(args[2]!, ShaderValue.struct(new Map([
          ["linearTilingFeatures", ShaderValue.str(features)],
          ["optimalTilingFeatures", ShaderValue.str(features)],
          ["bufferFeatures", ShaderValue.str("VK_FORMAT_FEATURE_VERTEX_BUFFER_BIT")],
        ])));
        return ShaderValue.scalar(0);
      }
      case "chooseSwapExtent":
        // The swap chain's images are the window's size.
        return ShaderValue.struct(new Map([["width", ShaderValue.scalar(this.windowWidth)], ["height", ShaderValue.scalar(this.windowHeight)]]));
      case "glfwGetFramebufferSize":
        if (args.length < 3) break;
        this.set(args[1]!, ShaderValue.scalar(this.windowWidth));
        this.set(args[2]!, ShaderValue.scalar(this.windowHeight));
        return ShaderValue.scalar(0);

      case "vkCreateGraphicsPipelines": {
        if (args.length < 6) break;
        const infos = Items(this.eval(Strip(args[3]!)));
        const count = toInt(Math.max(1, this.num(args[2]!)));
        const handles: ShaderValue[] = [];
        for (const info of take(infos, count)) {
          const handle = this.newHandle("pipe");
          handles.push(ShaderValue.str(handle));
          const input = Field(info, "pVertexInputState");
          const attributes: Attribute[] = [];
          for (const a of take(Items(Field(input, "pVertexAttributeDescriptions")), toInt(Number_(input, "vertexAttributeDescriptionCount") ?? 2147483647))) {
            if (a.fields === null) continue;
            const format = Text(a, "format") ?? "";
            const comps = matchesAll(/[RGBA]\d+/g, format).length;
            attributes.push(new Attribute(toInt(Number_(a, "location") ?? 0), toInt(Number_(a, "binding") ?? 0), toInt(Number_(a, "offset") ?? 0), Math.max(1, comps)));
          }
          const bindings = new Map<number, { stride: number; instance: boolean }>();
          for (const bd of take(Items(Field(input, "pVertexBindingDescriptions")), toInt(Number_(input, "vertexBindingDescriptionCount") ?? 2147483647)))
            if (bd.fields !== null)
              bindings.set(toInt(Number_(bd, "binding") ?? 0), { stride: toInt(Number_(bd, "stride") ?? 0), instance: (Text(bd, "inputRate") ?? "").includes("INSTANCE") });
          checkVertexInputs(this, info, attributes, handles.length - 1);
          // Its shaders (the files its modules were made of) and its create-info, for a program whose pipelines
          // the reader cannot follow by name (kept in a std::map).
          const stageFiles = take(Items(Field(info, "pStages")), toInt(Number_(info, "stageCount") ?? 2147483647))
            .map((st) => {
              const module = Text(st, "module");
              return module !== null ? (this.moduleFiles.get(module) ?? null) : null;
            }).filter((f): f is string => f !== null);
          this.createdPipelines.set(handle, { files: stageFiles, info: info.clone() });
          const samples = /(\d+)_BIT/.exec(Text(Field(info, "pMultisampleState"), "rasterizationSamples") ?? "");
          this.pipelines.set(handle, new Pipeline(attributes, bindings, samples !== null ? parseInt32(samples[1]!) : 1));
        }
        if (handles.length === 1) this.set(args[5]!, handles[0]!);
        else if (handles.length > 1) this.set(args[5]!, ShaderValue.array(handles));
        return ok();
      }

      // ---------- recording ----------
      case "vkCmdBindPipeline":
        if (args.length < 3) break;
        this.boundPipeline = this.handle(args[2]!);
        return null; // the frame recorder records it too
      case "vkCmdBeginRenderPass": {
        if (args.length < 2) break;
        const info = this.eval(Strip(args[1]!));
        const framebuffer = Text(info, "framebuffer");
        this.framebuffer = framebuffer;
        this.resolveView = framebuffer !== null ? (this.resolves.get(framebuffer) ?? null) : null;
        const target = this.targetOf(framebuffer);
        // Each attachment's loadOp: only CLEAR clears; a depth image loaded (LOAD) that another pass drew into
        // continues from that pass's depth (deferred shading's light cubes over the G-buffer's depth).
        let clearColor = true, clearDepth = true;
        const fbi = framebuffer !== null ? this.framebufferInfo.get(framebuffer) : undefined;
        const loads = fbi !== undefined && fbi.pass !== null ? this.passLoads.get(fbi.pass) : undefined;
        if (fbi !== undefined && fbi.pass !== null && loads !== undefined) {
          const colorIndex = this.renderPasses.get(fbi.pass)?.color ?? 0;
          const colorLoad = colorIndex < loads.loadOps.length ? loads.loadOps[colorIndex]! : "";
          if (colorLoad.length > 0) clearColor = colorLoad.includes("CLEAR");
          const di = loads.depth;
          if (di !== null && di < loads.loadOps.length) {
            const depthLoad = loads.loadOps[di]!;
            if (depthLoad.length > 0) clearDepth = depthLoad.includes("CLEAR");
            const depthView = di < fbi.views.length ? fbi.views[di]! : null;
            const dv = depthView !== null ? this.views.get(depthView) : undefined;
            if (dv !== undefined) {
              const owner = this.depthOwner.get(dv.image);
              if (!clearDepth && owner !== undefined && owner !== target) this.ops.push(new CopyOp(this.drawCount(), owner, target, false, true));
              this.depthOwner.set(dv.image, target);
            }
          }
        }
        // pClearValues[i] is attachment i's: a colour attachment's (colour k of the subpass: attachment k of the
        // target) when its loadOp clears, the depth attachment's.
        const rpInfo = fbi !== undefined && fbi.pass !== null ? this.renderPasses.get(fbi.pass) : undefined;
        const passInfo = rpInfo !== undefined && loads !== undefined
          ? { colors: rpInfo.colors as number[] | null, loadOps: loads.loadOps as string[] | null, depth: loads.depth }
          : { colors: null, loadOps: null, depth: null };
        const clears = Items(Field(info, "pClearValues"));
        for (let i = 0; i < clears.length; i++) {
          const clear = clears[i]!;
          const colorIndex = passInfo.colors === null ? -1 : passInfo.colors.indexOf(i);
          const known = passInfo.colors !== null && (colorIndex >= 0 || passInfo.depth === i);
          const op = passInfo.loadOps !== null && i < passInfo.loadOps.length ? passInfo.loadOps[i]! : "";
          const loadClears = passInfo.loadOps === null || i >= passInfo.loadOps.length || op.length === 0 || op.includes("CLEAR");
          const color = Field(clear, "color");
          if (color !== null && (known ? colorIndex >= 0 && loadClears : clearColor)) {
            const rgba: number[] = [];
            CppExec.flatten(color, rgba);
            if (rgba.length >= 3) this.ops.push(new ClearOp(this.drawCount(), target, rgba.slice(0, 4), null, null, known && passInfo.colors!.length > 1 ? colorIndex : null));
          }
          const ds = Field(clear, "depthStencil");
          if (ds !== null && (known ? passInfo.depth === i && loadClears : clearDepth)) {
            const v: number[] = [];
            CppExec.flatten(ds, v);
            this.ops.push(new ClearOp(this.drawCount(), target, null, v.length > 0 ? v[0]! : 1.0, v.length > 1 ? toInt(v[1]!) : 0));
          }
        }
        return ShaderValue.scalar(0);
      }
      case "vkCmdEndRenderPass":
        // The subpass's resolve attachment gets the multisampled colour image, resolved (vulkan-tutorial's
        // multisampling: into the swap chain image).
        if (this.resolveView !== null) {
          this.ops.push(new CopyOp(this.drawCount(), this.targetOf(this.framebuffer), this.viewTarget(this.resolveView)));
          this.resolveView = null;
        }
        return null;
      case "vkCmdBindVertexBuffers": {
        if (args.length < 5) break;
        const first = toInt(this.num(args[1]!)), count = toInt(this.num(args[2]!));
        const bufs = Items(this.eval(Strip(args[3]!)));
        const offs = this.eval(Strip(args[4]!));
        const offList: number[] = [];
        if (offs !== null) CppExec.flatten(offs, offList);
        for (let i = 0; i < count && i < bufs.length; i++) {
          const vb = bufs[i]!.text;
          if (vb !== null) this.vertexBuffers.set(first + i, { buffer: vb, offset: i < offList.length ? toLong(offList[i]!) : 0 });
        }
        return ShaderValue.scalar(0);
      }
      case "vkCmdBindIndexBuffer": {
        if (args.length < 4) break;
        const ib = this.handle(args[1]!);
        if (ib !== null) this.indexBuffer = { buffer: ib, offset: toLong(this.num(args[2]!)), bytes: (this.eval(args[3]!)?.text ?? "").includes("UINT16") ? 2 : 4 };
        return ShaderValue.scalar(0);
      }
      case "vkCmdBindDescriptorSets": {
        if (args.length < 6) break;
        const first = toInt(this.num(args[3]!));
        const bound = Items(this.eval(Strip(args[5]!)));
        for (let i = 0; i < bound.length && i < Math.max(1, toInt(this.num(args[4]!))); i++) {
          const s = bound[i]!.text;
          if (s !== null) this.boundSets.set(first + i, s);
        }
        return null; // the frame recorder records it too
      }
    }
    return null;
  }

  /** @internal */
  imageOf(handle: string | null | undefined): ImageObject | null {
    if (handle === null || handle === undefined || !handle.startsWith("img:")) return null;
    const i = tryParseInt(handle.slice(4));
    return i !== null && i >= 1 && i <= this.images.length ? this.images[i - 1]! : null;
  }

  image(id: string): ImageObject | null {
    return this.imageOf(id);
  }

  /** The render target of a framebuffer: its colour image ("img:N"), null for a swap chain image (the window). */
  targetOf(fb: string | null | undefined): string | null {
    const view = fb !== null && fb !== undefined ? this.framebuffers.get(fb) : undefined;
    return view !== undefined ? this.viewTarget(view) : null;
  }

  /** The render target behind an image view: its image ("img:N"), null for a swap chain image (the window). */
  private viewTarget(view: string): string | null {
    const v = this.views.get(view);
    const img = v !== undefined ? this.imageOf(v.image) : null;
    if (v === undefined || img === null || img.window) return null;
    // "img:N", "img:N~2" for mip level 2, "…@3" for array layer (cube face) 3.
    const level = img.levelTarget(v.level);
    return v.layer > 0 && !v.cube ? level + "@" + v.layer : level;
  }

  /** The image behind a target id ("img:N~2@3"), and the mip level it names. */
  targetImage(id: string): { image: ImageObject; level: number } | null {
    const m = /^(img:\d+)(?:~(\d+))?(?:@\d+)?$/.exec(id);
    const img = m !== null ? this.imageOf(m[1]!) : null;
    return m !== null && img !== null ? { image: img, level: m[2] !== undefined ? parseInt32(m[2]) : 0 } : null;
  }

  /** A recorded draw goes to an off-screen target (not to the window). */
  offscreen(state: unknown): boolean {
    return state instanceof DrawState && state.framebuffer !== null && this.targetOf(state.framebuffer) !== null;
  }

  /**
   * The texture behind a binding of a descriptor set: a loaded image, a cube map or a render target. `layer`: the layer
   * a sampler2DArray read names (its third coordinate): layer k of a render target is "img:N@k". Null: nothing is bound
   * there; { texture: null, cube: null }: a view of no image.
   */
  textureAt(set: string, binding: number, layer = 0): { texture: Texture | null; cube: CubeTexture | null } | null {
    const b = this.sets.get(set)?.get(binding);
    if (b === undefined || b.view === null) return null;
    const view = this.views.get(b.view);
    if (view === undefined) return null;
    const img = this.imageOf(view.image);
    if (img === null) return { texture: null, cube: null };
    const sampler = (b.sampler !== null ? this.samplers.get(b.sampler) : undefined) ?? SamplerState.Default;
    if (layer > 0 && !view.cube && !img.cube && img.layerImages.every((i) => i === null) && !img.window) {
      const slice = img.targetId + "@" + Math.min(layer, img.layers - 1);
      const sliceDepth = img.depth;
      return { texture: new Texture(() => Rasterizer.targetImage(slice, 0, sliceDepth), sampler, { components: 4 }), cube: null };
    }
    // A further colour attachment of a target (bloom's bright colour): that attachment of the target's picture.
    const att = this.attachmentOf.get(view.image);
    if (att !== undefined) return { texture: new Texture(() => Rasterizer.targetImage(att.target, att.attachment, false), sampler, { components: 4 }), cube: null };
    if ((view.cube || img.cube) && img.layerImages.every((i) => i === null) && !img.window) {
      // A cube map drawn into (point shadows: a 6-layer framebuffer, gl_Layer): face i is layer i of the target.
      const cubeDepth = img.depth;
      const level = (target: string): (Texture | null)[] => Array.from({ length: 6 }, (_, face) =>
        new Texture(() => Rasterizer.targetImage(face === 0 ? target : target + "@" + face, 0, cubeDepth), sampler, { components: 4 }));
      // Its mip levels, when they were drawn or made from level 0: read by textureLod.
      return {
        texture: null,
        cube: new CubeTexture(level(img.targetId), {
          mips: img.targetLevels > 1 ? Array.from({ length: img.targetLevels - 1 }, (_, i) => level(img.levelTarget(i + 1))) : null,
        }),
      };
    }
    if (view.cube || img.cube) return { texture: null, cube: new CubeTexture(img.layerImages.map((i) => (i === null ? null : new Texture(i, sampler, { components: 4 })))) };
    const image = img.layerImages[0] ?? null;
    if (image !== null)
      return { texture: new Texture(image, sampler, { components: image.channels === 4 ? 4 : 3, srgb: img.srgb || this.srgbViews.has(b.view), mipmapped: img.mipmapped }), cube: null };
    const id = img.targetId;
    const depth = img.depth;
    return { texture: new Texture(() => Rasterizer.targetImage(id, 0, depth), sampler, { components: 4 }), cube: null };
  }

  hasSet(set: string): boolean {
    return this.sets.has(set);
  }

  /** Numbers of a buffer at a byte offset (from where it is bound in its memory). */
  read(buffer: string, byteOffset: number, comps: number): number[] | null {
    return read(this, buffer, byteOffset, comps);
  }

  readIndex(buffer: string, byteOffset: number): number | null {
    return readIndex(this, buffer, byteOffset);
  }
}

function memoryIndex(handle: string | null): number | null {
  if (handle === null || !handle.startsWith("mem:")) return null;
  const m = tryParseInt(handle.slice(4));
  return m !== null ? m - 1 : null;
}

/** The first n elements (LINQ's Take: none for n ≤ 0). */
function take<T>(list: readonly T[], n: number): T[] {
  return list.slice(0, Math.max(0, n));
}

/** (byte)Math.Round(Math.Clamp(v, 0, 1) * 255). */
function toByteRounded(v: number): number {
  return toByte(roundEven(clamp(v, 0, 1) * 255));
}
