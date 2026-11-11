# OIT: Weighted Blended

Förra kapitlet slutade med tre fyrhörningar: en ogenomskinlig röd och två halvgenomskinliga, en grön och en blå, ritade i
fel ordning med djupskrivning påslagen – så där den gröna täcker den blå saknas den blå. I det här kapitlet rättar vi
det med *weighted blended order-independent transparency*, tekniken som Morgan McGuire och Louis Bavoil publicerade i
*Journal of Computer Graphics Techniques* 2013. Den är en approximation, men en billig sådan: ett pass över den
genomskinliga geometrin in i två extra render targets, ett pass över hela skärmen för att sätta ihop dem, ingen sortering
och inga listor per pixel. Sedan dess har den använts i spel och motorer för partiklar, rök, glas och lövverk.

Idén i en mening: byt ut over-operatorn, som beror på fragmentens ordning, mot en summa och en produkt, som inte gör det.
Resten av kapitlet handlar om hur man räknar ut den summan och den produkten med den fasta blendingen, och hur {{api}}
låter dig blenda på olika sätt i två render targets samtidigt.

## Viktat och blendat

Kom ihåg over-operatorn från förra kapitlet: varje nytt fragment med färgen `Ci` och alfa `αi` gör om pixelns färg `C`
till `Ci · αi + C · (1 − αi)`. För n genomskinliga lager över en ogenomskinlig bakgrund `C0`, blendade rätt bakifrån och
framåt, blir slutfärgen ett nästlat uttryck där varje lagers bidrag dämpas av alla lager framför det. Det är den
nästlingen som gör att ordningen spelar roll.

McGuire och Bavoil approximerar det i två delar. Den första delen är hur mycket av bakgrunden som fortfarande syns
igenom alla lager – *revealage*, ungefär "genomsläpp". Den är exakt och ordningsoberoende, eftersom den är en produkt:

```text
revealage = (1 − α1) · (1 − α2) · … · (1 − αn)
```

Två lager med alfa 0.5 släpper igenom 0.5 · 0.5 = 0.25 av bakgrunden, i vilken ordning som helst. Den andra delen är
lagrens egen färg. I stället för att nästla dem tar vi ett viktat medelvärde av deras (förmultiplicerade) färger:

```text
                Σ Ci · αi · w(zi, αi)
average  =  -----------------------------
                  Σ αi · w(zi, αi)
```

och blendar medelvärdet över bakgrunden med täckningen `1 − revealage`:

```text
C = average · (1 − revealage) + C0 · revealage
```

Summor och produkter bryr sig inte om termernas ordning: rita lagren i vilken ordning som helst och resultatet blir
detsamma. Det medelvärdet förlorar är skymningen *mellan* de genomskinliga lagren – vid sorterad blending dämpar det
närmaste lagret allt bakom sig. Vikten `w(z, α)` finns till för att vinna tillbaka en del av det: den ger fragment nära
kameran större vikt än fragment långt bort, så att de närmare lagren dominerar medelvärdet, som de skulle göra med
sortering. Artikeln föreslår flera viktfunktioner; learnopengl använder den här:

```text
w = clamp(pow(min(1.0, α * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - z * 0.9, 3.0), 1e-2, 3e3)
```

där `z` är fragmentets fönsterdjup, 0 vid det nära planet och 1 vid det bortre. Alfafaktorn gynnar fragment som täcker
mer (den mättas vid α = 0.1, så den spelar bara roll för mycket svaga fragment), djupfaktorn faller brant med djupet, och
`clamp` håller vikterna inom ett intervall som en 16-bitars float kan summera utan att flöda över alltför snabbt.

```quiz
Två genomskinliga lager, båda med alfa 0.5, täcker en pixel. Hur mycket av bakgrunden släpper weighted blended OIT igenom där, och beror det på vilket lager som ritas först?
- [ ] 0.5, från lagret som ritas sist; ja
- [ ] 0, eftersom två lager som täcker hälften var täcker allt; nej
- [x] 0.25 = (1 − 0.5) · (1 − 0.5); nej, en produkt beror inte på faktorernas ordning
- [ ] 0.25, men bara om det närmare lagret ritas först
---
Revealage är produkten av alla (1 − α): exakt och ordningsoberoende. Approximationen sitter i färgen, det viktade medelvärdet av lagren.
```

### Två render targets

Det genomskinliga passet räknar ut båda delarna per pixel med enbart blending – shadern läser aldrig målet. Det renderar
till två färgmål samtidigt:

- **ackumuleringsmålet**, RGBA i 16-bitars flyttal, rensat till (0, 0, 0, 0). Fragment shadern skriver `(C · α, α) · w`,
  och blendfunktionen `ONE, ONE` adderar det till det som redan finns. Efter passet innehåller rgb `Σ Ci · αi · wi` och
  alfa `Σ αi · wi` – täljare och nämnare i medelvärdet. De blir lätt större än 1.0 (vikterna når 3000), därav flyttal.
- **revealage-målet**, en enda 8-bitarskanal, rensat till 1. Fragment shadern skriver `α`, och blendfunktionen
  `ZERO, ONE_MINUS_SRC_COLOR` gör om det till `dst = 0 · α + dst · (1 − α)`: varje fragment multiplicerar målet med sitt
  `1 − α`. Efter passet innehåller det revealage.

De två målen behöver *olika* blendfunktioner i samma draw-anrop. Det är teknikens enda krav på hårdvaran, och varje API
har en inställning för det – vi kommer till den i det genomskinliga passet.

Ett tredje pass, **kompositpasset**, läser båda målen, dividerar den ackumulerade färgen med den ackumulerade alfan och
blendar medelvärdet över den ogenomskinliga bilden med den vanliga over-operatorn och alfa `1 − revealage`. Over med alfa
`a = 1 − revealage` ger `average · (1 − revealage) + C0 · revealage` – precis formeln ovan.

Bildrutan har då fyra steg, de fyra passen i learnopengls program:

1. **Solida passet**: de ogenomskinliga objekten i ett "ogenomskinligt" färgmål utanför skärmen, med en djupbuffer.
2. **Genomskinliga passet**: de genomskinliga objekten i ackumulerings- och revealage-målen, djuptestade mot det
   ogenomskinliga djupet men utan att skriva det.
3. **Kompositpasset**: en fyrhörning över hela skärmen som blendar det genomskinliga resultatet över det ogenomskinliga
   målet.
4. **Sista passet**: en fyrhörning över hela skärmen som kopierar det ogenomskinliga målet till fönstret.

Projektet är förra kapitlets: kameran i (0, 0, 5), den röda ogenomskinliga fyrhörningen i (0.5, -0.2, 1.0), den gröna
(alfa 0.5) i (-0.3, -0.6, 2.0) – närmast – och den blå (alfa 0.5) i (-0.6, 0.5, 0.0) – längst bort, delvis bakom den
röda – ritade röd, grön, blå. learnopengls demo lägger de tre fyrhörningarna ovanpå varandra mitt i fönstret; kursen
sprider ut dem så att varje fall syns.

