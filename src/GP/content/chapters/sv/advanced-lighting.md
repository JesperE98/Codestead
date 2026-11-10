# Avancerad belysning

Det här kapitlet inleder en ny del av kursen: *Avancerad belysning*. I delen *Belysning* byggde vi upp Phongs
belysningsmodell steg för steg – ambient, diffust och spekulärt ljus, material, lighting maps, ljuskällor och flera ljus
samtidigt. Den här delen tar belysningen vidare: en bättre spekulär modell (det här kapitlet), gammakorrigering, skuggor,
och senare normal mapping och parallax mapping, HDR, bloom, deferred shading och SSAO. Ingen av de här teknikerna är
bunden till ett visst API: allihop är matematik i shadrarna plus några extra buffrar och pass, och de fungerar likadant i
OpenGL, Vulkan och DirectX 12. Varje kapitel visar var {{api}} lägger dem.

I belysningskapitlen introducerade vi kort Phongs belysningsmodell för att ge våra scener en grundläggande realism.
Phong-modellen ser bra ut, men har några nyanser som vi ska fokusera på i det här kapitlet.

:::opengl
Projektet är learnopengls scen: ett trägolv – planet `planeVertices`, 20 × 20 enheter på y = -0.5 med normalen uppåt och
texturkoordinater upp till 10, så att `wood.png` upprepas tio gånger (`GL_REPEAT`) – och ett ljus på `lightPos` (0, 0, 0),
en halv enhet ovanför golvet. Kameran står på (0, 0, 3) och tittar längs -z; WASD, musen och scrollhjulet flyttar den
fortfarande. `advanced_lighting.vs` skickar vidare position, normal och texturkoordinater i ett interface block `VS_OUT`
(golvet har ingen modellmatris: dess positioner är redan världspositioner), och `advanced_lighting.fs` sköter
belysningen: ambient `0.05 * color`, diffust, och en spekulär term `vec3(0.3) * spec` för ett vitt ljus.
:::
:::vulkan
Projektet är learnopengls scen i de tidigare kapitlens program: ett trägolv – `vertices` innehåller learnopengls
`planeVertices`, 20 × 20 enheter på y = -0.5 med normalen uppåt och texturkoordinater upp till 10, så att
`textures/wood.png` upprepas tio gånger (`VK_SAMPLER_ADDRESS_MODE_REPEAT`; v är vänt, som i de tidigare kapitlen) – och
ett ljus på den globala `lightPos` (0, 0, 0), en halv enhet ovanför golvet. Kameran står på (0, 0, 3) och tittar längs
-z; WASD, musen och scrollhjulet flyttar den fortfarande. `shaders/advanced_lighting.vert` skickar vidare position, normal
och texturkoordinater i ett interface block `VS_OUT` (golvet har ingen modellmatris), och
`shaders/advanced_lighting.frag` sköter belysningen: ambient `0.05 * color`, diffust, och en spekulär term
`vec3(0.3) * spec` för ett vitt ljus. Uniform buffern innehåller `view`, `proj`, `viewPos` och `lightPos`.
:::
:::d3d12
Projektet är learnopengls scen: ett trägolv – en vertex buffer med planet, 20 × 20 enheter på y = -0.5 med normalen uppåt
och texturkoordinater upp till 10 (v vänt), så att `wood.png` upprepas tio gånger genom den statiska samplerns
`D3D12_TEXTURE_ADDRESS_MODE_WRAP` – och ett ljus på den globala `lightPos` (0, 0, 0), en halv enhet ovanför golvet. Kameran
står på (0, 0, 3) och tittar längs -z; WASD, musen och hjulet flyttar den fortfarande. `advanced_lighting.hlsl` innehåller
`VSMain` (position, normal och texturkoordinater; golvet har ingen modellmatris) och `PSMain` med belysningen: ambient
`0.05f * color`, diffust, och en spekulär term `float3(0.3f, 0.3f, 0.3f) * spec` för ett vitt ljus. Constant buffern (b1)
innehåller `view`, `projection`, `viewPos` och `lightPos`.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift trycker du på **Build & run**
(Ctrl+Enter) för att kompilera programmet och köra det i den inbyggda simulatorn. Just nu visar den det upplysta trägolvet
som sträcker sig bort mot horisonten, den mörka bakgrunden ovanför och en mjuk vit högdager mitt i nedre halvan –
reflexen av ljuset, beräknad med Phongs spekulära term och en glansexponent på 8.

