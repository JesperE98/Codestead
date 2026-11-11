# Instancing

Säg att du har en scen där du ritar många modeller, och att de flesta av dem har samma vertexdata men olika
världstransformationer. Tänk dig en scen full av grässtrån: varje grässtrå är en liten modell av bara några få
trianglar. Du vill förmodligen rita ganska många av dem, och scenen kan sluta med tusentals eller kanske tiotusentals
grässtrån som ska renderas varje bildruta. Eftersom varje strå bara är några trianglar renderas det nästan
omedelbart. Men de tusentals ritanrop du måste göra sänker prestandan drastiskt.

Om vi faktiskt skulle rendera så många objekt skulle det se ut ungefär så här i koden:

:::opengl
```cpp
for(unsigned int i = 0; i < amount_of_models_to_draw; i++)
{
    DoSomePreparations(); // bind VAO, bind textures, set uniforms etc.
    glDrawArrays(GL_TRIANGLES, 0, amount_of_vertices);
}
```
:::
:::vulkan
```cpp
for (uint32_t i = 0; i < amountOfModelsToDraw; i++) {
    DoSomePreparations(); // bind buffers and descriptor sets, push the model matrix etc.
    vkCmdDraw(commandBuffer, amountOfVertices, 1, 0, 0);
}
```
:::
:::d3d12
```cpp
for (UINT i = 0; i < amountOfModelsToDraw; i++)
{
    DoSomePreparations(); // set vertex buffers, root constants, descriptor tables etc.
    m_commandList->DrawInstanced(amountOfVertices, 1, 0, 0);
}
```
:::

När du ritar många *instanser* av din modell så här når du snabbt en flaskhals på grund av alla ritanrop. Jämfört med
att rendera själva vertices är det ganska dyrt att be GPU:n rendera vertexdatan med ett ritanrop: CPU:n måste
förbereda och kontrollera det tillstånd som ritningen behöver – vilka buffrar som ska läsas, var vertexattributen
finns, vilka texturer och konstanter som gäller – och lämna över allt till GPU:n. Allt detta sker på CPU:n, en
ritning i taget. Så även om det går supersnabbt att rendera vertices går det inte lika fort att ge GPU:n kommandona
att rendera dem, och GPU:n får vänta på nästa.

:::vulkan
Vulkan konstruerades för att göra ritanrop mycket billigare än i OpenGL: det finns inget dolt tillstånd som
drivrutinen måste kontrollera vid varje ritning, och command buffers kan spelas in en gång och återanvändas. Men varje
`vkCmdDraw` är fortfarande ett kommando med egna bindningar och push constants, inspelat av CPU:n och behandlat ett i
taget av GPU:n – tusentals av dem blir mycket.
:::
:::d3d12
Direct3D 12 konstruerades för att göra ritanrop mycket billigare än i Direct3D 11: pipeline staten kompileras i
förväg, och det finns inget dolt tillstånd som drivrutinen måste kontrollera vid varje ritning. Men varje
`DrawInstanced` är fortfarande ett kommando med egna root-argument och vertexbuffrar, inspelat av CPU:n och behandlat
ett i taget av GPU:n – tusentals av dem blir mycket.
:::

Det vore mycket smidigare om vi kunde skicka data till GPU:n en gång och sedan be GPU:n rita flera objekt med den här
datan i ett enda ritanrop. Här kommer *instancing* in.

Instancing är en teknik där vi ritar många objekt (med samma meshdata) på en gång med ett enda renderanrop, och slipper
all kommunikation CPU → GPU för varje objekt. För att rendera med instancing behöver vi bara byta renderanropen
`glDrawArrays` och `glDrawElements` mot `glDrawArraysInstanced` respektive `glDrawElementsInstanced` – i OpenGL. De här
*instansierade* versionerna av de klassiska renderfunktionerna tar en extra parameter, *instance count*, som anger hur
många instanser vi vill rendera.

:::opengl
`glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100)` ritar samma 6 vertices 100 gånger. Vi skickar alltså all data som
behövs till GPU:n en gång och talar sedan om för GPU:n hur den ska rita alla instanserna med ett enda anrop. GPU:n
renderar sedan alla instanserna utan att hela tiden behöva kommunicera med CPU:n.
:::
:::vulkan
I Vulkan har du haft den här parametern hela tiden: `vkCmdDraw(commandBuffer, vertexCount, instanceCount,
firstVertex, firstInstance)` och `vkCmdDrawIndexed(commandBuffer, indexCount, instanceCount, firstIndex,
vertexOffset, firstInstance)`. Hittills har vi alltid gett 1 som antal instanser; `vkCmdDraw(commandBuffer, 6, 100, 0,
0)` ritar samma 6 vertices 100 gånger. Vi skickar alltså datan som behövs till GPU:n en gång och talar sedan om för
GPU:n hur den ska rita alla instanserna med ett enda kommando.
:::
:::d3d12
I Direct3D 12 har du haft den här parametern hela tiden – det är "Instanced" i `DrawInstanced(VertexCountPerInstance,
InstanceCount, StartVertexLocation, StartInstanceLocation)` och `DrawIndexedInstanced(IndexCountPerInstance,
InstanceCount, StartIndexLocation, BaseVertexLocation, StartInstanceLocation)`. Hittills har vi alltid gett 1 som antal
instanser; `DrawInstanced(6, 100, 0, 0)` ritar samma 6 vertices 100 gånger. Vi skickar alltså datan som behövs till
GPU:n en gång och talar sedan om för GPU:n hur den ska rita alla instanserna med ett enda kommando.
:::

Ensam är funktionen lite meningslös. Att rendera samma objekt tusen gånger hjälper oss inte, eftersom varje objekt
renderas exakt likadant och därmed också på samma plats; vi skulle bara se ett objekt! Därför ger shadern oss
ytterligare en inbyggd variabel i vertex shadern: numret på den instans som ritas.

:::opengl
GLSL:s `gl_InstanceID` är ett heltal som börjar på 0 för den första instansen i ett instansierat ritanrop och ökar för
varje instans som renderas. Om vi till exempel renderar den 43:e instansen har `gl_InstanceID` värdet 42 i vertex
shadern. Med ett unikt värde per instans kan vi nu till exempel indexera i en stor array med positioner för att placera
varje instans på en egen plats i världen.
:::
:::vulkan
Vulkans GLSL kallar den `gl_InstanceIndex` (OpenGL:s `gl_InstanceID`): ett heltal som börjar på 0 för den första
instansen – närmare bestämt på ritningens `firstInstance`, som är 0 för oss – och ökar för varje instans som renderas.
Om vi till exempel renderar den 43:e instansen har `gl_InstanceIndex` värdet 42 i vertex shadern. Med ett unikt värde
per instans kan vi nu till exempel indexera i en stor array med positioner för att placera varje instans på en egen
plats i världen.
:::
:::d3d12
HLSL ger den till vertex shadern som indata med systemvärdessemantiken `SV_InstanceID` (GLSL:s `gl_InstanceID`): en
`uint` som börjar på 0 för ritningens första instans och ökar för varje instans som renderas (den räknar inte med
`StartInstanceLocation`). Om vi till exempel renderar den 43:e instansen har den värdet 42 i vertex shadern. Med ett
unikt värde per instans kan vi nu till exempel indexera i en stor array med positioner för att placera varje instans
på en egen plats i världen.
:::

Tekniken är densamma i alla API:er; kapitlet visar den för {{api}}.

