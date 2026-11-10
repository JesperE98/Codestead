# Diffus irradians

IBL, *image based lighting* (bildbaserad belysning), är en samling tekniker för att belysa föremål, inte med direkta
analytiska ljus som i förra kapitlet, utan genom att behandla den omgivande miljön som en enda stor ljuskälla. I regel
gör man det genom att bearbeta en environment map i form av en cube map (tagen från verkligheten eller genererad från en
3D-scen) så att vi kan använda den direkt i våra belysningsekvationer: varje texel i cube mappen behandlas som en
ljuskälla. På så sätt kan vi fånga en miljös globala belysning och allmänna känsla, och föremålen ser ut att höra hemma i
sin omgivning.

Eftersom IBL-algoritmer fångar belysningen från en (global) miljö räknas indata som en mer exakt form av ambient ljus,
till och med en grov approximation av global belysning. Det gör IBL intressant för PBR, eftersom föremål ser betydligt
mer fysikaliskt korrekta ut när vi tar med omgivningens belysning.

För att börja föra in IBL i vårt PBR-system tittar vi igen snabbt på reflektansekvationen:

```text
  Lo(p, ωo) = ∫Ω  ( kd · c / π  +  (D · F · G) / (4 · (ωo · n) · (ωi · n)) ) · Li(p, ωi) · (n · ωi)  dωi
```

Som tidigare beskrivits är vårt huvudmål att lösa integralen över alla inkommande ljusriktningar ωi över halvsfären Ω.
I förra kapitlet var det lätt att lösa integralen, eftersom vi i förväg visste exakt vilka få ljusriktningar ωi som
bidrog. Den här gången kan däremot varje inkommande ljusriktning ωi från omgivningen ha en viss radians, och då är
integralen inte lika enkel att lösa. Det ger oss två huvudkrav för att lösa integralen:

- Vi behöver ett sätt att hämta scenens radians för en godtycklig riktningsvektor ωi.
- Integralen måste lösas snabbt, i realtid.

Det första kravet är ganska enkelt. Vi har redan antytt det: ett sätt att representera en miljös eller scens irradians
är i form av en (bearbetad) environment-cube map. Med en sådan cube map kan vi se varje texel som en enda ljuskälla.
Genom att sampla cube mappen med en godtycklig riktningsvektor ωi hämtar vi scenens radians från den riktningen.

Att hämta scenens radians för en riktningsvektor ωi är då så enkelt som:

```glsl
vec3 radiance = texture(_cubemapEnvironment, w_i).rgb;
```

För att lösa integralen måste vi ändå sampla environment mappen inte bara från en riktning, utan från alla möjliga
riktningar ωi över halvsfären Ω, och det är alldeles för dyrt för varje anrop av fragment shadern. För att lösa
integralen effektivare vill vi *förbearbeta* eller *beräkna i förväg* det mesta. För det måste vi titta lite närmare på
reflektansekvationen:

```text
  Lo(p, ωo) = ∫Ω  ( kd · c / π  +  (D · F · G) / (4 · (ωo · n) · (ωi · n)) ) · Li(p, ωi) · (n · ωi)  dωi
```

Tittar vi noga på reflektansekvationen ser vi att BRDF:ens diffusa term kd och spekulära term ks är oberoende av
varandra, och vi kan dela upp integralen i två:

```text
  Lo(p, ωo) = ∫Ω  kd · c / π · Li(p, ωi) · (n · ωi)  dωi
            + ∫Ω  (D · F · G) / (4 · (ωo · n) · (ωi · n)) · Li(p, ωi) · (n · ωi)  dωi
```

Genom att dela integralen i två delar kan vi behandla den diffusa och den spekulära termen var för sig; det här kapitlet
handlar om den diffusa integralen.

Tittar vi närmare på den diffusa integralen ser vi att den Lambertska diffusa termen är konstant (färgen c, brytnings-
andelen kd och π är konstanta över integralen) och inte beror på någon av integralens variabler. Därför kan vi flytta ut
den konstanta termen ur den diffusa integralen:

```text
  Lo(p, ωo) = kd · c / π · ∫Ω  Li(p, ωi) · (n · ωi)  dωi
```

Det ger oss en integral som bara beror på ωi (förutsatt att p ligger i environment mappens mittpunkt). Med den kunskapen
kan vi räkna ut i förväg en ny cube map som i varje samplingsriktning (eller texel) ωo lagrar den diffusa integralens
resultat genom *konvolution*.

Konvolution innebär att man gör en beräkning för varje element i en datamängd med hänsyn till alla andra element i
datamängden; datamängden är här scenens radians, alltså environment mappen. För varje samplingsriktning i cube mappen tar
vi alltså hänsyn till alla andra samplingsriktningar över halvsfären Ω.

För att konvolvera en environment map löser vi integralen för varje utgående samplingsriktning ωo genom att diskret
sampla ett stort antal riktningar ωi över halvsfären Ω och ta medelvärdet av deras radians. Halvsfären som vi bygger
samplingsriktningarna ωi från är riktad mot den utgående samplingsriktningen ωo som vi konvolverar.

Den här förberäknade cube mappen, som för varje samplingsriktning ωo lagrar integralens resultat, kan ses som den
förberäknade summan av allt indirekt diffust ljus i scenen som träffar en yta riktad längs ωo. En sådan cube map kallas
*irradiansmap* (irradiance map), eftersom den konvolverade cube mappen i praktiken låter oss sampla scenens
(förberäknade) irradians direkt från en godtycklig riktning ωo.

Radiansekvationen beror också på en position p, som vi har antagit ligger i irradiansmappens mittpunkt. Det betyder att
allt diffust indirekt ljus måste komma från en enda environment map, vilket kan bryta illusionen av verklighet
(särskilt inomhus). Renderingsmotorer löser det genom att placera *reflection probes* över hela scenen, där varje probe
räknar ut sin egen irradiansmap av omgivningen. Irradiansen (och radiansen) i positionen p blir då den interpolerade
irradiansen mellan de närmaste proberna. Tills vidare antar vi att vi alltid samplar environment mappen från dess mitt.

Eftersom varje texel i cube mappen lagrar det konvolverade resultatet (i riktningen ωo) ser irradiansmappen ut ungefär
som en medelfärg eller medelbelysning av omgivningen. Samplar man en riktning i den får man scenens irradians i just den
riktningen.

```quiz
Varför konvolverar projektet omgivningen till en irradiansmap en gång, i stället för att summera omgivningens ljus över halvsfären i sfärernas fragment shader?
- [ ] Eftersom en fragment shader inte kan sampla en cube map med en riktning
- [x] Eftersom den diffusa integralen bara beror på normalens riktning: den kan räknas ut en gång för varje riktning, lagras i en liten cube map och sedan läsas med en enda uppslagning per fragment – att summera ungefär tusen samples per fragment och bildruta skulle vara alldeles för långsamt
- [ ] Eftersom irradiansmappen är skarpare än environment mappen
- [ ] Eftersom sfärernas fragment shader inte kommer åt omgivningens HDR-värden
---
När den Lambertska termen har flyttats ut är det som återstår i integralen en funktion av normalen ensam – en funktion på riktningarnas sfär, precis vad en cube map lagrar. 32 × 32 texlar per sida räcker eftersom funktionen ändras långsamt.
```

## Projektet

Projektet börjar där förra kapitlets uppgift `tone-map` slutade: de 7 × 7 röda sfärerna med hela reflektansekvationen för
de fyra punktljusen, Reinhard och gamma i slutet av shadern, och den konstanta ambienta termen `0.03 * albedo * ao`. (De
texturerade sfärerna kommer tillbaka i nästa kapitels sista uppgift.) Kameran står fortfarande på (0, 0, 22). Nytt i
projektet är en omgivningsbild och shadrarna för tre pass som än så länge är TODO, och en kub: learnopengls
`renderCube()`, de tidigare kapitlens kub på 2 × 2 × 2 med 36 vertex, av vilka bara positionerna används här.

Omgivningen är kursens egen: `environment.hdr`, en ekvirektangulär HDR-bild på 512 × 256 av en himmel med moln och en
ljus, disig sol, gröna kullar vid horisonten, en gråbrun mark och tre färgade lampor (learnopengl använder
`newport_loft.hdr`, ett foto av en loftvåning). Kameran tittar längs -z, mot mitten av bildens vänstra halva: blekt
blågrå himmel upptill, mörkgröna kullar vid horisonten (högre till vänster i fönstret), marken nedtill. Solen – uppe, till
höger och *bakom* kameran – och lamporna är utanför bilden, men de kommer att belysa sfärerna framifrån.

Två tal är mindre än learnopengls, eftersom den inbyggda simulatorn körs på processorn (en riktig GPU klarar learnopengls
värden lätt): environment-cube mappen har 128 × 128 texlar per sida i stället för 512 × 512, och konvolutionen samplar
halvsfären med steget 0.1 i stället för 0.025 – 1008 samples per texel i stället för ungefär 16 000.

