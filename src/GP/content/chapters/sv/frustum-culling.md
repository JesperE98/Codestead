# Frustum culling

Förra kapitlet byggde en scengraf och ritade varje entitet i den. GPU:n har inget emot att rita saker som hamnar utanför
skärmen – den transformerar deras vertexar, klipper trianglarna mot synvolymen och kastar dem – men det arbetet är inte
gratis. Varje vertex i varje objekt går fortfarande genom vertex shadern, och varje draw-anrop kostar fortfarande
CPU-tid att spela in och skicka. I en stor scen är de flesta objekt oftast *inte* i bild: bakom kameran, bredvid den,
bortom det bortre planet. *Frustum culling* hittar dem på CPU:n, innan något draw-anrop görs, och hoppar över dem.

Idén är enkel: beskriv volymen kameran kan se – *synfrustumet* (view frustum, en stympad pyramid) – med sex plan, linda
in varje objekt i en enkel *avgränsningsvolym* (bounding volume) som är billig att testa, och rita bara ett objekt vars
avgränsningsvolym ligger åtminstone delvis innanför alla sex plan. Kapitlet följer learnopengls gästartikel *Frustum
Culling*, den andra av dess två artiklar om scener; den bygger på förra kapitlets scengraf. Precis som scengrafen är det
kod på CPU:n: API:et ser bara färre draw-anrop. Matematiken är densamma för {{api}} som för alla andra API:er, och
kapitlet visar varför.

## Scenen

learnopengls frustum-demo ersätter kedjan av planeter med ett rutnät: många planeter, alla barn till roten. Kursens
rutnät har 10 × 10 barn, 5 enheter isär, i de lokala positionerna (x · 5 − 22.5, 0, z · 5 − 22.5) för x och z från 0
till 9, var och en hälften så stor som roten – 101 planeter totalt. learnopengls demo har 20 × 20 planeter 10 enheter
isär, sedda från (0, 10, 0); kursen behåller förra kapitlets kamera i (3, 6, 12), som tittar nedåt 25°, och färre
planeter, eftersom den inbyggda simulatorn ritar på CPU:n. Roten fortsätter att vrida sig 20° per sekund, som i slutet av
förra kapitlet, så hela rutnätet vrider sig kring origo och vilka planeter som syns ändras med tiden. Skärmbilderna tas
vid 2.0 s, med rutnätet vridet 40°.

Projektet är förra kapitlets lösning med tre nya `// TODO:`-kommentarer. **Build & run** (Ctrl+Enter) kompilerar det och
kör det i den inbyggda simulatorn: den vridna kedjan av planeter.

:::opengl
Rutnätet byggs med två nästlade loopar, där kedjan byggdes förut:

```cpp
    {
        Entity* lastEntity = &ourEntity;

        for (unsigned int x = 0; x < 10; ++x)
        {
            for (unsigned int z = 0; z < 10; ++z)
            {
                addChild(ourEntity, ourModel);
                lastEntity = &ourEntity.children.back();

                // set transform values: 5 units apart, half the root's size
                setLocalPosition(lastEntity->transform, glm::vec3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f));
                setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));
            }
        }
    }
```

med `const float scale = 0.5f;`.
:::
:::vulkan
Rutnätet byggs i `loadEntities()` med två nästlade loopar, där kedjan byggdes förut:

```cpp
        {
            Entity* lastEntity = &ourEntity;

            for (unsigned int x = 0; x < 10; ++x) {
                for (unsigned int z = 0; z < 10; ++z) {
                    addChild(ourEntity, ourModel);
                    lastEntity = &ourEntity.children.back();

                    // set transform values: 5 units apart, half the root's size
                    setLocalPosition(lastEntity->transform, glm::vec3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f));
                    setLocalScale(lastEntity->transform, glm::vec3(scale, scale, scale));
                }
            }
        }
```

med `const float scale = 0.5f;`.
:::
:::d3d12
Rutnätet byggs i `LoadAssets` med två nästlade loopar, där kedjan byggdes förut:

```cpp
        for (unsigned int x = 0; x < 10; ++x)
        {
            for (unsigned int z = 0; z < 10; ++z)
            {
                addChild(m_ourEntity, m_model);
                lastEntity = &m_ourEntity.children.back();

                // set transform values: 5 units apart, half the root's size
                setLocalPosition(lastEntity->transform, XMFLOAT3(x * 5.0f - 22.5f, 0.0f, z * 5.0f - 22.5f));
                setLocalScale(lastEntity->transform, XMFLOAT3(scale, scale, scale));
            }
        }
```

med `Entity* lastEntity = &m_ourEntity;` före looparna och `const float scale = 0.5f;`.
:::

Alla hundra barnen läggs i *samma* vektor, rotens, så den växer och allokerar om många gånger – kom ihåg förra kapitlets
varning om pekare in i vektorer. Loopen är ändå ofarlig, eftersom den hämtar `lastEntity` på nytt efter varje `addChild`
och bara använder den före nästa.

Gör nu den första uppgiften, **grid**. Bygg och kör: 101 planeter med ringar fyller fönstret, de nära stora längst ned,
de avlägsna små uppåt, rutnätet vridet 40°. Var och en av dem ritas, vare sig den syns på skärmen eller inte – även
planeterna bredvid och bakom kameran.

## Frustumet

Synfrustumet för en perspektivkamera är en pyramid med toppen avskuren: det nära planet, det bortre planet och fyra
sidoplan genom kamerans position och bildens kanter. En punkt syns (före djuptestet) precis när den ligger på insidan av
alla sex plan.

Ett plan kan beskrivas med en *normal* **n** av längd ett och ett *avstånd* d från origo: det är mängden punkter **p**
med `dot(n, p) = d`. För en godtycklig punkt är `dot(n, p) − d` dess *tecknade avstånd* till planet: positivt på den sida
normalen pekar mot, negativt på den andra, noll på planet. Om alla sex normaler pekar *in i* frustumet ligger en punkt
innanför när dess tecknade avstånd till varje plan är positivt.

:::opengl
learnopengls `Plane` och dess två hjälpfunktioner, som en struct och fria funktioner:

