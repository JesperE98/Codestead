# Texturer

Vi har sett att vi kan ge våra objekt mer detaljer genom att ge varje vertex en färg och på så sätt skapa
intressanta bilder. Men för att få någon större realism skulle vi behöva väldigt många vertexar så att vi kunde ange
många färger. Det kostar en hel del extra, eftersom varje modell då behöver många fler vertexar och dessutom ett
färgattribut för varje vertex.

Det som artister och programmerare i allmänhet föredrar är att använda en *textur*. En textur är en 2D-bild (det
finns även 1D- och 3D-texturer) som används för att ge ett objekt detaljer; tänk dig en textur som ett papper med en
fin tegelbild på, prydligt vikt runt ditt 3D-hus så att det ser ut som om huset har en fasad av sten. Eftersom vi kan
få in väldigt mycket detaljer i en enda bild kan vi ge illusionen av att objektet är extremt detaljerat utan att
behöva lägga till fler vertexar.

> Förutom bilder kan texturer också användas för att lagra en stor mängd godtycklig data som skickas till
> shaderprogrammen, men det får vänta till ett annat ämne.

I det här kapitlet lägger du två bilder på rektangeln från de tidigare kapitlen: en trälåda, `container.png`, och en
smiley, `awesomeface.png`. Båda är 256×256 pixlar och båda ingår i projektet – **Spara startfilerna…** lägger dem i
din projektmapp. `container.png` har tre kanaler (RGB). `awesomeface.png` har fyra (RGBA): runt ansiktet är den
genomskinlig, och de genomskinliga pixlarna är lagrade som **svarta** med alfa 0. Kom ihåg det; det förklarar något du
kommer att se senare.

:::opengl
Det här kapitlets projekt är den indexerade rektangeln från *Hello Triangle* med `Shader`-klassen från kapitlet
*Shaders* (`shader_s.h`, `shader.vs`, `shader.fs`) och en färg per vertex: varje vertex har en position och en färg
(stride `6 * sizeof(float)`), hörnet uppe till höger är rött, nere till höger grönt, nere till vänster blått och uppe
till vänster gult, och färgerna interpoleras över rektangeln. De två bilderna ligger bredvid `main.cpp` och läses in
med sina filnamn.
:::
:::vulkan
Det här kapitlets projekt är den indexerade rektangeln från *Hello Triangle* med en färg per vertex:
`struct Vertex { glm::vec3 pos; glm::vec3 color; }` med två attributbeskrivningar, och hörnen uppe till vänster gult,
uppe till höger rött, nere till höger grönt och nere till vänster blått. De två bilderna ligger i
`textures/container.png` och `textures/awesomeface.png`.

Att lägga till en textur i ett Vulkan-program kräver flera nya funktioner, så projektet innehåller redan tomma
stubbar för dem, som `initVulkan()` anropar i den ordning vulkan-tutorial använder: `createDescriptorSetLayout()`
efter `createRenderPass()`; `createTextureImage()`, `createTextureImageView()` och `createTextureSampler()` efter
`createCommandPool()`; `createDescriptorPool()` och `createDescriptorSets()` efter `createIndexBuffer()`.
:::
:::d3d12
Det här kapitlets projekt är den indexerade rektangeln från *Hello Triangle* med en färg per vertex:
`struct Vertex { XMFLOAT3 position; XMFLOAT3 color; };` med ett `COLOR`-inputelement på offset 12, och hörnen uppe
till höger rött, nere till höger grönt, nere till vänster blått och uppe till vänster gult. Root signaturen är
fortfarande tom. De två bilderna ligger bredvid `main.cpp` och `shaders.hlsl` och läses in med sina filnamn.
Texturkoden följer Microsofts exempel D3D12HelloTexture – med skillnaden att exemplet genererar ett svartvitt
schackbräde i koden, medan vi läser in riktiga bilder.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift bygger och kör du programmet i din
IDE.

## Texturkoordinater

För att lägga en textur på rektangeln måste vi tala om för varje vertex i rektangeln vilken del av texturen den
motsvarar. Varje vertex ska alltså ha en *texturkoordinat* som anger vilken del av texturbilden som ska samplas.
Interpolationen av fragment sköter sedan resten för de övriga fragmenten.

Texturkoordinater går från `0` till `1` längs texturbildens x- och y-axel (kom ihåg att vi använder 2D-texturbilder).
Att hämta texturens färg med hjälp av texturkoordinater kallas *sampling*. Texturkoordinaten (0.5, 0.5) är alltid
bildens mitt, och (1, 1) och (0, 0) är två motsatta hörn – men *vilka* hörn beror på API:et:

:::opengl
I OpenGL börjar texturkoordinaterna på (0, 0) i texturbildens **nedre vänstra** hörn och går till (1, 1) i det övre
högra hörnet. OpenGL kallar de två axlarna *s* och *t* (och *r* för 3D-texturer). För att lägga en textur på en
triangel skulle vi ge dess nedre vänstra hörn texturkoordinaten (0, 0), dess nedre högra hörn (1, 0) och dess
översta hörn (0.5, 1.0): bildens överkant, halvvägs över.
:::
:::vulkan
I Vulkan börjar texturkoordinaterna på (0, 0) i texturbildens **övre vänstra** hörn – den första texeln i minnet –
och går till (1, 1) i det nedre högra hörnet. De två axlarna brukar kallas *u* och *v* (och *w* för 3D-texturer). För
att lägga en textur på en triangel skulle vi ge dess nedre vänstra hörn texturkoordinaten (0, 1), dess nedre högra
hörn (1, 1) och dess översta hörn (0.5, 0.0): bildens överkant, halvvägs över.
:::
:::d3d12
I Direct3D börjar texturkoordinaterna på (0, 0) i texturbildens **övre vänstra** hörn – den första texeln i minnet –
och går till (1, 1) i det nedre högra hörnet. De två axlarna kallas *u* och *v* (och *w* för 3D-texturer). För att
lägga en textur på en triangel skulle vi ge dess nedre vänstra hörn texturkoordinaten (0, 1), dess nedre högra hörn
(1, 1) och dess översta hörn (0.5, 0.0): bildens överkant, halvvägs över.
:::

Vi behöver bara skicka texturkoordinater för hörnen till vertex shadern, som skickar dem vidare till fragment
shadern, där texturkoordinaterna prydligt interpoleras för varje fragment.

Sampling av texturer kan tolkas fritt och göras på många olika sätt. Det är alltså vår uppgift att tala om för
{{api}} hur texturerna ska samplas.

## Wrapping av texturer

Texturkoordinater går oftast från (0, 0) till (1, 1), men vad händer om vi anger koordinater utanför det intervallet?
OpenGL:s standardbeteende, och det vanligaste valet i alla API:er, är att upprepa texturbilden (i princip ignoreras
heltalsdelen av flyttalskoordinaten), men det finns fler alternativ:

:::opengl
- `GL_REPEAT`: Standardbeteendet för texturer. Upprepar texturbilden.
- `GL_MIRRORED_REPEAT`: Som `GL_REPEAT`, men bilden speglas vid varje upprepning.
- `GL_CLAMP_TO_EDGE`: Begränsar koordinaterna till mellan `0` och `1`. Resultatet blir att högre koordinater
  hamnar på kanten, vilket ger ett utsträckt kantmönster.
- `GL_CLAMP_TO_BORDER`: Koordinater utanför intervallet får en kantfärg som du själv anger.

Varje alternativ kan ställas in per koordinataxel (`s`, `t` och `r` om du använder 3D-texturer) med funktionen
`glTexParameter*`:

```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT); // set texture wrapping to GL_REPEAT (default wrapping method)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
```

Det första argumentet anger texturens target; vi arbetar med 2D-texturer, så target är `GL_TEXTURE_2D`. Det andra
argumentet anger vilket alternativ vi vill ställa in och för vilken texturaxel; vi vill ställa in det för både `S`-
och `T`-axeln. Det sista argumentet är det wrapping-läge vi vill ha. Parametrarna sparas i det texturobjekt som för
tillfället är bundet till `GL_TEXTURE_2D` – du skapar och binder ett om en liten stund.

Väljer vi `GL_CLAMP_TO_BORDER` bör vi också ange en kantfärg. Det görs med `fv`-varianten av `glTexParameter` med
alternativet `GL_TEXTURE_BORDER_COLOR`, där vi skickar in en float-array med kantens färg, till exempel
`glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);` med
`float borderColor[] = { 1.0f, 1.0f, 0.0f, 1.0f };` för gult.
:::
:::vulkan
I Vulkan heter dessa *address modes*, av typen `VkSamplerAddressMode`:

- `VK_SAMPLER_ADDRESS_MODE_REPEAT`: Upprepar texturbilden.
- `VK_SAMPLER_ADDRESS_MODE_MIRRORED_REPEAT`: Som repeat, men bilden speglas vid varje upprepning.
- `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`: Begränsar koordinaterna till mellan `0` och `1`. Högre koordinater
  hamnar på kanten, vilket ger ett utsträckt kantmönster.
- `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER`: Koordinater utanför intervallet ger en kantfärg.

(Det finns också `VK_SAMPLER_ADDRESS_MODE_MIRROR_CLAMP_TO_EDGE`, som speglar bilden en gång och sedan begränsar;
det kräver en device feature.)

Den stora skillnaden mot OpenGL är *var* inställningarna hör hemma. I OpenGL är de parametrar i texturobjektet. I
Vulkan hör de till ett separat objekt, **samplern** (`VkSampler`), som inte vet något om någon bild: en sampler är en
uppsättning regler för att läsa *någon* bild. Du skapar en senare i kapitlet och ställer in address mode per axel
(`U`, `V` och `W`) så här:

```cpp
        samplerInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_REPEAT;
        samplerInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_REPEAT;
        samplerInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_REPEAT;
```

Kantfärgen för clamp-to-border är ingen godtycklig färg i core-Vulkan: `borderColor` väljer ett av några få
fördefinierade värden, till exempel `VK_BORDER_COLOR_INT_OPAQUE_BLACK`, `VK_BORDER_COLOR_FLOAT_TRANSPARENT_BLACK`
eller `VK_BORDER_COLOR_INT_OPAQUE_WHITE`.
:::
:::d3d12
I Direct3D heter dessa *texture address modes*, av typen `D3D12_TEXTURE_ADDRESS_MODE`:

- `D3D12_TEXTURE_ADDRESS_MODE_WRAP`: Upprepar texturbilden.
- `D3D12_TEXTURE_ADDRESS_MODE_MIRROR`: Som wrap, men bilden speglas vid varje upprepning.
- `D3D12_TEXTURE_ADDRESS_MODE_CLAMP`: Begränsar koordinaterna till mellan `0` och `1`. Högre koordinater hamnar på
  kanten, vilket ger ett utsträckt kantmönster.
- `D3D12_TEXTURE_ADDRESS_MODE_BORDER`: Koordinater utanför intervallet ger en kantfärg.

(Det finns också `D3D12_TEXTURE_ADDRESS_MODE_MIRROR_ONCE`, som speglar bilden en gång och sedan begränsar.)

Den stora skillnaden mot OpenGL är *var* inställningarna hör hemma. I OpenGL är de parametrar i texturobjektet. I
Direct3D hör de till en separat **sampler**, som inte vet något om någon textur: en sampler är en uppsättning regler
för att läsa *någon* textur. Du beskriver en senare i kapitlet och ställer in address mode per axel (`U`, `V` och
`W`) så här:

```cpp
        samplers[0].AddressU = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressV = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressW = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
```

Vi kommer att använda *static samplers*, som är en del av root signaturen; deras kantfärg är ett av några få
fördefinierade värden (`D3D12_STATIC_BORDER_COLOR_TRANSPARENT_BLACK`, `..._OPAQUE_BLACK`, `..._OPAQUE_WHITE`). En
sampler som skapas i en descriptor heap för samplers kan ha vilken kantfärg som helst.
:::

```quiz
En rektangels texturkoordinater går från 0.0 till 2.0 längs båda axlarna, och texturen läses med repeat (wrap). Vad ser du?
- [x] Bilden fyra gånger, i ett rutnät på 2 × 2
- [ ] Bilden en gång i en fjärdedel, och bildens kantpixlar utdragna över resten
- [ ] Bilden en gång, utsträckt över hela rektangeln
---
Med repeat räknas bara koordinatens decimaldel, så både 0..1 och 1..2 täcker hela bilden: två gånger på bredden och två på höjden. Det tredje svaret beskriver clamp-to-edge, som du använder i övningarna.
```

## Texturfiltrering

Texturkoordinater beror inte på upplösningen utan kan vara vilket flyttal som helst, så GPU:n måste räkna ut vilken
texturpixel (även kallad *texel*) texturkoordinaten ska motsvara. Det blir särskilt viktigt om du har ett mycket
stort objekt och en textur med låg upplösning. Du har säkert redan gissat att det finns alternativ även för denna
*texturfiltrering*. Det finns flera, men just nu tar vi upp de viktigaste:

- **Nearest neighbor-filtrering** (även kallad point filtering) väljer den texel vars mittpunkt ligger närmast
  texturkoordinaten.
- **(Bi)linjär filtrering** tar ett interpolerat värde från texturkoordinatens närliggande texlar och approximerar en
  färg mellan dem. Ju kortare avståndet från texturkoordinaten till en texels mittpunkt är, desto mer bidrar den
  texelns färg till den samplade färgen.

Vilken visuell effekt ger de här filtreringsmetoderna? Nearest-filtrering ger blockiga mönster där vi tydligt ser
pixlarna som bygger upp texturen, medan linjär filtrering ger ett mjukare mönster där de enskilda pixlarna syns
mindre. Linjär filtrering ger ett mer realistiskt resultat, men en del utvecklare föredrar en mer 8-bitarsaktig look
och väljer därför nearest.

Texturfiltrering kan ställas in separat för *förstoring* och *förminskning* (när texturen skalas upp eller ned), så
du kan till exempel använda nearest neighbor-filtrering när texturer skalas ned och linjär filtrering när de skalas
upp. I kapitlets projekt täcker en bild på 256×256 en rektangel på 400×300 pixlar: varje texel täcker ungefär
1,6 × 1,2 pixlar, så texturen *förstoras*.

:::opengl
I OpenGL heter de två alternativen `GL_NEAREST` och `GL_LINEAR`, och vi anger filtreringsmetoden för båda fallen med
`glTexParameter*`. Koden ser ut ungefär som när vi ställde in wrapping:

```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```

Förstoringsfiltret är `GL_LINEAR`. Förminskningsfiltret, `GL_LINEAR_MIPMAP_LINEAR`, använder också *mipmaps* – nästa
ämne.
:::
:::vulkan
I Vulkan heter de två alternativen `VK_FILTER_NEAREST` och `VK_FILTER_LINEAR`, och samplern har ett fält för varje
fall:

```cpp
        samplerInfo.magFilter = VK_FILTER_LINEAR;
        samplerInfo.minFilter = VK_FILTER_LINEAR;
```

