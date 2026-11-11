# Anti-aliasing

Någon gång under din äventyrliga renderingsresa har du förmodligen stött på taggiga, sågtandade mönster längs dina
modellers kanter. De här *taggiga kanterna* uppstår på grund av hur rastreraren omvandlar vertexdatan till faktiska
fragment bakom kulisserna. En pixel ligger antingen inuti en triangel eller inte; en kant som går snett genom
pixelrutnätet blir därför en trappa. Den här effekten, att man tydligt ser pixlarna som en kant består av, kallas
*aliasing*. Det finns en hel del tekniker, kallade *anti-aliasing*, som motverkar aliasing genom att ge *mjuka* kanter.

Först hade vi en teknik som heter *super sample anti-aliasing* (SSAA), som tillfälligt använder en renderbuffer med
mycket högre upplösning att rendera scenen i (super sampling). När hela scenen är renderad skalas upplösningen ned
till den vanliga igen. Den här *extra* upplösningen användes för att undvika de taggiga kanterna. Den löste visserligen
aliasingproblemet, men till ett högt pris i prestanda, eftersom vi måste rita **mycket** fler fragment än vanligt: fyra
gånger så många pixlar betyder fyra gånger så mycket arbete för varje fragment shader. Tekniken fick därför bara en
kort storhetstid.

Ur den här tekniken föddes en modernare teknik som heter *multisample anti-aliasing* eller MSAA, som lånar idéerna
bakom SSAA men gör det mycket effektivare. I det här kapitlet går vi utförligt igenom MSAA, eftersom varje grafik-API
har det inbyggt.

:::opengl
Projektet är learnopengls scen: en kub i origo, helt grön, på den mörka bakgrunden (0.1, 0.1, 0.1), sedd från kameran
på (0, 0, 3) – WASD, musen och scrollhjulet flyttar den fortfarande. En sak skiljer sig från learnopengl: kuben är
vriden en fast vinkel på 30° kring axeln (1, 1, 0). learnopengls ovridna kub, sedd framifrån, är en kvadrat med vågräta
och lodräta kanter, som inte visar några trappsteg alls – så anti-aliasing skulle inte ändra något synligt. Shadrarna
är `anti_aliasing.vs/.fs`; `aa_post.vs/.fs`, för en skärmfyrhörning, används från uppgiften `resolve`.
:::
:::vulkan
Projektet är learnopengls scen i de tidigare kapitlens program: en kub i origo, helt grön, på den mörka bakgrunden (0.1,
0.1, 0.1), sedd från kameran på (0, 0, 3) – WASD, musen och scrollhjulet flyttar den fortfarande.
`createPipeline(vert, frag, attributeCount, pipeline)` skapar kubens pipeline (kubens shaders läser bara positionen),
view och projektion ligger i uniform buffern, modellmatrisen är en push constant. En sak skiljer sig från learnopengl:
kuben är vriden en fast vinkel på 30° kring axeln (1, 1, 0). learnopengls ovridna kub, sedd framifrån, är en kvadrat
med vågräta och lodräta kanter, som inte visar några trappsteg alls – så anti-aliasing skulle inte ändra något synligt.
Shadrarna är `shaders/anti_aliasing.vert/.frag`; `shaders/aa_post.vert/.frag`, för en skärmfyrhörning, används från
uppgiften `resolve`.
:::
:::d3d12
Projektet är learnopengls scen: en kub i origo, helt grön, på den mörka bakgrunden (0.1, 0.1, 0.1), sedd från kameran
på (0, 0, 3) – WASD, musen och hjulet flyttar den fortfarande. Root constants innehåller modellmatrisen (b0), constant
buffern view och projektion (b1); shadrarna ligger i `anti_aliasing.hlsl`. En sak skiljer sig från learnopengl: kuben
är vriden en fast vinkel på 30° kring axeln (1, 1, 0). learnopengls ovridna kub, sedd framifrån, är en kvadrat med
vågräta och lodräta kanter, som inte visar några trappsteg alls – så anti-aliasing skulle inte ändra något synligt.
`aa_post.hlsl`, för en skärmfyrhörning, används från uppgiften `resolve`.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift bygger och kör du programmet i din
IDE. Just nu visar den kubens gröna siluett – en sexhörning av tre sidor, alla i samma grönt – med hårda,
trappstegsformade kanter: varje pixel är antingen exakt grön eller exakt bakgrunden. Zooma in på en sned kant i tanken,
så ser du trappan.

## Multisampling

För att förstå vad multisampling är och hur det löser aliasingproblemet måste vi först gräva lite djupare i hur
rastreraren fungerar.

Rastreraren är alla de algoritmer och processer som sitter mellan dina färdigbehandlade vertices och fragment shadern.
Rastreraren tar alla vertices som hör till en primitiv och gör om dem till en mängd fragment. Vertexkoordinater kan i
teorin ha vilka värden som helst, men det kan inte fragment, eftersom de är bundna till skärmens upplösning. Det blir
nästan aldrig en ett-till-ett-avbildning mellan vertexkoordinater och fragment, så rastreraren måste på något sätt
avgöra vilket fragment/vilken skärmkoordinat varje vertex hamnar på.

Utan multisampling har varje pixel en enda *samplingspunkt* i mitten som avgör om pixeln täcks av triangeln. Täcker
triangeln samplingspunkten skapas ett fragment för pixeln; annars förblir pixeln som den är – även när triangeln täcker
nästan hela pixeln utom mitten. Eftersom skärmen har ett begränsat antal pixlar ritas vissa pixlar längs en kant och
andra inte. Resultatet är att vi renderar primitiver med ojämna kanter, vilket ger de taggiga kanter vi sett förut.

Det multisampling gör är att använda inte en enda samplingspunkt för att avgöra om triangeln täcker pixeln, utan flera
(gissa var namnet kommer ifrån). I stället för en enda samplingspunkt mitt i varje pixel placerar vi 4 *subsamples* i
ett visst mönster och använder dem för att avgöra täckningen. Det betyder att färgbuffern också måste växa: den lagrar
nu en färg för varje sample, 4 per pixel.

En triangel som bara täcker några av pixelns subsamples ritas ändå för den pixeln. Här kommer det effektiva: i stället
för att köra fragment shadern för varje täckt subsample (det vore SSAA igen) **körs fragment shadern bara en gång per
pixel** (per primitiv), oavsett hur många subsamples triangeln täcker – med vertexdatan interpolerad till pixelns mitt.
Dess enda utdatafärg lagras sedan i varje subsample som triangeln täcker. De subsamples som triangeln inte täcker
behåller det som fanns där förut – till exempel bakgrunden.

När alla primitiver är ritade slås varje pixels samples ihop: pixelns slutliga färg är medelvärdet av dess subsamples.
Det steget kallas att *resolva* den multisamplade buffern. En pixel på kubens kant vars 4 samples är 2 gröna och 2
bakgrund hamnar mitt emellan de två färgerna; med 1 eller 3 gröna samples blir den en fjärdedel respektive tre
fjärdedelar grön. Det är precis det som får kanten att se mjuk ut: ju fler samplingspunkter som täcks, desto mer
bestäms pixelns färg av triangeln.

