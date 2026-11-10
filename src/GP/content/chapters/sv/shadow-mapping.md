# Shadow mapping

Skuggor uppstår där ljus saknas på grund av att något skymmer det. När en ljuskällas strålar inte träffar ett objekt
eftersom ett annat objekt är i vägen ligger objektet i skugga. Skuggor tillför mycket realism till en belyst scen och gör
det lättare för betraktaren att uppfatta hur objekten förhåller sig till varandra i rummet. De ger scenen och objekten
ett starkare djup: utan skuggor ser en kub som svävar ovanför golvet och en kub som står på det nästan likadana ut.

Skuggor är dock lite knepiga att implementera, särskilt eftersom realtidsforskningen ännu inte har tagit fram någon
idealisk skuggalgoritm. Det finns flera bra tekniker för att approximera skuggor, men alla har sina små egenheter och
irritationsmoment som vi måste ta hänsyn till.

En teknik som de flesta spel använder, som ger hyggliga resultat och är förhållandevis lätt att implementera, är *shadow
mapping*. Shadow mapping är inte så svårt att förstå, kostar inte så mycket prestanda och kan ganska lätt byggas ut till
mer avancerade algoritmer (som rundstrålande shadow maps och cascaded shadow maps). Som allt i den här delen är det samma
teknik i alla API:er: ett andra render pass plus lite matematik i shadrarna. Det här kapitlet visar var {{api}} lägger
passet och djuptexturen som det ritar i.

:::opengl
Projektet är learnopengls scen: ett stort trägolv (`planeVertices`, 50 × 50 enheter på y = -0.5, `wood.png` upprepad 25
gånger) och tre träkuber som ritas av learnopengls `renderScene(const Shader &shader)` med `renderCube()`: en som svävar
på (0, 1.5, 0), en på (2, 0, 1) och en liten vriden på (-1, 0, 2). Ljuset står på `lightPos` (-2, 4, -1).
`shadow_mapping.vs/.fs` belyser scenen: ljusfärgen 0.3, ambient, diffust och Blinn-Phong-spekulärt, kombinerat som
`(ambient + (1.0 - shadow) * (diffuse + specular)) * color` – med `float shadow = 0.0;` tills vidare. `renderQuad()`, en
fyrhörning som täcker fönstret, finns redan. De nya shadrarna `shadow_mapping_depth.vs/.fs`, `debug_quad.vs` och
`debug_quad_depth.fs` används från första uppgiften.
:::
:::vulkan
Projektet är learnopengls scen: ett stort trägolv (vertex 0..5: 50 × 50 enheter på y = -0.5, `textures/wood.png`
upprepad 25 gånger) och tre träkuber (en kub, vertex 6..41, ritad tre gånger): en som svävar på (0, 1.5, 0), en på
(2, 0, 1) och en liten vriden på (-1, 0, 2). learnopengls `renderScene()` är en hjälpfunktion
`renderScene(VkCommandBuffer commandBuffer)` som pushar varje modellmatris (en push constant, vertexsteget) och spelar in
de fyra draws. Ljuset står på den globala `lightPos` (-2, 4, -1). `shaders/shadow_mapping.vert/.frag` belyser scenen:
ljusfärgen 0.3, ambient, diffust och Blinn-Phong-spekulärt, kombinerat som
`(ambient + (1.0 - shadow) * (diffuse + specular)) * color` – med `float shadow = 0.0;` tills vidare. De nya shadrarna
`shadow_mapping_depth.vert/.frag`, `debug_quad.vert` och `debug_quad_depth.frag` används från första uppgiften.
:::
:::d3d12
Projektet är learnopengls scen: ett stort trägolv (vertex 0–5: 50 × 50 enheter på y = -0.5, `wood.png` upprepad 25
gånger) och tre träkuber (en kub, vertex 6–41, ritad tre gånger): en som svävar på (0, 1.5, 0), en på (2, 0, 1) och en
liten vriden på (-1, 0, 2). `PopulateCommandList` beräknar fyra `ModelConstants` (modellmatrisen och normalmatrisen för
varje objekt) och sätter dem med `SetGraphicsRoot32BitConstants(0, …)` före var och en av de fyra draws – learnopengls
`renderScene()`. Ljuset står på den globala `lightPos` (-2, 4, -1). `shadow_mapping.hlsl` belyser scenen: ljusfärgen 0.3,
ambient, diffust och Blinn-Phong-spekulärt, kombinerat som `(ambient + (1.0f - shadow) * (diffuse + specular)) * color`
– med `float shadow = 0.0f;` tills vidare. `shadow_mapping_depth.hlsl` och `debug_quad.hlsl` är redan klara; första
uppgiften kompilerar dem.
:::

Från kameran på (0, 0, 3) ser du golvet och, överst i fönstret, den svävande kuben underifrån. De två andra kuberna ligger
precis utanför bilden, till vänster och höger om kameran; dem möter du i djupkartan. Tryck på **Build & run**
(Ctrl+Enter): golvet är jämnt belyst – svagt, ljusfärgen är bara 0.3 – och ingenting kastar någon skugga. Kommentarerna
`// TODO:` i projektet visar var din kod ska in.

## Shadow mapping

Idén bakom shadow mapping är ganska enkel: vi renderar scenen från ljusets synvinkel, och allt vi ser från ljusets
perspektiv är belyst, medan allt vi inte ser måste ligga i skugga. Föreställ dig en del av ett golv med en stor låda
mellan sig och en ljuskälla. Eftersom ljuskällan ser lådan och inte golvdelen när den tittar åt det hållet, ska just den
golvdelen ligga i skugga.

Vi vill hitta punkten på strålen där den först träffade ett objekt och jämföra den närmaste punkten med andra punkter på
samma stråle. Sedan gör vi ett enkelt test: ligger en testpunkt längre bort längs strålen än den närmaste punkten, måste
testpunkten ligga i skugga. Att gå igenom kanske tusentals ljusstrålar från en sådan ljuskälla är extremt ineffektivt och
passar inte särskilt bra för realtidsrendering. Vi kan göra något liknande, men utan att skicka ut ljusstrålar. I stället
använder vi något vi känner väl: djupbuffern.

Du minns kanske från kapitlet *Djuptestning* att ett värde i djupbuffern motsvarar ett fragments djup, klämt till [0,1],
sett från kameran. Tänk om vi renderade scenen från ljusets perspektiv och lagrade de resulterande djupvärdena i en
textur? Då kan vi sampla de närmaste djupvärdena sedda från ljusets perspektiv. Djupvärdena visar ju det första fragment
som syns från ljusets perspektiv. Vi lagrar alla de här djupvärdena i en textur som vi kallar *djupkarta* (depth map)
eller *shadow map*.

För att rendera scenen med skuggor går vi sedan igenom två steg:

- **Pass 1:** rendera scenen från ljusets synvinkel in i djupkartan. För varje riktning som ljuset tittar åt innehåller
  djupkartan nu djupet hos den närmaste ytan.
- **Pass 2:** rendera scenen som vanligt från kameran, och transformera för varje fragment dess position till ljusets
  vy. Dess djup där – dess avstånd från ljuset, så att säga – jämförs med det närmaste djupet som är lagrat i djupkartan
  på det stället. Ligger fragmentet längre bort än den närmaste ytan står något mellan det och ljuset: fragmentet ligger i
  skugga.

Säg att ett fragment på golvet får djupet 0.9 i ljusets vy, men att djupkartan har 0.4 på det stället – ovansidan av en
låda. Eftersom 0.9 är större än 0.4 är fragmentet skymt och ligger i skugga.

```quiz
I pass 2 får ett golvfragment, transformerat till ljusets vy, djupet 0.9, och djupkartan har 0.4 på dess plats. Vad betyder det?
- [ ] Fragmentet är belyst: dess djup är större än det lagrade
- [x] Något ligger närmare ljuset på det stället (djup 0.4), så fragmentet (0.9) är skymt: det ligger i skugga
- [ ] Fragmentet ligger utanför ljusets vy
- [ ] Djupkartan rensades inte
---
Djupkartan lagrar det närmaste djup som ljuset ser i varje riktning. Ett fragment som ligger längre från ljuset än den närmaste ytan ligger bakom den – i dess skugga.
```

## Djupkartan

Det första passet kräver att vi skapar en djupkarta. Djupkartan är djuptexturen renderad från ljusets perspektiv, som vi
ska använda för att testa skuggor. Eftersom vi måste lagra resultatet av en renderad scen i en textur behöver vi en
framebuffer igen – eller motsvarigheten i {{api}}.

:::opengl
Först skapar vi ett framebufferobjekt att rendera djupkartan i:

```cpp
    unsigned int depthMapFBO;
    glGenFramebuffers(1, &depthMapFBO);
```

Sedan skapar vi en 2D-textur som vi använder som framebufferns djupbuffer:

```cpp
    const unsigned int SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;
    unsigned int depthMap;
    glGenTextures(1, &depthMap);
    glBindTexture(GL_TEXTURE_2D, depthMap);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
```

Att skapa djupkartan bör inte se alltför komplicerat ut. Eftersom vi bara bryr oss om djupvärden anger vi texturens
format som `GL_DEPTH_COMPONENT`. Vi ger också texturen bredden och höjden 1024: det är djupkartans upplösning.
`GL_NEAREST`-filtrering, eftersom djup jämförs, inte blandas.

Den skapade djuptexturen kan vi koppla till framebuffern som dess djupbuffer:

