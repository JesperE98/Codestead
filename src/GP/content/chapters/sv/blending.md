# Blending

*Blending* är allmänt känt som tekniken för att åstadkomma *genomskinlighet* hos föremål. Genomskinlighet handlar om
att föremål (eller delar av dem) inte har en heltäckande färg, utan en kombination av färger från föremålet självt och
från andra föremål bakom det, med varierande styrka. Ett färgat glasfönster är ett genomskinligt föremål: glaset har en
egen färg, men den färg som blir resultatet innehåller också färgerna från alla föremål bakom glaset. Det är också
därifrån namnet blending kommer: vi *blandar* flera pixelfärger (från olika föremål) till en enda färg. Genomskinlighet
gör alltså att vi kan se igenom föremål.

Genomskinliga föremål kan vara helt genomskinliga (de släpper igenom alla färger) eller delvis genomskinliga (de
släpper igenom färger, men visar också något av sin egen färg). Hur genomskinligt ett föremål är bestäms av färgens
**alfavärde**. Alfavärdet är den fjärde komponenten i en färgvektor, som du säkert har sett ganska ofta vid det här
laget. Fram till det här kapitlet har vi alltid haft den fjärde komponenten på `1.0`, vilket ger föremålet 0.0 i
genomskinlighet. Ett alfavärde på `0.0` skulle göra föremålet helt genomskinligt. Ett alfavärde på `0.5` säger att
föremålets färg består till 50 % av dess egen färg och till 50 % av färgerna bakom föremålet.

De texturer vi har använt hittills bestod alla av 3 färgkomponenter (rött, grönt och blått) eller hade alfa 1 överallt,
men vissa texturer har också en inbäddad alfakanal med ett alfavärde per texel. Det alfavärdet talar om exakt vilka
delar av texturen som är genomskinliga och hur mycket. Kursens `window.png` är en sådan textur: rött glas med ett alfa
på ungefär 0.55 – lite mer än hälften egen färg – i en ogenomskinlig mörkröd ram med ett kors i mitten.

Vi börjar med att titta på hur man hanterar texturer som antingen är helt genomskinliga eller helt ogenomskinliga, och
sedan på riktig blending med fönstren. Som i de andra kapitlen i den här delen fungerar allt på samma sätt i {{api}};
bara stället där du slår på det skiljer sig, och texten visar det för ditt API.

:::opengl
Projektet börjar där kapitlet *Depth testing* började: de två marmorkuberna på (-1, 0, -1) och (2, 0, 0) och
metallgolvet, ritade med `glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, kameran på (0, 0, 3) som tittar längs -z,
och en shader (`blending.vs`, `blending.fs`) som läser `texture1`. Två nya filer följer med: `grass.png` och
`window.png` bredvid `marble.png` och `metal.png`.
:::
:::vulkan
Projektet börjar där kapitlet *Depth testing* började: de två marmorkuberna på (-1, 0, -1) och (2, 0, 0) och
metallgolvet, kameran på (0, 0, 3) som tittar längs -z, en pipeline med djuptestet (`VK_COMPARE_OP_LESS`), och alla
scenens vertexar i en enda vertex buffer – kuben är vertex 0..35, golvet 36..41 – ur vilken varje `vkCmdDraw` väljer
sin del med `firstVertex`. Varje textur har ett eget descriptor set (uniform buffern på binding 0, texturen på
binding 1), och hjälpfunktionerna `loadTexture(...)` och `createTextureSampler(addressMode, sampler)` laddar en bild
och skapar en sampler. Nytt i `textures/`: `grass.png` och `window.png`.
:::
:::d3d12
Projektet börjar där kapitlet *Depth testing* började: de två marmorkuberna på (-1, 0, -1) och (2, 0, 0) och
metallgolvet, kameran på (0, 0, 3) som tittar längs -z, ett PSO med djupfunktionen LESS, och shadrarna `VSMain` och
`PSMain` i `blending.hlsl`. Alla vertexar ligger i en enda vertex buffer – kuben är vertex 0 till 35, golvet 36 till 41
– och varje ritning väljer sin del med startvertexen i `DrawInstanced`. Varje textur har en SRV i CBV/SRV-heapen
(CBV:n på plats 0, marmorn på plats 1, metallen på plats 2), och `SetGraphicsRootDescriptorTable(2, …)` pekar pixel
shadern på en av dem före varje ritning. Nytt bredvid de andra bilderna: `grass.png` och `window.png`.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift trycker du på **Build & run**
(Ctrl+Enter) för att kompilera programmet och köra det i den inbyggda simulatorn.

## Kasta fragment

Vissa effekter bryr sig inte om delvis genomskinlighet, utan vill antingen visa något eller ingenting alls beroende på
en texturs färgvärde. Tänk på gräs: för att skapa något som liknar gräs utan större ansträngning klistrar man oftast en
gräs-textur på en platt 2D-quad och placerar den i scenen. Men gräs har ju inte formen av en 2D-kvadrat, så du vill bara
visa vissa delar av gräs-texturen och strunta i resten.

Kursens `grass.png` är precis en sådan textur: gröna grässtrån, och runt dem texlar med alfa `0.0` (deras färg är
svart). Varje texel är antingen helt ogenomskinlig (alfa 1) eller helt genomskinlig (alfa 0); det finns inget
däremellan. När vi lägger till växtlighet i en scen vill vi alltså inte se en fyrkantig bild av gräs, utan bara visa
själva gräset och se igenom resten av bilden. Vi vill *kasta* (discard) de fragment som visar texturens genomskinliga
delar och inte lagra dem i color buffern.

Innan vi kommer dit måste vi först lära oss hur man laddar en genomskinlig textur. Alla våra texturer laddas redan
med 4 kanaler, så alfavärdena når shadern utan extra arbete:

:::opengl
learnopengls `loadTexture` väljer format efter antalet kanaler i filen, så en PNG med alfakanal laddas upp som
`GL_RGBA`:

```cpp
        else if (nrComponents == 4)
            format = GL_RGBA;
```

och fragment shaderns `texture(texture1, TexCoords)` returnerar alla fyra komponenterna.
:::
:::vulkan
`loadTexture` ber stb_image om fyra kanaler (`STBI_rgb_alpha`) och lagrar dem i en `VK_FORMAT_R8G8B8A8_UNORM`-bild,
precis som texturkoden i vulkan-tutorial; bilder utan alfakanal får helt enkelt alfa 255. Fragment shaderns
`texture(texSampler, fragTexCoord)` returnerar alltså gräsets alfa som sin `a`-komponent.
:::
:::d3d12
`LoadTexture` läser varje bild som RGBA (4 kanaler), samma layout som `DXGI_FORMAT_R8G8B8A8_UNORM`; bilder utan
alfakanal får helt enkelt alfa 255. Pixel shaderns `texture1.Sample(…)` returnerar alltså gräsets alfa som sin
`a`-komponent.
:::

För att lägga till lite gräs behöver vi en quad att sätta texturen på: 1 × 1, upprätt, med vänsterkanten vid x = 0
och nederkanten vid y = -0.5, så att en förflyttning till en position ställer den med nederkanten på golvet (golvet
ligger på y = -0.5). Vi placerar fem sådana quads på de positioner som learnopengl använder: en strax framför den
vänstra kuben, en till höger, en nära kameran, en långt bak och en bakom den som står nära.

:::opengl
```cpp
    float transparentVertices[] = {
        // positions         // texture Coords (the image is flipped on load, so v = 1.0 is its top row)
        0.0f,  0.5f,  0.0f,  0.0f,  1.0f,
        0.0f, -0.5f,  0.0f,  0.0f,  0.0f,
        1.0f, -0.5f,  0.0f,  1.0f,  0.0f,

        0.0f,  0.5f,  0.0f,  0.0f,  1.0f,
        1.0f, -0.5f,  0.0f,  1.0f,  0.0f,
        1.0f,  0.5f,  0.0f,  1.0f,  1.0f
    };
