# Normal mapping

Alla våra scener är fyllda med mesher, var och en av hundratals eller kanske tusentals trianglar. Vi ökade realismen
genom att lägga 2D-texturer på de platta trianglarna och dölja att polygonerna bara är små platta trianglar. Texturer
hjälper, men tittar man riktigt nära på mesherna är det fortfarande ganska lätt att se de platta ytorna under. De flesta
ytor i verkligheten är dock inte platta, utan har massor av (knottriga) detaljer.

Ta till exempel en tegelvägg. En tegelyta är ganska skrovlig och uppenbarligen inte helt platt: den har nedsänkta
fogar och massor av små detaljer, hål och sprickor. Om vi tittade på en sådan tegelyta i en belyst scen skulle
illusionen lätt brytas. Belysningen tar ingen hänsyn till de små sprickorna och hålen och struntar helt i de djupa
fogarna mellan teglen; ytan ser helt platt ut.

Vi kan delvis dölja det platta intrycket med en specular map som låtsas att vissa ytor är mindre belysta på grund av djup
eller andra detaljer, men det är mer ett hack än en riktig lösning. Det vi behöver är ett sätt att berätta för
belysningen om ytans alla små djupliknande detaljer.

Tänk på det ur ljusets synvinkel: varför belyses ytan som en helt platt yta? Svaret är ytans normalvektor. För
belysningstekniken är det enda sättet att avgöra ett objekts form dess vinkelräta normalvektor. Tegelytan har bara en
enda normalvektor, och därför belyses ytan jämnt utifrån den normalens riktning. Tänk om vi, i stället för en normal per
yta som är densamma för varje fragment, använde en normal per fragment som är olika för varje fragment? Då kan vi luta
normalvektorn lite efter ytans små detaljer, vilket ger illusionen att ytan är mycket mer komplex. Den här tekniken, att
använda normaler per fragment i stället för per yta, kallas *normal mapping* eller bump mapping. Som allt i den här delen
är den likadan i alla API:er: bara shadrar och vertexdata ändras. Där API:erna skiljer sig är riktningen på texturens
v-axel – och det spelar roll här, som du ska se.

:::opengl
Projektet är learnopengls: en fyrhörning på 2 × 2 som vetter mot +z, byggd av `renderQuad()` av positionerna
`pos1`…`pos4` ((-1, 1), (-1, -1), (1, -1), (1, 1)), texturkoordinaterna `uv1`…`uv4` ((0, 1), (0, 0), (1, 0), (1, 1)) och
normalen `nm` (0, 0, 1), som två trianglar 1-2-3 och 1-3-4 – tills vidare 8 floats per vertex: position, normal,
texturkoordinater. Den är roterad en fast vinkel på -30° kring normalize(1, 0, 1) (learnopengl vrider den med tiden,
`glfwGetTime() * -10.0` grader). Färgtexturen är `brickwall.png`, laddad med `loadTexture` (vänd vid laddning,
`GL_REPEAT`, mipmaps), på texturenhet 0. Ljuset står på `lightPos` (0.5, 1.0, 0.3), kameran på (0, 0, 3).
`normal_mapping.vs` skickar `FragPos`, `Normal` (med normalmatrisen) och `TexCoords`; `normal_mapping.fs` belyser med
learnopengls värden: ambient `0.1 * color`, diffust och Blinn-Phong-spekulärt `vec3(0.2) * pow(…, 32.0)`. (learnopengl
ritar också en liten kopia av fyrhörningen på ljusets position som markering; kursen hoppar över den.)
:::
:::vulkan
Projektet är learnopengls: en fyrhörning på 2 × 2 som vetter mot +z, byggd av `createQuadVertices()` (learnopengls
`renderQuad()`, anropad före `createVertexBuffer()`; den fyller medlemmen `std::vector<Vertex> vertices`, som
vulkan-tutorials `loadModel()` gör) av positionerna `pos1`…`pos4` ((-1, 1), (-1, -1), (1, -1), (1, 1)),
texturkoordinaterna `uv1`…`uv4` ((0, 1), (0, 0), (1, 0), (1, 1)) och normalen `nm` (0, 0, 1), som två trianglar 1-2-3
och 1-3-4 – tills vidare `{pos1, nm, uv1}` och så vidare. Push constants bär dess modellmatris, en fast rotation på -30°
kring normalize(1, 0, 1) (learnopengl vrider den med tiden). Färgtexturen är `textures/brickwall.png` på binding 1.
Ljuset står på `lightPos` (0.5, 1.0, 0.3), kameran på (0, 0, 3). `normal_mapping.vert` skickar `fragPos`, `normal` (med
normalmatrisen) och `texCoord`; `normal_mapping.frag` belyser med learnopengls värden: ambient `0.1 * color`, diffust och
Blinn-Phong-spekulärt `vec3(0.2) * pow(…, 32.0)`. (learnopengl ritar också en liten kopia av fyrhörningen på ljusets
position som markering; kursen hoppar över den.)
:::
:::d3d12
Projektet är learnopengls: en fyrhörning på 2 × 2 som vetter mot +z, byggd i `LoadAssets` av positionerna `pos1`…`pos4`
((-1, 1), (-1, -1), (1, -1), (1, 1)), normalen `nm` (0, 0, 1) och texturkoordinaterna `uv1`…`uv4` – (0, 0), (0, 1),
(1, 1), (1, 0): learnopengls med v vänt, eftersom Direct3D:s v = 0 är bildens översta rad – som två trianglar 1-2-3 och
1-3-4. Tills vidare är en `Vertex` position, normal och texturkoordinater (8 floats). Root constants bär dess
modellmatris, en fast rotation på -30° kring normalize(1, 0, 1) (learnopengl vrider den med tiden), och dess
normalmatris. Färgtexturen är `brickwall.png` (t0), laddad av `LoadTexture` som `R8G8B8A8_UNORM`. Ljuset står på
`lightPos` (0.5, 1.0, 0.3), kameran på (0, 0, 3). `normal_mapping.hlsl`:s `VSMain` skickar `fragPos`, `normal` (med
normalmatrisen) och `texCoords`; `PSMain` belyser med learnopengls värden: ambient `0.1f * color`, diffust och
Blinn-Phong-spekulärt `float3(0.2f, 0.2f, 0.2f) * pow(…, 32.0f)`. (learnopengl ritar också en liten kopia av
fyrhörningen på ljusets position som markering; kursen hoppar över den.)
:::

