# Compute shaders

Alla shaders hittills har haft en given plats i grafikpipelinen: vertex shaders transformerade vertexar, fragment shaders
färgade trianglarnas pixlar, och stegen däremellan – geometri och tessellering – formade primitiverna. Pipelinen
bestämde när varje shader kördes och vad den fick. Men under ytan är en GPU en maskin som kör ett litet program på
tusentals dataelement parallellt, och det går att använda till mycket mer än trianglar: fysik, partiklar, bildfilter,
culling, skinning, simulering av vätskor eller folkmassor, eller matematiken bakom maskininlärning. En **compute shader**
ger dig den maskinen direkt: inga vertexar, ingen rasterisering, inga fragment – bara ett program, ett antal anrop och de
buffrar och bilder som programmet läser och skriver.

Kapitlet följer learnopengls gästartikel *Compute Shaders: Introduction*. Programmet är compute-världens "hello world":
en compute shader fyller en textur med en färggradient som rör sig över tid, och en vanlig skärmfyrhörning visar
texturen. Litet som det är visar det alla delar: compute-pipelinen, arbetsgrupperna och deras ID:n, att skriva till en
bild från en shader, att starta arbetet (dispatch) och barriären som får ritningen att vänta på resultatet. Alla tre
API:erna har compute shaders; det här kapitlet visar hur {{api}} gör.

## Compute-steget

En compute shader körs som ett rutnät av **anrop** (*invocations*, i Direct3D *threads*) som är ordnade i
**arbetsgrupper** (*work groups*, i Direct3D *thread groups*). Storleken på en arbetsgrupp väljer du i shadern – här
10 × 10 × 1 = 100 anrop – och antalet arbetsgrupper när du startar arbetet med en **dispatch** – här 80 × 60 × 1 grupper.
Anropen i en arbetsgrupp körs tillsammans på samma del av GPU:n och kan dela snabbt minne och synkronisera med varandra;
olika arbetsgrupper är oberoende och kan köras i vilken ordning som helst, samtidigt eller efter varandra.

Varje anrop vet var det befinner sig genom inbyggda ID:n:

| GLSL | HLSL | Betydelse |
|---|---|---|
| `gl_WorkGroupSize` | – (värdena i `[numthreads]`) | arbetsgruppens storlek |
| `gl_NumWorkGroups` | – | antalet arbetsgrupper i dispatchen |
| `gl_WorkGroupID` | `SV_GroupID` | vilken arbetsgrupp anropet tillhör |
| `gl_LocalInvocationID` | `SV_GroupThreadID` | anropets plats inom arbetsgruppen |
| `gl_GlobalInvocationID` | `SV_DispatchThreadID` | anropets plats i hela dispatchen: grupp-ID × gruppstorlek + lokalt ID |

Programmet använder det sista: med ett anrop per texel *är* `gl_GlobalInvocationID.xy` (`SV_DispatchThreadID.xy`) den
texel som anropet skriver. 80 × 60 grupper med 10 × 10 anrop blir 800 × 600 anrop – ett för varje texel i en textur på
800 × 600. learnopengls textur är 1000 × 1000 och sträcks ut över fönstret; kursen gör den exakt lika stor som fönstret,
så att en texel motsvarar en pixel.

Varför välja en arbetsgruppsstorlek alls, i stället för bara "ett anrop per texel"? För att hårdvaran arbetar i grupper:
en GPU kör anrop i omgångar om 32 eller 64 (*warps*, *wavefronts*), och en arbetsgrupp delas upp i sådana omgångar. En
arbetsgrupp på 100 fyller bara delvis omgångar om 32 eller 64 – 64 eller 128 skulle utnyttja dem bättre – men 10 × 10
delar 800 × 600 jämnt, och skillnaden är liten för ett så litet program. I riktig kod väljer man multipler av 32 eller
64, till exempel 8 × 8 eller 16 × 16, och startar tillräckligt många grupper för att täcka datan, avrundat uppåt.