```

(learnopengl laddar de här bilderna utan att vända dem och bytte därför plats på quadens v-koordinater; vår
`loadTexture` vänder varje bild med `stbi_set_flip_vertically_on_load(true)`, så quaden behåller v = 1 överst och
gräset står upprätt.)

Quaden får en egen VAO, uppsatt precis som golvets:

```cpp
    // transparent VAO
    unsigned int transparentVAO, transparentVBO;
    glGenVertexArrays(1, &transparentVAO);
    glGenBuffers(1, &transparentVBO);
    glBindVertexArray(transparentVAO);
    glBindBuffer(GL_ARRAY_BUFFER, transparentVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(transparentVertices), transparentVertices, GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    glBindVertexArray(0);
```

Sedan laddar vi texturen och listar positionerna i en `std::vector` (lägg till `#include <vector>` högst upp):

```cpp
    unsigned int transparentTexture = loadTexture("grass.png");

    // transparent vegetation locations
    // --------------------------------
    std::vector<glm::vec3> vegetation
    {
        glm::vec3(-1.5f, 0.0f, -0.48f),
        glm::vec3( 1.5f, 0.0f, 0.51f),
        glm::vec3( 0.0f, 0.0f, 0.7f),
        glm::vec3(-0.3f, 0.0f, -2.3f),
        glm::vec3( 0.5f, 0.0f, -0.6f)
    };
```

Varje gräsföremål ritas som en enda quad med gräs-texturen på. Det är ingen perfekt 3D-återgivning av gräs, men det är
mycket effektivare än att ladda och rita ett stort antal komplexa modeller. Med några knep, som slumpmässiga rotationer
och skalningar, kan du få ganska övertygande resultat med quads.

Efter golvet binder vi quadens VAO och gräs-texturen och ritar quaden en gång per position:

```cpp
        // vegetation
        glBindVertexArray(transparentVAO);
        glBindTexture(GL_TEXTURE_2D, transparentTexture);
        for (unsigned int i = 0; i < vegetation.size(); i++)
        {
            model = glm::mat4(1.0f);
            model = glm::translate(model, vegetation[i]);
            shader.setMat4("model", model);
            glDrawArrays(GL_TRIANGLES, 0, 6);
        }
```

I slutet av `main` tar du bort den nya VAO:n, VBO:n och texturen tillsammans med de andra
(`glDeleteVertexArrays(1, &transparentVAO);`, `glDeleteBuffers(1, &transparentVBO);`,
`glDeleteTextures(1, &transparentTexture);`).
:::
:::vulkan
Eftersom alla vertexar ligger i en enda vertex buffer läggs quadens sex vertexar till sist i `vertices`, efter golvet
– de blir vertex 42..47:

```cpp
    // transparent quad (x 0..1, y -0.5..0.5): vertices 42..47; v = 0 at the top edge, so the image is upright
    {{ 0.0f,  0.5f,  0.0f}, {0.0f, 0.0f}},
    {{ 0.0f, -0.5f,  0.0f}, {0.0f, 1.0f}},
    {{ 1.0f, -0.5f,  0.0f}, {1.0f, 1.0f}},

    {{ 0.0f,  0.5f,  0.0f}, {0.0f, 0.0f}},
    {{ 1.0f, -0.5f,  0.0f}, {1.0f, 1.0f}},
    {{ 1.0f,  0.5f,  0.0f}, {1.0f, 0.0f}}
};
```

Det här är learnopengls `transparentVertices` oförändrade: stb_images första rad är bildens överkant, och Vulkans
v = 0 är första raden, så v = 0 vid quadens överkant håller gräset upprätt. Under `vertices` kommer en global lista
med positioner:

```cpp
// transparent vegetation locations
const std::vector<glm::vec3> vegetation = {
    glm::vec3(-1.5f, 0.0f, -0.48f),
    glm::vec3( 1.5f, 0.0f,  0.51f),
    glm::vec3( 0.0f, 0.0f,  0.7f),
    glm::vec3(-0.3f, 0.0f, -2.3f),
    glm::vec3( 0.5f, 0.0f, -0.6f)
};
```

Gräs-texturen behöver det som varje textur i projektet har: en image, dess minne och en view
(`transparentTextureImage`, `transparentTextureImageMemory`, `transparentTextureImageView`), och ett descriptor set
`transparentDescriptorSet` med uniform buffern och texturen. Den får också en egen sampler, `transparentSampler` –
varför ser du strax. I `initVulkan()`:

```cpp
        loadTexture("textures/grass.png", transparentTextureImage, transparentTextureImageMemory, transparentTextureImageView);
        createTextureSampler(VK_SAMPLER_ADDRESS_MODE_REPEAT, textureSampler);
        // clamp to edge: at the top edge, linear filtering would otherwise mix in the opaque bottom row of the image
        createTextureSampler(VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, transparentSampler);
```

och efter de två andra descriptor seten:

```cpp
        createDescriptorSet(transparentTextureImageView, transparentSampler, transparentDescriptorSet);
```

Ett tredje set behöver plats i poolen: `maxSets = 3` och en `descriptorCount` på 3 för båda poolstorlekarna. Förstör
den nya samplern, viewn, imagen och minnet i `cleanup()` som de andra.

Varje gräsföremål ritas som en enda quad med gräs-texturen på. Det är ingen perfekt 3D-återgivning av gräs, men det är
mycket effektivare än att ladda och rita ett stort antal komplexa modeller. Med några knep, som slumpmässiga rotationer
och skalningar, kan du få ganska övertygande resultat med quads.

I `recordCommandBuffer()`, efter golvet, binder du gräsets descriptor set och ritar quaden en gång per position:

```cpp
        // vegetation
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &transparentDescriptorSet, 0, nullptr);
        for (unsigned int i = 0; i < vegetation.size(); i++) {
            model = glm::mat4(1.0f);
            model = glm::translate(model, vegetation[i]);
            constants.model = model;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
            vkCmdDraw(commandBuffer, 6, 1, 42, 0); // the quad's 6 vertices start at vertex 42
        }
```
:::
:::d3d12
Eftersom alla vertexar ligger i en enda vertex buffer hamnar quadens sex vertexar sist i `vertices[]`, efter golvet –
de blir vertex 42 till 47:

```cpp
            // the transparent quad: vertices 42 to 47 - 1 x 1, upright (in the plane z = 0),
            // its left edge at x = 0 and its bottom at y = -0.5. v = 0 is the image's top row.
            { {  0.0f,  0.5f,  0.0f }, { 0.0f, 0.0f } },
            { {  0.0f, -0.5f,  0.0f }, { 0.0f, 1.0f } },
            { {  1.0f, -0.5f,  0.0f }, { 1.0f, 1.0f } },

            { {  0.0f,  0.5f,  0.0f }, { 0.0f, 0.0f } },
            { {  1.0f, -0.5f,  0.0f }, { 1.0f, 1.0f } },
            { {  1.0f,  0.5f,  0.0f }, { 1.0f, 0.0f } }
```

Det här är learnopengls `transparentVertices` oförändrade: learnopengl laddar de här bilderna utan att vända dem, och
Direct3D:s v = 0 är också bildens översta rad.

Gräs-texturen får plats 3 i heapen: heapen växer till `cbvSrvHeapDesc.NumDescriptors = 4;`, en medlem
`ComPtr<ID3D12Resource> m_transparentTexture;` håller texturen, och den laddas som de andra:

```cpp
    ComPtr<ID3D12Resource> transparentTextureUploadHeap;
    LoadTexture("grass.png", m_transparentTexture, transparentTextureUploadHeap, 3);
```

I `PopulateCommandList`, bredvid GPU-handtagen till de två andra texturerna:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE transparentTexture(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 3, m_cbvSrvDescriptorSize);
```

Varje gräsföremål ritas som en enda quad med gräs-texturen på. Det är ingen perfekt 3D-återgivning av gräs, men det är
mycket effektivare än att ladda och rita ett stort antal komplexa modeller. Med några knep, som slumpmässiga rotationer
och skalningar, kan du få ganska övertygande resultat med quads.

Efter golvet listar du positionerna (som de tidigare kapitlens `cubePositions`), pekar root-parameter 2 på
gräs-texturen och ritar quaden en gång per position:

```cpp
    // vegetation: the transparent texture, the quad's 6 vertices from vertex 42 on, at
    // each position
    XMFLOAT3 vegetation[] =
    {
        XMFLOAT3(-1.5f, 0.0f, -0.48f),
        XMFLOAT3( 1.5f, 0.0f,  0.51f),
        XMFLOAT3( 0.0f, 0.0f,  0.7f),
        XMFLOAT3(-0.3f, 0.0f, -2.3f),
        XMFLOAT3( 0.5f, 0.0f, -0.6f)
    };
    m_commandList->SetGraphicsRootDescriptorTable(2, transparentTexture);
    for (UINT i = 0; i < _countof(vegetation); i++)
    {
        model = XMMatrixTranslation(vegetation[i].x, vegetation[i].y, vegetation[i].z);
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        m_commandList->DrawInstanced(6, 1, 42, 0);
    }
```
:::

Gör nu den första uppgiften, **grass**, och tryck på **Build & run**. Fem quads står mellan och framför kuberna –
grässtråna finns där, men vart och ett sitter på en svart fyrkant som döljer allt bakom den.

Det beror på att {{api}} som standard inte vet vad det ska göra med alfavärden, eller när de ska kastas. Alfavärdet är
bara färgens fjärde komponent: shadern skriver ut det, och det skrivs till color buffern tillsammans med rött, grönt och
blått. De genomskinliga texlarna i `grass.png` är svarta, så svart är vad vi ser.

```quiz
Varför ritas gräs-quadarnas genomskinliga delar som svarta fyrkanter?
- [ ] Texturen laddades utan sin alfakanal
- [ ] Djuptestet kastar bort färgen hos genomskinliga texlar
- [x] Ingenting använder alfavärdet än: texlarnas färg (svart) skrivs till color buffern som vilken färg som helst
- [ ] Quadarna ritas före golvet, så bakgrunden syns igenom
---
Alfat når shadern som fjärde komponent, men varken shadern eller pipelinen gör något med det än så länge. De genomskinliga texlarna i `grass.png` är svarta, och deras färg ersätter helt enkelt det som fanns i color buffern.
```

Det är upp till oss att kasta de fragment som visar de genomskinliga delarna. {{shaderLanguage}} ger oss kommandot
`discard`, som (när det anropas) ser till att fragmentet inte bearbetas vidare och därmed inte hamnar i color buffern –
varken dess färg eller dess djup skrivs. Tack vare det kommandot kan vi kontrollera om ett fragment har ett alfavärde
under en viss tröskel och i så fall kasta det, som om det aldrig hade bearbetats:

:::opengl
```glsl
#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D texture1;

void main()
{
    vec4 texColor = texture(texture1, TexCoords);
    if(texColor.a < 0.1)
        discard;
    FragColor = texColor;
}
```

Här kontrollerar vi om den lästa texturfärgen har ett alfavärde under tröskeln `0.1` och kastar i så fall fragmentet.
Den här fragment shadern ser till att bara fragment som inte är (nästan) helt genomskinliga ritas. Kuberna och golvet
har alfa 1 överallt, så de påverkas inte.
:::
:::vulkan
I `shaders/blending.frag`:

```glsl
void main() {
    vec4 texColor = texture(texSampler, fragTexCoord);
    if (texColor.a < 0.1) {
        discard; // (almost) fully transparent: no colour, no depth for this fragment
    }
    outColor = texColor;
}
```

Här kontrollerar vi om den lästa texturfärgen har ett alfavärde under tröskeln `0.1` och kastar i så fall fragmentet.
Den här fragment shadern ser till att bara fragment som inte är (nästan) helt genomskinliga ritas. Kuberna och golvet
använder samma shader, men deras alfa är 1 överallt, så de påverkas inte.
:::
:::d3d12
HLSL har samma `discard`-sats. I stället för att lägga den i `PSMain`, som kuberna och golvet också använder, får de
genomskinliga föremålen en egen pixel shader i `blending.hlsl`:

```hlsl
// The pixel shader of the transparent objects: it samples with clampSampler and discards
// the pixels that are (almost) fully transparent - nothing is written for them.
float4 PSTransparent(PSInput input) : SV_TARGET
{
    float4 texColor = texture1.Sample(clampSampler, input.texCoord);
    if (texColor.a < 0.1f)
        discard;
    return texColor;
}
```

Här kontrollerar vi om den lästa texturfärgen har ett alfavärde under tröskeln `0.1` och kastar i så fall pixeln.
(HLSL:s `clip(texColor.a - 0.1f)` gör samma sak: den kastar pixeln när argumentet är negativt.) Lägg märke till
samplern: `clampSampler`, inte `wrapSampler` – mer om det strax.

I Direct3D 12 är pixel shadern en del av pipeline state-objektet, så en annan pixel shader betyder ett andra PSO. Det
är samma beskrivning som det första, med `PSTransparent` kompilerad och insatt i `psoDesc.PS`, och skapas direkt efter
`m_pipelineState`:

```cpp
        // The transparent objects: the same description with the pixel shader PSTransparent.
        ComPtr<ID3DBlob> transparentPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"blending.hlsl", nullptr, nullptr, "PSTransparent", "ps_5_0", compileFlags, 0, &transparentPixelShader, nullptr));

        psoDesc.PS = CD3DX12_SHADER_BYTECODE(transparentPixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_transparentPipelineState)));
