# Djuptestning

Det här kapitlet inleder en ny del av kursen: *Avancerad OpenGL*. Den behåller learnopengl.com:s namn i alla API:er,
men inget i den är specifikt för OpenGL: djup- och stenciltest, blending och face culling finns lika väl i Vulkan och
DirectX 12, och varje kapitel i den här delen visar dem för det API du valt – {{api}}. Det som skiljer mellan API:erna
är mest *var* inställningarna finns: OpenGL håller dem i en global tillståndsmaskin som du ändrar med anrop som
`glEnable` och `glDepthFunc`, medan Vulkan och DirectX 12 bakar in dem i ett pipeline-objekt som du skapar i förväg och
binder innan du ritar.

I kapitlet om koordinatsystem renderade vi en 3D-låda och använde en djupbuffer (depth buffer) för att hindra
trianglar från att hamna framför när de egentligen ska ligga bakom andra trianglar. I det här kapitlet går vi lite
närmare in på de djupvärden som djupbuffern (eller z-buffern) lagrar och hur den faktiskt avgör om ett fragment
ligger framför.

Djupbuffern är en buffer som, precis som färgbuffern (som lagrar alla fragmentens färger: den synliga bilden), lagrar
information per fragment och har samma bredd och höjd som färgbuffern. Djupvärden lagras oftast som flyttal eller
fixpunktstal på 16, 24 eller 32 bitar; de flesta system använder en djupbuffer med 24 eller 32 bitars precision.

:::opengl
I OpenGL skapas djupbuffern automatiskt av fönstersystemet: GLFW ber som standard om en djupbuffer på 24 bitar
(fönsterhinten `GLFW_DEPTH_BITS`), tillsammans med en stencilbuffer på 8 bitar som nästa kapitel behöver.
:::
:::vulkan
I Vulkan är djupbuffern din egen image, som i vulkan-tutorials kapitel *Depth buffering*: `depthImage`, dess minne och
`depthImageView`, skapade i `createDepthResources()` med det format som `findDepthFormat()` väljer – här
`VK_FORMAT_D32_SFLOAT`, ett 32-bitars flyttal per pixel. Den är render passets andra attachment.
:::
:::d3d12
I Direct3D 12 är djupbuffern din egen resurs, `m_depthStencil`: en textur lika stor som fönstret i formatet
`DXGI_FORMAT_D32_FLOAT` (ett 32-bitars flyttal per pixel), med en depth stencil view (DSV) i en egen descriptor heap,
bunden med `OMSetRenderTargets` bredvid render targeten.
:::

När djuptestning är påslagen testar GPU:n ett fragments djupvärde mot djupbufferns innehåll. Den utför ett djuptest,
och om testet går igenom renderas fragmentet och djupbuffern uppdateras med det nya djupvärdet. Om djuptestet
misslyckas kastas fragmentet.

Djuptestningen görs i skärmrummet efter att fragment shadern har körts (och efter stenciltestet, som vi kommer till i
nästa kapitel). Skärmrumskoordinaterna hänger direkt ihop med viewporten: fragmentets position i fönstret och dess
djup.

:::opengl
GLSL ger dig de här koordinaterna i fragment shadern som den inbyggda vektorn `gl_FragCoord`: dess x och y är
fragmentets position i fönstret (med (0, 0) i nedre vänstra hörnet), dess z är fragmentets djupvärde. Det är det
z-värdet som jämförs med djupbufferns innehåll.
:::
:::vulkan
GLSL ger dig de här koordinaterna i fragment shadern som den inbyggda vektorn `gl_FragCoord`: dess x och y är
fragmentets position i fönstret (i Vulkan med (0, 0) i övre vänstra hörnet), dess z är fragmentets djupvärde. Det är
det z-värdet som jämförs med djupbufferns innehåll.
:::
:::d3d12
HLSL ger dig de här koordinaterna i pixel shadern genom indatan med semantiken `SV_POSITION`: den
`float4 position : SV_POSITION` som vertex shadern skrev som en position i klipprummet kommer fram till pixel shadern
som pixelns position i fönstret i x och y (med (0, 0) i övre vänstra hörnet) och dess djupvärde i z – samma sak som
GLSL:s `gl_FragCoord`. Det är det z-värdet som jämförs med djupbufferns innehåll.
:::

I dag stöder de flesta GPU:er en hårdvarufunktion som kallas *early depth testing* (tidig djuptestning). Den låter
djuptestet köras innan fragment shadern körs. Så fort det står klart att ett fragment inte kommer att synas (det ligger
bakom andra föremål) kan vi kasta det i förväg. Fragment shadrar är ofta ganska dyra, så där vi kan undvika att köra dem
bör vi göra det. En begränsning för fragment shadern vid tidig djuptestning är att du inte ska skriva fragmentets
djupvärde: om en fragment shader skriver sitt eget djup kan GPU:n inte veta djupet i förväg.

:::opengl
(GLSL kan skriva djupet via `gl_FragDepth`; då stängs tidig djuptestning av för den shadern.)
:::
:::vulkan
(GLSL kan skriva djupet via `gl_FragDepth`; då stängs tidig djuptestning av för den shadern. Det är också därför
render passets dependency nämner två steg: `VK_PIPELINE_STAGE_EARLY_FRAGMENT_TESTS_BIT` och
`VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT` – testerna före och efter fragment shadern.)
:::
:::d3d12
(HLSL kan skriva djupet via en utdata med semantiken `SV_Depth`; då stängs tidig djuptestning av för den shadern.)
:::

```quiz
Varför kräver tidig djuptestning att fragment shadern inte skriver sitt eget djupvärde?
- [ ] Därför att fragment shadern körs på en annan del av GPU:n än djuptestet
- [x] Testet körs *före* fragment shadern; om shadern kunde ändra djupet vore det tidigt testade värdet kanske inte det som fragmentet till slut får
- [ ] Därför att djupbuffern är skrivskyddad medan en fragment shader körs
---
Tidig djuptestning är en optimering: dolda fragment kastas innan deras (dyra) shader körs. Det fungerar bara om djupet är känt i förväg – vilket det är när det helt enkelt kommer från den rastrerade triangeln, inte när shadern räknar ut det.
```

