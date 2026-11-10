# Particles (Hedgerow) – tasks (Vulkan)

**Screenshot time: t = 2.0 s (frame 120)** – as the OpenGL chapter (`../../opengl/particles/tasks.md`): every picture below is frame 120 of the render loop (glfwGetTime() =
120/60; verify.sh `VERIFY_T=2.0`, which **holds** frame 120: from frame 121 on, glfwPollEvents() never returns, so no
frame with deltaTime 0 runs after it – the particles respawn every frame, whatever deltaTime is; the simulator runs
the loop 121 times). At 2.0 s the ball comes down after its bounce off the stone (5, 9) (see `collision-resolution`)
with a trail of fading particles behind it.

learnopengl "2D Game / Particles": `particle_generator.h/.cpp`, `particle.vs` / `particle.frag` and the particle
parts of `progress/6.game.cpp`. Files: `main.cpp` (= `collision-resolution`'s solution with TODOs),
`shaders/sprite.vert`, `shaders/sprite.frag`, **`shaders/particle.vert`, `shaders/particle.frag`** (new, built to
`particle.vert.spv` / `particle.frag.spv`, with TODO bodies that compile: the start makes no pipeline from them),
`textures/` (+ **`particle.png`**, 64² RGBA, a soft white glow), `levels/`. See `../game-setup/tasks.md` for the fixed
choices of the whole game.

**Fixed choices (as OpenGL):**
- learnopengl's ParticleGenerator as plain structs and free functions: `struct Particle { glm::vec2 Position =
  (0, 0), Velocity = (0, 0); glm::vec4 Color = (1, 1, 1, 1); float Life = 0; };` (learnopengl's constructor values),
  `struct ParticleGenerator { std::vector<Particle> particles; unsigned int amount = 0; VkPipeline shader;
  VkDescriptorSet texture; VkPipelineLayout pipelineLayout; VkBuffer quadBuffer; VkDeviceMemory quadBufferMemory;
  VkCommandBuffer commandBuffer; };` (Vulkan: the "shader" is the particle pipeline, the texture its descriptor set
  like GameObject's Sprite, learnopengl's VAO the quad's vertex buffer; the pipeline layout and the command buffer
  being recorded as in the SpriteRenderer), the global `ParticleGenerator Particles;`. learnopengl's constructor
  becomes, in `Init` after the textures are loaded: `Particles.shader = GetShader("particle"); Particles.texture =
  GetTexture("particle").DescriptorSet; Particles.amount = 500; InitParticles(Particles);` – `void
  InitParticles(ParticleGenerator&)` is learnopengl's private `init()` (the quad's host-visible vertex buffer – the
  sprite quad's 6 vertices – and `amount` default particles pushed into the vector); it needs the device, so it is a
  member of the application class, like the SpriteRenderer's `InitRenderData`.
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
  DrawObject / DrawLevel): `vkCmdBindPipeline(…, generator.shader)` (the particle pipeline – additive blending is part
  of it), `for (Particle particle : generator.particles)` (a copy, as learnopengl), for each with `Life > 0.0f`: a
  `ParticleConstants` with `offset = particle.Position` and `color = particle.Color` pushed with `vkCmdPushConstants`
  (learnopengl's two uniforms), `vkCmdBindDescriptorSets(…, &generator.texture, …)` (learnopengl's `texture.Bind()`),
  `vkCmdBindVertexBuffers` with the quad, `vkCmdDraw(…, 6, 1, 0, 0)` – **one draw per living particle**, as
  learnopengl (instancing would draw them all at once – a real renderer would; the course keeps learnopengl's loop).
  No blend state to restore afterwards: the next `DrawSprite` binds the sprite pipeline again. Drawn in `Render`
  **after the paddle, before the ball**; `recordCommandBuffer` hands the command buffer to the generator
  (`Particles.commandBuffer = commandBuffer;`, next to the SpriteRenderer's).
- **Additive blending is pipeline state in Vulkan** (learnopengl switches it with `glBlendFunc` around the particle
  draws): `createPipeline` and `LoadShader` gain a parameter `VkBlendFactor dstColorBlendFactor`, assigned to
  `colorBlendAttachment.dstColorBlendFactor` (srcColorBlendFactor stays `VK_BLEND_FACTOR_SRC_ALPHA`): the sprite
  pipeline is made with `VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA` (alpha blending, as before), the particle pipeline with
  `VK_BLEND_FACTOR_ONE` (colour = src.rgb × src.a + dst.rgb – learnopengl's `GL_SRC_ALPHA, GL_ONE`). Both pipelines
  share the one pipeline layout (descriptor set layout: uniform buffer + texture; one push constant range for the
  vertex and fragment stages, `sizeof(PushConstants)` = 76 bytes, which also covers the particle's 32).
- The particle shader is learnopengl's: `shaders/particle.vert` – the uniform buffer's projection (binding 0, as the
  sprite shader's), a push constant block `ParticleConstants { vec2 offset; vec4 color; }`, `float scale = 10.0f;
  TexCoords = vertex.zw; ParticleColor = pc.color; gl_Position = ubo.projection * vec4((vertex.xy * scale) + pc.offset,
  0.0, 1.0);` (a 10 × 10 pixel quad, its top-left corner at `offset`); `shaders/particle.frag` – `color =
  (texture(sprite, TexCoords) * ParticleColor);` with `layout(binding = 1) uniform sampler2D sprite;`. The C++ side is
  `struct ParticleConstants { glm::vec2 offset; alignas(16) glm::vec4 color; };` – in a push constant block a vec4
  starts at a multiple of 16 bytes (offset 16, after the 8 bytes of `offset`), while C++ would put it at 8:
  `alignas(16)` makes the layouts agree (vulkan-tutorial's "Alignment requirements"). Loaded as `"particle"`.
- **rand()**: glibc's sequence, seed 1 (no srand – learnopengl seeds nothing either). OpenGL and Vulkan on Linux and
  the simulator get the same numbers (on Windows, MSVC's rand() gives other numbers: the particles would land a little
  differently there).
- Colours above 1: rColor goes up to 1.49 and `Color.a` goes below 0 before Life ends (a particle lives 60 frames,
  but its alpha reaches 0 after 24): the fragment colour is clamped to 0…1 before blending into the 8-bit window, so a
  particle with negative alpha adds nothing (it is still drawn) and a colour > 1 counts as 1. Vulkan specifies the
  same for a UNORM colour attachment (source values and blend factors are clamped to 0…1 before blending).

**What the particles do** (the same C++ and rand() as OpenGL, so the same particles): 2 spawn per frame from
frame 0 on, at the ball's position + 6.25 (half the radius) + random −5…+4.9 (the 10 × 10 quad sits on the ball's
upper left part, so fresh particles are hidden under the ball, which is drawn after them). While the ball is stuck
(frames 0–29) its Velocity is already (100, −350), so the particles drift (−10, +35) px/s (they move by
−Velocity × 0.1). Once ~60 frames have passed, about 120 particles are alive (118–122: Life is a float counted down by
deltaTime, so a particle dies after 60 or 61 frames), but only those of the last 24 frames are visible (alpha > 0):
**48 visible particles**, a trail of about 140 pixels behind the ball. **At 2.0 s** the ball is at (539.17, 423.33)
coming down to the right after its bounce in frame 86, the visible trail goes from its upper left back up to about
(510, 290) – particles spawned in frames 98…120, the oldest faintest. Draws at frame 120: 71 + the living particles
(≈ 118) ≈ 189.

Named points (OpenGL's; from the top-left, 800×600, frame 120, measured on lavapipe; chosen where several particles overlap, so a
5 × 5 neighbourhood is brighter too): **trail-near** (542,410) – the trail just above the ball (the newest visible
particles); **trail-mid** (530,366); **trail-far** (522,332) – older, fainter particles; **trail-side** (560,366) – beside
the trail (sky, never a particle); **ball** (551,435) – the ball's centre; **stone** (506,206); **on-paddle**
(400,567); **paddle** (358,588); **sky** (200,250); **blue** (396,141). **Every named point
equals OpenGL's in every state, the particles included**; the whole pictures differ only on the brick rows' edges
(pixel rows 37, 112, 187 – Vulkan's top-left rasterization rule, see `levels`).

**Start picture** (= `collision-resolution`'s end at 2.0 s): trail-near = 90,65,92, trail-mid = 79,58,87, trail-far =
71,54,83, trail-side = 79,58,87 (the background), ball = 196,231,183, stone = 132,132,116, on-paddle = 30,40,46, paddle =
214,170,72, sky = 53,44,75, blue = 39,118,196. 71 draws.

## particle-shader
- **Task:** Write the particle shader – a 10 × 10 pixel quad at `offset`, the particle texture times the particle's colour – and its push constant struct `ParticleConstants`; give `createPipeline` and `LoadShader` a blend factor parameter and load the particle shader as `"particle"` with additive blending; load `textures/particle.png` as `"particle"`.
- **Hint:** particle.vert: `gl_Position = ubo.projection * vec4((vertex.xy * scale) + pc.offset, 0.0, 1.0);` with `float scale = 10.0f;`, and pass `vertex.zw` and `pc.color` on; particle.frag: `color = (texture(sprite, TexCoords) * ParticleColor);`. `struct ParticleConstants { glm::vec2 offset; alignas(16) glm::vec4 color; };`. `colorBlendAttachment.dstColorBlendFactor = dstColorBlendFactor;` – the sprites pass `VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA`, the particles `VK_BLEND_FACTOR_ONE`.
- **When done:** particle.vert / particle.frag with learnopengl's bodies (above); `struct ParticleConstants` after
  `struct PushConstants`; `void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile,
  VkBlendFactor dstColorBlendFactor, VkPipeline& pipeline)` with `colorBlendAttachment.dstColorBlendFactor =
  dstColorBlendFactor;`; `VkPipeline LoadShader(const char* vShaderFile, const char* fShaderFile, std::string name,
  VkBlendFactor dstColorBlendFactor)` passing it on; in `Init`: `LoadShader("shaders/sprite.vert.spv",
  "shaders/sprite.frag.spv", "sprite", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA);`, `LoadShader("shaders/particle.vert.spv",
  "shaders/particle.frag.spv", "particle", VK_BLEND_FACTOR_ONE);` and `LoadTexture("textures/particle.png",
  "particle");` after the paddle's. Two pipelines, six textures; nothing draws with the new ones: **no visible change**
  (start picture).

## particle-generator
- **Task:** Add `struct Particle` and `struct ParticleGenerator` and the member function `InitParticles` (the quad's vertex buffer and `amount` default particles); set up the global `Particles` in `Init`: 500 particles with the particle pipeline and texture. Destroy its buffer in `cleanup()`.
- **Hint:** The quad is the sprite quad (6 vertices of `Vertex`, `vec4 <position, texCoords>`), in a host-visible buffer like `InitRenderData`'s. `for (unsigned int i = 0; i < generator.amount; ++i) generator.particles.push_back(Particle());`. In Init: `Particles.shader = GetShader("particle"); Particles.texture = GetTexture("particle").DescriptorSet; Particles.amount = 500; InitParticles(Particles);`.
- **When done:** the two structs (above) in a new section `// ParticleGenerator (learnopengl: particle_generator.h)`
  before the Game section; the member `void InitParticles(ParticleGenerator& generator)` after `InitRenderData`
  (`generator.pipelineLayout = pipelineLayout;`, `particle_quad`, `createBuffer` + `vkMapMemory` / `memcpy` /
  `vkUnmapMemory`, the push_back loop); `ParticleGenerator Particles;` after `BallObject Ball;`; the four lines in
  Init after the textures; `vkDestroyBuffer(device, Particles.quadBuffer, nullptr);` and `vkFreeMemory(device,
  Particles.quadBufferMemory, nullptr);` after the renderer's in `cleanup()`. 500 dead particles (Life 0): **no visible
  change**.

