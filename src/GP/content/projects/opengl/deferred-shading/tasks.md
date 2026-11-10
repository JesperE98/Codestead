# Deferred Shading – tasks (OpenGL)

learnopengl "Deferred Shading": `src/5.advanced_lighting/8.1.deferred_shading` and `8.2.deferred_shading_volumes`.

**Fixed choices (the same in every API):**
- **Camera: (0, 5, 9), yaw -90, pitch -35** (cameraFront = (0, -0.5735764, -0.8191520)), fov 45, 800/600, near 0.1,
  far 100. learnopengl starts at (0, 0, 5) looking straight ahead: from there the front row hides the grid and most
  lights. From above and behind the whole 3 × 3 grid shows, with the lights between, above and below the boxes.
- **Boxes instead of learnopengl's backpack**: `renderCube()` (2×2×2, position + normal + texcoords) at learnopengl's nine
  objectPositions (x -3, 0, 3; y -0.5; z -3, 0, 3) with model = translate(objectPositions[i]) · **scale(0.75)** – boxes
  1.5 units wide (y from -1.25 to 0.25), 1.5 units apart. `container2.png` (diffuse, sampler `texture_diffuse1`, unit 0)
  and `container2_specular.png` (specular, `texture_specular1`, unit 1), loaded linear (`GL_RGB`, learnopengl's
  deferred demo does not gamma-correct), `GL_REPEAT`, flipped on load. Clear (0, 0, 0), depth test on, no culling.