För djuptestet gäller samma sak: djupbuffern är också multisamplad, med lika många samples. Vertexens djupvärde
interpoleras till varje subsample innan djuptestet körs, och stenciltestet lagrar likaså ett stencilvärde per
subsample. Det betyder att buffrarnas storlek nu ökar med antalet samples per pixel.

```quiz
Med 4x MSAA täcker en triangel 2 av en pixels 4 samples. Hur många gånger körs fragment shadern för den här pixeln och triangeln, och vad visar pixeln efter resolven?
- [ ] 2 gånger, en per täckt sample; pixeln visar triangelns färg
- [ ] 4 gånger, en per sample; pixeln visar medelvärdet av fyra shaderresultat
- [x] En gång; färgen lagras i de 2 täckta samples, och den resolvade pixeln är till hälften triangelns färg, till hälften det de andra 2 samples innehåller
- [ ] Inte alls, eftersom pixelns mitt kanske inte täcks
---
Det är MSAA:s knep jämfört med SSAA: täckning (och djup) testas per sample, men fragment shadern körs en gång per pixel och primitiv. Resolven tar medelvärdet av samples, så en kantpixel får en blandning i proportion till sin täckning.
```

Det vi gått igenom hittills är en grundläggande översikt av hur multisamplad anti-aliasing fungerar bakom kulisserna.
Logiken i rastreraren är egentligen lite mer komplicerad, men den här korta beskrivningen räcker för att förstå idén
bakom multisamplad anti-aliasing; tillräckligt för att gå in på det praktiska.

## MSAA i {{api}}

:::opengl
Vill vi använda MSAA i OpenGL behöver vi en buffer som kan lagra mer än ett samplevärde per pixel. Vi behöver en ny
sorts buffer som kan lagra ett visst antal samples, och den kallas *multisample buffer*.

De flesta fönstersystem kan ge oss en multisample buffer i stället för en vanlig. GLFW har också den funktionen, och
allt vi behöver göra är att ge GLFW en *hint* om att vi vill ha en multisample buffer med N samples i stället för en
vanlig buffer, genom att anropa `glfwWindowHint` innan fönstret skapas. När vi sedan anropar `glfwCreateWindow` skapar
vi ett renderfönster, men den här gången med en buffer med 4 subsamples per skärmkoordinat. Det betyder att bufferns
storlek ökar med en faktor 4.

Nu när vi bett GLFW om multisamplade buffrar måste vi slå på multisampling genom att anropa `glEnable` med
`GL_MULTISAMPLE`. I de flesta OpenGL-drivrutiner är multisampling påslaget som standard, så anropet är då lite
överflödigt, men det är oftast en bra idé att slå på det ändå. På så sätt har alla OpenGL-implementationer
multisampling påslaget.

Gör nu den första uppgiften, **msaa**. Bredvid de andra fönsterhintarna, innan fönstret skapas:

```cpp
    glfwWindowHint(GLFW_SAMPLES, 4); // a multisample buffer with 4 samples per pixel
```

och efter `glEnable(GL_DEPTH_TEST);`:

```cpp
    glEnable(GL_MULTISAMPLE); // enabled by default on some drivers, but not all so always enable to make sure
```

Eftersom själva multisamplingalgoritmerna sitter i rastreraren i dina OpenGL-drivrutiner behöver vi inte göra mycket
mer. Renderar vi nu den gröna kuben från kapitlets början bör vi se mjukare kanter.

Bygg och kör: kubens kanter är mjuka nu. Ungefär 800 pixlar längs kanterna är inte längre rent gröna eller ren bakgrund,
utan blandningar med en fjärdedel, hälften och tre fjärdedelar grönt. Om ett riktigt fönster får en multisample buffer
beror på fönstersystemet och drivrutinen: där ingen finns skapar GLFW tyst ett fönster utan, och kanterna förblir
taggiga. Nästa avsnitts version utanför skärmen beror inte på det.
:::
:::vulkan
I OpenGL börjar MSAA med en fönsterhint: GLFW ber fönstersystemet om en multisamplad standard-framebuffer
(`glfwWindowHint(GLFW_SAMPLES, 4)`), och drivrutinen resolvar den när bilden visas. Vulkan har inget sådant: swap
chainens bilder har alltid ett sample per pixel. Multisampling i Vulkan betyder att rita i en **egen multisamplad
färgbild** (med en djupbild med lika många samples) och **resolva** den – ta medelvärdet av varje pixels samples – in i
swap chainens bild med ett sample i slutet av render passet. Det är OpenGL:s nästa avsnitt, *off-screen MSAA*, och det
är vad vulkan-tutorials kapitel *Multisampling* gör. I Vulkan blir learnopengls två steg alltså ett.

### Ta reda på tillgängligt antal samples

Vi börjar med att ta reda på hur många samples vår hårdvara kan använda. De flesta moderna GPU:er stöder minst 8
samples, men det är inte garanterat överallt. Den fysiska devicens gränser talar om vilka antal vi kan använda för färg-
och för djupattachments; eftersom vi använder båda tar vi de antal som båda stöder.

Gör nu den första uppgiften, **sample-count**. Lägg till en medlem för antalet samples:

```cpp
    VkSampleCountFlagBits msaaSamples = VK_SAMPLE_COUNT_1_BIT; // samples per pixel
```

och en funktion som tar reda på det:

```cpp
    // The number of samples per pixel to use: 4 like learnopengl, if the device has them for colour and depth images
    // (vulkan-tutorial takes the most the device offers, up to 64).
    VkSampleCountFlagBits getMaxUsableSampleCount() {
        VkPhysicalDeviceProperties physicalDeviceProperties;
        vkGetPhysicalDeviceProperties(physicalDevice, &physicalDeviceProperties);

        VkSampleCountFlags counts = physicalDeviceProperties.limits.framebufferColorSampleCounts & physicalDeviceProperties.limits.framebufferDepthSampleCounts;
        if (counts & VK_SAMPLE_COUNT_4_BIT) { return VK_SAMPLE_COUNT_4_BIT; }
        if (counts & VK_SAMPLE_COUNT_2_BIT) { return VK_SAMPLE_COUNT_2_BIT; }

        return VK_SAMPLE_COUNT_1_BIT;
    }
```

vulkan-tutorial kontrollerar från `VK_SAMPLE_COUNT_64_BIT` och nedåt och tar det mesta devicen erbjuder; vi stannar
vid 4, learnopengls antal, så att bilden blir densamma på varje GPU. (Varje Vulkan-device stöder minst 1 och 4 samples
för de här attachments.) I `pickPhysicalDevice()`, vid TODO:n, direkt efter `physicalDevice = device;`:

```cpp
                msaaSamples = getMaxUsableSampleCount();
```

Bilderna vi snart skapar måste veta sitt antal samples, så `createImage()` får en parameter för det, efter höjden, som
hamnar i `imageInfo.samples`:

```cpp
    void createImage(uint32_t width, uint32_t height, VkSampleCountFlagBits numSamples, VkFormat format,
```

