# Shaders

Som vi nämnde i kapitlet *Hello Triangle* är shaders små program som ligger på GPU:n. De körs för var sitt
specifikt steg i grafikpipelinen. I grunden är shaders inget annat än program som omvandlar indata till utdata.
Shaders är också mycket isolerade program: de får inte kommunicera med varandra, och den enda kommunikation de har
sker via deras indata och utdata.

I förra kapitlet skrapade vi bara på ytan av shaders och hur man använder dem. Nu ska vi förklara shaders, och
särskilt shaderspråket {{shaderLanguage}}, mer allmänt: vilka typer det har, hur data kommer in i och ut ur en
shader, och hur programmet på CPU:n kan lämna värden till shaders medan programmet körs.

:::opengl
Kapitlets projekt är triangeln från *Hello Triangle* med en ändring som du kommer att känna igen i slutet av
kapitlet: shaderkällkoden ligger inte längre som strängar i `main.cpp` utan i två egna filer, `shader.vs`
(vertex shadern) och `shader.fs` (fragment shadern), och en liten klass `Shader` i `shader_s.h` läser, kompilerar
och länkar dem. Avsnitten *Vår egen shaderklass* och *Läsa från fil* förklarar hur klassen fungerar; fram till dess
räcker det att veta att `Shader ourShader("shader.vs", "shader.fs");` bygger shaderprogrammet och att
`ourShader.use();` aktiverar det.
:::
:::vulkan
Kapitlets projekt är det färdiga Hello Triangle-programmet: den orange triangeln på blågrön bakgrund, ritad från en
vertex buffer som innehåller en `glm::vec3 pos` per vertex. De två shaderna ligger i `shaders/shader.vert` och
`shaders/shader.frag`. Kom ihåg att y-axeln i Vulkans clip space pekar **nedåt**: vertexen `{0.0f, -0.5f, 0.0f}` är
triangelns övre hörn.
:::
:::d3d12
Kapitlets projekt är det färdiga Hello Triangle-programmet i stil med Microsofts exempel D3D12HelloTriangle: den
orange triangeln på blågrön bakgrund, ritad från en vertex buffer som innehåller en `XMFLOAT3 position` per vertex.
Båda shaderna ligger i filen `shaders.hlsl`: vertex shadern `VSMain` och pixel shadern `PSMain` (Direct3D:s namn på
fragment shadern).
:::

Alla uppgifter i det här kapitlet ändrar ett program som redan fungerar, så den här gången finns det inga
`// TODO:`-kommentarer: varje uppgift talar om vilka rader du ska ändra. Bygg och kör programmet efter varje uppgift för
att se resultatet.

## {{shaderLanguage}}

:::opengl
Shaders skrivs i det C-liknande språket GLSL. GLSL är skräddarsytt för grafik och har användbara funktioner som är
särskilt inriktade på att räkna med vektorer och matriser.

En shader börjar alltid med en versionsdeklaration, följd av en lista med in- och utvariabler, uniforms och dess
`main`-funktion. Varje shaders startpunkt är dess `main`-funktion, där vi bearbetar indatavariablerna och lägger
resultatet i utdatavariablerna. Oroa dig inte om du inte vet vad uniforms är, vi kommer till dem snart.

En shader har oftast följande struktur:

```glsl
#version version_number
in type in_variable_name;
in type in_variable_name;

out type out_variable_name;

uniform type uniform_name;

void main()
{
  // process input(s) and do some weird graphics stuff
  ...
  // output processed stuff to output variable
  out_variable_name = weird_stuff_we_processed;
}
```

När vi talar specifikt om vertex shadern kallas varje indatavariabel också för ett *vertexattribut*. Hur många
vertexattribut vi får deklarera begränsas av hårdvaran. OpenGL garanterar att det alltid finns minst 16
vertexattribut med 4 komponenter, men viss hårdvara tillåter fler, vilket du kan ta reda på genom att fråga efter
`GL_MAX_VERTEX_ATTRIBS`:

```cpp
int nrAttributes;
glGetIntegerv(GL_MAX_VERTEX_ATTRIBS, &nrAttributes);
std::cout << "Maximum nr of vertex attributes supported: " << nrAttributes << std::endl;
```

Det ger ofta minimivärdet 16, vilket borde räcka gott för de flesta ändamål.
:::
:::vulkan
Vulkan-shaders skrivs oftast också i GLSL – samma C-liknande språk som OpenGL använder, skräddarsytt för grafik och
med användbara funktioner som är särskilt inriktade på att räkna med vektorer och matriser. Skillnaden ligger i hur
shaderna når drivrutinen: Vulkan tar inte emot GLSL-källkod alls. Vulkan tar bara emot shaders i **SPIR-V**, ett
binärt mellanformat, så GLSL-filerna kompileras *innan* programmet körs, av en kompilator som `glslc` (mer om det i
*Vår egen shaderklass*).

En shader börjar alltid med en versionsdeklaration, följd av en lista med in- och utvariabler, uniform-block och
dess `main`-funktion. Varje shaders startpunkt är dess `main`-funktion, där vi bearbetar indatavariablerna och
lägger resultatet i utdatavariablerna. För Vulkan använder vi `#version 450`, och varje in- och utvariabel får en
`layout(location = …)`-kvalificerare – SPIR-V för Vulkan kräver det:

```glsl
#version 450

layout(location = 0) in type in_variable_name;

layout(location = 0) out type out_variable_name;

void main() {
    // process input(s) and do some weird graphics stuff
    ...
    // output processed stuff to output variable
    out_variable_name = weird_stuff_we_processed;
}
```

När vi talar specifikt om vertex shadern kallas varje indatavariabel också för ett *vertexattribut*. Antalet
vertexattribut begränsas av hårdvaran: Vulkan garanterar minst 16
(`VkPhysicalDeviceLimits::maxVertexInputAttributes`), vilket räcker gott för de flesta ändamål.
:::
:::d3d12
Direct3D-shaders skrivs i **HLSL**, High-Level Shading Language. Om du har sett GLSL (språket i OpenGL- och
Vulkan-guider) kommer HLSL att kännas mycket bekant: båda är C-liknande, båda är skräddarsydda för grafik och båda
har inbyggda vektor- och matristyper. De viktigaste skillnaderna ligger i detaljerna:

| | GLSL | HLSL |
|---|---|---|
| Startpunkt | alltid `main` | valfritt namn: här `VSMain` och `PSMain` |
| Indata och utdata | globala `in`/`out`-variabler | funktionsparametrar och returvärden, märkta med *semantik* (`: POSITION`, `: SV_TARGET`) |
| Vektortyper | `vec2`, `vec3`, `vec4` | `float2`, `float3`, `float4` |
| Båda shaderna i en fil | nej (en fil per steg) | ja: en fil kan innehålla flera startpunkter |

Projektets `shaders.hlsl` har den här strukturen:

```hlsl
// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = position;

    return result;
}

// The pixel shader: runs once per pixel the triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(1.0f, 0.5f, 0.2f, 1.0f);
}
```

När vi talar specifikt om vertex shadern kallas varje indata också för ett *vertexattribut* (Direct3D kallar
beskrivningen av ett sådant för ett *input element*). Antalet input elements är begränsat: Direct3D 12 tillåter upp
till 32 per vertex, vilket räcker gott för de flesta ändamål.
:::

## Typer

{{shaderLanguage}} har, som alla andra programmeringsspråk, datatyper som anger vilken sorts variabel vi vill
arbeta med. {{shaderLanguage}} har de flesta grundtyper vi känner igen från språk som C: `int`, `float`, `double`,
`uint` och `bool`. {{shaderLanguage}} har också två behållartyper som vi kommer att använda mycket, nämligen
vektorer och matriser. Matriser tar vi upp i ett senare kapitel.

### Vektorer

:::opengl vulkan
En vektor i GLSL är en behållare med 2, 3 eller 4 komponenter av någon av grundtyperna ovan. Den kan ha följande
former (`n` står för antalet komponenter):

- `vecn`: standardvektorn med `n` floats.
- `bvecn`: en vektor med `n` booleska värden.
- `ivecn`: en vektor med `n` heltal.
- `uvecn`: en vektor med `n` heltal utan tecken.
- `dvecn`: en vektor med `n` double-komponenter.

För det mesta använder vi den vanliga `vecn`, eftersom floats räcker för de flesta av våra ändamål.

En vektors komponenter nås via `vec.x`, där `x` är vektorns första komponent. Du kan använda `.x`, `.y`, `.z` och
`.w` för att nå första, andra, tredje respektive fjärde komponenten. GLSL låter dig också använda `rgba` för färger
eller `stpq` för texturkoordinater, som når samma komponenter.

Vektortypen tillåter ett intressant och flexibelt sätt att välja komponenter som kallas *swizzling*. Med swizzling
kan vi skriva så här:

```glsl
vec2 someVec;
vec4 differentVec = someVec.xyxx;
vec3 anotherVec = differentVec.zyw;
vec4 otherVec = someVec.xxxx + anotherVec.yxzy;
```

Du kan använda vilken kombination som helst av upp till 4 bokstäver för att skapa en ny vektor (av samma typ), så
länge den ursprungliga vektorn har de komponenterna; det är till exempel inte tillåtet att läsa `.z` hos en `vec2`.
Vi kan också skicka vektorer som argument till vektorkonstruktorer och på så sätt behöva färre argument:

```glsl
vec2 vect = vec2(0.5, 0.7);
vec4 result = vec4(vect, 0.0, 0.0);
vec4 otherResult = vec4(result.xyz, 1.0);
```

Det har du redan sett i vertex shadern, som bygger `gl_Position` med `vec4(…, 1.0)`: en vektor med 4 komponenter
av positionen med 3 komponenter och ett `w` på `1.0`.
:::
:::d3d12
En vektor i HLSL är en behållare med 1 till 4 komponenter av någon av grundtyperna ovan. Typnamnet är grundtypen
följd av antalet komponenter (`n`):

