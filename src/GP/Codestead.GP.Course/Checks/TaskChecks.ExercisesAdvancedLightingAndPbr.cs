namespace Codestead.GP.Course.Checks;

// The exercises' checks of advanced-lighting and pbr, by chapter ("ex-…" ids; projects/<api>/<chapter>/exercises.txt). An exercise
// without a check here is ticked by the learner. Points are pixels of the 800×600 window (At), the same place in every API.
public static partial class TaskChecks
{
    private static Dictionary<string, Dictionary<string, TaskCheck>> ExercisesAdvancedLightingAndPbr => new()
    {
        ["advanced-lighting"] = new()
        {
            // Only the highlight: a grey spot in front of the camera, the rest of the floor black.
            ["ex-specular-only"] = c => At(c, 400, 530, p => Grey(p) && p[0] > 0.2) && At(c, 300, 500, p => p[0] < 0.05) && At(c, 100, 500, p => p[0] < 0.02),
            // A blue light: blue and green above red in the light and in the highlight.
            ["ex-blue-light"] = c => At(c, 450, 440, p => p[2] > p[0] + 0.03 && p[1] > p[0] + 0.03) && At(c, 420, 500, p => p[2] > p[0] + 0.03),
            // The light at (−2, 0, 0): the left of the floor clearly brighter than the right.
            ["ex-move-light"] = c => c.Drew && At(c, 130, 390, p => p[0] > 0.25) && At(c, 650, 450, p => p[0] < 0.2),
            // A second light at (−1.5, 0, −1): a bright pool at the back left, and the first light's still there.
            ["ex-two-lights"] = c => At(c, 130, 390, p => p[0] > 0.7) && At(c, 450, 440, p => p[0] > 0.6) && At(c, 700, 550, p => p[0] < 0.45),
        },
        ["gamma-correction"] = new()
        {
            // Only the light, grey: white under the lights, grey between them and in front.
            ["ex-lighting-only"] = c => At(c, 450, 430, p => Grey(p) && p[0] > 0.6) && At(c, 450, 560, p => Grey(p) && p[0] > 0.2) && At(c, 150, 430, p => p[2] > 0.9),
            // Four white lights: the left of the floor as bright as the right (it was dimmer).
            ["ex-equal-lights"] = c => At(c, 150, 430, p => p[0] > 0.9 && p[0] > p[2] + 0.3) && At(c, 30, 470, p => p[0] > 0.5),
            // Encoded by the hardware: the floor as before (not encoded twice), the clear colour 0.1 encoded too (≈ 0.35).
            ["ex-hardware-srgb"] = c => At(c, 400, 100, p => Grey(p) && p[0] > 0.3 && p[0] < 0.4) && At(c, 150, 430, p => p[0] > 0.6 && p[0] < 0.8 && p[2] < 0.4),
        },
    };
}
