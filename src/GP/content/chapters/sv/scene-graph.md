# Scengraf

Hittills har varje objekt i en scen haft en egen modellmatris, beräknad från grunden varje bildruta: flytta hit, rotera
dit, skala. Det går bra för några lådor. Det slutar gå bra så fort objekten hör ihop. En måne kretsar kring en planet
som kretsar kring en sol; ett hjul snurrar på en bil som kör längs en väg; ett svärd sitter i en hand längst ut på en arm
som svänger från en axel. Du vill beskriva månen *i förhållande till sin planet* – "3.5 enheter åt sidan, lite mindre" –
och låta den följa med planeten vart den än tar vägen, utan att räkna ut dess position i världen för hand. Strukturen som
gör det är en *scengraf*: ett träd av objekt där varje objekts transform är relativ till förälderns.

Det här kapitlet följer learnopengls gästartikel *Scene Graph*, den första av två om att organisera en scen; den andra,
*Frustum culling*, använder grafen för att hoppa över objekt som kameran inte ser. Inget i kapitlet är knutet till ett
API: en scengraf är kod på CPU:n som slutar i en modellmatris per objekt, och API:et tar bara emot de matriserna. Vad
{{api}} gör med dem är detsamma som i delen *Modellinläsning*.

## Lokalt och globalt rum

Varje objekt i grafen – en *entitet* – lagrar sin transform i **lokalt rum**: sin position, rotation och skala i
förhållande till sin förälder. Det shadern behöver är dess transform i **globalt rum** (världsrummet): modellmatrisen som
tar objektets vertexar hela vägen ut i världen. De två hänger ihop genom en enda regel:

```text
global(child) = global(parent) · local(child)
```

Barnets lokala matris tar dess vertexar in i förälderns rum; förälderns globala matris tar dem därifrån ut i världen. För
trädets rot, som saknar förälder, är den globala matrisen den lokala (dess "förälder" är enhetsmatrisen). För varje nivå
nedåt i trädet multipliceras ytterligare en lokal matris på från höger.

Eftersom förälderns globala matris innehåller dess *skala* och *rotation* följer de med till allt under den. Det är
precis vad vi vill ha för en måne: om planeten skalas till halva storleken hamnar en måne 3.5 enheter bort i planetens
rum 1.75 enheter bort i världen, och blir dessutom hälften så stor; om planeten vrider sig svänger månen runt med den.

Projektets scen är en kedja av planeter – kursens planet med ringar, från delen *Modellinläsning* (learnopengl använder
en egen planetmodell). Roten är planeten i origo, med skala 1. Den har ett barn i den lokala positionen (3.5, 0, 0) med
den lokala skalan 0.6; det barnet har i sin tur ett barn med samma lokala transform, och så vidare, tio barn djupt.
learnopengls demo använder (10, 0, 0) och 0.75 för sin större modell.

```quiz
Roten ligger i origo med skala 1. Dess barn ligger i den lokala positionen (3.5, 0, 0) med den lokala skalan 0.6, och barnets barn har samma lokala transform. Var ligger det andra barnet i världsrummet?
- [ ] I x = 7.0: 3.5 + 3.5
- [x] I x = 5.6: 3.5 + 0.6 · 3.5, eftersom det första barnets skala även skalar dess barns lokala förskjutning
- [ ] I x = 3.5: alla barn ligger i (3.5, 0, 0)
- [ ] I x = 2.1: 3.5 · 0.6
---
global(barn 2) = global(barn 1) · local(barn 2). Det första barnets globala matris flyttar 3.5 och skalar med 0.6, så det andra barnets förskjutning på 3.5 blir 2.1 i världen, och det hamnar i 3.5 + 2.1 = 5.6. De följande ligger i 6.86, 7.62, 8.07, … – var och en 0.6 gånger närmare och mindre.
```

## Projektet

Projektet är programmet från delen *Modellinläsning*, nedbantat till learnopengls `1.model_loading`-shaders: den diffusa
texturen utan belysning. Det läser in planeten en gång och ritar den en gång i origo. Kameran står i (3, 6, 12) och
tittar nedåt 25° (pitch -25) så att kedjan av planeter får plats i fönstret; learnopengls demo har kameran i (0, 0, 3)
för sin modell. Bakgrunden är mörkgrå (0.05, 0.05, 0.05).

learnopengl skriver `Transform` och `Entity` som klasser med medlemsfunktioner; dess `Entity` ärver till och med från
`Model` och håller sina barn i en `std::list<std::unique_ptr<Entity>>` med en pekare tillbaka till föräldern. Som i delen
*I praktiken* skriver kursen dem som **vanliga structs med fria funktioner** i en enda `main.cpp`, med learnopengls namn:
`computeModelMatrix(transform, …)` i stället för `transform.computeModelMatrix(…)`. Stegen och matematiken är
learnopengls; ett riktigt projekt skulle behålla klasserna i egna filer.