:::opengl
`main.cpp` har shaderobjekten från learnopengls IBL-demo: sfärernas shader heter nu `pbrShader`. De nya filerna är
`cubemap.vs` (färdig), `equirectangular_to_cubemap.fs`, `irradiance_convolution.fs`, `background.vs` och `background.fs`
(deras innehåll är TODO). `loadTexture` finns kvar, oanvänd.
:::
:::vulkan
`main.cpp` kallar nu sfärernas pipeline `pbrPipeline`. Förberett: den globala `vertices` med learnopengls kub (sfärens
`Vertex`-struct, tangenten lämnad noll), dess `vertexBuffer` och `renderCube(VkCommandBuffer)` (`vkCmdBindVertexBuffers`
+ `vkCmdDraw(commandBuffer, 36, 1, 0, 0)`). I `shaders/` finns `cubemap.vert` (färdig), `equirectangular_to_cubemap.frag`,
`irradiance_convolution.frag`, `background.vert` och `background.frag` (stubbar som kompilerar men inte används ännu).
TODO-kommentarerna i `main.cpp` markerar medlemmarna, pipelinerna, bilderna, inspelningen, bakgrundens ritanrop och
städningen.
:::
:::d3d12
`main.cpp` har en andra vertex buffer `m_cubeVertexBuffer` med learnopengls kub (samma `Vertex`-struct, tangenten noll)
och hjälpfunktionen `RenderCube()` (`IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST)`, `IASetVertexBuffers`,
`DrawInstanced(36, 1, 0, 0)`) – varje ritanrop sätter sin egen topologi, så sfärernas strip och kubens lista kan följa på
varandra utan någon annan ändring. De nya shaderfilerna är `cubemap.hlsl` (färdig: capture-passens vertex shader),
`equirectangular_to_cubemap.hlsl` och `irradiance_convolution.hlsl` (var sin `PSMain`, innehållet TODO) och
`background.hlsl` (`VSMain` och `PSMain`, innehållet TODO). `LoadTexture` finns kvar, oanvänd.
:::

## PBR och HDR

Vi nämnde det kort i kapitlet *HDR*: att ta hänsyn till det höga dynamiska omfånget i scenens belysning är oerhört
viktigt i en PBR-pipeline. Eftersom PBR bygger de flesta av sina indata på verkliga fysikaliska egenskaper och mätningar
är det rimligt att låta de inkommande ljusvärdena ligga nära sina fysikaliska motsvarigheter. Oavsett om vi gör
välgrundade gissningar om varje ljus strålningsflöde eller använder dess direkta fysikaliska motsvarighet är skillnaden
mellan en enkel glödlampa och solen stor. Utan en HDR-renderingsmiljö är det omöjligt att ange varje ljus relativa
intensitet korrekt.

PBR och HDR hör alltså ihop, men hur hänger det ihop med bildbaserad belysning? Vi såg i förra kapitlet att det är ganska
enkelt att få PBR att fungera i HDR. Men eftersom vi vid bildbaserad belysning baserar omgivningens indirekta
ljusintensitet på färgvärdena i en environment-cube map behöver vi ett sätt att lagra belysningens höga dynamiska omfång
i en environment map.

De environment maps vi har använt hittills som cube maps (till exempel som skyboxar) har lågt dynamiskt omfång (LDR). Vi
använde deras färgvärden från de enskilda sidbilderna direkt, mellan 0.0 och 1.0, och bearbetade dem som de var. Det kan
fungera bra för det visuella, men som fysikaliska indataparametrar fungerar det inte.

### Radiance-HDR-formatet

Här kommer radiance-formatet in. Radiance-formatet (med filändelsen `.hdr`) lagrar en hel cube map med alla 6 sidor som
flyttalsdata. Det låter oss ange färgvärden utanför intervallet 0.0 till 1.0 och ge ljusen deras korrekta
färgintensiteter. Formatet använder också ett smart trick för att lagra varje flyttal, inte som ett 32-bitarsvärde per
kanal, utan med 8 bitar per kanal där färgens alfakanal används som exponent (det kostar en del precision). Det fungerar
ganska bra, men kräver att programmet som läser filen omvandlar varje färg tillbaka till flyttal.

Det finns en hel del radiance-HDR-environment maps fritt tillgängliga, till exempel i sIBL-arkivet. De flesta är inte
lagrade som sex sidor utan som en enda bild, en *ekvirektangulär map*: riktningarnas sfär utvikt på en rektangel som är
dubbelt så bred som hög, med longituden åt sidan och latituden uppåt. Kursens `environment.hdr` är en sådan bild. Himlen
ser utsträckt ut, men bilden innehåller all information i en cube map: vi omvandlar den till en senare. De ljusa delarna
ligger långt över 1.0 – i kursens bild har solen radiansen ungefär 60 – och det är de värdena som låter omgivningen
*belysa* scenen i stället för att bara synas bakom den.

### HDR och stb_image.h

Att läsa radiance-HDR-bilder direkt kräver viss kunskap om filformatet, vilket inte är särskilt svårt men ändå
omständligt. Som tur är har det populära enfilsbiblioteket `stb_image.h` stöd för att läsa radiance-HDR-bilder direkt som
en array av flyttal, vilket passar oss perfekt. Med `stb_image` i projektet är det så här enkelt att ladda en HDR-bild:

:::opengl
```cpp
    stbi_set_flip_vertically_on_load(true);
    int width, height, nrComponents;
    float *data = stbi_loadf("environment.hdr", &width, &height, &nrComponents, 0);
    unsigned int hdrTexture = 0;
    if (data)
    {
        glGenTextures(1, &hdrTexture);
        glBindTexture(GL_TEXTURE_2D, hdrTexture);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB16F, width, height, 0, GL_RGB, GL_FLOAT, data); // note how we specify the texture's data value to be float

        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        stbi_image_free(data);
    }
    else
    {
        std::cout << "Failed to load HDR image." << std::endl;
    }
```

`stb_image.h` gör automatiskt om HDR-värdena till en lista med flyttal: 32 bitar per kanal och 3 kanaler per färg som
standard. Det är allt vi behöver för att lagra den ekvirektangulära HDR-environment mappen i en 2D-textur med flyttal:
`GL_RGB16F` behåller värdena över 1.0. Med vändningen är bildens översta rad – rakt uppåt – v = 1.
:::
:::vulkan
```cpp
    void loadHdrTexture(const char* path, VkImage& image, VkDeviceMemory& imageMemory, VkImageView& imageView) {
        stbi_set_flip_vertically_on_load(true);
        int width, height, nrComponents;
        float* data = stbi_loadf(path, &width, &height, &nrComponents, STBI_rgb_alpha);

        if (!data) {
            throw std::runtime_error("failed to load HDR image!");
        }

        // linear filtering of 32-bit float images is optional in Vulkan (desktop GPUs have it): check before relying on it
        VkFormat format = findSupportedFormat(
            {VK_FORMAT_R32G32B32A32_SFLOAT},
            VK_IMAGE_TILING_OPTIMAL,
            VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT | VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT
        );

        VkDeviceSize imageSize = width * height * 4 * sizeof(float);
        createTextureImage(data, imageSize, width, height, 1, format, image, imageMemory);
        stbi_image_free(data);

        imageView = createImageView(image, format, VK_IMAGE_ASPECT_COLOR_BIT, 1);
    }
```

`stb_image.h` gör om HDR-värdena till en lista med 32-bitars flyttal; begär man `STBI_rgb_alpha` får man fyra per pixel,
layouten för `VK_FORMAT_R32G32B32A32_SFLOAT` (format med tre kanaler stöds sällan för bilder). Värdena förblir som de är –
långt över 1.0 för solen. Vulkan kräver inte att en enhet kan filtrera 32-bitars flyttalsbilder linjärt, så
`findSupportedFormat` kontrollerar `VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT` innan projektet förlitar sig på
det. Bilden vänds vid laddningen, som hos learnopengl, så den översta raden – rakt uppåt – är v = 1 och learnopengls
`SampleSphericalMap` fungerar oförändrad. `clampSampler` (linjär, `CLAMP_TO_EDGE`) läser den och cube mapparna.
:::
:::d3d12
`LoadHdrTexture` är `LoadTexture` för flyttal: `stbi_loadf(path, &width, &height, &nrComponents, 4)` (fyra flyttal per
pixel), en `DXGI_FORMAT_R32G32B32A32_FLOAT`-textur, uppladdad med `RowPitch = width * 4 * sizeof(float)`, dess SRV på
heap-plats 1. learnopengl använder `GL_RGB16F` med tre flyttal per pixel; Direct3D:s flyttalsformat med tre kanaler,
`R32G32B32_FLOAT`, behöver inte gå att filtrera, medan hårdvara för feature level 11.0 måste kunna filtrera
`R32G32B32A32_FLOAT`, som dessutom tar laddarens flyttal som de är. Bilden vänds *inte*: Direct3D:s v = 0 är bildens
översta rad – rakt uppåt. `SampleSphericalMap` vänder v i stället (se nedan). En statisk sampler s0
(`MIN_MAG_MIP_LINEAR`, CLAMP: learnopengls `GL_LINEAR` och `GL_CLAMP_TO_EDGE`) läser den och cube mapparna.
:::

```quiz
Varför laddas omgivningen med `stbi_loadf` i en flyttalstextur, och inte med `stbi_load` i en 8-bitarstextur som de tidigare texturerna?
- [ ] Eftersom `stbi_load` inte kan läsa `.hdr`-filer alls
- [ ] Eftersom flyttalstexturer filtreras mjukare
- [ ] Eftersom omvandlingen till cube map bara fungerar med flyttal som indata
- [x] Eftersom omgivningens radians går långt över 1.0 – solen ligger kring 60 –; en 8-bitarstextur skulle klippa den vid 1.0, och solen skulle inte belysa sfärerna mer än ett vitt moln
---
Omgivningen är bildbaserad belysnings ljuskälla, så dess värden måste vara fysikalisk, obegränsad radians. Varje textur på vägen – 2D-bilden, cube mappen, irradiansmappen – behåller flyttal av det skälet.
```

