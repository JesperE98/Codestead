# Levels (Hedgerow) – tasks (DirectX 12)

learnopengl "2D Game / Levels": `progress/4.game.h/.cpp` and `game_object.h/.cpp`, `game_level.h/.cpp` of
`0.full_source`. Files: `main.cpp` (= `rendering-sprites`' solution with TODOs), `sprite.hlsl`, and the course's art:
`textures/background.png` (800×600 RGB, a garden at dusk), `textures/ball.png`, `textures/block.png` (128² RGB, a light
tile the game tints), `textures/block_solid.png` (128² RGB, stone), `textures/paddle.png` (512×128 RGBA),
`levels/one.lvl … four.lvl` (learnopengl's format: 8 rows × 15 numbers; 0 = none, 1 = solid, 2–5 = colours). See
`../game-setup/tasks.md` for the fixed choices of the whole game.

**The same as OpenGL** (projects/opengl/levels/tasks.md – structs, functions, numbers, task ids):
- `struct GameObject { XMFLOAT2 Position = (0, 0), Size = (1, 1), Velocity = (0, 0); XMFLOAT3 Color = (1, 1, 1); float
  Rotation = 0.0f; bool IsSolid = false; bool Destroyed = false; unsigned int Sprite = 0; };` – `Sprite` is the
  texture's ID, i.e. **its shader resource view's slot in the heap**; `GameObject MakeGameObject(XMFLOAT2 pos, XMFLOAT2
  size, unsigned int sprite, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f), XMFLOAT2 velocity = XMFLOAT2(0.0f, 0.0f))`,
  `void DrawObject(GameObject& obj, SpriteRenderer& renderer)`.
- `struct GameLevel { std::vector<GameObject> Bricks; };`, `void InitLevel(GameLevel& level,
  std::vector<std::vector<unsigned int>> tileData, unsigned int levelWidth, unsigned int levelHeight)`, `void
  LoadLevel(GameLevel& level, const char *file, unsigned int levelWidth, unsigned int levelHeight)` (std::ifstream,
  std::getline, std::istringstream >> tileCode), `void DrawLevel(GameLevel& level, SpriteRenderer& renderer)`
  (range-for over `level.Bricks`, `if (!tile.Destroyed)`).
- `struct Game` gains `std::vector<GameLevel> Levels; unsigned int Level = 0;` (after `Width, Height`); the four levels
  one … four loaded into the top half (`LoadLevel(one, "levels/one.lvl", game.Width, game.Height / 2)`), level one
  shown. Bricks 800 / 15 = 53.33 × 300 / 8 = **37.5** pixels (the course divides as floats – learnopengl's unsigned
  division gives 37; OpenGL's deviation, kept in every API).
- learnopengl's colours, `block_solid.png` with (0.8, 0.8, 0.7) and `IsSolid = true` for 1, `block.png` tinted for
  2–5; background, block, block_solid loaded with `alpha = false`, paddle and ball with `true` (in Direct3D 12 every
  image is RGBA: an RGB file gets alpha 255).
- The paddle: `const XMFLOAT2 PLAYER_SIZE(100.0f, 20.0f); const float PLAYER_VELOCITY(500.0f);`, the global
  `GameObject Player;` at **(350, 580)**, size 100×20; A/D (`game.Keys['A']`, `game.Keys['D']` – the virtual-key
  codes, the same numbers as GLFW_KEY_A / GLFW_KEY_D) move it by `PLAYER_VELOCITY * dt`. No key is pressed: the
  picture is static.
- Draw order in `Render` (inside `if (game.State == GAME_ACTIVE)`): background (0, 0, 800×600), the level, the paddle –
  70 draws per frame for level one, each `DrawSprite` setting its root constants and its texture's descriptor table
  (the textures' SRVs: slot 1 ball, 2 background, 3 block, 4 block_solid, 5 paddle). The ball texture stays loaded but
  is no longer drawn.

**Level one:** rows 0–3 full rows of 5 (orange), 4 (yellow), 3 (green), 2 (blue); row 4 empty; row 5 eight solid stones
at columns 0, 1, 4, 5, 9, 10, 13, 14; rows 6–7 empty.

Named points (OpenGL's, from the top-left, 800×600, static): **orange** (396,29), **yellow** (396,66), **green**
(396,104), **blue** (396,141), **gap** (400,170), **solid** (13,209), **row5-empty** (133,206), **moon** (640,110),
**sky** (200,250), **hills** (400,450), **paddle** (358,588), **beside-paddle** (300,590), **ball** (350,400). The
pixel values are OpenGL's (Mesa): the Direct3D 12 program draws the same sprites with the same matrices and texture
coordinates (checked on the `rendering-sprites` pictures, which equal OpenGL's), but the simulator cannot render this
chapter's Direct3D 12 states yet (see the report), so they are not measured here.

**Start picture:** the end of `rendering-sprites` – the green ball rotated 45° on black: ball (350,400) = (0, 230, 0),
hills (400,450) = (0, 215, 0), everything else (0, 0, 0).

## background
- **Task:** Load the game's textures – `background` (textures/background.png), `block`, `block_solid` (no alpha) and
  `paddle` (with alpha) – and in `Render` draw the background over the whole window instead of the ball (only while
  the game is active).
- **Hint:** `DrawSprite(Renderer, GetTexture("background").ID, XMFLOAT2(0.0f, 0.0f),
  XMFLOAT2(static_cast<float>(game.Width), static_cast<float>(game.Height)), 0.0f);` inside
  `if (game.State == GAME_ACTIVE)`.
- **Observable:** four `LoadTexture` calls after the ball's (`"textures/background.png", false, "background"`,
  `"textures/block.png", false, "block"`, `"textures/block_solid.png", false, "block_solid"`, `"textures/paddle.png",
  true, "paddle"`); `Render` holds `if (game.State == GAME_ACTIVE) { DrawSprite(… "background" …); }` (and TODOs for
  the level and the player) – the ball call is gone. **The garden at dusk fills the window**: orange = 22,28,62,
  yellow = 25,29,63, green = 29,32,65, blue = 34,34,67, gap = 38,37,69, solid = 45,40,72, row5-empty = 44,40,72,
  moon = 255,255,245, sky = 53,44,75, hills = 46,52,74, paddle = 30,40,46, beside-paddle = 30,40,46, ball = 88,63,91.
  One draw.

## game-object
- **Task:** Add learnopengl's GameObject as a struct (Position, Size, Velocity, Color, Rotation, IsSolid, Destroyed
  and the sprite's texture ID), `MakeGameObject` (learnopengl's constructor) and `DrawObject`, which draws the
  object's sprite.
- **Hint:** `DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);`.
- **Observable:** `struct GameObject` with the fields and defaults above, `MakeGameObject(…)`, `DrawObject(…)`. No
  visible change (the background).

## load-level
- **Task:** Add `struct GameLevel` (its Bricks), `LoadLevel`, which reads a level file line by line into rows of tile
  codes, and `InitLevel`, which turns the codes into bricks.
- **Hint:** `std::ifstream fstream(file)`, `while (std::getline(fstream, line))`, `std::istringstream sstream(line)`,
  `while (sstream >> tileCode) row.push_back(tileCode);`. `unit_width = levelWidth / static_cast<float>(width)`, the
  same for the height; position `XMFLOAT2 pos(unit_width * x, unit_height * y);`.
- **Observable:** `struct GameLevel { std::vector<GameObject> Bricks; };`, `InitLevel` (code 1 →
  `MakeGameObject(pos, size, GetTexture("block_solid").ID, XMFLOAT3(0.8f, 0.8f, 0.7f))` with `obj.IsSolid = true`;
  code > 1 → the colour chain 2–5 and `MakeGameObject(pos, size, GetTexture("block").ID, color)`; both
  `level.Bricks.push_back(…)`), `LoadLevel` (clears `level.Bricks`, reads the file, calls `InitLevel` if there is
  data). No visible change.

## draw-level
- **Task:** Add `DrawLevel` (every brick that is not destroyed), give `Game` its `Levels` and current `Level`, load the
  four level files in `Init` into the top half of the window, and draw the current level after the background.
- **Hint:** `for (GameObject& tile : level.Bricks) if (!tile.Destroyed) DrawObject(tile, renderer);`.
  `GameLevel one; LoadLevel(one, "levels/one.lvl", game.Width, game.Height / 2);` … `game.Levels.push_back(one);` …,
  `game.Level = 0;`. In `Render`: `DrawLevel(game.Levels[game.Level], Renderer);`.
- **Observable:** `void DrawLevel(GameLevel& level, SpriteRenderer& renderer)`; `std::vector<GameLevel> Levels;` and
  `unsigned int Level = 0;` in `struct Game`; the four `LoadLevel` calls, four `push_back`s and `game.Level = 0;` in
  `Init`; `DrawLevel(game.Levels[game.Level], Renderer);` after the background. **Level one appears in the top half**
  (69 draws): orange = 196,98,0, yellow = 157,157,78, green = 0,137,0, blue = 39,118,196, solid = 126,126,110; gap =
  38,37,69, row5-empty = 44,40,72, sky = 53,44,75, hills = 46,52,74, beside-paddle = 30,40,46 unchanged; moon (hidden
  behind the green row) = 0,120,0; paddle = 30,40,46 (no paddle yet).

## player
- **Task:** Add the paddle: `PLAYER_SIZE` (100, 20) and `PLAYER_VELOCITY` (500), a global `GameObject Player` made in
  `Init` at the bottom centre with the paddle texture, drawn after the level; in `ProcessInput` move it with A and D
  while it stays inside the window.
- **Hint:** `XMFLOAT2 playerPos = XMFLOAT2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);`,
  `Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").ID);`. `float velocity = PLAYER_VELOCITY * dt;`
  and `if (game.Keys['A']) { if (Player.Position.x >= 0.0f) Player.Position.x -= velocity; }`, the same for 'D' with
  `game.Width - Player.Size.x`.
- **Observable:** `const XMFLOAT2 PLAYER_SIZE(100.0f, 20.0f);`, `const float PLAYER_VELOCITY(500.0f);`,
  `GameObject Player;` after `SpriteRenderer Renderer;`, the two lines in `Init`, learnopengl's A/D block inside
  `if (game.State == GAME_ACTIVE)` in `ProcessInput`, `DrawObject(Player, Renderer);` after `DrawLevel`. **The wooden
  paddle appears at the bottom centre** (x 350..450, y 580..600; 70 draws): paddle = 214,170,72 (its brass end),
  beside-paddle = 30,40,46; everything else as after `draw-level`. (No key is pressed: the paddle stays at (350, 580).)
