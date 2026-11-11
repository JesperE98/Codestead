# Advanced Data

I de flesta kapitlen har vi använt buffrar flitigt för att lagra data på GPU:n. I det här kapitlet går vi kort igenom
några alternativa sätt att hantera buffrar: att fylla en buffer i delar, att skriva in i den via en pekare, att lagra
vertexattributen i block i stället för omväxlande (interleaved), och att kopiera en buffer till en annan.

:::opengl
En buffer i OpenGL är i grunden ett objekt som hanterar en viss bit GPU-minne och inget mer. Vi ger bufferten en
betydelse när vi binder den till ett visst *buffer target*. En buffer är bara en vertex array buffer när vi binder den
till `GL_ARRAY_BUFFER`, men vi kunde lika gärna binda den till `GL_ELEMENT_ARRAY_BUFFER`. OpenGL lagrar internt en
referens till bufferten per target och behandlar bufferten olika beroende på target.
:::
:::vulkan
En buffer i Vulkan är i grunden en `VkBuffer` – en beskrivning av ett intervall av byte och vad det får användas till
(dess usage-flaggor: vertex buffer, uniform buffer, transfer source …) – bunden till en `VkDeviceMemory`-allokering som
håller byten. Minnestypen du allokerar från avgör vem som når byten: *host-visible* minne kan mappas och skrivas av
CPU:n, *device-local* minne är snabbast för GPU:n men oftast utom räckhåll för CPU:n.
:::
:::d3d12
En buffer i Direct3D 12 är en `ID3D12Resource` med en buffer-beskrivning, skapad i en *heap*. Heap-typen avgör vem som
når byten: en *upload heap* (`D3D12_HEAP_TYPE_UPLOAD`) kan mappas och skrivas av CPU:n och läsas av GPU:n, en *default
heap* (`D3D12_HEAP_TYPE_DEFAULT`) är minne som bara GPU:n använder – snabbast för GPU:n att läsa, men CPU:n kan inte
skriva i det. Vad bufferten *är* (vertex buffer, constant buffer …) avgörs av de vyer du gör av den: en vertex buffer
view, en constant buffer view.
:::

learnopengl.com:s kapitel har inget eget demoprogram, så det här kapitlets projekt är än en gång scenen från *Depth
testing* – de två marmorkuberna, metallgolvet, kameran på (0, 0, 3) – och varje uppgift ändrar *hur* vertexdatan
hamnar i buffrarna, inte *vad* som ritas. **Efter varje uppgift är bilden exakt densamma.** Det är själva poängen:
uppgifterna kontrollerar din kod, och den oförändrade bilden bevisar att datan kom fram dit GPU:n väntar sig den.

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift bygger och kör du programmet i din
IDE.

## Filling buffers

:::opengl
Hittills har vi fyllt bufferns minne genom att anropa `glBufferData`, som allokerar en bit GPU-minne och lägger in
data i det. Om vi skickar `NULL` som data allokerar funktionen bara minnet utan att fylla det. Det är användbart om vi
först vill *reservera* en viss mängd minne och komma tillbaka till bufferten senare.

I stället för att fylla hela bufferten med ett enda funktionsanrop kan vi också fylla vissa delar av den med
`glBufferSubData`. Funktionen tar ett buffer target, en offset, datans storlek och själva datan. Det nya är att vi nu
kan ange en offset som säger *varifrån* vi vill fylla bufferten. Så kan vi lägga in eller uppdatera bara vissa delar
av bufferns minne. Observera att bufferten måste ha tillräckligt med allokerat minne, så ett anrop till `glBufferData`
behövs innan `glBufferSubData` anropas på bufferten.

Gör nu den första uppgiften, **buffer-sub-data**: vid TODO:n i kubens VAO-block reserverar du först minnet och fyller
det i ett andra steg:

```cpp
    glBufferData(GL_ARRAY_BUFFER, sizeof(cubeVertices), NULL, GL_STATIC_DRAW); // only make room: no data yet
    glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(cubeVertices), &cubeVertices);  // fill the buffer from byte 0 on
```

Här är intervallet hela bufferten, från byte 0 till `sizeof(cubeVertices)`, så resultatet blir detsamma som förut. Men
med en offset skulle du till exempel senare kunna ersätta bara texturkoordinaterna för en sida.

Ännu ett sätt att få in data i en buffer är att be om en pekare till bufferns minne och själv kopiera in datan. När vi
anropar `glMapBuffer` returnerar OpenGL en pekare till den bundna buffertens minne som vi kan arbeta med:

```cpp
    glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), NULL, GL_STATIC_DRAW); // only make room
    void *ptr = glMapBuffer(GL_ARRAY_BUFFER, GL_WRITE_ONLY); // a pointer to the buffer's memory
    memcpy(ptr, planeVertices, sizeof(planeVertices));    // copy the vertices into it
    glUnmapBuffer(GL_ARRAY_BUFFER);                        // done: the pointer is no longer valid
```

Med `glUnmapBuffer` talar vi om för OpenGL att vi är klara med pekaren. Efter unmap är pekaren ogiltig; funktionen
returnerar `GL_TRUE`, eller `GL_FALSE` i det sällsynta fallet att bufferns innehåll blev förstört medan den var mappad.
Det andra argumentet till `glMapBuffer`, `GL_WRITE_ONLY`, lovar att vi bara skriver genom pekaren och aldrig läser.

`glMapBuffer` är användbart för att mappa data direkt till en buffer, utan att först lagra den i ett tillfälligt
minne. Tänk dig att läsa data direkt från en fil och kopiera in den i bufferns minne.