```cpp
struct Plane
{
    glm::vec3 normal = { 0.0f, 1.0f, 0.0f }; // unit vector
    float distance = 0.0f;                    // distance with origin
};

// the plane through the point p1 with the normal norm
Plane makePlane(const glm::vec3& p1, const glm::vec3& norm)
{
    Plane plane;
    plane.normal = glm::normalize(norm);
    plane.distance = glm::dot(plane.normal, p1);
    return plane;
}

// > 0: the point is on the side the normal points to, < 0: behind the plane
float getSignedDistanceToPlane(const Plane& plane, const glm::vec3& point)
{
    return glm::dot(plane.normal, point) - plane.distance;
}
```
:::
:::vulkan
learnopengls `Plane` och dess två hjälpfunktioner, som en struct och fria funktioner – GLM, som hos learnopengl:

```cpp
struct Plane {
    glm::vec3 normal = { 0.0f, 1.0f, 0.0f }; // unit vector
    float distance = 0.0f;                    // distance with origin
};
```

`makePlane(const glm::vec3& p1, const glm::vec3& norm)` normaliserar normalen och sätter `distance = glm::dot(normal,
p1)`: planet genom punkten `p1`. `getSignedDistanceToPlane(const Plane& plane, const glm::vec3& point)` returnerar
`glm::dot(plane.normal, point) - plane.distance`.
:::
:::d3d12
learnopengls `Plane` och dess två hjälpfunktioner med DirectXMath – `XMFLOAT3` i structen, `XMVECTOR` för matematiken.
`XMVector3Dot` returnerar skalärprodukten kopierad till alla fyra komponenter i en vektor; `XMVectorGetX` plockar ut den:

```cpp
Plane makePlane(const XMVECTOR& p1, const XMVECTOR& norm)
{
    Plane plane;
    const XMVECTOR normal = XMVector3Normalize(norm);
    XMStoreFloat3(&plane.normal, normal);
    plane.distance = XMVectorGetX(XMVector3Dot(normal, p1));    // XMVector3Dot puts the dot product in every component
    return plane;
}
```

```cpp
float getSignedDistanceToPlane(const Plane& plane, const XMVECTOR& point)
{
    return XMVectorGetX(XMVector3Dot(XMLoadFloat3(&plane.normal), point)) - plane.distance;
}
```
:::

Frustumet är sex sådana plan: `struct Frustum { Plane topFace; Plane bottomFace; Plane rightFace; Plane leftFace;
Plane farFace; Plane nearFace; };`.

### Att bygga frustumet från kameran

learnopengl bygger de sex planen ur kamerans egna parametrar – samma som projektionsmatrisen görs av. Tänk dig kamerans
position, dess vektorer *front*, *right* och *up*, och det bortre planet på avståndet `zFar` längs front-vektorn. Med ett
vertikalt synfält `fovY` är det bortre planets rektangel `2 · halfVSide` hög och `2 · halfHSide` bred:

```text
halfVSide = zFar · tan(fovY / 2)
halfHSide = halfVSide · aspect
```

- Det **nära** planet går genom `position + zNear · front` med normalen `front`; det **bortre** planet genom `position +
  zFar · front` med normalen `−front`. Båda normalerna pekar inåt.
- De fyra **sidoplanen** går alla genom kamerans position. Vart och ett innehåller en kant av frustumet: vektorn från
  kameran till mitten av den bortre rektangelns vänstra kant är till exempel `zFar · front − right · halfHSide`. Ett
  sidoplan innehåller den kantvektorn och kamerans up- (eller right-) vektor, så dess normal är kryssprodukten av de två –
  i den ordning som får den att peka in i frustumet.

learnopengls funktion tar emot en `Camera`; kursens tar emot kamerans värden direkt och räknar ut right och up som
learnopengls klass `Camera` gör:

:::opengl
```cpp
Frustum createFrustumFromCamera(const glm::vec3& position, const glm::vec3& front, const glm::vec3& worldUp, float aspect, float fovY, float zNear, float zFar)
{
    // the camera's right and up vectors (learnopengl's Camera class keeps them as Right and Up)
    const glm::vec3 right = glm::normalize(glm::cross(front, worldUp));
    const glm::vec3 up = glm::normalize(glm::cross(right, front));

    Frustum frustum;
    const float halfVSide = zFar * tanf(fovY * 0.5f);
    const float halfHSide = halfVSide * aspect;
    const glm::vec3 frontMultFar = zFar * front;

    frustum.nearFace = makePlane(position + zNear * front, front);
    frustum.farFace = makePlane(position + frontMultFar, -front);
    frustum.rightFace = makePlane(position, glm::cross(frontMultFar - right * halfHSide, up));
    frustum.leftFace = makePlane(position, glm::cross(up, frontMultFar + right * halfHSide));
    frustum.topFace = makePlane(position, glm::cross(right, frontMultFar - up * halfVSide));
    frustum.bottomFace = makePlane(position, glm::cross(frontMultFar + up * halfVSide, right));
    return frustum;
}
```
:::
:::vulkan
```cpp
Frustum createFrustumFromCamera(const glm::vec3& position, const glm::vec3& front, const glm::vec3& worldUp, float aspect, float fovY, float zNear, float zFar) {
    // the camera's right and up vectors (learnopengl's Camera class keeps them as Right and Up)
    const glm::vec3 right = glm::normalize(glm::cross(front, worldUp));
    const glm::vec3 up = glm::normalize(glm::cross(right, front));

    Frustum frustum;
    const float halfVSide = zFar * tanf(fovY * 0.5f);
    const float halfHSide = halfVSide * aspect;
    const glm::vec3 frontMultFar = zFar * front;

    frustum.nearFace = makePlane(position + zNear * front, front);
    frustum.farFace = makePlane(position + frontMultFar, -front);
    frustum.rightFace = makePlane(position, glm::cross(frontMultFar - right * halfHSide, up));
    frustum.leftFace = makePlane(position, glm::cross(up, frontMultFar + right * halfHSide));
    frustum.topFace = makePlane(position, glm::cross(right, frontMultFar - up * halfVSide));
    frustum.bottomFace = makePlane(position, glm::cross(frontMultFar + up * halfVSide, right));
    return frustum;
}
```
:::
:::d3d12
```cpp
Frustum createFrustumFromCamera(const XMVECTOR& position, const XMVECTOR& front, const XMVECTOR& worldUp, float aspect, float fovY, float zNear, float zFar)
{
    // the camera's right and up vectors (learnopengl's Camera class keeps them as Right and Up)
    const XMVECTOR right = XMVector3Normalize(XMVector3Cross(front, worldUp));
    const XMVECTOR up = XMVector3Normalize(XMVector3Cross(right, front));

    Frustum frustum;
    const float halfVSide = zFar * tanf(fovY * 0.5f);
    const float halfHSide = halfVSide * aspect;
    const XMVECTOR frontMultFar = zFar * front;

    frustum.nearFace = makePlane(position + zNear * front, front);
    frustum.farFace = makePlane(position + frontMultFar, -front);
    frustum.rightFace = makePlane(position, XMVector3Cross(frontMultFar - right * halfHSide, up));
    frustum.leftFace = makePlane(position, XMVector3Cross(up, frontMultFar + right * halfHSide));
    frustum.topFace = makePlane(position, XMVector3Cross(right, frontMultFar - up * halfVSide));
    frustum.bottomFace = makePlane(position, XMVector3Cross(frontMultFar + up * halfVSide, right));
    return frustum;
}
```

