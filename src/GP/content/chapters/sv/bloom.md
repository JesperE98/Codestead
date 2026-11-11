# Bloom

Starka ljuskällor och starkt belysta områden är ofta svåra att förmedla till betraktaren, eftersom en bildskärms
intensitetsomfång är begränsat. Ett sätt att skilja ut starka ljuskällor på en skärm är att låta dem glöda; deras ljus
läcker då ut runt ljuskällan. Det ger effektivt betraktaren illusionen att ljuskällorna eller de ljusa områdena är
intensivt ljusa. Tänk på en gatlykta på natten sedd genom en kamera, eller solen genom ett dammigt fönster: ljuset verkar
spilla över på det som finns runt omkring.

Den här ljusläckan, eller glödeffekten, åstadkoms med en efterbehandlingseffekt som kallas *bloom*. Bloom ger alla
starkt belysta områden i en scen en glödande effekt. Utan den är en ljuskub från de senaste kapitlen bara en vit kvadrat;
med den glöder kvadraten, och ögat uppfattar den som ett ljus.

Bloom fungerar bäst tillsammans med HDR-rendering. En vanlig missuppfattning är att HDR är samma sak som bloom, eftersom
många använder begreppen omväxlande. De är dock helt olika tekniker med olika syften. Det går att implementera bloom med
vanliga framebuffers med 8 bitars precision, precis som det går att använda HDR utan bloom-effekten. Det är bara så att
HDR gör bloom effektivare att implementera: med HDR har "ljus" en naturlig betydelse – ljusare än 1.0, det fönstret inte
kan visa – och tröskeln som avgör vad som glöder är lätt att styra.

För att implementera bloom renderar vi en belyst scen som vanligt och tar ut både scenens HDR-färgbuffer och en bild av
scenen där bara de ljusa områdena syns. Den uttagna ljusbilden blurras sedan, och resultatet läggs ovanpå den
ursprungliga HDR-bilden av scenen. Steg för steg:

1. Rendera scenen i en flyttals-framebuffer, som i förra kapitlet – och skriv samtidigt de fragment vars ljusstyrka
   överstiger 1.0 i en andra färgbuffer, svart överallt annars.
2. Blurra den andra buffern – en gaussisk blur, gjord i flera pass.
3. Addera den blurrade bilden till scenens HDR-färger, och tone mappa och gammakorrigera sedan summan på fönstret.

Inget av detta är en ny mekanism: det är förra kapitlets flyttalsmål plus två saker – att rita i två färgbuffrar på en
gång, och pass som turas om att rita i en buffer och läsa en annan. Alla API:er har båda; det här kapitlet visar hur
{{api}} gör.

Projektet är learnopengls bloom-scen: ett trägolv (kuben på 2 × 2 × 2 skalad till en tunn platta på 25 × 1 × 25) med sex
lådor på och ovanför det, belyst av fyra punktljus som är mycket starkare än i de tidigare kapitlen: vitt (5, 5, 5) på
(0, 0.5, 1.5), rött (10, 0, 0) på (-4, 0.5, -3), blått (0, 0, 15) på (3, 0.5, 1) och grönt (0, 5, 0) på (-0.8, 2.4,
-1). Varje ljus visas också som en liten kub i sin egen färg – värden långt över 1.0. Kameran är learnopengls, på
(0, 0, 5) och tittar längs -z. Båda texturerna läses som sRGB-texturer; belysningen är förra kapitlets (bara diffust ljus,
kvadratisk dämpning, inget omgivningsljus).

:::opengl
Starten är förra kapitlets slutläge med den här scenen: `main.cpp` renderar scenen med `bloom.vs` / `bloom.fs` och
ljuskuberna med `bloom.vs` / `light_box.fs` i `hdrFBO` – en `GL_RGBA16F`-färgtextur, `colorBuffer`, och en
djup-renderbuffer – och ritar sedan `colorBuffer` på learnopengls `renderQuad()` med `bloom_final.vs` /
`bloom_final.fs`, som tone mappar med exponeringskurvan (`exposure` = 1.0) och gammakorrigerar. Färgtexturen klämmer vid
kanten (`GL_CLAMP_TO_EDGE`) – learnopengls kommentar säger varför: "we clamp to the edge as the blur filter would
otherwise sample repeated texture values!". `blur.vs` är klar, `blur.fs` har sina uniformer men dess `main` är en TODO.
:::
:::vulkan
Starten är förra kapitlets slutläge med den här scenen: `recordCommandBuffer()` ritar golvet och de sex lådorna med
`graphicsPipeline` (`shaders/bloom.vert` / `.frag`) och ljuskuberna med `lightPipeline` (`bloom.vert` /
`light_box.frag`) i `hdrRenderPass` – en `VK_FORMAT_R16G16B16A16_SFLOAT`-färgbild och en djupbild – och sedan
skärmfyrhörningen (vertex 36..41) i fönstret med `bloomFinalPipeline` (`bloom_final.frag`), som tone mappar med
exponeringskurvan (`ubo.exposure` = 1.0) och gammakorrigerar. Push constants är `struct PushConstants { glm::mat4 model;
glm::vec3 lightColor; }` i ett enda intervall för vertex- **och** fragmentsteget (modellmatrisen för `bloom.vert`,
ljusets färg för `light_box.frag`); push constants läggs ut som std430, så `vec3`:n ligger direkt efter `mat4`:n, på
offset 64. Varje textur har sitt descriptor set (`woodDescriptorSet`, `containerDescriptorSet`, `hdrDescriptorSet`);
flyttalsbilderna samplas med `colorBufferSampler`, som klämmer vid kanten (`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`) –
learnopengls kommentar säger varför: "we clamp to the edge as the blur filter would otherwise sample repeated texture
values!". `shaders/blur.vert` är klar; `blur.frag` har sina vikter, men dess push constants och `main` är TODO:er.
:::
:::d3d12
Starten är förra kapitlets slutläge med den här scenen: `PopulateCommandList` anropar `RenderScene()` – golvet och de sex
lådorna med `m_pipelineState` (`bloom.hlsl`), ljuskuberna med `m_lightBoxPipelineState` (`PSMain` i `light_box.hlsl`,
`lightColor`) – i en `R16G16B16A16_FLOAT`-färgbuffer, `m_colorBuffer` (plats `FrameCount` i RTV-heapen, plats 3 i
CBV/SRV-heapen), med djupbuffern; sedan ritar den skärmfyrhörningen (vertex 36–41) i back buffern med
`m_bloomFinalPipelineState` (`bloom_final.hlsl`), som tone mappar med exponeringskurvan (`exposure` = 1.0, en root
constant) och gammakorrigerar. Root-parameter 0 håller root constants för det som ritas – `ModelConstants` (modell,
normalmatris, `lightColor`: 35 värden) för scenen, en enda float för den sista fyrhörningen – och är synlig för alla
shaders. Skärmfyrhörningens pass samplar med den statiska samplern s1: linjär, `D3D12_TEXTURE_ADDRESS_MODE_CLAMP` –
learnopengl klämmer sina färgbuffrar vid kanten "as the blur filter would otherwise sample repeated texture values!".
`blur.hlsl` har sin `VSMain`, sina vikter och cbuffern `BlurConstants`; dess `PSMain` är en TODO som returnerar svart
(filen kompileras inte förrän du behöver den).
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Bygg och kör programmet i din IDE: golvet och lådorna,
den **vita ljuskuben** i mitten ovanför centrum, under den översta lådan, och den **gröna ljuskuben** vid överkanten.
Den röda och den blå ljuskuben syns inte härifrån, men deras ljus färgar golvet och lådornas sidor. Tone mappingen
behåller detaljerna, men ljuskuberna ser inte ut som ljus: de har skarpa kanter, och precis bredvid dem är den svarta
bakgrunden lika svart som överallt annars.

