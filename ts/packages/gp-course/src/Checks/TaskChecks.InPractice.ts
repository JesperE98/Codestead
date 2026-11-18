import { Apis } from "@codestead/gp-gpu";
import { type CheckContext, type Rgba } from "../CheckContext.js";
import { perApi, type ChapterChecks } from "./TaskChecks.PerApi.js";
import { at } from "./TaskChecks.AdvancedOpenGL.js";

// In Practice: learnopengl's debugging cube (what the tools print, and the picture each fix brings), the text demo,
// and the first chapters of the 2D game (Hedgerow) – at named points of the 800×600 window, the same in every API
// (see projects/<api>/<chapter>/tasks.md), and the code where a step changes nothing visible.

/** The clear colour of the debugging and text chapters, (0.2, 0.3, 0.3). */

export function teal(p: Rgba): boolean {
  return Math.abs(p[0] - 0.2) < 0.03 && Math.abs(p[1] - 0.3) < 0.03 && Math.abs(p[2] - 0.3) < 0.03;
}

export function black(p: Rgba): boolean {
  return p[0] < 0.03 && p[1] < 0.03 && p[2] < 0.03;
}

/** The wood of the debugging cube (186, 127, 78): brown, red over green over blue. */

export function wood(p: Rgba): boolean {
  return p[0] > 0.5 && p[0] < 0.88 && p[0] > p[1] + 0.1 && p[1] > p[2] + 0.07 && p[2] < 0.42;
}

/** The cube with its texture coordinates as the colour, red = u, green = v, no blue. */

export function uv(p: Rgba, rMin: number, rMax: number, gMin: number, gMax: number): boolean {
  return p[0] > rMin && p[0] < rMax && p[1] > gMin && p[1] < gMax && p[2] < 0.05;
}

/** The wooden cube, and the background around it. */

export function woodenCube(c: CheckContext): boolean {
  return c.drew && at(c, 400, 300, wood) && at(c, 560, 450, wood) && at(c, 100, 100, teal) && at(c, 150, 300, teal);
}

/** The cube drawn black (its texture incomplete or its view invalid), the background around it. */

export function blackCube(c: CheckContext): boolean {
  return c.drew && at(c, 400, 300, black) && at(c, 560, 450, black) && at(c, 400, 150, black) && at(c, 100, 100, teal);
}

/** The green of "This is sample text" (0.5, 0.8, 0.2). */

export function textGreen(p: Rgba): boolean {
  return p[0] > 0.4 && p[0] < 0.6 && p[1] > 0.7 && p[1] < 0.9 && p[2] > 0.1 && p[2] < 0.3;
}

/** The light blue of "(C) Codestead GP" (0.3, 0.7, 0.9). */

export function textBlue(p: Rgba): boolean {
  return p[0] > 0.2 && p[0] < 0.4 && p[1] > 0.6 && p[1] < 0.8 && p[2] > 0.8;
}

/** The green ball sprite (its colours × (0, 1, 0)): bright green, no red or blue. */

export function ballGreen(p: Rgba): boolean {
  return p[1] > 0.7 && p[0] < 0.05 && p[2] < 0.05;
}

/** The dusk garden's purple sky (53, 44, 75). */

export function duskSky(p: Rgba): boolean {
  return p[2] > p[0] + 0.05 && p[0] > p[1] && p[0] > 0.12 && p[0] < 0.3;
}

