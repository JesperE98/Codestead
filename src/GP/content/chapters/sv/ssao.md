# SSAO

Vi har kort berört ämnet i kapitlet om grundläggande ljussättning: omgivningsljus. Omgivningsljus är en fast ljuskonstant
som vi lägger till scenens totala belysning för att simulera att ljuset sprids. I verkligheten sprids ljus åt alla möjliga
håll med varierande intensitet, så de indirekt belysta delarna av en scen borde också ha varierande intensitet. En sorts
approximation av indirekt ljus kallas *ambient occlusion* och försöker efterlikna indirekt ljus genom att göra veck, hål
och ytor som ligger nära varandra mörkare. Sådana områden skyms till stor del av omgivande geometri, och ljusstrålarna
har färre vägar att ta sig ut, så områdena ser mörkare ut. Titta på hörnen och vecken i rummet du sitter i: ljuset där
verkar lite mörkare.

Tekniker för ambient occlusion är dyra eftersom de måste ta hänsyn till omgivande geometri. Man skulle kunna skjuta ut
ett stort antal strålar från varje punkt för att avgöra hur skymd den är, men det blir snabbt alldeles för tungt för
realtid. 2007 publicerade Crytek en teknik som kallas *screen-space ambient occlusion* (SSAO), för spelet Crysis.
Tekniken använder scenens djupbuffer i skärmrymden för att avgöra hur skymt något är, i stället för verklig geometrisk
data. Det är otroligt snabbt jämfört med riktig ambient occlusion och ger trovärdiga resultat, vilket har gjort det till
de facto-standarden för att approximera ambient occlusion i realtid.

Grunderna i screen-space ambient occlusion är enkla: för varje fragment på en fyrhörning som fyller skärmen beräknar vi
en *ocklusionsfaktor* utifrån djupvärdena runt fragmentet. Ocklusionsfaktorn används sedan för att minska eller ta bort
fragmentets omgivningsljus. Den fås genom att ta flera djupsamplingar i en sfärisk samplingskärna runt fragmentets
position och jämföra var och en med det aktuella fragmentets djup. Antalet samplingar som har ett högre djupvärde än
fragmentets djup utgör ocklusionsfaktorn: en sampling som ligger inuti geometrin – bakom den yta kameran ser på
samplingens plats på skärmen – räknas som skymd.

Det är tydligt att effektens kvalitet och precision hänger direkt ihop med hur många samplingar runt omkring vi tar. Är
antalet för lågt sjunker precisionen drastiskt och vi får en artefakt som kallas *banding*; är det för högt förlorar vi
prestanda. Vi kan minska antalet samplingar vi behöver testa genom att föra in lite slump i samplingskärnan. Genom att
slumpmässigt rotera samplingskärnan för varje fragment kan vi få resultat av hög kvalitet med betydligt färre
samplingar. Det har ett pris, eftersom slumpen ger ett märkbart *brusmönster* som vi måste åtgärda genom att blurra
resultatet.

Det här är den sista lektionen i delen Avancerad belysning, och den bygger direkt på den förra: SSAO behöver positioner
och normaler per pixel, och en deferred-renderare har dem i sin G-buffer. SSAO-passet och dess blur är två
skärmfyrhörningspass till, in i mål med en enda kanal; det här kapitlet visar hur {{api}} sätter upp dem, och en ny sorts
resurs – en liten textur fylld med slumpdata från CPU:n.

## Scenen

learnopengl belyser sin ryggsäcksmodell i ett stort rum; kursen ställer en **planet** där – modellen från delen
Modelladdning, en sfär med radien 1 med en platt ring runt, stående på golvet (förflyttad till (0, 0.5, 0); learnopengl
roterar sin ryggsäck -90° kring x, planeten står upprätt). Rummet är kuben på 2 × 2 × 2 skalad med 7.5 och flyttad upp
7, med inverterade normaler eftersom vi ser dess insida: golvet ligger på y = -0.5, bakväggen på z = -7.5. Allt har samma
ljusgrå albedo, 0.95 – learnopengls: modellens texturer laddas men används inte, så ocklusionen syns tydligt. Kameran är
learnopengls, på (0, 0, 5) och tittar längs -z, med ett bortre klipplan på 50.

Ett punktljus, learnopengls: på (2, 4, -2) – ovanför och bakom planeten, till höger – med blå färg (0.2, 0.2, 0.7), linjär
dämpning 0.09 och kvadratisk 0.032. Belysningspasset är learnopengls Blinn-Phong: en omgivningsterm `0.3 * Diffuse`,
diffust och spekulärt ljus (exponent 8), dämpat. Det arbetar i **vyrymden**: ljusets position transformeras med
vymatrisen innan den skickas, och betraktaren sitter i origo, så `viewDir = normalize(-FragPos)`.

Två avvikelser från learnopengls kod, båda av samma skäl – den inbyggda simulatorn beräknar varje pixel på CPU:n, och
SSAO-passet är ett av de dyraste passen i kursen:

- **32 samplingar i kärnan i stället för 64.** Det halverar SSAO-passets arbete; resultatet är lite brusigare före bluren
  och i praktiken detsamma efter.
- **`rand()` i stället för `std::uniform_real_distribution`.** learnopengl drar sina slumptal med
  `std::uniform_real_distribution<GLfloat>` och `std::default_random_engine`, och talen den motorn ger skiljer sig mellan
  standardbibliotek. Kursen använder `srand(42)` och `rand() / (float)RAND_MAX` – ett flyttal mellan 0.0 och 1.0 – vars
  talföljd simulatorn återskapar (glibc:s), så förhandsvisningen visar samma kärna och brus som det riktiga programmet,
  vid varje körning. På Windows ger Microsofts `rand()` (med ett `RAND_MAX` på 32767) andra tal: bilden ser likadan ut,
  bruset skiljer sig i detaljerna.

:::opengl
Starten är en deferred-renderare som förra kapitlets: `main.cpp` ritar rummet (`renderCube()` med `invertedNormals` = 1)
och planeten (`Model planet("models/planet.obj")`, klassen `Model` från delen Modelladdning i `model.h` / `mesh.h`) i
G-buffern med `ssao_geometry.vs` / `.fs`, och belyser sedan skärmfyrhörningen med `ssao.vs` / `ssao_lighting.fs`, som
ännu inte har någon ambient occlusion. `ssao.vs` är skärmfyrhörningens vertex shader, delad av alla tre skärmpassen.
`ssao.fs` och `ssao_blur.fs` har sina deklarationer, men deras `main` är en TODO.
:::
:::vulkan
Starten är en deferred-renderare som förra kapitlets: `recordCommandBuffer()` ritar rummet (vertexbufferns kub,
`invertedNormals = VK_TRUE` i push constants: `struct PushConstants { glm::mat4 model; VkBool32 invertedNormals; }` – en
GLSL-`bool` är 4 byte) och planeten (`loadModel(MODEL_PATH, modelVertices, modelIndices)` med tinyobjloader, egna vertex-
och indexbuffrar, ett `vkCmdDrawIndexed`) i G-buffern, och sedan skärmfyrhörningen (vertex 36..41) i fönstret med
`lightingPipeline` (`ssao.vert` / `ssao_lighting.frag`). Det finns **ett descriptor set för alla pass**, `descriptorSet`,
som vulkan-tutorials: uniform buffern på binding 0, gPosition, gNormal och gAlbedo på 1, 2 och 3; varje pass shaders läser
bara de bindings de deklarerar. Fönstrets render pass har ingen djup-attachment – bara fyrhörningen ritas i det – och
skärmpipelines görs med `depthTestEnable = VK_FALSE` (`createPipeline(…, colorAttachmentCount, depthTestEnable, …)` från
förra kapitlet). Uniform buffern håller `view`, `proj` och ljuset (`struct Light { glm::vec3 position; float linear;
glm::vec3 color; float quadratic; }`, std140), vars position `updateUniformBuffer()` transformerar till vyrymden.
`ssao.frag` och `ssao_blur.frag` är TODO:er som kompilerar och inte skriver något.
:::
:::d3d12
Starten är en deferred-renderare som förra kapitlets: `PopulateCommandList` ritar rummet (vertexbufferns kub,
`invertedNormals = TRUE` i rotkonstanterna) och planeten (`Model m_model`, klasserna från delen Modelladdning porterade
med Assimp; `m_model.Draw` binder varje meshs kartor) i G-buffern `m_gBuffer[3]`, och sedan skärmfyrhörningen i back
buffern med `m_lightingPipelineState` (`ssao_lighting.hlsl`). Heapen håller CBV:n på plats 0, meshernas kartor på plats
1–4 (`MaxMeshes = 2`) och G-bufferns SRV:er på plats 5, 6 och 7. Rotsignaturen har rotkonstanterna (b0: `ModelConstants`
– `model`, `normalMatrix`, `BOOL invertedNormals`), tabell 1 för CBV:n (b1), tabell 2 med två SRV:er (t0, t1) och tabell
3 med en (t2), och den statiska samplern s0: punktfiltrering, CLAMP. Varje skärmpass har sin egen kopia av learnopengls
delade `ssao.vs` som `VSMain` – ett pipeline state tar här sina shaders från en fil. `ssao.hlsl` och `ssao_blur.hlsl` har
sina deklarationer; deras `PSMain` är en TODO (de kompileras inte förrän du behöver dem).
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Tryck på **Build & run** (Ctrl+Enter) för att kompilera
programmet och köra det i den inbyggda simulatorn: insidan av ett stort grått rum, belyst blått uppifrån höger –
bakväggen, golvet nedanför en tunn kantlinje, och den grå planeten i mitten, stående på golvet. Dess framsida vetter bort
från ljuset och får bara omgivningsljuset; dess övre högra kant är blått belyst. Ringen går tvärs framför den från ena
sidan av fönstret till den andra, strax ovanför ögonhöjd: du ser den **underifrån**. Allt som inte belyses direkt har
samma platta grå ton; inget visar var planeten möter golvet.

