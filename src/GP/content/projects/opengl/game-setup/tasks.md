# Setting up (Hedgerow) – tasks (OpenGL)

learnopengl "2D Game / Setting up": `src/7.in_practice/3.2d_game/0.full_source/progress/2.program.cpp`, `2.game.h/.cpp`,
and the resource classes `resource_manager`, `shader`, `texture` of `0.full_source`. File: `main.cpp` only (the game's
shaders, textures and levels arrive in the next chapters).

**Fixed choices for the whole game (all chapters, all APIs – the Vulkan and DirectX 12 projects copy them):**
- The game is the course's own **Hedgerow** (never "Breakout"): window title `"Hedgerow"`, 800×600, not resizable,
  OpenGL 3.3 core, the global game object `Game Hedgerow;` (learnopengl: `Game Breakout(SCREEN_WIDTH, SCREEN_HEIGHT)`).
- **One `main.cpp`** (+ shader files `sprite.vs` / `sprite.fs` flat next to it like every course OpenGL project –
  learnopengl keeps them in `shaders/` –, `textures/`, `levels/`). learnopengl's classes become **plain structs and free
  functions**, sections in the order of learnopengl's files (Shader, Texture2D, ResourceManager, SpriteRenderer,
  GameObject, GameLevel, Game, program), each function defined before it is used, `main` last but the GLFW callbacks.
  Names follow learnopengl; a member function becomes a free function taking the struct by reference as its first
  parameter. A real project would split them into classes and files as learnopengl does (the text says so).
  | learnopengl | course |
  |---|---|
  | `class Shader` (`ID`, `Use()`, `Compile(…)`, `SetInteger/SetVector3f/SetMatrix4(name, value, useShader = false)`, private `checkCompileErrors`) | `struct Shader { unsigned int ID = 0; };`, `void Use(Shader&)`, `void Compile(Shader&, const char* vertexSource, const char* fragmentSource, const char* geometrySource = nullptr)`, `void SetInteger(Shader&, const char* name, int value, bool useShader = false)`, `SetVector3f(Shader&, const char*, const glm::vec3&, bool = false)`, `SetMatrix4(Shader&, const char*, const glm::mat4&, bool = false)`, `void checkCompileErrors(unsigned int object, std::string type)` (more setters are added when a chapter needs them) |
  | `class Texture2D` (constructor = defaults + glGenTextures, `Generate`, `Bind`) | `struct Texture2D { ID, Width, Height, Internal_Format = GL_RGB, Image_Format = GL_RGB, Wrap_S/T = GL_REPEAT, Filter_Min/Max = GL_LINEAR }`, `void Generate(Texture2D&, unsigned int width, unsigned int height, unsigned char* data)`; `glGenTextures` moves into `loadTextureFromFile`; no `Bind` (sprites bind the texture ID) |
  | `class ResourceManager` (static maps and functions) | globals `std::map<std::string, Shader> Shaders; std::map<std::string, Texture2D> Textures;`, `Shader LoadShader(vShaderFile, fShaderFile, gShaderFile, std::string name)`, `Shader& GetShader(std::string name)`, `Texture2D LoadTexture(const char* file, bool alpha, std::string name)`, `Texture2D& GetTexture(std::string name)`, `void ClearResources()` (learnopengl's `Clear`), `loadShaderFromFile`, `loadTextureFromFile` |
  | `class Game` (`State`, `Keys[1024]`, `Width`, `Height`, `Init/ProcessInput/Update/Render`) | `enum GameState { GAME_ACTIVE, GAME_MENU, GAME_WIN };`, `struct Game { GameState State = GAME_ACTIVE; bool Keys[1024] = {}; unsigned int Width = SCREEN_WIDTH, Height = SCREEN_HEIGHT; };` (the next chapters add fields), `void Init(Game&)`, `void ProcessInput(Game&, float dt)`, `void Update(Game&, float dt)`, `void Render(Game&)` |
  (`GetShader`/`GetTexture` return references so `Use(GetShader("sprite"))` works on the stored shader; learnopengl
  returns copies, which only works because its `Use()` is a member function.)
- **Coordinates:** the game's projection is `glm::ortho(0.0f, 800.0f, 600.0f, 0.0f, -1.0f, 1.0f)` – pixels from the
  **top-left**, y down. Textures are **not flipped** on load (stb_image's first row is the image's top, which lands at
  the sprite's top with this projection and the sprite quad's texcoords).
- **Deterministic time.** The loop is learnopengl's: `glfwGetTime()` is read at the top of each iteration, *then*
  `glfwPollEvents()`, then `ProcessInput(Hedgerow, deltaTime)`, `Update(Hedgerow, deltaTime)`, clear (black),
  `Render(Hedgerow)`, `glfwSwapBuffers`. Frame n of the loop (n = 0, 1, 2 …) sees **glfwGetTime() = n / 60** (so
  deltaTime = 0 in frame 0 and exactly 1/60 after that) – in the app's simulator (it runs the loop t × 60 times to
  show time t) and in verify.sh, which preloads `src/GP/verify/fixedtime.c` into every project that calls
  `glfwSetKeyCallback`: glfwGetTime() = (number of glfwPollEvents calls so far) / 60, frozen at `VERIFY_T` (default
  1.0 s) so the screenshot shows the state at 1 s. DirectX 12 counts frames the same way (its writer explains how).
