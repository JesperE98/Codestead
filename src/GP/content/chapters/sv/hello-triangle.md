# Hello Triangle

I förra kapitlet rensade du fönstret till en färg. Nu ska du rita något i det: en triangel. Att rita en enda
triangel låter enkelt, men det berör nästan varje del av grafikpipelinen, så det här är ett av kursens längsta
kapitel. Ta god tid på dig. När du förstår hur den här triangeln hamnar på skärmen förstår du kärnan i varje program
i resten av kursen.

I ett 3D-program finns allt i ett tredimensionellt koordinatsystem, men skärmen (och ditt fönster) är en
tvådimensionell matris av pixlar. En stor del av det arbete som {{api}} gör är att omvandla 3D-koordinater till
2D-pixlar som får plats på skärmen. Det sköts av **grafikpipelinen** (graphics pipeline). Grafikpipelinen kan delas i två stora
delar: den första omvandlar dina 3D-koordinater till 2D-koordinater, den andra omvandlar 2D-koordinaterna till
faktiska färgade pixlar.

Som vanligt börjar projektet till höger med `// TODO:`-kommentarer som markerar var din kod ska in, och
**Bygg & kör** (Ctrl+Enter) kompilerar projektet och kör det i den inbyggda simulatorn. Tills du kommer till
uppgiften som ritar visar programmet bara det blågröna fönstret från förra kapitlet.

## Grafikpipelinen

Grafikpipelinen tar en lista med 3D-koordinater som indata och omvandlar dem till färgade 2D-pixlar på skärmen. Den
är uppdelad i flera steg, där varje steg tar föregående stegs utdata som indata. Varje steg är specialiserat på en
sak, och därför kan de lätt köras parallellt. Tack vare den parallella naturen har dagens grafikkort tusentals små
processorkärnor som kör små program för varje steg i pipelinen på GPU:n. De här små programmen kallas **shaders**.

En del av shaderna kan du skriva själv. Då kan du ersätta ett stegs standardbeteende med din egen kod, vilket ger
dig mycket finare kontroll över specifika delar av pipelinen – och eftersom shaders körs på GPU:n sparar de
CPU-tid. Shaders för {{api}} skrivs i {{shaderLanguage}}; mer om det i nästa avsnitt.

Här är en översikt över stegen, i den ordning datan flödar genom dem:

1. **Vertexindata.** Du skickar in en lista med tre 3D-koordinater som ska bilda en triangel: **vertexdatan**. En
   *vertex* är en samling data för en 3D-koordinat. Dess data består av *vertexattribut* som kan innehålla vilken
   data du vill; just nu har varje vertex bara en 3D-position.
2. **Vertex shader.** Det första programmerbara steget. Den körs en gång per vertex och omvandlar 3D-koordinaten
   till en annan 3D-koordinat (mer om det senare). Den kan också göra enkel bearbetning av vertexattributen.
3. **Geometry shader** (valfri). Den tar emot en samling vertexar som bildar en primitiv och kan skapa andra former
   genom att lägga till nya vertexar. Du använder ingen i kursens första kapitel.
4. **Primitive assembly** (learnopengl kallar det *shape assembly*). Tar vertexarna och sätter ihop dem till den
   primitiva form du bett om – i det här kapitlet trianglar. För att veta vad den ska göra av koordinaterna behöver
   pipelinen en ledtråd: bildar de punkter, linjer eller trianglar?
5. **Rasterisering.** Avbildar primitiverna på motsvarande pixlar på skärmen och skapar **fragment**. Ett fragment
   är all data som behövs för att rendera en enda pixel. Innan fragment shaders körs kastar *clipping* bort allt som
   ligger utanför det synliga området.
6. **Fragment shader.** Körs en gång per fragment och räknar ut dess slutliga färg. Det är oftast här alla avancerade
   effekter händer: senare använder fragment shadern scenens ljus, skuggor och texturer för att räkna ut färgen.
7. **Tester och blending.** Kontrollerar fragmentets djupvärde (och stencilvärde) för att avgöra om fragmentet
   ligger framför eller bakom andra objekt och ska behållas, och blandar det med färgen som redan finns i
   framebuffern (för genomskinlighet). Så även om en fragment shader har räknat ut en färg kan den slutliga
   pixelfärgen bli en annan.

Alla API:er har de här stegen, men de heter lite olika:

| Steg | OpenGL | Vulkan | Direct3D 12 |
|---|---|---|---|
| Läsa vertexdatan | vertex specification (VAO) | input assembler | input assembler (IA) |
| Per vertex | vertex shader | vertex shader | vertex shader (VS) |
| Valfritt | geometry shader | tessellation- och geometry shaders | hull/domain shaders (tessellering), geometry shader (GS) |
| Bygga primitiver | shape assembly | input assembly (topologi) | primitive topology (IA) |
| Göra primitiver till pixlar | rasterisering | rasterisering | rasterizer (RS) |
| Per pixel | fragment shader | fragment shader | pixel shader (PS) |
| Djup-/stenciltester och blending | tester och blending | djup-/stenciltester och color blending | output merger (OM) |

:::opengl
Som du ser är grafikpipelinen ganska komplex och har många delar som går att konfigurera. I nästan alla fall du
kommer att möta behöver du bara arbeta med vertex shadern och fragment shadern; geometry shadern är valfri och
brukar lämnas åt sitt standardbeteende. I modern OpenGL **måste** du definiera åtminstone en egen vertex shader och
en egen fragment shader – det finns inga standardshaders på GPU:n. Därför är modern OpenGL ofta svårare i början:
det krävs mycket kunskap innan du kan rendera din första triangel. När du väl har den förstår du grafikprogrammering
mycket bättre.
:::
:::vulkan
I Vulkan är hela pipelinen ett enda objekt: en `VkPipeline`. Du skriver vertex shadern och fragment shadern, och du
beskriver varje steg med fast funktion (input assembly, rasterisering, blending …) i strukturer. Nästan allt är
låst när pipelinen väl är skapad: vill du ha en annan shader eller en annan rasterizer-inställning skapar du en
annan pipeline. Det låter strikt, men det låter drivrutinen optimera allt i förväg – ingenting behöver kontrolleras
eller kompileras om medan du ritar. I gengäld behöver Vulkan mer kod än OpenGL innan den första triangeln syns: det
här kapitlet har nio uppgifter.
:::
:::d3d12
Lägg märke till att Direct3D 12:s command list-metoder är uppkallade efter stegen: `IASetVertexBuffers` (input
assembler), `RSSetViewports` (rasterizer), `OMSetRenderTargets` (output merger). Direct3D kallar fragment shadern
för **pixel shader**. Precis som Vulkan samlar Direct3D 12 shaderna och nästan alla inställningar för de fasta
funktionerna i ett objekt, **pipeline state object** (PSO), som skapas en gång och sedan bara slås på. Du skriver
vertex shadern och pixel shadern själv, i HLSL.
:::

```quiz
Vilket steg omvandlar en triangel till de fragment (pixlarna som ska färgas) som den täcker?
- [x] Rasteriseringen
- [ ] Vertex shadern
- [ ] Blendingen
---
Vertex shadern arbetar bara med hörnen. Rasteriseringen räknar ut vilka pixlar triangeln täcker och skapar ett fragment för var och en; fragment shadern färgar sedan varje fragment.
```

## Vertexindata

För att börja rita något måste du först ge {{api}} lite vertexdata som indata. {{api}} är ett 3D-grafikbibliotek,
så alla koordinater du anger är 3D-koordinater (x, y och z). Det omvandlar inte helt enkelt *alla* dina
3D-koordinater till pixlar på skärmen: det bearbetar bara 3D-koordinater som ligger inom ett visst intervall mellan
`-1.0` och `1.0` på alla tre axlarna (i Vulkan och Direct3D går z från `0.0` till `1.0`; det spelar ingen roll här
eftersom alla våra z-värden är `0.0`). Alla koordinater inom det här intervallet, **normalized device coordinates**
(NDC), syns på skärmen; allt utanför klipps bort.

Eftersom du vill rendera en enda triangel anger du totalt tre vertexar, var och en med en 3D-position. Du definierar
dem i normalized device coordinates (det synliga området), med z = 0 så att triangeln ser 2D ut: den har inget djup.

:::opengl
```cpp
float vertices[] = {
    -0.5f, -0.5f, 0.0f, // left
     0.5f, -0.5f, 0.0f, // right
     0.0f,  0.5f, 0.0f  // top
};
```

I OpenGL:s normalized device coordinates är (0, 0) fönstrets mitt, x växer åt höger och **y växer uppåt**. Så
`(0.0, 0.5)` är det övre hörnet, halvvägs mellan mitten och överkanten. Till skillnad från vanliga
skärmkoordinater pekar den positiva y-axeln uppåt.
:::
:::vulkan
```cpp
const std::vector<Vertex> vertices = {
    {{0.0f, -0.5f, 0.0f}},
    {{0.5f, 0.5f, 0.0f}},
    {{-0.5f, 0.5f, 0.0f}}
};
```

Varje element är en `Vertex`, en struct med en `glm::vec3 pos` (du skriver den i avsnittet *Koppla ihop
vertexattribut*). I Vulkans normalized device coordinates är (0, 0) fönstrets mitt och x växer åt höger – men
**y pekar nedåt**: `y = -1` är överkanten och `y = 1` nederkanten, som pixelkoordinater i en bild. Om du har sett
OpenGL är tecknet på y omvänt. Därför är triangeln spegelvänd jämfört med learnopengls: det övre hörnet är
`(0.0, -0.5)`, och de två nedre hörnen har `y = 0.5`.

Även vertexarnas ordning spelar roll: överst, nere till höger, nere till vänster går **medurs** på skärmen. Senare
talar du om för rasterizern att medurs trianglar är framsidor och att baksidor ska cullas (inte ritas). Om du bara
vände tecknet på y i learnopengls lista och behöll dess ordning (vänster, höger, överst) skulle triangeln gå moturs
på skärmen och försvinna.
:::
:::d3d12
```cpp
Vertex vertices[] =
{
    { { 0.0f, 0.5f, 0.0f } },
    { { 0.5f, -0.5f, 0.0f } },
    { { -0.5f, -0.5f, 0.0f } }
};
```

`Vertex` är redan deklarerad i klassen: `struct Vertex { XMFLOAT3 position; };`, tre floats per vertex. Direct3D:s
normalized device coordinates är som OpenGL:s: (0, 0) är mitten, x växer åt höger och **y växer uppåt**, så
`(0.0, 0.5)` är det övre hörnet.

Men lägg märke till ordningen: överst, nere till höger, nere till vänster – inte learnopengls vänster, höger,
överst. På skärmen går den här ordningen **medurs**. Direct3D:s standardinställning för rasterizern räknar medurs
trianglar som framsidor och *cullar* (ritar inte) baksidorna. learnopengls ordning är moturs, så i Direct3D 12 skulle
den triangeln helt enkelt saknas. Du ser rasterizer-inställningarna i avsnittet *Koppla ihop vertexattribut*.
:::

Dina normalized device coordinates omvandlas sedan till **skärmkoordinater** (screen-space coordinates) via
*viewport-transformen*, med den viewport du ger API:t. Fönstret i den här kursen är 800×600 pixlar och viewporten
täcker hela fönstret, så triangelns hörn hamnar på pixlarna (400, 150), (600, 450) och (200, 450), räknat från
fönstrets övre vänstra hörn. Skärmkoordinaterna omvandlas sedan till fragment som blir indata till din fragment
shader.

```quiz
Fönstret är 800×600 och viewporten täcker hela det. Vilken av de här vertexpositionerna ligger utanför det synliga området?
- [ ] (0.9, -0.9, 0.0)
- [ ] (0.0, 0.0, 0.0)
- [x] (1.2, 0.0, 0.0)
---
Bara koordinater mellan -1.0 och 1.0 ligger inom normalized device coordinates; x = 1.2 ligger till höger om fönstrets kant och klipps bort. (0, 0) är fönstrets mitt.
```

### Vertex buffer objects

När vertexdatan är definierad vill du skicka den som indata till pipelinens första steg: vertex shadern. Det betyder
att skapa minne på GPU:n där du lagrar vertexdatan, tala om för API:t hur minnet ska tolkas och ange hur datan ska
skickas till grafikkortet. Att skicka data från CPU:n till grafikkortet är relativt långsamt, så du försöker skicka
så mycket data som möjligt på en gång – och låta den ligga kvar. När datan väl finns i grafikkortets minne har
vertex shadern nästan omedelbar tillgång till vertexarna.

:::opengl
Det här minnet hanteras av ett **vertex buffer object** (VBO), som kan lagra ett stort antal vertexar i GPU:ns
minne. Som alla objekt i OpenGL har bufferten ett unikt ID, som du skapar med `glGenBuffers`:

```cpp
unsigned int VBO;
glGenBuffers(1, &VBO);
```

OpenGL har många typer av bufferobjekt, och bufferttypen för ett vertex buffer object är `GL_ARRAY_BUFFER`. Du kan
binda flera buffertar samtidigt så länge de har olika typer. Bind den nya bufferten till målet `GL_ARRAY_BUFFER` med
`glBindBuffer`:

```cpp
glBindBuffer(GL_ARRAY_BUFFER, VBO);
```

