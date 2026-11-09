# Grundläggande ljussättning

Belysning i den verkliga världen är extremt komplicerad och beror på alldeles för många faktorer – något vi inte har
råd att beräkna med den begränsade beräkningskraft vi har. Belysning i {{api}} bygger därför på approximationer av
verkligheten, med förenklade modeller som är mycket lättare att beräkna och ser ganska lika ut. Belysningsmodellerna
bygger på ljusets fysik så som vi förstår den. En av dem kallas *Phongs belysningsmodell* (Phong lighting model). Dess
viktigaste byggstenar är 3 komponenter: ambient, diffust och spekulärt ljus.

- **Ambient ljus**: även när det är mörkt finns det oftast lite ljus någonstans (månen, ett avlägset ljus), så objekt
  är nästan aldrig helt mörka. För att simulera det använder vi en konstant för ambient ljus som alltid ger objektet
  lite färg.
- **Diffust ljus**: simulerar hur ljuset från en ljuskälla påverkar ett objekt beroende på riktningen. Det är den
  visuellt mest betydelsefulla komponenten i belysningsmodellen. Ju mer en del av ett objekt är vänd mot ljuskällan,
  desto ljusare blir den.
- **Spekulärt ljus**: simulerar den ljusa fläck som uppstår på blanka objekt. Spekulära högdagrar tenderar att ha
  ljusets färg snarare än objektets.

För att skapa visuellt intressanta scener vill vi åtminstone simulera de här 3 komponenterna. Vi börjar med den
enklaste: *ambient ljus*.

:::opengl
Det här kapitlets projekt är resultatet från *Colors*: den korallfärgade kuben, den vita lampan i `lightPos` och
kameran snett framför kuben från vänster. Två saker är förberedda. Kubens shaders har bytt namn till
`basic_lighting.vs` och `basic_lighting.fs` (samma innehåll som `colors.vs`/`colors.fs`; `Shader
lightingShader("basic_lighting.vs", "basic_lighting.fs");`), och hörnfältet har nu **6 floats per hörn** – en position
och en *normalvektor*, som vi kommer till strax. Båda VAO:ernas positionsattribut använder redan det nya steget,
`6 * sizeof(float)`.
:::
:::vulkan
Det här kapitlets projekt är resultatet från *Colors*: den korallfärgade kuben, den vita lampan i `lightPos`, två
pipelines skapade med `createPipeline(...)` och kameran snett framför kuben från vänster. Två saker är förberedda.
Kubens shaders har bytt namn till `shaders/basic_lighting.vert` och `shaders/basic_lighting.frag` (samma innehåll som
förut; `createPipeline("shaders/basic_lighting.vert.spv", "shaders/basic_lighting.frag.spv", 1, lightingPipeline)`),
och varje hörn har nu **en position och en normalvektor** – som vi kommer till strax: `struct Vertex { glm::vec3 pos;
glm::vec3 normal; }`.
:::
:::d3d12
Det här kapitlets projekt är resultatet från *Colors*: den korallfärgade kuben, den vita lampan i `lightPos`, två
pipeline state objects och kameran snett framför kuben från vänster. Två saker är förberedda. Kubens shaders har bytt
namn till `basic_lighting.hlsl` (samma innehåll som `colors.hlsl`; båda `D3DCompileFromFile`-anropen använder det nya
namnet), och varje hörn har nu **en position och en normalvektor** – som vi kommer till strax: `struct Vertex {
XMFLOAT3 position; XMFLOAT3 normal; }`. Vertex buffer-vyns steg är `sizeof(Vertex)`, nu 24 byte, så positionerna läses
fortfarande rätt.
:::

De flesta uppgifterna i kapitlet ändrar kod som redan finns; den enda `// TODO:`-kommentaren visar var
normalattributet ska in. Tryck på **Build & run** (Ctrl+Enter) efter varje uppgift för att se resultatet i den
inbyggda simulatorn. Startbilden är slutet på förra kapitlet: en platt korallfärgad kub och en vit lampa.

## Ambient ljus

Ljus kommer oftast inte från en enda ljuskälla, utan från många ljuskällor runt omkring oss, även när de inte syns
direkt. En av ljusets egenskaper är att det kan spridas och studsa åt många håll och nå ställen som inte syns
direkt; ljus kan alltså *reflekteras* mot andra ytor och indirekt påverka hur ett objekt belyses. Algoritmer som tar
hänsyn till det kallas *global illumination*-algoritmer, men de är komplicerade och dyra att beräkna.

Eftersom vi inte är så förtjusta i komplicerade och dyra algoritmer börjar vi med en mycket förenklad modell av global
illumination, nämligen *ambient ljus*. Som du såg i början av kapitlet använder vi en liten konstant (ljus)färg som vi
lägger till den slutliga färgen på objektets fragment, så att det ser ut som om det alltid finns lite spritt ljus även
när ingen ljuskälla lyser direkt.

Att lägga till ambient ljus i scenen är riktigt enkelt. Vi tar ljusets färg, multiplicerar den med en liten konstant
ambient-faktor, multiplicerar det med objektets färg och använder resultatet som fragmentets färg i kubobjektets
shader:

:::opengl
```glsl
void main()
{
    // ambient
    float ambientStrength = 0.1;
    vec3 ambient = ambientStrength * lightColor;

    vec3 result = ambient * objectColor;
    FragColor = vec4(result, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    // ambient
    float ambientStrength = 0.1;
    vec3 ambient = ambientStrength * ubo.lightColor;

    vec3 result = ambient * ubo.objectColor;
    outColor = vec4(result, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // ambient
    float ambientStrength = 0.1f;
    float3 ambient = ambientStrength * lightColor;

    float3 result = ambient * objectColor;
    return float4(result, 1.0f);
}
```
:::

Gör nu uppgiften **ambient**. När du bygger och kör programmet ser du att det första steget av belysningen nu används
på objektet. Objektet är ganska mörkt – (26, 13, 8), en tiondel av korall – men inte helt, eftersom ambient ljus läggs
på (lägg märke till att ljuskuben inte påverkas, eftersom den har egna shaders). Det bör se ut ungefär som en mycket
mörk korallfärgad siluett.

