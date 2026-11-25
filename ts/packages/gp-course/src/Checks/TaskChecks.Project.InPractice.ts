import { type CheckContext, type Rgba } from "../CheckContext.js";
import { type Checks } from "./TaskChecks.PerApi.js";
import { at } from "./TaskChecks.AdvancedOpenGL.js";
import { ipExBrass, ipExCountIn } from "./TaskChecks.ExercisesInPractice.js";
import { blueBrick, orangeBrick, stone } from "./TaskChecks.InPractice2.js";
import { textWhite } from "./TaskChecks.InPractice3.js";

// The milestones of the project after In Practice: Hedgerow's fair edition (projects/<api>/in-practice-project/). The
// game is the finished Hedgerow of render-text; with the course's fixed input it stays in the menu, so the checks look
// at the menu's picture at 3.0 s (frame 180) – and at 1.0 s for the fade – at points of the 800×600 window, the same in
// every API. The learner's own level is read from their levels/five.lvl and compared with the picture tile by tile.

/** A green brick (0, 0.7, 0 × the brick texture). */
function greenBrick(p: Rgba): boolean {
  return p[1] > 0.4 && p[0] < 0.12 && p[2] < 0.12;
}

/** A yellow brick (0.8, 0.8, 0.4 × the brick texture): red = green, blue about half of it. */
function yellowBrick(p: Rgba): boolean {
  return Math.abs(p[0] - p[1]) < 0.05 && p[0] > 0.45 && p[0] < 0.85 && p[2] < p[0] * 0.7 && p[2] > p[0] * 0.3;
}

/** The colour test of a level's tile code (1 a solid stone, 2–5 the coloured bricks; 0 none of them: the sky shows). */
function tileTest(code: number): (p: Rgba) => boolean {
  switch (code) {
    case 1:
      return stone;
    case 2:
      return blueBrick;
    case 3:
      return greenBrick;
    case 4:
      return yellowBrick;
    case 5:
      return orangeBrick;
    default:
      return (p) => !stone(p) && !blueBrick(p) && !greenBrick(p) && !yellowBrick(p) && !orangeBrick(p);
  }
}

/** A level file's tile codes, row by row (LoadLevel's reading: numbers separated by spaces, a row per line). */
function tiles(text: string): number[][] {
  return text
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/).map(Number));
}

/** The text of a level file, numbers only ("" when missing). */
function levelText(c: CheckContext, file: string): string {
  const path = c.project.pathOf(file);
  return path === null ? "" : tiles(c.project.files.get(path)!).map((r) => r.join(" ")).join("\n");
}

/**
 * The learner's level (levels/five.lvl) is a level of its own – some bricks, at least one that can break, not a copy of
 * one of the course's four – and the picture at 3.0 s shows it: at the centre of every tile (the level fills the top
 * half, 800 × 300) the brick of its code, or no brick for a 0. Text over a few tiles (the lives, a score) is allowed for.
 */
function showsOwnLevel(c: CheckContext): boolean {
  const own = levelText(c, "levels/five.lvl");
  const level = tiles(own);
  const codes = level.flat();
  if (codes.some((n) => !Number.isInteger(n) || n < 0) || codes.filter((n) => n > 0).length < 8 || !codes.some((n) => n > 1)) return false;
  if (["one", "two", "three", "four"].some((name) => levelText(c, `levels/${name}.lvl`) === own)) return false;
  const rows = level.length;
  let all = 0;
  let wrong = 0;
  level.forEach((row, y) =>
    row.forEach((code, x) => {
      all++;
      if (!at(c, 3.0, (800 / row.length) * (x + 0.5), (300 / rows) * (y + 0.5), tileTest(code))) wrong++;
    }),
  );
  return wrong <= Math.max(2, all / 10);
}

/** A spark of colour: bright and clearly not grey (the course's sparks are grey-white). */
function colourfulSpark(p: Rgba): boolean {
  const max = Math.max(p[0], p[1], p[2]);
  return max > 0.5 && max - Math.min(p[0], p[1], p[2]) > 0.3;
}

/** The brightness of a pixel at a time (the sum of its channels; 0 when nothing is shown). */
function brightness(c: CheckContext, t: number, x: number, y: number): number {
  const p = c.pixelAt(t, x / 800, y / 600);
  return p === null ? 0 : p[0] + p[1] + p[2];
}

export function inPracticeProject(): Record<string, Checks> {
  return {
    "in-practice-project": {
      // The game starts on the learner's own fifth level: the picture shows levels/five.lvl.
      "own-level": (c) => c.drew && showsOwnLevel(c),
      // The menu cycles through five levels (W: % 5 or the number of levels; S: from 0 back to the last) and ResetLevel
      // reloads the fifth too – not visible with the course's input: checked in the code.
      "level-menu": (c) =>
        c.shows &&
        c.has("% (5\\b|\\(? ?(static_cast < \\w+( \\w+)? > \\( )?[\\w.]*Levels \\. size \\( \\))") &&
        c.count("\"levels/five\\.lvl\"") >= 2 &&
        c.count("\\bLevel = (4|(static_cast < \\w+( \\w+)? > \\( )?[\\w.]*Levels \\. size \\( \\)\\)? - 1) ;") >= 2,
      // A score: white text at the top (right of the lives) and points for a destroyed brick.
      "score": (c) =>
        c.drew &&
        c.has("\\bScore (\\+= \\w+|\\+\\+|= [\\w.]*Score \\+)|\\+\\+ [\\w.]*Score\\b") &&
        ipExCountIn(c, 3.0, 120, 0, 795, 35, textWhite) >= 4,
      // Sparks in a colour of their own, rising from a sparkler in the lower half (away from the ball on the paddle).
      "sparks": (c) =>
        c.drew &&
        ipExCountIn(c, 3.0, 0, 340, 315, 595, colourfulSpark) + ipExCountIn(c, 3.0, 485, 340, 795, 595, colourfulSpark) + ipExCountIn(c, 3.0, 320, 340, 480, 525, colourfulSpark) >= 2,
      // A power-up that gives a life, spawned from bricks like the others; the welcome gift caught by 3.0 s: "Lives:4".
      "extra-life": (c) =>
        c.drew &&
        c.count("\\bMakePowerUp \\(") >= 8 &&
        c.has("\\bLives (\\+\\+|\\+= 1\\b|= [\\w.]*Lives \\+ 1\\b)|\\+\\+ [\\w.]*Lives\\b") &&
        at(c, 3.0, 80, 17, textWhite) &&
        at(c, 3.0, 8, 12, textWhite),
      // A fade from black: at 1.0 s the picture (not the text) clearly darker than at 3.0 s, at 3.0 s as before.
      "fade-in": (c) =>
        c.drew &&
        at(c, 3.0, 358, 588, ipExBrass) &&
        brightness(c, 1.0, 358, 588) < 0.75 * brightness(c, 3.0, 358, 588) &&
        brightness(c, 1.0, 200, 450) < 0.75 * brightness(c, 3.0, 200, 450) &&
        at(c, 1.0, 8, 12, textWhite),
    },
  };
}