:::opengl
Starten ritar planeten med enhetsmatrisen som modellmatris:

```cpp
        // draw the model once, at the origin
        glm::mat4 model = glm::mat4(1.0f);
        ourShader.setMat4("model", model);
        ourModel.Draw(ourShader);
```

`Model` och `Mesh` är klasserna från delen *Modellinläsning* (`model.h`, `mesh.h`), oförändrade: `ourModel.Draw(ourShader)`
ritar planetens två meshar, klotet och ringarna, var och en med sin textur.
:::
:::vulkan
Starten ritar planeten med enhetsmatrisen som modellmatris, en push constant (`struct PushConstants { glm::mat4 model; }`)
som i delen *Modellinläsning*. Starten har också learnopengls `Model` i Vulkan-form – det som en entitet kommer att peka
på. learnopengls `Model` håller meshar med sina VAO:er och ritar sig själv med `Model::Draw(shader)`; här är den en
struct med de buffrar programmet läste in från `models/planet.obj` och en fri funktion som spelar in ritningen:

```cpp
struct Model {
    VkBuffer vertexBuffer = VK_NULL_HANDLE;
    VkBuffer indexBuffer = VK_NULL_HANDLE;
    uint32_t indexCount = 0;
};

// record the draw of a model (learnopengl: Model::Draw): bind its buffers, draw its triangles
void Draw(const Model& model, VkCommandBuffer commandBuffer) {
    VkBuffer vertexBuffers[] = {model.vertexBuffer};
    VkDeviceSize offsets[] = {0};
    vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);

    // the indices are uint32_t: a model can have more than 65536 vertices
    vkCmdBindIndexBuffer(commandBuffer, model.indexBuffer, 0, VK_INDEX_TYPE_UINT32);

    vkCmdDrawIndexed(commandBuffer, model.indexCount, 1, 0, 0, 0);
}
```

Planetens två material (klotet och ringarna) väljs i shaderna utifrån varje vertex materialindex, så ett enda indexerat
draw-anrop täcker båda. Descriptor setet – uniform buffern med vy och projektion, och de två diffusa texturerna – är
detsamma för alla planeter och binds en gång före ritningen.
:::
:::d3d12
Starten ritar planeten med enhetsmatrisen som modellmatris, i root constants (root-parameter 0) som i delen
*Modellinläsning*. `Mesh` och `Model` är klasserna från kapitlet `model`, oförändrade: `m_model.Draw(commandList)` ritar
planetens två meshar, klotet och ringarna, där var och en binder sin egen textur.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Bygg och kör programmet i din IDE: en planet med ringar
till vänster i fönstret.

## Transform

Den första byggstenen är transformen: den lokala positionen, rotationen och skalan, och den globala modellmatris som
räknas ut ur dem. learnopengl lagrar rotationen som tre *Eulervinklar* i grader – kring x, y och z – och bygger
rotationsmatrisen av tre rotationer kring axlarna, utförda i ordningen z, x, y (matrisprodukten Y · X · Z: matrisen
närmast vertexen verkar först). Den lokala matrisen är den vanliga translation · rotation · skala, ofta kallad en
*TRS*-matris: skala objektet kring dess eget origo, rotera det kring dess eget origo, och flytta det sedan på plats.

:::opengl
```cpp
struct Transform
{
    // local space information
    glm::vec3 pos = { 0.0f, 0.0f, 0.0f };
    glm::vec3 eulerRot = { 0.0f, 0.0f, 0.0f }; // in degrees
    glm::vec3 scale = { 1.0f, 1.0f, 1.0f };

    // global space information concatenated in a matrix
    glm::mat4 modelMatrix = glm::mat4(1.0f);
};

// the local model matrix: translation * rotation * scale (also known as a TRS matrix)
glm::mat4 getLocalModelMatrix(const Transform& transform)
{
    const glm::mat4 transformX = glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.x), glm::vec3(1.0f, 0.0f, 0.0f));
    const glm::mat4 transformY = glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.y), glm::vec3(0.0f, 1.0f, 0.0f));
    const glm::mat4 transformZ = glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.z), glm::vec3(0.0f, 0.0f, 1.0f));

    // Y * X * Z
    const glm::mat4 rotationMatrix = transformY * transformX * transformZ;

    // translation * rotation * scale (also known as TRS matrix)
    return glm::translate(glm::mat4(1.0f), transform.pos) * rotationMatrix * glm::scale(glm::mat4(1.0f), transform.scale);
}

// the model matrix in world space: the parent's model matrix * the local one (the root's parent matrix is the identity)
void computeModelMatrix(Transform& transform, const glm::mat4& parentGlobalModelMatrix)
{
    transform.modelMatrix = parentGlobalModelMatrix * getLocalModelMatrix(transform);
}
```

