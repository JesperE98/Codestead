import { Apis } from "@codestead/gp-gpu";
import { given, type CheckContext, type Rgba } from "../CheckContext.js";
import { type Checks } from "./TaskChecks.PerApi.js";
import { at } from "./TaskChecks.AdvancedOpenGL.js";
import { ballGreen, black, duskSky, teal, textBlue, textGreen, wood } from "./TaskChecks.InPractice.js";
import { blueBrick, darkGround, glassBall, nightSky, orangeBrick, stone } from "./TaskChecks.InPractice2.js";
import { invertedPaddle, invertedSky, pill, textWhite } from "./TaskChecks.InPractice3.js";

// The exercises' checks of in-practice, by chapter ("ex-…" ids; projects/<api>/<chapter>/exercises.txt). An exercise
// without a check here is ticked by the learner. Points are of the 800×600 window (the same place in every API); the
// game's at the times its tasks.md names (frame t × 60 of the deterministic game, the space bar in frames 30–33).

/** The pixels of the check frame (160 × 120: every 5th window pixel) in a box of window pixels at a time that pass a test. */
export function ipExCountIn(c: CheckContext, t: number, x0: number, y0: number, x1: number, y1: number, test: (p: Rgba) => boolean): number {
  let n = 0;
  for (let y = y0; y <= y1; y += 5) for (let x = x0; x <= x1; x += 5) if (given(c.pixelAt(t, x / 800.0, y / 600.0), (p) => test(p))) n++;
  return n;
}

/** Some pixel in a box of window pixels passes a test. */

export function ipExAnyIn(c: CheckContext, t: number, x0: number, y0: number, x1: number, y1: number, test: (p: Rgba) => boolean): boolean {
  return ipExCountIn(c, t, x0, y0, x1, y1, test) > 0;
}

/** The share (0–1) of a box of window pixels that passes a test. */
export function ipExShareIn(c: CheckContext, t: number, x0: number, y0: number, x1: number, y1: number, test: (p: Rgba) => boolean): number {
  // int arithmetic: the divisions truncate.
  const all = (Math.trunc((y1 - y0) / 5) + 1) * (Math.trunc((x1 - x0) / 5) + 1);
  return ipExCountIn(c, t, x0, y0, x1, y1, test) / all;
}

/** A grey (red = green = blue) between two brightnesses. */

export function ipExGrey(p: Rgba, min: number, max: number): boolean {
  return Math.abs(p[0] - p[1]) < 0.03 && Math.abs(p[1] - p[2]) < 0.03 && p[0] >= min && p[0] <= max;
}

/** Pure red (1, 0, 0). */

export function ipExRed(p: Rgba): boolean {
  return p[0] > 0.9 && p[1] < 0.1 && p[2] < 0.1;
}

/** Orange (1, 0.5, 0). */

export function ipExOrange(p: Rgba): boolean {
  return p[0] > 0.9 && p[1] > 0.4 && p[1] < 0.6 && p[2] < 0.1;
}

/** A purple brick (0.6, 0.2, 0.8 × the brick texture). */

export function ipExPurple(p: Rgba): boolean {
  return p[0] > 0.35 && p[2] > 0.5 && p[1] < 0.25 && p[2] > p[0];
}

/** A green brick (0, 0.7, 0 × the brick texture). */

export function ipExGreenBrick(p: Rgba): boolean {
  return p[1] > 0.4 && p[0] < 0.1 && p[2] < 0.1;
}

/** The paddle's brass ends (214, 170, 72). */

export function ipExBrass(p: Rgba): boolean {
  return p[0] > 0.7 && p[1] > 0.55 && p[1] < 0.78 && p[2] < 0.4;
}

/** A brick tinted (1, 0.2, 0.2): red. */

export function ipExHitRed(p: Rgba): boolean {
  return p[0] > 0.6 && p[1] < 0.3 && p[2] < 0.3;
}