```quiz
En compute shader med `local_size_x = 10, local_size_y = 10` startas med 80 × 60 × 1 arbetsgrupper. Vilket värde har `gl_GlobalInvocationID.xy` i anropet med lokalt ID (3, 7) i arbetsgrupp (2, 5)?
- [ ] (5, 12): grupp-ID + lokalt ID
- [ ] (3, 7): det globala ID:t är det lokala
- [ ] (6, 35): grupp-ID × lokalt ID
- [x] (23, 57): grupp-ID × gruppstorlek + lokalt ID
---
`gl_GlobalInvocationID = gl_WorkGroupID * gl_WorkGroupSize + gl_LocalInvocationID` – i HLSL `SV_DispatchThreadID = SV_GroupID * numthreads + SV_GroupThreadID`. Med ett anrop per texel är det texelns koordinat.
```

:::opengl
Compute shaders kom med OpenGL **4.3**; learnopengls program begär 4.3, och det gör även det här kapitlets (shaders med
`#version 430 core`). **macOS stannar vid OpenGL 4.1**, så programmet går inte att köra på en Mac – där räknar man på
GPU:n med Metal. En compute shader är ett eget program, byggt av en enda shader av typen `GL_COMPUTE_SHADER`:
learnopengls klass `ComputeShader` i `shader_c.h` kompilerar en fil och länkar den, på samma sätt som klassen `Shader`
gör med två. learnopengl kallar sin fil `computeShader.cs`; kursen använder `.comp`, den vanliga filändelsen för
compute shaders i GLSL – `.cs` betyder C# för de flesta verktyg.
:::
:::vulkan
Compute finns i Vulkan från början: varje Vulkan-enhet som kan rita har en köfamilj som klarar både grafik- och
compute-arbete (vulkan-tutorials `graphicsAndComputeFamily`, som redan finns i startkoden). En compute shader körs i en
**compute-pipeline** – mycket enklare än en grafikpipeline: ett enda shadersteg och en pipeline layout, skapad med
`vkCreateComputePipelines`.
:::
:::d3d12
Compute ingår i varje Direct3D 12-enhet. En compute shader körs med ett **compute pipeline state** – mycket enklare än
ett för grafik: en root-signatur och compute shadern, inget annat – och en egen **compute-root-signatur**. Samma direkta
command list som ritar kan också starta compute-arbete; en separat compute-kö (som i Microsofts exempel nBodyGravity) gör
att compute kan köras parallellt med ritandet, men det behöver det här programmet inte.
:::

## Projektet

Startkoden skapar texturen – 800 × 600 texlar med fyra 32-bitars flyttal – fyller den från CPU:n med mörkblått och ritar
den på en skärmfyrhörning som täcker fönstret: learnopengls `renderQuad()` med `screenQuad.vs` / `.fs`. Fyllningen från
CPU:n är kursens tillägg, så att fyrhörningen visar något innan det finns en compute shader; learnopengl skapar texturen
utan data. Compute shaderns fil finns redan, men är tom. Bygg och kör programmet: det visar ett mörkblått fönster;
kommentarerna `// TODO:` visar var din kod ska in.

## Gränser

En dispatch kan inte vara hur stor som helst. Tre gränser spelar roll: hur många arbetsgrupper en dispatch högst får ha i
varje dimension, hur stor en arbetsgrupp högst får vara i varje dimension, och hur många anrop en arbetsgrupp högst får
ha totalt. learnopengl skriver ut dem i början.

:::opengl
Antalen och storlekarna är *indexerade* frågor – ett värde per dimension – som läses med `glGetIntegeri_v`:

```cpp
        glGetIntegeri_v(GL_MAX_COMPUTE_WORK_GROUP_COUNT, idx, &max_compute_work_group_count[idx]);
        glGetIntegeri_v(GL_MAX_COMPUTE_WORK_GROUP_SIZE, idx, &max_compute_work_group_size[idx]);
```

