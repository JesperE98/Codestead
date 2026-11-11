# Review: In Practice

Congratulations on reaching the end of the *In Practice* part – and of the course. You started by learning to find
mistakes: the error checks, the messages of the driver or the layers, a value written out as a colour, and the tools
that capture a frame. You drew text with FreeType's glyphs. And then you built a whole game, Hedgerow, step by step:
a game loop with input, a sprite renderer with an orthographic projection, levels loaded from text files, a paddle and
a ball, collision detection and resolution, a trail of particles, post-processing effects through a multisampled
target, power-ups, lives, a menu and a win screen. This page is a glossary of the most important terms of the part,
chapter by chapter, like the reviews learnopengl.com has at the end of its sections. Use it to look things up, and as
a check: if a definition surprises you, go back to the chapter it comes from.

Most of a game is logic that has nothing to do with the graphics API – the loop, the collisions, the power-ups, the
lives –, so most of this page is outside the boxes. What differs is how {{api}} reports mistakes and how it draws:
OpenGL keeps an error flag and global state and can draw from anywhere; Vulkan checks nothing without its validation
layer, and every draw is a command recorded into a command buffer, with the per-sprite values as push constants and
the pipelines made for a render pass and a sample count; Direct3D 12 checks nothing without its debug layer, records
into one command list with root constants and descriptor tables, and makes the program track resource states with
barriers. When you're done, the exam at the end of the part checks what you've learned.

## Debugging

- **Visual errors**: a black screen or a wrong picture gives no message by itself; GPU code has no console and no
  breakpoints. The tools: error checks, debug messages, writing values as colours, and frame debuggers.
- **The two kinds of errors**: run-time failures (out of memory, a lost device, a file that isn't a shader) are
  reported by return values; *using the API wrongly* is checked only by OpenGL's error flag or by an optional layer.
- **Debugging shader output**: write a variable as the colour – normals, texture coordinates (u red, v green) – and
  read the picture. Colours are clamped to 0..1, so signed values need `* 0.5 + 0.5`.
- **The reference compiler**: `glslangValidator` checks GLSL against the specification (the stage from the extension,
  or `-S vert`); code it rejects shouldn't be relied on anywhere.
- **Framebuffer output**: show a render target's texture on a quad in a corner of the window.
- **Frame debuggers**: RenderDoc (free, OpenGL, Vulkan, Direct3D), NVIDIA Nsight Graphics, PIX (Direct3D 12): capture a
  frame, step through its calls, inspect state, buffers, textures and a pixel's history. They show the objects' names.

:::opengl
- **`glGetError`**: returns and clears the error flag; once a flag is set, no other error is recorded until it is read
  (on some systems several flags – read it in a loop). Codes: `GL_INVALID_ENUM` 1280, `GL_INVALID_VALUE` 1281,
  `GL_INVALID_OPERATION` 1282, …, `GL_INVALID_FRAMEBUFFER_OPERATION` 1286.
- **`glCheckError()`**: learnopengl's macro around `glCheckError_(__FILE__, __LINE__)` – prints the error's name and
  where it was checked.
- **Debug output**: core in OpenGL 4.3 (`KHR_debug`); a 4.3 context (with `GLFW_OPENGL_DEBUG_CONTEXT`) runs 3.3 core
  code unchanged; macOS stops at 4.1, without it. `glDebugMessageCallback(glDebugOutput, nullptr)`, the message's
  source, type, id and severity; `GL_DEBUG_OUTPUT_SYNCHRONOUS` calls it inside the guilty call, so a breakpoint in the
  callback shows the call stack; `glDebugMessageControl` filters. `glObjectLabel` names objects,
  `glPushDebugGroup` / `glPopDebugGroup` mark regions.
- **The project's mistakes**: `glUniform*` with no program in use (`GL_INVALID_OPERATION`: the projection stays zero –
  no cube), and `glTexImage2D(GL_FRAMEBUFFER, …)` (`GL_INVALID_ENUM`: an incomplete texture samples black).
:::
:::vulkan
- **`VkResult`**: what a call that can fail at run time returns; misuse is undefined behaviour and goes unchecked.
- **The validation layer** `VK_LAYER_KHRONOS_validation` checks every call against the specification's *valid usage*
  rules and sends messages to the **debug messenger** (`VK_EXT_debug_utils`, `debugCallback`): severity (verbose, info,
  warning, error – bits in order, so a comparison filters), type (general, validation, performance), the VUID, the
  objects. The callback returns `VK_FALSE`.
