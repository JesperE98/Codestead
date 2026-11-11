# Sätt upp din IDE

Från och med nästa kapitel skriver du kod – och du skriver den så som grafikprogrammerare gör: i en riktig IDE, med en
riktig kompilator, och bygger ett program som öppnar ett riktigt fönster på din egen dator. Den här appen är din
lärobok och din granskare. Den visar texten, uppgifterna och en bild av resultatet som varje uppgift ska ge, och den
håller koll på mappen där ditt projekt ligger: när du har byggt och kört ditt program kontrollerar den din kod och
bockar av uppgiften.

learnopengl.com ägnar en god del av sitt kapitel *Creating a window* åt att sätta upp ett projekt, och det gör
vulkan-tutorial.com också i sitt kapitel *Development environment*. Det här kapitlet gör detsamma för kursens tre
API:er: du väljer en IDE, installerar en kompilator och CMake, hämtar de bibliotek som {{api}} behöver, skriver en liten
`CMakeLists.txt` och lär dig hur panelen **Ditt projekt** följer det du gör. Kapitlet har inga uppgifter, men dess
startfiler är triangelprogrammet från introduktionen, så i slutet kan du kontrollera att allt fungerar.

## Så arbetar du i kursen

Varje kapitel med uppgifter har **startfiler**: `main.cpp`, och från senare kapitel även headerfiler, shaderfiler,
texturer, modeller och typsnitt. `// TODO:`-kommentarerna i dem visar var din kod ska stå. Panelen **Ditt projekt**
kopplar ihop ett kapitel med en mapp på din disk:

1. **Välj mapp…** väljer mappen för det här kapitlet. Använd en ny, tom mapp för varje kapitel. När du har valt en
   föreslår appen själv nästa, som `<bas>/<api>/<kapitel>` – till exempel `learn/opengl/hello-window` bredvid
   `learn/opengl/creating-a-window`.
2. **Kopiera startfilerna** kopierar kapitlets startfiler till mappen. Om en fil redan finns där frågar appen innan
   den skriver över den.
3. Du lägger till din `CMakeLists.txt` (samma för alla kapitel med ett API – se nedan) och öppnar mappen i din IDE.
   **Öppna mappen** öppnar den i filhanteraren.
4. Du skriver koden för en uppgift, **bygger** programmet och **kör** det från din IDE.

Appen ser båda stegen. Ett bygge räknas när mappen innehåller ett program (en `.exe` på Windows, en körbar fil på
Linux och macOS) som är nyare än alla dina källfiler, shaders inräknade. En körning räknas när det programmet startas
efter bygget. Sedan kontrollerar appen dina källfiler i bakgrunden med kursens egna kontroller för uppgiften, och bockar
av den om de godkänns. Om något saknas står det *inte än* vid uppgiften, tillsammans med det som kontrollen saknade.
För varje uppgift visar panelen också **Förväntat resultat**: en bild av hur ditt fönster ska se ut när uppgiften är
klar, så att du kan jämföra med det ditt program ritar.

Varje uppgift har en status: *låst* (svara först på frågorna i texten), *väntar på bygge*, *väntar på körning*,
*kontrollerar*, *klar* eller *inte än*, och en liten rad visar när appen senast såg ett bygge och en körning.

Ibland kan appen inte se ditt program starta: när du bygger i WSL, på en annan dator eller i en IDE som körs i en
sandlåda. För de fallen finns en liten länk, **Jag har kört det**. Den kräver fortfarande ett bygge som är nyare än
dina källfiler – om inte appen inte hittar något program alls i mappen, och då säger den det.

```quiz
Du gör klart en uppgift i `main.cpp` och sparar filen. Vad måste hända innan appen kan bocka av uppgiften? (Välj alla som stämmer.)
- [x] Du bygger programmet, så att mappen innehåller ett program som är nyare än dina källfiler
- [ ] Du kopierar startfilerna igen
- [x] Du kör programmet som du just byggde
- [ ] Du öppnar mappen med **Öppna mappen**
---
Appen väntar på ett nytt bygge och på en körning av det bygget. Sedan kontrollerar den dina källfiler med kursens
kontroller för uppgiften. Att kopiera startfilerna igen skulle skriva över ditt arbete.
```

## Välj en IDE

Vilken C++-IDE som helst duger, men kursen ger steg för fyra av dem:

| IDE | Körs på | Kostnad | Bra att veta |
|---|---|---|---|
| [Visual Studio](https://visualstudio.microsoft.com/) | Windows | Community-utgåvan är gratis för privatpersoner, studenter, öppen källkod och små team | Kommer med Microsofts kompilator (MSVC), Windows SDK och CMake; det bästa valet för DirectX 12 |
| [CLion](https://www.jetbrains.com/clion/) | Windows, macOS, Linux | Gratis för icke-kommersiell användning; en betald licens för kommersiellt arbete | Byggd kring CMake; har med sig egen CMake och, på Windows, en egen MinGW-kompilator |
| [Rider](https://www.jetbrains.com/rider/) | Windows, macOS, Linux | Gratis för icke-kommersiell användning; en betald licens för kommersiellt arbete | Dess C++-stöd gäller Visual Studio-solutions (och Unreal Engine), vilket i praktiken betyder Windows med Microsofts byggverktyg |
| [Visual Studio Code](https://code.visualstudio.com/) | Windows, macOS, Linux | Gratis | En editor som blir en C++-IDE med Microsofts tillägg **C/C++** och **CMake Tools**; kompilatorn och CMake installerar du själv |

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
naturliga valet. CLion och VS Code fungerar också, så länge de använder Microsofts kompilator (MSVC); Rider öppnar
samma solutions som Visual Studio.
:::

```quiz
Du arbetar på en Mac. Vilka av de här IDE:erna kan du använda för kursens CMake-projekt? (Välj alla som stämmer.)
- [x] CLion
- [ ] Visual Studio
- [x] Visual Studio Code med tilläggen C/C++ och CMake Tools
- [ ] Rider
---
Visual Studio körs bara på Windows. Rider körs på macOS, men dess C++-stöd gäller Visual Studio-solutions och Unreal
Engine – inte CMake-projekt. CLion och VS Code öppnar en `CMakeLists.txt` på alla system.
```

## En kompilator och CMake

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

**CMake** beskriver ett projekt i en fil som heter `CMakeLists.txt`: vilka källfiler programmet består av, vilka
bibliotek det använder och var de finns. Utifrån den filen genererar CMake byggfilerna för din kompilator
(Ninja-filer, makefiler eller en Visual Studio-solution), som IDE:n sedan bygger. Alla fyra IDE:erna förstår den, så
en och samma `CMakeLists.txt` fungerar överallt. Visual Studio och CLion har CMake med sig; till VS Code installerar
du det själv. `CMakeLists.txt` här nedan kräver CMake 3.24 eller nyare, och Git, som CMake använder för att ladda ner
bibliotek.

## Biblioteken för {{api}}

:::opengl
OpenGL självt behöver du inte installera: det följer med drivrutinen för ditt grafikkort. Det du behöver är de
bibliotek som learnopengl.coms kod använder:

- **GLFW** ([glfw.org](https://www.glfw.org/download.html)) skapar fönstret och OpenGL-kontexten och ger dig
  tangentbord och mus. `CMakeLists.txt` här nedan laddar ner och bygger det åt dig, om den inte hittar ett installerat
  GLFW (på Linux `libglfw3-dev` eller motsvarande i din distribution, på macOS `brew install glfw`).
- **GLAD** laddar OpenGL-funktionerna när programmet körs. Du genererar det på [glad.dav1d.de](https://glad.dav1d.de/):
  språk **C/C++**, specifikation **OpenGL**, API **gl** version **3.3**, profil **Core**, **Generate a loader**
  ikryssat, och sedan **Generate**. Zip-filen innehåller `include/glad/glad.h`, `include/KHR/khrplatform.h` och
  `src/glad.c`. ([gen.glad.sh](https://gen.glad.sh/) är generatorn för GLAD 2, vars funktioner heter något annat;
  kursens kod använder GLAD 1:s `gladLoadGLLoader`.)
- **GLM** ([github.com/g-truc/glm](https://github.com/g-truc/glm)), matematikbiblioteket, från och med
  *Transformationer*. `CMakeLists.txt` laddar ner det också.
- **stb_image** ([github.com/nothings/stb](https://github.com/nothings/stb)), en enda header, `stb_image.h`, som
  läser in bilder, från och med *Texturer*.
- Senare **Assimp** ([assimp.org](https://www.assimp.org/), [github.com/assimp/assimp](https://github.com/assimp/assimp))
  för *Model Loading*, och **FreeType** ([freetype.org](https://freetype.org/)) för *Textrendering*. De kapitlen
  berättar vad du ska lägga till.

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
  demo – kör den först för att se att ditt grafikkort och din drivrutin stöder Vulkan. På Linux kan du i stället
  använda din distributions paket, till exempel på Debian och Ubuntu:

  ```text
  sudo apt install libvulkan-dev vulkan-validationlayers vulkan-tools glslc libglfw3-dev libglm-dev
  ```

- **macOS:** SDK:t kör Vulkan ovanpå Metal med **MoltenVK**, som ingår. Där kan `vkCreateInstance` returnera
  `VK_ERROR_INCOMPATIBLE_DRIVER` om du inte aktiverar instans-extensionen `VK_KHR_portability_enumeration` och sätter
  `VK_INSTANCE_CREATE_ENUMERATE_PORTABILITY_BIT_KHR` i create-infons `flags`; kursens kod riktar sig mot Windows och
  Linux och gör inte det.
- **GLFW** ([glfw.org](https://www.glfw.org/download.html)) för fönstret, och **GLM**
  ([github.com/g-truc/glm](https://github.com/g-truc/glm)) för matematiken. `CMakeLists.txt` här nedan laddar ner och
  bygger båda, om den inte hittar installerade.
- **stb_image** ([github.com/nothings/stb](https://github.com/nothings/stb)), en enda header, `stb_image.h`, från och
  med *Texturer*, och **tinyobjloader** ([github.com/tinyobjloader/tinyobjloader](https://github.com/tinyobjloader/tinyobjloader)),
  en enda header, `tiny_obj_loader.h`, för modellerna, som i vulkan-tutorial.com.
- Senare **Assimp** ([assimp.org](https://www.assimp.org/), [github.com/assimp/assimp](https://github.com/assimp/assimp))
  och **FreeType** ([freetype.org](https://freetype.org/)). De kapitlen berättar vad du ska lägga till.

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

Varje kapitel får en egen mapp, och de bibliotek som bara är filer – de du laddar ner själv – hamnar i en enda
`libs`-mapp som alla kapitel delar:

:::opengl
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
:::vulkan
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
:::d3d12
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

Låt din IDE:s byggmapp ligga inuti kapitelmappen – det gör alla fyra IDE:erna som standard – så att appen hittar
programmet du bygger.

Programmen läser in sina shaders, texturer och modeller med sökvägar relativt **arbetskatalogen** (working
directory), mappen som ett program körs i: `"shaders/vert.spv"`, `"container.png"`, `L"shaders.hlsl"`. Startfilerna
lägger de filerna i kapitelmappen, så programmet måste köras med kapitelmappen som arbetskatalog. Stegen för varje IDE
här nedan visar hur.

```quiz
Ditt program byggs, men när det startar avbryts det med ett fel om att det inte kan öppna en av sina shaderfiler. Filen ligger i kapitelmappen. Vad är den troligaste orsaken?
- [ ] Appen har inte kontrollerat uppgiften än
- [ ] Shaderfilen är äldre än programmet
- [x] Programmet körs med en annan arbetskatalog än kapitelmappen – oftast byggmappen
- [ ] `libs`-mappen saknas
---
Relativa sökvägar utgår från arbetskatalogen. IDE:er kör ofta ett program i mappen där det byggdes, så ställ in
kapitelmappen som arbetskatalog (`CMakeLists.txt` här nedan gör det åt Visual Studio).
```

## En CMakeLists.txt

Det här är allt ett kapitel behöver. Lägg den i varje kapitelmapp bredvid startfilerna – det är samma fil för alla
kapitel i kursen.

:::opengl
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

# Link again when only a shader changed, so that the program is newer than all sources (Ninja and makefiles)
file(GLOB SHADERS CONFIGURE_DEPENDS *.vs *.fs *.gs *.tcs *.tes *.comp)
set_target_properties(LearnOpenGL PROPERTIES LINK_DEPENDS "${SHADERS}")
```

På Linux installerar du din distributions GLFW-paket: att bygga GLFW från källkod kräver där också utvecklingspaketen
för X11 och Wayland. Du behöver inte länka mot `opengl32.lib` eller `libGL` själv – GLFW skapar kontexten och GLAD ber
den om varje funktion.
:::
:::vulkan
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

# Link again when only a shader changed, so that the program is newer than all sources (Ninja and makefiles)
set_target_properties(LearnVulkan PROPERTIES LINK_DEPENDS "${SHADERS}")
```

Loopen gör det som vulkan-tutorial.coms `compile.bat` och `compile.sh` gör för hand: den kör `glslc` för varje
shader, och igen så fort du ändrar en. Bygg inte konfigurationen **Release** medan du lär dig: den definierar `NDEBUG`,
som stänger av valideringslagren.
:::
:::d3d12
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

# Link again when only a shader changed, so that the program is newer than all sources (Ninja and makefiles)
file(GLOB SHADERS CONFIGURE_DEPENDS *.hlsl)
set_target_properties(LearnDirectX PROPERTIES LINK_DEPENDS "${SHADERS}")
```

`d3d12.lib`, `dxgi.lib` och `d3dcompiler.lib` behöver ingen rad här: raderna `#pragma comment(lib, ...)` överst i
`main.cpp` länkar dem. Bygg konfigurationen **Debug**: den definierar `_DEBUG`, som slår på koden för debug-lagret.
:::

Två rader finns där för kursens skull snarare än för kompilatorns. `VS_DEBUGGER_WORKING_DIRECTORY` gör att Visual
Studio (och de solutions som CMake genererar) kör programmet i kapitelmappen. `LINK_DEPENDS` länkar programmet igen när
du bara har ändrat en shader: shaders är också källfiler, och appen räknar bara ett bygge vars program är nyare än alla
dem.

## Visual Studio

**Öppna mappen (CMake).** Eftersom Visual Studio förstår CMake direkt finns det ingen solution att skapa:

1. Installera arbetsbelastningen **Desktop development with C++** i Visual Studio Installer.
2. **File → Open → Folder…** och välj kapitelmappen. Visual Studio kör CMake av sig självt; fönstret *Output* visar
   när det är klart.
3. Välj programmet (`LearnOpenGL.exe`, `LearnVulkan.exe` eller `LearnDirectX.exe`) i listan **Select Startup Item** i
   verktygsfältet.
4. **Build → Build All** (Ctrl+Shift+B) bygger det; **Debug → Start Without Debugging** (Ctrl+F5) eller
   **Start Debugging** (F5) bygger det vid behov och kör det.

Programmet hamnar i `out/build/<konfiguration>/` inuti kapitelmappen, till exempel
`out/build/x64-Debug/LearnOpenGL.exe`, och körs i kapitelmappen tack vare `VS_DEBUGGER_WORKING_DIRECTORY`.

**En egen solution (utan CMake).** Det här är vägen som learnopengl.com och vulkan-tutorial.com beskriver:

1. **File → New → Project…**, **Empty Project** (C++). Kryssa i **Place solution and project in the same directory**,
   och låt Visual Studio skapa kapitelmappen.
2. Välj den mappen i panelen **Ditt projekt** och kopiera startfilerna dit. Lägg till dem i projektet med
   **Project → Add Existing Item…**.
3. I projektets **Properties** (Configuration *All Configurations*, Platform *x64*) sätter du
   **C/C++ → General → Additional Include Directories** till bibliotekens include-mappar,
   **Linker → General → Additional Library Directories** till deras biblioteksmappar,
   **Linker → Input → Additional Dependencies** till deras `.lib`-filer och
   **C/C++ → Language → C++ Language Standard** till C++17.
4. Bygg med **Build → Build Solution** och kör med Ctrl+F5 eller F5.

Programmet hamnar i `x64/Debug/` inuti mappen. Visual Studio kör det som standard i projektmappen
(**Debugging → Working Directory** är `$(ProjectDir)`), och det är kapitelmappen.

:::opengl
För OpenGL använder du GLFW:s förkompilerade binärer från glfw.org: deras `include`-mapp, den `lib-vc…`-mapp som passar
din Visual Studio, och `glfw3.lib` plus `opengl32.lib` som beroenden. Lägg till `glad.c` i projektet.
:::
:::vulkan
För Vulkan lägger du till SDK:ts mappar `Include` och `Lib`, GLFW:s `include`- och biblioteksmappar, och
`vulkan-1.lib` och `glfw3.lib`. En solution kompilerar inte dina shaders: lägg till en **Build Events → Pre-Build
Event** som kör SDK:ts `%VULKAN_SDK%\Bin\glslc.exe` för varje shader, så som vulkan-tutorial.coms `compile.bat` gör.
CMake-vägen gör allt det här åt dig.
:::
:::d3d12
För DirectX 12 lägger du till `DirectX-Headers\include\directx` bland include-mapparna och sätter
**Linker → System → SubSystem** till **Windows**, eftersom programmet startar i `wWinMain`. Det är allt: raderna
`#pragma comment` länkar Direct3D-biblioteken.
:::

En solution har ingen `LINK_DEPENDS`: när du bara har ändrat en shader använder du **Build → Rebuild Solution**, så att
programmet blir nyare än shadern.

## CLion

1. **File → Open…** och välj kapitelmappen. CLion läser `CMakeLists.txt` och frågar första gången efter en
   CMake-profil; standardprofilen **Debug** duger.
2. CLion skapar en körkonfiguration för programmet. Öppna **Run → Edit Configurations…** och sätt dess
   **Working directory** till kapitelmappen (`$ProjectFileDir$`).
3. **Build → Build Project** (Ctrl+F9) bygger det; **Run → Run** (Shift+F10) eller den gröna ▶-knappen kör det.

Programmet hamnar i `cmake-build-debug/` inuti kapitelmappen.

:::d3d12
På Windows använder CLion sin medföljande MinGW som standard. För DirectX 12 lägger du till en **Visual
Studio**-toolchain under **Settings → Build, Execution, Deployment → Toolchains** och flyttar den överst (eller väljer
den i CMake-profilen).
:::

## Rider

Rider bygger C++ via Visual Studio-solutions, så det behöver Microsofts byggverktyg (Visual Studio eller *Build Tools
for Visual Studio* med arbetsbelastningen **Desktop development with C++**). Det finns två sätt att få en solution:

- Skapa en enligt *En egen solution* ovan (i Visual Studio) och öppna den i Rider.
- Eller låt CMake generera en: kör `cmake -B build` i en terminal i kapitelmappen. På Windows använder CMake den nyaste
  Visual Studio den hittar och skriver en Visual Studio-solution till `build`. Öppna den i Rider med **File → Open…**.

Välj programmets projekt (inte `ALL_BUILD`) som det som ska köras, bygg med **Build → Build Solution** och kör med
**Run → Run**. Programmet hamnar i `build/Debug/` (eller `x64/Debug/` för en egen solution). Om det inte hittar sina
filer sätter du **Working directory** under **Run → Edit Configurations…** till kapitelmappen.

## Visual Studio Code

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

## Prova

Det här kapitlets startfiler är triangelprogrammet från introduktionen. Välj en mapp för kapitlet, kopiera
startfilerna, lägg till din `CMakeLists.txt`, öppna mappen i din IDE, bygg och kör. Om ett fönster med en orange
triangel på en mörkt blågrön bakgrund dyker upp är din IDE, din kompilator och biblioteken för {{api}} redo – nästa
kapitel börjar med ett tomt fönster.

```quiz
Du bygger programmet, och uppgiftens rad i panelen ändras till *väntar på körning*. Vad ska du göra?
- [ ] Kopiera startfilerna igen
- [ ] Bygga programmet en gång till
- [ ] Använda **Jag har kört det** – appen kan inte följa din IDE
- [x] Köra programmet från din IDE: appen har sett det nya bygget, men ännu ingen körning av det
---
*Väntar på körning* betyder att bygget räknades. Nästa steg är att starta programmet från IDE:n (eller en terminal);
**Jag har kört det** är bara till för uppsättningar där appen inte kan se ditt program starta.
```

## Mer att läsa

- [Creating a window](https://learnopengl.com/Getting-started/Creating-a-window) på learnopengl.com och
  [Development environment](https://vulkan-tutorial.com/Development_environment) på vulkan-tutorial.com: hur de
  ursprungliga guiderna sätter upp sina projekt.
- [CMake projects in Visual Studio](https://learn.microsoft.com/en-us/cpp/build/cmake-projects-in-visual-studio) på
  Microsoft Learn.
- [Direct3D 12 programming environment setup](https://learn.microsoft.com/en-us/windows/win32/direct3d12/directx-12-programming-environment-set-up):
  Direct3D 12:s headerfiler, bibliotek och debug-lager.