Kursens DirectX 12-kod använder en högerhänt kamera (`XMMatrixLookAtRH`, `XMMatrixPerspectiveFovRH`), som GLM, och
kryssprodukten är samma funktion i alla bibliotek – den är matematik, inte en konvention – så planen blir learnopengls.
:::

Om du kontrollerar riktningarna märker du att planet som learnopengl kallar `rightFace` innehåller frustumets *vänstra*
kant (med normalen pekande åt höger, in i frustumet), och `topFace` den nedre kanten; sidoplanens namn är omkastade. Det
spelar ingen roll för cullingen, som testar alla sex, men det är bra att veta om du någon gång använder ett plan för sig.

Lägg märke till vad funktionen *inte* använder: projektionsmatrisen. Planen byggs i världsrummet ur kamerans position och
riktningar, så det spelar ingen roll hur projektionen avbildar djupet eller åt vilket håll den låter y peka.
:::opengl
OpenGL:s projektion avbildar djupet på -1..1 i normaliserade enhetskoordinater; planen bryr sig inte.
:::
:::vulkan
Vulkans projektion avbildar djupet på 0..1 (`GLM_FORCE_DEPTH_ZERO_TO_ONE`) och vänder y (`proj[1][1] *= -1`); ingetdera
ändrar planen, och den bortsorterade mängden och antalen är exakt OpenGL:s. (Ett annat sätt att få fram planen är att
plocka ut dem ur raderna i vy-projektionsmatrisen; *den* metoden beror på djupintervallet – det nära planet är rad 3 ensam
för djupet 0..1 men rad 4 + rad 3 för -1..1 – och på y-vändningen.)
:::
:::d3d12
Direct3D:s projektion avbildar djupet på 0..1; det ändrar inte planen, och den bortsorterade mängden och antalen är exakt
OpenGL:s. (Ett annat sätt att få fram planen är att plocka ut dem ur vy-projektionsmatrisen; *den* metoden beror på
djupintervallet – för djupet 0..1 kommer det nära planet från tredje kolumnen ensam, för -1..1 från den fjärde plus den
tredje.)
:::

Gör nu den andra uppgiften, **frustum**: `Plane`, dess två hjälpfunktioner, `Frustum` och `createFrustumFromCamera`.
Ingenting anropar dem ännu, så bilden förblir densamma.

```quiz
Ett plan har enhetsnormalen (0, 0, −1) och avståndet 2. Vilket tecknat avstånd har punkten (1, 0, −5), och på vilken sida ligger den?
- [ ] −3: bakom planet
- [x] 3: på den sida normalen pekar mot
- [ ] 7: på den sida normalen pekar mot
- [ ] −7: bakom planet
---
dot((0, 0, −1), (1, 0, −5)) − 2 = 5 − 2 = 3. Ett positivt tecknat avstånd betyder den sida normalen pekar mot – för ett frustumplan, insidan.
```

## Avgränsningsvolymer

Att testa varje vertex i en modell mot sex plan skulle kosta mer än att rita den. I stället får varje modell en
*avgränsningsvolym*: en enkel form som omsluter alla dess vertexar och kan testas med några få operationer. Om
avgränsningsvolymen ligger helt utanför frustumet gör modellen det också. Om den ligger delvis innanför kanske modellen
syns, kanske inte – vi ritar den och låter GPU:n klippa den. Testet är *konservativt*: det kan rita något osynligt, men
det hoppar aldrig över något synligt.

Den enklaste avgränsningsvolymen är en **sfär**: en mittpunkt och en radie. learnopengl tar fram den ur modellens
vertexar: hitta den axelparallella lådan runt alla vertexar (minsta och största x, y och z), ta lådans mittpunkt som
sfärens mittpunkt och halva dess diagonal som radie.

Kursen rättar en detalj i learnopengls hjälpfunktion: learnopengl startar lådans maximum på
`std::numeric_limits<float>::min()`, som är det minsta *positiva* flyttalet, inte det mest negativa – för en modell som
ligger helt på negativa koordinater skulle maximum förbli fel. Kursen startar det på
`std::numeric_limits<float>::lowest()`. (learnopengl lagrar dessutom hela diagonalen som radie och halverar den senare;
kursen lagrar halva diagonalen – samma resultat.)

:::opengl
```cpp
// the sphere around the box that encloses all the model's vertices
Sphere generateSphereBV(const Model& model)
{
    glm::vec3 minAABB = glm::vec3(std::numeric_limits<float>::max());
    glm::vec3 maxAABB = glm::vec3(std::numeric_limits<float>::lowest());
    for (const Mesh& mesh : model.meshes)
    {
        for (const Vertex& vertex : mesh.vertices)
        {
            minAABB.x = std::min(minAABB.x, vertex.Position.x);
            minAABB.y = std::min(minAABB.y, vertex.Position.y);
            minAABB.z = std::min(minAABB.z, vertex.Position.z);

            maxAABB.x = std::max(maxAABB.x, vertex.Position.x);
            maxAABB.y = std::max(maxAABB.y, vertex.Position.y);
            maxAABB.z = std::max(maxAABB.z, vertex.Position.z);
        }
    }

    Sphere sphere;
    sphere.center = (maxAABB + minAABB) * 0.5f;
    sphere.radius = glm::length(maxAABB - minAABB) * 0.5f; // half the box's diagonal
    return sphere;
}
```

