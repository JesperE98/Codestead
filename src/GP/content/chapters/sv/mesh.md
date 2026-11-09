# Mesh

Med Assimp kan vi läsa in många olika modeller i programmet, men när de väl är inlästa ligger de lagrade i Assimps
datastrukturer. Det vi till slut vill är att omvandla den datan till ett format som {{api}} förstår, så att vi kan
rendera objekten. Vi lärde oss i förra kapitlet att en mesh representerar en enda ritbar enhet, så låt oss börja med
att definiera en egen mesh.

Låt oss repetera lite av det vi lärt oss hittills för att fundera över vilken data en mesh minst bör ha. En mesh
behöver åtminstone en uppsättning vertexar, där varje vertex innehåller en positionsvektor, en normalvektor och en
texturkoordinatvektor. En mesh bör också innehålla index för indexerad ritning, och materialdata i form av texturer
(diffuse/specular maps).

```quiz
Vad behöver en mesh minst, för att den ska kunna ritas på egen hand?
- [ ] Bara sina vertexpositioner; normaler och texturer hör till modellen
- [x] Sina vertexar (position, normal, texturkoordinater), indexen för sina trianglar och sitt materials texturer (diffuse och specular maps)
- [ ] En nodhierarki, som Assimps scen
---
Allt som en ritning av meshen läser: vertexattributen som shadrarna tar emot, indexen som bildar trianglarna och materialets ljuskartor. Hierarkin och samlingen av meshar är modellens sak – nästa kapitel.
```

:::opengl
Nu när vi har bestämt minimikraven för en meshklass kan vi definiera en vertex i OpenGL. `// TODO:`-kommentarerna i
`mesh.h` markerar var koden ska in; filen har redan sin include guard och sina includes (`glad`, `glm`,
`"shader_m.h"`, `<string>` och `<vector>`):

```cpp
struct Vertex {
    // position
    glm::vec3 Position;
    // normal
    glm::vec3 Normal;
    // texCoords
    glm::vec2 TexCoords;
};
```

Vi lagrar alla nödvändiga vertexattribut i en struct som heter `Vertex`. Bredvid structen `Vertex` vill vi också
organisera texturdatan i en struct `Texture`:

```cpp
struct Texture {
    unsigned int id;
    std::string type; // e.g. "texture_diffuse" or "texture_specular"
    std::string path; // the file it was loaded from (to load every file only once)
};
```

Vi lagrar texturens id och dess typ, till exempel en diffuse- eller specular-textur. `path` är namnet på filen som
texturen kom från; learnopengl lägger till den i kapitlet *Model*, där den gör att modellen läser in varje bildfil
bara en gång – vi lägger till den direkt. (Till skillnad från learnopengls `mesh.h` skriver koden ut `std::vector` och
`std::string`: en header bör inte säga `using namespace std;` åt varje fil som inkluderar den. Vertexen har bara det
som OpenGL 3.3 behöver här – learnopengls tangenter, bitangenter och bendata hör till senare kapitel.)

Gör nu den första uppgiften, **vertex-struct**, och tryck på **Build & run** (Ctrl+Enter). Ingenting ändras på
skärmen – och det kommer inget att göra i det här kapitlet: precis som i learnopengls kapitel *Mesh* skriver vi bara
klassen här; kapitlet *Model* skapar mesharna och ritar dem. Varje steg kompilerar och körs ändå.

När vi vet hur en vertex och en textur faktiskt representeras kan vi börja definiera meshklassens struktur:

```cpp
class Mesh {
public:
    // mesh Data
    std::vector<Vertex>       vertices;
    std::vector<unsigned int> indices;
    std::vector<Texture>      textures;
    unsigned int VAO;

    // constructor
    Mesh(std::vector<Vertex> vertices, std::vector<unsigned int> indices, std::vector<Texture> textures)
    {
        this->vertices = vertices;
        this->indices = indices;
        this->textures = textures;

        // now that we have all the required data, set the vertex buffers and its attribute pointers.
        setupMesh();
    }

    // render the mesh
    void Draw(Shader &shader)
    ...
private:
    // render data
    unsigned int VBO, EBO;

    // initializes all the buffer objects/arrays
    void setupMesh()
    ...
};
```

Som du ser är klassen inte särskilt komplicerad. I konstruktorn ger vi meshen all nödvändig data, vi initierar
buffrarna i funktionen `setupMesh`, och till sist ritar vi meshen med funktionen `Draw`. Lägg märke till att vi ger
funktionen `Draw` en shader; genom att skicka shadern till meshen kan vi sätta flera uniforms innan vi ritar (som att
koppla samplers till texturenheter).

Konstruktorns innehåll är ganska rättframt. Vi sätter helt enkelt klassens publika variabler till konstruktorns
motsvarande argument – parametrarna har samma namn som medlemmarna, så `this->` säger vilken som är vilken. Vi anropar
också funktionen `setupMesh` i konstruktorn.

Gör nu uppgiften **mesh-data**: de fyra medlemmarna under `// mesh Data` och konstruktorn. `Draw` och `setupMesh`
finns redan med tomma kroppar; nästa uppgifter fyller dem.
:::
:::vulkan
I Vulkan motsvaras delarna av learnopengls klass `Mesh` av vulkan-tutorials grundarbete för att läsa in modeller: en
`Vertex` med allt som en modells vertex har, meshens data i `std::vector<Vertex> vertices` och
`std::vector<uint32_t> indices`, en vertex buffer och en index buffer i device-local minne, och en indexerad ritning.
Vulkan-program – vulkan-tutorials också – har dem som medlemmar i programklassen; en separat klass `Mesh` skulle
innehålla exakt samma buffrar. En meshs texturer kommer i nästa kapitel, tillsammans med modellens material.

Projektet är det du tittade på i kapitlet *Assimp*. `// TODO:`-kommentarerna i `main.cpp` och i de två shadrarna
markerar var din kod ska in. Än så länge har `Vertex` bara en position:

```cpp
// One vertex of a mesh. For now it only has a position.
struct Vertex {
    // TODO: the vertex's data: its position, normal, texture coordinates and the index of its material
    glm::vec3 pos;
```

Nu när vi har bestämt minimikraven för en mesh kan vi definiera dess vertex: en position, en normal och
texturkoordinater, som i learnopengl – och en medlem till, numret på materialet som vertexen hör till:

```cpp
// One vertex of a mesh: everything a vertex of a model has.
struct Vertex {
    glm::vec3 pos;
    glm::vec3 normal;
    glm::vec2 texCoord;
    uint32_t materialIndex; // which of the model's materials the vertex's triangle has (0, 1, ...)
```

