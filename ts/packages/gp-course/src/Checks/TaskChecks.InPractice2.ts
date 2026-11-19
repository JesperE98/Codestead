import { Apis } from "@codestead/gp-gpu";
import { type Rgba } from "../CheckContext.js";
import { type ChapterChecks } from "./TaskChecks.PerApi.js";
import { at } from "./TaskChecks.AdvancedOpenGL.js";

// In Practice, the game's second round: the ball, collision detection and resolution, particles – at the screenshot
// time each tasks.md names (frame t × 60 of the deterministic game) and its points of the 800×600 window, the same in
// every API. Tasks that change nothing at those times are checked in the code (loose patterns, every API's spelling).
// At(c, t, x, y, test) – the pixel at window coordinates of the frame at time t – is an overload of at in
// TaskChecks.AdvancedOpenGL.

/** The pale green glass ball (192, 230, 180). */

export function glassBall(p: Rgba): boolean {
  return p[1] > 0.8 && p[0] > 0.6 && p[2] > 0.55 && p[1] > p[0];
}

/** The paddle's surroundings at the bottom of the garden (30, 40, 46): dark, nothing drawn there. */

export function darkGround(p: Rgba): boolean {
  return p[0] < 0.2 && p[1] < 0.25 && p[2] < 0.25;
}

/** The night sky behind a destroyed brick of the top rows (24, 30, 64): dark blue. */

export function nightSky(p: Rgba): boolean {
  return p[0] < 0.2 && p[2] > p[0] + 0.08 && p[2] < 0.35;
}

/** The background's moon (255, 255, 233). */

export function moon(p: Rgba): boolean {
  return p[0] > 0.9 && p[1] > 0.9 && p[2] > 0.8;
}

/** A solid stone (132, 132, 116): grey, a little less blue. */

export function stone(p: Rgba): boolean {
  return p[0] > 0.4 && p[0] < 0.62 && Math.abs(p[0] - p[1]) < 0.04 && p[2] < p[0];
}

/** An orange brick (158–209, 79–105, 0). */

export function orangeBrick(p: Rgba): boolean {
  return p[0] > 0.55 && p[1] > 0.25 && p[1] < 0.5 && p[2] < 0.1;
}

/** A blue brick (40, 121, 201). */

export function blueBrick(p: Rgba): boolean {
  return p[2] > 0.7 && p[1] > 0.35 && p[0] < 0.25;
}

