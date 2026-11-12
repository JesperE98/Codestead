# Färger

Vi har kort använt och manipulerat färger i de tidigare kapitlen, men aldrig definierat dem ordentligt. Här går vi
igenom vad färger är och börjar bygga scenen för de kommande kapitlen om *Lighting*.

I den verkliga världen kan färger anta vilket färgvärde som helst, och varje objekt har sin egen färg eller sina egna
färger. I den digitala världen måste vi avbilda de (oändligt många) verkliga färgerna på (ett begränsat antal)
digitala värden, och därför kan inte alla verkliga färger representeras digitalt. Färger representeras digitalt med en
*röd*, en *grön* och en *blå* komponent, vanligen förkortat *RGB*. Med olika kombinationer av bara de tre värdena,
inom intervallet [0, 1], kan vi representera nästan vilken färg som helst. För att till exempel få en *korall*färg
definierar vi en färgvektor så här:

:::opengl vulkan
```cpp
glm::vec3 coral(1.0f, 0.5f, 0.31f);
```
:::
:::d3d12
```cpp
XMFLOAT3 coral(1.0f, 0.5f, 0.31f);
```
:::

Färgen vi ser hos ett objekt i verkligheten är inte den färg det faktiskt har, utan den färg som *reflekteras* från
objektet. De färger som inte absorberas (som stöts bort) av objektet är den färg vi uppfattar. Ett exempel: solljuset
uppfattas som ett vitt ljus som är den sammanlagda summan av många olika färger. Om vi lyser med det vita ljuset på en
blå leksak absorberar den alla det vita ljusets delfärger utom den blå. Eftersom leksaken inte absorberar den blå
delen reflekteras den. Det reflekterade ljuset når vårt öga, och leksaken ser blå ut. En korallfärgad leksak fungerar
likadant: den reflekterar allt rött, ungefär hälften av det gröna och en tredjedel av det blå som träffar den, och
absorberar resten.

Det vita solljuset är alltså en samling av alla synliga färger, och objektet absorberar en stor del av dem. Det
reflekterar bara de färger som utgör objektets färg, och kombinationen av dem är det vi uppfattar.

Samma regler för färgreflektion gäller direkt i grafikens värld. När vi definierar en ljuskälla i {{api}} vill vi ge
den en färg. I förra stycket hade vi vitt ljus, så vi ger ljuskällan en vit färg också. Om vi sedan multiplicerar
ljuskällans färg med ett objekts färgvärde blir resultatet objektets reflekterade färg (och alltså den färg vi
uppfattar). Låt oss återvända till leksaken (den här gången med ett korallvärde) och se hur vi räknar ut dess
uppfattade färg i grafikens värld. Vi får den resulterande färgvektorn genom att multiplicera ljusets och objektets
färgvektorer komponent för komponent:

:::opengl vulkan
```cpp
glm::vec3 lightColor(1.0f, 1.0f, 1.0f);
glm::vec3 toyColor(1.0f, 0.5f, 0.31f);
glm::vec3 result = lightColor * toyColor; // = (1.0f, 0.5f, 0.31f);
```

GLM:s `*` mellan två vektorer multiplicerar dem komponent för komponent, precis som `*` mellan två `vec3` i GLSL.
:::
:::d3d12
```cpp
XMVECTOR lightColor = XMVectorSet(1.0f, 1.0f, 1.0f, 0.0f);
XMVECTOR toyColor = XMVectorSet(1.0f, 0.5f, 0.31f, 0.0f);
XMVECTOR result = lightColor * toyColor; // = (1.0f, 0.5f, 0.31f);
```

DirectXMath:s `*` mellan två `XMVECTOR` är `XMVectorMultiply`: en produkt komponent för komponent. HLSL gör likadant
med `*` mellan två `float3` – en *matris*produkt (eller skalärprodukt) skrivs alltid med `mul` (eller `dot`).
:::

Vi ser att leksakens färg *absorberar* en stor del av det vita ljuset, men reflekterar en del rött, grönt och blått
utifrån sitt eget färgvärde. Det är en modell av hur färger fungerar i verkligheten. Vi kan alltså definiera ett
objekts färg som *hur mycket av varje färgkomponent det reflekterar från en ljuskälla*. Vad händer då om vi använder
ett grönt ljus?

:::opengl vulkan
```cpp
glm::vec3 lightColor(0.0f, 1.0f, 0.0f);
glm::vec3 toyColor(1.0f, 0.5f, 0.31f);
glm::vec3 result = lightColor * toyColor; // = (0.0f, 0.5f, 0.0f);
```
:::
:::d3d12
```cpp
XMVECTOR lightColor = XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f);
XMVECTOR toyColor = XMVectorSet(1.0f, 0.5f, 0.31f, 0.0f);
XMVECTOR result = lightColor * toyColor; // = (0.0f, 0.5f, 0.0f);
```
:::

Som vi ser finns det inget rött eller blått ljus för leksaken att absorbera eller reflektera. Leksaken absorberar
hälften av ljusets gröna värde, men reflekterar också hälften. Färgen vi uppfattar blir då mörkt grönaktig. Med grönt
ljus kan bara de gröna färgkomponenterna reflekteras och alltså uppfattas; inga röda eller blå färger uppfattas.
Resultatet är att korallobjektet plötsligt blir ett mörkt grönaktigt objekt. Låt oss prova ett exempel till, med ett
mörkt olivgrönt ljus:

