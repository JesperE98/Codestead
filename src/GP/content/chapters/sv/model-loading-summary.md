# Sammanfattning: Modellinläsning

Grattis, du har nått slutet av delen *Modellinläsning*. Du började med ett tomt fönster och en modellfil, och slutade
med en planet och dess ring inlästa från `planet.obj` – två meshar, två material, fyra texturer – ritade med texturer
och upplysta av dina egna shaders. Från och med nu behöver formerna du ritar inte längre skrivas in i arrayer: en
grafiker kan göra dem. Den här sidan är en ordlista över delens viktigaste begrepp, kapitel för kapitel, som den
genomgång learnopengl.com har i slutet av sina delar. Använd den för att slå upp saker, och som en kontroll: om en
definition överraskar dig, gå tillbaka till kapitlet den kommer från.

Begreppen utanför rutorna är desamma i alla API:er: en modellfil, dess meshar och dess material beror inte på vilket
API som ritar dem. Rutorna visar hur {{api}} läser in och ritar dem. När du är klar kontrollerar provet i slutet av
delen vad du har lärt dig.

## Assimp

- **Modell**: ett 3D-objekt som en grafiker har gjort i ett modelleringsverktyg och exporterat till en fil, med allt
  som behövs för att rita det: vertexpositioner, normaler, texturkoordinater, hur vertices bildar ytor, och
  materialen.
- **Filformat för modeller**: Wavefront `.obj`, FBX, glTF, Collada och många fler. Vart och ett lagrar samma sorts
  data på sitt eget sätt.
- **OBJ och MTL**: vår modells format. `planet.obj` listar positioner (`v`), texturkoordinater (`vt`), normaler (`vn`)
  och ytor (`f`), där varje hörn i en yta har egna index in i de tre listorna; `o` inleder ett objekt, `usemtl` väljer
  ett material och `mtllib planet.mtl` namnger materialfilen. I `planet.mtl` inleder `newmtl` ett material, `map_Kd`
  namnger dess diffuse map och `map_Ks` dess specular map.
- **Assimp** (Open Asset Import Library): ett bibliotek som läser in dussintals modellformat till en och samma
  datastruktur, så att programmet bara behöver ett sätt att bearbeta en modell.
- **Scen** (`aiScene`): roten i Assimps data. Den äger alla meshar (`mMeshes`) och alla material (`mMaterials`), och
  har **rotnoden** (`mRootNode`).
- **Nod** (`aiNode`): en del av scenens hierarki. Den har **indexen** till sina meshar i scenens `mMeshes` (inte
  själva mesharna) och sina barn (`mChildren`), och bevarar så förälder–barn-relationer mellan modellens delar.
- **Mesh** (`aiMesh`): vertexdatan för en del av modellen – `mVertices` (positionerna), `mNormals`, `mTextureCoords` –
  plus dess **ytor** och indexet till dess **material** (`mMaterialIndex`).
- **Yta** (`aiFace`): en primitiv i en mesh, med indexen till dess vertices (`mIndices`); efter triangulering alltid
  tre.
- **Material** (`aiMaterial`): en meshs yta: bland annat filnamnen på dess texturer, per texturtyp
  (`aiTextureType_DIFFUSE`, `aiTextureType_SPECULAR`, …).

:::opengl
- **Att bygga med Assimp**: Assimp är ett kompilerat bibliotek, inte en enda headerfil. Programmet inkluderar
  `<assimp/Importer.hpp>`, `<assimp/scene.h>` och `<assimp/postprocess.h>` och länkas med `-lassimp`.
:::
:::vulkan
- **tinyobjloader**: den lilla header-only OBJ-inläsaren som vulkan-tutorial.com använder, och den här delens
  Vulkan-program. `#define TINYOBJLOADER_IMPLEMENTATION` i en källfil kompilerar dess kod. Assimp skulle fungera lika
  bra; för ett enda format räcker det lilla biblioteket.
