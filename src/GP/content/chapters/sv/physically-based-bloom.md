# Fysikaliskt baserad bloom

Kapitlet *Bloom* i delen *Avancerad belysning* fick starkt ljus att glöda: ett ljuspass skrev varje fragment som var
ljusare än 1.0 i en andra färgbuffer, tio pass av en gaussisk blur smetade ut den, och det sista passet adderade bluren
till scenen före tone mappingen. Det fungerar, och så gjorde många spel bloom i åratal. Men det har svagheter som syns så
fort man tittar noga:

- **Den hårda tröskeln.** En färg strax under 1.0 glöder inte alls, en strax över glöder fullt ut. En yta vars
  ljusstyrka passerar tröskeln – ett ljus som dämpas, en högdager som flyttar sig – slår sin glöd av och på.
- **En liten, blockig glöd.** learnopengls kärna med 9 sampel, upprepad fem gånger i varje riktning, når några tiotal
  pixlar. En bredare glöd kräver fler pass – vart och ett ett pass över hela skärmen i full upplösning – och blurens form
  syns som block och streck runt små ljusa punkter.
- **Flimmer.** En liten, mycket ljus detalj – en högdager en pixel bred – finns i ljusbuffern i en bildruta och inte i
  nästa, när kameran rör sig. Dess glöd, många pixlar bred, blinkar.
- **Kostnaden.** Tjugo pass i full upplösning för en enda effekt.

learnopengls gästartikel *Physically Based Bloom* ersätter tekniken med den som Jorge Jimenez presenterade för *Call of
Duty: Advanced Warfare* på SIGGRAPH 2014, i kursen *Advances in Real-Time Rendering*: blurra genom att **nedsampla**
HDR-bilden steg för steg till allt mindre texturer, och sedan **uppsampla** den tillbaka och addera nivåerna. De små
texturerna gör en bred blur billig – några texlars blur i en textur på 12 × 9 täcker en stor del av skärmen – och
filtren är valda så att resultatet blir mjukt och stabilt. Dessutom försvinner tröskeln: i stället för att bara addera
det som är ljusare än 1.0 blandar den in en liten andel av *hela* den blurrade bilden i scenen. Det är vad "fysikaliskt
baserad" syftar på här: en riktig lins sprider lite av *allt* ljus som passerar genom den, inte bara ljuset över en viss
ljusstyrka, och ljusa saker glöder mer helt enkelt för att det finns mer av deras ljus att sprida.

Precis som den tidigare bloomen är tekniken en kedja av pass över hela skärmen på texturer, och den fungerar likadant i
alla API:er. Kapitlet visar hur {{api}} renderar i en kedja av allt mindre mål.

## Projektet

Scenen är kapitlet *Bloom*:s – trägolvet, sex lådor och fyra ljuskuber, kameran i (0, 0, 5) – renderad i en färgbuffer
med flyttal och tone mappad med exponeringskurvan, **utan** ljuspasset och bluren: starten i kapitlet *Bloom*, en scen
med skarpkantade ljuskuber. I enlighet med artikeln arbetar den nya bloomen på hela HDR-bilden. (learnopengls demokod
lämnar fortfarande sin tröskelfiltrerade ljusbuffer till den nya bloom-renderaren; artikelns text och kursen använder
själva scenen.)

learnopengl skriver bloomen som två klasser, `bloomFBO` och `BloomRenderer`. Som i delen *I praktiken* skriver kursen
dem som structs och fria funktioner med learnopengls namn: en `BloomMip` (en nivås storlek och dess textur), en
`BloomFBO` (kedjan av nivåer), och funktionerna `InitBloomFBO`, `RenderDownsamples` och `RenderUpsamples`;
`RenderBloomTexture`:s få steg skrivs ut där bildrutan ritas.

:::opengl
`main.cpp` renderar scenen i `hdrFBO` – texturen `colorBuffer` i `GL_RGBA16F` och en renderbuffer för djupet – och ritar
`colorBuffer` på skärmfyrhörningen med `bloom_final.vs` / `.fs`. `downsample.vs/.fs` och `upsample.vs/.fs`
(learnopengls `6.new_downsample` och `6.new_upsample`) finns med sina uniforms; deras `main` är TODO:er.
:::
:::vulkan
`recordCommandBuffer()` renderar scenen i flyttalsbilden från kapitlet *Bloom* (`hdrRenderPass`) och ritar den på
skärmfyrhörningen (vertex 36–41) med `bloomFinalPipeline`. Push constants och descriptor sets är kapitlet *Bloom*:s;
`shaders/downsample.frag` och `upsample.frag` har sina indata, deras `main` är TODO:er.
:::
:::d3d12
`PopulateCommandList` renderar scenen i flyttalsfärgbuffern från kapitlet *Bloom* (plats 3 i CBV/SRV-heapen) och ritar den
på skärmfyrhörningen (vertex 36–41) med det sista pipeline state-objektet. `downsample.hlsl` och `upsample.hlsl` har sina
indata; deras pixel shaders är TODO:er.
:::

Kommentarerna `// TODO:` visar var din kod ska in; **Build & run** (Ctrl+Enter) kompilerar programmet och kör det i den
inbyggda simulatorn: scenen med skarpa ljuskuber och svart bakgrund alldeles intill dem.

## Mip-kedjan