```cpp
    glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthMap, 0);
    glDrawBuffer(GL_NONE); // no colour buffer: tell OpenGL we draw no colour data
    glReadBuffer(GL_NONE);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Vi behöver bara djupinformationen när vi renderar scenen från ljusets perspektiv, så det behövs ingen färgbuffer. Ett
framebufferobjekt är dock inte komplett utan en färgbuffer, så vi måste uttryckligen tala om för OpenGL att vi inte
kommer att rendera någon färgdata. Det gör vi genom att sätta både läs- och ritbufferten till `GL_NONE` med
`glDrawBuffer` och `glReadBuffer`.
:::
:::vulkan
I Vulkan består "en framebuffer med bara en djuptextur" av fyra objekt: en **djupbild** som man både kan rita i och
sampla, dess vy, ett **render pass** med ett enda djup-attachment, och en **framebuffer** som kopplar ihop de två. Bilden
behöver ett format som stöder båda användningarna. `findDepthMapFormat()` frågar efter ett:

```cpp
    // a depth format that can be drawn into and sampled (learnopengl: GL_DEPTH_COMPONENT, GL_FLOAT)
    VkFormat findDepthMapFormat() {
        return findSupportedFormat(
            {VK_FORMAT_D32_SFLOAT, VK_FORMAT_D16_UNORM},
            VK_IMAGE_TILING_OPTIMAL,
            VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT | VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT
        );
    }
```

Render passet har ett attachment och ingen färg alls – learnopengls `glDrawBuffer(GL_NONE)` blir
`colorAttachmentCount = 0`:

```cpp
        VkAttachmentDescription depthAttachment{};
        depthAttachment.format = findDepthMapFormat();
        depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE; // keep the depths: the shaders read them afterwards
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

Jämför med fönstrets djup-attachment i de tidigare kapitlen: det har `storeOp = DONT_CARE`, eftersom dess djup kastas
efter bildrutan. Här är djupen själva poängen, så de sparas, och passet lämnar bilden i
`VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL`, layouten för att sampla en djupbild. Subpasset refererar till den som
sitt djup-attachment:

```cpp
        VkSubpassDescription subpass{};
        subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
        subpass.colorAttachmentCount = 0; // no colour: only the depth is drawn
        subpass.pDepthStencilAttachment = &depthAttachmentRef;
```

Två subpass dependencies ordnar passet i förhållande till de fragment shaders som läser djupkartan: före passet väntar
djupskrivningarna tills förra bildrutans fragment shaders har läst de gamla djupen
(`VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT` / `VK_ACCESS_SHADER_READ_BIT` → fragmenttestens steg och
djup-attachmentets åtkomster); efter det väntar fragment shadrarna tills djupen är skrivna:

```cpp
        // after the pass: the fragment shaders that sample the depth map wait until the depths have been written
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
```

Allt det är `createDepthMapRenderPass()`, som skapar `depthMapRenderPass`. `createDepthMap()` skapar bilden – storleken är
djupkartans upplösning, `const uint32_t SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;`, och användningen anger båda sakerna vi
ska göra med den – dess vy och framebuffern:

```cpp
    void createDepthMap() {
        VkFormat depthMapFormat = findDepthMapFormat();
        createImage(SHADOW_WIDTH, SHADOW_HEIGHT, depthMapFormat, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, depthMapImage, depthMapImageMemory);
        depthMapImageView = createImageView(depthMapImage, depthMapFormat, VK_IMAGE_ASPECT_DEPTH_BIT);

        VkFramebufferCreateInfo framebufferInfo{};
        framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
        framebufferInfo.renderPass = depthMapRenderPass;
        framebufferInfo.attachmentCount = 1;
        framebufferInfo.pAttachments = &depthMapImageView;
        framebufferInfo.width = SHADOW_WIDTH;
        framebufferInfo.height = SHADOW_HEIGHT;
        framebufferInfo.layers = 1;
```

`createDepthMapSampler()` skapar `depthMapSampler` med `VK_FILTER_NEAREST` för båda filtren (djup jämförs, de blandas
inte), `VK_SAMPLER_ADDRESS_MODE_REPEAT` som learnopengls textur, och ingen anisotropi. Descriptor setet får djupkartan på
binding 2 – en `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER` för fragmentsteget, skriven med den layout som passet lämnar
den i:

```cpp
        VkDescriptorImageInfo depthMapInfo{};
        depthMapInfo.imageLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL; // the depth map pass's finalLayout
        depthMapInfo.imageView = depthMapView;
        depthMapInfo.sampler = depthMapSampler;
```

(`createDescriptorSet()` tar djupkartans vy och sampler som parametrar, och poolen rymmer nu två combined image
samplers.)
:::
:::d3d12
I Direct3D 12 är djupkartan en textur med två vyer: en **depth stencil view** (DSV) för att rita i den, och en **shader
resource view** (SRV) för att läsa den i en shader – mönstret från Microsofts exempel D3D12Multithreading. Haken är
formatet. Ett djupformat som `DXGI_FORMAT_D32_FLOAT` kan bara visas som djupbuffer, inte som shaderresurs. Därför skapas
resursen **typlös**, `DXGI_FORMAT_R32_TYPELESS` – 32 bitar per texel, ännu utan tolkning – och varje vy väljer sin
tolkning: `DXGI_FORMAT_D32_FLOAT` för DSV:n, `DXGI_FORMAT_R32_FLOAT` för SRV:n. Resursen måste också få vara en depth
stencil:

```cpp
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC shadowDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R32_TYPELESS, SHADOW_WIDTH, SHADOW_HEIGHT, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL);

        // It is cleared to 1.0, the far plane, every frame.
        D3D12_CLEAR_VALUE clearValue = {};
        clearValue.Format = DXGI_FORMAT_D32_FLOAT;
        clearValue.DepthStencil.Depth = 1.0f;
        clearValue.DepthStencil.Stencil = 0;

        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &shadowDesc,
            D3D12_RESOURCE_STATE_DEPTH_WRITE,
            &clearValue,
            IID_PPV_ARGS(&m_shadowMap)));
```

`SHADOW_WIDTH` och `SHADOW_HEIGHT` är 1024 (`static const UINT SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;`): djupkartans
upplösning. Texturen börjar i tillståndet `DEPTH_WRITE`, redo för första passet. Dess DSV hamnar på plats 1 i DSV-heapen,
efter fönstrets djupbuffer (heapen har nu `NumDescriptors = 2`, och `m_dsvDescriptorSize` är steget mellan dess platser):

```cpp
        D3D12_DEPTH_STENCIL_VIEW_DESC dsvDesc = {};
        dsvDesc.Format = DXGI_FORMAT_D32_FLOAT;
        dsvDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2D;
        dsvDesc.Flags = D3D12_DSV_FLAG_NONE;
        CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_dsvDescriptorSize);
        m_device->CreateDepthStencilView(m_shadowMap.Get(), &dsvDesc, dsvHandle);
```

Dess SRV hamnar på plats 2 i CBV/SRV-heapen (nu 3 descriptors), direkt efter träets:

```cpp
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R32_FLOAT;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_device->CreateShaderResourceView(m_shadowMap.Get(), &srvDesc, srvHandle);
```

Eftersom de två SRV:erna är grannar i heapen når en enda descriptor table båda: root signaturens SRV-intervall växer till
två register, t0 (träet) och t1 (djupkartan):

```cpp
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);
```

Djupkartan får en egen statisk sampler s1, en kopia av träets med punktfiltrering (learnopengl: `GL_NEAREST` – djup
jämförs, de blandas inte), som tills vidare fortfarande upprepar som learnopengls `GL_REPEAT`:

```cpp
        samplers[1] = samplers[0];
        samplers[1].Filter = D3D12_FILTER_MIN_MAG_MIP_POINT;
        samplers[1].ShaderRegister = 1;
```
:::

:::opengl
```quiz
Varför anropar djupkartans framebuffer `glDrawBuffer(GL_NONE)` och `glReadBuffer(GL_NONE)`?
- [ ] För att rensa färgbuffern före djuppasset
- [ ] För att en djuptextur bara kan kopplas in när ingen shader är bunden
- [ ] För att göra djupkartan skrivskyddad för det andra passet
- [x] Den har inget färg-attachment, och en framebuffer utan ett sådant är bara komplett om OpenGL får veta att ingen färg ritas eller läses
---
Djuppasset behöver bara djup. Utan färgbuffer vore framebuffern inte komplett – om inte rit- och läsbufferten sätts till `GL_NONE`.
```
:::
:::vulkan
```quiz
Vilka inställningar gör djupbilden användbar som textur efter djuppasset?
- [ ] `loadOp = VK_ATTACHMENT_LOAD_OP_LOAD` och användningen `VK_IMAGE_USAGE_TRANSFER_SRC_BIT`
- [ ] Bara `colorAttachmentCount = 0`
- [x] Användningen `VK_IMAGE_USAGE_SAMPLED_BIT` (utöver djup-attachment-biten), `storeOp = VK_ATTACHMENT_STORE_OP_STORE` och `finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL`
- [ ] En andra framebuffer för fönstrets render pass
---
Bilden måste få samplas, dess djup måste sparas i slutet av passet i stället för att kastas, och den måste hamna i en layout som en shader kan läsa ifrån – samma layout som descriptorn anger.
```
:::
:::d3d12
```quiz
Varför skapas djupkartan som `DXGI_FORMAT_R32_TYPELESS` i stället för `DXGI_FORMAT_D32_FLOAT`?
- [x] En resurs med ett djupformat kan inte ha en shader resource view; en typlös kan visas som `D32_FLOAT` av DSV:n och som `R32_FLOAT` av SRV:n
- [ ] Typlösa resurser är snabbare att rensa
- [ ] `D32_FLOAT`-texturer kan inte vara 1024 × 1024
- [ ] För att pixel shadern ska kunna skriva djup i den
---
DSV:n och SRV:n tolkar samma 32 bitar per texel olika: som ett djup när man ritar, som en float-färg när man samplar. Det kräver en typlös resurs med samma bitlayout.
```
:::