```quiz
Efter uppgiften **ambient** har varje synlig sida av kuben samma mycket mörka korallfärg. Varför?
- [x] Ambient-termen är en konstant – 0.1 × lightColor – som inte beror på ljusets position eller på åt vilket håll en sida pekar
- [ ] Ljuset är för långt från kuben för att lysa upp den
- [ ] Ambient-termen lyser bara upp de sidor som pekar bort från ljuset
---
Ambient ljus står för ljus som har studsat runt överallt, så det är detsamma för varje fragment. Skillnader mellan sidorna kräver en term som beror på riktningen: diffust ljus.
```

## Diffust ljus

Ambient ljus ger i sig inga särskilt intressanta resultat, men diffust ljus börjar ha en betydande visuell effekt på
objektet. Diffust ljus gör objektet ljusare ju närmare dess fragment är riktade mot ljusstrålarna från en ljuskälla.
Föreställ dig en ljusstråle som träffar ett fragment: ljuset kommer från ljuskällan, fragmentet har en *normalvektor*
som sticker rakt ut från ytan, och θ är vinkeln mellan normalen och riktningen mot ljuset.

Om ljusstrålen är vinkelrät mot objektets yta har ljuset störst påverkan. För att mäta vinkeln mellan ljusstrålen och
fragmentet använder vi en så kallad normalvektor, alltså en vektor som är vinkelrät mot fragmentets yta;
ljusriktningen är vektorn från fragmentet till ljuskällan. För att mäta vinkeln mellan ljusstrålen och fragmentet tar
vi skalärprodukten (dot product) av normalvektorn och ljusriktningen.

Du kanske minns från kapitlet *Transformations* att ju mindre vinkeln mellan två enhetsvektorer är, desto närmare 1
ligger skalärprodukten. När vinkeln mellan vektorerna är 90 grader blir skalärprodukten 0. Samma sak gäller θ: ju
större θ blir, desto mindre påverkan ska ljuset ha på fragmentets färg.

> Observera att vi arbetar med *enhetsvektorer* (vektorer med längden 1) för att få (bara) cosinus för vinkeln mellan
> vektorerna, så vi måste se till att alla vektorer är normaliserade – annars returnerar skalärprodukten mer än bara
> cosinus.

Skalärprodukten ger alltså en skalär som vi kan använda för att räkna ut ljusets påverkan på fragmentets färg, vilket
ger olika belysta fragment beroende på hur de är riktade mot ljuset.

Så vad behöver vi för att räkna ut diffust ljus?

- **Normalvektor**: en vektor som är vinkelrät mot hörnets yta.
- **Den riktade ljusstrålen**: en riktningsvektor som är skillnadsvektorn mellan ljusets position och fragmentets
  position. För att räkna ut ljusstrålen behöver vi ljusets positionsvektor och fragmentets positionsvektor.

### Normalvektorer

En normalvektor är en (enhets)vektor som är vinkelrät mot ytan i ett hörn. Eftersom ett hörn i sig inte har någon yta
(det är bara en punkt i rymden) tar vi fram normalvektorn med hjälp av de omgivande hörnen för att lista ut hörnets
yta. Vi skulle kunna använda ett litet trick för att räkna ut normalvektorerna för alla kubens hörn med kryssprodukten,
men eftersom en kub inte är en komplicerad form kan vi helt enkelt lägga till dem för hand i hörndatan. Det
uppdaterade hörnfältet finns redan i projektet; försök se framför dig att normalerna verkligen är vektorer som är
vinkelräta mot varje plans yta (en kub består av 6 plan). Den första sidan, baksidan vid z = -0.5, har normalen
(0, 0, -1), som pekar bort från kuben:

:::opengl
```cpp
    float vertices[] = {
        // positions          // normals
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
        -0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
```

Eftersom vi har lagt till ett extra värde i hörnfältet behöver kubens VAO uppdateras med en andra attributpekare: 3
floats, med början 3 floats in i varje hörn på 6 floats:

```cpp
    // normal attribute
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
```

För lampan vill vi bara använda de första 3 floats i varje hörn och strunta i de sista 3, så vi behöver bara uppdatera
steget (stride) i lampans VAO – vilket projektet redan har gjort:

```cpp
    // note that we update the lamp's position attribute's stride to reflect the updated buffer data
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
```

> Det kan verka ineffektivt att använda hörndata som lampans shader inte använder fullt ut, men hörndatan ligger redan
> i GPU:ns minne för lådobjektet, så vi behöver inte lagra ny data i GPU:ns minne. Det är faktiskt effektivare än att
> allokera ett nytt VBO bara för lampan.

Alla belysningsberäkningar görs i fragment shadern, så vi måste skicka normalvektorerna vidare från vertex shadern till
fragment shadern. Vi behöver också fragmentets position: vi kommer att göra alla belysningsberäkningar i world space, så
vi vill först ha en hörnposition i world space. Det åstadkommer vi genom att multiplicera hörnets positionsattribut med
bara modellmatrisen (inte vy- och projektionsmatrisen) för att omvandla det till världskoordinater. Vertex shadern blir
då:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

out vec3 FragPos;
out vec3 Normal;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main()
{
    FragPos = vec3(model * vec4(aPos, 1.0));
    Normal = aNormal;

    gl_Position = projection * view * vec4(FragPos, 1.0);
}
```

Och i fragment shadern deklarerar vi motsvarande indatavariabler:

```glsl
in vec3 Normal;
in vec3 FragPos;
```
:::
:::vulkan
```cpp
// learnopengl's cube: 6 faces of 2 triangles, 36 vertices (no index buffer).
// Each vertex has its position and the normal of its face (a vector perpendicular to the face, pointing out).
const std::vector<Vertex> vertices = {
    // back (z = -0.5)
    {{-0.5f, -0.5f, -0.5f}, { 0.0f,  0.0f, -1.0f}},
    {{ 0.5f, -0.5f, -0.5f}, { 0.0f,  0.0f, -1.0f}},
    {{ 0.5f,  0.5f, -0.5f}, { 0.0f,  0.0f, -1.0f}},
```

Vertex buffern innehåller redan normalerna, men pipelinen känner inte till dem än. Som i vulkan-tutorials *Vertex input
description* får `getAttributeDescriptions()` en andra post – location 1, tre 32-bitars floats, på offseten för
`normal` i structen:

```cpp
    static std::array<VkVertexInputAttributeDescription, 2> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 2> attributeDescriptions{};

        attributeDescriptions[0].binding = 0;
        attributeDescriptions[0].location = 0;
        attributeDescriptions[0].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[0].offset = offsetof(Vertex, pos);

        attributeDescriptions[1].binding = 0;
        attributeDescriptions[1].location = 1;
        attributeDescriptions[1].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[1].offset = offsetof(Vertex, normal);

        return attributeDescriptions;
    }
