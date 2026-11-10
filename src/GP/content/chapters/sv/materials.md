# Material

I verkligheten reagerar varje föremål olika på ljus. Föremål av stål är ofta blankare än till exempel en lervas, och
en trälåda reagerar inte på ljus på samma sätt som en stållåda. Vissa föremål reflekterar ljuset utan större
spridning, vilket ger små spekulära högdagrar, medan andra sprider det mycket och ger högdagern en större radie. Om vi
vill simulera flera sorters föremål i {{api}} måste vi definiera *materialegenskaper* som är specifika för varje yta.

I förra kapitlet bestämde vi föremålets utseende med en objektfärg och en ljusfärg, kombinerade med en styrka för den
ambienta och den spekulära komponenten. När vi beskriver en yta kan vi i stället definiera en materialfärg för var och
en av de 3 ljuskomponenterna: ambient, diffust och spekulärt ljus. Genom att ange en färg för varje komponent får vi
finkornig kontroll över ytans färg. Lägg till en glanskomponent (*shininess*) till de 3 färgerna, så har vi alla
materialegenskaper vi behöver:

:::opengl
```glsl
#version 330 core
struct Material {
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
    float shininess;
};

uniform Material material;
```

I fragment shadern skapar vi en `struct` som lagrar ytans materialegenskaper. Vi skulle också kunna lagra dem som
enskilda uniform-värden, men en struct håller ordning på dem. Först definierar vi structens uppbyggnad och sedan
deklarerar vi helt enkelt en uniform-variabel med den nya structen som typ.
:::
:::vulkan
```glsl
struct Material {
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
    float shininess;
};
```

I fragment shadern skapar vi en `struct` som lagrar ytans materialegenskaper. I Vulkan ligger varje uniform-värde i
ett uniform-block som backas av en buffer, så materialet blir en medlem `Material material;` i uniform-blocket på
binding 2 – blocket som redan innehåller matriserna och ljusvärdena. Vi skulle också kunna lagra de fyra värdena som
enskilda medlemmar i blocket, men en struct håller ordning på dem, och samma struct finns också i C++, med samma
layout, så att `updateUniformBuffer()` kan fylla i den.
:::
:::d3d12
```hlsl
// The surface of the object: the colours it reflects under ambient, diffuse and
// specular light, and how sharp its highlight is.
struct Material
{
    float3 ambient;
    float3 diffuse;
    float3 specular;
    float shininess;
};
```

I `materials.hlsl` skapar vi en `struct` som lagrar ytans materialegenskaper. Värdena når shadern genom constant
buffern på register `b1`, så materialet blir en medlem `Material material;` i `cbuffer SceneConstantBuffer`. Vi skulle
också kunna lagra de fyra värdena som enskilda medlemmar i cbuffern, men en struct håller ordning på dem, och samma
struct finns också i C++, med samma layout, så att `OnUpdate` kan fylla i den.
:::

Som du ser definierar vi en färgvektor för var och en av Phong-belysningens komponenter:

- Materialvektorn `ambient` anger vilken färg ytan reflekterar under ambient belysning; oftast är det samma som
  ytans färg.
- Materialvektorn `diffuse` anger ytans färg under diffus belysning. Den diffusa färgen sätts (precis som den
  ambienta) till den färg ytan ska ha.
- Materialvektorn `specular` anger färgen på ytans spekulära högdager (eller kan till och med ge en ytspecifik
  färg).
- Till sist påverkar `shininess` spridningen/radien hos den spekulära högdagern.

Med de här 4 komponenterna som definierar ett föremåls material kan vi simulera många verkliga material.
learnopengl.com visar en tabell med materialegenskaper för verkliga material som smaragd, jade, obsidian, guld eller
cyanfärgad plast (hämtad från en sida av Frédéric Devernay), och ritar en kub med vart och ett av dem: smaragd ser ut
som en genomskinlig grön ädelsten, guld har en varm, skarp högdager och plasterna har en matt gråvit glans. Observera
att tabellens shininess-värden ligger mellan 0 och 1; de måste multipliceras med 128 för att ge den exponent som vår
shader förväntar sig.

Som du ser verkar rätt angivna materialegenskaper ändra hur vi uppfattar föremålet. Effekterna syns tydligt, men för
mer realistiska resultat behöver vi byta ut den enkla kuben mot något mer komplicerat; learnopengls kapitel om
*Model Loading* laddar sådana former.

Att hitta rätt materialinställningar för ett föremål är svårt och kräver mest experimenterande och mycket erfarenhet.
Det är inte ovanligt att helt förstöra ett föremåls utseende med ett felaktigt valt material.