### Ljusrummets transformation

Det vi behöver är en matris som transformerar varje vertex till ljusets vy – *ljusrummet* (light space). Till det behöver
vi en view-matris och en projektionsmatris, precis som för kameran.

Eftersom vi modellerar en riktad ljuskälla är alla dess ljusstrålar parallella. Därför använder vi en ortografisk
projektionsmatris för ljuskällan, där perspektivet inte förvränger något. Ljuset står på `lightPos`, tittar mot origo,
och dess ortografiska låda är 20 × 20 enheter bred kring siktlinjen, från 1.0 till 7.5 enheter framför ljuset. Eftersom en
projektionsmatris indirekt bestämmer vad som syns (det som inte klipps bort) vill du se till att projektionsfrustumets
storlek rymmer de objekt som du vill ha i djupkartan. Objekt eller fragment som inte finns i djupkartan kastar inga
skuggor.

:::opengl
```cpp
        float near_plane = 1.0f, far_plane = 7.5f;
        lightProjection = glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, near_plane, far_plane); // a directional light: parallel rays
        lightView = glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0));
        lightSpaceMatrix = lightProjection * lightView;
```

Kombinerar vi de två får vi en transformationsmatris för ljusrummet som transformerar varje vektor i världsrummet till
rummet så som ljuskällan ser det; precis vad vi behöver för att rendera djupkartan.
:::
:::vulkan
Matrisen hamnar i uniform buffern, efter `proj`. Den beräknas i `updateUniformBuffer()`:

```cpp
        float near_plane = 1.0f, far_plane = 7.5f;
        glm::mat4 lightProjection = glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, near_plane, far_plane);
        glm::mat4 lightView = glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0));
        ubo.lightSpaceMatrix = lightProjection * lightView;
```

Kombinerar vi de två får vi en transformationsmatris för ljusrummet som transformerar varje vektor i världsrummet till
rummet så som ljuskällan ser det. Två Vulkandetaljer:

- Projektet definierar `GLM_FORCE_DEPTH_ZERO_TO_ONE`, så `glm::ortho` avbildar djupet på 0..1, Vulkans intervall – samma
  0..1 som djupbilden lagrar.
- Kamerans projektion får `proj[1][1] *= -1` så att bilden står rätt i fönstret. Ljusets matris får det **inte**:
  djuppasset och skuggslagningen i pass 2 använder samma matris, så vilken y-riktning den än har stämmer de två överens.
  Ingen tittar på djupkartan som en bild – utom debugfyrhörningen, som vi kommer till.

Lägg till `glm::mat4 lightSpaceMatrix;` efter `proj` i `UniformBufferObject`, och `mat4 lightSpaceMatrix;` efter `proj`
i uniformblocket i `shadow_mapping.frag` också, så att medlemmarna efter den (`viewPos`, `lightPos`) behåller sina
offsets.
:::
:::d3d12
Matrisen hamnar i constant buffern, efter `projection` (`XMFLOAT4X4 lightSpaceMatrix;` i `SceneConstantBuffer`,
`float4x4 lightSpaceMatrix;` i cbuffern i `shadow_mapping.hlsl`, så att båda layouterna förblir likadana). Den beräknas i
`OnUpdate`:

```cpp
    float near_plane = 1.0f, far_plane = 7.5f;
    XMMATRIX lightProjection = XMMatrixOrthographicRH(20.0f, 20.0f, near_plane, far_plane);
    XMMATRIX lightView = XMMatrixLookAtRH(XMLoadFloat3(&lightPos), XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f), XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f));
    XMMATRIX lightSpaceMatrix = lightView * lightProjection;    // row vectors: the view first, then the projection
    XMStoreFloat4x4(&constantBufferData.lightSpaceMatrix, XMMatrixTranspose(lightSpaceMatrix));
```

`XMMatrixOrthographicRH(20.0f, 20.0f, …)` är en låda 20 enheter bred och hög, centrerad kring siktlinjen – samma låda som
learnopengls symmetriska `glm::ortho(-10, 10, -10, 10, …)` (`XMMatrixOrthographicOffCenterRH(-10.0f, 10.0f, -10.0f,
10.0f, …)` vore den bokstavliga översättningen). Den avbildar djupet på 0..1, Direct3D:s intervall. Med DirectXMaths
radvektorer skrivs produkten åt andra hållet: `lightView * lightProjection`, view först. Kombinerar vi de två får vi en
transformationsmatris för ljusrummet som transformerar varje vektor i världsrummet till rummet så som ljuskällan ser det.
:::

```quiz
Varför använder det riktade ljuset en ortografisk projektion för sin djupkarta?
- [ ] För att ortografiska djupkartor inte behöver något djuptest
- [x] Ett riktat ljus strålar är parallella; en ortografisk projektion saknar perspektiv, så den renderar scenen längs parallella strålar
- [ ] För att en perspektivprojektion inte kan ha near-planet 1.0
- [ ] För att djupkartan ska kunna vara mindre än fönstret
---
En ortografisk projektion projicerar längs parallella linjer – som solljus. Ett ljus i en punkt, som lyser åt alla håll därifrån, behöver i stället en perspektivprojektion (se slutet av kapitlet).
```

### Rendera till djupkartan

När vi renderar scenen från ljusets perspektiv vill vi hellre använda en enkel shader som bara transformerar vertices till
ljusrummet och inte mycket mer. Bara djupet spelar roll: ingen belysning, ingen textur, inte ens en färg.

:::opengl
Till en sådan enkel shader, `simpleDepthShader`, använder vi följande vertex shader, `shadow_mapping_depth.vs`:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

uniform mat4 lightSpaceMatrix;
uniform mat4 model;

void main()
{
    gl_Position = lightSpaceMatrix * model * vec4(aPos, 1.0);
}
```

Den här vertex shadern tar en modellmatris per objekt, en vertex, och transformerar alla vertices till ljusrummet med
`lightSpaceMatrix`. Eftersom vi inte har någon färgbuffer och har slagit av rit- och läsbufferten behöver de resulterande
fragmenten ingen bearbetning, så vi kan helt enkelt använda en tom fragment shader – det är `shadow_mapping_depth.fs`:

```glsl
#version 330 core

void main()
{
    // nothing to do: the depth buffer is written anyway
    // gl_FragDepth = gl_FragCoord.z;
}
```

Den här tomma fragment shadern gör ingen bearbetning alls, och när den körts uppdateras djupbuffern. Vi skulle kunna sätta
djupet uttryckligen genom att avkommentera dess enda rad, men det är i praktiken vad som ändå händer bakom kulisserna.

Att rendera djupkartan blir nu i praktiken:

```cpp
        simpleDepthShader.use();
        simpleDepthShader.setMat4("lightSpaceMatrix", lightSpaceMatrix);

        glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
        glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
            glClear(GL_DEPTH_BUFFER_BIT);
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, woodTexture);
            renderScene(simpleDepthShader);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // reset viewport
        glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
```

Glöm inte att anropa `glViewport`. Eftersom shadow maps ofta har en annan upplösning än den vi normalt renderar scenen i
(oftast fönstrets upplösning) måste vi ändra viewporten så att den passar shadow mapens storlek. Glömmer vi att uppdatera
viewporten blir den resulterande djupkartan antingen ofullständig eller för liten.
:::
:::vulkan
Till en sådan enkel shader använder vi följande vertex shader, `shaders/shadow_mapping_depth.vert`. Den läser uniform
bufferns tre första medlemmar och modellmatrisen från push constants:

```glsl
// the vertex shader only reads the first members of the uniform buffer: the matrices
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    mat4 lightSpaceMatrix;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;

