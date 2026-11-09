# Ljuskällor

All belysning vi hittills har använt kom från en enda källa som är en enda punkt i rymden. Det ger bra resultat, men i
verkligheten finns flera typer av ljus som beter sig olika. En ljuskälla som *kastar* ljus på objekt kallas en
**light caster** (ljuskälla). I det här kapitlet går vi igenom flera olika typer av ljuskällor. Att kunna simulera
olika ljuskällor är ännu ett verktyg i din verktygslåda för att göra dina miljöer rikare.

Först går vi igenom ett riktat ljus (directional light), sedan ett punktljus (point light), som är en utbyggnad av det
vi hade tidigare, och sist strålkastare (spotlights). I nästa kapitel kombinerar vi flera av de här ljustyperna i en
och samma scen.

:::opengl
Det här kapitlets projekt utgår från resultatet av *Lighting maps* (utan emissionsövningen): samma `main.cpp` och
`shader_m.h`, behållarens diffuse map `container2.png` och specular map `container2_specular.png`, och lampans
shaders `light_cube.vs` / `light_cube.fs`. De belysta objektens shaders heter nu `light_casters.vs` och
`light_casters.fs`; fragment shadern har structen `Material` (två samplers och en shininess) och en struct `Light`
med en `position` och styrkorna för de tre färgdelarna.

Två saker är nya. Scenen har learnopengls **tio behållare** igen – `cubePositions` från *Coordinate Systems* och en
`for`-loop som ritar var och en med sin egen modellmatris (roterad 20° · i, ingenting snurrar med tiden). Och kameran
är **tillbaka i (0, 0, 3)** och tittar längs -z (`cameraPos`, `cameraFront`, `yaw = -90.0f`, `pitch = 0.0f`), så att
alla tio behållarna syns och behållare 0 fyller mitten av fönstret. Ljuset är fortfarande punktljuset från *Lighting
maps* i `lightPos` (1.2, 1.0, 2.0), med ambient 0.2, diffuse 0.5, specular 1.0 och shininess 64.
:::
:::vulkan
Det här kapitlets projekt utgår från resultatet av *Lighting maps* (utan emissionsövningen): diffuse map på binding
0, specular map på binding 1 och uniform buffern på binding 2. De belysta objektens shaders heter nu
`shaders/light_casters.vert` och `shaders/light_casters.frag`; lampan behåller `shaders/light_cube.*` och sin egen
pipeline, `lightCubePipeline`. Uniform-blocket innehåller matriserna, `viewPos`, en `Material` (shininess) och en
`Light` med en `position` och styrkorna för de tre färgdelarna, speglade av C++-structar med utfyllnadsfloats.

Två saker är nya. Scenen har learnopengls **tio behållare** igen: en global `cubePositions` och en loop i
`recordCommandBuffer()` som skickar varje behållares modellmatris som push constant (roterad 20° · i, ingenting
snurrar med tiden) och ritar den. Och kameran är **tillbaka i (0, 0, 3)** och tittar längs -z (`cameraPos`,
`cameraFront`, `yaw = -90`, `pitch = 0`), så att alla tio behållarna syns och behållare 0 fyller mitten av fönstret.
Ljuset är fortfarande punktljuset från *Lighting maps* i `lightPos` (1.2, 1.0, 2.0), som `updateUniformBuffer()`
sätter med ambient 0.2, diffuse 0.5, specular 1.0 och shininess 64.
:::
:::d3d12
Det här kapitlets projekt utgår från resultatet av *Lighting maps* (utan emissionsövningen): diffuse map (`t0`) och
specular map (`t1`), constant buffern `SceneConstantBuffer` (`b1`) och root constants med modell- och
normalmatrisen (`b0`). De belysta objektens shaders ligger nu i `light_casters.hlsl`; lampan behåller
`light_cube.hlsl` och sitt eget pipeline state, `m_lightCubePipelineState`. Constant buffern innehåller matriserna,
`viewPos`, en `Material` (shininess) och en `Light` med en `position` och styrkorna för de tre färgdelarna, speglade
av C++-structar med utfyllnadsfloats.

Två saker är nya. Scenen har learnopengls **tio behållare** igen: `PopulateCommandList` har arrayen `cubePositions`
och en `for`-loop som sätter varje behållares modellmatris (roterad 20° · i, ingenting snurrar med tiden) och
normalmatris som root constants och ritar den. Och kameran är **tillbaka i (0, 0, 3)** och tittar längs -z
(`cameraPos`, `cameraFront`, `yaw = -90.0f`, `pitch = 0.0f`), så att alla tio behållarna syns och behållare 0 fyller
mitten av fönstret. Ljuset är fortfarande punktljuset från *Lighting maps* i `lightPos` (1.2, 1.0, 2.0), som
`OnUpdate` sätter med ambient 0.2, diffuse 0.5, specular 1.0 och shininess 64.
:::

> De tidigare belysningskapitlen placerade kameran åt sidan så att du kunde se både den belysta kuben *och* lampan. I
> det här kapitlet och nästa använder vi i stället learnopengls kamera. Priset är att lampan i (1.2, 1.0, 2.0) nu
> ligger **utanför fönstret**: bara en enhet framför kameran men en bit åt höger (och lite uppåt), bortom kanten av
> vyn. Även i de steg där lampan ritas ser du den alltså inte. På din egen dator kan du fortfarande flyga runt med
> tangentbordet och musen och leta upp den.

Den här gången har projektet inga `// TODO:`-kommentarer: varje uppgift ändrar kod som redan finns, och uppgiftstexten
talar om var. Efter varje uppgift trycker du på **Build & run** (Ctrl+Enter) för att kompilera programmet och köra det
i den inbyggda simulatorn. Bygg det en gång nu: alla tio behållarna lyses upp av lampan, de avlägsna lika starkt som
de nära.

## Riktat ljus

När en ljuskälla är långt borta är ljusstrålarna från den nästan parallella med varandra. Det ser ut som om alla
ljusstrålar kommer från samma riktning, oavsett var objektet och/eller betraktaren befinner sig. När en ljuskälla
modelleras som *oändligt* långt borta kallas den ett **riktat ljus** (directional light), eftersom alla dess
ljusstrålar har samma riktning; det är oberoende av ljuskällans position.

Ett bra exempel på en riktad ljuskälla är solen. Solen är inte oändligt långt bort från oss, men den är så långt bort
att vi kan betrakta den som oändligt avlägsen i belysningsberäkningarna. Alla solens ljusstrålar modelleras då som
parallella strålar, som en mängd parallella pilar som alla pekar åt samma håll mot objekten.

Eftersom alla ljusstrålar är parallella spelar det ingen roll hur varje objekt förhåller sig till ljuskällans
position, eftersom ljusets riktning är densamma för varje objekt i scenen. Och eftersom ljusets riktningsvektor är
densamma blir belysningsberäkningarna likadana för varje objekt i scenen.

Vi kan modellera ett sådant riktat ljus genom att definiera en riktningsvektor för ljuset i stället för en
positionsvektor. Shaderberäkningarna förblir i stort sett desamma, förutom att vi den här gången använder ljusets
`direction`-vektor direkt i stället för att räkna ut vektorn `lightDir` med ljusets `position`-vektor:

:::opengl
```glsl
struct Light {
    // vec3 position; // no longer needed when using directional lights
    vec3 direction;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
[...]
void main()
{
    vec3 lightDir = normalize(-light.direction);
    [...]
}
```
:::
:::vulkan
```glsl
struct Light {
    // vec3 position; // no longer needed when using directional lights
    vec3 direction;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
[...]
void main() {
    [...]
    vec3 lightDir = normalize(-ubo.light.direction);
    [...]
}
```
:::
:::d3d12
```hlsl
// A directional light: the direction its rays go and how strong its ambient, diffuse
// and specular parts are.
struct Light
{
    // float3 position; // no longer necessary when using directional lights.
    float3 direction;
    float3 ambient;
    float3 diffuse;
    float3 specular;
};
[...]
    float3 lightDir = normalize(-light.direction);
```
:::

Observera att vi först negerar vektorn `light.direction`. De belysningsberäkningar vi har använt hittills förväntar
sig att ljusriktningen är en riktning från fragmentet *mot* ljuskällan, men man brukar föredra att ange ett riktat
ljus som en global riktning som pekar *från* ljuskällan. Därför måste vi negera den globala riktningsvektorn för att
vända den; nu är det en riktningsvektor som pekar mot ljuskällan. Se också till att normalisera vektorn, eftersom det
är oklokt att anta att indatavektorn är en enhetsvektor.

Den resulterande `lightDir`-vektorn används sedan som tidigare i beräkningarna av diffuse och specular.

För att tydligt visa att ett riktat ljus har samma effekt på flera objekt ritar projektet behållarscenen från slutet av
*Coordinate Systems*: vi definierade 10 olika behållarpositioner och gav varje behållare en egen modellmatris med de
transformationer från lokala koordinater till världskoordinater som hör till den:

:::opengl
```cpp
        for (unsigned int i = 0; i < 10; i++)
        {
            // calculate the model matrix for each object and pass it to shader before drawing
            model = glm::mat4(1.0f);
            model = glm::translate(model, cubePositions[i]);
            float angle = 20.0f * i;
            model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f));
            lightingShader.setMat4("model", model);

            glDrawArrays(GL_TRIANGLES, 0, 36);
        }
```
:::
:::vulkan
```cpp
        for (unsigned int i = 0; i < 10; i++) {
            // calculate the model matrix for each object and push it before drawing
            model = glm::mat4(1.0f);
            model = glm::translate(model, cubePositions[i]);
            float angle = 20.0f * i;
            model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f));
            constants.model = model;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

            vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
        }
```
:::
:::d3d12
```cpp
    for (UINT i = 0; i < 10; i++)
    {
        float angle = 20.0f * i;
        XMMATRIX model = XMMatrixRotationAxis(XMVectorSet(1.0f, 0.3f, 0.5f, 0.0f), XMConvertToRadians(angle))
            * XMMatrixTranslation(cubePositions[i].x, cubePositions[i].y, cubePositions[i].z);
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));

        // The normal matrix: the transpose of the inverse of the model matrix.
        XMMATRIX normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model));
        XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixTranspose(normalMatrix));
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        m_commandList->DrawInstanced(36, 1, 0, 0);
    }
```
:::

Glöm inte heller att faktiskt ange ljuskällans riktning (observera att vi definierar riktningen som en riktning
*från* ljuskällan; du ser snabbt att ljusets riktning pekar nedåt):

:::opengl
```cpp
        lightingShader.setVec3("light.direction", -0.2f, -1.0f, -0.3f);
```

Uniformen `light.position` finns inte längre i shadern, så den här raden ersätter
`lightingShader.setVec3("light.position", lightPos);`.
:::
:::vulkan
```cpp
        ubo.light.direction = glm::vec3(-0.2f, -1.0f, -0.3f);
```

I Vulkan är uniform buffern vanligt minne som shadern läser på fasta offsets, så C++-structen `Light` måste ändras i
takt med shaderns. I ett uniform-block (std140-layout) börjar en `vec3` på en multipel av 16 byte, precis som en
`vec4`: därför har C++-structen en utfyllnadsfloat efter varje `glm::vec3`. Riktningen tar helt enkelt positionens
plats – samma typ, samma offset (0), och `pad1` blir kvar:

```cpp
struct Light {
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

Det blir 64 byte: fyra platser à 16 byte, riktningen och de tre färgerna.
:::
:::d3d12
```cpp
    constantBufferData.light.direction = XMFLOAT3(-0.2f, -1.0f, -0.3f);