Gör nu uppgiften **map-buffer**: fyll golvets buffer på det här sättet, vid TODO:n i golvets VAO-block. `memcpy`
behöver `#include <cstring>` högst upp i `main.cpp`.
:::
:::vulkan
OpenGL fyller en buffer med `glBufferData` (allokera och fyll), `glBufferSubData` (fyll en del) eller `glMapBuffer`
(hämta en pekare och skriv genom den). Vulkan har inget anrop som tar din data och lägger den i en buffer bakom
kulisserna; det som finns är det tredje sättet – en pekare – plus ett kommando för små uppdateringar.

Vår vertex buffer ligger i host-visible, host-coherent minne, och `createVertexBuffer()` fyller den som i
vulkan-tutorials kapitel *Vertex buffer creation*: `vkMapMemory` mappar minnet, `memcpy` kopierar alla 42 vertexar,
`vkUnmapMemory` avslutar mappningen. Men `vkMapMemory` tar en offset och en storlek – den mappar bara byten från
`offset` till `offset + size`, och pekaren den returnerar pekar på den första av dem. Att mappa ett intervall och
kopiera direkt är Vulkans `glBufferSubData`; att mappa och skriva genom pekaren är `glMapBuffer`.

Gör nu den första uppgiften, **map-memory**: kopiera vertexarna del för del – först kubens intervall, sedan golvets:

```cpp
        // part by part: vkMapMemory maps only the bytes from offset to offset + size (glBufferSubData / glMapBuffer in
        // OpenGL); the pointer it returns points at the first of them
        VkDeviceSize cubeSize = sizeof(Vertex) * 36;  // vertices 0..35
        VkDeviceSize floorSize = sizeof(Vertex) * 6;  // vertices 36..41, right after the cube's
        void* data;
        vkMapMemory(device, vertexBufferMemory, 0, cubeSize, 0, &data);
            memcpy(data, vertices.data(), (size_t) cubeSize);
        vkUnmapMemory(device, vertexBufferMemory);

        vkMapMemory(device, vertexBufferMemory, cubeSize, floorSize, 0, &data);
            memcpy(data, vertices.data() + 36, (size_t) floorSize);
        vkUnmapMemory(device, vertexBufferMemory);
```

Två regler gäller. Ett minnesobjekt får bara vara mappat en gång i taget, så du gör unmap innan du mappar nästa
intervall. Och eftersom minnet är `VK_MEMORY_PROPERTY_HOST_COHERENT_BIT` blir det du skriver genom pekaren synligt för
GPU:n utan något uttryckligt `vkFlushMappedMemoryRanges`.

