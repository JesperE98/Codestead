namespace Codestead.GP.Course.Checks;

// Lighting: the picture where it tells the steps apart (the coral object, the white lamp, how many draws), and the
// shader code otherwise – GLSL and HLSL use the same names for this (reflect, pow, Material, cutOff …).
public static partial class TaskChecks
{
    private static bool Coral(double[] p) => Math.Abs(p[0] - 1.0) < 0.03 && Math.Abs(p[1] - 0.5) < 0.03 && Math.Abs(p[2] - 0.31) < 0.03;

    private static bool White(double[] p) => p[0] > 0.97 && p[1] > 0.97 && p[2] > 0.97;

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> Lighting =>
    [
        ("colors", new()
        {
            ["object-color"] = c => c.AnyDrawnPixel(Coral) && c.HasInShaders(@"lightColor \* objectColor|objectColor \* lightColor"),
            ["lamp-shader"] = c => c.Built && c.HasInShaders(@"vec4 \( 1\.0 \)|vec4 \( 1\.0f?(?: , 1\.0f?){3} \)|float4 \( 1\.0f?(?: , 1\.0f?){3} \)"),
            ["lamp"] = c => c.Scene?.Draws.Count >= 2 && c.AnyDrawnPixel(White),
        }),
        ("basic-lighting", new()
        {
            ["ambient"] = c => c.Drew && c.HasInShaders("ambientStrength"),
            ["normals"] = c => c.Built && c.HasInShaders(@"\bin vec3 \w*[Nn]ormal ;|: ?NORMAL\b"),
            ["diffuse"] = c => c.Drew && c.HasInShaders(@"max \( dot \("),
            ["normal-matrix"] = c => c.Drew && c.HasInShaders(@"(?i)inverse|normalMatrix"),
            ["specular"] = c => c.Drew && c.HasInShaders(@"reflect \(") && c.HasInShaders(@"pow \("),
            ["moving-light"] = c => c.Drew && c.ChangesOverTime && c.Has(@"(?i)lightPos") && c.Has(@"\b(?:sin|cos) \("),
        }),
        ("materials", new()
        {
            ["material"] = c => c.Drew && c.HasInShaders(@"struct Material") && c.HasInShaders("shininess"),
            ["light"] = c => c.Drew && c.HasInShaders(@"struct Light"),
            ["light-color"] = c => c.Drew && c.ChangesOverTime && c.HasInShaders(@"struct Light"),
        }),
        ("lighting-maps", new()
        {
            ["texcoords"] = c => c.Built && c.HasInShaders(@"(?i)(in vec2 \w*tex\w*|: ?TEXCOORD)"),
            ["diffuse-map"] = c => c.Drew && c.Has(@"container2\.png") && c.HasInShaders(@"(?i)(texture \( material\.diffuse|\.Sample \()"),
            ["specular-map"] = c => c.Drew && c.Has(@"container2_specular\.png"),
            ["emission"] = c => c.Drew && c.Has(@"matrix\.png"),
        }),
        ("light-casters", new()
        {
            ["directional"] = c => c.Drew && c.HasInShaders(@"(?i)light\.direction|lightDirection"),
            ["point-light"] = c => c.Drew && c.HasInShaders("quadratic"),
            ["spotlight"] = c => c.Drew && c.HasInShaders("cutOff"),
            ["soft-edges"] = c => c.Drew && c.HasInShaders("outerCutOff"),
        }),
        ("multiple-lights", new()
        {
            ["dir-light"] = c => c.Drew && c.HasInShaders("CalcDirLight"),
            ["point-lights"] = c => c.Drew && c.HasInShaders("CalcPointLight"),
            ["spot-light"] = c => c.Drew && c.HasInShaders("CalcSpotLight"),
            ["lamps"] = c => c.Scene?.Draws.Count >= 14,
        }),
    ];
}