- `floatn`: standardvektorn med `n` floats (`float2`, `float3`, `float4`).
- `booln`: en vektor med `n` booleska värden.
- `intn`: en vektor med `n` heltal.
- `uintn`: en vektor med `n` heltal utan tecken.
- `doublen`: en vektor med `n` double-komponenter.

För det mesta använder vi `floatn`, eftersom floats räcker för de flesta av våra ändamål.

En vektors komponenter nås via `v.x`, där `x` är vektorns första komponent. Du kan använda `.x`, `.y`, `.z` och
`.w` för att nå första, andra, tredje respektive fjärde komponenten, eller `.r`, `.g`, `.b` och `.a` för samma
komponenter när vektorn är en färg (de två uppsättningarna får inte blandas i samma åtkomst).

Vektortypen tillåter ett intressant och flexibelt sätt att välja komponenter som kallas *swizzling*. Med swizzling
kan vi skriva så här:

```hlsl
float2 someVec;
float4 differentVec = someVec.xyxx;
float3 anotherVec = differentVec.zyw;
float4 otherVec = someVec.xxxx + anotherVec.yxzy;
```

Du kan använda vilken kombination som helst av upp till 4 bokstäver för att skapa en ny vektor (av samma typ), så
länge den ursprungliga vektorn har de komponenterna; det är till exempel inte tillåtet att läsa `.z` hos en
`float2`. Vi kan också skicka vektorer som argument till vektorkonstruktorer och på så sätt behöva färre argument:

```hlsl
float2 vect = float2(0.5f, 0.7f);
float4 result = float4(vect, 0.0f, 0.0f);
float4 otherResult = float4(result.xyz, 1.0f);
```

Kapitlets vertex shader kommer att använda just detta för att bygga sin utdataposition:
`float4(position.x, -position.y, position.z, 1.0f)`.
:::

Vektorer är alltså en flexibel datatyp som vi kan använda för alla sorters indata och utdata. Genom hela kursen
kommer du att se många exempel på hur vi kan hantera vektorer på kreativa sätt.

## In- och utdata

Shaders är trevliga små program var för sig, men de är delar av en helhet, och därför vill vi ha indata och utdata
på de enskilda shaderna så att vi kan flytta runt saker.

:::opengl
GLSL har nyckelorden `in` och `out` just för det ändamålet. Varje shader kan ange indata och utdata med de
nyckelorden, och där en utdatavariabel matchar en indatavariabel i nästa shadersteg skickas värdet vidare. Vertex
shadern och fragment shadern skiljer sig dock lite åt.

Vertex shadern *bör* få någon form av indata, annars vore den ganska verkningslös. Vertex shadern skiljer sig i sin
indata genom att den får den direkt från vertexdatan. För att beskriva hur vertexdatan är organiserad anger vi
indatavariablerna med en location, så att vi kan konfigurera vertexattributen på CPU:n. Det såg vi i förra kapitlet
som `layout (location = 0)`. Vertex shadern kräver alltså en extra layoutangivelse för sin indata så att vi kan
koppla den till vertexdatan.

> Det går också att utelämna `layout (location = 0)` och i stället fråga efter attributens locations i
> OpenGL-koden med `glGetAttribLocation`, men vi föredrar att ange dem i vertex shadern. Det är lättare att förstå
> och sparar dig (och OpenGL) lite arbete.

Det andra undantaget är att fragment shadern kräver en utdatavariabel för färgen av typen `vec4`, eftersom fragment
shadern måste ta fram en slutlig färg. Om du inte anger någon utdatafärg i fragment shadern blir färgbuffertens
innehåll för de fragmenten odefinierat (vilket oftast betyder att OpenGL ritar dem svarta eller vita).

Om vi vill skicka data från en shader till en annan måste vi alltså deklarera en utdata i den sändande shadern och
en motsvarande indata i den mottagande. När typerna och namnen är lika på båda sidor kopplar OpenGL ihop variablerna,
och då går det att skicka data mellan shaders (det görs när ett programobjekt länkas). För att visa hur det fungerar
i praktiken ska vi ändra shaderna från förra kapitlet så att vertex shadern bestämmer färgen åt fragment shadern.

**Vertex shader** (`shader.vs`)

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

out vec4 vertexColor; // specify a color output to the fragment shader

void main()
{
    gl_Position = vec4(aPos, 1.0); // see how we directly give a vec3 to vec4's constructor
    vertexColor = vec4(0.5, 0.0, 0.0, 1.0); // set the output variable to a dark-red color
}
```

**Fragment shader** (`shader.fs`)

```glsl
#version 330 core
out vec4 FragColor;

in vec4 vertexColor; // the input variable from the vertex shader (same name and same type)

void main()
{
    FragColor = vertexColor;
}
```

Du ser att vi deklarerade en variabel `vertexColor` som en utdata av typen `vec4` som vi sätter i vertex shadern,
och att vi deklarerar en motsvarande indata `vertexColor` i fragment shadern. Eftersom båda har samma typ och samma
namn kopplas `vertexColor` i fragment shadern till `vertexColor` i vertex shadern. Eftersom vi sätter färgen till
mörkrött i vertex shadern bör de resulterande fragmenten också bli mörkröda.
:::
:::vulkan
GLSL har nyckelorden `in` och `out` för det här. Varje shader kan ange indata och utdata med de nyckelorden, och där
en utdatavariabel matchar en indatavariabel i nästa shadersteg skickas värdet vidare. Vertex shadern och fragment
shadern skiljer sig dock lite åt.

Vertex shadern får sin indata direkt från vertexdatan. Dess indatavariabler har en location –
`layout(location = 0) in vec3 inPosition;` – och attributbeskrivningarna i `main.cpp`
(`Vertex::getAttributeDescriptions()`) anger vilka byte i vertex buffern som går till vilken location.

Fragment shadern skriver också sitt resultat till en utdatavariabel: `layout(location = 0) out vec4 outColor;`. För
en fragment shader betyder location 0 subpassets första color attachment – swap chain-bilden vi ritar i.

Mellan vertex shadern och fragment shadern finns en viktig skillnad mot OpenGL. I OpenGL:s GLSL 3.30 kopplas en
utdata och en indata ihop när de har samma **namn** och typ. I Vulkan kopplas de ihop genom sin **location**:
utdatan på `location = 0` i vertex shadern matar indatan på `location = 0` i fragment shadern, och typerna måste
stämma överens. Namnen spelar ingen roll alls – du kunde kalla variabeln `vertexColor` i den ena shadern och
`color` i den andra. Det är också därför location-kvalificeraren krävs på varje `in` och `out`.

För att visa hur det fungerar i praktiken ska vi ändra shaderna så att vertex shadern bestämmer färgen åt fragment
shadern.

**Vertex shader** (`shaders/shader.vert`)

```glsl
#version 450

layout(location = 0) in vec3 inPosition;

layout(location = 0) out vec4 vertexColor; // the color we pass on to the fragment shader

void main() {
    gl_Position = vec4(inPosition, 1.0);
    vertexColor = vec4(0.5, 0.0, 0.0, 1.0); // dark red
}
```

**Fragment shader** (`shaders/shader.frag`)

```glsl
#version 450

layout(location = 0) in vec4 vertexColor; // from the vertex shader (same location, same type)

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vertexColor;
}
```

Lägg märke till att vertex shaderns indata och dess utdata båda använder location 0: indata och utdata är separata
gränssnitt med var sina locations. Eftersom vi sätter färgen till mörkrött i vertex shadern bör de resulterande
fragmenten också bli mörkröda.
:::
:::d3d12
I HLSL är en shaders indata dess funktionsparametrar och dess utdata dess returvärde. Var och en av dem har en
**semantik** efter ett kolon, ett namn som säger vad värdet är och hur det kopplas till steget före och efter:

- Vertex shaderns indata kommer direkt från vertexdatan. `float4 position : POSITION` tar emot det input element
  som har semantiknamnet `"POSITION"` i input layouten i `main.cpp`. (Buffern innehåller bara tre floats per
  vertex; när en shader ber om fler komponenter än formatet har fylls det saknade `w` i med 1.)
- Semantiker som börjar med `SV_` är *systemvärden* med en särskild betydelse för pipelinen. `SV_POSITION` i vertex
  shaderns utdata är positionen i clip space som rasterizern använder (GLSL:s `gl_Position`); `SV_TARGET` på pixel
  shaderns returvärde är färgen som skrivs till render target 0.
- Alla andra semantiker, som `COLOR`, är namn du väljer själv. Ett värde som vertex shadern skriver med semantiken
  `COLOR` kommer fram i pixel shaderns indata med semantiken `COLOR`.

Det vanliga sättet att hålla båda sidor överens är en struct som används både som vertex shaderns returtyp och som
pixel shaderns parameter – det är vad `PSInput` är till för. För att visa hur det fungerar i praktiken ska vi ändra
shaderna så att vertex shadern bestämmer färgen åt pixel shadern:

```hlsl
// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float4 color : COLOR;            // out of the vertex shader, into the pixel shader
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = position;
    result.color = float4(0.5f, 0.0f, 0.0f, 1.0f);    // dark red

    return result;
}