### Från ekvirektangulär map till cube map

Det går att använda den ekvirektangulära mappen direkt för uppslagningar i omgivningen, men de kan vara ganska dyra, och
då är en direkt cube map-sampling snabbare. Därför omvandlar vi i det här kapitlet först den ekvirektangulära bilden till
en cube map för vidare bearbetning. Observera att vi på vägen också visar hur man samplar en ekvirektangulär map som om
den vore en 3D-environment map, så du är fri att välja den lösning du föredrar.

För att omvandla en ekvirektangulär bild till en cube map ritar vi en (enhets)kub och projicerar den ekvirektangulära
mappen på alla kubens sidor inifrån, och tar 6 bilder av kubens sidor som cube map-sidor. Kubens vertex shader ritar helt
enkelt kuben som den är och skickar dess lokala position vidare till fragment shadern som en 3D-samplingsvektor:

:::opengl
```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

out vec3 WorldPos;

uniform mat4 projection;
uniform mat4 view;

void main()
{
    WorldPos = aPos;
    gl_Position =  projection * view * vec4(WorldPos, 1.0);
}
```
:::
:::vulkan
```glsl
layout(push_constant) uniform CapturePushConstants {
    mat4 projectionView;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;   // not used, but in the vertex buffer
layout(location = 2) in vec2 inTexCoord; // not used, but in the vertex buffer
layout(location = 3) in vec3 inTangent;  // not used, but in the vertex buffer

layout(location = 0) out vec3 fragWorldPos;

void main() {
    fragWorldPos = inPosition;
    gl_Position = pc.projectionView * vec4(fragWorldPos, 1.0);
}
```

Capture-passens matriser är en push constant, inte en uniform: de sex sidorna ritas i en enda command buffer, och en
uniform buffer kan inte ändras mellan ritanropen i en command buffer, medan en push constant kan det.
`CapturePushConstants` delar pipeline layoutens enda push constant-intervall med sfärernas `PushConstants`
(`pushConstantRange.size = std::max(sizeof(PushConstants), sizeof(CapturePushConstants))`).
:::
:::d3d12
```hlsl
cbuffer CaptureConstants : register(b0)
{
    float4x4 captureView;
    float4x4 captureProjection;
};

PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    result.worldPos = position;
    result.position = mul(mul(float4(position, 1.0f), captureView), captureProjection);

    return result;
}
```

Capture-passens matriser är root-konstanter på b0 – samma root-parameter 0 som sfärerna får sina `ModelConstants`
genom: varje pipelines shadrar läser sin egen cbuffer där. (De 38 värdena i `ModelConstants` är fler än de 32 i
`CaptureConstants`, så root-parametern är stor nog för båda.)
:::

I fragment shadern färgar vi varje del av kuben som om vi hade vikt den ekvirektangulära mappen prydligt runt kubens
sidor. För att åstadkomma det tar vi fragmentets samplingsriktning, interpolerad från kubens lokala position, och
använder sedan riktningsvektorn och lite trigonometrisk magi (sfäriska koordinater till kartesiska) för att sampla den
ekvirektangulära mappen som om den själv vore en cube map. Vi lagrar resultatet direkt i kubsidans fragment, och mer
behöver vi inte göra:

:::opengl
```glsl
const vec2 invAtan = vec2(0.1591, 0.3183);
vec2 SampleSphericalMap(vec3 v)
{
    vec2 uv = vec2(atan(v.z, v.x), asin(v.y));
    uv *= invAtan;
    uv += 0.5;
    return uv;
}

void main()
{
    vec2 uv = SampleSphericalMap(normalize(WorldPos));
    vec3 color = texture(equirectangularMap, uv).rgb;

    FragColor = vec4(color, 1.0);
}
```
:::
:::vulkan
```glsl
const vec2 invAtan = vec2(0.1591, 0.3183);
vec2 SampleSphericalMap(vec3 v) {
    vec2 uv = vec2(atan(v.z, v.x), asin(v.y));
    uv *= invAtan;
    uv += 0.5;
    return uv;
}

void main() {
    vec2 uv = SampleSphericalMap(normalize(fragWorldPos));
    vec3 color = texture(equirectangularMap, uv).rgb;

    outColor = vec4(color, 1.0);
}
```
:::
:::d3d12
```hlsl
static const float2 invAtan = float2(0.1591f, 0.3183f);
float2 SampleSphericalMap(float3 v)
{
    float2 uv = float2(atan2(v.z, v.x), asin(v.y));
    uv *= invAtan;
    uv += 0.5f;
    // Direct3D's v = 0 is the image's top row, where the sky is (learnopengl flips the
    // image when loading it instead: its v = 0 is the bottom row)
    uv.y = 1.0f - uv.y;
    return uv;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    float2 uv = SampleSphericalMap(normalize(input.worldPos));
    float3 color = equirectangularMap.Sample(clampSampler, uv).rgb;
    return float4(color, 1.0f);
}
```

GLSL:s `atan(y, x)` med två argument är HLSL:s `atan2(y, x)`.
:::

`atan(z, x)` är riktningens longitud, mellan -π och π; `asin(y)` dess latitud, mellan -π/2 och π/2. Multiplicerade med
(1/2π, 1/π) – 0.1591 och 0.3183 – och förskjutna med 0.5 blir båda texturkoordinater mellan 0 och 1.

Ritar du en kub mitt i scenen med en ekvirektangulär HDR-map får du något som ser ut som himlen vikt runt en låda. Det
visar att vi verkligen har avbildat en ekvirektangulär bild på en kubisk form, men det hjälper oss ännu inte att omvandla
HDR-källbilden till en cube map-textur. För det måste vi rita samma kub 6 gånger, mot var och en av kubens sidor, och
spara det visuella resultatet med ett framebuffer-objekt:

:::opengl
```cpp
    unsigned int captureFBO;
    unsigned int captureRBO;
    glGenFramebuffers(1, &captureFBO);
    glGenRenderbuffers(1, &captureRBO);

    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    glBindRenderbuffer(GL_RENDERBUFFER, captureRBO);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, 128, 128);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, captureRBO);
```

Sedan skapar vi förstås också motsvarande cube map-färgtexturer och reserverar minne för var och en av dess 6 sidor:

```cpp
    unsigned int envCubemap;
    glGenTextures(1, &envCubemap);
    glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);
    for (unsigned int i = 0; i < 6; ++i)
    {
        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB16F, 128, 128, 0, GL_RGB, GL_FLOAT, nullptr);
    }
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```
:::
:::vulkan
Motsvarigheten till learnopengls capture-framebuffer är en render pass för en sida, en cube map-bild och en vy plus en
framebuffer per sida. `createCaptureRenderPass(format, renderPass)` gör en render pass med en enda färgattachment i det
givna formatet (`VK_FORMAT_R16G16B16A16_SFLOAT` för cube mapparna) och ingen djupattachment:

```cpp
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE; // every pixel is written: no need to clear
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        ...
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

Kuben ses från sin mittpunkt, så inget kan skymma något och varje pixel i sidan täcks: varken djupbuffer eller rensning
behövs (learnopengl kopplar in en djup-renderbuffer och rensar ändå). Passet slutar med sidan redo att samplas, och två
subpass dependencies ordnar skrivningarna i förhållande till tidigare och senare läsningar i shadrar.

`createCubemap(size, mipLevels, image, memory, view)` gör cube mappen – en bild med **sex array-lager**, sidorna +X, -X,
+Y, -Y, +Z, -Z:

```cpp
        imageInfo.flags = VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT; // its six layers can be viewed as a cube map
        ...
        imageInfo.arrayLayers = 6; // one layer per face
        imageInfo.format = VK_FORMAT_R16G16B16A16_SFLOAT;
        ...
        imageInfo.usage = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT;
