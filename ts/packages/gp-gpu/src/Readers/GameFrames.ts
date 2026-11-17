import { roundEven, toInt } from "../internal/dotnet.js";
import { CppSource } from "./CppSource.js";
import { SpacePressFrame, SpaceReleaseFrame } from "./FrameConstants.js";
import type { FrameRecorder } from "./FrameRecorder.js";

/**
 * A game (learnopengl's 2D game) in Vulkan and Direct3D 12: its state moves on from frame to frame by deltaTime, so the
 * picture at time t is frame t × 60 after the frames before it ran. Deterministic like verify.sh's fixedtime.c: frame n
 * reads the clock n / 60; the space bar is pressed in frame 30 and released in frame 33. The frames before the shown
 * one run without drawing; the caller then records the shown frame as for any program.
 */
export const GameFrames = {
  lastFrame(time: number): number {
    return toInt(roundEven(time * 60.0));
  },

  /**
   * GLFW (Vulkan): the render loop's statements (`while (!glfwWindowShouldClose(window)) { … }`) for frames 0 … t × 60,
   * without the function that draws (drawFrame); the key callback gets the space bar in frame 30's and 33's
   * glfwPollEvents(). False: not a game (no key callback) or no such loop.
   */
  runGlfw(src: CppSource, recorder: FrameRecorder, time: number, drawing: Iterable<string>): boolean {
    const callback = /glfwSetKeyCallback\s*\(\s*[\w.>-]+\s*,\s*&?\s*(?:\w+::)?(\w+)\s*\)/.exec(src.code);
    const hasCallback = callback !== null && src.functions.has(callback[1]!);
    const loop = /while\s*\(\s*!\s*glfwWindowShouldClose\s*\(\s*[\w.>-]+\s*\)\s*\)\s*\{/.exec(src.code);
    const fn = loop === null ? null : src.functionAt(loop.index);
    const range = fn === null ? undefined : src.functions.get(fn);
    if (loop === null || range === undefined) return false;
    const open = loop.index + loop[0].length - 1, close = CppSource.matchBracket(src.code, open);
    if (close < 0) return false;
    // A game (a key callback), or a loop whose state moves on by deltaTime (an animation that plays).
    if (!hasCallback && !src.passesDeltaTime(src.code.slice(open + 1, close))) return false;
    // What the function does before its loop (float deltaTime = 0.0f; float lastFrame = 0.0f;), then the frames.
    recorder.runCode(src.code.slice(range.start, loop.index));
    const body = src.code.slice(open + 1, close);
    const key = callback?.[1] ?? "";
    let frame = 0;
    recorder.onPollEvents = () => {
      if (!hasCallback) return;
      if (frame === SpacePressFrame) recorder.runCode(`${key}(window, GLFW_KEY_SPACE, 0, GLFW_PRESS, 0);`);
      else if (frame === SpaceReleaseFrame) recorder.runCode(`${key}(window, GLFW_KEY_SPACE, 0, GLFW_RELEASE, 0);`);
    };
    const skipped: string[] = [];
    for (const d of drawing) {
      if (!recorder.skip.has(d)) {
        recorder.skip.add(d);
        skipped.push(d);
      }
    }
    try {
      const last = GameFrames.lastFrame(time);
      for (frame = 0; frame <= last; frame++) {
        recorder.runner.time = frame / 60.0;
        recorder.runCode(body);
      }
      recorder.runner.time = last / 60.0;
    } finally {
      recorder.onPollEvents = null;
      for (const d of skipped) recorder.skip.delete(d);
    }
    return true;
  },

  /**
   * The D3D12 samples' framework (OnKeyDown / OnUpdate / OnRender): OnUpdate for frames 0 … t × 60 − 1 with the space bar
   * delivered before frame 30's and 33's OnUpdate; the caller runs the shown frame (OnUpdate, then the commands). False:
   * not a game (no OnKeyDown, OnUpdate or deltaTime).
   */
  runWin32(src: CppSource, recorder: FrameRecorder, time: number): boolean {
    const game = src.functions.has("OnKeyDown") && src.functions.has("OnUpdate") && src.uses("deltaTime");
    // An animation that plays on by deltaTime in OnUpdate (UpdateAnimation(m_animator, deltaTime)).
    const update = src.functionBody("OnUpdate");
    const plays = update !== null && src.passesDeltaTime(update);
    if (!game && !plays) return false;
    const last = GameFrames.lastFrame(time);
    for (let frame = 0; frame <= last; frame++) {
      recorder.runner.time = frame / 60.0;
      if (frame === SpacePressFrame && game) recorder.runCode("OnKeyDown(VK_SPACE);");
      else if (frame === SpaceReleaseFrame && game && src.functions.has("OnKeyUp")) recorder.runCode("OnKeyUp(VK_SPACE);");
      if (frame < last) recorder.run("OnUpdate");
    }
    return true;
  },
};