// The pixel shader: runs once per pixel the triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // The colour from the vertex shader, interpolated across the triangle.
    return input.color;
}
```

Eftersom vi sätter färgen till mörkrött i vertex shadern bör de resulterande pixlarna också bli mörkröda.
:::

Gör nu den första uppgiften, **in-out**: gör ändringen ovan och bygg. Du bör se samma triangel, nu mörkröd
(RGB 128, 0, 0) i stället för orange.

Där har vi det! Vi har just lyckats skicka ett värde från vertex shadern till fragment shadern.

:::opengl
```quiz
Hur kopplar OpenGL ihop en `out`-variabel i vertex shadern med en `in`-variabel i fragment shadern i det här projektet?
- [ ] Genom ordningen de deklareras i, oavsett namn
- [ ] Med `glVertexAttribPointer`, som ett vertexattribut
- [x] De måste ha samma namn och samma typ; kopplingen görs när programmet länkas
---
Med GLSL 3.30 (och utan explicita locations på utdatan) parar länkaren ihop utdata och indata efter namn och typ. `glVertexAttribPointer` gäller bara vertex shaderns indata från vertexdatan.
```
:::
:::vulkan
```quiz
Hur kopplar Vulkan ihop en `out`-variabel i vertex shadern med en `in`-variabel i fragment shadern?
- [ ] Efter namn, som i OpenGL
- [x] Genom `location` (med matchande typer); namnen spelar ingen roll
- [ ] Med en attributbeskrivning i `main.cpp`
---
I Vulkan matchas gränssnittet mellan stegen efter location. Attributbeskrivningarna matar bara vertex shaderns indata från vertex buffern.
```
:::
:::d3d12
```quiz
Hur kopplar Direct3D 12 ihop det vertex shadern ger ut med det pixel shadern tar emot?
- [x] Genom semantiken: värdet som skrivs med `COLOR` kommer fram i indatan med `COLOR`
- [ ] Genom variabelnamnen i de två funktionerna
- [ ] Med ett input element i input layouten i `main.cpp`
---
Utdata och indata mellan stegen matchas efter sin semantik; en och samma struct (`PSInput`) på båda sidor håller dem överens. Input layouten matar bara vertex shadern från vertex buffern.
```
:::

## Uniforms

:::opengl
*Uniforms* är ett annat sätt att skicka data från vårt program på CPU:n till shaderna på GPU:n. Uniforms skiljer
sig dock lite från vertexattribut. För det första är uniforms *globala*. Globala betyder att en uniform-variabel är
unik per shaderprogramobjekt och kan nås från vilken shader som helst i vilket steg som helst i shaderprogrammet.
För det andra behåller uniforms sina värden, vad du än sätter dem till, tills de återställs eller uppdateras.

För att deklarera en uniform i GLSL lägger vi helt enkelt till nyckelordet `uniform` i en shader, med en typ och ett
namn. Från och med då kan vi använda den nya uniformen i shadern. Låt oss se om vi den här gången kan sätta
triangelns färg via en uniform:

```glsl
#version 330 core
out vec4 FragColor;

uniform vec4 ourColor; // we set this variable in the OpenGL code.

void main()
{
    FragColor = ourColor;
}
```

Vi deklarerade en uniform `vec4` `ourColor` i fragment shadern och satte fragmentets utdatafärg till uniformens
värde. Eftersom uniforms är globala variabler kan vi deklarera dem i vilket shadersteg vi vill, så vi behöver inte
gå via vertex shadern för att få något till fragment shadern. Vi använder inte uniformen i vertex shadern, så där
behöver vi inte deklarera den.

> Om du deklarerar en uniform som inte används någonstans i GLSL-koden tar kompilatorn tyst bort variabeln ur den
> kompilerade versionen, vilket ligger bakom flera frustrerande fel; ha det i minnet!

Uniformen är tom just nu; vi har inte lagt in någon data i den än, så låt oss göra det. Först måste vi hitta
uniformens index/location i shadern. När vi har uniformens index/location kan vi uppdatera dess värden. I stället
för att skicka en enda färg till fragment shadern piffar vi upp det genom att låta färgen ändras gradvis över tid:

```cpp
        ourShader.use();

        // update the uniform color (the shader must be active before glUniform calls)
        double timeValue = glfwGetTime();
        float greenValue = static_cast<float>(sin(timeValue) / 2.0 + 0.5);
        int vertexColorLocation = glGetUniformLocation(ourShader.ID, "ourColor");
        glUniform4f(vertexColorLocation, 0.0f, greenValue, 0.0f, 1.0f);
```

Först hämtar vi körtiden i sekunder med `glfwGetTime()`. Sedan låter vi färgen variera mellan `0.0` och `1.0` med
funktionen `sin` och sparar resultatet i `greenValue` (`sin` kommer från `<cmath>`, så lägg till
`#include <cmath>` överst i `main.cpp`).

Sedan frågar vi efter uniformen `ourColor`s location med `glGetUniformLocation`. Vi ger frågefunktionen
shaderprogrammet (`ourShader.ID`, programobjektet som klassen `Shader` skapade) och namnet på uniformen (vars
location vi vill ha). Om `glGetUniformLocation` returnerar `-1` hittade den ingen location. Till sist kan vi sätta
uniformens värde med funktionen `glUniform4f`. Observera att du inte behöver använda shaderprogrammet för att hitta
uniformens location, men för att uppdatera en uniform **måste** du först använda programmet (genom att anropa
`glUseProgram`, vilket `ourShader.use()` gör), eftersom uniformen sätts i det shaderprogram som är aktivt.

> Eftersom OpenGL i grunden är ett C-bibliotek har det inget inbyggt stöd för överlagring av funktioner, så där en
> funktion kan anropas med olika typer definierar OpenGL en ny funktion för varje typ; `glUniform` är ett perfekt
> exempel på det. Funktionen kräver ett särskilt suffix för typen av uniform du vill sätta. Några av de möjliga
> suffixen är:
>
> - `f`: funktionen väntar sig en `float` som värde.
> - `i`: funktionen väntar sig en `int` som värde.
> - `ui`: funktionen väntar sig en `unsigned int` som värde.
> - `3f`: funktionen väntar sig 3 `float` som värde.
> - `fv`: funktionen väntar sig en `float`-vektor/array som värde.
>
> När du vill ställa in något i OpenGL väljer du helt enkelt den överlagrade funktion som motsvarar din typ. I vårt
> fall vill vi sätta uniformens 4 floats var för sig, så vi skickar datan via `glUniform4f` (vi kunde också ha
> använt `fv`-varianten).

Nu när vi vet hur man sätter värden på uniform-variabler kan vi använda dem när vi ritar. Om färgen ska ändras
gradvis måste vi uppdatera uniformen varje bildruta; sätter vi den bara en gång behåller triangeln en enda färg.
Därför hamnar koden i renderingsloopen, direkt efter `ourShader.use();` och före ritanropet.

Gör nu uppgiften **uniform**: deklarera uniformen i `shader.fs`, inkludera `<cmath>` och lägg till raderna ovan i
renderingsloopen. Om du har gjort rätt ser du triangeln gradvis gå från grönt till svart och tillbaka till grönt.
(Vertex shaderns utdata `vertexColor` finns kvar, men ingenting läser den längre.)
:::
:::vulkan
I OpenGL är det vanliga sättet att skicka ett värde från programmet på CPU:n till shaderna en *uniform*: en global
variabel i shaderprogrammet som programmet sätter med `glUniform*` och som behåller sitt värde tills den ändras.
Vulkan har inga sådana lösa uniform-variabler. En shader får värden från CPU:n på ett av två sätt:

- **Uniform buffers**: en buffer i GPU-minnet som shadern läser som ett `uniform`-block. Shadern hittar den via en
  *descriptor set*, som kräver en descriptor set layout, en descriptor pool och ett uppdateringsanrop för att
  sättas upp. Det är den allmänna lösningen, och vulkan-tutorial bygger den i kapitlet *Uniform buffers* – vi
  kommer att behöva den senare i kursen för transformationsmatriser.
- **Push constants**: ett litet block med värden (minst 128 byte i varje Vulkan-implementation) som du skriver
  direkt i command buffern medan du spelar in den. Ingen buffer, inga descriptors. Det är precis vad vi behöver för
  en enda färg, så här använder vi push constants.

Push constants kräver tre steg. Först deklarerar shadern ett block med `layout(push_constant)`. Låt oss sätta
triangelns färg på det sättet, i fragment shadern:

```glsl
#version 450

// Push constants: a few bytes the application sets from the CPU while recording the commands.
layout(push_constant) uniform PushConstants {
    vec4 color;
} pc;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = pc.color;
}
```

Blocket nås via sitt instansnamn: `pc.color`. Eftersom färgen nu kommer från CPU:n behöver vertex shadern inte
längre sin utdata `vertexColor`: uppgiften tar bort den ur båda shaderna igen.

För det andra måste pipeline layouten tala om att det finns push constants. Pipeline layouten beskriver allt som en
pipelines shaders får utifrån utöver vertexdatan; hittills har den varit tom. En `VkPushConstantRange` anger vilka
shadersteg som läser vilka byte. På C++-sidan beskriver vi blocket med en struct med samma layout, ovanför klassen:

```cpp
// The same layout as the push constant block in the shader.
struct PushConstants {
    glm::vec4 color;
};
```

och i `createGraphicsPipeline()`:

```cpp
        VkPushConstantRange pushConstantRange{};
        pushConstantRange.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;
        pushConstantRange.offset = 0;
        pushConstantRange.size = sizeof(PushConstants);

        VkPipelineLayoutCreateInfo pipelineLayoutInfo{};
        pipelineLayoutInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO;
        pipelineLayoutInfo.setLayoutCount = 0;
        pipelineLayoutInfo.pushConstantRangeCount = 1;
        pipelineLayoutInfo.pPushConstantRanges = &pushConstantRange;
```

För det tredje spelas värdena in i command buffern med `vkCmdPushConstants`, efter att pipelinen har bundits och
före ritanropet. I stället för att skicka en enda färg till fragment shadern piffar vi upp det genom att låta färgen
ändras gradvis över tid. I `recordCommandBuffer()`, direkt före `vkCmdDraw`:

```cpp
        static auto startTime = std::chrono::high_resolution_clock::now();

        auto currentTime = std::chrono::high_resolution_clock::now();
        float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();
        float greenValue = std::sin(time) / 2.0f + 0.5f;

        PushConstants constants{};
        constants.color = glm::vec4(0.0f, greenValue, 0.0f, 1.0f);
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);
```

Först räknar vi ut tiden i sekunder sedan första bildrutan med `std::chrono` (på samma sätt som vulkan-tutorial
animerar sin uniform buffer). Sedan låter vi färgen variera mellan `0.0` och `1.0` med `std::sin` och sparar
resultatet i `greenValue`. Lägg till `#include <chrono>` och `#include <cmath>` under `glm`-includen.

