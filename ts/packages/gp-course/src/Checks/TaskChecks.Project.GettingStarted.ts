import { matchCount, type CheckContext } from "../CheckContext.js";
import type { Checks } from "./TaskChecks.PerApi.js";
import { cameraOf, distance, matrixOf, minus, placedAt, turnDifference, vectorsByName, type Placed } from "./SceneValues.js";

// The project after Getting started, "A tiny solar system": a night sky, a camera up in the gallery, a spinning sun,
// a planet orbiting it, a moon orbiting the planet and a colour for each body (projects/<api>/getting-started-project).
// The bodies are checked where the draws' model matrices put them (the same in every API, wherever the camera is):
// the learner chooses sizes, distances and speeds, so the checks ask for the relations – the sun in the middle and
// turning, the planet always as far from the sun but somewhere else later, the moon always as far from the planet.

/** The times the orbits are compared at (seconds). */
const times = [1.0, 2.3, 3.7];

/** The objects of the frame at each of the times (the same draws in the same order). */
function placed(c: CheckContext): Placed[][] {
  return times.map((t) => placedAt(c, t));
}

/** The spread (max − min) of some numbers. */
const spread = (values: number[]): number => Math.max(...values) - Math.min(...values);

/** The sun: a body bigger than the course's crate in the middle of the world, the same place at every time, turning. */
function sun(at: Placed[][]): number | null {
  const first = at[0] ?? [];
  for (const body of first) {
    const all = at.map((list) => list.find((b) => b.index === body.index));
    if (all.some((b) => b === undefined)) continue;
    const bodies = all as Placed[];
    if (bodies.every((b) => distance(b.position, [0, 0, 0]) < 0.3 && b.scale >= 1.3) && turnDifference(bodies[0]!.model, bodies[1]!.model) > 0.05)
      return body.index;
  }
  return null;
}

/** A body circling a centre body: always about as far from it (0.1), but somewhere else after a while; smaller than it. */
function circles(at: Placed[][], body: number, centre: number, min: number, max: number): boolean {
  const pairs = at.map((list) => [list.find((b) => b.index === body), list.find((b) => b.index === centre)] as const);
  if (pairs.some(([b, c]) => b === undefined || c === undefined)) return false;
  const offsets = pairs.map(([b, c]) => minus(b!.position, c!.position));
  const distances = offsets.map((o) => Math.hypot(...o));
  return (
    distances.every((d) => d >= min && d <= max) &&
    spread(distances) < 0.1 &&
    distance(offsets[0]!, offsets[1]!) > 0.3 &&
    pairs.every(([b, c]) => b!.scale < c!.scale)
  );
}

/** The planet: a body circling the sun, 1.2 to 10 units from it. */
function planets(at: Placed[][], sunIndex: number): number[] {
  return (at[0] ?? []).filter((b) => b.index !== sunIndex && circles(at, b.index, sunIndex, 1.2, 10)).map((b) => b.index);
}

export function gettingStartedProject(): Record<string, Checks> {
  return {
    "getting-started-project": {
      // A dark sky: every channel of the clear colour low (the start's teal is 0.2, 0.3, 0.3).
      "night-sky": (c) => c.shows && c.scene!.clearColor !== null && c.scene!.clearColor.slice(0, 3).every((v, i) => v <= (i === 2 ? 0.2 : 0.12)),
      // The camera, from the view matrix: above the planets' plane, a good way back, and the sun (the origin) in front of
      // it and well inside the picture (the 45° view reaches 0.41 × the distance up and 0.55 × to the side).
      "observatory": (c) => {
        const draw = c.scene?.draws[0];
        const view = c.shows && draw !== undefined ? matrixOf(draw, 1.0, "view") : null;
        if (view === null) return false;
        const { position, origin } = cameraOf(view);
        const ahead = -origin[2];
        return position[1] >= 1 && Math.hypot(...position) >= 5 && ahead > 0 && Math.abs(origin[0]) < 0.45 * ahead && Math.abs(origin[1]) < 0.35 * ahead;
      },
      "sun": (c) => c.drew && sun(placed(c)) !== null,
      "planet": (c) => {
        const at = placed(c);
        const s = sun(at);
        return c.drew && s !== null && planets(at, s).length > 0;
      },
      // The moon circles a planet, 0.25 to 2.5 units from it; seen from the sun it comes nearer and goes further away.
      "moon": (c) => {
        const at = placed(c);
        const s = sun(at);
        if (!c.drew || s === null) return false;
        return planets(at, s).some((p) =>
          (at[0] ?? []).some((m) => {
            if (m.index === p || m.index === s || !circles(at, m.index, p, 0.25, 2.5)) return false;
            const fromSun = at.map((list) => distance(list.find((b) => b.index === m.index)!.position, list.find((b) => b.index === s)!.position));
            return spread(fromSun) > 0.1;
          }),
        );
      },
      // A colour per body: under one name, the sun and at least one other body hand their shaders colours that differ
      // by more than 0.25 in a channel, and the shaders use it (the name is there besides its declaration). Any colours:
      // a red planet is as good as a blue one.
      "colours": (c) => {
        const s = sun(placed(c));
        if (!c.drew || s === null) return false;
        for (const [name, colours] of vectorsByName(c.scene!.draws)) {
          const sunColour = colours[s];
          if (sunColour === null || sunColour === undefined || matchCount(c.shaders, `\\b${name}\\b`) < 2) continue;
          if (colours.some((o, i) => i !== s && o !== null && o.some((v, k) => Math.abs(v - sunColour[k]!) > 0.25))) return true;
        }
        return false;
      },
    },
  };
}