## Samplingsbuffrar

SSAO kräver geometrisk information, eftersom vi behöver något sätt att avgöra ett fragments ocklusionsfaktor. För varje
fragment behöver vi följande data:

- En **position** per fragment.
- En **normal** per fragment.
- En **albedofärg** per fragment.
- En **samplingskärna**.
- En slumpmässig **rotationsvektor** per fragment som roterar samplingskärnan.

Med en position per fragment i vyrymden kan vi orientera en halvsfärisk samplingskärna kring fragmentets ytnormal i
vyrymden, och använda kärnan för att sampla positionsbufferns textur på varierande avstånd. För varje sampling i kärnan
jämför vi dess djup med djupet i positionsbuffern för att avgöra hur mycket som skyms. Den resulterande
ocklusionsfaktorn används sedan för att begränsa den slutliga omgivningsljuskomponenten.

Eftersom SSAO är en teknik i skärmrymden beräknar vi dess effekt för varje fragment på en 2D-fyrhörning som fyller
skärmen. Det betyder att vi inte har någon geometrisk information om scenen. Det vi kan göra är att rendera den
geometriska datan per fragment till texturer i skärmrymden, som vi sedan skickar till SSAO-shadern så att vi har tillgång
till den. Har du följt med i förra kapitlet ser du att det liknar en deferred-renderares G-buffer. Därför passar SSAO
perfekt ihop med deferred rendering, eftersom vi redan har positionerna och normalerna i G-buffern.

Den här gången ligger G-buffern i **vyrymden**, inte i världsrymden: SSAO-shadern projicerar sina samplingar på skärmen
med bara projektionsmatrisen, och jämför djup som kameran ser dem – och i vyrymden är en punkts djup helt enkelt dess z
(negativt: kameran tittar längs -z). Startens geometrishaders gör det – learnopengls `ssao_geometry.vs`: positionen är
`view * model * aPos`, normalen transformeras med `transpose(inverse(mat3(view * model)))` och negeras för rummet, vars
insida vi ser:

:::opengl
```glsl
void main()
{
    vec4 viewPos = view * model * vec4(aPos, 1.0);
    FragPos = viewPos.xyz;
    TexCoords = aTexCoords;

    mat3 normalMatrix = transpose(inverse(mat3(view * model)));
    Normal = normalMatrix * (invertedNormals ? -aNormal : aNormal);

    gl_Position = projection * viewPos;
}
```

G-buffern är förra kapitlets – gPosition och gNormal `GL_RGBA16F`, gAlbedo `GL_RGBA`, alla `GL_NEAREST` – med ett tillägg
på gPosition:

```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
```

SSAO-samplingarna runt ett fragment nära fönstrets kant kan hamna utanför texturen; med standardläget `GL_REPEAT` skulle
de läsa positionerna vid motsatta kanten, och ocklusion skulle dyka upp där det inte finns någon.
:::
:::vulkan
```glsl
void main() {
    // the G-buffer is in view space: positions and normals as the camera sees them
    vec4 viewPos = ubo.view * pc.model * vec4(inPosition, 1.0);
    vs_out.fragPos = viewPos.xyz;
    vs_out.texCoord = inTexCoord;

    mat3 normalMatrix = transpose(inverse(mat3(ubo.view * pc.model)));
    vs_out.normal = normalMatrix * (pc.invertedNormals ? -inNormal : inNormal);

    gl_Position = ubo.proj * viewPos;
}
```

G-buffern är förra kapitlets – gPosition och gNormal `VK_FORMAT_R16G16B16A16_SFLOAT`, gAlbedo
`VK_FORMAT_R8G8B8A8_UNORM` – samplad med `gBufferSampler`: `VK_FILTER_NEAREST` och
**`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`**. SSAO-samplingarna runt en pixel nära fönstrets kant kan hamna utanför bilden;
med REPEAT skulle de läsa positionerna vid motsatta kanten, och ocklusion skulle dyka upp där det inte finns någon.
:::
:::d3d12
```hlsl
    // The position in view space: model, then view.
    float4 viewPos = mul(mul(position, model), view);
    result.fragPos = viewPos.xyz;
    result.texCoord = texCoord;

    float3 n = invertedNormals ? -normal : normal;
    float3 worldNormal = mul(float4(n, 0.0f), normalMatrix).xyz;
    result.normal = mul(float4(worldNormal, 0.0f), view).xyz;

    result.position = mul(viewPos, projection);
```

learnopengls `transpose(inverse(mat3(view * model)))` beräknas i två steg: först modellens normalmatris (från
`main.cpp`, som i de tidigare kapitlen), sedan vymatrisen själv – den bara roterar och flyttar, så den är sin egen
normalmatris. G-buffern är förra kapitlets – gPosition och gNormal `R16G16B16A16_FLOAT`, gAlbedo `R8G8B8A8_UNORM` – läst
med den statiska samplern s0: punktfiltrering och **CLAMP**. SSAO-samplingarna runt en pixel nära fönstrets kant kan
hamna utanför texturen; med WRAP skulle de läsa positionerna vid motsatta kanten, och ocklusion skulle dyka upp där det
inte finns någon.
:::

Djupet vi behöver är gPositions z. learnopengl påpekar att det går att rekonstruera de faktiska positionerna ur enbart
djupvärden med några fiffiga knep – det sparar positionsmålets minne och bandbredd, och är vad större renderare gör. Här
behålls positionsbuffern för tydlighetens skull.

Utöver G-buffern behöver SSAO-passet ett eget mål. Dess resultat är ett enda tal per pixel, ocklusionsfaktorn mellan 0.0
och 1.0 – så målet har **en enda kanal**:

:::opengl
```cpp
    // also create framebuffer to hold SSAO processing stage
    // -----------------------------------------------------
    unsigned int ssaoFBO;
    glGenFramebuffers(1, &ssaoFBO);
    glBindFramebuffer(GL_FRAMEBUFFER, ssaoFBO);
    unsigned int ssaoColorBuffer;
    // SSAO color buffer
    glGenTextures(1, &ssaoColorBuffer);
    glBindTexture(GL_TEXTURE_2D, ssaoColorBuffer);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, SCR_WIDTH, SCR_HEIGHT, 0, GL_RED, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, ssaoColorBuffer, 0);
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "SSAO Framebuffer not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

`GL_RED` som internt format: en kanal (8 normaliserade bitar i de flesta implementationer – gott och väl för en faktor
mellan 0 och 1). `GL_FLOAT` beskriver bara den (obefintliga) data som skickas in. Ingen djupbuffer: passet ritar bara
skärmfyrhörningen. En shader vars utdata är en `float` skriver den i den röda kanalen.
:::
:::vulkan
I Vulkan är det ett render pass med en färg-attachment, `VK_FORMAT_R8_UNORM` (learnopengls `GL_RED`: en 8-bitars kanal),
och inget djup. `createSsaoRenderPass()` byggs som bloom-kapitlets blur-pass: det gamla innehållet behövs inte –
skärmfyrhörningen täcker varje pixel – så `loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE` och inget rensas, och bilden lämnas
redo att samplas:

```cpp
        VkAttachmentDescription colorAttachment{};
        colorAttachment.format = VK_FORMAT_R8_UNORM; // one 8-bit channel: the ambient occlusion, 0..1
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE; // every pixel is written: no need to clear
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

Dess två subpass dependencies: före passet, vänta tills förra bildrutans shaders har läst bilden (den skrivs igen nu);
efter det, gör färgskrivningarna synliga för nästa pass fragment shader. `createSsaoFramebuffers()` skapar bilden
(`VK_FORMAT_R8_UNORM`, färg-attachment + samplad), dess view och dess framebuffer:

```cpp
        // SSAO color buffer
        createImage(swapChainExtent.width, swapChainExtent.height, VK_FORMAT_R8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, ssaoColorImage, ssaoColorImageMemory);
        ssaoColorImageView = createImageView(ssaoColorImage, VK_FORMAT_R8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
```

och pipelinen görs för det här render passet, utan djuptest:

```cpp
        // the SSAO pass's for its own (one channel, no depth)
        createPipeline("shaders/ssao.vert.spv", "shaders/ssao.frag.spv", ssaoRenderPass, 1, VK_FALSE, ssaoPipeline);
```

