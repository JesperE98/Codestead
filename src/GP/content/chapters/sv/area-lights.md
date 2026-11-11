# Ytljus

Alla ljus i kursen hittills har varit punkter, riktningar eller strålkastare: ljus som kommer från en enda punkt
eller från oändligt långt bort. Riktiga ljuskällor har en storlek. Ett fönster, en takpanel, en tv-skärm eller en
neonskylt sänder ljus från en hel yta. Det ändrar två saker som syns. Skuggningen blir mjukare, eftersom en punkt lyses
upp av de delar av ljuset som den kan se. Högdagrarna får ljusets form: på ett blankt golv ger ett punktljus en liten
rund högdager, men en rektangulär lampa ger ett utdraget, rektangulärt sken. Ljus från en yta är en integral över
ytan, och att räkna ut den integralen snabbt är problemet som det här kapitlet löser.

Kapitlet följer learnopengls gästartikel *Area Lights*. Det använder **Linearly Transformed Cosines** (LTC), metoden
av Eric Heitz, Jonathan Dupuy, Stephen Hill och David Neubelt (SIGGRAPH 2016). LTC belyser en yta med ett
polygonformat ljus, inklusive den spekulära delen, med en handfull vektoroperationer och två texturuppslag per ljus.
Programmet lyser upp ett trägolv med ett rektangulärt ljus, först med den diffusa delen och sedan med den blanka
reflexen. Den sista uppgiften ställer upp åtta färgade ljus i en ring. Matematiken i shadern är densamma i alla tre
API:erna; det här kapitlet visar hur {{api}} för över uppslagstabellerna och ljusets hörn till shadern.

## Ljus från en polygon

Det ljus som en punkt på en yta reflekterar mot ögat är en integral över alla riktningar som den tar emot ljus från.
Varje riktning bidrar med det inkommande ljuset gånger BRDF:en gånger cosinus för vinkeln mot normalen. Ett punktljus
täcker exakt en riktning, så integralen krymper till en enda term – ljussättningen i alla tidigare kapitel. Ett
polygonljus täcker ett område av riktningar: integralen går över polygonens rymdvinkel, den yta den täcker på
enhetssfären runt punkten.

För en fördelning finns det ett exakt svar på integralen: den **klampade cosinusen** (`max(cos θ, 0)`, Lamberts
diffusa reflektion). Projicera polygonens hörn på enhetssfären runt punkten. Varje kant bidrar då med den vinkel den
spänner över, i riktningen vinkelrätt mot planet genom kanten och punkten. Summan av kanternas vektorer är polygonens
**vektoriella formfaktor**. Dess komponent längs normalen är integralen av cosinusen över polygonen: det ljus som en
diffus yta tar emot. Resultatet går tillbaka till Lambert på 1700-talet, och det är exakt. Problemet är den spekulära
delen. En blank BRDF som GGX (mikrofacettfördelningen från PBR-kapitlen) är en lob som beror på strävheten och
blickriktningen, och att integrera den över en polygon saknar sluten form. Att sampla den med många strålar per pixel
är för långsamt i realtid.

## Linjärt transformerade cosinusar

Idén bakom LTC: börja med den klampade cosinusfördelningen och transformera dess riktningar med en 3 × 3-matris **M**.
Riktningarna multipliceras med M och normaliseras igen. Resultatet är en ny fördelning på sfären, en *linjärt
transformerad cosinus*. Skalning sträcker ut eller smalnar av loben, skjuvning lutar den, och med rätt M stämmer den
nära överens med GGX-loben för en viss strävhet och blickvinkel. Den avgörande egenskapen är denna: **att integrera
den transformerade fördelningen över en polygon ger samma resultat som att integrera den ursprungliga cosinusen över
polygonen transformerad med M⁻¹**. Varje riktning behåller sin andel av fördelningen när den flyttas. Shadern
integrerar alltså inte GGX alls. Den multiplicerar ljusets hörn med M⁻¹ och integrerar en klampad cosinus över
resultatet, med den exakta kantformeln ovan.