Varför ett materialnummer i varje vertex? learnopengl ritar en modell mesh för mesh och binder varje meshs texturer
före dess draw-anrop. Vårt Vulkan-program kommer att lägga hela modellen – planet och ring – i en enda vertex buffer
och rita den med ett enda draw-anrop, som vulkan-tutorial gör; fragment shadern väljer sedan texturerna för
fragmentets material utifrån det här numret (kapitlet *Model*). Planetens och ringens vertexar har aldrig samma
materialnummer, så de förblir separata vertexar även där deras positioner skulle sammanfalla.
:::
:::d3d12
DirectX 12 har ingen egen meshklass, så vi portar learnopengls `mesh.h` – `struct Vertex`, `struct Texture` och
`class Mesh` med sin data, konstruktor, `SetupMesh` och `Draw` – till `main.cpp`, på filnivå före `class D3D12App`.
Projektet är det du tittade på i kapitlet *Assimp*; de två `// TODO:`-kommentarerna före `class D3D12App` markerar var
koden ska in.

Nu när vi har bestämt minimikraven för en meshklass kan vi definiera en vertex i Direct3D 12:

```cpp
// A vertex of a mesh: the layout of the vertex buffer, which the input layout describes
// (POSITION at byte 0, NORMAL at byte 12, TEXCOORD at byte 24).
struct Vertex
{
    // position
    XMFLOAT3 position;
    // normal
    XMFLOAT3 normal;
    // texCoords
    XMFLOAT2 texCoord;
};
```

Vi lagrar alla nödvändiga vertexattribut i en struct som heter `Vertex`. Bredvid structen `Vertex` vill vi också
organisera texturdatan i en struct `Texture`:

```cpp
// A texture of a mesh: the image in GPU memory, what it is used for and the file it came from.
struct Texture
{
    ComPtr<ID3D12Resource> resource;    // the texture (learnopengl's texture id)
    std::string type;                   // "texture_diffuse" or "texture_specular"
    std::string path;                   // the file name, as the material names it
};
```

Där OpenGL hänvisar till en textur med ett id har Direct3D 12 själva texturresursen, så `Texture` innehåller en
`ComPtr<ID3D12Resource>` – som också håller texturen vid liv så länge en mesh använder den. `type` säger om det är en
diffuse map eller en specular map, och `path` är namnet på filen den kom från; learnopengl lägger till det i kapitlet
*Model*, där det gör att modellen läser in varje bildfil bara en gång – vi lägger till det direkt.

Gör nu den första uppgiften, **vertex**, och tryck på **Build & run** (Ctrl+Enter). Ingenting ändras på skärmen – och
det kommer inget att göra i det här kapitlet: precis som i learnopengls kapitel *Mesh* skriver vi bara klassen här;
kapitlet *Model* skapar mesharna och ritar dem. Varje steg kompilerar och körs ändå.

När vi vet hur en vertex och en textur faktiskt representeras kan vi börja definiera meshklassens struktur:

```cpp
class Mesh
{
public:
    // mesh Data
    std::vector<Vertex>  vertices;
    std::vector<UINT>    indices;
    std::vector<Texture> textures;

    // constructor: srvCpuHandle and srvGpuHandle are the mesh's two slots in the CBV/SRV
    // heap (where the CPU writes its texture views, and where the GPU reads them).
    Mesh(std::vector<Vertex> vertices, std::vector<UINT> indices, std::vector<Texture> textures,
        ID3D12Device* device, CD3DX12_CPU_DESCRIPTOR_HANDLE srvCpuHandle, CD3DX12_GPU_DESCRIPTOR_HANDLE srvGpuHandle)
    {
        this->vertices = vertices;
        this->indices = indices;
        this->textures = textures;
        m_srvHandle = srvGpuHandle;

        // now that we have all the required data, create the buffers and the views.
        SetupMesh(device, srvCpuHandle);
    }

    // render the mesh
    void Draw(ID3D12GraphicsCommandList* commandList)
    {
        // TODO: bind the mesh's textures (root parameter 2) and draw it (its vertex and index buffers, DrawIndexedInstanced)
    }

private:
    // render data
    ComPtr<ID3D12Resource> m_vertexBuffer;
    ComPtr<ID3D12Resource> m_indexBuffer;
    D3D12_VERTEX_BUFFER_VIEW m_vertexBufferView = {};
    D3D12_INDEX_BUFFER_VIEW m_indexBufferView = {};
    D3D12_GPU_DESCRIPTOR_HANDLE m_srvHandle = {};    // the first of the mesh's two SRVs

    // initializes all the buffers and views
    void SetupMesh(ID3D12Device* device, CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle)
    {
        // TODO: the vertex buffer and the index buffer, and their views

        // TODO: the shader resource views of the mesh's textures (diffuse in the first slot, specular in the second)
    }
};
```

Som du ser är klassen inte särskilt komplicerad. I konstruktorn ger vi meshen all nödvändig data, vi skapar buffrarna
i funktionen `SetupMesh`, och till sist ritar vi meshen med funktionen `Draw`. Indexen är `UINT`, 32-bitars
heltal utan tecken – learnopengls `unsigned int`. Konstruktorns innehåll är ganska rättframt: vi sätter klassens
publika variabler till konstruktorns motsvarande argument (parametrarna har samma namn som medlemmarna, så `this->`
säger vilken som är vilken), och anropar `SetupMesh`.

Konstruktorn tar emot tre saker som learnopengls inte gör, eftersom Direct3D 12 gör uttryckligen det som OpenGL gör i
det dolda:

- `device` – OpenGL skapar buffrar i den aktuella kontexten; i Direct3D 12 skapas varje resurs och vy av devicen.
- `srvCpuHandle` och `srvGpuHandle` – learnopengl binder en meshs texturer till texturenheter precis innan den ritar.
  I Direct3D 12 läser shadern texturer genom shader resource views i CBV/SRV-heapen. Varje mesh får två intilliggande
  platser i heapen: den första för sin diffuse map (t0, `texture_diffuse1`), den andra för sin specular map (t1,
  `texture_specular1`). CPU-handtaget är där `SetupMesh` skriver vyerna; GPU-handtaget är det som `Draw` ger command
  listen, så konstruktorn sparar det i `m_srvHandle`.

Projektets heap har plats för det: `cbvSrvHeapDesc.NumDescriptors = 1 + 2 * MaxMeshes;` – CBV:n på plats 0 och två
SRV:er för var och en av upp till `MaxMeshes` (8) meshar. Vem som delar ut platserna är kapitlet *Model*s sak.

Gör nu uppgiften **mesh-class**: klassen som ovan. `Draw` och `SetupMesh` förblir TODO:er till nästa uppgifter.
:::

## Initiering

:::opengl
Tack vare konstruktorn har vi nu stora listor med meshdata som vi kan använda för att rendera. Vi behöver dock sätta
upp lämpliga buffrar och ange vertex shaderns layout med vertex attribute pointers. Vid det här laget bör du inte ha
några problem med de begreppen, men vi har kryddat det lite den här gången genom att lägga vertexdatan i structar:

```cpp
    void setupMesh()
    {
        // create buffers/arrays
        glGenVertexArrays(1, &VAO);
        glGenBuffers(1, &VBO);
        glGenBuffers(1, &EBO);

        glBindVertexArray(VAO);
        // load data into vertex buffers
        glBindBuffer(GL_ARRAY_BUFFER, VBO);
        // A great thing about structs is that their memory layout is sequential for all its items.
        // The effect is that we can simply pass a pointer to the struct and it translates perfectly to a glm::vec3/2 array which
        // again translates to 3/2 floats which translates to a byte array.
        glBufferData(GL_ARRAY_BUFFER, vertices.size() * sizeof(Vertex), &vertices[0], GL_STATIC_DRAW);

        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
        glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(unsigned int), &indices[0], GL_STATIC_DRAW);

        // set the vertex attribute pointers
        // vertex Positions
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)0);
        // vertex normals
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Normal));
        // vertex texture coords
        glEnableVertexAttribArray(2);
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, TexCoords));
        glBindVertexArray(0);
    }
```

Koden skiljer sig inte mycket från vad du kan förvänta dig, men några små knep används med hjälp av structen
`Vertex`.

Structar har den fina egenskapen i C++ att deras minneslayout är sekventiell. Det vill säga, om vi skulle se en
struct som en array av data skulle den bara innehålla structens variabler i ordning, vilket direkt motsvarar den
float-array (egentligen byte-array) vi vill ha till en array buffer. Om vi till exempel har en ifylld `Vertex`-struct
ser dess minneslayout ut så här:

```cpp
Vertex vertex;
vertex.Position  = glm::vec3(0.2f, 0.4f, 0.6f);
vertex.Normal    = glm::vec3(0.0f, 1.0f, 0.0f);
vertex.TexCoords = glm::vec2(1.0f, 0.0f);
// = [0.2f, 0.4f, 0.6f, 0.0f, 1.0f, 0.0f, 1.0f, 0.0f];
```

Tack vare den här användbara egenskapen kan vi direkt skicka en pekare till en stor lista med `Vertex`-structar som
bufferns data, och de motsvarar precis det som `glBufferData` förväntar sig som argument:

```cpp
glBufferData(GL_ARRAY_BUFFER, vertices.size() * sizeof(Vertex), &vertices[0], GL_STATIC_DRAW);
```

Operatorn `sizeof` kan förstås också användas på structen för att få rätt storlek i byte. Den bör vara `32` byte
(8 floats à 4 byte).

En annan bra användning av structar är preprocessormakrot `offsetof(s,m)`, som tar en struct som första argument och
namnet på en av structens variabler som andra argument. Makrot returnerar variabelns avstånd i byte från structens
början. Det passar perfekt för offset-parametern till funktionen `glVertexAttribPointer`:

```cpp
glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Normal));
```

Offseten anges nu med makrot `offsetof`, som i det här fallet sätter normalvektorns byteoffset till normalattributets
byteoffset i structen, vilket är `3` floats och alltså `12` byte.

Att använda en struct på det här sättet ger oss inte bara mer lättläst kod, utan låter oss också enkelt bygga ut
strukturen. Vill vi ha ett vertexattribut till kan vi helt enkelt lägga till det i structen, och tack vare dess
flexibla natur går renderingskoden inte sönder.

Location 0, 1 och 2 är de som `model_loading.vs` deklarerar: `aPos`, `aNormal` och `aTexCoords`. Buffrarna `VBO` och
`EBO` är privata medlemmar, under `// render data` – bara `setupMesh` behöver dem; VAO:n är publik, eftersom den kommer
ihåg allt som ritningen behöver.

Gör nu uppgiften **setup-mesh**: `unsigned int VBO, EBO;` och kroppen i `setupMesh` som ovan.
:::
:::vulkan
Tack vare structen har vi nu en beskrivning av meshdatan, och vi behöver tala om för Vulkan hur en vertex är uppbyggd,
precis som kubens vertexar har beskrivits sedan *Hello Triangle*. En structs medlemmar ligger efter varandra i
minnet, så en array av `Vertex` är en sammanflätad (interleaved) vertex buffer: position, normal, texturkoordinater
och materialnummer, vertex efter vertex. Bindningsbeskrivningen behåller sin stride `sizeof(Vertex)`, och
`getAttributeDescriptions()` växer till fyra attribut, vart och ett hittat med `offsetof` – en medlems avstånd i byte
från structens början:

```cpp
    static std::array<VkVertexInputAttributeDescription, 4> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 4> attributeDescriptions{};

        attributeDescriptions[0].binding = 0;
        attributeDescriptions[0].location = 0;
        attributeDescriptions[0].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[0].offset = offsetof(Vertex, pos);

        attributeDescriptions[1].binding = 0;
        attributeDescriptions[1].location = 1;
        attributeDescriptions[1].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[1].offset = offsetof(Vertex, normal);

        attributeDescriptions[2].binding = 0;
        attributeDescriptions[2].location = 2;
        attributeDescriptions[2].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[2].offset = offsetof(Vertex, texCoord);

        // an integer: one 32-bit unsigned int (a uint in the shader)
        attributeDescriptions[3].binding = 0;
        attributeDescriptions[3].location = 3;
        attributeDescriptions[3].format = VK_FORMAT_R32_UINT;
        attributeDescriptions[3].offset = offsetof(Vertex, materialIndex);

        return attributeDescriptions;
    }
```

Materialnumret är kursens första heltalsattribut. Dess format är `VK_FORMAT_R32_UINT` – ett 32-bitars heltal utan
tecken, som skickas vidare som det är – och shadern måste deklarera det med en heltalstyp, `uint`: formatets numeriska
typ och shaderns typ måste stämma överens. (Ett flyttalsformat som `VK_FORMAT_R32_SFLOAT` skulle leverera en float.)
Offseten är 0, 12, 24 och 32, och `sizeof(Vertex)` är 36 byte.

Vår hjälpfunktion `createPipeline()` använder bara de första `attributeCount` attributen, så pipelinen måste nu läsa
alla fyra:

```cpp
        createPipeline("shaders/model_loading.vert.spv", "shaders/model_loading.frag.spv", 4, modelPipeline); // all four attributes of a Vertex
```

Vertex shadern deklarerar de nya indata och skickar texturkoordinaterna vidare:

```glsl
layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in vec2 inTexCoord;
layout(location = 3) in uint inMaterialIndex;

layout(location = 2) out vec2 fragTexCoord;

void main() {
    fragTexCoord = inTexCoord;
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
```

Det finns inga texturer än, så fragment shadern visar texturkoordinaterna som en färg – u som rött, v som grönt. Det
är ett vanligt sätt att kontrollera texturkoordinater innan någon textur är inblandad:

```glsl
layout(location = 2) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    // no textures yet: show the texture coordinates as a colour (red = u, green = v)
    outColor = vec4(fragTexCoord, 0.0, 1.0);
}
```

Normalen och materialnumret läses men används inte än; kapitlet *Model* skickar materialnumret vidare. (Ett heltal
som skickas från vertex shadern till fragment shadern måste deklareras `flat`: det kan inte interpoleras mellan en
triangels hörn.)