Bloomen arbetar på en kedja av texturer, var och en hälften så stor som den förra: en *mip-kedja*, som en texturs
mip-nivåer. learnopengl börjar på halva fönstret och använder sex nivåer – för ett fönster på 800 × 600:

```text
level 0: 400 × 300    level 1: 200 × 150    level 2: 100 × 75
level 3:  50 × 37     level 4:  25 × 18     level 5:  12 × 9
```

(Halveringen i heltal avrundar nedåt: 75 / 2 = 37.) Varje nivå håller HDR-färg, så den behöver ett flyttalsformat. Men
den behöver ingen alfa, och bloomen behöver inte full 16-bitarsprecision: learnopengl väljer **R11G11B10 float** – tre
små flyttal packade i 32 bitar, 11 bitar var för rött och grönt, 10 för blått, utan tecken och utan alfa. Det är hälften
så mycket minne och bandbredd som RGBA16F, och bloom-passen handlar mest om bandbredd: vart och ett läser och skriver en
hel nivå. Alla nivåer använder linjär filtrering – filtren nedan förlitar sig på den – och klämmer vid kanten, så att ett
sampel strax utanför texturen upprepar kanten i stället för att slå runt till andra sidan.

learnopengls kedja är **separata texturer**, en per nivå, som renderas genom en enda framebuffer vars färg-attachment
byts till den nivå som skrivs. En enda textur med sex mip-nivåer skulle också fungera (man renderar då i en nivå medan
man samplar en annan); kursen följer learnopengls separata texturer i alla API:er.

:::opengl
```cpp
struct BloomMip
{
    glm::vec2 size;
    glm::ivec2 intSize;
    unsigned int texture;
};

// learnopengl's bloomFBO class as a struct: one framebuffer that renders into the textures of the mip chain
struct BloomFBO
{
    unsigned int FBO = 0;
    std::vector<BloomMip> mipChain;
};
```

`InitBloomFBO` skapar framebuffern och de sex texturerna:

```cpp
    glm::vec2 mipSize((float)windowWidth, (float)windowHeight);
    glm::ivec2 mipIntSize((int)windowWidth, (int)windowHeight);

    for (unsigned int i = 0; i < mipChainLength; i++)
    {
        BloomMip mip;

        mipSize *= 0.5f;
        mipIntSize /= 2;
        mip.size = mipSize;
        mip.intSize = mipIntSize;

        glGenTextures(1, &mip.texture);
        glBindTexture(GL_TEXTURE_2D, mip.texture);
        // we are downscaling an HDR color buffer, so we need a float texture format
        glTexImage2D(GL_TEXTURE_2D, 0, GL_R11F_G11F_B10F, (int)mipSize.x, (int)mipSize.y, 0, GL_RGB, GL_FLOAT, nullptr);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

        bloomFBO.mipChain.push_back(mip);
    }

    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, bloomFBO.mipChain[0].texture, 0);
```

följt av `glDrawBuffers` med ett attachment och kontrollen av fullständigheten (framebuffern kontrolleras med nivå 0
inkopplad; passen kopplar in de andra). `DestroyBloomFBO` tar bort texturerna och framebuffern. I `main`: `BloomFBO
bloomFBO;`, `InitBloomFBO(bloomFBO, SCR_WIDTH, SCR_HEIGHT, 6)`, och `DestroyBloomFBO(bloomFBO)` på slutet.

```quiz
learnopengl renderar alla sex nivåerna genom en och samma framebuffer. Vad ändras från ett pass till nästa?
- [ ] Ingenting: framebuffern har sex färg-attachments, en per nivå
- [x] Texturen som är inkopplad som `GL_COLOR_ATTACHMENT0` (`glFramebufferTexture2D`) och viewporten, satt till nivåns storlek
- [ ] Framebufferns storlek, med `glRenderbufferStorage`
- [ ] Bara shaderns `srcResolution`: OpenGL skalar själv utdatan till attachmentets storlek
---
En OpenGL-framebuffers attachments kan bytas när som helst. Utan motsvarande `glViewport` skulle fyrhörningen bara täcka en del av en större nivå eller rinna över en mindre.
```
:::
:::vulkan
En Vulkan-framebuffers attachments bestäms när den skapas, så learnopengls enda framebuffer med ett utbytt attachment blir
**en framebuffer per nivå**. Varje nivå får också ett descriptor set, så att nästa pass kan läsa den:

```cpp
struct BloomMip {
    glm::vec2 size;
    glm::ivec2 intSize;
    VkImage image;
    VkDeviceMemory memory;
    VkImageView view;
    VkFramebuffer framebuffer;
    VkDescriptorSet descriptorSet;
};
```

Formatet är `VK_FORMAT_B10G11R11_UFLOAT_PACK32` – learnopengls `GL_R11F_G11F_B10F`, med kanalerna namngivna från de mest
signifikanta bitarna och nedåt – och varje bild skapas med användningen färg-attachment och samplad:

```cpp
            createImage(static_cast<uint32_t>(mipSize.x), static_cast<uint32_t>(mipSize.y), VK_FORMAT_B10G11R11_UFLOAT_PACK32, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, mip.image, mip.memory);
            mip.view = createImageView(mip.image, VK_FORMAT_B10G11R11_UFLOAT_PACK32, VK_IMAGE_ASPECT_COLOR_BIT);
```

