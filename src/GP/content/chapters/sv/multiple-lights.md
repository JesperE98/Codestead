# Flera ljuskällor

I de tidigare kapitlen lärde vi oss mycket om belysning i {{api}}. Vi lärde oss om Phong-shading, material,
lighting maps och olika typer av ljuskällor. I det här kapitlet ska vi kombinera allt vi lärt oss hittills genom att
skapa en helt belyst scen med 6 aktiva ljuskällor. Vi simulerar ett solliknande ljus som en riktad ljuskälla, 4
punktljus utspridda i scenen, och dessutom lägger vi till en ficklampa.

För att använda mer än en ljuskälla i scenen vill vi kapsla in belysningsberäkningarna i
{{shaderLanguage}}-*funktioner*. Anledningen är att koden snabbt blir rörig när vi gör belysningsberäkningar med flera ljustyper som var
och en kräver olika beräkningar. Om vi gjorde alla de här beräkningarna i main-funktionen skulle koden snabbt bli svår
att förstå.

Funktioner i {{shaderLanguage}} är precis som C-funktioner. Vi har ett funktionsnamn, en returtyp, och vi behöver
deklarera en prototyp högst upp i kodfilen om funktionen inte redan har deklarerats före main-funktionen. Vi skapar en
egen funktion för varje ljustyp: riktade ljus, punktljus och strålkastare.

När man använder flera ljus i en scen ser angreppssättet oftast ut så här: vi har en enda färgvektor som
representerar fragmentets utfärg. För varje ljus läggs ljusets bidrag till fragmentet till den här färgvektorn. Varje
ljus i scenen räknar alltså ut sin egen inverkan och bidrar med den till den slutliga utfärgen. En allmän struktur
skulle se ut ungefär så här:

:::opengl
```glsl
void main()
{
    // define an output color value
    vec3 result = vec3(0.0);
    // add the directional light's contribution to the output
    result += someFunctionToCalculateDirectionalLight();
    // do the same for all point lights
    for (int i = 0; i < nr_of_point_lights; i++)
        result += someFunctionToCalculatePointLight();
    // and add others lights as well (like spotlights)
    result += someFunctionToCalculateSpotLight();

    FragColor = vec4(result, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    // define an output color value
    vec3 result = vec3(0.0);
    // add the directional light's contribution to the output
    result += someFunctionToCalculateDirectionalLight();
    // do the same for all point lights
    for (int i = 0; i < nr_of_point_lights; i++)
        result += someFunctionToCalculatePointLight();
    // and add others lights as well (like spotlights)
    result += someFunctionToCalculateSpotLight();

    outColor = vec4(result, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // define an output color value
    float3 result = float3(0.0f, 0.0f, 0.0f);
    // add the directional light's contribution to the output
    result += someFunctionToCalculateDirectionalLight();
    // do the same for all point lights
    for (int i = 0; i < nr_of_point_lights; i++)
        result += someFunctionToCalculatePointLight();
    // and add others lights as well (like spotlights)
    result += someFunctionToCalculateSpotLight();

    return float4(result, 1.0f);
}
```
:::

Den faktiska koden skiljer sig säkert mellan implementationer, men den allmänna strukturen är densamma. Vi definierar
flera funktioner som räknar ut inverkan per ljuskälla och lägger till den resulterande färgen till en utfärgsvektor.
Om till exempel två ljuskällor ligger nära fragmentet ger deras sammanlagda bidrag ett starkare upplyst fragment än
om fragmentet lyses upp av en enda ljuskälla.

:::opengl
Det här kapitlets projekt utgår från resultatet av *Light casters*: de tio behållarna, diffuse och specular map,
shininess 32, kameran i (0, 0, 3) som tittar längs -z, och lampans VAO och `lightCubeShader`. Vertex shadern heter nu
`multiple_lights.vs` (oförändrad). `multiple_lights.fs` är ett nytt skelett: structen `Material`, indata,
`uniform vec3 viewPos;` och `uniform Material material;`, och en `main()` som räknar ut `norm` och `viewDir`, sätter
`vec3 result = vec3(0.0);` och har tre `// TODO:`-kommentarer, en för varje fas. I `main.cpp` sätter renderloopen bara
`viewPos` och `material.shininess`, följt av tre `// TODO:`-kommentarer för ljusens värden; den globala `lightPos` är
borta, och en fjärde `// TODO:` markerar var lamporna ritas.
:::
:::vulkan
Det här kapitlets projekt utgår från resultatet av *Light casters*: de tio behållarna, diffuse map (binding 0) och
specular map (binding 1), shininess 32, uniform buffern på binding 2, kameran i (0, 0, 3) som tittar längs -z, och
båda pipelines – `lightingPipeline` byggs nu från `shaders/multiple_lights.vert` / `.frag`, `lightCubePipeline` från
`shaders/light_cube.*`. Vertex shadern är oförändrad. `multiple_lights.frag` är ett nytt skelett: de två samplers,
`struct Material { float shininess; };`, uniform-blocket `{ mat4 view; mat4 proj; vec3 viewPos; Material material; }`,
indata, och en `main()` som räknar ut `norm` och `viewDir`, sätter `vec3 result = vec3(0.0);` och har tre
`// TODO:`-kommentarer, en för varje fas. I C++ är structen `Light` och den globala `lightPos` borta,
`UniformBufferObject` slutar med `Material material;`, `updateUniformBuffer()` sätter `viewPos` och
`material.shininess` följt av tre `// TODO:`-kommentarer för ljusen, och en fjärde `// TODO:` i
`recordCommandBuffer()` markerar var lamporna ritas.
:::
:::d3d12
Det här kapitlets projekt utgår från resultatet av *Light casters*: de tio behållarna, diffuse och specular map,
shininess 32, kameran i (0, 0, 3) som tittar längs -z, och lampans pipeline state `m_lightCubePipelineState`. De
belysta objektens shaders ligger nu i `multiple_lights.hlsl`: `VSMain` är oförändrad; där finns texturerna, `struct
Material { float shininess; }`, cbuffern `SceneConstantBuffer` med `view`, `projection`, `viewPos` och `material`
(inget ljus ännu), och en ny `PSMain` som räknar ut `norm` och `viewDir`, sätter `float3 result = float3(0.0f, 0.0f,
0.0f);` och har tre `// TODO:`-kommentarer, en för varje fas. I `main.cpp` är C++-structen `Light` och den globala
`lightPos` borta, `OnUpdate` sätter bara `viewPos` och `material.shininess`, följt av tre `// TODO:`-kommentarer för
ljusen, och en fjärde `// TODO:` i `PopulateCommandList` markerar var lamporna ritas.
:::

`// TODO:`-kommentarerna markerar var din kod ska in. Efter varje uppgift trycker du på **Build & run** (Ctrl+Enter)
för att kompilera programmet och köra det i den inbyggda simulatorn. Bygg det en gång nu: utan något ljus alls är alla
tio behållarna svarta mot den mörkgrå bakgrunden.

> Som i *Light casters* använder vi learnopengls kamera i (0, 0, 3), så att alla tio behållarna syns. I slutet av
> kapitlet ser du att det döljer de flesta lamporna: de ligger utanför fönstret eller bakom behållare.

## Riktat ljus

