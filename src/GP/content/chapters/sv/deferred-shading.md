# Deferred shading

Sättet vi har belyst på hittills kallas *forward rendering* eller *forward shading*. Ett rättframt sätt där vi renderar
ett objekt och belyser det med alla ljuskällor i scenen. Det gör vi för varje objekt i scenen, ett i taget. Det är lätt
att förstå och implementera, men också ganska tungt för prestandan, eftersom varje renderat objekt måste gå igenom varje
ljuskälla för varje renderat fragment, vilket är mycket! Forward rendering slösar också gärna bort många körningar av
fragment shadern i scener med stor djupkomplexitet (flera objekt täcker samma pixel på skärmen), eftersom fragment
shaderns utdata skrivs över: ett fragment belyses med varje ljus, och sedan täcks det av ett närmare objekt och allt det
arbetet kastas bort.

*Deferred shading* eller *deferred rendering* försöker komma runt de problemen genom att i grunden ändra hur vi renderar
objekt. Det ger oss flera nya möjligheter att optimera scener med många ljus avsevärt, så att vi kan rendera hundratals
(eller till och med tusentals) ljus med en godtagbar bildfrekvens. Deferred shading bygger på idén att vi *skjuter upp*
det mesta av det tunga renderingsarbetet (som belysningen) till ett senare steg. Den består av två pass:

1. **Geometripasset**: vi renderar scenen en gång och hämtar alla sorters geometrisk information från objekten, som vi
   lagrar i en samling texturer som kallas **G-buffern**; tänk positionsvektorer, färgvektorer, normalvektorer och/eller
   spekulära värden. Här beräknas ingen belysning.
2. **Belysningspasset**: vi renderar en fyrhörning som fyller skärmen och beräknar scenens belysning för varje pixel med
   den geometriska information som ligger i G-buffern – pixel för pixel.

Den stora fördelen: det fragment som hamnar i G-buffern är den faktiska fragmentinformation som blir en pixel på
skärmen, eftersom djuptestet redan har slagit fast att det fragmentet är det sista och översta. Det garanterar att vi för
varje pixel vi behandlar i belysningspasset bara beräknar belysningen en gång. Forward rendering kostar *fragment × ljus*
belysningsberäkningar, och en scen med mycket överlapp har många fler fragment än pixlar; deferred rendering kostar
*pixlar × ljus*, hur många objekt som än överlappar. Dessutom öppnar deferred rendering för ytterligare optimeringar som
låter oss rendera betydligt fler ljuskällor än med forward rendering – ljusvolymerna i slutet av det här kapitlet.

Den har också några nackdelar: G-buffern kräver att vi lagrar en relativt stor mängd scendata i sina färgbuffrar, vilket
äter minne, särskilt som scendata som positionsvektorer kräver hög precision. En annan nackdel är att den inte stöder
blending (eftersom vi bara har information om det översta fragmentet) och att MSAA inte längre fungerar. Det finns flera
sätt att komma runt det, som vi tar upp i slutet av kapitlet.

Det här kapitlet och nästa, *SSAO*, är de sista lektionerna i delen Avancerad belysning. Inget i dem kräver en ny sorts
API-objekt: G-buffern är HDR-kapitlets flyttals-render targets, skrivna alla på en gång som bloom-kapitlets två
färgbuffrar, och belysningspasset är ännu en skärmfyrhörning. Det här kapitlet visar hur {{api}} sätter ihop dem.

```quiz
I startens forward-renderare överlappar lådorna på skärmen. Var gör den belysningsarbete som deferred shading slipper?
- [ ] Den belyser bakgrundspixlarna, där ingen låda finns
- [ ] Den belyser varje låda två gånger: en gång för den diffusa och en gång för den spekulära delen
- [x] Ett fragment av en låda längre bak belyses med alla 32 ljus, och sedan täcker en närmare låda det: det arbetet kastas bort – deferred shading belyser bara det fragment som blir kvar i varje pixel
- [ ] Den kör vertex shadern en gång per ljus
---
Djuptestet avgör vilket fragment som blir kvar först efter att fragment shadern har körts. Att skjuta upp belysningen till ett pass över den färdiga G-buffern betyder att varje pixel belyses exakt en gång.
```

## Scenen

learnopengl ritar sin ryggsäcksmodell nio gånger i ett rutnät på 3 × 3; kursen ritar **nio containerlådor** på samma
positioner (x -3, 0, 3; y -0.5; z -3, 0, 3), var och en de tidigare kapitlens kub på 2 × 2 × 2 skalad med 0.75 – lådor
som är 1.5 enheter breda med 1.5 enheters mellanrum. Modellen spelar ingen roll för tekniken, och lådor behöver ingen
modelladdning. De använder `container2.png` som diffus karta och `container2_specular.png` som spekulär karta, lästa som
vanliga (linjära) texturer: learnopengls deferred-demo gammakorrigerar inte, och det gör inte det här kapitlet heller
(ingen tone mapping heller).

Ljusen är learnopengls: **32 punktljus** på "lite slumpmässiga" positioner med slumpmässiga färger:

:::opengl vulkan
```cpp
    srand(13);
    for (unsigned int i = 0; i < NR_LIGHTS; i++)
    {
        // calculate slightly random offsets
        float xPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
        float yPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 4.0);
        float zPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
        lightPositions.push_back(glm::vec3(xPos, yPos, zPos));
        // also calculate random color
        float rColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        float gColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        float bColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        lightColors.push_back(glm::vec3(rColor, gColor, bColor));
    }
```
:::
:::d3d12
```cpp
    srand(13);
    for (unsigned int i = 0; i < NR_LIGHTS; i++)
    {
        // calculate slightly random offsets
        float xPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
        float yPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 4.0);
        float zPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
        lightPositions.push_back(XMFLOAT3(xPos, yPos, zPos));
        // also calculate random color
        float rColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        float gColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        float bColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        lightColors.push_back(XMFLOAT3(rColor, gColor, bColor));
    }
```
:::

`srand(13)` sätter fröet för C-bibliotekets slumptalsgenerator: samma frö ger samma talföljd, så ljusen hamnar på samma
ställen vid varje körning. Själva talföljden hör dock till C-biblioteket: bilderna som beskrivs här är glibc:s `rand()`
(Linux, och den inbyggda simulatorn); med Microsofts C-runtime på Windows hamnar de 32 ljusen på andra ställen – samma
sorts scen, annorlunda i detaljerna. Ljusens dämpning är konstant 1, linjär 0.7 och kvadratisk 1.8, en kort räckvidd, så
varje ljus färgar bara lådorna nära det. Belysningen är learnopengls: en omgivningsterm `Diffuse * 0.1`, och för varje
ljus en diffus term och en spekulär Blinn-Phong-term (exponent 16, gånger den spekulära kartans värde), båda dämpade – i
världsrymden.

Kameran är inte learnopengls (0, 0, 5) som tittar rakt fram: därifrån döljer den främre raden rutnätet och de flesta
ljusen. Den står på **(0, 5, 9) och tittar ner på rutnätet** (yaw -90, pitch -35), så hela rutnätet syns, med ljusen
mellan, ovanför och under lådorna. Inget rör sig; programmet behöver ingen inmatning.

:::opengl
Starten är en forward-renderare: `main.cpp` ritar de nio lådorna i fönstret med `forward_shading.vs` /
`forward_shading.fs`, och fragment shadern går igenom alla 32 ljus för varje fragment – learnopengls belysningskod, med
ytans data direkt från vertex shadern och texturerna. Ljusens uniforms sätts varje bildruta i en loop
(`lights[i].Position`, `.Color`, `.Linear`, `.Quadratic`) tillsammans med `viewPos`. `renderCube()` och learnopengls
`renderQuad()` (en fyrhörning som fyller skärmen, ritad som en triangle strip) finns i slutet av `main.cpp`.
Deferred-shaderna finns redan: `g_buffer.vs` och `deferred_shading.vs` är klara, `g_buffer.fs` har sina utdata men dess
`main` är en TODO, `deferred_shading.fs` läser G-buffern men visar bara albedot, och `deferred_light_box.vs` / `.fs` är
klara (de används i den tredje uppgiften).
:::
:::vulkan
Starten är en forward-renderare: `recordCommandBuffer()` ritar de nio lådorna i fönstret med `forwardPipeline`
(`shaders/forward_shading.vert` / `.frag`) – en `for`-loop över `objectPositions` med modellmatrisen som push constant och
`vkCmdDraw(commandBuffer, 36, 1, 0, 0)` – och fragment shadern går igenom alla 32 ljus för varje fragment. Ljusen ligger i
uniform buffern, efter matriserna:

```cpp
struct Light {
    glm::vec3 position;
    float linear;
    glm::vec3 color;
    float quadratic;
};
```

