# Particles (Hedgerow) – tasks (OpenGL)

**Screenshot time: t = 2.0 s (frame 120)** – every picture below is frame 120 of the render loop (glfwGetTime() =
120/60; verify.sh `VERIFY_T=2.0`, which **holds** frame 120: from frame 121 on, glfwPollEvents() never returns, so no
frame with deltaTime 0 runs after it – the particles respawn every frame, whatever deltaTime is; the simulator runs
the loop 121 times). At 2.0 s the ball comes down after its bounce off the stone (5, 9) (see `collision-resolution`)
with a trail of fading particles behind it. All APIs use this time and these points.

learnopengl "2D Game / Particles": `particle_generator.h/.cpp`, `particle.vs` / `particle.frag` and the particle
parts of `progress/6.game.cpp`. Files: `main.cpp` (= `collision-resolution`'s solution with TODOs), `sprite.vs`,
`sprite.fs`, **`particle.vs`, `particle.fs`** (new, with TODO bodies that compile: the start draws nothing with them),
`textures/` (+ **`particle.png`**, 64² RGBA, a soft white glow), `levels/`. See `../game-setup/tasks.md` for the fixed
choices of the whole game.

**Fixed choices (all APIs):**
- learnopengl's ParticleGenerator as plain structs and free functions: `struct Particle { glm::vec2 Position =
  (0, 0), Velocity = (0, 0); glm::vec4 Color = (1, 1, 1, 1); float Life = 0; };` (learnopengl's constructor values),
  `struct ParticleGenerator { std::vector<Particle> particles; unsigned int amount = 0; Shader shader; unsigned int
  texture = 0; unsigned int VAO = 0; };` (the texture as its ID, like GameObject's Sprite), the global
  `ParticleGenerator Particles;`. learnopengl's constructor becomes, in `Init` after the textures are loaded:
  `Particles.shader = GetShader("particle"); Particles.texture = GetTexture("particle").ID; Particles.amount = 500;
  InitParticles(Particles);` – `void InitParticles(ParticleGenerator&)` is learnopengl's private `init()` (the quad's
  VAO/VBO – the sprite quad's 6 vertices – and `amount` default particles pushed into the vector), the same pattern as
  the SpriteRenderer's `InitRenderData`.
- `unsigned int lastUsedParticle = 0;` (a global, as learnopengl's), `unsigned int firstUnusedParticle(ParticleGenerator&)`,
  `void respawnParticle(Particle& particle, GameObject& object, glm::vec2 offset = glm::vec2(0.0f, 0.0f))` with
  learnopengl's expressions `float random = ((rand() % 100) - 50) / 10.0f; float rColor = 0.5f + ((rand() % 100) /
  100.0f);` (in that order: two rand() calls per particle; Position = object.Position + random + offset – the same
  random number added to x and y –, Color (rColor, rColor, rColor, 1), Life 1, Velocity = object.Velocity × 0.1), and
  `void Update(ParticleGenerator& generator, float dt, GameObject& object, unsigned int newParticles, glm::vec2 offset
  = glm::vec2(0.0f, 0.0f))` – an **overload** of the game's `Update(Game&, float)` (learnopengl's names; C++ picks by
  the arguments). It spawns `newParticles`, then loops over all `amount` particles by index (`Particle& p =
  generator.particles[i];`): `p.Life -= dt;` and, if still alive, `p.Position -= p.Velocity * dt; p.Color.a -= dt *
  2.5f;`. Called in the game's `Update` after `DoCollisions(game);` (learnopengl's place, before the loss check):
  `Update(Particles, dt, Ball, 2, glm::vec2(Ball.Radius / 2.0f));` – the ball passed as its GameObject part.
- `void DrawParticles(ParticleGenerator&)` (learnopengl's `Draw`; the course's draw functions are DrawSprite /
  DrawObject / DrawLevel): `glBlendFunc(GL_SRC_ALPHA, GL_ONE)` (additive), `Use(generator.shader)`, `for (Particle
  particle : generator.particles)` (a copy, as learnopengl), for each with `Life > 0.0f`: `SetVector2f(…, "offset",
  particle.Position)`, `SetVector4f(…, "color", particle.Color)`, `glBindTexture(GL_TEXTURE_2D, generator.texture)`
  (learnopengl's `texture.Bind()`), the VAO, `glDrawArrays(GL_TRIANGLES, 0, 6)` – **one draw per living particle** –,
  then `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)` again. Drawn in `Render` **after the paddle, before the
  ball**.
- The Shader section gains `SetVector2f` (glUniform2f) and `SetVector4f` (glUniform4f), like SetVector3f.
- The particle shader is learnopengl's: `particle.vs` – `float scale = 10.0; TexCoords = vertex.zw; ParticleColor =
  color; gl_Position = projection * vec4((vertex.xy * scale) + offset, 0.0, 1.0);` (a 10 × 10 pixel quad, its top-left
  corner at `offset`; learnopengl writes `10.0f`); `particle.fs` – `color = (texture(sprite, TexCoords) *
  ParticleColor);` with `uniform sampler2D sprite;` on unit 0. Loaded as `"particle"` from `particle.vs` /
  `particle.fs` (flat, like sprite.vs/fs), configured with the sprite's projection.
- **rand()**: glibc's sequence, seed 1 (no srand – learnopengl seeds nothing either). OpenGL and Vulkan on Linux and
  the simulator get the same numbers. (DirectX 12 on Windows gets MSVC's rand(), so its particles land a little
  differently: its tasks.md says so.)
- Colours above 1: rColor goes up to 1.49 and `Color.a` goes below 0 before Life ends (a particle lives 60 frames,
  but its alpha reaches 0 after 24): the fragment colour is clamped to 0…1 before blending into the 8-bit window, so a
  particle with negative alpha adds nothing (it is still drawn) and a colour > 1 counts as 1.

**What the particles do** (measured: the real program counting particles every frame, Mesa): 2 spawn per frame from
frame 0 on, at the ball's position + 6.25 (half the radius) + random −5…+4.9 (the 10 × 10 quad sits on the ball's
upper left part, so fresh particles are hidden under the ball, which is drawn after them). While the ball is stuck
(frames 0–29) its Velocity is already (100, −350), so the particles drift (−10, +35) px/s (they move by
−Velocity × 0.1). Once ~60 frames have passed, about 120 particles are alive (118–122: Life is a float counted down by
deltaTime, so a particle dies after 60 or 61 frames), but only those of the last 24 frames are visible (alpha > 0):
**48 visible particles**, a trail of about 140 pixels behind the ball. **At 2.0 s** the ball is at (539.17, 423.33)
coming down to the right after its bounce in frame 86, the visible trail goes from its upper left back up to about
(510, 290) – particles spawned in frames 98…120, the oldest faintest. Draws at frame 120: 71 + the living particles
(≈ 118) ≈ 189.

Named points (from the top-left, 800×600, frame 120, Mesa/llvmpipe; chosen where several particles overlap, so a
5 × 5 neighbourhood is brighter too): **trail-near** (542,410) – the trail just above the ball (the newest visible
particles); **trail-mid** (530,366); **trail-far** (522,332) – older, fainter particles; **trail-side** (560,366) – beside
the trail (sky, never a particle); **ball** (551,435) – the ball's centre; **stone** (506,206); **on-paddle**
(400,567); **paddle** (358,588); **sky** (200,250); **blue** (396,141).

**Start picture** (= `collision-resolution`'s end at 2.0 s): trail-near = 90,65,92, trail-mid = 79,58,87, trail-far =
71,54,83, trail-side = 79,58,87 (the background), ball = 196,231,183, stone = 132,132,116, on-paddle = 30,40,46, paddle =
214,170,72, sky = 53,44,75, blue = 39,118,196. 71 draws.

## `particle-shader`
- **Task:** Write the particle shader – a 10 × 10 pixel quad at `offset`, the particle texture times the particle's colour –, add the uniform setters `SetVector2f` and `SetVector4f`, and in `Init` load the shader as `"particle"` (sampler `sprite` on unit 0, the same projection) and `textures/particle.png` (with alpha) as `"particle"`.
- **Hint:** particle.vs: `gl_Position = projection * vec4((vertex.xy * scale) + offset, 0.0, 1.0);` with `float scale = 10.0;`, and pass `vertex.zw` and `color` on; particle.fs: `color = (texture(sprite, TexCoords) * ParticleColor);`. `LoadShader("particle.vs", "particle.fs", nullptr, "particle");`, `SetInteger(GetShader("particle"), "sprite", 0);`, `SetMatrix4(GetShader("particle"), "projection", projection);`.
- **When done:** particle.vs / particle.fs with learnopengl's bodies (above); `void SetVector2f(Shader& shader, const
  char* name, const glm::vec2& value, bool useShader = false)` (glUniform2f) and `void SetVector4f(…, const glm::vec4&
  value, …)` (glUniform4f) after SetVector3f; in `Init` the LoadShader call after the sprite's, `Use(GetShader("particle"));`
  + the two setters after the sprite's configuration, `LoadTexture("textures/particle.png", true, "particle");` after the
  paddle's. Nothing draws with them: **no visible change** (start picture).

## `particle-generator`
- **Task:** Add `struct Particle` and `struct ParticleGenerator` and `InitParticles` (the quad's VAO and `amount` default particles); make the global `Particles` in `Init`: 500 particles with the particle shader and texture. Delete its VAO at the end.
- **Hint:** The quad is the sprite quad (6 vertices, `vec2 position, vec2 texCoords`, attribute 0 with 4 floats). `for (unsigned int i = 0; i < generator.amount; ++i) generator.particles.push_back(Particle());`. In Init: `Particles.shader = …; Particles.texture = GetTexture("particle").ID; Particles.amount = 500; InitParticles(Particles);`.
- **When done:** the two structs (above) and `void InitParticles(ParticleGenerator& generator)` (learnopengl's
  `init()`: `particle_quad[]`, glGenVertexArrays/glGenBuffers, glBufferData, glVertexAttribPointer(0, 4, …), the
  push_back loop) in a new section `// ParticleGenerator (learnopengl: particle_generator.h, particle_generator.cpp)`
  before the Game section; `ParticleGenerator Particles;` after `BallObject Ball;`; the four lines in Init after the
  textures; `glDeleteVertexArrays(1, &Particles.VAO);` after the renderer's. 500 dead particles (Life 0): **no visible
  change**.

