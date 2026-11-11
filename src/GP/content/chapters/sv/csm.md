# Kaskaderade skuggkartor

I kapitlet *Shadow mapping* gav en enda djupkarta, renderad från ljuset, en liten scen dess skuggor. Ljusets ortografiska
projektion var en låda på 20 × 20 enheter runt scenen, och skuggkartan på 1024 × 1024 fördelade sina texlar över den
lådan. Det fungerar så länge scenen är liten. Ta i stället ett landskap sett med en människas ögon: blicken når hundratals
enheter bort, och skuggkartan skulle behöva täcka alltihop. Fördela 1024 texlar över 500 enheter så täcker varje texel en
halv enhet mark – och precis framför kameran, där en halv enhet fyller en stor del av skärmen, blir skuggorna grova,
taggiga block.

Problemet har ett namn: *perspektivaliasing*. En perspektivkamera visar nära saker stora och avlägsna små, men en
skuggkarta fördelar sina texlar jämnt. Nära kameran finns för få texlar per pixel, långt bort alldeles för många.
*Kaskaderade skuggkartor* (cascaded shadow mapping, CSM) svarar med flera skuggkartor: dela kamerans synfrustum på djupet
i några skivor – *kaskader* – och ge varje skiva en egen skuggkarta som bara täcker den skivan, tätt. De nära skivorna är
korta, så deras skuggkartor blir skarpa; de avlägsna är långa, men långt bort täcker en texel färre pixlar, så de grövre
kartorna räcker där.

Kapitlet följer learnopengls gästartikel *Cascaded Shadow Mapping*. Det bygger på kapitlet *Shadow mapping* – djupkartan,
transformen till ljusets rum, bias och PCF – och på kapitlet *Punktskuggor*, vars geometry shader renderade alla sidor av
en cube map i ett enda pass; här renderar samma knep alla kaskader i ett pass. Precis som de kapitlen fungerar det på
samma sätt i alla API:er, och kapitlet visar var {{api}} lägger varje del.

## Projektet

Scenen är learnopengls: ett trägolv på 50 × 50 enheter vid y = -2 och tio trälådor som svävar ovanför det, belysta av ett
riktat ljus som solen, `lightDir = normalize(20, 50, 20)` (riktningen mot ljuset). learnopengl placerar sina lådor med en
slumpgenerator, så dess scen ändras vid varje körning; kursen anger tio fasta placeringar – position, rotation kring axeln
(1, 0, 1) och skala – så att bilderna kan jämföras. Kameran står i (0, 3, 17) och tittar 15° nedåt längs -z, med
learnopengls nära och bortre plan på **0.1 och 500**: blicken når långt bortom golvets bortre kant 25 enheter bort.
Belysningen är Blinn-Phong från kapitlet *Shadow mapping* med det ambienta ljuset `0.3 * lightColor` (learnopengls
CSM-shader multiplicerar det ambienta med träfärgen två gånger – kursen behåller det tidigare kapitlets variant).

:::opengl
Programmet begär en OpenGL **4.1** core-kontext, learnopengls val för den här demon, och alla shaders börjar med
`#version 410 core`. Djuppassets geometry shader körs en gång per kaskad med `layout (triangles, invocations = 5) in;` –
*geometry shader instancing*, core sedan OpenGL 4.0. 4.1 är också den högsta version macOS erbjuder, så kapitlet fungerar
även där. `shader_m.h` är kursens `Shader`-klass med den valfria geometry shadern, som i *Punktskuggor*.
:::
:::vulkan
Projektet bygger på Vulkan-projektet från *Shadow mapping*: dess render pass med bara djup (`depthMapRenderPass`),
hjälpfunktionen `createPipeline` – här med en valfri fil för geometry shadern, som i *Punktskuggor* –, `renderScene()`
och felsökningsfyrhörningen som visar skuggkartan. Scenens data per bildruta ligger i en uniform buffer på bindning 0,
trätexturen på bindning 1.
:::
:::d3d12
Projektet bygger på Direct3D 12-projektet från *Shadow mapping*: `RenderScene()` ritar golvet och lådorna och anropas av
båda passen, `m_depthPipelineState` renderar bara djup (ingen pixel shader, inget render target), och
`m_debugQuadPipelineState` visar skuggkartan på en skärmfyrhörning. Scenens data per bildruta ligger i en constant buffer;
lådornas placeringar är learnopengls translate · rotate · scale i DirectXMaths radvektorordning,
`XMMatrixScaling(…) * XMMatrixRotationAxis(…) * XMMatrixTranslation(…)`.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Tryck på **Build & run** (Ctrl+Enter) för att kompilera
och köra det i den inbyggda simulatorn: det belysta golvet och lådorna – ännu helt utan skuggor.

## Att dela upp frustumet

Det första beslutet är var synvolymen ska delas. learnopengl använder fyra delningsavstånd, bråkdelar av det bortre
planet:

```text
shadowCascadeLevels = { far / 50, far / 25, far / 10, far / 2 }  =  { 10, 20, 50, 250 }   (far = 500)
```

Fyra delningar ger **fem kaskader**: 0.1 – 10, 10 – 20, 20 – 50, 50 – 250 och 250 – 500 enheter från kameran. Var och en
är längre än den förra, ungefär i proportion till sitt avstånd – vilket är vad perspektivaliasingen kräver, eftersom en
pixels fotavtryck växer med avståndet. Riktiga motorer väljer ofta delningarna med en formel mellan en jämn (linjär) och
en logaritmisk fördelning; learnopengls fasta bråkdelar är lätta att läsa och fungerar för den här scenen.

```quiz
Med learnopengls delningsavstånd 10, 20, 50 och 250 – vilken kaskad hör ett fragment 30 enheter framför kameran till?
- [ ] Kaskad 1 (10–20)
- [x] Kaskad 2 (20–50)
- [ ] Kaskad 3 (50–250)
- [ ] Kaskad 0: den första kaskaden täcker allt fram till den första delningen bortom fragmentet
---
Kaskaderna numreras från 0: 0.1–10, 10–20, 20–50, 50–250, 250–500. Fragment shadern väljer den första kaskad vars bortre avstånd ligger bortom fragmentets djup – här 50.
```

### En kaskads hörn

För varje kaskad behöver vi en ljusrumsmatris – en ljusvy och en ortografisk projektion – vars låda omsluter just den
skivan av kamerans frustum och inget mer. Skivan är själv ett frustum: kamerans projektion med kaskadens nära och bortre
avstånd. Dess åtta hörn hittar man enklast från andra hållet. I normaliserade enhetskoordinater är varje frustum en låda
med hörnen i x, y = ±1 och z i den nära och den bortre änden. Transformera de åtta hörnen med *inversen* av projektion ·
vy, dividera med w, och du får frustumets hörn i världsrummet.

