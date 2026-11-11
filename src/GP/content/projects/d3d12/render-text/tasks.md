# Render text (Hedgerow) – tasks (DirectX 12)

**Screenshot time: t = 3.0 s (frame 180)** – OpenGL's (projects/opengl/render-text/tasks.md): the 181st `OnUpdate` +
`OnRender` (frame n's clock reads n / 60 s; SPACE as `OnKeyDown(VK_SPACE)` before frame 30's `OnUpdate`, `OnKeyUp`
before frame 33's – see `../game-setup/tasks.md`).

learnopengl "2D Game / Render text": `text_renderer.h/.cpp`, `text_2d.vs/.frag` and the text, lives, menu and win parts
of `game.h/.cpp` and `program.cpp` (KeysProcessed). Files: `main.cpp` (= `powerups`' solution – which `audio` keeps –
with TODOs), the shaders + **`text_2d.hlsl`** (new: VSMain / PSMain with start bodies that compile and draw nothing
useful), **`fonts/Inter-Bold.otf` + `fonts/OFL.txt`** (the course's font, SIL Open Font License; learnopengl's game
uses OCRAEXT.TTF), `textures/`, `levels/`. See `../text-rendering/tasks.md` for the glyph atlas. FreeType links as
`freetype.lib` (vcpkg `freetype`).

**What happens with the fixed input** (as OpenGL): until `menu` the game starts in GAME_ACTIVE: the ball is released in
frame 30, bounces off the stone in frame 86 and is lost in frame 151 – with `lives` that costs a life: **"Lives:2" at
3.0 s**. From `menu` on the game starts in **GAME_MENU**: ENTER is never pressed, so it **stays in the menu** ("Lives:3",
the menu's two lines over the level, the ball on the paddle). The win screen never shows: `win` is checked in the code.

**The same as OpenGL** (structs, functions, numbers, task ids, points): the first task removes `powerups`' six test
power-ups; `struct Character`, `struct TextRenderer`, the global `TextRenderer   Text;`, `void
InitTextRenderer(TextRenderer& renderer, unsigned int width, unsigned int height)`, `void Load(TextRenderer& renderer,
std::string font, unsigned int fontSize)` (FreeType, characters 0…127), `void RenderText(TextRenderer& renderer,
std::string text, float x, float y, float scale, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f))` with learnopengl's maths –
(x, y) is the text's **top-left** corner: `ypos = y + (renderer.Characters['H'].Bearing.y - ch.Bearing.y) * scale`, `x +=
(ch.Advance >> 6) * scale`; in Init after the postprocessor `InitTextRenderer(Text, game.Width, game.Height); Load(Text,
"fonts/Inter-Bold.otf", 24);` (**24 px**); `bool KeysProcessed[1024] = {};` and `unsigned int Lives = 3;` in Game, `State
= GAME_MENU`; learnopengl's lives, menu (ENTER / W / S, each once per press) and win logic and texts:
`RenderText(Text, "Lives:" + std::to_string(game.Lives), 5.0f, 5.0f, 1.0f);` after the postprocessing quad (not
post-processed), "Press ENTER to start" (250, Height / 2, 1.0), "Press W or S to select level" (245, Height / 2 + 20,
0.75), "You WON!!!" (320, Height / 2 − 20, green) and "Press ENTER to retry or ESC to quit" (130, Height / 2, yellow).

**Direct3D 12's choices** (the text rendering chapter's, in the game's structs):
- **One glyph atlas**: `Character` keeps the glyph's cell (`XMINT2 AtlasPos`, plus `XMINT2 Size`, `XMINT2 Bearing`,
  `unsigned int Advance`) instead of a texture ID; `Load` copies the bitmaps row by row into a CPU-side atlas of 16 × 8
  cells of 64 × 64 bytes (`AtlasWidth` 1024 × `AtlasHeight` 512 – the 24-pixel glyphs are at most 25 × 25) and uploads
  it once into `TextRenderer::Atlas`, a `Texture2D` with `Internal_Format = DXGI_FORMAT_R8_UNORM` (learnopengl's GL_RED;
  the setup's command list copies it, its upload heap lives in the struct), its view in the next heap slot. FreeType
  errors throw a std::runtime_error (learnopengl prints them), a glyph that fails is reported with OutputDebugStringA
  and skipped (learnopengl's `continue`). The sampler is the game's static one (linear, wrapping): the cells' empty
  borders keep neighbours – and the atlas's opposite edges – apart.
- **All quads of a frame in one vertex buffer, one draw per line**: learnopengl rewrites one 6-vertex VBO with
  glBufferSubData before each character's draw; the GPU reads a Direct3D 12 buffer only when the command list executes,
  so `TextRenderer` has a vertex buffer for 256 characters (`MaxTextVertices` = 1536 vertices of 4 floats, an upload
  heap mapped for good: `VertexBuffer`, `VertexBufferView`, `pVertexDataBegin`), RenderText writes each quad at
  `VertexCount` and records one `DrawInstanced(VertexCount - firstVertex, 1, firstVertex, 0)` per line; `Render(Game&)`
  starts with `Text.VertexCount = 0;` (the GPU has finished the previous frame – WaitForPreviousFrame). So the draw
  counts differ from OpenGL's: one draw per text line instead of one per character.
- **The text shader** (`text_2d.hlsl`, loaded with `LoadShader(L"text_2d.hlsl", "text")`: alpha blending, 1 sample – it
  draws into the window after the postprocessing quad): VSMain `mul(float4(position, 0.0f, 1.0f), projection)` with the
  game's projection (the CBV at b1 – learnopengl's `glm::ortho(0, width, height, 0)` is the same matrix, so
  InitTextRenderer sets nothing), PSMain `float4(textColor, 1.0f) * float4(1.0f, 1.0f, 1.0f, text.Sample(…).r)`; the
  colour is a root constant (`cbuffer TextConstants : register(b0) { float3 textColor; }` ↔ `struct TextConstants {
  XMFLOAT3 textColor; };`), set per line.
- Keys: ENTER is `VK_RETURN`, W and S `'W'` / `'S'` (the virtual-key codes, the same numbers as GLFW's for letters);
  `OnKeyUp` clears `KeysProcessed[key]` too (learnopengl's key_callback on release). OnDestroy releases the text
  renderer with `Text = TextRenderer();` (atlas, upload heap, vertex buffer).

Named points (OpenGL's, from the top-left, 800×600, frame 180): **lives-L** (8,12), **lives-text** (33,21), **digit2**
(81,17), **digit3** (87,17), **menu** (325,302), **menu-small** (312,331), **ball** (400,567), **paddle-wide** (480,590),
**top-paddle** (442,12), **sky** (200,250), **orange** (396,29). Pixel values are OpenGL's (Mesa); the Direct3D 12 glyph
quads are the same (same maths, same glyphs), only their edge texels can differ a little (an atlas cell's border is
0, a separate GL texture clamps to its edge texel).

**Start picture** (= `powerups`' end at 3.0 s: confused, the 150 px paddle): lives-L = 225,215,209, lives-text =
225,215,209, digit2 = 225,215,209, digit3 = 225,215,209, menu = 192,205,175, menu-small = 199,209,178, ball =
62,158,255, paddle-wide = 120,187,255, top-paddle = 41,85,183, sky = 180,199,170, orange = 95,39,102.

## remove-test
- **Task:** The power-ups work: remove the six test power-ups from Init.
- **Hint:** Delete the comment and the six `game.PowerUps.push_back(…)` lines after `Ball = MakeBallObject(…);`.
- **Observable:** Init ends with the ball's MakeBallObject line. **The normal game again**: lives-L = 221,111,0,
  lives-text = 210,105,0, digit2 = 222,111,0, digit3 = 193,97,0 (the orange bricks), menu = 64,50,80, menu-small =
  70,54,83, ball = 192,230,180, paddle-wide = 30,40,46, top-paddle = 242,121,0, sky = 53,44,75, orange = 196,98,0.

## text-renderer
- **Task:** Add `struct Character`, `struct TextRenderer` and `InitTextRenderer` (load the text shader, create the
  vertex buffer for the text's quads), write the text shader, make the global `Text` in Init, and release it in
  OnDestroy.
- **Hint:** `renderer.TextShader = LoadShader(L"text_2d.hlsl", "text");` – the projection is the game's (b1). The vertex
  buffer: `MaxTextVertices * 4 * sizeof(float)` bytes in an upload heap, `Map` once into `renderer.pVertexDataBegin`, a
  view with stride `4 * sizeof(float)`. Pixel shader: `float4 sampled = float4(1.0f, 1.0f, 1.0f, text.Sample(wrapSampler,
  input.texCoord).r); return float4(textColor, 1.0f) * sampled;`.
- **Observable:** `struct Character { XMINT2 AtlasPos; XMINT2 Size; XMINT2 Bearing; unsigned int Advance; };`,
  `AtlasCellSize`, `AtlasWidth`, `AtlasHeight`, `MaxTextVertices`, `struct TextRenderer` (Characters, TextShader,
  Atlas, VertexBuffer, VertexBufferView, pVertexDataBegin, VertexCount) and `void InitTextRenderer(…)`; text_2d.hlsl's
  VSMain (`result.position = mul(float4(position, 0.0f, 1.0f), projection); result.texCoord = texCoord;`) and PSMain;
  `TextRenderer   Text;` after `PostProcessor  Effects;`, `InitTextRenderer(Text, game.Width, game.Height);` after
  InitPostProcessor, `Text = TextRenderer();` in OnDestroy. **No visible change** (as after `remove-test`).

## load-font
- **Task:** Write `Load`: with FreeType, load the font at the given pixel size, copy each of the first 128 ASCII
  characters' bitmap into its cell of the glyph atlas and make a `Character` (cell, size, bearing, advance); upload the
  atlas as an R8 texture with its view; load `fonts/Inter-Bold.otf` at 24 pixels in Init.
- **Hint:** The text rendering chapter's LoadGlyphs: `FT_Init_FreeType`, `FT_New_Face(ft, font.c_str(), 0, &face)`,
  `FT_Set_Pixel_Sizes(face, 0, fontSize)`, `FT_Load_Char(face, c, FT_LOAD_RENDER)`, a `memcpy` per bitmap row into
  `atlas[(cellY + row) * AtlasWidth + cellX]`, `renderer.Characters.insert(std::pair<char, Character>(c, character));`;
  then the texture like `Generate` with `RowPitch = AtlasWidth` (1 byte per texel).
- **Observable:** `#include <ft2build.h>` / `#include FT_FREETYPE_H` and `#pragma comment(lib, "freetype.lib")`; `void
  Load(TextRenderer& renderer, std::string font, unsigned int fontSize)` (above; `renderer.Atlas.ID =
  Graphics.SrvCount++`, `DXGI_FORMAT_R8_UNORM`, CreateCommittedResource ×2, UpdateSubresources, the barrier,
  CreateShaderResourceView); `Load(Text, "fonts/Inter-Bold.otf", 24);` after InitTextRenderer. Nothing is drawn with
  them yet: **no visible change**.

## lives
- **Task:** Give the player 3 lives: losing the ball costs one; with none left the level is reset and the game goes back
  to the menu; ResetLevel gives the 3 lives back.
- **Hint:** `unsigned int Lives = 3;` in Game. In Update's loss check: `--game.Lives; if (game.Lives == 0) {
  ResetLevel(game); game.State = GAME_MENU; } ResetPlayer(game);`. `game.Lives = 3;` at the end of ResetLevel.
- **Observable:** the field, learnopengl's loss check, `game.Lives = 3;` in ResetLevel. Lives becomes 2 in frame 151,
  but nothing shows it yet: **no visible change**.

## render-text
- **Task:** Write `RenderText`: for each character a quad of the glyph's size at its bearing, from the text's top-left
  corner (x, y), with its cell of the atlas, written into the vertex buffer; one draw for the line; then advance x.
  Start each frame's text at the vertex buffer's beginning. Show `"Lives:"` and the number of lives at (5, 5) after the
  postprocessing quad.
- **Hint:** `float xpos = x + ch.Bearing.x * scale; float ypos = y + (renderer.Characters['H'].Bearing.y -
  ch.Bearing.y) * scale;` – the six vertices from (xpos, ypos) to (xpos + w, ypos + h) with the cell's texture
  coordinates (`u0 = AtlasPos.x / AtlasWidth` …, v0 at the top). `memcpy(renderer.pVertexDataBegin + renderer.VertexCount
  * 4 * sizeof(float), vertices, sizeof(vertices)); renderer.VertexCount += 6;`. `Text.VertexCount = 0;` at the start of
  `Render(Game&)`.
- **Observable:** `struct TextConstants { XMFLOAT3 textColor; };`, `void RenderText(…)` (above: Use, the root constants,
  the atlas's table, IASetVertexBuffers, the loop, `DrawInstanced(renderer.VertexCount - firstVertex, 1, firstVertex,
  0)`); `Text.VertexCount = 0;` first in Render(Game&); the Lives line after `Render(Effects, GetTime());`. **"Lives:2" in
  white at the top left** (one draw more): lives-L = 255,255,255, lives-text = 255,255,255, digit2 = 255,255,255, digit3
  = 193,97,0; everything else as after `remove-test`.

## menu
- **Task:** Add learnopengl's menu: the game starts in `GAME_MENU`; ENTER starts it, W and S choose the level – each
  only once per key press (`KeysProcessed`, cleared in OnKeyUp); draw the scene in the menu and win states too, and in
  the menu the two lines "Press ENTER to start" (250, Height / 2, scale 1) and "Press W or S to select level" (245,
  Height / 2 + 20, scale 0.75).
- **Hint:** `if (game.State == GAME_MENU) { if (game.Keys[VK_RETURN] && !game.KeysProcessed[VK_RETURN]) { game.State =
  GAME_ACTIVE; game.KeysProcessed[VK_RETURN] = true; } … }` before the GAME_ACTIVE block (`'W'`, `'S'` for the level). In
  Render: `if (game.State == GAME_ACTIVE || game.State == GAME_MENU || game.State == GAME_WIN)` around the scene, then
  `if (game.State == GAME_MENU) { RenderText(…); RenderText(…); }`.
- **Observable:** `GameState State = GAME_MENU;` and `bool KeysProcessed[1024] = {};` in Game; the menu branch in
  ProcessInput; Render's condition and the menu text; `Hedgerow.KeysProcessed[key] = false;` in OnKeyUp. **The menu over
  the level** (two draws more): "Lives:3" (digit2 = 222,111,0, digit3 = 255,255,255), menu = 255,255,255, menu-small =
  255,255,255, lives-L = 255,255,255, lives-text = 255,255,255, ball = 192,230,180, sky = 53,44,75, orange = 196,98,0,
  paddle-wide = 30,40,46, top-paddle = 242,121,0.

## win
- **Task:** Add learnopengl's win state: `IsCompleted` (every brick that is not solid is destroyed); in Update, when the
  active level is completed, reset the level and the player, switch chaos on and go to `GAME_WIN`; there ENTER switches
  chaos off and goes back to the menu; draw "You WON!!!" (green) and "Press ENTER to retry or ESC to quit" (yellow).
- **Hint:** `for (GameObject& tile : level.Bricks) if (!tile.IsSolid && !tile.Destroyed) return false; return true;` –
  `RenderText(Text, "You WON!!!", 320.0f, game.Height / 2.0f - 20.0f, 1.0f, XMFLOAT3(0.0f, 1.0f, 0.0f));` and the
  second line at (130, Height / 2) in (1, 1, 0). ESC already closes the window (WindowProc).
- **Observable:** `bool IsCompleted(GameLevel& level)` before DrawLevel, the win check in Update after the loss check,
  the GAME_WIN branch in ProcessInput (after the menu's, `game.Keys[VK_RETURN]`), the win text in Render. The menu never
  ends with the fixed input: **no visible change** (as after `menu`). Checked in the code.
