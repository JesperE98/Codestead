# Framebuffers

Hittills har vi använt flera sorters skärmbuffrar: en färgbuffer för att skriva färgvärden, en djupbuffer för att
skriva och testa djupinformation, och en stencilbuffer som låter oss kasta vissa fragment utifrån ett villkor.
Kombinationen av de här buffrarna ligger någonstans i GPU-minnet och kallas en *framebuffer*. Fram till nu har varje
bild gått rakt in i fönstrets framebuffer – den vars färgbuffer visas på skärmen. I det här kapitlet skapar vi en egen
framebuffer, ritar scenen i den och använder sedan det vi ritade som en textur.

Alla renderingsoperationer vi har gjort hittills har skrivit till de renderbuffrar som hör till fönstrets framebuffer.
Att i stället rita i en egen framebuffer kan verka som en onödig omväg, men det öppnar många dörrar: när scenen väl
ligger i en textur kan en shader läsa varje pixel i den, och dess grannar, och ändra bilden som helhet. Det kallas
*post-processing* (efterbehandling), och det är så spel gör speglar i en scen, gör bilden suddig, färgtonar den eller
kör alla möjliga andra effekter över den. Längre fram använder shadow maps samma teknik: scenen ritas i en
djuptextur från ljusets synvinkel.

:::opengl
OpenGL kallar en sådan framebuffer ett *framebuffer object* (FBO). Fönstrets framebuffer, den som GLFW skapade åt oss
tillsammans med kontexten, är *default framebuffer*, och OpenGL ritar i den så länge vi inte binder någon annan.
:::
:::vulkan
Vulkan har ingen default framebuffer som API:et ritar i på egen hand: du har alltid ritat i en image som du själv har
valt. I vulkan-tutorials kapitel *Framebuffers* slog du in varje swap chain-image (och djup-imagen) i en
`VkFramebuffer` för din render pass, och `recordCommandBuffer()` startar den render passen med framebuffern för den
image som `vkAcquireNextImageKHR` lämnade ut. För Vulkan är learnopengls framebuffer object alltså i princip inget nytt
– det är ytterligare en uppsättning images, en render pass till och en `VkFramebuffer` till, bara att färg-imagen den
här gången inte är en swap chain-image utan en som vi skapar själva, och som en shader läser efteråt.
:::
:::d3d12
Direct3D 12 har inget framebuffer object alls. Det som finns är *render target views* (RTV:er) och *depth stencil
views* (DSV:er): descriptorer som beskriver en resurs som något att rita i. `OMSetRenderTargets` binder upp till åtta
RTV:er och en DSV, och ritanrop skriver sedan i de resurserna – det anropet är det närmaste man kommer att binda en
framebuffer. Hittills har RTV:n alltid pekat på en back buffer i swap chainen. I det här kapitlet skapar vi en egen
textur som kan vara render target, ger den en RTV för att rita i den och en shader resource view (SRV) för att läsa
den, och växlar den mellan de två användningarna med resource barriers (Microsofts dokumentation *Using resource
barriers*).
:::

Som i de andra kapitlen i den här delen är tekniken densamma i alla API:er; texten visar den för {{api}}.

:::opengl
Projektet börjar med scenen från *Depth testing* ritad direkt i fönstret: de två marmorkuberna på (-1, 0, -1) och
(2, 0, 0) och metallgolvet, `glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, kameran på (0, 0, 3) som tittar längs
-z, och shadrarna `framebuffers.vs` / `framebuffers.fs` som läser `texture1`. Två shaderfiler till finns med för den
andra halvan: `framebuffers_screen.vs`, som är färdig, och `framebuffers_screen.fs`, vars `main` fortfarande är en
TODO.
:::
:::vulkan
Projektet börjar med scenen från *Depth testing* ritad direkt i fönstret: de två marmorkuberna på (-1, 0, -1) och
(2, 0, 0) och metallgolvet, kameran på (0, 0, 3) som tittar längs -z, alla vertexar i en enda vertex buffer (kuben är
vertex 0..35, golvet 36..41), ett descriptor set per textur, modellmatrisen i en push constant och view och projection
i uniform buffern. `createPipeline(vert, frag, pipeline)` skapar scenens pipeline från `shaders/framebuffers.vert` /
`.frag`. Två shadrar till finns med för den andra halvan: `shaders/framebuffers_screen.vert`, som är färdig, och
`shaders/framebuffers_screen.frag`, vars `main` fortfarande är en TODO.
:::
:::d3d12
Projektet börjar med scenen från *Depth testing* ritad direkt i fönstret: de två marmorkuberna på (-1, 0, -1) och
(2, 0, 0) och metallgolvet, kameran på (0, 0, 3) som tittar längs -z, ett PSO med djupfunktionen LESS och shadrarna i
`framebuffers.hlsl`. En vertex buffer rymmer kuben (vertex 0–35) och golvet (36–41); RTV-heapen rymmer swap chainens
två buffrar, och CBV/SRV-heapen CBV:n (plats 0), marmorn (plats 1) och metallen (plats 2). En andra shaderfil,
`framebuffers_screen.hlsl`, finns med för den andra halvan: dess `VSMain` är färdig, dess `PSMain` returnerar
fortfarande svart.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift trycker du på **Build & run**
(Ctrl+Enter) för att kompilera programmet och köra det i den inbyggda simulatorn.

## Skapa en framebuffer

:::opengl
Precis som alla andra objekt i OpenGL kan vi skapa ett framebuffer object med en funktion som heter
`glGenFramebuffers`:

```cpp
    unsigned int framebuffer;
    glGenFramebuffers(1, &framebuffer);
```

Det här mönstret för att skapa och använda objekt har vi sett dussintals gånger nu, så funktionerna liknar dem för alla
andra objekt vi har sett: först skapar vi ett framebuffer object, binder det som aktiv framebuffer, gör några
operationer och avbinder framebuffern. För att binda framebuffern använder vi `glBindFramebuffer`:

```cpp
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
```

Genom att binda till målet `GL_FRAMEBUFFER` påverkar alla följande *läs*- och *skriv*operationer på framebuffers den
framebuffer som är bunden. Det går också att binda en framebuffer enbart för läsning eller skrivning genom att binda
till `GL_READ_FRAMEBUFFER` respektive `GL_DRAW_FRAMEBUFFER`. Framebuffern som är bunden till `GL_READ_FRAMEBUFFER`
används då för alla läsoperationer som `glReadPixels`, och framebuffern som är bunden till `GL_DRAW_FRAMEBUFFER` är
målet för rendering, rensning och andra skrivoperationer. Oftast behöver du inte göra den skillnaden, och du binder
i allmänhet till båda med `GL_FRAMEBUFFER`.

Tyvärr kan vi inte använda vår framebuffer än, eftersom den inte är *komplett*. För att en framebuffer ska vara
komplett måste följande krav vara uppfyllda:

- Vi måste koppla in minst en buffer (färg-, djup- eller stencilbuffer).
- Det ska finnas minst en färgattachment.
- Alla attachments ska också vara kompletta (ha reserverat minne).
- Varje buffer ska ha samma antal samples.

Oroa dig inte om du inte vet vad samples är, dit kommer vi i ett senare kapitel.

Av kraven framgår att vi behöver skapa någon sorts attachment till framebuffern och koppla in den. När vi har
uppfyllt alla krav kan vi kontrollera om framebuffern verkligen blev komplett genom att anropa
`glCheckFramebufferStatus` med `GL_FRAMEBUFFER`. Den kontrollerar då den bundna framebuffern och returnerar något av
värdena i specifikationen. Om den returnerar `GL_FRAMEBUFFER_COMPLETE` är allt klart:

```cpp
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;
```

Alla följande renderingsoperationer renderar nu till attachments i den bundna framebuffern. Eftersom vår framebuffer
inte är default framebuffer har ritkommandona ingen inverkan på det som syns i fönstret. Därför kallas det
*off-screen-rendering* när man renderar till en annan framebuffer. Om alla renderingsoperationer åter ska synas i
huvudfönstret måste vi göra default framebuffer aktiv genom att binda `0`:

```cpp
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

När vi är klara med alla framebufferoperationer ska vi inte glömma att ta bort framebuffer objectet:

```cpp
    glDeleteFramebuffers(1, &framebuffer);
```

Innan kontrollen av fullständigheten körs måste vi alltså koppla in en eller flera attachments i framebuffern. En
*attachment* är ett minnesområde som kan fungera som buffer för framebuffern; tänk på den som en bild. När vi skapar en
attachment har vi två alternativ: texturer eller *renderbuffer objects*.
:::
:::vulkan
En Vulkan-framebuffer skapas i tre delar, som du känner igen från vulkan-tutorials kapitel *Render passes* och
*Framebuffers*:

1. **Images** med minne och image views: *attachments*, minnet som det ritas i.
2. En **render pass** som beskriver attachments – deras format, vad som händer med innehållet när passen börjar
   (`loadOp`) och slutar (`storeOp`), och vilken layout varje image har före, under och efter passen.
3. En **`VkFramebuffer`** som anger de faktiska image views för en render pass, i den ordning render passen räknar upp
   sina attachments.

Render passen är där den största skillnaden mot fönstrets pass finns, så vi skapar den först, i en ny funktion
`createOffscreenRenderPass()` bredvid `createRenderPass()`. Den är en kopia av fönstrets render pass med tre ändringar.
Färgattachmenten har ett format som vi väljer själva i stället för swap chainens:

```cpp
        VkAttachmentDescription colorAttachment{};
        colorAttachment.format = VK_FORMAT_R8G8B8A8_UNORM;
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE; // keep the picture: the screen quad reads it
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

Dess slutliga layout är inte `VK_IMAGE_LAYOUT_PRESENT_SRC_KHR` – den här imagen presenteras aldrig – utan
`VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, den layout en textur måste ha när en shader samplar den. När render passen
slutar för den själv över imagen till den layouten, så vi behöver ingen extra pipeline barrier för det. Djupattachmenten,
attachment-referenserna och subpassen är exakt desamma som i `createRenderPass()`.