:::opengl
I OpenGL går lådans z från -1 till 1, så hörnen är `(2x − 1, 2y − 1, 2z − 1)` för x, y, z ∈ {0, 1}:

```cpp
std::vector<glm::vec4> getFrustumCornersWorldSpace(const glm::mat4& projview)
{
    const glm::mat4 inv = glm::inverse(projview);

    std::vector<glm::vec4> frustumCorners;
    for (unsigned int x = 0; x < 2; ++x)
    {
        for (unsigned int y = 0; y < 2; ++y)
        {
            for (unsigned int z = 0; z < 2; ++z)
            {
                const glm::vec4 pt = inv * glm::vec4(2.0f * x - 1.0f, 2.0f * y - 1.0f, 2.0f * z - 1.0f, 1.0f);
                frustumCorners.push_back(pt / pt.w);
            }
        }
    }

    return frustumCorners;
}
```

med en överlagring `getFrustumCornersWorldSpace(proj, view)` som skickar vidare `proj * view`.

```quiz
Varför transformerar `getFrustumCornersWorldSpace` punkterna (±1, ±1, ±1) med inversen av projektion · vy?
- [ ] För att den inversa matrisen gör om ett perspektivfrustum till en låda
- [ ] För att skuggkartan behöver normaliserade enhetskoordinater
- [x] För att varje synfrustum är lådan från -1 till 1 i OpenGL:s normaliserade enhetskoordinater; tillbaka genom inversen (och med division med w) får man frustumets hörn i världsrummet
- [ ] För att ljusets ortografiska projektion vill ha sin indata i clip space
---
Projektion · vy tar världsrummet till clip space; efter divisionen med w fyller frustumet kuben [-1, 1]³. Inversen tar kubens hörn tillbaka till världsrummet – med divisionen med w, eftersom projektionen är perspektivisk.
```
:::
:::vulkan
Här skiljer sig Vulkan från learnopengls kod. Med `GLM_FORCE_DEPTH_ZERO_TO_ONE` avbildar projektionen djupet på **0..1**,
så lådan i normaliserade enhetskoordinater har z från 0 till 1, inte från -1 till 1. Hörnen blir därför `(2x − 1, 2y −
1, z)`:

```cpp
// the 8 corners of a frustum in world space: the corners of Vulkan's normalized device coordinates box (x and y from
// -1 to 1, z from 0 to 1 - GLM_FORCE_DEPTH_ZERO_TO_ONE; learnopengl's OpenGL box has z from -1 to 1) through the
// inverse of projection * view
std::vector<glm::vec4> getFrustumCornersWorldSpace(const glm::mat4& projview) {
    const glm::mat4 inv = glm::inverse(projview);

    std::vector<glm::vec4> frustumCorners;
    for (unsigned int x = 0; x < 2; ++x) {
        for (unsigned int y = 0; y < 2; ++y) {
            for (unsigned int z = 0; z < 2; ++z) {
                const glm::vec4 pt = inv * glm::vec4(2.0f * x - 1.0f, 2.0f * y - 1.0f, (float)z, 1.0f);
                frustumCorners.push_back(pt / pt.w);
            }
        }
    }

    return frustumCorners;
}
```

Med learnopengls `2.0f * z - 1.0f` skulle z = -1 ligga *framför* Vulkans nära plan: de nära hörnen skulle hamna för nära
kameran (kaskad 1 skulle börja vid 6.7 i stället för 10), och varje kaskads låda skulle växa. Projektionen här är en ny
`glm::perspective` för kaskaden; den är inte vänd i y, men vändningen skulle inte spela någon roll – de åtta hörnen är
samma mängd i båda fallen.

```quiz
Varför använder Vulkan-projektet `(float)z` i stället för learnopengls `2.0f * z - 1.0f` för hörnens djup?
- [x] För att det nära och det bortre planet med `GLM_FORCE_DEPTH_ZERO_TO_ONE` ligger på djupet 0 och 1 i normaliserade enhetskoordinater, inte -1 och 1
- [ ] För att Vulkans y-axel pekar nedåt
- [ ] För att Vulkans skuggkartor lagrar djupet som heltal
- [ ] För att hörnen måste ligga i ljusets rum, inte i världsrummet
---
z = -1 är en punkt framför det nära planet i en projektion med 0..1, så learnopengls formel skulle få varje kaskad att börja för nära kameran och dess ljuslåda att bli för stor.
```
:::
:::d3d12
Här skiljer sig Direct3D från learnopengls kod. `XMMatrixPerspectiveFovRH` avbildar djupet på **0..1**, så lådan i
normaliserade enhetskoordinater har z från 0 till 1, inte från -1 till 1. Hörnen blir därför `(2x − 1, 2y − 1, z)`,
transformerade med inversen av vy · projektion (radvektorer: vyn först):

```cpp
std::vector<XMFLOAT4> getFrustumCornersWorldSpace(const XMMATRIX& projview)
{
    const XMMATRIX inv = XMMatrixInverse(nullptr, projview);

    std::vector<XMFLOAT4> frustumCorners;
    for (unsigned int x = 0; x < 2; ++x)
    {
        for (unsigned int y = 0; y < 2; ++y)
        {
            for (unsigned int z = 0; z < 2; ++z)
            {
                const XMVECTOR pt = XMVector4Transform(XMVectorSet(2.0f * x - 1.0f, 2.0f * y - 1.0f, static_cast<float>(z), 1.0f), inv);
                XMFLOAT4 corner;
                XMStoreFloat4(&corner, pt / XMVectorSplatW(pt));
                frustumCorners.push_back(corner);
            }
        }
    }

    return frustumCorners;
}
```

Med learnopengls `2.0f * z - 1.0f` skulle z = -1 ligga *framför* Direct3D:s nära plan, och varje kaskads låda skulle
växa. I containrar håller man DirectXMath-värden som lagringstyper (`std::vector<XMFLOAT4>`): en `XMVECTOR` i en
`std::vector` är inte portabel.