De tre set-funktionerna lagrar bara det nya värdet tills vidare – `setLocalPosition(Transform& transform, const
glm::vec3& newPosition)` sätter `transform.pos`, och `setLocalRotation` och `setLocalScale` på samma sätt. De får en
uppgift till i dirty-flag-uppgiften. I renderingsloopen kommer planetens modellmatris nu från en transform:

```cpp
        Transform planetTransform;
        computeModelMatrix(planetTransform, glm::mat4(1.0f));
        ourShader.setMat4("model", planetTransform.modelMatrix);
```

```quiz
Vilken transformation verkar först på en vertex i `getLocalModelMatrix`?
- [ ] Translationen till `pos`
- [ ] Rotationen kring y
- [ ] Rotationen kring z
- [x] Skalningen
---
Med kolumnvektorer (`M · v`) verkar den matris som står närmast vertexen först: translation · rotation · skala skalar först, roterar sedan (z, sedan x, sedan y) och flyttar till sist objektet på plats. Skalning efter translationen skulle även skala förskjutningen.
```
:::
:::vulkan
```cpp
struct Transform {
    // local space information
    glm::vec3 pos = { 0.0f, 0.0f, 0.0f };
    glm::vec3 eulerRot = { 0.0f, 0.0f, 0.0f }; // in degrees
    glm::vec3 scale = { 1.0f, 1.0f, 1.0f };

    // global space information concatenated in a matrix
    glm::mat4 modelMatrix = glm::mat4(1.0f);
};
```

`getLocalModelMatrix` och `computeModelMatrix` är learnopengls GLM-kod, oförändrad – GLM känner sig lika hemma i ett
Vulkan-program som i ett OpenGL-program:

```cpp
    // Y * X * Z
    const glm::mat4 rotationMatrix = transformY * transformX * transformZ;

    // translation * rotation * scale (also known as TRS matrix)
    return glm::translate(glm::mat4(1.0f), transform.pos) * rotationMatrix * glm::scale(glm::mat4(1.0f), transform.scale);
```

med `transformX` = `glm::rotate(glm::mat4(1.0f), glm::radians(transform.eulerRot.x), glm::vec3(1.0f, 0.0f, 0.0f))` och
motsvarande för y och z, och `transform.modelMatrix = parentGlobalModelMatrix * getLocalModelMatrix(transform);`. De tre
set-funktionerna lagrar bara det nya värdet tills vidare. I `recordCommandBuffer()` kommer push constanten nu från en
transform: `Transform planetTransform; computeModelMatrix(planetTransform, glm::mat4(1.0f)); constants.model =
planetTransform.modelMatrix;`.

```quiz
Vilken transformation verkar först på en vertex i `getLocalModelMatrix`?
- [ ] Translationen till `pos`
- [ ] Rotationen kring y
- [ ] Rotationen kring z
- [x] Skalningen
---
Med kolumnvektorer (`M · v`) verkar den matris som står närmast vertexen först: translation · rotation · skala skalar först, roterar sedan (z, sedan x, sedan y) och flyttar till sist objektet på plats. Skalning efter translationen skulle även skala förskjutningen.
```
:::
:::d3d12
Structen lagrar DirectXMaths lagringstyper – `XMFLOAT3` för vektorerna och `XMFLOAT4X4` för matrisen – och funktionerna
räknar med `XMMATRIX`, som överallt i kursen. Matematiken är learnopengls, med en sak att se upp med: DirectXMath arbetar
med **radvektorer** (`v · M`), så en produkt av matriser verkar från vänster till höger, tvärtemot GLM:s kolumnvektorer.
Samma transformationer skrivs därför i omvänd ordning:

```cpp
XMMATRIX getLocalModelMatrix(const Transform& transform)
{
    const XMMATRIX transformX = XMMatrixRotationX(XMConvertToRadians(transform.eulerRot.x));
    const XMMATRIX transformY = XMMatrixRotationY(XMConvertToRadians(transform.eulerRot.y));
    const XMMATRIX transformZ = XMMatrixRotationZ(XMConvertToRadians(transform.eulerRot.z));

    // learnopengl's Y * X * Z: with DirectXMath's row vectors the matrices apply from left to
    // right, so the same rotation is Z * X * Y
    const XMMATRIX rotationMatrix = transformZ * transformX * transformY;

    // translation * rotation * scale (also known as TRS matrix) - here scale * rotation * translation
    return XMMatrixScaling(transform.scale.x, transform.scale.y, transform.scale.z) * rotationMatrix * XMMatrixTranslation(transform.pos.x, transform.pos.y, transform.pos.z);
}
```

och föräldern kommer sist: `global = local · parent`.

```cpp
void computeModelMatrix(Transform& transform, const XMMATRIX& parentGlobalModelMatrix)
{
    XMStoreFloat4x4(&transform.modelMatrix, getLocalModelMatrix(transform) * parentGlobalModelMatrix);
}
```

