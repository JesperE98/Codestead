import { type DrawCall, Topology } from "@codestead/gp-gpu";
import { CommandFacts } from "@codestead/learning";
import type { CheckContext } from "../CheckContext.js";

/** The init-only properties of {@link BuildFacts}. */
export interface BuildFactsInit {
  line?: string;
  output?: string;
  exitCode?: number;
  api?: string;
  succeeded?: boolean;
  showsFrames?: boolean;
  drew?: boolean;
  clearColor?: readonly number[] | null;
  textured?: boolean;
  depthTested?: boolean;
  wireframe?: boolean;
  triangles?: number;
  drawnPixels?: number;
  windowWidth?: number;
  windowHeight?: number;
  windowTitle?: string;
  printed?: readonly string[];
}

/** A fragment shader reads a texture (GLSL texture() and its kin, HLSL's Sample()). */
const samplesTexture = /\b(?:texture(?:Lod|Proj|Grad|Offset)?|texelFetch|texture2D)\s*\(|\.Sample(?:Level|Grad|Bias|Cmp)?\s*\(/;

/** The most lines of the program's output kept (a program that prints every frame prints a lot). */
const MaxPrinted = 50;

/** The triangles a draw makes (all its instances); 0 for lines, points and patches. */
function trianglesOf(d: DrawCall): number {
  const n = Math.max(0, d.count);
  const per = d.topology === Topology.Triangles ? Math.floor(n / 3) : d.topology === Topology.TriangleStrip || d.topology === Topology.TriangleFan ? Math.max(0, n - 2) : 0;
  return per * Math.max(1, d.instances);
}

/** What one "Build &amp; run" did, for the statistics and achievements. {@link CommandFacts.names} are the API functions the project calls. */
export class BuildFacts extends CommandFacts {
  readonly api: string;
  readonly succeeded: boolean;
  /** The window stayed open and showed frames. */
  readonly showsFrames: boolean;
  /** Something was drawn in the frame. */
  readonly drew: boolean;
  readonly clearColor: readonly number[] | null;
  /** Something was drawn, with a fragment shader that reads a texture. */
  readonly textured: boolean;
  /** Something was drawn, with the depth test on. */
  readonly depthTested: boolean;
  /** Something was drawn, in wireframe (glPolygonMode GL_LINE, VK_POLYGON_MODE_LINE, D3D12_FILL_MODE_WIREFRAME). */
  readonly wireframe: boolean;
  /** The triangles of one frame's draw calls (every instance counted). */
  readonly triangles: number;
  /** The pixels of the small check frame (160 pixels wide) that are not the clear colour (0 without draw calls). */
  readonly drawnPixels: number;
  /** The window's size (0 when nothing is shown). */
  readonly windowWidth: number;
  readonly windowHeight: number;
  readonly windowTitle: string;
  /** The first lines the program prints (std::cout, OutputDebugStringA …). */
  readonly printed: readonly string[];

  constructor(init: BuildFactsInit = {}) {
    super(init);
    this.api = init.api ?? "";
    this.succeeded = init.succeeded ?? false;
    this.showsFrames = init.showsFrames ?? false;
    this.drew = init.drew ?? false;
    this.clearColor = init.clearColor ?? null;
    this.textured = init.textured ?? false;
    this.depthTested = init.depthTested ?? false;
    this.wireframe = init.wireframe ?? false;
    this.triangles = init.triangles ?? 0;
    this.drawnPixels = init.drawnPixels ?? 0;
    this.windowWidth = init.windowWidth ?? 0;
    this.windowHeight = init.windowHeight ?? 0;
    this.windowTitle = init.windowTitle ?? "";
    this.printed = init.printed ?? [];
  }

  /** The init-only properties (what crosses from the app's worker to its window). */
  get init(): Required<BuildFactsInit> {
    return {
      line: this.line,
      output: this.output,
      exitCode: this.exitCode,
      api: this.api,
      succeeded: this.succeeded,
      showsFrames: this.showsFrames,
      drew: this.drew,
      clearColor: this.clearColor,
      textured: this.textured,
      depthTested: this.depthTested,
      wireframe: this.wireframe,
      triangles: this.triangles,
      drawnPixels: this.drawnPixels,
      windowWidth: this.windowWidth,
      windowHeight: this.windowHeight,
      windowTitle: this.windowTitle,
      printed: this.printed,
    };
  }

  static from(c: CheckContext): BuildFacts {
    // Only what the checks have already worked out, or cheap to count: the frame is rendered once for the checks.
    const shows = c.shows;
    const scene = shows ? c.scene! : null;
    const drew = shows && c.drew;
    const draws = drew ? scene!.draws : [];
    const facts = new BuildFacts({
      line: "build",
      output: c.build.diagnostics.map((d) => d.toString()).join("\n"),
      exitCode: c.built ? 0 : 1,
      api: c.api,
      succeeded: c.built,
      showsFrames: shows,
      drew,
      clearColor: scene?.clearColor ?? null,
      textured: draws.some((d) => samplesTexture.test(d.fragmentShader.source)),
      depthTested: draws.some((d) => d.depthTest),
      wireframe: draws.some((d) => d.wireframe),
      triangles: scene?.draws.reduce((n, d) => n + trianglesOf(d), 0) ?? 0,
      // Counted whenever something is drawn at all: a thing too small for `drew` (which looks at every other pixel) counts too.
      drawnPixels: scene !== null && scene.draws.length > 0 ? Math.round(c.covered * c.frame!.width * c.frame!.height) : 0,
      windowWidth: scene?.width ?? 0,
      windowHeight: scene?.height ?? 0,
      windowTitle: scene?.windowTitle ?? "",
      printed: (c.scene?.log ?? []).slice(0, MaxPrinted),
    });
    for (const m of c.cpp.matchAll(/\b(gl[A-Z]\w*|glfw[A-Z]\w*|vk[A-Z]\w*|D3D12[A-Z]\w*|CreateDXGIFactory\d?)\s*\(/g))
      if (!facts.names.includes(m[1]!)) facts.names.push(m[1]!);
    facts.firstWords.push("build");
    return facts;
  }
}
