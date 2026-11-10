# Render text (Hedgerow) – tasks (Vulkan)

**Screenshot time: t = 3.0 s (frame 180)** (verify.sh `VERIFY_T=3.0`; the simulator runs the loop 181 times) – as the
OpenGL chapter (`../../opengl/render-text/tasks.md`).

learnopengl "2D Game / Render text": `text_renderer.h/.cpp`, `text_2d.vs/.frag` and the text, lives, menu and win
parts of `game.h/.cpp` and `program.cpp` (KeysProcessed). Files: `main.cpp` (= `powerups`' solution – which `audio`
keeps – with TODOs), the shaders + **`shaders/text_2d.vert`, `shaders/text_2d.frag`** (new, built to `text_2d.vert.spv` / `.frag.spv`;
their start bodies compile and draw nothing useful), **`fonts/Inter-Bold.otf` + `fonts/OFL.txt`** (the course's font, SIL Open Font License; learnopengl's game uses
OCRAEXT.TTF), `textures/`, `levels/`. See `../game-setup/tasks.md` for the fixed choices of the whole game and
`../text-rendering/tasks.md` for the FreeType technique.

**What happens with the fixed input** (only SPACE, in frames 30–32):
- Until `menu`, the game starts in GAME_ACTIVE as before: the ball is released in frame 30, bounces off the stone in
  frame 86 and is lost in frame 151. With `lives` that costs a life: **"Lives:2" at 3.0 s**, the ball back on the paddle.