```quiz
Du höjer materialets `shininess` från 32 till 256. Vad händer med den spekulära högdagern?
- [x] Den blir mindre och skarpare: den spekulära faktorn upphöjs till en högre potens och avtar därför snabbare bort från den perfekta reflektionen
- [ ] Ingenting: shininess påverkar bara den ambienta komponenten
- [ ] Den blir större och ljusare, eftersom ytan reflekterar mer ljus
---
`spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess)`. Skalärprodukten är högst 1, så en högre exponent trycker alla värden under 1 närmare 0: bara riktningar mycket nära reflektionen behåller en synlig högdager. En blank yta (polerad metall) har en liten, tät högdager; en grov yta en bred, mjuk.
```

Låt oss försöka implementera ett sådant materialsystem i shadrarna.

## Ange material

:::opengl
Det här kapitlets projekt är resultatet från *Basic Lighting*, med den belysta kubens shadrar omdöpta till
`materials.vs` och `materials.fs` (`main.cpp` bygger `lightingShader` av dem). Det rörliga ljuset från det kapitlets
övning är borttaget igen: lampan står kvar på `lightPos` (1.2, 1.0, 2.0). Fragment shadern har fortfarande
uniform-variablerna `objectColor`, `lightColor`, `lightPos` och `viewPos`, och räknar ut ambient (styrka 0.1), diffus
och spekulär belysning (styrka 0.5, exponent 32). Kameran tittar på kubens vänstra och främre sida och på lampan.
:::
:::vulkan
Det här kapitlets projekt är resultatet från *Basic Lighting*, med kubens shadrar omdöpta till
`shaders/materials.vert` och `shaders/materials.frag` (`createPipeline("shaders/materials.vert.spv",
"shaders/materials.frag.spv", 2, lightingPipeline)`). Det rörliga ljuset från det kapitlets övning är borttaget igen:
lampan står kvar på `lightPos` (1.2, 1.0, 2.0). Uniform buffern på binding 2 innehåller fortfarande `view`, `proj`,
`objectColor`, `lightColor`, `lightPos` och `viewPos`, där varje `glm::vec3` följs av en utfyllnads-`float` i C++.
Kameran tittar på kubens vänstra och främre sida och på lampan.
:::
:::d3d12
Det här kapitlets projekt är resultatet från *Basic Lighting*, med den belysta kubens shadrar omdöpta till
`materials.hlsl`. Det rörliga ljuset från det kapitlets övning är borttaget igen: lampan står kvar på `lightPos`
(1.2, 1.0, 2.0). Constant buffern på register `b1` innehåller fortfarande `view`, `projection`, `objectColor`,
`lightColor`, `lightPos` och `viewPos` (där varje `XMFLOAT3` följs av en `float` utfyllnad i C++), och `OnUpdate`
fyller i den varje bildruta. Kameran tittar på kubens vänstra och främre sida och på lampan. `light_cube.hlsl`,
lampans shadrar, deklarerar bara constant bufferns två första matriser, så inget i det här kapitlet ändrar den.
:::

Den här gången finns inga `// TODO:`-kommentarer: varje uppgift ändrar kod som redan finns, och uppgiftstexten talar
om var. Efter varje uppgift trycker du på **Build & run** (Ctrl+Enter) för att kompilera programmet och köra det i den
inbyggda simulatorn.

Vi har skapat en material-struct i fragment shadern, så nu vill vi ändra ljusberäkningarna så att de följer de nya
materialegenskaperna. Eftersom alla materialvariabler ligger i en struct kommer vi åt dem via medlemmen `material`:

:::opengl
```glsl
void main()
{
    // ambient
    vec3 ambient = lightColor * material.ambient;

    // diffuse
    vec3 norm = normalize(Normal);
    vec3 lightDir = normalize(lightPos - FragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = lightColor * (diff * material.diffuse);

    // specular
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    vec3 specular = lightColor * (spec * material.specular);

    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
}
```

Uniform-variabeln `objectColor` är borta (`uniform Material material;` tar dess plats), och det är även
`ambientStrength` och `specularStrength`.
:::
:::vulkan
Blocket förlorar `objectColor` och får materialet som sista medlem:

```glsl
layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 lightColor;
    vec3 lightPos;
    vec3 viewPos;
    Material material;
} ubo;
```

och `main()` läser materialet via `ubo`:

```glsl
void main() {
    // ambient
    vec3 ambient = ubo.lightColor * ubo.material.ambient;

    // diffuse
    vec3 norm = normalize(fragNormal);
    vec3 lightDir = normalize(ubo.lightPos - fragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = ubo.lightColor * (diff * ubo.material.diffuse);

    // specular
    vec3 viewDir = normalize(ubo.viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    vec3 specular = ubo.lightColor * (spec * ubo.material.specular);

    vec3 result = ambient + diffuse + specular;
    outColor = vec4(result, 1.0);
}
```