:::opengl
Projektet börjar med learnopengls första exempel före instancing: ingen kamera, inga matriser, rensningsfärgen (0.1,
0.1, 0.1) och en liten fyrhörning – learnopengls `quadVertices`, en 2D-position och en färg per vertex, ±0.05 – ritad
en gång i mitten med `glDrawArrays(GL_TRIANGLES, 0, 6)` av `instancing.vs` / `instancing.fs`. För asteroidfältet
innehåller projektet redan Model-kapitlets `mesh.h` och `model.h` – med `Mesh::VAO`, `Mesh::indices`, `Model::meshes`
och `Model::textures_loaded` publika, som learnopengls asteroiddemo behöver – planeten och kursens sten
(`models/rock.obj`, `rock.mtl`, `rock.png`), och shadrarna `planet.vs/.fs` och `asteroids.vs/.fs`.
:::
:::vulkan
Projektet börjar med learnopengls första exempel före instancing: ingen kamera, inga matriser, rensningsfärgen (0.1,
0.1, 0.1) och en liten fyrhörning – learnopengls `quadVertices` (`struct QuadVertex { glm::vec2 pos; glm::vec3 color;
}`, ±0.05, i en egen vertexbuffer `quadVertexBuffer`) – ritad en gång i mitten med `vkCmdDraw(commandBuffer, 6, 1, 0,
0)` av `shaders/instancing.vert` / `.frag`. Vulkans y-axel pekar nedåt, så fyrhörningens y-värden är negerade och
bilden blir learnopengls (rött hörn uppe till vänster). `createPipeline(vertFile, fragFile, bindingDescriptions,
attributeDescriptions, pipeline)` tar vertexindatan som parametrar – en *vector* av bindings, eftersom instancing lägger
till en andra. För asteroidfältet skapar starten redan (men använder ännu inte) Model-kapitlets kod för två modeller:
`loadModel(path, vertices, indices)` för planeten och kursens sten, deras vertex- och indexbuffrar, tre texturer,
uniform buffern (`view`, `proj`) och två descriptor sets, `planetDescriptorSet` och `rockDescriptorSet`.
:::
:::d3d12
Projektet börjar med learnopengls första exempel före instancing: ingen kamera, inga matriser, rensningsfärgen (0.1,
0.1, 0.1) och en liten fyrhörning – learnopengls `quadVertices` (`struct QuadVertex { XMFLOAT2 position; XMFLOAT3
color; }`, ±0.05, 6 vertices) – ritad en gång i mitten med `DrawInstanced(6, 1, 0, 0)` av `instancing.hlsl`. För
asteroidfältet innehåller projektet redan Model-kapitlets klass `Model` – med varje meshs `vertexBufferView`,
`indexBufferView` och `srvHandle` publika, som learnopengl gör meshens VAO publik för sin asteroiddemo – planeten,
kursens sten (`models/rock.obj`, `rock.mtl`, `rock.png`), root signaturen med root constants (b0), CBV-tabellen (b1)
och en texturtabell, och shadrarna `planet.hlsl` och `asteroids.hlsl`.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift bygger och kör du programmet i din
IDE. Just nu visar den en liten fyrhörning mitt i fönstret, färgad från hörnen: rött, grönt, blått och cyan.

## Instancing

För att få en känsla för instansierad ritning visar vi ett enkelt exempel som renderar hundra 2D-fyrhörningar i
normaliserade enhetskoordinater med ett enda renderanrop. Det gör vi genom att placera varje instans av fyrhörningen
för sig med hjälp av ett index i en uniform-array med 100 förskjutningsvektorer. Resultatet är ett prydligt rutnät av
fyrhörningar som fyller hela fönstret.

Varje fyrhörning består av 2 trianglar med sammanlagt 6 vertices. Varje vertex har en 2D-position i NDC och en
färgvektor – fyrhörningen du ser nu. Vertex shadern lägger till en förskjutning till varje position; förskjutningen
väljs ur en array med instansnumret.

Vi definierar förskjutningarna i en nästlad for-loop innan vi går in i renderloopen: vi skapar sammanlagt 100
translationsvektorer, en för varje position i ett rutnät på 10x10. Loopen låter y gå från -10 och uppåt och x från -10
åt höger, i steg om 2, och delar med 10: fyrhörningarnas mittpunkter ligger på -0.9, -0.7, … 0.9 i båda riktningarna.
Instans 0 är alltså fyrhörningen nere till vänster, instans 9 den nere till höger och instans 99 den uppe till höger.

:::opengl
Gör nu den första uppgiften, **offsets**. I `instancing.vs`, lägg till uniform-arrayen och använd instansens element:

```glsl
uniform vec2 offsets[100];
```

```glsl
void main()
{
    vec2 offset = offsets[gl_InstanceID]; // gl_InstanceID: 0 for the first instance, 1 for the second ...
    fColor = aColor;
    gl_Position = vec4(aPos + offset, 0.0, 1.0);
}
```

I `main.cpp`, vid TODO:n, skapa förskjutningarna och lämna dem till shadern:

```cpp
    // generate a list of 100 quad locations/translation-vectors
    // ---------------------------------------------------------
    glm::vec2 translations[100];
    int index = 0;
    float offset = 0.1f;
    for (int y = -10; y < 10; y += 2)
    {
        for (int x = -10; x < 10; x += 2)
        {
            glm::vec2 translation;
            translation.x = (float)x / 10.0f + offset;
            translation.y = (float)y / 10.0f + offset;
            translations[index++] = translation;
        }
    }

    // hand the offsets to the shader: one uniform per array element, offsets[0] .. offsets[99]
    shader.use();
    for (unsigned int i = 0; i < 100; i++)
    {
        shader.setVec2("offsets[" + std::to_string(i) + "]", translations[i]);
    }
```

I den här koden gör vi om loopräknaren `i` till en `string` för att dynamiskt bygga namnet som uniformens plats söks
med. För varje element i uniform-arrayen offsets sätter vi sedan motsvarande translationsvektor.

Nu när alla förberedelser är klara kan vi börja rendera fyrhörningarna. För att rita med instansierad rendering
anropar vi `glDrawArraysInstanced` i stället för `glDrawArrays`:

```cpp
        glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100); // 100 quads of 6 vertices each
```
:::
:::vulkan
Gör nu den första uppgiften, **offsets**. Vulkan har inga enskilda uniforms, så arrayen hamnar i uniform buffern,
efter `proj`. Här spelar uniform-blockets minneslayout roll (std140, som i kapitlet *Advanced GLSL*): **varje element
i en array i ett uniform-block tar 16 byte**, så en `vec2`-array skulle ändå fyllas ut till `vec4`-platser. Vi gör det
uttryckligt och använder `vec4`-element, av vilka shadern läser `.xy`. I `main.cpp`:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    // std140: every element of an array in a uniform block takes 16 bytes - a vec2 would be padded to a vec4 anyway
    glm::vec4 offsets[100];
};
```

`updateUniformBuffer()` skapar förskjutningarna (view och projektion förblir tomma tills uppgiften `planet`):

```cpp
        // a list of 100 quad locations/translation-vectors: a 10x10 grid
        int index = 0;
        float offset = 0.1f;
        for (int y = -10; y < 10; y += 2) {
            for (int x = -10; x < 10; x += 2) {
                glm::vec2 translation;
                translation.x = (float)x / 10.0f + offset;
                translation.y = -((float)y / 10.0f + offset); // learnopengl's rows go up from the bottom; Vulkan's y points down
                ubo.offsets[index++] = glm::vec4(translation, 0.0f, 0.0f);
            }
        }
```

y-värdet negeras som fyrhörningens vertices, så att instans 0 är fyrhörningen nere till vänster som hos learnopengl. I
`shaders/instancing.vert`, deklarera blocket och använd instansens element:

```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec4 offsets[100]; // x, y: the offset (z, w unused)
} ubo;

void main() {
    vec2 offset = ubo.offsets[gl_InstanceIndex].xy; // gl_InstanceIndex: 0 for the first instance, 1 for the second ...
    fragColor = inColor;
    gl_Position = vec4(inPosition + offset, 0.0, 1.0);
}
```

I `recordCommandBuffer()` behöver fyrhörningen nu uniform buffern bunden – båda projektets descriptor sets innehåller
den, och fyrhörningarna läser inget annat, så `planetDescriptorSet` duger – och ritningen får sitt antal instanser:

```cpp
        // the offsets are in the uniform buffer (both descriptor sets have it; the quads read nothing else)
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &planetDescriptorSet, 0, nullptr);

        vkCmdDraw(commandBuffer, 6, 100, 0, 0); // 100 instances of the quad's 6 vertices
