# Parallax mapping

Parallax mapping är en teknik som liknar normal mapping men bygger på andra principer. Precis som normal mapping ökar den
detaljrikedomen hos en texturerad yta avsevärt och ger den en känsla av djup. Även om det också är en illusion är
parallax mapping mycket bättre på att förmedla djup, och tillsammans med normal mapping ger den otroligt realistiska
resultat. Parallax mapping är inte nödvändigtvis en teknik som hör direkt till (avancerad) belysning, men vi tar ändå upp
den här eftersom den är en logisk fortsättning på normal mapping.

Parallax mapping är nära släkt med familjen displacement mapping-tekniker, som förskjuter vertex utifrån geometrisk
information lagrad i en textur. Ett sätt är att ta ett plan med ungefär 1000 vertex och förskjuta var och en av dem efter
ett värde i en textur som anger planets höjd på just det stället. En sådan textur med höjdvärden per texel kallas en
*höjdkarta* (height map). Att förskjuta varje vertex så ger en verklig, knölig yta – men det krävs många vertex för att
det ska se bra ut.

Tänk om vi kunde nå samma realism med bara två trianglar? Det är precis vad parallax mapping gör. Idén är att ändra
texturkoordinaterna så att det ser ut som om ett fragments yta ligger högre eller lägre än den faktiskt gör, helt utifrån
vyriktningen och en höjdkarta. Liksom normal mapping sker det helt i fragment shadern, i tangentrymden – så det är
likadant i alla API:er. Skillnaderna är var den tredje texturen hamnar, och – i Direct3D – hur en textur får samplas inne
i en loop.

:::opengl
Projektet fortsätter förra kapitlet: den normal-mappade fyrhörningen – `renderQuad()` med tangenter och bitangenter, 14
floats per vertex – och vertex shadern `parallax_mapping.vs`, som är klar: TBN-matrisen med Gram-Schmidt, och ljusets,
vyns och fragmentets positioner i tangentrymden. Texturerna är nya: `bricks2.png` (sandfärgat tegel med djupa fogar,
enhet 0) och dess normal map `bricks2_normal.png` (enhet 1). Fyrhörningen är roterad en fast vinkel på -45° kring
x-axeln: dess överkant lutar bort och dess normal pekar mot (0, 0.707, 0.707), så kameran på (0, 0, 3) ser teglen 45°
uppifrån, som ett golv framför sig (learnopengl vrider fyrhörningen med tiden). `parallax_mapping.fs` belyser den som
förra kapitlet, men `main` räknar ut vyriktningen först och samplar normal mapen och färgen på
`vec2 texCoords = fs_in.TexCoords;` – TODO:n är raden som ändrar `texCoords`. Ljuset står på `lightPos` (0.5, 1.0, 0.3).
:::
:::vulkan
Projektet fortsätter förra kapitlet: den normal-mappade fyrhörningen – `createQuadVertices()` med tangenter och
bitangenter – och vertex shadern `parallax_mapping.vert`, som är klar: TBN-matrisen med Gram-Schmidt, och ljusets, vyns
och fragmentets positioner i tangentrymden. Texturerna är nya: `textures/bricks2.png` (sandfärgat tegel med djupa fogar,
binding 1) och dess normal map `textures/bricks2_normal.png` (binding 2), laddade vända
(`stbi_set_flip_vertically_on_load(true)`) som i förra kapitlet. Fyrhörningen är roterad en fast vinkel på -45° kring
x-axeln: dess överkant lutar bort och dess normal pekar mot (0, 0.707, 0.707), så kameran på (0, 0, 3) ser teglen 45°
uppifrån, som ett golv framför sig (learnopengl vrider fyrhörningen med tiden). `parallax_mapping.frag` belyser den som
förra kapitlet, men `main` räknar ut vyriktningen först och samplar normal mapen och färgen på
`vec2 texCoords = fs_in.texCoord;` – TODO:n är raden som ändrar `texCoords`. Ljuset står på `lightPos` (0.5, 1.0, 0.3).
:::
:::d3d12
Projektet fortsätter förra kapitlet: den normal-mappade fyrhörningen – tangenter och bitangenter uträknade i
`LoadAssets`, 14 floats per vertex – och `VSMain` i `parallax_mapping.hlsl`, som är klar: TBN-matrisen med Gram-Schmidt
och `B = cross(T, N)`, och ljusets, vyns och fragmentets positioner i tangentrymden. Texturerna är nya: `bricks2.png`
(sandfärgat tegel med djupa fogar, t0) och dess normal map `bricks2_normal.png` (t1) – i OpenGL-stil, så `PSMain` vänder
dess y som i förra kapitlet. Fyrhörningen är roterad en fast vinkel på -45° kring x-axeln (`XMMatrixRotationX`): dess
överkant lutar bort och dess normal pekar mot (0, 0.707, 0.707), så kameran på (0, 0, 3) ser teglen 45° uppifrån, som
ett golv framför sig (learnopengl vrider fyrhörningen med tiden). `PSMain` räknar ut vyriktningen först och samplar
normal mapen och färgen på `float2 texCoords = input.texCoords;` – TODO:n är raden som ändrar `texCoords`. Ljuset står på
`lightPos` (0.5, 1.0, 0.3).
:::