`ambientStrength` och `specularStrength` är borta. Vertex shadrarna deklarerar bara blockets två första medlemmar
(matriserna), så de ändras inte.
:::
:::d3d12
Cbuffern förlorar `objectColor` och får materialet som sista medlem:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 lightColor;
    float3 lightPos;
    float3 viewPos;
    Material material;
};
```

och `PSMain` läser materialets fält:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // ambient
    float3 ambient = lightColor * material.ambient;

    // diffuse
    float3 norm = normalize(input.normal);
    float3 lightDir = normalize(lightPos - input.fragPos);
    float diff = max(dot(norm, lightDir), 0.0f);
    float3 diffuse = lightColor * (diff * material.diffuse);

    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    float3 specular = lightColor * (spec * material.specular);

    float3 result = ambient + diffuse + specular;
    return float4(result, 1.0f);
}
```

`ambientStrength` och `specularStrength` är borta.
:::

Som du ser använder vi nu material-structens egenskaper där vi behöver dem, och den här gången räknar vi ut
slutfärgen med hjälp av materialets färger. Varje materialegenskap multipliceras med sin ljuskomponent, och
föremålets färg är inte längre en enda faktor på slutet.

:::opengl
Vi kan ange föremålets material i programmet genom att sätta motsvarande uniform-variabler. En struct i GLSL är dock
inte speciell på något sätt när man sätter uniform-variabler; en struct fungerar egentligen bara som ett namnområde
för uniform-variabler. Vill vi fylla i structen måste vi sätta de enskilda uniform-variablerna, men med structens namn
som prefix:

```cpp
        // material properties
        lightingShader.setVec3("material.ambient", 1.0f, 0.5f, 0.31f);
        lightingShader.setVec3("material.diffuse", 1.0f, 0.5f, 0.31f);
        lightingShader.setVec3("material.specular", 0.5f, 0.5f, 0.5f); // specular lighting doesn't have full effect on this object's material
        lightingShader.setFloat("material.shininess", 32.0f);
```

Raderna hamnar i renderloopen efter `viewPos`, och raden för `objectColor` försvinner. Varje fält är en egen
uniform-variabel med en egen location: `glGetUniformLocation(ID, "material.shininess")`, vilket är vad `setFloat`
anropar.
:::
:::vulkan
I C++ är materialet en struct med samma fält, och structen `UniformBufferObject` får den som sista medlem i stället
för `objectColor`:

```cpp
// The same layout as the Material struct in the fragment shader. A struct in a uniform block also starts at a
// multiple of 16 bytes and its size is rounded up to one; with a float after every vec3 it is 48 bytes, in C++ too.
struct Material {
    glm::vec3 ambient;
    float pad1;
    glm::vec3 diffuse;
    float pad2;
    glm::vec3 specular;
    float shininess; // fills the 4 bytes after specular
};
```

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 lightColor;
    float pad1;
    glm::vec3 lightPos;
    float pad2;
    glm::vec3 viewPos;
    float pad3;
    Material material;
};
```

Utfyllnaden följer *std140*-layoutreglerna för uniform-block som du mött i de tidigare kapitlen: en `vec3` börjar på
en multipel av 16 byte, precis som en `vec4`. Structar lägger till två regler till: en struct börjar också på en
multipel av 16 byte, och dess storlek avrundas uppåt till en multipel av 16. I shadern ligger `ambient` på offset 0 i
structen, `diffuse` på 16, `specular` på 32 – och `shininess`, en ensam `float`, får plats i de 4 lediga byten efter
`specular`, på offset 44. Det blir 48 byte. `glm::vec3` är 12 byte, så C++-structen behöver en utfyllnads-float efter
`ambient` och efter `diffuse`, medan `shininess` själv fyller luckan efter `specular`. Blir det fel läser shadern
värdena på fel offset, och färgerna hamnar förskjutna mellan fälten.

I `updateUniformBuffer()` försvinner raden för `objectColor`, och materialet sätts som alla andra medlemmar:

```cpp
        // material properties
        ubo.material.ambient   = glm::vec3(1.0f, 0.5f, 0.31f);
        ubo.material.diffuse   = glm::vec3(1.0f, 0.5f, 0.31f);
        ubo.material.specular  = glm::vec3(0.5f, 0.5f, 0.5f); // specular lighting doesn't have full effect on this object's material
        ubo.material.shininess = 32.0f;