```
:::
:::d3d12
Gör nu den första uppgiften, **offsets**. Direct3D 12 har inga enskilda uniforms, så arrayen hamnar i en egen constant
buffer. Här spelar HLSL:s packningsregler roll (som i kapitlet *Advanced GLSL*): **varje element i en array i en
cbuffer börjar ett nytt 16-byte-register**, så en `float2`-array skulle ändå fyllas ut till `float4`-platser. Vi gör
det uttryckligt och använder `float4`-element, av vilka shadern läser `.xy`. I `instancing.hlsl`:

```hlsl
cbuffer OffsetConstantBuffer : register(b2)
{
    float4 offsets[100];
};
```

```hlsl
PSInput VSMain(float2 position : POSITION, float3 color : COLOR, uint instanceID : SV_InstanceID)
{
    PSInput result;

    float2 offset = offsets[instanceID].xy;    // SV_InstanceID: 0 for the first instance, 1 for the second ...
    result.color = color;
    result.position = float4(position + offset, 0.0f, 1.0f);
```

I `main.cpp` hamnar motsvarande C++-struktur bredvid de andra constant buffer-strukturerna, med en medlem
`ComPtr<ID3D12Resource> m_offsetBuffer;`:

```cpp
    struct OffsetConstantBuffer
    {
        XMFLOAT4 offsets[100];
    };
```

Förskjutningarna ändras aldrig, så buffern behöver ingen descriptor i heapen: vi binder den som en *root constant
buffer view* – en root descriptor, som sätts direkt med bufferns GPU-adress. Root signaturen får en fjärde parameter,
register b2 för vertex shadern:

```cpp
        CD3DX12_ROOT_PARAMETER rootParameters[4];
```

```cpp
        rootParameters[3].InitAsConstantBufferView(2, 0, D3D12_SHADER_VISIBILITY_VERTEX);
```

I `LoadAssets`, vid TODO:n, skapa förskjutningarna och skriv dem i buffern en gång:

```cpp
    XMFLOAT2 translations[100];
    int index = 0;
    float offset = 0.1f;
    for (int y = -10; y < 10; y += 2)
    {
        for (int x = -10; x < 10; x += 2)
        {
            XMFLOAT2 translation;
            translation.x = static_cast<float>(x) / 10.0f + offset;
            translation.y = static_cast<float>(y) / 10.0f + offset;
            translations[index++] = translation;
        }
    }

    // Create the offsets' constant buffer and write the offsets into it, once.
    {
        // HLSL gives every element of an array in a cbuffer its own 16-byte register: an
        // offset (2 floats) takes the room of 4, so the C++ array is one of XMFLOAT4.
        OffsetConstantBuffer offsetData = {};
        for (UINT i = 0; i < 100; i++)
        {
            offsetData.offsets[i] = XMFLOAT4(translations[i].x, translations[i].y, 0.0f, 0.0f);
        }

        const UINT offsetBufferSize = CalculateConstantBufferByteSize(sizeof(OffsetConstantBuffer));    // CB size is required to be 256-byte aligned.
```

följt av en buffer `m_offsetBuffer` av den storleken i en upload heap, `Map`, `memcpy(pOffsetDataBegin, &offsetData,
sizeof(offsetData))` och `Unmap` – som vertexbuffern i Hello Triangle. I `PopulateCommandList` pekar root-parametern på
buffern, och ritningen får sitt antal instanser:

```cpp
    m_commandList->SetGraphicsRootConstantBufferView(3, m_offsetBuffer->GetGPUVirtualAddress());
```

```cpp
    m_commandList->DrawInstanced(6, 100, 0, 0);    // 100 quads of 6 vertices each
```
:::

Bygg och kör: ett rutnät på 10x10 av den lilla fyrhörningen fyller fönstret – hundra fyrhörningar, ritade med ett enda
ritanrop.

```quiz
Looparna låter y gå från -10 och uppåt och, inuti, x från -10 åt höger. Vilket instansnummer har fyrhörningen i fönstrets övre högra hörn?
- [ ] 0
- [ ] 9
- [ ] 90
- [x] 99
---
Instans 0 är fyrhörningen nere till vänster, den första raden (längst ned) har instanserna 0 till 9 från vänster till höger, och den sista raden (överst) 90 till 99 – så fyrhörningen uppe till höger är den sista, 99.
```

## Instansierade arrayer

Den förra lösningen fungerar bra för just det här fallet, men när vi renderar många fler än 100 instanser (vilket är
ganska vanligt) slår vi till slut i en gräns för hur mycket uniform-data vi kan skicka till shadrarna. Ett alternativ
kallas *instanced arrays*, instansierade arrayer. En instansierad array definieras som ett vertexattribut (vilket låter
oss lagra mycket mer data) som uppdateras per instans i stället för per vertex.

Med vertexattribut hämtar GPU:n i början av varje körning av vertex shadern nästa uppsättning vertexattribut som hör
till den aktuella vertexen. När ett vertexattribut definieras som en instansierad array uppdaterar vertex shadern
däremot attributets innehåll bara per instans. Det låter oss använda vanliga vertexattribut för data per vertex och
den instansierade arrayen för data som är unik per instans.

Som exempel på en instansierad array gör vi om förra exemplets uniform-array med förskjutningar till en instansierad
array. Vertex shadern får ytterligare ett vertexattribut; vi använder inte längre instansnumret i shadern – attributet
*är* instansens förskjutning.

:::opengl
Gör nu uppgiften **instanced-array**. I `instancing.vs` blir uniform-arrayen ett attribut:

```glsl
layout (location = 2) in vec2 aOffset; // an instanced array: a new value for every instance
```

```glsl
void main()
{
    fColor = aColor;
    gl_Position = vec4(aPos + aOffset, 0.0, 1.0);
}
```

Eftersom en instansierad array är ett vertexattribut, precis som positionen och färgen, måste vi lagra innehållet i
ett vertex buffer object och konfigurera dess attributpekare. Först lagrar vi arrayen `translations` (från förra
avsnittet) i ett nytt buffer object, i stället för loopen med anrop till `setVec2`:

```cpp
    // store instance data in an array buffer
    // --------------------------------------
    unsigned int instanceVBO;
    glGenBuffers(1, &instanceVBO);
    glBindBuffer(GL_ARRAY_BUFFER, instanceVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(glm::vec2) * 100, &translations[0], GL_STATIC_DRAW);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
```

Sedan måste vi också sätta dess attributpekare och slå på attributet, medan `quadVAO` är bunden, efter attribut 1:

```cpp
    // also set instance data
    glEnableVertexAttribArray(2);
    glBindBuffer(GL_ARRAY_BUFFER, instanceVBO); // this attribute comes from a different vertex buffer
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glVertexAttribDivisor(2, 1); // tell OpenGL this is an instanced vertex attribute.
```

Det intressanta i koden är sista raden, där vi anropar `glVertexAttribDivisor`. Funktionen talar om för OpenGL *när*
ett vertexattributs innehåll ska stega fram till nästa element. Den första parametern är attributet i fråga och den
andra *attributdivisorn*. Som standard är divisorn 0, vilket säger åt OpenGL att uppdatera attributets innehåll för
varje körning av vertex shadern. Med värdet 1 säger vi att innehållet ska uppdateras när vi börjar rendera en ny
instans. Med 2 skulle innehållet uppdateras var annan instans, och så vidare. Med divisorn 1 säger vi alltså i praktiken
att vertexattributet på plats 2 är en instansierad array.

Ritanropet förblir `glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100);`. Ta också bort `instanceVBO` i slutet
(`glDeleteBuffers(1, &instanceVBO);`).
:::
:::vulkan
Gör nu uppgiften **instanced-array**. I `shaders/instancing.vert` försvinner uniform-blocket, och förskjutningen blir
ett attribut:

```glsl
layout(location = 2) in vec2 inOffset; // an instanced array: a new value for every instance
```

```glsl
void main() {
    fragColor = inColor;
    gl_Position = vec4(inPosition + inOffset, 0.0, 1.0);
}
```

Eftersom en instansierad array är ett vertexattribut, precis som positionen och färgen, hamnar innehållet i en
vertexbuffer – en andra, bredvid fyrhörningens. I Vulkan beskriver en *binding* en vertexbuffer: dess stride och dess
*input rate*. Hittills har varje binding haft `VK_VERTEX_INPUT_RATE_VERTEX`: nästa element för varje vertex.
Instansbuffern får `VK_VERTEX_INPUT_RATE_INSTANCE`: nästa element för varje instans.
`QuadVertex::getBindingDescriptions()` returnerar nu två bindings:

```cpp
        std::vector<VkVertexInputBindingDescription> bindingDescriptions(2);

        bindingDescriptions[0].binding = 0;
        bindingDescriptions[0].stride = sizeof(QuadVertex);
        bindingDescriptions[0].inputRate = VK_VERTEX_INPUT_RATE_VERTEX;

        // binding 1: an instanced array - the next glm::vec2 offset for every instance, not every vertex
        bindingDescriptions[1].binding = 1;
        bindingDescriptions[1].stride = sizeof(glm::vec2);
        bindingDescriptions[1].inputRate = VK_VERTEX_INPUT_RATE_INSTANCE;
```

och `getAttributeDescriptions()` ett tredje attribut, `attributeDescriptions(3)`, som läses från binding 1:

```cpp
        // the instance's offset: location 2, from binding 1
        attributeDescriptions[2].binding = 1;
        attributeDescriptions[2].location = 2;
        attributeDescriptions[2].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[2].offset = 0;
```

Det här är OpenGL:s `glVertexAttribDivisor(2, 1)` i Vulkan-form. (OpenGL:s divisor kan också vara 2 eller mer – ett
nytt värde varannan instans och så vidare; Vulkans kärna har bara "per vertex" och "per instans", större divisorer
kräver tillägget `VK_KHR_vertex_attribute_divisor`.)

Förskjutningarna lämnar uniform buffern: ta bort `offsets[100]` ur `UniformBufferObject` och loopen ur
`updateUniformBuffer()`. I stället fyller en ny funktion en vertexbuffer med dem, en gång. Lägg till medlemmarna
`VkBuffer instanceBuffer; VkDeviceMemory instanceBufferMemory;` (förstörda i `cleanup()`), och anropa
`createInstanceBuffer()` efter att fyrhörningens vertexbuffer skapats:

```cpp
    // The instance data in a vertex buffer of its own: learnopengl's 100 translations, one glm::vec2 per quad.
    void createInstanceBuffer() {
        glm::vec2 translations[100];
        int index = 0;
        float offset = 0.1f;
        for (int y = -10; y < 10; y += 2) {
            for (int x = -10; x < 10; x += 2) {
                glm::vec2 translation;
                translation.x = (float)x / 10.0f + offset;
                translation.y = -((float)y / 10.0f + offset); // learnopengl's rows go up from the bottom; Vulkan's y points down
                translations[index++] = translation;
            }
        }

        createVertexBuffer(&translations[0], sizeof(glm::vec2) * 100, instanceBuffer, instanceBufferMemory);
    }
```

Vid ritningen binds båda vertexbuffrarna, till binding 0 och 1; descriptor seten behövs inte längre för fyrhörningarna:

```cpp
        // draw 100 instanced quads: binding 0 the quad's vertices, binding 1 the instance data
        VkBuffer vertexBuffers[] = {quadVertexBuffer, instanceBuffer};
        VkDeviceSize offsets[] = {0, 0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 2, vertexBuffers, offsets);
```

Ritningen förblir `vkCmdDraw(commandBuffer, 6, 100, 0, 0);`.
:::
:::d3d12
Gör nu uppgiften **instanced-array**. I `instancing.hlsl` försvinner cbuffern, och förskjutningen blir indata till
vertex shadern – med en egen semantik, `OFFSET`:

```hlsl
// offset: an instanced input - a new value for every instance (input slot 1).
PSInput VSMain(float2 position : POSITION, float3 color : COLOR, float2 offset : OFFSET)
{
    PSInput result;

    result.color = color;
    result.position = float4(position + offset, 0.0f, 1.0f);
```

Eftersom en instansierad array är vertexindata, precis som positionen och färgen, hamnar innehållet i en vertexbuffer
– en andra, bunden till input slot 1 bredvid fyrhörningens i slot 0. Input layouten beskriver var varje indata kommer
ifrån: det nya elementet läser `OFFSET` från slot 1, och dess klassificering säger att det stegar fram en gång per
instans i stället för en gång per vertex:

```cpp
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "COLOR", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 8, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "OFFSET", 0, DXGI_FORMAT_R32G32_FLOAT, 1, 0, D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA, 1 }
        };