```

Här kommer den tredje parametern till `createPipeline` in: antalet attribut, från början av det här fältet, som en
pipeline beskriver. Kubens vertex shader läser båda, så dess pipeline får 2; lampans vertex shader läser bara
positionen, så dess pipeline behåller 1 – som learnopengl:s lamp-VAO, som bara aktiverar attribut 0. (Att beskriva ett
attribut som vertex shadern inte läser är inget fel, men validation layers varnar för det.) Bindningens steg är
`sizeof(Vertex)`, 24 byte, för båda pipelines, så lampan hittar fortfarande sina positioner:

```cpp
        createPipeline("shaders/basic_lighting.vert.spv", "shaders/basic_lighting.frag.spv", 2, lightingPipeline); // position and normal
        createPipeline("shaders/light_cube.vert.spv", "shaders/light_cube.frag.spv", 1, lightCubePipeline); // the lamp only needs the position
```

> Det kan verka ineffektivt att ha hörndata som lampan inte använder, men hörnen ligger redan i GPU:ns minne för kuben,
> så båda pipelines läser helt enkelt samma vertex buffer – billigare än en andra buffer bara för lampan.

Alla belysningsberäkningar görs i fragment shadern, så vi måste skicka normalvektorerna vidare från vertex shadern till
fragment shadern. Vi behöver också fragmentets position: vi kommer att göra alla belysningsberäkningar i world space, så
vi vill först ha en hörnposition i world space. Det åstadkommer vi genom att multiplicera hörnets position med bara
modellmatrisen (inte vy- och projektionsmatrisen). Vertex shadern blir då:

```glsl
layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;

layout(location = 0) out vec3 fragPos;
layout(location = 1) out vec3 fragNormal;

void main() {
    // the lighting is calculated in world space: the fragment's position after the model matrix
    fragPos = vec3(pc.model * vec4(inPosition, 1.0));
    fragNormal = inNormal;

    gl_Position = ubo.proj * ubo.view * vec4(fragPos, 1.0);
}
```

Och i fragment shadern deklarerar vi motsvarande indata – i Vulkan-GLSL matchas de via `location`, inte via namn:

```glsl
layout(location = 0) in vec3 fragPos;
layout(location = 1) in vec3 fragNormal;
```
:::
:::d3d12
```cpp
            // positions                normals
            { { -0.5f, -0.5f, -0.5f }, {  0.0f,  0.0f, -1.0f } },
            { {  0.5f, -0.5f, -0.5f }, {  0.0f,  0.0f, -1.0f } },
            { {  0.5f,  0.5f, -0.5f }, {  0.0f,  0.0f, -1.0f } },
```

Vertex buffern innehåller redan normalerna, men input layouten beskriver dem inte än. Den får ett andra element,
`NORMAL`: tre floats på byteoffset 12, direkt efter positionen:

```cpp
        // Define the vertex input layout.
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };
```

Lampans pipeline state skapas från samma beskrivning, så den får också den här input layouten, fast `light_cube.hlsl`:s
`VSMain` bara läser `POSITION`. Det går bra: en input layout får ge fler element än vertex shadern läser (bara det
omvända är ett fel).

> Det kan verka ineffektivt att ha hörndata som lampan inte använder, men hörnen ligger redan i GPU:ns minne för kuben,
> så båda pipeline states läser helt enkelt samma vertex buffer – billigare än en andra buffer bara för lampan.

Alla belysningsberäkningar görs i pixel shadern, så vi måste skicka normalvektorerna vidare från vertex shadern till
pixel shadern. Vi behöver också fragmentets position: vi kommer att göra alla belysningsberäkningar i world space, så vi
vill först ha en hörnposition i world space. Det åstadkommer vi genom att multiplicera hörnets position med bara
modellmatrisen (inte vy- och projektionsmatrisen). `PSInput` får två medlemmar till – vilken semantik som helst utom
systemvärdena `SV_` skickar bara ett värde vidare till pixel shadern:

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
};
```

och `VSMain` får normalen som en andra indata:

```hlsl
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL)
{
    PSInput result;

    // The position in world space (only the model matrix applied), for the lighting.
    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    result.normal = normal;

    // Then view and projection, as before.
    result.position = mul(mul(worldPos, view), projection);

    return result;
}
```

`PSMain` tar redan emot hela `PSInput` som `input`, så den kan läsa `input.fragPos` och `input.normal`.
:::

Gör nu uppgiften **normals**. Inget använder de nya värdena än, så bilden ändras inte.

:::opengl
```quiz
Varför använder lampans VAO steget `6 * sizeof(float)` fast lampan bara läser positionen?
- [ ] För att alla attribut måste ha samma steg som det största attributet
- [ ] För att lampans shader också läser normalen, för att förbli vit
- [x] För att steget är avståndet från ett hörn till nästa i det delade VBO:t, och varje hörn tar nu 6 floats – lampan hoppar bara över normalen
---
Lampans VAO pekar in i samma VBO som kubens. Med steget `3 * sizeof(float)` skulle den andra hörnpositionen läsas från det första hörnets normal.
```
:::
:::vulkan
```quiz
Varför skapas lampans pipeline med `attributeCount` 1 medan kubens får 2?
- [x] För att lampans vertex shader bara läser positionen (location 0), medan kubens läser positionen och normalen; båda läser samma hörn på 24 byte
- [ ] För att lampan ritas från en separat vertex buffer som bara innehåller positioner
- [ ] För att en pipeline inte kan beskriva fler attribut än den förra pipelinen
---
Båda pipelines använder samma bindning med steget `sizeof(Vertex)`, så lampan hittar fortfarande varje position. Den beskriver helt enkelt inte normalen, som dess shader aldrig läser.
```
:::
:::d3d12
```quiz
Varför har elementet `NORMAL` i input layouten byteoffseten 12?
- [ ] För att varje indataelement måste börja på en multipel av 12 byte
- [ ] För att normalen lagras 12 hörn efter positionen i vertex buffern
- [x] För att varje hörn börjar med sin position, en `XMFLOAT3` på 3 × 4 = 12 byte, och normalen följer direkt efter den
---
Offseten räknas från början av varje hörn. Vertex buffer-vyns steg, `sizeof(Vertex)` = 24, tar input assemblern från ett hörn till nästa.
```
:::