```

med en medlem `ComPtr<ID3D12PipelineState> m_transparentPipelineState;`. Kommandolistan byter till det innan
växtligheten ritas – kuberna och golvet har redan ritats med `m_pipelineState`:

```cpp
    m_commandList->SetPipelineState(m_transparentPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, transparentTexture);
```
:::

Observera att när texturer läses vid sina kanter interpolerar {{api}} kantvärdena med nästa upprepning av texturen
(eftersom vi som standard har satt wrapping till repeat). Det brukar gå bra, men eftersom vi använder genomskinliga
värden får bildens överkant sitt genomskinliga värde interpolerat med nederkantens heltäckande färg. Resultatet blir en
svagt halvgenomskinlig färgad kant som du kan se runt din texturerade quad. För att undvika det sätter du texturens
wrapping till clamp to edge när du använder alfatexturer som inte ska upprepas:

:::opengl
I OpenGL hör wrapping-läget till texturobjektet. `loadTexture` sätter det för varje textur den laddar, så vi låter det
bero på formatet: RGBA-bilder clampas, de andra (golvets texturkoordinater går upp till 2) fortsätter att upprepas:

```cpp
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, format == GL_RGBA ? GL_CLAMP_TO_EDGE : GL_REPEAT); // for this tutorial: use GL_CLAMP_TO_EDGE to prevent semi-transparent borders. Due to interpolation it takes texels from next repeat
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, format == GL_RGBA ? GL_CLAMP_TO_EDGE : GL_REPEAT);
```

Gör nu uppgiften **discard**: shadern ovan och clampad wrapping.
:::
:::vulkan
I Vulkan hör wrapping-läget till samplern, inte till imagen. Därför fick gräset redan i förra uppgiften en egen
`transparentSampler` med `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`, medan kuberna och golvet behåller `textureSampler`
med `VK_SAMPLER_ADDRESS_MODE_REPEAT` (golvets texturkoordinater går upp till 2). Varje descriptor set parar ihop en
image med en sampler, så gräsets set använder den som clampar.

Gör nu uppgiften **discard**: shadern ovan.
:::
:::d3d12
I Direct3D 12 hör adresseringsläget till samplern, och vår sampler är en statisk sampler – en del av root
signaturen. Golvet behöver WRAP (dess texturkoordinater går upp till 2), så root signaturen får en andra statisk
sampler på register `s1` som clampar:

```cpp
        D3D12_STATIC_SAMPLER_DESC samplers[2] = {};
        ...
        // Sampler s1: the same, but texture coordinates outside 0..1 are clamped to the edge.
        // For the transparent textures: with WRAP, filtering at the quad's top edge would mix
        // in the texels of the image's bottom row (a semi-transparent border).
        samplers[1] = samplers[0];
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].ShaderRegister = 1;
```

(`rootSignatureDesc.Init` skickar redan med `_countof(samplers)`, så båda hamnar i root signaturen.) I shadern
deklareras den bredvid den första:

```hlsl
SamplerState wrapSampler : register(s0);
// The second static sampler: register s1, CLAMP (for the transparent textures).
SamplerState clampSampler : register(s1);
```

Gör nu uppgiften **discard**: samplern, `PSTransparent`, det andra PSO:t och anropet till `SetPipelineState`.
:::

Tryck på **Build & run**: bara grässtråna är kvar. Där de svarta fyrkanterna var ser du kuberna, golvet och bakgrunden
igen, och det finns ingen tunn linje längs quadarnas överkant.

```quiz
Varför behöver gräs-quadarna ett samplerläge som clampar mot kanten i stället för att upprepa?
- [ ] Texturer som upprepas kan inte ha en alfakanal
- [x] Med repeat blandar den linjära filtreringen vid quadens överkant in texlar från bildens motsatta (nedre) kant, som är ogenomskinliga, och en halvgenomskinlig linje dyker upp
- [ ] Clamp gör texturen mindre, så färre fragment kastas
---
Precis vid texturens kant tar filtret medelvärdet av närliggande texlar, och med repeat är grannen till översta raden den nedersta raden – gräsets ogenomskinliga rötter. Clamp upprepar i stället själva kanttexeln, som är genomskinlig.
```

## Blending

Att kasta fragment är bra och så, men det ger oss inte flexibiliteten att rita halvgenomskinliga bilder; antingen
ritar vi fragmentet eller så kastar vi det helt. För att rita bilder med olika grader av genomskinlighet måste vi slå
på *blending*.

Blending sker efter fragment shadern: färgen som shadern skriver ut – *källfärgen* (source) – kombineras med färgen som
redan finns i color buffern på den platsen – *målfärgen* (destination). Det görs med följande ekvation:

```text
C_result = C_source * F_source + C_destination * F_destination
```

- `C_source`: källans färgvektor. Det är fragment shaderns färgutdata.
- `C_destination`: målets färgvektor. Det är den färgvektor som just nu ligger i color buffern.
- `F_source`: källfaktorn. Bestämmer hur alfavärdet påverkar källfärgen.
- `F_destination`: målfaktorn. Bestämmer hur alfavärdet påverkar målfärgen.

När fragment shadern har körts och alla tester har passerats släpps den här blendingekvationen lös på fragmentets
färgutdata och på det som just nu ligger i color buffern. Käll- och målfärgerna sätts av GPU:n, men käll- och
målfaktorerna kan vi välja själva.

Vi börjar med ett enkelt exempel: vi har två kvadrater och vill rita den halvgenomskinliga gröna kvadraten ovanpå den
röda. Den röda kvadraten blir målfärgen (och ska alltså ligga först i color buffern), och nu ska vi rita den gröna
kvadraten över den röda. Den gröna kvadraten har färgen (0.0, 1.0, 0.0) med alfa 0.6, den röda är (1.0, 0.0, 0.0).

Frågan blir då: vad sätter vi faktorerna till? Vi vill åtminstone multiplicera den gröna kvadraten med dess alfavärde,
så vi sätter `F_source` lika med källfärgsvektorns alfavärde, alltså `0.6`. Då är det rimligt att låta målkvadraten
bidra med resten. Om den gröna kvadraten står för 60 % av den slutliga färgen vill vi att den röda står för 40 %,
alltså `1.0 - 0.6`. Vi sätter därför `F_destination` lika med ett minus källfärgsvektorns alfavärde. Ekvationen blir
då:

```text
C_result = (0.0, 1.0, 0.0) * 0.6 + (1.0, 0.0, 0.0) * (1 - 0.6) = (0.4, 0.6, 0.0)
```

Resultatet är att de kombinerade kvadratfragmenten får en färg som är 60 % grön och 40 % röd: en smutsig, brunaktig
färg.

```quiz
Med `F_source` = källans alfa och `F_destination` = 1 − källans alfa ritas ett vitt fragment (1.0, 1.0, 1.0) med alfa 0.25 över en svart color buffer (0.0, 0.0, 0.0). Vilken färg hamnar i color buffern?
- [ ] (1.0, 1.0, 1.0)
- [ ] (0.75, 0.75, 0.75)
- [ ] (0.0, 0.0, 0.0)
- [x] (0.25, 0.25, 0.25)
---
`(1, 1, 1) * 0.25 + (0, 0, 0) * (1 - 0.25) = (0.25, 0.25, 0.25)`: en fjärdedel vitt, tre fjärdedelar svart.
```

Den resulterande färgen lagras sedan i color buffern och ersätter den tidigare färgen. Hur säger vi då åt {{api}} att
använda faktorer som de här?

:::opengl
Blending är en del av OpenGL:s globala tillstånd. Det är avstängt som standard, så först slår vi på det:

```cpp
glEnable(GL_BLEND);
```

Funktionen `glBlendFunc(GLenum sfactor, GLenum dfactor)` tar två parametrar som anger valet för käll- och målfaktorn.
OpenGL har definierat en hel del alternativ, och vi listar de vanligaste nedan. Observera att den konstanta
färgvektorn `C_constant` kan sättas separat med funktionen `glBlendColor`.

| Alternativ | Värde |
| --- | --- |
| `GL_ZERO` | Faktorn är lika med 0. |
| `GL_ONE` | Faktorn är lika med 1. |
| `GL_SRC_COLOR` | Faktorn är lika med källans färgvektor `C_source`. |
| `GL_ONE_MINUS_SRC_COLOR` | Faktorn är lika med 1 minus källans färgvektor: 1 − `C_source`. |
| `GL_DST_COLOR` | Faktorn är lika med målets färgvektor `C_destination`. |
| `GL_ONE_MINUS_DST_COLOR` | Faktorn är lika med 1 minus målets färgvektor: 1 − `C_destination`. |
| `GL_SRC_ALPHA` | Faktorn är lika med alfakomponenten i källans färgvektor. |
| `GL_ONE_MINUS_SRC_ALPHA` | Faktorn är lika med 1 − alfa för källans färgvektor. |
| `GL_DST_ALPHA` | Faktorn är lika med alfakomponenten i målets färgvektor. |
| `GL_ONE_MINUS_DST_ALPHA` | Faktorn är lika med 1 − alfa för målets färgvektor. |
| `GL_CONSTANT_COLOR` | Faktorn är lika med den konstanta färgvektorn `C_constant`. |
| `GL_ONE_MINUS_CONSTANT_COLOR` | Faktorn är lika med 1 − den konstanta färgvektorn. |
| `GL_CONSTANT_ALPHA` | Faktorn är lika med alfakomponenten i den konstanta färgvektorn. |
| `GL_ONE_MINUS_CONSTANT_ALPHA` | Faktorn är lika med 1 − alfa för den konstanta färgvektorn. |

För att få resultatet från vårt lilla exempel med två kvadrater vill vi ta källfärgsvektorns alfa som källfaktor och
1 − alfa för samma färgvektor som målfaktor. Med `glBlendFunc` blir det:

```cpp
glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
```

Det går också att ange olika alternativ för RGB- och alfakanalen var för sig med `glBlendFuncSeparate`:

```cpp
glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ZERO);
```

Den här funktionen sätter RGB-komponenterna som tidigare, men låter bara källans alfavärde påverka den resulterande
alfakomponenten.

OpenGL ger oss ännu mer flexibilitet genom att låta oss byta operatorn mellan käll- och måldelen av ekvationen. Just nu
adderas käll- och målkomponenterna, men vi kan också subtrahera dem om vi vill. `glBlendEquation(GLenum mode)` låter
oss ange operationen och har 5 möjliga alternativ:

- `GL_FUNC_ADD`: standardvärdet, adderar färgerna: `C_result = Src + Dst`.
- `GL_FUNC_SUBTRACT`: subtraherar färgerna: `C_result = Src − Dst`.
- `GL_FUNC_REVERSE_SUBTRACT`: subtraherar färgerna, men i omvänd ordning: `C_result = Dst − Src`.
- `GL_MIN`: tar komponentvis minimum av färgerna: `C_result = min(Dst, Src)`.
- `GL_MAX`: tar komponentvis maximum av färgerna: `C_result = max(Dst, Src)`.

Oftast kan vi helt enkelt hoppa över anropet till `glBlendEquation`, eftersom `GL_FUNC_ADD` är den ekvation man vill ha
för de flesta operationer, men om du verkligen vill gå din egen väg kan någon av de andra passa dig.

Precis som djuptestet är blending globalt tillstånd: när det väl är påslaget gäller det för varje ritanrop tills du
ändrar det. Kuberna och golvet blendas också – men deras alfa är 1, så `src * 1 + dst * 0` är helt enkelt deras egen
färg.
:::
:::vulkan
I Vulkan är blending inte globalt tillstånd utan en del av grafikpipelinen, i steget *color blending* som du fyllde i
när du skapade din första pipeline (kapitlet *Fixed functions* i vulkan-tutorial). Per färgattachment avgör en
`VkPipelineColorBlendAttachmentState` vad som händer; för varje fragment beräknar den:

```text
if (blendEnable) {
    finalColor.rgb = (srcColorBlendFactor * newColor.rgb) <colorBlendOp> (dstColorBlendFactor * oldColor.rgb);
    finalColor.a = (srcAlphaBlendFactor * newColor.a) <alphaBlendOp> (dstAlphaBlendFactor * oldColor.a);
} else {
    finalColor = newColor;
}
```

`newColor` är källan, `oldColor` målet. Hittills var `blendEnable` `VK_FALSE`, så den nya färgen ersatte bara den
gamla. Faktorerna är `VkBlendFactor`-värden; de vanligaste:

| Alternativ | Värde |
| --- | --- |
| `VK_BLEND_FACTOR_ZERO` | Faktorn är lika med 0. |
| `VK_BLEND_FACTOR_ONE` | Faktorn är lika med 1. |
| `VK_BLEND_FACTOR_SRC_COLOR` | Faktorn är lika med källans färgvektor `C_source`. |
| `VK_BLEND_FACTOR_ONE_MINUS_SRC_COLOR` | Faktorn är lika med 1 − `C_source`. |
| `VK_BLEND_FACTOR_DST_COLOR` | Faktorn är lika med målets färgvektor `C_destination`. |
| `VK_BLEND_FACTOR_ONE_MINUS_DST_COLOR` | Faktorn är lika med 1 − `C_destination`. |
| `VK_BLEND_FACTOR_SRC_ALPHA` | Faktorn är lika med alfakomponenten i källfärgen. |
| `VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA` | Faktorn är lika med 1 − källfärgens alfa. |
| `VK_BLEND_FACTOR_DST_ALPHA` | Faktorn är lika med alfakomponenten i målfärgen. |
| `VK_BLEND_FACTOR_ONE_MINUS_DST_ALPHA` | Faktorn är lika med 1 − målfärgens alfa. |
| `VK_BLEND_FACTOR_CONSTANT_COLOR` | Faktorn är lika med den konstanta färgen `C_constant`. |
| `VK_BLEND_FACTOR_ONE_MINUS_CONSTANT_COLOR` | Faktorn är lika med 1 − den konstanta färgen. |
| `VK_BLEND_FACTOR_CONSTANT_ALPHA` | Faktorn är lika med alfakomponenten i den konstanta färgen. |
| `VK_BLEND_FACTOR_ONE_MINUS_CONSTANT_ALPHA` | Faktorn är lika med 1 − den konstanta färgens alfa. |

Den konstanta färgen är `blendConstants` i `VkPipelineColorBlendStateCreateInfo` (eller, med
`VK_DYNAMIC_STATE_BLEND_CONSTANTS`, något du sätter under inspelningen med `vkCmdSetBlendConstants`). Operatorerna är
`VK_BLEND_OP_ADD`, `VK_BLEND_OP_SUBTRACT`, `VK_BLEND_OP_REVERSE_SUBTRACT`, `VK_BLEND_OP_MIN` och `VK_BLEND_OP_MAX` –
`ADD` är vad nästan varje effekt använder.

Vulkan tar alltid separata faktorer för färg- och alfakanalen (OpenGL:s `glBlendFuncSeparate`). För vårt exempel med
två kvadrater – källans alfa för källan, ett minus det för målet – är det här vulkan-tutorials uppsättning för
alpha blending, i `createPipeline()`:

```cpp
        // alpha blending: colour = src.rgb * src.a + dst.rgb * (1 - src.a)
        colorBlendAttachment.blendEnable = VK_TRUE;
        colorBlendAttachment.srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA;
        colorBlendAttachment.dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA;
        colorBlendAttachment.colorBlendOp = VK_BLEND_OP_ADD;
        colorBlendAttachment.srcAlphaBlendFactor = VK_BLEND_FACTOR_ONE;
        colorBlendAttachment.dstAlphaBlendFactor = VK_BLEND_FACTOR_ZERO;
        colorBlendAttachment.alphaBlendOp = VK_BLEND_OP_ADD;
