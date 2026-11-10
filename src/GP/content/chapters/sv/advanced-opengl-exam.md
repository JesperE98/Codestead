# Prov: Avancerad OpenGL

Visa vad du har lärt dig i *Avancerad OpenGL*: djup- och stenciltestet, blending, face culling, framebuffers och
post-processing, cube maps, buffertar och uniform blocks, geometry shaders, instancing och anti-aliasing. Frågorna
täcker hela delen, och några gäller {{api}} särskilt. Svara på alla och tryck på **Lämna in svaren**; du behöver 80 %
rätt för att bli godkänd, och du kan göra provet igen.

```quiz
I kapitlet *Djuptestning* visade sig kuberna och golvet nästan vita när varje fragments djupvärde ritades som en gråton, fast de bara ligger några enheter från kameran. Varför?
- [ ] Djuptestet misslyckades överallt, så bara clear-färgen fanns kvar
- [ ] Djupbufferten lagrar avståndet i enheter, som begränsas till 1.0
- [x] Det lagrade djupet är proportionellt mot 1/z: nästan hela intervallet går åt nära det främre planet, så föremål några enheter bort har redan värden nära 1.0
- [ ] En djupbuffert med 32 bitar har för få bitar för mörkare värden
---
Med near = 0.1 och far = 100 ligger ett djup på 0.5 bara 0.2 enheter bort, och den vänstra kubens framsida, 3.5 enheter bort, ligger redan på ungefär 0.97. Att linjärisera djupet – invertera projektionens ekvation – ger det verkliga avståndet.
```

```quiz
Kubernas undersidor ligger exakt på golvet, och du ser z-fighting där. Vilken ändring minskar också z-fighting i resten av scenen?
- [ ] Att flytta ut det bortre planet från 100 till 1000
- [x] Att flytta ut det främre planet från 0.1 så långt som scenen tillåter
- [ ] Att byta djupfunktionen från LESS till LESS_OR_EQUAL
- [ ] Att rita golvet före kuberna
---
Djupbufferten lägger det mesta av sin precision strax framför det främre planet; att flytta ut det främre planet sprider precisionen över scenen. Att flytta ut det bortre planet gör motsatsen, och djupfunktionen eller ritordningen ändrar inte precisionen alls. (Att lyfta kuberna lite skulle ta bort just den här konflikten.)
```

```quiz
Bortsett från tidig djuptestning, i vilken ordning går ett fragment igenom de här stegen?
- [ ] Djuptest → fragment shader → stenciltest → blending
- [ ] Stenciltest → djuptest → blending → fragment shader
- [ ] Fragment shader → blending → djuptest → stenciltest
- [x] Fragment shader → stenciltest → djuptest → blending
---
Stencil- och djuptestet avgör om fragmentets utdata alls behålls; bara ett fragment som klarar båda blendas med färgbufferten. Tidig djuptestning flyttar testerna före shadern som en optimering – möjlig bara när shadern inte skriver djupet.
```

