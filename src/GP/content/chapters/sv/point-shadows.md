# Punktskuggor

I förra kapitlet lärde vi oss att skapa dynamiska skuggor med shadow mapping. Det fungerar utmärkt, men passar mest för
riktade ljus (eller spotlights), eftersom skuggorna bara skapas i ljuskällans riktning. Därför kallas tekniken också
*riktad shadow mapping*: djupkartan (shadow mapen) skapas bara från den riktning som ljuset tittar åt.

Det här kapitlet handlar om att skapa dynamiska skuggor i alla riktningar runt ljuset. Tekniken passar perfekt för
punktljus, eftersom ett riktigt punktljus kastar skuggor åt alla håll. Den kallas punkt(ljus)skuggor eller, mer formellt,
*rundstrålande shadow maps* (omnidirectional shadow maps).

Tekniken liknar till största delen riktad shadow mapping: vi skapar en djupkarta från ljusets perspektiv, samplar den
utifrån det aktuella fragmentets position och jämför varje fragment med det lagrade djupvärdet för att se om det ligger
i skugga. Den stora skillnaden mellan riktad och rundstrålande shadow mapping är djupkartan vi använder: i stället för en
2D-djuptextur en **djup-cube map** som lagrar det närmaste djupet i varje riktning runt ljuset. Återigen är det samma
teknik i alla API:er; det här kapitlet visar var {{api}} lägger cube mapen, passet som fyller alla dess sex sidor på en
gång, och uppslagningen.

:::opengl
Projektet är learnopengls scen: ett rum – learnopengls kub på 2 × 2 × 2 från `renderCube()`, skalad med 5 så att
väggarna ligger på ±5 – med fem träkuber i, alla ritade av `renderScene(const Shader &shader)`. Rummet ritas med face
culling avstängt och uniformen `reverse_normals` satt till 1: dess normaler pekar utåt, och vertex shadern vänder dem så
att insidan blir belyst (learnopengls "small little hack"). De fem kuberna ritas med culling på. Ljuset står på
`lightPos` (0, 0, 0), mitt i rummet. learnopengl flyttar det fram och tillbaka med
`lightPos.z = static_cast<float>(sin(glfwGetTime() * 0.5) * 3.0);` – den raden finns i renderloopen som kommentar, så
bilden ändras inte med tiden; ta bort kommentaren om du vill, så sveper skuggorna över väggarna.
`point_shadows.vs/.fs` belyser scenen som i förra kapitlet: ljusfärgen 0.3, ambient, diffust och Blinn-Phong-spekulärt,
kombinerat som `(ambient + (1.0 - shadow) * (diffuse + specular)) * color` – med `float shadow = 0.0;` tills vidare.
`shader_m.h` är Shader-klassen med den valfria geometry shader-filen från kapitlet *Geometry shader*, och de tre
djupshadrarna `point_shadows_depth.vs/.gs/.fs` finns med sina deklarationer; deras `main`-funktioner är ditt jobb.
:::
:::vulkan
Projektet är learnopengls scen: ett rum – vertexbufferns enda kub (learnopengls kub på 2 × 2 × 2 från `renderCube()`,
36 vertex, v vänt som i de tidigare kapitlen) skalad med 5, så att väggarna ligger på ±5 – med fem träkuber i.
learnopengls `renderScene()` är hjälpfunktionen `renderScene(VkCommandBuffer commandBuffer)`, som pushar varje draws
`PushConstants` (`glm::mat4 model; VkBool32 reverse_normals;`, vertexsteget) och spelar in `vkCmdDraw(commandBuffer, 36,
1, 0, 0)` sex gånger. Rummet får `reverse_normals = VK_TRUE`: dess normaler pekar utåt, och vertex shadern vänder dem så
att insidan blir belyst (learnopengls "small little hack"). Ljuset är den globala `lightPos` (0, 0, 0), mitt i rummet.
learnopengl flyttar det med `lightPos.z = sin(glfwGetTime() * 0.5) * 3.0`; här står det still, så bilden ändras inte med
tiden. `shaders/point_shadows.vert/.frag` belyser scenen som i förra kapitlet: ljusfärgen 0.3, ambient, diffust och
Blinn-Phong-spekulärt, kombinerat som `(ambient + (1.0 - shadow) * (diffuse + specular)) * color` – med
`float shadow = 0.0;` tills vidare. Djupshadrarna `point_shadows_depth.vert/.geom/.frag` är tomma stubbar.
`createPipeline` tar en valfri geometry shader (`""` = ingen), som i kapitlet *Geometry shader*.
:::
:::d3d12
Projektet är learnopengls scen: ett rum – vertexbufferns enda kub (learnopengls kub på 2 × 2 × 2 från `renderCube()`,
36 vertex, v vänt för Direct3D) skalad med 5, så att väggarna ligger på ±5 – med fem träkuber i. learnopengls
`renderScene()` är medlemsfunktionen `RenderScene()`: den sätter varje draws `ModelConstants` (`model`, `normalMatrix`
och `BOOL reverseNormals`, 33 root constants) med `SetGraphicsRoot32BitConstants(0, …)` och anropar
`DrawInstanced(36, 1, 0, 0)` sex gånger. `PopulateCommandList` anropar den en gång per pass. Rummet får
`reverseNormals = TRUE`: dess normaler pekar utåt, och vertex shadern vänder dem så att insidan blir belyst
(learnopengls "small little hack"). Ljuset är den globala `lightPos` (0, 0, 0), mitt i rummet; learnopengl flyttar det
med `lightPos.z = sin(glfwGetTime() * 0.5) * 3.0`, här står det still, så bilden ändras inte med tiden.
`point_shadows.hlsl` belyser scenen som i förra kapitlet: ljusfärgen 0.3, ambient, diffust och Blinn-Phong-spekulärt,
kombinerat som `(ambient + (1.0f - shadow) * (diffuse + specular)) * color` – med `float shadow = 0.0f;` tills vidare.
`point_shadows_depth.hlsl` har sina constant buffers och structar; dess tre ingångspunkter är ditt jobb (filen
kompileras inte förrän dess).
:::

Kameran står på (0, 0, 3) och tittar längs -z: rummets bakre vägg (z = -5) fyller fönstret, med träet utsträckt över
dess 10 × 10 enheter och ett mjukt högdager lite till vänster om mitten. Bara en av de fem kuberna syns – den vridna på
(-1.5, 2, -3), i övre vänstra hörnet. Bygg och kör programmet: rummet är belyst, men ingenting kastar någon skugga.
Kommentarerna `// TODO:` i projektet visar var din kod ska in.

## Att skapa djup-cube mapen

För att skapa en cube map med djupvärden runt omkring måste vi rendera scenen 6 gånger: en gång per sida. Ett (ganska
uppenbart) sätt är att rendera scenen 6 gånger med 6 olika vymatriser och varje gång koppla en annan sida av cube mapen
till framebuffern. Det är dock ganska dyrt, eftersom det krävs många renderanrop för en enda djupkarta. I det här kapitlet
använder vi ett alternativt (mer organiserat) sätt med ett litet trick i geometry shadern, som låter oss bygga
djup-cube mapen med ett enda render pass: geometry shadern skickar varje triangel till alla sex sidorna.

Djup-cube mapen är sex djuptexturer på 1024 × 1024 – en per sida – som man kan rita i som ett enda *lager*-attachment
(layered) och sedan sampla som en cube map.

:::opengl
Först behöver vi skapa en cube map:

```cpp
    unsigned int depthCubemap;
    glGenTextures(1, &depthCubemap);
```

Och ge var och en av cube mapens sidor en 2D-textur med djupvärden:

```cpp
    const unsigned int SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;
    glBindTexture(GL_TEXTURE_CUBE_MAP, depthCubemap);
    for (unsigned int i = 0; i < 6; ++i)
        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
```

Och glöm inte texturparametrarna:

```cpp
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
```

Normalt skulle vi koppla en enda sida av cube mapen till framebuffern och rendera scenen 6 gånger, och varje gång byta
framebufferns djupbuffer till en annan sida. Eftersom vi ska använda en geometry shader, som låter oss rendera till alla
sidor i ett enda pass, kan vi koppla hela cube mapen direkt som framebufferns djup-attachment med
`glFramebufferTexture`:

```cpp
    // attach depth texture as FBO's depth buffer: all six faces at once (a layered attachment)
    glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
    glFramebufferTexture(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, depthCubemap, 0);
    glDrawBuffer(GL_NONE); // no colour buffer
    glReadBuffer(GL_NONE);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Lägg märke till att `2D` och texturmålet saknas: `glFramebufferTexture2D` kopplar en bild – en sida – medan
`glFramebufferTexture` med en cube map kopplar alla sex sidorna som ett *lager*-attachment. Lägg också märke till
anropen till `glDrawBuffer` och `glReadBuffer`: vi bryr oss bara om djupvärden när vi skapar djup-cube mapen, så vi
måste uttryckligen tala om för OpenGL att framebuffern inte renderar till någon färgbuffer.
:::
:::vulkan
I Vulkan är en cube map ingen annan sorts bild: den är en 2D-bild med **sex array-lager** – sidorna +X, -X, +Y, -Y, +Z,
-Z, i den ordningen (OpenGL:s `GL_TEXTURE_CUBE_MAP_POSITIVE_X + i`) – skapad med en flagga som tillåter en kub-*vy* av
den. `createDepthCubemap()` skapar den direkt med `vkCreateImage`, eftersom hjälpfunktionen `createImage` bara känner
till ett lager:

```cpp
        VkImageCreateInfo imageInfo{};
        imageInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
        imageInfo.flags = VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT; // its six layers can be viewed as a cube map
        imageInfo.imageType = VK_IMAGE_TYPE_2D;
        imageInfo.extent.width = SHADOW_WIDTH;
        imageInfo.extent.height = SHADOW_HEIGHT;
        imageInfo.extent.depth = 1;
        imageInfo.mipLevels = 1;
        imageInfo.arrayLayers = 6; // one layer per face
        imageInfo.format = depthMapFormat;
        imageInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
        imageInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        imageInfo.usage = VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT;
```

`SHADOW_WIDTH` och `SHADOW_HEIGHT` är 1024, storleken på varje sida. `depthMapFormat` kommer från
`findDepthMapFormat()` – ett djupformat som går att rita i och sampla, som i förra kapitlet – och usage anger återigen
båda sakerna vi ska göra med bilden. Minnet allokeras och binds som för vilken bild som helst. Sedan en vy av alla sex
lagren, som en kub:

```cpp
        // all six layers as a cube map (sampled with a direction: samplerCube)
        VkImageViewCreateInfo viewInfo{};
        viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
        viewInfo.image = depthCubemapImage;
        viewInfo.viewType = VK_IMAGE_VIEW_TYPE_CUBE;
        viewInfo.format = depthMapFormat;
        viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_DEPTH_BIT;
        viewInfo.subresourceRange.baseMipLevel = 0;
        viewInfo.subresourceRange.levelCount = 1;
        viewInfo.subresourceRange.baseArrayLayer = 0;
        viewInfo.subresourceRange.layerCount = 6;
```

Samma vy är framebufferns attachment – för en framebuffer är den helt enkelt sex lager. learnopengls
`glFramebufferTexture` med hela cube mapen, ett *lager*-attachment, blir en framebuffer med `layers = 6`:

```cpp
        // the same view is the framebuffer's depth attachment, with all six layers (a "layered" framebuffer)
        VkFramebufferCreateInfo framebufferInfo{};
        framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
        framebufferInfo.renderPass = depthMapRenderPass;
        framebufferInfo.attachmentCount = 1;
        framebufferInfo.pAttachments = &depthCubemapImageView;
        framebufferInfo.width = SHADOW_WIDTH;
        framebufferInfo.height = SHADOW_HEIGHT;
        framebufferInfo.layers = 6;
```

`depthMapRenderPass` är förra kapitlets render pass för bara djup, oförändrat (`createDepthMapRenderPass()`): ett
djup-attachment med `loadOp` CLEAR och `storeOp` STORE, `finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL`,
`colorAttachmentCount = 0` och de två subpass dependencies. Rensningen och layoutövergångarna gäller alla sex lagren.
`createDepthCubemapSampler()` skapar `depthCubemapSampler` med `VK_FILTER_NEAREST` och
`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE` på U, V och W (learnopengl: `GL_NEAREST`, `GL_CLAMP_TO_EDGE`), och descriptor
setet får cube mapen på binding 2, i den layout som passet lämnar den i:

```cpp
        VkDescriptorImageInfo depthMapInfo{};
        depthMapInfo.imageLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL; // the depth map pass's finalLayout
        depthMapInfo.imageView = depthMapView;
        depthMapInfo.sampler = depthMapSampler;
```

(`createDescriptorSet` tar cube mapens vy och sampler som parametrar; poolen rymmer nu två combined image samplers.)
:::
:::d3d12
I Direct3D 12 är en cube map inte heller någon annan sorts resurs: den är en 2D-textur med **sex array-skivor** (array
slices) – sidorna +X, -X, +Y, -Y, +Z, -Z, i den ordningen – och det är en *vy* som säger "läs de här sex skivorna som en
kub". Djup-cube mapen är förra kapitlets shadow map med `DepthOrArraySize = 6`: typlös, så att den kan få både en depth
stencil view och en shader resource view:

```cpp
        // R32_TYPELESS: the same 32 bits per texel are a D32_FLOAT depth to the depth stencil
        // view and an R32_FLOAT colour to the shader resource view. DepthOrArraySize = 6.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC cubemapDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R32_TYPELESS, SHADOW_WIDTH, SHADOW_HEIGHT, 6, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL);
```

`SHADOW_WIDTH` och `SHADOW_HEIGHT` är 1024, storleken på varje sida. Den skapas i tillståndet `DEPTH_WRITE` med
rensningsvärdet 1.0 (`D32_FLOAT`), som shadow mapen. Dess depth stencil view täcker alla sex skivorna – en
`Texture2DArray`-vy. Det är learnopengls `glFramebufferTexture` med hela cube mapen, ett *lager*-attachment:

```cpp
        D3D12_DEPTH_STENCIL_VIEW_DESC dsvDesc = {};
        dsvDesc.Format = DXGI_FORMAT_D32_FLOAT;
        dsvDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2DARRAY;
        dsvDesc.Flags = D3D12_DSV_FLAG_NONE;
        dsvDesc.Texture2DArray.MipSlice = 0;
        dsvDesc.Texture2DArray.FirstArraySlice = 0;
        dsvDesc.Texture2DArray.ArraySize = 6;
        CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_dsvDescriptorSize);
        m_device->CreateDepthStencilView(m_depthCubemap.Get(), &dsvDesc, dsvHandle);
```

och dess shader resource view läser samma sex skivor som en kub:

```cpp
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R32_FLOAT;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE;
        srvDesc.TextureCube.MostDetailedMip = 0;
        srvDesc.TextureCube.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_device->CreateShaderResourceView(m_depthCubemap.Get(), &srvDesc, srvHandle);