export function inPractice2(): ChapterChecks {
  return [
    ["ball", {
        // BallObject (a GameObject with Radius and Stuck) and its constructor: nothing uses them yet.
        "ball-object": c => c.shows && c.has("struct BallObject : (public )?GameObject\\b") && c.has("\\bbool Stuck\\b") && c.has("\\bRadius\\b")
            && c.has("\\bBallObject MakeBallObject \\("),
        // Move (bouncing off the left, right and top edges) and Reset: not called yet.
        "move-reset": c => c.shows && c.has("\\bvoid Move \\( BallObject &") && c.has("\\bvoid Reset \\( BallObject &") && c.has("Velocity \\. [xy] = - \\w+ \\. Velocity \\. [xy]"),
        // The ball drawn on the paddle (at 1.0 s still stuck: nothing moves it).
        "draw-ball": c => c.drew && c.has("\\bDrawObject \\( Ball ,") && at(c, 1.0, 400, 567, glassBall) && at(c, 1.0, 400, 557, glassBall) && at(c, 1.0, 358, 588, p => p[0] > 0.7),
        // Move called every frame: no visible change, the ball is still stuck on the paddle.
        "update": c => c.shows && c.has("\\bMove \\( Ball ,") && at(c, 1.0, 400, 567, glassBall),
        // SPACE releases it (frame 30): at 1.0 s it flies up to the right, the paddle empty again.
        "launch": c => c.drew && c.has("Stuck = false") && at(c, 1.0, 451, 386, glassBall) && at(c, 1.0, 400, 567, darkGround) && at(c, 1.0, 396, 141, blueBrick),
    }],
    ["collision-detection", {
        // AABB – AABB: not called yet.
        "aabb": c => c.shows && c.has("\\bbool CheckCollision \\( (const )?GameObject & \\w+ , (const )?GameObject & \\w+ \\)"),
        // DoCollisions after Move: at 3.0 s a channel of 10 bricks is gone (the moon shows through it); the bricks
        // the ball never touched and the solid stone are there.
        "do-collisions": c => c.drew && c.has("\\bDoCollisions \\( game \\)") && at(c, 3.0, 560, 18, nightSky) && at(c, 3.0, 506, 141, nightSky)
            && at(c, 3.0, 615, 110, moon) && at(c, 3.0, 506, 29, orangeBrick) && at(c, 3.0, 506, 206, stone) && at(c, 3.0, 651, 333, glassBall),
        // AABB – circle, the overload the ball picks: the same 10 bricks at 3.0 s (the difference shows only at 1.75 s).
        "circle": c => c.shows && c.has("\\bCheckCollision \\( (const )?BallObject & \\w+ , (const )?GameObject & \\w+ \\)"),
    }],
    ["collision-resolution", {
        // enum Direction and VectorDirection: not used yet.
        "direction": c => c.shows && c.has("enum (class )?Direction \\{ UP , RIGHT , DOWN , LEFT ,? \\}") && c.has("\\bDirection VectorDirection \\("),
        // The circle test returns a Collision tuple, DoCollisions reads its first element: the same detection.
        "collision-tuple": c => c.shows && c.has("std :: tuple < bool , Direction ,") && c.has("make_tuple \\(|Collision \\{|Collision \\(")
            && c.has("std :: get < 0 >|auto & ?\\[|auto \\["),
        // The resolution: the ball bounces off the stone (5, 9) in frame 86 – at 2.0 s it comes down, no brick destroyed.
        "resolve": c => c.drew && c.has("std :: get < [12] >|auto & ?\\[|auto \\[") && at(c, 2.0, 551, 435, glassBall) && at(c, 2.0, 560, 18, orangeBrick)
            && at(c, 2.0, 506, 141, blueBrick) && at(c, 2.0, 506, 206, stone),
        // The paddle bounce: never reached with the course's input – checked in the code.
        "paddle": c => c.shows && c.has("\\bCheckCollision \\( Ball , Player \\)") && c.has("INITIAL_BALL_VELOCITY \\. x \\*") && c.has("\\bBall \\. Velocity \\. y = [^;]*abs \\("),
        // Losing the ball resets the level and the player: at 3.0 s the ball is stuck on the paddle again, all bricks there.
        "lose-ball": c => c.drew && c.has("\\bResetLevel \\(") && c.has("\\bResetPlayer \\(") && at(c, 3.0, 400, 567, glassBall) && at(c, 3.0, 506, 141, blueBrick)
            && at(c, 3.0, 651, 333, p => !glassBall(p)),
    }],
    ["particles", {
        // The particle shader (a 10-pixel quad at offset, texture × colour) and its texture loaded: nothing drawn with them.
        "particle-shader": c => c.shows && c.hasInShaders("\\* scale \\) \\+ (\\w+ \\. )?offset\\b") && c.has("LoadShader \\([^;]*\"particle\"") && c.has("\"textures/particle\\.png\"")
            && (c.api !== Apis.OpenGL || c.has("\\bvoid SetVector4f \\(")),
        // The generator with 500 dead particles: nothing visible.
        "particle-generator": c => c.shows && c.has("struct Particle \\{") && c.has("struct ParticleGenerator \\{") && c.has("\\bInitParticles \\( Particles \\)") && c.has("\\bamount = 500\\b"),
        // Spawning, ageing and fading: the particles live but are not drawn yet.
        "spawn": c => c.shows && c.has("\\bfirstUnusedParticle \\(") && c.has("\\brespawnParticle \\(") && c.has("\\brand \\( \\)") && c.has("\\bUpdate \\( Particles ,"),
        // The glowing trail behind the ball at 2.0 s: white near the ball, fainter further back, the sky beside it.
        "draw-particles": c => c.drew && c.has("\\bDrawParticles \\( Particles \\)") && at(c, 2.0, 542, 410, p => p[0] > 0.95 && p[1] > 0.95 && p[2] > 0.95)
            && at(c, 2.0, 530, 366, p => p[0] > 0.6 && p[2] > 0.65) && at(c, 2.0, 522, 332, p => p[0] > 0.55 && p[2] > 0.6) && at(c, 2.0, 560, 366, p => p[0] < 0.4)
            && at(c, 2.0, 551, 435, glassBall),
    }],
  ];
}