void main() {
    gl_Position = ubo.lightSpaceMatrix * pc.model * vec4(inPosition, 1.0);
}
```

Den här vertex shadern transformerar alla vertices till ljusrummet med `lightSpaceMatrix`. Eftersom render passet inte har
något färg-attachment behöver de resulterande fragmenten ingen bearbetning, så `shadow_mapping_depth.frag` är tom:
djuptestet skriver djupet av sig självt.

Djuppasset behöver en egen pipeline: den läser bara positionen (ett vertexattribut), hör till `depthMapRenderPass` och
har inget color blend-attachment – deras antal måste stämma med subpassets färg-attachments, som är 0. Därför får
`createPipeline` tre parametrar för det:

```cpp
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, uint32_t attributeCount, VkRenderPass pipelineRenderPass, uint32_t colorAttachmentCount, VkPipeline& pipeline) {
```

som används som `vertexInputInfo.vertexAttributeDescriptionCount = attributeCount;`, `colorBlending.attachmentCount =
colorAttachmentCount;` och `pipelineInfo.renderPass = pipelineRenderPass;`. De tre pipelines:

```cpp
        createPipeline("shaders/shadow_mapping.vert.spv", "shaders/shadow_mapping.frag.spv", 3, renderPass, 1, graphicsPipeline);
        // the depth pass: only the position, for the depth map's render pass, which has no colour attachment
        createPipeline("shaders/shadow_mapping_depth.vert.spv", "shaders/shadow_mapping_depth.frag.spv", 1, depthMapRenderPass, 0, depthPipeline);
        createPipeline("shaders/debug_quad.vert.spv", "shaders/debug_quad_depth.frag.spv", 3, renderPass, 1, debugPipeline);
```

Att rendera djupkartan är ett eget render pass, inspelat i början av `recordCommandBuffer()`, före fönstrets:

```cpp
        // 1. render depth of scene to texture (from light's perspective)
        VkRenderPassBeginInfo depthMapPassInfo{};
        depthMapPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        depthMapPassInfo.renderPass = depthMapRenderPass;
        depthMapPassInfo.framebuffer = depthMapFramebuffer;
        depthMapPassInfo.renderArea.offset = {0, 0};
        depthMapPassInfo.renderArea.extent = {SHADOW_WIDTH, SHADOW_HEIGHT};

        // one clear value: the depth 1.0 (the far plane)
        VkClearValue depthMapClearValue{};
        depthMapClearValue.depthStencil = {1.0f, 0};

        depthMapPassInfo.clearValueCount = 1;
        depthMapPassInfo.pClearValues = &depthMapClearValue;

        vkCmdBeginRenderPass(commandBuffer, &depthMapPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, depthPipeline);
```

sedan djupkartans viewport och scissor – 1024 × 1024 (learnopengl: `glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT)`) –
descriptor setet och scenen:

```cpp
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &descriptorSet, 0, nullptr);
        renderScene(commandBuffer);

        vkCmdEndRenderPass(commandBuffer); // the depth map is now in VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL
```

(Vertex buffern binds nu en gång högst upp, före båda passen.) Glöm inte att sätta viewporten. Eftersom shadow maps ofta
har en annan upplösning än fönstret måste viewporten stämma med shadow mapens storlek; fönstrets pass sätter sedan
fönstrets viewport igen och binder sin egen pipeline. Bindningar som vertex buffern och descriptor setet är command
bufferns tillstånd: de förblir bundna mellan render passes.
:::
:::d3d12
Till en sådan enkel shader använder vi `shadow_mapping_depth.hlsl`, som bara är en vertex shader:

```hlsl
// The vertex shader: the position as the light's view and projection see it.
float4 VSMain(float4 position : POSITION) : SV_POSITION
{
    return mul(mul(position, model), lightSpaceMatrix);
}
```

Den transformerar alla vertices till ljusrummet med `lightSpaceMatrix`. Det finns ingen pixel shader alls: utan render
target finns ingen färg att beräkna, och rastreraren och djuptestet skriver djupet av sig själva (learnopengls fragment
shader för det här passet är tom). Djuppassets pipeline state är scenens beskrivning med fyra ändringar:

```cpp
        ComPtr<ID3DBlob> depthVertexShader;
        ThrowIfFailed(D3DCompileFromFile(L"shadow_mapping_depth.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &depthVertexShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(depthVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(nullptr, 0);
        psoDesc.NumRenderTargets = 0;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_UNKNOWN;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_depthPipelineState)));
```

DSV-formatet är formatet på vyn som passet ritar genom. Att rendera djupkartan är det första som `PopulateCommandList`
spelar in:

```cpp
    m_commandList->SetPipelineState(m_depthPipelineState.Get());
    m_commandList->RSSetViewports(1, &m_shadowViewport);
    m_commandList->RSSetScissorRects(1, &m_shadowScissorRect);
    CD3DX12_CPU_DESCRIPTOR_HANDLE shadowDsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_dsvDescriptorSize);
    m_commandList->OMSetRenderTargets(0, nullptr, FALSE, &shadowDsvHandle);
    m_commandList->ClearDepthStencilView(shadowDsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr);
```

följt av scenens fyra draws (`SetGraphicsRoot32BitConstants` med varje objekts konstanter, sedan `DrawInstanced`).
`OMSetRenderTargets(0, nullptr, …)` binder inget render target, bara djupkartans DSV – learnopengls
`glDrawBuffer(GL_NONE)`. `m_shadowViewport` och `m_shadowScissorRect` har djupkartans storlek, 1024 × 1024 (satta i
konstruktorn). Glöm inte att sätta dem: eftersom shadow maps ofta har en annan upplösning än fönstret måste viewporten
stämma med shadow mapens storlek, och fönstrets pass sätter sedan `m_viewport` igen.

När passet är klart byter djupkartan roll – från en djupbuffer som skrivs till en textur som pixel shadern läser – och
Direct3D 12 vill att det sägs med en barriär:

```cpp
    CD3DX12_RESOURCE_BARRIER shadowBarrier = CD3DX12_RESOURCE_BARRIER::Transition(m_shadowMap.Get(), D3D12_RESOURCE_STATE_DEPTH_WRITE, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, &shadowBarrier);
```

I slutet av bildrutan, efter back bufferns barriär till `PRESENT`, vänder en andra barriär tillbaka den för nästa
bildrutas djuppass:

```cpp
    shadowBarrier = CD3DX12_RESOURCE_BARRIER::Transition(m_shadowMap.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_DEPTH_WRITE);
    m_commandList->ResourceBarrier(1, &shadowBarrier);
```
:::

Om vi har gjort allt rätt är djupkartan nu fylld med det närmaste djupet för varje synligt fragment sett från ljusets
perspektiv. Genom att rendera texturen på en 2D-fyrhörning som fyller skärmen (ungefär som i post-processing-avsnittet i
kapitlet *Framebuffers*) kan vi visa den på skärmen – ett bra sätt att kontrollera den.

:::opengl
`debug_quad.vs` skickar vidare fyrhörningens positioner och texturkoordinater; i `debug_quad_depth.fs` samplar vi
djupkartan och visar djupet som en gråton:

```glsl
    float depthValue = texture(depthMap, TexCoords).r;
    // FragColor = vec4(vec3(LinearizeDepth(depthValue) / far_plane), 1.0); // perspective
    FragColor = vec4(vec3(depthValue), 1.0); // orthographic
```

Ljusets projektion är ortografisk, så dess djup är redan linjärt; funktionen `LinearizeDepth` i shadern är till för
perspektivprojektioner, som vi återkommer till i slutet. Efter scenens vanliga rendering (pass 2) ritar du fyrhörningen:

```cpp
        debugDepthQuad.use();
        debugDepthQuad.setFloat("near_plane", near_plane);
        debugDepthQuad.setFloat("far_plane", far_plane);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, depthMap);
        renderQuad(); // covers the whole window