Från och med nu konfigurerar varje buffertanrop du gör på målet `GL_ARRAY_BUFFER` den bundna bufferten, `VBO`. Nu
kopierar `glBufferData` vertexdatan till buffertens minne:

```cpp
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
```

`glBufferData` är en funktion som är gjord för att kopiera data från programmet till den bundna bufferten. Det
första argumentet är typen av buffert du vill kopiera till: det vertex buffer object som är bundet till
`GL_ARRAY_BUFFER`. Det andra argumentet är datans storlek i byte; en enkel `sizeof` av vertexdatan räcker. Det
tredje argumentet är själva datan.

Det fjärde argumentet talar om för grafikkortet hur du tänker använda datan:

- `GL_STREAM_DRAW`: datan sätts bara en gång och används av GPU:n högst några få gånger.
- `GL_STATIC_DRAW`: datan sätts bara en gång och används många gånger.
- `GL_DYNAMIC_DRAW`: datan ändras ofta och används många gånger.

Triangelns position ändras inte, används mycket och är densamma vid varje renderingsanrop, så den bästa typen är
`GL_STATIC_DRAW`. Om datan troligen skulle ändras ofta skulle `GL_DYNAMIC_DRAW` låta drivrutinen lägga den i minne
som tillåter snabbare skrivningar.

I slutet av programmet ska allt du skapat tas bort igen. Projektet har en städsektion i slutet av `main` för det:
`glDeleteBuffers(1, &VBO);`.

Gör nu den första uppgiften: lägg de tre vertexarna i `float vertices[]`, skapa VBO:n, bind den och fyll den med
`glBufferData`, och ta bort den i städsektionen. Bygg & kör: ingenting ändras än – datan ligger på GPU:n, men
ingenting använder den.
:::
:::vulkan
I Vulkan är en buffert en `VkBuffer`: ett minnesområde som grafikkortet kan läsa. Till skillnad från i OpenGL
allokerar en buffert inte sitt eget minne: du skapar buffertobjektet, frågar vilken sorts minne den behöver,
allokerar minnet själv (ett `VkDeviceMemory`) och binder det till bufferten. Det är vad `createVertexBuffer()` gör:

```cpp
void createVertexBuffer() {
    VkBufferCreateInfo bufferInfo{};
    bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
    bufferInfo.size = sizeof(vertices[0]) * vertices.size();
    bufferInfo.usage = VK_BUFFER_USAGE_VERTEX_BUFFER_BIT;
    bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

    if (vkCreateBuffer(device, &bufferInfo, nullptr, &vertexBuffer) != VK_SUCCESS) {
        throw std::runtime_error("failed to create vertex buffer!");
    }
```

`size` är buffertens storlek i byte. `usage` anger vad bufferten ska användas till – här som vertexbuffert. Precis
som swap chainens bilder kan en buffert ägas av en köfamilj eller delas mellan flera; den används bara av
grafikkön, så `VK_SHARING_MODE_EXCLUSIVE` är rätt.

Bufferten är skapad, men inget minne är kopplat till den än. `vkGetBufferMemoryRequirements` talar om vad bufferten
behöver: sin storlek i byte (som kan skilja sig från `bufferInfo.size`), sin alignment och `memoryTypeBits`, ett
bitfält med de minnestyper som passar:

```cpp
    VkMemoryRequirements memRequirements;
    vkGetBufferMemoryRequirements(device, vertexBuffer, &memRequirements);

    VkMemoryAllocateInfo allocInfo{};
    allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
    allocInfo.allocationSize = memRequirements.size;
    allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT);

    if (vkAllocateMemory(device, &allocInfo, nullptr, &vertexBufferMemory) != VK_SUCCESS) {
        throw std::runtime_error("failed to allocate vertex buffer memory!");
    }

    vkBindBufferMemory(device, vertexBuffer, vertexBufferMemory, 0);
```

Grafikkort erbjuder olika typer av minne, som skiljer sig i vilka operationer som är tillåtna och i prestanda. Du
behöver minne som CPU:n kan skriva till: `VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT` betyder att du kan mappa in det i
CPU:ns adressrymd, och `VK_MEMORY_PROPERTY_HOST_COHERENT_BIT` betyder att det du skriver där syns för GPU:n utan
någon explicit flush. `findMemoryType` väljer en minnestyp som både är tillåten för bufferten och har de här
egenskaperna:

```cpp
uint32_t findMemoryType(uint32_t typeFilter, VkMemoryPropertyFlags properties) {
    VkPhysicalDeviceMemoryProperties memProperties;
    vkGetPhysicalDeviceMemoryProperties(physicalDevice, &memProperties);

    for (uint32_t i = 0; i < memProperties.memoryTypeCount; i++) {
        if ((typeFilter & (1 << i)) && (memProperties.memoryTypes[i].propertyFlags & properties) == properties) {
            return i;
        }
    }

    throw std::runtime_error("failed to find suitable memory type!");
}
```

Bit `i` i `typeFilter` är satt om minnestyp `i` passar bufferten, och `(propertyFlags & properties) == properties`
kontrollerar att typen har *alla* egenskaper du bad om, inte bara en av dem.

Till sist kopierar du vertexdatan till bufferten: `vkMapMemory` ger dig en CPU-pekare till minnet, `memcpy` kopierar
vertexarna och `vkUnmapMemory` släpper pekaren igen:

```cpp
    void* data;
    vkMapMemory(device, vertexBufferMemory, 0, bufferInfo.size, 0, &data);
        memcpy(data, vertices.data(), (size_t) bufferInfo.size);
    vkUnmapMemory(device, vertexBufferMemory);
}
```

Tack vare det koherenta minnet är datan garanterat framme hos GPU:n nästa gång du skickar arbete med
`vkQueueSubmit`. Minne som CPU:n ser är inte det snabbaste minnet för GPU:n att läsa; vulkan-tutorial förbättrar
det senare med en *staging buffer* som kopierar datan till device-local-minne. För tre vertexar räcker
host-visible-minne gott.

Bufferten och dess minne är medlemmar i klassen (`VkBuffer vertexBuffer;` och `VkDeviceMemory vertexBufferMemory;`),
`createVertexBuffer()` anropas i `initVulkan()` efter `createCommandPool()`, och `cleanup()` förstör båda:

```cpp
vkDestroyBuffer(device, vertexBuffer, nullptr);
vkFreeMemory(device, vertexBufferMemory, nullptr);
```

Du skriver den här koden i den sjätte uppgiften, efter grafikpipelinen, i samma ordning som vulkan-tutorial. Först
kommer shaderna.
:::
:::d3d12
I Direct3D 12 är GPU-minne en **resurs** (`ID3D12Resource`). Det enklaste sättet att skapa en buffert är en
*committed resource*: en resurs tillsammans med sitt eget minne (heap). Vilken sorts heap väljer du med
`CD3DX12_HEAP_PROPERTIES`: en **upload heap** (`D3D12_HEAP_TYPE_UPLOAD`) är minne som CPU:n kan skriva till och
GPU:n kan läsa från. `CD3DX12_RESOURCE_DESC::Buffer` beskriver en buffert med den angivna storleken i byte:

```cpp
const UINT vertexBufferSize = sizeof(vertices);

// Note: using upload heaps to transfer static data like vert buffers is not
// recommended. Every time the GPU needs it, the upload heap will be marshalled
// over. Please read up on Default Heap usage. An upload heap is used here for
// code simplicity and because there are very few verts to actually transfer.
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

En resurs i en upload heap måste börja i tillståndet `D3D12_RESOURCE_STATE_GENERIC_READ`, tillståndet där GPU:n får
läsa den. `nullptr` är ett optimerat clear-värde, som bara render targets och djupbuffertar använder. Som
kommentaren från Microsofts exempel säger är en upload heap inte det bästa stället för data som aldrig ändras: GPU:n
läser den över bussen varje gång. Riktiga program kopierar sådan data till en *default heap* (GPU-minne); för tre
vertexar håller upload heapen koden enkel.

Sedan kopierar du vertexarna till bufferten. `Map` ger dig en CPU-pekare till resursens minne:

```cpp
// Copy the vertex data to the vertex buffer.
UINT8* pVertexDataBegin = nullptr;
CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
ThrowIfFailed(m_vertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
memcpy(pVertexDataBegin, vertices, sizeof(vertices));
m_vertexBuffer->Unmap(0, nullptr);
```

Det tomma läsintervallet `(0, 0)` talar om för Direct3D att CPU:n inte kommer att läsa från minnet.
`Unmap(0, nullptr)` säger att hela bufferten kan ha skrivits.

Microsofts exempel skriver `&CD3DX12_HEAP_PROPERTIES(D3D12_HEAP_TYPE_UPLOAD)` direkt i anropet. Att ta adressen till
ett temporärt objekt på det sättet kompilerar bara med Visual C++, så det här projektet har båda beskrivningarna i
lokala variabler. Allt detta hamnar i ett block i `LoadAssets` (efter att command listen skapats); du skriver det i
den femte uppgiften, tillsammans med den *vertex buffer view* som du möter i avsnittet *Vertex Array Object*.
:::

## Vertex shader

Vertex shadern är en av de shaders du kan programmera själv. Modern grafik kräver åtminstone en vertex shader och
en fragment shader för att rendera något, så nu skriver du båda, i sin enklaste form, och förbereder dem för att
rita triangeln. Nästa kapitel går igenom shaders mycket mer i detalj.

:::opengl
Det första du gör är att skriva vertex shadern i shaderspråket **GLSL** (OpenGL Shading Language). Här är
källkoden till en mycket enkel vertex shader:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

void main()
{
    gl_Position = vec4(aPos.x, aPos.y, aPos.z, 1.0);
}
```

GLSL liknar C. Varje shader börjar med en deklaration av sin version. Sedan OpenGL 3.3 stämmer GLSL:s
versionsnummer med OpenGL:s (GLSL 330 för OpenGL 3.3), och `core` säger att du använder core-profilen.

Därefter deklarerar du alla vertexattribut som ska in, med nyckelordet `in`. Just nu bryr du dig bara om
positionen, så du behöver ett enda attribut. GLSL har en vektortyp med 1 till 4 floats; eftersom varje vertex har en
3D-koordinat deklarerar du en `vec3` som heter `aPos`. `layout (location = 0)` sätter indatavariabelns *location* –
du ser senare varför du behöver den.

> En vektor i grafikprogrammering är ett matematiskt begrepp: en position eller riktning i ett rum, med användbara
> matematiska egenskaper. I GLSL har en vektor högst 4 komponenter, som du når med `vec.x`, `vec.y`, `vec.z` och
> `vec.w`. Komponenten `w` används inte som position i rummet (vi arbetar i 3D, inte 4D) utan till något som
> kallas *perspektivdivision*, som kommer i ett senare kapitel.

För att sätta vertex shaderns utdata tilldelar du positionen till den fördefinierade variabeln `gl_Position`, en
`vec4`. I slutet av `main` är det `gl_Position` innehåller vertex shaderns utdata. Indatan är en `vec3`, så du
bygger en `vec4` av den med `w` satt till `1.0`.

Den här vertex shadern är ungefär den enklaste tänkbara: den bearbetar ingenting utan skickar bara vidare indatan.
I riktiga program är indatan oftast inte i normalized device coordinates än, så vertex shadern måste först
transformera den – det kommer i senare kapitel.

I det här projektet ligger shaderns källkod som en C-sträng överst i `main.cpp`, `vertexShaderSource`:

```cpp
const char *vertexShaderSource = "#version 330 core\n"
    "layout (location = 0) in vec3 aPos;\n"
    "void main()\n"
    "{\n"
    "   gl_Position = vec4(aPos.x, aPos.y, aPos.z, 1.0);\n"
    "}\0";
```
:::
:::vulkan
Vulkans shaders skrivs också i **GLSL**, men med några skillnader mot OpenGL. Projektets vertex shader är filen
`shaders/shader.vert`:

```glsl
#version 450

layout(location = 0) in vec3 inPosition;

void main() {
    gl_Position = vec4(inPosition, 1.0);
}
```

`#version 450` är GLSL-versionen (den från OpenGL 4.5), den som vulkan-tutorial använder. Indatan `inPosition` är
ett vertexattribut: en `vec3`, ett värde per vertex, som läses från vertexbufferten. I Vulkan måste varje in- och
utdata ha en uttrycklig `location` – det finns inget sätt att slå upp variabelnamn medan programmet körs, som i
OpenGL. `location = 0` är hur attributbeskrivningen du skriver i *Koppla ihop vertexattribut* hittar den här
indatan.

`main` körs en gång för varje vertex. Den skriver positionen till den inbyggda utdatan `gl_Position`, en `vec4` i
*clip coordinates*. GPU:n delar clip coordinates med deras sista komponent, `w`, för att få normalized device
coordinates – med `w = 1.0` ändrar det ingenting, så positionerna från vertexbufferten kommer fram oförändrade i
normalized device coordinates. (vulkan-tutorial börjar med positionerna hårdkodade i shadern och lägger till en
vertexbuffert först senare; det här projektet använder en vertexbuffert från början, som learnopengl.)
:::
:::d3d12
Direct3D:s shaders skrivs i **HLSL** (High-Level Shading Language). Projektets båda shaders ligger i en fil,
`shaders.hlsl`. Här är vertex shadern:

```hlsl
// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = position;

    return result;
}
```

HLSL liknar C, med vektortyper som `float3` och `float4`. Till skillnad från GLSL är shaderns in- och utdata vanliga
funktionsparametrar och returvärden, och var och en har en **semantik** (semantic) efter kolonet: ett namn som säger
vad värdet betyder.

- `POSITION` är ett namn du väljer. Det kopplar parametern `position` till vertexdatan: *input layouten*, som du
  skapar i *Koppla ihop vertexattribut*, beskriver ett element med semantiknamnet `"POSITION"`, och det är så datan
  hittar den här parametern.
- `SV_POSITION` är en *system-value*-semantik (`SV_`): den har en fast betydelse för pipelinen. Vertex shadern måste
  lämna ifrån sig positionen i *clip coordinates* med den här semantiken, så att rasterizern vet var vertexen finns
  på skärmen.

Vertexbufferten innehåller tre floats per vertex, men parametern är en `float4`: input assemblern fyller i den
saknade komponenten `w` med `1.0`. GPU:n delar clip coordinates med `w` för att få normalized device coordinates, så
med `w = 1.0` kommer positionerna fram oförändrade. Structen heter `PSInput` eftersom pixel shadern tar emot den.

Gör nu den första uppgiften: skriv `PSInput` och `VSMain` i `shaders.hlsl`. Ingenting ändras i bilden än – shaderna
kompileras först när pipelinen skapas.
:::

## Kompilera en shader

:::opengl
Du har vertex shaderns källkod i en C-sträng, men för att OpenGL ska kunna använda shadern måste den kompilera den
från källkoden medan programmet körs. Det första du gör är att skapa ett shaderobjekt, som också refereras med ett
ID. Spara vertex shadern som en `unsigned int` och skapa den med `glCreateShader`:

```cpp
unsigned int vertexShader = glCreateShader(GL_VERTEX_SHADER);
```

Argumentet är vilken typ av shader du vill skapa; för en vertex shader är det `GL_VERTEX_SHADER`. Sedan kopplar du
källkoden till shaderobjektet och kompilerar det:

```cpp
glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);
glCompileShader(vertexShader);
```

`glShaderSource` tar shaderobjektet, antalet strängar du skickar som källkod (en), själva källkoden och en array med
stränglängder, som du kan lämna som `NULL` eftersom strängarna är nollterminerade.

Du vill förmodligen kontrollera om kompileringen lyckades, och om inte, vilka fel som hittades, så att du kan rätta
dem:

```cpp
int success;
char infoLog[512];
glGetShaderiv(vertexShader, GL_COMPILE_STATUS, &success);
if (!success)
{
    glGetShaderInfoLog(vertexShader, 512, NULL, infoLog);
    std::cout << "ERROR::SHADER::VERTEX::COMPILATION_FAILED\n" << infoLog << std::endl;
}
```

Först definierar du ett heltal för resultatet och en buffert för felmeddelandena (om det blir några).
`glGetShaderiv` med `GL_COMPILE_STATUS` talar om ifall kompileringen lyckades. Om den misslyckades hämtar
`glGetShaderInfoLog` felmeddelandet och du skriver ut det. Shaderfel stoppar inte programmet: utan den här
kontrollen syns ett stavfel i en shader bara som en triangel som saknas.

Gör nu den andra uppgiften: skriv `vertexShaderSource` överst i `main.cpp`, skapa och kompilera sedan vertex shadern
med felkontrollen (där TODO-kommentaren i `main` säger). Bygg & kör: inget fel ska skrivas ut.
:::
:::vulkan
OpenGL kompilerar GLSL medan programmet körs, inne i drivrutinen. Det gör inte Vulkan: det tar bara emot shaders i
**SPIR-V**, ett binärt mellanspråk. Du kompilerar din GLSL till SPIR-V *innan* programmet körs, med en kompilator
som `glslc`, som följer med Vulkan SDK:

```text
glslc shaders/shader.vert -o shaders/vert.spv
glslc shaders/shader.frag -o shaders/frag.spv
```

Fördelen är att drivrutinen inte behöver en egen fullständig GLSL-kompilator (varje tillverkares kompilator brukade
godta lite olika GLSL), och att syntaxfel syns när du bygger, inte när programmet körs. I det här projektet
kompilerar **Bygg & kör** båda shaderfilerna till `shaders/vert.spv` och `shaders/frag.spv` åt dig innan det bygger
`main.cpp`; ett fel i en shader rapporteras i utdatan som vilket kompileringsfel som helst.

När programmet körs laddar det bytekoden med en liten hjälpfunktion, `readFile`:

```cpp
static std::vector<char> readFile(const std::string& filename) {
    std::ifstream file(filename, std::ios::ate | std::ios::binary);

    if (!file.is_open()) {
        throw std::runtime_error("failed to open file!");
    }

    size_t fileSize = (size_t) file.tellg();
    std::vector<char> buffer(fileSize);

    file.seekg(0);
    file.read(buffer.data(), fileSize);

    file.close();

    return buffer;
}
```

`std::ios::binary` läser filen som byte (ingen textkonvertering), och `std::ios::ate` börjar läsa i slutet av
filen: läspositionen, `tellg()`, är då filens storlek, så att du kan allokera bufferten. Sedan går den tillbaka till
början och läser alla byte på en gång.

Innan koden kan ges till pipelinen måste den slås in i en `VkShaderModule`:

```cpp
VkShaderModule createShaderModule(const std::vector<char>& code) {
    VkShaderModuleCreateInfo createInfo{};
    createInfo.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
    createInfo.codeSize = code.size();
    createInfo.pCode = reinterpret_cast<const uint32_t*>(code.data());

    VkShaderModule shaderModule;
    if (vkCreateShaderModule(device, &createInfo, nullptr, &shaderModule) != VK_SUCCESS) {
        throw std::runtime_error("failed to create shader module!");
    }

    return shaderModule;
}
```

`codeSize` anges i byte, men `pCode` är en pekare till `uint32_t`, eftersom SPIR-V består av 32-bitars ord – därav
`reinterpret_cast`. (Datan i en `std::vector` allokeras med en alignment som räcker för `uint32_t`.) En
shadermodul är bara ett tunt skal runt bytekoden: den egentliga kompileringen till GPU:ns maskinkod sker senare, när
grafikpipelinen skapas.
:::
:::d3d12
HLSL kan kompileras innan programmet körs (med kompilatorerna `fxc` eller `dxc`) eller medan det körs. Microsofts
exempel HelloTriangle, och det här projektet, kompilerar medan programmet körs med `D3DCompileFromFile`, i början av
blocket som skapar pipeline state i `LoadAssets`:

```cpp
ComPtr<ID3DBlob> vertexShader;
ComPtr<ID3DBlob> pixelShader;

#if defined(_DEBUG)
// Enable better shader debugging with the graphics debugging tools.
UINT compileFlags = D3DCOMPILE_DEBUG | D3DCOMPILE_SKIP_OPTIMIZATION;
#else
UINT compileFlags = 0;
#endif

// Compile the vertex shader (VSMain) and the pixel shader (PSMain) in shaders.hlsl.
ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));
```

Argumenten är: filnamnet (som letas upp i arbetskatalogen), makrodefinitioner och en include-hanterare (inga),
**ingångspunkten** (entry point) – funktionen som ska kompileras, eftersom en fil kan innehålla flera shaders – och
**målprofilen** (target profile): `vs_5_0` är en vertex shader för shader model 5.0, `ps_5_0` en pixel shader. Sedan
kommer kompileringsflaggorna (i debug-byggen: debuginformation och ingen optimering, vilket hjälper grafikdebuggrar),
effektflaggor (oanvända), utdatan och en valfri blob för kompilatorns felmeddelanden.

Resultatet är bytekod i en `ID3DBlob`, ett enkelt minnesblock. Om HLSL-koden har ett fel returnerar
`D3DCompileFromFile` en felkod och `ThrowIfFailed` stoppar programmet med den HRESULT:en. (Exemplet skickar
`nullptr` som fel-blob; skicka en `ComPtr<ID3DBlob>` där om du vill skriva ut kompilatorns meddelande.) Bytekoden är
ännu inte kod för din GPU: drivrutinen översätter den när pipeline state-objektet skapas. Du skriver de här raderna i
den fjärde uppgiften, tillsammans med resten av pipeline state.
:::

:::opengl
```quiz
När kompileras GLSL-koden i `vertexShaderSource`?
- [x] Medan programmet körs, av OpenGL-drivrutinen, när programmet anropar `glCompileShader`
- [ ] När C++-projektet byggs
- [ ] Första gången `glDrawArrays` anropas
---
Shadern är bara en sträng i ditt program. OpenGL kompilerar den medan programmet körs, och därför kontrollerar du `GL_COMPILE_STATUS` själv.
```
:::
:::vulkan
```quiz
Vad får `vkCreateShaderModule` från programmet?
- [x] SPIR-V-bytekod, kompilerad från GLSL innan programmet körs
- [ ] GLSL-källkod, som drivrutinen kompilerar
- [ ] HLSL-källkod
---
Vulkan tar bara emot SPIR-V. GLSL-filerna kompileras till `vert.spv` och `frag.spv` när du bygger, och `readFile` laddar den bytekoden.
```
:::
:::d3d12
```quiz
När kompileras `VSMain` och `PSMain` i det här projektet?
- [ ] När C++-projektet byggs
- [ ] Av drivrutinen, vid första `DrawInstanced`
- [x] Medan programmet körs, av `D3DCompileFromFile` i `LoadAssets`
---
`D3DCompileFromFile` läser `shaders.hlsl` medan programmet körs och returnerar bytekod. Drivrutinen gör om bytekoden till GPU-kod när pipeline state-objektet skapas.
```
:::

## Fragment shader

Fragment shadern är den andra och sista shadern du behöver för att rendera en triangel. Den handlar helt om att
räkna ut färgen på dina pixlar. För att hålla det enkelt ger den alltid en orange färg.

Färger i datorgrafik representeras som en array med 4 värden: rött, grönt, blått och alfa (opacitet), oftast
förkortat RGBA. Varje komponent är ett värde mellan `0.0` och `1.0`. Till exempel ger rött `1.0` och grönt `1.0`
tillsammans gult. Med de tre färgkomponenterna kan du blanda över 16 miljoner olika färger. Den orange färgen här är
`(1.0, 0.5, 0.2)` med alfa `1.0` (helt ogenomskinlig).

:::opengl
```glsl
#version 330 core
out vec4 FragColor;

void main()
{
    FragColor = vec4(1.0f, 0.5f, 0.2f, 1.0f);
}
```

Fragment shadern behöver bara en utdatavariabel: en `vec4` med den slutliga färgen, som du deklarerar med
nyckelordet `out` och kallar `FragColor`. Sedan tilldelar du den en `vec4` med färgen orange och alfa `1.0`.

Att kompilera fragment shadern går till precis som för vertex shadern, men med shadertypen `GL_FRAGMENT_SHADER`:

```cpp
unsigned int fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
glCompileShader(fragmentShader);
```

Kontrollera fel på samma sätt, med `success` och `infoLog` igen, och skriv ut
`ERROR::SHADER::FRAGMENT::COMPILATION_FAILED` om det misslyckas.

Gör nu den tredje uppgiften: skriv `fragmentShaderSource` överst i `main.cpp` och kompilera fragment shadern med
felkontrollen.
:::
:::vulkan
Fragment shadern är filen `shaders/shader.frag`:

```glsl
#version 450

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(1.0, 0.5, 0.2, 1.0);
}
```

`main` anropas för varje fragment. Till skillnad från i vertex shadern finns ingen inbyggd utdatavariabel för
färgen: du deklarerar din egen utdata, och `layout(location = 0)` säger att den skrivs till framebufferns
attachment med index 0 – color attachmenten i den render pass du skapade i förra kapitlet.

Gör nu den första uppgiften: skriv båda shaderna, `shader.vert` och `shader.frag` (raderna `#version 450` och tomma
`main`-funktioner finns redan). Bygg & kör kompilerar dem till SPIR-V; fönstret visar fortfarande bara blågrönt,
eftersom programmet inte laddar dem än.
:::
:::d3d12
I HLSL kallas fragment shadern **pixel shader**. Den är den andra funktionen i `shaders.hlsl`:

```hlsl
// The pixel shader: runs once per pixel the triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(1.0f, 0.5f, 0.2f, 1.0f);
}
```

Den tar emot den `PSInput` som vertex shadern returnerade – efter rasteriseringen, så `input.position` är nu
pixelns position på skärmen – och returnerar färgen. Semantiken `SV_TARGET` på returvärdet betyder: skriv värdet
till render target, den back buffer som binds med `OMSetRenderTargets`. (`SV_TARGET` är kort för `SV_TARGET0`, det
första render target.) Den här shadern använder inte `input` – varje pixel får samma orange.

Gör nu den andra uppgiften: skriv `PSMain`.
:::

## Shaderprogram

:::opengl
Båda shaderna är nu kompilerade, och det enda som återstår är att länka ihop de två shaderobjekten till ett
**shaderprogram** som du kan rendera med. Ett shaderprogram är den slutliga, länkade versionen av flera shaders
tillsammans. För att använda de kompilerade shaderna länkar du dem till ett shaderprogram och aktiverar sedan
programmet när du renderar objekt. Det aktiverade programmets shaders används när du gör renderingsanrop.

När shaderna länkas till ett program kopplas varje shaders utdata till nästa shaders indata. Det är också här du får
länkningsfel om utdata och indata inte passar ihop.

Att skapa ett programobjekt är enkelt:

```cpp
unsigned int shaderProgram = glCreateProgram();
```

`glCreateProgram` skapar ett program och returnerar dess ID. Nu kopplar du de kompilerade shaderna till programmet
och länkar dem med `glLinkProgram`:

```cpp
glAttachShader(shaderProgram, vertexShader);
glAttachShader(shaderProgram, fragmentShader);
glLinkProgram(shaderProgram);
```

Precis som vid shaderkompileringen kan du kontrollera om länkningen misslyckades och hämta loggen – med
`glGetProgramiv` och `glGetProgramInfoLog` i stället:

```cpp
glGetProgramiv(shaderProgram, GL_LINK_STATUS, &success);
if (!success) {
    glGetProgramInfoLog(shaderProgram, 512, NULL, infoLog);
    std::cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << std::endl;
}
```

Resultatet är ett programobjekt som du aktiverar med `glUseProgram(shaderProgram)`. Varje shader- och
renderingsanrop efter `glUseProgram` använder det här programobjektet (och därmed shaderna). Glöm inte att ta bort
shaderobjekten när du har länkat dem till programmet; du behöver dem inte längre:

```cpp
glDeleteShader(vertexShader);
glDeleteShader(fragmentShader);
```

Själva programmet tas bort i slutet av programmet, med `glDeleteProgram(shaderProgram);` i städsektionen.

Gör nu den fjärde uppgiften: länka shaderna till `shaderProgram`, kontrollera länkningsfel, ta bort de två
shaderobjekten och ta bort programmet i städsektionen.

Nu har du skickat vertexdatan till GPU:n och talat om hur den ska bearbetas i en vertex shader och en fragment
shader. Du är nästan framme, men inte riktigt: OpenGL vet ännu inte hur vertexdatan i minnet ska tolkas, eller hur
vertexdatan ska kopplas till vertex shaderns attribut. Det talar du om härnäst.
:::
:::vulkan
Vulkan har inget shaderprogramobjekt. Det OpenGL länkar ihop till ett program – shaderna, plus allt OpenGL kommer
ihåg som tillstånd, till exempel hur vertexar läses – blir i Vulkan en enda **grafikpipeline**, en `VkPipeline`.
Pipelinen skapas i `createGraphicsPipeline()`, som redan anropas i `initVulkan()` direkt efter `createRenderPass()`.
Dess fyra TODO-kommentarer är stegen i de kommande uppgifterna:

1. ladda SPIR-V-koden, skapa shadermodulerna och shader-stegen;
2. beskriv stegen med fasta funktioner och skapa pipeline layouten;
3. skapa grafikpipelinen;
4. förstör shadermodulerna.

För att använda shaderna kopplar du varje modul till ett steg i pipelinen med en `VkPipelineShaderStageCreateInfo`:

```cpp
auto vertShaderCode = readFile("shaders/vert.spv");
auto fragShaderCode = readFile("shaders/frag.spv");

VkShaderModule vertShaderModule = createShaderModule(vertShaderCode);
VkShaderModule fragShaderModule = createShaderModule(fragShaderCode);

VkPipelineShaderStageCreateInfo vertShaderStageInfo{};
vertShaderStageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
vertShaderStageInfo.stage = VK_SHADER_STAGE_VERTEX_BIT;
vertShaderStageInfo.module = vertShaderModule;
vertShaderStageInfo.pName = "main";

VkPipelineShaderStageCreateInfo fragShaderStageInfo{};
fragShaderStageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
fragShaderStageInfo.stage = VK_SHADER_STAGE_FRAGMENT_BIT;
fragShaderStageInfo.module = fragShaderModule;
fragShaderStageInfo.pName = "main";

VkPipelineShaderStageCreateInfo shaderStages[] = {vertShaderStageInfo, fragShaderStageInfo};
```

`stage` anger i vilket steg i pipelinen shadern används, `module` är shadermodulen och `pName` är
**ingångspunkten** (entry point): funktionen som ska anropas. En modul kan innehålla flera shaders, var och en med
sin egen ingångspunkt; här är det `main` i båda.

Länkningen som OpenGL gör i `glLinkProgram` – att kompilera bytekoden till GPU:ns maskinkod och koppla vertex
shaderns utdata till fragment shaderns indata – sker i Vulkan när pipelinen skapas. Efter det behövs modulerna inte
längre, så de förstörs i slutet av `createGraphicsPipeline()` – som `glDeleteShader` efter länkningen i OpenGL:

```cpp
vkDestroyShaderModule(device, fragShaderModule, nullptr);
vkDestroyShaderModule(device, vertShaderModule, nullptr);
```

Gör nu den andra uppgiften: skriv `readFile()` och `createShaderModule()`, ladda sedan de två `.spv`-filerna i
`createGraphicsPipeline()`, skapa modulerna och de två shader-stegen, och förstör modulerna i slutet av funktionen.
Bygg & kör: fortfarande blågrönt. Om `.spv`-filerna inte gick att hitta skulle programmet stanna med "failed to open
file!".

(Kompilatorn varnar för att `shaderStages` inte används – det är väntat fram till pipeline-uppgiften.)
:::
:::d3d12
Direct3D 12 har inget shaderprogramobjekt heller. De kompilerade shaderna hamnar, tillsammans med nästan alla
inställningar för de fasta funktionerna, i ett enda **pipeline state object** (PSO), en `ID3D12PipelineState`.
Innan du kan skapa ett behöver du en **root signature**.

Root signaturen beskriver vilka resurser shaderna använder förutom vertexarna: konstanter, constant buffers,
texturer, samplers … Den är kontraktet mellan ditt C++-program och shaderna: "parameter 0 är en constant buffer för
vertex shadern, parameter 1 en tabell med texturer …". Triangelns shaders använder inget av detta, så du skapar en
**tom** root signature – men varje pipeline behöver en:

```cpp
// Create an empty root signature.
{
    CD3DX12_ROOT_SIGNATURE_DESC rootSignatureDesc;
    rootSignatureDesc.Init(0, nullptr, 0, nullptr, D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT);

    ComPtr<ID3DBlob> signature;
    ComPtr<ID3DBlob> error;
    ThrowIfFailed(D3D12SerializeRootSignature(&rootSignatureDesc, D3D_ROOT_SIGNATURE_VERSION_1, &signature, &error));
    ThrowIfFailed(m_device->CreateRootSignature(0, signature->GetBufferPointer(), signature->GetBufferSize(), IID_PPV_ARGS(&m_rootSignature)));
}
```

`Init` tar root-parametrarna (0 stycken, `nullptr`), de statiska samplers (inga heller) och flaggor.
`D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT` väljer att använda input assemblern med en input
layout – du läser vertexar från en vertexbuffert. (Utan flaggan kan root signaturen ta lite mindre plats på viss
hårdvara, för pipelines som inte läser vertexbuffertar.)

En root signature skapas inte direkt från beskrivningen: `D3D12SerializeRootSignature` gör först om den till en
binär blob (samma format som en root signature skriven i HLSL kompileras till), och `CreateRootSignature` skapar
objektet från bloben. Det första argumentet, `0`, är nodmasken för system med flera GPU:er.

Gör nu den tredje uppgiften: skapa den tomma root signaturen i början av `LoadAssets`.

Pipeline state-objektet är nästa steg. Det motsvarar OpenGL:s länkade program – och mer: "länkningen" av shaderna
sker när PSO:n skapas, och det gör även konfigurationen av stegen med fasta funktioner. Men först behöver det veta
hur vertexdatan är uppbyggd.
:::

## Koppla ihop vertexattribut

Vertex shadern låter dig ange vilken indata du vill i form av vertexattribut. Det ger dig stor flexibilitet, men det
betyder också att du själv måste ange vilken del av indatan som hör till vilket vertexattribut i vertex shadern. Med
andra ord: du måste tala om för {{api}} hur vertexdatan ska tolkas innan du renderar.

Vertexbuffertens data är upplagd så här:

```text
            vertex 1          vertex 2          vertex 3
          | x | y | z |     | x | y | z |     | x | y | z |
byte:     0   4   8   12    12  16  20  24    24  28  32  36
position: |<- stride: 12 ->|
          ^ offset: 0
```

- Positionsdatan lagras som 32-bitars (4 byte) flyttal.
- Varje position består av 3 sådana värden.
- Det finns inget mellanrum (eller andra värden) mellan varje grupp om 3 värden: värdena är *tätt packade*.
- Det första värdet i datan ligger i början av bufferten.

:::opengl
Med den kunskapen talar du om för OpenGL hur vertexdatan ska tolkas (per vertexattribut) med
`glVertexAttribPointer`:

```cpp
glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
glEnableVertexAttribArray(0);
```

`glVertexAttribPointer` har en hel del parametrar, så vi går igenom dem:

- Den första parametern anger vilket vertexattribut du vill konfigurera. Kom ihåg att du satte positionsattributets
  location i vertex shadern med `layout (location = 0)`. Det sätter vertexattributets location till `0`, och
  eftersom du vill skicka data till det här attributet skickar du `0`.
- Nästa argument är vertexattributets storlek. Det är en `vec3`, så det består av `3` värden.
- Det tredje argumentet är datans typ, `GL_FLOAT` (en `vec*` i GLSL består av floats).
- Nästa argument anger om datan ska normaliseras. Om du skickar heltalsdata (int, byte) och sätter det till
  `GL_TRUE` avbildas heltalen på 0 (eller -1 för data med tecken) till 1 när de omvandlas till float. Det är inte
  aktuellt här, så det blir `GL_FALSE`.
- Det femte argumentet är **stride**: avståndet mellan två på varandra följande vertexattribut. Nästa uppsättning
  positionsdata ligger exakt 3 floats längre fram, så stride är `3 * sizeof(float)`. Eftersom arrayen är tätt
  packad kan du också skicka `0` och låta OpenGL räkna ut stride – men när du har fler vertexattribut måste du ange
  avståndet mellan dem noggrant, så det är god vana att skriva ut det.
- Den sista parametern har typen `void*`, därav den konstiga typomvandlingen. Det är **offset**: var positionsdatan
  börjar i bufferten. Positionsdatan ligger i början av dataarrayen, så det blir `0`.

Varje vertexattribut tar sin data från minne som hanteras av ett VBO, och *vilket* VBO bestäms av vilket VBO som är
bundet till `GL_ARRAY_BUFFER` när du anropar `glVertexAttribPointer`. Eftersom `VBO` fortfarande är bundet är
vertexattribut 0 nu kopplat till sin vertexdata.

Nu när du har angett hur OpenGL ska tolka vertexdatan aktiverar du vertexattributet med
`glEnableVertexAttribArray`, med attributets location som argument; vertexattribut är avstängda som standard.
:::
:::vulkan
I Vulkan beskriver du formatet i två strukturer, och du håller ihop dem med vertexdatans C++-typ. Här är projektets
struct `Vertex`:

```cpp
struct Vertex {
    glm::vec3 pos;

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
};
```

`glm::vec3` kommer från GLM, ett matematikbibliotek vars typer motsvarar GLSL:s (en `glm::vec3` är tre floats,
precis som en `vec3`), så structens minneslayout är exakt den layout shadern förväntar sig.

En **binding description** beskriver bufferten som helhet: i vilken takt data ska läsas från minnet.

- `binding` är bindningens index; du binder vertexbufferten till binding 0 när du ritar.
- `stride` är antalet byte från ett element till nästa: `sizeof(Vertex)`, 12 byte.
- `inputRate` är `VK_VERTEX_INPUT_RATE_VERTEX`: gå till nästa element efter varje vertex. (Alternativet,
  `VK_VERTEX_INPUT_RATE_INSTANCE`, är till för instansierad rendering.)

En **attribute description** beskriver hur ett vertexattribut ska hämtas ur en bindnings data:

- `binding`: bindningen som datan kommer från (0).
- `location`: indatans `location` i vertex shadern – `layout(location = 0) in vec3 inPosition`.
- `format`: datans typ. Formaten har, lite märkligt, samma namn som färgformat: `VK_FORMAT_R32G32B32_SFLOAT` är tre
  32-bitars flyttal med tecken, en `vec3`. (En `float` vore `VK_FORMAT_R32_SFLOAT`, en `vec2`
  `VK_FORMAT_R32G32_SFLOAT`.)
- `offset`: var attributet börjar inuti en `Vertex`. `offsetof(Vertex, pos)` räknar ut det (här `0`).

Vertexdatan, `vertices`, är en `std::vector<Vertex>` med de tre hörnen från *Vertexindata*.

Gör nu den tredje uppgiften: skriv `struct Vertex` med dess två funktioner, och vektorn `vertices` med triangeln.
Bygg & kör: fortfarande blågrönt – ingenting använder datan än.
:::
:::d3d12
I Direct3D 12 beskriver du formatet med en **input layout**: en array med `D3D12_INPUT_ELEMENT_DESC`, en per
vertexattribut. Triangeln har ett attribut, positionen:

```cpp
// Define the vertex input layout.
D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
{
    { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
};
```

Fälten, i ordning:

- `"POSITION"` är **semantiknamnet**. Det är så datan hittar shaderns indata: den går till den parameter i `VSMain`
  som har semantiken `POSITION`.
- `0` är semantikindex, för när flera element har samma namn (`TEXCOORD0`, `TEXCOORD1` …).
- `DXGI_FORMAT_R32G32B32_FLOAT` är datans format: tre 32-bitars flyttal, som `XMFLOAT3`.
- `0` är input slot: vertexbufferten binds till slot 0 när du ritar.
- `0` är elementets byte-offset inuti en vertex – positionen ligger i början.
- `D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA` betyder: nästa vertex får nästa element (alternativet är data per
  instans), och den sista `0` (instance data step rate) måste vara 0 för data per vertex.

Stride – storleken på en vertex – ingår inte i input layouten; den anger du med vertex buffer view.

Nu kan pipeline state-objektet beskrivas. Det innehåller allt om hur pipelinen ritar:

```cpp
// Describe and create the graphics pipeline state object (PSO).
D3D12_GRAPHICS_PIPELINE_STATE_DESC psoDesc = {};
psoDesc.InputLayout = { inputElementDescs, _countof(inputElementDescs) };
psoDesc.pRootSignature = m_rootSignature.Get();
psoDesc.VS = CD3DX12_SHADER_BYTECODE(vertexShader.Get());
psoDesc.PS = CD3DX12_SHADER_BYTECODE(pixelShader.Get());
psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);
psoDesc.BlendState = CD3DX12_BLEND_DESC(D3D12_DEFAULT);
psoDesc.DepthStencilState.DepthEnable = FALSE;
psoDesc.DepthStencilState.StencilEnable = FALSE;
psoDesc.SampleMask = UINT_MAX;
psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE;
psoDesc.NumRenderTargets = 1;
psoDesc.RTVFormats[0] = DXGI_FORMAT_R8G8B8A8_UNORM;
psoDesc.SampleDesc.Count = 1;
ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_pipelineState)));
```

- `InputLayout`: input layouten från ovan, med antalet element.
- `pRootSignature`: root signaturen från förra avsnittet.
- `VS` och `PS`: den kompilerade bytekoden; `CD3DX12_SHADER_BYTECODE` tar pekaren och storleken från bloben.
- `RasterizerState`: `CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT)` fyller i standardinställningen för rasterizern:
  fyllda trianglar (`D3D12_FILL_MODE_SOLID`), **baksidor cullas** (`D3D12_CULL_MODE_BACK`) och
  `FrontCounterClockwise = FALSE` – alltså är **medurs** trianglar framsidor. Därför spelar vertexarnas ordning roll:
  en triangel vars vertexar går moturs på skärmen är en baksida och ritas inte. Culling sparar arbete för slutna
  3D-objekt, vars baksidor du ändå inte kan se.
- `BlendState`: standard – blending avstängd, pixel shaderns färg ersätter den gamla.
- Inget djup- eller stenciltest (det finns ingen djupbuffert än), och `SampleMask = UINT_MAX` släpper igenom varje
  sample.
- `PrimitiveTopologyType`: PSO:n behöver bara veta att den ritar *trianglar* (inte punkter eller linjer); den exakta
  topologin – en triangellista – sätts på command listen.
- Ett render target med swap chainens back buffer-format, `DXGI_FORMAT_R8G8B8A8_UNORM`, och ett sample per pixel
  (ingen multisampling).

`CreateGraphicsPipelineState` skapar PSO:n; det är här drivrutinen kompilerar shaderbytekoden för din GPU. Eftersom
command listen ska börja med det här pipeline state skapas PSO:n *före* command listen, och `m_pipelineState.Get()`
ersätter `nullptr` i `CreateCommandList`:

```cpp
ThrowIfFailed(m_device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, m_commandAllocator.Get(), m_pipelineState.Get(), IID_PPV_ARGS(&m_commandList)));
```

Gör nu den fjärde uppgiften: kompilera shaderna med `D3DCompileFromFile` (från *Kompilera en shader*), definiera
input layouten, beskriv och skapa PSO:n och skicka den till `CreateCommandList`. Bygg & kör: fortfarande bara
clear-färgen, men från och med nu stoppar ett fel i `shaders.hlsl` programmet vid start med en HRESULT.
:::

:::opengl
```quiz
Det första argumentet till `glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0)` är `0`. Vad syftar det på?
- [ ] Vertex buffer objectets ID
- [ ] Byte-offseten till den första vertexen i bufferten
- [x] `location = 0` för indatan `aPos` i vertex shadern
---
Det första argumentet är vertexattributets location. Offseten är det sista argumentet; bufferten är det VBO som är bundet till `GL_ARRAY_BUFFER` när anropet görs.
```
:::
:::vulkan
```quiz
Hur får `inPosition` i `shader.vert` sin data från `Vertex::pos`?
- [x] Genom attribute descriptionen: `location = 0` motsvarar `layout(location = 0)`, med formatet `VK_FORMAT_R32G32B32_SFLOAT` och offset `offsetof(Vertex, pos)`
- [ ] Vulkan matchar namnen `inPosition` och `pos`
- [ ] Genom ordningen som variablerna deklareras i shadern
---
SPIR-V använder inte variabelnamnen till det här: indata matchas med sin location. Binding descriptionen lägger till stride (`sizeof(Vertex)`).
```
:::
:::d3d12
```quiz
Hur kopplas input layoutens element till parametern i `VSMain`?
- [x] Genom semantiknamnet: `"POSITION"` i input layouten, `: POSITION` på parametern
- [ ] Genom parameterns namn, `position`
- [ ] Genom funktionernas ordning i `shaders.hlsl`
---
Semantiker är limmet mellan input assemblern och vertex shadern. Parametern kan heta vad som helst; semantiken måste stämma.
```
:::