`vkCmdPushConstants` tar command buffern, pipeline layouten, de steg som ska läsa värdena, en offset och en storlek
i byte samt en pekare till datan. Stegflaggorna och byteintervallet måste ligga inom ett intervall som har deklarerats
i pipeline layouten. Värdena kopieras in i command buffern i samma ögonblick som du spelar in anropet, så de ändras
bara när du spelar in igen. Det fungerar här eftersom `drawFrame()` spelar in command buffern på nytt varje
bildruta – därför kan färgen ändras varje bildruta.

Gör nu uppgiften **uniform**. Om du har gjort rätt ser du triangeln gradvis gå från grönt till svart och tillbaka
till grönt.
:::
:::d3d12
I OpenGL är det vanliga sättet att skicka ett värde från programmet på CPU:n till shaderna en *uniform*: en global
variabel i shaderprogrammet som programmet sätter med `glUniform*` och som behåller sitt värde tills den ändras. I
Direct3D 12 går allt som en shader läser utifrån, utöver vertexdatan, via **root signaturen**, objektet som
beskriver shadernas parametrar. Hittills har projektets root signature varit tom. En root signature kan innehålla tre
sorters *root parameters*:

- **Root constants**: 32-bitarsvärden som lagras direkt i root signaturen. De är det snabbaste sättet att ge en
  shader några få värden, och shadern ser dem som en constant buffer.
- **Root descriptors** och **descriptor tables**: referenser till resurser som constant buffers i GPU-minnet
  (*constant buffer views*, CBV:er) och texturer. Det är den allmänna lösningen, och vi kommer att behöva den
  senare i kursen för transformationsmatriser och texturer.

För en enda färg är root constants precis rätt. De kräver tre steg. Först deklarerar shadern en constant buffer,
`cbuffer`, på ett register. Låt oss sätta triangelns färg på det sättet, överst i `shaders.hlsl`:

```hlsl
// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the shaders
// see them as a constant buffer at register b0.
cbuffer ColorConstants : register(b0)
{
    float4 color;
};
```

och pixel shadern returnerar den färgen:

```hlsl
    // The colour set from the CPU.
    return color;
```

Medlemmarna i en `cbuffer` används som globala variabler: `color`. `b0` är det första constant buffer-registret
(`b` för constant buffers; texturer och samplers använder `t`- och `s`-register, som du kommer att se senare).

För det andra får root signaturen en root parameter för register `b0`. På C++-sidan beskriver vi värdena med en
struct med samma layout, bredvid `Vertex` i klassen:

```cpp
    // The root constants: what the shaders see as cbuffer ColorConstants.
    struct ColorConstants
    {
        XMFLOAT4 color;
    };
```

och i `LoadAssets()` blir den tomma root signaturen en med en parameter:

```cpp
    // Create a root signature with one parameter: root constants for register b0.
    {
        // Root constants live in the root signature itself, as 32-bit values:
        // sizeof(ColorConstants) / 4 of them, visible to all shader stages.
        CD3DX12_ROOT_PARAMETER rootParameters[1];
        rootParameters[0].InitAsConstants(sizeof(ColorConstants) / 4, 0);

        CD3DX12_ROOT_SIGNATURE_DESC rootSignatureDesc;
        rootSignatureDesc.Init(_countof(rootParameters), rootParameters, 0, nullptr, D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT);
```

`InitAsConstants(num32BitValues, shaderRegister)` – här 4 värden (en `float4` är 16 byte) för register `b0`. De
valfria argumenten därefter är register space (0) och shader visibility (alla steg som standard).

För det tredje sätts värdena på command listen med `SetGraphicsRoot32BitConstants`, efter
`SetGraphicsRootSignature`. I stället för att skicka en enda färg till pixel shadern piffar vi upp det genom att
låta färgen ändras gradvis över tid. I `PopulateCommandList()`, efter `RSSetScissorRects`:

```cpp
    // The colour for the pixel shader: green goes up and down with the time.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();
    float greenValue = std::sin(time) / 2.0f + 0.5f;

    ColorConstants colorConstants = {};
    colorConstants.color = XMFLOAT4(0.0f, greenValue, 0.0f, 1.0f);
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ColorConstants) / 4, &colorConstants, 0);
```

Först räknar vi ut tiden i sekunder sedan första bildrutan med `std::chrono`. Sedan låter vi färgen variera mellan
`0.0` och `1.0` med `std::sin` och sparar resultatet i `greenValue`. Lägg till `#include <chrono>` och
`#include <cmath>` bland includerna.

`SetGraphicsRoot32BitConstants` tar root parameterns index (0), antalet 32-bitarsvärden, en pekare till datan och
offseten (i 32-bitarsvärden) för det första värdet. Värdena spelas in i command listen. Eftersom
`PopulateCommandList()` återställer command listen varje bildruta – och en återställd command list börjar utan
root signature och utan root arguments – sätts de varje bildruta, vilket också är det som låter färgen ändras.

Gör nu uppgiften **uniform**. Om du har gjort rätt ser du triangeln gradvis gå från grönt till svart och tillbaka
till grönt. (Vertex shadern skriver fortfarande `result.color`, men pixel shadern läser det inte längre.)
:::

Som du ser är ett värde som sätts från CPU:n ett användbart verktyg för egenskaper som kan ändras varje bildruta,
eller för att utbyta data mellan programmet och shaderna, men vad gör vi om vi vill sätta en färg för varje vertex?
Då skulle vi behöva deklarera lika många värden som vi har vertices. En bättre lösning är att lägga mer data i
vertexattributen, och det är vad vi ska göra nu.

:::opengl
```quiz
Var i renderingsloopen måste `glUniform4f(vertexColorLocation, ...)` anropas?
- [ ] Var som helst: `glGetUniformLocation` har redan bundit uniformen till programmet
- [ ] Före `ourShader.use()`, eftersom `glUseProgram` nollställer alla uniforms
- [x] Efter `ourShader.use()`, eftersom `glUniform*` sätter uniformen i det program som är aktivt
---
`glGetUniformLocation` slår bara upp location; programmet behöver inte vara aktivt för det. `glUniform*` skriver i det aktiva programmet, så `glUseProgram` (här `ourShader.use()`) måste komma först.
```
:::
:::vulkan
```quiz
Fragment shadern läser ett push constant-block. Vad måste `VkPushConstantRange` i pipeline layouten innehålla?
- [ ] Ingenting: push constants behöver inte deklareras i pipeline layouten
- [ ] En descriptor set med en uniform buffer för blocket
- [x] `VK_SHADER_STAGE_FRAGMENT_BIT` i `stageFlags`, och en offset och storlek som täcker blocket
---
Pipeline layouten deklarerar vilka steg som läser vilka byte av push constants, och `vkCmdPushConstants` måste använda stegflaggor och ett intervall som ryms inom den. Descriptor sets är till för uniform buffers, som push constants inte behöver.
```
:::
:::d3d12
```quiz
Hur ser pixel shadern de root constants som `SetGraphicsRoot32BitConstants(0, ...)` sätter?
- [ ] Som en constant buffer view som först måste skapas i en descriptor heap
- [x] Som en constant buffer (`cbuffer`) på det register som gavs till `InitAsConstants`, här `b0`
- [ ] Som ett vertexattribut med semantiken `COLOR`
---
Root constants ligger i själva root signaturen. Root parameter 0 skapades med `InitAsConstants(..., 0)`, så den hör till register `b0`, där shadern deklarerar sin `cbuffer`. Constant buffer views är det andra, mer allmänna sättet, som vi kommer att använda senare.
```
:::

## Fler attribut!

I förra kapitlet såg vi hur vi kan fylla en buffer med vertexdata och tala om för pipelinen hur datan är
organiserad. Den här gången vill vi också lägga till färgdata i vertexdatan. Vi lägger till färgdata som 3 floats i
vertexarrayen. Vi ger triangelns tre hörn var sin färg: röd, grön och blå.

:::opengl
```cpp
    float vertices[] = {
        // positions         // colors
         0.5f, -0.5f, 0.0f,  1.0f, 0.0f, 0.0f,  // bottom right
        -0.5f, -0.5f, 0.0f,  0.0f, 1.0f, 0.0f,  // bottom left
         0.0f,  0.5f, 0.0f,  0.0f, 0.0f, 1.0f   // top
    };
```

Eftersom vi nu har mer data att skicka till vertex shadern måste vi ändra vertex shadern så att den också tar emot
färgvärdet som ett vertexattribut. Observera att vi sätter attributet `aColor`s location till 1 med
layoutangivelsen:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;

out vec3 ourColor;

void main()
{
    gl_Position = vec4(aPos, 1.0);
    ourColor = aColor;
}
```

Eftersom vi inte längre använder en uniform för fragmentets färg, utan utdatavariabeln `ourColor`, måste vi ändra
fragment shadern också:

```glsl
#version 330 core
out vec4 FragColor;

in vec3 ourColor;

void main()
{
    FragColor = vec4(ourColor, 1.0f);
}
```

Eftersom vi har lagt till ett vertexattribut och ändrat VBO:ns minne måste vi konfigurera om vertexattributpekarna.
Datan i VBO:ns minne ser nu ut ungefär så här:

| Byteoffset | 0 | 4 | 8 | 12 | 16 | 20 | 24 | 28 | … |
|---|---|---|---|---|---|---|---|---|---|
| Värde | x | y | z | r | g | b | x | y | … |
| Hör till | vertex 1 position | | | vertex 1 färg | | | vertex 2 position | | |

När vi känner till layouten kan vi uppdatera vertexformatet med `glVertexAttribPointer`:

```cpp
    // position attribute
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
    // color attribute
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
```

De första argumenten till `glVertexAttribPointer` är ganska enkla. Den här gången konfigurerar vi vertexattributet
på location `1`. Färgvärdena består av 3 floats och vi normaliserar inte värdena.

Eftersom vi nu har två vertexattribut måste vi räkna om *stride*. För att komma till nästa attributvärde (till
exempel nästa `x`-komponent i positionsvektorn) i dataarrayen måste vi flytta oss 6 floats åt höger: tre för
positionen och tre för färgen. Det ger en stride på 6 gånger storleken av en float i byte (= 24 byte). Den här
gången måste vi också ange en offset. I varje vertex kommer positionsattributet först, så dess offset är `0`.
Färgattributet börjar efter positionsdatan, så dess offset är `3 * sizeof(float)` i byte (= 12 byte).

Uniformen från förra avsnittet behövs inte längre: ta bort dess rader ur renderingsloopen och `#include <cmath>`
igen.
:::
:::vulkan
I Vulkan beskrivs vertexdatan av structen `Vertex`, så vi lägger till en medlem för färgen – precis det som
vulkan-tutorials kapitel *Vertex input description* gör:

```cpp
struct Vertex {
    glm::vec3 pos;
    glm::vec3 color;
```

och ger varje vertex sin färg:

```cpp
const std::vector<Vertex> vertices = {
    {{0.0f, -0.5f, 0.0f}, {1.0f, 0.0f, 0.0f}},
    {{0.5f, 0.5f, 0.0f}, {0.0f, 1.0f, 0.0f}},
    {{-0.5f, 0.5f, 0.0f}, {0.0f, 0.0f, 1.0f}}
};
```

Det övre hörnet är rött, det nedre högra grönt och det nedre vänstra blått. Varje vertex är nu 6 floats i minnet:

| Byteoffset | 0 | 4 | 8 | 12 | 16 | 20 | 24 | 28 | … |
|---|---|---|---|---|---|---|---|---|---|
| Värde | x | y | z | r | g | b | x | y | … |
| Hör till | vertex 1 `pos` | | | vertex 1 `color` | | | vertex 2 `pos` | | |

Bindningsbeskrivningen ändras inte: dess `stride` är `sizeof(Vertex)`, som växer från 12 till 24 byte av sig själv.
Det vi behöver är en andra **attributbeskrivning** för det nya attributet, så `getAttributeDescriptions()`
returnerar nu en array med två:

```cpp
    static std::array<VkVertexInputAttributeDescription, 2> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 2> attributeDescriptions{};

        attributeDescriptions[0].binding = 0;
        attributeDescriptions[0].location = 0;
        attributeDescriptions[0].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[0].offset = offsetof(Vertex, pos);

        attributeDescriptions[1].binding = 0;
        attributeDescriptions[1].location = 1;
        attributeDescriptions[1].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[1].offset = offsetof(Vertex, color);

        return attributeDescriptions;
    }
```

Färgen kommer från binding 0 (samma vertex buffer), går till `location = 1` i vertex shadern, består av tre
32-bitars floats (`VK_FORMAT_R32G32B32_SFLOAT`, samma format som en `vec3`) och börjar `offsetof(Vertex, color)`
byte – 12 – in i varje vertex. `createGraphicsPipeline()` skickar redan `attributeDescriptions.size()` till vertex
input state, så inget annat i pipelinen ändras.

Eftersom vi nu har mer data att skicka till vertex shadern måste vi ändra vertex shadern så att den också tar emot
färgvärdet som ett vertexattribut, på location 1, och skickar det vidare till fragment shadern:

```glsl
#version 450

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inColor;

layout(location = 0) out vec3 fragColor;

void main() {
    gl_Position = vec4(inPosition, 1.0);
    fragColor = inColor;
}
```

Fragment shadern läser inte längre push constanten, utan färgen från vertex shadern:

```glsl
#version 450

layout(location = 0) in vec3 fragColor;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(fragColor, 1.0);
}
```

C++-koden skickar fortfarande färgen varje bildruta. Det gör inget – ingenting läser den längre – och vi
återanvänder push constanten i övningarna.
:::
:::d3d12
I Direct3D 12 beskrivs vertexdatan av structen `Vertex`, så vi lägger till en medlem för färgen:

```cpp
    struct Vertex
    {
        XMFLOAT3 position;
        XMFLOAT3 color;
    };
```

och ger varje vertex sin färg i `LoadAssets()`:

```cpp
        Vertex vertices[] =
        {
            // position               color
            { { 0.0f, 0.5f, 0.0f },   { 0.0f, 0.0f, 1.0f } },    // top: blue
            { { 0.5f, -0.5f, 0.0f },  { 1.0f, 0.0f, 0.0f } },    // bottom right: red
            { { -0.5f, -0.5f, 0.0f }, { 0.0f, 1.0f, 0.0f } }     // bottom left: green
        };
```

Varje vertex är nu 6 floats i minnet:

| Byteoffset | 0 | 4 | 8 | 12 | 16 | 20 | 24 | 28 | … |
|---|---|---|---|---|---|---|---|---|---|
| Värde | x | y | z | r | g | b | x | y | … |
| Hör till | vertex 1 `position` | | | vertex 1 `color` | | | vertex 2 `position` | | |

Vertex buffer viewns `StrideInBytes` är `sizeof(Vertex)`, som växer från 12 till 24 byte av sig själv. Det vi
behöver är ett andra **input element** i input layouten:

```cpp
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "COLOR", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };
```

Fälten är: semantiknamnet (`"COLOR"`, som vertex shaderns parameter måste använda), semantikindex (0), formatet
(tre 32-bitars floats), input slot (vertex buffer 0), *aligned byte offset* – färgen börjar 12 byte in i varje
vertex, efter positionens tre floats – och till sist att det är data per vertex (den sista nollan spelar bara roll
för instansdata).

Eftersom vi nu har mer data att skicka till vertex shadern måste vi ändra vertex shadern så att den också tar emot
färgvärdet och skickar det vidare till pixel shadern. `cbuffer ColorConstants` och pixel shaderns `return color;`
försvinner igen, och `shaders.hlsl` blir:

```hlsl
// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float4 color : COLOR;            // out of the vertex shader, into the pixel shader
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float4 color : COLOR)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = position;
    result.color = color;    // the vertex's colour from the vertex buffer

    return result;
}

// The pixel shader: runs once per pixel the triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // The colour from the vertex shader, interpolated across the triangle.
    return input.color;
}
```

Färgparametern är en `float4` fast buffern innehåller tre floats: precis som med positionen fylls den saknade
fjärde komponenten (alfa) i med 1. C++-koden sätter fortfarande root constants varje bildruta. Det gör inget – ingen
shader läser dem längre – och vi återanvänder root parametern i övningarna.
:::

```quiz
Varje vertex innehåller nu 3 floats för positionen följda av 3 floats för färgen (en float är 4 byte). På vilken byteoffset börjar en vertex färg, och hur många byte är det från en vertex till nästa?
- [ ] Offset 24, 12 byte till nästa vertex
- [ ] Offset 0, 12 byte till nästa vertex
- [x] Offset 12, 24 byte till nästa vertex
- [ ] Offset 12, 12 byte till nästa vertex
---
Färgen kommer efter positionens tre floats: 3 × 4 = 12 byte. En hel vertex är 6 floats, så stride är 6 × 4 = 24 byte – för båda attributen, eftersom de ligger i samma buffer.
```

Gör nu uppgiften **vertex-colors**: lägg till färgerna i vertexdatan, beskriv det andra attributet och uppdatera
båda shaderna. När du kör programmet bör du få en triangel med ett rött, ett grönt och ett blått hörn och färger som
övergår mjukt i varandra däremellan.

Bilden är kanske inte riktigt vad du väntade dig, eftersom vi bara angav 3 färger och inte den enorma färgpalett vi
ser nu. Allt det är resultatet av något som kallas *fragmentinterpolering* i fragment shadern. När en triangel ritas
ger rasteriseringssteget oftast upphov till många fler fragment än det fanns vertices från början. Rasterizern
bestämmer sedan positionen för varje fragment utifrån var på triangeln det ligger. Utifrån de positionerna
*interpolerar* den alla fragment shaderns indatavariabler. Säg till exempel att vi har en linje där den övre punkten
är grön och den nedre blå. Om fragment shadern körs för ett fragment som ligger ungefär 70 % in på linjen blir dess
färgindata en linjärkombination av grönt och blått; närmare bestämt 30 % blått och 70 % grönt.

Det är precis vad som hände med triangeln. Vi har 3 vertices och alltså 3 färger, och av triangelns pixlar att döma
innehåller den runt 60000 fragment, där fragment shadern har interpolerat färgerna mellan pixlarna. Om du tittar
noga på färgerna ser du att allt går ihop: från rött till blått blir det först lila och sedan blått.
Fragmentinterpolering tillämpas på alla fragment shaderns indataattribut.

```quiz
Ett fragment ligger exakt mitt på kanten mellan det röda hörnet (1, 0, 0) och det gröna hörnet (0, 1, 0). Vilken färg får fragment shadern?
- [ ] Rött eller grönt, beroende på vilket hörn rasterizern behandlade först
- [ ] (1.0, 1.0, 0.0): båda färgerna adderade
- [x] (0.5, 0.5, 0.0): hälften rött och hälften grönt
- [ ] Det tredje hörnets färg, blått
---
Vertex shaderns utdata interpoleras linjärt över triangeln. Mitt på en kant bidrar de två hörnen med 50 % var, och det tredje hörnet (som inte ligger på kanten) bidrar inte alls.
```

## Vår egen shaderklass

:::opengl
Att skriva, kompilera och hantera shaders kan vara ganska omständligt. Som en sista touch på shaderämnet ska vi göra
livet lite enklare genom att bygga en shaderklass som läser shaders från disk, kompilerar och länkar dem, letar
efter fel och är lätt att använda. Det ger dig också en idé om hur vi kan kapsla in en del av det vi har lärt oss
hittills i användbara abstrakta objekt. Det här är klassen i `shader_s.h` som projektet har använt från början.

Vi skapar shaderklassen helt i en headerfil, främst av pedagogiska skäl och för portabilitetens skull. Låt oss börja
med att lägga till de includes som behövs och definiera klassens struktur:

```cpp
#ifndef SHADER_H
#define SHADER_H

#include <glad/glad.h>

#include <string>
#include <fstream>
#include <sstream>
#include <iostream>

class Shader
{
public:
    unsigned int ID;
    // constructor generates the shader on the fly
    Shader(const char* vertexPath, const char* fragmentPath);
    // activate the shader
    void use();
    // utility uniform functions
    void setBool(const std::string &name, bool value) const;
    void setInt(const std::string &name, int value) const;
    void setFloat(const std::string &name, float value) const;
};

#endif
```