```quiz
Varför använder Direct3D-projektet `static_cast<float>(z)` i stället för learnopengls `2.0f * z - 1.0f` för hörnens djup?
- [ ] För att Direct3D:s y-axel pekar nedåt i texturrummet
- [ ] För att DirectXMath använder radvektorer
- [ ] För att hörnen måste ligga i ljusets rum, inte i världsrummet
- [x] För att `XMMatrixPerspectiveFovRH` lägger det nära och det bortre planet på djupet 0 och 1 i normaliserade enhetskoordinater, inte -1 och 1
---
z = -1 är en punkt framför det nära planet i en projektion med 0..1, så learnopengls formel skulle få varje kaskad att börja för nära kameran och dess ljuslåda att bli för stor.
```
:::

### En tät ljuslåda

Nu ljuset. Ett riktat ljus har ingen position, bara en riktning, så vi får placera dess vy där det passar oss:
learnopengl lägger den i mittpunkten av de åtta hörnen, tittande mot mittpunkten längs `-lightDir`:

```cpp
    const glm::mat4 lightView = glm::lookAt(center + lightDir, center, glm::vec3(0.0f, 1.0f, 0.0f));
```

I den här ljusvyn behöver den ortografiska lådan bara omsluta de åtta hörnen: det minsta och största x, y och z för hörnen
transformerade till ljusets rum. För x och y räcker exakt det. z behöver mer utrymme. Allt *mellan ljuset och kaskaden*
kan kasta skugga in i den – en låda som svävar ovanför kamerans synfält, ett berg bakom den – fast det ligger utanför
kamerans frustum. Om ljusets låda slutade vid hörnen skulle de objekten klippas bort i djuppasset och deras skuggor
försvinna. learnopengl sträcker därför ut z-intervallet med en faktor, `zMult = 10`, som enligt artikeln måste ställas in
efter scenen; projektionen blir sedan `glm::ortho(minX, maxX, minY, maxY, minZ, maxZ)`.

:::opengl
```cpp
// the light-space matrix of the part of the camera's frustum between nearPlane and farPlane
glm::mat4 getLightSpaceMatrix(const float nearPlane, const float farPlane)
{
    const glm::mat4 proj = glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, nearPlane, farPlane);
    const glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
    const std::vector<glm::vec4> corners = getFrustumCornersWorldSpace(proj, view);

    glm::vec3 center = glm::vec3(0, 0, 0);
    for (const glm::vec4& v : corners)
    {
        center += glm::vec3(v);
    }
    center /= corners.size();

    const glm::mat4 lightView = glm::lookAt(center + lightDir, center, glm::vec3(0.0f, 1.0f, 0.0f));

    float minX = std::numeric_limits<float>::max();
    float maxX = std::numeric_limits<float>::lowest();
    float minY = std::numeric_limits<float>::max();
    float maxY = std::numeric_limits<float>::lowest();
    float minZ = std::numeric_limits<float>::max();
    float maxZ = std::numeric_limits<float>::lowest();
    for (const glm::vec4& v : corners)
    {
        const glm::vec4 trf = lightView * v;
        minX = std::min(minX, trf.x);
        maxX = std::max(maxX, trf.x);
        minY = std::min(minY, trf.y);
        maxY = std::max(maxY, trf.y);
        minZ = std::min(minZ, trf.z);
        maxZ = std::max(maxZ, trf.z);
    }

    // Tune this parameter according to the scene
    constexpr float zMult = 10.0f;
    if (minZ < 0)
    {
        minZ *= zMult;
    }
    else
    {
        minZ /= zMult;
    }
    if (maxZ < 0)
    {
        maxZ /= zMult;
    }
    else
    {
        maxZ *= zMult;
    }

    const glm::mat4 lightProjection = glm::ortho(minX, maxX, minY, maxY, minZ, maxZ);
    return lightProjection * lightView;
}
```

Kursen använder kamerans globala variabler (`fov`, `cameraPos`, `cameraFront`, `cameraUp`) där learnopengl använder sin
klass `Camera`.
:::
:::vulkan
`getLightSpaceMatrix(nearPlane, farPlane)` är learnopengls GLM-kod med kamerans globala variabler: hörnen för
`glm::perspective(glm::radians(fov), …, nearPlane, farPlane)` och kamerans vy, deras mittpunkt, ljusvyn
`glm::lookAt(center + lightDir, center, glm::vec3(0.0f, 1.0f, 0.0f))`, minimum och maximum i ljusets rum, det utsträckta
z-intervallet och `glm::ortho(minX, maxX, minY, maxY, minZ, maxZ)`. Med `GLM_FORCE_DEPTH_ZERO_TO_ONE` avbildar
`glm::ortho` ljusets z-intervall på 0..1 – det djupintervall Vulkan lagrar – där OpenGL avbildar det på -1..1 och sedan på
fönsterdjupet 0..1. Skuggkartorna innehåller alltså exakt samma djupvärden i båda API:erna.
:::
:::d3d12
`getLightSpaceMatrix(nearPlane, farPlane)` och `getLightSpaceMatrices()` är metoder i `D3D12App` (de behöver `m_width`
/ `m_height` för bildförhållandet); matematiken är learnopengls, med `fminf` / `fmaxf` och `FLT_MAX` (makrona `min` /
`max` i `<windows.h>` krockar med `std::min` / `std::max`). Den enda verkliga skillnaden är ljusets projektion:
`XMMatrixOrthographicOffCenterRH` avbildar samma låda på Direct3D:s djup 0..1 där `glm::ortho` avbildar den på -1..1
(som OpenGL sedan gör om till fönsterdjupet 0..1) – så djupet som lagras i skuggkartorna är samma tal i båda API:erna:

```cpp
    // learnopengl's glm::ortho(minX, maxX, minY, maxY, minZ, maxZ): the same box, with
    // Direct3D's depth from 0 to 1
    const XMMATRIX lightProjection = XMMatrixOrthographicOffCenterRH(minX, maxX, minY, maxY, minZ, maxZ);
    XMFLOAT4X4 lightSpaceMatrix;
    XMStoreFloat4x4(&lightSpaceMatrix, lightView * lightProjection);    // row vectors: the view first, then the projection
    return lightSpaceMatrix;
```
:::

`getLightSpaceMatrices()` anropar den en gång per kaskad – kamerans nära plan till första delningen, delning till
delning, sista delningen till kamerans bortre plan – och returnerar de fem matriserna. De beror på kameran, så de räknas
om **varje bildruta**: flytta kameran så följer kaskaderna med. (I det här projektet står kameran still, men koden är
redo för en som inte gör det.)

