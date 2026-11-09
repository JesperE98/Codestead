# Skapa ett fönster

Det första vi måste göra innan vi kan rita något är att skapa ett fönster att rita i. Att öppna ett fönster är inget
som ett grafik-API gör på egen hand: fönster hör till operativsystemet, och varje operativsystem skapar dem på sitt
eget sätt (Win32 på Windows, X11 eller Wayland på Linux, Cocoa på macOS). Grafik-API:et renderar bara; något annat
måste ge det en plats på skärmen.

:::opengl
För OpenGL behöver vi dessutom en **OpenGL-kontext**. Kontexten är den tillståndsmaskin du läste om i förra
kapitlet: den lagrar hela OpenGL:s tillstånd, och varje OpenGL-anrop arbetar på den kontext som är *aktuell* (current)
i den anropande tråden. Att skapa en kontext är, återigen, specifikt för operativsystemet – och därför lämnar OpenGL
med avsikt det utanför specifikationen.

Som tur är finns det en hel del bibliotek som skapar fönstret och kontexten åt oss, och som också ger oss tangentbord
och mus: GLUT, SDL, SFML och GLFW, för att nämna några. Precis som learnopengl.com använder vi **GLFW**.
:::
:::vulkan
Vulkan har ingen kontext som OpenGL. I stället skapar du själv, uttryckligen, varje objekt som behövs: en *instans*
som kopplar ditt program till Vulkan-biblioteket, den *fysiska enhet* (grafikkortet) du vill använda, och en *logisk
enhet* med de *köer* (queues) du skickar arbete till. Det är vad det här kapitlet handlar om – det täcker kort
vulkan-tutorial.coms "Development environment" och hela avsnittet "Setup": baskod, instans, valideringslager,
fysiska enheter och köfamiljer, logisk enhet och köer.

För själva fönstret använder vi **GLFW**, som vulkan-tutorial.com: det öppnar fönster på Windows, Linux och macOS, och
tar dessutom hand om en del plattformsspecifika Vulkan-detaljer åt oss (vilka extensions fönstersystemet behöver, och
senare fönstrets surface).
:::
:::d3d12
Direct3D 12 körs bara på Windows, så vi behöver inget plattformsoberoende bibliotek: precis som Microsofts
D3D12HelloWorld-exempel skapar vi fönstret direkt med **Win32-API:et**. Den delen finns redan i ditt projekt – vi går
igenom den så att du vet vad den gör. Sedan startar vi själva Direct3D 12: debug-lagret, DXGI-fabriken, adaptern
(grafikkortet), **enheten** (device) och **kommandokön** (command queue). Det är början av `LoadPipeline()` i
exemplet D3D12HelloWindow.
:::

Projektet till höger innehåller redan programmets skelett. `// TODO:`-kommentarerna visar var din kod ska stå, och
**Build & run** (Ctrl+Enter) kompilerar projektet och kör det i den inbyggda simulatorn. Vill du också köra programmet
på din egen dator finns det för varje API ett kort avsnitt *bygga själv* här nedan.

```quiz
Varför behöver ett grafikprogram ett bibliotek som GLFW, eller operativsystemets egna fönsterfunktioner, för att få ett fönster?
- [ ] Därför att grafik-API:ets egna fönsterfunktioner är föråldrade
- [x] Därför att fönster skapas på olika sätt i varje operativsystem och inte ingår i grafik-API:et
- [ ] Därför att grafikkortet bara kan rita i fönster som GLFW har skapat
- [ ] Därför att programmet annars inte kan använda grafikkortet alls
---
OpenGL, Vulkan och Direct3D 12 renderar bara. Fönstret (och för OpenGL kontexten) kommer från operativsystemet –
direkt via Win32, eller via ett bibliotek som GLFW som döljer skillnaderna mellan operativsystemen.
```
:::opengl
## GLFW

GLFW är ett bibliotek, skrivet i C, som är särskilt inriktat på OpenGL. Det ger oss det nödvändigaste för att rendera
till skärmen: det skapar en OpenGL-kontext, bestämmer fönstrets egenskaper och hanterar indata från användaren – vilket
räcker gott för oss.

Målet med det här och nästa kapitel är att få igång GLFW, se till att det skapar en OpenGL-kontext på rätt sätt och
att det visar ett enkelt fönster som vi kan experimentera i.

## Bygga GLFW

