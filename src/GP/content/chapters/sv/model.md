# Modell

Nu är det dags att kavla upp ärmarna med en modellinläsare och börja skriva själva koden som läser in och översätter.
Målet med det här kapitlet är att göra om en modellfil till något som {{api}} kan rita: en modell i sin helhet, alltså
en modell som består av flera meshar, kanske med flera texturer. Ett hus med en träbalkong, ett torn och kanske en
pool kan ändå läsas in som en enda modell.

Vår modell är kursens egen `models/planet.obj`: en liten planet med en ring runt sig. Filen innehåller två objekt,
`planet` och `rings`, och dess materialfil `planet.mtl` ger vart och ett av dem ett material med samma namn, med en
diffuse map och en specular map:

```text
newmtl planet
...
map_Kd planet_diffuse.png
map_Ks planet_specular.png

newmtl rings
...
map_Kd rings.png
map_Ks rings_specular.png
```

Modellen har alltså två meshar, två material och fyra texturer – tillräckligt liten för att följa varje steg, men
med alla delar som en riktig modell har.

:::opengl
Precis som learnopengl.com läser vi in modellen med Assimp och översätter den till `Mesh`-objekt av klassen du skrev i
förra kapitlet. Utan vidare omsvep, här är strukturen för klassen `Model`, i projektets `model.h`:

```cpp
class Model
{
public:
    // model data
    std::vector<Texture> textures_loaded; // stores all the textures loaded so far, optimization to make sure textures aren't loaded more than once.
    std::vector<Mesh>    meshes;
    std::string directory;

    // TODO: the constructor: load the model at path (loadModel)

    // TODO: Draw: draw every mesh of the model

private:
    void loadModel(std::string const &path) { ... }
    void processNode(aiNode *node, const aiScene *scene) { ... }
    Mesh processMesh(aiMesh *mesh, const aiScene *scene) { ... }

    // TODO: loadMaterialTextures: load the material's textures of one type (each file only once)
};
```

Klassen `Model` innehåller en vektor med `Mesh`-objekt och kräver att vi ger den en filsökväg i konstruktorn. Den
läser sedan in filen direkt via funktionen `loadModel`, som anropas i konstruktorn. De privata funktionerna tar
var och en hand om en del av Assimps inläsning, och vi går igenom dem strax. Vi sparar också katalogen i filsökvägen,
som vi behöver senare när vi läser in texturer.

Funktionen `Draw` är inget märkvärdigt; den loopar helt enkelt över alla meshar och anropar deras respektive
`Draw`-funktion:

```cpp
    // draws the model, and thus all its meshes
    void Draw(Shader &shader)
    {
        for (unsigned int i = 0; i < meshes.size(); i++)
            meshes[i].Draw(shader);
    }
```

Projektet är resultatet av *Mesh*, med en ny fil `model.h`. Dess `// TODO:`-kommentarer visar var din kod ska in:
konstruktorn och `Draw`, kropparna i `loadModel`, `processNode` och `processMesh`, samt funktionerna
`loadMaterialTextures` och `TextureFromFile`. `main.cpp` inkluderar nu `"model.h"` (som inkluderar `"mesh.h"`) och har
två egna TODO: att läsa in modellen och att rita den. Programmet länkas med Assimp, så som du satte upp det i kapitlet
*Assimp*. Tills modellen ritas visar ditt program bara den mörkgrå bakgrunden (0.05, 0.05, 0.05) – varje steg
dessförinnan kompileras och körs, det ritar bara ingenting än.
:::
:::vulkan
Vulkan har ingen modellinläsare, och precis som vulkan-tutorial.com:s kapitel *Loading models* använder vi det lilla
header-only-biblioteket **tinyobjloader** i stället för Assimp (kapitlet *Assimp* förklarade varför). learnopengls
klass `Model` har fyra jobb – läsa filen, göra om dess meshar till vertices och index, läsa in materialens texturer
och rita – och vi gör samma fyra jobb i applikationsklassen, bredvid vertex- och indexbuffrarna från förra kapitlet:

| learnopengls `Model` | det här kapitlets Vulkan-program |
| --- | --- |
| `loadModel`, `processNode`, `processMesh` | `loadModel()`: `tinyobj::LoadObj` och en loop över dess shapes |
| en `Mesh` (VAO, VBO, EBO) per mesh | en vertex buffer och en index buffer för hela modellen |
| `loadMaterialTextures`, `TextureFromFile` | `createTextures()`: de fyra kartorna, på descriptor-bindings 1–4 |
| `Draw`: ett draw-anrop per mesh, var och en med sina texturer | ett `vkCmdDrawIndexed`; fragment shadern väljer varje fragments material |

Projektet är resultatet av *Mesh*, oförändrat: testkvadraten, ritad i texturkoordinatfärger (rött = u, grönt = v) med
ett `vkCmdDrawIndexed`. Den här gången finns inga `// TODO:`-kommentarer: varje uppgift ändrar koden du skrev i förra
kapitlet, steg för steg, tills kvadraten har blivit planeten. Bygg och kör programmet efter varje uppgift för att se
resultatet.
:::
:::d3d12
Precis som learnopengl.com läser vi in modellen med Assimp och översätter den till `Mesh`-objekt av klassen du skrev i
förra kapitlet. Projektets `main.cpp` innehåller redan strukturen för klassen `Model`, efter `class Mesh`:

```cpp
class Model
{
public:
    // model data
    std::vector<Texture> textures_loaded;    // stores all the textures loaded so far, optimization to make sure textures aren't loaded more than once.
    std::vector<Mesh>    meshes;
    std::string directory;

    // The textures' upload buffers: the copies recorded in the command list read from them,
    // so they must stay alive until it has executed.
    std::vector<ComPtr<ID3D12Resource>> uploadHeaps;

    // Loads a model from a file (learnopengl's constructor). The textures' copies are recorded
    // in commandList; the meshes' texture views go into srvHeap from slot firstDescriptor on.
    void Load(std::string const& path, ID3D12Device* device, ID3D12GraphicsCommandList* commandList, ID3D12DescriptorHeap* srvHeap, UINT firstDescriptor)
    {
        m_device = device;
        m_commandList = commandList;
        m_srvHeap = srvHeap;
        m_nextDescriptor = firstDescriptor;
        loadModel(path);
    }

    // draws the model, and thus all its meshes
    void Draw(ID3D12GraphicsCommandList* commandList)
    {
        for (UINT i = 0; i < meshes.size(); i++)
            meshes[i].Draw(commandList);
    }

private:
    ...
    void loadModel(std::string const& path) { ... }
    void processNode(aiNode* node, const aiScene* scene) { ... }
    Mesh processMesh(aiMesh* mesh, const aiScene* scene) { ... }
    std::vector<Texture> loadMaterialTextures(aiMaterial* mat, aiTextureType type, std::string typeName) { ... }
};
```

Klassen `Model` innehåller en vektor med `Mesh`-objekt och en funktion som läser in dem från en fil. learnopengl
läser in i konstruktorn; i Direct3D 12 behöver inläsningen av en modell mer än en sökväg – devicen för att skapa
buffrar och texturer, command listen att spela in texturernas kopiering i, och CBV/SRV-heapen för meshernas texture
views – så `Load` tar emot dem, sparar dem i medlemmar åt de privata funktionerna och anropar sedan `loadModel`. De
privata funktionerna tar var och en hand om en del av Assimps inläsning, och vi går igenom dem strax. Vi sparar
också katalogen i filsökvägen, som vi behöver senare när vi läser in texturer. `Draw` är inget märkvärdigt; den
loopar helt enkelt över alla meshar och anropar deras respektive `Draw`-funktion.

Projektet är resultatet av *Mesh*, med klassen `Model` tillagd. Dess `// TODO:`-kommentarer visar var din kod ska in:
kropparna i `loadModel`, `processNode` och `loadMaterialTextures`, två delar av `processMesh`, och i `D3D12App`
modellmedlemmen, inläsningen av den, frigörandet av dess upload-buffrar och ritandet. Tills modellen ritas visar ditt
program bara den mörkgrå bakgrunden (0.05, 0.05, 0.05) – varje steg dessförinnan kompileras och körs, det ritar bara
ingenting än.
:::

:::opengl d3d12
## Att importera en 3D-modell i {{api}}

För att importera en modell och översätta den till vår egen struktur måste vi först inkludera Assimps headerfiler
(projektet har dem redan):

```cpp
#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/postprocess.h>
```

Den första funktionen vi anropar är `loadModel`. I `loadModel` använder vi Assimp för att läsa in modellen i en av
Assimps datastrukturer, ett scene-objekt. Du kanske minns från modellinläsningsdelens första kapitel att det är
rotobjektet i Assimps datagränssnitt. När vi har scene-objektet kommer vi åt all data vi behöver från den inlästa
modellen.

Det fina med Assimp är att det snyggt döljer alla tekniska detaljer kring inläsningen av alla olika filformat och
gör allt detta på en enda rad:

```cpp
        Assimp::Importer importer;
        const aiScene* scene = importer.ReadFile(path, aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs | aiProcess_CalcTangentSpace);
```

Först deklarerar vi ett `Importer`-objekt från Assimps namnrymd och anropar sedan dess funktion `ReadFile`. Funktionen
förväntar sig en filsökväg och, som andra argument, flera alternativ för efterbearbetning. Med dem kan vi tvinga
Assimp att göra extra beräkningar eller operationer på den importerade datan:

- `aiProcess_Triangulate`: om modellen inte (helt) består av trianglar gör Assimp först om alla modellens primitiver
  till trianglar. Våra draw-anrop ritar bara trianglar.
- `aiProcess_GenSmoothNormals`: skapar mjuka normalvektorer för varje vertex om modellen saknar normaler.
  `planet.obj` har egna normaler, så här gör den ingenting – men ljussättningen i slutet av kapitlet behöver
  normaler, och alla filer har dem inte.
- `aiProcess_FlipUVs`: vänder texturkoordinaterna kring y-axeln (v blir 1 − v). Vi ser nedan varför det är exakt den
  enda vändning våra texturer behöver.
- `aiProcess_CalcTangentSpace`: beräknar tangentvektorer för normal mapping, en teknik i en senare del av kursen. Våra
  shaders använder dem inte än; flaggan finns i learnopengls `model.h`, så vi behåller den.

Några andra användbara alternativ är `aiProcess_SplitLargeMeshes`, som delar upp stora meshar i mindre delmeshar
(användbart om din renderare har ett största antal vertices per draw-anrop), och `aiProcess_OptimizeMeshes`, som gör
tvärtom och försöker slå ihop flera meshar till en större för att minska antalet draw-anrop. Assimp har en stor
uppsättning efterbearbetningsalternativ. Att läsa in en modell via Assimp är (som du ser) förvånansvärt enkelt. Det
svåra är att använda det returnerade scene-objektet för att översätta den inlästa datan till en array av
`Mesh`-objekt.

Hela funktionen `loadModel` ser ut så här:
:::
:::opengl
```cpp
    void loadModel(std::string const &path)
    {
        // read file via ASSIMP
        Assimp::Importer importer;
        const aiScene* scene = importer.ReadFile(path, aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs | aiProcess_CalcTangentSpace);
        // check for errors
        if (!scene || scene->mFlags & AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode) // if is Not Zero
        {
            std::cout << "ERROR::ASSIMP:: " << importer.GetErrorString() << std::endl;
            return;
        }
        // retrieve the directory path of the filepath
        directory = path.substr(0, path.find_last_of('/'));

        // process ASSIMP's root node recursively
        processNode(scene->mRootNode, scene);
    }
```

