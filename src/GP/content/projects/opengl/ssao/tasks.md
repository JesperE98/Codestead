# SSAO – tasks (OpenGL)

learnopengl "SSAO": `src/5.advanced_lighting/9.ssao`. Files: `main.cpp`, `shader_m.h`, `mesh.h` + `model.h` (the Model
Loading part's classes, unchanged; compiled with `-lassimp`), the read-only model in `models/` (`planet.obj`,
`planet.mtl` and its four textures), `ssao_geometry.vs/.fs` (the geometry pass), `ssao.vs` (the screen quad, shared by
the three screen passes), `ssao_lighting.fs` (the lighting pass), `ssao.fs` and `ssao_blur.fs` (their `main` is a TODO
in the start).

**Fixed choices (the same in every API):**
- learnopengl's scene with the course's planet instead of learnopengl's **backpack** model: the room =
  `renderCube()` with model = translate(0, 7, 0) · scale(7.5) drawn with `invertedNormals` = 1 (the inside is seen:
  floor at y = -0.5, back wall at z = -7.5); the planet (`Model planet("models/planet.obj")`, its two meshes `planet`
  – radius 1 – and `rings` – a flat ring 1.4–2.0 in the xz plane, normal +y) with model = translate(0, 0.5, 0) ·
  scale(1.0): it stands on the floor. learnopengl rotates the backpack -90° about x – the planet is not rotated.
- Camera (0, 0, 5) looking down -z (yaw -90, pitch 0), fov 45, 800/600, near 0.1, **far 50** (learnopengl's ssao.cpp
  uses 50). Clear (0, 0, 0), depth test on, no culling. The ring at y = 0.5 is just above the eye: it is seen
  **from below**.