```

Den sista medlemmen, `InstanceDataStepRate`, är OpenGL:s attributdivisor: 1 betyder ett nytt värde för varje instans,
2 ett nytt värde varannan instans och så vidare (data per vertex måste ha 0). `PER_INSTANCE_DATA` med steghastighet 1
är `glVertexAttribDivisor(2, 1)`.

Förskjutningarnas constant buffer försvinner: ta bort `OffsetConstantBuffer`, `m_offsetBuffer`, root-parameter 3
(tillbaka till `CD3DX12_ROOT_PARAMETER rootParameters[3];`) och `SetGraphicsRootConstantBufferView`. Lägg i stället
till medlemmarna `ComPtr<ID3D12Resource> m_instanceBuffer;` och `D3D12_VERTEX_BUFFER_VIEW m_instanceBufferView = {};`,
och lagra efter loopen med `translations` förskjutningarna i en vertexbuffer: en buffer på `sizeof(translations)` byte
i en upload heap, `Map`, `memcpy(pInstanceDataBegin, translations, sizeof(translations))`, `Unmap` och dess vy:

```cpp
        // The view: one offset (an XMFLOAT2) per instance.
        m_instanceBufferView.BufferLocation = m_instanceBuffer->GetGPUVirtualAddress();
        m_instanceBufferView.StrideInBytes = sizeof(XMFLOAT2);
        m_instanceBufferView.SizeInBytes = instanceBufferSize;
```

Vid ritningen sätts båda vertexbuffrarna, var och en till sin slot:

```cpp
    m_commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);
    m_commandList->IASetVertexBuffers(1, 1, &m_instanceBufferView);
```

Ritningen förblir `DrawInstanced(6, 100, 0, 0)`.
:::

Bygg och kör: ingenting ändras – samma rutnät, pixel för pixel. Men nu kommer förskjutningarna från en vertexbuffer, som
kan rymma många fler instanser än en uniform-array.

```quiz
Varför byter learnopengl ut uniform-arrayen med förskjutningar mot en instansierad array?
- [ ] En instansierad array ritas med färre ritanrop
- [x] Mängden uniform-data en shader kan läsa är begränsad; en vertexbuffer kan rymma data för långt fler instanser
- [ ] En uniform-array kan inte indexeras med instansnumret
- [ ] Vertex shadern körs färre gånger med en instansierad array
---
Båda versionerna använder ett ritanrop och kör vertex shadern 600 gånger. Skillnaden är var datan per instans ligger: uniforms är små (OpenGL garanterar bara 1024 komponenter uniforms i standardblocket för en vertex shader och 16 KB per uniform-block, Direct3D 64 KB per constant buffer), vertexbuffrar kan vara så stora som minnet tillåter.
```

:::opengl
```quiz
Vad säger `glVertexAttribDivisor(2, 1)` till OpenGL?
- [x] Attribut 2 stegar fram till nästa element en gång per instans, inte en gång per vertex
- [ ] Attribut 2 läses från vartannat element i buffern
- [ ] Attribut 2 delas med 1 innan vertex shadern läser det
- [ ] Bara den första instansen läser attribut 2
---
Divisorn säger hur många instanser som delar ett element: 0 (standard) betyder ett nytt element för varje vertex, 1 ett nytt element för varje instans, 2 ett för varannan instans.
```
:::
:::vulkan
```quiz
Vilken inställning gör att vertex shaderns `inOffset` får ett nytt värde för varje instans i stället för varje vertex?
- [ ] `vkCmdDraw` med antalet instanser 100
- [ ] Attributets `location = 2`
- [x] `inputRate = VK_VERTEX_INPUT_RATE_INSTANCE` på den vertex binding som attributet läser från
- [ ] Attributets format `VK_FORMAT_R32G32_SFLOAT`
---
Input rate hör till bindingen – vertexbuffern – och varje attribut som läses från binding 1 stegar fram en gång per instans. Det är OpenGL:s `glVertexAttribDivisor(2, 1)`.
```
:::
:::d3d12
```quiz
Vilken del av indataelementet `OFFSET` gör att det får ett nytt värde för varje instans i stället för varje vertex?
- [ ] Input slot 1
- [x] `D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA` med `InstanceDataStepRate` 1
- [ ] Semantiknamnet `OFFSET`
- [ ] Formatet `DXGI_FORMAT_R32G32_FLOAT`
---
Klassificeringen och steghastigheten är OpenGL:s attributdivisor: data per instans med steghastighet 1 stegar fram en gång per instans. Slotten säger bara vilken vertexbuffer elementet läses från.
```
:::

För skojs skull kan vi skala ned varje fyrhörning gradvis från uppe till höger till nere till vänster, med hjälp av
instansnumret igen – varför inte?

:::opengl
Gör nu uppgiften **scale-quads**. I `instancing.vs`:

```glsl
    vec2 pos = aPos * (gl_InstanceID / 100.0); // the quads grow from the first instance (bottom-left) to the last (top-right)
    fColor = aColor;
    gl_Position = vec4(pos + aOffset, 0.0, 1.0);
```
:::
:::vulkan
Gör nu uppgiften **scale-quads**. I `shaders/instancing.vert`:

```glsl
    vec2 pos = inPosition * (gl_InstanceIndex / 100.0); // the quads grow from the first instance (bottom-left) to the last (top-right)
    fragColor = inColor;
    gl_Position = vec4(pos + inOffset, 0.0, 1.0);