När modellen är inläst kontrollerar vi att scenen och scenens rotnod inte är null, och läser en av dess flaggor för
att se om den returnerade datan är ofullständig. Om något av dessa fel inträffar skriver vi ut felet från
importerarens funktion `GetErrorString` och returnerar. Vi hämtar också katalogen i den givna filsökvägen: för
`"models/planet.obj"` är det `"models"`.

Konstruktorn gör inget annat än att anropa den:

```cpp
    // constructor, expects a filepath to a 3D model.
    Model(std::string const &path)
    {
        loadModel(path);
    }
```

Lägg märke till att `importer` är en lokal variabel: `aiScene` tillhör den och frigörs när `loadModel` returnerar.
Det gör inget, för då har allt vi behöver redan kopierats till våra egna `Mesh`-objekt.

Gör nu den första uppgiften, **load-model**: konstruktorn och `loadModel`. Bygg och kör: ingenting ritas än, eftersom
`main.cpp` inte skapar någon `Model` – programmet kompileras och körs, och det är allt för tillfället.
:::
:::d3d12
```cpp
    void loadModel(std::string const& path)
    {
        // read file via ASSIMP
        Assimp::Importer importer;
        const aiScene* scene = importer.ReadFile(path, aiProcess_Triangulate | aiProcess_GenSmoothNormals | aiProcess_FlipUVs | aiProcess_CalcTangentSpace);
        // check for errors
        if (!scene || scene->mFlags & AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode) // if is Not Zero
        {
            throw std::runtime_error(std::string("ERROR::ASSIMP:: ") + importer.GetErrorString());
        }
        // retrieve the directory path of the filepath
        directory = path.substr(0, path.find_last_of('/'));

        // process ASSIMP's root node recursively
        processNode(scene->mRootNode, scene);
    }
```

När modellen är inläst kontrollerar vi att scenen och scenens rotnod inte är null, och läser en av dess flaggor för
att se om den returnerade datan är ofullständig. Om något av dessa fel inträffar rapporterar vi felet från
importerarens funktion `GetErrorString`. learnopengl skriver ut det och returnerar; vårt program kastar det i stället
som ett undantag, som varje annat fel i D3D12-exemplens stil (`ThrowIfFailed`) – ett program utan sin modell har inget
att rita. Vi hämtar också katalogen i den givna filsökvägen: för `"models/planet.obj"` är det `"models"`.

Lägg märke till att `importer` är en lokal variabel: `aiScene` tillhör den och frigörs när `loadModel` returnerar.
Det gör inget, för då har allt vi behöver redan kopierats till våra egna `Mesh`-objekt.

Gör nu den första uppgiften, **load-model**. Bygg och kör: ingenting ritas än, eftersom ingenting anropar `Load` –
programmet kompileras och körs, och det är allt för tillfället.
:::
:::opengl d3d12
Om inget gick fel vill vi bearbeta alla scenens noder. Vi skickar den första noden (rotnoden) till den rekursiva
funktionen `processNode`. Eftersom varje nod (eventuellt) har ett antal barn vill vi först bearbeta noden i fråga och
sedan fortsätta med alla nodens barn och så vidare. Det passar en rekursiv struktur, så vi definierar en rekursiv
funktion. En rekursiv funktion är en funktion som gör en del arbete och anropar sig själv med andra parametrar tills
ett visst villkor är uppfyllt. I vårt fall är slutvillkoret uppfyllt när alla noder har bearbetats.

Som du kanske minns från Assimps struktur innehåller varje nod en uppsättning mesh-index, där varje index pekar på en
viss mesh i scene-objektet. Vi vill alltså hämta dessa index, hämta varje mesh, bearbeta varje mesh och sedan göra
samma sak igen för var och en av nodens barn. Funktionen `processNode` ser ut så här:
:::
:::opengl
```cpp
    void processNode(aiNode *node, const aiScene *scene)
    {
        // process each mesh located at the current node
        for (unsigned int i = 0; i < node->mNumMeshes; i++)
        {
            // the node object only contains indices to index the actual objects in the scene.
            // the scene contains all the data, node is just to keep stuff organized (like relations between nodes).
            aiMesh* mesh = scene->mMeshes[node->mMeshes[i]];
            meshes.push_back(processMesh(mesh, scene));
        }
        // after we've processed all of the meshes (if any) we then recursively process each of the children nodes
        for (unsigned int i = 0; i < node->mNumChildren; i++)
        {
            processNode(node->mChildren[i], scene);
        }
    }
```
:::
:::d3d12
```cpp
    void processNode(aiNode* node, const aiScene* scene)
    {
        // process each mesh located at the current node
        for (UINT i = 0; i < node->mNumMeshes; i++)
        {
            // the node object only contains indices to index the actual objects in the scene.
            // the scene contains all the data, node is just to keep stuff organized (like relations between nodes).
            aiMesh* mesh = scene->mMeshes[node->mMeshes[i]];
            meshes.push_back(processMesh(mesh, scene));
        }
        // after we've processed all of the meshes (if any) we then recursively process each of the children nodes
        for (UINT i = 0; i < node->mNumChildren; i++)
        {
            processNode(node->mChildren[i], scene);
        }
    }
```
:::
:::opengl d3d12
Först går vi igenom nodens mesh-index och hämtar motsvarande mesh ur scenens array `mMeshes`. Den returnerade meshen
skickas sedan till funktionen `processMesh`, som returnerar ett `Mesh`-objekt som vi kan lägga i vektorn `meshes`. När
alla meshar är bearbetade går vi igenom nodens barn och anropar samma funktion `processNode` för vart och ett av dem.
När en nod inte längre har några barn upphör rekursionen. För `planet.obj` ger det två meshar, `planet` och `rings`,
en för varje objekt i filen.
:::

:::opengl
```quiz
`processNode` får en `aiNode`. Var finns den faktiska vertexdatan för nodens i:te mesh?
- [ ] I `scene->mRootNode->mMeshes[i]`, vilken nod som än bearbetas
- [x] I `scene->mMeshes[node->mMeshes[i]]`: noden har bara indexet till en mesh som scenen äger
- [ ] I `node->mChildren[i]`: varje mesh är en barnnod
- [ ] I `node->mMeshes[i]`, en `aiMesh` som lagras i noden
---
Alla meshar finns i scenens array `mMeshes`; en nod listar bara indexen för de meshar som hör till den. På så vis kan flera noder till och med dela en mesh.
```
:::
:::vulkan
## Att importera en 3D-modell i Vulkan

Biblioteket tinyobjloader inkluderas på samma sätt som stb-biblioteken. Inkludera filen `tiny_obj_loader.h` och se
till att definiera `TINYOBJLOADER_IMPLEMENTATION` i en källfil, så att funktionskropparna kommer med och du slipper
länkfel:

```cpp
#define TINYOBJLOADER_IMPLEMENTATION
#include <tiny_obj_loader.h>
```

Lägg en konfigurationsvariabel med modellens sökväg bredvid fönsterstorleken, och lägg till `<string>` och
`<unordered_map>` bland includerna:

```cpp
const std::string MODEL_PATH = "models/planet.obj";
```

Vi ska nu läsa in vertices och index från modellfilen, så testkvadraten får gå. De två medlemmarna blir kvar, men de
börjar tomma – `loadModel()` fyller dem:

```cpp
    // The mesh's data: its vertices and, three per triangle, the indices of the triangles' vertices.
    // loadModel() fills them from the model file.
    std::vector<Vertex> vertices;
    std::vector<uint32_t> indices;
```

Indexen var redan `uint32_t` och index buffern binds med `VK_INDEX_TYPE_UINT32`: en modell kan lätt ha fler än 65535
vertices. `loadModel()` måste köras innan vertex- och indexbuffrarna skapas – buffrarnas storlekar är storlekarna på
de här vektorerna, och Vulkan kan inte skapa en buffer med storleken 0 (det var därför förra kapitlet behövde en
testkvadrat):

```cpp
        createTextureSampler();
        loadModel();
        createVertexBuffer();
```

En modell läses in i bibliotekets datastrukturer genom att anropa funktionen `tinyobj::LoadObj`:

```cpp
    void loadModel() {
        tinyobj::attrib_t attrib;                   // all positions, normals and texture coordinates of the file
        std::vector<tinyobj::shape_t> shapes;       // its objects ("o planet", "o rings"): their faces as indices into attrib
        std::vector<tinyobj::material_t> materials; // the materials of the .mtl file, in the file's order
        std::string warn, err;

        // the last argument: the folder of the .mtl file that planet.obj names (mtllib planet.mtl)
        if (!tinyobj::LoadObj(&attrib, &shapes, &materials, &warn, &err, MODEL_PATH.c_str(), "models/")) {
            throw std::runtime_error(warn + err);
        }
```

En OBJ-fil består av positioner, normaler, texturkoordinater och ytor (faces). En yta består av ett godtyckligt
antal vertices, där varje vertex hänvisar till en position, en normal och/eller en texturkoordinat med index. Det gör
det möjligt att återanvända inte bara hela vertices utan även enskilda attribut.

Behållaren `attrib` innehåller alla positioner, normaler och texturkoordinater i sina vektorer `attrib.vertices`,
`attrib.normals` och `attrib.texcoords`. Behållaren `shapes` innehåller alla separata objekt och deras ytor – för vår
fil två shapes, `planet` och `rings`. Varje yta består av en array av vertices, och varje vertex innehåller indexen
för positions-, normal- och texturkoordinatattributen. Till skillnad från vulkan-tutorials modell har vår två
material: `materials` innehåller dem i ordningen i `planet.mtl` (planet = 0, rings = 1), och varje shapes
`mesh.material_ids` ger varje yta numret på dess material. Det sista argumentet till `LoadObj` är katalogen som
`.mtl`-filen läses från: `planet.obj` namnger den med `mtllib planet.mtl`, relativt modellen.

Strängen `err` innehåller fel och strängen `warn` varningar som uppstod när filen lästes in, till exempel en saknad
materialdefinition. Inläsningen misslyckades bara på riktigt om `LoadObj` returnerar `false`. Som sagt kan ytor i
OBJ-filer innehålla ett godtyckligt antal vertices, medan vårt program bara kan rendera trianglar. Som tur är har
`LoadObj` en valfri parameter som automatiskt trianglar sådana ytor, och den är påslagen som standard – den gör det som
`aiProcess_Triangulate` gör för Assimp.

`tinyobj::attrib_t` motsvarar alltså ungefär Assimps vertexarrayer per mesh, fast för hela filen, `shape_t` är en
`aiMesh` och `material_t` ett `aiMaterial`. Det finns ingen nodhierarki: en OBJ-fil har ingen.

```quiz
`shape.mesh.indices[i]` är en `tinyobj::index_t`. Vad innehåller den?
- [x] Tre separata index: `vertex_index`, `normal_index` och `texcoord_index`, in i `attrib.vertices`, `attrib.normals` och `attrib.texcoords`
- [ ] De tre indexen för en triangel
- [ ] Själva positionen, som tre floats
- [ ] Vertexens nummer i vertex buffern
---
OBJ indexerar varje attribut för sig, så ett hörn i en yta kan kombinera vilken position som helst med vilken normal och vilken texturkoordinat som helst. Vår vertex buffer behöver ett index per komplett vertex, så `loadModel()` måste bygga de vertices själv.
```
:::
:::d3d12
```quiz
`processNode` får en `aiNode`. Var finns den faktiska vertexdatan för nodens i:te mesh?
- [ ] I `node->mChildren[i]`: varje mesh är en barnnod
- [ ] I `scene->mRootNode->mMeshes[i]`, vilken nod som än bearbetas
- [ ] I `node->mMeshes[i]`, en `aiMesh` som lagras i noden
- [x] I `scene->mMeshes[node->mMeshes[i]]`: noden har bara indexet till en mesh som scenen äger
---
Alla meshar finns i scenens array `mMeshes`; en nod listar bara indexen för de meshar som hör till den. På så vis kan flera noder till och med dela en mesh.
```
:::

