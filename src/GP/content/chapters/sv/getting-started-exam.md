# Prov: Kom igång

Visa vad du har lärt dig i *Kom igång*: fönstret och bildrutan, triangeln och dess shaders, texturer,
transformationer, koordinatsystem och kameran. Frågorna täcker hela delen, och några gäller {{api}} särskilt. Svara
på alla och tryck på **Lämna in svaren**; du behöver 80 % rätt för att bli godkänd, och du kan göra provet igen.

:::opengl
```quiz
Ditt program skapar ett GLFW-fönster, gör dess kontext aktuell och kraschar sedan på sitt allra första OpenGL-anrop, `glClearColor`. Vilket steg saknas troligen?
- [ ] `glViewport(0, 0, 800, 600)` före det första OpenGL-anropet
- [x] `gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)` efter att kontexten gjorts aktuell
- [ ] `glfwPollEvents()` före det första OpenGL-anropet
- [ ] `glfwSwapBuffers(window)` en gång före renderingsloopen
---
Adresserna till OpenGL-funktionerna blir kända först när programmet körs; GLAD letar upp dem i drivrutinen. Utan den är `glClearColor` en nollpekare till en funktion, och anropet kraschar.
```
:::
:::vulkan
```quiz
I vilken ordning skapar projektet de här Vulkan-objekten?
- [x] Instans, window surface, fysisk enhet, logisk enhet, swap chain
- [ ] Logisk enhet, instans, fysisk enhet, window surface, swap chain
- [ ] Fysisk enhet, instans, swap chain, window surface, logisk enhet
- [ ] Instans, swap chain, logisk enhet, fysisk enhet, window surface
---
Allt börjar med instansen. Surfacen kommer sedan, eftersom valet av fysisk enhet behöver veta vilken queue family som kan presentera till den. Den logiska enheten skapas från den fysiska, och swap chainen från den logiska enheten och surfacen.
```
:::
:::d3d12
```quiz
I vilken ordning sätter projektet upp Direct3D 12?
- [x] Debug layer, DXGI-factory, adapter, device, command queue, swap chain
- [ ] Device, DXGI-factory, swap chain, command queue, debug layer
- [ ] DXGI-factory, swap chain, adapter, device, command queue
- [ ] Adapter, device, debug layer, swap chain, command queue
---
Debug layer måste slås på innan devicen skapas. Factoryn hittar adaptern, adaptern ger devicen, och swap chainen skapas för den command queue som ska presentera till den.
```
:::

```quiz
Varför ritar ett program varje bildruta i en back buffer och byter (presenterar) den först därefter?
- [x] Så att fönstret aldrig visar en bildruta som fortfarande håller på att ritas
- [ ] Så att GPU:n kan rita dubbelt så många bildrutor per sekund
- [ ] Så att rensningsfärgen bara behöver sättas en gång, i början av programmet
- [ ] Så att fönstrets händelser kan hanteras medan GPU:n ritar
---
Fönstret visar alltid en färdig bild (front buffern) medan nästa ritas. Bytet ersätter den på en gång, utan flimret från en halvritad bild.
```