```cpp
        imageInfo.samples = numSamples;
```

Än så länge skickar djupbilden `VK_SAMPLE_COUNT_1_BIT`. Bygg och kör: ingenting ändras ännu – vi har bara tagit reda på
vad vi kan använda.

### Sätta upp ett render target

I MSAA samplas varje pixel i en buffer utanför skärmen, som sedan renderas till skärmen. Den nya buffern skiljer sig
lite från de vanliga bilder vi har renderat till – den måste kunna lagra mer än ett sample per pixel. När en
multisamplad buffer är skapad måste den resolvas till standard-framebuffern (som bara lagrar ett sample per pixel).
Därför måste vi skapa ett extra render target och ändra hur vi ritar. Vi behöver bara ett render target, eftersom bara
en ritoperation är aktiv åt gången, precis som med djupbuffern.

Gör nu uppgiften **msaa**. Lägg till medlemmarna `VkImage colorImage; VkDeviceMemory colorImageMemory; VkImageView
colorImageView;` och en funktion som skapar den multisamplade färgbilden, anropad före `createDepthResources()`:

```cpp
    // The multisampled colour image (and its view) the size of the window. It only lives during the render pass
    // (transient): only the resolved picture is kept.
    void createColorResources() {
        VkFormat colorFormat = swapChainImageFormat;

        createImage(swapChainExtent.width, swapChainExtent.height, msaaSamples, colorFormat, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT | VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, colorImage, colorImageMemory);
        colorImageView = createImageView(colorImage, colorFormat, VK_IMAGE_ASPECT_COLOR_BIT);
    }
```

`VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT` säger till drivrutinen att bildens innehåll bara behövs under render passet –
på GPU:er med tile-minne kanske den aldrig skrivs till riktigt minne alls. Multisamplade bilder kan inte heller ha
mipnivåer: specifikationen kräver en nivå när det finns mer än ett sample. Förstör bilden, dess minne och dess vy i
`cleanup()`.

Djupbilden får samma antal samples – täckning och djup testas per sample:

```cpp
        createImage(swapChainExtent.width, swapChainExtent.height, msaaSamples, depthFormat,
```

### Lägga till nya attachments

Vi tar hand om render passet först. I `createRenderPass()` är färgattachmentet nu den multisamplade bilden, och
djupattachmentet får också samples:

```cpp
        colorAttachment.samples = msaaSamples;
```

```cpp
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
```

```cpp
        depthAttachment.samples = msaaSamples; // the depth test is done for every sample
```

Du märker att vi har ändrat `finalLayout` från `VK_IMAGE_LAYOUT_PRESENT_SRC_KHR` till
`VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL`. Det beror på att multisamplade bilder inte kan presenteras direkt. Först
måste de resolvas till en vanlig bild. Det kravet gäller inte djupbuffern, som aldrig presenteras. Därför behöver vi
bara lägga till ett nytt attachment för färg, ett så kallat resolve attachment – swap chainens bild:

```cpp
        // the swap chain image: at the end of the subpass each pixel's samples are averaged ("resolved") into it
        VkAttachmentDescription colorAttachmentResolve{};
        colorAttachmentResolve.format = swapChainImageFormat;
        colorAttachmentResolve.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachmentResolve.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachmentResolve.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachmentResolve.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachmentResolve.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachmentResolve.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachmentResolve.finalLayout = VK_IMAGE_LAYOUT_PRESENT_SRC_KHR;
```

Dess `loadOp` är `DONT_CARE`: varje pixel skrivs över av resolven. Render passet måste nu få veta att det ska resolva
den multisamplade färgbilden in i det vanliga attachmentet. Skapa en ny attachment-referens som pekar på färgbuffern
som ska vara resolve-mål, och sätt den som subpassets `pResolveAttachments`:

```cpp
        VkAttachmentReference colorAttachmentResolveRef{};
        colorAttachmentResolveRef.attachment = 2;
        colorAttachmentResolveRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
```

```cpp
        subpass.pResolveAttachments = &colorAttachmentResolveRef;
```

Det räcker för att render passet ska definiera en multisample-resolve som låter oss rendera bilden till skärmen: i
slutet av subpasset tas medelvärdet av varje pixels samples i färgattachment 0 och skrivs till resolve attachment 2.
Render passet får alla tre attachments – `std::array<VkAttachmentDescription, 3> attachments = {colorAttachment,
depthAttachment, colorAttachmentResolve};` – och framebuffrarna får tre vyer i samma ordning:

```cpp
            std::array<VkImageView, 3> attachments = {
                colorImageView,
                depthImageView,
                swapChainImageViews[i]
            };
```

Färgbilden används igen varje bildruta, som djupbilden, så subpass-beroendet väntar nu också på förra bildrutans
färgskrivningar:

```cpp
        dependency.srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT | VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT; // the colour image is reused every frame too
```

Till sist säger vi åt pipelinen att rastrera med så många samples – det måste stämma med render passets attachments:

```cpp
        multisampling.rasterizationSamples = msaaSamples; // must match the render pass's attachments
```

Bygg och kör: kubens kanter är mjuka nu. Ungefär 800 pixlar längs kanterna är inte längre rent gröna eller ren bakgrund,
utan blandningar med en fjärdedel, hälften och tre fjärdedelar grönt. (Vilken kantpixel som får vilken blandning beror
på samplepositionerna: Vulkans standardmönster för 4 samples är OpenGL:s speglat i y, så enstaka kantpixlar kan skilja
sig från OpenGL-bilden.)
:::
:::d3d12
I OpenGL börjar MSAA med en fönsterhint: GLFW ber fönstersystemet om en multisamplad standard-framebuffer
(`glfwWindowHint(GLFW_SAMPLES, 4)`), och drivrutinen resolvar den när bilden visas. Direct3D 12 har inget
multisamplat fönster: vår swap chain använder flip-modellen (`DXGI_SWAP_EFFECT_FLIP_DISCARD`), och en swap chain med
flip-modellen måste ha `SampleDesc.Count = 1`. Därför ritas scenen i ett eget **multisamplat render target** – en
textur med 4 samples per pixel och en egen render target view – med en djupbuffer med lika många samples och en
pipeline state för 4 samples, och **resolvas** sedan in i back buffern med `ResolveSubresource`: varje pixel får
medelvärdet av sina samples. Det är OpenGL:s nästa avsnitt, *off-screen MSAA*, och det är mönstret i Microsofts egna
MSAA-exempel. I Direct3D 12 blir learnopengls två steg alltså ett.

Gör nu den första uppgiften, **msaa**. Lägg till antalet samples bredvid `FrameCount`, och en medlem för render
targetet:

```cpp
    // Multisample anti-aliasing (MSAA): 4 samples per pixel.
    static const UINT SampleCount = 4;
```

```cpp
    ComPtr<ID3D12Resource> m_msaaRenderTarget;    // the multisampled render target: the scene is drawn into it
```

Render targetet behöver en render target view, efter swap chainens i RTV-heapen:

```cpp
        rtvHeapDesc.NumDescriptors = FrameCount + 1;    // the swap chain's buffers + the multisampled render target
```

