# Bloom – tasks (OpenGL)

learnopengl "Bloom": `src/5.advanced_lighting/7.bloom`. Files: `main.cpp`, `shader_m.h`, `wood.png`, `container2.png`,
`bloom.vs/.fs` (the scene's lighting), `light_box.fs` (the light cubes, with `bloom.vs`), `blur.vs/.fs` (the Gaussian
blur: `blur.fs`'s `main` is a TODO), `bloom_final.vs/.fs` (the screen quad's tone mapping).

**Fixed choices (the same in every API):**
- Camera: (0, 0, 5) looking down -z (yaw -90, pitch 0, fov 45, 800/600, near 0.1, far 100) – learnopengl's. Clear
  (0.0, 0.0, 0.0), depth test on, no culling.
- Scene (learnopengl's bloom.cpp, all with `renderCube()`, the 2×2×2 cube): the floor cube translate(0, -1, 0) ·
  scale(12.5, 0.5, 12.5) with `wood.png`; six boxes with `container2.png`: (0, 1.5, 0) scale 0.5; (2, 0, 1) scale 0.5;
  (-1, -1, 2) rotate 60° about normalize(1, 0, 1) (no scale); (0, 2.7, 4) rotate 23° about normalize(1, 0, 1) scale
  1.25; (-2, 1, -3) rotate 124° about normalize(1, 0, 1) (no scale); (-3, 0, 0) scale 0.5. Both textures loaded as
  **sRGB** (`loadTexture(…, true)` → `GL_SRGB` / `GL_SRGB_ALPHA`), `GL_REPEAT`, flipped on load, unit 0, sampler
  `diffuseTexture`.
- Four lights: positions (0, 0.5, 1.5), (-4, 0.5, -3), (3, 0.5, 1), (-0.8, 2.4, -1); colours (5, 5, 5), (10, 0, 0),
  (0, 0, 15), (0, 5, 0). `bloom.fs`: no ambient, diffuse with `1.0 / (distance * distance)`, no specular. The light
  cubes: translate(lightPositions[i]) · scale(0.25), drawn with `bloom.vs` + `light_box.fs` (`FragColor =
  vec4(lightColor, 1.0)`).
- Exposure 1.0, tone mapping as learnopengl's bloom_final.fs: `result = vec3(1.0) - exp(-hdrColor * exposure)`, then
  `pow(result, vec3(1.0 / 2.2))`.
- **Start** = the hdr chapter's end state with this scene: the scene rendered into one `GL_RGBA16F` colour texture
  (`colorBuffer`, `GL_LINEAR`, `GL_CLAMP_TO_EDGE`) + a depth renderbuffer (`hdrFBO`), then tone-mapped to the window
  by `bloom_final.fs` (sampler `scene`) on learnopengl's `renderQuad()`.
- What the window shows in the intermediate tasks: after `bright-pass` the final quad samples the **bright texture**
  (colour attachment 1) instead of the scene, after `blur` the **blurred bright texture** – both through the same
  bloom_final tone mapping + gamma (only the texture bound to the `scene` sampler changes). After `combine` the
  scene plus the blurred bright texture, tone-mapped.
- Blur: learnopengl's ping-pong framebuffers (two `GL_RGBA16F` 800×600 textures, `GL_LINEAR`, `GL_CLAMP_TO_EDGE`, no
  depth), `amount = 10` passes starting horizontal, the first pass reading the bright texture; weights 0.2270270270,
  0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162; texel offset `1.0 / textureSize(image, 0)` (one texel of the
  800×600 target). The final pass reads `pingpongColorbuffers[!horizontal]` (= the last one written: index 0 after
  10 passes: the result of a vertical pass).
- No input: learnopengl toggles bloom with Space and the exposure with Q/E; there is no `bloom` uniform here – the
  `combine` task adds the bloom for good.

**What the camera sees** (learnopengl's start position, nothing moved): the wooden floor from just above (its far edge
at y ≈ 320, lit warm in the middle by the white light and purple at the right by the blue one), the large box at
(-1, -1, 2) very close on the left (a big tilted container with a blue-grey steel frame, its top lit), the box
(0, 1.5, 0) at the top centre with the **white light cube** (0, 0.5, 1.5) right under it (x ≈ 345..455, y ≈ 133..250),
the box (-2, 1, -3) behind on the left (its top lit green), the **green light cube** (-0.8, 2.4, -1) cut by the top
edge (x ≈ 268..320, y 0..50), and the left side of the box (2, 0, 1) at the right (x ≈ 640..710, y ≈ 200..400).
Above the floor's far edge the background is black. The red light cube is hidden behind the big box, the blue one
is outside the view on the right; the boxes (0, 2.7, 4) and (-3, 0, 0) are outside the view too.