Tryck på **Build & run** (Ctrl+Enter): en tegelvägg, vriden snett – dess nedersta hörn når nedanför fönstret – med ett
högdager uppe till höger. Den är jämnt belyst – teglen och de ljusa fogarna mellan dem ser målade ut på en platt skiva.
Kommentarerna `// TODO:` i projektet visar var din kod ska in.

## Normal mapping

För att få normal mapping att fungera behöver vi en normal per fragment. Som med diffuse maps och specular maps kan vi
använda en 2D-textur för att lagra normaldata per fragment. Då kan vi sampla en 2D-textur för att få en normalvektor för
just det fragmentet.

Normalvektorer är geometriska storheter och texturer används oftast bara för färginformation, så det är kanske inte
självklart att lagra normalvektorer i en textur. Men tänk på färgvektorerna i en textur: de är 3D-vektorer med en r-, en
g- och en b-komponent. På samma sätt kan vi lagra en normalvektors x-, y- och z-komponent i motsvarande färgkomponenter.
Normalvektorer ligger mellan -1 och 1, så de förs först över till [0,1]: varje komponent lagras som
`normal * 0.5 + 0.5`.

Med normalvektorerna omvandlade till RGB-färgkomponenter på det här sättet kan vi lagra en normal per fragment, härledd
ur ytans form, i en 2D-textur. Det är `brickwall_normal.png`, vår tegelväggs normal map. Öppna den gärna: den är mest
blåaktig. Det beror på att normalerna alla pekar ungefär utåt längs den positiva z-axeln (0, 0, 1): en blåaktig färg.
Avvikelserna i färg är normalvektorer som lutar lite från den allmänna positiva z-riktningen och ger texturen en känsla
av djup. Till exempel ser du att färgen överst på varje tegelsten går mer åt grönt, vilket är rimligt: översidan av en
tegelsten har normaler som pekar mer åt den positiva y-riktningen (0, 1, 0), och det råkar vara färgen grön.

En sak till om själva texturen: den innehåller riktningar, inte färger, så den måste läsas exakt som den är lagrad – inte
som en sRGB-textur, som hårdvaran skulle omvandla. Projektet laddar den som färgtexturen, linjärt.

```quiz
Varför ser en normal map mest blå ut?
- [ ] Blått är kanalen med mest precision i en 8-bitarstextur
- [x] De flesta normaler pekar rakt ut ur ytan, (0, 0, 1); överfört från [-1,1] till [0,1] blir det färgen (0.5, 0.5, 1.0), ett ljust blått
- [ ] Normal maps lagrar bara z-komponenten, i den blå kanalen
- [ ] Eftersom normal maps lagras i sRGB
---
Varje komponent lagras som `normal * 0.5 + 0.5`. En normal (0, 0, 1) blir (0.5, 0.5, 1.0); normaler som lutar uppåt ger mer grönt, åt höger mer rött.
```

I fragment shadern samplar vi normal mapen, för tillbaka färgen från [0,1] till [-1,1] och normaliserar den. Sedan gör
vi belysningsberäkningarna med den samplade normalvektorn i stället för ytans normal.

:::opengl
`main.cpp` laddar normal mapen som färgtexturen och binder den till texturenhet 1:

```cpp
    unsigned int normalMap  = loadTexture("brickwall_normal.png");
```

```cpp
    shader.setInt("normalMap", 1);
```

```cpp
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, normalMap);
        renderQuad();
```

och `normal_mapping.fs`, med `uniform sampler2D normalMap;`, tar sin normal från kartan:

```glsl
    // obtain normal from normal map in range [0,1]
    vec3 normal = texture(normalMap, fs_in.TexCoords).rgb;
    // transform normal vector to range [-1,1]
    normal = normalize(normal * 2.0 - 1.0);  // this normal is in tangent space: used as a world-space normal it is only right for a quad facing +z
```

Gör nu första uppgiften, **normal-map**: de här raderna, och `glDeleteTextures(1, &normalMap);` i slutet.
:::
:::vulkan
`initVulkan()` laddar normal mapen som färgtexturen, i en egen bild, vy och minne (`normalMapImage`,
`normalMapImageView`, `normalMapImageMemory`):

```cpp
        loadTexture("textures/brickwall_normal.png", normalMapImage, normalMapImageMemory, normalMapImageView);
```

Descriptor setet får en tredje binding – binding 2, en combined image sampler för fragmentsteget – som läser normal
mapen med samma sampler som färgtexturen:

```cpp
        VkDescriptorImageInfo normalMapInfo{};
        normalMapInfo.imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        normalMapInfo.imageView = normalMapView;
        normalMapInfo.sampler = sampler;
```

(`createDescriptorSet(diffuseMapImageView, normalMapImageView, textureSampler, descriptorSet)`, en tredje
`VkWriteDescriptorSet`, en layout binding med `binding = 2`, och två combined image samplers i poolen.) Fragment
shadern, med `layout(binding = 2) uniform sampler2D normalMap;`, tar sin normal från kartan:

```glsl
    // obtain normal from normal map in range [0,1]
    vec3 normal = texture(normalMap, fs_in.texCoord).rgb;
    // transform normal vector to range [-1,1]
    normal = normalize(normal * 2.0 - 1.0);  // this normal is in tangent space: used as a world-space normal it is only right for a quad facing +z
```

Gör nu första uppgiften, **normal-map**: de här delarna, och förstör normal mapens vy, bild och minne i `cleanup()`.
:::
:::d3d12
`LoadAssets` laddar normal mapen som färgtexturen, på plats 2 i CBV/SRV-heapen, direkt efter färgtexturens SRV:

```cpp
    // The normal map, in slot 2. Its colours are directions, not colours: loaded as they are
    // (UNORM), each channel 0..1 standing for -1..1.
    ComPtr<ID3D12Resource> normalMapUploadHeap;
    LoadTexture("brickwall_normal.png", m_normalMap, normalMapUploadHeap, 2);
```