Vi vill definiera en funktion i fragment shadern som räknar ut det bidrag ett riktat ljus ger till fragmentet: en
funktion som tar några parametrar och returnerar den uträknade färgen från det riktade ljuset.

Först behöver vi de variabler som ett riktat ljus minst behöver. Vi kan lagra dem i en struct som heter `DirLight`
och definiera den som en uniform:

:::opengl
```glsl
struct DirLight {
    vec3 direction;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
uniform DirLight dirLight;
```

Sedan kan vi skicka uniformen `dirLight` till en funktion med följande prototyp:

```glsl
vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir);
```

> Precis som i C och C++ måste en funktion som vi vill anropa (i det här fallet inne i funktionen `main`) vara
> definierad någonstans före raden där den anropas. Här vill vi helst definiera funktionerna nedanför `main`, så det
> kravet uppfylls inte. Därför deklarerar vi funktionernas prototyper någonstans ovanför `main`, precis som vi skulle
> göra i C.

Du ser att funktionen behöver en `DirLight`-struct och två andra vektorer för sin beräkning. Om du klarade förra
kapitlet bör innehållet i den här funktionen inte komma som någon överraskning:

```glsl
// calculates the color when using a directional light.
vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir)
{
    vec3 lightDir = normalize(-light.direction);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(material.diffuse, TexCoords));
    vec3 diffuse = light.diffuse * diff * vec3(texture(material.diffuse, TexCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.specular, TexCoords));
    return (ambient + diffuse + specular);
}
```

Vi kopierade i stort sett koden från förra kapitlet och använde vektorerna som ges som funktionsargument för att räkna
ut det riktade ljusets bidragsvektor. De resulterande bidragen från ambient, diffuse och specular returneras sedan som
en enda färgvektor. Funktionen läser `material` och `TexCoords` direkt: de är globala i shadern (en uniform och en
indatavariabel), så alla funktioner kan använda dem.

I `main.cpp` sätter vi learnopengls värden för solen – riktningen från *Light casters* och ganska svaga färger,
eftersom fem ljus till ska ansluta:

```cpp
        // directional light
        lightingShader.setVec3("dirLight.direction", -0.2f, -1.0f, -0.3f);
        lightingShader.setVec3("dirLight.ambient", 0.05f, 0.05f, 0.05f);
        lightingShader.setVec3("dirLight.diffuse", 0.4f, 0.4f, 0.4f);
        lightingShader.setVec3("dirLight.specular", 0.5f, 0.5f, 0.5f);
```
:::
:::vulkan
```glsl
struct DirLight {
    vec3 direction;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
```

I Vulkan är ljuset inte en egen uniform utan en medlem i uniform-blocket, tillagd i slutet:

```glsl
layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    Material material;
    DirLight dirLight;
} ubo;
```

Sedan kan vi skicka `ubo.dirLight` till en funktion med följande prototyp:

```glsl
vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir);
```

> Precis som i C och C++ måste en funktion som vi vill anropa (i det här fallet inne i funktionen `main`) vara
> definierad någonstans före raden där den anropas. Här vill vi helst definiera funktionerna nedanför `main`, så det
> kravet uppfylls inte. Därför deklarerar vi funktionernas prototyper någonstans ovanför `main`, precis som vi skulle
> göra i C.

Du ser att funktionen behöver en `DirLight`-struct och två andra vektorer för sin beräkning. Om du klarade förra
kapitlet bör innehållet i den här funktionen inte komma som någon överraskning:

```glsl
// calculates the color when using a directional light.
vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir) {
    vec3 lightDir = normalize(-light.direction);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(diffuseMap, fragTexCoord));
    vec3 diffuse = light.diffuse * diff * vec3(texture(diffuseMap, fragTexCoord));
    vec3 specular = light.specular * spec * vec3(texture(specularMap, fragTexCoord));
    return (ambient + diffuse + specular);
}
```

Vi kopierade i stort sett koden från förra kapitlet och använde vektorerna som ges som funktionsargument för att räkna
ut det riktade ljusets bidragsvektor. De resulterande bidragen från ambient, diffuse och specular returneras sedan som
en enda färgvektor. Funktionen läser `ubo`, samplers och `fragTexCoord` direkt: de är globala i shadern, så alla
funktioner kan använda dem.

C++-sidan speglar structen enligt std140:s regler: fyra `vec3`, som var och en börjar på en multipel av 16 byte, alltså
en utfyllnadsfloat efter varje – 64 byte. `DirLight dirLight;` läggs i slutet av `UniformBufferObject`, där den börjar
på offset 160 i båda (efter matriserna på 0 och 64, `viewPos` på 128 och den 16 byte stora `Material` på 144):

```cpp
// The lights: the same layout as the structs in the fragment shader (a padding float where a vec3 has no float after it).
struct DirLight {
    glm::vec3 direction;
    float pad1;

    glm::vec3 ambient;
    float pad2;
    glm::vec3 diffuse;
    float pad3;
    glm::vec3 specular;
    float pad4;
};
```

I `updateUniformBuffer()` sätter vi learnopengls värden för solen – riktningen från *Light casters* och ganska svaga
färger, eftersom fem ljus till ska ansluta:

```cpp
        // directional light
        ubo.dirLight.direction = glm::vec3(-0.2f, -1.0f, -0.3f);
        ubo.dirLight.ambient   = glm::vec3(0.05f, 0.05f, 0.05f);
        ubo.dirLight.diffuse   = glm::vec3(0.4f, 0.4f, 0.4f);
        ubo.dirLight.specular  = glm::vec3(0.5f, 0.5f, 0.5f);
```
:::
:::d3d12
```hlsl
struct DirLight
{
    float3 direction;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};
```

Ljuset är en medlem i constant buffern, tillagd i slutet:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPos;
    Material material;
    DirLight dirLight;
};
```

Sedan kan vi skicka `dirLight` till en funktion som räknar ut dess bidrag. Om du klarade förra kapitlet bör
innehållet i den här funktionen inte komma som någon överraskning:

```hlsl
// calculates the color when using a directional light.
float3 CalcDirLight(DirLight light, float3 normal, float3 viewDir, float2 texCoord)
{
    float3 lightDir = normalize(-light.direction);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0f);
    // specular shading
    float3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    // combine results
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, texCoord).rgb;
    return (ambient + diffuse + specular);
}
```

Två skillnader mot learnopengls GLSL-version:

- Precis som i C och C++ måste en funktion vara deklarerad före raden som anropar den. learnopengl deklarerar
  prototyper ovanför `main` och definierar funktionerna nedanför; projektet **definierar helt enkelt funktionerna före
  `PSMain`**, så inga prototyper behövs.
- GLSL:s funktioner läser texturkoordinaterna från den globala indatavariabeln `TexCoords`. I HLSL är de
  interpolerade indata inte globala – de är parametern `input` till `PSMain` – så funktionerna får texturkoordinaterna
  som en **extra sista parameter**, `float2 texCoord`. Constant buffern, texturerna och samplern *är* globala, så
  `material.shininess`, `diffuseMap` och `wrapSampler` kan användas direkt.

C++-sidan speglar HLSL:s packning: fyra `float3`, och eftersom en `float3` inte får gå över en rad på 16 byte börjar
var och en en ny rad – en utfyllnadsfloat efter varje, 64 byte. `DirLight dirLight;` läggs i slutet av
`SceneConstantBuffer`, där den börjar på offset 160 i båda (en struct börjar alltid en ny rad; `material` tog raden på
144):

```cpp
    // The lights: what the shaders see as structs DirLight, PointLight and SpotLight.
    struct DirLight
    {
        XMFLOAT3 direction;
        float padding0;
        XMFLOAT3 ambient;
        float padding1;
        XMFLOAT3 diffuse;
        float padding2;
        XMFLOAT3 specular;
        float padding3;
    };