Tryck på **Build & run** (Ctrl+Enter): ett tegelgolv sett snett, en trapets som är smalare upptill. Normal mapen ger
fogarna deras fasningar, men alla tegelstenar ligger på samma höjd – titta längs teglen så ser de målade ut på en platt
skiva. Kommentarerna `// TODO:` i projektet visar var din kod ska in.

## Parallax mapping

Titta på ett enda fragment på den platta fyrhörningen – kalla dess punkt A. Ögat ser A längs vyriktningen. Om ytan
verkligen hade en relief skulle ögats stråle inte stanna vid A: A ligger ovanför en djup del av ytan (i fogen, säg), så
strålen skulle fortsätta in i ytan och träffa den i en annan punkt B längre fram. B är vad vi borde se i A:s fragment.
Parallax mapping vill förskjuta texturkoordinaterna i fragmentposition A så att vi får texturkoordinaterna i punkt B. Vi
använder sedan texturkoordinaterna i B för alla följande texturuppslagningar, så att det ser ut som om betraktaren
faktiskt tittar på punkt B.

Knepet är att lista ut hur vi får texturkoordinaterna i punkt B från punkt A. Parallax mapping försöker lösa det genom att
skala vektorn från fragmentet mot betraktaren med höjden (eller djupet) i fragment A. Vi skalar vektorn med värdet i A,
vilket ger en vektor P, och tar P:s projektion på ytan – dess x och y i tangentrymden – som förskjutning av
texturkoordinaterna. Det fungerar eftersom djupet i A ungefär är djupet i B. Exakt är det förstås inte: om ytans djup
ändras snabbt misslyckas approximationen, och dit kommer vi tillbaka.

Texturen vi använder är inte en höjdkarta utan en *djupkarta* – en inverterad höjdkarta: `bricks2_disp.png` är vit där
ytan är djup (fogarna) och svart där den ligger i ytan (teglens ovansidor). learnopengl föredrar den eftersom det är
lättare att fejka djup än höjd på platta ytor: teglen stannar där fyrhörningen är, och fogarna sjunker in i den.

Sedan förskjutningen. Vyriktningen `viewDir` pekar från fragmentet mot kameran, i tangentrymden – där z är ytans normal
och x, y går längs texturens u och v. En stråle från kameran färdas åt motsatt håll, så för att sjunka till djupet d rör
den sig *mot* `viewDir.xy` – med `viewDir.xy / viewDir.z * d`: ju mindre `viewDir.z`, desto flackare vinkel, och desto
längre åt sidan färdas strålen innan den når det djupet. Därav subtraktionen, och divisionen. `heightScale` (0.1 i
projektet; learnopengl ändrar det med tangenterna Q och E) skalar hur djupt djupkartans 1.0 går, i texturenheter.

```quiz
Djupkartan är vit (1.0) i fogarna och svart (0.0) på teglens ovansidor. Vad händer med ett fragment på en tegelstens ovansida?
- [ ] Det förskjuts mest, eftersom svart betyder långt bort
- [x] Ingenting: dess djup är 0, så förskjutningen `viewDir.xy / viewDir.z * (height * heightScale)` är 0 – teglens ovansidor stannar där fyrhörningen är, och bara djupare delar förskjuts
- [ ] Det kastas bort
- [ ] Det förskjuts mot kameran, så att tegelstenen ser upphöjd ut
---
En djupkarta anger hur långt under fyrhörningens yta varje texel ligger. Ytan själv (djup 0) förskjuts inte; fogarna (djup 1, gånger `heightScale`) förskjuts mest.
```

En del föredrar att lämna bort divisionen med `viewDir.z` ur ekvationen, eftersom standardekvationen kan ge oönskade
resultat vid mycket flacka vinklar; den tekniken kallas parallax mapping med offset limiting. learnopengls kapiteltext
dividerar (dess första exempelprogram gör det inte), och det gör kursen också. Vilken teknik man väljer är oftast en
smaksak.