std140 börjar en `vec3` på en multipel av 16 byte, som en `vec4`, så det blir en lucka på 4 byte efter varje `vec3`.
learnopengls ordning är Position, Color, Linear, Quadratic; kursen flyttar varje float in i luckan efter en `vec3`, så att
C++-structen får shaderns offsets utan utfyllnadsmedlemmar (32 byte per ljus). `updateUniformBuffer()` fyller
`ubo.lights[i]` varje bildruta (`linear` 0.7, `quadratic` 1.8) och `ubo.viewPos = cameraPos`; `createLights()` kör
learnopengls loop ovan en gång. Vertexbuffern innehåller kuben (vertex 0..35) och skärmfyrhörningen (36..41).
Pipelinehjälparen är `createPipeline(vertFile, fragFile, pipelineRenderPass, colorAttachmentCount, pipeline)`, med ett
blend state per färg-attachment, som i bloom-kapitlet. `createTextureSampler(filter, addressMode, sampler)` slår bara på
anisotropisk filtrering för `VK_FILTER_LINEAR` – en NEAREST-sampler måste returnera exakt en texel. Deferred-shaderna
ligger i `shaders/`: `g_buffer.vert`, `deferred_shading.vert` (skärmfyrhörningen) och `deferred_light_box.vert` är klara;
`g_buffer.frag`, `deferred_shading.frag` och `deferred_light_box.frag` är TODO:er som kompilerar och inte skriver något.
:::
:::d3d12
Starten är en forward-renderare: `PopulateCommandList` ritar de nio lådorna i back buffern med `m_pipelineState`
(`forward_shading.hlsl`) – deras två kartor (heap-plats 1 och 2) i rotparameter 2:s tabell, och per låda modell- och
normalmatrisen som rotkonstanter (`ModelConstants`, rotparameter 0) – och pixel shadern går igenom alla 32 ljus för varje
pixel. Ljusen ligger i konstantbuffern (b1), ifyllda i `OnUpdate` från de globala `lightPositions` / `lightColors` som
`LoadAssets` räknar fram med learnopengls loop ovan (som `XMFLOAT3`:or). HLSL packar
`struct Light { float3 Position; float3 Color; float Linear; float Quadratic; }` i rader om 16 byte: Position på offset 0,
Color på 16 – en `float3` korsar aldrig en rad, så den kan inte börja på 12 –, Linear på 28, Quadratic på 32, och varje
element i en array börjar en ny rad, så ett ljus tar 48 byte. C++-structen speglar det med utfyllnad:
`XMFLOAT3 Position; float padding0; XMFLOAT3 Color; float Linear; float Quadratic; float padding1[3];`. Deferred-
shaderfilerna finns: `g_buffer.hlsl` (dess `PSMain` en TODO), `deferred_shading.hlsl` (den visar bara albedot) och
`deferred_light_box.hlsl` (klar, används i den tredje uppgiften).
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Tryck på **Build & run** (Ctrl+Enter) för att kompilera
programmet och köra det i den inbyggda simulatorn: rutnätet på 3 × 3 trälådor med stålramar, sett ovanifrån och bakifrån,
den främre raden stor längst ner, den bakre liten längst upp, svart runt omkring. Lådornas ovansidor och de sidor som
vetter mot närliggande ljus är belysta i varma pastellfärger, resten är mörkt – bara omgivningstermen 0.1. Själva ljusen
syns inte. Varje fragment av varje låda belystes med alla 32 ljus, även de fragment som en närmare låda sedan täckte.

## G-buffern

G-buffern är samlingsnamnet för alla texturer som används för att lagra belysningsrelevant data till det sista
belysningspasset. Låt oss passa på att kort gå igenom all data vi behöver för att belysa ett fragment med forward
rendering:

- En 3D-**position** i världsrymden för att beräkna den (interpolerade) fragmentpositionen som används för `lightDir`
  och `viewDir`.
- En RGB-vektor med den diffusa **färgen**, även kallad *albedo*.
- En 3D-**normal** som avgör ytans lutning.
- En **spekulär** intensitet som float.
- Alla ljuskällors positions- och färgvektorer.
- Spelarens eller betraktarens position.

Med de här (per fragment) variablerna till vårt förfogande kan vi beräkna den (Blinn-)Phong-belysning vi är vana vid.
Ljuskällornas positioner och färger, och betraktarens position, kan ställas in som förut; de är desamma för varje pixel.
De andra variablerna är alla specifika för varje fragment av ett objekt. Om vi på något sätt kan skicka exakt samma data
till det sista, fördröjda belysningspasset kan vi beräkna samma belysningseffekter, trots att vi renderar fragmenten av en
2D-fyrhörning.

Det finns ingen gräns för vad vi kan lagra i en G-buffer. Eftersom vi lagrar all data i skärmrymden lagrar vi den i
texturer lika stora som fönstret. Vi behöver positioner, normaler och färger – tre render targets. Positioner och
normaler är inte begränsade till 0..1 och behöver precision, så de hamnar i **16-bitars flyttals**-mål (halvprecision:
tillräcklig precision för positioner i en scen av den här storleken); färgen och den spekulära intensiteten ryms i ett
**8-bitars** RGBA-mål: albedot i rgb, den spekulära intensiteten i alfa. Geometripasset skriver alla tre på en gång med
bloom-kapitlets multiple render targets. Varje mål i G-buffern har fyra kanaler, även där tre skulle räcka: GPU:er
föredrar i regel format med 4 komponenter på grund av byte-justeringen, och vissa drivrutiner kan annars vägra att göra en
framebuffer med format med 3 komponenter komplett.

| Mål i G-buffern | innehåll | format i {{api}} |
| --- | --- | --- |
| gPosition | position i världsrymden (xyz) | 16-bitars flyttal RGBA |
| gNormal | normal i världsrymden (xyz) | 16-bitars flyttal RGBA |
| gAlbedoSpec | albedo (rgb), spekulär intensitet (a) | 8-bitars UNORM RGBA |

Geometripasset behöver också en egen djupbuffer: det är djuptestet som gör att G-buffern för varje pixel håller den
närmaste ytan.

```quiz
Varför är gPosition och gNormal 16-bitars flyttalsmål, medan albedo och spekulär delar ett 8-bitars mål?
- [x] En position som (-3.75, -1.25, 2.4) eller en normal med negativa komponenter ryms inte i 0..1, och positioner behöver fler än 256 steg; en färg och en intensitet mellan 0 och 1 klarar sig med 8 bitar
- [ ] Flyttalsmål går snabbare att skriva, och albedomålet läses oftare
- [ ] Albedot är gammakorrigerat, och det fungerar bara med 8-bitarsformat
- [ ] Bara de två första render targets i ett pass kan vara flyttal
---
En 8-bitars UNORM-kanal lagrar 256 värden mellan 0.0 och 1.0: den skulle klämma varje position och varje negativ normalkomponent. Priset för precisionen är minne: två mål på 8 byte och ett på 4 byte per pixel.
```

:::opengl
G-buffern är en framebuffer med tre färgtexturer och en djup-renderbuffer – learnopengls kod, i startens TODO efter
texturerna:

```cpp
    // configure g-buffer framebuffer
    // ------------------------------
    unsigned int gBuffer;
    glGenFramebuffers(1, &gBuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, gBuffer);
    unsigned int gPosition, gNormal, gAlbedoSpec;
    // position color buffer
    glGenTextures(1, &gPosition);
    glBindTexture(GL_TEXTURE_2D, gPosition);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gPosition, 0);
    // normal color buffer
    glGenTextures(1, &gNormal);
    glBindTexture(GL_TEXTURE_2D, gNormal);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT1, GL_TEXTURE_2D, gNormal, 0);
    // color + specular color buffer
    glGenTextures(1, &gAlbedoSpec);
    glBindTexture(GL_TEXTURE_2D, gAlbedoSpec);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT2, GL_TEXTURE_2D, gAlbedoSpec, 0);
    // tell OpenGL which color attachments we'll use (of this framebuffer) for rendering
    unsigned int attachments[3] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1, GL_COLOR_ATTACHMENT2 };
    glDrawBuffers(3, attachments);
    // create and attach depth buffer (renderbuffer)
    unsigned int rboDepth;
    glGenRenderbuffers(1, &rboDepth);
    glBindRenderbuffer(GL_RENDERBUFFER, rboDepth);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT, SCR_WIDTH, SCR_HEIGHT);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, rboDepth);
    // finally check if framebuffer is complete
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "Framebuffer not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

`glDrawBuffers` säger till OpenGL att den här framebuffern renderar i alla tre färg-attachments – utan den skrevs bara
`GL_COLOR_ATTACHMENT0`. Texturerna använder `GL_NEAREST`: belysningspasset måste läsa exakt en texel per pixel, aldrig en
blandning av två grannars positioner eller normaler (mer om det i nästa avsnitt).

Geometripasset skriver i dem. `g_buffer.vs` är klar: den skickar vidare positionen i världsrymden (`FragPos =
worldPos.xyz`), texturkoordinaterna och normalen (med normalmatrisen). `g_buffer.fs` deklarerar ett utdata per
attachment – location n går till den n:te posten i listan över draw buffers – och dess `main` lagrar datan:

```glsl
#version 330 core
layout (location = 0) out vec3 gPosition;
layout (location = 1) out vec3 gNormal;
layout (location = 2) out vec4 gAlbedoSpec;

in vec2 TexCoords;
in vec3 FragPos;
in vec3 Normal;

uniform sampler2D texture_diffuse1;
uniform sampler2D texture_specular1;

void main()
{
    // store the fragment position vector in the first gbuffer texture
    gPosition = FragPos;
    // also store the per-fragment normals into the gbuffer
    gNormal = normalize(Normal);
    // and the diffuse per-fragment color
    gAlbedoSpec.rgb = texture(texture_diffuse1, TexCoords).rgb;
    // store specular intensity in gAlbedoSpec's alpha component
    gAlbedoSpec.a = texture(texture_specular1, TexCoords).r;
}
```

I `main.cpp` ersätts forward-`shader` av de två passens shaders:

```cpp
    Shader shaderGeometryPass("g_buffer.vs", "g_buffer.fs");
    Shader shaderLightingPass("deferred_shading.vs", "deferred_shading.fs");
```

inställda en gång (`shaderGeometryPass.setInt("texture_diffuse1", 0)` och `("texture_specular1", 1)`;
`shaderLightingPass.setInt("gPosition", 0)`, `("gNormal", 1)`, `("gAlbedoSpec", 2)`). Renderloopen blir learnopengls två
pass – lådorna i G-buffern, sedan skärmfyrhörningen i fönstret:

```cpp
        // 1. geometry pass: render scene's geometry/color data into gbuffer
        // -----------------------------------------------------------------
        glBindFramebuffer(GL_FRAMEBUFFER, gBuffer);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glm::mat4 projection = glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        glm::mat4 model = glm::mat4(1.0f);
        shaderGeometryPass.use();
        shaderGeometryPass.setMat4("projection", projection);
        shaderGeometryPass.setMat4("view", view);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, diffuseMap);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, specularMap);
        for (unsigned int i = 0; i < objectPositions.size(); i++)
        {
            model = glm::mat4(1.0f);
            model = glm::translate(model, objectPositions[i]);
            model = glm::scale(model, glm::vec3(0.75f)); // boxes 1.5 units wide
            shaderGeometryPass.setMat4("model", model);
            renderCube();
        }
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // 2. lighting pass: calculate lighting by iterating over a screen filled quad pixel-by-pixel using the gbuffer's content.
        // -----------------------------------------------------------------------------------------------------------------------
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        shaderLightingPass.use();
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, gPosition);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, gNormal);
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, gAlbedoSpec);
        // TODO: send the lights and the view position to the lighting pass
        // finally render quad
        renderQuad();