Pixels measured with Mesa (llvmpipe), coordinates from the top left of the 800×600 window; nothing depends on time.
Named points: **white-light** (400,200), **green-light** (300,20), **box-top** (400,60) (the wood of box (0, 1.5, 0)),
**box-frame** (400,128) (its lower steel frame, close above the white light), **box-right** (675,300) (the side of box
(2, 0, 1)), **floor-mid** (450,380), **floor-left** (200,450), **floor-right** (700,500), **background** (600,100),
**glow-right** (465,200) and **glow-below** (400,262) (black background just right of / below the white light cube),
**glow-green** (290,55) (just below the green light cube), **frame-green** (325,30) (box (0, 1.5, 0)'s frame next to
the green light), **corner** (480,130) (the dark corner right of box-frame), **rim** (338,200) (just left of the white
light cube).

**Start picture:** the tone-mapped scene without bloom: white-light = 254,254,254, green-light = 0,254,0, box-top =
164,116,70, box-frame = 208,210,218, box-right = 171,122,67, floor-mid = 172,134,93, floor-left = 85,59,48,
floor-right = 123,91,70, background = 0,0,0, glow-right = 0,0,0, glow-below = 0,0,0, glow-green = 0,0,0, frame-green
= 149,150,162, corner = 3,3,3, rim = 43,38,72. The light cubes have hard edges: right next to them the background is
black.

## `bright-pass`
- **Task:** Give the HDR framebuffer a second floating-point colour attachment and let both scene shaders write two outputs: the colour as before, and – only where the colour's brightness is above 1.0 – the same colour into the second one (black elsewhere). For now show the second colour buffer in the window.
- **Hint:** learnopengl's loop: `unsigned int colorBuffers[2]; glGenTextures(2, colorBuffers);` and in `for (unsigned int i = 0; i < 2; i++)` the same texture setup as before, attached with `GL_COLOR_ATTACHMENT0 + i`. Then `unsigned int attachments[2] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1 }; glDrawBuffers(2, attachments);` – without it OpenGL draws only into attachment 0. In both fragment shaders: `layout (location = 0) out vec4 FragColor; layout (location = 1) out vec4 BrightColor;` and `float brightness = dot(result, vec3(0.2126, 0.7152, 0.0722)); if(brightness > 1.0) BrightColor = vec4(result, 1.0); else BrightColor = vec4(0.0, 0.0, 0.0, 1.0);`. The final pass binds `colorBuffers[1]`.
- **When done:** `main.cpp`: `unsigned int colorBuffers[2];`, `glGenTextures(2, colorBuffers);`, the `for` loop with
  `glBindTexture(GL_TEXTURE_2D, colorBuffers[i])`, `GL_RGBA16F`, `GL_LINEAR`, `GL_CLAMP_TO_EDGE` and
  `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0 + i, GL_TEXTURE_2D, colorBuffers[i], 0)`;
  `unsigned int attachments[2] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1 };` + `glDrawBuffers(2, attachments);`;
  in pass 3 `glBindTexture(GL_TEXTURE_2D, colorBuffers[1]);`; cleanup `glDeleteTextures(2, colorBuffers);`.
  `bloom.fs` and `light_box.fs`: `layout (location = 0) out vec4 FragColor;`, `layout (location = 1) out vec4
  BrightColor;` and learnopengl's brightness test (`dot(…, vec3(0.2126, 0.7152, 0.0722))`, `> 1.0`). The window shows
  **only the bright parts**, tone-mapped, on black (23,678 non-black pixels): the light cubes (white-light =
  254,254,254, green-light = 0,254,0), the steel frame right above the white light (box-frame = 208,210,218), the
  brightest stripe along the big box's top edge (a narrow white-blue band from about (200,180) to (420,370) with
  a little orange wood below it), dots of the box frames' rivets near the lights; everything else black: box-top,
  box-right, floor-mid, floor-left, floor-right, background, glow-right, glow-below, glow-green, frame-green, rim =
  0,0,0, corner = 3,3,3. The floor's lit patch is not bright enough (its luminance stays below 1.0).