```

och dess vy med `viewInfo.viewType = VK_IMAGE_VIEW_TYPE_CUBE` över de sex lagren, genom vilken shadrarna samplar den med
en riktning – djup-cube mappen i kapitlet *Punktskuggor* gjordes på samma sätt.
:::
:::d3d12
Motsvarigheten till learnopengls capture-framebuffer är en render target view av en sida. Själva cube mappen är en
2D-textur med sex array-skivor, sidorna +X, -X, +Y, -Y, +Z, -Z, som får vara render target och skapas i tillståndet
`RENDER_TARGET` eftersom den ritas i först:

```cpp
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 128, 128, 6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
```

Dess SRV på heap-plats 2 har `ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE`, så shadrar läser den som en
`TextureCube` med en riktning. För att rita i en sida skriver `SetCaptureTarget` en vy av den sidan i den enda lediga
RTV-descriptorn (plats `FrameCount` i RTV-heapen, som växer till `FrameCount + 1`) och binder den:

```cpp
void D3D12App::SetCaptureTarget(ID3D12Resource* cubemap, UINT face, UINT mip)
{
    // The view covers one array slice (the face) of one mip level of the cube map.
    D3D12_RENDER_TARGET_VIEW_DESC rtvDesc = {};
    rtvDesc.Format = DXGI_FORMAT_R16G16B16A16_FLOAT;
    rtvDesc.ViewDimension = D3D12_RTV_DIMENSION_TEXTURE2DARRAY;
    rtvDesc.Texture2DArray.MipSlice = mip;
    rtvDesc.Texture2DArray.FirstArraySlice = face;
    rtvDesc.Texture2DArray.ArraySize = 1;

    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
    m_device->CreateRenderTargetView(cubemap, &rtvDesc, rtvHandle);
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
}
```

Det är learnopengls `glFramebufferTexture2D(…, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, cubemap, mip)` på dess enda
`captureFBO`. Att återanvända en descriptor för alla sidor fungerar eftersom `OMSetRenderTargets` kopierar descriptorns
innehåll till command listen när anropet spelas in – RTV-heapar är inte synliga för shadrar –, så platsen är ledig igen
direkt efter anropet. Ingen djupbuffer och ingen rensning: kuben ses från sin mittpunkt, inget kan skymma något och varje
pixel i sidan täcks. Capture-passens pipeline states har `DepthEnable = FALSE` och `DSVFormat = DXGI_FORMAT_UNKNOWN`, och
`RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT`.
:::

Det som återstår är att föra över den ekvirektangulära 2D-texturen till cube mappens sidor.

Jag går inte igenom detaljerna, eftersom koden bygger på det vi tog upp i kapitlen *Framebuffers* och *Punktskuggor*,
men i grunden handlar det om att ställa in 6 olika vymatriser (mot var och en av kubens sidor), en projektionsmatris med
90 graders synfält som fångar hela sidan, och rita en kub 6 gånger och lagra resultaten i en framebuffer med flyttal:

:::opengl
```cpp
    glm::mat4 captureProjection = glm::perspective(glm::radians(90.0f), 1.0f, 0.1f, 10.0f);
    glm::mat4 captureViews[] =
    {
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(-1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  1.0f,  0.0f), glm::vec3(0.0f,  0.0f,  1.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f, -1.0f,  0.0f), glm::vec3(0.0f,  0.0f, -1.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  0.0f,  1.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  0.0f, -1.0f), glm::vec3(0.0f, -1.0f,  0.0f))
    };

    // pbr: convert HDR equirectangular environment map to cubemap equivalent
    // ----------------------------------------------------------------------
    equirectangularToCubemapShader.use();
    equirectangularToCubemapShader.setInt("equirectangularMap", 0);
    equirectangularToCubemapShader.setMat4("projection", captureProjection);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, hdrTexture);

    glViewport(0, 0, 128, 128); // don't forget to configure the viewport to the capture dimensions.
    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    for (unsigned int i = 0; i < 6; ++i)
    {
        equirectangularToCubemapShader.setMat4("view", captureViews[i]);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, envCubemap, 0);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        renderCube();
    }
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Vi tar framebufferns färgattachment och byter dess texturmål för varje sida i cube mappen, så att scenen ritas direkt i
en av cube mappens sidor. När den rutinen är klar (vilket bara behöver göras en gång) bör cube mappen `envCubemap` vara
cube map-versionen av vår ursprungliga HDR-bild. Innan renderloopen börjar sätts viewporten tillbaka till fönstrets
storlek (`glfwGetFramebufferSize` och `glViewport`) – inspelningen ändrade den.

Varför uppvektorerna (0, -1, 0) för de fyra sidoytorna? OpenGL:s cube map-sidor adresseras med bildens origo uppe till
vänster – en konvention som togs över från RenderMan –, till skillnad från alla andra OpenGL-texturer. learnopengls vyer
ritar varje bild "upp och ner" i sin sida, så att en sampling av cube mappen med en riktning ger rätt texel.
:::
:::vulkan
`renderToCubemap(pipeline, descriptorSet, cubemapImage, size)` innehåller learnopengls matriser och gör de sex passen:

```cpp
        glm::mat4 captureProjection = glm::perspective(glm::radians(90.0f), 1.0f, 0.1f, 10.0f);
        glm::mat4 captureViews[] = {
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(-1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  1.0f,  0.0f), glm::vec3(0.0f,  0.0f,  1.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f, -1.0f,  0.0f), glm::vec3(0.0f,  0.0f, -1.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  0.0f,  1.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
            glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3( 0.0f,  0.0f, -1.0f), glm::vec3(0.0f, -1.0f,  0.0f))
        };
```

För varje sida skapar den en 2D-vy av just det lagret (`viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D`,
`subresourceRange.baseArrayLayer = i`, `layerCount = 1`) och en framebuffer med den vyn som färgattachment –
motsvarigheten till `glFramebufferTexture2D(…, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, …)`. Sedan spelar den in de sex
passen i en engångs-command buffer:

```cpp
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();
        ...
        for (uint32_t i = 0; i < 6; ++i) {
            ...
            vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

            vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipeline);
            vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &descriptorSet, 0, nullptr);

            CapturePushConstants constants{};
            constants.projectionView = captureProjection * captureViews[i];
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(CapturePushConstants), &constants);

            renderCube(commandBuffer);

            vkCmdEndRenderPass(commandBuffer); // face i is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL
        }

        endSingleTimeCommands(commandBuffer); // submits the command buffer and waits until it has run
```

med en viewport och scissor på `size` × `size` före loopen. Efteråt förstörs sidornas vyer och framebuffers igen – de
behövdes bara för de här passen. `initVulkan()` anropar `renderToCubemap(equirectangularToCubemapPipeline,
hdrDescriptorSet, envCubemapImage, 128)` när bilderna och descriptor seten finns och innan bildrutornas command buffer
skapas: precis som learnopengls inspelning före renderloopen körs den en gång.

En pipeline görs för en render pass och en sorts primitiv, så `createPipeline` får två parametrar, render passen och
topologin: sfärerna är en triangle strip i fönstrets pass, kuben en triangellista i capture-passet
(`equirectangularToCubemapPipeline`) och i fönstrets pass (`backgroundPipeline`). Bilderna binds via descriptor sets:
layouten får en combined image sampler på bindning 1, och `createTextureDescriptorSet(imageView, sampler, descriptorSet)`
gör ett set med uniform buffern och en bild – `hdrDescriptorSet` för HDR-bilden, `envDescriptorSet` för cube mappen. Att
binda ett av dem före ett ritanrop är Vulkans `glBindTexture`. Poolen växer till 3 set.

**Ingen y-vändning i `captureProjection`.** Fönstrets projektion har `proj[1][1] *= -1`, som i alla kapitel, men
capture-passens har det inte. En cube map-uppslagning väljer sida och texel med samma tabell i OpenGL och Vulkan, så
lagren måste innehålla exakt de texlar som OpenGL:s sidor innehåller. I ett capture-pass hamnar NDC y = -1 på ett lagers
rad 0 i Vulkan, vars framebuffer-y pekar nedåt – och OpenGL skriver också NDC y = -1 till rad 0, eftersom dess rad 0 är
den nedersta. Med learnopengls matriser oförändrade innehåller lagren alltså samma texlar i båda API:erna. learnopengls
uppvektorer (0, -1, 0) för sidoytorna kommer från cube map-konventionen (sidornas bilder har origo uppe till vänster).
:::
:::d3d12
`LoadAssets` innehåller learnopengls matriser, skrivna med DirectXMath:

```cpp
    XMMATRIX captureProjection = XMMatrixPerspectiveFovRH(XMConvertToRadians(90.0f), 1.0f, 0.1f, 10.0f) * XMMatrixScaling(1.0f, -1.0f, 1.0f);
    XMVECTOR eye = XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f);
    XMMATRIX captureViews[] =
    {
        XMMatrixLookAtRH(eye, XMVectorSet( 1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet(-1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f,  1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f,  1.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f, -1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f, -1.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f,  0.0f,  1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)),
        XMMatrixLookAtRH(eye, XMVectorSet( 0.0f,  0.0f, -1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f))
    };
```

och spelar in de sex passen i command listen – den som också bär texturuppladdningarna och körs i slutet av `LoadAssets`,
före första bildrutan (learnopengl gör sin inspelning före renderloopen):

```cpp
        m_commandList->SetPipelineState(m_equirectangularToCubemapPipelineState.Get());
        // The texture the pass reads (root parameter 2): the HDR texture, heap slot 1.
        CD3DX12_GPU_DESCRIPTOR_HANDLE hdrTexture(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
        m_commandList->SetGraphicsRootDescriptorTable(2, hdrTexture);

        CD3DX12_VIEWPORT viewport(0.0f, 0.0f, 128.0f, 128.0f); // don't forget to configure the viewport to the capture dimensions.
        CD3DX12_RECT scissorRect(0, 0, 128, 128);
        m_commandList->RSSetViewports(1, &viewport);
        m_commandList->RSSetScissorRects(1, &scissorRect);

        CaptureConstants captureConstants = {};
        XMStoreFloat4x4(&captureConstants.captureProjection, XMMatrixTranspose(captureProjection));
        for (unsigned int i = 0; i < 6; ++i)
        {
            XMStoreFloat4x4(&captureConstants.captureView, XMMatrixTranspose(captureViews[i]));
            m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(CaptureConstants) / 4, &captureConstants, 0);
            SetCaptureTarget(m_envCubemap.Get(), i, 0);

            // No clear: the cube covers every pixel of the face.
            RenderCube();
        }

        // The cube map is complete: from now on shaders read it.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_envCubemap.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);
```