### Beräkna den diffusa färgen

Vi har nu normalvektorn för varje hörn, men vi behöver fortfarande ljusets positionsvektor och fragmentets
positionsvektor. Eftersom ljusets position är en enda statisk variabel kan vi deklarera den som en uniform i
kubobjektets shader:

:::opengl
```glsl
uniform vec3 lightPos;
```

Och sedan uppdatera uniformen i renderloopen (eller utanför, eftersom den inte ändras per bildruta). Vi använder
vektorn `lightPos` som deklarerades i förra kapitlet som platsen för den diffusa ljuskällan:

```cpp
        lightingShader.setVec3("lightPos", lightPos);
```
:::
:::vulkan
I Vulkan blir den nästa medlem i uniform-blocket i `basic_lighting.frag`:

```glsl
layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 objectColor;
    vec3 lightColor;
    vec3 lightPos;
} ubo;
```

och i C++-structen, återigen med en utfyllnadsfloat, eftersom nästa `vec3` i layouten std140 börjar på nästa multipel
av 16 byte:

```cpp
    glm::vec3 lightColor;
    float pad2;
    glm::vec3 lightPos;
    float pad3;
};
```

`updateUniformBuffer()` kopierar variabeln `lightPos` som deklarerades i förra kapitlet dit, som platsen för den
diffusa ljuskällan:

```cpp
        ubo.lightPos    = lightPos;
```
:::
:::d3d12
I Direct3D 12 blir den nästa medlem i `SceneConstantBuffer` i `basic_lighting.hlsl`:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 objectColor;
    float3 lightColor;
    float3 lightPos;
};
```

och i C++-structen, återigen med en utfyllnadsfloat, eftersom HLSL börjar den här `float3` på en ny rad om 16 byte:

```cpp
        XMFLOAT3 lightColor;
        float padding1;
        XMFLOAT3 lightPos;
        float padding2;
    };
```

`OnUpdate` kopierar variabeln `lightPos` som deklarerades i förra kapitlet dit, som platsen för den diffusa
ljuskällan:

```cpp
    constantBufferData.lightPos = lightPos;
```

Constant buffern storleksätts med `CalculateConstantBufferByteSize`, så dess 256 byte har fortfarande plats; inget
annat ändras.
:::

Det sista vi behöver är själva fragmentets position. Den har vi redan: det är positionen i world space som vertex
shadern skickar vidare och som rastreraren interpolerar över varje triangel. Nu när alla nödvändiga variabler är satta
kan vi börja med belysningsberäkningarna.

Det första vi måste räkna ut är riktningsvektorn mellan ljuskällan och fragmentets position. Från förra avsnittet vet vi
att ljusets riktningsvektor är skillnadsvektorn mellan ljusets positionsvektor och fragmentets positionsvektor. Den
skillnaden räknar vi enkelt ut genom att subtrahera vektorerna från varandra. Vi vill också se till att alla
relevanta vektorer blir enhetsvektorer, så vi normaliserar både normalen och den resulterande riktningsvektorn:

:::opengl
```glsl
    vec3 norm = normalize(Normal);
    vec3 lightDir = normalize(lightPos - FragPos);
```
:::
:::vulkan
```glsl
    vec3 norm = normalize(fragNormal);
    vec3 lightDir = normalize(ubo.lightPos - fragPos);
```
:::
:::d3d12
```hlsl
    float3 norm = normalize(input.normal);
    float3 lightDir = normalize(lightPos - input.fragPos);
```
:::

> När vi räknar på belysning bryr vi oss oftast inte om en vektors längd eller position; vi bryr oss bara om dess
> riktning. Eftersom vi bara bryr oss om riktningen görs nästan alla beräkningar med enhetsvektorer, vilket förenklar
> de flesta beräkningar (som skalärprodukten). Så när du räknar på belysning, se alltid till att normalisera de
> relevanta vektorerna så att de verkligen är enhetsvektorer. Att glömma att normalisera en vektor är ett vanligt
> misstag. Normalen behöver det också, fast varje normal i hörndatan har längden 1: interpolering mellan olika riktade
> normaler (och, senare, en modellmatris som skalar) kan ändra dess längd.

Sedan räknar vi ut ljusets diffusa påverkan på det aktuella fragmentet genom att ta skalärprodukten av vektorerna
`norm` och `lightDir`. Värdet multipliceras sedan med ljusets färg för att få den diffusa komponenten, som blir mörkare
ju större vinkeln mellan vektorerna är:

:::opengl
```glsl
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diff * lightColor;
```
:::
:::vulkan
```glsl
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diff * ubo.lightColor;
```
:::
:::d3d12
```hlsl
    float diff = max(dot(norm, lightDir), 0.0f);
    float3 diffuse = diff * lightColor;
```
:::

Om vinkeln mellan vektorerna är större än 90 grader blir skalärprodukten faktiskt negativ, och vi får en negativ
diffus komponent. Därför använder vi funktionen `max`, som returnerar det största av sina två argument, för att se
till att den diffusa komponenten (och därmed färgerna) aldrig blir negativ. Belysning för negativa färger är inte
riktigt definierad, så det är bäst att hålla sig borta från det, om du inte är en av de där excentriska konstnärerna.

Nu när vi har en ambient och en diffus komponent adderar vi färgerna och multiplicerar resultatet med objektets färg för
att få fragmentets slutliga färg:

:::opengl
```glsl
    vec3 result = (ambient + diffuse) * objectColor;
    FragColor = vec4(result, 1.0);
```
:::
:::vulkan
```glsl
    vec3 result = (ambient + diffuse) * ubo.objectColor;
    outColor = vec4(result, 1.0);