för `idx` 0, 1 och 2, och `glGetIntegerv(GL_MAX_COMPUTE_WORK_GROUP_INVOCATIONS, &max_compute_work_group_invocations)`.
OpenGL garanterar minst 65535 arbetsgrupper i varje dimension, arbetsgrupper på 1024 × 1024 × 64 och 1024 anrop.
:::
:::vulkan
Gränserna finns i `VkPhysicalDeviceLimits`: `maxComputeWorkGroupCount[3]`, `maxComputeWorkGroupSize[3]` och
`maxComputeWorkGroupInvocations`, som `printComputeLimits()` skriver ut med learnopengls texter. Vulkan garanterar minst
65535 arbetsgrupper per dimension, arbetsgrupper på 128 × 128 × 64 och 128 anrop – mindre än OpenGL, eftersom Vulkan
också körs på små mobil-GPU:er.
:::
:::d3d12
Direct3D 12 frågar inte drivrutinen: gränserna är desamma för alla enheter och finns som konstanter i `d3d12.h` –
`D3D12_CS_DISPATCH_MAX_THREAD_GROUPS_PER_DIMENSION` = 65535, `D3D12_CS_THREAD_GROUP_MAX_X` och `_MAX_Y` = 1024, `_MAX_Z` =
64, och `D3D12_CS_THREAD_GROUP_MAX_THREADS_PER_GROUP` = 1024. Uppgiften skriver dem till felsökarens utdata med
`OutputDebugStringA`, med learnopengls formuleringar.
:::

Ditt program skriver ut din drivrutins värden. Mesas CPU-drivrutin rapporterar till exempel 65535 grupper i varje
dimension, arbetsgrupper på 1024 × 1024 × 1024 och 1024 anrop. Grafikkort i vanliga datorer brukar rapportera 65535
eller 2³¹ − 1 grupper i x, arbetsgrupper på 1024 × 1024 × 64 och 1024 anrop. Observera att gränserna per dimension
*inte* säger allt: en arbetsgrupp på 1024 × 1024 × 1 håller sig inom gränserna för varje dimension men ligger långt över
de 1024 anrop som är tillåtna totalt.

Gör nu den första uppgiften, **limits**. Fönstret förblir mörkblått; siffrorna syns där ditt program skriver sin text: i
konsolen, eller för `OutputDebugStringA` i debuggerns Output-fönster.

```quiz
Vilken arbetsgruppsstorlek är tillåten på en GPU som rapporterar arbetsgrupper upp till 1024 × 1024 × 64 och 1024 anrop?
- [ ] 1024 × 1024 × 1: varje dimension håller sig inom sin gräns
- [x] 32 × 32 × 1: 1024 anrop, inom alla gränser
- [ ] 64 × 64 × 1: 64 är långt under 1024
- [ ] 1 × 1 × 128: ett anrop per grupp i x och y
---
Det totala antalet – produkten av de tre storlekarna – får inte överstiga gränsen för antal anrop, och varje dimension måste hålla sig inom sin egen: 64 × 64 = 4096 är för många, och 128 överstiger gränsen 64 i z.
```

## Att skriva till en bild

En fragment shader skriver till sina render targets på en bestämd plats – den pixel den kördes för. En compute shader
har ingen sådan plats; den skriver var den vill, till buffrar eller till **bilder** (*images*). En bild är här en textur
som är bunden för *läsning och skrivning*: shadern läser och skriver enskilda texlar med heltalskoordinater –
`imageLoad` och `imageStore` i GLSL, indexering av en `RWTexture2D` i HLSL – utan filtrering, utan mipmaps och utan
sampler. Samma textur kan vara bunden som bild för compute shadern och som vanlig samplad textur för fyrhörningen.

:::opengl
OpenGL binder bilder till **bildenheter** (*image units*), en uppsättning bindningspunkter som är skild från
texturenheterna:

```cpp
    glBindImageTexture(0, texture, 0, GL_FALSE, 0, GL_READ_WRITE, GL_RGBA32F);
```