```

Färgkanalerna blandas som i exemplet; alfakanalen tar helt enkelt källans alfa (`1 * src.a + 0`). Det spelar ingen roll
för bilden, eftersom fönstret bara visar RGB-kanalerna.

Vårt projekt har en enda pipeline för allt, så kuberna och golvet blendas också – men deras alfa är 1, så
`src * 1 + dst * 0` är helt enkelt deras egen färg. (Du kan också skapa en andra pipeline med blending bara för de
genomskinliga föremålen; en pipeline är fast när den väl är skapad, så tillstånd som det här kan inte slås av och på
mellan ritanrop som i OpenGL, utom de delar du deklarerar som dynamiska.)
:::
:::d3d12
I Direct3D 12 är blending en del av pipeline state-objektet, i output mergerns blend state (`psoDesc.BlendState`).
Per render target avgör en `D3D12_RENDER_TARGET_BLEND_DESC` i `BlendState.RenderTarget[0]` vad som händer:

```text
result.rgb = (SrcBlend * source.rgb) <BlendOp> (DestBlend * destination.rgb)
result.a   = (SrcBlendAlpha * source.a) <BlendOpAlpha> (DestBlendAlpha * destination.a)
```

`CD3DX12_BLEND_DESC(D3D12_DEFAULT)` sätter `BlendEnable = FALSE` (och `SrcBlend = ONE`, `DestBlend = ZERO`), så hittills
har pixel shaderns färg bara ersatt render targetens. Faktorerna är `D3D12_BLEND`-värden; Direct3D kallar
"ett minus" för *INV*:

| Alternativ | Värde |
| --- | --- |
| `D3D12_BLEND_ZERO` | Faktorn är lika med 0. |
| `D3D12_BLEND_ONE` | Faktorn är lika med 1. |
| `D3D12_BLEND_SRC_COLOR` | Faktorn är lika med källans färgvektor `C_source`. |
| `D3D12_BLEND_INV_SRC_COLOR` | Faktorn är lika med 1 − `C_source`. |
| `D3D12_BLEND_DEST_COLOR` | Faktorn är lika med målets färgvektor `C_destination`. |
| `D3D12_BLEND_INV_DEST_COLOR` | Faktorn är lika med 1 − `C_destination`. |
| `D3D12_BLEND_SRC_ALPHA` | Faktorn är lika med alfakomponenten i källfärgen. |
| `D3D12_BLEND_INV_SRC_ALPHA` | Faktorn är lika med 1 − källfärgens alfa. |
| `D3D12_BLEND_DEST_ALPHA` | Faktorn är lika med alfakomponenten i målfärgen. |
| `D3D12_BLEND_INV_DEST_ALPHA` | Faktorn är lika med 1 − målfärgens alfa. |
| `D3D12_BLEND_BLEND_FACTOR` | Faktorn är lika med den konstanta blendfaktorn. |
| `D3D12_BLEND_INV_BLEND_FACTOR` | Faktorn är lika med 1 − den konstanta blendfaktorn. |

Den konstanta blendfaktorn är inte en del av PSO:t: du sätter den på kommandolistan med `OMSetBlendFactor`. För
`SrcBlendAlpha` och `DestBlendAlpha` är alternativen som slutar på `_COLOR` inte tillåtna. Operatorerna är
`D3D12_BLEND_OP_ADD`, `D3D12_BLEND_OP_SUBTRACT`, `D3D12_BLEND_OP_REV_SUBTRACT`, `D3D12_BLEND_OP_MIN` och
`D3D12_BLEND_OP_MAX` – `ADD` är vad nästan varje effekt använder.

För vårt exempel med två kvadrater – källans alfa för källan, ett minus det för målet – sätter vi blend state för det
genomskinliga PSO:t innan det skapas. OpenGL:s `glBlendFunc` sätter samma faktorer för färg- och alfakanalen, så det
gör vi också:

```cpp
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(transparentPixelShader.Get());
        // Blending: result = source colour * source alpha + destination colour * (1 - source
        // alpha) - the pixel's colour mixed with the colour already in the render target.
        // (OpenGL's glBlendFunc sets the factors of the colour and of the alpha channel.)
        psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;
        psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_INV_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].BlendOp = D3D12_BLEND_OP_ADD;
        psoDesc.BlendState.RenderTarget[0].SrcBlendAlpha = D3D12_BLEND_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].DestBlendAlpha = D3D12_BLEND_INV_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].BlendOpAlpha = D3D12_BLEND_OP_ADD;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_transparentPipelineState)));