Den tredje ändringen är synkroniseringen. Fönstrets render pass har ett subpass dependency som får den att vänta på den
förra användningen av dess attachments. Offscreen-passen får två:

```cpp
        std::array<VkSubpassDependency, 2> dependencies{};
        // before the pass: wait until the last frame's screen quad has read the image and its depth writes are done
        dependencies[0].srcSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[0].dstSubpass = 0;
        dependencies[0].srcStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT | VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT;
        dependencies[0].srcAccessMask = VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;
        dependencies[0].dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_EARLY_FRAGMENT_TESTS_BIT;
        dependencies[0].dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT | VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;
        // after the pass: the fragment shaders that sample the image wait until the scene has been written
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
```

Det andra är den viktiga nya idén. Scenen skrivs i steget color attachment output; efteråt läser en fragment shader
samma image. Utan beroendet skulle GPU:n få starta de läsande fragment shadrarna medan scenen fortfarande skrivs.
`VK_SUBPASS_EXTERNAL` som mål betyder "allt som spelas in efter den här render passen", så skärmquadens fragment
shadrar väntar tills färgskrivningarna är klara och synliga för shaderläsningar. Det första beroendet är spegelbilden
för nästa bildruta: innan scenen ritas i imagen igen måste förra bildrutans fragment shadrar ha läst färdigt. Båda går
in i create info med `renderPassInfo.dependencyCount = static_cast<uint32_t>(dependencies.size());` och
`renderPassInfo.pDependencies = dependencies.data();`, och resultatet sparas i en ny medlem
`VkRenderPass offscreenRenderPass;`.

Det som OpenGL kontrollerar vid körning med `glCheckFramebufferStatus` – är framebuffern *komplett*? – är i Vulkan en
fråga om valid usage: `vkCreateFramebuffer` kräver att image views stämmer med render passens attachments i antal,
format och antal samples och är minst lika stora som framebuffern. Det finns ingen status att fråga efter; gör du fel
är anropet ogiltigt och valideringslagret säger till. Med learnopengl behöver vi nu *attachments* till framebuffern –
minnesområden som kan fungera som buffer för framebuffern; tänk på dem som bilder. OpenGL erbjuder två sorter, texturer
och *renderbuffer objects*, och de två följande avsnitten visar vad de motsvarar i Vulkan.
:::
:::d3d12
I Direct3D 12 finns inget objekt att skapa som står för "en framebuffer". För att rita i eget minne behöver vi:

1. En **resurs** som får vara render target: en 2D-textur skapad med `D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET`.
2. En **render target view** av den i RTV-heapen, för att rita i den.
3. En **shader resource view** av den i CBV/SRV-heapen, för att läsa den i en pixel shader efteråt.

`OMSetRenderTargets` med den RTV:n (och en DSV) spelar sedan rollen som OpenGL:s `glBindFramebuffer`: allt som ritas
efteråt hamnar i vår textur i stället för i back buffern. Det finns ingen "avbindning"; du anropar helt enkelt
`OMSetRenderTargets` igen med back bufferns RTV.

OpenGL kontrollerar vid körning med `glCheckFramebufferStatus` om en framebuffer är *komplett*. Direct3D 12 har ingen
sådan kontroll: reglerna är en del av API:et (en RTV måste beskriva en resurs som tillåter render targets, formaten på
de bundna vyerna måste vara de som pipeline state objectet skapades med, och så vidare), och debuglagret rapporterar
ett anrop som bryter mot dem. Med learnopengl behöver vi nu *attachments* – minnesområden som kan fungera som buffer
för framebuffern; tänk på dem som bilder. OpenGL erbjuder två sorter, texturer och *renderbuffer objects*, och de två
följande avsnitten visar vad de motsvarar i Direct3D 12.
:::

### Texturattachments

När man kopplar in en textur i en framebuffer skriver alla ritkommandon till texturen som om den vore en vanlig färg-,
djup- eller stencilbuffer. Fördelen med texturer är att renderingsresultatet hamnar i en texturbild som vi sedan
enkelt kan använda i våra shadrar.

:::opengl
Att skapa en textur för en framebuffer går till ungefär som att skapa en vanlig textur:

```cpp
    // create a color attachment texture
    unsigned int textureColorbuffer;
    glGenTextures(1, &textureColorbuffer);
    glBindTexture(GL_TEXTURE_2D, textureColorbuffer);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL); // no data: the scene is drawn into it
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```

Den största skillnaden är att vi sätter måtten lika med skärmens storlek (även om det inte krävs) och att vi skickar
`NULL` som texturens `data`-parameter. För den här texturen reserverar vi bara minne utan att fylla det. Texturen fylls
så fort vi renderar till framebuffern. Lägg också märke till att vi inte bryr oss om wrapping eller mipmapping,
eftersom vi i de flesta fall inte behöver dem. Minifieringsfiltret måste ändå sättas: dess standardvärde,
`GL_NEAREST_MIPMAP_LINEAR`, kräver mipmaps, och en textur som saknar de mipmaps som filtret ber om går inte att sampla.

Om du vill rendera hela skärmen till en textur av mindre eller större storlek måste du anropa `glViewport` igen (innan
du renderar till framebuffern) med texturens nya mått, annars fyller ritkommandona bara en del av texturen.

Nu när vi har skapat en textur är det sista vi behöver göra att faktiskt koppla in den i framebuffern:

```cpp
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, textureColorbuffer, 0);
```

Funktionen `glFramebufferTexture2D` har följande parametrar:

- `target`: den sorts framebuffer vi riktar oss mot (draw, read eller båda).
- `attachment`: vilken sorts attachment vi kopplar in. Just nu kopplar vi in en färgattachment. Lägg märke till att
  `0` på slutet antyder att vi kan koppla in fler än en färgattachment. Dit kommer vi i ett senare kapitel.
- `textarget`: typen av textur du vill koppla in.
- `texture`: själva texturen som ska kopplas in.
- `level`: mipmapnivån. Vi håller den på `0`.

Utöver färgattachments kan vi också koppla in en djup- och en stenciltextur i framebuffer objectet. För att koppla in
en djupattachment anger vi attachmenttypen `GL_DEPTH_ATTACHMENT`. Texturens format och internalformat ska då vara
`GL_DEPTH_COMPONENT` för att motsvara djupbufferns lagringsformat. För att koppla in en stencilbuffer använder du
`GL_STENCIL_ATTACHMENT` som andra argument och anger texturens format som `GL_STENCIL_INDEX`.

Det går också att koppla in både en djupbuffer och en stencilbuffer som en enda textur. Varje 32-bitarsvärde i
texturen innehåller då 24 bitar djupinformation och 8 bitar stencilinformation. För att koppla in djup- och
stencilbuffer som en textur använder vi typen `GL_DEPTH_STENCIL_ATTACHMENT` och ställer in texturens format så att de
innehåller kombinerade djup- och stencilvärden:

```cpp
glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH24_STENCIL8, 800, 600, 0, GL_DEPTH_STENCIL, GL_UNSIGNED_INT_24_8, NULL);

glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_TEXTURE_2D, texture, 0);
```
:::
:::vulkan
I Vulkan är varje attachment en image, och vad du får göra med en image bestäms när du skapar den, av dess
*usage*-flaggor. Offscreen-färg-imagen ritas det i, så den behöver `VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT`, och en shader
läser den efteråt, så den behöver också `VK_IMAGE_USAGE_SAMPLED_BIT` – den andra flaggan är det som gör den till
learnopengls *textur*attachment. Projektets hjälpfunktioner `createImage` och `createImageView` från texturkapitlen
gör resten, i en ny funktion `createOffscreenFramebuffer()`:

```cpp
        createImage(swapChainExtent.width, swapChainExtent.height, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, offscreenImage, offscreenImageMemory);
        offscreenImageView = createImageView(offscreenImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
```

Imagen är lika stor som fönstret (`swapChainExtent`), och dess format måste vara det som render passens färgattachment
anger, `VK_FORMAT_R8G8B8A8_UNORM`. Precis som learnopengls `glTexImage2D(..., NULL)` reserverar det här bara minne:
inga pixlar laddas upp, och det behövs ingen staging buffer eller layoutövergång som för en inläst textur – render
passen rensar imagen (`loadOp` CLEAR) innan något ritas i den, och dess `initialLayout` `VK_IMAGE_LAYOUT_UNDEFINED`
säger att vi inte bryr oss om det gamla innehållet.

Om du ville ha offscreen-bilden mindre eller större än fönstret skulle imagen, framebuffern och den viewport du sätter
vid inspelningen alla få den nya storleken.

En djup-image som en senare pass ska läsa – till en shadow map, till exempel – skulle också få
`VK_IMAGE_USAGE_SAMPLED_BIT`, bredvid `VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT`. Om en image bara rymmer djup,
eller djup och stencil tillsammans, avgörs av dess format: `VK_FORMAT_D32_SFLOAT` har bara djup,
`VK_FORMAT_D24_UNORM_S8_UINT` packar 24 bitar djup och 8 bitar stencil i varje texel, som OpenGL:s
`GL_DEPTH24_STENCIL8`.
:::
:::d3d12
Texturen är en committed resource som de `LoadTexture` skapar, med två skillnader: flaggan
`D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET`, utan vilken ingen RTV kan skapas för den, och ett *optimerat clear-värde*:

```cpp
        // A texture as big as the window, in the back buffer's format, that can be a render
        // target (ALLOW_RENDER_TARGET). It starts in the PIXEL_SHADER_RESOURCE state: every
        // frame turns it into a render target for the scene, and back for the screen quad.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);

        // The colour it is usually cleared to (clearing to this colour is fastest).
        const float optimizedClearColor[] = { 0.1f, 0.1f, 0.1f, 1.0f };
        CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R8G8B8A8_UNORM, optimizedClearColor);

        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
            &clearValue,
            IID_PPV_ARGS(&m_offscreenTarget)));
```

