# Textrendering

Någon gång under dina grafikäventyr kommer du att vilja rita text i {{api}}. Tvärtemot vad du kanske tror är det allt
annat än enkelt att få en enkel sträng att synas på skärmen med ett lågnivå-API som {{api}}. Bryr du dig inte om att
rendera fler än 128 olika tecken av samma storlek är det förmodligen inte så svårt. Det blir svårt så snart varje
tecken har sin egen bredd, höjd och marginal. Beroende på var du bor kan du också behöva fler än 128 tecken, och tänk om
du vill visa specialsymboler för matematiska uttryck eller noter, eller rendera text uppifrån och ned? När du tänker på
alla dessa komplicerade frågor kring text är det ingen överraskning att det här förmodligen inte hör hemma i ett
lågnivå-API som {{api}}.

Eftersom {{api}} saknar stöd för text är det upp till oss att bygga ett system för att rendera text till skärmen. Det
finns inga grafiska primitiver för tecken, så vi får vara kreativa. Några exempel på tekniker: rita bokstävernas former
som linjer och trianglar, rendera ett typsnitts glyfer till texturer och rita texturerade rektanglar, eller mer exotiska
metoder som räknar på glyfernas kurvor i shadern. Det här kapitlet tar den andra vägen, den som de flesta program tar:
glyferna blir texturer, och varje tecken är en liten texturerad rektangel – precis det som den här delens 2D-spel behöver
för sina menyer och sin livräknare.

## Klassisk textrendering: bitmap-typsnitt

Förr i tiden innebar textrendering att man valde ett typsnitt (eller gjorde ett själv) för sitt program och plockade ut
alla relevanta tecken ur det för att lägga dem i en enda stor textur. En sådan textur, som vi kallar ett
*bitmap-typsnitt* (bitmap font), innehåller alla teckensymboler vi vill använda i förutbestämda områden av texturen.
Typsnittets teckensymboler kallas *glyfer*. Varje glyf har ett eget område av texturkoordinater. När du vill rendera ett
tecken väljer du motsvarande glyf genom att rendera den delen av bitmap-typsnittet på en 2D-rektangel.

Föreställ dig en sådan textur som ett rutnät: 16 tecken per rad, de skrivbara ASCII-tecknen från mellanslag till tilde i
raderna uppifrån och ned, vart och ett i en ruta av samma storlek. För att rita "Hello" ritar du fem rektanglar bredvid
varandra, var och en med texturkoordinaterna för sin bokstavs ruta. Med blending syns inte bitmappens bakgrund, och bara
tecknet hamnar på skärmen.

Metoden har både för- och nackdelar. Den är förhållandevis lätt att implementera, och eftersom bitmap-typsnitt är
förrastrerade är de ganska effektiva. Men den är inte särskilt flexibel. Vill du använda ett annat typsnitt måste du
skapa ett helt nytt bitmap-typsnitt, och systemet är låst till en enda upplösning; zoomar du syns snabbt pixliga kanter.
Dessutom är den begränsad till en liten teckenuppsättning, så utökade tecken eller Unicode är ofta uteslutna.

Metoden var mycket populär förr (och är det fortfarande) eftersom den är snabb och fungerar på alla plattformar, men i
dag finns mer flexibla metoder. En av dem är att ladda TrueType-typsnitt med biblioteket FreeType.

## Modern textrendering: FreeType

FreeType är ett programbibliotek som kan ladda typsnitt, rendera dem till bitmappar och erbjuder stöd för flera
typsnittsrelaterade operationer. Det är ett populärt bibliotek som bland annat används av Mac OS X, Java, PlayStation,
Linux och Android. Det som gör FreeType särskilt attraktivt är att det kan ladda TrueType-typsnitt.

Ett TrueType-typsnitt är en samling glyfer som inte definieras av pixlar eller någon annan icke-skalbar lösning, utan av
matematiska ekvationer (kombinationer av splines). Precis som för vektorbilder kan de rastrerade bilderna av typsnittet
genereras procedurellt för den teckenhöjd du vill ha. Med TrueType-typsnitt kan du enkelt rendera glyfer i olika
storlekar utan kvalitetsförlust. Samma sak gäller OpenType-typsnitt (`.otf`), TrueTypes efterföljare som FreeType läser
lika bra – deras konturer är antingen TrueTypes kvadratiska eller PostScripts kubiska kurvor.

FreeType kan laddas ned från projektets webbplats; du kan välja att kompilera biblioteket själv eller använda ett av de
förkompilerade (på Windows till exempel vcpkg-paketet `freetype`, på Linux distributionens utvecklingspaket för
`libfreetype`). Se till att länka mot `freetype.lib` (eller `-lfreetype`) och att kompilatorn vet var headerfilerna
finns. För ditt projekt:

:::ide clion vscode
Installera FreeType – på Debian och Ubuntu `libfreetype-dev`, på macOS `brew install freetype`, på Windows med [vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview)
`vcpkg install freetype:x64-windows` – och lägg till två rader i slutet av din `CMakeLists.txt`, för det här och alla
senare kapitel:

```text
find_package(Freetype REQUIRED)
target_link_libraries(${PROJECT_NAME} PRIVATE Freetype::Freetype)
```

`find_package` hittar det installerade biblioteket, och att länka mot målet `Freetype::Freetype` lägger till dess
include-mapp och dess bibliotek. Med vcpkg måste CMake använda vcpkg:s toolchain-fil: ge CMake
`-DCMAKE_TOOLCHAIN_FILE=<vcpkg>/scripts/buildsystems/vcpkg.cmake` (i CLion under **CMake options** i profilen, i VS Code
i inställningen `cmake.configureSettings`). Toolchain-filen kopierar då också FreeTypes DLL bredvid ditt program.
:::
:::ide vs rider
Enklast på Windows är [vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview): `vcpkg install freetype:x64-windows` bygger FreeType, och `vcpkg integrate install` (en
gång) gör att varje Visual Studio-projekt hittar biblioteken som vcpkg installerade – Rider bygger samma projekt. Ditt
projekt får då FreeTypes include-mapp och bibliotek av sig självt, och vcpkg kopierar FreeTypes DLL bredvid din `.exe` när du
bygger. Utan vcpkg bygger du FreeType från källkoden med CMake, lägger till dess `include`-mapp bland **Additional Include
Directories**, dess `.lib` bland **Additional Dependencies** (och filens mapp bland **Additional Library
Directories**), och kopierar dess DLL bredvid din `.exe` – programmet skulle inte starta utan den.
:::

Inkludera sedan rätt headers:

```cpp
#include <ft2build.h>
#include FT_FREETYPE_H
```

På grund av hur FreeType är uppbyggt (åtminstone när learnopengl skrevs) kan du inte lägga dess headerfiler i en ny
katalog; de ska ligga i roten av dina include-kataloger. Att inkludera FreeType som `#include <FreeType/ft2build.h>`
orsakar sannolikt flera konflikter mellan headers.

**Kursens typsnitt.** learnopengl använder typsnittet Antonio Bold. Kursen använder **Inter Bold**
(`fonts/Inter-Bold.otf`, nedbantat till de skrivbara ASCII-tecknen), som är fritt under SIL Open Font License 1.1 –
licensen måste följa med typsnittet, så `fonts/OFL.txt` ligger bredvid i projektet. Kursens kontroller har ingen egen
FreeType: de ersätter den med de glyfer som FreeType renderar från det här typsnittet i **48 och 24 pixlar** (storleken
det här kapitlet använder, och den som spelets text använder senare). Med riktig FreeType i ditt program fungerar alla
storlekar.