:::opengl
Programmet begär en OpenGL 4.2 core-kontext (som learnopengl): `glBlendFunci`, en blendfunktion per färg-attachment, är
core sedan OpenGL 4.0, och `layout (binding = N)` på samplers i GLSL kräver 4.2 – alla shaders börjar med
`#version 420 core`. Resten av kursen använder 3.3. macOS stannar vid 4.1: där skulle du begära 4.1, skriva
`#version 410 core` och sätta kompositshaderns två sampler-enheter från C++ med `compositeShader.setInt("accum", 0)` och
`setInt("reveal", 1)` i stället för `layout (binding = …)`.
:::
:::vulkan
learnopengls renderingstillstånd – djuptest, djupskrivning, blendfunktion – är pipeline-tillstånd i Vulkan, så projektet
har en hjälpfunktion som skapar en pipeline med alla tre:

```cpp
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, VkRenderPass pipelineRenderPass, uint32_t colorAttachmentCount,
                        VkBool32 depthTestEnable, VkBool32 depthWriteEnable, VkBool32 blendEnable,
                        VkBlendFactor srcBlendFactor0, VkBlendFactor dstBlendFactor0, VkBlendFactor srcBlendFactor1, VkBlendFactor dstBlendFactor1,
                        VkPipeline& pipeline)
```

Den sätter djupjämförelsen till `LESS`, `VK_BLEND_OP_ADD` (learnopengls `glBlendEquation(GL_FUNC_ADD)`) och blendar
alfakanalen med samma faktorer som färgen, som `glBlendFunc` gör. learnopengls uniforms `mvp` och `color` är push
constants (`struct PushConstants { glm::mat4 mvp; glm::vec4 color; }`), och learnopengls framebuffers blir render passes
med framebuffers gjorda för dem – fyra render passes per bildruta, inspelade efter varandra i `recordCommandBuffer()`.
:::
:::d3d12
learnopengls renderingstillstånd är pipeline-tillstånd i DirectX 12: varje pass får ett eget pipeline state-objekt,
skapat i `LoadAssets` från en och samma `D3D12_GRAPHICS_PIPELINE_STATE_DESC` som ändras steg för steg. learnopengls
uniforms `mvp` och `color` är root constants (root-parameter 0: `struct ObjectConstants { XMFLOAT4X4 mvp; XMFLOAT4
color; }`). Starten har redan det skärmfyrhörningarna behöver: root-parameter 1, en descriptor table med två SRV:er (t0,
t1) för pixel shadern, en statisk sampler s0 (linjär, clamp), och descriptor heaps i sina slutliga storlekar –
RTV-heapen med `FrameCount + 3` platser (back buffrarna, sedan den ogenomskinliga texturen, ackumulerings- och
revealage-texturen), SRV-heapen med 3 (plats 0 ogenomskinlig, 1 ackumulering, 2 revealage) och DSV-heapen med
djupbuffern (`D32_FLOAT`). Varje textur utanför skärmen vilar i tillståndet `PIXEL_SHADER_RESOURCE` och görs om till
`RENDER_TARGET` med en barriär inför passet som ritar i den.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in; **Build & run** (Ctrl+Enter) kompilerar programmet och kör
det i den inbyggda simulatorn.

## Det ogenomskinliga passet

De ogenomskinliga objekten ritas som vanligt: djuptest på, djupskrivning på, ingen blending. Skillnaden är vart de
hamnar. learnopengl renderar dem i en egen framebuffer – en färgtextur i flyttal och en djuptextur – i stället för i
fönstret. Två skäl: det genomskinliga passet måste testa mot *den här* djupbuffern, så den måste gå att koppla till en
annan framebuffer (fönstrets djupbuffer kan inte delas med en framebuffer utanför skärmen i OpenGL), och kompositpasset
blendar in i det här färgmålet. I slutet av bildrutan kopierar ett sista pass den ogenomskinliga texturen till fönstret.

:::opengl
Den ogenomskinliga framebuffern, learnopengls uppsättning:

```cpp
    // set up the opaque framebuffer and its texture attachments
    // ------------------------------------------------------------------
    unsigned int opaqueFBO;
    glGenFramebuffers(1, &opaqueFBO);

    unsigned int opaqueTexture;
    glGenTextures(1, &opaqueTexture);
    glBindTexture(GL_TEXTURE_2D, opaqueTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_HALF_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glBindTexture(GL_TEXTURE_2D, 0);

    unsigned int depthTexture;
    glGenTextures(1, &depthTexture);
    glBindTexture(GL_TEXTURE_2D, depthTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, SCR_WIDTH, SCR_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
    glBindTexture(GL_TEXTURE_2D, 0);

    glBindFramebuffer(GL_FRAMEBUFFER, opaqueFBO);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, opaqueTexture, 0);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthTexture, 0);

    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Opaque framebuffer is not complete!" << std::endl;

    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Djupet är en *textur* och inte en renderbuffer, eftersom den genomskinliga framebuffern kopplar in samma textur i nästa
uppgift. I renderingsloopen binder du `opaqueFBO` innan det solida passet rensar; det solida passet ritar sedan den röda
fyrhörningen i den som förut. Efter allt annat ritar det sista passet den ogenomskinliga texturen i fönstret:

```cpp
        // draw to backbuffer (final pass)
        // -----

        // set render states
        glDisable(GL_DEPTH_TEST);
        glDepthMask(GL_TRUE); // enable depth writes so glClear won't ignore clearing the depth buffer
        glDisable(GL_BLEND);

        // bind backbuffer
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);

        // use screen shader
        screenShader.use();

        // draw final screen quad
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, opaqueTexture);
        glBindVertexArray(quadVAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);
```

Lägg märke till kommentaren vid `glDepthMask(GL_TRUE)`: `glClear` respekterar djupskrivningsmasken. Det genomskinliga
passet kommer att stänga av djupskrivningen, och om den fortfarande vore avstängd här skulle nästa bildrutas `glClear`
lämna djupbuffern orörd. Skärmshadern (`Shader screenShader("screen.vs", "screen.fs");`) samplar texturen vid
fyrhörningens texturkoordinater.

Gör nu den första uppgiften, **opaque-pass**: skapa shadern, framebuffern och dess två texturer, bind den för det solida
passet, lägg till det sista passet, och ta bort texturerna och framebuffern på slutet.
:::
:::vulkan
Den ogenomskinliga framebuffern blir ett eget render pass, `opaqueRenderPass`, med två attachments: ett färg-attachment i
`VK_FORMAT_R16G16B16A16_SFLOAT` (learnopengls `GL_RGBA16F`) och ett djup-attachment i `findDepthFormat()`. Båda rensas i
början och **sparas** (STORE) i slutet – senare pass använder dem igen:

```cpp
        VkAttachmentDescription colorAttachment{};
        colorAttachment.format = VK_FORMAT_R16G16B16A16_SFLOAT; // learnopengl: GL_RGBA16F
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass

        VkAttachmentDescription depthAttachment{};
        depthAttachment.format = findDepthFormat();
        depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE; // the transparent pass tests against it
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