`CD3DX12_RESOURCE_DESC::Tex2D(format, width, height, arraySize, mipLevels, sampleCount, sampleQuality, flags)`
beskriver en textur lika stor som fönstret, med en mipnivå och ett sample. Precis som learnopengls
`glTexImage2D(..., NULL)` reserverar det här bara minne: inget laddas upp, det finns ingen upload heap och ingen
kopiering. Clear-värdet talar om för drivrutinen vilken färg vi kommer att rensa texturen till (scenens grå 0.1); att
rensa till exakt den färgen kan gå snabbare, och debuglagret varnar när en rensning använder en annan. Resursen börjar
i tillståndet `D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE` – varför ser du när vi använder den.

Formatet, `DXGI_FORMAT_R8G8B8A8_UNORM`, är back bufferns. Det spelar roll: ett pipeline state object skapas för fasta
render target-format (`psoDesc.RTVFormats[0]`), och eftersom vår textur har samma format som back buffern kan scenens
PSO rita i vilken som helst av dem.

Sedan kommer de två vyerna. RTV:n hamnar i RTV-heapen efter swap chainens buffrar, vilket betyder att heapen behöver en
descriptor till (`rtvHeapDesc.NumDescriptors = FrameCount + 1;`); SRV:n hamnar på plats 3 i CBV/SRV-heapen, efter
marmorn och metallen (`cbvSrvHeapDesc.NumDescriptors = 4;`):

```cpp
        // A render target view, to draw into it: in the RTV heap after the swap chain's buffers.
        CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
        m_device->CreateRenderTargetView(m_offscreenTarget.Get(), nullptr, rtvHandle);

        // A shader resource view, to read it in a pixel shader: slot 3 of the CBV/SRV heap.
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
        m_device->CreateShaderResourceView(m_offscreenTarget.Get(), &srvDesc, srvHandle);
```

(`nullptr` som RTV:ns beskrivning betyder "en vy av hela resursen i dess eget format".) En resurs, två vyer: det är
Direct3D 12:s sätt att säga det som OpenGL:s texturattachment säger – samma minne ritas i och läses.

En djuptextur som en senare pass ska läsa – till en shadow map, till exempel – fungerar på samma sätt: en resurs med
`D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL`, en DSV för att rita i den och en SRV för att läsa den. Om den bara rymmer
djup, eller djup och stencil tillsammans, avgörs av formatet: `DXGI_FORMAT_D32_FLOAT` har bara djup,
`DXGI_FORMAT_D24_UNORM_S8_UINT` packar 24 bitar djup och 8 bitar stencil, som OpenGL:s `GL_DEPTH24_STENCIL8`.
:::

### Renderbuffer object-attachments

:::opengl
Renderbuffer objects infördes i OpenGL efter texturerna, som ytterligare en möjlig sorts framebufferattachment. Precis
som en texturbild är ett renderbuffer object en riktig buffer, alltså en array av bytes, heltal, pixlar eller vad det
nu är. Ett renderbuffer object kan däremot inte läsas direkt. Det ger den fördelen att OpenGL kan göra några
minnesoptimeringar som kan ge den ett prestandaförsprång framför texturer vid off-screen-rendering till en framebuffer.

Renderbuffer objects lagrar all renderingsdata direkt i sin buffer utan någon omvandling till texturspecifika format,
vilket gör dem snabbare som skrivbart lagringsmedium. Du kan inte läsa från dem direkt, men det går att läsa från dem
via den långsamma `glReadPixels`. Den returnerar ett angivet område av pixlar från den bundna framebuffern, men inte
direkt från själva attachmenten.

Eftersom deras data ligger i ett ursprungligt format går de ganska snabbt när man skriver data eller kopierar data till
andra buffrar. Operationer som att byta buffrar går därför ganska snabbt med renderbuffer objects. Funktionen
`glfwSwapBuffers` som vi har använt i slutet av varje bildruta skulle lika gärna kunna vara implementerad med
renderbuffer objects: vi skriver helt enkelt till en renderbufferbild och byter till den andra i slutet.

Att skapa ett renderbuffer object ser ut ungefär som framebufferns kod:

```cpp
    unsigned int rbo;
    glGenRenderbuffers(1, &rbo);
```

På samma sätt vill vi binda renderbuffer objectet så att alla följande renderbufferoperationer påverkar det aktuella
`rbo`:

```cpp
    glBindRenderbuffer(GL_RENDERBUFFER, rbo);
```

Eftersom renderbuffer objects bara kan skrivas används de ofta som djup- och stencilattachments: för det mesta behöver
vi inte läsa värden från dem, men vi bryr oss om djup- och stenciltestet. Vi behöver djup- och stencilvärdena för
testerna, men behöver inte sampla dem, så ett renderbuffer object passar perfekt. När vi inte samplar från de här
buffrarna är ett renderbuffer object i allmänhet att föredra.

Ett renderbuffer object för djup och stencil skapas genom att anropa funktionen `glRenderbufferStorage`:

```cpp
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, SCR_WIDTH, SCR_HEIGHT); // use a single renderbuffer object for both a depth AND stencil buffer.
```

Att skapa ett renderbuffer object liknar texturobjekt, med skillnaden att det här objektet är särskilt gjort för att
användas som framebufferattachment, i stället för en allmän databuffer som en textur. Här har vi valt
`GL_DEPTH24_STENCIL8` som internt format, som rymmer både djup- och stencilbuffern med 24 respektive 8 bitar.

Det sista som återstår är att faktiskt koppla in renderbuffer objectet:

```cpp
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, rbo); // now actually attach it
```

Renderbuffer objects kan vara effektivare i dina off-screen-projekt, men det är viktigt att förstå när man ska använda
renderbuffer objects och när man ska använda texturer. Den allmänna regeln är att om du aldrig behöver sampla data från
en viss buffer är det klokt att använda ett renderbuffer object för den. Om du behöver sampla data från en buffer, som
färger eller djupvärden, ska du använda en texturattachment i stället.
:::
:::vulkan
Vulkan har inga renderbuffer objects: varje attachment är en `VkImage`. Det som gör en image "renderbufferlik" är,
återigen, dess usage. En image som bara är en djupattachment – `VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT` och inget
annat, så att den aldrig kan samplas – lämnar drivrutinen fri att lagra den på det sätt som är snabbast för
djuptestning. Det är precis learnopengls skäl att använda en renderbuffer för djup och stencil: vi behöver värdena för
testerna, men samplar dem aldrig.

Offscreen-framebuffern får en egen sådan djup-image, skapad på samma sätt som `createDepthResources()` skapar
fönstrets:

```cpp
        VkFormat depthFormat = findDepthFormat();
        createImage(swapChainExtent.width, swapChainExtent.height, depthFormat, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, offscreenDepthImage, offscreenDepthImageMemory);
        offscreenDepthImageView = createImageView(offscreenDepthImage, depthFormat, VK_IMAGE_ASPECT_DEPTH_BIT);
```

`findDepthFormat()` väljer här `VK_FORMAT_D32_SFLOAT`, en djupbuffer utan stencil – vår scen använder inte
stenciltestet. learnopengls `GL_DEPTH24_STENCIL8` vore `VK_FORMAT_D24_UNORM_S8_UINT`. (Vulkan går ett steg längre än
renderbuffers: en attachment som bara lever under en render pass kan skapas med
`VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT` och, på GPU:er som stöder det, bindas till lazily allocated memory som kanske
aldrig får något riktigt minne alls.)

Till sist själva framebuffern, som sätter ihop de två vyerna för `offscreenRenderPass` – färgvyn först, djupvyn sedan,
i den ordning render passen räknar upp dem:

```cpp
        std::array<VkImageView, 2> attachments = {
            offscreenImageView,
            offscreenDepthImageView
        };

        VkFramebufferCreateInfo framebufferInfo{};
        framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
        framebufferInfo.renderPass = offscreenRenderPass;
        framebufferInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
        framebufferInfo.pAttachments = attachments.data();
        framebufferInfo.width = swapChainExtent.width;
        framebufferInfo.height = swapChainExtent.height;
        framebufferInfo.layers = 1;

        if (vkCreateFramebuffer(device, &framebufferInfo, nullptr, &offscreenFramebuffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to create offscreen framebuffer!");
        }
```

De nya medlemmarna (`offscreenImage`, `offscreenImageMemory`, `offscreenImageView`, samma tre för djup-imagen, och
`VkFramebuffer offscreenFramebuffer`) förstörs i `cleanup()` bredvid fönstrets djup-image, och render passen bredvid
`renderPass`. `createOffscreenFramebuffer()` anropas i `initVulkan()` efter `createFramebuffers()`.

Tumregeln från OpenGL gäller även här: om du aldrig behöver sampla från en attachment, ge den inte
`VK_IMAGE_USAGE_SAMPLED_BIT`; behöver du sampla den (färger, eller djup till en shadow map) behöver den flaggan.
:::
:::d3d12
Direct3D 12 har inga renderbuffer objects: varje attachment är en resurs. Det som gör en resurs "renderbufferlik" är
att den bara har den vy den ritas genom och ingen SRV, så att ingen shader någonsin kan läsa den. En djupbuffer skapad
med `D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL` och utan SRV är precis det, och projektet har redan en:
`m_depthStencil`, fönstrets djupbuffer (`DXGI_FORMAT_D32_FLOAT`, ingen stencil – vår scen använder inte
stenciltestet), med sin DSV i `m_dsvHeap`. (Flaggan `D3D12_RESOURCE_FLAG_DENY_SHADER_RESOURCE` går ännu längre: den
lovar att djupbuffern aldrig får någon SRV, vilket ger drivrutinen frihet att optimera den enbart för djuptestning.)