- G-buffer in **view space** (learnopengl's ssao_geometry.vs: `FragPos = (view * model * aPos).xyz`, normal matrix
  `transpose(inverse(mat3(view * model)))`, the normal negated when `invertedNormals`): `gPosition` GL_RGBA16F with
  GL_CLAMP_TO_EDGE (the SSAO samples near the window's edges must not wrap), `gNormal` GL_RGBA16F, `gAlbedo` GL_RGBA,
  all GL_NEAREST, depth renderbuffer. Albedo = `vec3(0.95)` for everything (learnopengl's; the model's textures are
  loaded by `Model` but not used).
- One light: position (2, 4, -2) in world space, sent in view space (`glm::vec3(view * glm::vec4(lightPos, 1.0))`),
  colour (0.2, 0.2, 0.7), linear 0.09, quadratic 0.032. `ssao_lighting.fs` (learnopengl's): ambient `0.3 * Diffuse`
  (× AO after `apply`), diffuse, Blinn-Phong specular `pow(…, 8.0)` with viewDir = `normalize(-FragPos)`, attenuated.
- **Kernel: 32 samples** (learnopengl 64; the course's simulator computes the SSAO pass on the CPU), radius 0.5, bias
  0.025, `ssao.fs` with `uniform vec3 samples[32]` and `int kernelSize = 32`. **Random numbers: `srand(42)` and
  `rand() / (float)RAND_MAX`** instead of learnopengl's `std::uniform_real_distribution` + `std::default_random_engine`
  (whose sequence differs between standard libraries): the course's simulator reproduces glibc's rand() exactly, so the
  preview shows the same kernel and noise as the real program. Every random number gets its own statement (`float x =
  …; float y = …; float z = …;`) – C++ does not fix the order in which a function's arguments are evaluated, so
  `glm::vec3(rand…, rand…, rand…)` could draw them in a different order on another compiler. Order: per sample x, y, z
  (`* 2.0f - 1.0f` for x/y, z in 0..1), then the length factor; `scale = ourLerp(0.1f, 1.0f, (i / 32.0f)²)`; then the
  16 noise vectors (x, y each `* 2.0f - 1.0f`, z = 0). (On Windows/MSVC rand() gives other numbers – the picture looks
  the same.)
- Noise texture 4 × 4, `GL_RGBA32F` from `GL_RGB` / `GL_FLOAT` data (`&ssaoNoise[0]`), GL_NEAREST, **GL_REPEAT**, unit 2,
  sampled with `noiseScale = vec2(800.0/4.0, 600.0/4.0)`. SSAO target: `GL_RED` (one float channel), 800 × 600,
  GL_NEAREST; the blur target the same.
- What the window shows in between: after `kernel` and `blur` the lighting pass still runs, but `ssao_lighting.fs` ends
  with `FragColor = vec4(vec3(texture(ssao, TexCoords).r), 1.0); // for now: show the SSAO texture` – the grey AO
  texture (unit 3: `ssaoColorBuffer` after `kernel`, `ssaoColorBufferBlur` after `blur`). `apply` removes that line.
- No input (learnopengl's camera can fly; nothing depends on time).

**What the camera sees** (start / solution): the inside of a large grey room lit blue from the upper right (the light
is behind and above the planet): the back wall, the floor below y ≈ 327 (the floor/wall edge is a thin line), and the
grey planet in the middle (a disc x ≈ 252..548, y ≈ 75..372) standing on the floor; its front faces away from the
light and gets only the ambient light; its upper right edge is lit blue. The ring crosses in front of it from x ≈ 85 to
715 (y ≈ 180..245), seen from below; behind the planet the ring is hidden.

**Why the ring is dark in the AO picture:** the ring is a single plane whose normal points up (+y), and the camera sees
its underside. SSAO puts its hemisphere of samples on the normal's side – above the ring, i.e. behind it as the camera
sees it – so most samples land behind the ring's own surface and count as occluded. learnopengl's backpack has no such
one-sided surfaces. (A fix would flip the normal for back faces with `gl_FrontFacing` in the geometry pass; not done –
the course keeps learnopengl's shaders.)

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Named points: **planet** (400,280) and **planet-left** (300,240) (the planet's front), **planet-lit** (470,110) (its
upper right, lit), **above-ring** (400,172) (the planet just above the ring), **ring-mid** (400,190) (the ring in front
of the planet), **ring-left** (150,213) and **ring-right** (650,215) (the ring's outer parts), **contact** (400,376)
and **contact-left** (340,372) (the floor right under the planet), **edge** (100,327) (the floor/wall edge), **floor**
(400,500), **wall** (100,100), **wall-lit** (520,40) (the back wall near the light).

**Start picture** (deferred, no AO): planet = 73,73,73, planet-left = 73,73,73, planet-lit = 103,103,179, above-ring
= 73,73,75, ring-mid = 87,87,122, ring-left = 84,84,114, ring-right = 99,99,165, contact = 93,93,144, contact-left =
91,91,136, edge = 79,79,95, floor = 90,90,134, wall = 81,81,102, wall-lit = 109,109,199.

## `kernel`
- **Task:** Generate the SSAO input on the CPU – the 32-sample kernel in a hemisphere (`srand(42)`, `rand() / (float)RAND_MAX`) and the 4 × 4 noise texture of random rotations – and add the SSAO pass: a framebuffer with one `GL_RED` texture, filled by `ssao.fs` on the screen quad. For now show the SSAO texture in the window.
- **Hint:** Per sample: `x`, `y` = `rand() / (float)RAND_MAX * 2.0f - 1.0f`, `z` = `rand() / (float)RAND_MAX`; normalize, multiply by another random float, then by `ourLerp(0.1f, 1.0f, scale * scale)` with `scale = float(i) / 32.0f`. Noise: 16 × `glm::vec3(x, y, 0.0f)` into a `GL_RGBA32F` 4 × 4 texture with `GL_REPEAT` and `GL_NEAREST`. `ssao.fs`: TBN from the normal and `randomVec` (Gram-Schmidt), for each sample `samplePos = fragPos + TBN * samples[i] * radius`, project it with `projection`, `* 0.5 + 0.5`, read `texture(gPosition, offset.xy).z` and add `(sampleDepth >= samplePos.z + bias ? 1.0 : 0.0) * rangeCheck`; `FragColor = 1.0 - occlusion / kernelSize`. In the lighting pass bind `ssaoColorBuffer` to unit 3 (`ssao` sampler) and show it with the "for now" line.
- **When done:** `main.cpp`: `Shader shaderSSAO("ssao.vs", "ssao.fs");`; `ssaoFBO` with `ssaoColorBuffer`
  (`glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, SCR_WIDTH, SCR_HEIGHT, 0, GL_RED, GL_FLOAT, NULL)`, `GL_NEAREST`,
  `GL_COLOR_ATTACHMENT0`, `glCheckFramebufferStatus`); `// generate sample kernel` (`srand(42)`, `std::vector<glm::vec3>
  ssaoKernel`, the loop `i < 32` with the four `rand() / (float)RAND_MAX`, `glm::normalize`, `ourLerp(0.1f, 1.0f, scale
  * scale)`, `push_back`); `// generate noise texture` (`ssaoNoise`, 16 vectors, `noiseTexture`, `GL_RGBA32F`, 4, 4,
  `GL_RGB`, `GL_FLOAT`, `&ssaoNoise[0]`, `GL_NEAREST`, `GL_REPEAT`); `shaderLightingPass.setInt("ssao", 3)`,
  `shaderSSAO.setInt("gPosition", 0)`, `("gNormal", 1)`, `("texNoise", 2)`; `// 2. generate SSAO texture` in the loop
  (`glBindFramebuffer(GL_FRAMEBUFFER, ssaoFBO)`, `glClear(GL_COLOR_BUFFER_BIT)`, the 32 `samples[i]`, `projection`,
  gPosition / gNormal / noiseTexture on units 0–2, `renderQuad()`, back to 0); in the lighting pass
  `glActiveTexture(GL_TEXTURE3); glBindTexture(GL_TEXTURE_2D, ssaoColorBuffer);`; cleanup. `ssao.fs`: learnopengl's
  `main`. `ssao_lighting.fs`: `uniform sampler2D ssao;` and the "for now" line. The window shows **the raw SSAO
  texture in grey**: white (255) where nothing occludes – planet, planet-left, planet-lit, floor, wall, wall-lit =
  255,255,255; grey where it does: the ring's underside dark with a gradient (ring-left = 53,53,53, ring-right =
  63,63,63, ring-mid = 112,112,112; darkest ≈ 14 at the ring's outer edge), the contact shadow under the planet
  (contact = 143,143,143, contact-left = 192,192,192), the floor/wall edge as a thin grey line (edge = 208,208,208), a
  faint band on the planet just above the ring (above-ring = 249,249,249). 45,069 pixels are below 250. The grey areas
  show the **4 × 4 noise pattern** (a fine regular dither: neighbouring pixels differ).

## `blur`
- **Task:** Blur the SSAO texture to remove the noise pattern: a second framebuffer with one `GL_RED` texture, filled by `ssao_blur.fs` (learnopengl's 4 × 4 box blur) reading the SSAO texture. Show the blurred texture.
- **Hint:** The framebuffer like `ssaoFBO` (`ssaoBlurFBO`, `ssaoColorBufferBlur`). `ssao_blur.fs`: `vec2 texelSize = 1.0 / vec2(textureSize(ssaoInput, 0));` and the sum of `texture(ssaoInput, TexCoords + vec2(float(x), float(y)) * texelSize).r` for x and y from -2 to 1, divided by 16. In the loop: bind `ssaoBlurFBO`, clear, `shaderSSAOBlur`, `ssaoColorBuffer` on unit 0, `renderQuad()`. The lighting pass now binds `ssaoColorBufferBlur` to unit 3.
- **When done:** `main.cpp`: `Shader shaderSSAOBlur("ssao.vs", "ssao_blur.fs");`; `// and blur stage` (`ssaoBlurFBO`,
  `ssaoColorBufferBlur`, `GL_RED`, `GL_NEAREST`, `glCheckFramebufferStatus`); `shaderSSAOBlur.setInt("ssaoInput", 0)`;
  `// 3. blur SSAO texture to remove noise` in the loop (`glBindFramebuffer(GL_FRAMEBUFFER, ssaoBlurFBO)`,
  `glClear(GL_COLOR_BUFFER_BIT)`, `shaderSSAOBlur.use()`, `glBindTexture(GL_TEXTURE_2D, ssaoColorBuffer)`,
  `renderQuad()`); the lighting pass binds `ssaoColorBufferBlur`; cleanup. `ssao_blur.fs`: learnopengl's `main`. The
  window shows **the smooth AO** (the dither is gone: the mean difference between horizontal neighbours drops from 0.85
  to 0.11): ring-left = 56,56,56, ring-right = 60,60,60, ring-mid = 110,110,110, contact = 161,161,161, contact-left =
  196,196,196, edge = 219,219,219, above-ring = 233,233,233, planet-left = 254,254,254; still white: planet,
  planet-lit, floor, wall, wall-lit = 255,255,255. (The blur's 4 × 4 window is not centred – offsets -2..1 – so the
  picture moves by half a pixel, as in learnopengl.)

## `apply`
- **Task:** Use the blurred AO in the lighting: multiply the ambient term by it, and remove the line that showed the SSAO texture.
- **Hint:** `float AmbientOcclusion = texture(ssao, TexCoords).r;` and `vec3 ambient = vec3(0.3 * Diffuse * AmbientOcclusion);` – only the ambient light is occluded; the direct light keeps its own (shadow-free) diffuse and specular.
- **When done:** `ssao_lighting.fs`: `float AmbientOcclusion = texture(ssao, TexCoords).r;`, `vec3 ambient = vec3(0.3 *
  Diffuse * AmbientOcclusion);`, the "for now" line is gone (learnopengl's 9.ssao_lighting.fs); `main.cpp`: the pass
  comment `// 4. lighting pass: traditional deferred Blinn-Phong lighting with added screen-space ambient occlusion`.
  The lit scene is back, **darker where the AO is grey**: the ring's underside (ring-left = 28,28,57 – start
  84,84,114; ring-right = 44,44,110 – start 99,99,165; ring-mid = 45,45,81 – start 87,87,122), the contact shadow under
  the planet (contact = 66,66,117 – start 93,93,144; contact-left = 74,74,120 – start 91,91,136), the floor/wall edge
  (edge = 69,69,85 – start 79,79,95), above-ring = 67,67,68 (start 73,73,75); unchanged: planet = 73,73,73,
  planet-lit = 103,103,179, floor = 90,90,134, wall = 81,81,102, wall-lit = 109,109,199, planet-left = 72,72,72.
  42,038 pixels get darker by more than 2 (13,839 by more than 30, at most 60; none brighter), all between y = 175 and
  379. This is the solution.