– bildenhet 0, texturen, mipnivå 0, inte skiktad (`GL_FALSE`; skiktargumentet ignoreras då), åtkomst för läsning och
skrivning, formatet `GL_RGBA32F`. Formatet måste stämma med hur shadern deklarerar bilden, och bildläsning och
bildskrivning fungerar bara med format som har en angiven storlek. Själva texturen ligger kvar på texturenhet 0 för
fyrhörningen – en bildenhet är inte en texturenhet.
:::
:::vulkan
Vulkan har inga bildenheter: vad en shader får göra med en bild bestäms av bildens **usage** och av den **descriptor**
den är bunden med. Bilden får `VK_IMAGE_USAGE_STORAGE_BIT` bredvid `SAMPLED_BIT`, och den ligger i
**`VK_IMAGE_LAYOUT_GENERAL`**, den enda layout där en shader både får skriva till den och sampla den. Compute shadern ser
den genom ett eget descriptor set – bindning 0, `VK_DESCRIPTOR_TYPE_STORAGE_IMAGE`, steget `VK_SHADER_STAGE_COMPUTE_BIT`,
med `imageLayout = VK_IMAGE_LAYOUT_GENERAL` och utan sampler – medan fyrhörningens set har samma image view som combined
image sampler, också i `GENERAL`. Att skriva till ett 32-bitars flyttalsformat och att filtrera det linjärt är valfria
formategenskaper i Vulkan; `createTexture()` kontrollerar båda med `vkGetPhysicalDeviceFormatProperties`.
:::
:::d3d12
Direct3D:s motsvarighet till bildenheten är en **unordered access view** (UAV): en vy genom vilken en shader läser och
skriver en resurs i godtycklig ordning. Texturen skapas med `D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS` och får två vyer
i den shader-synliga heapen: SRV:n på plats 0 för fyrhörningens `Texture2D tex : register(t0)`, och UAV:n på plats 1 för
compute shaderns `RWTexture2D<float4> imgOutput : register(u0)`. Compute shaderns root-signatur har en tabell med UAV:n.
:::

Gör nu den andra uppgiften, **image-unit** (**storage-image** i Vulkan). Ingenting ändras ännu: texturen går att skriva
till, men ingenting skriver till den.

```quiz
Compute shadern skriver texturen som en bild, och fyrhörningen läser samma textur genom en sampler. Varför två sorters åtkomst?
- [x] Skrivning adresserar enskilda texlar med heltalskoordinater, utan filtrering; sampling läser filtrerade värden vid normaliserade koordinater – en och samma textur kan bindas på båda sätten
- [ ] En textur kan bara skrivas en gång; därefter är den skrivskyddad och måste samplas
- [ ] Bilder ligger i CPU:ns minne, så fyrhörningen kan inte läsa dem direkt
- [ ] Bara en fragment shader får skriva till en textur genom en sampler
---
`imageStore` / `RWTexture2D` skriver exakta texlar, och en shader kan skriva var den vill. Sampling lägger till filtrering, mipmaps och omslag, men kan inte skriva. Båda är vyer av samma minne.
```

## Compute shadern

Shadern är kort. Den anger storleken på sina arbetsgrupper och vilken bild den skriver till, och i `main` räknar den ut
färgen för en texel: rött som stiger från 0 vid vänsterkanten till 1 vid högerkanten, grönt från 0 i texelrad 0 till 1
i den sista raden. Bredden och höjden är antalet anrop i varje dimension – antalet arbetsgrupper gånger deras storlek –
vilket är texturens storlek eftersom dispatchen täcker den exakt.

:::opengl
```glsl
// a work group is 10 x 10 invocations (one per texel)
layout (local_size_x = 10, local_size_y = 10, local_size_z = 1) in;

// the texture we write to, on image unit 0
layout (rgba32f, binding = 0) uniform image2D imgOutput;
```

och i `main`:

```glsl
    vec4 value = vec4(0.0, 0.0, 0.0, 1.0);
    ivec2 texelCoord = ivec2(gl_GlobalInvocationID.xy); // this invocation's texel
```

```glsl
    value.y = float(texelCoord.y) / (gl_NumWorkGroups.y * gl_WorkGroupSize.y);
    imageStore(imgOutput, texelCoord, value);
```

