# Levels

A game of this kind is unfortunately not just about a single happy green ball, but also about blocks – a whole wall of
them, which the player has to clear. We want these blocks to be configurable such that they support both multiple
levels and different block layouts. Hedgerow has four levels of its own, each in learnopengl's format, and a block
can be one of two kinds:

- A **solid** block: a block of grey stone that cannot be destroyed.
- A **normal** block: a light tile, tinted in one of four colours, that the ball destroys when it hits it.

To make the definition of levels easy, a level is a plain text file of numbers. Each number is a block, and the
numbers are laid out on the lines of the file the way the blocks are laid out in the wall: one line per row of blocks,
the numbers separated by spaces. learnopengl's level format:

- A number of **0**: no block, an empty space within the level.
- A number of **1**: a solid block, a block that cannot be destroyed.
- A number **higher than 1**: a destroyable block; each subsequent number only differs in color.

The course's levels are 15 blocks wide and 8 rows high. Level one, `levels/one.lvl`, is four full rows of coloured
blocks – the numbers 5, 4, 3, 2 from the top –, an empty row, and a row of stones with gaps:

```text
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5
4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
3 3 3 3 3 3 3 3 3 3 3 3 3 3 3
2 2 2 2 2 2 2 2 2 2 2 2 2 2 2
0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
1 1 0 0 1 1 0 0 0 1 1 0 0 1 1
0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
```

Levels two to four make shapes: an arena framed by stones, two diamonds of colour around a stone, and a checkered wall
with stones set into it. The empty rows at the bottom of every level are intentional: they keep the wall in the upper
part of the area the level is given, with room for the ball to come back.

A level is processed into game objects: one for every number that is not 0. Before we get to the level, we need the
game object.

## Game objects

An object in a game is anything with a position, a size and a picture – the paddle, the ball, each block. learnopengl
writes a `GameObject` class that holds the minimal state each of them needs, and the course writes it as a struct with
learnopengl's default values:

:::opengl
```cpp
struct GameObject
{
    // object state
    glm::vec2    Position = glm::vec2(0.0f, 0.0f), Size = glm::vec2(1.0f, 1.0f), Velocity = glm::vec2(0.0f);
    glm::vec3    Color = glm::vec3(1.0f);
    float        Rotation = 0.0f;
    bool         IsSolid = false;
    bool         Destroyed = false;
    // render state
    unsigned int Sprite = 0; // the texture's ID
};
```

learnopengl's object keeps its `Texture2D`; the course keeps the texture's ID, which is what `DrawSprite` takes.
:::
:::vulkan
```cpp
struct GameObject {
    // object state
    glm::vec2       Position = glm::vec2(0.0f, 0.0f), Size = glm::vec2(1.0f, 1.0f), Velocity = glm::vec2(0.0f);
    glm::vec3       Color = glm::vec3(1.0f);
    float           Rotation = 0.0f;
    bool            IsSolid = false;
    bool            Destroyed = false;
    // render state
    VkDescriptorSet Sprite = VK_NULL_HANDLE; // the texture's descriptor set
};
```

learnopengl's object keeps its `Texture2D`; the Vulkan version keeps the texture's **descriptor set**, which is what
`DrawSprite` binds for the draw.
:::
:::d3d12
```cpp
struct GameObject
{
    // object state
    XMFLOAT2     Position = XMFLOAT2(0.0f, 0.0f), Size = XMFLOAT2(1.0f, 1.0f), Velocity = XMFLOAT2(0.0f, 0.0f);
    XMFLOAT3     Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
    float        Rotation = 0.0f;
    bool         IsSolid = false;
    bool         Destroyed = false;
    // render state
    unsigned int Sprite = 0; // the texture's ID (its view's slot in the heap)
};
```

learnopengl's object keeps its `Texture2D`; the Direct3D 12 version keeps the texture's ID – the slot of its shader
resource view in the heap, which is what `DrawSprite` points root parameter 2 at.
:::