:::opengl d3d12
En uppmärksam läsare har kanske märkt att vi skulle kunna strunta i noderna och helt enkelt loopa direkt över alla
scenens meshar, utan allt det här krånglet med index. Anledningen till att vi gör så här är att tanken med noderna är
att de definierar en förälder–barn-relation mellan meshar. Genom att rekursivt gå igenom de relationerna kan vi låta
vissa meshar vara föräldrar till andra. Ett exempel är när du vill flytta en bilmesh och se till att alla dess barn
(som en motormesh, en rattmesh och däckmesharna) flyttar med; ett sådant system är lätt att bygga med förälder–barn-
relationer.

Just nu använder vi inget sådant system, men det rekommenderas i allmänhet att hålla fast vid det här
tillvägagångssättet när du vill ha extra kontroll över din meshdata. De här nodrelationerna har ju definierats av
grafikerna som skapade modellerna.
:::
:::opengl
```quiz
Varför går `processNode` rekursivt igenom nodträdet, när en loop över `scene->mMeshes` skulle hitta samma två meshar?
- [ ] Rekursion är snabbare än en loop för arrayer av pekare
- [ ] För att Assimp frigör varje mesh när dess nod har besökts
- [ ] För att `scene->mMeshes` bara innehåller rotnodens meshar
- [x] Noderna bevarar de förälder–barn-relationer som grafikern definierade; att gå igenom dem behåller möjligheten att använda relationerna, till exempel för att flytta en del tillsammans med allt som sitter fast i den
---
För vår planet ger båda sätten samma två meshar. Trädet spelar roll så fort du vill använda modellens struktur – en bils hjul som ska följa med bilen.
```

Gör nu uppgiften **process-node**. Inte heller nu ändras något synligt – `processMesh` returnerar fortfarande tomma
meshar – men strukturen är komplett.
:::
:::vulkan
## Från filen till vertices

Vi slår ihop alla ytor i filen till en enda modell, så vi itererar över alla shapes och över varje shapes index.
Trianguleringen har redan sett till att det finns tre index per yta. För varje index bygger vi en `Vertex` och
använder indexets tre tal för att slå upp de faktiska vertexattributen i `attrib`-arrayerna:

```cpp
        for (const auto& shape : shapes) {
            for (size_t i = 0; i < shape.mesh.indices.size(); i++) {
                const tinyobj::index_t& index = shape.mesh.indices[i];
                Vertex vertex{};

                vertex.pos = {
                    attrib.vertices[3 * index.vertex_index + 0],
                    attrib.vertices[3 * index.vertex_index + 1],
                    attrib.vertices[3 * index.vertex_index + 2]
                };

                vertex.normal = {
                    attrib.normals[3 * index.normal_index + 0],
                    attrib.normals[3 * index.normal_index + 1],
                    attrib.normals[3 * index.normal_index + 2]
                };

                // OBJ's v goes up from the bottom of the image, Vulkan's down from the top: flip it
                vertex.texCoord = {
                    attrib.texcoords[2 * index.texcoord_index + 0],
                    1.0f - attrib.texcoords[2 * index.texcoord_index + 1]
                };

                // LoadObj has made every face a triangle: indices 0-2 are face 0, 3-5 face 1 ... and each face has
                // the number of its material (planet = 0, rings = 1)
                vertex.materialIndex = static_cast<uint32_t>(shape.mesh.material_ids[i / 3]);
```

Tyvärr är `attrib.vertices` en array av `float` och inte av något i stil med `glm::vec3`, så du måste multiplicera
indexet med `3`. På samma sätt har varje post två texturkoordinatkomponenter. Offseten `0`, `1` och `2` används för
att komma åt X-, Y- och Z-komponenterna, eller U- och V-komponenterna när det gäller texturkoordinater. Det här är
learnopengls kopiering av `mesh->mVertices[i]`, `mesh->mNormals[i]` och `mesh->mTextureCoords[0][i]` till en `Vertex`.
(Filen har normaler och texturkoordinater för varje vertex; en inläsare för vilken OBJ-fil som helst skulle behöva
kontrollera att `normal_index` och `texcoord_index` inte är −1.)

Två rader är nya jämfört med vulkan-tutorial. Texturkoordinatens v vänds – mer om det nedan. Och varje vertex får
numret på sin ytas material: `material_ids` har en post per yta, och eftersom varje yta är en triangel hör index `i`
till yta `i / 3`. learnopengl håller materialet hos meshen; vi håller det hos vertexen, eftersom vi ska rita hela
modellen med ett enda draw-anrop och fragment shadern måste veta vilket material den ritar.

## Index

För enkelhetens skull antar vulkan-tutorial först att varje vertex är unik och räknar bara upp indexen. Men då skulle
vi inte dra nytta av index buffern: många vertices ingår i flera trianglar. Vi behåller bara de unika vertices och
använder index buffern för att återanvända dem när de dyker upp igen, med en `unordered_map` som kommer ihåg indexet
för varje vertex vi redan har sparat:

```cpp
        // each different vertex goes into vertices once; a vertex that comes again only adds its index
        std::unordered_map<Vertex, uint32_t> uniqueVertices{};
        ...
                if (uniqueVertices.count(vertex) == 0) {
                    uniqueVertices[vertex] = static_cast<uint32_t>(vertices.size());
                    vertices.push_back(vertex);
                }

                indices.push_back(uniqueVertices[vertex]);
            }
        }
    }
```

Varje gång vi läser en vertex från OBJ-filen kontrollerar vi om vi redan har sett en vertex med exakt samma position,
normal, texturkoordinater och material. Om inte lägger vi till den i `vertices` och sparar dess index i
`uniqueVertices`. Sedan lägger vi till vertexens index i `indices`. Det är därför förra kapitlet gav `Vertex` en
`operator==` och en specialisering av `std::hash`: en `unordered_map` behöver båda för sina nycklar. För `planet.obj`
hänvisar de 3168 indexen (1056 trianglar) till bara 657 olika vertices.

```quiz
Varför slår `loadModel()` upp varje vertex i `uniqueVertices` innan den läggs till?
- [ ] För att Vulkan inte godtar en vertex buffer med två lika vertices
- [ ] För att sortera vertices efter material, så att ett draw-anrop räcker
- [ ] För att `vkCmdDrawIndexed` behöver indexen i stigande ordning
- [x] Så att en vertex som delas av flera trianglar lagras en gång och återanvänds via index buffern, i stället för en gång per triangelhörn
---
Utan mappen vore varje hörn en egen vertex: 3168 vertices med indexen 0, 1, 2, 3 …. Med den innehåller vertex buffern 657, och index buffern talar om vilka av dem varje triangel använder.
```

Gör nu den första uppgiften, **load-model**: includen, `MODEL_PATH`, de tomma vektorerna och `loadModel()`, anropad före
`createVertexBuffer()`. Bygg och kör: kvadraten har blivit planeten med sin ring, sedd lite ovanifrån – fortfarande i
texturkoordinatfärger, eftersom fragment shadern visar dem som rött och grönt. Varje punkts färg anger dess u (rött) och
v (grönt): den färdiga planetens vita nordpol är nu nästan helt röd (v ≈ 0 högst upp i bilden), och till höger på ringen
ser du en skarp kant i färgerna: ringens söm, där dess texturkoordinater börjar om. Allt är fortfarande ett enda
`vkCmdDrawIndexed`, nu med alla modellens index.
:::
:::d3d12
```quiz
Varför går `processNode` rekursivt igenom nodträdet, när en loop över `scene->mMeshes` skulle hitta samma två meshar?
- [ ] Rekursion är snabbare än en loop för arrayer av pekare
- [x] Noderna bevarar de förälder–barn-relationer som grafikern definierade; att gå igenom dem behåller möjligheten att använda relationerna, till exempel för att flytta en del tillsammans med allt som sitter fast i den
- [ ] För att `scene->mMeshes` bara innehåller rotnodens meshar
- [ ] För att Assimp frigör varje mesh när dess nod har besökts
---
För vår planet ger båda sätten samma två meshar. Trädet spelar roll så fort du vill använda modellens struktur – en bils hjul som ska följa med bilen.
```

Gör nu uppgiften **process-node**. Inte heller nu ändras något synligt, men strukturen är komplett.
:::

:::opengl d3d12
Nästa steg är att göra om Assimps data till klassen `Mesh` från förra kapitlet.

## Från Assimp till Mesh

Att översätta ett `aiMesh`-objekt till ett eget mesh-objekt är inte särskilt svårt. Allt vi behöver göra är att läsa
var och en av meshens relevanta egenskaper och spara dem i vårt eget objekt. Den allmänna strukturen för funktionen
`processMesh` blir då:
:::
:::opengl
```cpp
    Mesh processMesh(aiMesh *mesh, const aiScene *scene)
    {
        // data to fill
        std::vector<Vertex> vertices;
        std::vector<unsigned int> indices;
        std::vector<Texture> textures;

        // TODO: copy every vertex (position, normal, texture coordinates) and the indices of every face

        // TODO: process materials: load the diffuse, specular and normal maps (loadMaterialTextures)

        // return a mesh object created from the extracted mesh data
        return Mesh(vertices, indices, textures);
    }
```

Att bearbeta en mesh sker i tre delar: hämta all vertexdata, hämta meshens index och till sist hämta den relevanta
materialdatan. Den bearbetade datan sparas i en av de tre vektorerna, och av dem skapas en `Mesh` som returneras till
anroparen.

Att hämta vertexdatan är ganska enkelt: vi definierar en `Vertex`-struct som vi lägger till i arrayen `vertices` efter
varje varv i loopen. Vi loopar lika många gånger som meshen har vertices (som vi får via `mesh->mNumVertices`). I
varje varv fyller vi structen med all relevant data. För vertexpositioner görs det så här:

```cpp
            glm::vec3 vector; // we declare a placeholder vector since assimp uses its own vector class that doesn't directly convert to glm's vec3 class so we transfer the data to this placeholder glm::vec3 first.
            // positions
            vector.x = mesh->mVertices[i].x;
            vector.y = mesh->mVertices[i].y;
            vector.z = mesh->mVertices[i].z;
            vertex.Position = vector;
```

Lägg märke till att vi definierar en tillfällig `vec3` att föra över Assimps data till. Det behövs eftersom Assimp
har egna datatyper för vektorer, matriser, strängar osv., och de går inte särskilt smidigt att omvandla till glm:s
datatyper.

Assimp kallar sin array med vertexpositioner `mVertices`, vilket inte är det mest intuitiva namnet.

Hur det går till för normaler borde inte förvåna nu:

```cpp
            // normals
            if (mesh->HasNormals())
            {
                vector.x = mesh->mNormals[i].x;
                vector.y = mesh->mNormals[i].y;
                vector.z = mesh->mNormals[i].z;
                vertex.Normal = vector;
            }
```

Texturkoordinater fungerar ungefär likadant, men Assimp låter en modell ha upp till 8 olika uppsättningar
texturkoordinater per vertex. Vi tänker inte använda 8, vi bryr oss bara om den första uppsättningen. Vi vill också
kontrollera om meshen över huvud taget har texturkoordinater (vilket inte alltid är fallet):

