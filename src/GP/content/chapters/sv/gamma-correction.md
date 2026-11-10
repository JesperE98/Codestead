# Gammakorrigering

Så fort vi har beräknat scenens slutliga pixelfärger måste vi visa dem på en bildskärm. Förr i den digitala bildens
barndom var de flesta bildskärmar katodstrålerör (CRT). De hade den fysiska egenskapen att dubbla inspänningen inte gav
dubbla ljusstyrkan. En dubblad inspänning gav en ljusstyrka enligt ett exponentiellt samband med ungefär exponenten 2.2,
bildskärmens så kallade *gamma*. Det råkar (av en slump) också stämma ganska väl med hur människor uppfattar ljusstyrka,
eftersom vi också upplever ljusstyrka enligt ett liknande (omvänt) potenssamband.

Föreställ dig två rader med gråtoner från svart till vitt. I den första lägger varje steg till lika mycket till värdet vi
skickar till bildskärmen: 0.0, 0.1, 0.2 … 1.0. För det mänskliga ögat ser den raden ut som en jämn skala: våra ögon är
känsligare för förändringar i mörka toner än i ljusa, och bildskärmens kurva råkar kompensera för det. I den andra raden
lägger varje steg till lika mycket *fysiskt* ljus – dubbla värdet betyder dubbelt så många fotoner. Den raden ser fel ut
för oss: den verkar rusa genom de mörka tonerna och krypa genom de ljusa. Ändå är det den andra raden som är fysikaliskt
korrekt. Eftersom färger alltid har valts genom att titta på vad bildskärmen visar, ligger värdena vi arbetar med i ett
icke-linjärt rum: dubblar du värdet på en färg får du inte dubbelt så mycket ljus.

Problemet är att alla våra belysningsberäkningar görs i ett linjärt rum: att dubbla ett ljus intensitet, att addera
bidragen från två ljus eller att skala en färg med `diff` förutsätter allt att resultatet visas som det beräknades. På
bildskärmen blir dock värdet 0.5 – hälften så ljust, enligt vår matematik – 0.5 upphöjt till 2.2 ≈ 0.218 av full
ljusstyrka. Mörka och mellanljusa färger blir för mörka, och ju mer en färg beror på belysningsmatematik, desto mer fel
ser den ut. All belysning i de tidigare kapitlen var alltså fysikaliskt felaktig – och vi justerade värden som
dämpningskonstanterna på känn för att det ändå skulle se godtagbart ut.

```quiz
Fragment shadern skriver värdet 0.5 för en pixel och bildskärmen har gamma 2.2. Hur ljus ser pixeln ut, jämfört med vitt?
- [ ] 0.5 – bildskärmen visar det den får
- [ ] 0.73
- [x] Ungefär 0.218: bildskärmen upphöjer värdet till 2.2
- [ ] 0.25 – bildskärmen kvadrerar värdet
---
0.5 upphöjt till 2.2 ≈ 0.218. För att synas med halv ljusstyrka skulle pixeln behöva värdet 0.5^(1/2.2) ≈ 0.73 – och det är precis vad gammakorrigering räknar ut.
```

## Gammakorrigering

Idén med gammakorrigering är att tillämpa inversen av bildskärmens gamma på den slutliga färgen innan den visas på
bildskärmen. Tittar vi tillbaka på gammakurvan ser vi att bildskärmen mörkar våra färger med potensen 2.2; om vi först gör
dem ljusare med den inversa potensen, 1/2.2, tar de två ut varandra och ljuset når vårt öga lika linjärt som vi beräknade
det.

Ett exempel till. Säg att vi återigen har den mörkröda färgen (0.5, 0.0, 0.0). Innan färgen visas på bildskärmen
tillämpar vi först gammakorrigeringskurvan på färgvärdet. Linjära färger som visas av en bildskärm skalas ungefär med
potensen 2.2, så inversen kräver att färgerna skalas med potensen 1/2.2. Den gammakorrigerade mörkröda färgen blir alltså
(0.5, 0.0, 0.0)^(1/2.2) = (0.73, 0.0, 0.0). De korrigerade färgerna skickas sedan till bildskärmen, och färgen visas som
(0.73)^2.2 = (0.5, 0.0, 0.0). Med gammakorrigering visar bildskärmen alltså äntligen färgerna så som vi linjärt satte dem
i programmet.

Gammavärdet 2.2 är ett standardvärde som ungefär motsvarar genomsnittet för de flesta skärmar. Färgrymden som blir
resultatet av detta gamma på 2.2 kallas **sRGB**-färgrymden (inte 100 % exakt, men nära). Varje bildskärm har sin egen
gammakurva, men gammavärdet 2.2 ger bra resultat på de flesta. Därför låter spel ofta spelaren ändra spelets
gammainställning, eftersom den varierar något mellan bildskärmar.