Gör nu den första uppgiften, **vertex**, och tryck på **Build & run** (Ctrl+Enter). Ingenting ritas än – fönstret
förblir mörkgrått – eftersom inget anropar ett draw-kommando; det kommer med den sista uppgiften.

### Jämföra vertexar

Kapitlet *Model* kommer att bygga vertexarna av `.obj`-filens tripplar av position/texturkoordinat/normal, och många
tripplar upprepas: ett hörn som delas av sex trianglar förekommer sex gånger. vulkan-tutorials "Loading models"
behåller varje olik vertex bara en gång, med en `std::unordered_map<Vertex, uint32_t>` som avbildar en vertex på dess
index. En nyckel i en `unordered_map` behöver två saker: ett sätt att jämföra två nycklar, och en hashfunktion.
Jämförelsen är en `operator==` i `Vertex`:

```cpp
    bool operator==(const Vertex& other) const {
        return pos == other.pos && normal == other.normal && texCoord == other.texCoord && materialIndex == other.materialIndex;
    }
```

Hashfunktionen är en specialisering av `std::hash` för `Vertex`, efter structen. Den kombinerar medlemmarnas hashvärden
med vulkan-tutorials skiftningar och xor (utökad med materialnumret):

```cpp
// A hash function for Vertex, so that it can be the key of an std::unordered_map: it combines the hashes of the members.
namespace std {
    template<> struct hash<Vertex> {
        size_t operator()(Vertex const& vertex) const {
            return ((((hash<glm::vec3>()(vertex.pos) ^ (hash<glm::vec3>()(vertex.normal) << 1)) >> 1) ^ (hash<glm::vec2>()(vertex.texCoord) << 1)) >> 1) ^ (hash<uint32_t>()(vertex.materialIndex) << 1);
        }
    };
}
```

Lika vertexar ger lika hashvärden, vilket är allt en `unordered_map` kräver; olika vertexar *kan* krocka, och då
använder tabellen `operator==` för att skilja dem åt. Hashfunktionerna för `glm::vec3` och `glm::vec2` kommer från
glm:s `gtx/hash.hpp`, ett "experimentellt" tillägg som måste slås på innan glm inkluderas:

```cpp
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
// glm's hash functions (gtx/hash.hpp) are an "experimental" extension
#define GLM_ENABLE_EXPERIMENTAL
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtx/hash.hpp>
```

Gör nu uppgiften **vertex-equality**. Bilden ändras inte.

### Meshdatan

learnopengls mesh lagrar sina vertexar och index i två vektorer; det gör även vår programklass, som medlemmar:

```cpp
    // The mesh's data: its vertices and, three per triangle, the indices of the triangles' vertices.
    // A test mesh for now, a square (the next chapter loads a model instead).
    std::vector<Vertex> vertices = {
        {{-1.0f, -1.0f, 0.0f}, {0.0f, 0.0f, 1.0f}, {0.0f, 1.0f}, 0}, // bottom left
        {{ 1.0f, -1.0f, 0.0f}, {0.0f, 0.0f, 1.0f}, {1.0f, 1.0f}, 0}, // bottom right
        {{ 1.0f,  1.0f, 0.0f}, {0.0f, 0.0f, 1.0f}, {1.0f, 0.0f}, 0}, // top right
        {{-1.0f,  1.0f, 0.0f}, {0.0f, 0.0f, 1.0f}, {0.0f, 0.0f}, 0}  // top left
    };
    std::vector<uint32_t> indices = {
        0, 1, 2, 2, 3, 0
    };
```

Till skillnad från vertexarna i *Hello Triangle* är de inte `const`: nästa kapitel fyller dem från modellfilen. Och
till skillnad från learnopengls mesh är de inte tomma fram till dess: Vulkan kan inte skapa en buffer med storleken 0
(storleken i `VkBufferCreateInfo` måste vara större än 0), och nästa uppgifters buffrar skapas från de här vektorerna.
Tills modellen är inläst är meshen alltså en liten testmesh: en kvadrat på 2 × 2 enheter som är vänd mot kameran
(normal +z), med en bilds texturkoordinater – v = 0 överst, som Vulkan samplar bilder. Kapitlet *Model* ersätter den.

Gör nu uppgiften **mesh-data**. Bilden ändras inte.

### Vertex buffern

Hittills har kursens vertex buffrar legat i host-visible minne, som CPU:n kan skriva till direkt. *Hello Triangle*
nämnde att det inte är det snabbaste minnet för GPU:n att läsa, och att vulkan-tutorial förbättrar det med en
*staging buffer*. En modell har många fler vertexar än en kub, så nu gör vi det: vertexarna hamnar först i en
host-visible staging buffer, och ett kopieringskommando på GPU:n flyttar dem till en vertex buffer i device-local
minne – GPU:ns eget minne, som CPU:n ofta inte kan mappa alls. Det är samma väg som texturerna har tagit sedan kapitlet
*Textures*, med en buffer i stället för en bild i slutet:

```cpp
    void createVertexBuffer() {
        VkDeviceSize bufferSize = sizeof(vertices[0]) * vertices.size();

        // a staging buffer the CPU can write to
        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, vertices.data(), (size_t) bufferSize);
        vkUnmapMemory(device, stagingBufferMemory);

        // the vertex buffer in the GPU's own (device local) memory, filled with a copy of the staging buffer
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, vertexBuffer, vertexBufferMemory);

        copyBuffer(stagingBuffer, vertexBuffer, bufferSize);

        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
    }
```

Användningsflaggorna säger vad varje buffer är till för: staging buffern är *källan* för en överföring
(`VK_BUFFER_USAGE_TRANSFER_SRC_BIT`), vertex buffern dess *mål* och en vertex buffer
(`VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_VERTEX_BUFFER_BIT`). `createBuffer` är hjälpfunktionen från
kapitlet *Textures*. Själva kopieringen är vulkan-tutorials `copyBuffer`, som spelar in ett `vkCmdCopyBuffer` i en
engångs-command buffer – med de hjälpfunktioner som texturkoden redan använder:

```cpp
    void copyBuffer(VkBuffer srcBuffer, VkBuffer dstBuffer, VkDeviceSize size) {
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkBufferCopy copyRegion{};
        copyRegion.size = size;
        vkCmdCopyBuffer(commandBuffer, srcBuffer, dstBuffer, 1, &copyRegion);

        endSingleTimeCommands(commandBuffer);
    }
```

`endSingleTimeCommands` skickar iväg command buffern och väntar tills kön är ledig, så staging buffern kan förstöras
direkt när `copyBuffer` har returnerat. `initVulkan()` anropar redan `createVertexBuffer()` efter
`createCommandPool()` – kopieringen behöver en command buffer. Vertex buffern lever till slutet: `cleanup()` förstör
den och frigör dess minne:

```cpp
        vkDestroyBuffer(device, vertexBuffer, nullptr);
        vkFreeMemory(device, vertexBufferMemory, nullptr);
```