```

(TODO:n är nästa uppgift.) Startens `deferred_shading.fs` läser de fyra värdena ur G-buffern och skriver än så länge
`FragColor = vec4(Diffuse, 1.0); // for now: show the albedo`. Gör nu den första uppgiften, **g-buffer**, och ta bort de
tre texturerna, renderbuffern och framebuffern i slutet av `main`.
:::
:::vulkan
I Vulkan är G-buffern ett render pass med tre färg-attachments och en djup-attachment, och en framebuffer med fyra image
views. `createGBufferRenderPass()` beskriver attachments – learnopengls format, rensade i början, sparade i slutet och
lämnade i `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, redo att samplas av belysningspasset:

```cpp
        VkAttachmentDescription positionAttachment{};
        positionAttachment.format = VK_FORMAT_R16G16B16A16_SFLOAT; // learnopengl: GL_RGBA16F
        positionAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        positionAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        positionAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE; // keep the data: the lighting pass reads it
        positionAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        positionAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        positionAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        positionAttachment.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL; // ready to be sampled after the pass

        // the normals: the same kind of attachment
        VkAttachmentDescription normalAttachment = positionAttachment;

        // the diffuse colour (rgb) and the specular intensity (a): learnopengl's GL_RGBA
        VkAttachmentDescription albedoSpecAttachment = positionAttachment;
        albedoSpecAttachment.format = VK_FORMAT_R8G8B8A8_UNORM;
```

Djup-attachmenten är den vanliga (`findDepthFormat()`, rensad, slutlayout
`VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL`). Subpasset tar de tre färg-attachments i ordning – fragment shaderns
utdata på location n skriver `pColorAttachments[n]`, learnopengls `glDrawBuffers(3, attachments)` – och djupet på
attachment 3:

```cpp
        // the fragment shader's outputs: location n -> attachment n (learnopengl's glDrawBuffers(3, attachments))
        std::array<VkAttachmentReference, 3> colorAttachmentRefs{};
        colorAttachmentRefs[0].attachment = 0;
        colorAttachmentRefs[0].layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
        colorAttachmentRefs[1].attachment = 1;
        colorAttachmentRefs[1].layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
        colorAttachmentRefs[2].attachment = 2;
        colorAttachmentRefs[2].layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

        VkAttachmentReference depthAttachmentRef{};
        depthAttachmentRef.attachment = 3;
        depthAttachmentRef.layout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

Två subpass dependencies kedjar ihop passen, som i HDR-kapitlet: före passet, vänta tills förra bildrutans
belysningspass har läst bilderna (de skrivs igen nu); efter det, gör färgskrivningarna synliga för belysningspassets
fragment shader:

```cpp
        // after the pass: the lighting pass's fragment shader waits until the G-buffer has been written
        dependencies[1].srcSubpass = 0;
        dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
        dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
        dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
```

`createGBuffer()` (anropad före `createFramebuffers()`) skapar bilderna – färg-attachment **och** samplad, eftersom
geometripasset ritar i dem och belysningspasset läser dem – deras views, en djupbild, och framebuffern med de fyra
views i render passets ordning:

```cpp
        // position color buffer
        createImage(swapChainExtent.width, swapChainExtent.height, VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, gPositionImage, gPositionImageMemory);
        gPositionImageView = createImageView(gPositionImage, VK_FORMAT_R16G16B16A16_SFLOAT, VK_IMAGE_ASPECT_COLOR_BIT);
```

och likadant för `gNormalImage` och `gAlbedoSpecImage` (`VK_FORMAT_R8G8B8A8_UNORM`), sedan `gBufferDepthImage`,
`std::array<VkImageView, 4> attachments = {gPositionImageView, gNormalImageView, gAlbedoSpecImageView,
gBufferDepthImageView}` och `gBufferFramebuffer`. Alla Vulkan-enheter kan rendera i och sampla de här två formaten.

En pipeline görs för ett render pass, och dess color blend state har en post per färg-attachment i subpasset. Så
forward-pipelinen ersätts av två:

```cpp
        // a pipeline is made for one render pass: the geometry pass's for the G-buffer's (3 colour attachments)
        createPipeline("shaders/g_buffer.vert.spv", "shaders/g_buffer.frag.spv", gBufferRenderPass, 3, geometryPipeline);
        // the lighting pass's (the screen quad) for the window's
        createPipeline("shaders/deferred_shading.vert.spv", "shaders/deferred_shading.frag.spv", renderPass, 1, lightingPipeline);
```

Belysningspasset läser G-buffern genom en sampler som returnerar exakt en texel – learnopengls `GL_NEAREST`:
`createTextureSampler(VK_FILTER_NEAREST, VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, gBufferSampler)`. Dess descriptor set
håller uniform buffern (binding 0) och G-bufferns tre bilder på binding 1, 2 och 3. Alla set delar en layout, så layouten
får en binding 3 (`VkDescriptorSetLayoutBinding sampler3LayoutBinding = samplerLayoutBinding;
sampler3LayoutBinding.binding = 3;`) – lådornas set lämnar den tom, vilket går bra eftersom deras shaders inte läser den.
Poolen växer till två set: 2 uniform buffers och 6 combined image samplers (varje set tar det layouten har, skrivet eller
inte), `maxSets = 2`. `createGBufferDescriptorSet(gPositionImageView, gNormalImageView, gAlbedoSpecImageView,
gBufferSampler, gBufferDescriptorSet)` skriver de fyra deskriptorerna – bilderna med `imageLayout =
VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, den layout render passet lämnar dem i.

I `recordCommandBuffer()` kommer geometripasset först. Det rensar fyra attachments, så det behöver fyra rensningsvärden:

```cpp
        // one clear value per attachment: the three colour images, and the depth 1.0 (the far plane)
        std::array<VkClearValue, 4> gBufferClearValues{};
        gBufferClearValues[0].color = {{0.0f, 0.0f, 0.0f, 1.0f}};
        gBufferClearValues[1].color = {{0.0f, 0.0f, 0.0f, 1.0f}};
        gBufferClearValues[2].color = {{0.0f, 0.0f, 0.0f, 1.0f}};
        gBufferClearValues[3].depthStencil = {1.0f, 0};
```

I det: viewporten, scissorn, vertexbuffern, `geometryPipeline`, `containerDescriptorSet` och startens loop över lådorna.
Efter `vkCmdEndRenderPass` ligger G-bufferns färgbilder i `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`. Sedan fönstrets
render pass, med skärmfyrhörningen i stället för lådorna:

```cpp
        // the screen quad, lit with the G-buffer's data (the viewport, scissor and vertex buffer set above still apply)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, lightingPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &gBufferDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // renderQuad(): the screen quad's 6 vertices start at vertex 36
```

Viewporten och scissorn är kommandobufferns dynamiska tillstånd, så de förblir satta över render pass-gränserna. I
`g_buffer.frag`, ett utdata per färg-attachment, och learnopengls fyra tilldelningar:

```glsl
// location n = colour attachment n of the G-buffer's subpass (learnopengl's glDrawBuffers)
layout(location = 0) out vec4 gPosition;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gAlbedoSpec;

void main() {
    // store the fragment position vector in the first gbuffer texture
    gPosition = vec4(fs_in.fragPos, 1.0);
    // also store the per-fragment normals into the gbuffer
    gNormal = vec4(normalize(fs_in.normal), 1.0);
    // and the diffuse per-fragment color
    gAlbedoSpec.rgb = texture(texture_diffuse1, fs_in.texCoord).rgb;
    // store specular intensity in gAlbedoSpec's alpha component
    gAlbedoSpec.a = texture(texture_specular1, fs_in.texCoord).r;
}
```

(med `texture_diffuse1` / `texture_specular1` på binding 1 / 2 och `VS_OUT`-blocket från `g_buffer.vert`, som skickar
vidare positionen i världsrymden, normalen och texturkoordinaterna). Än så länge deklarerar `deferred_shading.frag` bara
`layout(binding = 3) uniform sampler2D gAlbedoSpec;` och visar albedot: `vec3 Diffuse = texture(gAlbedoSpec,
fragTexCoord).rgb; outColor = vec4(Diffuse, 1.0);`. Gör nu den första uppgiften, **g-buffer**, och förstör G-bufferns
bilder, views, minne och framebuffer, samplern, båda pipelines och det nya render passet i `cleanup()`.
:::
:::d3d12
I Direct3D 12 är G-buffern tre texturer med var sin render target view och shader resource view – som bloom-kapitlets
färgbuffrar, men med olika format. De skapas i en `for`-loop över formaten, börjar i tillståndet
`PIXEL_SHADER_RESOURCE`, och får sina RTV:er efter swap chainens buffrar (plats `FrameCount` till `FrameCount + 2`;
RTV-heapen behöver `FrameCount + 3`) och sina SRV:er på plats 3 till 5 i CBV/SRV-heapen (som behöver 6):

```cpp
        // Positions and normals: a half-precision float per channel (GL_RGBA16F); colour and
        // specular intensity: 8 bits per channel (GL_RGBA).
        const DXGI_FORMAT gBufferFormats[3] = { DXGI_FORMAT_R16G16B16A16_FLOAT, DXGI_FORMAT_R16G16B16A16_FLOAT, DXGI_FORMAT_R8G8B8A8_UNORM };