:::opengl
Projektet är learnopengls scen: förra kapitlets trägolv (20 × 20 enheter på y = -0.5, `wood.png` upprepad tio gånger)
belyst av fyra punktljus på (-3, 0, 0), (-1, 0, 0), (1, 0, 0) och (3, 0, 0), vars färger går från svagt grått till vitt:
0.25, 0.50, 0.75 och 1.00. `gamma_correction.fs` beräknar ljuset från vart och ett i en funktion `BlinnPhong()` – diffust
och Blinn-Phong-spekulärt (exponent 64), gånger ljusets färg, försvagat med avståndet; inget ambient – och multiplicerar
golvets färg med summan. Kameran står på (0, 0, 3) som tidigare.
:::
:::vulkan
Projektet är learnopengls scen: förra kapitlets trägolv (20 × 20 enheter på y = -0.5, `textures/wood.png` upprepad tio
gånger) belyst av fyra punktljus på (-3, 0, 0), (-1, 0, 0), (1, 0, 0) och (3, 0, 0), vars färger går från svagt grått
till vitt: 0.25, 0.50, 0.75 och 1.00. `shaders/gamma_correction.frag` beräknar ljuset från vart och ett i en funktion
`BlinnPhong()` – diffust och Blinn-Phong-spekulärt (exponent 64), gånger ljusets färg, försvagat med avståndet; inget
ambient – och multiplicerar golvets färg med summan. Kameran står på (0, 0, 3) som tidigare.
:::
:::d3d12
Projektet är learnopengls scen: förra kapitlets trägolv (20 × 20 enheter på y = -0.5, `wood.png` upprepad tio gånger)
belyst av fyra punktljus på (-3, 0, 0), (-1, 0, 0), (1, 0, 0) och (3, 0, 0), vars färger går från svagt grått till vitt:
0.25, 0.50, 0.75 och 1.00. `gamma_correction.hlsl` beräknar ljuset från vart och ett i en funktion `BlinnPhong()` –
diffust och Blinn-Phong-spekulärt (exponent 64), gånger ljusets färg, försvagat med avståndet; inget ambient – och
`PSMain` multiplicerar golvets färg med summan. (Avståndet heter `lightDistance`: `distance` är en inbyggd funktion i
HLSL.) Kameran står på (0, 0, 3) som tidigare.
:::

learnopengl slår om allt som det här kapitlet ändrar med en enda flagga `gamma` (mellanslagstangenten). Här är varje
steg en egen uppgift, så att du ser vad vart och ett gör. Just nu finns ingen gammakorrigering alls. Tryck på **Build &
run** (Ctrl+Enter): ett mörkt golv med fyra ljuspölar, de högra ljusare och starkt mättade – rakt under det tredje ljuset
är den röda kanalen redan på sitt maximum. Kommentarerna `// TODO:` i projektet visar var din kod ska in.

### Fyra ljus i {{api}}

:::opengl
Ljusens positioner och färger är två arrayer av `vec3`-uniforms:

```glsl
uniform vec3 lightPositions[4];
uniform vec3 lightColors[4];
```

Programmet sätter alla fyra elementen i var och en med ett enda anrop:

```cpp
        glUniform3fv(glGetUniformLocation(shader.ID, "lightPositions"), 4, &lightPositions[0][0]);
        glUniform3fv(glGetUniformLocation(shader.ID, "lightColors"), 4, &lightColors[0][0]);
```

Platsen för arrayens första element, antalet 4 och en pekare till 4 × 3 floats i följd: `glm::vec3` innehåller exakt tre
floats, så C++-arrayen `glm::vec3 lightPositions[4]` är just det. Uniforms utanför ett block har ingen minneslayout som du
behöver matcha – OpenGL kopierar värdena dit drivrutinen har dem.
:::
:::vulkan
I Vulkan ligger ljusen i uniform buffern, och där spelar layouten roll. learnopengls `uniform vec3 lightPositions[4]` kan
inte kopieras som en C++-`glm::vec3[4]`: i ett std140-block börjar varje element i en array på en multipel av 16 byte, så
en `vec3`-array har ett steg (stride) på 16 byte, medan `glm::vec3` är 12 byte. Båda sidor använder därför `vec4` (w
används inte, shadern läser `.xyz`):