```cpp
            // texture coordinates
            if (mesh->mTextureCoords[0]) // does the mesh contain texture coordinates?
            {
                glm::vec2 vec;
                // a vertex can contain up to 8 different texture coordinates. We thus make the assumption that we won't
                // use models where a vertex can have multiple texture coordinates so we always take the first set (0).
                vec.x = mesh->mTextureCoords[0][i].x;
                vec.y = mesh->mTextureCoords[0][i].y;
                vertex.TexCoords = vec;
            }
            else
                vertex.TexCoords = glm::vec2(0.0f, 0.0f);
```

Structen `vertex` är nu helt fylld med de vertexattribut som behövs, och vi kan lägga den sist i vektorn `vertices` i
slutet av varvet. Det här upprepas för var och en av meshens vertices.
:::
:::d3d12
```cpp
    Mesh processMesh(aiMesh* mesh, const aiScene* scene)
    {
        // data to fill
        std::vector<Vertex> vertices;
        std::vector<UINT> indices;
        std::vector<Texture> textures;

        // TODO: walk through each of the mesh's vertices (position, normal, texture coordinates) and faces (indices)
        // TODO: process the material: its diffuse and specular maps (loadMaterialTextures)

        // The mesh's two texture views go into the next two free slots of the CBV/SRV heap.
        ...
        m_nextDescriptor += 2;

        // return a mesh object created from the extracted mesh data
        return Mesh(vertices, indices, textures, m_device, srvCpuHandle, srvGpuHandle);
    }
```

Att bearbeta en mesh sker i tre delar: hämta all vertexdata, hämta meshens index och till sist hämta den relevanta
materialdatan. Den bearbetade datan sparas i en av de tre vektorerna, och av dem skapas en `Mesh` som returneras till
anroparen. Slutet av funktionen finns redan: varje mesh får de två nästa lediga platserna i CBV/SRV-heapen för sina
texture views (kapitlet *Mesh*:s `SetupMesh` skriver dem), och kontrollen kastar ett undantag om heapen – `1 + 2 *
MaxMeshes` descriptors, med `MaxMeshes = 8` – inte har plats kvar.

Att hämta vertexdatan är ganska enkelt: vi definierar en `Vertex`-struct som vi lägger till i arrayen `vertices` efter
varje varv i loopen. Vi loopar lika många gånger som meshen har vertices (som vi får via `mesh->mNumVertices`). I
varje varv fyller vi structen med all relevant data. Assimp har en egen vektortyp, `aiVector3D`, som inte går att
omvandla till DirectXMaths typer, så vi kopierar dess komponenter till en `XMFLOAT3`:

```cpp
            Vertex vertex;
            // positions
            vertex.position = XMFLOAT3(mesh->mVertices[i].x, mesh->mVertices[i].y, mesh->mVertices[i].z);
```

Assimp kallar sin array med vertexpositioner `mVertices`, vilket inte är det mest intuitiva namnet. Hur det går till
för normaler borde inte förvåna nu:

```cpp
            // normals
            if (mesh->HasNormals())
                vertex.normal = XMFLOAT3(mesh->mNormals[i].x, mesh->mNormals[i].y, mesh->mNormals[i].z);
            else
                vertex.normal = XMFLOAT3(0.0f, 0.0f, 0.0f);
```

`XMFLOAT3` har inget standardvärde, så `else` sätter normalen till noll när det inte finns några (med
`aiProcess_GenSmoothNormals` finns det alltid). Texturkoordinater fungerar ungefär likadant, men Assimp låter en modell
ha upp till 8 olika uppsättningar texturkoordinater per vertex. Vi tänker inte använda 8, vi bryr oss bara om den
första uppsättningen. Vi vill också kontrollera om meshen över huvud taget har texturkoordinater (vilket inte alltid är
fallet):

```cpp
            // texture coordinates
            if (mesh->mTextureCoords[0]) // does the mesh contain texture coordinates?
            {
                // a vertex can contain up to 8 different texture coordinates. We thus make the assumption that we won't
                // use models where a vertex can have multiple texture coordinates so we always take the first set (0).
                vertex.texCoord = XMFLOAT2(mesh->mTextureCoords[0][i].x, mesh->mTextureCoords[0][i].y);
            }
            else
                vertex.texCoord = XMFLOAT2(0.0f, 0.0f);

            vertices.push_back(vertex);
```

Structen `vertex` är nu helt fylld med de vertexattribut som behövs, och vi lägger den sist i vektorn `vertices` i
slutet av varvet. Det här upprepas för var och en av meshens vertices.
:::

:::opengl d3d12
## Index

Assimps gränssnitt definierar varje mesh som en array av ytor (faces), där varje yta är en enda primitiv, vilket i vårt
fall (tack vare alternativet `aiProcess_Triangulate`) alltid är en triangel. En yta innehåller indexen för de vertices
vi behöver rita, och i vilken ordning, för dess primitiv. Om vi itererar över alla ytor och sparar varje ytas index i
vektorn `indices` är vi alltså klara:
:::
:::opengl
```cpp
        // now walk through each of the mesh's faces (a face is a mesh its triangle) and retrieve the corresponding vertex indices.
        for (unsigned int i = 0; i < mesh->mNumFaces; i++)
        {
            aiFace face = mesh->mFaces[i];
            // retrieve all indices of the face and store them in the indices vector
            for (unsigned int j = 0; j < face.mNumIndices; j++)
                indices.push_back(face.mIndices[j]);
        }
```

När den yttre loopen är klar har vi en komplett uppsättning vertices och indexdata för att rita meshen med
`glDrawElements`.
:::
:::d3d12
```cpp
        // now walk through each of the mesh's faces (a face is a mesh its triangle) and retrieve the corresponding vertex indices.
        for (UINT i = 0; i < mesh->mNumFaces; i++)
        {
            aiFace face = mesh->mFaces[i];
            // retrieve all indices of the face and store them in the indices vector
            for (UINT j = 0; j < face.mNumIndices; j++)
                indices.push_back(face.mIndices[j]);
        }
```

När den yttre loopen är klar har vi en komplett uppsättning vertices och indexdata för att rita meshen med
`DrawIndexedInstanced`.
:::
:::opengl d3d12
En sak är bra att veta om resultatet: till skillnad från vår egen kubdata delas de vertices Assimp ger oss inte
nödvändigtvis mellan trianglar. För en OBJ-fil ger Assimp typiskt varje hörn i varje yta en egen vertex, så indexen
räknar bara 0, 1, 2, 3 …. Vill du ha delade vertices lägger du till `aiProcess_JoinIdenticalVertices` bland flaggorna:
den slår ihop vertices med identisk data, och index buffern återanvänder dem sedan. learnopengl använder den inte, och
för en så liten modell som vår spelar det ingen roll.

Gör nu uppgiften **process-mesh**: vertexloopen och ytloopen. Inget synligt ändras än. Men för att avsluta genomgången
och ge meshen lite mer detaljer vill vi också bearbeta meshens material.
:::

## En anmärkning om texturens orientering

Innan vi läser in några texturer avgör en detalj om planeten hamnar rätt väg upp. OBJ-formatet räknar sin
texturkoordinat v från bildens **nederkant** (v = 0 är den nedersta raden, v = 1 den översta), precis som OpenGL.
stb_image levererar däremot bildens **översta** rad först.

:::opengl
I OpenGL lägger `glTexImage2D` den första raden den får vid t = 0. Laddar vi upp stb_images data som den är blir
t = 0 bildens översta rad – motsatsen till vad OBJ-filen menar. Exakt **en** vändning rättar till det, och det finns
två ställen att göra den på: vända bilden vid inläsningen (`stbi_set_flip_vertically_on_load(true)`, som i kapitlet
*Textures*) eller vända koordinaterna (`aiProcess_FlipUVs`, v blir 1 − v). Vår `model.h` behåller learnopengls
flaggor, så koordinaterna vänds, och projektet anropar **inte** `stbi_set_flip_vertically_on_load(true)`.

learnopengls `model_loading.cpp` gör båda. Det passar dess ryggsäcksmodell, vars texturkoordinater är lagrade åt andra
hållet, men för en fil som vår tar de två vändningarna ut varandra och planetens textur hamnar upp och ner – isen från
nordpolen skulle synas vid sydpolen. `main.cpp` har en kommentar om detta där modellen läses in.
:::
:::vulkan
I Vulkan är texturkoordinaten v = 0 bildens översta rad, och stb_images data laddas upp som den är, översta raden
först. Alltså måste v vändas exakt **en** gång, och precis som vulkan-tutorial vänder vi den där vi läser den:
`1.0f - attrib.texcoords[2 * index.texcoord_index + 1]`. (Att i stället vända bilden vid inläsningen skulle fungera
lika bra; att göra båda skulle vända planeten upp och ner.)
:::
:::d3d12
I Direct3D är texturkoordinaten v = 0 bildens översta rad, och `TextureFromFile` laddar upp stb_images data som den
är, översta raden först. Alltså måste v vändas exakt **en** gång, och det är vad `aiProcess_FlipUVs` gör: v blir
1 − v. learnopengls OpenGL-program vänder två gånger – `aiProcess_FlipUVs` *och*
`stbi_set_flip_vertically_on_load(true)` – vilket bara passar dess ryggsäcksmodell, vars koordinater är lagrade åt
andra hållet. För vår planet gör en vändning den upprätt, med den vita polen högst upp. (`aiProcess_ConvertToLeftHanded`
används inte heller: programmet behåller learnopengls högerhänta matematik, `XMMatrixLookAtRH` och
`XMMatrixPerspectiveFovRH`.)
:::

```quiz
`planet.obj` räknar v från bildens nederkant, och stb_image levererar den översta raden först. Hur många gånger måste programmet vända v (eller bilden) för att planeten ska bli upprätt?
- [ ] Aldrig: modellfiler görs alltid för det API som läser in dem
- [ ] Två gånger: en gång för koordinaterna och en gång för bilden, som learnopengls model_loading.cpp gör
- [x] Exakt en gång – om programmet vänder koordinaterna eller bilden spelar ingen roll
- [ ] Det beror på bildens storlek
---
Varje vändning vänder texturen upp och ner, så två vändningar tar ut varandra. learnopengl vänder två gånger för sin ryggsäck bara för att den modellens koordinater redan är lagrade vända; för vår är en vändning rätt.
```

:::opengl d3d12
## Material

Precis som med noder innehåller en mesh bara ett index till ett materialobjekt. För att hämta en meshs material
indexerar vi scenens array `mMaterials`. Meshens materialindex finns i dess egenskap `mMaterialIndex`. (learnopengl
kontrollerar det med `if (mesh->mMaterialIndex >= 0)`, men indexet är unsigned, och Assimp ger alltid en lyckat
inläst scen minst ett material – ett standardmaterial om filen saknar material – så vår kod använder det direkt.)

```cpp
        // process materials
        aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];
```

Först hämtar vi `aiMaterial`-objektet ur scenens array `mMaterials`. Sedan vill vi läsa in meshens diffuse- och/eller
specular-texturer. Ett materialobjekt lagrar internt en array med texturplatser för varje texturtyp. De olika
texturtyperna har alla prefixet `aiTextureType_`. Vi använder en hjälpfunktion, `loadMaterialTextures`, för att hämta,
läsa in och initiera texturerna från materialet. Funktionen returnerar en vektor med `Texture`-structar som vi lägger
sist i meshens vektor `textures`:
:::
:::opengl
```cpp
        // 1. diffuse maps
        std::vector<Texture> diffuseMaps = loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse");
        textures.insert(textures.end(), diffuseMaps.begin(), diffuseMaps.end());
        // 2. specular maps
        std::vector<Texture> specularMaps = loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular");
        textures.insert(textures.end(), specularMaps.begin(), specularMaps.end());
        // 3. normal maps
        std::vector<Texture> normalMaps = loadMaterialTextures(material, aiTextureType_HEIGHT, "texture_normal");
        textures.insert(textures.end(), normalMaps.begin(), normalMaps.end());
```