```quiz
Varför dividerar förskjutningen med `viewDir.z`?
- [ ] För att normalisera vyriktningen
- [ ] Eftersom `viewDir.z` är djupkartans värde
- [x] `viewDir.z` är litet när blicken är flack mot ytan; en stråle i flack vinkel färdas längre åt sidan innan den sjunker till ett visst djup, så förskjutningen måste växa
- [ ] För att omvandla från tangentrymden till texturkoordinater
---
Tittar man rakt på ytan (`viewDir.z` = 1) sjunker en stråle utan att röra sig åt sidan; i strykande vinkel rör den sig långt. Lämnar man bort divisionen ("offset limiting") hålls förskjutningen liten i strykande vinklar, till priset av mindre djup.
```

:::opengl
`main.cpp` laddar djupkartan som de två andra, binder den till texturenhet 2 och skickar `heightScale` (en global
`float heightScale = 0.1f;`):

```cpp
    unsigned int heightMap  = loadTexture("bricks2_disp.png");
```

```cpp
    shader.setInt("depthMap", 2);
```

```cpp
        shader.setFloat("heightScale", heightScale);
```

```cpp
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, heightMap);
        renderQuad();
```

I `parallax_mapping.fs`, med `uniform sampler2D depthMap;` och `uniform float heightScale;`:

```glsl
vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir)
{
    float height =  texture(depthMap, texCoords).r;
    return texCoords - viewDir.xy / viewDir.z * (height * heightScale);
}
```

och i `main`, direkt efter att `texCoords` satts till de ursprungliga koordinaterna:

```glsl
    texCoords = ParallaxMapping(fs_in.TexCoords,  viewDir);
```

Gör nu första uppgiften, **parallax**. Ta bort `heightMap` i slutet med `glDeleteTextures`.
:::
:::vulkan
`heightScale` (en global `float heightScale = 0.1f;`) hamnar i uniformbuffern, på `pad2`:s plats – std140 låter en float
fylla de sista 4 byten av en vec3:s 16-byteplats:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float pad1;
    glm::vec3 lightPos;
    float heightScale; // fills the 4 bytes after lightPos
};
```

med `ubo.heightScale = heightScale;` i `updateUniformBuffer()` och `float heightScale;` efter `lightPos` i fragment
shaderns uniformblock. Djupkartan laddas som de två andra (`heightMapImage`, `heightMapImageMemory`,
`heightMapImageView`):

```cpp
        loadTexture("textures/bricks2_disp.png", heightMapImage, heightMapImageMemory, heightMapImageView);
```

och blir binding 3 i descriptor setet – en fjärde layout binding (combined image sampler, fragmentsteget), tre image
samplers i poolen, `createDescriptorSet(diffuseMapImageView, normalMapImageView, heightMapImageView, textureSampler,
descriptorSet)` med en fjärde write. I `parallax_mapping.frag`, med `layout(binding = 3) uniform sampler2D depthMap;`:

```glsl
vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir) {
    float height = texture(depthMap, texCoords).r;
    return texCoords - viewDir.xy / viewDir.z * (height * ubo.heightScale);
}
```

och i `main`, direkt efter att `texCoords` satts till de ursprungliga koordinaterna:

```glsl
    texCoords = ParallaxMapping(fs_in.texCoord, viewDir);
```

Djupkartan måste samplas på exakt samma koordinater som de två andra kartorna – den laddas vänd som de. Gör nu första
uppgiften, **parallax**, och förstör djupkartans vy, bild och minne i `cleanup()`.
:::
:::d3d12
`heightScale` (en global `float heightScale = 0.1f;`) hamnar i constant buffern, på paddingens plats efter `viewPos` –
en float får fylla resten av en float3:s 16-byterad:

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 viewPos;
        float heightScale;
        XMFLOAT3 lightPos;
        float padding1;
    };
```

med `constantBufferData.heightScale = heightScale;` i `OnUpdate` och `float heightScale;` efter `viewPos` i shaderns
cbuffer. Djupkartan laddas som de två andra, på plats 3 i CBV/SRV-heapen (`NumDescriptors = 4`):

```cpp
    ComPtr<ID3D12Resource> depthMapUploadHeap;
    LoadTexture("bricks2_disp.png", m_depthMap, depthMapUploadHeap, 3);
```

och texturernas range växer till tre register – `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 3, 0)`, t2 djupkartan.
I `parallax_mapping.hlsl`, med `Texture2D depthMap : register(t2);`:

```hlsl
float2 ParallaxMapping(float2 texCoords, float3 viewDir)
{
    float height = depthMap.Sample(wrapSampler, texCoords).r;
    return texCoords - viewDir.xy / viewDir.z * (height * heightScale);
}
```