:::opengl
Djuptestning är avslagen som standard, så vi slår på den med alternativet `GL_DEPTH_TEST`:

```cpp
    glEnable(GL_DEPTH_TEST);
```

När den är påslagen lagrar OpenGL automatiskt fragmentens z-värden i djupbuffern om de klarade djuptestet, och kastar
fragment som inte klarade det. Om du har djuptestning påslagen ska du också tömma djupbuffern före varje bildruta med
`GL_DEPTH_BUFFER_BIT`; annars sitter du fast med djupvärdena från förra bildrutan:

```cpp
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
```

Det finns situationer där du vill utföra djuptestet på alla fragment och kasta dem därefter, men *inte* uppdatera
djupbuffern. I grunden använder du då (tillfälligt) en *skrivskyddad* djupbuffer. OpenGL låter oss stänga av
skrivningar till djupbuffern genom att sätta dess djupmask till `GL_FALSE`:

```cpp
glDepthMask(GL_FALSE);
```

Observera att det bara har effekt om djuptestning är påslagen.
:::
:::vulkan
I Vulkan finns inget att slå på globalt: djuptestet är en del av varje grafik-pipeline, i dess
`VkPipelineDepthStencilStateCreateInfo`. Projektets `createPipeline()` fyller i den som vulkan-tutorial gör:

```cpp
        VkPipelineDepthStencilStateCreateInfo depthStencil{};
        depthStencil.sType = VK_STRUCTURE_TYPE_PIPELINE_DEPTH_STENCIL_STATE_CREATE_INFO;
        depthStencil.depthTestEnable = VK_TRUE;
        depthStencil.depthWriteEnable = VK_TRUE;
        depthStencil.depthCompareOp = VK_COMPARE_OP_LESS; // keep the fragment if it is nearer than the stored depth
        depthStencil.depthBoundsTestEnable = VK_FALSE;
        depthStencil.stencilTestEnable = VK_FALSE;
```

`depthTestEnable` är OpenGL:s `glEnable(GL_DEPTH_TEST)`. Djupbuffern töms i början av render passet, eftersom dess
attachment har `loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR`; värdet kommer från det andra clear-värdet i
`recordCommandBuffer()` – OpenGL:s `GL_DEPTH_BUFFER_BIT` i `glClear`:

```cpp
        clearValues[1].depthStencil = {1.0f, 0};
```

Det finns situationer där du vill utföra djuptestet på alla fragment och kasta dem därefter, men *inte* uppdatera
djupbuffern. I grunden använder du då (tillfälligt) en *skrivskyddad* djupbuffer. Det är `depthWriteEnable =
VK_FALSE` – OpenGL:s `glDepthMask(GL_FALSE)` – i den pipeline du ritar de föremålen med.
:::
:::d3d12
I Direct3D 12 finns inget att slå på globalt: djuptestet är en del av varje pipeline state object (PSO), i dess
`DepthStencilState`. Projektets `LoadAssets` utgår från standardvärdena och skriver ut djupfunktionen:

```cpp
        // The default depth stencil state: depth test on, depth writes on. DepthFunc
        // compares a pixel's depth with the one in the depth buffer: LESS (the default)
        // keeps the pixel only if it is nearer than the one already there.
        psoDesc.DepthStencilState = CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT);
        psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_LESS;
```

Standardtillståndet har `DepthEnable = TRUE` – OpenGL:s `glEnable(GL_DEPTH_TEST)`. Djupbuffern töms i
`PopulateCommandList` innan något ritas – OpenGL:s `GL_DEPTH_BUFFER_BIT` i `glClear`:

```cpp
    m_commandList->ClearDepthStencilView(dsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr);
```

Det finns situationer där du vill utföra djuptestet på alla fragment och kasta dem därefter, men *inte* uppdatera
djupbuffern. I grunden använder du då (tillfälligt) en *skrivskyddad* djupbuffer. Det är `DepthWriteMask =
D3D12_DEPTH_WRITE_MASK_ZERO` – OpenGL:s `glDepthMask(GL_FALSE)` – i den PSO du ritar de föremålen med.
:::

## Djuptestets funktion

{{api}} låter oss ändra den jämförelseoperator som används i djuptestet. Det låter oss styra när GPU:n ska släppa
igenom eller kasta fragment och när djupbuffern ska uppdateras.

:::opengl
Vi sätter jämförelseoperatorn (eller djupfunktionen) med `glDepthFunc`:

```cpp
glDepthFunc(GL_LESS);
```

Funktionen tar emot flera jämförelseoperatorer:

| Funktion | Beskrivning |
|---|---|
| `GL_ALWAYS` | Djuptestet går alltid igenom. |
| `GL_NEVER` | Djuptestet går aldrig igenom. |
| `GL_LESS` | Går igenom om fragmentets djupvärde är mindre än det lagrade djupvärdet. |
| `GL_EQUAL` | Går igenom om fragmentets djupvärde är lika med det lagrade djupvärdet. |
| `GL_LEQUAL` | Går igenom om fragmentets djupvärde är mindre än eller lika med det lagrade djupvärdet. |
| `GL_GREATER` | Går igenom om fragmentets djupvärde är större än det lagrade djupvärdet. |
| `GL_NOTEQUAL` | Går igenom om fragmentets djupvärde inte är lika med det lagrade djupvärdet. |
| `GL_GEQUAL` | Går igenom om fragmentets djupvärde är större än eller lika med det lagrade djupvärdet. |

Som standard används djupfunktionen `GL_LESS`, som kastar alla fragment vars djupvärde är större än eller lika med
värdet i djupbuffern.
:::
:::vulkan
Jämförelseoperatorn (eller djupfunktionen) är pipelinens `depthCompareOp`, en `VkCompareOp`:

| Funktion | Beskrivning |
|---|---|
| `VK_COMPARE_OP_ALWAYS` | Djuptestet går alltid igenom. |
| `VK_COMPARE_OP_NEVER` | Djuptestet går aldrig igenom. |
| `VK_COMPARE_OP_LESS` | Går igenom om fragmentets djupvärde är mindre än det lagrade djupvärdet. |
| `VK_COMPARE_OP_EQUAL` | Går igenom om fragmentets djupvärde är lika med det lagrade djupvärdet. |
| `VK_COMPARE_OP_LESS_OR_EQUAL` | Går igenom om fragmentets djupvärde är mindre än eller lika med det lagrade djupvärdet. |
| `VK_COMPARE_OP_GREATER` | Går igenom om fragmentets djupvärde är större än det lagrade djupvärdet. |
| `VK_COMPARE_OP_NOT_EQUAL` | Går igenom om fragmentets djupvärde inte är lika med det lagrade djupvärdet. |
| `VK_COMPARE_OP_GREATER_OR_EQUAL` | Går igenom om fragmentets djupvärde är större än eller lika med det lagrade djupvärdet. |

Vulkan har inget standardvärde här: du väljer alltid ett. `VK_COMPARE_OP_LESS` är OpenGL:s standard `GL_LESS`, och det
är vad vulkan-tutorial använder. Eftersom operatorn bakas in i pipelinen när den skapas, betyder en annan djupfunktion
för vissa föremål en andra pipeline (eller, sedan Vulkan 1.3, dynamiskt tillstånd med
`VK_DYNAMIC_STATE_DEPTH_COMPARE_OP` och `vkCmdSetDepthCompareOp`; den här kursen behåller den i pipelinen, som
vulkan-tutorial).
:::
:::d3d12
Jämförelseoperatorn (eller djupfunktionen) är PSO:ns `DepthStencilState.DepthFunc`, en `D3D12_COMPARISON_FUNC`:

| Funktion | Beskrivning |
|---|---|
| `D3D12_COMPARISON_FUNC_ALWAYS` | Djuptestet går alltid igenom. |
| `D3D12_COMPARISON_FUNC_NEVER` | Djuptestet går aldrig igenom. |
| `D3D12_COMPARISON_FUNC_LESS` | Går igenom om pixelns djupvärde är mindre än det lagrade djupvärdet. |
| `D3D12_COMPARISON_FUNC_EQUAL` | Går igenom om pixelns djupvärde är lika med det lagrade djupvärdet. |
| `D3D12_COMPARISON_FUNC_LESS_EQUAL` | Går igenom om pixelns djupvärde är mindre än eller lika med det lagrade djupvärdet. |
| `D3D12_COMPARISON_FUNC_GREATER` | Går igenom om pixelns djupvärde är större än det lagrade djupvärdet. |
| `D3D12_COMPARISON_FUNC_NOT_EQUAL` | Går igenom om pixelns djupvärde inte är lika med det lagrade djupvärdet. |
| `D3D12_COMPARISON_FUNC_GREATER_EQUAL` | Går igenom om pixelns djupvärde är större än eller lika med det lagrade djupvärdet. |

Standardtillståndet (`CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT)`) använder `D3D12_COMPARISON_FUNC_LESS`, som OpenGL:s
standard `GL_LESS`. Eftersom funktionen bakas in i PSO:n när den skapas, betyder en annan djupfunktion för vissa
föremål en andra PSO, som väljs med `SetPipelineState` före de anropen.
:::

Låt oss se vilken effekt en ändrad djupfunktion har på bilden. Kapitlets projekt är learnopengls scen för
djuptestning: två texturerade kuber som står på ett texturerat golv, utan belysning. Kuberna använder bilden
`marble.png`, golvet `metal.png`; golvets texturkoordinater går upp till 2, så dess bild upprepas. Kameran är den från
kapitlet *Camera*, i (0, 0, 3) och tittar längs -z; kuberna står i (-1, 0, -1) och (2, 0, 0), så den vänstra kuben
syns helt och av den högra syns bara vänstersidan vid fönstrets högra kant. Ritordningen är learnopengls: kub 0, kub 1
och golvet sist.

:::opengl
Projektet har learnopengls två VAO:er, `cubeVAO` (36 vertexar: position + texturkoordinater) och `planeVAO` (golvets 6
vertexar på y = -0.5), en shader (`depth_testing.vs` / `depth_testing.fs`) och funktionen `loadTexture` från
belysningskapitlen. I renderloopen binder varje föremål sin VAO och sin textur och sätter sin modellmatris:

```cpp
        // cubes
        glBindVertexArray(cubeVAO);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, cubeTexture);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
        shader.setMat4("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
        shader.setMat4("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        // floor
        glBindVertexArray(planeVAO);
        glBindTexture(GL_TEXTURE_2D, floorTexture);
        shader.setMat4("model", glm::mat4(1.0f));
        glDrawArrays(GL_TRIANGLES, 0, 6);
```

`glEnable(GL_DEPTH_TEST);` finns redan; under den markerar en `// TODO:`-kommentar var djupfunktionen ska stå. Tills du
sätter en används OpenGL:s standard `GL_LESS`.
:::
:::vulkan
Projektet är programmet från de tidigare kapitlen, med några ändringar som hela delen *Avancerad OpenGL* behåller. En
vertex är nu `struct Vertex { glm::vec3 pos; glm::vec2 texCoord; }`, och **en enda vertex buffer** rymmer båda
learnopengls mesher: kubens 36 vertexar (0..35) och golvets 6 (36..41). Där OpenGL binder en annan VAO väljer varje
anrop här sin del av buffern med parametern `firstVertex` till `vkCmdDraw`. Texturkoordinaterna är learnopengls med v
vänt (`1 - v`, för golvet `2 - v`), som i kapitlet *Textures*, så att bilderna står rätt.

Descriptor set-layouten är vulkan-tutorials: uniform buffern (vy och projektion) på binding 0, en combined image
sampler på binding 1. Det finns **ett descriptor set per textur**, `cubeDescriptorSet` och `floorDescriptorSet`, och
att binda rätt set före ett anrop är Vulkans `glBindTexture`. Modellmatrisen är en push constant:

```cpp
        // cubes
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &cubeDescriptorSet, 0, nullptr);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 36, 1, 0, 0);
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 36, 1, 0, 0);
        // floor
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &floorDescriptorSet, 0, nullptr);
        constants.model = glm::mat4(1.0f);
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 6, 1, 36, 0); // the floor's 6 vertices start at vertex 36
```

`loadTexture(path, image, memory, view)` laddar `textures/marble.png` och `textures/metal.png`, och en sampler med
`VK_SAMPLER_ADDRESS_MODE_REPEAT` används för båda. Det finns en pipeline, byggd av `shaders/depth_testing.vert` och
`.frag`. Projektet har inga `// TODO:`-kommentarer: uppgifterna ändrar rader som redan finns.
:::
:::d3d12
Projektet följer de tidigare kapitlen, med några ändringar som hela delen *Avancerad OpenGL* behåller. **En enda
vertex buffer** rymmer båda learnopengls mesher: kubens 36 vertexar (0..35) och golvets 6 (36..41). Där OpenGL binder
en annan VAO väljer varje anrop här sin del av buffern med den tredje parametern till `DrawInstanced`, startvertexen.
Texturkoordinaterna är learnopengls med v vänt (`1 - v`, för golvet `2 - v`), eftersom Direct3D:s v = 0 är bildens
översta rad.

Varje textur har en SRV i CBV/SRV-heapen (CBV:n i plats 0, marmorn i plats 1, metallen i plats 2), och root parameter
2 är en descriptor table med en SRV som riktas mot rätt plats före varje anrop – Direct3D:s `glBindTexture`.
Modellmatrisen ligger i root constants (root parameter 0):

```cpp
    // cubes: the marble texture (root parameter 2) and a model matrix each (root parameter 0)
    ModelConstants modelConstants = {};
    m_commandList->SetGraphicsRootDescriptorTable(2, cubeTexture);
    XMMATRIX model = XMMatrixTranslation(-1.0f, 0.0f, -1.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    model = XMMatrixTranslation(2.0f, 0.0f, 0.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    // floor: the metal texture, no model transformation, 6 vertices from vertex 36 on
    m_commandList->SetGraphicsRootDescriptorTable(2, floorTexture);
    model = XMMatrixIdentity();
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(6, 1, 36, 0);
```

`cubeTexture` och `floorTexture` är GPU-handtagen till heap-platserna 1 och 2. Den statiska samplern s0 upprepar
(wrap), så golvets bild upprepas. Shadrarna finns i `depth_testing.hlsl`. Projektet har inga `// TODO:`-kommentarer:
uppgifterna ändrar rader som redan finns.
:::

Tryck på **Build & run** (Ctrl+Enter) för att se startbilden i den inbyggda simulatorn: två marmorkuber på ett
metallgolv vars bortre kant bildar horisonten.

Nu sätter vi djupfunktionen till "alltid": varje fragment klarar djuptestet.

:::opengl
```cpp
    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_ALWAYS); // always pass the depth test (same effect as glDisable(GL_DEPTH_TEST))
```

Kommentaren är learnopengls, och för bilden stämmer den: med `GL_ALWAYS` går testet igenom, så färgen från det
fragment som ritas sist blir kvar. (Strängt taget är de två inte identiska: med `GL_ALWAYS` skrivs djupbuffern
fortfarande, med djuptestet avslaget gör den inte det.)
:::
:::vulkan
I `createPipeline()`:

```cpp
        depthStencil.depthCompareOp = VK_COMPARE_OP_ALWAYS; // always pass the depth test (same effect as depthTestEnable = VK_FALSE)
```

För bilden stämmer kommentaren: med ALWAYS går testet igenom, så färgen från det fragment som ritas sist blir kvar.
(Strängt taget är de två inte identiska: med ALWAYS skrivs djupbuffern fortfarande, med djuptestet avslaget gör den
inte det.)
:::
:::d3d12
I `LoadAssets`, PSO:ns djupfunktion:

```cpp
        psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_ALWAYS;    // always pass the depth test: the last draw wins
```

Med ALWAYS går testet igenom, så färgen från den pixel som ritas sist blir kvar – för bilden samma effekt som
`DepthEnable = FALSE`. (Strängt taget är de två inte identiska: med ALWAYS skrivs djupbuffern fortfarande, med
djuptestet avslaget gör den inte det.)
:::

Gör nu uppgiften **depth-always** och tryck på **Build & run**. Det här ger samma beteende som om vi inte hade slagit
på djuptestning. Djuptestet går alltid igenom, så de fragment som ritas sist hamnar framför de fragment som ritades
tidigare, även om de borde ha legat längst fram. Eftersom vi ritar golvet sist skriver golvets fragment över lådornas
fragment överallt där de täcker dem: de nedre delarna av båda kuberna, under horisonten, visar nu metallgolvet. Och
inuti varje kub täcker de sidor som ritas senare (baksidan, sidorna, ovansidan) framsidan, så den övre delen av den
vänstra kuben ser inte längre ut som dess framsida.

```quiz
Med djupfunktionen ALWAYS, varför täcker golvet kubernas nedre halva – fast det ligger bakom dem?
- [ ] Därför att golvets djupvärden är mindre än kubernas
- [ ] Därför att ALWAYS får GPU:n att sortera trianglarna bakifrån och fram
- [x] Varje fragment går igenom, så det sista som ritas i en pixel blir kvar – och golvet ritas efter kuberna
---
Med ALWAYS frågas det lagrade djupet aldrig: bara ritordningen avgör. Golvet täcker kuberna bara där det ligger på skärmen – under horisonten – och ovanför vinner kubernas egna, senare ritade sidor.
```

