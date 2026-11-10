# Text Rendering – tasks (Vulkan)

learnopengl "Text Rendering": `src/7.in_practice/2.text_rendering`. Files: `main.cpp`, `shaders/text.vert` and
`shaders/text.frag` (complete – learnopengl's text.vs / text.fs in Vulkan GLSL; built to `text.vert.spv` /
`text.frag.spv`), `fonts/Inter-Bold.otf` + `fonts/OFL.txt` (the course's font – Inter Bold under the SIL Open Font
License 1.1, which must travel with it; learnopengl uses Antonio-Bold.ttf). verify.sh links FreeType because main.cpp
includes `ft2build.h`.

**Fixed choices (the same in every API, as the OpenGL chapter):** learnopengl's program – FreeType
(`FT_Init_FreeType`, `FT_New_Face(ft, "fonts/Inter-Bold.otf", 0, &face)`, `FT_Set_Pixel_Sizes(face, 0, 48)`,
`FT_Load_Char(face, c, FT_LOAD_RENDER)` for `c` = 0 … 127; the font has only 32 … 126, FreeType gives the others its
"missing glyph", which is never drawn), `FT_Done_Face` / `FT_Done_FreeType` after loading; the two strings **"This is
sample text" at (25, 25), scale 1.0, colour (0.5, 0.8, 0.2)** and **"(C) Codestead GP" at (540, 570), scale 0.5,
colour (0.3, 0.7, 0.9)** – (x, y) is the start of the baseline in pixels from the **bottom-left**; clear (0.2, 0.3,
0.3); alpha blending SRC_ALPHA / ONE_MINUS_SRC_ALPHA; back-face culling on. Static picture (no time, no input).

**Vulkan choices:**
- **One glyph atlas instead of 128 textures.** OpenGL creates one small `GL_RED` texture per glyph and binds it before
  each character's draw. In Vulkan every texture is an image + memory + view + descriptor set (and an image cannot
  have a width of 0, which the space has), so the usual way is one image with all glyphs – an atlas – and one
  descriptor set: each character's quad samples its own rectangle of it. Here the atlas is 1024 × 512 pixels: 16 × 8
  cells of 64 × 64 (`ATLAS_CELL`), glyph `c` in cell (c % 16, c / 16) – at 48 pixels the largest glyph of Inter Bold is
  48 × 58, so each fits. `loadFont()` copies every glyph bitmap row by row (`memcpy`, rows `bitmap.pitch` bytes apart)
  into `std::vector<unsigned char> atlasPixels` and stores the cell's corner in `Character::AtlasOffset`;
  `createAtlasImage()` uploads the pixels once through a staging buffer into a **`VK_FORMAT_R8_UNORM`** image (one
  byte per pixel, read as `.r` = 0..1 – OpenGL's `GL_RED`; Vulkan has no unpack alignment to set: the copy's
  `bufferRowLength` 0 means tightly packed rows). Sampler: LINEAR, CLAMP_TO_EDGE.