`XMMatrixRotationX/Y/Z` vrider åt samma håll kring axlarna som `glm::rotate`, så vinklarna betyder samma sak i båda. De
tre set-funktionerna lagrar bara det nya värdet tills vidare. I `PopulateCommandList` kommer planetens modellmatris nu från
en transform: `Transform planetTransform; computeModelMatrix(planetTransform, XMMatrixIdentity());`, transponerad för
HLSL in i root constants som förut.

```quiz
Varför räknar DirectX 12-versionen ut `getLocalModelMatrix(transform) * parentGlobalModelMatrix` när learnopengl skriver `parent * local`?
- [x] DirectXMath använder radvektorer (`v · M`), så den matris som ska verka först – den lokala – står till vänster; det är samma transformation
- [ ] För att Direct3D:s y-axel pekar nedåt
- [ ] För att HLSL behöver matrisen transponerad
- [ ] För att Direct3D:s djupintervall är 0..1
---
Med radvektorer skrivs varje produkt i omvänd ordning: skala · rotation · translation för den lokala matrisen, och local · parent för den globala. Transponeringen för HLSL är en separat fråga om hur matrisen lagras i konstanterna.
```
:::

Gör nu den första uppgiften, **transform**. En standardtransform är enhetsmatrisen, så bilden ändras inte.

## Entiteten

En entitet är en nod i trädet: en transform, modellen den ritar, och dess barn. learnopengls `Entity` håller sina barn i
en `std::list<std::unique_ptr<Entity>>` och en vanlig `parent`-pekare, och dess uppdatering läser förälderns matris via
den pekaren. Kursens struct lagrar barnen **som värden** i en `std::vector` och har ingen föräldrapekare: i stället får
varje rekursiv funktion förälderns globala matris som parameter, vilket är allt den någonsin behövde från föräldern.
Roten får enhetsmatrisen.

:::opengl
```cpp
struct Entity
{
    // scene graph
    std::vector<Entity> children;

    // space information
    Transform transform;

    Model* pModel = nullptr;
};

// add a child that draws the given model
void addChild(Entity& parent, Model& model)
{
    Entity child;
    child.pModel = &model;
    parent.children.push_back(child);
}
```

(En `std::vector` av den struct som innehåller den är tillåten sedan C++17: vektorn kräver bara att elementtypen är
komplett när den används, inte när den deklareras.) Att uppdatera grafen innebär att gå igenom den från roten, räkna ut
varje entitets globala matris ur förälderns och skicka den egna vidare till barnen:

```cpp
void updateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix)
{
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children)
    {
        updateSelfAndChild(child, entity.transform.modelMatrix);
    }
}
```

Ritningen går igenom den på samma sätt: sätt entitetens modellmatris, rita dess modell, sedan dess barn.

```cpp
// draw an entity and all of its children
void drawSelfAndChild(Entity& entity, Shader& ourShader)
{
    ourShader.setMat4("model", entity.transform.modelMatrix);
    entity.pModel->Draw(ourShader);

    for (Entity& child : entity.children)
    {
        drawSelfAndChild(child, ourShader);
    }
}
```

learnopengls scengrafsdemo ritar sin kedja med en `while`-loop som följer det sista barnet nedåt (och utelämnar det
allra sista); kursen ritar hela trädet rekursivt, som learnopengls demo för frustum culling gör. Grafen byggs efter att
modellen lästs in, med learnopengls loop:

```cpp
    Entity ourEntity;
    ourEntity.pModel = &ourModel;
    setLocalPosition(ourEntity.transform, glm::vec3(0.0f, 0.0f, 0.0f));
    const float scale = 0.6f;

    {
        Entity* lastEntity = &ourEntity;

        for (unsigned int i = 0; i < 10; ++i)
        {
            addChild(*lastEntity, ourModel);
            lastEntity = &lastEntity->children.back();

            // set transform values: beside its parent, 0.6 times its size
            setLocalPosition(lastEntity->transform, glm::vec3(3.5f, 0.0f, 0.0f));
            setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));
        }
    }
    updateSelfAndChild(ourEntity, glm::mat4(1.0f));
```

och renderingsloopen ritar den med `drawSelfAndChild(ourEntity, ourShader);` i stället för den enda ritningen.
:::
:::vulkan
```cpp
struct Entity {
    // scene graph
    std::vector<Entity> children;

    // space information
    Transform transform;

    Model* pModel = nullptr;
};
```

(En `std::vector` av den struct som innehåller den är tillåten sedan C++17: vektorn kräver bara att elementtypen är
komplett när den används, inte när den deklareras.) `addChild(Entity& parent, Model& model)` skapar ett `Entity child;`
med `child.pModel = &model;` och lägger det i `parent.children`. Att uppdatera grafen innebär att gå igenom den från
roten, räkna ut varje entitets globala matris ur förälderns och skicka den egna vidare:

```cpp
void updateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix) {
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children) {
        updateSelfAndChild(child, entity.transform.modelMatrix);
    }
}
```

Ritningen går igenom den på samma sätt. learnopengls `ourShader.setMat4("model", …)` före varje ritning är en push
constant, så den rekursiva funktionen spelar för varje entitet in push constanten och modellens ritning i command
buffern:

```cpp
void drawSelfAndChild(Entity& entity, VkCommandBuffer commandBuffer, VkPipelineLayout pipelineLayout) {
    PushConstants constants{};
    constants.model = entity.transform.modelMatrix;
    vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
    Draw(*entity.pModel, commandBuffer);

    for (Entity& child : entity.children) {
        drawSelfAndChild(child, commandBuffer, pipelineLayout);
    }
}
```

Varje `vkCmdDrawIndexed` ser de push constant-värden som spelades in före den – det är det som gör att en modell som
ritas elva gånger hamnar på elva ställen. learnopengls scengrafsdemo ritar sin kedja med en `while`-loop som följer det
sista barnet nedåt (och utelämnar det allra sista); kursen ritar hela trädet rekursivt, som learnopengls demo för frustum
culling gör.

Applikationen behåller learnopengls två lokala variabler som medlemmar, `Model ourModel;` (finns i starten) och `Entity
ourEntity;`, och bygger grafen en gång i `loadEntities()`, som `initVulkan()` anropar när buffrarna finns:

```cpp
    void loadEntities() {
        ourModel.vertexBuffer = vertexBuffer;
        ourModel.indexBuffer = indexBuffer;
        ourModel.indexCount = static_cast<uint32_t>(indices.size());

        // load entities
        // -------------
        ourEntity.pModel = &ourModel;
        setLocalPosition(ourEntity.transform, glm::vec3(0.0f, 0.0f, 0.0f));
        const float scale = 0.6f;

        {
            Entity* lastEntity = &ourEntity;

            for (unsigned int i = 0; i < 10; ++i) {
                addChild(*lastEntity, ourModel);
                lastEntity = &lastEntity->children.back();

                // set transform values: beside its parent, 0.6 times its size
                setLocalPosition(lastEntity->transform, glm::vec3(3.5f, 0.0f, 0.0f));
                setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));
            }
        }
        updateSelfAndChild(ourEntity, glm::mat4(1.0f));
    }
```

`recordCommandBuffer()` ritar sedan med `drawSelfAndChild(ourEntity, commandBuffer, pipelineLayout);` i stället för den
enda ritningen.
:::
:::d3d12
```cpp
struct Entity
{
    // scene graph
    std::vector<Entity> children;

    // space information
    Transform transform;

    Model* pModel = nullptr;
};
```

(En `std::vector` av den struct som innehåller den är tillåten sedan C++17: vektorn kräver bara att elementtypen är
komplett när den används, inte när den deklareras.) `addChild(Entity& parent, Model& model)` skapar ett `Entity child;`
med `child.pModel = &model;` och lägger det i `parent.children`. Att uppdatera grafen innebär att gå igenom den från
roten, räkna ut varje entitets globala matris ur förälderns och skicka den egna vidare – inläst igen från sin
`XMFLOAT4X4` till en `XMMATRIX`:

```cpp
void updateSelfAndChild(Entity& entity, const XMMATRIX& parentGlobalModelMatrix)
{
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children)
    {
        updateSelfAndChild(child, XMLoadFloat4x4(&entity.transform.modelMatrix));
    }
}
```

Ritningen går igenom den på samma sätt. learnopengls `ourShader.setMat4("model", …)` före varje ritning är en uppsättning
root constants, så den rekursiva funktionen spelar för varje entitet in den transponerade modellmatrisen och modellens
ritning i command listen:

```cpp
void drawSelfAndChild(Entity& entity, ID3D12GraphicsCommandList* commandList)
{
    ModelConstants modelConstants = {};
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(XMLoadFloat4x4(&entity.transform.modelMatrix)));
    commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    entity.pModel->Draw(commandList);

    for (Entity& child : entity.children)
    {
        drawSelfAndChild(child, commandList);
    }
}
```

`ModelConstants` (`XMFLOAT4X4 model`) flyttas ut ur klassen `D3D12App` så att den här fria funktionen kan använda den.
Varje ritning ser de root constants som sattes före den – det är det som gör att en modell som ritas elva gånger hamnar
på elva ställen. learnopengls scengrafsdemo ritar sin kedja med en `while`-loop som följer det sista barnet nedåt (och
utelämnar det allra sista); kursen ritar hela trädet rekursivt, som learnopengls demo för frustum culling gör.

Roten är en medlem bredvid modellen, `Entity m_ourEntity;`, och byggs i `LoadAssets` direkt efter `m_model.Load(...)` med
learnopengls loop:

```cpp
        Entity* lastEntity = &m_ourEntity;

        for (unsigned int i = 0; i < 10; ++i)
        {
            addChild(*lastEntity, m_model);
            lastEntity = &lastEntity->children.back();

            // set transform values
            setLocalPosition(lastEntity->transform, XMFLOAT3(3.5f, 0.0f, 0.0f));
            setLocalScale(lastEntity->transform, XMFLOAT3(scale, scale, scale));
        }
```

med `m_ourEntity.pModel = &m_model;` och `const float scale = 0.6f;` före och `updateSelfAndChild(m_ourEntity,
XMMatrixIdentity());` efter. `PopulateCommandList` ritar sedan med `drawSelfAndChild(m_ourEntity, m_commandList.Get());`
i stället för den enda ritningen.
:::

### Ett ord om pekare in i vektorer

Loopen tar en pekare till barnet den just lade till – `lastEntity = &lastEntity->children.back();` – och fortsätter
använda den. Med en `std::vector` av värden förtjänar det en extra titt: när en vektor växer förbi sin kapacitet
allokerar den nytt minne och flyttar dit sina element, och varje pekare eller referens till ett gammalt element pekar då
in i frigjort minne. Här är det ofarligt, eftersom varje entitet får exakt ett barn, och när loopen väl gått vidare till
det barnet lägger den aldrig till något i förälderns vektor igen. Men om du lägger till ett andra barn till en entitet
medan du håller en pekare till dess första, eller lagrar `Entity*`-föräldrapekare i barnen som learnopengl gör, kan de
pekarna hänga i luften efter nästa `push_back`. Det är därför learnopengl håller `std::unique_ptr<Entity>` i sin lista:
varje entitet bor i en egen allokering och flyttas aldrig. Kursen undviker problemet på ett annat sätt – inga lagrade
pekare in i trädet, förälderns matris skickas ned som parameter – och `pModel` pekar på modellen, som lever utanför
trädet under hela programmet.

```quiz
Efter `addChild(root, model)` sparar koden `Entity* first = &root.children.back();` och anropar sedan `addChild(root, model)` igen. Vad kan hända med `first`?
- [ ] Ingenting: en pekare till ett vektorelement är giltig så länge vektorn finns
- [ ] Den pekar nu på det andra barnet, eftersom `back()` har ändrats
- [x] Den kan hänga i luften: om det andra `push_back` överskred vektorns kapacitet har vektorn flyttat sina element till nytt minne
- [ ] Den blir automatiskt `nullptr`
---
`push_back` gör alla pekare och referenser till elementen ogiltiga när den allokerar om. Projektets loop är ofarlig eftersom den bara lägger till ett barn per entitet; learnopengl undviker problemet med `std::unique_ptr` i en lista.
```

Gör nu den andra uppgiften, **entity**: structen och dess tre funktioner, grafen byggd av roten och tio barn,
uppdaterad en gång och ritad i stället för den enda planeten. Bygg och kör: en kedja av elva planeter med ringar löper åt
höger, var och en 0.6 gånger så stor som den före och närmare den – de sista är bara prickar. Alla är samma modell med
var sin modellmatris; grafen räknade ut var var och en ska ligga ur ingenting annat än "3.5 till höger om min förälder,
0.6 av dess storlek".

## Dirty-flaggan

`updateSelfAndChild` räknar om varje modellmatris i trädet varje gång den anropas. I en statisk scen är det bortkastat
arbete, och i en stor scen – tusentals entiteter, de flesta stilla – blir det mycket. learnopengls svar är en *dirty
flag* ("smutsflagga"): varje transform minns om dess lokala värden har ändrats sedan dess matris senast räknades ut.
Set-funktionerna sätter den; `computeModelMatrix` nollställer den.

Uppdateringen räknar då bara om det som är inaktuellt. Om en entitet är markerad måste dess matris räknas om – och
likaså matriserna för allt under den, även om deras egna lokala värden inte ändrats, eftersom deras globala matriser
innehåller den här. Om den inte är markerad stämmer dess matris fortfarande, och uppdateringen behöver bara leta längre
ned i trädet efter markerade entiteter. Uppdateringen delas därför i två:

:::opengl
```cpp
// force the update of an entity's model matrix and all of its children's, even if their local values did not change
void forceUpdateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix)
{
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children)
    {
        forceUpdateSelfAndChild(child, entity.transform.modelMatrix);
    }
}

// update the model matrices that changed: a dirty entity and everything below it
void updateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix)
{
    if (entity.transform.isDirty)
    {
        forceUpdateSelfAndChild(entity, parentGlobalModelMatrix);
        return;
    }

    for (Entity& child : entity.children)
    {
        updateSelfAndChild(child, entity.transform.modelMatrix);
    }
}
```

