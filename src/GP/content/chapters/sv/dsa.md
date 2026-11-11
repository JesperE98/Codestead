# DSA

Det här kapitlet handlar om OpenGL självt. Ända från början har OpenGL arbetat efter en modell som ofta kallas *bind to
edit* ("bind för att ändra"): för att ändra ett objekt – en buffer, en textur, en vertex array – binder du det först till
ett *mål* (target) i kontexten, och de funktioner du sedan anropar arbetar på det som råkar vara bundet till det målet.
`glBufferData(GL_ARRAY_BUFFER, …)` säger inte vilken buffer den fyller; den fyller den som råkar vara bunden till
`GL_ARRAY_BUFFER`. OpenGL 4.5 lade till ett andra sätt, *direct state access* (DSA): funktioner som tar emot objektet de
arbetar på som parameter. learnopengls gästartikel *DSA* presenterar dem, och det här kapitlet följer den.

:::opengl
Du har använt bind to edit sedan *Hello Triangle*. I det här kapitlet skriver du om det kapitlets program – den orange
rektangeln, ritad från en vertex buffer, en element buffer och ett vertex array-objekt – med DSA, och går sedan ett steg
längre än learnopengls demo och lägger containertexturen på den, också den skapad med DSA.
:::
:::vulkan
Vulkan har aldrig haft bind to edit: från första början namnger varje Vulkan-funktion objektet den arbetar på. Därför har
kapitlet **inga uppgifter** för Vulkan. Projektet är programmet från *Hello Triangle* – den orange rektangeln från en
vertex buffer och en index buffer – och kapitlet förklarar vad DSA ändrar i OpenGL och hur det för OpenGL närmare den
modell Vulkan alltid haft, och jämför varje DSA-funktion med den Vulkan-kod du känner. Det är värt att läsa även om du
aldrig skriver OpenGL: mycket OpenGL-kod du kommer att stöta på är skriven på det ena eller det andra sättet, och
jämförelsen visar varför Vulkans API ser ut som det gör.
:::
:::d3d12
Direct3D 12 har aldrig haft bind to edit: varje anrop namnger objektet det arbetar på, och objekten är COM-gränssnitt med
metoder. Därför har kapitlet **inga uppgifter** för DirectX 12. Projektet är programmet från *Hello Triangle* – den orange
rektangeln från en vertex buffer och en index buffer – och kapitlet förklarar vad DSA ändrar i OpenGL och hur det för
OpenGL närmare den modell Direct3D 12 alltid haft, och jämför varje DSA-funktion med den Direct3D 12-kod du känner. Det är
värt att läsa även om du aldrig skriver OpenGL: mycket OpenGL-kod du kommer att stöta på är skriven på det ena eller det
andra sättet, och jämförelsen visar varför Direct3D 12:s API ser ut som det gör.
:::

## Bind to edit

Så här ställer *Hello Triangle* i ordning sin vertexdata:

```cpp
    unsigned int VBO, VAO, EBO;
    glGenVertexArrays(1, &VAO);
    glGenBuffers(1, &VBO);
    glGenBuffers(1, &EBO);
    // bind the Vertex Array Object first, then bind and set vertex buffer(s), and then configure vertex attributes(s).
    glBindVertexArray(VAO);

    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);

    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
```

Varje rad efter de fyra första beror på vad som är bundet just då. `glBufferData` fyller den buffer som är bunden till
dess mål. `glVertexAttribPointer` beskriver attribut 0 i den bundna VAO:n *och* registrerar den buffer som är bunden till
`GL_ARRAY_BUFFER` som dess källa. Att binda `GL_ELEMENT_ARRAY_BUFFER` medan en VAO är bunden lagrar element buffern i den
VAO:n – därför varnar learnopengl för att någonsin avbinda element buffern medan VAO:n fortfarande är bunden. Inget av
detta syns i själva anropen; du måste känna till kontextens tillstånd för att veta vad en rad gör.

I ett litet program går det att hålla reda på. I ett stort ställer det till verkliga problem:

- **Tillstånd som läcker.** En funktion binder en buffer för att ändra den och återställer inte den gamla bindningen.
  Senare kod som förlitade sig på den gamla bindningen ändrar nu fel buffer – långt från funktionen som orsakade det.