## Att extrahera ljusa färger

Första steget kräver att vi tar ut två bilder ur en renderad scen. Vi kunde rendera scenen två gånger, till var sin
framebuffer med olika shaders, men vi kan också använda ett behändigt knep som heter *Multiple Render Targets* (MRT), som
låter oss ange mer än en utdata från fragment shadern; det gör att vi kan ta ut båda bilderna i ett enda renderingspass.
Genom att ange en plats (location) för varje utdata från fragment shadern styr vi vilken färgbuffer den skriver till –
shadern körs en gång, och var och en av dess utdata hamnar i sin egen färgbuffer.

Vilka fragment är ljusa? Vi tar färgens *luminans* – dess ljusstyrka så som ögat uppfattar den – och jämför den med en
tröskel. Ögat är mycket känsligare för grönt än för rött, och minst för blått, så luminansen väger kanalerna olika:
`dot(color, vec3(0.2126, 0.7152, 0.0722))`, vikterna för sRGB-primärfärgerna (Rec. 709). Först gör vi alltså om
fragmentfärgen till gråskala på det sättet, och om den överstiger 1.0 – en ljusstyrka fönstret inte kan visa – skriver vi
färgen i den andra buffern; annars svart.

```quiz
Den blå ljuskuben har färgen (0, 0, 15). Hamnar den i buffern för ljusa färger?
- [ ] Nej: dess röda och gröna är 0, så dess ljusstyrka är 0
- [x] Ja, men bara precis: 15 × 0.0722 = 1.08, över tröskeln 1.0 – en blå på 13 skulle förbli svart
- [ ] Ja, med ljusstyrkan 15: den största kanalen räknas
- [ ] Nej: tröskeln tillämpas efter tone mappingen, och tone mappade värden överstiger aldrig 1.0
---
Luminansen väger blått minst. Den gröna kuben (0, 5, 0) har 5 × 0.7152 = 3.6, den röda (10, 0, 0) 2.1, den vita (5, 5, 5) 5.0 – alla klart över 1.0.
```

:::opengl
Framebuffern får en andra flyttalsfärgtextur. learnopengl skapar båda i en loop, inkopplade på `GL_COLOR_ATTACHMENT0`
och `GL_COLOR_ATTACHMENT1`:

```cpp
    // create 2 floating point color buffers (1 for normal rendering, other for brightness threshold values)
    unsigned int colorBuffers[2];
    glGenTextures(2, colorBuffers);
    for (unsigned int i = 0; i < 2; i++)
    {
        glBindTexture(GL_TEXTURE_2D, colorBuffers[i]);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);  // we clamp to the edge as the blur filter would otherwise sample repeated texture values!
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        // attach texture to framebuffer
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0 + i, GL_TEXTURE_2D, colorBuffers[i], 0);
    }
```

Vi måste uttryckligen tala om för OpenGL att vi renderar till flera färgbuffrar, med `glDrawBuffers`. OpenGL renderar som
standard bara till en framebuffers första färg-attachment och struntar i alla andra. Vi gör det genom att skicka en array
med de färg-attachments vi vill rendera till i efterföljande operationer:

```cpp
    // tell OpenGL which color attachments we'll use (of this framebuffer) for rendering
    unsigned int attachments[2] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1 };
    glDrawBuffers(2, attachments);
```

När vi renderar i den här framebuffern används, så fort en fragment shader använder layout-platsangivelsen, motsvarande
färgbuffer för fragmentet. I `bloom.fs`:

```glsl
layout (location = 0) out vec4 FragColor;
layout (location = 1) out vec4 BrightColor;
```

och i slutet av `main`:

```glsl
    vec3 result = ambient + lighting;
    // check whether result is higher than some threshold, if so, output as bloom threshold color
    float brightness = dot(result, vec3(0.2126, 0.7152, 0.0722));
    if(brightness > 1.0)
        BrightColor = vec4(result, 1.0);
    else
        BrightColor = vec4(0.0, 0.0, 0.0, 1.0);
    FragColor = vec4(result, 1.0);
```

`light_box.fs` får samma två utdata och samma test på `FragColor.rgb` – ljuskuberna är det som ska glöda mest. Än så
länge visar det sista passet buffern för ljusa färger i stället för scenen: bind `colorBuffers[1]` i pass 3. Gör nu den
första uppgiften, **bright-pass**, och ta bort båda texturerna i slutet (`glDeleteTextures(2, colorBuffers);`).
:::
:::vulkan
I Vulkan är de färgbuffrar en fragment shader skriver till färg-attachments i den aktuella **subpassen**: utdata
`location = n` hamnar i `pColorAttachments[n]` i subpass-beskrivningen. `createHdrRenderPass()` får en andra
färg-attachment precis som den första – `VkAttachmentDescription brightAttachment = colorAttachment;` – och subpassen två
färgreferenser; djup-attachmenten flyttar till index 2:

```cpp
        // the fragment shader's outputs: location 0 -> attachment 0, location 1 -> attachment 1 (learnopengl's
        // glDrawBuffers(2, attachments))
        std::array<VkAttachmentReference, 2> colorAttachmentRefs{};
        colorAttachmentRefs[0].attachment = 0;
        colorAttachmentRefs[0].layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
        colorAttachmentRefs[1].attachment = 1;
        colorAttachmentRefs[1].layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

        VkAttachmentReference depthAttachmentRef{};
        depthAttachmentRef.attachment = 2;
        depthAttachmentRef.layout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;

        VkSubpassDescription subpass{};
        subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
        subpass.colorAttachmentCount = static_cast<uint32_t>(colorAttachmentRefs.size());
        subpass.pColorAttachments = colorAttachmentRefs.data();
        subpass.pDepthStencilAttachment = &depthAttachmentRef;
```

med `std::array<VkAttachmentDescription, 3> attachments = {colorAttachment, brightAttachment, depthAttachment};`.
`createHdrFramebuffer()` skapar den ljusa bilden som färgbilden (`brightColorImage`, `brightColorImageMemory`,
`brightColorImageView`: flyttalsformatet, färg-attachment + samplad), och framebuffern får tre views i samma ordning:
`hdrColorImageView, brightColorImageView, hdrDepthImageView`. Render passen rensar tre attachments, så
`recordCommandBuffer()` skickar tre rensningsvärden: två svarta färger och djupet 1.0.

