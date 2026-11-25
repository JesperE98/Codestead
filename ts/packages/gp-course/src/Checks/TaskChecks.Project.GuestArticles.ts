import { type CheckContext, type Rgba } from "../CheckContext.js";
import { type Checks } from "./TaskChecks.PerApi.js";
import { at } from "./TaskChecks.AdvancedOpenGL.js";

// The milestones of the project after the Guest Articles: an orrery as a scene graph with frustum culling
// (projects/<api>/guest-articles-project/). The start is the frustum-culling chapter's solution, with its camera
// (3, 6, 12), pitch −25, fov 45°, 800 × 600. The checks work out where the orrery's bodies must be at a time – the sun
// (scale 1.5) at the origin, the planets Pip, Bramble and Old Gourd at 2.4, 4 and 6 sun units (3.6, 6 and 9 in the
// world), Bramble's moon 2.5 Bramble units from it (1.3125 in the world) – and look for them in the picture: "drawn"
// is "not the clear colour 13,13,13". The counts are read from the window title.

type Vec3 = [number, number, number];

const eye: Vec3 = [3, 6, 12];
const front: Vec3 = [0, -0.42262, -0.90631];

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function normalize(a: Vec3): Vec3 {
  const l = Math.sqrt(dot(a, a));
  return [a[0] / l, a[1] / l, a[2] / l];
}
const right = normalize(cross(front, [0, 1, 0]));
const up = cross(right, front);
const tanHalfFov = Math.tan((22.5 * Math.PI) / 180);

/** Where a world point appears in the 800 × 600 window (from the top left), through the course's camera. */
function screen(p: Vec3): [number, number] {
  const d: Vec3 = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
  const z = dot(d, front);
  return [((dot(d, right) / (z * tanHalfFov * (800 / 600)) + 1) / 2) * 800, ((1 - dot(d, up) / (z * tanHalfFov)) / 2) * 600];
}

/** The planets' distances from the sun in the world (2.4, 4 and 6 sun units × the sun's 1.5) and their speeds (°/s). */
const distances = [3.6, 6, 9];
const speeds = [80, 40, 20];

/** A planet's world position at a time on its orbit (counter-clockwise seen from above; −1: clockwise). */
function planetAt(i: number, t: number, direction = 1): Vec3 {
  const a = (speeds[i]! * t * Math.PI) / 180;
  return [distances[i]! * Math.cos(a), 0, -direction * distances[i]! * Math.sin(a)];
}

/** Bramble's moon at a time: 1.3125 from Bramble, turned with Bramble's own turning (120°/s; −1: clockwise). */
function moonAt(t: number, orbit: number, spin: number): Vec3 {
  const b = planetAt(1, t, orbit);
  const m = (120 * t * Math.PI) / 180;
  return [b[0] + 1.3125 * Math.cos(m), 0, b[2] - spin * 1.3125 * Math.sin(m)];
}

/** The clear colour (13, 13, 13): nothing drawn. */
function clear(p: Rgba): boolean {
  return Math.abs(p[0] - 0.051) < 0.02 && Math.abs(p[1] - 0.051) < 0.02 && Math.abs(p[2] - 0.051) < 0.02;
}

const drawn = (p: Rgba): boolean => !clear(p);

/** Something is drawn (or nothing, with test = clear) where a world point appears at a time. */
function atWorld(c: CheckContext, t: number, p: Vec3, test: (p: Rgba) => boolean): boolean {
  const [x, y] = screen(p);
  return at(c, t, x, y, test);
}

/** The planets on their orbits at a time, in one direction or the other. */
function orbiting(c: CheckContext, t: number, direction: number): boolean {
  return [0, 1, 2].every((i) => atWorld(c, t, planetAt(i, t, direction), drawn));
}

/** The window title at a time has these numbers (as whole numbers, in any wording). */
function titleHas(c: CheckContext, t: number, ...numbers: number[]): boolean {
  const title = c.windowTitleAt(t);
  return numbers.every((n) => new RegExp(`(^|[^\\d.])${n}($|[^\\d.])`).test(title));
}

export function guestArticlesProject(): Record<string, Checks> {
  return {
    "guest-articles-project": {
      // The grid is gone; the sun alone at the origin, 1.5 times the model's size (its sphere and ring reach where a
      // planet of scale 1 does not).
      "sun": (c) =>
        c.drew &&
        at(c, 2.0, 238, 320, drawn) &&
        at(c, 2.0, 232, 250, drawn) &&
        at(c, 2.0, 120, 390, drawn) &&
        at(c, 2.0, 680, 459, clear) &&
        at(c, 2.0, 396, 76, clear) &&
        at(c, 2.0, 429, 327, clear),
      // Three planets, children of the sun, lined up on its x axis (at 3.6, 6 and 9 in the world) – or already on their
      // orbits (the next milestone done at the same time); the sun still there.
      "planets": (c) =>
        c.drew &&
        at(c, 2.0, 232, 250, drawn) &&
        ([3.6, 6, 9].every((x) => atWorld(c, 2.0, [x, 0, 0], drawn)) || orbiting(c, 2.0, 1) || orbiting(c, 2.0, -1)),
      // Each on its own orbit at its own speed: at 2.0 s where the orbits have taken them, no longer on the x axis.
      "orbits": (c) =>
        c.drew &&
        (orbiting(c, 2.0, 1) || orbiting(c, 2.0, -1)) &&
        atWorld(c, 2.0, [6, 0, 0], clear) &&
        atWorld(c, 2.0, [9, 0, 0], clear),
      // Bramble's moon, a child of Bramble, carried round by Bramble's own turning.
      "moon": (c) =>
        c.drew &&
        [1, -1].some((orbit) => orbiting(c, 2.0, orbit) && [1, -1].some((spin) => atWorld(c, 2.0, moonAt(2.0, orbit, spin), drawn))),
      // The title counts the culled bodies besides the drawn ones (or all): at 2.0 s all five drawn, none culled; at
      // 5.0 s one is outside the view: four drawn, one culled. (The start's "drawn: 5 / 5" has no 0, nor 1 at 5.0 s.)
      "counter": (c) => c.drew && titleHas(c, 2.0, 5, 0) && titleHas(c, 5.0, 1) && (titleHas(c, 5.0, 4) || titleHas(c, 5.0, 5)),
    },
  };
}