:::opengl vulkan
```cpp
glm::vec3 lightColor(0.33f, 0.42f, 0.18f);
glm::vec3 toyColor(1.0f, 0.5f, 0.31f);
glm::vec3 result = lightColor * toyColor; // = (0.33f, 0.21f, 0.06f);
```
:::
:::d3d12
```cpp
XMVECTOR lightColor = XMVectorSet(0.33f, 0.42f, 0.18f, 0.0f);
XMVECTOR toyColor = XMVectorSet(1.0f, 0.5f, 0.31f, 0.0f);
XMVECTOR result = lightColor * toyColor; // = (0.33f, 0.21f, 0.06f);
```
:::

Som du ser kan vi få intressanta färger på objekt genom att använda olika ljusfärger. Det är inte svårt att vara
kreativ med färger.

```quiz
Ett korallfärgat objekt (1.0, 0.5, 0.31) belyses av ett rent blått ljus (0.0, 0.0, 1.0). Vilken färg ser vi?
- [ ] (1.0, 0.5, 1.0) – ljusets blå läggs till objektets färg
- [x] (0.0, 0.0, 0.31) – ett mycket mörkt blått: objektet reflekterar bara 31 % av det blå det tar emot, och det finns inget rött eller grönt att reflektera
- [ ] (0.0, 0.0, 1.0) – objektet antar ljusets färg
---
Den reflekterade färgen är komponentvis produkt av ljusets färg och objektets färg: (0 · 1.0, 0 · 0.5, 1.0 · 0.31). En färg som ljuset inte innehåller kan inte reflekteras, hur starkt objektet än skulle reflektera den.
```

Men nog om färger nu – låt oss börja bygga en scen som vi kan experimentera i.

## En belysningsscen

I de kommande kapitlen skapar vi intressanta bilder genom att simulera verklig belysning, och vi använder färger
flitigt. Eftersom vi från och med nu använder ljuskällor vill vi visa dem som synliga objekt i scenen, och lägga till
minst ett objekt att simulera belysningen på.

Det första vi behöver är ett objekt att lysa på, och vi tar den ökända lådkuben från de tidigare kapitlen. Vi behöver
också ett ljusobjekt som visar var ljuskällan finns i 3D-scenen. För enkelhetens skull representerar vi ljuskällan
med en kub också.

### Projektet

Det här kapitlets projekt är redan förberett för det. Det är resultatet från *Camera*, nedbantat till det som
belysningskapitlen börjar med: **en kub i origo**, byggd av samma 36 hörn som förut men med **bara positioner** –
inga texturkoordinater och inga texturer längre, eftersom vi vill se kubens färg, inte en bild. Rensningsfärgen är en
mörkgrå, (0.1, 0.1, 0.1), som i alla learnopengl:s belysningskapitel, så att lampan syns tydligt. Den fria kameran från
förra kapitlet, med W/A/S/D, mustittande och zoom, finns kvar.

:::opengl
Filerna är `main.cpp`, `shader_m.h`, `colors.vs` och `colors.fs` (shaders för den belysta kuben) samt `light_cube.vs`
och `light_cube.fs` (lampans shaders – mer om dem nedan). learnopengl numrerar sina shaderfiler per kapitel
(`1.colors.vs`); kursen hoppar över numren.

Hörnfältet har nu 3 floats per hörn, så positionsattributet har steget (stride) `3 * sizeof(float)`:

```cpp
    // first, configure the cube's VAO (and VBO)
    unsigned int VBO, cubeVAO;
    glGenVertexArrays(1, &cubeVAO);
    glGenBuffers(1, &VBO);

    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    glBindVertexArray(cubeVAO);

    // position attribute
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
```

