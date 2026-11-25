import type { DrawCall } from "@codestead/gp-gpu";
import { matchCount, type CheckContext, type Rgba } from "../CheckContext.js";
import { changedPoints } from "./TaskChecks.ExercisesGettingStarted.js";
import type { Checks } from "./TaskChecks.PerApi.js";
import { distance, floatOf, matrixOf, scaleOf, vec3Of, vectorsByName, type Vec3 } from "./SceneValues.js";

// The project after Lighting, "Opening night": the ten containers of Multiple lights are the cast, and the learner
// lights the show – the work light off, coloured gels on the point lights and their lamps, a follow spot above the
// stage that sweeps across it, and a polished material (projects/<api>/lighting-project). The lights are read from the
// uniforms the containers' draws hand their shaders (the same names in every API: dirLight, pointLights[i],
// spotLight, material); the picture has to show the colours and the moving spot.

/**
 * The draws that hand their shaders the lights: those with the camera's position for the specular term (the
 * containers; in Vulkan and DirectX 12 the lamps too, which share the containers' uniform or constant buffer).
 */
function litDraws(c: CheckContext): DrawCall[] {
  return c.shows ? c.scene!.draws.filter((d) => vec3Of(d, 1.0, "viewPos") !== null) : [];
}

/** The lamps: small draws (scaled to under half the containers' size). */
function lampDraws(c: CheckContext): DrawCall[] {
  if (!c.shows) return [];
  return c.scene!.draws.filter((d) => {
    const model = matrixOf(d, 1.0, "model");
    return model !== null && scaleOf(model) < 0.5;
  });
}

/** A colour no white light gives: one channel at least 0.4 above another. */
const coloured = (rgb: Vec3): boolean => Math.max(...rgb) - Math.min(...rgb) >= 0.4;

/** Two colours clearly differ: by more than 0.3 in a channel. */
const differ = (a: Vec3, b: Vec3): boolean => a.some((v, i) => Math.abs(v - b[i]!) > 0.3);

/** Some of the colours are coloured and two of those differ from each other. */
function twoColours(colours: (Vec3 | null)[]): boolean {
  const list = colours.filter((c): c is Vec3 => c !== null && coloured(c));
  return list.some((a, i) => list.slice(i + 1).some((b) => differ(a, b)));
}

/**
 * A pixel no white light gives the containers: under white light their wood is red over green over blue (green at
 * least half of red) and their steel grey. Green or blue clearly above red, or a deep red, comes from a coloured light.
 */
const colouredLight = (p: Rgba): boolean => p[1] > p[0] + 0.08 || p[2] > p[0] + 0.1 || (p[0] > 0.15 && p[1] < 0.35 * p[0]);

export function lightingProject(): Record<string, Checks> {
  return {
    "lighting-project": {
      // A dark hall (every channel of the clear colour at most 0.05) and the directional light off or nearly: its
      // diffuse at most 0.1 and its ambient at most 0.03 (or not there at all).
      "house-lights": (c) => {
        const lit = litDraws(c);
        const clear = c.scene?.clearColor ?? null;
        return (
          lit.length > 0 &&
          clear !== null &&
          clear.slice(0, 3).every((v) => v <= 0.05) &&
          lit.every((d) => Math.max(...(vec3Of(d, 1.0, "dirLight.diffuse") ?? [0])) <= 0.1 && Math.max(...(vec3Of(d, 1.0, "dirLight.ambient") ?? [0])) <= 0.03)
        );
      },
      // At least two point lights in clearly different colours, and the stage shows colour (200 pixels of the check
      // frame's 19,200 in colours no white light gives).
      "gels": (c) => {
        const lit = litDraws(c)[0];
        if (lit === undefined) return false;
        const colours = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => vec3Of(lit, 1.0, `pointLights[${i}].diffuse`));
        return twoColours(colours) && c.countPixels(colouredLight) >= 200;
      },
      // The lamps hand their fragment shader a colour, at least two of them clearly different ones, and the shader
      // uses it (its name is there besides its declaration); a lamp in its colour is in the picture.
      "lamp-colours": (c) => {
        for (const [name, colours] of vectorsByName(lampDraws(c)))
          if (
            twoColours(colours) &&
            matchCount(c.shaders, `\\b${name}\\b`) >= 2 &&
            colours.some((rgb) => rgb !== null && coloured(rgb) && c.countPixels((p) => p.slice(0, 3).every((v, i) => Math.abs(v - Math.min(rgb[i]!, 1)) <= 0.03)) >= 4)
          )
            return true;
        return false;
      },
      // The spot hangs above the stage (at least a unit higher than the camera's eye, not where the camera is) and shines
      // downwards.
      "follow-spot": (c) =>
        litDraws(c).some((d) => {
          const position = vec3Of(d, 1.0, "spotLight.position");
          const direction = vec3Of(d, 1.0, "spotLight.direction");
          const eye = vec3Of(d, 1.0, "viewPos");
          return position !== null && direction !== null && eye !== null && position[1] >= eye[1] + 1 && distance(position, eye) > 1 && direction[1] < -0.1;
        }),
      // The spot's direction changes with the time, and so does the picture where it shines.
      "sweep": (c) =>
        changedPoints(c, 0.05, 0.05, 0.95, 0.95) > 10 &&
        litDraws(c).some((d) => {
          const a = vec3Of(d, 1.0, "spotLight.direction");
          const b = vec3Of(c.sceneAt(2.3)!.draws[c.scene!.draws.indexOf(d)]!, 2.3, "spotLight.direction");
          return a !== null && b !== null && distance(a, b) > 0.1;
        }),
      // A shinier material: a shininess of 64 or more (the start's is 32).
      "polish": (c) => litDraws(c).some((d) => (floatOf(d, 1.0, "material.shininess") ?? 0) >= 64),
    },
  };
}
