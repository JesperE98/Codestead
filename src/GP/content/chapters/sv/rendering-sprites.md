# Rendera sprites

För att blåsa lite liv i spelvärldens hittills svarta avgrund ska vi rendera sprites som fyller tomrummet. En *sprite*
har många definitioner, men i grunden är den inte mycket mer än en 2D-bild som används tillsammans med lite data för att
placera den i en större värld (till exempel position, rotation och storlek). Kort sagt är sprites de renderbara
bild- och texturobjekt vi använder i ett 2D-spel.

Vi kan, precis som i tidigare kapitel, skapa en 2D-form av vertexdata, skicka alla data till GPU:n och transformera allt
för hand. Men i ett större program som det här vill vi hellre ha några abstraktioner för att rendera 2D-former. Om vi
definierade formerna och transformationerna för hand för varje objekt skulle det snabbt bli rörigt.

I det här kapitlet definierar vi en renderingsklass som låter oss rendera många unika sprites med ett minimum av kod. På
så sätt skiljer vi spelkoden från den snåriga {{api}}-renderingskoden, som man brukar göra i större projekt. Först måste
vi dock ställa in en ordentlig projektionsmatris.

## 2D-projektionsmatris

Vi vet från kapitlet Koordinatsystem att en projektionsmatris omvandlar alla koordinater i vyrymden till clip space (och
sedan till normaliserade enhetskoordinater). Genom att skapa en lämplig projektionsmatris kan vi arbeta med koordinater
som är enklare att hantera än att ange alla koordinater direkt som normaliserade enhetskoordinater.

Vi behöver inget perspektiv på koordinaterna, eftersom spelet är helt i 2D, så en ortografisk projektionsmatris passar
renderingen bra. Eftersom en ortografisk projektionsmatris transformerar alla koordinater direkt till normaliserade
enhetskoordinater kan vi välja att ange världskoordinaterna som skärmkoordinater genom att definiera projektionsmatrisen
så här:

:::opengl
```cpp
    glm::mat4 projection = glm::ortho(0.0f, static_cast<float>(game.Width),
        static_cast<float>(game.Height), 0.0f, -1.0f, 1.0f);
```

De fyra första argumenten anger i tur och ordning vänster, höger, botten och topp i projektionsvolymen. Projektionsmatrisen
transformerar alla x-koordinater mellan 0 och 800 till -1 och 1, och alla y-koordinater mellan 0 och 600 till 1 och -1 –
observera ordningen: *botten* är 600 och *topp* är 0. Här angav vi att volymens topp har y-koordinaten 0 och botten
y-koordinaten 600. Resultatet är att scenens övre vänstra koordinat ligger på (0, 0) och skärmens nedre högra del på
koordinaten (800, 600), precis som skärmkoordinater; världskoordinaterna motsvarar direkt de pixelkoordinater de hamnar
på.
:::
:::vulkan
```cpp
        ubo.projection = glm::ortho(0.0f, static_cast<float>(Hedgerow.Width), 0.0f, static_cast<float>(Hedgerow.Height), -1.0f, 1.0f);
```

(i `updateUniformBuffer()`, varje bildruta, som i varje Vulkan-kapitel). De fyra första argumenten anger i tur och
ordning vänster, höger, botten och topp i projektionsvolymen: x från 0 till 800 avbildas på -1 … 1, och y från 0 till
600 på -1 … 1. learnopengl skriver `glm::ortho(0, 800, 600, 0, -1, 1)` – botten 600, topp 0 – för att göra OpenGL:s clip
space, där y pekar *uppåt*, till koordinater där y pekar nedåt. Vulkans clip space har redan y *nedåt* (y = -1 är
fönstrets överkant), så här ger den vanliga ordningen samma resultat, och det behövs inget `proj[1][1] *= -1` heller.
Resultatet är att scenens övre vänstra koordinat ligger på (0, 0) och skärmens nedre högra del på koordinaten
(800, 600), precis som skärmkoordinater; världskoordinaterna motsvarar direkt de pixelkoordinater de hamnar på. (Med
`GLM_FORCE_DEPTH_ZERO_TO_ONE` hamnar z = 0 på djupet 0.5 – det finns ingen djupbuffer i alla fall.)
:::
:::d3d12
```cpp
    XMMATRIX projection = XMMatrixOrthographicOffCenterRH(0.0f, static_cast<float>(Hedgerow.Width), static_cast<float>(Hedgerow.Height), 0.0f, -1.0f, 1.0f);
```