```
:::
:::d3d12
```hlsl
    float3 result = (ambient + diffuse) * objectColor;
    return float4(result, 1.0f);
```
:::

Gör nu uppgiften **diffuse**. Om programmet (och shaderna) kompilerades bör du se kuben vakna till liv: **framsidan**,
som är vänd mot lampan, är belyst – ungefär (202, 101, 63) i mitten, ljusare mot lampan och lite mörkare bort från den
– medan **vänstersidan** förblir lika mörk som förut. Du ser att kuben med diffust ljus börjar se ut som en riktig kub
igen. Försök föreställa dig normalvektorerna och flytta kameran runt kuben (på din egen dator) för att se att ju större
vinkeln mellan normalvektorn och ljusets riktning är, desto mörkare blir fragmentet.

Låt oss kontrollera värdet i mitten av framsidan, (0, 0, 0.5): riktningen mot lampan är (1.2, 1.0, 1.5), med längden
2.17, så `lightDir` = (0.55, 0.46, 0.69). Med normalen (0, 0, 1) blir skalärprodukten 0.69; ambient plus diffust ger
0.79, och 0.79 × korall × 255 = (202, 101, 63).

```quiz
Varför förblir kubens vänstersida lika mörk som med bara ambient ljus?
- [ ] För att rastreraren interpolerar framsidans normaler över vänstersidan
- [ ] För att kameran tittar på vänstersidan från en för brant vinkel
- [x] För att dess normal (-1, 0, 0) pekar bort från lampan vid x = 1.2, så skalärprodukten med ljusriktningen är negativ och `max(…, 0.0)` gör den diffusa termen till 0
---
Lampan står till höger om kuben, vänstersidan pekar åt vänster: vinkeln mellan dess normal och riktningen mot ljuset är mer än 90°. Bara ambient-termen återstår.
```

### En sista sak

I förra avsnittet skickade vi normalvektorn direkt från vertex shadern till fragment shadern. Men beräkningarna i
fragment shadern görs alla i world space, så borde vi inte omvandla normalvektorerna till världskoordinater också? I
princip ja, men det är inte så enkelt som att bara multiplicera dem med en modellmatris.

För det första är normalvektorer bara riktningsvektorer och representerar ingen specifik position i rymden. För det
andra har normalvektorer ingen homogen koordinat (w-komponenten i en hörnposition). Det betyder att förflyttningar inte
ska påverka normalvektorerna. Så om vi vill multiplicera normalvektorerna med en modellmatris vill vi ta bort
förflyttningsdelen av matrisen genom att ta den övre vänstra 3x3-matrisen av modellmatrisen (vi skulle också kunna
sätta normalvektorns w-komponent till 0 och multiplicera med 4x4-matrisen).

För det andra: om modellmatrisen gör en olikformig skalning (non-uniform scale) ändras hörnen så att normalvektorn inte
längre är vinkelrät mot ytan. Föreställ dig en lutande yta med sin normal, och sträck sedan ut objektet bara längs y:
ytan lutar om, men normalen, skalad på samma sätt, lutar åt fel håll. Följande visar det i 2D för en yta som går
diagonalt uppåt, längs (1, 1), med normalen (1, -1) (onormaliserad för läsbarhetens skull), utsträckt med 2 längs y:

```text
surface direction         (1, 1)   ->  (1, 2)       the stretched surface
normal, scaled the same   (1, -1)  ->  (1, -2)      dot((1, 2), (1, -2)) = -3: no longer perpendicular
normal, normal matrix     (1, -1)  ->  (1, -0.5)    dot((1, 2), (1, -0.5)) = 0: perpendicular again
```

Varje gång vi gör en olikformig skalning (obs: en likformig skalning ändrar bara normalens längd, inte dess riktning,
vilket lätt åtgärdas genom att normalisera den) är normalvektorerna inte längre vinkelräta mot motsvarande yta, vilket
förvränger belysningen.

Tricket för att rätta till det är att använda en annan modellmatris, skräddarsydd för normalvektorer. Den kallas
*normalmatrisen* (normal matrix) och använder några linjäralgebraiska operationer för att ta bort effekten av den
felaktiga skalningen av normalvektorerna. Normalmatrisen definieras som "transponatet av inversen av den övre vänstra
3x3-delen av modellmatrisen". Puh, det var en munsbit, och om du inte riktigt förstår vad det betyder, oroa dig inte;
vi har inte gått igenom inversa och transponerade matriser än. Observera att de flesta källor härleder normalmatrisen
från model-view-matrisen, men eftersom vi arbetar i world space (och inte i view space) härleder vi den från
modellmatrisen.

:::opengl vulkan
I vertex shadern kan vi ta fram normalmatrisen med funktionerna `inverse` och `transpose`, som fungerar på alla
matristyper. Observera att vi gör om matrisen till en 3x3-matris så att den förlorar sina förflyttningsegenskaper och
kan multipliceras med normalvektorn av typen `vec3`:
:::
:::opengl
```glsl
    Normal = mat3(transpose(inverse(model))) * aNormal;
```
:::
:::vulkan
```glsl
    // the normal matrix: rotations and scaling of the model matrix without the translation (and right for non-uniform scaling)
    fragNormal = mat3(transpose(inverse(pc.model))) * inNormal;
```
:::
:::opengl vulkan

> Att invertera matriser är en kostsam operation för shaders, så undvik inversoperationer där det går, eftersom de
> måste göras för varje hörn i scenen. För inlärningens skull går det bra, men i ett effektivt program vill du
> antagligen räkna ut normalmatrisen på CPU:n och skicka den till shaderna via en uniform innan du ritar (precis som
> modellmatrisen).
:::
:::d3d12
I GLSL skriver learnopengl `mat3(transpose(inverse(model)))` direkt i vertex shadern. HLSL har `transpose`, men **ingen
`inverse`-funktion** – och att invertera en matris för varje hörn är kostsamt ändå, eftersom det ger samma resultat för
varje hörn i ett ritanrop. Så vi gör det learnopengl rekommenderar för ett effektivt program: räknar ut normalmatrisen
på CPU:n, en gång per ritanrop, och skickar den tillsammans med modellmatrisen. Den blir en andra medlem i root
constants:

```cpp
    // The root constants: what the vertex shader sees as cbuffer ModelConstants.
    // Two 4x4 matrices are 32 floats: 32 32-bit root constants.
    struct ModelConstants
    {
        XMFLOAT4X4 model;
        XMFLOAT4X4 normalMatrix;
    };
