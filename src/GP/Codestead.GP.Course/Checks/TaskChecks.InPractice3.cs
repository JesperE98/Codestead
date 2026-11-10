namespace Codestead.GP.Course.Checks;

// In Practice, the game's third round: postprocessing (1.45 s, the frame after the ball hits the stone), power-ups
// (1.5 s and 3.0 s) and the game's text (3.0 s) – at the points of the 800×600 window each tasks.md names, the same in
// every API. Tasks that change nothing at those times are checked in the code (loose patterns, every API's spelling).
public static partial class TaskChecks
{
    /// <summary>Plain white (text, the menu).</summary>
    private static bool TextWhite(double[] p) => p[0] > 0.9 && p[1] > 0.9 && p[2] > 0.9;

    /// <summary>The paddle in the confused (inverted) picture (23, 139, 255) – and the mirrored one at the top (41, 85, 183).</summary>
    private static bool InvertedPaddle(double[] p) => p[2] > 0.65 && p[0] < 0.25 && p[2] > p[1] + 0.2;

    /// <summary>The inverted sky (180, 199, 170): light, green over red and blue.</summary>
    private static bool InvertedSky(double[] p) => p[0] > 0.6 && p[1] > 0.7 && p[2] > 0.55;

    /// <summary>A power-up pill's coloured part, tinted by its colour (r, g, b) – 235 for 1.0, 118 for 0.5.</summary>
    private static bool Pill(double[] p, double r, double g, double b) => Math.Abs(p[0] - r * 0.92) < 0.12 && Math.Abs(p[1] - g * 0.92) < 0.12 && Math.Abs(p[2] - b * 0.92) < 0.12;

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> InPractice3 =>
    [
        ("postprocessing", new()
        {
            // The post shader (the kernels over 9 samples, the shake's wobble) loaded as "postprocessing": not used yet.
            ["post-shader"] = c => c.Shows && c.HasInShaders(@"edge_kernel \[ [A-Za-z_]\w* \]") && c.HasInShaders(@"blur_kernel \[ [A-Za-z_]\w* \]")
                && c.HasInShaders(@"cos \( (\w+ \. )?time \* 10") && c.Has(@"LoadShader \([^;]*""postprocessing"""),
            // The PostProcessor (a 4-sample target, a texture to resolve into, the quad) made in Init: the game still draws to the window.
            ["post-processor"] = c => c.Shows && c.Has(@"struct PostProcessor \{") && c.Has(@"\bInitPostProcessor \( Effects ,")
                && c.Has(@"glRenderbufferStorageMultisample \(|VK_SAMPLE_COUNT_4_BIT|SampleDesc \. Count = 4|\. Count = 4\b"),
            // The game drawn into the multisampled target and shown through the quad: only the edges change (antialiased).
            ["render-to-texture"] = c => c.Shows && c.Has(@"\bBeginRender \( Effects \)") && c.Has(@"\bEndRender \( Effects \)") && c.Has(@"\bRender \( Effects ,"),
            // Confuse: upside down, mirrored and inverted – the blue paddle at the top, a light sky.
            ["confuse"] = c => c.Drew && c.Has(@"\bConfuse = true") && At(c, 1.45, 358, 588, InvertedPaddle) && At(c, 1.45, 442, 12, InvertedPaddle) && At(c, 1.45, 200, 250, InvertedSky),
            // Chaos: edge detection – black wherever the picture is flat.
            ["chaos"] = c => c.Drew && c.Has(@"\bChaos = true") && At(c, 1.45, 200, 250, Black) && At(c, 1.45, 400, 300, Black) && At(c, 1.45, 358, 588, Black) && At(c, 1.45, 400, 450, Black),
            // The shake when the ball hits the stone (frame 86): in frame 87 the picture is blurred and moved – the paddle's
            // brass end darker than its 214,170,72, the flat sky and bricks as normal (no chaos or confuse any more).
            ["shake"] = c => c.Drew && c.Has(@"\bShakeTime\b") && c.Has(@"\bShake = true") && At(c, 1.45, 200, 250, DuskSky) && At(c, 1.45, 396, 29, OrangeBrick)
                && At(c, 1.45, 358, 588, p => p[0] > 0.55 && p[0] < 0.79 && p[2] < 0.35),
        }),
        ("powerups", new()
        {
            // PowerUp, MakePowerUp, the game's vector, the textures: the vector is empty, nothing visible.
            ["powerup-object"] = c => c.Shows && c.Has(@"struct PowerUp : (public )?GameObject\b") && c.Has(@"\bMakePowerUp \(") && c.Has(@"\bPassThrough\b")
                && c.Has(@"std :: vector < PowerUp > \w+") && c.Has(@"""textures/powerup_speed\.png"""),
            // Six test power-ups in row 4: at 1.5 s still there (nothing moves them), the row they will fall to empty.
            ["try-powerups"] = c => c.Drew && c.Has(@"PowerUps \. (push_back|emplace_back) \(") && At(c, 1.5, 55, 170, p => Pill(p, 0.5, 0.5, 1.0)) && At(c, 1.5, 605, 170, p => Pill(p, 0.9, 0.25, 0.25))
                && At(c, 1.5, 55, 395, p => p[2] < 0.5),
            // UpdatePowerUps: they fall – at 1.5 s all six at y = 385, row 4 empty again.
            ["update-powerups"] = c => c.Drew && c.Has(@"\bUpdatePowerUps \( \w+ ,") && At(c, 1.5, 55, 395, p => Pill(p, 0.5, 0.5, 1.0)) && At(c, 1.5, 495, 395, p => Pill(p, 1.0, 0.3, 0.3))
                && At(c, 1.5, 165, 395, p => Pill(p, 1.0, 0.5, 1.0)) && At(c, 1.5, 55, 170, p => p[2] < 0.4),
            // Caught by the paddle (frame 161): pad-size-increase and confuse – at 3.0 s the confused picture with a 150 px paddle.
            ["activate"] = c => c.Drew && c.Has(@"\bActivatePowerUp \(") && At(c, 3.0, 442, 12, InvertedPaddle) && At(c, 3.0, 320, 10, InvertedPaddle) && At(c, 3.0, 358, 588, InvertedPaddle)
                && At(c, 3.0, 200, 250, InvertedSky),
            // Spawning from broken bricks: no brick breaks with the course's input – checked in the code.
            ["spawn-powerups"] = c => c.Shows && c.Has(@"\bShouldSpawn \(") && c.Has(@"\bSpawnPowerUps \( \w+ , \w+ \)") && c.Has(@"rand \( \) %"),
            // Sticky paddle and pass-through: never reached with the course's input – checked in the code.
            ["sticky-pass"] = c => c.Shows && c.Has(@"\bPassThrough && ! \w+ \. IsSolid|! \w+ \. IsSolid && \w+ \. PassThrough") && c.Has(@"\bStuck = \w+ \. Sticky\b"),
        }),
        ("render-text", new()
        {
            // The test power-ups gone: the normal game again at 3.0 s – not confused, the ball back on the paddle.
            ["remove-test"] = c => c.Drew && At(c, 3.0, 396, 29, OrangeBrick) && At(c, 3.0, 200, 250, DuskSky) && At(c, 3.0, 400, 567, GlassBall) && At(c, 3.0, 480, 590, DarkGround),
            // The TextRenderer and its shader, made in Init: nothing drawn with it.
            ["text-renderer"] = c => c.Shows && c.Has(@"struct TextRenderer \{") && c.Has(@"\bInitTextRenderer \( Text\b"),
            // The glyphs of Inter Bold at 24 pixels: nothing drawn with them.
            ["load-font"] = c => c.Shows && c.Has(@"FT_Load_Char \(") && c.Has(@"\bLoad \( Text , ""fonts/Inter-Bold\.otf"" , 24 \)"),
            // Three lives, one lost in frame 151: nothing shows it yet.
            ["lives"] = c => c.Shows && c.Has(@"\bLives = 3\b") && c.Has(@"-- \w+ \. Lives\b|\. Lives (--|-= 1)"),
            // "Lives:2" in white at the top left.
            ["render-text"] = c => c.Drew && c.Has(@"""Lives:? ?""") && At(c, 3.0, 8, 12, TextWhite) && At(c, 3.0, 81, 17, TextWhite) && At(c, 3.0, 87, 17, p => !TextWhite(p)),
            // The menu over the level: the game never starts, "Lives:3", the menu's two lines.
            ["menu"] = c => c.Drew && c.Has(@"\bKeysProcessed\b") && At(c, 3.0, 325, 302, TextWhite) && At(c, 3.0, 312, 331, TextWhite) && At(c, 3.0, 87, 17, TextWhite) && At(c, 3.0, 400, 567, GlassBall),
            // The win state: never reached with the course's input – checked in the code.
            ["win"] = c => c.Shows && c.Has(@"\bIsCompleted \(") && c.Has(@"State = GAME_WIN ;") && c.Has(@"You WON"),
        }),
    ];
}