och i `PSMain`, direkt efter att `texCoords` satts till de ursprungliga koordinaterna:

```hlsl
    texCoords = ParallaxMapping(input.texCoords, viewDir);
```

learnopengls förskjutning fungerar oförändrad med Direct3D:s texturkoordinater: v pekar nedåt i bilden, och det gör vår
tangentrymds y också (B = `cross(T, N)`, riktningen där v växer), så `viewDir.xy` ligger i texturkoordinaternas
riktningar. Gör nu första uppgiften, **parallax**.
:::

Tryck på **Build & run**: **teglen ser upphöjda ut** över fogarna. Deras framsidor – sidorna som vetter mot kameran –
syns, och fogarna mellan dem blir smalare. Inte illa för två trianglar. Titta dock på fyrhörningens kanter: där hamnar de
förskjutna koordinaterna utanför intervallet [0,1], och eftersom texturerna upprepas syns bitar av grannteglen längs
kanterna. Och på nära håll ser teglens sidor utsmetade ut – dit kommer vi.

### Att kasta kanterna

För att rätta till kanterna kan vi kasta fragmentet så fort det samplar utanför standardintervallet för
texturkoordinater. Observera att det bara fungerar för ett plan som vårt; på mer komplexa ytor är det inte lika
effektivt att kasta fragment, och kantartefakterna är något man får leva med eller dölja.

```quiz
Efter förskjutningen visar fyrhörningens kanter bitar av grannteglen. Varför, och vad gör det att kasta fragment?
- [x] Vid kanterna hamnar de förskjutna koordinaterna utanför [0,1], där den upprepade texturen visar andra tegelstenar; kastas de fragmenten avslutar teglens kontur fyrhörningen
- [ ] Djupkartan är clampad vid kanterna; att kasta återställer den
- [ ] Normal mapen saknar data vid kanterna; att kasta döljer belysningsfelen
- [ ] Vertex shadern flyttar kantens vertex; att kasta flyttar tillbaka dem
---
En tegelsten vid fyrhörningens kant skulle, förskjuten, fortsätta utanför texturens kant. I stället för den upprepade texturen ser vi bakgrunden där: fyrhörningens kontur blir ojämn och följer de upphöjda teglen.
```

:::opengl
Efter `ParallaxMapping`:

```glsl
    texCoords = ParallaxMapping(fs_in.TexCoords,  viewDir);
    if(texCoords.x > 1.0 || texCoords.y > 1.0 || texCoords.x < 0.0 || texCoords.y < 0.0)
        discard;
```

Gör nu uppgiften **discard-edges**.
:::
:::vulkan
Efter `ParallaxMapping`:

```glsl
    texCoords = ParallaxMapping(fs_in.texCoord, viewDir);
    if (texCoords.x > 1.0 || texCoords.y > 1.0 || texCoords.x < 0.0 || texCoords.y < 0.0)
        discard;
```

Gör nu uppgiften **discard-edges**.
:::
:::d3d12
Efter `ParallaxMapping`:

```hlsl
    texCoords = ParallaxMapping(input.texCoords, viewDir);
    if (texCoords.x > 1.0f || texCoords.y > 1.0f || texCoords.x < 0.0f || texCoords.y < 0.0f)
        discard;
```

HLSL:s `discard` fungerar som GLSL:s (`clip(x)`, som kastar där x < 0, är ett annat sätt). Gör nu uppgiften
**discard-edges**.
:::

Tryck på **Build & run**: fyrhörningens kanter blir **ojämna** – där de upphöjda teglens kontur slutar syns bakgrunden.
Allt innanför är oförändrat.

## Steep parallax mapping

Steep parallax mapping är en utbyggnad av parallax mapping som använder samma principer, men i stället för 1 sampling tar
den flera för att bättre pricka in vektorn P till B. Det ger mycket bättre resultat, även vid branta höjdskillnader,
eftersom teknikens noggrannhet ökar med antalet samplingar.

Grundidén i steep parallax mapping är att dela upp hela djupintervallet i flera lager med samma höjd/djup. För varje lager
samplar vi djupkartan och förskjuter texturkoordinaterna längs P:s riktning, tills vi hittar ett samplat djupvärde som är
mindre än det aktuella lagrets djup. Med andra ord: vi går längs vystrålen, ett lager djupare för varje steg, och
stannar så fort strålen är under den yta som djupkartan beskriver. Texturkoordinaterna i det steget är där strålen
träffar.