med `value.x = float(texelCoord.x) / (gl_NumWorkGroups.x * gl_WorkGroupSize.x);` tills vidare. `binding = 0` anger
bildenheten, `rgba32f` det format som shadern läser och skriver bilden i.
:::
:::vulkan
```glsl
// one work group = 10 x 10 invocations (gl_WorkGroupSize); the program dispatches 80 x 60 groups (gl_NumWorkGroups)
layout(local_size_x = 10, local_size_y = 10, local_size_z = 1) in;

// the texture the program also samples, as a storage image: four 32-bit floats per texel
layout(rgba32f, binding = 0) uniform image2D imgOutput;
```

och i `main`:

```glsl
    vec4 value = vec4(0.0, 0.0, 0.0, 1.0);
    ivec2 texelCoord = ivec2(gl_GlobalInvocationID.xy);
```

```glsl
    value.y = float(texelCoord.y) / (gl_NumWorkGroups.y * gl_WorkGroupSize.y);
    imageStore(imgOutput, texelCoord, value);
```

med `value.x = float(texelCoord.x) / (gl_NumWorkGroups.x * gl_WorkGroupSize.x);` tills vidare. `binding = 0` är
lagringsbildens bindning i compute-descriptor setet, `rgba32f` det format som shadern läser och skriver bilden i.
:::
:::d3d12
```hlsl
[numthreads(10, 10, 1)]
void CSMain(uint3 dispatchThreadID : SV_DispatchThreadID)
{
    float4 value = float4(0.0f, 0.0f, 0.0f, 1.0f);
    // SV_DispatchThreadID: the thread's position among all threads of the dispatch
    // (GLSL's gl_GlobalInvocationID) - here the texel it writes.
    int2 texelCoord = int2(dispatchThreadID.xy);
    // The texture's size: all the threads of the dispatch, one per texel (GLSL's
    // gl_NumWorkGroups * gl_WorkGroupSize - HLSL has no number of thread groups).
    uint imageWidth, imageHeight;
    imgOutput.GetDimensions(imageWidth, imageHeight);
```

sedan `value.x = float(texelCoord.x) / imageWidth;` tills vidare, `value.y = float(texelCoord.y) / imageHeight;` och

```hlsl
    imgOutput[texelCoord] = value;
```

– att skriva till en `RWTexture2D` är bara en tilldelning till ett element. HLSL har ingen inbyggd variabel för antalet
trådgrupper, så shadern frågar texturen om dess storlek, som dispatchen täcker exakt.
:::

### Dispatch och barriär

Varje bildruta kör programmet nu compute shadern innan det ritar fyrhörningen: 80 × 60 arbetsgrupper, ett anrop per
texel. Sedan kommer ett steg som är lätt att glömma: en **barriär**. GPU:n kör arbete asynkront och parallellt, och den
cachar det den skriver; utan besked kan den starta fyrhörningens fragment shader medan compute shadern fortfarande
skriver texturen, eller läsa gammal data ur en cache. I grafikpipelinen lägger API:et in sådana väntanden åt dig – i
OpenGL är ett render target färdigt innan det samplas, Vulkans render passes deklarerar sina beroenden, och Direct3D 12:s
övergångar sköter det. Skrivningar från en compute shader till en bild täcks inte av det, så programmet måste själv säga
att de följande läsningarna beror på dem.

:::opengl
```cpp
        // fill the texture: one invocation per texel, in work groups of 10 x 10
        computeShader.use();
        computeShader.setFloat("t", currentFrame);
        glDispatchCompute((unsigned int)TEXTURE_WIDTH / 10, (unsigned int)TEXTURE_HEIGHT / 10, 1);

        // make sure writing to image has finished before read
        glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT);
```