```

```hlsl
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
};
```

Root parameter 0 skapas med `InitAsConstants(sizeof(ModelConstants) / 4, …)` och sätts med
`SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, …)`, så båda följer structen till 32 konstanter av sig
själva. Det får plats: en root signatur får rymma 64 värden på 32 bitar totalt, och descriptor tablen i root parameter
1 kostar ett till.

I `PopulateCommandList`, efter att kubens modellmatris har lagrats, räknar vi ut normalmatrisen med `XMMatrixInverse`
och `XMMatrixTranspose`:

```cpp
    // The normal matrix: the transpose of the inverse of the model matrix. It keeps the
    // normals perpendicular to the faces even when the model matrix scales unevenly.
    XMMATRIX normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixTranspose(normalMatrix));
```

Den första `XMMatrixTranspose` är en del av matematiken – *transponatet* av inversen. Den andra är den som varje matris
i projektet får innan den skickas till GPU:n, eftersom HLSL läser matriser i constant buffers kolumn för kolumn (det
första argumentet till `XMMatrixInverse` kan ta emot determinanten; den behöver vi inte). Formeln är densamma för
DirectXMath:s radvektorer som för GLM:s kolumnvektorer.

Lampans ritanrop skickar samma struct; `light_cube.hlsl` deklarerar bara `model`, så dess shaders ignorerar den andra
matrisen. I `VSMain` multipliceras normalen nu med normalmatrisen. För att förflyttningen i 4x4-matrisen inte ska ha
någon effekt får normalen w = 0 – samma sak som att ta den övre vänstra 3x3-delen:

```hlsl
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;
```
:::

Gör nu uppgiften **normal-matrix**. I förra avsnittet var belysningen bra eftersom vi inte skalade objektet, så det
fanns egentligen inget behov av en normalmatris, och vi kunde ha multiplicerat normalerna med modellmatrisen. Vår kubs
modellmatris är till och med enhetsmatrisen, så den här uppgiften ändrar **ingenting** i bilden. Gör du däremot en
olikformig skalning är det avgörande att du multiplicerar normalvektorerna med normalmatrisen.

```quiz
Varför kan vi inte omvandla normalerna med själva modellmatrisen när den skalar olikformigt?
- [x] För att en olikformig skalning lutar ytan åt ett håll och normalen åt ett annat, så den omvandlade normalen inte längre är vinkelrät mot ytan
- [ ] För att normaler inte får skalas alls, inte ens likformigt
- [ ] För att modellmatrisen skulle flytta normalerna till objektets position
---
Förflyttningen hanteras för sig (den övre vänstra 3x3-delen, eller w = 0). Den olikformiga skalningen är skälet till transponatet av inversen: den skalar normalen med de omvända faktorerna, vilket håller den vinkelrät.
```

## Spekulärt ljus

Om du inte redan är utmattad av allt prat om belysning kan vi nu göra klart Phongs belysningsmodell genom att lägga
till spekulära högdagrar.

Precis som diffust ljus bygger spekulärt ljus på ljusets riktningsvektor och objektets normalvektorer, men den här
gången också på blickriktningen, alltså från vilket håll spelaren tittar på fragmentet. Spekulärt ljus bygger på ytors
reflekterande egenskaper. Om vi tänker oss objektets yta som en spegel är det spekulära ljuset starkast där vi skulle se
ljuset speglas i ytan.

Vi räknar ut en reflektionsvektor genom att spegla ljusriktningen kring normalvektorn. Sedan räknar vi ut
vinkelavståndet mellan reflektionsvektorn och blickriktningen. Ju mindre vinkeln mellan dem är, desto större påverkan
har det spekulära ljuset. Effekten blir att vi ser en liten högdager när vi tittar längs ljusets riktning speglad i
ytan.

Blickvektorn är den extra variabel vi behöver för spekulärt ljus, och den räknar vi ut med betraktarens position i
world space och fragmentets position. Sedan räknar vi ut den spekulära intensiteten, multiplicerar den med ljusets färg
och lägger till den till ambient- och diffuskomponenterna.

> Vi valde att göra belysningsberäkningarna i world space, men de flesta föredrar att räkna belysning i view space. En
> fördel med view space är att betraktarens position alltid är (0, 0, 0), så du får betraktarens position gratis. Vi
> tycker ändå att belysning i world space är mer intuitiv för inlärningens skull. Vill du ändå räkna belysning i view
> space måste du omvandla alla relevanta vektorer med vymatrisen också (glöm inte att ändra normalmatrisen också).

För att få betraktarens världskoordinater tar vi helt enkelt kameraobjektets positionsvektor (kameran är ju
betraktaren). Så låt oss lägga till ännu en uniform i fragment shadern och skicka kamerans positionsvektor till
shadern:

:::opengl
```glsl
uniform vec3 viewPos;
```

```cpp
        lightingShader.setVec3("viewPos", cameraPos);
```
:::
:::vulkan
I Vulkan är den sista medlemmen i uniform-blocket (`vec3 viewPos;` efter `lightPos` i `basic_lighting.frag`) och i
C++-structen, med sin utfyllnadsfloat:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 objectColor;
    float pad1;
    glm::vec3 lightColor;
    float pad2;
    glm::vec3 lightPos;
    float pad3;
    glm::vec3 viewPos;
    float pad4;
};
```

```cpp
        ubo.viewPos     = cameraPos;
```
:::
:::d3d12
I Direct3D 12 är den sista medlemmen i `SceneConstantBuffer` (`float3 viewPos;` efter `lightPos` i
`basic_lighting.hlsl`) och i C++-structen, med sin utfyllnadsfloat:

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 objectColor;
        float padding0;
        XMFLOAT3 lightColor;
        float padding1;
        XMFLOAT3 lightPos;
        float padding2;
        XMFLOAT3 viewPos;
        float padding3;
    };
```

`cameraPos` är en `XMVECTOR`, så `OnUpdate` lagrar dess x, y och z i `XMFLOAT3`:n med `XMStoreFloat3`:

```cpp
    XMStoreFloat3(&constantBufferData.viewPos, cameraPos);    // the camera's position
