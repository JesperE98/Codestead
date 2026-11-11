# HDR

Ljusstyrka och färgvärden kläms som standard till intervallet 0.0 till 1.0 när de lagras i en framebuffer. Det här till
synes oskyldiga påståendet har fått oss att alltid ange ljus- och färgvärden någonstans i det intervallet och försöka få
dem att passa in i scenen. Det fungerar hyggligt och ger godtagbara resultat, men vad händer om vi går in i ett riktigt
ljust område med flera starka ljuskällor vars sammanlagda bidrag överstiger 1.0? Svaret är att alla fragment med en
ljusstyrka eller färgsumma över 1.0 kläms till 1.0, och det är inte vackert att se på: en stor del av bilden blir en
platt vit (eller platt gul, eller platt röd) yta, och varje detalj i den går förlorad.

Eftersom många fragments färgvärden kläms till 1.0 får alla ljusa fragment exakt samma vita färgvärde i stora områden.
Mycket detaljer försvinner och bilden ser falsk ut. En lösning vore att sänka ljuskällornas styrka och se till att inget
område i scenen blir ljusare än 1.0. Det är ingen bra lösning, eftersom den tvingar oss att använda orealistiska
belysningsparametrar. Ett bättre sätt är att låta färgvärdena tillfälligt överstiga 1.0 och som ett sista steg
omvandla dem tillbaka till det ursprungliga intervallet 0.0 till 1.0, utan att detaljer går förlorade.

Bildskärmar (andra än HDR-skärmar) kan bara visa färger i intervallet 0.0 till 1.0, men någon sådan gräns finns inte i
belysningsekvationerna. Genom att låta fragmentens färger överstiga 1.0 får vi ett mycket större omfång av färgvärden att
arbeta med, ett så kallat *högt dynamiskt omfång* (high dynamic range, HDR). Med högt dynamiskt omfång kan ljusa saker
vara riktigt ljusa, mörka saker riktigt mörka, och detaljer synas i båda.

Högt dynamiskt omfång användes ursprungligen bara inom fotografi, där fotografen tar flera bilder av samma motiv med
olika exponering och på så sätt fångar ett stort omfång av färgvärden. Tillsammans bildar de en HDR-bild där ett stort
omfång av detaljer syns, beroende på de kombinerade exponeringarna eller på den exponering bilden visas med. Det är också
så våra ögon fungerar, och grunden för HDR-rendering: när det är lite ljus anpassar sig ögat så att de mörkare delarna
syns bättre, och på motsvarande sätt för ljusa områden. Det är som om ögat hade ett automatiskt exponeringsreglage som
styrs av scenens ljusstyrka.

HDR-rendering fungerar ungefär så. Vi tillåter ett mycket större omfång av färgvärden att rendera till och samlar på så
sätt ett stort omfång av mörka och ljusa detaljer i scenen, och till sist omvandlar vi alla HDR-värden tillbaka till det
*låga dynamiska omfånget* (low dynamic range, LDR) 0.0 till 1.0. Den omvandlingen från HDR- till LDR-värden kallas *tone
mapping*, och det finns en stor samling tone mapping-algoritmer som försöker bevara så mycket som möjligt av
HDR-detaljerna under omvandlingen. De har ofta en exponeringsparameter som väljer att gynna mörka eller ljusa områden.

För realtidsrendering innebär högt dynamiskt omfång inte bara att vi kan gå utanför LDR-intervallet [0.0, 1.0] och bevara
fler detaljer, utan också att vi kan ange en ljuskällas intensitet efter dess verkliga intensitet. Solen har till
exempel en mycket högre intensitet än något som en ficklampa, så varför inte ställa in solen därefter (en diffus
ljusstyrka på 100.0, säg)? Det låter oss ställa in en scens belysning med mer realistiska parametrar, något som inte vore
möjligt med LDR-rendering, eftersom värdena då direkt skulle klämmas till 1.0.

Tekniken är densamma i alla API:er: rita scenen i en färgbuffer som kan hålla värden över 1.0, och rita sedan den buffern
på fönstret med en shader som tone mappar den. Den andra halvan har du byggt förut – kapitlet *Framebuffers* med sitt
off-screen-mål och sin skärmfyrhörning. Det nya är färgbufferns format och vad skärmfyrhörningens shader gör med den.

Projektet är learnopengls HDR-scen: en lång tunnel av trä – kuben på 2 × 2 × 2 skalad med (2.5, 2.5, 27.5) och flyttad
till z = 25, så att den går från z = -2.5 till z = 52.5 och är 5 enheter bred och hög – belyst av fyra punktljus. Tre av
dem är svaga och färgade och hänger nära kameran: (-1.4, -1.9, 9) rött med styrkan 0.1, (0, -1.8, 4) blått med 0.2,
(0.8, -1.7, 6) grönt med 0.1. Det fjärde, på (0, 0, 49.5), 3 enheter framför tunnelns bortre ände, är vitt med styrkan
**200** – långt mer än vad en 8-bitarsfärg kan hålla. Kameran står inne i tunneln på (0, 0, 5). Vi ser kuben inifrån, så
dess normaler vänds i vertex shadern (`inverse_normals` – rummet i kapitlet *Punktskuggor* gjorde samma sak med
`reverse_normals`), och face culling är avstängt. Trätexturen läses som en sRGB-textur, som i kapitlet
*Gammakorrigering*.