Typnamnen är konventionen från kapitlet *Mesh*: `Mesh::Draw` binder varje textur till en sampler som heter
`texture_diffuseN`, `texture_specularN` eller `texture_normalN`. Normal maps läses som `aiTextureType_HEIGHT` eftersom
Assimps OBJ-importerare lagrar en `map_Bump`-rad under den typen; `planet.mtl` har ingen, så för vår modell hittar det
anropet ingenting. Planetmeshen får `planet_diffuse.png` och `planet_specular.png`, ringen `rings.png` och
`rings_specular.png`.
:::
:::d3d12
```cpp
        // 1. diffuse maps
        std::vector<Texture> diffuseMaps = loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse");
        textures.insert(textures.end(), diffuseMaps.begin(), diffuseMaps.end());
        // 2. specular maps
        std::vector<Texture> specularMaps = loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular");
        textures.insert(textures.end(), specularMaps.begin(), specularMaps.end());
```

Typnamnen är konventionen från kapitlet *Mesh*: `SetupMesh` lägger meshens första `"texture_diffuse"` på dess första
plats i heapen (register `t0`, `texture_diffuse1` i shadern) och dess första `"texture_specular"` på den andra (`t1`,
`texture_specular1`). learnopengl läser också in normal maps (`aiTextureType_HEIGHT`); våra meshar har bara två
platser och `planet.mtl` har inga normal maps, så vi utelämnar dem. Planetmeshen får `planet_diffuse.png` och
`planet_specular.png`, ringen `rings.png` och `rings_specular.png`.
:::
:::opengl d3d12
Funktionen `loadMaterialTextures` itererar över alla texturplatser av den givna texturtypen, hämtar texturens
filplats, läser in och skapar texturen och sparar informationen i en `Texture`-struct. I sin enklaste form ser den ut
så här:

```cpp
    std::vector<Texture> loadMaterialTextures(aiMaterial *mat, aiTextureType type, std::string typeName)
    {
        std::vector<Texture> textures;
        for (unsigned int i = 0; i < mat->GetTextureCount(type); i++)
        {
            aiString str;
            mat->GetTexture(type, i, &str);
            Texture texture;
            ...                         // load the file str names
            texture.type = typeName;
            texture.path = str.C_Str();
            textures.push_back(texture);
        }
        return textures;
    }
```

Först tar vi reda på hur många texturer materialet har via dess funktion `GetTextureCount`, som förväntar sig en av de
texturtyper vi har angett. Vi hämtar varje texturs filplats via funktionen `GetTexture`, som lägger resultatet i en
`aiString`. Sedan använder vi ytterligare en hjälpfunktion, `TextureFromFile`, som läser in en textur (med stb_image)
åt oss.

Lägg märke till att vi antar att texturernas filsökvägar i modellfiler är relativa till själva modellobjektet, till
exempel i samma katalog som modellen. Då kan vi helt enkelt sätta ihop texturens sökväg med katalogsträngen vi
hämtade tidigare (i funktionen `loadModel`) och få den fullständiga sökvägen till texturen (det är därför
`TextureFromFile` också behöver katalogsträngen): `planet.mtl` säger `planet_diffuse.png`, och filen är
`models/planet_diffuse.png`.

Vissa modeller som du hittar på internet använder absoluta sökvägar för sina texturer, vilket inte fungerar på alla
datorer. Då vill du förmodligen redigera filen för hand så att den använder lokala sökvägar till texturerna (om det
går).
:::
:::opengl
`TextureFromFile` är ljuskapitlens funktion `loadTexture`, med katalogen före filnamnet:

```cpp
unsigned int TextureFromFile(const char *path, const std::string &directory)
{
    std::string filename = std::string(path);
    filename = directory + '/' + filename;

    unsigned int textureID;
    glGenTextures(1, &textureID);

    int width, height, nrComponents;
    unsigned char *data = stbi_load(filename.c_str(), &width, &height, &nrComponents, 0);
    if (data)
    {
        GLenum format = GL_RGB;
        if (nrComponents == 1)
            format = GL_RED;
        else if (nrComponents == 3)
            format = GL_RGB;
        else if (nrComponents == 4)
            format = GL_RGBA;

        glBindTexture(GL_TEXTURE_2D, textureID);
        glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);

        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        stbi_image_free(data);
    }
    else
    {
        std::cout << "Texture failed to load at path: " << path << std::endl;
        stbi_image_free(data);
    }

    return textureID;
}
```

Den hamnar efter klassen, där TODO:n står; klassen behöver bara deklarationen, som finns högst upp i `model.h`. Här
finns ingen `stbi_set_flip_vertically_on_load`, av skälet ovan. `model.h` inkluderar `<stb_image.h>` bara för
deklarationerna: `main.cpp` definierar `STB_IMAGE_IMPLEMENTATION` före sin egen include, så stb_images kod kompileras
exakt en gång.

Gör nu uppgiften **texture-from-file**. Fortfarande ändras inget synligt: ingenting anropar funktionen än.
:::
:::d3d12
`TextureFromFile` finns redan i projektet, efter klassen. Det är de tidigare kapitlens `LoadTexture` utan view (varje
mesh skapar sina egna views på sina platser i heapen), med katalogen före filnamnet:

```cpp
ComPtr<ID3D12Resource> TextureFromFile(const char* path, const std::string& directory, ID3D12Device* device, ID3D12GraphicsCommandList* commandList, ComPtr<ID3D12Resource>& uploadHeap)
{
    // the file is next to the model
    std::string filename = directory + '/' + std::string(path);
    ...
    unsigned char* data = stbi_load(filename.c_str(), &width, &height, &nrComponents, 4);
```

Den läser in bilden som RGBA, skapar en `R8G8B8A8_UNORM`-textur i en default heap, skapar upload-buffern som den
returnerar i `uploadHeap`, spelar in kopieringen med `UpdateSubresources` och en barrier till `PIXEL_SHADER_RESOURCE`
i command listen och returnerar texturen. Lägg märke till att kopieringen bara *spelas in*: den sker när command
listen körs. Fram till dess måste upload-buffern leva – det är vad modellens vektor `uploadHeaps` är till för.
:::

:::opengl d3d12
## En optimering

Vi är inte helt klara än, för det finns fortfarande en stor (men inte absolut nödvändig) optimering vi vill göra. De
flesta scener återanvänder flera av sina texturer på flera meshar; tänk på huset igen, som har en granittextur på
väggarna. Samma textur kan också användas på golvet, i taken, i trappan, kanske på ett bord och kanske till och med på
en liten brunn i närheten. Att läsa in texturer är ingen billig operation, och i vår nuvarande implementation läses en
ny textur in och skapas för varje mesh, även om exakt samma textur redan har lästs in flera gånger. Det blir snabbt
flaskhalsen i din modellinläsning.

Så vi gör en liten justering i modellkoden genom att spara alla inlästa texturer globalt. Var vi än vill läsa in en
textur kontrollerar vi först om den inte redan har lästs in. Har den det tar vi den texturen och hoppar över hela
inläsningen, vilket sparar mycket arbete. För att kunna jämföra texturer behöver vi också spara deras sökväg – det är
därför kapitlet *Mesh*:s `Texture`-struct har en `path`. Alla inlästa texturer sparas i modellens vektor
`textures_loaded`.

I funktionen `loadMaterialTextures` vill vi jämföra texturens sökväg med alla texturer i vektorn `textures_loaded` för
att se om den aktuella sökvägen är lika med någon av dem. Är den det hoppar vi över inläsningen och skapandet och
använder helt enkelt den hittade texturstructen som meshens textur. Den (uppdaterade) funktionen ser ut så här:
:::
:::opengl
```cpp
    std::vector<Texture> loadMaterialTextures(aiMaterial *mat, aiTextureType type, std::string typeName)
    {
        std::vector<Texture> textures;
        for (unsigned int i = 0; i < mat->GetTextureCount(type); i++)
        {
            aiString str;
            mat->GetTexture(type, i, &str);
            // check if texture was loaded before and if so, continue to next iteration: skip loading a new texture
            bool skip = false;
            for (unsigned int j = 0; j < textures_loaded.size(); j++)
            {
                if (std::strcmp(textures_loaded[j].path.data(), str.C_Str()) == 0)
                {
                    textures.push_back(textures_loaded[j]);
                    skip = true; // a texture with the same filepath has already been loaded, continue to next one. (optimization)
                    break;
                }
            }
            if (!skip)
            {   // if texture hasn't been loaded already, load it
                Texture texture;
                texture.id = TextureFromFile(str.C_Str(), this->directory);
                texture.type = typeName;
                texture.path = str.C_Str();
                textures.push_back(texture);
                textures_loaded.push_back(texture); // store it as texture loaded for entire model, to ensure we won't unnecessary load duplicate textures.
            }
        }
        return textures;
    }
```

Våra två meshar delar ingen textur, så för planeten slår cachen aldrig till – men läs in en modell vars femtio meshar
alla använder samma granittextur, så är skillnaden femtio texturinläsningar mot en.

Gör nu uppgiften **material-textures**: `loadMaterialTextures` med cachen och materialdelen av `processMesh`. Allt är
inläst nu; det ritas bara inte än.

```quiz
Vad sparar `textures_loaded` när två meshar i en modell använder samma bildfil?
- [x] Den andra meshen får den `Texture` som redan skapades för den första – samma textur-id – så filen läses och laddas upp bara en gång
- [ ] Den sparar bildens pixlar så att den andra texturen kan skapas utan att filen läses
- [ ] Ingenting: varje mesh behöver ett eget texturobjekt, så filen läses in två gånger ändå
- [ ] Den gör om de två mesharna till en, så att de ritas med ett draw-anrop
---
Jämförelsen sker på sökvägen, namnet som materialet anger. Ett texturobjekt kan bindas för hur många draw-anrop som helst, så det gör inget att meshar delar det.
```
:::
:::d3d12
```cpp
    std::vector<Texture> loadMaterialTextures(aiMaterial* mat, aiTextureType type, std::string typeName)
    {
        std::vector<Texture> textures;
        for (UINT i = 0; i < mat->GetTextureCount(type); i++)
        {
            aiString str;
            mat->GetTexture(type, i, &str);
            // check if texture was loaded before and if so, continue to next iteration: skip loading a new texture
            bool skip = false;
            for (UINT j = 0; j < textures_loaded.size(); j++)
            {
                if (std::strcmp(textures_loaded[j].path.data(), str.C_Str()) == 0)
                {
                    textures.push_back(textures_loaded[j]);
                    skip = true; // a texture with the same filepath has already been loaded, continue to next one. (optimization)
                    break;
                }
            }
            if (!skip)
            {   // if texture hasn't been loaded already, load it
                Texture texture;
                ComPtr<ID3D12Resource> uploadHeap;
                texture.resource = TextureFromFile(str.C_Str(), directory, m_device, m_commandList, uploadHeap);
                texture.type = typeName;
                texture.path = str.C_Str();
                textures.push_back(texture);
                textures_loaded.push_back(texture);  // store it as texture loaded for entire model, to ensure we won't unnecessary load duplicate textures.
                uploadHeaps.push_back(uploadHeap);
            }
        }
        return textures;
    }
```