Skapa det vid TODO:n i `LoadAssets`. Kontrollera först att devicen kan rita 4 samples per pixel i vårt format (varje
GPU av Direct3D 11-klass kan det: från feature level 11_0 krävs 4x för det), med `CheckFeatureSupport`:

```cpp
        D3D12_FEATURE_DATA_MULTISAMPLE_QUALITY_LEVELS qualityLevels = {};
        qualityLevels.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
        qualityLevels.SampleCount = SampleCount;
        qualityLevels.Flags = D3D12_MULTISAMPLE_QUALITY_LEVELS_FLAG_NONE;
        ThrowIfFailed(m_device->CheckFeatureSupport(D3D12_FEATURE_MULTISAMPLE_QUALITY_LEVELS, &qualityLevels, sizeof(qualityLevels)));
        if (qualityLevels.NumQualityLevels == 0)
        {
            throw std::runtime_error("4x MSAA is not supported for DXGI_FORMAT_R8G8B8A8_UNORM");
        }
```

`NumQualityLevels` är antalet kvalitetsnivåer devicen erbjuder för det här formatet och antalet samples; 0 betyder att
antalet inte stöds. Kvalitetsnivån är andra halvan av en `DXGI_SAMPLE_DESC` – tillverkarspecifika mönster; nivå 0 är
alltid standardnivån, och det är den vi använder. Sedan själva texturen – lika stor som fönstret, en mipnivå,
`SampleCount` samples med kvalitet 0, tillåten att vara render target:

```cpp
        // The colour it is usually cleared to (clearing to this colour is fastest).
        const float optimizedClearColor[] = { 0.1f, 0.1f, 0.1f, 1.0f };
        CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R8G8B8A8_UNORM, optimizedClearColor);

        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC msaaDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, m_width, m_height, 1, 1, SampleCount, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &msaaDesc,
            D3D12_RESOURCE_STATE_RENDER_TARGET,
            &clearValue,
            IID_PPV_ARGS(&m_msaaRenderTarget)));

        CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
        m_device->CreateRenderTargetView(m_msaaRenderTarget.Get(), nullptr, rtvHandle);
```

Utan vybeskrivning passar vyn resursen: en multisamplad vy av typen `D3D12_RTV_DIMENSION_TEXTURE2DMS`.

Allt som är bundet samtidigt vid ritning måste ha samma antal samples. Djupbuffern får `SampleCount` samples i sin
`Tex2D(DXGI_FORMAT_D32_FLOAT, m_width, m_height, 1, 1, SampleCount, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL)` och en
multisamplad vy:

```cpp
        depthStencilDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2DMS;    // a multisampled depth buffer
```

och pipeline staten görs för 4 samples:

```cpp
        psoDesc.SampleDesc.Count = SampleCount;    // the render target's samples per pixel: coverage and depth are tested at each of them
```

I `PopulateCommandList` ritas scenen inte längre i back buffern. Dess barrier `PRESENT` → `RENDER_TARGET` och dess
RTV-handtag försvinner; det multisamplade targetet (RTV-plats `FrameCount`) tar deras plats:

```cpp
    // 1. draw scene as normal in the multisampled render target (RTV slot FrameCount)
    // with the multisampled depth buffer
    CD3DX12_CPU_DESCRIPTOR_HANDLE msaaRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &msaaRtvHandle, FALSE, &dsvHandle);

    // Record commands.
    const float clearColor[] = { 0.1f, 0.1f, 0.1f, 1.0f };
    m_commandList->ClearRenderTargetView(msaaRtvHandle, clearColor, 0, nullptr);
```

Efter kubens ritning resolvas det multisamplade targetet in i back buffern. `ResolveSubresource` kräver att källan är i
tillståndet `RESOLVE_SOURCE` och målet i `RESOLVE_DEST`, så barriers kommer först, och efteråt går båda tillbaka –
targetet för att ritas i nästa bildruta, back buffern för att presenteras:

```cpp
    CD3DX12_RESOURCE_BARRIER barriers[2] =
    {
        CD3DX12_RESOURCE_BARRIER::Transition(m_msaaRenderTarget.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_RESOLVE_SOURCE),
        CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RESOLVE_DEST)
    };
    m_commandList->ResourceBarrier(_countof(barriers), barriers);
    m_commandList->ResolveSubresource(m_renderTargets[m_frameIndex].Get(), 0, m_msaaRenderTarget.Get(), 0, DXGI_FORMAT_R8G8B8A8_UNORM);

    // And back: the render target for the next frame, the back buffer to be presented.
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(m_msaaRenderTarget.Get(), D3D12_RESOURCE_STATE_RESOLVE_SOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    barriers[1] = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_RESOLVE_DEST, D3D12_RESOURCE_STATE_PRESENT);
    m_commandList->ResourceBarrier(_countof(barriers), barriers);
```

Parametrarna är målet och dess subresurs, källan och dess subresurs, och formatet att resolva i – här har båda
resurserna `DXGI_FORMAT_R8G8B8A8_UNORM`, som swap chainen.

Bygg och kör: kubens kanter är mjuka nu. Ungefär 800 pixlar längs kanterna är inte längre rent gröna eller ren bakgrund,
utan blandningar med en fjärdedel, hälften och tre fjärdedelar grönt.
:::

```quiz
Varför måste djupbuffern också vara multisamplad, med lika många samples som färgbuffern?
- [x] Djuptestet görs per sample: varje subsample behåller sitt eget djup, så överlappande trianglar sorteras rätt inom en pixel
- [ ] Eftersom resolven också tar medelvärdet av djupvärdena
- [ ] Det måste den inte; vilken djupbuffer som helst fungerar med en multisamplad färgbuffer
- [ ] För att fragment shadern ska köras en gång per sample
---
Täckning och djup utvärderas i varje subsample, och ett samples färg skrivs bara om det klarar sitt eget djuptest. Det kräver ett djupvärde per sample – och alla attachments i en ritning måste ha samma antal samples.
```

:::opengl
## Off-screen MSAA

Eftersom GLFW skapar de multisamplade buffrarna är det ganska enkelt att slå på MSAA. Vill vi använda egna
framebuffers måste vi däremot skapa de multisamplade buffrarna själva; nu *måste* vi ta hand om att skapa dem.

Det finns två sätt att skapa multisamplade buffrar som attachments till framebuffers: texturattachments och
renderbuffer-attachments. Ungefär som de vanliga attachments vi gick igenom i kapitlet *Framebuffers*.

### Multisamplade texturattachments

För att skapa en textur som kan lagra flera samplingspunkter använder vi `glTexImage2DMultisample` i stället för
`glTexImage2D`, med `GL_TEXTURE_2D_MULTISAMPLE` som texturmål. Det andra argumentet anger hur många samples texturen
ska ha. Är det sista argumentet `GL_TRUE` använder bilden samma samplepositioner och samma antal subsamples för varje
texel.

För att fästa en multisamplad textur vid en framebuffer använder vi `glFramebufferTexture2D`, men den här gången med
`GL_TEXTURE_2D_MULTISAMPLE` som texturtyp. Den bundna framebuffern har nu en multisamplad färgbuffer i form av en
texturbild.

