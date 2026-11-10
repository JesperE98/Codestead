namespace Codestead.GP.Course.Checks;

// Advanced Lighting, round 4: deferred shading of the nine boxes with 32 lights, and SSAO around the planet in a room –
// at named points of the 800×600 window, the same pixels in every API.
public static partial class TaskChecks
{
    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> AdvancedLighting4 =>
    [
        ("deferred-shading", new()
        {
            // The G-buffer's albedo on the screen quad: every face equally bright, unlit (the dark front face too).
            ["g-buffer"] = c => c.Drew && At(c, 400, 440, p => p[0] > 0.45) && At(c, 400, 50, p => p[0] < 0.05),
            // The lighting pass from the G-buffer: the same picture as forward rendering (the front face dark again).
            ["lighting-pass"] = c => c.Drew && At(c, 400, 440, p => p[0] < 0.12) && At(c, 400, 280, p => p[0] > 0.2) && c.HasInShaders("gAlbedoSpec"),
            // The light cubes, forward-rendered in their colours over the deferred picture.
            ["light-cubes"] = c => c.Drew && At(c, 609, 233, p => p[0] > 0.8 && p[2] > 0.45),
            ["light-volumes"] = c => c.Drew && At(c, 609, 233, p => p[0] > 0.8 && p[2] > 0.45) && c.HasInShaders(@"\bRadius\b|\bradius\b") && c.Has("maxBrightness"),
        }),
        ("ssao", new()
        {
            // The raw occlusion shown in grey: the contact shadow under the planet grey, the open floor white.
            ["kernel"] = c => c.Drew && At(c, 400, 376, p => Grey(p) && p[0] < 0.85) && At(c, 400, 500, p => p[0] > 0.9),
            // Blurred: still grey, the 4 × 4 noise pattern smoothed away.
            ["blur"] = c => c.Drew && At(c, 400, 376, p => Grey(p) && p[0] < 0.85) && At(c, 400, 500, p => p[0] > 0.9) && c.Has(@"(?i)ssao_?blur"),
            // The lit scene with the ambient light darkened by the occlusion: the ring's underside almost black-blue.
            ["apply"] = c => c.Drew && At(c, 150, 213, p => p[2] > p[0] + 0.05 && p[0] < 0.2) && At(c, 400, 500, p => p[2] > p[0] + 0.1),
        }),
    ];
}