```

I `OnUpdate` sätter vi learnopengls värden för solen – riktningen från *Light casters* och ganska svaga färger,
eftersom fem ljus till ska ansluta:

```cpp
    // directional light
    constantBufferData.dirLight.direction = XMFLOAT3(-0.2f, -1.0f, -0.3f);
    constantBufferData.dirLight.ambient = XMFLOAT3(0.05f, 0.05f, 0.05f);
    constantBufferData.dirLight.diffuse = XMFLOAT3(0.4f, 0.4f, 0.4f);
    constantBufferData.dirLight.specular = XMFLOAT3(0.5f, 0.5f, 0.5f);
```
:::

Fas 1 i main-funktionen blir sedan det första bidraget till `result`:

:::opengl
```glsl
    // phase 1: directional lighting
    vec3 result = CalcDirLight(dirLight, norm, viewDir);
```
:::
:::vulkan
```glsl
    // phase 1: directional lighting
    vec3 result = CalcDirLight(ubo.dirLight, norm, viewDir);
```
:::
:::d3d12
```hlsl
    // phase 1: directional lighting
    float3 result = CalcDirLight(dirLight, norm, viewDir, input.texCoord);
```
:::

Gör nu den första uppgiften, **dir-light**. När du bygger och kör den lyses behållarna svagt upp ovanifrån, likadant
överallt: sidorna som är vända mot kameran bara lite, sidor som är vända uppåt – som de på behållaren uppe till
vänster – tydligare. Det är det riktade ljuset från *Light casters*, bara svagare.

:::opengl
```quiz
learnopengl definierar `CalcDirLight` nedanför `main`, men `main` anropar den. Varför kompilerar shadern ändå?
- [ ] GLSL kompilerar alla funktioner först och löser anropen efteråt, så ordningen spelar aldrig någon roll
- [ ] Funktioner vars namn börjar med `Calc` behandlas som inbyggda funktioner
- [x] Prototypen `vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir);` ovanför `main` deklarerar funktionen innan den anropas
---
Precis som C kräver GLSL att en funktion är deklarerad före sitt första anrop. Prototypen anger namn, returtyp och parametrar; kroppen kan sedan komma var som helst längre ner.
```
:::
:::vulkan
```quiz
learnopengl definierar `CalcDirLight` nedanför `main`, men `main` anropar den. Varför kompilerar shadern ändå?
- [ ] GLSL kompilerar alla funktioner först och löser anropen efteråt, så ordningen spelar aldrig någon roll
- [x] Prototypen `vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir);` ovanför `main` deklarerar funktionen innan den anropas
- [ ] Funktioner vars namn börjar med `Calc` behandlas som inbyggda funktioner
---
Precis som C kräver GLSL att en funktion är deklarerad före sitt första anrop. Prototypen anger namn, returtyp och parametrar; kroppen kan sedan komma var som helst längre ner.
```
:::
:::d3d12
```quiz
Varför har HLSL-funktionen `CalcDirLight` en fjärde parameter, `float2 texCoord`, som learnopengls GLSL-version inte har?
- [ ] `Sample` accepterar bara texturkoordinater som kommer in som funktionsparameter
- [x] Texturkoordinaterna ingår i `PSMain`:s parameter `input` och är inte globala, så en funktion ser dem bara om de skickas in
- [ ] HLSL-funktioner måste ha minst fyra parametrar
---
I GLSL är `TexCoords` en global indatavariabel som alla funktioner kan läsa. I HLSL når de interpolerade värdena shadern som parameter till ingångspunkten, så `PSMain` skickar vidare `input.texCoord`. Cbuffern, texturerna och samplern är globala och behöver ingen parameter.
```
:::

## Punktljus

Precis som för riktade ljus vill vi definiera en funktion som räknar ut det bidrag ett punktljus ger till fragmentet,
inklusive dess dämpning. Och precis som för riktade ljus vill vi definiera en struct med alla variabler som ett
punktljus behöver:

:::opengl
```glsl
struct PointLight {
    vec3 position;

    float constant;
    float linear;
    float quadratic;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
#define NR_POINT_LIGHTS 4
uniform PointLight pointLights[NR_POINT_LIGHTS];
```
:::
:::vulkan
```glsl
struct PointLight {
    vec3 position;

    float constant;
    float linear;
    float quadratic;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

#define NR_POINT_LIGHTS 4
```

och i uniform-blocket, efter `dirLight`:

```glsl
    PointLight pointLights[NR_POINT_LIGHTS];
```
:::
:::d3d12
```hlsl
// (linear is a word of HLSL: the attenuation terms are called constantTerm, linearTerm
// and quadraticTerm.)
struct PointLight
{
    float3 position;

