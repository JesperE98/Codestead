# Textures – tasks (OpenGL)

learnopengl "Textures". Files: `main.cpp`, `shader_s.h` (the `Shader` class of the Shaders chapter), `shader.vs`,
`shader.fs`, and the two images `container.png` (256×256 RGB, a wooden crate) and `awesomeface.png` (256×256 RGBA,
a smiley with a red heart on its right side, transparent pixels are black with alpha 0). The images are loaded from
the working directory by file name (`stbi_load("container.png", …)`).

Start: learnopengl's `textures.cpp` without the texture – the indexed rectangle (VBO, VAO, EBO, indices
`0, 1, 3, 1, 2, 3`, `glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0)`) with a colour per vertex
(positions + colours, stride `6 * sizeof(float)`): top right red, bottom right green, bottom left blue, top left yellow,
interpolated. Shaders: `shader.vs` passes `aColor` on as `ourColor`, `shader.fs` writes `FragColor = vec4(ourColor, 1.0);`.
The rectangle covers x 200..600, y 150..450 of the 800×600 window (pixel coordinates from the top left); outside it
the teal background (sRGB 51,76,76). Start pixels: top left corner (210,160) yellow ≈ 246,253,2, top right (590,160)
red ≈ 246,15,0, bottom left (210,440) blue ≈ 8,15,240, bottom right (590,440) green ≈ 8,253,0, centre (400,300)
≈ 127,255,0 (it lies on the diagonal from the green to the yellow corner).

After `upload` … `sample` the project is learnopengl's `textures.cpp` (+ flip on load and `glDeleteTextures`), after
`texture-units` it is `textures_combined.cpp`; the last three tasks are the chapter's exercises 1, 2 and 4, kept
cumulatively. Pixel values below are measured with Mesa (llvmpipe); filtering can move them by a few units.

Where the crate is: the image is shown upright (`stbi_set_flip_vertically_on_load(true)` + texture coordinates with
v = 0 at the bottom). Its dark frame (≈ 92,58,28) runs along the rectangle's edges, its diagonal brace (same dark
brown) goes from the bottom-left to the top-right corner through the centre (400,300), light planks
(≈ 146,96,52 at (260,200)) fill the rest, light grey screws sit in the four corners (≈ 148,134,116 at (210,160)).

## `load-image`
- **Task:** Include stb_image (`#define STB_IMAGE_IMPLEMENTATION` before `#include <stb_image.h>`) and load `container.png` with `stbi_load`, flipped vertically; print an error if it fails and free the data with `stbi_image_free`.
- **Hint:** `int width, height, nrChannels;` – `stbi_load` fills them. Call `stbi_set_flip_vertically_on_load(true)` before loading: images store the top row first, OpenGL expects v = 0 at the bottom. Leave the inside of `if (data)` for the next tasks.
- **When done:** `main.cpp` has `#define STB_IMAGE_IMPLEMENTATION` + `#include <stb_image.h>` after the GLFW
  include; after the vertex attributes: `int width, height, nrChannels;`,
  `stbi_set_flip_vertically_on_load(true);`,
  `unsigned char *data = stbi_load("container.png", &width, &height, &nrChannels, 0);`, `if (data) { … } else`
  printing `Failed to load texture`, and `stbi_image_free(data);`. The image loads (256×256, 3 channels; nothing is
  printed). Nothing visible changes (the colour rectangle).

## `create-texture`
- **Task:** Create a texture object `texture1` with `glGenTextures`, bind it to `GL_TEXTURE_2D` and set its wrapping (`GL_REPEAT` on S and T) and filtering (`GL_LINEAR_MIPMAP_LINEAR` for minifying, `GL_LINEAR` for magnifying). Delete it at the end with `glDeleteTextures`.
- **Hint:** `glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);` – the parameters apply to the texture bound to `GL_TEXTURE_2D`. The magnification filter cannot use mipmaps.
- **When done:** `unsigned int texture1; glGenTextures(1, &texture1); glBindTexture(GL_TEXTURE_2D, texture1);`,
  four `glTexParameteri` calls (`GL_TEXTURE_WRAP_S`/`_T` = `GL_REPEAT`, `GL_TEXTURE_MIN_FILTER` =
  `GL_LINEAR_MIPMAP_LINEAR`, `GL_TEXTURE_MAG_FILTER` = `GL_LINEAR`) before the image is loaded, and
  `glDeleteTextures(1, &texture1);` in the clean-up. Nothing visible changes.