Gör nu uppgiften **vertex-buffer**. Bilden ändras inte.

### Index buffern

Index buffern skapas på exakt samma sätt; bara datan och användningsflaggan skiljer sig:

```cpp
    void createIndexBuffer() {
        VkDeviceSize bufferSize = sizeof(indices[0]) * indices.size();

        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, indices.data(), (size_t) bufferSize);
        vkUnmapMemory(device, stagingBufferMemory);

        createBuffer(bufferSize, VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_INDEX_BUFFER_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, indexBuffer, indexBufferMemory);

        copyBuffer(stagingBuffer, indexBuffer, bufferSize);

        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
    }
```

`sizeof(indices[0])` är 4 nu: indexen är `uint32_t`. *Hello Triangle* använde `uint16_t`, som tillåter högst 65536
olika vertexar – för få för många modeller. `cleanup()` förstör även den här buffern:

```cpp
        vkDestroyBuffer(device, indexBuffer, nullptr);
        vkFreeMemory(device, indexBufferMemory, nullptr);
```

Gör nu uppgiften **index-buffer**. Bilden ändras inte.
:::
:::d3d12
Tack vare konstruktorn har vi nu stora listor med meshdata som vi kan använda för att rendera. Vi behöver dock sätta
upp lämpliga buffrar – och i OpenGL ange vertex shaderns layout med vertex attribute pointers. I Direct3D 12 är den
layouten en del av pipeline state, och projektet har den redan: input layouten i `LoadAssets`.

```cpp
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };
```

Det här är Direct3D 12:s motsvarighet till learnopengls tre anrop av `glVertexAttribPointer`, och den stämmer med vår
`Vertex` eftersom structar har en fin egenskap i C++: deras minneslayout är sekventiell. Det vill säga, om vi skulle
se en struct som en array av data skulle den bara innehålla structens variabler i ordning. Om vi till exempel har en
ifylld `Vertex`-struct ser dess minneslayout ut så här:

```cpp
Vertex vertex;
vertex.position = XMFLOAT3(0.2f, 0.4f, 0.6f);
vertex.normal   = XMFLOAT3(0.0f, 1.0f, 0.0f);
vertex.texCoord = XMFLOAT2(1.0f, 0.0f);
// = [0.2f, 0.4f, 0.6f, 0.0f, 1.0f, 0.0f, 1.0f, 0.0f];
```

Positionen börjar på byte 0, normalen efter 3 floats på byte 12, texturkoordinaterna efter 6 floats på byte 24 –
input layoutens offset – och `sizeof(Vertex)` är 32 byte, vertex buffer-vyns stride. (`offsetof(Vertex, normal)`
skulle ge samma 12; learnopengl använder det makrot i `glVertexAttribPointer`.) Tack vare det kan vi kopiera en hel
`std::vector<Vertex>` till vertex buffern med en enda `memcpy`.

Buffrarna skapas som i *Hello Triangle*, i upload heaps – minne som CPU:n kan skriva och GPU:n kan läsa. Det är enkelt
och går bra för en liten modell; Microsofts exempel påpekar att en default heap, fylld via en upload buffer som våra
texturer, är det snabbare valet för statisk data som ritas ofta.

```cpp
        // Upload heaps, as for the cube before: simple, and fine for a small model.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from these resources on the CPU.

        // Create the vertex buffer and copy the vertices into it. A great thing about structs
        // is that their memory layout is sequential for all its items: the vector's data is
        // exactly the bytes the input layout describes.
        const UINT vertexBufferSize = static_cast<UINT>(vertices.size() * sizeof(Vertex));
        CD3DX12_RESOURCE_DESC vertexBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(vertexBufferSize);
        ThrowIfFailed(device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &vertexBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_vertexBuffer)));

        UINT8* pVertexDataBegin = nullptr;
        ThrowIfFailed(m_vertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
        memcpy(pVertexDataBegin, vertices.data(), vertexBufferSize);
        m_vertexBuffer->Unmap(0, nullptr);

        // Initialize the vertex buffer view.
        m_vertexBufferView.BufferLocation = m_vertexBuffer->GetGPUVirtualAddress();
        m_vertexBufferView.StrideInBytes = sizeof(Vertex);
        m_vertexBufferView.SizeInBytes = vertexBufferSize;
```

Index buffern följer samma mönster, med index buffer-vyn i stället för vertex buffer-vyn:

```cpp
        // Create the index buffer and copy the indices into it: 32-bit unsigned integers.
        const UINT indexBufferSize = static_cast<UINT>(indices.size() * sizeof(UINT));
        CD3DX12_RESOURCE_DESC indexBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(indexBufferSize);
        ThrowIfFailed(device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &indexBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_indexBuffer)));

        UINT8* pIndexDataBegin = nullptr;
        ThrowIfFailed(m_indexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pIndexDataBegin)));
        memcpy(pIndexDataBegin, indices.data(), indexBufferSize);
        m_indexBuffer->Unmap(0, nullptr);

        // Initialize the index buffer view.
        m_indexBufferView.BufferLocation = m_indexBuffer->GetGPUVirtualAddress();
        m_indexBufferView.Format = DXGI_FORMAT_R32_UINT;
        m_indexBufferView.SizeInBytes = indexBufferSize;
```

Formatet `DXGI_FORMAT_R32_UINT` säger att indexen är 32-bitars heltal utan tecken, våra `UINT`. (Rektangeln i *Hello
Triangle* använde dem också; `DXGI_FORMAT_R16_UINT` skulle tillåta högst 65536 olika vertexar – för få för många
modeller.) Buffrarna är `ComPtr`-medlemmar i meshen, så de lever exakt lika länge som meshen.

Gör nu uppgiften **setup-mesh**: den här koden vid den första TODO:n i `SetupMesh`. Bilden ändras inte.

### Texturernas vyer

learnopengls `Mesh` får sina texturer från modellen och binder dem, enligt en namnkonvention, när den ritas – nästa
avsnitt. I Direct3D 12 når shadern texturer genom shader resource views, så meshen skapar sina vyer en gång, i
`SetupMesh`, på sina två platser i heapen: den första diffuse-texturen på den första platsen, den första
specular-texturen på den andra.

```cpp
        // The texture views: by the naming convention, the mesh's first diffuse texture goes
        // into its first slot (t0, texture_diffuse1) and its first specular texture into the
        // second (t1, texture_specular1). A slot without a texture gets a null view (the
        // shader reads black from it).
        const char* slotTypes[] = { "texture_diffuse", "texture_specular" };
        for (UINT slot = 0; slot < _countof(slotTypes); slot++)
        {
            ID3D12Resource* resource = nullptr;
            for (UINT i = 0; i < textures.size(); i++)
            {
                if (textures[i].type == slotTypes[slot])
                {
                    resource = textures[i].resource.Get();
                    break;
                }
            }

            D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
            srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
            srvDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
            srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
            srvDesc.Texture2D.MipLevels = 1;
            device->CreateShaderResourceView(resource, &srvDesc, srvHandle);
            srvHandle.Offset(1, device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV));
        }
```

