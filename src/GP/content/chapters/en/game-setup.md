# Setting up

Before we get started with the game mechanics, we first need to set up a simple framework for the game to reside in.
The game will use several third party libraries of which most have been introduced in earlier chapters. Wherever a
new library is required, it will be properly introduced.

First, we define a so called uber game class that contains all relevant render and gameplay code. The idea of such a
game class is that it (sort of) organizes your game code, while also decoupling all windowing code from the game. This
way, you could use the same class in a completely different windowing library (like SDL or SFML for example) without
much effort.

There are thousands of ways of trying to abstract and generalize game/graphics code into classes and objects. What you
will see in these chapters is just one (relatively simple) approach to solve this issue. If you feel there is a better
approach, try to come up with your own improvement of the implementation.

## One file of structs and free functions

learnopengl writes its game as classes in separate files – `game.h` / `game.cpp`, `resource_manager.h` / `.cpp`,
`shader.h` / `.cpp`, `texture.h` / `.cpp`, later `sprite_renderer`, `game_object`, `game_level` and more – plus a
`program.cpp` with `main`. The course keeps learnopengl's names and its steps, but writes the classes as **plain structs
and free functions in one `main.cpp`**, in the order of learnopengl's files, each function defined before it is used.
The built-in simulator follows plain structs and free functions, not classes with member functions. The rule is
simple: a class becomes a struct with its data members, and a member function becomes a free function that takes the
struct by reference as its first parameter – learnopengl's call of `Init()` on its game object becomes
`Init(Hedgerow)`, `shader.Use()` becomes `Use(shader)`. A real project would split the code into classes and files as
learnopengl does; one file of free functions is not a design to copy, just a way to keep everything in view.