De fyra första argumenten anger i tur och ordning vänster, höger, botten och topp i projektionsvolymen – learnopengls
`glm::ortho(0, Width, Height, 0, -1, 1)`. Direct3D:s clip space har y uppåt som OpenGL:s, så med botten 600 och topp 0
går alla x-koordinater mellan 0 och 800 till -1 … 1 och alla y-koordinater mellan 0 och 600 till 1 … -1. Resultatet är
att scenens övre vänstra koordinat ligger på (0, 0) och skärmens nedre högra del på koordinaten (800, 600), precis som
skärmkoordinater; världskoordinaterna motsvarar direkt de pixelkoordinater de hamnar på. (Den högerhänta versionen
avbildar z = 0 på djupet 0.5 – det finns ingen djupbuffer i alla fall.) Precis som vy- och projektionsmatrisen i de
tidigare Direct3D 12-kapitlen skrivs matrisen till constant buffern i `OnUpdate`, lagrad transponerad för HLSL;
learnopengl sätter den en gång i `Init` som en uniform.
:::

Det låter oss ange alla vertexkoordinater lika med de pixelkoordinater de hamnar på på skärmen, vilket är ganska
intuitivt för 2D-spel. Och det är så texturerna läses: bilderna vänds inte när de laddas, så deras första rad är bildens
överkant – och med y-axeln nedåt får rektangelns överkant (y = 0) den första raden (v = 0).

```quiz
Var på skärmen hamnar en rektangel från (0, 580) till (100, 600) med spelets projektion?
- [ ] I övre vänstra hörnet, 20 pixlar hög
- [x] I nedre vänstra hörnet: y växer nedåt, och 600 är fönstrets nederkant
- [ ] Utanför fönstret, eftersom y = 600 ligger bortom projektionen
- [ ] I nedre vänstra hörnet, men upp och ned
---
Projektionen avbildar spelets pixlar ett till ett på fönstrets: (0, 0) uppe till vänster, (800, 600) nere till höger. Det är där nästa kapitel lägger racketen, 100 × 20 pixlar på (350, 580).
```

## Rendera sprites

Att rendera en riktig sprite borde inte vara alltför komplicerat. Vi skapar en texturerad rektangel som vi kan
transformera med en modellmatris, och sedan projicerar vi den med den ortografiska projektionsmatrisen ovan.

Eftersom Hedgerow är en statisk scen behövs ingen vy- eller kameramatris. Med projektionsmatrisen kan vi transformera
världskoordinaterna direkt till normaliserade enhetskoordinater.

För att transformera en sprite använder vi följande vertex shader:

:::opengl
```glsl
#version 330 core
layout (location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

out vec2 TexCoords;

uniform mat4 model;
// note that we're omitting the view matrix; the view never changes so we basically have an identity view matrix and can therefore omit it.
uniform mat4 projection;

void main()
{
    TexCoords = vertex.zw;
    gl_Position = projection * model * vec4(vertex.xy, 0.0, 1.0);
}
```
:::
:::vulkan
```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 projection;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 spriteColor;
} pc;

layout(location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

layout(location = 0) out vec2 TexCoords;

void main() {
    TexCoords = vertex.zw;
    // no view matrix: the view never changes (the window shows the game's 800 x 600 pixels)
    gl_Position = ubo.projection * pc.model * vec4(vertex.xy, 0.0, 1.0);
}
```

learnopengls två uniforms som ändras från sprite till sprite – `model` och `spriteColor` – är push constants:

```cpp
struct PushConstants {
    glm::mat4 model;
    glm::vec3 spriteColor;
};
```

76 byte, gott och väl inom de 128 byte som varje enhet erbjuder, i ett intervall för både vertex- och fragmentsteget.
Projektionen, som är densamma för alla sprites, ligger i uniform buffern.
:::
:::d3d12
```hlsl
cbuffer SpriteConstants : register(b0)
{
    float4x4 model;
    float3 spriteColor;
};

cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 projection;
};

PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.texCoord = texCoord;
    result.position = mul(mul(float4(position, 0.0f, 1.0f), model), projection);

    return result;
}
```

learnopengls två uniforms som ändras från sprite till sprite – `model` och `spriteColor` – är root constants, de 19
värdena i root-parameter 0 (`cbuffer SpriteConstants : register(b0)`, synliga för båda shadrarna); C++-sidan är

```cpp
struct SpriteConstants
{
    XMFLOAT4X4 model;
    XMFLOAT3   spriteColor;
};
```

Projektionen, som är densamma för alla sprites, ligger i constant buffern på b1. Input layouten i spelets pipeline
state har två `float2`, `POSITION` och `TEXCOORD` – learnopengls enda `vec4`.
:::