:::opengl
```quiz
`glDepthFunc(GL_ALWAYS);` anropas en gång, före renderloopen. Varför påverkar det varje anrop i varje bildruta?
- [x] OpenGL är en tillståndsmaskin: djupfunktionen är globalt tillstånd som gäller tills den ändras igen
- [ ] `glDepthFunc` lagras i den VAO som är bunden
- [ ] Den är en del av shaderprogrammet, så varje anrop med `shader` använder den
---
Inställningar som `glEnable(GL_DEPTH_TEST)` och `glDepthFunc` ändrar OpenGL-kontextens tillstånd. Varje ritanrop använder det tillstånd som gäller just då – för att rita ett föremål med en annan djupfunktion anropar du `glDepthFunc` igen före det.
```
:::
:::vulkan
```quiz
Var bestäms djupfunktionen i Vulkan, och när får en ändring effekt?
- [x] I pipelinens `VkPipelineDepthStencilStateCreateInfo`: den bakas in när `createPipeline()` skapar pipelinen, och varje anrop med den pipelinen använder den
- [ ] I render passet: `depthAttachment.loadOp` avgör hur fragment jämförs
- [ ] I djup-imagens view: `VK_IMAGE_ASPECT_DEPTH_BIT` väljer jämförelsen
---
Vulkans pipelines går inte att ändra. För att rita vissa föremål med en annan djupfunktion skapar du en andra pipeline och binder den före de anropen (eller, sedan Vulkan 1.3, gör jämförelsen till dynamiskt tillstånd).
```
:::
:::d3d12
```quiz
Var bestäms djupfunktionen i Direct3D 12, och när får en ändring effekt?
- [x] I PSO:ns `DepthStencilState`: den bakas in när `CreateGraphicsPipelineState` skapar PSO:n, och varje anrop med den PSO:n använder den
- [ ] I `ClearDepthStencilView`: clear-värdet väljer jämförelsen
- [ ] I depth stencil viewn: dess `Format` avgör hur pixlar jämförs
---
En PSO går inte att ändra. För att rita vissa föremål med en annan djupfunktion skapar du en andra PSO och väljer den med `SetPipelineState` före de anropen.
```
:::

Sätt sedan tillbaka djupfunktionen till "mindre än" – ett fragment går igenom när det ligger närmare än det djup som
hittills lagrats:

:::opengl
```cpp
    glDepthFunc(GL_LESS); // pass when the fragment is closer than the stored depth (OpenGL's default)
```
:::
:::vulkan
```cpp
        depthStencil.depthCompareOp = VK_COMPARE_OP_LESS; // keep the fragment if it is nearer than the stored depth
```
:::
:::d3d12
```cpp
        psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_LESS;
```
:::

Gör uppgiften **depth-less** och tryck på **Build & run**: startbilden är tillbaka, med kuberna stående framför golvet.

## Djupvärdenas precision

Djupbuffern innehåller djupvärden mellan `0.0` och `1.0`, och den jämför sitt innehåll med z-värdena för alla föremål
i scenen sett från betraktaren. Z-värdena i vyrummet kan vara vilket värde som helst mellan projektionsfrustumets
`near`- och `far`-plan. Vi behöver alltså ett sätt att transformera z-värdena i vyrummet till intervallet `[0,1]`, och
ett sätt är att transformera dem linjärt. Följande (linjära) ekvation transformerar z-värdet till ett djupvärde mellan
`0.0` och `1.0`:

```text
F_depth = (z - near) / (far - near)
```

Här är `near` och `far` de near- och far-värden vi gav projektionsmatrisen för att bestämma det synliga frustumet (i
det här projektet 0.1 och 100). Ekvationen tar ett djupvärde z inom frustumet och transformerar det till intervallet
`[0,1]`: z lika med `near` ger `0.0`, z lika med `far` ger `1.0`.

I praktiken används dock nästan aldrig en linjär djupbuffer som denna. På grund av projektionens egenskaper används en
icke-linjär djupekvation som är proportionell mot `1/z`. Resultatet är att vi får enorm precision när z är litet och
mycket mindre precision när z är långt bort.

Tänk efter en sekund: vill vi verkligen att djupvärden 1000 enheter bort ska ha samma precision som detaljrika föremål
på avståndet 1? Den linjära ekvationen tar inte hänsyn till det.

Eftersom den icke-linjära funktionen är proportionell mot `1/z` ger z-värden mellan 1.0 och 2.0 djupvärden mellan 1.0
och 0.5, vilket är halva flyttalets intervall `[0,1]` – enorm precision vid små z-värden. Z-värden mellan 50.0 och
100.0 skulle bara stå för 2 % av flyttalets intervall – precis vad vi vill. En sådan ekvation, som också tar hänsyn
till near- och far-avstånden, ser ut så här:

```text
F_depth = (1/z - 1/near) / (1/far - 1/near)
```

Oroa dig inte om du inte vet exakt vad som pågår i den här ekvationen. Det viktiga att komma ihåg är att värdena i
djupbuffern inte är linjära i klipprummet (de är linjära i vyrummet innan projektionsmatrisen tillämpas). Värdet `0.5`
i djupbuffern betyder inte att pixelns z-värde ligger halvvägs i frustumet; vertexens z-värde ligger i själva verket
ganska nära near-planet. Med projektets near = 0.1 och far = 100 ligger djupet 0.5 bara 0.2 enheter från kameran, och
djupet 0.9 är fortfarande mindre än 1 enhet bort: nästan hela djupbufferns intervall går åt till den första enheten
framför kameran.

Ekvationen är inbyggd i projektionsmatrisen. Projektionsmatrisen ger djupet i normaliserade enhetskoordinater (NDC),
och viewport-transformen avbildar det på djupbufferns intervall:

:::opengl
OpenGL:s projektionsmatris (`glm::perspective`) avbildar frustumet på NDC-z-värden från `-1` (near) till `1` (far);
viewport-transformen avbildar sedan `-1..1` på djupintervallet `0..1` (som sätts med `glDepthRange`, `0..1` som
standard). Värdet som hamnar i djupbuffern är exakt `F_depth` ovan.
:::
:::vulkan
Vulkans NDC-z går från `0` (near) till `1` (far): `GLM_FORCE_DEPTH_ZERO_TO_ONE`, definierad överst i `main.cpp`, får
`glm::perspective` att ge det intervallet. Viewportens `minDepth = 0.0f` och `maxDepth = 1.0f` lämnar det som det är, så
NDC-z *är* djupbufferns värde – exakt `F_depth` ovan. (OpenGL kommer fram till samma värde på en annan väg: NDC-z från
`-1` till `1`, som dess viewport-transform sedan avbildar på `0..1`.)
:::
:::d3d12
Direct3D:s NDC-z går från `0` (near) till `1` (far), och `XMMatrixPerspectiveFovRH` ger det intervallet. Viewportens
djupintervall `0..1` (`CD3DX12_VIEWPORT`:s standardvärden för `m_viewport`: `MinDepth` 0, `MaxDepth` 1) lämnar det som
det är, så NDC-z *är* djupbufferns värde – exakt `F_depth` ovan. (OpenGL kommer fram till samma värde på en annan väg:
NDC-z från `-1` till `1`, som dess viewport-transform sedan avbildar på `0..1`.)
:::

