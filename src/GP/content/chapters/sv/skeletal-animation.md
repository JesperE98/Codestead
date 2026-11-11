# Skelettanimation

Allt kursen hittills har ritat har varit stelt: en modellmatris flyttade, vred och skalade ett helt mesh på en gång.
Levande saker rör sig inte så. En arm böjs vid armbågen, en svans ringlar sig, ett ansikte ler – meshet *deformeras*.
Ett sätt att animera ett mesh som deformeras är *vertexanimation*: lagra varje vertex position för varje bildruta (eller
för några nyckelbildrutor, och blanda mellan dem). Det är enkelt och exakt, men det kostar minne för varje vertex i varje
nyckel, och en animation gjord för ett mesh kan inte återanvändas på ett annat.

Nästan alla spel använder i stället *skelettanimation*. En grafiker ger meshet ett **skelett**: ett litet träd av
**ben** (bones), vart och ett med en egen transform. Varje vertex fästs vid ett eller några ben med **vikter** som säger
hur mycket varje ben drar i den. En animation lagrar då bara benens transformer över tiden – en handfull positioner,
rotationer och skalor per ben, inte per vertex – och vertex shadern flyttar varje vertex med de ben den hör till. Det
kallas *skinning*: meshet är en hud över benen. Samma gångcykel kan driva vilken figur som helst med samma skelett.

Kapitlet följer learnopengls gästartikel *Skeletal Animation*. Det läser in en skinnad, animerad modell med assimp,
interpolerar benens nyckelbildrutor på CPU:n, går igenom benhierarkin för att räkna ut en matris per ben, och skinnar
meshet i vertex shadern. Bara det sista steget berör GPU:n, och det fungerar på samma sätt i alla API:er: benens id som
heltal och vikterna som flyttal i vertexattribut, och en array av benmatriser i en buffer. Kapitlet visar var {{api}}
lägger dem.

## Modellen

learnopengl animerar en dansande figur från en sajt för 3D-tillgångar. Kursen använder en egen modell: en **tentakel** –
ett avsmalnande, randigt rör med rundad spets och en rad bleka sugkoppar – 2.2 enheter hög, med foten i origo. Den är en
glTF 2.0-fil, `models/tentacle.gltf` (med `tentacle.bin` och texturen `tentacle.png`), skriven av kursens skript
`models/make_tentacle.py`. Skelettet är en kedja av **fyra ben**: `Base` vid foten, `Lower` vid y = 0.55, `Upper` vid 1.1
och `Tip` vid 1.65; varje vertex är fäst vid högst två av dem, med vikter som summerar till 1. Den enda animationen,
`Sway`, varar 2 sekunder och upprepas: en våg av rotationer löper uppför tentakeln, basen vrider sig och guppar, och
spetsen sväller – fem nycklar per ben, vid 0, 0.5, 1, 1.5 och 2 sekunder.

Kameran är learnopengls, i (0, 0, 3) med blicken längs -z, och modellmatrisen `translate(0, -1, 0) · scale(0.9)` ställer
tentakeln mitt i fönstret (learnopengl använder `translate(0, -0.4, 0) · scale(0.5)` för sin figur). Fragment shadern
visar den diffusa texturen utan belysning, som learnopengls gör.

:::opengl
Projektet är programmet från delen *Modellinläsning* med learnopengls ändringar från `model_animation.h` ännu ogjorda:
`model.h` och `mesh.h` (klasserna `Model` och `Mesh`), `assimp_glm_helpers.h` (learnopengls omvandlingar från assimps
typer till GLM:s, som fria `inline`-funktioner: `ConvertMatrixToGLMFormat`, `GetGLMVec`, `GetGLMQuat`) och shaderna
`anim_model.vs` / `.fs`. Modellen läses in som learnopengls `model_animation.h` gör – `aiProcess_Triangulate |
aiProcess_GenSmoothNormals | aiProcess_CalcTangentSpace`, **utan** `aiProcess_FlipUVs`: assimp vänder redan glTF:s
texturkoordinater till OpenGL:s konvention med v uppåt, och `stbi_set_flip_vertically_on_load(true)` vänder bilden på
samma sätt. Programmet använder OpenGL 3.3 core, som learnopengls demo.
:::
:::vulkan
Projektet läser in modellen med assimp som vulkan-tutorials `loadModel` gör: hela modellen blir en lista med vertexar och
en lista med index, för en vertex buffer och en index buffer. learnopengls klass `Model` blir en struct med fria
funktioner – `struct Model { std::vector<Vertex> vertices; std::vector<uint32_t> indices; … }`, fylld av
`LoadModel(Model&, path)` → `processNode` → `processMesh` – och filnamnen är konstanter, `MODEL_PATH =
"models/tentacle.gltf"` och `TEXTURE_PATH = "models/tentacle.png"` (inläst med kursens `loadTexture`). assimp vänder
glTF:s texturkoordinater till OpenGL:s konvention med v uppåt; i Vulkan är v = 0 bildens översta rad, så modellen läses
med `aiProcess_FlipUVs` tillagd, som vänder tillbaka dem. learnopengls GLM-hjälpfunktioner (`ConvertMatrixToGLMFormat`,
`GetGLMVec`, `GetGLMQuat`) är fria `inline`-funktioner överst i `main.cpp`. Modellmatrisen är en push constant.
:::
:::d3d12
Projektet läser in modellen med klassen `Model` från kapitlet *Modell* och assimp, med `aiProcess_FlipUVs` – assimp
vänder glTF:s texturkoordinater till OpenGL:s konvention med v uppåt, flaggan vänder tillbaka dem, och i Direct3D är
v = 0 bildens översta rad. Ingen `aiProcess_ConvertToLeftHanded`: kursens matematik är högerhänt (`XMMatrixLookAtRH`,
`XMMatrixPerspectiveFovRH`). Modellmatrisen är en root constant, som i kapitlet *Modell*.
:::