## `blur`
- **Task:** Blur the bright texture with learnopengl's two-pass Gaussian blur: two ping-pong framebuffers (each with one `GL_RGBA16F` colour texture), 10 passes that alternate horizontal and vertical, each reading the texture the previous pass wrote (the first reads the bright texture). Show the last blurred texture in the window.
- **Hint:** The ping-pong setup is learnopengl's loop over `pingpongFBO[i]` / `pingpongColorbuffers[i]` (no depth buffer). In the render loop: `bool horizontal = true, first_iteration = true; unsigned int amount = 10;` and for each pass `glBindFramebuffer(GL_FRAMEBUFFER, pingpongFBO[horizontal]); shaderBlur.setInt("horizontal", horizontal); glBindTexture(GL_TEXTURE_2D, first_iteration ? colorBuffers[1] : pingpongColorbuffers[!horizontal]); renderQuad(); horizontal = !horizontal;`. `blur.fs`: `vec2 tex_offset = 1.0 / textureSize(image, 0);`, the centre texel times `weight[0]`, then for `i` 1..4 the texels `± tex_offset.x * i` (horizontal) or `± tex_offset.y * i` (vertical) times `weight[i]`. The final pass binds `pingpongColorbuffers[!horizontal]`.
- **When done:** `main.cpp`: `Shader shaderBlur("blur.vs", "blur.fs");`, `shaderBlur.setInt("image", 0);`,
  learnopengl's `// ping-pong-framebuffer for blurring` block (`pingpongFBO[2]`, `pingpongColorbuffers[2]`,
  `glGenFramebuffers(2, pingpongFBO)`, `glGenTextures(2, pingpongColorbuffers)`, the loop with `GL_RGBA16F`,
  `GL_LINEAR`, `GL_CLAMP_TO_EDGE`, `GL_COLOR_ATTACHMENT0`, `glCheckFramebufferStatus`), the `// 2.` blur loop (`amount =
  10`, `pingpongFBO[horizontal]`, `setInt("horizontal", horizontal)`, `first_iteration ? colorBuffers[1] :
  pingpongColorbuffers[!horizontal]`, `renderQuad()`, `horizontal = !horizontal`), pass 3 binds
  `pingpongColorbuffers[!horizontal]`; cleanup deletes the ping-pong textures and framebuffers. `blur.fs`: learnopengl's
  `main` (`tex_offset`, the two `for` loops). The window shows the **blurred bright parts** (60,529 non-black pixels,
  only 8 pure white): soft blobs around the light cubes and a soft white band along the big box's edge:
  white-light = 254,254,254 (its middle stays saturated), green-light = 0,254,0, glow-green = 0,176,0, glow-right =
  49,49,49, glow-below = 33,33,33, corner = 128,129,140, rim = 148,148,148, frame-green = 0,148,0, box-frame =
  228,229,233; still black far from the lights: box-top, box-right, floor-mid, floor-left, floor-right, background =
  0,0,0.

## `combine`
- **Task:** Add the blurred bright texture to the scene in the final pass before the tone mapping: bind the scene (`colorBuffers[0]`) to unit 0 and the blurred texture to unit 1 (sampler `bloomBlur`), and in `bloom_final.fs` add the two colours.
- **Hint:** `shaderBloomFinal.setInt("bloomBlur", 1);` once; in pass 3: `glActiveTexture(GL_TEXTURE0); glBindTexture(GL_TEXTURE_2D, colorBuffers[0]); glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D, pingpongColorbuffers[!horizontal]);`. `bloom_final.fs`: `uniform sampler2D bloomBlur;`, `vec3 bloomColor = texture(bloomBlur, TexCoords).rgb; hdrColor += bloomColor; // additive blending` before the tone mapping.
- **When done:** `main.cpp`: `shaderBloomFinal.setInt("bloomBlur", 1);`; pass 3 binds `colorBuffers[0]` on unit 0 and
  `pingpongColorbuffers[!horizontal]` on unit 1 (`glActiveTexture(GL_TEXTURE1)`). `bloom_final.fs`: `uniform sampler2D
  bloomBlur;`, `vec3 bloomColor = texture(bloomBlur, TexCoords).rgb;`, `hdrColor += bloomColor;` – learnopengl's
  bloom_final.fs without the `bloom` toggle. The scene is back with **the light cubes glowing**: a soft halo spreads
  over the black background and the boxes next to them: glow-right = 49,49,49, glow-below = 33,33,33, glow-green =
  0,176,0, corner = 128,129,140 (start 3,3,3), rim = 152,151,158 (start 43,38,72), frame-green = 149,190,162 (start
  149,150,162: green light on the frame), box-frame = 246,246,249 (start 208,210,218); white-light = 255,255,255,
  green-light = 0,255,0; the big box's bright top edge glows too. Unchanged away from the bright parts: box-top =
  164,116,70, box-right = 171,122,67, floor-mid = 172,134,93, floor-left = 85,59,48, floor-right = 123,91,70,
  background = 0,0,0. 28,530 pixels differ from the start by more than 2 (14,778 get brighter by more than 20), all
  around the light cubes and the big box's edge. This is the solution.
