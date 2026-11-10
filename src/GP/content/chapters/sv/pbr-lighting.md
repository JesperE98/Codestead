# PBR-belysning

I förra kapitlet lade vi grunden för att få igång en realistisk, fysikaliskt baserad renderare. I det här kapitlet
fokuserar vi på att omsätta teorin i en verklig renderare som använder direkta (eller analytiska) ljuskällor: tänk
punktljus, riktade ljus och/eller spotlights.

Vi börjar med att åter titta på förra kapitlets slutliga reflektansekvation:

```text
  Lo(p, ωo) = ∫Ω  ( kd · c / π  +  (D · F · G) / (4 · (ωo · n) · (ωi · n)) ) · Li(p, ωi) · (n · ωi)  dωi
```

Nu vet vi för det mesta vad som händer, men det som fortfarande var en stor okänd är exakt hur vi ska representera
irradiansen, den totala radiansen L, i scenen. Vi vet att radiansen L (så som den tolkas i datorgrafikens värld) mäter
strålningsflödet Φ, alltså ljusenergin från en ljuskälla, över en given rymdvinkel ω. I vårt fall antog vi att
rymdvinkeln ω är oändligt liten, och då mäter radiansen flödet från en ljuskälla längs en enda ljusstråle eller
riktningsvektor.

Hur omsätter vi det i den belysningskunskap vi har samlat i tidigare kapitel? Tänk dig att vi har ett enda punktljus (en
ljuskälla som lyser lika starkt åt alla håll) med strålningsflödet (23.47, 21.31, 20.79) översatt till en RGB-trippel.
Ljuskällans strålningsintensitet är lika med dess strålningsflöde i alla utgående riktningar. Men när vi skuggar en viss
punkt p på en yta kommer, av alla möjliga inkommande ljusriktningar över dess halvsfär Ω, bara en inkommande
riktningsvektor ωi direkt från punktljuset. Eftersom vi bara har en enda ljuskälla i scenen, antagen att ligga i en
enda punkt i rummet, har alla andra möjliga inkommande ljusriktningar radiansen noll i ytpunkten p.

Om vi till att börja med antar att ljusets dämpning (att ljuset blir svagare med avståndet) inte påverkar punktljuset, är
radiansen från den inkommande ljusstrålen densamma var vi än placerar ljuset (bortsett från skalningen med
infallsvinkeln cos θ). Det beror på att punktljuset har samma strålningsintensitet oavsett vinkeln vi ser det från, så
att dess strålningsintensitet i praktiken modelleras som dess strålningsflöde: en konstant vektor (23.47, 21.31, 20.79).

Radiansen tar dock också en position p som indata, och eftersom varje realistiskt punktljus tar hänsyn till dämpning
skalas punktljusets strålningsintensitet med något mått på avståndet mellan punkten p och ljuskällan. Sedan skalas
resultatet, enligt den ursprungliga radiansekvationen, med skalärprodukten mellan ytans normal n och den inkommande
ljusriktningen ωi.

Mer praktiskt uttryckt: för ett direkt punktljus mäter radiansfunktionen L ljusets färg, dämpad med avståndet till p och
skalad med n · ωi, men bara längs den enda ljusstråle ωi som träffar p, och den är lika med ljusets riktningsvektor från
p. I kod blir det:

```glsl
vec3  lightColor  = vec3(23.47, 21.31, 20.79);
vec3  wi          = normalize(lightPos - fragPos);
float cosTheta    = max(dot(Normal, wi), 0.0);
float attenuation = calculateAttenuation(fragPos, lightPos);
vec3  radiance    = lightColor * attenuation * cosTheta;
```

Bortsett från de nya termerna bör den här koden se mycket bekant ut: det är precis så vi har gjort diffus belysning
hittills. För direkt belysning räknas radiansen ut ungefär som vi har räknat ut belysning tidigare, eftersom bara en enda
ljusriktning bidrar till ytans radians.

Observera att antagandet håller eftersom punktljus är oändligt små och bara en enda punkt i rummet. Om vi modellerade ett
ljus med area eller volym skulle dess radians vara skild från noll i mer än en inkommande ljusriktning.

För andra typer av ljuskällor som utgår från en enda punkt räknar vi ut radiansen på liknande sätt. Ett riktat ljus har
till exempel en konstant ωi utan dämpningsfaktor. Och en spotlight har ingen konstant strålningsintensitet, utan en som
skalas med spotlightens riktningsvektor framåt.

Det här för oss också tillbaka till integralen ∫ över ytans halvsfär Ω. Eftersom vi på förhand vet exakt var alla
bidragande ljuskällor finns när vi skuggar en ytpunkt behöver vi inte försöka lösa integralen. Vi kan direkt ta det
(kända) antalet ljuskällor och räkna ut deras totala irradians, eftersom varje ljuskälla bara har en enda ljusriktning
som påverkar ytans radians. Det gör PBR med direkta ljuskällor ganska enkelt, eftersom vi i praktiken bara behöver loopa
över de bidragande ljuskällorna. När vi senare tar med ljus från omgivningen i IBL-kapitlen måste vi däremot ta hänsyn
till integralen, eftersom ljus då kan komma från alla håll.

## Projektet

Projektet är det du körde i slutet av förra kapitlet: learnopengls scen för PBR-belysning. 7 × 7 sfärer med radien 1,
2.5 enheter isär, på z = 0, med `metallic = row / 7` (nedersta raden 0, översta 0.857) och `roughness = clamp(col / 7,
0.05, 1.0)` (vänstra kolumnen 0.05, högra 0.857); varje sfär har albedot (0.5, 0.0, 0.0) och ao 1.0. Strävheten kläms
till minst 0.05 eftersom helt släta ytor (strävhet 0.0) brukar se lite konstiga ut med direkt ljus: ett punktljus
högdager skulle bli en oändligt liten punkt. Fyra punktljus hänger på (-10, 10, 10), (10, 10, 10), (-10, -10, 10) och
(10, -10, 10), vart och ett med färgen (300, 300, 300). learnopengl ritar också en liten sfär vid varje ljus; med kursens
kamera hamnar de utanför bilden, så kursen ritar dem inte.

Några tal skiljer sig från learnopengls program:

- **Kameran står på (0, 0, 22)** och tittar längs -z med 45° synfält: hela rutnätet, ungefär 17 enheter brett, ryms i
  fönstret. learnopengls kamera börjar på (0, 0, 3), mitt i rutnätet.
- **Sfären har 24 × 24 segment** i stället för learnopengls 64 × 64. Den inbyggda simulatorn körs på processorn och
  ritar varje triangel själv; en riktig GPU ritar learnopengls sfärer med 64 × 64 segment lika lätt. Med 24 segment blir
  sfärernas konturer lite kantiga, belysningen är densamma.
- Projektet har ingen multisampling (learnopengl ber GLFW om 4 samples), så att de tre API:erna ger samma bild.

Sfären är learnopengls `renderSphere()`: en *UV-sfär*, vars vertex ligger på ett rutnät med 25 × 25 punkter i (u, v) =
(xSegment, ySegment), där var och en görs om till en punkt på sfären:

```cpp
float xPos = std::cos(xSegment * 2.0f * PI) * std::sin(ySegment * PI);
float yPos = std::cos(ySegment * PI);
float zPos = std::sin(xSegment * 2.0f * PI) * std::sin(ySegment * PI);
```