```

```cpp
        for (UINT i = 0; i < 3; i++)
        {
            // A texture that can be a render target (ALLOW_RENDER_TARGET). It starts in the
            // PIXEL_SHADER_RESOURCE state: every frame turns it into a render target for the
            // geometry pass, and back for the lighting pass, which reads it.
            CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(gBufferFormats[i], m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
            CD3DX12_CLEAR_VALUE clearValue(gBufferFormats[i], optimizedClearColor);
            ThrowIfFailed(m_device->CreateCommittedResource(
                &heapProperties,
                D3D12_HEAP_FLAG_NONE,
                &textureDesc,
                D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
                &clearValue,
                IID_PPV_ARGS(&m_gBuffer[i])));

            // A render target view, to draw into it: in the RTV heap after the swap chain's
            // buffers (slots FrameCount to FrameCount + 2).
            CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + i, m_rtvDescriptorSize);
            m_device->CreateRenderTargetView(m_gBuffer[i].Get(), nullptr, rtvHandle);
```

följt av SRV:n (`srvDesc.Format = gBufferFormats[i]`, plats `3 + i`). PSO:t måste känna till antalet render targets och
deras format; geometripasset kompilerar `g_buffer.hlsl` och skriver tre:

```cpp
        psoDesc.NumRenderTargets = 3;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        psoDesc.RTVFormats[2] = DXGI_FORMAT_R8G8B8A8_UNORM;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
```

Belysningspasset får ett eget PSO, `m_lightingPipelineState`, från samma beskrivning med shaderna i
`deferred_shading.hlsl`: back buffern som enda render target, och ingen djupbuffer – skärmfyrhörningen täcker varje pixel
en gång:

```cpp
        psoDesc.NumRenderTargets = 1;
        psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
        psoDesc.RTVFormats[1] = DXGI_FORMAT_UNKNOWN;
        psoDesc.RTVFormats[2] = DXGI_FORMAT_UNKNOWN;
        psoDesc.DepthStencilState.DepthEnable = FALSE;
        psoDesc.DSVFormat = DXGI_FORMAT_UNKNOWN;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_lightingPipelineState)));
```

Belysningspasset läser tre texturer, t0, t1 och t2. Rotparameter 2 är en tabell med två SRV:er – lådornas två kartor.
G-bufferns SRV:er ligger på plats 3, 4 och 5, så tabell 2 kan peka på plats 3 för gPosition och gNormal, och en ny
tabell, rotparameter 3, håller gAlbedoSpec på t2:

```cpp
        CD3DX12_DESCRIPTOR_RANGE ranges[3];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);
        ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 2);
```

```cpp
        rootParameters[3].InitAsDescriptorTable(1, &ranges[2], D3D12_SHADER_VISIBILITY_PIXEL);
```

(`CD3DX12_ROOT_PARAMETER rootParameters[4]`.) Varför inte bara göra rotparameter 2 till ett intervall med tre SRV:er? Då
skulle lådornas tabell, som pekar på plats 1, nå in på plats 3 – gPosition, ett render target medan lådorna ritas. Det
är tillåtet så länge ingen shader läser den, men förvirrande; två tabeller binder exakt det varje pass läser. G-buffern
läses med en andra statisk sampler, s1: punktfiltrering och klämning – learnopengls `GL_NEAREST`, en texel per pixel:

```cpp
        samplers[1] = samplers[0];
        samplers[1].Filter = D3D12_FILTER_MIN_MAG_MIP_POINT;
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].ShaderRegister = 1;
```

I `PopulateCommandList` gör geometripasset om de tre texturerna till render targets, binder alla tre med djupbuffern och
rensar dem:

```cpp
    CD3DX12_RESOURCE_BARRIER barriers[3] =
    {
        CD3DX12_RESOURCE_BARRIER::Transition(m_gBuffer[0].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET),
        CD3DX12_RESOURCE_BARRIER::Transition(m_gBuffer[1].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET),
        CD3DX12_RESOURCE_BARRIER::Transition(m_gBuffer[2].Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET)
    };
    m_commandList->ResourceBarrier(3, barriers);

    CD3DX12_CPU_DESCRIPTOR_HANDLE gBufferRtvHandles[3] =
    {
        CD3DX12_CPU_DESCRIPTOR_HANDLE(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize),
        CD3DX12_CPU_DESCRIPTOR_HANDLE(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 1, m_rtvDescriptorSize),
        CD3DX12_CPU_DESCRIPTOR_HANDLE(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount + 2, m_rtvDescriptorSize)
    };
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(3, gBufferRtvHandles, FALSE, &dsvHandle);
```

(sedan tre anrop till `ClearRenderTargetView` och djuprensningen), ritar lådorna som förut, och gör om texturerna till
shader resources igen. Belysningspasset ritar i back buffern **utan** DSV och låter de två tabellerna peka på G-buffern:

```cpp
    // The back buffer, without a depth buffer: the screen quad needs no depth test.
    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
    m_commandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);

    // The lighting pass's pipeline state, gPosition and gNormal (heap slots 3 and 4) as root
    // parameter 2's table (t0, t1) and gAlbedoSpec (slot 5) as root parameter 3's (t2).
    m_commandList->SetPipelineState(m_lightingPipelineState.Get());
    CD3DX12_GPU_DESCRIPTOR_HANDLE gPositionNormal(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, gPositionNormal);
    CD3DX12_GPU_DESCRIPTOR_HANDLE gAlbedoSpec(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 5, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(3, gAlbedoSpec);
    m_commandList->DrawInstanced(6, 1, 36, 0);    // the screen quad: vertices 36 to 41
```

I `g_buffer.hlsl` returnerar pixel shadern en struct med en medlem per render target (learnopengls tre variabler
`layout (location = n) out`):

```hlsl
struct PSOutput
{
    float4 gPosition : SV_TARGET0;
    float4 gNormal : SV_TARGET1;
    float4 gAlbedoSpec : SV_TARGET2;
};
```

och dess `PSMain` lagrar learnopengls fyra värden (dess vertex shader skickar vidare positionen i världsrymden, normalen
och texturkoordinaterna):

```hlsl
    PSOutput output;
    // store the fragment position vector in the first gbuffer texture
    output.gPosition = float4(input.fragPos, 1.0f);
    // also store the per-fragment normals into the gbuffer
    output.gNormal = float4(normalize(input.normal), 1.0f);
    // and the diffuse per-fragment color
    output.gAlbedoSpec.rgb = texture_diffuse1.Sample(wrapSampler, input.texCoord).rgb;
    // store specular intensity in gAlbedoSpec's alpha component
    output.gAlbedoSpec.a = texture_specular1.Sample(wrapSampler, input.texCoord).r;
    return output;
```

`deferred_shading.hlsl` deklarerar G-buffern på t0, t1, t2 med `SamplerState pointSampler : register(s1);` och returnerar
än så länge albedot: `return float4(Diffuse, 1.0f);`. Gör nu den första uppgiften, **g-buffer**.
:::

:::opengl
```quiz
Vad skulle hända om du utelämnade `glDrawBuffers(3, attachments)`?
- [ ] Framebuffern skulle vara ofullständig och inget skulle ritas
- [ ] OpenGL skulle skriva alla tre utdata i den första attachmenten, efter varandra
- [ ] De tre texturerna skulle bindas som texturenhet 0, 1 och 2
- [x] En framebuffer ritar som standard bara i `GL_COLOR_ATTACHMENT0`: gPosition skulle skrivas, gNormal och gAlbedoSpec skulle stå kvar på sina rensade värden
---
Utdata på location n går till den n:te posten i listan över draw buffers. Attachments finns utan den, men inget skrivs i dem.
```
:::
:::vulkan
```quiz
Varför behöver geometripasset en egen pipeline, skapad med `gBufferRenderPass` och 3 färg-attachments, i stället för att återanvända forward-pipelinen?
- [ ] En pipeline kan bara användas med en vertex shader per bildruta
- [x] En pipeline skapas för ett render pass (och subpass): dess color blend state behöver en post per färg-attachment i det subpasset, och formaten måste stämma – fönstrets pass har en attachment, G-bufferns har tre
- [ ] Geometripasset behöver en annan vertexbuffer
- [ ] Pipelines utan djuptest kan inte skriva i mer än en attachment
---
Pipelinen kan användas med varje render pass som är *kompatibelt* med det den skapades med – samma antal och format på attachments. Belysningspipelinen görs för fönstrets pass, geometripipelinen för G-bufferns.
```
:::
:::d3d12
```quiz
Varför läser belysningspasset gAlbedoSpec genom en andra tabell (rotparameter 3) i stället för ett intervall med tre SRV:er i rotparameter 2?
- [ ] En descriptor table kan rymma högst två SRV:er
- [ ] t2 kan bara bindas genom en egen rotparameter
- [x] Rotparameter 2 är också lådornas tabell (plats 1 och 2): som ett intervall med tre SRV:er skulle den nå in på plats 3, gPosition, medan den texturen är ett render target – tillåtet om ingen shader läser den, men två tabeller binder exakt det varje pass läser
- [ ] De två tabellerna behövs eftersom texturernas format skiljer sig
---
En tabell pekar på deskriptorer som ligger i följd i heapen. G-bufferns SRV:er ligger på plats 3, 4 och 5; tabell 2 pekar på plats 3 i belysningspasset, tabell 3 på plats 5.
```
:::

Tryck på **Build & run**: fönstret visar **albedot**, obelyst. Lådorna finns där, men varje sida är lika ljus – ovansidorna,
de mörka framsidorna, sidorna – i texturens rena färger: trä ungefär (150, 98, 52), stål ungefär (155, 157, 163) av 255.
Bakgrunden förblir svart: G-buffern rensades till noll där. Inget har belysts: det är belysningspassets jobb.

## Det fördröjda belysningspasset

Med en stor samling fragmentdata i G-buffern till vårt förfogande har vi möjlighet att helt beräkna scenens slutliga
belysta färger. Det gör vi genom att gå igenom var och en av G-bufferns texturer pixel för pixel och använda innehållet
som indata till belysningsalgoritmerna. Eftersom G-bufferns värden alla motsvarar de slutliga, transformerade
fragmentvärdena behöver vi bara göra de dyra belysningsoperationerna en gång per pixel. Det är särskilt användbart i
komplexa scener där vi med forward rendering lätt skulle köra flera dyra fragment shader-anrop per pixel.

För belysningspasset renderar vi en 2D-fyrhörning som fyller skärmen (lite som en efterbehandlingseffekt) och kör en
dyr belysande fragment shader på varje pixel. Fyrhörningens texturkoordinater täcker G-buffern exakt en gång, så varje
pixel läser sin egen texel – därför samplas G-buffern med nearest-filtrering: med linjär filtrering skulle en pixel vid
kanten av en låda blanda lådans position och normal med bakgrundens nollor, eller med en annan låda långt bakom, och
belysa en yta som inte finns.

Belysningskoden är forward-shaderns – learnopengls – förutom att indata kommer från G-buffern i stället för från vertex
shadern och texturerna. Ljusen är samma 32 som förut, och `viewPos` kamerans position: båda i världsrymden, som G-bufferns
positioner och normaler.

:::opengl
`deferred_shading.fs` läser G-buffern:

```glsl
    // retrieve data from gbuffer
    vec3 FragPos = texture(gPosition, TexCoords).rgb;
    vec3 Normal = texture(gNormal, TexCoords).rgb;
    vec3 Diffuse = texture(gAlbedoSpec, TexCoords).rgb;
    float Specular = texture(gAlbedoSpec, TexCoords).a;
```

och beräknar sedan belysningen som vanligt – learnopengls kod:

```glsl
    // then calculate lighting as usual
    vec3 lighting  = Diffuse * 0.1; // hard-coded ambient component
    vec3 viewDir  = normalize(viewPos - FragPos);
    for(int i = 0; i < NR_LIGHTS; ++i)
    {
        // diffuse
        vec3 lightDir = normalize(lights[i].Position - FragPos);
        vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * lights[i].Color;
        // specular
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(Normal, halfwayDir), 0.0), 16.0);
        vec3 specular = lights[i].Color * spec * Specular;
        // attenuation
        float distance = length(lights[i].Position - FragPos);
        float attenuation = 1.0 / (1.0 + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
        diffuse *= attenuation;
        specular *= attenuation;
        lighting += diffuse + specular;
    }
    FragColor = vec4(lighting, 1.0);