`Model` behåller sina meshar och deras vertexar på CPU:n efter inläsningen (`model.meshes`, `mesh.vertices`), så
hjälpfunktionen kan läsa dem. Lägg till `#include <limits>` och `#include <algorithm>`.
:::
:::vulkan
learnopengls hjälpfunktion går igenom `model.meshes` och deras `vertices`. Vulkans `Model` håller bara GPU-buffrar –
vertexarna kopierades till en buffer i enhetens lokala minne och finns inte längre på CPU:n så långt structen vet – så
uppgiften ger den en kopia: `std::vector<Vertex> vertices;` i `struct Model` (`// a copy of the vertices on the CPU, for
the model's bounding volume`), fylld med `ourModel.vertices = vertices;` i `loadEntities()`. Sedan:

```cpp
Sphere generateSphereBV(const Model& model) {
    glm::vec3 minAABB = glm::vec3(std::numeric_limits<float>::max());
    glm::vec3 maxAABB = glm::vec3(std::numeric_limits<float>::lowest());
    for (const Vertex& vertex : model.vertices) {
        minAABB.x = std::min(minAABB.x, vertex.pos.x);
        minAABB.y = std::min(minAABB.y, vertex.pos.y);
        minAABB.z = std::min(minAABB.z, vertex.pos.z);

        maxAABB.x = std::max(maxAABB.x, vertex.pos.x);
        maxAABB.y = std::max(maxAABB.y, vertex.pos.y);
        maxAABB.z = std::max(maxAABB.z, vertex.pos.z);
    }

    Sphere sphere;
    sphere.center = (maxAABB + minAABB) * 0.5f;
    sphere.radius = glm::length(maxAABB - minAABB) * 0.5f; // half the box's diagonal
    return sphere;
}
```

En riktig motor räknar ut avgränsningsvolymer en gång, när den importerar en tillgång, och sparar dem tillsammans med
den.
:::
:::d3d12
`model`-kapitlets `Model` behåller sina meshar och deras vertexar på CPU:n efter inläsningen (`model.meshes`,
`mesh.vertices`), så hjälpfunktionen kan läsa dem. Med DirectXMath jämför `XMVectorMin` och `XMVectorMax` komponent för
komponent, så lådan tar en rad per gräns:

```cpp
Sphere generateSphereBV(const Model& model)
{
    // the box: the smallest and the largest x, y and z (XMVectorMin / XMVectorMax compare
    // component by component); -FLT_MAX is the lowest float
    XMVECTOR minAABB = XMVectorReplicate(FLT_MAX);
    XMVECTOR maxAABB = XMVectorReplicate(-FLT_MAX);
    for (const Mesh& mesh : model.meshes)
    {
        for (const Vertex& vertex : mesh.vertices)
        {
            minAABB = XMVectorMin(minAABB, XMLoadFloat3(&vertex.position));
            maxAABB = XMVectorMax(maxAABB, XMLoadFloat3(&vertex.position));
        }
    }

    Sphere sphere;
    XMStoreFloat3(&sphere.center, (maxAABB + minAABB) * 0.5f);
    sphere.radius = XMVectorGetX(XMVector3Length(maxAABB - minAABB)) * 0.5f;    // half the box's diagonal
    return sphere;
}
```

`FLT_MAX` kommer från `<cfloat>`.
:::

Sfären ligger i modellens eget rum. För att testas måste den ligga i världsrummet, som planen: dess mittpunkt
transformeras med entitetens globala modellmatris, och dess radie skalas med den största av matrisens tre skalfaktorer –
längden av var och en av dess tre första kolumner. (Om ett objekt sträcks ut mer längs en axel måste sfären växa med den
största utsträckningen för att fortfarande omsluta det.) En sfär ligger då, åtminstone delvis, på insidan av ett plan när
dess mittpunkts tecknade avstånd är större än `−radius`:

:::opengl
```cpp
// the sphere is (at least partly) on the side of the plane its normal points to
bool isOnOrForwardPlane(const Sphere& sphere, const Plane& plane)
{
    return getSignedDistanceToPlane(plane, sphere.center) > -sphere.radius;
}

// the sphere, moved and scaled by the entity's model matrix, is (at least partly) inside the frustum
bool isOnFrustum(const Sphere& sphere, const Frustum& camFrustum, const Transform& transform)
{
    // get global scale thanks to our transform (the lengths of the model matrix's first three columns)
    const glm::vec3 globalScale = glm::vec3(glm::length(glm::vec3(transform.modelMatrix[0])),
                                            glm::length(glm::vec3(transform.modelMatrix[1])),
                                            glm::length(glm::vec3(transform.modelMatrix[2])));

    // get our global center with process it with the global model matrix of our transform
    const glm::vec3 globalCenter = glm::vec3(transform.modelMatrix * glm::vec4(sphere.center, 1.0f));

    // to wrap correctly our shape, we need the maximum scale scalar
    const float maxScale = std::max(std::max(globalScale.x, globalScale.y), globalScale.z);

    Sphere globalSphere;
    globalSphere.center = globalCenter;
    globalSphere.radius = sphere.radius * maxScale;

    // check firstly the result that have the most chance to failure to avoid to call all functions
    return (isOnOrForwardPlane(globalSphere, camFrustum.leftFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.rightFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.farFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.nearFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.topFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.bottomFace));
}
```

```quiz
Vad är `glm::vec3(transform.modelMatrix[0])` i `isOnFrustum`?
- [x] Den globala modellmatrisens första kolumn: modellens x-axel i världsrummet, skalad med den globala skalan längs x
- [ ] Entitetens position i världen
- [ ] Matrisens första rad, densamma i varje modellmatris
- [ ] x-koordinaten för sfärens mittpunkt
---
GLM indexerar en matris efter kolumner. I en modellmatris är de tre första kolumnerna modellens skalade axlar och den fjärde dess translation – så deras längder är skalfaktorerna, föräldrarnas skalor inräknade.
```
:::
:::vulkan
```cpp
// the sphere is (at least partly) on the side of the plane its normal points to
bool isOnOrForwardPlane(const Sphere& sphere, const Plane& plane) {
    return getSignedDistanceToPlane(plane, sphere.center) > -sphere.radius;
}
```

