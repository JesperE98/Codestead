# Prov: Ljussättning

Visa vad du har lärt dig i *Ljussättning*: färger, Phongs ljusmodell, material, ljuskartor, de tre sorternas
ljuskällor och scener med många ljus. Frågorna täcker hela delen, och några gäller {{api}} särskilt. Svara på alla
och tryck på **Lämna in svaren**; du behöver 80 % rätt för att bli godkänd, och du kan göra provet igen.

```quiz
Ett korallfärgat objekt med färgen (1.0, 0.5, 0.31) lyses upp av ett rent grönt ljus (0.0, 1.0, 0.0). Vilken färg ser du?
- [ ] (1.0, 1.0, 0.31): ljuset lägger till sitt gröna till objektet
- [x] (0.0, 0.5, 0.0): ett mörkt grönt
- [ ] (1.0, 0.5, 0.31): ett objekt visar alltid sin egen färg
- [ ] (0.0, 0.0, 0.0): grönt ljus kan inte lysa upp ett korallfärgat objekt alls
---
Färgen vi ser är ljusets färg multiplicerad komponent för komponent med objektets färg. Objektet reflekterar hälften av det gröna och absorberar allt annat; det finns inget rött eller blått i ljuset att reflektera.
```

:::opengl
```quiz
Kuben har ritats med `lightingShader`. Vad måste renderingsloopen göra för att sedan rita lampan med `lightCubeShader`?
- [x] Aktivera `lightCubeShader`, sätta dess egna uniforms `projection`, `view` och `model`, binda `lightCubeVAO` och rita
- [ ] Bara sätta lampans `model`-uniform: `projection` och `view` delas av alla shaderprogram
- [ ] Bara anropa `lightCubeShader.use()`: kubens uniforms och VAO tas över
- [ ] Skapa en andra VBO med en kopia av kubens vertexar för lampan
---
Uniforms hör till ett shaderprogram, så lampans program behöver egna matriser. Lampans VAO läser samma VBO som kuben – bara positionsattributet.
```
:::
:::vulkan
```quiz
Kuben har ritats med `lightingPipeline`. Vad måste `recordCommandBuffer()` spela in för att sedan rita lampan med `lightCubePipeline`?
- [x] Binda `lightCubePipeline`, pusha lampans model-matris och rita; descriptor setet och vertexbufferten förblir bundna
- [ ] Binda pipelinen och sedan binda descriptor setet och vertexbufferten igen, eftersom att binda en pipeline tar bort dem
- [ ] Avsluta render passen och börja en ny för den andra pipelinen
- [ ] Inget nytt utom draw-anropet: push constants hör till pipelinen, så lampans model-matris är redan satt
---
Båda pipelines skapas med samma pipeline layout, så det bundna descriptor setet förblir giltigt, och vertexbuffertar beror inte på pipelinen. Bara pipelinen och model-matrisen ändras.
```
:::
:::d3d12
```quiz
Kuben har ritats med `m_pipelineState`. Vad måste `PopulateCommandList` spela in för att sedan rita lampan med `m_lightCubePipelineState`?
- [x] `SetPipelineState` med lampans PSO, lampans model-matris som root constants, och draw-anropet; root signaturen, descriptor tablen och vertexbufferten förblir satta
- [ ] En ny root signature med `SetGraphicsRootSignature`, eftersom varje PSO behöver ett eget root signature-objekt
- [ ] `Close` på command listen och spela in lampan i en andra
- [ ] Inget nytt utom draw-anropet: root constants hör till PSO:t, så lampans model-matris är redan satt
---
Båda PSO:na skapas med samma root signature, så root-argumenten förblir som de är när PSO:t byts. Bara pipeline state och model-matrisen ändras.
```
:::

```quiz
Vinkeln mellan ett fragments normal och riktningen mot ljuset är 60°. Båda vektorerna är normaliserade. Vilken är den diffusa faktorn `diff`?
- [ ] 0.87
- [x] 0.5
- [ ] 0.0, eftersom bara ytor som vetter rakt mot ljuset lyses upp
- [ ] 1.0, eftersom varje yta som är vänd mot ljuset lyses upp helt
---
Skalärprodukten av två enhetsvektorer är cosinus för vinkeln mellan dem: cos 60° = 0.5. Ytan får hälften av det ljus den skulle få om den vette rakt mot ljuset.
```