```

Constant buffern är vanligt minne som shadern läser på fasta offsets, så C++-structen `Light` måste ändras i takt med
HLSL-structen. HLSL packar en cbuffer i rader om 16 byte och låter aldrig en `float3` gå över från en rad till nästa,
så två `float3` efter varandra börjar var sin rad: C++-structen behöver en utfyllnadsfloat efter varje `XMFLOAT3`.
Riktningen tar helt enkelt positionens plats – samma typ, samma offset (0), och `padding0` blir kvar:

```cpp
    struct Light
    {
        // XMFLOAT3 position; // no longer necessary when using directional lights.
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
:::

learnopengl sänker också shininess till 32 för ljuskällorna, och eftersom ett riktat ljus inte har någon position är
en lampkub någonstans i scenen meningslös: vi kommenterar bort ritningen av lampan.

> Vi har ett tag skickat ljusets positions- och riktningsvektorer som `vec3`, men en del föredrar att definiera alla
> vektorer som `vec4`. När man definierar positionsvektorer som `vec4` är det viktigt att sätta `w`-komponenten till
> `1.0` så att förflyttningar och projektioner tillämpas korrekt. När man däremot definierar en riktningsvektor som
> `vec4` vill vi inte att förflyttningar ska ha någon effekt (den representerar ju bara en riktning, inget mer), så då
> sätter vi `w`-komponenten till `0.0`.
>
> Riktningsvektorer kan då skrivas som `vec4(-0.2f, -1.0f, -0.3f, 0.0f)`. Det kan också fungera som ett enkelt sätt
> att skilja ljustyper åt: du kan kontrollera om `w`-komponenten är `1.0` – då har vi en ljusposition – eller `0.0` –
> då har vi en ljusriktning – och anpassa beräkningarna efter det:
>
> ```glsl
> if (lightVector.w == 0.0) // note: be careful for floating point errors
>     // do directional light calculations
> else if (lightVector.w == 1.0)
>     // do light calculations using the light's position (as in previous chapters)
> ```
>
> Kul fakta: det var faktiskt så gamla OpenGL (fixed-functionality) avgjorde om en ljuskälla var ett riktat ljus eller
> en positionell ljuskälla och anpassade belysningen efter det.

Gör nu den första uppgiften, **directional**. När du bygger och kör den lyses alla behållare upp från samma riktning –
uppifrån, lite framifrån vänster. Framsidorna som tittar mot kameran får bara lite ljus (ljuset träffar dem i en flack
vinkel), medan sidor som är vända uppåt, som de på behållaren uppe till vänster, är tydligt ljusare. Och en avlägsen
behållare lyses upp exakt lika starkt som en nära: ett riktat ljus har inget avstånd.

```quiz
Ljusets riktning är (-0.2, -1.0, -0.3), men shadern räknar ut `lightDir` från `-light.direction`. Varför minustecknet?
- [ ] Därför att ljuset lyser uppåt och måste vändas för att lysa nedåt
- [x] Därför att beräkningarna av diffuse och specular förväntar sig en vektor från fragmentet mot ljuset, medan ljusets riktning pekar från ljuset in i scenen
- [ ] Därför att behållarnas normalvektorer pekar inåt
---
`dot(norm, lightDir)` är störst när normalen pekar *mot* ljuset. Riktningen vi anger pekar bort från ljuset (nedåt, som solljus), så shadern vänder den en gång och normaliserar den.
```

## Punktljus

Riktade ljus är utmärkta för globala ljus som lyser upp hela scenen, men oftast vill vi också ha flera **punktljus**
(point lights) utspridda i scenen. Ett punktljus är en ljuskälla med en given position någonstans i världen som lyser
åt alla håll, där ljusstrålarna avtar med avståndet. Tänk på glödlampor och facklor som ljuskällor som beter sig som
punktljus.

I de tidigare kapitlen har vi arbetat med ett förenklat punktljus. Vi hade en ljuskälla på en given position som
sprider ljus åt alla håll från den positionen. Men ljuskällan vi definierade simulerade ljusstrålar som aldrig avtar,
vilket får den att se extremt stark ut. I de flesta 3D-program vill vi simulera en ljuskälla som bara lyser upp ett
område nära ljuskällan och inte hela scenen.

Om du lade till de 10 behållarna i belysningsscenen från de tidigare kapitlen skulle du märka att behållaren längst
bak lyses upp med samma intensitet som behållaren framför ljuset; det finns ännu ingen logik som minskar ljuset med
avståndet. Vi vill att behållaren längst bak bara ska vara svagt upplyst jämfört med behållarna nära ljuskällan. Det
var precis det du såg i startbilden för det här projektet.

## Dämpning

Att minska ljusets intensitet med avståndet en ljusstråle färdas kallas i allmänhet **dämpning** (attenuation). Ett
sätt att minska ljusintensiteten med avståndet är att helt enkelt använda en linjär ekvation. En sådan ekvation
skulle minska ljusintensiteten linjärt med avståndet och därmed se till att objekt på avstånd blir mindre ljusa. En
linjär funktion tenderar dock att se lite konstlad ut. I verkligheten är ljus i allmänhet ganska starka nära, men
ljuskällans styrka avtar snabbt i början och den återstående intensiteten avtar sedan långsammare med avståndet. Vi
behöver alltså en annan ekvation för att minska ljusets intensitet.

Som tur är har några smarta människor redan räknat ut det åt oss. Följande formel beräknar ett dämpningsvärde utifrån
fragmentets avstånd till ljuskällan, som vi sedan multiplicerar med ljusets intensitetsvektor:

```text
                         1.0
F_att = ---------------------------------
          K_c  +  K_l * d  +  K_q * d²
```

Här är `d` avståndet från fragmentet till ljuskällan. För att beräkna dämpningsvärdet definierar vi sedan 3
(inställbara) termer: en **konstant** term `K_c`, en **linjär** term `K_l` och en **kvadratisk** term `K_q`.

- Den konstanta termen hålls oftast på `1.0`, och den finns främst till för att nämnaren aldrig ska bli mindre än 1,
  eftersom den annars skulle förstärka intensiteten på vissa avstånd, vilket inte är den effekt vi är ute efter.
- Den linjära termen multipliceras med avståndet och minskar intensiteten linjärt.
- Den kvadratiska termen multipliceras med kvadraten på avståndet och ger en kvadratisk minskning av ljuskällans
  intensitet. Den kvadratiska termen betyder mindre än den linjära när avståndet är litet, men blir mycket större när
  avståndet växer.

På grund av den kvadratiska termen avtar ljuset mest linjärt tills avståndet blir så stort att den kvadratiska termen
går om den linjära, och därefter minskar ljusintensiteten mycket snabbare. Resultatet är att ljuset är ganska
intensivt på nära håll, men snabbt tappar styrka med avståndet tills det till slut tappar styrka i långsammare takt.
Med värdena vi använder nedan (konstant 1.0, linjär 0.09, kvadratisk 0.032) blir dämpningen:

| Avstånd `d` | 0 | 1 | 5 | 10 | 20 | 50 |
|---|---|---|---|---|---|---|
| `F_att` | 1.0 | 0.89 | 0.44 | 0.20 | 0.06 | 0.01 |

Du ser att ljuset har högst intensitet när avståndet är litet, men så snart avståndet växer minskar intensiteten
avsevärt, och den når långsamt 0 vid ett avstånd på omkring 50 eller mer. Det är precis vad vi vill ha.

### Att välja rätt värden

Men vilka värden ska de 3 termerna ha? Rätt värden beror på många faktorer: miljön, avståndet du vill att ett ljus
ska täcka, typen av ljus osv. Oftast är det helt enkelt en fråga om erfarenhet och en lagom mängd finjustering.
Följande tabell visar några värden som termerna kan ha för att simulera en realistisk (någorlunda) ljuskälla som
täcker en viss radie (avstånd). Den första kolumnen anger avståndet ett ljus täcker med de givna termerna. Värdena är
bra utgångspunkter för de flesta ljus, med tack till Ogre3D:s wiki:

| Avstånd | Konstant | Linjär | Kvadratisk |
|---|---|---|---|
| 7 | 1.0 | 0.7 | 1.8 |
| 13 | 1.0 | 0.35 | 0.44 |
| 20 | 1.0 | 0.22 | 0.20 |
| 32 | 1.0 | 0.14 | 0.07 |
| 50 | 1.0 | 0.09 | 0.032 |
| 65 | 1.0 | 0.07 | 0.017 |
| 100 | 1.0 | 0.045 | 0.0075 |
| 160 | 1.0 | 0.027 | 0.0028 |
| 200 | 1.0 | 0.022 | 0.0019 |
| 325 | 1.0 | 0.014 | 0.0007 |
| 600 | 1.0 | 0.007 | 0.0002 |
| 3250 | 1.0 | 0.0014 | 0.000007 |

Som du ser hålls den konstanta termen `K_c` på `1.0` i alla fall. Den linjära termen `K_l` är oftast ganska liten för
att täcka större avstånd, och den kvadratiska termen `K_q` är ännu mindre. Experimentera gärna lite med värdena för att
se deras effekt i din implementation. I vår miljö räcker ett avstånd på 32 till 100 i allmänhet för de flesta ljus.

```quiz
Med konstant 1.0, linjär 0.09 och kvadratisk 0.032 – ungefär hur mycket av ljusets styrka når ett fragment 10 enheter från ljuset?
- [ ] Ungefär 50 % – den linjära termen halverar den var tionde enhet
- [x] Ungefär 20 % – 1.0 / (1.0 + 0.9 + 3.2) ≈ 0.2
- [ ] Ungefär 90 % – den kvadratiska termen spelar bara roll bortom 50 enheter
---
Vid d = 10 är nämnaren 1.0 + 0.09 · 10 + 0.032 · 100 = 5.1, så F_att ≈ 0.196. På det här avståndet dominerar redan den kvadratiska termen (3.2) över den linjära (0.9).
```

### Att implementera dämpning

För att implementera dämpning behöver vi 3 extra värden i fragment shadern: ekvationens konstanta, linjära och
kvadratiska term. De lagras bäst i structen `Light` som vi definierade tidigare. Observera att vi åter behöver räkna
ut `lightDir` med `position`, eftersom det här är ett punktljus (som i de tidigare kapitlen) och inte ett riktat ljus.

:::opengl
```glsl
struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

    float constant;
    float linear;
    float quadratic;
};
```

Sedan sätter vi termerna i programmet: vi vill att ljuset ska täcka ett avstånd på 50, så vi använder motsvarande
konstanta, linjära och kvadratiska termer från tabellen:

```cpp
        lightingShader.setFloat("light.constant", 1.0f);
        lightingShader.setFloat("light.linear", 0.09f);
        lightingShader.setFloat("light.quadratic", 0.032f);
```

Varje medlem i en uniform-struct är en egen uniform, med en egen location och ett eget namn: `light.constant`,
`light.linear` och så vidare. Hjälpfunktionerna `setFloat` och `setVec3` i `shader_m.h` slår upp namnet med
`glGetUniformLocation` och sätter värdet med `glUniform1f` / `glUniform3fv`. Positionen kommer tillbaka med
`lightingShader.setVec3("light.position", lightPos);`.
:::
:::vulkan
```glsl
struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

    float constant;
    float linear;
    float quadratic;
};
```

I C++ måste structen ge varje medlem samma offset som std140 gör. Reglerna vi behöver: en `vec3` börjar på en
multipel av 16 byte, en `float` behöver bara en multipel av 4 – så en float kan fylla de 4 byte som är kvar direkt
efter en `vec3` – och storleken på en struct i ett uniform-block avrundas uppåt till en multipel av 16. I shadern
ligger `specular` på offset 48, så `constant` fyller dess sista 4 byte (60), `linear` och `quadratic` följer på 64
och 68, och structen slutar på 72, avrundat uppåt till 80:

```cpp
struct Light {
    glm::vec3 position;
    float pad1;

    glm::vec3 ambient;
    float pad2;
    glm::vec3 diffuse;
    float pad3;
    glm::vec3 specular;

    float constant; // fills the 4 bytes after specular
    float linear;
    float quadratic;
    float pad4; // the size of a struct in a uniform block is rounded up to a multiple of 16 bytes
    float pad5;
};
```

Sedan sätter vi termerna i `updateUniformBuffer()`: vi vill att ljuset ska täcka ett avstånd på 50, så vi använder
motsvarande konstanta, linjära och kvadratiska termer från tabellen:

```cpp
        ubo.light.constant  = 1.0f;
        ubo.light.linear    = 0.09f;
        ubo.light.quadratic = 0.032f;
```

Positionen kommer tillbaka med `ubo.light.position = lightPos;`.
:::
:::d3d12
Det finns en hake i HLSL: `linear` är ett nyckelord i språket (en interpolationsmodifierare, som `nointerpolation`),
så det kan inte vara namnet på en struct-medlem. Projektet kallar därför de tre termerna `constantTerm`, `linearTerm`
och `quadraticTerm`. Det lägger dem också direkt efter `position`, där de fyller resten av positionens rad:

```hlsl
// A point light: its position, how its light fades with the distance (attenuation), and
// how strong its ambient, diffuse and specular parts are. (linear is a word of HLSL:
// the three terms are called constantTerm, linearTerm and quadraticTerm.)
struct Light
{
    float3 position;
    float constantTerm;
    float linearTerm;
    float quadraticTerm;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};
```

Räkna ut packningen rad för rad: `position` tar byte 0–11 och `constantTerm` fyller 12–15 i första raden;
`linearTerm` och `quadraticTerm` tar 16–23 i andra raden. `ambient` behöver 12 byte men bara 8 är kvar i den raden,
och en `float3` får inte gå över en radgräns, så HLSL börjar den på 32. `diffuse` och `specular` följer på 48 och 64.
C++-structen kopierar den layouten:

```cpp
    struct Light
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

Sedan sätter vi termerna i `OnUpdate`: vi vill att ljuset ska täcka ett avstånd på 50, så vi använder motsvarande
konstanta, linjära och kvadratiska termer från tabellen:

```cpp
    constantBufferData.light.constantTerm = 1.0f;
    constantBufferData.light.linearTerm = 0.09f;
    constantBufferData.light.quadraticTerm = 0.032f;
```

Positionen kommer tillbaka med `constantBufferData.light.position = lightPos;`.
:::

Att implementera dämpning i fragment shadern är ganska enkelt: vi räknar helt enkelt ut ett dämpningsvärde enligt
ekvationen och multiplicerar det med ambient-, diffuse- och specular-komponenterna.

Vi behöver dock avståndet till ljuskällan för att ekvationen ska fungera. Minns du hur vi räknar ut längden av en
vektor? Vi får fram avståndet genom att räkna ut skillnadsvektorn mellan fragmentet och ljuskällan och ta längden av
den. Till det kan vi använda {{shaderLanguage}}:s inbyggda funktion `length`:

:::opengl
```glsl
    // attenuation
    float distance    = length(light.position - FragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
```

Sedan tar vi med dämpningsvärdet i belysningsberäkningarna genom att multiplicera det med ambient-, diffuse- och
specular-färgerna:

```glsl
    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;

    vec3 result = ambient + diffuse + specular;
```
:::
:::vulkan
```glsl
    // attenuation
    float distance    = length(ubo.light.position - fragPos);
    float attenuation = 1.0 / (ubo.light.constant + ubo.light.linear * distance + ubo.light.quadratic * (distance * distance));
```

Sedan tar vi med dämpningsvärdet i belysningsberäkningarna genom att multiplicera det med ambient-, diffuse- och
specular-färgerna:

```glsl
    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;

    vec3 result = ambient + diffuse + specular;
```
:::
:::d3d12
`distance` är också namnet på en inbyggd funktion i HLSL (avståndet mellan två punkter), så den lokala variabeln heter
`dist`:

```hlsl
    // attenuation (dist: distance is the name of an HLSL function)
    float dist = length(light.position - input.fragPos);
    float attenuation = 1.0f / (light.constantTerm + light.linearTerm * dist + light.quadraticTerm * (dist * dist));
```

Sedan tar vi med dämpningsvärdet i belysningsberäkningarna genom att multiplicera det med ambient-, diffuse- och
specular-färgerna:

```hlsl
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;

    float3 result = ambient + diffuse + specular;
```
:::

> Vi skulle kunna låta ambient-komponenten vara så att det omgivande ljuset inte minskar med avståndet, men om vi
> använder mer än 1 ljuskälla börjar alla ambient-komponenter läggas på varandra. Då vill vi dämpa även det omgivande
> ljuset. Prova helt enkelt vad som passar bäst i din miljö.

Gör nu uppgiften **point-light**: positionen kommer tillbaka i stället för riktningen, structen får de tre termerna,
shadern dämpningen, och lampan ritas igen (med den här kameran syns den inte, som sagt). När du bygger och kör den
lyses behållarna nära ljuset upp som förut – lite mörkare, eftersom även behållare 0, ungefär 2 enheter från ljuset,
får en dämpning på cirka 0.75 – medan behållarna längre bak tonar bort. Den avlägsna behållaren högst upp i fönstret,
ungefär 17 enheter från ljuset, är nästan svart.

:::opengl
```quiz
Fragment shadern har en uniform-struct `Light light;` med en medlem `float linear;`. Hur ger `main.cpp` den ett värde?
- [x] `lightingShader.setFloat("light.linear", 0.09f);` – varje struct-medlem är en egen uniform, som hittas med sitt fullständiga namn
- [ ] Ett enda `glUniform`-anrop som kopierar en C++-struct `Light` till shaderns struct
- [ ] `lightingShader.setFloat("linear", 0.09f);` – structens namn är valfritt
---
OpenGL har ingen enskild uniform för en struct: varje medlem får en egen location, och `glGetUniformLocation` hittar den med namnet `light.linear`. En C++-struct kopieras aldrig – du sätter medlem för medlem.
```
:::
:::vulkan
```quiz
Punktljusets C++-struct `Light` slutar med `float quadratic; float pad4; float pad5;`. Varför de två utfyllnadsfloatarna i slutet?
- [ ] Utan dem skulle `quadratic` hamna på fel offset
- [x] I std140 avrundas storleken på en struct uppåt till en multipel av 16 byte: medlemmarna slutar på 72, så structen tar 80 byte
- [ ] glm kräver att varje struct slutar med två utfyllnadsfloats
---
Inget följer efter ljuset i uniform-blocket, så här ändrar de två floatarna ingen offset – men de gör `sizeof(Light)` lika med shaderns 80 byte, vilket spelar roll så snart något följer efter structen eller structen är ett element i en array (som i nästa kapitel).
```
:::
:::d3d12
```quiz
I HLSL-punktljuset följs `position` (en `float3`) av `constantTerm`, `linearTerm` och `quadraticTerm`. På vilken byte-offset börjar `ambient`?
- [ ] 24 – direkt efter `quadraticTerm`
- [x] 32 – en `float3` får inte gå över en rad på 16 byte, och bara 8 byte är kvar i raden som börjar på 16
- [ ] 28 – HLSL justerar en `float3` till 4 byte
---
Raderna är 16 byte. `position` + `constantTerm` fyller rad 0 (0–15), `linearTerm` och `quadraticTerm` tar 16–23, och den 12 byte stora `ambient` skulle nå in i nästa rad, så den börjar på 32. Därför har C++-structen `float padding0[2];` före `ambient`.
```
:::

## Strålkastare

Den sista ljustypen vi ska gå igenom är en **strålkastare** (spotlight). En strålkastare är en ljuskälla som finns
någonstans i miljön och som, i stället för att skjuta ljusstrålar åt alla håll, bara skjuter dem i en viss riktning.
Resultatet är att bara objekten inom en viss radie runt strålkastarens riktning lyses upp, och allt annat förblir
mörkt. Bra exempel på strålkastare är en gatlykta eller en ficklampa.

En strålkastare representeras av en position i världsrymden, en riktning och en **cutoff**-vinkel (gränsvinkel) som
anger strålkastarens radie. För varje fragment räknar vi ut om fragmentet ligger mellan strålkastarens
gränsriktningar (alltså i dess kon), och i så fall lyser vi upp fragmentet. Föreställ dig en kon med spetsen i ljuset:

- `LightDir`: vektorn som pekar från fragmentet till ljuskällan.
- `SpotDir`: riktningen strålkastaren är riktad åt.
- `Phi` ϕ: gränsvinkeln som anger strålkastarens radie. Allt utanför den här vinkeln lyses inte upp av
  strålkastaren.
- `Theta` θ: vinkeln mellan vektorn `LightDir` och vektorn `SpotDir`. θ ska vara mindre än ϕ för att fragmentet ska
  vara inne i strålkastarens ljus.

Det vi i grunden behöver göra är alltså att räkna ut skalärprodukten (som ger cosinus för vinkeln mellan två
enhetsvektorer) mellan vektorn `LightDir` och vektorn `SpotDir`, och jämföra den med gränsvinkeln ϕ. Nu när du
(någorlunda) förstår vad en strålkastare handlar om ska vi skapa en i form av en ficklampa.

## Ficklampa

En ficklampa är en strålkastare som sitter i betraktarens position och oftast är riktad rakt framåt ur spelarens
perspektiv. En ficklampa är i grunden en vanlig strålkastare, men dess position och riktning uppdateras hela tiden
utifrån spelarens position och orientering.

Värdena vi behöver i fragment shadern är alltså strålkastarens positionsvektor (för att räkna ut riktningen från
fragmentet till ljuset), strålkastarens riktningsvektor och gränsvinkeln. Vi kan lagra dem i structen `Light`:

:::opengl
```glsl
struct Light {
    vec3 position;
    vec3 direction;
    float cutOff;
    [...]
};
```

Sedan skickar vi rätt värden till shadern:

```cpp
        lightingShader.setVec3("light.position", cameraPos);
        lightingShader.setVec3("light.direction", cameraFront);
        lightingShader.setFloat("light.cutOff", glm::cos(glm::radians(12.5f)));
```
:::
:::vulkan
```glsl
struct Light {
    vec3 position;
    vec3 direction;
    float cutOff;
    [...]
};
```

I C++ är `direction` en `vec3` och börjar på offset 16; `cutOff` är en float och fyller de 4 byte som är kvar direkt
efter den (offset 28). Allt efter flyttas 16 byte nedåt, och structen växer till 96 byte:

```cpp
struct Light {
    glm::vec3 position;
    float pad1;
    glm::vec3 direction;
    float cutOff; // fills the 4 bytes after direction

    glm::vec3 ambient;
    [...]
};
```

Sedan skickar vi rätt värden till shadern i `updateUniformBuffer()`:

```cpp
        ubo.light.position = cameraPos;
        ubo.light.direction = cameraFront;
        ubo.light.cutOff = glm::cos(glm::radians(12.5f));
```
:::
:::d3d12
```hlsl
struct Light
{
    float3 position;
    float3 direction;
    float cutOff;

    float constantTerm;
    float linearTerm;
    float quadraticTerm;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};
```

`position` tar rad 0; `direction` kan inte dela den (en `float3` får inte gå över en rad), så den börjar rad 1 på
offset 16, och `cutOff` fyller resten av den raden (28). De tre termerna tar rad 2 (32–43), och eftersom en `float3`
inte får plats i de återstående 4 byten börjar `ambient` rad 3 på 48. I C++:

```cpp
    struct Light
    {
        XMFLOAT3 position;
        float padding0;
        XMFLOAT3 direction;
        float cutOff;          // fills the row of direction
        float constantTerm;
        float linearTerm;
        float quadraticTerm;
        float padding1;
        XMFLOAT3 ambient;
        float padding2;
        XMFLOAT3 diffuse;
        float padding3;
        XMFLOAT3 specular;
        float padding4;
    };
```

Sedan skickar vi rätt värden till shadern i `OnUpdate`. Kamerans vektorer är `XMVECTOR`, så vi lagrar dem i
`XMFLOAT3`-medlemmarna med `XMStoreFloat3`:

```cpp
    // The spotlight is a flashlight: at the camera, pointing where the camera looks.
    XMStoreFloat3(&constantBufferData.light.position, cameraPos);
    XMStoreFloat3(&constantBufferData.light.direction, cameraFront);
    constantBufferData.light.cutOff = std::cos(XMConvertToRadians(12.5f));
```
:::

Som du ser sätter vi inte en vinkel som gränsvärde, utan räknar ut cosinusvärdet för en vinkel och skickar
cosinusresultatet till fragment shadern. Anledningen är att vi i fragment shadern räknar ut skalärprodukten mellan
vektorerna `LightDir` och `SpotDir`, och skalärprodukten ger ett cosinusvärde och inte en vinkel; och vi kan inte
jämföra en vinkel direkt med ett cosinusvärde. För att få fram vinkeln i shadern skulle vi behöva räkna ut arcus
cosinus av skalärproduktens resultat, vilket är en dyr operation. För att spara lite prestanda räknar vi därför ut
cosinusvärdet för en given gränsvinkel i förväg och skickar resultatet till fragment shadern. Eftersom båda
vinklarna nu representeras som cosinusvärden kan vi jämföra dem direkt utan dyra operationer.

Det som återstår är att räkna ut värdet theta θ och jämföra det med gränsvärdet ϕ för att avgöra om vi är innanför
eller utanför strålkastarens ljus:

:::opengl
```glsl
    vec3 lightDir = normalize(light.position - FragPos);

    // check if lighting is inside the spotlight cone
    float theta = dot(lightDir, normalize(-light.direction));

    if (theta > light.cutOff) // remember that we're working with angles as cosines instead of degrees so a '>' is used.
    {
        // do lighting calculations
    }
    else
    {
        // else, use ambient light so scene isn't completely dark outside the spotlight.
        FragColor = vec4(light.ambient * texture(material.diffuse, TexCoords).rgb, 1.0);
    }
```
:::
:::vulkan
```glsl
    vec3 lightDir = normalize(ubo.light.position - fragPos);

    // check if lighting is inside the spotlight cone
    float theta = dot(lightDir, normalize(-ubo.light.direction));

    if (theta > ubo.light.cutOff) { // remember that we're working with angles as cosines instead of degrees so a '>' is used.
        // do lighting calculations
    } else {
        // else, use ambient light so scene isn't completely dark outside the spotlight.
        outColor = vec4(ubo.light.ambient * texture(diffuseMap, fragTexCoord).rgb, 1.0);
    }
```
:::
:::d3d12
```hlsl
    float3 lightDir = normalize(light.position - input.fragPos);

    // The material's colours here. Sampled before the if: Sample() picks the texture's
    // level of detail from the neighbouring pixels, which may take the other branch.
    float3 diffuseColor = diffuseMap.Sample(wrapSampler, input.texCoord).rgb;
    float3 specularColor = specularMap.Sample(wrapSampler, input.texCoord).rgb;

    // check if lighting is inside the spotlight cone
    float theta = dot(lightDir, normalize(-light.direction));

    if (theta > light.cutOff) // remember that we're working with angles as cosines instead of degrees so a '>' is used.
    {
        // do lighting calculations
    }
    else
    {
        // else, use ambient light so scene isn't completely dark outside the spotlight.
        return float4(light.ambient * diffuseColor, 1.0f);
    }
```

Lägg märke till var de två texturerna samplas: *före* `if`-satsen. `Sample` väljer texturens detaljnivå utifrån hur
snabbt texturkoordinaterna ändras mellan grannpixlar, vilket GPU:n räknar ut genom att jämföra pixlar som körs
tillsammans i små grupper om 2×2. Inne i en `if` som beror på pixeln kan en granne ha tagit den andra grenen, och då
är de skillnaderna odefinierade. Att sampla en gång före förgreningen undviker det, och grenarna använder
`diffuseColor` och `specularColor`.
:::

Först räknar vi ut skalärprodukten mellan vektorn `lightDir` och den negerade vektorn `direction` (negerad, eftersom
vi vill att vektorerna ska peka mot ljuskällan i stället för från den). Se till att normalisera alla berörda vektorer.

> Du undrar kanske varför det står `>` i stället för `<` i `if`-villkoret. Borde inte theta vara mindre än ljusets
> gränsvärde för att vara inne i strålkastarens ljus? Det stämmer, men glöm inte att vinklarna representeras som
> cosinusvärden i stället för vinklar. En vinkel på 0 grader motsvaras av cosinusvärdet `1.0`, medan en vinkel på 90
> grader motsvaras av cosinusvärdet `0.0`. Mellan 0 och 90 grader blir cosinus mindre ju större vinkeln är. Nu förstår
> du att ju närmare `1.0` cosinusvärdet ligger, desto mindre är vinkeln. Då blir det begripligt varför theta måste vara
> större än gränsvärdet. Gränsvärdet är just nu satt till cosinus för `12.5`, vilket är `0.976`, så ett cosinusvärde
> för theta mellan `0.976` och `1.0` gör att fragmentet lyses upp som om det vore inne i strålkastarens ljus.

```quiz
`light.cutOff` innehåller cos(12.5°) ≈ 0.976. Vilka fragment lyser `theta > light.cutOff` upp?
- [ ] De som ligger mer än 12.5° från strålkastarens riktning, eftersom deras skalärprodukt är större
- [x] De som ligger mindre än 12.5° från strålkastarens riktning: ju mindre vinkel, desto större cosinus
- [ ] Bara de som ligger exakt 12.5° bort, där theta är lika med gränsvärdet
---
Mellan 0° och 90° minskar cosinus när vinkeln växer: 0° ger 1.0, 12.5° ger 0.976. Så "vinkeln är mindre än gränsvinkeln" blir "cosinus är större än gränsens cosinus" – och shadern behöver aldrig den dyra arcus cosinus.
```

Inne i `if`-satsen gör shadern belysningen som förut, med dämpad diffuse och specular – men inte ambient-termen:

:::opengl
```glsl
        // ambient  *= attenuation; // remove attenuation from ambient, as otherwise at large distances the light would be darker inside than outside the spotlight due the ambient term in the else branch
        diffuse  *= attenuation;
        specular *= attenuation;
```
:::
:::vulkan
```glsl
        // ambient  *= attenuation; // remove attenuation from ambient, as otherwise at large distances the light would be darker inside than outside the spotlight due the ambient term in the else branch
        diffuse  *= attenuation;
        specular *= attenuation;
```
:::
:::d3d12
```hlsl
        // ambient *= attenuation; // remove attenuation from ambient, as otherwise at large distances the light would be darker inside than outside the spotlight due the ambient term in the else branch
        diffuse *= attenuation;
        specular *= attenuation;
```
:::

`else`-grenen använder den odämpade ambient-termen. Om konens insida dämpade sin ambient-term skulle ett avlägset
fragment precis innanför konen kunna bli mörkare än grannen precis utanför – strålkastaren skulle kasta en mörk ring.
learnopengl ändrar också ljusets styrkor för ficklampan: ambient `0.1` och diffuse `0.8` (*vi ställer in
diffuse-intensiteten lite högre; rätt ljusförhållanden skiljer sig mellan varje belysningsmetod och miljö*). Och ljuset sitter
nu vid kameran, så lampkuben kommenteras bort igen.

Gör nu uppgiften **spotlight**. När du kör programmet får du en rund ljusfläck mitt på behållare 0, med en skarp kant:
innanför är trä och stålram starkt upplysta; hörnen på behållare 0 och de andra behållarna (utom kanten på den precis
till höger om den) får bara det omgivande ljuset. Eftersom ficklampan sitter vid kameran följer den med dig när du
rör dig och tittar runt på din egen dator.

:::opengl
```quiz
Anta att du stavar fel på ett medlemsnamn: `lightingShader.setFloat("light.cutoff", …)` i stället för `"light.cutOff"`. Vad händer?
- [ ] Programmet går inte att kompilera
- [ ] OpenGL skapar en ny uniform som heter `light.cutoff`
- [x] `glGetUniformLocation` returnerar -1, anropet `glUniform1f` med location -1 ignoreras i tysthet, och `light.cutOff` behåller sitt standardvärde 0
---
Uniformnamn slås bara upp när programmet körs, så varken C++-kompilatorn eller OpenGL rapporterar felstavningen. Med cutOff = 0 räknas varje fragment mindre än 90° från ficklampans riktning som innanför konen – ingen synlig ljusfläck alls. När en uniform inte verkar ha någon effekt: kontrollera namnet först.
```
:::
:::vulkan
```quiz
I strålkastarens C++-struct `Light` följer `cutOff` direkt efter `glm::vec3 direction` utan utfyllnadsfloat. På vilken offset lägger std140 shaderns `cutOff`?
- [x] 28 – en float behöver bara 4-bytesjustering, så den fyller de sista 4 byten i den 16-bytesplats som `direction` börjar
- [ ] 32 – varje medlem i ett uniform-block börjar på en multipel av 16
- [ ] 40 – efter `direction`, som std140 lagrar som 16 byte plus 8 byte utfyllnad
---
`direction` (en vec3) behöver en multipel av 16 och börjar på 16; den tar 12 byte, fram till 28. Där får `cutOff` plats. Nästa vec3, `ambient`, börjar då på nästa multipel av 16: 32.
```
:::
:::d3d12
```quiz
Varför samplar strålkastarens pixel shader `diffuseMap` och `specularMap` en gång före `if`-satsen i stället för inne i grenarna?
- [ ] Sampling är inte tillåten inne i en `if` i HLSL över huvud taget
- [x] `Sample` väljer detaljnivån utifrån grannpixlarnas texturkoordinater; inne i en förgrening per pixel kan en granne ha tagit den andra vägen, så den informationen är odefinierad
- [ ] För att göra shadern snabbare: en textur kan bara samplas en gång per pixel
---
GPU:n kör pixlar i grupper om 2×2 och jämför deras texturkoordinater för att välja mipnivå. Att sampla före förgreningen, där alla pixlar kör samma kod, håller det väldefinierat; grenarna använder de sparade färgerna.
```
:::

## Mjuka kanter

För att skapa en strålkastare med mjuka kanter vill vi simulera att den har en **inre** och en **yttre** kon. Den inre
konen kan vara konen från förra avsnittet, men vi vill också ha en yttre kon som gradvis dämpar ljuset från den inre
konen ut till den yttre konens kanter.

För att skapa en yttre kon definierar vi helt enkelt ytterligare ett cosinusvärde som representerar vinkeln mellan
strålkastarens riktningsvektor och den yttre konens vektor (lika med dess radie). Om ett fragment ligger mellan den
inre och den yttre konen ska det då få ett intensitetsvärde mellan `0.0` och `1.0`. Ligger fragmentet i den inre konen
är intensiteten `1.0`, och `0.0` om fragmentet ligger utanför den yttre konen.

Ett sådant värde kan vi räkna ut med följande ekvation:

```text
       θ - γ
I  =  -------        with   ε = ϕ - γ
         ε
```

Här är ε (epsilon) cosinusskillnaden mellan den inre (ϕ) och den yttre konen (γ). Det resulterande värdet `I` är då
strålkastarens intensitet i det aktuella fragmentet.

Det är lite svårt att föreställa sig hur formeln fungerar, så låt oss prova den med några exempelvärden. Med en inre
kon på 12.5° (ϕ = 0.9763) och en yttre kon på 17.5° (γ = 0.9537) blir ε = 0.9763 − 0.9537 = 0.0226:

| θ i grader | θ (cosinus) | (θ − γ) / ε | begränsat |
|---|---|---|---|
| 0 | 1.0000 | 2.05 | 1.0 |
| 10 | 0.9848 | 1.38 | 1.0 |
| 12.5 | 0.9763 | 1.00 | 1.0 |
| 14 | 0.9703 | 0.73 | 0.73 |
| 15 | 0.9659 | 0.54 | 0.54 |
| 16 | 0.9613 | 0.33 | 0.33 |
| 17.5 | 0.9537 | 0.00 | 0.0 |
| 20 | 0.9397 | −0.62 | 0.0 |

Som du ser interpolerar vi i grunden mellan den yttre och den inre cosinusen utifrån värdet θ. Om du fortfarande inte
riktigt ser vad som händer, oroa dig inte – du kan helt enkelt ta formeln för given och återvända hit när du är mycket
äldre och klokare.

Nu har vi ett intensitetsvärde som är negativt utanför strålkastarens ljus, större än `1.0` inne i den inre konen och
någonstans däremellan runt kanterna. Om vi begränsar värdena ordentligt behöver vi inte längre någon `if-else` i
fragment shadern, utan kan helt enkelt multiplicera ljuskomponenterna med det uträknade intensitetsvärdet:

:::opengl
```glsl
    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = (light.cutOff - light.outerCutOff);
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);
    diffuse  *= intensity;
    specular *= intensity;
```
:::
:::vulkan
```glsl
    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-ubo.light.direction));
    float epsilon = (ubo.light.cutOff - ubo.light.outerCutOff);
    float intensity = clamp((theta - ubo.light.outerCutOff) / epsilon, 0.0, 1.0);
    diffuse  *= intensity;
    specular *= intensity;