Uniform buffern använder samma mekanism på ett annat sätt: den förblir mappad medan programmet kör ("persistent
mapping"), och `updateUniformBuffer()` kopierar in vy- och projektionsmatrisen varje frame. Det går bra eftersom
`drawFrame()` först väntar på fencen, så GPU:n läser inte bufferten medan CPU:n skriver i den.

För små data som ändras varje frame har Vulkan ett andra sätt, närmare `glBufferSubData` än mappning:
`vkCmdUpdateBuffer`. Det är ett *kommando*: när du spelar in det kopieras din data in i command buffern, och GPU:n
skriver datan in i bufferten när den kör kommandona. Det är tänkt för små uppdateringar – högst 65536 byte, en
multipel av 4 – och det är inte tillåtet inuti ett render pass. Bufferten behöver `VK_BUFFER_USAGE_TRANSFER_DST_BIT`,
och eftersom CPU:n aldrig mappar den kan den ligga i device-local minne.

Gör nu uppgiften **update-buffer**: skapa uniform buffern som transfer destination i device-local minne (och ta bort
mappningen och `uniformBufferMapped`), låt `updateUniformBuffer` ta command buffern och spela in uppdateringen, och
anropa den från `recordCommandBuffer()` direkt efter `vkBeginCommandBuffer`, före render passet. `drawFrame()` anropar
den inte längre.

```cpp
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, uniformBuffer, uniformBufferMemory);
```

```cpp
        vkCmdUpdateBuffer(commandBuffer, uniformBuffer, 0, sizeof(ubo), &ubo);

        // a barrier: the vertex shaders read the uniform buffer only after the write has finished
        VkBufferMemoryBarrier barrier{};
        barrier.sType = VK_STRUCTURE_TYPE_BUFFER_MEMORY_BARRIER;
        barrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
        barrier.dstAccessMask = VK_ACCESS_UNIFORM_READ_BIT;
        barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
        barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
        barrier.buffer = uniformBuffer;
        barrier.offset = 0;
        barrier.size = sizeof(ubo);

        vkCmdPipelineBarrier(
            commandBuffer,
            VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_VERTEX_SHADER_BIT,
            0,
            0, nullptr,
            1, &barrier,
            0, nullptr
        );
```

Uppdateringen är en transfer-operation. Utan barriären skulle GPU:n kunna starta ritanropens vertex shaders medan
skrivningen fortfarande pågår; barriären säger: allt i vertex shader-steget som läser uniforms väntar på
transfer-skrivningarna före det. `sizeof(ubo)` är två `glm::mat4`, 128 byte – gott och väl inom gränsen.
:::
:::d3d12
OpenGL fyller en buffer med `glBufferData` (allokera och fyll), `glBufferSubData` (fyll en del) eller `glMapBuffer`
(hämta en pekare och skriv genom den). Direct3D 12 har inget anrop som tar din data och lägger den i en buffer bakom
kulisserna; det som finns är pekaren: `Map` returnerar en CPU-pekare till minnet hos en buffer i en upload heap, och
`Unmap` avslutar den. Att skriva genom pekaren är OpenGL:s `glMapBuffer`; att kopiera ett block till en offset från
pekaren är `glBufferSubData`. (För data som ändras per ritanrop finns också root constants,
`SetGraphicsRoot32BitConstants`, som projektet redan använder för modellmatrisen: de följer med inuti själva command
listen.)

Just nu håller en enda vertex buffer i en upload heap allt: kuben är vertex 0 till 35, golvet 36 till 41. learnopengl
ger golvet en egen buffer, `planeVBO`. Gör nu den första uppgiften, **map-buffer**: flytta golvets sex vertexar ut ur
`vertices` till en egen `Vertex planeVertices[]` och ge dem en egen buffer, `m_floorVertexBuffer`, fylld genom
pekaren:

```cpp
        // Map gives a CPU pointer to the buffer's memory (learnopengl: glMapBuffer). The read
        // range (0, 0) says that the CPU reads nothing from it.
        UINT8* pPlaneDataBegin = nullptr;
        CD3DX12_RANGE readRange(0, 0);
        ThrowIfFailed(m_floorVertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pPlaneDataBegin)));
        // Write through the pointer: copy the vertices in.
        memcpy(pPlaneDataBegin, planeVertices, sizeof(planeVertices));
        // Done: Unmap (learnopengl: glUnmapBuffer); the pointer is no longer valid. The written
        // range tells the driver which bytes the CPU changed: all of them.
        CD3DX12_RANGE writtenRange(0, sizeof(planeVertices));
        m_floorVertexBuffer->Unmap(0, &writtenRange);
```

Det första argumentet till båda är subresursen – en buffer har bara en, 0. De två intervallen är ledtrådar: read
range säger vilka byte CPU:n kommer att läsa (inga: `(0, 0)`; `nullptr` skulle betyda alla), written range vilka byte
den ändrade (`nullptr` skulle betyda alla). Minne i en upload heap är oftast write-combined: snabbt att skriva i
ordning, mycket långsamt att läsa, så det spelar roll att tala om för drivrutinen att du inte tänker läsa. Bufferten
skapas som kubens – en upload heap, `CD3DX12_RESOURCE_DESC::Buffer(planeVertexBufferSize)`, tillståndet
`D3D12_RESOURCE_STATE_GENERIC_READ` – och får en egen vertex buffer view, `m_floorVertexBufferView` (stride
`sizeof(Vertex)`).

I `PopulateCommandList` binder golvet nu sin egen vy före sitt ritanrop, och dess vertexar börjar på 0:

```cpp
    // floor: its own vertex buffer, the metal texture, no model transformation, its 6 vertices
    m_commandList->IASetVertexBuffers(0, 1, &m_floorVertexBufferView);
```

med `m_commandList->DrawInstanced(6, 1, 0, 0);` i stället för `DrawInstanced(6, 1, 36, 0)`.

Precis som constant buffern får en buffer i en upload heap också vara mappad under hela sin livstid ("Keeping things
mapped for the lifetime of the resource is okay", som exemplens kommentar säger). Det du aldrig får göra är att ändra
byte som GPU:n fortfarande läser – constant buffern skrivs i `OnUpdate` först efter att `OnRender` har väntat in den
förra framen.
:::

:::opengl
```quiz
Vad gör `glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), NULL, GL_STATIC_DRAW)`?
- [ ] Den raderar bufferns innehåll och frigör dess minne
- [x] Den allokerar `sizeof(planeVertices)` byte åt den bundna bufferten utan att fylla dem
- [ ] Den fyller bufferten med nollor, så att `glBufferSubData` inte längre behövs
- [ ] Ingenting: OpenGL ignorerar ett anrop med `NULL` som data
---
Med `NULL` som data får bufferten bara sitt minne. `glBufferSubData` eller `glMapBuffer` fyller det sedan – och båda kräver att minnet redan finns.
```
:::
:::vulkan
```quiz
Varför anropar `recordCommandBuffer()` `updateUniformBuffer(commandBuffer)` före `vkCmdBeginRenderPass`?
- [ ] För att uniform buffern måste uppdateras innan swap chain-bilden hämtas
- [ ] För att `vkCmdUpdateBuffer` bara fungerar på host-visible minne
- [ ] För att en barriär bara kan spelas in allra först i en command buffer
- [x] För att `vkCmdUpdateBuffer` är ett transfer-kommando och inte är tillåtet inuti ett render pass
---
Transfer-kommandon som `vkCmdUpdateBuffer` och `vkCmdCopyBuffer` måste spelas in utanför ett render pass. Barriären efter det får sedan vertex shaders att vänta tills skrivningen är klar.
```
:::
:::d3d12
```quiz
Vad säger read range `CD3DX12_RANGE readRange(0, 0)` som skickas till `Map` till drivrutinen?
- [ ] Att bara byte 0 i bufferten kommer att skrivas
- [ ] Att bufferten görs unmap direkt
- [ ] Att GPU:n inte får läsa bufferten medan den är mappad
- [x] Att CPU:n inte kommer att läsa någon av bufferns byte genom pekaren
---
Ett tomt read range är ett löfte om att inte läsa. Minne i en upload heap är typiskt write-combined – snabbt att skriva, långsamt att läsa tillbaka – så drivrutinen behöver inte förbereda det för läsning. `nullptr` skulle betyda att CPU:n får läsa allt.
```
:::

## Batching vertex attributes