Vybeskrivningen är den från kapitlet *Textures*: en RGBA-textur med en mipnivå. Efter varje vy flyttar `Offset`
handtaget till nästa plats – med storleken på en descriptor, som devicen talar om för oss, eftersom den skiljer sig
mellan GPU:er.

Vad händer om en mesh saknar specular map? Root signaturens tabell täcker alltid två descriptors, t0 och t1, och en
plats som shadern kan läsa måste innehålla en giltig descriptor (på viss hårdvara måste varje descriptor i en bunden
tabell vara initierad, läst eller inte). Platsen får därför en *null descriptor*: `CreateShaderResourceView` med en
null-resurs och en fullständig beskrivning. Direct3D 12 definierar att läsning från den ger nollor – shadern ser
svart, så en saknad specular map betyder ingen högdager. Beskrivningen måste fyllas i ändå: den talar om för Direct3D
vilken sorts vy platsen är.

Gör nu uppgiften **mesh-textures**. Bilden ändras inte.
:::

:::opengl
```quiz
`glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, TexCoords));` – vad ger `sizeof(Vertex)` och `offsetof(Vertex, TexCoords)` för vår `Vertex`?
- [ ] 8 och 6: antalet floats i en vertex och före texturkoordinaterna
- [x] 32 och 24: en vertex är 8 floats à 4 byte, och texturkoordinaterna kommer efter 3 + 3 floats
- [ ] 32 och 0: varje attribut börjar i början av vertexen
---
Stride och offset anges i byte. Eftersom structens medlemmar ligger efter varandra är vertex buffern sammanflätad precis som kubens 8 floats per vertex i ljuskapitlen – men `sizeof` och `offsetof` räknar ut talen, och de förblir rätt när structen växer.
```
:::
:::vulkan
```quiz
Materialnumret är `uint32_t materialIndex`. Vilken attributbeskrivning och vilken shaderindata passar till det?
- [ ] `VK_FORMAT_R32_SFLOAT` och `in float inMaterialIndex`, eftersom vertexattribut alltid är floats
- [x] `VK_FORMAT_R32_UINT` på `offsetof(Vertex, materialIndex)` och `layout(location = 3) in uint inMaterialIndex`
- [ ] `VK_FORMAT_R8_UINT`, eftersom det bara finns två material
---
Formatet beskriver byten i buffern: ett 32-bitars heltal utan tecken, 32 byte in i vertexen. Dess numeriska typ (UINT) måste stämma med shaderns indatatyp (`uint`). R8 skulle bara läsa den första av de fyra byten.
```
:::
:::d3d12
```quiz
Projektets input layout lägger `NORMAL` på byte 12 och `TEXCOORD` på byte 24. Varför stämmer det med vår `Vertex`?
- [ ] För att Direct3D 12 sorterar en vertex medlemmar efter storlek
- [x] En structs medlemmar ligger efter varandra: `position` upptar byte 0–11, `normal` 12–23, `texCoord` 24–31, så en `std::vector<Vertex>` är exakt den vertex buffer som input layouten beskriver, med en stride på `sizeof(Vertex)` = 32
- [ ] Det spelar ingen roll: input layouten hittar medlemmarna via deras namn
---
Semantikerna (`POSITION`, `NORMAL`, `TEXCOORD`) kopplar input layouten till shaderns indata; byteoffseten kopplar den till buffern. Båda måste stämma med structen – offseten är det som `offsetof` skulle räkna ut.
```
:::

## Rendering

:::opengl
Den sista funktionen vi behöver definiera för att klassen `Mesh` ska bli komplett är funktionen `Draw`. Innan vi
renderar meshen vill vi först binda lämpliga texturer, innan vi anropar `glDrawElements`. Det är dock lite krångligt,
eftersom vi inte vet från början hur många texturer (om några) meshen har och vilken typ de kan ha. Hur ska vi då
ställa in texturenheterna och samplers i shadrarna?

För att lösa problemet antar vi en viss namnkonvention: varje diffuse-textur heter `texture_diffuseN`, och varje
specular-textur ska heta `texture_specularN`, där `N` är ett tal från `1` upp till det största antal texture samplers
som tillåts. Säg att en viss mesh har 3 diffuse-texturer och 2 specular-texturer; då ska deras texture samplers heta:

```glsl
uniform sampler2D texture_diffuse1;
uniform sampler2D texture_diffuse2;
uniform sampler2D texture_diffuse3;
uniform sampler2D texture_specular1;
uniform sampler2D texture_specular2;
```

Med den här konventionen kan vi definiera så många texture samplers vi vill i shadrarna (upp till OpenGL:s maximum),
och om en mesh faktiskt har (så många) texturer vet vi vad de kommer att heta. Med konventionen kan vi hantera hur
många texturer som helst i en enda mesh, och den som skriver shadern är fri att använda så många av dem som den vill
genom att definiera rätt samplers. Vår `model_loading.fs` använder en av dem, `texture_diffuse1`.

> Det finns många lösningar på problem som det här, och om du inte gillar just den här lösningen är det upp till dig
> att vara kreativ och hitta på ett eget sätt.

Ritkoden blir då:

```cpp
    void Draw(Shader &shader)
    {
        // bind appropriate textures
        unsigned int diffuseNr  = 1;
        unsigned int specularNr = 1;
        unsigned int normalNr   = 1;
        for (unsigned int i = 0; i < textures.size(); i++)
        {
            glActiveTexture(GL_TEXTURE0 + i); // active proper texture unit before binding
            // retrieve texture number (the N in texture_diffuseN)
            std::string number;
            std::string name = textures[i].type;
            if (name == "texture_diffuse")
                number = std::to_string(diffuseNr++);
            else if (name == "texture_specular")
                number = std::to_string(specularNr++); // transfer unsigned int to string
            else if (name == "texture_normal")
                number = std::to_string(normalNr++);

            // now set the sampler to the correct texture unit
            glUniform1i(glGetUniformLocation(shader.ID, (name + number).c_str()), i);
            // and finally bind the texture
            glBindTexture(GL_TEXTURE_2D, textures[i].id);
        }

        // draw mesh
        glBindVertexArray(VAO);
        glDrawElements(GL_TRIANGLES, static_cast<unsigned int>(indices.size()), GL_UNSIGNED_INT, 0);
        glBindVertexArray(0);

        // always good practice to set everything back to defaults once configured.
        glActiveTexture(GL_TEXTURE0);
    }
```

Först räknar vi ut N-delen per texturtyp och lägger till den efter texturens typsträng för att få rätt uniformnamn.
Sedan letar vi upp rätt sampler, ger den det värde som motsvarar den aktiva texturenheten, och binder texturen. Det är
också därför vi behöver shadern i funktionen `Draw`. Textur `i` hamnar alltid på texturenhet `i`, och samplern som
bär dess namn får veta det.