Eftersom vi aldrig samplar djupvärdena behöver vi ingen andra djupbuffer: scenen fortsätter att använda
`m_depthStencil` medan den ritas i vår textur. Den har fönstrets storlek, så den passar. Det är learnopengls
renderbuffer object för djup och stencil – minne som det testas mot, men som ingen shader någonsin läser.

Tumregeln från OpenGL gäller även här: om du aldrig behöver sampla från en attachment behöver den ingen SRV; behöver
du sampla den (färger, eller djup till en shadow map) skapar du en.
:::

```quiz
learnopengl använder en textur för framebufferns färg och en renderbuffer för dess djup och stencil. Vad är skälet till den uppdelningen?
- [ ] Renderbuffers kan inte lagra färger
- [x] Färgen läses av en shader efteråt, djup- och stencilvärdena behövs bara för testerna under ritningen – en attachment som aldrig samplas kan lagras på det sätt som är snabbast
- [ ] Texturer kan inte vara lika stora som fönstret
- [ ] Djupvärdena måste ha samma format som fönstrets djupbuffer
---
Attachments som bara skrivs och testas behöver inte vara läsbara för shadrar, vilket ger utrymme för optimeringar. Färgen är bilden vi vill efterbehandla, så den måste gå att sampla.
```

## Rendera till en textur

Nu när vi vet hur framebuffers (ungefär) fungerar är det dags att använda dem på riktigt. Vi ska rendera scenen i en
färgtextur som sitter i en framebuffer vi har skapat, och sedan rita den här texturen på en enkel quad som täcker hela
skärmen. Det som syns blir då exakt detsamma som utan framebuffer, men den här gången är allt utskrivet på en enda
quad. Varför är det användbart? Det ser vi i nästa avsnitt.

:::opengl
Det första vi gör är att skapa ett riktigt framebuffer object och binda det, vilket är ganska okomplicerat:

```cpp
    unsigned int framebuffer;
    glGenFramebuffers(1, &framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
```

Sedan skapar vi en texturbild som vi kopplar in som färgattachment i framebuffern. Vi sätter texturens mått lika med
fönstrets bredd och höjd och lämnar dess data oinitierad – koden från *Texturattachments*, följd av
`glFramebufferTexture2D`. Vi vill också se till att OpenGL kan göra djuptestning (och stenciltestning), så vi måste
lägga till en djup- (och stencil-)attachment i framebuffern. Eftersom vi bara kommer att sampla färgbuffern och inte de
andra buffrarna kan vi skapa ett renderbuffer object för det här ändamålet – koden från *Renderbuffer
object-attachments*. Sedan kontrollerar vi om framebuffern är komplett och skriver ut ett felmeddelande om den inte är
det, och till sist avbinder vi framebuffern så att vi inte råkar rendera till fel framebuffer. Allt detta hamnar efter
shaderkonfigurationen, som ett block:

```cpp
    // framebuffer configuration
    // -------------------------
    unsigned int framebuffer;
    glGenFramebuffers(1, &framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
    // create a color attachment texture
    unsigned int textureColorbuffer;
    glGenTextures(1, &textureColorbuffer);
    glBindTexture(GL_TEXTURE_2D, textureColorbuffer);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL); // no data: the scene is drawn into it
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, textureColorbuffer, 0);
    // create a renderbuffer object for depth and stencil attachment (we won't be sampling these)
    unsigned int rbo;
    glGenRenderbuffers(1, &rbo);
    glBindRenderbuffer(GL_RENDERBUFFER, rbo);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, SCR_WIDTH, SCR_HEIGHT); // use a single renderbuffer object for both a depth AND stencil buffer.
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, rbo); // now actually attach it
    // now that we actually created the framebuffer and added all attachments we want to check if it is actually complete now
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Nu när framebuffern är komplett behöver vi bara binda framebuffer objectet för att rendera till framebufferns buffrar
i stället för till default framebuffer. Alla följande ritkommandon påverkar då den bundna framebuffern. Alla djup- och
stenciloperationer läser också från den bundna framebufferns djup- och stencilattachments om de finns. Om du till
exempel skulle utelämna en djupbuffer slutar all djuptestning att fungera, eftersom det inte finns någon djupbuffer i
den bundna framebuffern.

För att rita scenen i en enda textur behöver vi alltså ta följande steg:

1. Rendera scenen som vanligt med den nya framebuffern bunden som aktiv framebuffer.
2. Binda default framebuffer.
3. Rita en quad som täcker hela skärmen med den nya framebufferns färgbuffer som textur.

De två första stegen hamnar nu i renderloopen. Före rensningen binder vi vår framebuffer:

```cpp
        // bind to framebuffer and draw scene as we normally would to color texture
        glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
        glEnable(GL_DEPTH_TEST); // enable depth testing (is disabled for rendering screen-space quad)

        // make sure we clear the framebuffer's content
        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
```

Rensningen och scenens tre ritanrop står kvar som de är – de hamnar nu i vår framebuffer. Efter golvet går vi tillbaka
till default framebuffer:

```cpp
        // now bind back to default framebuffer and draw a quad plane with the attached framebuffer color texture
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glDisable(GL_DEPTH_TEST); // disable depth test so screen-space quad isn't discarded due to depth test.
        // clear all relevant buffers
        glClearColor(1.0f, 1.0f, 1.0f, 1.0f); // set clear color to white (not really necessary actually, since we won't be able to see behind the quad anyways)
        glClear(GL_COLOR_BUFFER_BIT);
```

Skärmquaden blir en enda quad som ritas utan djup, så det finns inget att testa den mot: vi stänger av djuptestet för
den. Djuptestet är globalt tillstånd, så nästa bildruta måste slå på det igen innan scenen ritas – därför flyttade
`glEnable(GL_DEPTH_TEST)` in i renderloopen, direkt efter att framebuffern binds.

I slutet av `main` tar du bort texturen, renderbuffern och framebuffern tillsammans med de andra objekten:

```cpp
    glDeleteTextures(1, &textureColorbuffer);
    glDeleteRenderbuffers(1, &rbo);
    glDeleteFramebuffers(1, &framebuffer);
```
:::
:::vulkan
Först kommer render passen från *Skapa en framebuffer*, sedan images och framebuffern från de två
attachment-avsnitten. I `initVulkan()` skapas render passen direkt efter fönstrets:

```cpp
        createRenderPass();
        createOffscreenRenderPass();
        createDescriptorSetLayout();
        createPipelineLayout();
        // a pipeline is made for one render pass: the scene's pipeline for the offscreen one
        createPipeline("shaders/framebuffers.vert.spv", "shaders/framebuffers.frag.spv", offscreenRenderPass, graphicsPipeline);
```

Lägg märke till ändringen i `createPipeline`: den får en parameter `VkRenderPass pipelineRenderPass`, som hamnar i
`pipelineInfo.renderPass`. En grafikpipeline skapas för en render pass (och en av dess subpasses), och kan bara
användas med den render passen eller en som är *kompatibel* med den – en med samma attachmentformat och antal samples.
Vår offscreen-färg-image är `VK_FORMAT_R8G8B8A8_UNORM`, swap chainens images är `VK_FORMAT_B8G8R8A8_UNORM`, så de två
render passerna är inte kompatibla, och scenens pipeline måste ange `offscreenRenderPass`. Till skillnad från OpenGL,
där vilket shaderprogram som helst kan rita i vilken framebuffer som helst, vill Vulkan veta målets format när den
bygger pipelinen.

För att rita scenen i en enda textur behöver vi alltså ta följande steg:

1. Rendera scenen som vanligt i offscreen-render passen, i offscreen-framebuffern.
2. Starta fönstrets render pass.
3. Rita en quad som täcker hela skärmen med offscreen-imagen som textur.

I `recordCommandBuffer()` börjar scenens render pass nu med offscreen-render passen och -framebuffern, med egna
clear-värden:

```cpp
        // 1. the scene, drawn into the offscreen target as we normally would (learnopengl: glBindFramebuffer(GL_FRAMEBUFFER, framebuffer))
        VkRenderPassBeginInfo offscreenPassInfo{};
        offscreenPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        offscreenPassInfo.renderPass = offscreenRenderPass;
        offscreenPassInfo.framebuffer = offscreenFramebuffer;
        offscreenPassInfo.renderArea.offset = {0, 0};
        offscreenPassInfo.renderArea.extent = swapChainExtent;

        // one clear value per attachment: the colour, and the depth 1.0 (the far plane)
        std::array<VkClearValue, 2> offscreenClearValues{};
        offscreenClearValues[0].color = {{0.1f, 0.1f, 0.1f, 1.0f}};
        offscreenClearValues[1].depthStencil = {1.0f, 0};

        offscreenPassInfo.clearValueCount = static_cast<uint32_t>(offscreenClearValues.size());
        offscreenPassInfo.pClearValues = offscreenClearValues.data();

        vkCmdBeginRenderPass(commandBuffer, &offscreenPassInfo, VK_SUBPASS_CONTENTS_INLINE);
```

Allt som följer – att binda pipelinen, viewport och scissor, vertex buffern, de tre ritanropen – står kvar som det
var. Efter golvet slutar offscreen-passen, och fönstrets pass börjar, rensad till vitt:

```cpp
        vkCmdEndRenderPass(commandBuffer); // the offscreen image is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL

        // 2. the window (learnopengl: glBindFramebuffer(GL_FRAMEBUFFER, 0))
        VkRenderPassBeginInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        renderPassInfo.renderPass = renderPass;
        renderPassInfo.framebuffer = swapChainFramebuffers[imageIndex];
        renderPassInfo.renderArea.offset = {0, 0};
        renderPassInfo.renderArea.extent = swapChainExtent;

        // white (not really necessary actually, since we won't be able to see behind the quad anyways)
        std::array<VkClearValue, 2> clearValues{};
        clearValues[0].color = {{1.0f, 1.0f, 1.0f, 1.0f}};
        clearValues[1].depthStencil = {1.0f, 0};

        renderPassInfo.clearValueCount = static_cast<uint32_t>(clearValues.size());
        renderPassInfo.pClearValues = clearValues.data();

        vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        // TODO: draw the screen quad (screenPipeline, screenDescriptorSet, its 6 vertices) with the offscreen image as its texture

        vkCmdEndRenderPass(commandBuffer);