### Multisamplade renderbuffer objects

Precis som texturer är det inte svårt att skapa ett multisamplat renderbuffer object. Det är till och med ganska
enkelt, eftersom allt vi behöver ändra är `glRenderbufferStorage` till `glRenderbufferStorageMultisample` när vi
konfigurerar den (bundna) renderbufferns minne. Det enda nya är den extra andra parametern, där vi anger hur många
samples vi vill använda; 4 i det här fallet.

Gör nu uppgiften **offscreen-msaa**. Ta bort hinten `GLFW_SAMPLES` – fönstret behöver inte längre några samples; vi
multisamplar själva (`glEnable(GL_MULTISAMPLE)` blir kvar). Vid TODO:n skapar du den multisamplade framebuffern:

```cpp
    // configure MSAA framebuffer
    // --------------------------
    unsigned int framebuffer;
    glGenFramebuffers(1, &framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
    // create a multisampled color attachment texture
    unsigned int textureColorBufferMultiSampled;
    glGenTextures(1, &textureColorBufferMultiSampled);
    glBindTexture(GL_TEXTURE_2D_MULTISAMPLE, textureColorBufferMultiSampled);
    glTexImage2DMultisample(GL_TEXTURE_2D_MULTISAMPLE, 4, GL_RGB, SCR_WIDTH, SCR_HEIGHT, GL_TRUE);
    glBindTexture(GL_TEXTURE_2D_MULTISAMPLE, 0);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D_MULTISAMPLE, textureColorBufferMultiSampled, 0);
    // create a (also multisampled) renderbuffer object for depth and stencil attachments
    unsigned int rbo;
    glGenRenderbuffers(1, &rbo);
    glBindRenderbuffer(GL_RENDERBUFFER, rbo);
    glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_DEPTH24_STENCIL8, SCR_WIDTH, SCR_HEIGHT);
    glBindRenderbuffer(GL_RENDERBUFFER, 0);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, rbo);

    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Alla attachments i en framebuffer måste ha lika många samples, annars är framebuffern inte komplett.

### Rendera till en multisamplad framebuffer

Att rendera till en multisamplad framebuffer är okomplicerat. När vi ritar något medan framebuffer-objektet är bundet
tar rastreraren hand om alla multisample-operationer. Men eftersom en multisamplad buffer är lite speciell kan vi inte
använda den direkt till annat, som att sampla den i en shader.

En multisamplad bild innehåller mycket mer information än en vanlig bild, så vi måste skala ned, *resolva*, bilden.
Att resolva en multisamplad framebuffer görs i allmänhet med `glBlitFramebuffer`, som kopierar ett område från en
framebuffer till en annan och samtidigt resolvar alla multisamplade buffrar.

`glBlitFramebuffer` för över ett källområde, angivet med 4 koordinater i skärmrummet, till ett målområde, också angivet
med 4 koordinater. Du minns kanske från kapitlet *Framebuffers* att när vi binder till `GL_FRAMEBUFFER` binder vi till
både läs- och rit-framebuffer-målen. Vi kan också binda till dem var för sig med `GL_READ_FRAMEBUFFER` respektive
`GL_DRAW_FRAMEBUFFER`. Funktionen `glBlitFramebuffer` läser de två målen för att avgöra vilken framebuffer som är källa
och vilken som är mål. Vi kan alltså föra över den multisamplade framebufferns resultat till skärmen genom att *blitta*
bilden till standard-framebuffern.

I renderloopen, efter fönstrets rensning, ritar du scenen i den multisamplade framebuffern:

```cpp
        // 1. draw scene as normal in multisampled buffers
        glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glEnable(GL_DEPTH_TEST);
```

och efter kubens ritning blittar du den till fönstret:

```cpp
        // 2. now blit the multisampled buffer to the window's framebuffer: this resolves the samples (their average)
        glBindFramebuffer(GL_READ_FRAMEBUFFER, framebuffer);
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0);
        glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_COLOR_BUFFER_BIT, GL_NEAREST);
```

Ta bort `textureColorBufferMultiSampled`, `rbo` och `framebuffer` i slutet. (En blit till ett multisamplat fönster
skulle kräva samma antal samples och format på båda sidor – ett skäl till att fönstret inte längre ber om samples.)

Bygg och kör: samma mjuka kanter som i uppgiften `msaa` – men nu sker multisamplingen i vår egen framebuffer, oberoende
av vad fönstersystemet erbjuder.
:::
:::vulkan
## Off-screen MSAA

Vår multisamplade bild ligger redan i en egen bild: scenen ritas i `colorImage`, och render passet resolvar den in i
swap chainens bild. learnopengls avsnitt *off-screen MSAA* – en multisamplad framebuffer vars bild resolvas med
`glBlitFramebuffer` – är vad uppgiften **msaa** redan gjorde. (Vulkans motsvarighet till blitten är
`vkCmdResolveImage`, ett kommando som resolvar en bild in i en annan utanför ett render pass; resolve attachmentet gör
samma sak i slutet av subpasset, oftast effektivare.)

Men tänk om vi vill använda resultatet av en multisamplad framebuffer till saker som post-processing? Vi kan inte
använda den multisamplade bilden direkt i fragment shadern som en vanlig textur. Det vi däremot kan göra är att
resolva den in i en egen bild med ett sample, och sampla *den* – precis uppsättningen utanför skärmen från kapitlet
*Framebuffers*, med en resolve på vägen.
:::
:::d3d12
## Off-screen MSAA

Vår multisamplade bild ligger redan i en egen textur: scenen ritas i `m_msaaRenderTarget`, och `ResolveSubresource`
resolvar den in i back buffern. learnopengls avsnitt *off-screen MSAA* – en multisamplad framebuffer vars bild resolvas
med `glBlitFramebuffer` – är vad uppgiften **msaa** redan gjorde.

Men tänk om vi vill använda resultatet av en multisamplad framebuffer till saker som post-processing? Vi kan inte
använda den multisamplade texturen direkt i pixel shadern som en vanlig textur. Det vi däremot kan göra är att resolva
den in i en egen textur med ett sample, och sampla *den* – precis uppsättningen utanför skärmen från kapitlet
*Framebuffers*, med en resolve på vägen.
:::

:::opengl
Men tänk om vi vill använda texturresultatet från en multisamplad framebuffer till saker som post-processing? Vi kan
inte använda de multisamplade texturerna direkt i fragment shadern. Det vi däremot kan göra är att blitta de
multisamplade buffrarna till en annan FBO med ett texturattachment utan multisampling. Den vanliga färgtexturen
använder vi sedan till post-processing, och post-processar alltså i praktiken en bild som renderats med multisampling.
Det betyder att vi måste skapa en ny FBO som bara fungerar som mellanliggande framebuffer-objekt att resolva den
multisamplade buffern in i; en vanlig 2D-textur som vi kan använda i fragment shadern.
:::

```quiz
Varför kan skärmfyrhörningens shader inte bara sampla den multisamplade bilden som den samplar en vanlig textur?
- [ ] En multisamplad bild lagras upp och ned
- [ ] Multisamplade bilder kan bara läsas på CPU:n
- [ ] En shader kan bara läsa texturer som laddats från en fil
- [x] En multisamplad bild har flera samples per pixel; vanlig filtrerad sampling är inte definierad för den, så den resolvas först till en bild med ett sample
---
Filtrering, mipmaps och normaliserade texturkoordinater förutsätter alla ett värde per texel. En shader kan läsa enstaka samples i en multisamplad bild (sista avsnittet visar hur), men för en vanlig texturuppslagning måste samples först resolvas.
```

:::opengl
Gör nu uppgiften **resolve**. Skärmfyrhörningen är den från kapitlet *Framebuffers*: learnopengls `quadVertices` (6
vertices, en position i NDC och texturkoordinater var) i `quadVAO` / `quadVBO`, med attribut 0 (2 floats) och 1 (2
floats) och en stride på 4 floats, ritad med `Shader screenShader("aa_post.vs", "aa_post.fs");`. Efter
MSAA-framebuffern skapar du den mellanliggande:

```cpp
    // configure second post-processing framebuffer
    unsigned int intermediateFBO;
    glGenFramebuffers(1, &intermediateFBO);
    glBindFramebuffer(GL_FRAMEBUFFER, intermediateFBO);
    // create a color attachment texture
    unsigned int screenTexture;
    glGenTextures(1, &screenTexture);
    glBindTexture(GL_TEXTURE_2D, screenTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, screenTexture, 0); // we only need a color buffer

    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Intermediate framebuffer is not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