Kubens vertex shader är den från de tidigare kapitlen, utan texturkoordinaterna:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main()
{
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

Programmet byggs med `Shader lightingShader("colors.vs", "colors.fs");`, och renderloopen sätter `projection`, `view`
och en enhetsmatris som `model` på det innan den ritar de 36 hörnen med `cubeVAO`.
:::
:::vulkan
Shaderfilerna är `shaders/colors.vert` och `shaders/colors.frag` (den belysta kuben) samt `shaders/light_cube.vert` och
`shaders/light_cube.frag` (lampan – mer om dem nedan).

:::ide clion vscode
Din `CMakeLists.txt` kompilerar var och en till SPIR-V, `shaders/<namn>.vert.spv` och `shaders/<namn>.frag.spv`. Den
kompilerar varje shader den hittar i `shaders/`, så nya shaderfiler kräver ingen ändring i den.
:::
:::ide vs rider
Pre-build-händelsen i ditt projekt kompilerar var och en till SPIR-V, `shaders\<namn>.vert.spv` och
`shaders\<namn>.frag.spv`. Den kompilerar varje shader den hittar i `shaders\`, så nya shaderfiler kräver ingen ändring
i den.
:::

Som förut ligger vy- och projektionsmatriserna i uniform
buffern (fortfarande på **binding 2** – bindings 0 och 1 höll texturerna och kommer tillbaka med lighting maps), som
`updateUniformBuffer()` fyller i varje bildruta, och modellmatrisen är en push constant. `Vertex`-structen innehåller
bara en `glm::vec3 pos`, och `getAttributeDescriptions()` beskriver det enda attributet.

Eftersom det här kapitlet behöver **två** grafikpipelines – en för kuben, en för lampan – har den gamla
`createGraphicsPipeline()` delats i två:

- `createPipelineLayout()` skapar pipeline layouten – descriptor set layouten och push constant-intervallet – en gång.
  Alla pipelines använder den.
- `createPipeline(vertShaderFile, fragShaderFile, attributeCount, pipeline)` skapar en grafikpipeline från en vertex
  shader och en fragment shader, med allt fixed-function-tillstånd från förut (ingen culling, djuptest på, dynamisk
  viewport och scissor):

```cpp
    // One graphics pipeline from a vertex and a fragment shader. All pipelines share the vertex buffer, the fixed
    // functions and the pipeline layout (descriptor set + push constants); they differ in their shaders and in how
    // many of the Vertex's attributes (in the order of getAttributeDescriptions) their vertex shader reads.
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, uint32_t attributeCount, VkPipeline& pipeline) {
```

`attributeCount` blir `vertexAttributeDescriptionCount` – pipelinen beskriver bara de första `attributeCount`
attributen i `getAttributeDescriptions()`. I dag har varje hörn bara en position, så värdet är 1; i nästa kapitel får
hörnen ett andra attribut som bara den ena pipelinen läser. `initVulkan()` skapar kubens pipeline så här:

```cpp
        createPipelineLayout();
        createPipeline("shaders/colors.vert.spv", "shaders/colors.frag.spv", 1, lightingPipeline);
```

`recordCommandBuffer()` binder `lightingPipeline`, skickar `model = glm::mat4(1.0f)` som push constant och ritar de 36
hörnen.
:::
:::d3d12
Filerna är `main.cpp`, `colors.hlsl` (shaders för den belysta kuben: `VSMain` och `PSMain`) och `light_cube.hlsl`
(lampans shaders – mer om dem nedan). `Vertex`-structen innehåller bara en `XMFLOAT3 position`, och input layouten har
bara elementet `POSITION`.

När texturerna försvann blev root signaturen mindre, och dess parametrar flyttade ner ett steg:

- **root parameter 0**: de 16 root constants i `ModelConstants` (register b0) – modellmatrisen, för vertex shadern;
- **root parameter 1**: en descriptor table med constant bufferns CBV (register b1) – vy och projektion.

CBV/SRV-heapen innehåller nu bara CBV:n. Constant bufferns struct, `SceneConstantBuffer`, växer i varje
belysningskapitel, så buffern och dess CBV storleksätts inte längre med ett utfyllnadsfält och en `static_assert`: de
får `CalculateConstantBufferByteSize(sizeof(SceneConstantBuffer))` byte – storleken avrundad uppåt till närmaste
multipel av 256 byte (`D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT`), samma hjälpfunktion som i DXSampleHelper.h i
Microsofts exempel:

```cpp
// The size of a constant buffer view must be a multiple of 256 bytes
// (D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT): rounds a size up to the next multiple.
inline UINT CalculateConstantBufferByteSize(UINT byteSize)
{
    return (byteSize + (D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT - 1)) & ~(D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT - 1);
}
```

Kubens vertex shader är den från de tidigare kapitlen, utan texturkoordinaterna:

```hlsl
// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION)
{
    PSInput result;

    // The position is a row vector, multiplied by the matrices from left to right:
    // model, then view, then projection (GLSL: projection * view * model * position).
    result.position = mul(mul(mul(position, model), view), projection);

    return result;
}
```

I `LoadAssets` ligger de två `D3DCompileFromFile`-anropen för `colors.hlsl` och beskrivningen av pipeline state i ett
och samma block, med `compileFlags` överst, så att ett andra pipeline state kan återanvända båda senare i kapitlet.
`PopulateCommandList` sätter kubens modellmatris (`XMMatrixIdentity()`) som root constants och ritar de 36 hörnen.
:::

Projektets `// TODO:`-kommentarer visar var din kod ska in. Bygg och kör programmet när som helst. I början ser du en
platt **vit** kub mot den mörkgrå bakgrunden – kubens fragment shader skriver fortfarande bara vitt.

### Standardkameran

Det finns en ändring till av kameran: var den börjar. learnopengl:s belysningskapitel placerar ljuskällan i
(1.2, 1.0, 2.0) – framför kuben, till höger om och ovanför den. En kamera i (0, 0, 3) som tittar längs -z kan inte se
den punkten: lampan är bara en enhet framför kameran men 1.2 enheter åt sidan, ungefär 50° från siktlinjen, medan
synfältet på 45° i ett fönster på 800×600 bara når ungefär 29° åt varje sida. (I learnopengl:s skärmbilder har
författaren helt enkelt flugit kameran någon annanstans först.)

Kursen låter därför varje kamera i de första belysningskapitlen börja **snett framför kuben från vänster**, och titta
på den lite ovanifrån:

:::opengl vulkan
```cpp
// camera: look at the cube's lit front and the lamp from the left
glm::vec3 cameraPos   = glm::vec3(-3.0f, 0.0f,  3.0f);
glm::vec3 cameraFront = glm::normalize(glm::vec3(3.5f, 0.4f, -2.2f));
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);

bool firstMouse = true;
float yaw   = -32.2f; // yaw and pitch (in degrees) of cameraFront, so the first mouse movement does not make the camera jump
float pitch =   5.5f;
```
:::
:::d3d12
```cpp
// camera: look at the cube's lit front and the lamp from the left
XMVECTOR cameraPos   = XMVectorSet(-3.0f, 0.0f, 3.0f, 0.0f);
XMVECTOR cameraFront = XMVector3Normalize(XMVectorSet(3.5f, 0.4f, -2.2f, 0.0f));
XMVECTOR cameraUp    = XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f);

// Which keys are held down, by virtual-key code ('W', VK_UP ...). WindowProc keeps it up to date.
bool keys[256] = {};

// Mouse look: the camera's direction as two angles, in degrees.
bool firstMouse = true;
float yaw   = -32.2f;    // yaw and pitch (in degrees) of cameraFront, so the first mouse movement does not make the camera jump
float pitch =   5.5f;
```
:::

Från (-3, 0, 3) ser kameran två av kubens sidor: dess **framsida** (den som är vänd mot +z, till höger i bilden) och
dess **vänstersida** (vänd mot -x), och lampan uppe till höger. Det är precis vad de kommande kapitlen behöver:
framsidan är vänd mot ljuset och vänstersidan bort från det, så att du kan jämföra en belyst och en obelyst sida, och i
nästa kapitel hamnar den blanka högdagern på framsidan, där den här kameran kan se den.

`yaw` och `pitch` är vinklarna för den här `cameraFront` (yaw för (3.5, 0.4, -2.2) är atan2(-2.2, 3.5) ≈ -32.2°,
pitch är asin(0.4 / 4.15) ≈ 5.5°). De måste stämma: den första musrörelsen räknar ut `cameraFront` från yaw och pitch,
och med de gamla värdena (-90°, 0°) skulle kameran hoppa tillbaka till att titta längs -z. *Colors*, *Basic Lighting*,
*Materials* och *Lighting Maps* behåller den här kameran; *Light Casters* och *Multiple Lights* går tillbaka till
(0, 0, 3).

> Bilderna **Förväntat resultat** kan inte trycka på tangenter eller flytta musen, så de visar alltid den här startvyn.
> I ditt eget program kan du fortfarande flyga runt i scenen som i förra kapitlet.

```quiz
Varför låter kursen kameran börja i (-3, 0, 3) i stället för learnopengl:s (0, 0, 3)?
- [ ] För att belysningsberäkningarna bara fungerar när kameran inte står på z-axeln
- [ ] För att lampan skulle vara dold bakom kuben från (0, 0, 3)
- [x] För att lampan i (1.2, 1.0, 2.0) ligger för långt åt sidan för en kamera i (0, 0, 3) – utanför synfältet – och snett framifrån från vänster syns både en sida vänd mot ljuset och en vänd bort från det
---
Sett från (0, 0, 3) ligger lampan 1 enhet framför men 1.2 enheter till höger: ungefär 50° från siktlinjen, långt utanför ett synfält på 45°. Inget i själva belysningen beror på var kameran står – det handlar bara om vad du får se.
```

### Objektets färg

Att fylla en vertex buffer, sätta attributpekare och allt det där bör vara bekant för dig vid det här laget, så vi går
inte igenom de stegen. Låt oss först titta på kubens fragment shader. Vi vill multiplicera ljusets färg med objektets
färg, precis som i första avsnittet. Båda färgerna kommer från programmet:

:::opengl
```glsl
#version 330 core
out vec4 FragColor;

uniform vec3 objectColor;
uniform vec3 lightColor;

void main()
{
    FragColor = vec4(lightColor * objectColor, 1.0);
}
```

Fragment shadern tar emot både en objektfärg och en ljusfärg via uniform-variabler. Här multiplicerar vi ljusets färg
med objektets (reflekterade) färg som vi diskuterade i början av kapitlet. Låt oss ge objektet vår korallfärg och
ljuset en vit färg, i renderloopen direkt efter att shadern har aktiverats:

```cpp
        // be sure to activate shader when setting uniforms/drawing objects
        lightingShader.use();
        lightingShader.setVec3("objectColor", 1.0f, 0.5f, 0.31f);
        lightingShader.setVec3("lightColor",  1.0f, 1.0f, 1.0f);
```

Ordningen spelar roll: `setVec3` anropar `glUniform3f`, som sätter en uniform i det program som *används just nu*.
:::
:::vulkan
I Vulkan-projektet är färgerna, liksom matriserna, värden som är desamma för varje ritanrop i en bildruta, så de hamnar
i uniform buffern. Fragment shadern deklarerar uniform-blocket – samma block som vertex shadern, nu med två medlemmar
till – och multiplicerar ljusets färg med objektets (reflekterade) färg som vi diskuterade i början av kapitlet:

```glsl
#version 450

layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 objectColor;
    vec3 lightColor;
} ubo;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(ubo.lightColor * ubo.objectColor, 1.0);
}
```

Vertex shaderna kan fortsätta att bara deklarera `view` och `proj`: en shader får deklarera bara de första medlemmarna
i ett block, så länge de ligger på samma offset.

C++-structen behöver samma två medlemmar, och här möter vi layoutreglerna för uniform-block. Ett uniform-block i en
Vulkan-shader använder layouten **std140**, där en `vec3` justeras som en `vec4`, till en multipel av 16 byte (se
*Alignment requirements* i vulkan-tutorials *Descriptor pool and sets*). `view` och `proj` upptar byte 0–127, så
`objectColor` börjar på 128 och tar 12 byte – men `lightColor` kan inte börja på 140; den börjar på nästa multipel av
16, 144. En `glm::vec3` i C++ är bara tre floats med justeringen 4, så utan hjälp skulle C++-structen lägga
`lightColor` på 140 och shadern läsa skräp. En `float` efter varje `glm::vec3` fyller ut luckan:

```cpp
// The same layout as the uniform block in the shaders: the values that stay the same for every draw of a frame.
// In a uniform block (std140 layout) a vec3 starts at a multiple of 16 bytes, like a vec4: a float after each
// vec3 fills the 4 bytes up to the next one, so the C++ struct has the same offsets as the shader's block.
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 objectColor;
    float pad1;
    glm::vec3 lightColor;
    float pad2;
};
```

(`alignas(16)` före varje `glm::vec3` skulle göra samma sak; uttryckliga utfyllnadsfloats gör layouten synlig.)

Uniform buffern skapas med `sizeof(UniformBufferObject)` byte, så den växer av sig själv. Två saker till ändras.
Descriptor set layouten har hittills gjort binding 2 synlig bara för vertex-steget; nu läser fragment shadern den
också, och en shader får bara använda en descriptor vars binding omfattar dess steg – annars rapporterar validation
layers ett fel när pipelinen skapas:

```cpp
        uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT; // the fragment shader reads the colours
```

Och `updateUniformBuffer()` sätter färgerna – vårt korallobjekt och ett vitt ljus – varje bildruta, efter matriserna:

```cpp
        ubo.objectColor = glm::vec3(1.0f, 0.5f, 0.31f);
        ubo.lightColor  = glm::vec3(1.0f, 1.0f, 1.0f);
```
:::
:::d3d12
I Direct3D 12-projektet är färgerna, liksom vy- och projektionsmatriserna, värden som är desamma för varje ritanrop i
en bildruta, så de hamnar i constant buffern. I `colors.hlsl` får `SceneConstantBuffer` två medlemmar till, och pixel
shadern multiplicerar ljusets färg med objektets (reflekterade) färg som vi diskuterade i början av kapitlet:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 objectColor;
    float3 lightColor;
};
```

```hlsl
// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(lightColor * objectColor, 1.0f);
}
```

C++-structen behöver samma två medlemmar, och här möter vi HLSL:s *packningsregler* för constant buffers. HLSL packar
en cbuffer i rader om 16 byte och låter aldrig en variabel sträcka sig över gränsen mellan två rader. `view` och
`projection` upptar byte 0–127, `objectColor` tar byte 128–139 – och `lightColor` (12 byte) får inte plats i de 4 byte
som är kvar i den raden, så den börjar på nästa rad, på byte 144. En `XMFLOAT3` i C++ är bara tre floats, så utan hjälp
skulle C++-structen lägga `lightColor` på 140. En `float` efter varje `XMFLOAT3` fyller ut luckan:

```cpp
    // The constant buffer: what the shaders see as cbuffer SceneConstantBuffer.
    // HLSL packs a cbuffer in rows of 16 bytes and never lets a float3 cross from one row
    // into the next: a float3 followed by another float3 needs a float of padding here.
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 objectColor;
        float padding0;
        XMFLOAT3 lightColor;
        float padding1;
    };