:::opengl
Med `glVertexAttribPointer` kunde vi ange attributlayouten för innehållet i vertex array buffern.
:::
:::vulkan
Med vertex input-bindningarnas och attributens beskrivningar kunde vi ange layouten för vertex bufferns innehåll.
:::
:::d3d12
Med input layouten (`D3D12_INPUT_ELEMENT_DESC`) och vertex buffer viewn kunde vi ange layouten för vertex bufferns
innehåll.
:::

I vertex buffern lade vi attributen *omväxlande* (interleaved); det vill säga, vi placerade varje vertex position och
texturkoordinater bredvid varandra i minnet. Nu när vi vet lite mer om buffrar kan vi välja ett annat sätt.

Vi kan också samla all vektordata i stora block per attributtyp i stället för att blanda dem. I stället för en
omväxlande layout 123123123123 väljer vi en blockvis (batched) layout 111122223333.

När du laddar vertexdata från en fil får du i allmänhet en array med positioner, en array med normaler och/eller en
array med texturkoordinater. Det kan kosta en del möda att slå ihop dem till en stor array med omväxlande data. Att
lägga dem blockvis är då en enklare lösning som vi lätt kan genomföra genom att lägga varje array i bufferten efter den
föregående.

:::opengl
Med `glBufferSubData` är det enkelt: ett anrop per array, vart och ett på den offset där den föregående slutar. Kubens
data får två arrayer, `cubePositions` (36 × 3 floats) och `cubeTexCoords` (36 × 2 floats), i stället för
`cubeVertices`:

```cpp
    glBufferData(GL_ARRAY_BUFFER, sizeof(cubePositions) + sizeof(cubeTexCoords), NULL, GL_STATIC_DRAW);
    glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(cubePositions), &cubePositions);                      // positions at the start
    glBufferSubData(GL_ARRAY_BUFFER, sizeof(cubePositions), sizeof(cubeTexCoords), &cubeTexCoords); // texture coordinates after them
```

På så sätt kan vi föra över attributarrayerna i sin helhet direkt till bufferten utan att först behöva bearbeta dem.
Vi kunde också ha slagit ihop dem till en stor array och fyllt bufferten direkt med `glBufferData`, men
`glBufferSubData` passar perfekt för sådana här uppgifter.

Vi måste också uppdatera vertexattributpekarna så att de speglar ändringarna:

```cpp
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);                     // tightly packed positions
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)(sizeof(cubePositions))); // the second block
```

Observera att stride-parametern är lika med vertexattributets storlek, eftersom nästa attributvektor finns direkt
efter dess 3 (eller 2) komponenter. Det sista argumentet, offseten, är nu där attributets block börjar i bufferten.
:::
:::vulkan
I Vulkan stegar en *binding* genom sin data med en enda stride. En omväxlande buffer behöver en binding (stride
`sizeof(Vertex)`, 20 byte) vars attribut ligger på olika offset *inom* en vertex. En blockvis buffer har två block med
två olika strides – 12 byte per position, 8 per texturkoordinat – så varje block behöver en egen binding. Båda
bindningarna kan läsa från samma `VkBuffer`; `vkCmdBindVertexBuffers` ger varje binding den offset där dess block
börjar – OpenGL:s `(void*)(sizeof(cubePositions))` i `glVertexAttribPointer`.

Gör nu uppgiften **batched-attributes**. I `createVertexBuffer()` delar du upp `vertices` i de två blocken, gör
bufferten `positionsSize + texCoordsSize` byte stor och kopierar varje block till sitt eget mappade intervall:

```cpp
        // batched: the positions of all the vertices first, then all their texture coordinates
        std::vector<glm::vec3> positions;
        std::vector<glm::vec2> texCoords;
        for (const Vertex& vertex : vertices) {
            positions.push_back(vertex.pos);
            texCoords.push_back(vertex.texCoord);
        }
        VkDeviceSize positionsSize = sizeof(positions[0]) * positions.size();
        VkDeviceSize texCoordsSize = sizeof(texCoords[0]) * texCoords.size();
```

```cpp
        void* data;
        vkMapMemory(device, vertexBufferMemory, 0, positionsSize, 0, &data);
            memcpy(data, positions.data(), (size_t) positionsSize);
        vkUnmapMemory(device, vertexBufferMemory);

        vkMapMemory(device, vertexBufferMemory, positionsSize, texCoordsSize, 0, &data);
            memcpy(data, texCoords.data(), (size_t) texCoordsSize);
        vkUnmapMemory(device, vertexBufferMemory);
```

Beskriv sedan de två bindningarna – `getBindingDescription()` blir `getBindingDescriptions()`:

```cpp
    static std::array<VkVertexInputBindingDescription, 2> getBindingDescriptions() {
        std::array<VkVertexInputBindingDescription, 2> bindingDescriptions{};

        bindingDescriptions[0].binding = 0;
        bindingDescriptions[0].stride = sizeof(glm::vec3);
        bindingDescriptions[0].inputRate = VK_VERTEX_INPUT_RATE_VERTEX;

        bindingDescriptions[1].binding = 1;
        bindingDescriptions[1].stride = sizeof(glm::vec2);
        bindingDescriptions[1].inputRate = VK_VERTEX_INPUT_RATE_VERTEX;

        return bindingDescriptions;
    }
```

Attribut 0 (positionen) läser binding 0, attribut 1 (texturkoordinaterna) binding 1, båda på offset 0 – en vertex 12
(eller 8) byte i sitt block innehåller inget annat än det attributet. `createPipeline()` skickar med båda bindningarna
(`vertexBindingDescriptionCount = static_cast<uint32_t>(bindingDescriptions.size())`,
`pVertexBindingDescriptions = bindingDescriptions.data()`). Till sist binder `recordCommandBuffer()` samma buffer två
gånger:

```cpp
        // the same buffer for both bindings: binding 0 reads from its start (the positions), binding 1 from the
        // texture coordinates block after the positions
        VkBuffer vertexBuffers[] = {vertexBuffer, vertexBuffer};
        VkDeviceSize offsets[] = {0, sizeof(glm::vec3) * vertices.size()};
        vkCmdBindVertexBuffers(commandBuffer, 0, 2, vertexBuffers, offsets);
```

Den andra offseten är 12 × 42 = 504 byte. Golvets ritanrop, `vkCmdDraw(commandBuffer, 6, 1, 36, 0)`, fungerar
fortfarande oförändrat: vertex 36 läses från byte 36 × 12 i binding 0 och byte 36 × 8 i binding 1 – varje binding
multiplicerar vertexindexet med sin egen stride.
:::
:::d3d12
I Direct3D 12 läser input assemblern varje *input slot* från en enda vertex buffer view med en enda stride. En
omväxlande buffer behöver en slot (stride `sizeof(Vertex)`, 20 byte) vars element ligger på olika byte-offset *inom*
en vertex. En blockvis buffer har två block med två olika strides – 12 byte per position, 8 per texturkoordinat – så
varje block behöver en egen slot, med en egen vy. Båda vyerna kan peka in i samma buffer; den andra börjar helt enkelt
där texturkoordinaterna börjar – OpenGL:s `(void*)(sizeof(cubePositions))` i `glVertexAttribPointer`.

Gör nu uppgiften **batched-attributes**. Kubens data blir två arrayer, `XMFLOAT3 cubePositions[]` och
`XMFLOAT2 cubeTexCoords[]` (36 var), och bufferten håller dem efter varandra:

```cpp
        const UINT vertexBufferSize = sizeof(cubePositions) + sizeof(cubeTexCoords);
```

```cpp
        // The two blocks one after the other: the positions at the start, the texture
        // coordinates right after them (learnopengl: two glBufferSubData calls).
        memcpy(pVertexDataBegin, cubePositions, sizeof(cubePositions));
        memcpy(pVertexDataBegin + sizeof(cubePositions), cubeTexCoords, sizeof(cubeTexCoords));
```

Input layouten läser `TEXCOORD` från input slot 1 – det fjärde värdet i dess element:

```cpp
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 1, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

och den enda vyn blir en array med två, `D3D12_VERTEX_BUFFER_VIEW m_vertexBufferViews[2]`:

```cpp
        m_vertexBufferViews[0].BufferLocation = m_vertexBuffer->GetGPUVirtualAddress();
        m_vertexBufferViews[0].StrideInBytes = sizeof(XMFLOAT3);
        m_vertexBufferViews[0].SizeInBytes = sizeof(cubePositions);
        m_vertexBufferViews[1].BufferLocation = m_vertexBuffer->GetGPUVirtualAddress() + sizeof(cubePositions);
        m_vertexBufferViews[1].StrideInBytes = sizeof(XMFLOAT2);
        m_vertexBufferViews[1].SizeInBytes = sizeof(cubeTexCoords);
```

`IASetVertexBuffers(0, 2, m_vertexBufferViews)` binder båda, till slot 0 och 1.

Input layouten är en del av PSO:t, så golvet – som ritas med samma PSO – måste också leverera sina texturkoordinater
genom slot 1. Dess vertexar förblir omväxlande, och det fungerar också: två vyer in i golvets buffer,
`m_floorVertexBufferViews[2]`, båda med stride `sizeof(Vertex)`; den andra börjar `sizeof(XMFLOAT3)` byte in, vid de
första texturkoordinaterna:

```cpp
        m_floorVertexBufferViews[0].BufferLocation = m_floorVertexBuffer->GetGPUVirtualAddress();
        m_floorVertexBufferViews[0].StrideInBytes = sizeof(Vertex);
        m_floorVertexBufferViews[0].SizeInBytes = planeVertexBufferSize;
        m_floorVertexBufferViews[1].BufferLocation = m_floorVertexBuffer->GetGPUVirtualAddress() + sizeof(XMFLOAT3);
        m_floorVertexBufferViews[1].StrideInBytes = sizeof(Vertex);
        m_floorVertexBufferViews[1].SizeInBytes = planeVertexBufferSize - sizeof(XMFLOAT3);
