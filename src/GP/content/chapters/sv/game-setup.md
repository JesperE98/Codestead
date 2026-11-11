# Förberedelser

Innan vi ger oss på spelmekaniken behöver vi först sätta upp ett enkelt ramverk som spelet kan bo i. Spelet använder
flera tredjepartsbibliotek, och de flesta har vi redan presenterat i tidigare kapitel. Där ett nytt bibliotek behövs
presenteras det ordentligt.

Först definierar vi en så kallad överklass för spelet som innehåller all relevant renderings- och spelkod. Tanken med
en sådan spelklass är att den (på sitt sätt) organiserar spelkoden och samtidigt frikopplar all fönsterkod från spelet.
På så sätt kan du använda samma klass med ett helt annat fönsterbibliotek (som SDL eller SFML) utan större ansträngning.

Det finns tusentals sätt att försöka abstrahera och generalisera spel- och grafikkod i klasser och objekt. Det du ser i
de här kapitlen är bara ett (förhållandevis enkelt) sätt att lösa problemet. Tycker du att det finns ett bättre sätt, så
försök komma på din egen förbättring av implementationen.

## En fil med structs och fria funktioner

learnopengl skriver sitt spel som klasser i separata filer – `game.h` / `game.cpp`, `resource_manager.h` / `.cpp`,
`shader.h` / `.cpp`, `texture.h` / `.cpp`, senare `sprite_renderer`, `game_object`, `game_level` med flera – plus en
`program.cpp` med `main`. Kursen behåller learnopengls namn och steg, men skriver klasserna som **vanliga structs och
fria funktioner i en `main.cpp`**, i ordningen för learnopengls filer, med varje funktion definierad innan den används.
Den inbyggda simulatorn följer vanliga structs och fria funktioner, inte klasser med medlemsfunktioner. Regeln är enkel:
en klass blir en struct med sina datamedlemmar, och en medlemsfunktion blir en fri funktion som tar structen som
referens som sin första parameter – learnopengls anrop av `Init()` på sitt spelobjekt blir `Init(Hedgerow)`,
`shader.Use()` blir `Use(shader)`. Ett riktigt projekt skulle dela upp koden i klasser och filer som learnopengl gör; en
fil med fria funktioner är ingen design att kopiera, bara ett sätt att ha allt inom synhåll.

:::opengl
| learnopengl | kursen (OpenGL) |
|---|---|
| `class Shader` (`ID`, `Use()`, `Compile(…)`, `SetInteger/SetVector3f/SetMatrix4(name, value, useShader = false)`) | `struct Shader { unsigned int ID = 0; };`, `Use(Shader&)`, `Compile(Shader&, …)`, `SetInteger(Shader&, …)`, `SetVector3f(Shader&, …)`, `SetMatrix4(Shader&, …)` |
| `class Texture2D` (`ID`, storlek, format, wrap- och filterlägen, `Generate`, `Bind`) | `struct Texture2D { … }` med samma fält och standardvärden, `Generate(Texture2D&, …)`; ingen `Bind` – sprite-renderaren binder texturens ID |
| `class ResourceManager` (statiska mappar och funktioner) | två globala mappar `Shaders`, `Textures`, och `LoadShader`, `GetShader`, `LoadTexture`, `GetTexture`, `ClearResources` (learnopengls `Clear`) |
| `class Game` (`State`, `Keys[1024]`, `Width`, `Height`, `Init`, `ProcessInput`, `Update`, `Render`) | `enum GameState`, `struct Game`, `Init(Game&)`, `ProcessInput(Game&, float)`, `Update(Game&, float)`, `Render(Game&)` |
:::
:::vulkan
Vulkan-koden förblir vulkan-tutorials `HelloTriangleApplication`, med allt som de tidigare kapitlen byggt; spelets
structs och fria funktioner ligger *bredvid den*, före klassen. Funktionerna som behöver Vulkan-enheten – laddning av
shaders och texturer – kan inte vara fria funktioner utan att enheten skickas runt, så de är **medlemsfunktioner i
applikationsklassen**: `Init`, `LoadShader`, `LoadTexture`, `loadTextureFromFile`, `ClearResources` (och, i nästa
kapitel, `InitRenderData`).

| learnopengl | kursen (Vulkan) |
|---|---|
| `class Shader` (ett kompilerat program) | **grafikpipelinen** gjord av de två SPIR-V-filerna, en `VkPipeline`, skapad med projektets hjälpfunktion `createPipeline(vertFile, fragFile, pipeline)` |
| `class Texture2D` (ID, storlek, wrap- och filterlägen) | `struct Texture2D { VkImage Image; VkDeviceMemory Memory; VkImageView View; VkDescriptorSet DescriptorSet; unsigned int Width, Height; }`; en gemensam sampler med learnopengls standardvärden (REPEAT, LINEAR) |
| `class ResourceManager` | två globala mappar `Shaders` (namn → `VkPipeline`) och `Textures`, fria `GetShader` / `GetTexture`, medlemmarna `LoadShader`, `LoadTexture`, `loadTextureFromFile`, `ClearResources` |
| `class Game` | `enum GameState`, `struct Game`, fria `ProcessInput`, `Update`, `Render`; medlemmen `Init` |
:::
:::d3d12
Direct3D 12-koden förblir applikationsklassen från varje Direct3D 12-kapitel (`D3D12App` med `LoadPipeline`,
`LoadAssets`, `OnUpdate`, `OnRender`, `PopulateCommandList`, `WaitForPreviousFrame`); spelets structs och fria
funktioner ligger ovanför den. learnopengls klasser når OpenGL genom dess globala kontext – vilken funktion som helst
kan anropa `glBindTexture`. Direct3D 12 har ingen global kontext: du anropar metoder på objekt – enheten skapar
resurser, command listen spelar in ritanrop. För att spelets fria funktioner ska kunna göra detsamma lägger `LoadAssets`
de objekt som spelet behöver i en global struct, som redan finns i projektet:

```cpp
struct GraphicsContext
{
    ID3D12Device*              Device = nullptr;
    ID3D12GraphicsCommandList* CommandList = nullptr;      // the one command list: setup, then every frame
    ID3D12RootSignature*       RootSignature = nullptr;    // the root signature of every pipeline state
    ID3D12DescriptorHeap*      SrvHeap = nullptr;          // the shader-visible CBV/SRV heap
    UINT                       SrvDescriptorSize = 0;
    UINT                       SrvCount = 1;               // the descriptors in use (slot 0: the CBV)
};

GraphicsContext Graphics;
```