```

Uniforms är forward-shaderns: `struct Light { vec3 Position; vec3 Color; float Linear; float Quadratic; };`,
`uniform Light lights[NR_LIGHTS];` och `uniform vec3 viewPos;`. I `main.cpp` skickar TODO:n i belysningspasset dem till
`shaderLightingPass`, samma loop som forward-passet hade:

```cpp
        // send light relevant uniforms
        for (unsigned int i = 0; i < lightPositions.size(); i++)
        {
            shaderLightingPass.setVec3("lights[" + std::to_string(i) + "].Position", lightPositions[i]);
            shaderLightingPass.setVec3("lights[" + std::to_string(i) + "].Color", lightColors[i]);
            // update attenuation parameters
            const float linear = 0.7f;
            const float quadratic = 1.8f;
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Linear", linear);
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Quadratic", quadratic);
        }
        shaderLightingPass.setVec3("viewPos", cameraPos);
```

Varje medlem i varje arrayelement är en egen uniform, som hittas med sitt namn. Gör nu uppgiften **lighting-pass**.
:::
:::vulkan
Ljusen och `viewPos` ligger redan i uniform buffern – `updateUniformBuffer()` fyllde dem åt forward-passet – och
`gBufferDescriptorSet` har buffern på binding 0. Så `main.cpp` ändras inte: bara `deferred_shading.frag`. Den deklarerar
uniform-blocket som `forward_shading.frag`, och G-bufferns tre bilder:

```glsl
const int NR_LIGHTS = 32;

// std140: a vec3 starts at a multiple of 16 bytes - a float after each vec3 fills the 4 bytes up to the next one
struct Light {
    vec3 position;
    float linear;
    vec3 color;
    float quadratic;
};

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    Light lights[NR_LIGHTS];
    vec3 viewPos;
} ubo;

// the G-buffer: bindings 1, 2 and 3 (learnopengl's gPosition, gNormal and gAlbedoSpec texture units)
layout(binding = 1) uniform sampler2D gPosition;
layout(binding = 2) uniform sampler2D gNormal;
layout(binding = 3) uniform sampler2D gAlbedoSpec;
```

Dess `main` läser G-buffern och belyser pixeln – learnopengls kod med `ubo.`:

```glsl
void main() {
    // retrieve data from gbuffer
    vec3 FragPos = texture(gPosition, fragTexCoord).rgb;
    vec3 Normal = texture(gNormal, fragTexCoord).rgb;
    vec3 Diffuse = texture(gAlbedoSpec, fragTexCoord).rgb;
    float Specular = texture(gAlbedoSpec, fragTexCoord).a;

    // then calculate lighting as usual
    vec3 lighting  = Diffuse * 0.1; // hard-coded ambient component
    vec3 viewDir  = normalize(ubo.viewPos - FragPos);
    for (int i = 0; i < NR_LIGHTS; ++i) {
        // diffuse
        vec3 lightDir = normalize(ubo.lights[i].position - FragPos);
        vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * ubo.lights[i].color;
        // specular
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(Normal, halfwayDir), 0.0), 16.0);
        vec3 specular = ubo.lights[i].color * spec * Specular;
        // attenuation
        float distance = length(ubo.lights[i].position - FragPos);
        float attenuation = 1.0 / (1.0 + ubo.lights[i].linear * distance + ubo.lights[i].quadratic * distance * distance);
        diffuse *= attenuation;
        specular *= attenuation;
        lighting += diffuse + specular;
    }
    outColor = vec4(lighting, 1.0);
}
```

Arrayen av structar har samma stride i C++ och GLSL – 32 byte, en multipel av 16 som std140 kräver för arrayelement –
så `ubo.lights[i]` är C++-structens `lights[i]`. Gör nu uppgiften **lighting-pass**.
:::
:::d3d12
`main.cpp` skickar redan ljusen – `OnUpdate` fyllde konstantbuffern åt forward-passet – så bara `deferred_shading.hlsl`
ändras. Den deklarerar ljuset och konstantbuffern som `forward_shading.hlsl`:

```hlsl
// A point light: where it is, its colour and its attenuation (the constant term is 1.0).
struct Light
{
    float3 Position;
    float3 Color;

    float Linear;
    float Quadratic;
};
#define NR_LIGHTS 32

// The constant buffer at register b1 (the CBV in root parameter 1's table).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    Light lights[NR_LIGHTS];
    float3 viewPos;
};
```

och `PSMain` läser G-buffern med punktsamplern och belyser pixeln – learnopengls kod i HLSL:

```hlsl
    // retrieve data from gbuffer
    float3 FragPos = gPosition.Sample(pointSampler, input.texCoord).rgb;
    float3 Normal = gNormal.Sample(pointSampler, input.texCoord).rgb;
    float3 Diffuse = gAlbedoSpec.Sample(pointSampler, input.texCoord).rgb;
    float Specular = gAlbedoSpec.Sample(pointSampler, input.texCoord).a;

    // then calculate lighting as usual
    float3 lighting = Diffuse * 0.1f; // hard-coded ambient component
    float3 viewDir = normalize(viewPos - FragPos);
    for (int i = 0; i < NR_LIGHTS; ++i)
    {
        // diffuse
        float3 lightDir = normalize(lights[i].Position - FragPos);
        float3 diffuse = max(dot(Normal, lightDir), 0.0f) * Diffuse * lights[i].Color;
        // specular
        float3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(Normal, halfwayDir), 0.0f), 16.0f);
        float3 specular = lights[i].Color * spec * Specular;
        // attenuation
        float distance = length(lights[i].Position - FragPos);
        float attenuation = 1.0f / (1.0f + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
        diffuse *= attenuation;
        specular *= attenuation;
        lighting += diffuse + specular;
    }
    return float4(lighting, 1.0f);
```

`NR_LIGHTS` är en `#define`, learnopengls `const int NR_LIGHTS = 32;`: storleken på en array i en cbuffer måste vara känd
när shadern kompileras. Gör nu uppgiften **lighting-pass**.
:::

```quiz
Varför läses G-buffern med nearest-filtrering (punktfiltrering) i belysningspasset?
- [ ] Linjär filtrering fungerar inte med flyttalstexturer
- [x] Varje pixel måste få exakt sin egen ytas position och normal: filtrering skulle medelvärdesbilda en lådkant med bakgrunden eller med en låda långt bakom – en position och normal som ingen verklig yta har
- [ ] Nearest-filtrering behövs för att fyrhörningens texturkoordinater ska vara i pixlar
- [ ] Linjär filtrering skulle gammakorrigera albedot två gånger
---
En färg kan blandas mellan texlar utan större skada; en position halvvägs mellan en låda och väggen bakom den är en punkt i tomma luften, och den skulle belysas som om den vore en yta.
```

Tryck på **Build & run**: bilden är **startbilden igen** – de belysta lådorna, varma där ljus finns nära, mörka annars;
ingen pixel skiljer sig med mer än 1 från forward-renderaren. Det är poängen: samma belysningskod med samma indata ger
samma färger. Det som ändrats är arbetet: varje pixel belyses nu exakt en gång – 800 × 600 × 32 belysningsberäkningar
per bildruta, hur många lådor som än överlappar.

## Att kombinera deferred rendering med forward rendering

Säg att vi vill rendera varje ljuskälla som en 3D-kub på ljuskällans position, i ljusets färg. En första idé som dyker
upp är att helt enkelt forward-rendera alla ljuskällor ovanpå den fördröjda belysningsfyrhörningen i slutet av
deferred shading-kedjan. Alltså rendera kuberna som vi normalt skulle, men först när de fördröjda renderingsstegen är
klara: en kub vid varje ljus, skala 0.125, i ljusets färg (`deferred_light_box`s fragment shader skriver inget annat än
färgen).

De renderade kuberna tar dock ingen hänsyn till det lagrade geometridjupet i deferred-renderaren och renderas därför
alltid ovanpå de tidigare renderade objekten – belysningspasset ritade en platt fyrhörning, och fönstrets djupbuffer, om
det finns någon, vet ingenting om lådorna. Det vi måste göra är att först kopiera djupinformationen från geometripasset
till fönstrets djupbuffer, och först därefter rendera ljuskuberna. Då renderas ljuskubernas fragment bara där de ligger
framför den tidigare renderade geometrin. Hur det görs är där de tre API:erna skiljer sig mest i det här kapitlet.