och sätter `screenShader.setInt("screenTexture", 0);` en gång. I renderloopen går blitten nu till den mellanliggande
framebuffern, och ett tredje steg ritar fyrhörningen med dess textur i fönstret:

```cpp
        // 2. now blit multisampled buffer(s) to normal colorbuffer of intermediate FBO. Image is stored in screenTexture
        glBindFramebuffer(GL_READ_FRAMEBUFFER, framebuffer);
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, intermediateFBO);
        glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_COLOR_BUFFER_BIT, GL_NEAREST);

        // 3. now render quad with scene's visuals as its texture image
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glClearColor(1.0f, 1.0f, 1.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        glDisable(GL_DEPTH_TEST);

        // draw Screen quad
        screenShader.use();
        glBindVertexArray(quadVAO);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, screenTexture); // use the now resolved color attachment as the quad's texture
        glDrawArrays(GL_TRIANGLES, 0, 6);
```

Ta också bort `quadVAO`, `quadVBO`, `screenTexture` och `intermediateFBO` i slutet.
:::
:::vulkan
Gör nu uppgiften **resolve**. Den delar upp bildrutan i två render pass, som i kapitlet *Framebuffers*: scenen i egna
bilder, sedan en skärmfyrhörning i swap chainens bild.

Förra uppgiftens multisamplade render pass blir `createOffscreenRenderPass()` (som skapar `offscreenRenderPass`). Dess
resolve attachment är inte längre swap chainens bild utan `offscreenImage`, en egen bild, och den slutar redo att läsas
av en shader:

```cpp
        colorAttachmentResolve.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

Den får två subpass-beroenden, som kapitlet *Framebuffers* passet utanför skärmen fick: före passet väntar vi tills
förra bildrutans skärmfyrhörning har läst `offscreenImage`; efter det väntar skärmfyrhörningens fragment shader tills
resolven har skrivit den:

```cpp
        // after the pass: the fragment shaders that sample offscreenImage wait until the resolve has written it
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
```

(`dependencies[0]` väntar på `VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT | VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT |
VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT` före färg- och djupskrivningarna.) `createRenderPass()` blir fönstrets pass:
ett attachment, swap chainens bild, med ett sample, rensat, som slutar i `VK_IMAGE_LAYOUT_PRESENT_SRC_KHR` –
skärmfyrhörningen behöver varken djup eller multisampling. Swap chainens framebuffers går tillbaka till en vy,
`{swapChainImageViews[i]}`.

`createOffscreenFramebuffer()` skapar `offscreenImage` – ett sample, swap chainens format, användning
`VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT` – med sin vy, och `offscreenFramebuffer` med passets
tre vyer:

```cpp
        std::array<VkImageView, 3> attachments = {
            colorImageView,
            depthImageView,
            offscreenImageView
        };
```

För att sampla den resolvade bilden behöver fyrhörningen en sampler (`createTextureSampler()`: linjär filtrering,
clamp to edge) och en descriptor: descriptor set-layouten får en `samplerLayoutBinding` (binding 1,
`VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`, fragmentsteget), poolen rymmer två set av layouten (2 uniform buffers, 2
samplers, `maxSets = 2`), och `createScreenDescriptorSet()` allokerar `screenDescriptorSet` och skriver
`offscreenImageView` med `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` till binding 1.

De två pipelinerna skiljer sig nu i render pass, antal samples och djuptest, så `createPipeline()` får dem som
parametrar (`multisampling.rasterizationSamples = rasterizationSamples`, `depthStencil.depthTestEnable` och
`depthWriteEnable = depthTestEnable`, `pipelineInfo.renderPass = pipelineRenderPass`):

```cpp
        createPipeline("shaders/anti_aliasing.vert.spv", "shaders/anti_aliasing.frag.spv", 1, offscreenRenderPass, msaaSamples, VK_TRUE, graphicsPipeline);
        createPipeline("shaders/aa_post.vert.spv", "shaders/aa_post.frag.spv", 2, renderPass, VK_SAMPLE_COUNT_1_BIT, VK_FALSE, screenPipeline);
```

Skärmfyrhörningen är learnopengls `quadVertices`, tillagda sist i `vertices` som vertices 36 till 41 (med z = 0). Dess
texturkoordinater är learnopengls oförändrade: i Vulkan pekar både fönstrets y och en bilds v nedåt, så de två
vändningarna tar ut varandra och bilden visas rättvänd.

I `recordCommandBuffer()` ritas kuben i passet utanför skärmen, och fyrhörningen i fönstrets pass:

```cpp
        // 1. draw scene as normal in the multisampled image; at the end of the pass it is resolved into offscreenImage
        VkRenderPassBeginInfo offscreenPassInfo{};
        offscreenPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        offscreenPassInfo.renderPass = offscreenRenderPass;
        offscreenPassInfo.framebuffer = offscreenFramebuffer;
```

(med rensningsvärdena 0.1 för färgen och 1.0 för djupet – resolve attachmentet rensas inte), sedan kubens ritning och
`vkCmdEndRenderPass`, och:

```cpp
        // 2. the window: a screen-filling quad with the resolved picture as its texture
        VkRenderPassBeginInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        renderPassInfo.renderPass = renderPass;
        renderPassInfo.framebuffer = swapChainFramebuffers[imageIndex];
        renderPassInfo.renderArea.offset = {0, 0};
        renderPassInfo.renderArea.extent = swapChainExtent;

        // white (not really necessary, the quad covers the whole window)
        VkClearValue clearColor = {{{1.0f, 1.0f, 1.0f, 1.0f}}};
        renderPassInfo.clearValueCount = 1;
        renderPassInfo.pClearValues = &clearColor;

        vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        // (the viewport, scissor and vertex buffer set above still apply)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, screenPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &screenDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // the screen quad's 6 vertices start at vertex 36

        vkCmdEndRenderPass(commandBuffer);
