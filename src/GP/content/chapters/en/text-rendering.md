# Text Rendering

At some stage of your graphics adventures you will want to draw text in {{api}}. Contrary to what you may expect,
getting a simple string to render on screen is all but easy with a low-level API like {{api}}. If you don't care about
rendering more than 128 different same-sized characters, then it's probably not too difficult. Things are getting
difficult as soon as each character has a different width, height, and margin. Based on where you live, you may also
need more than 128 characters, and what if you want to express special symbols for like mathematical expressions or
sheet music symbols, and what about rendering text from top to bottom? Once you think about all these complicated
matters of text, it wouldn't surprise you that this probably doesn't belong in a low-level API like {{api}}.

Since there is no support for text capabilities within {{api}}, it is up to us to define a system for rendering text
to the screen. There are no graphical primitives for text characters, we have to get creative. Some example
techniques are: drawing letter shapes as lines and triangles, rendering a font's glyphs into textures and drawing
textured quads, or more exotic methods that evaluate the curves of the glyphs in the shader. This chapter takes the
second road, the one most programs take: the glyphs become textures, and every character is a small textured quad –
exactly what the 2D game of this part will need for its menus and its lives counter.

## Classical text rendering: bitmap fonts

In the early days, rendering text involved selecting a font (or create one yourself) you'd like for your application
and extracting all relevant characters out of this font to place them within a single large texture. Such a texture,
that we call a *bitmap font*, contains all character symbols we want to use in predefined regions of the texture.
These character symbols of the font are known as *glyphs*. Each glyph has a specific region of texture coordinates
associated with them. Whenever you want to render a character, you select the corresponding glyph by rendering this
section of the bitmap font to a 2D quad.

Imagine such a texture as a grid: 16 characters to a row, the printable ASCII characters from the space to the tilde in
the rows from top to bottom, each in a cell of the same size. To draw "Hello", you draw five quads next to each other,
each with the texture coordinates of its letter's cell. With blending, the background of the bitmap does not show and
only the character ends up on the screen.

This approach has several advantages and disadvantages. It is relatively easy to implement and because bitmap fonts
are pre-rasterized, they're quite efficient. However, it is not particularly flexible. When you want to use a different
font, you need to recompile a complete new bitmap font and the system is limited to a single resolution; zooming will
quickly show pixelated edges. Furthermore, it is limited to a small character set, so Extended or Unicode characters
are often out of the question.

This approach was quite popular back in the day (and still is) since it is fast and works on any platform, but as of
today more flexible approaches exist. One of these approaches is loading TrueType fonts using the FreeType library.

## Modern text rendering: FreeType

FreeType is a software development library that is able to load fonts, render them to bitmaps, and provide support for
several font-related operations. It is a popular library used by Mac OS X, Java, PlayStation, Linux, and Android to
name a few. What makes FreeType particularly attractive is that it is able to load TrueType fonts.

A TrueType font is a collection of character glyphs not defined by pixels or any other non-scalable solution, but by
mathematical equations (combinations of splines). Similar to vector images, the rasterized font images can be
procedurally generated based on the preferred font height you'd like to obtain them in. By using TrueType fonts you can
easily render character glyphs of various sizes without any loss of quality. The same holds for OpenType fonts
(`.otf`), the successor of TrueType that FreeType reads just as well – their outlines are either TrueType's quadratic
or PostScript's cubic curves.

FreeType can be downloaded from its website; you can choose to compile the library yourself or use one of the
precompiled libraries (on Windows, for example, the vcpkg package `freetype`; on Linux the distribution's
`libfreetype` development package). Be sure to link to `freetype.lib` (or `-lfreetype`) and make sure your compiler
knows where to find the header files.

Then include the appropriate headers:

```cpp
#include <ft2build.h>
#include FT_FREETYPE_H
```

Due to how FreeType is developed (at least at the time of this writing), you cannot put their header files in a new
directory; they should be located at the root of your include directories. Including FreeType like
`#include <FreeType/ft2build.h>` will likely cause several header conflicts.