- **Input.** No key is pressed, except **SPACE: pressed at t = 0.5 s, released at t = 0.55 s**, delivered through the
  program's key callback (GLFW: the function given to `glfwSetKeyCallback`, called as `key_callback(window,
  GLFW_KEY_SPACE, scancode, GLFW_PRESS, 0)` and then `…GLFW_RELEASE…`; DirectX 12: the sample framework's
  `OnKeyDown(VK_SPACE)` / `OnKeyUp`). Exactly: the press is delivered inside the `glfwPollEvents()` call of frame 30
  (the frame whose glfwGetTime() read 30/60), after the real events, so `ProcessInput` of frame 30 sees
  `Keys[GLFW_KEY_SPACE] == true`; the release inside frame 33's poll (`ProcessInput` of frames 30, 31, 32 see it held).
  The paddle is never moved (A/D are never pressed). This matters from the `ball` chapter on (the ball leaves the
  paddle at 0.5 s); until `levels` nothing reads SPACE.
- The game's numbers are learnopengl's (paddle 100×20 at the bottom centre, 500 px/s; ball radius 12.5, velocity
  (100, -350); level in the top half; brick colours …) – see `levels`.

**Picture of every state of this chapter:** black (0, 0, 0) everywhere – learnopengl's "Setting up" draws nothing.
All tasks are checked in the code. Nothing is printed.

## `game-struct`
- **Task:** Add the game's state – `enum GameState` and `struct Game` (State, Keys[1024], Width, Height) –, the global `Game Hedgerow;` and the four empty game functions `Init`, `ProcessInput`, `Update`, `Render`; call `Init` before the render loop and `Render` after the clear.
- **Hint:** learnopengl's class Game as a struct with default values (`GameState State = GAME_ACTIVE; bool Keys[1024] = {}; unsigned int Width = SCREEN_WIDTH, Height = SCREEN_HEIGHT;`); each member function becomes a free function taking `Game& game`.
- **When done:** `enum GameState { GAME_ACTIVE, GAME_MENU, GAME_WIN };`, `struct Game` with exactly those four
  fields and defaults, `Game Hedgerow;`, `void Init(Game& game)`, `void ProcessInput(Game& game, float dt)`, `void
  Update(Game& game, float dt)`, `void Render(Game& game)` (empty bodies); in `main` `Init(Hedgerow);` after the OpenGL
  configuration and `Render(Hedgerow);` after `glClear(GL_COLOR_BUFFER_BIT);`. No visible change.

## `delta-time`
- **Task:** Measure the time each frame takes (deltaTime) at the top of the loop and pass it to `ProcessInput` and `Update`, called after polling the events.
- **Hint:** `float deltaTime = 0.0f; float lastFrame = 0.0f;` before the loop; in it `float currentFrame = static_cast<float>(glfwGetTime()); deltaTime = currentFrame - lastFrame; lastFrame = currentFrame;` before `glfwPollEvents()`.
- **When done:** `float deltaTime = 0.0f;` / `float lastFrame = 0.0f;` before the loop; the three delta lines
  **before** `glfwPollEvents();` in the loop; `ProcessInput(Hedgerow, deltaTime);` and `Update(Hedgerow, deltaTime);`
  after it, before the clear. No visible change.

## `key-callback`
- **Task:** Store the keyboard state in `Hedgerow.Keys` with a GLFW key callback (Escape closes the window), and register it.
- **Hint:** `void key_callback(GLFWwindow* window, int key, int scancode, int action, int mode)`: `GLFW_PRESS` sets `Hedgerow.Keys[key] = true`, `GLFW_RELEASE` sets it false (only for 0 ≤ key < 1024); `glfwSetKeyCallback(window, key_callback);` after GLAD.
- **When done:** the declaration of `key_callback` with the GLFW callbacks, `glfwSetKeyCallback(window, key_callback);`
  before `glfwSetFramebufferSizeCallback`, and learnopengl's body (Escape + `GLFW_PRESS` → `glfwSetWindowShouldClose(window,
  true)`; `if (key >= 0 && key < 1024)` press/release into `Hedgerow.Keys[key]`). No visible change. (From now on
  verify.sh runs the project with the fixed-time shim; the scripted SPACE press sets `Hedgerow.Keys[GLFW_KEY_SPACE]`
  during frames 30–32, which nothing reads yet.)

## `shader`
- **Task:** Write learnopengl's Shader as a struct with free functions: `struct Shader { unsigned int ID; }`, `Use`, `checkCompileErrors`, `Compile` (vertex, fragment and an optional geometry shader) and the uniform setters `SetInteger`, `SetVector3f`, `SetMatrix4`.
- **Hint:** `Compile` is learnopengl's `Shader::Compile` with `shader.ID` instead of `this->ID`; each setter calls `Use(shader)` first when `useShader` is true, then `glUniform…(glGetUniformLocation(shader.ID, name), …)`.
- **When done:** `struct Shader { unsigned int ID = 0; };`; `void Use(Shader& shader)` (`glUseProgram(shader.ID)`);
  `void checkCompileErrors(unsigned int object, std::string type)` (GL_COMPILE_STATUS / GL_LINK_STATUS, learnopengl's
  messages); `void Compile(Shader& shader, const char* vertexSource, const char* fragmentSource, const char*
  geometrySource = nullptr)` (glCreateShader / glShaderSource / glCompileShader for GL_VERTEX_SHADER,
  GL_FRAGMENT_SHADER and, if given, GL_GEOMETRY_SHADER; `shader.ID = glCreateProgram()`, attach, link, check, delete the
  shaders); `SetInteger` (glUniform1i), `SetVector3f` (glUniform3f), `SetMatrix4` (glUniformMatrix4fv with
  `glm::value_ptr`). Nothing calls them yet: no visible change.

## `texture`
- **Task:** Write learnopengl's Texture2D as a struct with its settings and the function `Generate`, which uploads image data with those settings.
- **Hint:** Defaults as learnopengl's constructor: `Internal_Format`/`Image_Format` GL_RGB, `Wrap_S`/`Wrap_T` GL_REPEAT, `Filter_Min`/`Filter_Max` GL_LINEAR. `Generate`: bind, `glTexImage2D(GL_TEXTURE_2D, 0, texture.Internal_Format, width, height, 0, texture.Image_Format, GL_UNSIGNED_BYTE, data)`, the four parameters, unbind.
- **When done:** `struct Texture2D` with `ID = 0`, `Width = 0, Height = 0`, `Internal_Format = GL_RGB`, `Image_Format =
  GL_RGB`, `Wrap_S = GL_REPEAT`, `Wrap_T = GL_REPEAT`, `Filter_Min = GL_LINEAR`, `Filter_Max = GL_LINEAR`; `void
  Generate(Texture2D& texture, unsigned int width, unsigned int height, unsigned char* data)` as described. No visible
  change.

## `resource-manager`
- **Task:** Write learnopengl's ResourceManager as two global maps and free functions: `LoadShader` / `GetShader`, `LoadTexture` / `GetTexture`, `ClearResources`, with the helpers `loadShaderFromFile` (reads the files with std::ifstream) and `loadTextureFromFile` (stb_image); call `ClearResources()` before `glfwTerminate()`.
- **Hint:** `std::map<std::string, Shader> Shaders; std::map<std::string, Texture2D> Textures;`. `LoadTexture(file, alpha, name)`: with alpha the formats are GL_RGBA. `GetShader`/`GetTexture` return a reference to the stored object.
- **When done:** the two maps; `Shader loadShaderFromFile(const char *vShaderFile, const char *fShaderFile, const char
  *gShaderFile = nullptr)` (learnopengl's: `std::ifstream`, `std::stringstream << file.rdbuf()`, `.str()`, then
  `Compile(shader, vShaderCode, fShaderCode, gShaderFile != nullptr ? gShaderCode : nullptr)`); `Texture2D
  loadTextureFromFile(const char *file, bool alpha)` (`glGenTextures(1, &texture.ID)`, RGBA formats if alpha,
  `stbi_load(file, &width, &height, &nrChannels, 0)`, `Generate`, `stbi_image_free`); `Shader LoadShader(…, std::string
  name)` (`Shaders[name] = loadShaderFromFile(…)`), `Shader& GetShader(std::string name)`, `Texture2D LoadTexture(const
  char *file, bool alpha, std::string name)`, `Texture2D& GetTexture(std::string name)`, `void ClearResources()`
  (glDeleteProgram / glDeleteTextures over the maps); `ClearResources();` after the loop. No visible change.