FreeType laddar TrueType-typsnitten och genererar för varje glyf en bitmappsbild och räknar ut flera mått. Vi kan
plocka ut bitmappsbilderna för att skapa texturer och placera varje glyf rätt med hjälp av de laddade måtten.

För att ladda ett typsnitt behöver vi bara initiera FreeType-biblioteket och ladda typsnittet som ett *face*, som
FreeType kallar det. Här laddar vi typsnittsfilen:

:::opengl
```cpp
    FT_Library ft;
    // All functions return a value different than 0 whenever an error occurred
    if (FT_Init_FreeType(&ft))
    {
        std::cout << "ERROR::FREETYPE: Could not init FreeType Library" << std::endl;
        return -1;
    }

    // load font as face
    FT_Face face;
    if (FT_New_Face(ft, "fonts/Inter-Bold.otf", 0, &face))
    {
        std::cout << "ERROR::FREETYPE: Failed to load font" << std::endl;
        return -1;
    }
```
:::
:::vulkan
```cpp
        FT_Library ft;
        // All functions return a value different than 0 whenever an error occurred
        if (FT_Init_FreeType(&ft)) {
            throw std::runtime_error("ERROR::FREETYPE: Could not init FreeType Library");
        }

        // load font as face
        FT_Face face;
        if (FT_New_Face(ft, "fonts/Inter-Bold.otf", 0, &face)) {
            throw std::runtime_error("ERROR::FREETYPE: Failed to load font");
        }
```

(i `loadFont()`, som `initVulkan()` anropar före `createAtlasImage()`; fel blir undantag, som överallt i
vulkan-tutorials kod)
:::
:::d3d12
```cpp
    FT_Library ft;
    // All functions return a value different than 0 whenever an error occurred
    if (FT_Init_FreeType(&ft))
    {
        throw std::runtime_error("ERROR::FREETYPE: Could not init FreeType Library");
    }

    // load font as face
    FT_Face face;
    if (FT_New_Face(ft, "fonts/Inter-Bold.otf", 0, &face))
    {
        throw std::runtime_error("ERROR::FREETYPE: Failed to load font");
    }
```

(i `LoadGlyphs`, som `LoadAssets` anropar medan setup-command listen är öppen; fel blir undantag, som anropen av
`ThrowIfFailed` överallt annars; `#pragma comment(lib, "freetype.lib")` bredvid de andra biblioteken säger åt Visual
Studio att länka det)
:::

Var och en av FreeType-funktionerna returnerar ett heltal skilt från noll när ett fel har uppstått.

När vi har laddat facet ska vi ange vilken teckenstorlek i pixlar vi vill plocka ut ur det:

```cpp
FT_Set_Pixel_Sizes(face, 0, 48);
```

Funktionen sätter typsnittets bredd- och höjdparametrar. Sätts bredden till 0 räknar facet själv ut bredden utifrån den
angivna höjden. 48 är storleken på typsnittets *em*, den nominella storleken – inte höjden på varje glyf: bokstäver med
uppstaplar och nedstaplar och tecken som parenteser når längre. I Inter Bold med 48 pixlar är den största glyfen
48 × 58 pixlar.

Ett FreeType-face innehåller en samling glyfer. Vi kan göra en av dem till den aktiva glyfen genom att anropa
`FT_Load_Char`. Här väljer vi att ladda glyfen för tecknet 'X':

```cpp
if (FT_Load_Char(face, 'X', FT_LOAD_RENDER))
{
    std::cout << "ERROR::FREETYPE: Failed to load Glyph" << std::endl;
    return -1;
}
```

Genom att ange `FT_LOAD_RENDER` som en av laddningsflaggorna ber vi FreeType skapa en 8-bitars gråskalebitmapp åt oss,
som vi når via `face->glyph->bitmap`.

Glyferna vi laddar med FreeType har dock inte samma storlek (som de hade i bitmap-typsnitt). Bitmappen som FreeType
genererar är precis stor nog att rymma den synliga delen av ett tecken. Bitmappen för punkten '.' är till exempel
mycket mindre än bitmappen för tecknet 'X'. Därför laddar FreeType också flera mått som anger hur stort varje tecken ska
vara och hur det ska placeras.

Föreställ dig en glyf som står på en vågrät linje, *baslinjen* (baseline), linjen som bokstäverna i ett ord står på. En
punkt på baslinjen, *origo* (origin), är där pennan befinner sig när glyfen ritas. Därifrån:

- börjar glyfens bitmapp en bit till höger om origo – det avståndet är den vågräta *bearing*;
- ligger dess överkant ett stycke ovanför baslinjen – den lodräta *bearing*;
- har bitmappen en bredd och en höjd; för bokstäver som 'p' och 'g' hänger en del av den under baslinjen;
- och pennan flyttas vidare till nästa glyfs origo med *advance*, som inkluderar mellanrummet mellan glyferna.

Var och en av dessa egenskaper finns i FreeTypes glyf:

| Egenskap | FreeType | Betydelse |
|---|---|---|
| width | `face->glyph->bitmap.width` | bitmappens bredd (i pixlar) |
| height | `face->glyph->bitmap.rows` | bitmappens höjd (i pixlar) |
| bearingX | `face->glyph->bitmap_left` | den vågräta bearing: avståndet från origo till bitmappens vänsterkant |
| bearingY | `face->glyph->bitmap_top` | den lodräta bearing: avståndet från baslinjen till bitmappens överkant |
| advance | `face->glyph->advance.x` | den vågräta advance: avståndet från det här origo till nästa, i 1/64 pixlar |

Vi skulle kunna ladda en glyf, hämta dess mått och skapa en textur varje gång vi vill rendera ett tecken, men det vore
ineffektivt att göra det i varje bildruta. Hellre sparar vi de genererade data någonstans i programmet och hämtar dem
när vi vill rendera ett tecken. Vi definierar en praktisk struct som vi lagrar i en `std::map`.

:::opengl
```cpp
struct Character {
    unsigned int TextureID; // ID handle of the glyph texture
    glm::ivec2   Size;      // Size of glyph
    glm::ivec2   Bearing;   // Offset from baseline to left/top of glyph
    unsigned int Advance;   // Horizontal offset to advance to next glyph
};

std::map<GLchar, Character> Characters;
```
:::
:::vulkan
```cpp
struct Character {
    glm::ivec2   AtlasOffset; // where the glyph's bitmap is in the atlas (pixels, top-left corner)
    glm::ivec2   Size;        // Size of glyph
    glm::ivec2   Bearing;     // Offset from baseline to left/top of glyph
    unsigned int Advance;     // Horizontal offset to advance to next glyph
};

std::map<char, Character> Characters;
```

learnopengls struct sparar ID:t för varje glyfs egen textur. Vulkan-projektet lägger i stället alla glyfer i en enda
bild (se nedan), så `AtlasOffset` – var glyfen finns i den bilden – tar texturens ID:s plats.
:::
:::d3d12
```cpp
struct Character {
    XMINT2       AtlasPos;  // Top-left texel of the glyph's bitmap in the atlas
    XMINT2       Size;      // Size of glyph
    XMINT2       Bearing;   // Offset from baseline to left/top of glyph
    unsigned int Advance;   // Horizontal offset to advance to next glyph
};

std::map<char, Character> Characters;
```

learnopengls struct sparar ID:t för varje glyfs egen textur. Direct3D 12-projektet lägger i stället alla glyfer i en
enda textur (se nedan), så `AtlasPos` – var glyfen finns i den texturen – tar texturens ID:s plats.
:::