```

och dess ritanrop binder dem med `IASetVertexBuffers(0, 2, m_floorVertexBufferViews)`.
:::

Bygg och kör: marmorn på kuberna är exakt densamma. Vilket sätt är bäst? Inget av dem är fel i {{api}}; den omväxlande
layouten är fortfarande vanligast, eftersom vertexattributen för varje körning av vertex shadern då ligger tätt intill
varandra i minnet.

```quiz
Du lägger en kubs 36 positioner (3 floats var) och sedan dess 36 texturkoordinater (2 floats var) blockvis i en buffer. En float är 4 byte. På vilken byte börjar blocket med texturkoordinater?
- [ ] 12
- [ ] 20
- [x] 432
- [ ] 720
---
Positionerna kommer först: 36 × 3 × 4 = 432 byte. Texturkoordinaterna börjar direkt efter dem, och den offseten är vad det andra attributets pekare, binding eller vy behöver.
```

:::opengl
```quiz
Varför är stride för texturkoordinatattributet `2 * sizeof(float)` efter omläggningen till block, och inte `5 * sizeof(float)`?
- [x] I det andra blocket följer nästa vertex texturkoordinater direkt efter de nuvarande
- [ ] För att stride alltid är attributets egen storlek
- [ ] För att stride räknas från slutet av positionsblocket
- [ ] För att OpenGL ignorerar stride när offseten inte är 0
---
Stride är avståndet mellan en vertex attribut och nästa vertex. Omväxlande låg en position och texturkoordinater (5 floats) emellan; blockvis ligger texturkoordinaterna tätt packade, 2 floats isär.
```
:::
:::vulkan
```quiz
Varför behöver den blockvisa vertex buffern två vertex input-bindningar i stället för en?
- [ ] För att en `VkBuffer` bara kan bindas till en binding åt gången
- [x] För att en binding har en enda stride, och de två blocken behöver olika strides (12 och 8 byte)
- [ ] För att attribut på en annan offset än 0 inte är tillåtna
- [ ] För att vertex shadern bara kan läsa ett attribut per binding
---
Inom en binding ligger varje vertex `stride` byte efter den föregående. Positionerna ligger 12 byte isär och texturkoordinaterna 8, så varje block får en binding med egen stride – och egen offset från `vkCmdBindVertexBuffers`.
```
:::
:::d3d12
```quiz
Varför behöver den blockvisa kuben två input slots, var och en med en egen vertex buffer view?
- [ ] För att en buffer bara kan ha en vertex buffer view
- [ ] För att `TEXCOORD` alltid måste komma från slot 1
- [x] För att en vy har en enda stride, och de två blocken behöver olika strides (12 och 8 byte)
- [ ] För att `IASetVertexBuffers` bara kan binda en vy per anrop
---
I en slot ligger varje vertex `StrideInBytes` efter den föregående. Positionerna ligger 12 byte isär och texturkoordinaterna 8, så varje block får en egen vy (med egen startadress och stride) i en egen slot.
```
:::

## Copying buffers

När dina buffrar är fyllda med data kanske du vill dela den datan med andra buffrar, eller kopiera bufferns innehåll
till en annan buffer.

:::opengl
Funktionen `glCopyBufferSubData` låter oss kopiera data från en buffer till en annan förhållandevis enkelt.
Funktionens prototyp ser ut så här:

```cpp
void glCopyBufferSubData(GLenum readtarget, GLenum writetarget, GLintptr readoffset,
                         GLintptr writeoffset, GLsizeiptr size);
```

Parametrarna `readtarget` och `writetarget` anger de buffer targets vi vill kopiera från och till. Vi kan till exempel
kopiera från en `GL_ARRAY_BUFFER`-buffer till en `GL_ELEMENT_ARRAY_BUFFER`-buffer genom att ange de targets som läs-
respektive skriv-target. De buffrar som för tillfället är bundna till de targets påverkas då.

Men tänk om vi vill läsa och skriva data i två olika buffrar som båda är vertex array buffers? Vi kan inte binda två
buffrar samtidigt till samma buffer target. Av den anledningen, och bara den, ger OpenGL oss två buffer targets till,
`GL_COPY_READ_BUFFER` och `GL_COPY_WRITE_BUFFER`. Vi binder då de buffrar vi vill till de nya targets och anger dem som
argumenten `readtarget` och `writetarget`.

`glCopyBufferSubData` läser sedan data av en given storlek `size` från en given `readoffset` och skriver den in i
`writetarget`-bufferten på `writeoffset`. Kopieringen sker på GPU:n: datan kommer aldrig tillbaka till ditt programs
minne.

Gör nu den sista uppgiften, **copy-buffer**: kopiera golvets vertexar till en andra buffer, `planeCopyVBO`, och låt
golvets VAO läsa sina attribut från kopian:

```cpp
    // copy the vertices into a second buffer (GPU to GPU) and let the VAO read from the copy
    unsigned int planeCopyVBO;
    glGenBuffers(1, &planeCopyVBO);
    glBindBuffer(GL_COPY_WRITE_BUFFER, planeCopyVBO);
    glBufferData(GL_COPY_WRITE_BUFFER, sizeof(planeVertices), NULL, GL_STATIC_DRAW);
    glBindBuffer(GL_COPY_READ_BUFFER, planeVBO);
    glCopyBufferSubData(GL_COPY_READ_BUFFER, GL_COPY_WRITE_BUFFER, 0, 0, sizeof(planeVertices)); // read offset, write offset, size
    glBindBuffer(GL_ARRAY_BUFFER, planeCopyVBO); // the attribute pointers below take the buffer bound to GL_ARRAY_BUFFER
```

Den nya bufferten behöver först sitt minne (`glBufferData` med `NULL`), precis som före `glBufferSubData`. Och lägg
märke till den sista raden: `glVertexAttribPointer` sparar den buffer som är bunden till `GL_ARRAY_BUFFER` när anropet
görs, så när kopian binds där läser VAO:n från den. Vi kunde också ha bundit en av de två buffrarna till
`GL_ARRAY_BUFFER` och använt det som läs- eller skriv-target – vilka två olika targets som helst duger. Radera den nya
bufferten i slutet med `glDeleteBuffers(1, &planeCopyVBO);`.
:::
:::vulkan
Vulkans kopieringskommando är `vkCmdCopyBuffer(commandBuffer, srcBuffer, dstBuffer, regionCount, pRegions)`: varje
`VkBufferCopy`-region har en källoffset, en måloffset och en storlek – de tre talen i OpenGL:s `glCopyBufferSubData`.
Till skillnad från OpenGL finns det inga targets att binda: kommandot anger båda buffrarna direkt. Källan behöver
`VK_BUFFER_USAGE_TRANSFER_SRC_BIT`, målet `VK_BUFFER_USAGE_TRANSFER_DST_BIT`, och som alla kommandon spelas det in i en
command buffer och körs på GPU:n när den skickas in.

Det är precis verktyget för vulkan-tutorials kapitel *Staging buffer*. Vår vertex buffer ligger i host-visible minne,
som GPU:n kan läsa långsammare än device-local minne – men device-local minne kan oftast inte mappas. Så datan går via
en *staging buffer*: CPU:n skriver den till en host-visible buffer, och GPU:n kopierar den till den device-local vertex
buffern. Texturuppladdningen gör redan samma sak med `vkCmdCopyBufferToImage`.

Gör nu den sista uppgiften, **copy-buffer**. I `createVertexBuffer()` hamnar de två blocken nu i staging buffern, och
vertex buffern skapas i device-local minne som transfer destination:

```cpp
        VkDeviceSize bufferSize = positionsSize + texCoordsSize;

        // the staging buffer: memory the CPU can write (a transfer source)
        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);
