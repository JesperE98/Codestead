# Prov: Kom igång

Visa vad du har lärt dig i *Kom igång*: fönstret och bildrutan, triangeln och dess shaders, värden från CPU:n och
texturer. Frågorna täcker hela delen, och några gäller {{api}} särskilt. Svara på alla och tryck på **Lämna in
svaren**; du behöver 80 % rätt för att bli godkänd, och du kan göra provet igen.

:::opengl
```quiz
Ditt program skapar ett GLFW-fönster, gör dess kontext aktuell och kraschar sedan på sitt allra första OpenGL-anrop, `glClearColor`. Vilket steg saknas troligen?
- [ ] `glViewport(0, 0, 800, 600)` före det första OpenGL-anropet
- [ ] `glfwSwapBuffers(window)` en gång före renderingsloopen
- [ ] `glfwPollEvents()` före det första OpenGL-anropet
- [x] `gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)` efter att kontexten gjorts aktuell
---
Adresserna till OpenGL-funktionerna blir kända först när programmet körs; GLAD letar upp dem i drivrutinen. Utan den är `glClearColor` en nollpekare till en funktion, och anropet kraschar.
```
:::
:::vulkan
```quiz
I vilken ordning skapar projektet de här Vulkan-objekten?
- [ ] Instans, swap chain, logisk enhet, fysisk enhet, window surface
- [ ] Fysisk enhet, instans, swap chain, window surface, logisk enhet
- [ ] Logisk enhet, instans, fysisk enhet, window surface, swap chain
- [x] Instans, window surface, fysisk enhet, logisk enhet, swap chain
---
Allt börjar med instansen. Surfacen kommer sedan, eftersom valet av fysisk enhet behöver veta vilken queue family som kan presentera till den. Den logiska enheten skapas från den fysiska, och swap chainen från den logiska enheten och surfacen.
```
:::
:::d3d12
```quiz
I vilken ordning sätter projektet upp Direct3D 12?
- [ ] Device, DXGI-factory, swap chain, command queue, debug layer
- [ ] Adapter, device, debug layer, swap chain, command queue
- [x] Debug layer, DXGI-factory, adapter, device, command queue, swap chain
- [ ] DXGI-factory, swap chain, adapter, device, command queue
---
Debug layer måste slås på innan devicen skapas. Factoryn hittar adaptern, adaptern ger devicen, och swap chainen skapas för den command queue som ska presentera till den.
```
:::

```quiz
Varför ritar ett program varje bildruta i en back buffer och byter (presenterar) den först därefter?
- [ ] Så att fönstrets händelser kan hanteras medan GPU:n ritar
- [ ] Så att rensningsfärgen bara behöver sättas en gång, i början av programmet
- [x] Så att fönstret aldrig visar en bildruta som fortfarande håller på att ritas
- [ ] Så att GPU:n kan rita dubbelt så många bildrutor per sekund
---
Fönstret visar alltid en färdig bild (front buffern) medan nästa ritas. Bytet ersätter den på en gång, utan flimret från en halvritad bild.
```

:::opengl
```quiz
Renderingsloopen anropar `glClearColor(0.2f, 0.3f, 0.3f, 1.0f);` varje bildruta men aldrig `glClear`. Vad händer?
- [ ] Fönstret blir blågrönt: `glClearColor` rensar färgbufferten
- [ ] Fönstret blir blågrönt så fort `glfwSwapBuffers` visar back buffern
- [x] Ingenting rensas: `glClearColor` sätter bara tillstånd, som `glClear(GL_COLOR_BUFFER_BIT)` skulle använda
- [ ] OpenGL rapporterar ett fel eftersom rensningsfärgen aldrig används
---
`glClearColor` är en tillståndsändrande funktion: den ändrar kontextens rensningsfärg. `glClear` är den tillståndsanvändande funktionen som faktiskt fyller bufferten med den.
```
:::
:::vulkan
```quiz
I början av `drawFrame()` måste CPU:n vänta tills GPU:n är klar med den förra bildrutan. Vilket objekt sköter det?
- [x] Fencen `inFlightFence`, med `vkWaitForFences` (och `vkResetFences` efteråt)
- [ ] Render passen, som först slutar när GPU:n har ritat klart
- [ ] Semaforen `imageAvailableSemaphore`
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
Efter perspektivdivisionen har ett av en triangels hörn x = 1,5; de två andra ligger en bra bit inne i fönstret. Vad ser du?
- [x] Den del av triangeln som ligger inuti vyvolymen; resten klipps vid fönstrets högra kant
- [ ] Hela triangeln, ihoptryckt så att x = 1,5 hamnar vid fönstrets högra kant
- [ ] Hela triangeln; hörnet utanför fönstret ritas bortom dess kant
- [ ] Ingenting: en triangel med en vertex utanför vyvolymen kastas
---
Bara koordinater mellan -1 och 1 i x och y hamnar i viewporten. En triangel som delvis ligger utanför klipps: GPU:n skär av den till delen som ligger innanför.
```