```quiz
Varför beräknas den diffusa faktorn som `max(dot(norm, lightDir), 0.0)` och inte bara som skalärprodukten?
- [x] För ytor som vänder sig bort från ljuset är skalärprodukten negativ, vilket skulle dra bort ljus i stället för att inte lägga till något
- [ ] Eftersom skalärprodukten kan bli större än 1 för onormaliserade vektorer
- [ ] Eftersom `dot` returnerar en vinkel i grader, och `max` gör om den till en faktor
- [ ] För att göra den upplysta sidan ljusare
---
När vinkeln är över 90° är cosinus negativ. En negativ diffus term skulle göra den ambienta och den spekulära delen mörkare, så den klampas till 0.
```

```quiz
Vertex shadern lämnar fragmentets position vidare som `FragPos`: vertexpositionen multiplicerad med bara model-matrisen, inte med view och projection. Varför?
- [x] Ljusets position anges i världsrummet, och ljussättningen behöver alla positioner och riktningar i samma rum
- [ ] Eftersom view och projection skulle göra positionen för liten för fragment shadern
- [ ] Eftersom fragment shadern bara kan ta emot vektorer med tre komponenter
- [ ] För att spara två matrismultiplikationer per vertex
---
`lightPos - FragPos` är bara riktningen mot ljuset om båda är positioner i världsrummet. Ljussättning kan också göras i vyrummet, men då måste ljusets position också transformeras.
```

```quiz
Normalerna transformeras med `transpose(inverse(model))` (utan dess translation). Varför inte helt enkelt med model-matrisens övre vänstra 3×3-del?
- [x] När model-matrisen skalar olika mycket i olika riktningar skulle de transformerade normalerna inte längre vara vinkelräta mot ytan
- [ ] Eftersom den övre vänstra 3×3-delen fortfarande innehåller translationen
- [ ] Eftersom normaler alltid måste inverteras för att peka ut ur ytan
- [ ] De två är alltid desamma; normalmatrisen är bara snabbare
---
Att skala en kub olika mycket i olika riktningar lutar dess ytor på ett annat sätt än det lutar vektorer längs normalerna. Transponatet av inversen rättar till det. För rotationer och likformig skalning stämmer de två överens, bortsett från längden – därför normaliseras normalen igen.
```

:::opengl
```quiz
learnopengl beräknar normalmatrisen i vertex shadern: `Normal = mat3(transpose(inverse(model))) * aNormal;`. Vad är nackdelen, och vad gör ett riktigt program i stället?
- [x] Matrisen inverteras på nytt för varje vertex, vilket är dyrt; beräkna den en gång per objekt på CPU:n och skicka den som en uniform
- [ ] `inverse` fungerar bara i fragment shaders; flytta raden till fragment shadern
- [ ] Det finns ingen nackdel: GPU:n beräknar den en gång per draw-anrop och återanvänder den
- [ ] `transpose` tappar precision; skicka model-matrisen två gånger i stället
---
Model-matrisen är densamma för varje vertex i kuben, så resultatet blir också detsamma. Att invertera en 4×4-matris per vertex är bortkastat arbete som CPU:n kunde göra en gång.
```
:::
:::vulkan
```quiz
Vertex shadern beräknar normalmatrisen: `fragNormal = mat3(transpose(inverse(pc.model))) * inNormal;`. Vad är nackdelen, och vad gör ett riktigt program i stället?
- [x] Matrisen inverteras på nytt för varje vertex, vilket är dyrt; beräkna den en gång per objekt på CPU:n och skicka den med model-matrisen
- [ ] `inverse` fungerar bara i fragment shaders; flytta raden till fragment shadern
- [ ] Det finns ingen nackdel: GPU:n beräknar den en gång per draw-anrop och återanvänder den
- [ ] Push constants kan inte inverteras; model-matrisen måste ligga i uniform buffern för det här
---
Model-matrisen är densamma för varje vertex i kuben, så resultatet blir också detsamma. Att invertera en 4×4-matris per vertex är bortkastat arbete som CPU:n kunde göra en gång.
```
:::
:::d3d12
```quiz
Projektet beräknar normalmatrisen på CPU:n, `XMMatrixTranspose(XMMatrixInverse(nullptr, model))`, och skickar den som root constants tillsammans med model-matrisen. Varför inte i shadern, som learnopengl gör?
- [x] HLSL har ingen funktion `inverse()`, och att invertera matrisen för varje vertex vore dyrt ändå
- [ ] Root constants kan bara hålla matriser som beräknats av DirectXMath
- [ ] Pixel shadern behöver normalmatrisen, och den kan inte läsa model-matrisen
- [ ] Eftersom DirectXMaths matriser är transponerade skulle shadern få fel invers
---
Model-matrisen är densamma för varje vertex i kuben, så CPU:n beräknar resultatet en gång per draw-anrop. Två matriser är 32 root constants, hälften av root signaturens 64 DWORD.
```
:::