Matriserna anpassades i förväg, en gång, av artikelns författare för ett rutnät på 64 × 64 värden av strävhet och
blickvinkel. För en isotrop BRDF, i ett koordinatsystem där blickriktningen ligger i planet som spänns upp av normalen
och en tangent, är loben symmetrisk kring det planet. Då har M⁻¹ bara fem element som inte är noll, och när det
mittersta normaliseras till 1 återstår fyra tal: de ryms i en RGBA-texel. Det är den första tabellen, **LTC1**. Den
andra tabellen, **LTC2**, innehåller för varje texel BRDF:ens totala storlek, uppdelad i två termer för Fresnelfaktorn
(x och y), och ett värde för klippning vid horisonten (w). Båda indexeras med strävheten och med `sqrt(1 - cos θ)` för
blickvinkeln.

Kursen tar tabellerna från artikelns referensimplementation, repot `ltc_code`. De ligger i
`textures/ltc/ltc_matrix.hpp`, under repots BSD-liknande licens, vars upphovsrättsnotis och artikelreferens står
överst i headerfilen. learnopengl levererar samma tal. Varje projekt kopierar headerfilen oförändrad till platsen
bredvid sin `main.cpp`.

```quiz
Varför kan shadern räkna ut en GGX-liknande reflektion över en polygon utan att integrera GGX?
- [ ] Den ersätter polygonen med en enda punkt i mitten och räknar ut GGX där
- [ ] GPU:ns texturenheter integrerar BRDF:en när de samplar LTC1
- [x] En cosinus som transformeras med en matris M liknar GGX-loben, och att integrera den över polygonen är detsamma som att integrera en vanlig cosinus över polygonen transformerad med M⁻¹ – vilket har en exakt kantformel
- [ ] Den använder Lamberts diffusa integral och skalar den med strävheten
---
Den anpassade M⁻¹ (ur LTC1) flyttar polygonens hörn. Integralen av en klampad cosinus över en polygon är exakt: en summa över kanterna.
```

## Projektet

Startkoden ritar learnopengls scen. Ett golv av två trianglar, 20 × 20 enheter, har trätexturen från kapitlen om
avancerad belysning som sRGB-textur (learnopengl använder en egen betongtextur). Ett ljus, en rektangel på 2 × 2 som
står vid x = −8 och är vänd mot +x, ritas i sin färg, BurlyWood. Kameran står i (0, 1, 0,5) och tittar längs −x mot
ljuset. Golvets shader skriver svart eftersom det inte finns något ljus ännu. **Bygg & kör** (Ctrl+Enter) visar
rektangeln mot svart; kommentarerna `// TODO:` visar var din kod ska in.

Värdena är learnopengls: intensitet 4, strävhet 0,5, en spekulär färg på 0,23 (omräknad till linjär), ett ljus som
lyser åt båda hållen, och en utdata som gammakorrigeras med exponenten 1/2,2. learnopengl ändrar strävheten,
intensiteten, sidorna och ljusets position med tangenter. Kursen sätter dem en gång, så ingenting rör sig.
learnopengls växling mellan en och två sidor börjar med `switchTwoSided(false)`, som inte växlar: dess ljus lyser
alltså också åt båda hållen.

## Tabellerna som texturer

Båda tabellerna blir texturer på 64 × 64 med fyra 32-bitars flyttal per texel. learnopengl skapar dem med det interna
formatet `GL_RGBA`. Det formatet har ingen angiven storlek, så drivrutinen kan lagra 8 bitar per kanal och klampa
varje tal till 0…1. Tabellerna behöver mer än så: elementen i M⁻¹ går långt över 1, och de små skillnaderna mellan
närliggande texlar spelar roll. Kursen använder ett flyttalsformat i alla API:er. Samplern förstorar linjärt och
förminskar till närmaste texel (learnopengls val), och den klampar vid kanterna. Rad 0 i varje tabell är texturens rad
0 (v = 0): tabellerna är inga bilder, så de vänds inte.

:::opengl
`loadMTexture()` och `loadLUTTexture()` (learnopengls namn) skapar en textur var:

```cpp
    // GL_RGBA32F: four 32-bit floats per texel (the numbers are outside 0..1, an 8-bit format would clamp them)
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 64, 64, 0, GL_RGBA, GL_FLOAT, LTC1);
```

med `GL_CLAMP_TO_EDGE` på båda axlarna och

```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```

LTC1 hamnar på texturenhet 0, LTC2 på enhet 1 och golvets textur på enhet 2: `shaderLTC.setInt("LTC1", 0)`,
`setInt("LTC2", 1)` och bindningarna i loopen.
:::
:::vulkan
`createFloatTexture(table, …)` kopierar en tabell via en staging buffer på 64 · 64 · 4 · 4 byte till en bild:

```cpp
        createImage(64, 64, VK_FORMAT_R32G32B32A32_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, image, imageMemory);
```

och `loadMTexture()` / `loadLUTTexture()` (learnopengls namn) anropar den med `LTC1` och `LTC2`. Båda använder samma
sampler, `ltcSampler`:

```cpp
        samplerInfo.magFilter = VK_FILTER_LINEAR;
        samplerInfo.minFilter = VK_FILTER_NEAREST;
```

med `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`. Linjär filtrering av ett 32-bitars flyttalsformat är valfritt i Vulkan,
så `createLTCSampler()` kontrollerar först `VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT`; grafikkort i vanliga
datorer har den. Tabellerna läggs i descriptor setet på bindning 1 och 2, learnopengls texturenheter 0 och 1, och
träet ligger på bindning 3. learnopengl har golvets textur i `struct Material { sampler2D diffuse; … }`, men Vulkan kan
inte ha en sampler i ett uniform-block, så texturen är `diffuseMap` på bindning 3.
:::
:::d3d12
En enda funktion, `LoadLTCTexture`, gör jobbet för learnopengls `loadMTexture` och `loadLUTTexture`, med projektets
hjälpfunktion `CreateTexture`:

```cpp
    CreateTexture(table, 64, 64, DXGI_FORMAT_R32G32B32A32_FLOAT, 64 * 4 * sizeof(float), texture, uploadHeap, descriptorIndex);
```

och `LoadAssets` lägger LTC1 på plats 1 i heapen och LTC2 på plats 2:

```cpp
    LoadLTCTexture(LTC1, m_LTC.mat1, ltcMat1UploadHeap, 1);
    LoadLTCTexture(LTC2, m_LTC.mat2, ltcMat2UploadHeap, 2);
```

Upload-heaparna måste leva tills setup-command listen har körts. Root-signaturens tabell täcker redan t0…t2 i
startkoden, med träet på plats 3 som t2. Tabellerna använder den statiska samplern s0:

```cpp
        samplers[0].Filter = D3D12_FILTER_MIN_POINT_MAG_LINEAR_MIP_POINT;
```

med `D3D12_TEXTURE_ADDRESS_MODE_CLAMP`. Träet använder s1, linjär och upprepande.
:::

Gör nu den första uppgiften, **ltc-textures**. Shadern läser inte tabellerna ännu, så ingenting ändras.

```quiz
Varför lagrar kursen LTC-tabellerna som texturer med 32-bitars flyttal i stället för learnopengls `GL_RGBA` utan storlek?
- [x] Ett 8-bitarsformat klampar varje värde till 0…1 och har bara 256 steg, men tabellerna innehåller matriselement långt över 1 och kräver hög precision
- [ ] Flyttalstexturer går snabbare att sampla än 8-bitars
- [ ] 8-bitarstexturer kan inte förstoras linjärt
- [ ] `GL_RGBA` skulle vända tabellen upp och ned
---
Tabellerna är tal, inte färger. Ett `GL_RGBA` utan storlek låter drivrutinen välja ett normaliserat 8-bitarsformat, som lagrar 0…1 i 256 steg.
```

## Den diffusa delen

