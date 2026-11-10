# Particles (Hedgerow) – tasks (DirectX 12)

**Screenshot time: t = 2.0 s (frame 120)** – OpenGL's (projects/opengl/particles/tasks.md): frame 120 is the 121st
`OnUpdate` + `OnRender` (frame n's clock reads n / 60 s; SPACE as `OnKeyDown(VK_SPACE)` before frame 30's `OnUpdate`,
`OnKeyUp` before frame 33's – see `../game-setup/tasks.md`). At 2.0 s the ball comes down after its bounce off the
stone (5, 9) (see `collision-resolution`) with a trail of fading particles behind it.

learnopengl "2D Game / Particles": `particle_generator.h/.cpp`, `particle.vs` / `particle.frag` and the particle parts
of `progress/6.game.cpp`. Files: `main.cpp` (= `collision-resolution`'s solution with TODOs), `sprite.hlsl`,
**`particle.hlsl`** (new, VSMain / PSMain with TODO bodies that compile: the start draws nothing with them),
`textures/` (+ **`particle.png`**, 64² RGBA, a soft white glow), `levels/`.

**The same as OpenGL** (structs, functions, numbers, task ids, points):
- `struct Particle { XMFLOAT2 Position = (0, 0), Velocity = (0, 0); XMFLOAT4 Color = (1, 1, 1, 1); float Life = 0; };`,
  `struct ParticleGenerator { std::vector<Particle> particles; unsigned int amount = 0; Shader shader; unsigned int
  texture = 0; … };` (the texture as its ID – its view's slot in the heap, like GameObject's Sprite), the global
  `ParticleGenerator Particles;`; in `Init` after the textures: `Particles.shader = GetShader("particle");
  Particles.texture = GetTexture("particle").ID; Particles.amount = 500; InitParticles(Particles);` – `void
  InitParticles(ParticleGenerator&)` is learnopengl's private `init()`, the same pattern as the SpriteRenderer's
  `InitRenderData`.
- `unsigned int lastUsedParticle = 0;`, `unsigned int firstUnusedParticle(ParticleGenerator&)`, `void
  respawnParticle(Particle& particle, GameObject& object, XMFLOAT2 offset = XMFLOAT2(0.0f, 0.0f))` with learnopengl's
  `float random = ((rand() % 100) - 50) / 10.0f; float rColor = 0.5f + ((rand() % 100) / 100.0f);` (two rand() calls
  per particle, in that order), and `void Update(ParticleGenerator& generator, float dt, GameObject& object, unsigned int
  newParticles, XMFLOAT2 offset = XMFLOAT2(0.0f, 0.0f))` – an **overload** of the game's `Update(Game&, float)`. Called
  in the game's `Update` after `DoCollisions(game);`: `Update(Particles, dt, Ball, 2, XMFLOAT2(Ball.Radius / 2.0f,
  Ball.Radius / 2.0f));` (glm's `vec2(r / 2)` sets both components) – the ball passed as its GameObject part.
- `void DrawParticles(ParticleGenerator&)` (learnopengl's `Draw`): `for (Particle particle : generator.particles)` (a
  copy, as learnopengl), one draw per living particle (`Life > 0.0f`), in `Render` **after the paddle, before the
  ball**.
- The particle shader is learnopengl's: a 10 × 10 pixel quad with its top-left corner at `offset`, the texture times
  the particle's colour.

**Direct3D 12 specifics:**
- **Additive blending is part of the pipeline state.** learnopengl switches the blend function around its draws
  (`glBlendFunc(GL_SRC_ALPHA, GL_ONE)`, then back to `GL_ONE_MINUS_SRC_ALPHA`); in Direct3D 12 the blend state lives in
  the PSO, so the particle shader gets its own PSO with `DestBlend = D3D12_BLEND_ONE` (and `DestBlendAlpha`, as
  glBlendFunc sets both). `Compile` gets a parameter `D3D12_BLEND destBlend = D3D12_BLEND_INV_SRC_ALPHA` assigned to
  `psoDesc.BlendState.RenderTarget[0].DestBlend` and `DestBlendAlpha`; `loadShaderFromFile(shaderFile, destBlend)` and
  `LoadShader(shaderFile, name, destBlend = D3D12_BLEND_INV_SRC_ALPHA)` pass it on; `Init` loads
  `LoadShader(L"particle.hlsl", "particle", D3D12_BLEND_ONE);`. DrawParticles starts with `Use(generator.shader)`
  (SetPipelineState); nothing is restored afterwards – the ball's `DrawSprite` sets the sprite PSO (with its alpha
  blending) again.
- **Per-particle values as root constants** (learnopengl's uniforms `offset` and `color`, set per draw): `cbuffer
  ParticleConstants : register(b0) { float2 offset; float4 color; };` ↔ `struct ParticleConstants { XMFLOAT2 offset;
  XMFLOAT2 padding; XMFLOAT4 color; };` (HLSL packs a cbuffer in 16-byte rows and a float4 never straddles two rows, so
  `color` starts at byte 16: the C++ struct pads 8 bytes) – 8 of the root signature's 19 constants at b0, set with
  `SetGraphicsRoot32BitConstants(0, sizeof(ParticleConstants) / 4, &constants, 0)` before each particle's draw; then the
  particle texture's table (`SetGraphicsRootDescriptorTable(2, …generator.texture…)`), the quad's vertex buffer view,
  `DrawInstanced(6, 1, 0, 0)`. The same root signature as the sprites: the projection is the CBV of root parameter 1
  (the sprites' – learnopengl's "configure the particle shader with the same projection" needs no code), the sampler
  the static one. learnopengl draws the particles one by one: the course does too (instancing – one draw with a
  per-instance buffer of offsets and colours – would be the faster way on a real GPU; see the `instancing` chapter).
- The quad: InitParticles makes its own upload-heap vertex buffer with the sprite quad's 6 vertices (learnopengl's
  `particle_quad`), the same code as `InitRenderData`; OnDestroy releases it with `Particles = ParticleGenerator();`
  (learnopengl's glDeleteVertexArrays).
- DirectXMath: `XMStoreFloat2(&particle.Position, XMLoadFloat2(&object.Position) + XMVectorReplicate(random) +
  XMLoadFloat2(&offset));` (glm's `object.Position + random + offset`: the same random number on x and y),
  `XMStoreFloat2(&particle.Velocity, XMLoadFloat2(&object.Velocity) * 0.1f);`, `XMStoreFloat2(&p.Position,
  XMLoadFloat2(&p.Position) - XMLoadFloat2(&p.Velocity) * dt);`; the alpha is `p.Color.w` (XMFLOAT4's fourth
  component, glm's `.a`).
- **rand()**: the simulator's rand() is glibc's (seed 1, no srand), as OpenGL and Vulkan on Linux get. **A Direct3D 12
  program runs on Windows and gets MSVC's rand()** – a different sequence (and RAND_MAX 32767), so on a real Windows
  machine the particles' random offsets and brightnesses differ a little from the pictures below (the trail's place
  and look stay the same). The course's pictures and checks use glibc's numbers.
- Colours above 1 and negative alpha: Direct3D clamps a pixel shader's output to the UNORM render target's 0…1 range
  before blending, as OpenGL does – a particle with alpha below 0 adds nothing, a colour above 1 counts as 1.

**What the particles do** (OpenGL's measurements; the Direct3D 12 code computes the same – checked with the game code
compiled natively with DirectXMath and glibc's rand(), run frame by frame): 2 spawn per frame from frame 0 on, at the
ball's position + 6.25 + random −5…+4.9; while the ball is stuck they drift (−10, +35) px/s; about 120 are alive
after the first second (118–122: Life is a float counted down by deltaTime, so a particle dies after 60 or 61 frames –
which one depends on the float rounding of deltaTime: exactly 1/60 here, OpenGL's glfwGetTime() differences 118), but
only those of the last 24 frames are visible (alpha > 0): a trail of about 140 pixels behind the ball. **At 2.0 s** the
ball is at (539.17, 423.33) coming down to the right, the visible trail goes from its upper left back up to about
(510, 290). Draws at frame 120: 71 + the living particles (≈ 120) ≈ 190.

Named points (OpenGL's, from the top-left, 800×600, frame 120): **trail-near** (542,410); **trail-mid** (530,366);
**trail-far** (522,332); **trail-side** (560,366) – beside the trail (sky, never a particle); **ball** (551,435);
**stone** (506,206); **on-paddle** (400,567); **paddle** (358,588); **sky** (200,250); **blue** (396,141). Pixel values
are OpenGL's (Mesa).

**Start picture** (= `collision-resolution`'s end at 2.0 s): trail-near = 90,65,92, trail-mid = 79,58,87, trail-far =
71,54,83, trail-side = 79,58,87 (the background), ball = 196,231,183, stone = 132,132,116, on-paddle = 30,40,46,
paddle = 214,170,72, sky = 53,44,75, blue = 39,118,196. 71 draws.

## particle-shader
- **Task:** Write the particle shader (`particle.hlsl`: a 10 × 10 pixel quad at `offset`, the particle texture times
  the particle's colour), give `Compile` (and `loadShaderFromFile`, `LoadShader`) a blend factor parameter `destBlend`,
  and in `Init` load the shader as `"particle"` with additive blending (`D3D12_BLEND_ONE`) and `textures/particle.png`
  (with alpha) as `"particle"`.
- **Hint:** VSMain: `float scale = 10.0f;`, `result.texCoord = texCoord; result.particleColor = color;`,
  `result.position = mul(float4((position * scale) + offset, 0.0f, 1.0f), projection);`; PSMain: `return
  sprite.Sample(wrapSampler, input.texCoord) * input.particleColor;`. `void Compile(…, D3D12_BLEND destBlend =
  D3D12_BLEND_INV_SRC_ALPHA)` with `DestBlend = destBlend;` and `DestBlendAlpha = destBlend;`.
  `LoadShader(L"particle.hlsl", "particle", D3D12_BLEND_ONE);`.
- **Observable:** particle.hlsl with those bodies (cbuffer `ParticleConstants { float2 offset; float4 color; }` at b0,
  `SceneConstantBuffer { float4x4 projection; }` at b1, `Texture2D sprite : register(t0)`); `Compile(Shader& shader,
  ID3DBlob* vertexShader, ID3DBlob* pixelShader, D3D12_BLEND destBlend = D3D12_BLEND_INV_SRC_ALPHA)` assigning
  `destBlend` to `DestBlend` and `DestBlendAlpha`; `Shader loadShaderFromFile(const wchar_t* shaderFile, D3D12_BLEND
  destBlend)` calling `Compile(…, destBlend)`; `Shader LoadShader(const wchar_t* shaderFile, std::string name,
  D3D12_BLEND destBlend = D3D12_BLEND_INV_SRC_ALPHA)`; in `Init` `LoadShader(L"particle.hlsl", "particle",
  D3D12_BLEND_ONE);` after the sprite's (a second PSO: SrcBlend SRC_ALPHA, DestBlend ONE) and
  `LoadTexture("textures/particle.png", true, "particle");` after the paddle's (heap slot 6). Nothing draws with them:
  **no visible change** (start picture).

## particle-generator
- **Task:** Add `struct Particle` and `struct ParticleGenerator` and `InitParticles` (the quad's vertex buffer and
  `amount` default particles); make the global `Particles` in `Init`: 500 particles with the particle shader and
  texture. Release it in `OnDestroy`.
- **Hint:** The quad is the sprite quad (6 vertices, `float2 position, float2 texCoord`) in an upload heap, with a
  vertex buffer view – as in `InitRenderData`. `for (unsigned int i = 0; i < generator.amount; ++i)
  generator.particles.push_back(Particle());`. In Init: `Particles.shader = GetShader("particle"); Particles.texture =
  GetTexture("particle").ID; Particles.amount = 500; InitParticles(Particles);`.
- **Observable:** the two structs (ParticleGenerator: `particles`, `amount = 0`, `shader`, `unsigned int texture = 0`,
  `ComPtr<ID3D12Resource> quadVertexBuffer`, `D3D12_VERTEX_BUFFER_VIEW quadVertexBufferView = {}`) and `void
  InitParticles(ParticleGenerator& generator)` (`particle_quad[]`, `CreateCommittedResource` in an upload heap,
  Map/memcpy/Unmap, the view with stride `4 * sizeof(float)`, the push_back loop) in the section `// ParticleGenerator
  (learnopengl: particle_generator.h, particle_generator.cpp)` before the Game section; `ParticleGenerator Particles;`
  after `BallObject     Ball;`; the four lines in Init after the textures; `Particles = ParticleGenerator();` in
  `OnDestroy` after `Renderer = SpriteRenderer();`. 500 dead particles (Life 0): **no visible change**.

## spawn
- **Task:** Bring the particles to life: `firstUnusedParticle` (the first dead particle, searching from the last one
  used), `respawnParticle` (a new particle at an object, with learnopengl's random offset and brightness) and `Update`
  for the generator (spawn new ones, then age, move and fade the living ones); call it in the game's `Update` with 2 new
  particles per frame at the ball, offset by half its radius.
- **Hint:** `float random = ((rand() % 100) - 50) / 10.0f;` and `float rColor = 0.5f + ((rand() % 100) / 100.0f);`
  (`#include <cstdlib>`). In Update: `p.Life -= dt; if (p.Life > 0.0f) { XMStoreFloat2(&p.Position,
  XMLoadFloat2(&p.Position) - XMLoadFloat2(&p.Velocity) * dt); p.Color.w -= dt * 2.5f; }`. The call: `Update(Particles,
  dt, Ball, 2, XMFLOAT2(Ball.Radius / 2.0f, Ball.Radius / 2.0f));` after `DoCollisions(game);`.
- **Observable:** `#include <cstdlib>`; `unsigned int lastUsedParticle = 0;`, `unsigned int
  firstUnusedParticle(ParticleGenerator& generator)` (learnopengl's two loops from lastUsedParticle and from 0, else
  `lastUsedParticle = 0; return 0;`), `void respawnParticle(Particle& particle, GameObject& object, XMFLOAT2 offset =
  …)`, `void Update(ParticleGenerator& generator, float dt, GameObject& object, unsigned int newParticles, XMFLOAT2
  offset = …)` (above); the call in the game's Update before the loss check. The particles live but are not drawn yet:
  **no visible change** (start picture; still 71 draws).

## draw-particles
- **Task:** Write `ParticleConstants` (the particle shaders' root constants) and `DrawParticles`: with the particle
  shader's pipeline state (additive blending), draw every living particle – its `offset` and `color` as root constants,
  the particle texture, the quad; draw the particles in `Render` after the paddle, before the ball.
- **Hint:** `Use(generator.shader);` then `for (Particle particle : generator.particles) if (particle.Life > 0.0f) {
  ParticleConstants constants = {}; constants.offset = particle.Position; constants.color = particle.Color;
  Graphics.CommandList->SetGraphicsRoot32BitConstants(0, sizeof(ParticleConstants) / 4, &constants, 0); … }` with the
  texture's table (root parameter 2), `IASetVertexBuffers` and `DrawInstanced(6, 1, 0, 0)` – like DrawSprite.
- **Observable:** `struct ParticleConstants { XMFLOAT2 offset; XMFLOAT2 padding; XMFLOAT4 color; };`, `void
  DrawParticles(ParticleGenerator& generator)` (above) and `DrawParticles(Particles);` between `DrawObject(Player,
  Renderer);` and `DrawObject(Ball, Renderer);`. **A glowing trail appears behind the ball** (≈ 190 draws):
  trail-near = 255,255,255 (several bright particles added up – clamped to white), trail-mid = 225,204,233, trail-far =
  174,157,186 (fainter: older particles have less alpha); trail-side = 79,58,87, ball = 196,231,183 (the ball is drawn
  over the newest particles), stone = 132,132,116, on-paddle = 30,40,46, paddle = 214,170,72, sky = 53,44,75, blue =
  39,118,196 unchanged.
