# Setting up (Hedgerow) – tasks (DirectX 12)

learnopengl "2D Game / Setting up": `src/7.in_practice/3.2d_game/0.full_source/progress/2.program.cpp`,
`2.game.h/.cpp`, and the resource classes `resource_manager`, `shader`, `texture` of `0.full_source`. File: `main.cpp`
only (the game's shaders, textures and levels arrive in the next chapters).

**Fixed choices for the whole game** – OpenGL's (see projects/opengl/game-setup/tasks.md): the course's own game
**Hedgerow** (never "Breakout"), window title `L"Hedgerow"`, 800×600 client area, not resizable (the window style
without `WS_THICKFRAME` and `WS_MAXIMIZEBOX`), the global `Game Hedgerow;`, learnopengl's classes as **plain structs
and free functions** in one `main.cpp`, in the order of learnopengl's files (Shader, Texture2D, ResourceManager,
SpriteRenderer, GameObject, GameLevel, Game, program), with learnopengl's names; the projection is pixels from the
top-left with y down; images are not flipped (Direct3D's v = 0 is the image's top row anyway). A real project would
split this into classes and files as learnopengl does.

**Direct3D 12's choices:**
- The **application class stays** (`D3D12App`, as in every Direct3D 12 chapter: `LoadPipeline`, `LoadAssets`,
  `OnUpdate`, `OnRender`, `PopulateCommandList`, `WaitForPreviousFrame`, `GetHardwareAdapter`); the game's structs and
  free functions sit above it. The game is wired in like learnopengl's program.cpp: `Init(Hedgerow)` at the end of
  `LoadAssets` (while the setup command list is still open, so the textures the game loads are uploaded with it),
  `ProcessInput` / `Update` in `OnUpdate`, `Render(Hedgerow)` in `PopulateCommandList` between the clear and the
  barrier back to PRESENT.
- **`GraphicsContext Graphics`** (in the start): learnopengl's classes reach OpenGL through its global context;
  Direct3D 12 passes objects around, so `LoadAssets` stores the ones the game needs in one global struct – `Device`,
  `CommandList` (the one command list: setup, then every frame), `RootSignature`, `SrvHeap` (the shader-visible CBV/SRV
  heap, 32 descriptors), `SrvDescriptorSize`, `SrvCount` (descriptors in use: slot 0 is the CBV of the projection).
  Plain pointers: `D3D12App` owns the objects.
- One **root signature** for the game (`LoadAssets`): root parameter 0 = 19 root constants at b0 (a sprite's
  `model` + `spriteColor`, both shaders), 1 = the CBV table at b1 (`SceneConstantBuffer { projection }`, heap slot 0),
  2 = one SRV table at t0 (the sprite's texture); static sampler s0 linear WRAP (learnopengl's Texture2D defaults
  GL_LINEAR / GL_REPEAT – in Direct3D 12 sampling is part of the root signature, not of the texture).