Observera att vi lagrar både position och texturkoordinater i en enda `vec4`-variabel. Eftersom både positionen och
texturkoordinaterna består av två floats kan vi slå ihop dem i ett enda vertexattribut.

Fragment shadern är också ganska rättfram. Vi tar en textur och en färgvektor som båda påverkar fragmentets slutliga
färg. Med en uniform färgvektor kan vi enkelt ändra spritens färg från spelkoden:

:::opengl
```glsl
#version 330 core
in vec2 TexCoords;
out vec4 color;

uniform sampler2D image;
uniform vec3 spriteColor;

void main()
{
    color = vec4(spriteColor, 1.0) * texture(image, TexCoords);
}
```
:::
:::vulkan
```glsl
layout(binding = 1) uniform sampler2D image;

layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 spriteColor;
} pc;

layout(location = 0) in vec2 TexCoords;

layout(location = 0) out vec4 color;

void main() {
    color = vec4(pc.spriteColor, 1.0) * texture(image, TexCoords);
}
```

Samplern `image` är binding 1 i texturens descriptor set – det finns ingen texturenhet att ställa in.
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(spriteColor, 1.0f) * image.Sample(wrapSampler, input.texCoord);
}
```

`image` är `Texture2D` på t0 (tabellen i root-parameter 2), `wrapSampler` root signaturens statiska sampler s0.
:::

Färgen multiplicerar texturen: vitt (1, 1, 1) behåller bilden som den är, och varje annan färg tonar den – en ljusgrå
blockplatta blir ett orange eller ett blått block, vilket är så nästa kapitel färgar banans block.

Gör nu den första uppgiften, **sprite-shader**: skriv de två shadrarnas `main` och ladda dem som `"sprite"` i `Init`:

:::opengl
```cpp
    // load shaders
    LoadShader("sprite.vs", "sprite.fs", nullptr, "sprite");
    // configure shaders
    glm::mat4 projection = glm::ortho(0.0f, static_cast<float>(game.Width),
        static_cast<float>(game.Height), 0.0f, -1.0f, 1.0f);
    Use(GetShader("sprite"));
    SetInteger(GetShader("sprite"), "image", 0);
    SetMatrix4(GetShader("sprite"), "projection", projection);
```

Samplern `image` läser texturenhet 0, och projektionen sätts en gång – den ändras aldrig.
:::
:::vulkan
```cpp
        // load shaders
        LoadShader("shaders/sprite.vert.spv", "shaders/sprite.frag.spv", "sprite");
```

och sätt projektionen i `updateUniformBuffer()` som ovan.
:::
:::d3d12
```cpp
    // load shaders
    LoadShader(L"sprite.hlsl", "sprite");
```

och skriv projektionen till constant buffern i `OnUpdate`, efter `Update`:

```cpp
    SceneConstantBuffer constantBufferData = {};
    XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection));
    memcpy(m_pCbvDataBegin, &constantBufferData, sizeof(constantBufferData));
```
:::

Bygg och kör: fortfarande svart – shadern finns, men ingenting ritas med den ännu.

Nu när shadrarna är på plats kan vi skriva sprite-renderaren – hos learnopengl en klass som innehåller en shader och ett
enda vertex array object, med en funktion `DrawSprite` som ritar en texturerad rektangel givet en position, storlek,
rotation och färg. Som överallt i spelet skriver kursen den som en struct och fria funktioner:

:::opengl
```cpp
struct SpriteRenderer
{
    // render state
    Shader       shader;
    unsigned int quadVAO = 0;
};
```

och den globala `SpriteRenderer Renderer;` (learnopengl: `SpriteRenderer *Renderer`, skapad med `new` i `Init`).
:::
:::vulkan
```cpp
struct SpriteRenderer {
    // render state
    VkPipeline       pipeline = VK_NULL_HANDLE;
    VkPipelineLayout pipelineLayout = VK_NULL_HANDLE;
    VkBuffer         quadBuffer = VK_NULL_HANDLE;
    VkDeviceMemory   quadBufferMemory = VK_NULL_HANDLE;
    VkCommandBuffer  commandBuffer = VK_NULL_HANDLE; // the command buffer being recorded this frame
};
```

och den globala `SpriteRenderer Renderer;` (learnopengl: `SpriteRenderer *Renderer`, skapad med `new` i `Init`).
learnopengls shader är pipelinen (och dess layout, som `vkCmdPushConstants` och `vkCmdBindDescriptorSets` behöver), dess
VAO rektangelns vertex buffer. Och det finns en medlem till: **command buffern som spelas in**. I OpenGL kan
`DrawSprite` rita varifrån som helst, eftersom kontexten är global. I Vulkan är ett ritanrop ett kommando som spelas in i
en command buffer, och `DrawSprite` – anropad av `Render`, anropad av `recordCommandBuffer` – måste veta vilken. I
stället för att lägga till en parameter i varje funktion i spelet lämnar `recordCommandBuffer()` den till renderaren
innan den anropar `Render`:

```cpp
        // the game's draws go into this command buffer
        Renderer.commandBuffer = commandBuffer;
        Render(Hedgerow);