## Vertex Array Object

:::opengl
Ett **vertex array object** (VAO) kan bindas precis som ett vertex buffer object, och alla följande anrop som
konfigurerar vertexattribut sparas från och med då i VAO:n. Fördelen är att du bara behöver göra anropen som
konfigurerar attributpekarna en gång, och varje gång du vill rita objektet binder du bara motsvarande VAO. Att byta
mellan olika vertexdata och attributkonfigurationer blir då lika enkelt som att binda en annan VAO; allt tillstånd du
just satte finns sparat i den.

> Core OpenGL **kräver** att du använder en VAO så att det vet vad det ska göra med din vertexindata. Om du inte
> binder någon VAO vägrar OpenGL troligen att rita något alls.

Ett vertex array object sparar följande:

- Anrop till `glEnableVertexAttribArray` eller `glDisableVertexAttribArray`.
- Konfigurationer av vertexattribut via `glVertexAttribPointer`.
- De vertex buffer objects som kopplas till vertexattribut genom anrop till `glVertexAttribPointer`.

Att skapa en VAO liknar att skapa ett VBO. För att använda den binder du den med `glBindVertexArray`. Därefter binder
och konfigurerar du motsvarande VBO:er och attributpekare, och avbinder VAO:n för senare användning. När du vill rita
ett objekt binder du helt enkelt VAO:n med de önskade inställningarna innan du ritar. I det här projektet skapas VAO:n
bredvid VBO:n och binds före VBO:n:

```cpp
unsigned int VBO, VAO;
glGenVertexArrays(1, &VAO);
glGenBuffers(1, &VBO);
// bind the Vertex Array Object first, then bind and set vertex buffer(s), and then configure vertex attributes(s).
glBindVertexArray(VAO);

glBindBuffer(GL_ARRAY_BUFFER, VBO);
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
glEnableVertexAttribArray(0);

// note that this is allowed, the call to glVertexAttribPointer registered VBO as the vertex attribute's bound vertex buffer object so afterwards we can safely unbind
glBindBuffer(GL_ARRAY_BUFFER, 0);

// You can unbind the VAO afterwards so other VAO calls won't accidentally modify this VAO, but this rarely happens. Modifying other
// VAOs requires a call to glBindVertexArray anyways so we generally don't unbind VAOs (nor VBOs) when it's not directly necessary.
glBindVertexArray(0);
```

Det var allt: VAO:n sparar nu konfigurationen av vertexattributen och vilket VBO som ska användas. När du har flera
objekt att rita skapar och konfigurerar du oftast först alla VAO:er (och därmed de VBO:er och attributpekare som
behövs) och sparar dem till senare. När du vill rita ett av objekten tar du motsvarande VAO, binder den, ritar
objektet och avbinder VAO:n igen. VAO:n tas bort i städsektionen med `glDeleteVertexArrays(1, &VAO);`.

Gör nu den femte uppgiften: skapa och bind VAO:n före VBO:n, konfigurera vertexattributet med
`glVertexAttribPointer` och `glEnableVertexAttribArray`, avbind VBO:n och VAO:n, och ta bort VAO:n i städsektionen.
Lösningen lägger också till en bortkommenterad rad `//glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);` – den använder du i
slutet av kapitlet.
:::
:::vulkan
Vulkan har inga vertex array objects. De två saker en VAO sparar finns på två olika ställen:

- **Formatet** på vertexdatan – bindningarna och attributen – är en del av grafikpipelinen, i dess *vertex input
  state*. Det låses när pipelinen skapas.
- **Vilken buffert** som ska läsas väljs när command buffern spelas in, med `vkCmdBindVertexBuffers` – du ser det i
  nästa avsnitt.

Att rita med annan vertexdata använder alltså samma pipeline med en annan buffert; att rita data med ett annat
format kräver en annan pipeline. Vertex input state är det första av pipelinens tillstånd för **fasta funktioner**:

```cpp
VkPipelineVertexInputStateCreateInfo vertexInputInfo{};
vertexInputInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_VERTEX_INPUT_STATE_CREATE_INFO;

auto bindingDescription = Vertex::getBindingDescription();
auto attributeDescriptions = Vertex::getAttributeDescriptions();

vertexInputInfo.vertexBindingDescriptionCount = 1;
vertexInputInfo.vertexAttributeDescriptionCount = static_cast<uint32_t>(attributeDescriptions.size());
vertexInputInfo.pVertexBindingDescriptions = &bindingDescription;
vertexInputInfo.pVertexAttributeDescriptions = attributeDescriptions.data();
```

Resten av stegen med fasta funktioner, som OpenGL konfigurerar med standardtillstånd som du kan ändra när som helst,
måste också beskrivas i förväg.

### Fasta funktioner

**Input assembly** beskriver vilken sorts geometri som ritas av vertexarna (steget *primitive assembly*):

```cpp
VkPipelineInputAssemblyStateCreateInfo inputAssembly{};
inputAssembly.sType = VK_STRUCTURE_TYPE_PIPELINE_INPUT_ASSEMBLY_STATE_CREATE_INFO;
inputAssembly.topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST;
inputAssembly.primitiveRestartEnable = VK_FALSE;
```

`VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST` betyder: var tredje vertex bildar en triangel, utan återanvändning – som
`GL_TRIANGLES`. Primitive restart är bara relevant för strip-topologier.

**Viewporten** beskriver det område i framebuffern som utdatan renderas till (viewport-transformen från normalized
device coordinates till pixlar), och **scissor**-rektangeln anger i vilket område pixlarna faktiskt sparas. Båda
skulle kunna bakas in i pipelinen, men då skulle pipelinen behöva skapas om varje gång fönsterstorleken ändrades.
I stället är de **dynamiskt tillstånd** (dynamic state): pipelinen behöver bara veta hur många det finns, och
värdena sätts när command buffern spelas in:

```cpp
VkPipelineViewportStateCreateInfo viewportState{};
viewportState.sType = VK_STRUCTURE_TYPE_PIPELINE_VIEWPORT_STATE_CREATE_INFO;
viewportState.viewportCount = 1;
viewportState.scissorCount = 1;
```

**Rasterizern** tar geometrin som vertexarna formar och gör om den till fragment. Den sköter också face culling:

```cpp
VkPipelineRasterizationStateCreateInfo rasterizer{};
rasterizer.sType = VK_STRUCTURE_TYPE_PIPELINE_RASTERIZATION_STATE_CREATE_INFO;
rasterizer.depthClampEnable = VK_FALSE;
rasterizer.rasterizerDiscardEnable = VK_FALSE;
rasterizer.polygonMode = VK_POLYGON_MODE_FILL;
rasterizer.lineWidth = 1.0f;
rasterizer.cullMode = VK_CULL_MODE_BACK_BIT;
rasterizer.frontFace = VK_FRONT_FACE_CLOCKWISE;
rasterizer.depthBiasEnable = VK_FALSE;
```

- `depthClampEnable` skulle klämma fragment bortom när- och fjärrplanet i stället för att kasta dem;
  `rasterizerDiscardEnable` skulle hindra all geometri från att nå rasterizern. Båda är avstängda.
- `polygonMode` är `VK_POLYGON_MODE_FILL`: fyll triangeln med fragment. (`VK_POLYGON_MODE_LINE` ritar bara kanterna
  – se *Wireframe-läge* i slutet av kapitlet.)