```
:::
:::d3d12
```hlsl
    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = (light.cutOff - light.outerCutOff);
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0f, 1.0f);
    diffuse *= intensity;
    specular *= intensity;
```

Utan förgreningen kör alla pixlar samma kod igen, så texturerna kan samplas precis där de används, som före
strålkastarsteget.
:::

Observera att vi använder funktionen `clamp`, som *begränsar* sitt första argument till intervallet mellan `0.0` och
`1.0`. Det ser till att intensitetsvärdena inte hamnar utanför intervallet [0, 1]. Ambient-komponenten påverkas inte
av intensiteten, så att belysningen alltid har lite ljus – men nu när `else`-grenen är borta multiplicerar learnopengl
alla tre termerna med dämpningen igen, som för punktljuset.

```quiz
Ett fragment ligger 5° från ficklampans riktning. Dess `(theta - outerCutOff) / epsilon` blir ungefär 1.9. Vilken intensitet använder shadern?
- [ ] 1.9 – fragmentet lyses upp nästan dubbelt så starkt som ljusets diffuse-färg
- [x] 1.0 – `clamp` begränsar värdet till [0, 1], så allt inne i den inre konen får fullt ljus
- [ ] 0.0 – värden över 1 betyder att fragmentet ligger utanför konen
---
Inne i den inre konen ger formeln värden över 1, utanför den yttre konen negativa värden. `clamp` gör dem till exakt 1.0 och 0.0, och bara den mjuka zonen mellan 12.5° och 17.5° får värdena däremellan.
```

Se till att lägga till värdet `outerCutOff` i structen `Light` och sätta det i programmet:

:::opengl
```glsl
struct Light {
    vec3 position;
    vec3 direction;
    float cutOff;
    float outerCutOff;
    [...]
};
```

```cpp
        lightingShader.setFloat("light.outerCutOff", glm::cos(glm::radians(17.5f)));