Vulkans samplers kan också göra *anisotropisk filtrering*, som förbättrar texturer som ses i flack vinkel (ett golv
som sträcker sig bort mot horisonten). Projektets sampler slår på det – detaljerna ser du när du skapar den.
:::
:::d3d12
I Direct3D slås förminskningsfiltret, förstoringsfiltret och mipmapfiltret (nästa ämne) ihop till ett enda värde av
typen `D3D12_FILTER`. Namnen stavar ut de tre delarna: `POINT` är nearest, `LINEAR` är linjär. Till exempel använder
`D3D12_FILTER_MIN_MAG_MIP_POINT` nearest-filtrering överallt, `D3D12_FILTER_MIN_MAG_LINEAR_MIP_POINT` filtrerar
linjärt inom en mipnivå, och projektets sampler använder linjär filtrering för alla tre:

```cpp
        samplers[0].Filter = D3D12_FILTER_MIN_MAG_MIP_LINEAR;
```

Det finns också `D3D12_FILTER_ANISOTROPIC` (med `MaxAnisotropy`), som förbättrar texturer som ses i flack vinkel.
:::

```quiz
I kapitlets projekt täcker en textur på 256×256 en rektangel på 400×300 pixlar. Vilken filterinställning avgör hur den ser ut, och vad skulle nearest-filtrering visa?
- [ ] Mipmapfiltret; nearest-filtrering skulle välja en mindre mipnivå
- [x] Förstoringsfiltret; nearest-filtrering skulle visa varje texel som ett litet block med skarpa kanter
- [ ] Förminskningsfiltret; nearest-filtrering skulle göra bilden suddig
---
Varje texel täcker mer än en pixel, så texturen förstoras. Nearest-filtrering ger varje pixel färgen från den närmaste texeln – block – medan linjär filtrering blandar närliggande texlar till en mjuk bild.
```

### Mipmaps

Tänk dig ett stort rum med tusentals objekt, vart och ett med en textur. Det kommer att finnas objekt långt bort som
har samma högupplösta textur som objekten nära betraktaren. Eftersom objekten är långt bort och kanske bara ger
upphov till några få fragment får GPU:n svårt att hämta rätt färg för sitt fragment från den högupplösta texturen,
eftersom den måste välja en texturfärg för ett fragment som täcker en stor del av texturen. Det ger synliga artefakter
på små objekt, för att inte tala om all minnesbandbredd som slösas på högupplösta texturer på små objekt.

För att lösa det använder grafik-API:er något som kallas *mipmaps*, i grunden en samling texturbilder där varje
följande bild är hälften så stor som den föregående. Idén bakom mipmaps borde vara lätt att förstå: bortom ett visst
avstånd från betraktaren använder GPU:n en annan mipmapnivå, den som passar bäst för avståndet till objektet.
Eftersom objektet är långt bort märker användaren inte den lägre upplösningen. GPU:n kan då sampla rätt texlar, och
mindre cacheminne går åt när den delen av mipmapsen samplas. En hel kedja av mipmaps kostar bara ungefär en tredjedel
mer minne än originalbilden (1 + ¼ + 1/16 + … ≈ 4/3).

Precis som vid vanlig texturfiltrering går det också att filtrera mellan mipmapnivåer: vid byte mellan nivåer kan du
välja den närmaste nivån, eller blanda linjärt mellan de två närmaste – och inom en nivå sampla med nearest- eller
linjär filtrering.

:::opengl
Att skapa en samling mipmappade texturer för varje texturbild för hand är mödosamt, men som tur är kan OpenGL göra
allt arbete åt oss med ett enda anrop till `glGenerateMipmap` när vi har skapat en textur.

För att ange filtreringsmetoden mellan mipmapnivåer kan vi ersätta de ursprungliga filtreringsmetoderna med något av
följande fyra alternativ:

- `GL_NEAREST_MIPMAP_NEAREST`: tar den mipmap som passar pixelstorleken bäst och samplar med nearest
  neighbor-interpolation.
- `GL_LINEAR_MIPMAP_NEAREST`: tar den närmaste mipmapnivån och samplar den med linjär interpolation.
- `GL_NEAREST_MIPMAP_LINEAR`: interpolerar linjärt mellan de två mipmaps som bäst motsvarar en pixels storlek och
  samplar den interpolerade nivån med nearest neighbor-interpolation.
- `GL_LINEAR_MIPMAP_LINEAR`: interpolerar linjärt mellan de två närmaste mipmapsen och samplar den interpolerade
  nivån med linjär interpolation.

Det är vad förminskningsfiltret `GL_LINEAR_MIPMAP_LINEAR` ovan betyder. Ett vanligt misstag är att ange något av
mipmapalternativen som förstoringsfilter. Det har ingen effekt, eftersom mipmaps främst används när texturer skalas
ned: förstoring av texturer använder inga mipmaps, och ett mipmapalternativ där ger OpenGL-felkoden
`GL_INVALID_ENUM`.
:::
:::vulkan
Vulkan har ingen `glGenerateMipmap`. En image har så många mipnivåer som du anger i `VkImageCreateInfo::mipLevels`,
och att fylla dem är ditt jobb: vulkan-tutorials kapitel *Generating Mipmaps* gör det med `vkCmdBlitImage`, som
kopierar varje nivå till nästa, mindre, med linjär filtrering, tillsammans med en layoutövergång per nivå. Samplern
väljer sedan mellan nivåerna med `mipmapMode` (`VK_SAMPLER_MIPMAP_MODE_NEAREST` eller
`VK_SAMPLER_MIPMAP_MODE_LINEAR`) och intervallet `minLod`/`maxLod`.

Det här kapitlet håller det enkelt: våra texturimages har **en** mipnivå. Projektets sampler sätter ändå
`mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR`, som tutorialens, men med en enda nivå finns inget att välja mellan.
Eftersom vår rektangel förstorar texturen skulle mipmaps inte användas här ändå.
:::
:::d3d12
Direct3D 12 har ingen `glGenerateMipmap` (Direct3D 11:s `GenerateMips` följde inte med). En textur har så många
mipnivåer som du anger i `D3D12_RESOURCE_DESC::MipLevels`, och att fylla dem är ditt jobb: program läser antingen in
mipmaps som beräknats i förväg (till exempel DDS-filer gjorda med Microsofts bibliotek DirectXTex), eller genererar
dem på GPU:n med en compute shader, som bibliotek som DirectX Tool Kit gör. Samplern väljer mellan nivåerna med
filtrets `MIP`-del och intervallet `MinLOD`/`MaxLOD`.

Det här kapitlet håller det enkelt, precis som Microsofts exempel D3D12HelloTexture: våra texturer har **en**
mipnivå. Projektets sampler använder ändå `D3D12_FILTER_MIN_MAG_MIP_LINEAR`, men med en enda nivå finns inget att
välja mellan. Eftersom vår rektangel förstorar texturen skulle mipmaps inte användas här ändå.
:::

```quiz
Varför används mipmaps bara när en textur förminskas (ritas mindre än sin storlek)?
- [ ] Mipmaps beräknas om varje bildruta, vilket bara går tillräckligt snabbt för texturer som syns små
- [ ] Mipmaps är större än originalbilden, så de får bara plats på skärmen när texturen förminskas
- [x] När många texlar hamnar på en pixel ger en mindre, förfiltrerad nivå rätt medelfärg utan artefakter och med mindre minnestrafik; vid förstoring är nivån i full storlek redan den mest detaljerade
---
Varje mipnivå är hälften så stor som den föregående och beräknas en gång, när texturen skapas. En förstorad textur har färre texlar än pixlar, så en ännu mindre nivå har inget att tillföra.
```

## Läsa in och skapa texturer

Det första vi måste göra för att faktiskt använda texturer är att läsa in dem i programmet. Texturbilder kan lagras i
dussintals filformat, vart och ett med sin egen struktur och ordning på datan, så hur får vi in bilderna i vårt
program? En lösning vore att välja ett filformat, säg `.PNG`, och skriva en egen bildläsare som omvandlar formatet
till en stor array av bytes. Det är inte särskilt svårt att skriva en egen bildläsare, men det är mödosamt, och vad
händer om du vill stödja fler filformat? Då måste du skriva en bildläsare för varje format.

En annan lösning, och förmodligen en bra sådan, är att använda ett bibliotek för bildinläsning som stöder flera
populära format och gör allt det tunga arbetet åt oss. Ett bibliotek som `stb_image.h`.

:::d3d12
> Windows-program läser ofta in bilder med Windows Imaging Component (WIC), som ingår i Windows, eller med Microsofts
> bibliotek DirectXTex, som också läser DDS-filer med färdiga mipmaps. Den här kursen använder `stb_image.h` för alla
> tre API:erna, så att inläsningskoden är densamma överallt.
:::

### stb_image.h

`stb_image.h` är ett mycket populärt bildinläsningsbibliotek i en enda headerfil, skrivet av Sean Barrett. Det kan
läsa de flesta populära filformat och är lätt att integrera i dina projekt. Du lade det i `libs/stb` i *Sätt upp din
IDE*, och ditt projekt känner redan till den mappen:

:::ide clion vscode
`CMakeLists.txt` anger `${LIBS}/stb` i `target_include_directories`, så headern finns tillgänglig som `<stb_image.h>`.
:::
:::ide vs rider
`..\..\libs\stb` är en av projektets **Additional Include Directories**, så headern finns tillgänglig som
`<stb_image.h>`.
:::

För att använda det lägger du till följande rader i en källfil:

```cpp
#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>
```

Genom att definiera `STB_IMAGE_IMPLEMENTATION` ändrar preprocessorn headerfilen så att den bara innehåller den
relevanta implementationskoden, vilket i praktiken gör headerfilen till en `.cpp`-fil, och det är i stort sett allt.
Gör det i exakt **en** `.cpp`-fil: andra filer som behöver biblioteket inkluderar headern utan definitionen.

För att läsa in en bild med `stb_image.h` använder vi dess funktion `stbi_load`. Funktionen tar sökvägen till en
bildfil. Sedan vill den ha tre `int` som andra, tredje och fjärde argument, som `stb_image.h` fyller i med bildens
bredd, höjd och antal färgkanaler. Det sista argumentet anger hur många kanaler du vill få tillbaka: `0` betyder "så
många som filen har". Funktionen returnerar en pekare till pixlarna, rad för rad, med bildens **översta** rad först,
eller en null-pekare om filen inte kunde läsas in. När vi är klara med pixlarna lämnar vi tillbaka minnet med
`stbi_image_free`.

:::opengl
```cpp
    // load image, create texture and generate mipmaps
    int width, height, nrChannels;
    stbi_set_flip_vertically_on_load(true); // tell stb_image.h to flip loaded texture's on the y-axis.
    unsigned char *data = stbi_load("container.png", &width, &height, &nrChannels, 0);
    if (data)
    {
        // TODO: create the texture image from the data and generate mipmaps
    }
    else
    {
        std::cout << "Failed to load texture" << std::endl;
    }
    stbi_image_free(data);
```

Vi läser in `container.png` med så många kanaler som den har (tre: RGB). Lägg märke till raden före `stbi_load`.
Bildfiler – och därmed `stb_image.h` – lägger bildens översta rad först. OpenGL förväntar sig däremot att koordinaten
`0.0` på y-axeln (t) ligger i bildens **nederkant**: den första raden du ger OpenGL blir raden vid t = 0, längst ned.
Utan hjälp skulle lådan alltså hamna upp och ned. `stbi_set_flip_vertically_on_load(true)` säger åt `stb_image.h` att
vända bilden längs y-axeln vid inläsningen, så att den nedersta raden kommer först och bilden visas rättvänd.

Gör nu den första uppgiften, **load-image**: inkludera `stb_image.h` (efter GLFW-includen) och läs in `container.png`
som ovan, vid den andra `// TODO:` i `main.cpp`. Lämna insidan av `if (data)` till nästa uppgifter. Ingenting syns
ändras ännu – men om filen inte kan läsas in ser du `Failed to load texture` i programmets konsol.
:::
:::vulkan
I `createTextureImage()`:

```cpp
        int texWidth, texHeight, texChannels;
        stbi_uc* pixels = stbi_load("textures/container.png", &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);

        if (!pixels) {
            throw std::runtime_error("failed to load texture image!");
        }
```

Värdet `STBI_rgb_alpha` tvingar bilden att läsas in med en alfakanal, även om den saknar en, vilket är bra för
enhetlighetens skull: `container.png` har ingen alfa, men varje pixel kommer tillbaka som 4 bytes. Texturformatet vi
ska använda, `VK_FORMAT_R8G8B8A8_UNORM`, har också fyra kanaler – många GPU:er stöder inte format med 3 kanaler för
samplade images.

Lägg märke till att det **inte** finns någon vertikal vändning. Bildfiler – och därmed `stb_image.h` – lägger
bildens översta rad först, och i Vulkan är den första raden i minnet raden vid v = 0, som är texturens **överkant**.
Bilden kommer fram rättvänd som den är. (OpenGL-tutorials anropar `stbi_set_flip_vertically_on_load(true)` här,
eftersom OpenGL betraktar t = 0 som texturens nederkant.)

Frigör pixlarna med `stbi_image_free(pixels);` när de har kopierats – för tillfället direkt, vid dess `// TODO:`.

Gör nu den första uppgiften, **load-image**: lägg till definitionen och includen överst i `main.cpp` och läs in
bilden i `createTextureImage()`. Ingenting syns ändras ännu; om filen inte kan läsas in avbryts programmet med
`failed to load texture image!`.
:::
:::d3d12
I `LoadAssets()`, efter indexbufferten, skapar ett nytt block den första texturen:

```cpp
    // Create the first texture: the container.
    {
        // Load the image. The last argument asks stb_image for 4 channels (RGBA), the
        // layout of DXGI_FORMAT_R8G8B8A8_UNORM, although container.png has no alpha.
        // No vertical flip: in Direct3D, texture coordinate v = 0 is the image's top row.
        int width, height, nrChannels;
        unsigned char* data = stbi_load("container.png", &width, &height, &nrChannels, 4);
        if (data == nullptr)
        {
            throw std::runtime_error("Failed to load texture container.png");
        }

        // Free the image memory.
        stbi_image_free(data);
    }
```

Vi ber om 4 kanaler fast `container.png` bara har tre: texturformatet vi ska använda, `DXGI_FORMAT_R8G8B8A8_UNORM`,
har fyra, och DXGI har inget 8-bitarsformat med tre kanaler alls.

Lägg märke till att det **inte** finns någon vertikal vändning. Bildfiler – och därmed `stb_image.h` – lägger
bildens översta rad först, och i Direct3D är den första raden i minnet raden vid v = 0, som är texturens
**överkant**. Bilden kommer fram rättvänd som den är. (OpenGL-tutorials anropar
`stbi_set_flip_vertically_on_load(true)` här, eftersom OpenGL betraktar t = 0 som texturens nederkant.)

Gör nu den första uppgiften, **load-image**: lägg till definitionen och includen efter `#include "d3dx12.h"` och
lägg till blocket ovan vid `// TODO:` efter indexbufferten. Ingenting syns ändras ännu; om filen inte kan läsas in
avbryts programmet med ett undantag.
:::

```quiz
OpenGL-versionen av kapitlet anropar `stbi_set_flip_vertically_on_load(true)`; versionerna för Vulkan och Direct3D 12 gör det inte. Varför?
- [ ] `stb_image.h` läser in bilder upp och ned på vissa plattformar, och bara OpenGL rättar till det
- [x] Bildfiler lagrar den översta raden först. OpenGL betraktar texturkoordinat 0 på den vertikala axeln som bildens nederkant, Vulkan och Direct3D betraktar den som överkanten
- [ ] Vulkan och Direct3D 12 vänder själva varje bild när texturen skapas
---
I alla tre API:erna hamnar den första raden du laddar upp på vertikal texturkoordinat 0. I OpenGL är det texturens nederkant, så bilden vänds vid inläsningen; i Vulkan och Direct3D är v = 0 överkanten, vilket stämmer med filen.
```