Belysningen är learnopengls: inget omgivningsljus, bara diffust ljus, kvadratisk dämpning `1.0 / (distance * distance)`
(den rätta när belysningen sker i linjärt rum), ingen spekulär reflex. Två val skiljer sig från learnopengls program:

- **Kameran tittar längs +z, in i tunneln** (en yaw på +90°; kamerans framåtvektor är (0, 0, 1)). learnopengls demo
  börjar på samma position, men dess kamera tittar längs -z, på tunnelns närmaste gavel 7.5 enheter bort, som är nästan
  svart; du skulle behöva vända dig om med musen för att se något. Här ligger tunneln och dess ljusa ände rakt fram.
- **Fyra ljus, inte sexton.** learnopengls shader deklarerar `Light lights[16]` och sätter fyra; de andra tolv är noll
  och bidrar inte med något. Kursen deklarerar exakt fyra, så att de explicita API:erna kan lägga exakt fyra ljus i sin
  uniform- (constant-) buffer.

:::opengl
`main.cpp` ritar tunneln med `lighting.vs` / `lighting.fs`, direkt i fönstret; `lighting.fs` slutar som i kapitlet
*Gammakorrigering* och gammakorrigerar själv sitt resultat:

```glsl
    const float gamma = 2.2;
    FragColor = vec4(pow(ambient + lighting, vec3(1.0 / gamma)), 1.0);
```

Ljusen är uniformerna `lights[i].Position` och `lights[i].Color`, som sätts i en loop över två
`std::vector<glm::vec3>`. Två shaderfiler till finns för den andra halvan: `hdr.vs`, som är klar (skärmfyrhörningen:
positionerna redan i normaliserade enhetskoordinater, inga matriser), och `hdr.fs`, vars `main` fortfarande är en TODO.
learnopengls `renderQuad()` finns också i `main.cpp`, oanvänd än så länge.
:::
:::vulkan
`recordCommandBuffer()` ritar tunneln – vertex 0..35 i den enda vertexbuffern – i fönstrets render pass med
`shaders/lighting.vert` / `.frag`. Modellmatrisen och `inverse_normals` är push constants (`struct PushConstants {
glm::mat4 model; VkBool32 inverse_normals; }` – en GLSL-`bool` i ett block är 4 byte); vy, projektion, ljusen och
`viewPos` ligger i uniformbuffern:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec4 lightPositions[4];
    glm::vec4 lightColors[4];
    glm::vec3 viewPos;
    float pad1;
};
```

std140 lägger elementen i en array 16 byte isär, så positionerna och färgerna är `vec4`:or där shadern bara använder
`xyz` – samma regel som för ljusarrayerna i kapitlet *Gammakorrigering*. `updateUniformBuffer()` kopierar de globala
`lightPositions` och `lightColors` till dem i en `for`-loop. `lighting.frag` gammakorrigerar själv sitt resultat, som i
kapitlet *Gammakorrigering*:

```glsl
    vec3 result = pow(ambient + lighting, vec3(1.0 / 2.2));
    outColor = vec4(result, 1.0);
```

Två shaders till finns för den andra halvan: `shaders/hdr.vert`, som är klar (skärmfyrhörningen: positionerna redan i
normaliserade enhetskoordinater, inga matriser), och `shaders/hdr.frag`, vars `main` fortfarande är en TODO.
`createPipeline(vertFile, fragFile, pipelineRenderPass, pipeline)` tar den render pass som pipelinen görs för – det
kommer du att behöva.
:::
:::d3d12
`PopulateCommandList` ritar tunneln – vertex 0–35 i den enda vertexbuffern – i back buffern med djupbuffern, med
shaderna i `lighting.hlsl`. Modellmatrisen, normalmatrisen och `BOOL inverseNormals` är 33 root constants
(`cbuffer ModelConstants : register(b0)`); vy, projektion, ljusen och `viewPos` ligger i constant buffern (b1):

```cpp
    struct Light
    {
        XMFLOAT3 Position;
        float padding0;
        XMFLOAT3 Color;
        float padding1;
    };
```

Varje element i en array börjar en ny rad på 16 byte i en constant buffer, och en `float3` korsar aldrig en radgräns, så
`Color` börjar den andra raden och varje `float3` följs av en float utfyllnad. `OnUpdate` kopierar de globala
`lightPositions[]` och `lightColors[]` till `constantBufferData.lights[i]` i en `for`-loop. `PSMain` i `lighting.hlsl`
gammakorrigerar själv sitt resultat, som i kapitlet *Gammakorrigering*:

```hlsl
    const float gamma = 2.2f;
    float3 result = pow(ambient + lighting, 1.0f / gamma);
    return float4(result, 1.0f);