I det här kapitlet håller vi det enkelt och begränsar oss till de första 128 tecknen i ASCII-uppsättningen. För varje
tecken skapar vi en textur och sparar dess relevanta data i en `Character`-struct som vi lägger till i `Characters`.
På så sätt sparas allt som behövs för att rendera varje tecken till senare. (Kursens typsnitt innehåller bara de
skrivbara tecknen 32 till 126; för de andra ger FreeType tillbaka typsnittets tomma "saknad glyf", som programmet
laddar men aldrig ritar.)

Gör nu den första uppgiften, **freetype**: inkludera FreeType, initiera det, ladda `fonts/Inter-Bold.otf` som ett face,
sätt storleken till 48 pixlar och frigör facet och biblioteket när glyferna har laddats – med glyferna emellan, som nästa
uppgift fyller i:

```cpp
FT_Done_Face(face);
FT_Done_FreeType(ft);
```

Bygg och kör: fortfarande bara rensningsfärgen, (0.2, 0.3, 0.3), och ingenting skrivs ut – ingenting ritas ännu.

:::opengl
### En textur per glyf

learnopengl skapar en textur för varje glyf: i for-loopen laddar den, för vart och ett av de 128 tecknen, glyfen och
skapar en textur av dess bitmapp.

```cpp
    // disable byte-alignment restriction
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);

    // load first 128 characters of ASCII set
    for (unsigned char c = 0; c < 128; c++)
    {
        // Load character glyph
        if (FT_Load_Char(face, c, FT_LOAD_RENDER))
        {
            std::cout << "ERROR::FREETYPE: Failed to load Glyph" << std::endl;
            continue;
        }
        // generate texture
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);
        glTexImage2D(
            GL_TEXTURE_2D,
            0,
            GL_RED,
            face->glyph->bitmap.width,
            face->glyph->bitmap.rows,
            0,
            GL_RED,
            GL_UNSIGNED_BYTE,
            face->glyph->bitmap.buffer
        );
        // set texture options
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        // now store character for later use
        Character character = {
            texture,
            glm::ivec2(face->glyph->bitmap.width, face->glyph->bitmap.rows),
            glm::ivec2(face->glyph->bitmap_left, face->glyph->bitmap_top),
            static_cast<unsigned int>(face->glyph->advance.x)
        };
        Characters.insert(std::pair<char, Character>(c, character));
    }
    glBindTexture(GL_TEXTURE_2D, 0);
```

I for-loopen går vi igenom alla 128 tecken i ASCII-uppsättningen och hämtar deras glyfer. För varje tecken skapar vi en
textur, sätter dess inställningar och sparar dess mått. Värt att notera är att vi använder `GL_RED` som texturens
argument `internalFormat` och `format`. Bitmappen som genereras från glyfen är en 8-bitars gråskalebild där varje färg
representeras av en enda byte. Därför vill vi lagra varje byte i bitmappsbuffern som texturens enda färgvärde. Det gör
vi genom att skapa en textur där varje byte motsvarar färgens röda komponent (första byten i färgvektorn). Använder vi
en enda byte för att representera texturens färger måste vi däremot ta hänsyn till en begränsning i OpenGL:

```cpp
glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
```

OpenGL kräver att texturer har en justering (alignment) på 4 byte, det vill säga att storleken alltid är en multipel av
4 byte. Normalt är det inget problem eftersom de flesta texturer har en bredd som är en multipel av 4 och/eller
använder 4 byte per pixel, men eftersom vi nu bara använder en byte per pixel kan texturen ha vilken bredd som helst.
Mer exakt: OpenGL förväntar sig att varje *rad* i bilddata börjar på en multipel av 4 byte. En glyf som är 13 pixlar
bred har rader på 13 byte, och med standardjusteringen skulle OpenGL läsa 16 byte per rad – varje rad efter den första
förskjuten lite mer, glyfen snedvriden till skräp. Genom att sätta unpack-justeringen till 1 ser vi till att det inte
blir några justeringsproblem (som kan orsaka segmenteringsfel).

Se till att frigöra FreeTypes resurser när du har bearbetat glyferna – därför kommer `FT_Done_Face` och
`FT_Done_FreeType` efter loopen.
:::
:::vulkan
### En atlas för alla glyfer

learnopengl skapar en liten `GL_RED`-textur per glyf – 128 texturer – och binder glyfens textur före varje tecken som
ritas. I Vulkan är varje textur en bild, dess minne, en image view och en deskriptor (set) som ett ritanrop binder; 128
av varje, och en annan descriptor set bunden före varje tecken, vore väldigt många objekt för lite text. Dessutom kan en
bild inte ha bredden eller höjden 0 – och mellanslaget, som saknar synliga pixlar, har en bitmapp på 0 × 0. Därför
lägger Vulkan-program oftast alla glyfer i **en enda bild, en glyfatlas**: det klassiska bitmap-typsnittets idé, fylld
från typsnittet av FreeType under körning. Varje teckens rektangel samplar då sin egen rektangel av den enda bilden, och
en enda descriptor set räcker för all text.

Projektets atlas är 1024 × 512 pixlar: ett rutnät med 16 × 8 rutor på 64 × 64 (`ATLAS_CELL`), glyf `c` i ruta
(c % 16, c / 16). Med 48 pixlar är Inter Bolds största glyf 48 × 58, så varje glyf ryms i sin ruta, och den tomma kanten
runt varje ruta hindrar det linjära filtret från att blanda in en granne. `loadFont()` kopierar varje bitmapp till sin
ruta, rad för rad:

```cpp
        // load first 128 characters of ASCII set
        for (unsigned char c = 0; c < 128; c++) {
            // Load character glyph
            if (FT_Load_Char(face, c, FT_LOAD_RENDER)) {
                std::cout << "ERROR::FREETYTPE: Failed to load Glyph" << std::endl;
                continue;
            }
            // copy the glyph's bitmap (one byte per pixel, rows `pitch` bytes apart) into its cell of the atlas
            glm::ivec2 offset((c % 16) * ATLAS_CELL, (c / 16) * ATLAS_CELL);
            for (unsigned int row = 0; row < face->glyph->bitmap.rows; row++) {
                memcpy(&atlasPixels[(offset.y + row) * ATLAS_WIDTH + offset.x], &face->glyph->bitmap.buffer[row * face->glyph->bitmap.pitch], face->glyph->bitmap.width);
            }
            // now store character for later use
            Character character = {
                offset,
                glm::ivec2(face->glyph->bitmap.width, face->glyph->bitmap.rows),
                glm::ivec2(face->glyph->bitmap_left, face->glyph->bitmap_top),
                static_cast<unsigned int>(face->glyph->advance.x)
            };
            Characters.insert(std::pair<char, Character>(c, character));
        }
```

En FreeType-bitmapp har en byte per pixel, men raderna ligger `bitmap.pitch` byte isär, vilket kan vara mer än dess
bredd – därför går kopieringen rad för rad. `createAtlasImage()` (finns redan i projektet och anropas efter
`loadFont()`) laddar upp `atlasPixels` en gång via en staging buffer till en bild med formatet
**`VK_FORMAT_R8_UNORM`**: en 8-bitarskanal, som shadern läser som `.r` från 0.0 till 1.0 – OpenGL:s `GL_RED`. Det finns
ingen unpack-justering att ställa in: kopieringens `bufferRowLength` 0 säger åt Vulkan att raderna i buffern ligger tätt
packade. Samplern är linjär med `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`, learnopengls inställningar.

(Stavfelet `FREETYTPE` i felmeddelandet är learnopengls eget.)
:::
:::d3d12
### En atlas för alla glyfer

