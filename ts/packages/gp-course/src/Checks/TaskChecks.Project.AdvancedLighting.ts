import { type CheckContext, regex } from "../CheckContext.js";
import { type Checks } from "./TaskChecks.PerApi.js";

// The optional project after Advanced Lighting: the harbour boardwalk at night (projects/<api>/advanced-lighting-project:
// the bloom chapter's program with the crates standing on the boards). The milestones are checked on the whole frame
// – counts of pixels of a kind – rather than at fixed points, so lanterns placed a little differently still pass; where
// the change is not visible on its own (the specular term, a stronger glow, the exposure) the code is checked too.

/** Lit warm by the lanterns: bright red, clearly less blue. */
const warmCount = (c: CheckContext): number => c.countPixels((p) => p[0] > 0.9 && p[2] < p[0] - 0.25);

/** The lab's coloured test lights are gone: no green, no strong blue, no pure red light left. */
function noTestLights(c: CheckContext): boolean {
  return (
    c.countPixels((p) => p[1] > p[0] + 0.1 && p[1] > p[2] + 0.1) < 20 &&
    c.countPixels((p) => p[2] > p[0] + 0.15 && p[2] > 0.3) < 20 &&
    c.countPixels((p) => p[0] > 0.5 && p[1] < 0.05 && p[2] < 0.05) < 20
  );
}

/** The lanterns light the boardwalk: warm light and none of the test lights. */
const lanterns = (c: CheckContext): boolean => c.drew && noTestLights(c) && warmCount(c) > 200;

/** The numbers a pattern's first group captures anywhere in the C++ code ("exposure = 0.3f" → 0.3). */
function numbersIn(code: string, pattern: string): number[] {
  return [...code.matchAll(regex(pattern.replaceAll(" ", "\\s*"), true))].map((m) => Number(m[1])).filter((v) => Number.isFinite(v));
}

const number = "(\\d*\\.?\\d+)f?\\b";

export function advancedLightingProject(): Record<string, Checks> {
  return {
    "advanced-lighting-project": {
      // Four warm lanterns instead of the white, red, blue and green test lights.
      "lamps": (c) => lanterns(c),
      // A faint cold ambient light: the sides the lanterns do not reach turn dark blue instead of black.
      "moonlight": (c) => lanterns(c) && c.countPixels((p) => p[2] > p[0] + 0.02 && p[2] > 0.04) > 200,
      // Blinn-Phong: a specular term with the halfway vector in the scene's lighting shader.
      "wet-boards": (c) =>
        lanterns(c) &&
        (c.hasInShaders("\\bhalfway\\w*\\b") || c.hasInShaders("normalize \\( \\w+ \\+ \\w+ \\)")) &&
        c.hasInShaders("pow \\( (?:max|clamp|saturate) \\( dot \\("),
      // A stronger glow: the blurred bright parts added more than once, or blurred with more passes.
      "mist": (c) =>
        lanterns(c) &&
        (numbersIn(c.shaders + " " + c.cpp, "bloom\\w* \\* " + number).some((v) => v > 1.0) ||
          numbersIn(c.shaders + " " + c.cpp, "\\b" + number + " \\* bloom\\w*").some((v) => v > 1.0) ||
          numbersIn(c.cpp, "\\bamount = " + number).some((v) => v > 10)),
      // The exposure turned down for the night (below 1), the lanterns still burning – and less of the frame glaring.
      "exposure": (c) =>
        c.drew &&
        noTestLights(c) &&
        [...numbersIn(c.cpp, "\\bexposure = " + number), ...numbersIn(c.cpp, "\"exposure\" , " + number)].some((v) => v > 0 && v < 0.9) &&
        c.countPixels((p) => Math.max(p[0], p[1], p[2]) > 0.9) > 150 &&
        c.countPixels((p) => Math.max(p[0], p[1], p[2]) > 0.9) < 1300,
      // One lantern flickers: the picture changes over time.
      "flicker": (c) => lanterns(c) && c.changesOverTime,
    },
  };
}