- **Dolda beroenden.** En hjälpfunktion som skapar en textur binder den till `GL_TEXTURE_2D` i den aktiva
  texturenheten och ersätter i tysthet den textur anroparen hade bundit där för ritning. En VAO som råkar vara bunden när
  du ställer i ordning en element buffer för något annat slukar den.
- **Extra arbete.** Att binda bara för att ändra kostar anrop, och drivrutinen måste hålla reda på och validera
  bindningar som inte spelar någon roll för någon ritning.
- **Två betydelser för en bindning.** `glBindTexture` används både för att ändra en textur och för att välja vilken
  textur en ritning läser. De två användningarna slåss om samma bindningspunkt.

```quiz
En funktion `loadTexture()` anropar `glBindTexture(GL_TEXTURE_2D, newTexture)` för att ställa i ordning en ny textur och återvänder utan att återställa bindningen. Anroparen hade bundit sin sandtextur till enhet 0 innan anropet och ritar direkt efteråt. Vad använder ritningen?
- [ ] Sandtexturen: en textur som är bunden för ritning kan inte ersättas av en som binds för att ändras
- [x] Den nya texturen, om enhet 0 var den aktiva enheten: bind to edit ändrade bindningen som ritningen läser
- [ ] Ingen textur alls: `glBindTexture` utan ritning avbinder enheten
- [ ] Båda texturerna, blandade
---
Det här är ett typiskt tillståndsläckage: bindningen som används för att ändra är samma som används för att rita. Med DSA ställer `glTextureStorage2D(newTexture, …)` och dess syskon i ordning texturen utan att röra någon bindning.
```

## Direct state access

OpenGL 4.5 gjorde tillägget `ARB_direct_state_access` till en del av kärnan: för nästan varje funktion som ändrar ett
bundet objekt finns nu en variant som tar emot objektets namn i stället. De följer några namnmönster:

| Bind to edit | Direct state access |
|---|---|
| `glGenBuffers` + `glBindBuffer` | `glCreateBuffers` |
| `glBufferData(GL_ARRAY_BUFFER, …)` | `glNamedBufferData(buffer, …)` / `glNamedBufferStorage(buffer, …)` |
| `glBufferSubData(GL_ARRAY_BUFFER, …)` | `glNamedBufferSubData(buffer, …)` |
| `glGenVertexArrays` + `glBindVertexArray` | `glCreateVertexArrays` |
| `glVertexAttribPointer` | `glVertexArrayAttribFormat` + `glVertexArrayAttribBinding` + `glVertexArrayVertexBuffer` |
| `glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, …)` med en VAO bunden | `glVertexArrayElementBuffer(vao, buffer)` |
| `glGenTextures` + `glBindTexture` | `glCreateTextures(target, …)` |
| `glTexParameteri(GL_TEXTURE_2D, …)` | `glTextureParameteri(texture, …)` |
| `glTexImage2D` | `glTextureStorage2D` + `glTextureSubImage2D` |
| `glGenerateMipmap(GL_TEXTURE_2D)` | `glGenerateTextureMipmap(texture)` |
| `glActiveTexture` + `glBindTexture` (för ritning) | `glBindTextureUnit(unit, texture)` |
| `glGenFramebuffers` + `glBindFramebuffer` + `glFramebufferTexture2D` | `glCreateFramebuffers` + `glNamedFramebufferTexture` |

`glCreate*` skiljer sig från `glGen*` på ett subtilt sätt: `glGen*` reserverar bara ett *namn*; objektet bakom det skapas
första gången namnet binds, och den första bindningen bestämmer också vilken sorts objekt det är (en textur som först
binds till `GL_TEXTURE_2D` är en 2D-textur för alltid). `glCreate*` skapar objekten direkt – därför tar
`glCreateTextures` emot målet som parameter – så att de kan ändras via namnet utan att någonsin bindas.

DSA tar inte bort bindningen. För att *rita* binder du fortfarande: programmet, VAO:n, texturerna till sina enheter. Det
som försvinner är att binda för att *ändra*. Objekt skapas och ställs i ordning via sina namn, och bindningen får göra det
den är bra på: välja vad nästa ritning använder.