```glsl
// std140: the elements of an array are 16 bytes apart, so the positions and colours are vec4s (only xyz is used)
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec4 lightPositions[4];
    vec4 lightColors[4];
    vec3 viewPos;
} ubo;
```

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec4 lightPositions[4];
    glm::vec4 lightColors[4];
    glm::vec3 viewPos;
    float pad1;
};
```

`updateUniformBuffer()` fyller dem en i taget, från `ubo.lightPositions[0] = glm::vec4(-3.0f, 0.0f, 0.0f, 0.0f);` till
`ubo.lightColors[3] = glm::vec4(1.00f, 1.00f, 1.00f, 0.0f);`, och shadern anropar
`BlinnPhong(…, ubo.lightPositions[i].xyz, ubo.lightColors[i].xyz)`.
:::
:::d3d12
I Direct3D 12 ligger ljusen i constant buffern, och där spelar layouten roll. HLSL börjar varje element i en
cbuffer-array på en ny rad på 16 byte, så en array av `float3` skulle lämna 4 byte utfyllnad efter varje element. Kursen
använder `float4` (w används inte) på båda sidor, så att C++-structen och HLSL-layouten uppenbart är likadana:

```hlsl
cbuffer SceneConstantBuffer : register(b0)
{
    float4x4 view;
    float4x4 projection;
    float4 lightPositions[4];
    float4 lightColors[4];
    float3 viewPos;
};
```

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT4 lightPositions[4];
        XMFLOAT4 lightColors[4];
        XMFLOAT3 viewPos;
        float padding0;
    };
```

De globala `XMFLOAT4 lightPositions[]` och `lightColors[]` kopieras in i den i `OnUpdate` med en `for`-loop, och shadern
anropar `BlinnPhong(…, lightPositions[i].xyz, lightColors[i].rgb)`.
:::

:::opengl
```quiz
Vad gör `glUniform3fv(glGetUniformLocation(shader.ID, "lightPositions"), 4, &lightPositions[0][0])`?
- [x] Det sätter alla fyra elementen i uniformarrayen `lightPositions[4]` från 12 floats i följd – C++-arrayen med fyra `glm::vec3`
- [ ] Det sätter uniformen `lightPositions` till C++-arrayens fjärde element
- [ ] Det sätter det första elementet fyra gånger
- [ ] Det sätter en `vec3` och fyller ut den till 4 floats
---
`v`-funktionerna tar ett antal: för en array-uniform sätter platsen för element 0 och antalet 4 elementen 0 till 3. `glm::vec3` innehåller exakt tre floats, så `&lightPositions[0][0]` pekar på 12 floats i följd.
```
:::
:::vulkan
```quiz
Varför använder uniformblocket och C++-structen `vec4 lightPositions[4]` i stället för learnopengls `vec3`-array?
- [ ] GLSL har inga arrayer av `vec3`
- [ ] W-komponenten innehåller ljusets intensitet
- [ ] Vulkans uniform buffers kan bara innehålla `vec4` och `mat4`
- [x] I std140 börjar varje arrayelement på en multipel av 16 byte; en C++-`glm::vec3[4]` är packad i steg om 12 byte, så den skulle inte stämma – med `vec4` använder båda sidor 16
---
En `vec3`-array i ett std140-block har ett steg på 16 byte. Skrev man `glm::vec3`-element skulle det andra ljuset hamna på byte 12 i stället för 16. Med `vec4` blir layouterna identiska; shadern läser bara `.xyz`.
```
:::
:::d3d12
```quiz
Varför är ljusen arrayer av `XMFLOAT4` / `float4` i constant buffern, och inte `float3` som learnopengls `vec3`?
- [ ] HLSL har inga arrayer av `float3`
- [ ] W-komponenten innehåller ljusets intensitet
- [x] Varje element i en cbuffer-array börjar på en ny rad på 16 byte; med `float4` är C++-structen och HLSL-layouten uppenbart likadana
- [ ] Constant buffers måste vara en multipel av 256 byte
---
Ett `float3`-element i en array skulle följas av 4 byte utfyllnad i HLSL men inte i en C++-array av `XMFLOAT3`. 256-byteregeln gäller storleken på hela constant buffer-vyn, inte dess medlemmar.
```
:::

Det finns två sätt att tillämpa gammakorrigering på scenen: att låta {{api}} göra det i hårdvaran när färgen skrivs, eller
att göra det själv i fragment shadern.

:::opengl
Det första sättet är förmodligen det enklaste, men ger dig också mindre kontroll. Genom att slå på `GL_FRAMEBUFFER_SRGB`
säger du åt OpenGL att varje efterföljande ritkommando först ska gammakorrigera färgerna (från linjär till sRGB-färgrymd)
innan de lagras i färgbuffern/färgbuffrarna. sRGB-färgrymden motsvarar ungefär ett gamma på 2.2 och är en standard för de
flesta enheter. När `GL_FRAMEBUFFER_SRGB` är påslaget gör OpenGL automatiskt gammakorrigering efter varje körning av
fragment shadern för alla efterföljande framebuffers, även standardframebuffern:

```cpp
glEnable(GL_FRAMEBUFFER_SRGB);
```

