# Gamma Correction (Vulkan) – tasks

learnopengl "Gamma Correction": `src/5.advanced_lighting/2.gamma_correction` (`gamma_correction.cpp`,
`2.gamma_correction.vs/.fs`). Files: `main.cpp`, `shaders/gamma_correction.vert` (complete, as in Advanced Lighting) /
`.frag` (four Blinn-Phong lights), built to `shaders/gamma_correction.vert.spv` / `.frag.spv`, `textures/wood.png`
(stored as sRGB colours, like a photo).

Scene: the floor of Advanced Lighting (±10 at y = -0.5, wood repeated 10×, `VK_SAMPLER_ADDRESS_MODE_REPEAT`), the camera
globals at (0, 0, 3) looking down -z (fov 45, 800/600, 0.1, 100), clear (0.1, 0.1, 0.1), depth test on. learnopengl's
four lights at (-3, 0, 0), (-1, 0, 0), (1, 0, 0), (3, 0, 0) with the colours 0.25, 0.50, 0.75, 1.00 (grey to white), set
in `updateUniformBuffer()` one by one (`ubo.lightPositions[0] = glm::vec4(-3.0f, 0.0f, 0.0f, 0.0f);` …
`ubo.lightColors[3] = glm::vec4(1.00f, 1.00f, 1.00f, 0.0f);`). `BlinnPhong()` in the fragment shader: diffuse +
specular (Blinn-Phong, exponent 64.0) × light colour × attenuation, no ambient; `color *= lighting`.

**Uniform buffer** (binding 0, vertex + fragment stage): `view`, `proj`, `vec4 lightPositions[4]`, `vec4
lightColors[4]`, `vec3 viewPos`. learnopengl's `uniform vec3 lightPositions[4]` cannot be copied as a C++ `glm::vec3[4]`:
in a std140 block every array element starts at a multiple of 16 bytes (a vec3 array has a 16-byte stride, glm::vec3 is
12 bytes). So both sides use **vec4** (w unused, the shader reads `.xyz`); `glm::vec3 viewPos` is followed by `float
pad1;`. This chapter has no push constants (the pipeline layout has `pushConstantRangeCount = 0`).

Start: **no gamma correction**: `loadTexture("textures/wood.png", VK_FORMAT_R8G8B8A8_UNORM, …)` – `loadTexture` and
`createTextureImage` take the image format as a parameter (learnopengl's `loadTexture(path, gammaCorrection)`), UNORM
gives the shader the image's gamma-encoded bytes as if they were linear –, linear attenuation `1.0 / distance`, the
colour written as it is. learnopengl switches all three with one `gamma` flag (Space key); here each is its own task, so
the flag is left out.

**Hardware alternatives (not used in the code):** the swap chain could use an `_SRGB` format: vulkan-tutorial picks
`VK_FORMAT_B8G8R8A8_SRGB` in `chooseSwapSurfaceFormat()`, and then the hardware encodes every colour written to the
window with the sRGB curve (≈ power 1/2.2) – the shader must not do it as well. The course's projects choose
`VK_FORMAT_B8G8R8A8_UNORM` (see the comment in `chooseSwapSurfaceFormat()`), so the colours we write reach the window
unchanged, like OpenGL's default framebuffer – that is why the earlier chapters' colours match OpenGL's, and why this
chapter's correction is done in the shader (learnopengl's way; it also keeps it under your control, e.g. only in the
last pass of a post-processing chain). The same choice exists for textures: `_SRGB` formats decode on sampling (task
`srgb-texture`).

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. Light 2
(-1, 0, 0) lights the floor around (150,430), light 3 (1, 0, 0) around (630,430) (lights 1 and 4 are outside the view,
their light reaches the edges); the vertical seam at x ≈ 400 is avoided. The same points as the OpenGL chapter, whose
pictures these equal (within 1–2 per channel). **background** (400,100) = 26,26,26 in every state.

