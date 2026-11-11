# Tessellering: höjdkarta

De följande två kapitlen följer learnopengls gästartiklar om **tessellering**: att låta GPU:n själv dela upp ett grovt
mesh i ett fint. För att se varför det är värt att ha gör det här första kapitlet det på det gamla sättet: ett landskap
som byggs helt på CPU:n, en vertex för varje pixel i en höjdkarta, skickat till GPU:n som ett enda stort, tätt mesh. Nästa
kapitel, *Tessellering*, ritar samma landskap från ett mesh med bara några hundra vertexar och låter tesselleringsstegen
lägga till detaljerna – och anpassa dem efter avståndet till kameran.

Inget i kapitlet är nytt för GPU:n: en vertex buffer, en index buffer, triangle strips och en fragment shader som färgar
efter höjd. Det fungerar likadant i alla API:er; det intressanta är meshet och vad det kostar.

## Höjdkartor

En **höjdkarta** är en gråskalebild som läses som ett landskap: varje pixel är en punkt i ett rutnät, och dess gråvärde
säger hur högt marken ligger där – svart är lågt, vitt är högt. Höjdkartor är det vanliga sättet att lagra och redigera
terräng: en grafiker målar kullar och dalar, eller ett program genererar dem ur brus, eller så kommer de från verkliga
höjddata. learnopengl använder en stor karta över verklig terräng, 2,6 tusen pixlar på varje sida. Kursen använder en
egen, mindre karta – `heightmap.png`, 256 × 256 pixlar med en grå kanal på 8 bitar, genererad av kursens skript
`textures/make_guest.py` ur seedat fraktalt brus: böljande kullar, en kam av toppar längs bildens överkant, en floddal från
vänsterkanten ned till underkanten, och en sjö nere till höger. Den mindre storleken håller rutnätet på 65 536 vertexar,
vilket den inbyggda simulatorn klarar att rita.

Kameran tittar på hela landskapet framifrån och ovanifrån: från (0, 190, 290), vriden 35° nedåt, med det bortre planet på
1000 (learnopengl börjar på en punkt över sin mycket större karta). Fragment shadern färgar varje punkt efter dess höjd.

:::opengl
Projektet är ett enkelt OpenGL 3.3-program: `main.cpp`, kursens klass `Shader`, `cpuheight.vs` / `.fs` (learnopengls
shaders `8.3.cpuheight`) och `heightmap.png`. Starten öppnar fönstret och rensar det; det finns inget att rita ännu.
:::
:::vulkan
Projektet är ett enkelt Vulkan-program med en pipeline för `shaders/cpuheight.vert` / `.frag`, kamerans matriser i en
uniform buffer och modellmatrisen som push constant. Startens `loadHeightMap()` är tom, och `vertexBuffer` och
`indexBuffer` förblir `VK_NULL_HANDLE` – Vulkan kan inte skapa en buffer med storleken 0, och att förstöra ett
null-handtag gör ingenting. `createVertexBuffer()` och `createIndexBuffer()` är funktionerna med staging buffer från
kapitlen om modellinläsning; uppgifterna anropar dem när datan finns. Höjdkartan läses bara på CPU:n, så ingen textur
skapas för den.
:::
:::d3d12
Projektet är ett enkelt Direct3D 12-program med ett pipeline state-objekt för `cpuheight.hlsl`, kamerans matriser i en
constant buffer och ett tomt avsnitt i `LoadAssets` för terrängen. Ett Windows-program har ingen konsol, så där
learnopengl skriver ut med `std::cout` skriver kursen till felsökarens utdatafönster med `OutputDebugStringA` (efter
`snprintf` till en buffer).
:::

Kommentarerna `// TODO:` visar var din kod ska in; **Build & run** (Ctrl+Enter) kompilerar programmet och kör det i den
inbyggda simulatorn: ett tomt, mörkt fönster.

## Att läsa in höjdkartan

stb_image läser in kartan; det sista argumentet 0 ber om filens eget antal kanaler – 1 här, en gråskalebild. Till
skillnad från texturerna i de tidigare kapitlen vänds bilden inte: dess första rad är bildens överkant, och kursen lägger
den raden längst bak i terrängen, så att terrängen ovanifrån ser ut som bilden. (learnopengls två terrängdemos skiljer sig
både i vändningen och i orienteringen; kursen använder samma orientering i båda kapitlen, så att de visar samma landskap
åt samma håll.)