```

(En `float` som deklareras direkt efter en `float3` i cbuffern *skulle* dela dess rad – då behövs ingen utfyllnad. Det
får du se i ett senare kapitel.)

Två saker till ändras. Root parameter 1, tabellen med CBV:n, var synlig bara för vertex shadern; nu läser pixel
shadern också constant buffern. Om root signaturen inte gör b1 synlig för pixel shadern misslyckas skapandet av
pipeline state, eftersom root signaturen inte längre passar shaderna:

```cpp
        rootParameters[1].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_ALL);
```

Och `OnUpdate` sätter färgerna – vårt korallobjekt och ett vitt ljus – före `memcpy` till constant buffern:

```cpp
    // The object's colour (coral) and the light's colour (white).
    constantBufferData.objectColor = XMFLOAT3(1.0f, 0.5f, 0.31f);
    constantBufferData.lightColor = XMFLOAT3(1.0f, 1.0f, 1.0f);
```
:::

:::opengl
```quiz
Varför ligger de två `setVec3`-anropen efter `lightingShader.use()`?
- [ ] `use()` nollställer alla uniforms, så allt som sätts före det skulle gå förlorat
- [ ] Uniforms av typen `vec3` kan bara sättas medan ett VAO är bundet, och `use()` binder ett
- [x] `glUniform*`-funktionerna sätter uniformen i det program som används just nu, så belysningsprogrammet måste vara aktivt först
---
En uniform tillhör ett programobjekt, och `glUniform3f` skriver till det program som gjorts aktivt med `glUseProgram`. Satta före `use()` skulle värdena hamna i det program som var aktivt då (från andra bildrutan och framåt: lampans, som användes sist).
```
:::
:::vulkan
```quiz
Varför har `UniformBufferObject` en `float pad1;` mellan `objectColor` och `lightColor`?
- [x] I layouten std140 börjar en `vec3` på en multipel av 16 byte, så shadern läser `lightColor` på offset 144; utan utfyllnadsfloaten skulle C++-structen lägga den på 140
- [ ] Vulkan kräver att varje medlem i en uniform buffer är 16 byte lång
- [ ] Utfyllnaden lagrar alfavärdet för `objectColor`
---
`objectColor` börjar på 128 och slutar på 140. Shadern väntar sig nästa `vec3` på nästa multipel av 16, byte 144, medan en `glm::vec3` bara behöver justeringen 4 byte. Utfyllnadsfloaten får båda sidor att stämma överens.
```
:::
:::d3d12
```quiz
Varför har `SceneConstantBuffer` i C++ en `float padding0;` mellan `objectColor` och `lightColor`?
- [ ] Direct3D 12 kräver att varje medlem i en constant buffer är 16 byte lång
- [x] HLSL låter aldrig en `float3` sträcka sig över en rad på 16 byte, så `lightColor` börjar på byte 144 i cbuffern; utan utfyllnadsfloaten skulle C++-structen lägga den på 140
- [ ] Utfyllnaden behövs för att hela buffern ska vara en multipel av 256 byte
---
`objectColor` fyller byte 128–139. De 4 byte som är kvar i raden rymmer inte en `float3` på 12 byte, så HLSL börjar `lightColor` på nästa rad. Storleken på 256 byte är en separat regel, som `CalculateConstantBufferByteSize` tar hand om.
```
:::

Gör nu den första uppgiften, **object-color**: ge kubens fragment shader de två färgerna och skriv ut deras produkt,
och sätt dem från programmet. När du bygger och kör blir den vita kuben **korallfärgad** – (255, 128, 79) på skärmen,
eftersom 0.5 · 255 = 127.5 avrundas till 128 och 0.31 · 255 ≈ 79.

Titta noga, dock: framsidan och vänstersidan har exakt samma färg, och kuben ser platt ut, som en pappersfigur. Inget i
shadern beror på var ljuset är eller åt vilket håll en sida är vänd, så varje fragment får samma färg. Det är vad
nästa kapitel handlar om.

```quiz
Efter uppgiften **object-color** har kubens båda synliga sidor exakt samma korallfärg. Varför?
- [ ] För att vitt ljus inte kan ge skuggning – färgat ljus skulle göra det
- [x] För att färgen bara är lightColor × objectColor: shadern vet inte var ljuset är eller åt vilket håll en sida pekar, så varje fragment får samma resultat
- [ ] För att kameran tittar på båda sidorna från samma vinkel
---
Riktig skuggning kräver ljusets position och ytans riktning (dess normal). Båda kommer i nästa kapitel, *Basic Lighting*.
```

### Lampan

En sak till att notera är att när vi börjar ändra de här belysningsshaderna i nästa kapitel skulle ljuskällans kub
också påverkas, och det vill vi inte. Vi vill inte att ljuskällans färg ska påverkas av belysningsberäkningarna, utan
hålla ljuskällan isolerad från resten. Vi vill att ljuskällan har en konstant ljus färg, opåverkad av andra
färgändringar (då ser det ut som om ljuskällans kub verkligen är källan till ljuset).

:::opengl
För att åstadkomma det behöver vi en andra uppsättning shaders som vi använder för att rita ljuskällans kub, och som
därmed är skyddad från alla ändringar i belysningsshaderna. Vertex shadern, `light_cube.vs`, är samma som kubens vertex
shader – den är redan färdig i projektet. Fragment shadern ser till att kubens färg förblir ljus genom att ge lampan en
konstant vit färg:

```glsl
#version 330 core
out vec4 FragColor;