## Blinn-Phong

Phong-belysning är en utmärkt och mycket effektiv approximation av ljus, men dess spekulära reflexer bryter ihop under
vissa förhållanden, särskilt när glansegenskapen är låg, vilket ger en stor (grov) spekulär yta. Om du tittade noga på en
sådan högdager skulle du se att dess kant plötsligt klipps av i stället för att tona ut mjukt.

Det beror på att vinkeln mellan view-vektorn och reflektionsvektorn inte får gå över 90 grader. Om vinkeln är större än 90
grader blir skalärprodukten negativ, och det ger ett spekulärt bidrag på 0.0. Du tänker kanske att det inte är något
problem, eftersom vi ändå inte borde få något ljus vid vinklar över 90 grader?

Fel – det gäller bara den diffusa komponenten, där en vinkel över 90 grader mellan normalen och ljuskällan betyder att
ljuskällan ligger under den belysta ytan, så att ljusets diffusa bidrag ska vara 0.0. Med spekulärt ljus mäter vi däremot
inte vinkeln mellan ljuskällan och normalen, utan mellan view-vektorn och reflektionsvektorn. Föreställ dig ljuset och
kameran tätt ovanför ett plant golv, båda riktade mot en punkt mellan sig i flack vinkel: reflektionsvektorn pekar bort
från betraktaren, mer än 90 grader från blickriktningen – och därför kläms den spekulära termen till exakt 0.0, fast
fragmentet är belyst och en grov yta fortfarande skulle visa en del reflekterat ljus där.

Det blir ett problem när den spekulära exponenten är låg: högdagern breder då ut sig över en stor yta, bred nog att nå
ställena där vinkeln passerar 90 grader, och där tar den tvärt slut. Med en hög exponent är högdagern redan noll långt
innan den vinkeln, så avklippningen syns inte. Med exponenten 8 i vårt projekt är kanten mjuk och svår att se;
learnopengls jämförelsebild använder exponenten 1.0 för att göra den tydlig.

```quiz
Varför får Phongs spekulära högdager en hård kant på en grov yta (låg exponent)?
- [ ] För att den diffusa termen blir negativ där
- [x] Där vinkeln mellan blickriktningen och reflektionsvektorn passerar 90° är deras skalärprodukt negativ, så `max(…, 0.0)` gör den spekulära termen till exakt 0 – fast en bred högdager fortfarande skulle synas där
- [ ] För att `pow` inte kan upphöja negativa tal
- [ ] För att ljuset ligger under ytan vid de fragmenten
---
Den diffusa termen mäter vinkeln mellan normalen och ljuset, så en avklippning vid 90° är rätt för den. Den spekulära termen mäter vinkeln mellan view-vektorn och reflektionsvektorn, som passerar 90° på ytor som fortfarande är belysta – en låg exponent gör högdagern bred nog att nå den gränsen.
```

1977 introducerade James F. Blinn shadingmodellen Blinn-Phong som en utvidgning av den Phong-shading vi har använt hittills.
Blinn-Phong-modellen är i stort sett likadan, men angriper den spekulära modellen lite annorlunda, och kommer därmed runt
vårt problem. I stället för att använda en reflektionsvektor använder vi en så kallad *halfway vector* (halvvägsvektor),
en enhetsvektor exakt mitt emellan blickriktningen och ljusriktningen. Ju närmare den här halvvägsvektorn ligger ytans
normal, desto större blir det spekulära bidraget.

När blickriktningen sammanfaller exakt med den (nu tänkta) reflektionsvektorn sammanfaller halvvägsvektorn exakt med
normalen. Ju närmare blickriktningen är den ursprungliga reflektionsriktningen, desto starkare blir den spekulära
högdagern.

