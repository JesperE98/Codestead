# Rendera text

I det här kapitlet lägger vi till de sista förbättringarna i spelet: ett system med liv, ett vinstvillkor, en meny och
återkoppling i form av renderad text. Kapitlet bygger mycket på kapitlet Textrendering, så det rekommenderas starkt att
du går igenom det först om du inte redan har gjort det.

Projektet är lösningen från kapitlet `powerups` – som `audio` behöll – med nya `// TODO:`-avsnitt, en ny textshader
vars startkroppar kompilerar och inte ritar något användbart, och typsnittet från kapitlet Textrendering,
`fonts/Inter-Bold.otf`, med sin licens `fonts/OFL.txt` (learnopengls spel använder ett annat typsnitt).
:::opengl
Textshadern är `text_2d.vs` / `text_2d.fs`.
:::
:::vulkan
Textshadern är `shaders/text_2d.vert` / `shaders/text_2d.frag`.
:::
:::d3d12
Textshadern är `text_2d.hlsl`.
:::
De förväntade resultaten visar spelet vid **3,0 s** (bildruta 180).

Power-upsen fungerar, så deras test har gjort sitt jobb. Gör den första uppgiften, **remove-test**: ta bort kommentaren
och de sex raderna `game.PowerUps.push_back(…)` i slutet av `Init`; `Init` slutar med bollens rad `MakeBallObject` igen.
Bygg och kör: **det vanliga spelet igen** – inget fångas, bilden är inte förvirrad, racketen är 100 pixlar bred, och vid
3,0 s väntar bollen, som tappades i bildruta 151, på racketen. Det riktiga spelet skapar power-ups bara från block som
går sönder.

## Textrenderaren

I learnopengls spel ligger all kod för textrendering i en klass `TextRenderer`, som initierar FreeType-biblioteket,
ställer in renderingen och innehåller själva renderingskoden. Kursen skriver den som structar och fria funktioner, som
resten av spelet:

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

`InitTextRenderer`, learnopengls konstruktor, laddar textshadern som `"text"`, ger den en ortografisk projektion av
fönstret, sätter samplern `text` till texturenhet 0 och gör en VAO med en dynamisk VBO som rymmer en rektangel: 6 hörn
med 4 floats. Projektionen är `glm::ortho(0, width, height, 0)` – y pekar *nedåt*, som för spelets spritar, och till
skillnad från kapitlet Textrenderings `glm::ortho(0, 800, 0, 600)`. Shadern är kapitlet Textrenderings:

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

Som i kapitlet Textrendering lägger Vulkan-projektet alla glyfer i **en atlasbild**, så `Character` lagrar var dess glyf
finns (`AtlasOffset`) i stället för ett textur-ID. Vid 24 pixlar kan cellerna vara 32 × 32: atlasen är 512 × 256 pixlar.
Och som där behöver varje teckens rektangel en egen plats i vertexbufferten: GPU:n läser den först när command buffern
körs, så att skriva över en rektangel före varje ritanrop (learnopengls `glBufferSubData`) skulle ge varje ritanrop det
sista tecknets rektangel. Därför blir learnopengls VBO en host-visible buffert för `MAX_CHARACTERS` tecken, mappad medan
programmet kör, och `vertexCount` säger hur många hörn den här bildrutan har skrivit hittills.

`InitTextRenderer`, learnopengls konstruktor, behöver enheten, så den är en medlem i applikationsklassen:

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

Textpipelinen görs för **fönstrets render pass** med 1 sample och alfablending: texten ritas efter
efterbehandlingsrektangeln, så ingen effekt rör den. learnopengl ger textshadern en egen `glm::ortho(0, width, height,
0)`; det är spelets projektion – pixlar från övre vänstra hörnet, y nedåt –, som redan finns i uniform buffern, så
`InitTextRenderer` behöver ingen bredd och höjd. Färgen är en push constant, `struct TextConstants { glm::vec3
textColor; };`:

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