## Skapa en textur

:::opengl
Precis som alla tidigare objekt i OpenGL refereras texturer med ett ID; vi skapar ett:

```cpp
    unsigned int texture1;
    glGenTextures(1, &texture1);
```

Funktionen `glGenTextures` tar först hur många texturer vi vill skapa och sparar dem i en `unsigned int`-array som
ges som andra argument (i vårt fall bara en enda `unsigned int`). Precis som andra objekt måste vi binda den så att
efterföljande texturkommandon ställer in den texturen som för tillfället är bunden:

```cpp
    glBindTexture(GL_TEXTURE_2D, texture1); // all upcoming GL_TEXTURE_2D operations now have effect on this texture object
    // set the texture wrapping parameters
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT); // set texture wrapping to GL_REPEAT (default wrapping method)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    // set texture filtering parameters
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```

Det här är inställningarna för wrapping och filtrering från avsnitten ovan. Inget av anropen nämner texturen: alla
ändrar den textur som just nu är bunden till `GL_TEXTURE_2D`. När programmet avslutas tas texturen bort precis som
buffertarna, med `glDeleteTextures(1, &texture1);` efter `glDeleteBuffers(1, &EBO);`.

Gör nu uppgiften **create-texture**: lägg raderna vid den första `// TODO:` (före bildinläsningen) och lägg till
anropet till `glDeleteTextures`. Fortfarande ändras ingenting synligt.

Nu när texturen är bunden kan vi börja skapa en textur av den bilddata vi läste in. Texturer skapas med
`glTexImage2D`:

```cpp
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);
```

Det är en stor funktion med ganska många parametrar, så vi går igenom dem steg för steg:

- Det första argumentet anger texturens target; med `GL_TEXTURE_2D` skapar operationen en textur i det texturobjekt
  som är bundet till samma target (texturer bundna till `GL_TEXTURE_1D` eller `GL_TEXTURE_3D` påverkas inte).
- Det andra argumentet anger vilken mipmapnivå vi skapar en textur för, om du vill ställa in varje mipmapnivå för
  hand, men vi låter det vara basnivån, `0`.
- Det tredje argumentet säger i vilket format OpenGL ska lagra texturen. Vår bild har bara `RGB`-värden, så vi
  lagrar texturen med `RGB`-värden också.
- Det fjärde och femte argumentet anger den resulterande texturens bredd och höjd. Dem sparade vi när vi läste in
  bilden, så vi använder de variablerna.
- Nästa argument ska alltid vara `0` (en kvarleva från förr).
- Det sjunde och åttonde argumentet anger källbildens format och datatyp. Vi läste in bilden med `RGB`-värden och
  lagrade dem som `char` (bytes), så vi skickar in motsvarande värden.
- Det sista argumentet är själva bilddatan.

När `glTexImage2D` har anropats har det bundna texturobjektet texturbilden kopplad till sig. Men än så länge har bara
basnivån av texturbilden laddats, och om vi vill använda mipmaps måste vi ange alla de olika bilderna för hand (genom
att räkna upp det andra argumentet) – eller anropa `glGenerateMipmap` efter att texturen skapats. Det genererar
automatiskt alla mipmaps som behövs för den bundna texturen. OpenGL kopierar datan, så efter detta går det bra att
frigöra bildminnet med `stbi_image_free` – därför ligger uppladdningen inuti `if (data)`, före det anropet.

> Som standard förväntar sig OpenGL att varje rad i källdatan börjar på en multipel av 4 bytes. En rad i
> `container.png` är 256 × 3 = 768 bytes, så det går bra; för en RGB-bild vars bredd inte är en multipel av 4 anropar
> du `glPixelStorei(GL_UNPACK_ALIGNMENT, 1);` före `glTexImage2D`.

Gör nu uppgiften **upload**: lägg de två raderna inuti `if (data)`. Texturen innehåller nu lådan, men inget ritar den
ännu, så bilden ändras fortfarande inte.
:::
:::vulkan
I OpenGL är det här avsnittet kort: `glGenTextures`, `glBindTexture`, `glTexImage2D` och `glGenerateMipmap`, och
texturen är klar. I Vulkan är det kapitlets längsta del, och det hjälper att förstå varför innan vi börjar.
`glTexImage2D` gör mycket arbete som du aldrig ser: drivrutinen väljer GPU-minne till texturen, väljer en ordning för
texlarna i minnet som passar GPU:n, kopierar dina bytes dit (ofta via en dold temporär buffert) och ser till att
ingen shader läser texturen innan kopieringen är klar. Vulkan döljer inget av det. Vi kommer att:

1. kopiera pixlarna till en **staging buffer**, en buffert i minne som CPU:n kan skriva till;
2. skapa en **`VkImage`** i snabbt GPU-minne och själva allokera och binda dess minne;
3. spela in kommandon som **byter imagens layout** och **kopierar** bufferten till imagen;
4. skapa en **image view**, eftersom shaders aldrig läser en `VkImage` direkt; och
5. skapa en **sampler** med reglerna för filtrering och adressering från avsnitten ovan.

Belöningen för all denna kod är kontroll: inget händer bakom din rygg, så inget stannar heller upp bakom din rygg,
och du bestämmer var minne hamnar och när arbete körs. Stegen följer vulkan-tutorials kapitel *Images* och *Image
view and sampler*.

### Staging buffer

Imagen kommer att ligga i device-local-minne, det snabbaste minnet för GPU:n, som CPU:n oftast inte kan skriva till.
Därför skapar vi först en buffert i host-visible-minne, kopierar pixlarna dit och låter sedan GPU:n kopiera dem till
imagen. Denna *staging buffer* behöver en funktion som skapar en buffert av valfri storlek och användning –
vulkan-tutorials `createBuffer()`, stegen i `createVertexBuffer()` med parametrar:

```cpp
    void createBuffer(VkDeviceSize size, VkBufferUsageFlags usage, VkMemoryPropertyFlags properties, VkBuffer& buffer, VkDeviceMemory& bufferMemory) {
        VkBufferCreateInfo bufferInfo{};
        bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
        bufferInfo.size = size;
        bufferInfo.usage = usage;
        bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

        if (vkCreateBuffer(device, &bufferInfo, nullptr, &buffer) != VK_SUCCESS) {
            throw std::runtime_error("failed to create buffer!");
        }

        VkMemoryRequirements memRequirements;
        vkGetBufferMemoryRequirements(device, buffer, &memRequirements);

        VkMemoryAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
        allocInfo.allocationSize = memRequirements.size;
        allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, properties);

        if (vkAllocateMemory(device, &allocInfo, nullptr, &bufferMemory) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate buffer memory!");
        }

        vkBindBufferMemory(device, buffer, bufferMemory, 0);
    }
```

I `createTextureImage()`, direkt efter inläsningen, hamnar pixlarna i staging-bufferten:

```cpp
        VkDeviceSize imageSize = texWidth * texHeight * 4;

        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(imageSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, imageSize, 0, &data);
            memcpy(data, pixels, static_cast<size_t>(imageSize));
        vkUnmapMemory(device, stagingBufferMemory);
```

Storleken är 4 bytes per pixel på grund av `STBI_rgb_alpha`. `VK_BUFFER_USAGE_TRANSFER_SRC_BIT` säger att bufferten
blir källa för en kopiering. Efter `memcpy` behövs pixlarna från `stb_image.h` inte längre, så
`stbi_image_free(pixels);` står kvar efter den här koden. Staging-bufferten behövs bara tills kopieringen till imagen
är klar, så i slutet av `createTextureImage()` förstörs den igen:

```cpp
        vkDestroyBuffer(device, stagingBuffer, nullptr);
        vkFreeMemory(device, stagingBufferMemory, nullptr);
```

Gör nu uppgiften **staging-buffer**: lägg till `createBuffer()` vid dess `// TODO:` och staging-koden i
`createTextureImage()`. Bilden ändras inte.

### Texture image

Vi skulle kunna låta shadern läsa pixelvärdena direkt ur bufferten, men det är bättre att använda image-objekt i
Vulkan för det här. Image-objekt gör det enklare och snabbare att hämta färger, bland annat genom att vi kan använda
2D-koordinater. Imagen och dess minne är nya medlemmar i klassen:

```cpp
    VkImage textureImage;
    VkDeviceMemory textureImageMemory;
```

Att skapa en image liknar mycket att skapa en buffert: fyll i en create-info, skapa objektet, fråga efter dess
minneskrav, allokera passande minne och bind det. Vi behöver detta igen för den andra texturen, så det hamnar i en
hjälpfunktion:

```cpp
    void createImage(uint32_t width, uint32_t height, VkFormat format, VkImageTiling tiling, VkImageUsageFlags usage, VkMemoryPropertyFlags properties, VkImage& image, VkDeviceMemory& imageMemory) {
        VkImageCreateInfo imageInfo{};
        imageInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
        imageInfo.imageType = VK_IMAGE_TYPE_2D;
        imageInfo.extent.width = width;
        imageInfo.extent.height = height;
        imageInfo.extent.depth = 1;
        imageInfo.mipLevels = 1;
        imageInfo.arrayLayers = 1;
        imageInfo.format = format;
        imageInfo.tiling = tiling;
        imageInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        imageInfo.usage = usage;
        imageInfo.samples = VK_SAMPLE_COUNT_1_BIT;
        imageInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

        if (vkCreateImage(device, &imageInfo, nullptr, &image) != VK_SUCCESS) {
            throw std::runtime_error("failed to create image!");
        }

        VkMemoryRequirements memRequirements;
        vkGetImageMemoryRequirements(device, image, &memRequirements);

        VkMemoryAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
        allocInfo.allocationSize = memRequirements.size;
        allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, properties);

        if (vkAllocateMemory(device, &allocInfo, nullptr, &imageMemory) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate image memory!");
        }

        vkBindImageMemory(device, image, imageMemory, 0);
    }
```

Image-typen talar om för Vulkan vilket slags koordinatsystem texlarna i imagen ska adresseras med: 1D, 2D eller 3D.
`extent` är storleken, med djupet 1 för en 2D-image. Vi använder en mipnivå och ett array-lager, och ett sample
(multisampling spelar bara roll för images som används som attachments).

Fältet `tiling` kan ha ett av två värden:

- `VK_IMAGE_TILING_LINEAR`: texlarna ligger rad för rad, som i vår `pixels`-array;
- `VK_IMAGE_TILING_OPTIMAL`: texlarna ligger i en implementationsdefinierad ordning för optimal åtkomst.

Till skillnad från en images layout kan tiling-läget inte ändras i efterhand. Eftersom vi kopierar från en staging
buffer och bara GPU:n läser imagen använder vi `VK_IMAGE_TILING_OPTIMAL` för effektiv åtkomst från shadern.

Det finns bara två möjliga värden för en images `initialLayout`: `VK_IMAGE_LAYOUT_UNDEFINED` (kan inte användas av
GPU:n, och den allra första övergången kastar texlarna) och `VK_IMAGE_LAYOUT_PREINITIALIZED` (den första övergången
bevarar dem, användbart bara för linjära images som CPU:n skriver direkt). Vi skriver ändå över hela imagen med en
kopiering, så `UNDEFINED` är rätt.

I `createTextureImage()` anropar vi den efter staging-koden:

```cpp
        // UNORM like the swap chain: the shaders read the bytes of the file unchanged (0..255 -> 0.0..1.0).
        createImage(texWidth, texHeight, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, textureImage, textureImageMemory);
```

Imagen är *mål* för kopieringen (`TRANSFER_DST`) och kommer att *samplas* av shadern (`SAMPLED`), och dess minne är
`DEVICE_LOCAL`.

> **UNORM, inte SRGB.** vulkan-tutorial använder `VK_FORMAT_R8G8B8A8_SRGB` här, tillsammans med en swap chain i SRGB.
> Kursens swap chain är `VK_FORMAT_B8G8R8A8_UNORM`, så texturen är också UNORM: shadern läser varje byte som
> byte / 255 och skriver den oförändrad till skärmen – samma färger som i OpenGL- och Direct3D-versionerna. Vi
> återkommer till sRGB i kapitlet om gammakorrigering.

Imagen och dess minne förstörs i `cleanup()`, vid deras `// TODO:`:

```cpp
        vkDestroyImage(device, textureImage, nullptr);
        vkFreeMemory(device, textureImageMemory, nullptr);
```

Gör nu uppgiften **texture-image**. Bilden ändras fortfarande inte.

### Layoutövergångar

Imagen finns, men den är tom, och den har layouten `VK_IMAGE_LAYOUT_UNDEFINED`. En images *layout* är det sätt som
dess texlar är ordnade på för en viss användning, och varje användning kräver rätt layout. Du känner igen det från
swap chainens images, som render passet flyttar mellan layouter. För vår textur behöver vi två:

- `VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL`: optimal som mål för en transfer-operation (kopiering);
- `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`: optimal för sampling från en shader.

Kopieringar och layoutövergångar är GPU-arbete, så de spelas in i en command buffer och skickas till en kö. Två små
hjälpfunktioner spelar in och skickar sådana engångskommandon:

```cpp
    VkCommandBuffer beginSingleTimeCommands() {
        VkCommandBufferAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;
        allocInfo.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
        allocInfo.commandPool = commandPool;
        allocInfo.commandBufferCount = 1;

        VkCommandBuffer commandBuffer;
        vkAllocateCommandBuffers(device, &allocInfo, &commandBuffer);

        VkCommandBufferBeginInfo beginInfo{};
        beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;
        beginInfo.flags = VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT;

        vkBeginCommandBuffer(commandBuffer, &beginInfo);

        return commandBuffer;
    }

    void endSingleTimeCommands(VkCommandBuffer commandBuffer) {
        vkEndCommandBuffer(commandBuffer);

        VkSubmitInfo submitInfo{};
        submitInfo.sType = VK_STRUCTURE_TYPE_SUBMIT_INFO;
        submitInfo.commandBufferCount = 1;
        submitInfo.pCommandBuffers = &commandBuffer;

        vkQueueSubmit(graphicsQueue, 1, &submitInfo, VK_NULL_HANDLE);
        vkQueueWaitIdle(graphicsQueue);

        vkFreeCommandBuffers(device, commandPool, 1, &commandBuffer);
    }
```

`vkQueueWaitIdle` väntar tills kön är klar – enkelt, och fullt tillräckligt för inläsning vid start.

Ett av de vanligaste sätten att göra layoutövergångar är med en *image memory barrier*. En sådan pipeline barrier
används i allmänhet för att synkronisera åtkomst till resurser, till exempel för att se till att en skrivning till en
buffert är klar innan den läses, men den kan också användas för att byta layout på images:

```cpp
    void transitionImageLayout(VkImage image, VkFormat format, VkImageLayout oldLayout, VkImageLayout newLayout) {
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkImageMemoryBarrier barrier{};
        barrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
        barrier.oldLayout = oldLayout;
        barrier.newLayout = newLayout;
        barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
        barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
        barrier.image = image;
        barrier.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        barrier.subresourceRange.baseMipLevel = 0;
        barrier.subresourceRange.levelCount = 1;
        barrier.subresourceRange.baseArrayLayer = 0;
        barrier.subresourceRange.layerCount = 1;

        VkPipelineStageFlags sourceStage;
        VkPipelineStageFlags destinationStage;

        if (oldLayout == VK_IMAGE_LAYOUT_UNDEFINED && newLayout == VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL) {
            barrier.srcAccessMask = 0;
            barrier.dstAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;

            sourceStage = VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT;
            destinationStage = VK_PIPELINE_STAGE_TRANSFER_BIT;
        } else if (oldLayout == VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL && newLayout == VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL) {
            barrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
            barrier.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;

            sourceStage = VK_PIPELINE_STAGE_TRANSFER_BIT;
            destinationStage = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        } else {
            throw std::invalid_argument("unsupported layout transition!");
        }

        vkCmdPipelineBarrier(
            commandBuffer,
            sourceStage, destinationStage,
            0,
            0, nullptr,
            0, nullptr,
            1, &barrier
        );

        endSingleTimeCommands(commandBuffer);
    }
```

Barriären anger den gamla och den nya layouten och vilken del av imagen den gäller (färgaspekten, vår enda mipnivå
och vårt enda lager). Vi flyttar inte imagen till en annan queue family, därav `VK_QUEUE_FAMILY_IGNORED`.
Access-maskerna och pipeline-stegen anger vilket arbete som måste ske före barriären och vilket arbete som måste
vänta på den:

- `UNDEFINED → TRANSFER_DST_OPTIMAL`: inget behöver ske före (access-mask 0, det tidigaste steget `TOP_OF_PIPE`),
  och transfer-skrivningarna måste vänta på övergången.
- `TRANSFER_DST_OPTIMAL → SHADER_READ_ONLY_OPTIMAL`: transfer-skrivningarna måste vara klara och synliga innan
  fragment shadern läser (`SHADER_READ` i steget `FRAGMENT_SHADER`).

Barriären gör alltså två jobb på en gång: den byter layout, och den ordnar kopieringen före shaderns läsningar.
Själva kopieringen är ett enda kommando, `vkCmdCopyBufferToImage`, med en region som anger vilken del av bufferten
som går till vilken del av imagen:

```cpp
    void copyBufferToImage(VkBuffer buffer, VkImage image, uint32_t width, uint32_t height) {
        VkCommandBuffer commandBuffer = beginSingleTimeCommands();

        VkBufferImageCopy region{};
        region.bufferOffset = 0;
        region.bufferRowLength = 0;
        region.bufferImageHeight = 0;
        region.imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        region.imageSubresource.mipLevel = 0;
        region.imageSubresource.baseArrayLayer = 0;
        region.imageSubresource.layerCount = 1;
        region.imageOffset = {0, 0, 0};
        region.imageExtent = {
            width,
            height,
            1
        };

        vkCmdCopyBufferToImage(commandBuffer, buffer, image, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &region);

        endSingleTimeCommands(commandBuffer);
    }
```

`bufferRowLength` och `bufferImageHeight` lika med 0 betyder att pixlarna ligger tätt packade, som `stb_image.h`
levererar dem. Den fjärde parametern till `vkCmdCopyBufferToImage` anger vilken layout imagen har under kopieringen.
Med hjälpfunktionerna på plats byter `createTextureImage()` layout, kopierar och byter layout igen, mellan
`createImage` och förstörandet av staging-bufferten:

```cpp
        transitionImageLayout(textureImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL);
            copyBufferToImage(stagingBuffer, textureImage, static_cast<uint32_t>(texWidth), static_cast<uint32_t>(texHeight));
        transitionImageLayout(textureImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL);
```

Gör nu uppgiften **layout-transitions**: lägg till de fyra hjälpfunktionerna vid deras `// TODO:` och de tre anropen
i `createTextureImage()`. Bilden ändras inte, och det kommer fortfarande inga valideringsmeddelanden.

### Image view

Images nås via image views i stället för direkt, både swap chainens images och texturer. En view anger hur imagen ska
tolkas: som en 2D-image, med vilket format, vilken aspekt och vilka mipnivåer och lager. Texturens view är en ny
medlem, `VkImageView textureImageView;`, och eftersom koden är densamma som för swap chainens images bortsett från
imagen och formatet hamnar den i en hjälpfunktion:

```cpp
    VkImageView createImageView(VkImage image, VkFormat format) {
        VkImageViewCreateInfo viewInfo{};
        viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
        viewInfo.image = image;
        viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
        viewInfo.format = format;
        viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        viewInfo.subresourceRange.baseMipLevel = 0;
        viewInfo.subresourceRange.levelCount = 1;
        viewInfo.subresourceRange.baseArrayLayer = 0;
        viewInfo.subresourceRange.layerCount = 1;

        VkImageView imageView;
        if (vkCreateImageView(device, &viewInfo, nullptr, &imageView) != VK_SUCCESS) {
            throw std::runtime_error("failed to create image view!");
        }

        return imageView;
    }
```

Swizzlingen i `components` utelämnas: nollinitierad är den `VK_COMPONENT_SWIZZLE_IDENTITY`. Den långa create-infon i
`createImageViews()` krymper till en rad, `swapChainImageViews[i] = createImageView(swapChainImages[i],
swapChainImageFormat);`, och `createTextureImageView()` skapar texturens view:

```cpp
        textureImageView = createImageView(textureImage, VK_FORMAT_R8G8B8A8_UNORM);
```

I `cleanup()` förstörs viewn med `vkDestroyImageView(device, textureImageView, nullptr);`.

Gör nu uppgiften **image-view**. Bilden ändras inte.

### Sampler

Shaders kan läsa texlar direkt ur images, men det är inte så vanligt när de används som texturer. Texturer läses
oftast via samplers, som tillämpar filtrering och transformationer för att beräkna den färg som till slut hämtas.
Samplern är en ny medlem, `VkSampler textureSampler;`, som skapas i `createTextureSampler()`:

```cpp
        VkPhysicalDeviceProperties properties{};
        vkGetPhysicalDeviceProperties(physicalDevice, &properties);

        VkSamplerCreateInfo samplerInfo{};
        samplerInfo.sType = VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO;
        samplerInfo.magFilter = VK_FILTER_LINEAR;
        samplerInfo.minFilter = VK_FILTER_LINEAR;
        samplerInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_REPEAT;
        samplerInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_REPEAT;
        samplerInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_REPEAT;
        samplerInfo.anisotropyEnable = VK_TRUE;
        samplerInfo.maxAnisotropy = properties.limits.maxSamplerAnisotropy;
        samplerInfo.borderColor = VK_BORDER_COLOR_INT_OPAQUE_BLACK;
        samplerInfo.unnormalizedCoordinates = VK_FALSE;
        samplerInfo.compareEnable = VK_FALSE;
        samplerInfo.compareOp = VK_COMPARE_OP_ALWAYS;
        samplerInfo.mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR;

        if (vkCreateSampler(device, &samplerInfo, nullptr, &textureSampler) != VK_SUCCESS) {
            throw std::runtime_error("failed to create texture sampler!");
        }
```

Filtren och address modes känner du igen från avsnitten ovan: linjär filtrering och repeat, som OpenGL:s `GL_LINEAR`
och `GL_REPEAT`. De övriga fälten:

- `anisotropyEnable` och `maxAnisotropy`: anisotropisk filtrering, begränsad av vad enheten stöder, vilket vi läser
  ur dess properties. Det är en valfri device feature, så den måste slås på när den logiska enheten skapas – i
  `createLogicalDevice()`, `deviceFeatures.samplerAnisotropy = VK_TRUE;` – och `isDeviceSuitable()` bör bara godta
  enheter som har den:

  ```cpp
        VkPhysicalDeviceFeatures supportedFeatures;
        vkGetPhysicalDeviceFeatures(device, &supportedFeatures);

        return indices.isComplete() && extensionsSupported && swapChainAdequate && supportedFeatures.samplerAnisotropy;
  ```

  Att använda anisotropi utan att slå på featuren är ett valideringsfel.
- `borderColor`: används bara med clamp-to-border.
- `unnormalizedCoordinates = VK_FALSE`: koordinaterna går från 0 till 1, inte från 0 till bredden i texlar.
- `compareEnable`: en jämförelse används främst för percentage-closer filtering av shadow maps; avstängd här.
- `mipmapMode`: hur mipnivåer väljs; se *Mipmaps*.

Lägg märke till att samplern inte refererar till någon `VkImage`. Samplern är ett eget objekt som ger ett gränssnitt
för att hämta färger ur en textur. Den kan användas med vilken image du vill, oavsett om den är 1D, 2D eller 3D. Det
skiljer sig från OpenGL, som slår ihop texturbilder och filtrering till ett enda tillstånd. Samplern förstörs i
`cleanup()` med `vkDestroySampler(device, textureSampler, nullptr);`.

Gör nu uppgiften **sampler**: skapa samplern, slå på device featuren och kräv den i `isDeviceSuitable()`. Bilden
ändras fortfarande inte – shadern vet inget om något av detta ännu.
:::
:::d3d12
I OpenGL är det här avsnittet kort: `glGenTextures`, `glBindTexture`, `glTexImage2D` och `glGenerateMipmap`, och
texturen är klar. I Direct3D 12 krävs fler steg, eftersom `glTexImage2D` gör arbete som Direct3D 12 lämnar åt dig:
drivrutinen väljer GPU-minne till texturen, kopierar dina bytes dit via en temporär buffert och ser till att inget
läser texturen innan kopieringen är klar. Enligt D3D12HelloTexture kommer vi att:

1. skapa **texturen** i en *default heap*, minne som bara GPU:n använder;
2. kopiera pixlarna till en **upload heap** och spela in en GPU-kopiering till texturen, sedan en **barrier** som gör
   texturen läsbar för pixel shadern, och köra det arbetet och vänta på det; och
3. skapa en **shader resource view** (SRV) av texturen i en shader-synlig descriptor heap.

### Texturen

Texturen är en resurs precis som vertexbufferten och skapas med `CreateCommittedResource`, men den beskrivs som en
2D-textur och placeras i en annan sorts heap. Den är en ny medlem:

```cpp
    ComPtr<ID3D12Resource> m_texture1;
```

och i lådans block, efter bildinläsningen:

```cpp
        // Describe and create a Texture2D in a default heap (memory only the GPU uses).
        // It starts in the COPY_DEST state: the pixels are copied into it next.
        D3D12_RESOURCE_DESC textureDesc = {};
        textureDesc.MipLevels = 1;
        textureDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
        textureDesc.Width = static_cast<UINT64>(width);
        textureDesc.Height = static_cast<UINT>(height);
        textureDesc.Flags = D3D12_RESOURCE_FLAG_NONE;
        textureDesc.DepthOrArraySize = 1;
        textureDesc.SampleDesc.Count = 1;
        textureDesc.SampleDesc.Quality = 0;
        textureDesc.Dimension = D3D12_RESOURCE_DIMENSION_TEXTURE2D;

        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &textureDesc,
            D3D12_RESOURCE_STATE_COPY_DEST,
            nullptr,
            IID_PPV_ARGS(&m_texture1)));
```

Beskrivningen: en 2D-textur med `width` × `height` texlar, en mipnivå, en array-skiva (`DepthOrArraySize`), ett sample
per texel och formatet `DXGI_FORMAT_R8G8B8A8_UNORM` – fyra 8-bitarskanaler som shadern läser som värden från 0.0 till
1.0, filens bytes oförändrade, som OpenGL:s `GL_RGB`/`GL_RGBA` och kursens swap chain i `R8G8B8A8_UNORM`. Lägg märke
till att vi inte väljer hur texlarna ordnas i minnet: GPU:n använder sin egen ordning för texturer, vilket är ett skäl
till att CPU:n inte bara kan skriva in i den.

Heapen är den här gången en `D3D12_HEAP_TYPE_DEFAULT`-heap. Vertexbufferten ligger i en upload heap, som CPU:n kan
skriva till och som GPU:n läser över bussen varje gång den behöver datan. En default heap är minne som GPU:n läser
snabbt, men som CPU:n inte kan skriva till – pixlarna kommer dit genom en GPU-kopiering. Därför skapas texturen i
tillståndet `D3D12_RESOURCE_STATE_COPY_DEST`: det första som händer med den är en kopiering. (Som i *Hello
Triangle* är heap-egenskaperna en lokal variabel, inte adressen till ett temporärt objekt.)

Gör nu uppgiften **texture**. Bilden ändras inte.

### Ladda upp pixlarna

För att få in pixlarna i default heapen behöver vi en buffert i en upload heap, stor nog för texturen, och en
kopiering. Kopieringen är GPU-arbete, så den spelas in i en command list. Det ändrar slutet av `LoadAssets()` en
aning. Hittills stängdes command listen direkt när den skapats, eftersom det inte fanns något att spela in. Nu får
den stå öppen, och texturuppladdningarna spelas in i den:

```cpp
    // Command lists are created in the recording state. This one stays open: the
    // texture upload below is recorded into it, and it is executed at the end.
```

Upload heapen måste leva tills GPU:n har utfört kopieringen, så den deklareras i själva `LoadAssets()`, före
texturens block:

```cpp
    // Note: ComPtr's are CPU objects, but an upload heap needs to stay in scope until
    // the command list that copies from it has finished executing on the GPU.
    // We will flush the GPU at the end of this method to ensure it is not
    // prematurely destroyed.
    ComPtr<ID3D12Resource> textureUploadHeap1;
```

I blocket, efter `CreateCommittedResource` för texturen:

```cpp
        // The upload heap: a buffer in memory the CPU can write, big enough for the
        // texture's rows as the GPU lays them out (GetRequiredIntermediateSize).
        const UINT64 uploadBufferSize = GetRequiredIntermediateSize(m_texture1.Get(), 0, 1);

        // Create the GPU upload buffer.
        CD3DX12_HEAP_PROPERTIES uploadHeapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC uploadBufferDesc = CD3DX12_RESOURCE_DESC::Buffer(uploadBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &uploadHeapProperties,
            D3D12_HEAP_FLAG_NONE,
            &uploadBufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&textureUploadHeap1)));

        // Copy data to the intermediate upload heap and then schedule a copy
        // from the upload heap to the Texture2D. UpdateSubresources copies the pixels
        // into the upload heap right away (on the CPU), so the image can be freed after
        // it; the GPU copies them into the texture when the command list executes.
        D3D12_SUBRESOURCE_DATA textureData = {};
        textureData.pData = data;
        textureData.RowPitch = width * 4;                          // bytes per row: 4 per pixel
        textureData.SlicePitch = textureData.RowPitch * height;    // bytes in the whole image

        UpdateSubresources(m_commandList.Get(), m_texture1.Get(), textureUploadHeap1.Get(), 0, 0, 1, &textureData);

        // After the copy, the texture is read by the pixel shader.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_texture1.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);
```

Steg för steg:

- `GetRequiredIntermediateSize(m_texture1.Get(), 0, 1)` frågar hur stor uppladdningsbufferten måste vara för
  subresurs 0 (vår enda mipnivå) av texturen. Det kan vara mer än `width * height * 4`: i en buffert som kopieras
  till en textur måste varje rad börja på en multipel av 256 bytes (`D3D12_TEXTURE_DATA_PITCH_ALIGNMENT`). Våra rader
  är 1024 bytes, vilket råkar stämma, men funktionen klarar alla storlekar.