- **32 lights**, learnopengl's: `srand(13)`, then per light x = `((rand() % 100) / 100.0) * 6.0 - 3.0`, y = `… * 6.0 - 4.0`,
  z = `… * 6.0 - 3.0`, colour r, g, b = `((rand() % 100) / 200.0f) + 0.5` (in this order: x, y, z, r, g, b per light).
  Attenuation constant 1 (not sent), linear 0.7, quadratic 1.8. Lighting (learnopengl's deferred_shading.fs): ambient
  `Diffuse * 0.1`; per light diffuse `max(dot(Normal, lightDir), 0.0) * Diffuse * Color`, Blinn-Phong specular
  `pow(max(dot(Normal, halfwayDir), 0.0), 16.0) * Color * Specular` (Specular = the specular map's red channel), both
  times `1.0 / (1.0 + Linear * d + Quadratic * d * d)`; world space, viewPos = cameraPos; no tone mapping, no gamma.
- **Start** = forward rendering: `forward_shading.vs/.fs` lights every fragment of the boxes with all 32 lights in one
  pass (the same lighting code), so the deferred picture after `lighting-pass` equals the start. The light cubes are not
  drawn in the start (they come with `light-cubes`). The forward shader files stay in the project after `g-buffer`
  (unused, for comparison).
- G-buffer (learnopengl's): `gPosition` GL_RGBA16F, `gNormal` GL_RGBA16F, `gAlbedoSpec` GL_RGBA (8 bit: rgb = albedo,
  a = specular), all GL_NEAREST, colour attachments 0/1/2 with `glDrawBuffers(3, …)`, a GL_DEPTH_COMPONENT
  renderbuffer. Positions and normals in **world space**. The lighting pass is learnopengl's `renderQuad()` (already in
  the start) with `deferred_shading.vs/.fs` (samplers gPosition 0, gNormal 1, gAlbedoSpec 2).
- After `g-buffer` the window shows the **albedo** target (`deferred_shading.fs` of the start writes
  `FragColor = vec4(Diffuse, 1.0)` – "for now: show the albedo"), unlit.
- Light cubes: `renderCube()` at each light, scale 0.125, `deferred_light_box.vs/.fs` (`FragColor = vec4(lightColor, 1.0)`).
- `light-cubes`: the G-buffer's depth is copied into the window's depth buffer with learnopengl's
  `glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_DEPTH_BUFFER_BIT, GL_NEAREST)`
  (read framebuffer gBuffer, draw framebuffer 0). Blitting depth needs the same depth format on both sides; with Mesa
  the `GL_DEPTH_COMPONENT` renderbuffer and GLFW's default depth buffer (24 bit) match – checked: the light cubes are
  hidden correctly behind the boxes. learnopengl's comment about other systems stays in the code.
- `light-volumes` (8.2): each light's radius from learnopengl's formula `(-linear + std::sqrt(linear * linear - 4 *
  quadratic * (constant - (256.0f / 5.0f) * maxBrightness))) / (2.0f * quadratic)` with `maxBrightness =
  std::fmaxf(std::fmaxf(r, g), b)` – about 3.5 (colour 0.5) to 5.1 (colour 1.0); the shader skips a light where
  `distance >= Radius`. The radius is where one light falls below 5/256 – but with 32 lights the skipped little bits add
  up: the picture gets **slightly darker** in places (see the task), not exactly the same (learnopengl's text assumes
  few overlapping lights).
- No input (learnopengl's camera can fly with WASD/mouse; nothing depends on time).

**What the camera sees** (solution): the 3 × 3 grid of wooden boxes with steel frames from above and behind, the near
row large at the bottom (x ≈ 15..785, y ≈ 300..495), the far row small at the top (y ≈ 110..225), black background
between and around them; the boxes' tops and the faces turned to nearby lights are lit warm, the rest dark (only the
0.1 ambient). With `light-cubes`, 32 small pastel cubes float between, above and below the boxes (the ones behind a box
are hidden).

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Named points: **mid-box** (400,280) (the middle box's front face), **front-top** (400,340) (the top of the front
middle box), **front-face** (400,440) (its front face, dark), **left-side** (195,400) (the right side of the front-left
box), **right-side** (610,400) (the left side of the front-right box), **back-frame** (400,150) (the steel frame of the
far middle box), **left-top** (110,340) (the top of the front-left box), **background** (400,50); where light cubes
appear: **light-grey** (150,226) (in front of the left middle box), **light-orange** (609,233), **light-pink**
(428,258) (over the middle box), **light-mint** (288,212) (in a gap), **light-cyan** (320,446) and **light-purple**
(543,556) (over the black background).

**Start picture** (forward rendering, no light cubes): mid-box = 81,48,26, front-top = 35,24,13, front-face =
15,10,5, left-side = 86,59,32, right-side = 51,34,18, back-frame = 149,146,159, left-top = 33,22,12, background =
0,0,0, light-grey = 34,24,13 (the box behind it), light-orange = 81,81,73 (a box frame), light-pink = 114,60,34 (the
middle box), light-mint = light-cyan = light-purple = 0,0,0.

## `g-buffer`
- **Task:** Render the boxes into a G-buffer instead of the window: a framebuffer with three colour textures – positions (`GL_RGBA16F`), normals (`GL_RGBA16F`), albedo + specular (`GL_RGBA`) – and a depth renderbuffer, filled by the geometry pass shader (`g_buffer.vs/.fs`). Then draw the screen quad with the lighting-pass shader, which for now shows the albedo.
- **Hint:** Three `glGenTextures` / `glTexImage2D` / `GL_NEAREST` blocks attached as `GL_COLOR_ATTACHMENT0`, `1`, `2`, then `unsigned int attachments[3] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1, GL_COLOR_ATTACHMENT2 }; glDrawBuffers(3, attachments);` and the depth renderbuffer as in the HDR chapter. `g_buffer.fs` writes `gPosition = FragPos; gNormal = normalize(Normal); gAlbedoSpec.rgb = texture(texture_diffuse1, TexCoords).rgb; gAlbedoSpec.a = texture(texture_specular1, TexCoords).r;`. In the loop: bind `gBuffer`, clear, draw the boxes with `shaderGeometryPass`; bind framebuffer 0, clear, bind `gPosition`, `gNormal`, `gAlbedoSpec` to units 0, 1, 2 and `renderQuad()` with `shaderLightingPass`.
- **When done:** `main.cpp`: `Shader shaderGeometryPass("g_buffer.vs", "g_buffer.fs");` and `Shader
  shaderLightingPass("deferred_shading.vs", "deferred_shading.fs");` (instead of the forward `shader`); learnopengl's
  `// configure g-buffer framebuffer` block (`gBuffer`, `gPosition` / `gNormal` `GL_RGBA16F` + `GL_FLOAT`,
  `gAlbedoSpec` `GL_RGBA` + `GL_UNSIGNED_BYTE`, all `GL_NEAREST`, `GL_COLOR_ATTACHMENT0/1/2`,
  `glDrawBuffers(3, attachments)`, `rboDepth` `GL_DEPTH_COMPONENT` on `GL_DEPTH_ATTACHMENT`,
  `glCheckFramebufferStatus`); shader configuration `shaderGeometryPass.setInt("texture_diffuse1", 0)` /
  `("texture_specular1", 1)` and `shaderLightingPass.setInt("gPosition", 0)`, `("gNormal", 1)`, `("gAlbedoSpec", 2)`;
  in the loop `// 1. geometry pass` (`glBindFramebuffer(GL_FRAMEBUFFER, gBuffer)`, clear, the nine boxes with
  `shaderGeometryPass`, `glBindFramebuffer(GL_FRAMEBUFFER, 0)`) and `// 2. lighting pass` (clear,
  `shaderLightingPass.use()`, the three textures on units 0–2, `renderQuad()`); cleanup deletes the three textures, the
  renderbuffer and the framebuffer. `g_buffer.fs`: learnopengl's four assignments. The window shows the **albedo,
  unlit**: the boxes' plain texture colours at full brightness on black: mid-box = 145,95,50, front-top =
  150,98,52, front-face = 149,97,52, left-side = 150,98,52, right-side = 133,88,46, back-frame = 156,158,164,
  left-top = 150,98,52, light-grey = 150,98,52, light-orange = 153,155,161, light-pink = 133,88,46, background =
  light-mint = light-cyan = light-purple = 0,0,0. Every face looks equally bright (no lighting); wood ≈ 150,98,52,
  steel ≈ 155,157,163.

## `lighting-pass`
- **Task:** Light the G-buffer in the lighting pass: send the 32 lights and the view position to `shaderLightingPass`, and in `deferred_shading.fs` compute learnopengl's lighting from the position, normal, albedo and specular read from the G-buffer.
- **Hint:** The same loop as the forward pass had, now on `shaderLightingPass` (`lights[i].Position`, `.Color`, `.Linear` = 0.7, `.Quadratic` = 1.8, `viewPos`). In the shader: `vec3 lighting = Diffuse * 0.1;`, `vec3 viewDir = normalize(viewPos - FragPos);` and for each light the diffuse, the Blinn-Phong specular (`pow(…, 16.0)` times `Specular`) and the attenuation – exactly the forward shader's code.
- **When done:** `main.cpp`: in the lighting pass `// send light relevant uniforms`: the `for` loop over
  `lightPositions.size()` with `shaderLightingPass.setVec3("lights[" + std::to_string(i) + "].Position", …)`, `.Color`,
  `const float linear = 0.7f;`, `const float quadratic = 1.8f;`, `.Linear`, `.Quadratic`, then
  `shaderLightingPass.setVec3("viewPos", cameraPos);`. `deferred_shading.fs`: learnopengl's 8.1 lighting (`lighting =
  Diffuse * 0.1`, the loop over `NR_LIGHTS`, `pow(max(dot(Normal, halfwayDir), 0.0), 16.0)`, `1.0 / (1.0 + Linear * d +
  Quadratic * d * d)`, `FragColor = vec4(lighting, 1.0)`). The picture is **the start picture again** (measured: no
  pixel differs by more than 1 from the forward rendering): mid-box = 81,48,26, front-top = 35,24,13, front-face =
  15,10,5, left-side = 86,59,32, right-side = 51,34,18, back-frame = 149,146,159, left-top = 33,22,12, light-grey =
  34,24,13, light-orange = 81,81,73, light-pink = 114,60,34, background = light-mint = light-cyan = light-purple =
  0,0,0. Now each pixel is lit once (800 × 600 × 32 light calculations), however many boxes overlap there.

## `light-cubes`
- **Task:** Show the lights: copy the G-buffer's depth into the window's depth buffer, then draw a small cube at every light (scale 0.125) in the light's colour with `shaderLightBox`, depth-tested against the boxes.
- **Hint:** `glBindFramebuffer(GL_READ_FRAMEBUFFER, gBuffer); glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0); glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_DEPTH_BUFFER_BIT, GL_NEAREST);` then `glBindFramebuffer(GL_FRAMEBUFFER, 0)`. The window's depth buffer only holds the screen quad's flat depth (0.5 everywhere, NDC z = 0), not the boxes', so without the copy the cubes would not be hidden behind the boxes correctly. The cubes: `renderCube()` with model = translate(lightPositions[i]) · scale(0.125) and `setVec3("lightColor", lightColors[i])`.
- **When done:** `main.cpp`: `Shader shaderLightBox("deferred_light_box.vs", "deferred_light_box.fs");`; after the
  lighting pass `// 2.5. copy content of geometry's depth buffer to default framebuffer's depth buffer`:
  `glBindFramebuffer(GL_READ_FRAMEBUFFER, gBuffer)`, `glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0)`,
  `glBlitFramebuffer(…, GL_DEPTH_BUFFER_BIT, GL_NEAREST)`, `glBindFramebuffer(GL_FRAMEBUFFER, 0)`; `// 3. render lights
  on top of scene`: `shaderLightBox` with projection, view and per light `glm::translate(model, lightPositions[i])`,
  `glm::scale(model, glm::vec3(0.125f))`, `setVec3("lightColor", lightColors[i])`, `renderCube()`. **32 small pastel
  cubes** appear (about 12 × 12 to 28 × 28 px; a few are hidden behind boxes, e.g. under the left middle box):
  light-grey = 161,159,163, light-orange = 244,209,158, light-pink = 238,150,171, light-mint = 143,204,181,
  light-cyan = 129,242,231, light-purple = 201,157,237. Everything else as before (mid-box = 81,48,26, back-frame =
  149,146,159, background = 0,0,0 …); 13,550 pixels change.