```quiz
Varför sträcker `getLightSpaceMatrix` ut ljuslådans z-intervall med `zMult` i stället för att passa in det tätt kring kaskadens hörn?
- [ ] För att göra djupvärdena mer exakta
- [ ] För att en ortografisk projektion behöver ett nära plan i 0
- [ ] För att täcka nästa kaskad också, så att kaskaderna överlappar
- [x] För att objekt mellan ljuset och kaskaden – utanför kamerans frustum – kan kasta skuggor in i den, och en tät låda skulle klippa bort dem i djuppasset
---
x och y behöver bara täcka det kameran ser av kaskaden. Längs ljusets riktning måste allt som kan kasta skugga på den delen också finnas i djupkartan. learnopengls faktor 10 är ett inställningsvärde för dess scen; ett tätare sätt är att passa in z-intervallet efter scenens gränser.
```

### Matriserna i en uniform buffer

Båda passen behöver alla fem matriserna: djuppasset för att rendera varje kaskad, scenpasset för att slå upp rätt matris.
learnopengl håller dem i en uniform buffer – `layout (std140) uniform LightSpaceMatrices { mat4 lightSpaceMatrices[16];
};`, plats för upp till 16 kaskader – och fyller den varje bildruta.

:::opengl
```cpp
    unsigned int matricesUBO;
    glGenBuffers(1, &matricesUBO);
    glBindBuffer(GL_UNIFORM_BUFFER, matricesUBO);
    glBufferData(GL_UNIFORM_BUFFER, sizeof(glm::mat4x4) * 16, nullptr, GL_STATIC_DRAW);
    glBindBufferBase(GL_UNIFORM_BUFFER, 0, matricesUBO);
    glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

och i början av varje bildruta:

```cpp
        // 0. UBO setup: the light-space matrices of this frame's cascades
        const std::vector<glm::mat4> lightMatrices = getLightSpaceMatrices();
        glBindBuffer(GL_UNIFORM_BUFFER, matricesUBO);
        for (size_t i = 0; i < lightMatrices.size(); ++i)
        {
            glBufferSubData(GL_UNIFORM_BUFFER, i * sizeof(glm::mat4x4), sizeof(glm::mat4x4), &lightMatrices[i]);
        }
        glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

Buffern är bunden till bindningspunkt 0. Ingen av shaderna anropar `glUniformBlockBinding` för sitt block: ett
uniform-blocks bindning är 0 som standard, så båda blocken läser bindningspunkt 0 – det förlitar sig learnopengl också på.
(`GL_STATIC_DRAW` är bara en ledtråd; för en buffer som skrivs om varje bildruta vore `GL_DYNAMIC_DRAW` ärligare.)
:::
:::vulkan
learnopengls andra uniform buffer blir en andra buffer i descriptor setet: `struct LightSpaceMatrices { glm::mat4
lightSpaceMatrices[16]; };` i en egen, ständigt mappad buffer, `lightMatricesBuffer`, på **bindning 2**, synlig för
geometry- och fragment-steget. `updateUniformBuffer()` fyller den varje bildruta:

```cpp
        // 0. UBO setup: the light-space matrices of this frame's cascades
        const std::vector<glm::mat4> lightMatrices = getLightSpaceMatrices();
        LightSpaceMatrices matrices{};
        for (size_t i = 0; i < lightMatrices.size(); ++i) {
            matrices.lightSpaceMatrices[i] = lightMatrices[i];
        }
        memcpy(lightMatricesBufferMapped, &matrices, sizeof(matrices));
```

Shaderna deklarerar learnopengls block med en bindning: `layout(binding = 2) uniform LightSpaceMatrices { mat4
lightSpaceMatrices[16]; };`.
:::
:::d3d12
learnopengls andra uniform buffer blir en andra constant buffer: `struct LightSpaceMatrices { XMFLOAT4X4
lightSpaceMatrices[16]; }` (1024 byte), ständigt mappad och fylld varje bildruta i `OnUpdate` – transponerad, som varje
matris kursen lämnar till HLSL. Dess CBV ligger på plats 3 i CBV/SRV-heapen bakom **root-parameter 3**, en descriptor
table med en CBV på b2, synlig för alla shaders: djuppassets geometry shader och scenens pixel shader läser den båda som
`cbuffer LightSpaceMatrices : register(b2) { float4x4 lightSpaceMatrices[16]; };`.
:::

Gör nu den första uppgiften, **light-matrices**: delningsavstånden, de tre funktionerna och uniform buffern, fylld varje
bildruta. Ingenting läser matriserna ännu, så bilden förblir densamma.

## En skuggkarta per kaskad – i en textur

Fem skuggkartor skulle kunna vara fem texturer. learnopengl använder i stället en **2D-texturarray** med fem lager: ett
texturobjekt, en bindning i shadern, och lagret är bara en tredje texturkoordinat. Den låter också djuppasset rendera alla
fem på en gång, som vi ska se. Kursen använder 1024 × 1024 texlar per lager (learnopengl: 4096 × 4096 – den inbyggda
simulatorn ritar på CPU:n), närmaste-filtrering, och en kant med djupet 1.0 utanför kartan, så att inget utanför en
kaskads låda hamnar i skugga.

:::opengl
```cpp
    glGenTextures(1, &lightDepthMaps);
    glBindTexture(GL_TEXTURE_2D_ARRAY, lightDepthMaps);
    glTexImage3D(
        GL_TEXTURE_2D_ARRAY, 0, GL_DEPTH_COMPONENT32F, depthMapResolution, depthMapResolution, int(shadowCascadeLevels.size()) + 1,
        0, GL_DEPTH_COMPONENT, GL_FLOAT, nullptr);

    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_BORDER);
    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_BORDER);

    constexpr float bordercolor[] = { 1.0f, 1.0f, 1.0f, 1.0f };
    glTexParameterfv(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_BORDER_COLOR, bordercolor);

    // attach the whole array (all layers): the geometry shader picks the layer of each triangle
    glBindFramebuffer(GL_FRAMEBUFFER, lightFBO);
    glFramebufferTexture(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, lightDepthMaps, 0);
    glDrawBuffer(GL_NONE);
    glReadBuffer(GL_NONE);
```

`glTexImage3D` allokerar alla lager på en gång – för en arraytextur är "djup"-parametern antalet lager.
`glFramebufferTexture` (utan `2D` eller `Layer`) kopplar in **hela** arrayen: framebuffern blir *lagerindelad* (layered),
och varje primitiv hamnar i det lager som geometry shadern väljer med `gl_Layer`, precis som cube map-sidorna i
*Punktskuggor*.
:::
:::vulkan
Skuggkartan är en djupbild (`lightDepthMaps`, `D32_SFLOAT`) med `arrayLayers = 5` och användningen djup-attachment +
samplad. En vy av typen `VK_IMAGE_VIEW_TYPE_2D_ARRAY` täcker alla fem lager, och den gör dubbel tjänst: som
`sampler2DArray` på bindning 3, och som djup-attachment i en **lagerindelad framebuffer**:

```cpp
        // the same view is the framebuffer's depth attachment, with all the layers
        VkFramebufferCreateInfo framebufferInfo{};
        framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
        framebufferInfo.renderPass = depthMapRenderPass;
        framebufferInfo.attachmentCount = 1;
        framebufferInfo.pAttachments = &lightDepthMapsView;
        framebufferInfo.width = depthMapResolution;
        framebufferInfo.height = depthMapResolution;
        framebufferInfo.layers = layerCount;
```

`layers = 5` är det som låter geometry shaderns `gl_Layer` välja lager. Render passet är det endast-djup-pass som
*Shadow mapping*-projektet hade (clear, store, slutlayout `DEPTH_STENCIL_READ_ONLY_OPTIMAL`). Samplern filtrerar med
NEAREST och använder `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER` med `VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE` – learnopengls
kant på 1.0.
:::
:::d3d12
Skuggkartan är en texturarray, `m_lightDepthMaps`: `R32_TYPELESS` med `DepthOrArraySize = 5` (det fjärde argumentet
till `CD3DX12_RESOURCE_DESC::Tex2D`). Som i *Shadow mapping* låter det typlösa formatet två vyer läsa samma bitar på olika
sätt – här täcker båda vyerna alla fem skivorna:

```cpp
        D3D12_DEPTH_STENCIL_VIEW_DESC dsvDesc = {};
        dsvDesc.Format = DXGI_FORMAT_D32_FLOAT;
        dsvDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2DARRAY;
        dsvDesc.Flags = D3D12_DSV_FLAG_NONE;
        dsvDesc.Texture2DArray.MipSlice = 0;
        dsvDesc.Texture2DArray.FirstArraySlice = 0;
        dsvDesc.Texture2DArray.ArraySize = layers;
```

```cpp
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = DXGI_FORMAT_R32_FLOAT;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2DARRAY;
        srvDesc.Texture2DArray.MostDetailedMip = 0;
        srvDesc.Texture2DArray.MipLevels = 1;
        srvDesc.Texture2DArray.FirstArraySlice = 0;
        srvDesc.Texture2DArray.ArraySize = layers;
```

DSV:n hamnar på plats 1 i DSV-heapen, efter djupbufferns; SRV:n på plats 2 i CBV/SRV-heapen, direkt efter träets, så
att en descriptor table rymmer båda (t0 och t1). Den statiska samplern s1 filtrerar med punkter och använder
`D3D12_TEXTURE_ADDRESS_MODE_BORDER` med `D3D12_STATIC_BORDER_COLOR_OPAQUE_WHITE`. Arrayen börjar i `DEPTH_WRITE`; efter
djuppasset gör en barriär om den till en `PIXEL_SHADER_RESOURCE`, och en annan gör om den tillbaka i slutet av bildrutan.
:::

### Alla kaskader i ett pass

Det självklara sättet att fylla fem skuggkartor är fem djuppass: bind ett lager, sätt den kaskadens matris, rita scenen,
upprepa. learnopengl gör det i **ett**: scenen ritas en gång, och en geometry shader kopierar varje triangel till varje
lager. Vertex shadern transformerar nu bara till världsrummet (`model * vec4(aPos, 1.0)`); geometry shadern körs **fem
gånger per triangel** – geometry shader instancing – använder anropets ljusrumsmatris och skickar triangeln till lagret
med samma nummer.

:::opengl
```glsl
#version 410 core

// the shader runs 5 times per triangle (once per cascade): gl_InvocationID = 0 ... 4
layout(triangles, invocations = 5) in;
layout(triangle_strip, max_vertices = 3) out;

layout (std140) uniform LightSpaceMatrices
{
    mat4 lightSpaceMatrices[16];
};

void main()
{
    for (int i = 0; i < 3; ++i)
    {
        gl_Position = lightSpaceMatrices[gl_InvocationID] * gl_in[i].gl_Position;
        gl_Layer = gl_InvocationID;
        EmitVertex();
    }
    EndPrimitive();
}
```

Själva djuppasset är kort:

```cpp
        // 1. render depth of scene to texture (from light's perspective): all cascades in one pass
        // --------------------------------------------------------------
        simpleDepthShader.use();

        glBindFramebuffer(GL_FRAMEBUFFER, lightFBO);
        glViewport(0, 0, depthMapResolution, depthMapResolution);
        glClear(GL_DEPTH_BUFFER_BIT);
        renderScene(simpleDepthShader);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

`glClear` på en lagerindelad framebuffer rensar alla lager. learnopengl omger passet med `glCullFace(GL_FRONT)` /
`glCullFace(GL_BACK)` men slår aldrig på `GL_CULL_FACE`, så anropen gör ingenting; kursen utelämnar dem.
:::
:::vulkan
```glsl
#version 450

// the shader runs 5 times per triangle (once per cascade): gl_InvocationID = 0 ... 4
layout(triangles, invocations = 5) in;
layout(triangle_strip, max_vertices = 3) out;

layout(binding = 2) uniform LightSpaceMatrices {
    mat4 lightSpaceMatrices[16];
};

void main() {
    for (int i = 0; i < 3; ++i) {
        gl_Position = lightSpaceMatrices[gl_InvocationID] * gl_in[i].gl_Position;
        gl_Layer = gl_InvocationID;
        EmitVertex();
    }
    EndPrimitive();
}
```

Geometry shaders är en valfri funktion i Vulkan: `isDeviceSuitable` kontrollerar `supportedFeatures.geometryShader`, och
`createLogicalDevice` slår på den med `deviceFeatures.geometryShader = VK_TRUE;`. Djuppipelinen skapas med de tre
shaderfilerna – `createPipeline("shaders/shadow_mapping_depth.vert.spv", "shaders/shadow_mapping_depth.frag.spv",
"shaders/shadow_mapping_depth.geom.spv", …)` – och `recordCommandBuffer()` ritar scenen en gång i djupkartans render pass
med `lightFramebuffer`. Render passets rensning rensar alla fem lager.
:::
:::d3d12
HLSL:s geometry shader instancing är attributet `[instance(5)]`, anropets nummer är systemvärdet `SV_GSInstanceID`
(GLSL:s `gl_InvocationID`), och lagret är utdatan `SV_RenderTargetArrayIndex` (`gl_Layer`):

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    uint layer : SV_RenderTargetArrayIndex;    // the layer of the shadow maps this triangle goes to
};

GSInput VSMain(float4 position : POSITION)
{
    GSInput result;
    result.position = mul(position, model);
    return result;
}

[instance(5)]
[maxvertexcount(3)]
void GSMain(triangle GSInput input[3], uint invocation : SV_GSInstanceID, inout TriangleStream<PSInput> triStream)
{
    for (int i = 0; i < 3; ++i)
    {
        PSInput output;
        output.position = mul(input[i].position, lightSpaceMatrices[invocation]);
        output.layer = invocation;
        triStream.Append(output);
    }
    triStream.RestartStrip();
}
```