- Uppladdningsbufferten är en vanlig buffert i en upload heap, i tillståndet `GENERIC_READ`, precis som
  vertexbufferten.
- `D3D12_SUBRESOURCE_DATA` beskriver våra pixlar: var de ligger, hur många bytes en rad har (`RowPitch`) och hur många
  hela bilden har (`SlicePitch`).
- `UpdateSubresources` är en hjälpfunktion från `d3dx12.h`. Den räknar ut vilken layout texturens kopiering behöver,
  mappar uppladdningsbufferten och kopierar våra pixlar dit rad för rad – på CPU:n, direkt – och spelar sedan in en
  `CopyTextureRegion` från uppladdningsbufferten till texturen i command listen. Den kopieringen sker på GPU:n först
  när command listen körs.
- Barriären flyttar texturen från `COPY_DEST` till `PIXEL_SHADER_RESOURCE` efter kopieringen, så att pixel shadern
  får läsa den – och först efter kopieringen. Resource barriers känner du igen från backbuffertarna, som flyttas
  mellan `PRESENT` och `RENDER_TARGET` varje bildruta.

Eftersom `UpdateSubresources` redan har kopierat pixlarna till uppladdningsbufferten kan `stbi_image_free(data)` stå
kvar i slutet av blocket. Uppladdningsbufferten måste däremot leva tills GPU:n har utfört kopieringen. Så i slutet av
`LoadAssets()` stänger vi command listen, kör den och väntar:

```cpp
    // Close the command list and execute it to begin the initial GPU setup.
    ThrowIfFailed(m_commandList->Close());
    ID3D12CommandList* ppCommandLists[] = { m_commandList.Get() };
    m_commandQueue->ExecuteCommandLists(_countof(ppCommandLists), ppCommandLists);
```

och i slutet av synkroniseringsblocket, när fencen och dess event finns:

```cpp
        // Wait for the command list to execute; we are reusing the same command
        // list in our main loop but for now, we just want to wait for setup to
        // complete before continuing. Only then may the upload heap go away.
        WaitForPreviousFrame();
```

När `LoadAssets()` returnerar släpps `textureUploadHeap1` – utan risk, eftersom GPU:n är klar med den.

Gör nu uppgiften **upload**: ta bort den tidiga `Close()`, deklarera upload heapen, lägg till uppladdningskoden och
barriären i blocket, och kör och vänta i slutet av `LoadAssets()`. Bilden ändras inte.

### Shader resource view

En shader läser inte en resurs direkt. Den läser den via en *descriptor*, en liten post som anger hur resursen ska
tolkas: här en *shader resource view* (SRV) som säger "en 2D-textur med det här formatet och så här många mipnivåer".
Descriptors känner du igen från backbuffertarnas render target views, som ligger i en RTV-descriptor heap. SRV:er
ligger i en heap av typen `D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV` (constant buffer views, shader resource views och
unordered access views delar en heaptyp), och den här heapen måste vara **shader-synlig** så att shaderprogrammen når
descriptorerna i den – det är RTV-heapen inte. En ny medlem, `ComPtr<ID3D12DescriptorHeap> m_srvHeap;`, skapas i
`LoadPipeline()` bredvid RTV-heapen:

```cpp
        // Describe and create a shader resource view (SRV) heap for the texture.
        // Shader visible: the shaders can read the descriptors in it.
        D3D12_DESCRIPTOR_HEAP_DESC srvHeapDesc = {};
        srvHeapDesc.NumDescriptors = 1;
        srvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV;
        srvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_SHADER_VISIBLE;
        ThrowIfFailed(m_device->CreateDescriptorHeap(&srvHeapDesc, IID_PPV_ARGS(&m_srvHeap)));
```

SRV:n hamnar i heapens första plats, efter barriären i lådans block:

```cpp
        // Describe and create a SRV for the texture, in the first slot of the SRV heap.
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = textureDesc.Format;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MipLevels = 1;
        m_device->CreateShaderResourceView(m_texture1.Get(), &srvDesc, m_srvHeap->GetCPUDescriptorHandleForHeapStart());
```

`D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING` lämnar kanalerna oförändrade till shadern (rött som rött och så vidare).
Viewns format och dimension stämmer med texturen, med dess enda mipnivå.

Gör nu uppgiften **srv**. Bilden ändras fortfarande inte – shadern vet inget om något av detta ännu.
:::

:::opengl
```quiz
`glTexParameteri` och `glTexImage2D` tar inget texturobjekt som argument. Vilken textur ändrar de?
- [ ] Den textur som senast skapades med `glGenTextures`
- [x] Den textur som just nu är bunden till `GL_TEXTURE_2D` (för den aktiva texturenheten), därför kommer `glBindTexture(GL_TEXTURE_2D, texture1)` först
- [ ] Alla texturobjekt på en gång
---
OpenGL är en tillståndsmaskin: funktionerna arbetar på det objekt som är bundet till det target du anger. Genom att binda `texture1` först ställer alla följande `GL_TEXTURE_2D`-anrop in och fyller just den texturen.
```
:::
:::vulkan
```quiz
Varför kopierar `createTextureImage()` först pixlarna till en staging buffer i stället för att skriva dem direkt till imagen?
- [ ] Därför att en staging buffer är det enda sättet att byta layout på en image
- [x] Imagen ligger i device-local-minne med optimal tiling: CPU:n kan i allmänhet inte mappa det minnet och känner inte till texlarnas ordning, så GPU:n kopierar från en host-visible-buffert med `vkCmdCopyBufferToImage`
- [ ] Därför att `stbi_load` returnerar minne som Vulkan inte får läsa
---
Device-local-minne är snabbast för GPU:n men oftast inte host-visible, och `VK_IMAGE_TILING_OPTIMAL` använder en implementationsdefinierad ordning. Kopieringskommandot sköter omflyttningen; layoutövergångarna görs av barriärerna runt det.
```
:::
:::d3d12
```quiz
Varför måste `textureUploadHeap1` leva tills `WaitForPreviousFrame()` i slutet av `LoadAssets()` har returnerat?
- [x] `UpdateSubresources` spelar bara in kopieringen till texturen; GPU:n läser upload heapen när command listen körs, så om den släpps tidigare frigörs minne som GPU:n fortfarande ska läsa
- [ ] Därför att SRV:n pekar på upload heapen, inte på texturen
- [ ] Därför att pixel shadern läser texturen från upload heapen varje bildruta
---
CPU-delen av `UpdateSubresources` (att kopiera pixlarna till upload heapen) sker direkt, därför kan bilden frigöras strax efter. GPU-delen körs senare, när command listen exekveras – och väntan på fencen ser till att den är klar innan `ComPtr`:en går ur scope.
```
:::

## Använda texturer

:::opengl
I de kommande avsnitten använder vi rektangeln som ritas med `glDrawElements` från slutet av kapitlet *Hello
Triangle*. Vi måste tala om för OpenGL hur texturen ska samplas, så vi uppdaterar vertexdatan med
texturkoordinaterna:

```cpp
    float vertices[] = {
        // positions          // colors           // texture coords
         0.5f,  0.5f, 0.0f,   1.0f, 0.0f, 0.0f,   1.0f, 1.0f, // top right
         0.5f, -0.5f, 0.0f,   0.0f, 1.0f, 0.0f,   1.0f, 0.0f, // bottom right
        -0.5f, -0.5f, 0.0f,   0.0f, 0.0f, 1.0f,   0.0f, 0.0f, // bottom left
        -0.5f,  0.5f, 0.0f,   1.0f, 1.0f, 0.0f,   0.0f, 1.0f  // top left
    };
```

Eftersom vi har lagt till ett vertexattribut måste vi återigen tala om det nya vertexformatet för OpenGL: varje
vertex är nu 8 floats – position, färg, texturkoordinater. Stride för alla tre attributen blir `8 * sizeof(float)`,
och texturkoordinaterna börjar efter 6 floats:

```cpp
    // position attribute
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
    // color attribute
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
    // texture coord attribute
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
    glEnableVertexAttribArray(2);
```

Sedan måste vi ändra vertex shadern så att den tar emot texturkoordinaterna som vertexattribut och skickar dem
vidare till fragment shadern:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;
layout (location = 2) in vec2 aTexCoord;

out vec3 ourColor;
out vec2 TexCoord;

void main()
{
    gl_Position = vec4(aPos, 1.0);
    ourColor = aColor;
    TexCoord = vec2(aTexCoord.x, aTexCoord.y);
}
```

Gör nu uppgiften **texture-coords**. Ingenting ändras på skärmen ännu: fragment shadern skriver fortfarande ut
vertexfärgen.

Fragment shadern ska sedan ta emot utvariabeln `TexCoord` som invariabel. Fragment shadern behöver också komma åt
texturobjektet, men hur skickar vi texturobjektet till fragment shadern? GLSL har en inbyggd datatyp för
texturobjekt som kallas *sampler*, med texturtypen som suffix, t.ex. `sampler1D`, `sampler3D` eller i vårt fall
`sampler2D`. Vi kan sedan lägga till en textur i fragment shadern genom att helt enkelt deklarera en
`uniform sampler2D` som vi senare tilldelar vår textur:

```glsl
#version 330 core
out vec4 FragColor;

in vec3 ourColor;
in vec2 TexCoord;

// texture sampler
uniform sampler2D texture1;

void main()
{
    FragColor = texture(texture1, TexCoord);
}
```

För att sampla en texturs färg använder vi GLSL:s inbyggda funktion `texture`, som tar en textursampler som första
argument och motsvarande texturkoordinater som andra. Funktionen `texture` samplar sedan färgvärdet med de
texturparametrar vi ställde in tidigare. Utdata från den här fragment shadern är alltså texturens (filtrerade) färg
vid den (interpolerade) texturkoordinaten.

Nu återstår bara att binda texturen före anropet till `glDrawElements`, så kopplas texturen automatiskt till fragment
shaderns sampler. I renderingsloopen, före `// render container`:

```cpp
        // bind Texture
        glBindTexture(GL_TEXTURE_2D, texture1);
```

Gör nu uppgiften **sample**. Om du har gjort allt rätt ser du lådan på rektangeln – rättvänd, med sin mörka ram längs
kanterna och den mörka diagonala strävan från det nedre vänstra till det övre högra hörnet.

> Vi har aldrig talat om för samplern `texture1` vilken textur den ska använda. En sampler-uniform som aldrig sätts
> har värdet 0, vilket betyder *texturenhet 0* – och det är den enhet `glBindTexture` binder till som standard. Nästa
> avsnitt förklarar texturenheter.

Vi kan också blanda den resulterande texturfärgen med vertexfärgerna. Vi multiplicerar helt enkelt texturfärgen med
vertexfärgen i fragment shadern för att blanda båda färgerna:

```glsl
    FragColor = texture(texture1, TexCoord) * vec4(ourColor, 1.0);
```

Gör nu uppgiften **tint**. Resultatet blir en blandning av vertexens färg och texturens färg: en "funky" låda, gul
uppe till vänster, röd uppe till höger, grön nere till höger och mycket mörkt blå nere till vänster. Att multiplicera
färger behåller, kanal för kanal, bara så mycket av texturen som vertexfärgen släpper igenom: lådans bruna färg har
nästan inget blått, så det blå hörnet blir nästan svart.
:::
:::vulkan
Innan shadern kan sampla texturen behöver den ett sätt att *hitta* den. I OpenGL binder du en textur till en
texturenhet, och sampler-uniformen läser från den enheten. Vulkan har inga texturenheter. Resurser som images och
buffertar når shaderprogrammen via **descriptors**, grupperade i **descriptor sets**. Det kräver tre delar, som
vulkan-tutorial bygger i kapitlen *Descriptor layout and buffer*, *Descriptor pool and sets* och *Combined image
sampler* (där börjar det med en uniform buffer; vi har ingen ännu, så vårt set innehåller bara texturer):

1. en **descriptor set layout** som anger vilka sorters descriptors shaderprogrammen väntar sig på vilka bindningar
   – en del av pipeline layouten;
2. en **descriptor pool** att allokera ett **descriptor set** från, och en uppdatering som pekar setets descriptors
   på vår image view och sampler;
3. bindning av setet i command bufferten före ritningen.

### Descriptor set layout

Den descriptortyp vi behöver är en *combined image sampler*: en image view och en sampler tillsammans, som shadern
ser som en enda `sampler2D` – ungefär som en OpenGL-textur med sina parametrar. I `createDescriptorSetLayout()`:

```cpp
        VkDescriptorSetLayoutBinding samplerLayoutBinding{};
        samplerLayoutBinding.binding = 0;
        samplerLayoutBinding.descriptorCount = 1;
        samplerLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        samplerLayoutBinding.pImmutableSamplers = nullptr;
        samplerLayoutBinding.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;

        std::array<VkDescriptorSetLayoutBinding, 1> bindings = {samplerLayoutBinding};
        VkDescriptorSetLayoutCreateInfo layoutInfo{};
        layoutInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO;
        layoutInfo.bindingCount = static_cast<uint32_t>(bindings.size());
        layoutInfo.pBindings = bindings.data();

        if (vkCreateDescriptorSetLayout(device, &layoutInfo, nullptr, &descriptorSetLayout) != VK_SUCCESS) {
            throw std::runtime_error("failed to create descriptor set layout!");
        }
```

Bindning 0 innehåller en combined image sampler som läses av fragment shadern. (`pImmutableSamplers` skulle kunna baka
in en sampler i layouten; det behöver vi inte.) Layouten är en medlem, `VkDescriptorSetLayout descriptorSetLayout;`,
och den blir en del av pipeline layouten i `createGraphicsPipeline()` – därför skapar `initVulkan()` den före
pipelinen:

```cpp
        pipelineLayoutInfo.setLayoutCount = 1;
        pipelineLayoutInfo.pSetLayouts = &descriptorSetLayout;
```

I `cleanup()` förstörs den med `vkDestroyDescriptorSetLayout(device, descriptorSetLayout, nullptr);`.

Gör nu uppgiften **descriptor-layout**. Bilden ändras inte.

### Descriptor pool och descriptor set

Descriptor sets kan inte skapas direkt, de måste allokeras från en pool, precis som command buffers. Poolen anger hur
många descriptors av vilken typ, och hur många sets, den kan dela ut. I `createDescriptorPool()`:

```cpp
        std::array<VkDescriptorPoolSize, 1> poolSizes{};
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[0].descriptorCount = 1;

        VkDescriptorPoolCreateInfo poolInfo{};
        poolInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO;
        poolInfo.poolSizeCount = static_cast<uint32_t>(poolSizes.size());
        poolInfo.pPoolSizes = poolSizes.data();
        poolInfo.maxSets = 1;

        if (vkCreateDescriptorPool(device, &poolInfo, nullptr, &descriptorPool) != VK_SUCCESS) {
            throw std::runtime_error("failed to create descriptor pool!");
        }
```

vulkan-tutorial allokerar ett set per frame in flight, eftersom dess uniform buffer ändras varje bildruta. Den här
kursen renderar en bildruta i taget och vårt set ändras aldrig, så **ett** set räcker: `maxSets = 1`. I
`createDescriptorSets()` allokerar vi det och fyller i dess descriptor:

```cpp
        VkDescriptorSetAllocateInfo allocInfo{};
        allocInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO;
        allocInfo.descriptorPool = descriptorPool;
        allocInfo.descriptorSetCount = 1;
        allocInfo.pSetLayouts = &descriptorSetLayout;

        if (vkAllocateDescriptorSets(device, &allocInfo, &descriptorSet) != VK_SUCCESS) {
            throw std::runtime_error("failed to allocate descriptor sets!");
        }

        VkDescriptorImageInfo imageInfo{};
        imageInfo.imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        imageInfo.imageView = textureImageView;
        imageInfo.sampler = textureSampler;

        std::array<VkWriteDescriptorSet, 1> descriptorWrites{};

        descriptorWrites[0].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        descriptorWrites[0].dstSet = descriptorSet;
        descriptorWrites[0].dstBinding = 0;
        descriptorWrites[0].dstArrayElement = 0;
        descriptorWrites[0].descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        descriptorWrites[0].descriptorCount = 1;
        descriptorWrites[0].pImageInfo = &imageInfo;

        vkUpdateDescriptorSets(device, static_cast<uint32_t>(descriptorWrites.size()), descriptorWrites.data(), 0, nullptr);
```

Setet allokeras med vår layout. `VkDescriptorImageInfo` anger image viewn, samplern och den layout imagen kommer att
ha när shadern läser den – den layout vår sista barrier flyttade den till. En `VkWriteDescriptorSet` skriver detta
till setets bindning 0, och `vkUpdateDescriptorSets` utför skrivningen.

Till sist binder `recordCommandBuffer()` setet, efter `vkCmdBindIndexBuffer`:

```cpp
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &descriptorSet, 0, nullptr);
```

Till skillnad från vertex- och indexbuffertar är descriptor sets inte unika för grafikpipelines, så vi anger bind
point. Sedan kommer den pipeline layout som setets layout hör till, index för det första setet (0), antalet sets och
själva seten, och en array med dynamiska offsets som vi inte använder. Poolen och setet är medlemmar
(`VkDescriptorPool descriptorPool; VkDescriptorSet descriptorSet;`); `cleanup()` förstör poolen med
`vkDestroyDescriptorPool(device, descriptorPool, nullptr);`, vilket även frigör setet.

Gör nu uppgiften **descriptor-set**. Bilden ändras fortfarande inte: shadern samplar inte ännu.

### Texturkoordinater

Nu behöver vertexarna texturkoordinater. `Vertex` får en tredje medlem, `glm::vec2 texCoord;`, och
`getAttributeDescriptions()` returnerar tre beskrivningar (`std::array<VkVertexInputAttributeDescription, 3>`), den
nya för location 2:

```cpp
        attributeDescriptions[2].binding = 0;
        attributeDescriptions[2].location = 2;
        attributeDescriptions[2].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[2].offset = offsetof(Vertex, texCoord);
```

Varje hörn av rektangeln får sitt hörn av bilden. Kom ihåg att Vulkans y-axel pekar nedåt, så vertexen med y = -0.5
ligger överst, och att (0, 0) är bildens övre vänstra hörn:

```cpp
    {{-0.5f, -0.5f, 0.0f}, {1.0f, 1.0f, 0.0f}, {0.0f, 0.0f}}, // top left: yellow
    {{0.5f, -0.5f, 0.0f}, {1.0f, 0.0f, 0.0f}, {1.0f, 0.0f}},  // top right: red
    {{0.5f, 0.5f, 0.0f}, {0.0f, 1.0f, 0.0f}, {1.0f, 1.0f}},   // bottom right: green
    {{-0.5f, 0.5f, 0.0f}, {0.0f, 0.0f, 1.0f}, {0.0f, 1.0f}}   // bottom left: blue
```

Vertex shadern skickar dem vidare:

```glsl
#version 450

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inColor;
layout(location = 2) in vec2 inTexCoord;

layout(location = 0) out vec3 fragColor;
layout(location = 1) out vec2 fragTexCoord;

void main() {
    gl_Position = vec4(inPosition, 1.0);
    fragColor = inColor;
    fragTexCoord = inTexCoord;
}
```

Som i vulkan-tutorial gör vi dem först synliga: fragment shadern deklarerar `layout(location = 1) in vec2
fragTexCoord;` och skriver ut dem som färg, `outColor = vec4(fragTexCoord, 0.0, 1.0);`.

Gör nu uppgiften **texture-coords**. Rektangeln visar koordinaterna som färger – rött för u, grönt för v: svart uppe
till vänster, rött uppe till höger, gult nere till höger och grönt nere till vänster. Att visualisera data med färger
är shaderprogrammeringens motsvarighet till `printf`-felsökning, i brist på bättre alternativ.

### Sampling

En combined image sampler-descriptor representeras i GLSL av en sampler-uniform. Lägg till en referens till den i
fragment shadern:

```glsl
#version 450

layout(binding = 0) uniform sampler2D texSampler;

layout(location = 0) in vec3 fragColor;
layout(location = 1) in vec2 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = texture(texSampler, fragTexCoord);
}
```

`layout(binding = 0)` är bindning 0 i descriptor setet (set 0 när inget `set` anges) – vår combined image sampler.
Texturer samplas med den inbyggda funktionen `texture`. Den tar en sampler och en koordinat som argument. Samplern
sköter automatiskt filtreringen och transformationerna i bakgrunden. Utdata är texturens (filtrerade) färg vid den
(interpolerade) texturkoordinaten.

Gör nu uppgiften **sample**. Du ser lådan på rektangeln – rättvänd, med sin mörka ram längs kanterna och den mörka
diagonala strävan från det nedre vänstra till det övre högra hörnet.

Vi kan också blanda den resulterande texturfärgen med vertexfärgerna, som learnopengl gör. Vi multiplicerar helt
enkelt texturfärgen med vertexfärgen i fragment shadern:

```glsl
    outColor = texture(texSampler, fragTexCoord) * vec4(fragColor, 1.0);
```

Gör nu uppgiften **tint**. Resultatet blir en "funky" låda, gul uppe till vänster, röd uppe till höger, grön nere
till höger och mycket mörkt blå nere till vänster. Att multiplicera färger behåller, kanal för kanal, bara så mycket
av texturen som vertexfärgen släpper igenom: lådans bruna färg har nästan inget blått, så det blå hörnet blir nästan
svart.
:::
:::d3d12
Innan shadern kan sampla texturen behöver den ett sätt att *hitta* den. I OpenGL binder du en textur till en
texturenhet, och sampler-uniformen läser från den enheten. Direct3D 12 har inga texturenheter: allt en shader läser
utöver vertexdatan går via **root signaturen**. I kapitlet *Shaders* använde du *root constants*; för en textur
behöver vi två andra saker:

- en **descriptor table**: en root parameter som pekar på ett intervall av descriptors i en shader-synlig descriptor
  heap – vår SRV. Tabellen kopplar dem till shaderregister: SRV:er till `t`-register (`t0`, `t1`, …);
- en **sampler**, som kopplas till ett `s`-register. Den enklaste sorten är en *static sampler*: den beskrivs inuti
  själva root signaturen och behöver varken descriptor eller heap.

### Root signature

Root signature-blocket i `LoadAssets()` får båda:

```cpp
    // Create the root signature: what the shaders read besides the vertices.
    {
        // Root parameter 0: a descriptor table with one range of SRVs - 1 SRV,
        // starting at register t0. Only the pixel shader reads it.
        CD3DX12_DESCRIPTOR_RANGE ranges[1];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0);

        CD3DX12_ROOT_PARAMETER rootParameters[1];
        rootParameters[0].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_PIXEL);

        // A static sampler is part of the root signature itself (no descriptor needed).
        // Sampler s0: linear filtering; texture coordinates outside 0..1 wrap around.
        D3D12_STATIC_SAMPLER_DESC samplers[1] = {};
        samplers[0].Filter = D3D12_FILTER_MIN_MAG_MIP_LINEAR;
        samplers[0].AddressU = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressV = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressW = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].MipLODBias = 0;
        samplers[0].MaxAnisotropy = 0;
        samplers[0].ComparisonFunc = D3D12_COMPARISON_FUNC_NEVER;
        samplers[0].BorderColor = D3D12_STATIC_BORDER_COLOR_TRANSPARENT_BLACK;
        samplers[0].MinLOD = 0.0f;
        samplers[0].MaxLOD = D3D12_FLOAT32_MAX;
        samplers[0].ShaderRegister = 0;
        samplers[0].RegisterSpace = 0;
        samplers[0].ShaderVisibility = D3D12_SHADER_VISIBILITY_PIXEL;

        CD3DX12_ROOT_SIGNATURE_DESC rootSignatureDesc;
        rootSignatureDesc.Init(_countof(rootParameters), rootParameters, _countof(samplers), samplers, D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT);
```

`ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0)` är ett intervall med 1 SRV som börjar på register `t0`.
`InitAsDescriptorTable` gör root parameter 0 till en tabell med det enda intervallet, synlig bara för pixel shadern.
Static samplern `s0` använder filtret och address modes från avsnitten ovan – linjär och wrap, som OpenGL:s
`GL_LINEAR` och `GL_REPEAT`. `MaxLOD = D3D12_FLOAT32_MAX` tillåter alla mipnivåer (vi har bara en);
jämförelsefunktionen används bara av jämförande samplers för shadow maps, och kantfärgen bara med address mode border.
`Init` får nu både parametrarna och samplerna.

Tabellen är bara en beskrivning; command listen måste också ange *var* i vilken heap tabellen börjar. I
`PopulateCommandList()`, efter `SetGraphicsRootSignature`:

```cpp
    // The SRV heap the descriptor table points into, and root parameter 0: the
    // table, starting at the heap's first descriptor.
    ID3D12DescriptorHeap* ppHeaps[] = { m_srvHeap.Get() };
    m_commandList->SetDescriptorHeaps(_countof(ppHeaps), ppHeaps);
    m_commandList->SetGraphicsRootDescriptorTable(0, m_srvHeap->GetGPUDescriptorHandleForHeapStart());
```

`SetDescriptorHeaps` anger de shader-synliga heaps som GPU:n läser descriptors från (högst en CBV/SRV/UAV-heap och en
sampler-heap åt gången). `SetGraphicsRootDescriptorTable(0, …)` sätter root parameter 0 till ett *GPU*-descriptor
handle – heapens första descriptor, vår SRV. Lägg märke till skillnaden: när SRV:n skapades användes ett CPU-handle
(där CPU:n skriver descriptorn), tabellen använder ett GPU-handle (där GPU:n läser den). Båda anropen görs varje
bildruta, eftersom en återställd command list börjar utan heaps och root-argument.

Gör nu uppgiften **root-signature**. Bilden ändras fortfarande inte: shaderprogrammen läser inte texturen ännu.

### Texturkoordinater

Nu behöver vertexarna texturkoordinater. `Vertex` får en tredje medlem, `XMFLOAT2 texCoord;`, och input layouten ett
tredje element, 24 bytes in i vertexen (efter 3 + 3 floats):

```cpp
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

Stride, `sizeof(Vertex)`, växer av sig själv till 32 bytes. Varje hörn av rektangeln får sitt hörn av bilden – med
(0, 0) i bildens övre vänstra hörn:

```cpp
        // Define the four corners of a rectangle, each with its own colour and texture
        // coordinates. Direct3D's texture coordinates start at the image's top left
        // corner (0, 0); (1, 1) is its bottom right corner.
        Vertex vertices[] =
        {
            // position               color                  texture coords
            { { 0.5f, 0.5f, 0.0f },   { 1.0f, 0.0f, 0.0f },  { 1.0f, 0.0f } },    // top right: red
            { { 0.5f, -0.5f, 0.0f },  { 0.0f, 1.0f, 0.0f },  { 1.0f, 1.0f } },    // bottom right: green
            { { -0.5f, -0.5f, 0.0f }, { 0.0f, 0.0f, 1.0f },  { 0.0f, 1.0f } },    // bottom left: blue
            { { -0.5f, 0.5f, 0.0f },  { 1.0f, 1.0f, 0.0f },  { 0.0f, 0.0f } }     // top left: yellow
        };
```

I `shaders.hlsl` får `PSInput` raden `float2 texCoord : TEXCOORD;`, och vertex shadern skickar koordinaterna vidare:

```hlsl
PSInput VSMain(float4 position : POSITION, float4 color : COLOR, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = position;
    result.color = color;
    result.texCoord = texCoord;

    return result;
}
```

Gör nu uppgiften **texture-coords**. Ingenting ändras på skärmen ännu: pixel shadern returnerar fortfarande
vertexfärgen.

### Sampling

I HLSL är en textur och en sampler två separata objekt, deklarerade på de register som root signaturen kopplar dem
till. Överst i `shaders.hlsl`:

```hlsl
// The texture: register t0, in the descriptor table of root parameter 0.
Texture2D texture1 : register(t0);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);
```

och pixel shadern samplar texturen:

```hlsl
    // The texture's colour at the texture coordinates.
    return texture1.Sample(wrapSampler, input.texCoord);
```

`Sample` är en metod hos texturobjektet som tar samplern och texturkoordinaterna. Den returnerar texturens
(filtrerade) färg vid den (interpolerade) texturkoordinaten. Där GLSL:s `sampler2D` slår ihop textur och
samplingsregler håller HLSL isär dem, precis som root signaturen gör.

Gör nu uppgiften **sample**. Du ser lådan på rektangeln – rättvänd, med sin mörka ram längs kanterna och den mörka
diagonala strävan från det nedre vänstra till det övre högra hörnet.

Vi kan också blanda den resulterande texturfärgen med vertexfärgerna, som learnopengl gör. Vi multiplicerar helt
enkelt texturfärgen med vertexfärgen i pixel shadern:

```hlsl
    // The texture's colour at the texture coordinates, tinted with the vertex colour.
    return texture1.Sample(wrapSampler, input.texCoord) * input.color;