**The course's font.** learnopengl uses the font Antonio Bold. The course uses **Inter Bold** (`fonts/Inter-Bold.otf`,
reduced to the printable ASCII characters), which is free under the SIL Open Font License 1.1 – the license must travel
with the font, so `fonts/OFL.txt` lies next to it in the project. The course's checks have no FreeType of their own:
they stand in for it with the glyphs FreeType renders from this font at **48 and 24 pixels** (the size this chapter
uses, and the one the game's text will use later). With the real FreeType in your program any size works.

FreeType loads these TrueType fonts and, for each glyph, generates a bitmap image and calculates several metrics.
We can extract these bitmap images for generating textures and position each character glyph appropriately using the
loaded metrics.

To load a font, all we have to do is initialize the FreeType library and load the font as a *face* as FreeType likes
to call it. Here we load the font file:

:::opengl
```cpp
    FT_Library ft;
    // All functions return a value different than 0 whenever an error occurred
    if (FT_Init_FreeType(&ft))
    {
        std::cout << "ERROR::FREETYPE: Could not init FreeType Library" << std::endl;
        return -1;
    }

    // load font as face
    FT_Face face;
    if (FT_New_Face(ft, "fonts/Inter-Bold.otf", 0, &face))
    {
        std::cout << "ERROR::FREETYPE: Failed to load font" << std::endl;
        return -1;
    }
```
:::
:::vulkan
```cpp
        FT_Library ft;
        // All functions return a value different than 0 whenever an error occurred
        if (FT_Init_FreeType(&ft)) {
            throw std::runtime_error("ERROR::FREETYPE: Could not init FreeType Library");
        }

        // load font as face
        FT_Face face;
        if (FT_New_Face(ft, "fonts/Inter-Bold.otf", 0, &face)) {
            throw std::runtime_error("ERROR::FREETYPE: Failed to load font");
        }
```

(in `loadFont()`, which `initVulkan()` calls before `createAtlasImage()`; errors become exceptions, like everywhere in
the vulkan-tutorial code)
:::
:::d3d12
```cpp
    FT_Library ft;
    // All functions return a value different than 0 whenever an error occurred
    if (FT_Init_FreeType(&ft))
    {
        throw std::runtime_error("ERROR::FREETYPE: Could not init FreeType Library");
    }

    // load font as face
    FT_Face face;
    if (FT_New_Face(ft, "fonts/Inter-Bold.otf", 0, &face))
    {
        throw std::runtime_error("ERROR::FREETYPE: Failed to load font");
    }
```

(in `LoadGlyphs`, which `LoadAssets` calls while the setup command list is open; errors become exceptions, like the
`ThrowIfFailed` calls everywhere else; `#pragma comment(lib, "freetype.lib")` next to the other libraries tells Visual
Studio to link it)
:::

Each of these FreeType functions returns a non-zero integer whenever an error occurred.

Once we've loaded the face, we should define the pixel font size we'd like to extract from this face:

```cpp
FT_Set_Pixel_Sizes(face, 0, 48);
```

The function sets the font's width and height parameters. Setting the width to 0 lets the face dynamically calculate
the width based on the given height. The 48 is the size of the font's *em*, the nominal size – not the height of every
glyph: letters with ascenders and descenders and characters like brackets reach further. In Inter Bold at 48 pixels the
largest glyph is 48 × 58 pixels.

A FreeType face hosts a collection of glyphs. We can set one of those glyphs as the active glyph by calling
`FT_Load_Char`. Here we choose to load the character glyph 'X':

```cpp
if (FT_Load_Char(face, 'X', FT_LOAD_RENDER))
{
    std::cout << "ERROR::FREETYPE: Failed to load Glyph" << std::endl;
    return -1;
}
```

By setting `FT_LOAD_RENDER` as one of the loading flags, we tell FreeType to create an 8-bit grayscale bitmap image
for us that can be accessed via `face->glyph->bitmap`.

Each of the glyphs we load with FreeType however, do not have the same size (as we had with bitmap fonts). The bitmap
image generated by FreeType is just large enough to contain the visible part of a character. For example, the bitmap
image of the dot character '.' is much smaller in dimensions than the bitmap image of the character 'X'. For this
reason, FreeType also loads several metrics that specify how large each character should be and how to properly
position them.

Picture a glyph standing on a horizontal line, the *baseline*, the line the letters of a word stand on. A point on the
baseline, the *origin*, is where the pen is when the glyph is drawn. From there:

- the glyph's bitmap begins a little to the right of the origin – that distance is the horizontal *bearing*;
- its top is a distance above the baseline – the vertical *bearing*;
- the bitmap has a width and a height; for letters like 'p' or 'g' part of it hangs below the baseline;
- and the pen moves on to the next glyph's origin by the *advance*, which includes the space between the glyphs.

Each of these properties is in FreeType's glyph:

| Property | FreeType | Meaning |
|---|---|---|
| width | `face->glyph->bitmap.width` | the width (in pixels) of the bitmap |
| height | `face->glyph->bitmap.rows` | the height (in pixels) of the bitmap |
| bearingX | `face->glyph->bitmap_left` | the horizontal bearing: the distance from the origin to the left of the bitmap |
| bearingY | `face->glyph->bitmap_top` | the vertical bearing: the distance from the baseline to the top of the bitmap |
| advance | `face->glyph->advance.x` | the horizontal advance: the distance from this origin to the next one, in 1/64 pixels |

We could load a character glyph, retrieve its metrics, and generate a texture each time we want to render a character
to the screen, but it would be inefficient to do this each frame. We'd rather store the generated data somewhere in the
application and query it whenever we want to render a character. We'll define a convenient struct that we'll store in
a `std::map`.

:::opengl
```cpp
struct Character {
    unsigned int TextureID; // ID handle of the glyph texture
    glm::ivec2   Size;      // Size of glyph
    glm::ivec2   Bearing;   // Offset from baseline to left/top of glyph
    unsigned int Advance;   // Horizontal offset to advance to next glyph
};

std::map<GLchar, Character> Characters;
```
:::
:::vulkan
```cpp
struct Character {
    glm::ivec2   AtlasOffset; // where the glyph's bitmap is in the atlas (pixels, top-left corner)
    glm::ivec2   Size;        // Size of glyph
    glm::ivec2   Bearing;     // Offset from baseline to left/top of glyph
    unsigned int Advance;     // Horizontal offset to advance to next glyph
};

std::map<char, Character> Characters;
```

learnopengl's struct keeps the ID of each glyph's own texture. The Vulkan project keeps all glyphs in one image instead
(see below), so `AtlasOffset` – where the glyph is in that image – takes the texture ID's place.
:::
:::d3d12
```cpp
struct Character {
    XMINT2       AtlasPos;  // Top-left texel of the glyph's bitmap in the atlas
    XMINT2       Size;      // Size of glyph
    XMINT2       Bearing;   // Offset from baseline to left/top of glyph
    unsigned int Advance;   // Horizontal offset to advance to next glyph
};

std::map<char, Character> Characters;
```

learnopengl's struct keeps the ID of each glyph's own texture. The Direct3D 12 project keeps all glyphs in one texture
instead (see below), so `AtlasPos` – where the glyph is in that texture – takes the texture ID's place.
:::

For this chapter we'll keep things simple by restricting ourselves to the first 128 characters of the ASCII character
set. For each character, we generate a texture and store its relevant data into a `Character` struct that we add to the
`Characters` map. This way, all data required to render each character is stored for later use. (The course's font
only contains the printable characters 32 to 126; for the others FreeType hands back the font's empty "missing glyph",
which the program loads but never draws.)

Now do the first task, **freetype**: include FreeType, initialise it, load `fonts/Inter-Bold.otf` as a face, set the
size to 48 pixels, and free the face and the library once the glyphs are loaded – with the glyphs in between, which the
next task fills in:

```cpp
FT_Done_Face(face);
FT_Done_FreeType(ft);
```

Build and run: still only the clear colour, (0.2, 0.3, 0.3), and nothing printed – nothing is drawn yet.

:::opengl
### One texture per glyph

learnopengl generates a texture for each glyph: within the for loop, for each of the 128 characters, it loads the glyph
and creates a texture from its bitmap.

```cpp
    // disable byte-alignment restriction
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);

    // load first 128 characters of ASCII set
    for (unsigned char c = 0; c < 128; c++)
    {
        // Load character glyph
        if (FT_Load_Char(face, c, FT_LOAD_RENDER))
        {
            std::cout << "ERROR::FREETYPE: Failed to load Glyph" << std::endl;
            continue;
        }
        // generate texture
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);
        glTexImage2D(
            GL_TEXTURE_2D,
            0,
            GL_RED,
            face->glyph->bitmap.width,
            face->glyph->bitmap.rows,
            0,
            GL_RED,
            GL_UNSIGNED_BYTE,
            face->glyph->bitmap.buffer
        );
        // set texture options
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        // now store character for later use
        Character character = {
            texture,
            glm::ivec2(face->glyph->bitmap.width, face->glyph->bitmap.rows),
            glm::ivec2(face->glyph->bitmap_left, face->glyph->bitmap_top),
            static_cast<unsigned int>(face->glyph->advance.x)
        };
        Characters.insert(std::pair<char, Character>(c, character));
    }
    glBindTexture(GL_TEXTURE_2D, 0);
```

Within the for loop we list over all the 128 characters of the ASCII set and retrieve their corresponding character
glyphs. For each character: we generate a texture, set its options, and store its metrics. What is interesting to note
here is that we use `GL_RED` as the texture's `internalFormat` and `format` arguments. The bitmap generated from the
glyph is a grayscale 8-bit image where each color is represented by a single byte. For this reason we'd like to store
each byte of the bitmap buffer as the texture's single color value. We accomplish this by creating a texture where
each byte corresponds to the texture color's red component (first byte of its color vector). If we use a single byte to
represent the colors of a texture we do need to take care of a restriction of OpenGL:

```cpp
glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
```

OpenGL requires that textures all have a 4-byte alignment e.g. their size is always a multiple of 4 bytes. Normally
this won't be a problem since most textures have a width that is a multiple of 4 and/or use 4 bytes per pixel, but
since we now only use a single byte per pixel, the texture can have any possible width. More precisely: OpenGL expects
every *row* of the image data to start at a multiple of 4 bytes. A glyph 13 pixels wide has rows of 13 bytes, and with
the default alignment OpenGL would read 16 bytes per row – every row after the first shifted a little further, the
glyph sheared into garbage. By setting its unpack alignment to 1, we ensure there are no alignment issues (which could
cause segmentation faults).

Be sure to clear FreeType's resources once you're finished processing the glyphs – which is why `FT_Done_Face` and
`FT_Done_FreeType` come after the loop.
:::
:::vulkan
### One atlas for all glyphs

learnopengl creates one small `GL_RED` texture per glyph – 128 textures – and binds the glyph's texture before each
character is drawn. In Vulkan every texture is an image, its memory, an image view and a descriptor (set) that a draw
binds; 128 of each, and a different descriptor set bound before every character, would be a lot of objects for some
text. What is more, an image cannot have a width or height of 0 – and the space, which has no visible pixels, has a
bitmap of 0 × 0. So Vulkan programs usually put all glyphs into **one image, a glyph atlas**: the classic bitmap font's
idea, filled from the font by FreeType at run time. Each character's quad then samples its own rectangle of that one
image, and one descriptor set serves the whole text.

The project's atlas is 1024 × 512 pixels: a grid of 16 × 8 cells of 64 × 64 (`ATLAS_CELL`), glyph `c` in cell
(c % 16, c / 16). At 48 pixels the largest glyph of Inter Bold is 48 × 58, so every glyph fits into its cell, and the
empty border of each cell keeps the linear filter from mixing in a neighbour. `loadFont()` copies each bitmap into
its cell, row by row:

```cpp
        // load first 128 characters of ASCII set
        for (unsigned char c = 0; c < 128; c++) {
            // Load character glyph
            if (FT_Load_Char(face, c, FT_LOAD_RENDER)) {
                std::cout << "ERROR::FREETYTPE: Failed to load Glyph" << std::endl;
                continue;
            }
            // copy the glyph's bitmap (one byte per pixel, rows `pitch` bytes apart) into its cell of the atlas
            glm::ivec2 offset((c % 16) * ATLAS_CELL, (c / 16) * ATLAS_CELL);
            for (unsigned int row = 0; row < face->glyph->bitmap.rows; row++) {
                memcpy(&atlasPixels[(offset.y + row) * ATLAS_WIDTH + offset.x], &face->glyph->bitmap.buffer[row * face->glyph->bitmap.pitch], face->glyph->bitmap.width);
            }
            // now store character for later use
            Character character = {
                offset,
                glm::ivec2(face->glyph->bitmap.width, face->glyph->bitmap.rows),
                glm::ivec2(face->glyph->bitmap_left, face->glyph->bitmap_top),
                static_cast<unsigned int>(face->glyph->advance.x)
            };
            Characters.insert(std::pair<char, Character>(c, character));
        }
```

A FreeType bitmap is one byte per pixel, but its rows are `bitmap.pitch` bytes apart, which can be more than its
width – so the copy goes row by row. `createAtlasImage()` (already in the project, called after `loadFont()`) uploads
`atlasPixels` once through a staging buffer into an image of format **`VK_FORMAT_R8_UNORM`**: one 8-bit channel, which
the shader reads as `.r` from 0.0 to 1.0 – OpenGL's `GL_RED`. There is no unpack alignment to set: the copy's
`bufferRowLength` of 0 tells Vulkan that the rows in the buffer are tightly packed. The sampler is linear with
`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`, learnopengl's settings.

(The `FREETYTPE` typo in the error message is learnopengl's own.)
:::
:::d3d12
### One atlas for all glyphs

learnopengl creates one small `GL_RED` texture per glyph – 128 textures – and binds the glyph's texture before each
character is drawn. In Direct3D 12 every texture is a resource with its own memory, an upload buffer, a barrier and a
descriptor in the heap; 128 of each, and a descriptor table set before every character, would be a lot of objects for
some text. What is more, a texture of width or height 0 cannot be created at all – and the space, which has no visible
pixels, has a bitmap of 0 × 0. So Direct3D programs usually put all glyphs into **one texture, a glyph atlas**: the
classic bitmap font's idea, filled from the font by FreeType at run time. Each character's quad then samples its own
rectangle of that one texture, one descriptor table serves the whole text, and the glyphs can be drawn together.

The project's atlas is 1024 × 512 texels: a grid of 16 × 8 cells of 64 × 64, character c in cell (c % 16, c / 16).
At 48 pixels the largest glyph of Inter Bold is 48 × 58, so every glyph fits into its cell, and the empty border of
each cell keeps the linear filter from mixing in a neighbour:

```cpp
const UINT AtlasCellSize = 64;
const UINT AtlasWidth = 16 * AtlasCellSize;
const UINT AtlasHeight = 8 * AtlasCellSize;
```

`LoadGlyphs` copies each bitmap into its cell of a CPU-side array, row by row:

```cpp
    // The atlas's texels on the CPU, one byte each, all 0 (nothing covered) to begin with.
    std::vector<unsigned char> atlas(AtlasWidth * AtlasHeight, 0);

    // load first 128 characters of ASCII set
    for (unsigned char c = 0; c < 128; c++)
    {
        // Load character glyph
        if (FT_Load_Char(face, c, FT_LOAD_RENDER))
        {
            OutputDebugStringA("ERROR::FREETYPE: Failed to load Glyph\n");
            continue;
        }

        // the glyph's cell in the atlas: 16 characters a row
        int cellX = (c % 16) * AtlasCellSize;
        int cellY = (c / 16) * AtlasCellSize;

        // copy the bitmap into the cell row by row (a row of the bitmap is pitch bytes
        // long, a row of the atlas AtlasWidth bytes)
        for (unsigned int row = 0; row < face->glyph->bitmap.rows; row++)
        {
            memcpy(&atlas[(cellY + row) * AtlasWidth + cellX],
                face->glyph->bitmap.buffer + row * face->glyph->bitmap.pitch,
                face->glyph->bitmap.width);
        }

        // now store character for later use
        Character character = {
            XMINT2(cellX, cellY),
            XMINT2(face->glyph->bitmap.width, face->glyph->bitmap.rows),
            XMINT2(face->glyph->bitmap_left, face->glyph->bitmap_top),
            static_cast<unsigned int>(face->glyph->advance.x)
        };
        Characters.insert(std::pair<char, Character>(c, character));
    }
```

A FreeType bitmap is one byte per pixel, but its rows are `bitmap.pitch` bytes apart, which can be more than its
width – so the copy goes row by row. After the FreeType calls, the atlas becomes a texture the way every texture of the
course does: a `Texture2D` resource of format **`DXGI_FORMAT_R8_UNORM`** in a default heap – one 8-bit channel, which
the shader reads as `.r` from 0.0 to 1.0, learnopengl's `GL_RED` –, an upload buffer of `GetRequiredIntermediateSize`,
`UpdateSubresources` with `RowPitch = AtlasWidth` (one byte per texel: no alignment to worry about – learnopengl's
`GL_UNPACK_ALIGNMENT 1`; `UpdateSubresources` lays the rows out the way the GPU wants them), the barrier from
`COPY_DEST` to `PIXEL_SHADER_RESOURCE`, and the shader resource view in slot 1 of the CBV/SRV heap. The root
signature's static sampler is linear and clamped, learnopengl's `GL_CLAMP_TO_EDGE`.
:::

Now do the task **glyphs**: add the `Character` struct and the `Characters` map, and load the 128 characters.
:::opengl
Run it: still nothing on the screen – the textures exist, but nothing draws them.
:::
:::vulkan
Run it: still nothing on the screen – the atlas holds the glyphs now, but nothing samples it.
:::
:::d3d12
The task also creates the atlas texture and its view, as described above. Run it: still nothing on the screen – the
atlas holds the glyphs now, but nothing samples it.
:::

:::opengl
```quiz
Why does the project call `glPixelStorei(GL_UNPACK_ALIGNMENT, 1)` before uploading the glyphs?
- [ ] Because `GL_RED` textures can only be created with an alignment of 1
- [ ] So that the glyphs are filtered without bleeding into each other
- [ ] Because FreeType's bitmaps are stored bottom row first
- [x] Because a glyph's rows are as many bytes long as it is wide; with the default alignment of 4, OpenGL would expect each row to start at a multiple of 4 bytes and read the bitmap sheared
---
The alignment describes the data you upload, not the texture. RGBA images (4 bytes per pixel) never notice it; one-byte-per-pixel images of odd widths do.
```
:::
:::vulkan
```quiz
Why does the Vulkan project put all glyphs into one atlas image instead of learnopengl's one texture per glyph?
- [ ] Because Vulkan images must be at least 1024 pixels wide
- [x] Because every texture would need its own image, memory, view and descriptor set, bound before each character – and the space's 0 × 0 bitmap cannot be an image at all; one atlas needs one of each
- [ ] Because `VK_FORMAT_R8_UNORM` is only supported for large images
- [ ] Because FreeType can only render into an atlas
---
That is the bitmap font's old idea – one texture, a rectangle per glyph – with the bitmaps made by FreeType at run time. Large programs build their atlases on demand, adding glyphs as text needs them.
```
:::
:::d3d12
```quiz
Why does the Direct3D 12 project put all glyphs into one atlas texture instead of learnopengl's one texture per glyph?
- [x] Because every texture would need its own resource, upload buffer, barrier and descriptor, and a table set before each character – and the space's 0 × 0 bitmap cannot be a texture at all; one atlas needs one of each
- [ ] Because Direct3D 12 allows only one texture per descriptor heap
- [ ] Because `DXGI_FORMAT_R8_UNORM` is only supported for large textures
- [ ] Because FreeType can only render into an atlas
---
That is the bitmap font's old idea – one texture, a rectangle per glyph – with the bitmaps made by FreeType at run time. It also lets a whole line be drawn with one draw call, as you'll see below.
```
:::

## Shaders

To render the glyphs we'll be using the following vertex shader:

:::opengl
```glsl
#version 330 core
layout (location = 0) in vec4 vertex; // <vec2 pos, vec2 tex>
out vec2 TexCoords;

uniform mat4 projection;

void main()
{
    gl_Position = projection * vec4(vertex.xy, 0.0, 1.0);
    TexCoords = vertex.zw;
}
```
:::
:::vulkan
```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 projection;
} ubo;

layout(location = 0) in vec4 vertex; // <vec2 pos, vec2 tex>

layout(location = 0) out vec2 TexCoords;

void main() {
    gl_Position = ubo.projection * vec4(vertex.xy, 0.0, 1.0);
    TexCoords = vertex.zw;
}
```
:::
:::d3d12
```hlsl
PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = mul(float4(position, 0.0f, 1.0f), projection);
    result.texCoord = texCoord;

    return result;
}
```
:::

We combine both the position and texture coordinate data into one vertex: a 2D position and 2D texture coordinates.
The vertex shader multiplies the coordinates with a projection matrix and forwards the texture coordinates to the
fragment shader:

:::opengl
```glsl
#version 330 core
in vec2 TexCoords;
out vec4 color;

uniform sampler2D text;
uniform vec3 textColor;

void main()
{
    // the glyph texture has one channel (red): it is the glyph's coverage, used as alpha
    vec4 sampled = vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r);
    color = vec4(textColor, 1.0) * sampled;
}
```
:::
:::vulkan
```glsl
layout(binding = 1) uniform sampler2D text;

layout(push_constant) uniform PushConstants {
    vec3 textColor;
} pc;

layout(location = 0) in vec2 TexCoords;

layout(location = 0) out vec4 color;

void main() {
    // the glyph's coverage (the atlas's red channel) becomes the alpha: blending keeps the letter, drops the rest
    vec4 sampled = vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r);
    color = vec4(pc.textColor, 1.0) * sampled;
}
```

learnopengl's `textColor` uniform is a push constant (`struct PushConstants { glm::vec3 textColor; };`, fragment
stage): it changes from line to line, between draws of the same command buffer.
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float4 sampled = float4(1.0f, 1.0f, 1.0f, text.Sample(clampSampler, input.texCoord).r);
    return float4(textColor, 1.0f) * sampled;
}
```

learnopengl's `textColor` uniform is a root constant (`cbuffer TextConstants : register(b0) { float3 textColor; }`,
root parameter 0, three values): it changes from line to line, between draws of the same command list.
:::

The fragment shader takes two inputs: one is the mono-colored bitmap image of the glyph, and the other is a color for
adjusting the text's final color. We first sample the color value of the bitmap texture. Because the texture's data is
stored in just its red component, we sample the `r` component of the texture as the sampled alpha value. By varying the
output color's alpha value, the resulting pixel will be transparent for all the glyph's background colors and
non-transparent for the actual character pixels. We also multiply the RGB colors by the `textColor` uniform to vary
the text color. FreeType's bitmap is anti-aliased: pixels on the edge of a letter are only partly covered and get
values between 0 and 255 – their alpha blends the letter's colour softly into the background.

We do need to enable blending for this to work though:

:::opengl
```cpp
    glEnable(GL_CULL_FACE);
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
```
:::
:::vulkan
```cpp
        colorBlendAttachment.blendEnable = VK_TRUE;
        colorBlendAttachment.srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA;
        colorBlendAttachment.dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA;