```quiz
En triangels tre hörn är röda, gröna och blå, och vertex shadern lämnar varje vertex färg vidare till fragment shadern. Vilken färg får fragmentet precis i triangelns mitt?
- [ ] Den är odefinierad: fragment shadern får bara färger vid vertexarna
- [x] En blandning med en tredjedel av varje, ungefär (0.33, 0.33, 0.33)
- [ ] Vit, summan av de tre färgerna
- [ ] Röd, färgen på den första vertexen
---
Rasteriseraren interpolerar vertex shaderns utdata över triangeln. I mitten väger alla tre vertexarna lika mycket, så varje färg bidrar med en tredjedel.
```

:::opengl
```quiz
Varje vertex består nu av 3 floats position följda av 3 floats färg. Vilket anrop beskriver färgattributet på location 1?
- [ ] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)(3 * sizeof(float)));`
- [x] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));`
- [ ] `glVertexAttribPointer(1, 6, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);`
- [ ] `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);`
---
Stride är storleken på en hel vertex (6 floats); offset är var färgen börjar inuti en vertex (efter de 3 positionsvärdena). Storleken är antalet komponenter i attributet, 3.
```
:::
:::vulkan
```quiz
`struct Vertex` har nu en position och en färg. Var beskrivs vertexens stride och färgens offset?
- [x] Stride i `VkVertexInputBindingDescription` (`sizeof(Vertex)`), offset i färgens `VkVertexInputAttributeDescription` (`offsetof(Vertex, color)`)
- [ ] Båda i anropet till `vkCmdBindVertexBuffers`
- [ ] I vertex shadern, med `layout(location = 1, offset = 12)`
- [ ] Båda i färgens `VkVertexInputAttributeDescription`
---
Binding description säger hur bufferten ska stegas igenom (stride, per vertex); varje attribute description säger var dess attribut finns (location, format, offset). Båda är en del av pipelinens tillstånd för vertexindata.
```
:::
:::d3d12
```quiz
`struct Vertex` har nu en position och en färg. Var beskrivs vertexens stride och färgens offset?
- [ ] I vertex shadern, med semantiken `COLOR12`
- [ ] Båda i root signaturen
- [x] Stride i vertex buffer view (`StrideInBytes = sizeof(Vertex)`), offset i färgens input element i input layouten (byte-offset 12)
- [ ] Båda i färgens input element i input layouten
---
Vertex buffer view säger var bufferten finns, hur stor den är och hur långt det är mellan vertexarna. Varje input element i input layouten säger var dess attribut ligger inuti en vertex. Talet efter en semantik är ett semantiskt index, inte en offset.
```
:::

```quiz
En rektangel ritas som två trianglar med indexerad ritning. Hur många vertexar och hur många index behöver den?
- [ ] 4 vertexar och 4 index
- [x] 4 vertexar och 6 index
- [ ] 6 vertexar och 6 index
- [ ] 6 vertexar och 4 index
---
De två trianglarna delar två hörn. Med en indexbuffert lagras varje hörn en gång (4 vertexar), och de 6 indexen säger vilka hörn varje triangel består av.
```