Besides position, size and sprite, there are a velocity (the ball will need it), a colour that tints the sprite, a
rotation, and two flags for the blocks: `IsSolid` – it cannot be destroyed – and `Destroyed`. learnopengl's
constructor becomes a function that makes one, with the same default arguments, and its `Draw` a free function:

:::opengl
```cpp
// creates a game object (learnopengl's GameObject constructor)
GameObject MakeGameObject(glm::vec2 pos, glm::vec2 size, unsigned int sprite, glm::vec3 color = glm::vec3(1.0f), glm::vec2 velocity = glm::vec2(0.0f, 0.0f))
{
    GameObject obj;
    obj.Position = pos;
    obj.Size = size;
    obj.Velocity = velocity;
    obj.Color = color;
    obj.Sprite = sprite;
    return obj;
}

// draw sprite
void DrawObject(GameObject& obj, SpriteRenderer& renderer)
{
    DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);
}
```
:::
:::vulkan
```cpp
GameObject MakeGameObject(glm::vec2 pos, glm::vec2 size, VkDescriptorSet sprite, glm::vec3 color = glm::vec3(1.0f), glm::vec2 velocity = glm::vec2(0.0f, 0.0f)) {
    GameObject obj;
    obj.Position = pos;
    obj.Size = size;
    obj.Velocity = velocity;
    obj.Color = color;
    obj.Sprite = sprite;
    return obj;
}

// draw sprite
void DrawObject(GameObject& obj, SpriteRenderer& renderer) {
    DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);
}
```
:::
:::d3d12
```cpp
GameObject MakeGameObject(XMFLOAT2 pos, XMFLOAT2 size, unsigned int sprite, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f), XMFLOAT2 velocity = XMFLOAT2(0.0f, 0.0f))
{
    GameObject obj;
    obj.Position = pos;
    obj.Size = size;
    obj.Velocity = velocity;
    obj.Color = color;
    obj.Sprite = sprite;
    return obj;
}

// draw sprite
void DrawObject(GameObject& obj, SpriteRenderer& renderer)
{
    DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);
}
```
:::

## The textures

Before there is anything to make objects of, the game needs its pictures. The course's own, in `textures/`:

- `background.png` – 800 × 600, the garden at dusk: a night sky that grows lighter downwards, the moon, hills and
  hedges;
- `block.png` – 128 × 128, a light tile with a bevelled edge, which the game tints with the block's colour;
- `block_solid.png` – 128 × 128, a block of grey stone;
- `paddle.png` – 512 × 128 with transparent corners, a wooden paddle with brass ends;
- and `ball.png` from the previous chapter, which stays loaded for the Ball chapter but is no longer drawn.

learnopengl loads its own pictures here under the same names.

:::opengl
```cpp
    // load textures
    LoadTexture("textures/ball.png", true, "ball");
    LoadTexture("textures/background.png", false, "background");
    LoadTexture("textures/block.png", false, "block");
    LoadTexture("textures/block_solid.png", false, "block_solid");
    LoadTexture("textures/paddle.png", true, "paddle");
```

The background and the blocks have no transparent parts and are loaded as RGB; the paddle and the ball with alpha.
:::
:::vulkan
```cpp
        // load textures
        LoadTexture("textures/ball.png", "ball");
        LoadTexture("textures/background.png", "background");
        LoadTexture("textures/block.png", "block");
        LoadTexture("textures/block_solid.png", "block_solid");
        LoadTexture("textures/paddle.png", "paddle");
```

Every texture is RGBA in the Vulkan version (the RGB files get an alpha of 255), so there is no `alpha` argument. The
descriptor pool now holds 5 of its 16 sets.
:::
:::d3d12
```cpp
    // load textures
    LoadTexture("textures/ball.png", true, "ball");
    LoadTexture("textures/background.png", false, "background");
    LoadTexture("textures/block.png", false, "block");
    LoadTexture("textures/block_solid.png", false, "block_solid");
    LoadTexture("textures/paddle.png", true, "paddle");
```