Det finns ett ställe till som måste känna till antalet färg-attachments: pipelinen. Dess färgblandningstillstånd har en
`VkPipelineColorBlendAttachmentState` per färg-attachment i subpassen, och antalen måste vara lika. Så `createPipeline`
får en parameter `colorAttachmentCount` och en array av blandningstillstånd, alla likadana (ingen blandning):

```cpp
        // one blend state per colour attachment of the subpass (up to 2 here), all the same: no blending
        std::array<VkPipelineColorBlendAttachmentState, 2> colorBlendAttachments{};
        for (auto& colorBlendAttachment : colorBlendAttachments) {
            colorBlendAttachment.colorWriteMask = VK_COLOR_COMPONENT_R_BIT | VK_COLOR_COMPONENT_G_BIT | VK_COLOR_COMPONENT_B_BIT | VK_COLOR_COMPONENT_A_BIT;
            colorBlendAttachment.blendEnable = VK_FALSE;
        }
```

```cpp
        colorBlending.attachmentCount = colorAttachmentCount; // as many as the render pass's subpass has
        colorBlending.pAttachments = colorBlendAttachments.data();
```

Scenens två pipelines skapas med 2, den sista (fönstret har en färg-attachment) med 1:

```cpp
        createPipeline("shaders/bloom.vert.spv", "shaders/bloom.frag.spv", hdrRenderPass, 2, graphicsPipeline);
        createPipeline("shaders/bloom.vert.spv", "shaders/light_box.frag.spv", hdrRenderPass, 2, lightPipeline);
```

I `bloom.frag` en andra utdata:

```glsl
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 brightColor; // the second colour attachment
```

och i slutet av `main`:

```glsl
    // check whether result is higher than some threshold, if so, output as bloom threshold color
    float brightness = dot(result, vec3(0.2126, 0.7152, 0.0722));
    if (brightness > 1.0)
        brightColor = vec4(result, 1.0);
    else
        brightColor = vec4(0.0, 0.0, 0.0, 1.0);
    outColor = vec4(result, 1.0);
```

`light_box.frag` får samma utdata och samma test på `outColor.rgb` – ljuskuberna är det som ska glöda mest. Än så länge
visar det sista passet den ljusa bilden i stället för scenen: ett nytt `brightDescriptorSet` =
`createDescriptorSet(brightColorImageView, colorBufferSampler, brightDescriptorSet)` (poolen växer till 4 set: 4
uniformbuffrar, 4 samplers, `maxSets = 4`), bundet för det sista passet i stället för `hdrDescriptorSet`. Gör nu den
första uppgiften, **bright-pass**, och förstör den ljusa bildens view, bild och minne i `cleanup()`.
:::
:::d3d12
I Direct3D 12 binder `OMSetRenderTargets` upp till åtta render target views på en gång, och en pixel shader skriver till
dem via semantikerna `SV_TARGET0`, `SV_TARGET1`, … – `SV_TARGET` ensamt betyder `SV_TARGET0`. Färgbuffern blir två,
skapade i en loop – RTV:erna efter swap chainens buffrar (platserna `FrameCount` och `FrameCount + 1`, så RTV-heapen
behöver `FrameCount + 2`), SRV:erna på platserna 3 och 4 i CBV/SRV-heapen (som behöver 5):

```cpp
        for (UINT i = 0; i < 2; i++)
        {
            ThrowIfFailed(m_device->CreateCommittedResource(
                &heapProperties,
                D3D12_HEAP_FLAG_NONE,
                &textureDesc,
                D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
                &clearValue,
                IID_PPV_ARGS(&m_colorBuffers[i])));

            // A render target view, to draw into it: in the RTV heap after the swap chain's
            // buffers (slots FrameCount and FrameCount + 1).
            CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + i, m_rtvDescriptorSize);
            m_device->CreateRenderTargetView(m_colorBuffers[i].Get(), nullptr, rtvHandle);

            // A shader resource view, to read it: slots 3 and 4 of the CBV/SRV heap.
            CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 3 + i, m_cbvSrvDescriptorSize);
            m_device->CreateShaderResourceView(m_colorBuffers[i].Get(), &srvDesc, srvHandle);
        }
```

PSO:t måste veta hur många render targets det skriver och deras format. Scenens PSO – och ljuskubernas, som skapas från
samma beskrivning med en annan pixel shader – renderar i två:

```cpp
        psoDesc.NumRenderTargets = 2;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_R16G16B16A16_FLOAT;
```

Den sista fyrhörningens PSO, skapat från samma beskrivning, sätter `NumRenderTargets = 1` och `RTVFormats[1] =
DXGI_FORMAT_UNKNOWN` igen: efter `NumRenderTargets` förväntas formaten vara `UNKNOWN`. Blandningstillståndet behöver
ingen ändring: `CD3DX12_BLEND_DESC(D3D12_DEFAULT)` har `IndependentBlendEnable = FALSE`, vilket tillämpar
`RenderTarget[0]`:s inställningar (ingen blandning) på varje render target.

I `PopulateCommandList` behöver båda buffrarna sina barriärer – `ResourceBarrier` tar en array – och båda RTV:erna binds i
ett enda anrop:

```cpp
    CD3DX12_RESOURCE_BARRIER barriers[2] =
    {
        CD3DX12_RESOURCE_BARRIER::Transition(m_colorBuffers[0].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET),
        CD3DX12_RESOURCE_BARRIER::Transition(m_colorBuffers[1].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET)
    };
    m_commandList->ResourceBarrier(2, barriers);

    CD3DX12_CPU_DESCRIPTOR_HANDLE hdrRtvHandles[2] =
    {
        CD3DX12_CPU_DESCRIPTOR_HANDLE(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize),
        CD3DX12_CPU_DESCRIPTOR_HANDLE(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 1, m_rtvDescriptorSize)
    };
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(2, hdrRtvHandles, FALSE, &dsvHandle);
```

`FALSE` säger att `hdrRtvHandles` är en array av separata handles; med `TRUE` vore det ett enda handle till den första av
flera på varandra följande descriptors i heapen. Båda RTV:erna rensas, och efter `RenderScene()` går de två barriärerna
åt andra hållet. I `bloom.hlsl` returnerar pixel shadern en struct med en medlem per render target:

```hlsl
struct PSOutput
{
    float4 FragColor : SV_TARGET0;      // the scene (colour buffer 0)
    float4 BrightColor : SV_TARGET1;    // only its bright parts (colour buffer 1)
};
```

och `PSOutput PSMain(PSInput input)` slutar med

```hlsl
    PSOutput output;
    // check whether result is higher than some threshold, if so, output as bloom threshold color
    float brightness = dot(result, float3(0.2126f, 0.7152f, 0.0722f));
    if (brightness > 1.0f)
        output.BrightColor = float4(result, 1.0f);
    else
        output.BrightColor = float4(0.0f, 0.0f, 0.0f, 1.0f);
    output.FragColor = float4(result, 1.0f);
    return output;
```

`light_box.hlsl` får samma struct och samma test på `output.FragColor.rgb` – ljuskuberna är det som ska glöda mest. Än
så länge visar det sista passet buffern för ljusa färger i stället för scenen: dess descriptor table (root-parameter 2)
pekar på plats 4. Gör nu den första uppgiften, **bright-pass**.
:::