```

Gör nu den första uppgiften, **depth-map**. Den samlar allt i det här avsnittet: de två shadrarna
(`Shader simpleDepthShader("shadow_mapping_depth.vs", "shadow_mapping_depth.fs");` och
`Shader debugDepthQuad("debug_quad.vs", "debug_quad_depth.fs");`), djupkartans FBO, `debugDepthQuad.setInt("depthMap",
0)` en gång, pass 1 i början av renderloopen, debugfyrhörningen efter pass 2, vertex shaderns `gl_Position` och debugens
fragment shader. Ta bort `depthMap` och `depthMapFBO` i slutet.
:::
:::vulkan
Debugfyrhörningen är learnopengls fyrhörning som täcker fönstret, tillagd i `vertices` som vertex 42 till 47 – med v
vänt. Här är varför: djuppasset har ingen y-vändning, så djupbildens rad 0 innehåller ljusets NDC y = -1, nederkanten av
dess vy; men i Vulkans fönster är NDC y = -1 överkanten. Med learnopengls texturkoordinater skulle fyrhörningen visa
djupkartan upp och ned; med `1 - v` står den rätt, som OpenGL:s:

```cpp
    // debug quad (vertices 42..47): covers the window (x, y = -1..1, z = 0); v flipped: the depth map has no y flip
    // (see updateUniformBuffer), so its row 0 is the light's bottom (NDC y = -1), and Vulkan's NDC y = -1 is the top
    {{-1.0f,  1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {0.0f, 0.0f}},
    {{-1.0f, -1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {0.0f, 1.0f}},
    {{ 1.0f, -1.0f,  0.0f}, { 0.0f,  0.0f,  1.0f}, {1.0f, 1.0f}},
```

(och den andra triangeln). `debug_quad.vert` skickar vidare positionerna och texturkoordinaterna;
`debug_quad_depth.frag` läser djupkartan på binding 2 och visar djupet som en gråton:

```glsl
    float depthValue = texture(depthMap, fragTexCoord).r;
    outColor = vec4(vec3(depthValue), 1.0); // orthographic: the depth is linear already
```

I fönstrets pass ersätter debugfyrhörningen scenen tills vidare:

```cpp
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, debugPipeline);
        vkCmdDraw(commandBuffer, 6, 1, 42, 0); // the debug quad's 6 vertices start at vertex 42
```

Gör nu den första uppgiften, **depth-map**. Den samlar allt i det här avsnittet: `SHADOW_WIDTH` / `SHADOW_HEIGHT`,
debugfyrhörningens vertices, ljusrummets matris, `createDepthMapRenderPass()`, `createDepthMap()`,
`createDepthMapSampler()`, de nya parametrarna till `createPipeline` och de två nya pipelines, binding 2 i descriptor
setet, djuppasset i `recordCommandBuffer()`, de två shadrarna – och att förstöra de nya objekten i `cleanup()`
(framebuffer, vy, bild, minne, sampler, pipelines, render pass).
:::
:::d3d12
`debug_quad.hlsl` skickar vidare fyrhörningens positioner och texturkoordinater och visar djupkartan (t1, genom samma
descriptor table som träet) som en gråton:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float depthValue = depthMap.Sample(shadowSampler, input.texCoord).r;
    return float4(depthValue, depthValue, depthValue, 1.0f);
}
```

Ljusets projektion är ortografisk, så dess djup är redan linjärt. Fyrhörningen är learnopengls, tillagd i vertex buffern
som vertex 42 till 47, i Direct3D:s texturkoordinater (v = 0 överst). Den står rätt som den är: djupkartans rad 0
innehåller ljusets NDC y = +1, överkanten av dess vy. Dess pipeline state, `m_debugQuadPipelineState`, använder
`debug_quad.hlsl`:s shadrar, ett render target igen (`NumRenderTargets = 1`, `RTVFormats[0] =
DXGI_FORMAT_R8G8B8A8_UNORM`) och `DepthStencilState.DepthEnable = FALSE`. Efter scenens draws i fönstret:

```cpp
    m_commandList->SetPipelineState(m_debugQuadPipelineState.Get());
    m_commandList->DrawInstanced(6, 1, 42, 0);
```

Gör nu den första uppgiften, **depth-map**. Den samlar allt i det här avsnittet: `SHADOW_WIDTH` / `SHADOW_HEIGHT`,
skuggans viewport och scissor-rektangel, de större heaparna och `m_dsvDescriptorSize`, SRV-intervallet på 2 och sampler
s1, de två pipeline states, fyrhörningens vertices, djupkartan med sina två vyer, ljusrummets matris, pass 1 med dess
barriärer, och debugfyrhörningens draw.
:::

Tryck på **Build & run**: i stället för scenen visar fönstret **djupkartan** – grå överallt, kartan på 1024 × 1024
utsträckt till fönstret. Golvet är en lodrät gradient: vitt överst, där det ligger bortom far-planet (där ritades
ingenting och det rensade djupet 1.0 står kvar), mellangrått i mitten, mörkare nedåt där det kommer närmare ljuset, och
sedan vitt igen i ett band längst ned: den delen av golvet ligger framför near-planet och klipptes bort. Den svävande
kuben är den mörkaste fläcken, närmast ljuset; kuben på (2, 0, 1) är ljusare än golvet runt den, och den lilla vridna
kuben ligger mellan de två.

## Rendera skuggor

Med en korrekt skapad djupkarta kan vi börja rendera själva skuggorna. Koden som kontrollerar om ett fragment ligger i
skugga körs (ganska uppenbart) i fragment shadern, men transformationen till ljusrummet gör vi i vertex shadern.

:::opengl
```glsl
out VS_OUT {
    vec3 FragPos;
    vec3 Normal;
    vec2 TexCoords;
    vec4 FragPosLightSpace;
} vs_out;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;
uniform mat4 lightSpaceMatrix;

void main()
{
    vs_out.FragPos = vec3(model * vec4(aPos, 1.0));
    vs_out.Normal = transpose(inverse(mat3(model))) * aNormal;
    vs_out.TexCoords = aTexCoords;
    vs_out.FragPosLightSpace = lightSpaceMatrix * vec4(vs_out.FragPos, 1.0);
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

Det nya här är den extra utdatavektorn `FragPosLightSpace`. Vi tar samma `lightSpaceMatrix` (som användes för att
transformera vertices till ljusrummet i djupkartssteget) och transformerar vertexens position i världsrummet till
ljusrummet, för användning i fragment shadern.
:::
:::vulkan
```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    mat4 lightSpaceMatrix;
} ubo;
```

```glsl
void main() {
    vs_out.fragPos = vec3(pc.model * vec4(inPosition, 1.0));
    vs_out.normal = transpose(inverse(mat3(pc.model))) * inNormal;
    vs_out.texCoord = inTexCoord;
    vs_out.fragPosLightSpace = ubo.lightSpaceMatrix * vec4(vs_out.fragPos, 1.0);
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
```

Det nya här är den extra utdatan `vec4 fragPosLightSpace;` i blocket `VS_OUT` (och i fragment shaderns block också). Vi
tar samma `lightSpaceMatrix` (som användes för att transformera vertices till ljusrummet i djuppasset) och transformerar
vertexens position i världsrummet till ljusrummet, för användning i fragment shadern.
:::
:::d3d12
```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoord : TEXCOORD0;
    float4 fragPosLightSpace : TEXCOORD1;    // the position as the light's view and projection see it
};
```

```hlsl
    // The same position, as the depth pass saw it from the light.
    result.fragPosLightSpace = mul(worldPos, lightSpaceMatrix);
```

Det nya här är den extra utdatan `fragPosLightSpace`. Vi tar samma `lightSpaceMatrix` (som användes för att transformera
vertices till ljusrummet i djuppasset) och transformerar positionen i världsrummet till ljusrummet, för användning i pixel
shadern.
:::

Huvudshadern som vi renderar scenen med använder Blinn-Phongs belysningsmodell. I fragment shadern beräknar vi sedan ett
värde `shadow` som är 1.0 när fragmentet ligger i skugga och 0.0 när det inte gör det. De resulterande diffusa och
spekulära komponenterna multipliceras sedan med den här skuggkomponenten. Eftersom skuggor sällan är helt mörka (på grund
av ljusspridning) håller vi den ambienta komponenten utanför skuggmultiplikationen – det är
`(ambient + (1.0 - shadow) * (diffuse + specular)) * color`, som redan finns i shadern.

Det första vi gör för att kontrollera om ett fragment ligger i skugga är att omvandla fragmentets position i ljusrummet,
i clip space, till normaliserade enhetskoordinater (NDC). När vi skriver en vertexposition i clip space till den inbyggda
positionsutdatan i vertex shadern gör rastreraren automatiskt en perspektivdivision, alltså omvandlar
clip space-koordinater i intervallet [-w,w] till [-1,1] genom att dividera x-, y- och z-komponenten med vektorns
w-komponent. Eftersom `FragPosLightSpace` i clip space inte skickas till fragment shadern genom den utdatan måste vi göra
perspektivdivisionen själva. (Med en ortografisk projektion förblir w 1.0, så divisionen ändrar ingenting – men den gör
ingen skada och gör att funktionen fungerar för perspektivprojektioner också.)

Eftersom djupet i djupkartan ligger i intervallet [0,1] och vi också vill använda de projicerade koordinaterna för att
sampla djupkartan, omvandlar vi NDC-koordinaterna till intervallet [0,1]. Och här skiljer sig API:erna åt.

:::opengl
I OpenGL är NDC -1..1 i x, y **och** z, medan djuptexturen lagrar fönsterdjupet 0..1. Därför avbildas alla tre
komponenterna med `* 0.5 + 0.5`. Texturens v = 0 är dess nedersta rad, samma riktning som NDC y, så ingen vändning
behövs:

```glsl
float ShadowCalculation(vec4 fragPosLightSpace)
{
    // perform perspective divide
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform to [0,1] range
    projCoords = projCoords * 0.5 + 0.5;
    // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
    float closestDepth = texture(shadowMap, projCoords.xy).r;
    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;
    // check whether current frag pos is in shadow
    float shadow = currentDepth > closestDepth  ? 1.0 : 0.0;

    return shadow;
}
```
:::
:::vulkan
I Vulkan (med `GLM_FORCE_DEPTH_ZERO_TO_ONE`) är NDC z redan 0..1 – samma intervall som djupbilden lagrar – så bara x och
y avbildas med `* 0.5 + 0.5`. Och y behöver ingen vändning: i djuppasset hamnade NDC y = -1 på bildens rad 0 (Vulkans
framebuffer-y pekar nedåt), och slagningens v = -1 × 0.5 + 0.5 = 0 läser också rad 0. De två stämmer överens:

```glsl
float ShadowCalculation(vec4 fragPosLightSpace) {
    // perform perspective divide
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform x and y to the [0,1] range of texture coordinates; z is in [0,1] already (GLM_FORCE_DEPTH_ZERO_TO_ONE)
    projCoords.xy = projCoords.xy * 0.5 + 0.5;
    // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
    float closestDepth = texture(shadowMap, projCoords.xy).r;
    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;
    // check whether current frag pos is in shadow
    float shadow = currentDepth > closestDepth ? 1.0 : 0.0;

    return shadow;
}
```
:::
:::d3d12
I Direct3D är NDC z redan 0..1 – samma intervall som djupkartan lagrar – så bara x och y blir texturkoordinater. Och y
vänds: Direct3D:s textur-v = 0 är render targetens översta rad, som är NDC y = +1. Alltså v = -y * 0.5 + 0.5:

```hlsl
float ShadowCalculation(float4 fragPosLightSpace)
{
    // perform perspective divide
    float3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform x and y from [-1,1] to [0,1] texture coordinates: in Direct3D v points down
    // while y points up, so y is flipped. z needs nothing: Direct3D's depth is 0..1 already.
    float2 shadowUV = float2(projCoords.x * 0.5f + 0.5f, -projCoords.y * 0.5f + 0.5f);
    // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
    float closestDepth = shadowMap.Sample(shadowSampler, shadowUV).r;
    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;
    // check whether current frag pos is in shadow
    float shadow = currentDepth > closestDepth ? 1.0f : 0.0f;

    return shadow;
}
```

Shadern deklarerar `Texture2D shadowMap : register(t1);` och `SamplerState shadowSampler : register(s1);`.
:::

Med de här projicerade koordinaterna kan vi sampla djupkartan, eftersom de resulterande [0,1]-koordinaterna från
`projCoords` motsvarar de transformerade NDC-koordinaterna från det första render passet direkt. Det ger oss det närmaste
djupet från ljusets synvinkel. För att få det aktuella djupet för fragmentet hämtar vi helt enkelt den projicerade
vektorns z-koordinat, som är fragmentets djup sett från ljusets perspektiv. Själva jämförelsen är sedan bara en kontroll
av om `currentDepth` är större än `closestDepth`, och i så fall ligger fragmentet i skugga.

:::opengl
```quiz
Varför avbildar OpenGL:s `ShadowCalculation` också z med `* 0.5 + 0.5`, inte bara x och y?
- [ ] För att djupkartan rensades till 0.5
- [ ] För att djuptexturen lagrar värden från -1 till 1
- [ ] För att biasen behöver positiva värden
- [x] OpenGL:s NDC z går från -1 till 1, men djuptexturen lagrar fönsterdjupet 0..1 – fragmentets z måste ligga i samma intervall som de lagrade djupen
---
x och y blir texturkoordinater (0..1), och z måste stämma med det djupintervall som djuppasset skrev. I Vulkan och Direct3D är NDC z redan 0..1, så där avbildas bara x och y.
```
:::
:::vulkan
```quiz
Varför avbildar Vulkans `ShadowCalculation` bara x och y, och varför vänder den inte y?
- [x] NDC z är redan 0..1 (`GLM_FORCE_DEPTH_ZERO_TO_ONE`), som de lagrade djupen; och ljusets matris har ingen y-vändning, så NDC y = -1 är rad 0 både när djuppasset skriver och när slagningen läser
- [ ] För att Vulkans samplers vänder y automatiskt
- [ ] För att djupbilden lagras upp och ned och z ignoreras
- [ ] För att bara `proj[1][1] *= -1` skulle göra z negativt
---
OpenGL:s NDC z är -1..1, Vulkans 0..1. Och så länge djuppasset och slagningen använder samma ovända matris stämmer bildens radordning och texturkoordinaterna överens – bara debugfyrhörningen, som visar bilden som en bild, behöver ett vänt v.
```
:::
:::d3d12
```quiz
Varför använder Direct3D:s `ShadowCalculation` `-projCoords.y * 0.5f + 0.5f` för v och lämnar z som det är?
- [ ] För att djuppasset ritade djupkartan upp och ned
- [x] Direct3D:s textur-v = 0 är render targetens översta rad, som är NDC y = +1, så y vänds; och NDC z är redan 0..1, som de lagrade djupen
- [ ] För att `XMMatrixOrthographicRH` vänder y
- [ ] För att z måste vara negativt för jämförelsen
---
I Direct3D pekar NDC y uppåt medan textur-v pekar nedåt; djupintervallet är 0..1 både i NDC och i djupbuffern. OpenGL avbildar i stället x, y och z med `* 0.5 + 0.5` och behöver ingen vändning.
```
:::

:::opengl
I `main.cpp` får scenens shader djupkartan på texturenhet 1 och ljusrummets matris:

```cpp
    shader.setInt("shadowMap", 1);