Effekten av den här icke-linjära ekvationen blir snabbt tydlig när vi försöker visualisera djupbuffern.

```quiz
Med near = 0.1 och far = 100, hur långt från kameran ligger ett fragment vars värde i djupbuffern är 0.5?
- [ ] Ungefär 50 enheter – halvvägs mellan near- och far-planet
- [ ] Ungefär 10 enheter
- [x] Ungefär 0.2 enheter – strax framför near-planet
- [ ] Det beror på fönstrets storlek
---
Djupet är proportionellt mot 1/z, inte mot z. Löser man `0.5 = (1/z - 10) / (0.01 - 10)` får man z ≈ 0.2: hälften av djupbufferns värden används mellan 0.1 och 0.2 enheter.
```

## Visualisera djupbuffern

Vi vet att z-värdet i den inbyggda fragmentpositionen i fragment shadern innehåller fragmentets djupvärde. Om vi gav
ut det djupvärdet som en färg kunde vi visa djupvärdena för alla fragment i scenen:

:::opengl
```glsl
    // FragColor = texture(texture1, TexCoords);
    FragColor = vec4(vec3(gl_FragCoord.z), 1.0); // the fragment's depth value: 0.0 at the near plane, 1.0 at the far plane
```

Det här hamnar i `depth_testing.fs`; behåll texturraden som en kommentar så att du kan byta tillbaka senare.
:::
:::vulkan
I `shaders/depth_testing.frag`:

```glsl
void main() {
    // the fragment's depth in the depth buffer (0.0 at the near plane, 1.0 at the far plane) as a grey
    outColor = vec4(vec3(gl_FragCoord.z), 1.0);
}
```
:::
:::d3d12
I `PSMain`, i `depth_testing.hlsl`, får textursamplingen ge plats åt pixelns djup:

```hlsl
    // In the pixel shader, SV_POSITION is the pixel's position in the window (x, y)
    // and its depth (z: 0 at the near plane, 1 at the far plane), like GLSL's gl_FragCoord.
    return float4(input.position.zzz, 1.0f);
```

`input.position.zzz` är en *swizzle*: en `float3` med z-komponenten tre gånger.
:::

Gör nu uppgiften **visualize-depth** och tryck på **Build & run**. Om du kör programmet märker du förmodligen att allt
är vitt, så att det ser ut som om alla våra djupvärden är det största djupvärdet `1.0`. Varför ligger inga djupvärden
närmare `0.0` och är därmed mörkare?

I förra avsnittet beskrev vi att djupvärden i skärmrummet är icke-linjära: de har mycket hög precision för små
z-värden och låg precision för stora. Fragmentets djupvärde växer snabbt med avståndet, så nästan alla vertexar har
värden nära `1.0`. Framsidan på den vänstra kuben ligger 3.5 enheter bort, och dess djup är redan ungefär 0.97; golvet
ligger mellan 0.93 och 0.98. Om vi försiktigt flyttade oss riktigt nära ett föremål skulle du till slut se färgerna bli
mörkare när deras z-värden blir mindre. Bara bakgrunden förblir som den var: där ritas inga fragment, så den behåller
clear-färgen.

Det här visar tydligt att djupvärdet är icke-linjärt. Föremål nära oss påverkar djupvärdet mycket mer än föremål långt
bort. Att bara flytta sig några centimeter kan få färgerna att gå från mörka till helt vita.

Vi kan dock transformera fragmentets icke-linjära djupvärden tillbaka till deras linjära motsvarighet. För det behöver
vi i grunden vända på projektionen, för enbart djupvärdena.

:::opengl
Det betyder att vi först måste transformera djupvärdena från intervallet `[0,1]` tillbaka till normaliserade
enhetskoordinater i intervallet `[-1,1]`. Sedan vill vi vända på den icke-linjära ekvationen som projektionsmatrisen
använder och tillämpa den inverterade ekvationen på det resulterande djupvärdet. Resultatet är ett linjärt djupvärde.

Först transformerar vi djupvärdet till NDC, vilket inte är så svårt:

```glsl
float z = depth * 2.0 - 1.0; // back to NDC (OpenGL maps NDC z -1..1 to depth 0..1)
```

Sedan tar vi det resulterande z-värdet och tillämpar den inversa transformationen för att få det linjära djupvärdet:

```glsl
return (2.0 * near * far) / (far + near - z * (far - near));
```

Ekvationen är härledd från projektionsmatrisen som gör djupvärdena icke-linjära, och ger djupvärden mellan `near` och
`far` – avståndet från kameran. Den fullständiga fragment shadern som omvandlar det icke-linjära djupet i skärmrummet
till ett linjärt djupvärde blir då:

```glsl
#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D texture1;

float near = 0.1;
float far = 100.0;
float LinearizeDepth(float depth)
{
    float z = depth * 2.0 - 1.0; // back to NDC (OpenGL maps NDC z -1..1 to depth 0..1)
    return (2.0 * near * far) / (far + near - z * (far - near));
}

void main()
{
    // FragColor = texture(texture1, TexCoords);
    float depth = LinearizeDepth(gl_FragCoord.z) / far; // divide by far to get depth in range [0,1] for visualization purposes
    FragColor = vec4(vec3(depth), 1.0);
}
```