:::opengl
```quiz
`bloom.fs` skriver `layout (location = 1) out vec4 BrightColor;`. Vad gör att värdet hamnar i `colorBuffers[1]`?
- [ ] Namnet `BrightColor`: OpenGL matchar utdata mot attachments efter namn
- [ ] Inget mer: varje utdata går till varje färg-attachment
- [x] Plats 1 är andra posten i listan med draw buffers, `glDrawBuffers(2, attachments)` med `GL_COLOR_ATTACHMENT1` där, och `colorBuffers[1]` är inkopplad på `GL_COLOR_ATTACHMENT1`
- [ ] `glActiveTexture(GL_TEXTURE1)` före draw-anropet
---
Utan `glDrawBuffers` ritar en framebuffer bara i `GL_COLOR_ATTACHMENT0`, och den andra utdatan skulle gå förlorad.
```
:::
:::vulkan
```quiz
`bloom.frag` skriver `layout(location = 1) out vec4 brightColor;`. Vad måste stämma med det?
- [x] Subpassens `pColorAttachments[1]` är den ljusa attachmenten, framebufferns view på det attachment-indexet är den ljusa bilden, och pipelinen har ett blandningstillstånd för var och en av subpassens två färg-attachments
- [ ] Bara shadern: Vulkan hittar attachmenten efter utdatans namn
- [ ] Descriptor setet: den ljusa bilden måste vara bunden på binding 1
- [ ] Inget: den andra utdatan går till djup-attachmenten
---
Utdata på plats n skriver `pColorAttachments[n]`. Pipelinens `colorBlending.attachmentCount` måste vara lika med subpassens `colorAttachmentCount` – därför tar `createPipeline` det nu.
```
:::
:::d3d12
```quiz
Pixel shadern i `bloom.hlsl` returnerar `float4 BrightColor : SV_TARGET1`. Vad måste stämma med det?
- [ ] Bara shadern: semantiken väljer resursen efter namn
- [ ] Root signaturen: en descriptor table med den ljusa bufferns RTV
- [ ] `BrightColor` måste vara structens första medlem
- [x] PSO:t har `NumRenderTargets = 2` och `RTVFormats[1] = DXGI_FORMAT_R16G16B16A16_FLOAT`, och `OMSetRenderTargets(2, …)` binder den ljusa bufferns RTV som andra render target
---
`SV_TARGETn` skriver det n:te bundna render targetet. Render target views binds med `OMSetRenderTargets`, inte via root signaturen.
```
:::

Bygg och kör: fönstret visar **bara de ljusa delarna**, tone mappade, mot svart. Ljuskuberna finns där, den vita och den
gröna; stålramen på lådan precis ovanför det vita ljuset; en ljus kant på den stora lådan nere till vänster, den som
vetter mot det vita ljuset; och små prickar – ramarnas nitar där ljuset faller på dem. Allt annat är svart. Till och med
golvets belysta fläck under det vita ljuset förblir svart: den är ljus, men dess luminans stannar under 1.0. Kanterna på
de ljusa delarna är fortfarande skarpa.

## Gaussisk blur

Nu när vi har en uttagen ljusbild behöver vi blurra den. Vi kunde göra det med ett enkelt lådfilter, som i
efterbehandlingsavsnittet i kapitlet *Framebuffers*, men vi använder hellre ett mer avancerat (och snyggare) blurfilter
som kallas *gaussisk blur*.

Gaussisk blur bygger på gausskurvan, som ofta beskrivs som en klockformad kurva med höga värden nära mitten som gradvis
avtar med avståndet. Eftersom gausskurvan har en större yta nära mitten ger dess värden, använda som vikter för att
blurra en bild, mer naturliga resultat, eftersom samplingar nära mitten får högre företräde. Samplar vi till exempel en
ruta på 32 × 32 runt ett fragment använder vi allt mindre vikter ju längre bort från fragmentet vi kommer; det ger en
bättre och mer realistisk blur, som kallas gaussisk blur.

För att implementera ett gaussiskt blurfilter skulle vi behöva en tvådimensionell ruta med vikter, som vi kan få från en
tvådimensionell gausskurva. Problemet med det är att det snabbt blir extremt tungt för prestandan: med en blurkärna på 32
gånger 32, till exempel, skulle vi behöva sampla en textur sammanlagt 1024 gånger för varje fragment!

Som tur är har gausskurvan en mycket behändig egenskap som låter oss dela upp den tvådimensionella ekvationen i två
mindre endimensionella: en som beskriver de horisontella vikterna och en som beskriver de vertikala. Vi gör då först en
horisontell blur med de horisontella vikterna på scentexturen, och sedan en vertikal blur på den resulterande texturen.
Tack vare den egenskapen blir resultatet exakt detsamma, men vi sparar enormt mycket prestanda eftersom vi nu bara behöver
32 + 32 samplingar i stället för 1024! Det kallas *gaussisk blur i två pass*.

Vår kärna samplar fragmentet självt och 4 grannar på varje sida – 9 samplingar per riktning, med fem vikter:
0.2270270270 för mitten, sedan 0.1945945946, 0.1216216216, 0.0540540541 och 0.0162162162 för grannarna 1 till 4 texlar
bort. Summan är 1.0 (mitten en gång, de andra två gånger), så bluren ändrar inte bildens totala ljusstyrka. (De är
binomialkoefficienterna 924, 792, 495, 220 och 66 från rad 12 i Pascals triangel, delade med sin summa 4070 –
binomialkoefficienter är en god approximation av en gausskurva.) En texel är `1.0` delat med texturens storlek i texlar.

```quiz
Varför körs bluren som separata horisontella och vertikala pass?
- [ ] En shader kan bara läsa texlar i en riktning per pass
- [ ] Det vertikala passet rättar till färgerna från det horisontella
- [ ] Texturen klämmer vid kanten längs bara en axel i taget
- [x] En 2D-gausskurva är produkten av två 1D-gausskurvor, så att blurra längs x och sedan längs y ger samma resultat som hela kärnan på 9 × 9 – med 9 + 9 = 18 samplingar per fragment i stället för 81
---
Besparingen växer med kärnan: för 32 × 32, 64 samplingar i stället för 1024. Priset är ett extra pass och en buffer som håller dess resultat.
```

Det betyder att vi måste blurra en bild minst två gånger, och det fungerar bäst med, återigen, framebuffer-objekt.
Speciellt för den gaussiska bluren i två pass ska vi implementera *ping-pong-framebuffers*. Det är ett par framebuffers
där vi, ett visst antal gånger, renderar den andra framebufferns färgbuffer i den aktuella framebufferns färgbuffer, med
växlande shadereffekt, och byter plats. Vi byter helt enkelt hela tiden vilken framebuffer vi renderar till och vilken
textur vi ritar med. Det låter oss först blurra scenens textur i den första framebuffern, sedan blurra den första
framebufferns färgbuffer i den andra framebuffern, sedan den andra framebufferns färgbuffer i den första, och så vidare.

