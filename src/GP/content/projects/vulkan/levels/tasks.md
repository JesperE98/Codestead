# Levels (Hedgerow) – tasks (Vulkan)

learnopengl "2D Game / Levels": `progress/4.game.h/.cpp` and `game_object.h/.cpp`, `game_level.h/.cpp` of
`0.full_source`. Files: `main.cpp` (= `rendering-sprites`' solution with TODOs), `shaders/sprite.vert`,
`shaders/sprite.frag`, and the course's art: `textures/background.png` (800×600 RGB, a garden at dusk: night sky with a
moon, hills, hedges), `textures/ball.png`, `textures/block.png` (128² RGB, a light tile the game tints),
`textures/block_solid.png` (128² RGB, stone), `textures/paddle.png` (512×128 RGBA, a wooden paddle with brass ends),
`levels/one.lvl … four.lvl` (the course's levels in learnopengl's format: 8 rows × 15 numbers; 0 = none, 1 = solid,
2–5 = colours). See `../game-setup/tasks.md` for the fixed choices of the whole game.

**Fixed choices (as the OpenGL chapter – `../../opengl/levels/tasks.md`):** learnopengl's GameObject and GameLevel as
structs and free functions: `struct GameObject { glm::vec2 Position = (0, 0), Size = (1, 1), Velocity = (0, 0);
glm::vec3 Color = (1, 1, 1); float Rotation = 0; bool IsSolid = false, Destroyed = false; … Sprite; };`,
`MakeGameObject` (learnopengl's constructor, with its default arguments), `DrawObject(GameObject&, SpriteRenderer&)`,
`struct GameLevel { std::vector<GameObject> Bricks; };`, `LoadLevel(GameLevel&, const char* file, unsigned int
levelWidth, unsigned int levelHeight)` (std::ifstream, std::getline, std::istringstream >> tileCode),
`InitLevel(GameLevel&, std::vector<std::vector<unsigned int>> tileData, …)` (learnopengl's private `init`),
`DrawLevel(GameLevel&, SpriteRenderer&)` (range-for over `level.Bricks`, `if (!tile.Destroyed)`); `struct Game` gains
`std::vector<GameLevel> Levels; unsigned int Level = 0;`; the four levels in the order one … four in the **top half**
(`game.Height / 2`), level one shown; bricks 53.33 × **37.5** pixels (the course divides as floats; learnopengl's
integer division gives 37); learnopengl's colours (1 → (0.8, 0.8, 0.7) with `block_solid`, `IsSolid`; 2 → (0.2, 0.6,
1.0), 3 → (0.0, 0.7, 0.0), 4 → (0.8, 0.8, 0.4), 5 → (1.0, 0.5, 0.0) with `block`); the paddle `PLAYER_SIZE` (100, 20),
`PLAYER_VELOCITY` 500, the global `GameObject Player` at **(350, 580)**, moved by A/D (never pressed: the picture is
static); `Render` (inside `if (game.State == GAME_ACTIVE)`): background, level, paddle – 70 draws for level one. The
ball texture stays loaded but is no longer drawn.

**Vulkan choices:**
- `GameObject::Sprite` is the texture's **descriptor set**: `VkDescriptorSet Sprite = VK_NULL_HANDLE;` (OpenGL: the
  texture ID), and `MakeGameObject(glm::vec2 pos, glm::vec2 size, VkDescriptorSet sprite, glm::vec3 color =
  glm::vec3(1.0f), glm::vec2 velocity = glm::vec2(0.0f, 0.0f))`; the bricks get `GetTexture("block").DescriptorSet` /
  `GetTexture("block_solid").DescriptorSet`, the paddle `GetTexture("paddle").DescriptorSet`. Every brick's draw binds
  its texture's descriptor set (`DrawSprite`): 68 bricks, 2 textures, 70 `vkCmdDraw`s per frame.
- `LoadTexture(file, name)` has no `alpha` flag (see game-setup: every texture is RGBA; the RGB files get alpha 255).
- `Init` (where the textures and levels are loaded) is a member of the application class; `InitLevel`, `LoadLevel`,
  `DrawLevel`, `MakeGameObject`, `DrawObject`, `ProcessInput` and `Render` are free functions, as in OpenGL.