```

Resten är förra kapitlets rörmokeri: DSV:n hamnar på plats 1 i DSV-heapen (`NumDescriptors = 2`,
`m_dsvDescriptorSize`), SRV:n på plats 2 i CBV/SRV-heapen (`NumDescriptors = 3`), direkt efter träets, så texturernas
descriptor table växer till två register – `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0)`, t0 träet, t1 cube
mapen. Dess statiska sampler s1 är en kopia av s0 med punktfiltrering och clamp (learnopengl: `GL_NEAREST`,
`GL_CLAMP_TO_EDGE`):

```cpp
        samplers[1] = samplers[0];
        samplers[1].Filter = D3D12_FILTER_MIN_MAG_MIP_POINT;
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].ShaderRegister = 1;
```
:::

:::opengl
```quiz
Varför kopplas djup-cube mapen med `glFramebufferTexture` i stället för `glFramebufferTexture2D`?
- [x] `glFramebufferTexture` kopplar hela cube mapen – alla sex sidorna – som ett lager-attachment, så att ett pass kan rita i varje sida; `glFramebufferTexture2D` kopplar en enda sida
- [ ] `glFramebufferTexture2D` kan inte koppla djuptexturer
- [ ] `glFramebufferTexture` skapar lagringen för de sex sidorna
- [ ] Eftersom en framebuffer med en cube map inte behöver `glDrawBuffer(GL_NONE)`
---
Med ett lager-attachment väljer geometry shadern sidan (lagret) för varje triangel. Med enstaka sidor skulle du koppla och rendera sex gånger.
```
:::
:::vulkan
```quiz
Vad gör att en och samma bild kan användas både som passets djup-attachment med sex lager och som `samplerCube` efteråt?
- [ ] Sex separata bilder, en per sida, och sex framebuffers
- [ ] `VK_IMAGE_VIEW_TYPE_2D_ARRAY` för båda användningarna och `layers = 1`
- [ ] Bara `VK_IMAGE_USAGE_SAMPLED_BIT`
- [x] `arrayLayers = 6` med `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, en `VK_IMAGE_VIEW_TYPE_CUBE`-vy av de sex lagren, en framebuffer med `layers = 6`, och usage depth attachment + sampled
---
En cube map är en 2D-bild med sex lager som får ses som en kub. Framebuffern ser vyns sex lager, geometry shadern väljer ett per triangel, och shadern samplar samma vy med en riktning.
```
:::
:::d3d12
```quiz
Vilka vyer får resursen `R32_TYPELESS` med sex skivor, och varför?
- [ ] Sex 2D-depth stencil views, en per sida, och sex shader resource views
- [x] En `D32_FLOAT`-depth stencil view av typen `TEXTURE2DARRAY` över alla sex skivorna, för att rita i varje sida i ett pass, och en `R32_FLOAT`-shader resource view av typen `TEXTURECUBE`, för att sampla den med en riktning
- [ ] En `TEXTURECUBE`-depth stencil view och en `TEXTURE2DARRAY`-shader resource view
- [ ] Bara en render target view: pixel shadern skriver avstånden som färger
---
Resursen är bara sex skivor. DSV:n gör dem till en djupbuffer i lager (geometry shadern väljer skivan); SRV:n gör samma skivor till en cube map. Det typlösa formatet låter varje vy tolka bitarna som den behöver.
```
:::

### Transformationen till ljusrymden

Med framebuffern och cube mapen på plats behöver vi ett sätt att transformera all scenens geometri till de relevanta
ljusrymderna i ljusets alla 6 riktningar. Precis som i kapitlet om shadow mapping behöver vi en transformationsmatris *T*
till ljusrymden, men den här gången en för varje sida.

Varje sådan matris innehåller både en projektionsmatris och en vymatris. Som projektionsmatris använder vi en
perspektivprojektion: ljuskällan är en punkt i rummet, så perspektivprojektion är det rimligaste. Alla sex matriserna
använder samma projektionsmatris. Viktigt här är projektionens synfält (field of view), som vi sätter till 90 grader.
Med 90 grader blir synfältet precis stort nog att fylla en sida av cube mapen, så att alla sidor passar ihop i kanterna.
Bildförhållandet är 1 (sidorna är kvadratiska), det främre planet 1.0 och det bakre planet 25.0.

```quiz
Varför använder ljusets projektion ett synfält på exakt 90° och bildförhållandet 1?
- [ ] Ett mindre synfält ger cube mapen mer upplösning, men 90° är det största en projektion tillåter
- [ ] Eftersom rummet är en kub
- [x] Sett från kubens mitt spänner varje sida över exakt 90° åt båda hållen: de sex frustumen fyller alla riktningar runt ljuset utan luckor eller överlapp
- [ ] För att djupvärdena ska bli linjära
---
Med mindre än 90° skulle det finnas riktningar som ingen sida täcker, med mer skulle sidorna överlappa och deras kanter inte mötas. Bildförhållandet är 1 eftersom varje sida är kvadratisk.
```

Eftersom projektionsmatrisen inte ändras per riktning kan vi återanvända den för alla 6 transformationsmatriserna. Vi
behöver däremot en egen vymatris per riktning. Med en lookAt-funktion skapar vi 6 vyriktningar, var och en mot en sida
av cube mapen, i ordningen höger, vänster, upp, ner, nära och fjärran – +X, -X, +Y, -Y, +Z, -Z, ordningen på cube
mapens sidor.

*Upp*-vektorerna ser konstiga ut till en början: (0, -1, 0) för fyra av sidorna, (0, 0, 1) och (0, 0, -1) för översidan
och undersidan. De kommer från hur en uppslagning i en cube map fungerar. En uppslagning med en riktning väljer sidan
efter riktningens största komponent och platsen på sidan efter de två andra – med en fast tabell, likadan i OpenGL,
Vulkan och Direct3D. På de fyra sidoväggarna växer sidans t- (eller v-)koordinat *nedåt*: sidans första rad är dess
överkant, världens +y. Att rendera en sida med "upp" = -y lägger världens +y i sidans första rad – precis där
uppslagningen väntar sig den. Så de här lookAt-anropen ritar varje sida exakt som uppslagningen kommer att läsa den.
(+X-sidans högervektor är till exempel cross(+x, -y) = -z, och tabellen låter också +X-sidans s-koordinat gå längs -z.)

```quiz
Varför använder fyra av de sex ljusvyerna (0, -1, 0) som upp-vektor?
- [x] På en cube maps sidoväggar växer t-koordinaten nedåt (den första raden är världens +y-sida); att rendera med upp = -y lagrar varje sida så som en uppslagning i cube mapen läser den
- [ ] Eftersom ljuset hänger från taket
- [ ] För att vända trianglarnas vindningsordning för face culling
- [ ] Det spelar ingen roll: varje upp-vektor vinkelrät mot vyriktningen ger samma sida
---
Vilken sida en uppslagning väljer och platsen på den sidan bestäms av en tabell som alla API:er delar. learnopengls mål och upp-vektorer ger exakt den layouten, så de är desamma i alla tre API:erna.
```

:::opengl
```cpp
        float near_plane = 1.0f;
        float far_plane  = 25.0f;
        glm::mat4 shadowProj = glm::perspective(glm::radians(90.0f), (float)SHADOW_WIDTH / (float)SHADOW_HEIGHT, near_plane, far_plane);
        std::vector<glm::mat4> shadowTransforms;
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)));
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3(-1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)));
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  1.0f,  0.0f), glm::vec3(0.0f,  0.0f,  1.0f)));
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f, -1.0f,  0.0f), glm::vec3(0.0f,  0.0f, -1.0f)));
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  0.0f,  1.0f), glm::vec3(0.0f, -1.0f,  0.0f)));
        shadowTransforms.push_back(shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  0.0f, -1.0f), glm::vec3(0.0f, -1.0f,  0.0f)));
```

Här skapar vi 6 vymatriser och multiplicerar dem med projektionsmatrisen, vilket ger 6 olika transformationsmatriser till
ljusrymden. `target`-parametern till `glm::lookAt` pekar var gång mot en sida av cube mapen. Matriserna skickas till
shadrarna som renderar djupet i cube mapen. De beräknas varje bildruta i början av renderloopen (`// 0.`), så ett ljus
som rör sig skulle också fungera.
:::
:::vulkan
De sex matriserna hamnar i uniformbuffern, som växer med `far_plane` (på `pad2`:s plats) och en array med sex matriser:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float pad1;
    glm::vec3 lightPos;
    float far_plane; // the depth pass stores distance / far_plane
    glm::mat4 shadowMatrices[6]; // world space -> the clip space of each face of the cube map, seen from the light
};
```

std140 låter en float fylla de sista 4 byten av en vec3:s 16-byteplats, så `far_plane` ligger på offset 156, direkt
efter `lightPos`, och matrisarrayen börjar på 160, en multipel av 16 som std140 kräver. `updateUniformBuffer()`
beräknar dem:

```cpp
        float near_plane = 1.0f;
        float far_plane = 25.0f;
        glm::mat4 shadowProj = glm::perspective(glm::radians(90.0f), (float) SHADOW_WIDTH / (float) SHADOW_HEIGHT, near_plane, far_plane);
        ubo.shadowMatrices[0] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f));
        ubo.shadowMatrices[1] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3(-1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f));
        ubo.shadowMatrices[2] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  1.0f,  0.0f), glm::vec3(0.0f,  0.0f,  1.0f));
        ubo.shadowMatrices[3] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f, -1.0f,  0.0f), glm::vec3(0.0f,  0.0f, -1.0f));
        ubo.shadowMatrices[4] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  0.0f,  1.0f), glm::vec3(0.0f, -1.0f,  0.0f));
        ubo.shadowMatrices[5] = shadowProj * glm::lookAt(lightPos, lightPos + glm::vec3( 0.0f,  0.0f, -1.0f), glm::vec3(0.0f, -1.0f,  0.0f));
        ubo.far_plane = far_plane;