Heapen växer till 3 descriptors (`cbvSrvHeapDesc.NumDescriptors = 3`) och texturernas descriptor range till två
register, så att samma table når båda: `ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0)` – t0 färgerna, t1
normalerna. I `normal_mapping.hlsl`, med `Texture2D normalMap : register(t1);`, tar `PSMain` sin normal från kartan,
läst med samma sampler:

```hlsl
    // obtain normal from normal map in range [0,1]
    float3 normal = normalMap.Sample(wrapSampler, input.texCoords).rgb;
    // transform normal vector to range [-1,1]
    normal = normalize(normal * 2.0f - 1.0f);  // this normal is in tangent space: used as a world-space normal it is only right for a quad facing +z
```

Gör nu första uppgiften, **normal-map**: medlemmen `m_normalMap`, den större heapen och rangen, laddningen och de här
shaderraderna.
:::

Tryck på **Build & run**: teglen får **knölar** – fogarna mellan dem har nu kanter – men belysningen är fel. Hela väggen
är mörkare, mest nere till vänster, och fasningarna längs teglen stämmer inte med ljuset: de som vetter uppåt, mot
ljuset, är mörka.

Det finns dock ett problem som starkt begränsar den här användningen av normal maps. Normal mapen vi använde har
normalvektorer som alla pekar ungefär åt den positiva z-riktningen. Det fungerade eftersom planets ytnormal också pekade
åt den positiva z-riktningen – innan vi roterade det. Vår fyrhörning är roterad -30°: dess yta vetter inte längre mot
+z, men normalerna från kartan gör det fortfarande. Belysningen använder dem som om de vore normaler i världsrymden, så
den belyser en vägg som vetter mot +z – inte den du ser. Om fyrhörningen vette uppåt, längs +y, vore det ännu värre:
kartans normaler skulle fortfarande peka längs +z, vinkelrätt mot ytan.

```quiz
Efter första uppgiften är fyrhörningens knölar fel belysta. Varför?
- [ ] Normal mapen måste laddas som en sRGB-textur
- [ ] `normal * 2.0 - 1.0` borde vara `normal * 0.5 + 0.5`
- [ ] Ljuset står bakom fyrhörningen
- [x] Kartans normaler är relativa till ytan (mest +z), men shadern använder dem som normaler i världsrymden – rätt bara för en fyrhörning som vetter mot +z, och vår är roterad
---
En normal map vet inte hur ytan är orienterad i världen. Dess normaler måste föras över till samma rymd som ljus- och vyriktningarna – det är vad tangentrymden är till för.
```

## Tangentrymd

Ett sätt att lösa det vore att göra en normal map för varje tänkbar riktning ytan kan ha – vilket uppenbarligen inte
fungerar för något annat än en enda platt fyrhörning. En annan, svårare lösning är att göra belysningen i en annan
koordinatrymd: en rymd där normal mapens vektorer alltid pekar ungefär åt den positiva z-riktningen; alla andra
belysningsvektorer transformeras sedan relativt den positiva z-riktningen. Då kan vi alltid använda samma normal map,
oavsett orientering. Den koordinatrymden kallas *tangentrymd* (tangent space).

Normalvektorerna i en normal map uttrycks i tangentrymden, där normaler alltid pekar ungefär åt positiv z. Tangentrymden
är lokal för en triangels yta: normalerna är relativa till de enskilda trianglarnas lokala referensram. Tänk på den som
normal mapens vektorers lokala rymd; de är alla definierade att peka åt positiv z oavsett den slutliga transformerade
riktningen. Med en särskild matris kan vi sedan transformera normalvektorer från den lokala tangentrymden till värld-
eller vykoordinater och rikta dem efter den slutliga ytans riktning.

En sådan matris kallas en TBN-matris, där bokstäverna står för en Tangent-, Bitangent- och Normalvektor. Det är vektorerna
vi behöver för att bygga matrisen. För att bygga en sådan basbytesmatris, som transformerar en vektor i tangentrymden till
en annan koordinatrymd, behöver vi tre vinkelräta vektorer som är riktade längs normal mapens yta: en uppåt-, en höger-
och en framåtvektor.

Uppåtvektorn känner vi redan: ytans normalvektor. Höger- och framåtvektorn är tangenten respektive bitangenten:
riktningarna på ytan där texturkoordinaterna u och v växer. Tangenten pekar längs texturens u-axel, bitangenten längs
dess v-axel – så normal mapens x (rött) mäts längs tangenten, dess y (grönt) längs bitangenten och dess z (blått) längs
normalen.

### Att räkna ut tangenter och bitangenter för hand

Att räkna ut tangenten och bitangenten är inte lika enkelt som normalvektorn. Av texturkoordinaterna ser vi att
riktningen på normal mapens tangent och bitangent följer riktningen som vi definierar ytans texturkoordinater i. Det
använder vi för att räkna ut tangent och bitangent för varje yta.

Ta en triangel med vertexpositionerna P1, P2, P3 och texturkoordinaterna (U1, V1), (U2, V2), (U3, V3). Dess kanter
E1 = P2 − P1 och E2 = P3 − P1 är skillnader mellan positioner; motsvarande skillnader i texturkoordinater är ΔU1, ΔV1
(från vertex 1 till 2) och ΔU2, ΔV2 (från vertex 1 till 3). Eftersom T och B är riktningarna där u och v växer är varje
kant en kombination av dem – gå ΔU längs tangenten och ΔV längs bitangenten:

```text
E1 = ΔU1 · T + ΔV1 · B
E2 = ΔU2 · T + ΔV2 · B
```

Det är två vektorekvationer med två okända vektorer – ett linjärt 2 × 2-system per komponent. Multiplicerar vi båda
sidor med inversen av ΔUV-matrisen löser vi det:

```text
| T |              1               |  ΔV2  -ΔV1 |   | E1 |
|   | = ------------------------ · |            | · |    |
| B |   ΔU1 · ΔV2  -  ΔU2 · ΔV1    | -ΔU2   ΔU1 |   | E2 |
```