```

De två blocken med `vkMapMemory` / `memcpy` / `vkUnmapMemory` från förra uppgiften blir kvar, nu på
`stagingBufferMemory`. Sedan:

```cpp
        // the vertex buffer: device-local memory, the fastest for the GPU to read (a transfer destination)
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, vertexBuffer, vertexBufferMemory);

        // the GPU copies the data from one buffer to the other (glCopyBufferSubData in OpenGL)
        copyBuffer(stagingBuffer, vertexBuffer, bufferSize);

        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
```

`copyBuffer` är vulkan-tutorials hjälpfunktion, skriven med projektets funktioner för engångs-command buffers:

```cpp
    // Copies size bytes from the start of one buffer to the start of another, with a one-time command buffer.
    void copyBuffer(VkBuffer srcBuffer, VkBuffer dstBuffer, VkDeviceSize size) {
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkBufferCopy copyRegion{};
        copyRegion.srcOffset = 0;
        copyRegion.dstOffset = 0;
        copyRegion.size = size;
        vkCmdCopyBuffer(commandBuffer, srcBuffer, dstBuffer, 1, &copyRegion);

        endSingleTimeCommands(commandBuffer);
    }
```

`endSingleTimeCommands` skickar in command buffern och väntar med `vkQueueWaitIdle` tills kön är tom, så kopieringen
är klar när `copyBuffer` returnerar – därför kan staging buffern förstöras direkt. Den handskrivna koden med
`vkCreateBuffer` / `vkAllocateMemory` för vertex buffern är borta: `createBuffer` sköter det.
:::
:::d3d12
Direct3D 12:s kopieringskommando är `CopyBufferRegion(pDstBuffer, DstOffset, pSrcBuffer, SrcOffset, NumBytes)` – målet
och dess offset, källan och dess offset, antalet byte: OpenGL:s `glCopyBufferSubData` med buffrarna angivna direkt i
stället för bundna till targets. (`CopyResource` kopierar en hel resurs.) Det spelas in i en command list och körs på
GPU:n när listen exekveras.

Gör nu uppgiften **copy-buffer**: kopiera golvets vertexar till en andra buffer, `m_floorCopyBuffer`, i en default
heap, och rita golvet från kopian:

```cpp
        CD3DX12_HEAP_PROPERTIES defaultHeapProperties(D3D12_HEAP_TYPE_DEFAULT);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &defaultHeapProperties,
            D3D12_HEAP_FLAG_NONE,
            &bufferDesc,
            D3D12_RESOURCE_STATE_COMMON,
            nullptr,
            IID_PPV_ARGS(&m_floorCopyBuffer)));

        // Recorded in the command list (it runs when the list is executed, at the end of
        // LoadAssets): the destination and its offset, the source and its offset, the bytes.
        m_commandList->CopyBufferRegion(m_floorCopyBuffer.Get(), 0, m_floorVertexBuffer.Get(), 0, planeVertexBufferSize);

        // After the copy the input assembler reads the buffer: a transition to the vertex buffer state.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_floorCopyBuffer.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_VERTEX_AND_CONSTANT_BUFFER);
        m_commandList->ResourceBarrier(1, &barrier);
```

Resurser i Direct3D 12 har *tillstånd* (states), och GPU:n måste veta när en resurs byter roll. Kopiebufferten skapas
i tillståndet `COMMON`; kopieringen *befordrar* (promotes) den själv till `COPY_DEST` (buffrar tillåts den här
implicita befordran), och barriären flyttar den sedan från `COPY_DEST` till `VERTEX_AND_CONSTANT_BUFFER`, så att input
assemblern läser den först efter att kopieringen har skrivit den. Källan, en buffer i en upload heap, stannar i
`GENERIC_READ`, som även innefattar att vara källa för en kopiering. Golvets två vyer pekar nu in i kopian
(`m_floorCopyBuffer->GetGPUVirtualAddress()`, och `+ sizeof(XMFLOAT3)` för den andra). `m_floorVertexBuffer` måste
finnas kvar: kopieringen läser den när command listen körs.

Att kopiera till en default heap är inte bara en övning. Kubens vertex buffer ligger fortfarande i en upload heap, med
exemplens kommentar ovanför: *"using upload heaps to transfer static data like vert buffers is not recommended. Every
time the GPU needs it, the upload heap will be marshalled over. Please read up on Default Heap usage."* Texturerna går
redan den rätta vägen – en upload buffer, sedan en kopiering till en textur i en default heap.

Gör nu den sista uppgiften, **default-heap**: skapa `m_vertexBuffer` i en default heap (`D3D12_HEAP_TYPE_DEFAULT`,
tillståndet `D3D12_RESOURCE_STATE_COMMON`), skriv de två blocken till en upload buffer `vertexBufferUploadHeap` i
stället (`Map`, de två `memcpy`, `Unmap`), och kopiera över den:

```cpp
        // Schedule the copy into the vertex buffer (the COMMON state is promoted to COPY_DEST
        // by the copy), then make it a vertex buffer.
        m_commandList->CopyBufferRegion(m_vertexBuffer.Get(), 0, vertexBufferUploadHeap.Get(), 0, vertexBufferSize);
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_vertexBuffer.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_VERTEX_AND_CONSTANT_BUFFER);
        m_commandList->ResourceBarrier(1, &barrier);