## spawn
- **Task:** Bring the particles to life: `firstUnusedParticle` (the first dead particle, searching from the last one used), `respawnParticle` (a new particle at an object, with learnopengl's random offset and brightness) and `Update` for the generator (spawn new ones, then age, move and fade the living ones); call it in the game's `Update` with 2 new particles per frame at the ball, offset by half its radius.
- **Hint:** `float random = ((rand() % 100) - 50) / 10.0f;` and `float rColor = 0.5f + ((rand() % 100) / 100.0f);` (`<cstdlib>` is included already). In Update: `p.Life -= dt; if (p.Life > 0.0f) { p.Position -= p.Velocity * dt; p.Color.a -= dt * 2.5f; }`. The call: `Update(Particles, dt, Ball, 2, glm::vec2(Ball.Radius / 2.0f));` after `DoCollisions(game);`.
- **When done:** `unsigned int lastUsedParticle = 0;`, `unsigned int firstUnusedParticle(ParticleGenerator&
  generator)` (learnopengl's two loops from lastUsedParticle and from 0, else `lastUsedParticle = 0; return 0;`), `void
  respawnParticle(Particle& particle, GameObject& object, glm::vec2 offset = …)`, `void Update(ParticleGenerator&
  generator, float dt, GameObject& object, unsigned int newParticles, glm::vec2 offset = …)` (above); the call in the
  game's Update. The particles live but are not drawn yet: **no visible change** (start picture; still 71 draws).

## draw-particles
- **Task:** Write `DrawParticles`: bind the particle pipeline (additive blending) and draw every living particle – its `offset` and `color` as push constants, the particle texture's descriptor set, the quad; draw the particles in `Render` after the paddle, before the ball, and give the generator the command buffer in `recordCommandBuffer`.
- **Hint:** `vkCmdBindPipeline(generator.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, generator.shader);` then `for (Particle particle : generator.particles) if (particle.Life > 0.0f) { ParticleConstants constants{}; constants.offset = particle.Position; constants.color = particle.Color; vkCmdPushConstants(…, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(ParticleConstants), &constants); vkCmdBindDescriptorSets(…, &generator.texture, …); vkCmdBindVertexBuffers(…); vkCmdDraw(generator.commandBuffer, 6, 1, 0, 0); }`. `Particles.commandBuffer = commandBuffer;` after `Renderer.commandBuffer = commandBuffer;`.
- **When done:** `void DrawParticles(ParticleGenerator& generator)` (above), `DrawParticles(Particles);` between
  `DrawObject(Player, Renderer);` and `DrawObject(Ball, Renderer);`, `Particles.commandBuffer = commandBuffer;` in
  `recordCommandBuffer`. **A glowing trail appears behind the ball** (48 visible particles, ≈ 189 draws):
  trail-near = 255,255,255 (several bright particles added up – clamped to white), trail-mid = 225,204,233, trail-far =
  174,157,186 (fainter: older particles have less alpha); trail-side = 79,58,87, ball = 196,231,183 (the ball is drawn
  over the newest particles), stone = 132,132,116, on-paddle = 30,40,46, paddle = 214,170,72, sky = 53,44,75, blue =
  39,118,196 unchanged. No validation message (the push constant range covers both stages for both pipelines).