:::opengl
```cpp
    int width, height, nrChannels;
    unsigned char *data = stbi_load("heightmap.png", &width, &height, &nrChannels, 0);
    if (data)
    {
        std::cout << "Loaded heightmap of size " << height << " x " << width << std::endl;
    }
    else
    {
        std::cout << "Failed to load texture" << std::endl;
        return -1;
    }
```
:::
:::vulkan
`loadHeightMap()` läser in `textures/heightmap.png` med `stbi_load(path, &width, &height, &nrChannels, 0)`, skriver ut
storleken och kastar ett `std::runtime_error` om filen inte går att läsa in.
:::
:::d3d12
`LoadAssets` anropar `stbi_load` med 0 kanaler och skriver storleken till felsökarens utdata:

```cpp
        snprintf(text, sizeof(text), "Loaded heightmap of size %d x %d\n", height, width);
        OutputDebugStringA(text);
```
:::

Gör nu den första uppgiften, **load-heightmap**. Ingenting ritas ännu; programmet rapporterar en karta på 256 × 256.

## En vertex per pixel

Varje pixel blir en vertex. Dess kolumn `j` ger x-koordinaten och dess rad `i` z-koordinaten, båda centrerade kring
origo, så rutnätet går från −128 till 127 i x och z. Pixelns gråvärde, 0 till 255, ger höjden: learnopengl skalar det med
`yScale = 64 / 256` och flyttar det nedåt med `yShift = 16`, så höjderna går från −16 till ungefär 48:

:::opengl
```cpp
    std::vector<float> vertices;
    float yScale = 64.0f / 256.0f, yShift = 16.0f; // apply a scale and a shift to the height data
    unsigned bytePerPixel = nrChannels;
    for (int i = 0; i < height; i++)
    {
        for (int j = 0; j < width; j++)
        {
            unsigned char* pixelOffset = data + (j + width * i) * bytePerPixel;
            unsigned char y = pixelOffset[0];

            // vertex: column j along x, row i along z (the image's top row at the back)
            vertices.push_back(-width / 2.0f + width * j / (float)width);   // vx
            vertices.push_back((int)y * yScale - yShift);                    // vy
            vertices.push_back(-height / 2.0f + height * i / (float)height); // vz
        }
    }
```

Efter loopen frigörs bilden med `stbi_image_free(data)`, och vertexarna hamnar i en VBO i en VAO med ett attribut: tre
flyttal på location 0.
:::
:::vulkan
```cpp
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                unsigned char* pixelOffset = data + (j + width * i) * bytePerPixel;
                unsigned char y = pixelOffset[0];

                // vertex: column j along x, row i along z (the image's top row at the back)
                Vertex vertex{};
                vertex.pos.x = -width / 2.0f + width * j / (float) width;   // vx
                vertex.pos.y = (int) y * yScale - yShift;                    // vy
                vertex.pos.z = -height / 2.0f + height * i / (float) height; // vz
                vertices.push_back(vertex);
            }
        }
```

med `float yScale = 64.0f / 256.0f, yShift = 16.0f;` och `unsigned bytePerPixel = nrChannels;` före looparna. `Vertex`
är bara `glm::vec3 pos` på location 0. Efter loopen frigörs bilden, och `createVertexBuffer()` kopierar de globala
`vertices` till en buffer i enhetens lokala minne.
:::
:::d3d12
Loopen är learnopengls: för varje rad `i` och kolumn `j` pixeln vid `data + (j + width * i) * bytePerPixel`, och tre
flyttal som läggs i `std::vector<float> vertices` – `-width / 2.0f + width * j / (float)width`, `(int)y * yScale -
yShift` och `-height / 2.0f + height * i / (float)height`. Efter den frigörs bilden, och vertexarna hamnar i en buffer i
en upload-heap (`StrideInBytes = 3 * sizeof(float)`, input layouten `POSITION` som `R32G32B32_FLOAT`).
:::

`bytePerPixel` är antalet kanaler: i en gråskalebild är varje pixel en byte, i RGBA fyra, och den första byten är höjden i
båda fallen. learnopengls karta är RGBA; med `nrChannels` från `stbi_load` läser samma loop båda.

För en första titt ritar uppgiften vertexarna som **punkter**.