Alla Vulkan-enheter kan rendera i och sampla bilder i `VK_FORMAT_R8_UNORM`. Ett shaderutdata deklarerat som `float`
skriver bildens enda kanal.
:::
:::d3d12
I Direct3D 12 är det ett render target med formatet `DXGI_FORMAT_R8_UNORM` (learnopengls `GL_RED`: en 8-bitars kanal),
skapat som G-bufferns texturer – det börjar i `PIXEL_SHADER_RESOURCE`, dess RTV ligger på plats `FrameCount + 3`
(RTV-heapen växer till `FrameCount + 4`), dess SRV på plats 8:

```cpp
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8_UNORM, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
        const float optimizedClearColor[] = { 0.0f, 0.0f, 0.0f, 1.0f };
        CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R8_UNORM, optimizedClearColor);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
            &clearValue,
            IID_PPV_ARGS(&m_ssaoColorBuffer)));
```

följt av `CreateRenderTargetView` och en SRV med `srvDesc.Format = DXGI_FORMAT_R8_UNORM`. Passets PSO,
`m_ssaoPipelineState`, kompilerar `ssao.hlsl` och skriver en 8-bitars kanal, utan djup:

```cpp
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R8_UNORM;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_UNKNOWN;
        psoDesc.RTVFormats[2] = DXGI_FORMAT_UNKNOWN;
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_ssaoPipelineState)));
```

En pixel shader som returnerar en `float` skriver målets enda kanal.
:::

## Normalorienterad halvsfär

Vi behöver generera ett antal samplingar orienterade längs en ytas normal. Som vi kort diskuterade i början av kapitlet
vill vi generera samplingar som bildar en halvsfär. Eftersom det varken är enkelt eller rimligt att generera en
samplingskärna för varje normalriktning genererar vi kärnan i *tangentrymden*, med normalen pekande i positiv
z-riktning.

Varför en halvsfär och inte Cryteks sfär? Med en sfär ligger hälften av samplingarna runt ett fragment på en platt vägg
bakom väggen: en helt platt, oskymd yta skulle räknas som till hälften skymd, och allt får en grå ton. En halvsfär
orienterad längs ytans normal samplar bara rummet framför ytan, så en platt vägg får ingen ocklusion och bara verkliga
veck och närliggande objekt gör den mörkare.

```quiz
Varför samplar SSAO en halvsfär orienterad längs normalen i stället för en hel sfär runt fragmentet?
- [ ] En halvsfär behöver halva minnet för sin kärna
- [x] Hälften av en sfär ligger bakom själva ytan: en platt, öppen vägg skulle räknas som ungefär till hälften skymd och allt skulle se grått ut – halvsfären samplar bara rummet framför ytan
- [ ] Projektionsmatrisen kan bara projicera punkter framför kameran
- [ ] En sfärs samplingar kan inte roteras av brusvektorerna
---
Cryteks ursprungliga SSAO använde en sfär, vilket gav dess karaktäristiska grå, kantframhävande utseende. Normalen från G-buffern gör halvsfären möjlig.
```

Med en enhetshalvsfär kan vi få en samplingskärna med högst 32 samplingar så här: vi varierar x- och y-riktningen i
tangentrymden mellan -1.0 och 1.0, och z-riktningen mellan 0.0 och 1.0 (om vi varierade även z mellan -1.0 och 1.0 skulle
vi få en sfärisk kärna). Eftersom samplingskärnan orienteras längs ytnormalen hamnar alla de resulterande vektorerna i
halvsfären. Sedan normaliseras varje sampling och skalas med en slumpmässig längd, så att samplingarna ligger inuti
halvsfären, inte bara på dess yta.

Just nu är alla samplingar slumpmässigt fördelade i kärnan, men vi vill hellre lägga större vikt vid ocklusion nära
själva fragmentet. Vi vill fördela fler samplingar nära origo. Det kan vi göra med en accelererande
interpolationsfunktion: den i:te samplingens längd multipliceras med `lerp(0.1, 1.0, (i / 32)²)` – de första samplingarna
håller sig inom en tiondel av radien, och bara de sista når ut till hela radien.

:::opengl
learnopengls kod, med kursens slumptal – `ourLerp` är learnopengls linjära interpolation, `a + f * (b - a)`:

```cpp
    srand(42);
    std::vector<glm::vec3> ssaoKernel;
    for (unsigned int i = 0; i < 32; ++i) // 32 samples (learnopengl uses 64)
    {
        float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float z = rand() / (float)RAND_MAX; // a hemisphere: z only positive (along the normal)
        glm::vec3 sample(x, y, z);
        sample = glm::normalize(sample);
        sample *= rand() / (float)RAND_MAX;
        float scale = float(i) / 32.0f;

        // scale samples s.t. they're more aligned to center of kernel
        scale = ourLerp(0.1f, 1.0f, scale * scale);
        sample *= scale;
        ssaoKernel.push_back(sample);
    }
```

Kärnan är densamma för varje pixel: `ssao.fs` deklarerar `uniform vec3 samples[32];`, och renderloopen skickar den innan
SSAO-passet ritar (`shaderSSAO.setVec3("samples[" + std::to_string(i) + "]", ssaoKernel[i])` för varje `i`).
:::
:::vulkan
learnopengls kod, med kursens slumptal, i `generateSampleKernel()` – `ourLerp` är learnopengls linjära interpolation,
`a + f * (b - a)`, en fri funktion före klassen:

```cpp
    void generateSampleKernel() {
        srand(42);
        for (unsigned int i = 0; i < 32; ++i) { // 32 samples (learnopengl uses 64)
            float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
            float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
            float z = rand() / (float)RAND_MAX; // a hemisphere: z only positive (along the normal)
            glm::vec3 sample(x, y, z);
            sample = glm::normalize(sample);
            sample *= rand() / (float)RAND_MAX;
            float scale = float(i) / 32.0f;

            // scale samples s.t. they're more aligned to center of kernel
            scale = ourLerp(0.1f, 1.0f, scale * scale);
            sample *= scale;
            ssaoKernel.push_back(sample);
        }
    }
```

`ssaoKernel` är en medlem, `std::vector<glm::vec3>`. Kärnan är densamma för varje pixel, så den hamnar i uniform buffern
– men inte som `vec3`:or: **std140 lägger elementen i en array 16 byte isär**, så en `vec3 samples[32]` skulle ha en
lucka på 4 byte efter varje element. Uniform buffern får `glm::vec4 samples[32];` efter ljuset (shadern använder bara
`xyz`), och `updateUniformBuffer()` kopierar in kärnan:

```cpp
        // send kernel
        for (unsigned int i = 0; i < 32; ++i) {
            ubo.samples[i] = glm::vec4(ssaoKernel[i], 0.0f);
        }
```
:::
:::d3d12
learnopengls kod, med kursens slumptal, i `LoadAssets` – med DirectXMaths vektorfunktioner, och `ourLerp`, learnopengls
linjära interpolation `a + f * (b - a)`, som en global funktion bredvid den globala `std::vector<XMFLOAT3> ssaoKernel;`:

```cpp
    srand(42);
    for (unsigned int i = 0; i < 32; ++i) // 32 samples (learnopengl uses 64)
    {
        float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float z = rand() / (float)RAND_MAX; // a hemisphere: z only positive (along the normal)
        XMVECTOR sample = XMVectorSet(x, y, z, 0.0f);
        sample = XMVector3Normalize(sample);
        sample *= rand() / (float)RAND_MAX;
        float scale = static_cast<float>(i) / 32.0f;

        // scale samples s.t. they're more aligned to center of kernel
        scale = ourLerp(0.1f, 1.0f, scale * scale);
        sample *= scale;
        XMFLOAT3 kernelSample;
        XMStoreFloat3(&kernelSample, sample);
        ssaoKernel.push_back(kernelSample);
    }
```

Kärnan är densamma för varje pixel, så den hamnar i konstantbuffern – men inte som `float3`:or: **varje element i en
array i en konstantbuffer börjar en ny rad om 16 byte**, så en `float3`-sampling tar lika mycket plats som en `float4`.
C++-structen säger det uttryckligen med `XMFLOAT4 samples[32];` efter ljuset, och `OnUpdate` kopierar in kärnan:

```cpp
    // Send kernel: the 32 samples, for the SSAO pass.
    for (unsigned int i = 0; i < 32; ++i)
        constantBufferData.samples[i] = XMFLOAT4(ssaoKernel[i].x, ssaoKernel[i].y, ssaoKernel[i].z, 0.0f);
```
:::

Varje slumptal får en egen sats: `float x = …; float y = …; float z = …;`. Att skriva `glm::vec3(rand…, rand…, rand…)`
vore kortare, men C++ bestämmer inte i vilken ordning en funktions argument beräknas – en annan kompilator kunde dra de
tre talen i en annan ordning och få en annan kärna.