`isOnFrustum(const Sphere& sphere, const Frustum& camFrustum, const Transform& transform)` är learnopengls GLM-kod: den
globala skalan ur längderna av `glm::vec3(transform.modelMatrix[0])`, `[1]` och `[2]` (matrisens tre första kolumner),
mittpunkten `glm::vec3(transform.modelMatrix * glm::vec4(sphere.center, 1.0f))`, radien `sphere.radius * maxScale`, och
de sex `isOnOrForwardPlane`-testen sammanfogade med `&&`, sidoplanen först – de misslyckas oftast, och `&&` stannar vid
första misslyckandet.

```quiz
Varför får Vulkan-projektets `Model` en kopia `std::vector<Vertex> vertices` för avgränsningsvolymen?
- [ ] För att `vkCmdDrawIndexed` behöver vertexarna på CPU:n
- [ ] För att avgränsningsvolymen måste räknas om varje bildruta
- [ ] För att push constants bara kan hålla vertexpositioner
- [x] För att structen bara håller GPU-buffrar – vertexarna kopierades till en buffer i enhetens lokala minne – och hjälpfunktionen måste läsa positionerna på CPU:n
---
learnopengls `Model` behåller sina meshars vertexar på CPU:n; kursens Vulkan-struct `Model` hade bara bufferhandtagen. Avgränsningsvolymen räknas ut en gång, ur kopian; en riktig motor skulle räkna ut den när tillgången importeras.
```
:::
:::d3d12
`isOnOrForwardPlane(const Sphere& sphere, const Plane& plane)` returnerar `getSignedDistanceToPlane(plane,
XMLoadFloat3(&sphere.center)) > -sphere.radius`. I `isOnFrustum` skiljer sig en sak från GLM: med DirectXMaths
radvektorer ligger matrisens skalade axlar i dess **rader** `r[0..2]`, där GLM har dem i kolumnerna:

```cpp
bool isOnFrustum(const Sphere& sphere, const Frustum& camFrustum, const Transform& transform)
{
    const XMMATRIX modelMatrix = XMLoadFloat4x4(&transform.modelMatrix);

    // get global scale thanks to our transform: the lengths of the model matrix's first three
    // rows (DirectXMath's rows are glm's columns)
    const XMFLOAT3 globalScale(XMVectorGetX(XMVector3Length(modelMatrix.r[0])),
                               XMVectorGetX(XMVector3Length(modelMatrix.r[1])),
                               XMVectorGetX(XMVector3Length(modelMatrix.r[2])));

    // get our global center with process it with the global model matrix of our transform
    // (XMVector3Transform: the point with w = 1, times the matrix)
    const XMVECTOR globalCenter = XMVector3Transform(XMLoadFloat3(&sphere.center), modelMatrix);

    // to wrap correctly our shape, we need the maximum scale scalar
    const float maxScale = fmaxf(fmaxf(globalScale.x, globalScale.y), globalScale.z);

    Sphere globalSphere;
    XMStoreFloat3(&globalSphere.center, globalCenter);
    globalSphere.radius = sphere.radius * maxScale;

    // check firstly the result that have the most chance to failure to avoid to call all functions
    return (isOnOrForwardPlane(globalSphere, camFrustum.leftFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.rightFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.farFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.nearFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.topFace) &&
        isOnOrForwardPlane(globalSphere, camFrustum.bottomFace));
}
```

```quiz
Var håller DirectXMath modellens skalade x-axel i en `XMMATRIX`-modellmatris?
- [ ] I `r[3]`, tillsammans med translationen
- [ ] I första kolumnen, som i GLM
- [x] I första raden, `r[0]`, eftersom DirectXMath arbetar med radvektorer
- [ ] Ingenstans: den måste plockas ut med `XMMatrixDecompose`
---
Med radvektorer (`v · M`) är axlarna och translationen raderna; GLM:s kolumnvektorer lägger dem i kolumnerna. Därför tar DirectX 12-koden längderna av `r[0]`, `r[1]` och `r[2]`.
```
:::

learnopengl skriver `BoundingVolume` som en basklass med virtuella funktioner och `Sphere` och `AABB` som underklasser;
kursen har ingen basklass och skriver funktionerna som överlagringar för varje form. Varje entitet lagrar sin
avgränsningsvolym – `Sphere boundingVolume;` i `Entity`, satt i `addChild` (`child.boundingVolume =
generateSphereBV(model);`) och för roten. Alla planeter delar samma modell, så alla deras sfärer är lika i modellrummet;
modellmatriserna gör dem olika i världen.

Gör nu den tredje uppgiften, **bounding-sphere**. Inte heller den används ännu.

```quiz
En planets avgränsningssfär har radien 2 i modellrummet. Dess globala modellmatris skalar med 0.5 längs x och z och med 1.5 längs y. Vilken radie testar `isOnFrustum` med?
- [ ] 2 · 0.5 = 1, den minsta skalan, så att sfären förblir snäv
- [ ] 2 · (0.5 + 0.5 + 1.5) / 3, medelskalan
- [ ] 2, eftersom skalning inte ändrar en sfär
- [x] 2 · 1.5 = 3, den största skalan, så att sfären fortfarande omsluter den utsträckta modellen
---
En utsträckt modell får bara plats i en sfär om sfären växer med den största utsträckningen. Längderna av modellmatrisens tre första kolumner (rader i DirectXMath) är skalfaktorerna längs de tre axlarna – föräldrarnas skalor inräknade, eftersom det är den globala matrisen.
```

## Att culla scengrafen

Ritfunktionen testar nu varje entitet innan den ritas: bygg frustumet en gång per bildruta, och rita i `drawSelfAndChild`
bara en entitet när `isOnFrustum` säger att dess avgränsningsvolym ligger i frustumet. learnopengl räknar också hur
många entiteter som besöktes (`total`) och hur många som ritades (`display`) och skriver ut dem varje bildruta; kursen
lägger dem i fönstrets titel, så att du kan läsa dem i fönstret.

