# Tessellering

Förra kapitlet byggde ett landskap på CPU:n: 65 536 vertexar, en per pixel i höjdkartan, och 130 050 trianglar, alla
transformerade och rastrerade varje bildruta oavsett hur nära eller långt bort de låg. Det här kapitlet ritar samma
landskap från **400 små kvadratiska patches** – 1 600 vertexar – och låter GPU:n dela upp varje patch i så många
trianglar som behövs, med höjderna lästa ur höjdkartan som en textur. Sedan går det ett steg längre: patches nära kameran
delas fint, patches långt bort grovt, och det avgörs på nytt varje bildruta. Det är **tessellering**, och kapitlet följer
learnopengls gästartikel *Tessellation*.

Tessellering har funnits i alla API:er sedan Direct3D 11 och OpenGL 4.0. Den lägger till två programmerbara steg och ett
fast steg mellan vertex shadern och rastreraren; namnen skiljer sig mellan API:erna, idéerna gör det inte. Kapitlet visar
hur {{api}} ställer i ordning dem.

## Tesselleringsstegen

Med tessellering ritar pipelinen inte trianglar ur de vertexar du skickar. Den ritar **patches**: grupper med ett fast
antal *kontrollpunkter*. Här är en patch en kvadrat med sina fyra hörn. Tre steg gör om varje patch till trianglar:

1. **Tessellation control shadern** – Direct3D kallar den **hull shader** – körs en gång per kontrollpunkt i en patch. Den
   kan skicka kontrollpunkterna vidare (eller ändra dem), och den bestämmer, en gång per patch,
   **tesselleringsnivåerna**: hur fint varje kant och patchens insida ska delas.
2. **Tessellatorn** – ett fast steg, ingen shader – tar nivåerna och genererar ett rutnät av nya punkter över en abstrakt,
   normaliserad patch: för en fyrhörning enhetskvadraten med koordinaterna (u, v) från 0 till 1. Den genererar också
   trianglarna som binder ihop dem. Den vet ingenting om positioner eller texturer; den ger bara (u, v)-koordinater.
3. **Tessellation evaluation shadern** – **domain shadern** i Direct3D – körs en gång för varje punkt som tessellatorn
   gjort. Den får punktens (u, v) och patchens kontrollpunkter och räknar ut vertexens verkliga position: här interpolerar
   den de fyra hörnen, läser höjdkartan på det stället och flyttar upp punkten.

Vertex shadern före dem skickar nu bara vidare kontrollpunkterna, och rastreraren efter dem får vanliga trianglar.
Control-/hull-steget bestämmer *hur mycket* detalj; evaluation-/domain-steget bestämmer *var* varje ny vertex hamnar.

:::opengl
Tessellation shaders är core sedan OpenGL 4.0. learnopengls program begär **4.1**, och det gör även det här kapitlets:
4.1 är också den högsta version macOS erbjuder, och den har tessellering, så kapitlet fungerar där. Shaderna börjar med
`#version 410 core`. Projektets `shader_t.h` är learnopengls klass `Shader` med tre valfria steg efter fragment shadern:
en geometry shader, en tessellation control shader och en tessellation evaluation shader.
:::
:::vulkan
Vulkan har inga versioner att begära: tessellation shaders är en valfri **enhetsfunktion**, `tessellationShader`, som du
kontrollerar i `isDeviceSuitable()` och slår på när du skapar enheten. Alla GPU:er för datorer har den; många mobila
GPU:er har den inte.
:::
:::d3d12
Tessellering ingår i varje Direct3D 12-enhet – den kom med feature level 11_0, och Direct3D 12 kräver minst den. Det finns
inget att begära eller slå på.
:::

## Projektet

Starten är förra kapitlets lösning, terrängen på CPU:n, med GPU-versionens filer tillagda: `gpuheight`-shaders för
vertex-steget (som skickar vidare kontrollpunkterna), control-/hull-steget (som skickar vidare dem och sätter varje nivå
till 1 – mer om det nedan), ett tomt evaluation-/domain-steg, och fragment-steget som färgar efter höjd, som förut.
Kameran, höjdkartan och färgerna är förra kapitlets, så de två kapitlen visar samma landskap från samma plats. Bygg och
kör programmet: det visar den grå CPU-terrängen; kommentarerna `// TODO:` visar var GPU-versionen ska in.

:::opengl
:::ide vs rider
Lägg till `shader_t.h` och `gpuheight`-shaderna i projektet (**Project → Add Existing Item…**; i Rider **Add → Existing
Item…** i projektets snabbmeny) för att öppna dem från Solution Explorer; bygget behöver ingen inställning för dem.
:::
:::
:::vulkan
:::ide clion vscode
Din `CMakeLists.txt` kompilerar de två nya stegen också – dess rad `file(GLOB …)` tar med `shaders/*.tesc` och
`shaders/*.tese` – till `shaders/gpuheight.tesc.spv` och `shaders/gpuheight.tese.spv`.
:::
:::ide vs rider
Pre-build-händelsen i ditt projekt kompilerar de två nya stegen också – dess loop tar med `shaders\*.tesc` och
`shaders\*.tese` – till `shaders\gpuheight.tesc.spv` och `shaders\gpuheight.tese.spv`.
:::
:::