```

så att `DrawSprite` och de senare `DrawObject` och `DrawLevel` behåller learnopengls parametrar.
:::
:::d3d12
```cpp
struct SpriteRenderer
{
    // render state
    Shader                   shader;
    ComPtr<ID3D12Resource>   quadVertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW quadVertexBufferView = {};
};
```

och den globala `SpriteRenderer Renderer;` (learnopengl: `SpriteRenderer *Renderer`, skapad med `new` i `Init`).
learnopengls shader är pipeline state objectet, dess VAO rektangelns vertex buffer och dess vy. Ritanropen hamnar i
`Graphics.CommandList`, den enda command listen, så `DrawSprite` behåller learnopengls parametrar.
:::

### Initiering

learnopengls konstruktor för sprite-renderaren anropar `initRenderData`, som konfigurerar rektangelns vertexdata;
kursens `InitRenderData` anropas i `Init` efter att shadern har laddats:

:::opengl
```cpp
void InitRenderData(SpriteRenderer& renderer)
{
    // configure VAO/VBO
    unsigned int VBO;
    float vertices[] = {
        // pos      // tex
        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 0.0f,

        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 1.0f, 1.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f
    };

    glGenVertexArrays(1, &renderer.quadVAO);
    glGenBuffers(1, &VBO);

    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    glBindVertexArray(renderer.quadVAO);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindVertexArray(0);
}
```

I `Init`:

```cpp
    // set render-specific controls
    Renderer.shader = GetShader("sprite");
    InitRenderData(Renderer);
```

och i slutet av `main`, efter `ClearResources();`, `glDeleteVertexArrays(1, &Renderer.quadVAO);` (learnopengl tar bort
den i renderarens destruktor).
:::
:::vulkan
```cpp
    void InitRenderData(SpriteRenderer& renderer) {
        // the quad: (0, 0) is the sprite's top-left corner, (1, 1) its bottom-right, in position and texture coordinates
        const std::vector<Vertex> vertices = {
            // pos      // tex
            {{0.0f, 1.0f, 0.0f, 1.0f}},
            {{1.0f, 0.0f, 1.0f, 0.0f}},
            {{0.0f, 0.0f, 0.0f, 0.0f}},

            {{0.0f, 1.0f, 0.0f, 1.0f}},
            {{1.0f, 1.0f, 1.0f, 1.0f}},
            {{1.0f, 0.0f, 1.0f, 0.0f}}
        };
        VkDeviceSize bufferSize = sizeof(vertices[0]) * vertices.size();

        createBuffer(bufferSize, VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, renderer.quadBuffer, renderer.quadBufferMemory);

        void* data;
        vkMapMemory(device, renderer.quadBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, vertices.data(), (size_t) bufferSize);
        vkUnmapMemory(device, renderer.quadBufferMemory);
    }
```

En medlemsfunktion, eftersom den skapar en buffer med enheten. Vertexen är projektets `Vertex { glm::vec4 vertex; }`,
attribut 0 med formatet `VK_FORMAT_R32G32B32A32_SFLOAT` – learnopengls `glVertexAttribPointer(0, 4, …)`. Sex vertex som
aldrig ändras skulle också kunna ligga i device-local-minne bakom en staging buffer; host-visible-minne är enklare och
gott och väl snabbt nog för 96 byte. I `Init`:

```cpp
        // set render-specific controls
        Renderer.pipeline = GetShader("sprite");
        Renderer.pipelineLayout = pipelineLayout;
        InitRenderData(Renderer);