**Level one** (`levels/one.lvl`): rows 0–3 full rows of 5 (orange), 4 (yellow), 3 (green), 2 (blue); row 4 empty; row 5
`1 1 0 0 1 1 0 0 0 1 1 0 0 1 1` (8 solid stones); rows 6–7 empty: orange y 0..37.5, yellow 37.5..75, green 75..112.5,
blue 112.5..150, stones y 187.5..225 at columns 0, 1, 4, 5, 9, 10, 13, 14.

Named points (the OpenGL chapter's; from the top-left, 800×600, static; measured on lavapipe): **orange** (396,29),
**yellow** (396,66), **green** (396,104), **blue** (396,141), **gap** (400,170), **solid** (13,209), **row5-empty**
(133,206), **moon** (640,110), **sky** (200,250), **hills** (400,450), **paddle** (358,588), **beside-paddle**
(300,590), **ball** (350,400). Every named point equals OpenGL's in every state. The whole pictures are identical
except **1,886 pixels on the brick rows' edges at y = 37.5, 112.5 and 187.5** (the pixel rows 37, 112, 187): a brick
edge there runs exactly through the pixels' centres, and Vulkan's top-left rasterization rule (y down) gives those
pixels to the brick below, OpenGL's (y up) to the brick above (DirectX 12 decides like Vulkan).

**Start picture:** the end of `rendering-sprites` – the green ball rotated 45° on black: ball = 0,230,0, hills (400,450)
= 0,215,0, everything else 0,0,0.

## background
- **Task:** Load the game's textures – `background` (textures/background.png), `block`, `block_solid` and `paddle` – and in `Render` draw the background over the whole window instead of the ball (only while the game is active).
- **Hint:** `DrawSprite(Renderer, GetTexture("background").DescriptorSet, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);` inside `if (game.State == GAME_ACTIVE)`.
- **When done:** four `LoadTexture` calls after the ball's (`"textures/background.png", "background"`,
  `"textures/block.png", "block"`, `"textures/block_solid.png", "block_solid"`, `"textures/paddle.png", "paddle"`);
  `Render` holds `if (game.State == GAME_ACTIVE) { DrawSprite(Renderer, GetTexture("background").DescriptorSet, …); }`
  (and TODOs for the level and the player) – the ball call is gone. **The garden at dusk fills the window**: orange =
  22,28,62, yellow = 25,29,63, green = 29,32,65, blue = 34,34,67 (the night sky getting lighter downwards), gap =
  38,37,69, solid = 45,40,72, row5-empty = 44,40,72, moon = 255,255,245, sky = 53,44,75, hills = 46,52,74, paddle =
  30,40,46, beside-paddle = 30,40,46, ball = 88,63,91. One draw; the descriptor pool now holds 5 of its 16 sets.