    float constantTerm;
    float linearTerm;
    float quadraticTerm;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};

#define NR_POINT_LIGHTS 4
```

och i cbuffern, efter `dirLight`:

```hlsl
    PointLight pointLights[NR_POINT_LIGHTS];
```

Som i *Light casters* är `linear` ett nyckelord i HLSL, så termerna heter `constantTerm`, `linearTerm` och
`quadraticTerm`.
:::

Som du ser använde vi ett preprocessordirektiv i {{shaderLanguage}} för att definiera antalet punktljus vi vill ha i
scenen. Konstanten `NR_POINT_LIGHTS` använder vi sedan för att skapa en array av `PointLight`-structar. Arrayer i
{{shaderLanguage}} är precis som C-arrayer och skapas med två hakparenteser. Just nu har vi 4 `PointLight`-structar
att fylla med data.

> Vi skulle också kunna definiera en enda stor struct (i stället för olika structar per ljustyp) som innehåller alla
> variabler som alla ljustyper behöver, använda den structen i varje funktion och helt enkelt strunta i de variabler
> vi inte behöver. Personligen tycker jag dock att det nuvarande angreppssättet är mer intuitivt, och bortsett från
> några extra rader kod kan det spara lite minne, eftersom inte alla ljustyper behöver alla variabler.

Punktljusfunktionens prototyp ser ut så här:

:::opengl
```glsl
vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir);
```
:::
:::vulkan
```glsl
vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir);
```
:::
:::d3d12
```hlsl
float3 CalcPointLight(PointLight light, float3 normal, float3 fragPos, float3 viewDir, float2 texCoord)
```

(definierad efter `CalcDirLight`, före `PSMain`, återigen med den extra parametern `texCoord`).
:::

Funktionen tar all data den behöver som argument och returnerar en vektor som representerar det färgbidrag just det
här punktljuset ger fragmentet. Återigen ger lite intelligent kopierande och klistrande följande funktion:

:::opengl
```glsl
// calculates the color when using a point light.
vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir)
{
    vec3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    // combine results
    vec3 ambient = light.ambient * vec3(texture(material.diffuse, TexCoords));
    vec3 diffuse = light.diffuse * diff * vec3(texture(material.diffuse, TexCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.specular, TexCoords));
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;
    return (ambient + diffuse + specular);
}
```
:::
:::vulkan
```glsl
// calculates the color when using a point light.
vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir) {
    vec3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    // combine results
    vec3 ambient = light.ambient * vec3(texture(diffuseMap, fragTexCoord));
    vec3 diffuse = light.diffuse * diff * vec3(texture(diffuseMap, fragTexCoord));
    vec3 specular = light.specular * spec * vec3(texture(specularMap, fragTexCoord));
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;
    return (ambient + diffuse + specular);
}
```
:::
:::d3d12
```hlsl
// calculates the color when using a point light.
float3 CalcPointLight(PointLight light, float3 normal, float3 fragPos, float3 viewDir, float2 texCoord)
{
    float3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0f);
    // specular shading
    float3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    // attenuation (dist: distance is the name of an HLSL function)
    float dist = length(light.position - fragPos);
    float attenuation = 1.0f / (light.constantTerm + light.linearTerm * dist + light.quadraticTerm * (dist * dist));
    // combine results
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, texCoord).rgb;
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;
    return (ambient + diffuse + specular);
}
```
:::

Att abstrahera bort den här funktionaliteten i en funktion har fördelen att vi enkelt kan räkna ut belysningen för
flera punktljus utan att duplicera kod. I main-funktionen skapar vi helt enkelt en loop som går igenom
punktljusarrayen och anropar `CalcPointLight` för varje punktljus.

```quiz
Vart och ett av de fyra punktljusen har en ambient-styrka på 0.05, och `CalcPointLight` dämpar även ambient-termen. Varför dämpa den här?
- [ ] Det omgivande ljuset får inte överstiga 0.05 totalt
- [ ] Dämpningen gör ambient-termen ljusare nära ljuset, vilket behövs för specular-högdagrarna
- [x] Med flera ljus lägger varje ljus till sin egen ambient-term; utan dämpning skulle ambient-termerna från alla ljus – även avlägsna – läggas på varandra överallt och bleka ut scenen
---
Det här är anmärkningen från *Light casters*: ett enda ljus odämpade ambient är ofarligt, men här adderas fem ljus ambient-termer i varje fragment. Dämpad spelar ett punktljus ambient bara roll nära just det ljuset.
```

## Att sätta ihop allt

Nu när vi har definierat både en funktion för riktade ljus och en funktion för punktljus kan vi sätta ihop allt i
main-funktionen:

:::opengl
```glsl
void main()
{
    // properties
    vec3 norm = normalize(Normal);
    vec3 viewDir = normalize(viewPos - FragPos);

    // our lighting is set up in 3 phases: directional, point lights and an optional flashlight.
    // for each phase, a calculate function returns the colour that light gives this fragment;
    // main() sums them up for this fragment's final colour.
    // phase 1: directional lighting
    vec3 result = CalcDirLight(dirLight, norm, viewDir);
    // phase 2: point lights
    for (int i = 0; i < NR_POINT_LIGHTS; i++)
        result += CalcPointLight(pointLights[i], norm, FragPos, viewDir);
    // phase 3: spot light
    result += CalcSpotLight(spotLight, norm, FragPos, viewDir);

    FragColor = vec4(result, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    // properties
    vec3 norm = normalize(fragNormal);
    vec3 viewDir = normalize(ubo.viewPos - fragPos);

    // our lighting is set up in 3 phases: directional, point lights and an optional flashlight.
    // for each phase, a calculate function returns the colour that light gives this fragment;
    // main() sums them up for this fragment's final colour.
    // phase 1: directional lighting
    vec3 result = CalcDirLight(ubo.dirLight, norm, viewDir);
    // phase 2: point lights
    for (int i = 0; i < NR_POINT_LIGHTS; i++)
        result += CalcPointLight(ubo.pointLights[i], norm, fragPos, viewDir);
    // phase 3: spot light
    result += CalcSpotLight(ubo.spotLight, norm, fragPos, viewDir);

    outColor = vec4(result, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // properties
    float3 norm = normalize(input.normal);
    float3 viewDir = normalize(viewPos - input.fragPos);

    // our lighting is set up in 3 phases: directional, point lights and an optional flashlight.
    // for each phase, a calculate function returns the colour that light gives this fragment;
    // PSMain sums them up for this fragment's final colour.
    // phase 1: directional lighting
    float3 result = CalcDirLight(dirLight, norm, viewDir, input.texCoord);
    // phase 2: point lights
    for (int i = 0; i < NR_POINT_LIGHTS; i++)
        result += CalcPointLight(pointLights[i], norm, input.fragPos, viewDir, input.texCoord);
    // phase 3: spot light
    result += CalcSpotLight(spotLight, norm, input.fragPos, viewDir, input.texCoord);

    return float4(result, 1.0f);
}
```
:::

Varje ljustyp lägger till sitt bidrag till den resulterande utfärgen tills alla ljuskällor har behandlats. Den
resulterande färgen innehåller färgbidraget från alla ljuskällor i scenen tillsammans. Funktionen `CalcSpotLight`
lämnar vi som en övning åt läsaren – eller snarare åt den tredje uppgiften nedan.

> Det finns många duplicerade beräkningar i det här angreppssättet, utspridda över ljustypernas funktioner (till
> exempel uträkningen av reflektionsvektorn, diffuse- och specular-termerna och samplingen av materialets texturer),
> så här finns utrymme för optimering.

:::opengl
Att sätta uniformerna för det riktade ljusets struct borde inte vara alltför obekant, men du undrar kanske hur man
sätter uniformvärdena för punktljusen, eftersom punktljusuniformen faktiskt är en array av `PointLight`-structar. Det
är inget vi har gått igenom tidigare.

Som tur är är det inte särskilt komplicerat. Att sätta uniformvärdena i en array av structar fungerar precis som att
sätta uniformerna i en enskild struct, men den här gången måste vi också ange rätt index när vi frågar efter
uniformens location:

```cpp
lightingShader.setFloat("pointLights[0].constant", 1.0f);
```

Här indexerar vi den första `PointLight`-structen i arrayen `pointLights` och hämtar internt locationen för dess
variabel `constant`, som vi sätter till `1.0`.

Det betyder tyvärr att vi måste sätta alla uniformer för vart och ett av de 4 punktljusen för hand, vilket blir 28
uniformanrop bara för punktljusen – lite omständligt. Du kan försöka abstrahera bort lite av det genom att definiera
en punktljusklass som sätter uniformerna åt dig, men i slutändan måste du ändå sätta varje ljus uniformvärden på det
här sättet. Kommentarsblocket i renderloopen säger samma sak: ett effektivare sätt, *uniform buffer objects*, kommer i
kapitlet *Advanced GLSL*.

Det första punktljuset ser ut så här; de andra tre är likadana med index 1, 2 och 3:

```cpp
        // point light 1
        lightingShader.setVec3("pointLights[0].position", pointLightPositions[0]);
        lightingShader.setVec3("pointLights[0].ambient", 0.05f, 0.05f, 0.05f);
        lightingShader.setVec3("pointLights[0].diffuse", 0.8f, 0.8f, 0.8f);
        lightingShader.setVec3("pointLights[0].specular", 1.0f, 1.0f, 1.0f);
        lightingShader.setFloat("pointLights[0].constant", 1.0f);
        lightingShader.setFloat("pointLights[0].linear", 0.09f);
        lightingShader.setFloat("pointLights[0].quadratic", 0.032f);
```
:::
:::vulkan
Att sätta det riktade ljusets värden borde inte vara alltför obekant, men du undrar kanske hur arrayen av
`PointLight`-structar stämmer överens med C++. I Vulkan är hela blocket ett enda minnesområde, så C++-arrayen måste ha
exakt shaderns **array stride** – avståndet från ett element till nästa.

I std140 är striden för en array av structar structens storlek avrundad uppåt till en multipel av 16. Låt oss lägga ut
shaderns `PointLight`: `position` på 0, `constant` fyller de 4 byte som är kvar efter den (12), `linear` och
`quadratic` på 16 och 20, sedan `ambient` – en `vec3`, alltså på nästa multipel av 16: 32. `diffuse` på 48,
`specular` på 64, slut på 76. Storleken avrundad uppåt till en multipel av 16 är **80**: det är striden.
C++-structen återskapar den med utfyllnadsfloats:

```cpp
struct PointLight {
    glm::vec3 position;

    float constant; // fills the 4 bytes after position
    float linear;
    float quadratic;
    float pad1; // ambient (a vec3) starts at the next multiple of 16 bytes
    float pad2;

    glm::vec3 ambient;
    float pad3;
    glm::vec3 diffuse;
    float pad4;
    glm::vec3 specular;
    float pad5;
};
```

`sizeof(PointLight)` blir då 80, så en vanlig C++-array har samma stride som shaderns, och arrayen läggs i
`UniformBufferObject` efter `dirLight`, på offset 224:

```cpp
    PointLight pointLights[4]; // NR_POINT_LIGHTS in the shader; an array of structs has the same stride (80 bytes) in both
```

> Om en struct i en array inte slutade på en multipel av 16 byte i C++ skulle varje element efter det första vara
> förskjutet jämfört med shaderns – det första punktljuset skulle se rätt ut och de andra skulle läsa skräp. Det är
> den vanligaste buggen med uniform buffers, och det är utfyllnadsfloatarna som förhindrar den.

Värdena är desamma för alla fyra ljusen utom positionen, så `updateUniformBuffer()` sätter dem i en loop:

```cpp
        // point lights 1 to 4
        for (int i = 0; i < 4; i++) {
            ubo.pointLights[i].position  = pointLightPositions[i];
            ubo.pointLights[i].ambient   = glm::vec3(0.05f, 0.05f, 0.05f);
            ubo.pointLights[i].diffuse   = glm::vec3(0.8f, 0.8f, 0.8f);
            ubo.pointLights[i].specular  = glm::vec3(1.0f, 1.0f, 1.0f);
            ubo.pointLights[i].constant  = 1.0f;
            ubo.pointLights[i].linear    = 0.09f;
            ubo.pointLights[i].quadratic = 0.032f;
        }
```

(OpenGL-program sätter varje medlem i varje arrayelement med namn – `"pointLights[0].constant"` – vilket blir 28 anrop
bara för punktljusen. Med en uniform buffer fyller vi bara en C++-struct och kopierar den med en enda `memcpy`.)
:::
:::d3d12
Att sätta det riktade ljusets värden borde inte vara alltför obekant, men du undrar kanske hur arrayen av
`PointLight`-structar stämmer överens med C++. Constant buffern är ett enda minnesområde, så C++-arrayen måste ha
exakt HLSL-arrayens **stride** – avståndet från ett element till nästa.

HLSL packar inte arrayer: varje arrayelement börjar en ny rad på 16 byte, och det gör varje struct också. Lägg ut
HLSL:s `PointLight` som i *Light casters*: `position` på 0, `constantTerm` på 12, `linearTerm` och `quadraticTerm` på
16 och 20, `ambient` på 32 (en `float3` får inte använda de 8 byte som är kvar i den raden), `diffuse` på 48,
`specular` på 64, slut på 76. Nästa element börjar på nästa rad, så striden är **80**. C++-structen återskapar den:

```cpp
    struct PointLight
    {
        XMFLOAT3 position;
        float constantTerm;    // fills the row of position
        float linearTerm;
        float quadraticTerm;
        float padding0[2];     // ambient would cross into the next row: HLSL starts it there
        XMFLOAT3 ambient;
        float padding1;
        XMFLOAT3 diffuse;
        float padding2;
        XMFLOAT3 specular;
        float padding3;
    };
```

`sizeof(PointLight)` blir då 80, så en vanlig C++-array har samma stride som HLSL:s, och arrayen läggs i
`SceneConstantBuffer` efter `dirLight`, på offset 224:

```cpp
        PointLight pointLights[4];    // NR_POINT_LIGHTS: each element starts a new 16-byte row (80 bytes each)
```

> Om C++-structen slutade på 76 byte i stället för 80 skulle varje element efter det första vara förskjutet jämfört
> med HLSL:s – det första punktljuset skulle se rätt ut och de andra skulle läsa skräp. Det är den avslutande
> `padding3` som förhindrar det.

Sedan sätter `OnUpdate` varje ljus värden och indexerar arrayen som vilken C++-array av structar som helst. Det första
punktljuset ser ut så här; de andra tre är likadana med index 1, 2 och 3:

```cpp
    // point light 1
    constantBufferData.pointLights[0].position = pointLightPositions[0];
    constantBufferData.pointLights[0].ambient = XMFLOAT3(0.05f, 0.05f, 0.05f);
    constantBufferData.pointLights[0].diffuse = XMFLOAT3(0.8f, 0.8f, 0.8f);
    constantBufferData.pointLights[0].specular = XMFLOAT3(1.0f, 1.0f, 1.0f);
    constantBufferData.pointLights[0].constantTerm = 1.0f;
    constantBufferData.pointLights[0].linearTerm = 0.09f;
    constantBufferData.pointLights[0].quadraticTerm = 0.032f;
```
:::

Låt oss inte glömma att vi också behöver en positionsvektor för vart och ett av punktljusen, så vi sprider ut dem lite
i scenen. Vi definierar ytterligare en `glm::vec3`-array som innehåller punktljusens positioner:

:::opengl
```cpp
    // positions of the point lights
    glm::vec3 pointLightPositions[] = {
        glm::vec3( 0.7f,  0.2f,  2.0f),
        glm::vec3( 2.3f, -3.3f, -4.0f),
        glm::vec3(-4.0f,  2.0f, -12.0f),
        glm::vec3( 0.0f,  0.0f, -3.0f)
    };
```

Den hamnar direkt efter `cubePositions` i `main`.
:::
:::vulkan
```cpp
// positions of the point lights
const std::vector<glm::vec3> pointLightPositions = {
    glm::vec3( 0.7f,  0.2f,  2.0f),
    glm::vec3( 2.3f, -3.3f, -4.0f),
    glm::vec3(-4.0f,  2.0f, -12.0f),
    glm::vec3( 0.0f,  0.0f, -3.0f)
};
```

Den är global, efter `cubePositions`, eftersom både `updateUniformBuffer()` och `recordCommandBuffer()` (för
lamporna) behöver den.
:::
:::d3d12
I DirectXMath är det en array av `XMFLOAT3`:

```cpp
// positions of the point lights
XMFLOAT3 pointLightPositions[] =
{
    XMFLOAT3( 0.7f,  0.2f,  2.0f),
    XMFLOAT3( 2.3f, -3.3f, -4.0f),
    XMFLOAT3(-4.0f,  2.0f, -12.0f),
    XMFLOAT3( 0.0f,  0.0f, -3.0f)
};
```

Den är global, efter `fov`, eftersom både `OnUpdate` och `PopulateCommandList` (för lamporna) behöver den.
:::

Gör nu uppgiften **point-lights**: structen, arrayen, `CalcPointLight` med sin prototyp eller definition, fas 2,
positionerna och de fyra ljusens värden. När du bygger och kör den är scenen mycket ljusare. Behållarna nära kameran
lyses upp mest, framför allt av punktljuset i (0.7, 0.2, 2.0) precis framför dem; även en avlägsen behållare högst upp
i fönstret är upplyst nu, av punktljuset i (-4.0, 2.0, -12.0) nära den.

:::opengl
```quiz
Hur sätter du den linjära termen för det *tredje* punktljuset från `main.cpp`?
- [ ] `lightingShader.setFloat("pointLights[3].linear", 0.09f);`
- [ ] `lightingShader.setFloat("pointLights.linear[2]", 0.09f);`
- [x] `lightingShader.setFloat("pointLights[2].linear", 0.09f);`
---
Varje medlem i varje arrayelement är en egen uniform, med ett namn som ett C-uttryck: array, index (som börjar på 0, så det tredje ljuset är `[2]`), sedan medlemmen.
```
:::
:::vulkan
```quiz
Shaderns `PointLight` slutar på byte 76. Var börjar `pointLights[1]`, räknat från `pointLights[0]`?
- [ ] 76 byte senare – direkt efter den sista medlemmen
- [ ] 128 byte senare – std140 avrundar arrayelement uppåt till en tvåpotens
- [x] 80 byte senare – i std140 är array stride structens storlek avrundad uppåt till en multipel av 16
---
Därför slutar C++-structen `PointLight` med `pad5`: med den är `sizeof(PointLight)` 80, samma som shaderns stride, så `ubo.pointLights[1]` hamnar där shadern läser `pointLights[1]`.
```
:::
:::d3d12
```quiz
HLSL:s `PointLight` slutar på byte 76. Var börjar `pointLights[1]`, räknat från `pointLights[0]`?
- [ ] 96 byte senare – en struct i en cbuffer tar alltid sex rader
- [x] 80 byte senare – varje arrayelement börjar en ny rad på 16 byte
- [ ] 76 byte senare – HLSL packar arrayelement tätt
---
HLSL packar inte arrayer: varje element börjar på en radgräns. Därför slutar C++-structen `PointLight` med `padding3`: med den är `sizeof(PointLight)` 80, så C++-arrayen har HLSL:s stride.
```
:::

### Ficklampan

Den tredje fasen är strålkastaren från *Light casters* – med mjuka kanter – som en funktion. Dess struct har
learnopengls ordning för `SpotLight`: position, riktning, de två gränsvärdena, dämpningstermerna och färgerna:

:::opengl
```glsl
struct SpotLight {
    vec3 position;
    vec3 direction;
    float cutOff;
    float outerCutOff;

    float constant;
    float linear;
    float quadratic;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
[...]
uniform SpotLight spotLight;
```
:::
:::vulkan
```glsl
struct SpotLight {
    vec3 position;
    vec3 direction;
    float cutOff;
    float outerCutOff;

    float constant;
    float linear;
    float quadratic;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
```

`SpotLight spotLight;` följer efter `pointLights` i blocket. I std140: `position` 0, `direction` 16, `cutOff` 28,
`outerCutOff` 32, termerna 36, 40 och 44, så `ambient` börjar exakt på 48 utan utfyllnad, `diffuse` 64 och `specular`
80 – 96 byte. C++-structen behöver bara `pad1` efter `position` och en float efter varje färg:

```cpp
struct SpotLight {
    glm::vec3 position;
    float pad1;
    glm::vec3 direction;
    float cutOff; // fills the 4 bytes after direction
    float outerCutOff;

    float constant;
    float linear;
    float quadratic;

    glm::vec3 ambient; // at 48 bytes: a multiple of 16
    float pad2;
    glm::vec3 diffuse;
    float pad3;
    glm::vec3 specular;
    float pad4;
};
```

(Jämför med de 112 byten för den mjuka strålkastaren i *Light casters*, som hade dämpningstermerna i slutet: den här
ordningen slösar mindre plats.)
:::
:::d3d12
```hlsl
struct SpotLight
{
    float3 position;
    float3 direction;
    float cutOff;
    float outerCutOff;

    float constantTerm;
    float linearTerm;
    float quadraticTerm;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};
```

`SpotLight spotLight;` följer efter `pointLights` i cbuffern. Det är layouten för det slutliga ljuset i *Light
casters*, så C++-structen är densamma, 96 byte:

```cpp
    struct SpotLight
    {
        XMFLOAT3 position;
        float padding0;
        XMFLOAT3 direction;
        float cutOff;          // fills the row of direction
        float outerCutOff;     // outerCutOff and the three terms fill the next row
        float constantTerm;
        float linearTerm;
        float quadraticTerm;
        XMFLOAT3 ambient;
        float padding1;
        XMFLOAT3 diffuse;
        float padding2;
        XMFLOAT3 specular;
        float padding3;
    };
```
:::

Funktionen kombinerar dämpningen med intensiteten för de mjuka kanterna och tillämpar båda på alla tre termerna:

:::opengl
```glsl
// calculates the color when using a spot light.
vec3 CalcSpotLight(SpotLight light, vec3 normal, vec3 fragPos, vec3 viewDir)
{
    vec3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    // spotlight intensity
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = light.cutOff - light.outerCutOff;
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(material.diffuse, TexCoords));
    vec3 diffuse = light.diffuse * diff * vec3(texture(material.diffuse, TexCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.specular, TexCoords));
    ambient *= attenuation * intensity;
    diffuse *= attenuation * intensity;
    specular *= attenuation * intensity;
    return (ambient + diffuse + specular);
}
```
:::
:::vulkan
```glsl
// calculates the color when using a spot light.
vec3 CalcSpotLight(SpotLight light, vec3 normal, vec3 fragPos, vec3 viewDir) {
    vec3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    // spotlight intensity
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = light.cutOff - light.outerCutOff;
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(diffuseMap, fragTexCoord));
    vec3 diffuse = light.diffuse * diff * vec3(texture(diffuseMap, fragTexCoord));
    vec3 specular = light.specular * spec * vec3(texture(specularMap, fragTexCoord));
    ambient *= attenuation * intensity;
    diffuse *= attenuation * intensity;
    specular *= attenuation * intensity;
    return (ambient + diffuse + specular);
}
```
:::
:::d3d12
```hlsl
// calculates the color when using a spot light.
float3 CalcSpotLight(SpotLight light, float3 normal, float3 fragPos, float3 viewDir, float2 texCoord)
{
    float3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0f);
    // specular shading
    float3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    // attenuation (dist: distance is the name of an HLSL function)
    float dist = length(light.position - fragPos);
    float attenuation = 1.0f / (light.constantTerm + light.linearTerm * dist + light.quadraticTerm * (dist * dist));
    // spotlight intensity
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = light.cutOff - light.outerCutOff;
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0f, 1.0f);
    // combine results
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, texCoord).rgb;
    ambient *= attenuation * intensity;
    diffuse *= attenuation * intensity;
    specular *= attenuation * intensity;
    return (ambient + diffuse + specular);
}
```
:::

learnopengls ficklampa har inget eget omgivande ljus (solen och punktljusen ger tillräckligt), full styrka för diffuse
och specular, dämpningen för ett avstånd på 50, och en snävare mjuk kant än förut – från 12.5° till 15°:

:::opengl
```cpp
        // spotLight
        lightingShader.setVec3("spotLight.position", cameraPos);
        lightingShader.setVec3("spotLight.direction", cameraFront);
        lightingShader.setVec3("spotLight.ambient", 0.0f, 0.0f, 0.0f);
        lightingShader.setVec3("spotLight.diffuse", 1.0f, 1.0f, 1.0f);
        lightingShader.setVec3("spotLight.specular", 1.0f, 1.0f, 1.0f);
        lightingShader.setFloat("spotLight.constant", 1.0f);
        lightingShader.setFloat("spotLight.linear", 0.09f);
        lightingShader.setFloat("spotLight.quadratic", 0.032f);
        lightingShader.setFloat("spotLight.cutOff", glm::cos(glm::radians(12.5f)));
        lightingShader.setFloat("spotLight.outerCutOff", glm::cos(glm::radians(15.0f)));