Kommentarerna `// TODO:` visar var din kod ska in; **Build & run** (Ctrl+Enter) kompilerar programmet och kör det i den
inbyggda simulatorn: en rak tentakel mitt i fönstret – meshet i sin *vilopose*, den form det modellerades i.

## Ben, bindposen och offsetmatrisen

Ett ben är en transform i en hierarki, som scengrafens entiteter: varje bens transform är relativ till förälderns, och ett
bens globala transform är förälderns globala transform gånger dess egen lokala. När tentakelns bas vrider sig följer allt
ovanför med.

Meshet modellerades i **bindposen** (viloposen): vertexarnas positioner ligger i modellrummet med skelettet stående rakt.
För att flytta en vertex med ett ben måste vi först uttrycka vertexen *i förhållande till benet* – ta bort benets
transform i bindposen – och sedan tillämpa benets nuvarande, animerade globala transform. Den första delen är
**offsetmatrisen** (*den inversa bindmatrisen*): inversen av benets globala transform i bindposen. För tentakelns ben
`Lower`, som sitter vid y = 0.55 i bindposen, är den helt enkelt `translate(0, -0.55, 0)`. Varje bens slutliga matris är
alltså

```text
finalBoneMatrix = globalTransform(bone, now) · offset(bone)
```

I bindposen tar de två ut varandra och den slutliga matrisen är enhetsmatrisen: meshet förblir som det modellerades. När
benet vrider sig vrider sig vertexen med det, kring benets egen position.

En vertex som är fäst vid flera ben flyttas av vart och ett av dem, och resultaten blandas med vertexens vikter:

```text
position = Σ weight[i] · finalBoneMatrix[boneId[i]] · bindPosePosition
```

Det här är *linear blend skinning*. Eftersom vikterna summerar till 1 hamnar en vertex mitt emellan två ben som böjer sig
isär mellan de platser vart och ett av benen skulle ta den till, och meshet böjer sig mjukt vid leden.

```quiz
En vertex ligger i (0, 0.55, 0) i bindposen, och dess enda ben `Lower` (vid y = 0.55 i bindposen) har inte rört sig. Vad gör benets slutliga matris med vertexen?
- [ ] Den flyttar vertexen till origo, eftersom offsetmatrisen förskjuter med −0.55
- [ ] Den flyttar den uppåt 0.55 en gång till
- [x] Ingenting: global transform · offset = translate(0, 0.55, 0) · translate(0, −0.55, 0) = enhetsmatrisen i bindposen
- [ ] Den roterar den kring origo
---
Offsetmatrisen tar in vertexen i benets rum, den globala transformen tar ut den igen. Först när benets globala transform skiljer sig från bindposen flyttas vertexen.
```

## Nyckelbildrutor och interpolation

En animation lagrar för varje animerat ben tre **spår** (tracks) av nyckelbildrutor: positioner, rotationer och skalor,
varje nyckel med en tidsstämpel. Mellan nycklarna interpoleras benets transform. Positioner och skalor interpoleras
linjärt – `mix(a, b, t)` – där `t` är hur stor del av vägen från den tidigare nyckeln till den senare som gått.

Rotationer lagras som **kvaternioner** och interpoleras med **slerp**, sfärisk linjär interpolation, som rör sig längs den
kortaste bågen mellan de två orienteringarna med konstant vinkelhastighet. Interpolerar man Eulervinklar i stället blir
vägarna konstiga – de tre vinklarna ändras oberoende av varandra, så rotationen däremellan kan svänga genom orienteringar
som inte ligger på någon av nycklarnas väg, och vinklar som slår runt vid 360° tar den långa vägen. Inte ens att
interpolera *rotationsmatrisernas* komponenter linjärt fungerar: resultatet är inte alls en rotation (det krymper och
skjuvar meshet däremellan). Kvaternioner undviker båda problemen.

Tiden i en animationsfil räknas i **ticks**. Filen anger hur många ticks som går på en sekund (`mTicksPerSecond`) och hur
lång animationen är (`mDuration`). För tentakelns glTF-fil rapporterar assimp 1000 ticks per sekund och en längd på 2000
ticks, så nycklarna ligger vid 0, 500, 1000, 1500 och 2000 ticks. Animatorn flyttar fram sin tid med `ticksPerSecond ·
deltaTime` varje bildruta och slår runt den med `fmod(time, duration)` för att upprepa.

