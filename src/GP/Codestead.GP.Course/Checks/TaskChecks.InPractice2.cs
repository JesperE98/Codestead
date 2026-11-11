using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Checks;

// In Practice, the game's second round: the ball, collision detection and resolution, particles – at the screenshot
// time each tasks.md names (frame t × 60 of the deterministic game) and its points of the 800×600 window, the same in
// every API. Tasks that change nothing at those times are checked in the code (loose patterns, every API's spelling).
public static partial class TaskChecks
{
    /// <summary>The pixel at window coordinates (800×600) of the frame at time t.</summary>
    private static bool At(CheckContext c, double t, int x, int y, Func<double[], bool> test) => c.PixelAt(t, x / 800.0, y / 600.0) is { } p && test(p);

    /// <summary>The pale green glass ball (192, 230, 180).</summary>
    private static bool GlassBall(double[] p) => p[1] > 0.8 && p[0] > 0.6 && p[2] > 0.55 && p[1] > p[0];

    /// <summary>The paddle's surroundings at the bottom of the garden (30, 40, 46): dark, nothing drawn there.</summary>
    private static bool DarkGround(double[] p) => p[0] < 0.2 && p[1] < 0.25 && p[2] < 0.25;

    /// <summary>The night sky behind a destroyed brick of the top rows (24, 30, 64): dark blue.</summary>
    private static bool NightSky(double[] p) => p[0] < 0.2 && p[2] > p[0] + 0.08 && p[2] < 0.35;

    /// <summary>The background's moon (255, 255, 233).</summary>
    private static bool Moon(double[] p) => p[0] > 0.9 && p[1] > 0.9 && p[2] > 0.8;

    /// <summary>A solid stone (132, 132, 116): grey, a little less blue.</summary>
    private static bool Stone(double[] p) => p[0] > 0.4 && p[0] < 0.62 && Math.Abs(p[0] - p[1]) < 0.04 && p[2] < p[0];

    /// <summary>An orange brick (158–209, 79–105, 0).</summary>
    private static bool OrangeBrick(double[] p) => p[0] > 0.55 && p[1] > 0.25 && p[1] < 0.5 && p[2] < 0.1;