Shaderns arbete sker i två funktioner från learnopengl, som i sin tur kommer från artikelns referenskod.
`IntegrateEdgeVec` ger en kants bidrag till den vektoriella formfaktorn: vinkeln θ mellan kantens två riktningar, i
riktningen av deras kryssprodukt. Kryssproduktens längd är sin θ, så funktionen multiplicerar den med θ / sin θ. Den
faktorn räknas ut med en anpassad rationell funktion i stället för `acos`, som är onoggrann nära ±1:

:::opengl
```glsl
    float a = 0.8543985 + (0.4965155 + 0.0145206 * y) * y;
    float b = 3.4175940 + (4.1616724 + y) * y;
    float v = a / b;

    float theta_sintheta = (x > 0.0) ? v : 0.5 * inversesqrt(max(1.0 - x * x, 1e-7)) - v;

    return cross(v1, v2) * theta_sintheta;
```
:::
:::vulkan
```glsl
    float a = 0.8543985 + (0.4965155 + 0.0145206*y)*y;
    float b = 3.4175940 + (4.1616724 + y)*y;
    float v = a / b;

    float theta_sintheta = (x > 0.0) ? v : 0.5*inversesqrt(max(1.0 - x*x, 1e-7)) - v;

    return cross(v1, v2)*theta_sintheta;
```
:::
:::d3d12
```hlsl
    float a = 0.8543985f + (0.4965155f + 0.0145206f * y) * y;
    float b = 3.4175940f + (4.1616724f + y) * y;
    float v = a / b;

    float theta_sintheta = (x > 0.0f) ? v : 0.5f * rsqrt(max(1.0f - x * x, 1e-7f)) - v;

    return cross(v1, v2) * theta_sintheta;
```
:::

Här är `x` lika med `dot(v1, v2)`, vinkelns cosinus, och `y` dess absolutbelopp.

`LTC_Evaluate(N, V, P, Minv, points, twoSided)` integrerar över ljusets polygon. Först bygger den ett
koordinatsystem kring normalen: `T1` är blickriktningen projicerad på ytans plan, och `T2 = cross(N, T1)`. Det är i det
koordinatsystemet som tabellerna anpassades. Sedan tillämpar den M⁻¹ på ljusets hörn, relativt den skuggade punkten:

:::opengl vulkan
```glsl
    // rotate area light in (T1, T2, N) basis
    Minv = Minv * transpose(mat3(T1, T2, N));
```

```glsl
    L[0] = Minv * (points[0] - P);
```

och likadant för de tre andra hörnen.
:::
:::d3d12
```hlsl
    Minv = mul(Minv, float3x3(T1, T2, N));
```

```hlsl
    L[0] = mul(Minv, points[0].xyz - P);
```

och likadant för de tre andra hörnen. GLSL:s `mat3(a, b, c)` tar **kolumner**, HLSL:s `float3x3(a, b, c)` **rader**.
learnopengls `transpose(mat3(T1, T2, N))` blir därför helt enkelt `float3x3(T1, T2, N)`: en matris vars rader är
koordinatsystemets axlar, som för över riktningar i världen till koordinatsystemet. `Minv * v` blir `mul(Minv, v)`, med
en kolumnvektor till höger precis som i GLSL.
:::

De transformerade hörnen normaliseras, vilket projicerar dem på enhetssfären, och de fyra kanterna summeras:

:::opengl vulkan
```glsl
    vsum += IntegrateEdgeVec(L[0], L[1]);
    vsum += IntegrateEdgeVec(L[1], L[2]);
    vsum += IntegrateEdgeVec(L[2], L[3]);
    vsum += IntegrateEdgeVec(L[3], L[0]);
```
:::
:::d3d12
```hlsl
    vsum += IntegrateEdgeVec(L[0], L[1]);
    vsum += IntegrateEdgeVec(L[1], L[2]);
    vsum += IntegrateEdgeVec(L[2], L[3]);
    vsum += IntegrateEdgeVec(L[3], L[0]);
```
:::