Eftersom de linjära djupvärdena går från `near` till `far` hamnar de flesta över `1.0` och visas helt vita. Genom att
dela det linjära djupvärdet med `far` i `main` omvandlar vi det till intervallet `[0, 1]`.
:::
:::vulkan
learnopengls version avbildar först djupet tillbaka på OpenGL:s NDC, `float z = depth * 2.0 - 1.0;`, eftersom OpenGL:s
NDC-z går från `-1` till `1`. I Vulkan finns inget att ångra: djupbufferns värde *är* redan NDC-z (`0..1`). Vi kan alltså
tillämpa inversen av projektionens djupekvation direkt. Löser man `F_depth = (1/z - 1/near) / (1/far - 1/near)` för z
får man:

```text
z = near * far / (far - F_depth * (far - near))
```

– avståndet från kameran, mellan `near` och `far`. Med learnopengls formel här skulle avstånden bli fel (för stora).
Fragment shadern blir:

```glsl
layout(location = 0) out vec4 outColor;

float near = 0.1;
float far = 100.0;

// The depth buffer's value back to the distance from the camera (the inverse of the projection's depth).
// Vulkan's depth is already 0..1 (GLM_FORCE_DEPTH_ZERO_TO_ONE): no "depth * 2.0 - 1.0" back to NDC as in OpenGL.
float LinearizeDepth(float depth) {
    return (near * far) / (far - depth * (far - near));
}

void main() {
    float depth = LinearizeDepth(gl_FragCoord.z) / far; // divide by far to get depth in range [0,1] for visualization purposes
    outColor = vec4(vec3(depth), 1.0);
}
```

Eftersom de linjära djupvärdena går från `near` till `far` hamnar de flesta över `1.0` och visas helt vita. Genom att
dela det linjära djupvärdet med `far` i `main` omvandlar vi det till intervallet `[0, 1]`. (OpenGL:s formel är samma
funktion efter dess `depth * 2.0 - 1.0`: båda ger avståndet.)
:::
:::d3d12
learnopengls version avbildar först djupet tillbaka på OpenGL:s NDC, `float z = depth * 2.0 - 1.0;`, eftersom OpenGL:s
NDC-z går från `-1` till `1`. I Direct3D finns inget att ångra: djupbufferns värde *är* redan NDC-z (`0..1`). Vi kan
alltså tillämpa inversen av projektionens djupekvation direkt. Löser man `F_depth = (1/z - 1/near) / (1/far - 1/near)`
för z får man:

```text
z = near * far / (far - F_depth * (far - near))
```

– avståndet från kameran, mellan `near` och `far`. I `depth_testing.hlsl`, före `PSMain`:

```hlsl
// The projection's near and far planes (static const: constants of the shader itself,
// not values in a constant buffer).
static const float near = 0.1f;
static const float far = 100.0f;

// Turns a depth value (0..1, not linear) back into the distance from the camera. Direct3D's
// depth is 0..1 already (OpenGL's NDC z is -1..1, so learnopengl first does z * 2.0 - 1.0).
float LinearizeDepth(float depth)
{
    return (near * far) / (far - depth * (far - near));
}
```

`static const` spelar roll: i HLSL är en global variabel utan `static` inte en konstant i shadern utan ett värde i en
implicit constant buffer (`$Globals`) som programmet skulle behöva sätta. Och `PSMain` returnerar det linjära djupet:

```hlsl
    // divide by far to get depth in range [0,1] for visualization purposes
    float depth = LinearizeDepth(input.position.z) / far;
    return float4(depth, depth, depth, 1.0f);
```

Eftersom de linjära djupvärdena går från `near` till `far` hamnar de flesta över `1.0` och visas helt vita. Genom att
dela det linjära djupvärdet med `far` omvandlar vi det till intervallet `[0, 1]`. (OpenGL:s formel är samma funktion
efter dess `depth * 2.0 - 1.0`: båda ger avståndet.)
:::

:::opengl
```quiz
Varför börjar OpenGL:s `LinearizeDepth` med `depth * 2.0 - 1.0`?
- [ ] För att göra om färgintervallet 0..1 till ett tal med tecken för shadern
- [ ] Därför att `gl_FragCoord.z` går från -1 till 1
- [ ] För att fördubbla djupvärdets precision
- [x] Projektionsmatrisen gav NDC-z i -1..1 och viewporten avbildade det på 0..1; för att invertera projektionen måste djupet först tillbaka till -1..1
---
Den inversa formeln `(2.0 * near * far) / (far + near - z * (far - near))` är inversen av projektionsmatrisens djuprad, som arbetar i OpenGL:s NDC (-1..1). `gl_FragCoord.z` innehåller fönsterdjupet (0..1), så det avbildas tillbaka först.
```
:::
:::vulkan
```quiz
learnopengls `LinearizeDepth` börjar med `depth * 2.0 - 1.0`. Varför utelämnar Vulkan-versionen det?
- [ ] Vulkans `gl_FragCoord.z` innehåller redan det linjära avståndet
- [ ] Steget behövs bara för texturer, inte för djupvärden
- [ ] Vulkans djupbuffer går från -1 till 1, så den är redan i NDC
- [x] Vulkans NDC-z går redan från 0 till 1 (med `GLM_FORCE_DEPTH_ZERO_TO_ONE`), så djupvärdet *är* NDC-z – det finns inget -1..1-intervall att gå tillbaka till
---
OpenGL:s projektion ger NDC-z i -1..1 och dess viewport avbildar det på 0..1; learnopengl ångrar avbildningen först. I Vulkan lämnar viewporten (0..1) NDC-z oförändrat, så `near * far / (far - depth * (far - near))` inverterar projektionen direkt. Gör man learnopengls steg ändå blir avstånden för stora.
```
:::
:::d3d12
```quiz
learnopengls `LinearizeDepth` börjar med `depth * 2.0 - 1.0`. Varför utelämnar HLSL-versionen det?
- [ ] `SV_POSITION.z` innehåller redan det linjära avståndet i pixel shadern
- [ ] Steget behövs bara för texturer, inte för djupvärden
- [ ] Direct3D:s djupbuffer går från -1 till 1, så den är redan i NDC
- [x] Direct3D:s NDC-z går redan från 0 till 1, så djupvärdet *är* NDC-z – det finns inget -1..1-intervall att gå tillbaka till
---
OpenGL:s projektion ger NDC-z i -1..1 och dess viewport avbildar det på 0..1; learnopengl ångrar avbildningen först. I Direct3D lämnar viewporten (0..1) NDC-z oförändrat, så `near * far / (far - depth * (far - near))` inverterar projektionen direkt. Gör man learnopengls steg ändå blir avstånden för stora.
```
:::