Från och med nu blir dina renderade bilder gammakorrigerade, och eftersom hårdvaran gör det kostar det ingenting. Något
du ska komma ihåg med det här sättet (och med det andra) är att gammakorrigering (också) omvandlar färgerna från linjärt
till icke-linjärt rum, så det är mycket viktigt att du gör gammakorrigeringen först i det allra sista steget. Om du
gammakorrigerar färgerna före den slutliga utdatan arbetar alla efterföljande operationer på felaktiga värden. Använder
du till exempel flera framebuffers vill du förmodligen att mellanresultaten som skickas mellan dem stannar i linjärt rum,
och att bara den sista framebuffern gammakorrigerar innan bilden skickas till bildskärmen.
:::
:::vulkan
Det första sättet är förmodligen det enklaste, men ger dig också mindre kontroll. I Vulkan kodar hårdvaran när ett
attachment har ett `_SRGB`-format: varje färg som skrivs till det omvandlas från linjär till sRGB (ungefär potensen
1/2.2). vulkan-tutorials `chooseSwapSurfaceFormat()` väljer `VK_FORMAT_B8G8R8A8_SRGB` med
`VK_COLOR_SPACE_SRGB_NONLINEAR_KHR` – så i vulkan-tutorial blir varje bild gammakorrigerad gratis, utan att författaren
säger så mycket om det. Kursens projekt väljer i stället `VK_FORMAT_B8G8R8A8_UNORM`:

```cpp
    VkSurfaceFormatKHR chooseSwapSurfaceFormat(const std::vector<VkSurfaceFormatKHR>& availableFormats) {
        // A UNORM format shows the colours we write unchanged (like OpenGL's default framebuffer): the fragment shader
        // does the gamma correction itself. (An _SRGB format, like vulkan-tutorial's VK_FORMAT_B8G8R8A8_SRGB, would
        // encode every colour written to it with the sRGB curve - the hardware's gamma correction.)
        for (const auto& availableFormat : availableFormats) {
            if (availableFormat.format == VK_FORMAT_B8G8R8A8_UNORM && availableFormat.colorSpace == VK_COLOR_SPACE_SRGB_NONLINEAR_KHR) {
                return availableFormat;
            }
        }

        return availableFormats[0];
    }
```

Med UNORM når färgerna vi skriver fönstret oförändrade, som i OpenGL:s standardframebuffer – därför spelar alla tidigare
kapitels färger roll här: de stämmer med OpenGL:s, pixel för pixel. Och därför gör det här kapitlet korrigeringen i
shadern, på learnopengls sätt. Vilket sätt du än väljer, kom ihåg att gammakorrigering omvandlar färgerna från linjärt
till icke-linjärt rum, så den ska ske exakt en gång, i det allra sista steget. Använder du flera pass (offscreen-bilder
för post-processing, till exempel) ska mellanresultaten stanna i linjärt rum, och bara det sista passet ska koda.
:::
:::d3d12
Det första sättet är förmodligen det enklaste, men ger dig också mindre kontroll. I Direct3D kodar hårdvaran när render
target-vyn har ett `_SRGB`-format: varje färg som skrivs genom den omvandlas från linjär till sRGB (ungefär potensen
1/2.2). Swap chainen med flip-modellen (`DXGI_SWAP_EFFECT_FLIP_DISCARD`) kan inte skapas med ett `_SRGB`-format, men dess
buffrar i `DXGI_FORMAT_R8G8B8A8_UNORM` får ha en sRGB-vy: en `D3D12_RENDER_TARGET_VIEW_DESC` med
`Format = DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` och `ViewDimension = D3D12_RTV_DIMENSION_TEXTURE2D`, som skickas till
`CreateRenderTargetView` i stället för `nullptr`. Pipeline statens `RTVFormats[0]` måste då också vara `_SRGB`-formatet.

Kursens projekt använder den vanliga UNORM-vyn överallt, så färgerna vi skriver når fönstret oförändrade, som i OpenGL:s
standardframebuffer – och det här kapitlet gör korrigeringen i shadern, på learnopengls sätt. Vilket sätt du än väljer,
kom ihåg att gammakorrigering omvandlar färgerna från linjärt till icke-linjärt rum, så den ska ske exakt en gång, i det
allra sista steget. Använder du flera pass (render targets för post-processing, till exempel) ska mellanresultaten stanna
i linjärt rum, och bara det sista passet ska koda.
:::

Det andra sättet kräver lite mer arbete, men ger oss också full kontroll över gammaoperationerna. Vi tillämpar
gammakorrigering i slutet av varje relevant körning av fragment shadern, så att de slutliga färgerna är gammakorrigerade
innan de skickas till bildskärmen.