## `upload`
- **Task:** Inside `if (data)`, create the texture image from the loaded data with `glTexImage2D` (`GL_RGB`, `GL_UNSIGNED_BYTE`) and generate its mipmaps with `glGenerateMipmap`.
- **Hint:** `glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);` – mip level 0, internal format, size, border 0, then the format and type of the source data. Upload before `stbi_image_free`.
- **When done:** inside `if (data)`:
  `glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);` and
  `glGenerateMipmap(GL_TEXTURE_2D);`. The texture holds the crate, but the shaders do not use it yet: nothing visible
  changes.

## `texture-coords`
- **Task:** Give every vertex texture coordinates – top right (1, 1), bottom right (1, 0), bottom left (0, 0), top left (0, 1) – as vertex attribute 2, and pass them from the vertex shader to the fragment shader as `TexCoord`.
- **Hint:** Each vertex is now 8 floats: stride `8 * sizeof(float)` for all three attributes; the texture coordinates start at `(void*)(6 * sizeof(float))`. In `shader.vs`: `layout (location = 2) in vec2 aTexCoord;`, `out vec2 TexCoord;`, `TexCoord = vec2(aTexCoord.x, aTexCoord.y);`.
- **When done:** `vertices[]` has 8 floats per vertex (position, colour, the four texture coordinates above);
  attributes 0 and 1 use stride `8 * sizeof(float)`, plus
  `glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));` and
  `glEnableVertexAttribArray(2);`. `shader.vs` has `layout (location = 2) in vec2 aTexCoord;`, `out vec2 TexCoord;`
  and `TexCoord = vec2(aTexCoord.x, aTexCoord.y);`. Nothing visible changes yet (the fragment shader still writes the
  vertex colour).

## `sample`
- **Task:** Sample the texture in the fragment shader: `uniform sampler2D texture1;`, `in vec2 TexCoord;`, `FragColor = texture(texture1, TexCoord);`. In the render loop bind the texture before drawing.
- **Hint:** `texture(sampler, coordinates)` returns the filtered colour at the coordinates. A sampler that is never set uses texture unit 0 – the unit `glBindTexture` binds to by default.
- **When done:** `shader.fs` declares `in vec2 TexCoord;` and `uniform sampler2D texture1;` and writes
  `FragColor = texture(texture1, TexCoord);`; in the loop `glBindTexture(GL_TEXTURE_2D, texture1);` before
  `ourShader.use()`. The **crate** fills the rectangle, upright (see "Where the crate is" above): dark frame at
  (204,300) and the brace through the centre (400,300) ≈ 92,58,28, plank at (260,200) ≈ 146,96,52 and at (300,180)
  ≈ 160,106,58, screw at (210,160) ≈ 148,134,116. No vertex colours any more.

## `tint`
- **Task:** Multiply the texture colour by the vertex colour: `FragColor = texture(texture1, TexCoord) * vec4(ourColor, 1.0);`.
- **Hint:** Multiplying colours component-wise filters the texture through the colour – the "funky" crate.
- **When done:** `shader.fs` writes `FragColor = texture(texture1, TexCoord) * vec4(ourColor, 1.0);`. The crate is
  tinted by the four corner colours: plank at (260,200) ≈ 121,94,1 (yellow-ish), (300,180) ≈ 144,90,0, centre
  (400,300) ≈ 46,58,0, top right corner (590,160) red ≈ 114,5,0, bottom left (210,440) almost black-blue ≈ 3,4,45,
  bottom right (590,440) dark green ≈ 3,58,0. Blue is 0 wherever the vertex colour has no blue.