```quiz
Kuben och ljuset står kvar där de är, och du går runt kuben med kameran. Vilken del av Phong-ljussättningen ändras på kubens ytor?
- [ ] Den ambienta delen
- [ ] Den diffusa delen
- [x] Den spekulära delen
- [ ] Ingen av dem: ljussättningen beror inte på kameran
---
Ambient är konstant och diffust beror bara på normalen och riktningen mot ljuset. Den spekulära högdagern beror på riktningen mot betraktaren (`viewPos`), så den flyttar sig när kameran flyttar sig.
```

:::opengl
```quiz
Fragment shadern har `uniform Material material;` med fältet `float shininess;`. Hur sätter `main.cpp` det?
- [x] `lightingShader.setFloat("material.shininess", 32.0f);`
- [ ] `lightingShader.setFloat("shininess", 32.0f);`
- [ ] Med ett enda anrop som kopierar en C++-struct `Material` till `material`
- [ ] Det går inte: uniform-structar kan bara sättas från shadern
---
Varje fält i en uniform-struct är en egen uniform, med det fullständiga namnet `material.shininess`. Det finns inget enskilt anrop för en hel struct.
```
:::
:::vulkan
```quiz
I C++-structen `DirLight` ligger en utfyllnads-float mellan `glm::vec3 direction;` och `glm::vec3 ambient;`. Varför?
- [x] I uniform-blocket (std140) börjar en `vec3` på en multipel av 16 byte, så `ambient` ligger på byte 16; utan utfyllnaden skulle C++ lägga den på byte 12
- [ ] Varje medlem i en uniform buffer måste vara en multipel av 16 byte lång, så utfyllnaden gör `direction` till en `vec4`
- [ ] Utfyllnaden lagrar ljusets w-komponent, 0 för en riktning
- [ ] Vulkan vägrar buffertar vars storlek inte är en multipel av 16 byte
---
Om offseten skiljer sig läser shadern varje följande medlem från fel byte. Utfyllnaden ger C++-structen samma offsets som std140-blocket.
```
:::
:::d3d12
```quiz
I C++-structen `DirLight` ligger `float padding0;` mellan `XMFLOAT3 direction;` och `XMFLOAT3 ambient;`. Varför?
- [x] HLSL packar en cbuffer i rader om 16 byte och en `float3` går aldrig över till nästa rad, så `ambient` börjar på byte 16; utan utfyllnaden skulle C++ lägga den på byte 12
- [ ] Varje medlem i en constant buffer måste vara en multipel av 16 byte lång, så utfyllnaden gör `direction` till en `float4`
- [ ] Utfyllnaden lagrar ljusets w-komponent, 0 för en riktning
- [ ] Eftersom en constant buffer måste vara en multipel av 256 byte
---
Om offseten skiljer sig läser shadern varje följande medlem från fel byte. Utfyllnaden ger C++-structen samma offsets som HLSL. (De 256 byten gäller storleken på hela bufferten, som avrundas uppåt för sig.)
```
:::