:::opengl
`glDrawArrays(GL_POINTS, 0, (GLsizei)(vertices.size() / 3));` med VAO:n bunden.
:::
:::vulkan
Tills vidare är pipelinens topologi `VK_PRIMITIVE_TOPOLOGY_POINT_LIST`, och `recordCommandBuffer()` binder vertex buffern
och anropar `vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0)`. Vertex shadern måste också skriva
`gl_PointSize = 1.0;` – Vulkan tar en punkts storlek bara från shadern (uppgiften strips tar bort det igen).
:::
:::d3d12
I Direct3D 12 har primitivtopologin två delar: pipeline state-objektets `PrimitiveTopologyType` (punkt, linje, triangel
eller patch – vad rastreraren får) och command listens `IASetPrimitiveTopology` (lista eller strip – hur vertexarna sätts
ihop). Startens pipeline state är gjort för punkter; command listen sätter `D3D_PRIMITIVE_TOPOLOGY_POINTLIST` och ritar
vertexarna. En punkt är en pixel i Direct3D – det finns ingen punktstorlek.
:::

Gör nu den andra uppgiften, **vertices**. Bygg och kör: terrängen syns som ett moln av 65 536 vita punkter, täta på de
branta topparna längst bak, med glipor mellan raderna framtill.

## Triangle strips

För att göra punkterna till en yta kopplas närliggande vertexar ihop till trianglar. Ett rutnät är det klassiska fallet
för **triangle strips**: en strip är en lista av vertexar där varje vertex efter de två första bildar en triangel med de
två före den. Sicksacka mellan två närliggande rader – en vertex från rad `i`, sedan en från rad `i + 1`, sedan nästa
kolumn – så lägger varje ny vertex till en triangel. En strip över 256 kolumner har 512 index och 510 trianglar; med en
vanlig triangellista skulle samma trianglar kräva 1530 index.

learnopengl bygger en strip per radpar med tre nästlade loopar:

:::opengl
```cpp
    std::vector<unsigned int> indices;
    int rez = 1;
    for (int i = 0; i < height - 1; i += rez)
    {
        for (int j = 0; j < width; j += rez)
        {
            for (int k = 0; k < 2; k++)
            {
                indices.push_back(j + width * (i + k * rez));
            }
        }
    }
```

```cpp
    const int numStrips = (height - 1) / rez;
    const int numTrisPerStrip = (width / rez) * 2 - 2;
```

Indexen hamnar i `terrainIBO`, bunden till `GL_ELEMENT_ARRAY_BUFFER` medan VAO:n är bunden, så att VAO:n minns den.

```quiz
Varför binds `terrainIBO` till `GL_ELEMENT_ARRAY_BUFFER` medan `terrainVAO` är bunden?
- [ ] För att `glBufferData` bara fungerar på en buffer som är bunden inuti en VAO
- [ ] För att element buffers måste skapas efter vertex buffern
- [ ] För att stripsen ritas från VBO:n, inte från element buffern
- [x] För att VAO:n registrerar den element buffer som binds medan den är bunden – att binda VAO:n senare för ritning tar med sig indexen
---
Bindningen av element buffern är en del av VAO:ns tillstånd, till skillnad från bindningen `GL_ARRAY_BUFFER`, som bara registreras per attribut av `glVertexAttribPointer`.
```
:::
:::vulkan
Samma loopar fyller den globala `std::vector<uint32_t> indices` (`indices.push_back(j + width * (i + k * rez));` för `i`
över alla rader utom den sista, `j` över kolumnerna och `k` = 0, 1), med `numStrips = (height - 1) / rez` och
`numTrisPerStrip = (width / rez) * 2 - 2`. `createIndexBuffer()` laddar upp dem; indextypen är `VK_INDEX_TYPE_UINT32`,
eftersom 65 536 vertexar förbrukar varje 16-bitars indexvärde.