```

Två render passes i en command buffer: det är allt som Vulkans version av "bind en framebuffer, rita, bind default
framebuffer, rita" består av. Offscreen-passens subpass dependencies och slutliga layout sköter det som OpenGL:s
drivrutin gör i tysthet mellan de två – ser till att bilden är färdig och läsbar innan den andra passen samplar den.
:::
:::d3d12
Texturen och dess två vyer hamnar i `LoadAssets`, efter att djupbuffern har skapats. Sedan ritningen, i
`PopulateCommandList`. För att rita scenen i en enda textur behöver vi alltså ta följande steg:

1. Rendera scenen som vanligt med vår texturs RTV (och djupbufferns DSV) bundna.
2. Binda back bufferns RTV.
3. Rita en quad som täcker hela skärmen med vår texturs SRV som textur.

En resurs i Direct3D 12 har alltid ett *tillstånd* (state), och tillståndet måste passa användningen: för att ritas i
måste den vara i `D3D12_RESOURCE_STATE_RENDER_TARGET`, för att läsas av en pixel shader i
`D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE`. En *transition barrier* växlar mellan dem – och får GPU:n att avsluta
skrivningarna innan läsningarna börjar. Det känner du igen från back buffern, som går från PRESENT till RENDER_TARGET i
början av varje bildruta och tillbaka i slutet. Vår textur går också runt i en cirkel: den skapades i
PIXEL_SHADER_RESOURCE, blir ett render target för scenen, och är en pixel shader resource igen när skärmquaden läser
den – vilket också är tillståndet som nästa bildruta börjar i.

Den första passen binder vår texturs RTV (plats `FrameCount` i RTV-heapen) tillsammans med djupbuffern, och rensar den
– i stället för back buffern:

```cpp
    // First pass: the scene, drawn into the off-screen render target with the depth buffer.
    // The screen quad of the previous frame read the texture: now it is written again.
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_offscreenTarget.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    CD3DX12_CPU_DESCRIPTOR_HANDLE offscreenRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &offscreenRtvHandle, FALSE, &dsvHandle);

    // Record commands.
    const float clearColor[] = { 0.1f, 0.1f, 0.1f, 1.0f };
    m_commandList->ClearRenderTargetView(offscreenRtvHandle, clearColor, 0, nullptr);
```

Djuprensningen och scenens tre ritanrop står kvar som de är. Efter golvet blir texturen läsbar, back buffern blir ett
render target, och den andra passen binder den – utan djupbuffer – och rensar den till vitt:

```cpp
    // The scene is in the texture: from now on the pixel shader reads it.
    barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_offscreenTarget.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, &barrier);

    // Second pass: the window. Indicate that the back buffer will be used as a render target.
    barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    // The back buffer, without a depth buffer: the screen quad needs no depth test.
    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);

    // Clear it to white (not really necessary: the screen quad covers the whole window).
    const float screenClearColor[] = { 1.0f, 1.0f, 1.0f, 1.0f };
    m_commandList->ClearRenderTargetView(rtvHandle, screenClearColor, 0, nullptr);
```

Barriären som avslutar bildrutan – back buffern från RENDER_TARGET till PRESENT – står kvar i slutet. Två anrop till
`OMSetRenderTargets` i en command list: det är Direct3D 12:s version av "bind en framebuffer, rita, bind default
framebuffer, rita".
:::

Gör nu den första uppgiften, **offscreen-target**, och tryck på **Build & run**. Fönstret är helt vitt.

```quiz
Efter uppgiften **offscreen-target** är fönstret vitt överallt, fast scenen fortfarande ritas varje bildruta. Varför?
- [ ] Djuptestet förkastar nu varje fragment i scenen
- [ ] Scenen ritas, men den vita rensningen efteråt raderar texturen den ritades i
- [x] Scenen hamnar i vår egen färgtextur; fönstret får bara sin vita rensning, och ingenting visar texturen än
- [ ] En egen framebuffer kan inte ritas i innan den har visats en gång
---
Det är off-screen-rendering: ritanropen påverkar bara det mål som är bundet när de körs. Fönstrets rensning rör inte vår textur – den är ett annat minnesområde – och nästa uppgift sätter texturen på skärmen.
```

För att visa texturen behöver vi en quad som fyller skärmen. Dess vertexar anges direkt i normaliserade
enhetskoordinater (NDC), så vertex shadern behöver inga matriser alls – den skickar bara positionerna vidare:

:::opengl
```cpp
    float quadVertices[] = { // vertex attributes for a quad that fills the entire screen in Normalized Device Coordinates.
        // positions   // texCoords
        -1.0f,  1.0f,  0.0f, 1.0f,
        -1.0f, -1.0f,  0.0f, 0.0f,
         1.0f, -1.0f,  1.0f, 0.0f,

        -1.0f,  1.0f,  0.0f, 1.0f,
         1.0f, -1.0f,  1.0f, 0.0f,
         1.0f,  1.0f,  1.0f, 1.0f
    };
```

Varje vertex har en 2D-position och 2D-texturkoordinater, så quadens VAO har två attribut med två floats vardera och
ett stride på fyra floats:

```cpp
    // screen quad VAO
    unsigned int quadVAO, quadVBO;
    glGenVertexArrays(1, &quadVAO);
    glGenBuffers(1, &quadVBO);
    glBindVertexArray(quadVAO);
    glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(quadVertices), &quadVertices, GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)(2 * sizeof(float)));
    glBindVertexArray(0);
```

Vertex shadern, `framebuffers_screen.vs`, finns redan:

```glsl
#version 330 core
layout (location = 0) in vec2 aPos;
layout (location = 1) in vec2 aTexCoords;

out vec2 TexCoords;

void main()
{
    TexCoords = aTexCoords;
    gl_Position = vec4(aPos.x, aPos.y, 0.0, 1.0); // the quad's corners are already in normalized device coordinates
}
```

Inget märkvärdigt. Fragment shadern blir ännu enklare, eftersom det enda vi behöver göra är att sampla från en textur:

```glsl
#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D screenTexture;

void main()
{
    vec3 col = texture(screenTexture, TexCoords).rgb;
    FragColor = vec4(col, 1.0);
}
```

Texturkoordinaterna går från (0, 0) nere till vänster till (1, 1) uppe till höger, på samma sätt som framebufferns
textur fylldes: OpenGL:s fönsterkoordinater börjar nere till vänster, och det gör en texturs första rad också. Bilden
kommer därför ut rättvänd.

Sedan är det upp till dig att skapa shaderprogrammet, `Shader screenShader("framebuffers_screen.vs",
"framebuffers_screen.fs");`, och att peka dess sampler på texturenhet 0 i shaderkonfigurationen:

```cpp
    screenShader.use();
    screenShader.setInt("screenTexture", 0);
```

I renderloopen, efter den vita rensningen, ritar vi quaden med framebufferns färgtextur:

```cpp
        screenShader.use();
        glBindVertexArray(quadVAO);
        glBindTexture(GL_TEXTURE_2D, textureColorbuffer); // use the color attachment texture as the texture of the quad plane
        glDrawArrays(GL_TRIANGLES, 0, 6);
        glBindVertexArray(0);
```

Quadens VAO och VBO tas bort i slutet av `main` tillsammans med de andra.
:::
:::vulkan
Alla projektets vertexar ligger i en enda vertex buffer, så quadens sex vertexar läggs till sist i `vertices`, efter
golvet – de blir vertex 42..47. Structen `Vertex` har en 3D-position, så quaden får z = 0:

```cpp
    // screen quad: vertices 42..47, learnopengl's quadVertices (positions already in normalized device coordinates,
    // z = 0) with its texture coordinates unchanged: in Vulkan both the y of the window and the v of an image point
    // down, so the two flips cancel and the offscreen picture shows upright
    {{-1.0f,  1.0f,  0.0f}, {0.0f, 1.0f}},
    {{-1.0f, -1.0f,  0.0f}, {0.0f, 0.0f}},
    {{ 1.0f, -1.0f,  0.0f}, {1.0f, 0.0f}},

    {{-1.0f,  1.0f,  0.0f}, {0.0f, 1.0f}},
    {{ 1.0f, -1.0f,  0.0f}, {1.0f, 0.0f}},
    {{ 1.0f,  1.0f,  0.0f}, {1.0f, 1.0f}}
```

Det är learnopengls `quadVertices` oförändrade, och det förtjänar en extra titt. I Vulkan är normaliserad
enhetskoordinat y = -1 framebufferns *överkant*, så hörnet (-1, 1) ligger nere till vänster i fönstret. Scenen ritades
i offscreen-imagen med samma konvention (projektionens y-vändning håller den rättvänd), så imagens första rad, v = 0,
rymmer bildens överkant. Längst ner i fönstret behöver vi därför v = 1, imagens sista rad – och det är vad learnopengls
koordinater ger hörnet (-1, 1).

Vertex shadern, `shaders/framebuffers_screen.vert`, finns redan – inga matriser, hörnen skickas bara vidare:

```glsl
void main() {
    fragTexCoord = inTexCoord;
    gl_Position = vec4(inPosition.x, inPosition.y, 0.0, 1.0);
}
```

och fragment shadern samplar bara imagen:

```glsl
#version 450