```quiz
Lådans specular map är svart på träplankorna och ljus på stålramen. Vad gör det?
- [ ] Plankorna ritas svarta
- [x] Plankorna får ingen spekulär högdager, medan stålramen glänser
- [ ] Stålramen får inget diffust ljus
- [ ] Högdagern på plankorna blir större och mjukare
---
Den spekulära termen multipliceras med specular mapens färg. Svart ger noll spekulärt ljus; den diffusa och den ambienta färgen kommer från diffuse map och påverkas inte.
```

```quiz
En av lådans sidor är vänd bort från ljuset. Vad ser du på den sidan när en emission map läggs till resultatet?
- [ ] Ingenting av emission map: den multipliceras med den diffusa faktorn, som är 0 där
- [x] Emission mapens tecken lyser, eftersom emission inte beror på något ljus
- [ ] Bara de delar av emission map som specular map tillåter
- [ ] Sidan lyses upp helt, som om den vette mot ljuset
---
Emission är ljus som ytan själv avger. Det läggs till efter ambient, diffust och spekulärt, så det syns lika mycket på upplysta som på mörka sidor.
```

:::opengl
```quiz
`Material` har nu `sampler2D diffuse;`, och diffuse map är bunden till texturenhet 0. Vad måste `main.cpp` sätta för samplern?
- [x] `lightingShader.setInt("material.diffuse", 0);` – texturenhetens nummer
- [ ] `lightingShader.setInt("material.diffuse", diffuseMap);` – texturobjektets id
- [ ] `lightingShader.setVec3("material.diffuse", …)` med texturens medelfärg
- [ ] Ingenting: samplers i en struct är inte tillåtna i GLSL
---
En sampler-uniform håller en texturenhet, även inuti en struct. Specular map fungerar på samma sätt, med enhet 1.
```
:::
:::vulkan
```quiz
Varför deklareras ljuskartorna som `layout(binding = 0) uniform sampler2D diffuseMap;` och så vidare, i stället för som medlemmar i `Material` i uniform-blocket?
- [x] Ett uniform-block kan inte hålla samplers, så varje karta är en combined image sampler med en egen binding
- [ ] Medlemmar i en struct kan inte vara texturer i något shaderspråk
- [ ] Så att varje karta kan använda en egen `VkSampler`
- [ ] Eftersom push constants måste hålla materialet
---
Opaka typer som samplers kan inte ligga i en buffert; de är egna descriptors. Därför ligger kartorna på binding 0, 1 och 3 – binding 2 är uniform buffern.
```
:::
:::d3d12
```quiz
Varför deklareras ljuskartorna som `Texture2D diffuseMap : register(t0);` och så vidare, i stället för som medlemmar i `Material` i cbuffern?
- [x] Texturer kan inte vara medlemmar i en cbuffer; de är SRV:er, som nås via en descriptor table
- [ ] Medlemmar i en struct kan inte vara texturer i något shaderspråk
- [ ] Så att varje karta kan använda en egen statisk sampler
- [ ] Eftersom root constants måste hålla materialet
---
En constant buffer håller vanliga värden. Texturer är egna resurser, med views (SRV:er) i descriptor heapen; tablen i root-parameter 2 avbildar dem på `t0`, `t1`, ….
```
:::

```quiz
Det riktade ljusets riktning är (-0.2, -1.0, -0.3), men shadern använder `lightDir = normalize(-light.direction)`. Varför minustecknet?
- [x] Den angivna riktningen pekar från ljuset in i scenen, medan ljusberäkningarna behöver riktningen från fragmentet mot ljuset
- [ ] Eftersom riktade ljus lyser uppåt
- [ ] För att göra om riktningen till en position oändligt långt bort
- [ ] Eftersom normalerna pekar in i ytan
---
Den diffusa faktorn är `dot(norm, lightDir)` med `lightDir` pekande mot ljuset, som i `lightPos - FragPos` för ett punktljus. Att negera ljusets riktning ger precis det.
```

```quiz
Dämpningen är `1.0 / (constant + linear * d + quadratic * d²)` med `constant = 1.0`. Varför är den konstanta termen 1.0?
- [x] Den håller nämnaren på minst 1, så att dämpningen aldrig gör ett ljus starkare än det är
- [ ] Den sätter ljusets räckvidd till en enhet
- [ ] Den gör att ljuset avtar linjärt
- [ ] Utan den skulle ljuset bli för svagt nära källan
---
Med en konstant term under 1 skulle dämpningen bli större än 1 nära ljuset och göra det starkare. Med 1.0, 0.09 och 0.032 avtar ljuset över ett avstånd på ungefär 50 enheter.
```

