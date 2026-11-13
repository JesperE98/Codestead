# Sätt upp din IDE

Från och med nästa kapitel skriver du kod – och du skriver den så som grafikprogrammerare gör: i en riktig IDE, med en
riktig kompilator, och bygger ett program som öppnar ett riktigt fönster på din egen dator. Den här appen är din
lärobok och din granskare. Den visar texten, uppgifterna och en bild av resultatet som varje uppgift ska ge. Du bockar
själv av en uppgift när ditt program gör det som uppgiften ber om – och när du vill läser appen din kod och kontrollerar
den med kursens egna kontroller.

learnopengl.com ägnar en god del av sitt kapitel *Creating a window* åt att sätta upp ett projekt, och det gör
vulkan-tutorial.com också i sitt kapitel *Development environment*. Det här kapitlet gör detsamma för kursens tre
API:er: du väljer en IDE, installerar en kompilator, hämtar de bibliotek som {{api}} behöver, sätter upp
projektfilerna och lär dig hur panelen **Ditt projekt** fungerar. Kapitlet har inga uppgifter, men dess startfiler
är triangelprogrammet från introduktionen, så i slutet kan du kontrollera att allt fungerar.

Välj din IDE i väljaren **IDE** överst i fönstret, bredvid API:et. Från och med nu visar kapitlen stegen för den IDE
du har valt, överallt där IDE:erna skiljer sig åt – du kan byta när som helst.

## Så arbetar du i kursen

Varje kapitel med uppgifter har **startfiler**: `main.cpp`, och från senare kapitel även headerfiler, shaderfiler,
texturer, modeller och typsnitt. `// TODO:`-kommentarerna i dem visar var din kod ska stå. Var du har din kod
bestämmer du själv: dina egna mappar, ett projekt per kapitel eller ett för hela kursen, den IDE du gillar. Panelen
**Ditt projekt** kopplar ihop kapitlet med din kod:

1. **Spara startfilerna…** frågar efter en mapp och kopierar kapitlets startfiler dit: `main.cpp`, shaderna och
   kursens texturer, modeller och typsnitt. Om en fil redan finns där frågar appen innan den skriver över den. Sedan
   lägger du till dina projektfiler – se nedan – och öppnar projektet i din IDE.
2. Du skriver koden för en uppgift, **bygger** programmet och **kör** det från din IDE. Det är så du ser vad din kod
   gör: jämför ditt fönster med **Förväntat resultat**, bilden som panelen visar för varje uppgift.
3. När ditt program gör det som uppgiften ber om bockar du av den med **Markera som klar**. XP, dagar i rad och
   utmärkelser räknas precis som förut.
4. När du vill ha en extra koll trycker du på **Kontrollera min kod**. Första gången frågar den efter kapitlets
   huvudfil – `main.cpp`, eller vad du nu döpte den till – var den än ligger på din disk. (Efter **Spara
   startfilerna…** använder den redan den `main.cpp` som sparades.) Appen läser den filen och kapitlets övriga filer –
   shaders och headerfiler – som den hittar bredvid den, i mapparna under den eller i mappen ovanför, och kontrollerar
   dem med kursens egna kontroller. Den bockar av varje uppgift som klarar kontrollen och talar om vad som fortfarande
   saknas för de andra. **Byt fil…** väljer en annan fil.

**Kontrollera min kod** läser bara dina källfiler: ingenting behöver byggas eller köras för den. Bygg och kör ändå ditt
program – en kontroll kan se att rätt anrop finns där, men bara ditt fönster visar vad de ritar.

Uppgifterna är låsta tills du har svarat på frågorna i texten.

```quiz
Du gör klart en uppgift i `main.cpp` och sparar filen. Hur kan uppgiften bli avbockad? (Välj alla som stämmer.)
- [x] Du bockar av den själv med **Markera som klar**, när ditt program gör det som uppgiften ber om
- [ ] Appen märker att du har byggt och kört programmet, och bockar av den
- [x] Du trycker på **Kontrollera min kod**, och kursens kontroller för uppgiften godkänns
- [ ] Du sparar startfilerna igen med **Spara startfilerna…**
---
Appen följer inte din IDE: du bockar av en uppgift själv, eller låter **Kontrollera min kod** läsa dina källfiler och
bocka av varje uppgift som klarar kontrollen. Att spara startfilerna igen skulle skriva över ditt arbete.
```

## Välj en IDE

Vilken C++-IDE som helst duger, men kursen ger steg för fyra av dem:

| IDE | Körs på | Kostnad | Bra att veta |
|---|---|---|---|
| [Visual Studio](https://visualstudio.microsoft.com/) | Windows | Community-utgåvan är gratis för privatpersoner, studenter, öppen källkod och små team | Kommer med Microsofts kompilator (MSVC) och Windows SDK; det bästa valet för DirectX 12 |
| [CLion](https://www.jetbrains.com/clion/) | Windows, macOS, Linux | Gratis för icke-kommersiell användning; en betald licens för kommersiellt arbete | Byggd kring CMake; har med sig egen CMake och, på Windows, en egen MinGW-kompilator |
| [Rider](https://www.jetbrains.com/rider/) | Windows, macOS, Linux | Gratis för icke-kommersiell användning; en betald licens för kommersiellt arbete | Bygger C++ med Microsofts byggverktyg utifrån Visual Studio-solutions, vilket i praktiken betyder Windows |
| [Visual Studio Code](https://code.visualstudio.com/) | Windows, macOS, Linux | Gratis | En editor som blir en C++-IDE med Microsofts tillägg **C/C++** och **CMake Tools**; kompilatorn och CMake installerar du själv |

De fyra bygger kursens projekt på två sätt. **CLion** och **VS Code** använder **CMake**: en `CMakeLists.txt` i
kapitelmappen beskriver programmet. **Visual Studio** och **Rider** använder en **Visual Studio-solution**: en
`.sln`-fil och en projektfil, `.vcxproj`, vars inställningar anger include-mapparna, biblioteken och arbetskatalogen.
(Visual Studio kan också öppna en CMake-mapp, och Rider ett CMake-projekt; kursens steg för dem följer solutionen.)

:::opengl
För OpenGL fungerar alla. På Windows är Visual Studio det som learnopengl.com använder; på Linux och macOS CLion eller
VS Code. macOS kör fortfarande OpenGL upp till version 4.1 – utfasat, men tillräckligt för kursens 3.3 core profile.
:::
:::vulkan
För Vulkan fungerar alla. vulkan-tutorial.com visar Visual Studio på Windows och en makefile på Linux; med CMake
fungerar CLion och VS Code likadant på alla tre systemen. På macOS körs Vulkan ovanpå Metal genom MoltenVK (mer om det
nedan).
:::
:::d3d12
Direct3D 12 finns bara på Windows, och Microsofts exempel är Visual Studio-solutions, så Visual Studio är det
naturliga valet. Rider öppnar samma solutions; CLion och VS Code fungerar också, så länge de använder Microsofts
kompilator (MSVC).
:::

```quiz
Hur bygger IDE:erna kursens projekt? (Välj alla som stämmer.)
- [x] CLion och VS Code bygger utifrån en `CMakeLists.txt` med CMake
- [ ] VS Code behöver inga byggfiler alls
- [x] Visual Studio och Rider bygger en Visual Studio-solution (`.sln` och `.vcxproj`)
- [ ] Rider bygger utifrån en makefile
---
CMake är byggsystemet i CLion och i VS Codes CMake Tools. Visual Studios egna projekt är solutions, och Rider bygger
samma solutions med Microsofts byggverktyg.
```

## En kompilator

Din IDE behöver en C++17-kompilator:

- **Windows:** Microsofts kompilator, **MSVC**. Den följer med arbetsbelastningen **Desktop development with C++** i
  Visual Studio (som också installerar Windows SDK och CMake). Använder du en annan IDE installerar du *Build Tools for
  Visual Studio* med samma arbetsbelastning. MinGW-w64 (GCC) och Clang fungerar också för OpenGL och Vulkan – CLion
  har till och med MinGW med sig – men DirectX 12-koden är skriven för MSVC.
- **Linux:** GCC eller Clang från din distribution, till exempel på Debian och Ubuntu:

  ```text
  sudo apt install build-essential cmake ninja-build git
  ```

- **macOS:** Apples Clang från **Xcode Command Line Tools** (`xcode-select --install` i en terminal), och CMake från
  [cmake.org](https://cmake.org/download/) eller Homebrew (`brew install cmake`).

:::ide clion vscode
**CMake** beskriver ett projekt i en fil som heter `CMakeLists.txt`: vilka källfiler programmet består av, vilka
bibliotek det använder och var de finns. Utifrån den filen genererar CMake byggfilerna för din kompilator
(Ninja-filer eller makefiler), som IDE:n sedan bygger. CLion har CMake med sig; till VS Code installerar du det själv.
`CMakeLists.txt` här nedan kräver CMake 3.24 eller nyare, och Git, som CMake använder för att ladda ner bibliotek.
:::
:::ide vs rider
En **Visual Studio-solution** byggs av MSBuild, som följer med Visual Studio och med *Build Tools for Visual Studio*.
Rider använder samma MSBuild och samma kompilator, så även för Rider installerar du Build Tools (eller Visual Studio
Community) med arbetsbelastningen **Desktop development with C++**.
:::

## Biblioteken för {{api}}

:::opengl
OpenGL självt behöver du inte installera: det följer med drivrutinen för ditt grafikkort. Det du behöver är de
bibliotek som learnopengl.coms kod använder:

- **GLFW** ([glfw.org](https://www.glfw.org/download.html)) skapar fönstret och OpenGL-kontexten och ger dig
  tangentbord och mus.
- **GLAD** laddar OpenGL-funktionerna när programmet körs. Du genererar det på [glad.dav1d.de](https://glad.dav1d.de/):
  språk **C/C++**, specifikation **OpenGL**, API **gl** version **3.3**, profil **Core**, **Generate a loader**
  ikryssat, och sedan **Generate**. Zip-filen innehåller `include/glad/glad.h`, `include/KHR/khrplatform.h` och
  `src/glad.c`. ([gen.glad.sh](https://gen.glad.sh/) är generatorn för GLAD 2, vars funktioner heter något annat;
  kursens kod använder GLAD 1:s `gladLoadGLLoader`.)
- **GLM** ([github.com/g-truc/glm](https://github.com/g-truc/glm)), matematikbiblioteket, från och med
  *Transformationer*.
- **stb_image** ([github.com/nothings/stb](https://github.com/nothings/stb)), en enda header, `stb_image.h`, som
  läser in bilder, från och med *Texturer*.
- Senare **Assimp** ([assimp.org](https://www.assimp.org/), [github.com/assimp/assimp](https://github.com/assimp/assimp))
  för *Model Loading*, och **FreeType** ([freetype.org](https://freetype.org/)) för *Textrendering*. De kapitlen
  berättar vad du ska lägga till.

:::ide clion vscode
GLFW och GLM kommer av sig själva: `CMakeLists.txt` här nedan laddar ner och bygger dem, om den inte hittar
installerade (på Linux `libglfw3-dev` och `libglm-dev` eller motsvarande i din distribution, på macOS
`brew install glfw glm`).
:::
:::ide vs rider
För GLFW laddar du ner **64-bit Windows binaries** från glfw.org: zip-filen har en `include`-mapp och en
`lib-vc2022`-mapp med `glfw3.lib` (den fungerar även med nyare Visual Studio-versioner). GLM består bara av
headerfiler: ladda ner repositoryt (eller en release) så att dess `glm`-mapp, den med `glm.hpp` i, finns till hands.
:::

```quiz
Varför genererar kursen GLAD på glad.dav1d.de och inte på gen.glad.sh?
- [ ] Därför att gen.glad.sh inte kan generera en loader för OpenGL 3.3
- [x] Därför att gen.glad.sh gör GLAD 2, vars funktioner heter något annat, och kursens kod anropar GLAD 1:s `gladLoadGLLoader`
- [ ] Därför att bara glad.dav1d.de tar med `glad.c`
---
Båda generatorerna ger en loader för OpenGL 3.3 core. Skillnaden är det genererade API:et: koden i kursen är skriven
för GLAD 1, precis som learnopengl.coms.
```
:::
:::vulkan
- **Vulkan SDK** från LunarG ([vulkan.lunarg.com](https://vulkan.lunarg.com/)), för Windows, Linux och macOS. Det
  innehåller Vulkans headerfiler, **loadern** som ditt program länkar mot, **valideringslagren**
  (`VK_LAYER_KHRONOS_validation`), shaderkompilatorn **glslc** som gör om din GLSL till SPIR-V, och `vkcube`, en liten
  demo – kör den först för att se att ditt grafikkort och din drivrutin stöder Vulkan. På Windows sätter
  installationsprogrammet också miljövariabeln `VULKAN_SDK` till mappen det installerade i. På Linux kan du i stället
  använda din distributions paket, till exempel på Debian och Ubuntu:

  ```text
  sudo apt install libvulkan-dev vulkan-validationlayers vulkan-tools glslc libglfw3-dev libglm-dev
  ```

- **macOS:** SDK:t kör Vulkan ovanpå Metal med **MoltenVK**, som ingår. Där kan `vkCreateInstance` returnera
  `VK_ERROR_INCOMPATIBLE_DRIVER` om du inte aktiverar instans-extensionen `VK_KHR_portability_enumeration` och sätter
  `VK_INSTANCE_CREATE_ENUMERATE_PORTABILITY_BIT_KHR` i create-infons `flags`; kursens kod riktar sig mot Windows och
  Linux och gör inte det.
- **GLFW** ([glfw.org](https://www.glfw.org/download.html)) för fönstret, och **GLM**
  ([github.com/g-truc/glm](https://github.com/g-truc/glm)) för matematiken.
- **stb_image** ([github.com/nothings/stb](https://github.com/nothings/stb)), en enda header, `stb_image.h`, från och
  med *Texturer*, och **tinyobjloader** ([github.com/tinyobjloader/tinyobjloader](https://github.com/tinyobjloader/tinyobjloader)),
  en enda header, `tiny_obj_loader.h`, för modellerna, som i vulkan-tutorial.com.
- Senare **Assimp** ([assimp.org](https://www.assimp.org/), [github.com/assimp/assimp](https://github.com/assimp/assimp))
  och **FreeType** ([freetype.org](https://freetype.org/)). De kapitlen berättar vad du ska lägga till.

:::ide clion vscode
GLFW och GLM kommer av sig själva: `CMakeLists.txt` här nedan laddar ner och bygger dem, om den inte hittar
installerade.
:::
:::ide vs rider
För GLFW laddar du ner **64-bit Windows binaries** från glfw.org: zip-filen har en `include`-mapp och en
`lib-vc2022`-mapp med `glfw3.lib` (den fungerar även med nyare Visual Studio-versioner). GLM består bara av
headerfiler: ladda ner repositoryt (eller en release) så att dess `glm`-mapp, den med `glm.hpp` i, finns till hands.
:::

```quiz
Vad gör glslc, som följer med Vulkan SDK, för ditt projekt?
- [ ] Den kontrollerar dina Vulkan-anrop medan programmet körs
- [ ] Den laddar Vulkan-funktionerna från drivrutinen
- [x] Den kompilerar dina GLSL-shaders till SPIR-V, den form som Vulkan läser in
---
Vulkan tar inte emot GLSL-källkod: det tar emot SPIR-V. Valideringslagren kontrollerar dina anrop när programmet körs,
och loadern hittar drivrutinens funktioner.
```
:::
:::d3d12
- **Windows 10 eller 11** och ett grafikkort med en Direct3D 12-drivrutin.
- **Visual Studio** med arbetsbelastningen **Desktop development with C++**: kompilatorn MSVC och **Windows SDK**, som
  innehåller `d3d12.h`, `dxgi1_6.h`, `d3dcompiler.h`, **DirectXMath** (`DirectXMath.h`) och biblioteken `d3d12.lib`,
  `dxgi.lib` och `d3dcompiler.lib`. (Med en annan IDE: *Build Tools for Visual Studio* med samma arbetsbelastning.)
- **d3dx12.h**, hjälpbiblioteket med `CD3DX12_...`-structarna, som bara består av headerfiler. Det finns inte i Windows
  SDK; det kommer från Microsofts repository [DirectX-Headers](https://github.com/microsoft/DirectX-Headers), i mappen
  `include/directx`.
- **Shaderkompilatorn.** Kursen kompilerar sin HLSL när programmet startar, med `D3DCompileFromFile` från
  D3DCompiler-biblioteket (shader model 5.0). Dess DLL, `d3dcompiler_47.dll`, följer med Windows. Den nyare
  kompilatorn, DXC (shader model 6), finns också i Windows SDK; den behöver du inte för den här kursen.
- **Debug-lagret**, som kontrollerar dina Direct3D 12-anrop, ingår i den valfria Windows-funktionen **Graphics Tools**
  (Inställningar → System → Valfria funktioner → Lägg till en valfri funktion).
- **PIX**, Microsofts kostnadsfria GPU-debugger för Direct3D 12, är valfritt men mycket användbart när en bild inte
  ser ut som den ska.
- **stb_image** ([github.com/nothings/stb](https://github.com/nothings/stb)), en enda header, `stb_image.h`, från och
  med *Texturer*; senare **Assimp** ([assimp.org](https://www.assimp.org/),
  [github.com/assimp/assimp](https://github.com/assimp/assimp)) och **FreeType**
  ([freetype.org](https://freetype.org/)). De kapitlen berättar vad du ska lägga till.

```quiz
Var kommer `d3dx12.h` ifrån?
- [ ] Från Windows SDK, bredvid `d3d12.h`
- [ ] Från den valfria funktionen Graphics Tools
- [ ] Från DirectXMath
- [x] Från Microsofts repository DirectX-Headers på GitHub, i `include/directx`
---
`d3dx12.h` är ett hjälpbibliotek som Microsoft ger ut separat från SDK:t. Graphics Tools innehåller debug-lagret, och
DirectXMath är matematikbiblioteket.
```
:::

## Mapparna

Hur du organiserar din kod bestämmer du själv. Stegen i kursen använder en uppställning, som ett förslag: varje kapitel
får en egen mapp, och de bibliotek som bara är filer – de du laddar ner själv – hamnar i en enda `libs`-mapp som alla
kapitel delar. `CMakeLists.txt` och Visual Studio-inställningarna här nedan hittar den mappen som `../../libs`, två
nivåer ovanför kapitelmappen:

:::opengl
:::ide clion vscode
```text
learn/
  libs/
    glad/        include/glad/glad.h, include/KHR/khrplatform.h, src/glad.c
    stb/         stb_image.h
  opengl/
    creating-a-window/
      CMakeLists.txt
      main.cpp
    hello-window/
      ...
```
:::
:::ide vs rider
```text
learn/
  libs/
    glad/        include/glad/glad.h, include/KHR/khrplatform.h, src/glad.c
    glfw/        include/GLFW/glfw3.h, lib-vc2022/glfw3.lib
    glm/         glm/glm.hpp …
    stb/         stb_image.h
  opengl/
    LearnOpenGL/          projektet som du kopierar till varje kapitel (se nedan)
    creating-a-window/
      LearnOpenGL.sln, LearnOpenGL.vcxproj
      main.cpp
    hello-window/
      ...
```
:::
:::
:::vulkan
:::ide clion vscode
```text
learn/
  libs/
    stb/             stb_image.h
    tinyobjloader/   tiny_obj_loader.h
  vulkan/
    creating-a-window/
      CMakeLists.txt
      main.cpp
    hello-triangle/
      CMakeLists.txt
      main.cpp
      shaders/shader.vert, shaders/shader.frag
    ...
```
:::
:::ide vs rider
```text
learn/
  libs/
    glfw/            include/GLFW/glfw3.h, lib-vc2022/glfw3.lib
    glm/             glm/glm.hpp …
    stb/             stb_image.h
    tinyobjloader/   tiny_obj_loader.h
  vulkan/
    LearnVulkan/     projektet som du kopierar till varje kapitel (se nedan)
    creating-a-window/
      LearnVulkan.sln, LearnVulkan.vcxproj
      main.cpp
    hello-triangle/
      LearnVulkan.sln, LearnVulkan.vcxproj
      main.cpp
      shaders/shader.vert, shaders/shader.frag
    ...
```
:::
:::
:::d3d12
:::ide clion vscode
```text
learn/
  libs/
    DirectX-Headers/   repositoryt: include/directx/d3dx12.h …
    stb/               stb_image.h
  d3d12/
    creating-a-window/
      CMakeLists.txt
      main.cpp
    hello-triangle/
      CMakeLists.txt
      main.cpp
      shaders.hlsl
    ...
```
:::
:::ide vs rider
```text
learn/
  libs/
    DirectX-Headers/   repositoryt: include/directx/d3dx12.h …
    stb/               stb_image.h
  d3d12/
    LearnDirectX/      projektet som du kopierar till varje kapitel (se nedan)
    creating-a-window/
      LearnDirectX.sln, LearnDirectX.vcxproj
      main.cpp
    hello-triangle/
      LearnDirectX.sln, LearnDirectX.vcxproj
      main.cpp
      shaders.hlsl
    ...
```
:::
:::

Vilken annan struktur som helst fungerar lika bra – till exempel ett enda CMake-projekt för hela kursen, med ett
program per kapitel. Justera då sökvägarna till biblioteken: `LIBS` i `CMakeLists.txt`, eller include- och
bibliotekskatalogerna i Visual Studio-projektet.

Programmen läser in sina shaders, texturer och modeller med sökvägar relativt **arbetskatalogen** (working
directory), mappen som ett program körs i: `"shaders/vert.spv"`, `"container.png"`, `L"shaders.hlsl"`. Startfilerna
lägger de filerna bredvid `main.cpp`, i kapitelmappen, så programmet måste köras med kapitelmappen som arbetskatalog.
Stegen här nedan visar hur.

```quiz
Ditt program byggs, men när det startar avbryts det med ett fel om att det inte kan öppna en av sina shaderfiler. Filen ligger i kapitelmappen. Vad är den troligaste orsaken?
- [ ] Du har inte tryckt på **Kontrollera min kod** än
- [ ] Shaderfilen är äldre än programmet
- [x] Programmet körs med en annan arbetskatalog än kapitelmappen – oftast byggmappen
- [ ] `libs`-mappen saknas
---
Relativa sökvägar utgår från arbetskatalogen. IDE:er kör ofta ett program i mappen där det byggdes, så arbetskatalogen
måste vara kapitelmappen – stegen här nedan visar hur för din IDE.
```

## Projektfilerna

:::ide clion vscode
En `CMakeLists.txt` är allt ett kapitel behöver. Lägg den i varje kapitelmapp bredvid startfilerna – det är samma fil
för alla kapitel i kursen.
:::
:::ide vs rider
Du sätter upp ett Visual Studio-projekt en gång per API och kopierar dess två filer, `.sln` och `.vcxproj`, till varje
kapitelmapp. Projektet hänvisar till `main.cpp` och till `libs`-mappen med relativa sökvägar, så kopiorna fungerar
oförändrade i varje kapitelmapp på samma djup (`learn/<api>/<kapitel>`). Om dina mappar ser annorlunda ut ändrar du
sökvägarna `..\..\libs` i inställningarna så att de stämmer.
:::

:::opengl
:::ide clion vscode
```text
cmake_minimum_required(VERSION 3.24)
project(LearnOpenGL C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# GLFW and GLM: the installed ones if CMake finds them, otherwise downloaded and built from source
include(FetchContent)
FetchContent_Declare(glfw3 GIT_REPOSITORY https://github.com/glfw/glfw.git GIT_TAG 3.4 FIND_PACKAGE_ARGS)
FetchContent_Declare(glm GIT_REPOSITORY https://github.com/g-truc/glm.git GIT_TAG 1.0.1 FIND_PACKAGE_ARGS)
FetchContent_MakeAvailable(glfw3 glm)

# GLAD and stb_image: in the libs folder that all chapters share
set(LIBS ${CMAKE_CURRENT_SOURCE_DIR}/../../libs)

add_executable(LearnOpenGL main.cpp ${LIBS}/glad/src/glad.c)
target_include_directories(LearnOpenGL PRIVATE ${LIBS}/glad/include ${LIBS}/stb)
target_link_libraries(LearnOpenGL PRIVATE glfw glm::glm ${CMAKE_DL_LIBS})

# Visual Studio: run the program in the chapter folder, where its shaders and textures are
set_target_properties(LearnOpenGL PROPERTIES VS_DEBUGGER_WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
```

På Linux installerar du din distributions GLFW-paket: att bygga GLFW från källkod kräver där också utvecklingspaketen
för X11 och Wayland. Du behöver inte länka mot `opengl32.lib` eller `libGL` själv – GLFW skapar kontexten och GLAD ber
den om varje funktion.
:::
:::ide vs rider
Projektet, `LearnOpenGL`, kompilerar `main.cpp` och GLAD:s `glad.c`, och behöver de här inställningarna för **alla
konfigurationer** (All Configurations) och plattformen **x64**:

- **C/C++ → General → Additional Include Directories:**
  `..\..\libs\glfw\include;..\..\libs\glad\include;..\..\libs\glm;..\..\libs\stb`
- **C/C++ → Language → C++ Language Standard:** ISO C++17
- **Linker → General → Additional Library Directories:** `..\..\libs\glfw\lib-vc2022`
- **Linker → Input → Additional Dependencies:** `glfw3.lib;opengl32.lib` före dem som redan står där
- **Debugging → Working Directory:** `$(ProjectDir)` – standardvärdet, som är kapitelmappen

I projektfilen är de här inställningarna en `ItemDefinitionGroup`, efter dem som redan finns, och de två källfilerna
en `ItemGroup`:

```text
<ItemDefinitionGroup>
  <ClCompile>
    <AdditionalIncludeDirectories>..\..\libs\glfw\include;..\..\libs\glad\include;..\..\libs\glm;..\..\libs\stb;%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories>
    <LanguageStandard>stdcpp17</LanguageStandard>
  </ClCompile>
  <Link>
    <AdditionalLibraryDirectories>..\..\libs\glfw\lib-vc2022;%(AdditionalLibraryDirectories)</AdditionalLibraryDirectories>
    <AdditionalDependencies>glfw3.lib;opengl32.lib;%(AdditionalDependencies)</AdditionalDependencies>
  </Link>
</ItemDefinitionGroup>
<ItemGroup>
  <ClCompile Include="main.cpp" />
  <ClCompile Include="..\..\libs\glad\src\glad.c" />
</ItemGroup>
```

Relativa sökvägar i de här inställningarna utgår från mappen där `.vcxproj` ligger, alltså kapitelmappen.
:::
:::
:::vulkan
:::ide clion vscode
```text
cmake_minimum_required(VERSION 3.24)
project(LearnVulkan CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Vulkan REQUIRED COMPONENTS glslc)

# GLFW and GLM: the installed ones if CMake finds them, otherwise downloaded and built from source
include(FetchContent)
FetchContent_Declare(glfw3 GIT_REPOSITORY https://github.com/glfw/glfw.git GIT_TAG 3.4 FIND_PACKAGE_ARGS)
FetchContent_Declare(glm GIT_REPOSITORY https://github.com/g-truc/glm.git GIT_TAG 1.0.1 FIND_PACKAGE_ARGS)
FetchContent_MakeAvailable(glfw3 glm)

# stb_image and tinyobjloader: in the libs folder that all chapters share
set(LIBS ${CMAKE_CURRENT_SOURCE_DIR}/../../libs)

add_executable(LearnVulkan main.cpp)
target_include_directories(LearnVulkan PRIVATE ${LIBS}/stb ${LIBS}/tinyobjloader)
target_link_libraries(LearnVulkan PRIVATE Vulkan::Vulkan glfw glm::glm)

# Visual Studio: run the program in the chapter folder, where its shaders and textures are
set_target_properties(LearnVulkan PROPERTIES VS_DEBUGGER_WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})

# Compile every shader in shaders/ to SPIR-V next to it:
# shader.vert -> vert.spv (vulkan-tutorial's names), any other name.vert -> name.vert.spv
file(GLOB SHADERS CONFIGURE_DEPENDS shaders/*.vert shaders/*.frag shaders/*.geom shaders/*.tesc shaders/*.tese shaders/*.comp)
foreach(SHADER ${SHADERS})
    get_filename_component(NAME ${SHADER} NAME)
    get_filename_component(STAGE ${SHADER} LAST_EXT)
    if(NAME MATCHES "^shader\\.")
        string(SUBSTRING ${STAGE} 1 -1 STAGE)
        set(SPIRV ${CMAKE_CURRENT_SOURCE_DIR}/shaders/${STAGE}.spv)
    else()
        set(SPIRV ${SHADER}.spv)
    endif()
    add_custom_command(OUTPUT ${SPIRV} COMMAND Vulkan::glslc ${SHADER} -o ${SPIRV} DEPENDS ${SHADER})
    list(APPEND SPIRV_FILES ${SPIRV})
endforeach()
add_custom_target(shaders DEPENDS ${SPIRV_FILES})
add_dependencies(LearnVulkan shaders)
```

Loopen gör det som vulkan-tutorial.coms `compile.bat` och `compile.sh` gör för hand: den kör `glslc` för varje
shader, och igen så fort du ändrar en.
:::
:::ide vs rider
Projektet, `LearnVulkan`, kompilerar `main.cpp` och behöver de här inställningarna för **alla konfigurationer** (All
Configurations) och plattformen **x64**:

- **C/C++ → General → Additional Include Directories:**
  `$(VULKAN_SDK)\Include;..\..\libs\glfw\include;..\..\libs\glm;..\..\libs\stb;..\..\libs\tinyobjloader`
- **C/C++ → Language → C++ Language Standard:** ISO C++17
- **Linker → General → Additional Library Directories:** `$(VULKAN_SDK)\Lib;..\..\libs\glfw\lib-vc2022`
- **Linker → Input → Additional Dependencies:** `vulkan-1.lib;glfw3.lib` före dem som redan står där
- **Build Events → Pre-Build Event → Command Line:** `glslc`-kommandona här nedan
- **Debugging → Working Directory:** `$(ProjectDir)` – standardvärdet, som är kapitelmappen

En solution kompilerar inte shaders av sig själv. Pre-build-händelsen gör det som vulkan-tutorial.coms `compile.bat`
gör: den kör SDK:ts `glslc` för varje shader i `shaders\` före varje bygge – `shader.vert` blir `vert.spv`
(vulkan-tutorials namn), alla andra `namn.vert` blir `namn.vert.spv`. I projektfilen:

```text
<ItemDefinitionGroup>
  <ClCompile>
    <AdditionalIncludeDirectories>$(VULKAN_SDK)\Include;..\..\libs\glfw\include;..\..\libs\glm;..\..\libs\stb;..\..\libs\tinyobjloader;%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories>
    <LanguageStandard>stdcpp17</LanguageStandard>
  </ClCompile>
  <Link>
    <AdditionalLibraryDirectories>$(VULKAN_SDK)\Lib;..\..\libs\glfw\lib-vc2022;%(AdditionalLibraryDirectories)</AdditionalLibraryDirectories>
    <AdditionalDependencies>vulkan-1.lib;glfw3.lib;%(AdditionalDependencies)</AdditionalDependencies>
  </Link>
  <PreBuildEvent>
    <Command>for %%f in (shaders\*.vert shaders\*.frag shaders\*.geom shaders\*.tesc shaders\*.tese shaders\*.comp) do "$(VULKAN_SDK)\Bin\glslc.exe" "%%f" -o "%%f.spv"
if exist shaders\shader.vert "$(VULKAN_SDK)\Bin\glslc.exe" shaders\shader.vert -o shaders\vert.spv
if exist shaders\shader.frag "$(VULKAN_SDK)\Bin\glslc.exe" shaders\shader.frag -o shaders\frag.spv</Command>
  </PreBuildEvent>
</ItemDefinitionGroup>
<ItemGroup>
  <ClCompile Include="main.cpp" />
</ItemGroup>
```

Relativa sökvägar i de här inställningarna utgår från mappen där `.vcxproj` ligger, alltså kapitelmappen, och
bygghändelserna körs också där.
:::

Bygg inte konfigurationen **Release** medan du lär dig: den definierar `NDEBUG`, som stänger av valideringslagren.
:::
:::d3d12
:::ide clion vscode
```text
cmake_minimum_required(VERSION 3.24)
project(LearnDirectX CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# DirectX-Headers (d3dx12.h) and stb_image: in the libs folder that all chapters share
set(LIBS ${CMAKE_CURRENT_SOURCE_DIR}/../../libs)

# WIN32: a Windows program that starts in wWinMain, not a console program
add_executable(LearnDirectX WIN32 main.cpp)
target_include_directories(LearnDirectX PRIVATE ${LIBS}/DirectX-Headers/include/directx ${LIBS}/stb)

# Visual Studio: run the program in the chapter folder, where shaders.hlsl and the textures are
set_target_properties(LearnDirectX PROPERTIES VS_DEBUGGER_WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
```
:::
:::ide vs rider
Projektet, `LearnDirectX`, kompilerar `main.cpp` och behöver de här inställningarna för **alla konfigurationer** (All
Configurations) och plattformen **x64**:

- **C/C++ → General → Additional Include Directories:** `..\..\libs\DirectX-Headers\include\directx;..\..\libs\stb`
- **C/C++ → Language → C++ Language Standard:** ISO C++17
- **Linker → System → SubSystem:** Windows – programmet startar i `wWinMain`, inte i `main`
- **Debugging → Working Directory:** `$(ProjectDir)` – standardvärdet, som är kapitelmappen, där `shaders.hlsl` ligger

I projektfilen:

```text
<ItemDefinitionGroup>
  <ClCompile>
    <AdditionalIncludeDirectories>..\..\libs\DirectX-Headers\include\directx;..\..\libs\stb;%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories>
    <LanguageStandard>stdcpp17</LanguageStandard>
  </ClCompile>
  <Link>
    <SubSystem>Windows</SubSystem>
  </Link>
</ItemDefinitionGroup>
<ItemGroup>
  <ClCompile Include="main.cpp" />
</ItemGroup>
```
:::

`d3d12.lib`, `dxgi.lib` och `d3dcompiler.lib` behöver ingen inställning: raderna `#pragma comment(lib, ...)` överst i
`main.cpp` länkar dem. Bygg konfigurationen **Debug**: den definierar `_DEBUG`, som slår på koden för debug-lagret.
:::

:::ide clion vscode
`VS_DEBUGGER_WORKING_DIRECTORY` finns där för Visual Studios skull: om du någon gång öppnar mappen där gör den att
Visual Studio kör programmet i kapitelmappen.
:::
:::ide vs rider
Shaders, texturer och modeller ligger kvar i kapitelmappen, där programmet körs. (Vill du hellre köra `.exe`-filen
från dess egen mapp kopierar du dem dit med en post-build-händelse, till exempel
`xcopy /y /s /i "$(ProjectDir)shaders" "$(OutDir)shaders"`.)
:::

:::opengl d3d12
Programmet läser sina shaders varje gång det startar, så en ändring som bara gäller en shader kräver inget nytt bygge:
kör bara programmet igen.
:::
:::vulkan
:::ide clion vscode
Efter en ändring i en shader bygger du som vanligt: CMake ser ändringen och kör `glslc` på den shadern igen.
:::
:::ide vs rider
En solution räknar inte shaderna som källfiler: när bara en shader har ändrats kan IDE:n komma fram till att det inte
finns något att bygga och hoppa över pre-build-händelsen. Efter en ändring som bara gäller en shader använder du
**Build → Rebuild Solution**, så att `glslc` kompilerar den igen.
:::
:::

## Bygga och köra

:::ide vs
1. Installera arbetsbelastningen **Desktop development with C++** i Visual Studio Installer.
2. Skapa en gång per API projektet som du ska kopiera: **File → New → Project…**, **Empty Project** (C++). Döp det
   till `LearnOpenGL`, `LearnVulkan` eller `LearnDirectX`, välj din mapp `learn/<api>` som plats (Location) och kryssa
   i **Place solution and project in the same directory**.
3. Lägg till en `main.cpp` med **Project → Add New Item…** (en tom duger – varje kapitel har med sig sin egen; för
   OpenGL lägger du också till `glad.c` med **Project → Add Existing Item…**), och gör inställningarna ovan under
   **Project → Properties** (Configuration *All Configurations*, Platform *x64*).
4. För varje kapitel kopierar du projektets `.sln`, `.vcxproj` och `.vcxproj.filters` till kapitelmappen, bredvid
   startfilerna, och öppnar `.sln`-filen där.
5. **Build → Build Solution** (Ctrl+Shift+B) bygger programmet; **Debug → Start Without Debugging** (Ctrl+F5) eller
   **Start Debugging** (F5) bygger det vid behov och kör det, med kapitelmappen som arbetskatalog.
:::
:::ide clion
1. **File → Open…** och välj kapitelmappen. CLion läser `CMakeLists.txt` och frågar första gången efter en
   CMake-profil; standardprofilen **Debug** duger.
2. CLion skapar en körkonfiguration för programmet. Öppna **Run → Edit Configurations…** och sätt dess
   **Working directory** till kapitelmappen (`$ProjectFileDir$`).
3. **Build → Build Project** (Ctrl+F9) bygger det; **Run → Run** (Shift+F10) eller den gröna ▶-knappen kör det.
:::
:::ide rider
1. Installera *Build Tools for Visual Studio* (eller Visual Studio Community) med arbetsbelastningen **Desktop
   development with C++**: Rider bygger C++ med Microsofts MSBuild och kompilator.
2. Skapa en gång per API projektet som du ska kopiera: ett C++-projekt som heter `LearnOpenGL`, `LearnVulkan` eller
   `LearnDirectX` i din mapp `learn/<api>`, med `.sln` och `.vcxproj` i samma mapp – med Riders **File → New
   Solution…** eller, om du har det, med Visual Studios **Empty Project**.
3. Lägg till en `main.cpp` (för OpenGL även `glad.c`) och inställningarna ovan: öppna `.vcxproj`-filen i editorn – den
   är MSBuild-XML – och lägg till `ItemDefinitionGroup` och `ItemGroup` efter dem som redan finns.
4. För varje kapitel kopierar du projektets `.sln`, `.vcxproj` och `.vcxproj.filters` till kapitelmappen, bredvid
   startfilerna, och öppnar `.sln`-filen där med **File → Open…**.
5. **Build → Build Solution** bygger programmet; **Run → Run** kör det.

Om programmet inte hittar sina filer sätter du **Working directory** under **Run → Edit Configurations…** till
kapitelmappen.
:::
:::ide vscode
1. Installera tilläggen **C/C++** och **CMake Tools** (båda från Microsoft), en kompilator och CMake.
2. **File → Open Folder…** och välj kapitelmappen. CMake Tools hittar `CMakeLists.txt` och frågar efter ett *kit* –
   kompilatorn som ska användas. (För DirectX 12 väljer du ett Visual Studio-kit.)
3. **CMake: Build** (F7, eller *Build* i statusfältet) bygger programmet till `build/` inuti kapitelmappen:
   `build/LearnOpenGL`, eller på Windows `build\LearnOpenGL.exe` (`build\Debug\LearnOpenGL.exe` om CMake använder en
   Visual Studio-generator).
4. Kör det från VS Codes terminal (**Terminal → New Terminal**, som öppnas i kapitelmappen), till exempel
   `./build/LearnOpenGL` – då är kapitelmappen arbetskatalogen.

För att köra det i debuggern med **CMake: Debug** (Ctrl+F5) talar du om arbetskatalogen för CMake Tools i
`.vscode/settings.json`:

```text
{
    "cmake.debugConfig": { "cwd": "${workspaceFolder}" }
}
```
:::

:::d3d12
:::ide clion
På Windows använder CLion sin medföljande MinGW som standard. För DirectX 12 lägger du till en **Visual
Studio**-toolchain under **Settings → Build, Execution, Deployment → Toolchains** och flyttar den överst (eller väljer
den i CMake-profilen).
:::
:::

## Prova

Det här kapitlets startfiler är triangelprogrammet från introduktionen. Spara dem med **Spara startfilerna…**, lägg
till dina projektfiler, öppna projektet i din IDE, bygg och kör. Om ett fönster med en orange triangel på en mörkt
blågrön bakgrund dyker upp är din IDE, din kompilator och biblioteken för {{api}} redo – nästa kapitel börjar med ett
tomt fönster.

```quiz
Du lägger upp kursen på ditt eget sätt: ett CMake-projekt för alla kapitel, med varje kapitels kod i en egen mapp. Vad behöver **Kontrollera min kod** från dig?
- [ ] Den föreslagna mappstrukturen, `learn/<api>/<kapitel>`
- [ ] Ett bygge av programmet som är nyare än dina källfiler
- [ ] Att programmet körs medan kontrollen läser din kod
- [x] Kapitlets huvudfil, vald en gång, var den än ligger
---
**Kontrollera min kod** läser dina källfiler – huvudfilen du väljer, och shaders och headerfiler som den hittar bredvid
den, under den eller i mappen ovanför – och kör kursens kontroller på dem. Vilken mappstruktur som helst fungerar, och
ingenting behöver byggas eller köras för kontrollen; du bygger och kör programmet för att se vad det ritar.
```

## Mer att läsa

- [Creating a window](https://learnopengl.com/Getting-started/Creating-a-window) på learnopengl.com och
  [Development environment](https://vulkan-tutorial.com/Development_environment) på vulkan-tutorial.com: hur de
  ursprungliga guiderna sätter upp sina projekt.
- [CMake projects in Visual Studio](https://learn.microsoft.com/en-us/cpp/build/cmake-projects-in-visual-studio) på
  Microsoft Learn.
- [Direct3D 12 programming environment setup](https://learn.microsoft.com/en-us/windows/win32/direct3d12/directx-12-programming-environment-set-up):
  Direct3D 12:s headerfiler, bibliotek och debug-lager.