Precis som en bildruta behöver passen först `SetGraphicsRootSignature`, `SetDescriptorHeaps` och CBV:ns tabell. Root
signaturen har nu en tredje parameter – en tabell med **en SRV (t0)**, texturen som det aktuella passet läser:
HDR-bilden för konverteringen – och den statiska CLAMP-samplern. Barriären gör alla sex sidor till shader resources på en
gång (`Transition` täcker alla subresurser som standard). Viewporten behöver inte återställas: `PopulateCommandList`
sätter fönstrets viewport i varje bildruta.

**Y-vändningen i `captureProjection`.** Cube map-sidor adresseras på samma sätt i OpenGL och Direct3D, men en render
targets första rad är bildens *överkant* i Direct3D (NDC y = +1) och underkanten i OpenGL. Med learnopengls vyer och
uppvektorer skulle varje sida lagras upp och ner; skalningen med (1, -1, 1) efter projektionen rättar till det –
skuggprojektionen i kapitlet *Punktskuggor* gjorde likadant. Ingenting cullas, så den omvända vindningen spelar ingen
roll. learnopengls uppvektorer (0, -1, 0) för sidoytorna kommer från cube map-konventionen (sidornas bilder har origo
uppe till vänster).
:::

:::opengl
```quiz
Hur ritar OpenGL-projektet i de sex sidorna av `envCubemap`?
- [x] Med en framebuffer, `captureFBO`: för varje sida kopplar `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, envCubemap, 0)` in sidan, och sedan ritas kuben med sidans vymatris
- [ ] Med sex framebuffers, var och en med egen djup-renderbuffer, som ritas parallellt
- [ ] Med ett enda ritanrop i en skiktad framebuffer, där en geometry shader väljer sida
- [ ] Genom att rita kuben i fönstret sex gånger och kopiera varje bild med `glCopyTexImage2D`
---
`GL_TEXTURE_CUBE_MAP_POSITIVE_X + i` är på varandra följande enum-värden för +X, -X, +Y, -Y, +Z, -Z, och det är learnopengls sex capture-vyer också. (Kapitlet Point shadows använde en geometry shader för att rita alla sex sidor på en gång; för en inspelning som görs en gång räcker sex enkla pass.)
```
:::
:::vulkan
```quiz
Hur ritar Vulkan-projektet i de sex sidorna av environment-cube mappen?
- [ ] Med en framebuffer vars attachment är kubvyn, och `vkCmdSetViewport` som väljer sida
- [ ] Med en geometry shader som skriver `gl_Layer`, i en enda render pass
- [x] För varje sida en 2D-bildvy av ett array-lager (`baseArrayLayer = i`) och en framebuffer med den, och sex render passes inspelade i en engångs-command buffer som `initVulkan()` skickar iväg och väntar på
- [ ] Genom att rita kuben i swap chain-bilden sex gånger och kopiera varje bild med `vkCmdCopyImage`
---
En framebuffers attachments är bildvyer, så en vy av ett lager är hur en sida blir render target. Kubvyn över alla sex lager är en annan vy av samma bild, som används för sampling.
```
:::
:::d3d12
```quiz
Hur ritar Direct3D 12-projektet i de sex sidorna av `m_envCubemap`?
- [ ] Med sex separata 2D-texturer, en per sida, som efteråt sätts ihop till en cube map med `CopyTextureRegion`
- [x] Med en render target view av en array-skiva per sida (`D3D12_RTV_DIMENSION_TEXTURE2DARRAY`, `FirstArraySlice = face`, `ArraySize = 1`), skriven i den enda lediga RTV-descriptorn före varje ritanrop och bunden med `OMSetRenderTargets`
- [ ] Med cube mappens `TEXTURECUBE`-SRV bunden som render target
- [ ] Med en geometry shader som skriver `SV_RenderTargetArrayIndex`, i ett enda ritanrop
---
En render target view anger exakt en mipnivå och de skivor den täcker. Eftersom `OMSetRenderTargets` läser descriptorn när anropet spelas in kan en och samma descriptorplats skrivas om för varje sida.
```
:::

:::opengl
```quiz
learnopengls capture-vyer använder uppvektorn (0, -1, 0) för de fyra sidoytorna. Varför?
- [ ] Eftersom inspelningens kamera står på huvudet i alla OpenGL-program
- [ ] Eftersom OpenGL:s NDC-y pekar nedåt
- [x] Eftersom OpenGL:s cube map-sidor adresseras med bildens origo uppe till vänster, till skillnad från andra OpenGL-texturer; med de här uppvektorerna hamnar bilderna i sidorna så att en uppslagning med en riktning ger rätt texel
- [ ] Det spelar ingen roll: alla uppvektorer ger samma cube map
---
Cube map-konventionen kommer från RenderMan. Vänd på en uppvektor så lagras sidans bild upp och ner – bakgrunden skulle visa himlen längst ner på varje sidoyta.
```
:::
:::vulkan
```quiz
Fönstrets projektion har `proj[1][1] *= -1`, men capture-projektionen i `renderToCubemap` har det inte. Varför blir cube mappen ändå rätt?
- [x] Eftersom en cube map-uppslagning väljer texel med samma tabell i båda API:erna, och i båda skriver ett capture-pass NDC y = -1 till rad 0 i lagret (i Vulkan är rad 0 framebufferns överkant, i OpenGL underkanten – men det är rad 0 i båda fallen); learnopengls oförändrade matriser fyller alltså lagren med samma texlar som OpenGL:s sidor
- [ ] Eftersom `GLM_FORCE_DEPTH_ZERO_TO_ONE` också vänder y
- [ ] Eftersom kuben inte cullas, så en vänd bild duger lika bra som en upprätt
- [ ] Det blir den inte: bakgrunden är upp och ner tills irradiansuppgiften vänder tillbaka den
---
Fönstret behöver vändningen eftersom en människa tittar på raderna där; en cube map tittar ingen direkt på, den samplas bara. Det som spelar roll är att varje texel i varje lager är den som uppslagningstabellen väntar sig.
```
:::
:::d3d12
```quiz
Varför slutar `captureProjection` med `* XMMatrixScaling(1.0f, -1.0f, 1.0f)` i Direct3D 12-projektet?
- [ ] Eftersom `XMMatrixPerspectiveFovRH` är en vänsterhänt projektion som måste speglas
- [ ] För att vända vindningen på kubens trianglar, så att insidorna inte cullas
- [ ] Eftersom Direct3D:s cube map-sidor lagras i en annan ordning än OpenGL:s
- [x] Eftersom Direct3D skriver bildens överkant (NDC y = +1) i en render targets första rad, OpenGL underkanten; cube map-sidor adresseras likadant i båda, så utan vändningen skulle varje sida lagras upp och ner
---
Med radvektorer vänder skalningen efter projektionen clip space-y. Skuggprojektionen i kapitlet Punktskuggor gjorde likadant för djup-cube mappen; ingenting cullas, så den omvända vindningen spelar ingen roll.
```
:::

Gör nu den första uppgiften, **environment-map**: ladda HDR-bilden, omvandla den till cube mappen en gång och rita cube
mappen som bakgrund (beskrivs härnäst).

### Bakgrunden

För att visa cube mappen bakom sfärerna – den kallas bakgrund här, eftersom den ritas på en kub runt kameran – behöver vi
en separat shader, learnopengls `background`-shadrar. Vertex shadern tar vymatrisen utan dess translation, så att kuben
stannar runt kameran hur långt den än flyttar sig, och skriver `xyww`: efter perspektivdivisionen är djupet 1.0, det
största värdet:

:::opengl
```glsl
void main()
{
    WorldPos = aPos;

    mat4 rotView = mat4(mat3(view));
    vec4 clipPos = projection * rotView * vec4(WorldPos, 1.0);

    gl_Position = clipPos.xyww;
}
```
:::
:::vulkan
```glsl
void main() {
    fragWorldPos = inPosition;

    mat4 rotView = mat4(mat3(ubo.view));
    vec4 clipPos = ubo.proj * rotView * vec4(fragWorldPos, 1.0);

    gl_Position = clipPos.xyww;
}
```
:::
:::d3d12
```hlsl
PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    result.worldPos = position;
    // (float3x3)view is the view matrix without its translation (learnopengl:
    // mat4(mat3(view))): the camera turns, but never gets nearer to the sky.
    float3 viewPosition = mul(position, (float3x3)view);
    float4 clipPos = mul(float4(viewPosition, 1.0f), projection);
    // z = w: after the perspective divide the depth is 1.0, the largest depth value.
    result.position = clipPos.xyww;

    return result;
}
```
:::

Fragment shadern samplar cube mappen med riktningen från kubens mittpunkt, på mipnivå 0 – environment mappen har inga
andra ännu – och eftersom omgivningen är i HDR tonmappar och gammakorrigerar den den som sfärerna:

:::opengl
```glsl
void main()
{
    vec3 envColor = textureLod(environmentMap, WorldPos, 0.0).rgb;

    // HDR tonemap and gamma correct
    envColor = envColor / (envColor + vec3(1.0));
    envColor = pow(envColor, vec3(1.0/2.2));

    FragColor = vec4(envColor, 1.0);
}
```