```

Hela structen kopieras till den mappade uniform buffern med `memcpy` på slutet, som förut. Till skillnad från OpenGL
finns inget att sätta fält för fält på GPU-sidan: shadern läser helt enkelt buffern på blockets offset.
:::
:::d3d12
I C++ är materialet en struct med samma fält, deklarerad i klassen före `SceneConstantBuffer`, som får den som sista
medlem i stället för `objectColor`:

```cpp
    // The material: what the shaders see as struct Material. Laid out as HLSL does:
    // each float3 starts a new 16-byte row, shininess fills the row of specular.
    struct Material
    {
        XMFLOAT3 ambient;
        float padding0;
        XMFLOAT3 diffuse;
        float padding1;
        XMFLOAT3 specular;
        float shininess;
    };
```

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 lightColor;
        float padding0;
        XMFLOAT3 lightPos;
        float padding1;
        XMFLOAT3 viewPos;
        float padding2;
        Material material;
    };
```

HLSL packar en constant buffer i rader om 16 byte (fyra floats) och låter aldrig en `float3` gå över från en rad till
nästa – regeln du mött i de tidigare kapitlen. En struct-medlem börjar dessutom alltid på en ny rad. Inuti `Material`
tar `ambient`, `diffuse` och `specular` var sin rads första 12 byte, och `shininess`, en ensam `float`, får plats i de
sista 4 byten på raden för `specular`. Det blir 3 rader, 48 byte. `XMFLOAT3` är 12 byte, så C++-structen behöver en
`float` utfyllnad efter `ambient` och efter `diffuse`, medan `shininess` själv fyller raden för `specular`. Blir det
fel läser shadern värdena på fel offset, och färgerna hamnar förskjutna mellan fälten.

I `OnUpdate` försvinner raden för `objectColor`, och materialet sätts som alla andra medlemmar:

```cpp
    // material properties
    constantBufferData.material.ambient = XMFLOAT3(1.0f, 0.5f, 0.31f);
    constantBufferData.material.diffuse = XMFLOAT3(1.0f, 0.5f, 0.31f);
    constantBufferData.material.specular = XMFLOAT3(0.5f, 0.5f, 0.5f); // specular lighting doesn't have full effect on this object's material
    constantBufferData.material.shininess = 32.0f;
```

Hela structen kopieras till den mappade constant buffern med `memcpy` på slutet, som förut. Det finns inget att sätta
fält för fält: shadern läser helt enkelt buffern på cbufferns offset.
:::

Vi sätter den ambienta och den diffusa komponenten till den färg vi vill att föremålet ska ha, och den spekulära
komponenten till en medelljus färg; vi vill inte att den spekulära komponenten ska bli för stark på just det här
föremålet. Shininess behåller vi på 32.

:::opengl
```quiz
Hur sätter `main.cpp` fältet `shininess` i `uniform Material material;`?
- [ ] `lightingShader.setFloat("shininess", 32.0f);` – structens fält är uniform-variabler med egna namn
- [x] `lightingShader.setFloat("material.shininess", 32.0f);` – varje fält är en egen uniform-variabel, med structens namn som prefix
- [ ] Inte alls: en hel struct kan bara sättas på en gång, med ett enda `glUniform`-anrop för alla fyra fälten
---
En uniform-struct är inte mycket mer än ett namnområde: `material.ambient`, `material.diffuse`, `material.specular` och `material.shininess` är fyra separata uniform-variabler med fyra locations, och du sätter var och en med dess fullständiga namn.
```
:::
:::vulkan
```quiz
C++-structen `Material` har `pad1` efter `ambient` och `pad2` efter `diffuse`, men ingen utfyllnad efter `specular`. Varför?
- [x] I std140 börjar varje `vec3` på en multipel av 16 byte, och `shininess`, en ensam `float`, får plats i de 4 lediga byten efter `specular` (offset 44) – i shadern och i C++
- [ ] `glm::vec3` är 16 byte, så bara de två första behöver extra floats
- [ ] Den sista `vec3`:n i en struct behöver aldrig utfyllnad i std140
---
`glm::vec3` är 12 byte. Utan `pad1` och `pad2` skulle `diffuse` börja på byte 12 i C++ men på byte 16 i shadern. Efter `specular` (byte 32–43) lägger shadern floaten `shininess` på 44, precis där C++-structen lägger den, och structen slutar på 48, en multipel av 16.
```
:::
:::d3d12
```quiz
C++-structen `Material` har `padding0` efter `ambient` och `padding1` efter `diffuse`, men ingen utfyllnad efter `specular`. Varför?
- [x] Varje `float3` tar de första 12 byten av en 16-byte-rad, och `shininess`, en ensam `float`, får plats i de sista 4 byten på raden för `specular` – i HLSL och i C++
- [ ] HLSL fyller aldrig ut den sista `float3`:n i en struct
- [ ] `XMFLOAT3` är 16 byte, så bara de två första behöver extra floats
---
`XMFLOAT3` är 12 byte. Utan utfyllnadsfloatarna skulle `diffuse` börja på byte 12 i C++ men på andra raden (byte 16) i HLSL. Efter `specular` (byte 32–43) packar HLSL floaten `shininess` på samma rad, på byte 44, precis där C++-structen lägger den.
```
:::