:::opengl
```quiz
Du slår på `GL_FRAMEBUFFER_SRGB` och behåller shaderns `pow(color, vec3(1.0/2.2))`. Vad händer?
- [ ] Ingenting: OpenGL märker shaderns korrigering och hoppar över sin egen
- [ ] De två tar ut varandra, och bilden visar linjära färger
- [x] Färgerna gammakorrigeras två gånger och ser för ljusa och urblekta ut – använd ett av sätten, inte båda
- [ ] Programmet går inte att länka
---
`GL_FRAMEBUFFER_SRGB` kodar varje färg som skrivs till en sRGB-kapabel framebuffer. En shader som redan kodar skulle få sin utdata kodad en gång till.
```
:::
:::vulkan
```quiz
vulkan-tutorial skapar sin swap chain med `VK_FORMAT_B8G8R8A8_SRGB`. Vad skulle hända om kursen gjorde det och behöll shaderns `pow(color, vec3(1.0 / 2.2))`?
- [ ] Ingenting: drivrutinen hoppar över shaderns korrigering
- [ ] De två tar ut varandra, och fönstret visar linjära färger
- [ ] Swap chainen kan inte skapas med ett `_SRGB`-format
- [x] Färgerna skulle gammakorrigeras två gånger – en gång i shadern, en gång av hårdvaran när de skrivs – och se urblekta ut
---
Ett `_SRGB`-attachment kodar varje färg som skrivs till det. Därför använder kursen `VK_FORMAT_B8G8R8A8_UNORM`: dess färger når fönstret oförändrade, som i OpenGL, och shadern gör korrigeringen en gång.
```
:::
:::d3d12
```quiz
Hur skulle en Direct3D 12-app kunna låta hårdvaran göra gammakorrigeringen, givet en swap chain med flip-modellen och buffrar i `DXGI_FORMAT_R8G8B8A8_UNORM`?
- [ ] Skapa swap chainen med `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB`
- [x] Skapa back buffrarnas render target views med `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` (och samma format i PSO:ns `RTVFormats[0]`), och ta bort `pow` ur shadern
- [ ] Sätta `D3D12_FILTER_SRGB` på den statiska samplern
- [ ] Anropa `ResolveSubresource` med ett `_SRGB`-format
---
Swap chains med flip-modellen tar inte `_SRGB`-format, men en sRGB-vy av deras UNORM-buffrar är tillåten: varje färg som skrivs genom den kodas. Shadern får inte koda den också, annars korrigeras bilden två gånger.
```
:::

:::opengl
Gör nu den första uppgiften, **gamma-shader**. I slutet av `gamma_correction.fs` upphöjer du färgen till 1/2.2:

```glsl
    color *= lighting;
    // gamma correction: the monitor raises the colour to the power 2.2, so store it to the power 1.0 / 2.2
    color = pow(color, vec3(1.0/2.2));
    FragColor = vec4(color, 1.0);
```
:::
:::vulkan
Gör nu den första uppgiften, **gamma-shader**. I slutet av `shaders/gamma_correction.frag` upphöjer du färgen till
1/2.2:

```glsl
    color *= lighting;
    // gamma correction: the monitor darkens colours by the power 2.2, so brighten them by the inverse power first
    color = pow(color, vec3(1.0 / 2.2));
    outColor = vec4(color, 1.0);
```
:::
:::d3d12
Gör nu den första uppgiften, **gamma-shader**. I slutet av `PSMain` i `gamma_correction.hlsl` upphöjer du färgen till
1/2.2:

```hlsl
    color *= lighting;
    // Gamma correction: the monitor shows a value v as about v to the power 2.2, so the
    // linear colour is raised to the power 1 / 2.2 first.
    float gamma = 2.2f;
    color = pow(color, float3(1.0f / gamma, 1.0f / gamma, 1.0f / gamma));
    return float4(color, 1.0f);
```
:::

Har du flera fragment shaders för olika objekt måste du se till att alla gör gammakorrigeringen; ett enklare sätt är att
införa ett post-processing-steg i renderloopen och gammakorrigera skärmfyrhörningen som sista steg, vilket du bara
behöver göra en gång.

Tryck på **Build & run**. Resultatet är överraskande: hela golvet blir **mycket ljusare och urblekt** – gråaktigt, som om
det låg dimma över det. Bakgrunden behåller samma mörkgrå färg: rensningsfärgen ritas inte av shadern, så den korrigeras
inte. En kodrad – men det var inte hela historien.

## sRGB-texturer

Eftersom bildskärmar visar färger med gamma tillämpat väljer du färger utifrån vad du ser på skärmen varje gång du ritar,
redigerar eller målar en bild på datorn. Det betyder i praktiken att alla bilder du skapar eller redigerar inte ligger i
linjärt rum, utan i sRGB-rummet: att dubbla en mörkröd färg på skärmen utifrån upplevd ljusstyrka är inte detsamma som att
dubbla den röda komponenten.