`BloomFBO` håller kedjan och **två render passes** för nivåerna: `renderPass` för nedsamplingen – `loadOp DONT_CARE`,
eftersom skärmfyrhörningen täcker varje pixel i nivån, och slutlayouten `SHADER_READ_ONLY_OPTIMAL` – och
`upsampleRenderPass` för uppsamplingen – `loadOp LOAD`, eftersom uppsamplingen *adderar* till det nivån redan håller, med
initial och slutlig layout `SHADER_READ_ONLY_OPTIMAL` (uppgiften upsample lägger till det andra). De två render passen är kompatibla (samma attachmentformat och
sampelantal), så samma framebuffers tjänar båda. Deras subpass-beroenden låter varje pass vänta in färgskrivningarna i
passet före; layoutbytena sker vid render passens gränser, så inga uttryckliga barriärer behövs. Nivåerna samplas med
`colorBufferSampler` från kapitlet *Bloom* (linjär, clamp to edge). `InitBloomFBO` och `DestroyBloomFBO` är
medlemsfunktioner i applikationen, eftersom de behöver enheten och dess hjälpfunktioner.

```quiz
Varför har varje nivå i Vulkan-kedjan en egen `VkFramebuffer`, där learnopengl använder ett enda framebuffer-objekt?
- [ ] För att en Vulkan-framebuffer bara kan användas en gång per bildruta
- [ ] För att varje nivå behöver ett eget render pass
- [ ] För att nivåerna har olika format
- [x] För att en Vulkan-framebuffers attachments bestäms när den skapas – det finns ingen `glFramebufferTexture2D` att byta dem med
---
Framebuffrarna skiljer sig bara i bildvy och storlek. Render passen för ned- och uppsampling är kompatibla, så varje nivås framebuffer tjänar båda.
```
:::
:::d3d12
Direct3D 12 har inga framebuffer-objekt: varje nivå är ett render target med en egen **render target view**, och en
**shader resource view** som nästa pass läser. Kedjan är alltså allt som finns kvar av learnopengls `bloomFBO`:

```cpp
struct BloomMip
{
    XMFLOAT2 size;
    XMINT2 intSize;
    ComPtr<ID3D12Resource> texture;
    UINT rtvIndex = 0;    // its render target view: slot in the RTV heap
    UINT srvIndex = 0;    // its shader resource view: slot in the CBV/SRV heap
};
```

Texturerna använder `DXGI_FORMAT_R11G11B10_FLOAT` – learnopengls `GL_R11F_G11F_B10F`, som Direct3D kan rendera i,
filtrera och blenda:

```cpp
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R11G11B10_FLOAT, mipIntSize.x, mipIntSize.y, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
```

Deras RTV:er hamnar på platserna `FrameCount + 1` … `+ 6` i RTV-heapen, deras SRV:er på platserna 4 … 9 i
CBV/SRV-heapen, och varje nivå vilar i `PIXEL_SHADER_RESOURCE`; ett pass som ritar i en av dem gör om den till
`RENDER_TARGET` och tillbaka med barriärer. Ingen `DestroyBloomFBO` behövs: `ComPtr`-objekten släpper texturerna när
`OnDestroy` har väntat in GPU:n. `InitBloomFBO` är en metod i `D3D12App` (den använder enheten och heaparna).

```quiz
Vad tar platsen för learnopengls bloom-framebuffer i Direct3D 12?
- [x] En render target view per nivå, som lämnas till `OMSetRenderTargets` för passet som ritar i den
- [ ] En descriptor table med alla sex nivåerna
- [ ] En texturarray med sex skivor
- [ ] Ett framebuffer-objekt skapat med `CreateFramebuffer`
---
Direct3D 12 har inga framebuffer-objekt: render targets binds som vyer på command listen. Därför behåller `BloomFBO` bara kedjan, och varje `BloomMip` minns sina platser för RTV och SRV.
```
:::

Gör nu den första uppgiften, **mip-chain**: de två structarna, `InitBloomFBO` och anropet för fönstret med sex nivåer,
och städningen. Ingenting ritar i kedjan ännu, så bilden förblir densamma.

```quiz
Varför lagrar learnopengl bloomens nivåer som R11G11B10 float i stället för RGBA16F?
- [ ] För att R11G11B10 kan lagra negativa färger, som filtren ger upphov till
- [ ] För att R11G11B10 har högre precision än en 16-bitars float
- [x] För att nivåerna behöver HDR-värden men ingen alfa: tre små flyttal i 32 bitar halverar minnet och bandbredden jämfört med RGBA16F, och bloom-passen handlar mest om bandbredd
- [ ] För att bara R11G11B10 kan blendas additivt
---
11 och 10 bitar per kanal (utan teckenbit) räcker gott för en blurrad glöd som blandas in med 4 %. Scenens egen färgbuffer förblir RGBA16F.
```

## Nedsampling

Bloomens första halva är en kedja av nedsamplingspass: rita en skärmfyrhörning i nivå 0 medan HDR-scenen läses, sedan i
nivå 1 medan nivå 0 läses, och så vidare ned till nivå 5. Varje pass halverar upplösningen och blurrar lite.