`main.cpp` sätter `glDepthFunc(GL_LEQUAL)` en gång i början och ritar bakgrunden sist, efter sfärerna, med
`backgroundShader`, dess `projection` och `view`, och `envCubemap` bunden:

```cpp
        // render skybox (render as last to prevent overdraw)
        backgroundShader.use();
        backgroundShader.setMat4("projection", projection);
        backgroundShader.setMat4("view", view);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);
        renderCube();
```
:::
:::vulkan
```glsl
void main() {
    vec3 envColor = textureLod(environmentMap, fragWorldPos, 0.0).rgb;

    // HDR tonemap and gamma correct
    envColor = envColor / (envColor + vec3(1.0));
    envColor = pow(envColor, vec3(1.0 / 2.2));

    outColor = vec4(envColor, 1.0);
}
```

`createPipeline` sätter `depthCompareOp = VK_COMPARE_OP_LESS_OR_EQUAL` (learnopengls `glDepthFunc(GL_LEQUAL)`) för alla
pipelines – för sfärerna ändrar det ingenting. `recordCommandBuffer()` ritar bakgrunden sist, efter sfärerna:

```cpp
        // render skybox (render as last to prevent overdraw)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, backgroundPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &envDescriptorSet, 0, nullptr);
        renderCube(commandBuffer);
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 envColor = environmentMap.SampleLevel(clampSampler, input.worldPos, 0.0f).rgb;

    // HDR tonemap and gamma correct
    envColor = envColor / (envColor + float3(1.0f, 1.0f, 1.0f));
    envColor = pow(envColor, 1.0f / 2.2f);

    return float4(envColor, 1.0f);
}
```

`m_backgroundPipelineState` görs av samma `psoDesc` som de andra, med `background.hlsl`, `RTVFormats[0] =
DXGI_FORMAT_R8G8B8A8_UNORM`, `DepthEnable = TRUE`, `DepthFunc = D3D12_COMPARISON_FUNC_LESS_EQUAL` och `DSVFormat =
DXGI_FORMAT_D32_FLOAT`. `PopulateCommandList` ritar bakgrunden sist, efter `RenderScene()`:

```cpp
    m_commandList->SetPipelineState(m_backgroundPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE envCubemap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, envCubemap);
    RenderCube();
```
:::

Djuptestet släpper bara igenom bakgrunden där dess djup 1.0 är mindre än *eller lika med* det som står i djupbuffern –
det rensade 1.0 där ingen sfär finns, så bakgrunden fyller allt runt sfärerna och inget framför dem. Att rita den sist
betyder att varje pixel som en sfär täcker underkänns tidigt i djuptestet, och den dyra uppslagningen i omgivningen görs
inte för den.

```quiz
Bakgrundskuben ritas sist med `gl_Position = clipPos.xyww` (`xyww` i HLSL) och djupfunktionen mindre än eller lika med. Vad åstadkommer det?
- [x] Efter perspektivdivisionen är dess djup w / w = 1.0, det mest avlägsna värdet: den klarar testet bara där djupbuffern fortfarande har det rensade 1.0, så den syns bakom varje sfär, och pixlar som sfärer täcker underkänns innan dess fragment shader körs
- [ ] Den flyttar kuben till det främre klipplanet, så att den ritas framför sfärerna med blending
- [ ] Den gör kuben oändligt stor, så att djuptestet inte behövs
- [ ] Den stänger av perspektivet för bakgrunden, så att himlen inte rör sig när kameran vrids
---
Med standardtestet mindre än skulle 1.0 < 1.0 underkännas överallt och bakgrunden försvinna. Kapitlet Cubemaps införde samma trick för sin skybox.
```

Tryck på **Build & run**: **himlen syns bakom sfärerna**. Blekt blågrå upptill, ett band av mörkgröna kullar vid
horisonten – högre till vänster i fönstret –, den gråbruna marken nedtill; den är rättvänd. Sidorna på 128 × 128 förstoras
ungefär tio gånger, så bakgrunden är mjuk. Sfärerna har inte ändrats: deras ambienta term är fortfarande konstanten.

Att omvandla en ekvirektangulär HDR-bild till en cube map var det första steget; en cube map är också vad konvolutionen
behöver, och med den syns omgivningen ordentligt bakom scenen. Nu går vi vidare till själva konvolutionen.

## Konvolution av cube mappen

Som beskrevs i början av kapitlet är vårt huvudmål att lösa integralen för allt diffust indirekt ljus, givet scenens
irradians i form av en environment-cube map. Vi vet att vi kan få scenens radians L(p, ωi) i en viss riktning genom att
sampla en HDR-environment map i riktningen ωi. För att lösa integralen måste vi för varje fragment sampla scenens radians
från alla möjliga riktningar inom halvsfären Ω.

Det är dock beräkningsmässigt omöjligt att sampla omgivningens ljus från varje möjlig riktning i Ω; antalet möjliga
riktningar är teoretiskt oändligt. Vi kan däremot approximera genom att ta ett ändligt antal riktningar eller samples,
jämnt fördelade eller slumpmässigt valda inom halvsfären, och få en ganska noggrann approximation av irradiansen; i
praktiken löser vi integralen diskret.

Det är ändå för dyrt att göra det för varje fragment i realtid, eftersom antalet samples måste vara stort för att
resultatet ska bli bra, så vi vill räkna ut det i förväg. Eftersom halvsfärens riktning avgör var vi fångar irradiansen
kan vi räkna ut irradiansen i förväg för varje möjlig riktning av halvsfären, kring alla utgående riktningar ωo:

```text
  Lo(p, ωo) = kd · c / π · ∫Ω  Li(p, ωi) · (n · ωi)  dωi
```

För en godtycklig riktningsvektor ωi i belysningspasset kan vi sedan sampla den förberäknade irradiansmappen och få den
totala diffusa irradiansen från riktningen ωi. För att bestämma mängden indirekt diffust (irradiant) ljus i en
fragmentyta hämtar vi den totala irradiansen från halvsfären kring ytans normal. Att få fram scenens irradians är då så
enkelt som:

```glsl
vec3 irradiance = texture(irradianceMap, N).rgb;
```

För att generera irradiansmappen måste vi nu konvolvera omgivningens ljus, omvandlat till en cube map. Eftersom ytans
halvsfär för varje fragment är riktad längs normalvektorn N betyder konvolution av en cube map att räkna ut den totala
medelradiansen från varje riktning ωi i halvsfären Ω kring N.

Som tur är har kapitlets omständliga förberedelser inte varit förgäves: vi kan nu ta den omvandlade cube mappen direkt,
konvolvera den i en fragment shader och fånga resultatet i en ny cube map med en framebuffer som ritar i alla 6
sidoriktningarna. Eftersom vi redan har ställt in det för att omvandla den ekvirektangulära environment mappen till en
cube map kan vi använda exakt samma angreppssätt, men med en annan fragment shader.

Eftersom kuben som vi ritar cube mappens sidor med är centrerad kring origo är kubens lokala position samplingsriktningen
ωo för varje utgående texel. Vi tar ωo som normalen N för en yta och summerar omgivningen över halvsfären kring den. Det
finns många sätt att konvolvera environment mappen, men i det här kapitlet genererar vi ett fast antal samplingsvektorer
för varje texel i cube mappen, längs en halvsfär Ω kring samplingsriktningen, och tar medelvärdet av resultaten.

Det fasta antalet samplingsvektorer fördelas jämnt inom halvsfären. Observera att en integral är en kontinuerlig
funktion, och att sampla den diskret med ett fast antal samplingsvektorer är en approximation. Ju fler samplingsvektorer
vi använder, desto bättre approximerar vi integralen.

Reflektansekvationens integral ∫ handlar om rymdvinkeln dω, som är ganska svår att arbeta med. I stället för att
integrera över rymdvinkeln dω integrerar vi över dess motsvarande sfäriska koordinater θ och φ. Vi använder azimutvinkeln
φ för att sampla runt halvsfärens ring mellan 0 och 2π, och zenitvinkeln θ mellan 0 och π/2 för att sampla halvsfärens
allt större ringar. Det ger oss den uppdaterade reflektansintegralen:

```text
  Lo(p, φo, θo) = kd · c / π · ∫(φ = 0..2π) ∫(θ = 0..π/2)  Li(p, φi, θi) · cos(θ) · sin(θ)  dθ dφ
```

För att lösa integralen tar vi ett fast antal diskreta samples inom halvsfären Ω och tar medelvärdet av resultaten. Det
gör om integralen till följande diskreta version, byggd på Riemannsumman med n1 och n2 diskreta samples för respektive
sfärisk koordinat:

```text
  Lo(p, φo, θo) ≈ kd · c / π · (2π / n1) · ((π/2) / n2) · Σφ Σθ  Li(p, φi, θj) · cos(θj) · sin(θj)

                = kd · c · π · (1 / n) · Σ  Li · cos θ · sin θ          (n = n1 · n2 samples)
```

Eftersom vi samplar båda sfäriska värdena diskret approximerar varje sample, eller tar medelvärdet över, ett område på
halvsfären. Observera att (på grund av en sfärs allmänna egenskaper) halvsfärens diskreta samplingsområden blir mindre ju
högre zenitvinkeln θ är, eftersom områdena konvergerar mot toppen. För att kompensera för de mindre områdena viktar vi
deras bidrag genom att skala med sin θ.