learnopengl skapar en liten `GL_RED`-textur per glyf – 128 texturer – och binder glyfens textur före varje tecken som
ritas. I Direct3D 12 är varje textur en resurs med eget minne, en upload buffer, en barriär och en deskriptor i heapen;
128 av varje, och en descriptor-tabell satt före varje tecken, vore väldigt många objekt för lite text. Dessutom kan en
textur med bredden eller höjden 0 inte skapas alls – och mellanslaget, som saknar synliga pixlar, har en bitmapp på
0 × 0. Därför lägger Direct3D-program oftast alla glyfer i **en enda textur, en glyfatlas**: det klassiska
bitmap-typsnittets idé, fylld från typsnittet av FreeType under körning. Varje teckens rektangel samplar då sin egen
rektangel av den enda texturen, en enda descriptor-tabell räcker för all text, och glyferna kan ritas tillsammans.

Projektets atlas är 1024 × 512 texlar: ett rutnät med 16 × 8 rutor på 64 × 64, tecken c i ruta (c % 16, c / 16). Med
48 pixlar är Inter Bolds största glyf 48 × 58, så varje glyf ryms i sin ruta, och den tomma kanten runt varje ruta
hindrar det linjära filtret från att blanda in en granne:

```cpp
const UINT AtlasCellSize = 64;
const UINT AtlasWidth = 16 * AtlasCellSize;
const UINT AtlasHeight = 8 * AtlasCellSize;
```

`LoadGlyphs` kopierar varje bitmapp till sin ruta i en array på CPU-sidan, rad för rad:

```cpp
    // The atlas's texels on the CPU, one byte each, all 0 (nothing covered) to begin with.
    std::vector<unsigned char> atlas(AtlasWidth * AtlasHeight, 0);

    // load first 128 characters of ASCII set
    for (unsigned char c = 0; c < 128; c++)
    {
        // Load character glyph
        if (FT_Load_Char(face, c, FT_LOAD_RENDER))
        {
            OutputDebugStringA("ERROR::FREETYPE: Failed to load Glyph\n");
            continue;
        }

        // the glyph's cell in the atlas: 16 characters a row
        int cellX = (c % 16) * AtlasCellSize;
        int cellY = (c / 16) * AtlasCellSize;

        // copy the bitmap into the cell row by row (a row of the bitmap is pitch bytes
        // long, a row of the atlas AtlasWidth bytes)
        for (unsigned int row = 0; row < face->glyph->bitmap.rows; row++)
        {
            memcpy(&atlas[(cellY + row) * AtlasWidth + cellX],
                face->glyph->bitmap.buffer + row * face->glyph->bitmap.pitch,
                face->glyph->bitmap.width);
        }

        // now store character for later use
        Character character = {
            XMINT2(cellX, cellY),
            XMINT2(face->glyph->bitmap.width, face->glyph->bitmap.rows),
            XMINT2(face->glyph->bitmap_left, face->glyph->bitmap_top),
            static_cast<unsigned int>(face->glyph->advance.x)
        };
        Characters.insert(std::pair<char, Character>(c, character));
    }
```

En FreeType-bitmapp har en byte per pixel, men raderna ligger `bitmap.pitch` byte isär, vilket kan vara mer än dess
bredd – därför går kopieringen rad för rad. Efter FreeType-anropen blir atlasen en textur på samma sätt som varje textur
i kursen: en `Texture2D`-resurs med formatet **`DXGI_FORMAT_R8_UNORM`** i en default heap – en 8-bitarskanal, som
shadern läser som `.r` från 0.0 till 1.0, learnopengls `GL_RED` –, en upload buffer på `GetRequiredIntermediateSize`,
`UpdateSubresources` med `RowPitch = AtlasWidth` (en byte per texel: ingen justering att bry sig om – learnopengls
`GL_UNPACK_ALIGNMENT 1`; `UpdateSubresources` lägger ut raderna så som GPU:n vill ha dem), barriären från `COPY_DEST`
till `PIXEL_SHADER_RESOURCE` och shader resource viewn i plats 1 i CBV/SRV-heapen. Root signaturens statiska sampler är
linjär och klämd (clamp), learnopengls `GL_CLAMP_TO_EDGE`.
:::

Gör nu uppgiften **glyphs**: lägg till structen `Character` och mappen `Characters`, och ladda de 128 tecknen.
:::opengl
Kör programmet: fortfarande ingenting på skärmen – texturerna finns, men ingenting ritar dem.
:::
:::vulkan
Kör programmet: fortfarande ingenting på skärmen – atlasen innehåller nu glyferna, men ingenting samplar den.
:::
:::d3d12
Uppgiften skapar också atlastexturen och dess vy, som beskrivs ovan. Kör programmet: fortfarande ingenting på skärmen –
atlasen innehåller nu glyferna, men ingenting samplar den.
:::

:::opengl
```quiz
Varför anropar projektet `glPixelStorei(GL_UNPACK_ALIGNMENT, 1)` innan glyferna laddas upp?
- [ ] Därför att `GL_RED`-texturer bara kan skapas med justeringen 1
- [ ] För att glyferna ska filtreras utan att blöda in i varandra
- [ ] Därför att FreeTypes bitmappar lagras med nedersta raden först
- [x] Därför att en glyfs rader är lika många byte långa som den är bred; med standardjusteringen 4 skulle OpenGL vänta sig att varje rad börjar på en multipel av 4 byte och läsa bitmappen snedvriden
---
Justeringen beskriver de data du laddar upp, inte texturen. RGBA-bilder (4 byte per pixel) märker aldrig av den; bilder med en byte per pixel och udda bredd gör det.
```
:::
:::vulkan
```quiz
Varför lägger Vulkan-projektet alla glyfer i en enda atlasbild i stället för learnopengls en textur per glyf?
- [ ] Därför att Vulkan-bilder måste vara minst 1024 pixlar breda
- [x] Därför att varje textur skulle behöva sin egen bild, sitt minne, sin vy och sin descriptor set, bunden före varje tecken – och mellanslagets bitmapp på 0 × 0 kan inte vara en bild alls; en atlas behöver en av varje
- [ ] Därför att `VK_FORMAT_R8_UNORM` bara stöds för stora bilder
- [ ] Därför att FreeType bara kan rendera till en atlas
---
Det är bitmap-typsnittets gamla idé – en textur, en rektangel per glyf – med bitmapparna gjorda av FreeType under körning. Stora program bygger sina atlaser efter behov och lägger till glyfer allteftersom texten behöver dem.
```
:::
:::d3d12
```quiz
Varför lägger Direct3D 12-projektet alla glyfer i en enda atlastextur i stället för learnopengls en textur per glyf?
- [x] Därför att varje textur skulle behöva sin egen resurs, upload buffer, barriär och deskriptor, och en tabell satt före varje tecken – och mellanslagets bitmapp på 0 × 0 kan inte vara en textur alls; en atlas behöver en av varje
- [ ] Därför att Direct3D 12 bara tillåter en textur per descriptor heap
- [ ] Därför att `DXGI_FORMAT_R8_UNORM` bara stöds för stora texturer
- [ ] Därför att FreeType bara kan rendera till en atlas
---
Det är bitmap-typsnittets gamla idé – en textur, en rektangel per glyf – med bitmapparna gjorda av FreeType under körning. Det gör det också möjligt att rita en hel rad med ett enda ritanrop, som du ser nedan.
```
:::

## Shaders

För att rendera glyferna använder vi följande vertex shader:

:::opengl
```glsl
#version 330 core
layout (location = 0) in vec4 vertex; // <vec2 pos, vec2 tex>
out vec2 TexCoords;

uniform mat4 projection;

void main()
{
    gl_Position = projection * vec4(vertex.xy, 0.0, 1.0);
    TexCoords = vertex.zw;
}
```
:::
:::vulkan
```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 projection;
} ubo;

layout(location = 0) in vec4 vertex; // <vec2 pos, vec2 tex>

layout(location = 0) out vec2 TexCoords;

void main() {
    gl_Position = ubo.projection * vec4(vertex.xy, 0.0, 1.0);
    TexCoords = vertex.zw;
}
```
:::
:::d3d12
```hlsl
PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = mul(float4(position, 0.0f, 1.0f), projection);
    result.texCoord = texCoord;

    return result;
}
```
:::