- `lineWidth` är linjernas tjocklek i fragment; allt tjockare än `1.0f` kräver GPU-funktionen `wideLines`.
- `cullMode = VK_CULL_MODE_BACK_BIT` kastar baksidor, och `frontFace = VK_FRONT_FACE_CLOCKWISE` säger vilka trianglar
  som är framsidor: de vars vertexar syns **medurs** på skärmen. Kom ihåg att Vulkans y-axel pekar nedåt: triangeln
  överst `(0.0, -0.5)`, nere till höger `(0.5, 0.5)`, nere till vänster `(-0.5, 0.5)` går medurs på skärmen, så den
  är en framsida och ritas. Med omvänd ordning skulle den cullas, och du skulle inte se något.
- `depthBiasEnable` används till shadow mapping senare; avstängd.

**Multisampling** är ett av sätten att göra kantutjämning (anti-aliasing). Den förblir avstängd: ett sample per
pixel.

```cpp
VkPipelineMultisampleStateCreateInfo multisampling{};
multisampling.sType = VK_STRUCTURE_TYPE_PIPELINE_MULTISAMPLE_STATE_CREATE_INFO;
multisampling.sampleShadingEnable = VK_FALSE;
multisampling.rasterizationSamples = VK_SAMPLE_COUNT_1_BIT;
```

**Color blending** kombinerar fragment shaderns färg med färgen som redan finns i framebuffern. Det finns en
`VkPipelineColorBlendAttachmentState` per color attachment och en global `VkPipelineColorBlendStateCreateInfo`:

```cpp
VkPipelineColorBlendAttachmentState colorBlendAttachment{};
colorBlendAttachment.colorWriteMask = VK_COLOR_COMPONENT_R_BIT | VK_COLOR_COMPONENT_G_BIT | VK_COLOR_COMPONENT_B_BIT | VK_COLOR_COMPONENT_A_BIT;
colorBlendAttachment.blendEnable = VK_FALSE;

VkPipelineColorBlendStateCreateInfo colorBlending{};
colorBlending.sType = VK_STRUCTURE_TYPE_PIPELINE_COLOR_BLEND_STATE_CREATE_INFO;
colorBlending.logicOpEnable = VK_FALSE;
colorBlending.logicOp = VK_LOGIC_OP_COPY;
colorBlending.attachmentCount = 1;
colorBlending.pAttachments = &colorBlendAttachment;
colorBlending.blendConstants[0] = 0.0f;
colorBlending.blendConstants[1] = 0.0f;
colorBlending.blendConstants[2] = 0.0f;
colorBlending.blendConstants[3] = 0.0f;
```

Med `blendEnable = VK_FALSE` ersätter den nya färgen helt enkelt den gamla; `colorWriteMask` släpper igenom alla
fyra komponenterna. Blending kommer tillbaka i kapitlet *Blending*.

**Dynamic state** listar de tillstånd som i stället sätts när du ritar – här viewporten och scissor-rektangeln:

```cpp
std::vector<VkDynamicState> dynamicStates = {
    VK_DYNAMIC_STATE_VIEWPORT,
    VK_DYNAMIC_STATE_SCISSOR
};
VkPipelineDynamicStateCreateInfo dynamicState{};
dynamicState.sType = VK_STRUCTURE_TYPE_PIPELINE_DYNAMIC_STATE_CREATE_INFO;
dynamicState.dynamicStateCount = static_cast<uint32_t>(dynamicStates.size());
dynamicState.pDynamicStates = dynamicStates.data();
```

Till sist beskriver **pipeline layouten** de resurser shaderna använder förutom vertexarna (uniform-värden, texturer
…), som OpenGL:s uniforms. Triangelns shaders har inga, så layouten är tom – men den krävs ändå. Den är en medlem,
`VkPipelineLayout pipelineLayout;`, eftersom den används igen när du ritar i senare kapitel:

```cpp
VkPipelineLayoutCreateInfo pipelineLayoutInfo{};
pipelineLayoutInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO;
pipelineLayoutInfo.setLayoutCount = 0;
pipelineLayoutInfo.pushConstantRangeCount = 0;

if (vkCreatePipelineLayout(device, &pipelineLayoutInfo, nullptr, &pipelineLayout) != VK_SUCCESS) {
    throw std::runtime_error("failed to create pipeline layout!");
}
```

Den förstörs i `cleanup()` med `vkDestroyPipelineLayout(device, pipelineLayout, nullptr);`.

Gör nu den fjärde uppgiften: beskriv alla steg med fasta funktioner i `createGraphicsPipeline()` som ovan, skapa
pipeline layouten (lägg till medlemmen) och förstör den i `cleanup()`. Bygg & kör: fortfarande blågrönt (och några
varningar om oanvända variabler, som försvinner i nästa uppgift).

### Skapa pipelinen

Nu kan alla delar sättas ihop till pipelinen: shader-stegen, tillstånden för de fasta funktionerna, pipeline
layouten och render passen:

```cpp
VkGraphicsPipelineCreateInfo pipelineInfo{};
pipelineInfo.sType = VK_STRUCTURE_TYPE_GRAPHICS_PIPELINE_CREATE_INFO;
pipelineInfo.stageCount = 2;
pipelineInfo.pStages = shaderStages;
pipelineInfo.pVertexInputState = &vertexInputInfo;
pipelineInfo.pInputAssemblyState = &inputAssembly;
pipelineInfo.pViewportState = &viewportState;
pipelineInfo.pRasterizationState = &rasterizer;
pipelineInfo.pMultisampleState = &multisampling;
pipelineInfo.pColorBlendState = &colorBlending;
pipelineInfo.pDynamicState = &dynamicState;
pipelineInfo.layout = pipelineLayout;
pipelineInfo.renderPass = renderPass;
pipelineInfo.subpass = 0;
pipelineInfo.basePipelineHandle = VK_NULL_HANDLE;

if (vkCreateGraphicsPipelines(device, VK_NULL_HANDLE, 1, &pipelineInfo, nullptr, &graphicsPipeline) != VK_SUCCESS) {
    throw std::runtime_error("failed to create graphics pipeline!");
}
```

`renderPass` och `subpass` anger i vilken render pass – och vilken av dess subpasses – pipelinen ska användas; det
är render passen från förra kapitlet, med sin enda color attachment. `basePipelineHandle` skulle låta dig härleda en
pipeline från en befintlig; behövs inte här. `vkCreateGraphicsPipelines` kan skapa flera pipelines i ett anrop, och
dess andra parameter är en valfri pipeline cache (ingen). Pipelinen är en medlem, `VkPipeline graphicsPipeline;`, och
förstörs i `cleanup()` före pipeline layouten:

```cpp
vkDestroyPipeline(device, graphicsPipeline, nullptr);
vkDestroyPipelineLayout(device, pipelineLayout, nullptr);
```

Gör nu den femte uppgiften: skapa grafikpipelinen vid TODO-kommentaren "create the graphics pipeline", lägg till
medlemmen och förstör den i `cleanup()`. Bygg & kör: fortfarande blågrönt, men inget valideringsmeddelande ska synas.

Gör sedan den sjätte uppgiften: vertexbufferten, som den beskrivs i *Vertexindata* – medlemmarna `vertexBuffer` och
`vertexBufferMemory`, `createVertexBuffer()`, `findMemoryType()`, anropet i `initVulkan()` efter
`createCommandPool()` och städningen.
:::
:::d3d12
Direct3D 12 har inga vertex array objects. De två saker en VAO sparar finns på två olika ställen:

- **Formatet** på vertexdatan är input layouten, som är en del av pipeline state-objektet.
- **Vilken buffert** som ska läsas väljs på command listen, med `IASetVertexBuffers` – du ser det i nästa avsnitt.

`IASetVertexBuffers` tar inte själva resursen utan en **vertex buffer view**, en liten struktur som säger var
vertexdatan finns och hur stor den är:

```cpp
// Initialize the vertex buffer view.
m_vertexBufferView.BufferLocation = m_vertexBuffer->GetGPUVirtualAddress();
m_vertexBufferView.StrideInBytes = sizeof(Vertex);
m_vertexBufferView.SizeInBytes = vertexBufferSize;
```

- `BufferLocation` är buffertens adress i GPU:ns virtuella adressrymd.
- `StrideInBytes` är storleken på en vertex: `sizeof(Vertex)`, 12 byte. Det är den stride som OpenGL skickar till
  `glVertexAttribPointer`.
- `SizeInBytes` är hela buffertens storlek.

Till skillnad från det mesta i Direct3D 12 sparas en vertex buffer view inte i en descriptor heap: den skickas direkt
till command listen. Medlemmen `m_vertexBufferView` är redan deklarerad i klassen.

Gör nu den femte uppgiften: skapa vertexbufferten i `LoadAssets` – de tre vertexarna från *Vertexindata* (överst,
nere till höger, nere till vänster), committed resource i upload heapen, `Map` + `memcpy` + `Unmap`, och vertex
buffer view. Bygg & kör: fortfarande bara clear-färgen; ingenting ritas än.
:::

:::opengl
```quiz
Vad sparar ett vertex array object (VAO)? (Välj alla som stämmer.)
- [ ] Shaderprogrammet som det ska ritas med
- [x] Om varje vertexattribut är aktiverat (`glEnableVertexAttribArray`)
- [x] Konfigurationerna av vertexattribut som görs med `glVertexAttribPointer`
- [x] Vilket vertex buffer object varje attribut läser från
---
Shaderprogrammet aktiveras separat med `glUseProgram`. (En VAO sparar också det bundna element buffer object, som du ser nedan.)
```
:::
:::vulkan
```quiz
Vulkan har ingen VAO. Var hamnar informationen som en VAO i OpenGL innehåller? (Välj alla som stämmer.)
- [x] Vertexdatans format hamnar i pipelinens vertex input state
- [x] Bufferten som ska läsas binds i command buffern med `vkCmdBindVertexBuffers`
- [ ] I ett `VkVertexArray`-objekt
---
Formatet låses när pipelinen skapas; bufferten kan bytas från ett ritanrop till nästa. Det finns ingen `VkVertexArray` i Vulkan.
```
:::
:::d3d12
```quiz
Direct3D 12 har ingen VAO. Var hamnar informationen som en VAO i OpenGL innehåller? (Välj alla som stämmer.)
- [ ] I ett `ID3D12VertexArray`-objekt
- [x] Vertexdatans format hamnar i pipeline state-objektets input layout
- [x] Bufferten som ska läsas sätts på command listen med `IASetVertexBuffers` och en vertex buffer view
---
Formatet låses när PSO:n skapas; bufferten kan bytas från ett ritanrop till nästa. Det finns ingen `ID3D12VertexArray` i Direct3D 12.
```
:::

## Triangeln vi alla har väntat på

:::opengl
För att rita det du vill har OpenGL funktionen `glDrawArrays`, som ritar primitiver med den aktiva shadern, den
tidigare definierade konfigurationen av vertexattribut och VBO:ns vertexdata (indirekt bunden via VAO:n). Lägg
ritanropen i render loopen, efter `glClear` och före `glfwSwapBuffers`:

```cpp
// draw our first triangle
glUseProgram(shaderProgram);
glBindVertexArray(VAO); // seeing as we only have a single VAO there's no need to bind it every time, but we'll do so to keep things a bit more organized
glDrawArrays(GL_TRIANGLES, 0, 3);
```

`glDrawArrays` tar som första argument den typ av OpenGL-primitiv du vill rita. Du vill ha trianglar, så du skickar
`GL_TRIANGLES`. Det andra argumentet är startindex i vertexarrayen, `0`. Det sista argumentet är hur många vertexar
som ska ritas: `3` (du renderar bara en triangel från din data, som är exakt 3 vertexar lång).

Gör nu den sjätte uppgiften: lägg till de tre anropen i render loopen och tryck på **Bygg & kör**. Du ska se en
orange triangel på den blågröna bakgrunden, med hörnen på pixlarna (400, 150), (600, 450) och (200, 450).

Om triangeln inte syns, titta i utdatan efter kompilerings- eller länkningsfel i shaderna och jämför sedan din kod
med utdragen ovan. Att komma hit är en riktig milstolpe: det här är ögonblicket då learnopengl talar om triangeln
"vi alla har väntat på".
:::
:::vulkan
Ritandet sker i `recordCommandBuffer()`, mellan `vkCmdBeginRenderPass` och `vkCmdEndRenderPass` – den render pass
du redan börjar varje frame, som rensar bilden till blågrönt. Inuti den binder du pipelinen, sätter det dynamiska
tillståndet, binder vertexbufferten och ritar:

```cpp
vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, graphicsPipeline);

VkViewport viewport{};
viewport.x = 0.0f;
viewport.y = 0.0f;
viewport.width = static_cast<float>(swapChainExtent.width);
viewport.height = static_cast<float>(swapChainExtent.height);
viewport.minDepth = 0.0f;
viewport.maxDepth = 1.0f;
vkCmdSetViewport(commandBuffer, 0, 1, &viewport);

VkRect2D scissor{};
scissor.offset = {0, 0};
scissor.extent = swapChainExtent;
vkCmdSetScissor(commandBuffer, 0, 1, &scissor);

VkBuffer vertexBuffers[] = {vertexBuffer};
VkDeviceSize offsets[] = {0};
vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);

vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
```

- `vkCmdBindPipeline` väljer grafikpipelinen (`VK_PIPELINE_BIND_POINT_GRAPHICS`, till skillnad från en compute
  pipeline).
- Viewporten täcker hela swap chain-bilden, med standarddjupintervallet 0 till 1. Scissor-rektangeln täcker också
  hela bilden, så ingenting klipps bort. Eftersom båda är dynamiskt tillstånd måste du sätta dem i command buffern
  innan du ritar – pipelinen innehåller dem inte.