```

och i `cleanup()`, efter `ClearResources();`, `vkDestroyBuffer` och `vkFreeMemory` för rektangelns buffer.
:::
:::d3d12
```cpp
void InitRenderData(SpriteRenderer& renderer)
{
    // the unit quad: two triangles with the corners (0, 0) to (1, 1) and their texture
    // coordinates (v = 0 is the image's top row, and y = 0 is the window's top)
    float vertices[] = {
        // pos      // tex
        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 0.0f,

        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 1.0f, 1.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f
    };
```

följt av en vertex buffer i en upload heap som i de tidigare kapitlen – `CreateCommittedResource` till
`renderer.quadVertexBuffer`, `Map`, `memcpy`, `Unmap` – och dess vy med `StrideInBytes = 4 * sizeof(float)`. I `Init`:

```cpp
    // set render-specific controls
    Renderer.shader = GetShader("sprite");
    InitRenderData(Renderer);
```

och i `OnDestroy`, efter `ClearResources();`, `Renderer = SpriteRenderer();` – tilldelningen frigör bufferns `ComPtr`
(learnopengl tar bort VAO:n i renderarens destruktor).
:::

Här definierar vi först en uppsättning vertex där (0, 0) är rektangelns övre vänstra hörn. Det betyder att när vi
förflyttar eller skalar rektangeln sker det från rektangelns övre vänstra hörn. Det är allmänt vedertaget i 2D-grafik
och/eller GUI-system, där elementens positioner motsvarar elementens övre vänstra hörn. Texturkoordinaterna är samma
tal: rektangelns övre vänstra hörn får bildens övre vänstra texel, det nedre högra hörnet dess nedre högra – därför
behöver bilderna inte vändas med den här projektionen.

Gör nu uppgiften **sprite-renderer**: structen, `InitRenderData`, den globala `Renderer`, dess inställning i `Init` och
dess städning i slutet.
:::vulkan
Ge den också command buffern i `recordCommandBuffer()`, som visas ovan.
:::
Kör programmet: fortfarande svart – rektangeln finns, men ingenting ritar den.

### Rendering

Att rendera sprites är inte så svårt; vi använder sprite-renderarens shader, ställer in en modellmatris och sätter de
relevanta uniforms. Det som är viktigt här är ordningen på transformationerna:

:::opengl
```cpp
void DrawSprite(SpriteRenderer& renderer, unsigned int texture, glm::vec2 position, glm::vec2 size = glm::vec2(10.0f, 10.0f), float rotate = 0.0f, glm::vec3 color = glm::vec3(1.0f))
{
    // prepare transformations
    Use(renderer.shader);
    glm::mat4 model = glm::mat4(1.0f);
    model = glm::translate(model, glm::vec3(position, 0.0f));  // first translate (transformations are: scale happens first, then rotation, and then final translation happens; reversed order)

    model = glm::translate(model, glm::vec3(0.5f * size.x, 0.5f * size.y, 0.0f)); // move origin of rotation to center of quad
    model = glm::rotate(model, glm::radians(rotate), glm::vec3(0.0f, 0.0f, 1.0f)); // then rotate
    model = glm::translate(model, glm::vec3(-0.5f * size.x, -0.5f * size.y, 0.0f)); // move origin back

    model = glm::scale(model, glm::vec3(size, 1.0f)); // last scale

    SetMatrix4(renderer.shader, "model", model);

    // render textured quad
    SetVector3f(renderer.shader, "spriteColor", color);

    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, texture);

    glBindVertexArray(renderer.quadVAO);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    glBindVertexArray(0);
}
```

learnopengl skickar en `Texture2D` och anropar dess `Bind()`; kursen skickar texturens ID, som nästa kapitels
spelobjekt sparar som sin sprite.
:::
:::vulkan
```cpp
void DrawSprite(SpriteRenderer& renderer, VkDescriptorSet texture, glm::vec2 position, glm::vec2 size = glm::vec2(10.0f, 10.0f), float rotate = 0.0f, glm::vec3 color = glm::vec3(1.0f)) {
    vkCmdBindPipeline(renderer.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, renderer.pipeline);

    // prepare transformations
    glm::mat4 model = glm::mat4(1.0f);
    model = glm::translate(model, glm::vec3(position, 0.0f));  // first translate (transformations are: scale happens first, then rotation, and then final translation happens; reversed order)

    model = glm::translate(model, glm::vec3(0.5f * size.x, 0.5f * size.y, 0.0f)); // move origin of rotation to center of quad
    model = glm::rotate(model, glm::radians(rotate), glm::vec3(0.0f, 0.0f, 1.0f)); // then rotate
    model = glm::translate(model, glm::vec3(-0.5f * size.x, -0.5f * size.y, 0.0f)); // move origin back

    model = glm::scale(model, glm::vec3(size, 1.0f)); // last scale

    PushConstants constants{};
    constants.model = model;

    // render textured quad
    constants.spriteColor = color;
    vkCmdPushConstants(renderer.commandBuffer, renderer.pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);

    vkCmdBindDescriptorSets(renderer.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, renderer.pipelineLayout, 0, 1, &texture, 0, nullptr);

    VkBuffer vertexBuffers[] = {renderer.quadBuffer};
    VkDeviceSize offsets[] = {0};
    vkCmdBindVertexBuffers(renderer.commandBuffer, 0, 1, vertexBuffers, offsets);
    vkCmdDraw(renderer.commandBuffer, 6, 1, 0, 0);
}
```

Varje OpenGL-anrop hos learnopengl har sitt kommando: `shader.Use()` är `vkCmdBindPipeline`, de två uniforms är ett
`vkCmdPushConstants`, `texture.Bind()` är `vkCmdBindDescriptorSets` med texturens descriptor set – texturen skickas som
den seten, som är det ett ritanrop binder –, VAO:n är `vkCmdBindVertexBuffers`, och `glDrawArrays` är `vkCmdDraw`. Push
constants spelas in i command buffern med varje ritanrop, så varje sprite i en bildruta får sin egen matris och färg
fast GPU:n kör dem alla senare.
:::
:::d3d12
```cpp
void DrawSprite(SpriteRenderer& renderer, unsigned int texture, XMFLOAT2 position, XMFLOAT2 size = XMFLOAT2(10.0f, 10.0f), float rotate = 0.0f, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f))
{
    // prepare transformations (DirectXMath applies the matrices from left to right: first
    // scale, then rotation, and then final translation happens - learnopengl's reversed order)
    XMMATRIX model = XMMatrixScaling(size.x, size.y, 1.0f); // first scale

    model = model * XMMatrixTranslation(-0.5f * size.x, -0.5f * size.y, 0.0f);   // move origin of rotation to center of quad
    model = model * XMMatrixRotationZ(XMConvertToRadians(rotate));             // then rotate
    model = model * XMMatrixTranslation(0.5f * size.x, 0.5f * size.y, 0.0f);     // move origin back

    model = model * XMMatrixTranslation(position.x, position.y, 0.0f); // last translate

    SpriteConstants constants = {};
    XMStoreFloat4x4(&constants.model, XMMatrixTranspose(model));
    constants.spriteColor = color;

    // render textured quad: the shader, its root constants (root parameter 0) and the
    // texture's view (root parameter 2)
    Use(renderer.shader);
    Graphics.CommandList->SetGraphicsRoot32BitConstants(0, sizeof(SpriteConstants) / 4, &constants, 0);
    CD3DX12_GPU_DESCRIPTOR_HANDLE textureHandle(Graphics.SrvHeap->GetGPUDescriptorHandleForHeapStart(), texture, Graphics.SrvDescriptorSize);
    Graphics.CommandList->SetGraphicsRootDescriptorTable(2, textureHandle);

    Graphics.CommandList->IASetVertexBuffers(0, 1, &renderer.quadVertexBufferView);
    Graphics.CommandList->DrawInstanced(6, 1, 0, 0);
}
```

Varje OpenGL-anrop hos learnopengl har sitt kommando: `shader.Use()` är `SetPipelineState` (i `Use`), de två uniforms är
ett `SetGraphicsRoot32BitConstants`, `texture.Bind()` är `SetGraphicsRootDescriptorTable(2, …)` med ett handtag till
texturens vy – texturen skickas som sin plats i heapen –, VAO:n är `IASetVertexBuffers`, och `glDrawArrays` är
`DrawInstanced`. Root constants spelas in i command listen med varje ritanrop, så varje sprite i en bildruta får sin
egen matris och färg fast GPU:n kör dem alla senare.
:::

När man vill placera objekt någonstans i en scen med rotation och skalning rekommenderas det att först skala, sedan
rotera och till sist förflytta objektet. Eftersom matrismultiplikation sker från höger till vänster transformerar vi
matrisen i omvänd ordning: förflytta, rotera och sedan skala.

Rotationen kan fortfarande verka lite avskräckande. Vi vet från kapitlet Transformationer att rotationer alltid sker
kring origo (0, 0). Eftersom vi angav rektangelns vertex med (0, 0) som övre vänstra koordinat roterar alla rotationer
kring den punkten (0, 0). *Rotationens origo* ligger i rektangelns övre vänstra hörn, vilket ger oönskade resultat. Det
vi vill är att flytta rotationens origo till rektangelns mitt så att rektangeln snyggt roterar kring den, i stället för
kring sitt övre vänstra hörn. Det löser vi genom att först förflytta rektangeln med halva dess storlek, så att dess mitt
ligger på koordinaten (0, 0) före rotationen.

Eftersom vi först skalar rektangeln måste vi ta hänsyn till spritens storlek när vi förflyttar till dess mitt (därför
multiplicerar vi med spritens storlek). När rotationen är gjord tar vi tillbaka den förra förflyttningen. Läst i den
ordning transformationerna sker med ett hörn av enhetsrektangeln:

1. **skala** till `size` – rektangeln sträcker sig nu från (0, 0) till (size.x, size.y);
2. **förflytta med -0.5 · size** – dess mitt ligger i origo;
3. **rotera** kring z med `rotate` grader – kring sin mitt;
4. **förflytta med +0.5 · size** – tillbaka till (0, 0) … size, fortfarande vriden;
5. **förflytta till `position`** – den oroterade spritens övre vänstra hörn hamnar på `position`.

:::opengl vulkan
I koden skrivs de i omvänd ordning, eftersom glm multiplicerar varje ny matris till höger om `model`, och matrisen som
skrivs sist är den första som berör vertexen (`projection * model * vertex`).
:::
:::d3d12
DirectXMath multiplicerar *radvektorer* från vänster (`mul(position, model)` i HLSL), så matriserna kombineras i den
ordning de sker – skalning först, förflyttning sist, `model = model * …` varje gång. Det är learnopengls lista skriven
framlänges i stället för baklänges; resultatet är samma matris, transponerad när den sparas för shadern.
:::

Genom att kombinera alla dessa transformationer kan vi placera, skala och rotera varje sprite som vi vill.

En positiv vinkel vrider spriten **medurs på skärmen**. `rotate` kring +z vrider x-axeln mot y-axeln – moturs i den
vanliga ritningen av ett koordinatsystem med y uppåt. Men spelets y-axel pekar *nedåt*, så att vrida x mot y betyder att
vrida åt höger-och-sedan-nedåt: medurs.

```quiz
Varför förflyttar `DrawSprite` med halva storleken, roterar och förflyttar tillbaka, i stället för att bara rotera?
- [ ] Därför att en rotation alltid måste vara den första transformationen i en modellmatris
- [ ] Därför att projektionen annars skulle spegla spriten
- [ ] Därför att en skalad rektangel som roteras utan dem skulle få förvrängd form
- [x] Därför att en rotation vrider kring origo, som är rektangelns övre vänstra hörn: förflyttningarna flyttar mitten till origo för rotationen och tillbaka igen, så att spriten vrider sig på stället
---
Utan dem skulle en sprite på (200, 200) som vrids 45° svänga runt sitt övre vänstra hörn och hamna halvvägs utanför sin plats. Förflyttningarna med ±0.5 · size är i pixlar eftersom rektangeln redan har skalats till sin storlek.
```

:::opengl
```quiz
I koden byggs modellmatrisen som `translate(position)`, rotationsraderna och `scale(size)` sist. I vilken ordning tillämpas transformationerna på en vertex?
- [x] Skalning först, sedan rotationen kring mitten, sedan förflyttningen till `position` – omvänt mot ordningen i koden
- [ ] Förflyttning först, sedan rotation, sedan skalning – ordningen i koden
- [ ] Alla samtidigt, så ordningen spelar ingen roll
- [ ] Rotation först, eftersom rotationer alltid tillämpas före skalning
---
Varje `glm::translate/rotate/scale(model, …)` multiplicerar den nya matrisen till höger om `model`, och i `projection * model * vertex` tillämpas matrisen närmast vertexen först – den som skrivs sist.
```
:::
:::vulkan
```quiz
`DrawSprite` skickar modellmatrisen och färgen med `vkCmdPushConstants` före varje ritanrop. Varför får alla sprites i en bildruta sina egna värden, fast GPU:n kör ritanropen först efter att command buffern har skickats iväg?
- [ ] Därför att `vkCmdPushConstants` skriver till uniform buffern, och varje sprite har sin egen del av den
- [ ] Det gör de inte: varje sprite i bildrutan får värdena från den sista pushen
- [x] Därför att push constant-värdena kopieras in i command buffern när kommandot spelas in; varje ritanrop använder värdena som pushades före det
- [ ] Därför att pipelinen binds igen för varje sprite
---
Det är skillnaden mot att skriva om en uniform buffer mellan ritanropen, som skulle ha problemet från kapitlet Textrendering: alla ritanrop skulle se de sista värdena. Push constants är gjorda för små värden som ändras från ritanrop till ritanrop.
```
:::
:::d3d12
```quiz
Varför kombinerar Direct3D 12-versionens `DrawSprite` sina matriser i ordningen skala, förflytta, rotera, förflytta, förflytta – omvänt mot ordningen i learnopengls kod?
- [ ] Därför att `XMMatrixRotationZ` vrider åt andra hållet än `glm::rotate`
- [ ] Därför att Direct3D:s y-axel pekar nedåt
- [ ] Därför att matrisen transponeras när den sparas
- [x] Därför att DirectXMath multiplicerar radvektorer från vänster (`mul(position, model)`), så matrisen som skrivs först tillämpas först: kodens ordning är den ordning sakerna sker i
---
glm (och GLSL) multiplicerar kolumnvektorer från höger, så matrisen som skrivs sist berör vertexen först. Båda programmen bygger samma transformation; transponeringen när den sparas gör om DirectXMaths radvektormatris till HLSL:s kolumnvisa packning.
```
:::

## Hej sprite

Med sprite-renderaren kan vi rita en sprite på två rader. learnopengl ritar sin egen ansiktstextur här; kursen ritar
**sin boll** – `textures/ball.png`, en ljusgrön boll på genomskinlig bakgrund, 128 × 128 pixlar – med exakt learnopengls
tal: på (200, 200), 300 × 400 pixlar, vriden 45°, tonad grön. I `Init`:

:::opengl
```cpp
    // load textures
    LoadTexture("textures/ball.png", true, "ball");