```

Gör nu uppgiften **tint**. Resultatet blir en "funky" låda, gul uppe till vänster, röd uppe till höger, grön nere
till höger och mycket mörkt blå nere till vänster. Att multiplicera färger behåller, kanal för kanal, bara så mycket
av texturen som vertexfärgen släpper igenom: lådans bruna färg har nästan inget blått, så det blå hörnet blir nästan
svart.
:::

:::opengl
```quiz
Före uppgiften texture-units sätter programmet aldrig uniformen `texture1`. Varför samplar fragment shadern ändå lådan?
- [x] En sampler-uniform som inte satts är 0, vilket betyder texturenhet 0 – den aktiva enheten som standard, där `glBindTexture` band lådan
- [ ] `glBindTexture` sätter alla sampler-uniforms i det aktiva programmet till den bundna texturen
- [ ] `texture()` läser alltid den textur som skapades senast
---
Samplers refererar till texturenheter, inte till texturobjekt. Enhet 0 är aktiv som standard, så när lådan binds och samplern får vara 0 hör de ihop. Med två texturer måste du sätta samplerna själv.
```
:::
:::vulkan
```quiz
Hur når `layout(binding = 0) uniform sampler2D texSampler;` i `shader.frag` lådan?
- [x] Via bindning 0 i det descriptor set som binds med `vkCmdBindDescriptorSets`: en combined image sampler-descriptor som pekar på `textureImageView` och `textureSampler`
- [ ] Via vertexattributet på location 0
- [ ] Via texturenhet 0, som imagen binds till när den skapas
---
Descriptor set layouten deklarerar bindning 0 som en combined image sampler, `vkUpdateDescriptorSets` skriver in viewn och samplern, och när setet binds som set 0 blir det synligt för shadern.
```
:::
:::d3d12
```quiz
Hur når `Texture2D texture1 : register(t0);` i `shaders.hlsl` lådans textur?
- [ ] Via den ordning texturerna skapades i med `CreateCommittedResource`
- [x] Root parameter 0 är en descriptor table vars SRV-intervall börjar på t0; `SetGraphicsRootDescriptorTable` pekar den på SRV-heapens första descriptor, SRV:n för `m_texture1`
- [ ] Static samplern s0 innehåller texturen
---
Registret kopplar shadern till root signaturen, tabellen kopplar root signaturen till en plats i den shader-synliga heapen, och SRV:n där beskriver texturresursen.
```
:::

## Texturenheter

:::opengl
Du har säkert undrat varför variabeln av typen `sampler2D` är en uniform när vi inte ens har gett den något värde med
`glUniform`. Med `glUniform1i` kan vi faktiskt ge textursamplern ett *location*-värde, så att vi kan använda flera
texturer samtidigt i en fragment shader. En sådan texturs location kallas oftast *texturenhet* (texture unit).
Standardenheten för en textur är `0`, som är den aktiva texturenheten som standard, så vi behövde inte ange någon
location i förra avsnittet.

Huvudsyftet med texturenheter är att vi ska kunna använda mer än en textur i våra shaders. Genom att tilldela
samplerna texturenheter kan vi binda flera texturer samtidigt, så länge vi först aktiverar motsvarande texturenhet.
Precis som med `glBindTexture` aktiverar vi texturenheter med `glActiveTexture`, som tar den texturenhet vi vill
använda. Efter att en texturenhet har aktiverats binder ett efterföljande `glBindTexture`-anrop texturen till den
aktiva texturenheten. Texturenheten `GL_TEXTURE0` är alltid aktiv som standard, så vi behövde inte aktivera någon
texturenhet i det förra exemplet när vi använde `glBindTexture`.

> OpenGL ska ha minst 16 texturenheter som du kan aktivera med `GL_TEXTURE0` till `GL_TEXTURE15`. De är definierade i
> ordning, så vi kan till exempel få `GL_TEXTURE8` via `GL_TEXTURE0 + 8`, vilket är praktiskt när vi behöver loopa
> över flera texturenheter.

Vi måste dock fortfarande ändra fragment shadern så att den tar emot en sampler till. Det borde vara ganska enkelt
nu:

```glsl
#version 330 core
out vec4 FragColor;

in vec3 ourColor;
in vec2 TexCoord;

// texture samplers
uniform sampler2D texture1;
uniform sampler2D texture2;

void main()
{
    // linearly interpolate between both textures (80% container, 20% awesomeface)
    FragColor = mix(texture(texture1, TexCoord), texture(texture2, TexCoord), 0.2);
}
```

Den slutliga färgen är nu en kombination av två texturuppslag. GLSL:s inbyggda funktion `mix` tar två värden och
interpolerar linjärt mellan dem utifrån sitt tredje argument. Är det tredje värdet `0.0` returneras det första
värdet; är det `1.0` returneras det andra. Värdet `0.2` ger 80 % av den första färgen och 20 % av den andra, alltså
en blandning av båda texturerna. (Tonen från vertexfärgen är borta igen.)

Nu vill vi läsa in och skapa en till textur; stegen bör vara bekanta vid det här laget. Se till att skapa ett nytt
texturobjekt, läsa in bilden och skapa den färdiga texturen med `glTexImage2D`. Till den andra texturen använder vi
en bild av ditt ansiktsuttryck medan du lär dig OpenGL:

```cpp
    // load image, create texture and generate mipmaps
    data = stbi_load("awesomeface.png", &width, &height, &nrChannels, 0);
    if (data)
    {
        // note that the awesomeface.png has transparency and thus an alpha channel, so make sure to tell OpenGL the data type is of GL_RGBA
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);
    }
```

Lägg märke till att vi nu läser in en `.png`-bild med en alfakanal (genomskinlighet). Det betyder att vi måste ange
att bilddatan också innehåller en alfakanal, med `GL_RGBA`; annars tolkar OpenGL bilddatan fel. Före detta skapas och
ställs det andra texturobjektet in precis som det första: `unsigned int texture1, texture2;` deklarerar båda, och
`glGenTextures(1, &texture2);`, `glBindTexture` och samma fyra `glTexParameteri`-anrop kommer före inläsningen.
Vändningsinställningen i `stb_image.h` gäller fortfarande, så även ansiktet blir rättvänt.

För att använda den andra texturen (och den första) måste vi ändra renderingen lite genom att binda båda texturerna
till respektive texturenhet:

```cpp
        // bind textures on corresponding texture units
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, texture1);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, texture2);
```

Vi måste också tala om för OpenGL vilken texturenhet varje sampler i shadern hör till, genom att sätta varje sampler
med `glUniform1i`. Det behöver bara göras en gång, så vi kan göra det innan vi går in i renderingsloopen:

```cpp
    // tell opengl for each sampler to which texture unit it belongs to (only has to be done once)
    // -------------------------------------------------------------------------------------------
    ourShader.use(); // don't forget to activate/use the shader before setting uniforms!
    ourShader.setInt("texture1", 0);
    ourShader.setInt("texture2", 1);
```

Genom att sätta samplerna med `glUniform1i` (som `setInt` anropar) ser vi till att varje sampler-uniform motsvarar
rätt texturenhet. Kom ihåg att också ta bort den andra texturen i slutet: `glDeleteTextures(1, &texture2);`.

Gör nu uppgiften **texture-units**.
:::
:::vulkan
I OpenGL låter *texturenheter* en shader använda mer än en textur samtidigt: du binder varje textur till sin egen
enhet och talar om för varje sampler-uniform vilken enhet den ska läsa. I Vulkan sköts samma jobb av descriptor
setets **bindningar**: varje bindning är en plats för en descriptor, och shadern anger vilken bindning den läser. För
att använda en andra textur lägger vi till en andra bindning – inget globalt "aktiv enhet"-tillstånd är inblandat.

Den andra texturen behöver allt som den första har: en image, dess minne och en view (nya medlemmar
`faceTextureImage`, `faceTextureImageMemory` och `faceTextureImageView`). Projektet ger den en egen funktion,
`createFaceTextureImage()`, som anropas direkt efter `createTextureImage()`. Den är en kopia av
`createTextureImage()` som läser in den andra filen till den andra imagen – ungefär som learnopengl upprepar
texturblocket för sin andra textur:

```cpp
        stbi_uc* pixels = stbi_load("textures/awesomeface.png", &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);
```

`awesomeface.png` har en egen alfakanal; med `STBI_rgb_alpha` kommer båda bilderna ändå fram som RGBA, så samma
format, `VK_FORMAT_R8G8B8A8_UNORM`, fungerar för båda. `createTextureImageView()` skapar den andra viewn:

```cpp
        faceTextureImageView = createImageView(faceTextureImage, VK_FORMAT_R8G8B8A8_UNORM);
```

Vi behöver ingen andra sampler: en sampler hör inte till en image, så samma `textureSampler` kan läsa båda.
Descriptor set layouten får en andra bindning, `faceSamplerLayoutBinding` – samma som den första men med
`binding = 1` – och arrayen innehåller båda:

```cpp
        std::array<VkDescriptorSetLayoutBinding, 2> bindings = {samplerLayoutBinding, faceSamplerLayoutBinding};
```

Poolen måste nu ha plats för två combined image samplers (`poolSizes[0].descriptorCount = 2;`), och
`createDescriptorSets()` skriver den andra, med en egen image info:

```cpp
        VkDescriptorImageInfo faceImageInfo{};
        faceImageInfo.imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        faceImageInfo.imageView = faceTextureImageView;
        faceImageInfo.sampler = textureSampler;

        std::array<VkWriteDescriptorSet, 2> descriptorWrites{};
```

och en andra skrivning, `descriptorWrites[1]`, för `dstBinding = 1` med `pImageInfo = &faceImageInfo`. Ansiktets
view, image och minne förstörs i `cleanup()` bredvid lådans.

I fragment shadern är ansiktet bindning 1, och de två färgerna blandas:

```glsl
layout(binding = 0) uniform sampler2D texSampler;
layout(binding = 1) uniform sampler2D faceSampler;
```

```glsl
    // 80% container, 20% face
    outColor = mix(texture(texSampler, fragTexCoord), texture(faceSampler, fragTexCoord), 0.2);
```

GLSL:s inbyggda funktion `mix` tar två värden och interpolerar linjärt mellan dem utifrån sitt tredje argument. Är det
tredje värdet `0.0` returneras det första värdet; är det `1.0` returneras det andra. Värdet `0.2` ger 80 % av den
första färgen och 20 % av den andra, alltså en blandning av båda texturerna. (Tonen från vertexfärgen är borta igen.)

Gör nu uppgiften **texture-units**.
:::
:::d3d12
I OpenGL låter *texturenheter* en shader använda mer än en textur samtidigt: du binder varje textur till sin egen
enhet och talar om för varje sampler-uniform vilken enhet den ska läsa. I Direct3D 12 sköts samma jobb av
**register** och descriptor table: tabellen täcker ett intervall av descriptors i heapen, och var och en är ett
register, `t0`, `t1`, … För att använda en andra textur lägger vi dess SRV direkt efter den första och låter tabellen
täcka två descriptors.

Först själva den andra texturen. Den går igenom exakt samma steg som lådan, i ett andra block efter lådans, som läser
in den andra filen till en ny medlem `ComPtr<ID3D12Resource> m_texture2`:

```cpp
        unsigned char* data = stbi_load("awesomeface.png", &width, &height, &nrChannels, 4);
```

Den behöver en egen upload heap, deklarerad bredvid den första så att den också lever tills väntan i slutet av
`LoadAssets()`:

```cpp
    ComPtr<ID3D12Resource> textureUploadHeap1;
    ComPtr<ID3D12Resource> textureUploadHeap2;
```

SRV-heapen får plats för två descriptors (`srvHeapDesc.NumDescriptors = 2;`), och ansiktets SRV hamnar i den
**andra** platsen. Descriptors ligger bredvid varandra i en heap, men storleken på en descriptor beror på GPU:n, så vi
frågar enheten efter den i `LoadPipeline()` och sparar den i en ny medlem `UINT m_srvDescriptorSize`:

```cpp
        m_srvDescriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV);
```

Handlet för plats 1 är heapens början plus en descriptor:

```cpp
        // The SRV goes into the second slot of the SRV heap (descriptor 1), right after
        // the container's: the descriptor table's t0 and t1.
        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Format = textureDesc.Format;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MipLevels = 1;
        CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(m_srvHeap->GetCPUDescriptorHandleForHeapStart(), 1, m_srvDescriptorSize);
        m_device->CreateShaderResourceView(m_texture2.Get(), &srvDesc, srvHandle);
```

Till sist täcker descriptor-intervallet två SRV:er, `t0` och `t1`:

```cpp
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);
```

`SetGraphicsRootDescriptorTable` pekar fortfarande på heapens början: tabellen läser nu två descriptors därifrån. Vi
behöver ingen andra sampler – en sampler hör inte till en textur, så `s0` kan läsa båda.

Gör nu uppgiften **second-texture**. Bilden ändras inte ännu: shadern läser inte `t1`.

I shadern är ansiktet register `t1`, och de två färgerna blandas:

```hlsl
// The textures: registers t0 and t1, in the descriptor table of root parameter 0.
Texture2D texture1 : register(t0);    // the container
Texture2D texture2 : register(t1);    // the face
```

```hlsl
    // Linearly interpolate between both textures (80% container, 20% face).
    return lerp(texture1.Sample(wrapSampler, input.texCoord), texture2.Sample(wrapSampler, input.texCoord), 0.2f);
```

HLSL:s `lerp` är GLSL:s `mix`: den tar två värden och interpolerar linjärt mellan dem utifrån sitt tredje argument,
`a * (1 - t) + b * t`. Är det tredje värdet `0.0` returneras det första värdet; är det `1.0` returneras det andra.
Värdet `0.2` ger 80 % av den första färgen och 20 % av den andra, alltså en blandning av båda texturerna. (Tonen från
vertexfärgen är borta igen.)

Gör nu uppgiften **texture-units**.
:::

Du ska nu se lådan med en svag smiley ovanpå, med ett rött hjärta på ansiktets högra sida. Titta noga på lådan
*utanför* ansiktet: den är mörkare än förut. Det är ansiktets genomskinliga område som verkar. Blandningen tar med
alla fyra kanalerna, och de genomskinliga pixlarna i `awesomeface.png` är svarta med alfa 0 – ingenting tittar på
alfan, så 20 % svart blandas in i lådan överallt utanför ansiktet. (Blandning med alfakanalen är ämnet för ett senare
kapitel.)

```quiz
Utanför ansiktet är lådan mörkare efter blandningen med 0.2 än den var ensam. Varför?
- [x] Ansiktets genomskinliga pixlar är lagrade som svarta med alfa 0; blandningen bryr sig inte om alfa och blandar in 20 % av det svarta i lådan
- [ ] Ansiktstexturen samplas utanför 0..1 där och returnerar en svart kantfärg
- [ ] En blandning halverar alltid ljusstyrkan hos båda indata
---
En genomskinlig pixel har ändå ett RGB-värde, och i `awesomeface.png` är det svart. För att lämna lådan orörd där ansiktet är genomskinligt kan du använda ansiktets alfa i blandningsvikten – ansiktets `.a` gånger 0.2.
```

## Övningar

För att bli mer bekväm med texturer rekommenderas du att göra de här övningarna innan du går vidare:

1. Se till att bara det glada ansiktet tittar åt andra hållet genom att ändra fragment shadern.
2. Experimentera med de olika wrapping-metoderna genom att ange texturkoordinater från `0.0f` till `2.0f` i stället
   för från `0.0f` till `1.0f`. Se om du kan visa 4 smileys på en enda lådbild som är begränsad (clamped) vid
   kanten.
3. Försök att bara visa mittpixlarna i texturbilden på rektangeln, så att de enskilda pixlarna blir synliga, genom
   att ändra texturkoordinaterna. Prova att ställa in filtreringen på nearest för att se pixlarna tydligare.
4. Använd ett värde som sätts från CPU:n som tredje parameter till mix-funktionen för att variera hur mycket de två
   texturerna syns. Använd upp- och nedpilarna för att ändra hur mycket av lådan eller smileyn som syns.

Övning 1, 2 och 4 är kapitlets sista uppgifter; övning 3 är ett extra experiment. Uppgifterna bygger på varandra, så
programmet du slutar med har ett speglat ansikte, upplägget med repeat/clamp och den justerbara blandningen.

### Vänd på ansiktet

Ansiktet tittar åt andra hållet om dess textur speglas horisontellt: sampla den på `1 - u` i stället för `u`. Bara
ansiktets koordinater ändras; lådan behåller sina.

:::opengl
```glsl
    // linearly interpolate between both textures (the face mirrored horizontally)
    FragColor = mix(texture(texture1, TexCoord), texture(texture2, vec2(1.0 - TexCoord.x, TexCoord.y)), 0.2);
```
:::
:::vulkan
```glsl
    outColor = mix(texture(texSampler, fragTexCoord), texture(faceSampler, vec2(1.0 - fragTexCoord.x, fragTexCoord.y)), 0.2);
