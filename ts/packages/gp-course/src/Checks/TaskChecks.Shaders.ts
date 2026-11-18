import { given, type CheckContext } from "../CheckContext.js";
import { type Checks } from "./TaskChecks.PerApi.js";

// Shaders: the same six steps in every API, checked on the picture (and the code where the picture cannot tell).

/** The three corners of the triangle (just inside it) show red, green and blue, one each. */
export function threeColours(c: CheckContext): boolean {
  const corners = [c.dominant(0.5, 0.32), c.dominant(0.33, 0.72), c.dominant(0.67, 0.72)];
  return new Set(corners).size === 3 && !corners.includes("?");
}

export function shaders(): Checks {
  return {
    // A colour passed from the vertex to the fragment/pixel shader: dark red (0.5, 0, 0).
    "in-out": c => c.pixelIs(0.5, 0.55, 0.5, 0.0, 0.0),
    // A colour from the CPU that changes over time: green, animated.
    "uniform": c => c.scene?.animated === true && given(c.pixel(0.5, 0.55), (p) => p[1] > 0.3 && p[0] < 0.05 && p[2] < 0.05),
    // A colour per vertex, interpolated: red, green and blue corners.
    "vertex-colors": threeColours,
    // Upside down: the wide side on top.
    "upside-down": c => c.drawnAt(0.3, 0.28) && c.isClear(0.3, 0.72),
    // Moved 0.5 to the right by a uniform / push constant / root constant.
    "offset": c => c.drawnAt(0.75, 0.5) && c.isClear(0.5, 0.5) && c.hasInShaders("(?i)offset"),
    // The position as the colour: negative coordinates give black.
    "position-color": c => c.drew && c.anyDrawnPixel(p => p[0] < 0.05 && p[1] < 0.05 && p[2] < 0.05) && c.anyDrawnPixel(p => p[0] > 0.3 || p[1] > 0.3),
  };
}