Vi kan förbättra algoritmen lite genom att utnyttja en av parallax mappings egenskaper. När man tittar rakt på en yta
förskjuts texturen inte särskilt mycket, medan den förskjuts mycket när man tittar på ytan i en vinkel. Genom att ta färre
samplingar när vi tittar rakt på ytan och fler när vi tittar i vinkel samplar vi bara så mycket som behövs: här 8 lager
när man tittar rakt på den, upp till 32 i strykande vinklar. `dot(vec3(0.0, 0.0, 1.0), viewDir)` – cosinus för vinkeln
mellan vyriktningen och ytans normal – väljer mellan dem.

```quiz
Steep parallax mapping använder `numLayers = mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir)))`. När används flest lager?
- [ ] När man tittar rakt på ytan
- [ ] När djupkartan är som djupast
- [ ] Alltid 32: `mix` avrundar bara värdet
- [x] I strykande vinklar: skalärprodukten går mot 0, och `mix` ger `maxLayers` (32); tittar man rakt på ytan är den 1 och ger `minLayers` (8)
---
I flack vinkel färdas strålen långt åt sidan genom djupintervallet och passerar många texlar, så den behöver finare steg. Rakt uppifrån rör den sig knappt åt sidan; 8 lager räcker.
```

:::opengl
`ParallaxMapping` blir:

```glsl
vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir)
{
    // number of depth layers
    const float minLayers = 8;
    const float maxLayers = 32;
    float numLayers = mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir)));
    // calculate the size of each layer
    float layerDepth = 1.0 / numLayers;
    // depth of current layer
    float currentLayerDepth = 0.0;
    // the amount to shift the texture coordinates per layer (from vector P)
    vec2 P = viewDir.xy / viewDir.z * heightScale;
    vec2 deltaTexCoords = P / numLayers;

    // get initial values
    vec2  currentTexCoords     = texCoords;
    float currentDepthMapValue = texture(depthMap, currentTexCoords).r;

    while(currentLayerDepth < currentDepthMapValue)
    {
        // shift texture coordinates along direction of P
        currentTexCoords -= deltaTexCoords;
        // get depthmap value at current texture coordinates
        currentDepthMapValue = texture(depthMap, currentTexCoords).r;
        // get depth of next layer
        currentLayerDepth += layerDepth;
    }

    return currentTexCoords;
}
```

Först förbereder vi: vi anger antalet lager, räknar ut varje lagers djup, och till sist hur mycket texturkoordinaterna
ska förskjutas längs P:s riktning per lager. Sedan går vi igenom lagren, uppifrån, tills vi hittar ett värde i djupkartan
som är mindre än lagrets djup.

En sak att veta om den här loopen: `texture()` väljer en mipnivå utifrån hur snabbt texturkoordinaterna ändras mellan
närliggande fragment – deras *implicita derivator*. I en loop vars antal steg skiljer sig från fragment till fragment
behöver grannarna inte vara på samma steg, och GLSL lämnar derivatorna odefinierade där. learnopengl gör det ändå, och på
de flesta hårdvaror fungerar det; den strikta versionen tar derivatorna av de ursprungliga koordinaterna före loopen
(`dFdx`, `dFdy`) och samplar med `textureGrad`. Gör nu uppgiften **steep**.
:::
:::vulkan
`ParallaxMapping` blir:

```glsl
vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir) {
    // number of depth layers
    const float minLayers = 8;
    const float maxLayers = 32;
    float numLayers = mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir)));
    // calculate the size of each layer
    float layerDepth = 1.0 / numLayers;
    // depth of current layer
    float currentLayerDepth = 0.0;
    // the amount to shift the texture coordinates per layer (from vector P)
    vec2 P = viewDir.xy / viewDir.z * ubo.heightScale;
    vec2 deltaTexCoords = P / numLayers;

    // get initial values
    vec2  currentTexCoords     = texCoords;
    float currentDepthMapValue = texture(depthMap, currentTexCoords).r;

    while (currentLayerDepth < currentDepthMapValue) {
        // shift texture coordinates along direction of P
        currentTexCoords -= deltaTexCoords;
        // get depthmap value at current texture coordinates
        currentDepthMapValue = texture(depthMap, currentTexCoords).r;
        // get depth of next layer
        currentLayerDepth += layerDepth;
    }

    return currentTexCoords;
}
```

Först förbereder vi: vi anger antalet lager, räknar ut varje lagers djup, och till sist hur mycket texturkoordinaterna
ska förskjutas längs P:s riktning per lager. Sedan går vi igenom lagren, uppifrån, tills vi hittar ett värde i djupkartan
som är mindre än lagrets djup.