```quiz
Varför kan man inte bara skicka ett buffernamn från `glGenBuffers` till `glNamedBufferStorage` innan det någonsin har bundits?
- [ ] För att `glGenBuffers` skapar buffrar med en fast storlek
- [ ] För att de namngivna funktionerna bara fungerar på buffrar skapade med `GL_DYNAMIC_STORAGE_BIT`
- [x] För att `glGenBuffers` bara reserverar ett namn; själva bufferobjektet skapas vid första bindningen – `glCreateBuffers` skapar objektet direkt
- [ ] Det kan man: `glGen*` och `glCreate*` är samma funktion under två namn
---
Därför har DSA egna create-funktioner. För texturer är skillnaden ännu tydligare: `glCreateTextures(GL_TEXTURE_2D, …)` bestämmer texturens typ när den skapas, där `glGenTextures` överlåter det till den första `glBindTexture`.
```

:::opengl
### Kontexten

DSA-funktionerna är core först från OpenGL **4.5**; kursens övriga program begär 3.3. learnopengls demo begär 4.5, och
det gör även det här kapitlets program:

```cpp
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 5);
```

GLAD måste genereras för 4.5 (eller med tillägget) så att funktionspekarna läses in. **macOS stannar vid OpenGL 4.1**, så
det här kapitlets program fungerar inte på en Mac – bind to edit-koden i de andra kapitlen gör det. (Före 4.5 erbjöd det
äldre tillägget `EXT_direct_state_access` liknande funktioner med andra namn, som `glNamedBufferDataEXT` och
`glTextureParameteriEXT`; du kan fortfarande stöta på dem i äldre kod.)

Projektet är kursens lösning till *Hello Triangle*, den orange rektangeln, med `// TODO:`-kommentarer där DSA-koden ska
in. **Build & run** (Ctrl+Enter) kompilerar det och kör det i den inbyggda simulatorn. Gör nu den första uppgiften,
**context**. Bilden ändras inte: bind to edit-koden körs oförändrad i en 4.5-kontext.
:::
:::vulkan
### Projektet

Projektet är kursens Vulkan-lösning till *Hello Triangle*: den orange rektangeln `(1.0, 0.5, 0.2)` – två trianglar från
en index buffer – mot den blågröna rensningsfärgen. **Build & run** (Ctrl+Enter) kompilerar det och kör det i den
inbyggda simulatorn; det är samma rektangel som OpenGL-versionen av kapitlet börjar med. Avsnitten nedan ställer dess kod
bredvid OpenGL:s DSA-anrop.
:::
:::d3d12
### Projektet

Projektet är kursens DirectX 12-lösning till *Hello Triangle*: den orange rektangeln `(1.0, 0.5, 0.2)` – två trianglar
från en index buffer – mot den blågröna rensningsfärgen. **Build & run** (Ctrl+Enter) kompilerar det och kör det i den
inbyggda simulatorn; det är samma rektangel som OpenGL-versionen av kapitlet börjar med. Avsnitten nedan ställer dess kod
bredvid OpenGL:s DSA-anrop.
:::

## Buffrar

Med DSA skapas en buffer med `glCreateBuffers` och får sitt minne med `glNamedBufferStorage` – utan bindning:

```cpp
    // Here we create the VBO with DSA.
    GLuint VBO = 0;
    // Note how we do not have to call glBindBuffer() after the create call.
    glCreateBuffers(1, &VBO);
    glNamedBufferStorage(VBO, sizeof(vertices), vertices, 0x0);
```

`glNamedBufferStorage` är inte bara `glBufferData` med ett namn. Den allokerar **oföränderligt minne** (immutable
storage): bufferns storlek bestäms en gång för alla, och att anropa den en andra gång på samma buffer är ett fel.
`glBufferData` (och dess DSA-variant `glNamedBufferData`) får anropas igen med en annan storlek, och drivrutinen måste då
kasta det gamla minnet och allokera nytt bakom samma namn – bekvämt, men det betyder att drivrutinen aldrig kan vara säker
på var en buffers minne finns. Med oföränderligt minne kan den det.

