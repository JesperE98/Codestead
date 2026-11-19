import { CppSource, Rasterizer, type BuildResult, type Frame, type GpuProject, type Scene } from "@codestead/gp-gpu";
import { WHITESPACE_RUN } from "./Edits.js";

/** A pixel's colour as RGBA in 0–1 (Frame.at's number[], typed so the checks can read p[0] … p[3]). */
export type Rgba = [number, number, number, number];

/** Compiled check patterns: C#'s Regex caches them too (the checks run the same patterns again and again). */
const patterns = new Map<string, RegExp>();

/**
 * A C# pattern as a JavaScript regular expression: a leading "(?i)" (the only inline option the checks use) becomes the
 * i flag; the rest is written the same in both (see gp-gpu's PORTING.md for the differences that do not matter here).
 */
export function regex(pattern: string, global = false): RegExp {
  const key = (global ? "g:" : ":") + pattern;
  let re = patterns.get(key);
  if (re === undefined) {
    let flags = global ? "g" : "";
    let source = pattern;
    if (source.startsWith("(?i)")) {
      source = source.slice(4);
      flags += "i";
    }
    patterns.set(key, (re = new RegExp(source, flags)));
  }
  return re;
}

/** Regex.IsMatch. */
export function isMatch(input: string, pattern: string): boolean {
  return regex(pattern).test(input);
}

/** Regex.Matches(…).Count: the matches one after the other (an empty match moves on by one). */
export function matchCount(input: string, pattern: string): number {
  const re = regex(pattern, true);
  re.lastIndex = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    n++;
    if (m[0].length === 0) re.lastIndex++;
  }
  return n;
}

/** Math.Clamp of ints. */
const clampInt = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

/**
 * What a task's check looks at after a "Build &amp; run": the project's code (comments removed, whitespace
 * collapsed), the build, and – when it ran – the scene and a rendered frame.
 */
export class CheckContext {
  private frame_: Frame | null = null;
  private readonly code = new Map<string, string>();
  private readonly framesAt = new Map<number, Frame>();
  private readonly scenesAt = new Map<number, Scene>();
  private fullFrame_: Frame | null = null;

  constructor(
    readonly api: string,
    readonly project: GpuProject,
    readonly build: BuildResult,
  ) {}

  get scene(): Scene | null {
    return this.build.scene;
  }

  /** It compiled. */
  get built(): boolean {
    return this.build.succeeded;
  }

  /** It compiled, the window stays open and frames are shown. */
  get shows(): boolean {
    return this.built && this.scene?.showsFrames === true;
  }

  /** The frame at time 1 s, 160 pixels wide (null when nothing is shown). */
  get frame(): Frame | null {
    return this.shows ? (this.frame_ ??= Rasterizer.render(this.scene!, 160)) : null;
  }

  /** The frame at another time (a game's state after t × 60 frames), 160 pixels wide; null when nothing is shown. */
  frameAt(time: number): Frame | null {
    if (time === 1.0) return this.frame;
    if (!this.shows) return null;
    let f = this.framesAt.get(time);
    if (f === undefined) this.framesAt.set(time, (f = Rasterizer.render(this.sceneAt(time)!, 160, time)));
    return f;
  }

  /**
   * What the program does when its clock reads another time (read once per time: the frame and the window title
   * at that time come from it); the scene itself when nothing depends on the time.
   */
  sceneAt(time: number): Scene | null {
    const scene = this.scene;
    if (time === 1.0 || scene === null || !scene.animated || scene.atTime === null) return scene;
    let s = this.scenesAt.get(time);
    if (s === undefined) this.scenesAt.set(time, (s = scene.atTime(time)));
    return s;
  }

  /** The window's title at a time (a program that sets it in its render loop: glfwSetWindowTitle, SetWindowTextW); "" when nothing is shown. */
  windowTitleAt(time: number): string {
    return this.shows ? (this.sceneAt(time)?.windowTitle ?? "") : "";
  }

  /** The colour at a point of the frame at a time (0–1 of width and height, from the top left). */
  pixelAt(time: number, x: number, y: number): Rgba | null {
    return (this.frameAt(time)?.atRelative(x, y) as Rgba | undefined) ?? null;
  }