```

(med alfa: bollens hörn är genomskinliga), och i `Render`:

```cpp
    DrawSprite(Renderer, GetTexture("ball").ID, glm::vec2(200.0f, 200.0f), glm::vec2(300.0f, 400.0f), 45.0f, glm::vec3(0.0f, 1.0f, 0.0f));
```
:::
:::vulkan
```cpp
        // load textures
        LoadTexture("textures/ball.png", "ball");
```

och i `Render`:

```cpp
    DrawSprite(Renderer, GetTexture("ball").DescriptorSet, glm::vec2(200.0f, 200.0f), glm::vec2(300.0f, 400.0f), 45.0f, glm::vec3(0.0f, 1.0f, 0.0f));
```
:::
:::d3d12
```cpp
    // load textures
    LoadTexture("textures/ball.png", true, "ball");
```

(med alfa: bollens hörn är genomskinliga), och i `Render`:

```cpp
    DrawSprite(Renderer, GetTexture("ball").ID, XMFLOAT2(200.0f, 200.0f), XMFLOAT2(300.0f, 400.0f), 45.0f, XMFLOAT3(0.0f, 1.0f, 0.0f));
```
:::

Gör nu uppgiften **draw-sprite**: `DrawSprite` – för tillfället bara med förflyttningen och skalningen; rotationsraderna
är nästa uppgift –, texturen och anropet. Bygg och kör: **den gröna bollen, utdragen till en upprätt ellips**, 300
pixlar bred och 400 hög, från (200, 200) till (500, 600). Den är bara grön: bollens egna färger gånger (0, 1, 0)
behåller bara den gröna kanalen. Dess genomskinliga hörn syns inte – blending, påslagen i förra kapitlet. De 45° skickas
med men används inte ännu.

Gör nu uppgiften **rotate**: de tre raderna mellan förflyttningen och skalningen. Bygg och kör: ellipsen är **vriden 45°
medurs kring sin mitt (350, 400)** – dess långa axel går nu från nere till vänster till uppe till höger. Det är
learnopengls bild med kursens boll.

```quiz
Spriten ritas på `position` (200, 200) med `size` (300, 400). Var ligger dess mitt, punkten den roterar kring?
- [ ] På (200, 200)
- [ ] På (150, 200)
- [x] På (350, 400): `position` är den oroterade spritens övre vänstra hörn, och mitten ligger halva storleken längre bort
- [ ] På (400, 300), fönstrets mitt
---
(200 + 300 / 2, 200 + 400 / 2) = (350, 400). Att vrida kring mitten håller den kvar där, så den vridna ellipsen ligger där den upprätta låg.
```

## Mer att läsa

- [Rendering Sprites](https://learnopengl.com/In-Practice/2D-Game/Rendering-Sprites): learnopengls kapitel som det här
  kapitlet följer.
- [Transformations](https://learnopengl.com/Getting-started/Transformations): varför matriserna kombineras i omvänd
  ordning.

:::vulkan
- [Push constants (Vulkan Guide)](https://docs.vulkan.org/guide/latest/push_constants.html): spritens matris och färg.
:::
:::d3d12
- [XMMatrixOrthographicOffCenterRH](https://learn.microsoft.com/en-us/windows/win32/api/directxmath/nf-directxmath-xmmatrixorthographicoffcenterrh):
  projektionen.
- [Using constants directly in the root signature](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-constants-directly-in-the-root-signature):
  spritens matris och färg.
:::