- `vkCmdBindVertexBuffers` binder `vertexBuffer` till binding 0 (första bindningen, en bindning), med start på
  byte-offset 0. Det är den bindning som din binding description syftar på.
- `vkCmdDraw` tar antalet vertexar (3), antalet instanser (`1`: ingen instansierad rendering), första vertexen (`0`)
  och första instansen (`0`).

Gör nu den sjunde uppgiften: lägg till de här kommandona vid TODO-kommentaren i `recordCommandBuffer()` och tryck
på **Bygg & kör**. Du ska se en orange triangel på den blågröna bakgrunden, med hörnen på pixlarna (400, 150),
(600, 450) och (200, 450).

Om fönstret förblir blågrönt, titta först i utdatan efter valideringsmeddelanden: de brukar peka ut problemet.
Kontrollera sedan vertexarna och rasterizer-inställningarna (`cullMode` och `frontFace`). Det krävdes mycket kod för
att komma hit – ungefär tusen rader – men nu är varje del på plats, och de kommande kapitlen ändrar bara små delar.
:::
:::d3d12
Ritandet sker i `PopulateCommandList`, som spelar in en frames kommandon. `m_commandList->Reset` sätter redan
pipeline state (`m_pipelineState.Get()`) i början av varje frame. Kommandona du lägger till hamnar på tre ställen.
Först, direkt efter reset, det tillstånd som PSO:n inte innehåller:

```cpp
// Set necessary state.
m_commandList->SetGraphicsRootSignature(m_rootSignature.Get());
m_commandList->RSSetViewports(1, &m_viewport);
m_commandList->RSSetScissorRects(1, &m_scissorRect);
```

- Root signaturen måste sättas på command listen, och den måste stämma med den som PSO:n skapades med.
- `m_viewport` (från 0, 0 till 800, 600, djup 0 till 1) avbildar normalized device coordinates på pixlar.
- `m_scissorRect` täcker hela fönstret. I Direct3D 12 är scissor-testet alltid på, så pixlar utanför
  scissor-rektangeln kastas – du måste sätta en innan du ritar.

Båda initieras redan i konstruktorn, som `CD3DX12_VIEWPORT` och `CD3DX12_RECT`. Sedan, efter resource barriern,
binder du back buffern som **render target**:

```cpp
CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);
m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
```

I förra kapitlet rensade du bara back buffern, och `ClearRenderTargetView` tar render target view direkt. Att rita
är annorlunda: output mergern skriver till de render targets som är *bundna*. Argumenten är ett render target, dess
descriptor handle, `FALSE` (handtagen är inte ett sammanhängande intervall – det finns bara ett) och ingen
depth-stencil view (`nullptr`).

Till sist, efter rensningen, själva ritandet:

```cpp
m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
m_commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);
m_commandList->DrawInstanced(3, 1, 0, 0);
```

- `IASetPrimitiveTopology` talar om för input assemblern hur primitiver byggs av vertexarna: en triangellista, var
  tredje vertex bildar en triangel (som `GL_TRIANGLES`). PSO:n sa bara "trianglar"; det här sätter den exakta
  topologin.
- `IASetVertexBuffers` binder vertex buffer view till input slot 0 (första slotten, en view).
- `DrawInstanced` tar antalet vertexar per instans (3), antalet instanser (`1`), första vertexen (`0`) och första
  instansen (`0`).

Gör nu den sjätte uppgiften: lägg till de tre grupperna av anrop i `PopulateCommandList` och tryck på
**Bygg & kör**. Du ska se en orange triangel på den blågröna bakgrunden, med hörnen på pixlarna (400, 150),
(600, 450) och (200, 450).

Om du bara ser clear-färgen, kontrollera först vertexarnas ordning (medurs!), sedan att root signaturen, viewporten,
scissor-rektangeln och render target alla är satta.
:::

:::opengl
```quiz
Du byter plats på de två första vertexarna, så att triangelns hörn nu går medurs på skärmen. Vad händer i det här programmet?
- [x] Triangeln ritas fortfarande: face culling är avstängt som standard i OpenGL
- [ ] Triangeln ritas upp och ner
- [ ] Triangeln försvinner, eftersom den nu är en baksida
---
OpenGL kastar bara baksidor när du slår på face culling med `glEnable(GL_CULL_FACE)` – det gör ett senare kapitel. Utan det spelar vertexarnas ordning ingen roll här.
```
:::
:::vulkan
```quiz
Du ändrar bara `rasterizer.frontFace` till `VK_FRONT_FACE_COUNTER_CLOCKWISE`. Vad ser du?
- [ ] Samma orange triangel
- [x] Bara blågrönt: den medurs triangeln är nu en baksida, och baksidor cullas
- [ ] Triangeln upp och ner
---
`cullMode = VK_CULL_MODE_BACK_BIT` kastar baksidor. Vilka trianglar som är baksidor beror på `frontFace` och på vertexarnas ordning på skärmen (kom ihåg att y pekar nedåt).
```
:::
:::d3d12
```quiz
Du använder learnopengls vertexordning i stället: vänster (-0.5, -0.5), höger (0.5, -0.5), överst (0.0, 0.5). Vad ser du med `CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT)`?
- [x] Bara clear-färgen: triangeln går moturs på skärmen, så den är en baksida och cullas
- [ ] Samma orange triangel
- [ ] Triangeln upp och ner
---
Standardinställningen för rasterizern cullar baksidor (`D3D12_CULL_MODE_BACK`) och räknar medurs trianglar som framsidor (`FrontCounterClockwise = FALSE`).
```
:::

## Element Buffer Objects

Det finns en sista sak att gå igenom när det gäller att rendera vertexar: **element buffer objects**, förkortat EBO
(Vulkan och Direct3D kallar dem **indexbuffertar**). För att förklara hur de fungerar tar vi ett exempel: anta att du
vill rita en rektangel i stället för en triangel. Du kan rita en rektangel med två trianglar (GPU:n arbetar helst med
trianglar). Det skulle kräva följande vertexar:

:::opengl d3d12
```cpp
float vertices[] = {
    // first triangle
     0.5f,  0.5f, 0.0f,  // top right
     0.5f, -0.5f, 0.0f,  // bottom right
    -0.5f,  0.5f, 0.0f,  // top left
    // second triangle
     0.5f, -0.5f, 0.0f,  // bottom right
    -0.5f, -0.5f, 0.0f,  // bottom left
    -0.5f,  0.5f, 0.0f   // top left
};
```
:::
:::vulkan
```cpp
const std::vector<Vertex> vertices = {
    // first triangle
    {{-0.5f, -0.5f, 0.0f}},  // top left
    {{0.5f, -0.5f, 0.0f}},   // top right
    {{0.5f, 0.5f, 0.0f}},    // bottom right
    // second triangle
    {{0.5f, 0.5f, 0.0f}},    // bottom right
    {{-0.5f, 0.5f, 0.0f}},   // bottom left
    {{-0.5f, -0.5f, 0.0f}}   // top left
};
```
:::

Som du ser överlappar några vertexar: nere till höger och uppe till vänster anges två gånger. Det är 50 % överflöd,
eftersom samma rektangel också kan anges med bara 4 vertexar i stället för 6. Det blir bara värre med mer komplexa
modeller med tusentals trianglar, där stora delar överlappar. En bättre lösning är att bara lagra de unika vertexarna
och sedan ange i vilken *ordning* de ska ritas. Då behöver du bara 4 vertexar för rektangeln, plus en lista med index
som säger vilka vertexar som bildar varje triangel. Det kallas **indexerad ritning** (indexed drawing), och det är
precis vad element buffer objects är till för.

:::opengl
Ett EBO är en buffert, precis som ett vertex buffer object, som lagrar index som OpenGL använder för att avgöra vilka
vertexar som ska ritas. Först anger du de unika vertexarna och indexen för att rita dem som en rektangel:

```cpp
float vertices[] = {
     0.5f,  0.5f, 0.0f,  // top right
     0.5f, -0.5f, 0.0f,  // bottom right
    -0.5f, -0.5f, 0.0f,  // bottom left
    -0.5f,  0.5f, 0.0f   // top left
};
unsigned int indices[] = {  // note that we start from 0!
    0, 1, 3,  // first Triangle
    1, 2, 3   // second Triangle
};
```

Med index behöver du bara 4 vertexar i stället för 6. Sedan skapar du element buffer objectet (som ett tredje namn
bredvid `VBO` och `VAO`: `unsigned int VBO, VAO, EBO;` och `glGenBuffers(1, &EBO);`). Precis som med VBO:n binder du
EBO:n och kopierar indexen till den med `glBufferData`, den här gången med bufferttypen `GL_ELEMENT_ARRAY_BUFFER`.
Gör det medan VAO:n är bunden, direkt efter VBO:ns data:

```cpp
glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);
```

En VAO håller också reda på bindningar av element buffer objects: det senaste EBO som binds medan en VAO är bunden
sparas som den VAO:ns element buffer object. Att binda VAO:n binder då automatiskt även EBO:n. Det är också därför du
**inte** får avbinda EBO:n medan VAO:n är bunden – då skulle VAO:n stå utan EBO:

```cpp
// remember: do NOT unbind the EBO while a VAO is active as the bound element buffer object IS stored in the VAO; keep the EBO bound.
//glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);
```

Ta bort EBO:n i städsektionen med `glDeleteBuffers(1, &EBO);`.

Gör nu den sjunde uppgiften: byt ut vertexarna mot de fyra hörnen, lägg till indexen och EBO:n, och ta bort den i
städsektionen. Bygg & kör: eftersom loopen fortfarande anropar `glDrawArrays(GL_TRIANGLES, 0, 3)` ritar den de tre
första av de nya vertexarna – uppe till höger, nere till höger, nere till vänster – en orange rätvinklig triangel,
den nedre högra halvan av rektangeln.

För att rita med indexen byter du ut `glDrawArrays` mot `glDrawElements`:

```cpp
glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);
```

Det första argumentet är läget, som med `glDrawArrays`. Det andra är antalet element som ska ritas: 6 index, alltså
6 vertexar totalt. Det tredje är indexens typ, `GL_UNSIGNED_INT`. Det sista argumentet är en offset i EBO:n (eller en
indexarray, när du inte använder något EBO – det gör vi inte här). `glDrawElements` tar sina index från det EBO som är
bundet till `GL_ELEMENT_ARRAY_BUFFER`, och det tar VAO:n med sig. Annars skulle du behöva binda motsvarande EBO varje
gång du renderar ett objekt med index – det gör en VAO åt dig.

Gör nu den åttonde uppgiften: byt ut `glDrawArrays` mot `glDrawElements` och tryck på **Bygg & kör**. Du ska se en
orange rektangel som täcker pixlarna (200, 150) till (600, 450).
:::
:::vulkan
I Vulkan är en indexbuffert en `VkBuffer` precis som vertexbufferten – bara med en annan användning. Indexen är en
`std::vector<uint16_t>`:

```cpp
const std::vector<uint16_t> indices = {
    0, 1, 2, 2, 3, 0
};
```

`uint16_t` räcker så länge du har färre än 65 536 unika vertexar. `createIndexBuffer()` är `createVertexBuffer()`
med tre ändringar: storleken är `sizeof(indices[0]) * indices.size()`, användningen är
`VK_BUFFER_USAGE_INDEX_BUFFER_BIT`, och den kopierar `indices.data()` till `indexBuffer` / `indexBufferMemory`:

```cpp
void createIndexBuffer() {
    VkBufferCreateInfo bufferInfo{};
    bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
    bufferInfo.size = sizeof(indices[0]) * indices.size();
    bufferInfo.usage = VK_BUFFER_USAGE_INDEX_BUFFER_BIT;
    bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

    if (vkCreateBuffer(device, &bufferInfo, nullptr, &indexBuffer) != VK_SUCCESS) {
        throw std::runtime_error("failed to create index buffer!");
    }

    VkMemoryRequirements memRequirements;
    vkGetBufferMemoryRequirements(device, indexBuffer, &memRequirements);

    VkMemoryAllocateInfo allocInfo{};
    allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
    allocInfo.allocationSize = memRequirements.size;
    allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT);

    if (vkAllocateMemory(device, &allocInfo, nullptr, &indexBufferMemory) != VK_SUCCESS) {
        throw std::runtime_error("failed to allocate index buffer memory!");
    }

    vkBindBufferMemory(device, indexBuffer, indexBufferMemory, 0);

    void* data;
    vkMapMemory(device, indexBufferMemory, 0, bufferInfo.size, 0, &data);
        memcpy(data, indices.data(), (size_t) bufferInfo.size);
    vkUnmapMemory(device, indexBufferMemory);
}
```

(vulkan-tutorial använder en staging buffer för båda buffertarna vid det här laget; det här projektet behåller
host-visible-minne för båda, som förklarades i *Vertexindata*.) Den anropas i `initVulkan()` direkt efter
`createVertexBuffer()`, och `cleanup()` förstör bufferten och frigör dess minne, som för vertexbufferten.

Gör nu den åttonde uppgiften: lägg till `indices`, medlemmarna `indexBuffer` och `indexBufferMemory`,
`createIndexBuffer()`, anropet och städningen. Bygg & kör: bilden ändras inte – indexbufferten finns, men
ritkommandot använder den inte än.