```
:::
:::vulkan
```cpp
        // spotLight
        ubo.spotLight.position    = cameraPos;
        ubo.spotLight.direction   = cameraFront;
        ubo.spotLight.ambient     = glm::vec3(0.0f, 0.0f, 0.0f);
        ubo.spotLight.diffuse     = glm::vec3(1.0f, 1.0f, 1.0f);
        ubo.spotLight.specular    = glm::vec3(1.0f, 1.0f, 1.0f);
        ubo.spotLight.constant    = 1.0f;
        ubo.spotLight.linear      = 0.09f;
        ubo.spotLight.quadratic   = 0.032f;
        ubo.spotLight.cutOff      = glm::cos(glm::radians(12.5f));
        ubo.spotLight.outerCutOff = glm::cos(glm::radians(15.0f));
```
:::
:::d3d12
```cpp
    // spotLight
    XMStoreFloat3(&constantBufferData.spotLight.position, cameraPos);
    XMStoreFloat3(&constantBufferData.spotLight.direction, cameraFront);
    constantBufferData.spotLight.ambient = XMFLOAT3(0.0f, 0.0f, 0.0f);
    constantBufferData.spotLight.diffuse = XMFLOAT3(1.0f, 1.0f, 1.0f);
    constantBufferData.spotLight.specular = XMFLOAT3(1.0f, 1.0f, 1.0f);
    constantBufferData.spotLight.constantTerm = 1.0f;
    constantBufferData.spotLight.linearTerm = 0.09f;
    constantBufferData.spotLight.quadraticTerm = 0.032f;
    constantBufferData.spotLight.cutOff = std::cos(XMConvertToRadians(12.5f));
    constantBufferData.spotLight.outerCutOff = std::cos(XMConvertToRadians(15.0f));