  /** A file's code with comments removed and whitespace collapsed to single spaces ("" if missing). */
  codeOf(file: string): string {
    let c = this.code.get(file);
    if (c === undefined) {
      const path = this.project.pathOf(file);
      const text = path === null ? "" : this.project.files.get(path)!;
      this.code.set(file, (c = CppSource.blankComments(text).replace(WHITESPACE_RUN, " ")));
    }
    return c;
  }

  /** All C++ code of the project, normalised. */
  get cpp(): string {
    return this.project.cppFiles.map(([k]) => this.codeOf(k)).join(" ");
  }

  /** The shader code (every shader file), normalised. */
  get shaders(): string {
    const cpp = this.project.cppFiles;
    return [...this.project.files.keys()]
      .filter((k) => !cpp.some(([c]) => c === k))
      .map((k) => this.codeOf(k))
      .join(" ");
  }

  /** A regular expression found in the C++ code (spaces in the pattern match any whitespace). */
  has(pattern: string): boolean {
    return isMatch(this.cpp, spaces(pattern));
  }

  /** A regular expression found in a file. */
  hasIn(file: string, pattern: string): boolean {
    return isMatch(this.codeOf(file), spaces(pattern));
  }

  /** A regular expression found in the shaders (files, or for OpenGL also the shader strings in main.cpp). */
  hasInShaders(pattern: string): boolean {
    return isMatch(this.shaders + " " + this.cpp, spaces(pattern));
  }

  count(pattern: string): number {
    return matchCount(this.cpp, spaces(pattern));
  }

  /** The lines the program printed (std::cout, std::cerr, OutputDebugStringA, the simulated driver's). */
  get output(): readonly string[] {
    return this.scene?.log ?? [];
  }

  /** The number of printed lines a regular expression is found in. */
  printedCount(pattern: string): number {
    return this.output.filter((l) => isMatch(l, pattern)).length;
  }

  /** A regular expression found in a printed line. */
  printed(pattern: string): boolean {
    return this.printedCount(pattern) > 0;
  }

  /** The window is cleared to a colour (±0.01). */
  clearedTo(r: number, g: number, b: number): boolean {
    const c = this.shows ? this.scene!.clearColor : null;
    return c !== null && CheckContext.near(c[0]!, r) && CheckContext.near(c[1]!, g) && CheckContext.near(c[2]!, b);
  }

  /** The colour at a point of the frame (0–1 of width and height, from the top left). */
  pixel(x: number, y: number): Rgba | null {
    return (this.frame?.atRelative(x, y) as Rgba | undefined) ?? null;
  }

  /** The pixel at a point has a colour (±0.02 per channel). */
  pixelIs(x: number, y: number, r: number, g: number, b: number): boolean {
    const p = this.pixel(x, y);
    return p !== null && CheckContext.near(p[0]!, r, 0.02) && CheckContext.near(p[1]!, g, 0.02) && CheckContext.near(p[2]!, b, 0.02);
  }

  private clearColour(): number[] {
    return this.scene!.clearColor ?? [0, 0, 0, 1];
  }

  /** The colour is the clear colour (±0.02 per channel). */
  private isClearPixel(p: number[], clear: number[]): boolean {
    return CheckContext.near(p[0]!, clear[0]!, 0.02) && CheckContext.near(p[1]!, clear[1]!, 0.02) && CheckContext.near(p[2]!, clear[2]!, 0.02);
  }

  /** Something was drawn: a pixel differs from the clear colour. */
  get drew(): boolean {
    const f = this.frame;
    if (f === null || this.scene!.draws.length === 0) return false;
    const clear = this.clearColour();
    for (let y = 0; y < f.height; y += 2)
      for (let x = 0; x < f.width; x += 2) if (!this.isClearPixel(f.at(x, y), clear)) return true;
    return false;
  }