```quiz
Varför multipliceras varje samplings längd med `lerp(0.1, 1.0, (i / 32)²)`?
- [ ] För att hålla samplingarna inom fönstret
- [ ] För att göra kärnan symmetrisk kring normalen
- [x] För att lägga fler samplingar nära fragmentet: de första håller sig inom en tiondel av radien, bara de sista når hela radien – skymmande geometri nära väger tyngre än avlägsen
- [ ] För att normalisera samplingarna till enhetslängd
---
Utan den skulle de slumpmässiga längderna vara jämnt fördelade, och de flesta samplingar skulle ligga i halvsfärens yttre del (den har mer volym där). Det kvadrerade indexet gör att skalan först växer långsamt.
```

## Slumpmässiga kärnrotationer

Genom att föra in lite slump i samplingskärnorna minskar vi kraftigt antalet samplingar som behövs för bra resultat. Vi
skulle kunna skapa en slumpmässig rotationsvektor för varje fragment i scenen, men det äter snabbt minne. Det är
rimligare att skapa en liten textur med slumpmässiga rotationsvektorer som vi lägger ut över skärmen.

Vi skapar en array på 4 × 4 med slumpmässiga rotationsvektorer orienterade kring ytnormalen i tangentrymden. Eftersom
samplingskärnan är orienterad längs positiv z i tangentrymden lämnar vi z-komponenten på 0.0, så att vi roterar kring
z-axeln. De 16 vektorerna hamnar i en textur på 4 × 4 med **upprepad** adressering och **nearest**-filtrering:
SSAO-shadern läser den på `TexCoords * noiseScale`, med `noiseScale = (800 / 4, 600 / 4)` – fönstrets storlek delad med
brusets storlek – så texturkoordinaterna går från 0 till 200 över fönstret, texturen upprepas 200 × 150 gånger, och varje
pixel får exakt en av de 16 vektorerna, samma som pixeln 4 steg till höger eller 4 steg nedanför.

:::opengl
```cpp
    std::vector<glm::vec3> ssaoNoise;
    for (unsigned int i = 0; i < 16; i++)
    {
        float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        glm::vec3 noise(x, y, 0.0f); // rotate around z-axis (in tangent space)
        ssaoNoise.push_back(noise);
    }
    unsigned int noiseTexture; glGenTextures(1, &noiseTexture);
    glBindTexture(GL_TEXTURE_2D, noiseTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 4, 4, 0, GL_RGB, GL_FLOAT, &ssaoNoise[0]);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
```

Bruset fortsätter samma slumpföljd efter kärnan – därför genereras kärnan först. Datan är tre floats per texel (`GL_RGB`,
`GL_FLOAT`), lagrad i en textur med fyra 32-bitars flyttalskanaler (`GL_RGBA32F`): en `glm::vec3` är tre tätt packade
floats, så vektorns minne är exakt de 4 × 4 texlarnas data.
:::
:::vulkan
`createNoiseTexture()`, anropad direkt efter `generateSampleKernel()` – bruset fortsätter samma slumpföljd:

```cpp
        std::vector<glm::vec4> ssaoNoise;
        for (unsigned int i = 0; i < 16; i++) {
            float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
            float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
            glm::vec4 noise(x, y, 0.0f, 0.0f); // rotate around z-axis (in tangent space)
            ssaoNoise.push_back(noise);
        }
```

Vektorerna är `vec4`:or och bilden är `VK_FORMAT_R32G32B32A32_SFLOAT`, learnopengls `GL_RGBA32F`: Vulkan-enheter behöver
inte kunna sampla flyttalsbilder med 3 kanaler (`VK_FORMAT_R32G32B32_SFLOAT`), medan den med 4 kanaler är obligatorisk.
Uppladdningen är vulkan-tutorials texturuppladdning: en staging buffer med de 16 vektorerna (256 byte), en bild på 4 × 4
(transfer destination + samplad), en övergång till `TRANSFER_DST_OPTIMAL`, kopian, en övergång till
`SHADER_READ_ONLY_OPTIMAL`:

```cpp
        createImage(4, 4, VK_FORMAT_R32G32B32A32_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, noiseTextureImage, noiseTextureImageMemory);

        transitionImageLayout(noiseTextureImage, VK_FORMAT_R32G32B32A32_SFLOAT, VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL);
            copyBufferToImage(stagingBuffer, noiseTextureImage, 4, 4);
        transitionImageLayout(noiseTextureImage, VK_FORMAT_R32G32B32A32_SFLOAT, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL);
```

sedan förstörs staging buffern och view:n skapas. Den samplas med en egen sampler,
`createTextureSampler(VK_FILTER_NEAREST, VK_SAMPLER_ADDRESS_MODE_REPEAT, noiseSampler)` – G-bufferns sampler klämmer,
bruset måste upprepas. Layouten för descriptor set får binding 4 för bruset och binding 5 för SSAO-bilden (kopior av
`gPositionLayoutBinding` med annan `binding`), poolen 5 combined image samplers, och `createDescriptorSet()` två
`VkDescriptorImageInfo` och skrivningar till: `noiseTextureImageView` med `noiseSampler` på 4, `ssaoColorImageView` med
`gBufferSampler` på 5.
:::
:::d3d12
Direkt efter kärnan – bruset fortsätter samma slumpföljd:

```cpp
    std::vector<XMFLOAT4> ssaoNoise;
    for (unsigned int i = 0; i < 16; i++)
    {
        float x = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        float y = rand() / (float)RAND_MAX * 2.0f - 1.0f;
        XMFLOAT4 noise(x, y, 0.0f, 0.0f); // rotate around z-axis (in tangent space)
        ssaoNoise.push_back(noise);
    }
```

Texturen är `DXGI_FORMAT_R32G32B32A32_FLOAT`, learnopengls `GL_RGBA32F`, så vektorerna är `XMFLOAT4`:or – 16 byte per
texel. Den fylls som HelloTexture-exemplet fyller sin textur: texturen i en default heap, skapad i `COPY_DEST`; en
upload-buffer på `GetRequiredIntermediateSize`; `UpdateSubresources` kopierar datan till upload-buffern och spelar in
kopian till texturen; en barriär gör den till en shader resource:

```cpp
        // Copy the noise to the upload heap now and schedule the copy into the texture.
        D3D12_SUBRESOURCE_DATA textureData = {};
        textureData.pData = ssaoNoise.data();
        textureData.RowPitch = 4 * sizeof(XMFLOAT4);              // bytes per row: 4 texels
        textureData.SlicePitch = textureData.RowPitch * 4;       // bytes in the whole texture: 4 rows
        UpdateSubresources(m_commandList.Get(), m_noiseTexture.Get(), noiseTextureUploadHeap.Get(), 0, 0, 1, &textureData);

        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_noiseTexture.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);
```

`noiseTextureUploadHeap` är en lokal `ComPtr` deklarerad före blocket: den måste leva tills kommandolistan som kopierar
från den har körts – slutet av `LoadAssets` väntar på det. SRV:n hamnar på heap-plats 9 (CBV/SRV-heapen växer till
`1 + 2 * MaxMeshes + 5`). Bruset måste upprepas över fönstret, men s0 klämmer – så rotsignaturen får en andra statisk
sampler, s1, med samma punktfiltrering och WRAP-adressering:

```cpp
        samplers[1] = samplers[0];
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[1].ShaderRegister = 1;
```

(`D3D12_STATIC_SAMPLER_DESC samplers[2]`.) Rotsignaturen får också en femte parameter för belysningspassets SSAO-textur
på t3: `ranges[3].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 3)` och
`rootParameters[4].InitAsDescriptorTable(1, &ranges[3], D3D12_SHADER_VISIBILITY_PIXEL)`. Shadernas register är
learnopengls texturenheter: SSAO-passet läser gPosition (t0), gNormal (t1) och bruset (t2); belysningspasset gPosition,
gNormal, gAlbedo (t2) och SSAO-texturen (t3).
:::

:::opengl
```quiz
`glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 4, 4, 0, GL_RGB, GL_FLOAT, &ssaoNoise[0])` – vad innehåller brustexturen, och vad gör att den täcker hela fönstret?
- [x] 16 texlar med (x, y, 0, 1) – den saknade alfan blir 1 –, lästa med `GL_NEAREST` på `TexCoords * noiseScale` (0..200, 0..150) och `GL_REPEAT`, så texturen på 4 × 4 upprepas över fönstret och varje pixel får en vektor
- [ ] 16 texlar med (x, y, 0), utsträckta över fönstret med linjär filtrering
- [ ] 800 × 600 slumpvektorer, en per pixel
- [ ] 16 texlar, men bara fönstrets översta vänstra 4 × 4 pixlar läser dem; de andra får (0, 0, 0)
---
Med `GL_CLAMP_TO_EDGE` skulle varje koordinat över 1.0 läsa den sista texeln: nästan hela fönstret skulle få en och samma rotation.
```
:::
:::vulkan
```quiz
Varför är brusvektorerna `glm::vec4(x, y, 0.0f, 0.0f)` i en bild med `VK_FORMAT_R32G32B32A32_SFLOAT`, i stället för learnopengls `vec3`:or?
- [ ] Vulkan-bilder kan inte ha färre än fyra kanaler
- [ ] Staging buffern måste vara en multipel av 64 byte
- [ ] w-komponenten håller rotationsvinkeln
- [x] Vulkan-enheter behöver inte kunna sampla flyttalsbilder med 3 kanaler, medan `R32G32B32A32_SFLOAT` är obligatoriskt – och en texel med 4 kanaler är 16 byte, så vektorerna måste vara `vec4`:or för att kopian ska fylla texlarna rätt
---
learnopengls textur i `GL_RGBA32F` har också fyra kanaler; OpenGL konverterar sin `GL_RGB`-data vid uppladdningen. Vulkan kopierar byte som de är, så datan måste redan ha bildens layout.
```
:::
:::d3d12
```quiz
Varför får rotsignaturen en andra statisk sampler, s1, för brustexturen?
- [ ] En statisk sampler kan bara betjäna en textur
- [x] Bruset läses på `texCoord * noiseScale` – koordinater från 0 till 200 – och måste upprepas (WRAP), medan de fönsterstora texturerna läses med s0, som klämmer så att SSAO-samplingarna nära kanterna inte slår runt
- [ ] Flyttalstexturer behöver en egen sampler
- [ ] s0 har linjär filtrering, och bruset behöver punktfiltrering
---
Båda samplerna filtrerar med punkter; de skiljer sig bara i adresseringen. Shadern väljer sampler per uppslag: `texNoise.Sample(wrapSampler, …)`, `gPosition.Sample(clampSampler, …)`.
```
:::