```

in the pipeline, together with back-face culling (`VK_CULL_MODE_BACK_BIT`, `VK_FRONT_FACE_COUNTER_CLOCKWISE` –
learnopengl's `glEnable(GL_CULL_FACE)`). The render pass has only the colour attachment: 2D text needs no depth buffer.
:::
:::d3d12
```cpp
        psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_INV_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].BlendOp = D3D12_BLEND_OP_ADD;
```

in the pipeline state (with `BlendEnable = TRUE`), and no depth buffer: 2D text needs none. Culling is off
(`D3D12_CULL_MODE_NONE`): the quads are flat and face the viewer, so nothing would be culled either way – learnopengl
enables back-face culling, which with its counter-clockwise quads changes nothing either.
:::

For the projection matrix we'll be using an orthographic projection matrix. For rendering text we (usually) do not
need perspective, and using an orthographic projection matrix also allows us to specify all vertex coordinates in
screen coordinates if we set it up as follows:

:::opengl
```cpp
    glm::mat4 projection = glm::ortho(0.0f, static_cast<float>(SCR_WIDTH), 0.0f, static_cast<float>(SCR_HEIGHT));
```

We set the projection matrix's bottom parameter to 0.0f and its top parameter equal to the window's height. The result
is that we specify coordinates with y values ranging from the bottom part of the screen (0.0f) to the top part of the
screen (600.0f). This means that the point (0.0, 0.0) now corresponds to the bottom-left corner.
:::
:::vulkan
```cpp
        ubo.projection = glm::ortho(0.0f, static_cast<float>(swapChainExtent.width), static_cast<float>(swapChainExtent.height), 0.0f);