```quiz
Varför interpoleras ett bens rotationsnycklar med slerp på kvaternioner i stället för genom att Eulervinklar interpoleras linjärt?
- [ ] För att Eulervinklar inte kan lagras i en animationsfil
- [x] För att slerp följer den kortaste bågen mellan de två orienteringarna med konstant fart, medan tre vinklar som interpoleras var för sig kan ta omvägar (och den långa vägen runt vid 360°)
- [ ] För att slerp är billigare att räkna ut än en linjär interpolation
- [ ] För att GPU:n bara tar emot kvaternioner i vertex shadern
---
Nycklarnas orienteringar är det grafikern satte; vad som händer mellan dem bestäms av interpolationen. Kvaternion-slerp ger den mest direkta, jämna rotationen – och resultatet förblir en ren rotation, vilket en linjär blandning av matriser inte gör.
```

## Benvikter i vertexarna

assimp lagrar huden per ben: varje `aiBone` i ett mesh har ett namn, sin offsetmatris (`mOffsetMatrix`) och en lista med
de vertexar det påverkar och deras vikter (`mWeights`, var och en ett `mVertexId` och en `mWeight`). En vertex shader
behöver det åt andra hållet – per vertex, de ben som flyttar den. learnopengl vänder på det när meshet läses in: varje
vertex får plats för upp till fyra ben-id och fyra vikter (`MAX_BONE_INFLUENCE = 4`, nog för nästan alla figurer;
tentakeln använder två), alla id satta till −1 (inget ben) och vikterna till 0 från början. Sedan skrivs varje bens
vikter in på den första lediga platsen i varje vertex det påverkar. Varje bennamn får ett id, i den ordning benen först
dyker upp, och dess offsetmatris sparas i en map, `m_BoneInfoMap`, av `BoneInfo { int id; mat4 offset; }`. För tentakeln
blir id:na 0, 1, 2, 3 för `Base`, `Lower`, `Upper` och `Tip`.

:::opengl
I `mesh.h` växer `Vertex` med `int m_BoneIDs[MAX_BONE_INFLUENCE]; float m_Weights[MAX_BONE_INFLUENCE];`, och VAO:n får
två attribut till – kursens `Vertex` har inga tangenter, så nästa lediga platser är 3 och 4 (learnopengls är 5 och 6):

```cpp
        glVertexAttribIPointer(3, 4, GL_INT, sizeof(Vertex), (void*)offsetof(Vertex, m_BoneIDs));
```

```cpp
        glVertexAttribPointer(4, 4, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, m_Weights));
```

Lägg märke till **I** i `glVertexAttribIPointer`: ben-id:na är heltal och måste nå shadern som heltal (`ivec4`).
`glVertexAttribPointer` skulle göra om dem till flyttal på vägen. `model.h` får mapen och räknaren och
inläsningsfunktionerna:
:::
:::vulkan
`Vertex` växer med `int m_BoneIDs[MAX_BONE_INFLUENCE]; float m_Weights[MAX_BONE_INFLUENCE];`, och
attributbeskrivningarna får två poster till – id:na på location 3, vikterna på location 4:

```cpp
        // ids: four 32-bit signed integers (SINT keeps them integers: the shader reads an ivec4)
        attributeDescriptions[3].binding = 0;
        attributeDescriptions[3].location = 3;
        attributeDescriptions[3].format = VK_FORMAT_R32G32B32A32_SINT;
        attributeDescriptions[3].offset = offsetof(Vertex, m_BoneIDs);
```

och `VK_FORMAT_R32G32B32A32_SFLOAT` för vikterna. Formatet bestämmer hur shadern ser datan: `SINT` levererar heltal till
en `ivec4` – Vulkans motsvarighet till OpenGL:s `glVertexAttribIPointer` – där ett `SFLOAT`- eller `SNORM`-format skulle
leverera flyttal. Modellstructen behåller `std::map<std::string, BoneInfo> m_BoneInfoMap; int m_BoneCounter = 0;`, och
inläsningsfunktionerna är learnopengls:
:::
:::d3d12
`Vertex` växer med `int m_BoneIDs[4]; float m_Weights[4];` (vid byte 32 och 48), och input layouten får två element till
med de semantiker som Direct3D har för skinning:

```cpp
            { "BLENDINDICES", 0, DXGI_FORMAT_R32G32B32A32_SINT, 0, 32, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "BLENDWEIGHT", 0, DXGI_FORMAT_R32G32B32A32_FLOAT, 0, 48, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

Formatet `SINT` levererar heltal till shaderns `int4` – Direct3D:s motsvarighet till OpenGL:s `glVertexAttribIPointer`.
Modellen behåller en map av `BoneInfo` (med offseten som `XMFLOAT4X4`) och en räknare, och inläsningsfunktionerna är
learnopengls:
:::

```cpp
    // put the bone and its weight into the vertex's first free slot (at most MAX_BONE_INFLUENCE bones per vertex)
    void SetVertexBoneData(Vertex& vertex, int boneID, float weight)
    {
        for (int i = 0; i < MAX_BONE_INFLUENCE; ++i)
        {
            if (vertex.m_BoneIDs[i] < 0)
            {
                vertex.m_Weights[i] = weight;
                vertex.m_BoneIDs[i] = boneID;
                break;
            }
        }
    }