Normalen för en enhetssfär är positionen själv, texturkoordinaterna är (xSegment, ySegment). Varje vertex har ett
attribut till som learnopengls sfär saknar: en **tangent**, `(-sin(2π · xSegment), 0, cos(2π · xSegment))` – riktningen
där u växer på ytan (positionens derivata med avseende på u, normerad). Den finns med från början, men bara den sista
uppgiften använder den. Indexen bildar en enda lång **triangle strip**: rutnätets rader gås igenom i sicksack – de jämna
från vänster till höger, de udda tillbaka från höger till vänster – och varje rad bidrar med två index per kolumn, ett i
raden och ett i nästa. 24 rader × 25 kolumner × 2 ger 1200 index för de 625 vertexen. I en triangle strip bildar varje
index efter de två första en triangel med de två före det, så en strip behöver ungefär ett index per triangel i stället
för tre.

:::opengl
`renderSphere()` bygger vertex array-objektet vid första anropet: 11 floats per vertex (position, normal,
texturkoordinater, tangent på location 0–3), en element buffer med de 1200 indexen, och sedan
`glDrawElements(GL_TRIANGLE_STRIP, indexCount, GL_UNSIGNED_INT, 0)` – i OpenGL är primitivtypen ett argument till
ritanropet. Före loopen sätter `main.cpp` de uniforms som är desamma för alla sfärer:

```cpp
    shader.use();
    shader.setVec3("albedo", 0.5f, 0.0f, 0.0f);
    shader.setFloat("ao", 1.0f);
```

och i renderloopen `projection`, `view`, `camPos` och ljusen (`"lightPositions[" + std::to_string(i) + "]"` – varje
element i en uniform-array har sin egen location), sedan per sfär `metallic`, `roughness`, `model` och `normalMatrix`
(`glm::transpose(glm::inverse(glm::mat3(model)))`, en `mat3`-uniform, som learnopengl gör).
:::
:::vulkan
`createSphere()` fyller `sphereVertices` och `sphereIndices` en gång; de kopieras via staging buffers till
`sphereVertexBuffer` och `sphereIndexBuffer`, och `renderSphere(commandBuffer)` binder båda och anropar
`vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(sphereIndices.size()), 1, 0, 0, 0)` med
`VK_INDEX_TYPE_UINT32`. I Vulkan är primitivtypen en del av pipelinen, inte av ritanropet:

```cpp
        inputAssembly.topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP; // the sphere is one long strip (learnopengl: GL_TRIANGLE_STRIP)
```

och `rasterizer.cullMode = VK_CULL_MODE_NONE`, eftersom learnopengls PBR-demon inte gör culling. Värdena som ändras per
sfär är push constants, inspelade i `recordCommandBuffer()` med learnopengls två loopar:

```cpp
struct PushConstants {
    glm::mat4 model;
    float metallic;
    float roughness;
};
```

72 byte, för vertex- och fragmentsteget (`vkCmdPushConstants` med `VK_SHADER_STAGE_VERTEX_BIT |
VK_SHADER_STAGE_FRAGMENT_BIT`). learnopengl skickar en `normalMatrix`-uniform; här räknar `pbr.vert` själv ut
`transpose(inverse(mat3(pc.model)))`, som i de tidigare kapitlen. Allt som är detsamma för alla sfärer ligger i uniform
buffern:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec4 lightPositions[4];
    glm::vec4 lightColors[4];
    glm::vec3 albedo;
    float ao;
    glm::vec3 camPos;
    float pad1;
};
```

std140 lägger elementen i en array 16 byte isär, så ljusens positioner och färger är `vec4` där shadern använder `.xyz`
/ `.rgb`. En `vec3` tar också 16 byte; `ao` får plats i de 4 byten efter `albedo`, och `pad1` fyller dem efter `camPos`.
:::
:::d3d12
`LoadAssets` bygger `std::vector<Vertex> vertices` och `std::vector<UINT> indices` med learnopengls loopar och kopierar
dem till `m_sphereVertexBuffer` och `m_sphereIndexBuffer`. Input layouten är POSITION / NORMAL / TEXCOORD / TANGENT på
byteoffseten 0, 12, 24, 32. Ett värde skiljer sig från learnopengls: texturkoordinaten är **(xSegment, 1 - ySegment)**,
eftersom bilderna inte vänds när de laddas – Direct3D:s v = 0 är en bilds första (översta) rad, OpenGL:s den nedersta,
så OpenGL vänder bilderna i stället. Båda samplar sedan samma texel i varje punkt på sfären. `RenderSphere()` ritar den:

```cpp
void D3D12App::RenderSphere()
{
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP);
    m_commandList->IASetVertexBuffers(0, 1, &m_sphereVertexBufferView);
    m_commandList->IASetIndexBuffer(&m_sphereIndexBufferView);
    m_commandList->DrawIndexedInstanced(m_indexCount, 1, 0, 0, 0);
}
```

Pipeline staten behöver inte ändras för en strip: dess `PrimitiveTopologyType` är
`D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE` för både listor och strips; vilken av dem som ritas väljs i command listen med
`IASetPrimitiveTopology`. Ingenting cullas (`D3D12_CULL_MODE_NONE`). Per sfär skickar `RenderScene()` 38
root-konstanter (root-parameter 0, `cbuffer ModelConstants : register(b0)`):

```cpp
    struct ModelConstants
    {
        XMFLOAT4X4 model;
        XMFLOAT4X4 normalMatrix;    // transpose(inverse(model)), for the normals
        // material parameters
        XMFLOAT3 albedo;
        float metallic;
        float roughness;
        float ao;
    };
```

`albedo` och `metallic` delar på en 16-bytesrad, både i HLSL och i C++-structen. Normalmatrisen är
`XMMatrixInverse(nullptr, model)`: lagrad transponerad för HLSL, som alla matriser, blir transponatet av inversen
inversen själv. Constant buffern (b1) innehåller `view`, `projection`, `XMFLOAT4 lightPositions[4]`, `XMFLOAT4
lightColors[4]` och `camPos` – `float4`, eftersom varje element i en HLSL-array i en constant buffer börjar på en ny
16-bytesrad; shadern använder `.xyz` / `.rgb`.
:::

```quiz
Ljusen har färgen (300, 300, 300) – mycket mer än de tidigare kapitlens 1.0. Varför blir inte varje sfär vit?
- [ ] Eftersom shadern delar varje ljusfärg med 255
- [ ] Eftersom bara ett av de fyra ljusen används per sfär
- [x] Eftersom radiansen avtar med kvadraten på avståndet: ett ljus på (-10, 10, 10) ligger ungefär 17.3 enheter från rutnätets mitt, och 1 / 17.3² ≈ 1/300 för tillbaka det till ungefär 1.0
- [ ] Eftersom fönstret kan lagra värden upp till 300
---
`attenuation = 1.0 / (distance * distance)` är ett punktljus fysikaliskt korrekta avtagande (och det rätta i linjärt rum, som kapitlet Gammakorrigering visade). Med realistisk dämpning måste också ljusets styrka vara realistisk.
```

:::opengl
```quiz
Sfärens index bildar en enda triangle strip. Var säger OpenGL-projektet att de ska läsas som en strip och inte som en lista av trianglar?
- [ ] I vertex array-objektet, med `glVertexAttribPointer`
- [x] I själva ritanropet: `glDrawElements(GL_TRIANGLE_STRIP, indexCount, GL_UNSIGNED_INT, 0)` – samma buffrar ritade med `GL_TRIANGLES` skulle ge utspridda felaktiga trianglar
- [ ] I `pbr.vs`, med en kvalificerare `layout (triangle_strip)`
- [ ] Ingenstans: OpenGL känner igen en strip på indexens ordning
---
I OpenGL är primitivtypen ett argument till varje ritanrop, så ett och samma VAO skulle till och med kunna ritas på båda sätten. En strip med n index ger n − 2 trianglar, var och en av ett index och de två före det.
```
:::
:::vulkan
```quiz
Sfärens index bildar en enda triangle strip. Var säger Vulkan-projektet att de ska läsas som en strip och inte som en lista av trianglar?
- [ ] I `vkCmdDrawIndexed`, vars sista argument är topologin
- [ ] I index bufferns usage-flaggor, `VK_BUFFER_USAGE_INDEX_BUFFER_BIT`
- [ ] I `pbr.vert`, med en kvalificerare `layout(triangle_strip)`
- [x] I pipelinen: `inputAssembly.topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP` – en pipeline görs för en sorts primitiv, så att rita en triangellista skulle kräva en andra pipeline
---
Input assembly-tillståndet är inbakat i pipelinen. (IBL-kapitlen behöver precis det: sfärerna är en strip, kuben är en lista, så `createPipeline` får en parameter för topologin.)
```
:::
:::d3d12
```quiz
Sfärens index bildar en enda triangle strip. Var säger Direct3D 12-projektet att de ska läsas som en strip och inte som en lista av trianglar?
- [ ] Bara i pipeline staten: `PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE` betyder strip
- [ ] I index buffer-vyns `Format`, `DXGI_FORMAT_R32_UINT`
- [x] I command listen: `IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP)` före ritanropet; pipeline staten säger bara "trianglar", vilket täcker både listor och strips
- [ ] I `VSMain`, med semantiken `SV_PrimitiveID`
---
Pipeline staten bestämmer vilken typ av primitiv (punkt, linje, triangel, patch) shadrarna är gjorda för; om trianglarna kommer som lista eller strip är command list-tillstånd och kan ändras mellan ritanrop med samma pipeline state.
```
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Varje uppgift är ett steg i learnopengls shader, och
**Build & run** (Ctrl+Enter) visar efter varje steg hur sfärerna förändras.

## En PBR-ytmodell

Vi börjar med att skriva en fragment shader som implementerar PBR-modellerna ovan. Först behöver vi de PBR-indata som
krävs för att skugga ytan:

:::opengl
```glsl
#version 330 core
out vec4 FragColor;
in vec2 TexCoords;
in vec3 WorldPos;
in vec3 Normal;

