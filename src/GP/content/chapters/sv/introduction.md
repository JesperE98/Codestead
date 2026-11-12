# Välkommen till grafikprogrammering

Eftersom du har hittat hit vill du förmodligen lära dig hur datorgrafik fungerar: hur ett program får grafikkortet
att rita trianglar, hur trianglarna får färger, texturer och ljus, och hur allt det till slut blir bilderna du ser i
spel, 3D-verktyg och visualiseringar. Att göra det själv lär dig mycket om hur hårdvaran fungerar, och det är
väldigt roligt. Den här kursen tar dig dit steg för steg, från ett tomt fönster till ljussättning, skuggor och
fysikaliskt baserad rendering.

## Vad den här kursen är

Codestead GP följer [learnopengl.com](https://learnopengl.com/) av Joey de Vries, kapitel för kapitel och avsnitt
för avsnitt: samma kapitel, i samma ordning, med samma exempel. Skillnaden är att du kan läsa varje kapitel för ett
av tre grafik-API:er:

- **OpenGL** (3.3 core profile) – text och kod följer learnopengl.com.
- **Vulkan** – text och kod följer [vulkan-tutorial.com](https://vulkan-tutorial.com/) av Alexander Overvoorde.
- **DirectX 12** (Direct3D 12) – text och kod följer Microsofts D3D12HelloWorld-exempel och dokumentationen av
  Direct3D 12 på Microsoft Learn.

Du läser inte bara om grafikprogrammering: varje kapitel har ett projekt som du ändrar, bygger och kör själv, i din
egen IDE på din egen dator. När ett kapitel är slut har du skrivit koden som det handlar om.

## Förkunskaper

Ett grafik-API är inget eget programspråk; du anropar det från ett språk, och språket här är **C++**. Du bör vara
bekväm med C++ innan du börjar: variabler, funktioner, pekare och referenser, structar och klasser, arrayer och
`std::vector`. Kapitlen förklarar den mindre vanliga C++-koden som dyker upp på vägen, och Vulkan-koden använder
några C++17-funktioner (som `std::optional`) som förklaras där de används.

Längre fram behöver du också lite matematik (vektorer och matriser). Du behöver inte kunna den i förväg: kapitlet
*Transformations* går igenom det du behöver, precis som på learnopengl.com.

## Välja API

Högst upp i fönstret väljer du grafik-API: **OpenGL**, **Vulkan** eller **DirectX 12**. Alla tre styr samma
grafikhårdvara och ritar samma bilder, men de skiljer sig mycket i hur mycket de gör åt dig:

| API | Körs på | Hur det är | Vad det kostar att lära sig |
|---|---|---|---|
| OpenGL | Windows, Linux, macOS (föråldrat där, men finns kvar) | Drivrutinen gör det mesta åt dig: minne, synkronisering, att hålla reda på tillstånd | Det enklaste av de tre: den första triangeln tar ungefär 180 rader |
| Vulkan | Windows, Linux, Android (macOS och iOS via ett översättningslager) | Explicit: du beskriver allt själv, och drivrutinen gör nästan ingenting bakom din rygg | Mycket ordrikt: samma triangel tar ungefär 1 000 rader |
| DirectX 12 | Windows och Xbox | Explicit som Vulkan, med Microsofts hjälpstrukturer och verktyg | Mitt emellan: triangeln tar ungefär 500 rader, och du lär dig också lite Windows-programmering |

**OpenGL** är det bästa valet om du är ny inom grafikprogrammering: du ser resultat snabbt och kan koncentrera dig
på idéerna (shaders, texturer, ljus) i stället för bokföringen. **Vulkan** och **DirectX 12** är det som moderna
spelmotorer använder under huven: de ger dig full kontroll över GPU:n och låter dig använda den effektivt från
flera trådar, men du betalar för den kontrollen med mycket mer kod och många fler begrepp innan den första
triangeln syns. Allt du lär dig med ett API kan du ta med dig till de andra – grafikpipelinen, shaders och
matematiken är desamma överallt.

```quiz
Vilket av de tre API:erna körs bara på Microsofts plattformar (Windows och Xbox)?
- [ ] OpenGL
- [ ] Vulkan
- [x] DirectX 12
---
OpenGL och Vulkan är öppna standarder från Khronos Group och körs på många operativsystem. Direct3D 12 är en del av Microsofts DirectX och finns på Windows och Xbox.
```

Kapitlen är desamma för alla tre API:erna. När ett API behöver extra steg (det gör Vulkan och DirectX 12 ofta)
förklarar kapitlet dem; när ett API saknar en motsvarighet till något säger kapitlet det. Du kan byta API när som
helst, även mitt i ett kapitel. Varje API har sina egna projekt och sina egna framsteg: uppgifterna du har gjort i
OpenGL förblir klara när du provar Vulkan, och när du byter tillbaka fortsätter du där du slutade.

:::opengl
Du har valt **OpenGL**. Ett bra val att börja med: du ritar din första triangel om några kapitel och lägger det
mesta av tiden på det som gör grafik intressant.
:::
:::vulkan
Du har valt **Vulkan**. Var beredd på mycket förberedelser innan något syns på skärmen – de närmaste kapitlen bygger
triangelprogrammets ungefär 1 000 rader bit för bit. När den grunden väl finns lägger de senare kapitlen till
funktioner i ungefär samma takt som i OpenGL.
:::
:::d3d12
Du har valt **DirectX 12**. Du sätter först upp ett Win32-fönster, en device, en command queue och en swap chain
innan du kan rita; kapitlen går igenom var och en av dem. När den grunden väl finns lägger de senare kapitlen till
funktioner i ungefär samma takt som i OpenGL.
:::

```quiz
Du har gjort de första kapitlen med OpenGL och byter till Vulkan. Vad händer med dina framsteg i OpenGL?
- [ ] De raderas, eftersom du bara kan följa kursen med ett API
- [ ] De kopieras till Vulkan, så att Vulkan-uppgifterna redan är klara
- [x] De sparas: varje API har sina egna projekt och framsteg, och du kan byta tillbaka när som helst
---
Varje API räknas för sig. Ett byte ändrar bara vilken text, vilket projekt och vilka uppgifter du ser.
```

## Hur kursen är uppbyggd

Kursen är indelad i samma delar som learnopengl.com: *Getting started*, *Lighting*, *Model Loading*,
*Advanced OpenGL*, *Advanced Lighting*, *PBR* och *In Practice*. Varje kapitel bygger på de tidigare, så det är
bäst att följa dem i ordning.

Varje kapitel är en lektion i tre delar:

1. **Texten** (till vänster) förklarar teorin och koden steg för steg, så som learnopengl.com gör. Kodutdragen i
   texten är hämtade ur kapitlets startfiler, så du hittar varje rad igen i ditt projekt.
2. **Frågor** i texten ("Testa dig själv") ser till att du har förstått de viktiga delarna. Svara på dem medan du
   läser: när du har svarat på dem öppnas uppgifterna.
3. **Uppgifterna** (till höger) är koden du skriver – i din egen IDE. Panelen **Ditt projekt** kopplar ihop kapitlet
   med mappen där ditt projekt ligger.

I slutet av de flesta kapitel finns *Mer att läsa*: länkar till den officiella dokumentationen och de
ursprungliga guiderna, om du vill läsa mer.

## Så arbetar du i kursen

Du skriver, bygger och kör koden i en riktig IDE – Visual Studio, CLion, Rider eller Visual Studio Code – med en riktig
kompilator, och ditt program öppnar ett riktigt fönster på din skärm. Appen är din lärobok och din granskare. Kapitlet
*Sätt upp din IDE*, två kapitel härifrån, visar hur du sätter upp IDE:n, kompilatorn och biblioteken för det API du har
valt.

Till höger i varje kapitel finns **uppgifterna**. Varje uppgift är en ändring i projektet: en funktion att anropa, ett
värde att ändra, några rader att lägga till. Texten säger till när det är dags för en uppgift. Om du kör fast kan du
öppna **Tips**. Efter några försök – eller så snart du har öppnat tipset – kan du också visa **lösningen**, koden som
hör hemma där uppgiftens `// TODO:`-kommentar står.

Uppgifterna finns i panelen **Ditt projekt**, tillsammans med allt som kopplar ihop dem med ditt eget projekt:

- **Välj mapp…** väljer mappen för kapitlets projekt på din disk, och **Kopiera startfilerna** kopierar kapitlets filer
  dit: `main.cpp`, och senare även shaders, texturer och modeller. I projekten i de kommande kapitlen visar
  `// TODO:`-kommentarer var din kod ska stå. **Öppna mappen** öppnar mappen, så att du kan öppna den i din IDE.
- När du har skrivit koden för en uppgift **bygger** du programmet och **kör** det från din IDE. Appen håller koll på
  mappen: när den har sett ett nytt bygge och en körning av det kontrollerar den dina källfiler med kursens kontroller
  och bockar av uppgiften – eller säger vad som fortfarande saknas.
- För varje uppgift visar panelen **Förväntat resultat**: en bild av vad ditt programs fönster ska visa när uppgiften
  är klar.

Om din IDE bygger eller kör programmet någonstans där appen inte kan se det (i WSL eller på en annan dator, till
exempel) talar länken **Jag har kört det** om för appen att du har kört det.

```quiz
Du har skrivit koden för en uppgift. Vad får appen att bocka av den? (Välj alla som stämmer.)
- [x] Du bygger programmet i din IDE
- [x] Du kör programmet som du har byggt
- [ ] Du öppnar bilden **Förväntat resultat**
---
Appen väntar på ett nytt bygge och en körning av det, och kontrollerar sedan dina källfiler. Det förväntade resultatet
finns bara där för att jämföras med det ditt program ritar.
```

## Ditt första program

Projektet i det här kapitlet behöver du inte skriva: det är det färdiga *Hello Triangle*-programmet, programmet du
bygger själv under de kommande kapitlen. Det öppnar ett fönster på 800×600, fyller det med en mörkt blågrön färg och
ritar en orange triangel i mitten.

:::opengl
Hela programmet är en enda fil, `main.cpp`: det skapar fönstret med GLFW, laddar OpenGL-funktionerna med GLAD,
kompilerar två små shaders (skrivna som strängar i `main.cpp`), lägger triangelns tre hörn i en buffer och ritar den
i en loop tills du trycker på Escape eller stänger fönstret.
:::
:::vulkan
Programmet består av tre filer. `main.cpp` innehåller klassen `HelloTriangleApplication`, som skapar fönstret med
GLFW och sätter upp Vulkan: en instance, en device, en swap chain, ett render pass, en grafikpipeline, command
buffers och objekten som synkroniserar CPU:n och GPU:n. `shaders/shader.vert` och `shaders/shader.frag` är de två
shaderna, skrivna i GLSL; när du bygger kompileras de till SPIR-V (`shaders/vert.spv` och `shaders/frag.spv`), den
form som Vulkan laddar.
:::
:::d3d12
Programmet består av två filer. `main.cpp` skapar ett Win32-fönster med titeln "LearnDirectX" och sätter upp
Direct3D 12: en device, en command queue, en swap chain, ett pipeline state object, en command list och ett fence.
`shaders.hlsl` innehåller de två shaderna, skrivna i HLSL; `main.cpp` kompilerar dem när programmet startar.
:::

Oroa dig inte om inget av detta säger dig något än – det är det kursen är till för. Se det bara köra för tillfället.

**Du bygger ingenting i det här kapitlet.** Ett sådant program behöver en kompilator, ett byggsystem och några
bibliotek innan det kan köras, och de kommande två kapitlen sätter upp dem: *{{api}}* förklarar API:et, och *Sätt upp
din IDE* tar dig igenom IDE:n, kompilatorn, CMake och biblioteken, med länkar:

:::opengl
- **GLFW** (fönster och inmatning) – [glfw.org](https://www.glfw.org/download.html)
- **GLAD** (laddar OpenGL-funktionerna) – [glad.dav1d.de](https://glad.dav1d.de/)
- senare **GLM** (vektor- och matrisräkning), **stb_image** (läser in bilder), **assimp** (läser in modeller) och
  **FreeType** (typsnitt) – vart och ett i det kapitel som först behöver det
:::
:::vulkan
- **Vulkan SDK** från LunarG (headerfiler, loadern, valideringslagren och shaderkompilatorn `glslc`) –
  [vulkan.lunarg.com](https://vulkan.lunarg.com/)
- **GLFW** (fönster och inmatning) – [glfw.org](https://www.glfw.org/download.html)
- **GLM** (vektor- och matrisräkning) – [github.com/g-truc/glm](https://github.com/g-truc/glm)
:::
:::d3d12
- **Visual Studio** med arbetsbelastningen *Desktop development with C++*, som tar med **Windows SDK** (Direct3D 12,
  DirectXMath och shaderkompilatorn)
- **d3dx12.h**, Microsofts hjälpheader – [github.com/microsoft/DirectX-Headers](https://github.com/microsoft/DirectX-Headers)
:::

*Creating a window* är det första kapitlet där du skriver och bygger kod – först ett fönster, den här triangeln några
kapitel senare. Till dess visar kapitlets **Förväntat resultat** vad programmet ritar.

### Triangelns färg

Varje pixel i triangeln får sin färg från ett litet program som körs på GPU:n: en **shader**. Du lär dig allt om
shaders senare; för tillfället räcker det att hitta den enda rad som bestämmer färgen.

:::opengl
I OpenGL är det **fragment shadern**, skriven i GLSL. I det här programmet ligger den som en sträng i `main.cpp`, i
variabeln `fragmentShaderSource`:

```cpp
const char *fragmentShaderSource = "#version 330 core\n"
    "out vec4 FragColor;\n"
    "void main()\n"
    "{\n"
    "   FragColor = vec4(1.0f, 0.5f, 0.2f, 1.0f);\n"
    "}\n\0";
```

Shadern körs en gång för varje pixel som triangeln täcker. `out vec4 FragColor;` deklarerar dess utdata, och raden
`FragColor = vec4(1.0f, 0.5f, 0.2f, 1.0f);` sätter den: en färg med fyra värden – röd, grön, blå och alfa
(opacitet) – vart och ett från `0.0` till `1.0`. `(1.0, 0.5, 0.2)` är full röd, halv grön och lite blå: orange.

```quiz
Vilken rad gör triangeln helt röd?
- [x] `FragColor = vec4(1.0f, 0.0f, 0.0f, 1.0f);`
- [ ] `FragColor = vec4(255.0f, 0.0f, 0.0f, 255.0f);`
- [ ] `FragColor = vec4(0.0f, 0.0f, 1.0f, 1.0f);`
---
Färgvärden i en shader går från 0.0 till 1.0, i ordningen röd, grön, blå, alfa. 255 är intervallet för 8-bitars pixelvärden, inte för färger i shaders; `(0, 0, 1)` vore blått.
```
:::
:::vulkan
I Vulkan är det **fragment shadern** i `shaders/shader.frag`, skriven i GLSL:

```glsl
#version 450

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(1.0, 0.5, 0.2, 1.0);
}
```

Shadern körs en gång för varje pixel som triangeln täcker. `layout(location = 0) out vec4 outColor;` deklarerar
dess utdata: location 0 är den första (och här enda) color attachment, swap chain-bilden som triangeln ritas i.
Raden `outColor = vec4(1.0, 0.5, 0.2, 1.0);` sätter färgen: fyra värden – röd, grön, blå och alfa (opacitet) –
vart och ett från `0.0` till `1.0`. `(1.0, 0.5, 0.2)` är full röd, halv grön och lite blå: orange.

```quiz
Vilken rad gör triangeln helt röd?
- [ ] `outColor = vec4(255.0, 0.0, 0.0, 255.0);`
- [x] `outColor = vec4(1.0, 0.0, 0.0, 1.0);`
- [ ] `outColor = vec4(0.0, 0.0, 1.0, 1.0);`
---
Färgvärden i en shader går från 0.0 till 1.0, i ordningen röd, grön, blå, alfa. 255 är intervallet för 8-bitars pixelvärden, inte för färger i shaders; `(0, 0, 1)` vore blått.
```
:::
:::d3d12
I Direct3D 12 är det **pixel shadern** `PSMain` i `shaders.hlsl`, skriven i HLSL:

```hlsl
// The pixel shader: runs once per pixel the triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(1.0f, 0.5f, 0.2f, 1.0f);
}
```

Shadern körs en gång för varje pixel som triangeln täcker. Dess returvärde är pixelns färg; semantiken `SV_TARGET`
säger att den går till render target (swap chainens back buffer). Färgen är en `float4` med fyra värden – röd,
grön, blå och alfa (opacitet) – vart och ett från `0.0` till `1.0`. `(1.0, 0.5, 0.2)` är full röd, halv grön och
lite blå: orange.

```quiz
Vilken rad gör triangeln helt röd?
- [ ] `return float4(0.0f, 0.0f, 1.0f, 1.0f);`
- [x] `return float4(1.0f, 0.0f, 0.0f, 1.0f);`
- [ ] `return float4(255.0f, 0.0f, 0.0f, 255.0f);`
---
Färgvärden i en shader går från 0.0 till 1.0, i ordningen röd, grön, blå, alfa. 255 är intervallet för 8-bitars pixelvärden, inte för färger i shaders; `(0, 0, 1)` vore blått.
```
:::

När din IDE är uppsatt kan du komma tillbaka och prova: kopiera kapitlets startfiler, ändra färgen till
`(0.2, 0.8, 0.3, 1.0)`, bygg och kör – triangeln behåller sin form och position, bara färgen ändras. Det är ingen
uppgift; kursens uppgifter börjar i *Creating a window*.

## Kurskarta

Här är hela kursen: alla kapitel på learnopengl.com. Kapitlen i *Kom igång* fram till och med *Shaders* finns
i appen nu; resten kommer, i den här ordningen.

**Kom igång** (Getting started) – finns i appen nu fram till och med *Shaders*

| Kapitel | |
|---|---|
| {{api}} | finns |
| Setting up your IDE | finns |
| Creating a window | finns |
| Hello Window | finns |
| Hello Triangle | finns |
| Shaders | finns |
| Textures | kommer |
| Transformations | kommer |
| Coordinate Systems | kommer |
| Camera | kommer |
| Review | kommer |

**Lighting** – kommer: Colors, Basic Lighting, Materials, Lighting maps, Light casters, Multiple lights, Review.

**Model Loading** – kommer: Assimp, Mesh, Model.

**Advanced {{api}}** – kommer: Depth testing, Stencil testing, Blending, Face culling, Framebuffers, Cubemaps,
Advanced Data, Advanced {{shaderLanguage}}, Geometry Shader, Instancing, Anti Aliasing.

**Advanced Lighting** – kommer: Advanced Lighting, Gamma Correction, Shadows, Normal Mapping, Parallax Mapping,
HDR, Bloom, Deferred Shading, SSAO.

**PBR** – kommer: Theory, Lighting, IBL.

**In Practice** – kommer: Debugging, Text Rendering, 2D Game.

Nästa kapitel, *{{api}}*, förklarar vad API:et du har valt egentligen är och hur det är organiserat. Sedan sätter du
upp din IDE och börjar skriva kod: först ett fönster, sedan ett fönster som fylls med en färg, sedan triangeln du nyss
såg.

## Mer att läsa

- [learnopengl.com: Introduction](https://learnopengl.com/Introduction): introduktionen till den ursprungliga
  guiden som kursen följer.
- [vulkan-tutorial.com: Introduction](https://vulkan-tutorial.com/Introduction): vad Vulkan-guiden tar upp och
  förutsätter.
- [Microsoft Learn: Direct3D 12 programming guide](https://learn.microsoft.com/en-us/windows/win32/direct3d12/directx-12-programming-guide):
  den officiella dokumentationen av Direct3D 12.