> Vi använde flera preprocessordirektiv överst i headerfilen. De här små raderna säger åt kompilatorn att bara
> inkludera och kompilera headerfilen om den inte redan har inkluderats, även om flera filer inkluderar
> shaderheadern. Det förhindrar länkningskonflikter.

Shaderklassen håller shaderprogrammets ID. Dess konstruktor kräver sökvägarna till vertex- respektive
fragment shaderns källkod, som vi kan lagra på disk som vanliga textfiler. Som en liten extra finess lägger vi
också till några hjälpfunktioner som gör livet lite enklare: `use` aktiverar shaderprogrammet, och alla
`set…`-funktioner slår upp en uniforms location och sätter dess värde. (I `shader_s.h` är funktionerna skrivna
direkt i klassens kropp; deklarationerna ovan visar dess form.)
:::
:::vulkan
I OpenGL skriver learnopengl.com nu en liten klass `Shader` som läser GLSL-källfilerna medan programmet körs och
låter drivrutinen kompilera och länka dem. Vulkan har inget sådant steg när programmet körs: det finns ingen
GLSL-kompilator i Vulkan-drivrutinen och inget "shaderprogram"-objekt att länka. I stället delas arbetet upp
annorlunda:

1. **Innan programmet körs** kompileras GLSL-filerna till SPIR-V av `glslc`, kompilatorn från Googles shaderc-projekt
   som följer med Vulkan SDK. När du bygger gör bygget precis det som vulkan-tutorials `compile`-skript gör:

   ```text
   glslc shaders/shader.vert -o shaders/vert.spv
   glslc shaders/shader.frag -o shaders/frag.spv
   ```

   Ett fel i en shader rapporteras därför av bygget, innan programmet startar – inte medan programmet körs som i
   OpenGL.
2. **När programmet körs** läser det de två `.spv`-filerna som råa byte och lägger var och en i en
   `VkShaderModule`.
3. Shadermodulerna sätts in i grafikpipelinen som *shader stages*, med startpunktens namn (`"main"`). Det är
   pipelinen som spelar rollen som OpenGL:s länkade shaderprogram: den knyter ihop stegen, tillsammans med allt
   fixed-function-tillstånd.

Det närmaste en "shaderklass" i vårt Vulkan-program är alltså hjälpfunktionerna `readFile` och
`createShaderModule`, och början av `createGraphicsPipeline()`:

```cpp
    void createGraphicsPipeline() {
        auto vertShaderCode = readFile("shaders/vert.spv");
        auto fragShaderCode = readFile("shaders/frag.spv");

        VkShaderModule vertShaderModule = createShaderModule(vertShaderCode);
        VkShaderModule fragShaderModule = createShaderModule(fragShaderCode);

        VkPipelineShaderStageCreateInfo vertShaderStageInfo{};
        vertShaderStageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
        vertShaderStageInfo.stage = VK_SHADER_STAGE_VERTEX_BIT;
        vertShaderStageInfo.module = vertShaderModule;
        vertShaderStageInfo.pName = "main";
```

Shadermodulerna behövs bara medan pipelinen skapas – det är då SPIR-V översätts till GPU:ns egen maskinkod – så
`createGraphicsPipeline()` förstör dem igen i slutet.
:::
:::d3d12
I OpenGL skriver learnopengl.com nu en liten klass `Shader` som läser GLSL-källfilerna medan programmet körs och
låter drivrutinen kompilera och länka dem. Direct3D 12-exemplet behöver ingen klass för det: båda shaderna ligger i
en fil, `shaders.hlsl`, och HLSL-kompilatorn är ett bibliotek som programmet anropar själv – `D3DCompileFromFile`
från `d3dcompiler.lib`. I `LoadAssets()`:

```cpp
        ComPtr<ID3DBlob> vertexShader;
        ComPtr<ID3DBlob> pixelShader;

#if defined(_DEBUG)
        // Enable better shader debugging with the graphics debugging tools.
        UINT compileFlags = D3DCOMPILE_DEBUG | D3DCOMPILE_SKIP_OPTIMIZATION;
#else
        UINT compileFlags = 0;
#endif

        // Compile the vertex shader (VSMain) and the pixel shader (PSMain) in shaders.hlsl.
        ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));
```

Samma fil kompileras två gånger, varje gång för en annan **startpunkt** (`"VSMain"`, `"PSMain"`) och ett annat
**target** (`"vs_5_0"`: en vertex shader för shader model 5.0; `"ps_5_0"`: en pixel shader). Resultatet är bytekod i
en `ID3DBlob`. Bytekoden lämnas sedan till pipeline state-objektet, `psoDesc.VS` och `psoDesc.PS`, som spelar
rollen som OpenGL:s länkade shaderprogram: det knyter ihop stegen, input layouten, root signaturen och allt
fixed-function-tillstånd.

Att kompilera medan programmet körs är bekvämt när man lär sig, eftersom du kan ändra `shaders.hlsl` utan att bygga
om C++-programmet. Riktiga program kompilerar oftast sina shaders i förväg i stället – med offlinekompilatorerna
`fxc` (shader model 5) eller `dxc` (shader model 6 och senare) – och läser in bytekoden från en fil, ungefär som
Vulkan läser in SPIR-V.
:::

## Läsa från fil

:::opengl
Vi använder C++-filströmmar för att läsa filernas innehåll till några `string`-objekt:

```cpp
    Shader(const char* vertexPath, const char* fragmentPath)
    {
        // 1. retrieve the vertex/fragment source code from filePath
        std::string vertexCode;
        std::string fragmentCode;
        std::ifstream vShaderFile;
        std::ifstream fShaderFile;
        // ensure ifstream objects can throw exceptions:
        vShaderFile.exceptions (std::ifstream::failbit | std::ifstream::badbit);
        fShaderFile.exceptions (std::ifstream::failbit | std::ifstream::badbit);
        try
        {
            // open files
            vShaderFile.open(vertexPath);
            fShaderFile.open(fragmentPath);
            std::stringstream vShaderStream, fShaderStream;
            // read file's buffer contents into streams
            vShaderStream << vShaderFile.rdbuf();
            fShaderStream << fShaderFile.rdbuf();
            // close file handlers
            vShaderFile.close();
            fShaderFile.close();
            // convert stream into string
            vertexCode   = vShaderStream.str();
            fragmentCode = fShaderStream.str();
        }
        catch (std::ifstream::failure& e)
        {
            std::cout << "ERROR::SHADER::FILE_NOT_SUCCESSFULLY_READ: " << e.what() << std::endl;
        }
        const char* vShaderCode = vertexCode.c_str();
        const char * fShaderCode = fragmentCode.c_str();
```

Sedan måste vi kompilera och länka shaderna. Observera att vi också kontrollerar om kompileringen eller länkningen
misslyckades och i så fall skriver ut felen. Det är oerhört användbart vid felsökning (du kommer att behöva de
felloggarna förr eller senare):

```cpp
        // 2. compile shaders
        unsigned int vertex, fragment;
        // vertex shader
        vertex = glCreateShader(GL_VERTEX_SHADER);
        glShaderSource(vertex, 1, &vShaderCode, NULL);
        glCompileShader(vertex);
        checkCompileErrors(vertex, "VERTEX");
        // fragment Shader
        fragment = glCreateShader(GL_FRAGMENT_SHADER);
        glShaderSource(fragment, 1, &fShaderCode, NULL);
        glCompileShader(fragment);
        checkCompileErrors(fragment, "FRAGMENT");
        // shader Program
        ID = glCreateProgram();
        glAttachShader(ID, vertex);
        glAttachShader(ID, fragment);
        glLinkProgram(ID);
        checkCompileErrors(ID, "PROGRAM");
        // delete the shaders as they're linked into our program now and no longer necessary
        glDeleteShader(vertex);
        glDeleteShader(fragment);
    }
```

`checkCompileErrors` är en liten privat hjälpfunktion i klassen: för en shader kontrollerar den
`GL_COMPILE_STATUS` med `glGetShaderiv` och skriver ut `glGetShaderInfoLog`; för programmet kontrollerar den
`GL_LINK_STATUS` med `glGetProgramiv` och skriver ut `glGetProgramInfoLog` – samma kontroller som du skrev i
*Hello Triangle*.

Funktionen `use` är enkel:

```cpp
    void use()
    {
        glUseProgram(ID);
    }
```

Likaså uniform-funktionerna:

```cpp
    void setBool(const std::string &name, bool value) const
    {
        glUniform1i(glGetUniformLocation(ID, name.c_str()), (int)value);
    }
    // ------------------------------------------------------------------------
    void setInt(const std::string &name, int value) const
    {
        glUniform1i(glGetUniformLocation(ID, name.c_str()), value);
    }
    // ------------------------------------------------------------------------
    void setFloat(const std::string &name, float value) const
    {
        glUniform1f(glGetUniformLocation(ID, name.c_str()), value);
    }
```

Och där har vi en färdig shaderklass. Den är ganska lätt att använda; vi skapar ett shaderobjekt en gång och sedan
börjar vi helt enkelt använda det:

```cpp
    Shader ourShader("shader.vs", "shader.fs"); // you can name your shader files however you like
```

och i renderingsloopen:

```cpp
        ourShader.use();
        glBindVertexArray(VAO);
        glDrawArrays(GL_TRIANGLES, 0, 3);
```

Här har vi lagt vertex- och fragment shaderns källkod i två filer som heter `shader.vs` och `shader.fs`. Du får
döpa dina shaderfiler hur du vill; filändelserna `.vs` och `.fs` är ganska intuitiva.
:::
:::vulkan
`readFile` är vulkan-tutorials hjälpfunktion som läser in alla byte i en fil i en `std::vector<char>`:

```cpp
    static std::vector<char> readFile(const std::string& filename) {
        std::ifstream file(filename, std::ios::ate | std::ios::binary);

        if (!file.is_open()) {
            throw std::runtime_error("failed to open file!");
        }

        size_t fileSize = (size_t) file.tellg();
        std::vector<char> buffer(fileSize);

        file.seekg(0);
        file.read(buffer.data(), fileSize);

        file.close();

        return buffer;
    }
```

Två flaggor spelar roll här. `std::ios::binary` läser filen som råa byte – SPIR-V är ett binärt format, och
textläge skulle kunna ändra byte som ser ut som radslut. `std::ios::ate` börjar läsa i slutet av filen, så att
`tellg()` direkt ger oss filens storlek och vi kan allokera buffern; sedan söker vi tillbaka till början och läser
allt på en gång.

`createShaderModule` lägger byten i en shadermodul:

```cpp
    VkShaderModule createShaderModule(const std::vector<char>& code) {
        VkShaderModuleCreateInfo createInfo{};
        createInfo.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
        createInfo.codeSize = code.size();
        createInfo.pCode = reinterpret_cast<const uint32_t*>(code.data());

        VkShaderModule shaderModule;
        if (vkCreateShaderModule(device, &createInfo, nullptr, &shaderModule) != VK_SUCCESS) {
            throw std::runtime_error("failed to create shader module!");
        }

        return shaderModule;
    }
```

`codeSize` anges i byte, men `pCode` är en pekare till `uint32_t`, eftersom SPIR-V består av 32-bitarsord.
`reinterpret_cast` är säker här eftersom `std::vector`s standardallokerare ger minne som är tillräckligt justerat
för det.

Lägg märke till vad som *inte* finns här jämfört med OpenGL: inget kompileringssteg och ingen infolog. GLSL-koden har
redan kontrollerats och kompilerats av `glslc` under bygget. När du gör ett fel i en shader i övningarna nedan visas
felet i din IDE:s byggutdata med filnamn och rad, och programmet körs inte alls.
:::
:::d3d12
`D3DCompileFromFile` läser filen åt oss, så vi har ingen egen kod för att läsa filer. Dess parametrar, i ordning:

| Parameter | Värde här | Betydelse |
|---|---|---|
| `pFileName` | `L"shaders.hlsl"` | källfilen (en wide string) |
| `pDefines` | `nullptr` | valfria preprocessormakron |
| `pInclude` | `nullptr` | hur `#include` i shadern ska hanteras (inget här) |
| `pEntrypoint` | `"VSMain"` / `"PSMain"` | funktionen som ska kompileras |
| `pTarget` | `"vs_5_0"` / `"ps_5_0"` | shadersteget och shader model |
| `Flags1` | `compileFlags` | i debugbyggen: felsökningsinformation och ingen optimering |
| `Flags2` | `0` | används bara för effektfiler |
| `ppCode` | `&vertexShader` / `&pixelShader` | tar emot bytekoden |
| `ppErrorMsgs` | `nullptr` | skulle kunna ta emot kompilatorns felmeddelanden |

Om kompileringen misslyckas returnerar funktionen ett `HRESULT` som anger fel, och `ThrowIfFailed` stoppar
programmet med ett undantag. Eftersom vi skickar `nullptr` som sista parameter får vi inte se *varför* det
misslyckades. När du skriver större shaders lönar det sig att skicka en `ID3DBlob` där och skriva ut dess text
(`GetBufferPointer()`) vid fel – motsvarigheten till OpenGL:s `glGetShaderInfoLog`.

Bytekoden används när pipeline state-objektet beskrivs:

```cpp
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(vertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(pixelShader.Get());
```

`CD3DX12_SHADER_BYTECODE` (från hjälpheadern `d3dx12.h`) fyller i en pekare till blobbens byte och deras storlek.
När `CreateGraphicsPipelineState` har returnerat har pipelinen en egen kopia, och blobbarna släpps när
`ComPtr`-objekten går ur scope.
:::

:::opengl
```quiz
När kompileras det här projektets shaders?
- [ ] Innan programmet körs, av bygget
- [x] Medan programmet körs: konstruktorn i `Shader` läser filerna och låter drivrutinen kompilera och länka dem
- [ ] Aldrig: GPU:n kör GLSL-källtexten direkt
---
OpenGL kompilerar GLSL medan programmet körs, i drivrutinen: `glCompileShader` och `glLinkProgram` i konstruktorn i `Shader`.
```
:::
:::vulkan
```quiz
När kompileras det här projektets shaders?
- [ ] Aldrig: GPU:n kör GLSL-källtexten direkt
- [ ] Medan programmet körs: drivrutinen kompilerar GLSL-källtexten
- [x] Innan programmet körs: `glslc` kompilerar dem till SPIR-V, som programmet läser in när det körs
---
Vulkan tar bara emot SPIR-V, så GLSL-koden kompileras i förväg. När programmet körs översätter drivrutinen SPIR-V till GPU:ns egen kod när pipelinen skapas.
```
:::
:::d3d12
```quiz
När kompileras det här projektets shaders?
- [ ] Aldrig: GPU:n kör HLSL-källtexten direkt
- [ ] Innan programmet körs, av C++-bygget
- [x] Medan programmet körs: `D3DCompileFromFile` kompilerar `shaders.hlsl` till bytekod för pipeline state-objektet
---
Exemplet kompilerar HLSL medan programmet körs med biblioteket D3DCompiler; riktiga program kompilerar ofta i förväg med `fxc` eller `dxc`.
```
:::

## Övningar

1. Ändra vertex shadern så att triangeln blir upp och ner.
2. Ange en horisontell offset via ett värde som sätts från CPU:n och flytta triangeln till höger sida av skärmen i
   vertex shadern med hjälp av den.
3. Skicka vertexpositionen till fragment shadern och sätt fragmentets färg till den positionen (se hur även
   positionsvärdena interpoleras över triangeln). När du har fått det att fungera, försök att svara på följande
   fråga: varför är ett av triangelns hörn svart?

De tre sista uppgifterna är de här övningarna. Var och en bygger på den förra, så triangeln du slutar med är upp och
ner, flyttad åt höger och färgad efter sin position.

### Upp och ner

:::opengl
För att vända triangeln upp och ner negerar du positionens y-koordinat i vertex shadern:

```glsl
    gl_Position = vec4(aPos.x, -aPos.y, aPos.z, 1.0); // just add a - to the y position
```

Det är allt OpenGL behöver. Att vända y speglar också triangeln: hörnen, som gick medurs på skärmen, går nu moturs.
Det skulle spela roll om *face culling* var påslaget, eftersom OpenGL då avgör vilken sida av triangeln vi tittar på
utifrån den ordningen. Men face culling är **avslaget** som standard i OpenGL (vi slår på det i kapitlet
*Face culling*), så båda sidorna ritas och den vända triangeln syns helt enkelt.

Gör nu uppgiften **upside-down**.
:::
:::vulkan
För att vända triangeln upp och ner negerar du positionens y-koordinat i vertex shadern:

```glsl
    gl_Position = vec4(inPosition.x, -inPosition.y, inPosition.z, 1.0);
```

Prova bara den ändringen först och bygg: triangeln är borta! Orsaken finns i pipelinens rasterizer state. Vår
pipeline har back-face culling påslaget (`rasterizer.cullMode = VK_CULL_MODE_BACK_BIT`), och den avgör vilken sida
av en triangel som är vänd mot oss utifrån hörnens ordning på skärmen: med
`rasterizer.frontFace = VK_FRONT_FACE_CLOCKWISE` är en triangel vars hörn går medurs en framsida. Våra vertices –
överst, nere till höger, nere till vänster – går medurs. Att spegla triangeln i y speglar också den ordningen:
hörnen går nu moturs, triangeln vänder baksidan mot oss och rasterizern tar bort den.

Eftersom vi vände triangeln med flit talar vi om för pipelinen att trianglar som går moturs nu är framsidor, i
`createGraphicsPipeline()`:

```cpp
        rasterizer.frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE; // the flip in the vertex shader mirrors the winding order
```

(Att slå av culling med `VK_CULL_MODE_NONE` skulle också fungera; vulkan-tutorial gör samma `frontFace`-ändring
senare, när dess projektionsmatris vänder y.) Gör nu uppgiften **upside-down**.
:::
:::d3d12
För att vända triangeln upp och ner negerar du positionens y-koordinat i vertex shadern:

```hlsl
    result.position = float4(position.x, -position.y, position.z, 1.0f);    // y flipped: upside down
```

Prova bara den ändringen först och bygg: triangeln är borta! Orsaken finns i pipeline state-objektets rasterizer
state. `CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT)` tar bort baksidor (`CullMode = D3D12_CULL_MODE_BACK`), och med
`FrontCounterClockwise = FALSE` är en triangel vars hörn går medurs på skärmen en framsida. Våra vertices – överst,
nere till höger, nere till vänster – går medurs. Att spegla triangeln i y speglar också den ordningen: hörnen går
nu moturs, triangeln blir en baksida och rasterizern tar bort den.

Så vi ritar båda sidorna: efter att standardvärdet för rasterizer state har satts i `LoadAssets()` slår vi av
culling:

```cpp
        psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);
        // Flipping y turns clockwise triangles counter-clockwise: back faces, which the
        // default state culls. Draw both sides.
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;
```

(Att i stället sätta `FrontCounterClockwise = TRUE` skulle också fungera.) Gör nu uppgiften **upside-down**.
:::