(utan raden med `setFloat` i den här uppgiften – den kommer med tiden.) `glMemoryBarrier` anger hur den skrivna datan
ska *läsas* efteråt: `GL_SHADER_IMAGE_ACCESS_BARRIER_BIT` täcker `imageLoad` / `imageStore`. Fyrhörningen läser texturen
genom att sampla den, och för samplade läsningar anger specifikationen `GL_TEXTURE_FETCH_BARRIER_BIT`. learnopengl
använder bara bildbiten, och kursen behåller den; det fungerar med vanliga drivrutiner, men
`GL_SHADER_IMAGE_ACCESS_BARRIER_BIT | GL_TEXTURE_FETCH_BARRIER_BIT` är det försiktiga valet. Eftersom shadern skriver
varje texel behöver texturen inte längre någon data: skapa den med `NULL`, som learnopengl gör, och ta bort programmet
på slutet med `glDeleteProgram(computeShader.ID)`.
:::
:::vulkan
`recordCommandBuffer()` spelar in compute-arbetet först, före render passet:

```cpp
        vkCmdDispatch(commandBuffer, TEXTURE_WIDTH / 10, TEXTURE_HEIGHT / 10, 1);
```

efter att `computePipeline` och compute-descriptor setet har bundits vid `VK_PIPELINE_BIND_POINT_COMPUTE`. Sedan en image
memory barrier – från compute shaderns skrivningar till fragment shaderns läsningar, med layouten kvar i `GENERAL`:

```cpp
        VkImageMemoryBarrier barrier{};
        barrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
        barrier.srcAccessMask = VK_ACCESS_SHADER_WRITE_BIT;
        barrier.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
        barrier.oldLayout = VK_IMAGE_LAYOUT_GENERAL;
        barrier.newLayout = VK_IMAGE_LAYOUT_GENERAL;
```

```cpp
        vkCmdPipelineBarrier(commandBuffer, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT, 0, 0, nullptr, 0, nullptr, 1, &barrier);
```

– learnopengls `glMemoryBarrier`, men exakt: stegen säger *vem* som väntar på *vem*, åtkomstmaskerna *vad* som måste
göras synligt. Därefter ritar render passet fyrhörningen. vulkan-tutorials compute-kapitel skickar compute-arbetet på en
egen kö med en semafor mellan de två inskickningarna, så att compute och ritande kan överlappa; en command buffer med en
barriär är den enkla motsvarigheten till learnopengls program. Compute-pipelinen (`createComputePipeline()`, från
vulkan-tutorial) har en egen layout med compute-descriptor-set-layouten. Bilden behöver inte längre någon data: den går
direkt från `UNDEFINED` till `GENERAL`.
:::
:::d3d12
`PopulateCommandList` spelar in compute-arbetet först – compute pipeline state och root-signatur, UAV-tabellen,
dispatchen:

```cpp
    m_commandList->SetPipelineState(m_computePipelineState.Get());
    m_commandList->SetComputeRootSignature(m_computeRootSignature.Get());
    m_commandList->SetComputeRootDescriptorTable(0, CD3DX12_GPU_DESCRIPTOR_HANDLE(m_srvUavHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_srvUavDescriptorSize));    // the UAV, heap slot 1
```

```cpp
    m_commandList->Dispatch(TEXTURE_WIDTH / 10, TEXTURE_HEIGHT / 10, 1);
```

Compute och grafik har separata root-signaturer och separata anrop – `SetComputeRoot…` och `SetGraphicsRoot…`. Sedan en
**övergångsbarriär** (*transition barrier*), som både väntar på compute shadern och byter texturens roll från UAV till
shaderresurs – learnopengls `glMemoryBarrier`:

```cpp
    CD3DX12_RESOURCE_BARRIER textureBarrier = CD3DX12_RESOURCE_BARRIER::Transition(m_texture.Get(), D3D12_RESOURCE_STATE_UNORDERED_ACCESS, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, &textureBarrier);
```