Att sampla halvsfären diskret utifrån integralens sfäriska koordinater blir följande fragmentkod:

:::opengl vulkan
```glsl
    vec3 irradiance = vec3(0.0);

    // tangent space calculation from origin point
    vec3 up    = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(up, N));
    up         = normalize(cross(N, right));

    float sampleDelta = 0.1;
    float nrSamples = 0.0;
    for(float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta)
    {
        for(float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta)
        {
            // spherical to cartesian (in tangent space)
            vec3 tangentSample = vec3(sin(theta) * cos(phi),  sin(theta) * sin(phi), cos(theta));
            // tangent space to world
            vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N;

            irradiance += texture(environmentMap, sampleVec).rgb * cos(theta) * sin(theta);
            nrSamples++;
        }
    }
    irradiance = PI * irradiance * (1.0 / float(nrSamples));
```

med `vec3 N = normalize(WorldPos);` före (`fragWorldPos` i Vulkan) och resultatet skrivet som färgen.
:::
:::d3d12
```hlsl
    float3 irradiance = float3(0.0f, 0.0f, 0.0f);

    // tangent space calculation from origin point
    float3 up    = float3(0.0f, 1.0f, 0.0f);
    float3 right = normalize(cross(up, N));
    up           = normalize(cross(N, right));

    float sampleDelta = 0.1f;
    float nrSamples = 0.0f;
    for (float phi = 0.0f; phi < 2.0f * PI; phi += sampleDelta)
    {
        for (float theta = 0.0f; theta < 0.5f * PI; theta += sampleDelta)
        {
            // spherical to cartesian (in tangent space)
            float3 tangentSample = float3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
            // tangent space to world
            float3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N;

            // SampleLevel: inside a loop HLSL wants the mip level spelled out (level 0)
            irradiance += environmentMap.SampleLevel(clampSampler, sampleVec, 0.0f).rgb * cos(theta) * sin(theta);
            nrSamples++;
        }
    }
    irradiance = PI * irradiance * (1.0f / float(nrSamples));
```

med `float3 N = normalize(input.worldPos);` före och resultatet returnerat som färgen. learnopengls `texture(…)` blir
`SampleLevel(…, 0.0f)`: en vanlig `Sample` behöver derivator i skärmrummet för att välja mipnivå, och HLSL tillåter inte
dem i en loop vars antal varv inte är bestämt vid kompileringen; environment mappen har ändå bara en mipnivå här.
:::

Vi anger ett fast stegvärde `sampleDelta` för att gå igenom halvsfären; ett mindre eller större steg ökar respektive
minskar noggrannheten. learnopengl använder 0.025; kursen använder **0.1**, vilket ger 63 × 16 = 1008 samples per texel –
16 gånger färre, och ändå jämnt för en omgivning vars ljusaste delar är några grader breda.

Inne i båda looparna gör vi om de två sfäriska koordinaterna till en kartesisk 3D-samplingsvektor, omvandlar samplet
från tangentrum till världsrum kring normalen och använder samplingsvektorn för att sampla HDR-environment mappen direkt.
Vi lägger varje resultat till `irradiance`, som vi i slutet delar med det totala antalet samples, så att vi får den
genomsnittliga samplade irradiansen. Observera att vi skalar det samplade färgvärdet med cos(θ) eftersom ljuset är
svagare vid större vinklar, och med sin(θ) för att ta hänsyn till de mindre samplingsområdena högre upp i halvsfären. Och
π framför? Det kommer från Riemannsummans stegstorlekar: (2π / n1) · (π/2 / n2) = π² / n, och ett π tar ut den
Lambertska 1/π – så mappen lagrar π gånger medelvärdet, och PBR-shadern multiplicerar den bara med albedot.

Det som återstår är att ställa in inspelningskoden så att vi kan generera irradiansmappen: en andra cube map, **32 × 32**
per sida – irradiansen ändras långsamt med riktningen, så en liten map räcker –, och samma sex pass med konvolutionens
fragment shader, som läser environment-cube mappen.

:::opengl
```cpp
    unsigned int irradianceMap;
    glGenTextures(1, &irradianceMap);
    glBindTexture(GL_TEXTURE_CUBE_MAP, irradianceMap);
    for (unsigned int i = 0; i < 6; ++i)
    {
        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB16F, 32, 32, 0, GL_RGB, GL_FLOAT, nullptr);
    }
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    glBindRenderbuffer(GL_RENDERBUFFER, captureRBO);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, 32, 32);
```

Eftersom irradiansmappen tar ett jämnt medelvärde av all omgivande radians har den inte många högfrekventa detaljer, så vi
kan lagra mappen med låg upplösning och låta OpenGL:s linjära filtrering göra det mesta av jobbet. Sedan ändrar vi
capture-framebufferns upplösning (renderbuffern ovan) och konvolverar med `irradianceShader`:

```cpp
    irradianceShader.use();
    irradianceShader.setInt("environmentMap", 0);
    irradianceShader.setMat4("projection", captureProjection);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);

    glViewport(0, 0, 32, 32); // don't forget to configure the viewport to the capture dimensions.
    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    for (unsigned int i = 0; i < 6; ++i)
    {
        irradianceShader.setMat4("view", captureViews[i]);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, irradianceMap, 0);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        renderCube();
    }
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Koden liknar inspelningen av environment-cube mappen. Skillnaden är den andra shadern (`Shader
irradianceShader("cubemap.vs", "irradiance_convolution.fs");`) och texturen den läser: environment-cube mappen i stället
för HDR-bilden i 2D.
:::
:::vulkan
Allt finns redan: cube mappen är `createCubemap(32, 1, irradianceImage, irradianceImageMemory, irradianceImageView)`,
pipelinen är `createPipeline("shaders/cubemap.vert.spv", "shaders/irradiance_convolution.frag.spv", captureRenderPass,
VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, irradiancePipeline)` (capture-passets render pass passar: formatet är detsamma), och
passen är ett anrop till efter konverteringen:

```cpp
        // pbr: convert HDR equirectangular environment map to cubemap equivalent
        renderToCubemap(equirectangularToCubemapPipeline, hdrDescriptorSet, envCubemapImage, 128);
        // pbr: solve diffuse integral by convolution to create an irradiance (cube)map.
        renderToCubemap(irradiancePipeline, envDescriptorSet, irradianceImage, 32);
```

Konvolutionen läser environment-cube mappen, så den får `envDescriptorSet`. Irradiansmappen får ett eget
`irradianceDescriptorSet` (`createTextureDescriptorSet(irradianceImageView, clampSampler, irradianceDescriptorSet)`;
poolen växer till 4 set). Den första `renderToCubemap` har skickat iväg sin command buffer och väntat innan den andra
spelas in, så environment mappen är klar när konvolutionen läser den.
:::
:::d3d12
Cube mappen `m_irradianceMap` skapas som `m_envCubemap` men på 32 × 32 (`Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 32, 32,
6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`), dess `TEXTURECUBE`-SRV på heap-plats 3 (heapen växer till 4).
`m_irradiancePipelineState` är konverteringens `psoDesc` med `psoDesc.PS` = `irradiance_convolution.hlsl`:s `PSMain`.
Passen följer konverteringen i `LoadAssets`: `SetPipelineState(m_irradiancePipelineState.Get())`, tabell 2 = heap-plats
2 (environment-cube mappen, som barriären just har gjort till shader resource), en viewport och scissor-rektangel på 32 ×
32, samma loop över sex sidor med `SetCaptureTarget(m_irradianceMap.Get(), i, 0)` och `RenderCube()`, och barriären
till `PIXEL_SHADER_RESOURCE`. Barriären mellan de två passen är det som får konvolutionen att vänta på konverteringens
skrivningar – båda ligger i samma command list.
:::

Visa tills vidare irradiansmappen som bakgrund: bind den i stället för environment mappen när bakgrunden ritas –
bakgrundens shader förblir som den är. Gör nu uppgiften **irradiance-map**.

Tryck på **Build & run**: bakgrunden är **en mycket mjuk oskärpa** utan detaljer – kullarna och horisonten är borta; en
blek gråviolett ton överallt, lite blåare upptill och varmare nedtill. Den är ljus även under horisonten: varje riktnings
halvsfär når en del av himlen eller solen. Det här är det ljus som en matt yta riktad åt det hållet får från hela
omgivningen.

```quiz
I konvolutionens loop multipliceras varje sample med `cos(theta) * sin(theta)`. Vad är `sin(theta)` till för?
- [ ] Det är den Lambertska cosinustermen n · ωi
- [ ] Den gör irradiansmappen jämnare vid sidornas kanter
- [x] Samplen ligger med jämna steg i θ och φ, och ett sådant sample täcker en mindre del av halvsfären ju närmare toppen (θ = 0) det ligger; sin θ viktar varje sample med den yta det står för
- [ ] Den omvandlar radiansen från sRGB till linjär
---
Rymdvinkeln i sfäriska koordinater är dω = sin θ dθ dφ. cos θ är reflektansekvationens n · ωi; sin θ hör till variabelbytet.
```

## PBR och indirekt irradiansbelysning

Irradiansmappen står för reflektansintegralens diffusa del, sammanlagd från allt omgivande indirekt ljus. Eftersom ljuset
inte kommer från direkta ljuskällor utan från den omgivande miljön behandlar vi både det diffusa och det spekulära
indirekta ljuset som ambient ljus, och ersätter vår tidigare konstanta term.

Se först till att lägga till den förberäknade irradiansmappen som en kub-sampler:

:::opengl
```glsl
uniform samplerCube irradianceMap;
```

på texturenhet 0 (`pbrShader.setInt("irradianceMap", 0);` en gång, och i loopen `glActiveTexture(GL_TEXTURE0);
glBindTexture(GL_TEXTURE_CUBE_MAP, irradianceMap);` före sfärerna).
:::
:::vulkan
```glsl
layout(binding = 1) uniform samplerCube irradianceMap;
```

Sfärernas eget `descriptorSet` får irradiansmappen på bindning 1: `createDescriptorSet()` lägger till en
`VkDescriptorImageInfo` (`irradianceImageView`, `clampSampler`, `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`) och en andra
write med `dstBinding = 1`.
:::
:::d3d12
```hlsl
TextureCube irradianceMap : register(t0);
SamplerState clampSampler : register(s0);
```

t0 är den enda SRV:n i root-parameter 2 – för sfärerna sätts den till irradiansmappen före `RenderScene()`:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE irradianceMap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, irradianceMap);
```