Tills vidare slutar färgen i `SHADER_READ_ONLY_OPTIMAL`, eftersom det sista passet samplar den direkt efteråt. Render
passet får två subpass-beroenden: före passet väntar det tills förra bildrutan är klar med bilderna (det sista passet
läste färgen, det genomskinliga passet testade mot djupet); efter det väntar en fragment shader som samplar färgen in
färgskrivningarna (`COLOR_ATTACHMENT_OUTPUT` / `COLOR_ATTACHMENT_WRITE` → `FRAGMENT_SHADER` / `SHADER_READ`). Det är de
beroendena som OpenGL:s drivrutin räknar ut åt dig när du binder en textur du just renderat till.

`createOpaqueFramebuffer()` skapar bilderna – `opaqueImage` (användning som färg-attachment **och** samplad) och
`opaqueDepthImage` (learnopengls `depthTexture`; fönstret behåller sin egen `depthImage`) – deras vyer och
`opaqueFramebuffer`. Den solida och den genomskinliga pipelinen skapas nu för `opaqueRenderPass`, och en ny pipeline för
det sista passet skapas för fönstrets `renderPass`, utan djuptest och utan blending:

```cpp
        // final pass: no depth test, no blending
        createPipeline("shaders/screen.vert.spv", "shaders/screen.frag.spv", renderPass, 1, VK_FALSE, VK_FALSE, VK_FALSE,
            VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ZERO, VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ZERO, screenPipeline);
```

Skärmshadern läser den ogenomskinliga bilden genom ett descriptor set. Starten har en descriptor set layout med två
combined image samplers (bindning 0 och 1 – kompositpasset kommer att behöva båda), en pool, samplern
`colorBufferSampler` (linjär, clamp to edge) och hjälpfunktionen `createDescriptorSet(firstView, secondView, set)`; det
sista passet använder `createDescriptorSet(opaqueImageView, opaqueImageView, screenDescriptorSet)` (bindning 1 används
inte av `screen.frag`).

I `recordCommandBuffer()` börjar det solida passet nu `opaqueRenderPass` med `opaqueFramebuffer` (rensningsvärdena (0,
0, 0, 0) och djupet 1.0), och efter de genomskinliga fyrhörningarna kommer det sista passet i fönstrets render pass:

```cpp
        // use screen shader
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, screenPipeline);

        // draw final screen quad
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &screenDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 0, 0);
```

Skärmfyrhörningen använder samma sex vertexar som de tre fyrhörningarna, med oförändrade uv: i Vulkan pekar både
fönstrets y och en bilds v nedåt, så bilden hamnar rättvänd.

Gör nu den första uppgiften, **opaque-pass**: render passet, bilderna och framebuffern, skärmpipelinen och dess
descriptor set, de två render passen i `recordCommandBuffer()`, och städningen av de nya objekten.
:::
:::d3d12
Den ogenomskinliga framebuffern blir en textur med två vyer: en render target view (passet ritar i den) och en shader
resource view (det sista passet läser den). Det är en committed resource i en default heap med flaggan
`ALLOW_RENDER_TARGET`, skapad i `PIXEL_SHADER_RESOURCE` med ett optimerat rensningsvärde:

```cpp
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
        const float zeroFillerVec[] = { 0.0f, 0.0f, 0.0f, 0.0f };
        CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R16G16B16A16_FLOAT, zeroFillerVec);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
            &clearValue,
            IID_PPV_ARGS(&m_opaqueTexture)));
```

Dess RTV hamnar på plats `FrameCount` i RTV-heapen (efter swap chainens buffrar), dess SRV på plats 0 i SRV-heapen.
Djupbuffern är den starten redan har. Det solida pipeline state-objektet renderar nu i texturens format,
`psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT` – det genomskinliga härleds från det – och det sista passet får
ett eget, `m_screenPipelineState`, kompilerat från `screen.hlsl`: ingen blending, `DepthEnable = FALSE`, ett mål i back
bufferns format `DXGI_FORMAT_R8G8B8A8_UNORM` och `DSVFormat = DXGI_FORMAT_UNKNOWN`.

I `PopulateCommandList` börjar det solida passet med en barriär som gör texturen till ett render target, binder den med
djupbuffern och rensar båda:

```cpp
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_opaqueTexture.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);
    CD3DX12_CPU_DESCRIPTOR_HANDLE opaqueRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &opaqueRtvHandle, FALSE, &dsvHandle);
```

På slutet kommer det sista passet: två barriärer på en gång (den ogenomskinliga texturen tillbaka till
`PIXEL_SHADER_RESOURCE`, back buffern från `PRESENT` till `RENDER_TARGET`), back buffern bunden utan djupbuffer och
rensad, sedan skärmfyrhörningen med tabellen i början av SRV-heapen (t0 = den ogenomskinliga texturen):

```cpp
    // use screen pipeline state, with the opaque texture (t0): the table starts at slot 0
    m_commandList->SetPipelineState(m_screenPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(1, m_srvHeap->GetGPUDescriptorHandleForHeapStart());

    // draw final screen quad
    m_commandList->DrawInstanced(6, 1, 0, 0);
```

Gör nu den första uppgiften, **opaque-pass**: texturen och dess två vyer, skärmens pipeline state och det solida
pipeline state-objektets nya format, och barriärerna, målen och det sista passet i `PopulateCommandList`.
:::

Bygg och kör: **ingenting ändras** i bilden – och det är meningen. De genomskinliga fyrhörningarna blendas fortfarande på
vanligt sätt, nu i det ogenomskinliga målet i stället för i fönstret, och den blå fyrhörningens hörn saknas fortfarande
under den gröna. Bara där den gröna täcker den röda flyttar sig värdet ett steg (128 i stället för 127 i den röda
kanalen): målet i 16-bitars flyttal avrundar annorlunda än ett fönster med 8 bitar.

```quiz
Varför renderar bildrutan de ogenomskinliga objekten i ett mål utanför skärmen i stället för direkt i fönstret?
- [ ] För att fönstret inte kan hålla färgen på ett ogenomskinligt objekt
- [x] För att det genomskinliga passet måste testa mot de ogenomskinliga objektens djupbuffer, och kompositpasset blendar in i det ogenomskinliga färgmålet – båda måste vara mål som programmet kan binda igen i senare pass
- [ ] För att over-operatorn kräver flyttal
- [ ] För att de ogenomskinliga objekten måste sorteras bakifrån och framåt
---
Det genomskinliga passet delar det ogenomskinliga passets djup (testas, skrivs inte) så att genomskinliga fragment bakom ogenomskinliga objekt förkastas; kompositpasset blendar sedan in i den ogenomskinliga bilden. Det sista passet kopierar bara resultatet till fönstret.
```