Den sista parametern ersätter `glBufferData`:s användningsledtråd (`GL_STATIC_DRAW` …) med **flaggor** som är löften och
tillstånd: `0` betyder att programmet aldrig kommer att ändra innehållet från CPU:n – vertexarna laddas upp en gång, när
buffern skapas. `GL_DYNAMIC_STORAGE_BIT` tillåter `glNamedBufferSubData`; `GL_MAP_READ_BIT` / `GL_MAP_WRITE_BIT` tillåter
mappning, och `GL_MAP_PERSISTENT_BIT` låter en buffer förbli mappad medan GPU:n använder den. learnopengls demo skapar
element buffern på det sättet – minne utan data, men uppdaterbart, och sedan indexen uppladdade i det:

```cpp
    // Here we create the EBO with DSA while also specifying that the buffer is mutable from the client side.
    GLuint EBO = 0;
    glCreateBuffers(1, &EBO);
    glNamedBufferStorage(EBO, sizeof(indices), nullptr, GL_DYNAMIC_STORAGE_BIT);
    glNamedBufferSubData(EBO, 0, sizeof(indices), indices);
```

:::opengl
Gör nu den andra uppgiften, **vertex-buffer**, och den tredje, **element-buffer**: ersätt `glGenBuffers` och paren av
bindning + `glBufferData` med DSA-anropen. Uppsättningen av vertex arrayen som följer binder fortfarande vertex buffern
till `GL_ARRAY_BUFFER` en gång för `glVertexAttribPointer` – nästa uppgift tar bort även det. Bilden förblir densamma.
:::
:::vulkan
I Vulkan har det alltid varit det enda sättet, och det går ett steg längre. Buffern är ett objekt med fast storlek,
skapat med namn:

```cpp
        if (vkCreateBuffer(device, &bufferInfo, nullptr, &vertexBuffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to create vertex buffer!");
        }
```

men den har inget minne ännu. Dess minne är ett separat objekt, `VkDeviceMemory`, allokerat från en minnestyp du väljer –
`HOST_VISIBLE | HOST_COHERENT` här, så att CPU:n kan skriva det – och kopplat till buffern en gång:

```cpp
        vkBindBufferMemory(device, vertexBuffer, vertexBufferMemory, 0);
```

Varje anrop namnger sina objekt: `vkGetBufferMemoryRequirements(device, vertexBuffer, …)`, `vkMapMemory(device,
vertexBufferMemory, …)`. Det finns ingen "nu bunden buffer" någonstans. OpenGL:s oföränderliga minne är steget mot den här
modellen: en fast storlek, och flaggor som i förväg säger hur minnet ska användas – Vulkans flaggor för minnesegenskaper
spelar den rollen.
:::
:::d3d12
I Direct3D 12 har det alltid varit det enda sättet. En buffer är en `ID3D12Resource`, skapad med sin storlek och sitt
minne i ett enda anrop – heaptypen säger vilket slags minne (`UPLOAD` här, skrivbart för CPU:n; `DEFAULT` för minne som
bara GPU:n använder):

```cpp
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(vertexBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &bufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_vertexBuffer)));
```

Den fylls via resursen själv – `m_vertexBuffer->Map(…)`, `memcpy`, `m_vertexBuffer->Unmap(…)` – som
`glNamedBufferSubData`, aldrig via ett bundet mål. Dess storlek är fast, som OpenGL:s oföränderliga minne. En *committed*
resurs får eget minne; `CreatePlacedResource` placerar flera resurser i en `ID3D12Heap` som du allokerat själv – det helt
explicita sättet, som Vulkans `vkBindBufferMemory`.
:::

```quiz
Element buffern skapas med `glNamedBufferStorage(EBO, sizeof(indices), nullptr, 0x0)` – flaggorna 0 – och programmet anropar sedan `glNamedBufferSubData(EBO, 0, sizeof(indices), indices)`. Vad händer?
- [ ] Indexen laddas upp: flaggorna spelar bara roll för mappning
- [ ] Minnet allokeras om med den nya datan
- [ ] Ingenting, i tysthet: buffern förblir tom utan något fel
- [x] `GL_INVALID_OPERATION`: oföränderligt minne som skapats utan `GL_DYNAMIC_STORAGE_BIT` får inte ändras med `glNamedBufferSubData`
---
Flaggorna är tillstånd. Flaggorna 0 lovar att innehållet aldrig ändras efter att buffern skapats – bra för vertex buffern, vars data skickas direkt till `glNamedBufferStorage`.
```