```

**Ingen** `shadowProj[1][1] *= -1` här. Kamerans projektion har den vändningen för att bilden ska stå rätt i fönstret;
sidorna måste i stället lagras så som uppslagningen i cube mapen läser dem. I OpenGL hamnar NDC y = -1 på en sidas första
rad (rad 0 är botten i OpenGL:s framebuffers). I Vulkan hamnar NDC y = -1 också på rad 0 – toppen i dess framebuffers,
men samma rad i minnet. Så learnopengls matriser lagrar precis samma texlar i Vulkan, och samma uppslagning läser dem. En
vändning skulle lagra varje sida upp och ner.
:::
:::d3d12
De sex matriserna hamnar i constant buffern, efter `projection`, och `far_plane` tar paddingens plats efter `viewPos`
(en float får fylla resten av en float3:s 16-byterad):

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT4X4 shadowMatrices[6];    // the light's view and projection, one per cube face
        XMFLOAT3 viewPos;
        float far_plane;                 // the depth cubemap holds distance / far_plane
        XMFLOAT3 lightPos;
        float padding1;
    };
```

med samma medlemmar i samma ordning i shadrarnas `cbuffer SceneConstantBuffer`. `OnUpdate` beräknar dem:

```cpp
    float near_plane = 1.0f;
    float far_plane = 25.0f;
    XMMATRIX shadowProj = XMMatrixPerspectiveFovRH(XMConvertToRadians(90.0f), static_cast<float>(SHADOW_WIDTH) / static_cast<float>(SHADOW_HEIGHT), near_plane, far_plane)
        * XMMatrixScaling(1.0f, -1.0f, 1.0f);
    XMVECTOR light = XMLoadFloat3(&lightPos);
    XMMATRIX shadowTransforms[6] =
    {
        XMMatrixLookAtRH(light, light + XMVectorSet( 1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj,    // +X
        XMMatrixLookAtRH(light, light + XMVectorSet(-1.0f,  0.0f,  0.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj,    // -X
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f,  1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f,  1.0f, 0.0f)) * shadowProj,    // +Y
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f, -1.0f,  0.0f, 0.0f), XMVectorSet(0.0f,  0.0f, -1.0f, 0.0f)) * shadowProj,    // -Y
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f,  0.0f,  1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj,    // +Z
        XMMatrixLookAtRH(light, light + XMVectorSet( 0.0f,  0.0f, -1.0f, 0.0f), XMVectorSet(0.0f, -1.0f,  0.0f, 0.0f)) * shadowProj     // -Z
    };
    for (int i = 0; i < 6; ++i)
        XMStoreFloat4x4(&constantBufferData.shadowMatrices[i], XMMatrixTranspose(shadowTransforms[i]));
    constantBufferData.far_plane = far_plane;
```

Med DirectXMath:s radvektorer kommer vyn först: `lookAt * shadowProj`. Målen och upp-vektorerna är learnopengls, men
projektionen följs av `XMMatrixScaling(1.0f, -1.0f, 1.0f)`, som gör klipprymdens y till -y. Därför: cube mapens sidor är
upplagda likadant i alla API:er (rad 0 är sidans överkant), men vilken NDC y som hamnar på rad 0 när man ritar i en sida
skiljer sig. OpenGL lägger NDC y = -1 där; Direct3D lägger NDC y = +1 där – överkanten av ett render target, som
fönstrets överkant. Med learnopengls matriser oförändrade skulle varje sida lagras upp och ner, och skuggorna hamna på
fel ställen. Vändningen rättar till det. (Alternativet är Direct3D:s egen konvention: `XMMatrixLookAtLH` med upp +y för
sidoväggarna och (0, 0, -1) / (0, 0, 1) för ±Y.) En vändning vänder också trianglarnas vindningsordning – det skulle
spela roll för face culling, men pipeline states här cullar ingenting (se nedan).
:::

### Djupshadrarna

För att rendera djupvärden till en djup-cube map behöver vi totalt tre shadrar: en vertex shader och en fragment shader,
och en geometry shader emellan.

Geometry shadern är den som transformerar alla vertex i världsrymden till de 6 olika ljusrymderna. Därför transformerar
vertex shadern bara vertex till världsrymden och skickar dem vidare till geometry shadern.

Geometry shadern tar som indata en triangels 3 vertex och en array med transformationsmatriser till ljusrymden. Den
ansvarar för att transformera vertexen till ljusrymderna, och här blir det intressant. Geometry shadern har en inbyggd
utdata som anger vilken sida (vilket lager) av cube mapen en primitiv ska skickas till. Eftersom vi är i geometry
shadern kan vi loopa sex gånger över sidorna: för varje sida sätter vi den utdatan, transformerar sedan triangelns tre
vertex med sidans matris och skickar ut dem. Så varje triangel skickas ut sex gånger – högst 6 × 3 = 18 vertex.

Fragment shadern beräknar sedan sitt eget djup: det linjära avståndet mellan fragmentets position och ljuskällans
position, delat med `far_plane` för att hamna i [0,1], och skriver det som fragmentets djup. Geometry shadern skickar
världspositionen vidare så att fragment shadern kan göra det. Varför ett eget djup? För att uppslagningen kommer att
jämföra avstånd: i andra passet känner vi fragmentets avstånd till ljuset, inte dess djup i någon sidas projektion – och
ett avstånd är detsamma i alla riktningar, vilken sida det än lagras på.

```quiz
Vad gör djuppassets geometry shader med varje triangel den får?
- [ ] Den väljer den enda sida som triangeln vetter mot och skickar ut den en gång
- [x] Den skickar ut triangeln sex gånger, varje gång med en sidas ljusmatris och den sidans index som lagret att rita i
- [ ] Den delar den i sex mindre trianglar, en per sida
- [ ] Den skickar ut den en gång; rastreraren kopierar den till alla sex lagren
---
En triangel kan synas från flera sidor (den kan korsa en sidas kant), så learnopengl skickar helt enkelt varje triangel till varje sida; klippningen mot varje sidas frustum kastar det som den sidan inte ser.
```

:::opengl
Vertex shadern, `point_shadows_depth.vs`:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

uniform mat4 model;

void main()
{
    gl_Position = model * vec4(aPos, 1.0); // world space: the geometry shader projects it once per cube map face
}
```

Geometry shadern, `point_shadows_depth.gs`:

```glsl
#version 330 core
layout (triangles) in;
layout (triangle_strip, max_vertices=18) out;

uniform mat4 shadowMatrices[6];

out vec4 FragPos; // FragPos from GS (output per emitvertex)

void main()
{
    for(int face = 0; face < 6; ++face)
    {
        gl_Layer = face; // built-in variable that specifies to which face we render.
        for(int i = 0; i < 3; ++i) // for each triangle's vertices
        {
            FragPos = gl_in[i].gl_Position;
            gl_Position = shadowMatrices[face] * FragPos;
            EmitVertex();
        }
        EndPrimitive();
    }
}
```

Geometry shadern tar en triangel som indata och skickar ut totalt 6 trianglar (6 * 3 blir 18 vertex). Den inbyggda
variabeln `gl_Layer` anger vilken sida av cube mapen en primitiv skickas till; den gör bara något när en cube map-textur
är kopplad till den aktiva framebuffern. I main-funktionen går vi igenom alla 6 sidor: för var och en sätter vi
`gl_Layer` till sidans index och transformerar sedan varje indatavertex i världsrymden till den relevanta ljusrymden
genom att multiplicera `FragPos` med sidans transformationsmatris. Lägg märke till att vi också skickar den resulterande
variabeln `FragPos` till fragment shadern, som behöver den för att beräkna ett djupvärde.

Fragment shadern, `point_shadows_depth.fs`:

```glsl
#version 330 core
in vec4 FragPos;

uniform vec3 lightPos;
uniform float far_plane;