Att halvera en bild naivt – ett bilinjärt sampel per utdatapixel, mitt emellan fyra källtexlar – tar medelvärdet av de
fyra texlarna och ignorerar allt annat. Små ljusa detaljer dyker då upp i en nivå och försvinner i nästa, beroende på
exakt var de hamnar i rutnätet, och det är källan till skimmer. Jimenez nedsamplingsfilter tar **13 sampel** runt
utdatapixeln, från ett område på 6 × 6 texlar i källan. Eftersom varje sampel är en bilinjär läsning tar redan ett sampel
medelvärdet av upp till fyra texlar:

```text
a - b - c
- j - k -
d - e - f
- l - m -
g - h - i
```

`e` är mitten; `a`…`i` ligger två källtexlar isär, `j`…`m` en texel diagonalt från mitten. Vikterna kommer från fem
överlappande rutor på 2 × 2 – de fyra hörnrutorna (`a b d e`, `b c e f`, `d e g h`, `e f h i`) väger 0.125 var, den inre
rutan (`j k l m`) 0.5 – och summerar till 1, så nedsamplingen behåller bildens energi: summerat får `e` 0.125, hörnen
`a c g i` 0.03125 var, kanterna `b d f h` 0.0625 var, och `j k l m` 0.125 var.

:::opengl vulkan
```glsl
    vec3 a = texture(srcTexture, vec2(texCoord.x - 2*x, texCoord.y + 2*y)).rgb;
    vec3 b = texture(srcTexture, vec2(texCoord.x,       texCoord.y + 2*y)).rgb;
    vec3 c = texture(srcTexture, vec2(texCoord.x + 2*x, texCoord.y + 2*y)).rgb;

    vec3 d = texture(srcTexture, vec2(texCoord.x - 2*x, texCoord.y)).rgb;
    vec3 e = texture(srcTexture, vec2(texCoord.x,       texCoord.y)).rgb;
    vec3 f = texture(srcTexture, vec2(texCoord.x + 2*x, texCoord.y)).rgb;

    vec3 g = texture(srcTexture, vec2(texCoord.x - 2*x, texCoord.y - 2*y)).rgb;
    vec3 h = texture(srcTexture, vec2(texCoord.x,       texCoord.y - 2*y)).rgb;
    vec3 i = texture(srcTexture, vec2(texCoord.x + 2*x, texCoord.y - 2*y)).rgb;

    vec3 j = texture(srcTexture, vec2(texCoord.x - x, texCoord.y + y)).rgb;
    vec3 k = texture(srcTexture, vec2(texCoord.x + x, texCoord.y + y)).rgb;
    vec3 l = texture(srcTexture, vec2(texCoord.x - x, texCoord.y - y)).rgb;
    vec3 m = texture(srcTexture, vec2(texCoord.x + x, texCoord.y - y)).rgb;
```

med `x` och `y` som storleken på en källtexel, `1.0 / srcResolution`, och sedan den viktade summan:

```glsl
        downsample = e*0.125;
        downsample += (a+c+g+i)*0.03125;
        downsample += (b+d+f+h)*0.0625;
        downsample += (j+k+l+m)*0.125;
```

Utdatan är en `vec3` – nivåerna har ingen alfa.
:::
:::d3d12
```hlsl
    float3 a = srcTexture.Sample(clampSampler, float2(texCoord.x - 2 * x, texCoord.y + 2 * y)).rgb;
    float3 b = srcTexture.Sample(clampSampler, float2(texCoord.x,         texCoord.y + 2 * y)).rgb;
    float3 c = srcTexture.Sample(clampSampler, float2(texCoord.x + 2 * x, texCoord.y + 2 * y)).rgb;
```

och så vidare för `d` … `m`, med `x` och `y` som storleken på en källtexel, `1.0f / srcResolution` (en root constant,
tillsammans med `mipLevel`, i `DownsampleConstants`), och sedan den viktade summan:

```hlsl
        downsample = e * 0.125f;
        downsample += (a + c + g + i) * 0.03125f;
        downsample += (b + d + f + h) * 0.0625f;
        downsample += (j + k + l + m) * 0.125f;
```

Samplens förskjutningar går åt +y där GLSL går åt +y. Direct3D:s v pekar nedåt, så "+y" ligger längre ned i texturen,
men filtret är symmetriskt, så resultatet blir detsamma. Den statiska samplern s1 filtrerar bilinjärt och klämmer.
:::

Passloopen sätter varje nivås viewport, gör den till mål, ritar, och läser den sedan som nästa pass källa:

:::opengl
```cpp
    // progressively downsample through the mip chain
    for (unsigned int i = 0; i < bloomFBO.mipChain.size(); i++)
    {
        const BloomMip& mip = bloomFBO.mipChain[i];
        glViewport(0, 0, (int)mip.size.x, (int)mip.size.y);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, mip.texture, 0);

        // render screen-filled quad of resolution of current mip
        renderQuad();

        // set current mip resolution as srcResolution for next iteration
        downsampleShader.setVec2("srcResolution", mip.size);
        // set current mip as texture input for next iteration
        glBindTexture(GL_TEXTURE_2D, mip.texture);
    }
```

Före loopen aktiverar `RenderDownsamples` shadern, sätter `srcResolution` till källans storlek (800 × 600) och binder
HDR-texturen `colorBuffer` på enhet 0. I renderingsloopen, efter scenen:

```cpp
        glBindFramebuffer(GL_FRAMEBUFFER, bloomFBO.FBO);
        RenderDownsamples(bloomFBO, downsampleShader, colorBuffer, glm::vec2((float)SCR_WIDTH, (float)SCR_HEIGHT));
```