layout(binding = 1) uniform sampler2D screenTexture;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 col = texture(screenTexture, fragTexCoord).rgb;
    outColor = vec4(col, 1.0);
}
```

Quaden får en egen pipeline, `screenPipeline`, gjord för fönstrets `renderPass` – och utan djuptestet: skärmquaden är
en enda quad som ritas utan djup, så det finns inget att testa den mot. I OpenGL är det `glDisable(GL_DEPTH_TEST)`
innan den ritas; i Vulkan är djuptestet en del av pipelinen, så `createPipeline` får ytterligare en parameter,
`VkBool32 depthTestEnable`:

```cpp
        depthStencil.depthTestEnable = depthTestEnable;
        depthStencil.depthWriteEnable = depthTestEnable; // with the test off nothing is written either (like glDisable(GL_DEPTH_TEST))
```

och `initVulkan()` skapar båda pipelines:

```cpp
        createPipeline("shaders/framebuffers.vert.spv", "shaders/framebuffers.frag.spv", offscreenRenderPass, VK_TRUE, graphicsPipeline);
        // the screen quad: for the window's render pass, without the depth test (it must never be hidden)
        createPipeline("shaders/framebuffers_screen.vert.spv", "shaders/framebuffers_screen.frag.spv", renderPass, VK_FALSE, screenPipeline);
```

Shadern läser offscreen-imagen genom ett descriptor set, skapat med projektets hjälpfunktion från image viewn och den
befintliga `textureSampler` (poolen behöver nu plats för 3 set: `maxSets = 3` och `descriptorCount` 3 för båda
poolstorlekarna):

```cpp
        createDescriptorSet(offscreenImageView, textureSampler, screenDescriptorSet);
```

Hjälpfunktionen skriver imagen med `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` i descriptorn – den layout som vår render
pass lämnar imagen i. Till sist ritanropet, i fönstrets render pass där TODO:n står:

```cpp
        // the screen quad with the offscreen image as its texture (the viewport, scissor and vertex buffer set above still apply)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, screenPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &screenDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 42, 0); // the screen quad's 6 vertices start at vertex 42
```

Viewport, scissor och den bundna vertex buffern är tillstånd i command buffern, inte i en render pass, så värdena som
sattes för den första passen gäller fortfarande i den andra. Förstör `screenPipeline` i `cleanup()` tillsammans med den
andra pipelinen.
:::
:::d3d12
Alla projektets vertexar ligger i en enda vertex buffer, så quadens sex vertexar hamnar sist i `vertices[]`, efter
golvet – de blir vertex 42 till 47:

```cpp
            // the screen quad: vertices 42 to 47 - two triangles that fill the whole window,
            // in normalized device coordinates (x and y from -1 to 1; z is not used). The
            // texture coordinates are learnopengl.com's with v flipped: v = 0 at the top.
            { { -1.0f,  1.0f, 0.0f }, { 0.0f, 0.0f } },
            { { -1.0f, -1.0f, 0.0f }, { 0.0f, 1.0f } },
            { {  1.0f, -1.0f, 0.0f }, { 1.0f, 1.0f } },

            { { -1.0f,  1.0f, 0.0f }, { 0.0f, 0.0f } },
            { {  1.0f, -1.0f, 0.0f }, { 1.0f, 1.0f } },
            { {  1.0f,  1.0f, 0.0f }, { 1.0f, 0.0f } }
```

Varför vända? I Direct3D är normaliserad enhetskoordinat y = 1 render targetens överkant, och render targetens översta
rad är texturens första rad, v = 0. När vi ritade scenen hamnade dess överkant alltså på v = 0, och quadens övre hörn
behöver v = 0 för att visa den där. (I OpenGL ligger en texturs första rad nederst, så learnopengls quad har v = 1
upptill.)

Shadrarna finns i `framebuffers_screen.hlsl`. Vertex shadern finns redan – inga matriser, hörnen skickas bara vidare:

```hlsl
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = float4(position.x, position.y, 0.0f, 1.0f);
    result.texCoord = texCoord;

    return result;
}
```

och pixel shadern samplar bara texturen:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 col = screenTexture.Sample(wrapSampler, input.texCoord).rgb;
    return float4(col, 1.0f);
}
```

`screenTexture` är den `Texture2D` på register `t0` – den SRV som root-parameter 2:s descriptor table pekar på, som
`texture1` i scenens shader – och `wrapSampler` den statiska samplern `s0`.

Quaden behöver ett eget pipeline state object, `m_screenPipelineState`. Skärmquaden är en enda quad som ritas utan
djup, så det finns inget att testa den mot – och fönstrets pass binder ingen djupbuffer alls. Ett PSO lagrar formatet
på den djupbuffer det ritar med (`DSVFormat`), så quadens PSO säger "ingen", och stänger av djuptestet (learnopengls
`glDisable(GL_DEPTH_TEST)`). Det är scenens beskrivning med de andra shadrarna, skapad direkt efter `m_pipelineState`:

```cpp
        ComPtr<ID3DBlob> screenVertexShader;
        ComPtr<ID3DBlob> screenPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"framebuffers_screen.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &screenVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"framebuffers_screen.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &screenPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(screenVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(screenPixelShader.Get());
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_screenPipelineState)));
```

