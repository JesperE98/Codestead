using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Checks;

// In Practice: learnopengl's debugging cube (what the tools print, and the picture each fix brings), the text demo,
// and the first chapters of the 2D game (Hedgerow) – at named points of the 800×600 window, the same in every API
// (see projects/<api>/<chapter>/tasks.md), and the code where a step changes nothing visible.
public static partial class TaskChecks
{
    /// <summary>The clear colour of the debugging and text chapters, (0.2, 0.3, 0.3).</summary>
    private static bool Teal(double[] p) => Math.Abs(p[0] - 0.2) < 0.03 && Math.Abs(p[1] - 0.3) < 0.03 && Math.Abs(p[2] - 0.3) < 0.03;

    private static bool Black(double[] p) => p[0] < 0.03 && p[1] < 0.03 && p[2] < 0.03;

    /// <summary>The wood of the debugging cube (186, 127, 78): brown, red over green over blue.</summary>
    private static bool Wood(double[] p) => p[0] > 0.5 && p[0] < 0.88 && p[0] > p[1] + 0.1 && p[1] > p[2] + 0.07 && p[2] < 0.42;

    /// <summary>The cube with its texture coordinates as the colour, red = u, green = v, no blue.</summary>
    private static bool Uv(double[] p, double rMin, double rMax, double gMin, double gMax) =>
        p[0] > rMin && p[0] < rMax && p[1] > gMin && p[1] < gMax && p[2] < 0.05;

    /// <summary>The wooden cube, and the background around it.</summary>
    private static bool WoodenCube(CheckContext c) =>
        c.Drew && At(c, 400, 300, Wood) && At(c, 560, 450, Wood) && At(c, 100, 100, Teal) && At(c, 150, 300, Teal);

    /// <summary>The cube drawn black (its texture incomplete or its view invalid), the background around it.</summary>
    private static bool BlackCube(CheckContext c) =>
        c.Drew && At(c, 400, 300, Black) && At(c, 560, 450, Black) && At(c, 400, 150, Black) && At(c, 100, 100, Teal);

    /// <summary>The green of "This is sample text" (0.5, 0.8, 0.2).</summary>
    private static bool TextGreen(double[] p) => p[0] > 0.4 && p[0] < 0.6 && p[1] > 0.7 && p[1] < 0.9 && p[2] > 0.1 && p[2] < 0.3;

    /// <summary>The light blue of "(C) Codestead GP" (0.3, 0.7, 0.9).</summary>
    private static bool TextBlue(double[] p) => p[0] > 0.2 && p[0] < 0.4 && p[1] > 0.6 && p[1] < 0.8 && p[2] > 0.8;

    /// <summary>The green ball sprite (its colours × (0, 1, 0)): bright green, no red or blue.</summary>
    private static bool BallGreen(double[] p) => p[1] > 0.7 && p[0] < 0.05 && p[2] < 0.05;

    /// <summary>The dusk garden's purple sky (53, 44, 75).</summary>
    private static bool DuskSky(double[] p) => p[2] > p[0] + 0.05 && p[0] > p[1] && p[0] > 0.12 && p[0] < 0.3;