sedan `glBindFramebuffer(GL_FRAMEBUFFER, 0)` och fönstrets viewport igen.
:::
:::vulkan
Varje nivå är ett eget render pass: `RenderDownsamples` börjar `bloomFBO.renderPass` med nivåns framebuffer, sätter
viewport och scissor till nivåns storlek (learnopengls `glViewport`), binder nedsamplingspipelinen, skickar källans
storlek som push constant `srcResolution`, binder källans descriptor set – `hdrDescriptorSet` för det första passet,
sedan förra nivåns `descriptorSet` – och ritar fyrhörningen. Push constants växer med learnopengls uniforms:

```cpp
struct PushConstants {
    glm::mat4 model;
    glm::vec3 lightColor;
    alignas(8) glm::vec2 srcResolution;
    float filterRadius;
    int mipLevel;
};
```

Push constants läggs ut som std430: en `vec2` börjar på en multipel av 8, så `srcResolution` hamnar på offset 80, efter
fyra byte utfyllnad bakom `vec3`:n – `alignas(8)` får C++-structen att stämma. `recordCommandBuffer()` anropar
`RenderDownsamples(bloomFBO, commandBuffer, downsamplePipeline, pipelineLayout, hdrDescriptorSet, …)` mellan scenens
render pass och det sista, och sätter fönstrets viewport och scissor igen efteråt.
:::
:::d3d12
`RenderDownsamples` sätter nedsamplingens pipeline state, och per nivå: viewport och scissor i nivåns storlek, en barriär
`PIXEL_SHADER_RESOURCE → RENDER_TARGET`, `OMSetRenderTargets` med nivåns RTV (ingen djupbuffer), root constants
`DownsampleConstants` med källans storlek, källans SRV som tabell för root-parameter 2 – HDR-färgbuffern (plats 3) för
det första passet, sedan förra nivåns `srvIndex` – `DrawInstanced(6, 1, 36, 0)` och barriären tillbaka.
`PopulateCommandList` anropar den mellan scenen och det sista passet och sätter fönstrets viewport och scissor igen
efteråt.
:::

För att kontrollera nedsamplingen visar det sista passet tills vidare **nivå 2** (100 × 75) i stället för scenen. Gör nu
den andra uppgiften, **downsample**. Bygg och kör: fönstret visar scenen i en åttondel av sin upplösning, utsträckt –
suddig och blockig, med ljuskuberna utsmetade i sin omgivning.

## Uppsampling

Den andra halvan går uppåt igen. Med början i den minsta nivån läser varje uppsamplingspass nivå i, filtrerar den och
**adderar** den till nivå i − 1 – additiv blending, `ONE, ONE`. Efter fem pass håller nivå 0 summan av alla nivåer, var
och en blurrad ytterligare på vägen upp: bloom-texturen. De små nivåerna bidrar med den breda glöden, de stora med den
snäva glöden runt ljusa detaljer, och summan har en mjuk avtoning med lång svans – ungefär som glöden runt ett riktigt
ljus.

Uppsamplingsfiltret är ett **tältfilter** på 3 × 3: nio bilinjära sampel viktade 1 2 1 / 2 4 2 / 1 2 1, delat med 16.
Dess radie anges i **texturkoordinater**, inte texlar – learnopengls `filterRadius` på 0.005 – så på en liten nivå
spänner det över mindre än en texel och på en stor över flera: bluren växer med nivån den används på, som den ska.

:::opengl vulkan
```glsl
    // Apply weighted distribution, by using a 3x3 tent filter:
    //  1   | 1 2 1 |
    // -- * | 2 4 2 |
    // 16   | 1 2 1 |
    upsample = e*4.0;
    upsample += (b+d+f+h)*2.0;
    upsample += (a+c+g+i);
    upsample *= 1.0 / 16.0;
```

med de nio samplen `a`…`i` tagna `filterRadius` isär runt `texCoord`.
:::
:::d3d12
Pixel shadern tar nio sampel `a`…`i` `filterRadius` isär runt `texCoord` (en root constant i `UpsampleConstants`) och
returnerar `(e * 4 + (b + d + f + h) * 2 + (a + c + g + i)) / 16` – learnopengls tältfilter.
:::

:::opengl
```cpp
    // enable additive blending
    glEnable(GL_BLEND);
    glBlendFunc(GL_ONE, GL_ONE);
    glBlendEquation(GL_FUNC_ADD);

    for (int i = (int)bloomFBO.mipChain.size() - 1; i > 0; i--)
    {
        const BloomMip& mip = bloomFBO.mipChain[i];
        const BloomMip& nextMip = bloomFBO.mipChain[i - 1];

        // bind viewport and texture from where to read
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, mip.texture);

        // set framebuffer render target (we write to this texture)
        glViewport(0, 0, (int)nextMip.size.x, (int)nextMip.size.y);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, nextMip.texture, 0);

        // render screen-filled quad of resolution of current mip
        renderQuad();
    }

    // disable additive blending
    glDisable(GL_BLEND);
```

`RenderUpsamples(bloomFBO, upsampleShader, bloomFilterRadius)` kommer direkt efter `RenderDownsamples`, med `float
bloomFilterRadius = 0.005f;`.
:::
:::vulkan
Uppsamplingspipelinen skapas för `upsampleRenderPass` med blending påslagen – `ONE`, `ONE`, `ADD` (`createPipeline` får
en parameter `blendEnable`). Varje pass läser in målnivån och adderar fyrhörningen till den:

```cpp
        // set framebuffer render target (we write to this texture): its contents are loaded and the quad added to them
        VkRenderPassBeginInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        renderPassInfo.renderPass = bloomFBO.upsampleRenderPass;
        renderPassInfo.framebuffer = nextMip.framebuffer;
        renderPassInfo.renderArea.offset = {0, 0};
        renderPassInfo.renderArea.extent = {static_cast<uint32_t>(nextMip.intSize.x), static_cast<uint32_t>(nextMip.intSize.y)};
        renderPassInfo.clearValueCount = 0; // loadOp LOAD: nothing to clear
```

sedan viewport och scissor i `nextMip`:s storlek, pipelinen, push constants med `filterRadius`, `mip.descriptorSet` (den
mindre nivån läses) och `vkCmdDraw(commandBuffer, 6, 1, 36, 0)` – i learnopengls loop från den sista nivån ned till 1.
:::
:::d3d12
`m_upsamplePipelineState` blendar additivt (`SrcBlend = DestBlend = D3D12_BLEND_ONE`, `BlendOp = ADD` – learnopengls
`glBlendFunc(GL_ONE, GL_ONE)`). Per pass:

```cpp
        // Bind viewport and texture from where to read
        CD3DX12_GPU_DESCRIPTOR_HANDLE mipHandle(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), mip.srvIndex, m_cbvSrvDescriptorSize);
        m_commandList->SetGraphicsRootDescriptorTable(2, mipHandle);

        // Set framebuffer render target (we write to this texture)
        CD3DX12_VIEWPORT viewport(0.0f, 0.0f, static_cast<float>(nextMip.intSize.x), static_cast<float>(nextMip.intSize.y));
        CD3DX12_RECT scissorRect(0, 0, nextMip.intSize.x, nextMip.intSize.y);
        m_commandList->RSSetViewports(1, &viewport);
        m_commandList->RSSetScissorRects(1, &scissorRect);

        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(nextMip.texture.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
        m_commandList->ResourceBarrier(1, &barrier);
        CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), nextMip.rtvIndex, m_rtvDescriptorSize);
        m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);

        // Render screen-filled quad of resolution of current mip
        m_commandList->DrawInstanced(6, 1, 36, 0);
```

och barriären tillbaka till `PIXEL_SHADER_RESOURCE` – i learnopengls loop från den sista nivån ned till 1. Ett render
target behåller sitt innehåll mellan passen, så blendingen adderar till det nedsamplingen skrev.
:::

Tills vidare visar det sista passet **nivå 0**, den färdiga bloom-texturen. Gör nu den tredje uppgiften, **upsample**.
Bygg och kör: hela scenen mycket mjuk och mycket ljus – sex nivåer adderade – med stora vita halos runt ljuskuberna, och
till och med den svarta bakgrunden upplyst av glöden.

```quiz
Varför *adderar* uppsamplingen varje nivå till nästa större i stället för att ersätta den?
- [ ] För att ett render target inte kan skrivas över medan det är bundet
- [ ] För att återställa den energi som nedsamplingen förlorade
- [ ] För att tältfiltrets vikter summerar till mer än 1
- [x] Så att nivå 0 till sist håller summan av alla nivåer – de stora nivåernas snäva glöd plus de små nivåernas allt bredare – en mjuk avtoning med lång svans
---
Varje nivå är bilden blurrad till en annan bredd. Deras summa är en blur med skarp kärna och breda kjolar, nära hur en lins sprider ljus. Summan är mycket ljusare än scenen, därför blandas den in med låg styrka.
```

## Att blanda bloomen med scenen

Kapitlet *Bloom* *adderade* de blurrade ljusa delarna till scenen: `hdrColor += bloomColor`. Den fysikaliskt baserade
varianten **interpolerar** i stället mellan scenen och bloom-texturen:

```text
hdrColor = mix(hdrColor, bloomColor, bloomStrength)        bloomStrength = 0.04
```

96 % av scenen och 4 % av dess blurrade jag. En linjär interpolation behåller energin: ljuset som glöder runt en ljus
punkt tas från punkten själv, så som en lins sprider en del av ljuset som passerar i stället för att tillföra ljus. Det
finns ingen tröskel: varje pixel glöder i proportion till sin ljusstyrka. En mörk väggs glöd är för svag för att synas; en
ljuskub med värdet 5 eller 15 sprider en tydlig halo – inte för att den passerade en tröskel, utan för att 4 % av mycket
ljus fortfarande är mycket. Sedan följer exponeringens tone mapping och gammakorrigeringen som förut.

:::opengl
`bloom_final.fs` får bloom-texturen och styrkan:

```glsl
uniform sampler2D bloomBlur;
uniform float exposure;
uniform float bloomStrength;
```

och i `main`, före tone mappingen, `vec3 bloomColor = texture(bloomBlur, TexCoords).rgb;` och

```glsl
    hdrColor = mix(hdrColor, bloomColor, bloomStrength); // linear interpolation
```