// material parameters
uniform vec3 albedo;
uniform float metallic;
uniform float roughness;
uniform float ao;

// lights
uniform vec3 lightPositions[4];
uniform vec3 lightColors[4];

uniform vec3 camPos;
```

Vi tar de vanliga indata som en vanlig vertex shader räknar ut och en uppsättning konstanta materialegenskaper över
objektets yta. I början av fragment shadern gör vi sedan de vanliga beräkningar som alla belysningsalgoritmer behöver:

```glsl
void main()
{
    vec3 N = normalize(Normal);
    vec3 V = normalize(camPos - WorldPos);
```
:::
:::vulkan
```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    // lights
    vec4 lightPositions[4];
    vec4 lightColors[4];
    // material parameters (the same for every sphere)
    vec3 albedo;
    float ao;
    vec3 camPos;
} ubo;

// material parameters (one sphere's): they come after the model matrix
layout(push_constant) uniform PushConstants {
    mat4 model;
    float metallic;
    float roughness;
} pc;

layout(location = 0) in vec2 fragTexCoord;
layout(location = 1) in vec3 fragWorldPos;
layout(location = 2) in vec3 fragNormal;

layout(location = 0) out vec4 outColor;
```

Vi tar de vanliga indata från vertex shadern, materialet från uniform buffern och push constants, och i början av `main`
kopierar vi materialet till lokala variabler – så att resten av shadern läses som learnopengls – och gör de vanliga
beräkningar som alla belysningsalgoritmer behöver:

```glsl
void main() {
    vec3 albedo     = ubo.albedo;
    float metallic  = pc.metallic;
    float roughness = pc.roughness;
    float ao        = ubo.ao;

    vec3 N = normalize(fragNormal);
    vec3 V = normalize(ubo.camPos - fragWorldPos);
```
:::
:::d3d12
`pbr.hlsl` deklarerar de två cbuffers som beskrevs ovan och gränssnittet mellan shadrarna:

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoords : TEXCOORD;
    float3 worldPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
};
```

Materialets `albedo`, `metallic`, `roughness` och `ao` kommer direkt från cbuffern `ModelConstants`, ljusen och `camPos`
från `SceneConstantBuffer`. I början av `PSMain` gör vi de vanliga beräkningar som alla belysningsalgoritmer behöver:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 N = normalize(input.normal);
    float3 V = normalize(camPos - input.worldPos);
```

HLSL mot learnopengls GLSL, för hela kapitlet: `vec3` → `float3`, `mix` → `lerp`, `WorldPos` → `input.worldPos`,
`lightPositions[i]` → `lightPositions[i].xyz`, `FragColor = …` → `return …`.
:::

### Direkt belysning

I kapitlets exempel har vi sammanlagt 4 punktljus som tillsammans utgör scenens irradians. För att uppfylla
reflektansekvationen loopar vi över varje ljuskälla, räknar ut dess radians och summerar dess bidrag skalat med BRDF:en
och ljusets infallsvinkel. Vi kan se loopen som att lösa integralen ∫ över Ω för direkta ljuskällor. Först räknar vi ut
de variabler som gäller per ljus:

:::opengl
```glsl
    vec3 Lo = vec3(0.0);
    for(int i = 0; i < 4; ++i)
    {
        // calculate per-light radiance
        vec3 L = normalize(lightPositions[i] - WorldPos);
        float distance = length(lightPositions[i] - WorldPos);
        float attenuation = 1.0 / (distance * distance);
        vec3 radiance = lightColors[i] * attenuation;
```
:::
:::vulkan
```glsl
    vec3 Lo = vec3(0.0);
    for (int i = 0; i < 4; ++i) {
        // calculate per-light radiance
        vec3 L = normalize(ubo.lightPositions[i].xyz - fragWorldPos);
        float distance = length(ubo.lightPositions[i].xyz - fragWorldPos);
        float attenuation = 1.0 / (distance * distance);
        vec3 radiance = ubo.lightColors[i].rgb * attenuation;
```
:::
:::d3d12
```hlsl
    float3 Lo = float3(0.0f, 0.0f, 0.0f);
    for (int i = 0; i < 4; ++i)
    {
        // calculate per-light radiance
        float3 L = normalize(lightPositions[i].xyz - input.worldPos);
        float distance = length(lightPositions[i].xyz - input.worldPos);
        float attenuation = 1.0f / (distance * distance);
        float3 radiance = lightColors[i].rgb * attenuation;
```
:::

Eftersom vi räknar ut belysningen i linjärt rum (vi gammakorrigerar i slutet av shadern) dämpar vi ljuskällorna med den
fysikaliskt mer korrekta *omvända kvadratlagen*. Även om den är fysikaliskt korrekt kanske du ändå vill använda
ekvationen med konstant, linjär och kvadratisk term, som (fast den inte är fysikaliskt korrekt) ger dig mycket mer
kontroll över hur ljusets energi avtar.

Vi börjar med den enklaste BRDF som finns: den Lambertska diffusen ensam, `albedo / π`, multiplicerad med radiansen och
med ljusets infallsvinkel n · ωi. Loopen slutar med:

:::opengl
```glsl
        // scale light by NdotL
        float NdotL = max(dot(N, L), 0.0);

        // add to outgoing radiance Lo
        Lo += (albedo / PI) * radiance * NdotL; // only the diffuse (Lambert) term for now
    }
```
:::
:::vulkan
```glsl
        // scale light by NdotL
        float NdotL = max(dot(N, L), 0.0);

        // add to outgoing radiance Lo
        Lo += (albedo / PI) * radiance * NdotL; // only the diffuse (Lambert) term for now
    }
```
:::
:::d3d12
```hlsl
        // scale light by NdotL
        float NdotL = max(dot(N, L), 0.0f);

        // add to outgoing radiance Lo
        Lo += (albedo / PI) * radiance * NdotL; // only the diffuse (Lambert) term for now
    }
```
:::

Efter loopen lägger shadern redan till den konstanta ambienta termen `0.03 * albedo * ao` och skriver färgen. Gör nu den
första uppgiften, **lambert**: skriv ljusloopen.

Tryck på **Build & run**: sfärerna är **matt röda**, alla 49 likadana – metallic och roughness används inte ännu. Varje
sfär är ljusare på sidorna som vetter mot ljusen, och sfärerna nära rutnätets hörn är ljusare än den i mitten, eftersom
de ligger närmare ett ljus: mittsfären ligger ungefär 17 enheter från varje ljus, en hörnsfär bara ungefär 10.6 från det
närmaste. Bara den röda kanalen är belyst (albedot är rent rött), och inget är mättat.

### Normalfördelningsfunktionen

Sedan vill vi för varje ljus räkna ut hela Cook-Torrances spekulära BRDF-term. Vi bygger den en funktion i taget och
börjar med normalfördelningsfunktionen. Den behöver halvvägsvektorn mellan ljus- och vyriktningen, som räknas ut direkt
efter `L` i loopen:

:::opengl vulkan
```glsl
        vec3 H = normalize(V + L);
```
:::
:::d3d12
```hlsl
        float3 H = normalize(V + L);
```
:::

Funktionen är förra kapitlets Trowbridge-Reitz GGX, med strävheten kvadrerad först:

:::opengl vulkan
```glsl
float DistributionGGX(vec3 N, vec3 H, float roughness)
{
    float a = roughness*roughness;
    float a2 = a*a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / denom;
}
```
:::
:::d3d12
```hlsl
float DistributionGGX(float3 N, float3 H, float roughness)
{
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0f);
    float NdotH2 = NdotH * NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0f) + 1.0f);
    denom = PI * denom * denom;

    return nom / denom;
}
```

Parametern `roughness` skymmer cbufferns värde med samma namn inne i funktionen – precis som i learnopengls GLSL, där den
skymmer uniformen.
:::

För att se vad NDF:en gör ensam använder uppgiften den tills vidare som hela den spekulära termen och lägger den till den
diffusa termen:

:::opengl vulkan
```glsl
        // Cook-Torrance BRDF: only the normal distribution function for now
        float NDF = DistributionGGX(N, H, roughness);
        vec3 specular = vec3(NDF);