```
:::

Nu när vi har alla variabler som behövs kan vi räkna ut den spekulära intensiteten. Först definierar vi ett värde för
den spekulära styrkan som ger högdagern en medelljus färg, så att den inte får för stor påverkan:

:::opengl vulkan
```glsl
    float specularStrength = 0.5;
```
:::
:::d3d12
```hlsl
    float specularStrength = 0.5f;
```
:::

Om vi satte den till 1.0f skulle vi få en riktigt ljus spekulär komponent, vilket är lite väl mycket för en
korallfärgad kub. I nästa kapitel går vi igenom hur man sätter alla de här belysningsintensiteterna ordentligt och hur
de påverkar objekten. Sedan räknar vi ut blickriktningsvektorn och motsvarande reflektionsvektor kring normalaxeln:

:::opengl
```glsl
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
```
:::
:::vulkan
```glsl
    vec3 viewDir = normalize(ubo.viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
```
:::
:::d3d12
```hlsl
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 reflectDir = reflect(-lightDir, norm);
```
:::

Lägg märke till att vi negerar vektorn `lightDir`. Funktionen `reflect` vill att den första vektorn pekar från
ljuskällan mot fragmentets position, men `lightDir` pekar just nu åt andra hållet: från fragmentet mot ljuskällan (det
beror på i vilken ordning vi subtraherade när vi räknade ut `lightDir`). För att få rätt reflektionsvektor vänder vi på
dess riktning genom att först negera `lightDir`. Det andra argumentet ska vara en normalvektor, så vi skickar den
normaliserade vektorn `norm`. {{shaderLanguage}}:s `reflect(i, n)` räknar ut `i - 2 * dot(n, i) * n`.

Det som återstår är att faktiskt räkna ut den spekulära komponenten. Det görs med följande formel:

:::opengl
```glsl
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32);
    vec3 specular = specularStrength * spec * lightColor;
```
:::
:::vulkan
```glsl
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32);
    vec3 specular = specularStrength * spec * ubo.lightColor;
```
:::
:::d3d12
```hlsl
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), 32);
    float3 specular = specularStrength * spec * lightColor;
```
:::

Först räknar vi ut skalärprodukten av blickriktningen och reflektionsriktningen (och ser till att den inte är negativ)
och upphöjer den sedan till 32. Värdet 32 är högdagerns *glans* (shininess). Ju högre glansvärde ett objekt har, desto
mer reflekterar det ljuset ordentligt i stället för att sprida det åt alla håll, och desto mindre blir högdagern. Om
man går igenom glansvärdena 2, 4, 8, 16 och vidare upp till 256 krymper högdagern från ett brett sken över stora delar
av sidan till en liten, skarp punkt.

Vi vill inte att den spekulära komponenten ska störa för mycket, så vi behåller exponenten 32. Det enda som återstår
är att lägga till den till ambient- och diffuskomponenterna och multiplicera summan med objektets färg:

:::opengl
```glsl
    vec3 result = (ambient + diffuse + specular) * objectColor;
    FragColor = vec4(result, 1.0);
```
:::
:::vulkan
```glsl
    vec3 result = (ambient + diffuse + specular) * ubo.objectColor;
    outColor = vec4(result, 1.0);
```
:::
:::d3d12
```hlsl
    float3 result = (ambient + diffuse + specular) * objectColor;
    return float4(result, 1.0f);
```
:::

Nu har vi räknat ut alla komponenter i Phongs belysningsmodell. Gör nu uppgiften **specular**. Utifrån din synvinkel
bör du se en **högdager** dyka upp i den övre vänstra delen av framsidan: runt den stiger färgen till (255, 145, 90) –
ljusare än själva korallfärgen, eftersom ambient + diffust + spekulärt där blir mer än 1 och färgen kläms – medan den
nedre högra delen av sidan knappt ändras.

Varför just där? Högdagern syns där sidan skulle spegla lampan in i kameran. Framsidan är planet z = 0.5; lampan är
1.5 enheter framför det, kameran 2.5 enheter. Spegelpunkten ligger på linjen mellan lampans och kamerans positioner i
planet, 1.5 / (1.5 + 2.5) av vägen från lampan: vid ungefär x = -0.4, y = 0.6 – i den vänstra halvan, strax ovanför
sidans överkant. Så sidans starkaste spekulära ljus ligger längs dess övre vänstra kant, och det klingar av mot nedre
högra hörnet. Från learnopengl:s standardkamera i (0, 0, 3), med lampan i bild, skulle du se samma effekt på ett annat
ställe; flytta kameran på din egen dator och se högdagern glida över sidan.

```quiz
Varför negeras `lightDir` i `reflect(-lightDir, norm)`?
- [ ] För att `reflect` bara fungerar med vektorer som pekar bort från betraktaren
- [x] För att `lightDir` pekar från fragmentet mot ljuset, medan `reflect` vill ha den inkommande vektorn, som pekar från ljuset mot fragmentet
- [ ] För att normalen pekar in i kuben, så en av vektorerna måste vändas
---
`lightDir` räknades ut som `lightPos - fragPos`, mot ljuset. Att spegla dess negation kring normalen ger riktningen som ljuset studsar åt – och den jämför vi sedan med riktningen mot betraktaren.
```

> I belysningsshadernas tidiga dagar implementerade utvecklare Phongs belysningsmodell i vertex shadern. Fördelen med
> att räkna belysning i vertex shadern är att det är mycket effektivare, eftersom det i allmänhet finns mycket färre
> hörn än fragment, så de (dyra) belysningsberäkningarna görs mer sällan. Men färgvärdet i vertex shadern är bara
> belysningsfärgen för just det hörnet, och färgerna på de omgivande fragmenten blir då resultatet av interpolerade
> belysningsfärger. Följden var att belysningen inte blev särskilt realistisk om man inte använde väldigt många hörn.
>
> När Phongs belysningsmodell implementeras i vertex shadern kallas det *Gouraud shading* i stället för *Phong
> shading*. Observera att belysningen ser lite konstig ut på grund av interpoleringen. Phong shading ger mycket mjukare
> belysning.

Vid det här laget bör du börja se hur kraftfulla shaders är. Med lite information kan shaders räkna ut hur belysningen
påverkar fragmentens färger för alla våra objekt. I de kommande kapitlen går vi mycket djupare in i vad vi kan göra med
belysningsmodellen.

## Övningar

- Just nu är ljuskällan en tråkig, statisk ljuskälla som inte rör sig. Försök att **flytta ljuskällan** runt i scenen
  över tid med sin eller cos. Att se belysningen ändras över tid ger dig en god förståelse för Phongs
  belysningsmodell. Det här är kapitlets sista uppgift, **moving-light** (nedan).
- Lek med olika styrkor för ambient, diffust och spekulärt ljus och se hur de påverkar resultatet. Experimentera också
  med glansfaktorn. Försök förstå varför vissa värden ger ett visst visuellt resultat.
- Gör Phong shading i **view space** i stället för world space.
- Implementera **Gouraud shading** i stället för Phong shading. Om du har gjort rätt bör belysningen se lite konstig ut
  (särskilt de spekulära högdagrarna) på kubobjektet. Försök resonera kring varför den ser så märklig ut.

### Flytta ljuset

learnopengl:s lösning flyttar ljuset längs x mellan -1 och 3 och längs y mellan -1 och 1, med `sin` av tiden:

:::opengl
```cpp
        // change the light's position values over time (before the light's position is used)
        lightPos.x = static_cast<float>(1.0 + sin(glfwGetTime()) * 2.0);
        lightPos.y = static_cast<float>(sin(glfwGetTime() / 2.0) * 1.0);