```
:::
:::d3d12
Gör nu uppgiften **scale-quads**. I `instancing.hlsl` får `VSMain` instansnumret igen,
`uint instanceID : SV_InstanceID`, efter `offset`:

```hlsl
PSInput VSMain(float2 position : POSITION, float3 color : COLOR, float2 offset : OFFSET, uint instanceID : SV_InstanceID)
{
    PSInput result;

    float2 pos = position * (instanceID / 100.0f);    // the quads grow from the first instance (bottom-left) to the last (top-right)
    result.color = color;
    result.position = float4(pos + offset, 0.0f, 1.0f);
```
:::

Bygg och kör. Resultatet är att de första instanserna ritas extremt små, och ju längre fram i ritningen vi kommer, desto
närmare 100 hamnar instansnumret och desto mer får fyrhörningarna tillbaka sin ursprungliga storlek: fyrhörningen uppe
till höger har full storlek, fyrhörningarna krymper rad för rad nedåt, och den nere till vänster – instans 0 – har
försvunnit helt. Det är helt tillåtet att använda instansierade arrayer tillsammans med instansnumret på det här sättet.

```quiz
Vad skulle hända i uppgiften **scale-quads** om du delade instansnumret med `100` i stället för `100.0`?
- [ ] Ingenting: resultatet görs ändå om till ett flyttal
- [ ] Fyrhörningarna skulle bli tio gånger större
- [x] Det skulle bli en heltalsdivision, 0 för varje instans från 0 till 99 – varje fyrhörning skulle få storleken 0 och försvinna
- [ ] Shadern skulle inte gå att kompilera
---
Ett heltal delat med ett heltal är en heltalsdivision: 42 / 100 är 0. Bara med en flyttalsoperand (100.0) blir resultatet 0.42, ett bråktal som växer från instans till instans.
```

## Ett asteroidfält

Tänk dig en scen med en stor planet i mitten av en stor asteroidring. En sådan asteroidring kan innehålla tusentals
eller tiotusentals stenformationer och blir snabbt omöjlig att rendera på ett vanligt grafikkort. Det här fallet passar
särskilt bra för instansierad rendering, eftersom alla asteroiderna kan representeras av en enda modell. Varje
asteroid får sedan sin variation från en transformationsmatris som är unik för just den.

För att visa vad instansierad rendering gör ritar learnopengl först en scen med asteroider som svävar runt en planet
*utan* instansierad rendering. Scenen innehåller en stor planetmodell och en stor mängd stenar som vi placerar runt
planeten. Planetmodellen är den från kapitlet *Model*, och stenen är kursens egen `rock.obj` med texturen `rock.png`.

För att få effekten vi är ute efter skapar vi en transformationsmatris för varje asteroid. Matrisen flyttar först
stenen någonstans i asteroidringen – sedan lägger vi till en liten slumpmässig förskjutning för att ringen ska se mer
naturlig ut. Därefter lägger vi också på en slumpmässig skalning och en slumpmässig rotation. Resultatet är en
transformationsmatris som placerar varje asteroid någonstans runt planeten och samtidigt ger den ett mer naturligt och
unikt utseende jämfört med de andra.

learnopengl ritar först varje sten med ett eget ritanrop – `rock.Draw(shader)` i en loop, med stenens modellmatris som
uniform före varje anrop – och visar hur bildfrekvensen sjunker när antalet stenar växer: från ett par tusen stenar och
uppåt flyter scenen inte längre, trots att varje sten är en liten modell. Sedan ritar den samma stenar instansierat,
och precis samma dator klarar 100 000 stenar (i en ring med radien 150) med lätthet. En riktig GPU ritar ett sådant
fält med instancing på en bråkdel av en bildruta.

Vår version är mindre: 500 stenar i en ring med radien 15. Kursen ritar sina kontroller och förväntade resultat på
CPU:n, så den håller fältet litet – den kan inte visa vad instancing vinner på en riktig GPU – men koden är exakt den
som skulle rita 100 000 stenar: ändra `amount` och radien, ingenting annat. Och i stället för att seeda slumptalen med
tiden, som learnopengl gör, använder vi `srand(42)`: samma fält varje körning, så att du kan jämföra din bild med den
förväntade. (Bara samma C-bibliotek ger samma talföljd: på en annan plattform ger `rand()` ett annat fält.)

Först planeten ensam.

:::opengl
Gör nu uppgiften **planet**. Ersätt fyrhörningarna med planeten: kamerans globala variabler efter `SCR_HEIGHT` – långt
bort, så att hela fältet får plats i fönstret:

```cpp
// camera: far away (z = 55) so the whole asteroid field fits in the window
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f, 55.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

I stället för `shader`, förskjutningarna, `instanceVBO` och fyrhörningens data, VAO och VBO (och städningen av dem)
får planeten sin shader och laddas:

```cpp
    Shader planetShader("planet.vs", "planet.fs");

    // load models
    // -----------
    // (aiProcess_FlipUVs in model.h turns the texture coordinates the right way up: no stbi_set_flip_vertically_on_load)
    Model planet("models/planet.obj");
```

I renderloopen ritas planeten under mitten, skalad med 4:

```cpp
        // configure transformation matrices
        glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 1000.0f); // far plane 1000: the field is large
        glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        planetShader.use();
        planetShader.setMat4("projection", projection);
        planetShader.setMat4("view", view);

        // draw planet
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, -3.0f, 0.0f));
        model = glm::scale(model, glm::vec3(4.0f, 4.0f, 4.0f));
        planetShader.setMat4("model", model);
        planet.Draw(planetShader);
```
:::
:::vulkan
Gör nu uppgiften **planet**. Ersätt fyrhörningarna med planeten: kamerans globala variabler efter `HEIGHT` – långt
bort, så att hela fältet får plats i fönstret:

```cpp
// camera: far away (z = 55) so the whole asteroid field fits in the window
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f, 55.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

Ta bort allt som hör till fyrhörningarna: `QuadVertex`, `quadVertices`, `quadVertexBuffer`, `instanceBuffer` och
`createInstanceBuffer()` (med när de skapas och städas). Pipelinen ritar planetens `Vertex` med `planet.vert/.frag`:

```cpp
        // the planet: each vertex a Vertex
        createPipeline("shaders/planet.vert.spv", "shaders/planet.frag.spv", Vertex::getBindingDescriptions(), Vertex::getAttributeDescriptions(), graphicsPipeline);
```

`updateUniformBuffer()` skriver view och projektion – med det bortre planet på 1000, eftersom fältet är stort:

```cpp
        ubo.view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        // the far plane at 1000: the scene is large
        ubo.proj = glm::perspective(glm::radians(45.0f), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 1000.0f);
        // GLM is made for OpenGL, where clip space y points up: flip it for Vulkan
        ubo.proj[1][1] *= -1;
```

Och `recordCommandBuffer()` ritar planeten under mitten, skalad med 4:

```cpp
        // draw planet
        VkBuffer vertexBuffers[] = {planetVertexBuffer};
        VkDeviceSize offsets[] = {0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);
        vkCmdBindIndexBuffer(commandBuffer, planetIndexBuffer, 0, VK_INDEX_TYPE_UINT32);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &planetDescriptorSet, 0, nullptr);

        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, -3.0f, 0.0f));
        model = glm::scale(model, glm::vec3(4.0f, 4.0f, 4.0f));
        PushConstants constants{};
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(planetIndices.size()), 1, 0, 0, 0);
```
:::
:::d3d12
Gör nu uppgiften **planet**. Ersätt fyrhörningarna med planeten: kamerans globala variabler före `struct Vertex` –
långt bort, så att hela fältet får plats i fönstret:

```cpp
// camera: far away (z = 55) so the whole asteroid field fits in the window
XMVECTOR cameraPos   = XMVectorSet(0.0f, 0.0f, 55.0f, 0.0f);
XMVECTOR cameraFront = XMVectorSet(0.0f, 0.0f, -1.0f, 0.0f);
XMVECTOR cameraUp    = XMVectorSet(0.0f, 1.0f,  0.0f, 0.0f);
```

Ta bort allt som hör till fyrhörningarna: `struct QuadVertex`, `m_vertexBuffer`, `m_vertexBufferView`,
`m_instanceBuffer`, `m_instanceBufferView`, fyrhörningens vertexbuffer, `translations` och instansbuffern. Lägg till en
medlem `Model m_planet;`. Pipeline staten tar `planet.hlsl`s `VSMain` och `PSMain` och meshens input layout
(`POSITION`, `NORMAL` på 12, `TEXCOORD` på 24). I `LoadAssets` laddas planeten – och `m_planet.uploadHeaps.clear();`
kommer efter den sista `WaitForPreviousFrame()`:

```cpp
    m_planet.Load("models/planet.obj", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1);
```

`OnUpdate` skriver view och projektion – med det bortre planet på 1000, eftersom fältet är stort – transponerade in i
constant buffern:

```cpp
    XMMATRIX view = XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront, cameraUp);
    XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 1000.0f);
