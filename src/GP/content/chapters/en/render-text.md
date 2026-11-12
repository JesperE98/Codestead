# Render text

In this chapter we'll be adding the final enhancements to the game: a life system, a win condition, a menu, and
feedback in the form of rendered text. This chapter heavily builds upon the Text Rendering chapter, so it is highly
advised to work through that chapter first if you haven't already.

The project is the `powerups` chapter's solution – which `audio` kept – with new `// TODO:` sections, a new text
shader whose start bodies compile and draw nothing useful, and the Text Rendering chapter's font,
`fonts/Inter-Bold.otf`, with its license `fonts/OFL.txt` (learnopengl's game uses another font).
:::opengl
The text shader is `text_2d.vs` / `text_2d.fs`.
:::
:::vulkan
The text shader is `shaders/text_2d.vert` / `shaders/text_2d.frag`.
:::
:::d3d12
The text shader is `text_2d.hlsl`.
:::
The expected results show the game at **3.0 s** (frame 180).

The power-ups work, so their test has done its job. Do the first task, **remove-test**: delete the comment and the six
`game.PowerUps.push_back(…)` lines at the end of `Init`; `Init` ends with the ball's `MakeBallObject` line again. Build
and run: **the normal game again** – nothing is caught, the picture is not confused, the paddle is 100 pixels wide, and
at 3.0 s the ball, lost in frame 151, waits on the paddle. The real game spawns power-ups from broken blocks only.

## The text renderer

In learnopengl's game all text rendering code is encapsulated within a class called `TextRenderer` that features the
initialization of the FreeType library, the render configuration and the actual render code. The course writes it as
structs and free functions, like the rest of the game:

:::opengl
```cpp
struct Character {
    unsigned int TextureID; // ID handle of the glyph texture
    glm::ivec2   Size;      // size of glyph
    glm::ivec2   Bearing;   // offset from baseline to left/top of glyph
    unsigned int Advance;   // horizontal offset to advance to next glyph
};

struct TextRenderer
{
    // holds a list of pre-compiled Characters
    std::map<char, Character> Characters;
    // shader used for text rendering
    Shader       TextShader;
    // render state
    unsigned int VAO = 0, VBO = 0;
};

void InitTextRenderer(TextRenderer& renderer, unsigned int width, unsigned int height)
{
    // load and configure shader
    renderer.TextShader = LoadShader("text_2d.vs", "text_2d.fs", nullptr, "text");
    SetMatrix4(renderer.TextShader, "projection", glm::ortho(0.0f, static_cast<float>(width), static_cast<float>(height), 0.0f), true);
    SetInteger(renderer.TextShader, "text", 0);
    // configure VAO/VBO for texture quads
    glGenVertexArrays(1, &renderer.VAO);
    glGenBuffers(1, &renderer.VBO);
    glBindVertexArray(renderer.VAO);
    glBindBuffer(GL_ARRAY_BUFFER, renderer.VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(float) * 6 * 4, NULL, GL_DYNAMIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), 0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindVertexArray(0);
}
```

`InitTextRenderer`, learnopengl's constructor, loads the text shader as `"text"`, gives it an orthographic projection
of the window, sets the sampler `text` to texture unit 0, and makes a VAO with a dynamic VBO big enough for one quad:
6 vertices of 4 floats. The projection is `glm::ortho(0, width, height, 0)` – y pointing *down*, as the game's sprites
have it, and unlike the Text Rendering chapter's `glm::ortho(0, 800, 0, 600)`. The shader is the Text Rendering
chapter's:

```glsl
void main()
{
    gl_Position = projection * vec4(vertex.xy, 0.0, 1.0);
    TexCoords = vertex.zw;
}
```

```glsl
void main()
{
    // the glyph texture has one channel (red): it is the glyph's coverage, used as alpha
    vec4 sampled = vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r);
    color = vec4(textColor, 1.0) * sampled;
}
```
:::
:::vulkan
```cpp
struct Character {
    glm::ivec2   AtlasOffset; // where the glyph's bitmap is in the atlas (pixels, top-left corner)
    glm::ivec2   Size;        // size of glyph
    glm::ivec2   Bearing;     // offset from baseline to left/top of glyph
    unsigned int Advance;     // horizontal offset to advance to next glyph
};

const uint32_t ATLAS_CELL = 32;
const uint32_t ATLAS_WIDTH = 16 * ATLAS_CELL;
const uint32_t ATLAS_HEIGHT = 8 * ATLAS_CELL;
// The text vertex buffer has room for this many characters per frame (6 vertices each).
const uint32_t MAX_CHARACTERS = 256;

struct TextRenderer {
    // holds a list of pre-compiled Characters
    std::map<char, Character> Characters;
    // shader used for text rendering (its pipeline)
    VkPipeline       TextShader = VK_NULL_HANDLE;
    // the glyph atlas (one 8-bit channel) and its descriptor set
    Texture2D        Atlas;
    // render state: learnopengl's VBO, here big enough for every character of a frame (host visible, mapped while
    // the program runs) - each character's quad is written after the ones before it
    VkBuffer         VBO = VK_NULL_HANDLE;
    VkDeviceMemory   VBOMemory = VK_NULL_HANDLE;
    void*            VBOMapped = nullptr;
    uint32_t         vertexCount = 0; // vertices written so far in this frame
    VkPipelineLayout pipelineLayout = VK_NULL_HANDLE;
    VkCommandBuffer  commandBuffer = VK_NULL_HANDLE; // the command buffer being recorded this frame
};
```

As in the Text Rendering chapter, the Vulkan project keeps all glyphs in **one atlas image**, so `Character` stores
where its glyph is (`AtlasOffset`) instead of a texture ID. At 24 pixels the cells can be 32 × 32: the atlas is
512 × 256 pixels. And as there, every character's quad needs its own place in the vertex buffer: the GPU reads it only
when the command buffer runs, so overwriting one quad before each draw (learnopengl's `glBufferSubData`) would leave
every draw with the last character's quad. So learnopengl's VBO becomes a host-visible buffer for `MAX_CHARACTERS`
characters, mapped while the program runs, and `vertexCount` says how many vertices this frame has written so far.

`InitTextRenderer`, learnopengl's constructor, needs the device, so it is a member of the application class:

```cpp
void InitTextRenderer(TextRenderer& renderer) {
    // load the shader: its pipeline is made for the window's render pass (the text is drawn after the
    // postprocessing quad, so the effects never touch it)
    renderer.TextShader = LoadShader("shaders/text_2d.vert.spv", "shaders/text_2d.frag.spv", "text", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, renderPass, VK_SAMPLE_COUNT_1_BIT);
    renderer.pipelineLayout = pipelineLayout;
    // configure the vertex buffer for texture quads
    VkDeviceSize bufferSize = sizeof(Vertex) * 6 * MAX_CHARACTERS;
    createBuffer(bufferSize, VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, renderer.VBO, renderer.VBOMemory);
    vkMapMemory(device, renderer.VBOMemory, 0, bufferSize, 0, &renderer.VBOMapped);
}
```

The text pipeline is made for the **window's render pass** with 1 sample and alpha blending: the text is drawn after
the postprocessing quad, so no effect touches it. learnopengl gives the text shader its own `glm::ortho(0, width,
height, 0)`; that is the game's projection – pixels from the top-left corner, y down –, which is already in the uniform
buffer, so `InitTextRenderer` needs no width and height. The colour is a push constant, `struct TextConstants {
glm::vec3 textColor; };`:

```glsl
void main() {
    gl_Position = ubo.projection * vec4(vertex.xy, 0.0, 1.0);
    TexCoords = vertex.zw;
}
```

```glsl
layout(binding = 1) uniform sampler2D text;

layout(push_constant) uniform TextConstants {
    vec3 textColor;
} pc;

void main() {
    // the glyph atlas has one channel (red): it is the glyph's coverage, used as alpha
    vec4 sampled = vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r);
    color = vec4(pc.textColor, 1.0) * sampled;
}
```
:::
:::d3d12
```cpp
struct Character {
    XMINT2       AtlasPos;  // the glyph's place (top-left corner) in the glyph atlas, in texels
    XMINT2       Size;      // size of glyph
    XMINT2       Bearing;   // offset from baseline to left/top of glyph
    unsigned int Advance;   // horizontal offset to advance to next glyph
};

const unsigned int AtlasCellSize = 64;
const unsigned int AtlasWidth = 16 * AtlasCellSize;
const unsigned int AtlasHeight = 8 * AtlasCellSize;
// Room for the quads of 256 characters a frame (6 vertices each).
const unsigned int MaxTextVertices = 6 * 256;

struct TextRenderer
{
    // holds a list of pre-compiled Characters
    std::map<char, Character> Characters;
    // shader used for text rendering
    Shader                   TextShader;
    // render state
    Texture2D                Atlas;                 // the glyph atlas (its ID: its view's slot in the heap)
    ComPtr<ID3D12Resource>   VertexBuffer;          // the quads of this frame's text: an upload heap, mapped for good
    D3D12_VERTEX_BUFFER_VIEW VertexBufferView = {};
    UINT8*                   pVertexDataBegin = nullptr;
    unsigned int             VertexCount = 0;       // the vertices written into it this frame
};
```

As in the Text Rendering chapter, the Direct3D 12 project keeps all glyphs in **one atlas texture** of 16 × 8 cells of
64 × 64 texels, so `Character` stores where its glyph is (`AtlasPos`) instead of a texture ID. And as there, the text's
quads all need their own place in the vertex buffer: the GPU reads it only when the command list executes, so
overwriting one quad before each draw (learnopengl's `glBufferSubData`) would leave every draw with the last
character's quad. So the vertex buffer has room for 256 characters, in an upload heap mapped for good, and
`VertexCount` says how many vertices this frame has written so far.

```cpp
void InitTextRenderer(TextRenderer& renderer, unsigned int width, unsigned int height)
{
    // load shader (its projection is the game's - 0 to width, 0 to height, y down -, the
    // constant buffer the game's OnUpdate writes, so there is nothing to configure here)
    renderer.TextShader = LoadShader(L"text_2d.hlsl", "text");
    // the vertex buffer for the texture quads: in an upload heap, mapped as long as it lives -
    // RenderText writes each frame's quads into it
    const UINT vertexBufferSize = MaxTextVertices * 4 * sizeof(float);
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
    CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(vertexBufferSize);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &bufferDesc,
        D3D12_RESOURCE_STATE_GENERIC_READ,
        nullptr,
        IID_PPV_ARGS(&renderer.VertexBuffer)));
    CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
    ThrowIfFailed(renderer.VertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&renderer.pVertexDataBegin)));
    renderer.VertexBufferView.BufferLocation = renderer.VertexBuffer->GetGPUVirtualAddress();
    renderer.VertexBufferView.StrideInBytes = 4 * sizeof(float);
    renderer.VertexBufferView.SizeInBytes = vertexBufferSize;
}
```

The text shader is loaded with alpha blending and 1 sample – it draws into the window, after the postprocessing quad,
so no effect touches it. learnopengl gives the text shader its own `glm::ortho(0, width, height, 0)`; that is the
game's projection – pixels from the top-left corner, y down –, which is already in the constant buffer at `b1`, so
there is nothing to configure. The colour is a root constant:

```hlsl
PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = mul(float4(position, 0.0f, 1.0f), projection);
    result.texCoord = texCoord;

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    // the atlas has one channel (red): it is the glyph's coverage, used as alpha
    float4 sampled = float4(1.0f, 1.0f, 1.0f, text.Sample(wrapSampler, input.texCoord).r);
    return float4(textColor, 1.0f) * sampled;
}
```
:::

Make the global `Text` after `Effects` and set it up in `Init`, after the postprocessor. Now do the task
**text-renderer**: **no visible change**.

### Loading the font

`Load` is the Text Rendering chapter's glyph loop – the project links FreeType as you set it up there: FreeType loads
the font at the given pixel size, and each of the first 128 ASCII characters becomes a `Character`.

:::ide clion vscode
For your `CMakeLists.txt` that means the two FreeType lines from *Text Rendering* at its end.
:::
:::ide vs rider
With vcpkg's integration the project finds FreeType by itself; without it, make the FreeType settings from *Text
Rendering* in this chapter's project too.
:::

:::opengl
```cpp
void Load(TextRenderer& renderer, std::string font, unsigned int fontSize)
{
    // first clear the previously loaded Characters
    renderer.Characters.clear();
    // then initialize and load the FreeType library
    FT_Library ft;
    if (FT_Init_FreeType(&ft)) // all functions return a value different than 0 whenever an error occurred
        std::cout << "ERROR::FREETYPE: Could not init FreeType Library" << std::endl;
    // load font as face
    FT_Face face;
    if (FT_New_Face(ft, font.c_str(), 0, &face))
        std::cout << "ERROR::FREETYPE: Failed to load font" << std::endl;
    // set size to load glyphs as
    FT_Set_Pixel_Sizes(face, 0, fontSize);
    // disable byte-alignment restriction
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    // then for the first 128 ASCII characters, pre-load/compile their characters and store them
    for (GLubyte c = 0; c < 128; c++)
    {
        // load character glyph
        if (FT_Load_Char(face, c, FT_LOAD_RENDER))
        {
            std::cout << "ERROR::FREETYTPE: Failed to load Glyph" << std::endl;
            continue;
        }
        // generate texture
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);
        glTexImage2D(
            GL_TEXTURE_2D,
            0,
            GL_RED,
            face->glyph->bitmap.width,
            face->glyph->bitmap.rows,
            0,
            GL_RED,
            GL_UNSIGNED_BYTE,
            face->glyph->bitmap.buffer
            );
        // set texture options
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        // now store character for later use
        Character character = {
            texture,
            glm::ivec2(face->glyph->bitmap.width, face->glyph->bitmap.rows),
            glm::ivec2(face->glyph->bitmap_left, face->glyph->bitmap_top),
            static_cast<unsigned int>(face->glyph->advance.x)
        };
        renderer.Characters.insert(std::pair<char, Character>(c, character));
    }
    glBindTexture(GL_TEXTURE_2D, 0);
    // destroy FreeType once we're finished
    FT_Done_Face(face);
    FT_Done_FreeType(ft);
}
```

One `GL_RED` texture per glyph, with `GL_UNPACK_ALIGNMENT` set to 1 because a glyph's rows are as many bytes long as
it is wide. The advance is stored with a `static_cast<unsigned int>`: FreeType's `advance.x` is a signed `FT_Pos`. (The
"FREETYTPE" typo in the error message is learnopengl's own.) At the end of `main`, the glyph textures are deleted with
the other objects.
:::
:::vulkan
`Load` needs the device too, so it is a member. It copies each bitmap into its cell of the atlas pixels, row by row
(the rows are `pitch` bytes apart), and then makes the atlas image and its descriptor set – the game's uniform buffer
at binding 0, the atlas at binding 1:

```cpp
glm::ivec2 offset((c % 16) * ATLAS_CELL, (c / 16) * ATLAS_CELL);
for (unsigned int row = 0; row < face->glyph->bitmap.rows; row++) {
    memcpy(&atlasPixels[(offset.y + row) * ATLAS_WIDTH + offset.x], &face->glyph->bitmap.buffer[row * face->glyph->bitmap.pitch], face->glyph->bitmap.width);
}
```

```cpp
createAtlasImage(atlasPixels, renderer.Atlas);
createDescriptorSet(uniformBuffer, sizeof(UniformBufferObject), renderer.Atlas.View, textureSampler, renderer.Atlas.DescriptorSet);
```

`createAtlasImage` uploads the pixels through a staging buffer into a `VK_FORMAT_R8_UNORM` image – one 8-bit channel,
learnopengl's `GL_RED`. `Load` is called once; loading another font would first have to destroy the atlas.
:::
:::d3d12
`Load` copies each bitmap into its cell of a CPU-side atlas, row by row (the rows are `pitch` bytes apart):

```cpp
int cellX = (c % 16) * AtlasCellSize;
int cellY = (c / 16) * AtlasCellSize;
for (unsigned int row = 0; row < face->glyph->bitmap.rows; row++)
{
    memcpy(&atlas[(cellY + row) * AtlasWidth + cellX],
        face->glyph->bitmap.buffer + row * face->glyph->bitmap.pitch,
        face->glyph->bitmap.width);
}
```

and then makes the atlas a texture the way every texture of the game is made: a `DXGI_FORMAT_R8_UNORM` resource (one
8-bit channel, learnopengl's `GL_RED`) in a default heap, filled from an upload heap by the setup's command list with
`UpdateSubresources` (`RowPitch = AtlasWidth`: one byte per texel, so no alignment to worry about), a barrier to
`PIXEL_SHADER_RESOURCE`, and its view in the next heap slot. FreeType's errors become exceptions; a glyph that fails is
reported with `OutputDebugStringA` and skipped.
:::

In `Init` the font is loaded at **24 pixels**:

```cpp
Load(Text, "fonts/Inter-Bold.otf", 24);
```

(The course's checks stand in for FreeType with this font's glyphs at 24 and 48 pixels; with the real FreeType in your
program any size works.) Now do the task **load-font**. Nothing draws the glyphs yet: **no visible change**.

## Player lives

Instead of immediately resetting the game as soon as the ball reaches the bottom edge, we'd like to give the player a
few extra chances. We do this in the form of player lives: the player begins with 3 lives, and each time the ball
touches the bottom edge, the player's life total is decreased by 1. Only when the life total becomes 0 do we reset the
game. This makes it easier for the player to finish a level while also building tension.

We keep count of the player's lives in the game struct – `unsigned int Lives = 3;` in `Game` – and change the loss
check in `Update` to decrease the life total instead of resetting the game, and only reset it when it reaches 0:

:::opengl d3d12
```cpp
// check loss condition
if (Ball.Position.y >= game.Height) // did ball reach bottom edge?
{
    --game.Lives;
    // did the player lose all his lives? : game over
    if (game.Lives == 0)
    {
        ResetLevel(game);
        game.State = GAME_MENU;
    }
    ResetPlayer(game);
}
```
:::
:::vulkan
```cpp
// check loss condition
if (Ball.Position.y >= game.Height) { // did ball reach bottom edge?
    --game.Lives;
    // did the player lose all his lives? : game over
    if (game.Lives == 0) {
        ResetLevel(game);
        game.State = GAME_MENU;
    }
    ResetPlayer(game);
}
```
:::

As soon as the player is game over, we reset the level and change the game state to `GAME_MENU`, which we'll get to
later. The level is no longer reloaded when a ball is lost, only at game over. And `ResetLevel` gives the player the 3
lives back: `game.Lives = 3;` at its end.

Now do the task **lives**. The ball is lost in frame 151 and `Lives` becomes 2 – but nothing shows it yet: **no visible
change**.

## Rendering text

The player now has a life total, but no way of seeing it. That's where the text renderer comes in. `RenderText` is
almost exactly the Text Rendering chapter's, except for one line:

:::opengl
```cpp
void RenderText(TextRenderer& renderer, std::string text, float x, float y, float scale, glm::vec3 color = glm::vec3(1.0f))
{
    // activate corresponding render state
    Use(renderer.TextShader);
    SetVector3f(renderer.TextShader, "textColor", color);
    glActiveTexture(GL_TEXTURE0);
    glBindVertexArray(renderer.VAO);

    // iterate through all characters
    std::string::const_iterator c;
    for (c = text.begin(); c != text.end(); c++)
    {
        Character ch = renderer.Characters[*c];

        float xpos = x + ch.Bearing.x * scale;
        float ypos = y + (renderer.Characters['H'].Bearing.y - ch.Bearing.y) * scale;

        float w = ch.Size.x * scale;
        float h = ch.Size.y * scale;
        // update VBO for each character
        float vertices[6][4] = {
            { xpos,     ypos + h,   0.0f, 1.0f },
            { xpos + w, ypos,       1.0f, 0.0f },
            { xpos,     ypos,       0.0f, 0.0f },

            { xpos,     ypos + h,   0.0f, 1.0f },
            { xpos + w, ypos + h,   1.0f, 1.0f },
            { xpos + w, ypos,       1.0f, 0.0f }
        };
        // render glyph texture over quad
        glBindTexture(GL_TEXTURE_2D, ch.TextureID);
        // update content of VBO memory
        glBindBuffer(GL_ARRAY_BUFFER, renderer.VBO);
        glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(vertices), vertices); // be sure to use glBufferSubData and not glBufferData
        glBindBuffer(GL_ARRAY_BUFFER, 0);
        // render quad
        glDrawArrays(GL_TRIANGLES, 0, 6);
        // now advance cursors for next glyph
        x += (ch.Advance >> 6) * scale; // bitshift by 6 to get value in pixels (1/64th times 2^6 = 64)
    }
    glBindVertexArray(0);
    glBindTexture(GL_TEXTURE_2D, 0);
}
```
:::
:::vulkan
```cpp
void RenderText(TextRenderer& renderer, std::string text, float x, float y, float scale, glm::vec3 color = glm::vec3(1.0f)) {
    // activate corresponding render state
    vkCmdBindPipeline(renderer.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, renderer.TextShader);
    TextConstants constants{};
    constants.textColor = color;
    vkCmdPushConstants(renderer.commandBuffer, renderer.pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(TextConstants), &constants);
    vkCmdBindDescriptorSets(renderer.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, renderer.pipelineLayout, 0, 1, &renderer.Atlas.DescriptorSet, 0, nullptr);
    VkBuffer vertexBuffers[] = {renderer.VBO};
    VkDeviceSize offsets[] = {0};
    vkCmdBindVertexBuffers(renderer.commandBuffer, 0, 1, vertexBuffers, offsets);

    // iterate through all characters
    std::string::const_iterator c;
    for (c = text.begin(); c != text.end(); c++) {
        Character ch = renderer.Characters[*c];
        // the buffer holds MAX_CHARACTERS characters per frame: stop before writing past its end
        if (renderer.vertexCount + 6 > MAX_CHARACTERS * 6) break;

        float xpos = x + ch.Bearing.x * scale;
        float ypos = y + (renderer.Characters['H'].Bearing.y - ch.Bearing.y) * scale;

        float w = ch.Size.x * scale;
        float h = ch.Size.y * scale;
        // the glyph's rectangle in the atlas (0..1); its first row (v0) is the top of the glyph
        float u0 = ch.AtlasOffset.x / (float) ATLAS_WIDTH;
        float v0 = ch.AtlasOffset.y / (float) ATLAS_HEIGHT;
        float u1 = (ch.AtlasOffset.x + ch.Size.x) / (float) ATLAS_WIDTH;
        float v1 = (ch.AtlasOffset.y + ch.Size.y) / (float) ATLAS_HEIGHT;
        // the quad of this character
        float vertices[6][4] = {
            { xpos,     ypos + h,   u0, v1 },
            { xpos + w, ypos,       u1, v0 },
            { xpos,     ypos,       u0, v0 },

            { xpos,     ypos + h,   u0, v1 },
            { xpos + w, ypos + h,   u1, v1 },
            { xpos + w, ypos,       u1, v0 }
        };
        // write it after the vertices of the characters drawn before (the GPU reads them when the frame runs)
        memcpy((char*) renderer.VBOMapped + renderer.vertexCount * sizeof(Vertex), vertices, sizeof(vertices));
        // render quad
        vkCmdDraw(renderer.commandBuffer, 6, 1, renderer.vertexCount, 0);
        renderer.vertexCount += 6;
        // now advance cursors for next glyph
        x += (ch.Advance >> 6) * scale; // bitshift by 6 to get value in pixels (1/64th times 2^6 = 64)
    }
}
```
:::
:::d3d12
```cpp
void RenderText(TextRenderer& renderer, std::string text, float x, float y, float scale, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f))
{
    // activate corresponding render state: the shader, the colour (root constants), the atlas
    Use(renderer.TextShader);
    TextConstants constants = {};
    constants.textColor = color;
    Graphics.CommandList->SetGraphicsRoot32BitConstants(0, sizeof(TextConstants) / 4, &constants, 0);
    CD3DX12_GPU_DESCRIPTOR_HANDLE textureHandle(Graphics.SrvHeap->GetGPUDescriptorHandleForHeapStart(), renderer.Atlas.ID, Graphics.SrvDescriptorSize);
    Graphics.CommandList->SetGraphicsRootDescriptorTable(2, textureHandle);
    Graphics.CommandList->IASetVertexBuffers(0, 1, &renderer.VertexBufferView);

    // this line's quads come after the ones already written this frame
    unsigned int firstVertex = renderer.VertexCount;

    // iterate through all characters
    std::string::const_iterator c;
    for (c = text.begin(); c != text.end(); c++)
    {
        if (renderer.VertexCount + 6 > MaxTextVertices)
            break; // the vertex buffer is full
        Character ch = renderer.Characters[*c];

        float xpos = x + ch.Bearing.x * scale;
        float ypos = y + (renderer.Characters['H'].Bearing.y - ch.Bearing.y) * scale;

        float w = ch.Size.x * scale;
        float h = ch.Size.y * scale;
        // the glyph's rectangle in the atlas, in texture coordinates (v = 0 is the atlas's top
        // row, where each bitmap's top row is)
        float u0 = static_cast<float>(ch.AtlasPos.x) / AtlasWidth;
        float v0 = static_cast<float>(ch.AtlasPos.y) / AtlasHeight;
        float u1 = static_cast<float>(ch.AtlasPos.x + ch.Size.x) / AtlasWidth;
        float v1 = static_cast<float>(ch.AtlasPos.y + ch.Size.y) / AtlasHeight;
        // the character's quad
        float vertices[6][4] = {
            { xpos,     ypos + h,   u0, v1 },
            { xpos + w, ypos,       u1, v0 },
            { xpos,     ypos,       u0, v0 },

            { xpos,     ypos + h,   u0, v1 },
            { xpos + w, ypos + h,   u1, v1 },
            { xpos + w, ypos,       u1, v0 }
        };
        // write it into the vertex buffer after the ones before: the GPU reads the buffer only
        // when the command list executes, so every quad needs its own place (learnopengl
        // overwrites one quad with glBufferSubData before each draw)
        memcpy(renderer.pVertexDataBegin + renderer.VertexCount * 4 * sizeof(float), vertices, sizeof(vertices));
        renderer.VertexCount += 6;
        // now advance cursors for next glyph
        x += (ch.Advance >> 6) * scale; // bitshift by 6 to get value in pixels (1/64th times 2^6 = 64)
    }
    // render the line's quads: one draw for the whole line
    Graphics.CommandList->DrawInstanced(renderer.VertexCount - firstVertex, 1, firstVertex, 0);
}
```
:::

The reason it is slightly different is the projection. In the Text Rendering chapter all y values ranged from bottom
to top; in the game they range from top to bottom, with a y of 0 at the window's top edge. So (x, y) is now the text's
**top-left** corner, and we render downwards from it: the vertical offset is how far a glyph is pushed down from the
top of the line. Looking back at the glyph metrics of the Text Rendering chapter: that distance is the line's top
minus the glyph's top, and the glyph's top is `Bearing.y` above the baseline. FreeType has no metric for the top of
the line, but some glyphs always touch it – characters like 'H', 'T' or 'X'. So we take the bearing of 'H' and subtract
the bearing of the glyph in question: `ypos = y + (Characters['H'].Bearing.y - ch.Bearing.y) * scale`. A glyph as tall
as 'H' starts right at y; a lower one, like 'e', is pushed down by the difference.

The texture coordinates follow: v = 0 is a glyph bitmap's first row, its top, so the quad's top corners (`ypos`) get
the glyph's top row and the bottom ones (`ypos + h`) its bottom row.
:::vulkan d3d12
In the atlas those are v0 and v1 of the glyph's rectangle.
:::
learnopengl also reorders the vertices so that they are still front-facing with this projection (see the Face
Culling chapter); the game draws without face culling, so it would work either way.
:::vulkan
Each character's quad is written after the quads written before it this frame and drawn with
`vkCmdDraw(…, 6, 1, renderer.vertexCount, 0)` – the first vertex at `vertexCount`. `recordCommandBuffer` gives `Text`
the command buffer and starts each frame's text at the beginning of the buffer:

```cpp
Text.commandBuffer = commandBuffer;
Text.vertexCount = 0; // this frame's characters start at the beginning of the text vertex buffer
```
:::
:::d3d12
Each character's quad is written after the quads written before it this frame, and the whole line is drawn at once:
`DrawInstanced(renderer.VertexCount - firstVertex, 1, firstVertex, 0)` – one draw per line instead of learnopengl's
one per character. The loop stops if the buffer is full. `Render(Game&)` starts with `Text.VertexCount = 0;`: when the
frame is recorded, the GPU has finished the previous one (`WaitForPreviousFrame`), so its quads can be overwritten.
:::

The lives go at the top left, (5, 5), after the postprocessing quad – the text is not post-processed:

```cpp
RenderText(Text, "Lives:" + std::to_string(game.Lives), 5.0f, 5.0f, 1.0f);
```

learnopengl builds the string with a `std::stringstream`; `std::to_string` does the same. Now do the task
**render-text**. Build and run: **"Lives:2" in white at the top left** – the ball was lost once.
:::opengl vulkan
Seven more draws, one per character.
:::
:::d3d12
One more draw, for the whole line.
:::

## Level selection

Whenever the game is in the state `GAME_MENU`, we'd like to give the player the control to select the level they'd
like to play. With the W or S key the player should be able to scroll through the levels we loaded. When the player
feels the chosen level is the one to play, they press ENTER to switch from `GAME_MENU` to `GAME_ACTIVE`.

Allowing the player to choose a level is not too difficult: we increase or decrease `Level` when W or S is pressed,
with the modulo operator keeping it within 0…3 (and S after 0 going to 3). But try it with only `game.Keys` and you'd
notice that as soon as you press W or S, the game rapidly scrolls through the levels: the game sees the key held down
in every frame until it is released, so `ProcessInput` processes the press many times – 60 times a second.

We can solve this with a little trick commonly found in GUI systems: not only record the keys currently pressed, but
also the keys that have been processed once, until they are released again. We then process a key only if it hasn't
been processed yet, and mark it as processed. learnopengl keeps a second array in the game, `bool
KeysProcessed[1024] = {};`, and the menu becomes:

:::opengl
```cpp
if (game.State == GAME_MENU)
{
    if (game.Keys[GLFW_KEY_ENTER] && !game.KeysProcessed[GLFW_KEY_ENTER])
    {
        game.State = GAME_ACTIVE;
        game.KeysProcessed[GLFW_KEY_ENTER] = true;
    }
    if (game.Keys[GLFW_KEY_W] && !game.KeysProcessed[GLFW_KEY_W])
    {
        game.Level = (game.Level + 1) % 4;
        game.KeysProcessed[GLFW_KEY_W] = true;
    }
    if (game.Keys[GLFW_KEY_S] && !game.KeysProcessed[GLFW_KEY_S])
    {
        if (game.Level > 0)
            --game.Level;
        else
            game.Level = 3;
        game.KeysProcessed[GLFW_KEY_S] = true;
    }
}
```
:::
:::vulkan
```cpp
if (game.State == GAME_MENU) {
    if (game.Keys[GLFW_KEY_ENTER] && !game.KeysProcessed[GLFW_KEY_ENTER]) {
        game.State = GAME_ACTIVE;
        game.KeysProcessed[GLFW_KEY_ENTER] = true;
    }
    if (game.Keys[GLFW_KEY_W] && !game.KeysProcessed[GLFW_KEY_W]) {
        game.Level = (game.Level + 1) % 4;
        game.KeysProcessed[GLFW_KEY_W] = true;
    }
    if (game.Keys[GLFW_KEY_S] && !game.KeysProcessed[GLFW_KEY_S]) {
        if (game.Level > 0)
            --game.Level;
        else
            game.Level = 3;
        game.KeysProcessed[GLFW_KEY_S] = true;
    }
}
```
:::
:::d3d12
```cpp
if (game.State == GAME_MENU)
{
    if (game.Keys[VK_RETURN] && !game.KeysProcessed[VK_RETURN])
    {
        game.State = GAME_ACTIVE;
        game.KeysProcessed[VK_RETURN] = true;
    }
    if (game.Keys['W'] && !game.KeysProcessed['W'])
    {
        game.Level = (game.Level + 1) % 4;
        game.KeysProcessed['W'] = true;
    }
    if (game.Keys['S'] && !game.KeysProcessed['S'])
    {
        if (game.Level > 0)
            --game.Level;
        else
            game.Level = 3;
        game.KeysProcessed['S'] = true;
    }
}
```

ENTER is the virtual-key code `VK_RETURN`; the letters' codes are their capital ASCII characters, `'W'` and `'S'` –
the same numbers as GLFW's key codes for letters.
:::

Then, as soon as a key is released, its processed flag is cleared, so it can be processed again the next time it is
pressed:

:::opengl
```cpp
else if (action == GLFW_RELEASE)
{
    Hedgerow.Keys[key] = false;
    Hedgerow.KeysProcessed[key] = false;
}
```
:::
:::vulkan
```cpp
else if (action == GLFW_RELEASE) {
    Hedgerow.Keys[key] = false;
    Hedgerow.KeysProcessed[key] = false;
}
```
:::
:::d3d12
```cpp
void OnKeyUp(UINT8 key)
{
    Hedgerow.Keys[key] = false;
    Hedgerow.KeysProcessed[key] = false;
}
```
:::

We also want to define what is drawn in the menu: the level in the background, and some instructions as text. So
`Render` now draws the scene in every state – `if (game.State == GAME_ACTIVE || game.State == GAME_MENU || game.State
== GAME_WIN)` – and adds the menu's two lines:

```cpp
RenderText(Text, "Press ENTER to start", 250.0f, game.Height / 2.0f, 1.0f);
RenderText(Text, "Press W or S to select level", 245.0f, game.Height / 2.0f + 20.0f, 0.75f);
```

The positions are learnopengl's, made for its font; with Inter the lines sit a little left of the centre. For this to
work when the game launches, its state must start as `GAME_MENU`: `GameState State = GAME_MENU;` in `Game`.

Now do the task **menu**. Build and run: **the menu over the level** – "Press ENTER to start" and, smaller, "Press W or
S to select level" in the middle of the window, "Lives:3" at the top left, the ball on the paddle. The course's fixed
input never presses ENTER, so the game never starts: SPACE in frames 30 to 32 does nothing in the menu (only
`GAME_ACTIVE` reads it), the ball stays on the paddle – the particles keep spawning there, because `Update` still runs –
and no life is lost.

## Winning

The player can now select levels, play the game, and lose. It would be unfortunate if, after destroying all the
blocks, they found out they cannot win in any way. So let's fix that. The player wins when all of the non-solid blocks
have been destroyed; learnopengl's `GameLevel::IsCompleted` checks it:

:::opengl
```cpp
bool IsCompleted(GameLevel& level)
{
    for (GameObject& tile : level.Bricks)
        if (!tile.IsSolid && !tile.Destroyed)
            return false;
    return true;
}
```
:::
:::vulkan
```cpp
bool IsCompleted(GameLevel& level) {
    for (GameObject& tile : level.Bricks)
        if (!tile.IsSolid && !tile.Destroyed)
            return false;
    return true;
}
```
:::
:::d3d12
```cpp
bool IsCompleted(GameLevel& level)
{
    for (GameObject& tile : level.Bricks)
        if (!tile.IsSolid && !tile.Destroyed)
            return false;
    return true;
}
```
:::

We check this condition in `Update`, after the loss check, and as soon as it holds, we reset the level and the player
and change the state to `GAME_WIN`. For fun, the chaos effect is switched on while the win screen shows:

:::opengl d3d12
```cpp
// check win condition
if (game.State == GAME_ACTIVE && IsCompleted(game.Levels[game.Level]))
{
    ResetLevel(game);
    ResetPlayer(game);
    Effects.Chaos = true;
    game.State = GAME_WIN;
}
```
:::
:::vulkan
```cpp
// check win condition
if (game.State == GAME_ACTIVE && IsCompleted(game.Levels[game.Level])) {
    ResetLevel(game);
    ResetPlayer(game);
    Effects.Chaos = true;
    game.State = GAME_WIN;
}
```
:::

In `Render`, we congratulate the player and ask them to either retry or quit the game – "You WON!!!" in green, the
second line in yellow:

:::opengl vulkan
```cpp
RenderText(Text, "You WON!!!", 320.0f, game.Height / 2.0f - 20.0f, 1.0f, glm::vec3(0.0f, 1.0f, 0.0f));
RenderText(Text, "Press ENTER to retry or ESC to quit", 130.0f, game.Height / 2.0f, 1.0f, glm::vec3(1.0f, 1.0f, 0.0f));
```
:::
:::d3d12
```cpp
RenderText(Text, "You WON!!!", 320.0f, game.Height / 2.0f - 20.0f, 1.0f, XMFLOAT3(0.0f, 1.0f, 0.0f));
RenderText(Text, "Press ENTER to retry or ESC to quit", 130.0f, game.Height / 2.0f, 1.0f, XMFLOAT3(1.0f, 1.0f, 0.0f));
```
:::

and in `ProcessInput`, after the menu, ENTER takes the player from the win screen back to the menu (ESC already
closes the window):

:::opengl
```cpp
if (game.State == GAME_WIN)
{
    if (game.Keys[GLFW_KEY_ENTER])
    {
        game.KeysProcessed[GLFW_KEY_ENTER] = true;
        Effects.Chaos = false;
        game.State = GAME_MENU;
    }
}
```
:::
:::vulkan
```cpp
if (game.State == GAME_WIN) {
    if (game.Keys[GLFW_KEY_ENTER]) {
        game.KeysProcessed[GLFW_KEY_ENTER] = true;
        Effects.Chaos = false;
        game.State = GAME_MENU;
    }
}
```
:::
:::d3d12
```cpp
if (game.State == GAME_WIN)
{
    if (game.Keys[VK_RETURN])
    {
        game.KeysProcessed[VK_RETURN] = true;
        Effects.Chaos = false;
        game.State = GAME_MENU;
    }
}
```
:::

Note that it sets `KeysProcessed` for ENTER: the same key press would otherwise start the game in the menu right away,
in the next frame. Now do the task **win**. No block breaks with the fixed input, so the game stays in the menu: **no
visible change**. And that is it – the final piece of the game. Try it out: press ENTER, A and D and SPACE yourself in
your program, customize it to your liking, and show it to your family and friends.

```quiz
`RenderText` computes `ypos = y + (Characters['H'].Bearing.y - ch.Bearing.y) * scale`. What does it achieve?
- [ ] It puts the baseline of the text at y
- [ ] It flips the glyph upside down for the y-down projection
- [x] It makes (x, y) the text's top-left corner: each glyph is pushed down from y by how much lower its top is than the top of an 'H', a letter that reaches the top of the line
- [ ] It centres the text vertically on y
---
In the Text Rendering chapter (y up) y was the baseline and the glyph moved down by `Size.y - Bearing.y`. With y pointing down, the top of the line is the natural reference, and FreeType has no metric for it – hence the 'H'.
```

```quiz
Without `KeysProcessed`, what happens when the player presses W in the menu?
- [ ] Nothing: the key is only read once anyway
- [x] The level changes in every frame while the key is held – about 60 times a second –, so it scrolls through the four levels much too fast to choose one
- [ ] The game starts at the next level
- [ ] The key callback is no longer called
---
`Keys[key]` stays true from the press to the release. `KeysProcessed[key]` is set when the press is handled and cleared only on release, so each press counts once.
```

```quiz
With the course's fixed input, why does the finished game show "Lives:3" and the menu at 3.0 s, while after the task render-text it showed "Lives:2"?
- [ ] Because the menu gives the player an extra life
- [ ] Because the win check resets the lives
- [ ] Because `ResetLevel` runs in every frame of the menu
- [x] Because the game now starts in `GAME_MENU` and only ENTER starts it: the SPACE of frames 30–32 is ignored in the menu, the ball is never released, and no life is lost
---
`Update` still runs in the menu – the ball moves with the paddle, the particles spawn –, but the ball is stuck, so it never reaches the bottom.
```

:::opengl
```quiz
learnopengl's `RenderText` overwrites the one quad of the VBO with `glBufferSubData` before each character's draw. Why is that fine in OpenGL?
- [ ] Because OpenGL draws the text on the CPU
- [ ] Because the VBO is created with `GL_STATIC_DRAW`
- [x] Because OpenGL commands behave as if executed in order: a draw uses the buffer's contents as they were when it was issued, so the driver must keep or copy the old data before the next `glBufferSubData` changes it
- [ ] Because each character has its own VBO
---
That convenience costs the driver work (copies or waits). Vulkan and Direct3D 12 leave it to the program: there every quad gets its own place in the buffer.
```
:::
:::vulkan
```quiz
Why does the Vulkan `RenderText` write every character's quad at `vertexCount`, after the others, instead of overwriting one quad as learnopengl does?
- [ ] Because a Vulkan buffer can only be written once
- [x] Because the draws are only recorded: the GPU reads the buffer when the command buffer runs, after the whole frame is recorded – with one shared quad every character would be drawn with the last one's vertices
- [ ] Because `vkCmdDraw` can't draw a quad of 6 vertices twice
- [ ] Because the atlas needs the characters in order
---
`recordCommandBuffer` sets `Text.vertexCount = 0` each frame, since the frame before has finished on the GPU. The buffer has room for 256 characters a frame – the game's text is far shorter.
```
:::
:::d3d12
```quiz
Why does the Direct3D 12 `RenderText` write every character's quad at `VertexCount`, after the others, and draw the line with one `DrawInstanced`?
- [ ] Because an upload heap can only be written once per frame
- [ ] Because `DrawInstanced` can draw at most one quad per call
- [x] Because the commands are only recorded: the GPU reads the buffer when the command list executes – with one shared quad every character would be drawn with the last one's vertices; with all of a line's quads in a row, one draw covers them
- [ ] Because the atlas needs the characters in order
---
`Render(Game&)` resets `Text.VertexCount` each frame, since `WaitForPreviousFrame` has let the GPU finish the frame before. The loop stops when the buffer for 256 characters is full.
```
:::

```quiz
When the player wins, `ProcessInput` waits for ENTER in `GAME_WIN` and then sets `KeysProcessed[ENTER] = true` before switching to `GAME_MENU`. Why?
- [ ] To keep the win text on the screen for one more frame
- [ ] Because the chaos effect needs it
- [ ] Because ENTER would otherwise close the window
- [x] Because the key is still held in the next frame: without the flag the menu would see an unprocessed ENTER and start the game at once, skipping the menu
---
The flag is cleared when ENTER is released. Then the next press starts the game, as it should.
```

## Additional resources

- [Render text](https://learnopengl.com/In-Practice/2D-Game/Render-text): learnopengl's chapter this chapter follows.
- [Text Rendering](https://learnopengl.com/In-Practice/Text-Rendering): FreeType, the glyph metrics and the text
  shader.

:::vulkan
- [Vertex buffer creation (Vulkan Tutorial)](https://vulkan-tutorial.com/Vertex_buffers/Vertex_buffer_creation): a
  host-visible buffer, mapped and filled from the CPU.
:::
:::d3d12
- [ID3D12GraphicsCommandList::DrawInstanced](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-drawinstanced):
  the vertex count and the start vertex of a draw.
:::