```

Eftersom vi redan har ett andra PSO för de genomskinliga föremålen slås blending bara på där. I OpenGL är
`glEnable(GL_BLEND)` globalt och gäller även för kuberna och golvet – vilket inte gör någon skillnad, eftersom deras
alfa är 1 och `src * 1 + dst * 0` helt enkelt är deras egen färg.
:::

:::opengl
```quiz
Projektet anropar `glEnable(GL_BLEND)` och `glBlendFunc` en gång, före renderingsloopen. Varför ser de ogenomskinliga kuberna och golvet fortfarande exakt likadana ut?
- [ ] OpenGL blendar bara ritanrop som använder en textur med alfakanal
- [ ] `glBlendFunc` gäller bara för ritanropet direkt efter
- [x] Blending är globalt tillstånd och gäller även dem, men deras alfa är 1: `src * 1 + dst * 0` är deras egen färg
---
OpenGL:s tillståndsmaskin håller blending påslaget för varje följande ritanrop. Med alfa 1 är källfaktorn 1 och målfaktorn 0, så blending ändrar ingenting för ogenomskinliga ytor.
```
:::
:::vulkan
```quiz
Kuberna, golvet och fönstren ritas alla med samma pipeline, som har `blendEnable = VK_TRUE`. Varför ser de ogenomskinliga kuberna och golvet fortfarande exakt likadana ut?
- [ ] Vulkan hoppar över blending för ritanrop som binder ett descriptor set utan alfakanal
- [ ] `vkCmdBindDescriptorSets` återställer blend state för varje föremål
- [x] De blendas också, men deras alfa är 1: `src * 1 + dst * 0` är deras egen färg
---
Blend state hör till pipelinen och gäller för varje ritanrop som spelas in med den. Med alfa 1 är källfaktorn 1 och målfaktorn 0, så blending ändrar ingenting för ogenomskinliga ytor.
```
:::
:::d3d12
```quiz
Varför slår projektet bara på blending i `m_transparentPipelineState`, och vad skulle ändras om kubernas PSO också blendade?
- [ ] Det måste det: ett PSO med blending kan inte ha ett djuptest
- [ ] Kuberna skulle bli halvgenomskinliga
- [x] Blend state är en del av PSO:t, och de genomskinliga föremålen har redan ett eget; för kuberna skulle ingenting ändras, eftersom deras alfa är 1 och `src * 1 + dst * 0` är deras egen färg
---
Till skillnad från OpenGL:s globala `glEnable(GL_BLEND)` låser Direct3D 12 blend state när PSO:t skapas. Att slå på det där det behövs är det naturliga valet, men att blenda ogenomskinliga pixlar med de här faktorerna ger samma resultat.
```
:::

## Rita halvgenomskinliga texturer

Nu när vi vet hur {{api}} fungerar när det gäller blending är det dags att sätta våra kunskaper på prov genom att lägga
till några halvgenomskinliga fönster. Vi använder samma scen som i början av kapitlet, men i stället för en
gräs-textur använder vi nu den genomskinliga fönstertexturen `window.png`.

:::opengl
Först slår vi under initieringen på blending och sätter rätt blendingfunktion, bredvid djuptestet:

```cpp
    glDepthFunc(GL_LESS); // pass when the fragment is closer than the stored depth (OpenGL's default)
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA); // result = src * src.alpha + dst * (1 - src.alpha)
```

Sedan laddar vi `window.png` i stället för `grass.png` och, eftersom det nu är fönster, byter namn på vektorn till
`windows` (och dess kommentar till `// transparent window locations`); ritloopen (`// windows`) går över `windows`.