:::opengl
Den första uppgiften begär 4.1-kontexten och skriver ut den högsta tesselleringsnivå som GPU:n klarar:

```cpp
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 1);
```

och, när GLAD har lästs in, `glGetIntegerv(GL_MAX_TESS_GEN_LEVEL, &maxTessLevel)` – minst 64 i varje implementation. Gör
nu den första uppgiften, **opengl-4-1**. CPU-terrängen ritas fortfarande som förut.
:::
:::vulkan
Den första uppgiften slår på funktionen – `deviceFeatures.tessellationShader = VK_TRUE;` i `createLogicalDevice()` och
`supportedFeatures.tessellationShader` i `isDeviceSuitable()` – och skriver ut den högsta tesselleringsnivån, en gräns för
enheten:

```cpp
        std::cout << "Max available tess level: " << properties.limits.maxTessellationGenerationLevel << std::endl;
```

(64 på varje aktuell GPU.) Gör nu den första uppgiften, **tessellation-feature**. CPU-terrängen ritas fortfarande som
förut.
:::
:::d3d12
I Direct3D 12 är den högsta tesselleringsfaktorn inte ens en egenskap hos enheten: den är fast 64 för alla enheter,
konstanten `D3D12_TESSELLATOR_MAX_TESSELLATION_FACTOR`. Den första uppgiften skriver den till felsökarens utdata:

```cpp
        snprintf(text, sizeof(text), "Max available tess level: %d\n", D3D12_TESSELLATOR_MAX_TESSELLATION_FACTOR);
```

Gör nu den första uppgiften, **max-tess-level**. CPU-terrängen ritas fortfarande som förut.
:::

## Höjdkartan som textur

Evaluation-steget läser höjderna ur höjdkartan, så kartan måste nu vara en **textur**. Den har en kanal, så ett format
med en 8-bitarskanal passar (learnopengl laddar upp sin RGBA-karta som RGBA och läser den andra kanalen; kursens karta är
grå och läses som `.r`). Den vänds inte, som i förra kapitlet. Samplern filtrerar linjärt och **klämmer vid kanten**:
learnopengl upprepar, och då blandar det bilinjära filtret vid terrängens framkant in höjdkartans motsatta kant – de
avlägsna topparna – och reser en rad spikar längs framkanten.

:::opengl
```cpp
    glTexImage2D(GL_TEXTURE_2D, 0, GL_R8, width, height, 0, GL_RED, GL_UNSIGNED_BYTE, data);
    glGenerateMipmap(GL_TEXTURE_2D);
```

med `GL_CLAMP_TO_EDGE` på S och T, `GL_LINEAR_MIPMAP_LINEAR` / `GL_LINEAR`, på texturenhet 0. learnopengl genererar
mipmaps; de används dock aldrig här: evaluation shadern körs före rastreringen, där det inte finns några derivator i
skärmrummet att välja mip-nivå med, så `texture()` läser där nivå 0.
:::
:::vulkan
`loadHeightMap()` läser in kartan med `STBI_grey` (en kanal) i en bild i `VK_FORMAT_R8_UNORM` via en staging buffer på
`width * height` byte, med en bildvy och en sampler på **bindning 1** i descriptor setet, för steget
`VK_SHADER_STAGE_TESSELLATION_EVALUATION_BIT`. Samplern är linjär med `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`, och bilden
har **inga mipmaps**: evaluation shadern körs före rastreringen, där det inte finns några derivator i skärmrummet att
välja mip-nivå med, så `texture()` läser där nivå 0 ändå.
:::
:::d3d12
Kartan hamnar i en textur i `DXGI_FORMAT_R8_UNORM` i en default heap, uppladdad med `UpdateSubresources` (radsteg =
bredden, en byte per pixel), och görs sedan om till `D3D12_RESOURCE_STATE_NON_PIXEL_SHADER_RESOURCE` – det är domain
shadern som läser den, inte pixel shadern. Dess SRV ligger på plats 1 i heapen. Root-signaturen får en tabell för den,
synlig för domain shadern (`D3D12_SHADER_VISIBILITY_DOMAIN`), och en statisk sampler (linjär, `CLAMP`); constant bufferns
tabell blir synlig för alla shaders, eftersom hull- och domain shadern nu använder matriserna. Texturen har **en
mip-nivå**: domain shadern körs före rastreringen, där det inte finns några derivator i skärmrummet att välja nivå med,
så den läser med `SampleLevel(…, 0)`.
:::

```quiz
Varför hjälper en höjdkarta med mipmaps inte i evaluation- (domain-) shadern?
- [ ] För att mipmaps inte kan genereras för texturer med en kanal
- [x] För att steget körs före rastreringen: det finns inga närliggande pixlar att räkna derivator i skärmrummet ur, så en vanlig texturläsning där läser nivå 0
- [ ] För att tessellatorn tar bort mipmaps
- [ ] För att evaluation shadern bara får läsa buffrar, inte texturer
---
Därför anropar Direct3D-koden `SampleLevel(…, 0)` och Vulkan-bilden har inga mip-nivåer. För att använda en grövre nivå för avlägsna patches skulle en shader själv behöva välja den, till exempel utifrån tesselleringsnivån.
```

CPU-rutnätet – dess vertexar, index, buffrar och strip-ritning – tas bort. Gör nu den andra uppgiften,
**height-texture**. Fönstret visar bara rensningsfärgen: det finns inget att rita förrän det finns patches.