```
:::
:::vulkan
```glsl
struct Light {
    vec3 position;
    vec3 direction;
    float cutOff;
    float outerCutOff;
    [...]
};
```

I std140 är `outerCutOff` en float och hamnar på 32 – början på en ny plats om 16 byte, eftersom `cutOff` fyllde den
förra. Nästa medlem, `ambient`, är en `vec3` och behöver en multipel av 16: 48. C++-structen behöver alltså tre
utfyllnadsfloats efter `outerCutOff`, och ljuset växer till 112 byte:

```cpp
struct Light {
    glm::vec3 position;
    float pad1;
    glm::vec3 direction;
    float cutOff; // fills the 4 bytes after direction
    float outerCutOff;
    float pad6; // ambient (a vec3) starts at the next multiple of 16 bytes
    float pad7;
    float pad8;

    glm::vec3 ambient;
    float pad2;
    glm::vec3 diffuse;
    float pad3;
    glm::vec3 specular;

    float constant; // fills the 4 bytes after specular
    float linear;
    float quadratic;
    float pad4; // the size of a struct in a uniform block is rounded up to a multiple of 16 bytes
    float pad5;
};
```

Utfyllnadsfloatarna behåller namnen de fick när de lades till, så de står inte i ordning – namnen spelar ingen roll,
bara deras placering.

```cpp
        ubo.light.outerCutOff = glm::cos(glm::radians(17.5f));