## Det genomskinliga passet

Nu kommer teknikens kärna. De genomskinliga fyrhörningarna hamnar i ackumulerings- och revealage-målen, med tre
renderingstillstånd som skiljer sig från det solida passet:

- **Djuptest på, djupskrivning av.** Testet mot det ogenomskinliga djupet förkastar genomskinliga fragment bakom
  ogenomskinliga objekt – den blå fyrhörningen förblir dold bakom den röda. Utan skrivning döljer genomskinliga fragment
  aldrig varandra.
- **En blendfunktion per mål.** Ackumulering: `ONE, ONE` (addera). Revealage: `ZERO, ONE_MINUS_SRC_COLOR` (multiplicera
  med `1 − α`).
- **Olika rensningsvärden per mål.** Ackumuleringen börjar på 0 (inget adderat), revealage på 1 (allt syns).

Fragment shadern är densamma i alla API:er: vikten, sedan de två utdata.

:::opengl
`transparent.fs` får två utdata i stället för en:

```glsl
// shader outputs
layout (location = 0) out vec4 accum;
layout (location = 1) out float reveal;

// material color (alpha = opacity)
uniform vec4 color;

void main()
{
    // weight function
    float weight = clamp(pow(min(1.0, color.a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - gl_FragCoord.z * 0.9, 3.0), 1e-2, 3e3);

    // store pixel color accumulation
    accum = vec4(color.rgb * color.a, color.a) * weight;

    // store pixel revealage threshold
    reveal = color.a;
}
```

`gl_FragCoord.z` är fragmentets fönsterdjup, det värde som hamnar i djupbuffern. Den genomskinliga framebuffern har två
färgtexturer – `accumTexture` (`GL_RGBA16F`) och `revealTexture` (`GL_R8`, en 8-bitarskanal) – och kopplar in den
ogenomskinliga framebufferns `depthTexture` som sitt djup:

```cpp
    glBindFramebuffer(GL_FRAMEBUFFER, transparentFBO);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, accumTexture, 0);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT1, GL_TEXTURE_2D, revealTexture, 0);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthTexture, 0); // opaque framebuffer's depth texture

    const GLenum transparentDrawBuffers[] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1 };
    glDrawBuffers(2, transparentDrawBuffers);
```

`glDrawBuffers` känner du igen från kapitlet *Bloom*: utdata på plats 0 går till attachment 0, plats 1 till attachment 1.
Till skillnad från draw buffers är blendtillståndet globalt, men sedan OpenGL 4.0 kan det sättas per draw buffer med
`glBlendFunci(buf, src, dst)`. I renderingsloopen ersätts den vanliga blendingen av det genomskinliga passets tillstånd:

```cpp
        // configure render states
        glDepthMask(GL_FALSE);
        glEnable(GL_BLEND);
        glBlendFunci(0, GL_ONE, GL_ONE);
        glBlendFunci(1, GL_ZERO, GL_ONE_MINUS_SRC_COLOR);
        glBlendEquation(GL_FUNC_ADD);

        // bind transparent framebuffer to render transparent objects
        glBindFramebuffer(GL_FRAMEBUFFER, transparentFBO);
        glClearBufferfv(GL_COLOR, 0, &zeroFillerVec[0]);
        glClearBufferfv(GL_COLOR, 1, &oneFillerVec[0]);
```

`glClear` skulle rensa båda färg-attachments till samma `glClearColor`; `glClearBufferfv(GL_COLOR, i, value)` rensar draw
buffer `i` till ett eget värde – `zeroFillerVec` och `oneFillerVec` är `glm::vec4(0.0f)` och `glm::vec4(1.0f)`.
Djupbuffern rensas inte: den innehåller den röda fyrhörningen.

```quiz
Vad gör `glBlendFunci(1, GL_ZERO, GL_ONE_MINUS_SRC_COLOR)` som `glBlendFunc` inte kan?
- [ ] Den blendar revealage-texturen med 16-bitars flyttalsprecision
- [ ] Den gör blendfunktionen beroende av fragmentets djup
- [ ] Den slår bara på blending för draw buffer 1
- [x] Den sätter blendfunktionen för draw buffer 1 ensam, så att draw buffer 0 kan behålla `GL_ONE, GL_ONE` i samma draw-anrop
---
`glBlendFunc` sätter samma funktion för alla draw buffers. Blendfunktioner per buffer är core sedan OpenGL 4.0 (och tillägget ARB_draw_buffers_blend före det) – därför begär det här kapitlets program en 4.x-kontext.
```

Gör nu den andra uppgiften, **transparent-pass**: framebuffern med sina två texturer och det delade djupet, de två
fyllnadsvektorerna, tillstånden och rensningarna före den gröna och den blå fyrhörningen, shadern, och städningen.
:::
:::vulkan
`transparent.frag` får två utdata i stället för en; färgen kommer från push constants:

```glsl
// shader outputs
layout(location = 0) out vec4 accum;
layout(location = 1) out float reveal;

// material color
layout(push_constant) uniform PushConstants {
    mat4 mvp;
    vec4 color;
} pc;

void main() {
    // weight function
    float weight = clamp(pow(min(1.0, pc.color.a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - gl_FragCoord.z * 0.9, 3.0), 1e-2, 3e3);

    // store pixel color accumulation
    accum = vec4(pc.color.rgb * pc.color.a, pc.color.a) * weight;

    // store pixel revealage threshold
    reveal = pc.color.a;
}
```

Vikten använder `gl_FragCoord.z` precis som learnopengls shader. Med `GLM_FORCE_DEPTH_ZERO_TO_ONE` är Vulkans fönsterdjup
samma värde som OpenGL:s för samma punkt – OpenGL avbildar sitt NDC-djup -1..1 på 0..1, Vulkans projektion ger 0..1
direkt – så vikterna blir desamma.

Den genomskinliga framebuffern är ett render pass med tre attachments: ackumuleringsbilden
(`VK_FORMAT_R16G16B16A16_SFLOAT`) och revealage-bilden (`VK_FORMAT_R8_UNORM`), båda rensade och sparade och lämnade i
`SHADER_READ_ONLY_OPTIMAL` åt kompositpasset, och det ogenomskinliga passets djupbild – **inläst** (LOAD), inte rensad:

```cpp
        VkAttachmentDescription depthAttachment{};
        depthAttachment.format = findDepthFormat();
        depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_LOAD; // the opaque objects' depth
        depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.initialLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
        depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

Den initiala layouten är den som det ogenomskinliga passet lämnade bilden i. Subpasset har två färgreferenser (utdata på
plats 0 → accum, 1 → reveal, learnopengls `glDrawBuffers`) och djupet på index 2; `createTransparentFramebuffer()` skapar
de två bilderna och en framebuffer av `accumImageView`, `revealImageView` och `opaqueDepthImageView`.

Blendfunktionerna hör till pipelinen: ett `VkPipelineColorBlendAttachmentState` per färg-attachment. Som standard kräver
Vulkan att alla är **identiska**; olika kräver enhetsfunktionen `independentBlend` – learnopengls `glBlendFunci` på
Vulkan-vis. Nästan varje GPU för datorer har den, men du måste kontrollera den i `isDeviceSuitable`
(`supportedFeatures.independentBlend`) och slå på den när du skapar enheten:

```cpp
        deviceFeatures.independentBlend = VK_TRUE; // a different blend function per colour attachment (glBlendFunci)
```

Sedan skapas den genomskinliga pipelinen för det nya render passet, med två attachments, djuptest på, djupskrivning av,
och de två faktorparen:

```cpp
        // transparent objects: depth test against the opaque depth, no depth writes; a blend function per attachment
        // (learnopengl's glBlendFunci): accum ONE, ONE (add up), reveal ZERO, ONE_MINUS_SRC_COLOR (multiply by 1 - alpha)
        createPipeline("shaders/transparent.vert.spv", "shaders/transparent.frag.spv", transparentRenderPass, 2, VK_TRUE, VK_FALSE, VK_TRUE,
            VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ZERO, VK_BLEND_FACTOR_ONE_MINUS_SRC_COLOR, transparentPipeline);
```

I `recordCommandBuffer()` slutar det ogenomskinliga passet nu efter den röda fyrhörningen, och det genomskinliga passet
börjar med egna rensningsvärden – learnopengls två `glClearBufferfv`-anrop:

```cpp
        // accum starts at 0 (nothing added yet), reveal at 1 (everything behind fully visible); the depth is loaded
        std::array<VkClearValue, 3> transparentClearValues{};
        transparentClearValues[0].color = {{0.0f, 0.0f, 0.0f, 0.0f}};
        transparentClearValues[1].color = {{1.0f, 1.0f, 1.0f, 1.0f}};
```

Det tredje värdet hör till djup-attachmentet; det måste finnas (rensningsvärdena indexeras per attachment), men med
`loadOp LOAD` ignoreras det.

```quiz
Varför behöver den genomskinliga pipelinen enhetsfunktionen `independentBlend`?
- [ ] För att blending i en flyttalsbild är en valfri funktion
- [ ] För att djup-attachmentet läses in i stället för att rensas
- [x] För att dess två färg-attachments har olika blendtillstånd, och utan funktionen måste alla en pipelines `VkPipelineColorBlendAttachmentState` vara identiska
- [ ] För att fragment shadern skriver två utdata
---
Två utdata till två attachments är alltid tillåtet (det är vad subpassets färgreferenser finns till); bara olika blendtillstånd per attachment är valfritt. GPU:er för datorer stöder det, men enheten måste skapas med det påslaget.
```

Gör nu den andra uppgiften, **transparent-pass**: funktionen, render passet, bilderna och framebuffern, pipelinen, de två
render passen i `recordCommandBuffer()`, shadern, och städningen.
:::
:::d3d12
Pixel shadern i `transparent.hlsl` får två utdata i stället för en. I HLSL skriver en pixel shader till flera render
targets genom att returnera en struct vars medlemmar har semantikerna `SV_TARGET0`, `SV_TARGET1`, …:

```hlsl
// The pixel shader's two outputs: SV_TARGET0 goes to the first render target (accum),
// SV_TARGET1 to the second (reveal).
struct PSOutput
{
    float4 accum : SV_TARGET0;
    float reveal : SV_TARGET1;
};

// The pixel shader: the weighted, premultiplied colour into accum and the opacity into reveal.
PSOutput PSMain(PSInput input)
{
    PSOutput output;

    // weight function: input.position.z is the fragment's depth (0 at the near plane, 1 at
    // the far plane - learnopengl's gl_FragCoord.z)
    float weight = clamp(pow(min(1.0f, color.a * 10.0f) + 0.01f, 3.0f) * 1e8 * pow(1.0f - input.position.z * 0.9f, 3.0f), 1e-2, 3e3);

    // store pixel color accumulation
    output.accum = float4(color.rgb * color.a, color.a) * weight;

    // store pixel revealage threshold
    output.reveal = color.a;

    return output;
}
```

`SV_POSITION.z` i pixel shadern är det djup som hamnar i djupbuffern, 0..1 som OpenGL:s fönsterdjup, så vikterna blir
desamma. De två texturerna skapas som den ogenomskinliga – ackumuleringen i `DXGI_FORMAT_R16G16B16A16_FLOAT`
(rensningsvärde 0), revealage i `DXGI_FORMAT_R8_UNORM` (rensningsvärde 1) – med RTV:er på platserna `FrameCount + 1` och
`+ 2` och SRV:er på platserna 1 och 2.

Blendfunktionerna hör till pipeline state-objektets `BlendState`, som har en array `RenderTarget[8]` – men som standard
använder Direct3D `RenderTarget[0]` för **alla** mål. `IndependentBlendEnable = TRUE` får det att använda varje post för
sitt eget mål; det är learnopengls `glBlendFunci`:

```cpp
        psoDesc.DepthStencilState.DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO;
        psoDesc.NumRenderTargets = 2;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_R8_UNORM;
        // Each render target blends in its own way: IndependentBlendEnable makes Direct3D use
        // RenderTarget[1] for the second target (otherwise every target uses RenderTarget[0]).
        psoDesc.BlendState.IndependentBlendEnable = TRUE;
        // accum: glBlendFunci(0, GL_ONE, GL_ONE) - the colours are added up.
        psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;
        psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_ONE;
        psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_ONE;
        psoDesc.BlendState.RenderTarget[0].BlendOp = D3D12_BLEND_OP_ADD;
        psoDesc.BlendState.RenderTarget[0].SrcBlendAlpha = D3D12_BLEND_ONE;
        psoDesc.BlendState.RenderTarget[0].DestBlendAlpha = D3D12_BLEND_ONE;
        psoDesc.BlendState.RenderTarget[0].BlendOpAlpha = D3D12_BLEND_OP_ADD;
        // reveal: glBlendFunci(1, GL_ZERO, GL_ONE_MINUS_SRC_COLOR) - the target is multiplied
        // by (1 - alpha) of every fragment. (Alpha factors cannot be _COLOR factors in
        // Direct3D: INV_SRC_ALPHA does the same for the alpha channel, which R8 does not have.)
        psoDesc.BlendState.RenderTarget[1].BlendEnable = TRUE;
        psoDesc.BlendState.RenderTarget[1].SrcBlend = D3D12_BLEND_ZERO;
        psoDesc.BlendState.RenderTarget[1].DestBlend = D3D12_BLEND_INV_SRC_COLOR;
        psoDesc.BlendState.RenderTarget[1].BlendOp = D3D12_BLEND_OP_ADD;
        psoDesc.BlendState.RenderTarget[1].SrcBlendAlpha = D3D12_BLEND_ZERO;
        psoDesc.BlendState.RenderTarget[1].DestBlendAlpha = D3D12_BLEND_INV_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[1].BlendOpAlpha = D3D12_BLEND_OP_ADD;
        psoDesc.BlendState.RenderTarget[1].RenderTargetWriteMask = D3D12_COLOR_WRITE_ENABLE_ALL;