:::opengl
```quiz
I den första bildrutan anropar programmet `glUniform4f(vertexColorLocation, 0.0f, 1.0f, 0.0f, 1.0f);` och först därefter `glUseProgram(shaderProgram);`. Vad händer med den gröna färgen i den bildrutan?
- [ ] Den sparas i shaderprogrammet och används av nästa draw-anrop
- [ ] Den sätts i alla shaderprogram som har en uniform med det namnet
- [x] Den når inte programmet: `glUniform…` sätter uniformen i det program som är aktivt när anropet görs, och inget är det än
- [ ] OpenGL väntar med anropet tills `glUseProgram` har anropats
---
`glUniform…` har inget programargument: det verkar på det program som `glUseProgram` har gjort aktivt. Aktivera programmet först och sätt sedan dess uniforms.
```
:::
:::vulkan
```quiz
Fragment shadern läser nu ett värde ur push constant-blocket, men `VkPushConstantRange` och `vkCmdPushConstants` anger fortfarande bara `VK_SHADER_STAGE_VERTEX_BIT`. Vad händer?
- [ ] Ingenting: push constants syns för alla steg i pipelinen
- [x] Fragment shadern får inte intervallet: valideringslagret rapporterar felet, och fragmentsteget måste läggas till i intervallet och i `vkCmdPushConstants`
- [ ] Vertex shadern skickar värdet vidare till fragment shadern av sig själv
- [ ] Värdet kommer fram en bildruta för sent i fragment shadern
---
Ett push constant-intervall hör till de steg som står i dess `stageFlags`. Ett shadersteg som läser blocket måste finnas med i intervallet, och `vkCmdPushConstants` måste ange samma steg.
```
:::
:::d3d12
```quiz
Pixel shadern läser nu ett värde ur root constants-`cbuffer`:n, men root-parametern skapades med `D3D12_SHADER_VISIBILITY_VERTEX`. Vad händer?
- [ ] Ingenting: root constants syns för alla shadersteg
- [ ] Vertex shadern skickar värdet vidare till pixel shadern av sig själv
- [ ] Värdet kommer fram en bildruta för sent i pixel shadern
- [x] Pixel shadern ser inte root-parametern: dess synlighet måste omfatta pixelsteget (`D3D12_SHADER_VISIBILITY_ALL` eller `_PIXEL`)
---
En root-parameters synlighet säger vilka shadersteg som kan läsa den. Med `VERTEX` ser bara vertex shadern konstanterna; debug-lagret rapporterar en pixel shader som läser ett register som ingen synlig parameter ger.
```
:::

```quiz
Ett stort golv med en detaljerad textur sträcker sig långt bort, och långt borta flimrar det och ser brusigt ut. Vad hjälper?
- [ ] En textur med högre upplösning
- [x] Mipmaps, med ett förminskningsfilter som använder dem
- [ ] Clamp-to-edge-wrapping i stället för repeat
- [ ] Nearest-filtrering som förstoringsfilter
---
Långt borta faller många texlar på en pixel (texturen förminskas), och att välja en av dem ger en annan, slumpmässig färg från bildruta till bildruta. En mindre, förfiltrerad mipnivå ger rätt medelfärg. En större textur skulle göra det värre.
```

```quiz
En rektangels texturkoordinater går från (0, 0) till (3, 2) i stället för från (0, 0) till (1, 1), och wrapping-läget är *repeat*. Vad ser du?
- [x] Texturen tre gånger på bredden och två gånger på höjden av rektangeln
- [ ] Texturen en gång, tre gånger bredare och dubbelt så hög som rektangeln, avskuren vid kanterna
- [ ] Texturen en gång, i hörnet från 0 till 1, och kanttexlarna utdragna över resten
- [ ] Ingenting: texturkoordinater över 1 är ogiltiga
---
Med repeat räknas bara koordinatens decimaldel: från 0 till 3 börjar texturen om vid 1 och vid 2, så den får plats tre gånger på bredden. Clamp to edge skulle i stället dra ut kanttexlarna.
```

:::opengl
```quiz
Fragment shadern deklarerar `uniform sampler2D texture1;` och `uniform sampler2D texture2;`. Vad får `texture2` att läsa ansiktsbilden?
- [ ] `glBindTexture(GL_TEXTURE_2D, texture2);` direkt efter att `texture1` har bundits
- [x] `ourShader.setInt("texture2", 1);` en gång, och `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D, texture2);` före ritningen
- [ ] `ourShader.setInt("texture2", texture2);` med texturobjektets id
- [ ] Bara `glActiveTexture(GL_TEXTURE1);`: samplern hittar texturen via sitt namn
---
En sampler-uniform håller numret på en texturenhet, inte ett textur-id. Att binda ansiktet till enhet 1 och sätta samplern till 1 kopplar ihop dem. Att binda utan att byta aktiv enhet skulle ersätta lådan på enhet 0.
```
:::
:::vulkan
```quiz
Fragment shadern läser ansiktet med `layout(binding = 1) uniform sampler2D faceSampler;`. Vad behöver ansiktstexturen på C++-sidan, utöver sin bild och sin image view?
- [ ] En andra `VkSampler`, eftersom en sampler hör till en bild
- [ ] Ett andra descriptor set, bundet med `vkCmdBindDescriptorSets` på index 1
- [x] En andra binding (binding 1, en combined image sampler) i descriptor set layouten, plats för den i poolen, och en descriptor-skrivning med dess image view och samplern
- [ ] En andra vertexbuffert-binding, så att `vkCmdBindVertexBuffers` kan skicka med bilden
---
Bindings fyller samma roll som OpenGL:s texturenheter: var och en är en plats i descriptor setet som shadern namnger. En sampler hör inte till någon bild, så samma `textureSampler` läser båda.
```
:::
:::d3d12
```quiz
Pixel shadern läser ansiktet med `Texture2D texture2 : register(t1);`. Vad behöver ansiktstexturen på C++-sidan, utöver texturresursen?
- [ ] En andra statisk sampler på register `s1`, eftersom en sampler hör till en textur
- [ ] En andra root signature för den andra texturen
- [ ] En andra vertex buffer view, så att `IASetVertexBuffers` kan skicka med texturen
- [x] Sin SRV på platsen i heapen direkt efter lådans, och ett descriptor-intervall med 2 SRV:er som börjar på `t0`
---
Register fyller samma roll som OpenGL:s texturenheter: descriptor tablen täcker descriptors som ligger efter varandra i heapen, och de blir `t0`, `t1`, … En sampler hör inte till någon textur, så `s0` läser båda.
```
:::