```

En andra shaderfil, `hdr.hlsl`, finns för den andra halvan: dess `VSMain` är klar (skärmfyrhörningen: positionerna redan
i normaliserade enhetskoordinater, inga matriser), dess `PSMain` returnerar fortfarande svart – den kompileras inte
förrän du behöver den.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Bygg och kör programmet i din IDE: du tittar längs
tunneln, vars brädor löper mot en liten kvadrat mitt i fönstret – den bortre änden. Nära kameran är väggarna mycket
mörka (bara en svag röd ton i nedre högra hörnet, från det röda ljuset); mot änden blir de ljusare. Och själva änden är
**platt vit**: ljuset med styrkan 200 gör färgen där långt ljusare än 1.0, fönstret lagrar 0.0 till 1.0 per kanal, och
allt däröver kapas vid 1.0. Träets brädor är borta från den kvadraten – bara längs dess kanter, där träets blå kanal
fortfarande är under 1.0, finns lite gult kvar.

```quiz
Belysningsshadern räknar fram färgen (3.5, 2.4, 1.2) för ett fragment vid tunnelns ände och skriver den i fönstret, vars färgbuffer har 8 bitar per kanal. Vad lagras?
- [ ] (3.5, 2.4, 1.2): färgbuffern lagrar det shadern skriver
- [x] (1.0, 1.0, 1.0): varje kanal kläms till 1.0 – färgen blir vit, och grannfragmentet, med (3.1, 2.2, 1.1), blir exakt samma vita
- [ ] (1.0, 0.69, 0.34): färgen skalas så att dess största kanal blir 1.0
- [ ] (0.5, 0.34, 0.17): värden över 1.0 slår runt
---
En normaliserad 8-bitarskanal lagrar 0 till 255 för 0.0 till 1.0, och omvandlingen klämmer. Varje fragment som är ljusare än 1.0 i alla kanaler blir samma vita – det är de förlorade detaljerna.
```

## Flyttals-framebuffers

För att implementera HDR-rendering behöver vi ett sätt att hindra att färgvärdena kläms efter varje körning av fragment
shadern. När en framebuffers färgbuffer använder ett flyttalsformat kan den lagra flyttal utanför standardintervallet 0.0
till 1.0. Det är perfekt för rendering med högt dynamiskt omfång!

Fönstrets färgbuffer använder 8 bitar per färgkomponent, normaliserat: 256 steg mellan 0.0 och 1.0. En flyttalsbuffer
med 32 bitar per komponent (en vanlig `float`) kunde lagra vilket värde vi vill, men tar fyra gånger så mycket minne. 16
bitar per komponent – ett flyttal med *halv precision* – räcker oftast: det lagrar värden upp till 65504 med ungefär tre
värdesiffror, vilket är gott och väl för färger. Alla tre API:er har formatet: fyra 16-bitars flyttal per texel, rött,
grönt, blått och alfa.

| | OpenGL | Vulkan | Direct3D 12 |
|---|---|---|---|
| fönstret, 8 bitar | default framebuffern | swap chain-bilden `VK_FORMAT_B8G8R8A8_UNORM` | back buffern `DXGI_FORMAT_R8G8B8A8_UNORM` |
| flyttal | `GL_RGBA16F` | `VK_FORMAT_R16G16B16A16_SFLOAT` | `DXGI_FORMAT_R16G16B16A16_FLOAT` |

learnopengls program använder `GL_RGBA16F`; texten nämner också `GL_RGB16F`. Trekanalsvarianten är ett sämre val utanför
OpenGL: Vulkan kräver inte att enheter kan rendera till `VK_FORMAT_R16G16B16_SFLOAT`, och DXGI har inget 48-bitarsformat
alls – fyra kanaler är vad alla tre API:er kan lita på.

Planen är densamma som i kapitlet *Framebuffers*, i två pass: först renderar vi den belysta scenen i flyttalsfärgbuffern,
och sedan visar vi den färgbuffern på en fyrhörning som fyller skärmen. Belysningsshadern skriver nu sitt resultat
oförändrat – linjärt och oklippt – och skärmfyrhörningens shader läser tillbaka det som en textur. Eftersom texturen
håller flyttal överlever värdena över 1.0 resan.

Och gammakorrigeringen? Tone mapping – nästa avsnitt – arbetar med linjära färger, precis som belysningen; gammakorrigeringen
måste komma efter den, som allra sista steg innan färgen hamnar i fönstret. Så `pow(…, 1.0 / 2.2)` flyttar från
belysningsshadern till skärmfyrhörningens shader. Inget annat i belysningen ändras.

:::opengl
Framebuffern med sin flyttalsfärgbuffer är learnopengls kod – den från kapitlet *Framebuffers*, med `GL_RGBA16F` som
färgtexturens interna format:

```cpp
    // configure floating point framebuffer
    // ------------------------------------
    unsigned int hdrFBO;
    glGenFramebuffers(1, &hdrFBO);
    // create floating point color buffer
    unsigned int colorBuffer;
    glGenTextures(1, &colorBuffer);
    glBindTexture(GL_TEXTURE_2D, colorBuffer);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // create depth buffer (renderbuffer)
    unsigned int rboDepth;
    glGenRenderbuffers(1, &rboDepth);
    glBindRenderbuffer(GL_RENDERBUFFER, rboDepth);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT, SCR_WIDTH, SCR_HEIGHT);
    // attach buffers
    glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, colorBuffer, 0);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, rboDepth);
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "Framebuffer not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Det tredje argumentet till `glTexImage2D`, det interna formatet, är det som gör skillnaden: `GL_RGBA16F` lagrar flyttal
med halv precision. De tre sista beskriver datan vi laddar upp – ingen (`NULL`), så `GL_RGBA` / `GL_FLOAT` behöver bara
vara en giltig kombination. Tunneln behöver också en djupbuffer medan den ritas i den här framebuffern: renderbuffern.

Renderloopen får learnopengls två pass runt koden som ritar tunneln. Före den:

```cpp
        // 1. render scene into floating point framebuffer
        // -----------------------------------------------
        glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
```

och efter `renderCube()`:

```cpp
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // 2. now render floating point color buffer to 2D quad and tonemap HDR colors to default framebuffer's (clamped) color range
        // --------------------------------------------------------------------------------------------------------------------------
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        hdrShader.use();
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, colorBuffer);
        renderQuad();
```

med `Shader hdrShader("hdr.vs", "hdr.fs");` bredvid den andra shadern och `hdrShader.setInt("hdrBuffer", 0);` i
shaderkonfigurationen. `lighting.fs` slutar nu med

```glsl
    FragColor = vec4(ambient + lighting, 1.0); // linear and unclipped: the floating point buffer keeps values above 1.0
```

och `hdr.fs` läser flyttalsfärgbuffern och gammakorrigerar bara – ingen tone mapping än:

```glsl
void main()
{
    const float gamma = 2.2;
    vec3 hdrColor = texture(hdrBuffer, TexCoords).rgb;
    // no tone mapping yet: only gamma correction (values above 1.0 are still clipped by the window)
    vec3 result = pow(hdrColor, vec3(1.0 / gamma));
    FragColor = vec4(result, 1.0);
}
```

Gör nu den första uppgiften, **float-buffer**, och ta bort `colorBuffer`, `rboDepth` och `hdrFBO` i slutet.
:::
:::vulkan
I Vulkan är flyttals-framebuffern tre objekt du känner från kapitlet *Framebuffers*: en render pass som beskriver
attachments, bilderna (med sina views och sitt minne) och en `VkFramebuffer` som sätter ihop views för render passen. Den
nya render passen, `createHdrRenderPass()`, är en kopia av `createRenderPass()` med en annan färg-attachment:

```cpp
        VkAttachmentDescription colorAttachment{};
        colorAttachment.format = VK_FORMAT_R16G16B16A16_SFLOAT; // 16-bit floats: values above 1.0 are kept
        colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE; // keep the picture: the screen quad reads it
        colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        colorAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass
```

Formatet är flyttalsformatet; bilden presenteras inte utan samplas efteråt, så render passen lämnar den i
`VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` i stället för `PRESENT_SRC_KHR`. Djup-attachmenten är den från
`createRenderPass()` (`findDepthFormat()`, attachment 1). Två subpass dependencies ordnar passet i förhållande till det
som läser bilden: före passet väntar vi tills förra bildrutans skärmfyrhörning har läst färdigt bilden (och dess
djupskrivningar är klara); efter passet görs färgskrivningarna synliga för de fragment shaders som samplar bilden:

```cpp
        // after the pass: the fragment shaders that sample the image wait until the scene has been written
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
```

`createHdrFramebuffer()` skapar färgbilden – fönstrets storlek, flyttalsformatet, användbar som färg-attachment **och**
som samplad bild –, en egen djupbild, deras views och framebuffern:

```cpp
        createImage(swapChainExtent.width, swapChainExtent.height, VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, hdrColorImage, hdrColorImageMemory);
        hdrColorImageView = createImageView(hdrColorImage, VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_ASPECT_COLOR_BIT);
```

följt av djupbilden (`hdrDepthImage`, `findDepthFormat()`, `VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT`) och
`vkCreateFramebuffer` med `hdrRenderPass` och de två views. Du behöver inte fråga om enheten stöder formatet: varje
Vulkan-enhet måste kunna rendera till `VK_FORMAT_R16G16B16A16_SFLOAT`-bilder och sampla dem med linjärt filter.

En pipeline skapas för en viss render pass och kan bara användas i render passes som är kompatibla med den – samma antal
attachments med samma format. Scenens pipeline ritar nu i flyttalsbilden, skärmfyrhörningens i fönstret:

```cpp
        // a pipeline is made for one render pass: the scene's pipeline for the floating point target's
        createPipeline("shaders/lighting.vert.spv", "shaders/lighting.frag.spv", hdrRenderPass, graphicsPipeline);
        // the screen quad's pipeline for the window's render pass
        createPipeline("shaders/hdr.vert.spv", "shaders/hdr.frag.spv", renderPass, hdrPipeline);
```

Skärmfyrhörningen är learnopengls `quadVertices` som sex vertex (två trianglar) efter kuben, 36..41, med
texturkoordinaterna oförändrade: i OpenGL pekar både fönstrets y och en bilds v uppåt, i Vulkan pekar båda nedåt – de två
vändningarna tar ut varandra, och bilden blir rättvänd. Dess descriptor set, `hdrDescriptorSet`, är
`createDescriptorSet(hdrColorImageView, textureSampler, hdrDescriptorSet)` – uniformbuffern på binding 0 och
flyttalsbilden på binding 1, i `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` som render passen lämnar den. Poolen delar nu ut
två set (två uniformbuffer-descriptors, två combined image samplers, `maxSets = 2`).

`recordCommandBuffer()` spelar in två render passes. Den första, med `hdrRenderPass` och `hdrFramebuffer`, ritar tunneln
precis som förut; den andra, fönstrets, ritar skärmfyrhörningen:

```cpp
        vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        // the screen quad with the floating point image as its texture (the viewport, scissor and vertex buffer set
        // above still apply)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, hdrPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &hdrDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // the screen quad's 6 vertices start at vertex 36

        vkCmdEndRenderPass(commandBuffer);
```

`lighting.frag` slutar nu med

```glsl
    // into the floating point target: values above 1.0 are kept (the screen quad gamma-corrects)
    outColor = vec4(ambient + lighting, 1.0);
```