```

`D3D12_DEPTH_WRITE_MASK_ZERO` är `glDepthMask(GL_FALSE)`; djuptestet (LESS) är fortfarande på. I `PopulateCommandList`
gör det genomskinliga passet om båda texturerna till render targets, binder **båda** på en gång med det solida passets
djupbuffer och rensar var och en till sitt eget värde – learnopengls två `glClearBufferfv`-anrop:

```cpp
    m_commandList->OMSetRenderTargets(2, transparentRtvHandles, FALSE, &dsvHandle);
    const float oneFillerVec[] = { 1.0f, 1.0f, 1.0f, 1.0f };
    m_commandList->ClearRenderTargetView(transparentRtvHandles[0], zeroFillerVec, 0, nullptr);
    m_commandList->ClearRenderTargetView(transparentRtvHandles[1], oneFillerVec, 0, nullptr);
```

Djupbuffern rensas inte: den innehåller den röda fyrhörningen. Efter den blå fyrhörningen gör två barriärer om båda
texturerna till `PIXEL_SHADER_RESOURCE` igen, åt kompositpasset.

```quiz
Vad händer om det genomskinliga pipeline state-objektet sätter `RenderTarget[1]` men låter `IndependentBlendEnable` vara FALSE?
- [x] Direct3D ignorerar `RenderTarget[1]` och blendar även revealage-målet med `RenderTarget[0]`:s ONE / ONE – 1 + α klämps till 1 i 8-bitarsmålet, revealage förblir 1, och kompositpasset kastar varje pixel
- [ ] Pipeline state-objektet kan inte skapas, eftersom två render targets kräver oberoende blending
- [ ] Det andra render targetet skrivs inte alls
- [ ] Ingenting: Direct3D märker att de två posterna skiljer sig och använder var och en för sitt eget mål
---
Utan `IndependentBlendEnable` gäller bara `RenderTarget[0]`, för alla mål. Två render targets med samma blending är tillåtet – flaggan behövs bara när de skiljer sig.
```

Gör nu den andra uppgiften, **transparent-pass**: pipeline state-objektet, de två texturerna med sina vyer, barriärerna,
målen och rensningarna i `PopulateCommandList`, och shadern.
:::

Bygg och kör: den gröna och den blå fyrhörningen är **borta**. De ritas – i två mål som ingenting visar ännu. Fönstret
visar bara den röda fyrhörningen mot svart. Nästa pass tar tillbaka dem.

```quiz
Revealage-målet rensas till 1 och blendas med faktorerna ZERO (källa) och ONE_MINUS_SRC_COLOR (mål). Shadern skriver fragmentets alfa. Vad innehåller målet när den gröna och den blå fyrhörningen (båda med alfa 0.5) har ritats över samma pixel?
- [ ] 1.0: källfaktorn ZERO kastar shaderns utdata
- [x] 0.25: varje fragment multiplicerar målet med 1 − 0.5
- [ ] 0.5: bara det sista fragmentet räknas
- [ ] 0.0: alfavärdena summeras till 1
---
Blendingen räknar ut src · 0 + dst · (1 − src). Källfärgen kommer bara in via målfaktorn – så multiplicerar den fasta blendingen målet med (1 − α), i vilken ordning som helst.
```

## Kompositpasset

Kompositpasset gör om de två målen till en färg och blendar den över den ogenomskinliga bilden. Det ritar en fyrhörning
över hela skärmen i det ogenomskinliga målet med vanlig alfablending (`SRC_ALPHA, ONE_MINUS_SRC_ALPHA`), och djuptestet
får inte förkasta den – learnopengl sätter `glDepthFunc(GL_ALWAYS)`. Shadern, learnopengls `composite.fs`, steg för steg:

1. Läs revealage och ackumuleringen **för samma pixel**. Målen har fönstrets storlek, så shadern läser texeln
   `ivec2(gl_FragCoord.xy)` direkt – `texelFetch`, ingen filtrering, inga texturkoordinater behövs.
2. Om revealage är 1 har inget genomskinligt fragment rört pixeln: `discard`, vilket sparar blendingen och den andra
   läsningen.
3. Om den ackumulerade färgen har flödat över till oändligheten – en 16-bitars float slutar vid 65504, och med vikter upp
   till 3000 räcker några dussin fragment – ersätt den med den ackumulerade alfan, så att medelvärdet förblir ändligt.
4. Dividera den ackumulerade färgen med den ackumulerade alfan (minst ett litet epsilon, mot division med noll): den
   viktade medelfärgen.
5. Skriv ut medelvärdet med alfa `1 − revealage`: blendingen lägger det över den ogenomskinliga färgen med exakt de vikter
   som McGuires och Bavoils formel anger.

:::opengl
```glsl
// color accumulation buffer
layout (binding = 0) uniform sampler2D accum;

// revealage threshold buffer
layout (binding = 1) uniform sampler2D reveal;

// epsilon number
const float EPSILON = 0.00001f;

// calculate floating point numbers equality accurately
bool isApproximatelyEqual(float a, float b)
{
    return abs(a - b) <= (abs(a) < abs(b) ? abs(b) : abs(a)) * EPSILON;
}

// get the max value between three values
float max3(vec3 v)
{
    return max(max(v.x, v.y), v.z);
}

void main()
{
    // fragment coordination
    ivec2 coords = ivec2(gl_FragCoord.xy);

    // fragment revealage
    float revealage = texelFetch(reveal, coords, 0).r;

    // save the blending and color texture fetch cost if there is not a transparent fragment
    if (isApproximatelyEqual(revealage, 1.0f))
        discard;

    // fragment color
    vec4 accumulation = texelFetch(accum, coords, 0);

    // suppress overflow
    if (isinf(max3(abs(accumulation.rgb))))
        accumulation.rgb = vec3(accumulation.a);

    // prevent floating point precision bug
    vec3 average_color = accumulation.rgb / max(accumulation.a, EPSILON);

    // blend pixels
    frag = vec4(average_color, 1.0f - revealage);
}
```

`layout (binding = 0)` sätter samplerns texturenhet i själva shadern – skälet till 4.2-kontexten. I renderingsloopen
ligger kompositpasset mellan det genomskinliga passet och det sista passet:

```cpp
        // set render states
        glDepthFunc(GL_ALWAYS);
        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

        // bind opaque framebuffer
        glBindFramebuffer(GL_FRAMEBUFFER, opaqueFBO);

        // use composite shader
        compositeShader.use();

        // draw screen quad
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, accumTexture);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, revealTexture);
        glBindVertexArray(quadVAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);