```

in the uniform buffer. It is learnopengl's `glm::ortho(0, 800, 0, 600)` with bottom and top swapped – because
Vulkan's clip space y points *down*: y = 0 now maps to clip y = +1, the bottom of the window, and y = 600 to -1, the
top. The coordinates are learnopengl's: y values range from the bottom part of the screen (0.0) to the top part
(600.0), and the point (0.0, 0.0) is the bottom-left corner. (This is also why there is no `proj[1][1] *= -1` here:
swapping bottom and top is that same flip.)
:::
:::d3d12
```cpp
    XMMATRIX projection = XMMatrixOrthographicOffCenterRH(0.0f, static_cast<float>(m_width), 0.0f, static_cast<float>(m_height), -1.0f, 1.0f);
```

written into the constant buffer (`SceneConstantBuffer`, root parameter 1) in `OnUpdate`. Direct3D's clip space y
points up like OpenGL's, so this is learnopengl's `glm::ortho(0, 800, 0, 600)`: y values range from the bottom part of
the screen (0.0) to the top part (600.0), and the point (0.0, 0.0) is the bottom-left corner.
:::

Last up is creating the vertex buffer for rendering the quads. Each quad needs 6 vertices of 4 floats; the vertices
change for every character, so the buffer is one the CPU rewrites.

:::opengl
```cpp
    glGenVertexArrays(1, &VAO);
    glGenBuffers(1, &VBO);
    glBindVertexArray(VAO);
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(float) * 6 * 4, NULL, GL_DYNAMIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), 0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindVertexArray(0);
```

The 2D quad requires 6 vertices of 4 floats each, so we reserve `6 * 4` floats of memory. Because we'll be updating
the content of the VBO's memory quite often we'll allocate the memory with `GL_DYNAMIC_DRAW`.
:::
:::vulkan
The project already has it: a host-visible vertex buffer with room for `MAX_CHARACTERS` = 256 quads (6 ×
`Vertex { glm::vec4 vertex; }` each, attribute 0 of format `VK_FORMAT_R32G32B32A32_SFLOAT`), mapped once for the
whole run into `vertexBufferMapped` – learnopengl's `GL_DYNAMIC_DRAW` buffer. Why room for 256 quads instead of
learnopengl's one follows in the next section.
:::
:::d3d12
The buffer is part of the next task: `MaxTextVertices` = 6 × 256 vertices of `{ XMFLOAT2 position; XMFLOAT2 texCoord; }`
in an upload heap, mapped once for the program's whole life into `m_pVertexDataBegin` (like the constant buffer), and
its view with `StrideInBytes = sizeof(Vertex)` – learnopengl's `GL_DYNAMIC_DRAW` buffer. Why room for 256 quads
instead of learnopengl's one follows in the next section.
:::

```quiz
The text's fragment shader writes `vec4(textColor, 1.0) * vec4(1.0, 1.0, 1.0, coverage)`. What would you see if blending were switched off?
- [ ] Nothing at all: without blending, fragments with an alpha below 1 are discarded
- [ ] The same text, only with harder edges
- [x] A solid block per character in the text's colour: every pixel of each quad is written, also those where the glyph does not cover it
- [ ] The text in white, because the alpha is applied to the colour only when blending is on
---
The colour of every fragment is the text colour; only the alpha says how much of the pixel the glyph covers. Blending with SRC_ALPHA / ONE_MINUS_SRC_ALPHA turns that alpha into "how much of the text colour, how much of what is behind".
```

## Render line of text

To render a character, we extract the corresponding `Character` struct of the `Characters` map and calculate the
quad's dimensions using the character's metrics. With the quad's calculated dimensions we dynamically generate a set of
6 vertices that we use to update the content of the memory managed by the vertex buffer.

We create a function called `RenderText` that renders a string of characters:

:::opengl
```cpp
void RenderText(Shader &shader, std::string text, float x, float y, float scale, glm::vec3 color)
{
    // activate corresponding render state
    shader.use();
    glUniform3f(glGetUniformLocation(shader.ID, "textColor"), color.x, color.y, color.z);
    glActiveTexture(GL_TEXTURE0);
    glBindVertexArray(VAO);

    // iterate through all characters
    std::string::const_iterator c;
    for (c = text.begin(); c != text.end(); c++)
    {
        Character ch = Characters[*c];

        float xpos = x + ch.Bearing.x * scale;
        float ypos = y - (ch.Size.y - ch.Bearing.y) * scale;

        float w = ch.Size.x * scale;
        float h = ch.Size.y * scale;
        // update VBO for each character
        float vertices[6][4] = {
            { xpos,     ypos + h,   0.0f, 0.0f },
            { xpos,     ypos,       0.0f, 1.0f },
            { xpos + w, ypos,       1.0f, 1.0f },

            { xpos,     ypos + h,   0.0f, 0.0f },
            { xpos + w, ypos,       1.0f, 1.0f },
            { xpos + w, ypos + h,   1.0f, 0.0f }
        };
        // render glyph texture over quad
        glBindTexture(GL_TEXTURE_2D, ch.TextureID);
        // update content of VBO memory
        glBindBuffer(GL_ARRAY_BUFFER, VBO);
        glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(vertices), vertices); // be sure to use glBufferSubData and not glBufferData

        glBindBuffer(GL_ARRAY_BUFFER, 0);
        // render quad
        glDrawArrays(GL_TRIANGLES, 0, 6);
        // now advance cursors for next glyph (note that advance is number of 1/64 pixels)
        x += (ch.Advance >> 6) * scale; // bitshift by 6 to get value in pixels (2^6 = 64 (divide amount of 1/64th pixels by 64 to get amount of pixels))
    }
    glBindVertexArray(0);
    glBindTexture(GL_TEXTURE_2D, 0);
}
```
:::
:::vulkan
```cpp
    void RenderText(VkCommandBuffer commandBuffer, std::string text, float x, float y, float scale, glm::vec3 color) {
        PushConstants constants{};
        constants.textColor = color;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);

        // iterate through all characters
        std::string::const_iterator c;
        for (c = text.begin(); c != text.end(); c++) {
            Character ch = Characters[*c];

            float xpos = x + ch.Bearing.x * scale;
            float ypos = y - (ch.Size.y - ch.Bearing.y) * scale;

            float w = ch.Size.x * scale;
            float h = ch.Size.y * scale;
            // the glyph's rectangle in the atlas (0..1); its first row (v0) is the top of the glyph
            float u0 = ch.AtlasOffset.x / (float) ATLAS_WIDTH;
            float v0 = ch.AtlasOffset.y / (float) ATLAS_HEIGHT;
            float u1 = (ch.AtlasOffset.x + ch.Size.x) / (float) ATLAS_WIDTH;
            float v1 = (ch.AtlasOffset.y + ch.Size.y) / (float) ATLAS_HEIGHT;
            // the quad of this character
            float vertices[6][4] = {
                { xpos,     ypos + h,   u0, v0 },
                { xpos,     ypos,       u0, v1 },
                { xpos + w, ypos,       u1, v1 },

                { xpos,     ypos + h,   u0, v0 },
                { xpos + w, ypos,       u1, v1 },
                { xpos + w, ypos + h,   u1, v0 }
            };
            // write it after the vertices of the characters drawn before (the GPU reads them when the frame runs)
            memcpy((char*) vertexBufferMapped + vertexCount * sizeof(Vertex), vertices, sizeof(vertices));
            // render quad
            vkCmdDraw(commandBuffer, 6, 1, vertexCount, 0);
            vertexCount += 6;
            // now advance cursors for next glyph (note that advance is number of 1/64 pixels)
            x += (ch.Advance >> 6) * scale; // bitshift by 6 to get value in pixels (2^6 = 64 (divide amount of 1/64th pixels by 64 to get amount of pixels))
        }
    }