void main()
{
    float lightDistance = length(FragPos.xyz - lightPos);

    // map to [0;1] range by dividing by far_plane
    lightDistance = lightDistance / far_plane;

    // write this as modified depth
    gl_FragDepth = lightDistance;
}
```

Fragment shadern tar som indata `FragPos` från geometry shadern, ljusets positionsvektor och frustumets bakre plan. Här
tar vi avståndet mellan fragmentet och ljuskällan, för det till intervallet [0,1] och skriver det som fragmentets
djupvärde. Att skriva `gl_FragDepth` ersätter det djup som rastreraren beräknat – och djuptestet jämför sedan *de här*
värdena, så det närmaste avståndet vinner i varje texel.

Renderar vi scenen med de här shadrarna och framebuffern med cube mapen aktiv, får vi en helt fylld djup-cube map för
skuggberäkningarna i andra passet:

```cpp
        // 1. render scene to depth cubemap
        // --------------------------------
        glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
        glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
            glClear(GL_DEPTH_BUFFER_BIT);
            simpleDepthShader.use();
            for (unsigned int i = 0; i < 6; ++i)
                simpleDepthShader.setMat4("shadowMatrices[" + std::to_string(i) + "]", shadowTransforms[i]);
            simpleDepthShader.setFloat("far_plane", far_plane);
            simpleDepthShader.setVec3("lightPos", lightPos);
            renderScene(simpleDepthShader);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

`simpleDepthShader` är `Shader simpleDepthShader("point_shadows_depth.vs", "point_shadows_depth.fs",
"point_shadows_depth.gs");` – den tredje filen är geometry shadern. `glClear` rensar alla sex sidorna, och viewporten är
en sidas storlek: alla sidor får samma viewport.
:::
:::vulkan
Vertex shadern, `point_shadows_depth.vert`, behöver bara modellmatrisen från push constants:

```glsl
#version 450

// the model matrix: the first member of the push constants
layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;

void main() {
    gl_Position = pc.model * vec4(inPosition, 1.0); // world space: the geometry shader projects it onto each face
}
```

Geometry shadern, `point_shadows_depth.geom`, deklarerar uniformbuffern fram till den sista medlem den läser, så att
offseten stämmer med C++-structen:

```glsl
layout(triangles) in;
layout(triangle_strip, max_vertices = 18) out;

// the uniform buffer up to the members the geometry shader reads, so that their offsets match the C++ struct
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    vec3 lightPos;
    float far_plane;
    mat4 shadowMatrices[6];
} ubo;

layout(location = 0) out vec4 fragPos; // FragPos from GS (output per emitvertex)

void main() {
    for (int face = 0; face < 6; ++face) {
        gl_Layer = face; // built-in variable that specifies to which face we render.
        for (int i = 0; i < 3; ++i) { // for each triangle's vertices
            fragPos = gl_in[i].gl_Position;
            gl_Position = ubo.shadowMatrices[face] * fragPos;
            EmitVertex();
        }
        EndPrimitive();
    }
}
```

Geometry shadern tar en triangel som indata och skickar ut totalt 6 trianglar (6 × 3 = 18 vertex). Den inbyggda
`gl_Layer` anger vilket lager i framebuffern – vilken sida – en primitiv hamnar i; det fungerar eftersom framebuffern har
sex lager. Varje indatavertex i världsrymden transformeras till sidans ljusrymd, och `fragPos`, världspositionen,
skickas vidare till fragment shadern, `point_shadows_depth.frag`:

```glsl
layout(location = 0) in vec4 fragPos;

void main() {
    float lightDistance = length(fragPos.xyz - ubo.lightPos);

    // map to [0;1] range by dividing by far_plane
    lightDistance = lightDistance / ubo.far_plane;

    // write this as modified depth
    gl_FragDepth = lightDistance;
}
```

(med uniformblocket fram till `far_plane`). Att skriva `gl_FragDepth` ersätter rastrerarens djup, och djuptestet
jämför de här värdena, så det närmaste avståndet vinner. Eftersom det lagrade värdet är vårt eget ändrar projektionens
djupintervall 0..1 i Vulkan (`GLM_FORCE_DEPTH_ZERO_TO_ONE`) ingenting; det främre och bakre planet klipper fortfarande.

Tre saker till som geometry shadern behöver:

- Den är en valfri device feature. `isDeviceSuitable` kontrollerar `supportedFeatures.geometryShader`, och devicen slår
  på den med `deviceFeatures.geometryShader = VK_TRUE;`.
- Uniformbuffern läses nu också i geometristeget: dess layout bindings `stageFlags` blir
  `VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_GEOMETRY_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`.
- Djuppipelinen har tre shadrar, läser bara positionen (ett attribut), hör till `depthMapRenderPass` och har inget
  färg-attachment:

```cpp
        // the depth pass: only the position; the geometry shader draws each triangle into the six faces
        createPipeline("shaders/point_shadows_depth.vert.spv", "shaders/point_shadows_depth.frag.spv", "shaders/point_shadows_depth.geom.spv", 1, depthMapRenderPass, 0, depthPipeline);
```

Djuppasset spelas in i början av `recordCommandBuffer()`, efter att vertexbuffern och descriptor setet bundits, före
fönstrets pass – som i förra kapitlet, med ett rensningsvärde för alla sex lagren:

```cpp
        // one clear value: the depth 1.0 (the far plane), in all six layers
        VkClearValue depthMapClearValue{};
        depthMapClearValue.depthStencil = {1.0f, 0};

        depthMapPassInfo.clearValueCount = 1;
        depthMapPassInfo.pClearValues = &depthMapClearValue;

        vkCmdBeginRenderPass(commandBuffer, &depthMapPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, depthPipeline);
```

sedan en sidas viewport och scissor, 1024 × 1024 (alla lager får samma), scenen och slutet:

```cpp
        renderScene(commandBuffer);

        vkCmdEndRenderPass(commandBuffer); // the cube map is now in VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL
```

**Culling:** learnopengl cullar baksidor men stänger av culling för rummet, som ses inifrån. I Vulkan är cull mode en
del av pipelinen, så det skulle kräva en andra pipeline (per pass) bara för rummet. Varje pipeline här har i stället
`cullMode = VK_CULL_MODE_NONE`: de fem kuberna är slutna, så deras baksidor är dolda ändå och bilden blir densamma.
:::
:::d3d12
Alla tre shadrarna finns i `point_shadows_depth.hlsl`. Vertex shadern använder bara modellmatrisen:

```hlsl
// The vertex shader: only the model matrix - the geometry shader applies the light's matrices.
GSInput VSMain(float4 position : POSITION)
{
    GSInput result;
    result.position = mul(position, model);
    return result;
}
```

`GSInput` innehåller bara den världspositionen, i `SV_POSITION` som learnopengls `gl_Position` – bara geometry shaderns
utdata går till rastreraren. Geometry shadern:

```hlsl
// The geometry shader: every triangle goes to all six faces, each time with that face's
// matrix: at most 6 x 3 = 18 vertices.
[maxvertexcount(18)]
void GSMain(triangle GSInput input[3], inout TriangleStream<PSInput> triStream)
{
    for (int face = 0; face < 6; ++face)
    {
        PSInput output;
        output.layer = face;    // built-in value that specifies to which face we render.
        for (int i = 0; i < 3; ++i)    // for each triangle's vertices
        {
            output.fragPos = input[i].position;
            output.position = mul(output.fragPos, shadowMatrices[face]);
            triStream.Append(output);
        }
        triStream.RestartStrip();
    }
}
```

Den tar en triangel och lägger till 6 trianglar i utdataströmmen (6 × 3 = 18 vertex, deklarerat med `maxvertexcount`).
GLSL:s `gl_Layer` är en medlem i utdatastructen med systemvärdessemantiken `SV_RenderTargetArrayIndex`:

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float4 fragPos : POSITION;    // FragPos from GS (output per emitvertex)
    uint layer : SV_RenderTargetArrayIndex;    // the cube face (slice) this triangle goes to
};
```

Den väljer vilken array-skiva i de bundna vyerna – här depth stencil view:ns skiva – en primitiv hamnar i. `fragPos`
bär världspositionen vidare till pixel shadern:

```hlsl
// The pixel shader: the depth it writes (SV_Depth) is the distance to the light, divided by
// far_plane to fit into 0..1 - a linear distance instead of the projection's depth.
float PSMain(PSInput input) : SV_Depth
{
    float lightDistance = length(input.fragPos.xyz - lightPos);

    // map to [0;1] range by dividing by far_plane
    lightDistance = lightDistance / far_plane;

    // write this as modified depth
    return lightDistance;
}
```

En pixel shader som returnerar `SV_Depth` ersätter rastrerarens djup (GLSL:s `gl_FragDepth`), och djuptestet jämför
de här värdena, så det närmaste avståndet vinner. En kostnad: eftersom djupet blir känt först efter pixel shadern kan
GPU:n inte testa det tidigt, innan shadern körs. Djuppassets pipeline state får alla tre shadrarna och inget render
target:

```cpp
        ThrowIfFailed(D3DCompileFromFile(L"point_shadows_depth.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &depthVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"point_shadows_depth.hlsl", nullptr, nullptr, "GSMain", "gs_5_0", compileFlags, 0, &depthGeometryShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"point_shadows_depth.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &depthPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(depthVertexShader.Get());
        psoDesc.GS = CD3DX12_SHADER_BYTECODE(depthGeometryShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(depthPixelShader.Get());
        psoDesc.NumRenderTargets = 0;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_UNKNOWN;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_depthPipelineState)));