och `hdr.frag` läser flyttalsbilden och gammakorrigerar bara – ingen tone mapping än:

```glsl
void main() {
    const float gamma = 2.2;
    vec3 hdrColor = texture(hdrBuffer, fragTexCoord).rgb;
    // no tone mapping yet: only gamma correction - values above 1.0 are still cut off by the window
    vec3 result = pow(hdrColor, vec3(1.0 / gamma));
    outColor = vec4(result, 1.0);
}
```

Gör nu den första uppgiften, **float-buffer**, och förstör den nya framebuffern, dess views, bilder och minne, pipelinen
och render passen i `cleanup()`.
:::
:::d3d12
Flyttalsfärgbuffern är off-screen-render target från kapitlet *Framebuffers* med ett flyttalsformat: en textur i default
heapen som kan vara render target, en render target view för att rita i den och en shader resource view för att läsa
den:

```cpp
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);

        // The colour it is usually cleared to (clearing to this colour is fastest).
        const float optimizedClearColor[] = { 0.1f, 0.1f, 0.1f, 1.0f };
        CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R16G16B16A16_FLOAT, optimizedClearColor);

        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
            &clearValue,
            IID_PPV_ARGS(&m_colorBuffer)));
```

Render target viewn hamnar i RTV-heapen efter swap chainens buffrar (plats `FrameCount`, så heapen behöver
`FrameCount + 1` descriptors), shader resource viewn – `DXGI_FORMAT_R16G16B16A16_FLOAT`, `TEXTURE2D`, en mipnivå – på
plats 2 i CBV/SRV-heapen (som behöver 3). Scenen fortsätter att använda den djupbuffer den har.

Ett pipeline state object kompileras för de format det renderar till, och de måste stämma med det som är bundet när det
ritar. Scenens PSO renderar nu i flyttalsbuffern:

```cpp
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
```

och skärmfyrhörningen får ett eget PSO, `m_hdrPipelineState`, med shaderna i `hdr.hlsl`, back bufferns format och ingen
djupbuffer:

```cpp
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(hdrVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(hdrPixelShader.Get());
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_hdrPipelineState)));
```

Skärmfyrhörningen är learnopengls `renderQuad()` som sex vertex (två trianglar) efter kuben, 36–41, med v = 0 överst: i
Direct3D är fönstrets överkant y = +1 i normaliserade enhetskoordinater, och en texturs översta rad är v = 0.

`PopulateCommandList` har nu två pass. Det första gör färgbuffern till render target och ritar tunneln i den:

```cpp
    CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_colorBuffer.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    m_commandList->ResourceBarrier(1, &barrier);

    CD3DX12_CPU_DESCRIPTOR_HANDLE hdrRtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &hdrRtvHandle, FALSE, &dsvHandle);
```

(rensad, tunneln ritad som förut). Det andra gör den till shader resource igen, sedan back buffern till render target –
bunden utan djupbuffer –, och ritar skärmfyrhörningen med färgbuffern som textur:

```cpp
    m_commandList->SetPipelineState(m_hdrPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE hdrBuffer(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, hdrBuffer);
    m_commandList->DrawInstanced(6, 1, 36, 0);
```

`lighting.hlsl` returnerar nu färgen som den är:

```hlsl
    // The colour as it is: linear, and far above 1.0 near the bright light. The screen quad
    // tone-maps and gamma-corrects it.
    return float4(ambient + lighting, 1.0f);
```

och `PSMain` i `hdr.hlsl` läser flyttalsbuffern och gammakorrigerar bara – ingen tone mapping än:

```hlsl
    const float gamma = 2.2f;
    float3 hdrColor = hdrBuffer.Sample(wrapSampler, input.texCoord).rgb;
    float3 result = pow(hdrColor, 1.0f / gamma);
    return float4(result, 1.0f);
```

Gör nu den första uppgiften, **float-buffer**.
:::

:::opengl
```quiz
Vad gör att `colorBuffer` kan hålla ljusets färger med styrkan 200?
- [ ] `GL_FLOAT` som typargument till `glTexImage2D`
- [ ] Filtreringen `GL_LINEAR`
- [ ] Att den kopplas in med `glFramebufferTexture2D` i stället för som renderbuffer
- [x] Det interna formatet `GL_RGBA16F`: fyra flyttal med halv precision per texel; `GL_RGBA` / `GL_FLOAT` beskriver bara den (obefintliga) data vi laddar upp
---
Det interna formatet avgör hur texturen lagrar sina texlar. Med `GL_RGBA` som internt format vore den normaliserad med 8 bitar igen, vad typargumentet än säger.
```
:::
:::vulkan
```quiz
Scenens pipeline skapades för fönstrets render pass. Varför måste den nu skapas med `hdrRenderPass`?
- [x] En pipeline kan bara användas i en render pass som är kompatibel med den den gjordes för – samma antal attachments med samma format – och flyttalsfärg-attachmenten har ett annat format än swap chain-bilden
- [ ] `hdrRenderPass` har en djup-attachment och fönstrets har ingen
- [ ] Pipelines kan bara rita i bilder som ska samplas
- [ ] Vertex shadern behöver veta vart dess utdata tar vägen
---
Båda render passes har en färg- och en djup-attachment, men färgformaten skiljer sig: `VK_FORMAT_R16G16B16A16_SFLOAT` mot `VK_FORMAT_B8G8R8A8_UNORM`. Skärmfyrhörningens pipeline görs i sin tur för fönstrets render pass.
```
:::
:::d3d12
```quiz
Varför behöver skärmfyrhörningen ett eget pipeline state object, `m_hdrPipelineState`?
- [ ] Varje PSO kan bara rita ett enda mesh
- [ ] Back buffern kan bara ritas i av det första PSO som skapas
- [x] Ett PSO kompileras för sina shaders och för de format det renderar till: skärmfyrhörningen har andra shaders, renderar i 8-bitars back buffern i stället för flyttalsbuffern och har ingen djupbuffer bunden (`DSVFormat = DXGI_FORMAT_UNKNOWN`, inget djuptest)
- [ ] Root signatures kan inte delas mellan PSO:er
---
`RTVFormats` och `DSVFormat` måste stämma med de views som binds med `OMSetRenderTargets` när PSO:t ritar. Båda PSO:erna delar root signature.
```
:::

