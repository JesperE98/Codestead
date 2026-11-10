# Rendering Sprites (Hedgerow) – tasks (OpenGL)

learnopengl "2D Game / Rendering Sprites": `progress/3.game.cpp` and `sprite_renderer.h/.cpp`, `sprite.vs/.fs` of
`0.full_source`. Files: `main.cpp` (= `game-setup`'s solution with TODOs for the sprite renderer), `sprite.vs`,
`sprite.fs` (their `main` is a TODO), `textures/ball.png` (the course's ball: 128×128 RGBA, a pale ball on a transparent
background). See `../game-setup/tasks.md` for the fixed choices of the whole game.

**Fixed choices (all APIs):**
- learnopengl draws `awesomeface.png` at (200, 200), size (300, 400), rotated 45°, colour (0, 1, 0); the course draws
  **`textures/ball.png`** (loaded with alpha as `"ball"`) with exactly those numbers:
  `DrawSprite(Renderer, GetTexture("ball").ID, glm::vec2(200.0f, 200.0f), glm::vec2(300.0f, 400.0f), 45.0f,
  glm::vec3(0.0f, 1.0f, 0.0f));`.
- SpriteRenderer as a struct: `struct SpriteRenderer { Shader shader; unsigned int quadVAO = 0; };`, the global
  `SpriteRenderer Renderer;` (learnopengl: `SpriteRenderer *Renderer`), `void InitRenderData(SpriteRenderer&)`
  (learnopengl's constructor calls initRenderData), `void DrawSprite(SpriteRenderer& renderer, unsigned int texture,
  glm::vec2 position, glm::vec2 size = glm::vec2(10.0f, 10.0f), float rotate = 0.0f, glm::vec3 color =
  glm::vec3(1.0f))` – the texture is passed as its ID (`GameObject::Sprite` is an `unsigned int` in the course, see
  `levels`); the VAO is deleted before `glfwTerminate()` (learnopengl deletes it in Game's destructor).
- learnopengl's quad: 6 vertices of vec4 (xy position 0..1, zw texcoords), (0, 0) = the sprite's top-left; model =
  translate(position) · translate(0.5·size) · rotate(rotate°, z) · translate(-0.5·size) · scale(size); the sprite
  shader `color = vec4(spriteColor, 1.0) * texture(image, TexCoords)` (the sampler is named `image`, as learnopengl
  sets it – learnopengl's own shader calls it `sprite` and only works because unit 0 is the default). Blending
  SRC_ALPHA / ONE_MINUS_SRC_ALPHA (set in `game-setup`) makes the transparent corners invisible.
- A positive angle turns the sprite **clockwise on screen** (the y-down projection mirrors the usual counter-clockwise
  rotation) – as in learnopengl's picture.

Named points (from the top-left, 800×600; static picture): **centre** (350,400) – the sprite's centre; **top**
(350,215) and **bottom** (350,585) – inside the unrotated ball near its top and bottom; **left** (210,400), **right**
(490,400); **upper-right** (470,280) and **lower-left** (230,520) – inside the ball only once it is rotated;
**background** (100,100). Measured with Mesa (llvmpipe). The ball is green only: its colours × (0, 1, 0).

**Start picture:** black everywhere (0,0,0). Nothing printed.

## `sprite-shader`
- **Task:** Write the sprite shaders – the vertex shader passes `vertex.zw` on as `TexCoords` and transforms `vertex.xy` with `projection * model`; the fragment shader multiplies the texture by `spriteColor` – and in `Init` load them as `"sprite"` and configure them: sampler `image` on unit 0 and the orthographic projection.
- **Hint:** `LoadShader("sprite.vs", "sprite.fs", nullptr, "sprite");`, `glm::ortho(0.0f, static_cast<float>(game.Width), static_cast<float>(game.Height), 0.0f, -1.0f, 1.0f)`, then `Use(GetShader("sprite"))`, `SetInteger(…, "image", 0)`, `SetMatrix4(…, "projection", projection)`.
- **When done:** `sprite.vs`: `TexCoords = vertex.zw; gl_Position = projection * model * vec4(vertex.xy, 0.0, 1.0);`;
  `sprite.fs`: `color = vec4(spriteColor, 1.0) * texture(image, TexCoords);`; in `Init`: `LoadShader("sprite.vs",
  "sprite.fs", nullptr, "sprite");`, `glm::mat4 projection = glm::ortho(0.0f, static_cast<float>(game.Width),
  static_cast<float>(game.Height), 0.0f, -1.0f, 1.0f);`, `Use(GetShader("sprite"));`,
  `SetInteger(GetShader("sprite"), "image", 0);`, `SetMatrix4(GetShader("sprite"), "projection", projection);`.
  No visible change (black).

## `sprite-renderer`
- **Task:** Add the `SpriteRenderer` struct (its shader and the quad's VAO) with `InitRenderData`, which creates the quad (learnopengl's 6 vertices: position xy and texcoords zw in one vec4 attribute), a global `SpriteRenderer Renderer`, set it up in `Init` and delete its VAO at the end of `main`.
- **Hint:** `glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0)`. In `Init`: `Renderer.shader = GetShader("sprite"); InitRenderData(Renderer);`.
- **When done:** `struct SpriteRenderer { Shader shader; unsigned int quadVAO = 0; };`, `void
  InitRenderData(SpriteRenderer& renderer)` (learnopengl's `vertices[]`, `glGenVertexArrays(1, &renderer.quadVAO)`, the
  VBO, attribute 0 with 4 floats), `SpriteRenderer Renderer;` after `Game Hedgerow;`, in `Init` the two lines after the
  shader configuration, `glDeleteVertexArrays(1, &Renderer.quadVAO);` after `ClearResources();`. No visible change.

## `draw-sprite`
- **Task:** Write `DrawSprite` – the model matrix (translate to `position`, scale to `size`; the rotation follows in the next task), the `model` and `spriteColor` uniforms, the texture on unit 0, the quad drawn –, load `textures/ball.png` with alpha as `"ball"` in `Init` and draw it in `Render` at (200, 200), size (300, 400), 45°, green.
- **Hint:** The order of the transformations is reversed: translate first in code, scale last. `glActiveTexture(GL_TEXTURE0); glBindTexture(GL_TEXTURE_2D, texture);`, then `glDrawArrays(GL_TRIANGLES, 0, 6)` with `renderer.quadVAO`.
- **When done:** `void DrawSprite(SpriteRenderer& renderer, unsigned int texture, glm::vec2 position, glm::vec2 size =
  glm::vec2(10.0f, 10.0f), float rotate = 0.0f, glm::vec3 color = glm::vec3(1.0f))` with `Use(renderer.shader)`,
  `model = glm::translate(model, glm::vec3(position, 0.0f))`, a TODO for the rotation, `model = glm::scale(model,
  glm::vec3(size, 1.0f))`, `SetMatrix4(renderer.shader, "model", model)`, `SetVector3f(renderer.shader, "spriteColor",
  color)`, the texture bound to unit 0, `glBindVertexArray(renderer.quadVAO)`, `glDrawArrays(GL_TRIANGLES, 0, 6)`;
  `LoadTexture("textures/ball.png", true, "ball");` in `Init`; the `DrawSprite(Renderer, GetTexture("ball").ID, …)`
  call in `Render`. **The green ball appears, stretched to an upright ellipse** (not rotated yet: the angle is not used)
  filling x 201..498, y 202..597: centre = 0,230,0, top = 0,223,0, bottom = 0,200,0, left = 0,223,0, right = 0,200,0;
  upper-right ≈ 0,2,0 (the ellipse's edge), lower-left = 0,0,0, background 0,0,0. The ball's transparent corners
  stay black (blending). One draw.

## `rotate`
- **Task:** Rotate the sprite by `rotate` degrees about its centre: move the origin to the quad's centre, rotate about z, move it back – between the translation and the scale.
- **Hint:** `glm::translate(model, glm::vec3(0.5f * size.x, 0.5f * size.y, 0.0f))`, `glm::rotate(model, glm::radians(rotate), glm::vec3(0.0f, 0.0f, 1.0f))`, `glm::translate(model, glm::vec3(-0.5f * size.x, -0.5f * size.y, 0.0f))`.
- **When done:** those three lines in `DrawSprite` instead of the TODO. **The ellipse is turned 45° clockwise about
  (350, 400)** – its long axis runs from the lower-left to the upper-right, filling x 172..527, y 222..577: centre =
  0,230,0, upper-right = 0,232,0, lower-left = 0,212,0, left = 0,232,0, right = 0,226,0; top = 0,0,0 and bottom =
  0,0,0 (now outside); background 0,0,0.