Alltså T = f · (ΔV2 · E1 − ΔV1 · E2) och B = f · (−ΔU2 · E1 + ΔU1 · E2), med f = 1 / (ΔU1 · ΔV2 − ΔU2 · ΔV1).

```quiz
Vad beskriver en triangels tangent och bitangent?
- [x] Riktningarna på triangelns yta där texturkoordinaterna u och v växer – axlarna längs vilka normal mapens x och y mäts
- [ ] Två vektorer vinkelräta mot ytan, bredvid normalen
- [ ] Riktningarna på triangelns två första kanter
- [ ] Ljusets riktning och vyriktningen i världsrymden
---
Varje kant i triangeln är ΔU steg längs T plus ΔV steg längs B; löser man de två ekvationerna får man T och B. Tillsammans med normalen bildar de tangentrymden.
```

:::opengl
I `renderQuad()` är det här learnopengls kod, för den första triangeln (pos1, pos2, pos3):

```cpp
        glm::vec3 edge1 = pos2 - pos1;
        glm::vec3 edge2 = pos3 - pos1;
        glm::vec2 deltaUV1 = uv2 - uv1;
        glm::vec2 deltaUV2 = uv3 - uv1;

        float f = 1.0f / (deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y);

        tangent1.x = f * (deltaUV2.y * edge1.x - deltaUV1.y * edge2.x);
        tangent1.y = f * (deltaUV2.y * edge1.y - deltaUV1.y * edge2.y);
        tangent1.z = f * (deltaUV2.y * edge1.z - deltaUV1.y * edge2.z);

        bitangent1.x = f * (-deltaUV2.x * edge1.x + deltaUV1.x * edge2.x);
        bitangent1.y = f * (-deltaUV2.x * edge1.y + deltaUV1.x * edge2.y);
        bitangent1.z = f * (-deltaUV2.x * edge1.z + deltaUV1.x * edge2.z);
```

och likadant för den andra triangeln (pos1, pos3, pos4) i `tangent2` och `bitangent2`. Varje vertex får sedan sin
triangels tangent och bitangent – 14 floats per vertex:

```cpp
        float quadVertices[] = {
            // positions            // normal         // texcoords  // tangent                          // bitangent
            pos1.x, pos1.y, pos1.z, nm.x, nm.y, nm.z, uv1.x, uv1.y, tangent1.x, tangent1.y, tangent1.z, bitangent1.x, bitangent1.y, bitangent1.z,
            pos2.x, pos2.y, pos2.z, nm.x, nm.y, nm.z, uv2.x, uv2.y, tangent1.x, tangent1.y, tangent1.z, bitangent1.x, bitangent1.y, bitangent1.z,
            pos3.x, pos3.y, pos3.z, nm.x, nm.y, nm.z, uv3.x, uv3.y, tangent1.x, tangent1.y, tangent1.z, bitangent1.x, bitangent1.y, bitangent1.z,

            pos1.x, pos1.y, pos1.z, nm.x, nm.y, nm.z, uv1.x, uv1.y, tangent2.x, tangent2.y, tangent2.z, bitangent2.x, bitangent2.y, bitangent2.z,
            pos3.x, pos3.y, pos3.z, nm.x, nm.y, nm.z, uv3.x, uv3.y, tangent2.x, tangent2.y, tangent2.z, bitangent2.x, bitangent2.y, bitangent2.z,
            pos4.x, pos4.y, pos4.z, nm.x, nm.y, nm.z, uv4.x, uv4.y, tangent2.x, tangent2.y, tangent2.z, bitangent2.x, bitangent2.y, bitangent2.z
        };
```

Alla attributpekares stride blir `14 * sizeof(float)`, och två attribut tillkommer:

```cpp
        glEnableVertexAttribArray(3);
        glVertexAttribPointer(3, 3, GL_FLOAT, GL_FALSE, 14 * sizeof(float), (void*)(8 * sizeof(float)));
        glEnableVertexAttribArray(4);
        glVertexAttribPointer(4, 3, GL_FLOAT, GL_FALSE, 14 * sizeof(float), (void*)(11 * sizeof(float)));
```

som `normal_mapping.vs` deklarerar som `layout (location = 3) in vec3 aTangent;` och
`layout (location = 4) in vec3 aBitangent;`. Gör nu uppgiften **tangents**.
:::
:::vulkan
I `createQuadVertices()` är det här learnopengls kod, för den första triangeln (pos1, pos2, pos3):

```cpp
        glm::vec3 edge1 = pos2 - pos1;
        glm::vec3 edge2 = pos3 - pos1;
        glm::vec2 deltaUV1 = uv2 - uv1;
        glm::vec2 deltaUV2 = uv3 - uv1;

        float f = 1.0f / (deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y);

        tangent1.x = f * (deltaUV2.y * edge1.x - deltaUV1.y * edge2.x);
        tangent1.y = f * (deltaUV2.y * edge1.y - deltaUV1.y * edge2.y);
        tangent1.z = f * (deltaUV2.y * edge1.z - deltaUV1.y * edge2.z);

        bitangent1.x = f * (-deltaUV2.x * edge1.x + deltaUV1.x * edge2.x);
        bitangent1.y = f * (-deltaUV2.x * edge1.y + deltaUV1.x * edge2.y);
        bitangent1.z = f * (-deltaUV2.x * edge1.z + deltaUV1.x * edge2.z);
```

och likadant för den andra triangeln (pos1, pos3, pos4) i `tangent2` och `bitangent2`. `Vertex` får två medlemmar till,
`glm::vec3 tangent;` och `glm::vec3 bitangent;`, och `getAttributeDescriptions()` två beskrivningar till – en
`std::array<VkVertexInputAttributeDescription, 5>`:

```cpp
        attributeDescriptions[3].binding = 0;
        attributeDescriptions[3].location = 3;
        attributeDescriptions[3].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[3].offset = offsetof(Vertex, tangent);

        attributeDescriptions[4].binding = 0;
        attributeDescriptions[4].location = 4;
        attributeDescriptions[4].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[4].offset = offsetof(Vertex, bitangent);
```

Varje vertex får sedan sin triangels tangent och bitangent:

```cpp
        vertices = {
            // positions, normal, texcoords, tangent, bitangent
            {pos1, nm, uv1, tangent1, bitangent1},
            {pos2, nm, uv2, tangent1, bitangent1},
            {pos3, nm, uv3, tangent1, bitangent1},

            {pos1, nm, uv1, tangent2, bitangent2},
            {pos3, nm, uv3, tangent2, bitangent2},
            {pos4, nm, uv4, tangent2, bitangent2}
        };
```

och `normal_mapping.vert` deklarerar dem som `layout(location = 3) in vec3 inTangent;` och
`layout(location = 4) in vec3 inBitangent;`. Gör nu uppgiften **tangents**.
:::
:::d3d12
I `LoadAssets` är det här learnopengls kod, för den första triangeln (pos1, pos2, pos3). `XMFLOAT3` och `XMFLOAT2` är
lagringstyper utan aritmetiska operatorer, så skillnaderna skrivs per komponent:

```cpp
        XMFLOAT3 edge1(pos2.x - pos1.x, pos2.y - pos1.y, pos2.z - pos1.z);
        XMFLOAT3 edge2(pos3.x - pos1.x, pos3.y - pos1.y, pos3.z - pos1.z);
        XMFLOAT2 deltaUV1(uv2.x - uv1.x, uv2.y - uv1.y);
        XMFLOAT2 deltaUV2(uv3.x - uv1.x, uv3.y - uv1.y);

        float f = 1.0f / (deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y);

        tangent1.x = f * (deltaUV2.y * edge1.x - deltaUV1.y * edge2.x);
        tangent1.y = f * (deltaUV2.y * edge1.y - deltaUV1.y * edge2.y);
        tangent1.z = f * (deltaUV2.y * edge1.z - deltaUV1.y * edge2.z);

        bitangent1.x = f * (-deltaUV2.x * edge1.x + deltaUV1.x * edge2.x);
        bitangent1.y = f * (-deltaUV2.x * edge1.y + deltaUV1.x * edge2.y);
        bitangent1.z = f * (-deltaUV2.x * edge1.z + deltaUV1.x * edge2.z);
```

och likadant för den andra triangeln (pos1, pos3, pos4) i `tangent2` och `bitangent2`. `Vertex` får två medlemmar till,
`XMFLOAT3 tangent;` och `XMFLOAT3 bitangent;` (14 floats), varje vertex sin triangels par –
`{ pos1, nm, uv1, tangent1, bitangent1 }` och så vidare – och input layouten två element till:

```cpp
            { "TANGENT", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 32, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "BINORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 44, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

`BINORMAL` är HLSL:s semantiknamn för bitangenten. `VSMain` tar emot dem som två parametrar till:

```hlsl
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD, float3 tangent : TANGENT, float3 bitangent : BINORMAL)
```

Gör nu uppgiften **tangents**.
:::

Tryck på **Build & run**: ingenting ändras – shadrarna använder inte de nya attributen än. För vår fyrhörning får båda
trianglarna förstås samma vektorer: fyrhörningen är platt och dess textur är inte förvrängd.

:::opengl
Räkna ut det för den första triangeln: E1 = (0, -2, 0), E2 = (2, -2, 0), ΔUV1 = (0, -1), ΔUV2 = (1, -1), alltså f = 1,
T = (2, 0, 0) och B = (0, 2, 0). Tangenten pekar åt höger, längs u; bitangenten uppåt, längs v. De har längden 2 eftersom
fyrhörningen är 2 enheter bred för en texturupprepning – shadern normaliserar dem.
:::
:::vulkan
Räkna ut det för den första triangeln: E1 = (0, -2, 0), E2 = (2, -2, 0), ΔUV1 = (0, -1), ΔUV2 = (1, -1), alltså f = 1,
T = (2, 0, 0) och B = (0, 2, 0). Tangenten pekar åt höger, längs u; bitangenten uppåt, längs v. De har längden 2 eftersom
fyrhörningen är 2 enheter bred för en texturupprepning – shadern normaliserar dem.
:::
:::d3d12
Räkna ut det för den första triangeln: E1 = (0, -2, 0), E2 = (2, -2, 0), ΔUV1 = (0, 1), ΔUV2 = (1, 1), alltså f = -1,
T = (2, 0, 0) och B = (0, -2, 0). Tangenten pekar åt höger, längs u – men bitangenten pekar **nedåt**: med Direct3D:s
texturkoordinater växer v nedåt i bilden, så riktningen där v växer på väggen är nedåt. (De har längden 2 eftersom
fyrhörningen är 2 enheter bred för en texturupprepning – shadern normaliserar dem.) Kom ihåg det; det spelar roll om en
stund.
:::

### Normal mapping i tangentrymden

För att få normal mapping att fungera måste vi först skapa en TBN-matris i shadrarna. Då skickar vi de tidigare
uträknade tangent- och bitangentvektorerna till vertex shadern som vertexattribut. I vertex shadern skapar vi
TBN-matrisen: först transformerar vi alla TBN-vektorerna till den koordinatrymd vi vill arbeta i, som här är
världsrymden eftersom vi multiplicerar dem med modellmatrisens normalmatris. Sedan skapar vi själva TBN-matrisen genom
att ge vektorerna direkt till matriskonstruktorn.

Nu när vi har en TBN-matris, hur ska vi använda den? Det finns två sätt att använda en TBN-matris för normal mapping:

1. Vi tar TBN-matrisen, som transformerar en vektor från tangentrymden till världsrymden, ger den till fragment shadern
   och transformerar den samplade normalen från tangentrymden till världsrymden med den; normalen ligger då i samma rymd
   som de andra belysningsvariablerna.
2. Vi tar inversen av TBN-matrisen, som transformerar en vektor från världsrymden till tangentrymden, och använder den
   för att transformera inte normalen utan de andra relevanta belysningsvariablerna till tangentrymden; normalen ligger då
   återigen i samma rymd som de andra belysningsvariablerna.

learnopengls färdiga kod använder det andra sättet. Eftersom T, B och N är vinkelräta enhetsvektorer är TBN-matrisen
ortogonal, och inversen av en ortogonal matris är lika med dess transponat – mycket billigare att räkna ut än en invers.
Det andra sättet ser också ut som mer arbete till en början, men det flyttar arbete ut ur fragment shadern: vi
transformerar ljusets position, vypositionen och fragmentets position till tangentrymden i **vertex** shadern – som körs
en gång per vertex, inte en gång per fragment – och låter dem interpoleras. Fragment shadern behöver ingen matris alls:
den samplade normalen ligger redan i tangentrymden.

```quiz
Varför transformerar learnopengl ljusets, vyns och fragmentets positioner till tangentrymden i vertex shadern i stället för att transformera varje samplad normal till världsrymden?
- [ ] Eftersom normal mapen inte kan läsas i världsrymden
- [ ] Eftersom tangentrymden gör det spekulära högdagret skarpare
- [x] Vertex shadern körs mycket mer sällan än fragment shadern; med positionerna redan i tangentrymden behöver fragment shadern ingen matrismultiplikation per fragment
- [ ] Eftersom TBN-matrisen inte kan skickas till fragment shadern
---
Båda sätten ger samma belysning. Det andra gör matrisarbetet per vertex – här 6 gånger – i stället för per fragment – här över 200 000 gånger – och använder det billiga transponatet som invers.
```

:::opengl
Vertex shaderns utdatablock förlorar `Normal` och får de tre positionerna i tangentrymden:

```glsl
out VS_OUT {
    vec3 FragPos;
    vec2 TexCoords;
    vec3 TangentLightPos;
    vec3 TangentViewPos;
    vec3 TangentFragPos;
} vs_out;
```

(fragment shaderns `in VS_OUT`-block likadant), och `main` bygger TBN-matrisen:

```glsl
    mat3 normalMatrix = transpose(inverse(mat3(model)));
    vec3 T = normalize(normalMatrix * aTangent);
    vec3 B = normalize(normalMatrix * aBitangent);
    vec3 N = normalize(normalMatrix * aNormal);

    mat3 TBN = transpose(mat3(T, B, N)); // world space -> tangent space (the inverse of an orthonormal matrix is its transpose)
    vs_out.TangentLightPos = TBN * lightPos;
    vs_out.TangentViewPos  = TBN * viewPos;
    vs_out.TangentFragPos  = TBN * vs_out.FragPos;
