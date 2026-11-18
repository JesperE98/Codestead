import { type Rgba } from "../CheckContext.js";
import { type ChapterChecks } from "./TaskChecks.PerApi.js";
import { at } from "./TaskChecks.AdvancedOpenGL.js";
import { black, duskSky } from "./TaskChecks.InPractice.js";
import { darkGround, glassBall, orangeBrick } from "./TaskChecks.InPractice2.js";

// In Practice, the game's third round: postprocessing (1.45 s, the frame after the ball hits the stone), power-ups
// (1.5 s and 3.0 s) and the game's text (3.0 s) – at the points of the 800×600 window each tasks.md names, the same in
// every API. Tasks that change nothing at those times are checked in the code (loose patterns, every API's spelling).

/** Plain white (text, the menu). */

export function textWhite(p: Rgba): boolean {
  return p[0] > 0.9 && p[1] > 0.9 && p[2] > 0.9;
}

/** The paddle in the confused (inverted) picture (23, 139, 255) – and the mirrored one at the top (41, 85, 183). */

export function invertedPaddle(p: Rgba): boolean {
  return p[2] > 0.65 && p[0] < 0.35 && p[2] > p[1] + 0.2;
}

/** The inverted sky (180, 199, 170): light, green over red and blue. */

export function invertedSky(p: Rgba): boolean {
  return p[0] > 0.6 && p[1] > 0.7 && p[2] > 0.55;
}

/** A power-up pill's coloured part, tinted by its colour (r, g, b) – 235 for 1.0, 118 for 0.5. */

export function pill(p: Rgba, r: number, g: number, b: number): boolean {
  return Math.abs(p[0] - r * 0.92) < 0.12 && Math.abs(p[1] - g * 0.92) < 0.12 && Math.abs(p[2] - b * 0.92) < 0.12;
}