Bygg och kör: **ingenting ändras**. Den bortre änden är lika platt vit som förut. Det är väntat: flyttalsbuffern håller
nu de sanna färgerna, 200-ljuset och allt, men skärmfyrhörningens shader skriver dem oförändrade (bara gammakorrigerade)
i 8-bitarsfönstret – där de kläms, precis som förut. Att behålla värdena räcker inte; något måste avbilda dem på 0.0
till 1.0.

## Tone mapping

Tone mapping är processen att omvandla flyttalsfärger till det förväntade intervallet [0.0, 1.0], kallat lågt dynamiskt
omfång, utan att förlora alltför många detaljer, ofta tillsammans med en viss stilistisk färgbalans.

En av de enklare tone mapping-algoritmerna är *Reinhard tone mapping*, som delar hela HDR-färgen med sig själv plus ett:

```text
mapped = hdrColor / (hdrColor + 1.0)
```

Den avbildar 0 på 0, 1 på 0.5, 3 på 0.75, 200 på 0.995 – varje värde från 0 till oändligheten hamnar någonstans under
1.0, och ordningen bevaras: en ljusare färg förblir ljusare. Och små värden ändrar den nästan inte alls, eftersom
x / (x + 1) ≈ x när x är litet. Kurvan fördelar alla ljusa värden jämnt över LDR.

:::opengl
I `hdr.fs` arbetar gammakorrigeringen nu med den tone mappade färgen:

```glsl
    // reinhard tone mapping
    vec3 result = hdrColor / (hdrColor + vec3(1.0));
    // also gamma correct while we're at it
    result = pow(result, vec3(1.0 / gamma));
```
:::
:::vulkan
I `hdr.frag` arbetar gammakorrigeringen nu med den tone mappade färgen:

```glsl
    // reinhard tone mapping: 0..infinity -> 0..1
    vec3 result = hdrColor / (hdrColor + vec3(1.0));
    // also gamma correct while we're at it
    result = pow(result, vec3(1.0 / gamma));
```
:::
:::d3d12
I `PSMain` i `hdr.hlsl` arbetar gammakorrigeringen nu med den tone mappade färgen:

```hlsl
    // reinhard
    float3 result = hdrColor / (hdrColor + float3(1.0f, 1.0f, 1.0f));
    // also gamma correct while we're at it
    result = pow(result, 1.0f / gamma);
```
:::

Gör nu uppgiften **reinhard**.

```quiz
Reinhard tone mapping räknar `hdrColor / (hdrColor + 1.0)` per kanal. Vilket påstående stämmer?
- [ ] Den avbildar 1.0 på 1.0, så allt upp till 1.0 förblir som det var
- [ ] Den klämmer värdena över 1.0 mjukare, men värden över 10 blir ändå 1.0
- [ ] Den behöver bildrutans ljusaste värde att dela med
- [x] Varje värde från 0 till oändligheten hamnar under 1.0, ordningen bevaras (200 → 0.995, 3 → 0.75, 1 → 0.5), och små värden ändras knappt (0.05 → 0.048)
---
Inget värde når någonsin 1.0, så inga två olika ljusa färger smälter ihop till samma vita. Priset: värden kring 1.0 blir märkbart mörkare (0.5), och därför vinner de ljusa delarna detaljer medan scenen som helhet blir lite mörkare.
```

Bygg och kör: **den bortre änden visar sitt trä igen** – brädorna är tillbaka i den ljusa kvadraten, varma och
detaljerade, och ingen pixel är rent vit längre. Skenet på väggarna runt den blir lite mörkare; resten av den mörka
tunneln ser likadan ut, eftersom små värden passerar Reinhard nästan oförändrade.

Med Reinhard tone mapping förlorar vi inte längre några detaljer i scenens ljusa områden. Den tenderar dock att gynna
ljusare områden lite, så att mörkare partier verkar mindre detaljerade och tydliga.

### Exponering

En annan intressant användning av tone mapping är att låta en exponeringsparameter styra. Du minns säkert från
inledningen att HDR-bilder innehåller många detaljer som syns vid olika exponeringsnivåer. Har vi en scen med dag och natt
är det rimligt att använda en lägre exponering i dagsljus och en högre på natten, ungefär som det mänskliga ögat
anpassar sig. Med en sådan exponeringsparameter kan vi ställa in belysningsparametrar som fungerar både dag och natt
under olika ljusförhållanden, eftersom vi bara behöver ändra exponeringen.