:::opengl
```quiz
För konturerna anropar learnopengl `glStencilFunc(GL_NOTEQUAL, 1, 0xFF)` och `glStencilMask(0x00)` innan de uppskalade kuberna ritas. Vad gör de två anropen?
- [ ] De skriver 1 i stencilbufferten överallt där de uppskalade kuberna ritas
- [x] Ett fragment klarar sig bara där det lagrade värdet inte är 1, och inget fragment ändrar stencilbufferten
- [ ] Ett fragment klarar sig bara där det lagrade värdet är 1 – inuti de ursprungliga kuberna
- [ ] De rensar stencilbufferten till 0 innan de uppskalade kuberna ritas
---
NOTEQUAL med referensvärdet 1 behåller fragmenten utanför kubernas siluett – ringen. Skrivmasken 0x00 får varje skrivning att lämna det lagrade värdet som det är, så siluetten förblir intakt för den andra kuben.
```
:::
:::vulkan
```quiz
Konturerna behöver stencilfunktionen NOT_EQUAL, skrivmasken 0x00 och inget djuptest, medan kuberna före dem använde ALWAYS och 0xFF. Hur byter `recordCommandBuffer()` från det ena till det andra?
- [ ] Med `vkCmdSetStencilCompareMask` och `vkCmdSetStencilWriteMask` före konturernas draw-anrop
- [x] Genom att binda `outlinePipeline`: hela dess djup- och stenciltillstånd följer med
- [ ] Genom att avsluta render passen och börja en utan djup-attachment
- [ ] Genom att binda en annan descriptor set för konturerna
---
Stencil- och djuptillståndet bakas in i varje pipeline när den skapas (om det inte deklareras som dynamiskt). Därför har projektet tre pipelines – golv, kuber, konturer – och att binda en tar med dess tillstånd; inget behöver återställas efteråt.
```
:::
:::d3d12
```quiz
Vilken del av stenciltestet lagras inte i PSO:t, utan sätts på command listen?
- [ ] Stencilfunktionen, `StencilFunc`
- [ ] Skrivmasken, `StencilWriteMask`
- [x] Referensvärdet, med `OMSetStencilRef`
- [ ] Operationen för "båda testerna lyckas", `StencilPassOp`
---
`OMSetStencilRef(1)` före kuberna sätter värdet som REPLACE skriver och som NOT_EQUAL jämför med. Allt annat – funktioner, operationer, masker – bestäms när PSO:t skapas, och därför har golvet, kuberna och konturerna var sitt PSO.
```
:::

```quiz
Med alfablending (`F_source` = källans alfa, `F_destination` = 1 − källans alfa) ritas ett rött fragment (1.0, 0.0, 0.0) med alfa 0.5 över en blå färgbuffert (0.0, 0.0, 1.0). Vilken färg lagras?
- [x] (0.5, 0.0, 0.5)
- [ ] (1.0, 0.0, 1.0)
- [ ] (1.0, 0.0, 0.0)
- [ ] (0.5, 0.0, 1.0)
---
`(1, 0, 0) * 0.5 + (0, 0, 1) * (1 - 0.5) = (0.5, 0, 0.5)`: hälften av det röda, hälften av det blåa som fanns där innan.
```

:::opengl
```quiz
Vilka anrop ger learnopengls alfablending för fönstren?
- [ ] `glEnable(GL_BLEND); glBlendFunc(GL_ONE, GL_ZERO);`
- [ ] `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);` ensamt – blending är påslaget som standard
- [x] `glEnable(GL_BLEND); glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);`
- [ ] `glEnable(GL_BLEND); glBlendEquation(GL_FUNC_SUBTRACT);`
---
Blending är avstängt som standard och måste slås på; `glBlendFunc` sätter käll- och målfaktorerna. `GL_ONE, GL_ZERO` skulle bara ersätta färgen, och ekvationen förblir `GL_FUNC_ADD`.
```
:::
:::vulkan
```quiz
Vilka inställningar i pipelinens `VkPipelineColorBlendAttachmentState` ger alfablending?
- [x] `blendEnable = VK_TRUE`, `srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA`, `dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA`, `colorBlendOp = VK_BLEND_OP_ADD`
- [ ] Samma faktorer med `blendEnable = VK_FALSE`: faktorerna ensamma slår på blending
- [ ] `srcColorBlendFactor = VK_BLEND_FACTOR_ONE`, `dstColorBlendFactor = VK_BLEND_FACTOR_ZERO`
- [ ] `colorBlendOp = VK_BLEND_OP_MAX`, så att den ljusare färgen vinner
---
Utan `blendEnable` ersätter den nya färgen bara den gamla, vad faktorerna än säger. ONE och ZERO är precis den ersättningen, och MAX är inte genomskinlighet alls.
```
:::
:::d3d12
```quiz
Vilka inställningar i `psoDesc.BlendState.RenderTarget[0]` ger alfablending?
- [ ] `SrcBlend = D3D12_BLEND_ONE`, `DestBlend = D3D12_BLEND_ZERO` – standardvärdena
- [ ] Samma faktorer som nedan med `BlendEnable = FALSE`: faktorerna ensamma slår på blending
- [ ] `BlendOp = D3D12_BLEND_OP_MAX`, så att den ljusare färgen vinner
- [x] `BlendEnable = TRUE`, `SrcBlend = D3D12_BLEND_SRC_ALPHA`, `DestBlend = D3D12_BLEND_INV_SRC_ALPHA`, `BlendOp = D3D12_BLEND_OP_ADD`
---
Direct3D kallar "ett minus" för *INV*. Utan `BlendEnable` ersätter pixelns färg bara render targetens, vad faktorerna än säger; ONE och ZERO är precis den ersättningen.
```
:::