Följden är att texturartister skapar alla sina texturer i sRGB-rummet, så om vi använder texturerna som de är i vårt
renderingsprogram måste vi ta hänsyn till det. Innan vi tillämpade gammakorrigering var det inget problem, eftersom
texturerna såg bra ut i sRGB-rummet och vi utan gammakorrigering också arbetade i sRGB-rummet, så texturerna visades
precis som de är. Det fungerade. Men nu när vi visar allt i linjärt rum blir texturfärgerna fel: de gammakorrigeras två
gånger – en gång av artisten (filens färger är redan kodade) och en gång av vår shader. Det är det urblekta golvet.

```quiz
Varför ser golvet urblekt ut efter uppgiften **gamma-shader**?
- [ ] För att ljusen är för starka för gammakorrigering
- [ ] För att rensningsfärgen nu också gammakorrigeras
- [x] Trätexturens färger är redan sRGB-kodade; shadern behandlar dem som linjära och kodar dem en gång till
- [ ] För att `pow` med en exponent under 1 gör alla färger vita
---
Bilden gjordes på en bildskärm, så dess värden är gammakodade. Lästa som om de vore linjära, belysta och kodade igen blir de korrigerade två gånger: för ljusa och med för lite kontrast och mättnad.
```

För att lösa problemet måste vi korrigera tillbaka (eller av-gamma) de här sRGB-texturerna till linjärt rum innan vi gör
några beräkningar på deras färgvärden. Vi skulle kunna göra det för hand i shadern – `pow(texture(…).rgb, vec3(2.2))` –
för varje textur som ligger i sRGB-rummet, men det är mycket jobb och lätt att glömma. I stället ger {{api}} oss
texturformat som gör det åt oss: ett **sRGB-format** talar om för GPU:n att de lagrade värdena är sRGB-kodade, och varje
gång shadern samplar texturen får den färgen omvandlad till linjärt rum.

:::opengl
OpenGL har de interna formaten `GL_SRGB` och `GL_SRGB_ALPHA`. När vi skapar en textur med något av dem korrigerar OpenGL
automatiskt färgerna till linjärt rum så fort vi använder dem. Datan vi laddar upp är samma byte i formatet `GL_RGB` /
`GL_RGBA`; bara det interna formatet ändras. learnopengls `loadTexture` får en parameter för det.

Gör nu uppgiften **srgb-texture**. Ändra prototypen överst i `main.cpp` och definitionen:

```cpp
unsigned int loadTexture(const char *path, bool gammaCorrection);
```

och välj det interna formatet och dataformatet var för sig i `loadTexture`:

```cpp
        // an sRGB internal format: OpenGL converts the texels to linear colours when the shader samples them
        GLenum internalFormat = GL_RGB;
        GLenum dataFormat = GL_RGB;
        if (nrComponents == 1)
        {
            internalFormat = dataFormat = GL_RED;
        }
        else if (nrComponents == 3)
        {
            internalFormat = gammaCorrection ? GL_SRGB : GL_RGB;
            dataFormat = GL_RGB;
        }
        else if (nrComponents == 4)
        {
            internalFormat = gammaCorrection ? GL_SRGB_ALPHA : GL_RGBA;
            dataFormat = GL_RGBA;
        }

        glBindTexture(GL_TEXTURE_2D, textureID);
        glTexImage2D(GL_TEXTURE_2D, 0, internalFormat, width, height, 0, dataFormat, GL_UNSIGNED_BYTE, data);
```

Ladda sedan träet som sRGB:

```cpp
    unsigned int floorTexture = loadTexture("wood.png", true); // the image's colours are sRGB (gamma-encoded)
```
:::
:::vulkan
Vulkan har `_SRGB`-varianter av 8-bitarsformaten: `VK_FORMAT_R8G8B8A8_SRGB` är `VK_FORMAT_R8G8B8A8_UNORM` vars
färgkanaler avkodas från sRGB till linjärt när de samplas (alfa förblir linjär). Byten vi kopierar in i bilden genom
staging buffern är desamma; bara formatet på bilden och dess vy ändras. Projektets `loadTexture` och `createTextureImage`
tar redan formatet som parameter – motsvarigheten till learnopengls `loadTexture(path, gammaCorrection)`:

```cpp
    // learnopengl's loadTexture: an image file -> a texture image (device local, ready for sampling) and its view.
    // The format says how the shaders read the bytes: _UNORM as they are, _SRGB decoded from sRGB to linear colours.
    void loadTexture(const char* path, VkFormat format, VkImage& image, VkDeviceMemory& imageMemory, VkImageView& imageView) {
```

Formatet går till `createImage`, layoutövergångarna och `createImageView`. Gör nu uppgiften **srgb-texture**. Ladda träet
som sRGB i `initVulkan()`:

```cpp
        // SRGB: the image's colours are gamma-encoded (sRGB), the sampler decodes them to linear colours
        loadTexture("textures/wood.png", VK_FORMAT_R8G8B8A8_SRGB, floorTextureImage, floorTextureImageMemory, floorTextureImageView);
```
:::
:::d3d12
DXGI har `_SRGB`-varianter av 8-bitarsformaten: `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` är `DXGI_FORMAT_R8G8B8A8_UNORM` vars
färgkanaler avkodas från sRGB till linjärt när de samplas (alfa förblir linjär). Byten som `UpdateSubresources` kopierar
in i texturen är desamma; bara formatet ändras. Shader resource-vyn tar texturens format
(`srvDesc.Format = textureDesc.Format;`), så den blir också en sRGB-vy.

Gör nu uppgiften **srgb-texture**. Skapa texturen med sRGB-formatet i `LoadTexture`:

```cpp
    // The image's colours are sRGB-encoded (gamma-corrected), like any photo or painted
    // image: an _SRGB format makes sampling decode them to linear colours.
    textureDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM_SRGB;
```
:::

Tryck på **Build & run**: träet får tillbaka sina **varma, mättade färger** – avkodade till linjärt, belysta i linjärt
rum, kodade en gång. Jämfört med starten är golvets mörka delar ljusare och ljuspölarna mindre mättade. Det ser bättre
ut, men ljuset verkar nu för brett och platt. Det fixar vi strax.

Var försiktig när du anger texturer som sRGB, för alla texturer ligger faktiskt inte i sRGB-rummet. Texturer som används
för att färglägga objekt (som diffusa texturer) ligger nästan alltid i sRGB-rummet. Texturer som används för att hämta
belysningsparametrar (som specular maps och normal maps) ligger nästan alltid i linjärt rum, så om du skulle ange dem som
sRGB-texturer skulle belysningen se konstig ut. Tänk efter vilka texturer du anger som sRGB.

```quiz
Vilken av de här texturerna ska skapas med ett sRGB-format?
- [x] Den diffusa (färg-)texturen som en artist har målat eller fotograferat
- [ ] Belysningskapitlens specular map
- [ ] En normal map som lagrar riktningar
- [ ] En shadow map som lagrar djup
---
Bara bilder av färger, gjorda genom att titta på en bildskärm, är sRGB-kodade. Specular-, normal-, höjd- och djupkartor lagrar data för matematiken; att avkoda dem skulle ändra deras värden och förstöra belysningen.
```

## Dämpning

En annan sak som blir annorlunda med gammakorrigering är ljusets dämpning (attenuation). I den verkliga fysiska världen
avtar ljus nästan omvänt proportionellt mot kvadraten på avståndet från ljuskällan. På vanlig svenska betyder det helt
enkelt att ljusstyrkan minskar med kvadraten på avståndet till ljuskällan, så här:

:::opengl
```glsl
float attenuation = 1.0 / (distance * distance);
```
:::
:::vulkan
```glsl
float attenuation = 1.0 / (distance * distance);
```
:::
:::d3d12
```hlsl
float attenuation = 1.0f / (lightDistance * lightDistance);
```
:::

Med den här ekvationen blir dämpningseffekten dock oftast alldeles för stark, så att ljusen får en liten radie som inte ser
fysikaliskt riktig ut. Därför har man använt andra dämpningsfunktioner (som vi diskuterade i kapitlet *Ljuskällor*) som
ger mycket mer kontroll, eller också används den linjära motsvarigheten:

:::opengl
```glsl
float attenuation = 1.0 / distance;
```
:::
:::vulkan
```glsl
float attenuation = 1.0 / distance;
```
:::
:::d3d12
```hlsl
float attenuation = 1.0f / lightDistance;    // linear
```
:::

Utan gammakorrigering ger den linjära motsvarigheten trovärdigare resultat än den kvadratiska, men när vi slår på
gammakorrigering ser den linjära dämpningen för svag ut, och den fysikaliskt korrekta kvadratiska dämpningen ger plötsligt
bättre resultat – det är det för breda, platta ljuset från förra uppgiften.

Orsaken till skillnaden är att dämpningsfunktioner ändrar ljusstyrkan, och eftersom vi inte visade vår slutliga utdata i
linjärt rum valde vi de dämpningsfunktioner som såg bäst ut på bildskärmen, men som inte var fysikaliskt korrekta. Tänk på
den kvadratiska dämpningsfunktionen: om vi använde den utan gammakorrigering skulle den i praktiken bli
(1.0 / distance²)^2.2 när den visas på bildskärmen. Det ger en mycket starkare dämpning än vi ursprungligen tänkt oss. Det
förklarar också varför den linjära motsvarigheten är mycket rimligare utan gammakorrigering, eftersom den i praktiken blir
(1.0 / distance)^2.2 = 1.0 / distance^2.2, vilket liknar den fysikaliska motsvarigheten mycket mer.