En förhållandevis enkel tone mapping-algoritm med exponering ser ut så här:

```text
mapped = 1.0 - exp(-hdrColor * exposure)
```

Även den här kurvan börjar i 0, stiger brant och närmar sig 1.0 utan att någonsin nå dit. Exponeringen skalar indata: en
**högre exponering** skjuter de mörka värdena upp längs kurvans branta del och gör dem ljusare och mer synliga, medan
de ljusa värdena trängs ihop nära 1.0; en **lägre exponering** gör de mörka partierna mörkare, mot svart, men sprider ut
de ljusa värdena över kurvan och tar fram detaljerna i de ljusa delarna. Med exponeringen 1.0 blir resultatet nära
Reinhards – lite ljusare (1.0 avbildas på 0.63 i stället för 0.5).

:::opengl
Exponeringen är en uniform, satt från en global variabel i `main.cpp` (`float exposure = 1.0f;`) innan fyrhörningen
ritas:

```cpp
        glBindTexture(GL_TEXTURE_2D, colorBuffer);
        hdrShader.setFloat("exposure", exposure);
        renderQuad();
```

I `hdr.fs`, med `uniform float exposure;`, blir Reinhard-raden en kommentar och exponeringskurvan tar dess plats:

```glsl
    // reinhard
    // vec3 result = hdrColor / (hdrColor + vec3(1.0));
    // exposure
    vec3 result = vec3(1.0) - exp(-hdrColor * exposure);
```

Det är learnopengls `hdr.fs`, utan växeln `hdr`. Gör nu den sista uppgiften, **exposure**.
:::
:::vulkan
Exponeringen läggs i uniformbuffern, som `hdrDescriptorSet` redan har på binding 0. En float får plats i de 4 byten
efter en `vec3`, så den tar `pad1`:s plats:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec4 lightPositions[4];
    glm::vec4 lightColors[4];
    glm::vec3 viewPos;
    float exposure; // a float fits into the 4 bytes after a vec3
};
```

med en global `float exposure = 1.0f;` och `ubo.exposure = exposure;` i `updateUniformBuffer()`. Descriptor set
layouten gör redan uniformbuffern synlig för fragmentsteget (belysningsshadern läser ljusen därifrån). `hdr.frag`
deklarerar blocket med alla medlemmar fram till `exposure` – offseten kommer från deklarationen, så shadern måste
deklarera allt före den, även det den inte använder:

```glsl
// the uniform buffer up to exposure, so that its offset matches the C++ struct
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec4 lightPositions[4];
    vec4 lightColors[4];
    vec3 viewPos;
    float exposure;
} ubo;
```

och i `main` blir Reinhard-raden en kommentar och exponeringskurvan tar dess plats:

```glsl
    // reinhard
    // vec3 result = hdrColor / (hdrColor + vec3(1.0));
    // exposure
    vec3 result = vec3(1.0) - exp(-hdrColor * ubo.exposure);
```

Det är learnopengls `hdr.fs`, utan växeln `hdr`. Gör nu den sista uppgiften, **exposure**.
:::
:::d3d12
Exponeringen är ett 32-bitarsvärde per draw – en root constant. Root-parameter 0 håller redan scenens 33 root constants
(`ModelConstants`, register b0); skärmfyrhörningen använder samma parameter för sin egen cbuffer på b0, med en enda
float:

```cpp
    struct HdrConstants
    {
        float exposure;
    };
```

Hittills var root-parameter 0 bara synlig för vertex shadern. Root signaturen måste göra varje register en shader
använder synligt för den shaderns steg – annars misslyckas skapandet av PSO:t – så den blir synlig för alla shaders:

```cpp
        rootParameters[0].InitAsConstants(sizeof(ModelConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_ALL);
```

Innan fyrhörningen ritas, med en global `float exposure = 1.0f;`:

```cpp
    HdrConstants hdrConstants = {};
    hdrConstants.exposure = exposure;
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(HdrConstants) / 4, &hdrConstants, 0);
```

Det sätter det första av de 33 värdena; nästa bildrutas tunnel-draw sätter alla 33 igen. I `hdr.hlsl`, med

```hlsl
cbuffer HdrConstants : register(b0)
{
    float exposure;
};
```

blir Reinhard-raden en kommentar och exponeringskurvan tar dess plats:

```hlsl
    // reinhard
    // float3 result = hdrColor / (hdrColor + float3(1.0f, 1.0f, 1.0f));
    // exposure
    float3 result = float3(1.0f, 1.0f, 1.0f) - exp(-hdrColor * exposure);