```

`ExtractBoneWeightForVertices`, som anropas i slutet av `processMesh`, ger varje nytt bennamn nästa id och sparar dess
offsetmatris (omvandlad från assimps radvisa `aiMatrix4x4`), och går sedan igenom benets vikter:

```cpp
            for (int weightIndex = 0; weightIndex < numWeights; ++weightIndex)
            {
                int vertexId = weights[weightIndex].mVertexId;
                float weight = weights[weightIndex].mWeight;
                SetVertexBoneData(vertices[vertexId], boneID, weight);
            }
```

Gör nu den första uppgiften, **bone-weights**. Shadern använder inte de nya attributen ännu, så tentakeln står
fortfarande rak.

## Benet

learnopengls klass `Bone` håller ett bens tre spår och räknar ut dess lokala transform vid en given tid. Som i kapitlet
*Scengraf* skriver kursen den som en struct med fria funktioner, med learnopengls namn: `CreateBone(name, ID, channel)`
kopierar nycklarna i en `aiNodeAnim` till `m_Positions`, `m_Rotations` och `m_Scales`; `UpdateBone(bone, time)`
interpolerar alla tre och sätter ihop dem.

Att hitta de två nycklarna runt en tidpunkt är en sökning efter den första nyckel vars *nästa* nyckel ligger senare:

:::opengl vulkan
```cpp
int GetPositionIndex(const Bone& bone, float animationTime)
{
    for (int index = 0; index < bone.m_NumPositions - 1; ++index)
    {
        if (animationTime < bone.m_Positions[index + 1].timeStamp)
            return index;
    }
    return bone.m_NumPositions - 2; // not reached: the animation's time stays below its duration
}
```

(learnopengl avslutar funktionen med `assert(0)`, vilket lämnar den utan returvärde i ett release-bygge; kursen
returnerar det sista paret.) `GetScaleFactor(last, next, time)` är `(time − last) / (next − last)`, andelen mellan
nycklarna. Rotationen:

```cpp
    int p0Index = GetRotationIndex(bone, animationTime);
    int p1Index = p0Index + 1;
    float scaleFactor = GetScaleFactor(bone.m_Rotations[p0Index].timeStamp,
        bone.m_Rotations[p1Index].timeStamp, animationTime);
    glm::quat finalRotation = glm::slerp(bone.m_Rotations[p0Index].orientation, bone.m_Rotations[p1Index].orientation,
        scaleFactor);
    finalRotation = glm::normalize(finalRotation);
    return glm::toMat4(finalRotation);
```

Positioner och skalor gör samma sak med `glm::mix`. Ett spår med en enda nyckel returnerar bara den nyckelns värde. Till
sist:

```cpp
void UpdateBone(Bone& bone, float animationTime)
{
    glm::mat4 translation = InterpolatePosition(bone, animationTime);
    glm::mat4 rotation = InterpolateRotation(bone, animationTime);
    glm::mat4 scale = InterpolateScaling(bone, animationTime);
    bone.m_LocalTransform = translation * rotation * scale;
}
```

`glm::toMat4` och `glm::slerp` för kvaternioner kräver `#define GLM_ENABLE_EXPERIMENTAL` och `<glm/gtx/quaternion.hpp>`.
assimps kvaternioner lagrar w först; `GetGLMQuat` bygger `glm::quat(w, x, y, z)`.
:::
:::d3d12
Funktionerna är learnopengls, med DirectXMath i stället för GLM. Matriser lagras som `XMFLOAT4X4` och kvaternioner som
`XMFLOAT4` i structar och vektorer (`XMMATRIX` och `XMVECTOR` kräver en justering på 16 byte som `std::vector` och
`std::map` inte lovar). `glm::mix` blir `XMVectorLerp`, och rotationen:

```cpp
    int p0Index = GetRotationIndex(bone, animationTime);
    int p1Index = p0Index + 1;
    float scaleFactor = GetScaleFactor(bone.m_Rotations[p0Index].timeStamp,
        bone.m_Rotations[p1Index].timeStamp, animationTime);
    XMVECTOR finalRotation = XMQuaternionSlerp(XMLoadFloat4(&bone.m_Rotations[p0Index].orientation), XMLoadFloat4(&bone.m_Rotations[p1Index].orientation),
        scaleFactor);
    finalRotation = XMQuaternionNormalize(finalRotation);
    return XMMatrixRotationQuaternion(finalRotation);
```

`GetXMQuat` ordnar om assimps kvaternion med w först till DirectXMaths (x, y, z, w). Och eftersom DirectXMath
multiplicerar en **radvektor** med matrisen till höger om den skrivs varje produkt av transformer i omvänd ordning mot
GLM – den lokala transform som learnopengl skriver `translation * rotation * scale` blir:

```cpp
void UpdateBone(Bone& bone, float animationTime)
{
    XMMATRIX translation = InterpolatePosition(bone, animationTime);
    XMMATRIX rotation = InterpolateRotation(bone, animationTime);
    XMMATRIX scale = InterpolateScaling(bone, animationTime);
    XMStoreFloat4x4(&bone.m_LocalTransform, scale * rotation * translation);
}
```

`GetPositionIndex` och de andra sökningarna är learnopengls loopar; learnopengl avslutar dem med `assert(0)`, vilket
lämnar funktionen utan returvärde i ett release-bygge, så kursen returnerar det sista paret (`count - 2`).
`GetScaleFactor(last, next, time)` är `(time − last) / (next − last)`.
:::

Gör nu den andra uppgiften, **bone**. Ingenting anropar den ännu.

## Animationen

learnopengls `Animation` läser in animationen ur filen – med en egen `Assimp::Importer`, här ur samma `tentacle.gltf` som
meshet – och behåller det animatorn behöver:

- längden och antalet ticks per sekund;
- en kopia av filens **nodträd** (`AssimpNodeData`: varje nods namn, dess egen transformation och dess barn), inläst
  rekursivt av `ReadHierarchyData`. Benen är noder i det här trädet – `Tentacle` (roten) med barnen `TentacleMesh` och
  `Base` → `Lower` → `Upper` → `Tip` – och det är trädet som gör benen till en hierarki;
- en `Bone` per animations**kanal** (`ReadMissingBones`). En kanal namnger den nod den animerar. Finns namnet inte i
  modellens `m_BoneInfoMap` – ett ben som rör sig men som ingen vertex använder direkt – får det ett nytt id där; sedan
  skapas `Bone` med det id:t. Tentakelns kanaler kommer i ordningen `Tip`, `Upper`, `Lower`, `Base`, alla redan kända
  från meshet;
- själva bentabellen, kopierad från modellen.

:::opengl vulkan
```cpp
void LoadAnimation(Animation& animation, const std::string& animationPath, Model& model)
{
    Assimp::Importer importer;
    const aiScene* scene = importer.ReadFile(animationPath, aiProcess_Triangulate);
    if (!scene || !scene->mRootNode || scene->mNumAnimations == 0)
    {
        std::cout << "ERROR::ASSIMP:: no animation in " << animationPath << std::endl;
        return;
    }
    auto aiAnim = scene->mAnimations[0];
    animation.m_Duration = aiAnim->mDuration;
    animation.m_TicksPerSecond = aiAnim->mTicksPerSecond;
    ReadHierarchyData(animation.m_RootNode, scene->mRootNode);
    ReadMissingBones(animation, aiAnim, model);
}
```

`FindBone(animation, name)` returnerar den `Bone` som har det namnet, eller `nullptr` för en nod som inte är animerad
(learnopengl söker med `std::find_if` och en lambda; kursen med en range-for).
:::
:::d3d12
`LoadAnimation(animation, path, model)` är learnopengls: `importer.ReadFile(animationPath, aiProcess_Triangulate)`,
`mDuration` och `mTicksPerSecond` i `scene->mAnimations[0]`, `ReadHierarchyData` från `scene->mRootNode` (med varje nods
`mTransformation` omvandlad av `ConvertMatrixToXMFormat`), och `ReadMissingBones`. `FindBone(animation, name)` returnerar
den `Bone` som har det namnet, eller `nullptr` för en nod som inte är animerad. assimps matriser är radvisa och gjorda för
kolumnvektorer (translationen i sista kolumnen); DirectXMaths radvektorer vill ha translationen i sista raden, så
omvandlingen **transponerar** dem – samma tal som learnopengls `ConvertMatrixToGLMFormat` kopierar in i GLM:s
kolumnvisa lagring, lästa åt andra hållet.
:::

Gör nu den tredje uppgiften, **animation**, och läs in sway-animationen efter modellen:
:::opengl
`Animation swayAnimation; LoadAnimation(swayAnimation, "models/tentacle.gltf", ourModel);`. Bilden ändras inte.
:::
:::vulkan
`LoadAnimation(swayAnimation, MODEL_PATH, ourModel)` i `initVulkan()`, efter `LoadModel` och innan buffrarna skapas
(`swayAnimation` är en medlem i applikationen). Bilden ändras inte.
:::
:::d3d12
`LoadAnimation(m_swayAnimation, …, m_model)` i `LoadAssets`, direkt efter modellen (`m_swayAnimation` är en medlem i
`D3D12App`). Bilden ändras inte.
:::

## Animatorn

`Animator` spelar upp en animation: den håller den aktuella tiden och de **slutliga benmatriserna**, 100 stycken
(learnopengls `MAX_BONES`), alla enhetsmatriser från början. `CalculateBoneTransform` går igenom nodträdet från roten och
skickar varje nods globala transform vidare till barnen – precis scengrafens uppdatering. För en nod som är ett animerat
ben är dess egen transform benets interpolerade lokala transform vid den aktuella tiden; annars nodens statiska
transformation ur filen. För en nod som är ett ben är den slutliga matrisen dess globala transform gånger dess
offsetmatris:

:::opengl vulkan
```cpp
void CalculateBoneTransform(Animator& animator, const AssimpNodeData* node, glm::mat4 parentTransform)
{
    std::string nodeName = node->name;
    glm::mat4 nodeTransform = node->transformation;

    Bone* bone = FindBone(*animator.m_CurrentAnimation, nodeName);

    if (bone)
    {
        UpdateBone(*bone, animator.m_CurrentTime);
        nodeTransform = bone->m_LocalTransform;
    }

    glm::mat4 globalTransformation = parentTransform * nodeTransform;

    auto& boneInfoMap = animator.m_CurrentAnimation->m_BoneInfoMap;
    if (boneInfoMap.find(nodeName) != boneInfoMap.end())
    {
        int index = boneInfoMap[nodeName].id;
        glm::mat4 offset = boneInfoMap[nodeName].offset;
        animator.m_FinalBoneMatrices[index] = globalTransformation * offset;
    }

    for (int i = 0; i < node->childrenCount; i++)
        CalculateBoneTransform(animator, &node->children[i], globalTransformation);
}
```

och `UpdateAnimation` flyttar fram tiden och räknar om allt:

```cpp
void UpdateAnimation(Animator& animator, float dt)
{
    animator.m_DeltaTime = dt;
    if (animator.m_CurrentAnimation)
    {
        animator.m_CurrentTime += animator.m_CurrentAnimation->m_TicksPerSecond * dt;
        animator.m_CurrentTime = fmod(animator.m_CurrentTime, animator.m_CurrentAnimation->m_Duration);
        CalculateBoneTransform(animator, &animator.m_CurrentAnimation->m_RootNode, glm::mat4(1.0f));
    }
}
```
:::
:::d3d12
Genomgången är learnopengls med produkterna i radvektorordning – en nods globala transform är `nodeTransform *
parentTransform`, ett bens slutliga matris `offset * globalTransformation`:

```cpp
    XMMATRIX globalTransformation = nodeTransform * parentTransform;

    auto& boneInfoMap = animator.m_CurrentAnimation->m_BoneInfoMap;
    if (boneInfoMap.find(nodeName) != boneInfoMap.end())
    {
        int index = boneInfoMap[nodeName].id;
        XMMATRIX offset = XMLoadFloat4x4(&boneInfoMap[nodeName].offset);
        XMStoreFloat4x4(&animator.m_FinalBoneMatrices[index], offset * globalTransformation);
    }

    for (int i = 0; i < node->childrenCount; i++)
        CalculateBoneTransform(animator, &node->children[i], globalTransformation);
```

Resultaten är samma matriser som GLM:s, transponerade. `UpdateAnimation(animator, dt)` är learnopengls: `m_CurrentTime +=
m_TicksPerSecond * dt`, `fmod(m_CurrentTime, m_Duration)`, sedan `CalculateBoneTransform` från roten med
`XMMatrixIdentity()`.
:::

Läs en slutlig matris ur vertexens perspektiv: offsetmatrisen verkar först (den tar bindpose-vertexen in i benets rum),
sedan benets lokala transform, sedan förälderns, och så vidare upp till roten. GLM skriver den kedjan från roten ned till
offseten; DirectXMath, med radvektorer, skriver den från offseten upp till roten.

Gör nu den fjärde uppgiften, **animator**: skapa animatorn för sway-animationen och räkna tills vidare ut benen en gång
vid tiden 0 med `UpdateAnimation(animator, 0.0f)` före loopen. Matriserna finns, men ingenting använder dem ännu.

```quiz
Noden `TentacleMesh` i `CalculateBoneTransform` är inget ben och har ingen animationskanal. Vad händer vid den noden?
- [ ] Genomgången stannar där: dess barn besöks inte
- [x] Dess statiska transformation ur filen används för dess globala transform, och ingen slutlig benmatris skrivs för den
- [ ] Den får ett nytt ben-id och en egen slutlig matris
- [ ] Dess globala transform nollställs till enhetsmatrisen
---
Bara noder som finns i `m_BoneInfoMap` får en slutlig matris, och bara animerade noder hämtar sin transform från en `Bone`. Varje nod skickar ändå sin globala transform vidare till sina barn – ett ben under en statisk nod ärver den nodens transformation.
```

## Skinning i vertex shadern

Vertex shadern flyttar nu varje vertex med dess ben: för var och en av dess fyra platser hoppar den över id −1,
transformerar bindpose-positionen med benets slutliga matris och adderar resultatet med platsens vikt. learnopengl skyddar
också mot ett id utanför arrayen och faller då tillbaka på den oskinnade positionen.