```
:::
:::d3d12
```hlsl
struct Light
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

`outerCutOff` och de tre termerna fyller rad 2 exakt (32–47), så `ambient` börjar fortfarande på 48 – C++-structen
byter bara ut `padding1` mot `outerCutOff` och förblir 96 byte. (Termerna kommer direkt efter gränsvärdena, som i
learnopengls `SpotLight` i nästa kapitel; i den ordningen börjar varje `float3` en rad och utfyllnaden förblir enkel.)

```cpp
    struct Light
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

```cpp
    constantBufferData.light.outerCutOff = std::cos(XMConvertToRadians(17.5f));
```
:::

Här sätter vi den yttre gränsvinkeln till `17.5` grader, 5 grader utanför den inre konen. Gör nu den sista uppgiften,
**soft-edges**: lägg till `outerCutOff`, ersätt `if`/`else` med intensiteten och dämpa alla tre termerna. När du
bygger och kör den tonar fläckens kant ut mjukt: hörnen på behållare 0, som låg i mörker förut, ligger nu i den mjuka
zonen och är halvt upplysta. Behållarna utanför konen är nästan svarta, eftersom de där nu bara får det *dämpade*
omgivande ljuset.

Ahhh, det där är mycket bättre. Lek med den inre och den yttre gränsvinkeln och försök skapa en strålkastare som
passar dina behov bättre. På din egen dator kan du gå runt med ficklampan och titta på behållarna den träffar.

Den slutliga fragment shadern:

:::opengl
```glsl
void main()
{
    // ambient
    vec3 ambient = light.ambient * texture(material.diffuse, TexCoords).rgb;

    // diffuse
    vec3 norm = normalize(Normal);
    vec3 lightDir = normalize(light.position - FragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = light.diffuse * diff * texture(material.diffuse, TexCoords).rgb;

    // specular
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    vec3 specular = light.specular * spec * texture(material.specular, TexCoords).rgb;

    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = (light.cutOff - light.outerCutOff);
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);
    diffuse  *= intensity;
    specular *= intensity;

    // attenuation
    float distance    = length(light.position - FragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;

    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    // ambient
    vec3 ambient = ubo.light.ambient * texture(diffuseMap, fragTexCoord).rgb;

    // diffuse
    vec3 norm = normalize(fragNormal);
    vec3 lightDir = normalize(ubo.light.position - fragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = ubo.light.diffuse * diff * texture(diffuseMap, fragTexCoord).rgb;

    // specular
    vec3 viewDir = normalize(ubo.viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    vec3 specular = ubo.light.specular * spec * texture(specularMap, fragTexCoord).rgb;

    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-ubo.light.direction));
    float epsilon = (ubo.light.cutOff - ubo.light.outerCutOff);
    float intensity = clamp((theta - ubo.light.outerCutOff) / epsilon, 0.0, 1.0);
    diffuse  *= intensity;
    specular *= intensity;

    // attenuation
    float distance    = length(ubo.light.position - fragPos);
    float attenuation = 1.0 / (ubo.light.constant + ubo.light.linear * distance + ubo.light.quadratic * (distance * distance));
    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;

    vec3 result = ambient + diffuse + specular;
    outColor = vec4(result, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // ambient
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, input.texCoord).rgb;

    // diffuse
    float3 norm = normalize(input.normal);
    float3 lightDir = normalize(light.position - input.fragPos);
    float diff = max(dot(norm, lightDir), 0.0f);
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, input.texCoord).rgb;

    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, input.texCoord).rgb;

    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = (light.cutOff - light.outerCutOff);
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0f, 1.0f);
    diffuse *= intensity;
    specular *= intensity;

    // attenuation (dist: distance is the name of an HLSL function)
    float dist = length(light.position - input.fragPos);
    float attenuation = 1.0f / (light.constantTerm + light.linearTerm * dist + light.quadraticTerm * (dist * dist));
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;

    float3 result = ambient + diffuse + specular;
    return float4(result, 1.0f);
}
```
:::

## Övningar

- Experimentera med alla de olika ljustyperna och deras fragment shaders. Prova att vända på några vektorer och/eller
  använda `<` i stället för `>`. Försök förklara de olika visuella resultaten.

Det här är ingen uppgift i projektet: prova när du är klar med uppgifterna, och använd **Build & run** för att se
resultatet. Med `theta < light.cutOff` i strålkastarsteget vänds till exempel cirkeln ut och in – allt *utanför*
konen lyses upp, och mitten av behållare 0 får bara det omgivande ljuset. Och om du använder
`normalize(light.direction)` utan minustecken blir theta cosinus för vinkeln mot den *motsatta* riktningen, som är
negativ för allt framför kameran: inget fragment hamnar någonsin i konen.

I nästa kapitel sätter vi ihop alla de här ljuskällorna – ett riktat ljus, fyra punktljus och ficklampan – i en och
samma scen.