```

Och `PopulateCommandList` ritar planeten under mitten, skalad med 4:

```cpp
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);

    // draw planet: the model matrix (root parameter 0) moves it down by 3 and scales it
    // by 4 - learnopengl's translate * scale, written in the order DirectXMath applies it.
    XMMATRIX model = XMMatrixScaling(4.0f, 4.0f, 4.0f) * XMMatrixTranslation(0.0f, -3.0f, 0.0f);
    ModelConstants modelConstants = {};
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_planet.Draw(m_commandList.Get());
```
:::

Bygg och kör: en liten texturerad planet strax under fönstrets mitt. Kameran är 3 enheter ovanför ringens plan, så
ringen syns nästan från kanten – en tunn beige linje genom planetens mitt.

Nu stenarna. I stället för ett ritanrop per sten räknar vi ut alla deras modellmatriser en gång, lägger dem i en
buffer och läser matrisen i vertex shadern som en instansierad array – en matris per instans. learnopengls loop som
skapar matriserna är densamma i alla API:er (bara matristypen skiljer): vinkeln går runt cirkeln, tre slumpmässiga
förskjutningar i [-offset, offset] flyttar stenen bort från cirkeln (höjden bara med 40 %, så att ringen förblir
platt), och sedan följer en slumpmässig skalning mellan 0.05 och 0.25 och en slumpmässig rotation kring axeln (0.4,
0.6, 0.8).

En matris är för stor för ett vertexattribut: ett attribut är högst fyra floats, en `vec4`. En `mat4` är i grunden 4
`vec4`, så attributet tar 4 platser i följd, en per vektor i matrisen, och var och en behöver sin egen
attributbeskrivning, alla lästa från samma buffer med en hel matris som stride.

:::opengl
Gör nu den sista uppgiften, **asteroids**. I `asteroids.vs` blir stenens modellmatris ett attribut:

```glsl
layout (location = 3) in mat4 aInstanceMatrix; // a mat4 attribute takes four locations: 3, 4, 5 and 6
```

```glsl
    gl_Position = projection * view * aInstanceMatrix * vec4(aPos, 1.0f);
```

Observera att vi inte längre använder en uniform för modellmatrisen, utan deklarerar en `mat4` som vertexattribut så
att vi kan lagra en instansierad array av transformationsmatriser. Men när vi deklarerar en datatyp som är större än en
`vec4` som vertexattribut fungerar det lite annorlunda. Den största mängd data ett vertexattribut får ha är en `vec4`.
Eftersom en `mat4` i grunden är 4 `vec4` måste vi reservera 4 vertexattribut för just den här matrisen. Eftersom vi gav
den plats 3 får matrisens kolumner attributplatserna 3, 4, 5 och 6.

I `main.cpp`, lägg till stenarnas shader och ladda stenen före planeten:

```cpp
    Shader asteroidShader("asteroids.vs", "asteroids.fs");
```

```cpp
    Model rock("models/rock.obj");
```

När planeten är laddad skapar du matriserna:

```cpp
    // generate a list of semi-random model transformation matrices
    // ------------------------------------------------------------------
    unsigned int amount = 500;
    glm::mat4* modelMatrices;
    modelMatrices = new glm::mat4[amount];
    srand(42); // a fixed seed: the same field every run (learnopengl seeds with the time: a new field each run)
    float radius = 15.0f;
    float offset = 2.5f;
    for (unsigned int i = 0; i < amount; i++)
    {
        glm::mat4 model = glm::mat4(1.0f);
        // 1. translation: displace along circle with 'radius' in range [-offset, offset]
        float angle = (float)i / (float)amount * 360.0f;
        float displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
        float x = sin(angle) * radius + displacement;
        displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
        float y = displacement * 0.4f; // keep height of asteroid field smaller compared to width of x and z
        displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
        float z = cos(angle) * radius + displacement;
        model = glm::translate(model, glm::vec3(x, y, z));

        // 2. scale: Scale between 0.05 and 0.25f
        float scale = static_cast<float>((rand() % 20) / 100.0 + 0.05);
        model = glm::scale(model, glm::vec3(scale));

        // 3. rotation: add random rotation around a (semi)randomly picked rotation axis vector
        float rotAngle = static_cast<float>((rand() % 360));
        model = glm::rotate(model, rotAngle, glm::vec3(0.4f, 0.6f, 0.8f));

        // 4. now add to list of matrices
        modelMatrices[i] = model;
    }
```

Sedan lagrar vi matriserna i en buffer och konfigurerar matrisattributet för var och en av stenens meshar:

```cpp
    // configure instanced array
    // -------------------------
    unsigned int buffer;
    glGenBuffers(1, &buffer);
    glBindBuffer(GL_ARRAY_BUFFER, buffer);
    glBufferData(GL_ARRAY_BUFFER, amount * sizeof(glm::mat4), &modelMatrices[0], GL_STATIC_DRAW);

    for (unsigned int i = 0; i < rock.meshes.size(); i++)
    {
        unsigned int VAO = rock.meshes[i].VAO;
        glBindVertexArray(VAO);
        // set attribute pointers for matrix (4 times vec4)
        glEnableVertexAttribArray(3);
        glVertexAttribPointer(3, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)0);
        glEnableVertexAttribArray(4);
        glVertexAttribPointer(4, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(sizeof(glm::vec4)));
        glEnableVertexAttribArray(5);
        glVertexAttribPointer(5, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(2 * sizeof(glm::vec4)));
        glEnableVertexAttribArray(6);
        glVertexAttribPointer(6, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(3 * sizeof(glm::vec4)));

        glVertexAttribDivisor(3, 1);
        glVertexAttribDivisor(4, 1);
        glVertexAttribDivisor(5, 1);
        glVertexAttribDivisor(6, 1);

        glBindVertexArray(0);
    }
```

Observera att vi fuskade lite genom att göra `Mesh`ens variabel `VAO` publik i stället för privat, så att vi kommer åt
dess vertex array object. Det är inte den snyggaste lösningen, bara en enkel ändring som passar exemplet. Bortsett från
det lilla hacket bör koden vara tydlig: vi anger hur OpenGL ska tolka buffern för vart och ett av matrisens
vertexattribut, och att vart och ett av dem är en instansierad array.

I renderloopen får `asteroidShader` projektionen och view bredvid planetens shader (`asteroidShader.use();
asteroidShader.setMat4("projection", projection); asteroidShader.setMat4("view", view);`), och efter planeten ritar vi
stenarna – en instansierad ritning per mesh i stenen:

```cpp
        // draw meteorites
        asteroidShader.use();
        asteroidShader.setInt("texture_diffuse1", 0);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, rock.textures_loaded[0].id); // note: we also made the textures_loaded vector public (instead of private) from the model class.
        for (unsigned int i = 0; i < rock.meshes.size(); i++)
        {
            glBindVertexArray(rock.meshes[i].VAO);
            glDrawElementsInstanced(GL_TRIANGLES, static_cast<unsigned int>(rock.meshes[i].indices.size()), GL_UNSIGNED_INT, 0, amount);
            glBindVertexArray(0);
        }
```

Här ritar vi lika många asteroider som förut, men den här gången med instansierad rendering. Frigör till sist det du
allokerat, före `glfwTerminate()`: `glDeleteBuffers(1, &buffer); delete[] modelMatrices;`.
:::
:::vulkan
Gör nu den sista uppgiften, **asteroids**. I `shaders/asteroids.vert` blir stenens modellmatris ett attribut:

```glsl
layout(location = 4) in mat4 inInstanceMatrix; // a mat4 attribute takes four locations: 4, 5, 6 and 7
```

```glsl
    gl_Position = ubo.proj * ubo.view * inInstanceMatrix * vec4(inPosition, 1.0);
```

Observera att shadern inte längre använder en modellmatris från en push constant, utan ett `mat4`-vertexattribut, så
att vi kan lagra en instansierad array av transformationsmatriser. Ett `mat4`-attribut tar fyra platser i följd, en
per kolumn. learnopengl lägger det på plats 3; vår `Vertex` använder redan platserna 0 till 3 (position, normal,
texturkoordinat och materialindex – pipelinens vertexindata deklarerar alla fyra), så matrisen börjar på 4 och tar 4,
5, 6 och 7.

I `main.cpp`, lägg till `const uint32_t amount = 500;` efter filsökvägarna, och ge `Vertex` vertexindatan för en
instansierad pipeline: stenens vertices på binding 0 som förut, och en matris per instans på binding 1:

```cpp
    // The asteroids' vertex input: the rock's vertices (binding 0) and, per instance, a model matrix (binding 1).
    static std::vector<VkVertexInputBindingDescription> getInstancedBindingDescriptions() {
        std::vector<VkVertexInputBindingDescription> bindingDescriptions = getBindingDescriptions();
        bindingDescriptions.resize(2);

        bindingDescriptions[1].binding = 1;
        bindingDescriptions[1].stride = sizeof(glm::mat4);
        bindingDescriptions[1].inputRate = VK_VERTEX_INPUT_RATE_INSTANCE; // the next matrix for every instance

        return bindingDescriptions;
    }