```

`glBlendFunc` (utan `i`) sätter återigen samma funktion för alla draw buffers; den ogenomskinliga framebuffern har bara
en. Djuptestet är fortfarande påslaget sedan det solida passet, och djupskrivningen fortfarande avstängd sedan det
genomskinliga – med `GL_ALWAYS` klarar fyrhörningen testet överallt och lämnar djupbuffern orörd.

Gör nu den sista uppgiften, **composite**: shaderobjektet, passet i renderingsloopen, och `composite.fs`.
:::
:::vulkan
`composite.frag` är learnopengls shader med Vulkans bindningssyntax, som är densamma som i GLSL 4.2:

```glsl
// color accumulation buffer
layout(binding = 0) uniform sampler2D accum;

// revealage threshold buffer
layout(binding = 1) uniform sampler2D reveal;
```

följt av `EPSILON`, `isApproximatelyEqual`, `max3` och en `main` med stegen ovan – `texelFetch(reveal, coords, 0)` vid
`ivec2(gl_FragCoord.xy)`, `discard`, `isinf`-skyddet, `average_color` och `frag = vec4(average_color, 1.0 - revealage)`.

Passet ritar i den ogenomskinliga färgbilden igen, efter det genomskinliga passet. I Vulkan blir det ett tredje render
pass, `compositeRenderPass`, med ett attachment: den ogenomskinliga färgbilden, **inläst** (den innehåller den röda
fyrhörningen) och lämnad i `SHADER_READ_ONLY_OPTIMAL` åt det sista passet:

```cpp
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_LOAD; // keep the solid objects: the composite blends over them
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL; // as the solid pass left it
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
```

Eftersom kompositpasset nu använder bilden som attachment igen måste det ogenomskinliga render passet lämna den i
`COLOR_ATTACHMENT_OPTIMAL` i stället för `SHADER_READ_ONLY_OPTIMAL` – ändra dess `finalLayout`. Kompositpassets första
beroende väntar in det solida passets färgskrivningar innan blendingen läser dem (`COLOR_ATTACHMENT_READ`), det andra får
det sista passets shader att vänta in kompositpassets skrivningar. learnopengls `glDepthFunc(GL_ALWAYS)` blir helt enkelt
*inget djuptest*: kompositpassets render pass har inget djup-attachment alls, och dess framebuffer,
`compositeFramebuffer`, bara `opaqueImageView`. Pipelinen:

```cpp
        // composite pass: no depth test (learnopengl: GL_ALWAYS), the usual alpha blending over the opaque image
        createPipeline("shaders/composite.vert.spv", "shaders/composite.frag.spv", compositeRenderPass, 1, VK_FALSE, VK_FALSE, VK_TRUE,
            VK_BLEND_FACTOR_SRC_ALPHA, VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ZERO, compositePipeline);
```

och `createDescriptorSet(accumImageView, revealImageView, compositeDescriptorSet)` – accum på bindning 0, reveal på
bindning 1. I `recordCommandBuffer()`, mellan det genomskinliga passet och det sista passet:

```cpp
        compositePassInfo.clearValueCount = 0; // loadOp LOAD: nothing to clear

        vkCmdBeginRenderPass(commandBuffer, &compositePassInfo, VK_SUBPASS_CONTENTS_INLINE);

        // use composite shader
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, compositePipeline);

        // draw screen quad (accum at binding 0, reveal at binding 1)
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &compositeDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 0, 0);

        vkCmdEndRenderPass(commandBuffer); // the opaque image is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL
```

Gör nu den sista uppgiften, **composite**: render passet och framebuffern, det ogenomskinliga passets nya slutlayout,
pipelinen och descriptor setet, passet i `recordCommandBuffer()`, `composite.frag`, och städningen.
:::
:::d3d12
Pixel shadern i `composite.hlsl` är learnopengls med HLSL:s namn. `texelFetch(tex, coords, 0)` är `Texture2D.Load`, som
tar texelns kolumn och rad och mip-nivån i en enda `int3`, och `gl_FragCoord.xy` är `SV_POSITION.xy`:

```hlsl
// color accumulation buffer: register t0, the first SRV of root parameter 1's table
Texture2D accum : register(t0);

// revealage threshold buffer: register t1, the second SRV
Texture2D reveal : register(t1);

// epsilon number
static const float EPSILON = 0.00001f;

// calculate floating point numbers equality accurately
bool isApproximatelyEqual(float a, float b)
{
    return abs(a - b) <= (abs(a) < abs(b) ? abs(b) : abs(a)) * EPSILON;
}

// get the max value between three values
float max3(float3 v)
{
    return max(max(v.x, v.y), v.z);
}

// The pixel shader: the average colour of the transparent fragments, with alpha = how much
// of what is behind them they cover.
float4 PSMain(PSInput input) : SV_TARGET
{
    // fragment coordination: the pixel's column and row (SV_POSITION's x and y)
    int2 coords = int2(input.position.xy);

    // fragment revealage: Load reads one texel without filtering (learnopengl's texelFetch)
    float revealage = reveal.Load(int3(coords, 0)).r;

    // save the blending and color texture fetch cost if there is not a transparent fragment
    if (isApproximatelyEqual(revealage, 1.0f))
        discard;

    // fragment color
    float4 accumulation = accum.Load(int3(coords, 0));

    // suppress overflow
    if (isinf(max3(abs(accumulation.rgb))))
        accumulation.rgb = accumulation.aaa;

    // prevent floating point precision bug
    float3 average_color = accumulation.rgb / max(accumulation.a, EPSILON);

    // blend pixels
    return float4(average_color, 1.0f - revealage);
}
```

Pipeline state-objektet: djupfunktionen `D3D12_COMPARISON_FUNC_ALWAYS` (learnopengls `glDepthFunc(GL_ALWAYS)`;
djupskrivningen är fortfarande av sedan det genomskinliga), ett mål i den ogenomskinliga texturens format,
`RTVFormats[1] = DXGI_FORMAT_UNKNOWN` igen, och en ny blendbeskrivning med vanlig alfablending i `RenderTarget[0]`:

```cpp
        psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_ALWAYS;
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_UNKNOWN;
        psoDesc.BlendState = CD3DX12_BLEND_DESC(D3D12_DEFAULT);
        psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;
        psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_INV_SRC_ALPHA;