## Patches

learnopengl delar terrängen i `rez × rez` = 20 × 20 patches. Varje patch är en platt kvadrat vid y = 0 som ges av sina
fyra hörn, vart och ett med en position och en texturkoordinat in i höjdkartan (0 till 1 över terrängen). Hörnen läggs i
learnopengls ordning – (i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1) – som evaluation shadern förlitar sig på:

:::opengl
```cpp
    unsigned rez = 20;
    for (unsigned i = 0; i <= rez - 1; i++)
    {
        for (unsigned j = 0; j <= rez - 1; j++)
        {
            vertices.push_back(-width / 2.0f + width * i / (float)rez); // v.x
            vertices.push_back(0.0f); // v.y
            vertices.push_back(-height / 2.0f + height * j / (float)rez); // v.z
            vertices.push_back(i / (float)rez); // u
            vertices.push_back(j / (float)rez); // v
```

och likadant för de tre andra hörnen. 400 patches, 1 600 vertexar med fem flyttal – attribut 0 positionen, 1
texturkoordinaten. Ytterligare ett anrop talar om för OpenGL hur många kontrollpunkter en patch har:

```cpp
    glPatchParameteri(GL_PATCH_VERTICES, NUM_PATCH_PTS);
```

med `const unsigned int NUM_PATCH_PTS = 4;`. Patches ritas med primitivtypen `GL_PATCHES`.
:::
:::vulkan
Loopen är learnopengls: för `i` och `j` från 0 till `rez - 1` (`const unsigned int rez = 20;`), fyra `Vertex` med `pos` =
(`-width / 2.0f + width * i / (float) rez`, 0, `-height / 2.0f + height * j / (float) rez`) och `texCoord` = (`i / (float)
rez`, `j / (float) rez`), och likadant för (i + 1, j), (i, j + 1), (i + 1, j + 1). `Vertex` får `glm::vec2 texCoord`; dess
attributbeskrivning (location 1) kommer med den nya pipelinen i nästa uppgift. 400 patches, 1 600 vertexar, och
`createVertexBuffer()` är tillbaka. Patchstorleken är en del av pipelinen i Vulkan, så även den kommer i nästa uppgift.
:::
:::d3d12
Loopen är learnopengls: för `i` och `j` från 0 till `rez - 1` (`rez = 20`), fem flyttal per hörn i `std::vector<float>
vertices` – positionen (`-width / 2.0f + width * i / (float)rez`, 0, `-height / 2.0f + height * j / (float)rez`) och
texturkoordinaten (`i / (float)rez`, `j / (float)rez`) – för hörnen (i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1). 400
patches, 1 600 vertexar i en vertex buffer med ett stride på fem flyttal; input layouten får `TEXCOORD` (R32G32_FLOAT vid
byte 12) bredvid `POSITION`.
:::

Gör nu den tredje uppgiften, **patch-grid**. Fortfarande bara rensningsfärgen: patcharna finns, men ingenting ritar dem
ännu.

```quiz
Terrängen ritas från 20 × 20 patches med 4 kontrollpunkter. Hur många vertexar bearbetar vertex shadern per bildruta, jämfört med förra kapitlets rutnät?
- [ ] 65 536, samma som förut – tessellering ändrar bara trianglarna
- [ ] 102 400, en per vertex som tessellatorn gör
- [ ] 400, en per patch
- [x] 1 600, patcharnas hörn; punkterna som tessellatorn gör bearbetas i stället av evaluation shadern
---
Vertex shadern ser bara kontrollpunkterna. De nya vertexarna – tusentals – görs på GPU:n och placeras av evaluation- (domain-) shadern. CPU:n skickar 1 600 vertexar i stället för 65 536.
```

## Tessellation evaluation shadern

Evaluation shadern körs en gång för varje punkt som tessellatorn genererar. Dess indata är punktens plats i den abstrakta
patchen – `gl_TessCoord` i GLSL (u och v för en fyrhörning), `SV_DomainLocation` i HLSL – och de fyra kontrollpunkterna.
Ur dem räknar den ut vertexen:

- **texturkoordinaten** genom bilinjär interpolation av hörnens texturkoordinater: längs u på kanten mellan hörn 0 och 1
  och på kanten mellan 2 och 3, sedan längs v mellan de två resultaten;
- **höjden** ur höjdkartan vid den texturkoordinaten, skalad till −16 … 48 som på CPU:n förut;
- **positionen** genom samma bilinjära interpolation av hörnen, flyttad längs patchens normal med höjden. Patchen är platt
  med y = 0, så normalen är (0, 1, 0) – learnopengl räknar ändå ut den ur hörnen, vilket fungerar för patches i vilken
  riktning som helst;
- positionen i clip space, med modell-, vy- och projektionsmatriserna – som flyttar hit från vertex shadern.

Patchens layout deklareras tillsammans med den. `quads` säger att tessellatorn arbetar på en kvadratisk domän;
`fractional_odd_spacing` hur den fördelar punkterna (se nedan); `ccw` riktningen (winding) på trianglarna den gör.

:::opengl
```glsl
// quads, spaced with fractional odd levels, triangles counter-clockwise
layout (quads, fractional_odd_spacing, ccw) in;
```

och i `main`:

```glsl
    // where in the patch this vertex is: (u, v) from 0 to 1
    float u = gl_TessCoord.x;
    float v = gl_TessCoord.y;

    // the corners' texture coordinates
    vec2 t00 = TextureCoord[0];
    vec2 t01 = TextureCoord[1];
    vec2 t10 = TextureCoord[2];
    vec2 t11 = TextureCoord[3];

    // bilinear interpolation: along u on both edges, then along v
    vec2 t0 = (t01 - t00) * u + t00;
    vec2 t1 = (t11 - t10) * u + t10;
    vec2 texCoord = (t1 - t0) * v + t0;

    // the height from the texture: 0..1 -> -16..48
    Height = texture(heightMap, texCoord).r * 64.0 - 16.0;
```

sedan positionerna på samma sätt – `p0 = (p01 - p00) * u + p00`, `p1 = (p11 - p10) * u + p10` – och

```glsl
    vec4 p = (p1 - p0) * v + p0 + normal * Height;

    // output patch point position in clip space
    gl_Position = projection * view * model * p;
```

`TextureCoord[]` är en array: control shaderns utdata per kontrollpunkt, en för var och en av patchens fyra punkter.
Programmet byggs nu av fyra filer – `Shader tessHeightMapShader("gpuheight.vs", "gpuheight.fs", nullptr, "gpuheight.tcs",
"gpuheight.tes");`, ingen geometry shader – och patcharna ritas med

```cpp
        glDrawArrays(GL_PATCHES, 0, NUM_PATCH_PTS * rez * rez);
```
:::
:::vulkan
```glsl
// quads, spaced with fractional odd levels, triangles counter-clockwise
layout(quads, fractional_odd_spacing, ccw) in;
```

och i `main`:

```glsl
    // where in the patch this vertex is: (u, v) from 0 to 1
    float u = gl_TessCoord.x;
    float v = gl_TessCoord.y;

    // the corners' texture coordinates
    vec2 t00 = TextureCoord[0];
    vec2 t01 = TextureCoord[1];
    vec2 t10 = TextureCoord[2];
    vec2 t11 = TextureCoord[3];

    // bilinear interpolation: along u on both edges, then along v
    vec2 t0 = (t01 - t00) * u + t00;
    vec2 t1 = (t11 - t10) * u + t10;
    vec2 texCoord = (t1 - t0) * v + t0;

    // the height from the texture: 0..1 -> -16..48
    Height = texture(heightMap, texCoord).r * 64.0 - 16.0;
```

sedan positionerna på samma sätt, punkten flyttad längs normalen med höjden, och `gl_Position = ubo.proj * ubo.view *
pc.model * p;`. Höjdkartan är `layout(binding = 1) uniform sampler2D heightMap;`, matriserna uniform-blocket och push
constanten – som nu tjänar control- och evaluation-stegen i stället för vertex-steget. Vulkans tessellator placerar
`gl_TessCoord` på samma sätt som OpenGL:s, så bilden blir OpenGL:s.

Pipelinen får de två nya stegen (`VK_SHADER_STAGE_TESSELLATION_CONTROL_BIT`, `..._EVALUATION_BIT`, från `gpuheight.tesc`
och `gpuheight.tese`), topologin `VK_PRIMITIVE_TOPOLOGY_PATCH_LIST` – OpenGL:s `GL_PATCHES` – och ett
tesselleringstillstånd med patchstorleken, OpenGL:s `glPatchParameteri`:

```cpp
        VkPipelineTessellationStateCreateInfo tessellationState{};
        tessellationState.sType = VK_STRUCTURE_TYPE_PIPELINE_TESSELLATION_STATE_CREATE_INFO;
        tessellationState.patchControlPoints = NUM_PATCH_PTS;
```

(`pipelineInfo.pTessellationState = &tessellationState;`). Ritningen är `vkCmdDraw(commandBuffer, NUM_PATCH_PTS * rez *
rez, 1, 0, 0)`.
:::
:::d3d12
I Direct3D deklareras patchens layout på **hull** shadern (se nästa avsnitt); domain shadern säger bara vilken domän den
arbetar på, `[domain("quad")]`, och får punktens plats som `SV_DomainLocation`, patchens kontrollpunkter som en
`OutputPatch` och patchkonstanterna:

```hlsl
DSOutput DSMain(HSConstantOutput patchConstants, float2 tessCoord : SV_DomainLocation, const OutputPatch<HSOutput, 4> patch)
{
    DSOutput output;

    // get patch coordinate
    float u = tessCoord.x;
    float v = tessCoord.y;

    // ----------------------------------------------------------------------
    // retrieve control point texture coordinates
    float2 t00 = patch[0].textureCoord;
    float2 t01 = patch[1].textureCoord;
    float2 t10 = patch[2].textureCoord;
    float2 t11 = patch[3].textureCoord;

    // bilinearly interpolate texture coordinate across patch
    float2 t0 = (t01 - t00) * u + t00;
    float2 t1 = (t11 - t10) * u + t10;
    float2 texCoord = (t1 - t0) * v + t0;

    // lookup texel at patch coordinate for height and scale + shift as desired
    // (SampleLevel: outside the pixel shader there are no derivatives to pick a mip level)
    output.height = heightMap.SampleLevel(heightMapSampler, texCoord, 0).r * 64.0f - 16.0f;
```