```

```cpp
    // A mat4 attribute takes four locations, one vec4 (a column of the matrix) each: 4, 5, 6 and 7.
    static std::vector<VkVertexInputAttributeDescription> getInstancedAttributeDescriptions() {
        std::vector<VkVertexInputAttributeDescription> attributeDescriptions = getAttributeDescriptions();
        attributeDescriptions.resize(8);

        attributeDescriptions[4].binding = 1;
        attributeDescriptions[4].location = 4;
        attributeDescriptions[4].format = VK_FORMAT_R32G32B32A32_SFLOAT;
        attributeDescriptions[4].offset = 0;

        attributeDescriptions[5].binding = 1;
        attributeDescriptions[5].location = 5;
        attributeDescriptions[5].format = VK_FORMAT_R32G32B32A32_SFLOAT;
        attributeDescriptions[5].offset = sizeof(glm::vec4);
```

och likadant `[6]` (plats 6, offset `2 * sizeof(glm::vec4)`) och `[7]` (plats 7, offset `3 * sizeof(glm::vec4)`). GLM
lagrar en matris kolumn för kolumn, så de fyra `vec4` på offset 0, 16, 32 och 48 är dess kolumner – precis vad
shaderns `mat4`-attribut väntar sig.

Stenarna behöver andra shaders och annan vertexindata än planeten, så de får en egen pipeline. Lägg till en medlem
`VkPipeline asteroidPipeline;` (förstörd i `cleanup()`) och skapa den efter planetens:

```cpp
        // the asteroids: a Vertex per vertex and a model matrix per instance
        createPipeline("shaders/asteroids.vert.spv", "shaders/asteroids.frag.spv", Vertex::getInstancedBindingDescriptions(), Vertex::getInstancedAttributeDescriptions(), asteroidPipeline);
```

Matriserna hamnar i en egen vertexbuffer. Lägg till medlemmarna `VkBuffer instanceBuffer; VkDeviceMemory
instanceBufferMemory;` (förstörda i `cleanup()`), och anropa `createInstanceBuffer()` efter att stenens indexbuffer
skapats:

```cpp
    // The instance data: a list of semi-random model transformation matrices, one per asteroid, in a vertex buffer.
    void createInstanceBuffer() {
        std::vector<glm::mat4> modelMatrices(amount);
        srand(42); // a fixed seed: the same field every run (learnopengl seeds with the time: a new field each run)
        float radius = 15.0f;
        float offset = 2.5f;
        for (unsigned int i = 0; i < amount; i++) {
            glm::mat4 model = glm::mat4(1.0f);
            // 1. translation: displace along circle with 'radius' in range [-offset, offset]
            float angle = (float)i / (float)amount * 360.0f;
            float displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
            float x = sin(angle) * radius + displacement;
            displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
            float y = displacement * 0.4f; // keep height of asteroid field smaller compared to width of x and z
            displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
            float z = cos(angle) * radius + displacement;
            model = glm::translate(model, glm::vec3(x, y, z));

            // 2. scale: Scale between 0.05 and 0.25f
            float scale = static_cast<float>((rand() % 20) / 100.0 + 0.05);
            model = glm::scale(model, glm::vec3(scale));

            // 3. rotation: add random rotation around a (semi)randomly picked rotation axis vector
            float rotAngle = static_cast<float>((rand() % 360));
            model = glm::rotate(model, rotAngle, glm::vec3(0.4f, 0.6f, 0.8f));

            // 4. now add to list of matrices
            modelMatrices[i] = model;
        }

        createVertexBuffer(modelMatrices.data(), sizeof(glm::mat4) * amount, instanceBuffer, instanceBufferMemory);
    }
```

I `recordCommandBuffer()`, efter planeten, ritar vi alla stenarna med ett kommando: asteroidpipelinen, stenens
vertices på binding 0 och matriserna på binding 1, stenens index och dess descriptor set (med dess textur):

```cpp
        // draw meteorites: all of them with one draw call, amount instances of the rock
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, asteroidPipeline);
        VkBuffer rockVertexBuffers[] = {rockVertexBuffer, instanceBuffer}; // binding 0: the rock's vertices, binding 1: the matrices
        VkDeviceSize rockOffsets[] = {0, 0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 2, rockVertexBuffers, rockOffsets);
        vkCmdBindIndexBuffer(commandBuffer, rockIndexBuffer, 0, VK_INDEX_TYPE_UINT32);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &rockDescriptorSet, 0, nullptr);
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(rockIndices.size()), amount, 0, 0, 0);
```

Stenarna behöver ingen push constant: varje instans matris kommer från instansbuffern.
:::
:::d3d12
Gör nu den sista uppgiften, **asteroids**. I `asteroids.hlsl` blir stenens modellmatris indata till vertex shadern.
Ett indataelement är högst fyra floats, så matrisen kommer som fyra `float4`-indata med semantiken `INSTANCEMATRIX` och
indexen 0 till 3, och shadern bygger matrisen av dem:

```hlsl
// The rock's model matrix is a per-instance input (input slot 1): a vertex input is at
// most a float4, so the matrix comes as its four rows, INSTANCEMATRIX0 to INSTANCEMATRIX3.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD,
    float4 instanceRow0 : INSTANCEMATRIX0, float4 instanceRow1 : INSTANCEMATRIX1,
    float4 instanceRow2 : INSTANCEMATRIX2, float4 instanceRow3 : INSTANCEMATRIX3)
{
    PSInput result;

    float4x4 instanceMatrix = float4x4(instanceRow0, instanceRow1, instanceRow2, instanceRow3);
    result.texCoords = texCoords;
    result.position = mul(mul(mul(position, instanceMatrix), view), projection);
```

Stenarna behöver en annan shader och en annan input layout än planeten, så de får en egen pipeline state,
`ComPtr<ID3D12PipelineState> m_asteroidPipelineState;`, gjord av samma beskrivning efter planetens:

```cpp
        D3D12_INPUT_ELEMENT_DESC asteroidInputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "INSTANCEMATRIX", 0, DXGI_FORMAT_R32G32B32A32_FLOAT, 1, 0, D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA, 1 },
            { "INSTANCEMATRIX", 1, DXGI_FORMAT_R32G32B32A32_FLOAT, 1, 16, D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA, 1 },
            { "INSTANCEMATRIX", 2, DXGI_FORMAT_R32G32B32A32_FLOAT, 1, 32, D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA, 1 },
            { "INSTANCEMATRIX", 3, DXGI_FORMAT_R32G32B32A32_FLOAT, 1, 48, D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA, 1 }
        };

        ComPtr<ID3DBlob> asteroidVertexShader;
        ComPtr<ID3DBlob> asteroidPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"asteroids.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &asteroidVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"asteroids.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &asteroidPixelShader, nullptr));
        psoDesc.InputLayout = { asteroidInputElementDescs, _countof(asteroidInputElementDescs) };
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(asteroidVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(asteroidPixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_asteroidPipelineState)));
```

Slot 0 är stenens mesh, som för planeten; slot 1 har en matris per instans – dess fyra rader på byte-offset 0, 16, 32
och 48. Lägg till `static const UINT amount = 500;` bredvid `MaxMeshes`, `#include <cstdlib>` för `rand`, och
medlemmarna `Model m_rock;`, `ComPtr<ID3D12Resource> m_instanceBuffer;` och
`D3D12_VERTEX_BUFFER_VIEW m_instanceBufferView = {};`. I `LoadAssets` laddar du stenen efter planeten – dess
texturvyer hamnar i heapen efter planetens, två platser per mesh:

```cpp
    m_rock.Load("models/rock.obj", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1 + 2 * static_cast<UINT>(m_planet.meshes.size()));
```

Skapa sedan matriserna:

```cpp
    std::vector<XMFLOAT4X4> modelMatrices(amount);
    srand(42); // a fixed seed: the same field every run (learnopengl seeds with the time: a new field each run)
    float radius = 15.0f;
    float offset = 2.5f;
    for (UINT i = 0; i < amount; i++)
    {
        // 1. translation: displace along circle with 'radius' in range [-offset, offset]
        float angle = static_cast<float>(i) / static_cast<float>(amount) * 360.0f;
        float displacement = (rand() % static_cast<int>(2 * offset * 100)) / 100.0f - offset;
        float x = std::sin(angle) * radius + displacement;
        displacement = (rand() % static_cast<int>(2 * offset * 100)) / 100.0f - offset;
        float y = displacement * 0.4f; // keep height of asteroid field smaller compared to width of x and z
        displacement = (rand() % static_cast<int>(2 * offset * 100)) / 100.0f - offset;
        float z = std::cos(angle) * radius + displacement;

        // 2. scale: Scale between 0.05 and 0.25f
        float scale = static_cast<float>((rand() % 20) / 100.0 + 0.05);

        // 3. rotation: add random rotation around a (semi)randomly picked rotation axis vector
        float rotAngle = static_cast<float>((rand() % 360));

        // 4. now add to list of matrices: rotate, then scale, then move - learnopengl's
        // translate * scale * rotate, written in the order DirectXMath applies it. Not
        // transposed: the vertex shader builds the matrix from these rows.
        XMMATRIX model = XMMatrixRotationAxis(XMVectorSet(0.4f, 0.6f, 0.8f, 0.0f), rotAngle)
            * XMMatrixScaling(scale, scale, scale)
            * XMMatrixTranslation(x, y, z);
        XMStoreFloat4x4(&modelMatrices[i], model);
    }
```

Lägg märke till det enda stället där vi *inte* transponerar en matris. Matriserna i constant buffers transponeras
eftersom HLSL läser en `float4x4` i en constant buffer kolumn för kolumn. Här bygger shadern själv matrisen av fyra
indatarader med `float4x4(row0, row1, row2, row3)`, och `XMStoreFloat4x4` lagrar DirectXMaths matris rad för rad – så de
fyra `float4` i buffern är precis de rader som `mul(position, instanceMatrix)` behöver.

Matriserna hamnar i en buffer `m_instanceBuffer` i en upload heap (`memcpy(pInstanceDataBegin, modelMatrices.data(),
instanceBufferSize)`) med en vy med en matris per element (`StrideInBytes = sizeof(XMFLOAT4X4)`), och
`m_rock.uploadHeaps.clear();` följer efter `m_planet.uploadHeaps.clear();`. I `PopulateCommandList`, efter planeten,
ritar vi stenarna – en instansierad ritning per mesh i stenen:

```cpp
    m_commandList->SetPipelineState(m_asteroidPipelineState.Get());
    m_commandList->IASetVertexBuffers(1, 1, &m_instanceBufferView);
    for (UINT i = 0; i < m_rock.meshes.size(); i++)
    {
        m_commandList->SetGraphicsRootDescriptorTable(2, m_rock.meshes[i].srvHandle);
        m_commandList->IASetVertexBuffers(0, 1, &m_rock.meshes[i].vertexBufferView);
        m_commandList->IASetIndexBuffer(&m_rock.meshes[i].indexBufferView);
        m_commandList->DrawIndexedInstanced(static_cast<UINT>(m_rock.meshes[i].indices.size()), amount, 0, 0, 0);
    }
```

Därför gjordes meshens vyer och `srvHandle` publika: som i learnopengls demo ritar vi stenens meshar själva i stället
för att anropa `m_rock.Draw`. Stenarna behöver inga root constants: varje instans matris kommer från slot 1.
:::

Bygg och kör: ett platt band av grå stenar över planetens övre halva – ringen med radien 15 sedd från 3 enheter ovanför
sitt plan, så att den ser ut som ett band. Planeten under bandet är oförändrad.

:::opengl
```quiz
`aInstanceMatrix` är deklarerad på plats 3. Vilka attributplatser upptar den?
- [ ] Bara 3: en `mat4` är ett enda attribut
- [x] 3, 4, 5 och 6: en plats per kolumn, eftersom ett attribut rymmer högst en `vec4`
- [ ] 3 till 18: en plats per float
- [ ] 0 till 3: en matris börjar alltid på plats 0
---
Det största vertexattributet är en `vec4`. En `mat4` är fyra sådana, så den tar fyra platser i följd, och var och en behöver sin egen `glVertexAttribPointer` (stride `sizeof(glm::mat4)`, offset 0, 16, 32, 48) och divisor.
```
:::
:::vulkan
```quiz
Varför lägger Vulkan-projektet instansmatrisen på plats 4 i stället för learnopengls 3?
- [ ] Plats 3 är reserverad för `gl_InstanceIndex`
- [ ] Ett matrisattribut måste börja på en multipel av 4
- [ ] Instansbindingen börjar alltid på plats 4
- [x] Vår `Vertex` använder platserna 0 till 3 (position, normal, texturkoordinat, materialindex), och matrisen behöver fyra lediga platser i följd
---
Ett `mat4`-attribut tar fyra platser i följd, en per kolumn (`VK_FORMAT_R32G32B32A32_SFLOAT` var). Med vertexens fyra attribut på 0–3 får matrisen 4, 5, 6 och 7.
```
:::
:::d3d12
```quiz
Varför har asteroidpipelinens input layout fyra `INSTANCEMATRIX`-element?
- [x] Ett indataelement rymmer högst fyra komponenter, så en 4x4-matris kommer som fyra `float4`-rader, som shadern sätter ihop med `float4x4(...)`
- [ ] Varje sten har fyra meshar
- [ ] Ett element per input slot
- [ ] DirectXMath lagrar en matris i fyra separata buffrar
---
`DXGI_FORMAT_R32G32B32A32_FLOAT` är det största vertexformatet: en rad i matrisen. De fyra elementen läser varje instans 64 byte stora matris på offset 0, 16, 32 och 48 i slot 1.
```
:::

```quiz
Varför skalar instansierad ritning av stenarna så mycket bättre än ett ritanrop per sten?
- [x] Kostnaden för ett ritanrop ligger mest på CPU:n – att förbereda och skicka kommandona; en instansierad ritning ersätter hundratals av dem, och GPU:n behandlar alla instanser i ett svep
- [ ] GPU:n kör vertex shadern bara en gång för alla instanser
- [ ] Instansierade stenar renderas med lägre upplösning
- [ ] Instancing hoppar över djuptestet
---
GPU:n behandlar fortfarande varje vertex i varje sten. Det instancing tar bort är arbetet per ritning: bindningarna, uniform-uppdateringarna och kommandona för varje enskild sten. Därför går learnopengls dator från att kämpa med några tusen stenar till att klara 100 000.
```

På learnopengls dator flyter 100 000 asteroider med radien 150 utan problem med instancing – ett antal ritanrop som
vore helt utom räckhåll en sten i taget. Prova på en riktig GPU: sätt `amount` till 100 000, radien till 150 och
offset till 25, och flytta kameran bakåt. Som du ser kan instansierad rendering, i rätt sorts miljöer, göra en enorm
skillnad för vad ditt program klarar att rendera. Därför används instansierad rendering ofta för gräs, växtlighet,
partiklar och scener som den här – i princip kan varje scen med många upprepade former vinna på det.

## Mer att läsa

:::opengl
- [glDrawArraysInstanced](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawArraysInstanced.xhtml) och
  [glVertexAttribDivisor](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribDivisor.xhtml):
  referenssidorna.
- [asteroids_instanced.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/4.advanced_opengl/10.3.asteroids_instanced/asteroids_instanced.cpp):
  learnopengls instansierade asteroidfält.
:::
:::vulkan
- [Vertex input description](https://vulkan-tutorial.com/Vertex_buffers/Vertex_input_description): vulkan-tutorial om
  bindings, input rates och attribut.
- [Fixed-Function Vertex Processing](https://docs.vulkan.org/spec/latest/chapters/fxvertex.html): kapitlet i Vulkans
  specifikation om vertexindata, bland annat `VK_VERTEX_INPUT_RATE_INSTANCE`.
- [Shader memory layout](https://docs.vulkan.org/guide/latest/shader_memory_layout.html): varför ett arrayelement i
  ett uniform-block tar 16 byte.
:::
:::d3d12
- [D3D12_INPUT_ELEMENT_DESC](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_input_element_desc):
  input slots, `D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA` och `InstanceDataStepRate`.
- [DrawIndexedInstanced](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-drawindexedinstanced):
  parametrarna för en instansierad, indexerad ritning.
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  varför ett arrayelement i en cbuffer tar ett helt register.
:::

I nästa kapitel, det sista i den här delen, tittar vi på de taggiga kanter som varje bild hittills har haft, och hur
man jämnar ut dem: *anti-aliasing*.