Geometry shadern kompileras med målet `gs_5_0` och sätts som `psoDesc.GS` i `m_depthPipelineState` (och nollställs med
`CD3DX12_SHADER_BYTECODE(nullptr, 0)` för nästa pipeline state-objekt). Djuppasset binder inget render target och
arrayens DSV – `OMSetRenderTargets(0, nullptr, FALSE, &shadowDsvHandle)` – rensar den (alla skivor) och anropar
`RenderScene()` en gång.
:::

Varför inte fem pass? De skulle fungera lika bra – en vy eller framebuffer per lager och kaskadens matris som push
constant eller root constant – och vissa motorer föredrar dem, eftersom geometry shaders är långsamma på en del hårdvara.
Men de skickar scenen fem gånger från CPU:n. Geometry shadern gör kopiorna på GPU:n, från en enda uppsättning
draw-anrop, som learnopengls artikel (och kapitlet *Punktskuggor*) gör. Ännu bättre är att skicka varje objekt bara till
de kaskader som dess avgränsningsvolym berör – en nära låda behöver inte ritas i kaskaden 250 enheter bort.

För en första titt på resultatet ritar projektet ett lager av arrayen på en skärmfyrhörning i stället för scenen –
felsökningsvyn från kapitlet *Shadow mapping*, nu med ett lagernummer (`showQuad = true`, `debugLayer = 2`).

Gör nu den andra uppgiften, **depth-maps**: arraytexturen och dess framebuffer, geometry shadern och djuppasset, och
felsökningsvyn. Bygg och kör: fönstret visar **lager 2** – kaskaden från 20 till 50 enheter, sedd från ljuset. Vitt där
inget ritades (djupet 1), och en grå romb: golvets bortre hörn så som ljuset ser det, med de avlägsna lådorna som svaga,
lite mörkare fläckar på det.

```quiz
Hur många gånger körs vertex shadern per vertex i scenen i djuppasset, och hur många gånger geometry shadern per triangel?
- [ ] Fem gånger var: en gång per kaskad
- [x] Vertex shadern en gång per vertex (till världsrummet), geometry shadern fem gånger per triangel (ett anrop per kaskad)
- [ ] En gång var: geometry shadern skriver alla fem lagren med en triangel
- [ ] Vertex shadern fem gånger, geometry shadern en gång
---
Scenen ritas en gång, så vertex shadern körs en gång per vertex. `invocations = 5` / `[instance(5)]` kör geometry shadern fem gånger för varje triangel, varje anrop med sitt eget `gl_InvocationID` / `SV_GSInstanceID`, som väljer matris och lager.
```

## Att välja kaskad

Tillbaka i scenpasset (`showQuad = false`) måste fragment shadern veta vilken kaskad ett fragment hör till.
Delningsavstånden är avstånd längs kamerans blickriktning, så shadern transformerar fragmentet till **vyrummet** och
jämför absolutvärdet av dess z – djupet framför kameran – med delningsavstånden. Den första kaskad vars bortre avstånd
ligger bortom fragmentets djup är dess kaskad; bortom den sista delningen är det den sista kaskaden. learnopengl gör detta
inuti sin skuggfunktion; kursen lägger det i en egen funktion, så att en felsökningsvy kan använda den först:

:::opengl
```glsl
// the cascade of a fragment: the first one whose far distance lies beyond the fragment's depth in view space
int CascadeLayer(vec3 fragPosWorldSpace)
{
    vec4 fragPosViewSpace = view * vec4(fragPosWorldSpace, 1.0);
    float depthValue = abs(fragPosViewSpace.z);

    int layer = -1;
    for (int i = 0; i < cascadeCount; ++i)
    {
        if (depthValue < cascadePlaneDistances[i])
        {
            layer = i;
            break;
        }
    }
    if (layer == -1)
    {
        layer = cascadeCount;
    }
    return layer;
}
```

