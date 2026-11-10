# Gamma Correction – tasks (OpenGL)

learnopengl "Gamma Correction": `src/5.advanced_lighting/2.gamma_correction` (`gamma_correction.cpp`,
`2.gamma_correction.vs/.fs`). Files: `main.cpp`, `shader_m.h`, `gamma_correction.vs` (complete, as in Advanced
Lighting), `gamma_correction.fs` (four Blinn-Phong lights), `wood.png` (stored as sRGB colours, like a photo).

Scene: the floor of Advanced Lighting (±10 at y = -0.5, wood repeated 10×, `GL_REPEAT`), learnopengl's four lights
`lightPositions[]` = (-3, 0, 0), (-1, 0, 0), (1, 0, 0), (3, 0, 0) with `lightColors[]` = 0.25, 0.50, 0.75, 1.00 (grey to
white), sent each frame with learnopengl's `glUniform3fv(glGetUniformLocation(shader.ID, "lightPositions"), 4,
&lightPositions[0][0]);` (and the same for `lightColors`) to `uniform vec3 lightPositions[4]; uniform vec3
lightColors[4];`. `BlinnPhong()`: diffuse + specular (Blinn-Phong, exponent 64.0) × light colour × attenuation; no
ambient; `color *= lighting`. The course's camera globals at (0, 0, 3) looking down -z (fov 45, 800/600, 0.1, 100),
clear (0.1, 0.1, 0.1), depth test on.

Start: **no gamma correction**: `loadTexture("wood.png")` uploads the image as `GL_RGB` (the sampled colours are the
image's gamma-encoded values, treated as if linear), linear attenuation `1.0 / distance`, the colour written as it is.
learnopengl switches all three with one `gamma` flag (Space key); here each is its own task, so the flag is left out.

**Hardware alternatives (not used in the code, explained in the chapter):** `glEnable(GL_FRAMEBUFFER_SRGB);` makes
OpenGL encode every colour written to the default framebuffer to sRGB (the same `pow(c, 1/2.2)`-like curve) – then the
shader must not do it as well. Doing it in the shader, as here, keeps it under your control (e.g. only on the last
pass of a post-processing chain).

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Light 2 (-1, 0, 0) lights the floor around (150,430), light 3 (1, 0, 0) around (630,430) (lights 1 and 4 are outside
the view, their light reaches the edges). The vertical seam at x ≈ 400 is avoided.
**background** (400,100) = 26,26,26 in every state.

**Start picture:** a dark floor with four bright pools of light, the right ones brighter:
**light2** (150,430) ≈ 156,106,65, **light3** (630,430) ≈ 255,181,110 (saturated red), **between** (450,430) ≈ 99,68,42,
**edge-left** (30,470) ≈ 69,47,29, **edge-right** (770,470) ≈ 94,64,39, **near** (450,560) ≈ 35,24,15, (350,560) ≈
38,26,16.

## `gamma-shader`
- **Task:** Gamma-correct the output: at the end of the fragment shader raise the colour to the power 1.0 / 2.2 before writing it.
- **Hint:** `color = pow(color, vec3(1.0/2.2));` before `FragColor = vec4(color, 1.0);`. The monitor darkens what it gets (≈ power 2.2); storing the colour to the power 1/2.2 cancels that, so the lighting maths, done in linear space, reaches the eye linearly.
- **When done:** `gamma_correction.fs` main has `color = pow(color, vec3(1.0/2.2));` right before `FragColor`. The whole
  floor becomes **much brighter and washed out** (greyish), because the wood's colours were already gamma-encoded and
  now get encoded twice: **light2** (150,430) ≈ 204,171,137, **light3** (630,430) ≈ 255,218,174, **between** (450,430) ≈
  166,140,112, **edge-left** (30,470) ≈ 141,118,95, **edge-right** (770,470) ≈ 162,136,109, **near** (450,560) ≈
  104,88,70; background still 26,26,26 (the clear colour is not drawn by the shader).

## `srgb-texture`
- **Task:** Load the wood texture as an sRGB texture, so that sampling it returns linear colours: give `loadTexture` a `bool gammaCorrection` parameter that picks the internal format `GL_SRGB` (`GL_SRGB_ALPHA` for 4 channels) instead of `GL_RGB` (`GL_RGBA`), and load `wood.png` with `true`.
- **Hint:** learnopengl's loadTexture: `GLenum internalFormat; GLenum dataFormat;` – for 3 components `internalFormat = gammaCorrection ? GL_SRGB : GL_RGB; dataFormat = GL_RGB;`, for 4 `GL_SRGB_ALPHA` / `GL_RGBA`, for 1 both `GL_RED`; then `glTexImage2D(GL_TEXTURE_2D, 0, internalFormat, width, height, 0, dataFormat, GL_UNSIGNED_BYTE, data);`. Change the prototype at the top too. Only colour textures are sRGB – specular, normal or height maps stay linear.
- **When done:** `main.cpp`: prototype and definition `unsigned int loadTexture(const char *path, bool gammaCorrection)`;
  in it learnopengl's `internalFormat` / `dataFormat` choice (`gammaCorrection ? GL_SRGB : GL_RGB`,
  `gammaCorrection ? GL_SRGB_ALPHA : GL_RGBA`, `GL_RED`) and `glTexImage2D(GL_TEXTURE_2D, 0, internalFormat, width,
  height, 0, dataFormat, GL_UNSIGNED_BYTE, data)`; the call `loadTexture("wood.png", true)`. The wood gets its **warm,
  saturated colours back** (decoded to linear, lit, encoded once): **light2** (150,430) ≈ 157,108,68, **light3**
  (630,430) ≈ 220,151,94, **between** (450,430) ≈ 128,89,56, **edge-left** (30,470) ≈ 118,81,51, **edge-right**
  (770,470) ≈ 133,91,57, **near** (450,560) ≈ 81,55,35, (350,560) ≈ 87,60,37. Compared with the start the dark parts are
  brighter and the bright pools less saturated: the light now looks too wide and flat – the attenuation is still the
  linear 1/d.

## `quadratic`
- **Task:** Use the physically correct attenuation `1.0 / (distance * distance)` now that the lighting happens in linear space.
- **Hint:** In `BlinnPhong()`: `float attenuation = 1.0 / (distance * distance);`. Without gamma correction the quadratic falloff looked far too strong (the monitor's power 2.2 made it ≈ 1/d⁴·⁴), so linear attenuation was used to compensate; with correct gamma 1/d² looks right.
- **When done:** `gamma_correction.fs`: `float attenuation = 1.0 / (distance * distance);`. The light **falls off
  faster**: brighter right below the lights, darker between and in front of them: **light2** (150,430) ≈ 194,134,85,
  **light3** (630,430) ≈ 255,188,117, **between** (450,430) ≈ 121,84,53, **edge-left** (30,470) ≈ 106,73,45,
  **edge-right** (770,470) ≈ 121,83,52, **near** (450,560) ≈ 57,39,24, (350,560) ≈ 61,42,26 – learnopengl's
  gamma-corrected picture. This is the solution.