:::opengl
Vi kan kopiera innehållet i en framebuffer till en annan framebuffer med hjälp av `glBlitFramebuffer`, en funktion vi
också använde i anti-aliasing-kapitlet för att resolva multisamplade framebuffers. Funktionen `glBlitFramebuffer` låter
oss kopiera ett valt område av en framebuffer till ett valt område av en annan. Vi binder G-buffern som read framebuffer
och fönstrets (0) som draw framebuffer, och kopierar bara djupet:

```cpp
        // 2.5. copy content of geometry's depth buffer to default framebuffer's depth buffer
        // ----------------------------------------------------------------------------------
        glBindFramebuffer(GL_READ_FRAMEBUFFER, gBuffer);
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0); // write to default framebuffer
        // blit to default framebuffer. Note that this may or may not work as the internal formats of both the FBO and default framebuffer have to match.
        // the internal formats are implementation defined. This works on all of my systems, but if it doesn't on yours you'll likely have to write to the
        // depth buffer in another shader stage (or somehow see to match the default framebuffer's internal format with the FBO's internal format).
        glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_DEPTH_BUFFER_BIT, GL_NEAREST);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

learnopengls kommentar säger vad som kan gå fel: att blitta djup kräver samma djupformat på båda sidor, och fönstrets
väljs av systemet. Här stämmer G-bufferns `GL_DEPTH_COMPONENT`-renderbuffer och GLFW:s förvalda djupbuffer på 24 bitar
överens. Utan kopian håller fönstrets djupbuffer bara skärmfyrhörningens platta djup (0.5 överallt: NDC z = 0), så
kuberna skulle inte döljas rätt bakom lådorna. Själva kuberna – learnopengls `// 3. render lights on top of scene` –
använder `Shader shaderLightBox("deferred_light_box.vs", "deferred_light_box.fs");`:

```cpp
        shaderLightBox.use();
        shaderLightBox.setMat4("projection", projection);
        shaderLightBox.setMat4("view", view);
        for (unsigned int i = 0; i < lightPositions.size(); i++)
        {
            model = glm::mat4(1.0f);
            model = glm::translate(model, lightPositions[i]);
            model = glm::scale(model, glm::vec3(0.125f));
            shaderLightBox.setMat4("model", model);
            shaderLightBox.setVec3("lightColor", lightColors[i]);
            renderCube();
        }
```

Gör nu uppgiften **light-cubes**.
:::
:::vulkan
learnopengl kopierar G-bufferns djup till fönstrets djupbuffer med `glBlitFramebuffer`. Vulkan har `vkCmdBlitImage`, men
att blitta en djupbild kräver formategenskaperna `VK_FORMAT_FEATURE_BLIT_SRC_BIT` / `BLIT_DST_BIT` för djupformatet, och
dem har inte alla enheter; `vkCmdCopyImage` fungerar, men kräver två djupbilder och barriärer runt kopian. Det finns ett
enklare sätt: ett render pass kan **ladda** det ett tidigare pass sparade. Så fönstrets render pass använder G-bufferns
djupbild som sin egen djup-attachment – fönstrets djupbild försvinner (`depthImage`, dess minne och view, och
`createDepthResources()`), och `createFramebuffers()` lägger `gBufferDepthImageView` bredvid varje swap chain-image view.

Tre saker får det att fungera. Geometripasset behåller sitt djup: `depthAttachment.storeOp =
VK_ATTACHMENT_STORE_OP_STORE` i `createGBufferRenderPass()`. Fönstrets render pass laddar det i stället för att rensa
det, och utgår från den layout geometripasset lämnade det i:

```cpp
        // the depth attachment is the G-buffer's depth image: keep what the geometry pass wrote (load it, don't clear it)
        // - learnopengl copies it into the window's depth buffer with glBlitFramebuffer
        VkAttachmentDescription depthAttachment{};
        depthAttachment.format = findDepthFormat();
        depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_LOAD;
        depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.initialLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL; // as the geometry pass left it
        depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

Och dess subpass dependency, som redan väntar på tidigare djupskrivningar (`srcStageMask` innehåller
`VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT`, `srcAccessMask` `VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT`), nämner nu
också läsningen som laddningen är: `dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT |
VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_READ_BIT | VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT`. Rensningsvärdet för djupet
står kvar i arrayen men används inte (en laddad attachment rensas inte).

Skärmfyrhörningen ritas i samma pass, före kuberna – den får varken döljas av det djupet eller skriva över det. Så
`createPipeline` får en parameter `VkBool32 depthTestEnable` för båda djupinställningarna:

```cpp
        depthStencil.depthTestEnable = depthTestEnable;
        depthStencil.depthWriteEnable = depthTestEnable;
```

`VK_TRUE` för geometripipelinen, `VK_FALSE` för belysningspipelinen, och `VK_TRUE` för den nya `lightBoxPipeline`
(`"shaders/deferred_light_box.vert.spv"`, `"shaders/deferred_light_box.frag.spv"`, `renderPass`, 1). Kubens färg når
fragment shadern som push constant efter modellmatrisen – push constants läggs ut som std430, så `vec3`:n börjar direkt
efter `mat4`:n:

```cpp
struct PushConstants {
    glm::mat4 model;
    glm::vec3 lightColor;
};
```

Push constant-intervallet – och varje `vkCmdPushConstants`, lådornas också – nämner nu båda stegen,
`VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`. I `recordCommandBuffer()`, efter fyrhörningen, fortfarande i
fönstrets pass:

```cpp
        // 3. render lights on top of scene: the pass's depth is the G-buffer's, so the boxes hide the light cubes behind them
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, lightBoxPipeline);
        for (unsigned int i = 0; i < lightPositions.size(); i++) {
            glm::mat4 model = glm::mat4(1.0f);
            model = glm::translate(model, lightPositions[i]);
            model = glm::scale(model, glm::vec3(0.125f));
            constants.model = model;
            constants.lightColor = lightColors[i];
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);
            vkCmdDraw(commandBuffer, 36, 1, 0, 0); // renderCube()
        }
```

`gBufferDescriptorSet` är fortfarande bundet, och dess binding 0 är uniform buffern med vy- och projektionsmatriserna som
`deferred_light_box.vert` läser. `deferred_light_box.frag` deklarerar push constant-blocket `{ mat4 model; vec3
lightColor; } pc` och skriver `outColor = vec4(pc.lightColor, 1.0);`. Gör nu uppgiften **light-cubes**, och förstör den
nya pipelinen i `cleanup()`.
:::
:::d3d12
learnopengl kopierar här G-bufferns djup till fönstrets djupbuffer. **Direct3D 12 behöver ingen kopia**: en djupbuffer
hör inte till någon framebuffer. Den är en resurs med en depth-stencil view, bunden med de render targets som nästa
`OMSetRenderTargets` nämner. Geometripassets `m_depthStencil` håller fortfarande lådornas djup efter belysningspasset –
belysningsfyrhörningen ritades utan DSV – så ljuskuberna ritas i back buffern med samma DSV:

```cpp
    // 2.5. learnopengl copies the geometry pass's depth into the window's depth buffer here
    // (glBlitFramebuffer). In Direct3D 12 a depth buffer belongs to no framebuffer: the
    // geometry pass's depth buffer is still filled with the scene's depths, so it is bound
    // together with the back buffer - nothing to copy.
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle);

    // 3. render lights on top of scene: a small cube per light, in its colour (root
    // constants), with the light cubes' pipeline state - hidden where a box is in front.
    m_commandList->SetPipelineState(m_lightBoxPipelineState.Get());
    for (unsigned int i = 0; i < lightPositions.size(); i++)
    {
        XMMATRIX model = XMMatrixScaling(0.125f, 0.125f, 0.125f) * XMMatrixTranslation(lightPositions[i].x, lightPositions[i].y, lightPositions[i].z);
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
        modelConstants.lightColor = lightColors[i];
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        m_commandList->DrawInstanced(36, 1, 0, 0);
    }