void main()
{
    FragColor = vec4(1.0); // set all 4 vector values to 1.0
}
```

Programmet byggs bredvid `lightingShader`:

```cpp
    Shader lightingShader("colors.vs", "colors.fs");
    Shader lightCubeShader("light_cube.vs", "light_cube.fs");
```
:::
:::vulkan
För att åstadkomma det behöver vi en andra uppsättning shaders som vi använder för att rita ljuskällans kub, och som
därmed är skyddad från alla ändringar i belysningsshaderna. I Vulkan är shaderna en del av en grafikpipeline, så lampan
får **en andra pipeline**. `shaders/light_cube.vert` är samma som kubens vertex shader – den är redan färdig i
projektet. Fragment shadern ser till att kubens färg förblir ljus genom att ge lampan en konstant vit färg, och den
deklarerar inte ens uniform-blocket:

```glsl
#version 450

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(1.0); // set all 4 vector values to 1.0
}
```

Tack vare hjälpfunktionen `createPipeline` tar den andra pipelinen en rad i `initVulkan()` – plus en medlem
`VkPipeline lightCubePipeline;` bredvid `lightingPipeline`, och en `vkDestroyPipeline` i `cleanup()`:

```cpp
        createPipeline("shaders/colors.vert.spv", "shaders/colors.frag.spv", 1, lightingPipeline);
        createPipeline("shaders/light_cube.vert.spv", "shaders/light_cube.frag.spv", 1, lightCubePipeline); // the lamp only needs the position
