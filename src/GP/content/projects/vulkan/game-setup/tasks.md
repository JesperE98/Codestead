# Setting up (Hedgerow) – tasks (Vulkan)

learnopengl "2D Game / Setting up": `src/7.in_practice/3.2d_game/0.full_source/progress/2.program.cpp`, `2.game.h/.cpp`,
and the resource classes `resource_manager`, `shader`, `texture` of `0.full_source`. File: `main.cpp` only (the
game's shaders, textures and levels arrive in the next chapters).

**Fixed choices for the whole game (as the OpenGL chapter – see `../../opengl/game-setup/tasks.md`):** the course's
own game **Hedgerow** (never "Breakout"): window title `"Hedgerow"`, 800×600, not resizable; the global `Game
Hedgerow;`; learnopengl's numbers; the game's coordinates are pixels from the **top-left**, y down; textures are not
flipped on load. **Deterministic time:** learnopengl's loop – `glfwGetTime()` read at the top of each iteration, then
`glfwPollEvents()`, `ProcessInput(Hedgerow, deltaTime)`, `Update(Hedgerow, deltaTime)`, then the frame
(`drawFrame()`, whose `recordCommandBuffer` calls `Render`). Frame n of the loop (n = 0, 1, 2 …) sees **glfwGetTime() =
n / 60** (deltaTime 0 in frame 0, exactly 1/60 after that) – in the app's simulator and in verify.sh, which preloads
`src/GP/verify/fixedtime.c` into every project that calls `glfwSetKeyCallback` (glfwGetTime() = number of
glfwPollEvents calls so far / 60, frozen at `VERIFY_T`, default 1 s). **Input:** no key is pressed, except **SPACE,
pressed at t = 0.5 s and released at t = 0.55 s**, delivered through the key callback given to `glfwSetKeyCallback`
(`key_callback(window, GLFW_KEY_SPACE, scancode, GLFW_PRESS, 0)` inside the `glfwPollEvents()` of frame 30, the release
inside frame 33's): `ProcessInput` of frames 30, 31, 32 sees `Keys[GLFW_KEY_SPACE] == true`. The paddle is never
moved. Until `levels` nothing reads SPACE; from `ball` on it starts the ball.

**Vulkan choices for the whole game:**
- **One `main.cpp`** (+ `shaders/sprite.vert/.frag` built to `sprite.vert.spv` / `sprite.frag.spv`, `textures/`,
  `levels/`). The Vulkan code stays vulkan-tutorial's `HelloTriangleApplication`; learnopengl's game classes become
  **plain structs and free functions next to it** (before the class), with learnopengl's names, exactly like the
  OpenGL chapter – except the functions that need the Vulkan device, which are **member functions of the application
  class**: `Init(Game&)` (it loads shaders and textures), `LoadShader`, `LoadTexture`, `loadTextureFromFile`,
  `ClearResources` and, in `rendering-sprites`, `InitRenderData`. A real project would split everything into classes
  and files as learnopengl does.
  | learnopengl | Vulkan course |
  |---|---|
  | `class Shader` (a compiled program) | the **graphics pipeline** made from the two SPIR-V files: `VkPipeline`, created with the course's `createPipeline(vertFile, fragFile, pipeline)` helper (already in the project) |
  | `class Texture2D` (ID, size, wrap/filter settings) | `struct Texture2D { VkImage Image; VkDeviceMemory Memory; VkImageView View; VkDescriptorSet DescriptorSet; unsigned int Width, Height; }` – the descriptor set (uniform buffer at binding 0 + this texture at binding 1) is what a draw binds, Vulkan's `glBindTexture`; one shared sampler (`textureSampler`: learnopengl's defaults REPEAT, LINEAR, no anisotropy) |
  | `class ResourceManager` | globals `std::map<std::string, VkPipeline> Shaders; std::map<std::string, Texture2D> Textures;`, free `VkPipeline& GetShader(std::string name)` / `Texture2D& GetTexture(std::string name)`, members `VkPipeline LoadShader(const char* vShaderFile, const char* fShaderFile, std::string name)` (learnopengl's third parameter, the geometry shader, is left out: the game never uses one), `Texture2D LoadTexture(const char* file, std::string name)`, `Texture2D loadTextureFromFile(const char* file)`, `void ClearResources()` (learnopengl's `Clear`; called in `cleanup()`) |
  | `class Game` | `enum GameState { GAME_ACTIVE, GAME_MENU, GAME_WIN };`, `struct Game { GameState State = GAME_ACTIVE; bool Keys[1024] = {}; unsigned int Width = WIDTH, Height = HEIGHT; };`, free `ProcessInput(Game&, float dt)`, `Update(Game&, float dt)`, `Render(Game&)`; member `Init(Game&)`, called at the end of `initVulkan()` (after the descriptor pool exists) |
- **No `alpha` parameter for textures:** learnopengl's `LoadTexture(file, alpha, name)` picks GL_RGB or GL_RGBA. Vulkan
  devices need not support sampling 3-channel images, so every texture is uploaded as `VK_FORMAT_R8G8B8A8_UNORM`
  (stb_image with `STBI_rgb_alpha` gives an RGB file an alpha of 255) – there is nothing to choose.
- The **projection** (`rendering-sprites`) goes into the uniform buffer in `updateUniformBuffer()` (each frame, like
  every Vulkan chapter): `glm::ortho(0.0f, 800.0f, 0.0f, 600.0f, -1.0f, 1.0f)` – learnopengl writes `glm::ortho(0, 800,
  600, 0, -1, 1)` to turn OpenGL's y-up clip space into the game's y down; Vulkan's clip space y already points down,
  so bottom = 0, top = 600 (no `proj[1][1] *= -1` either). `GLM_FORCE_DEPTH_ZERO_TO_ONE` maps z 0 to 0.5.
- No depth buffer (2D: the render pass has only the colour attachment); no culling; alpha blending (SRC_ALPHA /
  ONE_MINUS_SRC_ALPHA) in the pipeline, learnopengl's `glEnable(GL_BLEND)`.
- The **key callback** is a free function `key_callback` registered with `glfwSetKeyCallback(window, key_callback)`
  in `initWindow()`; it also closes the window on Escape (learnopengl's).

**Picture of every state of this chapter:** black (0, 0, 0) everywhere – learnopengl's "Setting up" draws nothing. All
tasks are checked in the code. Nothing is printed, no validation message.

## game-struct
- **Task:** Add the game's state – `enum GameState` and `struct Game` (State, Keys[1024], Width, Height) –, the global `Game Hedgerow;`, the free game functions `ProcessInput`, `Update`, `Render` (empty) and the member function `Init` (empty); call `Init` at the end of `initVulkan()` and `Render` in `recordCommandBuffer()` inside the render pass.
- **Hint:** learnopengl's class Game as a struct with default values (`GameState State = GAME_ACTIVE; bool Keys[1024] = {}; unsigned int Width = WIDTH, Height = HEIGHT;`); each of its member functions becomes a free function taking `Game& game` – only `Init` lives in the application class, because loading resources needs the device.
- **When done:** before the class: `enum GameState { GAME_ACTIVE, GAME_MENU, GAME_WIN };`, `struct Game` with those
  four fields and defaults, `Game Hedgerow;`, `void ProcessInput(Game& game, float dt)`, `void Update(Game& game, float
  dt)`, `void Render(Game& game)` (empty bodies); in the class `void Init(Game& game)` (empty); in `initVulkan()` after
  `createDescriptorPool();`: `Init(Hedgerow);`; in `recordCommandBuffer()` after `vkCmdSetScissor`, before
  `vkCmdEndRenderPass`: `Render(Hedgerow);`. No visible change.

## delta-time
- **Task:** Measure the time each frame takes (deltaTime) at the top of the loop in `mainLoop()` and pass it to `ProcessInput` and `Update`, called after polling the events and before drawing the frame.
- **Hint:** `float deltaTime = 0.0f; float lastFrame = 0.0f;` before the loop; in it `float currentFrame = static_cast<float>(glfwGetTime()); deltaTime = currentFrame - lastFrame; lastFrame = currentFrame;` before `glfwPollEvents()`.
- **When done:** `float deltaTime = 0.0f;` / `float lastFrame = 0.0f;` before the `while`; the three delta lines
  **before** `glfwPollEvents();`; `ProcessInput(Hedgerow, deltaTime);` and `Update(Hedgerow, deltaTime);` after it,
  then `drawFrame();`. No visible change.

## key-callback
- **Task:** Store the keyboard state in `Hedgerow.Keys` with a GLFW key callback (Escape closes the window), and register it in `initWindow()`.
- **Hint:** `void key_callback(GLFWwindow* window, int key, int scancode, int action, int mode)`: `GLFW_PRESS` sets `Hedgerow.Keys[key] = true`, `GLFW_RELEASE` sets it false (only for 0 ≤ key < 1024); `glfwSetKeyCallback(window, key_callback);` after `glfwCreateWindow`.
- **When done:** the free function `key_callback` (learnopengl's body: Escape + `GLFW_PRESS` →
  `glfwSetWindowShouldClose(window, true)`; `if (key >= 0 && key < 1024)` press/release into `Hedgerow.Keys[key]`) before
  the class, and `glfwSetKeyCallback(window, key_callback);` right after `glfwCreateWindow` in `initWindow()`. No
  visible change. (From now on verify.sh runs the project with the fixed-time shim; the scripted SPACE press sets
  `Hedgerow.Keys[GLFW_KEY_SPACE]` during frames 30–32, which nothing reads yet.)

## texture
- **Task:** Write learnopengl's Texture2D for Vulkan: the struct (image, memory, view, descriptor set, width, height) and the member function `loadTextureFromFile`, which loads an image file into such a texture.
- **Hint:** `stbi_load(file, &width, &height, &nrChannels, STBI_rgb_alpha)`; then the course's `createTextureImage(data, width, height, texture.Image, texture.Memory)` (staging buffer, copy, layout transitions), `stbi_image_free`, `texture.View = createImageView(texture.Image, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT)` and `createDescriptorSet(texture.View, textureSampler, texture.DescriptorSet)`.
- **When done:** `struct Texture2D { VkImage Image = VK_NULL_HANDLE; VkDeviceMemory Memory = VK_NULL_HANDLE; VkImageView
  View = VK_NULL_HANDLE; VkDescriptorSet DescriptorSet = VK_NULL_HANDLE; unsigned int Width = 0, Height = 0; };`; the
  member `Texture2D loadTextureFromFile(const char* file)` as described (throws "failed to load texture image!" when
  stb_image fails). Nothing calls it yet: no visible change.

## resource-manager
- **Task:** Write learnopengl's ResourceManager: the two global maps `Shaders` (name → pipeline) and `Textures`, the free functions `GetShader` / `GetTexture`, and the member functions `LoadShader`, `LoadTexture` and `ClearResources`; call `ClearResources()` in `cleanup()`.
- **Hint:** `LoadShader(vShaderFile, fShaderFile, name)`: `createPipeline(vShaderFile, fShaderFile, Shaders[name]);` – in Vulkan the "shader" learnopengl compiles is the pipeline built from the SPIR-V files. `LoadTexture(file, name)`: `Textures[name] = loadTextureFromFile(file);`. `ClearResources()` destroys every pipeline and every texture's view, image and memory (the descriptor sets go with the pool). `GetShader`/`GetTexture` return references to the stored objects.
- **When done:** `std::map<std::string, VkPipeline> Shaders;` and `std::map<std::string, Texture2D> Textures;`;
  `VkPipeline& GetShader(std::string name)` and `Texture2D& GetTexture(std::string name)` (`return Shaders[name];` /
  `return Textures[name];`); members `VkPipeline LoadShader(const char* vShaderFile, const char* fShaderFile,
  std::string name)`, `Texture2D LoadTexture(const char* file, std::string name)`, `void ClearResources()`
  (`vkDestroyPipeline` for each of `Shaders`; `vkDestroyImageView`, `vkDestroyImage`, `vkFreeMemory` for each of
  `Textures`); in `cleanup()` `ClearResources();` before the uniform buffer is destroyed. No visible change.
