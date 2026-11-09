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

Du läser inte bara om grafikprogrammering: varje kapitel har ett projekt som du ändrar, bygger och kör själv. När
ett kapitel är slut har du skrivit koden som det handlar om.

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
   texten är hämtade ur kapitlets projekt, så du hittar varje rad igen i editorn.
2. **Frågor** i texten ("Testa dig själv") ser till att du har förstått de viktiga delarna. Svara på dem medan du
   läser: när du har svarat på dem öppnas uppgifterna och projektet.
3. **Arbetsbänken** (till höger) är där du skriver koden.

I slutet av de flesta kapitel finns *Mer att läsa*: länkar till den officiella dokumentationen och de
ursprungliga guiderna, om du vill läsa mer.

## Arbetsbänken

Arbetsbänken har två delar.

Överst finns **uppgifterna**. Varje uppgift är en ändring i projektet: en funktion att anropa, ett värde att
ändra, några rader att lägga till. Texten säger till när det är dags för en uppgift. Om du kör fast kan du öppna
**Tips**. Efter några försök – eller så snart du har öppnat tipset – kan du också visa **lösningen**: klicka på
dess kod för att lägga in den i projektet i stället för den TODO den hör till.

Under uppgifterna finns **projekteditorn**. Varje fil i projektet är en flik: `main.cpp` först, sedan headerfiler
och shaderfiler. I projekten i de kommande kapitlen markerar `// TODO:`-kommentarer var din kod ska stå. När du är
klar trycker du på **Bygg & kör** (eller Ctrl+Enter). Projektet kompileras och körs i den inbyggda simulatorn:

- **Utdata** visar kompilatorns meddelanden. Om bygget misslyckas klickar du på ett fel för att hoppa till raden.
  När programmet körs visar utdata också vad programmet skriver ut.
- **Förhandsvisningsfönstret** visar fönstret som ditt program öppnar och det som ritas i det.

Om du vill börja om ett kapitel ställer **Återställ** tillbaka projektet som det var i början av kapitlet (dina
klara uppgifter finns kvar).

```quiz
Hur kompilerar och kör du projektet i editorn? (Välj alla som fungerar.)
- [x] Tryck på Ctrl+Enter
- [x] Tryck på **Bygg & kör**
- [ ] Svara på frågorna i texten igen
---
Båda startar samma bygge: projektet kompileras, och om det lyckas körs det och förhandsvisningen visar dess fönster.
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

Gör nu den första uppgiften: tryck på **Bygg & kör** och titta på fönstret i förhandsvisningen: en orange triangel
på en mörkt blågrön bakgrund.

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

Gör nu den andra uppgiften: gör triangeln grön genom att ändra färgen till `(0.2, 0.8, 0.3, 1.0)`. Tryck på
**Bygg & kör** igen och titta i förhandsvisningen: triangeln har samma form och position, bara färgen har ändrats.

## Kurskarta

Här är hela kursen: alla kapitel på learnopengl.com. Kapitlen i *Kom igång* fram till och med *Shaders* finns
i appen nu; resten kommer, i den här ordningen.

**Kom igång** (Getting started) – finns i appen nu fram till och med *Shaders*

| Kapitel | |
|---|---|
| {{api}} | finns |
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

Nästa kapitel, *{{api}}*, förklarar vad API:et du har valt egentligen är och hur det är organiserat. Sedan börjar du
skriva kod: först ett fönster, sedan ett fönster som fylls med en färg, sedan triangeln du nyss såg.

## Mer att läsa

- [learnopengl.com: Introduction](https://learnopengl.com/Introduction): introduktionen till den ursprungliga
  guiden som kursen följer.
- [vulkan-tutorial.com: Introduction](https://vulkan-tutorial.com/Introduction): vad Vulkan-guiden tar upp och
  förutsätter.
- [Microsoft Learn: Direct3D 12 programming guide](https://learn.microsoft.com/en-us/windows/win32/direct3d12/directx-12-programming-guide):
  den officiella dokumentationen av Direct3D 12.