```
:::
:::d3d12
```cpp
void D3D12App::RenderText(std::string text, float x, float y, float scale, XMFLOAT3 color)
{
    // activate corresponding render state: the text's colour (root parameter 0)
    TextConstants textConstants = {};
    textConstants.textColor = color;
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(TextConstants) / 4, &textConstants, 0);

    // this line's quads come after the ones already written this frame
    UINT firstVertex = m_textVertexCount;

    // iterate through all characters
    std::string::const_iterator c;
    for (c = text.begin(); c != text.end(); c++)
    {
        Character ch = Characters[*c];

        float xpos = x + ch.Bearing.x * scale;
        float ypos = y - (ch.Size.y - ch.Bearing.y) * scale;

        float w = ch.Size.x * scale;
        float h = ch.Size.y * scale;

        // the glyph's rectangle in the atlas, in texture coordinates (v = 0 is the
        // atlas's top row, where each bitmap's top row is)
        float u0 = static_cast<float>(ch.AtlasPos.x) / AtlasWidth;
        float v0 = static_cast<float>(ch.AtlasPos.y) / AtlasHeight;
        float u1 = static_cast<float>(ch.AtlasPos.x + ch.Size.x) / AtlasWidth;
        float v1 = static_cast<float>(ch.AtlasPos.y + ch.Size.y) / AtlasHeight;

        // the character's quad: two triangles
        Vertex vertices[6] = {
            { XMFLOAT2(xpos,     ypos + h), XMFLOAT2(u0, v0) },
            { XMFLOAT2(xpos,     ypos),     XMFLOAT2(u0, v1) },
            { XMFLOAT2(xpos + w, ypos),     XMFLOAT2(u1, v1) },

            { XMFLOAT2(xpos,     ypos + h), XMFLOAT2(u0, v0) },
            { XMFLOAT2(xpos + w, ypos),     XMFLOAT2(u1, v1) },
            { XMFLOAT2(xpos + w, ypos + h), XMFLOAT2(u1, v0) }
        };

        memcpy(m_pVertexDataBegin + m_textVertexCount * sizeof(Vertex), vertices, sizeof(vertices));
        m_textVertexCount += 6;

        // now advance cursors for next glyph (note that advance is number of 1/64 pixels)
        x += (ch.Advance >> 6) * scale; // bitshift by 6 to get value in pixels (2^6 = 64)
    }

    // render the line's quads
    m_commandList->DrawInstanced(m_textVertexCount - firstVertex, 1, firstVertex, 0);
}
```
:::

Most of the content of the function should be relatively self-explanatory: we first calculate the origin position of
the quad (as `xpos` and `ypos`) and the quad's size (as `w` and `h`) and generate a set of 6 vertices to form the 2D
quad; note that we scale each metric by `scale`. (x, y) is the start of the baseline, in pixels from the bottom-left
corner of the window.

Some characters (like 'p' or 'g') are rendered slightly below the baseline, so the quad should also be positioned
slightly below `RenderText`'s y value. The exact amount we need to offset `ypos` below the baseline can be figured out
from the glyph metrics: the part of the bitmap below the baseline is its height minus its vertical bearing,
`Size.y - Bearing.y`. For a character that rests on the baseline (like 'X') this is 0; for 'p' it is the length of its
descender. So `ypos = y - (ch.Size.y - ch.Bearing.y) * scale` is the quad's bottom edge, and `ypos + h` its top.

```quiz
In "This is sample text", for which character is `ch.Size.y - ch.Bearing.y` clearly greater than 0?
- [ ] 'T', because it is the tallest letter
- [ ] The space, because its bitmap is empty
- [x] 'p', because part of its bitmap hangs below the baseline – its quad must start that far below y
- [ ] Every character: the value is always the font's line height
---
Height minus the distance from the baseline to the top is the part below the baseline: 0 for letters resting on it, the descender's length for 'p', 'g', 'y'. Without the term, "sample" would have its 'p' sitting on the line like an oversized 'o'.
```

The texture coordinates are "upside down": the vertex at the quad's top-left corner, (xpos, ypos + h), gets the
smallest v – the top of the glyph's texture (or of its rectangle in the atlas) – and the bottom-left corner the
largest. A FreeType bitmap starts with its *top*
row, and it is uploaded as it is – so the first row of the texture is the top of the glyph.

:::opengl
After generating the quad's vertices, we bind the glyph's texture, update the VBO's memory with `glBufferSubData` and
draw the quad – one draw call per character. This is fine in OpenGL: the commands are executed in order, so by the time
the next character overwrites the buffer, the previous draw has (as far as the program can tell) used the old content.
The driver takes care of that, by waiting or by giving the buffer new memory behind the scenes.
:::
:::vulkan
**Why every quad gets its own place in the buffer.** learnopengl rewrites one 6-vertex buffer with `glBufferSubData`
before each character's draw. That works in OpenGL because the commands are executed in order, and the driver makes
sure a draw sees the buffer as it was when the draw was called. A Vulkan command buffer is different: `vkCmdDraw` only
*records* the draw, and the GPU runs it – and reads the vertex buffer – after the command buffer is submitted, long
after `RenderText` has returned. Had every character written into the same place, all draws of the frame would read the
last character's quad. So `RenderText` writes each character's 6 vertices **after** those already written this frame
(at `vertexCount`, which `recordCommandBuffer` resets to 0) and draws them with `vkCmdDraw(commandBuffer, 6, 1,
vertexCount, 0)` – the fourth parameter is the first vertex. It is still one draw per character, like learnopengl.
Writing the buffer again every frame is safe because the program has one frame in flight: `drawFrame` waits for the
previous frame's fence before it records.
:::
:::d3d12
**Why every quad gets its own place in the buffer, and why one draw is enough.** learnopengl rewrites one 6-vertex
buffer with `glBufferSubData` before each character's draw. That works in OpenGL because the commands are executed in
order, and the driver makes sure a draw sees the buffer as it was when the draw was called. A Direct3D 12 command list
is different: `DrawInstanced` only *records* the draw, and the GPU runs it – and reads the vertex buffer – when the
list is executed, after all of `PopulateCommandList`. Had every character written into the same place, every glyph
would have been drawn with the last character's quad. So `RenderText` writes each character's quad **after** those
already written this frame (at `m_textVertexCount`, which `PopulateCommandList` resets to 0 – the GPU has finished the
previous frame, `OnRender` waits for it). And since all glyphs are in one atlas, nothing changes between the
characters of a line: one `DrawInstanced(6 * characters, 1, firstVertex, 0)` draws the whole line.
:::

At the end, we advance the x coordinate by the character's advance. Note that the advance is a number of 1/64 pixels
(FreeType's 26.6 fixed-point format), so we bitshift it by 6 (`>> 6`, the same as dividing by 2⁶ = 64) to get pixels
before we scale it.

```quiz
A glyph's `advance.x` is 1856. How far does `RenderText` move the pen at scale 0.5?
- [ ] 928 pixels
- [ ] 1856 / 0.5 = 3712 pixels
- [ ] 58 pixels
- [x] 14.5 pixels: 1856 >> 6 = 29 pixels at the loaded size, times 0.5
---
The advance is in 1/64 pixels (26.6 fixed point): shifting by 6 divides by 64. The scale is applied afterwards, like to every other metric.
```

Now do the task **render-text**:
:::opengl
the VAO/VBO configuration in `main`, the `RenderText` function (and its declaration with the global `VAO, VBO`), and
the call in the render loop after the clear:

```cpp
        RenderText(shader, "This is sample text", 25.0f, 25.0f, 1.0f, glm::vec3(0.5, 0.8f, 0.2f));