```

```cpp
        shader.setMat4("lightSpaceMatrix", lightSpaceMatrix);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, woodTexture);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, depthMap);
        renderScene(shader);
```

Gör nu uppgiften **shadows**: vertex shaderns `FragPosLightSpace`, fragment shaderns `uniform sampler2D shadowMap;` (och
`FragPosLightSpace` i dess block), `ShadowCalculation`, `float shadow = ShadowCalculation(fs_in.FragPosLightSpace);` i
`main`, de två raderna i `main.cpp` – och kommentera bort debugfyrhörningens `renderQuad();` så att vi ser scenen igen.
:::
:::vulkan
Gör nu uppgiften **shadows**: vertex shaderns `lightSpaceMatrix` och `fragPosLightSpace`, fragment shaderns
`layout(binding = 2) uniform sampler2D shadowMap;` (och `fragPosLightSpace` i dess block), `ShadowCalculation`, och
`float shadow = ShadowCalculation(fs_in.fragPosLightSpace);` i `main`. I fönstrets pass ritar du scenen igen med
`graphicsPipeline` och lämnar debugfyrhörningen som kommentar:

```cpp
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, graphicsPipeline);
        renderScene(commandBuffer);

        // render the depth map to the debug quad for visual debugging (instead of the scene):
        // vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, debugPipeline);
        // vkCmdDraw(commandBuffer, 6, 1, 42, 0);
```

Descriptor setet som bands för djuppasset är fortfarande bundet – djupkartan på binding 2 inräknad.
:::
:::d3d12
Gör nu uppgiften **shadows**: `shadowMap` och `shadowSampler` i `shadow_mapping.hlsl`, `fragPosLightSpace` i `PSInput`
och `VSMain`, `ShadowCalculation`, och `float shadow = ShadowCalculation(input.fragPosLightSpace);` i `PSMain`. Kommentera
bort debugfyrhörningens två rader i `main.cpp` så att vi ser scenen igen:

```cpp
    // m_commandList->SetPipelineState(m_debugQuadPipelineState.Get());
    // m_commandList->DrawInstanced(6, 1, 42, 0);
```

Texturernas descriptor table når redan djupkartans SRV (t1), och sampler s1 är en del av root signaturen.
:::

Tryck på **Build & run**: den svävande kuben kastar nu en **skugga** på golvet, nere till höger – fragmenten där får bara
det ambienta ljuset. Men något är uppenbart fel: det belysta golvet är täckt av fina mörka ränder, ett moirémönster av
ringar. Låt oss fixa det.

## Bättre shadow maps

Vi har fått grunderna i shadow mapping att fungera, men som du ser finns det fortfarande några artefakter kopplade till
shadow mapping som vi behöver fixa för bättre resultat. Det är dem vi fokuserar på i de följande avsnitten.

### Shadow acne

Den här artefakten kallas *shadow acne* (skuggakne). Vi kan förklara den genom att titta på djupkartan: eftersom shadow
mapen har begränsad upplösning kan flera fragment sampla samma värde ur djupkartan när de ligger förhållandevis långt från
ljuskällan. En texel i vår djupkarta på 1024 × 1024 täcker 20/1024 ≈ 0.02 enheter av golvet sett från ljuset, vilket är
flera pixlar i fönstret.

Varje texel i djupkartan lagrar ett djup, mätt i texelns mitt – tänk dig den som en liten platt platta, hållen vinkelrätt
mot ljuset. Golvet lutar dock i förhållande till ljuset. Över en texels yta ligger det verkliga golvet alltså delvis lite
närmare ljuset än plattan och delvis lite längre bort. Flera fragment samplar samma djup; de som ligger lite närmare
ljuset än det lagrade värdet är belysta, de som ligger lite längre bort anses ligga i skugga – fast ingenting täcker dem.
Det är randmönstret: golvet skuggar sig självt.

Vi kan lösa problemet med ett litet trick som kallas *shadow bias*, där vi helt enkelt förskjuter ytans djup (eller shadow
mapens) med ett litet biasvärde så att fragmenten inte felaktigt hamnar bakom ytan. En fast bias som 0.005 löser problemet
till stor del, men ytor som lutar brant mot ljuset kan fortfarande få shadow acne. Ett robustare sätt är att låta biasen
bero på ytans vinkel mot ljuset: något vi kan lösa med skalärprodukten. Här har vi en största bias på 0.05 och en minsta
på 0.005 utifrån ytans normal och ljusriktningen. På så sätt får ytor som golvet, som är nästan vinkelräta mot ljuskällan,
en liten bias, medan ytor som kubens sidor får en mycket större.

```quiz
Vad orsakar shadow acne, och vad gör biasen mot det?
- [ ] Djupkartan har för många mipnivåer; biasen väljer nivå 0
- [ ] Ljuset står för nära golvet; biasen flyttar bort ljuset
- [x] Flera fragment delar en texel i djupkartan, och på en yta som lutar mot ljuset ligger hälften av dem en aning bakom dess lagrade djup; drar man av en liten bias från fragmentets djup slutar ytan skugga sig själv
- [ ] Jämförelsen borde använda `>=`; biasen avrundar djupen
---
Djupkartans begränsade upplösning gör en lutande yta till en trappa av lagrade djup. En bias – större för brantare vinklar mot ljuset – flyttar jämförelsen lite mot ljuset, så att en yta inte längre räknas som sitt eget hinder.
```

:::opengl
Gör nu uppgiften **bias**. I `ShadowCalculation`:

```glsl
    // calculate bias (based on depth map resolution and slope)
    vec3 normal = normalize(fs_in.Normal);
    vec3 lightDir = normalize(lightPos - fs_in.FragPos);
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    // check whether current frag pos is in shadow
    float shadow = currentDepth - bias > closestDepth  ? 1.0 : 0.0;
```
:::
:::vulkan
Gör nu uppgiften **bias**. I `ShadowCalculation`:

```glsl
    // calculate bias (based on depth map resolution and slope)
    vec3 normal = normalize(fs_in.normal);
    vec3 lightDir = normalize(ubo.lightPos - fs_in.fragPos);
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    // check whether current frag pos is in shadow
    float shadow = currentDepth - bias > closestDepth ? 1.0 : 0.0;