Every image is loaded as RGBA in Direct3D 12 (the RGB files get an alpha of 255); `alpha` stays for learnopengl's
signature. The textures' views take heap slots 1 (ball) to 5 (paddle).
:::

The background fills the whole window. In `Render`, only while the game is active (the menu and the win screen will
draw something else):

:::opengl
```cpp
    if (game.State == GAME_ACTIVE)
    {
        // draw background
        DrawSprite(Renderer, GetTexture("background").ID, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);
```
:::
:::vulkan
```cpp
    if (game.State == GAME_ACTIVE) {
        // draw background
        DrawSprite(Renderer, GetTexture("background").DescriptorSet, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);
```
:::
:::d3d12
```cpp
    if (game.State == GAME_ACTIVE)
    {
        // draw background
        DrawSprite(Renderer, GetTexture("background").ID, XMFLOAT2(0.0f, 0.0f), XMFLOAT2(static_cast<float>(game.Width), static_cast<float>(game.Height)), 0.0f);
```
:::

The `// TODO:` comments in the project mark where the code of each task goes. Now do the first task, **background**:
load the four textures after the ball's and draw the background instead of the ball. Build and run the program: **the
garden at dusk fills the window** – the stars, the moon in the upper right, the hills and the hedges.

Now do the task **game-object**: the struct, `MakeGameObject` and `DrawObject`. Nothing uses them yet – the picture
stays the same.

## Game levels

A level is a list of bricks, and learnopengl's `GameLevel` class holds just that, together with functions to load a
level from a file, to draw it and to tell whether it is complete:

:::opengl d3d12
```cpp
struct GameLevel
{
    // level state
    std::vector<GameObject> Bricks;
};
```
:::
:::vulkan
```cpp
struct GameLevel {
    // level state
    std::vector<GameObject> Bricks;
};
```
:::

Loading a level reads the file line by line and every line number by number, into rows of tile codes:

:::opengl d3d12
```cpp
void LoadLevel(GameLevel& level, const char *file, unsigned int levelWidth, unsigned int levelHeight)
{
    // clear old data
    level.Bricks.clear();
    // load from file
    unsigned int tileCode;
    std::string line;
    std::ifstream fstream(file);
    std::vector<std::vector<unsigned int>> tileData;
    if (fstream)
    {
        while (std::getline(fstream, line)) // read each line from level file
        {
            std::istringstream sstream(line);
            std::vector<unsigned int> row;
            while (sstream >> tileCode) // read each word separated by spaces
                row.push_back(tileCode);
            tileData.push_back(row);
        }
        if (tileData.size() > 0)
            InitLevel(level, tileData, levelWidth, levelHeight);
    }
}
```
:::
:::vulkan
```cpp
void LoadLevel(GameLevel& level, const char* file, unsigned int levelWidth, unsigned int levelHeight) {
    // clear old data
    level.Bricks.clear();
    // load from file
    unsigned int tileCode;
    std::string line;
    std::ifstream fstream(file);
    std::vector<std::vector<unsigned int>> tileData;
    if (fstream) {
        while (std::getline(fstream, line)) { // read each line from level file
            std::istringstream sstream(line);
            std::vector<unsigned int> row;
            while (sstream >> tileCode) // read each word separated by spaces
                row.push_back(tileCode);
            tileData.push_back(row);
        }
        if (tileData.size() > 0)
            InitLevel(level, tileData, levelWidth, levelHeight);
    }
}
```
:::

The loaded tile data is then passed to the level's `InitLevel` function (learnopengl's private `init`), which turns the
codes into bricks. `levelWidth` and `levelHeight` are the size of the area the level fills, in pixels – it does not have
to be the whole window, and the game gives it only the upper half:

:::opengl
```cpp
void InitLevel(GameLevel& level, std::vector<std::vector<unsigned int>> tileData, unsigned int levelWidth, unsigned int levelHeight)
{
    // calculate dimensions
    unsigned int height = tileData.size();
    unsigned int width = tileData[0].size(); // note we can index vector at [0] since this function is only called if height > 0
    float unit_width = levelWidth / static_cast<float>(width), unit_height = levelHeight / static_cast<float>(height);
    // initialize level tiles based on tileData
    for (unsigned int y = 0; y < height; ++y)
    {
        for (unsigned int x = 0; x < width; ++x)
        {
            // check block type from level data (2D level array)
            if (tileData[y][x] == 1) // solid
            {
                glm::vec2 pos(unit_width * x, unit_height * y);
                glm::vec2 size(unit_width, unit_height);
                GameObject obj = MakeGameObject(pos, size, GetTexture("block_solid").ID, glm::vec3(0.8f, 0.8f, 0.7f));
                obj.IsSolid = true;
                level.Bricks.push_back(obj);
            }
            else if (tileData[y][x] > 1) // non-solid; now determine its color based on level data
            {
                glm::vec3 color = glm::vec3(1.0f); // original: white
                if (tileData[y][x] == 2)
                    color = glm::vec3(0.2f, 0.6f, 1.0f);
                else if (tileData[y][x] == 3)
                    color = glm::vec3(0.0f, 0.7f, 0.0f);
                else if (tileData[y][x] == 4)
                    color = glm::vec3(0.8f, 0.8f, 0.4f);
                else if (tileData[y][x] == 5)
                    color = glm::vec3(1.0f, 0.5f, 0.0f);

                glm::vec2 pos(unit_width * x, unit_height * y);
                glm::vec2 size(unit_width, unit_height);
                level.Bricks.push_back(MakeGameObject(pos, size, GetTexture("block").ID, color));
            }
        }
    }
}
```
:::
:::vulkan
The Vulkan version is the same function with the descriptor sets as sprites:

```cpp
                GameObject obj = MakeGameObject(pos, size, GetTexture("block_solid").DescriptorSet, glm::vec3(0.8f, 0.8f, 0.7f));
```

for the solid blocks (with `obj.IsSolid = true;`), and for the others, after learnopengl's chain of colours – 2 →
(0.2, 0.6, 1.0), 3 → (0.0, 0.7, 0.0), 4 → (0.8, 0.8, 0.4), 5 → (1.0, 0.5, 0.0):

```cpp
                level.Bricks.push_back(MakeGameObject(pos, size, GetTexture("block").DescriptorSet, color));
```

The dimensions are learnopengl's:

```cpp
    float unit_width = levelWidth / static_cast<float>(width), unit_height = levelHeight / static_cast<float>(height);
```

and each brick is at `glm::vec2 pos(unit_width * x, unit_height * y);` with the size `glm::vec2 size(unit_width,
unit_height);`, for `x` over the columns and `y` over the rows of `tileData`.
:::
:::d3d12
The Direct3D 12 version is the same function with DirectXMath's types:

```cpp
    float unit_width = levelWidth / static_cast<float>(width), unit_height = levelHeight / static_cast<float>(height);
```

each brick at `XMFLOAT2 pos(unit_width * x, unit_height * y);` with the size `XMFLOAT2 size(unit_width, unit_height);`,
for `x` over the columns and `y` over the rows of `tileData`; a solid block is
`MakeGameObject(pos, size, GetTexture("block_solid").ID, XMFLOAT3(0.8f, 0.8f, 0.7f))` with `obj.IsSolid = true;`, the
others `MakeGameObject(pos, size, GetTexture("block").ID, color)` after learnopengl's chain of colours – 2 →
(0.2, 0.6, 1.0), 3 → (0.0, 0.7, 0.0), 4 → (0.8, 0.8, 0.4), 5 → (1.0, 0.5, 0.0), starting from
`XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f);`.
:::