Vi slår ihop både position och texturkoordinater till en vertex: en 2D-position och 2D-texturkoordinater. Vertex shadern
multiplicerar koordinaterna med en projektionsmatris och skickar texturkoordinaterna vidare till fragment shadern:

:::opengl
```glsl
#version 330 core
in vec2 TexCoords;
out vec4 color;

uniform sampler2D text;
uniform vec3 textColor;

void main()
{
    // the glyph texture has one channel (red): it is the glyph's coverage, used as alpha
    vec4 sampled = vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r);
    color = vec4(textColor, 1.0) * sampled;
}
```
:::
:::vulkan
```glsl
layout(binding = 1) uniform sampler2D text;

layout(push_constant) uniform PushConstants {
    vec3 textColor;
} pc;

layout(location = 0) in vec2 TexCoords;

layout(location = 0) out vec4 color;

void main() {
    // the glyph's coverage (the atlas's red channel) becomes the alpha: blending keeps the letter, drops the rest
    vec4 sampled = vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r);
    color = vec4(pc.textColor, 1.0) * sampled;
}
```

learnopengls uniform `textColor` är en push constant (`struct PushConstants { glm::vec3 textColor; };`,
fragmentsteget): den ändras från rad till rad, mellan ritanrop i samma command buffer.
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float4 sampled = float4(1.0f, 1.0f, 1.0f, text.Sample(clampSampler, input.texCoord).r);
    return float4(textColor, 1.0f) * sampled;
}
```

learnopengls uniform `textColor` är en root constant (`cbuffer TextConstants : register(b0) { float3 textColor; }`,
root-parameter 0, tre värden): den ändras från rad till rad, mellan ritanrop i samma command list.
:::

Fragment shadern tar två indata: den ena är glyfens enfärgade bitmappsbild, den andra en färg som bestämmer textens
slutliga färg. Först samplar vi bitmapptexturens färgvärde. Eftersom texturens data bara finns i den röda komponenten
samplar vi texturens `r`-komponent som alfavärde. Genom att variera utfärgens alfavärde blir den resulterande pixeln
genomskinlig för glyfens bakgrund och ogenomskinlig för tecknets egna pixlar. Vi multiplicerar också RGB-färgerna med
uniformen `textColor` för att kunna variera textens färg. FreeTypes bitmapp är kantutjämnad: pixlar på en bokstavs kant
är bara delvis täckta och får värden mellan 0 och 255 – deras alfa blandar bokstavens färg mjukt in i bakgrunden.

För att det ska fungera måste vi dock slå på blending:

:::opengl
```cpp
    glEnable(GL_CULL_FACE);
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
```
:::
:::vulkan
```cpp
        colorBlendAttachment.blendEnable = VK_TRUE;
        colorBlendAttachment.srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA;
        colorBlendAttachment.dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA;
```

i pipelinen, tillsammans med back-face culling (`VK_CULL_MODE_BACK_BIT`, `VK_FRONT_FACE_COUNTER_CLOCKWISE` –
learnopengls `glEnable(GL_CULL_FACE)`). Render passet har bara färg-attachmentet: 2D-text behöver ingen djupbuffer.
:::
:::d3d12
```cpp
        psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_INV_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].BlendOp = D3D12_BLEND_OP_ADD;
```

i pipeline staten (med `BlendEnable = TRUE`), och ingen djupbuffer: 2D-text behöver ingen. Culling är avslaget
(`D3D12_CULL_MODE_NONE`): rektanglarna är platta och vända mot betraktaren, så ingenting skulle tas bort i alla fall –
learnopengl slår på back-face culling, vilket med dess moturs rektanglar inte heller ändrar något.
:::

Som projektionsmatris använder vi en ortografisk projektionsmatris. För textrendering behöver vi (oftast) inget
perspektiv, och en ortografisk projektionsmatris låter oss också ange alla vertexkoordinater i skärmkoordinater om vi
ställer in den så här:

:::opengl
```cpp
    glm::mat4 projection = glm::ortho(0.0f, static_cast<float>(SCR_WIDTH), 0.0f, static_cast<float>(SCR_HEIGHT));
```

Vi sätter projektionsmatrisens bottom-parameter till 0.0f och top-parametern till fönstrets höjd. Resultatet blir att vi
anger koordinater med y-värden från skärmens nederkant (0.0f) till dess överkant (600.0f). Det betyder att punkten
(0.0, 0.0) nu motsvarar det nedre vänstra hörnet.
:::
:::vulkan
```cpp
        ubo.projection = glm::ortho(0.0f, static_cast<float>(swapChainExtent.width), static_cast<float>(swapChainExtent.height), 0.0f);
```

i uniform buffern. Det är learnopengls `glm::ortho(0, 800, 0, 600)` med bottom och top ombytta – eftersom Vulkans clip
space har y *nedåt*: y = 0 avbildas nu på clip-y = +1, fönstrets nederkant, och y = 600 på -1, överkanten.
Koordinaterna är learnopengls: y-värdena går från skärmens nederkant (0.0) till dess överkant (600.0), och punkten
(0.0, 0.0) är det nedre vänstra hörnet. (Det är också därför det inte finns något `proj[1][1] *= -1` här: att byta plats
på bottom och top är samma vändning.)
:::
:::d3d12
```cpp
    XMMATRIX projection = XMMatrixOrthographicOffCenterRH(0.0f, static_cast<float>(m_width), 0.0f, static_cast<float>(m_height), -1.0f, 1.0f);