Gör nu den första uppgiften, **material**: lägg till structen `Material`, använd den i belysningen i stället för
`objectColor`, de två styrkorna och 32:an, och sätt det korallfärgade materialet från programmet. Tryck sedan på
**Build & run**.

Kuben är alldeles för ljus! Ljusfärgen är fortfarande vit, (1.0, 1.0, 1.0), med full styrka för alla tre
komponenterna – och den ambienta komponenten använder nu hela `material.ambient`. Förut skalades det ambienta ljuset
med en ambient styrka på 0.1; nu visar en sida som ljuset inte når, som kubens vänstra sida, hela korallfärgen, och
den belysta framsidan är nästan vit där den diffusa och den spekulära delen läggs ovanpå.

```quiz
Varför är kubens vänstra sida (som är vänd bort från ljuset) klart korallfärgad i stället för mörk efter uppgiften **material**?
- [ ] Den diffusa termen räknas nu med materialets färg, så alla sidor får diffust ljus
- [x] Den ambienta termen är nu `lightColor * material.ambient`: vitt ljus gånger hela korallfärgen, utan styrkan 0.1
- [ ] Materialet vänder på den vänstra sidans normaler
---
Den vänstra sidan får inget diffust eller spekulärt ljus (`diff` är 0 där), så den visar bara den ambienta termen. Med vitt ljus på full styrka är den termen hela `material.ambient` – hela korallfärgen. Ljusets styrka per komponent är det vi måste styra härnäst.
```

## Ljusegenskaper

Föremålet är alldeles för ljust. Orsaken är att den ambienta, den diffusa och den spekulära färgen reflekteras med
full kraft från varje ljuskälla. Ljuskällor har också olika intensitet för sina ambienta, diffusa och spekulära
komponenter. I förra kapitlet löste vi det genom att variera den ambienta och den spekulära intensiteten med ett
styrkevärde. Vi vill göra något liknande, men den här gången genom att ange intensitetsvektorer för var och en av
ljuskomponenterna. Om vi ser ljusfärgen som (1.0, 1.0, 1.0) skulle en ambient intensitet på (0.1, 0.1, 0.1) göra
ljusets ambienta del 10 gånger svagare – precis det som den ambienta styrkan gjorde förut. Den diffusa intensiteten
hos en ljuskälla sätts oftast till exakt den färg vi vill att ljuset ska ha, ofta en klar vit färg. Den spekulära
komponenten behålls oftast på (1.0, 1.0, 1.0) och lyser med full intensitet. Observera att vi också lägger ljusets
position i samma struct:

:::opengl
```glsl
struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

uniform Light light;
```

Structen `Light` och `uniform Light light;` ersätter uniform-variablerna `lightPos` och `lightColor`. En ljuskälla har
olika intensitet för sina ambienta, diffusa och spekulära komponenter. Vi uppdaterar fragment shadern så att den
använder dem:

```glsl
    vec3 ambient = light.ambient * material.ambient;
    vec3 lightDir = normalize(light.position - FragPos);
    vec3 diffuse = light.diffuse * (diff * material.diffuse);
    vec3 specular = light.specular * (spec * material.specular);
```

Sedan vill vi sätta ljusintensiteterna i programmet:

```cpp
        lightingShader.setVec3("light.position", lightPos);
        lightingShader.setVec3("viewPos", cameraPos);

        // light properties
        lightingShader.setVec3("light.ambient", 0.2f, 0.2f, 0.2f);
        lightingShader.setVec3("light.diffuse", 0.5f, 0.5f, 0.5f); // darken diffuse light a bit
        lightingShader.setVec3("light.specular", 1.0f, 1.0f, 1.0f);
```

Uniform-variablerna `lightColor` och `lightPos` är borta.
:::
:::vulkan
```glsl
struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
```

Ljuset blir också en medlem i blocket och ersätter `lightColor` och `lightPos`:

```glsl
layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    Material material;
    Light light;
} ubo;
```

En ljuskälla har olika intensitet för sina ambienta, diffusa och spekulära komponenter. Vi uppdaterar fragment
shadern så att den använder dem:

```glsl
    vec3 ambient = ubo.light.ambient * ubo.material.ambient;
    vec3 lightDir = normalize(ubo.light.position - fragPos);
    vec3 diffuse = ubo.light.diffuse * (diff * ubo.material.diffuse);
    vec3 specular = ubo.light.specular * (spec * ubo.material.specular);
```