## Vertex arrays

Den största ändringen gäller vertex array-objektet. `glVertexAttribPointer` gjorde tre saker på en gång: den beskrev ett
attributs format (tre flyttal), sa var dess data börjar (en förskjutning), och hämtade buffern från bindningen
`GL_ARRAY_BUFFER`. DSA – som använder modellen med *separat attributformat* som OpenGL 4.3 införde – delar upp det i
oberoende delar:

- ett attributs **format**: antal komponenter, typ och förskjutning *inom en vertex* (`glVertexArrayAttribFormat`);
- vilken **bindningspunkt** attributet läser från (`glVertexArrayAttribBinding`);
- vilken **buffer** som matar en bindningspunkt, med vilken förskjutning och vilket avstånd (stride) mellan vertexarna
  (`glVertexArrayVertexBuffer`).

```cpp
    // Here we create the VAO with DSA and specify its format.
    GLuint VAO = 0;
    glCreateVertexArrays(1, &VAO);

    // Specifying our vertex layout with the VAO: attribute 0 = three floats at offset 0, read from binding point 0.
    glEnableVertexArrayAttrib(VAO, 0);
    glVertexArrayAttribFormat(VAO, 0, 3, GL_FLOAT, GL_FALSE, 0);
    glVertexArrayAttribBinding(VAO, 0, 0);
```

och, efter attributen, buffrarna:

```cpp
    glVertexArrayVertexBuffer(VAO, 0, VBO, 0, sizeof(float) * 3);
    glVertexArrayElementBuffer(VAO, EBO);
```

Formatet säger *hur* en vertex ser ut; bindningen säger *varifrån* datan kommer. Nu kan du byta en VAO till en annan
buffer med ett enda `glVertexArrayVertexBuffer`-anrop utan att röra formatet, och flera attribut kan dela en
bindningspunkt – en sammanflätad buffer – med ett och samma stride. Element buffern kopplas in uttryckligen med
`glVertexArrayElementBuffer`: ingen VAO som slukar det som råkar vara bundet till `GL_ELEMENT_ARRAY_BUFFER` längre.

:::opengl
Gör nu den fjärde uppgiften, **vertex-array**: skapa VAO:n med `glCreateVertexArrays`, beskriv attribut 0 och koppla in
båda buffrarna – inga `glGenVertexArrays`, `glBindBuffer`, `glVertexAttribPointer` eller `glEnableVertexAttribArray` i
uppsättningen längre. Renderingsloopen binder fortfarande VAO:n med `glBindVertexArray(VAO)` – det är bindning för att
rita, och den behåller DSA. Med den här uppgiften är ditt program learnopengls demo. Bilden är fortfarande den orange
rektangeln.
:::
:::vulkan
Den här uppdelningen är precis hur Vulkan beskriver vertexindata. *Formatet* ligger i pipelinen: en
`VkVertexInputAttributeDescription` per attribut (location, binding, format, offset) och en
`VkVertexInputBindingDescription` per bindning (binding, stride):

```cpp
    static VkVertexInputBindingDescription getBindingDescription() {
        VkVertexInputBindingDescription bindingDescription{};
        bindingDescription.binding = 0;
        bindingDescription.stride = sizeof(Vertex);
        bindingDescription.inputRate = VK_VERTEX_INPUT_RATE_VERTEX;

        return bindingDescription;
    }

    static std::array<VkVertexInputAttributeDescription, 1> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 1> attributeDescriptions{};

        attributeDescriptions[0].binding = 0;
        attributeDescriptions[0].location = 0;
        attributeDescriptions[0].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[0].offset = offsetof(Vertex, pos);

        return attributeDescriptions;
    }
```

– `glVertexArrayAttribFormat` och `glVertexArrayAttribBinding`. *Buffrarna* väljs när command buffern spelas in –
`vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets)` (`glVertexArrayVertexBuffer`) och
`vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT16)` (`glVertexArrayElementBuffer`). Vulkan har
ingen VAO: formatet bakas in i pipelinen, och buffrarna binds per ritning. (Vulkan lägger strided i
bindningsbeskrivningen i pipelinen; DSA lägger den hos buffern i `glVertexArrayVertexBuffer`.)
:::
:::d3d12
Den här uppdelningen är precis hur Direct3D beskriver vertexindata. *Formatet* är input layouten i pipeline
state-objektet – per element en semantik, ett format, en input slot och en förskjutning i byte:

```cpp
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };
```

– `glVertexArrayAttribFormat` (format, förskjutning) och `glVertexArrayAttribBinding` (input sloten). *Buffrarna* binds
per ritning med vyer som bär stride och storlek – `m_commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView)`
(`glVertexArrayVertexBuffer`) och `m_commandList->IASetIndexBuffer(&m_indexBufferView)` (`glVertexArrayElementBuffer`).
Direct3D 12 har ingen VAO: formatet bakas in i pipeline state-objektet, och buffrarna binds på command listen. (Vyn lägger
strided hos buffern, som `glVertexArrayVertexBuffer` gör.)
:::

```quiz
Med DSA ändras vertexarna till fem flyttal var (position och texturkoordinater) i samma buffer. Vilket anrop ändras när bara strided ändras?
- [ ] `glVertexArrayAttribFormat(VAO, 0, …)`: attribut 0:s format innehåller strided
- [x] `glVertexArrayVertexBuffer(VAO, 0, VBO, 0, sizeof(float) * 5)`: strided hör till bindningspunkten och dess buffer
- [ ] `glVertexArrayAttribBinding(VAO, 0, 0)`
- [ ] `glNamedBufferStorage`: strided är en del av bufferns minne
---
Attributformatet innehåller bara den relativa förskjutningen inuti en vertex; avståndet mellan vertexarna hör till bufferbindningen. Det är den uppdelning som `glVertexAttribPointer` blandade ihop.
```

## Texturer

Texturer får samma behandling, och här betyder oföränderligt minne ännu mer. `glTexImage2D` definierar en mip-nivå i
taget; en textur vars nivåer inte passar ihop (fel storlekar, olika format) är *ofullständig*, och drivrutinen kan bara
kontrollera det när den används. `glTextureStorage2D` allokerar **alla** nivåer på en gång, med ett format och fasta
storlekar – fullständig från början; bilden laddas sedan upp i nivå 0 med `glTextureSubImage2D`, och de andra nivåerna
genereras med `glGenerateTextureMipmap`. Antalet nivåer för en full mip-kedja är `1 + floor(log2(max(width, height)))` –
för containern på 256 × 256, 9: 256, 128, …, 1.

:::opengl
Den sista uppgiften går ett steg längre än learnopengls demo, till artikelns avsnitt om texturer: rektangeln får
containertexturen från kapitlet *Texturer*. Vertexarna får texturkoordinater – attribut 1, två flyttal, tre flyttal in i
varje vertex, lästa från samma bindningspunkt, vars stride växer till fem flyttal:

```cpp
    // attribute 1 = two floats 3 floats into each vertex, from the same binding point
    glEnableVertexArrayAttrib(VAO, 1);
    glVertexArrayAttribFormat(VAO, 1, 2, GL_FLOAT, GL_FALSE, 3 * sizeof(float));
    glVertexArrayAttribBinding(VAO, 1, 0);

    // Binding the VBO (to binding point 0, with the stride between vertices) and the element buffer to the VAO.
    glVertexArrayVertexBuffer(VAO, 0, VBO, 0, sizeof(float) * 5);
    glVertexArrayElementBuffer(VAO, EBO);
```

Texturen skapas och fylls utan en enda bindning:

```cpp
    GLuint texture = 0;
    glCreateTextures(GL_TEXTURE_2D, 1, &texture);
    // set the texture wrapping and filtering parameters
    glTextureParameteri(texture, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTextureParameteri(texture, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTextureParameteri(texture, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTextureParameteri(texture, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // load image, allocate immutable storage for all mip levels, upload level 0 and generate the mipmaps
    int width, height, nrChannels;
    stbi_set_flip_vertically_on_load(true); // tell stb_image.h to flip loaded texture's on the y-axis.
    unsigned char *data = stbi_load("container.png", &width, &height, &nrChannels, 0);
    if (data)
    {
        int levels = 1 + (int)std::floor(std::log2((float)std::max(width, height)));
        glTextureStorage2D(texture, levels, GL_RGB8, width, height);
        glTextureSubImage2D(texture, 0, 0, 0, width, height, GL_RGB, GL_UNSIGNED_BYTE, data);
        glGenerateTextureMipmap(texture);
    }
```