**Start picture:** a dark floor with bright pools of light, the right ones brighter: **light2** (150,430) 157,107,66,
**light3** (630,430) 255,180,110 (red saturated), **between** (450,430) 99,67,41, **edge-left** (30,470) 69,47,29,
**edge-right** (770,470) 94,64,39, **near** (450,560) 36,24,15, (350,560) 38,26,16.

## gamma-shader
- **Task:** Gamma-correct the output: at the end of `gamma_correction.frag` raise the colour to the power 1.0 / 2.2 before writing it.
- **Hint:** `color = pow(color, vec3(1.0 / 2.2));` before `outColor = vec4(color, 1.0);`. The monitor darkens what it gets (≈ power 2.2); storing the colour to the power 1/2.2 cancels that, so the lighting maths, done in linear space, reaches the eye linearly.
- **When done:** `gamma_correction.frag` main has `color = pow(color, vec3(1.0 / 2.2));` right before `outColor`. The
  whole floor becomes **much brighter and washed out** (greyish), because the wood's colours were already gamma-encoded
  and now get encoded twice: **light2** (150,430) 205,172,138, **light3** (630,430) 255,218,174, **between** (450,430)
  166,139,111, **edge-left** (30,470) 141,118,94, **edge-right** (770,470) 162,136,109, **near** (450,560) 104,88,70,
  (350,560) 107,90,72; background still 26,26,26 (the clear colour is not drawn by the shader).

## srgb-texture
- **Task:** Load the wood texture as an sRGB texture, so that sampling it returns linear colours: in `initVulkan()` call `loadTexture("textures/wood.png", VK_FORMAT_R8G8B8A8_SRGB, …)` instead of `VK_FORMAT_R8G8B8A8_UNORM`.
- **Hint:** The format is used for the image (`createImage`), its layout transitions and its view (`createImageView`). With an `_SRGB` format the sampler converts each texel from sRGB to linear before the shader sees it (and back when writing to an `_SRGB` attachment). Only colour textures are sRGB – specular, normal or height maps stay `_UNORM`.
- **When done:** `main.cpp`: `loadTexture("textures/wood.png", VK_FORMAT_R8G8B8A8_SRGB, floorTextureImage, …)` – the
  texture image and its image view are `VK_FORMAT_R8G8B8A8_SRGB`. The wood gets its **warm, saturated colours back**
  (decoded to linear, lit, encoded once): **light2** (150,430) 158,108,68, **light3** (630,430) 221,151,94, **between**
  (450,430) 128,88,55, **edge-left** (30,470) 118,81,50, **edge-right** (770,470) 133,91,57, **near** (450,560)
  81,55,35, (350,560) 87,60,37. Compared with the start the dark parts are brighter and the bright pools less
  saturated: the light now looks too wide and flat – the attenuation is still the linear 1/d.

## quadratic
- **Task:** Use the physically correct attenuation `1.0 / (distance * distance)` now that the lighting happens in linear space.
- **Hint:** In `BlinnPhong()`: `float attenuation = 1.0 / (distance * distance);`. Without gamma correction the quadratic falloff looked far too strong (the monitor's power 2.2 made it ≈ 1/d⁴·⁴), so linear attenuation was used to compensate; with correct gamma 1/d² looks right.
- **When done:** `gamma_correction.frag`: `float attenuation = 1.0 / (distance * distance);`. The light **falls off
  faster**: brighter right below the lights, darker between and in front of them: **light2** (150,430) 196,134,85,
  **light3** (630,430) 255,188,117, **between** (450,430) 121,83,52, **edge-left** (30,470) 106,72,45, **edge-right**
  (770,470) 121,83,52, **near** (450,560) 57,39,24, (350,560) 61,42,26 – learnopengl's gamma-corrected picture. This
  is the solution.

Simulator (checked with the app's simulator, rebuilt with sRGB support): every state matches lavapipe (< 0.15 % of the
pixels differ by more than 24/255, the points above within 1–2/255), the `_SRGB` texture included.