GLFW hämtas från dess [nedladdningssida](https://www.glfw.org/download.html). Du kan ladda ner förkompilerade binärer
för Windows, men learnopengl.com rekommenderar att du kompilerar biblioteket själv från källkoden: då byggs det med
exakt din kompilator och dina inställningar, och du kan alltid vara säker på att biblioteket passar ditt projekt. Från
källkodspaketet är det biblioteket som kommer ut ur kompileringen och mappen **include** som vi är intresserade av.

## CMake

CMake är ett verktyg som kan generera projekt-/solution-filer av valfri sort (Visual Studio, Code::Blocks, Eclipse,
Makefiles …) från en samling källfiler och en `CMakeLists.txt` som beskriver dem. Det gör att vi kan skapa ett Visual
Studio-projekt från GLFW:s källkodspaket, som vi sedan kompilerar till ett bibliotek.

I CMake-GUI:t väljer du källkodsmappen (GLFW:s rotmapp) och en byggmapp (till exempel en ny mapp `build` i den),
trycker på **Configure**, väljer din generator (till exempel din version av Visual Studio), behåller
standardinställningarna, trycker på **Configure** igen och sedan **Generate**. Byggmappen innehåller nu en solution.

## Kompilering

Öppna den genererade `GLFW.sln` och bygg den. Det kompilerade biblioteket hamnar i `build/src/Debug` som `glfw3.lib`
(på Linux och macOS ger `make` filen `libglfw3.a` i `build/src`). På Linux behöver du oftast inte bygga något alls:
distributionens paket (`libglfw3-dev` på Debian/Ubuntu, `glfw-devel` på Fedora, `glfw` på Arch) har både headerfilerna
och biblioteket. På macOS gör `brew install glfw` samma sak.

```quiz
Vad gör CMake med GLFW:s källkod?
- [ ] Det kompilerar själv källkoden till `glfw3.lib`
- [x] Det genererar projektfiler (en Visual Studio-solution, Makefiles …) för din kompilator, som du sedan bygger
- [ ] Det laddar ner de förkompilerade binärer som passar ditt system
- [ ] Det laddar OpenGL-funktionerna när programmet körs
---
CMake är en *byggsystemsgenerator*: från `CMakeLists.txt` skriver det projektfilerna för det verktyg du valt. Själva
kompileringen görs efteråt, av Visual Studio eller `make`.
```
:::
:::opengl
## Länkning

För att ditt eget projekt ska kunna använda GLFW måste kompilatorn hitta GLFW:s headerfiler och länkaren hitta
biblioteket. Ett vanligt sätt är en egen mapp (till exempel `C:\OpenGL` med undermapparna `include` och `lib`) som du
lägger till i projektets **include-kataloger** och **bibliotekskataloger**; sedan lägger du till `glfw3.lib` i
länkarens indata.

### OpenGL-biblioteket på Windows

På Windows länkar du också mot `opengl32.lib`, som följer med Windows SDK (installeras med Visual Studio). Det
innehåller ingångspunkterna för OpenGL 1.1; allt nyare laddas när programmet körs – se GLAD nedan.

### OpenGL-biblioteket på Linux

På Linux länkar du mot `libGL.so` genom att lägga till `-lGL` – men med GLAD och GLFW behövs det ofta inte ens. Om du
själv byggt GLFW som statiskt bibliotek behöver du också dess egna beroenden:
`-lglfw3 -lGL -lX11 -lpthread -lXrandr -lXi -ldl`. Med distributionens delade paket räcker `-lglfw`.

## GLAD

Vi är inte riktigt framme än. Eftersom OpenGL egentligen bara är en standard/specifikation är det upp till
drivrutinstillverkaren att implementera specifikationen i en drivrutin för just det grafikkortet. Eftersom det finns
många olika versioner av OpenGL-drivrutiner är adressen till de flesta av dess funktioner inte känd när programmet
kompileras, utan måste hämtas när det körs. Det är då utvecklarens uppgift att hämta adressen till varje funktion hen
behöver och spara den i en funktionspekare för senare bruk. Att göra det för hand, funktion för funktion, är omständligt
– och det är det GLAD gör åt oss.

### Sätta upp GLAD

GLAD är ett bibliotek med öppen källkod vars laddare du genererar med en webbtjänst (`glad.dav1d.de`, som
learnopengl.com använder). Där ställer du in språket **C/C++**, API:et **gl** i version **3.3**, profilen **Core**, ser
till att **Generate a loader** är ikryssad och trycker på **Generate**. Du får en zip-fil med två include-mappar
(`include/glad/glad.h` och `include/KHR/khrplatform.h`) och en enda `glad.c`. Kopiera båda include-mapparna till din
include-katalog och lägg till `glad.c` i ditt projekt.

### Bygga själv

Projektet i det här kapitlet är en enda fil, `main.cpp`. Med GLFW installerat och de genererade GLAD-filerna i en mapp
bredvid (`include/` och `glad.c`) kan du kompilera det på Linux så här:

```text
g++ -std=c++17 main.cpp glad.c -Iinclude -o window -lglfw -ldl
```

Eller, mer portabelt, med en liten `CMakeLists.txt` (GLFW installerar ett CMake-paket som ger målet `glfw`):

```text
cmake_minimum_required(VERSION 3.16)
project(LearnOpenGL C CXX)

find_package(glfw3 REQUIRED)

add_executable(window main.cpp glad.c)
target_include_directories(window PRIVATE include)
target_link_libraries(window PRIVATE glfw ${CMAKE_DL_LIBS})
```

I Visual Studio: ett tomt C++-projekt med `main.cpp` och `glad.c`, include- och biblioteksmapparna inställda, och
`glfw3.lib` och `opengl32.lib` som extra beroenden för länkaren.

## Hello Window

Låt oss se om vi kan få igång GLFW. Överst i `main.cpp` inkluderar projektet redan headerfilerna:

```cpp
#include <glad/glad.h>
#include <GLFW/glfw3.h>
```

Se till att inkludera GLAD före GLFW. GLAD:s headerfil inkluderar de OpenGL-headers som behövs bakom kulisserna (som
`GL/gl.h`), så den måste komma före alla andra headerfiler som kräver OpenGL – som GLFW:s.

```quiz
Varför måste `glad/glad.h` inkluderas före `GLFW/glfw3.h`?
- [ ] GLFW anropar GLAD:s funktioner medan den inkluderas
- [x] GLAD:s headerfil ger själv OpenGL-deklarationerna, så den måste komma före alla headers som annars skulle dra in systemets OpenGL-header
- [ ] Ordningen spelar ingen roll; det är bara en konvention
- [ ] `glad.h` definierar `SCR_WIDTH` och `SCR_HEIGHT`
---
GLFW inkluderar systemets OpenGL-header om ingen redan har inkluderats. GLAD:s header definierar själv alla
OpenGL-deklarationer upp till 3.3 och vägrar fungera om `gl.h` kom först – så GLAD går först.
```
:::
:::opengl
Sedan skapar vi funktionen `main`, där vi skapar GLFW-fönstret:

```cpp
glfwInit();
glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

#ifdef __APPLE__
glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#endif
```

I main-funktionen initierar vi först GLFW med `glfwInit`, och därefter kan vi konfigurera GLFW med `glfwWindowHint`.
Det första argumentet till `glfwWindowHint` anger vilket alternativ vi vill ställa in, valt ur en stor enum av möjliga
alternativ med prefixet `GLFW_`. Det andra argumentet är ett heltal som anger värdet. En lista över alla alternativ och
deras värden finns i GLFW:s [dokumentation om fönsterhantering](https://www.glfw.org/docs/latest/window_guide.html#window_hints).

Eftersom den här kursen fokuserar på OpenGL version 3.3 vill vi tala om för GLFW att det är 3.3 vi vill använda. Då kan
GLFW göra rätt förberedelser när OpenGL-kontexten skapas. Det ser till att GLFW misslyckas om användaren inte har rätt
OpenGL-version. Vi sätter både major- och minor-versionen till `3`. Vi säger också till GLFW att vi uttryckligen vill
använda **core-profilen**: då får vi tillgång till en mindre del av OpenGL:s funktioner, utan de bakåtkompatibla delar
vi inte längre behöver. På macOS måste du också be om en *forward-compatible* kontext, annars skapas ingen kontext –
det är vad raderna i `#ifdef __APPLE__` är till för.

Gör nu den första uppgiften: ersätt den första `// TODO:`-kommentaren i `main` med anropet `glfwInit()` och
fönsterhinten. Build & run: ingenting syns ännu, men programmet ska byggas och avslutas normalt.

```quiz
Du ber GLFW om en OpenGL 3.3-kontext med core-profil, men datorns drivrutin stöder bara OpenGL 2.1. Vad händer?
- [ ] GLFW skapar i tysthet en 2.1-kontext i stället
- [ ] `glfwInit()` misslyckas
- [x] Att skapa fönstret (och dess kontext) misslyckas: `glfwCreateWindow` returnerar `NULL`
- [ ] Programmet kraschar första gången det ritar
---
Fönsterhinten är krav på kontexten. Om drivrutinen inte kan uppfylla dem returnerar `glfwCreateWindow` `NULL` – därför
kontrollerar vi returvärdet.
```
:::
:::opengl
Sedan måste vi skapa ett fönsterobjekt. Det här objektet håller all fönsterdata och behövs av de flesta av GLFW:s
andra funktioner.

```cpp
GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
if (window == NULL)
{
    std::cout << "Failed to create GLFW window" << std::endl;
    glfwTerminate();
    return -1;
}
glfwMakeContextCurrent(window);
```

Funktionen `glfwCreateWindow` tar fönstrets bredd och höjd som sina två första argument – `SCR_WIDTH` och `SCR_HEIGHT`
är definierade överst i filen som 800 och 600. Det tredje argumentet ger fönstret ett namn; vi kallar det
`"LearnOpenGL"`. De två sista parametrarna kan vi strunta i (en skärm för helskärmsläge, och en kontext att dela
resurser med). Funktionen returnerar ett `GLFWwindow`-objekt som vi senare behöver för andra GLFW-operationer. Därefter
säger vi till GLFW att göra vårt fönsters kontext till huvudkontexten i den aktuella tråden: från och med nu går
OpenGL-anropen till den här kontexten.

Gör nu den andra uppgiften: skapa fönstret, kontrollera det och gör dess kontext aktuell.

## GLAD

I förra avsnittet nämnde vi att GLAD hanterar funktionspekarna för OpenGL, så vi vill initiera GLAD innan vi anropar
någon OpenGL-funktion:

```cpp
if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
{
    std::cout << "Failed to initialize GLAD" << std::endl;
    return -1;
}
```

Vi ger GLAD funktionen som hämtar adresserna till OpenGL-funktionerna, och den är specifik för operativsystemet. GLFW
ger oss `glfwGetProcAddress`, som väljer rätt funktion beroende på vilket operativsystem vi kompilerar för. GLAD anropar
den för varje OpenGL-funktion och sparar adresserna den får tillbaka.

Gör nu den tredje uppgiften: lägg initieringen av GLAD direkt efter `glfwMakeContextCurrent(window);`.

```quiz
Varför måste `gladLoadGLLoader` anropas efter `glfwMakeContextCurrent(window)`?
- [ ] Därför att GLAD behöver fönstrets bredd och höjd
- [x] Därför att funktionsadresserna hämtas från den aktuella kontexten (via `glfwGetProcAddress`); utan en aktuell kontext finns det ingen att fråga
- [ ] Därför att `glfwMakeContextCurrent` raderar de funktionspekare som GLAD laddat tidigare
- [ ] Det måste den inte – ordningen spelar ingen roll
---
Adresserna hör till drivrutinen bakom kontexten. `glfwGetProcAddress` fungerar bara medan en kontext är aktuell, så:
skapa fönstret, gör dess kontext aktuell, ladda sedan GLAD.
```
:::
:::opengl
## Städa upp

När vi är klara vill vi städa upp ordentligt och ta bort alla resurser som GLFW har allokerat. Det gör vi med
funktionen `glfwTerminate`, som vi anropar i slutet av funktionen `main`:

```cpp
glfwTerminate();
return 0;
```

Det frigör alla resurser och avslutar programmet på rätt sätt. Gör den sista uppgiften: lägg till `glfwTerminate();`
direkt före `return 0;`.

Försök nu bygga och köra programmet. Om allt gick bra ser du ett fönster med titeln "LearnOpenGL" dyka upp – och
försvinna igen direkt. Det är väntat: ingenting håller programmet igång ännu. Om det inte fungerade, jämför din kod med
uppgifternas tips.

```quiz
Det färdiga programmet öppnar sitt fönster och stänger det igen direkt. Varför?
- [ ] Därför att fönstret inte har någon viewport ännu
- [ ] Därför att GLAD inte kunde laddas
- [x] Därför att `main` saknar en loop: direkt efter att allt satts upp anropar den `glfwTerminate()` och returnerar
- [ ] Därför att core-profilen inte tillåter att fönster förblir öppna
---
Ett fönster finns bara så länge programmet körs. I nästa kapitel, Hello Window, lägger du till en *render loop* som
håller fönstret öppet och ritar i det tills det stängs.
```
:::
:::opengl
## Mer att läsa

- [Creating a window](https://learnopengl.com/Getting-started/Creating-a-window) och
  [Hello Window](https://learnopengl.com/Getting-started/Hello-Window) på learnopengl.com: kapitlen som det här följer,
  med skärmbilder av uppsättningen i Visual Studio och CMake.
- GLFW:s [window guide](https://www.glfw.org/docs/latest/window_guide.html) och
  [context guide](https://www.glfw.org/docs/latest/context_guide.html): alla fönsterhints och vad de gör.

I nästa kapitel håller vi fönstret öppet med en render loop, reagerar på indata och fyller fönstret med en färg.
:::
:::vulkan
## Utvecklingsmiljö

För att utveckla Vulkan-program på din egen dator behöver du tre saker: en C++17-kompilator, Vulkan SDK (eller din
Linux-distributions Vulkan-paket) och GLFW.

- **Vulkan SDK** från [LunarG](https://vulkan.lunarg.com/) innehåller headerfilerna, standardvalideringslagren,
  felsökningsverktyg och **loadern**. Loadern är biblioteket du länkar mot (`vulkan-1.lib` på Windows, `libvulkan.so`
  på Linux): den slår upp funktionerna i drivrutinen när programmet körs. I SDK:t finns också `vkcube`, en liten demo –
  kör den först för att kontrollera att ditt grafikkort och din drivrutin stöder Vulkan. Senare kommer även
  shaderkompilatorerna `glslc` och `glslangValidator` till nytta.
- **GLFW** från [glfw.org](https://www.glfw.org/download.html) (på Windows går de förkompilerade 64-bitarsbinärerna
  bra).

vulkan-tutorial.com installerar också GLM, ett matematikbibliotek; det behöver du inte förrän vid transformationer.

### Bygga själv

På Linux (paketnamn för Debian/Ubuntu; Fedora och Arch har samma sak med liknande namn) installerar du loadern,
valideringslagren, verktygen och GLFW:

```text
sudo apt install libvulkan-dev vulkan-validationlayers vulkan-tools libglfw3-dev
```

Kompilera sedan `main.cpp` med:

```text
g++ -std=c++17 -o VulkanTest main.cpp -lglfw -lvulkan
```

(vulkan-tutorial.coms makefile använder `-lglfw -lvulkan -ldl -lpthread -lX11 -lXxf86vm -lXrandr -lXi`; med en delad
GLFW räcker de två första.) Definiera inte `NDEBUG` medan du lär dig – du ser varför under *Valideringslager*. Med CMake
ger `find_package(Vulkan REQUIRED)` och `find_package(glfw3 REQUIRED)` dig målen `Vulkan::Vulkan` och `glfw` att länka
mot.

På Windows installerar du SDK:t och packar upp GLFW, och i ett C++-projekt i Visual Studio lägger du sedan till SDK:ts
mapp `Include` och GLFW:s mapp `include` bland include-katalogerna, SDK:ts mapp `Lib` och GLFW:s biblioteksmapp bland
bibliotekskatalogerna, `vulkan-1.lib` och `glfw3.lib` i länkarens indata, och ställer in språkstandarden på C++17.

På macOS kör SDK:t Vulkan ovanpå Metal (MoltenVK). Där kan `vkCreateInstance` returnera
`VK_ERROR_INCOMPATIBLE_DRIVER` om du inte aktiverar instans-extensionen `VK_KHR_portability_enumeration` och sätter
`VK_INSTANCE_CREATE_ENUMERATE_PORTABILITY_BIT_KHR` i create-infons `flags`; koden i den här kursen gör inte det,
eftersom den riktar sig mot Windows och Linux.

## Baskod

Ditt projekt börjar med vulkan-tutorial.coms baskod. Programmet är inneslutet i en klass där vi sparar Vulkan-objekten
som privata medlemmar och lägger till funktioner som skapar vart och ett av dem, och som anropas från `initVulkan`:

```cpp
void run() {
    initWindow();
    initVulkan();
    mainLoop();
    cleanup();
}
```

När allt är förberett körs `mainLoop` tills fönstret stängs, och `cleanup` frigör sedan allt. Om ett allvarligt fel
inträffar kastar vi ett `std::runtime_error` med ett beskrivande meddelande; `main` fångar det, skriver ut det och
returnerar `EXIT_FAILURE`.

### Resurshantering

Precis som varje `malloc` behöver en `free` måste varje Vulkan-objekt vi skapar förstöras uttryckligen när vi inte
längre behöver det. Objekt skapas med funktioner som `vkCreateXXX` (eller allokeras med `vkAllocateXXX`) och förstörs
med `vkDestroyXXX` (eller `vkFreeXXX`). De här funktionerna har en gemensam parameter `pAllocator` för egna
minnesallokerings-callbacks; vi skickar alltid `nullptr`. Ungefär varje avsnitt som följer lägger till en funktion som
anropas från `initVulkan`, en eller flera klassmedlemmar, och motsvarande förstöring i `cleanup` – i omvänd ordning mot
hur de skapades.

### Integrera GLFW

Filen börjar med:

```cpp
#define GLFW_INCLUDE_VULKAN
#include <GLFW/glfw3.h>
```

På så vis inkluderar GLFW Vulkan-headern (`vulkan/vulkan.h`) tillsammans med sin egen. `initWindow` skapar fönstret:

```cpp
void initWindow() {
    glfwInit();

    glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API);
    glfwWindowHint(GLFW_RESIZABLE, GLFW_FALSE);

    window = glfwCreateWindow(WIDTH, HEIGHT, "Vulkan", nullptr, nullptr);
}
```

Eftersom GLFW ursprungligen gjordes för att skapa en OpenGL-kontext måste vi säga åt det att *inte* skapa någon, med
`GLFW_CLIENT_API` satt till `GLFW_NO_API`. Fönster som ändrar storlek kräver särskild omsorg som vi tittar på mycket
senare, så det stängs av med `GLFW_RESIZABLE`. De tre första parametrarna till `glfwCreateWindow` är bredd, höjd
(`WIDTH` och `HEIGHT`, 800 och 600) och titel; den fjärde anger valfritt en skärm för helskärmsläge, och den sista är
bara relevant för OpenGL.

`mainLoop` håller programmet igång och behandlar händelser (som att stängningsknappen trycks) tills fönstret stängs;
`cleanup` förstör fönstret och avslutar GLFW:

```cpp
void mainLoop() {
    while (!glfwWindowShouldClose(window)) {
        glfwPollEvents();
    }
}
```

Bygg och kör projektet som det är: ett fönster med titeln "Vulkan" öppnas och förblir öppet tills du stänger det. Dess
innehåll är svart (egentligen odefinierat) – ingenting visas i det förrän nästa kapitel presenterar den första bilden.

```quiz
Varför anropar `initWindow` `glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API)`?
- [ ] För att göra fönstret till helskärm
- [x] Därför att GLFW annars skulle skapa en OpenGL-kontext för fönstret, som ett Vulkan-program inte använder
- [ ] För att hindra användaren från att ändra fönstrets storlek
- [ ] För att säga åt GLFW att ladda Vulkan-funktionerna
---
GLFW skapar som standard en OpenGL-kontext till varje fönster. Vulkan pratar med fönstret på sitt eget sätt (via en
surface, i nästa kapitel), så vi stänger av kontexten. Storleksändring stängs av med det *andra* hintet.
```
:::
:::vulkan
## Instans

Det allra första du måste göra är att initiera Vulkan-biblioteket genom att skapa en **instans**. Instansen är
kopplingen mellan ditt program och Vulkan-biblioteket, och när du skapar den anger du en del uppgifter om ditt program
till drivrutinen. Den sparas i en klassmedlem, `VkInstance instance;`, och skapas i en ny funktion `createInstance()`
som anropas från `initVulkan`.

För att skapa en instans fyller vi först i en struct med lite information om vårt program. Den här informationen är
tekniskt sett valfri, men den kan ge drivrutinen användbar information för att optimera för vårt program:

```cpp
VkApplicationInfo appInfo{};
appInfo.sType = VK_STRUCTURE_TYPE_APPLICATION_INFO;
appInfo.pApplicationName = "Hello Triangle";
appInfo.applicationVersion = VK_MAKE_VERSION(1, 0, 0);
appInfo.pEngineName = "No Engine";
appInfo.engineVersion = VK_MAKE_VERSION(1, 0, 0);
appInfo.apiVersion = VK_API_VERSION_1_0;
```

Många structs i Vulkan kräver att du uttryckligen anger deras typ i medlemmen `sType`. Det här är också en av många
structs med en medlem `pNext` som kan peka på information för extensions; värdeinitieringen `{}` lämnar den som
`nullptr`.

Mycket information i Vulkan skickas via structs i stället för funktionsparametrar. Nästa struct är inte valfri: den
talar om för Vulkan-drivrutinen vilka globala extensions och valideringslager vi vill använda. Globala betyder här att
de gäller hela programmet och inte en viss enhet.

```cpp
VkInstanceCreateInfo createInfo{};
createInfo.sType = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO;
createInfo.pApplicationInfo = &appInfo;

auto extensions = getRequiredExtensions();
createInfo.enabledExtensionCount = static_cast<uint32_t>(extensions.size());
createInfo.ppEnabledExtensionNames = extensions.data();

createInfo.enabledLayerCount = 0;
```

Vulkan är ett plattformsoberoende API, vilket betyder att du behöver en extension för att prata med fönstersystemet.
GLFW har en praktisk funktion som returnerar de extensions det behöver för det; vi samlar dem i
`getRequiredExtensions()` (den får en extension till senare):

```cpp
std::vector<const char*> getRequiredExtensions() {
    uint32_t glfwExtensionCount = 0;
    const char** glfwExtensions;
    glfwExtensions = glfwGetRequiredInstanceExtensions(&glfwExtensionCount);

    std::vector<const char*> extensions(glfwExtensions, glfwExtensions + glfwExtensionCount);

    return extensions;
}
```

De två sista medlemmarna i structen bestämmer vilka globala valideringslager som aktiveras – inga än så länge. Nu har
vi angett allt Vulkan behöver för att skapa en instans:

```cpp
if (vkCreateInstance(&createInfo, nullptr, &instance) != VK_SUCCESS) {
    throw std::runtime_error("failed to create instance!");
}
```

Det allmänna mönstret för funktioner som skapar objekt i Vulkan är: en pekare till en struct med information om
skapandet, en pekare till egna allokerings-callbacks (alltid `nullptr` här) och en pekare till variabeln som tar emot
det nya objektets handtag (handle). Nästan alla Vulkan-funktioner returnerar ett `VkResult` som är antingen
`VK_SUCCESS` eller en felkod.

Instansen ska förstöras först precis innan programmet avslutas, i `cleanup`, efter alla andra Vulkan-objekt:

```cpp
vkDestroyInstance(instance, nullptr);
```

Gör nu den första uppgiften: lägg till medlemmen `instance`, skriv `createInstance()` och `getRequiredExtensions()`,
anropa `createInstance()` i `initVulkan` och förstör instansen i `cleanup`. Build & run: fönstret ser likadant ut, men
nu finns det en instans bakom det.

```quiz
Varför aktiverar `createInstance` de extensions som `glfwGetRequiredInstanceExtensions` returnerar?
- [ ] Därför att GLFW inte kan öppna ett fönster utan dem
- [x] Därför att Vulkan är plattformsoberoende: att prata med fönstersystemet kräver instans-extensions (som `VK_KHR_surface`), och GLFW vet vilka den här plattformen behöver
- [ ] Därför att de slår på valideringslagren
- [ ] Därför att `vkCreateInstance` annars inte hittar något grafikkort
---
Fönstret finns redan utan Vulkan. Det är extensionerna som gör att *Vulkan* senare kan visa bilder i det –
`VK_KHR_surface` plus en plattformsspecifik som `VK_KHR_win32_surface` eller `VK_KHR_xlib_surface`.
```
:::
:::vulkan
## Valideringslager

Vulkan-API:et är byggt kring idén om minimalt arbete i drivrutinen, och ett av uttrycken för det målet är att API:et
som standard gör mycket begränsad felkontroll. Även så enkla misstag som att sätta en enum till ett felaktigt värde
eller skicka nullpekare till obligatoriska parametrar leder i regel till krascher eller odefinierat beteende.

Vulkan har ett elegant system för det här som kallas **valideringslager** (validation layers): valfria komponenter som
hakar i Vulkans funktionsanrop och utför extra operationer – kontrollerar parametervärden mot specifikationen, följer
när objekt skapas och förstörs för att hitta resursläckor, kontrollerar trådsäkerhet, loggar anrop. Du kan aktivera dem
i debug-byggen och stänga av dem helt i release-byggen, vilket ger dig det bästa av två världar. All användbar
standardvalidering är samlad i ett lager som följer med SDK:t, `VK_LAYER_KHRONOS_validation`.

Vi lägger till två inställningsvariabler överst i filen: lagren som ska aktiveras, och om de ska aktiveras. Makrot
`NDEBUG` ingår i C++-standarden och betyder "inte debug":

```cpp
const std::vector<const char*> validationLayers = {
    "VK_LAYER_KHRONOS_validation"
};

#ifdef NDEBUG
const bool enableValidationLayers = false;
#else
const bool enableValidationLayers = true;
#endif
```

En ny funktion `checkValidationLayerSupport` kontrollerar om alla begärda lager finns. Den använder mönstret med två
anrop som du kommer att se överallt i Vulkan: fråga först efter antalet, allokera sedan en array och fråga igen för att
fylla den:

```cpp
bool checkValidationLayerSupport() {
    uint32_t layerCount;
    vkEnumerateInstanceLayerProperties(&layerCount, nullptr);

    std::vector<VkLayerProperties> availableLayers(layerCount);
    vkEnumerateInstanceLayerProperties(&layerCount, availableLayers.data());

    for (const char* layerName : validationLayers) {
        bool layerFound = false;

        for (const auto& layerProperties : availableLayers) {
            if (strcmp(layerName, layerProperties.layerName) == 0) {
                layerFound = true;
                break;
            }
        }

        if (!layerFound) {
            return false;
        }
    }

    return true;
}
```

Vi använder den överst i `createInstance`:

```cpp
if (enableValidationLayers && !checkValidationLayerSupport()) {
    throw std::runtime_error("validation layers requested, but not available!");
}
```

och vi ersätter `createInfo.enabledLayerCount = 0;` med lagrens namn, om de är aktiverade:

```cpp
if (enableValidationLayers) {
    createInfo.enabledLayerCount = static_cast<uint32_t>(validationLayers.size());
    createInfo.ppEnabledLayerNames = validationLayers.data();
} else {
    createInfo.enabledLayerCount = 0;
}
```

Gör nu den andra uppgiften. Build & run: om lagret saknades skulle programmet stanna med "validation layers requested,
but not available!".

### Callback för meddelanden

Valideringslagren skriver som standard ut sina meddelanden på standard output, men vi kan också ta hand om dem själva
med en callback. Då kan du bestämma vilka sorters meddelanden du vill se, eftersom inte alla är (allvarliga) fel. För
det sätter vi upp en **debug messenger**, som kommer från extensionen `VK_EXT_debug_utils` – så extensionen läggs till
i `getRequiredExtensions()` när lagren är aktiverade:

```cpp
if (enableValidationLayers) {
    extensions.push_back(VK_EXT_DEBUG_UTILS_EXTENSION_NAME);
}
```

Callbacken är en statisk medlemsfunktion med prototypen `PFN_vkDebugUtilsMessengerCallbackEXT`; `VKAPI_ATTR` och
`VKAPI_CALL` ser till att den har rätt signatur för att Vulkan ska kunna anropa den:

```cpp
static VKAPI_ATTR VkBool32 VKAPI_CALL debugCallback(VkDebugUtilsMessageSeverityFlagBitsEXT messageSeverity, VkDebugUtilsMessageTypeFlagsEXT messageType, const VkDebugUtilsMessengerCallbackDataEXT* pCallbackData, void* pUserData) {
    std::cerr << "validation layer: " << pCallbackData->pMessage << std::endl;

    return VK_FALSE;
}
```

`messageSeverity` anger hur allvarligt meddelandet är (verbose, info, warning eller error), `messageType` om det är en
allmän händelse, ett brott mot specifikationen eller ett prestandatips, och `pCallbackData` innehåller detaljerna –
viktigast `pMessage`, själva meddelandet. Returvärdet anger om Vulkan-anropet som gav upphov till meddelandet ska
avbrytas; det är bara tänkt för att testa själva lagren, så returnera alltid `VK_FALSE`.

Till och med debug-callbacken hanteras med ett handtag som måste skapas och förstöras uttryckligen: en klassmedlem
`VkDebugUtilsMessengerEXT debugMessenger;`, som sätts upp av `setupDebugMessenger()` direkt efter `createInstance()`.
Detaljerna fylls i en `VkDebugUtilsMessengerCreateInfoEXT`, i en egen funktion eftersom vi behöver den två gånger:

```cpp
void populateDebugMessengerCreateInfo(VkDebugUtilsMessengerCreateInfoEXT& createInfo) {
    createInfo = {};
    createInfo.sType = VK_STRUCTURE_TYPE_DEBUG_UTILS_MESSENGER_CREATE_INFO_EXT;
    createInfo.messageSeverity = VK_DEBUG_UTILS_MESSAGE_SEVERITY_VERBOSE_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_SEVERITY_ERROR_BIT_EXT;
    createInfo.messageType = VK_DEBUG_UTILS_MESSAGE_TYPE_GENERAL_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_TYPE_VALIDATION_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_TYPE_PERFORMANCE_BIT_EXT;
    createInfo.pfnUserCallback = debugCallback;
}

void setupDebugMessenger() {
    if (!enableValidationLayers) return;

    VkDebugUtilsMessengerCreateInfoEXT createInfo;
    populateDebugMessengerCreateInfo(createInfo);

    if (CreateDebugUtilsMessengerEXT(instance, &createInfo, nullptr, &debugMessenger) != VK_SUCCESS) {
        throw std::runtime_error("failed to set up debug messenger!");
    }
}
```

`messageSeverity` räknar upp de allvarlighetsgrader som callbacken anropas för (allt utom info här), `messageType`
typerna (alla).

`vkCreateDebugUtilsMessengerEXT` är en extension-funktion, så loadern exporterar den inte: vi måste själva slå upp dess
adress med `vkGetInstanceProcAddr`. Två små proxyfunktioner ovanför klassen gör det, en för att skapa och en för att
förstöra messengern:

```cpp
VkResult CreateDebugUtilsMessengerEXT(VkInstance instance, const VkDebugUtilsMessengerCreateInfoEXT* pCreateInfo, const VkAllocationCallbacks* pAllocator, VkDebugUtilsMessengerEXT* pDebugMessenger) {
    auto func = (PFN_vkCreateDebugUtilsMessengerEXT) vkGetInstanceProcAddr(instance, "vkCreateDebugUtilsMessengerEXT");
    if (func != nullptr) {
        return func(instance, pCreateInfo, pAllocator, pDebugMessenger);
    } else {
        return VK_ERROR_EXTENSION_NOT_PRESENT;
    }
}

void DestroyDebugUtilsMessengerEXT(VkInstance instance, VkDebugUtilsMessengerEXT debugMessenger, const VkAllocationCallbacks* pAllocator) {
    auto func = (PFN_vkDestroyDebugUtilsMessengerEXT) vkGetInstanceProcAddr(instance, "vkDestroyDebugUtilsMessengerEXT");
    if (func != nullptr) {
        func(instance, debugMessenger, pAllocator);
    }
}
```

Messengern hör till instansen, så `cleanup` förstör den före instansen:

```cpp
if (enableValidationLayers) {
    DestroyDebugUtilsMessengerEXT(instance, debugMessenger, nullptr);
}
```

### Felsöka när instansen skapas och förstörs

En lucka återstår: messengern behöver en giltig instans, och den måste förstöras före instansen – så problem inuti
själva `vkCreateInstance` och `vkDestroyInstance` skulle inte rapporteras. Extensionen har en lösning på det: skicka en
`VkDebugUtilsMessengerCreateInfoEXT` i fältet `pNext` i `VkInstanceCreateInfo`, så används en separat messenger
automatiskt under de två anropen. I `createInstance` blir koden för lagren:

```cpp
VkDebugUtilsMessengerCreateInfoEXT debugCreateInfo{};
if (enableValidationLayers) {
    createInfo.enabledLayerCount = static_cast<uint32_t>(validationLayers.size());
    createInfo.ppEnabledLayerNames = validationLayers.data();

    populateDebugMessengerCreateInfo(debugCreateInfo);
    createInfo.pNext = (VkDebugUtilsMessengerCreateInfoEXT*) &debugCreateInfo;
} else {
    createInfo.enabledLayerCount = 0;

    createInfo.pNext = nullptr;
}
```

`debugCreateInfo` deklareras utanför `if`-satsen så att den fortfarande finns när `vkCreateInstance` anropas.

Gör nu den tredje uppgiften – den berör flera ställen, så följ TODO-kommentarerna: de två proxyfunktionerna, medlemmen
`debugMessenger`, `debugCallback`, `populateDebugMessengerCreateInfo()` och `setupDebugMessenger()`, extensionen,
`pNext`-kedjan, anropet i `initVulkan` och förstöringen i `cleanup`. Build & run: utdata visar nu rader som börjar med
`validation layer:`. Eftersom vi också bad om verbose-meddelanden är det mest ofarlig information från loadern. Ett
korrekt program visar inga meddelanden med `Validation Error` eller `Validation Warning` i – håll utkik efter dem från
och med nu.

```quiz
Varför kedjas en `VkDebugUtilsMessengerCreateInfoEXT` också in i `pNext` i `VkInstanceCreateInfo`?
- [ ] Därför att `setupDebugMessenger` inte fungerar utan den
- [ ] För att aktivera extensionen `VK_EXT_debug_utils`
- [x] För att även `vkCreateInstance` och `vkDestroyInstance` ska kontrolleras: den vanliga messengern kan bara finnas mellan de två anropen
- [ ] För att skicka valideringslagrens namn till drivrutinen
---
`debugMessenger` behöver en instans för att kunna skapas och måste förstöras före den. Create-infon i `pNext` ger de
två anropen en egen messenger, som städas bort automatiskt.
```
:::
:::vulkan
## Fysiska enheter och köfamiljer

Efter att ha initierat Vulkan-biblioteket via en `VkInstance` måste vi leta upp och välja ett grafikkort i systemet som
stöder de funktioner vi behöver. Vi nöjer oss med det första grafikkortet som passar. Det sparas i en ny klassmedlem:

```cpp
VkPhysicalDevice physicalDevice = VK_NULL_HANDLE;
```

Det här objektet förstörs automatiskt när `VkInstance` förstörs, så `cleanup` behöver inget nytt. Att lista
grafikkorten i `pickPhysicalDevice()` liknar mycket listningen av lagren – mönstret med två anrop igen:

```cpp
void pickPhysicalDevice() {
    uint32_t deviceCount = 0;
    vkEnumeratePhysicalDevices(instance, &deviceCount, nullptr);

    if (deviceCount == 0) {
        throw std::runtime_error("failed to find GPUs with Vulkan support!");
    }

    std::vector<VkPhysicalDevice> devices(deviceCount);
    vkEnumeratePhysicalDevices(instance, &deviceCount, devices.data());

    for (const auto& device : devices) {
        if (isDeviceSuitable(device)) {
            physicalDevice = device;
            break;
        }
    }

    if (physicalDevice == VK_NULL_HANDLE) {
        throw std::runtime_error("failed to find a suitable GPU!");
    }
}
```

Alla grafikkort är inte likadana, så `isDeviceSuitable` kontrollerar vart och ett. Du skulle kunna fråga efter dess
egenskaper (namn, typ, Vulkan-version som stöds) med `vkGetPhysicalDeviceProperties` och dess valfria funktioner (som
geometry shaders) med `vkGetPhysicalDeviceFeatures`, och till exempel föredra ett separat grafikkort genom att ge varje
enhet poäng. Än så länge behöver vi bara en sak: en kö som kan göra grafik.

### Köfamiljer

Nästan varje operation i Vulkan, allt från att rita till att ladda upp texturer, kräver att kommandon skickas till en
**kö** (queue). Det finns olika typer av köer som kommer från olika **köfamiljer** (queue families), och varje familj
av köer tillåter bara en delmängd av kommandona: det kan finnas en familj som bara tillåter beräkningskommandon, eller
en som bara tillåter minnesöverföringar. Vi behöver en köfamilj som stöder grafikkommandon, och vi samlar dess index i
en struct, eftersom ett senare kapitel letar efter en andra köfamilj:

```cpp
struct QueueFamilyIndices {
    std::optional<uint32_t> graphicsFamily;

    bool isComplete() {
        return graphicsFamily.has_value();
    }
};
```

Vilket värde som helst av `uint32_t` skulle i teorin kunna vara ett giltigt köfamiljsindex, även `0`, så det finns
inget "magiskt" värde som kan betyda "hittades inte". `std::optional` (C++17) löser det: den innehåller inget värde
förrän du tilldelar den något, och `has_value()` talar om ifall den gör det.

`findQueueFamilies` hämtar listan över köfamiljer med `vkGetPhysicalDeviceQueueFamilyProperties` och letar efter en med
`VK_QUEUE_GRAPHICS_BIT`; `isDeviceSuitable` godkänner en enhet om den har en sådan:

```cpp
bool isDeviceSuitable(VkPhysicalDevice device) {
    QueueFamilyIndices indices = findQueueFamilies(device);

    return indices.isComplete();
}

QueueFamilyIndices findQueueFamilies(VkPhysicalDevice device) {
    QueueFamilyIndices indices;

    uint32_t queueFamilyCount = 0;
    vkGetPhysicalDeviceQueueFamilyProperties(device, &queueFamilyCount, nullptr);

    std::vector<VkQueueFamilyProperties> queueFamilies(queueFamilyCount);
    vkGetPhysicalDeviceQueueFamilyProperties(device, &queueFamilyCount, queueFamilies.data());

    int i = 0;
    for (const auto& queueFamily : queueFamilies) {
        if (queueFamily.queueFlags & VK_QUEUE_GRAPHICS_BIT) {
            indices.graphicsFamily = i;
        }

        if (indices.isComplete()) {
            break;
        }

        i++;
    }

    return indices;
}
```

Gör den fjärde uppgiften: lägg till structen, medlemmen, de tre funktionerna, och anropa `pickPhysicalDevice()` efter
`setupDebugMessenger()`. Build & run – fönstret är oförändrat, och om ingen Vulkan-enhet passar stannar programmet med
"failed to find a suitable GPU!".

```quiz
Varför sparar `QueueFamilyIndices` grafikfamiljen som `std::optional<uint32_t>` i stället för en vanlig `uint32_t`?
- [ ] Därför att köfamiljsindex kan vara negativa
- [ ] Därför att `std::optional` gör sökningen snabbare
- [x] Därför att varje `uint32_t`-värde, även `0`, kan vara ett giltigt index – så ett vanligt tal kan inte betyda "hittades inte"
- [ ] Därför att Vulkan kräver `std::optional` i sina structs
---
`std::optional` lägger till det saknade tillståndet "inget värde": `graphicsFamily.has_value()` är sant först när en
familj med `VK_QUEUE_GRAPHICS_BIT` har hittats.
```
:::
:::vulkan
## Logisk enhet och köer

Efter att ha valt en fysisk enhet måste vi sätta upp en **logisk enhet** (logical device) för att prata med den. Den
skapas på liknande sätt som instansen: den beskriver vilka funktioner vi vill använda, och vilka köer som ska skapas nu
när vi vet vilka köfamiljer som finns. Nya klassmedlemmar håller enheten och dess kö:

```cpp
VkDevice device;

VkQueue graphicsQueue;
```

`createLogicalDevice()`, som anropas efter `pickPhysicalDevice()`, beskriver först de köer vi vill ha från en enda
köfamilj – en kö med grafikförmåga:

```cpp
QueueFamilyIndices indices = findQueueFamilies(physicalDevice);

VkDeviceQueueCreateInfo queueCreateInfo{};
queueCreateInfo.sType = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO;
queueCreateInfo.queueFamilyIndex = indices.graphicsFamily.value();
queueCreateInfo.queueCount = 1;

float queuePriority = 1.0f;
queueCreateInfo.pQueuePriorities = &queuePriority;
```

Du behöver egentligen inte mer än en kö per familj: du kan spela in command buffers i många trådar och skicka dem alla
på en gång till en kö. Vulkan låter dig ge köer prioriteter (mellan `0.0` och `1.0`) för att påverka hur de schemaläggs;
det krävs även när det bara finns en enda kö.

Därefter kommer de enhetsfunktioner (device features) vi ska använda – de du kan fråga efter med
`vkGetPhysicalDeviceFeatures`. Vi behöver inget särskilt än, så allt förblir `VK_FALSE`. Sedan huvudstructen:

```cpp
VkPhysicalDeviceFeatures deviceFeatures{};

VkDeviceCreateInfo createInfo{};
createInfo.sType = VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO;

createInfo.pQueueCreateInfos = &queueCreateInfo;
createInfo.queueCreateInfoCount = 1;

createInfo.pEnabledFeatures = &deviceFeatures;

createInfo.enabledExtensionCount = 0;

if (enableValidationLayers) {
    createInfo.enabledLayerCount = static_cast<uint32_t>(validationLayers.size());
    createInfo.ppEnabledLayerNames = validationLayers.data();
} else {
    createInfo.enabledLayerCount = 0;
}
```

Precis som instansen kan enheten ha extensions – den här gången enhetsspecifika, som `VK_KHR_swapchain` i nästa
kapitel; inga än. Aktuella implementationer ignorerar enhetens fält för lager (det finns inga lager bara för enheter
längre), men äldre behöver dem, så vi skickar samma lager som för instansen. Nu skapar vi enheten och hämtar handtaget
till dess kö:

```cpp
if (vkCreateDevice(physicalDevice, &createInfo, nullptr, &device) != VK_SUCCESS) {
    throw std::runtime_error("failed to create logical device!");
}

vkGetDeviceQueue(device, indices.graphicsFamily.value(), 0, &graphicsQueue);
```

Kön skapas tillsammans med enheten; `vkGetDeviceQueue` ger oss bara dess handtag – köfamilj, köindex (`0`, den enda)
och var det ska sparas. Köer städas bort automatiskt när enheten förstörs. Själva enheten förstörs först i `cleanup`:

```cpp
vkDestroyDevice(device, nullptr);
```

Gör den sista uppgiften. Build & run: fönstret öppnas som förut, det kommer inga valideringsfel, och programmet
avslutas snyggt när du stänger fönstret. Med den logiska enheten och köns handtag kan vi faktiskt börja använda
grafikkortet – i nästa kapitel kopplar vi det till fönstret och visar den första bilden.

```quiz
Vilka av de här objekten förstör `cleanup()` uttryckligen? (Välj alla som stämmer.)
- [x] Den logiska enheten (`vkDestroyDevice`)
- [x] Debug-messengern (`DestroyDebugUtilsMessengerEXT`)
- [x] Instansen (`vkDestroyInstance`)
- [ ] Den fysiska enheten
- [ ] Grafikkön
---
Allt du skapar förstörs, i omvänd ordning. Den fysiska enheten och kön skapas inte av dig – de bara hämtas – och
försvinner tillsammans med instansen och enheten.
```
:::
:::vulkan
## Mer att läsa

- vulkan-tutorial.com: [Development environment](https://vulkan-tutorial.com/Development_environment),
  [Instance](https://vulkan-tutorial.com/Drawing_a_triangle/Setup/Instance),
  [Validation layers](https://vulkan-tutorial.com/Drawing_a_triangle/Setup/Validation_layers),
  [Physical devices and queue families](https://vulkan-tutorial.com/Drawing_a_triangle/Setup/Physical_devices_and_queue_families) och
  [Logical device and queues](https://vulkan-tutorial.com/Drawing_a_triangle/Setup/Logical_device_and_queues) –
  kapitlen som det här följer.
- [Vulkan SDK](https://vulkan.lunarg.com/) och dess kom-igång-guider.
:::
:::d3d12
## Utvecklingsmiljö

Allt du behöver för Direct3D 12 följer med Windows och Visual Studio:

- **Visual Studio** med arbetsbelastningen **Desktop development with C++**. Den installerar kompilatorn och
  **Windows SDK**, som innehåller headerfilerna projektet inkluderar – `d3d12.h`, `dxgi1_6.h`, `d3dcompiler.h`,
  `DirectXMath.h`, `wrl.h` – och importbiblioteken `d3d12.lib`, `dxgi.lib` och `d3dcompiler.lib`.
- **d3dx12.h**, ett hjälpbibliotek för D3D12 som bara består av headers (structarna `CD3DX12_...`). Det finns inte i
  Windows SDK; det kommer från Microsofts repository [DirectX-Headers](https://github.com/microsoft/DirectX-Headers), i
  mappen `include/directx` (som också innehåller en matchande, nyare `d3d12.h`). Du kan också hämta det via vcpkg
  (`directx-headers`).
- **Graphics Tools**, en valfri funktion i Windows (Inställningar → System → Valfria funktioner → Lägg till en valfri
  funktion). Den innehåller D3D12:s debug-lager, som vi slår på nedan.

Biblioteken länkas av tre rader överst i `main.cpp`, som bara Microsofts kompilator läser:

```cpp
#if defined(_MSC_VER)
#pragma comment(lib, "d3d12.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "d3dcompiler.lib")
#endif
```

### Bygga själv

I Visual Studio skapar du ett tomt C++-projekt, lägger till `main.cpp`, lägger till DirectX-Headers mapp
`include/directx` bland include-katalogerna och ställer in **Linker → System → SubSystem** på **Windows**: programmet
startar i `wWinMain`, ingångspunkten för ett Windows-program (inte ett konsolprogram). Bygg konfigurationen **Debug** –
den definierar `_DEBUG`, vilket slår på koden för debug-lagret. Från en *Developer Command Prompt* blir samma sak:

```text
cl /std:c++17 /EHsc /MDd /Zi /I DirectX-Headers\include\directx main.cpp /link /SUBSYSTEM:WINDOWS user32.lib
```

(`/MDd` väljer debug-runtime och definierar `_DEBUG`; `user32.lib` har fönsterfunktionerna.)

## Win32-fönstret

Programmets fönsterdel är färdig i ditt projekt; den gör det som exemplens klass `Win32Application` gör. `wWinMain`
beskriver och registrerar först en **fönsterklass** – vilken sorts fönster vi vill ha, och funktionen som tar hand om
dess meddelanden:

```cpp
WNDCLASSEXW windowClass = {};
windowClass.cbSize = sizeof(WNDCLASSEXW);
windowClass.style = CS_HREDRAW | CS_VREDRAW;
windowClass.lpfnWndProc = WindowProc;
windowClass.hInstance = hInstance;
windowClass.hCursor = LoadCursor(nullptr, IDC_ARROW);
windowClass.lpszClassName = L"DXSampleClass";
RegisterClassExW(&windowClass);
```

Fönstret har en titelrad och kanter, men vi vill att ytan vi ritar i – **klientytan** (client area) – ska vara exakt
800×600. `AdjustWindowRect` räknar ut hela fönstrets storlek för den klientytan, och `CreateWindowW` skapar fönstret:

```cpp
RECT windowRect = { 0, 0, static_cast<LONG>(width), static_cast<LONG>(height) };
AdjustWindowRect(&windowRect, WS_OVERLAPPEDWINDOW, FALSE);

HWND hwnd = CreateWindowW(
    windowClass.lpszClassName,
    L"LearnDirectX",
    WS_OVERLAPPEDWINDOW,
    CW_USEDEFAULT,
    CW_USEDEFAULT,
    windowRect.right - windowRect.left,
    windowRect.bottom - windowRect.top,
    nullptr,        // We have no parent window.
    nullptr,        // We aren't using menus.
    hInstance,
    nullptr);
```

Den `HWND` som returneras är fönstrets handtag: Direct3D behöver det senare för att visa bilder i fönstret. Sedan sätter
`app.OnInit(hwnd)` upp Direct3D (den anropar `LoadPipeline()`, där all kod i det här kapitlet hamnar), fönstret visas,
och **meddelandeloopen** körs tills fönstret stängs:

```cpp
MSG msg = {};
while (msg.message != WM_QUIT)
{
    if (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE))
    {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
}
```

Windows berättar för ett program om allt som händer med dess fönster – tangenttryckningar, musrörelser,
storleksändringar, stängningsknappen – med *meddelanden*. `PeekMessage` tar nästa meddelande om det finns ett och
returnerar direkt om det inte gör det (till skillnad från `GetMessage`, som väntar), så att loopen senare kan rendera
bildrutor däremellan. `DispatchMessage` skickar varje meddelande till `WindowProc`, som bara hanterar `WM_DESTROY`, som
skickas när fönstret håller på att förstöras:

```cpp
case WM_DESTROY:
    PostQuitMessage(0);
    return 0;
```

`PostQuitMessage` lägger ett `WM_QUIT`-meddelande i kön, vilket avslutar loopen. Alla andra meddelanden går till
`DefWindowProc`, Windows standardhantering – som till exempel förstör fönstret när du trycker på stängningsknappen.

Bygg och kör projektet som det är: ett fönster med titeln "LearnDirectX" öppnas och förblir öppet tills du stänger det.
Ingenting ritas i det – det händer först när det finns en swap chain, i nästa kapitel.

```quiz
Varför anropar `wWinMain` `AdjustWindowRect` före `CreateWindowW`?
- [ ] För att centrera fönstret på skärmen
- [ ] För att göra fönstret storleksändringsbart
- [x] Därför att storleken som ges till `CreateWindowW` inkluderar titelraden och kanterna: `AdjustWindowRect` räknar ut den fönsterstorlek som ger en klientyta på exakt 800×600
- [ ] Därför att Direct3D 12 kräver det innan det kan skapa en enhet
---
Vi ritar i klientytan, så det är den delen som måste vara 800×600. `AdjustWindowRect` lägger till storleken på ramen
som stilen `WS_OVERLAPPEDWINDOW` sätter runt den.
```
:::
:::d3d12
## COM-objekt, HRESULT och ThrowIfFailed

Direct3D 12 och DXGI består av **COM**-gränssnitt (`ID3D12Device`, `IDXGIFactory4` …). Du skapar aldrig de här
objekten med `new`; en funktion skapar dem och ger dig en gränssnittspekare, och du släpper (release) den när du är
klar. Projektet använder **`ComPtr`** (från `wrl.h`), en smart pekare som släpper objektet automatiskt när den
försvinner. Tre av dess medlemmar dyker upp i det här kapitlet: `Get()` returnerar den råa pekaren, `&` ger adressen
som ska fyllas i (och släpper det den höll innan), och `Detach()` lämnar över pekaren utan att släppa den.

Funktionerna som skapar objekt tar det gränssnitt du vill ha och pekaren som ska fyllas i. Makrot `IID_PPV_ARGS(&ptr)`
skriver båda åt dig: gränssnittets ID (taget från pekarens typ) och adressen.

Nästan varje anrop returnerar ett **`HRESULT`**, en resultatkod som är negativ vid fel; makrona `SUCCEEDED` och `FAILED`
testar den. Projektets `ThrowIfFailed` gör om ett fel till ett undantag, som `wWinMain` visar i en meddelanderuta. På
så vis går inget fel obemärkt förbi.

## DXGI-fabriken

**DXGI** (DirectX Graphics Infrastructure) är den del av Windows som känner till grafikadaptrarna i systemet och
skärmarna som är anslutna till dem, och som skapar de *swap chains* som visar de renderade bilderna i ett fönster.
Direct3D 12 självt pratar bara med en enhet. Allt börjar med en DXGI-**fabrik** (factory):

```cpp
ComPtr<IDXGIFactory4> factory;
ThrowIfFailed(CreateDXGIFactory2(0, IID_PPV_ARGS(&factory)));
```

`IDXGIFactory4` är den fabriksversion som D3D12-exemplen använder; första parametern till `CreateDXGIFactory2` håller
flaggor för skapandet (inga än så länge – det ändras i nästa steg).

Gör nu den första uppgiften: skapa fabriken där kommentaren `// TODO: create the DXGI factory` står. Build & run:
fönstret ser likadant ut.

```quiz
Vad ansvarar DXGI för? (Välj alla som stämmer.)
- [x] Att räkna upp grafikadaptrarna i systemet
- [x] Att skapa de swap chains som visar bilder i ett fönster
- [ ] Att kompilera HLSL-shaders
- [ ] Att spela in ritkommandon
---
DXGI sköter det som är gemensamt för alla Direct3D-versioner: adaptrar, utgångar (outputs) och swap chains. Shaders
kompileras av shaderkompilatorn (`d3dcompiler`), och kommandon spelas in i Direct3D 12:s command lists.
```
:::
:::d3d12
## Debug-lagret

Precis som Vulkan gör Direct3D 12 väldigt lite felkontroll på egen hand, för att hålla nere arbetet i drivrutinen: en
felaktig parameter kan helt enkelt krascha eller ge en svart skärm. **Debug-lagret** kontrollerar varje anrop och
rapporterar misstag, med en förklaring, i debuggerns utdatafönster. Det måste aktiveras **innan** enheten skapas – att
aktivera det efteråt tar bort enheten. Därför hamnar den här koden allra överst i `LoadPipeline`, ovanför fabriken:

```cpp
UINT dxgiFactoryFlags = 0;

#if defined(_DEBUG)
// Enable the debug layer (requires the Graphics Tools "optional feature").
// NOTE: Enabling the debug layer after device creation will invalidate the active device.
{
    ComPtr<ID3D12Debug> debugController;
    if (SUCCEEDED(D3D12GetDebugInterface(IID_PPV_ARGS(&debugController))))
    {
        debugController->EnableDebugLayer();

        // Enable additional debug layers.
        dxgiFactoryFlags |= DXGI_CREATE_FACTORY_DEBUG;
    }
}
#endif
```

`D3D12GetDebugInterface` hämtar debug-gränssnittet (det misslyckas om Graphics Tools inte är installerat – då fortsätter
vi helt enkelt utan det), och `EnableDebugLayer` slår på lagret. Flaggan `DXGI_CREATE_FACTORY_DEBUG` ber om DXGI:s egna
debug-kontroller också, så fabriken skapas nu med de insamlade flaggorna i stället för `0`:

```cpp
ThrowIfFailed(CreateDXGIFactory2(dxgiFactoryFlags, IID_PPV_ARGS(&factory)));
```

Allt står mellan `#if defined(_DEBUG)` och `#endif`: kontrollerna kostar tid, så release-byggen utelämnar dem. Gör nu
den andra uppgiften.

```quiz
Varför måste debug-lagret aktiveras innan `D3D12CreateDevice` anropas?
- [ ] Därför att `D3D12GetDebugInterface` behöver DXGI-fabriken
- [x] Därför att om det aktiveras efter att enheten skapats tas den enheten bort (blir ogiltig)
- [ ] Därför att debug-lagret självt skapar enheten
- [ ] Det måste det inte – det kan slås på när som helst
---
Debug-lagret omsluter enheten när den skapas. Därför aktiverar exemplen det allra först i `LoadPipeline`, före fabriken
och enheten.
```
:::
:::d3d12
## Adaptrar och enheten

En **adapter** är ett grafikkort – eller en mjukvarurenderare som "Microsoft Basic Render Driver". Vi vill ha den första
hårdvaruadaptern som stöder Direct3D 12. Det är vad `GetHardwareAdapter` gör:

```cpp
ComPtr<IDXGIAdapter1> adapter;
for (UINT adapterIndex = 0; SUCCEEDED(pFactory->EnumAdapters1(adapterIndex, &adapter)); ++adapterIndex)
{
    DXGI_ADAPTER_DESC1 desc;
    adapter->GetDesc1(&desc);

    if (desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE)
    {
        // Don't select the Basic Render Driver adapter.
        continue;
    }

    // Check to see whether the adapter supports Direct3D 12, but don't create the
    // actual device yet.
    if (SUCCEEDED(D3D12CreateDevice(adapter.Get(), D3D_FEATURE_LEVEL_11_0, __uuidof(ID3D12Device), nullptr)))
    {
        break;
    }
}

*ppAdapter = adapter.Detach();
```

`EnumAdapters1` returnerar adaptern med det givna indexet, och misslyckas (`DXGI_ERROR_NOT_FOUND`) när indexet är förbi
den sista – det avslutar loopen. `GetDesc1` beskriver adaptern (namn, minne, flaggor); mjukvaruadaptrar hoppas över. För
att testa om en adapter stöder Direct3D 12 anropas `D3D12CreateDevice` med `nullptr` som sista argument: då kontrollerar
den bara om en enhet *skulle kunna* skapas, och skapar ingen. Den första adaptern som klarar testet lämnas över till
anroparen med `Detach()`. Om ingen klarar det slutar loopen med en tom `adapter` och `*ppAdapter` blir `nullptr` – och
`D3D12CreateDevice` använder då standardadaptern. (De nuvarande exemplen provar först
`IDXGIFactory6::EnumAdapterByGpuPreference`, som kan föredra det snabba grafikkortet i en bärbar dator; den enkla loopen
är deras reservlösning.)

### Feature levels

Det andra argumentet till `D3D12CreateDevice` är den **lägsta feature level** som krävs. En feature level är en
väldefinierad uppsättning GPU-funktioner: `D3D_FEATURE_LEVEL_11_0` är vad Direct3D 11-hårdvara klarar, och högre nivåer
(11_1, 12_0, 12_1, 12_2) lägger till mer. Varje Direct3D 12-drivrutin stöder minst 11_0, så att begära 11_0 – som
exemplen gör – godtar varje kort som kör Direct3D 12. En feature level säger vad ett kort *kan göra*, inte hur snabbt
det är.

När en adapter är vald skapar `LoadPipeline` **enheten** (device) – objektet som representerar adaptern och skapar alla
andra Direct3D 12-objekt:

```cpp
ComPtr<IDXGIAdapter1> hardwareAdapter;
GetHardwareAdapter(factory.Get(), &hardwareAdapter);

ThrowIfFailed(D3D12CreateDevice(
    hardwareAdapter.Get(),
    D3D_FEATURE_LEVEL_11_0,
    IID_PPV_ARGS(&m_device)
    ));
```

Enheten sparas i medlemmen `m_device`. Gör den tredje uppgiften: fyll i kroppen av `GetHardwareAdapter` och skapa
enheten i `LoadPipeline`. (Exemplen kan också använda **WARP**, Windows mjukvarurasteriserare, via
`factory->EnumWarpAdapter` – användbart på datorer utan lämpligt grafikkort; det hoppar vi över.)

```quiz
Vad gör `D3D12CreateDevice(adapter.Get(), D3D_FEATURE_LEVEL_11_0, __uuidof(ID3D12Device), nullptr)` i `GetHardwareAdapter`?
- [ ] Den skapar enheten som `LoadPipeline` använder
- [x] Den testar bara om en Direct3D 12-enhet skulle kunna skapas på den här adaptern; med `nullptr` som sista argument skapas ingen enhet
- [ ] Den skapar en mjukvaruenhet (WARP)
- [ ] Den slår på feature level 11_0 för adaptern
---
Med `nullptr` som enhetspekare blir `D3D12CreateDevice` en kontroll. Den riktiga enheten skapas efteråt i
`LoadPipeline`, på adaptern som klarade testet.
```
:::
:::d3d12
## Kommandokön

I Direct3D 12 anropar processorn inga ritfunktioner på enheten. I stället spelar den in kommandon i **command lists**,
och lämnar de färdiga listorna till grafikkortet via en **kommandokö** (command queue); grafikkortet arbetar sig igenom
kön på egen hand. Kön beskrivs av en `D3D12_COMMAND_QUEUE_DESC` och skapas av enheten:

```cpp
// Describe and create the command queue.
D3D12_COMMAND_QUEUE_DESC queueDesc = {};
queueDesc.Flags = D3D12_COMMAND_QUEUE_FLAG_NONE;
queueDesc.Type = D3D12_COMMAND_LIST_TYPE_DIRECT;

ThrowIfFailed(m_device->CreateCommandQueue(&queueDesc, IID_PPV_ARGS(&m_commandQueue)));
```

Det finns kötyper för beräkningsarbete (`D3D12_COMMAND_LIST_TYPE_COMPUTE`) och för kopiering
(`D3D12_COMMAND_LIST_TYPE_COPY`); en **direct**-kö tar emot alla sorters kommandon – ritning, beräkning och kopiering –
vilket är vad vi behöver. Det är samma idé som Vulkans köfamiljer.

Gör den sista uppgiften: skapa kommandokön i slutet av `LoadPipeline`. Build & run: fönstret öppnas som förut och
stängs snyggt. Inget i `OnDestroy` behöver släppas för hand – `ComPtr`-medlemmarna släpper kön och enheten. I nästa
kapitel får kön en swap chain, och du fyller fönstret med en färg.

```quiz
Varför skapas kommandokön med `D3D12_COMMAND_LIST_TYPE_DIRECT`?
- [ ] Därför att det är den enda typen en enhet kan skapa
- [x] Därför att en direct-kö tar emot alla sorters kommandon – ritning, beräkning och kopiering
- [ ] Därför att direct-köer går förbi command lists
- [ ] Därför att debug-lagret kräver det
---
Compute- och copy-köer tar bara emot en delmängd av kommandona. För att rita behöver vi en direct-kö.
```
:::
:::d3d12
## Mer att läsa

- [Creating a basic Direct3D 12 component](https://learn.microsoft.com/en-us/windows/win32/direct3d12/creating-a-basic-direct3d-12-component)
  på Microsoft Learn: anropsflödet i hello-world-exemplen, steg för steg.
- [Direct3D 12 programming environment setup](https://learn.microsoft.com/en-us/windows/win32/direct3d12/directx-12-programming-environment-set-up):
  headerfiler, bibliotek och debug-lagret.
- [D3D12HelloWorld-exemplen](https://github.com/microsoft/DirectX-Graphics-Samples/tree/master/Samples/Desktop/D3D12HelloWorld)
  som den här kursen följer.
:::