:::opengl
```glsl
layout (location = 3) in ivec4 boneIds;
layout (location = 4) in vec4 weights;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

const int MAX_BONES = 100;
const int MAX_BONE_INFLUENCE = 4;
uniform mat4 finalBonesMatrices[MAX_BONES];

out vec2 TexCoords;

void main()
{
    // the position as the weighted sum of where each of the vertex's bones moves it
    vec4 totalPosition = vec4(0.0);
    for (int i = 0; i < MAX_BONE_INFLUENCE; i++)
    {
        if (boneIds[i] == -1)
            continue;
        if (boneIds[i] >= MAX_BONES)
        {
            totalPosition = vec4(pos, 1.0);
            break;
        }
        vec4 localPosition = finalBonesMatrices[boneIds[i]] * vec4(pos, 1.0);
        totalPosition += localPosition * weights[i];
    }

    mat4 viewModel = view * model;
    gl_Position = projection * viewModel * totalPosition;
    TexCoords = tex;
}
```

De 100 matriserna är uniforms, satta en och en varje bildruta:

```cpp
        auto transforms = animator.m_FinalBoneMatrices;
        for (int i = 0; i < (int)transforms.size(); ++i)
            ourShader.setMat4("finalBonesMatrices[" + std::to_string(i) + "]", transforms[i]);
```

Det blir 100 anrop till `glUniformMatrix4fv` per bildruta – helt okej för en modell. En renderare med många animerade
modeller lägger matriserna i en uniform buffer eller en shader storage buffer och laddar upp dem i ett svep, som de
explicita API:erna gör.
:::
:::vulkan
De 100 matriserna hamnar i uniform buffern, efter vy och projektion – 6 400 byte, långt inom de 16 kB som varje
Vulkan-enhet tillåter för en uniform buffer:

```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    mat4 finalBonesMatrices[MAX_BONES];
} ubo;
```

med `glm::mat4 finalBonesMatrices[MAX_BONES];` i C++-structen (std140 lägger matriser 64 byte isär, som C++ gör).
Shaderns loop är learnopengls:

```glsl
    vec4 totalPosition = vec4(0.0);
    for (int i = 0; i < MAX_BONE_INFLUENCE; i++) {
        if (boneIds[i] == -1)
            continue;
        if (boneIds[i] >= MAX_BONES) {
            totalPosition = vec4(pos, 1.0);
            break;
        }
        vec4 localPosition = ubo.finalBonesMatrices[boneIds[i]] * vec4(pos, 1.0);
        totalPosition += localPosition * weights[i];
    }
```

`updateUniformBuffer()` kopierar animatorns matriser in i structen varje bildruta:

```cpp
        // the bones' final matrices
        auto transforms = animator.m_FinalBoneMatrices;
        for (int i = 0; i < (int)transforms.size(); ++i)
            ubo.finalBonesMatrices[i] = transforms[i];
```

och ett enda `memcpy` laddar upp dem. Med många animerade modeller skulle en riktig renderare använda en storage buffer,
eller ett område i en buffer per modell.
:::
:::d3d12
De 100 matriserna hamnar i constant buffern efter vy och projektion – `XMFLOAT4X4 finalBonesMatrices[MAX_BONES]` i C++,
`float4x4 finalBonesMatrices[MAX_BONES]` i HLSL; buffern är 6 528 byte, avrundad uppåt till 6 656 för sin vy. Vertex
shadern läser benen via `BLENDINDICES` och `BLENDWEIGHT`:

```hlsl
PSInput VSMain(float3 pos : POSITION, float3 norm : NORMAL, float2 tex : TEXCOORD, int4 boneIds : BLENDINDICES, float4 weights : BLENDWEIGHT)
{
    PSInput result;

    // the position as the weighted sum of where each of the vertex's bones moves it
    float4 totalPosition = float4(0.0f, 0.0f, 0.0f, 0.0f);
    for (int i = 0; i < MAX_BONE_INFLUENCE; i++)
    {
        if (boneIds[i] == -1)
            continue;
        if (boneIds[i] >= MAX_BONES)
        {
            totalPosition = float4(pos, 1.0f);
            break;
        }
        float4 localPosition = mul(float4(pos, 1.0f), finalBonesMatrices[boneIds[i]]);
        totalPosition += localPosition * weights[i];
    }
```

`OnUpdate` kopierar matriserna in i constant buffern varje bildruta, transponerade som de andra:

```cpp
    for (int i = 0; i < static_cast<int>(m_animator.m_FinalBoneMatrices.size()); ++i)
        XMStoreFloat4x4(&constantBufferData.finalBonesMatrices[i], XMMatrixTranspose(XMLoadFloat4x4(&m_animator.m_FinalBoneMatrices[i])));
```

och ett enda `memcpy` laddar upp alla.
:::

Gör nu den femte uppgiften, **skinning**. Bygg och kör: tentakeln intar animationens första pose – vid tiden 0 är den
redan böjd: mitten åt höger, den övre delen svängd tillbaka åt vänster, spetsen uppe till vänster. Den står still,
eftersom tiden inte går framåt ännu.