```

`mat3(T, B, N)` tar T, B och N som sina **kolumner**: den matrisen för en vektor från tangentrymden till världsrymden.
Dess transponat har dem som rader och går åt andra hållet. I fragment shadern kommer ljus- och vyriktningen nu från
positionerna i tangentrymden:

```glsl
    vec3 lightDir = normalize(fs_in.TangentLightPos - fs_in.TangentFragPos);
```

```glsl
    vec3 viewDir = normalize(fs_in.TangentViewPos - fs_in.TangentFragPos);
```

Gör nu uppgiften **tbn**.
:::
:::vulkan
Vertex shaderns utdatablock förlorar `normal` och får de tre positionerna i tangentrymden:

```glsl
layout(location = 0) out VS_OUT {
    vec3 fragPos;
    vec2 texCoord;
    vec3 tangentLightPos;
    vec3 tangentViewPos;
    vec3 tangentFragPos;
} vs_out;
```

Fragment shaderns `in VS_OUT`-block måste ha samma medlemmar i samma ordning: medlemmarnas locations följer av ordningen.
`main` bygger TBN-matrisen:

```glsl
    mat3 normalMatrix = transpose(inverse(mat3(pc.model)));
    vec3 T = normalize(normalMatrix * inTangent);
    vec3 B = normalize(normalMatrix * inBitangent);
    vec3 N = normalize(normalMatrix * inNormal);

    mat3 TBN = transpose(mat3(T, B, N)); // world space -> tangent space (the inverse of an orthonormal matrix is its transpose)
    vs_out.tangentLightPos = TBN * ubo.lightPos;
    vs_out.tangentViewPos  = TBN * ubo.viewPos;
    vs_out.tangentFragPos  = TBN * vs_out.fragPos;
```

`mat3(T, B, N)` tar T, B och N som sina **kolumner**: den matrisen för en vektor från tangentrymden till världsrymden.
Dess transponat har dem som rader och går åt andra hållet. I fragment shadern kommer ljus- och vyriktningen nu från
positionerna i tangentrymden:

```glsl
    vec3 lightDir = normalize(fs_in.tangentLightPos - fs_in.tangentFragPos);
```

```glsl
    vec3 viewDir = normalize(fs_in.tangentViewPos - fs_in.tangentFragPos);
```

**Varför texturerna vänds vid laddning i det här kapitlet:** de tidigare Vulkan-kapitlen behåller stb_images rader som
de är (rad 0 = bildens överkant = v 0) och vänder i stället v i vertexdatan. Det skulle förstöra normal mapping:
bitangenten räknas ut från texturkoordinaterna, så med vänt v skulle den peka *nedåt* längs väggen, medan normal mapens
gröna kanal betyder *uppåt* i bilden – varje knöl skulle belysas från fel håll. Därför gör det här kapitlet som
learnopengl: `initVulkan()` anropar `stbi_set_flip_vertically_on_load(true);` före laddningen (rad 0 = bildens nederkant
= v 0) och behåller learnopengls texturkoordinater. T pekar då längs +u åt höger, B längs +v uppåt i bilden – precis
normal mapens konvention. Gör nu uppgiften **tbn**.
:::
:::d3d12
`PSInput` förlorar `normal` och får de tre positionerna i tangentrymden:

```hlsl
    float3 fragPos : POSITION;    // the position in world space
    float2 texCoords : TEXCOORD0;
    // the positions the lighting needs, in tangent space
    float3 tangentLightPos : TEXCOORD1;
    float3 tangentViewPos : TEXCOORD2;
    float3 tangentFragPos : TEXCOORD3;