Shadern får `uniform float farPlane; uniform mat4 view; uniform float cascadePlaneDistances[16]; uniform int
cascadeCount;` – `cascadeCount` är antalet delningar (4), learnopengls "number of frusta - 1". Renderingsloopen sätter
dem: `shader.setFloat("farPlane", cameraFarPlane);`, `shader.setInt("cascadeCount", shadowCascadeLevels.size());` och
`cascadePlaneDistances[i]` i en loop (`view` är redan satt).
:::
:::vulkan
Kaskadernas värden flyttar in i scenens uniform buffer. std140 kräver omsorg här: elementen i en array ligger 16 byte
isär, så learnopengls `float cascadePlaneDistances[16]` blir en array av `vec4` där `.x` används, och `farPlane` och
`cascadeCount` fyller de fyra byten efter de två `vec3`:orna:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float farPlane;
    glm::vec3 lightDir;
    int cascadeCount; // number of frusta - 1
    glm::vec4 cascadePlaneDistances[16];
};
```

`CascadeLayer` är learnopengls loop med `abs((ubo.view * vec4(fragPosWorldSpace, 1.0)).z)` och
`ubo.cascadePlaneDistances[i].x`; `cascadeCount` är antalet delningar (4), learnopengls "number of frusta - 1".
:::
:::d3d12
Kaskadernas värden flyttar in i scenens constant buffer. HLSL:s packningsregler lägger varje element i en cbuffer-array
i början av en ny 16-byte-rad, så learnopengls `float cascadePlaneDistances[16]` blir `float4 cascadePlaneDistances[16]`
(i C++ `XMFLOAT4`) där `.x` används, bredvid `float farPlane` och `int cascadeCount`. `CascadeLayer` är learnopengls loop
med vyrumsdjupet `abs(mul(float4(fragPosWorldSpace, 1.0f), view).z)` och `cascadePlaneDistances[i].x`; `cascadeCount` är
antalet delningar (4), learnopengls "number of frusta - 1".
:::

För att kaskaderna ska synas färgar uppgiften varje fragment med kaskadens färg – röd, grön, blå, gul, magenta – genom
att multiplicera belysningen med `cascadeColors[CascadeLayer(fragPos)]`. learnopengls demo har en besläktad vy: med
tangenten C ritar den kaskadernas ljuslådor som genomskinliga volymer (`drawCascadeVolumeVisualizers`), vilket visar hur
varje låda omsluter sin skiva av frustumet; kursen beskriver den men bygger den inte.

Gör nu den tredje uppgiften, **cascade-layer**. Bygg och kör: golvet är rött nära kameran, grönt i mitten och blått längst
bak; lådorna får sin kaskads färg. Golvet slutar 25 enheter bort, inne i den blå kaskaden 2 – den gula och den magenta
kaskaden innehåller bara den tomma bakgrunden, där inget ritas.

## Skuggor

Skuggfunktionen är den från kapitlet *Shadow mapping* med tre ändringar: den väljer kaskaden först och transformerar
fragmentet med **den** kaskadens matris, den slår upp djupet i **det** lagret i arrayen – lagret är den tredje
texturkoordinaten för en `sampler2DArray` – och den skalar bias per kaskad.

Bias behöver skalas eftersom kaskadernas lådor har mycket olika storlek. Bias är ett avstånd i skuggkartans djup, 0..1
över ljuslådans z-intervall; en låda som är tio gånger längre gör om samma bias till tio gånger så långt avstånd i
världen – och för mycket bias lösgör skuggor från det som kastar dem (*peter panning*). learnopengl dividerar därför bias
med kaskadens bortre avstånd (gånger en faktor 0.5): ju längre bort och större kaskad, desto mindre bias i djupenheter.

:::opengl
```glsl
float ShadowCalculation(vec3 fragPosWorldSpace)
{
    // select cascade layer
    int layer = CascadeLayer(fragPosWorldSpace);

    vec4 fragPosLightSpace = lightSpaceMatrices[layer] * vec4(fragPosWorldSpace, 1.0);
    // perform perspective divide
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform to [0,1] range
    projCoords = projCoords * 0.5 + 0.5;

    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;

    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if (currentDepth > 1.0)
    {
        return 0.0;
    }
    // calculate bias (based on depth map resolution and slope)
    vec3 normal = normalize(fs_in.Normal);
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    const float biasModifier = 0.5f;
    if (layer == cascadeCount)
    {
        bias *= 1 / (farPlane * biasModifier);
    }
    else
    {
        bias *= 1 / (cascadePlaneDistances[layer] * biasModifier);
    }

    float closestDepth = texture(shadowMap, vec3(projCoords.xy, layer)).r;
    float shadow = (currentDepth - bias) > closestDepth ? 1.0 : 0.0;

    return shadow;
}
```

Shadern deklarerar `uniform sampler2DArray shadowMap;` och learnopengls block `LightSpaceMatrices`; programmet binder
arrayen till texturenhet 1 (`shader.setInt("shadowMap", 1);`, `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D_ARRAY,
lightDepthMaps);`). `main` räknar ut `float shadow = ShadowCalculation(fs_in.FragPos);`, och felsökningsfärgen tas bort.
:::
:::vulkan
`shadow_mapping.frag` deklarerar matriserna på bindning 2 och `layout(binding = 3) uniform sampler2DArray shadowMap;`.
`ShadowCalculation` är learnopengls med en skillnad du känner igen från Vulkan-kapitlet *Shadow mapping*: bara x och y
avbildas på 0..1 – djupet är redan 0..1:

```glsl
    vec4 fragPosLightSpace = lightSpaceMatrices[layer] * vec4(fragPosWorldSpace, 1.0);
    // perform perspective divide
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform x and y to the [0,1] range of texture coordinates; z is in [0,1] already (GLM_FORCE_DEPTH_ZERO_TO_ONE)
    projCoords.xy = projCoords.xy * 0.5 + 0.5;
```

Ingen y-vändning behövs någonstans längs ljusets väg: djuppasset renderade med samma matriser som uppslagningen använder,
och i Vulkan pekar både en framebuffers y och en texturs v nedåt, så de stämmer överens. Bias skalas med
`ubo.cascadePlaneDistances[layer].x` (eller `ubo.farPlane` för den sista kaskaden), och uppslagningen är
`texture(shadowMap, vec3(projCoords.xy, layer)).r`. Descriptor setet (bindning 0–3) binds en gång i början av
`recordCommandBuffer()`, före båda passen.
:::
:::d3d12
Pixel shadern deklarerar `Texture2DArray shadowMap : register(t1);` och cbuffern `LightSpaceMatrices` på b2.
`ShadowCalculation` är learnopengls med ändringen du känner igen från Direct3D-kapitlet *Shadow mapping*: x och y blir
texturkoordinater med v vänt (v pekar nedåt i Direct3D, y uppåt), och z får vara som det är (0..1):

```hlsl
    float4 fragPosLightSpace = mul(float4(fragPosWorldSpace, 1.0f), lightSpaceMatrices[layer]);
    // perform perspective divide
    float3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform x and y from [-1,1] to [0,1] texture coordinates: in Direct3D v points down
    // while y points up, so y is flipped. z needs nothing: Direct3D's depth is 0..1 already.
    float2 shadowUV = float2(projCoords.x * 0.5f + 0.5f, -projCoords.y * 0.5f + 0.5f);