```
:::

:::vulkan
Med strålkastaren är uniform-blocket komplett: 160 byte för matriserna, `viewPos` och materialet, 64 för `dirLight`,
4 × 80 för `pointLights` och 96 för `spotLight` – 640 byte, med varje medlem på samma offset i shadern och i
`UniformBufferObject`.
:::
:::d3d12
Med strålkastaren är constant buffern komplett: 160 byte för matriserna, `viewPos` och materialet, 64 för `dirLight`,
4 × 80 för `pointLights` och 96 för `spotLight` – 640 byte, med varje fält på samma offset i HLSL och C++. En
constant buffer view måste vara en multipel av 256 byte, så `CalculateConstantBufferByteSize` avrundar buffern och dess
vy uppåt till 768; projektet använder den redan, så inget annat ändras.
:::

Gör nu uppgiften **spot-light**. När du bygger och kör den dyker en ljus skiva upp på behållare 0, där ficklampan
träffar den: träet i mitten och stålramen runt omkring blir nästan dubbelt så ljusa, ramen nästan vit. Hörnen på
behållare 0 och alla andra behållare förblir exakt som de var.

```quiz
Efter uppgiften **spot-light** ser hörnen på behållare 0 och alla andra behållare exakt ut som förut. Varför tillför ficklampan ingenting där?
- [ ] Strålkastaren räknas bara ut för fragment på behållare 0
- [x] De fragmenten ligger utanför den yttre konen, så `intensity` är 0 – och eftersom ficklampans ambient är (0, 0, 0) och även ambient-termen multipliceras med intensiteten blir dess bidrag där exakt noll
- [ ] Strålkastarens dämpning är 0 för varje fragment längre bort än 3 enheter
---
`CalcSpotLight` multiplicerar alla tre termerna med `attenuation * intensity`. Utanför 15° är den begränsade intensiteten 0, så funktionen returnerar svart, och att lägga till svart till `result` ändrar ingenting.
```

```quiz
Mitt på behållare 0 ger de sex ljusen tillsammans en färg vars komponenter kan bli större än 1.0. Vad händer med ett sådant värde?
- [x] Det begränsas till 1.0 när det skrivs till fönstrets bild, som lagrar normaliserade 8-bitarsvärden – starkt upplysta delar mättas mot vitt
- [ ] Värdet slår runt och blir mörkt igen
- [ ] Hela färgen delas med sin största komponent, så att nyansen förblir densamma
---
Fönstrets bild lagrar varje komponent som 0–255, alltså 0.0–1.0. Högre resultat begränsas helt enkelt, och därför blir överkanten av behållare 0:s stålram nästan vit (255 i den blå kanalen). Att hantera ljusstyrka över 1.0 på rätt sätt är ämnet för HDR, mycket senare i learnopengl.
```

### Lamporna

Till sist lamporna: en liten vit kub på varje punktljus position, ritad med lampans shaders efter behållarna –
learnopengls *nu ritar vi lika många glödlampor som vi har punktljus*:

:::opengl
```cpp
        // also draw the lamp object(s)
        lightCubeShader.use();
        lightCubeShader.setMat4("projection", projection);
        lightCubeShader.setMat4("view", view);

        // we now draw as many light bulbs as we have point lights.
        glBindVertexArray(lightCubeVAO);
        for (unsigned int i = 0; i < 4; i++)
        {
            model = glm::mat4(1.0f);
            model = glm::translate(model, pointLightPositions[i]);
            model = glm::scale(model, glm::vec3(0.2f)); // make it a smaller cube
            lightCubeShader.setMat4("model", model);
            glDrawArrays(GL_TRIANGLES, 0, 36);
        }