Flaggan är `bool isDirty = true;` i `Transform` – sann från början, så att en ny entitet räknas ut första gången. Varje
`setLocal…`-funktion får `transform.isDirty = true;`, och `computeModelMatrix` slutar med `transform.isDirty = false;`.
:::
:::vulkan
```cpp
// force the update of an entity's model matrix and all of its children's, even if their local values did not change
void forceUpdateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix) {
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children) {
        forceUpdateSelfAndChild(child, entity.transform.modelMatrix);
    }
}

// update the model matrices that changed: a dirty entity and everything below it
void updateSelfAndChild(Entity& entity, const glm::mat4& parentGlobalModelMatrix) {
    if (entity.transform.isDirty) {
        forceUpdateSelfAndChild(entity, parentGlobalModelMatrix);
        return;
    }

    for (Entity& child : entity.children) {
        updateSelfAndChild(child, entity.transform.modelMatrix);
    }
}
```

Flaggan är `bool isDirty = true;` i `Transform` – sann från början, så att en ny entitet räknas ut första gången. Varje
`setLocal…`-funktion får `transform.isDirty = true;`, och `computeModelMatrix` slutar med `transform.isDirty = false;`.
:::
:::d3d12
```cpp
// force the update of an entity's model matrix and all of its children's, even if their local values did not change
void forceUpdateSelfAndChild(Entity& entity, const XMMATRIX& parentGlobalModelMatrix)
{
    computeModelMatrix(entity.transform, parentGlobalModelMatrix);

    for (Entity& child : entity.children)
    {
        forceUpdateSelfAndChild(child, XMLoadFloat4x4(&entity.transform.modelMatrix));
    }
}

// update the model matrices that changed: a dirty entity and everything below it
void updateSelfAndChild(Entity& entity, const XMMATRIX& parentGlobalModelMatrix)
{
    if (entity.transform.isDirty)
    {
        forceUpdateSelfAndChild(entity, parentGlobalModelMatrix);
        return;
    }

    for (Entity& child : entity.children)
    {
        updateSelfAndChild(child, XMLoadFloat4x4(&entity.transform.modelMatrix));
    }
}
```

Flaggan är `bool isDirty = true;` i `Transform` – sann från början, så att en ny entitet räknas ut första gången. Varje
`setLocal…`-funktion får `transform.isDirty = true;`, och `computeModelMatrix` slutar med `transform.isDirty = false;`.
:::

Gör nu den tredje uppgiften, **dirty-flag**. Bilden förblir densamma – den första uppdateringen finner allt markerat och
räknar ut alltihop, precis som förut. Flaggan lönar sig i nästa steg, när en entitet ändras varje bildruta.

```quiz
Med dirty-flaggan sätts rotens rotation varje bildruta, och inget annat ändras. Vilka modellmatriser räknar `updateSelfAndChild(root, identity)` om?
- [ ] Bara rotens: barnens lokala värden har inte ändrats
- [x] Alla elva: roten är markerad, så `forceUpdateSelfAndChild` räknar om den och allt under den, eftersom varje barns globala matris innehåller rotens
- [ ] Ingen: flaggan nollställs i slutet av varje bildruta
- [ ] Bara barnens, eftersom roten saknar förälder
---
En omarkerad entitet under en markerad behöver ändå en ny global matris. Om bara den sista, lilla planeten hade flyttats skulle uppdateringen ha gått ned genom den omarkerade kedjan och räknat om den enda matrisen.
```

## Att flytta grafen

Nu kan grafen visa vad den är till för: flytta en entitet, och allt som sitter fast i den följer med. Roten vrider sig
kring sin y-axel med 20 grader per sekund, learnopengls fart. learnopengl adderar `20 * deltaTime` till vinkeln efter
varje bildruta; kursen sätter i stället vinkeln utifrån tiden – `20 · time` – så att bilden vid en given tidpunkt alltid
blir densamma (det förväntade resultatet visar den vid 2.0 s, en vinkel på 40°). Sedan uppdateras grafen, **innan** den
ritas, så att bildrutan visar den här bildrutans matriser.

:::opengl
Överst i bildrutan, efter tiden:

```cpp
        // turn the root about its y axis (20 degrees per second): its children follow it
        setLocalRotation(ourEntity.transform, glm::vec3(0.0f, 20.0f * currentFrame, 0.0f));
        updateSelfAndChild(ourEntity, glm::mat4(1.0f));
```
:::
:::vulkan
Överst i `recordCommandBuffer()` – koden som körs varje bildruta innan ritningarna spelas in:

```cpp
        // turn the root about its y axis (20 degrees per second): its children follow it
        float currentFrame = static_cast<float>(glfwGetTime());
        setLocalRotation(ourEntity.transform, glm::vec3(0.0f, 20.0f * currentFrame, 0.0f));
        updateSelfAndChild(ourEntity, glm::mat4(1.0f));
```