Som i kapitlet Textrendering lägger Direct3D 12-projektet alla glyfer i **en atlastextur** med 16 × 8 celler på 64 × 64
texlar, så `Character` lagrar var dess glyf finns (`AtlasPos`) i stället för ett textur-ID. Och som där behöver textens
rektanglar var sin plats i vertexbufferten: GPU:n läser den först när command listen körs, så att skriva över en
rektangel före varje ritanrop (learnopengls `glBufferSubData`) skulle ge varje ritanrop det sista tecknets rektangel.
Därför har vertexbufferten plats för 256 tecken, i en upload heap som är mappad hela tiden, och `VertexCount` säger hur
många hörn den här bildrutan har skrivit hittills.

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

Textshadern laddas med alfablending och 1 sample – den ritar i fönstret, efter efterbehandlingsrektangeln, så ingen
effekt rör den. learnopengl ger textshadern en egen `glm::ortho(0, width, height, 0)`; det är spelets projektion –
pixlar från övre vänstra hörnet, y nedåt –, som redan finns i konstantbufferten vid `b1`, så det finns inget att ställa
in. Färgen är en root constant:

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

Gör den globala `Text` efter `Effects` och sätt upp den i `Init`, efter efterbehandlaren. Gör nu uppgiften
**text-renderer**: **ingen synlig förändring**.

### Ladda typsnittet

`Load` är kapitlet Textrenderings glyfloop – projektet länkar FreeType så som du satte upp det där: FreeType laddar
typsnittet i den givna pixelstorleken, och vart och ett av de första 128 ASCII-tecknen blir en `Character`.

:::ide clion vscode
För din `CMakeLists.txt` betyder det de två FreeType-raderna från *Textrendering* i slutet.
:::
:::ide vs rider
Med vcpkg:s integration hittar projektet FreeType av sig självt; utan den gör du FreeType-inställningarna från
*Textrendering* i det här kapitlets projekt också.
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

En `GL_RED`-textur per glyf, med `GL_UNPACK_ALIGNMENT` satt till 1 eftersom en glyfs rader är lika många byte långa som
den är bred. Advance lagras med en `static_cast<unsigned int>`: FreeTypes `advance.x` är en `FT_Pos` med tecken.
(Stavfelet "FREETYTPE" i felmeddelandet är learnopengls eget.) I slutet av `main` tas glyftexturerna bort tillsammans
med de andra objekten.
:::
:::vulkan
`Load` behöver också enheten, så den är en medlem. Den kopierar varje bitmapp till sin cell i atlasens pixlar, rad för
rad (raderna ligger `pitch` byte isär), och gör sedan atlasbilden och dess descriptor set – spelets uniform buffer vid
binding 0, atlasen vid binding 1:

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

`createAtlasImage` laddar upp pixlarna genom en staging buffer till en `VK_FORMAT_R8_UNORM`-bild – en 8-bitars kanal,
learnopengls `GL_RED`. `Load` anropas en gång; att ladda ett annat typsnitt skulle först kräva att atlasen förstörs.
:::
:::d3d12
`Load` kopierar varje bitmapp till sin cell i en atlas på CPU-sidan, rad för rad (raderna ligger `pitch` byte isär):

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

och gör sedan atlasen till en textur på samma sätt som varje textur i spelet: en `DXGI_FORMAT_R8_UNORM`-resurs (en
8-bitars kanal, learnopengls `GL_RED`) i en default heap, fylld från en upload heap av förberedelsernas command list med
`UpdateSubresources` (`RowPitch = AtlasWidth`: en byte per texel, så ingen justering att bry sig om), en barriär till
`PIXEL_SHADER_RESOURCE` och dess vy i nästa plats i heapen. FreeTypes fel blir undantag; en glyf som misslyckas
rapporteras med `OutputDebugStringA` och hoppas över.
:::

I `Init` laddas typsnittet i **24 pixlar**:

```cpp
Load(Text, "fonts/Inter-Bold.otf", 24);
```

(Kursens kontroller ersätter FreeType med det här typsnittets glyfer i 24 och 48 pixlar; med riktiga FreeType i ditt
program fungerar alla storlekar.) Gör nu uppgiften **load-font**. Inget ritar glyferna än: **ingen synlig förändring**.

## Spelarens liv

I stället för att återställa spelet så snart bollen når nederkanten vill vi ge spelaren några chanser till. Det gör vi i
form av liv: spelaren börjar med 3 liv, och varje gång bollen når nederkanten minskas spelarens antal liv med 1. Först när
antalet liv blir 0 återställer vi spelet. Det gör det lättare för spelaren att klara en bana och bygger samtidigt upp
spänning.

Vi håller räkningen på spelarens liv i spelets struct – `unsigned int Lives = 3;` i `Game` – och ändrar förlustkontrollen
i `Update` så att den minskar antalet liv i stället för att återställa spelet, och bara återställer det när det når 0:

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

Så snart spelaren har förlorat återställer vi banan och ändrar spelets tillstånd till `GAME_MENU`, som vi kommer till
senare. Banan laddas inte längre om när en boll tappas, bara när spelet är slut. Och `ResetLevel` ger spelaren de 3 liven
tillbaka: `game.Lives = 3;` i dess slut.

Gör nu uppgiften **lives**. Bollen tappas i bildruta 151 och `Lives` blir 2 – men inget visar det än: **ingen synlig
förändring**.

## Rendera text

Spelaren har nu ett antal liv, men inget sätt att se det. Det är där textrenderaren kommer in. `RenderText` är nästan
exakt kapitlet Textrenderings, utom en rad:

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

Skälet till den lilla skillnaden är projektionen. I kapitlet Textrendering gick alla y-värden nerifrån och upp; i spelet
går de uppifrån och ned, med y = 0 vid fönstrets överkant. Så (x, y) är nu textens **övre vänstra** hörn, och vi
renderar nedåt från det: den vertikala förskjutningen är hur långt en glyf trycks ned från radens överkant. Om vi ser
tillbaka på glyfmåtten i kapitlet Textrendering: det avståndet är radens överkant minus glyfens överkant, och glyfens
överkant ligger `Bearing.y` ovanför baslinjen. FreeType har inget mått för radens överkant, men vissa glyfer når alltid
dit – tecken som 'H', 'T' eller 'X'. Så vi tar bearing för 'H' och drar ifrån bearing för glyfen i fråga: `ypos = y +
(Characters['H'].Bearing.y - ch.Bearing.y) * scale`. En glyf lika hög som 'H' börjar precis vid y; en lägre, som 'e',
trycks ned med skillnaden.

Texturkoordinaterna följer: v = 0 är en glyfbitmapps första rad, dess överkant, så rektangelns övre hörn (`ypos`) får
glyfens översta rad och de nedre (`ypos + h`) dess nedersta rad.
:::vulkan d3d12
I atlasen är det v0 och v1 i glyfens rektangel.
:::
learnopengl ordnar också om hörnen så att de fortfarande är framåtvända med den här projektionen (se kapitlet Face
culling); spelet ritar utan face culling, så det skulle fungera ändå.
:::vulkan
Varje teckens rektangel skrivs efter de rektanglar som skrivits tidigare den här bildrutan och ritas med
`vkCmdDraw(…, 6, 1, renderer.vertexCount, 0)` – första hörnet vid `vertexCount`. `recordCommandBuffer` ger `Text` command
buffern och börjar varje bildrutas text i buffertens början:

```cpp
Text.commandBuffer = commandBuffer;
Text.vertexCount = 0; // this frame's characters start at the beginning of the text vertex buffer
```
:::
:::d3d12
Varje teckens rektangel skrivs efter de rektanglar som skrivits tidigare den här bildrutan, och hela raden ritas på en
gång: `DrawInstanced(renderer.VertexCount - firstVertex, 1, firstVertex, 0)` – ett ritanrop per rad i stället för
learnopengls ett per tecken. Loopen stannar om bufferten är full. `Render(Game&)` börjar med `Text.VertexCount = 0;`: när
bildrutan spelas in har GPU:n gjort klart den förra (`WaitForPreviousFrame`), så dess rektanglar kan skrivas över.
:::

Liven hamnar uppe till vänster, (5, 5), efter efterbehandlingsrektangeln – texten efterbehandlas inte:

```cpp
RenderText(Text, "Lives:" + std::to_string(game.Lives), 5.0f, 5.0f, 1.0f);
```

learnopengl bygger strängen med en `std::stringstream`; `std::to_string` gör samma sak. Gör nu uppgiften
**render-text**. Bygg och kör: **"Lives:2" i vitt uppe till vänster** – bollen har tappats en gång.
:::opengl vulkan
Sju ritanrop till, ett per tecken.
:::
:::d3d12
Ett ritanrop till, för hela raden.
:::

## Välja bana

När spelet är i tillståndet `GAME_MENU` vill vi låta spelaren välja vilken bana hen vill spela. Med tangenterna W och S
ska spelaren kunna bläddra mellan banorna vi har laddat. När spelaren tycker att den valda banan är den rätta trycker hen
på ENTER för att gå från `GAME_MENU` till `GAME_ACTIVE`.

Att låta spelaren välja bana är inte så svårt: vi ökar eller minskar `Level` när W eller S trycks, med modulooperatorn
som håller den inom 0…3 (och S efter 0 går till 3). Men prova det med bara `game.Keys` så märker du att så snart du
trycker på W eller S bläddrar spelet blixtsnabbt genom banorna: spelet ser tangenten nedtryckt i varje bildruta tills den
släpps, så `ProcessInput` behandlar trycket många gånger – 60 gånger i sekunden.

Det kan vi lösa med ett litet trick som är vanligt i GUI-system: spara inte bara vilka tangenter som är nedtryckta just
nu, utan också vilka tangenter som har behandlats en gång, tills de släpps igen. Vi behandlar sedan en tangent bara om
den inte har behandlats än, och markerar den som behandlad. learnopengl har en andra array i spelet, `bool
KeysProcessed[1024] = {};`, och menyn blir:

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

ENTER är virtual-key-koden `VK_RETURN`; bokstävernas koder är deras stora ASCII-tecken, `'W'` och `'S'` – samma tal
som GLFW:s tangentkoder för bokstäver.
:::

Sedan, så snart en tangent släpps, nollställs dess flagga för behandlad, så att den kan behandlas igen nästa gång den
trycks:

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

Vi vill också bestämma vad som ritas i menyn: banan i bakgrunden, och några instruktioner som text. Så `Render` ritar nu
scenen i alla tillstånd – `if (game.State == GAME_ACTIVE || game.State == GAME_MENU || game.State == GAME_WIN)` – och
lägger till menyns två rader:

```cpp
RenderText(Text, "Press ENTER to start", 250.0f, game.Height / 2.0f, 1.0f);
RenderText(Text, "Press W or S to select level", 245.0f, game.Height / 2.0f + 20.0f, 0.75f);
```

Positionerna är learnopengls, gjorda för dess typsnitt; med Inter hamnar raderna lite till vänster om mitten. För att det
ska fungera när spelet startar måste dess tillstånd börja som `GAME_MENU`: `GameState State = GAME_MENU;` i `Game`.

Gör nu uppgiften **menu**. Bygg och kör: **menyn över banan** – "Press ENTER to start" och, mindre, "Press W or S to
select level" mitt i fönstret, "Lives:3" uppe till vänster, bollen på racketen. Kursens fasta indata trycker aldrig på
ENTER, så spelet startar aldrig: mellanslaget i bildrutorna 30 till 32 gör inget i menyn (bara `GAME_ACTIVE` läser det),
bollen stannar på racketen – partiklarna fortsätter att skapas där, eftersom `Update` fortfarande körs – och inget liv
går förlorat.

