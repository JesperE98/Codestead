# Sammanfattning: Ljussättning

Grattis, du har nått slutet av delen *Ljussättning*. Du började med en korallfärgad kub i ett vitt ljus och slutade
med en scen med tio lådor som lyses upp av en sol, fyra punktljus och en ficklampa – allt beräknat i dina egna
shaders. Den här sidan är en ordlista över delens viktigaste begrepp, kapitel för kapitel, som den genomgång
learnopengl.com har i slutet av sin del om ljussättning. Använd den för att slå upp saker, och som en kontroll: om en
definition överraskar dig, gå tillbaka till kapitlet den kommer från.

Begreppen utanför rutorna är desamma i alla API:er: ljussättning är matematik i shaders, och matematiken beror inte
på API:t. Rutorna visar hur {{api}} får fram värdena till shaders. När du är klar kontrollerar provet i slutet av
delen vad du har lärt dig.

## Färger

- **Färg**: en vektor med rött, grönt och blått, var och en från 0.0 till 1.0.
- **Reflekterad färg**: färgen vi ser är ljusets färg multiplicerad komponent för komponent med objektets färg:
  objektet absorberar resten. Ett korallfärgat objekt (1.0, 0.5, 0.31) ser korallfärgat ut i vitt ljus; i ett grönt
  ljus (0.0, 1.0, 0.0) ser det ut som (0.0, 0.5, 0.0), mörkgrönt.
- **Ljuskälla** (**lampan**): en liten vit kub vid `lightPos` (1.2, 1.0, 2.0) som visar var ljuset finns. Den har
  egna shaders, så att den förblir vit vad ljussättningens shaders än gör.
- **Ljussättningsscenen**: kursens kapitel om ljussättning rensar till mörkgrått (0.1, 0.1, 0.1) och börjar med
  kameran snett framför kuben till vänster, så att dess upplysta framsida och lampan syns.

## Grundläggande ljussättning

- **Phongs ljusmodell**: ljuset på en yta som summan av tre delar: **ambient**, **diffust** och **spekulärt**.
- **Ambient ljus**: en liten konstant del av ljusets färg (här 0.1 av den), så att inte ens ytor som vänder sig bort
  från ljuset blir helt svarta – en billig ersättning för ljus som studsar runt i scenen (*global illumination*).
- **Normalvektor**: en enhetsvektor som är vinkelrät mot en yta. Kuben har en per vertex, som ett nytt
  vertexattribut.
- **Fragmentets position** (`FragPos`): fragmentets position i världsrummet – vertexpositionen gånger bara
  model-matrisen – eftersom ljusets position anges i världsrummet.
- **Diffust ljus**: ju rakare en yta vetter mot ljuset, desto ljusare är den:
  `diff = max(dot(norm, lightDir), 0.0)` med `lightDir = normalize(lightPos - FragPos)`. Båda vektorerna måste vara
  normaliserade; `max` hindrar att ytor som vänder sig bort från ljuset får negativt ljus.
- **Normalmatris**: `transpose(inverse(model))`, utan sin translation. Den vrider normalerna med objektet och håller
  dem vinkelräta mot ytan även när model-matrisen skalar olika mycket i olika riktningar.
- **Spekulärt ljus**: den ljusa högdagern där ljuset reflekteras mot betraktaren:
  `reflectDir = reflect(-lightDir, norm)`, `viewDir = normalize(viewPos - FragPos)` och
  `spec = pow(max(dot(viewDir, reflectDir), 0.0), 32)`. Det beror på var kameran är (`viewPos`).
- **Shininess** (glans): exponenten i den spekulära termen. Ju högre den är, desto mindre och skarpare blir
  högdagern.
- **Phong shading** och **Gouraud shading**: ljuset beräknat per fragment (det kursen gör) eller bara per vertex och
  interpolerat, vilket är billigare men förlorar högdagerns form.

## Material

- **Material**: ytans färger för varje del av ljussättningen – `ambient`, `diffuse` och `specular` – och dess
  `shininess`. De ersätter den enda objektfärgen och de fasta styrkorna 0.1, 0.5 och 32.
- **Ljusets egenskaper**: ljusets intensitet för varje del – `ambient` (0.2), `diffuse` (0.5) och `specular` (1.0) i
  learnopengls exempel – plus dess `position`.
- **Struct**: båda är structar i shadern, `Material material` och `Light light`.
- **Färgat ljus**: att ändra ljusets färg över tid ändrar också objektets färg, eftersom de två multipliceras.