## SSAO-shadern

SSAO-shadern körs på skärmfyrhörningen och beräknar ocklusionsvärdet för vart och ett av dess fragment. Dess parametrar
är learnopengls: kärnans storlek (32 här), en radie på 0.5 – halvsfärens storlek i vyrymdsenheter – och en bias på 0.025.

Vi börjar med att bygga en TBN-matris som transformerar vilken vektor som helst från tangentrymden till vyrymden. Med en
metod som kallas *Gram-Schmidt-processen* skapar vi en ortogonal bas, varje gång lite lutad utifrån värdet på
`randomVec`: slumpvektorn minus dess del längs normalen är en tangent vinkelrät mot normalen, bitangenten är de tvås
kryssprodukt. Eftersom vi använder en slumpvektor för att bygga tangenten behöver TBN-matrisen inte vara exakt i linje
med geometrins yta, och alltså behövs inga tangenter (och bitangenter) per vertex.

Sedan går vi igenom var och en av kärnans samplingar, transformerar dem från tangentrymden till vyrymden, lägger dem till
det aktuella fragmentets position, och jämför fragmentpositionens djup med samplingsdjupet som ligger i positionsbuffern:

1. `samplePos = fragPos + TBN * sample * radius` – samplingen i vyrymden.
2. Projicera den med projektionsmatrisen och gör perspektivdivisionen; omvandla x och y från normaliserade
   enhetskoordinater (-1..1) till texturkoordinater (0..1).
3. Läs gPosition där: dess z är djupet för den yta kameran ser på den platsen på skärmen – `sampleDepth`.
4. Om den ytan ligger framför samplingen – `sampleDepth >= samplePos.z + bias` (vyrymdens z är negativt; större är
   närmare) – ligger samplingen inuti geometrin och räknas som skymd. Biasen hindrar en platt yta från att skymma sig
   själv genom precisionen i de lagrade positionerna – samma idé som skuggbiasen.

Det finns ett problem till: när ett fragment nära kanten av en yta testas för ambient occlusion tar det också hänsyn
till djupvärden från ytor långt bakom den testade ytan; de värdena bidrar (felaktigt) till ocklusionsfaktorn. Det kan vi
lösa med en **avståndskontroll**: `smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth))` är 1.0 när
djupskillnaden ligger inom radien, och avtar mjukt för ytor längre bort, så en avlägsen yta knappt bidrar. Till sist
normaliseras ocklusionsbidraget med kärnans storlek och dras från 1.0, så att resultatet är andelen samplingar som *inte*
är skymda – faktorn som omgivningsljuset multipliceras med senare.

:::opengl
`ssao.fs` har sina deklarationer – samplerna, `uniform vec3 samples[32];`, `int kernelSize = 32; float radius = 0.5;
float bias = 0.025;`, `const vec2 noiseScale = vec2(800.0/4.0, 600.0/4.0);` och `uniform mat4 projection;`. Dess `main` är
learnopengls:

```glsl
void main()
{
    // get input for SSAO algorithm
    vec3 fragPos = texture(gPosition, TexCoords).xyz;
    vec3 normal = normalize(texture(gNormal, TexCoords).rgb);
    vec3 randomVec = normalize(texture(texNoise, TexCoords * noiseScale).xyz);
    // create TBN change-of-basis matrix: from tangent-space to view-space
    vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);
    // iterate over the sample kernel and calculate occlusion factor
    float occlusion = 0.0;
    for(int i = 0; i < kernelSize; ++i)
    {
        // get sample position
        vec3 samplePos = TBN * samples[i]; // from tangent to view-space
        samplePos = fragPos + samplePos * radius;

        // project sample position (to sample texture) (to get position on screen/texture)
        vec4 offset = vec4(samplePos, 1.0);
        offset = projection * offset; // from view to clip-space
        offset.xyz /= offset.w; // perspective divide
        offset.xyz = offset.xyz * 0.5 + 0.5; // transform to range 0.0 - 1.0

        // get sample depth
        float sampleDepth = texture(gPosition, offset.xy).z; // get depth value of kernel sample

        // range check & accumulate
        float rangeCheck = smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth));
        occlusion += (sampleDepth >= samplePos.z + bias ? 1.0 : 0.0) * rangeCheck;
    }
    occlusion = 1.0 - (occlusion / kernelSize);

    FragColor = occlusion;
}
```

`FragColor` är `out float` – den röda kanalen i `ssaoColorBuffer`. I `main.cpp`: `Shader shaderSSAO("ssao.vs",
"ssao.fs");`, dess samplers på enhet 0–2 (`shaderSSAO.setInt("gPosition", 0)`, `("gNormal", 1)`, `("texNoise", 2)`), och
passet mellan geometripasset och belysningspasset:

```cpp
        // 2. generate SSAO texture
        // ------------------------
        glBindFramebuffer(GL_FRAMEBUFFER, ssaoFBO);
        glClear(GL_COLOR_BUFFER_BIT);
        shaderSSAO.use();
        // Send kernel + rotation
        for (unsigned int i = 0; i < 32; ++i)
            shaderSSAO.setVec3("samples[" + std::to_string(i) + "]", ssaoKernel[i]);
        shaderSSAO.setMat4("projection", projection);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, gPosition);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, gNormal);
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, noiseTexture);
        renderQuad();
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

För att se resultatet visar belysningspasset det än så länge: det binder `ssaoColorBuffer` på enhet 3
(`shaderLightingPass.setInt("ssao", 3)`), och `ssao_lighting.fs` får `uniform sampler2D ssao;` och, efter sin sista rad,
`FragColor = vec4(vec3(texture(ssao, TexCoords).r), 1.0); // for now: show the SSAO texture`. Gör nu den första
uppgiften, **kernel**, och ta bort SSAO-texturen, dess framebuffer och brustexturen i slutet.
:::
:::vulkan
`ssao.frag` deklarerar uniform buffern fram till kärnan (ljuset kommer först, så blocket måste deklarera det för att
offsets ska bli rätt), gPosition, gNormal och bruset på binding 1, 2 och 4, ett `float`-utdata, och learnopengls
parametrar:

```glsl
// the uniform buffer up to the kernel
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    Light light;
    vec4 samples[32]; // the kernel (xyz; std140: array elements are 16 bytes apart)
} ubo;

layout(binding = 1) uniform sampler2D gPosition;
layout(binding = 2) uniform sampler2D gNormal;
layout(binding = 4) uniform sampler2D texNoise;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out float outColor; // the SSAO image has one channel

// parameters (you'd probably want to use them as uniforms to more easily tweak the effect)
int kernelSize = 32;
float radius = 0.5;
float bias = 0.025;

// tile noise texture over screen based on screen dimensions divided by noise size
const vec2 noiseScale = vec2(800.0/4.0, 600.0/4.0);
```

(med `struct Light` deklarerad som i `ssao_lighting.frag`). Dess `main` är learnopengls, med kärnan och projektionen ur
uniform buffern:

```glsl
void main() {
    // get input for SSAO algorithm
    vec3 fragPos = texture(gPosition, fragTexCoord).xyz;
    vec3 normal = normalize(texture(gNormal, fragTexCoord).rgb);
    vec3 randomVec = normalize(texture(texNoise, fragTexCoord * noiseScale).xyz);
    // create TBN change-of-basis matrix: from tangent-space to view-space
    vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);
    // iterate over the sample kernel and calculate occlusion factor
    float occlusion = 0.0;
    for (int i = 0; i < kernelSize; ++i) {
        // get sample position
        vec3 samplePos = TBN * ubo.samples[i].xyz; // from tangent to view-space
        samplePos = fragPos + samplePos * radius;

        // project sample position (to sample texture) (to get position on screen/texture)
        vec4 offset = vec4(samplePos, 1.0);
        offset = ubo.proj * offset; // from view to clip-space
        offset.xyz /= offset.w; // perspective divide
        offset.xy = offset.xy * 0.5 + 0.5; // transform to range 0.0 - 1.0 (the flipped projection's y points down, like v)

        // get sample depth
        float sampleDepth = texture(gPosition, offset.xy).z; // get depth value of kernel sample

        // range check & accumulate
        float rangeCheck = smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth));
        occlusion += (sampleDepth >= samplePos.z + bias ? 1.0 : 0.0) * rangeCheck;
    }
    occlusion = 1.0 - (occlusion / kernelSize);

    outColor = occlusion;
}
```