För att rita rektangeln blir vertexarna de fyra hörnen. Kom ihåg att y pekar nedåt i Vulkan:

```cpp
const std::vector<Vertex> vertices = {
    {{-0.5f, -0.5f, 0.0f}},
    {{0.5f, -0.5f, 0.0f}},
    {{0.5f, 0.5f, 0.0f}},
    {{-0.5f, 0.5f, 0.0f}}
};
```

Det är uppe till vänster, uppe till höger, nere till höger, nere till vänster. Trianglarna `0, 1, 2` (uppe till
vänster, uppe till höger, nere till höger) och `2, 3, 0` (nere till höger, nere till vänster, uppe till vänster) går
båda medurs på skärmen, så ingen av dem cullas. I `recordCommandBuffer()` binder du indexbufferten och byter ut
`vkCmdDraw` mot `vkCmdDrawIndexed`:

```cpp
vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT16);

vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);
```

`vkCmdBindIndexBuffer` tar bufferten, en byte-offset i den och indexens typ – `VK_INDEX_TYPE_UINT16` för
`uint16_t`. Till skillnad från vertexbuffertar är det alltid bara en indexbuffert som är bunden. `vkCmdDrawIndexed`
tar antalet index (6), antalet instanser (1), första index (0), en offset som läggs till varje index (0) och första
instansen (0).

Gör nu den nionde uppgiften: ändra `vertices` till de fyra hörnen, bind indexbufferten och rita med
`vkCmdDrawIndexed`. Tryck på **Bygg & kör**: du ska se en orange rektangel som täcker pixlarna (200, 150) till
(600, 450).
:::
:::d3d12
I Direct3D 12 är en indexbuffert en resurs precis som vertexbufferten. Först byter du ut triangelns vertexar mot
rektangelns fyra hörn, i samma ordning som learnopengl:

```cpp
// Define the four corners of a rectangle.
Vertex vertices[] =
{
    { { 0.5f, 0.5f, 0.0f } },     // top right
    { { 0.5f, -0.5f, 0.0f } },    // bottom right
    { { -0.5f, -0.5f, 0.0f } },   // bottom left
    { { -0.5f, 0.5f, 0.0f } }     // top left
};
```

Gör nu den sjunde uppgiften: byt ut vertexarna. Bygg & kör: `DrawInstanced(3, 1, 0, 0)` ritar fortfarande bara de
tre första vertexarna – uppe till höger, nere till höger, nere till vänster. Det går medurs på skärmen, så den cullas
inte: du ser en orange rätvinklig triangel, den nedre högra halvan av rektangeln.

Indexbufferten skapas i ett eget block i `LoadAssets`, efter vertexbufferten (före synkroniseringsobjekten), precis
som vertexbufferten:

```cpp
// Create the index buffer.
{
    // The rectangle's two triangles, as indices into the vertex buffer. Both are
    // clockwise on screen (front faces): top right, bottom right, top left and
    // bottom right, bottom left, top left.
    UINT indices[] =
    {
        0, 1, 3,   // first triangle
        1, 2, 3    // second triangle
    };

    const UINT indexBufferSize = sizeof(indices);

    // An upload heap again, like the vertex buffer.
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
    CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(indexBufferSize);
    ThrowIfFailed(m_device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &bufferDesc,
        D3D12_RESOURCE_STATE_GENERIC_READ,
        nullptr,
        IID_PPV_ARGS(&m_indexBuffer)));

    // Copy the indices to the index buffer.
    UINT8* pIndexDataBegin = nullptr;
    CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
    ThrowIfFailed(m_indexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pIndexDataBegin)));
    memcpy(pIndexDataBegin, indices, sizeof(indices));
    m_indexBuffer->Unmap(0, nullptr);

    // Initialize the index buffer view: 32-bit indices (UINT).
    m_indexBufferView.BufferLocation = m_indexBuffer->GetGPUVirtualAddress();
    m_indexBufferView.Format = DXGI_FORMAT_R32_UINT;
    m_indexBufferView.SizeInBytes = indexBufferSize;
}
```

Index buffer view har ett `Format` i stället för en stride: `DXGI_FORMAT_R32_UINT` för 32-bitars index (`UINT`).
(Med `uint16_t`-index skulle det vara `DXGI_FORMAT_R16_UINT`.) Resursen och viewn är nya medlemmar i klassen:

```cpp
ComPtr<ID3D12Resource> m_indexBuffer;
D3D12_INDEX_BUFFER_VIEW m_indexBufferView = {};
```

I `PopulateCommandList` binder du indexbufferten och ritar med `DrawIndexedInstanced` i stället för `DrawInstanced`:

```cpp
m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
m_commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);
m_commandList->IASetIndexBuffer(&m_indexBufferView);
m_commandList->DrawIndexedInstanced(6, 1, 0, 0, 0);
```

`DrawIndexedInstanced` tar antalet index per instans (6), antalet instanser (1), första index (0), ett värde som
läggs till varje index innan vertexen läses (*base vertex*, 0) och första instansen (0).

Gör nu den åttonde uppgiften: lägg till de två medlemmarna, indexbuffertblocket, `IASetIndexBuffer` och
`DrawIndexedInstanced`. Tryck på **Bygg & kör**: du ska se en orange rektangel som täcker pixlarna (200, 150) till
(600, 450).
:::

```quiz
Hur mycket data använder den indexerade rektangeln?
- [ ] 6 vertexar och inga index
- [ ] 4 vertexar och 4 index
- [x] 4 vertexar och 6 index
---
Var och en av de två trianglarna behöver 3 index, men de två hörn de delar lagras bara en gång i vertexbufferten.
```

### Wireframe-läge

För att se de två trianglar som rektangeln består av kan du rita den i **wireframe-läge**: bara trianglarnas kanter
ritas, inte deras insida.

:::opengl
`glPolygonMode` styr hur OpenGL ritar sina primitiver. Lösningen till den femte uppgiften lade till den här raden,
bortkommenterad, efter vertexuppsättningen:

```cpp
//glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);
```

Det första argumentet säger att du vill tillämpa det på fram- och baksidan av alla trianglar, det andra att de ska
ritas som linjer. Alla följande ritanrop renderar trianglarna i wireframe-läge tills du sätter tillbaka
standardläget med `glPolygonMode(GL_FRONT_AND_BACK, GL_FILL)`. Prova: ta bort kommentartecknen, bygg och kör, så ser
du konturerna av de två trianglarna och deras gemensamma diagonal. Lägg tillbaka kommentaren efteråt.
:::
:::vulkan
I Vulkan är polygonläget en del av rasterizer-tillståndet i pipelinen:

```cpp
rasterizer.polygonMode = VK_POLYGON_MODE_LINE;
```

Alla lägen utom `VK_POLYGON_MODE_FILL` kräver GPU-funktionen `fillModeNonSolid`, som du måste aktivera när du skapar
den logiska enheten: i `createLogicalDevice()`, sätt `deviceFeatures.fillModeNonSolid = VK_TRUE;` före
`vkCreateDevice` (ett riktigt program skulle också kontrollera att GPU:n stöder funktionen). Utan funktionen
rapporterar valideringslagren ett fel. Det här ingår inte i uppgifterna; om du provar det, ändra tillbaka båda
raderna efteråt. Och eftersom polygonläget är inbakat i pipelinen betyder växling mellan wireframe och fyllt medan
programmet körs att du behöver två pipelines.
:::
:::d3d12
I Direct3D 12 är fill mode en del av rasterizer-tillståndet i PSO:n. För att se trianglarna lägger du till den här
raden efter `psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);`:

```cpp
psoDesc.RasterizerState.FillMode = D3D12_FILL_MODE_WIREFRAME;
```

Bygg och kör, så ser du konturerna av de två trianglarna och deras gemensamma diagonal. Ta bort raden efteråt –
standard är `D3D12_FILL_MODE_SOLID`. Eftersom fill mode är inbakat i PSO:n betyder växling mellan wireframe och
fyllt medan programmet körs att du behöver två pipeline state-objekt.
:::

Om du lyckades rita en triangel eller en rektangel precis som i det här kapitlet: grattis! Du har tagit dig förbi en
av de svåraste delarna av modern grafikprogrammering – att rita din första triangel. Det är en svår del, eftersom det
krävs mycket kunskap innan du kan rita något alls. Som tur är har du nu tagit dig över den tröskeln, och de kommande
kapitlen blir förhoppningsvis mycket lättare att förstå.

## Ytterligare resurser

:::opengl
- [Hello Triangle](https://learnopengl.com/Getting-started/Hello-Triangle) på learnopengl.com – originalkapitlet, med
  diagram över pipelinen och vertexdatan.
- Kapitlets källkod: [hello_triangle.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/1.getting_started/2.1.hello_triangle/hello_triangle.cpp)
  och [hello_triangle_indexed.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/1.getting_started/2.2.hello_triangle_indexed/hello_triangle_indexed.cpp).
- [Vertex Specification](https://www.khronos.org/opengl/wiki/Vertex_Specification) i OpenGL-wikin – VBO:er, VAO:er
  och vertexattribut på djupet.
- [Rendering Pipeline Overview](https://www.khronos.org/opengl/wiki/Rendering_Pipeline_Overview) i OpenGL-wikin.
:::
:::vulkan
- vulkan-tutorial.com: [Graphics pipeline basics](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Introduction),
  [Shader modules](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Shader_modules) och
  [Fixed functions](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Fixed_functions).
- vulkan-tutorial.com: [Vertex input description](https://vulkan-tutorial.com/Vertex_buffers/Vertex_input_description),
  [Vertex buffer creation](https://vulkan-tutorial.com/Vertex_buffers/Vertex_buffer_creation) och
  [Index buffer](https://vulkan-tutorial.com/Vertex_buffers/Index_buffer).
- [Hello Triangle](https://learnopengl.com/Getting-started/Hello-Triangle) på learnopengl.com – kapitlet som det här
  följer, med diagram över pipelinen.
:::
:::d3d12
- [Creating a basic Direct3D 12 component](https://learn.microsoft.com/en-us/windows/win32/direct3d12/creating-a-basic-direct3d-12-component)
  på Microsoft Learn – går igenom exemplet HelloTriangle.
- [Root signatures](https://learn.microsoft.com/en-us/windows/win32/direct3d12/root-signatures) och
  [Managing graphics pipeline state in Direct3D 12](https://learn.microsoft.com/en-us/windows/win32/direct3d12/managing-graphics-pipeline-state-in-direct3d-12).
- [Semantics](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-semantics) i
  HLSL-referensen.
- [Hello Triangle](https://learnopengl.com/Getting-started/Hello-Triangle) på learnopengl.com – kapitlet som det här
  följer, med diagram över pipelinen.
:::

## Övningar

För att verkligen förstå begreppen som tagits upp finns några övningar. Det är bra att arbeta igenom dem innan du
går vidare till nästa ämne, så att du har koll på vad som händer. Projektet är ditt att ändra i: prova övningarna i
editorn, och använd **Återställ** om du vill få tillbaka kapitlets sluttillstånd.

:::opengl
1. Försök rita 2 trianglar bredvid varandra med `glDrawArrays` genom att lägga till fler vertexar i din data.
   [Lösning](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/1.getting_started/2.3.hello_triangle_exercise1/hello_triangle_exercise1.cpp).
2. Skapa nu samma 2 trianglar med två olika VAO:er och VBO:er för deras data.
   [Lösning](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/1.getting_started/2.4.hello_triangle_exercise2/hello_triangle_exercise2.cpp).
3. Skapa två shaderprogram där det andra programmet använder en annan fragment shader som ger färgen gul; rita båda
   trianglarna igen så att den ena blir gul.
   [Lösning](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/1.getting_started/2.5.hello_triangle_exercise3/hello_triangle_exercise3.cpp).
:::
:::vulkan
1. Rita 2 trianglar bredvid varandra med `vkCmdDraw` genom att lägga till fler vertexar i `vertices` (6 vertexar,
   ritade utan indexbufferten). Låt varje triangel gå medurs på skärmen – kom ihåg att y pekar nedåt.
2. Skapa nu samma 2 trianglar med två olika vertexbuffertar: bind den första med `vkCmdBindVertexBuffers` och rita
   den, bind sedan den andra och rita igen.
3. Skapa en andra grafikpipeline med en annan fragment shader som ger färgen gul; bind den första pipelinen och rita
   en triangel, bind sedan den andra pipelinen och rita den andra.
:::
:::d3d12
1. Rita 2 trianglar bredvid varandra med `DrawInstanced` genom att lägga till fler vertexar i `vertices` (6 vertexar,
   ritade utan indexbufferten). Låt varje triangel gå medurs på skärmen, annars cullas den.
2. Skapa nu samma 2 trianglar med två olika vertexbuffertar, var och en med sin egen vertex buffer view: sätt den
   första med `IASetVertexBuffers` och rita, sätt sedan den andra och rita igen.
3. Skapa ett andra pipeline state-objekt med en annan pixel shader som ger färgen gul (en andra funktion i
   `shaders.hlsl`, kompilerad med sin egen ingångspunkt); rita en triangel med den första PSO:n, byt sedan med
   `SetPipelineState` och rita den andra.
:::
