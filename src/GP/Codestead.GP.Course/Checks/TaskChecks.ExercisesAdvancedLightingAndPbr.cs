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
        ["shadow-mapping"] = new()
        {
            // The shadow test as grey: black in the cube's shadow, white on the lit floor.
            ["ex-shadow-only"] = c => At(c, 650, 450, p => p[0] < 0.05) && At(c, 330, 520, p => Grey(p) && p[0] > 0.95) && At(c, 750, 560, p => Grey(p) && p[0] > 0.95),
            // Half a shadow: between the solution's shadow (≈ 0.06) and the lit floor (≈ 0.23).
            ["ex-lighter-shadow"] = c => At(c, 650, 450, p => p[0] > 0.11 && p[0] < 0.19) && At(c, 560, 440, p => p[0] > 0.11 && p[0] < 0.19) && At(c, 750, 560, p => p[0] > 0.2),
            // The light at (2, 4, −1): the shadow on the left of the floor, the right lit.
            ["ex-move-light"] = c => At(c, 150, 450, p => p[0] < 0.1) && At(c, 200, 450, p => p[0] < 0.1) && At(c, 650, 450, p => p[0] > 0.15) && At(c, 560, 440, p => p[0] > 0.15),
            // A perspective light: the shadow grows, out to the floor's front right corner of the view.
            ["ex-perspective-light"] = c => InShadow(c) && At(c, 700, 480, p => p[0] < 0.08) && At(c, 750, 560, p => p[0] < 0.15) && At(c, 200, 450, p => p[0] > 0.2),
        },
        ["point-shadows"] = new()
        {
            // The light moves: the picture at 2.3 s differs from the one at 1 s.
            ["ex-animate-light"] = c => c.Drew && c.ChangesOverTime,
            // Far plane 6: beyond 6 units from the light everything is in shadow (the corners), the middle is lit.
            ["ex-far-plane"] = c => At(c, 780, 580, p => p[0] < 0.08) && At(c, 750, 50, p => p[0] < 0.08) && At(c, 100, 500, p => p[0] < 0.08) && At(c, 350, 300, p => p[0] > 0.4),
            // A sixth cube at (1.5, −1, −2.5): its shadow on the wall at the lower right, the rest of the wall still lit.
            ["ex-add-cube"] = c => At(c, 700, 520, p => p[0] < 0.08) && At(c, 780, 580, p => p[0] < 0.08) && At(c, 100, 500, p => p[0] > 0.18) && At(c, 350, 300, p => p[0] > 0.4),
            // The light near the ceiling: the rotated cube's shadow falls down the middle of the wall; the right is lit.
            ["ex-move-light"] = c => At(c, 264, 300, p => p[0] < 0.1) && At(c, 350, 300, p => p[0] < 0.1) && At(c, 600, 300, p => p[0] > 0.12),
        },
        ["normal-mapping"] = new()
        {
            // The normals as colours: the flat brick faces (0, 0, 1) light blue (0.5, 0.5, 1.0).
            ["ex-show-normals"] = c => c.PixelIs(300 / 800.0, 250 / 600.0, 0.5, 0.5, 1.0) && c.PixelIs(480 / 800.0, 180 / 600.0, 0.5, 0.5, 1.0),
            // The surface's own normal: no brick edge turned away from the light, so (almost) no dark pixels; the highlight stays.
            ["ex-flat"] = c => At(c, 480, 180, p => p[0] > 0.85) && c.CountPixels(p => p[0] < 0.08) < 60,
            // Three times the tilt: about twice as many dark brick edges as the solution's ≈ 490; the brick faces unchanged.
            ["ex-stronger-bumps"] = c => At(c, 480, 180, p => p[0] > 0.85) && c.CountPixels(p => p[0] < 0.08) > 750,
            // The wall turns: the picture changes over time.
            ["ex-turn"] = c => c.Drew && c.ChangesOverTime,
        },
        ["parallax-mapping"] = new()
        {
            // The depth map as grey: the mortar white, a brick surface black.
            ["ex-show-depth"] = c => At(c, 400, 350, p => Grey(p) && p[0] > 0.7) && At(c, 500, 450, p => Grey(p) && p[0] < 0.1),
            // heightScale 0.25: the bricks shifted further (where the solution has a brick, mortar now and the other way round).
            ["ex-height-scale"] = c => At(c, 207, 467, p => p[0] < 0.2) && At(c, 302, 387, p => p[0] < 0.3) && At(c, 237, 372, p => p[0] > 0.5),
            // No discard: bricks where the solution shows the background at the quad's edges.
            ["ex-no-discard"] = c => c.DrawnAt(642 / 800.0, 307 / 600.0) && c.DrawnAt(142 / 800.0, 392 / 600.0) && c.DrawnAt(467 / 800.0, 177 / 600.0),
            // −70°: a flatter, lower quad – the middle drawn, the solution's lower and upper parts now background.
            ["ex-steeper"] = c => c.DrawnAt(0.5, 350 / 600.0) && c.IsClear(500 / 800.0, 450 / 600.0) && c.IsClear(0.5, 170 / 600.0),
        },
        ["hdr"] = new()
        {
            // Exposure 0.1: the far end no longer white (the wood's colour), the walls next to it dark.
            ["ex-low-exposure"] = c => At(c, 400, 300, p => p[0] > 0.7 && p[0] < 0.9 && p[2] < 0.5) && At(c, 350, 300, p => p[0] < 0.4),
            // A red light of 5: the walls near the camera clearly red at the bottom right.
            ["ex-red-light"] = c => At(c, 700, 550, p => p[0] > 0.35 && p[1] < 0.1) && At(c, 400, 300, p => p[0] > 0.95),
            // ACES: more contrast – the glow round the far end brighter, the dim walls darker than with the exposure curve.
            ["ex-aces"] = c => At(c, 350, 300, p => p[0] > 0.8) && At(c, 250, 300, p => p[0] < 0.09) && At(c, 400, 300, p => p[0] > 0.95),
        },
        ["bloom"] = new()
        {
            // Twice the bloom: a brighter halo under the white light cube and beside it (but not the 30-pass spread).
            ["ex-bloom-strength"] = c => At(c, 400, 280, p => p[0] > 0.6) && At(c, 500, 190, p => p[0] > 0.22 && p[0] < 0.4),
            // Threshold 3: the lit box edges and floor stop glowing – more black pixels; the white light cube still glows.
            ["ex-threshold"] = c => At(c, 400, 190, p => p[0] > 0.95) && At(c, 400, 280, p => Grey(p) && p[0] > 0.4) && c.CountPixels(p => p[0] + p[1] + p[2] < 0.03) > 5900,
            // 30 blur passes: the glow reaches much further from the white light cube.
            ["ex-wider-blur"] = c => At(c, 500, 190, p => p[0] > 0.45) && At(c, 300, 190, p => p[0] > 0.6),
            // An orange light: the halo under it and the floor in its light orange instead of white.
            ["ex-orange-light"] = c => At(c, 400, 280, p => p[0] > p[2] + 0.25) && At(c, 400, 100, p => p[0] > p[2] + 0.3) && At(c, 400, 190, p => p[0] > 0.95),
        },
        ["deferred-shading"] = new()
        {
            // The normals as colours: a box's top (0, 1, 0) green, a front (0, 0, 1) blue.
            ["ex-show-normals"] = c => c.PixelIs(0.5, 0.5, 0.5, 1.0, 0.5) && c.PixelIs(700 / 800.0, 420 / 600.0, 0.5, 0.5, 1.0),
            // The specular map as grey: the steel frame light, the wood dark.
            ["ex-show-specular"] = c => At(c, 400, 300, p => Grey(p) && p[0] > 0.7) && At(c, 700, 420, p => Grey(p) && p[0] < 0.12) && At(c, 400, 160, p => Grey(p) && p[0] < 0.12),
            // Lights that reach further: the lit box tops close to white.
            ["ex-reach"] = c => At(c, 400, 300, p => p[0] > 0.9) && At(c, 400, 160, p => p[0] > 0.9),
            // Warm lights: the steel frame and the wood lit orange, not white.
            ["ex-warm-lights"] = c => At(c, 400, 300, p => p[0] > p[2] + 0.1 && p[0] > 0.18) && At(c, 400, 160, p => p[0] > p[2] + 0.2),
        },
        ["ssao"] = new()
        {
            // A warm light: the wall near the light orange instead of blue.
            ["ex-warm-light"] = c => At(c, 520, 40, p => p[0] > p[2] + 0.3) && At(c, 400, 500, p => p[0] > p[2] + 0.1),
            // Only ambient × AO: grey everywhere, darker under the planet than on the open floor.
            ["ex-ambient-only"] = c => At(c, 520, 40, p => Grey(p) && p[0] < 0.32) && At(c, 470, 110, p => Grey(p)) && At(c, 400, 376, p => Grey(p) && p[0] < 0.23) && At(c, 400, 500, p => Grey(p) && p[0] > 0.26),
            // Radius 1.5: darker floor under the planet, the ring in front of it lighter than in the solution.
            ["ex-radius"] = c => At(c, 400, 376, p => p[0] < 0.25) && At(c, 400, 190, p => p[0] > 0.25 && p[2] > p[0]),
            // AO to the power 3: the ring in front of the planet and the floor under it much darker.
            ["ex-ao-power"] = c => At(c, 400, 190, p => p[0] < 0.18) && At(c, 400, 376, p => p[0] < 0.25) && At(c, 520, 40, p => p[2] > 0.7),
        },
        ["pbr-theory"] = new()
        {
            // metallic as red (rows, growing upwards), roughness as green (columns, growing to the right).
            ["ex-parameters"] = c => At(c, 153, 53, p => p[0] > 0.8 && p[1] < 0.1 && p[2] < 0.02) && At(c, 647, 547, p => p[0] < 0.02 && p[1] > 0.8) && At(c, 400, 300, p => Math.Abs(p[0] - 0.43) < 0.03 && Math.Abs(p[1] - 0.43) < 0.03),
            // N · V as grey: white in a sphere's middle, black at its rim.
            ["ex-n-dot-v"] = c => At(c, 400, 300, p => Grey(p) && p[0] > 0.95) && At(c, 425, 300, p => Grey(p) && p[0] > 0.4 && p[0] < 0.65) && At(c, 430, 300, p => Grey(p) && p[0] < 0.1),
            // Fresnel: a dielectric 0.04 where it faces the camera, a metal its red albedo; every rim near white.
            ["ex-fresnel"] = c => c.PixelIs(153 / 800.0, 547 / 600.0, 0.04, 0.04, 0.04) && At(c, 153, 53, p => p[0] > 0.4 && p[1] < 0.02) && At(c, 430, 300, p => p[0] > 0.7 && p[1] > 0.7),
        },
    };
}