och bakgrunden sätter den till environment mappen (plats 2) igen efter dem.
:::

Med irradiansmappen, som innehåller allt scenens indirekta diffusa ljus, är det så enkelt som en enda textursampling med
ytans normal att hämta irradiansen som påverkar fragmentet:

```glsl
// vec3 ambient = vec3(0.03);
vec3 ambient = texture(irradianceMap, N).rgb;
```

Men eftersom det indirekta ljuset har både en diffus och en spekulär del (som vi såg i den uppdelade
reflektansekvationen) måste vi vikta den diffusa delen därefter. Liksom i förra kapitlet använder vi Fresnelekvationen
för att bestämma ytans indirekta reflektionsandel, och ur den härleder vi brytnings- (eller diffusa) andelen:

```glsl
vec3 kS = fresnelSchlick(max(dot(N, V), 0.0), F0);
vec3 kD = 1.0 - kS;
vec3 irradiance = texture(irradianceMap, N).rgb;
vec3 diffuse    = irradiance * albedo;
vec3 ambient    = (kD * diffuse) * ao;
```

Eftersom det ambienta ljuset kommer från alla riktningar inom halvsfären kring normalen N finns det ingen enskild
halvvägsvektor att bestämma Fresnel-svaret med. För att ändå simulera Fresnel räknar vi ut det från vinkeln mellan
normalen och vyvektorn. Tidigare använde vi dock mikroytans halvvägsvektor, påverkad av ytans strävhet, som indata till
Fresnelekvationen. Eftersom vi nu inte tar hänsyn till strävheten blir ytans reflektionsandel alltid ganska hög. Indirekt
ljus följer samma regler som direkt ljus, så vi förväntar oss att strävare ytor reflekterar svagare vid kanterna. Därför
ser den indirekta Fresnel-reflektionen fel ut på sträva icke-metalliska ytor.

Vi kan mildra problemet genom att föra in en strävhetsterm i Fresnel-Schlick-ekvationen, som Sébastien Lagarde beskriver:

:::opengl vulkan
```glsl
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness)
{
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
```
:::
:::d3d12
```hlsl
float3 fresnelSchlickRoughness(float cosTheta, float3 F0, float roughness)
{
    float invRoughness = 1.0f - roughness;
    return F0 + (max(float3(invRoughness, invRoughness, invRoughness), F0) - F0) * pow(clamp(1.0f - cosTheta, 0.0f, 1.0f), 5.0f);
}
```
:::

Reflektansen i strykande vinkel går inte längre upp till 1.0 utan till `max(1 − roughness, F0)`: en sträv ytas kanter
reflekterar mindre. Med ytans strävhet medräknad i Fresnel-svaret blir den ambienta koden (learnopengls källfil 2.1.2
anropar fortfarande `fresnelSchlick` här; dess text inför `fresnelSchlickRoughness`, som kursen använder):

:::opengl vulkan
```glsl
    // ambient lighting (we now use IBL as the ambient term)
    vec3 kS = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - metallic;
    vec3 irradiance = texture(irradianceMap, N).rgb;
    vec3 diffuse    = irradiance * albedo;
    vec3 ambient    = (kD * diffuse) * ao;
```
:::
:::d3d12
```hlsl
    // ambient lighting (we now use IBL as the ambient term)
    float3 kS = fresnelSchlickRoughness(max(dot(N, V), 0.0f), F0, roughness);
    float3 kD = 1.0f - kS;
    kD *= 1.0f - metallic;
    float3 irradiance = irradianceMap.Sample(clampSampler, N).rgb;
    float3 diffuse    = irradiance * albedo;
    float3 ambient    = (kD * diffuse) * ao;
```
:::

Som du ser är själva den bildbaserade belysningsberäkningen ganska enkel och kräver bara en enda uppslagning i en cube
map; det mesta arbetet ligger i att i förväg räkna ut eller konvolvera irradiansmappen. Precis som det direkta ljusets kD
multipliceras det ambienta kD med `1.0 - metallic`: metaller har ingen diffus reflektion, varken från lampor eller från
himlen.

```quiz
Den ambienta termen viktar irradiansen med `kD` från `fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness)`. Varför med N · V och strävheten, och inte med H · V som för punktljusen?
- [ ] Eftersom irradiansmappen lagrar omgivningens halvvägsvektorer
- [x] Det ambienta ljuset kommer från hela halvsfären, så det finns ingen enskild halvvägsvektor; vinkeln mellan normal och vy får ersätta den, och strävhetstermen hindrar sträva ytor från att reflektera lika starkt i strykande vinkel som släta skulle göra
- [ ] Eftersom N · V alltid är 1 för det ambienta ljuset
- [ ] Eftersom strävheten gör irradiansmappen suddigare
---
Utan strävhetstermen stiger F till 1 vid kanterna på varje sfär, och kD sjunker till 0 där: sträva icke-metaller skulle få ljusa, reflekterande kanter och förlora sitt diffusa ljus. `max(1 − roughness, F0)` begränsar ökningen.
```

Gör nu den sista uppgiften, **ambient**: använd irradiansmappen som ambient ljus och visa environment mappen som
bakgrund igen. Tryck på **Build & run**: **de icke-metalliska sfärerna belyses av himlen**. De nedersta raderna är
tydligt ljusare och jämnt belysta, deras övre halvor – som vetter mot den ljusa himlen – ljusare än de nedre, som vetter
mot den mörkare marken; det finns inga svarta sidor längre. Metallraderna upptill ändras knappt: metaller har ingen
diffus reflektion, och deras reflektion av omgivningen är nästa kapitels ämne. Bara den röda kanalen ökar, eftersom
albedot är (0.5, 0, 0). Det här är learnopengls `2.1.2.ibl_irradiance`.

Det kan först verka konstigt att metallsfärerna ser så mörka ut i en så ljus omgivning, men det är vad den diffusa delen
ensam kan göra: en metallsfär borde spegla himlen, och ännu finns inget i shadern som reflekterar omgivningen. Nästa
kapitel lägger till den spekulära delen av det indirekta ljuset, och med den reflektansintegralens andra halva.

## Mer att läsa

- *Coding Labs: Physically based rendering*, som learnopengl länkar till, introducerar PBR och irradiansmappen och
  varför den byggs så här.
- Sébastien Lagardes artiklar om PBR i Frostbite-motorn, som learnopengl tillskriver strävhetstermen i det indirekta
  ljusets Fresnelekvation.

:::opengl
- [PBR / IBL / Diffuse irradiance](https://learnopengl.com/PBR/IBL/Diffuse-irradiance): learnopengls kapitel som det här
  kapitlet följer, med bilder av den ekvirektangulära mappen och irradiansmappen.
- [ibl_irradiance.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/6.pbr/2.1.2.ibl_irradiance/ibl_irradiance.cpp):
  learnopengls program.
- [glFramebufferTexture2D](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFramebufferTexture.xhtml): att koppla
  in en sida (och en mipnivå) av en cube map.
:::
:::vulkan
- [PBR / IBL / Diffuse irradiance](https://learnopengl.com/PBR/IBL/Diffuse-irradiance): learnopengls kapitel som det här
  kapitlet följer, med bilder av den ekvirektangulära mappen och irradiansmappen.
- [VkImageCreateFlagBits](https://registry.khronos.org/vulkan/specs/latest/man/html/VkImageCreateFlagBits.html):
  `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`.
- [Textures (Vulkan-specifikationen)](https://docs.vulkan.org/spec/latest/chapters/textures.html): hur en cube
  map-uppslagning väljer sida och texel.
:::
:::d3d12
- [PBR / IBL / Diffuse irradiance](https://learnopengl.com/PBR/IBL/Diffuse-irradiance): learnopengls kapitel som det här
  kapitlet följer, med bilder av den ekvirektangulära mappen och irradiansmappen.
- [D3D12_TEX2D_ARRAY_RTV](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_tex2d_array_rtv):
  render target viewn av en sida.
- [Format support for Direct3D feature level 11.0 hardware](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/format-support-for-direct3d-11-0-feature-level-hardware):
  vilka format som kan filtreras, bland dem `R32G32B32A32_FLOAT`.
:::
