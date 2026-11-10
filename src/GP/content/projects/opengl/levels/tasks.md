# Levels (Hedgerow) – tasks (OpenGL)

learnopengl "2D Game / Levels": `progress/4.game.h/.cpp` and `game_object.h/.cpp`, `game_level.h/.cpp` of
`0.full_source`. Files: `main.cpp` (= `rendering-sprites`' solution with TODOs), `sprite.vs`, `sprite.fs`, and the
course's art: `textures/background.png` (800×600 RGB, a garden at dusk: night sky with a moon, hills, hedges),
`textures/ball.png`, `textures/block.png` (128² RGB, a light tile the game tints), `textures/block_solid.png` (128² RGB,
stone), `textures/paddle.png` (512×128 RGBA, a wooden paddle with brass ends), `levels/one.lvl … four.lvl` (the
course's levels in learnopengl's format: 8 rows × 15 numbers; 0 = none, 1 = solid, 2–5 = colours). See
`../game-setup/tasks.md` for the fixed choices of the whole game.

**Fixed choices (all APIs):**
- GameObject as a struct with learnopengl's default values and its texture as an ID:
  `struct GameObject { glm::vec2 Position = (0, 0), Size = (1, 1), Velocity = (0, 0); glm::vec3 Color = (1, 1, 1);
  float Rotation = 0; bool IsSolid = false, Destroyed = false; unsigned int Sprite = 0; };` (Vulkan/DirectX 12: Sprite is
  their texture's index/descriptor slot), learnopengl's constructor as `GameObject MakeGameObject(glm::vec2 pos,
  glm::vec2 size, unsigned int sprite, glm::vec3 color = glm::vec3(1.0f), glm::vec2 velocity = glm::vec2(0.0f, 0.0f))`,
  `GameObject::Draw` as `void DrawObject(GameObject& obj, SpriteRenderer& renderer)`.
- GameLevel: `struct GameLevel { std::vector<GameObject> Bricks; };`, `void LoadLevel(GameLevel& level, const char*
  file, unsigned int levelWidth, unsigned int levelHeight)` (std::ifstream, std::getline, std::istringstream >>
  tileCode), learnopengl's private `init` as `void InitLevel(GameLevel& level, std::vector<std::vector<unsigned int>>
  tileData, unsigned int levelWidth, unsigned int levelHeight)`, `void DrawLevel(GameLevel& level, SpriteRenderer&
  renderer)` (range-for over `level.Bricks`, `if (!tile.Destroyed)`). `IsCompleted` follows in a later chapter.
- `struct Game` gains `std::vector<GameLevel> Levels; unsigned int Level = 0;`; the four levels are loaded in the order
  one, two, three, four into the **top half** (`LoadLevel(one, "levels/one.lvl", game.Width, game.Height / 2)`), level
  one shown.
- Brick sizes: 800 / 15 = 53.33 × 300 / 8 = **37.5** pixels. **Deviation:** learnopengl computes `unit_height =
  levelHeight / height` in unsigned integers (300 / 8 = 37, rows 37 px, 4 px left over); the course divides as floats
  (`levelHeight / static_cast<float>(height)`), as the code clearly intends. All APIs use 37.5.
- Colours (learnopengl's): 1 → (0.8, 0.8, 0.7) with `block_solid.png`, `IsSolid = true`; 2 → (0.2, 0.6, 1.0),
  3 → (0.0, 0.7, 0.0), 4 → (0.8, 0.8, 0.4), 5 → (1.0, 0.5, 0.0) with `block.png`. block.png / block_solid.png /
  background.png are loaded without alpha (GL_RGB), paddle.png and ball.png with alpha.
- The paddle (learnopengl's player): `const glm::vec2 PLAYER_SIZE(100.0f, 20.0f); const float PLAYER_VELOCITY(500.0f);`,
  the global `GameObject Player;` at (Width / 2 − 50, Height − 20) = **(350, 580)**, size 100×20; A/D move it by
  `PLAYER_VELOCITY * dt` inside the window. No key is pressed (the scripted SPACE press is not read), so the picture
  is static.
- Draw order in `Render` (inside `if (game.State == GAME_ACTIVE)`): background (0, 0, 800×600), the level, the paddle –
  70 draws per frame for level one (1 + 68 bricks + 1). The ball texture stays loaded (the ball chapter uses it) but
  is no longer drawn.

**Level one** (`levels/one.lvl`): rows 0–3 full rows of 5 (orange), 4 (yellow), 3 (green), 2 (blue); row 4 empty; row 5
`1 1 0 0 1 1 0 0 0 1 1 0 0 1 1` (8 solid stones); rows 6–7 empty. So: orange y 0..37.5, yellow 37.5..75, green
75..112.5, blue 112.5..150, solid stones y 187.5..225 at columns 0, 1, 4, 5, 9, 10, 13, 14.

Named points (from the top-left, 800×600, static; measured with Mesa/llvmpipe): **orange** (396,29), **yellow**
(396,66), **green** (396,104), **blue** (396,141) – flat spots on the bricks of column 7 in rows 0–3; **gap** (400,170)
– row 4 (empty); **solid** (13,209) – the stone at row 5, column 0; **row5-empty** (133,206) – row 5, column 2 (no
brick); **moon** (640,110); **sky** (200,250); **hills** (400,450); **paddle** (358,588) – the paddle's left brass end;
**beside-paddle** (300,590); **ball** (350,400) – where the ball sprite was.

**Start picture:** the end of `rendering-sprites` – the green ball rotated 45° on black: ball = 0,230,0,
hills (400,450) = 0,215,0, everything else 0,0,0.

## `background`
- **Task:** Load the game's textures – `background` (textures/background.png), `block`, `block_solid` (no alpha) and `paddle` (with alpha) – and in `Render` draw the background over the whole window instead of the ball (only while the game is active).
- **Hint:** `DrawSprite(Renderer, GetTexture("background").ID, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);` inside `if (game.State == GAME_ACTIVE)`.
- **When done:** four `LoadTexture` calls after the ball's (`"textures/background.png", false, "background"`,
  `"textures/block.png", false, "block"`, `"textures/block_solid.png", false, "block_solid"`, `"textures/paddle.png",
  true, "paddle"`); `Render` holds `if (game.State == GAME_ACTIVE) { DrawSprite(… "background" …); }` (and TODOs for the
  level and the player) – the ball call is gone. **The garden at dusk fills the window**: orange = 22,28,62, yellow =
  25,29,63, green = 29,32,65, blue = 34,34,67 (the night sky getting lighter downwards), gap = 38,37,69, solid =
  45,40,72, row5-empty = 44,40,72, moon = 255,255,245, sky = 53,44,75, hills = 46,52,74, paddle = 30,40,46,
  beside-paddle = 30,40,46, ball = 88,63,91. One draw.

## `game-object`
- **Task:** Add learnopengl's GameObject as a struct (Position, Size, Velocity, Color, Rotation, IsSolid, Destroyed and the sprite's texture ID), `MakeGameObject` (learnopengl's constructor) and `DrawObject`, which draws the object's sprite.
- **Hint:** `DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);`.
- **When done:** `struct GameObject` with the fields and defaults above, `GameObject MakeGameObject(glm::vec2 pos,
  glm::vec2 size, unsigned int sprite, glm::vec3 color = glm::vec3(1.0f), glm::vec2 velocity = glm::vec2(0.0f, 0.0f))`,
  `void DrawObject(GameObject& obj, SpriteRenderer& renderer)`. No visible change (the background).

## `load-level`
- **Task:** Add `struct GameLevel` (its Bricks), `LoadLevel`, which reads a level file line by line into rows of tile codes, and `InitLevel`, which turns the codes into bricks: one per tile, `unit_width` × `unit_height` big, solid stones for 1, tinted blocks for 2–5.
- **Hint:** `std::ifstream fstream(file)`, `while (std::getline(fstream, line))`, `std::istringstream sstream(line)`, `while (sstream >> tileCode) row.push_back(tileCode);`. `unit_width = levelWidth / static_cast<float>(width)`, the same for the height; position `(unit_width * x, unit_height * y)`.
- **When done:** `struct GameLevel { std::vector<GameObject> Bricks; };`, `void InitLevel(GameLevel& level,
  std::vector<std::vector<unsigned int>> tileData, unsigned int levelWidth, unsigned int levelHeight)` (learnopengl's
  loops: code 1 → `MakeGameObject(pos, size, GetTexture("block_solid").ID, glm::vec3(0.8f, 0.8f, 0.7f))` with
  `obj.IsSolid = true`; code > 1 → the colour chain 2–5 and `MakeGameObject(pos, size, GetTexture("block").ID, color)`;
  both `level.Bricks.push_back(…)`), `void LoadLevel(GameLevel& level, const char *file, unsigned int levelWidth,
  unsigned int levelHeight)` (clears `level.Bricks`, reads the file, calls `InitLevel` if there is data). No visible
  change (nothing loads a level yet).

## `draw-level`
- **Task:** Add `DrawLevel` (every brick that is not destroyed), give `Game` its `Levels` and current `Level`, load the four level files in `Init` into the top half of the window, and draw the current level after the background.
- **Hint:** `for (GameObject& tile : level.Bricks) if (!tile.Destroyed) DrawObject(tile, renderer);`. `GameLevel one; LoadLevel(one, "levels/one.lvl", game.Width, game.Height / 2);` … `game.Levels.push_back(one);` …, `game.Level = 0;`. In `Render`: `DrawLevel(game.Levels[game.Level], Renderer);`.
- **When done:** `void DrawLevel(GameLevel& level, SpriteRenderer& renderer)`; `std::vector<GameLevel> Levels;` and
  `unsigned int Level = 0;` in `struct Game`; in `Init` the four `LoadLevel` calls (one, two, three, four), four
  `push_back`s and `game.Level = 0;`; `DrawLevel(game.Levels[game.Level], Renderer);` after the background.
  **Level one appears in the top half** (69 draws): orange = 196,98,0, yellow = 157,157,78, green = 0,137,0, blue =
  39,118,196 (each brick a block.png tile tinted with its colour: lighter and darker bevels around a flat middle),
  solid = 126,126,110 (a stone); gap = 38,37,69, row5-empty = 44,40,72, sky = 53,44,75, hills = 46,52,74 and
  beside-paddle = 30,40,46 unchanged; the moon is hidden behind the green row (moon = 0,120,0); no paddle yet
  (paddle = 30,40,46).

## `player`
- **Task:** Add the paddle: `PLAYER_SIZE` (100, 20) and `PLAYER_VELOCITY` (500), a global `GameObject Player` made in `Init` at the bottom centre with the paddle texture, drawn after the level; in `ProcessInput` move it with A and D while it stays inside the window.
- **Hint:** `glm::vec2 playerPos = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);`, `Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").ID);`. `float velocity = PLAYER_VELOCITY * dt;` and `if (game.Keys[GLFW_KEY_A]) { if (Player.Position.x >= 0.0f) Player.Position.x -= velocity; }`, the same for D with `game.Width - Player.Size.x`.
- **When done:** `const glm::vec2 PLAYER_SIZE(100.0f, 20.0f);`, `const float PLAYER_VELOCITY(500.0f);`, `GameObject
  Player;`, the two lines in `Init`, learnopengl's A/D block inside `if (game.State == GAME_ACTIVE)` in `ProcessInput`,
  `DrawObject(Player, Renderer);` after `DrawLevel`. **The wooden paddle appears at the bottom centre** (x 350..450,
  y 580..600; 70 draws): paddle = 214,170,72 (its brass end), beside-paddle = 30,40,46; everything else as after
  `draw-level`. (No key is pressed, so the paddle stays at (350, 580).)