## Vinna

Spelaren kan nu välja banor, spela och förlora. Det vore tråkigt om spelaren efter att ha förstört alla block upptäckte
att det inte går att vinna på något sätt. Så låt oss fixa det. Spelaren vinner när alla block som inte är solida har
förstörts; learnopengls `GameLevel::IsCompleted` kontrollerar det:

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

Vi kontrollerar villkoret i `Update`, efter förlustkontrollen, och så snart det gäller återställer vi banan och spelaren
och ändrar tillståndet till `GAME_WIN`. För skojs skull slås chaos-effekten på medan vinstskärmen visas:

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

I `Render` gratulerar vi spelaren och ber hen att antingen försöka igen eller avsluta spelet – "You WON!!!" i grönt,
andra raden i gult:

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

och i `ProcessInput`, efter menyn, tar ENTER spelaren från vinstskärmen tillbaka till menyn (ESC stänger redan fönstret):

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

Lägg märke till att den sätter `KeysProcessed` för ENTER: samma tangenttryck skulle annars starta spelet i menyn direkt,
i nästa bildruta. Gör nu uppgiften **win**. Inget block går sönder med de fasta indata, så spelet stannar i menyn:
**ingen synlig förändring**. Och det var allt – spelets sista bit. Prova det: tryck själv på ENTER, A och D och
mellanslag i ditt program, anpassa det efter din smak och visa det för familj och vänner.

```quiz
`RenderText` räknar ut `ypos = y + (Characters['H'].Bearing.y - ch.Bearing.y) * scale`. Vad åstadkommer det?
- [ ] Det lägger textens baslinje vid y
- [ ] Det vänder glyfen upp och ned för projektionen med y nedåt
- [x] Det gör (x, y) till textens övre vänstra hörn: varje glyf trycks ned från y med så mycket som dess överkant ligger lägre än överkanten på ett 'H', en bokstav som når radens överkant
- [ ] Det centrerar texten vertikalt kring y
---
I kapitlet Textrendering (y uppåt) var y baslinjen och glyfen flyttades ned med `Size.y - Bearing.y`. Med y nedåt är radens överkant den naturliga referensen, och FreeType har inget mått för den – därav 'H'.
```

```quiz
Vad händer utan `KeysProcessed` när spelaren trycker på W i menyn?
- [ ] Inget: tangenten läses ändå bara en gång
- [x] Banan byts i varje bildruta medan tangenten hålls nere – ungefär 60 gånger i sekunden –, så den bläddrar genom de fyra banorna alldeles för fort för att man ska kunna välja en
- [ ] Spelet startar på nästa bana
- [ ] Tangentcallbacken anropas inte längre
---
`Keys[key]` är sann från trycket till släppet. `KeysProcessed[key]` sätts när trycket behandlas och nollställs först när tangenten släpps, så varje tryck räknas en gång.
```

```quiz
Varför visar det färdiga spelet med kursens fasta indata "Lives:3" och menyn vid 3,0 s, när det efter uppgiften render-text visade "Lives:2"?
- [ ] Därför att menyn ger spelaren ett extra liv
- [ ] Därför att vinstkontrollen återställer liven
- [ ] Därför att `ResetLevel` körs i varje bildruta i menyn
- [x] Därför att spelet nu börjar i `GAME_MENU` och bara ENTER startar det: mellanslaget i bildrutorna 30–32 ignoreras i menyn, bollen släpps aldrig och inget liv går förlorat
---
`Update` körs fortfarande i menyn – bollen följer racketen, partiklarna skapas –, men bollen sitter fast, så den når aldrig nederkanten.
```