Modellmatriserna åker till GPU:n inuti command buffern, som push constants, så det räcker att uppdatera dem före
inspelningen.
:::
:::d3d12
I `OnUpdate`, som körs varje bildruta innan `OnRender` spelar in command listen, med tiden sedan första bildrutan:

```cpp
    // turn the root about its y axis (20 degrees per second): its children follow it
    static auto startTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - startTime).count();
    setLocalRotation(m_ourEntity.transform, XMFLOAT3(0.0f, 20.0f * time, 0.0f));
    updateSelfAndChild(m_ourEntity, XMMatrixIdentity());
```

Modellmatriserna åker till GPU:n inuti command listen, som root constants, så det räcker att uppdatera dem före
inspelningen.
:::

Gör nu den sista uppgiften, **animate**. Bygg och kör: rotplaneten vrider sig, och hela kedjan svänger runt med den som
armen på en karusell – vid 2.0 s pekar den 40° in i skärmen, bakåt och åt höger. Du ändrade en rotation; grafen flyttade
elva planeter. Lägg märke till att barnen vrider sig kring *rotens* axel, inte sin egen: rotationen är en del av rotens
globala matris, som varje barns globala matris börjar med. För att få varje planet att även snurra kring sin egen axel
skulle du sätta varje barns lokala rotation också – prova, så rullar kedjan ihop sig, eftersom varje barns rotation läggs
till förälderns.

```quiz
Du vill att roten och de två första barnen ska stå kvar, och att bara det tredje barnet och allt efter det ska svänga runt. Vad ändrar du?
- [x] Det tredje barnets lokala rotation: dess globala matris och matriserna för alla entiteter under det ändras, de ovanför inte
- [ ] Rotens lokala rotation, med vinkeln delad med tre
- [ ] Den lokala rotationen för varje entitet från det tredje barnet och framåt, med samma vinkel
- [ ] Det tredje barnets globala modellmatris, direkt
---
En ändring av en entitet påverkar bara dess eget delträd. Att vrida varje entitet från det tredje barnet och framåt skulle lägga ihop vinklarna längs kedjan och rulla ihop den; en överskriven global matris skulle försvinna vid nästa uppdatering.
```

## Att gå vidare

En scengraf är ryggraden i de flesta motorers scenrepresentation, och learnopengls artikel nämner en del som en riktig
graf lägger till:

- **Rotationer som kvaternioner.** Eulervinklar är lätta att läsa men drabbas av *gimbal lock* (två axlar hamnar i linje
  och en frihetsgrad försvinner) och interpolerar dåligt. Motorer lagrar rotationer som kvaternioner (`glm::quat`,
  `XMVECTOR` med `XMQuaternion…`) och gör bara om dem till en matris för modellmatrisen.
- **Att ta bort och byta förälder.** Att flytta en entitet till en annan förälder ändrar dess globala matris om du inte
  också ändrar den lokala – oftast vill du att den ska stanna där den är, så den nya lokala matrisen blir
  `inverse(global(ny förälder)) · global(entitet)`.
- **Mer än transformer.** Samma träd bär annat som ärvs: synlighet, ett lager, en avgränsningsvolym som omsluter alla
  barn. Nästa kapitel, *Frustum culling*, använder den sista: när en avgränsningsvolym ligger utanför kamerans synfält
  behöver entiteten – och, med hierarkiska volymer, hela dess delträd – inte ritas.
- **Platt för GPU:n.** Att gå igenom ett träd med pekare är långsamt för stora scener; motorer lagrar ofta noderna i
  arrayer sorterade så att föräldrar kommer före barn, uppdaterar dem i ett enda linjärt svep och laddar upp alla
  modellmatriser i en buffer för instansierad eller indirekt ritning.

## Mer att läsa

- [Scene Graph](https://learnopengl.com/Guest-Articles/2021/Scene/Scene-Graph): learnopengls gästartikel som det här
  kapitlet följer.
- [scene_graph.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2021/1.scene/1.scene_graph/scene_graph.cpp):
  learnopengls demo; dess klasser `Transform` och `Entity` finns i `includes/learnopengl/entity.h`.
- [std::vector::push_back](https://en.cppreference.com/w/cpp/container/vector/push_back): när en växande vektor gör
  pekare och referenser till sina element ogiltiga.

:::opengl
- [Transformations](https://learnopengl.com/Getting-started/Transformations): learnopengls kapitel om matriser och
  ordningen mellan translation, rotation och skalning.
:::
:::vulkan
- [Push constants (Vulkan Guide)](https://docs.vulkan.org/guide/latest/push_constants.html): hur varje ritning får sin
  egen modellmatris.
:::
:::d3d12
- [DirectXMath programming guide](https://learn.microsoft.com/en-us/windows/win32/dxmath/directxmath-portal):
  radvektorer, `XMMATRIX` och lagringstyperna `XMFLOAT3` / `XMFLOAT4X4`.
:::
