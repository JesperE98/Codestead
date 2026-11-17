// GlReader.Frames.cs: a game (learnopengl's 2D game): its state moves on from frame to frame by deltaTime, so the picture
// at time t is what frame t × 60 draws after the frames before it ran. Time and input are deterministic, as verify.sh's
// fixedtime.c makes them on a real driver: frame n reads glfwGetTime() = n / 60, and the space bar is pressed in frame
// 30's glfwPollEvents() and released in frame 33's (through the program's key callback).
import { roundEven, toInt, trimNet } from "../internal/dotnet.js";
import { matchesAll } from "../internal/regex.js";
import { CppSource } from "./CppSource.js";
import { CppStatement } from "./CppStatement.js";
import { SpacePressFrame, SpaceReleaseFrame } from "./FrameConstants.js";
import type { GlReader } from "./GlReader.js";

/** @internal The render loop runs frame by frame: the program has a key callback (a game). */
export function stepped(r: GlReader): boolean {
  if (r.src.hasCall("glfwSetKeyCallback")) return true;
  const body = renderLoopBody(r);
  return body !== null && r.src.passesDeltaTime(body);
}

/** The text of main's render loop (while (!glfwWindowShouldClose(window)) { … }), or null. */
function renderLoopBody(r: GlReader): string | null {
  const code = r.src.code;
  const loop = /while\s*\(\s*!\s*glfwWindowShouldClose\s*\(\s*[\w.>-]+\s*\)\s*\)\s*\{/.exec(code);
  if (loop === null) return null;
  const close = CppSource.matchBracket(code, loop.index + loop[0].length - 1);
  return close < 0 ? null : code.slice(loop.index + loop[0].length, close);
}

/** A statement that only calls a function of the program that draws (Render(Hedgerow)). */
function drawsOnly(r: GlReader, st: CppStatement): boolean {
  if (st.kind !== "stmt") return false;
  const c = /^(\w+)\s*\(([\s\S]*)\)$/.exec(trimNet(st.text));
  return c !== null && r.src.functions.has(c[1]!) && r.src.callsApi(c[1]!) && drawOnly(r, c[1]!, 0);
}

const AssignmentRe = /(?<![\w.>=!<+\-*\/%&|^])([A-Za-z_]\w*)\s*(?:(?:\.|->)\s*\w+\s*|\[[^\]]*\]\s*)*(?:[+\-*\/%&|^]|<<|>>)?=(?!=)|(?:\+\+|--)\s*([A-Za-z_]\w*)|([A-Za-z_]\w*)\s*(?:(?:\.|->)\s*\w+\s*|\[[^\]]*\]\s*)*(?:\+\+|--)/g;
const DeclarationRe = /(?:^|[;{(,])\s*(?:const\s+|static\s+)*(?:unsigned\s+)?[A-Za-z_][\w:]*(?:\s*<[^;{}()]*>)?(?:\s*[*&]+\s*|\s+)([A-Za-z_]\w*)\s*(?=[=;:\[({,)])/g;
const MutatingMethodRe = /\.\s*(?:push_back|emplace_back|insert|emplace|erase|clear|resize|pop_back|reserve|swap|assign)\s*\(/;

/**
 * A function of the program that only draws: it writes nothing but its own local variables (and parameters it got
 * by value), and the functions it calls are such functions too – so a frame that is not shown can skip it.
 */
function drawOnly(r: GlReader, fn: string, depth: number): boolean {
  const known = r.drawOnly.get(fn);
  if (known !== undefined) return known;
  const body = depth > 12 ? null : r.src.functionBody(fn);
  if (body === null) return false;
  r.drawOnly.set(fn, false); // recursion: not known yet, so not skipped
  const parameters = r.src.parametersOf(fn) ?? [];
  const locals = new Set(parameters.filter((p) => !p.ref).map((p) => p.name));
  for (const d of matchesAll(DeclarationRe, body)) locals.add(d[1]!);
  let result = !MutatingMethodRe.test(body) && !body.includes("static ");
  if (result)
    for (const a of matchesAll(AssignmentRe, body)) {
      const root = a[1] ?? a[2] ?? a[3]!;
      if (!locals.has(root)) {
        result = false;
        break;
      }
    }
  if (result)
    for (const c of matchesAll(/(?<![\w.>])(\w+)\s*\(/g, body)) {
      const callee = c[1]!;
      if (callee !== fn && r.src.functions.has(callee) && !drawOnly(r, callee, depth + 1)) {
        result = false;
        break;
      }
    }
  r.drawOnly.set(fn, result);
  return result;
}

/** @internal */
export function loopEnd(statements: readonly CppStatement[], start: number): number | null {
  for (let i = start + 1; i < statements.length; i++) if (statements[i]!.kind === "loop-end") return i;
  return null;
}

/** The key callback the program set (glfwSetKeyCallback(window, key_callback)), if it is its own function. */
function keyCallback(r: GlReader): string | null {
  const m = /glfwSetKeyCallback\s*\(\s*\w+\s*,\s*&?\s*(\w+)\s*\)/.exec(r.src.code);
  return m !== null && r.src.functions.has(m[1]!) ? m[1]! : null;
}

/** @internal Frames 0 … t × 60 of the render loop; the scene keeps what the last one draws. */
export function runFrames(r: GlReader, body: readonly CppStatement[]): void {
  const runner = r.env.runner;
  const scene = r.scene;
  const last = toInt(roundEven(runner.time * 60.0));
  const callback = keyCallback(r);
  const draws = scene.draws.length, ops = scene.ops.length, notes = scene.notes.length;
  for (let frame = 0; frame <= last; frame++) {
    runner.time = frame / 60.0;
    r.discardDraws = frame < last;
    // What the frame before drew is gone when this one clears; its state stays.
    scene.draws.length = draws;
    scene.ops.length = ops;
    scene.notes.length = notes;
    for (const st of body) {
      // A frame that is not shown needs no drawing: only what changes the program's state runs.
      if (frame < last && drawsOnly(r, st)) continue;
      r.statement(st);
      if (callback === null || !st.text.includes("glfwPollEvents")) continue;
      // The events of this poll: the space bar.
      if (frame === SpacePressFrame) r.statement(new CppStatement(`${callback}(window, GLFW_KEY_SPACE, 0, GLFW_PRESS, 0)`, st.offset));
      else if (frame === SpaceReleaseFrame) r.statement(new CppStatement(`${callback}(window, GLFW_KEY_SPACE, 0, GLFW_RELEASE, 0)`, st.offset));
    }
  }
  r.discardDraws = false;
}