```

och `Lo += (albedo / PI + specular) * radiance * NdotL;` i slutet av loopen.
:::
:::d3d12
```hlsl
        // Cook-Torrance BRDF: only the normal distribution function for now
        float NDF = DistributionGGX(N, H, roughness);
        float3 specular = float3(NDF, NDF, NDF);
```

och `Lo += (albedo / PI + specular) * radiance * NdotL;` i slutet av loopen.
:::

Gör nu uppgiften **ndf**. Tryck på **Build & run**: **bländande vita högdagrar som växer med strävheten**, likadana i
varje rad. I vänstra kolumnen (strävhet 0.05) har varje sfär fyra pyttesmå vita prickar – en reflektion per ljus –, i
mittkolumnerna har de vuxit till fyra feta vita fläckar, och sfärerna i högra kolumnen är vita över hela ytan. Det är vad
NDF:en är: för en slät yta är den enorm där halvvägsvektorn sammanfaller med normalen och nästan noll överallt annars, för
en sträv yta är den utspridd över hela sfären. Men inget begränsar den ännu: den spekulära termen delas inte med
normaliseringsfaktorn och det finns ingen Fresnelfaktor, så sfärerna reflekterar mycket mer ljus än vad som kommer in.

```quiz
Efter uppgiften ndf är de sträva sfärerna till höger vita över hela ytan. Varför?
- [x] En sträv ytas NDF är utspridd, så den är stor nästan överallt på sfären; utan nämnaren 4 (ωo · n)(ωi · n), geometrifunktionen och Fresnelfaktorn håller inget det reflekterade ljuset under det ljus som kommer in, och varje kanal klipps vid 1.0
- [ ] NDF:en ger 1.0 för varje sträv yta, en spegels värde
- [ ] Halvvägsvektorn är inte normerad, så N · H blir större än 1
- [ ] Strävheten kvadreras två gånger, en gång i main.cpp och en gång i shadern
---
NDF:en är en täthet av mikrofasettnormaler; ensam är den ännu ingen BRDF som bevarar energin. De två nästa uppgifterna lägger till resten av Cook-Torrance-termen.
```

### Geometrifunktionen

Geometrifunktionen är Smiths metod med Schlick-GGX och k för direkt ljus, `k = (roughness + 1)² / 8`:

:::opengl vulkan
```glsl
float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}
// ----------------------------------------------------------------------------
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}
```
:::
:::d3d12
```hlsl
float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0f);
    float k = (r * r) / 8.0f;

    float nom   = NdotV;
    float denom = NdotV * (1.0f - k) + k;

    return nom / denom;
}
// ----------------------------------------------------------------------------
float GeometrySmith(float3 N, float3 V, float3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0f);
    float NdotL = max(dot(N, L), 0.0f);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}
```
:::

I loopen blir den spekulära termen NDF:en gånger geometrifunktionen, delat med Cook-Torrances normaliseringsfaktor:

:::opengl vulkan
```glsl
        float G   = GeometrySmith(N, V, L, roughness);

        vec3 numerator    = vec3(NDF * G);
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; // + 0.0001 to prevent divide by zero
        vec3 specular = numerator / denominator;
```
:::
:::d3d12
```hlsl
        float G   = GeometrySmith(N, V, L, roughness);

        float numerator   = NDF * G;
        float denominator = 4.0f * max(dot(N, V), 0.0f) * max(dot(N, L), 0.0f) + 0.0001f; // + 0.0001 to prevent divide by zero
        float3 specular = numerator / denominator;
```

Divisionen ger en enda float; när den tilldelas en `float3` kopieras den till de tre kanalerna.
:::

Observera att vi lägger till 0.0001 i nämnaren för att undvika division med noll om någon skalärprodukt blir 0.0. Gör nu
uppgiften **geometry**. Tryck på **Build & run**: högdagrarna är **mindre och svagare på de sträva sfärerna**, som nu är
rosa i stället för vita; mitten av högdagrarna på de släta sfärerna och på dem i mitten är fortfarande vit. Varje sfär
reflekterar fortfarande som en perfekt spegel i sin högdager – inget beror ännu på vad sfären är gjord av, så raderna ser
fortfarande likadana ut.

### Fresnelekvationen

Fresnelekvationen är Fresnel-Schlick-approximationen, klämd så att `pow` aldrig får en negativ bas:

:::opengl vulkan
```glsl
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
```
:::
:::d3d12
```hlsl
float3 fresnelSchlick(float cosTheta, float3 F0)
{
    return F0 + (1.0f - F0) * pow(clamp(1.0f - cosTheta, 0.0f, 1.0f), 5.0f);
}
```
:::

Fresnel-Schlick-approximationen förväntar sig en parameter F0, som kallas *ytreflektionen vid infallsvinkeln noll*,
alltså hur mycket ytan reflekterar om man tittar rakt på den. F0 varierar mellan material och är färgad för metaller, som
vi ser i stora materialdatabaser. I PBR:s metalliska arbetsflöde gör vi det förenklade antagandet att de flesta
dielektriska ytor ser visuellt korrekta ut med en konstant F0 på 0.04, medan vi anger F0 för metalliska ytor genom
albedovärdet. I kod blir det så här, före loopen:

:::opengl vulkan
```glsl
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, metallic);
```
:::
:::d3d12
```hlsl
    float3 F0 = float3(0.04f, 0.04f, 0.04f);
    F0 = lerp(F0, albedo, metallic);