## `light-volumes`
- **Task:** Give every light a radius (learnopengl's light volume: the distance where its attenuated brightness drops below 5/256) and skip the light in the lighting shader where the fragment is farther away than that.
- **Hint:** In the light loop: `const float constant = 1.0f;`, `const float maxBrightness = std::fmaxf(std::fmaxf(lightColors[i].r, lightColors[i].g), lightColors[i].b);`, `float radius = (-linear + std::sqrt(linear * linear - 4 * quadratic * (constant - (256.0f / 5.0f) * maxBrightness))) / (2.0f * quadratic);` and `setFloat("lights[…].Radius", radius)`. In the shader: `float Radius;` in `Light`, `float distance = length(lights[i].Position - FragPos);` first, then `if(distance < lights[i].Radius) { … }` around the light's work.
- **When done:** `main.cpp`: `// update attenuation parameters and calculate radius`, `const float constant = 1.0f;`,
  `// then calculate radius of light volume/sphere`, `maxBrightness` with `std::fmaxf`, `radius` with `std::sqrt`,
  `shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Radius", radius);`. `deferred_shading.fs`: `float
  Radius;` in the struct and learnopengl's 8.2 loop (`if(distance < lights[i].Radius)`). The picture is **almost the
  same, a little darker where many lights just outside their radius used to add up**: 28,562 pixels get darker by more
  than 5 (7,668 by more than 20, at most 43), mainly the steel frames of the far row and the inner sides of the front
  corner boxes: back-frame = 117,113,124 (before 149,146,159), left-side = 66,46,25 (86,59,32), right-side = 36,24,12
  (51,34,18), mid-box = 80,47,25, left-top = 31,20,11; unchanged: front-top = 35,24,13, front-face = 15,10,5, the light
  cubes, background = 0,0,0. Why a real renderer goes further: the `if` saves nothing on a GPU – the fragments of a
  group run in lockstep, so the loop still costs every light wherever one fragment needs it. learnopengl's answer is
  to draw each light's **volume** (a sphere of that radius) and light only the pixels it covers – the lighting shader
  then runs once per light per covered pixel only (drawn with front-face culling, so it also works when the camera is
  inside a volume). This is the solution.