Vanliga pekare: `D3D12App` äger objekten och frigör dem. Spelet har **en root signature** för allt det ritar:
root-parameter 0 innehåller 19 root constants på b0 (en sprites modellmatris, 16 värden, och dess färg, 3),
root-parameter 1 en descriptor-tabell med projektionens constant buffer view (b1, heapens plats 0), root-parameter 2 en
tabell med ritanropets textur (t0); och en statisk sampler s0, linjär och upprepande (wrap) – learnopengls
standardvärden för `Texture2D`, `GL_LINEAR` och `GL_REPEAT`. I Direct3D 12 är samplingen en del av root signaturen,
inte av texturen.

| learnopengl | kursen (Direct3D 12) |
|---|---|
| `class Shader` (`ID`, `Use`, `Compile`, setters) | `struct Shader { ComPtr<ID3D12PipelineState> PipelineState; };`, `Use(Shader&)`, `Compile(Shader&, ID3DBlob* vertexShader, ID3DBlob* pixelShader)`; inga setters |
| `class Texture2D` (`ID`, storlek, format, wrap- och filterlägen, `Generate`) | `struct Texture2D { unsigned int ID; unsigned int Width, Height; DXGI_FORMAT Internal_Format; ComPtr<ID3D12Resource> Resource, UploadHeap; }`, `Generate(Texture2D&, …)` – ID:t är platsen för texturens vy i heapen |
| `class ResourceManager` | två globala mappar `Shaders`, `Textures`, och `LoadShader`, `GetShader`, `LoadTexture`, `GetTexture`, `ClearResources` |
| `class Game` | `enum GameState`, `struct Game`, `Init(Game&)`, `ProcessInput(Game&, float)`, `Update(Game&, float)`, `Render(Game&)` |
| `key_callback` | `OnKeyDown(UINT8 key)` / `OnKeyUp(UINT8 key)`, namnen från D3D12-exemplens ramverk, anropade av `WindowProc` |
:::

Kommentarerna `// TODO:` i projektet visar var varje del ska in. Det här kapitlet ritar ingenting – det gör inte
learnopengls "Setting up" heller –, så **Build & run** (Ctrl+Enter) visar ett svart fönster efter varje uppgift;
uppgifterna kontrolleras i koden.

## Spelet

Spelklassen innehåller en initieringsfunktion, en funktion som uppdaterar spelets tillstånd, en funktion som hanterar
användarens indata och en renderingsfunktion:

:::opengl
```cpp
// Represents the current state of the game
enum GameState {
    GAME_ACTIVE,
    GAME_MENU,
    GAME_WIN
};

// Game holds all game-related state.
// Combines all game-related data into a single struct for
// easy access to each of the components and manageability.
struct Game
{
    // game state
    GameState               State = GAME_ACTIVE;
    bool                    Keys[1024] = {};
    unsigned int            Width = SCREEN_WIDTH, Height = SCREEN_HEIGHT;
};

// Game-related State data
Game Hedgerow;

// initialize game state (load all shaders/textures/levels)
void Init(Game& game)
{

}

// game loop
void ProcessInput(Game& game, float dt)
{

}

void Update(Game& game, float dt)
{

}

void Render(Game& game)
{

}
```
:::
:::vulkan
```cpp
// Represents the current state of the game
enum GameState {
    GAME_ACTIVE,
    GAME_MENU,
    GAME_WIN
};

// Game holds all game-related state.
// Combines all game-related data into a single struct for
// easy access to each of the components and manageability.
struct Game {
    // game state
    GameState               State = GAME_ACTIVE;
    bool                    Keys[1024] = {};
    unsigned int            Width = WIDTH, Height = HEIGHT;
};

// Game-related State data
Game           Hedgerow;

// game loop (Init, which loads the resources, is part of the application class)
void ProcessInput(Game& game, float dt) {

}

void Update(Game& game, float dt) {

}

// records the frame's draws
void Render(Game& game) {

}
```

och, i applikationsklassen, den tomma `void Init(Game& game)`.
:::
:::d3d12
```cpp
// Represents the current state of the game
enum GameState {
    GAME_ACTIVE,
    GAME_MENU,
    GAME_WIN
};

// Game holds all game-related state.
// Combines all game-related data into a single struct for
// easy access to each of the components and manageability.
struct Game
{
    // game state
    GameState               State = GAME_ACTIVE;
    bool                    Keys[1024] = {};
    unsigned int            Width = SCREEN_WIDTH, Height = SCREEN_HEIGHT;
};

// Game-related State data
Game Hedgerow;

// initialize game state (load all shaders/textures/levels)
void Init(Game& game)
{

}

// game loop
void ProcessInput(Game& game, float dt)
{

}

void Update(Game& game, float dt)
{

}

void Render(Game& game)
{

}
```
:::

Klassen innehåller det man kan vänta sig av en spelklass. Vi initierar spelet med en bredd och en höjd (upplösningen du
vill spela i) – här structens standardvärden, 800 × 600 – och använder funktionen `Init` för att ladda shaders och
texturer och initiera allt spelets tillstånd. Vi hanterar indata som lagrats i arrayen `Keys` genom att anropa
`ProcessInput`, och uppdaterar alla spelhändelser (som spelarens och bollens rörelser) i funktionen `Update`. Till sist
renderar vi spelet genom att anropa `Render`. Observera att vi skiljer rörelselogiken från renderingslogiken.

Spelet håller också reda på sitt aktuella läge: `State`. Spelet kan vara i ett aktivt läge, ett menyläge eller ett
vinstläge; för tillfället är det alltid aktivt. Menyn och vinstskärmen kommer i de senare kapitlen.

learnopengls spelklass skapas med fönstrets storlek och innehåller objektet för hela spelet; kursens globala
`Game Hedgerow;` är det objektet (learnopengl döper sitt spelobjekt efter sitt spel, kursen efter sitt eget). Gör nu den
första uppgiften, **game-struct**: lägg till enumen, structen, den globala variabeln och de fyra tomma funktionerna, och
anropa `Init` en gång i början och `Render` varje bildruta:

:::opengl
`Init(Hedgerow);` i `main` efter OpenGL-konfigurationen (blending), före loopen; `Render(Hedgerow);` i loopen direkt
efter `glClear(GL_COLOR_BUFFER_BIT);`.
:::
:::vulkan
`Init(Hedgerow);` i slutet av `initVulkan()`, efter `createDescriptorPool();` – spelet kommer att skapa descriptor sets
för sina texturer, så poolen måste finnas –, och `Render(Hedgerow);` i `recordCommandBuffer()` inuti render passet,
efter `vkCmdSetScissor`: i Vulkan betyder "rendera" att spela in bildrutans ritanrop i command buffern.
:::
:::d3d12
`Init(Hedgerow);` i slutet av `LoadAssets`, efter tilldelningarna `Graphics.…` och före `m_commandList->Close()`:
setup-command listen är då fortfarande öppen, så texturerna som spelet laddar laddas upp med den. `Render(Hedgerow);` i
`PopulateCommandList` efter rensningen (efter `IASetPrimitiveTopology`), före barriären tillbaka till `PRESENT`: i
Direct3D 12 betyder "rendera" att spela in bildrutans ritanrop i command listen.
:::

## Spelloopen

Programmet är learnopengls `program.cpp`: det skapar fönstret, initierar spelet och kör sedan spelloopen. Varje
bildruta i loopen mäter hur lång tid förra bildrutan tog, hanterar indata, uppdaterar spelet och renderar det.

Tiden som en bildruta tar är *delta time*. Olika datorer ritar olika fort – en renderar 60 bildrutor per sekund, en
annan 144 – och om racketen flyttades ett fast antal pixlar per bildruta skulle den vara mer än dubbelt så snabb på den
andra. Därför mäter spelet bildrutans längd och flyttar allt med hastighet × tid: en racket med hastigheten 500 pixlar
per sekund flyttas 500 × 1/60 ≈ 8.3 pixlar i en bildruta på 1/60 sekund, och hälften så långt i en bildruta på 1/120
sekund. Det är det `dt` som `ProcessInput` och `Update` får. (Kapitlet Kamera använde samma idé för kamerans
hastighet.)

:::opengl
```cpp
    // deltaTime variables
    // -------------------
    float deltaTime = 0.0f;
    float lastFrame = 0.0f;

    while (!glfwWindowShouldClose(window))
    {
        // calculate delta time
        // --------------------
        float currentFrame = static_cast<float>(glfwGetTime());
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;
        glfwPollEvents();

        // manage user input
        // -----------------
        ProcessInput(Hedgerow, deltaTime);

        // update game state
        // -----------------
        Update(Hedgerow, deltaTime);

        // render
        // ------
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        Render(Hedgerow);

        glfwSwapBuffers(window);
    }
```
:::
:::vulkan
```cpp
    void mainLoop() {
        // deltaTime variables
        float deltaTime = 0.0f;
        float lastFrame = 0.0f;

        while (!glfwWindowShouldClose(window)) {
            // calculate delta time
            float currentFrame = static_cast<float>(glfwGetTime());
            deltaTime = currentFrame - lastFrame;
            lastFrame = currentFrame;
            glfwPollEvents();

            // manage user input
            ProcessInput(Hedgerow, deltaTime);

            // update game state
            Update(Hedgerow, deltaTime);

            // render
            drawFrame();
        }

        vkDeviceWaitIdle(device);
    }
```

`drawFrame()` spelar in command buffern – med `Render(Hedgerow)` inuti render passet, som rensar till svart –, skickar
iväg den och presenterar bilden.
:::
:::d3d12
D3D12-exemplens ramverk har en egen loop: meddelandeloopen i `wWinMain` anropar `OnUpdate()` och sedan `OnRender()` när
inget fönstermeddelande väntar. Spelets del av loopen hamnar därför i `OnUpdate`, och dess tid mäts där, med
`std::chrono` som i de tidigare Direct3D 12-kapitlen:

```cpp
void D3D12App::OnUpdate()
{
    // calculate delta time: the time since the last frame, in seconds
    // --------------------
    static auto lastFrame = std::chrono::high_resolution_clock::now();
    auto currentFrame = std::chrono::high_resolution_clock::now();
    float deltaTime = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - lastFrame).count();
    lastFrame = currentFrame;

    // manage user input
    // -----------------
    ProcessInput(Hedgerow, deltaTime);

    // update game state
    // -----------------
    Update(Hedgerow, deltaTime);
}
```

Den `static` variabeln initieras vid första anropet, så första bildrutans deltaTime är (nästan) 0. `OnRender` spelar
sedan in bildrutan (`PopulateCommandList`, med `Render(Hedgerow)`), kör den och presenterar.
:::

Gör nu uppgiften **delta-time**: mät bildrutans tid överst i loopen och skicka den till `ProcessInput` och `Update`.

**Kursens tid är deterministisk.** För att bilderna av spelet ska gå att jämföra – mellan de tre API:erna, mellan
drivrutiner och med den inbyggda simulatorn – måste spelet vara i exakt samma tillstånd i samma ögonblick. Med en
riktig klocka är det omöjligt: varje bildruta tar lite olika lång tid. Därför ser **bildruta n i loopen tiden n / 60
sekunder** i kursen: bildruta 0 ser 0, bildruta 1 ser 1/60, och deltaTime är 0 i den första bildrutan och exakt 1/60 i
varje bildruta efter den. För att visa spelet vid tiden t kör simulatorn loopen t × 60 gånger.
:::opengl
Programmet gör inget särskilt för det: det läser `glfwGetTime()` som learnopengl gör, och simulatorn (och kursens
testkörningar på riktiga drivrutiner) låter `glfwGetTime()` räkna bildrutorna – den returnerar antalet anrop av
`glfwPollEvents` hittills delat med 60. På din egen dator, utanför kursen, går samma kod på den riktiga klockan.
:::
:::vulkan
Programmet gör inget särskilt för det: det läser `glfwGetTime()` som learnopengl gör, och simulatorn (och kursens
testkörningar på riktiga drivrutiner) låter `glfwGetTime()` räkna bildrutorna – den returnerar antalet anrop av
`glfwPollEvents` hittills delat med 60. På din egen dator, utanför kursen, går samma kod på den riktiga klockan.
:::
:::d3d12
Programmet gör inget särskilt för det: det läser klockan som de tidigare kapitlen gör, och simulatorn ger det n:te
anropet av `OnUpdate` klockvärdet n / 60 s. På Windows går samma kod på den riktiga klockan, så spelet går lika fort
vid alla uppdateringsfrekvenser.
:::