## Ljuskartor

- **Ljuskarta** (lighting map): en textur som ger en ljusegenskap per fragment i stället för per objekt.
- **Diffuse map**: en textur med ytans diffusa färg; den ambienta färgen tas också från den, eftersom den nästan
  alltid är samma färg.
- **Specular map**: en textur med den spekulära intensiteten: svart där ytan inte glänser (träplankorna), ljus där den
  gör det (stålramen).
- **Emission map**: ljus som ytan själv avger. Det läggs till efter ljussättningen och beror inte på något ljus, så
  det lyser även på ytor i mörker.
- **Texturkoordinater**: tillbaka som vertexattribut, bredvid positionen och normalen.

## Ljuskällor

- **Ljuskälla** (light caster): en ljuskälla som kastar ljus på objekt. Det finns tre sorter.
- **Riktat ljus** (directional light): ett ljus oändligt långt bort, som solen: dess strålar är parallella och kommer
  från samma håll överallt, så det har en riktning men ingen position. Riktningen pekar *från* ljuset, så shadern
  använder `lightDir = normalize(-light.direction)`.
- **Punktljus**: ett ljus vid en position som lyser åt alla håll och blir svagare med avståndet.
- **Dämpning** (attenuation): hur ljuset avtar med avståndet d: `1.0 / (constant + linear * d + quadratic * d²)`. Den
  konstanta termen 1.0 håller resultatet på högst 1; värdena 1.0, 0.09 och 0.032 täcker ett avstånd på ungefär 50
  enheter. Ambient, diffust och spekulärt multipliceras alla med den.
- **Spotlight**: ett ljus vid en position som lyser åt ett håll, inom en kon – här en **ficklampa** vid kameran, som
  pekar dit kameran tittar.
- **Cut-off-vinkel**: konens halva öppningsvinkel. Shadern jämför cosinusvärden, inte vinklar: `theta`,
  skalärprodukten av `lightDir` och spotlightens riktning, ligger inuti konen när `theta > cutOff`, eftersom cosinus
  blir *större* när vinkeln blir mindre.
- **Mjuka kanter**: en inre och en **yttre cut-off**; mellan dem går intensiteten från 1 till 0:
  `clamp((theta - outerCutOff) / (cutOff - outerCutOff), 0.0, 1.0)`.

## Flera ljuskällor

- **Att kombinera ljus**: varje ljus lägger till sitt eget bidrag; fragmentets färg är summan.
- **En funktion per ljustyp**: `CalcDirLight`, `CalcPointLight` och `CalcSpotLight` beräknar ett ljus ambienta,
  diffusa och spekulära del, vilket håller shadern läsbar.
- **Arrayer av ljus**: `#define NR_POINT_LIGHTS 4`, en array av `PointLight`-structar och en loop som lägger till
  vart och ett.
- **Scenen**: ett riktat ljus, fyra punktljus (vart och ett med en lampa) och ficklampan på tio lådor.

## Hur värdena kommer fram till shaders

:::opengl
- **Uniform-structar**: `uniform Material material;` och `uniform Light light;`. Varje fält är en egen uniform som
  sätts med sitt fullständiga namn: `lightingShader.setVec3("material.ambient", …)`,
  `setFloat("material.shininess", 32.0f)`.
- **Arrayer av structar**: varje elements fält sätts också med namn: `setVec3("pointLights[0].position", …)`.
- **Samplers i en struct**: `sampler2D diffuse;` kan vara ett fält i `Material`; `setInt("material.diffuse", 0)`
  sätter det till texturenhet 0, specular map ligger på enhet 1 och emission map på enhet 2.
- **Lampan**: ett andra shaderprogram (`lightCubeShader`) och en andra VAO (`lightCubeVAO`) som läser samma VBO, med
  bara positionsattributet.
- **Vertexattribut**: normalen är attribut 1 och texturkoordinaterna attribut 2, som läses med
  `glVertexAttribPointer` ur samma VBO.
- **Normalmatris**: beräknas i vertex shadern, `mat3(transpose(inverse(model))) * aNormal`. Att invertera en matris för
  varje vertex är dyrt; i ett riktigt program beräknar du den en gång per objekt på CPU:n och skickar den som en
  uniform.
:::
:::vulkan
- **En uniform buffer för bildrutan**: view, projection, `viewPos`, materialet och ljusen är medlemmar i
  uniform-blocket på **binding 2**, som fylls i `updateUniformBuffer()`. Dess `stageFlags` omfattar nu även
  fragmentsteget.