`vsum` är den vektoriella formfaktorn. Om polygonen ligger helt ovanför ytan är dess z-komponent (längs normalen)
svaret. En polygon som sticker ned under horisonten skulle först behöva klippas, och det är dyrt i en shader. I stället
behandlar koden ljuset som en sfär med samma vektoriella formfaktor. Dess längd `len` och höjdvinkel `z` bestämmer
sfären, och värdet för den horisontklippta sfären finns tabellerat i `LTC2.w`. Uppslagskoordinaterna är
`(z * 0.5 + 0.5, len)`, och resultatet är `len * scale`. Koden kontrollerar också på vilken sida av ljusets plan som
punkten ligger. Ljusets normal kommer från hörnens ordning, och ett ljus med en sida ger 0 på ena sidan. Alla ljus i
programmet lyser åt båda hållen.

Uppslagen använder `LUT_SCALE = (64 − 1) / 64` och `LUT_BIAS = 0.5 / 64`. De avbildar 0…1 på mitten av den första och
den sista texeln, så att ändpunkterna för varje parameters intervall hamnar exakt på tabellens första och sista värde.

Den diffusa delen behöver ingen tabell för M⁻¹: Lamberts reflektion *är* den klampade cosinusen, så M⁻¹ är
enhetsmatrisen.

:::opengl
```glsl
    vec3 diffuse = LTC_Evaluate(N, V, P, mat3(1), areaLight.points, areaLight.twoSided);

    result = areaLight.color * areaLight.intensity * (mDiffuse * diffuse);
```
:::
:::vulkan
```glsl
    vec3 diffuse = LTC_Evaluate(N, V, P, mat3(1), points, ubo.areaLight.twoSided);

    result = ubo.areaLight.color * ubo.areaLight.intensity * (mDiffuse * diffuse);
```

`points` är en `vec3 points[4]` som kopieras från `ubo.areaLight.points[k].xyz`: uniform-blocket lagrar hörnen som
`vec4`, vilket förklaras nedan.
:::
:::d3d12
```hlsl
    float3x3 identity = float3x3(1.0f, 0.0f, 0.0f, 0.0f, 1.0f, 0.0f, 0.0f, 0.0f, 1.0f);
```

```hlsl
    float3 diffuse = LTC_Evaluate(N, V, P, identity, areaLight.points, areaLight.twoSided);

    result = areaLight.color * areaLight.intensity * (mDiffuse * diffuse);
```
:::

`mDiffuse` är träets färg. Texturen är sRGB, så samplingen ger redan linjära värden. Shadern räknar om resultatet till
sRGB med `ToSRGB` innan den skriver det.

Gör nu den andra uppgiften, **diffuse**. Bygg och kör: golvet lyser upp i ljusets varma färg. Det är ljusast precis
framför ljuset och bleknar mot kameran, och träets brädor syns.

```quiz
`LTC_Evaluate` anropas med enhetsmatrisen för den diffusa delen. Varför ger det Lamberts diffusa ljus?
- [ ] Enhetsmatrisen gör om polygonen till ett punktljus i dess mitt
- [ ] Det gör det inte: enhetsmatrisen ger den spekulära delen vid strävhet 0
- [ ] Tabellen LTC2 gör om resultatet till diffust ljus
- [x] Med M⁻¹ = I lämnas polygonen som den är, och dess integral över den klampade cosinusen – som är precis Lamberts reflektion – räknas ut med kantformeln
---
LTC är en cosinus som transformerats med M. Utan transformation är den cosinusen själv: den diffusa loben.
```

## Den spekulära delen

För den blanka delen slår shadern upp M⁻¹ i LTC1. Koordinaterna är strävheten (ur `material.albedoRoughness.w`) och
`sqrt(1 − dot(N, V))`, och de fyra tal den läser blir en 3 × 3-matris:

:::opengl vulkan
```glsl
    mat3 Minv = mat3(
        vec3(t1.x, 0, t1.y),
```

med `vec3(0, 1, 0)` som andra kolumn och `vec3(t1.z, 0, t1.w)` som tredje.
:::
:::d3d12
```hlsl
    float3x3 Minv = float3x3(
        float3(t1.x, 0.0f, t1.z),
        float3(0.0f, 1.0f, 0.0f),
        float3(t1.y, 0.0f, t1.w)
    );
```