- `struct Character { glm::ivec2 AtlasOffset; glm::ivec2 Size; glm::ivec2 Bearing; unsigned int Advance; };` and
  `std::map<char, Character> Characters;` (learnopengl's, with `AtlasOffset` in place of `TextureID`).
- **Projection:** in the uniform buffer, `ubo.projection = glm::ortho(0.0f, 800.0f, 600.0f, 0.0f)` (from
  `swapChainExtent`) – learnopengl's `glm::ortho(0, 800, 0, 600)` with bottom and top swapped, because Vulkan's clip
  space y points down: y = 0 (the baseline of line 1) maps to the bottom of the window, y = 600 to the top, as in
  OpenGL. No view or model matrix. The text colour is a push constant (`struct PushConstants { glm::vec3 textColor; };`,
  fragment stage – learnopengl's `textColor` uniform).
- **The quads:** one host-visible vertex buffer for `MAX_CHARACTERS` = 256 quads (6 × `Vertex { glm::vec4 vertex; }`,
  learnopengl's `<vec2 pos, vec2 tex>`), mapped for the whole run (learnopengl's GL_DYNAMIC_DRAW buffer). In OpenGL
  `glBufferSubData` may rewrite the one quad before every draw, because each draw is executed in order; a Vulkan
  command buffer runs only after it is submitted, so all draws of a frame would see the last quad. So `RenderText`
  writes each character's 6 vertices **after** those already written this frame (`vertexCount`, reset in
  `recordCommandBuffer`) and draws them with `vkCmdDraw(commandBuffer, 6, 1, vertexCount, 0)` – still one draw per
  character, like learnopengl. (The single in-flight frame and the fence wait in `drawFrame` make rewriting the buffer
  every frame safe.) Texture coordinates: the glyph's rectangle in the atlas, (u0, v0) at its top-left – FreeType's
  bitmap starts with its top row, as in OpenGL where the glyph textures are not flipped.
- **Culling:** `VK_CULL_MODE_BACK_BIT` with `VK_FRONT_FACE_COUNTER_CLOCKWISE` (learnopengl's `glEnable(GL_CULL_FACE)`):
  the quads are counter-clockwise in the y-up text coordinates, and the projection shows them upright, so they are
  counter-clockwise on screen too.
- No depth buffer (2D: the render pass has only the colour attachment).
- The start already creates the (empty) atlas image, the sampler, the descriptor set (uniform buffer + atlas), the
  pipeline (blending, culling) and the mapped vertex buffer, and binds them in `recordCommandBuffer` – the Vulkan
  set-up of the earlier chapters. The tasks are learnopengl's: FreeType, the glyphs, RenderText, the second line.

Named points (from the top-left of the 800×600 window; the same as OpenGL's): **T-bar** (40,541), **i-stem**
(92,561), **G** (706,16), **P** (744,22), **background** (400,300) and (600,560). Every state equals the OpenGL one:
line 1 pixel for pixel in shape (119 pixels differ by 3–14 levels at the letters' anti-aliased edges, where the atlas
is sampled instead of a clamped per-glyph texture); line 2 has the same shape but sits **one pixel higher** in Vulkan
(y 11..32 instead of 12..33): at scale 0.5 its quad edges fall exactly on pixel centres, and Vulkan's top-left
rasterization rule (in its y-down framebuffer) decides those ties the other way than OpenGL's (y up). Measured on
lavapipe with FreeType 2.13.

**Start picture:** only the clear colour (51,76,76) everywhere. No validation message.

## freetype
- **Task:** Initialise FreeType, load `fonts/Inter-Bold.otf` as a face, set the glyph size to 48 pixels, and free the face and the library when the glyphs are loaded.
- **Hint:** `#include <ft2build.h>` then `#include FT_FREETYPE_H`; `FT_Init_FreeType(&ft)` and `FT_New_Face(ft, path, 0, &face)` return non-zero on failure (throw a `std::runtime_error` like the rest of the program); `FT_Set_Pixel_Sizes(face, 0, 48)`; `FT_Done_Face(face); FT_Done_FreeType(ft);` – all in `loadFont()`.
- **When done:** `#include <ft2build.h>` and `#include FT_FREETYPE_H`; in `loadFont()`: `FT_Library ft;` with
  `if (FT_Init_FreeType(&ft))` (throws "ERROR::FREETYPE: Could not init FreeType Library"), `FT_Face face;` with
  `if (FT_New_Face(ft, "fonts/Inter-Bold.otf", 0, &face))` (throws "ERROR::FREETYPE: Failed to load font"),
  `FT_Set_Pixel_Sizes(face, 0, 48);`, then (after the glyph TODO) `FT_Done_Face(face); FT_Done_FreeType(ft);`.
  **No visible change**, nothing printed.

## glyphs
- **Task:** Add the `Character` struct and the `Characters` map, and load the first 128 ASCII characters: render each glyph with FreeType, copy its bitmap into its cell of the atlas and store a `Character` for it.
- **Hint:** `for (unsigned char c = 0; c < 128; c++)` with `FT_Load_Char(face, c, FT_LOAD_RENDER)` (on failure print and `continue`). The cell: `glm::ivec2 offset((c % 16) * ATLAS_CELL, (c / 16) * ATLAS_CELL);`; copy each of the `bitmap.rows` rows with `memcpy(&atlasPixels[(offset.y + row) * ATLAS_WIDTH + offset.x], &bitmap.buffer[row * bitmap.pitch], bitmap.width)`. Then `Characters.insert(std::pair<char, Character>(c, character));`. `createAtlasImage()` (already there) uploads `atlasPixels` after `loadFont()`.
- **When done:** before the class: `struct Character { glm::ivec2 AtlasOffset; glm::ivec2 Size; glm::ivec2 Bearing;
  unsigned int Advance; };` and `std::map<char, Character> Characters;`; in `loadFont()` before the FT_Done calls the
  loop `for (unsigned char c = 0; c < 128; c++)` with `FT_Load_Char(face, c, FT_LOAD_RENDER)`, the row-by-row `memcpy`
  into `atlasPixels`, `Character character = { offset, glm::ivec2(face->glyph->bitmap.width, face->glyph->bitmap.rows),
  glm::ivec2(face->glyph->bitmap_left, face->glyph->bitmap_top), static_cast<unsigned int>(face->glyph->advance.x) };`
  and `Characters.insert(std::pair<char, Character>(c, character));`. **No visible change** (the atlas now holds the
  glyphs, nothing samples it yet), nothing printed.

## render-text
- **Task:** Write `RenderText` – one quad per character, written into the vertex buffer after the quads already written this frame, and one draw for it – and draw "This is sample text" at (25, 25), scale 1.0, colour (0.5, 0.8, 0.2).
- **Hint:** Push the colour first (`vkCmdPushConstants(…, VK_SHADER_STAGE_FRAGMENT_BIT, …)`). For each character: `xpos = x + ch.Bearing.x * scale`, `ypos = y - (ch.Size.y - ch.Bearing.y) * scale`, `w = ch.Size.x * scale`, `h = ch.Size.y * scale`; its atlas rectangle `u0 = ch.AtlasOffset.x / (float) ATLAS_WIDTH` … `v1 = (ch.AtlasOffset.y + ch.Size.y) / (float) ATLAS_HEIGHT`; learnopengl's `float vertices[6][4]` with (u0, v0) at the top-left corner (xpos, ypos + h); `memcpy((char*) vertexBufferMapped + vertexCount * sizeof(Vertex), vertices, sizeof(vertices));`, `vkCmdDraw(commandBuffer, 6, 1, vertexCount, 0);`, `vertexCount += 6;`, then `x += (ch.Advance >> 6) * scale`. In `recordCommandBuffer`: `vertexCount = 0;` and the call.
- **When done:** the member function `void RenderText(VkCommandBuffer commandBuffer, std::string text, float x, float y,
  float scale, glm::vec3 color)` (`vkCmdPushConstants` with `constants.textColor = color`, the
  `std::string::const_iterator` loop, `Character ch = Characters[*c];`, `float vertices[6][4]`, the `memcpy` at
  `vertexCount`, `vkCmdDraw(commandBuffer, 6, 1, vertexCount, 0)`, the advance); in `recordCommandBuffer()` after
  binding the descriptor set: `vertexCount = 0;` and `RenderText(commandBuffer, "This is sample text", 25.0f, 25.0f,
  1.0f, glm::vec3(0.5, 0.8f, 0.2f));`. **"This is sample text" appears in green at the bottom left** (x 26..462,
  y 538..584 from the top; 19 draws, one per character – the spaces draw an empty quad): T-bar = 128,204,51,
  i-stem = 128,204,51; G, P and the background 51,76,76.

## second-line
- **Task:** Draw a second line: "(C) Codestead GP" at (540, 570), scale 0.5, colour (0.3, 0.7, 0.9).
- **Hint:** One more `RenderText` call after the first; y = 570 is near the top (y points up in these coordinates).
- **When done:** `RenderText(commandBuffer, "(C) Codestead GP", 540.0f, 570.0f, 0.5f, glm::vec3(0.3, 0.7f, 0.9f));`
  after the first call. **A small light-blue line appears in the top right** (x 541..747, y 11..32 – OpenGL 12..33, see
  above): G = 76,178,230, P = 76,178,230; line 1 unchanged (T-bar, i-stem 128,204,51); background 51,76,76. 35 draws in
  all, the vertex buffer holds 210 vertices. (The 48-pixel glyphs are drawn at half size – learnopengl's way; small
  text would rather load the glyphs at the smaller size, as the game's text does later with 24 pixels.)
