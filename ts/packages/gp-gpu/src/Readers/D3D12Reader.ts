// D3D12Reader.cs. The other parts of the C# partial class are modules of functions that take the reader:
// D3D12Reader.Draw.ts and D3D12Reader.Pipelines.ts (their fields are declared here, marked with the part they belong to).
import { Apis } from "../Apis.js";
import type { GpuProject } from "../GpuProject.js";
import type { Image } from "../Textures/Image.js";
import { Scene } from "../Scene/Scene.js";
import { SimNote } from "../Scene/SimNote.js";
import { CppSource } from "./CppSource.js";
import { draw } from "./D3D12Reader.Draw.js";
import type { DrawTextures } from "./DrawTextures.js";
import type { PipelineInfo } from "./PipelineInfo.js";
import { registerReader } from "./ReaderRegistry.js";

/**
 * Reads a DirectX 12 program written like Microsoft's D3D12HelloWorld samples (LoadPipeline, LoadAssets,
 * PopulateCommandList, OnRender, WaitForPreviousFrame): the Win32 window and message loop, the device, queue, swap
 * chain and render target views, the clear colour, the pipeline state and the draw call. Missing pieces become
 * the messages the debug layer (or a crash) would give.
 */
export class D3D12Reader {
  /** @internal */ readonly project: GpuProject;
  /** @internal */ readonly src: CppSource;
  /** @internal */ readonly scene = new Scene({ api: Apis.D3D12 });

  /** @internal */ readonly time: number;

  // ---------- D3D12Reader.Pipelines.cs ----------
  /** @internal */ readonly runtimePsos = new Map<string, PipelineInfo | null>();

  // ---------- D3D12Reader.Draw.cs ----------
  /** @internal */ drawTextures: DrawTextures | null = null;
  /** @internal */ srvTables: { param: number; base: number; count: number }[] | null = null;
  /** The texture sizes of the last DeviceTextures call (GetDimensions, textureSize). @internal */
  deviceTextureSizes: ((id: string) => Image | null) | null = null;
  /** The cube maps of the last DeviceTextures call read at a mip level (SampleLevel). @internal */
  deviceCubeLod: ((id: string, x: number, y: number, z: number, lod: number) => number[] | null) | null = null;

  private constructor(project: GpuProject, time: number) {
    this.time = time;
    this.project = project;
    const main = project.mainFile;
    this.src = new CppSource(main, project.mainText());
  }

  static read(project: GpuProject, time = 1.0): Scene {
    return new D3D12Reader(project, time).run();
  }

  /** @internal */
  has(call: string): boolean {
    return this.src.hasCall(call) || this.src.hasCall("." + call);
  }

  private run(): Scene {
    const src = this.src, scene = this.scene;
    if (!/\b(?:wWinMain|WinMain|main)\s*\(/.test(src.code)) {
      scene.notes.push(SimNote.error("noMain"));
      return scene;
    }
    this.window();
    if (!scene.windowCreated) return scene;
    if (this.has("EnableDebugLayer")) scene.log.push("D3D12: debug layer enabled");
    if (!this.has("D3D12CreateDevice")) return this.done("dxNoDevice");
    scene.log.push("D3D12CreateDevice: S_OK (Codestead Virtual GPU, simulated)");
    if (!this.has("CreateCommandQueue")) return this.done("dxNoQueue");
    if (!this.has("CreateSwapChainForHwnd") && !this.has("CreateSwapChain")) return this.done("dxNoSwapChain");
    if (!this.has("CreateDescriptorHeap") || !this.has("CreateRenderTargetView")) return this.done("dxNoRtv");
    if (!this.has("CreateCommandAllocator") || !this.has("CreateCommandList")) return this.done("dxNoCommandList");
    if (!this.has("ExecuteCommandLists")) return this.done("dxNoExecute");
    if (!this.has("Present")) return this.done("dxNoPresent");
    scene.presents = scene.renderLoop;
    if (!this.has("CreateFence") || !this.has("Signal")) scene.notes.push(SimNote.warning("dxNoFence"));
    if (src.calls(".ResourceBarrier").length < 2) scene.notes.push(SimNote.error("dxNoBarriers"));
    const close = src.calls(".Close");
    if (close.length === 0) scene.notes.push(SimNote.error("dxListNotClosed"));
    this.clear();
    draw(this);
    return scene;
  }

  private done(note: string): Scene {
    this.scene.notes.push(SimNote.info(note));
    return this.scene;
  }

  private window(): void {
    const src = this.src, scene = this.scene;
    const create = [
      ...[...src.calls("CreateWindowExW"), ...src.calls("CreateWindowEx")].map((c) => ({ c, title: 2 })),
      ...[...src.calls("CreateWindowW"), ...src.calls("CreateWindow")].map((c) => ({ c, title: 1 })),
    ][0];
    if (create === undefined || !(src.hasCall("RegisterClassExW") || src.hasCall("RegisterClassEx") || src.hasCall("RegisterClassW") || src.hasCall("RegisterClass"))) {
      scene.notes.push(SimNote.info("noWindow"));
      return;
    }
    scene.windowCreated = true;
    scene.windowTitle = CppSource.stringArg(create.c.arg(create.title)) ?? "";
    // The client area: the swap chain's size, else the window's.
    // (The swap chain description's own Width/Height when the program sets them – a texture description's, a glyph
    // atlas, says nothing about the window.)
    const size = (field: string): string | null =>
      src.fieldAssignments(field).filter((a) => /swap/i.test(a.target)).map((a) => a.value).at(-1) ?? src.lastFieldValue(field);
    const wv = size("Width");
    const w = wv !== null ? src.int(wv) : null;
    const hv = size("Height");
    const h = hv !== null ? src.int(hv) : null;
    scene.width = w ?? 800;
    scene.height = h ?? 600;
    if (!src.hasCall("ShowWindow")) scene.notes.push(SimNote.warning("dxNoShowWindow"));
    scene.renderLoop = /WM_QUIT/.test(src.code) || src.hasCall("GetMessageW") || src.hasCall("GetMessage");
    if (!scene.renderLoop) scene.notes.push(SimNote.warning("noLoop"));
  }

  private clear(): void {
    const src = this.src, scene = this.scene;
    const clear = src.calls(".ClearRenderTargetView")[0];
    if (clear === undefined) return;
    const c = src.numbers(clear.arg(1));
    if (c !== null && c.length >= 4) scene.clearColor = [c[0]!, c[1]!, c[2]!, c[3]!];
    if (!this.has("OMSetRenderTargets") && (src.calls(".DrawInstanced").length > 0 || src.calls(".DrawIndexedInstanced").length > 0))
      scene.notes.push(SimNote.error("dxNoRenderTarget"));
  }
}

registerReader(Apis.D3D12, (project, time) => D3D12Reader.read(project, time));