sedan positionerna på samma sätt, punkten flyttad längs normalen med höjden, och projektionen med
`mul(mul(mul(p, model), view), projection)`. Pipeline state-objektet får de två nya stegen – `psoDesc.HS` och
`psoDesc.DS`, kompilerade från `HSMain` (`hs_5_0`) och `DSMain` (`ds_5_0`) i `gpuheight.hlsl` – och
`psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_PATCH`. Command listen säger hur många kontrollpunkter en
patch har, i själva topologin:

```cpp
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_4_CONTROL_POINT_PATCHLIST);
```

– OpenGL:s `GL_PATCHES` och `glPatchParameteri(GL_PATCH_VERTICES, 4)` i en konstant – och `DrawInstanced(m_vertexCount,
1, 0, 0)` ritar de 1 600 kontrollpunkterna.
:::

Startens control-/hull-steg sätter varje nivå till 1, så tessellatorn gör inga nya punkter: varje patch blir en enda
fyrhörning – två trianglar – med höjderna i sina fyra hörn. Gör nu den fjärde uppgiften, **tess-evaluation**. Bygg och
kör: en **grov terräng** av 20 × 20 lutande kvadrater – rätt kontur, men topparna trubbiga och sjön bara en grund grop.

## Tesselleringsnivåer

Control-/hull-steget bestämmer hur fint tessellatorn delar varje patch. För en fyrhörning finns sex nivåer:

- fyra **yttre** nivåer, en per kant: i hur många segment kanten delas. I OpenGL:s numrering (och Direct3D:s, som stämmer
  överens för fyrhörningar) är yttre nivå 0 kanten vid u = 0, 1 kanten vid v = 0, 2 kanten vid u = 1 och 3 kanten vid
  v = 1;
- två **inre** nivåer: i hur många segment insidan delas längs u och längs v.

Nivåerna är flyttal, och hur tessellatorn gör om en nivå till segment är **fördelningen** (spacing). `equal_spacing`
(`integer` i Direct3D) avrundar nivån uppåt till ett helt antal lika långa segment: med alla sex nivåerna på 8 skulle varje
patch bli ett rutnät av 8 × 8 små fyrhörningar. `fractional_odd_spacing`, som learnopengl använder, avrundar nivån uppåt
till nästa **udda** tal och gör två av segmenten, symmetriskt placerade, kortare med bråkdelen; `fractional_even_spacing`
gör detsamma med jämna tal. Här ger nivån 8 alltså 9 segment – sju lika långa och två kortare – och varje patch blir 9 × 9
små fyrhörningar: 100 punkter som var och en läser sin egen höjd, och 162 trianglar. Poängen med bråkdelsfördelning: en
nivå som ändras mjukt – som den kommer att göra med avståndet – flyttar punkterna mjukt, i stället för att låta nya
punkter poppa fram.

Control shadern körs en gång per kontrollpunkt – `gl_InvocationID` säger vilken – men nivåerna gäller hela patchen, så
learnopengl skriver dem bara i anrop 0:

:::opengl
```glsl
// the patch: 4 control points in, 4 out
layout (vertices = 4) out;
```

```glsl
    // pass the control point (and its texture coordinate) through
    gl_out[gl_InvocationID].gl_Position = gl_in[gl_InvocationID].gl_Position;
    TextureCoord[gl_InvocationID] = TexCoord[gl_InvocationID];

    // the tessellation levels: once per patch (by invocation 0)
    if (gl_InvocationID == 0)
    {
```

och inuti `if`-satsen, för den här uppgiften, `gl_TessLevelOuter[0]` … `[3]` och `gl_TessLevelInner[0]` … `[1]` = 8.
OpenGL skulle till och med klara sig utan control shader: nivåerna kommer då från
`glPatchParameterfv(GL_PATCH_DEFAULT_OUTER_LEVEL, …)` och `GL_PATCH_DEFAULT_INNER_LEVEL`. Kursen behåller steget i alla
lägen, som Vulkan och Direct3D kräver.

```quiz
Varför sätter control shadern nivåerna inuti `if (gl_InvocationID == 0)`?
- [x] För att shadern körs en gång per kontrollpunkt, men nivåerna hör till hela patchen – det räcker att ett anrop skriver dem
- [ ] För att bara kontrollpunkt 0 har en texturkoordinat
- [ ] För att `gl_TessLevelOuter` är indata som bara anrop 0 får läsa
- [ ] För att nivåerna måste vara olika för varje kontrollpunkt
---
Alla fyra anropen skulle kunna skriva samma värden; att skriva dem en gång är enklare och tydligare. Direct3D skiljer de två uppgifterna helt åt: en funktion per kontrollpunkt och en patchkonstantfunktion per patch.
```
:::
:::vulkan
```glsl
// the patch: 4 control points in, 4 out
layout(vertices = 4) out;
```

```glsl
    // pass the control point (and its texture coordinate) through
    gl_out[gl_InvocationID].gl_Position = gl_in[gl_InvocationID].gl_Position;
    TextureCoord[gl_InvocationID] = TexCoord[gl_InvocationID];

    // the tessellation levels: once per patch (by invocation 0)
    if (gl_InvocationID == 0) {
```