```quiz
Racketen kommer att flyttas `PLAYER_VELOCITY * dt` pixlar per bildruta, med `PLAYER_VELOCITY` = 500. Hur långt flyttas den i kursens bildruta 0 och i bildruta 1 medan en rörelsetangent hålls nere?
- [ ] 500 pixlar i varje bildruta
- [x] 0 pixlar i bildruta 0 (deltaTime 0) och 500 / 60 ≈ 8.3 pixlar i bildruta 1
- [ ] 8.3 pixlar i varje bildruta, bildruta 0 inräknad
- [ ] 1/60 pixel per bildruta
---
deltaTime är tiden sedan förra bildrutan: 0 i den allra första, exakt 1/60 s efter det i kursen. Med en riktig klocka varierar den lite från bildruta till bildruta, och rörelsen varierar med den – hastigheten i pixlar per sekund förblir densamma.
```

## Indata

learnopengls spel läser tangentbordet via GLFW:s key-callback: en funktion som GLFW anropar varje gång en tangent trycks
ned eller släpps. Callbacken flyttar ingenting själv. Den antecknar bara vilka tangenter som är nedtryckta, i spelets
array `Keys` – en `bool` per tangentkod –, och `ProcessInput` läser arrayen varje bildruta. På så sätt flyttar en
nedhållen tangent racketen i varje bildruta den hålls nere, i spelloopens takt, medan callbacken bara anropas när något
ändras (och, för en nedhållen tangent, i tangentbordets repetitionstakt).

:::opengl
```cpp
void key_callback(GLFWwindow* window, int key, int scancode, int action, int mode)
{
    // when a user presses the escape key, we set the WindowShouldClose property to true, closing the application
    if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);
    if (key >= 0 && key < 1024)
    {
        if (action == GLFW_PRESS)
            Hedgerow.Keys[key] = true;
        else if (action == GLFW_RELEASE)
            Hedgerow.Keys[key] = false;
    }
}
```

Callbacken registreras efter att GLAD har laddats:

```cpp
    glfwSetKeyCallback(window, key_callback);
```

GLFW:s tangentkoder är under 1024 (`GLFW_KEY_LAST` är 348), så `Keys[1024]` har plats för varje tangent;
intervallkontrollen skyddar mot `GLFW_KEY_UNKNOWN`, som är -1. Callbacks anropas inifrån `glfwPollEvents()` – därför
hämtar loopen händelserna direkt före `ProcessInput`.
:::
:::vulkan
```cpp
void key_callback(GLFWwindow* window, int key, int scancode, int action, int mode) {
    // when a user presses the escape key, we set the WindowShouldClose property to true, closing the application
    if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);
    if (key >= 0 && key < 1024) {
        if (action == GLFW_PRESS)
            Hedgerow.Keys[key] = true;
        else if (action == GLFW_RELEASE)
            Hedgerow.Keys[key] = false;
    }
}
```

Fönstret är GLFW:s även i Vulkan, så callbacken är learnopengls, en fri funktion före klassen. Den registreras i
`initWindow()` direkt efter att fönstret har skapats:

```cpp
        glfwSetKeyCallback(window, key_callback);
```

GLFW:s tangentkoder är under 1024 (`GLFW_KEY_LAST` är 348), så `Keys[1024]` har plats för varje tangent;
intervallkontrollen skyddar mot `GLFW_KEY_UNKNOWN`, som är -1. Callbacks anropas inifrån `glfwPollEvents()` – därför
hämtar loopen händelserna direkt före `ProcessInput`.
:::
:::d3d12
Direct3D 12-programmet har ingen GLFW: dess fönster är ett vanligt Win32-fönster, och Windows skickar ett
`WM_KEYDOWN`-meddelande till det när en tangent trycks ned och `WM_KEYUP` när den släpps, med tangentens *virtual-key
code* i `wParam`. Fönsterproceduren lämnar dem till två funktioner med namn som i D3D12-exemplens ramverk, `OnKeyDown`
och `OnKeyUp`:

```cpp
void OnKeyDown(UINT8 key)
{
    Hedgerow.Keys[key] = true;
}

void OnKeyUp(UINT8 key)
{
    Hedgerow.Keys[key] = false;
}
```

```cpp
    case WM_KEYDOWN:
        // when a user presses the escape key, close the window (and so the application)
        if (wParam == VK_ESCAPE)
        {
            DestroyWindow(hWnd);
        }
        OnKeyDown(static_cast<UINT8>(wParam));
        return 0;

    case WM_KEYUP:
        OnKeyUp(static_cast<UINT8>(wParam));
        return 0;
```

Bokstävernas virtual-key codes är deras ASCII-koder för versaler ('A' = 65) och mellanslag är `VK_SPACE` = 32 – samma
tal som GLFW:s `GLFW_KEY_A` och `GLFW_KEY_SPACE`, så spelets kod kan testa `Keys['A']` där GLFW-versionerna testar
`Keys[GLFW_KEY_A]`. En virtual-key code ryms i en byte, långt inom `Keys[1024]`. Meddelandena hanteras av
meddelandeloopen innan den anropar `OnUpdate`, precis som GLFW anropar sina callbacks inuti `glfwPollEvents()`.
:::

Gör nu uppgiften **key-callback**.

**Kursens indata är också deterministiska.** Ingen trycker på tangenter i simulatorn. För att de senare kapitlen ska
kunna visa när bollen skjuts iväg trycker kursen ned en tangent av sig själv: **mellanslag, nedtryckt vid t = 0.5 s och
släppt vid t = 0.55 s**, via programmets egen key-callback
:::opengl vulkan
(`key_callback(window, GLFW_KEY_SPACE, scancode, GLFW_PRESS, 0)` inuti `glfwPollEvents()` i bildruta 30, och släppet
inuti bildruta 33:s).
:::
:::d3d12
(`OnKeyDown(VK_SPACE)` före `OnUpdate` i bildruta 30, `OnKeyUp(VK_SPACE)` före den i bildruta 33).
:::
Alltså ser `ProcessInput` mellanslag nedhållet i bildrutorna 30, 31 och 32. Ingen annan tangent trycks någonsin ned –
racketen rör sig aldrig i kursens bilder. Fram till kapitlet Bollen läser ingenting mellanslag.

```quiz
Varför sparar key-callbacken bara tangentens tillstånd i `Keys` i stället för att flytta racketen själv?
- [ ] Därför att callbacken inte får ändra globala variabler
- [ ] Därför att callbacken bara anropas en gång när programmet startar
- [x] Därför att callbacken bara anropas när en tangent ändras (och i tangentbordets repetitionstakt); `ProcessInput` läser `Keys` varje bildruta, så en nedhållen tangent flyttar racketen jämnt i varje bildruta, med `dt`
- [ ] Därför att callbacken körs på GPU:n
---
Händelser säger *att* något har ändrats, tillståndsarrayen säger *hur det är* – och spelloopen behöver tillståndet en gång per bildruta, tillsammans med bildrutans delta time.
```