- **`tinyobj::LoadObj`**: läser `.obj`-filen (och `.mtl`-filen från katalogen som ges som sista argument) till
  `attrib` (alla positioner, normaler och texturkoordinater som platta `float`-arrayer), `shapes` (objekten, vart och
  ett med sina ytor som `tinyobj::index_t` och ett materialnummer per yta i `mesh.material_ids`) och `materials` (i
  `.mtl`-filens ordning). Den triangulerar ytor som standard.
- **`tinyobj::index_t`**: ett hörn i en yta: tre separata index, `vertex_index`, `normal_index` och `texcoord_index`.
:::
:::d3d12
- **Att bygga med Assimp**: Assimp är ett kompilerat bibliotek, inte en enda headerfil. Programmet inkluderar
  `<assimp/Importer.hpp>`, `<assimp/scene.h>` och `<assimp/postprocess.h>`; dess include-katalog och bibliotek läggs
  till i projektet, till exempel med vcpkg (`vcpkg install assimp`).
:::

## Mesh

- **Mesh**: den minsta enhet som ritas med en uppsättning texturer: dess vertices, dess index och dess texturer.
  Ringen behöver andra texturer än planeten, så den är en egen mesh.
- **Vertex-struct**: allt som en vertex i en modell har – position, normal, texturkoordinater – i en struct.
  Medlemmarna i en struct ligger efter varandra i minnet, så en array av `Vertex` är exakt den sammanflätade vertex
  buffer som GPU:n läser, och `offsetof` ger varje attributs byte-offset.
- **Texture-struct**: en textur i meshen, dess **typ** (`"texture_diffuse"`, `"texture_specular"`) och **sökvägen** den
  lästes in från.
- **Namnkonvention**: shadern namnger meshens texturer efter typ och nummer – `texture_diffuse1`,
  `texture_specular1`, … – så att koden som binder dem vet vilken textur som ska vart.
- **32-bitars index**: en modell kan ha fler än 65 536 vertices, så indexen är 32-bitars heltal utan tecken.

:::opengl
- **Klassen `Mesh`**: `vertices`, `indices`, `textures` och `VAO`; konstruktorn sparar datan och anropar
  `setupMesh()`.
- **`setupMesh()`**: skapar VAO, VBO och EBO, laddar upp vertices och index med `glBufferData`, och sätter de tre
  attributpekarna med stride `sizeof(Vertex)` och offseten `0`, `offsetof(Vertex, Normal)` och
  `offsetof(Vertex, TexCoords)`.
- **`Draw(Shader &shader)`**: binder varje textur till en egen texturenhet (`glActiveTexture(GL_TEXTURE0 + i)`), pekar
  samplern som namnges enligt konventionen på den enheten (`glUniform1i(glGetUniformLocation(shader.ID, (name +
  number).c_str()), i)`) och ritar med `glDrawElements(GL_TRIANGLES, …, GL_UNSIGNED_INT, 0)`.
:::
:::vulkan
- **Ingen klass `Mesh`**: meshens data finns i applikationsklassen: `std::vector<Vertex> vertices` och
  `std::vector<uint32_t> indices`, en vertex buffer och en index buffer.
- **`Vertex`**: `pos`, `normal`, `texCoord` och `materialIndex`, fyra attributbeskrivningar; materialindexet är ett
  heltalsattribut, `VK_FORMAT_R32_UINT`, en `uint` i shadern.
- **`operator==` och `std::hash<Vertex>`**: gör vertices jämförbara och hashbara, så att de kan vara nycklar i en
  `std::unordered_map` (glm:s hashfunktioner kräver `GLM_ENABLE_EXPERIMENTAL` och `<glm/gtx/hash.hpp>`).
- **Staging buffers**: vertices och index kopieras till staging buffers som CPU:n kan skriva i, och därifrån med
  `vkCmdCopyBuffer` till **device-lokala** vertex- och indexbuffrar, det minne som GPU:n läser snabbast.