```

skriven till constant buffern (`SceneConstantBuffer`, root-parameter 1) i `OnUpdate`. Direct3D:s clip space har y uppåt
som OpenGL:s, så det här är learnopengls `glm::ortho(0, 800, 0, 600)`: y-värdena går från skärmens nederkant (0.0) till
dess överkant (600.0), och punkten (0.0, 0.0) är det nedre vänstra hörnet.
:::

Sist skapar vi vertex buffern för att rendera rektanglarna. Varje rektangel behöver 6 vertex med 4 floats; vertexen
ändras för varje tecken, så buffern är en som CPU:n skriver om.

:::opengl
```cpp
    glGenVertexArrays(1, &VAO);
    glGenBuffers(1, &VBO);
    glBindVertexArray(VAO);
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(float) * 6 * 4, NULL, GL_DYNAMIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), 0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindVertexArray(0);
```

2D-rektangeln kräver 6 vertex med 4 floats vardera, så vi reserverar minne för `6 * 4` floats. Eftersom vi kommer att
uppdatera VBO:ns minne ganska ofta allokerar vi det med `GL_DYNAMIC_DRAW`.
:::
:::vulkan
Projektet har den redan: en host-visible vertex buffer med plats för `MAX_CHARACTERS` = 256 rektanglar (6 ×
`Vertex { glm::vec4 vertex; }` vardera, attribut 0 med formatet `VK_FORMAT_R32G32B32A32_SFLOAT`), mappad en gång för
hela körningen till `vertexBufferMapped` – learnopengls `GL_DYNAMIC_DRAW`-buffer. Varför den har plats för 256
rektanglar i stället för learnopengls en kommer i nästa avsnitt.
:::
:::d3d12
Buffern är en del av nästa uppgift: `MaxTextVertices` = 6 × 256 vertex av `{ XMFLOAT2 position; XMFLOAT2 texCoord; }`
i en upload heap, mappad en gång för programmets hela livstid till `m_pVertexDataBegin` (som constant buffern), och dess
vy med `StrideInBytes = sizeof(Vertex)` – learnopengls `GL_DYNAMIC_DRAW`-buffer. Varför den har plats för 256
rektanglar i stället för learnopengls en kommer i nästa avsnitt.
:::

```quiz
Textens fragment shader skriver `vec4(textColor, 1.0) * vec4(1.0, 1.0, 1.0, coverage)`. Vad skulle du se om blending var avslaget?
- [ ] Ingenting alls: utan blending kastas fragment med alfa under 1
- [ ] Samma text, bara med hårdare kanter
- [x] Ett heltäckande block per tecken i textens färg: varje pixel i varje rektangel skrivs, också de som glyfen inte täcker
- [ ] Texten i vitt, eftersom alfa bara tillämpas på färgen när blending är på
---
Varje fragments färg är textfärgen; bara alfa säger hur mycket av pixeln glyfen täcker. Blending med SRC_ALPHA / ONE_MINUS_SRC_ALPHA gör det alfavärdet till "så mycket av textfärgen, så mycket av det som ligger bakom".
```

## Rendera en textrad

För att rendera ett tecken hämtar vi motsvarande `Character`-struct ur `Characters` och räknar ut rektangelns mått med
hjälp av tecknets mått. Med de uträknade måtten skapar vi dynamiskt en uppsättning av 6 vertex som vi använder för att
uppdatera innehållet i minnet som vertex buffern förvaltar.

Vi skapar en funktion som heter `RenderText` och som renderar en sträng av tecken:

:::opengl
```cpp
void RenderText(Shader &shader, std::string text, float x, float y, float scale, glm::vec3 color)
{
    // activate corresponding render state
    shader.use();
    glUniform3f(glGetUniformLocation(shader.ID, "textColor"), color.x, color.y, color.z);
    glActiveTexture(GL_TEXTURE0);
    glBindVertexArray(VAO);

    // iterate through all characters
    std::string::const_iterator c;
    for (c = text.begin(); c != text.end(); c++)
    {
        Character ch = Characters[*c];

        float xpos = x + ch.Bearing.x * scale;
        float ypos = y - (ch.Size.y - ch.Bearing.y) * scale;

        float w = ch.Size.x * scale;
        float h = ch.Size.y * scale;
        // update VBO for each character
        float vertices[6][4] = {
            { xpos,     ypos + h,   0.0f, 0.0f },
            { xpos,     ypos,       0.0f, 1.0f },
            { xpos + w, ypos,       1.0f, 1.0f },

            { xpos,     ypos + h,   0.0f, 0.0f },
            { xpos + w, ypos,       1.0f, 1.0f },
            { xpos + w, ypos + h,   1.0f, 0.0f }
        };
        // render glyph texture over quad
        glBindTexture(GL_TEXTURE_2D, ch.TextureID);
        // update content of VBO memory
        glBindBuffer(GL_ARRAY_BUFFER, VBO);
        glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(vertices), vertices); // be sure to use glBufferSubData and not glBufferData

        glBindBuffer(GL_ARRAY_BUFFER, 0);
        // render quad
        glDrawArrays(GL_TRIANGLES, 0, 6);
        // now advance cursors for next glyph (note that advance is number of 1/64 pixels)
        x += (ch.Advance >> 6) * scale; // bitshift by 6 to get value in pixels (2^6 = 64 (divide amount of 1/64th pixels by 64 to get amount of pixels))
    }
    glBindVertexArray(0);
    glBindTexture(GL_TEXTURE_2D, 0);
}
```
:::
:::vulkan
```cpp
    void RenderText(VkCommandBuffer commandBuffer, std::string text, float x, float y, float scale, glm::vec3 color) {
        PushConstants constants{};
        constants.textColor = color;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);

        // iterate through all characters
        std::string::const_iterator c;
        for (c = text.begin(); c != text.end(); c++) {
            Character ch = Characters[*c];

            float xpos = x + ch.Bearing.x * scale;
            float ypos = y - (ch.Size.y - ch.Bearing.y) * scale;

            float w = ch.Size.x * scale;
            float h = ch.Size.y * scale;
            // the glyph's rectangle in the atlas (0..1); its first row (v0) is the top of the glyph
            float u0 = ch.AtlasOffset.x / (float) ATLAS_WIDTH;
            float v0 = ch.AtlasOffset.y / (float) ATLAS_HEIGHT;
            float u1 = (ch.AtlasOffset.x + ch.Size.x) / (float) ATLAS_WIDTH;
            float v1 = (ch.AtlasOffset.y + ch.Size.y) / (float) ATLAS_HEIGHT;
            // the quad of this character
            float vertices[6][4] = {
                { xpos,     ypos + h,   u0, v0 },
                { xpos,     ypos,       u0, v1 },
                { xpos + w, ypos,       u1, v1 },

                { xpos,     ypos + h,   u0, v0 },
                { xpos + w, ypos,       u1, v1 },
                { xpos + w, ypos + h,   u1, v0 }
            };
            // write it after the vertices of the characters drawn before (the GPU reads them when the frame runs)
            memcpy((char*) vertexBufferMapped + vertexCount * sizeof(Vertex), vertices, sizeof(vertices));
            // render quad
            vkCmdDraw(commandBuffer, 6, 1, vertexCount, 0);
            vertexCount += 6;
            // now advance cursors for next glyph (note that advance is number of 1/64 pixels)
            x += (ch.Advance >> 6) * scale; // bitshift by 6 to get value in pixels (2^6 = 64 (divide amount of 1/64th pixels by 64 to get amount of pixels))
        }
    }