:::opengl
```quiz
Renderingsloopen anropar `glClearColor(0.2f, 0.3f, 0.3f, 1.0f);` varje bildruta men aldrig `glClear`. Vad händer?
- [ ] Fönstret blir blågrönt: `glClearColor` rensar färgbufferten
- [x] Ingenting rensas: `glClearColor` sätter bara tillstånd, som `glClear(GL_COLOR_BUFFER_BIT)` skulle använda
- [ ] Fönstret blir blågrönt så fort `glfwSwapBuffers` visar back buffern
- [ ] OpenGL rapporterar ett fel eftersom rensningsfärgen aldrig används
---
`glClearColor` är en tillståndsändrande funktion: den ändrar kontextens rensningsfärg. `glClear` är den tillståndsanvändande funktionen som faktiskt fyller bufferten med den.
```
:::
:::vulkan
```quiz
I början av `drawFrame()` måste CPU:n vänta tills GPU:n är klar med den förra bildrutan. Vilket objekt sköter det?
- [ ] Semaforen `imageAvailableSemaphore`
- [x] Fencen `inFlightFence`, med `vkWaitForFences` (och `vkResetFences` efteråt)
- [ ] Render passen, som först slutar när GPU:n har ritat klart
- [ ] `vkQueueSubmit`, som returnerar när command buffern har körts
---
Semaforer ordnar arbete på GPU:n (hämta bild → rendera → presentera) utan att blockera CPU:n. En fence är hur CPU:n väntar på GPU:n. `vkQueueSubmit` returnerar direkt, långt innan kommandona har körts.
```
:::
:::d3d12
```quiz
Vad måste command listen spela in innan `ClearRenderTargetView` kan rensa den aktuella back buffern?
- [ ] En `Signal` på fencen, så att GPU:n vet att rensningen får börja
- [x] En övergångsbarriär från `D3D12_RESOURCE_STATE_PRESENT` till `D3D12_RESOURCE_STATE_RENDER_TARGET` (och den omvända före `Present`)
- [ ] Att en ny render target view skapas för back buffern
- [ ] Ett anrop till `Present`, som gör bufferten till back buffer
---
En back buffer som lämnats till swap chainen är i tillståndet `PRESENT`; för att rendera till den måste den vara i tillståndet `RENDER_TARGET`. RTV:erna skapas en gång, och fencen är till för CPU:n.
```
:::

```quiz
Efter perspektivdivisionen har ett av en triangels hörn x = 1.5; de två andra ligger en bra bit inne i fönstret. Vad ser du?
- [ ] Hela triangeln, ihoptryckt så att x = 1.5 hamnar vid fönstrets högra kant
- [x] Den del av triangeln som ligger inuti vyvolymen; resten klipps vid fönstrets högra kant
- [ ] Ingenting: en triangel med en vertex utanför vyvolymen kastas
- [ ] Hela triangeln; hörnet utanför fönstret ritas bortom dess kant
---
Bara koordinater mellan -1 och 1 i x och y hamnar i viewporten. En triangel som delvis ligger utanför klipps: GPU:n skär av den till delen som ligger innanför.
```

```quiz
En triangels tre hörn är röda, gröna och blå, och vertex shadern lämnar varje vertex färg vidare till fragment shadern. Vilken färg får fragmentet precis i triangelns mitt?
- [ ] Röd, färgen på den första vertexen
- [x] En blandning med en tredjedel av varje, ungefär (0.33, 0.33, 0.33)
- [ ] Vit, summan av de tre färgerna
- [ ] Den är odefinierad: fragment shadern får bara färger vid vertexarna
---
Rasteriseraren interpolerar vertex shaderns utdata över triangeln. I mitten väger alla tre vertexarna lika mycket, så varje färg bidrar med en tredjedel.
```