```quiz
Varför använder terrängen 32-bitars index (`VK_INDEX_TYPE_UINT32`)?
- [ ] För att triangle strips kräver 32-bitars index
- [ ] För att 16-bitars index inte kan laddas upp med en staging buffer
- [x] För att rutnätets 65 536 vertexar använder varje 16-bitarsvärde upp till 65 535 – värdet som primitive restart reserverar – och en kolumn till skulle slå över; 32-bitars index ger utrymme
- [ ] För att index buffern är större än 64 kB
---
Större terräng delas upp i rutor eller använder 32-bitars index. Varje index tar då 4 byte i stället för 2 – 522 kB för den här terrängens 130 560 index.
```
:::
:::d3d12
Samma loopar fyller `std::vector<unsigned int> indices` (`indices.push_back(j + width * (i + k * rez));` för `i` över alla
rader utom den sista, `j` över kolumnerna och `k` = 0, 1), med learnopengls antal sparade i medlemmar:
`m_numStrips = (height - 1) / rez` och `m_numTrisPerStrip = (width / rez) * 2 - 2`. Indexen hamnar i en buffer i en
upload-heap med en index buffer view i formatet `DXGI_FORMAT_R32_UINT`.

```quiz
Varför använder terrängens index buffer view `DXGI_FORMAT_R32_UINT`?
- [ ] För att `DrawIndexedInstanced` bara tar emot 32-bitars index
- [x] För att rutnätets 65 536 vertexar använder varje 16-bitarsvärde upp till 65 535 – strip-cut-värdet – och en kolumn till skulle slå över; 32-bitars index ger utrymme
- [ ] För att upload-heaps inte kan hålla 16-bitarsdata
- [ ] För att vertex bufferns stride är 12 byte
---
Större terräng delas upp i rutor eller använder 32-bitars index. Varje index tar då 4 byte i stället för 2 – 522 kB för den här terrängens 130 560 index.
```
:::

Det blir 255 strips med 510 trianglar – 130 050 trianglar från 130 560 index. learnopengls `rez` skulle bara använda var
`rez`:te vertex, för ett grövre mesh. Med den här kartan fungerar det bara för `rez = 1`: strip-antalen `(height − 1) /
rez` och `(width / rez) · 2 − 2` stämmer bara när `rez` delar både 255 och 256, och inget tal över 1 gör det. Detaljnivå
gjord på riktigt – grövre där terrängen är långt bort – är vad nästa kapitels tessellering är till för.

```quiz
Hur många index har en strip över de 256 kolumnerna i två närliggande rader, och hur många trianglar?
- [x] 512 index och 510 trianglar: två per kolumn, och varje index efter de två första lägger till en triangel
- [ ] 256 index och 255 trianglar
- [ ] 1530 index och 510 trianglar
- [ ] 512 index och 256 trianglar
---
Det är `numTrisPerStrip = width · 2 − 2` = 510, ritade med `numTrisPerStrip + 2` = 512 index. En triangellista skulle behöva tre index per triangel: 1530.
```

Gör nu den tredje uppgiften, **indices**. Bilden ändras inte ännu: indexen finns, men ritningen använder fortfarande
punkter.

## Att rita stripsen

Varje strip är en egen primitiv: om hela index buffern ritades som en enda strip skulle den sista vertexen i en strip och
den första i nästa bilda långa trianglar tvärs över terrängen från ena kanten till den andra. learnopengl ritar därför
stripsen en och en, var och en med `numTrisPerStrip + 2` index från sin egen plats i index buffern:

:::opengl
```cpp
        glBindVertexArray(terrainVAO);
        for (int strip = 0; strip < numStrips; strip++)
        {
            glDrawElements(GL_TRIANGLE_STRIP,   // primitive type
                           numTrisPerStrip + 2, // number of indices to render
                           GL_UNSIGNED_INT,     // index data type
                           (void*)(sizeof(unsigned int) * (numTrisPerStrip + 2) * strip)); // offset to starting index
        }
```

Det sista argumentet till `glDrawElements` är en förskjutning i *byte* i element buffern, förklädd till en pekare.
:::
:::vulkan
Pipelinens topologi blir `VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP`, och `recordCommandBuffer()` binder index buffern och
ritar stripsen:

```cpp
        // draw mesh strip by strip: each strip starts (numTrisPerStrip + 2) indices after the one before
        for (int strip = 0; strip < numStrips; strip++) {
            vkCmdDrawIndexed(commandBuffer,
                             numTrisPerStrip + 2,                  // number of indices to render
                             1,                                    // one instance
                             (numTrisPerStrip + 2) * strip,        // the strip's first index
                             0, 0);
        }
```