```

Pass 1 är det första som `PopulateCommandList` spelar in, efter root signaturen, descriptor tables och vertexbuffern:

```cpp
    m_commandList->SetPipelineState(m_depthPipelineState.Get());
    m_commandList->RSSetViewports(1, &m_shadowViewport);
    m_commandList->RSSetScissorRects(1, &m_shadowScissorRect);
    CD3DX12_CPU_DESCRIPTOR_HANDLE cubemapDsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_dsvDescriptorSize);
    m_commandList->OMSetRenderTargets(0, nullptr, FALSE, &cubemapDsvHandle);
    m_commandList->ClearDepthStencilView(cubemapDsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr);
    RenderScene();

    // The depth cubemap is done: from now on the pixel shaders read it.
    CD3DX12_RESOURCE_BARRIER cubemapBarrier = CD3DX12_RESOURCE_BARRIER::Transition(m_depthCubemap.Get(), D3D12_RESOURCE_STATE_DEPTH_WRITE, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, &cubemapBarrier);
    m_commandList->SetPipelineState(m_pipelineState.Get());
```

`m_shadowViewport` och `m_shadowScissorRect` har en sidas storlek, 1024 × 1024 – alla skivor får samma. Rensningen genom
array-DSV:n rensar alla sex skivorna. I slutet av bildrutan, efter back bufferns barriär till `PRESENT`, vänder en andra
barriär tillbaka cube mapen till `DEPTH_WRITE` för nästa bildrutas pass – förra kapitlets par av barriärer.

**Culling:** learnopengl cullar baksidor men stänger av culling för rummet, som ses inifrån. I Direct3D är cull mode en
del av pipeline staten, så det skulle kräva extra pipeline states (rummet och kuberna, i varje pass). Varje pipeline
state här har i stället `CullMode = D3D12_CULL_MODE_NONE`: de fem kuberna är slutna, så deras baksidor är dolda ändå och
bilden blir densamma.
:::

## Att visualisera djup-cube mapen

learnopengl visar djup-cube mapen i slutet, som felsökningshjälp; vi använder den direkt för att kontrollera första
passet. Scenens egen shader kan visa den: i stället för belysningen visar varje fragment det närmaste djupet som lagrats
i riktningen från ljuset till fragmentet, som en grå nyans. En cube map samplas med en riktningsvektor: vektorn från
ljusets position till fragmentets position.

:::opengl
I `point_shadows.fs`, med `uniform samplerCube depthMap;` och `uniform float far_plane;` deklarerade, blir slutet av
`main`:

```glsl
    // FragColor = vec4(lighting, 1.0);
    // display the depth cube map as debug: the closest depth stored in this fragment's direction (0..1 = 0..far_plane)
    vec3 fragToLight = fs_in.FragPos - lightPos;
    float closestDepth = texture(depthMap, fragToLight).r;
    FragColor = vec4(vec3(closestDepth), 1.0);
```

I `main.cpp` får shadern cube mapen på texturenhet 1 (`shader.setInt("depthMap", 1);` en gång), `far_plane` varje
bildruta, och cube mapen binds för andra passet:

```cpp
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, woodTexture);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_CUBE_MAP, depthCubemap);
        renderScene(shader);
```

Lägg märke till målet: `GL_TEXTURE_CUBE_MAP`. Gör nu första uppgiften, **depth-cubemap**: djupshaderobjektet,
djupkartans FBO med sin cube map, matriserna och pass 1 i renderloopen, `far_plane` och cube mapen för pass 2, de tre
djupshadrarna och den här felsökningsutdatan. Ta bort `depthCubemap` och `depthMapFBO` i slutet.
:::
:::vulkan
I `point_shadows.frag` får uniformblocket `float far_plane;` efter `lightPos`, cube mapen är
`layout(binding = 2) uniform samplerCube depthMap;`, och slutet av `main` blir:

```glsl
    // outColor = vec4(lighting, 1.0);
    // display the depth cube map as debug: the closest depth stored in this fragment's direction (0..1 = 0..far_plane)
    vec3 fragToLight = fs_in.fragPos - ubo.lightPos;
    float closestDepth = texture(depthMap, fragToLight).r;
    outColor = vec4(vec3(closestDepth), 1.0);
```

Descriptor setet som binds för djuppasset förblir bundet för fönstrets pass, cube mapen på binding 2 inräknad. Gör nu
första uppgiften, **depth-cubemap**: `SHADOW_WIDTH` / `SHADOW_HEIGHT`, uniformbufferns nya medlemmar och matriser,
`createDepthMapRenderPass()`, `createDepthCubemap()`, `createDepthCubemapSampler()`, geometry shader-featuren och
-steget, binding 2, djuppipelinen, djuppasset i `recordCommandBuffer()`, de tre djupshadrarna och den här
felsökningsutdatan – och förstör de nya objekten i `cleanup()` (framebuffer, vy, bild, minne, sampler, pipeline, render
pass).
:::
:::d3d12
I `point_shadows.hlsl` är cube mapen `TextureCube depthMap : register(t1);` med
`SamplerState shadowSampler : register(s1);`, cbuffern får `shadowMatrices` och `far_plane`, och slutet av `PSMain`
blir:

```hlsl
    // display closestDepth as debug (to visualize depth cubemap) instead of the lighting: the
    // depth cubemap, read in the direction from the light to the fragment, as a grey (0 at
    // the light, 1 at far_plane)
    float3 fragToLight = input.fragPos - lightPos;
    float closestDepth = depthMap.Sample(shadowSampler, fragToLight).r;
    return float4(closestDepth, closestDepth, closestDepth, 1.0f);