export function inPractice3(): ChapterChecks {
  return [
    ["postprocessing", {
        // The post shader (the kernels over 9 samples, the shake's wobble) loaded as "postprocessing": not used yet.
        "post-shader": c => c.shows && c.hasInShaders("edge_kernel \\[ [A-Za-z_]\\w* \\]") && c.hasInShaders("blur_kernel \\[ [A-Za-z_]\\w* \\]")
            && c.hasInShaders("cos \\( (\\w+ \\. )?time \\* 10") && c.has("LoadShader \\([^;]*\"postprocessing\""),
        // The PostProcessor (a 4-sample target, a texture to resolve into, the quad) made in Init: the game still draws to the window.
        "post-processor": c => c.shows && c.has("struct PostProcessor \\{") && c.has("\\bInitPostProcessor \\( Effects ,")
            && c.has("glRenderbufferStorageMultisample \\(|VK_SAMPLE_COUNT_4_BIT|\\. Count = 4\\b|\\bSampleCount = 4\\b|Tex2D \\([^;]*, 4 , \\d+ ,"),
        // The game drawn into the multisampled target and shown through the quad: only the edges change (antialiased).
        "render-to-texture": c => c.shows && c.has("\\bBeginRender \\( Effects \\)") && c.has("\\bEndRender \\( Effects \\)") && c.has("\\bRender \\( Effects ,"),
        // Confuse: upside down, mirrored and inverted – the blue paddle at the top, a light sky.
        "confuse": c => c.drew && c.has("\\bConfuse = true") && at(c, 1.45, 358, 588, invertedPaddle) && at(c, 1.45, 442, 12, invertedPaddle) && at(c, 1.45, 200, 250, invertedSky),
        // Chaos: edge detection – black wherever the picture is flat.
        "chaos": c => c.drew && c.has("\\bChaos = true") && at(c, 1.45, 200, 250, black) && at(c, 1.45, 400, 300, black) && at(c, 1.45, 358, 588, black) && at(c, 1.45, 400, 450, black),
        // The shake when the ball hits the stone (frame 86): in frame 87 the picture is blurred and moved – the paddle's
        // brass end darker than its 214,170,72, the flat sky and bricks as normal (no chaos or confuse any more).
        "shake": c => c.drew && c.has("\\bShakeTime\\b") && c.has("\\bShake = true") && at(c, 1.45, 200, 250, duskSky) && at(c, 1.45, 396, 29, orangeBrick)
            && at(c, 1.45, 358, 588, p => p[0] > 0.3 && p[0] < 0.79 && p[2] < 0.35),
    }],
    ["powerups", {
        // PowerUp, MakePowerUp, the game's vector, the textures: the vector is empty, nothing visible.
        "powerup-object": c => c.shows && c.has("struct PowerUp : (public )?GameObject\\b") && c.has("\\bMakePowerUp \\(") && c.has("\\bPassThrough\\b")
            && c.has("std :: vector < PowerUp > \\w+") && c.has("\"textures/powerup_speed\\.png\""),
        // Six test power-ups in row 4: at 1.5 s still there (nothing moves them), the row they will fall to empty.
        "try-powerups": c => c.drew && c.has("PowerUps \\. (push_back|emplace_back) \\(") && at(c, 1.5, 55, 170, p => pill(p, 0.5, 0.5, 1.0)) && at(c, 1.5, 605, 170, p => pill(p, 0.9, 0.25, 0.25))
            && at(c, 1.5, 55, 395, p => p[2] < 0.5),
        // UpdatePowerUps: they fall – at 1.5 s all six at y = 385, row 4 empty again.
        "update-powerups": c => c.drew && c.has("\\bUpdatePowerUps \\( \\w+ ,") && at(c, 1.5, 55, 395, p => pill(p, 0.5, 0.5, 1.0)) && at(c, 1.5, 495, 395, p => pill(p, 1.0, 0.3, 0.3))
            && at(c, 1.5, 165, 395, p => pill(p, 1.0, 0.5, 1.0)) && at(c, 1.5, 55, 170, p => p[2] < 0.4),
        // Caught by the paddle (frame 161): pad-size-increase and confuse – at 3.0 s the confused picture with a 150 px paddle.
        "activate": c => c.drew && c.has("\\bActivatePowerUp \\(") && at(c, 3.0, 442, 12, invertedPaddle) && at(c, 3.0, 320, 10, invertedPaddle) && at(c, 3.0, 358, 588, invertedPaddle)
            && at(c, 3.0, 200, 250, invertedSky),
        // Spawning from broken bricks: no brick breaks with the course's input – checked in the code.
        "spawn-powerups": c => c.shows && c.has("\\bShouldSpawn \\(") && c.has("\\bSpawnPowerUps \\( \\w+ , \\w+ \\)") && c.has("rand \\( \\) %"),
        // Sticky paddle and pass-through: never reached with the course's input – checked in the code.
        "sticky-pass": c => c.shows && c.has("\\bPassThrough && ! \\w+ \\. IsSolid|! \\w+ \\. IsSolid && \\w+ \\. PassThrough") && c.has("\\bStuck = \\w+ \\. Sticky\\b"),
    }],
    ["render-text", {
        // The test power-ups gone: the normal game again at 3.0 s – not confused, the ball back on the paddle.
        "remove-test": c => c.drew && at(c, 3.0, 396, 29, orangeBrick) && at(c, 3.0, 200, 250, duskSky) && at(c, 3.0, 400, 567, glassBall) && at(c, 3.0, 480, 590, darkGround),
        // The TextRenderer and its shader, made in Init: nothing drawn with it.
        "text-renderer": c => c.shows && c.has("struct TextRenderer \\{") && c.has("\\bInitTextRenderer \\( Text\\b"),
        // The glyphs of Inter Bold at 24 pixels: nothing drawn with them.
        "load-font": c => c.shows && c.has("FT_Load_Char \\(") && c.has("\\bLoad \\( Text , \"fonts/Inter-Bold\\.otf\" , 24 \\)"),
        // Three lives, one lost in frame 151: nothing shows it yet.
        "lives": c => c.shows && c.has("\\bLives = 3\\b") && c.has("-- \\w+ \\. Lives\\b|\\. Lives (--|-= 1)"),
        // "Lives:2" in white at the top left.
        "render-text": c => c.drew && c.has("\"Lives:? ?\"") && at(c, 3.0, 8, 12, textWhite) && at(c, 3.0, 81, 17, textWhite) && at(c, 3.0, 87, 17, p => !textWhite(p)),
        // The menu over the level: the game never starts, "Lives:3", the menu's two lines.
        "menu": c => c.drew && c.has("\\bKeysProcessed\\b") && at(c, 3.0, 325, 302, textWhite) && at(c, 3.0, 312, 331, textWhite) && at(c, 3.0, 87, 17, textWhite) && at(c, 3.0, 400, 567, glassBall),
        // The win state: never reached with the course's input – checked in the code.
        "win": c => c.shows && c.has("\\bIsCompleted \\(") && c.has("State = GAME_WIN ;") && c.has("You WON"),
    }],
  ];
}