```quiz
En spotlight har `cutOff = cos(12.5°)`, och `theta` är skalärprodukten av `lightDir` och spotlightens (negerade) riktning. När ligger ett fragment inuti konen?
- [ ] När `theta < cutOff`, eftersom en mindre vinkel ligger innanför
- [x] När `theta > cutOff`, eftersom cosinus blir större när vinkeln blir mindre
- [ ] När `theta` är lika med 12.5
- [ ] När `theta` är negativ
---
Båda värdena är cosinusvärden, inte vinklar. Ett fragment rakt framför ljuset har vinkeln 0° och `theta` = 1; vid konens kant är `theta` = cos 12.5° ≈ 0.976. Att jämföra cosinusvärden sparar en `acos`.
```

```quiz
I den sista scenen lyses ett fragment upp av det riktade ljuset, fyra punktljus och ficklampan. Hur kombinerar fragment shadern dem?
- [x] Den lägger ihop alla ljusens bidrag
- [ ] Den tar medelvärdet av bidragen
- [ ] Den använder bara det starkaste ljuset
- [ ] Den multiplicerar bidragen
---
Ljus adderas: varje `Calc…Light`-funktion returnerar ett ljus ambienta, diffusa och spekulära del, och resultaten summeras. Där summan blir större än 1 klampas färgen som skrivs till fönstret till 1.
```

:::opengl
```quiz
Shadern deklarerar `uniform PointLight pointLights[NR_POINT_LIGHTS];`. Hur sätter `main.cpp` positionen för det tredje punktljuset?
- [x] `lightingShader.setVec3("pointLights[2].position", pointLightPositions[2]);`
- [ ] `lightingShader.setVec3("pointLights.position[2]", pointLightPositions[2]);`
- [ ] `lightingShader.setVec3("pointLights[3].position", pointLightPositions[3]);`
- [ ] Med ett anrop som sätter hela arrayen från `pointLightPositions`
---
Varje fält i varje element är en egen uniform, namngiven med elementets index (som börjar på 0) och fältet.
```
:::
:::vulkan
```quiz
Uniform-blocket håller `PointLight pointLights[NR_POINT_LIGHTS];`, och C++-structen `UniformBufferObject` håller `PointLight pointLights[4];`. Vad gör att de två arrayerna stämmer överens?
- [x] C++-structen `PointLight` har samma layout som std140-structen, utfyllnad inräknad, så båda arrayerna har samma stride: 80 byte
- [ ] Vulkan kopierar varje arrayelement till en egen descriptor
- [ ] Ingenting: arrayer av structar kan inte ligga i ett uniform-block, så shadern läser fyra separata block
- [ ] `#define NR_POINT_LIGHTS 4` i `main.cpp`, som talar om arrayens längd för Vulkan
---
Uniform buffern är bara byte. Om varje element har samma storlek och samma offsets på båda sidor hamnar element i där shadern förväntar sig det.
```
:::
:::d3d12
```quiz
Cbuffern håller `PointLight pointLights[NR_POINT_LIGHTS];`, och C++-structen `SceneConstantBuffer` håller `PointLight pointLights[4];`. Vad gör att de två arrayerna stämmer överens?
- [x] C++-structen `PointLight` har samma layout som HLSL packar den med, utfyllnad inräknad, så varje element är 80 byte och börjar på en ny rad om 16 byte på båda sidor
- [ ] Direct3D kopierar varje arrayelement till en egen constant buffer view
- [ ] Ingenting: arrayer av structar kan inte ligga i en cbuffer, så shadern läser fyra separata cbuffers
- [ ] `#define NR_POINT_LIGHTS 4` i `main.cpp`, som talar om arrayens längd för Direct3D
---
Constant buffern är bara byte. I en cbuffer börjar varje arrayelement på en ny rad om 16 byte; eftersom C++-structen är en multipel av 16 byte hamnar element i där shadern förväntar sig det.
```
:::