Därefter ritar grafikens pipeline state och root-signatur fyrhörningen, och i slutet av bildrutan gör en barriär om
texturen till `UNORDERED_ACCESS` igen inför nästa dispatch. (Två compute-pass som skriver och läser samma UAV utan att
byta dess tillstånd skulle i stället använda en **UAV-barriär** – `CD3DX12_RESOURCE_BARRIER::UAV`.) Compute pipeline
statet behöver bara root-signaturen och shadern: `D3D12_COMPUTE_PIPELINE_STATE_DESC` med `CS` kompilerad från `CSMain`
som `cs_5_0`, skapad med `CreateComputePipelineState`. Texturen behöver inte längre någon data: den börjar i
`UNORDERED_ACCESS`.
:::

Vilket håll blir bilden åt? Compute shadern skriver texelrad 0 med grönt 0. OpenGL:s fyrhörning har texturkoordinaten
v = 0 längst ned i fönstret, och v = 0 är texturens rad 0, så det gröna börjar nedtill.
:::vulkan
Vulkans y i normaliserade enhetskoordinater pekar nedåt, så kursens fyrhörning lägger v = 0 på vertexarna med y = +1 –
fönstrets nederkant – och v = 1 överst: rad 0 hamnar nedtill, som i OpenGL.
:::
:::d3d12
Fyrhörningen behåller learnopengls texturkoordinater – v = 1 överst, v = 0 nederst – och i Direct3D är v = 0 också rad 0,
så rad 0 hamnar nedtill, som i OpenGL. (Det vända v som kursen använder för bildfiler behövs inte här: den här texturen
är ingen bildfil, och det är shadern som bestämmer vad rad 0 är.)
:::
Fönsterpixel (x, y) visar texel (x, 599 − y) i alla API:er.

Gör nu den tredje uppgiften, **compute-shader**. Bygg och kör: en röd-grön gradient – svart nere till vänster, rött åt
höger, grönt uppåt, gult uppe till höger – uträknad av 480 000 anrop.

```quiz
Vad kan hända om barriären efter dispatchen utelämnas?
- [ ] Ingenting: kommandon på GPU:n blir alltid klara i den ordning de spelades in
- [ ] Dispatchen hoppas över, eftersom texturen fortfarande är bunden till fyrhörningen
- [x] Fyrhörningens fragment shader kan läsa texturen medan compute shadern fortfarande skriver den, eller läsa gammal data ur en cache – bilden kan bli delvis gammal eller fel
- [ ] Kompilatorn underkänner compute shadern
---
GPU:er låter arbete överlappa och cachar skrivningar. Barriären talar om för drivrutinen att nästa läsningar beror på compute shaderns skrivningar: vänta på dem och gör dem synliga.
```

## Animering

learnopengl låter den röda rampen röra sig över tid: shadern får tiden `t` i sekunder, lägger till `t · speed` till
texelns x och låter summan slå runt vid texturens bredd med `mod`, så att rampen glider åt höger med 100 texlar per
sekund och börjar om från vänster. learnopengl slår runt vid 1000, bredden på sin textur; kursens är 800.

:::opengl
```glsl
layout (location = 0) uniform float t; // time
```

```glsl
    value.x = mod(float(texelCoord.x) + t * speed, width) / (gl_NumWorkGroups.x * gl_WorkGroupSize.x);
```

med `float speed = 100;` och `float width = 800;`, och i loopen `computeShader.setFloat("t", currentFrame);` efter
`computeShader.use()` – en uniform i compute-programmet, som sätts som vilken annan som helst.
:::
:::vulkan
Tiden blir en push constant i compute-pipelinen – `layout(push_constant) uniform PushConstants { float t; } pc;` i
shadern, `struct PushConstants { float t; }` i C++, ett push constant-intervall för `VK_SHADER_STAGE_COMPUTE_BIT` i
`computePipelineLayout` – som skickas efter att compute-pipelinen bundits, med `vkCmdPushConstants(commandBuffer,
computePipelineLayout, VK_SHADER_STAGE_COMPUTE_BIT, …)`. Shaderns rad:

```glsl
    value.x = mod(float(texelCoord.x) + pc.t * speed, width) / (gl_NumWorkGroups.x * gl_WorkGroupSize.x);
```
:::
:::d3d12
Tiden blir en root-konstant – `cbuffer TimeConstants : register(b0) { float t; };` i HLSL, root-parameter 1 i
compute-root-signaturen, satt med `SetComputeRoot32BitConstants(1, sizeof(TimeConstants) / 4, &timeConstants, 0)` före
dispatchen – och shaderns rad använder `fmod`, HLSL:s `mod` (som ger samma resultat för positiva tal):

```hlsl
    value.x = fmod(float(texelCoord.x) + t * speed, width) / imageWidth;
```
:::

Gör nu den sista uppgiften, **time**. Bygg och kör: den röda rampen glider åt höger och slår runt. Vid 1,0 s har den
flyttat sig 100 texlar: det starkaste röda ligger vid x = 699, och rampen börjar om från svart vid x = 700.

```quiz
Vilket rödvärde har texel x = 700 vid t = 1,0 s, med speed 100 och width 800?
- [ ] 1,0: det är den ljusaste texeln
- [x] 0,0: mod(700 + 100, 800) = 0 – rampen har slagit runt
- [ ] 0,875: 700 / 800
- [ ] 1,0, begränsat från 800 / 800
---
x = 699 ger mod(799, 800) / 800 ≈ 1,0, x = 700 ger 0. Med tiden flyttar sig omslagspunkten åt höger tillsammans med rampen, 100 texlar per sekund.
```

## Vidare

Det här programmet skriver en textur som en fragment shader lika gärna kunde ha ritat. Compute shaders kommer till sin
rätt när arbetet inte passar grafikpipelinens form:

- **Delat minne.** Anropen i en arbetsgrupp kan dela snabbt minne på chippet (`shared` i GLSL, `groupshared` i HLSL) och
  synkronisera med `barrier()` / `GroupMemoryBarrierWithGroupSync()`. Ett oskärpefilter läser in en ruta av bilden en
  gång till delat minne och låter varje anrop läsa sina grannar därifrån – knepet bakom snabb bloom och snabba
  efterbehandlingsfilter.
- **Partiklar och simulering.** Positioner och hastigheter i en lagringsbuffer, som en compute shader uppdaterar varje
  bildruta och som ritas som instanser – utan en vända via CPU:n.
- **Culling och indirekt ritning.** En compute shader testar tusentals objekt mot frustumet och skriver ritkommandona
  för de synliga till en buffer som en indirekt ritning sedan använder.
- **Skinning, ljussättning, efterbehandling.** Att skinna meshar en gång per bildruta, att sortera ljus i rutor för tiled
  eller clustered shading, tonmappning och andra effekter i skärmrymden.

## Fler resurser

- [Compute Shaders: Introduction](https://learnopengl.com/Guest-Articles/2022/Compute-Shaders/Introduction):
  learnopengls gästartikel, som det här kapitlet följer.
- [compute_shader_hello_world.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2022/5.computeshader_helloworld/compute_shader_hello_world.cpp):
  learnopengls program.

:::opengl
- [Compute Shader (OpenGL Wiki)](https://www.khronos.org/opengl/wiki/Compute_Shader): arbetsgrupper, de inbyggda
  ID:na, delat minne och gränserna.
- [glMemoryBarrier](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMemoryBarrier.xhtml): vilken barriärbit
  som hör till vilket slags läsning.
:::
:::vulkan
- [Compute Shader](https://vulkan-tutorial.com/Compute_Shader): vulkan-tutorials kapitel om compute-pipelines,
  lagringsbuffrar och bilder, och synkronisering.
- [vkCmdPipelineBarrier](https://registry.khronos.org/vulkan/specs/latest/man/html/vkCmdPipelineBarrier.html): steg,
  åtkomstmasker och image memory barriers.
:::
:::d3d12
- [Compute Shader Overview](https://learn.microsoft.com/en-us/windows/win32/direct3d11/direct3d-11-advanced-stages-compute-shader):
  trådgrupper och systemvärdena.
- [Using resource barriers](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-resource-barriers-to-synchronize-resource-states-in-direct3d-12):
  övergångs- och UAV-barriärer.
:::