Lägg märke till de två sorternas format: `GL_RGB8` i `glTextureStorage2D` är det *interna* format texturen lagrar – ett
format med storlek krävs för oföränderligt minne – och `GL_RGB, GL_UNSIGNED_BYTE` i `glTextureSubImage2D` beskriver den
data du laddar upp. För ritningen ersätter ett enda anrop `glActiveTexture` + `glBindTexture`:

```cpp
        glBindTextureUnit(0, texture);
```

Fragment shaderns `uniform sampler2D texture1;` behåller sin standardenhet 0, så inget `glUniform1i` behövs. Vertex
shaderns sträng skickar vidare `aTexCoord` (location 1) som `TexCoord`, och fragment shadern returnerar
`texture(texture1, TexCoord)`. Ta bort texturen på slutet med `glDeleteTextures(1, &texture)`.

Gör nu den sista uppgiften, **texture**. Bygg och kör: trälådan sitter på rektangeln, rättvänd, med sin diagonala stötta
från nedre vänstra till övre högra hörnet.
:::
:::vulkan
I Vulkan har en textur alltid byggts så här. `vkCreateImage` skapar bilden med fast storlek, format och antal mip-nivåer –
oföränderligt minne, som `glTextureStorage2D`. Dess minne allokeras och kopplas separat, som för en buffer. Pixlarna kommer
via en staging buffer och `vkCmdCopyBufferToImage` – `glTextureSubImage2D` – och mip-nivåerna fylls, där ett program
vill ha dem, med `vkCmdBlitImage` från nivå till nivå (vulkan-tutorials kapitel *Generating Mipmaps*) –
`glGenerateTextureMipmap`. Och det finns inga texturenheter: en shader läser en textur via en **deskriptor** som namnger
bildvyn och samplern, skriven med `vkUpdateDescriptorSets` och bunden med `vkCmdBindDescriptorSets` – motsvarigheten till
`glBindTextureUnit(unit, texture)`, där descriptor setets bindning spelar enhetens roll. Projektet i kapitlet *Texturer*
har bilden, staging-kopian och deskriptorn; det här kapitlets projekt har ingen textur.
:::
:::d3d12
I Direct3D 12 har en textur alltid byggts så här. En textur är en `ID3D12Resource` skapad med fast storlek, format och
antal mip-nivåer – oföränderligt minne, som `glTextureStorage2D`. Pixlarna kommer via en upload-buffer och
`UpdateSubresources` (en kopiering på command listen) – `glTextureSubImage2D`. Direct3D 12 har ingen inbyggd
mipmap-generering: nivåerna räknas ut av programmet (till exempel med en compute shader) eller läses in med bilden. Och
det finns inga texturenheter: en shader läser en textur via en **deskriptor** – en shader resource view i en descriptor
heap – som root-signaturens descriptor table pekar på (`SetGraphicsRootDescriptorTable`) – motsvarigheten till
`glBindTextureUnit(unit, texture)`, där shaderregistret `t0` spelar enhetens roll. Projektet i kapitlet *Texturer* har
allt detta; det här kapitlets projekt har ingen textur.
:::

```quiz
Hur många mip-nivåer ger `1 + floor(log2(max(width, height)))` för en textur på 512 × 128?
- [ ] 8
- [ ] 7
- [x] 10
- [ ] 1: oföränderligt minne har en enda nivå om inte mipmaps genereras
---
log2(512) = 9, plus basnivån: 512, 256, … ned till 1 längs den längre sidan (den kortare sidan når 1 tidigare och stannar där). `glTextureStorage2D` allokerar alla; `glGenerateTextureMipmap` fyller dem.
```

## Andra objekt