- **Testmesh**: Vulkan kan inte skapa en buffer med storleken 0, så kapitlet *Mesh* ritade en testkvadrat innan någon
  modell hade lästs in.
- **Indexerad ritning**: `vkCmdBindIndexBuffer(…, VK_INDEX_TYPE_UINT32)` och `vkCmdDrawIndexed`.
:::
:::d3d12
- **Klassen `Mesh`**: `vertices`, `indices`, `textures`, dess vertex- och indexbuffrar och deras views; konstruktorn
  tar också emot devicen och meshens två platser i CBV/SRV-heapen, och anropar `SetupMesh`.
- **`SetupMesh`**: skapar vertex- och indexbuffrarna i upload heaps, kopierar in datan, fyller
  `D3D12_VERTEX_BUFFER_VIEW` (`StrideInBytes = sizeof(Vertex)`) och `D3D12_INDEX_BUFFER_VIEW` (`DXGI_FORMAT_R32_UINT`),
  och skapar meshens två SRV:er. Input layouten (POSITION 0, NORMAL 12, TEXCOORD 24) stämmer med `Vertex`.
- **En descriptor table per mesh**: varje mesh äger två på varandra följande SRV:er – sin första diffuse-textur (`t0`,
  `texture_diffuse1`) och sin första specular-textur (`t1`, `texture_specular1`). En saknad textur får en **null-SRV**,
  som läses som noll.
- **`Draw`**: `SetGraphicsRootDescriptorTable(2, m_srvHandle)` för meshens texturer, sedan `IASetVertexBuffers`,
  `IASetIndexBuffer` och `DrawIndexedInstanced`.
:::

## Modell

- **Efterbearbetningsflaggor**: alternativ som får inläsaren att ändra datan under importen: `aiProcess_Triangulate`
  (varje yta blir trianglar), `aiProcess_GenSmoothNormals` (normaler åt modeller som saknar dem), `aiProcess_FlipUVs`
  (v blir 1 − v), `aiProcess_CalcTangentSpace` (tangenter för normal mapping, senare),
  `aiProcess_JoinIdenticalVertices` (delade vertices i stället för en per ythörn).
- **Rekursiv nodbearbetning**: `processNode` gör om nodens meshar till `Mesh`-objekt och anropar sedan sig själv för
  varje barn. Att gå igenom trädet i stället för att loopa över alla meshar håller förälder–barn-relationerna
  tillgängliga.
- **Meshbearbetning**: kopiera varje vertex position, normal och första uppsättning texturkoordinater, sedan varje
  ytas index, och läs sedan in materialets texturer.
- **Texturvägar**: ett material namnger sina texturer relativt modellfilen, så inläsaren sätter modellens katalog
  framför: `planet_diffuse.png` blir `models/planet_diffuse.png`.
- **Texturcache** (`textures_loaded`): en textur som redan är inläst – samma sökväg – återanvänds i stället för att
  läsas in igen.
- **Texturens orientering**: OBJ räknar v från bildens nederkant, stb_image levererar den översta raden först. Exakt
  **en** vändning – av koordinaterna eller av bilden – gör modellen upprätt; två vändningar tar ut varandra.
- **Att ljussätta en modell**: samma Phong-ljussättning som i *Lighting maps*, med diffuse och specular map för varje
  fragments material. Vår planets specular map är ljus på haven och mörk på land, så högdagern lyser bara där den
  hamnar på vatten.

:::opengl
- **Klassen `Model`**: `meshes`, `directory` och `textures_loaded`; konstruktorn anropar `loadModel(path)`, och
  `Draw(shader)` anropar varje meshs `Draw`.
- **`Model ourModel("models/planet.obj");`**: läses in en gång, före renderingsloopen; `ourModel.Draw(ourShader);`
  efter att model-matrisen har satts.