```
:::
:::d3d12
```cpp
void D3D12App::RenderText(std::string text, float x, float y, float scale, XMFLOAT3 color)
{
    // activate corresponding render state: the text's colour (root parameter 0)
    TextConstants textConstants = {};
    textConstants.textColor = color;
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(TextConstants) / 4, &textConstants, 0);

    // this line's quads come after the ones already written this frame
    UINT firstVertex = m_textVertexCount;

    // iterate through all characters
    std::string::const_iterator c;
    for (c = text.begin(); c != text.end(); c++)
    {
        Character ch = Characters[*c];

        float xpos = x + ch.Bearing.x * scale;
        float ypos = y - (ch.Size.y - ch.Bearing.y) * scale;

        float w = ch.Size.x * scale;
        float h = ch.Size.y * scale;

        // the glyph's rectangle in the atlas, in texture coordinates (v = 0 is the
        // atlas's top row, where each bitmap's top row is)
        float u0 = static_cast<float>(ch.AtlasPos.x) / AtlasWidth;
        float v0 = static_cast<float>(ch.AtlasPos.y) / AtlasHeight;
        float u1 = static_cast<float>(ch.AtlasPos.x + ch.Size.x) / AtlasWidth;
        float v1 = static_cast<float>(ch.AtlasPos.y + ch.Size.y) / AtlasHeight;

        // the character's quad: two triangles
        Vertex vertices[6] = {
            { XMFLOAT2(xpos,     ypos + h), XMFLOAT2(u0, v0) },
            { XMFLOAT2(xpos,     ypos),     XMFLOAT2(u0, v1) },
            { XMFLOAT2(xpos + w, ypos),     XMFLOAT2(u1, v1) },

            { XMFLOAT2(xpos,     ypos + h), XMFLOAT2(u0, v0) },
            { XMFLOAT2(xpos + w, ypos),     XMFLOAT2(u1, v1) },
            { XMFLOAT2(xpos + w, ypos + h), XMFLOAT2(u1, v0) }
        };

        memcpy(m_pVertexDataBegin + m_textVertexCount * sizeof(Vertex), vertices, sizeof(vertices));
        m_textVertexCount += 6;

        // now advance cursors for next glyph (note that advance is number of 1/64 pixels)
        x += (ch.Advance >> 6) * scale; // bitshift by 6 to get value in pixels (2^6 = 64)
    }

    // render the line's quads
    m_commandList->DrawInstanced(m_textVertexCount - firstVertex, 1, firstVertex, 0);
}
```
:::

Det mesta i funktionen bör vara ganska självförklarande: först räknar vi ut rektangelns utgångsposition (som `xpos` och
`ypos`) och rektangelns storlek (som `w` och `h`) och skapar en uppsättning av 6 vertex som bildar 2D-rektangeln;
observera att vi skalar varje mått med `scale`. (x, y) är baslinjens början, i pixlar från fönstrets nedre vänstra hörn.

Vissa tecken (som 'p' och 'g') renderas en bit under baslinjen, så rektangeln ska också placeras en bit under
`RenderText`s y-värde. Exakt hur mycket `ypos` ska förskjutas under baslinjen kan vi räkna ut ur glyfmåtten: delen av
bitmappen under baslinjen är dess höjd minus dess lodräta bearing, `Size.y - Bearing.y`. För ett tecken som vilar på
baslinjen (som 'X') är det 0; för 'p' är det längden på dess nedstapel. Alltså är `ypos = y - (ch.Size.y -
ch.Bearing.y) * scale` rektangelns nederkant, och `ypos + h` dess överkant.

```quiz
För vilket tecken i "This is sample text" är `ch.Size.y - ch.Bearing.y` tydligt större än 0?
- [ ] 'T', eftersom det är den högsta bokstaven
- [ ] Mellanslaget, eftersom dess bitmapp är tom
- [x] 'p', eftersom en del av dess bitmapp hänger under baslinjen – dess rektangel måste börja så långt under y
- [ ] Varje tecken: värdet är alltid typsnittets radhöjd
---
Höjden minus avståndet från baslinjen till överkanten är delen under baslinjen: 0 för bokstäver som vilar på den, nedstapelns längd för 'p', 'g', 'y'. Utan termen skulle 'p' i "sample" sitta på linjen som ett överstort 'o'.
```

Texturkoordinaterna är "upp och ned": vertexen i rektangelns övre vänstra hörn, (xpos, ypos + h), får det minsta v –
överkanten av glyfens textur (eller av dess rektangel i atlasen) – och det nedre vänstra hörnet det största. En
FreeType-bitmapp börjar med sin *översta* rad, och den laddas upp som den är – så texturens första rad är glyfens
överkant.

:::opengl
När rektangelns vertex är klara binder vi glyfens textur, uppdaterar VBO:ns minne med `glBufferSubData` och ritar
rektangeln – ett ritanrop per tecken. Det går bra i OpenGL: kommandona utförs i ordning, så när nästa tecken skriver
över buffern har det föregående ritanropet (så långt programmet kan se) använt det gamla innehållet. Drivrutinen tar
hand om det, genom att vänta eller genom att ge buffern nytt minne bakom kulisserna.
:::
:::vulkan
**Varför varje rektangel får en egen plats i buffern.** learnopengl skriver om en buffer med 6 vertex med
`glBufferSubData` före varje teckens ritanrop. Det fungerar i OpenGL eftersom kommandona utförs i ordning, och
drivrutinen ser till att ett ritanrop ser buffern som den var när anropet gjordes. En Vulkan-command buffer är
annorlunda: `vkCmdDraw` *spelar bara in* ritanropet, och GPU:n kör det – och läser vertex buffern – efter att command
buffern har skickats iväg, långt efter att `RenderText` har returnerat. Hade varje tecken skrivit på samma plats skulle
alla ritanrop i bildrutan läsa det sista tecknets rektangel. Därför skriver `RenderText` varje teckens 6 vertex **efter**
dem som redan skrivits i bildrutan (vid `vertexCount`, som `recordCommandBuffer` nollställer) och ritar dem med
`vkCmdDraw(commandBuffer, 6, 1, vertexCount, 0)` – den fjärde parametern är den första vertexen. Det är fortfarande ett
ritanrop per tecken, som hos learnopengl. Att skriva buffern igen varje bildruta är säkert eftersom programmet har en
bildruta i farten: `drawFrame` väntar på förra bildrutans fence innan den spelar in.
:::
:::d3d12
**Varför varje rektangel får en egen plats i buffern, och varför ett ritanrop räcker.** learnopengl skriver om en buffer
med 6 vertex med `glBufferSubData` före varje teckens ritanrop. Det fungerar i OpenGL eftersom kommandona utförs i
ordning, och drivrutinen ser till att ett ritanrop ser buffern som den var när anropet gjordes. En Direct3D 12-command
list är annorlunda: `DrawInstanced` *spelar bara in* ritanropet, och GPU:n kör det – och läser vertex buffern – när
listan körs, efter hela `PopulateCommandList`. Hade varje tecken skrivit på samma plats skulle varje glyf ha ritats med
det sista tecknets rektangel. Därför skriver `RenderText` varje teckens rektangel **efter** dem som redan skrivits i
bildrutan (vid `m_textVertexCount`, som `PopulateCommandList` nollställer – GPU:n är klar med förra bildrutan, `OnRender`
väntar på den). Och eftersom alla glyfer finns i en enda atlas ändras ingenting mellan tecknen på en rad: ett enda
`DrawInstanced(6 * tecken, 1, firstVertex, 0)` ritar hela raden.
:::

Till sist flyttar vi x-koordinaten framåt med tecknets advance. Observera att advance är ett antal 1/64 pixlar
(FreeTypes fixpunktsformat 26.6), så vi bitskiftar den 6 steg (`>> 6`, samma som att dela med 2⁶ = 64) för att få
pixlar innan vi skalar den.

```quiz
En glyfs `advance.x` är 1856. Hur långt flyttar `RenderText` pennan med skalan 0.5?
- [ ] 928 pixlar
- [ ] 1856 / 0.5 = 3712 pixlar
- [ ] 58 pixlar
- [x] 14.5 pixlar: 1856 >> 6 = 29 pixlar i den laddade storleken, gånger 0.5
---
Advance är i 1/64 pixlar (fixpunkt 26.6): att skifta 6 steg delar med 64. Skalan tillämpas efteråt, som på varje annat mått.
```

Gör nu uppgiften **render-text**:
:::opengl
VAO/VBO-konfigurationen i `main`, funktionen `RenderText` (och dess deklaration med de globala `VAO, VBO`), och anropet
i renderloopen efter rensningen:

```cpp
        RenderText(shader, "This is sample text", 25.0f, 25.0f, 1.0f, glm::vec3(0.5, 0.8f, 0.2f));
```
:::
:::vulkan
medlemsfunktionen `RenderText`, och i `recordCommandBuffer()`, efter att descriptor seten har bundits:

```cpp
        vertexCount = 0;
        RenderText(commandBuffer, "This is sample text", 25.0f, 25.0f, 1.0f, glm::vec3(0.5, 0.8f, 0.2f));
```
:::
:::d3d12
vertex buffern i `LoadAssets`, `RenderText`, och i `PopulateCommandList`:

```cpp
    m_commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);

    // the text: the vertex buffer is filled from the start again every frame (the GPU
    // has finished the previous frame: OnRender waits for it)
    m_textVertexCount = 0;
    RenderText("This is sample text", 25.0f, 25.0f, 1.0f, XMFLOAT3(0.5f, 0.8f, 0.2f));
