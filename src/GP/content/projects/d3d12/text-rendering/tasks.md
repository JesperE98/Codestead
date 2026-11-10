# Text Rendering – tasks (DirectX 12)

learnopengl.com "Text Rendering": `src/7.in_practice/2.text_rendering`. Files: `main.cpp`, `text.hlsl` (complete:
`VSMain` maps pixel positions with `projection`, `PSMain` uses the atlas's red channel as alpha –
`float4(textColor, 1.0f) * float4(1.0f, 1.0f, 1.0f, text.Sample(clampSampler, input.texCoord).r)`),
`fonts/Inter-Bold.otf` + `fonts/OFL.txt` (the course's font – Inter Bold under the SIL Open Font License 1.1, which
must travel with it; learnopengl uses Antonio-Bold.ttf). FreeType links as `freetype.lib` (vcpkg `freetype`).

**The same as OpenGL** (see projects/opengl/text-rendering/tasks.md): learnopengl's FreeType calls
(`FT_Init_FreeType`, `FT_New_Face(ft, "fonts/Inter-Bold.otf", 0, &face)`, `FT_Set_Pixel_Sizes(face, 0, 48)`,
`FT_Load_Char(face, c, FT_LOAD_RENDER)` for c = 0 … 127, `FT_Done_Face` / `FT_Done_FreeType`), learnopengl's
`Character` / `Characters` (`std::map<char, Character>`, filled with `Characters.insert(std::pair<char, Character>(c,
character))`), its `RenderText` maths (`xpos = x + Bearing.x * scale`, `ypos = y - (Size.y - Bearing.y) * scale`,
`w`, `h`, 6 vertices per glyph in learnopengl's order, `x += (Advance >> 6) * scale`), the two strings
"This is sample text" at (25, 25), scale 1.0, colour (0.5, 0.8, 0.2) and "(C) Codestead GP" at (540, 570), scale 0.5,
colour (0.3, 0.7, 0.9); projection 0…800 × 0…600 with **y up** (`XMMatrixOrthographicOffCenterRH(0, 800, 0, 600, -1,
1)`, learnopengl's `glm::ortho(0, 800, 0, 600)`), written to the CBV in `OnUpdate`; clear (0.2, 0.3, 0.3); blending
SRC_ALPHA / INV_SRC_ALPHA; no depth buffer. Static picture.

**Direct3D 12's choices:**
- **One glyph atlas instead of 128 textures.** All glyphs go into one `DXGI_FORMAT_R8_UNORM` texture of 1024 × 512
  texels: a grid of 16 × 8 cells of 64 × 64 (character c in cell (c % 16, c / 16); the largest glyph of the font at 48
  pixels is 48 × 58). `Character` keeps the glyph's cell (`XMINT2 AtlasPos`) instead of a texture ID, and `RenderText`
  turns it into texture coordinates (`u0 = AtlasPos.x / 1024`, `u1 = (AtlasPos.x + Size.x) / 1024`, the same for v
  with 512). Why: in Direct3D 12 every texture is a resource with its own memory, upload buffer, barrier and
  descriptor (and a zero-sized one – the space, the control characters – cannot be created at all); one atlas needs
  one of each, one descriptor table for the whole text, and the glyphs can be drawn together. The bitmaps are copied
  row by row (`bitmap.pitch` bytes apart) into a CPU-side `std::vector<unsigned char>` (one byte per texel, so no
  row alignment is needed – learnopengl's `GL_UNPACK_ALIGNMENT 1`), then uploaded once with `UpdateSubresources`.
  Sampler: linear, CLAMP (learnopengl's CLAMP_TO_EDGE); the cells' empty borders keep neighbours apart.
- **All quads of a frame in one vertex buffer, one draw per line.** learnopengl rewrites one 6-vertex VBO with
  `glBufferSubData` before each character's draw. In Direct3D 12 the GPU reads a buffer only when the command list
  executes, after all of `PopulateCommandList` – overwriting one place would draw the last glyph everywhere. So the
  vertex buffer (upload heap, mapped for good, room for 256 characters = `MaxTextVertices` 1536 vertices of
  `{ XMFLOAT2 position; XMFLOAT2 texCoord; }`) gets each quad at its own place (`memcpy(m_pVertexDataBegin +
  m_textVertexCount * sizeof(Vertex), …)`), and `RenderText` records one `DrawInstanced(6 * characters, 1,
  firstVertex, 0)` per line. `m_textVertexCount` starts at 0 every frame (the GPU has finished the previous frame).
- The text colour is a root constant (`cbuffer TextConstants { float3 textColor; }`, root parameter 0, 3 values),
  set per line; culling off (`CULL_MODE_NONE`: the quads are flat; OpenGL culls back faces – nothing is lost either
  way, the quads are counter-clockwise on screen).

Named points (from the top-left of the 800 × 600 window), as in OpenGL: **T-bar** (40, 541), **i-stem** (92, 561),
**G** (706, 16), **P** (744, 22), **background** (400, 300) and (600, 560). The glyph quads are the same as OpenGL's
(same maths, same glyphs), so the picture is OpenGL's: line 1 covers x 26..462, y 538..584; line 2 x 541..747,
y 12..33.

**Start picture:** only the clear colour (51, 76, 76) everywhere. The pipeline state, root signature, `text.hlsl`,
the constant buffer with the projection and the class's members are there; `LoadGlyphs` and the drawing are TODOs.

## freetype
- **Task:** Include FreeType, initialise it, load `fonts/Inter-Bold.otf` as a face, set the glyph size to 48 pixels,
  and free the face and the library when the glyphs are loaded.
- **Hint:** `#include <ft2build.h>` then `#include FT_FREETYPE_H` (and `#pragma comment(lib, "freetype.lib")`);
  `FT_Init_FreeType(&ft)` and `FT_New_Face(ft, path, 0, &face)` return non-zero on failure – throw a
  `std::runtime_error` like the rest of the program; `FT_Set_Pixel_Sizes(face, 0, 48)`;
  `FT_Done_Face(face); FT_Done_FreeType(ft);`.
- **Observable:** in `LoadGlyphs`: `FT_Library ft;` with `if (FT_Init_FreeType(&ft))` → `throw std::runtime_error("ERROR::FREETYPE: Could not init FreeType Library")`;
  `FT_Face face;` with `if (FT_New_Face(ft, "fonts/Inter-Bold.otf", 0, &face))` → throw; `FT_Set_Pixel_Sizes(face, 0, 48);`;
  `FT_Done_Face(face); FT_Done_FreeType(ft);`. **No visible change.**

## glyphs
- **Task:** Add learnopengl's `Character` (with the glyph's place in the atlas) and `Characters`, load the first 128
  characters into the atlas and create the atlas texture with its SRV.
- **Hint:** `std::vector<unsigned char> atlas(AtlasWidth * AtlasHeight, 0)`. For each c: `FT_Load_Char(face, c,
  FT_LOAD_RENDER)` (on failure `OutputDebugStringA` and `continue`), the cell `(c % 16) * 64, (c / 16) * 64`, a
  `memcpy` per bitmap row from `face->glyph->bitmap.buffer + row * face->glyph->bitmap.pitch`, then
  `Characters.insert(std::pair<char, Character>(c, character))`. The texture: like `LoadTexture` of the earlier
  chapters with `DXGI_FORMAT_R8_UNORM`, `RowPitch = AtlasWidth`, `pData = atlas.data()`.
- **Observable:** `struct Character { XMINT2 AtlasPos; XMINT2 Size; XMINT2 Bearing; unsigned int Advance; };`,
  `std::map<char, Character> Characters;`, `AtlasCellSize = 64`, `AtlasWidth = 16 * AtlasCellSize`,
  `AtlasHeight = 8 * AtlasCellSize`; in `LoadGlyphs` before the FT_Done calls: the loop `for (unsigned char c = 0; c < 128; c++)`
  with `FT_Load_Char`, the row `memcpy` into `atlas`, `Character character = { XMINT2(cellX, cellY),
  XMINT2(bitmap.width, bitmap.rows), XMINT2(bitmap_left, bitmap_top), static_cast<unsigned int>(advance.x) }` and the
  insert; after them a `Texture2D` resource `DXGI_FORMAT_R8_UNORM` 1024 × 512 (`m_atlasTexture`), its upload heap,
  `UpdateSubresources` from `atlas.data()` (RowPitch 1024), the barrier COPY_DEST → PIXEL_SHADER_RESOURCE and
  `CreateShaderResourceView` in heap slot 1. **No visible change.**

## render-text
- **Task:** Create the vertex buffer for the glyph quads, write `RenderText` and draw "This is sample text" at
  (25, 25), scale 1.0, colour (0.5, 0.8, 0.2).
- **Hint:** The buffer: `MaxTextVertices * sizeof(Vertex)` bytes in an upload heap, mapped once into
  `m_pVertexDataBegin`, and its view. `RenderText`: set the colour with `SetGraphicsRoot32BitConstants(0, …)`,
  remember `firstVertex = m_textVertexCount`, write each character's 6 vertices after the ones before, then
  `DrawInstanced(m_textVertexCount - firstVertex, 1, firstVertex, 0)`. In `PopulateCommandList`:
  `IASetVertexBuffers`, `m_textVertexCount = 0;`, the call.
- **Observable:** the vertex buffer block in `LoadAssets` (`Map(0, &readRange, … &m_pVertexDataBegin)`, the view with
  `StrideInBytes = sizeof(Vertex)`); `D3D12App::RenderText(std::string text, float x, float y, float scale, XMFLOAT3 color)`
  with the `std::string::const_iterator` loop, `Character ch = Characters[*c];`, learnopengl's xpos/ypos/w/h, the
  atlas u0/v0/u1/v1, `Vertex vertices[6]`, `memcpy(m_pVertexDataBegin + m_textVertexCount * sizeof(Vertex), vertices, sizeof(vertices))`,
  `m_textVertexCount += 6`, the advance and one `DrawInstanced`; in `PopulateCommandList`
  `IASetVertexBuffers(0, 1, &m_vertexBufferView)`, `m_textVertexCount = 0;` and
  `RenderText("This is sample text", 25.0f, 25.0f, 1.0f, XMFLOAT3(0.5f, 0.8f, 0.2f));`.
  **"This is sample text" appears in green at the bottom left** (x 26..462, y 538..584 from the top; one draw of 114
  vertices – 19 quads, the spaces are empty ones): T-bar = i-stem = (128, 204, 51); G, P and the background
  (51, 76, 76). The letters' edges blend with the background.

## second-line
- **Task:** Draw a second line: "(C) Codestead GP" at (540, 570), scale 0.5, colour (0.3, 0.7, 0.9).
- **Hint:** One more `RenderText` call after the first; y = 570 is near the top (y points up here). Its quads go
  into the vertex buffer after the first line's.
- **Observable:** `RenderText("(C) Codestead GP", 540.0f, 570.0f, 0.5f, XMFLOAT3(0.3f, 0.7f, 0.9f));`.
  **A small light-blue line appears in the top right** (x 541..747, y 12..33): G = P = (76, 178, 230); line 1
  unchanged; background (51, 76, 76). Two draws in all (114 + 96 vertices: the second starts at vertex 114).