Här ser du att vinkeln mellan halvvägsvektorn och ytans normal aldrig överstiger 90 grader, oavsett vilken riktning
betraktaren tittar från (om inte ljuset ligger långt under ytan, förstås). Resultatet skiljer sig något från Phongs
reflexer, men är i allmänhet mer visuellt trovärdigt, särskilt med låga spekulära exponenter. Blinn-Phong är också exakt
den shadingmodell som användes i OpenGL:s tidigare fixed function-pipeline.

Halvvägsvektorn är lätt att få fram: vi adderar ljusets riktningsvektor och view-vektorn och normaliserar resultatet:

```text
H = (L + V) / ||L + V||
```

I {{shaderLanguage}}-kod blir det:

:::opengl
```glsl
vec3 lightDir   = normalize(lightPos - FragPos);
vec3 viewDir    = normalize(viewPos - FragPos);
vec3 halfwayDir = normalize(lightDir + viewDir);
```
:::
:::vulkan
```glsl
vec3 lightDir   = normalize(ubo.lightPos - fs_in.fragPos);
vec3 viewDir    = normalize(ubo.viewPos - fs_in.fragPos);
vec3 halfwayDir = normalize(lightDir + viewDir);
```
:::
:::d3d12
```hlsl
float3 lightDir   = normalize(lightPos - input.fragPos);
float3 viewDir    = normalize(viewPos - input.fragPos);
float3 halfwayDir = normalize(lightDir + viewDir);
```
:::

Själva beräkningen av den spekulära termen blir sedan en avklämd skalärprodukt mellan ytans normal och halvvägsvektorn,
som ger cosinus för vinkeln mellan dem, och som vi återigen upphöjer till en glansexponent. Eftersom halvvägsvektorn och
normalen båda är enhetsvektorer är skalärprodukten cosinus för vinkeln mellan dem: 1.0 när de sammanfaller, mindre ju mer
de skiljer sig åt.

```quiz
Vad är Blinn-Phongs halvvägsvektor?
- [ ] Ljusriktningen speglad i normalen
- [ ] Vektorn mitt emellan normalen och blickriktningen
- [ ] Ljusriktningen minus blickriktningen, normaliserad
- [x] Den normaliserade summan av riktningen mot ljuset och riktningen mot betraktaren: enhetsvektorn exakt mitt emellan dem
---
`normalize(lightDir + viewDir)`. När betraktaren tittar längs spegelriktningen är halvvägsvektorn lika med normalen; ju längre betraktaren är från den riktningen, desto mer lutar halvvägsvektorn bort från normalen.
```

## Phong eller Blinn-Phong i {{api}}

Projektets fragment shader har båda modellerna sida vid sida, och en flagga väljer en av dem – learnopengl växlar den med
tangenten B för att jämföra dem. Phong-grenen är klar; Blinn-Phong-grenen är TODO:n. Hur flaggan tar sig från
C++-programmet in i shadern skiljer sig mellan API:erna.

:::opengl
I OpenGL är flaggan en uniform:

```glsl
uniform bool blinn;
```

GLSL har uniformtypen `bool`, men det finns ingen `glUniform1b`: en boolesk uniform sätts med `glUniform1i` (eller
`glUniform1f`), där 0 betyder false och allt annat true. Programmet har en global `bool blinn` och skickar den varje
bildruta med shaderklassens `setInt`:

```cpp
        shader.setInt("blinn", blinn);
```
:::
:::vulkan
Ett litet värde som ändras från draw till draw och som vi sätter från command buffern är precis vad push constants är
till för. learnopengls `uniform bool blinn;` blir ett push constant-block i `advanced_lighting.frag`:

```glsl
layout(push_constant) uniform PushConstants {
    bool blinn;
} pc;
```

C++-sidan måste ha exakt samma layout. En GLSL-`bool` i ett block tar 4 byte – 32 bitar, som en `int` – så C++-structen
använder `VkBool32` (ett 32-bitars heltal med `VK_TRUE` eller `VK_FALSE`), inte C++:s `bool` på 1 byte:

```cpp
// The same layout as the push constant block in the fragment shader. A GLSL bool is 4 bytes: VkBool32 (VK_TRUE/VK_FALSE).
struct PushConstants {
    VkBool32 blinn;
};
```

Pipeline layouten anmäler intervallet, för fragmentsteget:

```cpp
        VkPushConstantRange pushConstantRange{};
        pushConstantRange.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT; // the blinn flag
        pushConstantRange.offset = 0;
        pushConstantRange.size = sizeof(PushConstants);
```

och `recordCommandBuffer()` pushar värdet av den globala `bool blinn` före golvets draw:

```cpp
        PushConstants constants{};
        constants.blinn = blinn;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 6, 1, 0, 0);
```

Uniform buffern, som båda shadrarna läser (stage flags `VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`),
innehåller positionerna. std140 börjar varje `vec3` på en multipel av 16 byte, så C++-structen fyller ut var och en med en
float:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float pad1;
    glm::vec3 lightPos;
    float pad2;
};
```
:::
:::d3d12
I Direct3D 12 är det billigaste sättet att ge en shader ett enda litet värde en **root constant**: 32 bitar som ligger i
själva root signaturen och sätts direkt på command listen – ingen buffer, ingen descriptor. Root-parameter 0 är en
32-bitars konstant för register b0, synlig för pixel shadern:

```cpp
        rootParameters[0].InitAsConstants(1, 0, 0, D3D12_SHADER_VISIBILITY_PIXEL);
```

Shadern ser den som en constant buffer med en medlem. En HLSL-`bool` i en constant buffer tar 32 bitar, så den fyller
konstanten exakt:

```hlsl
cbuffer BlinnConstant : register(b0)
{
    bool blinn;
};
```

`PopulateCommandList` sätter den varje bildruta från den globala `bool blinn` (learnopengl: `shader.setInt("blinn", blinn)`):

```cpp
    m_commandList->SetGraphicsRoot32BitConstant(0, blinn, 0);
```

Parametrarna är root-parameterns index, 32-bitarsvärdet (C++-`bool` blir 0 eller 1) och offseten bland root-parameterns
konstanter. Constant buffern på b1 innehåller positionerna; HLSL låter aldrig en `float3` korsa en rad på 16 byte, så
C++-structen fyller ut var och en med en float:

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 viewPos;
        float padding0;
        XMFLOAT3 lightPos;
        float padding1;
    };
```
:::

:::opengl
```quiz
Hur skickar OpenGL-projektet flaggan `blinn` till shadern?
- [ ] Med `glUniform1b(glGetUniformLocation(shader.ID, "blinn"), blinn)`
- [x] Som en `uniform bool`, satt med `shader.setInt("blinn", blinn)` – booleska uniforms sätts med heltals- (eller float-) funktionerna, där 0 betyder false
- [ ] Som ett vertexattribut på golvet
- [ ] Genom en `#define` i shaderkällan
---
OpenGL har ingen `glUniform1b`. En `bool`-uniform sätts med `glUniform1i` (som `setInt` anropar) eller `glUniform1f`; 0 är false, alla andra värden true.
```
:::
:::vulkan
```quiz
Varför är push constantens C++-sida `VkBool32 blinn` och inte `bool blinn`?
- [ ] Push constants kan bara innehålla heltal
- [ ] `bool` kan inte omvandlas till en push constant av `vkCmdPushConstants`
- [x] En GLSL-`bool` i ett block tar 4 byte; C++:s `bool` tar oftast 1, så layouterna skulle inte stämma – `VkBool32` är ett 32-bitars heltal
- [ ] `VkBool32` gör shaderns förgrening snabbare
---
Byten som pushas med `vkCmdPushConstants` måste ha den layout som shadern deklarerar. GLSL lagrar en `bool` i ett block som 32 bitar, så C++-structen använder 32-bitars `VkBool32` (`VK_TRUE` / `VK_FALSE`).
```
:::
:::d3d12
```quiz
Vad är root-parameter 0, `InitAsConstants(1, 0, 0, D3D12_SHADER_VISIBILITY_PIXEL)`?
- [ ] En descriptor table med en constant buffer view
- [x] Ett 32-bitarsvärde som lagras i själva root signaturen, som pixel shadern läser som `cbuffer BlinnConstant : register(b0)`, satt med `SetGraphicsRoot32BitConstant`
- [ ] En statisk sampler på s0
- [ ] En constant buffer på 256 byte i en upload heap
---
Root constants behöver ingen buffer och ingen descriptor: deras värden spelas in i command listen. En HLSL-`bool` i en constant buffer tar 32 bitar, exakt en root constant.
```
:::

## Implementera Blinn-Phong

:::opengl
Gör nu den första uppgiften, **halfway**. I `advanced_lighting.fs` beräknar grenen `if (blinn)` halvvägsvektorn och den
spekulära termen med den (behåll exponenten 8.0 tills vidare, för att kunna jämföra med Phong):

```glsl
    // specular
    vec3 viewDir = normalize(viewPos - fs_in.FragPos);
    float spec = 0.0;
    if (blinn)
    {
        vec3 halfwayDir = normalize(lightDir + viewDir);
        spec = pow(max(dot(normal, halfwayDir), 0.0), 8.0);
    }
    else
    {
        vec3 reflectDir = reflect(-lightDir, normal);
        spec = pow(max(dot(viewDir, reflectDir), 0.0), 8.0);
    }