I C++: `float bloomStrength = 0.04f;`, `shaderBloomFinal.setInt("bloomBlur", 1);` en gång, och i det sista passet scenen
(`colorBuffer`) på enhet 0, `bloomFBO.mipChain[0].texture` på enhet 1 och `setFloat("bloomStrength", bloomStrength)`.
(learnopengl ger uniformen ett standardvärde i GLSL, `= 0.04f`; kursen sätter den från programmet.)
:::
:::vulkan
`bloom_final.frag` läser bloom-texturen på bindning 2 – ett `bloomDescriptorSet` gjort av `createBloomDescriptorSet`, som i
kapitlet *Bloom*, med scenen på bindning 1 och nivå 0:s vy på bindning 2 – och `bloomStrength` ur uniform buffern, där
den följer efter `exposure` (std140-offset 272). Före tone mappingen: `hdrColor = mix(hdrColor, bloomColor,
ubo.bloomStrength);` med `bloomStrength` = 0.04.
:::
:::d3d12
`bloom_final.hlsl` läser bloom-texturen (nivå 0) på t1 via en fjärde root-parameter – en descriptor table med en SRV – och
får `bloomStrength` bredvid `exposure` i sina root constants (`HdrConstants`). Före tone mappingen:

```hlsl
    hdrColor = lerp(hdrColor, bloomColor, bloomStrength); // linear interpolation (GLSL's mix)
```

med `bloomStrength` = 0.04 – HLSL:s `lerp` är GLSL:s `mix`.
:::

Gör nu den fjärde uppgiften, **combine**. Bygg och kör: scenen är tillbaka, och allt ljust glöder mjukt – ljuskuberna mest,
med halos som är mycket bredare och mjukare än den gaussiska bloomens, och även de belysta lådorna och golvet lite, vilket
ljusar upp den svarta bakgrunden nära dem. Jämför med bilden i kapitlet *Bloom*: ingen hård gräns mellan "glöder" och
"glöder inte", och ingen blockig blur.

```quiz
Med `mix(hdrColor, bloomColor, 0.04)` och ingen tröskel – varför glöder en ljuskub synligt men en svagt belyst vägg knappt alls?
- [x] För att glöden är proportionell mot ljusstyrkan: 4 % av det blurrade ljuset från en kub med värden på 5–15 är fortfarande ljust, 4 % av en väggs blurrade färg under 1 är för svagt för att märkas
- [ ] För att nedsamplingsfiltret tar bort färger under 1.0
- [ ] För att tone mappingen tar bort mörka ytors glöd
- [ ] För att bara ljuskuberna renderas i mip-kedjan
---
Det är den "fysikaliskt baserade" idén: ingen strömbrytare vid en tröskel, bara en andel av allt ljus spritt. En yta som blir ljusare gradvis glöder också gradvis, utan att poppa.
```

## Eldflugor och Karis-medelvärdet

Ett problem återstår, och det syns bara i rörelse. En enda mycket ljus pixel – en högdager på en bult, en gnista – kan vara
långt ljusare än allt runt omkring. I den första nedsamplingen dominerar den den 2 × 2-ruta den hamnar i, och när kameran
rör sig glider den från en ruta till nästa och hoppar mellan nivåernas texlar: en pulserande fläck av glöd, en *eldfluga*
(firefly). Jimenez lösning är att vikta varje ruta i den första nedsamplingen med **Karis-medelvärdet** (efter Brian
Karis, som beskrev det för temporal kantutjämning): dela med ett plus rutans ljusstyrka,

```text
weight = 1 / (1 + luma(box) / 4)
```

så att mycket ljusa rutor väger mindre och en enda extrem pixel inte kan ta över medelvärdet. learnopengl mäter lumat för
rutans färg omräknad till sRGB (`pow(c, 1/2.2)`, vikterna 0.299, 0.587, 0.114). Det behövs bara i den första
nedsamplingen, där enskilda pixlar fortfarande är enskilda pixlar; efter den är bilden mjuk nog. Shadern får en uniform
`mipLevel` – 0 för det första passet, 1 därefter – och använder de fem rutorna som grupper i stället för de
sammanslagna vikterna:

:::opengl
```glsl
        groups[0] = (a+b+d+e) * (0.125f/4.0f);
        groups[1] = (b+c+e+f) * (0.125f/4.0f);
        groups[2] = (d+e+g+h) * (0.125f/4.0f);
        groups[3] = (e+f+h+i) * (0.125f/4.0f);
        groups[4] = (j+k+l+m) * (0.5f/4.0f);
        groups[0] *= KarisAverage(groups[0]);
        groups[1] *= KarisAverage(groups[1]);
        groups[2] *= KarisAverage(groups[2]);
        groups[3] *= KarisAverage(groups[3]);
        groups[4] *= KarisAverage(groups[4]);
        downsample = groups[0]+groups[1]+groups[2]+groups[3]+groups[4];
        downsample = max(downsample, 0.0001f);
```

learnopengl växlar med `switch (mipLevel)`; kursen skriver `if (mipLevel == 0) … else …` med de gamla vikterna i
`else`, och `uniform int mipLevel;` bredvid de andra uniformerna.
:::
:::vulkan
```glsl
        groups[0] = (a+b+d+e) * (0.125/4.0);
        groups[1] = (b+c+e+f) * (0.125/4.0);
        groups[2] = (d+e+g+h) * (0.125/4.0);
        groups[3] = (e+f+h+i) * (0.125/4.0);
        groups[4] = (j+k+l+m) * (0.5/4.0);
        groups[0] *= KarisAverage(groups[0]);
        groups[1] *= KarisAverage(groups[1]);
        groups[2] *= KarisAverage(groups[2]);
        groups[3] *= KarisAverage(groups[3]);
        groups[4] *= KarisAverage(groups[4]);
        downsample = groups[0]+groups[1]+groups[2]+groups[3]+groups[4];
        downsample = max(downsample, 0.0001);
```