```quiz
Varför såg den linjära dämpningen `1 / d` rätt ut före gammakorrigeringen, och varför är `1 / d²` rätt nu?
- [ ] För att `1 / d²` inte kan beräknas i en shader utan gammakorrigering
- [ ] För att sRGB-texturer är mörkare, så ljuset måste nå längre
- [x] Utan korrigering upphöjer bildskärmen allt till 2.2, så `1 / d` sågs som ungefär `1 / d^2.2` – nära det fysikaliska – medan `1 / d²` blev `1 / d^4.4`; med korrigering visar bildskärmen det vi räknar ut, så det fysikaliska `1 / d²` är rätt
- [ ] För att den kvadratiska termen bara spelar roll för fler än fyra ljus
---
Dämpning ändrar ljusstyrka, och bildskärmens kurva böjer ljusstyrkan. När utdatan väl är gammakorrigerad är det vi räknar ut det som når ögat, och den fysikaliskt korrekta kvadratiska avståndslagen ser rätt ut.
```

:::opengl
Gör nu den sista uppgiften, **quadratic**. I `BlinnPhong()` i `gamma_correction.fs`:

```glsl
    float attenuation = 1.0 / (distance * distance); // physically correct, now that the lighting is done in linear space
```
:::
:::vulkan
Gör nu den sista uppgiften, **quadratic**. I `BlinnPhong()` i `shaders/gamma_correction.frag`:

```glsl
    float attenuation = 1.0 / (distance * distance); // physically right, now that the lighting happens in linear space
```
:::
:::d3d12
Gör nu den sista uppgiften, **quadratic**. I `BlinnPhong()` i `gamma_correction.hlsl`:

```hlsl
    float attenuation = 1.0f / (lightDistance * lightDistance);    // quadratic: physically right, in linear space
```
:::

Tryck på **Build & run**: ljuset **avtar snabbare** – ljusare rakt under ljusen, mörkare mellan dem och framför dem. Det
här är learnopengls gammakorrigerade bild. Jämför med starten: där var det högra ljusets pöl en mättad orange fläck, och
de fyra ljusens gråtoner (0.25 till 1.00) såg mer olika ut än de är; nu följer ljusstyrkan ljusens färger och avståndet
så som fysiken säger att den ska.

Gammakorrigering låter oss alltså arbeta med och visa våra renderingar i linjärt rum. Eftersom linjärt rum är meningsfullt
i den fysiska världen ger de flesta fysikaliska ekvationer nu faktiskt bra resultat (som verklig ljusdämpning). Ju mer
avancerad belysningen blir, desto lättare är det att få snygga (och realistiska) resultat med gammakorrigering. Därför
rekommenderas det också att du bara på allvar justerar belysningsparametrarna när gammakorrigeringen väl är på plats:
justerar du dem utan den, som vi gjorde i de tidigare kapitlen, bakar du in bildskärmens kurva i värdena.

## Mer att läsa

:::opengl
- [Gamma Correction](https://learnopengl.com/Advanced-Lighting/Gamma-Correction): learnopengls kapitel som det här
  kapitlet följer, med bilderna av de två gråskalorna och av dämpningen.
- [gamma_correction.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/2.gamma_correction/gamma_correction.cpp):
  learnopengls program, med flaggan `gamma` på mellanslagstangenten.
- [glTexImage2D](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2D.xhtml): referenssidan, inklusive de
  interna formaten `GL_SRGB`.
:::
:::vulkan
- [Gamma Correction](https://learnopengl.com/Advanced-Lighting/Gamma-Correction): learnopengls kapitel som det här
  kapitlet följer, med bilderna av de två gråskalorna och av dämpningen.
- [Swap chain](https://vulkan-tutorial.com/Drawing_a_triangle/Presentation/Swap_chain): vulkan-tutorials
  `chooseSwapSurfaceFormat()` med valet `VK_FORMAT_B8G8R8A8_SRGB`.
- [Formats](https://docs.vulkan.org/spec/latest/chapters/formats.html): Vulkanspecifikationens kapitel om format,
  inklusive vad `_SRGB`-formaten gör.
:::
:::d3d12
- [Gamma Correction](https://learnopengl.com/Advanced-Lighting/Gamma-Correction): learnopengls kapitel som det här
  kapitlet följer, med bilderna av de två gråskalorna och av dämpningen.
- [Converting data for the color space](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/converting-data-color-space):
  hur `_SRGB`-format och sRGB-render target views på UNORM-back buffrar omvandlar färger.
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  varför ljusens arrayer är `float4`.
:::