## `spawn`
- **Task:** Bring the particles to life: `firstUnusedParticle` (the first dead particle, searching from the last one used), `respawnParticle` (a new particle at an object, with learnopengl's random offset and brightness) and `Update` for the generator (spawn new ones, then age, move and fade the living ones); call it in the game's `Update` with 2 new particles per frame at the ball, offset by half its radius.
- **Hint:** `float random = ((rand() % 100) - 50) / 10.0f;` and `float rColor = 0.5f + ((rand() % 100) / 100.0f);` (`#include <cstdlib>`). In Update: `p.Life -= dt; if (p.Life > 0.0f) { p.Position -= p.Velocity * dt; p.Color.a -= dt * 2.5f; }`. The call: `Update(Particles, dt, Ball, 2, glm::vec2(Ball.Radius / 2.0f));` after `DoCollisions(game);`.
- **When done:** `#include <cstdlib>`; `unsigned int lastUsedParticle = 0;`, `unsigned int
  firstUnusedParticle(ParticleGenerator& generator)` (learnopengl's two loops from lastUsedParticle and from 0, else
  `lastUsedParticle = 0; return 0;`), `void respawnParticle(Particle& particle, GameObject& object, glm::vec2 offset =
  …)`, `void Update(ParticleGenerator& generator, float dt, GameObject& object, unsigned int newParticles, glm::vec2
  offset = …)` (above); the call in the game's Update. The particles live but are not drawn yet: **no visible change**
  (start picture; still 71 draws).

## `draw-particles`
- **Task:** Write `DrawParticles`: with additive blending (`GL_SRC_ALPHA, GL_ONE`), draw every living particle with the particle shader – its `offset` and `color` uniforms, the particle texture, the quad –, then restore the normal blending; draw the particles in `Render` after the paddle, before the ball.
- **Hint:** `for (Particle particle : generator.particles) if (particle.Life > 0.0f) { SetVector2f(generator.shader, "offset", particle.Position); SetVector4f(generator.shader, "color", particle.Color); glBindTexture(…); glBindVertexArray(generator.VAO); glDrawArrays(GL_TRIANGLES, 0, 6); … }` – and `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);` at the end, or the next frame's sprites would be added up too.
- **When done:** `void DrawParticles(ParticleGenerator& generator)` (above) and `DrawParticles(Particles);` between
  `DrawObject(Player, Renderer);` and `DrawObject(Ball, Renderer);`. **A glowing trail appears behind the ball**
  (48 visible particles, ≈ 189 draws): trail-near = 255,255,255 (several bright particles added up – clamped to white),
  trail-mid = 225,204,233, trail-far = 174,157,186 (fainter: older particles have less alpha); trail-side =
  79,58,87, ball = 196,231,183 (the ball is drawn over the newest particles), stone = 132,132,116, on-paddle =
  30,40,46, paddle = 214,170,72, sky = 53,44,75, blue = 39,118,196 unchanged.