    private static IEnumerable<(string Chapter, Dictionary<string, TaskCheck> Checks)> InPractice =>
    [
        ("debugging", new()
        {
            // OpenGL: glCheckError prints the flags glGetError returns – the wrong texture target and the uniforms set
            // with no program in use.
            ["check-error"] = c => c.Shows && c.Has(@"glGetError \( \)") && c.Printed(@"\bINVALID_ENUM\b") && c.Printed(@"\bINVALID_OPERATION\b"),
            // The program in use before the uniforms: the cube appears, black (its texture is still incomplete).
            ["use-program"] = c => BlackCube(c) && !c.Printed(@"\bINVALID_OPERATION\b"),
            // A 4.3 debug context with the callback: the driver names the failing calls, also the one glGetError hid.
            ["debug-output"] = c => c.Shows && c.Has(@"glDebugMessageCallback \(") && c.Printed(@"GL_INVALID_ENUM in glTexImage2D") && c.Printed(@"GL_INVALID_OPERATION in glGenerateMipmap"),
            ["fix-texture"] = PerApi(
                // GL_TEXTURE_2D: the wooden cube, nothing printed.
                opengl: c => WoodenCube(c) && !c.Printed(@"INVALID_ENUM|INVALID_OPERATION"),
                // MipLevels = 1: the wooden cube, message #31 gone.
                d3d12: c => WoodenCube(c) && !c.Printed(@"CreateShaderResourceView: The Dimensions of the View are invalid")),
            // The texture coordinates as the colour: Direct3D's v runs downwards (green at the face's top in OpenGL and
            // Vulkan, at its bottom in Direct3D 12).
            ["shader-output"] = c => c.Drew && At(c, 100, 100, Teal) && At(c, 400, 300, p => Uv(p, 0.35, 0.6, c.Api == Apis.D3D12 ? 0.33 : 0.45, c.Api == Apis.D3D12 ? 0.58 : 0.65))
                && (c.Api == Apis.D3D12
                    ? At(c, 400, 150, p => Uv(p, 0.35, 0.65, -1, 0.15)) && At(c, 560, 450, p => Uv(p, 0.8, 1.01, 0.8, 1.01))
                    : At(c, 400, 150, p => Uv(p, 0.35, 0.65, 0.85, 1.01)) && At(c, 560, 450, p => Uv(p, 0.8, 1.01, -1, 0.15))),
            // Vulkan: the callback prints warnings and errors only – the layer's informational lines are gone.
            ["message-severity"] = c => c.Shows && c.Printed(@"VUID-VkGraphicsPipelineCreateInfo-Input-07904") && !c.Printed(@"Searching for ICD drivers|Loading layer library"),
            // Named objects: the error names the vertex shader's module (and the texture image is named too).
            ["object-names"] = c => c.Shows && c.Has(@"VK_OBJECT_TYPE_IMAGE\b")
                && c.Printed(@"VUID-VkGraphicsPipelineCreateInfo-Input-07904.*Object 0: handle = 0x[0-9a-f]+, name = [^,;]+, type = VK_OBJECT_TYPE_SHADER_MODULE"),
            // Location 1 described: the wooden cube, the error gone.
            ["fix-attribute"] = c => WoodenCube(c) && !c.Printed(@"VUID-VkGraphicsPipelineCreateInfo-Input-07904") && c.Has(@"location = 1\b"),
            // Direct3D 12: the info queue's stored messages, printed – #31 at the view, #708 at the descriptor tables.
            ["info-queue"] = c => c.Shows && c.Has(@"GetNumStoredMessages \(") && c.Has(@"GetMessage \(")
                && c.Printed(@"CreateShaderResourceView: The Dimensions of the View are invalid") && c.Printed(@"SetGraphicsRootDescriptorTable: The descriptor heap"),
            // Named objects: message #708 names the heap; the render targets and the texture have names too.
            ["set-name"] = c => c.Shows && c.Has(@"m_renderTargets \[ \w+ \] -> SetName \(") && c.Has(@"m_texture -> SetName \(")
                && c.Printed(@"SetGraphicsRootDescriptorTable: The descriptor heap \(0x[0-9A-Fa-f]+:'(?!Unnamed )[^']+'\)"),
            // The heap set on the command list: the cube drawn with its projection, black; #708 gone.
            ["descriptor-heaps"] = c => BlackCube(c) && c.Has(@"SetDescriptorHeaps \(") && !c.Printed(@"SetGraphicsRootDescriptorTable: The descriptor heap"),
            // The message callback: message #31 printed once more, right when it happens (and by the queue afterwards).
            ["debug-callback"] = c => c.Shows && c.Has(@"RegisterMessageCallback \(") && c.Has(@"SetBreakOnSeverity \(") && c.Has(@"IsDebuggerPresent \( \)")
                && c.PrintedCount(@"CreateShaderResourceView: The Dimensions of the View are invalid") >= 2,
        }),
        ("text-rendering", new()
        {
            // FreeType with the course's font at 48 pixels, freed after loading: nothing visible yet.
            ["freetype"] = c => c.Shows && c.Has(@"FT_Init_FreeType \( & \w+ \)") && c.Has(@"FT_New_Face \( \w+ , ""fonts/Inter-Bold\.otf"" , 0 , & \w+ \)")
                && c.Has(@"FT_Set_Pixel_Sizes \( \w+ , 0 , 48 \)") && c.Has(@"FT_Done_Face \(") && c.Has(@"FT_Done_FreeType \("),
            // The 128 glyphs rendered and stored (a texture each, or a cell of the atlas): nothing visible yet.
            ["glyphs"] = c => c.Shows && c.Has(@"struct Character \{") && c.Has(@"FT_Load_Char \( \w+ , \w+ , FT_LOAD_RENDER \)") && c.Has(@"bitmap \. buffer")
                && c.Has(@"Characters \. (insert|emplace) \(|Characters \[ [^\]]+ \] ="),
            // "This is sample text" in green at the bottom left.
            ["render-text"] = c => c.Drew && c.Has(@"RenderText \(") && At(c, 40, 541, TextGreen) && At(c, 92, 561, TextGreen) && At(c, 400, 300, Teal),
            // "(C) Codestead GP" in light blue at the top right, line 1 still there.
            ["second-line"] = c => c.Drew && At(c, 706, 16, TextBlue) && At(c, 744, 22, TextBlue) && At(c, 40, 541, TextGreen) && At(c, 600, 560, Teal),
        }),
        ("game-setup", new()
        {
            // The game's state and its (empty) functions, called from the program: nothing visible changes in this chapter.
            ["game-struct"] = c => c.Shows && c.Has(@"enum (class )?GameState \{ GAME_ACTIVE , GAME_MENU , GAME_WIN ,? \}") && c.Has(@"struct Game \{[^}]*\bKeys \[ 1024 \]")
                && c.Has(@"\bGame Hedgerow\b") && c.Has(@"\bInit \( Hedgerow \)") && c.Has(@"\bRender \( Hedgerow \)"),
            // The frame's duration measured and passed on.
            ["delta-time"] = c => c.Shows && c.Has(@"glfwGetTime \( \)|_clock :: now \( \)")
                && c.Has(@"\bProcessInput \( Hedgerow , [A-Za-z_]\w* \)") && c.Has(@"\bUpdate \( Hedgerow , [A-Za-z_]\w* \)"),
            // The keys' state stored by the key callback (GLFW) or the window procedure (WM_KEYDOWN / WM_KEYUP).
            ["key-callback"] = c => c.Shows && c.Has(@"\bKeys \[ \w+ \] =") && c.Has(@"glfwSetKeyCallback \( \w+ , \w+ \)|case WM_KEYUP :"),
            // learnopengl's Shader as a struct with free functions (OpenGL: the program; Direct3D 12: a pipeline state).
            ["shader"] = c => c.Shows && c.Has(@"struct Shader \{") && c.Has(@"\bvoid Compile \( Shader &") && c.Has(@"\bvoid Use \( Shader &")
                && c.Has(c.Api == Apis.D3D12 ? @"CreateGraphicsPipelineState \(" : @"glCreateProgram \( \)"),
            // learnopengl's Texture2D (Vulkan: loadTextureFromFile makes one).
            ["texture"] = c => c.Shows && c.Has(@"struct Texture2D \{")
                && c.Has(c.Api == Apis.Vulkan ? @"\bTexture2D loadTextureFromFile \(" : @"\bvoid Generate \( Texture2D &"),
            // The resource manager's maps and functions; ClearResources called at the end.
            ["resource-manager"] = c => c.Shows && c.Has(@"std :: (unordered_)?map < std :: string , Texture2D >") && c.Has(@"std :: (unordered_)?map < std :: string , (Shader|VkPipeline) >")
                && c.Has(@"\bGetTexture \(") && c.Has(@"\bGetShader \(") && c.Has(@"(?<![\w&*] )\bClearResources \( \) ;"),
        }),
        ("rendering-sprites", new()
        {
            // The sprite shaders (texture × spriteColor, projection · model) loaded as "sprite", the orthographic
            // projection set: still black.
            ["sprite-shader"] = c => c.Shows && c.Has(@"LoadShader \([^;]*""sprite"" \)") && c.Has(@"glm :: ortho \(|XMMatrixOrthographic\w* \(")
                && c.HasInShaders(@"spriteColor\b[^;]*\*[^;]*(texture|\. Sample) \(|(texture|\. Sample) \([^;]*\*[^;]*spriteColor")
                && c.HasInShaders(@"projection \* (\w+ \. )?model|mul \( mul \([^;]*\bmodel \) , projection \)"),
            // The sprite renderer and its quad: still black.
            ["sprite-renderer"] = c => c.Shows && c.Has(@"struct SpriteRenderer \{") && c.Has(@"\bSpriteRenderer Renderer\b") && c.Has(@"\bInitRenderData \( Renderer \)"),
            // DrawSprite without the rotation: the green ball stretched to an upright ellipse.
            ["draw-sprite"] = c => c.Drew && c.Has(@"\bDrawSprite \( Renderer ,") && At(c, 350, 400, BallGreen) && At(c, 350, 215, BallGreen) && At(c, 350, 585, p => p[1] > 0.65)
                && At(c, 470, 280, p => p[1] < 0.1) && At(c, 100, 100, Black),
            // Rotated 45° about its centre: the ellipse's long axis from the lower left to the upper right.
            ["rotate"] = c => c.Drew && c.Has(@"glm :: rotate \(|XMMatrixRotationZ \(") && At(c, 350, 400, BallGreen) && At(c, 470, 280, BallGreen) && At(c, 230, 520, BallGreen)
                && At(c, 350, 215, Black) && At(c, 350, 585, Black) && At(c, 100, 100, Black),
        }),
        ("levels", new()
        {
            // The garden at dusk over the whole window instead of the ball: the moon, the purple sky.
            ["background"] = c => c.Drew && c.Has(@"""background""") && At(c, 640, 110, p => p[0] > 0.9 && p[1] > 0.9 && p[2] > 0.85) && At(c, 200, 250, DuskSky)
                && At(c, 350, 400, p => p[1] < 0.35 && p[2] > p[1]),
            // GameObject, MakeGameObject and DrawObject: nothing visible changes.
            ["game-object"] = c => c.Shows && c.Has(@"struct GameObject \{[^}]*\bDestroyed\b") && c.Has(@"\bMakeGameObject \(") && c.Has(@"\bDrawObject \("),
            // GameLevel, LoadLevel and InitLevel: nothing visible changes (no level is loaded yet).
            ["load-level"] = c => c.Shows && c.Has(@"struct GameLevel \{") && c.Has(@"\bLoadLevel \(") && c.Has(@"\bInitLevel \(") && c.Has(@"\bIsSolid = true"),
            // Level one in the top half: the coloured rows, a solid stone, the gaps showing the sky.
            ["draw-level"] = c => c.Drew && c.Has(@"\bDrawLevel \(") && At(c, 396, 29, p => p[0] > 0.65 && p[1] > 0.28 && p[1] < 0.5 && p[2] < 0.1)
                && At(c, 396, 104, p => p[1] > 0.4 && p[0] < 0.1 && p[2] < 0.1) && At(c, 396, 141, p => p[2] > 0.65 && p[1] > 0.35 && p[0] < 0.25)
                && At(c, 13, 209, p => p[0] > 0.38 && p[0] < 0.62 && Math.Abs(p[0] - p[1]) < 0.04 && p[2] < p[0]) && At(c, 133, 206, DuskSky),
            // The paddle at the bottom centre, its brass end at (358, 588).
            ["player"] = c => c.Drew && c.Has(@"\bPLAYER_VELOCITY\b") && c.Has(@"\bKeys \[ (GLFW_KEY_A|'A'|0x41|65) \]")
                && At(c, 358, 588, p => p[0] > 0.7 && p[1] > 0.55 && p[1] < 0.78 && p[2] < 0.4) && At(c, 300, 590, p => p[0] < 0.2 && p[2] < 0.25) && At(c, 396, 29, p => p[0] > 0.65),
        }),
    ];
}