- **`TextureFromFile`**: ljuskapitlens `loadTexture` med katalogen före filnamnet.
- **En vändning**: `aiProcess_FlipUVs` och **ingen** `stbi_set_flip_vertically_on_load(true)` – learnopengls
  `model_loading.cpp` gör båda, vilket bara passar dess ryggsäck.
- **Oanvända samplers**: `Mesh::Draw` sätter `texture_specular1` även när shadern inte deklarerar den;
  `glGetUniformLocation` returnerar −1 och `glUniform1i` ignorerar anropet.
:::
:::vulkan
- **`loadModel()`**: en loop över alla shapes och index bygger en `Vertex` per index – positionen och normalen slås upp
  med `3 * index.vertex_index + …`, texturkoordinaten med vänt v (`1.0f - …`), och ytans material,
  `shape.mesh.material_ids[i / 3]`.
- **Vertex-deduplicering**: `std::unordered_map<Vertex, uint32_t> uniqueVertices` sparar varje olik vertex en gång;
  `planet.obj`:s 3168 index använder 657 vertices.
- **Materialens texturer**: läses in från konstanter i bindingordning av `createTextures()`; var och en är en
  `Texture` (bild, minne, view) och en combined image sampler på binding 1–4 (binding 0 är uniform buffern).
- **Ett draw-anrop**: hela modellen är ett `vkCmdDrawIndexed`. Vertex shadern skickar vidare materialindexet som en
  **`flat`** utdata (heltal kan inte interpoleras); fragment shadern samplar varje materials textur och behåller den
  som hör till fragmentets material – att sampla utanför en `if` håller detaljnivån rätt.
:::
:::d3d12
- **Klassen `Model`**: `meshes`, `directory`, `textures_loaded` och `uploadHeaps`; `Load(path, device, commandList,
  srvHeap, firstDescriptor)` gör det som learnopengls konstruktor gör, och `Draw(commandList)` anropar varje meshs
  `Draw`.
- **Inläsning**: i `LoadAssets`, medan command listen är öppen: `m_model.Load("models/planet.obj", …, 1)` – heapens
  plats 0 är CBV:n, så meshernas SRV:er börjar på plats 1. Heapen har `1 + 2 * MaxMeshes` descriptors.
- **`TextureFromFile`**: det tidigare `LoadTexture` utan view; den *spelar in* kopieringen från en upload-buffer.
- **Upload-buffrar**: de måste leva tills command listen har körts – `m_model.uploadHeaps.clear()` kommer efter
  `WaitForPreviousFrame()`.
- **En vändning**: `aiProcess_FlipUVs`, och stb_image utan vändning: Direct3D:s v = 0 är bildens översta rad.
:::

## Samma idé i tre API:er

| Idé | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Modellinläsare | Assimp | tinyobjloader | Assimp |
| En mesh på GPU:n | VAO, VBO och EBO per `Mesh` | en vertex- och en indexbuffer för hela modellen, device-lokala | vertex- och indexbuffer per `Mesh`, upload heaps |
| Indextyp | `GL_UNSIGNED_INT` | `VK_INDEX_TYPE_UINT32` | `DXGI_FORMAT_R32_UINT` |
| Draw-anrop | ett `glDrawElements` per mesh | ett `vkCmdDrawIndexed` | ett `DrawIndexedInstanced` per mesh |
| En meshs texturer | texturenheter, samplers `texture_diffuseN` … | combined image samplers, binding 1–4, valda med materialindexet | två SRV:er per mesh (`t0`, `t1`), tabellen i root-parameter 2 |
| Vända v en gång | `aiProcess_FlipUVs` | `1.0f - v` i `loadModel()` | `aiProcess_FlipUVs` |
| Läsa in en fil en gång | `textures_loaded` | en konstant per fil | `textures_loaded` |

Med modellinläsningen klar kan scenerna du ritar vara lika detaljerade som modellerna du hittar – nästa delar av
learnopengl.com bygger på precis det här.