The init function iterates through each of the loaded numbers and adds a game object to the level's `Bricks` vector
based on the processed number. The size of each brick (`unit_width` and `unit_height`) is automatically calculated
based on the total number of bricks so that each brick perfectly fits within the screen bounds: the width of the area
divided by the number of columns, its height by the number of rows. For level one with 15 columns and 8 rows in an area
of 800 × 300 pixels, a brick is 800 / 15 ≈ 53.3 pixels wide and 300 / 8 = **37.5** pixels high. The position of the
brick in column x and row y is (unit_width · x, unit_height · y) – its top-left corner, as the sprite renderer expects.

Here we load the game objects with two new textures: a block texture and a solid block texture. The solid blocks get a
light grey-beige tint, the colour codes the colours of learnopengl's game. A nice little trick here is that the block
texture is light grey all over, with only a little shading on its edges: tinted with a colour, it becomes a block of
that colour – one texture for every colour.

**One difference from learnopengl.** learnopengl computes the height as `levelHeight / height`, both `unsigned int` – an
integer division: 300 / 8 = 37, so its rows are 37 pixels high and the wall ends 4 pixels short of the area's bottom.
The course divides as floats, `levelHeight / static_cast<float>(height)`, as the code clearly intends (the width is
divided as a float in learnopengl too) – in every API, so the pictures match.

```quiz
Level one has 15 numbers per line and 8 lines, and is loaded into an area of 800 × 300 pixels. Where is the top-left corner of the brick in column 4, row 5 (counting from 0) – the third stone from the left?
- [ ] At (4, 5)
- [x] At (4 · 53.33, 5 · 37.5) ≈ (213.3, 187.5)
- [ ] At (5 · 53.33, 4 · 37.5) ≈ (266.7, 150)
- [ ] At (4 · 53.33, 5 · 75) ≈ (213.3, 375)
---
x counts the columns and scales with `unit_width` = 800 / 15, y the rows with `unit_height` = 300 / 8. Rows 0–3 hold the colours (y 0 … 150), row 4 is empty, the stones are in row 5 at y 187.5 … 225.
```

To draw a level, draw each of its bricks that has not been destroyed – the Collision chapters will set `Destroyed` when
the ball hits a block:

:::opengl d3d12
```cpp
void DrawLevel(GameLevel& level, SpriteRenderer& renderer)
{
    for (GameObject& tile : level.Bricks)
        if (!tile.Destroyed)
            DrawObject(tile, renderer);
}
```
:::
:::vulkan
```cpp
void DrawLevel(GameLevel& level, SpriteRenderer& renderer) {
    for (GameObject& tile : level.Bricks)
        if (!tile.Destroyed)
            DrawObject(tile, renderer);
}
```
:::

The loop takes each brick by reference (`GameObject&`): a copy of every brick for every frame would work too, but
there is no reason to make one. learnopengl's level class also has `IsCompleted`, which checks whether every
non-solid brick is destroyed: the level is then complete. Nothing can be destroyed yet, so the course adds it in a
later chapter, when the game needs it.

Now do the task **load-level**: the struct, `LoadLevel` and `InitLevel`. Nothing loads a level yet – the picture stays
the same.

### Within the game

We would like to support multiple levels in the game, so we have to extend the game struct a little by adding a
vector that holds the levels, and the index of the current one:

:::opengl d3d12
```cpp
struct Game
{
    // game state
    GameState               State = GAME_ACTIVE;
    bool                    Keys[1024] = {};
    unsigned int            Width = SCREEN_WIDTH, Height = SCREEN_HEIGHT;
    std::vector<GameLevel>  Levels;
    unsigned int            Level = 0;
};
```
:::
:::vulkan
```cpp
struct Game {
    // game state
    GameState               State = GAME_ACTIVE;
    bool                    Keys[1024] = {};
    unsigned int            Width = WIDTH, Height = HEIGHT;
    std::vector<GameLevel>  Levels;
    unsigned int            Level = 0;
};
```
:::