```

```cpp
        vkDestroyPipeline(device, lightingPipeline, nullptr);
        vkDestroyPipeline(device, lightCubePipeline, nullptr);
```

Båda pipelines använder samma pipeline layout – samma descriptor set layout och push constant-intervall – och samma
fixed-function-tillstånd; bara shaderna skiljer sig.
:::
:::d3d12
För att åstadkomma det behöver vi en andra uppsättning shaders som vi använder för att rita ljuskällans kub, och som
därmed är skyddad från alla ändringar i belysningsshaderna. I Direct3D 12 är shaderna en del av ett pipeline state
object, så lampan får **ett andra pipeline state object**. I `light_cube.hlsl` är `VSMain` samma som kubens vertex
shader – den är redan färdig i projektet, och dess cbuffer deklarerar bara de två matriser den behöver. `PSMain` ser
till att kubens färg förblir ljus genom att returnera en konstant vit färg:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(1.0f, 1.0f, 1.0f, 1.0f); // set all 4 vector values to 1.0
}
```

I `LoadAssets`, direkt efter att kubens pipeline state har skapats, kompilerar vi lampans två shaders och skapar ett
andra pipeline state från samma beskrivning – samma root signatur, input layout och djuptest – där bara shaderna är
utbytta:

```cpp
        // The lamp: its own shaders (light_cube.hlsl) in the same description - the same
        // root signature, input layout and depth test.
        ComPtr<ID3DBlob> lightCubeVertexShader;
        ComPtr<ID3DBlob> lightCubePixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"light_cube.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &lightCubeVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"light_cube.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &lightCubePixelShader, nullptr));

        psoDesc.VS = CD3DX12_SHADER_BYTECODE(lightCubeVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(lightCubePixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_lightCubePipelineState)));
```

