# Prov: Modellinläsning

Visa vad du har lärt dig i *Modellinläsning*: modellfiler och Assimps datastruktur, meshar och deras buffrar, och att
läsa in, texturera och ljussätta en hel modell. Frågorna täcker hela delen, och några gäller {{api}} särskilt. Svara
på alla och tryck på **Lämna in svaren**; du behöver 80 % rätt för att bli godkänd, och du kan göra provet igen.

```quiz
Vad är en mesh, i den här delens mening?
- [ ] En hel modellfil med alla dess objekt
- [x] Den minsta enhet som ritas med en uppsättning texturer: dess vertices, dess index och dess texturer
- [ ] En enda triangel i en modell
- [ ] Listan med en modells material
---
En modell består av en eller flera meshar. Planeten och ringen behöver olika texturer, så de är två meshar i en modell.
```

```quiz
Var i Assimps datastruktur finns vertexdatan för de meshar som hör till en `aiNode`?
- [ ] I noden själv: varje nod äger sina `aiMesh`-objekt
- [x] I scenens array `mMeshes`; noden har bara indexen till sina meshar i den arrayen
- [ ] I rotnoden, som har alla modellens meshar
- [ ] I materialen, en mesh per material
---
Scenen äger alla meshar och alla material. Noderna organiserar dem bara – vilka meshar som hör ihop, och vilka delar som är barn till vilka.
```