Det är samma tal som i learnopengls `mat3(vec3(t1.x, 0, t1.y), …)`, skrivna som rader i stället för kolumner, så `t1.y`
och `t1.z` byter plats.
:::

`LTC_Evaluate` med den här matrisen ger polygonens integral över den transformerade cosinusen. Anpassningen
normaliserar loben så att integralen blir 1, så det spekulära resultatet skalas sedan med BRDF:ens verkliga storlek,
inklusive Fresnel (Schlicks approximation uppdelad i två tabellerade termer):

:::opengl
```glsl
    specular *= mSpecular * t2.x + (1.0f - mSpecular) * t2.y;
```
:::
:::vulkan
```glsl
    specular *= mSpecular*t2.x + (1.0f - mSpecular) * t2.y;
```
:::
:::d3d12
```hlsl
    specular *= mSpecular * t2.x + (1.0f - mSpecular) * t2.y;
```
:::

där `t2` är LTC2-texeln vid samma koordinater och `mSpecular` är den spekulära färgen vid vinkelrätt infall, F0.
Resultatet är `color * intensity * (specular + mDiffuse * diffuse)`.

Gör nu den tredje uppgiften, **specular**. Bygg och kör: en mjuk, utdragen reflex av ljuset syns på golvet mellan
ljuset och kameran. Den är suddig och vitaktig vid strävhet 0,5, och dess form följer rektangeln. Den effekten kan ett
punktljus inte ge.

```quiz
Vilka två värden väljer den texel i LTC1 och LTC2 som den spekulära delen använder?
- [ ] Ljusets intensitet och dess avstånd till punkten
- [x] Ytans strävhet och blickvinkeln (som `sqrt(1 − cos θ)`)
- [ ] Golvets texturkoordinater
- [ ] Ljusets färg och den spekulära färgen
---
Den anpassade loben beror bara på hur sträv ytan är och hur flackt den ses. Ljusets position kommer in senare, genom hörnen som M⁻¹ transformerar.
```

## Flera ljus

learnopengls andra program fyller scenen med ljus. Varje ljus är en struct med en förskjutning, en rotation kring y,
en färg, intensiteten 2 och en flagga för två sidor. Dess modellmatris, `translate(offset) * rotate(yRotation, y)`,
flyttar samma grundrektangel på plats: dess fyra hörn, multiplicerade med matrisen, är det ljusets polygon. Shadern får
en array med ljus och antalet ljus, och summerar varje ljus diffusa och spekulära del. Uppslagen `uv`, `t1`, `t2` och
`Minv` ligger kvar utanför loopen, eftersom de inte beror på ljuset. Varje rektangel ritas i sin egen färg.

learnopengl placerar 16 ljus slumpmässigt, med tiden som frö. Kursen använder en fast tabell med **8 ljus**, så att
varje körning och varje API visar samma bild. Förskjutningen är 0, rotationen 45° · i, och varje färg är vald för att
vara lätt att skilja från de andra. När rektangeln vid x = −8 roteras kring y-axeln hamnar ljusen på en ring med radien
8, alla vända mot mitten. Kameran flyttas till learnopengls vy av scenen med flera ljus, (−0,22, 10,4, −18,9), med yaw
89,4 och pitch −34,3: ovanför och bakom ringen, med blicken nedåt.

:::opengl
learnopengls shader byter namn på structen till `AreaLight` och deklarerar en array med 32, varav programmet använder
8:

```glsl
uniform AreaLight areaLights[32];
uniform int numAreaLights;
```

I C++ räknas varje ljus hörn ut en gång och sätts via namn:

```cpp
        std::string str_pos = "areaLights[" + std::to_string(i) + "].points";
```

```cpp
        shaderLTC.setVec3(str_pos + "[0]", p0);
```

och likadant för färgen, intensiteten och `twoSided`. Varje medlem i varje arrayelement är en egen uniform, med en egen
location. Därför behöver OpenGL ingen eftertanke kring minneslayout här.
:::
:::vulkan
Ljusen ligger i uniform-blocket, och std140 har regler för hur de läggs ut. learnopengls struct