```
:::
:::d3d12
Gör nu uppgiften **bias**. HLSL har inga globala indata som GLSL:s `fs_in`, så `ShadowCalculation` får normalen och
ljusriktningen som `PSMain` redan har beräknat:

```hlsl
float ShadowCalculation(float4 fragPosLightSpace, float3 normal, float3 lightDir)
```

```hlsl
    // calculate bias (based on depth map resolution and slope)
    float bias = max(0.05f * (1.0f - dot(normal, lightDir)), 0.005f);
    // check whether current frag pos is in shadow
    float shadow = currentDepth - bias > closestDepth ? 1.0f : 0.0f;
```

och `PSMain` anropar `ShadowCalculation(input.fragPosLightSpace, normal, lightDir)`. Direct3D kan också lägga på en bias
i rastreraren, när djupet skrivs: djuppassets PSO har `RasterizerState.DepthBias` och `SlopeScaledDepthBias`. Kursen
håller sig till learnopengls bias i shadern.
:::

Djupet är linjärt från 0 vid near-planet till 1 vid far-planet i alla tre API:erna (projektionen är ortografisk), så
learnopengls biasvärden passar oförändrade. Tryck på **Build & run**: **ränderna är borta**, golvet är belyst som i
starten, och kubens skugga står kvar – med hårda, taggiga kanter.

### Peter panning

En nackdel med shadow bias är att man förskjuter objektens faktiska djup. Biasen kan därför bli så stor att man ser en
förskjutning av skuggorna i förhållande till objektens verkliga placering: skuggan verkar börja en bit från objektets fot,
som om objektet svävade. Den här skuggartefakten kallas *peter panning*, eftersom objekten verkar lite lösgjorda från sina
skuggor (som Peter Pans skugga). I vår scen svävar den svävande kuben ju ändå, så du märker det inte; för kuberna som står
på golvet skulle det synas.

Vi kan lösa det mesta av peter panning-problemet med ett litet trick: front face culling när vi renderar djupkartan. Du
minns kanske från kapitlet *Face culling* att vi normalt cullar baksidorna. När vi renderar djupkartan kunde vi i stället
culla framsidorna: djupkartan lagrar då djupen hos solida objekts baksidor, och biasen skjuter inte längre jämförelsen
förbi framsidorna. Det fungerar för solida objekt – men inte för golvet: det är ett enda plan utan baksida, och med
framsidan bortcullad skulle det inte finnas i djupkartan alls. Därför behåller learnopengl inte det här tricket i sin
slutliga kod, och inte vi heller; det är ingen uppgift.

:::opengl
I OpenGL vore det `glEnable(GL_CULL_FACE); glCullFace(GL_FRONT);` runt `renderScene(simpleDepthShader)`, och
`glCullFace(GL_BACK)` efteråt.
:::
:::vulkan
I Vulkan vore det en inställning i djuppipelinen: `rasterizer.cullMode = VK_CULL_MODE_FRONT_BIT`, med
`frontFace = VK_FRONT_FACE_CLOCKWISE` – ljusets projektion har ingen y-vändning, så kubens moturs sidor syns medurs i
Vulkans framebuffer.
:::
:::d3d12
I Direct3D 12 vore det en inställning i djuppassets pipeline state:
`psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_FRONT` för `m_depthPipelineState`.
:::

En annan sak att tänka på är att objekt som ligger nära skuggmottagaren (som den avlägsna kuben) fortfarande kan ge
felaktiga resultat. Med normala biasvärden kan man dock i allmänhet undvika peter panning.

### Översampling

En annan visuell avvikelse, som du kanske gillar eller ogillar, är att områden utanför ljusets synliga frustum räknas som
skuggade fast de (oftast) inte är det. Det händer eftersom projicerade koordinater utanför ljusets frustum är större än
1.0 och därför samplar djuptexturen utanför dess normala intervall [0,1]. Beroende på texturens wrappningsmetod får vi
felaktiga djupresultat som inte bygger på verkliga djupvärden från ljuskällan. Med den upprepning (repeat) vi har använt
hittills upprepas djupkartans innehåll: långt borta, utanför ljusets låda på 20 × 20, skulle du se kopior av kubernas
skuggor och mörka områden där ingen skugga hör hemma.

Det vi hellre vill ha är att alla koordinater utanför djupkartans intervall har djupet 1.0, vilket betyder att de aldrig
hamnar i skugga (eftersom inget objekt har ett djup större än 1.0). Det gör vi genom att ange en kantfärg (border colour)
och sätta djupkartans wrappning till clamp to border.

:::opengl
```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_BORDER);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_BORDER);
    float borderColor[] = { 1.0, 1.0, 1.0, 1.0 }; // depth 1.0 outside the map: never in shadow
    glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);
```
:::
:::vulkan
I Vulkan är wrappningen och kantfärgen inställningar i samplern. Vulkan har ingen fri kantfärg som OpenGL:s array
`GL_TEXTURE_BORDER_COLOR`, utan några fasta – opakt vitt är den vi behöver. I `createDepthMapSampler()`:

```cpp
        samplerInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER;
        samplerInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER;
        samplerInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER;
        samplerInfo.anisotropyEnable = VK_FALSE;
        samplerInfo.maxAnisotropy = 1.0f;
        samplerInfo.borderColor = VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE;
```
:::
:::d3d12
I Direct3D 12 är wrappningen och kantfärgen inställningar i samplern – här den statiska samplern s1. En statisk sampler
har tre kantfärger att välja mellan: transparent svart, opakt svart och opakt vitt. I root signaturen, efter
`samplers[1].ShaderRegister = 1;`:

```cpp
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_BORDER;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_BORDER;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_BORDER;
        samplers[1].BorderColor = D3D12_STATIC_BORDER_COLOR_OPAQUE_WHITE;
```
:::

Nu returnerar texturfunktionen alltid djupet 1.0 när vi samplar utanför djupkartans koordinatintervall [0,1], vilket ger
skuggvärdet 0.0.

Det verkar finnas ett fall kvar: fragment som ligger längre bort än ljusets far-plan. Deras projicerade z är större än
1.0, så de är större än alla lagrade djup – även kantens 1.0 – och hamnar i skugga. Lösningen är ganska enkel: vi tvingar
skuggvärdet till 0.0 så fort den projicerade vektorns z-koordinat är större än 1.0. Allt bortom far-planet i ljusets
ortografiska frustum räknas alltså som belyst.

:::opengl
Gör nu uppgiften **over-sampling**: kantinställningarna ovan i stället för `GL_REPEAT`, och i `ShadowCalculation`, före
`return`:

```glsl
    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if(projCoords.z > 1.0)
        shadow = 0.0;
```
:::
:::vulkan
Gör nu uppgiften **over-sampling**: samplerinställningarna ovan i stället för `VK_SAMPLER_ADDRESS_MODE_REPEAT` och
`VK_BORDER_COLOR_INT_OPAQUE_BLACK`, och i `ShadowCalculation`, före `return`:

```glsl
    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if (projCoords.z > 1.0)
        shadow = 0.0;
```
:::
:::d3d12
Gör nu uppgiften **over-sampling**: de fyra samplerraderna ovan, och i `ShadowCalculation`, före `return`:

```hlsl
    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if (projCoords.z > 1.0f)
        shadow = 0.0f;