:::opengl
```quiz
Varje vertex består nu av 3 floats position följda av 3 floats färg. Vilket anrop beskriver färgattributet på location 1?
- [ ] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);`
- [x] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));`
- [ ] `glVertexAttribPointer(1, 6, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);`
- [ ] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)(3 * sizeof(float)));`
---
Stride är storleken på en hel vertex (6 floats); offset är var färgen börjar inuti en vertex (efter de 3 positionsvärdena). Storleken är antalet komponenter i attributet, 3.
```
:::
:::vulkan
```quiz
`struct Vertex` har nu en position och en färg. Var beskrivs vertexens stride och färgens offset?
- [x] Stride i `VkVertexInputBindingDescription` (`sizeof(Vertex)`), offset i färgens `VkVertexInputAttributeDescription` (`offsetof(Vertex, color)`)
- [ ] Båda i färgens `VkVertexInputAttributeDescription`
- [ ] Båda i anropet till `vkCmdBindVertexBuffers`
- [ ] I vertex shadern, med `layout(location = 1, offset = 12)`
---
Binding description säger hur bufferten ska stegas igenom (stride, per vertex); varje attribute description säger var dess attribut finns (location, format, offset). Båda är en del av pipelinens tillstånd för vertexindata.
```
:::
:::d3d12
```quiz
`struct Vertex` har nu en position och en färg. Var beskrivs vertexens stride och färgens offset?
- [x] Stride i vertex buffer view (`StrideInBytes = sizeof(Vertex)`), offset i färgens input element i input layouten (byte-offset 12)
- [ ] Båda i färgens input element i input layouten
- [ ] Båda i root signaturen
- [ ] I vertex shadern, med semantiken `COLOR12`
---
Vertex buffer view säger var bufferten finns, hur stor den är och hur långt det är mellan vertexarna. Varje input element i input layouten säger var dess attribut ligger inuti en vertex. Talet efter en semantik är ett semantiskt index, inte en offset.
```
:::

```quiz
En rektangel ritas som två trianglar med indexerad ritning. Hur många vertexar och hur många index behöver den?
- [ ] 6 vertexar och 6 index
- [x] 4 vertexar och 6 index
- [ ] 4 vertexar och 4 index
- [ ] 6 vertexar och 4 index
---
De två trianglarna delar två hörn. Med en indexbuffert lagras varje hörn en gång (4 vertexar), och de 6 indexen säger vilka hörn varje triangel består av.
```

:::opengl
```quiz
Tio kuber ritas genom att `model`-uniformen sätts och `glDrawArrays` anropas, tio gånger per bildruta. Varför får varje kub sin egen matris?
- [x] Varje draw-anrop använder de uniform-värden som programmet har i det ögonblick anropet görs
- [ ] OpenGL behåller en egen kopia av varje uniform för varje draw-anrop fram till `glfwSwapBuffers`
- [ ] Varje anrop till `setMat4` skapar en ny uniform med samma namn
- [ ] Det gör den inte: alla tio kuberna får den sista matrisen som sattes
---
En uniform behåller sitt värde tills du ändrar det, och OpenGL ser till att varje draw-anrop använder de värden som gäller när det görs. Därför räcker det att sätta model-matrisen före varje draw-anrop.
```
:::
:::vulkan
```quiz
Tio kuber ritas per bildruta. Varför är varje kubs model-matris en push constant, medan view och projection ligger i uniform buffern?
- [x] Push constants spelas in i command buffern per draw-anrop; uniform bufferns innehåll läses först när GPU:n kör kommandona, så tio matriser skrivna i den skulle alla bli den sista
- [ ] Uniform buffers kan bara hålla två matriser
- [ ] Push constants läses bara av vertex shadern, uniform buffers bara av fragment shadern
- [ ] Push constants behålls till nästa bildruta, uniform buffers bara till nästa draw-anrop
---
`vkCmdPushConstants` kopierar byten in i command buffern, så varje draw-anrop ser de värden som pushats före det. En descriptor pekar bara på bufferten; det den innehåller när GPU:n kör kommandona är vad varje draw-anrop i bildrutan ser – rätt för view och projection, fel för model-matrisen.
```
:::
:::d3d12
```quiz
Tio kuber ritas per bildruta. Varför ligger varje kubs model-matris i root constants, medan view och projection ligger i constant buffern?
- [x] Root constants spelas in i command listen per draw-anrop; constant bufferns innehåll läses först när GPU:n kör kommandona, så tio matriser skrivna i den skulle alla bli den sista
- [ ] En constant buffer kan bara hålla två matriser
- [ ] Root constants läses bara av vertex shadern, constant buffers bara av pixel shadern
- [ ] Root constants behålls till nästa bildruta, constant buffers bara till nästa draw-anrop
---
`SetGraphicsRoot32BitConstants` spelar in värdena i command listen, så varje draw-anrop ser de värden som satts före det. CBV:n pekar bara på bufferten; det den innehåller när GPU:n kör kommandona är vad varje draw-anrop i bildrutan ser – rätt för view och projection, fel för model-matrisen.
```
:::

```quiz
Ett stort golv med en detaljerad textur sträcker sig långt bort, och långt borta flimrar det och ser brusigt ut. Vad hjälper?
- [ ] Nearest-filtrering som förstoringsfilter
- [x] Mipmaps, med ett förminskningsfilter som använder dem
- [ ] Clamp-to-edge-wrapping i stället för repeat
- [ ] En textur med högre upplösning
---
Långt borta faller många texlar på en pixel (texturen förminskas), och att välja en av dem ger en annan, slumpmässig färg från bildruta till bildruta. En mindre, förfiltrerad mipnivå ger rätt medelfärg. En större textur skulle göra det värre.
```

:::opengl
```quiz
Fragment shadern deklarerar `uniform sampler2D texture1;` och `uniform sampler2D texture2;`. Vad får `texture2` att läsa ansiktsbilden?
- [x] `ourShader.setInt("texture2", 1);` en gång, och `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D, texture2);` före ritningen
- [ ] `glBindTexture(GL_TEXTURE_2D, texture2);` direkt efter att `texture1` har bundits
- [ ] `ourShader.setInt("texture2", texture2);` med texturobjektets id
- [ ] Bara `glActiveTexture(GL_TEXTURE1);`: samplern hittar texturen via sitt namn
---
En sampler-uniform håller numret på en texturenhet, inte ett textur-id. Att binda ansiktet till enhet 1 och sätta samplern till 1 kopplar ihop dem. Att binda utan att byta aktiv enhet skulle ersätta lådan på enhet 0.
```
:::
:::vulkan
```quiz
Fragment shadern läser ansiktet med `layout(binding = 1) uniform sampler2D faceSampler;`. Vad behöver ansiktstexturen på C++-sidan, utöver sin bild och sin image view?
- [x] En andra binding (binding 1, en combined image sampler) i descriptor set layouten, plats för den i poolen, och en descriptor-skrivning med dess image view och samplern
- [ ] En andra `VkSampler`, eftersom en sampler hör till en bild
- [ ] Ett andra descriptor set, bundet med `vkCmdBindDescriptorSets` på index 1
- [ ] En andra vertexbuffert-binding, så att `vkCmdBindVertexBuffers` kan skicka med bilden
---
Bindings fyller samma roll som OpenGL:s texturenheter: var och en är en plats i descriptor setet som shadern namnger. En sampler hör inte till någon bild, så samma `textureSampler` läser båda.
```
:::
:::d3d12
```quiz
Pixel shadern läser ansiktet med `Texture2D texture2 : register(t1);`. Vad behöver ansiktstexturen på C++-sidan, utöver texturresursen?
- [x] Sin SRV på platsen i heapen direkt efter lådans, och ett descriptor-intervall med 2 SRV:er som börjar på `t0`
- [ ] En andra statisk sampler på register `s1`, eftersom en sampler hör till en textur
- [ ] En andra root signature för den andra texturen
- [ ] En andra vertex buffer view, så att `IASetVertexBuffers` kan skicka med texturen
---
Register fyller samma roll som OpenGL:s texturenheter: descriptor tablen täcker descriptors som ligger efter varandra i heapen, och de blir `t0`, `t1`, … En sampler hör inte till någon textur, så `s0` läser båda.
```
:::

```quiz
Med kolumnvektorer (som i läroboken och GLM) vill du att varje vertex först skalas, sedan roteras och sist flyttas. Vilken matris använder du?
- [ ] `S · R · T`
- [x] `T · R · S`
- [ ] `R · T · S`
- [ ] Vilken som helst: ordningen i matrismultiplikation spelar ingen roll
---
Med kolumnvektorer tillämpas matrisen närmast vektorn – den längst till höger – först: `T · R · S · v` skalar, roterar och flyttar sedan. Matrismultiplikation är inte kommutativ, så ordningen spelar roll.
```

:::opengl
```quiz
Om programmet inte anropade `stbi_set_flip_vertically_on_load(true)` skulle lådan visas upp och ned. Varför?
- [x] OpenGL lägger texturkoordinat 0.0 på y-axeln vid datans första rad, som den behandlar som bildens nederkant, medan bildfiler lagrar den översta raden först
- [ ] stb_image läser in bilder spegelvända, i alla API:er
- [ ] Vertex shadern vänder y eftersom OpenGL:s NDC har y nedåt
- [ ] Texturens wrapping-läge `GL_REPEAT` vänder på bilden
---
`glTexImage2D` tar datans första rad som texturens nederkant (t = 0). Bildfiler börjar med den översta raden, så utan vändningen kommer bilden upp och ned.
```
:::
:::vulkan
```quiz
Varför multiplicerar projektet `proj[1][1]` med -1 efter `glm::perspective`?
- [x] GLM skrevs för OpenGL, där y pekar uppåt i klipprummet; i Vulkan pekar det nedåt, så y-skalan vänds för att +y ska hamna överst i fönstret
- [ ] För att avbilda djupet från -1..1 till 0..1
- [ ] Eftersom Vulkans texturkoordinater börjar längst upp i bilden
- [ ] Eftersom swap chainen lagrar sina bilder med den nedersta raden först
---
Utan vändningen skulle hela scenen stå upp och ned. Djupintervallet är en annan skillnad, som `GLM_FORCE_DEPTH_ZERO_TO_ONE` tar hand om.
```
:::
:::d3d12
```quiz
Projektionen görs med `XMMatrixPerspectiveFovRH`. Vad händer om du bygger vymatrisen med `XMMatrixLookAtLH` i stället för `XMMatrixLookAtRH`?
- [x] LH-vymatrisen får kameran att titta längs +z, men RH-projektionen förväntar sig att den tittar längs -z, så scenen hamnar bakom kameran
- [ ] Ingenting: LH och RH skiljer sig bara i hur de lagrar matrisen
- [ ] Bilden blir spegelvänd i sidled men är annars rätt
- [ ] Djupintervallet ändras från 0..1 till -1..1
---
Vymatrisen och projektionen måste vara överens om vyrummet. Kursen använder de högerhänta funktionerna överallt, som har samma vyrum som GLM och OpenGL.
```
:::

:::opengl
```quiz
Transformationen skickas med `glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(transform));`. Varför är det tredje argumentet `GL_FALSE`?
- [x] Det betyder "transponera inte": GLM lagrar sina matriser kolumn för kolumn, vilket är den ordning OpenGL förväntar sig
- [ ] Det betyder att matrisen inte är normaliserad, vilket är rätt för transformationer
- [ ] Det betyder att uniformen bara sätts en gång, inte varje bildruta
- [ ] GLM-matriser är radvisa, och OpenGL transponerar dem på egen hand
---
Argumentet ber OpenGL att transponera matrisen när den läses. GLM:s minneslayout stämmer redan med OpenGL:s kolumnvisa konvention, så ingen transponering behövs.
```
:::
:::vulkan
```quiz
`struct PushConstants { glm::mat4 model; };` kopieras byte för byte till shaderns `mat4 model`, utan transponering. Varför är det rätt?
- [x] GLM lagrar en `mat4` kolumn för kolumn, och det är också så GLSL lägger ut en `mat4`
- [ ] `vkCmdPushConstants` transponerar varje matris den kopierar
- [ ] Det är inte rätt, men transformationer ser likadana ut i båda fallen
- [ ] Push constants kan bara hålla symmetriska matriser
---
Båda sidorna lagrar kolumnvis, så byten betyder samma matris på CPU:n och på GPU:n. (En transponerad rotation skulle vrida åt andra hållet, så det spelar roll.)
```
:::
:::d3d12
```quiz
Innan en matris lagras i konstanterna anropar projektet `XMMatrixTranspose`, och shadern beräknar `mul(position, transform)`. Varför transponeringen?
- [x] `XMFLOAT4X4` lagrar rad för rad, medan HLSL som standard läser en matris i en constant buffer kolumn för kolumn; transponeringen gör att shadern ser samma matris
- [ ] DirectXMath-matriser är fel och måste alltid rättas
- [ ] `mul` i HLSL fungerar bara med transponerade matriser
- [ ] Root constants lagras i omvänd ordning
---
Radvis lagring plus kolumnvis packning skulle ge shadern den transponerade matrisen. Att lagra transponatet tar ut det, och `mul` med vektorn först beräknar v · M, precis som DirectXMath på CPU:n.
```
:::

```quiz
Vad gör att objekt längre bort ser mindre ut med en perspektivprojektion?
- [ ] Vymatrisen skalar varje objekt med dess avstånd från kameran
- [x] Projektionsmatrisen lägger avståndet i w, och perspektivdivisionen delar x och y med det
- [ ] Djuptestet krymper fragment som ligger längre bort
- [ ] Rasteriseraren ritar avlägsna trianglar med färre fragment
---
Efter projektionen växer w med avståndet från kameran. Divisionen med w i slutet av vertexsteget drar punkter långt bort närmare mitten: perspektiv.
```

```quiz
Djuptestningen är på, men programmet glömmer att rensa djupbufferten i början av varje bildruta. Vad händer?
- [ ] Ingenting ändras: varje fragment skriver ändå över djupbufferten
- [x] Fragmenten testas mot djupvärden som finns kvar från tidigare bildrutor, så många klarar inte testet och delar av scenen försvinner
- [ ] Scenen ritas utan djuptestning
- [ ] Bara det första objektet i varje bildruta ritas
---
Rensningen sätter varje djup till 1.0, fjärrplanet, så att det första fragmentet på en pixel alltid klarar testet. Utan den döljer de gamla värdena den här bildrutans fragment överallt där de inte ligger närmare än förut.
```

```quiz
Kamerakoden håller pitch mellan -89° och 89°. Varför inte tillåta 90°?
- [ ] Eftersom `sin` och `cos` inte är definierade vid 90°
- [x] Vid 90° är tittriktningen parallell med världens uppåtvektor, så kryssprodukten för högervektorn blir noll och vyn slår runt
- [ ] Eftersom projektionsmatrisen bara klarar vinklar under 90°
- [ ] Så att musen inte kan vrida kameran mer än 89° per bildruta
---
LookAt-matrisen beräknar kamerans högeraxel som kryssprodukten av riktningen och världens uppåtvektor. När de två är parallella blir produkten noll och kamerans orientering är inte längre definierad.
```

```quiz
Varför multipliceras kamerans hastighet med `deltaTime`, tiden som den förra bildrutan tog?
- [x] Så att kameran rör sig lika fort på snabba och långsamma datorer, hur många bildrutor per sekund de än ritar
- [ ] Så att kameran stannar när fönstret tappar fokus
- [ ] Så att rörelsen går fortare ju längre en tangent hålls nere
- [ ] Eftersom vymatrisen förväntar sig avstånd i sekunder
---
Utan den flyttar sig kameran en fast sträcka per bildruta, så en dator som ritar dubbelt så många bildrutor rör sig dubbelt så fort. Hastighet gånger bildrutans tid ger en sträcka per sekund.
```

```quiz
Mushjulet ändrar `fov`, projektionsmatrisens synfält. Vad ser du när `fov` går från 45° till 20°?
- [x] Scenen ser större ut: du zoomar in
- [ ] Scenen ser mindre ut: du zoomar ut
- [ ] Kameran flyttar sig framåt längs sin riktning
- [ ] Objekt nära kameran klipps bort
---
Ett mindre synfält får plats med en mindre del av scenen i samma fönster, så allt i den ser större ut. Själva kameran flyttar sig inte.
```