```quiz
En textur i pixelgrafik på 16 × 16 ritas över större delen av ett fönster på 800 × 600. Vilket förstoringsfilter behåller dess pixlar som skarpa rutor?
- [ ] Linjär filtrering, eftersom den läser fler texlar
- [ ] Ett mipmap-filter, eftersom texturen ritas större än den är
- [x] Nearest-filtrering
- [ ] Clamp to edge
---
Förstorad täcker varje texel många pixlar. Nearest ger varje pixel färgen från den närmaste texeln – skarpa rutor; linjär blandar grannarna till en mjuk suddighet. Mipmaps är till för förminskning, och clamp är ett wrapping-läge.
```

:::opengl
```quiz
Om programmet inte anropade `stbi_set_flip_vertically_on_load(true)` skulle lådan visas upp och ned. Varför?
- [ ] stb_image läser in bilder spegelvända, i alla API:er
- [ ] Vertex shadern vänder y eftersom OpenGL:s NDC har y nedåt
- [ ] Texturens wrapping-läge `GL_REPEAT` vänder på bilden
- [x] OpenGL lägger texturkoordinat 0,0 på y-axeln vid datans första rad, som den behandlar som bildens nederkant, medan bildfiler lagrar den översta raden först
---
`glTexImage2D` tar datans första rad som texturens nederkant (t = 0). Bildfiler börjar med den översta raden, så utan vändningen kommer bilden upp och ned.
```
:::
:::vulkan
```quiz
I Vulkan-projektet laddas bilderna med stb_image utan att vändas, och lådan står rätt. Varför?
- [ ] stb_image vänder bilderna av sig själv när de kopieras till en `VkImage`
- [ ] Vertex shadern vänder y, så texturen hamnar rätt
- [x] I Vulkan är texturkoordinaten v = 0 den första raden i bilddatan – den översta raden, som en bildfil lagrar först – och vertexarnas koordinater är skrivna med v = 0 upptill
- [ ] Samplerns adressläge vänder bilden
---
Bildfiler och Vulkan är överens: den första raden är v = 0, upptill. OpenGL lägger t = 0 nertill, och därför vänder learnopengl sina bilder när de laddas.
```
:::
:::d3d12
```quiz
I Direct3D 12-projektet laddas bilderna med stb_image utan att vändas, och lådan står rätt. Varför?
- [ ] stb_image vänder bilderna av sig själv när de kopieras till upload heapen
- [x] I Direct3D är texturkoordinaten v = 0 den första raden i bilddatan – den översta raden, som en bildfil lagrar först – och vertexarnas koordinater är skrivna med v = 0 upptill
- [ ] Vertex shadern vänder y, så texturen hamnar rätt
- [ ] Den statiska samplerns adressläge vänder bilden
---
Bildfiler och Direct3D är överens: den första raden är v = 0, upptill. OpenGL lägger t = 0 nertill, och därför vänder learnopengl sina bilder när de laddas.
```
:::

```quiz
Fragment shadern returnerar `mix(container, face, 0.2)` (i HLSL: `lerp`). Vad får ett fragment?
- [ ] 20 % av lådan och 80 % av ansiktet
- [ ] Lådan där den är ljusare än 0,2, annars ansiktet
- [ ] Summan av båda färgerna gånger 0,2
- [x] 80 % av lådans färg och 20 % av ansiktets
---
`mix(a, b, t)` är a · (1 − t) + b · t: vid t = 0 bara `a`, vid t = 1 bara `b`. Med 0,2 dominerar lådan och ansiktet skymtar svagt igenom.
```
