# Postprocessing (Hedgerow) – tasks (OpenGL)

**Screenshot time: t = 1.45 s (frame 87)** – the frame verify.sh holds with `VERIFY_T=1.45` (the simulator runs the
loop 88 times). The ball hits the solid stone (5, 9) in frame 86 (see `collision-resolution`), which starts the shake
(ShakeTime 0.05 s): it is on in frames 86 and 87 and off from frame 88 (ShakeTime 0.05 − 3 × 1/60 ≤ 0). The `confuse`
and `chaos` tasks switch their effect on in Init (as a try-out line), so they show at any time; `shake` removes that
line again. All APIs use this time and these points.

learnopengl "2D Game / Postprocessing": `post_processor.h/.cpp`, `post_processing.vs/.frag`, the PostProcessor parts of
`progress/7.game.cpp` (Effects, ShakeTime). Files: `main.cpp` (= `particles`' solution with TODOs), **`post_processing.vs`,
`post_processing.fs`** (new; their start bodies pass the quad and the texture through and compile), the other shaders,
`textures/`, `levels/` (unchanged). See `../game-setup/tasks.md` for the fixed choices of the whole game.

**Fixed choices (all APIs):**
- learnopengl's PostProcessor as a plain struct: `struct PostProcessor { Shader PostProcessingShader; Texture2D Texture;
  unsigned int Width = 0, Height = 0; bool Confuse = false, Chaos = false, Shake = false; unsigned int MSFBO = 0,
  FBO = 0, RBO = 0, VAO = 0; };`, the global `PostProcessor Effects;` and `float ShakeTime = 0.0f;`. Its constructor
  is `void InitPostProcessor(PostProcessor& effects, Shader shader, unsigned int width, unsigned int height)`, called in
  Init after the particles: `InitPostProcessor(Effects, GetShader("postprocessing"), game.Width, game.Height);`. Its
  private `initRenderData` is the overload `void InitRenderData(PostProcessor&)` (the sprite renderer's is
  `InitRenderData(SpriteRenderer&)`); its member functions are `void BeginRender(PostProcessor&)`, `void
  EndRender(PostProcessor&)` and `void Render(PostProcessor& effects, float time)` (an overload of the game's
  `Render(Game&)`).
- InitPostProcessor as learnopengl: a multisampled framebuffer `MSFBO` with a **4-sample GL_RGB renderbuffer**
  (`glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_RGB, width, height)`, no depth), a framebuffer `FBO` with
  the texture `Texture` (Texture2D defaults: GL_RGB, **GL_REPEAT**, GL_LINEAR; `glGenTextures` then `Generate(…,
  NULL)` – learnopengl's Texture2D constructor generates the ID), both checked with glCheckFramebufferStatus; the
  screen quad (NDC −1…1, texcoords 0…1); the uniforms set once: `scene` = 0, `offsets[9]` (± 1/300, set with
  `glUniform2fv(…, 9, (float*)offsets)` from a `float offsets[9][2]`), `edge_kernel[9]` (int, glUniform1iv: −1 around 8),
  `blur_kernel[9]` (float, glUniform1fv: 1 2 1 / 2 4 2 / 1 2 1, divided by 16).
- `Render(Game&)`: `BeginRender(Effects)` (bind MSFBO, clear black) before the background, `EndRender(Effects)` after
  the ball (glBlitFramebuffer MSFBO → FBO, GL_COLOR_BUFFER_BIT, GL_NEAREST: the resolve; then the default
  framebuffer), then `Render(Effects, glfwGetTime())` (the shader's `time`, `confuse`, `chaos`, `shake` as
  ints, the texture on unit 0, the quad).
- The post shader is learnopengl's: vertex shader – chaos: `TexCoords = texture + (sin(time), cos(time)) × 0.3`;
  confuse: `1.0 - texture` (upside down and mirrored); shake: `gl_Position.x += cos(time * 10) * 0.01`,
  `gl_Position.y += cos(time * 15) * 0.01`; fragment shader – chaos: the edge kernel over the 9 samples; confuse:
  `1.0 - colour`; shake: the blur kernel; else the texture. (Written with `10.0`, `15.0` and `0.0` literals instead of
  learnopengl's `10` and `0.0f`; the array keeps learnopengl's name `sample` – a keyword only from GLSL 4.00 on.) The
  shader's time is the game's time, frame / 60: at 1.45 s the chaos offset is (0.2978, 0.0362) and the shake moves the
  picture by (−1.42, −2.91) pixels (x left; y: NDC up is negative here, i.e. 2.9 px down).
- The shake (in DoCollisions, when the ball hits a **solid** block: `else { ShakeTime = 0.05f; Effects.Shake = true; }`
  after `if (!box.IsSolid) box.Destroyed = true;`) and its countdown in Update after the particles: `if (ShakeTime >
  0.0f) { ShakeTime -= dt; if (ShakeTime <= 0.0f) Effects.Shake = false; }` – learnopengl's.
- Vulkan / DirectX 12 have no glBlitFramebuffer: a 4-sample colour target resolved into a sampled image (Vulkan: a
  resolve attachment in the off-screen pass; DirectX 12: ResolveSubresource) – their tasks.md explain.

Named points (from the top-left, 800×600, frame 87, Mesa/llvmpipe): **orange** (396,29), **blue** (396,141), **sky**
(200,250), **mid** (400,300), **hills** (400,450), **paddle** (358,588) – the paddle's left brass end; **top-paddle**
(442,12) – where the confused picture shows the paddle (the mirror point of (358,588)); **beside-paddle** (300,590);
**stone** (13,209); **ball** (496,243) – the ball's centre in frame 87 (Position (484.17, 230.83), just bounced off the
stone); **edge-row** (100,37) – pixel row 37, which the brick edge at y = 37.5 crosses at the pixel centres.

**Start picture** (= `particles`' end at 1.45 s): orange = 196,98,0, blue = 39,118,196, sky = 53,44,75, mid = 63,50,80,
hills = 46,52,74, paddle = 214,170,72, top-paddle = 242,121,0, beside-paddle = 30,40,46, stone = 126,126,110, ball =
194,230,181, edge-row = 146,73,0.

## `post-shader`
- **Task:** Write the post-processing shader – vertex shader: chaos swirls the texture coordinates with time, confuse mirrors them, shake wobbles the position; fragment shader: chaos = edge detection, confuse = inverted colours, shake = blur, all over 9 samples at `offsets` – add `SetFloat` and load the shader as `"postprocessing"`.
- **Hint:** learnopengl's post_processing.vs / .frag. `if (chaos || shake) for (int i = 0; i < 9; i++) sample[i] = vec3(texture(scene, TexCoords.st + offsets[i]));` then `color += vec4(sample[i] * edge_kernel[i], 0.0)` (or `blur_kernel`). `LoadShader("post_processing.vs", "post_processing.fs", nullptr, "postprocessing");`
- **When done:** the two shader bodies as described above; `void SetFloat(Shader& shader, const char* name, float
  value, bool useShader = false)` (glUniform1f) before SetInteger; the LoadShader call after the particle shader's.
  Nothing uses the shader yet: **no visible change** (start picture).

## `post-processor`
- **Task:** Add learnopengl's PostProcessor as a struct, with `InitRenderData` (the screen quad) and `InitPostProcessor` (a multisampled framebuffer with a 4-sample renderbuffer, a second framebuffer with a texture, the quad and the shader's kernels); make the global `Effects` in Init; delete its objects at the end.
- **Hint:** `glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_RGB, width, height);` and `glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, effects.RBO);`; for FBO: `glGenTextures(1, &effects.Texture.ID); Generate(effects.Texture, width, height, NULL);` and `glFramebufferTexture2D(…)`. `glUniform2fv(glGetUniformLocation(…, "offsets"), 9, (float*)offsets);`
- **When done:** `struct PostProcessor` (above), `void InitRenderData(PostProcessor& effects)`, `void
  InitPostProcessor(PostProcessor& effects, Shader shader, unsigned int width, unsigned int height)` (learnopengl's
  constructor: the framebuffers, both completeness checks with learnopengl's messages, the quad, `SetInteger(…,
  "scene", 0, true)`, offsets / edge_kernel / blur_kernel), `PostProcessor  Effects;`, the InitPostProcessor call in
  Init after InitParticles, and in main after the loop glDeleteVertexArrays / glDeleteFramebuffers ×2 /
  glDeleteRenderbuffers / glDeleteTextures for Effects. The game still draws to the window: **no visible change**.

## `render-to-texture`
- **Task:** Write `BeginRender` (draw into the multisampled framebuffer, cleared black), `EndRender` (resolve it into the texture framebuffer with a blit) and `Render` (the quad with the post shader and its options); in the game's `Render` wrap the drawing in BeginRender / EndRender and then draw the quad with the time.
- **Hint:** `glBindFramebuffer(GL_READ_FRAMEBUFFER, effects.MSFBO); glBindFramebuffer(GL_DRAW_FRAMEBUFFER, effects.FBO); glBlitFramebuffer(0, 0, effects.Width, effects.Height, 0, 0, effects.Width, effects.Height, GL_COLOR_BUFFER_BIT, GL_NEAREST);` then `glBindFramebuffer(GL_FRAMEBUFFER, 0);`. In Render(Game&): `BeginRender(Effects);` … `EndRender(Effects); Render(Effects, glfwGetTime());`.
- **When done:** the three functions (above); `BeginRender(Effects);` before the background, `EndRender(Effects);` and
  `Render(Effects, glfwGetTime());` after the ball, inside `if (game.State == GAME_ACTIVE)`. The game now goes through
  the 4× multisampled target and the quad – **almost no visible change**: only edges are antialiased (1927 pixels
  differ by more than 12, at the sprites' rims and on pixel rows 37, 112 and 187, which brick edges cross exactly at
  the pixel centres: they are now half one brick, half the other – edge-row = 132,95,29 instead of 146,73,0);
  every named point else as the start picture. One draw more than before (the quad, after the sprites and the ≈ 120 living particles).

## `confuse`
- **Task:** Try the first effect: switch `Confuse` on in Init, after the postprocessor is set up.
- **Hint:** `Effects.Confuse = true;`
- **When done:** `Effects.Confuse = true; // try the effects: …` right after the InitPostProcessor call. **The whole
  picture is upside down and mirrored, its colours inverted** (light sky at the bottom, the bricks at the bottom, the
  paddle at the top): orange = 225,215,209, blue = 209,203,181, sky = 180,199,170, mid = 192,205,175, hills =
  229,176,123, paddle = 23,139,255, top-paddle = 41,85,183 (the inverted paddle), beside-paddle = 27,141,255, stone =
  170,193,165, ball = 179,198,169, edge-row = 225,215,209.