```glsl
struct Light {
    float intensity;
    vec3 color;
    vec4 points[4];
    bool twoSided;
};
```

läggs ut så här i std140. `intensity` ligger på offset 0. En `vec3` justeras som en `vec4`, så `color` börjar på 16.
Varje element i en array börjar på en gräns på 16 byte, så hörnen skulle ta 16 byte vardera även som `vec3`, och
shadern deklarerar dem som `vec4` (`.xyz` används). En `bool` tar 4 byte. Hela structen avrundas uppåt till en multipel
av 16, vilket ger 112 byte. Motsvarigheten i C++ skriver ut utfyllnaden:

```cpp
struct Light {
    float intensity;
    float pad1[3];
    glm::vec3 color;
    float pad2;
    glm::vec4 points[4];
    VkBool32 twoSided;
    float pad3[3];
};
```

Blocket får `Light areaLights[32]; int numAreaLights;`. Shadern behåller structnamnet `Light`, eftersom `AreaLight` är
C++-tabellen som placerar ljusen. `updateUniformBuffer()` räknar ut hörnen varje bildruta, eftersom buffern ändå skrivs
om varje bildruta:

```cpp
            ubo.areaLights[i].points[0] = model * glm::vec4(vertices[6].pos, 1.0f);
```

`recordCommandBuffer()` ritar de åtta rektanglarna, med var och ens modellmatris och färg som push constants.
:::
:::d3d12
Ljusen ligger i constant buffern, och HLSL har sina egna packningsregler. I learnopengls struct

```hlsl
struct Light
{
    float intensity;
    float3 color;
    float4 points[4];
    bool twoSided;
};
```

delar `intensity` och `color` på en rad om 16 byte: en `float3` får följa efter en `float` så länge den inte korsar en
radgräns. Varje element i en cbuffer-array börjar på en ny rad, så hörnen tar 16 byte vardera, och de är `float4`
(`.xyz` används). En `bool` tar 4 byte. En struct i en cbuffer-array fyller hela rader, så motsvarigheten i C++ fylls ut
till 96 byte:

```cpp
    struct Light
    {
        float intensity;
        XMFLOAT3 color;
        XMFLOAT4 points[4];
        BOOL twoSided;
        float padding[3];
    };
```

Constant buffern får `int numAreaLights` direkt efter `viewPosition`, där den fyller radens sista 4 byte, och
`Light areaLights[32]` på slutet. Shadern behåller structnamnet `Light`, eftersom `AreaLight` är C++-tabellen som
placerar ljusen. `OnUpdate` räknar ut hörnen varje bildruta. Modellmatrisen följer DirectXMaths ordning för
radvektorer, med rotationen först:

```cpp
        XMMATRIX model = XMMatrixRotationY(areaLights[i].yRotation) * XMMatrixTranslation(areaLights[i].offset.x, areaLights[i].offset.y, areaLights[i].offset.z);
```

`PopulateCommandList` ritar de åtta rektanglarna, med var och ens modellmatris och färg som root-konstanter.
:::