En `Texture` innehåller en `ComPtr`, så kopian i `textures_loaded` och kopiorna i mesharna hänvisar alla till samma
`ID3D12Resource`: texturen lever så länge någon av dem gör det. Varje ny texturs upload-buffer hamnar i `uploadHeaps`.
Våra två meshar delar ingen textur, så för planeten slår cachen aldrig till – men läs in en modell vars femtio meshar
alla använder samma granittextur, så är skillnaden femtio texturinläsningar mot en.

Gör nu uppgiften **material-textures**: `loadMaterialTextures` med cachen och materialdelen av `processMesh`. Allt kan
läsas in nu; det görs bara inte än.
:::
:::vulkan
## Material

learnopengls `processMesh` frågar varje meshs `aiMaterial` efter namnen på dess texturer och läser in dem. Vårt
program gör samma jobb mer direkt, som vulkan-tutorial: det känner till modellens material och läser in deras
texturer från konstanter. `planet.mtl` namnger filerna – `map_Kd` är diffuse mapen, `map_Ks` specular mapen – och
tinyobjloader skulle också ge oss namnen (`materials[i].diffuse_texname` och `materials[i].specular_texname`); en
inläsare för vilken modell som helst skulle läsa in texturerna utifrån dem. Vi börjar med diffuse maps, i materialens
ordning:

```cpp
// the textures of the model's materials (map_Kd in planet.mtl), in the order of their bindings
const std::string PLANET_DIFFUSE_PATH = "models/planet_diffuse.png";
const std::string RINGS_DIFFUSE_PATH = "models/rings.png";
```

Varje textur är tre Vulkan-objekt – bilden, dess minne och den view som shadrarna läser den genom – så en liten struct
håller ihop dem, och klassen får en för varje material:

```cpp
// A texture: the image, its memory and the view the shaders read it through.
struct Texture {
    VkImage image;
    VkDeviceMemory memory;
    VkImageView view;
};
...
    Texture planetDiffuseMap; // material 0, "planet"
    Texture ringsDiffuseMap;  // material 1, "rings"
```

`createTextures()` läser in dem och anropas i `initVulkan()` före `createTextureSampler()`; en hjälpfunktion gör det
som varje textur behöver – det här är learnopengls `TextureFromFile`:

```cpp
    // The textures of the model's materials, loaded in the order of their bindings.
    void createTextures() {
        int texWidth, texHeight, texChannels;

        stbi_uc* pixels = stbi_load(PLANET_DIFFUSE_PATH.c_str(), &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);
        createTexture(pixels, texWidth, texHeight, planetDiffuseMap);

        pixels = stbi_load(RINGS_DIFFUSE_PATH.c_str(), &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);
        createTexture(pixels, texWidth, texHeight, ringsDiffuseMap);
    }

    // A texture from the pixels stb_image loaded (RGBA): the image and its view. Frees the pixels.
    void createTexture(stbi_uc* pixels, int texWidth, int texHeight, Texture& texture) {
        if (!pixels) {
            throw std::runtime_error("failed to load texture image!");
        }

        createTextureImage(pixels, texWidth, texHeight, texture.image, texture.memory);
        stbi_image_free(pixels);

        texture.view = createImageView(texture.image, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
    }

    void destroyTexture(Texture& texture) {
        vkDestroyImageView(device, texture.view, nullptr);
        vkDestroyImage(device, texture.image, nullptr);
        vkFreeMemory(device, texture.memory, nullptr);
    }
```

`createTextureImage` är ljuskapitlens hjälpfunktion: en staging buffer, en device-lokal `VK_FORMAT_R8G8B8A8_UNORM`-bild,
de två layoutövergångarna och kopieringen. I `cleanup()`, efter samplern, anropar du `destroyTexture(planetDiffuseMap);`
och `destroyTexture(ringsDiffuseMap);`.

Gör nu uppgiften **textures**. Bilden ändras inte – ingenting läser texturerna än.

Sedan måste shadrarna nå dem: varje textur blir en combined image sampler med en egen binding. Binding 0 förblir
uniform buffern; texturerna får binding 1, 2, … i konstanternas ordning. I `createDescriptorSetLayout()` räcker en
bindningsbeskrivning för dem alla, kopierad med olika nummer:

```cpp
        // a combined image sampler for each texture, read by the fragment shader
        VkDescriptorSetLayoutBinding samplerLayoutBinding{};
        samplerLayoutBinding.descriptorCount = 1;
        samplerLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        samplerLayoutBinding.pImmutableSamplers = nullptr;
        samplerLayoutBinding.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;

        std::array<VkDescriptorSetLayoutBinding, 3> bindings = {uboLayoutBinding, samplerLayoutBinding, samplerLayoutBinding};
        bindings[1].binding = 1; // planetDiffuseMap
        bindings[2].binding = 2; // ringsDiffuseMap
```

Poolen behöver plats för dem:

```cpp
        std::array<VkDescriptorPoolSize, 2> poolSizes{};
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        poolSizes[0].descriptorCount = 1; // the set has one uniform buffer
        poolSizes[1].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[1].descriptorCount = 2; // and a combined image sampler for each texture
```

och `createDescriptorSets()` skriver en image info per textur, alla med samma sampler:

```cpp
        // the textures, in binding order (1, 2, ...): one image info for each, all read with the same sampler
        std::array<VkImageView, 2> textureViews = {planetDiffuseMap.view, ringsDiffuseMap.view};
        std::array<VkDescriptorImageInfo, 2> imageInfos{};
        for (size_t i = 0; i < imageInfos.size(); i++) {
            imageInfos[i].imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
            imageInfos[i].imageView = textureViews[i];
            imageInfos[i].sampler = textureSampler;
        }

        std::array<VkWriteDescriptorSet, 3> descriptorWrites{};
        ...
        for (size_t i = 0; i < imageInfos.size(); i++) {
            descriptorWrites[1 + i].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
            descriptorWrites[1 + i].dstSet = descriptorSet;
            descriptorWrites[1 + i].dstBinding = static_cast<uint32_t>(1 + i);
            descriptorWrites[1 + i].dstArrayElement = 0;
            descriptorWrites[1 + i].descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
            descriptorWrites[1 + i].descriptorCount = 1;
            descriptorWrites[1 + i].pImageInfo = &imageInfos[i];
        }
```

Gör nu uppgiften **descriptors**. Bilden ändras fortfarande inte: descriptorerna finns, men shadrarna deklarerar dem
inte än.

I learnopengl ritas varje mesh för sig, med sina egna texturer bundna till `texture_diffuse1`. Vi ritar hela modellen
på en gång, så fragment shadern har båda diffuse maps och måste välja: vertexens `materialIndex` talar om vilken.
Vertex shadern skickar den vidare:

```glsl
layout(location = 2) out vec2 fragTexCoord;
// "flat": the value of the triangle's first vertex, not interpolated (an integer cannot be)
layout(location = 3) flat out uint fragMaterialIndex;
...
    fragTexCoord = inTexCoord;
    fragMaterialIndex = inMaterialIndex;
```

Normalt interpolerar rasteriseraren varje utdata mellan triangelns tre vertices. Ett heltal kan inte interpoleras –
vad skulle ligga mittemellan material 0 och material 1? – så heltalsutdata måste deklareras `flat`: varje fragment får
värdet från en av triangelns vertices (den *provoking vertex*, som standard den första). Alla tre vertices i en av våra
trianglar har ändå samma material.

Fragment shadern deklarerar de två texturerna och indatan, samplar båda och behåller den som hör till fragmentets
material:

```glsl
// the diffuse maps of the model's materials: material 0 "planet" and material 1 "rings"
layout(binding = 1) uniform sampler2D planetDiffuseMap;
layout(binding = 2) uniform sampler2D ringsDiffuseMap;

layout(location = 2) in vec2 fragTexCoord;
layout(location = 3) flat in uint fragMaterialIndex;
...
    // sample the texture of every material, then keep the one of this fragment's material
    // (sampling outside an if keeps the texture's level of detail correct across the triangle's edges)
    vec4 planetColor = texture(planetDiffuseMap, fragTexCoord);
    vec4 ringsColor = texture(ringsDiffuseMap, fragTexCoord);
    outColor = fragMaterialIndex == 0u ? planetColor : ringsColor;
```

Varför sampla båda i stället för `if (fragMaterialIndex == 0u) outColor = texture(planetDiffuseMap, …)`? `texture()`
väljer sin detaljnivå (level of detail) utifrån hur snabbt texturkoordinaterna ändras mellan närliggande fragment,
vilket GPU:n mäter genom att köra fragment i grupper om 2×2. Inuti en `if` vars villkor skiljer sig mellan grannarna –
på gränsen mellan ringen och planeten – kör några av dem inte anropet till `texture()`, och resultatet är odefinierat.
Att sampla båda utanför villkoret är alltid rätt; för två texturer är det extra samplet billigt.

Gör nu uppgiften **material-textures** och bygg och kör sedan. Planeten syns med textur: blå hav, grönt land och den
vita nordpolen högst upp – texturen är upprätt – med ringens beige band runt sig, sedd lite ovanifrån. Det här är bilden
från learnopengls `model_loading.cpp`: bara diffuse-texturen, ingen ljussättning.

```quiz
Planeten och ringen har olika diffuse maps, men hela modellen är ett enda `vkCmdDrawIndexed`. Hur får ett fragment på ringen färgen från `rings.png`?
- [ ] Ringens texturkoordinater ligger utanför 0..1, vilket väljer den andra texturen
- [x] Varje vertex bär sitt materials nummer; fragment shadern får det som `fragMaterialIndex` och behåller samplet från `ringsDiffuseMap` när det är 1
- [ ] Descriptor setet byts halvvägs genom draw-anropet
- [ ] Samplern väljer texturen efter bindingnumret i vertexen
---
`loadModel()` kopierade varje ytas post i `material_ids` till dess vertices. Båda texturerna är bundna hela tiden; materialindexet avgör vilket sampel som blir färgen.
```

```quiz
Varför deklareras `fragMaterialIndex` som `flat`?
- [ ] För att `flat` gör triangelns skuggning platt, vilket ringen behöver
- [x] Heltalsutdata kan inte interpoleras: `flat` ger varje fragment värdet från en av triangelns vertices oförändrat
- [ ] Så att det skickas som push constant i stället för som vertexattribut
- [ ] För att fragment shadern ska slippa normalisera det
---
Interpolering är till för värden som övergår mjukt, som texturkoordinater och normaler. Ett materialnummer måste komma fram exakt som det var – och GLSL kräver `flat` för heltalsindata i en fragment shader.
```

## En optimering

learnopengls optimering ser till att ingen texturfil läses in två gånger, även om många meshar använder den. I vårt
program läses varje texturfil in exakt en gång redan genom sin konstruktion: en konstant, en `stbi_load`, en `Texture`
per fil. En inläsare för vilken modell som helst skulle behöva learnopengls cache – komma ihåg namnen på filerna som
redan lästs in och återanvända deras texturer.

Vårt program har två egna optimeringar: vertex-dedupliceringen i `loadModel()`, som krymper vertex buffern från 3168
vertices till 657, och det enda draw-anropet för hela modellen. learnopengl ritar varje mesh med sin egen
`glDrawElements` och binder dess texturer före varje anrop; vi binder allt en gång och låter materialindexet välja.
Med många material håller det inte längre – en shader kan inte sampla hundra texturer för varje fragment – och riktiga
Vulkan-program använder då *arrayer* av texturer som indexeras med materialet, eller ritar varje material för sig med
ett eget descriptor set. För två material är det enkla sättet det rätta.
:::