```

Förstör allt nytt i `cleanup()`: `offscreenRenderPass`, `screenPipeline`, bilden utanför skärmen med sitt minne, sin
vy och sin framebuffer, och samplern.
:::
:::d3d12
Gör nu uppgiften **resolve**. Det multisamplade render targetet resolvas nu in i en vanlig textur,
`ComPtr<ID3D12Resource> m_screenTexture;`, som en skärmfyllande fyrhörning visar i back buffern – uppsättningen
utanför skärmen från kapitlet *Framebuffers*. Texturen har ett sample per pixel och en shader resource view på plats 1
i CBV/SRV-heapen (`cbvSrvHeapDesc.NumDescriptors = 2;`); den börjar i det tillstånd som pixel shadern läser den i:

```cpp
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, m_width, m_height, 1, 1);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
            nullptr,
            IID_PPV_ARGS(&m_screenTexture)));
```

följt av `CreateShaderResourceView(m_screenTexture.Get(), &srvDesc, srvHandle)` med en `TEXTURE2D`-vy på heap-plats 1.
Root signaturen får en tredje parameter, en descriptor-tabell med en SRV på t0 för pixel shadern
(`ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0)`,
`rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL)`), och en statisk sampler s0
med linjär filtrering.

Skärmfyrhörningen har en egen vertexbuffer (`m_quadVertexBuffer`, `m_quadVertexBufferView`) med learnopengls
`quadVertices` – `struct QuadVertex { XMFLOAT2 position; XMFLOAT2 texCoord; }` – men med v vänt, eftersom Direct3D:s
v = 0 är texturens översta rad. Och den har en egen pipeline state, `m_screenPipelineState`, gjord av samma beskrivning
med `aa_post.hlsl`s shaders och fyrhörningens input layout (`POSITION` och `TEXCOORD`, 2 floats var, på offset 0 och 8)
– och tre ändringar, eftersom fyrhörningen ritas i back buffern:

```cpp
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        psoDesc.SampleDesc.Count = 1;
```

Ingen djupbuffer och inget djuptest (learnopengl: `glDisable(GL_DEPTH_TEST)`), och ett sample: back buffern har ett.

I `PopulateCommandList` går resolven till skärmtexturen i stället för back buffern. Dess tillstånd är nu
`PIXEL_SHADER_RESOURCE` → `RESOLVE_DEST` och tillbaka:

```cpp
    CD3DX12_RESOURCE_BARRIER barriers[2] =
    {
        CD3DX12_RESOURCE_BARRIER::Transition(m_msaaRenderTarget.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_RESOLVE_SOURCE),
        CD3DX12_RESOURCE_BARRIER::Transition(m_screenTexture.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RESOLVE_DEST)
    };
    m_commandList->ResourceBarrier(_countof(barriers), barriers);
    m_commandList->ResolveSubresource(m_screenTexture.Get(), 0, m_msaaRenderTarget.Get(), 0, DXGI_FORMAT_R8G8B8A8_UNORM);