`firstIndex` i `vkCmdDrawIndexed` räknar index, där OpenGL:s sista argument är en förskjutning i byte. Culling förblir
avstängd (`VK_CULL_MODE_NONE`): trianglarna i en strip växlar riktning (winding).
:::
:::d3d12
Pipeline state-objektets `PrimitiveTopologyType` blir `D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE`, command listen sätter
`D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP`, och stripsen ritas en och en:

```cpp
    for (int strip = 0; strip < m_numStrips; strip++)
    {
        m_commandList->DrawIndexedInstanced(m_numTrisPerStrip + 2,    // number of indices to render
            1,                                                       // one instance
            (m_numTrisPerStrip + 2) * strip,                         // offset to starting index
            0, 0);
    }
```

`StartIndexLocation`, det tredje argumentet, räknar index, där OpenGL:s sista argument är en förskjutning i byte. Culling
förblir avstängd (`D3D12_CULL_MODE_NONE`): trianglarna i en strip växlar riktning (winding).
:::

255 draw-anrop per bildruta för en enda terräng är slöseri. Det vanliga alternativet är **primitive restart**: lägg ett
särskilt index mellan stripsen som säger åt GPU:n "avsluta den här strippen, börja en ny", och rita allt med ett anrop.
:::opengl
I OpenGL: `glEnable(GL_PRIMITIVE_RESTART)` med `glPrimitiveRestartIndex(0xFFFFFFFF)` (eller, sedan 4.3,
`GL_PRIMITIVE_RESTART_FIXED_INDEX`, som alltid använder indextypens största värde).
:::
:::vulkan
I Vulkan: `inputAssembly.primitiveRestartEnable = VK_TRUE` i pipelinen, och indexet `0xFFFFFFFF` (för 32-bitars index)
efter varje strip.
:::
:::d3d12
I Direct3D 12 heter det *strip-cut value*: `psoDesc.IBStripCutValue = D3D12_INDEX_BUFFER_STRIP_CUT_VALUE_0xFFFFFFFF` i
pipeline state-objektet, och det indexet efter varje strip.
:::
En vanlig triangellista fungerar också, till priset av fler index. Kursen behåller learnopengls loop, som visar stripsen
tydligast.

```quiz
Varför ritar programmet varje strip för sig i stället för att rita alla 130 560 index som en enda triangle strip?
- [ ] För att ett enda draw-anrop är begränsat till 65 536 index
- [ ] För att index buffern håller varje strip i en egen buffer
- [x] För att en enda lång strip skulle koppla ihop slutet av varje radpar med början av nästa med trianglar utsträckta tvärs över terrängen
- [ ] För att triangle strips bara kan täcka två rader i ett rutnät
---
I en strip bildar varje nytt index en triangel med de två före det – även över hoppet från ett radpar till nästa. Separata ritningar, eller ett primitive restart-index mellan stripsen, avslutar varje strip där den ska sluta.
```

Gör nu den fjärde uppgiften, **strips**. Bygg och kör: terrängen är en helvit form – topparnas siluett mot den mörka
bakgrunden, framkanten längst ned. Fragment shadern skriver fortfarande vitt, så det finns ingen skuggning att se kullarna
med.

## Att färga efter höjd

Vertex shadern skickar höjden (`aPos.y`) vidare till fragment shadern. Att flytta den uppåt 16 och dividera med 64 gör om
intervallet −16 … 48 till ett gråvärde från 0 till 1 – ungefär höjdkartans eget grå:

:::opengl
```glsl
    float h = (Height + 16.0) / 64.0; // shift and scale the height into a grey value (0 .. 1)
    FragColor = vec4(h, h, h, 1.0);
```

(learnopengls CPU-shader dividerar med 32, vilket gör allt över höjden 16 vitt; dess GPU-shader dividerar med 64, som kursen
gör i båda kapitlen.)
:::
:::vulkan
I `cpuheight.frag`: `float h = (Height + 16.0) / 64.0; outColor = vec4(h, h, h, 1.0);`. (learnopengls CPU-shader dividerar
med 32, vilket gör allt över höjden 16 vitt; dess GPU-shader dividerar med 64, som kursen gör i båda kapitlen.)
:::
:::d3d12
I pixel shadern i `cpuheight.hlsl`: `float h = (input.height + 16.0f) / 64.0f;`, returnerat som `float4(h, h, h, 1.0f)`.
(learnopengls CPU-shader dividerar med 32, vilket gör allt över höjden 16 vitt; dess GPU-shader dividerar med 64, som kursen
gör i båda kapitlen.)
:::