```

En kopia (`CopyResource` till en andra djupbuffer) skulle bara behövas om fönsterpasset hade en egen djupbuffer med annat
innehåll. `ModelConstants` har redan `lightColor` (35 rotkonstanter: två matriser och en `float3`), och
`deferred_light_box.hlsl` är klar: dess `VSMain` transformerar kuben, dess `PSMain` returnerar `float4(lightColor, 1.0f)`.
PSO:t, `m_lightBoxPipelineState`, görs från belysningspassets beskrivning – back bufferns format – med djuptestet på
igen:

```cpp
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(lightBoxVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(lightBoxPixelShader.Get());
        psoDesc.DepthStencilState.DepthEnable = TRUE;
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_lightBoxPipelineState)));
```

(med shaderna kompilerade från `deferred_light_box.hlsl`, `VSMain` och `PSMain`). Standardjämförelsen för djupet är
`D3D12_COMPARISON_FUNC_LESS`, som för lådorna. Gör nu uppgiften **light-cubes**.
:::

:::opengl
```quiz
Varför måste G-bufferns djup kopieras till fönstrets djupbuffer innan ljuskuberna ritas?
- [x] Fönstrets djupbuffer håller bara skärmfyrhörningens platta djup: utan lådornas djup skulle kuberna bakom en låda ritas över den
- [ ] `glBlitFramebuffer` kopierar också belysningen till fönstret
- [ ] Ljuskuberna ritas i G-buffern och behöver dess djup där
- [ ] Utan den skulle djuptestet kasta bort skärmfyrhörningen
---
Blitten kopierar bara `GL_DEPTH_BUFFER_BIT`, och fungerar bara om båda djupbuffrarna har samma format – learnopengls kommentar i koden varnar för det.
```
:::
:::vulkan
```quiz
Fönstrets render pass använder G-bufferns djupbild med `loadOp = VK_ATTACHMENT_LOAD_OP_LOAD`. Varför skapas belysningspipelinen med `depthTestEnable = VK_FALSE`?
- [ ] En pipeline med djuptest kan inte läsa från samplade bilder
- [ ] Att ladda en djup-attachment stänger av djuptestet ändå
- [x] Fyrhörningen ritas först i samma pass: med testet på skulle den döljas överallt där en låda är närmare än fyrhörningens djup, och med djupskrivning skulle den skriva över lådornas djup som ljuskuberna behöver
- [ ] Belysningspipelinen har ingen djup-attachment i sitt render pass
---
Belysningspasset måste röra varje pixel och lämna djupet i fred; bara ljuskuberna testas mot det. Därför tar `createPipeline` flaggan för både `depthTestEnable` och `depthWriteEnable`.
```
:::
:::d3d12
```quiz
Varför behöver Direct3D 12 ingen motsvarighet till learnopengls `glBlitFramebuffer` för ljuskuberna?
- [ ] Swap chainens back buffer har en inbyggd djupbuffer som geometripasset fyller
- [ ] Ljuskubernas PSO läser G-bufferns positioner i stället för en djupbuffer
- [ ] `OMSetRenderTargets` kopierar djupet när render target byts
- [x] En djupbuffer är inte en del av en framebuffer: geometripassets `m_depthStencil` håller fortfarande lådornas djup, så den binds helt enkelt tillsammans med back buffern för kuberna
---
Belysningsfyrhörningen ritades utan DSV (`nullptr`) och dess PSO har `DepthEnable = FALSE`, så inget rörde djupbuffern mellan geometripasset och kuberna.
```
:::

Tryck på **Build & run**: **32 små kuber i pastellfärger** dyker upp mellan, ovanför och under lådorna, ungefär 12 till 28
pixlar breda – grå, orange, rosa, mintgröna, cyan, lila. Några döljs bakom lådor, till exempel under den vänstra
mittlådan; andra svävar över den svarta bakgrunden runt rutnätet. Allt annat är oförändrat.

Kuberna har ingen egen belysning: de visar ljusets färg. Alla objekt som behöver en annan shader – ett genomskinligt
objekt, ett speciellt material – kan forward-renderas på det här sättet efter belysningspasset, djuptestade mot
G-bufferns djup. Så kombinerar deferred-renderare de två teknikerna.

## Ett större antal ljus

Det deferred rendering ofta hyllas för är förmågan att rendera en enorm mängd ljuskällor utan stor kostnad för
prestandan. Deferred rendering i sig tillåter inte särskilt många ljuskällor, eftersom vi fortfarande måste beräkna varje
fragments belysning för var och en av scenens ljuskällor. Det som gör ett stort antal ljuskällor möjligt är en mycket
snygg optimering vi kan göra i deferred-kedjan: *ljusvolymer*.

Normalt, när vi renderar ett fragment i en stor belyst scen, beräknar vi bidraget från varje ljuskälla i scenen, oavsett
dess avstånd till fragmentet. En stor del av ljuskällorna når aldrig fragmentet, så varför slösa alla de
belysningsberäkningarna?

Idén bakom ljusvolymer är att beräkna en ljuskällas radie, eller volym, alltså området där dess ljus kan nå fragment.
Eftersom de flesta ljuskällor använder någon form av dämpning kan vi använda den för att beräkna det största avståndet,
eller radien, som deras ljus når. Sedan gör vi bara de dyra belysningsberäkningarna om ett fragment ligger inuti en eller
flera av ljusvolymerna.

### Att beräkna en ljuskällas volym eller radie

För att få fram en ljuskällas volymradie måste vi lösa dämpningsekvationen för när ljusets bidrag blir 0.0. Som
dämpningsfunktion använder vi funktionen från kapitlet Ljuskällor:

```text
attenuation = 1.0 / (Kc + Kl * d + Kq * d²)
```

Det vi vill är att lösa ekvationen för när dämpningen är 0.0. Tyvärr når ekvationen aldrig exakt 0.0, så det finns
ingen lösning. Det vi kan göra är att i stället lösa den för ett ljusstyrkevärde som ligger nära 0.0 men ändå uppfattas
som mörkt. learnopengl väljer 5/256: med 8 bitar per kanal syns ett bidrag under 5 av 256 nivåer knappt. Ljusets
ljusaste färgkanal, *Imax*, gånger dämpningen ska nå 5/256:

```text
5/256 = Imax / (Kc + Kl * d + Kq * d²)
Kq * d² + Kl * d + Kc - Imax * 256/5 = 0
```

En andragradsekvation i *d*, som vi löser med lösningsformeln (och tar den positiva roten):

```text
d = (-Kl + sqrt(Kl² - 4 * Kq * (Kc - Imax * 256/5))) / (2 * Kq)
```

Med Kc = 1, Kl = 0.7 och Kq = 1.8 når ett ljus vars ljusaste kanal är 0.5 ungefär 3.5 enheter, ett ljus med en kanal på
1.0 ungefär 5.1. Varje ljuskällas radie beräknas en gång per ljus på CPU:n och skickas med det; shadern hoppar över ljuset
överallt där fragmentet ligger längre bort:

```text
for(int i = 0; i < NR_LIGHTS; ++i)
{
    // calculate distance between light source and current fragment
    float distance = length(lights[i].Position - FragPos);
    if(distance < lights[i].Radius)
    {
        // do expensive lighting
        [...]
    }
}
```

:::opengl
I `main.cpp`s ljusloop, learnopengls kod – den konstanta termen skickas inte, shadern antar 1.0:

```cpp
            // update attenuation parameters and calculate radius
            const float constant = 1.0f; // note that we don't send this to the shader, we assume it is always 1.0 (in our case)
            const float linear = 0.7f;
            const float quadratic = 1.8f;
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Linear", linear);
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Quadratic", quadratic);
            // then calculate radius of light volume/sphere
            const float maxBrightness = std::fmaxf(std::fmaxf(lightColors[i].r, lightColors[i].g), lightColors[i].b);
            float radius = (-linear + std::sqrt(linear * linear - 4 * quadratic * (constant - (256.0f / 5.0f) * maxBrightness))) / (2.0f * quadratic);
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Radius", radius);
```

`deferred_shading.fs` får `float Radius;` i `struct Light`, och loopen beräknar avståndet först och lägger resten inuti
testet:

```glsl
    for(int i = 0; i < NR_LIGHTS; ++i)
    {
        // calculate distance between light source and current fragment
        float distance = length(lights[i].Position - FragPos);
        if(distance < lights[i].Radius)
        {
            // diffuse
            vec3 lightDir = normalize(lights[i].Position - FragPos);
            vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * lights[i].Color;
            // specular
            vec3 halfwayDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(Normal, halfwayDir), 0.0), 16.0);
            vec3 specular = lights[i].Color * spec * Specular;
            // attenuation
            float attenuation = 1.0 / (1.0 + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
            diffuse *= attenuation;
            specular *= attenuation;
            lighting += diffuse + specular;
        }
    }
```

Gör nu den sista uppgiften, **light-volumes**.
:::
:::vulkan
Radien följer med varje ljus i uniform buffern. I shadern följer `float radius;` efter `quadratic` – då är structen 36
byte, och **std140 avrundar storleken på en struct som används som arrayelement uppåt till en multipel av 16 byte**: 48.
C++-structen måste ha samma stride, så den får tre floats utfyllnad:

```cpp
struct Light {
    glm::vec3 position;
    float linear;
    glm::vec3 color;
    float quadratic;
    float radius; // the light volume's radius: farther away the light adds (almost) nothing
    float pad1;   // std140 rounds the size of a struct up to a multiple of 16 bytes: 48
    float pad2;
    float pad3;
};
```

I `updateUniformBuffer()`s ljusloop, learnopengls kod – den konstanta termen skickas inte, shadern antar 1.0:

```cpp
            // update attenuation parameters and calculate radius
            const float constant = 1.0f; // note that we don't send this to the shader, we assume it is always 1.0 (in our case)
            const float linear = 0.7f;
            const float quadratic = 1.8f;
            ubo.lights[i].linear = linear;
            ubo.lights[i].quadratic = quadratic;
            // then calculate radius of light volume/sphere
            const float maxBrightness = std::fmaxf(std::fmaxf(lightColors[i].r, lightColors[i].g), lightColors[i].b);
            float radius = (-linear + std::sqrt(linear * linear - 4 * quadratic * (constant - (256.0f / 5.0f) * maxBrightness))) / (2.0f * quadratic);
            ubo.lights[i].radius = radius;
```

`deferred_shading.frag` får `float radius;` i `struct Light`, och loopen beräknar avståndet först och lägger resten inuti
testet:

```glsl
    for (int i = 0; i < NR_LIGHTS; ++i) {
        // calculate distance between light source and current fragment
        float distance = length(ubo.lights[i].position - FragPos);
        if (distance < ubo.lights[i].radius) {
            // diffuse
            vec3 lightDir = normalize(ubo.lights[i].position - FragPos);
            vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * ubo.lights[i].color;
            // specular
            vec3 halfwayDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(Normal, halfwayDir), 0.0), 16.0);
            vec3 specular = ubo.lights[i].color * spec * Specular;
            // attenuation
            float attenuation = 1.0 / (1.0 + ubo.lights[i].linear * distance + ubo.lights[i].quadratic * distance * distance);
            diffuse *= attenuation;
            specular *= attenuation;
            lighting += diffuse + specular;
        }
    }
```

Gör nu den sista uppgiften, **light-volumes**.
:::
:::d3d12
Radien följer med varje ljus i konstantbuffern. I HLSL hamnar `float Radius;` efter `Quadratic` på offset 36, fortfarande
i den tredje raden om 16 byte – så ljuset förblir 48 byte, och C++-structen byter en float utfyllnad mot den:

```cpp
    struct Light
    {
        XMFLOAT3 Position;
        float padding0;
        XMFLOAT3 Color;
        float Linear;
        float Quadratic;
        float Radius;
        float padding1[2];
    };
```

I `OnUpdate`s ljusloop, learnopengls kod – den konstanta termen skickas inte, shadern antar 1.0:

```cpp
        // update attenuation parameters and calculate radius
        const float constant = 1.0f; // note that we don't send this to the shader, we assume it is always 1.0 (in our case)
        const float linear = 0.7f;
        const float quadratic = 1.8f;
        constantBufferData.lights[i].Linear = linear;
        constantBufferData.lights[i].Quadratic = quadratic;
        // then calculate radius of light volume/sphere: the distance at which the light's
        // brightest channel has faded to 5/256 - too dark to see in an 8-bit colour
        const float maxBrightness = std::fmax(std::fmax(lightColors[i].x, lightColors[i].y), lightColors[i].z);
        float radius = (-linear + std::sqrt(linear * linear - 4 * quadratic * (constant - (256.0f / 5.0f) * maxBrightness))) / (2.0f * quadratic);
        constantBufferData.lights[i].Radius = radius;