En sak att veta om den här loopen: `texture()` väljer en mipnivå (och det anisotropa filtret sitt fotavtryck) utifrån hur
snabbt texturkoordinaterna ändras mellan närliggande fragment – deras *implicita derivator*. I en loop vars antal steg
skiljer sig från fragment till fragment behöver grannarna inte vara på samma steg, och GLSL lämnar derivatorna
odefinierade där. learnopengl gör det ändå, och med de flesta drivrutiner fungerar det; den strikta versionen tar
derivatorna av de ursprungliga koordinaterna före loopen (`dFdx`, `dFdy`) och samplar med `textureGrad`. Gör nu
uppgiften **steep**.
:::
:::d3d12
`ParallaxMapping` blir:

```hlsl
float2 ParallaxMapping(float2 texCoords, float3 viewDir)
{
    // number of depth layers: more when the view is flat to the surface
    const float minLayers = 8.0f;
    const float maxLayers = 32.0f;
    float numLayers = lerp(maxLayers, minLayers, abs(dot(float3(0.0f, 0.0f, 1.0f), viewDir)));
    // calculate the size of each layer
    float layerDepth = 1.0f / numLayers;
    // depth of current layer
    float currentLayerDepth = 0.0f;
    // the amount to shift the texture coordinates per layer (from vector P)
    float2 P = viewDir.xy / viewDir.z * heightScale;
    float2 deltaTexCoords = P / numLayers;

    // get initial values. SampleLevel(..., 0): mip level 0 - inside a loop whose number of
    // steps differs from pixel to pixel the hardware cannot work out the mip level (Sample
    // needs it from the neighbouring pixels), and the compiler refuses Sample there.
    float2 currentTexCoords = texCoords;
    float currentDepthMapValue = depthMap.SampleLevel(wrapSampler, currentTexCoords, 0).r;

    while (currentLayerDepth < currentDepthMapValue)
    {
        // shift texture coordinates along direction of P
        currentTexCoords -= deltaTexCoords;
        // get depthmap value at current texture coordinates
        currentDepthMapValue = depthMap.SampleLevel(wrapSampler, currentTexCoords, 0).r;
        // get depth of next layer
        currentLayerDepth += layerDepth;
    }

    return currentTexCoords;
}
```

HLSL:s `lerp` är GLSL:s `mix`. Först förbereder vi: vi anger antalet lager, räknar ut varje lagers djup, och till sist hur
mycket texturkoordinaterna ska förskjutas längs P:s riktning per lager. Sedan går vi igenom lagren, uppifrån, tills vi
hittar ett värde i djupkartan som är mindre än lagrets djup.

Lägg märke till `SampleLevel(wrapSampler, uv, 0)` i stället för `Sample`. `Sample` väljer en mipnivå utifrån hur snabbt
texturkoordinaterna ändras mellan närliggande pixlar – *gradienterna*, som GPU:n får genom att jämföra pixlarna i en
2 × 2-grupp som körs tillsammans. I en loop vars antal steg beror på en texturläsning kan närliggande pixlar vara på olika
steg, så det finns ingen giltig gradient. HLSL-kompilatorn som `D3DCompileFromFile` använder vet det: en
gradientinstruktion i en loop med varierande antal varv tvingar den att rulla ut loopen (varning X3570) – vilket den inte
kan, eftersom antalet inte är känt – och kompileringen misslyckas. `SampleLevel` anger mipnivån själv och behöver ingen
gradient. Våra texturer har en mipnivå, så nivå 0 är precis vad `Sample` skulle läsa. Med mipmaps skulle man ta
gradienterna av de ursprungliga koordinaterna före loopen – `ddx(texCoords)`, `ddy(texCoords)` – och sampla med
`SampleGrad`. Gör nu uppgiften **steep**.
:::