Lägg märke till att vi räknar upp diffuse- och specular-räknarna samtidigt som vi gör om dem till strängar. I C++
returnerar `variable++` variabeln som den är och räknar sedan upp den, medan `++variable` först räknar upp variabeln
och sedan returnerar den. I vårt fall är värdet som skickas till `std::to_string` räknarens ursprungliga värde.
Därefter räknas värdet upp till nästa varv.

Vad händer om shadern inte har någon sampler med det namnet – en mesh med en specular map och en shader som bara läser
`texture_diffuse1`, som vår än så länge? Då returnerar `glGetUniformLocation` `-1`, och OpenGL ignorerar tyst ett
`glUniform1i` till location `-1`. En mesh kan alltså bära fler texturer än en shader använder, vilket är precis vad
konventionen behöver.

Till sist ritas meshen med sin VAO: `glDrawElements` med `GL_UNSIGNED_INT`, eftersom våra index är `unsigned int`. I
slutet återställs den aktiva texturenheten till `GL_TEXTURE0`, så att kod som binder en textur efter ritningen inte av
misstag binder den till meshens sista enhet.

Gör nu uppgiften **draw-mesh** och tryck på **Build & run**. Fönstret visar fortfarande bara den mörkgrå bakgrunden:
ingen mesh finns än. Klassen är dock komplett; kapitlet *Model* läser in planeten med Assimp, skapar en `Mesh` för
planeten och en för ringen, och anropar deras `Draw`.
:::
:::vulkan
Det sista steget är learnopengls funktion `Draw`: att binda meshens buffrar och rita dess trianglar. I Vulkan spelas
det in i `recordCommandBuffer()`, efter pipelinen, viewporten och scissorn. Vertex buffern hamnar på binding 0, den
binding som vår bindningsbeskrivning beskriver, och index buffern binds med typen på sina index:

```cpp
        VkBuffer vertexBuffers[] = {vertexBuffer};
        VkDeviceSize offsets[] = {0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);

        // the indices are uint32_t: a model can have more than 65536 vertices
        vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT32);
```

`VK_INDEX_TYPE_UINT32` måste stämma med bufferns innehåll: med `VK_INDEX_TYPE_UINT16` skulle GPU:n läsa varje index
på 4 byte som två index på 2 byte. Efter push constanten med modellmatrisen ritar ett enda indexerat draw-anrop alla
index:

```cpp
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);
```

Som i *Hello Triangle*: antalet index, en instans, första index 0, inget som läggs till indexen, och första instans 0.
Descriptor setet med uniform buffern binds som förut. Det finns inga texturer att binda än – i nästa kapitel blir de
en del av descriptor setet, och hela modellen är fortfarande det här enda draw-anropet.

Gör nu uppgiften **draw** och tryck på **Build & run**. Testkvadraten syns, lutad mot dig av modellmatrisens 25° –
bredare upptill, där den är närmare – och färgad efter sina texturkoordinater: svart i det övre vänstra hörnet
(u = v = 0), röd uppe till höger (u = 1), grön nere till vänster (v = 1) och gul nere till höger (u = v = 1), med en
mjuk övergång emellan. Det är beviset för att alla fyra attributen når GPU:n på rätt ställen: positionen placerar
kvadraten på skärmen, och texturkoordinaterna kommer fram på offset 24 i varje vertex.
:::
:::d3d12
Den sista funktionen vi behöver definiera för att klassen `Mesh` ska bli komplett är funktionen `Draw`. learnopengl
binder här meshens texturer till texturenheter, enligt en namnkonvention: varje diffuse-textur heter
`texture_diffuseN` och varje specular-textur `texture_specularN` i shadern, där `N` räknas från 1. Vår shader följer
konventionen, med register i stället för texturenheter: `texture_diffuse1` är t0 – den enda som `model_loading.hlsl`
läser än så länge – och specular mapen, `texture_specular1`, blir t1.

```hlsl
// The mesh's textures, in the descriptor table of root parameter 2: its diffuse map is
// register t0 (learnopengl's texture_diffuse1).
Texture2D texture_diffuse1 : register(t0);
```

Eftersom `SetupMesh` lade vyerna i den ordningen är det ett enda anrop att binda texturerna: root parameter 2 är
descriptor-tabellen för t0 och t1, och `m_srvHandle` är var meshens två vyer ligger i heapen. Sedan binds meshens
buffrar och alla dess index ritas:

```cpp
    void Draw(ID3D12GraphicsCommandList* commandList)
    {
        // bind the mesh's textures: root parameter 2 is the descriptor table of the
        // pixel shader's textures (t0 = texture_diffuse1, t1 = texture_specular1)
        commandList->SetGraphicsRootDescriptorTable(2, m_srvHandle);

        // draw mesh
        commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);
        commandList->IASetIndexBuffer(&m_indexBufferView);
        commandList->DrawIndexedInstanced(static_cast<UINT>(indices.size()), 1, 0, 0, 0);
    }
```

`Draw` tar emot command listen i stället för learnopengls shader: i Direct3D 12 betyder bindning att spela in
kommandon. När modellen ritar mesh efter mesh sätter varje mesh root parameter 2 till sin egen tabell före sin
ritning; Direct3D 12 håller isär root-argumenten för varje ritning, så den första meshens ritning läser fortfarande den
första meshens texturer. `DrawIndexedInstanced` tar antalet index, en instans, första index 0, inget som läggs till
indexen (base vertex) och första instans 0. Primitivtopologin (en triangellista), root signaturen, heapen och
modellmatrisen sätts i `PopulateCommandList` innan modellen ritas.

Gör nu uppgiften **draw-mesh** och tryck på **Build & run**. Fönstret visar fortfarande bara den mörkgrå bakgrunden:
ingen mesh finns än. Klassen är dock komplett – kapitlet *Model* läser in planeten med Assimp, skapar en `Mesh` för
planeten och en för ringen, och anropar deras `Draw`.
:::