learnopengl växlar med `switch (mipLevel)`; kursen skriver `if (pc.mipLevel == 0) { … } else { … }` med de gamla vikterna
i `else` – `mipLevel` är det sista fältet i push constants.
:::
:::d3d12
```hlsl
        groups[0] = (a + b + d + e) * (0.125f / 4.0f);
        groups[1] = (b + c + e + f) * (0.125f / 4.0f);
        groups[2] = (d + e + g + h) * (0.125f / 4.0f);
        groups[3] = (e + f + h + i) * (0.125f / 4.0f);
        groups[4] = (j + k + l + m) * (0.5f / 4.0f);
        groups[0] *= KarisAverage(groups[0]);
        groups[1] *= KarisAverage(groups[1]);
        groups[2] *= KarisAverage(groups[2]);
        groups[3] *= KarisAverage(groups[3]);
        groups[4] *= KarisAverage(groups[4]);
        downsample = groups[0] + groups[1] + groups[2] + groups[3] + groups[4];
        downsample = max(downsample, 0.0001f);
```

`mipLevel` ingår i root constants `DownsampleConstants`. learnopengl växlar med `switch (mipLevel)`; kursen skriver
`if (mipLevel == 0) … else …` med de gamla vikterna i `else`.
:::

`RenderDownsamples` sätter `mipLevel` till 0 före loopen och till 1 efter det första passet (`if (i == 0) { … }` i slutet
av loopens kropp). `max(…, 0.0001)` hindrar resultatet från att bli exakt noll.

Gör nu den sista uppgiften, **karis-average**. Bygg och kör: glöden runt de ljusaste delarna blir lite svagare – de ljusa
rutorna väger mindre – och i övrigt är bilden densamma. Projektets kamera står still, så det finns inga eldflugor att se;
i learnopengls demo, med en rörlig kamera, är skillnaden en lugn glöd i stället för en flimrande.

```quiz
Varför används Karis-medelvärdet bara i den första nedsamplingen?
- [ ] För att de senare nivåerna är för små för 13 sampel
- [ ] För att de senare passen läser R11G11B10, som inte kan lagra ljusa värden
- [x] För att bara indatan i full upplösning fortfarande har enskilda, extremt ljusa pixlar; efter den första nedsamplingen är de redan utjämnade, och att vikta igen skulle bara mörka ned glöden
- [ ] För att uppsamplingen tillämpar det på de andra nivåerna
---
Eldflugor kommer från detaljer mindre än en pixel i bilden i full upplösning. När den första nivån har tämjt dem använder de senare nedsamplingarna de energibevarande vikterna.
```

## Avslutande tankar

Jämfört med kapitlet *Bloom*:s gaussiska blur ger den fysikaliskt baserade bloomen en bredare, mjukare glöd för mindre
arbete: sex nedsamplings- och fem uppsamplingspass, alla i halv upplösning eller lägre, i stället för tio blurpass i full
upplösning; ingen tröskel att ställa in och ingen glöd som poppar av och på; och Karis-medelvärdet håller den stabil i
rörelse. Två tal styr den: `filterRadius` (hur långt varje uppsampling sprider) och `bloomStrength` (hur mycket av den
blurrade scenen som blandas in).

Motorer bygger vidare på samma kedja. En *smutsmask* (dirt mask) – en textur med fläckar som multipliceras med bloomen –
får glöden att se ut som ljus spritt på en smutsig lins. Kedjan kan byggas som en enda textur med mip-nivåer, och passen
göras i compute shaders med groupshared-minne. Och en sak är värd att komma ihåg: bloomen är en del av HDR-kedjan – den
hör hemma före tone mappingen och arbetar på scenens oklämda värden, och där lägger alla API:er den.

## Mer att läsa

- [Physically Based Bloom](https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom): learnopengls gästartikel som
  det här kapitlet följer, med jämförande bilder av den gamla och den nya bloomen och av eldflugor.
- [Bloom](https://learnopengl.com/Advanced-Lighting/Bloom): learnopengls ursprungliga bloom med tröskeln och den
  gaussiska bluren, kursens kapitel *Bloom*.
- [physically_based_bloom.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2022/6.physically_based_bloom/physically_based_bloom.cpp):
  learnopengls demo, som växlar mellan ingen bloom, den gamla och den nya.

:::opengl
- [Image Format (OpenGL Wiki)](https://www.khronos.org/opengl/wiki/Image_Format): det packade flyttalsformatet
  `GL_R11F_G11F_B10F` bland de andra formaten.
:::
:::vulkan
- [VkFormat](https://registry.khronos.org/vulkan/specs/latest/man/html/VkFormat.html): `VK_FORMAT_B10G11R11_UFLOAT_PACK32`
  och de andra packade formaten.
:::
:::d3d12
- [DXGI_FORMAT](https://learn.microsoft.com/en-us/windows/win32/api/dxgiformat/ne-dxgiformat-dxgi_format):
  `DXGI_FORMAT_R11G11B10_FLOAT` och de andra formaten.
:::
