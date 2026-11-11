# Physically Based Bloom – tasks (OpenGL)

learnopengl "Guest Articles / Phys. Based Bloom": `src/8.guest/2022/6.physically_based_bloom/physically_based_bloom.cpp`
with `6.new_downsample.vs/.fs`, `6.new_upsample.vs/.fs`, `6.bloom_final.fs` (its `bloom_new()`), and the scene of
learnopengl's Bloom chapter. Files: `main.cpp`, `shader_m.h`, `wood.png`, `container2.png`, `bloom.vs/.fs` (the scene's
lighting), `light_box.fs` (the light cubes), `bloom_final.vs/.fs` (tone mapping), `downsample.vs/.fs` and
`upsample.vs/.fs` (learnopengl's `6.new_downsample` / `6.new_upsample` – their `main`s are TODOs in the start).

**Screenshot time: 1.0 s** (nothing moves).

**OpenGL 3.3 core.**

**The start** is the course's `bloom` chapter scene **without** bloom (= the `bloom` chapter's start: learnopengl's
`programChoice == 1`): the scene rendered into one `GL_RGBA16F` colour texture (`colorBuffer`) + a depth renderbuffer
(`hdrFBO`), tone-mapped to the window by `bloom_final.fs`. There is no bright pass: following the article, the
physically based bloom works on the **whole HDR image, without a threshold** (learnopengl's demo code still passes its
thresholded `colorBuffers[1]` to the bloom renderer; the article's text and the course use the scene itself). The old
Gaussian bloom (bright pass + ping-pong blur) is the `bloom` chapter's; the text compares the two.

**Fixed choices (the same in every API):**
- Scene, camera, lights, textures, exposure (1.0) and tone mapping exactly as the `bloom` chapter (see
  `../bloom/tasks.md`): camera (0, 0, 5) looking down -z, clear (0, 0, 0), floor cube + six container boxes + four light
  cubes, both textures sRGB.
- **Structs and free functions** (learnopengl's `bloomFBO` and `BloomRenderer` classes; the simulator follows plain
  structs): `struct BloomMip { glm::vec2 size; glm::ivec2 intSize; unsigned int texture; };`, `struct BloomFBO {
  unsigned int FBO = 0; std::vector<BloomMip> mipChain; };`, `bool InitBloomFBO(BloomFBO&, unsigned int windowWidth,
  unsigned int windowHeight, unsigned int mipChainLength)`, `void DestroyBloomFBO(BloomFBO&)`, `void
  RenderDownsamples(BloomFBO&, Shader& downsampleShader, unsigned int srcTexture, glm::vec2 srcViewportSize)`, `void
  RenderUpsamples(BloomFBO&, Shader& upsampleShader, float filterRadius)`; the `RenderBloomTexture` steps (bind the
  bloom framebuffer, downsample, upsample, unbind, restore the 800×600 viewport) are written out in the render loop.
- **The mip chain: separate textures** (learnopengl's): 6 levels, each half the size of the one before, starting at
  half the window: **400×300, 200×150, 100×75, 50×37, 25×18, 12×9** (`glm::ivec2 /= 2` truncates; the textures are
  created with the float size `(int)mipSize` – the same numbers), format `GL_R11F_G11F_B10F` (floating point, no
  alpha), `GL_LINEAR`, `GL_CLAMP_TO_EDGE`; **one framebuffer** whose colour attachment 0 is switched to the level being
  written (`glFramebufferTexture2D` in the loops) with `glViewport` set to that level's size.
  Vulkan / D3D12 (for their tasks.md): either one image/texture with 6 mip levels and one view (RTV + SRV) per level, or
  6 separate images like learnopengl – choose and explain; per level: a render pass / RTV that writes it and a view
  that samples it, barriers between the passes.
- **Downsample** (`downsample.fs`): learnopengl's 13-tap filter (samples a…m at ±1 and ±2 source texels, weights e ·
  0.125, (a+c+g+i) · 0.03125, (b+d+f+h) · 0.0625, (j+k+l+m) · 0.125), `srcResolution` = the size of the texture being
  read (800×600 for the first pass, then each level's `size`), first input = the HDR `colorBuffer`.
- **Upsample** (`upsample.fs`): learnopengl's 3×3 tent filter (1 2 1 / 2 4 2 / 1 2 1, / 16) with `filterRadius` =
  **0.005** (in texture coordinates, learnopengl's `bloomFilterRadius`), from the smallest level up: level i is read and
  **added** (blending `GL_ONE, GL_ONE`, `GL_FUNC_ADD`) to level i − 1, for i = 5 … 1. The bloom texture is level 0.
- **Combine** (`bloom_final.fs`, learnopengl's `bloom_new()`): `hdrColor = mix(hdrColor, bloomColor, bloomStrength)`
  with **bloomStrength = 0.04**, set from the C++ (`setFloat("bloomStrength", bloomStrength)`; learnopengl gives the
  uniform a GLSL default `= 0.04f`), then the exposure tone mapping and gamma as before.
- **Karis average** (last task): on the first downsample only (`uniform int mipLevel`: 0 for the first pass, then 1),
  learnopengl's five 4-sample groups each weighted by `1 / (1 + luma(ToSRGB(group)) * 0.25)`, then `max(…, 0.0001)`.
  learnopengl switches with `switch (mipLevel)`; the course writes `if (mipLevel == 0) … else …`.

Named points (as in the `bloom` chapter; pixels from the top left of the 800×600 window, Mesa): **white-light**
(400,200), **green-light** (300,20), **box-top** (400,60), **box-frame** (400,128), **box-right** (675,300), **floor-mid**
(450,380), **floor-left** (200,450), **floor-right** (700,500), **background** (600,100), **glow-right** (465,200),
**glow-below** (400,262), **glow-green** (290,55), **corner** (480,130), **rim** (338,200).

**Start picture** (the scene without bloom, = the `bloom` chapter's start): white-light = 254,254,254, green-light =
0,254,0, box-top = 164,116,70, box-frame = 208,210,218, box-right = 171,122,67, floor-mid = 172,134,93, floor-left =
85,59,48, floor-right = 123,91,70, background = 0,0,0, glow-right = 0,0,0, glow-below = 0,0,0, glow-green = 0,0,0,
corner = 3,3,3, rim = 43,38,72. Hard edges around the light cubes.

## `mip-chain`
- **Task:** Create the bloom framebuffer and its mip chain: a `BloomMip` struct (float and integer size, texture) and a `BloomFBO` struct (framebuffer, vector of mips), `InitBloomFBO` creating six `GL_R11F_G11F_B10F` textures, each half the size of the one before (starting at half the window), with linear filtering and edge clamping, and attaching the first one to the framebuffer; `DestroyBloomFBO` for the cleanup. Call it for the window size with 6 levels.
- **Hint:** In the loop: `mipSize *= 0.5f; mipIntSize /= 2;`, `glTexImage2D(GL_TEXTURE_2D, 0, GL_R11F_G11F_B10F, (int)mipSize.x, (int)mipSize.y, 0, GL_RGB, GL_FLOAT, nullptr);`, `bloomFBO.mipChain.push_back(mip);`. After it `glFramebufferTexture2D(…, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, bloomFBO.mipChain[0].texture, 0)`, `glDrawBuffers(1, attachments)` and the completeness check.
- **When done:** `main.cpp`: `struct BloomMip`, `struct BloomFBO`, `bool InitBloomFBO(…)` (`glGenFramebuffers`, the `for`
  loop over `mipChainLength` with `GL_R11F_G11F_B10F`, `GL_LINEAR`, `GL_CLAMP_TO_EDGE`, `push_back`,
  `glFramebufferTexture2D` with `mipChain[0].texture`, `glDrawBuffers(1, attachments)`, `glCheckFramebufferStatus`),
  `void DestroyBloomFBO(BloomFBO&)`; in `main` `BloomFBO bloomFBO;` and `InitBloomFBO(bloomFBO, SCR_WIDTH, SCR_HEIGHT,
  6)`; `DestroyBloomFBO(bloomFBO);` in the cleanup. **No visible change** (same pixels as the start).

## `downsample`
- **Task:** Downsample the HDR scene through the mip chain every frame: write the 13-tap downsample shader and `RenderDownsamples` – for each level set the viewport to its size, attach its texture, draw the screen quad reading the previous level (the scene for the first), then read this level next. For now show the third level (100 × 75) in the window instead of the scene.
- **Hint:** In `downsample.fs` take the 13 samples a … m around `texCoord` (`x`, `y` = one source texel = `1.0 / srcResolution`) and add `e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125`. In the loop: `glBindFramebuffer(GL_FRAMEBUFFER, bloomFBO.FBO); RenderDownsamples(bloomFBO, downsampleShader, colorBuffer, glm::vec2((float)SCR_WIDTH, (float)SCR_HEIGHT));`, then back to framebuffer 0 and `glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT)`. The final pass binds `bloomFBO.mipChain[2].texture`.
- **When done:** `main.cpp`: `Shader downsampleShader("downsample.vs", "downsample.fs");`, `setInt("srcTexture", 0)`,
  `void RenderDownsamples(…)` (`setVec2("srcResolution", …)`, the loop over `bloomFBO.mipChain` with `glViewport`,
  `glFramebufferTexture2D`, `renderQuad()`, `setVec2("srcResolution", mip.size)`, `glBindTexture(GL_TEXTURE_2D,
  mip.texture)`); the `// 2.` block in the render loop; the final pass binds `bloomFBO.mipChain[2].texture`.
  `downsample.fs`: learnopengl's 13 samples and weights (no Karis average yet). The window shows the **100 × 75 level,
  stretched: the scene blurred and blocky**: white-light = 254,254,254, green-light = 7,254,8, box-top = 169,120,72,
  box-frame = 240,239,239, box-right = 166,118,64, floor-mid = 175,137,97, floor-left = 85,58,47, floor-right =
  122,91,69, background = 0,0,0, glow-right = 165,165,164, glow-below = 145,145,145, glow-green = 0,222,0, corner =
  155,156,169, rim = 213,213,214 (the light cubes smeared into their surroundings).

## `upsample`
- **Task:** Upsample back up the chain: write the tent-filter upsample shader and `RenderUpsamples` – from the smallest level up, read level i and draw it with additive blending (`GL_ONE, GL_ONE`) into level i − 1 (viewport and attachment of level i − 1). The filter radius is 0.005 in texture coordinates. For now show level 0 – the finished bloom texture – in the window.
- **Hint:** `for (int i = (int)bloomFBO.mipChain.size() - 1; i > 0; i--)` with `mip = mipChain[i]`, `nextMip = mipChain[i - 1]`; `glEnable(GL_BLEND); glBlendFunc(GL_ONE, GL_ONE); glBlendEquation(GL_FUNC_ADD);` before and `glDisable(GL_BLEND)` after the loop. `upsample.fs`: 9 samples `filterRadius` apart, `e*4 + (b+d+f+h)*2 + (a+c+g+i)`, divided by 16.
- **When done:** `main.cpp`: `float bloomFilterRadius = 0.005f;`, `Shader upsampleShader("upsample.vs",
  "upsample.fs");`, `setInt("srcTexture", 0)`, `void RenderUpsamples(…)` (`setFloat("filterRadius", …)`, the blend
  states, the reverse loop with `glViewport`, `glFramebufferTexture2D` on `nextMip.texture`, `renderQuad()`),
  `RenderUpsamples(bloomFBO, upsampleShader, bloomFilterRadius);` after `RenderDownsamples`; the final pass binds
  `bloomFBO.mipChain[0].texture`. `upsample.fs`: learnopengl's tent filter. The window shows the **bloom texture**: the
  whole scene very soft and bright (the six levels add up), big white halos around the light cubes, even the black
  background lit: white-light = 255,255,255, green-light = 138,255,121, box-top = 250,234,196, box-frame = 255,255,255,
  box-right = 245,214,153, floor-mid = 251,236,209, floor-left = 179,137,128, floor-right = 222,184,147, background =
  38,36,36, glow-right = 254,254,254, glow-below = 254,254,254, glow-green = 139,255,127, corner = 251,251,252, rim =
  255,255,255.

## `combine`
- **Task:** Mix the bloom texture into the scene in the final pass: the scene on unit 0, the bloom texture (level 0) on unit 1 (sampler `bloomBlur`), and in `bloom_final.fs` `mix(hdrColor, bloomColor, bloomStrength)` with a bloom strength of 0.04 before the tone mapping.
- **Hint:** `float bloomStrength = 0.04f;`, `shaderBloomFinal.setInt("bloomBlur", 1);` once; in the final pass `glBindTexture(GL_TEXTURE_2D, colorBuffer)` on unit 0, `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D, bloomFBO.mipChain[0].texture);`, `setFloat("bloomStrength", bloomStrength)`. A linear interpolation instead of an addition keeps the energy: 96 % scene, 4 % bloom.
- **When done:** `main.cpp`: `float bloomStrength = 0.04f;`, `setInt("bloomBlur", 1)`, the final pass binds `colorBuffer`
  on unit 0 and `mipChain[0].texture` on unit 1 and sets `bloomStrength`. `bloom_final.fs`: `uniform sampler2D
  bloomBlur;`, `uniform float bloomStrength;`, `vec3 bloomColor = texture(bloomBlur, TexCoords).rgb;`, `hdrColor =
  mix(hdrColor, bloomColor, bloomStrength);`. The scene is back with a **soft glow everywhere bright light is** (wider and
  smoother than the Gaussian bloom, and without a threshold the whole image glows a little): white-light = 255,255,255,
  green-light = 34,255,29, box-top = 176,130,84, box-frame = 225,226,230, box-right = 179,130,74, floor-mid =
  183,145,105, floor-left = 93,65,55, floor-right = 132,99,76, background = 9,8,8, glow-right = 119,119,117, glow-below =
  117,116,114, glow-green = 34,125,31, corner = 99,98,102, rim = 141,140,147. 454,092 pixels differ from the start by
  more than 2 (94,134 by more than 20).

## `karis-average`
- **Task:** Against "fireflies" (single very bright pixels that flicker when they move): in the first downsample only, weight each of the five 4-sample groups by the Karis average `1 / (1 + luma / 4)` of its sRGB colour. A `mipLevel` uniform says which pass it is: 0 for the first, 1 after it.
- **Hint:** In `RenderDownsamples`: `downsampleShader.setInt("mipLevel", 0);` before the loop and `if (i == 0) { downsampleShader.setInt("mipLevel", 1); }` at the end of the first iteration. `downsample.fs`: learnopengl's `PowVec3`, `ToSRGB`, `sRGBToLuma` (0.299, 0.587, 0.114) and `KarisAverage`; for `mipLevel == 0` the groups `(a+b+d+e) * (0.125f/4.0f)` … `(j+k+l+m) * (0.5f/4.0f)`, each `*= KarisAverage(…)`, summed, `max(downsample, 0.0001f)`; otherwise the old weights.
- **When done:** `main.cpp`: `setInt("mipLevel", 0)` before and `if (i == 0) { downsampleShader.setInt("mipLevel", 1); }`
  in the loop of `RenderDownsamples`. `downsample.fs`: `uniform int mipLevel;`, `PowVec3`, `ToSRGB`, `sRGBToLuma`,
  `KarisAverage`, `vec3 groups[5];` and the `if (mipLevel == 0)` branch. The glow around the brightest parts gets a
  little weaker (the bright samples count less): white-light = 255,255,255, green-light = 33,255,28, box-top =
  175,128,82, box-frame = 222,223,228, box-right = 178,129,73, floor-mid = 182,144,103, floor-left = 93,65,54,
  floor-right = 131,98,76, background = 8,8,8, glow-right = 108,108,105, glow-below = 105,105,103, glow-green =
  33,117,29, corner = 92,91,96, rim = 129,128,137 (47,360 pixels differ from `combine` by more than 2, at most by 14).
  The scene is still: there are no fireflies to see in a still picture – the article's moving camera shows them. This
  is the solution.