/** An orange brick darkened to about a third (81, 40, 0). */

export function ipExDimOrange(p: Rgba): boolean {
  return p[0] > 0.18 && p[0] < 0.45 && p[1] < p[0] * 0.65 && p[1] > p[0] * 0.3 && p[2] < 0.05;
}

/** Gold text (1.0, 0.8, 0.2). */

export function ipExGold(p: Rgba): boolean {
  return p[0] > 0.9 && p[1] > 0.7 && p[1] < 0.9 && p[2] < 0.35;
}

export function exercisesInPractice(): Record<string, Checks> {
  return {
    "debugging": {
        // v alone as grey: bright at the face's top and dark at its bottom (Direct3D's v runs downwards: the other way round).
        "ex-v-grey": c => c.drew && at(c, 100, 100, teal) && at(c, 400, 300, p => ipExGrey(p, 0.35, 0.7))
            && at(c, 400, 150, p => c.api === Apis.D3D12 ? ipExGrey(p, 0, 0.15) : ipExGrey(p, 0.85, 1))
            && at(c, 560, 450, p => c.api === Apis.D3D12 ? ipExGrey(p, 0.85, 1) : ipExGrey(p, 0, 0.15)),
        // The coordinates × 3, fract: across the middle the red rises to full and starts again at 0 – twice.
        "ex-tiles": c => c.drew && at(c, 100, 100, teal) && at(c, 340, 300, p => p[0] > 0.8 && p[2] < 0.05) && at(c, 360, 300, p => p[0] < 0.15 && p[1] > 0.25 && p[2] < 0.05)
            && at(c, 460, 300, p => p[0] > 0.8 && p[2] < 0.05) && at(c, 480, 300, p => p[0] < 0.15 && p[1] > 0.25 && p[2] < 0.05),
        // The wood again, but red where u > 0.5: the face's right half red, its left half wood.
        "ex-highlight": c => c.drew && at(c, 100, 100, teal) && at(c, 560, 450, ipExRed) && at(c, 500, 400, ipExRed) && at(c, 300, 300, wood) && at(c, 280, 200, wood),
    },
    "text-rendering": {
        // Line 1 in orange, line 2 still light blue.
        "ex-colour": c => c.drew && at(c, 40, 541, ipExOrange) && at(c, 92, 561, ipExOrange) && at(c, 706, 16, textBlue) && at(c, 400, 300, teal),
        // Line 1 at 1.5 × the size: it reaches far further to the right (the normal line ends at x ≈ 470).
        "ex-bigger": c => c.drew && ipExAnyIn(c, 1.0, 560, 500, 720, 595, textGreen) && at(c, 706, 16, textBlue) && at(c, 400, 300, teal),
        // The glyphs' whole quads: about twice as much green in line 1's box as the letters alone.
        "ex-quads": c => c.drew && ipExShareIn(c, 1.0, 20, 520, 470, 580, textGreen) > 0.28 && at(c, 706, 16, textBlue),
        // A black copy behind line 1, a little to the lower right: black pixels next to the green letters.
        "ex-shadow": c => c.drew && c.anyDrawnPixel(black) && at(c, 40, 541, textGreen) && at(c, 92, 561, textGreen) && at(c, 706, 16, textBlue),
    },
    "rendering-sprites": {
        // White instead of green: the ball's own pale glass colours.
        "ex-own-colours": c => c.drew && at(c, 350, 400, glassBall) && at(c, 400, 300, glassBall) && at(c, 100, 100, black),
        // 200 × 200 in the middle of the window: a round ball around (400, 300), nothing where the ellipse was.
        "ex-round": c => c.drew && at(c, 400, 300, ballGreen) && at(c, 330, 300, ballGreen) && at(c, 400, 215, ballGreen) && at(c, 400, 190, black)
            && at(c, 350, 400, black) && at(c, 200, 400, black),
        // A second, small red ball in the top right corner; the green one still there.
        "ex-second": c => c.drew && at(c, 700, 100, p => p[0] > 0.6 && p[1] < 0.1 && p[2] < 0.1) && at(c, 350, 400, ballGreen) && at(c, 100, 100, black),
        // 90° per second: lying down at 1 s (90°), upright again at 2 s (180°).
        "ex-spin": c => c.drew && at(c, 1.0, 180, 400, ballGreen) && at(c, 1.0, 520, 400, ballGreen) && at(c, 1.0, 350, 215, black)
            && at(c, 2.0, 350, 225, ballGreen) && at(c, 2.0, 350, 575, ballGreen) && at(c, 2.0, 180, 400, black),
    },
    "levels": {
        // Level two: stone pillars at the sides, its blue top row, the hollow middle.
        "ex-start-level": c => c.drew && at(c, 13, 29, stone) && at(c, 396, 29, blueBrick) && at(c, 396, 104, nightSky),
        // The blue bricks purple; the other rows unchanged.
        "ex-brick-colour": c => c.drew && at(c, 396, 141, ipExPurple) && at(c, 13, 141, ipExPurple) && at(c, 396, 29, orangeBrick) && at(c, 396, 104, ipExGreenBrick),
        // The top row of level one solid stones; the rows below unchanged.
        "ex-stone-row": c => c.drew && at(c, 396, 29, stone) && at(c, 13, 29, stone) && at(c, 396, 104, ipExGreenBrick) && at(c, 396, 141, blueBrick),
        // A 150-pixel paddle, still centred: its brass ends at x ≈ 333 and 467 (the 100-pixel one ends at 350 and 450).
        "ex-wide-paddle": c => c.drew && at(c, 333, 588, ipExBrass) && at(c, 470, 588, p => !darkGround(p)) && at(c, 396, 29, orangeBrick),
        // Level one in the top 200 pixels: rows of 25 pixels – the second row (yellow) at y = 29, the blue row at 90,
        // the stones at 140, the sky below 150.
        "ex-flatter": c => c.drew && at(c, 396, 29, p => p[0] > 0.55 && Math.abs(p[0] - p[1]) < 0.05 && p[2] < 0.45) && at(c, 396, 90, blueBrick)
            && at(c, 13, 140, stone) && at(c, 396, 104, p => p[2] > p[0] + 0.05 && p[0] < 0.2) && at(c, 13, 209, p => !stone(p)),
    },
    "ball": {
        // Twice the speed: at 1.0 s (30 frames after the launch) the ball is at (500, 205) instead of (450, 385).
        "ex-faster": c => c.drew && at(c, 1.0, 500, 205, glassBall) && at(c, 1.0, 450, 385, p => !glassBall(p)),
        // Radius 25, still sitting on the paddle (reaching up to y = 530) and launched from there.
        "ex-big-ball": c => c.drew && at(c, 0.4, 400, 537, glassBall) && at(c, 0.4, 400, 550, glassBall) && at(c, 1.0, 450, 360, glassBall) && at(c, 1.0, 450, 370, glassBall),
        // Launched to the upper left: at 1.0 s at (350, 385), the mirror image of the usual (450, 385).
        "ex-launch-left": c => c.drew && at(c, 1.0, 348, 385, glassBall) && at(c, 1.0, 450, 385, p => !glassBall(p)),
        // The bottom edge bounces too: at 4.5 s the ball is on its way up again at the right edge, not gone.
        "ex-bottom-bounce": c => c.drew && at(c, 4.5, 772, 317, glassBall),
    },
    "collision-detection": {
        // The bricks the ball touches turn red instead of disappearing: at 3.0 s the channel is red, the stone grey.
        "ex-mark-hits": c => c.drew && at(c, 3.0, 506, 141, ipExHitRed) && at(c, 3.0, 560, 18, ipExHitRed) && at(c, 3.0, 506, 206, stone),
        // Solid stones break too: at 3.0 s the stone (5, 9) the ball flew through is gone as well.
        "ex-break-stones": c => c.drew && at(c, 3.0, 506, 206, duskSky) && at(c, 3.0, 506, 141, nightSky) && at(c, 3.0, 13, 209, stone),
        // The ball stops at its first collision – the underside of the stone (5, 9) – and no brick is destroyed.
        "ex-freeze": c => c.drew && at(c, 3.0, 493, 235, glassBall) && at(c, 3.0, 506, 141, blueBrick) && at(c, 3.0, 560, 18, orangeBrick),
    },
    "collision-resolution": {
        // A 500-pixel paddle catches the ball coming down from the stone: at 3.0 s it flies up again at (678, 361)
        // instead of lying on the paddle after a reset.
        "ex-catch": c => c.drew && at(c, 3.0, 678, 361, glassBall) && at(c, 3.0, 400, 567, p => !glassBall(p)),
        // Losing the ball (frame 151) moves on to level two: at 3.0 s its stone pillars and blue top row.
        "ex-next-level": c => c.drew && at(c, 3.0, 13, 29, stone) && at(c, 3.0, 396, 29, blueBrick) && at(c, 3.0, 400, 567, glassBall),
        // The stones let the ball through: at 2.0 s it has broken the blue brick above the stone and is on its way down.
        "ex-ghost-stones": c => c.drew && at(c, 2.0, 506, 141, nightSky) && at(c, 2.0, 549, 282, glassBall) && at(c, 2.0, 506, 206, stone),
    },
    "particles": {
        // Orange embers: the trail behind the ball at 2.0 s red over green over blue instead of white.
        "ex-embers": c => c.drew && at(c, 2.0, 542, 410, p => p[0] > 0.9 && p[1] > 0.5 && p[1] < 0.85 && p[2] < 0.55) && at(c, 2.0, 530, 366, p => p[0] > p[1] + 0.15 && p[1] > p[2])
            && at(c, 2.0, 551, 435, glassBall),
        // 20-pixel particles: a broad bright trail – many more nearly white pixels around it.
        "ex-big-particles": c => c.drew && ipExCountIn(c, 2.0, 500, 300, 580, 425, p => p[0] > 0.85 && p[1] > 0.8 && p[2] > 0.85) >= 9 && at(c, 2.0, 551, 435, glassBall),
        // A slower fade: at 2.0 s the trail still reaches back up to the stone the ball bounced off (frame 86).
        "ex-long-trail": c => c.drew && ipExAnyIn(c, 2.0, 480, 230, 515, 265, p => p[0] > 0.5 && p[2] > 0.55) && at(c, 2.0, 522, 332, p => p[0] > 0.85 && p[2] > 0.85),
        // Normal blending instead of additive: the trail no longer glows white next to the ball.
        "ex-no-glow": c => c.drew && at(c, 2.0, 542, 410, p => p[0] > 0.45 && p[0] < 0.8 && p[2] > 0.45 && p[2] < 0.8) && at(c, 2.0, 530, 366, p => p[0] > 0.4 && p[0] < 0.7)
            && at(c, 2.0, 551, 435, glassBall),
    },
    "postprocessing": {
        // The normal picture in grey (luminance): bricks, sky and paddle red = green = blue at 1.0 s.
        "ex-greyscale": c => c.drew && at(c, 1.0, 396, 29, p => ipExGrey(p, 0.33, 0.57)) && at(c, 1.0, 13, 29, p => ipExGrey(p, 0.42, 0.67))
            && at(c, 1.0, 358, 588, p => ipExGrey(p, 0.55, 0.8)) && at(c, 1.0, 200, 250, p => ipExGrey(p, 0.1, 0.3)),
        // A shake of half a second from frame 86: still blurred and moving at 1.8 s (frame 108); before the hit as normal.
        "ex-long-shake": c => c.drew && at(c, 1.8, 358, 588, p => p[0] > 0.3 && p[0] < 0.79 && p[2] < 0.35) && at(c, 1.8, 200, 250, duskSky)
            && at(c, 1.0, 358, 588, ipExBrass),
        // Confuse turned on without the inversion: upside down and mirrored – the paddle in its own colours at the top,
        // the bricks at the bottom, the sky not inverted.
        "ex-flip-only": c => c.drew && at(c, 1.0, 442, 12, ipExBrass) && at(c, 1.0, 358, 588, orangeBrick)
            && at(c, 1.0, 200, 250, p => p[2] > p[0] && p[0] > p[1] && p[0] < 0.35),
        // Darker towards the corners: the corner bricks dim orange, the middle of the window as before.
        "ex-vignette": c => c.drew && at(c, 1.0, 13, 29, ipExDimOrange) && at(c, 1.0, 787, 29, ipExDimOrange) && at(c, 1.0, 400, 300, duskSky),
    },
    "powerups": {
        // Half the falling speed: at 1.5 s the test power-ups are at y ≈ 272 (not yet at 385), and at 3.0 s none has
        // reached the paddle – the normal picture.
        "ex-slow-fall": c => c.drew && at(c, 1.5, 55, 280, p => pill(p, 0.5, 0.5, 1.0)) && at(c, 1.5, 55, 395, p => p[2] < 0.5)
            && at(c, 3.0, 200, 250, duskSky) && at(c, 3.0, 358, 588, ipExBrass),
        // pad-size-increase adds 100: the confused picture at 3.0 s with a 200-pixel paddle (mirrored at the top, reaching x = 270).
        "ex-big-boost": c => c.drew && at(c, 3.0, 270, 10, invertedPaddle) && at(c, 3.0, 442, 12, invertedPaddle) && at(c, 3.0, 200, 250, invertedSky),
        // Confuse for one second (caught in frame 161): still confused at 3.0 s, the normal picture again at 4.0 s.
        "ex-short-confuse": c => c.drew && at(c, 3.0, 200, 250, invertedSky) && at(c, 4.0, 200, 250, duskSky) && at(c, 4.0, 358, 588, ipExBrass),
        // Without the confuse test power-up: the normal picture at 3.0 s with the 150-pixel paddle (brass ends at 358 and 492).
        "ex-no-confuse": c => c.drew && at(c, 3.0, 200, 250, duskSky) && at(c, 3.0, 358, 588, ipExBrass) && at(c, 3.0, 492, 588, ipExBrass),
    },
    "render-text": {
        // "Lives:3" in gold (1.0, 0.8, 0.2); the menu still white.
        "ex-lives-colour": c => c.drew && at(c, 3.0, 8, 12, ipExGold) && at(c, 3.0, 87, 17, ipExGold) && at(c, 3.0, 325, 302, textWhite),
        // "Lives:5": the 5's upright stroke at the upper left of the digit, where the 3 is open.
        "ex-five-lives": c => c.drew && at(c, 3.0, 8, 12, textWhite) && at(c, 3.0, 76, 11, textWhite) && at(c, 3.0, 86, 16, textWhite),
        // No menu: the game runs from the start – at 3.0 s "Lives:2" (the ball was lost in frame 151), no menu text.
        "ex-skip-menu": c => c.drew && at(c, 3.0, 81, 17, textWhite) && at(c, 3.0, 87, 17, p => !textWhite(p)) && at(c, 3.0, 325, 302, p => !textWhite(p))
            && at(c, 3.0, 312, 331, p => !textWhite(p)),
        // "HEDGEROW" at twice the size above the menu's two lines.
        "ex-title": c => c.drew && ipExCountIn(c, 3.0, 290, 215, 590, 265, textWhite) >= 10 && at(c, 3.0, 325, 302, textWhite) && at(c, 3.0, 312, 331, textWhite),
    },
  };
}