Lägg märke till att funktionen alltid går vidare till barnen, även när entiteten själv sorteras bort. En planets barn
ligger inte inuti dess avgränsningssfär – de är 5 enheter bort – så en bortsorterad förälder säger ingenting om dess barn.
En scengraf med *hierarkiska* avgränsningsvolymer, där varje nods volym omsluter hela dess delträd, skulle kunna hoppa
över delträdet också; det är det som gör culling av stora scener snabb.

För att du ska se cullingen arbeta byggs cullingfrustumet tills vidare med sitt bortre plan på **15**, medan projektionen
fortfarande når till 100: allt som ligger längre bort än 15 borde försvinna.

:::opengl
```cpp
// draw an entity and all of its children - only those inside the frustum; count the drawn (display) and all (total) entities
void drawSelfAndChild(Entity& entity, const Frustum& frustum, Shader& ourShader, unsigned int& display, unsigned int& total)
{
    if (isOnFrustum(entity.boundingVolume, frustum, entity.transform))
    {
        ourShader.setMat4("model", entity.transform.modelMatrix);
        entity.pModel->Draw(ourShader);
        display++;
    }
    total++;

    for (Entity& child : entity.children)
    {
        drawSelfAndChild(child, frustum, ourShader, display, total);
    }
}
```

I renderingsloopen, efter vy och projektion:

```cpp
        const Frustum camFrustum = createFrustumFromCamera(cameraPos, cameraFront, cameraUp, (float)SCR_WIDTH / (float)SCR_HEIGHT, glm::radians(fov), 0.1f, 15.0f);

        unsigned int total = 0, display = 0;
        drawSelfAndChild(ourEntity, camFrustum, ourShader, display, total);

        std::string title = "LearnOpenGL - drawn: " + std::to_string(display) + " / " + std::to_string(total);
        glfwSetWindowTitle(window, title.c_str());
```

(`#include <string>` för `std::to_string`.)
:::
:::vulkan
En bortsorterad entitet spelas helt enkelt inte in: ingen push constant, ingen ritning i command buffern.

```cpp
void drawSelfAndChild(Entity& entity, const Frustum& frustum, VkCommandBuffer commandBuffer, VkPipelineLayout pipelineLayout, unsigned int& display, unsigned int& total) {
    if (isOnFrustum(entity.boundingVolume, frustum, entity.transform)) {
        PushConstants constants{};
        constants.model = entity.transform.modelMatrix;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        Draw(*entity.pModel, commandBuffer);
        display++;
    }
    total++;

    for (Entity& child : entity.children) {
        drawSelfAndChild(child, frustum, commandBuffer, pipelineLayout, display, total);
    }
}
```

Frustumet och räknarna finns i `recordCommandBuffer()`, som körs varje bildruta:

```cpp
        const Frustum camFrustum = createFrustumFromCamera(cameraPos, cameraFront, cameraUp, swapChainExtent.width / (float) swapChainExtent.height, glm::radians(fov), 0.1f, 15.0f);

        unsigned int total = 0, display = 0;
        drawSelfAndChild(ourEntity, camFrustum, commandBuffer, pipelineLayout, display, total);

        std::string title = "Vulkan - drawn: " + std::to_string(display) + " / " + std::to_string(total);
        glfwSetWindowTitle(window, title.c_str());
```

(`#include <string>` för `std::to_string`.)
:::
:::d3d12
En bortsorterad entitet spelas helt enkelt inte in: inga root constants, ingen ritning i command listen.

```cpp
void drawSelfAndChild(Entity& entity, const Frustum& frustum, ID3D12GraphicsCommandList* commandList, unsigned int& display, unsigned int& total)
{
    if (isOnFrustum(entity.boundingVolume, frustum, entity.transform))
    {
        ModelConstants modelConstants = {};
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(XMLoadFloat4x4(&entity.transform.modelMatrix)));
        commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        entity.pModel->Draw(commandList);
        display++;
    }
    total++;

    for (Entity& child : entity.children)
    {
        drawSelfAndChild(child, frustum, commandList, display, total);
    }
}
```

I `PopulateCommandList` byggs frustumet, grafen ritas, och antalen läggs i fönstrets titel med Win32-funktionen
`SetWindowTextW`:

```cpp
    const Frustum camFrustum = createFrustumFromCamera(cameraPos, cameraFront, cameraUp, static_cast<float>(m_width) / static_cast<float>(m_height), XMConvertToRadians(fov), 0.1f, 15.0f);
```

```cpp
    // show how many entities were drawn in the window's title
    std::wstring title = L"LearnDirectX - drawn: " + std::to_wstring(display) + L" / " + std::to_wstring(total);
    SetWindowTextW(m_hwnd, title.c_str());
```

med `unsigned int total = 0, display = 0;` och `drawSelfAndChild(m_ourEntity, camFrustum, m_commandList.Get(), display,
total);` mellan dem.
:::

Gör nu den fjärde uppgiften, **cull**. Bygg och kör: rutnätets bakre del är borta. Vid 2.0 s står det **8 / 101** i
titeln: bara åtta planeter ritas, roten och de närmaste, vars avgränsningssfärer når närmare än 15 enheter – bland dem en
planet vars mittpunkt ligger 16 enheter bort men vars sfär ändå sticker in innanför det bortre planet. Planeterna 17, 20
eller 42 enheter bort sorteras bort, fast projektionen skulle ha visat dem. Scenen är animerad, så antalen ändras med tiden: vid
1.0 s står det 10 / 101 här – siffrorna i kapitlet är de vid 2.0 s, den tid som uppgiftskontrollerna tittar på.

```quiz
`drawSelfAndChild` besöker en entitets barn även när entiteten själv sorteras bort. Varför?
- [ ] För att barnens avgränsningsvolymer lagras i föräldern
- [ ] För att en bortsorterad entitets modellmatris inte är aktuell
- [x] För att en planets avgränsningssfär bara omsluter dess egen modell, inte dess barn 5 enheter bort – en bortsorterad förälder säger ingenting om var dess barn finns
- [ ] För att GPU:n behöver varje draw-anrop för att hålla barnens ordning
---
Bara en avgränsningsvolym som omsluter hela delträdet skulle tillåta att delträdet hoppas över – en hierarkisk avgränsningsvolym. learnopengls entiteter har ingen sådan, så varje entitet testas för sig.
```