In `Init`, after the textures, the four levels are loaded in order, into an area as wide as the window and **half as
high** – the upper half, where the wall belongs –, and the first is chosen:

```cpp
    // load levels
    GameLevel one; LoadLevel(one, "levels/one.lvl", game.Width, game.Height / 2);
    GameLevel two; LoadLevel(two, "levels/two.lvl", game.Width, game.Height / 2);
    GameLevel three; LoadLevel(three, "levels/three.lvl", game.Width, game.Height / 2);
    GameLevel four; LoadLevel(four, "levels/four.lvl", game.Width, game.Height / 2);
    game.Levels.push_back(one);
    game.Levels.push_back(two);
    game.Levels.push_back(three);
    game.Levels.push_back(four);
    game.Level = 0;
```

The textures must be loaded before the levels: `InitLevel` asks the resource manager for `"block"` and `"block_solid"`.

```quiz
What would happen if `Init` loaded the levels *before* the block textures?
- [x] Every brick would keep a sprite that is no texture: `GetTexture("block")` on a name not loaded yet creates a default, empty `Texture2D` in the map, and the bricks store its ID (or descriptor set) for good
- [ ] Nothing: the bricks look their texture up again every time they are drawn
- [ ] `LoadLevel` would fail to open the level file
- [ ] The resource manager would load the textures by itself when they are asked for
---
`InitLevel` copies the texture's ID (or descriptor set) into each brick when it makes it. `std::map`'s `operator[]`, which `GetTexture` uses, inserts a default-constructed value for an unknown key – no error, just an empty texture.
```
And in `Render`, after the background:

```cpp
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
```

Now do the task **draw-level**: `DrawLevel`, the two members of `Game`, the levels in `Init` and the call in `Render`.
Build and run: **level one appears in the top half** – the rows of orange, yellow, green and blue tiles, each tile
lighter and darker at its bevelled edges around a flat middle, and below a gap the row of grey stones. The moon is now
hidden behind the green row.