```

och i `main.cpp` slår du om programmet till den:

```cpp
bool blinn = true; // Phong (false) or Blinn-Phong (true) specular lighting
```
:::
:::vulkan
Gör nu den första uppgiften, **halfway**. I `shaders/advanced_lighting.frag` beräknar grenen `if (pc.blinn)`
halvvägsvektorn och den spekulära termen med den (behåll exponenten 8.0 tills vidare, för att kunna jämföra med Phong):

```glsl
    // specular
    vec3 viewDir = normalize(ubo.viewPos - fs_in.fragPos);
    float spec = 0.0;
    if (pc.blinn) {
        vec3 halfwayDir = normalize(lightDir + viewDir);
        spec = pow(max(dot(normal, halfwayDir), 0.0), 8.0);
    } else {
        vec3 reflectDir = reflect(-lightDir, normal);
        spec = pow(max(dot(viewDir, reflectDir), 0.0), 8.0);
    }
```

och i `main.cpp` slår du om programmet till den – push constanten bär då `VK_TRUE`:

```cpp
bool blinn = true; // Phong (false) or Blinn-Phong (true) specular lighting
```
:::
:::d3d12
Gör nu den första uppgiften, **halfway**. I `PSMain` i `advanced_lighting.hlsl` beräknar grenen `if (blinn)`
halvvägsvektorn och den spekulära termen med den (behåll exponenten 8.0 tills vidare, för att kunna jämföra med Phong):

```hlsl
    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float spec = 0.0f;
    if (blinn)
    {
        float3 halfwayDir = normalize(lightDir + viewDir);
        spec = pow(max(dot(normal, halfwayDir), 0.0f), 8.0f);
    }
    else
    {
        float3 reflectDir = reflect(-lightDir, normal);
        spec = pow(max(dot(viewDir, reflectDir), 0.0f), 8.0f);
    }
```

och i `main.cpp` slår du om programmet till den – `SetGraphicsRoot32BitConstant(0, blinn, 0)` skickar då 1:

```cpp
bool blinn = true;
```
:::

Mer än att beräkna en halvvägsvektor och byta ut cosinustermen i den spekulära komponenten är det inte. Tryck på
**Build & run**: högdagern blir **bredare** och når längre bak mot horisonten, ljusare i mitten och svagare vid de närmre
sidorna – ljuset breder nu ut sig över golvet och tonar ut mjukt i stället för att klämmas av.

En annan subtil skillnad mellan Phong- och Blinn-Phong-shading är att vinkeln mellan halvvägsvektorn och ytans normal
ofta är mindre än vinkeln mellan view-vektorn och reflektionsvektorn. För att få ett resultat som liknar Phong-shading
måste glansexponenten därför sättas lite högre. En tumregel är att sätta den till 2 till 4 gånger Phongs glansexponent.

```quiz
Varför behöver Blinn-Phong en 2–4 gånger högre glansexponent än Phong för en högdager av ungefär samma storlek?
- [x] Vinkeln mellan normalen och halvvägsvektorn är oftast mindre än vinkeln mellan view-vektorn och reflektionsvektorn, så dess cosinus ligger närmare 1 och en låg exponent ger en bredare högdager
- [ ] För att halvvägsvektorn inte är normaliserad
- [ ] För att Blinn-Phong saknar ambient term
- [ ] För att `pow` beräknas med lägre precision i fragment shadern
---
För en plan yta är vinkeln mellan N och H ungefär hälften av vinkeln mellan R och V. Samma exponent ger därför en bredare, ljusare högdager; höjer man den (learnopengl: 8 för Phong, 32 för Blinn-Phong) får man tillbaka storleken.
```

:::opengl
Gör nu uppgiften **shininess**. Ge Blinn-Phong learnopengls exponent, fyra gånger Phongs:

```glsl
        spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0); // 2-4 times Phong's exponent: about the same highlight size