```
:::

Tryck på **Build & run** – och titta noga, för från standardkameran ändrar det här nästan ingenting. Områdena utanför
ljusets frustum ligger långt bort, nära horisonten: bara en tunn mörk linje på det bortre golvet vid fönstrets högra kant
försvinner. Titta nedåt med musen och backa med S – kameran stiger när den backar – tills du ser scenen ovanifrån, så ser
du skillnaden: före den här uppgiften är golvet bortom far-planet mörkt och kopior av skuggorna upprepas långt borta;
efter den är hela det golvet belyst. Det betyder att bara den del av djupkartan som ljusets frustum täcker får skuggor,
medan allt utanför har inga – vilket är vad vi vill i den här scenen.

```quiz
Varför stoppar en vit kantfärg (djup 1.0) översampling utanför djupkartan?
- [ ] Vitt gör golvet ljusare utanför kartan
- [ ] Kantfärgen slår av djuptestet
- [x] Slagningar utanför kartan returnerar djupet 1.0, far-planet; inget fragment inne i frustumet ligger längre bort än så, så inget räknas som skuggat
- [ ] Den får samplern att upprepa kartans kanttexlar
---
Med `REPEAT` läser en slagning utanför kartan någon orelaterad texel i kartan. Med kanten på 1.0 är det lagrade "närmaste djupet" utanför kartan så långt bort det går. Fragment bortom far-planet (z > 1.0) skulle fortfarande förlora den jämförelsen, och därför sätter `ShadowCalculation` också skuggan till 0.0 för dem.
```

### PCF

Skuggorna är nu ett trevligt tillskott till scenen, men det är fortfarande inte riktigt vad vi vill ha. Tittar du noga på
skuggans kanter är de hårda och taggiga: en trappa av djupkartans texlar. Eftersom djupkartan har en fast upplösning
täcker en av dess texlar ofta mer än ett fragment. Följden är att flera fragment samplar samma djupvärde ur djupkartan och
kommer fram till samma skuggslutsats, vilket ger de här taggiga, kantiga kanterna.

Du kan minska de kantiga skuggorna genom att öka djupkartans upplösning, eller genom att försöka passa in ljusets frustum
så tätt kring scenen som möjligt.

En annan (partiell) lösning på de taggiga kanterna kallas PCF, *percentage-closer filtering*, en term som rymmer många
olika filtreringsfunktioner som ger mjukare skuggor, så att de ser mindre kantiga eller hårda ut. Idén är att sampla
djupkartan mer än en gång, varje gång med lite olika texturkoordinater. För varje enskilt sampel kontrollerar vi om det
ligger i skugga eller inte. Alla delresultat kombineras sedan och medelvärdesbildas, och vi får en fin, mjuk skugga.

En enkel implementering av PCF är att helt enkelt sampla de omgivande texlarna i djupkartan och ta medelvärdet av
resultaten. Storleken på en texel är 1 delat med djupkartans storlek i texlar, som shadern kan fråga efter. Vi samplar de
3 × 3 texlarna runt den projicerade koordinaten, testar var och en för skuggning och delar summan med 9.

:::opengl
`textureSize` returnerar en `ivec2` med bredden och höjden på den givna samplerns textur på mipnivå 0; 1 delat med det ger
storleken på en enda texel, som vi använder för att förskjuta texturkoordinaterna:

```glsl
    // PCF: the average of the 3 x 3 depth map texels around the position
    float shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
    for(int x = -1; x <= 1; ++x)
    {
        for(int y = -1; y <= 1; ++y)
        {
            float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth  ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;
```

Gör nu den sista uppgiften, **pcf**: de här raderna ersätter den enkla jämförelsen (lämna den som kommentar); testet
`projCoords.z > 1.0` står kvar efter dem.
:::
:::vulkan
`textureSize` returnerar en `ivec2` med bredden och höjden på den givna samplerns textur på mipnivå 0; 1 delat med det ger
storleken på en enda texel, som vi använder för att förskjuta texturkoordinaterna:

```glsl
    // PCF
    float shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
    for (int x = -1; x <= 1; ++x) {
        for (int y = -1; y <= 1; ++y) {
            float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;
```

Gör nu den sista uppgiften, **pcf**: de här raderna ersätter den enkla jämförelsen (lämna den som kommentar); testet
`projCoords.z > 1.0` står kvar efter dem.
:::
:::d3d12
HLSL frågar en textur om dess storlek med metoden `GetDimensions`, som skriver bredden och höjden i två variabler; 1
delat med dem är storleken på en enda texel, som vi använder för att förskjuta texturkoordinaterna:

```hlsl
    // PCF (percentage-closer filtering): the test for the 3 x 3 texels around the
    // fragment's place, averaged - soft shadow edges
    float shadow = 0.0f;
    uint width, height;
    shadowMap.GetDimensions(width, height);
    float2 texelSize = 1.0f / float2(width, height);
    for (int x = -1; x <= 1; ++x)
    {
        for (int y = -1; y <= 1; ++y)
        {
            float pcfDepth = shadowMap.Sample(shadowSampler, shadowUV + float2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth ? 1.0f : 0.0f;
        }
    }
    shadow /= 9.0f;
```

Gör nu den sista uppgiften, **pcf**: de här raderna ersätter den enkla jämförelsen, och `closestDepth` behövs inte längre;
testet `projCoords.z > 1.0f` står kvar efter dem. (Direct3D har också PCF i hårdvaran: en comparison sampler, till
exempel `D3D12_FILTER_COMPARISON_MIN_MAG_LINEAR_MIP_POINT` med `ComparisonFunc = D3D12_COMPARISON_FUNC_LESS_EQUAL`, och
`SampleCmpLevelZero(…, currentDepth - bias)` i shadern – det är vad Microsofts exempel använder. Kursen använder
learnopengls loop.)
:::

Tryck på **Build & run**: skuggans **kanter blir mjuka**. Inne i skuggan och på det belysta golvet ändras ingenting, men
kantpixlarna får nu mellanvärden: där 3 av de 9 samplen ligger i skugga är fragmentet till en tredjedel skuggat. På
avstånd ser skuggorna mycket bättre och mindre hårda ut. Zoomar du in kan du fortfarande se shadow mappingens
upplösningsartefakter, men i allmänhet ger det här bra resultat för de flesta tillämpningar.

```quiz
Med 3 × 3-PCF:n hittar ett fragment på skuggans kant 6 av de 9 samplen i skugga. Vilket värde får dess `shadow`?
- [ ] 1.0 – ett sampel i skugga räcker
- [ ] 0.0 – mittsamplet avgör
- [ ] 0.5 – PCF känner bara till belyst och halvbelyst
- [x] 6 / 9 ≈ 0.67: dess diffusa och spekulära ljus minskas till en tredjedel
---
PCF tar medelvärdet av de binära testresultaten för närliggande texlar. Längs kanten ändras andelen skymda sampel gradvis från 0 till 1, vilket gör den hårda trappan till en mjuk övergång.
```

Det finns faktiskt mycket mer att säga om PCF och en hel del tekniker för att avsevärt förbättra kvaliteten på mjuka
skuggor, men för att hålla kapitlet lagom långt lämnar vi det till en senare diskussion.

## Ortografisk eller perspektiv

Det är skillnad på att rendera djupkartan med en ortografisk eller en perspektivisk projektionsmatris. En ortografisk
projektionsmatris förvränger inte scenen med perspektiv, så alla blick- och ljusstrålar är parallella. Det gör den till en
utmärkt projektionsmatris för riktade ljus. En perspektivisk projektionsmatris förvränger däremot alla vertices utifrån
perspektivet, vilket ger andra resultat.

Perspektivprojektioner är mest meningsfulla för ljuskällor som har en verklig position, till skillnad från riktade ljus.
Perspektivprojektioner används oftast med strålkastare och punktljus, medan ortografiska projektioner används för
riktade ljus.

En annan subtil skillnad med en perspektivisk projektionsmatris är att en visualisering av djupbuffern ofta blir nästan
helt vit. Det beror på att djupet med perspektivprojektion omvandlas till icke-linjära djupvärden, där det mesta av det
märkbara intervallet ligger nära near-planet. För att kunna se djupvärdena ordentligt, som vi gjorde med den ortografiska
projektionen, vill du först omvandla de icke-linjära djupvärdena till linjära, som vi gick igenom i kapitlet
*Djuptestning*.

:::opengl
Det är funktionen `LinearizeDepth` som redan finns i `debug_quad_depth.fs` – med den bortkommenterade raden
`FragColor = vec4(vec3(LinearizeDepth(depthValue) / far_plane), 1.0); // perspective` skulle du använda den:

```glsl
// required when using a perspective projection matrix
float LinearizeDepth(float depth)
{
    float z = depth * 2.0 - 1.0; // Back to NDC
    return (2.0 * near_plane * far_plane) / (far_plane + near_plane - z * (far_plane - near_plane));
}
```
:::
:::vulkan
I Vulkan är djupet redan 0..1 i NDC, så kapitlet *Djuptestning*s version för djup på 0..1 gäller – utan OpenGL:s steg
`depth * 2.0 - 1.0`: `(near * far) / (far - depth * (far - near))`.
:::
:::d3d12
I Direct3D är djupet redan 0..1 i NDC, så kapitlet *Djuptestning*s version för djup på 0..1 gäller – utan OpenGL:s steg
`depth * 2.0 - 1.0`: `(near * far) / (far - depth * (far - near))`.
:::

Det här liknar det vi gjorde i kapitlet om djuptestning. Skuggor från punktljus, som lyser åt alla håll, behöver ännu mer
än en perspektivprojektion – en djupkarta per riktning, en cube map. Det är ämnet för de kommande kapitlen: *Point
Shadows*, och senare cascaded shadow maps för stora utomhusscener.

## Mer att läsa

:::opengl
- [Shadow Mapping](https://learnopengl.com/Advanced-Lighting/Shadows/Shadow-Mapping): learnopengls kapitel som det här
  kapitlet följer, med bilderna av djupkartan, shadow acne och peter panning.
- [shadow_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/3.1.3.shadow_mapping/shadow_mapping.cpp):
  learnopengls slutliga program.
- [Common Techniques to Improve Shadow Depth Maps](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/common-techniques-to-improve-shadow-depth-maps):
  en klassisk artikel om bias, att passa in ljusets frustum och PCF (skriven för Direct3D, giltig för alla API:er).
:::
:::vulkan
- [Shadow Mapping](https://learnopengl.com/Advanced-Lighting/Shadows/Shadow-Mapping): learnopengls kapitel som det här
  kapitlet följer, med bilderna av djupkartan, shadow acne och peter panning.
- [Render pass](https://docs.vulkan.org/spec/latest/chapters/renderpass.html): kapitlet i Vulkanspecifikationen om render
  passes, attachments, load/store-operationer och subpass dependencies.
- [Common Techniques to Improve Shadow Depth Maps](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/common-techniques-to-improve-shadow-depth-maps):
  en klassisk artikel om bias, att passa in ljusets frustum och PCF (skriven för Direct3D, giltig för alla API:er).
:::
:::d3d12
- [Shadow Mapping](https://learnopengl.com/Advanced-Lighting/Shadows/Shadow-Mapping): learnopengls kapitel som det här
  kapitlet följer, med bilderna av djupkartan, shadow acne och peter panning.
- [Walkthrough: Implement shadow volumes using depth buffers in Direct3D 11](https://learn.microsoft.com/en-us/windows/uwp/gaming/implementing-depth-buffers-for-shadow-mapping):
  Microsofts genomgång av shadow maps – den typlösa djuptexturen, comparison samplern, passen (Direct3D 11; idéerna är
  desamma).
- [Common Techniques to Improve Shadow Depth Maps](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/common-techniques-to-improve-shadow-depth-maps):
  en klassisk artikel om bias, att passa in ljusets frustum och PCF.
:::