```

Deklarera `ComPtr<ID3D12Resource> vertexBufferUploadHeap;` *före* blocket `// Create the vertex buffer.`, som
texturernas upload heaps: kopieringen körs först när command listen exekveras i slutet av `LoadAssets`, som sedan
väntar på GPU:n – upload buffern måste finnas kvar då. Vyerna ändras inte; de pekar på `m_vertexBuffer`, som nu ligger
i en default heap.
:::

Bygg och kör: golvet och kuberna ritas exakt som förut – nu från kopierad data.

```quiz
Vad händer med datan vid en kopiering från buffer till buffer (`glCopyBufferSubData`, `vkCmdCopyBuffer`, `CopyBufferRegion`)?
- [ ] Drivrutinen läser tillbaka den till ditt programs minne och laddar upp den igen
- [ ] Bara en referens kopieras: båda buffrarna delar sedan samma minne
- [x] GPU:n kopierar byten från den ena bufferten till den andra; ditt program ser dem aldrig
- [ ] Kopieringen sker när nästa frame presenteras
---
En kopiering är GPU-arbete: byten går direkt från källintervallet till målintervallet. Det är därför den är sättet att fylla minne som CPU:n inte kan skriva, och att duplicera data utan en omväg via CPU:n.
```

:::opengl
```quiz
Varför har OpenGL de extra targets `GL_COPY_READ_BUFFER` och `GL_COPY_WRITE_BUFFER`?
- [ ] För att `glCopyBufferSubData` bara fungerar på buffrar som skapats för kopiering
- [ ] För att de gör kopieringen snabbare än med andra targets
- [ ] För att en buffer som är bunden till `GL_ARRAY_BUFFER` inte kan kopieras
- [x] För att bara en buffer kan vara bunden till ett target åt gången, så kopiering mellan två vertex buffers behöver två andra targets
---
`glCopyBufferSubData` anger targets, inte buffrar. Två vertex buffers kan inte båda vara bundna till `GL_ARRAY_BUFFER`, så OpenGL lägger till två targets som finns enbart av den anledningen.
```
:::
:::vulkan
```quiz
Varför går vertexdatan via en staging buffer i stället för att skrivas direkt till den device-local vertex buffern?
- [ ] För att `vkCmdCopyBuffer` är snabbare än `memcpy`
- [x] För att device-local minne oftast inte kan mappas, så CPU:n kan inte skriva i det
- [ ] För att en vertex buffer inte får skapas med `VK_BUFFER_USAGE_TRANSFER_DST_BIT`
- [ ] För att valideringslagren förbjuder `vkMapMemory` på vertex buffers
---
Device-local minne är snabbast för GPU:n att läsa, men det är oftast inte host-visible. CPU:n skriver till en host-visible staging buffer, och GPU:n kopierar därifrån.
```
:::
:::d3d12
```quiz
Varför deklareras `vertexBufferUploadHeap` före blocket med vertex buffern, och inte inuti det?
- [x] För att kopieringen körs först när command listen exekveras i slutet av `LoadAssets` – upload buffern måste finnas kvar då
- [ ] För att en buffer i en default heap bara kan kopieras från en medlemsvariabel
- [ ] För att `Map` misslyckas på en lokal `ComPtr`
- [ ] För att `CopyBufferRegion` kopierar datan direkt och sedan släpper källan
---
`CopyBufferRegion` spelar bara in kopieringen. Inuti blocket skulle `ComPtr` släppa upload buffern vid den avslutande klammern, långt innan GPU:n läser den. Deklarerad utanför lever den tills `LoadAssets` har väntat på GPU:n.
```
:::

Flera sätt att fylla och kopiera buffrar ger dig mer kontroll över hur din data kommer till GPU:n: reservera och fyll i
delar, skriv genom en pekare, lägg attributen blockvis när det passar din källdata, och kopiera data till minne som
CPU:n inte når. Du kommer att se de här teknikerna igen så fort data är för stor, för statisk eller för dynamisk för
den enkla uppladdningen med ett enda anrop.

## Additional resources

:::opengl
- [glBufferSubData](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBufferSubData.xhtml),
  [glMapBuffer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMapBuffer.xhtml) och
  [glCopyBufferSubData](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glCopyBufferSubData.xhtml):
  referenssidorna för kapitlets funktioner.
:::
:::vulkan
- [Staging buffer](https://vulkan-tutorial.com/Vertex_buffers/Staging_buffer): vulkan-tutorials kapitel om
  device-local vertex buffers och `vkCmdCopyBuffer`.
- [vkCmdUpdateBuffer](https://registry.khronos.org/vulkan/specs/latest/man/html/vkCmdUpdateBuffer.html):
  uppdateringskommandots gränser och regler.
:::
:::d3d12
- [ID3D12GraphicsCommandList::CopyBufferRegion](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-copybufferregion)
  och [ID3D12Resource::Map](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12resource-map):
  referenssidorna för kapitlets anrop.
- [Using resource barriers](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-resource-barriers-to-synchronize-resource-states-in-direct3d-12):
  resurstillstånd, inklusive implicit befordran av tillstånd.
:::