```

En `TextureCube`:s `Sample` tar en `float3`-riktning. Texturernas descriptor table når redan cube mapens SRV (t1). Gör
nu första uppgiften, **depth-cubemap**: `SHADOW_WIDTH` / `SHADOW_HEIGHT`, constant bufferns nya medlemmar, skuggans
viewport och scissor-rektangel, de större heaparna och `m_dsvDescriptorSize`, SRV-intervallet på 2 och sampler s1,
djupets pipeline state, djup-cube mapen med sina två vyer, matriserna i `OnUpdate`, pass 1 med sina barriärer, de tre
djupshadrarna och den här felsökningsutdatan.
:::

Bygg och kör: fönstret visar **djup-cube mapen sedd från kameran** – grått överallt, och ganska mörkt. Den bakre väggen
ligger 5 till 8.7 enheter från ljuset, 0.2 till 0.35 av `far_plane`: dess mitt är 51 av 255, och den blir ljusare mot
kanterna och hörnen, som ligger längre från ljuset. Kuben i övre vänstra hörnet är mörkare – närmare ljuset. Och skuggan
syns redan: där kuben skymmer väggen från ljuset innehåller cube mapen kubens avstånd, inte väggens – ett mörkt band
runt kubens övre vänstra kant, lika mörkt som kuben själv. Inget trä, ingen belysning: det här är djup-cube mapen och
inget annat.

## Rundstrålande shadow maps

Med allt på plats är det dags att rendera de faktiska rundstrålande skuggorna. Proceduren liknar kapitlet om riktad
shadow mapping, men den här gången binder vi en cube map-textur i stället för en 2D-textur och skickar också ljusprojektionens
bakre plan till shadrarna.

Vertex shadern och fragment shadern liknar till största delen de ursprungliga shadow mapping-shadrarna: skillnaden är att
fragment shadern inte längre behöver någon fragmentposition i ljusrymden, eftersom vi nu kan sampla djupvärdena med en
riktningsvektor. Därför behöver vertex shadern inte transformera sina positioner till ljusrymden – den förblir som den är.

Det första vi måste göra är att hämta djupet ur cube mapen. Som du kanske minns från början av kapitlet lagrade vi djupet
som det linjära avståndet mellan fragmentet och ljusets position. Vi gör på liknande sätt här: vektorn mellan
fragmentets position och ljusets position är riktningsvektorn att sampla cube mapen med. (Dess namn, `fragToLight`, är
learnopengls; den pekar faktiskt från ljuset till fragmentet, vilket är den riktning vi behöver.) Observera att
riktningsvektorn inte behöver vara en enhetsvektor för att sampla en cube map, så vi behöver inte normalisera den. Det
resulterande värdet `closestDepth` ligger nu i intervallet [0,1], så först gör vi om det till [0, far_plane] genom att
multiplicera med `far_plane`.

Sedan hämtar vi djupvärdet mellan det aktuella fragmentet och ljuskällan, vilket vi enkelt får som längden av
`fragToLight`, tack vare hur vi beräknade djupvärdena i cube mapen. Nu kan vi jämföra de två djupvärdena för att se
vilket som ligger närmast och avgöra om det aktuella fragmentet ligger i skugga. Vi tar också med en skuggbias så att vi
inte får shadow acne. Observera att biasen nu är i världsenheter – djupen är avstånd från `near_plane` till
`far_plane` – så vi använder en mycket större bias på 0.05.

```quiz
Varför lagrar djuppasset `avstånd / far_plane` i stället för det djup som ljusets projektion skulle ge?
- [ ] Eftersom projektionens djup inte kan skrivas till en cube map
- [ ] Eftersom det gör djup-cube mapen mindre
- [ ] Eftersom en perspektivprojektion inte har något bakre plan
- [x] Uppslagningen har bara fragmentets avstånd till ljuset (`length(fragToLight)`); ett lagrat avstånd kan jämföras direkt med det, oavsett vilken sida det kommer från, medan varje sidas projicerade djup beror på sidans vyriktning och är icke-linjärt
---
Ett avstånd från ljuset är samma storhet på alla sex sidorna. Andra passet multiplicerar det lagrade värdet med `far_plane` och jämför det med sitt eget avstånd – ingen projektion behövs.
```

:::opengl
```glsl
float ShadowCalculation(vec3 fragPos)
{
    // get vector between fragment position and light position
    vec3 fragToLight = fragPos - lightPos;
    // use the fragment to light vector to sample from the depth map
    float closestDepth = texture(depthMap, fragToLight).r;
    // it is currently in linear range between [0,1], let's re-transform it back to original depth value
    closestDepth *= far_plane;
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // test for shadows
    float bias = 0.05; // we use a much larger bias since depth is now in [near_plane, far_plane] range
    float shadow = currentDepth -  bias > closestDepth ? 1.0 : 0.0;
    // display closestDepth as debug (to visualize depth cubemap)
    // FragColor = vec4(vec3(closestDepth / far_plane), 1.0);

    return shadow;
}
```

Gör nu uppgiften **shadows**: lägg till `ShadowCalculation` i `point_shadows.fs`, anropa den i `main` –
`float shadow = ShadowCalculation(fs_in.FragPos);` – och sätt tillbaka `FragColor = vec4(lighting, 1.0);` i stället för
felsökningsutdatan. learnopengls felsökningsrad finns kvar i `ShadowCalculation` som kommentar.
:::
:::vulkan
```glsl
float ShadowCalculation(vec3 fragPos) {
    // get vector between fragment position and light position
    vec3 fragToLight = fragPos - ubo.lightPos;
    // use the fragment to light vector to sample from the depth map
    float closestDepth = texture(depthMap, fragToLight).r;
    // it is currently in linear range between [0,1], let's re-transform it back to original depth value
    closestDepth *= ubo.far_plane;
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // test for shadows
    float bias = 0.05; // we use a much larger bias since depth is now in [near_plane, far_plane] range
    float shadow = currentDepth - bias > closestDepth ? 1.0 : 0.0;
    // display closestDepth as debug (to visualize depth cubemap)
    // outColor = vec4(vec3(closestDepth / ubo.far_plane), 1.0);

    return shadow;
}
```

Ingen projektion och inga texturkoordinater: riktningen väljer sidan och texeln, och eftersom sidorna lagrades utan
y-vändning hittar uppslagningen det som djuppasset ritade. Gör nu uppgiften **shadows**: lägg till `ShadowCalculation` i
`point_shadows.frag`, anropa den i `main()` – `float shadow = ShadowCalculation(fs_in.fragPos);` – och sätt tillbaka
`outColor = vec4(lighting, 1.0);` i stället för felsökningsutdatan.
:::
:::d3d12
```hlsl
// 1.0 if the fragment is in shadow, 0.0 if the light reaches it.
float ShadowCalculation(float3 fragPos)
{
    // get vector between fragment position and light position
    float3 fragToLight = fragPos - lightPos;
    // use the fragment to light vector to sample from the depth map
    float closestDepth = depthMap.Sample(shadowSampler, fragToLight).r;
    // it is currently in linear range between [0,1], let's re-transform it back to original depth value
    closestDepth *= far_plane;
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // test for shadows
    float bias = 0.05f; // we use a much larger bias since depth is now in [near_plane, far_plane] range
    float shadow = currentDepth - bias > closestDepth ? 1.0f : 0.0f;

    return shadow;
}
```

Ingen projektion och inga texturkoordinater: riktningen väljer sidan och texeln, och eftersom sidorna lagrades med
y-vändningen hittar uppslagningen det som djuppasset ritade. Gör nu uppgiften **shadows**: lägg till `ShadowCalculation`
i `point_shadows.hlsl`, anropa den i `PSMain` – `float shadow = ShadowCalculation(input.fragPos);` – och
`return float4(lighting, 1.0f);` igen i stället för felsökningsutdatan.
:::

Bygg och kör: det belysta rummet är tillbaka, och den vridna kuben kastar en **skugga** på den bakre väggen – där
djup-cube mapen visade det mörka bandet får väggen nu bara ambient ljus. Ljuset och kameran står nästan på en linje, så
kuben döljer det mesta av sin egen skugga: du ser ett mörkt band runt dess övre vänstra kant, en tunn linje längs dess
nedre vänstra kant och en liten bit till höger om dess översta hörn. De andra fyra kuberna och deras skuggor på
sidoväggarna, golvet och taket ligger utanför bilden – vrid kameran om ditt program körs utanför kursen. Skuggans kanter
är hårda och hackiga (en texel i cube mapen per sampling), men det finns ingen shadow acne: biasen i världsenheter
täcker djuptexlarna.

## PCF

Eftersom rundstrålande shadow maps bygger på samma principer som traditionell shadow mapping har de också samma
upplösningsberoende artefakter – de hackiga kanterna. Percentage-closer filtering, PCF, låter oss jämna ut dem genom att
filtrera flera samplingar runt fragmentets position och ta medelvärdet av resultaten.

Tar vi förra kapitlets enkla PCF-filter och lägger till en tredje dimension får vi learnopengls första försök: tre
nästlade loopar som samplar 4 × 4 × 4 förskjutningar runt `fragToLight`, var och en mellan -0.1 och 0.1, och tar
medelvärdet av de 64 jämförelserna. Det fungerar, men 64 samplingar per fragment är mycket. Och många av dem är
överflödiga: de samplar nära den ursprungliga riktningsvektorn, eller längs den, vilket inte ändrar riktningen alls.

I stället använder learnopengl en array med förskjutningsriktningar som alla är ungefär åtskilda – var och en pekar åt
ett helt annat håll: en kubs 8 hörn och 12 kantmittpunkter, 20 totalt. Adderade till `fragToLight` och skalade med en
liten radie sprider de samplingarna över omgivningen kring samplingsriktningen.

Ett annat intressant trick vi kan använda här är att ändra `diskRadius` utifrån betraktarens avstånd till fragmentet,
vilket gör skuggorna mjukare på avstånd och skarpare på nära håll:
`diskRadius = (1.0 + (viewDistance / far_plane)) / 25.0`. Biasen växer till 0.15, som i learnopengl: förskjutningarna
läser djupet i lite andra riktningar, där en lutande yta ligger något närmare ljuset.

```quiz
Vad gör `diskRadius = (1.0 + (viewDistance / far_plane)) / 25.0` i learnopengls PCF för cube maps?
- [ ] Den håller de 20 samplingsriktningarna inom en sida av cube mapen
- [ ] Den omvandlar biasen från världsenheter till 0..1
- [x] Den skalar de 20 förskjutningsriktningarna: ju längre fragmentet är från betraktaren, desto längre isär ligger samplingarna – mjukare skuggor på avstånd, skarpare på nära håll
- [ ] Den bestämmer hur många av de 20 samplingarna som tas
---
Förskjutningarna adderas till `fragToLight` efter att ha multiplicerats med `diskRadius`. En större radie tar medelvärdet över ett större område, så skuggkanten blir en bredare, mjukare övergång.
```

:::opengl
Förskjutningarna, som en global array i `point_shadows.fs`:

```glsl
// array of offset direction for sampling
vec3 gridSamplingDisk[20] = vec3[]
(
   vec3(1, 1,  1), vec3( 1, -1,  1), vec3(-1, -1,  1), vec3(-1, 1,  1),
   vec3(1, 1, -1), vec3( 1, -1, -1), vec3(-1, -1, -1), vec3(-1, 1, -1),
   vec3(1, 1,  0), vec3( 1, -1,  0), vec3(-1, -1,  0), vec3(-1, 1,  0),
   vec3(1, 0,  1), vec3(-1,  0,  1), vec3( 1,  0, -1), vec3(-1, 0, -1),
   vec3(0, 1,  1), vec3( 0, -1,  1), vec3( 0, -1, -1), vec3( 0, 1, -1)
);
```

och i `ShadowCalculation`, efter `fragToLight`:

```glsl
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // PCF: 20 samples around the direction, in a disk that grows with the distance to the viewer
    float shadow = 0.0;
    float bias = 0.15;
    int samples = 20;
    float viewDistance = length(viewPos - fragPos);
    float diskRadius = (1.0 + (viewDistance / far_plane)) / 25.0;
    for(int i = 0; i < samples; ++i)
    {
        float closestDepth = texture(depthMap, fragToLight + gridSamplingDisk[i] * diskRadius).r;
        closestDepth *= far_plane;   // undo mapping [0;1]
        if(currentDepth - bias > closestDepth)
            shadow += 1.0;
    }
    shadow /= float(samples);