Gör nu uppgiften **linear-depth** och tryck på **Build & run**. Bilden är nu nästan svart: värdet är avståndet delat
med 100, och föremålen ligger bara några enheter bort – framsidan på den vänstra kuben, 3.5 enheter från kameran, får
0.035. Golvet blir ljusare bakåt, och bakgrunden (clear-färgen, 0.1) är nu ljusare än allt som ritats. Färgerna är
mest svarta eftersom djupvärdena går linjärt från near-planet, 0.1, till far-planet, 100 – som fortfarande ligger
ganska långt bort. Resultatet är att vi befinner oss relativt nära near-planet och därför får låga (mörka) djupvärden.

## Z-fighting

En vanlig visuell artefakt kan uppstå när två plan eller trianglar ligger så nära varandra att djupbuffern inte har
tillräcklig precision för att avgöra vilken av de två formerna som ligger framför den andra. Resultatet är att de två
formerna hela tiden verkar byta ordning, vilket ger konstiga, flimrande mönster. Det kallas *z-fighting*, eftersom det
ser ut som om formerna slåss om vem som hamnar överst.

I scenen vi har använt finns några ställen där z-fighting kan märkas. Lådorna står på exakt samma höjd som golvet,
vilket betyder att lådans bottenplan ligger i samma plan som golvet: båda ligger på y = -0.5. Då har de två planen
samma djupvärden, så djuptestet har inget sätt att avgöra vilket som är det rätta. Om du flyttar kameran in i en av
lådorna syns effekten tydligt: lådans nedre del växlar hela tiden mellan lådans bottensida och golvet i ett
sicksackmönster.

Z-fighting är ett vanligt problem med djupbuffrar och syns i allmänhet mer när föremålen är längre bort (eftersom
djupbuffern har mindre precision vid större z-värden). Z-fighting går inte att förhindra helt, men det finns några
knep som hjälper till att mildra eller helt förhindra den i din scen.

### Förhindra z-fighting

Det första och viktigaste knepet är att *aldrig placera föremål så nära varandra att några av deras trianglar
överlappar nästan exakt*. Genom att lägga en liten förskjutning mellan två föremål kan du helt ta bort z-fighting
mellan dem. När det gäller lådorna och planet hade vi lätt kunnat flytta lådorna en aning uppåt i positiv y-led. Den
lilla ändringen av lådornas positioner skulle troligen inte märkas alls och skulle helt ta bort z-fightingen. Det
kräver dock manuella ingrepp för varje föremål och noggrann testning för att säkerställa att inga föremål i en scen ger
z-fighting.

Ett andra knep är att *placera near-planet så långt bort som möjligt*. I ett av de tidigare avsnitten såg vi att
precisionen är extremt stor nära near-planet, så om vi flyttar near-planet bort från betraktaren får vi betydligt
större precision över hela frustumet. Ett near-plan som ligger för långt bort kan dock klippa bort föremål nära
kameran, så det är oftast en fråga om att justera och experimentera för att hitta det bästa near-avståndet för din
scen.

Ett annat bra knep, på bekostnad av viss prestanda, är att *använda en djupbuffer med högre precision*. De flesta
djupbuffrar har 24 bitars precision, men de flesta GPU:er i dag stöder djupbuffrar på 32 bitar, vilket ökar
precisionen betydligt. På bekostnad av viss prestanda får du alltså mycket mer precision i djuptestningen, och mindre
z-fighting.

:::opengl
(Med GLFW ber du om en sådan med fönsterhinten `GLFW_DEPTH_BITS` innan fönstret skapas.)
:::
:::vulkan
(Projektets djupbuffer är redan en sådan: `VK_FORMAT_D32_SFLOAT`, den första kandidaten i `findDepthFormat()`.)
:::
:::d3d12
(Projektets djupbuffer är redan en sådan: `DXGI_FORMAT_D32_FLOAT`.)
:::

:::vulkan d3d12
Med en djupbuffer av 32-bitars *flyttal* och djupintervallet `0..1` finns ytterligare ett knep som många motorer
använder, *reversed z* (omvänt z): projektionen avbildar near-planet på 1 och far-planet på 0, djupbuffern töms till 0
och djupfunktionen blir GREATER. Ett flyttal har mest precision nära 0, och det ligger nu där `1/z`-kurvan har minst –
de två tar ungefär ut varandra, och precisionen blir nästan jämn över hela frustumet.
:::

De tre teknikerna vi har gått igenom är de vanligaste och enklaste att implementera mot z-fighting. Det finns andra
tekniker som kräver mycket mer arbete och ändå inte helt tar bort z-fighting. Z-fighting är ett vanligt problem, men om
du använder en lämplig kombination av teknikerna ovan behöver du troligen inte bry dig så mycket om det.

```quiz
Vilka av de här hjälper mot z-fighting? (Välj alla som stämmer.)
- [x] Att flytta near-planet längre bort från kameran, så långt som scenen tillåter
- [ ] Att flytta far-planet längre bort, från 100 till 1000
- [x] Att lyfta kuberna en aning så att deras bottensidor inte längre ligger exakt på golvet
- [x] Att använda en djupbuffer med fler bitar, t.ex. 32 i stället för 24
---
Precisionen läggs mest nära near-planet, så att flytta ut near-planet sprider den över scenen; att flytta ut far-planet gör motsatsen (lite grann). Att separera ytor i samma plan tar bort oavgjordheten helt, och fler bitar ger varje avstånd fler distinkta djupvärden.
```

Nästa kapitel lägger till djupbufferns partner, stencilbuffern, och använder den för att rita konturer runt kuberna.