Eftersom vi har slagit på blending behöver vi inte kasta fragment, så vi skulle kunna återställa fragment shadern till
sin ursprungliga version. I projektet får `discard` stå kvar: ingen texel i fönstret ligger under 0.1, så den slår
aldrig till.
:::
:::vulkan
I `createPipeline()` ersätter du `colorBlendAttachment.blendEnable = VK_FALSE;` med uppsättningen för alpha blending
ovan. Sedan laddar du `"textures/window.png"` i stället för `"textures/grass.png"` och, eftersom det nu är fönster,
byter namn på `vegetation` till `windows` (med kommentaren `// transparent window locations`); ritloopen
(`// windows`) går över `windows`.

Eftersom vi har slagit på blending behöver vi inte kasta fragment, så vi skulle kunna återställa fragment shadern till
sin ursprungliga version. I projektet får `discard` stå kvar: ingen texel i fönstret ligger under 0.1, så den slår
aldrig till.
:::
:::d3d12
Sätt blend state för `m_transparentPipelineState` som ovan. Ladda sedan `window.png` i stället för `grass.png` och,
eftersom det nu är fönster, byt namn på `vegetation` till `windows`; loopen går över `_countof(windows)`.

Eftersom vi har slagit på blending behöver vi inte kasta pixlar, så vi skulle kunna gå tillbaka till en pixel shader
utan `discard`. I projektet behåller `PSTransparent` den: ingen texel i fönstret ligger under 0.1, så den slår aldrig
till – och den clampande samplern är fortfarande vad fönstren behöver.
:::