I C++ får samma struct en utfyllnads-float efter varje `glm::vec3` – fyra vec3:or på offset 0, 16, 32 och 48, och en
storlek på 64 byte:

```cpp
// learnopengl's Light: a position and the strength of each light component
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
```

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float pad1;
    Material material;
    Light light;
};
```

`viewPos` följs av en utfyllnads-float eftersom nästa medlem, en struct, börjar på en multipel av 16 byte. `Material`
slutar redan på en multipel av 16, så `Light` följer direkt efter. Hela blocket är nu 256 byte: matriserna (128),
`viewPos` (16), materialet (48) och ljuset (64). Sedan sätter vi ljusintensiteterna i `updateUniformBuffer()`:

```cpp
        ubo.light.position = lightPos;
        ubo.viewPos = cameraPos;

        // light properties
        ubo.light.ambient  = glm::vec3(0.2f, 0.2f, 0.2f);
        ubo.light.diffuse  = glm::vec3(0.5f, 0.5f, 0.5f); // darken diffuse light a bit
        ubo.light.specular = glm::vec3(1.0f, 1.0f, 1.0f);
```
:::
:::d3d12
```hlsl
// The light: where it is and how strong its ambient, diffuse and specular parts are.
struct Light
{
    float3 position;
    float3 ambient;
    float3 diffuse;
    float3 specular;
};
```

Ljuset blir också en medlem i cbuffern och ersätter `lightColor` och `lightPos`:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPos;
    Material material;
    Light light;
};
```

En ljuskälla har olika intensitet för sina ambienta, diffusa och spekulära komponenter. Vi uppdaterar `PSMain` så att
den använder dem:

```hlsl
    float3 ambient = light.ambient * material.ambient;
    float3 lightDir = normalize(light.position - input.fragPos);
    float3 diffuse = light.diffuse * (diff * material.diffuse);
    float3 specular = light.specular * (spec * material.specular);
```

I C++ får samma struct en `float` utfyllnad efter varje `XMFLOAT3`, eftersom varje `float3` börjar på en ny rad:

```cpp
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
```

```cpp
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

`viewPos` följs av en utfyllnads-float eftersom nästa medlem, en struct, börjar på en ny rad. Hela buffern är nu
exakt 256 byte – matriserna (128), `viewPos` (16), materialet (48) och ljuset (64) – så
`CalculateConstantBufferByteSize`, som avrundar en constant buffer uppåt till en multipel av 256 byte, har inget att
lägga till. Sedan sätter vi ljusintensiteterna i `OnUpdate`:

```cpp
    constantBufferData.light.position = lightPos;
    XMStoreFloat3(&constantBufferData.viewPos, cameraPos);    // the camera's position

    // light properties
    constantBufferData.light.ambient = XMFLOAT3(0.2f, 0.2f, 0.2f);
    constantBufferData.light.diffuse = XMFLOAT3(0.5f, 0.5f, 0.5f); // darken diffuse light a bit
    constantBufferData.light.specular = XMFLOAT3(1.0f, 1.0f, 1.0f);