  /** The share of the frame (0–1) whose colour differs from the clear colour. */
  get covered(): number {
    const f = this.frame;
    if (f === null) return 0;
    const clear = this.clearColour();
    let n = 0;
    for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) if (!this.isClearPixel(f.at(x, y), clear)) n++;
    return n / (f.width * f.height);
  }

  /**
   * The frame at time 1 s at the window's own size (one pixel per window pixel), null when nothing is shown: for
   * pictures whose density depends on the resolution – lines of a wireframe are one pixel wide at any size.
   */
  get fullFrame(): Frame | null {
    return this.shows ? (this.fullFrame_ ??= Rasterizer.render(this.scene!, this.scene!.width)) : null;
  }

  /**
   * The share (0–1) of a box of window pixels (x0…x1, y0…y1, inclusive, from the top left) that is not the clear
   * colour – in the check frame, or in {@link fullFrame} (lines of a wireframe: how dense the mesh is).
   */
  coveredIn(x0: number, y0: number, x1: number, y1: number, fullSize = false): number {
    const f = fullSize ? this.fullFrame : this.frame;
    if (f === null) return 0;
    const scene = this.scene!;
    const clear = this.clearColour();
    const sx = f.width / scene.width;
    const sy = f.height / scene.height;
    // (int) of a non-negative double: truncation.
    const fx0 = clampInt(Math.trunc(x0 * sx), 0, f.width - 1);
    const fx1 = clampInt(Math.trunc(x1 * sx), 0, f.width - 1);
    const fy0 = clampInt(Math.trunc(y0 * sy), 0, f.height - 1);
    const fy1 = clampInt(Math.trunc(y1 * sy), 0, f.height - 1);
    let n = 0;
    let all = 0;
    for (let y = fy0; y <= fy1; y++)
      for (let x = fx0; x <= fx1; x++) {
        all++;
        if (!this.isClearPixel(f.at(x, y), clear)) n++;
      }
    return n / all;
  }

  /** The pixel at a point shows the clear colour (nothing drawn there). */
  isClear(x: number, y: number): boolean {
    const p = this.pixel(x, y);
    if (p === null) return false;
    return this.isClearPixel(p, this.clearColour());
  }

  /** Something is drawn at a point (the frame is shown and the pixel is not the clear colour). */
  drawnAt(x: number, y: number): boolean {
    return this.frame !== null && !this.isClear(x, y);
  }

  /** The strongest channel at a point: "r", "g" or "b" (by a clear margin), else "?". (C#: a char.) */
  dominant(x: number, y: number): string {
    const p = this.pixel(x, y);
    if (p === null) return "?";
    const max = Math.max(p[0]!, Math.max(p[1]!, p[2]!));
    const i = p[0] === max ? 0 : p[1] === max ? 1 : 2;
    const others = [p[0]!, p[1]!, p[2]!].filter((_, k) => k !== i);
    return others.every((o) => o < max - 0.25) ? "rgb"[i]! : "?";
  }

  /** Some drawn pixel (not the clear colour) satisfies a test. */
  anyDrawnPixel(test: (p: Rgba) => boolean): boolean {
    const f = this.frame;
    if (f === null) return false;
    const clear = this.clearColour();
    for (let y = 0; y < f.height; y++)
      for (let x = 0; x < f.width; x++) {
        const p = f.at(x, y) as Rgba;
        if (this.isClearPixel(p, clear)) continue;
        if (test(p)) return true;
      }
    return false;
  }

  /** How many pixels of the (small) check frame satisfy a test. */
  countPixels(test: (p: Rgba) => boolean): number {
    const f = this.frame;
    if (f === null) return 0;
    let n = 0;
    for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) if (test(f.at(x, y) as Rgba)) n++;
    return n;
  }

  /** The picture changes over time: the frame at 2.3 s differs from the one at 1 s in more than a few pixels. */
  get changesOverTime(): boolean {
    const f = this.frame;
    if (f === null || !this.scene!.animated) return false;
    const later = Rasterizer.render(this.scene!, 160, 2.3);
    let differ = 0;
    const a = f.pixels;
    const b = later.pixels;
    for (let i = 0; i < a.length; i += 4)
      if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) > 12) differ++;
    return differ > 20;
  }

  static near(a: number, b: number, tolerance = 0.01): boolean {
    return Math.abs(a - b) <= tolerance;
  }
}

/** Spaces in a pattern match any whitespace. */
function spaces(pattern: string): string {
  return pattern.replaceAll(" ", "\\s*");
}

/**
 * C#'s `x is { } v && …`: false when the value is null, else the rest of the condition with the value. (The checks
 * use it for a pixel that may not be there.)
 */
export function given<T>(value: T | null | undefined, rest: (v: T) => boolean): boolean {
  return value !== null && value !== undefined && rest(value);
}

/** C#'s `x is > min and < max`. */
export function between(value: number, min: number, max: number): boolean {
  return value > min && value < max;
}