- learnopengl ↔ course (Direct3D 12):
  | learnopengl | course (Direct3D 12) |
  |---|---|
  | `class Shader` (`ID`, `Use`, `Compile`, setters) | `struct Shader { ComPtr<ID3D12PipelineState> PipelineState; };` (the vertex and pixel shader live in a pipeline state object), `void Use(Shader&)` (`Graphics.CommandList->SetPipelineState`), `void Compile(Shader&, ID3DBlob* vertexShader, ID3DBlob* pixelShader)` (creates the PSO with the input layout POSITION/TEXCOORD float2 + float2, alpha blending SRC_ALPHA / INV_SRC_ALPHA – learnopengl's `glEnable(GL_BLEND)` –, no depth, no culling). No `SetInteger/SetVector3f/SetMatrix4`: Direct3D 12 has no per-shader uniforms – the sprite's values are root constants (set in `DrawSprite`), the projection is the constant buffer (written in `OnUpdate`). No `checkCompileErrors`: `D3DCompileFromFile` returns the compiler's messages (in `loadShaderFromFile`). |
  | `class Texture2D` (`ID`, size, formats, wrap/filter, `Generate`) | `struct Texture2D { unsigned int ID = 0; unsigned int Width = 0, Height = 0; DXGI_FORMAT Internal_Format = DXGI_FORMAT_R8G8B8A8_UNORM; ComPtr<ID3D12Resource> Resource, UploadHeap; };` – **ID = the slot of its shader resource view in the heap** (what a draw points root parameter 2 at; `GameObject::Sprite` holds it later); `void Generate(Texture2D&, unsigned int width, unsigned int height, unsigned char* data)` (default-heap texture, upload buffer, `UpdateSubresources` on the setup command list, barrier COPY_DEST → PIXEL_SHADER_RESOURCE, SRV in slot `texture.ID`). |
  | `class ResourceManager` | globals `std::map<std::string, Shader> Shaders; std::map<std::string, Texture2D> Textures;`, `Shader loadShaderFromFile(const wchar_t* shaderFile)` (VSMain/vs_5_0 and PSMain/ps_5_0 of one .hlsl file – the course's Direct3D 12 shader files hold both, learnopengl has two files), `Texture2D loadTextureFromFile(const char* file, bool alpha)` (`texture.ID = Graphics.SrvCount++`, `stbi_load(file, …, 4)`, `Generate`, `stbi_image_free`), `Shader LoadShader(const wchar_t* shaderFile, std::string name)`, `Shader& GetShader(std::string)`, `Texture2D LoadTexture(const char* file, bool alpha, std::string name)`, `Texture2D& GetTexture(std::string)`, `void ClearResources()` (clears the maps: each ComPtr releases its object). |
  | `class Game` | the same as OpenGL: `enum GameState { GAME_ACTIVE, GAME_MENU, GAME_WIN };`, `struct Game { GameState State = GAME_ACTIVE; bool Keys[1024] = {}; unsigned int Width = SCREEN_WIDTH, Height = SCREEN_HEIGHT; };`, `Init(Game&)`, `ProcessInput(Game&, float dt)`, `Update(Game&, float dt)`, `Render(Game&)`. |
  | `key_callback` | `void OnKeyDown(UINT8 key)` / `void OnKeyUp(UINT8 key)` (the D3D12 samples' framework names), called by `WindowProc` for `WM_KEYDOWN` / `WM_KEYUP` with the virtual-key code; Escape closes the window in `WindowProc`. Virtual-key codes for letters and the space are GLFW's numbers ('A' = 65 = GLFW_KEY_A, VK_SPACE = 32 = GLFW_KEY_SPACE). |
  `alpha` of `LoadTexture`: Direct3D 12 has no 8-bit RGB format, so every image is loaded as RGBA
  (`stbi_load(…, 4)`), and an RGB file gets alpha 255 – `alpha = false` needs nothing more (the parameter stays for
  learnopengl's signature).
- **Time:** `OnUpdate` measures deltaTime with `std::chrono::high_resolution_clock` (`static auto lastFrame = now()`
  at the first call, then `currentFrame - lastFrame`), as the earlier Direct3D 12 chapters measure time – the real
  clock, so the game runs at the same speed at any refresh rate. Deterministic like OpenGL: the simulator (and any
  replay) gives frame n (the n-th `OnUpdate` call, n = 0, 1, 2 …) the clock value **n / 60 s** – deltaTime 0 in frame 0
  and exactly 1/60 after that, the same as OpenGL's glfwGetTime() = n / 60. One frame = `OnUpdate` then `OnRender`
  (`PopulateCommandList`), called by the message loop when no message is waiting.
- **Input:** no key is pressed, except **SPACE: pressed at t = 0.5 s, released at t = 0.55 s**, delivered as
  `OnKeyDown(VK_SPACE)` / `OnKeyUp(VK_SPACE)` (what `WindowProc` calls for `WM_KEYDOWN` / `WM_KEYUP` with
  `wParam = VK_SPACE`): the press before `OnUpdate` of frame 30, the release before `OnUpdate` of frame 33 (so
  `ProcessInput` of frames 30, 31, 32 sees `Keys[VK_SPACE] == true`). Nothing reads it before the `ball` chapter.
- Nothing can run here (Direct3D 12 needs Windows): verify.sh checks syntax and types with MinGW and the HLSL with
  glslang.

**Picture of every state of this chapter:** black (0, 0, 0) everywhere (the clear colour) – learnopengl's "Setting
up" draws nothing. All tasks are checked in the code.

## game-struct
- **Task:** Add the game's state – `enum GameState` and `struct Game` (State, Keys[1024], Width, Height) –, the global
  `Game Hedgerow;` and the four empty game functions `Init`, `ProcessInput`, `Update`, `Render`; call `Init` at the end
  of `LoadAssets` and `Render` after the clear in `PopulateCommandList`.
- **Hint:** learnopengl's class Game as a struct with default values; each member function becomes a free function
  taking `Game& game`. `Init` runs while the setup command list is still open.
- **Observable:** `enum GameState { GAME_ACTIVE, GAME_MENU, GAME_WIN };`, `struct Game` with exactly the four fields
  and defaults, `Game Hedgerow;`, `void Init(Game& game)`, `void ProcessInput(Game& game, float dt)`,
  `void Update(Game& game, float dt)`, `void Render(Game& game)` (empty bodies); in `LoadAssets` `Init(Hedgerow);` after
  the `Graphics.…` assignments and before `m_commandList->Close()`; in `PopulateCommandList` `Render(Hedgerow);` after
  `IASetPrimitiveTopology` (after the clear). No visible change.

## delta-time
- **Task:** Measure the time each frame takes (deltaTime) at the start of `OnUpdate` and pass it to `ProcessInput` and
  `Update`.
- **Hint:** `static auto lastFrame = std::chrono::high_resolution_clock::now();`, `auto currentFrame = …now();`,
  `float deltaTime = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - lastFrame).count();`,
  `lastFrame = currentFrame;`.
- **Observable:** those four lines at the top of `OnUpdate`, then `ProcessInput(Hedgerow, deltaTime);` and
  `Update(Hedgerow, deltaTime);`. No visible change.

## key-callback
- **Task:** Store the keyboard state in `Hedgerow.Keys`: `OnKeyDown(key)` / `OnKeyUp(key)`, called from `WindowProc`
  for `WM_KEYDOWN` and `WM_KEYUP` (Escape still closes the window).
- **Hint:** `Hedgerow.Keys[key] = true;` / `false;`. In `WindowProc`: `OnKeyDown(static_cast<UINT8>(wParam));` after the
  Escape test, and a `case WM_KEYUP:` with `OnKeyUp(static_cast<UINT8>(wParam)); return 0;`.
- **Observable:** `void OnKeyDown(UINT8 key)` and `void OnKeyUp(UINT8 key)` in the Program section; `WindowProc` calls
  `OnKeyDown(static_cast<UINT8>(wParam))` in `case WM_KEYDOWN:` and has `case WM_KEYUP:` calling
  `OnKeyUp(static_cast<UINT8>(wParam))`. No visible change (the scripted SPACE press now sets `Hedgerow.Keys[VK_SPACE]`
  during frames 30–32; nothing reads it yet).

## shader
- **Task:** Write learnopengl's Shader for Direct3D 12: `struct Shader` holding a pipeline state object, `Use` (set it
  on the command list) and `Compile` (create it from a compiled vertex and pixel shader, with the states 2D sprites
  need).
- **Hint:** `Compile` fills a `D3D12_GRAPHICS_PIPELINE_STATE_DESC` like the earlier chapters' `LoadAssets`, with
  `Graphics.RootSignature`, the input layout POSITION (R32G32_FLOAT, offset 0) and TEXCOORD (R32G32_FLOAT, offset 8),
  blending on (SRC_ALPHA / INV_SRC_ALPHA), `DepthEnable = FALSE`, `CullMode = D3D12_CULL_MODE_NONE`, then
  `Graphics.Device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&shader.PipelineState))`.
- **Observable:** `struct Shader { ComPtr<ID3D12PipelineState> PipelineState; };`, `void Use(Shader& shader)` with
  `Graphics.CommandList->SetPipelineState(shader.PipelineState.Get())`, `void Compile(Shader& shader, ID3DBlob*
  vertexShader, ID3DBlob* pixelShader)` with the description above and `CreateGraphicsPipelineState`. Nothing calls
  them yet: no visible change.

## texture
- **Task:** Write learnopengl's Texture2D for Direct3D 12: the struct (its view's slot as `ID`, the size, the format,
  the texture and its upload buffer) and `Generate`, which creates the texture, records the copy of the pixels and
  creates the shader resource view.
- **Hint:** Like `LoadTexture` of the earlier chapters, with `Graphics.Device`, `Graphics.CommandList` and the SRV at
  `CD3DX12_CPU_DESCRIPTOR_HANDLE(Graphics.SrvHeap->GetCPUDescriptorHandleForHeapStart(), texture.ID,
  Graphics.SrvDescriptorSize)`. The upload buffer must live until the setup command list has executed: keep it in the
  struct.
- **Observable:** `struct Texture2D` with `unsigned int ID = 0`, `Width = 0, Height = 0`, `DXGI_FORMAT Internal_Format
  = DXGI_FORMAT_R8G8B8A8_UNORM`, `ComPtr<ID3D12Resource> Resource`, `UploadHeap`; `void Generate(Texture2D& texture,
  unsigned int width, unsigned int height, unsigned char* data)` with `CreateCommittedResource` (twice),
  `GetRequiredIntermediateSize`, `UpdateSubresources(Graphics.CommandList, …)`, the barrier, `CreateShaderResourceView`.
  No visible change.

## resource-manager
- **Task:** Write learnopengl's ResourceManager as two global maps and free functions: `LoadShader` / `GetShader`,
  `LoadTexture` / `GetTexture`, `ClearResources`, with the helpers `loadShaderFromFile` (D3DCompileFromFile of
  VSMain and PSMain) and `loadTextureFromFile` (stb_image); call `ClearResources()` in `OnDestroy`.
- **Hint:** A texture's ID is the next free heap slot: `texture.ID = Graphics.SrvCount++;`. On a compile error,
  `D3DCompileFromFile`'s last argument returns the messages (print them with `OutputDebugStringA`, then throw).
- **Observable:** `std::map<std::string, Shader> Shaders;`, `std::map<std::string, Texture2D> Textures;`,
  `Shader loadShaderFromFile(const wchar_t* shaderFile)` (`D3DCompileFromFile(shaderFile, nullptr, nullptr, "VSMain",
  "vs_5_0", …)` and `"PSMain", "ps_5_0"`, then `Compile(shader, vertexShader.Get(), pixelShader.Get())`),
  `Texture2D loadTextureFromFile(const char* file, bool alpha)` (`texture.ID = Graphics.SrvCount++`,
  `stbi_load(file, &width, &height, &nrChannels, 4)`, `Generate`, `stbi_image_free`), `Shader LoadShader(const wchar_t*
  shaderFile, std::string name)`, `Shader& GetShader(std::string name)`, `Texture2D LoadTexture(const char* file, bool
  alpha, std::string name)`, `Texture2D& GetTexture(std::string name)`, `void ClearResources()` (`Shaders.clear();
  Textures.clear();`); `ClearResources();` in `OnDestroy` after `WaitForPreviousFrame()`. No visible change.