```

(`lerp` är HLSL:s `mix`.)
:::

Som du ser är F0 alltid 0.04 för icke-metalliska ytor. För metalliska ytor varierar vi F0 genom att interpolera linjärt
mellan det ursprungliga F0 och albedovärdet utifrån egenskapen metallic. I loopen räknas F ut med halvvägs- och
vyvektorn och multipliceras in i den spekulära termen. Eftersom Fresnelvärdet direkt motsvarar kS kan vi sedan använda F
för att beteckna det spekulära bidraget från allt ljus som träffar ytan. Ur kS räknar vi sedan ut andelen brutet ljus kD:

:::opengl vulkan
```glsl
        vec3 F    = fresnelSchlick(clamp(dot(H, V), 0.0, 1.0), F0);

        vec3 numerator    = NDF * G * F;
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; // + 0.0001 to prevent divide by zero
        vec3 specular = numerator / denominator;

        // kS is equal to Fresnel
        vec3 kS = F;
        // for energy conservation, the diffuse and specular light can't
        // be above 1.0 (unless the surface emits light); to preserve this
        // relationship the diffuse component (kD) should equal 1.0 - kS.
        vec3 kD = vec3(1.0) - kS;
        // multiply kD by the inverse metalness such that only non-metals
        // have diffuse lighting, or a linear blend if partly metal (pure metals
        // have no diffuse light).
        kD *= 1.0 - metallic;
```
:::
:::d3d12
```hlsl
        float3 F  = fresnelSchlick(clamp(dot(H, V), 0.0f, 1.0f), F0);

        float3 numerator  = NDF * G * F;
        float denominator = 4.0f * max(dot(N, V), 0.0f) * max(dot(N, L), 0.0f) + 0.0001f; // + 0.0001 to prevent divide by zero
        float3 specular = numerator / denominator;

        // kS is equal to Fresnel
        float3 kS = F;
        // for energy conservation, the diffuse and specular light can't
        // be above 1.0 (unless the surface emits light); to preserve this
        // relationship the diffuse component (kD) should equal 1.0 - kS.
        float3 kD = float3(1.0f, 1.0f, 1.0f) - kS;
        // multiply kD by the inverse metalness such that only non-metals
        // have diffuse lighting, or a linear blend if partly metal (pure metals
        // have no diffuse light).
        kD *= 1.0f - metallic;
```
:::

Eftersom kS står för energin i ljuset som reflekteras är den återstående andelen ljusenergi det ljus som bryts, och det
lagrar vi som kD. Eftersom metalliska ytor inte bryter ljus och därför saknar diffusa reflektioner upprätthåller vi den
egenskapen genom att nollställa kD om ytan är metallisk. Det ger oss de sista data vi behöver för att räkna ut varje ljus
utgående reflektansvärde:

:::opengl
```glsl
        // add to outgoing radiance Lo
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;  // note that we already multiplied the BRDF by the Fresnel (kS) so we won't multiply by kS again
```
:::
:::vulkan
```glsl
        // add to outgoing radiance Lo
        Lo += (kD * albedo / PI + specular) * radiance * NdotL; // note that we already multiplied the BRDF by the Fresnel (kS) so we won't multiply by kS again
```
:::
:::d3d12
```hlsl
        // add to outgoing radiance Lo
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;  // note that we already multiplied the BRDF by the Fresnel (kS) so we won't multiply by kS again
```
:::

Det resulterande värdet Lo, den utgående radiansen, är i praktiken resultatet av reflektansekvationens integral ∫ över
Ω. Vi behöver egentligen inte försöka lösa integralen för alla möjliga inkommande ljusriktningar, eftersom vi vet exakt
vilka 4 inkommande ljusriktningar som kan påverka fragmentet. Därför kan vi loopa direkt över de inkommande
ljusriktningarna, det vill säga över antalet ljus i scenen.

Det som återstår är att lägga till en (improviserad) ambient term till den direkta belysningens resultat Lo, så har vi
fragmentets slutliga belysta färg – projektet har den redan efter loopen:

:::opengl vulkan
```glsl
    vec3 ambient = vec3(0.03) * albedo * ao;

    vec3 color = ambient + Lo;
```
:::
:::d3d12
```hlsl
    float3 ambient = float3(0.03f, 0.03f, 0.03f) * albedo * ao;

    float3 color = ambient + Lo;
```
:::

Gör nu uppgiften **fresnel**. Tryck på **Build & run**: **nu skiljer sig raderna åt**. Den nedersta raden (icke-metall)
behåller sin röda diffusa färg med små vitaktiga högdagrar – ett dielektrikums reflektion är inte färgad. Uppåt (metall)
försvinner det diffusa ljuset och högdagrarna får albedots röda färg; den översta raden är nästan svart så när som på sina
röda högdagrar. Bilden är dock mörk och hård: färgerna är linjära och klipps vid 1.0.

```quiz
Varför är sfärerna i de översta raderna så mörka utom i sina högdagrar efter uppgiften fresnel?
- [ ] Eftersom F0 = 0.04 för metaller, så att de bara reflekterar 4 % av ljuset
- [ ] Eftersom geometrifunktionen skuggar alla mikrofasetter hos metaller
- [ ] Eftersom ljusen sitter under rutnätet och bara når de nedersta raderna
- [x] Eftersom `kD *= 1.0 - metallic` tar bort deras diffusa ljus: metaller absorberar allt brutet ljus, så en (nästan) ren metall visar bara sin spekulära reflektion, färgad av F0 = albedo
---
Den översta raden har metallic = 6/7, så bara 1/7 av dess diffusa ljus finns kvar. Dess reflektioner är röda eftersom F0 blandas mot albedot; den nedersta radens högdagrar är vita eftersom ett dielektrikums F0 är samma 0.04 för alla färger.
```

## Linjär rendering och HDR

Hittills har vi antagit att alla belysningsberäkningar sker i linjärt rum, och för att ta hänsyn till det måste vi
gammakorrigera i slutet av shadern. Att räkna ut belysningen i linjärt rum är oerhört viktigt, eftersom PBR kräver att
alla indata är linjära. Tar man inte hänsyn till det blir belysningen fel. Dessutom vill vi att ljusens indata ska ligga
nära sina fysikaliska motsvarigheter, så att deras radians eller färgvärden kan variera kraftigt över ett stort omfång.
Därför kan Lo snabbt bli riktigt stort, och då kläms det mellan 0.0 och 1.0 av standardutdata med lågt dynamiskt omfång
(LDR). Det löser vi genom att tonmappa (eller exponeringsmappa) Lo från högt dynamiskt omfång (HDR) till LDR på rätt sätt
före gammakorrigeringen:

:::opengl
```glsl
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0/2.2));
```
:::
:::vulkan
```glsl
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));
```
:::
:::d3d12
```hlsl
    color = color / (color + float3(1.0f, 1.0f, 1.0f));
    color = pow(color, 1.0f / 2.2f);