```

Bias skalas med `cascadePlaneDistances[layer].x` (eller `farPlane` för den sista kaskaden), och uppslagningen är
`shadowMap.Sample(shadowSampler, float3(shadowUV, layer)).r` – en `Texture2DArray` tar lagret som tredje koordinat.
:::

```quiz
Varför skalar skuggfunktionen ned bias för de avlägsnare kaskaderna?
- [ ] För att avlägsna fragment inte behöver någon bias: shadow acne syns bara nära kameran
- [x] För att bias mäts i skuggkartans djup 0..1, som spänner över ett mycket längre z-intervall i en stor kaskad – samma bias skulle skjuta skuggorna bort från det som kastar dem där
- [ ] För att de avlägsna kaskadernas skuggkartor har färre texlar
- [ ] För att PCF redan tar bort acnet i de avlägsna kaskaderna
---
I kaskad 0 är ljuslådan några tiotal enheter djup, i kaskad 3 hundratals. En djupskillnad på 0.005 är ett kort avstånd i den första och ett långt i den andra. Att dividera med kaskadens bortre avstånd håller bias ungefär konstant i världsenheter.
```

Gör nu den fjärde uppgiften, **shadows**. Bygg och kör: lådorna kastar sina skuggor på golvet – bakåt och åt vänster, bort
från ljuset – i alla tre kaskader som golvet når, och på varandra. Där en skugga faller återstår bara den ambienta termen.
Titta längs golvet från nära till långt bort: skuggorna förblir skarpa över kaskadgränserna, fast kaskadernas kartor
täcker mycket olika stora ytor.

## PCF

Skuggornas kanter är hårda trappsteg, en texel bred i kaskadens karta – och en texel i kaskad 2 är mycket större på
golvet än en i kaskad 0. Percentage-closer filtering mjukar upp dem som i kapitlet *Shadow mapping*: jämför djupet mot de
3 × 3 texlarna runt positionen i kaskadens lager och ta medelvärdet av de nio resultaten. Texelstorleken kommer från
arrayens storlek – dess bredd och höjd; den tredje komponenten är antalet lager.

:::opengl
```glsl
    // PCF
    float shadow = 0.0;
    vec2 texelSize = 1.0 / vec2(textureSize(shadowMap, 0));
    for(int x = -1; x <= 1; ++x)
    {
        for(int y = -1; y <= 1; ++y)
        {
            float pcfDepth = texture(shadowMap, vec3(projCoords.xy + vec2(x, y) * texelSize, layer)).r;
            shadow += (currentDepth - bias) > pcfDepth ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;
```

`textureSize` för en `sampler2DArray` returnerar en `ivec3` (bredd, höjd, lager); `vec2(…)` behåller de två första.
:::
:::vulkan
```glsl
    // PCF
    float shadow = 0.0;
    vec2 texelSize = 1.0 / vec2(textureSize(shadowMap, 0));
    for (int x = -1; x <= 1; ++x) {
        for (int y = -1; y <= 1; ++y) {
            float pcfDepth = texture(shadowMap, vec3(projCoords.xy + vec2(x, y) * texelSize, layer)).r;
            shadow += (currentDepth - bias) > pcfDepth ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;
```

`textureSize` för en `sampler2DArray` returnerar en `ivec3` (bredd, höjd, lager); `vec2(…)` behåller de två första.
:::
:::d3d12
```hlsl
    float shadow = 0.0f;
    uint width, height, elements;
    shadowMap.GetDimensions(width, height, elements);
    float2 texelSize = 1.0f / float2(width, height);
    for (int x = -1; x <= 1; ++x)
    {
        for (int y = -1; y <= 1; ++y)
        {
            float pcfDepth = shadowMap.Sample(shadowSampler, float3(shadowUV + float2(x, y) * texelSize, layer)).r;
            shadow += (currentDepth - bias) > pcfDepth ? 1.0f : 0.0f;
        }
    }
```

`GetDimensions` för en `Texture2DArray` returnerar bredden, höjden och antalet element (lager).
:::

Gör nu den sista uppgiften, **pcf**. Bygg och kör: skuggorna får en mjuk kant en texel bred – smal nära kameran, bredare
längst bak, där en texel i den avlägsna kaskaden täcker mer golv.

## Att gå vidare

Kaskaderade skuggkartor är standardtekniken för solljus i öppna scener, och learnopengls artikel avslutas med de
förbättringar en produktionsversion behöver:

- **Synliga skarvar mellan kaskaderna.** Där en kaskad slutar och nästa börjar hoppar skuggans upplösning, och en mjuk
  kant kan plötsligt bli skarpare. Att blanda de två kaskadernas resultat över ett smalt band vid delningen döljer
  skarven, till priset av två uppslagningar där.
- **Flimmer.** Ljuslådorna räknas om varje bildruta utifrån kameran. När kameran flyttas eller vrids flyttar sig varje
  låda och ändrar storlek med bråkdelar av en texel, så skuggkartornas texelrutnät glider över världen och skuggkanterna
  kryper och flimrar. Att *stabilisera* kaskaderna löser det: använd en avgränsnings*sfär* runt skivan så att lådans
  storlek inte ändras när kameran vrids, och fäst lådans position vid hela texlar i ljusets rum.
- **Tätare z-intervall.** `zMult` är en gissning. Att passa ljuslådans nära och bortre plan efter scenens gränser (eller
  efter de objekt som faktiskt kan kasta skugga in i kaskaden) utnyttjar djupprecisionen bättre.
- **Att välja delningarna.** En blandning av en linjär och en logaritmisk fördelning ("practical split scheme") anpassar
  kaskaderna till det nära och det bortre planet bättre än fasta bråkdelar.
- **Culling per kaskad.** Med frustum culling mot varje ljuslåda renderas varje objekt bara i de kaskader det kan påverka.
:::opengl
- **Kontextversionen.** Djuppasset i ett enda svep kräver geometry shader instancing (OpenGL 4.0); med OpenGL 3.3 skulle
  du rendera ett pass per kaskad och koppla in ett lager i taget med `glFramebufferTextureLayer`.
:::
:::vulkan
- **Utan geometry shaders.** På enheter utan funktionen `geometryShader` (många mobila GPU:er) renderar du ett pass per
  kaskad med en vy av ett enda lager; med `VK_KHR_multiview` (core i Vulkan 1.1) kan ett pass också rendera till flera
  lager med en egen matris per vy.
:::
:::d3d12
- **Utan geometry shaders.** Geometry shader-steget är långsamt på en del hårdvara; Direct3D 12 erbjuder också view
  instancing (`ViewInstanceCount` i pipeline state-objektet, `SV_ViewID` i shadern), som renderar samma ritning till
  flera skivor i en render target-array med en egen matris per vy.
:::

## Mer att läsa

- [Cascaded Shadow Mapping](https://learnopengl.com/Guest-Articles/2021/CSM): learnopengls gästartikel som det här
  kapitlet följer, med bilder av kaskaderna och ljuslådorna.
- [shadow_mapping.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2021/2.csm/shadow_mapping.cpp):
  learnopengls demo med kaskadvisualiseringen (tangenten C).
- [Cascaded Shadow Maps (Microsoft)](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/cascaded-shadow-maps):
  Microsofts tekniska artikel om CSM, med stabilisering och valet av delningar.

:::opengl
- [glFramebufferTexture](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glFramebufferTexture.xhtml): att koppla
  in en hel arraytextur som ett lagerindelat attachment.
:::
:::vulkan
- [Geometry shaders (Vulkan specification)](https://docs.vulkan.org/spec/latest/chapters/geometry.html): invocations,
  `gl_Layer` och lagerindelade framebuffers.
:::
:::d3d12
- [Geometry-Shader Object (HLSL)](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-geometry-shader):
  `[instance(n)]`, `SV_GSInstanceID` och utdataströmmen.
:::