Projektionen är kursens Vulkan-projektion med `proj[1][1] *= -1`: efter den pekar normaliserade enhetskoordinaters y
nedåt – åt samma håll som bildens v, som är 0 på översta raden. Så `offset.xy * 0.5 + 0.5` ger texturkoordinaterna
direkt, som i OpenGL. Bara x och y omvandlas: djupet läses ur gPosition, inte ur det projicerade z (som ändå är 0..1 i
Vulkan).

I `recordCommandBuffer()` kommer SSAO-passet mellan geometripasset och fönstrets pass. Descriptor setet är fortfarande
bundet från geometripasset, viewporten och scissorn är fortfarande satta, och vertexbuffern binds igen före skärmpassen
(planetens ritning band sin egen):

```cpp
        // 2. generate SSAO texture
        VkRenderPassBeginInfo ssaoPassInfo{};
        ssaoPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
        ssaoPassInfo.renderPass = ssaoRenderPass;
        ssaoPassInfo.framebuffer = ssaoFramebuffer;
        ssaoPassInfo.renderArea.offset = {0, 0};
        ssaoPassInfo.renderArea.extent = swapChainExtent;
        ssaoPassInfo.clearValueCount = 0; // loadOp DONT_CARE: nothing to clear

        vkCmdBeginRenderPass(commandBuffer, &ssaoPassInfo, VK_SUBPASS_CONTENTS_INLINE);
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, ssaoPipeline);
        // the kernel and the projection are in the uniform buffer, gPosition, gNormal and the noise in the descriptor set
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // renderQuad()
        vkCmdEndRenderPass(commandBuffer); // the SSAO image is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL
```

Setet innehåller SSAO-bilden på binding 5 medan SSAO-passet ritar i den – tillåtet, eftersom ingen shader i det passet
läser binding 5. För att se resultatet visar belysningspasset det än så länge: `ssao_lighting.frag` får `layout(binding =
5) uniform sampler2D ssao;` och, efter sin sista rad, `outColor = vec4(vec3(texture(ssao, fragTexCoord).r), 1.0); // for
now: show the SSAO texture`. Gör nu den första uppgiften, **kernel**, och förstör brustexturen och dess sampler,
SSAO-bilden, dess framebuffer, pipelinen och render passet i `cleanup()`.
:::
:::d3d12
`ssao.hlsl` har sina deklarationer: gPosition, gNormal och bruset på t0, t1 och t2, samplerna `clampSampler` (s0) och
`wrapSampler` (s1), konstantbuffern fram till kärnan (`float4 samples[32];` efter ljuset), och learnopengls parametrar som
`static const` – `kernelSize = 32`, `radius = 0.5f`, `bias = 0.025f`, `noiseScale = float2(800.0f / 4.0f, 600.0f /
4.0f)`. Dess `PSMain` returnerar en `float` och är learnopengls `main`:

```hlsl
    // get input for SSAO algorithm
    float3 fragPos = gPosition.Sample(clampSampler, input.texCoord).xyz;
    float3 normal = normalize(gNormal.Sample(clampSampler, input.texCoord).rgb);
    float3 randomVec = normalize(texNoise.Sample(wrapSampler, input.texCoord * noiseScale).xyz);
    // create TBN change-of-basis matrix: from tangent-space to view-space (its rows are the
    // tangent, the bitangent and the normal, so mul(v, TBN) = v.x * T + v.y * B + v.z * N)
    float3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    float3 bitangent = cross(normal, tangent);
    float3x3 TBN = float3x3(tangent, bitangent, normal);
    // iterate over the sample kernel and calculate occlusion factor
    float occlusion = 0.0f;
    for (int i = 0; i < kernelSize; ++i)
    {
        // get sample position
        float3 samplePos = mul(samples[i].xyz, TBN); // from tangent to view-space
        samplePos = fragPos + samplePos * radius;

        // project sample position (to sample texture) (to get position on screen/texture)
        float4 offset = float4(samplePos, 1.0f);
        offset = mul(offset, projection); // from view to clip-space
        offset.xyz /= offset.w; // perspective divide
        // transform to range 0.0 - 1.0: x as in OpenGL, y flipped - texture coordinate v
        // points down, normalized device y up
        offset.xy = float2(offset.x * 0.5f + 0.5f, -offset.y * 0.5f + 0.5f);

        // get sample depth
        float sampleDepth = gPosition.Sample(clampSampler, offset.xy).z; // get depth value of kernel sample

        // range check & accumulate
        float rangeCheck = smoothstep(0.0f, 1.0f, radius / abs(fragPos.z - sampleDepth));
        occlusion += (sampleDepth >= samplePos.z + bias ? 1.0f : 0.0f) * rangeCheck;
    }
    occlusion = 1.0f - (occlusion / kernelSize);

    return occlusion;
```

Två ställen skiljer sig från GLSL. `float3x3(tangent, bitangent, normal)` har de tre vektorerna som **rader** (GLSL:s
`mat3`-konstruktor tar kolumner), så radvektorn gånger matrisen, `mul(samples[i].xyz, TBN)`, är x·T + y·B + z·N – GLSL:s
`TBN * samples[i]`. Och Direct3D:s texturkoordinat v pekar **nedåt** medan normaliserade enhetskoordinaters y pekar uppåt,
så y vänds på vägen till texturkoordinater. Vyrymden är learnopengls högerhänta (`XMMatrixLookAtRH`), så djupen är
negativa och jämförelserna oförändrade; loopen över `kernelSize` har ett fast antal varv, så `Sample` går bra i den.

I `PopulateCommandList`, mellan geometripasset och belysningspasset – en barriär, SSAO-texturen som enda render target,
ingen DSV, PSO:t, gPosition och gNormal i tabell 2 (handtaget `gPositionNormal`, plats 5), bruset i tabell 3:

```cpp
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(m_ssaoColorBuffer.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, barriers);
    CD3DX12_CPU_DESCRIPTOR_HANDLE ssaoRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 3, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &ssaoRtvHandle, FALSE, nullptr);
    m_commandList->ClearRenderTargetView(ssaoRtvHandle, clearColor, 0, nullptr);
    m_commandList->SetPipelineState(m_ssaoPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, gPositionNormal);
    CD3DX12_GPU_DESCRIPTOR_HANDLE texNoise(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 9, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(3, texNoise);
    m_commandList->DrawInstanced(6, 1, 36, 0);    // the screen quad: vertices 36 to 41
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(m_ssaoColorBuffer.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, barriers);
```

För att se resultatet visar belysningspasset det än så länge: det sätter tabell 4 till plats 8
(`SetGraphicsRootDescriptorTable(4, ssao)`), och `ssao_lighting.hlsl` får `Texture2D ssao : register(t3);` och, i stället
för sin `return`, `return float4(ssao.Sample(clampSampler, input.texCoord).rrr, 1.0f);` – "for now: show the SSAO
texture". Gör nu den första uppgiften, **kernel**.
:::

:::opengl
```quiz
Vad gör `offset.xyz = offset.xyz * 0.5 + 0.5` efter perspektivdivisionen i `ssao.fs`?
- [ ] Den omvandlar samplingen från vyrymden till världsrymden
- [ ] Den skalar samplingen till kärnans radie
- [x] Den avbildar normaliserade enhetskoordinater (-1..1) på texturkoordinater (0..1), så att `offset.xy` är där samplingen syns i gPosition – OpenGL:s textur-v och NDC-y pekar båda uppåt
- [ ] Den tar bort biasen
---
Bara `offset.xy` används sedan: djupet att jämföra läses ur gPosition, det tas inte från det projicerade z.
```
:::
:::vulkan
```quiz
Varför gör Vulkans `ssao.frag` om den projicerade samplingen till texturkoordinater med bara `offset.xy * 0.5 + 0.5`, utan att vända y?
- [x] Kursens projektion har `proj[1][1] *= -1`: normaliserade enhetskoordinaters y pekar nedåt, som bildens v (0 på översta raden), så avbildningen är densamma på båda axlarna
- [ ] Vulkans texturer lagras upp och ner, vilket tar ut vändningen
- [ ] Samplern vänder v när `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE` är satt
- [ ] Bara x spelar roll för SSAO-uppslaget
---
Bara xy omvandlas: djupet att jämföra är gPositions z. Vulkans projicerade z är ändå 0..1, så `* 0.5 + 0.5` vore fel för det.
```
:::
:::d3d12
```quiz
Varför beräknar `ssao.hlsl` texturkoordinaterna som `float2(offset.x * 0.5f + 0.5f, -offset.y * 0.5f + 0.5f)`?
- [ ] HLSL:s `mul` speglar projektionen i y
- [ ] Brustexturen är lagrad upp och ner
- [ ] Direct3D:s normaliserade x pekar åt vänster
- [x] Direct3D:s texturkoordinat v pekar nedåt medan normaliserade enhetskoordinaters y pekar uppåt: en sampling ovanför fragmentet måste slås upp på en rad närmare toppen av gPosition
---
Utan vändningen skulle varje sampling läsa djupet på en plats speglad kring fönstrets mittrad – ocklusionen skulle komma från fel ställen.
```
:::