Varför två? Ett pass kan inte läsa den textur det ritar i – ett fragment skulle läsa texlar som grannfragment i samma pass
kanske redan har skrivit över (API:erna förbjuder det, eller lämnar resultatet odefinierat). Så varje pass läser en buffer
och skriver den andra.

learnopengl gör **10 pass**, med ett horisontellt först: horisontellt, vertikalt, horisontellt, … – fem horisontella och
fem vertikala. Varje par av ett horisontellt och ett vertikalt pass är en gaussisk blur på 9 × 9; att blurra den blurrade
bilden igen gör bluren bredare, så fem par ger ett mycket mjukare, bredare sken än ett. Det första passet läser bufferns
för ljusa färger; varje senare pass läser den buffer det föregående skrev. Arrayerna med två element indexeras med
`bool horizontal`: ett horisontellt pass ritar i buffer 1 (`horizontal` = true = 1) och läser buffer 0 (`!horizontal`),
och sedan växlar `horizontal`. Efter det tionde passet – ett vertikalt i buffer 0 – är `horizontal` true igen, så det
sista resultatet ligger i buffer `[!horizontal]`, buffer 0.

```quiz
Varför behöver bluren två ping-pong-buffrar i stället för att blurra buffern för ljusa färger på plats?
- [x] Ett pass kan inte läsa den textur det ritar i – grannfragment kan redan ha skrivit över texlarna det behöver – så varje pass läser en buffer och skriver den andra
- [ ] Den ena buffern håller det horisontella resultatet för gott och den andra det vertikala
- [ ] Flyttalsbuffrar kan bara skrivas en gång per bildruta
- [ ] Den andra buffern sparar en kopia till nästa bildruta
---
Efter varje pass byter de roller: buffern som just skrevs läses av nästa pass, som skriver den andra. Buffern för ljusa färger läses bara, av det första passet.
```

:::opengl
Blurshadern, i `blur.fs` – learnopengls: vikterna är en uniform-array med initierare, `horizontal` en uniform:

```glsl
void main()
{
    vec2 tex_offset = 1.0 / textureSize(image, 0); // gets size of single texel
    vec3 result = texture(image, TexCoords).rgb * weight[0];
    if(horizontal)
    {
        for(int i = 1; i < 5; ++i)
        {
            result += texture(image, TexCoords + vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
            result += texture(image, TexCoords - vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
        }
    }
    else
    {
        for(int i = 1; i < 5; ++i)
        {
            result += texture(image, TexCoords + vec2(0.0, tex_offset.y * i)).rgb * weight[i];
            result += texture(image, TexCoords - vec2(0.0, tex_offset.y * i)).rgb * weight[i];
        }
    }
    FragColor = vec4(result, 1.0);
}
```

`textureSize(image, 0)` returnerar storleken på texturens mipnivå 0 – 800 × 600 – så `tex_offset` är storleken på en
texel i texturkoordinater. I `main.cpp`, `Shader shaderBlur("blur.vs", "blur.fs");` med `shaderBlur.setInt("image", 0);`,
och ping-pong-framebufferna – två framebuffers med var sin `GL_RGBA16F`-färgtextur och ingen djupbuffer (bluren ritar
bara en fyrhörning):

```cpp
    // ping-pong-framebuffer for blurring
    unsigned int pingpongFBO[2];
    unsigned int pingpongColorbuffers[2];
    glGenFramebuffers(2, pingpongFBO);
    glGenTextures(2, pingpongColorbuffers);
    for (unsigned int i = 0; i < 2; i++)
    {
        glBindFramebuffer(GL_FRAMEBUFFER, pingpongFBO[i]);
        glBindTexture(GL_TEXTURE_2D, pingpongColorbuffers[i]);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE); // we clamp to the edge as the blur filter would otherwise sample repeated texture values!
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, pingpongColorbuffers[i], 0);
        // also check if framebuffers are complete (no need for depth buffer)
        if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
            std::cout << "Framebuffer not complete!" << std::endl;
    }
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Mellan scenen och det sista passet, de 10 blurpassen:

```cpp
        // 2. blur bright fragments with two-pass Gaussian Blur
        // --------------------------------------------------
        bool horizontal = true, first_iteration = true;
        unsigned int amount = 10;
        shaderBlur.use();
        for (unsigned int i = 0; i < amount; i++)
        {
            glBindFramebuffer(GL_FRAMEBUFFER, pingpongFBO[horizontal]);
            shaderBlur.setInt("horizontal", horizontal);
            glBindTexture(GL_TEXTURE_2D, first_iteration ? colorBuffers[1] : pingpongColorbuffers[!horizontal]);  // bind texture of other framebuffer (or scene if first iteration)
            renderQuad();
            horizontal = !horizontal;
            if (first_iteration)
                first_iteration = false;
        }
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Än så länge visar det sista passet det blurrade resultatet: bind `pingpongColorbuffers[!horizontal]` i stället för
`colorBuffers[1]`. Gör nu uppgiften **blur**, och ta bort ping-pong-texturerna och -framebufferna i slutet.
:::
:::vulkan
Blurshadern, `blur.frag`, behöver först blurens riktning. Den är en push constant: `PushConstants` får en
`VkBool32 horizontal;` efter `lightColor` (en GLSL-`bool` är 4 byte, på offset 76 direkt efter `vec3`:n), och shadern
deklarerar blocket fram till den:

```glsl
// the push constants up to horizontal: blur along x (true) or along y (false)
layout(push_constant) uniform PushConstants {
    mat4 model;
    vec3 lightColor;
    bool horizontal;
} pc;
```

Vikterna är en `const float weight[5]` i shadern – learnopengl deklarerar dem som en `uniform`-array med initierare, men
GLSL för Vulkan har inga uniformer utanför block (utom samplers och images), och en konstant array är ju vad de är. Sedan
learnopengls `main`:

```glsl
void main() {
    vec2 tex_offset = 1.0 / textureSize(image, 0); // gets size of single texel
    vec3 result = texture(image, fragTexCoord).rgb * weight[0];
    if (pc.horizontal) {
        for (int i = 1; i < 5; ++i) {
            result += texture(image, fragTexCoord + vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
            result += texture(image, fragTexCoord - vec2(tex_offset.x * i, 0.0)).rgb * weight[i];
        }
    } else {
        for (int i = 1; i < 5; ++i) {
            result += texture(image, fragTexCoord + vec2(0.0, tex_offset.y * i)).rgb * weight[i];
            result += texture(image, fragTexCoord - vec2(0.0, tex_offset.y * i)).rgb * weight[i];
        }
    }
    outColor = vec4(result, 1.0);
}
```

`textureSize(image, 0)` returnerar storleken på bildens mipnivå 0 – 800 × 600 – så `tex_offset` är storleken på en
texel i texturkoordinater.

I Vulkan kan en bild som en render pass ritar i inte samplas i samma render pass – medan passet pågår ligger bilden i
`VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL` – så varje blurpass är en **egen render pass**: `createBlurRenderPass()` har en
flyttalsfärg-attachment och inget djup. Dess gamla innehåll behövs inte – skärmfyrhörningen täcker varje pixel – så
`loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE` och ingenting rensas; den lagras och lämnas i
`VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` för nästa pass:

```cpp
        colorAttachment.format = VK_FORMAT_R16G16B16A16_SFLOAT;
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE; // every pixel is written: no need to clear
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

Dess två subpass dependencies kedjar ihop passen: före ett pass väntar vi tills det tidigare passets fragment shader har
läst färdigt den här bilden (den skrivs igen nu); efter det görs färgskrivningarna synliga för nästa pass fragment shader
(eller det sista passets). `createPingpongFramebuffers()` skapar, i en loop över `i` = 0, 1, en bild
(`VK_FORMAT_R16G16B16A16_SFLOAT`, färg-attachment + samplad), dess view och en framebuffer för `blurRenderPass` – inget
djup behövs:

```cpp
            createImage(swapChainExtent.width, swapChainExtent.height, VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, pingpongImages[i], pingpongImageMemories[i]);
            pingpongImageViews[i] = createImageView(pingpongImages[i], VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_ASPECT_COLOR_BIT);
```

Blurens pipeline görs för blurens render pass, med en färg-attachment –
`createPipeline("shaders/blur.vert.spv", "shaders/blur.frag.spv", blurRenderPass, 1, blurPipeline)` – och varje
ping-pong-bild får ett descriptor set med `colorBufferSampler`, `pingpongDescriptorSets[i]` (poolen växer till 6 set).
I `recordCommandBuffer()`, efter scenens render pass, spelar learnopengls loop in 10 render passes:

```cpp
        bool horizontal = true, first_iteration = true;
        unsigned int amount = 10;
        for (unsigned int i = 0; i < amount; i++) {
            VkRenderPassBeginInfo blurPassInfo{};
            blurPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
            blurPassInfo.renderPass = blurRenderPass;
            blurPassInfo.framebuffer = pingpongFramebuffers[horizontal];
            blurPassInfo.renderArea.offset = {0, 0};
            blurPassInfo.renderArea.extent = swapChainExtent;
            blurPassInfo.clearValueCount = 0; // loadOp DONT_CARE: nothing to clear

            vkCmdBeginRenderPass(commandBuffer, &blurPassInfo, VK_SUBPASS_CONTENTS_INLINE);
            vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, blurPipeline);
            constants.horizontal = horizontal;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);
            // the image of the other framebuffer (or the bright image if first iteration)
            VkDescriptorSet imageDescriptorSet = first_iteration ? brightDescriptorSet : pingpongDescriptorSets[!horizontal];
            vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &imageDescriptorSet, 0, nullptr);
            vkCmdDraw(commandBuffer, 6, 1, 36, 0); // the screen quad
            vkCmdEndRenderPass(commandBuffer);

            horizontal = !horizontal;
            if (first_iteration)
                first_iteration = false;
        }
```

Observera att loopen körs på CPU:n medan command buffern *spelas in*: den spelar in 10 render passes med fasta
framebuffers och descriptor sets, som GPU:n sedan kör i ordning. Än så länge visar det sista passet det blurrade
resultatet: det binder `pingpongDescriptorSets[!horizontal]`. Gör nu uppgiften **blur**, och förstör
ping-pong-framebufferna, deras views, bilder och minne, blurens pipeline och dess render pass i `cleanup()`.
:::
:::d3d12
Blurshadern, `blur.hlsl`. Vikterna finns redan där som `static const float weight[5]` – i HLSL är en global variabel utan
`static` en shaderindata i standard-constant buffern `$Globals`, som applikationen sätter, och dess initierare skulle
inte användas – och riktningen kommer från root constants, `cbuffer BlurConstants : register(b0) { bool horizontal; };`.
Dess `PSMain`:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float width, height;
    image.GetDimensions(width, height);
    float2 tex_offset = 1.0f / float2(width, height); // gets size of single texel
    float3 result = image.Sample(clampSampler, input.texCoord).rgb * weight[0];
    if (horizontal)
    {
        for (int i = 1; i < 5; ++i)
        {
            result += image.Sample(clampSampler, input.texCoord + float2(tex_offset.x * i, 0.0f)).rgb * weight[i];
            result += image.Sample(clampSampler, input.texCoord - float2(tex_offset.x * i, 0.0f)).rgb * weight[i];
        }
    }
    else
    {
        for (int i = 1; i < 5; ++i)
        {
            result += image.Sample(clampSampler, input.texCoord + float2(0.0f, tex_offset.y * i)).rgb * weight[i];
            result += image.Sample(clampSampler, input.texCoord - float2(0.0f, tex_offset.y * i)).rgb * weight[i];
        }
    }
    return float4(result, 1.0f);
}
```

`GetDimensions` är HLSL:s `textureSize`: texturens bredd och höjd i texlar, 800 × 600. Till skillnad från
parallax-loopen i kapitlet *Parallax mapping* har de här looparna ett fast antal varv, 4, så `Sample` går bra i dem.

I `main.cpp` speglar `struct BlurConstants { BOOL horizontal; };` cbuffern. Bluren får ett PSO, `m_blurPipelineState`,
med shaderna i `blur.hlsl`, ett flyttals-render target och inget djup:

```cpp
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(blurVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(blurPixelShader.Get());
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_UNKNOWN;
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_blurPipelineState)));
```

(`RTVFormats[0]` är fortfarande scenens `DXGI_FORMAT_R16G16B16A16_FLOAT`.) De två ping-pong-buffrarna,
`m_pingpongColorbuffers[2]`, skapas som färgbuffrarna – samma beskrivning, med starttillståndet
`D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE` – med RTV:er på platserna `FrameCount + 2 + i` och SRV:er på platserna
`5 + i` (heaparna växer till `FrameCount + 4` och 7 descriptors). I `PopulateCommandList`, mellan scenen och det sista
passet, learnopengls loop – varje pass med sitt barriärpar:

```cpp
    bool horizontal = true, first_iteration = true;
    unsigned int amount = 10;
    m_commandList->SetPipelineState(m_blurPipelineState.Get());
    for (unsigned int i = 0; i < amount; i++)
    {
        // The target: ping-pong buffer [horizontal] (RTV heap slot FrameCount + 2 + horizontal).
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_pingpongColorbuffers[horizontal].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
        m_commandList->ResourceBarrier(1, &barrier);
        CD3DX12_CPU_DESCRIPTOR_HANDLE pingpongRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 2 + horizontal, m_rtvDescriptorSize);
        m_commandList->OMSetRenderTargets(1, &pingpongRtvHandle, FALSE, nullptr);

        BlurConstants blurConstants = {};
        blurConstants.horizontal = horizontal;
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(BlurConstants) / 4, &blurConstants, 0);
        // bind texture of other framebuffer (or scene if first iteration): the bright parts'
        // SRV (heap slot 4) or ping-pong buffer [!horizontal]'s (slot 5 + !horizontal)
        CD3DX12_GPU_DESCRIPTOR_HANDLE image(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), first_iteration ? 4 : 5 + !horizontal, m_cbvSrvDescriptorSize);
        m_commandList->SetGraphicsRootDescriptorTable(2, image);
        m_commandList->DrawInstanced(6, 1, 36, 0);    // the screen quad: vertices 36 to 41

        // Done: the next pass reads it.
        barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_pingpongColorbuffers[horizontal].Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);

        horizontal = !horizontal;
        if (first_iteration)
            first_iteration = false;
    }
```