```
:::

Det ambienta ljuset sätts till en låg intensitet, (0.2, 0.2, 0.2), så att det inte dominerar föremålets färg; det
diffusa ljuset dämpas lite till (0.5, 0.5, 0.5); och det spekulära ljuset lyser med full intensitet, (1.0, 1.0, 1.0).
Det är learnopengls värden; de exakta talen är en smaksak, så länge den ambienta delen förblir svag.

Gör nu uppgiften **light**: lägg till structen `Light`, låt den ersätta `lightPos` och `lightColor`, använd dess
intensiteter i de tre termerna och sätt dem från programmet. Tryck på **Build & run**: kuben ser normalt belyst ut
igen, korallfärgad med en mörk vänstersida och en vitaktig högdager på framsidan – högdagern är vit eftersom ljusets
spekulära färg är vit, dämpad av materialets spekulära färg 0.5.

```quiz
Med `light.ambient` = (0.2, 0.2, 0.2) och `material.ambient` = (1.0, 0.5, 0.31), vilken färg får en sida som bara nås av ambient ljus?
- [x] (0.2, 0.1, 0.062) – de två vektorerna multiplicerade komponent för komponent
- [ ] (1.0, 0.5, 0.31) – materialets ambienta färg
- [ ] (1.2, 0.7, 0.51) – ljusets ambienta del adderad till materialets färg
---
Ljuskomponenterna multiplicerar ljusets intensitet med materialets färg, komponent för komponent: 0.2 × 1.0, 0.2 × 0.5, 0.2 × 0.31. Det är den vänstra sidan: en femtedel av korallfärgen, mörk men inte svart.
```

## Olika ljusfärger

Hittills har vi bara använt ljusfärger för att variera intensiteten hos de enskilda komponenterna, genom att välja
färger från vitt via grått till svart, utan att påverka föremålets faktiska färger (bara intensiteten). Eftersom vi nu
enkelt kommer åt ljusets egenskaper kan vi ändra deras färger över tid och få riktigt intressanta effekter. Allt är
redan förberett i fragment shadern, så det är lätt att ändra ljusets färger, och det ger genast några lustiga
effekter.

Som du ser påverkar en annan ljusfärg föremålets färg kraftigt. Eftersom ljusfärgen direkt styr vilka färger föremålet
kan reflektera (som du kanske minns från kapitlet *Colors*) har den stor inverkan på resultatet.

Vi kan enkelt ändra ljusets färger över tid genom att ändra ljusets ambienta och diffusa färger med `sin` och tiden:

:::opengl
```cpp
        // light properties
        glm::vec3 lightColor;
        lightColor.x = static_cast<float>(sin(glfwGetTime() * 2.0));
        lightColor.y = static_cast<float>(sin(glfwGetTime() * 0.7));
        lightColor.z = static_cast<float>(sin(glfwGetTime() * 1.3));
        glm::vec3 diffuseColor = lightColor   * glm::vec3(0.5f); // decrease the influence
        glm::vec3 ambientColor = diffuseColor * glm::vec3(0.2f); // low influence
        lightingShader.setVec3("light.ambient", ambientColor);
        lightingShader.setVec3("light.diffuse", diffuseColor);
        lightingShader.setVec3("light.specular", 1.0f, 1.0f, 1.0f);
```
:::
:::vulkan
```cpp
        // light properties
        glm::vec3 lightColor;
        lightColor.x = static_cast<float>(std::sin(glfwGetTime() * 2.0));
        lightColor.y = static_cast<float>(std::sin(glfwGetTime() * 0.7));
        lightColor.z = static_cast<float>(std::sin(glfwGetTime() * 1.3));
        glm::vec3 diffuseColor = lightColor   * glm::vec3(0.5f); // decrease the influence
        glm::vec3 ambientColor = diffuseColor * glm::vec3(0.2f); // low influence
        ubo.light.ambient  = ambientColor;
        ubo.light.diffuse  = diffuseColor;
        ubo.light.specular = glm::vec3(1.0f, 1.0f, 1.0f);
```

`updateUniformBuffer()` körs varje bildruta, så de nya färgerna når shadern varje bildruta via `memcpy`.
:::
:::d3d12
`OnUpdate` mäter redan tiden mellan bildrutorna med `std::chrono`; för färgen behöver vi tiden sedan första
bildrutan, mätt från en `static` starttid, som i kapitlet *Camera*:

```cpp
    // light properties: the colour changes over time
    static auto startTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - startTime).count();
    XMFLOAT3 lightColor;
    lightColor.x = std::sin(time * 2.0f);
    lightColor.y = std::sin(time * 0.7f);
    lightColor.z = std::sin(time * 1.3f);
    XMVECTOR diffuseColor = XMLoadFloat3(&lightColor) * 0.5f; // decrease the influence
    XMVECTOR ambientColor = diffuseColor * 0.2f; // low influence
    XMStoreFloat3(&constantBufferData.light.ambient, ambientColor);
    XMStoreFloat3(&constantBufferData.light.diffuse, diffuseColor);
    constantBufferData.light.specular = XMFLOAT3(1.0f, 1.0f, 1.0f);