Gör nu den sista uppgiften, **height-colour**. Bygg och kör: landskapet i grått – ljusa toppar längst bak, den mörka
floddalen som slingrar sig fram till framkanten, sjön nästan lika mörk som bakgrunden.

```quiz
Pixeln för en vertex i höjdkartan har gråvärdet 128. Vilken gråton ger fragment shadern vertexen?
- [ ] 128 / 255 ≈ 0.50, samma värde
- [x] Höjden 128 · 64/256 − 16 = 16, och (16 + 16) / 64 = 0.5
- [ ] Höjden 128 − 16 = 112, som klämps till 1.0
- [ ] (128 + 16) / 64 = 2.25, klämt till 1.0
---
Vertexloopen skalar värdet 0–255 till −16 … 47.75; shadern tar bort förskjutningen och dividerar med intervallet 64. Resultatet är kartans eget grå, så när som på avrundningen av höjderna.
```

## Vad ett tätt mesh kostar

Terrängen fungerar, men se vad den kostar. 65 536 vertexar och 130 050 trianglar för en karta på 256 × 256 – och
learnopengls karta på 2,6 tusen pixlar har omkring 7 miljoner vertexar. Varje vertex lagras i GPU-minnet, transformeras av
vertex shadern varje bildruta, och varje triangel ställs i ordning och rastreras, vare sig den ligger alldeles framför
kameran eller långt bort, där den täcker en bråkdel av en pixel. Detaljrikedomen bestäms när meshet byggs: för att visa
mer av den nära kameran behöver du ett tätare mesh överallt; för att spara arbete långt bort behöver du flera mesh och en
CPU som väljer mellan dem.

Tessellering vänder på det. CPU:n skickar ett grovt rutnät av *patches*, och GPU:n delar upp varje patch medan den ritar –
så fint som shadern bestämmer, patch för patch, bildruta för bildruta. Höjderna läses ur höjdkartan som en **textur** i
shadern i stället för att bakas in i vertexarna. Det är nästa kapitel.

```quiz
Vad ändrar tessellering jämfört med det här kapitlets terräng?
- [x] CPU:n skickar ett grovt rutnät av patches, och GPU:n delar upp varje patch medan den ritar – så fint som en shader bestämmer, så att detaljerna kan följa avståndet till kameran
- [ ] CPU:n skickar samma 65 536 vertexar, men GPU:n ritar dem som punkter
- [ ] Höjdkartan behövs inte längre, eftersom GPU:n genererar höjderna
- [ ] Vertexarna räknas ut en gång på GPU:n och lagras sedan som ett tätt mesh
---
Höjderna kommer fortfarande från höjdkartan – läst som en textur i shadern. Det som ändras är var och hur fint meshet görs: på GPU:n, varje bildruta, patch för patch.
```

## Mer att läsa

- [Tessellation: Height map](https://learnopengl.com/Guest-Articles/2021/Tessellation/Height-map): learnopengls
  gästartikel som det här kapitlet följer.
- [terrain_cpu_src/main.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2021/3.tessellation/terrain_cpu_src/main.cpp):
  learnopengls demo med terrängen på CPU:n.

:::opengl
- [glDrawElements](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawElements.xhtml): indexförskjutningen,
  och `GL_TRIANGLE_STRIP`.
- [glPrimitiveRestartIndex](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPrimitiveRestartIndex.xhtml): ett
  draw-anrop för många strips.
:::
:::vulkan
- [Input assembly (Fixed functions)](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Fixed_functions):
  vulkan-tutorial om topologier och `primitiveRestartEnable`.
- [vkCmdDrawIndexed](https://registry.khronos.org/vulkan/specs/latest/man/html/vkCmdDrawIndexed.html): `firstIndex` och de
  andra parametrarna.
:::
:::d3d12
- [Primitive topologies](https://learn.microsoft.com/en-us/windows/win32/direct3d11/d3d10-graphics-programming-guide-primitive-topologies):
  listor, strips och strip-cut-indexet.
- [ID3D12GraphicsCommandList::DrawIndexedInstanced](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-drawindexedinstanced):
  `StartIndexLocation` räknar index.
:::
