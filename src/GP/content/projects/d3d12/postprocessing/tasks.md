# Postprocessing (Hedgerow) – tasks (DirectX 12)

**Screenshot time: t = 1.45 s (frame 87)** – OpenGL's (projects/opengl/postprocessing/tasks.md): frame 87 is the 88th
`OnUpdate` + `OnRender` (frame n's clock reads n / 60 s; SPACE as `OnKeyDown(VK_SPACE)` before frame 30's `OnUpdate`,
`OnKeyUp` before frame 33's – see `../game-setup/tasks.md`). The ball hits the solid stone (5, 9) in frame 86, which
starts the shake (ShakeTime 0.05 s): on in frames 86 and 87, off from frame 88. The `confuse` and `chaos` tasks switch
their effect on in Init (as a try-out line), so they show at any time; `shake` removes that line again.

learnopengl "2D Game / Postprocessing": `post_processor.h/.cpp`, `post_processing.vs/.frag`, the PostProcessor parts of
`progress/7.game.cpp` (Effects, ShakeTime). Files: `main.cpp` (= `particles`' solution with TODOs), **`post_processing.hlsl`**
(new: VSMain / PSMain; their start bodies pass the quad and the texture through and compile), `sprite.hlsl`,
`particle.hlsl`, `textures/`, `levels/` (unchanged).

**The same as OpenGL** (structs, functions, numbers, task ids, points): learnopengl's PostProcessor as a plain struct
(`PostProcessingShader`, `Texture`, `Width`, `Height`, `Confuse`, `Chaos`, `Shake`, the render state), the global
`PostProcessor  Effects;` and `float ShakeTime = 0.0f;`; `void InitPostProcessor(PostProcessor& effects, Shader shader,
unsigned int width, unsigned int height)` (learnopengl's constructor) called in Init after the particles; the overload
`void InitRenderData(PostProcessor&)` (the screen quad); `void BeginRender(PostProcessor&)`, `void
EndRender(PostProcessor&)`, `void Render(PostProcessor& effects, float time)` (an overload of `Render(Game&)`), called
in `Render(Game&)` before the background / after the ball; learnopengl's post shader (chaos: texture coordinates
swirling with `(sin(time), cos(time)) × 0.3` and the edge kernel; confuse: mirrored coordinates and inverted colours;
shake: the position moved by `cos(time × 10), cos(time × 15) × 0.01` and the blur kernel – over 9 samples 1/300 apart);
the shake in DoCollisions (`else { ShakeTime = 0.05f; Effects.Shake = true; }` for a solid block) and its countdown in
Update after the particles.

**Direct3D 12's choices:**
- **No glBlitFramebuffer: a 4× multisampled render target resolved into a texture.** learnopengl's MSFBO with its
  4-sample renderbuffer is `MSRenderTarget` – a `DXGI_FORMAT_R8G8B8A8_UNORM` texture with `SampleDesc.Count = 4`
  (`CD3DX12_RESOURCE_DESC::Tex2D(…, 1, 1, 4, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)`, optimised clear colour black,
  created in the RENDER_TARGET state; `CheckFeatureSupport(D3D12_FEATURE_MULTISAMPLE_QUALITY_LEVELS)` first – 4× is
  required from feature level 11_0 on) with its RTV in a small RTV heap of its own (`RtvHeap`, 1 descriptor). The FBO with
  its texture is `Texture` – a `Texture2D` with one sample per pixel in the next heap slot (`Texture.ID =
  Graphics.SrvCount++`: slot 7), created in the PIXEL_SHADER_RESOURCE state, with its SRV. (The swap chain's buffers
  cannot be multisampled – a flip-model swap chain needs `SampleDesc.Count = 1` –, the same reason as in the
  `anti-aliasing` chapter.) No depth buffer, as learnopengl.
- `BeginRender`: `OMSetRenderTargets` with the multisampled target's RTV and `ClearRenderTargetView` to black.
  `EndRender`: barriers RENDER_TARGET → RESOLVE_SOURCE (the multisampled target) and PIXEL_SHADER_RESOURCE →
  RESOLVE_DEST (the texture), **`ResolveSubresource(effects.Texture.Resource.Get(), 0, effects.MSRenderTarget.Get(), 0,
  DXGI_FORMAT_R8G8B8A8_UNORM)`** (each pixel = the average of its 4 samples – what learnopengl's blit does), the
  barriers back, then `OMSetRenderTargets` with the back buffer's RTV (learnopengl's `glBindFramebuffer(GL_FRAMEBUFFER,
  0)`). The game's functions do not know the back buffer: `GraphicsContext` gains `D3D12_CPU_DESCRIPTOR_HANDLE
  BackBufferRtv`, set in `PopulateCommandList` before `Render(Hedgerow);`.
- **A pipeline state knows the target's sample count.** A PSO can only draw into a render target with its
  `SampleDesc.Count`: `Compile` / `loadShaderFromFile` / `LoadShader` get a parameter `UINT sampleCount = 1`
  (`psoDesc.SampleDesc.Count = sampleCount;`), the sprite and particle shaders are loaded with 4
  (`LoadShader(L"sprite.hlsl", "sprite", D3D12_BLEND_INV_SRC_ALPHA, 4);`, `LoadShader(L"particle.hlsl", "particle",
  D3D12_BLEND_ONE, 4);`), the postprocessing shader with 1 (it draws into the window). OpenGL needs nothing like it.
- **The effect options and the time as root constants**: `cbuffer PostProcessingConstants : register(b0) { float time;
  int confuse; int chaos; int shake; };` ↔ `struct PostProcessingConstants { float time; int confuse; int chaos; int
  shake; };` (learnopengl's bool uniforms as ints), set in `Render(PostProcessor&, float)` with
  `SetGraphicsRoot32BitConstants(0, 4, …)`; the texture with root parameter 2's table (slot 7).
- **The offsets and kernels are `static const` arrays in the HLSL.** learnopengl sets `offsets[9]`, `edge_kernel[9]`,
  `blur_kernel[9]` once from the program (glUniform2fv / 1iv / 1fv); they never change, so in Direct3D they are
  constants of the shader (no buffer, no upload). The values are learnopengl's.
- **The time**: learnopengl passes `glfwGetTime()`; the course adds `float GetTime()` (the time since its first call,
  from `std::chrono::high_resolution_clock` – OnUpdate's clock, so frame n reads n / 60), called as `Render(Effects,
  GetTime());`.
- **v points down**: the quad's texture coordinates have v = 0 at the top (`-1, -1` → `(0, 1)` …), so the picture is
  upright; chaos moves the coordinates with `texCoord.y - cos(time) * strength` (learnopengl's `+`, with v up – the
  picture moves the same way); the offsets' rows are written with v down (top row `-offset`; the kernels are symmetric,
  so the result is the same). Confuse (`1.0 - texCoord`) needs no change.
- HLSL names: learnopengl's `sample` array is `samples` (`sample` is an HLSL keyword), its `texture` variable is the
  input `texCoord`. The plain branch writes alpha 1 (`float4(scene.Sample(…).rgb, 1.0f)`): learnopengl's texture is
  GL_RGB (alpha 1), the course's has alpha, which the sprites' blending lowers at their soft edges.
- OnDestroy releases it with `Effects = PostProcessor();`.

Named points (OpenGL's, from the top-left, 800×600, frame 87): **orange** (396,29), **blue** (396,141), **sky**
(200,250), **mid** (400,300), **hills** (400,450), **paddle** (358,588), **top-paddle** (442,12), **beside-paddle**
(300,590), **stone** (13,209), **ball** (496,243), **edge-row** (100,37). Pixel values are OpenGL's (Mesa) unless noted;
the simulator's Direct3D 12 pictures equal them (see below).

**Start picture** (= `particles`' end at 1.45 s): orange = 196,98,0, blue = 39,118,196, sky = 53,44,75, mid = 63,50,80,
hills = 46,52,74, paddle = 214,170,72, top-paddle = 242,121,0, beside-paddle = 30,40,46, stone = 126,126,110, ball =
194,230,181, **edge-row = 116,116,58 in Direct3D 12** (OpenGL: 146,73,0). Pixel rows 37, 112 and 187 lie exactly on
brick edges (y = 37.5, 112.5, 187.5 pass through the pixel centres): Direct3D's top-left rule gives such a pixel to the
brick whose top edge it is – the lower one (the yellow row, at row 37) –, OpenGL (Mesa) to the upper one. Only these
rows differ between the APIs before the postprocessor; after `render-to-texture` the multisampled target averages the
two bricks and both APIs agree.

## post-shader
- **Task:** Write the postprocessing shader in `post_processing.hlsl` – vertex shader: chaos swirls the texture
  coordinates with time, confuse mirrors them, shake wobbles the position; pixel shader: chaos = edge detection, confuse
  = inverted colours, shake = blur, all over 9 samples at `offsets` – and load it as `"postprocessing"`.
- **Hint:** learnopengl's post_processing.vs / .frag in HLSL: `if (chaos || shake) for (int i = 0; i < 9; i++)
  samples[i] = scene.Sample(wrapSampler, input.texCoord + offsets[i]).rgb;` then `color += float4(samples[i] *
  edge_kernel[i], 0.0f)` (or `blur_kernel`). Chaos: `float2(texCoord.x + sin(time) * strength, texCoord.y - cos(time) *
  strength)` (v points down). `LoadShader(L"post_processing.hlsl", "postprocessing");`
- **Observable:** the two shader bodies as described above (VSMain: `if (chaos) … else if (confuse) … else …`, then
  `if (shake) { result.position.x += cos(time * 10.0f) * strength; result.position.y += cos(time * 15.0f) * strength; }`;
  PSMain: the samples, `if (chaos) … else if (confuse) … else if (shake) … else …`); the LoadShader call after the
  particle shader's (a third PSO, alpha blending, 1 sample). Nothing uses the shader yet: **no visible change** (start
  picture).

## post-processor
- **Task:** Add learnopengl's PostProcessor as a struct, with `InitRenderData` (the screen quad) and
  `InitPostProcessor` (a 4× multisampled render target with its RTV, a texture to resolve it into with its SRV, the
  quad); make the global `Effects` in Init; release it in OnDestroy.
- **Hint:** `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, width, height, 1, 1, 4, 0,
  D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)` in the RENDER_TARGET state with a black clear value; an RTV heap with one
  descriptor and `CreateRenderTargetView(effects.MSRenderTarget.Get(), nullptr, …)`; for the texture: `effects.Texture.ID
  = Graphics.SrvCount++;`, `Tex2D(effects.Texture.Internal_Format, width, height, 1, 1)` in PIXEL_SHADER_RESOURCE and its
  SRV (like `Generate`, without the upload).
- **Observable:** `struct PostProcessor { Shader PostProcessingShader; Texture2D Texture; unsigned int Width = 0, Height
  = 0; bool Confuse = false, Chaos = false, Shake = false; ComPtr<ID3D12Resource> MSRenderTarget;
  ComPtr<ID3D12DescriptorHeap> RtvHeap; ComPtr<ID3D12Resource> quadVertexBuffer; D3D12_VERTEX_BUFFER_VIEW
  quadVertexBufferView = {}; };`, `void InitRenderData(PostProcessor& effects)` (the 6 quad vertices with v down, an
  upload heap), `void InitPostProcessor(…)` (CheckFeatureSupport, the two CreateCommittedResource calls, the RTV heap and
  view, the SRV), `PostProcessor  Effects;` after `ParticleGenerator Particles;`, the InitPostProcessor call after
  InitParticles, `Effects = PostProcessor();` in OnDestroy. The game still draws into the window: **no visible change**.

## render-to-texture
- **Task:** Write `BeginRender` (draw into the multisampled target, cleared black), `EndRender` (resolve it into the
  texture, then draw into the back buffer again) and `Render` (the quad with the post shader and its options); the PSOs
  of what is drawn into the multisampled target need 4 samples; in the game's `Render` wrap the drawing in BeginRender /
  EndRender and then draw the quad with the time.
- **Hint:** `Graphics.CommandList->ResolveSubresource(effects.Texture.Resource.Get(), 0, effects.MSRenderTarget.Get(),
  0, effects.Texture.Internal_Format);` between the barriers (RENDER_TARGET ↔ RESOLVE_SOURCE, PIXEL_SHADER_RESOURCE ↔
  RESOLVE_DEST), then `OMSetRenderTargets(1, &Graphics.BackBufferRtv, FALSE, nullptr);`. `Compile(…, UINT sampleCount =
  1)` → `psoDesc.SampleDesc.Count = sampleCount;`. In Render(Game&): `BeginRender(Effects);` … `EndRender(Effects);
  Render(Effects, GetTime());`.
- **Observable:** `D3D12_CPU_DESCRIPTOR_HANDLE BackBufferRtv` in `GraphicsContext` and `Graphics.BackBufferRtv =
  rtvHandle;` before `Render(Hedgerow);` in PopulateCommandList; the `sampleCount` parameter of Compile,
  loadShaderFromFile and LoadShader; the sprite and particle shaders loaded with 4 samples; `float GetTime()`; the three
  functions and `struct PostProcessingConstants` (above); `BeginRender(Effects);` before the background,
  `EndRender(Effects);` and `Render(Effects, GetTime());` after the ball, inside `if (game.State == GAME_ACTIVE)`. The
  game now goes through the 4× multisampled target and the quad – **almost no visible change**: only edges are
  antialiased (the sprites' rims, and pixel rows 37, 112, 187: half one brick, half the other – edge-row = 132,95,29,
  as OpenGL); every named point else as the start picture. One draw more (the quad).

## confuse
- **Task:** Try the first effect: switch `Confuse` on in Init, after the postprocessor is set up.
- **Hint:** `Effects.Confuse = true;`
- **Observable:** `Effects.Confuse = true; // try the effects: …` right after the InitPostProcessor call. **The whole
  picture is upside down and mirrored, its colours inverted**: orange = 225,215,209, blue = 209,203,181, sky =
  180,199,170, mid = 192,205,175, hills = 229,176,123, paddle = 23,139,255, top-paddle = 41,85,183, beside-paddle =
  27,141,255, stone = 170,193,165, ball = 179,198,169, edge-row = 225,215,209.

## chaos
- **Task:** Replace the confuse line with the chaos effect.
- **Hint:** `Effects.Chaos = true;` (chaos wins over confuse in the shader anyway, but try one at a time).
- **Observable:** `Effects.Chaos = true; // try the effects: …` instead of the confuse line. **Edge detection on a
  picture shifted by (sin(time), cos(time)) × 0.3** (the texture repeats: the static sampler wraps): black wherever the
  picture is flat, thin bright lines along the bricks' and sprites' edges: orange = 5,5,0, blue = 7,13,13, sky = 0,0,0,
  mid = 0,0,0, hills = 0,0,0, paddle = 0,0,0, top-paddle = 0,0,0, beside-paddle = 0,0,0, stone = 0,0,0, ball = 55,55,45,
  edge-row = 0,0,0 (OpenGL's; on the thin lines the APIs differ by a few levels: the simulator's Direct3D 12 picture
  gives orange = 2,3,0, blue = 2,11,12, ball = 58,58,50 – 50 of 480 000 pixels differ by more than 5 %). The picture
  moves with time.

## shake
- **Task:** Remove the try-out line again; instead shake the screen when the ball hits a solid block: set `ShakeTime`
  to 0.05 seconds and `Effects.Shake`, and in `Update` count ShakeTime down and stop the shake when it is over.
- **Hint:** In DoCollisions: `if (!box.IsSolid) box.Destroyed = true; else { ShakeTime = 0.05f; Effects.Shake = true;
  }`. In Update after the particles: `if (ShakeTime > 0.0f) { ShakeTime -= dt; if (ShakeTime <= 0.0f) Effects.Shake =
  false; }`. `float ShakeTime = 0.0f;` with the globals.
- **Observable:** no `Effects.Chaos`/`Confuse` line in Init; `float ShakeTime = 0.0f;` after `PostProcessor  Effects;`;
  the else branch in DoCollisions; the countdown in Update after the particles' Update. The ball hits the stone in frame
  86: **in frame 87 the picture is blurred and moved by about (−1.4, +2.9) pixels**: paddle = 181,141,61, top-paddle =
  231,116,0, ball = 195,231,182, stone = 122,122,106, edge-row = 173,87,1; flat areas almost unchanged: orange =
  198,99,0, blue = 39,119,197, sky = 52,44,75, mid = 63,50,80, hills = 46,52,74, beside-paddle = 30,40,46. (From frame 88
  on the picture equals `render-to-texture`'s again.)