:::opengl
```quiz
När du har negerat y i vertex shadern kommer triangelns hörn i omvänd ordning på skärmen. Varför ritas triangeln ändå i OpenGL?
- [x] Face culling är avslaget som standard, så OpenGL ritar båda sidorna av en triangel
- [ ] OpenGL vänder automatiskt tillbaka vertexordningen
- [ ] Hörnens ordning spelar bara roll för fragment shadern
---
Hörnens ordning (winding order) avgör vilken sida av en triangel som är framsidan. Det spelar bara roll när `glEnable(GL_CULL_FACE)` slår på face culling, vilket det här projektet inte gör.
```
:::
:::vulkan
```quiz
Varför ändrar uppgiften upside-down också `rasterizer.frontFace` till `VK_FRONT_FACE_COUNTER_CLOCKWISE`?
- [ ] Eftersom Vulkans y-axel pekar nedåt behöver varje shader som ändrar y det
- [x] Att vända y kastar om hörnens ordning på skärmen, så med back-face culling skulle triangeln annars tas bort
- [ ] För att färgerna ska interpoleras åt rätt håll
---
Pipelinen tar bort baksidor och avgör framsidan utifrån hörnens ordning på skärmen. Vändningen gör vår medurs triangel moturs, så vi förklarar att trianglar som går moturs är framsidor.
```
:::
:::d3d12
```quiz
Varför sätter uppgiften upside-down också `CullMode` till `D3D12_CULL_MODE_NONE`?
- [x] Att vända y kastar om hörnens ordning på skärmen, så triangeln blir en baksida, som standardvärdet för rasterizer state tar bort
- [ ] För att färgerna ska interpoleras åt rätt håll
- [ ] Eftersom pixel shadern inte kan skriva till en speglad triangel
---
Standardvärdet för rasterizer state räknar trianglar som går medurs som framsidor och tar bort baksidor. Efter vändningen går vår triangel moturs på skärmen, så vi ritar båda sidorna.
```
:::

### Horisontell offset

:::opengl
För offseten använder vi en uniform `float` i vertex shadern och lägger till den till x-koordinaten:

```glsl
uniform float xOffset;

void main()
{
    gl_Position = vec4(aPos.x + xOffset, -aPos.y, aPos.z, 1.0); // still upside down, and moved to the right by xOffset
```

I renderingsloopen sätter vi den med shaderklassens `setFloat`, direkt efter `ourShader.use();`:

```cpp
        ourShader.use();
        float offset = 0.5f;
        ourShader.setFloat("xOffset", offset);
```

Gör nu uppgiften **offset**. Normaliserade enhetskoordinater går från -1 till 1 över fönstret, så en offset på 0.5
är en fjärdedel av fönstrets bredd: 200 pixlar i vårt 800 pixlar breda fönster.
:::
:::vulkan
För offseten använder vi push constanten igen, nu i vertex shadern. Blocket i `shader.vert` får en enda `float`:

```glsl
layout(push_constant) uniform PushConstants {
    float xOffset;
} pc;
```

och positionen blir:

```glsl
    gl_Position = vec4(inPosition.x + pc.xOffset, -inPosition.y, inPosition.z, 1.0);
```

På C++-sidan ändras structen så att den motsvarar blocket:

```cpp
struct PushConstants {
    float xOffset;
};
```

Eftersom push constants nu läses av vertex shadern måste intervallet i pipeline layouten ange det steget:

```cpp
        pushConstantRange.stageFlags = VK_SHADER_STAGE_VERTEX_BIT;
```

och i `recordCommandBuffer()` ersätts tidskoden och färgen av offseten, som skickas för vertexsteget:

```cpp
        PushConstants constants{};
        constants.xOffset = 0.5f;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
```

Includerna `<chrono>` och `<cmath>` behövs inte längre. Gör nu uppgiften **offset**. Normaliserade
enhetskoordinater går från -1 till 1 över fönstret, så en offset på 0.5 är en fjärdedel av fönstrets bredd:
200 pixlar i vårt 800 pixlar breda fönster.
:::
:::d3d12
För offseten återanvänder vi root parameter 0, nu med ett enda 32-bitarsvärde. I `shaders.hlsl` får constant
buffern ett nytt namn och en ny medlem:

```hlsl
cbuffer OffsetConstants : register(b0)
{
    float xOffset;
};
```

och positionen blir:

```hlsl
    result.position = float4(position.x + xOffset, -position.y, position.z, 1.0f);    // upside down, moved right
```

På C++-sidan blir `ColorConstants`:

```cpp
    // The root constants: what the shaders see as cbuffer OffsetConstants.
    struct OffsetConstants
    {
        float xOffset;
    };
```

så `InitAsConstants(sizeof(OffsetConstants) / 4, 0)` deklarerar nu ett 32-bitarsvärde, och i
`PopulateCommandList()` ersätts tidskoden och färgen av:

```cpp
    // The offset for the vertex shader: moves the triangle to the right.
    OffsetConstants offsetConstants = {};
    offsetConstants.xOffset = 0.5f;
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(OffsetConstants) / 4, &offsetConstants, 0);
```

Root parametern behöver ingen ändrad synlighet: `InitAsConstants` gör den synlig för alla shadersteg som standard.
Includerna `<chrono>` och `<cmath>` behövs inte längre. Gör nu uppgiften **offset**. Koordinaterna i clip space går
från -1 till 1 över fönstret, så en offset på 0.5 är en fjärdedel av fönstrets bredd: 200 pixlar i vårt 800 pixlar
breda fönster.
:::

### Positionen som färg

:::opengl
I den sista övningen ger vertex shadern ut positionen i stället för färgen. Kommentera bort `ourColor`-raderna och
lägg till en utdata `ourPosition`:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;

// out vec3 ourColor;
out vec3 ourPosition;

uniform float xOffset;

void main()
{
    gl_Position = vec4(aPos.x + xOffset, -aPos.y, aPos.z, 1.0); // still upside down, and moved to the right by xOffset
    // ourColor = aColor;
    ourPosition = aPos;
}
```

```glsl
#version 330 core
out vec4 FragColor;

// in vec3 ourColor;
in vec3 ourPosition;

void main()
{
    FragColor = vec4(ourPosition, 1.0); // note how the position value is linearly interpolated to get all the different colors
}
```

Kom ihåg att utdatan och indatan måste ha samma namn för att kopplas ihop. Gör nu uppgiften **position-color**.
:::
:::vulkan
I den sista övningen ger vertex shadern ut positionen i stället för färgen. Bara en rad ändras, eftersom
`fragColor` är en `vec3` precis som `inPosition`:

```glsl
    fragColor = inPosition; // the position as the color (negative values become 0)
```

Gör nu uppgiften **position-color**.
:::
:::d3d12
I den sista övningen ger vertex shadern ut positionen i stället för färgen. Bara en rad ändras:

```hlsl
    result.color = position;    // the position as the colour: x -> red, y -> green, z -> blue
```

`position` är indatan `(x, y, z, 1)` av typen `float4`, så x blir rött, y grönt, z (alltid 0 här) blått, och alfa
blir 1. Gör nu uppgiften **position-color**.
:::

Lägg märke till att färgen kommer från *indatapositionen*, före vändningen och offseten. Vertexens x-, y- och
z-koordinater blir rött, grönt och blått i dess färg, och som all utdata från vertex shadern interpoleras de över
triangeln.

Så varför är ett hörn svart? Våra vertexpositioner går från -0.5 till 0.5, så några av färgkomponenterna är
**negativa**. En färgkomponent kan inte vara mörkare än 0: när fragmentets färg skrivs till fönstrets färgbuffer,
som lagrar varje komponent som ett normaliserat värde utan tecken mellan 0.0 och 1.0, kläms allt under 0.0 till 0.0
(och allt över 1.0 till 1.0).

:::opengl
Vertexen på `(-0.5, -0.5, 0.0)` – den ursprungliga triangelns nedre vänstra hörn, nu det övre vänstra eftersom
triangeln är upp och ner – har negativt x och negativt y: dess färg blir (0, 0, 0), svart. De andra två hörnen får
(0.5, 0.0, 0.0), mörkrött (x = 0.5, y = -0.5 klämt till 0), och (0.0, 0.5, 0.0), mörkgrönt. Och eftersom de
interpolerade värdena förblir negativa en bra bit från det hörnet är ett stort område runt det också svart.
:::
:::vulkan
I Vulkan är den ursprungliga triangelns övre vertex `(0.0, -0.5, 0.0)` (y pekar nedåt): x är 0 och y är negativt,
så dess färg blir (0, 0, 0), svart – det hörnet ligger nu nederst, eftersom triangeln är upp och ner. De andra två
hörnen får (-0.5, 0.5, 0.0) → (0.0, 0.5, 0.0), grönt, och (0.5, 0.5, 0.0), olivgrönt. Och eftersom de
interpolerade värdena förblir negativa en bra bit från det hörnet är ett stort område runt det också svart.
:::
:::d3d12
Vertexen på `(-0.5, -0.5, 0.0)` – den ursprungliga triangelns nedre vänstra hörn, nu det övre vänstra eftersom
triangeln är upp och ner – har negativt x och negativt y: dess färg blir (0, 0, 0), svart. De andra två hörnen får
(0.5, 0.0, 0.0), mörkrött (x = 0.5, y = -0.5 klämt till 0), och (0.0, 0.5, 0.0), mörkgrönt. Och eftersom de
interpolerade värdena förblir negativa en bra bit från det hörnet är ett stort område runt det också svart.
:::

```quiz
Varför är ett av triangelns hörn svart när positionen ges ut som färg?
- [ ] Rasterizern interpolerar inte positioner, bara färger
- [x] Dess x och y är inte positiva, och färgkomponenter under 0 kläms till 0 när de skrivs till färgbuffern
- [ ] Offseten skjuter ut hörnet utanför fönstret
- [ ] Vertex shadern skriver inte längre någon färg för den vertexen
---
Positioner från -0.5 till 0.5 blir färger från -0.5 till 0.5. Färgbuffern lagrar värden mellan 0 och 1, så en vertex med bara noll eller negativa komponenter blir svart – och det blir också området där de interpolerade värdena fortfarande är negativa.
```

Nu har du sett hela vägen som data tar genom shaderna: från vertex buffern in i vertex shadern, från vertex shadern
in i fragment shadern med interpolering däremellan, och från programmet in i shaderna med
:::opengl
uniforms. I nästa kapitel, *Textures*, tar vi in bilder i shaderna.
:::
:::vulkan
push constants. I nästa kapitel, *Textures*, tar vi in bilder i shaderna.
:::
:::d3d12
root constants. I nästa kapitel, *Textures*, tar vi in bilder i shaderna.
:::