```

Det hamnar överst i renderloopens ritdel, före `lightingShader.use();` – innan både belysningsuniformen `lightPos` och
lampans modellmatris använder positionen, så att lampan ritas exakt där ljuset är.
:::
:::vulkan
```cpp
    void updateUniformBuffer() {
        // change the light's position values over time (before the light's position is used)
        lightPos.x = static_cast<float>(1.0 + std::sin(glfwGetTime()) * 2.0);
        lightPos.y = static_cast<float>(std::sin(glfwGetTime() / 2.0) * 1.0);

        UniformBufferObject ubo{};
```

Det hamnar i början av `updateUniformBuffer()`, innan `ubo.lightPos` sätts. `drawFrame()` anropar
`updateUniformBuffer()` före `recordCommandBuffer()`, så lampans modellmatris använder samma nya position och lampan
ritas exakt där ljuset är.
:::
:::d3d12
`OnUpdate` behöver tiden sedan första bildrutan, mätt med `std::chrono` som i *Camera*. Det hamnar direkt efter
tidslogiken per bildruta:

```cpp
    // Move the light over time: the time in seconds since the first frame.
    static auto startTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - startTime).count();
    lightPos.x = 1.0f + std::sin(time) * 2.0f;
    lightPos.y = std::sin(time / 2.0f) * 1.0f;
```

Det är innan `constantBufferData.lightPos` sätts, och `OnUpdate` körs innan `OnRender` anropar `PopulateCommandList`,
så lampans modellmatris använder samma nya position och lampan ritas exakt där ljuset är.
:::

Gör nu uppgiften **moving-light**. I simulatorn svänger lampan nu från sida till sida och upp och ner (en hel sväng åt
sidan tar 2π ≈ 6.3 sekunder), och belysningen på kuben följer med: när lampan rör sig åt höger glider högdagern mot
framsidans högra kant; när lampan rör sig åt vänster förbi x = -0.5, vänstersidans plan, börjar även den sidan få ljus.
Efter 1 sekund, till exempel, är ljuset i (2.68, 0.48, 2.0) och lampan står lägre och längre till höger än förut.

### View space och Gouraud shading

De två andra övningarna är inga uppgifter, men värda att prova när du är klar.

För belysning i **view space** (learnopengl:s `basic_lighting_exercise2`) multiplicerar vertex shadern positionen med
`view * model` i stället för `model`, normalen med normalmatrisen för `view * model`, och omvandlar ljusets position
med vymatrisen också, så att varje vektor som fragment shadern använder ligger i view space. Betraktaren står då i
origo i view space, så blickriktningen är helt enkelt `normalize(-fragPos)`, och `viewPos` behövs inte längre. Bilden
blir exakt densamma – vinklarna mellan vektorerna beror inte på i vilket rum du mäter dem.

:::d3d12
I HLSL betyder det att multiplicera med `model` och sedan `view` (`mul(mul(position, model), view)`), och – eftersom
HLSL saknar `inverse` – att räkna ut normalmatrisen för `model * view` i `PopulateCommandList`: `XMMatrixTranspose(XMMatrixInverse(nullptr, model * view))`.
`OnUpdate` skulle också behöva ge `PopulateCommandList` vymatrisen, eller skicka ljusets position i view space i
constant buffern.
:::

För **Gouraud shading** (övning 3) flyttar du hela belysningsberäkningen till vertex shadern, skickar vidare den
resulterande belysningsfärgen i stället för positionen och normalen, och låter fragment shadern multiplicera den med
objektets färg. Den spekulära högdagern ser då hackig och fel ut: varje sida av vår kub har bara 4 olika hörn (6 hörn
för dess 2 trianglar), så högdagern kan bara räknas ut i hörnen och interpoleras linjärt däremellan – en högdager som
hamnar mellan hörnen missas eller smetas ut över en hel triangel.

```quiz
Med Gouraud shading ser högdagern på vår kub hackig ut eller försvinner. Varför?
- [x] För att belysningen bara räknas ut i varje sidas hörn och interpoleras däremellan, så en liten högdager mellan hörnen kan inte återges
- [ ] För att normalerna inte interpoleras i vertex shadern
- [ ] För att vertex shadern inte kan använda funktionerna `reflect` och `pow`
---
Phong shading interpolerar normalen och positionen och belyser varje fragment; Gouraud shading interpolerar de färdiga färgerna. Med 4 hörn per sida faller en skarp högdager mitt på en sida helt enkelt mellan stolarna.
```

Du har nu hela Phongs belysningsmodell: ambient, diffust och spekulärt. I nästa kapitel ger vi objekten egna
materialegenskaper, så att vart och ett kan reagera på ljus på sitt eget sätt.