## `texture-units`
- **Task:** Add a second texture `texture2` from `awesomeface.png` (`GL_RGBA`, same parameters), tell the shader which unit each sampler uses (`ourShader.setInt("texture1", 0); ourShader.setInt("texture2", 1);`), bind both with `glActiveTexture` and mix them in the fragment shader: `mix(texture(texture1, TexCoord), texture(texture2, TexCoord), 0.2)` – no tint any more.
- **Hint:** awesomeface.png has an alpha channel: format `GL_RGBA`. Set the sampler uniforms once, after `ourShader.use()`. In the loop: `glActiveTexture(GL_TEXTURE0); glBindTexture(GL_TEXTURE_2D, texture1); glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D, texture2);`.
- **When done:** `unsigned int texture1, texture2;`; a second block creates `texture2` (wrap `GL_REPEAT`, filters
  `GL_LINEAR_MIPMAP_LINEAR`/`GL_LINEAR`), loads `awesomeface.png` (`data = stbi_load(...)`, same error check),
  `glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);` +
  `glGenerateMipmap`, `stbi_image_free(data);`; then `ourShader.use(); ourShader.setInt("texture1", 0);
  ourShader.setInt("texture2", 1);`; the loop binds `texture1` to `GL_TEXTURE0` and `texture2` to `GL_TEXTURE1`;
  `glDeleteTextures(1, &texture2);` in the clean-up. `shader.fs` declares `uniform sampler2D texture2;` and writes
  `FragColor = mix(texture(texture1, TexCoord), texture(texture2, TexCoord), 0.2);`. The crate (untinted again) with
  the **smiley faintly on top** (80 % crate, 20 % face): face area at (400,209) ≈ 168,120,50 and the centre (400,300)
  ≈ 125,89,30 (yellow-ish); outside the face the crate is 20 % darker (the face's transparent pixels are black):
  frame at (204,300) ≈ 74,46,22, plank at (260,200) ≈ 117,77,42. The **heart is on the right** of the face: (489,323)
  ≈ 161,83,54 (reddish); at the mirrored point (311,323) only face yellow ≈ 168,120,50.

## `flip-face`
- **Task:** Exercise 1: make only the happy face look the other way by changing the fragment shader – mirror the face's x texture coordinate.
- **Hint:** Sample the second texture at `vec2(1.0 - TexCoord.x, TexCoord.y)`; the container keeps `TexCoord`.
- **When done:** `shader.fs` writes
  `FragColor = mix(texture(texture1, TexCoord), texture(texture2, vec2(1.0 - TexCoord.x, TexCoord.y)), 0.2);`. The
  face is mirrored, the crate is not (brace still bottom-left to top-right): the **heart moves to the left** –
  (311,323) ≈ 161,83,54 (reddish), (489,323) now face yellow ≈ 168,120,50. Other pixels as after `texture-units`.

## `repeat`
- **Task:** Exercise 2: use texture coordinates from 0.0 to 2.0 so the face repeats 2×2, and set the container's wrapping to `GL_CLAMP_TO_EDGE` (the face keeps `GL_REPEAT`).
- **Hint:** Replace every `1.0f` texture coordinate with `2.0f`. Wrapping is a per-texture setting: change only the two `GL_TEXTURE_WRAP_*` calls after `glBindTexture(GL_TEXTURE_2D, texture1)`.
- **When done:** texture coordinates top right (2, 2), bottom right (2, 0), bottom left (0, 0), top left (0, 2);
  `texture1` uses `GL_CLAMP_TO_EDGE` for `GL_TEXTURE_WRAP_S` and `GL_TEXTURE_WRAP_T`, `texture2` still `GL_REPEAT`.
  The rectangle is split in four 200×150 quarters: **four mirrored faces** (heart on the left of each, e.g. the top
  right copy's heart at (455,237) ≈ 118,52,34; face yellow at (300,180) ≈ 125,89,30). The **crate appears once, small,
  in the bottom-left quarter** (x 200..400, y 300..450; plank at (230,325) ≈ 117,77,42, upright with its screws);
  the rest of the rectangle is the crate's dark edge stretched out (clamp to edge), darkened by the face's
  transparent black: ≈ 74,46,22 at (595,155), (400,225) and the centre (400,300).

## `mix-value`
- **Task:** Exercise 4: replace the fixed mix amount with a `uniform float mixValue` set from C++ (global `float mixValue = 0.5f;`, `ourShader.setFloat("mixValue", mixValue)` every frame), and let the Up/Down arrow keys raise/lower it by 0.001 per frame, kept between 0.0 and 1.0.
- **Hint:** In `processInput`: `if (glfwGetKey(window, GLFW_KEY_UP) == GLFW_PRESS)` add `0.001f` and clamp to `1.0f`; `GLFW_KEY_DOWN` subtracts and clamps to `0.0f`. Set the uniform after `ourShader.use()`.
- **When done:** `shader.fs` has `uniform float mixValue;` and the third argument of `mix` is `mixValue`; `main.cpp`
  has `float mixValue = 0.5f;` after the settings, `ourShader.setFloat("mixValue", mixValue);` in the loop after
  `ourShader.use();`, and the two key blocks in `processInput` (`GLFW_KEY_UP` +0.001f up to 1.0f, `GLFW_KEY_DOWN`
  −0.001f down to 0.0f). Now **50 % face**: the faces are bright – face yellow at (300,180) ≈ 174,136,34, heart at
  (455,237) ≈ 156,44,44 – and everything outside the faces is half as bright: dark edge ≈ 46,29,14 at (595,155),
  (400,225) and (400,300), the small crate's plank at (230,325) ≈ 73,48,26. Holding Up makes the faces stronger
  (at 1.0 only the faces on black), holding Down brings the crate back (at 0.0 only the clamped crate). Final state.