```

Det är learnopengls `hdr.fs`, utan växeln `hdr`. Gör nu den sista uppgiften, **exposure**.
:::

Bygg och kör: den bortre änden är **ljusare än med Reinhard men visar fortfarande sina brädor** – dess ljusaste mitt
kommer nära vitt, kanterna och skenet runt den blir också lite ljusare. Resten av den mörka tunneln är oförändrad.

learnopengl ändrar exponeringen medan programmet kör, med tangenterna Q och E (och slår av och på HDR med mellanslag).
Här byter uppgifterna koden i stället, så prova själv andra värden för den globala `exposure`:

- **5.0**: de mörka väggarna nära kameran blir tydligt synliga – brädorna, det röda ljusets röda ton – medan den bortre
  änden och skenet runt den mättas till ljust vitt igen. En hög exponering visar de mörka delarna.
- **0.1**: väggarna sjunker ner i svart, men den bortre änden visar sina brädor i full detalj, utan någon ljus fläck kvar.
  En låg exponering visar de ljusa delarna.

```quiz
Vad gör en högre exponering (5.0 i stället för 1.0) med exponerings-tone mapping?
- [ ] Den gör att den ljusa bortre änden visar fler detaljer
- [x] Den gör de mörka tunnelväggarna ljusare, så att deras detaljer syns, medan den ljusa änden trängs ihop nära vitt igen
- [ ] Ingenting: kurvan når aldrig 1.0
- [ ] Den gör hela bilden mörkare
---
Exponeringen multiplicerar HDR-färgen före kurvan. Mörka värden flyttas upp längs kurvans branta början; ljusa värden skjuts ut till den platta änden, där de ser likadana ut. En nattscen vill ha hög exponering, en solig låg.
```

```quiz
Varför flyttar gammakorrigeringen från belysningsshadern till skärmfyrhörningens shader?
- [ ] Flyttalsbuffern lagrar gammakorrigerade färger automatiskt
- [ ] Gammakorrigering fungerar bara på värden över 1.0
- [x] Tone mapping, liksom belysning, förutsätter linjära färger, och gammakorrigeringen måste vara sista steget innan färgen hamnar i fönstret – alltså kommer den efter tone mappingen
- [ ] Skärmfyrhörningens shader körs färre gånger, vilket gör den snabbare
---
Om belysningsshadern gammakorrigerade först skulle tone mapping-kurvan böja redan böjda värden. Ordningen är: belys i linjärt rum, behåll det linjärt i flyttalsbuffern, tone mappa, gammakorrigera.
```

## Mer HDR

De två tone mapping-algoritmerna vi visat är bara några få i en stor samling (mer avancerade) tone mapping-algoritmer,
var och en med sina styrkor och svagheter. Vissa gynnar vissa färger eller intensiteter framför andra, och vissa visar
både de låg- och högexponerade färgerna samtidigt för att skapa färgstarkare och mer detaljerade bilder. Spel använder
ofta så kallade *filmiska* kurvor, som efterliknar hur fotografisk film reagerar på ljus.

Det finns också en samling tekniker som kallas *automatisk exponering* eller *ögonanpassning* (eye adaptation): de mäter
scenens ljusstyrka i föregående bildruta och anpassar (långsamt) exponeringen så att scenen blir ljusare i mörka områden
eller mörkare i ljusa, som det mänskliga ögat.

Den verkliga nyttan med HDR-rendering syns först i stora och komplexa scener med tunga belysningsalgoritmer. Tunneln är
en enkel scen, men den visar redan huvudpoängen: ett ljus 200 gånger starkare än vitt, som en LDR-renderare bara kan visa
som en vit klump. Eftersom HDR-rendering gör det möjligt att arbeta med realistiska ljusintensiteter är det också grunden
för de senare teknikerna i kursen: bloom, i nästa kapitel, använder ljusstyrkan över 1.0 för att avgöra vad som ska
glöda.

:::vulkan
En kommentar om hårdvarualternativet från kapitlet *Gammakorrigering*: ett `_SRGB`-format för swap chainen skulle göra
det sista gammasteget åt oss – skärmfyrhörningens shader skulle skriva linjära färger och hårdvaran koda dem när de
lagras. Kursens projekt behåller swap chainen med `B8G8R8A8_UNORM`, så `hdr.frag` gammakorrigerar som learnopengl.
:::
:::d3d12
En kommentar om hårdvarualternativet från kapitlet *Gammakorrigering*: en `_SRGB`-render target view av back buffern
skulle göra det sista gammasteget åt oss – skärmfyrhörningens shader skulle returnera linjära färger och hårdvaran koda
dem när de lagras. Kursen behåller learnopengls shadersätt, så `hdr.hlsl` gammakorrigerar i `PSMain`.
:::

## Mer att läsa

:::opengl
- [HDR](https://learnopengl.com/Advanced-Lighting/HDR): learnopengls kapitel som det här kapitlet följer, med
  skärmbilder av tunneln vid olika exponering.
- [hdr.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/6.hdr/hdr.cpp):
  learnopengls program, med tangenterna mellanslag, Q och E.
- [glTexImage2D](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2D.xhtml): de interna formaten,
  bland dem `GL_RGBA16F`.
:::
:::vulkan
- [HDR](https://learnopengl.com/Advanced-Lighting/HDR): learnopengls kapitel som det här kapitlet följer, med
  skärmbilder av tunneln vid olika exponering.
- [Render passes](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Render_passes):
  vulkan-tutorial om attachments, load- och store-operationer och layouter.
- [Formats (Vulkan-specifikationen)](https://docs.vulkan.org/spec/latest/chapters/formats.html): de format varje enhet
  måste stödja, och till vad.
:::
:::d3d12
- [HDR](https://learnopengl.com/Advanced-Lighting/HDR): learnopengls kapitel som det här kapitlet följer, med
  skärmbilder av tunneln vid olika exponering.
- [DXGI_FORMAT](https://learn.microsoft.com/en-us/windows/win32/api/dxgiformat/ne-dxgiformat-dxgi_format): formaten,
  bland dem `DXGI_FORMAT_R16G16B16A16_FLOAT`.
- [Using constants directly in the root signature](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-constants-directly-in-the-root-signature):
  root constants, som används för exponeringen.
:::
