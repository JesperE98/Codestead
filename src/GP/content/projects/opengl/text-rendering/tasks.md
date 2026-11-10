# Text Rendering – tasks (OpenGL)

learnopengl "Text Rendering": `src/7.in_practice/2.text_rendering`. Files: `main.cpp`, `shader_m.h`, `text.vs` and
`text.fs` (complete, learnopengl's), `fonts/Inter-Bold.otf` + `fonts/OFL.txt` (the course's font – Inter Bold under
the SIL Open Font License 1.1, which must travel with it; learnopengl uses Antonio-Bold.ttf).

**Fixed choices (the same in every API):**
- learnopengl's program: FreeType (`FT_Init_FreeType`, `FT_New_Face(ft, "fonts/Inter-Bold.otf", 0, &face)`,
  `FT_Set_Pixel_Sizes(face, 0, 48)`, `FT_Load_Char(face, c, FT_LOAD_RENDER)` for `c` = 0 … 127 – the font has only
  32 … 126; FreeType gives the others its empty "missing glyph", which is never drawn), `FT_Done_Face` /
  `FT_Done_FreeType` after loading. Glyph metrics: `bitmap.width/rows`, `bitmap_left/top`, `advance.x` (1/64 pixels,
  `>> 6`).
- The two strings: **"This is sample text" at (25, 25), scale 1.0, colour (0.5, 0.8, 0.2)** and – instead of
  "(C) LearnOpenGL.com" – **"(C) Codestead GP" at (540, 570), scale 0.5, colour (0.3, 0.7, 0.9)**. (x, y) is the
  start of the baseline in pixels from the **bottom-left**: projection `glm::ortho(0, 800, 0, 600)` (y up, as
  learnopengl's text demo; the game later uses y down). Clear (0.2, 0.3, 0.3); blending SRC_ALPHA /
  ONE_MINUS_SRC_ALPHA; back-face culling on (the glyph quads are counter-clockwise in this y-up projection).
- OpenGL: one `GL_RED` texture per glyph (`glPixelStorei(GL_UNPACK_ALIGNMENT, 1)` because a glyph row is not a
  multiple of 4 bytes), CLAMP_TO_EDGE, LINEAR; a dynamic VBO of 6 × 4 floats (`glBufferData(…, NULL,
  GL_DYNAMIC_DRAW)`) rewritten with `glBufferSubData` before each character's `glDrawArrays(GL_TRIANGLES, 0, 6)`.
  The fragment shader uses the red channel as alpha: `vec4(textColor, 1.0) * vec4(1.0, 1.0, 1.0, texture(text,
  TexCoords).r)`. Texcoords (0, 0) at the glyph's top-left: FreeType's bitmap starts with its top row, and the
  texture is not flipped.
- Vulkan / DirectX 12: per-glyph textures or one atlas – each writer chooses (an atlas is the usual way there) and
  explains; the picture must match this one pixel for pixel in the glyph shapes and positions.
- Static picture (no time, no input).

Named points (from the **top-left** of the 800×600 window, as in a screenshot): **T-bar** (40,541) – the bar of the
"T" of "This"; **i-stem** (92,561) – the "i" of "This"; **G** (706,16) and **P** (744,22) – in "GP" of the second
line; **background** (400,300) and (600,560). Line 1 covers x 26..462, y 538..584 (6,860 non-background pixels);
line 2 covers x 541..747, y 12..33 (1,940 pixels). Measured with Mesa (llvmpipe) and FreeType 2.13.

**Start picture:** only the clear colour (51,76,76) everywhere. Nothing printed.

## `freetype`
- **Task:** Initialise FreeType, load `fonts/Inter-Bold.otf` as a face, set the glyph size to 48 pixels, and free the face and the library when the glyphs are loaded.
- **Hint:** `#include <ft2build.h>` then `#include FT_FREETYPE_H`; `FT_Init_FreeType(&ft)` and `FT_New_Face(ft, path, 0, &face)` return non-zero on failure; `FT_Set_Pixel_Sizes(face, 0, 48)`; `FT_Done_Face(face); FT_Done_FreeType(ft);`.
- **When done:** `#include <ft2build.h>` and `#include FT_FREETYPE_H`; `FT_Library ft;` with `if (FT_Init_FreeType(&ft))`
  (prints `ERROR::FREETYPE: Could not init FreeType Library`, returns -1); `FT_Face face;` with `if (FT_New_Face(ft,
  "fonts/Inter-Bold.otf", 0, &face))` (error message, return -1); `FT_Set_Pixel_Sizes(face, 0, 48);`;
  `FT_Done_Face(face); FT_Done_FreeType(ft);` after the glyph TODO. **No visible change**, nothing printed.

## `glyphs`
- **Task:** Add learnopengl's `Character` struct and `Characters` map, and load the first 128 ASCII characters: render each glyph with FreeType, upload its bitmap to a `GL_RED` texture and store a `Character` for it.
- **Hint:** Set `glPixelStorei(GL_UNPACK_ALIGNMENT, 1)` first. In the loop: `FT_Load_Char(face, c, FT_LOAD_RENDER)`, then `glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, face->glyph->bitmap.width, face->glyph->bitmap.rows, 0, GL_RED, GL_UNSIGNED_BYTE, face->glyph->bitmap.buffer)`, CLAMP_TO_EDGE and LINEAR, and `Characters.insert(std::pair<char, Character>(c, character))`.
- **When done:** `struct Character { unsigned int TextureID; glm::ivec2 Size; glm::ivec2 Bearing; unsigned int
  Advance; };` and `std::map<GLchar, Character> Characters;`; before the FT_Done calls: `glPixelStorei(GL_UNPACK_ALIGNMENT,
  1);`, `for (unsigned char c = 0; c < 128; c++)` with `FT_Load_Char(face, c, FT_LOAD_RENDER)` (on failure print and
  `continue`), `glGenTextures` / `glBindTexture` / the `GL_RED` `glTexImage2D` from `face->glyph->bitmap`, the four
  `glTexParameteri` (CLAMP_TO_EDGE, LINEAR), `Character character = { texture, glm::ivec2(bitmap.width, bitmap.rows),
  glm::ivec2(bitmap_left, bitmap_top), static_cast<unsigned int>(face->glyph->advance.x) };`,
  `Characters.insert(…)`; then `glBindTexture(GL_TEXTURE_2D, 0);`. **No visible change**, nothing printed.

## `render-text`
- **Task:** Configure a VAO with a dynamic VBO for one quad (6 vertices × vec4: position xy, texcoords zw), write learnopengl's `RenderText` and draw "This is sample text" at (25, 25), scale 1.0, colour (0.5, 0.8, 0.2).
- **Hint:** `glBufferData(GL_ARRAY_BUFFER, sizeof(float) * 6 * 4, NULL, GL_DYNAMIC_DRAW)`, attribute 0 with 4 floats. In `RenderText`, for each character: `xpos = x + ch.Bearing.x * scale`, `ypos = y - (ch.Size.y - ch.Bearing.y) * scale`, `w = ch.Size.x * scale`, `h = ch.Size.y * scale`; write the 6 vertices with `glBufferSubData`, bind `ch.TextureID`, draw, then `x += (ch.Advance >> 6) * scale`.
- **When done:** globals `unsigned int VAO, VBO;` and the declaration `void RenderText(Shader &shader, std::string text,
  float x, float y, float scale, glm::vec3 color);`; learnopengl's `// configure VAO/VBO for texture quads` block;
  `RenderText(shader, "This is sample text", 25.0f, 25.0f, 1.0f, glm::vec3(0.5, 0.8f, 0.2f));` in the loop after the
  clear; the `RenderText` function (shader.use(), `glUniform3f(… "textColor" …)`, `glActiveTexture(GL_TEXTURE0)`,
  `glBindVertexArray(VAO)`, the `std::string::const_iterator` loop with `float vertices[6][4]`, `glBindTexture(GL_TEXTURE_2D,
  ch.TextureID)`, `glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(vertices), vertices)`, `glDrawArrays(GL_TRIANGLES, 0, 6)`,
  the advance). **"This is sample text" appears in green at the bottom left** (x 26..462, y 538..584 from the top;
  19 draws: one per character, the spaces draw an empty quad): T-bar = 128,204,51, i-stem = 128,204,51; G, P and the
  background 51,76,76. Edges of the letters are blended (anti-aliased by FreeType).

## `second-line`
- **Task:** Draw a second line: "(C) Codestead GP" at (540, 570), scale 0.5, colour (0.3, 0.7, 0.9).
- **Hint:** One more `RenderText` call after the first; y = 570 is near the top (y points up here).
- **When done:** `RenderText(shader, "(C) Codestead GP", 540.0f, 570.0f, 0.5f, glm::vec3(0.3, 0.7f, 0.9f));`.
  **A small light-blue line appears in the top right** (x 541..747, y 12..33): G = 76,178,230, P = 76,178,230; line 1
  unchanged (T-bar, i-stem 128,204,51); background 51,76,76. 35 draws in all. (At scale 0.5 the 48-pixel glyph
  textures are drawn at half size – learnopengl's way; for small text a real program would load the glyphs at the
  smaller size, which the game's text does later with 24 pixels.)