```
:::
:::d3d12
```hlsl
    // The face is mirrored horizontally: u becomes 1 - u.
    return lerp(texture1.Sample(wrapSampler, input.texCoord), texture2.Sample(wrapSampler, float2(1.0f - input.texCoord.x, input.texCoord.y)), 0.2f);
```
:::

Gör nu uppgiften **flip-face**. Hjärtat flyttar till ansiktets vänstra sida; lådan är oförändrad (strävan går
fortfarande från nedre vänstra till övre högra hörnet).

### Fyra ansikten på en begränsad låda

Med texturkoordinater från 0 till 2 ska ansiktet upprepas 2 × 2 medan lådan begränsas vid sin kant. Det kräver olika
wrapping för de två texturerna.

:::opengl
Byt varje texturkoordinat `1.0f` mot `2.0f`:

```cpp
         0.5f,  0.5f, 0.0f,   1.0f, 0.0f, 0.0f,   2.0f, 2.0f, // top right
         0.5f, -0.5f, 0.0f,   0.0f, 1.0f, 0.0f,   2.0f, 0.0f, // bottom right
        -0.5f, -0.5f, 0.0f,   0.0f, 0.0f, 1.0f,   0.0f, 0.0f, // bottom left
        -0.5f,  0.5f, 0.0f,   1.0f, 1.0f, 0.0f,   0.0f, 2.0f  // top left
```

I OpenGL är wrapping-läget en parameter i varje texturobjekt, så bara lådans två `GL_TEXTURE_WRAP_*`-anrop ändras;
ansiktet behåller `GL_REPEAT`:

```cpp
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE); // note that we set the container wrapping method to GL_CLAMP_TO_EDGE
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
```

Gör nu uppgiften **repeat**. Du ser fyra speglade ansikten, ett i varje fjärdedel. Lådan syns en gång, i halv
storlek, i den **nedre vänstra** fjärdedelen: där går koordinaterna från 0 till 1, eftersom OpenGL:s (0, 0) ligger
nere till vänster. Överallt annars är koordinaterna större än 1 längs minst en axel, så lådans kanttexlar – dess
mörka ram – dras ut över resten av rektangeln.
:::
:::vulkan
Byt varje texturkoordinat `1.0f` mot `2.0f`:

```cpp
    {{-0.5f, -0.5f, 0.0f}, {1.0f, 1.0f, 0.0f}, {0.0f, 0.0f}}, // top left: yellow
    {{0.5f, -0.5f, 0.0f}, {1.0f, 0.0f, 0.0f}, {2.0f, 0.0f}},  // top right: red
    {{0.5f, 0.5f, 0.0f}, {0.0f, 1.0f, 0.0f}, {2.0f, 2.0f}},   // bottom right: green
    {{-0.5f, 0.5f, 0.0f}, {0.0f, 0.0f, 1.0f}, {0.0f, 2.0f}}   // bottom left: blue
```

I Vulkan hör address mode till samplern, inte till imagen, och båda texturerna delar just nu `textureSampler`. Så
lådan får en egen sampler, en ny medlem `VkSampler clampSampler;`, som skapas i `createTextureSampler()` från samma
`samplerInfo` efter `textureSampler`:

```cpp
        // A second sampler for the container: outside 0..1 it repeats the edge texels.
        samplerInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE;
        samplerInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE;
        samplerInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE;

        if (vkCreateSampler(device, &samplerInfo, nullptr, &clampSampler) != VK_SUCCESS) {
            throw std::runtime_error("failed to create texture sampler!");
        }
```

Lådans descriptor använder den – `imageInfo.sampler = clampSampler;` i `createDescriptorSets()` – medan ansiktets
behåller den upprepande `textureSampler`. `cleanup()` förstör den med
`vkDestroySampler(device, clampSampler, nullptr);`.

Gör nu uppgiften **repeat**. Du ser fyra speglade ansikten, ett i varje fjärdedel. Lådan syns en gång, i halv
storlek, i den **övre vänstra** fjärdedelen: där går koordinaterna från 0 till 1, eftersom Vulkans (0, 0) ligger
uppe till vänster. (I OpenGL-versionen av övningen hamnar den i den nedre vänstra fjärdedelen.) Överallt annars är
koordinaterna större än 1 längs minst en axel, så lådans kanttexlar – dess mörka ram – dras ut över resten av
rektangeln.
:::
:::d3d12
Byt varje texturkoordinat `1.0f` mot `2.0f`:

```cpp
            { { 0.5f, 0.5f, 0.0f },   { 1.0f, 0.0f, 0.0f },  { 2.0f, 0.0f } },    // top right: red
            { { 0.5f, -0.5f, 0.0f },  { 0.0f, 1.0f, 0.0f },  { 2.0f, 2.0f } },    // bottom right: green
            { { -0.5f, -0.5f, 0.0f }, { 0.0f, 0.0f, 1.0f },  { 0.0f, 2.0f } },    // bottom left: blue
            { { -0.5f, 0.5f, 0.0f },  { 1.0f, 1.0f, 0.0f },  { 0.0f, 0.0f } }     // top left: yellow
```

I Direct3D hör address mode till samplern, inte till texturen, och båda texturerna använder just nu `s0`. Så lådan
får en andra static sampler, `s1`: root signaturen har nu `D3D12_STATIC_SAMPLER_DESC samplers[2]`, och efter att den
första fyllts i:

```cpp
        // Sampler s1: the same, but coordinates outside 0..1 are clamped to the edge.
        samplers[1] = samplers[0];
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].ShaderRegister = 1;
```

Shadern deklarerar båda samplerna och läser lådan med den begränsande:

```hlsl
// The samplers: registers s0 and s1, the static samplers of the root signature.
SamplerState wrapSampler : register(s0);     // repeats the texture outside 0..1
SamplerState clampSampler : register(s1);    // stretches its edge pixels outside 0..1
```

```hlsl
    return lerp(texture1.Sample(clampSampler, input.texCoord), texture2.Sample(wrapSampler, float2(1.0f - input.texCoord.x, input.texCoord.y)), 0.2f);
```

Gör nu uppgiften **repeat**. Du ser fyra speglade ansikten, ett i varje fjärdedel. Lådan syns en gång, i halv
storlek, i den **övre vänstra** fjärdedelen: där går koordinaterna från 0 till 1, eftersom Direct3D:s (0, 0) ligger
uppe till vänster. (I OpenGL-versionen av övningen hamnar den i den nedre vänstra fjärdedelen.) Överallt annars är
koordinaterna större än 1 längs minst en axel, så lådans kanttexlar – dess mörka ram – dras ut över resten av
rektangeln.
:::

### Bara mittpixlarna

Den här övningen är ingen uppgift. Vill du prova den, gör det när du har klarat den sista uppgiften, och ändra
tillbaka värdena efteråt. Ge rektangeln texturkoordinater som bara täcker en liten del mitt i bilden, till exempel
0.45 till 0.55 längs båda axlarna i stället för 0 till 2. Då dras bara ungefär 26 × 26 texlar ut över hela
rektangeln, och med nearest-filtrering blir var och en av dem ett tydligt synligt block.

:::opengl
För nearest-filtrering sätter du `GL_TEXTURE_MAG_FILTER` till `GL_NEAREST` för texturerna (förminskningsfiltret
spelar ingen roll här: texturen förstoras). Med `GL_LINEAR` flyter samma block mjukt in i varandra.
:::
:::vulkan
För nearest-filtrering sätter du `samplerInfo.magFilter = VK_FILTER_NEAREST;` (förminskningsfiltret spelar ingen roll
här: texturen förstoras). Med `VK_FILTER_LINEAR` flyter samma block mjukt in i varandra.
:::
:::d3d12
För nearest-filtrering sätter du static samplernas `Filter` till `D3D12_FILTER_MIN_MAG_MIP_POINT`. Med
`D3D12_FILTER_MIN_MAG_MIP_LINEAR` flyter samma block mjukt in i varandra.
:::

### Blanda med piltangenterna

Det fasta värdet 0.2 i blandningen blir ett värde som programmet sätter från CPU:n, och upp- och nedpilarna ändrar
det.

:::opengl
I `shader.fs` deklarerar du `uniform float mixValue;` och använder den som tredje argument:

```glsl
    FragColor = mix(texture(texture1, TexCoord), texture(texture2, vec2(1.0 - TexCoord.x, TexCoord.y)), mixValue);
```

I `main.cpp` håller en global variabel värdet, under inställningarna:

```cpp
// stores how much we're seeing of either texture
float mixValue = 0.5f;
```

och renderingsloopen sätter uniformen varje bildruta, efter att shadern aktiverats:

```cpp
        ourShader.use();
        // set the texture mix value in the shader
        ourShader.setFloat("mixValue", mixValue);
```

`processInput` ändrar värdet medan en tangent hålls nere:

```cpp
    if (glfwGetKey(window, GLFW_KEY_UP) == GLFW_PRESS)
    {
        mixValue += 0.001f; // change this value accordingly (might be too slow or too fast based on system hardware)
        if (mixValue >= 1.0f)
            mixValue = 1.0f;
    }
    if (glfwGetKey(window, GLFW_KEY_DOWN) == GLFW_PRESS)
    {
        mixValue -= 0.001f; // change this value accordingly (might be too slow or too fast based on system hardware)
        if (mixValue <= 0.0f)
            mixValue = 0.0f;
    }
```

Värdet ändras med 0.001 för varje bildruta som tangenten är nedtryckt, och det hålls inom intervallet för `mix`.

Gör nu uppgiften **mix-value**.
:::
:::vulkan
En enda float till fragment shadern är ett jobb för *push constants*, som i kapitlet *Shaders*. Fragment shadern
deklarerar blocket och använder det i blandningen:

```glsl
layout(push_constant) uniform PushConstants {
    float mixValue;
} pc;
```

```glsl
    outColor = mix(texture(texSampler, fragTexCoord), texture(faceSampler, vec2(1.0 - fragTexCoord.x, fragTexCoord.y)), pc.mixValue);
```

På C++-sidan: en struct med samma layout ovanför klassen, `struct PushConstants { float mixValue; };`, en medlem
`float mixValue = 0.5f;` och ett push constant range för fragmentsteget i pipeline layouten:

```cpp
        VkPushConstantRange pushConstantRange{};
        pushConstantRange.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;
        pushConstantRange.offset = 0;
        pushConstantRange.size = sizeof(PushConstants);
```

med `pipelineLayoutInfo.pushConstantRangeCount = 1;` och `pipelineLayoutInfo.pPushConstantRanges =
&pushConstantRange;`. `recordCommandBuffer()` skickar värdet efter att descriptor setet har bundits:

```cpp
        PushConstants constants{};
        constants.mixValue = mixValue;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);
```

En ny `processInput()`, som anropas i `mainLoop()` efter `glfwPollEvents()`, ändrar värdet medan en tangent hålls
nere:

```cpp
    void processInput() {
        if (glfwGetKey(window, GLFW_KEY_UP) == GLFW_PRESS) {
            mixValue += 0.001f; // per frame: change it if this is too slow or too fast on your machine
            if (mixValue >= 1.0f) {
                mixValue = 1.0f;
            }
        }
        if (glfwGetKey(window, GLFW_KEY_DOWN) == GLFW_PRESS) {
            mixValue -= 0.001f;
            if (mixValue <= 0.0f) {
                mixValue = 0.0f;
            }
        }
    }
```

Eftersom command bufferten spelas in på nytt varje bildruta syns det nya värdet i nästa bildruta.

Gör nu uppgiften **mix-value**.
:::
:::d3d12
En enda float till pixel shadern är ett jobb för *root constants*, som i kapitlet *Shaders*. Shadern deklarerar dem
som en konstantbuffert på `b0` och använder värdet i blandningen:

```hlsl
// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the pixel
// shader sees them as a constant buffer at register b0.
cbuffer MixConstants : register(b0)
{
    float mixValue;    // how much of the face shows
};
```

```hlsl
    return lerp(texture1.Sample(clampSampler, input.texCoord), texture2.Sample(wrapSampler, float2(1.0f - input.texCoord.x, input.texCoord.y)), mixValue);
```

På C++-sidan: en struct `MixConstants { float mixValue; };` bredvid `Vertex`, en medlem `float m_mixValue = 0.5f;`
och en andra root parameter – descriptor table förblir parameter 0:

```cpp
        CD3DX12_ROOT_PARAMETER rootParameters[2];
        rootParameters[0].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_PIXEL);
        rootParameters[1].InitAsConstants(sizeof(MixConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_PIXEL);
```

`PopulateCommandList()` sätter värdet varje bildruta, efter `RSSetScissorRects`:

```cpp
    // Root parameter 1: the mix value for the pixel shader.
    MixConstants mixConstants = {};
    mixConstants.mixValue = m_mixValue;
    m_commandList->SetGraphicsRoot32BitConstants(1, sizeof(MixConstants) / 4, &mixConstants, 0);
```

Gör nu uppgiften **mix-value**. Ansiktena är mycket starkare vid 0.5.

Tangenterna kommer till fönsterproceduren som `WM_KEYDOWN`-meddelanden, men `WindowProc` är en fri funktion som inte
känner till vår app. Microsofts exempel löser det genom att spara en pekare till appen i fönstrets *user data*. I
`wWinMain`, efter att appen skapats:

```cpp
    // Store a pointer to the app in the window, so WindowProc can pass it the keys.
    SetWindowLongPtr(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(&app));
```

`WindowProc` hämtar tillbaka den med `GetWindowLongPtr` och lämnar varje tangent utom Escape till appen:

```cpp
    // The app that wWinMain stored in the window (nullptr until then).
    D3D12App* pApp = reinterpret_cast<D3D12App*>(GetWindowLongPtr(hWnd, GWLP_USERDATA));

    switch (message)
    {
    case WM_KEYDOWN:
        // Escape closes the window; the app gets the other keys.
        if (wParam == VK_ESCAPE)
        {
            DestroyWindow(hWnd);
        }
        else if (pApp != nullptr)
        {
            pApp->OnKeyDown(static_cast<UINT8>(wParam));
        }
        return 0;
```

och en ny publik metod `void OnKeyDown(UINT8 key);` ändrar värdet:

```cpp
// Up and Down change the mix value, in steps of 0.1 (holding a key repeats it).
void D3D12App::OnKeyDown(UINT8 key)
{
    if (key == VK_UP)
    {
        m_mixValue += 0.1f;
        if (m_mixValue >= 1.0f)
            m_mixValue = 1.0f;
    }
    if (key == VK_DOWN)
    {
        m_mixValue -= 0.1f;
        if (m_mixValue <= 0.0f)
            m_mixValue = 0.0f;
    }
}
```

OpenGL- och Vulkan-versionerna frågar GLFW varje bildruta om en tangent är nedtryckt; Windows skickar i stället ett
meddelande per tangenttryck – och upprepar det medan tangenten hålls nere – så varje meddelande flyttar värdet ett
helt steg på 0.1.

Gör nu uppgiften **mix-keys**.
:::

Vid 0.5 är ansiktena mycket ljusare, och allt utanför dem är hälften så ljust som lådan – till hälften svart. Håll
nere uppåtpilen så tar ansiktena över (vid 1.0 ser du bara ansiktena, svarta där de är genomskinliga); håll nere
nedåtpilen så kommer lådan tillbaka (vid 0.0 finns bara den begränsade lådan kvar).

Grattis – du har texturerat ditt första objekt. I nästa kapitel börjar vi flytta runt det med transformationer.