```

och `VSMain` bygger TBN-matrisen:

```hlsl
    // The tangent, the bitangent and the normal in world space (w = 0: directions).
    float3 T = normalize(mul(float4(tangent, 0.0f), normalMatrix).xyz);
    float3 B = normalize(mul(float4(bitangent, 0.0f), normalMatrix).xyz);
    float3 N = normalize(mul(float4(normal, 0.0f), normalMatrix).xyz);

    // world space -> tangent space: T, B and N as the rows of the matrix (the inverse of an
    // orthonormal matrix is its transpose - learnopengl: transpose(mat3(T, B, N)))
    float3x3 TBN = float3x3(T, B, N);
    result.tangentLightPos = mul(TBN, lightPos);
    result.tangentViewPos = mul(TBN, viewPos);
    result.tangentFragPos = mul(TBN, result.fragPos);
```

Se upp med konstruktorerna: GLSL:s `mat3(T, B, N)` tar **kolumner**, HLSL:s `float3x3(T, B, N)` tar **rader**. Så
`float3x3(T, B, N)` är redan learnopengls `transpose(mat3(T, B, N))`, matrisen från världsrymden till tangentrymden, och
`mul(TBN, v)` (matris gånger kolumnvektor) ger (dot(T, v), dot(B, v), dot(N, v)). I `PSMain` kommer ljus- och
vyriktningen från positionerna i tangentrymden:

```hlsl
    float3 lightDir = normalize(input.tangentLightPos - input.tangentFragPos);
```

```hlsl
    float3 viewDir = normalize(input.tangentViewPos - input.tangentFragPos);
```

Och en rad till, efter att normal mapen lästs:

```hlsl
    // The normal map is OpenGL-style: its y (green) points up the image. In Direct3D, v and
    // so the bitangent point down the image: flip y (a DirectX-style normal map stores it so).
    normal.y = -normal.y;
```

Därför: vår bitangent är riktningen där v växer – nedåt längs väggen, (0, -2, 0) – så i vår tangentrymd betyder +y
"nedåt i bilden". Men `brickwall_normal.png` är en normal map i OpenGL-stil: dess gröna kanal betyder "uppåt i bilden"
(normal maps finns i båda konventionerna, ofta kallade "Y+" / OpenGL och "Y-" / DirectX). Utan vändningen skulle varje
fasning belysas från fel håll. Med en normal map i DirectX-stil behövdes ingen vändning. (I första uppgiften fanns ingen
vändning: använd som normal i världsrymden var kartans y helt enkelt väggens uppåt.) Gör nu uppgiften **tbn**.
:::

Tryck på **Build & run**: teglens **knölar belyses rätt**. Teglens platta ytor ser ut som i början – de är platta i
normal mapen också – men fasningarna som vetter mot ljuset är ljusa nu, och de som vetter bort ligger i sin egen skugga.
Väggen ser ut att ha djup, och den är fortfarande bara två trianglar.

:::opengl
```quiz
För vår fyrhörning är bitangenten (0, 2, 0) – uppåt längs väggen. Varför passar det normal mapen?
- [ ] Eftersom OpenGL:s fönster-y pekar uppåt
- [ ] Det spelar ingen roll åt vilket håll bitangenten pekar, normalen normaliseras ändå
- [x] Texturerna vänds vid laddning, så v växer uppåt i bilden; bitangenten – riktningen där v växer – pekar uppåt längs väggen, och normal mapens gröna kanal betyder också "uppåt i bilden"
- [ ] Eftersom fyrhörningen är roterad -30°
---
Bitangenten är tangentrymdens y-axel. Normal mapens y måste betyda samma riktning, annars belyses varje knöl från motsatt håll.
```
:::
:::vulkan
```quiz
Varför vänder det här kapitlet bilderna vid laddning (`stbi_set_flip_vertically_on_load(true)`) i stället för att vända v i vertexdatan som de tidigare Vulkan-kapitlen?
- [x] Bitangenten räknas ut från v: med vänt v skulle den peka nedåt längs väggen, men normal mapens gröna kanal betyder uppåt i bilden – knölarna skulle belysas från fel håll
- [ ] Eftersom Vulkan inte kan sampla vända texturer
- [ ] Eftersom projektionens `proj[1][1] *= -1` vänder texturen också
- [ ] För att göra normal mapen linjär i stället för sRGB
---
Med vändningen vid laddning och learnopengls texturkoordinater växer v uppåt i bilden, bitangenten pekar uppåt längs väggen, och tangentrymdens +y betyder det som normal mapens gröna betyder.
```
:::
:::d3d12
```quiz
Varför vänder `PSMain` normal mapens y (`normal.y = -normal.y`)?
- [ ] Eftersom Direct3D:s fönster-y pekar nedåt
- [x] Med Direct3D:s texturkoordinater växer v nedåt i bilden, så bitangenten – tangentrymdens y-axel – pekar nedåt längs väggen; normal mapens gröna kanal i OpenGL-stil betyder uppåt i bilden
- [ ] Eftersom `float3x3` tar rader i stället för kolumner
- [ ] Eftersom texturen laddas som `R8G8B8A8_UNORM`
---
Tangentrymdens y följer v. En normal map gjord för v uppåt (OpenGL, "Y+") behöver få sitt y vänt när v pekar nedåt; en karta i DirectX-stil ("Y-") skulle inte behöva det.
```
:::

## Komplexa objekt

Vi har visat hur man använder normal mapping tillsammans med transformationer till tangentrymden genom att räkna ut
tangent- och bitangentvektorerna för hand. Som tur är behöver vi inte räkna ut dem för hand särskilt ofta. Oftast gör man
det en gång i en egen modelladdare, eller använder som vi en modelladdare som Assimp.

Assimp har en mycket användbar flagga som vi kan sätta när vi laddar en modell: `aiProcess_CalcTangentSpace`. När
`aiProcess_CalcTangentSpace` ges till Assimps `ReadFile` räknar Assimp ut mjuka tangent- och bitangentvektorer för varje
laddad vertex, ungefär som vi gjorde i det här kapitlet. Laddaren kopierar dem sedan från meshens `mTangents` och
`mBitangents` till vertexdatan – i OpenGL till två vertexattribut till, i Vulkan till två medlemmar till i
`Vertex`-structen med sina attributbeskrivningar, i Direct3D till två element till i input layouten, som du gjorde för
fyrhörningen. (En anmärkning om Wavefront OBJ-filer: deras normal maps exporteras ofta som `map_bump`, som Assimp
rapporterar som `aiTextureType_HEIGHT`, inte `aiTextureType_NORMALS`.)

Normal maps är också ett utmärkt sätt att öka prestandan. Före normal mapping behövde man ett stort antal vertex för att
få många detaljer på en mesh. Med normal mapping får vi samma detaljnivå med mycket färre vertex: en grafiker modellerar
den detaljerade meshen, bakar dess yta till en normal map, och spelet ritar en mycket enklare mesh med den kartan.

## En sista sak

Det finns ett sista knep kvar att gå igenom, som förbättrar kvaliteten lite utan att kosta särskilt mycket.

När tangentvektorer räknas ut på större mesher som delar många vertex tar man oftast medelvärdet av tangentvektorerna för
att få fina, mjuka resultat – som med mjuka normaler. Ett problem med det är att de tre TBN-vektorerna kan sluta vara
vinkelräta, och då är TBN-matrisen inte längre ortogonal – och dess transponat inte längre dess invers. Normal mapping
blir bara lite fel med en icke-ortogonal TBN-matris, men det är ändå något vi kan förbättra.

Med ett matematiskt knep som kallas *Gram-Schmidt-processen* kan vi ortogonalisera TBN-vektorerna igen så att varje
vektor åter är vinkelrät mot de andra: dra av från T dess del längs N – `dot(T, N) * N` – vilket lämnar bara den del av T
som är vinkelrät mot N, och normalisera. Den tredje vektorn behöver då inte komma från vertexdatan alls: kryssprodukten
av två vinkelräta enhetsvektorer är en enhetsvektor vinkelrät mot båda.

```quiz
Vad gör `T = normalize(T - dot(T, N) * N)`?
- [ ] Den roterar T 90° kring N
- [ ] Den får T att peka åt samma håll som N
- [ ] Den tar medelvärdet av T och N
- [x] Den tar bort den del av T som ligger längs N, så att T åter är vinkelrät mot N (och normaliserar sedan)
---
`dot(T, N) * N` är T:s projektion på N. Det som blir kvar när den dragits av ligger i ytans plan – ett steg i Gram-Schmidt-processen. Bitangenten blir sedan kryssprodukten av N och T.
```

:::opengl
I `normal_mapping.vs`:

```glsl
    vec3 T = normalize(normalMatrix * aTangent);
    vec3 N = normalize(normalMatrix * aNormal);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    vec3 B = cross(N, T);