## game-object
- **Task:** Add learnopengl's GameObject as a struct (Position, Size, Velocity, Color, Rotation, IsSolid, Destroyed and the sprite's descriptor set), `MakeGameObject` (learnopengl's constructor) and `DrawObject`, which draws the object's sprite.
- **Hint:** `DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);`.
- **When done:** `struct GameObject` with the fields and defaults above and `VkDescriptorSet Sprite = VK_NULL_HANDLE;`,
  `GameObject MakeGameObject(glm::vec2 pos, glm::vec2 size, VkDescriptorSet sprite, glm::vec3 color = glm::vec3(1.0f),
  glm::vec2 velocity = glm::vec2(0.0f, 0.0f))`, `void DrawObject(GameObject& obj, SpriteRenderer& renderer)`. No
  visible change (the background).

## load-level
- **Task:** Add `struct GameLevel` (its Bricks), `LoadLevel`, which reads a level file line by line into rows of tile codes, and `InitLevel`, which turns the codes into bricks: one per tile, `unit_width` × `unit_height` big, solid stones for 1, tinted blocks for 2–5.
- **Hint:** `std::ifstream fstream(file)`, `while (std::getline(fstream, line))`, `std::istringstream sstream(line)`, `while (sstream >> tileCode) row.push_back(tileCode);`. `unit_width = levelWidth / static_cast<float>(width)`, the same for the height; position `(unit_width * x, unit_height * y)`.
- **When done:** `struct GameLevel { std::vector<GameObject> Bricks; };`, `void InitLevel(GameLevel& level,
  std::vector<std::vector<unsigned int>> tileData, unsigned int levelWidth, unsigned int levelHeight)` (learnopengl's
  loops: code 1 → `MakeGameObject(pos, size, GetTexture("block_solid").DescriptorSet, glm::vec3(0.8f, 0.8f, 0.7f))` with
  `obj.IsSolid = true`; code > 1 → the colour chain 2–5 and `MakeGameObject(pos, size, GetTexture("block").DescriptorSet,
  color)`; both `level.Bricks.push_back(…)`), `void LoadLevel(GameLevel& level, const char* file, unsigned int
  levelWidth, unsigned int levelHeight)` (clears `level.Bricks`, reads the file, calls `InitLevel` if there is data).
  No visible change (nothing loads a level yet).

## draw-level
- **Task:** Add `DrawLevel` (every brick that is not destroyed), give `Game` its `Levels` and current `Level`, load the four level files in `Init` into the top half of the window, and draw the current level after the background.
- **Hint:** `for (GameObject& tile : level.Bricks) if (!tile.Destroyed) DrawObject(tile, renderer);`. `GameLevel one; LoadLevel(one, "levels/one.lvl", game.Width, game.Height / 2);` … `game.Levels.push_back(one);` …, `game.Level = 0;`. In `Render`: `DrawLevel(game.Levels[game.Level], Renderer);`.
- **When done:** `void DrawLevel(GameLevel& level, SpriteRenderer& renderer)`; `std::vector<GameLevel> Levels;` and
  `unsigned int Level = 0;` in `struct Game`; in `Init` the four `LoadLevel` calls (one, two, three, four), four
  `push_back`s and `game.Level = 0;`; `DrawLevel(game.Levels[game.Level], Renderer);` after the background. **Level one
  appears in the top half** (69 draws): orange = 196,98,0, yellow = 157,157,78, green = 0,137,0, blue = 39,118,196 (each
  brick a block.png tile tinted with its colour: lighter and darker bevels around a flat middle), solid = 126,126,110
  (a stone); gap = 38,37,69, row5-empty = 44,40,72, sky = 53,44,75, hills = 46,52,74 and beside-paddle = 30,40,46
  unchanged; the moon is hidden behind the green row (moon = 0,120,0); no paddle yet (paddle = 30,40,46).

## player
- **Task:** Add the paddle: `PLAYER_SIZE` (100, 20) and `PLAYER_VELOCITY` (500), a global `GameObject Player` made in `Init` at the bottom centre with the paddle texture, drawn after the level; in `ProcessInput` move it with A and D while it stays inside the window.
- **Hint:** `glm::vec2 playerPos = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);`, `Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").DescriptorSet);`. `float velocity = PLAYER_VELOCITY * dt;` and `if (game.Keys[GLFW_KEY_A]) { if (Player.Position.x >= 0.0f) Player.Position.x -= velocity; }`, the same for D with `game.Width - Player.Size.x`.
- **When done:** `const glm::vec2 PLAYER_SIZE(100.0f, 20.0f);`, `const float PLAYER_VELOCITY(500.0f);`, `GameObject
  Player;` after `SpriteRenderer Renderer;`, the two lines in `Init`, learnopengl's A/D block inside `if (game.State ==
  GAME_ACTIVE)` in `ProcessInput`, `DrawObject(Player, Renderer);` after `DrawLevel`. **The wooden paddle appears at the
  bottom centre** (x 350..450, y 580..600; 70 draws): paddle = 214,170,72 (its brass end), beside-paddle = 30,40,46;
  everything else as after `draw-level`. (No key is pressed, so the paddle stays at (350, 580).)