:::opengl
| learnopengl | the course (OpenGL) |
|---|---|
| `class Shader` (`ID`, `Use()`, `Compile(…)`, `SetInteger/SetVector3f/SetMatrix4(name, value, useShader = false)`) | `struct Shader { unsigned int ID = 0; };`, `Use(Shader&)`, `Compile(Shader&, …)`, `SetInteger(Shader&, …)`, `SetVector3f(Shader&, …)`, `SetMatrix4(Shader&, …)` |
| `class Texture2D` (`ID`, size, formats, wrap and filter modes, `Generate`, `Bind`) | `struct Texture2D { … }` with the same fields and defaults, `Generate(Texture2D&, …)`; no `Bind` – the sprite renderer binds the texture's ID |
| `class ResourceManager` (static maps and functions) | two global maps `Shaders`, `Textures`, and `LoadShader`, `GetShader`, `LoadTexture`, `GetTexture`, `ClearResources` (learnopengl's `Clear`) |
| `class Game` (`State`, `Keys[1024]`, `Width`, `Height`, `Init`, `ProcessInput`, `Update`, `Render`) | `enum GameState`, `struct Game`, `Init(Game&)`, `ProcessInput(Game&, float)`, `Update(Game&, float)`, `Render(Game&)` |
:::
:::vulkan
The Vulkan code stays vulkan-tutorial's `HelloTriangleApplication`, with everything the earlier chapters built; the
game's structs and free functions sit *next to it*, before the class. The functions that need the Vulkan device –
loading shaders and textures – cannot be free functions without passing the device around, so they are **member
functions of the application class**: `Init`, `LoadShader`, `LoadTexture`, `loadTextureFromFile`, `ClearResources`
(and, in the next chapter, `InitRenderData`).

| learnopengl | the course (Vulkan) |
|---|---|
| `class Shader` (a compiled program) | the **graphics pipeline** made from the two SPIR-V files, a `VkPipeline`, created with the project's `createPipeline(vertFile, fragFile, pipeline)` helper |
| `class Texture2D` (ID, size, wrap and filter modes) | `struct Texture2D { VkImage Image; VkDeviceMemory Memory; VkImageView View; VkDescriptorSet DescriptorSet; unsigned int Width, Height; }`; one shared sampler with learnopengl's defaults (REPEAT, LINEAR) |
| `class ResourceManager` | two global maps `Shaders` (name → `VkPipeline`) and `Textures`, free `GetShader` / `GetTexture`, members `LoadShader`, `LoadTexture`, `loadTextureFromFile`, `ClearResources` |
| `class Game` | `enum GameState`, `struct Game`, free `ProcessInput`, `Update`, `Render`; member `Init` |
:::
:::d3d12
The Direct3D 12 code stays the application class of every Direct3D 12 chapter (`D3D12App` with `LoadPipeline`,
`LoadAssets`, `OnUpdate`, `OnRender`, `PopulateCommandList`, `WaitForPreviousFrame`); the game's structs and free
functions sit above it. learnopengl's classes reach OpenGL through its global context – any function can call
`glBindTexture`. Direct3D 12 has no global context: you call methods of objects – the device creates resources, the
command list records draws. So that the game's free functions can do the same, `LoadAssets` puts the objects the game
needs into one global struct, already in the project:

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

Plain pointers: `D3D12App` owns the objects and releases them. The game has **one root signature** for everything
it draws: root parameter 0 holds 19 root constants at b0 (a sprite's model matrix, 16 values, and its colour, 3),
root parameter 1 a descriptor table with the constant buffer view of the projection (b1, heap slot 0), root parameter
2 a table with the texture of the draw (t0); and a static sampler s0, linear and wrapping – learnopengl's `Texture2D`
defaults `GL_LINEAR` and `GL_REPEAT`. In Direct3D 12 sampling is part of the root signature, not of the texture.

| learnopengl | the course (Direct3D 12) |
|---|---|
| `class Shader` (`ID`, `Use`, `Compile`, setters) | `struct Shader { ComPtr<ID3D12PipelineState> PipelineState; };`, `Use(Shader&)`, `Compile(Shader&, ID3DBlob* vertexShader, ID3DBlob* pixelShader)`; no setters |
| `class Texture2D` (`ID`, size, formats, wrap and filter modes, `Generate`) | `struct Texture2D { unsigned int ID; unsigned int Width, Height; DXGI_FORMAT Internal_Format; ComPtr<ID3D12Resource> Resource, UploadHeap; }`, `Generate(Texture2D&, …)` – the ID is the slot of the texture's view in the heap |
| `class ResourceManager` | two global maps `Shaders`, `Textures`, and `LoadShader`, `GetShader`, `LoadTexture`, `GetTexture`, `ClearResources` |
| `class Game` | `enum GameState`, `struct Game`, `Init(Game&)`, `ProcessInput(Game&, float)`, `Update(Game&, float)`, `Render(Game&)` |
| `key_callback` | `OnKeyDown(UINT8 key)` / `OnKeyUp(UINT8 key)`, the names of the D3D12 samples' framework, called by `WindowProc` |
:::

The `// TODO:` comments in the project mark where each piece goes. This chapter draws nothing – learnopengl's "Setting
up" doesn't either –, so **Build & run** (Ctrl+Enter) shows a black window after every task; the tasks are checked in
the code.

## The game

The game class hosts an initialization function, a function to update the game state, a function to process user
input, and a render function:

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

and, in the application class, the empty `void Init(Game& game)`.
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

The class hosts what you'd expect from a game class. We initialize the game with a width and height (the resolution
you want to play the game in) – here the struct's default values, 800 × 600 – and use the `Init` function to load
shaders, textures and initialize all gameplay state. We can process input as stored within the `Keys` array by calling
`ProcessInput`, and update all gameplay events (like player/ball movement) in the `Update` function. Last, we can
render the game by calling `Render`. Note that we split the movement logic from the render logic.

The game also keeps track of its current state: `State`. The game can be in an active state, a menu state, or a win
state; for now it is always active. The menu and the win screen come in the later chapters.

learnopengl's game class is constructed with the window's size and holds the object of the whole game; the course's
global `Game Hedgerow;` is that object (learnopengl names its game object after its game, the course after its own).
Now do the first task, **game-struct**: add the enum, the struct, the global and the four empty functions, and call
`Init` once at the start and `Render` every frame:

:::opengl
`Init(Hedgerow);` in `main` after the OpenGL configuration (blending), before the loop; `Render(Hedgerow);` in the loop
right after `glClear(GL_COLOR_BUFFER_BIT);`.
:::
:::vulkan
`Init(Hedgerow);` at the end of `initVulkan()`, after `createDescriptorPool();` – the game will create descriptor sets
for its textures, so the pool must exist –, and `Render(Hedgerow);` in `recordCommandBuffer()` inside the render pass,
after `vkCmdSetScissor`: in Vulkan "rendering" means recording the frame's draws into the command buffer.
:::
:::d3d12
`Init(Hedgerow);` at the end of `LoadAssets`, after the `Graphics.…` assignments and before `m_commandList->Close()`:
the setup command list is still open then, so the textures the game will load are uploaded with it. `Render(Hedgerow);`
in `PopulateCommandList` after the clear (after `IASetPrimitiveTopology`), before the barrier back to `PRESENT`: in
Direct3D 12 "rendering" means recording the frame's draws into the command list.
:::

## The game loop

The program is learnopengl's `program.cpp`: it creates the window, initializes the game, and then runs the game loop.
Each frame of the loop measures how long the last frame took, processes the input, updates the game and renders it.

The time a frame takes is *delta time*. Different computers draw at different speeds – one renders 60 frames per
second, another 144 – and if the paddle moved a fixed number of pixels per frame, it would be more than twice as fast
on the second. So the game measures the frame's duration and moves everything by speed × time: a paddle with a speed
of 500 pixels per second moves 500 × 1/60 ≈ 8.3 pixels in a frame of 1/60 second, and half that in a frame of 1/120
second. That is the `dt` that `ProcessInput` and `Update` receive. (The Camera chapter used the same idea for the
camera's speed.)

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

`drawFrame()` records the command buffer – with `Render(Hedgerow)` inside the render pass, which clears to black –,
submits it and presents the image.
:::
:::d3d12
The D3D12 samples' framework has its own loop: the message loop in `wWinMain` calls `OnUpdate()` and then `OnRender()`
whenever no window message is waiting. So the game's part of the loop goes into `OnUpdate`, and its time is measured
there, with `std::chrono` like the earlier Direct3D 12 chapters:

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

The `static` variable is initialised at the first call, so the first frame's deltaTime is (almost) 0. `OnRender` then
records the frame (`PopulateCommandList`, with `Render(Hedgerow)`), executes it and presents.
:::

Now do the task **delta-time**: measure the frame's time at the top of the loop and pass it to `ProcessInput` and
`Update`.

**The course's time is deterministic.** For the pictures of the game to be comparable – between the three APIs, between
drivers, and with the built-in simulator – the game must be in exactly the same state at the same moment. With a real
clock that is impossible: every frame takes a slightly different time. So in the course, **frame n of the loop sees
the time n / 60 seconds**: frame 0 sees 0, frame 1 sees 1/60, and deltaTime is 0 in the first frame and exactly 1/60 in
every frame after it. To show the game at a time t, the simulator runs the loop t × 60 times.
:::opengl
The program does nothing special for that: it reads `glfwGetTime()` as learnopengl does, and the simulator (and the
course's test runs on real drivers) let `glfwGetTime()` count the frames – it returns the number of `glfwPollEvents`
calls so far divided by 60. On your own computer, outside the course, the same code runs on the real clock.
:::
:::vulkan
The program does nothing special for that: it reads `glfwGetTime()` as learnopengl does, and the simulator (and the
course's test runs on real drivers) let `glfwGetTime()` count the frames – it returns the number of `glfwPollEvents`
calls so far divided by 60. On your own computer, outside the course, the same code runs on the real clock.
:::
:::d3d12
The program does nothing special for that: it reads the clock as the earlier chapters do, and the simulator gives the
n-th `OnUpdate` call the clock value n / 60 s. On Windows the same code runs on the real clock, so the game runs at the
same speed at any refresh rate.
:::

```quiz
The paddle will move with `PLAYER_VELOCITY * dt` pixels per frame, with `PLAYER_VELOCITY` = 500. How far does it move in the course's frame 0 and in frame 1 while a movement key is held?
- [ ] 500 pixels in each frame
- [x] 0 pixels in frame 0 (deltaTime 0) and 500 / 60 ≈ 8.3 pixels in frame 1
- [ ] 8.3 pixels in each frame, frame 0 included
- [ ] 1/60 pixel per frame
---
deltaTime is the time since the previous frame: 0 at the very first one, exactly 1/60 s after that in the course. On a real clock it varies a little from frame to frame, and the movement varies with it – the speed in pixels per second stays the same.
```

## Input

learnopengl's game reads the keyboard through GLFW's key callback: a function GLFW calls whenever a key is pressed or
released. The callback does not move anything itself. It only records which keys are down, in the game's `Keys` array –
one `bool` per key code –, and `ProcessInput` reads that array every frame. That way a key that is held down moves the
paddle in every frame it is held, at the speed of the game loop, while the callback is only called when something
changes (and, for a held key, with the keyboard's repeat rate).

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

The callback is registered after GLAD is loaded:

```cpp
    glfwSetKeyCallback(window, key_callback);
```

GLFW's key codes are below 1024 (`GLFW_KEY_LAST` is 348), so `Keys[1024]` has room for every key; the range check
guards against `GLFW_KEY_UNKNOWN`, which is -1. Callbacks are called from inside `glfwPollEvents()` – which is why the
loop polls the events right before `ProcessInput`.
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

The window is GLFW's in Vulkan too, so the callback is learnopengl's, a free function before the class. It is
registered in `initWindow()` right after the window is created:

```cpp
        glfwSetKeyCallback(window, key_callback);
```

GLFW's key codes are below 1024 (`GLFW_KEY_LAST` is 348), so `Keys[1024]` has room for every key; the range check
guards against `GLFW_KEY_UNKNOWN`, which is -1. Callbacks are called from inside `glfwPollEvents()` – which is why the
loop polls the events right before `ProcessInput`.
:::
:::d3d12
The Direct3D 12 program has no GLFW: its window is a plain Win32 window, and Windows sends it a `WM_KEYDOWN` message
when a key is pressed and `WM_KEYUP` when it is released, with the key's *virtual-key code* in `wParam`. The window
procedure hands them to two functions named like the D3D12 samples' framework does, `OnKeyDown` and `OnKeyUp`:

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

The virtual-key codes of the letters are their capital ASCII codes ('A' = 65) and the space is `VK_SPACE` = 32 – the
same numbers as GLFW's `GLFW_KEY_A` and `GLFW_KEY_SPACE`, so the game's code can test `Keys['A']` where the GLFW
versions test `Keys[GLFW_KEY_A]`. A virtual-key code fits into a byte, far inside `Keys[1024]`. The messages are
handled by the message loop before it calls `OnUpdate`, just as GLFW calls its callbacks inside `glfwPollEvents()`.
:::

Now do the task **key-callback**.

**The course's input is deterministic too.** Nobody presses keys in the simulator. So that the later chapters can show
the ball being launched, the course presses one key by itself: **space, pressed at t = 0.5 s and released at
t = 0.55 s**, through the program's own key callback
:::opengl vulkan
(`key_callback(window, GLFW_KEY_SPACE, scancode, GLFW_PRESS, 0)` inside the `glfwPollEvents()` of frame 30, and the
release inside frame 33's).
:::
:::d3d12
(`OnKeyDown(VK_SPACE)` before the `OnUpdate` of frame 30, `OnKeyUp(VK_SPACE)` before that of frame 33).
:::
So `ProcessInput` sees the space bar held in frames 30, 31 and 32. No other key is ever pressed – the paddle never
moves in the course's pictures. Until the Ball chapter nothing reads the space bar.

```quiz
Why does the key callback only store the key's state in `Keys` instead of moving the paddle itself?
- [ ] Because the callback may not change global variables
- [ ] Because the callback is only called once when the program starts
- [x] Because the callback is only called when a key changes (and at the keyboard's repeat rate); `ProcessInput` reads `Keys` every frame, so a held key moves the paddle smoothly in every frame, by `dt`
- [ ] Because the callback runs on the GPU
---
Events say *that* something changed, the state array says *what is* – and the game loop needs the state once per frame, together with the frame's delta time.
```

## Shaders

learnopengl's game has a few utility classes for the resources it uses: `Shader`, `Texture2D` and the
`ResourceManager` that loads and keeps them.

:::opengl
The `Shader` class is the one of the earlier chapters with a few changes: it gets the shader *source code* instead of
file names (the resource manager reads the files), it can compile an optional geometry shader, and each setter can make
the shader active first. As a struct with free functions:

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
compiles the vertex and the fragment shader and, if its source is given, the geometry shader, links them into
`shader.ID = glCreateProgram()`, checks every step with `checkCompileErrors` (learnopengl's messages) and deletes the
shader objects, which are part of the program now. The uniform setters:

```cpp
void SetMatrix4(Shader& shader, const char* name, const glm::mat4& matrix, bool useShader = false)
{
    if (useShader)
        Use(shader);
    glUniformMatrix4fv(glGetUniformLocation(shader.ID, name), 1, false, glm::value_ptr(matrix));
}
```

and in the same way `SetInteger` (`glUniform1i`) and `SetVector3f` (`glUniform3f`) – the game needs only these three
for now; more are added when a chapter needs them. The `useShader` parameter exists because of what the Debugging
chapter showed: `glUniform*` changes the uniform of the program *in use*, and a call with no program (or the wrong one)
in use fails.

Now do the task **shader**.
:::
:::vulkan
In Vulkan there is no shader object to compile at run time: the GLSL is compiled to SPIR-V beforehand, and what draws
with it is a **graphics pipeline** – the shader modules together with the vertex input, the rasterizer state, the
blending and the layout of the descriptors. So what learnopengl calls a "shader" is, in the Vulkan version, the
`VkPipeline` made from the two SPIR-V files, and loading a shader means making a pipeline. The project already has the
helper for that, `createPipeline(vertFile, fragFile, pipeline)`: the sprite vertex format (one `vec4`), no depth
test, no culling, and alpha blending (`SRC_ALPHA` / `ONE_MINUS_SRC_ALPHA` – learnopengl's `glEnable(GL_BLEND)` in
`main`). There are no uniform setters either: what learnopengl sets as uniforms becomes push constants (per sprite,
`struct PushConstants { glm::mat4 model; glm::vec3 spriteColor; };`) and the uniform buffer (the projection).
learnopengl's `Shader` class therefore has no task of its own in Vulkan.
:::
:::d3d12
In Direct3D 12 there is no program object: the compiled vertex and pixel shaders are part of a **pipeline state
object** (PSO), together with the input layout, the rasterizer, blend and depth states and the root signature. So
learnopengl's `Shader` holds a PSO, and "using" it means setting it on the command list:

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

`Compile(Shader& shader, ID3DBlob* vertexShader, ID3DBlob* pixelShader)` creates the PSO with the states 2D sprites
need: the input layout of the sprite vertex (`POSITION` and `TEXCOORD`, two floats each – learnopengl's `vec4` of
position and texture coordinates), `Graphics.RootSignature`, alpha blending (learnopengl's `glEnable(GL_BLEND)` and
`glBlendFunc` in `main`), no depth test and no culling:

```cpp
    psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;
    psoDesc.BlendState = CD3DX12_BLEND_DESC(D3D12_DEFAULT);
    psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;
    psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_SRC_ALPHA;
    psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_INV_SRC_ALPHA;
```

then `Graphics.Device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&shader.PipelineState))`. There are no
uniform setters (`SetInteger`, `SetMatrix4` …): Direct3D 12 has no per-program uniforms. What learnopengl sets as
uniforms becomes root constants (per sprite, set when it is drawn) and the constant buffer (the projection, written
in `OnUpdate`). And no `checkCompileErrors`: `D3DCompileFromFile` returns the compiler's messages itself.

Now do the task **shader**.
:::

## Textures

:::opengl
The `Texture2D` class keeps a texture's ID, its size and the settings it is created with; its defaults are what
learnopengl's constructor sets:

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

`Generate` creates the texture from image data with those settings:

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

learnopengl's constructor also calls `glGenTextures`; a struct with default values has no constructor, so the course
calls `glGenTextures` where a texture is loaded (in `loadTextureFromFile`, below). learnopengl's `Bind` is not needed:
the sprite renderer binds the texture's ID itself.

Now do the task **texture**.
:::
:::vulkan
A Vulkan texture is several objects: the image, its memory, an image view – and, to use it in a draw, a descriptor set
that points at the view and a sampler. The project's descriptor set layout has two bindings – the uniform buffer at
binding 0, the texture at binding 1 – so each texture gets its own descriptor set with both, and binding that set is
the Vulkan version of `glBindTexture`. One sampler, `textureSampler` (REPEAT, LINEAR, no anisotropy: learnopengl's
`Texture2D` defaults), is shared by all textures.

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

The member function `loadTextureFromFile` loads an image file into such a texture, with the helpers of the earlier
chapters:

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

`createTextureImage` is vulkan-tutorial's staging-buffer upload with the layout transitions. learnopengl's
`LoadTexture(file, alpha, name)` has an `alpha` flag that picks `GL_RGB` or `GL_RGBA`. The Vulkan version has nothing
to choose: devices need not support sampling 3-channel images, so every texture is `VK_FORMAT_R8G8B8A8_UNORM`, and
`STBI_rgb_alpha` gives an RGB file an alpha of 255. The descriptor pool has room for 16 such sets (`MAX_TEXTURES`),
plenty for the game.

Now do the task **texture**.
:::
:::d3d12
A Direct3D 12 texture is a resource in a default heap, filled through an upload buffer; to use it in a draw it needs a
shader resource view in the shader-visible heap. The course's `Texture2D` keeps learnopengl's `ID` – but here the ID is
**the slot of the texture's view in the CBV/SRV heap**: what a draw points root parameter 2 at, the Direct3D 12 version
of a texture ID passed to `glBindTexture`.

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

Wrapping and filtering are not part of the texture: they are the root signature's static sampler. `Generate` is the
`LoadTexture` of the earlier chapters, written with `Graphics`: it creates the texture in the `COPY_DEST` state and an
upload buffer of `GetRequiredIntermediateSize`, records the copy with `UpdateSubresources` on `Graphics.CommandList` –
the setup command list, still open while `Init` runs –, records the barrier to `PIXEL_SHADER_RESOURCE`, and creates
the view in slot `texture.ID`:

```cpp
    CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(Graphics.SrvHeap->GetCPUDescriptorHandleForHeapStart(), texture.ID, Graphics.SrvDescriptorSize);
    Graphics.Device->CreateShaderResourceView(texture.Resource.Get(), &srvDesc, srvHandle);
```

The copy happens only when `LoadAssets` executes the command list, so the upload buffer must outlive `Generate`: it is
kept in the struct.

Now do the task **texture**.
:::

## The resource manager

As the game is relatively complex, we're also going to need a resource manager that loads and keeps track of all the
shaders and textures. learnopengl makes it a class of static functions and maps: a *singleton*-like global that any
part of the code can ask for a resource by name. The course writes exactly that as two global maps and free
functions:

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

and `LoadTexture(const char *file, bool alpha, std::string name)` / `Texture2D& GetTexture(std::string name)` the same
way. The two helpers do the work: `loadShaderFromFile` reads the shader files with `std::ifstream` and a
`std::stringstream` (`vShaderStream << vertexShaderFile.rdbuf();`) and calls `Compile`; `loadTextureFromFile` creates
the texture object and loads the image:

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

`alpha` must match the file: an RGBA file loaded as RGB would be read with three bytes per pixel and come out as a
sheared mess. The images are **not flipped** (no `stbi_set_flip_vertically_on_load`): the game's projection will have
its y axis pointing down, so the image's first row belongs at the top – the next chapter explains it. `ClearResources()`
(learnopengl's `Clear`) deletes every program and texture and is called after the loop, before `glfwTerminate()`.

`GetShader` and `GetTexture` return **references** to the stored objects, while learnopengl returns copies. learnopengl
can call `ResourceManager::GetShader("sprite").Use()` on a copy because `Use` is a member function; the course's
`Use(Shader& shader)` takes a non-const reference, and a returned copy – a temporary – cannot bind to one.
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

and, as members of the application class because they need the device:

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

learnopengl's `LoadShader` has a third file, the geometry shader; the game never uses one, so the Vulkan version
leaves it out. `ClearResources()` is learnopengl's `Clear`: it is called in `cleanup()`, after the main loop has waited
for the device (`vkDeviceWaitIdle`) and before the uniform buffer and the pool are destroyed. The descriptor sets need
no destroying – they are freed with their pool. The images are **not flipped** when they are loaded: the game's
coordinates have their y axis pointing down, so the image's first row belongs at the top – the next chapter explains
it.
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

and `LoadTexture(const char* file, bool alpha, std::string name)` / `Texture2D& GetTexture(std::string name)` the same
way. The two helpers do the work. `loadShaderFromFile` compiles the vertex shader `VSMain` (`vs_5_0`) and the pixel
shader `PSMain` (`ps_5_0`) of one HLSL file – the course's Direct3D 12 shader files hold both, learnopengl has a file per
stage – with `D3DCompileFromFile`, prints the compiler's messages from the error blob with `OutputDebugStringA` if it
fails, and calls `Compile`. `loadTextureFromFile` gives the texture the next free heap slot and loads the image:

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

learnopengl's `alpha` flag picks `GL_RGB` or `GL_RGBA`. Direct3D 12 has no 8-bit RGB format, so every image is loaded
with four channels, and an RGB file gets an alpha of 255 – the parameter stays for learnopengl's signature. The images
are **not flipped** – in Direct3D v = 0 is an image's top row anyway, and the game's coordinates have y pointing down,
as the next chapter explains. `ClearResources()` (learnopengl's `Clear`) simply empties the maps: each `ComPtr` releases
its object. It is called in `OnDestroy` after `WaitForPreviousFrame()`, when the GPU no longer uses them.

`GetShader` and `GetTexture` return **references** to the stored objects, while learnopengl returns copies. learnopengl
can call `ResourceManager::GetShader("sprite").Use()` on a copy because `Use` is a member function; the course's
`Use(Shader& shader)` takes a non-const reference, and a returned copy – a temporary – cannot bind to one.
:::

Now do the task **resource-manager**. Nothing calls these functions yet – the next chapter loads the first shader and
texture.

:::opengl
```quiz
Why does `loadTextureFromFile` switch both formats to `GL_RGBA` when `alpha` is true?
- [ ] Because blending only works with RGBA textures
- [ ] Because `stbi_load` always returns four channels
- [x] Because the formats must describe the file's pixels: an RGBA image has four bytes per pixel, and uploading it as `GL_RGB` would read it with three and shear it
- [ ] Because `GL_RGB` textures cannot be sampled with `GL_LINEAR`
---
`stbi_load(…, 0)` returns the file's own number of channels. The game loads its images with transparent parts (the ball, the paddle) with `alpha = true` and the opaque ones (the background, the blocks) with `false`.
```
:::
:::vulkan
```quiz
Why has the Vulkan `LoadTexture` no `alpha` parameter like learnopengl's?
- [ ] Because Vulkan textures cannot be transparent
- [x] Because devices need not support sampling 3-channel images, so every texture is `VK_FORMAT_R8G8B8A8_UNORM` and `STBI_rgb_alpha` gives RGB files an alpha of 255 – there is nothing to choose
- [ ] Because the alpha is decided by the pipeline's blend state
- [ ] Because the descriptor set stores whether the texture has alpha
---
An opaque image with alpha 255 everywhere blends exactly like no alpha at all. The cost is one unused byte per pixel, which GPUs often spend internally anyway.
```
:::
:::d3d12
```quiz
What is `Texture2D::ID` in the Direct3D 12 version?
- [ ] The texture's `ID3D12Resource` pointer
- [ ] The GPU virtual address of the texture
- [ ] An index into `Textures`, the resource manager's map
- [x] The slot of the texture's shader resource view in the CBV/SRV heap – a draw points root parameter 2 at it, as OpenGL binds a texture by its ID
---
`loadTextureFromFile` takes the next free slot with `Graphics.SrvCount++`; slot 0 is the constant buffer's view. The game's objects will keep this number as their sprite, exactly as learnopengl's keep a texture ID.
```
:::

## Program

The program creates the window, configures the API state and initializes the game, then runs the loop until the
window is closed, and at the end frees the resources:

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

The window cannot be resized (`GLFW_RESIZABLE` false): the game is made for 800 × 600 pixels. Blending is switched on
once for the whole game, since its sprites have transparent parts.
:::
:::vulkan
`run()` is vulkan-tutorial's – `initWindow()` (an 800 × 600 window titled "Hedgerow", `GLFW_RESIZABLE` false: the game
is made for 800 × 600 pixels), `initVulkan()` (ending with `Init(Hedgerow)`), `mainLoop()` (the game loop) and
`cleanup()` (with `ClearResources()`). The pipeline state learnopengl configures in `main` – blending on – is part of
each pipeline in Vulkan.
:::
:::d3d12
`wWinMain` registers the window class, creates an 800 × 600 window titled `L"Hedgerow"` – without a sizing border and
a maximize box (`WS_OVERLAPPEDWINDOW & ~(WS_THICKFRAME | WS_MAXIMIZEBOX)`): the game is made for 800 × 600 pixels –
and runs the message loop, which calls `OnUpdate` and `OnRender` whenever no message is waiting. `LoadAssets` ends with
`Init(Hedgerow)`, `OnDestroy` frees the resources with `ClearResources()`. The state learnopengl configures in `main` –
blending on – is part of each pipeline state object in Direct3D 12.
:::

Press **Build & run** once more: a black window, as in learnopengl's chapter. It doesn't look like much, but every
piece the game needs to load its resources, follow the time and read the keyboard is now in place.

```quiz
In which frames of the course's game loop does `ProcessInput` see the space bar held down?
- [ ] In every frame from 0.5 s on
- [ ] Only in frame 30
- [ ] In none: the course never presses a key
- [x] In frames 30, 31 and 32: the press arrives at 0.5 s (frame 30, before its `ProcessInput`), the release at 0.55 s (frame 33)
---
Frame n sees the time n / 60, so 0.5 s is frame 30 and 0.55 s is frame 33. That one scripted key press is what will launch the ball in the Ball chapter; until then, nothing reads it.
```

## Additional resources

- [Setting up](https://learnopengl.com/In-Practice/2D-Game/Setting-up): learnopengl's chapter this chapter follows.
- [LearnOpenGL source code: the 2D game](https://github.com/JoeyDeVries/LearnOpenGL/tree/master/src/7.in_practice/3.2d_game):
  learnopengl's game, with the state after this chapter in `0.full_source/progress`.

:::opengl vulkan
- [GLFW input guide](https://www.glfw.org/docs/latest/input_guide.html): key callbacks, key codes and the other ways
  to read input.
:::
:::d3d12
- [Virtual-key codes](https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes): the key codes
  `WM_KEYDOWN` and `WM_KEYUP` carry.
- [Managing graphics pipeline state in Direct3D 12](https://learn.microsoft.com/en-us/windows/win32/direct3d12/managing-graphics-pipeline-state-in-direct3d-12):
  what a pipeline state object holds.
:::