```
:::
:::vulkan
I `recordCommandBuffer()`, efter behållarnas loop, binder vi lampans pipeline en gång; descriptor seten förblir bunden
(båda pipelines använder samma pipeline layout), och i loopen ändras bara den modellmatris som skickas:

```cpp
        // also draw the lamp objects
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, lightCubePipeline);

        // we now draw as many light bulbs as we have point lights.
        for (unsigned int i = 0; i < 4; i++) {
            model = glm::mat4(1.0f);
            model = glm::translate(model, pointLightPositions[i]);
            model = glm::scale(model, glm::vec3(0.2f)); // make it a smaller cube
            constants.model = model;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

            vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
        }
```
:::
:::d3d12
I `PopulateCommandList`, efter behållarnas loop, byter vi till lampans pipeline state en gång; root signaturen och
dess tabeller förblir satta, och i loopen ändras bara modellmatrisen i root constants. DirectXMath multiplicerar
radvektorer, så skalningen kommer först och förflyttningen sedan:

```cpp
    // also draw the lamp object(s): with the lamp's pipeline state, a small cube (scale 0.2)
    // at each point light's position
    m_commandList->SetPipelineState(m_lightCubePipelineState.Get());
    for (UINT i = 0; i < 4; i++)
    {
        XMMATRIX model = XMMatrixScaling(0.2f, 0.2f, 0.2f) * XMMatrixTranslation(pointLightPositions[i].x, pointLightPositions[i].y, pointLightPositions[i].z);
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        m_commandList->DrawInstanced(36, 1, 0, 0);
    }