## `chaos`
- **Task:** Replace the confuse line with the chaos effect.
- **Hint:** `Effects.Chaos = true;` (chaos wins over confuse in the shader anyway, but try one at a time).
- **When done:** `Effects.Chaos = true; // try the effects: …` instead of the confuse line. **Edge detection on a
  picture shifted by (sin(time), cos(time)) × 0.3** (the texture repeats, GL_REPEAT): black wherever the picture is flat,
  thin bright lines along the bricks' and sprites' edges, the sky's stars as dots: orange = 5,5,0, blue = 7,13,13, sky
  = 0,0,0, mid = 0,0,0, hills = 0,0,0, paddle = 0,0,0, top-paddle = 0,0,0, beside-paddle = 0,0,0, stone = 0,0,0, ball =
  55,55,45, edge-row = 0,0,0. The picture moves with time.

## `shake`
- **Task:** Remove the try-out line again; instead shake the screen when the ball hits a solid block: set `ShakeTime` to 0.05 seconds and `Effects.Shake`, and in `Update` count ShakeTime down and stop the shake when it is over.
- **Hint:** In DoCollisions: `if (!box.IsSolid) box.Destroyed = true; else { ShakeTime = 0.05f; Effects.Shake = true; }`. In Update after the particles: `if (ShakeTime > 0.0f) { ShakeTime -= dt; if (ShakeTime <= 0.0f) Effects.Shake = false; }`. `float ShakeTime = 0.0f;` with the globals.
- **When done:** no `Effects.Chaos`/`Confuse` line in Init; `float ShakeTime = 0.0f;` after `PostProcessor Effects;`;
  the else branch in DoCollisions; the countdown in Update after the particles' Update. The ball hits the stone in
  frame 86: **in frame 87 the picture is blurred and moved by about (−1.4, +2.9) pixels**: paddle = 181,141,61,
  top-paddle = 231,116,0, ball = 195,231,182, stone = 122,122,106, edge-row = 173,87,1 (the blurred, shifted edges);
  flat areas almost unchanged: orange = 198,99,0, blue = 39,119,197, sky = 52,44,75, mid = 63,50,80, hills = 46,52,74,
  beside-paddle = 30,40,46. (From frame 88 on the picture equals `render-to-texture`'s again.)