```
:::
:::vulkan
the member function `RenderText`, and in `recordCommandBuffer()`, after the descriptor set is bound:

```cpp
        vertexCount = 0;
        RenderText(commandBuffer, "This is sample text", 25.0f, 25.0f, 1.0f, glm::vec3(0.5, 0.8f, 0.2f));
```
:::
:::d3d12
the vertex buffer in `LoadAssets`, `RenderText`, and in `PopulateCommandList`:

```cpp
    m_commandList->IASetVertexBuffers(0, 1, &m_vertexBufferView);

    // the text: the vertex buffer is filled from the start again every frame (the GPU
    // has finished the previous frame: OnRender waits for it)
    m_textVertexCount = 0;
    RenderText("This is sample text", 25.0f, 25.0f, 1.0f, XMFLOAT3(0.5f, 0.8f, 0.2f));
```
:::

Build and run: **"This is sample text" in green at the bottom left** of the window. Look closely at the edges of the
letters: they blend smoothly into the background – FreeType's anti-aliasing. The spaces are quads too, of size 0 × 0:
they draw nothing, but their advance moves the pen.

:::opengl
```quiz
The line has 19 characters. How many draw calls does `RenderText` make for it, and what does each one need?
- [ ] One, because all characters use the same shader
- [ ] 17, because the spaces are skipped
- [x] 19 – one per character, each after binding that glyph's texture and rewriting the quad's 6 vertices with `glBufferSubData`
- [ ] 38, two triangles per character
---
One draw per character is learnopengl's simple way. Each glyph has its own texture, so the texture must change between characters anyway; a glyph atlas (as the Vulkan and DirectX 12 versions use) would allow one draw per line.
```
:::
:::vulkan
```quiz
Why does `RenderText` write each character's quad at `vertexCount` instead of overwriting the same 6 vertices like learnopengl?
- [ ] Because a mapped buffer may only be written once per frame
- [ ] Because `vkCmdDraw` always starts at the last vertex written
- [ ] Because the atlas needs the vertices of all glyphs at once
- [x] Because `vkCmdDraw` only records the draw: the GPU reads the buffer when the submitted command buffer runs, after `RenderText` has returned – all draws would see the last quad
---
In OpenGL the draws are executed in order with the buffer as it was at each call. In Vulkan, recording and execution are separate, so data a recorded command reads must stay unchanged until the GPU has run it.
```
:::
:::d3d12
```quiz
"This is sample text" has 19 characters. How many draw calls does the Direct3D 12 `RenderText` record for it?
- [ ] 19, one per character, as in learnopengl
- [x] One `DrawInstanced` of 114 vertices: every quad has its own place in the buffer and all glyphs are in the one atlas, so nothing changes between the characters
- [ ] Two, one per triangle list of the quads
- [ ] None until `ExecuteCommandLists`, which draws each character separately
---
The colour (a root constant) is set once per line. A second line is a second draw starting at vertex 114.
```
:::

Now do the task **second-line**: learnopengl's second line is a copyright notice in the top right; the course's says
"(C) Codestead GP":

:::opengl
```cpp
        RenderText(shader, "(C) Codestead GP", 540.0f, 570.0f, 0.5f, glm::vec3(0.3, 0.7f, 0.9f));