```
:::
:::vulkan
Gör nu uppgiften **shininess**. Ge Blinn-Phong learnopengls exponent, fyra gånger Phongs:

```glsl
        spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0); // 2-4 times Phong's exponent: about the same highlight size
```
:::
:::d3d12
Gör nu uppgiften **shininess**. Ge Blinn-Phong learnopengls exponent, fyra gånger Phongs:

```hlsl
        spec = pow(max(dot(normal, halfwayDir), 0.0f), 32.0f);    // 2-4 times Phong's exponent: about the same highlight size
```
:::

Tryck på **Build & run**: högdagern krymper igen till ungefär samma storlek som startens Phong-högdager, men den ligger
lite längre bak och tonar ut jämnt åt alla håll. Det är learnopengls jämförelse – Phong med exponenten 8.0, Blinn-Phong
med 32.0. Vill du se båda igen sätter du tillbaka `blinn` till false: Phong-grenen finns kvar i shadern.

```quiz
Phong och Blinn-Phong används båda med ett ljus och en betraktare ovanför ett plant golv. När kan vinkeln mellan normalen och halvvägsvektorn överstiga 90°?
- [ ] Varje gång betraktaren tittar på golvet i flack vinkel
- [ ] Varje gång exponenten är lägre än 8
- [ ] Aldrig, inte ens när ljuset ligger under golvet
- [x] Bara när ljuset (eller betraktaren) ligger under ytan – för en yta som båda ser håller sig halvvägsvektorn inom 90° från normalen, så det blir ingen avklippning
---
När L och V båda ligger på normalens sida pekar även deras summa åt den sidan, så dot(N, H) blir aldrig negativ. Därför tonar Blinn-Phong ut mjukt där Phong klipps av.
```

Skillnaden kan se liten ut på ett trägolv, men Blinn-Phong är den mer trovärdiga modellen, särskilt för grova ytor med låga
exponenter, och det är den som resten av den här delen använder – nästa kapitels fyra ljus är redan Blinn-Phong-ljus.

## Mer att läsa

:::opengl
- [Advanced Lighting](https://learnopengl.com/Advanced-Lighting/Advanced-Lighting): learnopengls kapitel som det här
  kapitlet följer, med bilderna som jämför Phong och Blinn-Phong.
- [advanced_lighting.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/1.advanced_lighting/advanced_lighting.cpp):
  learnopengls program, med tangenten B som växlar modell.
- [glUniform](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform.xhtml): referenssidan, med hur booleska
  uniforms sätts.
:::
:::vulkan
- [Advanced Lighting](https://learnopengl.com/Advanced-Lighting/Advanced-Lighting): learnopengls kapitel som det här
  kapitlet följer, med bilderna som jämför Phong och Blinn-Phong.
- [Resource descriptors](https://docs.vulkan.org/spec/latest/chapters/descriptorsets.html): kapitlet i
  Vulkanspecifikationen om pipeline layouts, inklusive push constant-intervall och hur de uppdateras.
- [vkCmdPushConstants](https://registry.khronos.org/vulkan/specs/latest/man/html/vkCmdPushConstants.html): referenssidan.
:::
:::d3d12
- [Advanced Lighting](https://learnopengl.com/Advanced-Lighting/Advanced-Lighting): learnopengls kapitel som det här
  kapitlet följer, med bilderna som jämför Phong och Blinn-Phong.
- [Using constants directly in the root signature](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-constants-directly-in-the-root-signature):
  root constants och `SetGraphicsRoot32BitConstants`.
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  hur HLSL lägger ut en constant buffer (varför varje `float3` får en float utfyllnad här).
:::