```

(learnopengl skriver `std::fmaxf`, som inte alla standardbibliotek deklarerar i `std`; `std::fmax` har en överlagring för
`float`. En `XMFLOAT3`:s kanaler heter `x`, `y`, `z`.) `deferred_shading.hlsl` får `float Radius;` i `struct Light`, och
loopen beräknar avståndet först och lägger resten inuti testet:

```hlsl
    for (int i = 0; i < NR_LIGHTS; ++i)
    {
        // calculate distance between light source and current fragment
        float distance = length(lights[i].Position - FragPos);
        if (distance < lights[i].Radius)
        {
            // diffuse
            float3 lightDir = normalize(lights[i].Position - FragPos);
            float3 diffuse = max(dot(Normal, lightDir), 0.0f) * Diffuse * lights[i].Color;
            // specular
            float3 halfwayDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(Normal, halfwayDir), 0.0f), 16.0f);
            float3 specular = lights[i].Color * spec * Specular;
            // attenuation
            float attenuation = 1.0f / (1.0f + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
            diffuse *= attenuation;
            specular *= attenuation;
            lighting += diffuse + specular;
        }
    }
```

Gör nu den sista uppgiften, **light-volumes**.
:::

Tryck på **Build & run**: bilden är **nästan densamma – lite mörkare på sina ställen**. Ljuskuberna, de främre lådornas
ovansidor och de mörka framsidorna är oförändrade; men stålramarna i den bakre raden tappar ungefär en femtedel av sin
ljusstyrka (den bakre mittlådans ram går från ungefär 149 till 117), och innersidorna på de främre hörnlådorna blir också
mörkare. Ungefär 28 000 pixlar blir mer än 5 nivåer mörkare, ingen blir ljusare.

Varför, om ett ljus som hoppas över bidrar med "inget synligt"? Radien är där *en* ljuskällas ljusaste kanal faller till
5/256 – varje ljus som hoppas över där skulle ha lagt till som mest några nivåer. Men scenen har 32 ljus, några enheter
från varandra, och från en given punkt ligger många av dem precis utanför sin radie. Deras små bidrag summeras: där ett
dussin ljus tappar 2 eller 3 nivåer var blir summan 30. learnopengls text förutsätter få överlappande ljus; med 32 ljus så
tätt syns gränsen. En tröskel mindre än 5/256 skulle skjuta ut radierna och dölja skillnaden, till priset av färre
överhoppade ljus.

### Hur ljusvolymer används på riktigt

Fragment shadern ovan fungerar inte riktigt i praktiken och visar bara hur vi på ett ungefär kan använda en ljuskällas volym
för att minska belysningsberäkningarna. Verkligheten är att din GPU och dess shaderspråk är ganska dåliga på att
optimera loopar och förgreningar. Skälet är att shaderkörningen på GPU:n är mycket parallell, och de flesta arkitekturer
kräver att en stor samling trådar – pixlarna i en grupp, 32 eller 64 stycken – kör exakt samma shaderkod i takt. När
trådarna i en grupp går åt olika håll i en `if` kör gruppen båda sidorna, med de trådar som inte tog en sida maskade. Så
överallt där en pixel i en grupp ligger inom en ljuskällas radie betalar hela gruppen för det ljuset; radiekontrollen ovan
sparar lite eller inget, och vi beräknar fortfarande belysningen för (nästan) alla ljuskällor.

Det rätta sättet att använda ljusvolymer är att rendera verkliga sfärer, skalade med ljusvolymens radie. Sfärernas
mittpunkter placeras på ljuskällans position, och eftersom sfären skalas med ljusvolymens radie omsluter den exakt
ljusets synliga volym. Här kommer tricket: vi använder den fördröjda belysningsshadern för att rendera sfärerna.
Eftersom en renderad sfär ger fragment shader-anrop som exakt motsvarar de pixlar ljuskällan påverkar, renderar vi bara
de relevanta pixlarna och hoppar över alla andra. Varje ljuskällas sfär ritas med additiv blending, så ljusens bidrag summeras
i fönstret. Det ger nu en tidskomplexitet på *objekt + ljus × täckta pixlar*, i stället för *pixlar × ljus*.

Det finns fortfarande problem med det här sättet: face culling bör vara påslaget (annars renderar vi en ljuskällas effekt två
gånger, för sfärens fram- och baksida), och när det är påslaget kan kameran hamna inuti en ljusvolym, varefter volymen
inte renderas längre (på grund av back-face culling) och ljuskällans inverkan försvinner. Det kan vi lösa genom att bara
rendera sfärernas baksidor – genom att culla framsidorna. Att rendera ljusvolymer kostar sin prestanda, och även om det i
allmänhet är mycket snabbare än vanlig deferred shading för att rendera många ljus, finns det mer att optimera.

Det finns två andra populära (och effektivare) utbyggnader av deferred shading som kallas *deferred lighting* (eller
light pre-pass) och *tile-based deferred shading*. Moderna renderare går ännu längre med *clustered* shading: skärmen
delas in i rutor (och, för clustered shading, djupskivor), ett compute-pass tar reda på vilka ljus som berör varje ruta
eller kluster, och belysningen loopar sedan bara över den korta listan – en loop som är densamma för alla pixlar i en
ruta, så problemet med att köra i takt försvinner. De teknikerna ligger utanför det här kapitlet, men G-buffern och
belysningspasset du har byggt är deras grund.

```quiz
Varför sparar `if (distance < radius)` i belysningsshadern lite på en GPU, och vad gör riktiga renderare i stället?
- [ ] `if`-satsen tas bort av shaderkompilatorn, så radien har ingen effekt
- [ ] Själva testet kostar lika mycket som belysningen det hoppar över
- [ ] Den sparar inget eftersom varje pixel ligger inom varje ljuskällas radie
- [x] Pixlarna i en grupp körs i takt: om en av dem behöver ett ljus kör hela gruppen dess kod – så renderare ritar varje ljuskällas volym (en sfär med den radien) eller bygger ljuslistor per ruta, och belyser bara de pixlar ett ljus kan nå
---
Bilden blev lite mörkare eftersom 32 överhoppade bidrag strax under 5/256 summeras – vinsten en GPU får av `if`-satsen är den mindre effekten.
```

## Deferred rendering kontra forward rendering

I sig själv (utan ljusvolymer) är deferred shading en fin optimering, eftersom varje pixel bara kör en enda fragment
shader, jämfört med forward rendering där vi ofta kör fragment shadern flera gånger per pixel. Deferred rendering har
dock några nackdelar: ett stort minnesbehov – här 8 + 8 + 4 byte per pixel för G-buffern plus dess djup, som läses igen i
belysningspasset –, ingen MSAA, och blending måste fortfarande göras med forward rendering.

- **Blending och genomskinlighet.** G-buffern håller en yta per pixel, den närmaste. Ett fönster eller ett glas framför en
  låda skulle behöva båda ytornas data: ett genomskinligt objekt kan inte lagras i den. Deferred-renderare ritar
  genomskinliga objekt efteråt med forward rendering, sorterade bakifrån och fram och djuptestade mot G-bufferns djup –
  ljuskubernas teknik.
- **MSAA.** Multisampling resolvar en pixels samplingar till en färg i slutet; en G-buffer med positioner och normaler kan
  inte resolvas på det sättet (en medelvärdesbildad normal är ingen normal), och multisamplade G-buffrar mångdubblar
  minnet. Deferred-renderare kantutjämnar i stället oftast den färdiga bilden med ett efterbehandlingsfilter (FXAA, TAA
  och liknande).
- **En belysningsmodell.** Varje pixel belyses av samma belysningspass. Objekt som behöver en annan belysningsalgoritm
  behöver mer data i G-buffern (till exempel ett material-ID) eller ett eget forward-pass.

När du har en liten scen och inte alltför många ljus är deferred rendering inte nödvändigtvis snabbare, och ibland till
och med långsammare, eftersom overheaden då väger tyngre än fördelarna. I mer komplexa scener blir deferred rendering
snabbt en betydande optimering, särskilt med de mer avancerade utbyggnaderna. Och därmed är G-buffern på plats för det
sista kapitlet i den här delen: SSAO, som läser positioner och normaler ur en G-buffer precis som den här.

## Mer att läsa

:::opengl
- [Deferred Shading](https://learnopengl.com/Advanced-Lighting/Deferred-Shading): learnopengls kapitel som det här
  kapitlet följer, med ryggsäcksscenen och bilder av G-buffern.
- [deferred_shading.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/8.1.deferred_shading/deferred_shading.cpp):
  learnopengls program.
- [glBlitFramebuffer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlitFramebuffer.xhtml): att kopiera ett
  område av en framebuffers buffrar till en annans.
:::
:::vulkan
- [Deferred Shading](https://learnopengl.com/Advanced-Lighting/Deferred-Shading): learnopengls kapitel som det här
  kapitlet följer, med ryggsäcksscenen och bilder av G-buffern.
- [Render Pass](https://docs.vulkan.org/spec/latest/chapters/renderpass.html): specifikationens kapitel om attachments,
  load- och store-operationer och subpass dependencies.
- [Shader memory layout](https://docs.vulkan.org/guide/latest/shader_memory_layout.html): Vulkan Guide om std140 och
  std430 – varför ljusstructen fylls ut till 48 byte.
:::
:::d3d12
- [Deferred Shading](https://learnopengl.com/Advanced-Lighting/Deferred-Shading): learnopengls kapitel som det här
  kapitlet följer, med ryggsäcksscenen och bilder av G-buffern.
- [ID3D12GraphicsCommandList::OMSetRenderTargets](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-omsetrendertargets):
  att binda flera render targets och en depth-stencil view.
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  hur HLSL lägger ut `Light`-arrayen i konstantbuffern.
:::