```

(och de två omvända övergångarna efteråt). Sedan blir back buffern render target igen, utan djupbuffern, och
fyrhörningen ritas med skärmtexturen:

```cpp
    // 3. now render quad with scene's visuals as its texture image, into the back buffer
    // (no depth buffer)
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
    const float screenClearColor[] = { 1.0f, 1.0f, 1.0f, 1.0f };
    m_commandList->ClearRenderTargetView(rtvHandle, screenClearColor, 0, nullptr);

    // draw Screen quad: root parameter 2 points at the screen texture's SRV (heap slot 1)
    m_commandList->SetPipelineState(m_screenPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE screenTexture(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, screenTexture);
    m_commandList->IASetVertexBuffers(0, 1, &m_quadVertexBufferView);
    m_commandList->DrawInstanced(6, 1, 0, 0);
```

och sist back bufferns barrier `RENDER_TARGET` → `PRESENT`.
:::

Bygg och kör: ingenting ändras – samma mjuka kub, pixel för pixel. Den vita rensningen täcks helt av fyrhörningen. Men
nu ligger den kantutjämnade bilden i en textur som en shader läser, så vi kan ändra den.

:::opengl
```quiz
Vad gör `glBlitFramebuffer` i uppgiften **offscreen-msaa** med samples när den blittar från den multisamplade framebuffern till fönstrets framebuffer?
- [ ] Den kopierar det första samplet i varje pixel
- [x] Den resolvar dem: varje pixel i målet får medelvärdet av källpixelns samples
- [ ] Den kopierar alla samples, så fönstret blir multisamplat
- [ ] Ingenting: en blit kan inte läsa en multisamplad framebuffer
---
En blit från en multisamplad läs-framebuffer till en rit-framebuffer med ett sample resolvar samples. Därför både kopierar blitten bilden och jämnar ut dess kanter – till fönstret, eller till den mellanliggande framebufferns textur.
```
:::
:::vulkan
```quiz
Varför slutar det multisamplade färgattachmentet i uppgiften **msaa** i `VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL` i stället för `VK_IMAGE_LAYOUT_PRESENT_SRC_KHR`?
- [ ] Present-layouter är bara tillåtna för djupattachments
- [ ] Den multisamplade bilden kopieras till swap chainen med `vkCmdCopyImage` efteråt
- [ ] För att nästa bildruta ska kunna hoppa över sin rensning
- [x] En multisamplad bild kan inte presenteras: resolve attachmentet – swap chainens bild med ett sample – är det som presenteras
---
Subpasset resolvar den multisamplade bilden in i resolve attachmentet i sitt slut. Bara den bilden med ett sample går till skärmen, så bara den slutar i present-layouten; den multisamplade bilden förblir bara ett färgattachment till nästa bildruta.
```
:::
:::d3d12
```quiz
Varför skapar Direct3D 12-projektet inte bara en swap chain med 4 samples per pixel?
- [ ] Swap chains kan bara ha 2 samples
- [ ] Multisamplade back buffers kan inte rensas
- [x] En swap chain med flip-modellen (`DXGI_SWAP_EFFECT_FLIP_DISCARD`) måste ha `SampleDesc.Count = 1`; MSAA kräver ett multisamplat render target som resolvas in i back buffern
- [ ] `ResolveSubresource` skulle då resolva bilden två gånger
---
DXGI:s swap chains med flip-modellen stöder inte multisampling. Scenen hamnar i en textur med 4 samples, och `ResolveSubresource` tar medelvärdet av dem in i back buffern med ett sample (eller, från uppgiften **resolve**, in i en textur).
```
:::

## Post-processing av den resolvade bilden

Med den kantutjämnade bilden i en textur kan vi post-processa den som i kapitlet *Framebuffers* – och kanterna förblir
mjuka, eftersom effekten arbetar på den redan resolvade bilden. Vi visar den i grått, med learnopengls viktade
gråskala: människans öga är mest känsligt för grönt och minst för blått.

:::opengl
Gör nu den sista uppgiften, **post-process**. I `aa_post.fs`:

```glsl
    float grayscale = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b; // weighted: the eye is most sensitive to green
    FragColor = vec4(vec3(grayscale), 1.0);
```
:::
:::vulkan
Gör nu den sista uppgiften, **post-process**. I `shaders/aa_post.frag`:

```glsl
    float grayscale = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
    outColor = vec4(vec3(grayscale), 1.0);
```
:::
:::d3d12
Gör nu den sista uppgiften, **post-process**. I `aa_post.hlsl`:

```hlsl
    float grayscale = 0.2126f * col.r + 0.7152f * col.g + 0.0722f * col.b;    // weighted: the eye is most sensitive to green
    return float4(grayscale, grayscale, grayscale, 1.0f);
```
:::

Bygg och kör: kuben blir grå (0.7152 × 255 ≈ 182), bakgrunden behåller sitt mörkgrå, och kanterna är fortfarande mjuka,
nu i gråtoner.

```quiz
Gråskaleeffekten körs på skärmfyrhörningen, efter resolven. Varför är kubens kanter fortfarande mjuka?
- [ ] Gråskaleshadern körs en gång per sample
- [x] Den resolvade bildens kantpixlar innehåller redan medelvärdesblandningarna; effekten gör om varje blandning till motsvarande grått
- [ ] Skärmfyrhörningen ritas också med multisampling
- [ ] Texturens linjära filter suddar ut kanterna
---
Kantutjämningen skedde före effekten: den resolvade texturen har mjuka kantfärger, och post-processing-shadern avbildar bara varje pixel på sitt gråvärde. Hade vi post-processat per sample och resolvat efteråt – vilket sista avsnittet handlar om – skulle vissa effekter ge andra resultat.
```

Tänk dock på en sak: om post-processing-shadern själv skapar hårda kanter (till exempel en kerneleffekt för
kantdetektering) ritas de i bilden med ett sample efter resolven – de får ingen kantutjämning. Det kan du lösa genom
att lägga ett separat anti-aliasing-steg på den post-processade bilden, som många spel gör.

## En egen anti-aliasing-algoritm

Det går att skicka en multisamplad texturbild direkt till en shader i stället för att först resolva den.
Shaderspråken låter oss hämta texturvärdena per subsample, så att vi kan skriva våra egna anti-aliasing-algoritmer.

:::opengl
För att få ett texturvärde per subsample måste du deklarera texturens uniform-sampler som en `sampler2DMS` i stället
för den vanliga `sampler2D`:

```glsl
uniform sampler2DMS screenTextureMS;
```

Med funktionen `texelFetch` kan du sedan hämta färgvärdet per sample:

```glsl
vec4 colorSample = texelFetch(screenTextureMS, TexCoords, 3);  // 4th subsample
```

Här är `TexCoords` heltaliga pixelkoordinater (en `ivec2`), inte normaliserade texturkoordinater, och det sista
argumentet är samplets index. Vi går inte in på detaljerna i att skapa egna anti-aliasing-tekniker här, men det här kan
räcka för att komma igång med att bygga en själv.
:::
:::vulkan
Vulkans GLSL har samma verktyg som OpenGL:s: bilden deklareras som en `sampler2DMS` i stället för en `sampler2D`, och
`texelFetch` läser ett sample på heltaliga pixelkoordinater:

```glsl
layout(binding = 1) uniform sampler2DMS screenTextureMS;
```

```glsl
vec4 colorSample = texelFetch(screenTextureMS, ivec2(gl_FragCoord.xy), 3);  // 4th subsample
```

För det behöver den multisamplade bilden `VK_IMAGE_USAGE_SAMPLED_BIT` (och inte `TRANSIENT`), måste sparas i slutet av
render passet och övergå till `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`. vulkan-tutorials kapitel slutar med en
besläktad, inbyggd förbättring: *sample shading* (device-funktionen `sampleRateShading`, sedan
`multisampling.sampleShadingEnable = VK_TRUE` och en `minSampleShading`), som kör fragment shadern för flera samples per
pixel – och jämnar ut aliasing även *inuti* trianglar, till exempel i högkontrastiga texturer, till en kostnad i
prestanda. Vi går inte in på detaljerna i att skapa egna anti-aliasing-tekniker här, men det här kan räcka för att
komma igång med att bygga en själv.
:::
:::d3d12
I HLSL deklareras en multisamplad textur som en `Texture2DMS` i stället för en `Texture2D`, och dess metod `Load` läser
ett sample på heltaliga pixelkoordinater:

```hlsl
Texture2DMS<float4> screenTextureMS : register(t0);
```

```hlsl
float4 colorSample = screenTextureMS.Load(int2(input.position.xy), 3);  // 4th subsample
```

För det behöver den multisamplade texturen en shader resource view med `D3D12_SRV_DIMENSION_TEXTURE2DMS` och måste vara
i tillståndet `PIXEL_SHADER_RESOURCE` medan den läses. Vi går inte in på detaljerna i att skapa egna
anti-aliasing-tekniker här, men det här kan räcka för att komma igång med att bygga en själv.
:::

Det här var sista kapitlet i *Avancerad OpenGL*. Genom dess kapitel har du sett djup- och stencilbuffrarna, blending,
face culling, framebuffers, cube maps, detaljerna i buffrar och shaders, geometry shaders, instancing och nu
anti-aliasing – vart och ett för {{api}}. Delens sammanfattning och prov kommer härnäst.

## Mer att läsa

:::opengl
- [Multisampling](https://www.khronos.org/opengl/wiki/Multisampling): OpenGL-wikin om multisamplade framebuffers och
  texturer.
- [glBlitFramebuffer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlitFramebuffer.xhtml) och
  [glTexImage2DMultisample](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2DMultisample.xhtml):
  referenssidorna.
- [Window hints](https://www.glfw.org/docs/latest/window_guide.html#window_hints_fb): GLFW:s framebuffer-hintar,
  bland annat `GLFW_SAMPLES`.
:::
:::vulkan
- [Multisampling](https://vulkan-tutorial.com/Multisampling): vulkan-tutorials kapitel som det här kapitlet följer,
  inklusive sample shading.
- [Rasterization](https://docs.vulkan.org/spec/latest/chapters/primsrast.html): kapitlet i Vulkans specifikation om
  rastrering, täckning och standardpositionerna för samples.
:::
:::d3d12
- [ID3D12GraphicsCommandList::ResolveSubresource](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-resolvesubresource):
  parametrarna och de resurstillstånd som krävs.
- [DXGI flip model](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/dxgi-flip-model): varför en swap chain
  med flip-modellen har ett sample per pixel.
- [Multisampling in UWP apps](https://learn.microsoft.com/en-us/windows/uwp/gaming/multisampling--multi-sample-anti-aliasing--in-windows-store-apps):
  mönstret med multisamplat render target och resolve (skrivet för Direct3D 11; stegen är desamma).
:::