```

Gör nu den sista uppgiften, **pcf**: de här raderna ersätter den enda samplingen och jämförelsen.
:::
:::vulkan
Förskjutningarna, som en global array i `point_shadows.frag`:

```glsl
// array of offset direction for sampling
vec3 gridSamplingDisk[20] = vec3[](
    vec3(1, 1,  1), vec3( 1, -1,  1), vec3(-1, -1,  1), vec3(-1, 1,  1),
    vec3(1, 1, -1), vec3( 1, -1, -1), vec3(-1, -1, -1), vec3(-1, 1, -1),
    vec3(1, 1,  0), vec3( 1, -1,  0), vec3(-1, -1,  0), vec3(-1, 1,  0),
    vec3(1, 0,  1), vec3(-1,  0,  1), vec3( 1,  0, -1), vec3(-1, 0, -1),
    vec3(0, 1,  1), vec3( 0, -1,  1), vec3( 0, -1, -1), vec3( 0, 1, -1)
);
```

och i `ShadowCalculation`, efter `fragToLight`:

```glsl
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // PCF: 20 samples around the direction, in a disk that grows with the distance to the viewer
    float shadow = 0.0;
    float bias = 0.15;
    int samples = 20;
    float viewDistance = length(ubo.viewPos - fragPos);
    float diskRadius = (1.0 + (viewDistance / ubo.far_plane)) / 25.0;
    for (int i = 0; i < samples; ++i) {
        float closestDepth = texture(depthMap, fragToLight + gridSamplingDisk[i] * diskRadius).r;
        closestDepth *= ubo.far_plane; // undo mapping [0;1]
        if (currentDepth - bias > closestDepth)
            shadow += 1.0;
    }
    shadow /= float(samples);
```

Gör nu den sista uppgiften, **pcf**: de här raderna ersätter den enda samplingen och jämförelsen.
:::
:::d3d12
Förskjutningarna, som en konstant array i `point_shadows.hlsl` – `static const` gör den till en del av shadern, inte
ett värde i en constant buffer:

```hlsl
// array of offset direction for sampling
static const float3 gridSamplingDisk[20] =
{
    float3(1, 1,  1), float3( 1, -1,  1), float3(-1, -1,  1), float3(-1, 1,  1),
    float3(1, 1, -1), float3( 1, -1, -1), float3(-1, -1, -1), float3(-1, 1, -1),
    float3(1, 1,  0), float3( 1, -1,  0), float3(-1, -1,  0), float3(-1, 1,  0),
    float3(1, 0,  1), float3(-1,  0,  1), float3( 1,  0, -1), float3(-1, 0, -1),
    float3(0, 1,  1), float3( 0, -1,  1), float3( 0, -1, -1), float3( 0, 1, -1)
};
```

och i `ShadowCalculation`, efter `fragToLight`:

```hlsl
    // now get current linear depth as the length between the fragment and light position
    float currentDepth = length(fragToLight);
    // PCF: sample the depth cubemap around fragToLight, in 20 directions spread over a disk
    // that grows with the distance to the camera (farther away the edges can be softer)
    float shadow = 0.0f;
    float bias = 0.15f;
    int samples = 20;
    float viewDistance = length(viewPos - fragPos);
    float diskRadius = (1.0f + (viewDistance / far_plane)) / 25.0f;
    for (int i = 0; i < samples; ++i)
    {
        float closestDepth = depthMap.Sample(shadowSampler, fragToLight + gridSamplingDisk[i] * diskRadius).r;
        closestDepth *= far_plane;   // undo mapping [0;1]
        if (currentDepth - bias > closestDepth)
            shadow += 1.0f;
    }
    shadow /= float(samples);
```

Gör nu den sista uppgiften, **pcf**: de här raderna ersätter den enda samplingen och jämförelsen.
:::

Bygg och kör: skuggans **kanter blir mjuka** – dess inre är lika mörkt som förut och den belysta väggen runtom
oförändrad, men längs kanterna ändras ljusstyrkan nu gradvis: där 5 av de 20 samplingarna ligger i skugga ligger
fragmentet till en fjärdedel i skugga. Bara pixlarna vid skuggans kanter ändras.

PCF-algoritmen här är fortfarande ganska enkel; det finns mycket mer att säga om mjuka skuggor, och om punktskuggor över
huvud taget: en geometry shader som skickar ut varje triangel sex gånger är inte gratis, och en del renderare ritar de
sex sidorna i sex pass, eller hoppar över sidor som ett ljus inte kan nå. Men kärnan i tekniken är densamma: en kub av
djup runt ljuset, uppslagen med en riktning.

## Mer att läsa

:::opengl
- [Point Shadows](https://learnopengl.com/Advanced-Lighting/Shadows/Point-Shadows): learnopengls kapitel som det här
  kapitlet följer, med bilder av scenen från andra vinklar.
- [point_shadows_soft.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/3.2.2.point_shadows_soft/point_shadows_soft.cpp):
  learnopengls färdiga program (med ljuset som rör sig och mellanslagstangenten som slår av och på skuggorna).
- [Cubemap Texture (OpenGL-wikin)](https://www.khronos.org/opengl/wiki/Cubemap_Texture): cube mapens layout, sidornas
  ordning och hur en riktning väljer en sida.
:::
:::vulkan
- [Point Shadows](https://learnopengl.com/Advanced-Lighting/Shadows/Point-Shadows): learnopengls kapitel som det här
  kapitlet följer, med bilder av scenen från andra vinklar.
- [Textures (Vulkan-specifikationen)](https://docs.vulkan.org/spec/latest/chapters/textures.html): specifikationens
  kapitel med tabellen för hur en cube maps sida väljs.
- [VkImageCreateInfo](https://registry.khronos.org/vulkan/specs/latest/man/html/VkImageCreateInfo.html): array-lager och
  `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`.
:::
:::d3d12
- [Point Shadows](https://learnopengl.com/Advanced-Lighting/Shadows/Point-Shadows): learnopengls kapitel som det här
  kapitlet följer, med bilder av scenen från andra vinklar.
- [Geometry shader stage](https://learn.microsoft.com/en-us/windows/win32/direct3d11/geometry-shader-stage): vad en
  geometry shader kan göra, bland annat rendering till en cube map i ett pass med `SV_RenderTargetArrayIndex`.
- [Texture views](https://learn.microsoft.com/en-us/windows/uwp/graphics-concepts/texture-views): en texturarray med sex
  skivor, sedd som en cube map eller som en array av render targets.
:::