:::opengl
```quiz
Loopen i steep parallax mapping anropar `texture()` ett antal gånger som skiljer sig från fragment till fragment. Vad är haken?
- [ ] `texture()` kan inte anropas i en `while`-loop
- [ ] Loopen rullas ut 32 gånger, oavsett antal lager
- [x] `texture()` väljer mipnivån utifrån koordinaternas implicita derivator mellan närliggande fragment, som GLSL lämnar odefinierade när grannar kan ta olika vägar genom loopen; oftast fungerar det, `textureGrad` med derivator tagna före loopen är den strikta versionen
- [ ] Varje sampling i loopen måste normaliseras
---
Derivator kommer från att jämföra närliggande fragment som körs tillsammans. Lämnar ett fragment loopen tidigare än sin granne finns det ingen gemensam "aktuell" koordinat att jämföra.
```
:::
:::vulkan
```quiz
Loopen i steep parallax mapping anropar `texture()` ett antal gånger som skiljer sig från fragment till fragment. Vad är haken?
- [x] `texture()` väljer mipnivån utifrån koordinaternas implicita derivator mellan närliggande fragment, som GLSL lämnar odefinierade när grannar kan ta olika vägar genom loopen; oftast fungerar det, `textureGrad` med derivator tagna före loopen är den strikta versionen
- [ ] `texture()` kan inte anropas i en `while`-loop
- [ ] Loopen rullas ut 32 gånger, oavsett antal lager
- [ ] Varje sampling i loopen måste normaliseras
---
Derivator kommer från att jämföra närliggande fragment som körs tillsammans. Lämnar ett fragment loopen tidigare än sin granne finns det ingen gemensam "aktuell" koordinat att jämföra.
```
:::
:::d3d12
```quiz
Varför läser loopen djupkartan med `SampleLevel(wrapSampler, uv, 0)` i stället för `Sample`?
- [ ] `SampleLevel` är snabbare eftersom den hoppar över filtreringen
- [ ] `Sample` kan inte läsa en `Texture2D` i en pixel shader
- [ ] `SampleLevel` upprepar koordinaterna, `Sample` clampar dem
- [x] `Sample` behöver gradienter mellan närliggande pixlar för att välja mipnivå, och i en loop vars antal steg varierar per pixel finns inga – kompilatorn vägrar; `SampleLevel` anger nivån själv (med mipmaps `SampleGrad` med gradienter tagna före loopen)
---
Med en mipnivå är nivå 0 vad `Sample` ändå skulle ha läst, så bilden blir densamma som i OpenGL.
```
:::

Tryck på **Build & run**: **teglen får skarpa, solida sidor** – ingen utsmetning längre. Men titta på framsidorna: de
består av **trappsteg**, vågräta band, ett per lager. Strålen stannar vid första lagret under ytan, så varje djup
däremellan avrundas till ett lager.

Vi kan minska problemet genom att ta fler samplingar, men det blir snabbt en för tung börda för prestandan. Det finns
flera metoder som försöker rätta till det genom att inte ta den första positionen under den (förskjutna) ytan, utan
interpolera mellan positionens två närmaste djuplager för att hitta något som ligger mycket närmare B.

## Parallax occlusion mapping

Två av de populärare metoderna kallas Relief Parallax Mapping och Parallax Occlusion Mapping, där Relief Parallax Mapping
ger de noggrannaste resultaten men också kostar mer prestanda än Parallax Occlusion Mapping. Eftersom Parallax Occlusion
Mapping ger nästan samma resultat och är effektivare är det ofta den föredragna metoden.

Parallax Occlusion Mapping bygger på samma principer som Steep Parallax Mapping, men i stället för att ta
texturkoordinaterna i det första djuplagret efter en kollision interpolerar vi linjärt mellan djuplagret efter och före
kollisionen. Vi grundar vikten i den linjära interpolationen på hur långt ytans djup ligger från de båda lagrens
djupvärden.

Efter loopen är strålen precis under ytan: `afterDepth` – djupkartans värde minus lagrets djup – är 0 eller negativt. Ett
steg tillbaka var strålen fortfarande ovanför: `beforeDepth`, samma skillnad ett lager tidigare, är positivt. Var mellan
de två stegen passerar skillnaden noll? Om den ändras linjärt, vid andelen
`weight = afterDepth / (afterDepth - beforeDepth)` av vägen tillbaka från det sista steget till steget före. De slutliga
texturkoordinaterna blandar de två stegen med den vikten.

```quiz
I parallax occlusion mapping är `afterDepth = -0.03` och `beforeDepth = 0.01`. Var hamnar de slutliga texturkoordinaterna?
- [ ] Exakt på `currentTexCoords`, det första steget under ytan
- [x] Tre fjärdedelar av vägen tillbaka från `currentTexCoords` till `prevTexCoords`: `weight` = -0.03 / (-0.03 - 0.01) = 0.75, och `finalTexCoords = prevTexCoords * 0.75 + currentTexCoords * 0.25`
- [ ] Alltid mitt emellan de två stegen
- [ ] På `prevTexCoords`, det sista steget ovanför ytan
---
Strålen passerar ytan där djupskillnaden byter tecken. Den var 0.01 ovanför och är 0.03 under, så passagen ligger en fjärdedel av vägen från steget före till steget efter – tre fjärdedelar av vägen tillbaka från det sista steget.
```

:::opengl
Efter loopen, i stället för `return currentTexCoords;`:

```glsl
    // get texture coordinates before collision (reverse operations)
    vec2 prevTexCoords = currentTexCoords + deltaTexCoords;

    // get depth after and before collision for linear interpolation
    float afterDepth  = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = texture(depthMap, prevTexCoords).r - currentLayerDepth + layerDepth;

    // interpolation of texture coordinates
    float weight = afterDepth / (afterDepth - beforeDepth);
    vec2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);

    return finalTexCoords;
```

Gör nu den sista uppgiften, **occlusion**.
:::
:::vulkan
Efter loopen, i stället för `return currentTexCoords;`:

```glsl
    // get texture coordinates before collision (reverse operations)
    vec2 prevTexCoords = currentTexCoords + deltaTexCoords;

    // get depth after and before collision for linear interpolation
    float afterDepth  = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = texture(depthMap, prevTexCoords).r - currentLayerDepth + layerDepth;

    // interpolation of texture coordinates
    float weight = afterDepth / (afterDepth - beforeDepth);
    vec2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);

    return finalTexCoords;
```

Gör nu den sista uppgiften, **occlusion**.
:::
:::d3d12
Efter loopen, i stället för `return currentTexCoords;` – med `SampleLevel` här också, eftersom vi fortfarande är i samma
funktion efter en loop med varierande antal varv:

```hlsl
    // get texture coordinates before collision (reverse operations)
    float2 prevTexCoords = currentTexCoords + deltaTexCoords;

    // get depth after and before collision for linear interpolation
    float afterDepth = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = depthMap.SampleLevel(wrapSampler, prevTexCoords, 0).r - currentLayerDepth + layerDepth;

    // interpolation of texture coordinates
    float weight = afterDepth / (afterDepth - beforeDepth);
    float2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0f - weight);

    return finalTexCoords;
```

Gör nu den sista uppgiften, **occlusion**.
:::

Tryck på **Build & run**: **trappstegen försvinner** – teglens framsidor blir mjuka övergångar. Teglens ovansidor och
bakgrunden är oförändrade.

Parallax occlusion mapping ger förvånansvärt bra resultat, och även om några små artefakter och aliasingproblem
fortfarande syns är det i allmänhet en bra avvägning som bara märks på mycket nära håll eller i mycket branta vinklar.
Parallax mapping är en utmärkt teknik för att öka detaljrikedomen i din scen, men den har några artefakter som du måste
ta hänsyn till när du använder den. Oftast används parallax mapping på golv- eller väggliknande ytor, där det inte är lika
lätt att se ytans kontur och där betraktningsvinkeln oftast är ungefär vinkelrät mot ytan. Då märks parallax mappings
artefakter inte lika mycket, och tekniken blir ett otroligt intressant sätt att ge dina objekt fler detaljer.

## Mer att läsa

:::opengl
- [Parallax Mapping](https://learnopengl.com/Advanced-Lighting/Parallax-Mapping): learnopengls kapitel som det här
  kapitlet följer, med diagrammen över punkterna A och B, lagren och interpolationen.
- [parallax_occlusion_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/5.3.parallax_occlusion_mapping/parallax_occlusion_mapping.cpp):
  learnopengls färdiga program (med tangenterna Q och E för `heightScale`).
- [textureGrad](https://registry.khronos.org/OpenGL-Refpages/gl4/html/textureGrad.xhtml): sampling med uttryckliga
  derivator – den strikta versionen av en uppslagning inne i en loop.
:::
:::vulkan
- [Parallax Mapping](https://learnopengl.com/Advanced-Lighting/Parallax-Mapping): learnopengls kapitel som det här
  kapitlet följer, med diagrammen över punkterna A och B, lagren och interpolationen.
- [parallax_occlusion_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/5.3.parallax_occlusion_mapping/parallax_occlusion_mapping.cpp):
  learnopengls färdiga program (med tangenterna Q och E för `heightScale`).
- [Descriptor pool and sets](https://vulkan-tutorial.com/Uniform_buffers/Descriptor_pool_and_sets): vulkan-tutorial om
  descriptor sets, med ett avsnitt om justeringen av uniformbufferns medlemmar.
:::
:::d3d12
- [Parallax Mapping](https://learnopengl.com/Advanced-Lighting/Parallax-Mapping): learnopengls kapitel som det här
  kapitlet följer, med diagrammen över punkterna A och B, lagren och interpolationen.
- [SampleLevel](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-to-samplelevel) och
  [SampleGrad](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-to-samplegrad): sampling med
  en given mipnivå eller givna gradienter.
- [HLSL errors and warnings](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/hlsl-errors-and-warnings):
  bland annat X3570, gradientinstruktionen i en loop med varierande antal varv.
:::