och inuti `if`-satsen, för den här uppgiften, `gl_TessLevelOuter[0]` … `[3]` och `gl_TessLevelInner[0]` … `[1]` = 8. En
Vulkan-pipeline med tessellering **måste** ha både en control- och en evaluation shader – OpenGL kan utelämna control
shadern och använda standardnivåer, Vulkan har inga sådana standardvärden. Därför skriver startens control shader nivå 1
överallt: utan den hade förra uppgiftens pipeline inte gått att bygga.

```quiz
Varför har starten i Vulkan-projektet redan en control shader som bara skriver nivå 1 överallt?
- [ ] För att nivå 1 får tessellatorn att fördubbla vertexarna
- [ ] För att evaluation shadern inte kan läsa `gl_TessCoord` utan den
- [ ] För att Vulkan kräver att nivåerna skrivs en gång per bildruta av CPU:n
- [x] För att en Vulkan-pipeline med tessellering måste ha både en control- och en evaluation shader – det finns inga standardnivåer som i OpenGL
---
Med alla nivåer på 1 gör tessellatorn inga nya punkter: varje patch blir en fyrhörning, den grova terrängen från evaluation-uppgiften.
```
:::
:::d3d12
Direct3D delar control shadern i två. `HSMain` körs en gång per utdata-kontrollpunkt (`SV_OutputControlPointID` =
`gl_InvocationID`) och skickar den vidare; nivåerna kommer från en separat **patchkonstantfunktion** (patch constant
function), som Direct3D kör en gång per patch – OpenGL:s block `if (gl_InvocationID == 0)`. Hull shaderns attribut
deklarerar patchens layout, som OpenGL deklarerar på evaluation shadern:

```hlsl
[domain("quad")]
[partitioning("fractional_odd")]
[outputtopology("triangle_ccw")]
[outputcontrolpoints(4)]
[patchconstantfunc("PatchConstantFunction")]
HSOutput HSMain(InputPatch<VSOutput, 4> patch, uint i : SV_OutputControlPointID)
{
    HSOutput output;

    output.position = patch[i].position;
    output.textureCoord = patch[i].texCoord;

    return output;
}
```

Patchkonstantfunktionen returnerar nivåerna med sina systemvärdessemantiker – `SV_TessFactor` för de fyra kanterna
(`gl_TessLevelOuter`), `SV_InsideTessFactor` för de två inre faktorerna (`gl_TessLevelInner`):

```hlsl
struct HSConstantOutput
{
    float edges[4] : SV_TessFactor;
    float inside[2] : SV_InsideTessFactor;
};
```

För den här uppgiften sätter `PatchConstantFunction` alla sex till 8. En Direct3D-pipeline med tessellering behöver alltid
en hull shader – det finns inga standardfaktorer – och därför skriver startens 1 överallt.

```quiz
Vilken del av Direct3D:s hull shader gör det som OpenGL:s block `if (gl_InvocationID == 0)` i control shadern gör?
- [ ] `HSMain`, anropad med `SV_OutputControlPointID` 0
- [x] Patchkonstantfunktionen som anges i `[patchconstantfunc(...)]`, som Direct3D kör en gång per patch och som returnerar `SV_TessFactor` och `SV_InsideTessFactor`
- [ ] Domain shaderns attribut `[domain("quad")]`
- [ ] `[outputcontrolpoints(4)]`
---
Direct3D delar OpenGL:s control shader: `HSMain` hanterar en kontrollpunkt per anrop, patchkonstantfunktionen nivåerna per patch.
```
:::

Gör nu den femte uppgiften, **tess-control**. Bygg och kör: hela terrängen igen, lika detaljerad som CPU-versionen –
ungefär 65 000 trianglar (400 patches × 162) gjorda på GPU:n av 1 600 vertexar.

```quiz
Alla sex nivåerna i en patch av typen quad är 8, med `fractional_odd_spacing`. Vad ger tessellatorn för varje patch?
- [ ] 8 trianglar
- [ ] 8 nya vertexar på varje kant, men insidan förblir en fyrhörning
- [x] Ett rutnät av 9 × 9 små fyrhörningar: nivån avrundas uppåt till nästa udda tal, 9 segment per sida, två av dem kortare
- [ ] 8 kopior av patchen, en per nivå
---
Med `equal_spacing` hade det blivit 8 × 8. Tessellatorn ger bara (u, v)-punkterna och trianglarna som binder ihop dem; evaluation- (domain-) shadern läser en höjd för varje punkt.
```

## Trådmodell

För att se vad tessellatorn gör ritar nästa uppgift bara trianglarnas kanter.

:::opengl
`glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);` en gång före renderingsloopen (learnopengl växlar med en tangent; kursen har
ingen indata).
:::
:::vulkan
`rasterizer.polygonMode = VK_POLYGON_MODE_LINE;` i pipelinen. Allt annat än `FILL` kräver ytterligare en enhetsfunktion,
`fillModeNonSolid`, påslagen och kontrollerad som `tessellationShader`.
:::
:::d3d12
`psoDesc.RasterizerState.FillMode = D3D12_FILL_MODE_WIREFRAME;` i pipeline state-objektet.
:::

Gör nu den sjätte uppgiften, **wireframe**. Bygg och kör: terrängen som en grå trådmodell – ett regelbundet nät, samma
täthet på 9 × 9 i varje patch. Nära kameran är trianglarna stora på skärmen; längst bak trängs linjerna, många trianglar
på några få pixlar. Det är bortkastat arbete, och den sista uppgiften rättar det.