```

Gör nu den sista uppgiften, **gram-schmidt**: de här raderna ersätter de tre som räknade ut T, B och N; attributet
`aBitangent` blir kvar i vertexdatan och i shadern, som i learnopengl.
:::
:::vulkan
I `normal_mapping.vert`:

```glsl
    vec3 T = normalize(normalMatrix * inTangent);
    vec3 N = normalize(normalMatrix * inNormal);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    vec3 B = cross(N, T);
```

Gör nu den sista uppgiften, **gram-schmidt**: de här raderna ersätter de tre som räknade ut T, B och N; attributet
`inBitangent` blir kvar i vertexdatan och i shadern, som i learnopengl.
:::
:::d3d12
I `VSMain`:

```hlsl
    float3 T = normalize(mul(float4(tangent, 0.0f), normalMatrix).xyz);
    float3 N = normalize(mul(float4(normal, 0.0f), normalMatrix).xyz);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    // B from T and N: cross(T, N) points down the image, like the bitangent with Direct3D's
    // v (learnopengl's cross(N, T) points up: its v grows up the image)
    float3 B = cross(T, N);
```

Lägg märke till ordningen: learnopengls `cross(N, T)` är (0, 0, 1) × (1, 0, 0) = (0, 1, 0) – uppåt, riktningen där dess v
växer. Vår måste peka åt det håll vårt v växer, nedåt, som bitangentattributet gjorde: `cross(T, N)` = (0, -1, 0). Med
`cross(N, T)` vore vändningen `normal.y = -normal.y` fel. Gör nu den sista uppgiften, **gram-schmidt**: de här raderna
ersätter de tre som räknade ut T, B och N; attributet `bitangent` blir kvar i vertexdatan och bland `VSMain`:s
parametrar, som i learnopengl.
:::

Tryck på **Build & run**: ingenting ändras. På vår platta fyrhörning är T, B och N redan vinkelräta, och kryssprodukten
är lika med den normaliserade bitangent vi skickade. På en riktig mesh med utjämnade tangenter är det skillnaden mellan
en TBN-matris vars transponat är dess invers och en vars inte är det.

## Mer att läsa

:::opengl
- [Normal Mapping](https://learnopengl.com/Advanced-Lighting/Normal-Mapping): learnopengls kapitel som det här kapitlet
  följer, med bilder av normal mapen, tangentrymden och resultaten.
- [normal_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/4.normal_mapping/normal_mapping.cpp):
  learnopengls program.
- [Vertex Specification (OpenGL-wikin)](https://www.khronos.org/opengl/wiki/Vertex_Specification): vertexattribut,
  stride och offset – vad de två nya attributen behöver.
:::
:::vulkan
- [Normal Mapping](https://learnopengl.com/Advanced-Lighting/Normal-Mapping): learnopengls kapitel som det här kapitlet
  följer, med bilder av normal mapen, tangentrymden och resultaten.
- [Vertex input description](https://vulkan-tutorial.com/Vertex_buffers/Vertex_input_description): vulkan-tutorials
  kapitel om `VkVertexInputAttributeDescription`, som får två poster till här.
- [normal_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/4.normal_mapping/normal_mapping.cpp):
  learnopengls program.
:::
:::d3d12
- [Normal Mapping](https://learnopengl.com/Advanced-Lighting/Normal-Mapping): learnopengls kapitel som det här kapitlet
  följer, med bilder av normal mapen, tangentrymden och resultaten.
- [Semantics (HLSL)](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-semantics):
  vertex shaderns semantik, bland annat `TANGENT` och `BINORMAL`.
- [Per-Component Math Operations (HLSL)](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-per-component-math):
  HLSL:s matriser, deras konstruktorer och `mul`.
:::