`RTVFormats[0]` förblir `DXGI_FORMAT_R8G8B8A8_UNORM`, back bufferns format. Till sist ritanropet, i fönstrets pass där
TODO:n står: quadens PSO, vår texturs SRV på heap-plats 3 för root-parameter 2, och de sex vertexarna från vertex 42:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE screenTexture(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
    m_commandList->SetPipelineState(m_screenPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, screenTexture);
    m_commandList->DrawInstanced(6, 1, 42, 0);
```

Viewport, scissor-rektangeln, vertex buffern och root-signaturen sattes för den första passen; de är tillstånd i
command listen och gäller fortfarande.
:::

:::opengl
```quiz
Varför stänger renderloopen av djuptestet innan skärmquaden ritas, och slår på det igen i början av varje bildruta?
- [ ] Default framebuffer har ingen djupbuffer, så OpenGL skulle rapportera ett fel
- [ ] Med djuptestet påslaget skulle quaden ritas bakom scenens kuber
- [ ] `glBindFramebuffer` återställer allt globalt tillstånd, så det måste ändå sättas igen
- [x] Quaden är ett enda platt lager utan något att testas mot; men djuptestet är globalt tillstånd, så scenen i nästa bildruta behöver det påslaget igen
---
OpenGL:s tillståndsmaskin behåller det som sattes sist. Quaden behöver inget djuptest (och ett kvarlämnat djupvärde skulle till och med kunna dölja den); scenen behöver det, så bildrutan börjar med `glEnable(GL_DEPTH_TEST)` direkt efter att vår framebuffer binds.
```
:::
:::vulkan
```quiz
Varför behöver projektet en andra pipeline för skärmquaden i stället för att rita den med `graphicsPipeline`?
- [ ] En pipeline kan bara bindas en gång per command buffer
- [ ] Skärmquaden har ett annat antal vertexar
- [ ] Bara en pipeline får använda en viss descriptor set layout
- [x] Quaden ritas i fönstrets render pass, vars färgformat skiljer sig från offscreen-passens, och den behöver andra shadrar och inget djuptest – allt sådant ligger fast i en pipeline
---
En pipeline skapas för en render pass (eller en kompatibel), med sina shadrar och sitt djuptillstånd inbakade. Quaden behöver `renderPass`, skärmshadrarna och `depthTestEnable = VK_FALSE`, så den får `screenPipeline`.
```
:::
:::d3d12
```quiz
Varför sätter skärmquadens PSO `DSVFormat = DXGI_FORMAT_UNKNOWN` och `DepthEnable = FALSE`?
- [ ] Ett PSO som samplar en textur får inte ha en djupbuffer
- [ ] Annars skulle quadens z = 0 klippas bort
- [ ] `DXGI_FORMAT_UNKNOWN` säger åt Direct3D att välja back bufferns format
- [x] Fönstrets pass binder ingen DSV (`OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr)`), och ett PSO måste stämma med de format som är bundna när det ritar; utan djupbuffer finns inget att testa mot
---
Ett PSO skapas för fasta render target- och djupformat. Quaden är ett enda platt lager som inte behöver något djuptest – learnopengls `glDisable(GL_DEPTH_TEST)` – så dess pass har ingen djupbuffer och dess PSO säger det.
```
:::

Gör nu uppgiften **screen-quad** och tryck på **Build & run**. Scenen är tillbaka, exakt som den såg ut i början av
kapitlet – kuberna, golvet, den mörkgrå bakgrunden. Om du tittade på den i wireframe-läge skulle du se en enda quad som
täcker fönstret, men ingenting i bilden avslöjar att scenen tog en omväg genom en textur.

Vad var då nyttan med det här? Eftersom vi nu fritt kan komma åt varje pixel i den färdigrenderade scenen som en enda
texturbild kan vi skapa intressanta effekter i fragment shadern.

## Post-processing

Nu när hela scenen är renderad i en enda textur kan vi skapa coola post-processing-effekter genom att manipulera
scenens textur. I det här avsnittet visar vi några av de mer populära post-processing-effekterna och hur du kan skapa
egna med lite kreativitet.

Vi börjar med en av de enklaste post-processing-effekterna.

### Invertering

Vi har tillgång till varje färg i renderingsresultatet, så det är inte så svårt att returnera inversen av färgerna i
fragment shadern. Vi tar skärmtexturens färg och inverterar den genom att dra den från `1.0`:

:::opengl
```glsl
void main()
{
    FragColor = vec4(vec3(1.0 - texture(screenTexture, TexCoords)), 1.0); // every colour channel inverted
}
```
:::
:::vulkan
```glsl
void main() {
    outColor = vec4(vec3(1.0 - texture(screenTexture, fragTexCoord)), 1.0); // every colour channel inverted
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(1.0f - screenTexture.Sample(wrapSampler, input.texCoord).rgb, 1.0f);    // every colour channel inverted
}
```
:::

Även om invertering är en ganska enkel post-processing-effekt ger den redan häftiga resultat. Gör uppgiften
**inversion** och tryck på **Build & run**: hela scenen har fått alla sina färger inverterade med en enda kodrad i
fragment shadern. Den mörkgrå bakgrunden blir ljusgrå, den vita marmorn blir mörkt blågrå och det grå stålgolvet blir
brunaktigt.

```quiz
Bakgrunden rensades till (0.1, 0.1, 0.1) – 26, 26, 26 i 8-bitarsvärden. Vilken färg har den efter inverteringen?
- [x] 229, 229, 229
- [ ] 26, 26, 26: clear-färgen ingår inte i texturen
- [ ] 0, 0, 0
- [ ] 255, 255, 255
---
`1.0 - 0.1 = 0.9`, och 255 − 26 = 229. Clear-färgen skrevs in i texturen som vilken ritad pixel som helst, så den inverteras också.
```

### Gråskala

En annan intressant effekt är att ta bort alla färger ur scenen utom vitt, grått och svart; i praktiken att göra hela
bilden gråskalig. Ett enkelt sätt är att ta alla färgkomponenter och räkna ut medelvärdet:

:::opengl
```glsl
void main()
{
    FragColor = texture(screenTexture, TexCoords);
    float average = (FragColor.r + FragColor.g + FragColor.b) / 3.0;
    FragColor = vec4(average, average, average, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    outColor = texture(screenTexture, fragTexCoord);
    float average = (outColor.r + outColor.g + outColor.b) / 3.0;
    outColor = vec4(average, average, average, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float4 color = screenTexture.Sample(wrapSampler, input.texCoord);
    float average = (color.r + color.g + color.b) / 3.0f;
    return float4(average, average, average, 1.0f);
}
```
:::

Det ger redan ganska bra resultat, men det mänskliga ögat är mest känsligt för grönt och minst för blått. För att få
de mest fysikaliskt korrekta resultaten behöver vi därför viktade kanaler:

:::opengl
```glsl
void main()
{
    FragColor = texture(screenTexture, TexCoords);
    // weighted average: the human eye is most sensitive to green and least to blue
    float average = 0.2126 * FragColor.r + 0.7152 * FragColor.g + 0.0722 * FragColor.b;
    FragColor = vec4(average, average, average, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    outColor = texture(screenTexture, fragTexCoord);
    // weighted average: the human eye is most sensitive to green and least to blue
    float average = 0.2126 * outColor.r + 0.7152 * outColor.g + 0.0722 * outColor.b;
    outColor = vec4(average, average, average, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float4 color = screenTexture.Sample(wrapSampler, input.texCoord);
    // weighted average: the human eye is most sensitive to green and least to blue
    float average = 0.2126f * color.r + 0.7152f * color.g + 0.0722f * color.b;
    return float4(average, average, average, 1.0f);
}
```
:::

Gör uppgiften **grayscale** med den viktade versionen och tryck på **Build & run**: inverteringen är borta, och scenen
visas i gråtoner – varje pixel har samma värde för rött, grönt och blått. Du märker förmodligen inte skillnaden mot det
vanliga medelvärdet direkt, men i mer komplicerade scener brukar en sådan viktad gråskaleeffekt se mer realistisk ut.

## Kerneleffekter

En annan fördel med att göra post-processing på en enda texturbild är att vi kan sampla färgvärden från andra delar av
texturen än just det aktuella fragmentets. Vi kan till exempel ta ett litet område runt den aktuella texturkoordinaten
och sampla flera texturvärden runt det aktuella. Sedan kan vi skapa intressanta effekter genom att kombinera dem på
kreativa sätt.

En *kernel* (eller faltningsmatris) är en liten matrisliknande array av värden centrerad kring den aktuella pixeln, som
multiplicerar de omgivande pixelvärdena med sina kernelvärden och lägger ihop dem till ett enda värde. Vi lägger till
en liten förskjutning till texturkoordinaterna i riktningarna runt den aktuella pixeln och kombinerar resultaten
utifrån kerneln. Ett exempel på en kernel:

```text
 2   2   2
 2 -15   2
 2   2   2
```

Den här kerneln tar 8 omgivande pixelvärden och multiplicerar dem med `2`, och den aktuella pixeln med `-15`.
Exempelkerneln multiplicerar de omgivande pixlarna med vikter som bestäms i kerneln och balanserar resultatet genom att
multiplicera den aktuella pixeln med en stor negativ vikt.

De flesta kernlar du hittar på internet summerar till `1` om du lägger ihop alla vikterna. Om de inte summerar till `1`
blir den resulterande texturfärgen ljusare eller mörkare än det ursprungliga texturvärdet.

Kernlar är ett extremt användbart verktyg för post-processing, eftersom de är ganska lätta att använda och
experimentera med, och många exempel finns på nätet. Vi behöver anpassa fragment shadern lite för att den faktiskt ska
stödja kernlar. Vi utgår från att varje kernel vi använder är en 3×3-kernel (vilket de flesta kernlar är):

:::opengl
```glsl
const float offset = 1.0 / 300.0; // the distance to the neighbouring samples

void main()
{
    vec2 offsets[9] = vec2[](
        vec2(-offset,  offset), // top-left
        vec2( 0.0,     offset), // top-center
        vec2( offset,  offset), // top-right
        vec2(-offset,  0.0),    // center-left
        vec2( 0.0,     0.0),    // center-center
        vec2( offset,  0.0),    // center-right
        vec2(-offset, -offset), // bottom-left
        vec2( 0.0,    -offset), // bottom-center
        vec2( offset, -offset)  // bottom-right
    );

    float kernel[9] = float[](
        -1.0, -1.0, -1.0,
        -1.0,  9.0, -1.0,
        -1.0, -1.0, -1.0
    );

    vec3 sampleTex[9];
    for(int i = 0; i < 9; i++)
    {
        sampleTex[i] = vec3(texture(screenTexture, TexCoords.st + offsets[i]));
    }
    vec3 col = vec3(0.0);
    for(int i = 0; i < 9; i++)
        col += sampleTex[i] * kernel[i];

    FragColor = vec4(col, 1.0);
}
```

I fragment shadern skapar vi först en array med 9 `vec2`-förskjutningar, en för varje omgivande texturkoordinat.
Förskjutningen är ett konstant värde som du kan anpassa efter tycke och smak. Sedan definierar vi kerneln, som i det
här fallet är en *skärpekernel* (sharpen) som gör varje färgvärde skarpare genom att sampla alla omgivande pixlar på ett
intressant sätt. Till sist lägger vi till varje förskjutning till den aktuella texturkoordinaten när vi samplar, och
multiplicerar texturvärdena med de viktade kernelvärdena som vi lägger ihop. I OpenGL växer v uppåt, så den översta
raden samples ligger på `+offset`.
:::
:::vulkan
```glsl
const float offset = 1.0 / 300.0; // the distance to the neighbouring samples

void main() {
    // in Vulkan v points down in an image: -offset is the row above
    vec2 offsets[9] = vec2[](
        vec2(-offset, -offset), // top-left
        vec2( 0.0,    -offset), // top-center
        vec2( offset, -offset), // top-right
        vec2(-offset,  0.0),    // center-left
        vec2( 0.0,     0.0),    // center-center
        vec2( offset,  0.0),    // center-right
        vec2(-offset,  offset), // bottom-left
        vec2( 0.0,     offset), // bottom-center
        vec2( offset,  offset)  // bottom-right
    );

    float kernel[9] = float[](
        -1.0, -1.0, -1.0,
        -1.0,  9.0, -1.0,
        -1.0, -1.0, -1.0
    );

    vec3 sampleTex[9];
    for (int i = 0; i < 9; i++) {
        sampleTex[i] = vec3(texture(screenTexture, fragTexCoord.st + offsets[i]));
    }
    vec3 col = vec3(0.0);
    for (int i = 0; i < 9; i++) {
        col += sampleTex[i] * kernel[i];
    }

    outColor = vec4(col, 1.0);
}
```

I fragment shadern skapar vi först en array med 9 `vec2`-förskjutningar, en för varje omgivande texturkoordinat.
Förskjutningen är ett konstant värde som du kan anpassa efter tycke och smak. Sedan definierar vi kerneln, som i det
här fallet är en *skärpekernel* (sharpen) som gör varje färgvärde skarpare genom att sampla alla omgivande pixlar på ett
intressant sätt. Till sist lägger vi till varje förskjutning till den aktuella texturkoordinaten när vi samplar, och
multiplicerar texturvärdena med de viktade kernelvärdena som vi lägger ihop.

En detalj skiljer sig från learnopengls shader: i en Vulkan-image pekar v nedåt, så raden ovanför den aktuella pixeln
ligger på `-offset`, och den översta raden i `offsets` har `-offset` i y där learnopengl har `+offset`. För det här
kapitlets kernlar spelar det ingen roll – de är alla symmetriska uppifrån och ned – men för en kernel som inte är det
spelar ordningen roll.
:::
:::d3d12
```hlsl
// The distance to the neighbouring samples, in texture coordinates.
static const float offset = 1.0f / 300.0f;

// The pixel shader: the colour of the window's pixel.
float4 PSMain(PSInput input) : SV_TARGET
{
    // The 3x3 samples around the pixel. v grows downwards in Direct3D, so the top row
    // is at -offset (learnopengl's GLSL, where v grows upwards, has +offset there).
    float2 offsets[9] =
    {
        float2(-offset, -offset),    // top-left
        float2( 0.0f,   -offset),    // top-center
        float2( offset, -offset),    // top-right
        float2(-offset,  0.0f),      // center-left
        float2( 0.0f,    0.0f),      // center-center
        float2( offset,  0.0f),      // center-right
        float2(-offset,  offset),    // bottom-left
        float2( 0.0f,    offset),    // bottom-center
        float2( offset,  offset)     // bottom-right
    };

    // The kernel: how much each sample counts.
    float kernel[9] =
    {
        -1.0f, -1.0f, -1.0f,
        -1.0f,  9.0f, -1.0f,
        -1.0f, -1.0f, -1.0f
    };

    float3 sampleTex[9];
    for (int i = 0; i < 9; i++)
    {
        sampleTex[i] = screenTexture.Sample(wrapSampler, input.texCoord + offsets[i]).rgb;
    }
    float3 col = float3(0.0f, 0.0f, 0.0f);
    for (int k = 0; k < 9; k++)
        col += sampleTex[k] * kernel[k];

    return float4(col, 1.0f);
}
```

I pixel shadern skapar vi först en array med 9 `float2`-förskjutningar, en för varje omgivande texturkoordinat.
Förskjutningen är ett konstant värde som du kan anpassa efter tycke och smak (`static const` gör den till en konstant i
shadern, inte ett värde i en constant buffer). Sedan definierar vi kerneln, som i det här fallet är en *skärpekernel*
(sharpen) som gör varje färgvärde skarpare genom att sampla alla omgivande pixlar på ett intressant sätt. Till sist
lägger vi till varje förskjutning till den aktuella texturkoordinaten när vi samplar, och multiplicerar texturvärdena
med de viktade kernelvärdena som vi lägger ihop.

Två detaljer skiljer sig från learnopengls GLSL: HLSL initierar arrayer med klammerparenteser, `{ … }`, där GLSL skriver
`vec2[](…)`; och i Direct3D växer v nedåt, så raden ovanför den aktuella pixeln ligger på `-offset`, och den översta
raden i `offsets` har `-offset` i y där learnopengl har `+offset`. För det här kapitlets kernlar spelar det ingen roll
– de är alla symmetriska uppifrån och ned – men för en kernel som inte är det spelar ordningen roll.
:::

Just den här skärpekerneln ser ut så här:

```text
-1  -1  -1
-1   9  -1
-1  -1  -1
```

Dess vikter summerar till 9 − 8 = 1: där alla nio samples har samma färg blir resultatet den färgen. Där mitten skiljer
sig från sina grannar förstärks skillnaden åttafalt.

Gör uppgiften **sharpen** och tryck på **Build & run**. Färgerna är tillbaka, och bakgrunden och golvets jämna partier
ser ut som förut – men varje kant är hård: marmorns mörka ådror blir svarta, ljusa pixlar bredvid dem blir nästan vita,
kuberna får ljusa kanter, och golvets mönster ser kornigt ut. Det kan ge intressanta effekter om din spelare är ute på
ett narkotiskt äventyr.

```quiz
Varför lämnar skärpekerneln den jämnt mörkgrå bakgrunden oförändrad, medan den gör marmorns ådror svarta?
- [ ] Bakgrunden ingår inte i scenens textur
- [ ] Kerneln verkar bara på pixlar som ritades med en textur
- [x] Dess vikter summerar till 1: där alla nio samples är lika blir resultatet den färgen, men en pixel som är mörkare än sina grannar får skillnaden förstärkt
- [ ] Förskjutningen 1/300 är för liten för att nå bakgrundens grannar
---
I ett jämnt område blir 9 · c − 8 · c = c. Vid en åder är mitten mörkare än sina åtta grannar, så 9 · mitten − (summan av grannarna) blir mycket mörkare – det klampas till svart.
```

### Oskärpa

En kernel som ger en *oskärpe*effekt (blur) definieras så här:

```text
1   2   1
2   4   2   / 16
1   2   1
```

Eftersom alla värden summerar till 16 skulle de kombinerade samplade färgerna bli extremt ljusa om vi returnerade dem
direkt, så vi måste dela varje värde i kerneln med `16`. Den resulterande kernel-arrayen blir då:

:::opengl vulkan
```glsl
    float kernel[9] = float[](
        1.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0,
        2.0 / 16.0, 4.0 / 16.0, 2.0 / 16.0,
        1.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0
    );
```
:::
:::d3d12
```hlsl
    float kernel[9] =
    {
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f,
        2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f
    };
```
:::

Genom att bara ändra kernel-arrayen i fragment shadern kan vi helt ändra post-processing-effekten. Gör uppgiften
**blur** och tryck på **Build & run**: bilden ser ut som startbilden, lätt suddig – marmorns ådror har mjukats upp och
kubernas konturer är inte längre skarpa.

En sådan oskärpeeffekt ger intressanta möjligheter. Vi kan variera mängden oskärpa över tid för att skapa effekten av
att någon är berusad, eller öka oskärpan när huvudpersonen inte har på sig sina glasögon. Oskärpa kan också vara ett
användbart verktyg för att jämna ut färgvärden, vilket vi kommer att använda i senare kapitel.

Du ser att när vi väl har en sådan liten kernelimplementation på plats är det ganska enkelt att skapa coola
post-processing-effekter. Vi visar en sista populär effekt för att avsluta genomgången.

### Kantdetektering

Nedan finns en kernel för *kantdetektering* (edge detection) som liknar skärpekerneln:

```text
1   1   1
1  -8   1
1   1   1
```

Den här kerneln framhäver alla kanter och gör resten mörkt, vilket är ganska användbart när vi bara bryr oss om
kanterna i en bild. Dess vikter summerar till 0: överallt där alla nio samples är lika blir resultatet svart.

:::opengl vulkan
```glsl
    float kernel[9] = float[](
        1.0,  1.0, 1.0,
        1.0, -8.0, 1.0,
        1.0,  1.0, 1.0
    );
```
:::
:::d3d12
```hlsl
    float kernel[9] =
    {
        1.0f,  1.0f, 1.0f,
        1.0f, -8.0f, 1.0f,
        1.0f,  1.0f, 1.0f
    };
```
:::

Gör den sista uppgiften, **edge-detection**, och tryck på **Build & run**. Nästan allt är svart nu: bakgrunden,
golvets jämna partier och marmorns släta ytor. Kvar blir ljusa linjer överallt där färgen ändras – kubernas konturer,
marmorns ådror, golvets mönster och horisonten där golvet möter bakgrunden.

Det kommer förmodligen inte som någon överraskning att kernlar som den här används som bildbehandlingsverktyg och
filter i program som Photoshop. Tack vare grafikkortets förmåga att bearbeta fragment extremt parallellt kan vi
manipulera bilder pixel för pixel i realtid med relativ lätthet. Bildredigeringsprogram använder därför ofta
grafikkortet för bildbehandling.

Om du tittar noga ser du också en ljus linje längs fönstrets allra översta kant, där bilden bara visar svart bakgrund.
Samplern som vår skärmtextur läses med upprepar texturen, som varje sampler vi har använt:

:::opengl
vi satte aldrig `GL_TEXTURE_WRAP_S` och `GL_TEXTURE_WRAP_T` för `textureColorbuffer`, så de behåller sitt
standardvärde, `GL_REPEAT`.
:::
:::vulkan
`screenDescriptorSet` använder `textureSampler`, skapad med `VK_SAMPLER_ADDRESS_MODE_REPEAT`.
:::
:::d3d12
`wrapSampler`, den statiska samplern `s0`, använder `D3D12_TEXTURE_ADDRESS_MODE_WRAP`.
:::

För den översta pixelraden ligger de samples som är en rad högre upp utanför texturen och slår runt till dess nedersta
rad – golvet. Kerneln ser då en stor skillnad och ritar en kant som inte finns. learnopengls bild har samma linjer. En
sampler som clampar mot kanten skulle undvika dem, som med gräset i kapitlet *Blending*.

```quiz
Varför syns en ljus linje längs fönstrets överkant med kantdetekteringskerneln, där scenen bara visar svart bakgrund?
- [ ] Bakgrundsfärgen är inte jämn i fönstrets överkant
- [ ] Skärmquaden når inte ända upp, så den vita clear-färgen lyser igenom
- [x] Texturen samplas med repeat: de samples som ligger ovanför den översta raden slår runt till den nedersta raden, golvet, och kerneln ser en kant
---
Kerneln behöver grannar för varje pixel. Vid kanterna avgör adresseringsläget vad "utanför" betyder: repeat hämtar in bildens motsatta sida, clamp to edge skulle upprepa kantpixeln själv, vilket inte ger någon falsk kant.
```

## Övningar

- Kan du använda framebuffers för att skapa en backspegel? Då måste du rita scenen två gånger: en gång med kameran
  vriden 180 grader och en gång som vanligt. Försök skapa en liten quad överst på skärmen att lägga spegeltexturen på.
- Lek med kernelvärdena och skapa dina egna intressanta post-processing-effekter. Sök också på internet efter andra
  intressanta kernlar.

:::opengl
Till spegeln kan du använda det här kapitlets framebuffer för den vridna vyn (en view-matris som tittar längs
`-cameraFront`), rita den vanliga scenen direkt i default framebuffer, och sist rita en liten quad – med hörnen till
exempel på x från -0.3 till 0.3 och y från 0.6 till 0.95 – med `textureColorbuffer`, med djuptestet avstängt.
:::
:::vulkan
Till spegeln kan du använda det här kapitlets offscreen-pass för den vridna vyn (en andra view-matris som tittar längs
`-cameraFront`, i en andra uniform buffer eller en push constant), rita den vanliga scenen i fönstrets render pass –
som då behöver scenens shadrar i en pipeline för `renderPass` – och sist rita en liten quad, med hörnen till exempel på
x från -0.3 till 0.3 och y från -0.95 till -0.6 (fönstrets överkant i Vulkan), med offscreen-imagen.
:::
:::d3d12
Till spegeln kan du använda det här kapitlets off-screen-render target för den vridna vyn (en andra view-matris som
tittar längs `-cameraFront`, i en andra constant buffer), rita den vanliga scenen i back buffern med djupbuffern, och
sist rita en liten quad – med hörnen till exempel på x från -0.3 till 0.3 och y från 0.6 till 0.95 – med
off-screen-texturen. Scenens andra pass behöver att djupbuffern rensas igen innan den börjar.
:::

I nästa kapitel stannar vi vid texturer som är mer än en platt bild: *cube maps*, sex bilder som tillsammans omger hela
scenen.