Gör nu uppgiften **blend** och tryck på **Build & run**. Fem rödtonade fönster står i scenen: kuben, golvet och
bakgrunden syns genom glaset, mörkare och rödare, medan ramen och dess kors är ogenomskinliga. Över bakgrunden blandas
glasets färg med clear-färgens mörkgrå; över marmorn blir den mycket ljusare.

Om du tittar närmare kanske du ändå märker att något är fel. Titta på det närmaste fönstret, framför mitten: det står
ett andra fönster bakom det, delvis skymt (på (0.5, 0, -0.6)). Genom det närmaste fönstrets glas ser du golvet och
bakgrunden – men inte det andra fönstret. De genomskinliga delarna av det första fönstret skymmer fönstren bakom det.
Varför händer det?

Orsaken är att djuptestning fungerar lite knepigt tillsammans med blending. När depth buffern skrivs bryr sig
djuptestet inte om huruvida fragmentet är genomskinligt eller inte, så de genomskinliga delarna skrivs till depth
buffern som vilket värde som helst. Resultatet är att fönstren i bakgrunden djuptestas som vilket ogenomskinligt
föremål som helst, utan hänsyn till genomskinligheten. Trots att den genomskinliga delen borde visa fönstren bakom
den, kastar djuptestet dem.

I vår lista är det närmaste fönstret, (0, 0, 0.7), det tredje, och det som står bakom, (0.5, 0, -0.6), det femte. Det
nära fönstret ritas alltså först: dess glas blendas med golvet och bakgrunden, och dess djup lagras. När det bortre
fönstret kommer misslyckas varje fragment bakom glaset med djuptestet – det ligger längre bort än det lagrade djupet –
och kastas innan det hinner blendas.

```quiz
Varför saknas fönstret på (0.5, 0, -0.6) bakom det närmaste fönstrets glas?
- [ ] Blending blandar bara ett fragment med clear-färgen, inte med andra fönster
- [x] Det närmaste fönstret ritas först och skriver sitt djup; det bortre fönstrets fragment misslyckas sedan med djuptestet och når aldrig blendingen
- [ ] `discard` i shadern kastar fragment som ligger bakom glas
- [ ] Två blendade ytor tar ut varandra
---
Djuptestet känner inte till genomskinlighet: glaset lagrar sitt djup som en ogenomskinlig yta. Allt som ritas senare bakom det förkastas – så ordningen vi ritar genomskinliga föremål i spelar roll.
```

Vi kan alltså inte bara rita fönstren hur vi vill och vänta oss att depth buffern löser alla problem åt oss; det är
också här blending blir lite otrevligt. För att fönstren ska visa fönstren bakom dem måste vi rita fönstren i
bakgrunden först. Det betyder att vi själva måste sortera fönstren från längst bort till närmast och rita dem i den
ordningen.

Observera att med helt genomskinliga föremål som grässtråna har vi möjligheten att kasta de genomskinliga fragmenten i
stället för att blenda dem, vilket besparar oss en del av den här huvudvärken (inga djupproblem).

## Bryt inte ordningen