    /// <summary>A blue brick (40, 121, 201).</summary>
    private static bool BlueBrick(double[] p) => p[2] > 0.7 && p[1] > 0.35 && p[0] < 0.25;

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> InPractice2 =>
    [
        ("ball", new()
        {
            // BallObject (a GameObject with Radius and Stuck) and its constructor: nothing uses them yet.
            ["ball-object"] = c => c.Shows && c.Has(@"struct BallObject : (public )?GameObject\b") && c.Has(@"\bbool Stuck\b") && c.Has(@"\bRadius\b")
                && c.Has(@"\bBallObject MakeBallObject \("),
            // Move (bouncing off the left, right and top edges) and Reset: not called yet.
            ["move-reset"] = c => c.Shows && c.Has(@"\bvoid Move \( BallObject &") && c.Has(@"\bvoid Reset \( BallObject &") && c.Has(@"Velocity \. [xy] = - \w+ \. Velocity \. [xy]"),
            // The ball drawn on the paddle (at 1.0 s still stuck: nothing moves it).
            ["draw-ball"] = c => c.Drew && c.Has(@"\bDrawObject \( Ball ,") && At(c, 1.0, 400, 567, GlassBall) && At(c, 1.0, 400, 557, GlassBall) && At(c, 1.0, 358, 588, p => p[0] > 0.7),
            // Move called every frame: no visible change, the ball is still stuck on the paddle.
            ["update"] = c => c.Shows && c.Has(@"\bMove \( Ball ,") && At(c, 1.0, 400, 567, GlassBall),
            // SPACE releases it (frame 30): at 1.0 s it flies up to the right, the paddle empty again.
            ["launch"] = c => c.Drew && c.Has(@"Stuck = false") && At(c, 1.0, 451, 386, GlassBall) && At(c, 1.0, 400, 567, DarkGround) && At(c, 1.0, 396, 141, BlueBrick),
        }),
        ("collision-detection", new()
        {
            // AABB – AABB: not called yet.
            ["aabb"] = c => c.Shows && c.Has(@"\bbool CheckCollision \( (const )?GameObject & \w+ , (const )?GameObject & \w+ \)"),
            // DoCollisions after Move: at 3.0 s a channel of 10 bricks is gone (the moon shows through it); the bricks
            // the ball never touched and the solid stone are there.
            ["do-collisions"] = c => c.Drew && c.Has(@"\bDoCollisions \( game \)") && At(c, 3.0, 560, 18, NightSky) && At(c, 3.0, 506, 141, NightSky)
                && At(c, 3.0, 615, 110, Moon) && At(c, 3.0, 506, 29, OrangeBrick) && At(c, 3.0, 506, 206, Stone) && At(c, 3.0, 651, 333, GlassBall),
            // AABB – circle, the overload the ball picks: the same 10 bricks at 3.0 s (the difference shows only at 1.75 s).
            ["circle"] = c => c.Shows && c.Has(@"\bCheckCollision \( (const )?BallObject & \w+ , (const )?GameObject & \w+ \)"),
        }),
        ("collision-resolution", new()
        {
            // enum Direction and VectorDirection: not used yet.
            ["direction"] = c => c.Shows && c.Has(@"enum (class )?Direction \{ UP , RIGHT , DOWN , LEFT ,? \}") && c.Has(@"\bDirection VectorDirection \("),
            // The circle test returns a Collision tuple, DoCollisions reads its first element: the same detection.
            ["collision-tuple"] = c => c.Shows && c.Has(@"std :: tuple < bool , Direction ,") && c.Has(@"make_tuple \(|Collision \{|Collision \(")
                && c.Has(@"std :: get < 0 >|auto & ?\[|auto \["),
            // The resolution: the ball bounces off the stone (5, 9) in frame 86 – at 2.0 s it comes down, no brick destroyed.
            ["resolve"] = c => c.Drew && c.Has(@"std :: get < [12] >|auto & ?\[|auto \[") && At(c, 2.0, 551, 435, GlassBall) && At(c, 2.0, 560, 18, OrangeBrick)
                && At(c, 2.0, 506, 141, BlueBrick) && At(c, 2.0, 506, 206, Stone),
            // The paddle bounce: never reached with the course's input – checked in the code.
            ["paddle"] = c => c.Shows && c.Has(@"\bCheckCollision \( Ball , Player \)") && c.Has(@"INITIAL_BALL_VELOCITY \. x \*") && c.Has(@"\bBall \. Velocity \. y = [^;]*abs \("),
            // Losing the ball resets the level and the player: at 3.0 s the ball is stuck on the paddle again, all bricks there.
            ["lose-ball"] = c => c.Drew && c.Has(@"\bResetLevel \(") && c.Has(@"\bResetPlayer \(") && At(c, 3.0, 400, 567, GlassBall) && At(c, 3.0, 506, 141, BlueBrick)
                && At(c, 3.0, 651, 333, p => !GlassBall(p)),
        }),
        ("particles", new()
        {
            // The particle shader (a 10-pixel quad at offset, texture × colour) and its texture loaded: nothing drawn with them.
            ["particle-shader"] = c => c.Shows && c.HasInShaders(@"\* scale \) \+ (\w+ \. )?offset\b") && c.Has(@"LoadShader \([^;]*""particle""") && c.Has(@"""textures/particle\.png""")
                && (c.Api != Apis.OpenGL || c.Has(@"\bvoid SetVector4f \(")),
            // The generator with 500 dead particles: nothing visible.
            ["particle-generator"] = c => c.Shows && c.Has(@"struct Particle \{") && c.Has(@"struct ParticleGenerator \{") && c.Has(@"\bInitParticles \( Particles \)") && c.Has(@"\bamount = 500\b"),
            // Spawning, ageing and fading: the particles live but are not drawn yet.
            ["spawn"] = c => c.Shows && c.Has(@"\bfirstUnusedParticle \(") && c.Has(@"\brespawnParticle \(") && c.Has(@"\brand \( \)") && c.Has(@"\bUpdate \( Particles ,"),
            // The glowing trail behind the ball at 2.0 s: white near the ball, fainter further back, the sky beside it.
            ["draw-particles"] = c => c.Drew && c.Has(@"\bDrawParticles \( Particles \)") && At(c, 2.0, 542, 410, p => p[0] > 0.95 && p[1] > 0.95 && p[2] > 0.95)
                && At(c, 2.0, 530, 366, p => p[0] > 0.6 && p[2] > 0.65) && At(c, 2.0, 522, 332, p => p[0] > 0.55 && p[2] > 0.6) && At(c, 2.0, 560, 366, p => p[0] < 0.4)
                && At(c, 2.0, 551, 435, GlassBall),
        }),
    ];
}