## Shaders

learnopengls spel har några hjälpklasser för resurserna det använder: `Shader`, `Texture2D` och `ResourceManager`, som
laddar och håller dem.

:::opengl
Klassen `Shader` är den från de tidigare kapitlen med några ändringar: den får shaderns *källkod* i stället för filnamn
(resurshanteraren läser filerna), den kan kompilera en valfri geometry shader, och varje setter kan göra shadern aktiv
först. Som struct med fria funktioner:

```cpp
struct Shader
{
    unsigned int ID = 0;
};

// sets the current shader as active
void Use(Shader& shader)
{
    glUseProgram(shader.ID);
}
```

`Compile(Shader& shader, const char* vertexSource, const char* fragmentSource, const char* geometrySource = nullptr)`
kompilerar vertex och fragment shadern och, om dess källkod finns, geometry shadern, länkar dem till
`shader.ID = glCreateProgram()`, kontrollerar varje steg med `checkCompileErrors` (learnopengls meddelanden) och tar
bort shaderobjekten, som nu är en del av programmet. Uniform-setters:

```cpp
void SetMatrix4(Shader& shader, const char* name, const glm::mat4& matrix, bool useShader = false)
{
    if (useShader)
        Use(shader);
    glUniformMatrix4fv(glGetUniformLocation(shader.ID, name), 1, false, glm::value_ptr(matrix));
}
```

och på samma sätt `SetInteger` (`glUniform1i`) och `SetVector3f` (`glUniform3f`) – spelet behöver bara de tre än så
länge; fler läggs till när ett kapitel behöver dem. Parametern `useShader` finns på grund av det som kapitlet
Felsökning visade: `glUniform*` ändrar uniformen i programmet *som används*, och ett anrop utan program (eller med fel
program) i bruk misslyckas.

Gör nu uppgiften **shader**.
:::
:::vulkan
I Vulkan finns inget shaderobjekt att kompilera under körning: GLSL-koden kompileras till SPIR-V i förväg, och det som
ritar med den är en **grafikpipeline** – shader modules tillsammans med vertex input, rasterizer-tillståndet,
blendingen och layouten för deskriptorerna. Det som learnopengl kallar en "shader" är alltså, i Vulkan-versionen,
`VkPipeline` gjord av de två SPIR-V-filerna, och att ladda en shader betyder att skapa en pipeline. Projektet har redan
hjälpfunktionen för det, `createPipeline(vertFile, fragFile, pipeline)`: sprite-vertexformatet (en `vec4`), inget
djuptest, ingen culling och alfablending (`SRC_ALPHA` / `ONE_MINUS_SRC_ALPHA` – learnopengls `glEnable(GL_BLEND)` i
`main`). Det finns inga uniform-setters heller: det som learnopengl sätter som uniforms blir push constants (per sprite,
`struct PushConstants { glm::mat4 model; glm::vec3 spriteColor; };`) och uniform buffern (projektionen). learnopengls
klass `Shader` har därför ingen egen uppgift i Vulkan.
:::
:::d3d12
I Direct3D 12 finns inget programobjekt: de kompilerade vertex och pixel shadrarna är en del av ett **pipeline state
object** (PSO), tillsammans med input layouten, rasterizer-, blend- och djuptillstånden och root signaturen.
learnopengls `Shader` innehåller därför en PSO, och att "använda" den betyder att sätta den på command listen:

```cpp
struct Shader
{
    ComPtr<ID3D12PipelineState> PipelineState;
};

// sets the current shader as active
void Use(Shader& shader)
{
    Graphics.CommandList->SetPipelineState(shader.PipelineState.Get());
}
```

`Compile(Shader& shader, ID3DBlob* vertexShader, ID3DBlob* pixelShader)` skapar PSO:n med de tillstånd som 2D-sprites
behöver: input layouten för sprite-vertexen (`POSITION` och `TEXCOORD`, två floats vardera – learnopengls `vec4` med
position och texturkoordinater), `Graphics.RootSignature`, alfablending (learnopengls `glEnable(GL_BLEND)` och
`glBlendFunc` i `main`), inget djuptest och ingen culling:

```cpp
    psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;
    psoDesc.BlendState = CD3DX12_BLEND_DESC(D3D12_DEFAULT);
    psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;
    psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_SRC_ALPHA;
    psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_INV_SRC_ALPHA;
```

sedan `Graphics.Device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&shader.PipelineState))`. Det finns inga
uniform-setters (`SetInteger`, `SetMatrix4` …): Direct3D 12 har inga uniforms per program. Det som learnopengl sätter
som uniforms blir root constants (per sprite, satta när den ritas) och constant buffern (projektionen, skriven i
`OnUpdate`). Och ingen `checkCompileErrors`: `D3DCompileFromFile` returnerar själv kompilatorns meddelanden.

Gör nu uppgiften **shader**.
:::

## Texturer

:::opengl
Klassen `Texture2D` håller en texturs ID, dess storlek och inställningarna den skapas med; standardvärdena är de som
learnopengls konstruktor sätter:

```cpp
struct Texture2D
{
    // holds the ID of the texture object, used for all texture operations to reference to this particular texture
    unsigned int ID = 0;
    // texture image dimensions
    unsigned int Width = 0, Height = 0; // width and height of loaded image in pixels
    // texture Format
    unsigned int Internal_Format = GL_RGB; // format of texture object
    unsigned int Image_Format = GL_RGB; // format of loaded image
    // texture configuration
    unsigned int Wrap_S = GL_REPEAT; // wrapping mode on S axis
    unsigned int Wrap_T = GL_REPEAT; // wrapping mode on T axis
    unsigned int Filter_Min = GL_LINEAR; // filtering mode if texture pixels < screen pixels
    unsigned int Filter_Max = GL_LINEAR; // filtering mode if texture pixels > screen pixels
};
```

`Generate` skapar texturen från bilddata med de inställningarna:

```cpp
void Generate(Texture2D& texture, unsigned int width, unsigned int height, unsigned char* data)
{
    texture.Width = width;
    texture.Height = height;
    // create Texture
    glBindTexture(GL_TEXTURE_2D, texture.ID);
    glTexImage2D(GL_TEXTURE_2D, 0, texture.Internal_Format, width, height, 0, texture.Image_Format, GL_UNSIGNED_BYTE, data);
    // set Texture wrap and filter modes
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, texture.Wrap_S);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, texture.Wrap_T);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, texture.Filter_Min);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, texture.Filter_Max);
    // unbind texture
    glBindTexture(GL_TEXTURE_2D, 0);
}
```