```quiz
En scen har ogenomskinliga kuber och fem halvgenomskinliga fönster. Vilken ritordning ger rätt bild?
- [ ] Fönstren först, sorterade från nära till långt bort, sedan de ogenomskinliga föremålen
- [x] Alla ogenomskinliga föremål först, i valfri ordning, sedan fönstren sorterade från det bortersta till det närmaste
- [ ] Allt sorterat från långt bort till nära, med djuptestet av
- [ ] De ogenomskinliga föremålen, sedan fönstren i valfri ordning – djuptestet sorterar dem
---
Blending blandar ett fönster med det som redan finns i färgbufferten, så allt bakom det måste finnas där först. Djuptestet tar hand om de ogenomskinliga föremålen, men inte om fönster bakom fönster: ett nära fönster som ritas först skulle lagra sitt djup och avvisa de bortre.
```

```quiz
Varför använder gräset `discard` och inte blending?
- [ ] Blending klarar inte en alfa på exakt 0
- [ ] `discard` stänger av djuptestet för gräset
- [x] Dess texlar är antingen helt ogenomskinliga eller helt genomskinliga, och ett kastat fragment skriver varken färg eller djup – så gräset behöver ingen sortering
- [ ] `discard` får texturen att clampas vid kanterna
---
Med blending skulle en genomskinlig texel ändå lagra sitt djup och dölja det som ritas bakom den senare. Kastade fragment lämnar inga spår alls, så ordningen spelar ingen roll – så länge det inte finns några halvgenomskinliga texlar.
```

```quiz
Vad skulle hända med gräs-quadarna om de ritades med culling av baksidor påslagen?
- [x] Varje quad skulle försvinna när kameran ser den bakifrån: en enda quad har bara en sida, och bakifrån är den en baksida
- [ ] Ingenting: culling påverkar bara slutna föremål som kuber
- [ ] Deras genomskinliga texlar skulle kastas, så `discard` skulle inte längre behövas
- [ ] De skulle ritas två gånger, en gång för varje sida
---
Culling vet ingenting om föremål, bara om varje triangels winding på skärmen. Därför ritas öppna ytor som måste synas från båda sidor utan culling.
```