:::opengl
```quiz
learnopengls `RenderText` skriver över VBO:ns enda rektangel med `glBufferSubData` före varje teckens ritanrop. Varför fungerar det i OpenGL?
- [ ] Därför att OpenGL ritar texten på CPU:n
- [ ] Därför att VBO:n skapas med `GL_STATIC_DRAW`
- [x] Därför att OpenGL-kommandon beter sig som om de kördes i ordning: ett ritanrop använder buffertens innehåll som det var när det gavs, så drivrutinen måste behålla eller kopiera de gamla data innan nästa `glBufferSubData` ändrar dem
- [ ] Därför att varje tecken har en egen VBO
---
Den bekvämligheten kostar drivrutinen arbete (kopior eller väntan). Vulkan och Direct3D 12 lämnar det åt programmet: där får varje rektangel en egen plats i bufferten.
```
:::
:::vulkan
```quiz
Varför skriver Vulkan-versionen av `RenderText` varje teckens rektangel vid `vertexCount`, efter de andra, i stället för att skriva över en rektangel som learnopengl gör?
- [ ] Därför att en Vulkan-buffert bara kan skrivas en gång
- [x] Därför att ritanropen bara spelas in: GPU:n läser bufferten när command buffern körs, efter att hela bildrutan har spelats in – med en gemensam rektangel skulle varje tecken ritas med det sista tecknets hörn
- [ ] Därför att `vkCmdDraw` inte kan rita en rektangel med 6 hörn två gånger
- [ ] Därför att atlasen behöver tecknen i ordning
---
`recordCommandBuffer` sätter `Text.vertexCount = 0` varje bildruta, eftersom bildrutan innan är klar på GPU:n. Bufferten har plats för 256 tecken per bildruta – spelets text är mycket kortare.
```
:::
:::d3d12
```quiz
Varför skriver Direct3D 12-versionen av `RenderText` varje teckens rektangel vid `VertexCount`, efter de andra, och ritar raden med en `DrawInstanced`?
- [ ] Därför att en upload heap bara kan skrivas en gång per bildruta
- [ ] Därför att `DrawInstanced` kan rita högst en rektangel per anrop
- [x] Därför att kommandona bara spelas in: GPU:n läser bufferten när command listen körs – med en gemensam rektangel skulle varje tecken ritas med det sista tecknets hörn; med alla en rads rektanglar i följd räcker ett ritanrop för dem
- [ ] Därför att atlasen behöver tecknen i ordning
---
`Render(Game&)` nollställer `Text.VertexCount` varje bildruta, eftersom `WaitForPreviousFrame` har låtit GPU:n göra klart bildrutan innan. Loopen stannar när bufferten för 256 tecken är full.
```
:::

```quiz
När spelaren vinner väntar `ProcessInput` på ENTER i `GAME_WIN` och sätter sedan `KeysProcessed[ENTER] = true` innan den byter till `GAME_MENU`. Varför?
- [ ] För att behålla vinsttexten på skärmen en bildruta till
- [ ] Därför att chaos-effekten behöver det
- [ ] Därför att ENTER annars skulle stänga fönstret
- [x] Därför att tangenten fortfarande hålls nere i nästa bildruta: utan flaggan skulle menyn se ett obehandlat ENTER och starta spelet direkt, och hoppa över menyn
---
Flaggan nollställs när ENTER släpps. Då startar nästa tryck spelet, som det ska.
```

## Mer att läsa

- [Render text](https://learnopengl.com/In-Practice/2D-Game/Render-text): learnopengls kapitel som det här kapitlet följer.
- [Text Rendering](https://learnopengl.com/In-Practice/Text-Rendering): FreeType, glyfmåtten och textshadern.

:::vulkan
- [Vertex buffer creation (Vulkan Tutorial)](https://vulkan-tutorial.com/Vertex_buffers/Vertex_buffer_creation): en
  host-visible buffert, mappad och fylld från CPU:n.
:::
:::d3d12
- [ID3D12GraphicsCommandList::DrawInstanced](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-drawinstanced):
  antalet hörn och starthörnet för ett ritanrop.
:::