För att blending ska fungera för flera föremål måste vi rita det mest avlägsna föremålet först och det närmaste sist.
De vanliga föremålen utan blending kan fortfarande ritas som vanligt med hjälp av depth buffern, så de behöver inte
sorteras. Vi måste däremot se till att de ritas först, före de (sorterade) genomskinliga föremålen. När man ritar en
scen med både ogenomskinliga och genomskinliga föremål ser upplägget oftast ut så här:

1. Rita alla ogenomskinliga föremål först.
2. Sortera alla genomskinliga föremål.
3. Rita alla genomskinliga föremål i sorterad ordning.

Ett sätt att sortera de genomskinliga föremålen är att ta fram föremålets avstånd sett från betraktaren. Det får vi
genom avståndet mellan kamerans positionsvektor och föremålets positionsvektor. Vi lagrar sedan avståndet tillsammans
med motsvarande positionsvektor i datastrukturen `map` från C++-standardbiblioteket (lägg till `#include <map>`). En
`map` sorterar automatiskt sina värden efter nycklarna, så när vi har lagt in alla positioner med avståndet som nyckel
är de automatiskt sorterade efter avstånd:

:::opengl
```cpp
        // sort the transparent windows before rendering
        // ---------------------------------------------
        std::map<float, glm::vec3> sorted;
        for (unsigned int i = 0; i < windows.size(); i++)
        {
            float distance = glm::length(cameraPos - windows[i]);
            sorted[distance] = windows[i];
        }
```

Det här hamnar i renderingsloopen, direkt efter `processInput(window);` – kameran kan röra sig, så avstånden måste
beräknas på nytt varje bildruta.
:::
:::vulkan
```cpp
        // sort the transparent windows before rendering
        std::map<float, glm::vec3> sorted;
        for (unsigned int i = 0; i < windows.size(); i++) {
            float distance = glm::length(cameraPos - windows[i]);
            sorted[distance] = windows[i];
        }
```

Det här hamnar i `recordCommandBuffer()`, direkt innan fönstren ritas. Command buffern spelas in på nytt varje
bildruta, så sorteringen följer med när kameran rör sig.
:::
:::d3d12
```cpp
    // sort the transparent windows before rendering: a std::map keeps its keys (the
    // distances to the camera) in order
    std::map<float, XMFLOAT3> sorted;
    for (UINT i = 0; i < _countof(windows); i++)
    {
        float distance = XMVectorGetX(XMVector3Length(cameraPos - XMLoadFloat3(&windows[i])));
        sorted[distance] = windows[i];
    }
```

`cameraPos` är en `XMVECTOR`, så positionen läses in i en sådan med `XMLoadFloat3`; `XMVector3Length` returnerar
längden i varje komponent av en vektor, och `XMVectorGetX` plockar ut den. Det här hamnar i `PopulateCommandList`,
direkt efter arrayen `windows` – kommandolistan spelas in på nytt varje bildruta, så sorteringen följer med när kameran
rör sig.
:::

Resultatet är en sorterad behållare som lagrar varje fönsterposition efter dess avståndsnyckel, från kortast till
längst avstånd.

Sedan, när vi ritar, tar vi den här gången kartans värden i omvänd ordning (från längst bort till närmast) och ritar
motsvarande fönster i rätt ordning:

:::opengl
```cpp
        // windows (from furthest to nearest)
        glBindVertexArray(transparentVAO);
        glBindTexture(GL_TEXTURE_2D, transparentTexture);
        for (std::map<float, glm::vec3>::reverse_iterator it = sorted.rbegin(); it != sorted.rend(); ++it)
        {
            model = glm::mat4(1.0f);
            model = glm::translate(model, it->second);
            shader.setMat4("model", model);
            glDrawArrays(GL_TRIANGLES, 0, 6);
        }
```
:::
:::vulkan
```cpp
        // windows (from furthest to nearest)
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &transparentDescriptorSet, 0, nullptr);
        for (std::map<float, glm::vec3>::reverse_iterator it = sorted.rbegin(); it != sorted.rend(); ++it) {
            model = glm::mat4(1.0f);
            model = glm::translate(model, it->second);
            constants.model = model;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
            vkCmdDraw(commandBuffer, 6, 1, 42, 0); // the quad's 6 vertices start at vertex 42
        }
```
:::
:::d3d12
```cpp
    // windows (from furthest to nearest)
    m_commandList->SetPipelineState(m_transparentPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, transparentTexture);
    for (std::map<float, XMFLOAT3>::reverse_iterator it = sorted.rbegin(); it != sorted.rend(); ++it)
    {
        model = XMMatrixTranslation(it->second.x, it->second.y, it->second.z);
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        m_commandList->DrawInstanced(6, 1, 42, 0);
    }
```
:::

Vi tar en omvänd iterator (reverse iterator) från `map`:en för att gå igenom elementen i omvänd ordning och flyttar
sedan varje fönster-quad till motsvarande fönsterposition. Det här relativt enkla sättet att sortera genomskinliga
föremål löser det tidigare problemet. Från startpositionen blir ordningen (-0.3, 0, -2.3), (-1.5, 0, -0.48),
(0.5, 0, -0.6), (1.5, 0, 0.51) och sist (0, 0, 0.7).

Gör nu den sista uppgiften, **sort**, och tryck på **Build & run**. Fönstret bakom det närmaste syns nu genom dess
glas: där de överlappar tittar du genom två lager glas, och färgen där är ett djupare rött än genom ett lager.
Eftersom sorteringen körs varje bildruta förblir ordningen rätt när kameran rör sig.

```quiz
Varför ritar upplägget ovan alla ogenomskinliga föremål före de sorterade genomskinliga?
- [ ] Ogenomskinliga föremål måste också sorteras framifrån och bakåt, och den sorteringen måste köras först
- [ ] Blending är bara möjligt efter att depth buffern har rensats
- [x] Ett genomskinligt fragment blendas med det som redan finns i color buffern, så allt som ska synas bakom det måste finnas där först
---
Blending kan bara blanda in färger som redan finns i color buffern. Om en ogenomskinlig kub ritades efter ett fönster framför den, skulle fönstrets fragment redan ha blendats med bakgrunden, och kubens fragment – bakom fönstret – skulle sedan misslyckas med djuptestet.
```

Även om det här sättet att sortera föremål efter avstånd fungerar bra i just det här fallet tar det inte hänsyn till
rotationer, skalningar eller andra transformationer, och föremål med konstiga former behöver ett annat mått än bara en
positionsvektor. Observera också att en `map` bara har ett värde per nyckel: två fönster på exakt samma avstånd skulle
bli ett.

Att sortera föremålen i en scen är en svår uppgift som i hög grad beror på vilken sorts scen du har, för att inte tala
om den extra beräkningskraft det kostar. Att rita en hel scen med både heltäckande och genomskinliga föremål är inte
helt enkelt. Det finns mer avancerade tekniker som *order independent transparency*, men de ligger utanför det här
kapitlet. Tills vidare får du leva med vanlig blending av dina föremål, men om du är försiktig och känner till
begränsningarna kan du få till ganska hyfsade blending-lösningar.

I nästa kapitel tittar vi på ytterligare en bit fast funktionalitet: *face culling*, som hoppar över de trianglar som
vänder sig bort från kameran.