:::opengl
That is 69 draws per frame – the background and 68 bricks –, each one its `glUniform*` calls, a texture bind and a
`glDrawArrays` of 6 vertices.
:::
:::vulkan
That is 69 draws per frame – the background and 68 bricks. Each `DrawSprite` records a `vkCmdBindPipeline`, its push
constants (the brick's model matrix and colour), a `vkCmdBindDescriptorSets` with its texture's set and a `vkCmdDraw`;
the 68 bricks use only two descriptor sets, `block`'s and `block_solid`'s.
:::
:::d3d12
That is 69 draws per frame – the background and 68 bricks. Each `DrawSprite` records `SetPipelineState`, its root
constants (the brick's model matrix and colour), the descriptor table of its texture (heap slot 3 for `block`, 4 for
`block_solid`) and a `DrawInstanced` of 6 vertices.
:::

Drawing every brick with its own draw call is learnopengl's simple way and works well for a few hundred sprites. A game
with thousands would put all bricks of a texture into one instanced draw, or all into one atlas and one draw.

:::opengl
```quiz
What does each brick's draw change in the OpenGL state, compared with the brick before it?
- [ ] The vertex array object, because each brick has its own quad
- [x] The `model` and `spriteColor` uniforms (and the bound texture when it switches between block and stone) – the quad, the shader and the projection stay the same
- [ ] Nothing: all bricks are drawn by one draw call
- [ ] The projection matrix, which is set to the brick's area
---
The one unit quad is scaled and moved by the model matrix; the colour tints the shared light tile. That is why a single block texture can make blocks of four colours.
```
:::
:::vulkan
```quiz
68 bricks are drawn with only two textures. What does each brick's `DrawSprite` record that differs from the brick before it?
- [ ] A new vertex buffer, because each brick has its own quad
- [ ] A new descriptor set per brick, allocated while recording
- [x] Its push constants – the model matrix and the colour –, and the descriptor set of its texture (block or stone); pipeline and quad are the same for all
- [ ] Nothing: all bricks are drawn by one `vkCmdDraw`
---
Push constants are made for exactly this: small values that change from draw to draw, recorded into the command buffer. Binding the same pipeline and descriptor set again is allowed and cheap; a renderer could skip the repeated binds.
```
:::
:::d3d12
```quiz
68 bricks are drawn with only two textures. What does each brick's `DrawSprite` record that differs from the brick before it?
- [ ] A new vertex buffer view, because each brick has its own quad
- [ ] A new shader resource view per brick, created while recording
- [ ] Nothing: all bricks are drawn by one `DrawInstanced`
- [x] Its root constants – the model matrix and the colour –, and the descriptor table of its texture (block or stone); the pipeline state and the quad are the same for all
---
Root constants are made for exactly this: small values that change from draw to draw, recorded into the command list. Setting the same pipeline state and table again is allowed and cheap; a renderer could skip the repeated calls.
```
:::

## The player paddle

Next, we're going to add a paddle at the bottom of the scene that is controlled by the player. The paddle only allows
for horizontal movement and whenever it touches any of the scene's edges, its movement should halt. For the player
paddle we're going to use the course's paddle texture – a wooden paddle with brass ends.

A paddle object will have a position, a size, and a sprite texture, so it makes sense to define the paddle as a game
object as well:

:::opengl vulkan
```cpp
// Initial size of the player paddle
const glm::vec2 PLAYER_SIZE(100.0f, 20.0f);
// Initial velocity of the player paddle
const float PLAYER_VELOCITY(500.0f);
```
:::
:::d3d12
```cpp
// Initial size of the player paddle
const XMFLOAT2 PLAYER_SIZE(100.0f, 20.0f);
// Initial velocity of the player paddle
const float PLAYER_VELOCITY(500.0f);
```
:::

and a global `GameObject Player;` next to `Hedgerow` and `Renderer`. Here we defined several constants that define
the paddle's size and speed: 100 × 20 pixels, 500 pixels per second. Within the game's `Init` function we calculate
the starting position of the paddle within the scene. We make sure the player paddle's center is aligned with the
horizontal center of the scene, and that it sits on the bottom edge:

:::opengl
```cpp
    // configure game objects
    glm::vec2 playerPos = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").ID);
```
:::
:::vulkan
```cpp
        // configure game objects
        glm::vec2 playerPos = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
        Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").DescriptorSet);
```
:::
:::d3d12
```cpp
    // configure game objects
    XMFLOAT2 playerPos = XMFLOAT2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").ID);
```
:::

That is (800 / 2 − 50, 600 − 20) = **(350, 580)**. In `Render` it is drawn last, after the level:

```cpp
        // draw player
        DrawObject(Player, Renderer);
```

Because the paddle is drawn after the background, it is drawn on top of it – the order of the draws is the order of
the layers, and blending shows the background through the paddle's transparent corners.

Because we already defined the paddle's movement keys in the key handling of the previous chapters, we can now move it
with A and D in `ProcessInput`:

:::vulkan
```cpp
    if (game.State == GAME_ACTIVE) {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys[GLFW_KEY_A]) {
            if (Player.Position.x >= 0.0f)
                Player.Position.x -= velocity;
        }
        if (game.Keys[GLFW_KEY_D]) {
            if (Player.Position.x <= game.Width - Player.Size.x)
                Player.Position.x += velocity;
        }
    }
```
:::
:::opengl
```cpp
    if (game.State == GAME_ACTIVE)
    {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys[GLFW_KEY_A])
        {
            if (Player.Position.x >= 0.0f)
                Player.Position.x -= velocity;
        }
        if (game.Keys[GLFW_KEY_D])
        {
            if (Player.Position.x <= game.Width - Player.Size.x)
                Player.Position.x += velocity;
        }
    }
```
:::
:::d3d12
```cpp
    if (game.State == GAME_ACTIVE)
    {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys['A'])
        {
            if (Player.Position.x >= 0.0f)
                Player.Position.x -= velocity;
        }
        if (game.Keys['D'])
        {
            if (Player.Position.x <= game.Width - Player.Size.x)
                Player.Position.x += velocity;
        }
    }
```

`Keys['A']` and `Keys['D']`: the virtual-key codes of the letters are their capital ASCII codes, the same numbers as
GLFW's `GLFW_KEY_A` and `GLFW_KEY_D`.
:::

Here we move the player paddle either in the left or right direction based on which key the user pressed (note how we
multiply the velocity with the delta time variable). If the paddle's x value would be less than 0 it would've moved
outside the left edge, so we only move the paddle to the left if the paddle's x value is higher than the left edge's x
position (0.0). We do the same for when the paddle breaches the right edge, but we have to compare the right edge's
position with the right edge of the paddle (subtract the paddle's width from the right edge's x position). Note that the
test is made *before* the move: a paddle at x = 3 still moves left by 8.3 pixels, to x = −5.3, and only then stops. The
paddle can stick out of the window by up to one frame's movement – learnopengl's simple check, good enough here.

Now do the task **player**: the constants, the global, the paddle in `Init`, its movement in `ProcessInput` and its draw
in `Render`. Build and run: **the wooden paddle appears at the bottom centre**, from (350, 580) to (450, 600), its brass
ends on both sides. The course presses no movement keys, so in the expected result it stays there; in your own program,
A and D move it.

:::opengl
70 draws per frame: background, 68 bricks, paddle.
:::
:::vulkan
70 draws per frame: background, 68 bricks, paddle. Compared pixel by pixel with the OpenGL version, the picture is the
same except along the bricks' edges at y = 37.5, 112.5 and 187.5: there a brick edge runs exactly through the centres
of a row of pixels, and Vulkan's top-left rasterization rule (with y down) gives those pixels to the brick below where
OpenGL's (with y up) gives them to the brick above. Neither is wrong; both rules make sure that a pixel on a shared edge
is drawn exactly once.
:::
:::d3d12
70 draws per frame: background, 68 bricks, paddle. Direct3D's top-left rasterization rule decides like Vulkan's: along
the bricks' edges at y = 37.5, 112.5 and 187.5, which run exactly through the centres of a row of pixels, those pixels go
to the brick below, where OpenGL gives them to the brick above. Neither is wrong; both rules make sure that a pixel on a
shared edge is drawn exactly once.
:::

```quiz
Why does `ProcessInput` compare `Player.Position.x <= game.Width - Player.Size.x` for the right edge instead of `Player.Position.x <= game.Width`?
- [ ] Because `game.Width` is the centre of the window
- [x] Because `Position` is the paddle's left edge: its right edge is `Position.x + Size.x`, and that must stay inside the window
- [ ] Because the paddle is drawn mirrored
- [ ] Because `Size.x` is the paddle's speed
---
An object's position is its top-left corner throughout the game (the sprite renderer's convention). For the left edge `Position.x >= 0` is enough; for the right one the width has to be taken into account.
```

And that's it for this chapter: the game draws its background, its first level and the paddle, which the player can
move. In the next chapters the ball joins, and with it collisions.

## Additional resources

- [Levels](https://learnopengl.com/In-Practice/2D-Game/Levels): learnopengl's chapter this chapter follows.
- [std::getline](https://en.cppreference.com/w/cpp/string/basic_string/getline) and
  [std::basic_istringstream](https://en.cppreference.com/w/cpp/io/basic_istringstream): the C++ that reads the level
  files.

:::vulkan
- [Descriptor sets (Vulkan specification)](https://docs.vulkan.org/spec/latest/chapters/descriptorsets.html): what a
  draw binds for its texture.
:::
:::d3d12
- [Descriptor tables](https://learn.microsoft.com/en-us/windows/win32/direct3d12/descriptor-tables): what a draw points
  root parameter 2 at.
:::