- **Object names** with `vkSetDebugUtilsObjectNameEXT` (loaded with `vkGetInstanceProcAddr`), **labels** with
  `vkCmdBeginDebugUtilsLabelEXT` / `vkCmdEndDebugUtilsLabelEXT`.
- **The project's mistake**: a vertex shader input at location 1 that the pipeline doesn't describe
  (`VUID-VkGraphicsPipelineCreateInfo-Input-07904`); the shader read (0, 0) and the cube was one flat brown.
- More in the layer: synchronization validation, GPU-assisted validation, best practices, debug printf (`vkconfig`).
:::
:::d3d12
- **`HRESULT`** and `ThrowIfFailed` for calls that can fail at run time; the `void` calls (views, command list) are
  checked only by the **debug layer** (a debug build, Windows' Graphics Tools).
- **The info queue** `ID3D12InfoQueue` (from the device with `As`): stored messages with category, severity
  (`CORRUPTION`, `ERROR`, `WARNING`, `INFO`, `MESSAGE`), ID and text; `GetMessage` twice (size, then message),
  `ClearStoredMessages`. `CheckDebugMessages()` is learnopengl's `glCheckError()`.
- **`ID3D12InfoQueue1::RegisterMessageCallback`**: learnopengl's debug output – called at the guilty call;
  `SetBreakOnSeverity` breaks into the debugger there (only with `IsDebuggerPresent()`); storage and retrieval filters.
- **`SetName`** gives objects names the messages and PIX use. **GPU-based validation** and **DRED** for what the
  CPU-side layer can't see and for device-removed crashes.
- **The project's mistakes**: no `SetDescriptorHeaps` before the descriptor tables (nothing drawn), and an SRV with
  `MipLevels` 0 (an invalid view, read as black).
:::

## Text Rendering

- **Bitmap font**: all glyphs pre-rasterised into one texture, each in its cell; fast and simple, but one size and a
  small character set.
- **FreeType**: loads TrueType and OpenType fonts – glyphs as curves (splines) – and rasterises them at any pixel size.
  `FT_Init_FreeType`, `FT_New_Face`, `FT_Set_Pixel_Sizes(face, 0, size)` (the em size, width from the height),
  `FT_Load_Char(face, c, FT_LOAD_RENDER)`: an 8-bit grey bitmap in `face->glyph->bitmap`; `FT_Done_Face`,
  `FT_Done_FreeType`. Each call returns non-zero on an error.
- **Glyph metrics**: the size (`bitmap.width`, `bitmap.rows`), the **bearing** (`bitmap_left`, `bitmap_top`: from the
  origin on the **baseline** to the bitmap's left and top), the **advance** (`advance.x`, in 1/64 pixels: `>> 6`).
- **`Character`** (texture or atlas position, size, bearing, advance) in a `std::map<char, Character>` for the first 128
  ASCII characters.
- **RenderText**: per character a quad at `x + bearing.x · scale`, `y − (size.y − bearing.y) · scale` (y up), the glyph's
  size; then `x += (advance >> 6) · scale`. The text shader uses the red channel as alpha: `vec4(textColor, 1.0) *
  vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r)`, with alpha blending.
- **The course's font**: Inter Bold (SIL Open Font License, `OFL.txt` next to it; learnopengl: Antonio Bold); the
  course's checks have its glyphs at 24 and 48 pixels. Going further: **signed distance field** fonts stay sharp at any
  scale.

:::opengl
- **One texture per glyph**: `GL_RED`, `GL_CLAMP_TO_EDGE`, `GL_LINEAR`, and `glPixelStorei(GL_UNPACK_ALIGNMENT, 1)` – a
  glyph's rows are as many bytes as it is wide, not a multiple of 4.
- **One dynamic quad**: a VBO of 6 × 4 floats (`GL_DYNAMIC_DRAW`), rewritten with `glBufferSubData` and drawn for each
  character.
:::
:::vulkan
- **One glyph atlas**: an image can't be 0 × 0 (the space), and 128 images with descriptor sets would be a lot; the
  bitmaps are copied row by row (`pitch`) into cells of one `VK_FORMAT_R8_UNORM` image, uploaded through a staging buffer.
- **Every quad its own place**: the GPU reads the vertex buffer when the command buffer runs, so each character's quad
  is written after the others (a host-visible buffer, mapped) and drawn from its first vertex.
:::
:::d3d12
- **One glyph atlas**: a texture can't be 0 × 0 (the space), and 128 textures with descriptors would be a lot; the
  bitmaps are copied row by row (`pitch`) into cells of one `DXGI_FORMAT_R8_UNORM` texture, uploaded with
  `UpdateSubresources`.
- **Every quad its own place**: the GPU reads the vertex buffer when the command list executes, so each character's
  quad is written after the others, and a line is one `DrawInstanced`.
:::

## The game: setting up and sprites

- **Hedgerow**: the course's game of learnopengl's kind – a paddle, a ball and a wall of blocks in a garden at dusk;
  four levels, power-ups, lives. learnopengl's classes are written as **structs and free functions** in one `main.cpp`.
- **The game loop**: each frame `deltaTime` (the time since the last frame), the events, then `ProcessInput`, `Update`,
  `Render`. The course's time is fixed: frame n sees n / 60 s; the only input is SPACE in frames 30–32.
- **Input**: the key callback records `Keys[1024]`; `ProcessInput` reads them every frame.
- **Game states**: `GAME_ACTIVE`, `GAME_MENU`, `GAME_WIN`.
- **The resource manager**: `LoadShader` / `GetShader`, `LoadTexture` / `GetTexture`, `ClearResources` – maps of
  named shaders and textures.
- **The orthographic projection**: the window's pixels, (0, 0) at the top left, y down – learnopengl's `glm::ortho(0,
  800, 600, 0, -1, 1)`; no view matrix.
- **The sprite renderer**: one quad (`vec4`: position 0..1 and texture coordinates) and `DrawSprite(texture, position,
  size, rotate, color)`; model = translate(position) · translate(½ size) · rotate · translate(−½ size) · scale(size) –
  the rotation about the centre, read from right to left. The shader: `vec4(spriteColor, 1.0) * texture(image,
  TexCoords)` – the colour tints the light textures.

:::opengl
- The shader's `model` and `spriteColor` are uniforms set per sprite; the projection is set once.
:::
:::vulkan
- `model` and `spriteColor` are **push constants** (76 bytes, vertex and fragment stage); the projection is in the
  uniform buffer, `glm::ortho(0, 800, 0, 600, -1, 1)` – Vulkan's clip space y already points down.
- `DrawSprite` records into the command buffer `recordCommandBuffer` hands to the renderer; the texture is its
  descriptor set. Functions that need the device (`Init`, `LoadShader`, `LoadTexture`, `InitRenderData`) are members of
  the application class.
:::
:::d3d12
- `model` and `spriteColor` are **root constants** (19 values, root parameter 0); the projection is in the constant
  buffer (`XMMatrixOrthographicOffCenterRH(0, Width, Height, 0, -1, 1)`), the texture a descriptor table (its ID is its
  heap slot), the sampler a static one.
- DirectXMath multiplies row vectors: the model matrix is written scale first, translation last. Keys arrive in
  `OnKeyDown` / `OnKeyUp` as virtual-key codes.
:::

## Levels, ball and collisions

- **GameObject**: position, size, velocity, colour, rotation, `IsSolid`, `Destroyed`, sprite. **GameLevel**: its
  `Bricks`.
- **Level files**: rows of numbers – 0 empty, 1 solid (a stone), 2–5 coloured blocks; 15 × 8 here, in the top half of
  the window: unit size = 800 / 15 × 300 / 8. `IsCompleted`: every non-solid block destroyed.
- **The paddle**: 100 × 20 at the bottom, 500 pixels per second with A and D, kept inside the window.
- **The ball**: a GameObject with `Radius` 12.5 and `Stuck`; velocity (100, −350); SPACE releases it; `Move` bounces it
  off the left, right and top walls. With the fixed input it bounces off the stone (5, 9) in frame 86 and is lost in
  frame 151.
- **AABB – AABB**: two boxes overlap if they overlap on both axes.
- **AABB – circle**: clamp the vector from the box's centre to the circle's centre to the box's half extents – the
  **closest point** on the box –; a collision if it is nearer than the radius.
- **Collision resolution**: `VectorDirection` – the compass direction (up, right, down, left) with the largest dot
  product with the difference vector; move the ball out by the **penetration** (radius − |difference| on that axis)
  and reverse that velocity component. Solid blocks stay, others are destroyed.
- **The paddle bounce**: the hit's distance from the paddle's centre sets the new x velocity (`strength` 2), the speed
  is kept (`normalize · length`), and y always points up – the fix for a ball stuck inside the paddle.
- **Losing the ball**: below the window → reset the level and the player (from `render-text` on: a life).

## Particles

- **Particle**: position, velocity, colour, life. **Emitter / generator**: spawns particles that decay; here 500
  particles, 2 new ones per frame at the ball, offset by half its radius.
- **`firstUnusedParticle`**: searches from the last used one, then from the start; if none is dead, the first is
  overwritten. **`respawnParticle`**: a random offset (±5 px) and brightness (0.5…1.5), life 1, the ball's velocity × 0.1.
- **Update**: life −= dt; a living particle moves against its velocity and fades (`alpha −= dt · 2.5`).
- **Additive blending**: `GL_SRC_ALPHA, GL_ONE` – the particles add up to a glow; drawn after the paddle and before the
  ball. `rand()` without `srand`: the same numbers every run.

:::opengl
- `glBlendFunc(GL_SRC_ALPHA, GL_ONE)` before the particles, back to `GL_ONE_MINUS_SRC_ALPHA` after them: blending is
  global state.
:::
:::vulkan
- A second pipeline, different only in its destination colour blend factor (`VK_BLEND_FACTOR_ONE`): binding a pipeline
  sets all its state, nothing carries over. The particle's offset and colour are push constants.
:::
:::d3d12
- A second pipeline state, different only in its destination blend (`D3D12_BLEND_ONE`): setting a pipeline state sets
  all its state, nothing carries over. The particle's offset and colour are root constants.
:::

## Postprocessing

- **The idea**: render the game into a **multisampled** colour buffer (4 samples per pixel, no depth), **resolve** it
  into a texture (each pixel the average of its samples: anti-aliased edges), and draw that texture on a screen quad
  with the post shader.
- **The effects**: **shake** – the quad moved by `cos(time · 10), cos(time · 15) · 0.01` and the **blur** kernel;
  **confuse** – texture coordinates `1 − t` (upside down, mirrored) and `1 − colour`; **chaos** – coordinates circling
  with `(sin, cos)(time) · 0.3`, a repeating texture, and the **edge detection** kernel. 9 samples 1/300 apart. Chaos
  wins over confuse; shake combines with both.
- **ShakeTime**: a hit on a solid block sets it to 0.05 s and `Shake`; `Update` counts it down – frames 86 and 87.

:::opengl
- `MSFBO` with a 4-sample `GL_RGB` renderbuffer; `FBO` with a texture; `glBlitFramebuffer(…, GL_COLOR_BUFFER_BIT,
  GL_NEAREST)` resolves (same-sized rectangles); `glBindFramebuffer(GL_FRAMEBUFFER, 0)`. The kernels are uniforms set
  once (`glUniform2fv(…, 9, (float*)offsets)`); the shaders don't care about the sample count.
:::
:::vulkan
- An off-screen render pass: a 4-sample `MSImage` (transient, storeOp DONT_CARE) and `Texture` as the subpass's
  **resolve attachment** (final layout `SHADER_READ_ONLY_OPTIMAL`); two subpass dependencies. `EndRender` ends it and
  begins the window's pass.
- Pipelines belong to a render pass and a sample count: the sprites and particles for `Effects.RenderPass` with 4
  samples, so the postprocessor is created first. Per-frame values are push constants, the kernels a uniform buffer
  (std140: `vec4` array elements). Clip space y and v point down: two signs change in the vertex shader.
:::
:::d3d12
- `MSRenderTarget` (`SampleDesc.Count` 4, its RTV in an RTV heap of its own) and a single-sample `Texture`;
  `ResolveSubresource` between barriers (`RESOLVE_SOURCE`, `RESOLVE_DEST` and back); then the back buffer's RTV
  (`Graphics.BackBufferRtv`). A flip-model swap chain can't be multisampled anyway.
- A PSO draws only into targets with its `SampleDesc.Count`: the sprite and particle shaders with 4. The per-frame
  values are root constants, the kernels `static const` arrays in the HLSL. v points down: one sign changes.
:::

## Powerups, audio and text

- **PowerUp**: a GameObject with `Type`, `Duration` and `Activated`; 60 × 20, falling at 150 px/s. Speed (+20 %),
  sticky, pass-through, pad-size-increase (+50 px), confuse, chaos; 1 in 75 for the positive ones, 1 in 15 for the
  negative ones, at a destroyed block. Duration 0: permanent.
- **`UpdatePowerUps`**: move, count down, switch the effect off unless **`IsOtherPowerUpActive`**; erase the destroyed
  and inactive ones with the **erase-remove idiom** (`std::remove_if` with a **lambda**, then `erase`).
- **Activation**: below the window → destroyed; caught by the paddle (the AABB `CheckCollision`) → `ActivatePowerUp`,
  destroyed, activated. Sticky: `Ball.Stuck = Ball.Sticky` after the paddle bounce; pass-through: no resolution on
  non-solid blocks. `ResetPlayer` switches everything off.
- **The test**: no block breaks with the fixed input, so one power-up of each kind was placed by hand; in frame 161
  the paddle catches pad-size-increase and then – wider now – confuse.
- **Audio**: no graphics API plays sound. learnopengl uses **irrKlang** (`createIrrKlangDevice`, `play2D(file, loop)`,
  `drop`; free for non-commercial use only): looping music in `Init`, effects in `DoCollisions`. Alternatives: OpenAL
  Soft, miniaudio, SDL_mixer, XAudio2 on Windows. The course can't check sound.
- **The game's text**: a y-down projection, so (x, y) is the text's top-left corner: `ypos = y + (Characters['H'].Bearing.y
  − ch.Bearing.y) · scale`. 24 pixels; "Lives:" at (5, 5), after the post-processing quad.
- **Lives**: 3; a lost ball costs one; at 0 the level is reset and the game returns to the menu.
- **The menu**: W / S choose the level (`(Level + 1) % 4`), ENTER starts; **`KeysProcessed`** makes each press count
  once, cleared on release. **Win**: `IsCompleted` → reset, chaos, `GAME_WIN`; ENTER back to the menu.
- **Final thoughts**: sprite atlases, instancing, triangle strips, space partitioning, fewer state changes.

## The same idea in three APIs

| Idea | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Misuse reported by | `glGetError`, debug output | validation layer, debug messenger | debug layer, info queue |
| Message at the guilty call | `GL_DEBUG_OUTPUT_SYNCHRONOUS` | the messenger's callback | `RegisterMessageCallback`, `SetBreakOnSeverity` |
| Naming objects | `glObjectLabel` | `vkSetDebugUtilsObjectNameEXT` | `SetName` |
| Glyphs | one `GL_RED` texture each | one `R8_UNORM` atlas image | one `R8_UNORM` atlas texture |
| A sprite's model and colour | uniforms | push constants | root constants |
| A sprite's texture | `glBindTexture` | its descriptor set | a descriptor table (heap slot) |
| Projection, y down | `glm::ortho(0, 800, 600, 0, …)` | `glm::ortho(0, 800, 0, 600, …)` | `XMMatrixOrthographicOffCenterRH(0, 800, 600, 0, …)` |
| Additive particles | `glBlendFunc` changed and reset | a second pipeline | a second PSO |
| Multisampled target | renderbuffer, 4 samples | image, `VK_SAMPLE_COUNT_4_BIT` | texture, `SampleDesc.Count` 4 |
| Resolve | `glBlitFramebuffer` | resolve attachment | `ResolveSubresource` + barriers |
| Sample count of the shaders | not needed | in the pipeline | in the PSO |
| Text quads in a frame | one quad, rewritten per character | one place each, a draw per character | one place each, a draw per line |
| Sound | another library | another library | another library (XAudio2) |

With this part done you have used what the course taught in a complete program: you know how to find a mistake when
the picture is wrong, how to draw text, and how a game is put together from a loop, sprites, collisions, particles and
effects. learnopengl's last words hold for every API: take these techniques, combine and change them, and build your
own.