Mönstret går igenom hela API:et. Framebuffers skapas med `glCreateFramebuffers` och ställs i ordning med
`glNamedFramebufferTexture(fbo, GL_COLOR_ATTACHMENT0, texture, 0)`, `glNamedFramebufferDrawBuffers` och
`glCheckNamedFramebufferStatus` – utan att bindas förrän du renderar i dem; `glClearNamedFramebufferfv` rensar en av deras
buffrar. Renderbuffers har `glCreateRenderbuffers` och `glNamedRenderbufferStorage`, queries `glCreateQueries`. För
shaderprogram kom ett liknande steg tidigare: sedan OpenGL 4.1 sätter `glProgramUniform*(program, location, …)` en
uniform i vilket program som helst, inte bara i det som gjorts aktuellt med `glUseProgram`.

## Närmare de explicita API:erna

Sammantaget för DSA OpenGL en bra bit mot de explicita API:erna:

| Idé | OpenGL med DSA | Vulkan | Direct3D 12 |
|---|---|---|---|
| Objekt namngivna i varje anrop | `glNamedBufferStorage(buffer, …)` | `vkBindBufferMemory(device, buffer, …)` | `m_vertexBuffer->Map(…)` |
| Fast storlek, ställs i ordning en gång | oföränderligt minne | `VkBuffer` / `VkImage` med fast storlek | resurs med fast storlek |
| Hur minnet används, sagt i förväg | minnesflaggor | flaggor för minnesegenskaper | heaptyp |
| Vertexformat skilt från buffrar | attributformat / bindning | beskrivningar av vertexindata i pipelinen | input layout i pipeline state-objektet |
| Att välja resurser för en ritning | `glBindTextureUnit`, `glBindVertexArray` | descriptor sets, `vkCmdBindVertexBuffers` | descriptor tables, `IASetVertexBuffers` |

Det DSA *inte* ändrar är resten av OpenGL:s modell: den globala tillståndsmaskinen (djuptest, blending, det bundna
programmet) sätts fortfarande anrop för anrop och gäller för varje följande ritning, drivrutinen bestämmer fortfarande när
arbetet når GPU:n och synkroniserar åt dig, och det finns inga command buffers som du spelar in själv. Vulkan och
Direct3D 12 skiljer sig även i de punkterna – pipeline state-objekt, uttrycklig inspelning av kommandon och
synkronisering – och DSA var aldrig tänkt att ändra dem. Det tar bort den del av OpenGL:s design som orsakade flest buggar
för minst nytta.

```quiz
Vilket av följande ändrar DSA INTE i OpenGL?
- [ ] Att en buffer måste bindas innan dess data kan sättas
- [ ] Att en textur måste bindas till en enhet innan dess parametrar kan sättas
- [x] Att renderingstillstånd som djuptest och blending är globalt tillstånd som gäller för varje följande ritning
- [ ] Att en VAO registrerar den element buffer som binds medan den är bunden
---
DSA handlar om att skapa och ändra objekt. Det globala renderingstillståndet, den underförstådda synkroniseringen och den drivrutinsstyrda inskickningen finns kvar – det är de skillnaderna som pipeline state-objekt och command buffers tar hand om i Vulkan och Direct3D 12.
```

## Mer att läsa

- [DSA](https://learnopengl.com/Guest-Articles/2021/DSA): learnopengls gästartikel som det här kapitlet följer.
- [hello_triangle_dsa.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2021/4.dsa/hello_triangle_dsa.cpp):
  learnopengls demo, rektangeln med DSA-buffrar och VAO.

:::opengl
- [glBufferStorage](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBufferStorage.xhtml): `glNamedBufferStorage`,
  oföränderligt minne och dess flaggor.
- [glVertexAttribFormat](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribFormat.xhtml): det separata
  attributformatet, med `glVertexArrayAttribFormat`.
- [glTexStorage2D](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexStorage2D.xhtml): oföränderligt
  texturminne, med `glTextureStorage2D`.
:::
:::vulkan
- [Vertex buffer creation](https://vulkan-tutorial.com/Vertex_buffers/Vertex_buffer_creation): vulkan-tutorial om
  `vkCreateBuffer`, minneskrav och `vkBindBufferMemory`.
- [Vertex input description](https://vulkan-tutorial.com/Vertex_buffers/Vertex_input_description): bindnings- och
  attributbeskrivningarna.
:::
:::d3d12
- [ID3D12Device::CreateCommittedResource](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12device-createcommittedresource):
  en resurs och dess minne i ett anrop.
- [D3D12_INPUT_ELEMENT_DESC](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_input_element_desc):
  input layoutens element.
:::