:::opengl
```quiz
En mesh har texturerna (i den här ordningen) diffuse, specular, diffuse. Vilken sampler läser vilken texturenhet?
- [ ] `texture_diffuse1` = enhet 0, `texture_diffuse2` = enhet 1, `texture_specular1` = enhet 2
- [x] `texture_diffuse1` = enhet 0, `texture_specular1` = enhet 1, `texture_diffuse2` = enhet 2
- [ ] `texture_diffuse1` = enhet 1, `texture_specular1` = enhet 2, `texture_diffuse3` = enhet 3
---
Textur `i` hamnar på enhet `i`. Talet i namnet räknas per typ och börjar på 1: `diffuseNr++` delar ut 1, sedan 2, och `specularNr++` sin egen 1. Den andra diffuse-texturen är alltså `texture_diffuse2` på enhet 2.
```
:::
:::vulkan
```quiz
Varför fyller det här kapitlet `vertices` och `indices` med en testkvadrat i stället för att lämna dem tomma tills modellen är inläst?
- [ ] För att en Vulkan-pipeline behöver exakt fyra vertexar
- [x] Vertex buffern och index buffern skapas från vektorerna, och Vulkan kan inte skapa en buffer med storleken 0
- [ ] För att `vkCmdDrawIndexed` misslyckas med fler än 6 index
---
`VkBufferCreateInfo::size` måste vara större än 0. learnopengls tomma `Mesh` sätts aldrig upp innan den har data, men våra buffrar skapas i `initVulkan()` – så de får en liten mesh tills kapitlet *Model* läser in planeten i samma vektorer.
```
:::
:::d3d12
```quiz
Anta att en meshs material saknar specular map. Vad lägger `SetupMesh` då på meshens andra plats, och varför?
- [ ] Ingenting: platsen förblir tom, och tabellen blir en descriptor kortare
- [x] En null-SRV (null-resurs, fullständig beskrivning): tabellen i root parameter 2 täcker alltid t0 och t1, och läsning från en null-vy ger nollor – svart, alltså ingen högdager
- [ ] Diffuse mapen igen, så att shadern alltid har två texturer
---
En descriptor-tabell är en fast följd av platser, och en plats som shadern kan läsa måste innehålla en giltig descriptor. `CreateShaderResourceView(nullptr, &srvDesc, …)` skapar en null descriptor; beskrivningen talar om vilken sorts vy platsen är.
```
:::

:::opengl
```quiz
Varför tar `Draw` emot shadern som parameter?
- [ ] För att `glDrawElements` behöver shaderns ID
- [x] För att peka varje sampler (`texture_diffuse1`, …) på sin texturs texturenhet måste den slå upp samplern i just den shadern med `glGetUniformLocation(shader.ID, …)`
- [ ] För att meshen ska kunna kompilera shadern första gången den ritas
---
Sampler-uniforms hör till ett shaderprogram. Meshen känner till sina texturer och enheter; bara med shadern kan den sätta `glUniform1i(location, i)` för varje namn. Shadern måste vara i bruk (`ourShader.use()`) när `Draw` anropas.
```
:::
:::vulkan
```quiz
`vertices` och `indices` kopieras till buffrar i device-local minne via en staging buffer. Varför omvägen?
- [ ] För att `memcpy` inte kan skriva mer än 64 KB åt gången
- [x] Device-local minne är snabbast för GPU:n att läsa, men CPU:n kan ofta inte mappa det: CPU:n skriver en host-visible staging buffer, och `vkCmdCopyBuffer` på GPU:n flyttar datan
- [ ] För att en vertex buffer alltid måste skapas två gånger
---
Staging buffern är `TRANSFER_SRC` i host-visible, koherent minne; vertex buffern är `TRANSFER_DST | VERTEX_BUFFER` i `DEVICE_LOCAL` minne. När kopieringen är klar (`endSingleTimeCommands` väntar på den) förstörs staging buffern.
```
:::
:::d3d12
```quiz
Modellen ritar sina meshar efter varandra, och var och en anropar `SetGraphicsRootDescriptorTable(2, m_srvHandle)` före sin ritning. Får den första meshens ritning den andra meshens texturer?
- [ ] Ja: bara det sista värdet som sattes före `Close()` gäller, så alla meshar måste dela texturer
- [x] Nej: varje ritning använder root-argumenten som sattes före den – Direct3D 12 håller dem per ritning, så varje mesh läser sina egna två platser
- [ ] Bara om båda mesharna använder samma pipeline state
---
Root-argument är inspelat tillstånd: en ritning ser de värden som var satta när den spelades in, och att ändra en root parameter mellan ritningar är det normala sättet att ge varje ritning sina egna resurser.
```
:::

:::opengl
```quiz
`glDrawElements(GL_TRIANGLES, static_cast<unsigned int>(indices.size()), GL_UNSIGNED_INT, 0);` – varför `GL_UNSIGNED_INT`?
- [ ] För att vertexpositionerna saknar tecken
- [x] Det är typen på indexen i EBO:n: `std::vector<unsigned int>`, 4 byte vardera; med `GL_UNSIGNED_SHORT` skulle OpenGL läsa varje index som två index på 2 byte
- [ ] För att OpenGL 3.3 inte har någon annan indextyp
---
Typen måste beskriva vad element buffern innehåller. 32-bitars index låter också en mesh ha fler än 65536 vertexar – det har modeller ofta.
```
:::
:::vulkan
```quiz
`vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT32)` – vad skulle `VK_INDEX_TYPE_UINT16` göra med vår index buffer?
- [ ] Ingen skillnad; Vulkan känner av typen utifrån bufferns storlek
- [x] GPU:n skulle läsa varje `uint32_t`-index på 4 byte som två index på 2 byte – fel vertexar, trasiga trianglar
- [ ] Den skulle bara begränsa meshen till 65536 vertexar
---
Indextypen talar om för GPU:n hur bufferns byte ska läsas, så den måste stämma med typen på `indices` (`uint32_t`). 32-bitars index tillåter också fler än 65536 vertexar, vilket en modell lätt kan ha.
```
:::
:::d3d12
```quiz
`m_indexBufferView.Format = DXGI_FORMAT_R32_UINT;` – vad skulle `DXGI_FORMAT_R16_UINT` göra med vår index buffer?
- [ ] Ingen skillnad; Direct3D 12 känner av typen utifrån bufferns storlek
- [x] GPU:n skulle läsa varje `UINT`-index på 4 byte som två index på 2 byte – fel vertexar, trasiga trianglar
- [ ] Det skulle bara begränsa meshen till 65536 vertexar
---
Index buffer-vyns format talar om för input assemblern hur bufferns byte ska läsas, så det måste stämma med typen på `indices` (`UINT`, 32 bitar). 32-bitars index tillåter också fler än 65536 vertexar, vilket en modell lätt kan ha.
```
:::

Med meshen på plats har vi det vi behöver för att rita vilken mesh som helst som vi kan förse med data. Nästa
kapitel, *Model*, står för datan: det läser in `planet.obj` och sätter äntligen planeten på skärmen.

## Mer att läsa

- [Mesh](https://learnopengl.com/Model-Loading/Mesh) på learnopengl.com: kapitlet som det här följer.

:::opengl
- [mesh.h](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/includes/learnopengl/mesh.h) i learnopengls
  repository: hela klassen `Mesh`, med tangenter och bendata.
:::
:::vulkan
- [Staging buffer](https://vulkan-tutorial.com/Vertex_buffers/Staging_buffer) och
  [Index buffer](https://vulkan-tutorial.com/Vertex_buffers/Index_buffer) på vulkan-tutorial.com: Vulkans sida av
  vertex buffern och index buffern.
:::
:::d3d12
- [Descriptors overview](https://learn.microsoft.com/en-us/windows/win32/direct3d12/descriptors-overview) på
  Microsoft Learn: default descriptors och null descriptors i Direct3D 12.
:::
