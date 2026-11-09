namespace Codestead.GP.Course.Checks;

// Textures: loading an image, the texture objects of each API, texture coordinates, sampling, two textures, exercises.
// The picture checks use points of the 800×600 window (relative), the same in every API: the rectangle covers
// x 0.25–0.75 and y 0.25–0.75.
public static partial class TaskChecks
{
    private static bool Near(CheckContext c, double x, double y, int r, int g, int b, double tolerance = 0.06) =>
        c.Pixel(x, y) is { } p && Math.Abs(p[0] - r / 255.0) <= tolerance && Math.Abs(p[1] - g / 255.0) <= tolerance && Math.Abs(p[2] - b / 255.0) <= tolerance;

    private static bool Reddish(CheckContext c, double x, double y) => c.Pixel(x, y) is { } p && p[0] - p[1] > 0.15 && p[0] - p[2] > 0.15;

    /// <summary>The crate, upright: a plank at (260, 200) and the dark brace near the top-right corner at (560, 190).</summary>
    private static bool Crate(CheckContext c) => Near(c, 0.325, 0.333, 146, 96, 52) && Near(c, 0.7, 0.3167, 92, 58, 28, 0.08);

    private static Dictionary<string, TaskCheck> Textures => new()
    {
        ["load-image"] = c => c.Built && c.Has(@"stbi_load \( ""(?:textures/)?container\.png""") && c.Has("stbi_image_free"),
        // OpenGL
        ["create-texture"] = c => c.Built && c.Has(@"glGenTextures \( 1 , & texture1 \)") && c.Has("GL_TEXTURE_WRAP_S") && c.Has("GL_TEXTURE_MIN_FILTER"),
        ["upload"] = c => c.Built && c.Has(@"glTexImage2D \( GL_TEXTURE_2D") && c.Has("glGenerateMipmap"),
        // Every API
        ["texture-coords"] = c => c.Built && c.HasInShaders(@"(?i)(in vec2 \w*tex\w*|: ?TEXCOORD)"),
        ["sample"] = Crate,
        // Tinted by the corner colours: red top right, blue bottom left.
        ["tint"] = c => c.Pixel(0.7375, 0.267) is { } tr && tr[0] > 0.3 && tr[1] < 0.12 && tr[2] < 0.12
            && c.Pixel(0.2625, 0.733) is { } bl && bl[2] > bl[0] + 0.05 && bl[2] > bl[1] + 0.05,
        // The face on top of the crate (20 %), its heart on the right.
        ["texture-units"] = c => Reddish(c, 0.611, 0.538) && Near(c, 0.389, 0.538, 168, 120, 50, 0.08),
        ["flip-face"] = c => Reddish(c, 0.389, 0.538) && Near(c, 0.611, 0.538, 168, 120, 50, 0.08),
        // Coordinates up to 2: the face four times (the top-right copy's heart), the crate small in the bottom-left quarter.
        ["repeat"] = c => Reddish(c, 0.569, 0.395) && c.DrawnAt(0.2875, 0.5417),
        // Half crate, half face: the face is bright, the rest half as bright.
        ["mix-value"] = c => c.Pixel(0.375, 0.3) is { } face && face[1] > 0.45 && c.Pixel(0.744, 0.258) is { } dark && dark[0] < 0.28
            && c.HasInShaders(@"mix \([^;]*, [A-Za-z_][\w.]* \)"),
    };
}