learnopengls konstruktor anropar också `glGenTextures`; en struct med standardvärden har ingen konstruktor, så kursen
anropar `glGenTextures` där en textur laddas (i `loadTextureFromFile`, nedan). learnopengls `Bind` behövs inte:
sprite-renderaren binder själv texturens ID.

Gör nu uppgiften **texture**.
:::
:::vulkan
En Vulkan-textur är flera objekt: bilden, dess minne, en image view – och, för att använda den i ett ritanrop, en
descriptor set som pekar på vyn och en sampler. Projektets descriptor set-layout har två bindings – uniform buffern på
binding 0, texturen på binding 1 – så varje textur får en egen descriptor set med båda, och att binda den seten är
Vulkan-versionen av `glBindTexture`. En sampler, `textureSampler` (REPEAT, LINEAR, ingen anisotropi: learnopengls
standardvärden för `Texture2D`), delas av alla texturer.

```cpp
struct Texture2D {
    VkImage         Image = VK_NULL_HANDLE;
    VkDeviceMemory  Memory = VK_NULL_HANDLE;
    VkImageView     View = VK_NULL_HANDLE;
    VkDescriptorSet DescriptorSet = VK_NULL_HANDLE;
    // texture image dimensions
    unsigned int Width = 0, Height = 0; // width and height of loaded image in pixels
};
```

Medlemsfunktionen `loadTextureFromFile` laddar en bildfil till en sådan textur, med de tidigare kapitlens
hjälpfunktioner:

```cpp
    Texture2D loadTextureFromFile(const char* file) {
        Texture2D texture;
        // load image
        int width, height, nrChannels;
        stbi_uc* data = stbi_load(file, &width, &height, &nrChannels, STBI_rgb_alpha);
        if (!data) {
            throw std::runtime_error("failed to load texture image!");
        }
        texture.Width = width;
        texture.Height = height;
        // now generate texture
        createTextureImage(data, width, height, texture.Image, texture.Memory);
        // and finally free image data
        stbi_image_free(data);

        texture.View = createImageView(texture.Image, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
        createDescriptorSet(texture.View, textureSampler, texture.DescriptorSet);
        return texture;
    }
```

`createTextureImage` är vulkan-tutorials uppladdning via staging buffer med layoutövergångarna. learnopengls
`LoadTexture(file, alpha, name)` har en flagga `alpha` som väljer `GL_RGB` eller `GL_RGBA`. Vulkan-versionen har
ingenting att välja på: enheter behöver inte stödja sampling av bilder med 3 kanaler, så varje textur är
`VK_FORMAT_R8G8B8A8_UNORM`, och `STBI_rgb_alpha` ger en RGB-fil alfa 255. Descriptor poolen har plats för 16 sådana sets
(`MAX_TEXTURES`), gott och väl för spelet.

Gör nu uppgiften **texture**.
:::
:::d3d12
En Direct3D 12-textur är en resurs i en default heap, fylld via en upload buffer; för att användas i ett ritanrop
behöver den en shader resource view i den shader-synliga heapen. Kursens `Texture2D` behåller learnopengls `ID` – men
här är ID:t **platsen för texturens vy i CBV/SRV-heapen**: det som ett ritanrop pekar root-parameter 2 på,
Direct3D 12-versionen av ett textur-ID som skickas till `glBindTexture`.

```cpp
struct Texture2D
{
    // the texture's shader resource view: its slot in the CBV/SRV heap, used for all texture
    // operations to reference to this particular texture (learnopengl's texture ID)
    unsigned int ID = 0;
    // texture image dimensions
    unsigned int Width = 0, Height = 0; // width and height of loaded image in pixels
    // texture Format (8 bits per channel, RGBA: Direct3D has no 8-bit RGB format)
    DXGI_FORMAT Internal_Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    // the texture in a default heap, and the upload buffer its pixels are copied from (it
    // must stay alive until the setup's command list has executed)
    ComPtr<ID3D12Resource> Resource;
    ComPtr<ID3D12Resource> UploadHeap;
};
```

Wrap och filtrering är inte en del av texturen: de är root signaturens statiska sampler. `Generate` är de tidigare
kapitlens `LoadTexture`, skriven med `Graphics`: den skapar texturen i tillståndet `COPY_DEST` och en upload buffer på
`GetRequiredIntermediateSize`, spelar in kopieringen med `UpdateSubresources` på `Graphics.CommandList` – setup-command
listen, fortfarande öppen medan `Init` körs –, spelar in barriären till `PIXEL_SHADER_RESOURCE` och skapar vyn i plats
`texture.ID`:

```cpp
    CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(Graphics.SrvHeap->GetCPUDescriptorHandleForHeapStart(), texture.ID, Graphics.SrvDescriptorSize);
    Graphics.Device->CreateShaderResourceView(texture.Resource.Get(), &srvDesc, srvHandle);
```

Kopieringen sker först när `LoadAssets` kör command listen, så upload buffern måste leva längre än `Generate`: den
sparas i structen.

Gör nu uppgiften **texture**.
:::

## Resurshanteraren

Eftersom spelet är ganska komplext behöver vi också en resurshanterare som laddar och håller reda på alla shaders och
texturer. learnopengl gör den till en klass med statiska funktioner och mappar: något i stil med en *singleton*, en
global som vilken del av koden som helst kan be om en resurs vid namn. Kursen skriver exakt det som två globala mappar
och fria funktioner:

:::opengl
```cpp
std::map<std::string, Shader>    Shaders;
std::map<std::string, Texture2D> Textures;

// loads (and generates) a shader program from file loading vertex, fragment (and geometry) shader's source code. If gShaderFile is not nullptr, it also loads a geometry shader
Shader LoadShader(const char *vShaderFile, const char *fShaderFile, const char *gShaderFile, std::string name)
{
    Shaders[name] = loadShaderFromFile(vShaderFile, fShaderFile, gShaderFile);
    return Shaders[name];
}

// retrieves a stored shader
Shader& GetShader(std::string name)
{
    return Shaders[name];
}
```

och `LoadTexture(const char *file, bool alpha, std::string name)` / `Texture2D& GetTexture(std::string name)` på samma
sätt. De två hjälpfunktionerna gör jobbet: `loadShaderFromFile` läser shaderfilerna med `std::ifstream` och en
`std::stringstream` (`vShaderStream << vertexShaderFile.rdbuf();`) och anropar `Compile`; `loadTextureFromFile` skapar
texturobjektet och laddar bilden:

```cpp
Texture2D loadTextureFromFile(const char *file, bool alpha)
{
    // create texture object
    Texture2D texture;
    glGenTextures(1, &texture.ID);
    if (alpha)
    {
        texture.Internal_Format = GL_RGBA;
        texture.Image_Format = GL_RGBA;
    }
    // load image
    int width, height, nrChannels;
    unsigned char* data = stbi_load(file, &width, &height, &nrChannels, 0);
    // now generate texture
    Generate(texture, width, height, data);
    // and finally free image data
    stbi_image_free(data);
    return texture;
}
```

`alpha` måste stämma med filen: en RGBA-fil som laddas som RGB skulle läsas med tre byte per pixel och bli en snedvriden
röra. Bilderna **vänds inte** (ingen `stbi_set_flip_vertically_on_load`): spelets projektion kommer att ha y-axeln
nedåt, så bildens första rad hör hemma överst – nästa kapitel förklarar det. `ClearResources()` (learnopengls `Clear`)
tar bort varje program och varje textur och anropas efter loopen, före `glfwTerminate()`.

`GetShader` och `GetTexture` returnerar **referenser** till de lagrade objekten, medan learnopengl returnerar kopior.
learnopengl kan anropa `ResourceManager::GetShader("sprite").Use()` på en kopia eftersom `Use` är en medlemsfunktion;
kursens `Use(Shader& shader)` tar en icke-const referens, och en returnerad kopia – ett temporärt objekt – kan inte
bindas till en sådan.
:::
:::vulkan
```cpp
std::map<std::string, VkPipeline> Shaders;
std::map<std::string, Texture2D>  Textures;

// retrieves a stored shader (its pipeline)
VkPipeline& GetShader(std::string name) {
    return Shaders[name];
}

// retrieves a stored texture
Texture2D& GetTexture(std::string name) {
    return Textures[name];
}
```

och, som medlemmar i applikationsklassen eftersom de behöver enheten:

```cpp
    VkPipeline LoadShader(const char* vShaderFile, const char* fShaderFile, std::string name) {
        createPipeline(vShaderFile, fShaderFile, Shaders[name]);
        return Shaders[name];
    }

    Texture2D LoadTexture(const char* file, std::string name) {
        Textures[name] = loadTextureFromFile(file);
        return Textures[name];
    }

    void ClearResources() {
        // (properly) delete all shaders
        for (auto iter : Shaders)
            vkDestroyPipeline(device, iter.second, nullptr);
        // (properly) delete all textures (their descriptor sets go with the descriptor pool)
        for (auto iter : Textures) {
            vkDestroyImageView(device, iter.second.View, nullptr);
            vkDestroyImage(device, iter.second.Image, nullptr);
            vkFreeMemory(device, iter.second.Memory, nullptr);
        }
    }
```

learnopengls `LoadShader` har en tredje fil, geometry shadern; spelet använder aldrig någon, så Vulkan-versionen
utelämnar den. `ClearResources()` är learnopengls `Clear`: den anropas i `cleanup()`, efter att huvudloopen har väntat
på enheten (`vkDeviceWaitIdle`) och innan uniform buffern och poolen förstörs. Descriptor seten behöver inte förstöras –
de frigörs med sin pool. Bilderna **vänds inte** när de laddas: spelets koordinater har y-axeln nedåt, så bildens första
rad hör hemma överst – nästa kapitel förklarar det.
:::
:::d3d12
```cpp
std::map<std::string, Shader>    Shaders;
std::map<std::string, Texture2D> Textures;

// loads (and generates) a shader program from file
Shader LoadShader(const wchar_t* shaderFile, std::string name)
{
    Shaders[name] = loadShaderFromFile(shaderFile);
    return Shaders[name];
}

// retrieves a stored shader
Shader& GetShader(std::string name)
{
    return Shaders[name];
}
```

och `LoadTexture(const char* file, bool alpha, std::string name)` / `Texture2D& GetTexture(std::string name)` på samma
sätt. De två hjälpfunktionerna gör jobbet. `loadShaderFromFile` kompilerar vertex shadern `VSMain` (`vs_5_0`) och pixel
shadern `PSMain` (`ps_5_0`) i en HLSL-fil – kursens Direct3D 12-shaderfiler innehåller båda, learnopengl har en fil per
steg – med `D3DCompileFromFile`, skriver ut kompilatorns meddelanden från fel-bloben med `OutputDebugStringA` om det
misslyckas, och anropar `Compile`. `loadTextureFromFile` ger texturen nästa lediga plats i heapen och laddar bilden:

```cpp
Texture2D loadTextureFromFile(const char* file, bool alpha)
{
    // create texture object: its view takes the next free slot of the CBV/SRV heap
    Texture2D texture;
    texture.ID = Graphics.SrvCount++;
    // load image, always as RGBA (an image without alpha gets alpha 255, so alpha = false
    // needs nothing more: it only says the image has no transparent parts)
    int width, height, nrChannels;
    unsigned char* data = stbi_load(file, &width, &height, &nrChannels, 4);
    if (data == nullptr)
    {
        throw std::runtime_error(std::string("Failed to load texture ") + file);
    }
    // now generate texture
    Generate(texture, width, height, data);
    // and finally free image data
    stbi_image_free(data);
    return texture;
}
```

learnopengls flagga `alpha` väljer `GL_RGB` eller `GL_RGBA`. Direct3D 12 har inget 8-bitars RGB-format, så varje bild
laddas med fyra kanaler, och en RGB-fil får alfa 255 – parametern finns kvar för learnopengls signatur. Bilderna **vänds
inte** – i Direct3D är v = 0 en bilds översta rad i alla fall, och spelets koordinater har y nedåt, som nästa kapitel
förklarar. `ClearResources()` (learnopengls `Clear`) tömmer helt enkelt mapparna: varje `ComPtr` frigör sitt objekt. Den
anropas i `OnDestroy` efter `WaitForPreviousFrame()`, när GPU:n inte längre använder dem.

`GetShader` och `GetTexture` returnerar **referenser** till de lagrade objekten, medan learnopengl returnerar kopior.
learnopengl kan anropa `ResourceManager::GetShader("sprite").Use()` på en kopia eftersom `Use` är en medlemsfunktion;
kursens `Use(Shader& shader)` tar en icke-const referens, och en returnerad kopia – ett temporärt objekt – kan inte
bindas till en sådan.
:::

Gör nu uppgiften **resource-manager**. Ingenting anropar funktionerna ännu – nästa kapitel laddar den första shadern och
texturen.