Barriären tillbaka till `PIXEL_SHADER_RESOURCE` efter varje draw är det som låter nästa pass läsa det det här passet
skrev. Loopen körs på CPU:n medan command listan spelas in: den spelar in 10 draws med fasta descriptors, som GPU:n sedan
kör i ordning. Än så länge visar det sista passet det blurrade resultatet: dess tabell 2 pekar på plats `5 + !horizontal`.
Gör nu uppgiften **blur**.
:::

Bygg och kör: **de ljusa delarna är blurrade**. Mjuka glödande fläckar omger ljuskuberna – vitt runt den vita, grönt
runt den gröna – och stålkanten och nitarna har blivit mjuka band och prickar. Mitten av den vita kuben förblir mättad;
bortom de ljusa delarna är allt fortfarande svart. Titta längs en rad till höger om den vita kuben: där ljusstyrkan föll
från vitt till svart i ett enda steg tonar den nu ut över ett dussin pixlar.

## Att blanda båda texturerna

Med scenens HDR-textur och en blurrad ljustextur av scenen behöver vi bara kombinera de två för att få den ökända bloom-
eller glödeffekten. I den sista fragment shadern blandar vi additivt båda texturerna, före tone mappingen:

```text
hdrColor = scene + bloomBlur
then tone mapping and gamma correction, as before
```

Värt att notera är att vi lägger till bloom-effekten innan vi tillämpar tone mapping. På så sätt omvandlas även bloomens
tillagda ljusstyrka mjukt till LDR-intervallet, med bättre relativ belysning som resultat. Den blurrade ljusstyrkan är ljus
i samma enheter som scenens – den hör till scenens HDR-färg, och summan går genom samma kurva. Där den blurrade texturen
är svart är summan scenen, oförändrad.

```quiz
Varför adderas den blurrade ljusstyrkan till scenen före tone mappingen och inte efteråt?
- [ ] Tone mappingen skulle göra den blurrade texturen svart
- [ ] Att addera efter tone mappingen går inte i en enda shader
- [x] Båda är HDR-ljus i samma enheter: deras summa går genom tone mapping-kurvan, som håller den under 1.0 och blandar in skenet mjukt i scenen; adderat efteråt skulle sken plus scen klippas till vitt igen
- [ ] Bluren fungerar bara på gammakorrigerade värden
---
En tone mappad färg ligger redan nära 1.0 nära ljusen; att lägga till mer ovanpå skulle klämmas av fönstret – HDR-kapitlets problem en gång till.
```

:::opengl
Det sista passet behöver två texturer, alltså två texturenheter: scenen på enhet 0, den blurrade ljusstyrkan på enhet 1.
En gång, i shaderkonfigurationen:

```cpp
    shaderBloomFinal.setInt("scene", 0);
    shaderBloomFinal.setInt("bloomBlur", 1);
```

och i pass 3:

```cpp
        shaderBloomFinal.use();
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, colorBuffers[0]);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, pingpongColorbuffers[!horizontal]);
        shaderBloomFinal.setFloat("exposure", exposure);
        renderQuad();
```

`bloom_final.fs` får `uniform sampler2D bloomBlur;`, och i `main`:

```glsl
    vec3 hdrColor = texture(scene, TexCoords).rgb;
    vec3 bloomColor = texture(bloomBlur, TexCoords).rgb;
    hdrColor += bloomColor; // additive blending
    // tone mapping
    vec3 result = vec3(1.0) - exp(-hdrColor * exposure);
```

Det är learnopengls `bloom_final.fs` utan växeln `bloom` (learnopengl slår av och på bloom med mellanslag). Gör nu den
sista uppgiften, **combine**.
:::
:::vulkan
Det sista passet behöver två bilder på en gång. Descriptor set layouten får en andra combined image sampler på binding 2,
för fragmentsteget:

```cpp
        VkDescriptorSetLayoutBinding bloomBlurLayoutBinding{};
        bloomBlurLayoutBinding.binding = 2;
        bloomBlurLayoutBinding.descriptorCount = 1;
        bloomBlurLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        bloomBlurLayoutBinding.pImmutableSamplers = nullptr;
        bloomBlurLayoutBinding.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;

        std::array<VkDescriptorSetLayoutBinding, 3> bindings = {uboLayoutBinding, samplerLayoutBinding, bloomBlurLayoutBinding};
```

Alla set delar den enda layouten, så varje set har nu en binding 2; i alla utom det sista passets set förblir den tom.
Det är tillåtet så länge ingen shader som körs med de seten läser den – och bara `bloom_final.frag` gör det. En ny
funktion, `createBloomDescriptorSet(sceneImageView, bloomBlurImageView, sampler, descriptorSet)`, är
`createDescriptorSet` med en tredje `VkWriteDescriptorSet` för binding 2. Vilken ping-pong-bild som håller resultatet är
känt när programmet startar – de 10 passen slutar alltid med ett vertikalt pass i bild 0 – så setet kan göras en gång:

```cpp
        // the 10 blur steps end in ping-pong image 0 (the last, vertical step writes into pingpongImages[0])
        createBloomDescriptorSet(hdrColorImageView, pingpongImageViews[0], colorBufferSampler, bloomDescriptorSet);
```

Poolen delar ut descriptors efter vad varje sets layout innehåller: varje set tar nu en uniformbuffer och **två**
combined image samplers, vare sig binding 2 skrivs eller inte. Sju set tar 7 uniformbuffrar och 14 samplers:

```cpp
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        poolSizes[0].descriptorCount = 7;
        poolSizes[1].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[1].descriptorCount = 14;
```

med `maxSets = 7`. Det sista passet binder `bloomDescriptorSet` (scenen kommer nu genom det, så `hdrDescriptorSet` binds
inte längre). `bloom_final.frag` får `layout(binding = 2) uniform sampler2D bloomBlur;`, och i `main`:

```glsl
    vec3 hdrColor = texture(scene, fragTexCoord).rgb;
    vec3 bloomColor = texture(bloomBlur, fragTexCoord).rgb;
    hdrColor += bloomColor; // additive blending
    // tone mapping
    vec3 result = vec3(1.0) - exp(-hdrColor * ubo.exposure);
```

Det är learnopengls `bloom_final.fs` utan växeln `bloom` (learnopengl slår av och på bloom med mellanslag). Gör nu den
sista uppgiften, **combine**.
:::
:::d3d12
Det sista passet behöver två texturer på en gång: scenen på t0 och den blurrade ljusstyrkan på t1. Varje descriptor table
pekar på descriptors som ligger i följd i heapen, så en tabell med två SRV:er skulle kräva att scenens SRV låg direkt före
den blurrades – och vilken ping-pong-buffer som håller resultatet beror på antalet pass. Två tabeller kräver ingen sådan
ordning. Root signaturen får ett tredje intervall och en fjärde root-parameter:

```cpp
        CD3DX12_DESCRIPTOR_RANGE ranges[3];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0);
        ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 1);
```

```cpp
        rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL);
        rootParameters[3].InitAsDescriptorTable(1, &ranges[2], D3D12_SHADER_VISIBILITY_PIXEL);
```

(`CD3DX12_ROOT_PARAMETER rootParameters[4]`). De andra draw-anropen sätter aldrig tabell 3; det går bra, eftersom deras
shaders inte läser t1. Det sista passet sätter båda tabellerna:

```cpp
    m_commandList->SetPipelineState(m_bloomFinalPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE scene(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, scene);
    CD3DX12_GPU_DESCRIPTOR_HANDLE bloomBlur(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 5 + !horizontal, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(3, bloomBlur);
```

`bloom_final.hlsl` får `Texture2D bloomBlur : register(t1);`, och i `PSMain`:

```hlsl
    float3 hdrColor = scene.Sample(clampSampler, input.texCoord).rgb;
    float3 bloomColor = bloomBlur.Sample(clampSampler, input.texCoord).rgb;
    hdrColor += bloomColor; // additive blending
    // tone mapping
    float3 result = float3(1.0f, 1.0f, 1.0f) - exp(-hdrColor * exposure);
```

Det är learnopengls `bloom_final.fs` utan växeln `bloom` (learnopengl slår av och på bloom med mellanslag). Gör nu den
sista uppgiften, **combine**.
:::

:::opengl
```quiz
Hur får `bloom_final.fs` två olika texturer i ett och samma draw-anrop?
- [ ] Den samplar `colorBuffers` som en array med två lager
- [x] Två texturenheter: samplerna `scene` och `bloomBlur` sätts till enhet 0 och 1 med `setInt`, och före draw-anropet binds `colorBuffers[0]` på `GL_TEXTURE0` och `pingpongColorbuffers[!horizontal]` på `GL_TEXTURE1`
- [ ] `glDrawBuffers` med båda texturerna
- [ ] Den andra texturen kopplas in i fönstrets framebuffer
---
En sampler-uniform håller numret på en texturenhet; `glActiveTexture` väljer den enhet som `glBindTexture` binder till.
```
:::
:::vulkan
```quiz
Descriptor set layouten får en andra sampler på binding 2. Varför behöver poolen nu 14 combined image samplers för 7 set?
- [ ] Varje bild behöver två descriptors: en för bilden, en för samplern
- [ ] Bloom-setet behöver 8 samplers, de andra en var
- [x] Varje set allokeras med den enda layouten, som har två combined image samplers – binding 2 räknas även i de sex set som lämnar den tom
- [ ] Ping-pong-bilder behöver dubbelt så många descriptors som andra bilder
---
En pool delar ut det som dess sets layouter innehåller. Att allokera mer än poolen rymmer är ett fel: valideringslagren rapporterar det, och `vkAllocateDescriptorSets` kan returnera `VK_ERROR_OUT_OF_POOL_MEMORY`.
```
:::
:::d3d12
```quiz
Varför använder det sista passet två descriptor tables (root-parameter 2 och 3) i stället för en tabell med två SRV:er?
- [x] En tabell pekar på descriptors i följd: en tabell skulle kräva att scenens SRV låg direkt före den blurrade bufferns, och vilken ping-pong-buffer som håller resultatet beror på antalet pass – två tabeller kan peka var som helst
- [ ] En descriptor table kan bara hålla en descriptor
- [ ] t0 och t1 måste ligga i olika root signatures
- [ ] Två tabeller går snabbare att sätta än en
---
Scenens SRV ligger på plats 3, ping-pong-buffrarnas på 5 och 6: plats 4, buffern för ljusa färger, ligger emellan. Två tabeller kostar en root-parameter till, men ingen omflyttning i heapen.
```
:::

Bygg och kör: scenen är tillbaka, och **ljuskuberna glöder**. Ett mjukt vitt sken sprider sig från den vita kuben över
den svarta bakgrunden och lådan ovanför; den gröna kuben blöder grönt över stålramen bredvid; den stora lådans ljusa
stålkant glöder också. Bortom de ljusa delarna – golvet, lådornas trä, bakgrunden – har ingenting ändrats. Det är
lösningen, och learnopengls bloom.

## Avslutande tankar

Tröskeln avgör vad som glöder, och HDR gör den naturlig: allt som är ljusare än vad fönstret kan visa. I en LDR-scen
skulle du behöva en tröskel under 1.0 och skulle se de ljusa delarna av varje vit vägg glöda också.

Bluren vi använde är learnopengls – en kärna med 9 samplingar, upprepad fem gånger i varje riktning – och dess räckvidd
är begränsad: skenet når några dussin pixlar, och att göra det bredare kräver fler pass, vart och ett över hela skärmen.
En vanlig förbättring är att blurra i lägre upplösningar: skala ner den ljusa bilden till halva, en fjärdedels, en
åttondels storlek, blurra varje nivå och lägg ihop dem igen medan de skalas upp. En blur på några få texlar i en liten
bild täcker många pixlar i den fulla, så skenet kan bli mycket bredare för mindre arbete. learnopengls gästartikel
*Physically Based Bloom* bygger en sådan kedja – och tar bort tröskeln helt och adderar i stället lite av hela den
blurrade scenen, så att ljusa saker inte hoppar från "inget sken" till "sken" när deras ljusstyrka passerar 1.0.

Justera effekten efter smak: tröskeln, antalet blurpass, styrkan som bluren adderas med (en faktor före `+=`). Bloom är
den första av effekterna som tar HDR-bilden som indata; resten av den här delen bygger på samma idé: rendera i flera
buffrar och kombinera dem i ett sista pass.

## Mer att läsa

:::opengl
- [Bloom](https://learnopengl.com/Advanced-Lighting/Bloom): learnopengls kapitel som det här kapitlet följer, med
  bilder av varje steg.
- [bloom.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/7.bloom/bloom.cpp):
  learnopengls program, med tangenterna mellanslag, Q och E.
- [glDrawBuffers](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawBuffers.xhtml): vilka färg-attachments
  fragment shaderns utdata går till.
:::
:::vulkan
- [Bloom](https://learnopengl.com/Advanced-Lighting/Bloom): learnopengls kapitel som det här kapitlet följer, med
  bilder av varje steg.
- [Render passes](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Render_passes):
  vulkan-tutorial om attachments, subpasses och attachment-referenser.
- [Descriptor pool and sets](https://vulkan-tutorial.com/Uniform_buffers/Descriptor_pool_and_sets): vulkan-tutorial om
  descriptor pools och att allokera set.
:::
:::d3d12
- [Bloom](https://learnopengl.com/Advanced-Lighting/Bloom): learnopengls kapitel som det här kapitlet följer, med
  bilder av varje steg.
- [ID3D12GraphicsCommandList::OMSetRenderTargets](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-omsetrendertargets):
  att binda flera render targets, och vad `RTsSingleHandleToDescriptorRange` betyder.
- [Semantics (HLSL)](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-semantics):
  `SV_Target[n]` och de andra systemvärdessemantikerna.
:::