:::opengl
```quiz
Vad gör `glBindFramebuffer(GL_FRAMEBUFFER, 0)` efter golvets draw-anrop i framebuffers-projektet?
- [ ] Det tar bort framebuffer-objektet
- [x] Det gör fönstrets default framebuffer till mål igen, så att skärmquaden ritas i fönstret
- [ ] Det kopierar `textureColorbuffer` till fönstret
- [ ] Det rensar framebufferns attachments inför nästa bildruta
---
Draw-anrop hamnar i den framebuffer som är bunden. Scenen hamnade i vår framebuffers textur; att binda 0 byter tillbaka till fönstret, där skärmquaden sedan visar texturen.
```
:::
:::vulkan
```quiz
Vad gör `offscreenImage` redo att samplas av skärmquadens fragment shader efter offscreen-render passen?
- [ ] `vkQueueWaitIdle` mellan de två render passes
- [ ] Att presentera den en gång med `vkQueuePresentKHR`
- [ ] Ingenting: kommandona i en command buffer körs strikt efter varandra
- [x] Passen lämnar den i sin `finalLayout`, `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, och ett subpass dependency får de följande fragment shaders att vänta på färgskrivningarna
---
Kommandon kan överlappa på GPU:n om inget ordnar dem. Dependencyn till `VK_SUBPASS_EXTERNAL` gör det, och render passen övergår imagen till den layout en samplad image måste ha.
```
:::
:::d3d12
```quiz
Vad gör `m_offscreenTarget` läsbar för skärmquadens pixel shader efter att scenen har ritats i den?
- [x] En transition barrier från `D3D12_RESOURCE_STATE_RENDER_TARGET` till `D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE`, och dess SRV i descriptor tablen
- [ ] Det räcker att anropa `OMSetRenderTargets` med back bufferns RTV
- [ ] `WaitForPreviousFrame()` mellan de två passen
- [ ] Att skapa texturen i en upload heap
---
En resurs tillstånd måste passa dess användning, och barriern får också GPU:n att avsluta skrivningarna innan läsningarna börjar. I början av nästa bildruta gör en annan barrier den till render target igen.
```
:::

```quiz
Varför renderar post-processing-effekter som oskärpa först scenen till en textur?
- [ ] Kernels fungerar bara på texturer med en alfakanal
- [ ] Fönstrets framebuffer har ingen färgbuffert
- [ ] Texturkoordinaterna behövs för att beräkna kernelns vikter
- [x] Medan scenen ritas känner en fragment shader bara till sitt eget fragment; för att kombinera en pixel med dess grannar måste den färdiga bilden kunna läsas som en textur
---
När hela scenen finns i en textur kan skärmquadens shader sampla vilken pixel som helst – sin egen och dem runt omkring, på `offset = 1.0 / 300.0` – och kombinera dem.
```

```quiz
En 3×3-kernels vikter summerar till 0, som kantdetekteringens kernel. Vad gör den med en yta i en enda färg?
- [ ] Den lämnar färgen oförändrad
- [x] Den gör den svart
- [ ] Den gör den vit
- [ ] Den inverterar färgen
---
Om alla nio samplen har färgen c blir resultatet c gånger summan av vikterna: 0. Bara där färgen ändras – vid kanter – blir något kvar. En kernel vars vikter summerar till 1, som skärpning eller oskärpa, behåller enfärgade ytor som de är.
```

```quiz
Skyboxen ritas sist, dess vertex shader returnerar `pos.xyww`, och djupfunktionen för den är LESS_OR_EQUAL. Vad vinner man på det jämfört med att rita den först?
- [ ] Himlen vrider sig med kameran men kommer aldrig närmare
- [ ] Himlen ritas över alla föremål, som en bakgrundsbild
- [x] Dess fragment shader körs bara där inget föremål täcker himlen, eftersom dess djup är 1.0 och djuptestet tidigt avvisar resten
- [ ] Djupbufferten behöver inte längre rensas
---
z = w ger ett djup på exakt 1.0 efter perspektivdivisionen. Där kuberna har ritats håller deras närmare djup himlen ute; där inget har ritats släpper det rensade 1.0 igenom den – därför måste funktionen inkludera "lika med".
```

```quiz
De reflekterande kuberna samplar cube mapen med `R = reflect(I, N)`. Varför ändras reflektionen när kameran flyttas, medan skyboxen runt omkring bara ändras när kameran vrids?
- [ ] Kuberna ligger närmare kameran än himlen
- [ ] Reflektionen använder en dynamisk cube map som renderas varje bildruta
- [ ] Skyboxen ritas med djuptestet av
- [x] `I` är riktningen från kameran till fragmentet, så den beror på kamerans position; skyboxen använder view-matrisen utan dess translation
---
En spegel visar det som ligger i den speglade blickriktningen, och den riktningen ändras när du går runt kuben. Själva himlen behandlas som oändligt långt bort: bara kamerans rotation når dess vertices.
```

```quiz
En buffert innehåller 24 positioner (3 floats var) följda av 24 texturkoordinater (2 floats var) – den batchade layouten. En float är 4 byte. Var börjar texturkoordinat-attributet, och vilken stride har det?
- [ ] På byte 12, med en stride på 20 byte
- [ ] På byte 288, med en stride på 20 byte
- [x] På byte 288, med en stride på 8 byte
- [ ] På byte 480, med en stride på 8 byte
---
Positionerna tar 24 × 12 = 288 byte, och texturkoordinaterna följer efter dem, tätt packade: en var 8:e byte. En stride på 20 byte och en offset på 12 skulle beskriva den interleavade layouten.
```

:::opengl
```quiz
I ett `layout (std140)`-uniform block är medlemmarna `float a; vec3 b; float c;`. På vilken byte-offset börjar `c`?
- [ ] 4
- [ ] 16
- [x] 28
- [ ] 32
---
`a` ligger på 0. En `vec3` är justerad till 16 byte, så `b` börjar på 16 och tar 12 byte, fram till 28. En `float` behöver bara en multipel av 4, så `c` får plats direkt efter, på 28.
```
:::
:::vulkan
```quiz
I ett uniform block i Vulkans GLSL (std140 som standard) är medlemmarna `float a; vec3 b; float c;`. På vilken byte-offset börjar `c`?
- [ ] 4
- [ ] 16
- [x] 28
- [ ] 32
---
`a` ligger på 0. En `vec3` är justerad till 16 byte, så `b` börjar på 16 och tar 12 byte, fram till 28. En `float` behöver bara en multipel av 4, så `c` får plats direkt efter, på 28. En vanlig C++-struct skulle lägga `b` på 4 – därav `alignas(16)`.
```
:::
:::d3d12
```quiz
I en HLSL-`cbuffer` är medlemmarna `float a; float3 b; float c;`. På vilken byte-offset börjar `c`?
- [ ] 4
- [x] 16
- [ ] 28
- [ ] 32
---
HLSL flyttar bara en variabel till nästa 16-byte-register när den skulle gå över en gräns. `b` får plats i de 12 byte som finns kvar efter `a`, så den börjar på 4 och fyller registret; `c` börjar på nästa, på 16. GLSL:s std140 skulle lägga `b` på 16 och `c` på 28.
```
:::

```quiz
En geometry shader tar emot en punkt och skickar ut en triangle strip med 5 vertices – learnopengls hus. Hur många trianglar har ett hus?
- [ ] 1
- [ ] 2
- [x] 3
- [ ] 5
---
I en strip lägger varje vertex efter de två första till en triangel med de två före den: 5 − 2 = 3 – två för väggarna och en för taket.
```

:::opengl
```quiz
Vad måste projektets Shader-klass göra för att använda en geometry shader?
- [ ] Länka geometry shadern som ett andra program och använda båda programmen i draw-anropet
- [x] Kompilera den tredje filen som `GL_GEOMETRY_SHADER` och fästa den vid samma program före länkningen
- [ ] Anropa `glEnable(GL_GEOMETRY_SHADER)` före ritandet
- [ ] Ingenting: OpenGL hittar själv en `.gs`-fil bredvid vertex shadern
---
En geometry shader är ett steg till i shaderprogrammet, mellan vertex och fragment shadern. Den kompileras och fästs som de andra två; programmet länkas sedan som vanligt.
```
:::
:::vulkan
```quiz
Vad behöver Vulkan-projektet för att använda en geometry shader?
- [ ] En egen render pass för geometristeget
- [ ] En descriptor set som innehåller geometry shader-modulen
- [x] Device-funktionen `geometryShader` påslagen, och `.geom`-modulen som ett steg till, `VK_SHADER_STAGE_GEOMETRY_BIT`, i pipelinen
- [ ] Inget mer än att kompilera `.geom`-filen: pipelinen hittar den bredvid vertex shadern
---
Geometry shaders är en valfri device-funktion i Vulkan, så den logiska enheten måste slå på den. Shadern är sedan bara en `VkPipelineShaderStageCreateInfo` till bland pipelinens steg.
```
:::
:::d3d12
```quiz
Vad behöver Direct3D 12-projektet för att använda en geometry shader?
- [x] Kompilera `GSMain` med target `gs_5_0` och lägga den i PSO:t som `psoDesc.GS`; `PrimitiveTopologyType` anger shaderns inkommande primitiv
- [ ] Sätta den på command listen med ett `SetGeometryShader`-anrop före draw-anropet
- [ ] Kompilera den med `vs_5_0` och lägga den efter vertex shaderns bytecode
- [ ] Ändra `PrimitiveTopologyType` till `TRIANGLE` för husen, eftersom shadern skickar ut trianglar
---
Geometry shadern är en del av pipeline state, precis som vertex och pixel shadern. Topologitypen beskriver vad som når geometry shadern – punkter för husen – inte vad den skickar ut.
```
:::

```quiz
learnopengls asteroidfält har 100 000 stenar. Varför är det långsamt att rita dem med ett draw-anrop per sten, fast varje sten är liten?
- [x] Varje draw-anrop kostar CPU-tid – drivrutinen förbereder och skickar kommandon till GPU:n – så GPU:n tillbringar det mesta av tiden med att vänta på nästa lilla draw-anrop
- [ ] GPU:n måste läsa in stenens vertices från hårddisken igen för varje draw-anrop
- [ ] Varje draw-anrop rensar djupbufferten
- [ ] En vertex shader kan bara köras ett begränsat antal gånger per bildruta
---
Att rita en liten mesh går snabbt för GPU:n; att förbereda draw-anropet är flaskhalsen. Ett instansierat draw-anrop ger GPU:n meshen en gång och datan per instans (model-matriserna) i en buffert, så att den kan rita alla stenar utan att vänta på CPU:n.
```

:::opengl
```quiz
Vad får i uppgiften `instanced-array` attribut 2 (`aOffset`) att gå vidare en gång per instans i stället för en gång per vertex?
- [ ] `glDrawArraysInstanced` gör det för varje attribut
- [ ] Att läsa `gl_InstanceID` i vertex shadern
- [ ] `glVertexAttribPointer` med stride 0
- [x] `glVertexAttribDivisor(2, 1)`
---
Divisorn anger efter hur många instanser attributet går vidare till sitt nästa element: 0 (standard) betyder en gång per vertex, 1 en gång per instans. De andra attributen fortsätter att gå vidare per vertex.
```
:::
:::vulkan
```quiz
Vad får i uppgiften `instanced-array` attributets location 2 (`inOffset`) att gå vidare en gång per instans i stället för en gång per vertex?
- [x] Dess vertex binding (1) har `inputRate = VK_VERTEX_INPUT_RATE_INSTANCE`
- [ ] `vkCmdDraw(commandBuffer, 6, 100, 0, 0)` gör det för varje attribut
- [ ] Att läsa `gl_InstanceIndex` i vertex shadern
- [ ] Dess format, `VK_FORMAT_R32G32_SFLOAT`
---
Input raten hör till bindingen: binding 0 (quadens vertices) går vidare per vertex, binding 1 (förskjutningarna) per instans. Det är Vulkans motsvarighet till OpenGL:s `glVertexAttribDivisor(2, 1)`.
```
:::
:::d3d12
```quiz
Vad får i uppgiften `instanced-array` indatat `OFFSET` att gå vidare en gång per instans i stället för en gång per vertex?
- [ ] `DrawInstanced(6, 100, 0, 0)` gör det för varje indata
- [ ] Att läsa `SV_InstanceID` i vertex shadern
- [x] Dess input element har `D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA` med step rate 1
- [ ] Instansbuffertens vy har `StrideInBytes = 0`
---
Varje input element anger om det är data per vertex eller per instans, och step raten anger efter hur många instanser det går vidare – Direct3D:s motsvarighet till OpenGL:s `glVertexAttribDivisor(2, 1)`.
```
:::

```quiz
Med 4× MSAA täcker en enfärgat grön triangel (0.0, 1.0, 0.0) 2 av de 4 samplen i en kantpixel; de andra två behåller bakgrunden (0.1, 0.1, 0.1). Vilken färg får pixeln efter resolve?
- [ ] (0.0, 1.0, 0.0)
- [x] (0.05, 0.55, 0.05)
- [ ] (0.1, 0.1, 0.1)
- [ ] (0.0, 0.5, 0.0)
---
Fragment shadern kördes en gång och dess gröna lagrades i de två täckta samplen. Resolve tar medelvärdet av alla fyra: (2 × grönt + 2 × bakgrund) / 4 – hälften av vardera, och det är det som får kanten att se jämn ut.
```

:::opengl
```quiz
Vad gör i uppgiften `offscreen-msaa` om den multisamplade framebufferns samples till fönstrets pixlar?
- [x] `glBlitFramebuffer` från den multisamplade framebuffern (`GL_READ_FRAMEBUFFER`) till default-framebuffern (`GL_DRAW_FRAMEBUFFER`), som tar medelvärdet av varje pixels samples
- [ ] En skärmquad som samplar den multisamplade texturen med `texture()`
- [ ] `glEnable(GL_MULTISAMPLE)`
- [ ] `glfwSwapBuffers`, som resolvar varje bunden framebuffer
---
Blitten resolvar den multisamplade bilden. För post-processing blittar learnopengl i stället till `intermediateFBO`, vars vanliga textur skärmquaden kan sampla.
```
:::
:::vulkan
```quiz
Hur hamnar den multisamplade bilden i swap chain-imagen i uppgiften `msaa`?
- [ ] `vkCmdBlitImage` efter render passen kopierar över den
- [x] Swap chain-imagen är subpassens resolve attachment: i slutet av subpassen tas medelvärdet av varje pixels samples in i den
- [ ] Swap chainen skapas med 4 samples per pixel
- [ ] Fragment shadern skriver vart och ett av de fyra samplen till swap chain-imagen
---
`pResolveAttachments` anger den attachment med ett sample som den multisamplade färg-attachmenten resolvas till. Själva den multisamplade imagen presenteras aldrig.
```
:::
:::d3d12
```quiz
Varför ritar uppgiften `msaa` i `m_msaaRenderTarget` och anropar `ResolveSubresource`, i stället för att skapa swap chainen med 4 samples?
- [ ] `ResolveSubresource` är snabbare än en multisamplad swap chain skulle vara
- [ ] Ett PSO kan bara rita i en textur, aldrig i en back buffer
- [ ] Back bufferns format stöder inte multisampling
- [x] En swap chain med flip model måste ha `SampleDesc.Count = 1`, så samplen ligger i ett eget render target och resolvas till back buffern
---
Det multisamplade render targetet, dess djupbuffert och PSO:t har alla 4 samples. `ResolveSubresource`, mellan barriers till `RESOLVE_SOURCE` och `RESOLVE_DEST`, tar medelvärdet av samplen in i back buffern med ett sample.
```
:::

```quiz
Varför resolvar projekten i *Anti Aliasing* den multisamplade bilden före post-processing-passet?
- [x] En shader kan inte sampla en multisamplad image som en vanlig textur; resolve tar medelvärdet av varje pixels samples till en vanlig bild som skärmquaden kan sampla
- [ ] Resolve fördubblar antalet samples, vilket effekten behöver
- [ ] Post-processing-effekten skulle annars ta bort anti-aliasingen
- [ ] Fönstret kan inte visa en bild som har efterbehandlats
---
Effekten – här gråskalan – arbetar då på den redan jämna bilden, så kanterna förblir jämna. Att läsa de enskilda samplen går också (learnopengls custom anti-aliasing), men kräver särskilda shaderfunktioner.
```