```quiz
Vad är avståndskontrollen `smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth))` till för?
- [ ] Den håller samplingarna inom halvsfären
- [ ] Den ersätter biasen för ytor som vetter mot kameran
- [ ] Den gör resultatet till en mjuk gradient i stället för en hård 0 eller 1 per sampling
- [x] Vid ett fragment nära ett objekts kant hamnar samplingar på en yta långt bakom det; utan kontrollen skulle den avlägsna ytan räknas som skymmande – med den bidrar en djupskillnad mycket större än radien knappt
---
Inom radien är kontrollen 1.0 och samplingen räknas fullt ut; vid två gånger radien är den nere i ungefär 0.5 och fortsätter falla. Utan den skulle du se mörka halor runt planeten på bakväggen.
```

Tryck på **Build & run**: fönstret visar **den råa SSAO-texturen i grått**. Vitt där inget skymmer: det mesta av planeten,
golvet, väggarna. Grått där något gör det: en kontaktskugga på golvet precis under planeten, en tunn grå linje längs
kanten mellan golvet och bakväggen, ett svagt band på planeten strax ovanför ringen – och **ringens undersida, mörk**,
mörkast mot dess ytterkant. De grå områdena är ditrade i ett fint, regelbundet mönster: bruset på 4 × 4, varje pixel
roterad med en av de 16 vektorerna, mönstret upprepat var fjärde pixel.

Varför är ringen så mörk? Ringen är ett enda platt plan vars normal pekar uppåt (+y), och kameran ser dess undersida.
SSAO lägger samplingarnas halvsfär på normalens sida – ovanför ringen, alltså *bakom* ringens yta som kameran ser den. Så
de flesta samplingarna hamnar bakom den yta kameran ser där, och räknas som skymda. learnopengls ryggsäck har inga sådana
ensidiga ytor. En lösning vore att vända normalen för baksidor i geometripasset (`gl_FrontFacing` i GLSL,
`SV_IsFrontFace` i HLSL); kursen behåller learnopengls shaders.

:::vulkan d3d12
Brusmönstret läggs ut från fönstrets **överkant**, eftersom v går från översta raden och nedåt, medan det i OpenGL börjar
nertill: en viss pixel får en annan av de 16 rotationerna än i OpenGL-versionen. Bilderna stämmer överens i stort, men
inte pixel för pixel.
:::

## Blur av ambient occlusion

Mellan SSAO-passet och belysningspasset vill vi först blurra SSAO-texturen. Slumprotationernas upprepade brusmönster syns
tydligt i det råa resultatet, och vi vill ha en mjuk ocklusion. En enkel blurshader räcker: vi går igenom de omgivande
SSAO-texlarna mellan -2.0 och 2.0 (exklusive), samplar SSAO-texturen lika många gånger som brustexturens mått – 4 × 4 –
och tar medelvärdet.

Varför precis 4 × 4? Bruset upprepas var fjärde pixel i båda riktningarna, så varje block på 4 × 4 pixlar innehåller var
och en av de 16 rotationerna exakt en gång. Att ta medelvärdet av ett sådant block tar medelvärdet över alla
rotationerna – mönstret försvinner helt, medan ett mindre fönster skulle lämna en del av det kvar. Fönstret är inte
centrerat (förskjutningarna -2, -1, 0, 1): bilden flyttas en halv pixel, vilket du inte ser.

:::opengl
`ssao_blur.fs` är learnopengls:

```glsl
void main()
{
    vec2 texelSize = 1.0 / vec2(textureSize(ssaoInput, 0));
    float result = 0.0;
    for (int x = -2; x < 2; ++x)
    {
        for (int y = -2; y < 2; ++y)
        {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            result += texture(ssaoInput, TexCoords + offset).r;
        }
    }
    FragColor = result / (4.0 * 4.0);
}
```

Bluren får en framebuffer som `ssaoFBO`: `ssaoBlurFBO` med en `GL_RED`-textur, `ssaoColorBufferBlur` (`GL_NEAREST`;
learnopengls `// and blur stage`). I `main.cpp`: `Shader shaderSSAOBlur("ssao.vs", "ssao_blur.fs");` med
`shaderSSAOBlur.setInt("ssaoInput", 0);`, och passet efter SSAO-passet:

```cpp
        // 3. blur SSAO texture to remove noise
        // ------------------------------------
        glBindFramebuffer(GL_FRAMEBUFFER, ssaoBlurFBO);
        glClear(GL_COLOR_BUFFER_BIT);
        shaderSSAOBlur.use();
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, ssaoColorBuffer);
        renderQuad();
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Belysningspasset binder nu `ssaoColorBufferBlur` på enhet 3. Gör nu uppgiften **blur**, och ta bort blurens textur och
framebuffer i slutet.
:::
:::vulkan
`ssao_blur.frag` är learnopengls, och läser SSAO-bilden på binding 5:

```glsl
// the SSAO image (binding 5)
layout(binding = 5) uniform sampler2D ssaoInput;

layout(location = 0) in vec2 fragTexCoord;

layout(location = 0) out float outColor;

void main() {
    vec2 texelSize = 1.0 / vec2(textureSize(ssaoInput, 0));
    float result = 0.0;
    for (int x = -2; x < 2; ++x) {
        for (int y = -2; y < 2; ++y) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            result += texture(ssaoInput, fragTexCoord + offset).r;
        }
    }
    outColor = result / (4.0 * 4.0);
}
```

Den blurrade bilden har samma format som SSAO-bilden, så den använder **samma render pass**: `createSsaoFramebuffers()`
skapar en andra bild (`ssaoBlurImage`, `VK_FORMAT_R8_UNORM`, färg-attachment + samplad) och dess view, och återanvänder
`framebufferInfo` för dess framebuffer:

```cpp
        framebufferInfo.pAttachments = &ssaoBlurImageView;

        if (vkCreateFramebuffer(device, &framebufferInfo, nullptr, &ssaoBlurFramebuffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to create SSAO blur framebuffer!");
        }
```

Även pipelinen görs för `ssaoRenderPass`: `createPipeline("shaders/ssao.vert.spv", "shaders/ssao_blur.frag.spv",
ssaoRenderPass, 1, VK_FALSE, ssaoBlurPipeline)`. Den blurrade bilden får binding 6 (layoutens bindings blir 7, poolen 6
samplers, `createDescriptorSet()` skriver `ssaoBlurImageView` med `gBufferSampler`). I `recordCommandBuffer()`, efter
SSAO-passet, blurens pass – SSAO-passets begin info med den andra framebuffern:

```cpp
        // 3. blur SSAO texture to remove noise
        VkRenderPassBeginInfo ssaoBlurPassInfo = ssaoPassInfo;
        ssaoBlurPassInfo.framebuffer = ssaoBlurFramebuffer;

        vkCmdBeginRenderPass(commandBuffer, &ssaoBlurPassInfo, VK_SUBPASS_CONTENTS_INLINE);
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, ssaoBlurPipeline);
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // renderQuad(): reads the SSAO image (binding 5)
        vkCmdEndRenderPass(commandBuffer);
```

Render passets dependencies kedjar ihop de två passen: blurens fragment shader väntar på SSAO-passets färgskrivningar.
`ssao_lighting.frag` läser nu binding 6: `layout(binding = 6) uniform sampler2D ssao; // the blurred SSAO image`. Gör nu
uppgiften **blur**, och förstör blurens bild, view, minne, framebuffer och pipeline i `cleanup()`.
:::
:::d3d12
`ssao_blur.hlsl`s `PSMain` är learnopengls, med `GetDimensions` för `textureSize`:

```hlsl
float PSMain(PSInput input) : SV_TARGET
{
    float width, height;
    ssaoInput.GetDimensions(width, height);
    float2 texelSize = 1.0f / float2(width, height);
    float result = 0.0f;
    for (int x = -2; x < 2; ++x)
    {
        for (int y = -2; y < 2; ++y)
        {
            float2 offset = float2(float(x), float(y)) * texelSize;
            result += ssaoInput.Sample(clampSampler, input.texCoord + offset).r;
        }
    }
    return result / (4.0f * 4.0f);
}
```

Blurens mål, `m_ssaoColorBufferBlur`, skapas som `m_ssaoColorBuffer` – `R8_UNORM`, RTV-plats `FrameCount + 4`, SRV-plats 10
(heaparna växer till `FrameCount + 5` och `1 + 2 * MaxMeshes + 6`). Dess PSO, `m_ssaoBlurPipelineState`, är SSAO-passets
beskrivning med shaderna i `ssao_blur.hlsl`. I `PopulateCommandList`, efter SSAO-passet:

```cpp
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(m_ssaoColorBufferBlur.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, barriers);
    CD3DX12_CPU_DESCRIPTOR_HANDLE ssaoBlurRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 4, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &ssaoBlurRtvHandle, FALSE, nullptr);
    m_commandList->ClearRenderTargetView(ssaoBlurRtvHandle, clearColor, 0, nullptr);
    m_commandList->SetPipelineState(m_ssaoBlurPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE ssaoInput(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 8, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, ssaoInput);
    m_commandList->DrawInstanced(6, 1, 36, 0);
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(m_ssaoColorBufferBlur.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    m_commandList->ResourceBarrier(1, barriers);
```

SSAO-texturen läses som t0 genom tabell 2 – ett intervall med två SRV:er, så det täcker plats 8 och 9; bluren läser bara
t0. Belysningspassets tabell 4 pekar nu på plats 10. Gör nu uppgiften **blur**.
:::

```quiz
Varför tar bluren medelvärdet av precis ett block på 4 × 4 texlar?
- [x] Brustexturen är 4 × 4 och upprepas: varje block på 4 × 4 pixlar innehåller var och en av de 16 rotationerna en gång, så medelvärdet tar bort brusmönstret helt
- [ ] Ett block på 4 × 4 är det största en fragment shader kan läsa
- [ ] SSAO-målet är 4 gånger mindre än fönstret
- [ ] Fyra är antalet kanaler i brustexturen
---
Ett mindre block skulle lämna en del av mönstret kvar; ett större skulle blurra själva ocklusionen mer än nödvändigt.
```

Tryck på **Build & run**: fönstret visar **den mjuka AO:n**. Ditheringen är borta; ringens undersida är en mjuk mörk
gradient, kontaktskuggan under planeten en jämn grå fläck, golv-/väggkanten en mjuk linje, och bandet på planeten ovanför
ringen lite bredare och mjukare. Allt annat är fortfarande vitt.

## Att använda ambient occlusion

Att föra in ocklusionsfaktorerna i belysningsekvationen är otroligt enkelt: allt vi behöver göra är att multiplicera
fragmentets ocklusionsfaktor med belysningens omgivningskomponent, och vi är klara. Bara omgivningsljuset skyms – det står
för ljuset som kommer indirekt, från alla håll; det direkta ljuset från punktljuset behåller sitt eget diffusa och
spekulära ljus (utan skuggor – de skulle kräva de tidigare kapitlens shadow maps).

:::opengl
I `ssao_lighting.fs`, läs faktorn och multiplicera omgivningstermen med den – learnopengls belysningsshader:

```glsl
    // retrieve data from gbuffer
    vec3 FragPos = texture(gPosition, TexCoords).rgb;
    vec3 Normal = texture(gNormal, TexCoords).rgb;
    vec3 Diffuse = texture(gAlbedo, TexCoords).rgb;
    float AmbientOcclusion = texture(ssao, TexCoords).r;

    // then calculate lighting as usual
    vec3 ambient = vec3(0.3 * Diffuse * AmbientOcclusion);
```

och ta bort raden "for now", så att `FragColor = vec4(lighting, 1.0);` är shaderns sista ord igen. Gör nu den sista
uppgiften, **apply**.
:::
:::vulkan
I `ssao_lighting.frag`, läs faktorn och multiplicera omgivningstermen med den – learnopengls belysningsshader:

```glsl
    // retrieve data from gbuffer
    vec3 FragPos = texture(gPosition, fragTexCoord).rgb;
    vec3 Normal = texture(gNormal, fragTexCoord).rgb;
    vec3 Diffuse = texture(gAlbedo, fragTexCoord).rgb;
    float AmbientOcclusion = texture(ssao, fragTexCoord).r;

    // then calculate lighting as usual
    vec3 ambient = vec3(0.3 * Diffuse * AmbientOcclusion);
```

och ta bort raden "for now", så att `outColor = vec4(lighting, 1.0);` är shaderns sista ord igen. Gör nu den sista
uppgiften, **apply**.
:::
:::d3d12
I `ssao_lighting.hlsl`, läs faktorn och multiplicera omgivningstermen med den – learnopengls belysningsshader:

```hlsl
    // retrieve data from gbuffer
    float3 FragPos = gPosition.Sample(clampSampler, input.texCoord).rgb;
    float3 Normal = gNormal.Sample(clampSampler, input.texCoord).rgb;
    float3 Diffuse = gAlbedo.Sample(clampSampler, input.texCoord).rgb;
    float AmbientOcclusion = ssao.Sample(clampSampler, input.texCoord).r;

    // then calculate lighting as usual
    float3 ambient = 0.3f * Diffuse * AmbientOcclusion;
```

och återställ slutet av `PSMain`: `return float4(lighting, 1.0f);` i stället för raden "for now". Gör nu den sista
uppgiften, **apply**.
:::

```quiz
Varför multiplicerar ocklusionsfaktorn bara omgivningstermen, inte det diffusa och spekulära ljuset?
- [ ] De diffusa och spekulära termerna beräknas före SSAO-passet
- [ ] Att multiplicera även dem skulle göra bilden ljusare
- [x] Ambient occlusion approximerar hur mycket av det indirekta ljuset från alla håll som når en punkt; det direkta ljuset från punktljuset beror på om själva ljuset syns – en fråga för skuggor, inte för den närliggande geometri SSAO samplar
- [ ] SSAO-texturen har bara en kanal, och den diffusa termen har tre
---
I den här scenen får planetens framsida bara omgivningsljus, så det är där ocklusionen syns bäst; de belysta delarna ändras knappt.
```

Tryck på **Build & run**: den belysta scenen är tillbaka, **mörkare där AO:n var grå**. Ringens undersida är mycket mörkare
än förut (dess yttre delar tappar hälften till två tredjedelar av sin ljusstyrka), golvet precis under planeten har en
mjuk kontaktskugga som ställer planeten på golvet, och golv-/väggkanten är lite mörkare. Det öppna golvet, väggarna,
planetens framsida och dess belysta kant är oförändrade. Det är lösningen, och learnopengls SSAO.

Screen-space ambient occlusion är en mycket anpassningsbar effekt som i hög grad bygger på att justera parametrarna
efter typen av scen. Det finns ingen perfekt kombination av parametrar för alla sorters scener. Vissa scener fungerar
bara med en liten radie, medan andra kräver en större radie och fler samplingar för att se realistiska ut. Kärnans
storlek, radien och biasen är de viktigaste reglagen; learnopengl föreslår också att höja det slutliga ocklusionsvärdet
till en valfri potens för att göra effekten starkare (`FragColor = pow(occlusion, power);`). Mer avancerade tekniker i
skärmrymden, som horizon-based ambient occlusion (HBAO), samplar djupbuffern längs riktningar och ger en mer fysikaliskt
grundad ocklusion – men strukturen förblir den du har byggt här: en G-buffer, ett ocklusionspass in i ett mål med en
kanal, en blur, och en omgivningsterm som använder den.

Därmed är lektionerna i delen Avancerad belysning klara: Blinn-Phong, gammakorrigering, skuggor, normal och parallax
mapping, HDR, bloom, deferred shading och SSAO – samma tekniker i varje API, var och en på den plats dess API ger den.

## Mer att läsa

:::opengl
- [SSAO](https://learnopengl.com/Advanced-Lighting/SSAO): learnopengls kapitel som det här kapitlet följer, med
  ryggsäcksscenen och bilder av varje steg.
- [ssao.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/9.ssao/ssao.cpp):
  learnopengls program.
- [std::rand](https://en.cppreference.com/w/cpp/numeric/random/rand): C-bibliotekets slumptal, `srand` och `RAND_MAX`.
:::
:::vulkan
- [SSAO](https://learnopengl.com/Advanced-Lighting/SSAO): learnopengls kapitel som det här kapitlet följer, med
  ryggsäcksscenen och bilder av varje steg.
- [Texture mapping: Images](https://vulkan-tutorial.com/Texture_mapping/Images): vulkan-tutorials texturuppladdning via en
  staging buffer, som brustexturen använder.
- [Formats](https://docs.vulkan.org/spec/latest/chapters/formats.html): specifikationens listor över de formategenskaper
  varje enhet måste stödja.
- [std::rand](https://en.cppreference.com/w/cpp/numeric/random/rand): C-bibliotekets slumptal, `srand` och `RAND_MAX`.
:::
:::d3d12
- [SSAO](https://learnopengl.com/Advanced-Lighting/SSAO): learnopengls kapitel som det här kapitlet följer, med
  ryggsäcksscenen och bilder av varje steg.
- [UpdateSubresources](https://learn.microsoft.com/en-us/windows/win32/direct3d12/updatesubresources2): att kopiera
  CPU-data till en textur via en upload-buffer.
- [D3D12_STATIC_SAMPLER_DESC](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_static_sampler_desc):
  rotsignaturens statiska samplers och deras adresseringslägen.
- [std::rand](https://en.cppreference.com/w/cpp/numeric/random/rand): C-bibliotekets slumptal, `srand` och `RAND_MAX`.
:::