## Detaljnivå efter avstånd

Nivåerna behöver inte vara konstanter: control shadern kan räkna ut dem, per patch, varje bildruta. learnopengl låter dem
bero på avståndet till kameran. För varje hörn i patchen tar den djupet i ögats rum (kameran tittar längs −z, alltså
absolutvärdet av z) och skalar det till 0 … 1 mellan `MIN_DISTANCE` och `MAX_DISTANCE`. Varje yttre nivå interpoleras
sedan från `MAX_TESS_LEVEL` (nära) till `MIN_TESS_LEVEL` (långt bort) efter **det närmaste av kantens två hörn**, och
varje inre nivå är den största av de två yttre nivåer som är parallella med den.

learnopengls tal – nivåerna 4 till 64 mellan 20 och 800 enheter – är gjorda för dess terräng på 2,6 tusen pixlar. Kursens
terräng är 256 enheter bred och syns från 240 till 450 enheters avstånd, så den använder **2 till 8 mellan 250 och 450**:
framkanten får nivå 8, bakkanten ungefär 2.

:::opengl
```glsl
        const int MIN_TESS_LEVEL = 2;
        const int MAX_TESS_LEVEL = 8;
        const float MIN_DISTANCE = 250;
        const float MAX_DISTANCE = 450;

        // the corners in eye space (the camera looks along -z)
        vec4 eyeSpacePos00 = view * model * gl_in[0].gl_Position;
        vec4 eyeSpacePos01 = view * model * gl_in[1].gl_Position;
        vec4 eyeSpacePos10 = view * model * gl_in[2].gl_Position;
        vec4 eyeSpacePos11 = view * model * gl_in[3].gl_Position;

        // "distance" from camera scaled between 0 and 1
        float distance00 = clamp((abs(eyeSpacePos00.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);
        float distance01 = clamp((abs(eyeSpacePos01.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);
        float distance10 = clamp((abs(eyeSpacePos10.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);
        float distance11 = clamp((abs(eyeSpacePos11.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0, 1.0);

        // each edge from its nearer corner (two patches sharing an edge compute the same level: no cracks)
        float tessLevel0 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance10, distance00));
        float tessLevel1 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance00, distance01));
        float tessLevel2 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance01, distance11));
        float tessLevel3 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance11, distance10));

        gl_TessLevelOuter[0] = tessLevel0;
        gl_TessLevelOuter[1] = tessLevel1;
        gl_TessLevelOuter[2] = tessLevel2;
        gl_TessLevelOuter[3] = tessLevel3;

        gl_TessLevelInner[0] = max(tessLevel1, tessLevel3);
        gl_TessLevelInner[1] = max(tessLevel0, tessLevel2);
```

Control shadern använder nu uniformerna `model` och `view`, som programmet sätter på shadern som förut.
:::
:::vulkan
learnopengls kod, med matriserna från uniform-blocket och push constanten:

```glsl
        // the corners in eye space (the camera looks along -z)
        vec4 eyeSpacePos00 = ubo.view * pc.model * gl_in[0].gl_Position;
        vec4 eyeSpacePos01 = ubo.view * pc.model * gl_in[1].gl_Position;
        vec4 eyeSpacePos10 = ubo.view * pc.model * gl_in[2].gl_Position;
        vec4 eyeSpacePos11 = ubo.view * pc.model * gl_in[3].gl_Position;
```

sedan `distance00` … `distance11` som `clamp((abs(eyeSpacePos00.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0,
1.0)`, de fyra kantnivåerna `tessLevel0 = mix(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance10, distance00));` … (kant 1 från
hörnen 00 och 01, kant 2 från 01 och 11, kant 3 från 11 och 10), och `gl_TessLevelInner[0] = max(tessLevel1, tessLevel3);
gl_TessLevelInner[1] = max(tessLevel0, tessLevel2);`, med `MIN_TESS_LEVEL = 2`, `MAX_TESS_LEVEL = 8`, `MIN_DISTANCE = 250`
och `MAX_DISTANCE = 450`. Uniform buffern och push constanten är synliga för control-steget sedan evaluation-uppgiften.
:::
:::d3d12
learnopengls kod i patchkonstantfunktionen – `lerp` för `mix`, och radvektorprodukterna för positionerna i ögats rum:

```hlsl
    // the corners in eye space (the camera looks along -z)
    float4 eyeSpacePos00 = mul(mul(patch[0].position, model), view);
    float4 eyeSpacePos01 = mul(mul(patch[1].position, model), view);
    float4 eyeSpacePos10 = mul(mul(patch[2].position, model), view);
    float4 eyeSpacePos11 = mul(mul(patch[3].position, model), view);
```

```hlsl
    float tessLevel0 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance10, distance00));
    float tessLevel1 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance00, distance01));
    float tessLevel2 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance01, distance11));
    float tessLevel3 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance11, distance10));

    output.edges[0] = tessLevel0;
    output.edges[1] = tessLevel1;
    output.edges[2] = tessLevel2;
    output.edges[3] = tessLevel3;

    // the inside: the larger level of its two parallel edges
    output.inside[0] = max(tessLevel1, tessLevel3);
    output.inside[1] = max(tessLevel0, tessLevel2);
```