:::opengl
```quiz
Shadern deklarerar `uniform AreaLight areaLights[32]`, men programmet sätter bara 8 ljus. Vad händer med de andra 24?
- [x] Ingenting: de behåller sina standardvärden (noll), och loopen slutar vid `numAreaLights`, så de läses aldrig
- [ ] Drivrutinen misslyckas med att länka programmet, eftersom 24 uniforms aldrig sätts
- [ ] De upprepar de första 8 ljusen
- [ ] Vart och ett av dem lägger till ett svart ljus som ändå kostar en hel `LTC_Evaluate`
---
Uniforms som aldrig sätts förblir noll. Det är bara loopens gräns som avgör hur många ljus som räknas ut, så arrayens storlek är bara ett maximum.
```
:::
:::vulkan
```quiz
På vilken byte-offset börjar `color` i std140-layouten av `struct Light { float intensity; vec3 color; vec4 points[4]; bool twoSided; }`?
- [x] 16: en `vec3` justeras till 16 byte, så 12 byte utfyllnad följer efter `intensity`
- [ ] 4: direkt efter `intensity`
- [ ] 8: en `vec3` justeras till 8 byte
- [ ] 12: tre flyttal efter början
---
Därför har C++-structen `float pad1[3]` efter `intensity`. HLSL:s cbuffer-packning skulle lägga `color` på 4, på samma rad som `intensity`.
```
:::
:::d3d12
```quiz
På vilken byte-offset börjar `color` i en cbuffers layout av `struct Light { float intensity; float3 color; float4 points[4]; bool twoSided; }`?
- [x] 4: en `float3` får dela raden om 16 byte med `intensity`, eftersom den inte korsar radens slut
- [ ] 16: en `float3` börjar alltid på en ny rad
- [ ] 8: en `float3` justeras till 8 byte
- [ ] 12: tre flyttal efter början
---
Därför har C++-structen `XMFLOAT3 color` direkt efter `float intensity`. GLSL:s std140 skulle i stället lägga `color` på 16.
```
:::

Gör nu den sista uppgiften, **multiple-lights**. Bygg och kör: en ring av åtta färgade ljus står på golvet. Varje ljus
färgar brädorna framför sig, och deras blanka reflexer sträcker sig mot kameran.

```quiz
Varför ligger `uv`, `t1`, `t2` och `Minv` kvar utanför loopen över ljusen?
- [ ] För att GLSL och HLSL inte tillåter texturuppslag i loopar
- [x] De beror bara på ytpunkten – dess strävhet och blickvinkeln – och inte på ljuset, så ett uppslag räcker för alla ljus
- [ ] Varje ljus behöver egna LTC-tabeller, som binds efter loopen
- [ ] För att göra ljusen starkare: uppslag utanför loopen filtreras inte
---
Per ljus är det bara polygonen som ändras: `LTC_Evaluate` körs två gånger per ljus med samma två matriser.
```

## Vidare

- **Texturerade ljus.** En tv-skärm eller ett färgat glasfönster har inte en enda färg. LTC-artikeln visar hur man
  lyser med en textur på polygonen: den slår upp en förfiltrerad version av texturen i riktningen `vsum`, mer suddig
  för strävare ytor.
- **Andra former.** LTC fungerar med vilken polygon som helst, så trianglar eller fler hörn ger bara fler kanter. En
  senare artikel utvidgar LTC till skivor och linjer (rörljus).
- **Skuggor.** LTC har ingen synlighetsterm: golvet här kan inte skuggas, och ett föremål mellan ett ljus och en yta
  skulle inte skymma det. Mjuka skuggor från ytljus kräver andra tekniker, till exempel mjuka skuggkartor eller
  strålspårning.
- **Spelmotorer.** LTC har blivit ett vanligt sätt att rendera ytljus i realtidsmotorer.

## Fler resurser

- [Area Lights](https://learnopengl.com/Guest-Articles/2022/Area-Lights): learnopengls gästartikel, som det här
  kapitlet följer.
- [area_lights.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2022/7.area_lights/1.area_light/area_lights.cpp)
  och [multiple_area_lights.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/8.guest/2022/7.area_lights/2.multiple_area_lights/multiple_area_lights.cpp):
  learnopengls två program.

:::opengl
- [Uniform (GLSL)](https://www.khronos.org/opengl/wiki/Uniform_(GLSL)): uniforms i structar och arrayer och deras
  namn.
- [glTexImage2D](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2D.xhtml): interna format med och
  utan angiven storlek.
:::
:::vulkan
- [Shader memory layout](https://docs.vulkan.org/guide/latest/shader_memory_layout.html): std140, std430 och
  justeringsreglerna.
- [Formats](https://docs.vulkan.org/spec/latest/chapters/formats.html): vilka formategenskaper, till exempel linjär
  filtrering, ett format garanterar.
:::
:::d3d12
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  hur HLSL lägger ut en cbuffer.
- [Matrix ordering](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-per-component-math#matrix-ordering):
  rader, kolumner och `mul`.
:::
