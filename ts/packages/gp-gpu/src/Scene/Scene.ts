import type { DrawCall } from "./DrawCall.js";
import type { FrameOp } from "./FrameOp.js";
import type { RenderTarget } from "./RenderTarget.js";
import type { SimNote } from "./SimNote.js";

/**
 * What the learner's program does when it runs, as far as the simulator can tell: the window, whether it keeps running
 * and showing frames, the clear colour and the draw calls of one frame.
 */
export class Scene {
  readonly api: string;
  windowTitle = "";
  width = 800;
  height = 600;
  windowCreated = false;
  /** The program has a render loop, so the window stays open. */
  renderLoop = false;
  /** Each frame is shown (glfwSwapBuffers, vkQueuePresentKHR, IDXGISwapChain::Present). */
  presents = false;
  /** RGBA; null when the frame is never cleared. */
  clearColor: number[] | null = null;
  readonly draws: DrawCall[] = [];
  /**
   * The first draws of `draws` that the program makes once, before its render loop, into off-screen targets (an
   * environment map captured into a cube map, a look-up table): the frame's own draws follow.
   */
  setupDraws = 0;
  /** The first `ops` that belong to those draws. */
  setupOps = 0;
  /** What the setup draws left in their targets, kept between frames (the simulator's own; see Rasterizer). */
  setupCache: unknown = null;
  setupKey: string | null = null;
  /** Off-screen render targets by id (framebuffer objects …); draws name them in DrawCall.target. */
  readonly targets = new Map<string, RenderTarget>();
  /** Clears and copies between draws, in program order (the window's first clear is clearColor). */
  readonly ops: FrameOp[] = [];
  /** Samples per pixel of the window (multisample anti-aliasing: glfwWindowHint(GLFW_SAMPLES, 4) …). */
  samples = 1;
  /**
   * The window is written through an sRGB format (GL_FRAMEBUFFER_SRGB, an _SRGB swap chain format or render target
   * view): the shaders' linear colours are encoded with the sRGB curve when stored.
   */
  windowSrgb = false;
  readonly notes: SimNote[] = [];
  /** Lines the program writes while it runs (as a real program would print them). */
  readonly log: string[] = [];
  /** The frame changes over time (a uniform uses glfwGetTime or a clock), so the preview animates. */
  animated = false;
  /** Something the simulator does not understand: the preview may not match a real run. */
  approximate = false;
  /** The same program read again at another time (the preview animates with it). */
  atTime: ((time: number) => Scene) | null = null;

  /** `new Scene { Api = …, … }`: the api is required; the other settable properties may be given too. */
  constructor(init: { api: string } & Partial<Omit<Scene, "api" | "draws" | "targets" | "ops" | "notes" | "log" | "showsFrames">>) {
    this.api = init.api;
    const { api: _api, ...rest } = init;
    Object.assign(this, rest);
  }

  /** The frame can be shown: a window that stays open and presents. */
  get showsFrames(): boolean {
    return this.windowCreated && this.renderLoop && this.presents;
  }
}