```
:::
:::vulkan
```cpp
        RenderText(commandBuffer, "(C) Codestead GP", 540.0f, 570.0f, 0.5f, glm::vec3(0.3, 0.7f, 0.9f));
```
:::
:::d3d12
```cpp
    RenderText("(C) Codestead GP", 540.0f, 570.0f, 0.5f, XMFLOAT3(0.3f, 0.7f, 0.9f));
```
:::

y = 570 is near the *top* of the window – y points up in these coordinates. Build and run: a small **light-blue line in
the top right**.

:::vulkan
Its quads go into the buffer after the first line's: 35 draws in all, 210 vertices. Compared pixel by pixel with the
OpenGL version, this line sits **one pixel higher** (y 11..32 instead of 12..33): at scale 0.5 its quads' edges fall
exactly on pixel centres, and Vulkan's top-left rasterization rule, applied in its y-down framebuffer, decides those
ties the other way than OpenGL's in its y-up one.
:::
:::d3d12
Its quads go into the buffer after the first line's, and its draw starts at vertex 114: two draws in all (114 + 96
vertices).
:::

The second line uses the same 48-pixel glyphs at half size: `scale` shrinks the quads, and the linear filter shrinks
the bitmaps. That is learnopengl's way and works fine for a factor of 0.5, but scaled bitmaps get blurry (or, scaled
up, blocky). For a different size a real program loads the glyphs at that size – the game's text later in this part
uses 24 pixels.

## Going further

This chapter demonstrated a text rendering technique with TrueType fonts using the FreeType library. The approach is
flexible, scalable, and works with many character encodings. However, this approach is likely going to be overkill for
your application as we generate and render textures for each glyph. Performance-wise, bitmap fonts are preferable as
we only need one texture for all our glyphs. The best approach would be to combine the two approaches by dynamically
generating a bitmap font texture featuring all character glyphs as loaded with FreeType – the atlas the Vulkan and
DirectX 12 versions build. This saves the renderer from a significant amount of texture switches and, based on how
tight each glyph is packed, could save quite some performance.

Another issue with FreeType font bitmaps is that the glyph textures are stored with a fixed font size, so a
significant amount of scaling may introduce jagged edges. Furthermore, rotations applied to the glyphs will cause them
to appear blurry. This can be mitigated by, instead of storing the actual rasterized pixel colors, storing the distance
to the closest glyph outline per pixel. This technique is called *signed distance field fonts* and Valve published a
paper a few years ago about their implementation of this technique which works surprisingly well for 3D rendering
applications: the shader compares the interpolated distance with a threshold (with `smoothstep` for soft edges), and
one small texture gives sharp letters at any size.

Real text has more to it than this chapter: *kerning* (pairs like "AV" moved closer together – FreeType reports it with
`FT_Get_Kerning`), characters beyond ASCII (Unicode, loaded into the atlas as the text needs them), and *shaping* for
scripts whose letters change with their neighbours, which libraries like HarfBuzz do on top of FreeType.

## Additional resources

- [Text Rendering](https://learnopengl.com/In-Practice/Text-Rendering): learnopengl's chapter this chapter follows,
  with its picture of the glyph metrics.

:::opengl
- [LearnOpenGL source code: text_rendering.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/7.in_practice/2.text_rendering/text_rendering.cpp):
  learnopengl's program.
- [glPixelStore](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glPixelStore.xhtml): the unpack alignment and
  the other pixel storage modes.
:::
:::vulkan
- [Texture mapping: Images](https://vulkan-tutorial.com/Texture_mapping/Images): staging buffers, layout
  transitions and `vkCmdCopyBufferToImage`, which the atlas upload uses.
- [Formats (Vulkan specification)](https://docs.vulkan.org/spec/latest/chapters/formats.html): `VK_FORMAT_R8_UNORM`
  and the other formats.
:::
:::d3d12
- [UpdateSubresources](https://learn.microsoft.com/en-us/windows/win32/direct3d12/updatesubresources2): the helper
  that copies the atlas into its texture.
- [Using constants directly in the root signature](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-constants-directly-in-the-root-signature):
  root constants, the text colour's way to the shader.
:::