```
:::

Här tonmappar vi HDR-färgen med Reinhard-operatorn, som bevarar det höga dynamiska omfånget hos en irradians som kan
variera kraftigt, och därefter gammakorrigerar vi färgen. Vi har ingen separat framebuffer eller efterbehandling, så vi
kan göra både tonmappningen och gammakorrigeringen direkt i slutet av forward-fragment shadern. Ordningen spelar roll:
tonmappningen arbetar på de linjära HDR-värdena, och gammakorrigeringen kodar resultatet för skärmen som allra sista steg
– exakt en gång (kapitlet *Gammakorrigering*).

:::vulkan
Swap chain-formatet är `B8G8R8A8_UNORM`, som i alla kapitel, så shadern gammakorrigerar själv. Med ett `_SRGB`-format
för swap chainen skulle hårdvaran göra `pow` i stället, och shadern skulle behöva hoppa över det.
:::
:::d3d12
Back buffern är `DXGI_FORMAT_R8G8B8A8_UNORM` med en `UNORM`-render target view, som i alla kapitel, så shadern
gammakorrigerar själv. Med en `_SRGB`-render target view skulle hårdvaran göra `pow` i stället, och shadern skulle behöva
hoppa över det.
:::

Att ta hänsyn till både linjärt färgrum och högt dynamiskt omfång är oerhört viktigt i en PBR-pipeline. Utan dem går det
inte att fånga de ljusa och mörka detaljerna hos varierande ljusstyrkor ordentligt, och beräkningarna blir felaktiga och
därmed fula.

```quiz
Uppgiften tone-map lägger till `color = color / (color + 1.0)` och sedan `color = pow(color, 1.0/2.2)`. Varför i den ordningen, och varför här?
- [ ] Gamma först, så att Reinhard arbetar på de färger skärmen visar
- [x] Reinhard avbildar det obegränsade linjära (HDR-)resultatet på 0..1 utan att klippa högdagrarna; gammakorrigeringen kodar sedan det linjära resultatet för skärmen, en gång, som sista steg – och eftersom det inte finns något efterbehandlingspass sker båda i slutet av den här shadern
- [ ] Båda behövs bara för att ljusen är vita; med färgade ljus kunde färgen skrivas som den är
- [ ] Ordningen spelar ingen roll: båda funktionerna är linjära
---
Belysningsmatematiken behöver linjära värden och är inte begränsad av 1.0. Reinhard är inte linjär, så den måste se de linjära värdena; gammakodningen måste komma efter allt annat, annars skulle senare steg arbeta på kodade värden.
```

## Fullständig PBR-shader för direkt belysning

Nu återstår bara att sätta ihop allt: indata, BRDF:ens tre funktioner, loopen med hela reflektansekvationen, den ambienta
termen, tonmappningen och gammakorrigeringen. Gör nu uppgiften **tone-map**.

Tryck på **Build & run**: det här är learnopengls bild. Sfärerna är ljusare och mjukare, och högdagrarna klipps inte
längre. Nerifrån och upp ser den nedersta raden ut som röd plast, blank till vänster och matt till höger, med små vita
högdagrar på de släta och breda, svaga glansytor på de sträva; den översta raden är mörkröd metall vars reflektioner är
röda, skarpa till vänster och breda och svaga till höger. Varje sfär ser olika ut, fast alla har samma albedo: strävheten
och metallgraden ensamma gör skillnaden. Clear-färgen runt dem tonmappas inte, så den förblir samma grå.

Ta en stund och jämför bilden med de tidigare delarnas Blinn-Phong-sfärer: ingenstans har vi justerat en spekulär styrka
eller en glansexponent. Högdagerns storlek följer av strävheten, dess ljusstyrka av energibevarandet och dess färg av
metallgraden. Ljusens (300, 300, 300) är en fysikalisk storhet; ett ljus på halva avståndet skulle vara fyra gånger så
starkt, utan några konstanta, linjära eller kvadratiska termer att justera.

## Texturerad PBR

Genom att låta systemet ta sina ytparametrar som texturer i stället för uniform-värden får vi kontroll per fragment över
ytmaterialets egenskaper. learnopengls andra demo (`1.2.lighting_textured`) gör det med sitt material av rostigt järn;
kursen använder sitt eget material: **nitat stål med rostfläckar**, fem mappar på 256 × 256 (`albedo.png`, `normal.png`,
`metallic.png`, `roughness.png`, `ao.png`). Shadern läser materialet i början av `main` i stället för från uniforms:

:::opengl
```glsl
uniform sampler2D albedoMap;
uniform sampler2D normalMap;
uniform sampler2D metallicMap;
uniform sampler2D roughnessMap;
uniform sampler2D aoMap;