```
:::

Gör nu den sista uppgiften, **lamps**. Bygg och kör den sedan – och titta noga, för nästan ingenting ändras. Med
kameran i (0, 0, 3) som tittar längs -z:

- lampa 1 i (0.7, 0.2, 2.0) ligger bara en enhet framför kameran och mest utanför vyn: du ser bara en smal vit strimma
  vid fönstrets högra kant;
- lampa 2 i (2.3, -3.3, -4.0) ligger nedanför fönstrets nederkant;
- lampa 3 i (-4.0, 2.0, -12.0) är dold bakom behållare 9, nära det övre vänstra hörnet;
- lampa 4 i (0.0, 0.0, -3.0) ligger rakt bakom behållare 0.

Koden är rätt ändå: fyra ritanrop till med lampans shaders. På din egen dator kan du backa med S och titta runt med
musen, så dyker de fyra lamporna upp där ljuset kommer ifrån.

```quiz
Efter uppgiften **lamps** ser du bara en smal vit strimma vid högra kanten. Var är de andra lamporna?
- [ ] De ritas inte, eftersom bara den första lampans modellmatris skickas
- [ ] De ritas svarta, eftersom lampans shader inte har något ljus
- [x] Med kameran i (0, 0, 3) ligger en nedanför fönstret, och två ligger bakom behållare 9 och 0, så djuptestet döljer dem
---
Alla fyra lamporna ritas varje bildruta. Kameran står bara inte så att den ser dem: lampa 2 är utanför vyn, lamporna 3 och 4 klarar inte djuptestet bakom närmare behållare, och lampa 1 ligger mest bredvid vyn.
```

Som du ser verkar det finnas någon form av globalt ljus (som en sol) någonstans på himlen, vi har 4 ljus utspridda i
scenen, och en ficklampa syns ur spelarens perspektiv. Ser ganska snyggt ut, eller hur?

Alla ljuskällor använder standardvärdena vi har använt i de tidigare kapitlen, men om du leker med värdena kan du få
riktigt intressanta resultat. Grafiker och nivådesigners finjusterar i allmänhet alla de här belysningsvariablerna i
en stor editor för att se till att belysningen passar miljön. Med vår enkla belysningsmiljö kan du redan skapa
ganska intressanta bilder bara genom att justera ljusens attribut.

learnopengl visar det med fyra bilder av samma scen – en öken, en fabrik, en skräckscen och ett biokemiskt
laboratorium – där bara ljusens attribut och clear-färgen (ändrad för att passa belysningen bättre) skiljer sig: genom
att bara justera några av belysningsparametrarna kan du skapa helt olika stämningar.

Nu bör du ha en ganska god förståelse för belysning i {{api}}. Med kunskaperna hittills kan vi redan skapa
intressanta och visuellt rika miljöer och stämningar. Prova att leka med alla de olika värdena för att skapa dina egna
stämningar.

## Övningar

- Kan du (någorlunda) återskapa de olika stämningarna i learnopengls sista bild – en **öken**, en **fabrik**, en
  **skräckscen** och ett **biokemiskt laboratorium** – genom att justera ljusens attributvärden?

:::opengl
Det här är ingen uppgift i projektet: prova när du är klar med uppgifterna, och använd **Build & run** för att
jämföra. Ändra clear-färgen i `glClearColor` och ljusens färger i renderloopen. För en öken kan du till exempel göra
allt varmt: en gulaktig clear-färg, ett starkt gulvitt riktat ljus och orange punktljus. För en skräckscen: en nästan
svart clear-färg, ett mycket svagt riktat ljus, dämpade rödaktiga punktljus med kort räckvidd (linear 0.14, quadratic
0.07 eller kortare räckvidder ur tabellen i *Light casters*) och en smal ficklampa. Kom ihåg att ge lamporna
punktljusens färger också om du vill att de ska stämma – det kräver en färguniform i `light_cube.fs`.
:::
:::vulkan
Det här är ingen uppgift i projektet: prova när du är klar med uppgifterna, och använd **Build & run** för att
jämföra. Ändra clear-färgen (`clearValues[0].color` i `recordCommandBuffer()`) och ljusens färger i
`updateUniformBuffer()`. För en öken kan du till exempel göra allt varmt: en gulaktig clear-färg, ett starkt gulvitt
riktat ljus och orange punktljus. För en skräckscen: en nästan svart clear-färg, ett mycket svagt riktat ljus,
dämpade rödaktiga punktljus med kort räckvidd (linear 0.14, quadratic 0.07 eller kortare räckvidder ur tabellen i
*Light casters*) och en smal ficklampa. Om du vill att lamporna också ska visa punktljusens färger, ge lampans shader
en färg – till exempel i push constants.
:::
:::d3d12
Det här är ingen uppgift i projektet: prova när du är klar med uppgifterna, och använd **Build & run** för att
jämföra. Ändra clear-färgen (`clearColor` i `PopulateCommandList`) och ljusens färger i `OnUpdate`. För en öken kan du
till exempel göra allt varmt: en gulaktig clear-färg, ett starkt gulvitt riktat ljus och orange punktljus. För en
skräckscen: en nästan svart clear-färg, ett mycket svagt riktat ljus, dämpade rödaktiga punktljus med kort räckvidd
(linear 0.14, quadratic 0.07 eller kortare räckvidder ur tabellen i *Light casters*) och en smal ficklampa. Om du vill
att lamporna också ska visa punktljusens färger, ge `light_cube.hlsl` en färg – till exempel i root constants.
:::

Det här var det sista kapitlet i delen *Lighting*. Allt du har lärt dig här – Phong-modellen, material, lighting maps
och ljuskällor – är grunden som resten av learnopengl bygger på.