export function inPractice(): ChapterChecks {
  return [
    ["debugging", {
        // OpenGL: glCheckError prints the flags glGetError returns – the wrong texture target and the uniforms set
        // with no program in use.
        "check-error": c => c.shows && c.has("glGetError \\( \\)") && c.printed("\\bINVALID_ENUM\\b") && c.printed("\\bINVALID_OPERATION\\b"),
        // The program in use before the uniforms: the cube appears, black (its texture is still incomplete).
        "use-program": c => blackCube(c) && !c.printed("\\bINVALID_OPERATION\\b"),
        // A 4.3 debug context with the callback: the driver names the failing calls, also the one glGetError hid.
        "debug-output": c => c.shows && c.has("glDebugMessageCallback \\(") && c.printed("GL_INVALID_ENUM in glTexImage2D") && c.printed("GL_INVALID_OPERATION in glGenerateMipmap"),
        "fix-texture": perApi({
            // GL_TEXTURE_2D: the wooden cube, nothing printed.
            opengl: c => woodenCube(c) && !c.printed("INVALID_ENUM|INVALID_OPERATION"),
            // MipLevels = 1: the wooden cube, message #31 gone.
            d3d12: c => woodenCube(c) && !c.printed("CreateShaderResourceView: The Dimensions of the View are invalid")}),
        // The texture coordinates as the colour: Direct3D's v runs downwards (green at the face's top in OpenGL and
        // Vulkan, at its bottom in Direct3D 12).
        "shader-output": c => c.drew && at(c, 100, 100, teal) && at(c, 400, 300, p => uv(p, 0.35, 0.6, c.api === Apis.D3D12 ? 0.33 : 0.45, c.api === Apis.D3D12 ? 0.58 : 0.65))
            && (c.api === Apis.D3D12
                ? at(c, 400, 150, p => uv(p, 0.35, 0.65, -1, 0.15)) && at(c, 560, 450, p => uv(p, 0.8, 1.01, 0.8, 1.01))
                : at(c, 400, 150, p => uv(p, 0.35, 0.65, 0.85, 1.01)) && at(c, 560, 450, p => uv(p, 0.8, 1.01, -1, 0.15))),
        // Vulkan: the callback prints warnings and errors only – the layer's informational lines are gone.
        "message-severity": c => c.shows && c.printed("VUID-VkGraphicsPipelineCreateInfo-Input-07904") && !c.printed("Searching for ICD drivers|Loading layer library"),
        // Named objects: the error names the vertex shader's module (and the texture image is named too).
        "object-names": c => c.shows && c.has("VK_OBJECT_TYPE_IMAGE\\b")
            && c.printed("VUID-VkGraphicsPipelineCreateInfo-Input-07904.*Object 0: handle = 0x[0-9a-f]+, name = [^,;]+, type = VK_OBJECT_TYPE_SHADER_MODULE"),
        // Location 1 described: the wooden cube, the error gone.
        "fix-attribute": c => woodenCube(c) && !c.printed("VUID-VkGraphicsPipelineCreateInfo-Input-07904") && c.has("location = 1\\b"),
        // Direct3D 12: the info queue's stored messages, printed – #31 at the view, #708 at the descriptor tables.
        "info-queue": c => c.shows && c.has("GetNumStoredMessages \\(") && c.has("GetMessage \\(")
            && c.printed("CreateShaderResourceView: The Dimensions of the View are invalid") && c.printed("SetGraphicsRootDescriptorTable: The descriptor heap"),
        // Named objects: message #708 names the heap; the render targets and the texture have names too.
        "set-name": c => c.shows && c.has("m_renderTargets \\[ \\w+ \\] -> SetName \\(") && c.has("m_texture -> SetName \\(")
            && c.printed("SetGraphicsRootDescriptorTable: The descriptor heap \\(0x[0-9A-Fa-f]+:'(?!Unnamed )[^']+'\\)"),
        // The heap set on the command list: the cube drawn with its projection, black; #708 gone.
        "descriptor-heaps": c => blackCube(c) && c.has("SetDescriptorHeaps \\(") && !c.printed("SetGraphicsRootDescriptorTable: The descriptor heap"),
        // The message callback: message #31 printed once more, right when it happens (and by the queue afterwards).
        "debug-callback": c => c.shows && c.has("RegisterMessageCallback \\(") && c.has("SetBreakOnSeverity \\(") && c.has("IsDebuggerPresent \\( \\)")
            && c.printedCount("CreateShaderResourceView: The Dimensions of the View are invalid") >= 2,
    }],
    ["text-rendering", {
        // FreeType with the course's font at 48 pixels, freed after loading: nothing visible yet.
        "freetype": c => c.shows && c.has("FT_Init_FreeType \\( & \\w+ \\)") && c.has("FT_New_Face \\( \\w+ , \"fonts/Inter-Bold\\.otf\" , 0 , & \\w+ \\)")
            && c.has("FT_Set_Pixel_Sizes \\( \\w+ , 0 , 48 \\)") && c.has("FT_Done_Face \\(") && c.has("FT_Done_FreeType \\("),
        // The 128 glyphs rendered and stored (a texture each, or a cell of the atlas): nothing visible yet.
        "glyphs": c => c.shows && c.has("struct Character \\{") && c.has("FT_Load_Char \\( \\w+ , \\w+ , FT_LOAD_RENDER \\)") && c.has("bitmap \\. buffer")
            && c.has("Characters \\. (insert|emplace) \\(|Characters \\[ [^\\]]+ \\] ="),
        // "This is sample text" in green at the bottom left.
        "render-text": c => c.drew && c.has("RenderText \\(") && at(c, 40, 541, textGreen) && at(c, 92, 561, textGreen) && at(c, 400, 300, teal),
        // "(C) Codestead GP" in light blue at the top right, line 1 still there.
        "second-line": c => c.drew && at(c, 706, 16, textBlue) && at(c, 744, 22, textBlue) && at(c, 40, 541, textGreen) && at(c, 600, 560, teal),
    }],
    ["game-setup", {
        // The game's state and its (empty) functions, called from the program: nothing visible changes in this chapter.
        "game-struct": c => c.shows && c.has("enum (class )?GameState \\{ GAME_ACTIVE , GAME_MENU , GAME_WIN ,? \\}") && c.has("struct Game \\{[^}]*\\bKeys \\[ 1024 \\]")
            && c.has("\\bGame Hedgerow\\b") && c.has("\\bInit \\( Hedgerow \\)") && c.has("\\bRender \\( Hedgerow \\)"),
        // The frame's duration measured and passed on.
        "delta-time": c => c.shows && c.has("glfwGetTime \\( \\)|_clock :: now \\( \\)")
            && c.has("\\bProcessInput \\( Hedgerow , [A-Za-z_]\\w* \\)") && c.has("\\bUpdate \\( Hedgerow , [A-Za-z_]\\w* \\)"),
        // The keys' state stored by the key callback (GLFW) or the window procedure (WM_KEYDOWN / WM_KEYUP).
        "key-callback": c => c.shows && c.has("\\bKeys \\[ \\w+ \\] =") && c.has("glfwSetKeyCallback \\( \\w+ , \\w+ \\)|case WM_KEYUP :"),
        // learnopengl's Shader as a struct with free functions (OpenGL: the program; Direct3D 12: a pipeline state).
        "shader": c => c.shows && c.has("struct Shader \\{") && c.has("\\bvoid Compile \\( Shader &") && c.has("\\bvoid Use \\( Shader &")
            && c.has(c.api === Apis.D3D12 ? "CreateGraphicsPipelineState \\(" : "glCreateProgram \\( \\)"),
        // learnopengl's Texture2D (Vulkan: loadTextureFromFile makes one).
        "texture": c => c.shows && c.has("struct Texture2D \\{")
            && c.has(c.api === Apis.Vulkan ? "\\bTexture2D loadTextureFromFile \\(" : "\\bvoid Generate \\( Texture2D &"),
        // The resource manager's maps and functions; ClearResources called at the end.
        "resource-manager": c => c.shows && c.has("std :: (unordered_)?map < std :: string , Texture2D >") && c.has("std :: (unordered_)?map < std :: string , (Shader|VkPipeline) >")
            && c.has("\\bGetTexture \\(") && c.has("\\bGetShader \\(") && c.has("(?<![\\w&*] )\\bClearResources \\( \\) ;"),
    }],
    ["rendering-sprites", {
        // The sprite shaders (texture × spriteColor, projection · model) loaded as "sprite", the orthographic
        // projection set: still black.
        "sprite-shader": c => c.shows && c.has("LoadShader \\([^;]*\"sprite\" \\)") && c.has("glm :: ortho \\(|XMMatrixOrthographic\\w* \\(")
            && c.hasInShaders("spriteColor\\b[^;]*\\*[^;]*(texture|\\. Sample) \\(|(texture|\\. Sample) \\([^;]*\\*[^;]*spriteColor")
            && c.hasInShaders("projection \\* (\\w+ \\. )?model|mul \\( mul \\([^;]*\\bmodel \\) , projection \\)"),
        // The sprite renderer and its quad: still black.
        "sprite-renderer": c => c.shows && c.has("struct SpriteRenderer \\{") && c.has("\\bSpriteRenderer Renderer\\b") && c.has("\\bInitRenderData \\( Renderer \\)"),
        // DrawSprite without the rotation: the green ball stretched to an upright ellipse.
        "draw-sprite": c => c.drew && c.has("\\bDrawSprite \\( Renderer ,") && at(c, 350, 400, ballGreen) && at(c, 350, 215, ballGreen) && at(c, 350, 585, p => p[1] > 0.65)
            && at(c, 470, 280, p => p[1] < 0.1) && at(c, 100, 100, black),
        // Rotated 45° about its centre: the ellipse's long axis from the lower left to the upper right.
        "rotate": c => c.drew && c.has("glm :: rotate \\(|XMMatrixRotationZ \\(") && at(c, 350, 400, ballGreen) && at(c, 470, 280, ballGreen) && at(c, 230, 520, ballGreen)
            && at(c, 350, 215, black) && at(c, 350, 585, black) && at(c, 100, 100, black),
    }],
    ["levels", {
        // The garden at dusk over the whole window instead of the ball: the moon, the purple sky.
        "background": c => c.drew && c.has("\"background\"") && at(c, 640, 110, p => p[0] > 0.9 && p[1] > 0.9 && p[2] > 0.85) && at(c, 200, 250, duskSky)
            && at(c, 350, 400, p => p[1] < 0.35 && p[2] > p[1]),
        // GameObject, MakeGameObject and DrawObject: nothing visible changes.
        "game-object": c => c.shows && c.has("struct GameObject \\{[^}]*\\bDestroyed\\b") && c.has("\\bMakeGameObject \\(") && c.has("\\bDrawObject \\("),
        // GameLevel, LoadLevel and InitLevel: nothing visible changes (no level is loaded yet).
        "load-level": c => c.shows && c.has("struct GameLevel \\{") && c.has("\\bLoadLevel \\(") && c.has("\\bInitLevel \\(") && c.has("\\bIsSolid = true"),
        // Level one in the top half: the coloured rows, a solid stone, the gaps showing the sky.
        "draw-level": c => c.drew && c.has("\\bDrawLevel \\(") && at(c, 396, 29, p => p[0] > 0.65 && p[1] > 0.28 && p[1] < 0.5 && p[2] < 0.1)
            && at(c, 396, 104, p => p[1] > 0.4 && p[0] < 0.1 && p[2] < 0.1) && at(c, 396, 141, p => p[2] > 0.65 && p[1] > 0.35 && p[0] < 0.25)
            && at(c, 13, 209, p => p[0] > 0.38 && p[0] < 0.62 && Math.abs(p[0] - p[1]) < 0.04 && p[2] < p[0]) && at(c, 133, 206, duskSky),
        // The paddle at the bottom centre, its brass end at (358, 588).
        "player": c => c.drew && c.has("\\bPLAYER_VELOCITY\\b") && c.has("\\bKeys \\[ (GLFW_KEY_A|'A'|0x41|65) \\]")
            && at(c, 358, 588, p => p[0] > 0.7 && p[1] > 0.55 && p[1] < 0.78 && p[2] < 0.4) && at(c, 300, 590, p => p[0] < 0.2 && p[2] < 0.25) && at(c, 396, 29, p => p[0] > 0.65),
    }],
  ];
}