:::opengl
```quiz
Varför byter `loadTextureFromFile` båda formaten till `GL_RGBA` när `alpha` är true?
- [ ] Därför att blending bara fungerar med RGBA-texturer
- [ ] Därför att `stbi_load` alltid returnerar fyra kanaler
- [x] Därför att formaten måste beskriva filens pixlar: en RGBA-bild har fyra byte per pixel, och att ladda upp den som `GL_RGB` skulle läsa den med tre och snedvrida den
- [ ] Därför att `GL_RGB`-texturer inte kan samplas med `GL_LINEAR`
---
`stbi_load(…, 0)` returnerar filens eget antal kanaler. Spelet laddar sina bilder med genomskinliga delar (bollen, racketen) med `alpha = true` och de ogenomskinliga (bakgrunden, blocken) med `false`.
```
:::
:::vulkan
```quiz
Varför har Vulkan-versionens `LoadTexture` ingen parameter `alpha` som learnopengls?
- [ ] Därför att Vulkan-texturer inte kan vara genomskinliga
- [x] Därför att enheter inte behöver stödja sampling av bilder med 3 kanaler, så varje textur är `VK_FORMAT_R8G8B8A8_UNORM` och `STBI_rgb_alpha` ger RGB-filer alfa 255 – det finns ingenting att välja
- [ ] Därför att alfa bestäms av pipelinens blend-tillstånd
- [ ] Därför att descriptor seten sparar om texturen har alfa
---
En ogenomskinlig bild med alfa 255 överallt blendas precis som helt utan alfa. Kostnaden är en oanvänd byte per pixel, som GPU:er ofta lägger internt ändå.
```
:::
:::d3d12
```quiz
Vad är `Texture2D::ID` i Direct3D 12-versionen?
- [ ] Texturens `ID3D12Resource`-pekare
- [ ] Texturens virtuella GPU-adress
- [ ] Ett index i `Textures`, resurshanterarens mapp
- [x] Platsen för texturens shader resource view i CBV/SRV-heapen – ett ritanrop pekar root-parameter 2 på den, som OpenGL binder en textur med dess ID
---
`loadTextureFromFile` tar nästa lediga plats med `Graphics.SrvCount++`; plats 0 är constant bufferns vy. Spelets objekt kommer att spara det här talet som sin sprite, precis som learnopengls sparar ett textur-ID.
```
:::

## Programmet

Programmet skapar fönstret, konfigurerar API-tillståndet och initierar spelet, kör sedan loopen tills fönstret stängs,
och frigör till sist resurserna:

:::opengl
```cpp
int main()
{
    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#endif
    glfwWindowHint(GLFW_RESIZABLE, false);

    GLFWwindow* window = glfwCreateWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "Hedgerow", nullptr, nullptr);
    [...]
    glfwSetKeyCallback(window, key_callback);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);

    // OpenGL configuration
    // --------------------
    glViewport(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

    // initialize game
    // ---------------
    Init(Hedgerow);

    [... the game loop ...]

    // delete all resources as loaded using the resource manager
    // ---------------------------------------------------------
    ClearResources();

    glfwTerminate();
    return 0;
}
```

Fönstret går inte att ändra storlek på (`GLFW_RESIZABLE` false): spelet är gjort för 800 × 600 pixlar. Blending slås på
en gång för hela spelet, eftersom dess sprites har genomskinliga delar.
:::
:::vulkan
`run()` är vulkan-tutorials – `initWindow()` (ett fönster på 800 × 600 med titeln "Hedgerow", `GLFW_RESIZABLE` false:
spelet är gjort för 800 × 600 pixlar), `initVulkan()` (som slutar med `Init(Hedgerow)`), `mainLoop()` (spelloopen) och
`cleanup()` (med `ClearResources()`). Tillståndet som learnopengl konfigurerar i `main` – blending på – är en del av
varje pipeline i Vulkan.
:::
:::d3d12
`wWinMain` registrerar fönsterklassen, skapar ett fönster på 800 × 600 med titeln `L"Hedgerow"` – utan storleksram och
maximeringsknapp (`WS_OVERLAPPEDWINDOW & ~(WS_THICKFRAME | WS_MAXIMIZEBOX)`): spelet är gjort för 800 × 600 pixlar – och
kör meddelandeloopen, som anropar `OnUpdate` och `OnRender` när inget meddelande väntar. `LoadAssets` slutar med
`Init(Hedgerow)`, `OnDestroy` frigör resurserna med `ClearResources()`. Tillståndet som learnopengl konfigurerar i
`main` – blending på – är en del av varje pipeline state object i Direct3D 12.
:::

Tryck på **Build & run** en gång till: ett svart fönster, som i learnopengls kapitel. Det ser inte mycket ut för
världen, men varje del som spelet behöver för att ladda sina resurser, följa tiden och läsa tangentbordet är nu på plats.

```quiz
I vilka bildrutor i kursens spelloop ser `ProcessInput` mellanslag nedhållet?
- [ ] I varje bildruta från 0.5 s och framåt
- [ ] Bara i bildruta 30
- [ ] I ingen: kursen trycker aldrig på någon tangent
- [x] I bildrutorna 30, 31 och 32: nedtryckningen kommer vid 0.5 s (bildruta 30, före dess `ProcessInput`), släppet vid 0.55 s (bildruta 33)
---
Bildruta n ser tiden n / 60, så 0.5 s är bildruta 30 och 0.55 s är bildruta 33. Den enda skriptade tangenttryckningen är det som skjuter iväg bollen i kapitlet Bollen; fram till dess läser ingenting den.
```

## Mer att läsa

- [Setting up](https://learnopengl.com/In-Practice/2D-Game/Setting-up): learnopengls kapitel som det här kapitlet följer.
- [LearnOpenGL-källkod: 2D-spelet](https://github.com/JoeyDeVries/LearnOpenGL/tree/master/src/7.in_practice/3.2d_game):
  learnopengls spel, med tillståndet efter det här kapitlet i `0.full_source/progress`.

:::opengl vulkan
- [GLFW input guide](https://www.glfw.org/docs/latest/input_guide.html): key-callbacks, tangentkoder och de andra
  sätten att läsa indata.
:::
:::d3d12
- [Virtual-key codes](https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes): tangentkoderna som
  `WM_KEYDOWN` och `WM_KEYUP` bär.
- [Managing graphics pipeline state in Direct3D 12](https://learn.microsoft.com/en-us/windows/win32/direct3d12/managing-graphics-pipeline-state-in-direct3d-12):
  vad ett pipeline state object innehåller.
:::