```

I `PopulateCommandList`, efter det genomskinliga passets barriärer, binds den ogenomskinliga texturen igen (med
djupbuffern, som testet ignorerar), och root-parameter 1:s descriptor table börjar på plats 1 i SRV-heapen, så att t0 är
ackumuleringstexturen och t1 revealage-texturen:

```cpp
    // bind the opaque texture again (with the depth buffer: the depth test always passes)
    m_commandList->OMSetRenderTargets(1, &opaqueRtvHandle, FALSE, &dsvHandle);

    // use composite pipeline state, with accum (t0) and reveal (t1): root parameter 1's
    // table starts at SRV heap slot 1
    m_commandList->SetPipelineState(m_compositePipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE accumAndReveal(m_srvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_srvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(1, accumAndReveal);

    // draw screen quad
    m_commandList->DrawInstanced(6, 1, 0, 0);
```

Det sista passets tabell började på plats 0 (t0 = den ogenomskinliga texturen): samma tabell med två SRV:er, läst från ett
annat ställe i heapen.

Gör nu den sista uppgiften, **composite**: pipeline state-objektet, passet i `PopulateCommandList`, och `composite.hlsl`.
:::

Bygg och kör. De genomskinliga fyrhörningarna är tillbaka, och den blå fyrhörningens nedre vänstra hörn syns nu genom den
gröna. Där de två överlappar (runt (230, 300)) är pixeln (0, 96, 96): båda fyrhörningarna räknas. Vi kontrollerar: båda
vikterna är 3000 här (frågan nedan förklarar varför), så varje fyrhörning adderar `(C · 0.5, 0.5) · 3000` till
ackumuleringen – summan blir `(0, 1500, 1500, 3000)` och medelvärdet `(0, 0.5, 0.5)`. Revealage är `0.5 · 0.5 = 0.25`,
alfa `0.75`, och över svart blir det `(0, 0.375, 0.375)` – 96 av 255. Överallt annars är bilden den som sorterad blending
skulle ge: grönt över den röda fyrhörningen, grönt och blått över bakgrunden, och den blå fyrhörningen fortfarande dold
bakom den röda (det delade djupet). Och det spelar inte längre någon roll i vilken ordning den gröna och den blå ritas –
byt plats på de två draw-anropen så förblir bilden densamma.

```quiz
I överlappet blir resultatet (0, 96, 96), medan rätt sorterad blending (först den blå, sedan den närmare gröna) skulle ge (0, 128, 64). Varför ger weighted blended OIT de två fyrhörningarna lika stor andel här?
- [x] Deras vikter är lika: båda djupen ligger nära 1, så djupfaktorn gör båda vikterna större än 3000 och `clamp` kapar dem till 3000
- [ ] Viktfunktionen bryr sig inte om djupet
- [ ] Revealage-målet har bara 8 bitar
- [ ] Kompositpasset dividerar med antalet fragment i stället för med summan av vikterna
---
Med near = 0.1 och far = 100 har en fyrhörning 3 till 5 enheter bort ett fönsterdjup på ungefär 0.97–0.98, och 1e8 · (1 − 0.9z)³ är fortfarande över 100 000 – långt över gränsen. Med lika vikter ger medelvärdet lagren lika stora andelar, där sorterad blending skulle låta det närmare gröna lagret dominera. Det är approximationen.
```

## Vad den gör fel

Weighted blended OIT byter exakthet mot fart, och det är bra att veta var det märks:

- **Det närmaste lagret dominerar inte så mycket som det borde.** Medelvärdet ersätter skymningen mellan genomskinliga
  lager. Viktfunktionen ger närmare lager större vikt, men bara i förhållande till varandra, och bara i det djupintervall
  den är inställd för – som överlappet ovan visar, där `clamp` får två fyrhörningar på olika djup att räknas lika.
  McGuire och Bavoil ger flera viktfunktioner för olika djupintervall; en scen behöver oftast en egen.
- **Nästan ogenomskinliga lager.** Ett lager med alfa 0.9 framför ett annat borde dölja det nästan helt. I medelvärdet
  bidrar det bakre fortfarande med sin viktade andel av färgen – resultatet ser urtvättat ut.
- **Många överlappande lager.** Summorna växer, och 16-bitarsflyttalen tappar precision eller flödar över (`isinf`-skyddet).
  Vikternas intervall är en kompromiss mellan de två.
- **Ingen refraktion, ingen färgad transmission.** Varje lager täcker bakgrunden med sin alfa, lika för alla färger. Ett
  rött glas som bara släpper igenom rött ljus, eller en lins som bryter det som ligger bakom, kräver andra tekniker;
  artikelns författare utvidgade senare metoden till färgad transmission och diffusion.
- **Ordningen spelar fortfarande roll på andra ställen.** Ogenomskinliga objekt måste ritas först, och genomskinliga
  fragment bakom dem förkastas av djuptestet, som förut. Det är bara ordningen *mellan* de genomskinliga objekten som
  slutar spela roll.

Det du får tillbaka: ett geometripass, ingen sortering, en fast mängd minne (två mål i skärmstorlek) och ett pass över
hela skärmen – och rätt resultat överallt där bara ett genomskinligt lager täcker en pixel, och trovärdiga där flera gör
det. För partiklar, lövverk och glas i ett spel är det ofta den bästa kompromiss som finns.

## Mer att läsa

- [OIT: Weighted Blended](https://learnopengl.com/Guest-Articles/2020/OIT/Weighted-Blended): learnopengls gästartikel som
  det här kapitlet följer. Den länkar till McGuires och Bavoils artikel, som förklarar viktfunktionerna och deras
  djupintervall.

:::opengl
- [weighted_blended.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2020/oit/weighted_blended.cpp):
  learnopengls program, med de tre fyrhörningarna ovanpå varandra.
- [glBlendFunc](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendFunc.xhtml): `glBlendFunc` och
  `glBlendFunci`, blendfunktionen per draw buffer.
- [glClearBuffer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glClearBuffer.xhtml): att rensa en draw buffer
  till ett eget värde.
:::
:::vulkan
- [VkPipelineColorBlendAttachmentState](https://registry.khronos.org/vulkan/specs/latest/man/html/VkPipelineColorBlendAttachmentState.html):
  blendtillståndet per färg-attachment, och regeln att de måste vara identiska utan `independentBlend`.
- [Render passes](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Render_passes):
  vulkan-tutorial om attachments, load- och store-operationer och subpasses.
:::
:::d3d12
- [D3D12_BLEND_DESC](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_blend_desc):
  `IndependentBlendEnable` och arrayen `RenderTarget`.
- [Load (DirectX HLSL Texture Object)](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-to-load):
  att läsa en texel utan sampler.
:::