:::opengl
```quiz
`Vertex` är `{ glm::vec3 Position; glm::vec3 Normal; glm::vec2 TexCoords; }`. Hur beskriver `setupMesh()` normalattributet?
- [x] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Normal));`
- [ ] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);`
- [ ] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)sizeof(Vertex));`
- [ ] `glVertexAttribPointer(1, 8, GL_FLOAT, GL_FALSE, 0, (void*)offsetof(Vertex, Normal));`
---
Stride är storleken på en hel vertex, eftersom attributen är sammanflätade; offseten är var normalen börjar i den – 12 byte, vilket `offsetof` räknar ut åt dig.
```
:::
:::vulkan
```quiz
`Vertex` har medlemmen `uint32_t materialIndex`. Hur beskrivs den för pipelinen och deklareras i vertex shadern?
- [x] Ett attribut med `VK_FORMAT_R32_UINT` på `offsetof(Vertex, materialIndex)`, och `layout(location = 3) in uint inMaterialIndex;`
- [ ] Ett attribut med `VK_FORMAT_R32_SFLOAT`, och `in float inMaterialIndex;` – varje attribut är en float
- [ ] En push constant, eftersom heltal inte kan vara vertexattribut
- [ ] En descriptor-binding, en per material
---
Heltalsattribut har heltalsformat och heltalstyper i shadern. Ett float-format skulle tolka bitarna som ett tal, och shadern skulle få ett annat värde.
```
:::
:::d3d12
```quiz
`Vertex` är `{ XMFLOAT3 position; XMFLOAT3 normal; XMFLOAT2 texCoord; }`. Vilka byte-offset måste input layouten ge sina element?
- [x] POSITION 0, NORMAL 12, TEXCOORD 24
- [ ] POSITION 0, NORMAL 16, TEXCOORD 32 – varje element börjar på en multipel av 16 byte
- [ ] POSITION 0, NORMAL 1, TEXCOORD 2 – medlemmens nummer
- [ ] Alla 0: varje element läses från en egen buffer
---
Medlemmarna ligger efter varandra i minnet: två `XMFLOAT3` på 12 byte var, sedan `XMFLOAT2`. Vertex buffer viewns stride är `sizeof(Vertex)`, 32 byte.
```
:::

```quiz
Varför kan en `std::vector<Vertex>` kopieras till en vertex buffer som den är?
- [ ] För att `std::vector` gör om sina element till floats när den kopieras
- [x] Medlemmarna i en struct ligger efter varandra i minnet, så vektorns data är exakt de sammanflätade byte som vertex buffern behöver
- [ ] För att GPU:n förstår C++-structar
- [ ] Det kan den inte: varje attribut måste kopieras till en egen buffer
---
`vertices.data()` (eller `&vertices[0]`) pekar på den första vertexen, och nästa följer direkt efter. Attributbeskrivningarna anger var varje medlem ligger i en vertex.
```

:::opengl
```quiz
En mesh har texturerna, i den här ordningen: två av typen `"texture_diffuse"` och en av typen `"texture_specular"`. Vilka samplers pekar `Mesh::Draw` på texturenhet 0, 1 och 2?
- [x] `texture_diffuse1`, `texture_diffuse2`, `texture_specular1`
- [ ] `texture_diffuse0`, `texture_diffuse1`, `texture_specular0`
- [ ] `texture_diffuse1`, `texture_diffuse2`, `texture_specular3`
- [ ] `texture_diffuse`, `texture_diffuse`, `texture_specular`
---
Varje typ räknar sina egna texturer från 1 (`diffuseNr`, `specularNr`), och textur `i` hamnar på enhet `i`. Shadern deklarerar de samplers den använder med de namnen.
```
:::
:::vulkan
```quiz
Varför fyllde kapitlet *Mesh* `vertices` och `indices` med en testkvadrat innan någon modell hade lästs in?
- [ ] För att `vkCmdDrawIndexed` behöver exakt sex index för att vara giltigt
- [x] För att Vulkan inte kan skapa en buffer med storleken 0, och vertex- och indexbuffrarna skapades innan det fanns en modell att fylla dem med
- [ ] För att staging buffern skulle kunna testas utan en textur
- [ ] För att tinyobjloader behöver en mesh att utgå från
---
En buffers storlek måste vara större än 0. Med kvadraten kunde varje tillstånd i projektet byggas och köras; kapitlet *Model* ersatte den med planetens vertices, som `loadModel()` fyller innan buffrarna skapas.
```
:::
:::d3d12
```quiz
En mesh har en diffuse-textur men ingen specular-textur. Vad lägger `SetupMesh` på dess andra SRV-plats (`t1`), och vad läser shadern där?
- [x] En null-SRV – `CreateShaderResourceView` utan resurs – och shadern läser noll: ingen högdager
- [ ] Ingenting: platsen hoppas över och `t1` läser nästa meshs diffuse map
- [ ] En kopia av diffuse-texturens view
- [ ] Det går inte att skapa meshen: varje mesh måste ha båda texturerna
---
En null-descriptor är giltig i en descriptor table och läses som nollor. Med en svart specular map blir den spekulära termen noll, så meshen glänser helt enkelt inte.
```
:::

```quiz
`planet.mtl` innehåller `map_Kd planet_diffuse.png`. Vad säger den raden?
- [x] Materialets diffusa färg kommer från texturen `planet_diffuse.png`
- [ ] Materialets specular map är `planet_diffuse.png`
- [ ] Modellfilen är `planet_diffuse.png`
- [ ] `planet_diffuse.png` måste läsas in med färgnyckeln K
---
`Kd` är den diffusa färgen och `Ks` den spekulära färgen i MTL; `map_`-raderna anger texturerna för dem. `map_Ks` namnger specular mapen.
```

```quiz
En modells ytor har fyra hörn var. Varför gör inläsarna först om dem till trianglar (`aiProcess_Triangulate`, och tinyobjloader som standard)?
- [ ] För att en fyrhörning inte kan ha texturkoordinater
- [x] För att våra draw-anrop ritar trianglar i listform: tre index per triangel
- [ ] För att göra modellen mindre på disken
- [ ] För att normaler bara kan beräknas för trianglar
---
GPU:er ritar punkter, linjer och trianglar. En yta med fyra eller fler hörn måste delas upp i trianglar innan dess index kan hamna i en index buffer för en triangellista.
```

```quiz
Varför går learnopengls modellinläsare rekursivt igenom nodträdet i stället för att helt enkelt loopa över alla scenens meshar?
- [ ] För att en loop över `mMeshes` skulle missa barnnodernas meshar
- [x] Noderna bevarar förälder–barn-relationerna mellan modellens delar, till exempel en bils hjul som ska följa med bilen; att gå igenom trädet håller den strukturen användbar
- [ ] För att rekursion läser in mesharna parallellt
- [ ] För att Assimp frigör varje nod efter att den har besökts
---
För vår planet ger båda sätten samma två meshar. Trädet spelar roll när modellens struktur används – att flytta eller animera en del tillsammans med allt som sitter fast i den.
```

:::opengl
```quiz
Två meshar i en modell använder samma bildfil. Vad gör `loadMaterialTextures` för den andra?
- [x] Den hittar sökvägen i `textures_loaded` och återanvänder den `Texture`n – filen läses in bara en gång
- [ ] Den läser in filen igen, eftersom varje mesh behöver ett eget texturobjekt
- [ ] Den slår ihop de två mesharna till en
- [ ] Den ger ett fel: en fil får bara användas av en mesh
---
Cachen jämför sökvägar med `std::strcmp`. Ett texturobjekt kan bindas för hur många draw-anrop som helst, så mesharna kan dela det.
```
:::
:::vulkan
```quiz
`loadModel()` lägger bara till en vertex i `vertices` om `uniqueVertices` inte redan innehåller den. Vad ger det för `planet.obj`?
- [x] Vertices som delas av flera trianglar sparas en gång: 657 vertices i stället för 3168, återanvända via index buffern
- [ ] Vertices hamnar sorterade efter material
- [ ] Den tar bort trianglar som vetter bort från kameran
- [ ] Ingenting, eftersom två hörn i en OBJ-fil aldrig är lika
---
`unordered_map` behöver `operator==` och `std::hash<Vertex>` – därför gav kapitlet *Mesh* `Vertex` båda. Två hörn är samma vertex bara om position, normal, texturkoordinat och material alla är lika.
```
:::
:::d3d12
```quiz
`TextureFromFile` spelar in kopieringen av en texturs pixlar från en upload-buffer. När får den upload-buffern släppas?
- [ ] Så snart `TextureFromFile` returnerar
- [ ] I slutet av `Model::Load`
- [x] När command listen med kopieringarna har körts: i `LoadAssets`, efter `WaitForPreviousFrame()`
- [ ] Aldrig: texturen fortsätter att läsa från den
---
Att spela in en kopiering utför den inte. Först när GPU:n har kört command listen – vilket väntan på fencen bekräftar – har texturerna sina pixlar.
```
:::

```quiz
`planet.obj` räknar v från bildens nederkant, och stb_image levererar den översta raden först. learnopengls `model_loading.cpp` vänder både koordinaterna (`aiProcess_FlipUVs`) och bilden (`stbi_set_flip_vertically_on_load(true)`). Vad händer med vår planet om du gör likadant?
- [ ] Den är upprätt: två vändningar behövs för varje OBJ-fil
- [x] Texturen hamnar upp och ner: de två vändningarna tar ut varandra, och vår fil behöver exakt en
- [ ] Texturen speglas från vänster till höger
- [ ] Ingenting ritas, eftersom koordinaterna hamnar utanför sitt intervall
---
Varje vändning vänder texturen upp och ner. learnopengls ryggsäck har sina koordinater lagrade åt andra hållet, så den behöver båda; vår planet behöver en.
```

:::opengl
```quiz
Fragment shadern samplar bara `texture_diffuse1`, men ändå visar planeten `planet_diffuse.png` och ringen `rings.png`. Varför?
- [x] Varje mesh ritas med ett eget `glDrawElements`, och före det binder `Mesh::Draw` meshens texturer och pekar `texture_diffuse1` på dess diffuse map
- [ ] `texture_diffuse1` är en array med båda texturerna
- [ ] Vertices bär numret på sin textur
- [ ] Shadern kompileras en gång per mesh
---
`Model::Draw` anropar `Mesh::Draw` för varje mesh. Samplerns namn är detsamma; texturen som är bunden till dess enhet ändras mellan draw-anropen.
```
:::
:::vulkan
```quiz
Hela modellen är ett enda `vkCmdDrawIndexed`. Hur får ett fragment på ringen färgen från `rings.png`?
- [x] Dess vertices bär materialindex 1, som skickas vidare som en `flat` utdata; fragment shadern samplar båda diffuse maps och behåller ringens
- [ ] Descriptor setet byts mitt i draw-anropet
- [ ] Ringens texturkoordinater väljer den andra bindingen
- [ ] Vulkan ritar varje shape i OBJ-filen för sig
---
Båda texturerna är bundna hela tiden, på binding 1 och 2. Att sampla båda innan man väljer håller detaljnivån rätt på gränsen mellan materialen.
```
:::
:::d3d12
```quiz
Pixel shadern samplar bara `texture_diffuse1` (`t0`), men ändå visar planeten `planet_diffuse.png` och ringen `rings.png`. Varför?
- [x] Varje mesh ritas för sig, och `Mesh::Draw` sätter först root-parameter 2 till meshens egna SRV:er, så `t0` är en annan textur i varje draw-anrop
- [ ] `t0` är en array med båda texturerna
- [ ] Den statiska samplern väljer texturen efter meshen
- [ ] Vertices bär numret på sin textur
---
`SetGraphicsRootDescriptorTable(2, m_srvHandle)` pekar tabellen på meshens två platser i heapen. Registret är detsamma; descriptorerna det läser ändras mellan draw-anropen.
```
:::

```quiz
`planet.mtl` namnger texturen `planet_diffuse.png`, och modellen är `models/planet.obj`. Vilken fil måste inläsaren öppna?
- [ ] `planet_diffuse.png`, i programmets katalog
- [x] `models/planet_diffuse.png`: texturnamn i en materialfil är relativa till modellfilen
- [ ] `models/planet.obj/planet_diffuse.png`
- [ ] Den fil som `.obj`-filen innehåller: texturerna är lagrade i den
---
Det är därför learnopengls inläsare sparar modellens `directory` och sätter den framför varje texturs namn. Modeller med absoluta texturvägar fungerar ofta inte på en annan dator.
```

:::opengl
```quiz
`Mesh::setupMesh()` laddar upp `indices`, en `std::vector<unsigned int>`. Vad måste `glDrawElements` få veta?
- [x] `GL_UNSIGNED_INT` – indexen är 32-bitars, så en modell kan ha fler än 65 536 vertices
- [ ] `GL_UNSIGNED_SHORT`, eftersom index alltid är 16-bitars
- [ ] `GL_FLOAT`, som vertexdatan
- [ ] Ingenting: OpenGL känner av indextypen i buffern
---
Typen talar om för OpenGL hur byten i element buffern ska läsas. Den måste stämma med det som laddades upp.
```
:::
:::vulkan
```quiz
`indices` är en `std::vector<uint32_t>`. Vad måste `recordCommandBuffer()` skicka till `vkCmdBindIndexBuffer`?
- [x] `VK_INDEX_TYPE_UINT32` – indexen är 32-bitars, så en modell kan ha fler än 65 536 vertices
- [ ] `VK_INDEX_TYPE_UINT16`, eftersom index buffers alltid är 16-bitars
- [ ] `VK_FORMAT_R32_UINT`, som materialindexets attribut
- [ ] Ingenting: Vulkan känner av indextypen i buffern
---
Typen talar om för GPU:n hur byten i index buffern ska läsas. Den måste stämma med det som laddades upp.
```
:::
:::d3d12
```quiz
`indices` är en `std::vector<UINT>`. Vad måste meshens `D3D12_INDEX_BUFFER_VIEW` ange?
- [x] `Format = DXGI_FORMAT_R32_UINT` – indexen är 32-bitars, så en modell kan ha fler än 65 536 vertices
- [ ] `Format = DXGI_FORMAT_R16_UINT`, eftersom index buffers alltid är 16-bitars
- [ ] `StrideInBytes = sizeof(Vertex)`
- [ ] Ingenting: Direct3D känner av indextypen i buffern
---
Formatet talar om för GPU:n hur byten i index buffern ska läsas. Det måste stämma med det som laddades upp.
```
:::

```quiz
Den upplysta planeten visar bara en svag högdager där ljuset reflekteras mot kameran. Vad är anledningen?
- [ ] Ljuset har ingen spekulär komponent
- [x] Reflexen hamnar på land, och planetens specular map är mörk på land och ljus på haven
- [ ] En shininess på 32 visar aldrig någon högdager
- [ ] Modeller som läses in från filer kan inte ha spekulär ljussättning
---
Den spekulära termen multipliceras med specular mapen. Flytta kameran så att reflexen hamnar på vatten, så blir högdagern ljus.
```