`m_lightCubePipelineState` är en ny medlem, `ComPtr<ID3D12PipelineState>`, bredvid `m_pipelineState`. Att återanvända
beskrivningen är säkert: `CreateGraphicsPipelineState` kopierar det den behöver, så att `psoDesc` ändras efteråt
påverkar inte det första pipeline state.
:::

Ljuskällans kub finns främst för att visa var ljuset kommer ifrån. Vi definierar oftast en ljuskällas position
någonstans i scenen, men det är bara en position utan visuell betydelse. För att visa var ljuskällan faktiskt är ritar
vi en kub på samma plats som ljuskällan.

```quiz
Varför får lampan egna shaders i stället för att ritas med kubens belysningsshaders?
- [x] För att lampan ska behålla en konstant ljus färg: belysningsberäkningarna som vi lägger till i kubens shaders i de kommande kapitlen får inte ändra lampan
- [ ] För att en shader bara kan rita ett objekt per bildruta
- [ ] För att lampan har andra hörndata än kuben
---
Lampan använder exakt samma 36 hörn som kuben. Det som skiljer är hur dess fragment ska se ut: alltid vita, vad belysningsshaderna än gör.
```

:::opengl
Gör nu uppgiften **lamp-shader**. Inget ritas med det nya programmet än, så bilden ändras inte.
:::
:::vulkan
Gör nu uppgiften **lamp-shader**. Inget ritas med den nya pipelinen än, så bilden ändras inte.
:::
:::d3d12
Gör nu uppgiften **lamp-shader**. Inget ritas med det nya pipeline state än, så bilden ändras inte.
:::

### Rita lampan

Vi deklarerar en global variabel `lightPos` som anger ljuskällans plats i världskoordinater:

:::opengl vulkan
```cpp
// lighting
glm::vec3 lightPos(1.2f, 1.0f, 2.0f);
```
:::
:::d3d12
```cpp
// lighting
XMFLOAT3 lightPos = XMFLOAT3(1.2f, 1.0f, 2.0f);
```
:::

Sedan flyttar vi ljuskällans kub till ljuskällans position och skalar ner den innan vi ritar den, så att den inte ser
lika dominant ut som objektet.

:::opengl
Eftersom vi också ska rita en kub för ljuskällan vill vi skapa ett nytt VAO speciellt för ljuskällan. Vi skulle kunna
rita ljuskällan med samma VAO och sedan göra några transformationer av ljusets position på `model`-matrisen, men i de
kommande kapitlen kommer vi att ändra lådobjektets hörndata och attributpekare ganska ofta, och vi vill inte att de
ändringarna ska slå igenom på ljuskällans objekt (vi bryr oss bara om ljuskubens hörnpositioner). Så vi skapar ett nytt
VAO:

```cpp
    // second, configure the light's VAO (VBO stays the same; the vertices are the same for the light object which is also a 3D cube)
    unsigned int lightCubeVAO;
    glGenVertexArrays(1, &lightCubeVAO);
    glBindVertexArray(lightCubeVAO);

    // we only need to bind to the VBO (to link it with glVertexAttribPointer), no need to fill it; the VBO's data already contains all we need (it's already bound, but we do it again for educational purposes)
    glBindBuffer(GL_ARRAY_BUFFER, VBO);

    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
```

Koden bör vara ganska rättfram: lampan använder samma buffer (`VBO`) med kubens hörn, men har ett eget vertex array
object som sparar dess egen attributuppsättning.

I renderloopen, efter att kuben har ritats, ritar vi lampan med dess eget shaderprogram. Den behöver samma
`projection`- och `view`-matriser – de är nu uniforms i `lightCubeShader`, som har en egen uppsättning – och en egen
modellmatris:

```cpp
        // also draw the lamp object
        lightCubeShader.use();
        lightCubeShader.setMat4("projection", projection);
        lightCubeShader.setMat4("view", view);
        model = glm::mat4(1.0f);
        model = glm::translate(model, lightPos);
        model = glm::scale(model, glm::vec3(0.2f)); // a smaller cube
        lightCubeShader.setMat4("model", model);

        glBindVertexArray(lightCubeVAO);
        glDrawArrays(GL_TRIANGLES, 0, 36);
```

Glöm inte att ta bort det nya VAO:t i slutet av `main`, bredvid kubens: `glDeleteVertexArrays(1, &lightCubeVAO);`.
:::
:::vulkan
Lampan behöver ingen egen vertex buffer: den är samma 36 hörn. I `recordCommandBuffer()`, efter kubens ritanrop, binder
vi lampans pipeline, skickar lampans modellmatris som push constant och ritar hörnen igen:

```cpp
        // also draw the lamp object
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, lightCubePipeline);
        model = glm::mat4(1.0f);
        model = glm::translate(model, lightPos);
        model = glm::scale(model, glm::vec3(0.2f)); // a smaller cube
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

        vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
```

Lägg märke till vad vi *inte* upprepar. Vertex bufferns bindning ligger kvar när en annan pipeline binds. Descriptor
setet ligger också kvar, eftersom den nya pipelinen använder samma (och därmed kompatibla) pipeline layout – så lampans
vertex shader läser samma vy- och projektionsmatriser. Viewport och scissor är dynamiskt tillstånd i båda pipelines, så
värdena som sattes med `vkCmdSetViewport` och `vkCmdSetScissor` gäller också fortfarande. Bara pipelinen och
modellmatrisen ändras.
:::
:::d3d12
Lampan behöver ingen egen vertex buffer: den är samma 36 hörn. I `PopulateCommandList`, efter kubens ritanrop, byter vi
till lampans pipeline state, sätter lampans modellmatris och ritar hörnen igen:

```cpp
    // Also draw the lamp object: the same cube, with the lamp's pipeline state (its own
    // shaders), made smaller (scale 0.2) and moved to lightPos.
    m_commandList->SetPipelineState(m_lightCubePipelineState.Get());
    model = XMMatrixScaling(0.2f, 0.2f, 0.2f) * XMMatrixTranslation(lightPos.x, lightPos.y, lightPos.z);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
```

DirectXMath multiplicerar radvektorer, så produkten läses från vänster till höger: först skala, sedan flytta – samma
sak som learnopengl:s `translate` följt av `scale`.

Lägg märke till vad vi *inte* upprepar. `SetPipelineState` ändrar inte root signaturen, och root-argumenten som satts
på command listen – descriptor tablen i root parameter 1 med vy och projektion – ligger kvar, så lampans vertex shader
läser samma matriser. Vertex buffern, primitivtopologin, viewporten och scissor-rektangeln är tillstånd i command
listen, inte i pipeline state, och ligger också kvar. Bara pipeline state och modellmatrisen ändras.
:::

:::opengl
```quiz
Lampan använder samma VBO som kuben. Varför får den ändå ett eget VAO, `lightCubeVAO`?
- [x] För att kubens hörndata och attributpekare kommer att ändras i de kommande kapitlen, och lampans attributuppsättning (bara positioner) ska inte påverkas
- [ ] För att ett VAO lagrar shaderprogrammet, och lampan har ett eget program
- [ ] För att ett VBO bara kan refereras av ett VAO
---
Ett VAO sparar attributuppsättningen – vilken buffer, vilka attribut, vilka steg. Flera VAO:er kan peka in i samma VBO. Med ett eget VAO för lampan lämnar senare ändringar av kubens attribut lampan i fred.
```
:::
:::vulkan
```quiz
Innan lampan ritas binder `recordCommandBuffer()` `lightCubePipeline`, men binder inte descriptor setet eller vertex buffern igen. Varför får lampan ändå vy- och projektionsmatriserna?
- [ ] För att `vkCmdBindPipeline` kopierar alla bindningar från den förra pipelinen till den nya
- [x] För att båda pipelines använder samma pipeline layout, så det bundna descriptor setet gäller fortfarande, och vertex buffer-bindningar är inte alls en del av pipelinen
- [ ] För att lampans vertex shader har matriserna inkompilerade
---
Descriptor sets förblir bundna över pipelinebyten så länge pipeline layouterna är kompatibla – här är de identiska. Vertex buffers är, liksom dynamiska viewport- och scissorvärden, tillstånd i command buffern.
```
:::
:::d3d12
```quiz
Innan lampan ritas anropar `PopulateCommandList` `SetPipelineState`, men sätter inte descriptor tablen eller vertex buffern igen. Varför får lampan ändå vy- och projektionsmatriserna?
- [ ] För att `SetPipelineState` kopierar root-argumenten in i det nya pipeline state object
- [x] För att root signaturen är densamma, så root-argumenten som satts på command listen ligger kvar, och vertex buffern är tillstånd i command listen, inte en del av pipeline state
- [ ] För att lampans vertex shader har matriserna inkompilerade
---
Root-argumenten hör till command listen och behålls så länge root signaturen inte ändras. Pipeline state object innehåller bara shaders och fixed-function-tillstånd.
```
:::

Gör nu uppgiften **lamp**: deklarera `lightPos` och rita sedan lampan efter kuben. När du bygger och kör dyker en
**liten vit kub** upp uppe till höger om den korallfärgade kuben. Med alla transformationer på plats bör resultatet se
ut så här: en korallfärgad kub till vänster, belyst av ingenting annat än ett platt vitt ljus, och en liten, klart vit
lampa som svävar framför den, till höger och en bit ovanför.

Om du får problem kan du jämföra din kod med learnopengl:s `colors.cpp` (länkad bland källorna); bortsett från
kamerans startvärden är det samma program.

Att leka med färgerna är ett bra sätt att få känsla för det här kapitlet: prova ett grönt eller ett olivgrönt ljus, som
i exemplen i början, och se korallkuben ändras. Sätt sedan tillbaka ljuset till vitt – de kommande kapitlen räknar med
det. Med lite kunskap om färger och en enkel scen att experimentera med belysning i kan vi gå vidare till nästa
kapitel, där den riktiga magin börjar.