```quiz
Varför skickas ben-id:na som ett heltalsattribut (`ivec4` / `SINT` / `int4`) i stället för som flyttal?
- [ ] För att flyttal inte kan hålla värden upp till 100
- [ ] För att heltalsattribut tar mindre minne
- [x] För att de indexerar matrisarrayen: ett heltal förblir exakt, medan ett flyttal som omvandlats på vägen – eller normaliserats – kan peka ut fel ben eller kräva en omvandling i shadern
- [ ] För att vikterna också måste vara heltal
---
`glVertexAttribPointer` gör om sin data till flyttal; `glVertexAttribIPointer` behåller heltal. Vulkans format `SINT` och Direct3D:s `R32G32B32A32_SINT` gör detsamma: shadern får id:na som heltal att indexera med.
```

## Att spela upp animationen

Det sista steget är det learnopengls renderingsloop har: flytta fram animatorn med bildrutans `deltaTime` varje bildruta,
efter indata och före ritningen, och ta bort engångsuppdateringen vid tiden 0.

:::opengl
`UpdateAnimation(animator, deltaTime);` i renderingsloopen, direkt efter `processInput(window);`.
:::
:::vulkan
`UpdateAnimation(animator, deltaTime);` i `mainLoop()`, efter `processInput()` och före `drawFrame()`.
:::
:::d3d12
`UpdateAnimation(m_animator, deltaTime);` i `OnUpdate`, efter indata och innan constant buffern fylls.
:::

Gör nu den sista uppgiften, **play**. Bygg och kör: tentakeln svajar – en våg löper uppåt från basen, basen vrider sig och
guppar, spetsen sväller och krymper – ett varv varannan sekund, och den upprepas utan hopp eftersom den sista nyckeln är
lika med den första. Skärmbilden tas vid 1.25 s, 1250 ticks, mellan nycklarna vid 1000 och 1500: tentakeln lutar åt
höger, med spetsen uppe till höger. Vid 0.25 s lutar den åt vänster i spegelposen.

```quiz
Animationen är 2000 ticks lång med 1000 ticks per sekund. Animatorns tid står på 1990 ticks och nästa bildruta tar 1/60 s. Var är animationen efter uppdateringen?
- [ ] Vid 2006.7 ticks: tiden fortsätter, och nycklarna efter 2000 upprepar den sista
- [ ] Vid 0: animationen börjar om exakt från början
- [x] Vid ungefär 6.7 ticks: 1990 + 1000 · (1/60) = 2006.7, och `fmod` med 2000 slår runt den till början av nästa varv
- [ ] Vid 1990: animatorn stannar i slutet
---
`fmod` håller tiden inom animationen. Eftersom tentakelns nyckel vid 2000 är lika med nyckeln vid 0 blir övergången sömlös.
```

## Att gå vidare

learnopengls animator är kärnan som varje motor börjar med. Det riktiga motorer lägger till:

- **Att blanda animationer.** En figur går och börjar sedan springa: i stället för att byta interpoleras de två
  animationernas lokala bentransformer (slerp för rotationerna) med en vikt som ändras över tiden. Lager låter
  överkroppen spela en annan animation än benen.
- **Dual quaternion skinning.** Linear blend skinning tar medelvärdet av matriser, och där två ben vrids kraftigt mot
  varandra faller meshet ihop vid leden ("karamellpapperseffekten"). Att beskriva varje ben som en dual quaternion och
  blanda dem behåller volymen.
- **Normaler.** Även normalerna måste skinnas – med samma matriser (eller deras inversa transponat vid skalning), vilket
  learnopengls shader förbereder i sin oanvända `localNormal`. Tentakeln är obelyst, så kursen utelämnar det.
- **Skinning på GPU:n, en gång.** När ett skinnat mesh ritas flera gånger per bildruta (skuggkartor, djup-förpass)
  skinnar motorer det en gång i en compute shader till en vertex buffer och ritar den – kapitlet *Compute shaders* visar
  grunderna.
- **Fler ben, färre uppladdningar.** Alla figurers benmatriser i en storage buffer; eller 3 × 4-matriser i stället för
  4 × 4 för att spara plats.

## Mer att läsa

- [Skeletal Animation](https://learnopengl.com/Guest-Articles/2020/Skeletal-Animation): learnopengls gästartikel som det
  här kapitlet följer.
- [skeletal_animation.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2020/skeletal_animation/skeletal_animation.cpp):
  learnopengls demo; dess klasser `Bone`, `Animation` och `Animator` finns i `includes/learnopengl/`.
- [glTF 2.0 specification: skins](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins): leder, inversa
  bindmatriser och vertexvikter i formatet för kursens tentakel.

:::opengl
- [glVertexAttribPointer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glVertexAttribPointer.xhtml): med
  `glVertexAttribIPointer` för heltalsattribut.
:::
:::vulkan
- [Vertex input description](https://vulkan-tutorial.com/Vertex_buffers/Vertex_input_description): attributformat, som
  `R32G32B32A32_SINT` för heltalsattribut.
:::
:::d3d12
- [XMQuaternionSlerp](https://learn.microsoft.com/en-us/windows/win32/api/directxmath/nf-directxmath-xmquaternionslerp):
  DirectXMaths sfäriska linjära interpolation.
:::