med `distance00` … `distance11` som `clamp((abs(eyeSpacePos00.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0f,
1.0f)` och `MIN_TESS_LEVEL = 2`, `MAX_TESS_LEVEL = 8`, `MIN_DISTANCE = 250`, `MAX_DISTANCE = 450`. Patchkonstantfunktionen
läser constant bufferns matriser – dess tabell är synlig för alla shaders sedan height-texture-uppgiften.
:::

### Sprickor

Varför *det närmaste hörnet på kanten*, och inte till exempel patchens mittpunkt? På grund av **sprickor** (cracks). Två
närliggande patches delar en kant. Om var och en räknade ut kantens nivå ur något eget – sin mittpunkt, sitt närmaste hörn
över huvud taget – kunde de två ge den delade kanten olika nivåer: den ena delar den i 8 segment, den andra i 5. Punkterna
längs kanten hamnar då på olika ställen på de två sidorna, höjderna som läses där skiljer sig, och en smal springa öppnar
sig i terrängen där bakgrunden lyser igenom. Att räkna ut en kants nivå enbart ur kantens egna två hörn garanterar att
båda patcharna räknar fram exakt samma värde, så att deras punkter möts. De inre nivåerna får skilja sig fritt: de påverkar
bara insidan av en patch.

```quiz
Två närliggande patches delar en kant. Patch A räknar fram kantens yttre nivå till 8, patch B till 5. Vad kan du se?
- [ ] Ingenting: evaluation shadern interpolerar över patcharna
- [ ] Patchen med den lägre nivån ritas mörkare
- [x] Sprickor: kantens punkter hamnar på olika ställen på de två sidorna, de läser olika höjder, och springor öppnar sig mellan patcharna
- [ ] Tessellatorn förkastar båda patcharna
---
Båda sidor av en delad kant måste delas likadant. learnopengls regel – en kants nivå beror bara på kantens två hörn – får båda patcharna att räkna fram samma nivå, oavsett deras övriga hörn.
```

Gör nu den sista uppgiften, **distance-levels**. Bygg och kör: terrängens framkant förblir lika tät som förut, medan
trådmodellen längst bak öppnar sig i stora trianglar – en nivå nära 2 ger tre segment per kant i stället för nio.
Terrängens form är oförändrad vid en hastig blick: de avlägsna patcharna täcker så få pixlar att de extra trianglarna ändå
var osynliga. Flytta kameran (i ditt eget projekt) så följer nivåerna med varje bildruta.

## Att gå vidare

learnopengls terräng är utgångspunkten; riktiga terrängrenderare lägger till:

- **Nivåer i skärmrummet.** Avståndet är en ersättning för det som verkligen spelar roll: hur många pixlar en kant täcker.
  Att projicera kanten på skärmen och välja nivån för en önskad triangelstorlek i pixlar anpassar sig även efter synfältet
  och upplösningen.
- **Att culla patches.** En patch utanför frustumet kan få nivå 0 – tessellatorn kastar den då – så att evaluation shadern
  aldrig körs för den. Dess avgränsningslåda måste inkludera höjderna, som control shadern kan läsa ur en textur med
  minsta och största höjd per patch.
- **Belysning.** Normalerna kan räknas ut i evaluation shadern ur närliggande höjdsampel, eller läsas ur en normalkarta
  bakad ur höjdkartan.
- **Förskjutning på modeller.** Samma steg förfinar figurer och föremål: ett grovt mesh med en förskjutningskarta får
  detaljer nära kameran. Nyare hårdvara erbjuder också *mesh shaders*, som ersätter hela främre delen med vertex-,
  tesselleringssteg och geometry shader med compute-liknande steg.

## Mer att läsa

- [Tessellation](https://learnopengl.com/Guest-Articles/2021/Tessellation/Tessellation): learnopengls gästartikel som det
  här kapitlet följer, med bilder av tessellatorns mönster.
- [terrain_gpu_dist](https://github.com/JoeyDeVries/LearnOpenGL/tree/master/src/8.guest/2021/3.tessellation/terrain_gpu_dist):
  learnopengls demo med avståndsberoende nivåer.

:::opengl
- [Tessellation (OpenGL Wiki)](https://www.khronos.org/opengl/wiki/Tessellation): stegen, nivåerna för varje primitivtyp
  och fördelningslägena.
- [glPatchParameter](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPatchParameter.xhtml): patchstorleken och
  standardnivåerna.
:::
:::vulkan
- [Tessellation (Vulkan specification)](https://docs.vulkan.org/spec/latest/chapters/tessellation.html): tessellatorn,
  nivåerna och fördelningen.
- [VkPipelineTessellationStateCreateInfo](https://registry.khronos.org/vulkan/specs/latest/man/html/VkPipelineTessellationStateCreateInfo.html):
  antalet kontrollpunkter per patch.
:::
:::d3d12
- [Tessellation stages](https://learn.microsoft.com/en-us/windows/win32/direct3d11/direct3d-11-advanced-stages-tessellation):
  hull shadern, tessellatorn och domain shadern.
- [Hull shader design](https://learn.microsoft.com/en-us/windows/win32/direct3d11/direct3d-11-advanced-stages-hull-shader-design):
  funktionen per kontrollpunkt och patchkonstantfunktionen.
:::