```
:::

Bygg och kör: **"This is sample text" i grönt nere till vänster** i fönstret. Titta noga på bokstävernas kanter: de
smälter mjukt in i bakgrunden – FreeTypes kantutjämning. Mellanslagen är också rektanglar, med storleken 0 × 0: de ritar
ingenting, men deras advance flyttar pennan.

:::opengl
```quiz
Raden har 19 tecken. Hur många ritanrop gör `RenderText` för den, och vad behöver vart och ett?
- [ ] Ett, eftersom alla tecken använder samma shader
- [ ] 17, eftersom mellanslagen hoppas över
- [x] 19 – ett per tecken, vart och ett efter att den glyfens textur har bundits och rektangelns 6 vertex skrivits om med `glBufferSubData`
- [ ] 38, två trianglar per tecken
---
Ett ritanrop per tecken är learnopengls enkla sätt. Varje glyf har sin egen textur, så texturen måste bytas mellan tecknen i alla fall; en glyfatlas (som Vulkan- och DirectX 12-versionerna använder) skulle tillåta ett ritanrop per rad.
```
:::
:::vulkan
```quiz
Varför skriver `RenderText` varje teckens rektangel vid `vertexCount` i stället för att skriva över samma 6 vertex som learnopengl?
- [ ] Därför att en mappad buffer bara får skrivas en gång per bildruta
- [ ] Därför att `vkCmdDraw` alltid börjar vid den senast skrivna vertexen
- [ ] Därför att atlasen behöver alla glyfers vertex på en gång
- [x] Därför att `vkCmdDraw` bara spelar in ritanropet: GPU:n läser buffern när den inskickade command buffern körs, efter att `RenderText` har returnerat – alla ritanrop skulle se den sista rektangeln
---
I OpenGL utförs ritanropen i ordning med buffern som den var vid varje anrop. I Vulkan är inspelning och körning åtskilda, så data som ett inspelat kommando läser måste vara oförändrade tills GPU:n har kört det.
```
:::
:::d3d12
```quiz
"This is sample text" har 19 tecken. Hur många ritanrop spelar Direct3D 12-versionens `RenderText` in för den?
- [ ] 19, ett per tecken, som hos learnopengl
- [x] Ett `DrawInstanced` med 114 vertex: varje rektangel har en egen plats i buffern och alla glyfer finns i den enda atlasen, så ingenting ändras mellan tecknen
- [ ] Två, ett per trianglelista av rektanglarna
- [ ] Inga förrän `ExecuteCommandLists`, som ritar varje tecken för sig
---
Färgen (en root constant) sätts en gång per rad. En andra rad är ett andra ritanrop som börjar vid vertex 114.
```
:::

Gör nu uppgiften **second-line**: learnopengls andra rad är en upphovsrättsrad uppe till höger; kursens säger
"(C) Codestead GP":

:::opengl
```cpp
        RenderText(shader, "(C) Codestead GP", 540.0f, 570.0f, 0.5f, glm::vec3(0.3, 0.7f, 0.9f));
```
:::
:::vulkan
```cpp
        RenderText(commandBuffer, "(C) Codestead GP", 540.0f, 570.0f, 0.5f, glm::vec3(0.3, 0.7f, 0.9f));
```
:::
:::d3d12
```cpp
    RenderText("(C) Codestead GP", 540.0f, 570.0f, 0.5f, XMFLOAT3(0.3f, 0.7f, 0.9f));
```
:::

y = 570 ligger nära fönstrets *överkant* – y pekar uppåt i de här koordinaterna. Bygg och kör: en liten **ljusblå rad
uppe till höger**.

:::vulkan
Dess rektanglar hamnar i buffern efter den första radens: 35 ritanrop totalt, 210 vertex. Jämförd pixel för pixel med
OpenGL-versionen ligger den här raden **en pixel högre** (y 11..32 i stället för 12..33): med skalan 0.5 hamnar dess
rektanglars kanter precis på pixelcentrum, och Vulkans top-left-rasteriseringsregel, tillämpad i dess framebuffer med
y nedåt, avgör de lägena åt andra hållet än OpenGL:s i dess med y uppåt.
:::
:::d3d12
Dess rektanglar hamnar i buffern efter den första radens, och dess ritanrop börjar vid vertex 114: två ritanrop totalt
(114 + 96 vertex).
:::

Den andra raden använder samma glyfer på 48 pixlar i halv storlek: `scale` krymper rektanglarna, och det linjära
filtret krymper bitmapparna. Det är learnopengls sätt och fungerar bra för faktorn 0.5, men skalade bitmappar blir
suddiga (eller, uppskalade, blockiga). För en annan storlek laddar ett riktigt program glyferna i den storleken –
spelets text senare i den här delen använder 24 pixlar.

## Att gå vidare

Det här kapitlet visade en teknik för textrendering med TrueType-typsnitt och biblioteket FreeType. Metoden är flexibel,
skalbar och fungerar med många teckenkodningar. Den är dock troligen i överkant för ditt program, eftersom vi skapar och
renderar texturer för varje glyf. Prestandamässigt är bitmap-typsnitt att föredra, eftersom vi bara behöver en textur
för alla glyfer. Bäst vore att kombinera de två metoderna genom att dynamiskt skapa en bitmap-typsnittstextur med alla
glyfer som FreeType har laddat – den atlas som Vulkan- och DirectX 12-versionerna bygger. Det besparar renderaren en
betydande mängd texturbyten och kan, beroende på hur tätt glyferna packas, spara en hel del prestanda.

Ett annat problem med FreeTypes bitmappar är att glyftexturerna lagras i en fast storlek, så kraftig skalning kan ge
taggiga kanter. Dessutom gör rotationer av glyferna att de ser suddiga ut. Det kan mildras genom att i stället för de
rastrerade pixelfärgerna lagra avståndet till närmaste glyfkontur i varje pixel. Tekniken kallas *signed distance
field fonts*, och Valve publicerade för några år sedan en artikel om sin implementation av den, som fungerar förvånansvärt
bra för 3D-program: shadern jämför det interpolerade avståndet med ett tröskelvärde (med `smoothstep` för mjuka kanter),
och en liten textur ger skarpa bokstäver i alla storlekar.

Riktig text har mer än det här kapitlet: *kerning* (par som "AV" som flyttas närmare varandra – FreeType rapporterar det
med `FT_Get_Kerning`), tecken utöver ASCII (Unicode, inlästa i atlasen allteftersom texten behöver dem) och *shaping*
för skriftsystem vars bokstäver ändras med grannarna, vilket bibliotek som HarfBuzz sköter ovanpå FreeType.

## Mer att läsa

- [Text Rendering](https://learnopengl.com/In-Practice/Text-Rendering): learnopengls kapitel som det här kapitlet
  följer, med bilden av glyfmåtten.

:::opengl
- [LearnOpenGL-källkod: text_rendering.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/7.in_practice/2.text_rendering/text_rendering.cpp):
  learnopengls program.
- [glPixelStore](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPixelStore.xhtml): unpack-justeringen och de
  andra lägena för pixellagring.
:::
:::vulkan
- [Texture mapping: Images](https://vulkan-tutorial.com/Texture_mapping/Images): staging buffers, layoutövergångar och
  `vkCmdCopyBufferToImage`, som uppladdningen av atlasen använder.
- [Formats (Vulkan-specifikationen)](https://docs.vulkan.org/spec/latest/chapters/formats.html): `VK_FORMAT_R8_UNORM`
  och de andra formaten.
:::
:::d3d12
- [UpdateSubresources](https://learn.microsoft.com/en-us/windows/win32/direct3d12/updatesubresources2): hjälpfunktionen
  som kopierar atlasen till dess textur.
- [Using constants directly in the root signature](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-constants-directly-in-the-root-signature):
  root constants, textfärgens väg till shadern.
:::