```

DirectXMath räknar med `XMVECTOR`, så färgen laddas från `XMFLOAT3` med `XMLoadFloat3`, skalas med operatorn `*` och
lagras tillbaka i constant bufferns `XMFLOAT3` med `XMStoreFloat3`.
:::

De tre komponenterna ändras med olika hastighet, så ljuset går igenom många olika färger över tid. Den diffusa färgen
är hälften av den och den ambienta en femtedel av det, som förut; den spekulära delen förblir vit.

Gör nu uppgiften **light-color** och tryck på **Build & run**. Kubens färg ändras nu över tid. Efter en sekund är
ljusfärgen till exempel ungefär (0.91, 0.64, 0.96) och kuben är mörkt rödbrun. Lampan förblir vit: dess shader känner
inte till ljusfärgen – att låta den följa ljuset är ett trevligt extra om du vill.

```quiz
Efter en sekund är ljusfärgen ungefär (0.91, 0.64, 0.96), en blek lila. Varför ser den korallfärgade kuben rödbrun ut och inte lila?
- [x] Ljuset och materialet multipliceras komponent för komponent: kuben reflekterar 1.0 av det röda, men bara 0.5 av det gröna och 0.31 av det blå
- [ ] Eftersom `sin` returnerar radianer omvandlas färgen innan den används
- [ ] Den spekulära delen, som förblir vit, täcker över det lila
---
Ett föremål reflekterar bara det dess material tillåter: (0.91 × 1.0, 0.64 × 0.5, 0.96 × 0.31) ≈ (0.91, 0.32, 0.30) före den diffusa och ambienta skalningen – mest rött. Ljusets blå del absorberas till stor del av den korallfärgade ytan.
```

Experimentera med olika ljus- och materialvärden och se hur de påverkar resultatet.

## Övningar

- Kan du simulera några verkliga föremål genom att definiera deras material, som vi såg i början av kapitlet? Observera
  att tabellens ambienta värden inte är samma som de diffusa; de tog inte hänsyn till ljusintensiteter. För att sätta
  värdena rätt måste du sätta alla ljusintensiteter till (1.0, 1.0, 1.0) för att få samma resultat. learnopengls
  lösning är en behållare av **cyanfärgad plast**.

Det här är ingen uppgift i projektet: prova den när du är klar med uppgifterna, och använd **Build & run** för att se
resultatet. Byt ut den föränderliga ljusfärgen mot ett vitt ljus med full intensitet och sätt materialet cyanfärgad
plast:

:::opengl
```cpp
        lightingShader.setVec3("light.ambient", 1.0f, 1.0f, 1.0f); // note that all light colors are set at full intensity
        lightingShader.setVec3("light.diffuse", 1.0f, 1.0f, 1.0f);
        lightingShader.setVec3("light.specular", 1.0f, 1.0f, 1.0f);

        // material properties
        lightingShader.setVec3("material.ambient", 0.0f, 0.1f, 0.06f);
        lightingShader.setVec3("material.diffuse", 0.0f, 0.50980392f, 0.50980392f);
        lightingShader.setVec3("material.specular", 0.50196078f, 0.50196078f, 0.50196078f);
        lightingShader.setFloat("material.shininess", 32.0f);
```
:::
:::vulkan
```cpp
        ubo.light.ambient  = glm::vec3(1.0f, 1.0f, 1.0f); // note that all light colors are set at full intensity
        ubo.light.diffuse  = glm::vec3(1.0f, 1.0f, 1.0f);
        ubo.light.specular = glm::vec3(1.0f, 1.0f, 1.0f);

        // material properties
        ubo.material.ambient   = glm::vec3(0.0f, 0.1f, 0.06f);
        ubo.material.diffuse   = glm::vec3(0.0f, 0.50980392f, 0.50980392f);
        ubo.material.specular  = glm::vec3(0.50196078f, 0.50196078f, 0.50196078f);
        ubo.material.shininess = 32.0f;
```
:::
:::d3d12
```cpp
    constantBufferData.light.ambient = XMFLOAT3(1.0f, 1.0f, 1.0f); // note that all light colors are set at full intensity
    constantBufferData.light.diffuse = XMFLOAT3(1.0f, 1.0f, 1.0f);
    constantBufferData.light.specular = XMFLOAT3(1.0f, 1.0f, 1.0f);

    // material properties
    constantBufferData.material.ambient = XMFLOAT3(0.0f, 0.1f, 0.06f);
    constantBufferData.material.diffuse = XMFLOAT3(0.0f, 0.50980392f, 0.50980392f);
    constantBufferData.material.specular = XMFLOAT3(0.50196078f, 0.50196078f, 0.50196078f);
    constantBufferData.material.shininess = 32.0f;
```
:::

Shininess 32 är tabellens 0.25 multiplicerat med 128. Resultatet är en mörkt cyanfärgad kub med en gråvit högdager
som ser ut som plast. Andra material ur tabellen fungerar på samma sätt.

```quiz
Varför sätter övningen med cyanfärgad plast alla tre ljusintensiteterna till (1.0, 1.0, 1.0)?
- [ ] Eftersom ljusets ambienta och diffusa delar alltid måste vara lika
- [ ] Eftersom plast behöver mer ljus än det korallfärgade materialet för att synas
- [x] Tabellens materialvärden innehåller redan hur starkt varje komponent ska synas; med ljus på full intensitet kommer de ut oförändrade
---
Tabellen gjordes för ett vitt ljus på full styrka: dess ambienta värden är redan mycket mörkare än dess diffusa. Vårt ljus 0.2 och 0.5 skulle skala ner dem en gång till. Med (1, 1, 1) bestämmer materialet ensamt färgen.
```

Med material kan du nu ge varje föremål sitt eget utseende. I nästa kapitel går vi ett steg längre och ger olika
*delar* av samma föremål olika material, med texturer: ljuskartor.