- From `menu` on, the game starts in **GAME_MENU** (learnopengl's): ENTER is never pressed, so it **stays in the
  menu** – SPACE does nothing there (only GAME_ACTIVE reads it), the ball stays on the paddle (Update still runs:
  the particles keep spawning at the stuck ball), nothing is lost: "Lives:3", and the menu's two lines over the level.
  The win screen never shows (no brick breaks): `win` is checked in the code.

**Fixed choices (as OpenGL, except the TextRenderer's Vulkan parts):**
- The first task removes `powerups`' six test power-ups (their job is done; the real game spawns power-ups from broken
  bricks only).
- learnopengl's TextRenderer as structs and functions in a section `// TextRenderer (learnopengl: text_renderer.h)`
  after the PostProcessor, with learnopengl's names: `struct Character`, `struct TextRenderer`, the global
  `TextRenderer Text;`, the constructor `InitTextRenderer`, `Load(TextRenderer& renderer, std::string font, unsigned
  int fontSize)` and the free function `RenderText(TextRenderer& renderer, std::string text, float x, float y, float
  scale, glm::vec3 color = glm::vec3(1.0f))` with learnopengl's layout: (x, y) is the text's **top-left** corner – `ypos
  = y + (Characters['H'].Bearing.y - ch.Bearing.y) * scale` –, `x += (ch.Advance >> 6) * scale`. In Init after the
  postprocessor and the sprite/particle pipelines: `InitTextRenderer(Text); Load(Text, "fonts/Inter-Bold.otf", 24);`
  (**24 px**, the size the simulator's FreeType table has).
- **Vulkan: the glyph atlas** (as in the text-rendering chapter, `../text-rendering/tasks.md`): instead of one GL_RED
  texture per glyph, `Load` copies FreeType's bitmaps into one `VK_FORMAT_R8_UNORM` image, `TextRenderer::Atlas` (a
  Texture2D: image, memory, view, descriptor set – the game's uniform buffer at binding 0, the atlas at binding 1), each
  character in a 32 × 32 cell (16 × 8 cells, 512 × 256 pixels; the font's largest glyph at 24 px is 24 × 29);
  `Character` stores `AtlasOffset` instead of a texture ID. `createAtlasImage` uploads it (staging buffer, copy, layout
  transitions). `Load` and `InitTextRenderer` need the device: they are members of the application class; `Load` is
  called once (a second call would first have to destroy the atlas).
- **Vulkan: the text pipeline and vertex buffer**: `InitTextRenderer(TextRenderer& renderer)` loads the text shader as
  `"text"` for the **window's render pass** with 1 sample and alpha blending (the text is drawn after the
  postprocessing quad, so no effect touches it) and makes learnopengl's VBO as one host-visible vertex buffer for
  `MAX_CHARACTERS` = 256 characters, mapped while the program runs. The projection is the game's uniform buffer (pixels
  from the top-left, y down) – learnopengl's `glm::ortho(0, width, height, 0)` – so InitTextRenderer needs no width and
  height. RenderText binds the text pipeline, pushes the colour (`TextConstants { vec3 textColor; }`), binds the
  atlas's descriptor set and the buffer, and for every character writes its quad **after the ones already written this
  frame** (`renderer.vertexCount`, reset to 0 in `recordCommandBuffer`, which also hands the command buffer to `Text`)
  and draws it with `vkCmdDraw(…, 6, 1, renderer.vertexCount, 0)` – learnopengl's glBufferSubData into one quad would
  overwrite vertices the GPU has not read yet. The quad's texture coordinates are the glyph's rectangle in the atlas
  (v0 = its top row).
- `struct Game` gains `bool KeysProcessed[1024] = {};` and `unsigned int Lives = 3;`; `State` starts as `GAME_MENU`.
  The key callback clears `KeysProcessed[key]` on release (learnopengl's program.cpp).
- Lives (learnopengl's Update): when the ball is lost `--game.Lives;`, at 0 `ResetLevel(game); game.State =
  GAME_MENU;`, then `ResetPlayer(game);`; ResetLevel sets `game.Lives = 3;`. Text: `RenderText(Text, "Lives:" +
  std::to_string(game.Lives), 5.0f, 5.0f, 1.0f);` after the postprocessing quad (the text is not post-processed;
  learnopengl builds the number with a std::stringstream – the course uses std::to_string).
- Menu (learnopengl's ProcessInput): ENTER → GAME_ACTIVE, W → next level `(Level + 1) % 4`, S → previous (3 after 0),
  each only once per key press (`!game.KeysProcessed[key]`, then set it). Render draws the scene in all three states
  (`if (game.State == GAME_ACTIVE || game.State == GAME_MENU || game.State == GAME_WIN)`), then in the menu
  `RenderText(Text, "Press ENTER to start", 250.0f, game.Height / 2.0f, 1.0f);` and `RenderText(Text, "Press W or S to
  select level", 245.0f, game.Height / 2.0f + 20.0f, 0.75f);` – learnopengl's positions (made for OCR A; with Inter the
  lines sit a little left of the centre).
- Win: `bool IsCompleted(GameLevel& level)` (every non-solid brick destroyed – learnopengl's GameLevel::IsCompleted) in
  the GameLevel section; Update: `if (game.State == GAME_ACTIVE && IsCompleted(game.Levels[game.Level])) {
  ResetLevel(game); ResetPlayer(game); Effects.Chaos = true; game.State = GAME_WIN; }`; ProcessInput in GAME_WIN: ENTER
  → `KeysProcessed[ENTER] = true; Effects.Chaos = false; State = GAME_MENU`; Render: "You WON!!!" at (320, Height / 2 −
  20) green (0, 1, 0) and "Press ENTER to retry or ESC to quit" at (130, Height / 2) yellow (1, 1, 0), scale 1.

Named points (OpenGL's; from the top-left, 800×600, frame 180, measured on lavapipe; inside the glyphs' strokes, 3 × 3 neighbourhoods
white too): **lives-L** (8,12) – the "L" of "Lives:"; **lives-text** (33,21) – in "ve"; **digit2** (81,17) – inside a
"2" but not a "3"; **digit3** (87,17) – inside a "3" but not a "2"; **menu** (325,302) – in "Press ENTER to start";
**menu-small** (312,331) – in "Press W or S to select level"; **ball** (400,567) – the ball on the paddle; **paddle-wide**
(480,590); **top-paddle** (442,12); **sky** (200,250); **orange** (396,29). **Every named point equals OpenGL's in every
state.** The whole pictures differ in at most 4 pixels, except in `menu` / `win`: 164 pixels (126 by more than 24)
along the bottom row of the 0.75-scaled line (pixel row 333, where its quads end exactly at pixel centres – the
top-left rule, see `levels`) and at a few glyph edges, where the atlas's neighbouring texels (0) are filtered in
instead of OpenGL's CLAMP_TO_EDGE per-glyph texture.

**Start picture** (= `powerups`' end at 3.0 s: confused, the 150 px paddle): lives-L = 225,215,209, lives-text =
225,215,209, digit2 = 225,215,209, digit3 = 225,215,209, menu = 192,205,175, menu-small = 199,209,178, ball =
62,158,255, paddle-wide = 120,187,255, top-paddle = 41,85,183, sky = 180,199,170, orange = 95,39,102.

## remove-test
- **Task:** The power-ups work: remove the six test power-ups from Init.
- **Hint:** Delete the comment and the six `game.PowerUps.push_back(…)` lines after `Ball = MakeBallObject(…);`.
- **When done:** Init ends with the ball's MakeBallObject line. **The normal game again**: nothing is caught, the
  picture is not confused, the paddle 100 px; the ball is lost in frame 151 and back on the paddle: lives-L =
  221,111,0, lives-text = 210,105,0, digit2 = 222,111,0, digit3 = 193,97,0 (the orange bricks), menu = 64,50,80,
  menu-small = 70,54,83 (the sky), ball = 192,230,180, paddle-wide = 30,40,46, top-paddle = 242,121,0, sky = 53,44,75,
  orange = 196,98,0.

## text-renderer
- **Task:** Add `struct TextConstants` (the text shader's colour), `struct Character` (with its place in the atlas), the atlas's size and `struct TextRenderer`, and the member `InitTextRenderer` (the text shader's pipeline for the window's render pass, the vertex buffer for 256 characters, mapped); write the text shader; set up the global `Text` in Init and destroy its buffer in `cleanup()`.
- **Hint:** `renderer.TextShader = LoadShader("shaders/text_2d.vert.spv", "shaders/text_2d.frag.spv", "text", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, renderPass, VK_SAMPLE_COUNT_1_BIT);` and `createBuffer(sizeof(Vertex) * 6 * MAX_CHARACTERS, VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, …HOST_VISIBLE | HOST_COHERENT…)` + `vkMapMemory(…, &renderer.VBOMapped)`. Fragment shader: `vec4 sampled = vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r); color = vec4(pc.textColor, 1.0) * sampled;`.
- **When done:** `struct TextConstants { glm::vec3 textColor; };` before `struct UniformBufferObject`; `struct
  Character { glm::ivec2 AtlasOffset; glm::ivec2 Size; glm::ivec2 Bearing; unsigned int Advance; };`, `ATLAS_CELL` 32,
  `ATLAS_WIDTH` / `ATLAS_HEIGHT`, `MAX_CHARACTERS` 256 and `struct TextRenderer` (Characters, TextShader, Atlas, VBO,
  VBOMemory, VBOMapped, vertexCount, pipelineLayout, commandBuffer) in the TextRenderer section; the member `void
  InitTextRenderer(TextRenderer& renderer)`; text_2d.vert (`gl_Position = ubo.projection * vec4(vertex.xy, 0.0, 1.0);
  TexCoords = vertex.zw;`) and text_2d.frag; `TextRenderer   Text;` after `PostProcessor  Effects;`;
  `InitTextRenderer(Text);` in Init after the particle shader; `vkDestroyBuffer(device, Text.VBO, nullptr);
  vkFreeMemory(device, Text.VBOMemory, nullptr);` in `cleanup()`. Four pipelines; **no visible change** (as after
  `remove-test`).

## load-font
- **Task:** Write the member `Load`: with FreeType, load the font at the given pixel size, copy each of the first 128 ASCII characters' bitmaps into its cell of the atlas pixels and store its `Character` (atlas offset, size, bearing, advance); then make the atlas image (`createAtlasImage`) and its descriptor set; load `fonts/Inter-Bold.otf` at 24 pixels in Init; destroy the atlas in `cleanup()`.
- **Hint:** The text-rendering chapter's loop: `FT_Init_FreeType`, `FT_New_Face(ft, font.c_str(), 0, &face)`, `FT_Set_Pixel_Sizes(face, 0, fontSize)`, `FT_Load_Char(face, c, FT_LOAD_RENDER)`, `glm::ivec2 offset((c % 16) * ATLAS_CELL, (c / 16) * ATLAS_CELL);` and a memcpy per bitmap row (`pitch` bytes apart); `renderer.Characters.insert(std::pair<char, Character>(c, character));`; `createDescriptorSet(uniformBuffer, sizeof(UniformBufferObject), renderer.Atlas.View, textureSampler, renderer.Atlas.DescriptorSet);`.
- **When done:** `#include <ft2build.h>` / `#include FT_FREETYPE_H`; the members `void Load(TextRenderer& renderer,
  std::string font, unsigned int fontSize)` (errors thrown as std::runtime_error with learnopengl's messages, as the
  text-rendering chapter) and `void createAtlasImage(const std::vector<unsigned char>& pixels, Texture2D& atlas)`
  (`VK_FORMAT_R8_UNORM`); `Load(Text, "fonts/Inter-Bold.otf", 24);` after InitTextRenderer; the atlas's view, image and
  memory destroyed in `cleanup()`. Nothing is drawn with it yet: **no visible change**. (The project now links
  FreeType; the descriptor pool holds 14 of its 16 sets.)

## lives
- **Task:** Give the player 3 lives: losing the ball costs one; with none left the level is reset and the game goes back to the menu; ResetLevel gives the 3 lives back.
- **Hint:** `unsigned int Lives = 3;` in Game. In Update's loss check: `--game.Lives; if (game.Lives == 0) { ResetLevel(game); game.State = GAME_MENU; } ResetPlayer(game);` – ResetLevel no longer runs on every lost ball. `game.Lives = 3;` at the end of ResetLevel.
- **When done:** the field, learnopengl's loss check (the level is no longer reloaded when a ball is lost, only at game
  over), `game.Lives = 3;` in ResetLevel. Lives becomes 2 in frame 151, but nothing shows it yet: **no visible change**
  (no brick was broken, so not reloading the level changes nothing either).

## render-text
- **Task:** Write `RenderText`: bind the text pipeline, push the colour and bind the atlas; for each character write a quad of the glyph's size at its bearing, from the text's top-left corner (x, y), with the glyph's rectangle of the atlas, after the quads already written this frame, and draw it; then advance x. Show `"Lives:"` and the number of lives at (5, 5) after the postprocessing quad; in `recordCommandBuffer` give `Text` the command buffer and start its vertex count at 0.
- **Hint:** `float xpos = x + ch.Bearing.x * scale; float ypos = y + (renderer.Characters['H'].Bearing.y - ch.Bearing.y) * scale;` – the six vertices from (xpos, ypos) to (xpos + w, ypos + h) with the atlas coordinates u0…u1, v0…v1 (v0 at the top: the bitmap's first row). `memcpy((char*) renderer.VBOMapped + renderer.vertexCount * sizeof(Vertex), vertices, sizeof(vertices)); vkCmdDraw(renderer.commandBuffer, 6, 1, renderer.vertexCount, 0); renderer.vertexCount += 6;` `RenderText(Text, "Lives:" + std::to_string(game.Lives), 5.0f, 5.0f, 1.0f);`.
- **When done:** `void RenderText(TextRenderer& renderer, std::string text, float x, float y, float scale, glm::vec3
  color = glm::vec3(1.0f))` (above) after the TextRenderer struct; the Lives line after `Render(Effects, …);` (in the
  window's render pass); `Text.commandBuffer = commandBuffer; Text.vertexCount = 0;` in `recordCommandBuffer`.
  **"Lives:2" in white at the top left** (7 more draws, one per character): lives-L = 255,255,255, lives-text =
  255,255,255, digit2 = 255,255,255, digit3 = 193,97,0 (not in a "2"); everything else as after `remove-test`.

## menu
- **Task:** Add learnopengl's menu: the game starts in `GAME_MENU`; ENTER starts it, W and S choose the level – each only once per key press (`KeysProcessed`, cleared on release in the key callback); draw the scene in the menu and win states too, and in the menu the two lines "Press ENTER to start" (250, Height / 2, scale 1) and "Press W or S to select level" (245, Height / 2 + 20, scale 0.75).
- **Hint:** `if (game.State == GAME_MENU) { if (game.Keys[GLFW_KEY_ENTER] && !game.KeysProcessed[GLFW_KEY_ENTER]) { game.State = GAME_ACTIVE; game.KeysProcessed[GLFW_KEY_ENTER] = true; } … }` before the GAME_ACTIVE block. In Render: `if (game.State == GAME_ACTIVE || game.State == GAME_MENU || game.State == GAME_WIN)` around the scene, then `if (game.State == GAME_MENU) { RenderText(…); RenderText(…); }`.
- **When done:** `GameState State = GAME_MENU;` and `bool KeysProcessed[1024] = {};` in Game; the menu branch in
  ProcessInput; Render's condition and the menu text; in the key callback `{ Hedgerow.Keys[key] = false;
  Hedgerow.KeysProcessed[key] = false; }` on release. **The menu over the level**: the game never starts (no ENTER),
  so the ball stays on the paddle and no life is lost: "Lives:3" (digit2 = 222,111,0, digit3 = 255,255,255), menu =
  255,255,255, menu-small = 255,255,255, lives-L = 255,255,255, lives-text = 255,255,255, ball = 192,230,180, sky =
  53,44,75, orange = 196,98,0, paddle-wide = 30,40,46, top-paddle = 242,121,0.

## win
- **Task:** Add learnopengl's win state: `IsCompleted` (every brick that is not solid is destroyed); in Update, when the active level is completed, reset the level and the player, switch chaos on and go to `GAME_WIN`; there ENTER switches chaos off and goes back to the menu; draw "You WON!!!" (green) and "Press ENTER to retry or ESC to quit" (yellow).
- **Hint:** `for (GameObject& tile : level.Bricks) if (!tile.IsSolid && !tile.Destroyed) return false; return true;` – `RenderText(Text, "You WON!!!", 320.0f, game.Height / 2.0f - 20.0f, 1.0f, glm::vec3(0.0f, 1.0f, 0.0f));` and the second line at (130, Height / 2) in (1, 1, 0).
- **When done:** `bool IsCompleted(GameLevel& level)` before DrawLevel, the win check in Update after the loss check,
  the GAME_WIN branch in ProcessInput (after the menu's), the win text in Render. The menu never ends with the fixed
  input: **no visible change** (as after `menu`). Checked in the code.