## Kamerans eget frustum

Det bortre planet på 15 fanns bara där för att göra cullingen synlig. Cullingfrustumet ska vara precis det som
projektionen visar: samma synfält, bildförhållande, nära och bortre plan.

:::opengl
Ändra det sista argumentet till `createFrustumFromCamera` från `15.0f` till `100.0f`.
:::
:::vulkan
Ändra det sista argumentet till `createFrustumFromCamera` från `15.0f` till `100.0f`.
:::
:::d3d12
Ändra det sista argumentet till `createFrustumFromCamera` från `15.0f` till `100.0f`.
:::

Gör nu den femte uppgiften, **camera-frustum**. Bygg och kör: bilden är rutnätets bild igen, pixel för pixel – varje
planet på skärmen ritas – men titeln säger **37 / 101**. Nästan två tredjedelar av planeterna ligger bredvid eller bakom
kameran, och ingen av dem ritas längre. Allt du ser finns kvar; bara det osynliga arbetet är borta.

## AABB

En sfär sitter löst kring många former. Kursens planet är platt: ett klot med en bred ring, ungefär dubbelt så bred som
den är hög. Dess avgränsningssfär är lika hög som den är bred, mest tomrum. learnopengls artikel erbjuder en andra
avgränsningsvolym, den **axelparallella avgränsningslådan** (axis-aligned bounding box, AABB): en mittpunkt och tre
halva storlekar, *extents*. I modellens eget rum sitter den mycket tätare kring planeten med ringar.

`generateAABB` hittar samma låda som `generateSphereBV`, men behåller den: `center = (max + min) * 0.5` och `extents = max
− center`. Testet mot ett plan projicerar lådan på planets normal: lådans "radie" i normalens riktning är summan av dess
extents, var och en viktad med hur mycket normalen pekar längs den axeln:

:::opengl
```cpp
// see https://gdbooks.gitbooks.io/3dcollisions/content/Chapter2/static_aabb_plane.html
bool isOnOrForwardPlane(const AABB& aabb, const Plane& plane)
{
    // compute the projection interval radius of the box onto the plane's normal
    const float r = aabb.extents.x * std::abs(plane.normal.x) + aabb.extents.y * std::abs(plane.normal.y) +
        aabb.extents.z * std::abs(plane.normal.z);

    return -r <= getSignedDistanceToPlane(plane, aabb.center);
}
```
:::
:::vulkan
```cpp
// see https://gdbooks.gitbooks.io/3dcollisions/content/Chapter2/static_aabb_plane.html
bool isOnOrForwardPlane(const AABB& aabb, const Plane& plane) {
    // compute the projection interval radius of the box onto the plane's normal
    const float r = aabb.extents.x * std::abs(plane.normal.x) + aabb.extents.y * std::abs(plane.normal.y) +
        aabb.extents.z * std::abs(plane.normal.z);

    return -r <= getSignedDistanceToPlane(plane, aabb.center);
}
```
:::
:::d3d12
`isOnOrForwardPlane(const AABB& aabb, const Plane& plane)` räknar ut samma radie med `fabsf` ur `XMFLOAT3`:orna, `r =
aabb.extents.x * fabsf(plane.normal.x) + aabb.extents.y * fabsf(plane.normal.y) + aabb.extents.z *
fabsf(plane.normal.z)`, och returnerar `-r <= getSignedDistanceToPlane(plane, XMLoadFloat3(&aabb.center))`.
:::

Det fungerar för en låda vars sidor är parallella med världens axlar. Men modellmatrisen vrider lådan med entiteten –
rutnätet är vridet 40° – och en vriden låda är inte längre axelparallell. learnopengls `isOnFrustum` bygger därför en ny
axelparallell låda i världsrummet som omsluter den vridna: den tar lådans tre halva axlar efter modellmatrisen (varje
kolumn i matrisen gånger dess extent) och lägger för varje världsaxel ihop hur långt de tre halva axlarna når längs den:

:::opengl
```cpp
    // get global center thanks to our transform
    const glm::vec3 globalCenter = glm::vec3(transform.modelMatrix * glm::vec4(aabb.center, 1.0f));

    // scaled orientation: the box's three half axes in world space
    const glm::vec3 right = glm::vec3(transform.modelMatrix[0]) * aabb.extents.x;
    const glm::vec3 up = glm::vec3(transform.modelMatrix[1]) * aabb.extents.y;
    const glm::vec3 forward = -glm::vec3(transform.modelMatrix[2]) * aabb.extents.z;

    // the half sizes of the world-space axis-aligned box around the turned box
    const float newIi = std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), right)) +
        std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), up)) +
        std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), forward));
```

`newIj` och `newIk` gör detsamma med y- och z-axeln; den nya lådan (`globalAABB`, mittpunkt `globalCenter`, extents
`(newIi, newIj, newIk)`) testas mot de sex planen som sfären gjordes.
:::
:::vulkan
```cpp
    // get global center thanks to our transform
    const glm::vec3 globalCenter = glm::vec3(transform.modelMatrix * glm::vec4(aabb.center, 1.0f));

    // scaled orientation: the box's three half axes in world space
    const glm::vec3 right = glm::vec3(transform.modelMatrix[0]) * aabb.extents.x;
    const glm::vec3 up = glm::vec3(transform.modelMatrix[1]) * aabb.extents.y;
    const glm::vec3 forward = -glm::vec3(transform.modelMatrix[2]) * aabb.extents.z;

    // the half sizes of the world-space axis-aligned box around the turned box
    const float newIi = std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), right)) +
        std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), up)) +
        std::abs(glm::dot(glm::vec3(1.0f, 0.0f, 0.0f), forward));
```

`newIj` och `newIk` gör detsamma med y- och z-axeln; den nya lådan (`globalAABB`, mittpunkt `globalCenter`, extents
`(newIi, newIj, newIk)`) testas mot de sex planen som sfären gjordes.
:::
:::d3d12
De halva axlarna är modellmatrisens rader:

```cpp
    // scaled orientation: the box's three half axes in world space (the model matrix's rows)
    const XMVECTOR right = modelMatrix.r[0] * aabb.extents.x;
    const XMVECTOR up = modelMatrix.r[1] * aabb.extents.y;
    const XMVECTOR forward = -modelMatrix.r[2] * aabb.extents.z;

    // the half sizes of the world-space axis-aligned box around the turned box
    const XMVECTOR unitX = XMVectorSet(1.0f, 0.0f, 0.0f, 0.0f);
    const XMVECTOR unitY = XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f);
    const XMVECTOR unitZ = XMVectorSet(0.0f, 0.0f, 1.0f, 0.0f);
    const float newIi = fabsf(XMVectorGetX(XMVector3Dot(unitX, right))) +
        fabsf(XMVectorGetX(XMVector3Dot(unitX, up))) +
        fabsf(XMVectorGetX(XMVector3Dot(unitX, forward)));
```

`newIj` och `newIk` gör detsamma med `unitY` och `unitZ`; den nya lådan (mittpunkt `XMVector3Transform(center,
modelMatrix)`, extents `(newIi, newIj, newIk)`) testas mot de sex planen som sfären gjordes.
:::

(`forward` negeras i learnopengls kod; med `abs` spelar tecknet ingen roll.) Entitetens avgränsningsvolym blir en `AABB
boundingVolume;`, skapad med `generateAABB` i `addChild` och för roten.

Gör nu den sista uppgiften, **aabb**. Bygg och kör: bilden är densamma, och titeln säger **38 / 101** – *en mer* än med
sfärer. Lådan skulle ju vara tätare. Det är den, i modellens rum; men rutnätet är vridet 40°, och den axelparallella lådan
runt en vriden låda är större än själva lådan. För en planet strax utanför bilden sticker den större lådan in i frustumet
där sfären inte gjorde det. Det är poängen i learnopengls artikel om AABB:er: de sitter tätt kring objekt som håller sig
parallella med axlarna, och de förlorar den fördelen – ibland till sfären – när objekten vrids. En *orienterad*
avgränsningslåda (OBB), testad i lådans egna axlar, behåller den täta passformen till ett högre pris per test.

```quiz
Varför kan det vridna rutnätet få AABB-testet att rita fler planeter än sfärtestet?
- [ ] För att AABB:n räknas ut ur färre vertexar än sfären
- [x] För att testet använder lådan längs världsaxlarna runt den vridna lådan, som är större än själva lådan och kan nå in i frustumet där sfären inte gör det
- [ ] För att en AABB alltid är större än sfären runt samma modell
- [ ] För att frustumets plan vrids med rutnätet
---
I modellrummet sitter lådan tätare än sfären kring den platta planeten med ringar. Vriden 40° växer lådan som omsluter den längs världsaxlarna, och för en planet strax utanför bilden gör det skillnaden.
```

## Vad culling sparar – och vad den inte sparar

Frustum culling sparar arbete på båda sidor: CPU:n spelar in och skickar färre draw-anrop (och i en riktig motor sätter
den färre tillstånd och laddar upp färre konstanter), och GPU:n kör färre vertexar genom vertex shadern och klipper färre
trianglar. I den här scenen hoppas 64 av 101 planeter över i ögonblicket för skärmbilden. Cullingen kostar några
skalärprodukter per entitet och bildruta – långt mindre än att rita entiteten.

Det den *inte* sparar:

- **Overdraw.** En planet som skyms av en annan planet ligger innanför frustumet och ritas; djuptestet kastar dess
  fragment, men de har rastrerats. Frustum culling vet ingenting om skymning.
- **Pixlar.** Planeterna i bild kostar exakt lika mycket som förut.
- **Osynliga delar av synliga objekt.** En modell som syns delvis ritas hel; GPU:ns klippning tar hand om resten.

Riktiga renderare lägger till mer: **occlusion culling** hoppar över objekt som skyms av andra (med hårdvarans occlusion
queries, en hierarkisk djupbuffer från förra bildrutan eller mjukvarurastrering av stora skymmande objekt); **rumsliga
strukturer** – hierarkier av avgränsningsvolymer (BVH), octrees, rutnät – testar hela grupper av objekt på en gång, så att
en scen med hundra tusen objekt inte behöver hundra tusen test; och **GPU-driven culling** flyttar testen till en compute
shader som skriver ritkommandona för indirekt ritning, så att CPU:n aldrig ens ser de bortsorterade objekten. Alla bygger
på kapitlets två idéer: ett frustum av plan och en avgränsningsvolym som är billig att testa.

## Mer att läsa

- [Frustum Culling](https://learnopengl.com/Guest-Articles/2021/Scene/Frustum-Culling): learnopengls gästartikel som
  det här kapitlet följer, med bilder av frustumets plan.
- [frustum_culling.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2021/1.scene/2.frustum_culling/frustum_culling.cpp):
  learnopengls demo; `Plane`, `Frustum`, `Sphere`, `AABB` och den cullande `drawSelfAndChild` finns i
  `includes/learnopengl/entity.h`.
- [std::numeric_limits::lowest](https://en.cppreference.com/w/cpp/types/numeric_limits/lowest): det mest negativa
  flyttalet – till skillnad från `min()`, som är det minsta positiva.

:::opengl
- [glfwSetWindowTitle](https://www.glfw.org/docs/latest/group__window.html): GLFW:s fönsterfunktioner, med titeln som
  antalen hamnar i.
:::
:::vulkan
- [glfwSetWindowTitle](https://www.glfw.org/docs/latest/group__window.html): GLFW:s fönsterfunktioner, med titeln som
  antalen hamnar i.
:::
:::d3d12
- [SetWindowTextW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowtextw):
  Win32-funktionen som sätter fönstrets titel.
- [DirectXMath programming guide](https://learn.microsoft.com/en-us/windows/win32/dxmath/directxmath-portal): `XMVECTOR`,
  `XMVector3Dot`, `XMVectorMin` / `XMVectorMax` och matriserna med radvektorer.
:::