:::opengl
## Inga fler lådor!

Låt oss provköra vår implementation genom att faktiskt importera en modell. learnopengl läser in en ryggsäck gjord av
en grafiker; vi läser in kursens planet. Deklarera ett `Model`-objekt och skicka in modellens filsökväg. Modellen läses
då in automatiskt och (om inget gick fel) renderas i renderingsloopen med dess funktion `Draw`, och det är allt. Inga
fler buffertallokeringar, attributpekare och renderingskommandon, bara en enkel rad:

```cpp
    // load models
    // -----------
    // (no stbi_set_flip_vertically_on_load(true) here: aiProcess_FlipUVs in model.h already turns the texture
    // coordinates the right way up - doing both would turn the textures upside down)
    Model ourModel("models/planet.obj");
```

Modellen läses in en gång, efter shadern och före renderingsloopen; sökvägen är relativ till programmets katalog. I
renderingsloopen ritas den direkt efter att dess model-matris har satts – matrisen som lutar planeten 25° kring x-axeln
så att ringen syns, och skalar den till halva storleken:

```cpp
        // world transformation of the model
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 0.0f, 0.0f)); // centre of the scene
        model = glm::rotate(model, glm::radians(25.0f), glm::vec3(1.0f, 0.0f, 0.0f)); // tilt it so the ring shows
        model = glm::scale(model, glm::vec3(0.5f));                 // planet radius 0.5, ring up to 1.0
        ourShader.setMat4("model", model);
        ourModel.Draw(ourShader);
```

Shadrarna är de enkla från början av den här delen: fragment shadern ger bara ut objektets diffuse-textur:

```glsl
uniform sampler2D texture_diffuse1;

void main()
{
    FragColor = texture(texture_diffuse1, TexCoords);
}
```

Gör nu uppgiften **draw-model**: `Model::Draw` och de två raderna i `main.cpp`. Bygg och kör: planeten syns, med textur
och utan ljussättning – blå hav, grönt land, den vita nordpolen högst upp – med den beige ringen runt sig, sedd lite
ovanifrån. Ringens närmaste del går framför planeten; bakom planeten döljer djuptestet den.

```quiz
Fragment shadern samplar bara `texture_diffuse1`, men ändå visar planeten `planet_diffuse.png` och ringen `rings.png`. Varför?
- [x] Varje mesh ritas för sig: före dess `glDrawElements` binder `Mesh::Draw` meshens diffuse-textur till en enhet och pekar `texture_diffuse1` på den
- [ ] `texture_diffuse1` är en array som innehåller båda texturerna
- [ ] Shadern kompileras två gånger, en gång per mesh
- [ ] OpenGL väljer den textur vars namn stämmer med meshens namn
---
`Model::Draw` anropar `Mesh::Draw` för varje mesh, och varje anrop binder sina egna texturer innan det ritar. Samplerns namn är detsamma; det som är bundet till den ändras mellan draw-anropen.
```
:::
:::d3d12
## Inga fler lådor!

Låt oss provköra vår implementation genom att faktiskt importera en modell. learnopengl läser in en ryggsäck gjord av
en grafiker; vi läser in kursens planet. Applikationen får en modellmedlem:

```cpp
    Model m_model;    // the model: its meshes and their textures
```

Den läses in i `LoadAssets` medan command listen fortfarande är öppen – texturernas kopiering spelas in i den:

```cpp
    // Load the model: its meshes (vertex and index buffers) and its textures, whose copies
    // are recorded in this command list. The meshes' texture views go into the CBV/SRV heap
    // from slot 1 on (slot 0 is the CBV).
    m_model.Load("models/planet.obj", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1);
```

I slutet av `LoadAssets` stängs command listen, körs och programmet väntar på GPU:n med `WaitForPreviousFrame()`.
Först efter den väntan har kopieringarna skett, och först då får upload-buffrarna försvinna:

```cpp
        // The textures have been copied: their upload buffers can go.
        m_model.uploadHeaps.clear();
```

Att släppa dem tidigare – till exempel i slutet av `Load` – skulle frigöra minne som GPU:n fortfarande ska läsa. Att
behålla dem hela programmet vore inte fel, men det skulle slösa lika mycket minne som alla texturer tillsammans.

Till sist ritar `PopulateCommandList` modellen direkt efter att dess model-matris har satts som root constants –
matrisen som skalar planeten till halva storleken och lutar den 25° kring x-axeln så att ringen syns:

```cpp
    XMMATRIX model = XMMatrixScaling(0.5f, 0.5f, 0.5f)                                            // planet radius 0.5, ring up to 1.0
        * XMMatrixRotationAxis(XMVectorSet(1.0f, 0.0f, 0.0f, 0.0f), XMConvertToRadians(25.0f))   // tilt it so the ring shows
        * XMMatrixTranslation(0.0f, 0.0f, 0.0f);                                                  // centre of the scene
    ...
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);

    // render the loaded model: each mesh binds its textures and draws itself
    m_model.Draw(m_commandList.Get());
```

Inga fler buffertallokeringar, views och draw-anrop i `D3D12App`: bara en enkel rad. Pixel shadern är den enkla från
början av den här delen – den returnerar bara diffuse-texturen:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    return texture_diffuse1.Sample(wrapSampler, input.texCoords);
}
```

Gör nu uppgiften **draw-model** och bygg och kör sedan: planeten syns, med textur och utan ljussättning – blå hav, grönt
land, den vita nordpolen högst upp – med den beige ringen runt sig, sedd lite ovanifrån. Ringens närmaste del går
framför planeten; bakom planeten döljer djuptestet den.

```quiz
När får `LoadAssets` släppa texturernas upload-buffrar (`m_model.uploadHeaps.clear()`)?
- [ ] Aldrig: texturerna läser från sina upload-buffrar varje frame
- [ ] Direkt efter `m_model.Load(…)`, eftersom `TextureFromFile` har kopierat pixlarna då
- [x] Efter `WaitForPreviousFrame()`: kopieringarna spelades bara in i command listen, och de läser från upload-buffrarna när GPU:n kör den
- [ ] Före `m_commandList->Close()`, så att den stängda command listen inte hänvisar till dem
---
`UpdateSubresources` kopierar pixlarna till upload-buffern på CPU:n, men kopieringen till texturen är ett kommando. När fencen visar att GPU:n är klar med command listen har texturerna sina pixlar och upload-buffrarna behövs inte längre.
```

```quiz
Pixel shadern samplar bara `texture_diffuse1` (register `t0`), men ändå visar planeten `planet_diffuse.png` och ringen `rings.png`. Varför?
- [ ] Den statiska samplern väljer texturen efter meshens namn
- [ ] `t0` är en array som innehåller båda texturerna
- [x] Varje mesh ritas för sig, och `Mesh::Draw` sätter först root-parameter 2 till meshens två platser i heapen, så `t0` är planetens diffuse map i det ena draw-anropet och ringens i det andra
- [ ] Shadern kompileras två gånger, en gång per mesh
---
`SetGraphicsRootDescriptorTable(2, m_srvHandle)` pekar tabellen på meshens egna SRV:er. Registret är detsamma; descriptorerna det läser ändras mellan draw-anropen.
```
:::
:::vulkan
## Inga fler lådor!

learnopengl läser in en ryggsäck gjord av en grafiker; vi har läst in kursens planet – och ingenting i
`recordCommandBuffer()` behövde ändras för det: samma buffrar, samma `vkCmdDrawIndexed`, bara fler index. Jämfört med
lådorna i ljussättningsdelen kommer nu allt som är modellspecifikt från filer.

Materialen har också specular maps, `map_Ks` i `planet.mtl`. De behövs för ljussättningsövningen nedan, så läs in och
bind dem på samma sätt som diffuse maps: två konstanter till efter diffuse-konstanterna,

```cpp
// and their specular maps (map_Ks)
const std::string PLANET_SPECULAR_PATH = "models/planet_specular.png";
const std::string RINGS_SPECULAR_PATH = "models/rings_specular.png";
```

två medlemmar till (`Texture planetSpecularMap;` och `Texture ringsSpecularMap;`), två `stbi_load` + `createTexture`
till i slutet av `createTextures()`, två anrop till `destroyTexture` i `cleanup()`, och binding 3 och 4:

```cpp
        std::array<VkDescriptorSetLayoutBinding, 5> bindings = {uboLayoutBinding, samplerLayoutBinding, samplerLayoutBinding, samplerLayoutBinding, samplerLayoutBinding};
        bindings[1].binding = 1; // planetDiffuseMap
        bindings[2].binding = 2; // ringsDiffuseMap
        bindings[3].binding = 3; // planetSpecularMap
        bindings[4].binding = 4; // ringsSpecularMap
```

Poolens antal combined image samplers blir 4, och `createDescriptorSets()` får fyra views, fyra image infos och fem
writes:

```cpp
        std::array<VkImageView, 4> textureViews = {planetDiffuseMap.view, ringsDiffuseMap.view, planetSpecularMap.view, ringsSpecularMap.view};
        std::array<VkDescriptorImageInfo, 4> imageInfos{};
        ...
        std::array<VkWriteDescriptorSet, 5> descriptorWrites{};
```

Ordningen på anropen till `stbi_load` är bindingarnas ordning: planetens diffuse, ringens diffuse, planetens specular,
ringens specular. Gör nu uppgiften **specular-maps**. Bilden ändras inte: shadern läser dem inte än.
:::

## Övningar

learnopengl avslutar kapitlet med en försmak: vi kan också vara lite mer kreativa och föra in ljusen från
ljuskapitlen i renderingsekvationen, och tillsammans med specular maps få fantastiska resultat. Det är det här
kapitlets sista uppgift: ljussätt modellen som i kapitlet *Lighting maps* – ett vitt punktljus vid `lightPos` (1.2,
1.0, 2.0) med ambient 0.2, diffuse 0.5 och specular 1.0 (ingen dämpning), Phong-skuggning med diffuse mapen som ytans
färg och specular mapen för högdagern, shininess 32, och kamerans position som `viewPos`. Vertex shadern måste skicka
vidare fragmentets världsposition och dess normal, transformerad med normalmatrisen. Försök själv först; koden kommer
här.

:::opengl
`main.cpp` får ljusets position som global variabel och sätter, efter `ourShader.use();`, kamerans position,
shininess och ljuset:

```cpp
// lighting
glm::vec3 lightPos(1.2f, 1.0f, 2.0f);
...
        ourShader.use();
        ourShader.setVec3("viewPos", cameraPos);
        ourShader.setFloat("shininess", 32.0f);

        // light properties: a white point light, no attenuation
        ourShader.setVec3("light.position", lightPos);
        ourShader.setVec3("light.ambient", 0.2f, 0.2f, 0.2f);
        ourShader.setVec3("light.diffuse", 0.5f, 0.5f, 0.5f);
        ourShader.setVec3("light.specular", 1.0f, 1.0f, 1.0f);
```

Shininess är en vanlig uniform den här gången, inte en del av en `Material`-struct: materialets färger kommer från
texturerna som `Mesh::Draw` binder. Vertex shadern skickar vidare världspositionen och normalen:

```glsl
out vec3 FragPos;
out vec3 Normal;
out vec2 TexCoords;
...
    FragPos = vec3(model * vec4(aPos, 1.0));
    Normal = mat3(transpose(inverse(model))) * aNormal;
    TexCoords = aTexCoords;
    gl_Position = projection * view * vec4(FragPos, 1.0);
```

och fragment shadern är *Lighting maps*-shadern med samplerna namngivna enligt modellens konvention:

```glsl
out vec4 FragColor;

struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

in vec3 FragPos;
in vec3 Normal;
in vec2 TexCoords;

uniform sampler2D texture_diffuse1;
uniform sampler2D texture_specular1;
uniform float shininess;
uniform vec3 viewPos;
uniform Light light;

void main()
{
    // ambient
    vec3 ambient = light.ambient * texture(texture_diffuse1, TexCoords).rgb;

    // diffuse
    vec3 norm = normalize(Normal);
    vec3 lightDir = normalize(light.position - FragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = light.diffuse * diff * texture(texture_diffuse1, TexCoords).rgb;

    // specular
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    vec3 specular = light.specular * spec * texture(texture_specular1, TexCoords).rgb;

    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
}
```

`Mesh::Draw` har satt `texture_specular1` hela tiden; tills nu deklarerade shadern den inte, så `glGetUniformLocation`
returnerade −1 och `glUniform1i` ignorerade tyst anropet. Nu hittar den uniformen, och specular mapen ligger på
texturenhet 1.
:::
:::vulkan
Uniform-blocket får kamerans position, materialets shininess och ljuset, upplagda enligt std140 som i *Lighting maps*
– en utfyllnads-float efter `viewPos` och efter varje `vec3` i ljuset, och materialet med sin enda float utfyllt till
16 byte:

```cpp
// lighting
glm::vec3 lightPos(1.2f, 1.0f, 2.0f);
...
// The same layout as the Material struct in the fragment shader (a struct in a uniform block takes a multiple of 16 bytes).
struct Material {
    float shininess;
    float pad1;
    float pad2;
    float pad3;
};

// learnopengl's Light: a position and the strength of each light component (a padding float after each vec3)
struct Light {
    glm::vec3 position;
    float pad1;

    glm::vec3 ambient;
    float pad2;
    glm::vec3 diffuse;
    float pad3;
    glm::vec3 specular;
    float pad4;
};

struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float pad1;
    Material material;
    Light light;
};
```

Fragment shadern läser nu uniform buffern, så dess bindings stage flags blir
`VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`, och `updateUniformBuffer()` fyller de nya medlemmarna:

```cpp
        ubo.viewPos = cameraPos;

        // material properties: the colours come from the textures
        ubo.material.shininess = 32.0f;

        // light properties
        ubo.light.position = lightPos;
        ubo.light.ambient  = glm::vec3(0.2f, 0.2f, 0.2f);
        ubo.light.diffuse  = glm::vec3(0.5f, 0.5f, 0.5f);
        ubo.light.specular = glm::vec3(1.0f, 1.0f, 1.0f);
```

Vertex shadern skickar vidare världspositionen och normalen:

```glsl
layout(location = 0) out vec3 fragPos;
layout(location = 1) out vec3 fragNormal;
layout(location = 2) out vec2 fragTexCoord;
...
void main() {
    // the lighting is calculated in world space: the fragment's position after the model matrix
    fragPos = vec3(pc.model * vec4(inPosition, 1.0));
    // the normal matrix: rotations and scaling of the model matrix without the translation (and right for non-uniform scaling)
    fragNormal = mat3(transpose(inverse(pc.model))) * inNormal;
    fragTexCoord = inTexCoord;
    fragMaterialIndex = inMaterialIndex;

    gl_Position = ubo.proj * ubo.view * vec4(fragPos, 1.0);
}
```

Fragment shadern deklarerar specular maps, structarna och uniform-blocket, samplar alla fyra kartor, väljer diffuse-
och specular-färgen efter materialet och beräknar Phong-ljussättning:

```glsl
layout(binding = 3) uniform sampler2D planetSpecularMap;
layout(binding = 4) uniform sampler2D ringsSpecularMap;

struct Material {
    float shininess;
};

struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    Material material;
    Light light;
} ubo;

layout(location = 0) in vec3 fragPos;
layout(location = 1) in vec3 fragNormal;
...
    // sample the textures of every material, then keep the ones of this fragment's material
    // (sampling outside an if keeps the texture's level of detail correct across the triangle's edges)
    vec3 planetDiffuse  = texture(planetDiffuseMap, fragTexCoord).rgb;
    vec3 ringsDiffuse   = texture(ringsDiffuseMap, fragTexCoord).rgb;
    vec3 planetSpecular = texture(planetSpecularMap, fragTexCoord).rgb;
    vec3 ringsSpecular  = texture(ringsSpecularMap, fragTexCoord).rgb;
    vec3 diffuseColor  = fragMaterialIndex == 0u ? planetDiffuse : ringsDiffuse;
    vec3 specularColor = fragMaterialIndex == 0u ? planetSpecular : ringsSpecular;

    // ambient
    vec3 ambient = ubo.light.ambient * diffuseColor;

    // diffuse
    vec3 norm = normalize(fragNormal);
    vec3 lightDir = normalize(ubo.light.position - fragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = ubo.light.diffuse * diff * diffuseColor;

    // specular
    vec3 viewDir = normalize(ubo.viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    vec3 specular = ubo.light.specular * spec * specularColor;

    vec3 result = ambient + diffuse + specular;
    outColor = vec4(result, 1.0);
```

Vertex shaderns uniform-block deklarerar fortfarande bara `view` och `proj`: den läser bara dem, och de medlemmar den
deklarerar ligger på samma offset som i fragment shaderns längre block.
:::
:::d3d12
Som i *Lighting maps* beräknas normalmatrisen på CPU:n – HLSL har ingen `inverse()` – och skickas med model-matrisen
som root constants; `ModelConstants` växer till två matriser, 32 root constants:

```cpp
    struct ModelConstants
    {
        XMFLOAT4X4 model;
        XMFLOAT4X4 normalMatrix;
    };
...
    // The normal matrix: the transpose of the inverse of the model matrix. It keeps the
    // normals perpendicular to the surface even when the model matrix scales unevenly.
    XMMATRIX normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixTranspose(normalMatrix));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
```

Constant buffern får kamerans position, materialets shininess och ljuset, packade som HLSL packar en cbuffer – en
utfyllnads-float efter `viewPos` och efter varje `XMFLOAT3` i ljuset, och materialet med sin enda float utfyllt till en
hel rad på 16 byte:

```cpp
// lighting
XMFLOAT3 lightPos = XMFLOAT3(1.2f, 1.0f, 2.0f);
...
    struct Material
    {
        float shininess;
        float padding0[3];
    };

    // The light: what the shaders see as struct Light.
    struct Light
    {
        XMFLOAT3 position;
        float padding0;
        XMFLOAT3 ambient;
        float padding1;
        XMFLOAT3 diffuse;
        float padding2;
        XMFLOAT3 specular;
        float padding3;
    };

    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 viewPos;
        float padding0;
        Material material;
        Light light;
    };
```

`OnUpdate` fyller dem:

```cpp
    constantBufferData.light.position = lightPos;
    XMStoreFloat3(&constantBufferData.viewPos, cameraPos);    // the camera's position

    // light properties
    constantBufferData.light.ambient = XMFLOAT3(0.2f, 0.2f, 0.2f);
    constantBufferData.light.diffuse = XMFLOAT3(0.5f, 0.5f, 0.5f);
    constantBufferData.light.specular = XMFLOAT3(1.0f, 1.0f, 1.0f);

    // material properties
    constantBufferData.material.shininess = 32.0f;
```

I `model_loading.hlsl` får `cbuffer ModelConstants` raden `float4x4 normalMatrix;`, structarna och de nya medlemmarna
hamnar i `cbuffer SceneConstantBuffer`, och specular mapen är den andra texturen i meshens tabell:

```hlsl
struct Material
{
    float shininess;
};

struct Light
{
    float3 position;
    float3 ambient;
    float3 diffuse;
    float3 specular;
};

cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPos;
    Material material;
    Light light;
};

Texture2D texture_diffuse1 : register(t0);
Texture2D texture_specular1 : register(t1);    // the specular map: t1
```

Vertex shadern lämnar vidare världspositionen och normalen:

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoords : TEXCOORD;
};
...
    // The position in world space (only the model matrix applied), for the lighting.
    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    result.texCoords = texCoords;
    result.position = mul(mul(worldPos, view), projection);
```

och pixel shadern beräknar Phong-ljussättning med båda kartorna:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 diffuseColor = texture_diffuse1.Sample(wrapSampler, input.texCoords).rgb;

    // ambient
    float3 ambient = light.ambient * diffuseColor;

    // diffuse
    float3 norm = normalize(input.normal);
    float3 lightDir = normalize(light.position - input.fragPos);
    float diff = max(dot(norm, lightDir), 0.0f);
    float3 diffuse = light.diffuse * diff * diffuseColor;

    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    float3 specular = light.specular * spec * texture_specular1.Sample(wrapSampler, input.texCoords).rgb;

    float3 result = ambient + diffuse + specular;
    return float4(result, 1.0f);
}
```

`SetupMesh` har lagt varje meshs specular map på dess andra plats i heapen hela tiden, och tabellen i root-parameter 2
täcker redan två SRV:er: bara shadern behövde börja läsa `t1`.
:::

Gör nu uppgiften **lighting** och bygg och kör sedan. Planeten lyses upp snett uppifrån höger framifrån, där ljuset är:
sidan som vetter mot det är ljusast, nedre vänstra delen får bara det ambienta ljuset, och hela bilden är mörkare än
förut (högst 0.2 + 0.5 av texturens färg, plus högdagern). Ringen, en platt skiva, lyses upp jämnt.

Och högdagern? Med den här kameran hamnar ljusets reflex lite till höger om och ovanför planetens mitt – på land.
Planetens specular map är mörk på land och ljus på haven (vattnet glänser, marken knappt), så högdagern är bara en
svag, mjuk fläck. Flytta kameran med A och D eller musen tills högdagern hamnar på ett hav, så blir den en liten ljus
fläck.

```quiz
När ljussättningen är klar är högdagern vid ljusets reflex bara en svag fläck. Varför?
- [x] Reflexen hamnar på land, där planetens specular map är mörk; på ett hav, där kartan är ljus, är samma högdager stark
- [ ] Shininess 32 är för lågt för en synlig högdager
- [ ] Spekulär ljussättning fungerar inte på en modell som lästs in från en fil
- [ ] Ljuset har ingen spekulär komponent
---
Den spekulära termen multipliceras med specular mapens färg i det fragmentet. Flytta kameran så att reflexen hamnar på vatten, så lyser högdagern upp.
```

Visserligen är det här lite flashigare än lådorna vi har använt hittills. Med en modellinläsare kan du läsa in massor
av modeller som finns på internet: det finns en hel del webbplatser med gratis 3D-modeller i flera filformat. Tänk
dock på att vissa modeller ändå inte läses in ordentligt, har texturvägar som inte fungerar eller helt enkelt är
exporterade i ett format som din inläsare inte kan läsa.

## Läs mer

- [learnopengl.com: Model](https://learnopengl.com/Model-Loading/Model): originalkapitlet, med sin ryggsäcksmodell.
- [learnopengls model.h](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/includes/learnopengl/model.h): hela
  klassen `Model` som det här kapitlet följer.
:::vulkan
- [vulkan-tutorial.com: Loading models](https://vulkan-tutorial.com/Loading_models): tinyobjloader och
  vertex-deduplicering, med en modell med ett enda material.
:::
:::d3d12
- [Uploading texture data through buffers](https://learn.microsoft.com/en-us/windows/win32/direct3d12/upload-and-readback-of-texture-data):
  varför en texturs pixlar går via en upload-buffer, och hur länge den måste leva.
:::