- **std140-layout**: ett uniform-block lägger ut sina medlemmar enligt std140-reglerna: en `vec3` börjar på en
  multipel av 16 byte, och det gör en struct också. C++-structen får samma offsets tack vare en utfyllnads-`float`
  efter varje `glm::vec3` som inte följs av en float; en array av `PointLight` har samma stride (80 byte) på båda
  sidor.
- **Model-matrisen**: fortfarande en push constant, som sätts före varje draw-anrop.
- **Lampan**: en andra `VkPipeline` (`lightCubePipeline`) med egna shaders och samma pipeline layout, gjord med
  hjälpfunktionen `createPipeline`; descriptor setet och vertexbufferten förblir bundna när du byter.
- **Vertexattribut**: normalen är location 1 och texturkoordinaterna location 2, beskrivna i
  `getAttributeDescriptions()`.
- **Normalmatris**: beräknas i vertex shadern, `mat3(transpose(inverse(pc.model))) * inNormal`. Att invertera en
  matris för varje vertex är dyrt; i ett riktigt program beräknar du den en gång per objekt på CPU:n.
- **Ljuskartor**: ett uniform-block kan inte hålla en sampler, så kartorna är combined image samplers med egna
  bindings: diffuse map på binding 0, specular map på binding 1 och emission map på binding 3 (binding 2 är uniform
  buffern). De delar på en `VkSampler`.
:::
:::d3d12
- **En constant buffer för bildrutan**: view, projection, `viewPos`, materialet och ljusen är medlemmar i
  `cbuffer SceneConstantBuffer` på register **b1**, som läses via CBV:n i descriptor tablen i root-parameter 1 och
  skrivs i `OnUpdate`. Dess storlek avrundas uppåt till en multipel av 256 byte
  (`CalculateConstantBufferByteSize`).
- **HLSL-packning**: en cbuffer packas i rader om 16 byte, och en `float3` går aldrig över från en rad till nästa; en
  struct och varje arrayelement börjar på en ny rad. C++-structarna matchar med utfyllnads-`float`s, till exempel
  `XMFLOAT3 position; float padding0;`.
- **Root constants för objektet**: `ModelConstants` (register b0, root-parameter 0) håller model-matrisen och
  normalmatrisen: 32 av root signaturens 64 DWORD.
- **Normalmatris**: beräknas på CPU:n, `XMMatrixTranspose(XMMatrixInverse(nullptr, model))`, eftersom HLSL inte har
  någon `inverse()` – och att invertera per vertex vore dyrt ändå. Den lagras transponerad, som varje matris.
- **Lampan**: ett andra pipeline state object (`m_lightCubePipelineState`) med egna shaders och samma root signature;
  `SetPipelineState` byter till det före lampans draw-anrop.
- **Vertexattribut**: input elements med semantiken `NORMAL` (byte-offset 12) och `TEXCOORD` (byte-offset 24).
- **Ljuskartor**: texturer kan inte vara medlemmar i en cbuffer, så kartorna är SRV:er i descriptor heapen efter
  CBV:n, som syns som `Texture2D` på `t0` (diffuse), `t1` (specular) och `t2` (emission) via descriptor tablen i
  root-parameter 2, och läses med den statiska samplern `s0`.
- **Namn**: `linear` är ett ord i HLSL (en interpolationsmodifierare), så dämpningstermerna heter `constantTerm`,
  `linearTerm` och `quadraticTerm`; avståndet heter `dist`, eftersom `distance` är en HLSL-funktion.
:::

## Samma idé i tre API:er

| Idé | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Material- och ljusvärden | uniform-structar, satta med namn | uniform buffer (std140), binding 2 | constant buffer (HLSL-packning), `b1` |
| Model-matris | uniform | push constant | root constants, `b0` |
| Normalmatris | i vertex shadern | i vertex shadern | på CPU:n, i root constants |
| Lampans egna shaders | andra shaderprogrammet | andra `VkPipeline` | andra PSO:t |
| Ljuskartor | `sampler2D` i `Material`, texturenhet 0–2 | combined image samplers, binding 0, 1, 3 | SRV:er `t0`–`t2`, statisk sampler `s0` |
| Normalattribut | location 1 | location 1 | semantiken `NORMAL` |

Med ljussättningen klar har du kärnan i varje 3D-renderare: geometri, en kamera, texturer och ljus beräknat per
fragment.