void main()
{
    vec3 albedo     = pow(texture(albedoMap, TexCoords).rgb, vec3(2.2));
    float metallic  = texture(metallicMap, TexCoords).r;
    float roughness = texture(roughnessMap, TexCoords).r;
    float ao        = texture(aoMap, TexCoords).r;

    vec3 N = getNormalFromMap();
    vec3 V = normalize(camPos - WorldPos);
```
:::
:::vulkan
```glsl
layout(binding = 1) uniform sampler2D albedoMap;
layout(binding = 2) uniform sampler2D normalMap;
layout(binding = 3) uniform sampler2D metallicMap;
layout(binding = 4) uniform sampler2D roughnessMap;
layout(binding = 5) uniform sampler2D aoMap;

void main() {
    vec3 albedo     = pow(texture(albedoMap, fragTexCoord).rgb, vec3(2.2));
    float metallic  = texture(metallicMap, fragTexCoord).r;
    float roughness = texture(roughnessMap, fragTexCoord).r;
    float ao        = texture(aoMap, fragTexCoord).r;

    vec3 N = getNormalFromMap();
    vec3 V = normalize(ubo.camPos - fragWorldPos);
```
:::
:::d3d12
```hlsl
Texture2D albedoMap : register(t0);
Texture2D normalMap : register(t1);
Texture2D metallicMap : register(t2);
Texture2D roughnessMap : register(t3);
Texture2D aoMap : register(t4);
// The sampler: register s0, the static sampler of the root signature (linear, WRAP).
SamplerState wrapSampler : register(s0);

float4 PSMain(PSInput input) : SV_TARGET
{
    float3 albedo   = pow(albedoMap.Sample(wrapSampler, input.texCoords).rgb, 2.2f);
    float metallic  = metallicMap.Sample(wrapSampler, input.texCoords).r;
    float roughness = roughnessMap.Sample(wrapSampler, input.texCoords).r;
    float ao        = aoMap.Sample(wrapSampler, input.texCoords).r;

    float3 N = getNormalFromMap(input);
    float3 V = normalize(camPos - input.worldPos);
```
:::

Resten av shadern förblir som den är: dess `albedo`, `metallic`, `roughness` och `ao` är nu lokala variabler. Observera
att albedotexturer från grafiker i regel är skapade i sRGB-rummet, och därför omvandlar vi dem först till linjärt rum
innan albedot används i belysningsberäkningarna. Beroende på hur grafikerna tar fram ambient occlusion-mappar kan du
behöva omvandla även dem från sRGB till linjärt; kursens mappar för metallic, roughness och ambient occlusion är linjära
data som läses från sin röda kanal. Att ladda albedot som en sRGB-textur skulle göra `pow` i samplern i stället, som i
kapitlet *Gammakorrigering*; learnopengl omvandlar i shadern, och det gör kursen också.

### Normalen från normal mappen

learnopengls `getNormalFromMap()` bygger tangentrummet från derivator i skärmrummet – `dFdx` / `dFdy` av
världspositionen och texturkoordinaterna – "för att hålla det enkelt". Kursen gör i stället som i kapitlet *Normal
mapping*: sfären har en tangent per vertex, vertex shadern vrider den med modellmatrisen (en tangent ligger i ytan, så
den vrids med ytan, inte med normalmatrisen), och fragment shadern gör den interpolerade tangenten vinkelrät mot normalen
igen (Gram-Schmidt) och kompletterar TBN-matrisen med bitangenten:

:::opengl
```glsl
vec3 getNormalFromMap()
{
    vec3 tangentNormal = texture(normalMap, TexCoords).xyz * 2.0 - 1.0;

    vec3 N = normalize(Normal);
    vec3 T = normalize(Tangent);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    vec3 B = cross(N, T);
    mat3 TBN = mat3(T, B, N);

    return normalize(TBN * tangentNormal);
}
```

`pbr.vs` får `layout (location = 3) in vec3 aTangent;`, `out vec3 Tangent;` och `Tangent = mat3(model) * aTangent;`,
och `pbr.fs` `in vec3 Tangent;`.
:::
:::vulkan
```glsl
vec3 getNormalFromMap() {
    vec3 tangentNormal = texture(normalMap, fragTexCoord).xyz * 2.0 - 1.0;

    vec3 N = normalize(fragNormal);
    vec3 T = normalize(fragTangent);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    vec3 B = cross(N, T);
    mat3 TBN = mat3(T, B, N);

    return normalize(TBN * tangentNormal);
}
```

`pbr.vert` får `layout(location = 3) out vec3 fragTangent;` och `fragTangent = mat3(pc.model) * inTangent;`, och
`pbr.frag` motsvarande indata på location 3.
:::
:::d3d12
```hlsl
float3 getNormalFromMap(PSInput input)
{
    float3 tangentNormal = normalMap.Sample(wrapSampler, input.texCoords).xyz * 2.0f - 1.0f;

    float3 N = normalize(input.normal);
    float3 T = normalize(input.tangent);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    // B points the way the image's rows go up on the sphere: the normal map's green axis
    float3 B = cross(N, T);
    // T, B and N as the rows: with the vector on the left, mul gives x * T + y * B + z * N
    // (learnopengl: mat3(T, B, N) * tangentNormal)
    float3x3 TBN = float3x3(T, B, N);

    return normalize(mul(tangentNormal, TBN));
}
```

HLSL har inga globala indata, så funktionen tar `PSInput`. `VSMain` får ett fjärde indata `float3 tangent : TANGENT`,
`PSInput` ett fjärde fält, och `result.tangent = mul(float4(tangent, 0.0f), model).xyz;` – w = 0, som för alla
riktningar. `float3x3(T, B, N)` har T, B och N som *rader*, så vektorn står till vänster i `mul`; det är learnopengls
`mat3(T, B, N) * tangentNormal`, vars `mat3` har dem som kolumner.
:::

Varför inte learnopengls derivator? De ger en tangent per triangel (derivatorna är konstanta över en triangel), så
belysningen visar sfärens fasetter; vertexens tangent är jämn. Och den fungerar likadant i alla API:er och i simulatorn.
Varför `B = cross(N, T)` och inte `cross(T, N)`? T pekar dit u växer; normal mappens gröna kanal betyder "uppåt i
bilden", alltså dit bildens rader går uppåt – och med sfärens texturkoordinater är det `cross(N, T)`.

:::opengl
Bilderna vänds när de laddas (`stbi_set_flip_vertically_on_load(true)` i `loadTexture`, som i alla OpenGL-kapitel), så
v = 0 är bildens nedersta rad. Sfärens v är 0 upptill (y = +1), så texturerna syns vridna 180° på sfären – vridna, inte
speglade, så normal mappens riktningar förblir rätt.
:::
:::vulkan
Den förberedda `loadTexture` vänder bilderna när de laddas (`stbi_set_flip_vertically_on_load(true)`), så v = 0 är
bildens nedersta rad, som i OpenGL – sfärens texturkoordinater och normal mappens gröna axel förutsätter det. Sfärens v
är 0 upptill (y = +1), så texturerna syns vridna 180° på sfären – vridna, inte speglade.
:::
:::d3d12
Bilderna vänds inte; sfärens v är `1 - ySegment` i stället. Tillsammans samplar de samma texel som OpenGL i varje punkt på
sfären, och samma formler i världsrummet gäller. (Fyrhörningen i kapitlet *Normal mapping* hade sitt v växande nedåt i
bilden och vände därför normal mappens y; här har det vända v redan gjort det.) Texturerna syns vridna 180° på sfären,
som i OpenGL.
:::

### Att ladda de fem mapparna

:::opengl
`main.cpp` laddar de fem mapparna med de tidigare kapitlens `loadTexture` (linjär `GL_RGB`, mipmaps, `GL_REPEAT`,
`GL_LINEAR_MIPMAP_LINEAR`) och ger samplerna texturenheterna 0 till 4:

```cpp
    shader.use();
    shader.setInt("albedoMap", 0);
    shader.setInt("normalMap", 1);
    shader.setInt("metallicMap", 2);
    shader.setInt("roughnessMap", 3);
    shader.setInt("aoMap", 4);

    // load PBR material textures
    // --------------------------
    unsigned int albedoMap    = loadTexture("albedo.png");
    unsigned int normalMap    = loadTexture("normal.png");
    unsigned int metallicMap  = loadTexture("metallic.png");
    unsigned int roughnessMap = loadTexture("roughness.png");
    unsigned int aoMap        = loadTexture("ao.png");
```

I renderloopen binds de fem texturerna med `glActiveTexture(GL_TEXTURE0)` … `glActiveTexture(GL_TEXTURE4)` och
`glBindTexture(GL_TEXTURE_2D, …)` före sfärerna; uniformerna `albedo`, `ao`, `metallic` och `roughness` försvinner.
Texturobjekten har samplernas namn (learnopengls demo kallar dem `albedo`, `normal` …). Till sist tas de fem texturerna
bort med `glDeleteTextures`.
:::
:::vulkan
`main.cpp` har medlemmar för de fem bilderna, deras minnen och vyer och en `textureSampler`. Efter `createCommandPool()`:

```cpp
        loadTexture("textures/albedo.png", VK_FORMAT_R8G8B8A8_UNORM, albedoImage, albedoImageMemory, albedoImageView);
        loadTexture("textures/normal.png", VK_FORMAT_R8G8B8A8_UNORM, normalImage, normalImageMemory, normalImageView);
        loadTexture("textures/metallic.png", VK_FORMAT_R8G8B8A8_UNORM, metallicImage, metallicImageMemory, metallicImageView);
        loadTexture("textures/roughness.png", VK_FORMAT_R8G8B8A8_UNORM, roughnessImage, roughnessImageMemory, roughnessImageView);
        loadTexture("textures/ao.png", VK_FORMAT_R8G8B8A8_UNORM, aoImage, aoImageMemory, aoImageView);
```

och `createTextureSampler(VK_SAMPLER_ADDRESS_MODE_REPEAT, VK_FALSE, textureSampler)`. Den förberedda `loadTexture` skapar
varje bild med alla dess mipnivåer och fyller dem med `generateMipmaps` – `vkCmdBlitImage` från varje nivå till nästa,
vulkan-tutorials *Generating Mipmaps* och Vulkans motsvarighet till `glGenerateMipmap`; samplern filtrerar inom och mellan
nivåerna (`maxLod = VK_LOD_CLAMP_NONE`), som OpenGL:s `GL_LINEAR_MIPMAP_LINEAR`. Utan anisotropisk filtrering
(`VK_FALSE`) filtreras mapparna exakt som OpenGL:s. Alla fem är `_UNORM`: shadern omvandlar albedot själv;
`VK_FORMAT_R8G8B8A8_SRGB` för albedot skulle göra det i samplern i stället.

Descriptor set-layouten får fem bindningar 1–5 av typen `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER` för fragmentsteget
(en loop över en `std::array<VkDescriptorSetLayoutBinding, 6>`), poolen en andra pool size med fem image samplers, och
`createDescriptorSet()` fem writes till – en loop över bildvyerna i bindningsordning, `dstBinding = i + 1`. `metallic`
och `roughness` lämnar `PushConstants`, som bara behåller `model`, och `albedo` och `ao` lämnar uniform buffern (`camPos`
och `pad1` följer direkt efter ljusen). `cleanup()` förstör samplern och bilderna.
:::
:::d3d12
`LoadTexture` (som har funnits sedan starten, oanvänd hittills) laddar en bild med `stbi_load` som RGBA, skapar en
`DXGI_FORMAT_R8G8B8A8_UNORM`-textur med **en mipnivå** i en default heap, kopierar pixlarna via en upload heap
(`UpdateSubresources`), gör den till `PIXEL_SHADER_RESOURCE` med en barriär och skriver dess SRV på en plats i
CBV/SRV-heapen. Heapen växer till 6 descriptorer, och de fem mapparna tar platserna 1–5 – i följd, så att en descriptor
table täcker dem:

```cpp
    LoadTexture("albedo.png", m_albedoTexture, albedoUploadHeap, 1);
```

och likadant för `normal.png` (2), `metallic.png` (3), `roughness.png` (4) och `ao.png` (5), var och en med sin egen
upload heap som lever till slutet av `LoadAssets` (kopieringarna sker när command listen körs där). Root signaturen får
ett andra intervall och en tredje root-parameter, och en statisk sampler:

```cpp
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 5, 0);
        ...
        rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL);
```

`samplers[0]`: `D3D12_FILTER_MIN_MAG_MIP_LINEAR`, `D3D12_TEXTURE_ADDRESS_MODE_WRAP` i u, v och w, `ShaderRegister = 0`.
I `PopulateCommandList` sätts tabellen en gång per bildruta – alla sfärer delar materialet:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE materialTextures(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, materialTextures);
```

`ModelConstants` krymper till `model` och `normalMatrix` (32 värden; root-konstanterna följer `sizeof(ModelConstants) /
4`). Direct3D 12 har ingen `glGenerateMipmap`, så mapparna har inga mipmaps här; det märks bara där de förminskas, med en
eller två nivåer (kapitlet *Spekulär IBL* visar hur mipnivåer görs för hand).
:::

### Större sfärer

De 7 × 7 små sfärerna skulle visa lite av materialet. Uppgiften ritar i stället ett **3 × 3-rutnät av stora sfärer**:
`nrRows = 3`, `nrColumns = 3`, `spacing = 6.0`, var och en skalad med 2.4 och vriden 90° kring y-axeln, så att
texturernas mitt – u = 0.5, där plåtarnas spår korsar varandra med fyra nitar runt korset – vetter mot kameran.
(learnopengls texturerade demo behåller rutnätet med 7 × 7 och använder ett ljus med styrkan 150 på (0, 0, 10); kursen
behåller sina fyra ljus.)

:::opengl vulkan
```cpp
                model = glm::rotate(model, glm::radians(90.0f), glm::vec3(0.0f, 1.0f, 0.0f)); // turn the middle of the textures towards the camera
                model = glm::scale(model, glm::vec3(2.4f));
```

efter translationen – matriserna verkar från höger till vänster: först skalning, sedan rotation, sedan translation.
:::
:::d3d12
```cpp
            XMMATRIX model = XMMatrixScaling(2.4f, 2.4f, 2.4f)
                * XMMatrixRotationY(XMConvertToRadians(90.0f)) // turn the middle of the textures towards the camera
                * XMMatrixTranslation(
                    (float)(col - (nrColumns / 2)) * spacing,
                    (float)(row - (nrRows / 2)) * spacing,
                    0.0f);
```

Med radvektorer verkar matriserna från vänster till höger: skalning, sedan rotation, sedan translation – learnopengls
`translate · rotate · scale`.
:::

```quiz
Uppgiften textured läser albedot med `pow(…, 2.2)`, men metallic, roughness och ao som de är. Varför skillnaden?
- [x] Albedot är en färgbild skapad i sRGB och måste omvandlas till linjära värden för belysningsmatematiken; de andra mapparna lagrar data (och normal mappen riktningar) som redan är linjära
- [ ] Albedot har tre kanaler och de andra en; `pow` fungerar bara på vektorer
- [ ] De andra mapparna omvandlas av samplern, eftersom de har mipmaps
- [ ] `pow(…, 2.2)` gör albedot ljusare för att kompensera för det saknade ambienta ljuset
---
Bara bilder av färger, gjorda genom att titta på en skärm, bär skärmens kurva. Att omvandla en strävhetsmap skulle ändra materialet: strävheten 0.5 skulle bli ungefär 0.22.
```

Gör nu den sista uppgiften, **textured**. Tryck på **Build & run**: nio stora sfärer av **nitat stål med rost**. Genom
mitten av varje sfär löper ett mörkt kors av spår med fyra kupolformade nitar runt det; stålet är grått och blankt, med de
fyra ljusens mjuka vita högdagrar, och rostfläckarna – mest till höger och i den nedre delen av varje sfär – är matt
orangebruna, utan högdagrar: rost är sträv och ingen metall, så roughness- och metallic-mapparna gör den till ett annat
material inom samma sfär. Nitarna ser upphöjda ut: var och en är belyst på sidan som vetter mot ett ljus och mörk på den
andra, och spårens bortre väggar fångar ljuset – normal mappens riktningar kommer fram till världsrummet åt rätt håll.
Det ambienta ljuset är fortfarande den konstanta `0.03 * albedo * ao`, så de delar som inget ljus når är nästan svarta;
nästa kapitel ersätter det med ljus från en omgivning.

## Mer att läsa

- *Real Shading in Unreal Engine 4* av Brian Karis: funktionerna som används här, och varför strävheten räknas om.
- learnopengls kapitel föreslår Disneys och Unreals artiklar för mer om valet av funktioner, och *Theory*-kapitlets
  källor för radiometri.

:::opengl
- [PBR / Lighting](https://learnopengl.com/PBR/Lighting): learnopengls kapitel som det här kapitlet följer, med
  skärmbilder av sfärrutnätet och det texturerade materialet.
- [lighting.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/6.pbr/1.1.lighting/lighting.cpp):
  learnopengls program, med `renderSphere()`.
- [glDrawElements](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawElements.xhtml): primitivtyperna, bland
  dem `GL_TRIANGLE_STRIP`.
:::
:::vulkan
- [PBR / Lighting](https://learnopengl.com/PBR/Lighting): learnopengls kapitel som det här kapitlet följer, med
  skärmbilder av sfärrutnätet och det texturerade materialet.
- [Fixed functions](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Fixed_functions):
  vulkan-tutorial om input assemblyns topologier.
- [Generating Mipmaps](https://vulkan-tutorial.com/Generating_Mipmaps): den `generateMipmaps` som projektets
  `loadTexture` använder.
:::
:::d3d12
- [PBR / Lighting](https://learnopengl.com/PBR/Lighting): learnopengls kapitel som det här kapitlet följer, med
  skärmbilder av sfärrutnätet och det texturerade materialet.
- [D3D_PRIMITIVE_TOPOLOGY](https://learn.microsoft.com/en-us/windows/win32/api/d3dcommon/ne-d3dcommon-d3d_primitive_topology):
  topologierna som `IASetPrimitiveTopology` tar, bland dem `D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP`.
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  varför ljusens arrayer är `float4`.
:::
