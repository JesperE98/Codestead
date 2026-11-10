# Postprocessing (Hedgerow) – tasks (Vulkan)

**Screenshot time: t = 1.45 s (frame 87)** – as the OpenGL chapter (`../../opengl/postprocessing/tasks.md`): the
frame verify.sh holds with `VERIFY_T=1.45` (the simulator runs the loop 88 times). The ball hits the solid stone (5, 9)
in frame 86 (see `collision-resolution`), which starts the shake (ShakeTime 0.05 s): it is on in frames 86 and 87 and
off from frame 88. The `confuse` and `chaos` tasks switch their effect on in Init (as a try-out line), so they show at
any time; `shake` removes that line again.

learnopengl "2D Game / Postprocessing": `post_processor.h/.cpp`, `post_processing.vs/.frag`, the PostProcessor parts of
`progress/7.game.cpp` (Effects, ShakeTime). Files: `main.cpp` (= `particles`' solution with TODOs),
**`shaders/post_processing.vert`, `shaders/post_processing.frag`** (new, built to `post_processing.vert.spv` /
`.frag.spv`; their start bodies pass the quad and the texture through and compile), the other shaders, `textures/`,
`levels/` (unchanged). See `../game-setup/tasks.md` for the fixed choices of the whole game.

**Fixed choices (as OpenGL):** learnopengl's PostProcessor as a plain struct with learnopengl's names, the global
`PostProcessor Effects;` and `float ShakeTime = 0.0f;`; `InitPostProcessor(PostProcessor& effects, VkPipeline shader,
unsigned int width, unsigned int height)` (learnopengl's constructor), `InitRenderData(PostProcessor&)` (its
`initRenderData`, an overload of the SpriteRenderer's), the free functions `BeginRender(PostProcessor&)`,
`EndRender(PostProcessor&)` and `Render(PostProcessor& effects, float time)` (an overload of `Render(Game&)`); 4 samples
per pixel; learnopengl's offsets (± 1/300), edge kernel and blur kernel; the shake in DoCollisions and its countdown in
Update after the particles. The shader's time is the game's time, frame / 60.

**Vulkan choices:**
- **The multisampled target and the "blit"** – Vulkan has no glBlitFramebuffer; vulkan-tutorial's Multisampling
  chapter resolves in the render pass instead. The PostProcessor owns an **off-screen render pass** (made in
  `createPostProcessingRenderPass`) with two attachments: a 4-sample colour image `MSImage` (learnopengl's RBO;
  `VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT | COLOR_ATTACHMENT`, storeOp DONT_CARE – only its resolved pixels matter)
  and the single-sample `Texture` (learnopengl's FBO texture; `COLOR_ATTACHMENT | SAMPLED`) as the subpass's **resolve
  attachment**: at the end of the subpass each pixel's 4 samples are averaged into it and it ends in
  `SHADER_READ_ONLY_OPTIMAL`. One `VkFramebuffer` holds both images (learnopengl's MSFBO and FBO). Two subpass
  dependencies order it against the quad that samples it. Both images are `VK_FORMAT_R8G8B8A8_UNORM` (every device
  supports 4 samples for colour attachments, so learnopengl's fixed 4 is safe; vulkan-tutorial asks
  `getMaxUsableSampleCount`). `createImage` gets vulkan-tutorial's `numSamples` parameter.
- **Pipelines belong to a render pass and a sample count**: `createPipeline` and `LoadShader` gain `VkRenderPass
  pipelineRenderPass, VkSampleCountFlagBits rasterizationSamples`. The postprocessing pipeline is made for the
  window's render pass with 1 sample; the sprite and particle pipelines for `Effects.RenderPass` with
  `VK_SAMPLE_COUNT_4_BIT` (from `render-to-texture` on – before that they still draw into the window). So in Init the
  postprocessing shader is loaded and the postprocessor set up **first**, before the sprite and particle shaders
  (learnopengl creates the postprocessor last: it does not depend on the shaders' state).
- **BeginRender / EndRender / the window's render pass**: `BeginRender` begins the off-screen pass (cleared black);
  `EndRender` ends it (the resolve – learnopengl's blit) and begins the **window's render pass** (learnopengl binds the
  default framebuffer), with `Effects.WindowRenderPass` and `Effects.WindowFramebuffer` (this frame's swap chain
  framebuffer, set by `recordCommandBuffer`); `Render(Effects, time)` draws the quad in it. `recordCommandBuffer` no
  longer begins the window's pass itself: it sets the viewport and scissor (dynamic state, valid for both passes), hands
  the command buffer to Renderer, Particles and Effects, calls `Render(Hedgerow)` and ends the window's pass.
- **The shader's values**: learnopengl's per-frame uniforms `time`, `chaos`, `confuse`, `shake` are a push constant
  block `PostProcessingConstants { float time; int chaos; int confuse; int shake; }` (bools as ints, as learnopengl's
  SetInteger). The values learnopengl sets once – `offsets[9]`, `edge_kernel[9]`, `blur_kernel[9]` – are a uniform
  buffer `PostProcessingUniforms` written once in InitPostProcessor. In a uniform block (std140) every array element
  starts at a multiple of 16 bytes, so the arrays are `vec4 offsets[9]` (`.xy` used), `ivec4 edge_kernel[9]`, `vec4
  blur_kernel[9]` (`.x` used) on both sides. The quad's descriptor set has this buffer at binding 0 and `Texture` at
  binding 1 (learnopengl's `scene`), so `createDescriptorSet` takes the buffer and its size, and the descriptor set
  layout's binding 0 is visible to the fragment stage too.
- **The y direction**: Vulkan's clip space y and texture v point down (OpenGL's up). The quad keeps learnopengl's
  vertices: (−1, −1) is Vulkan's top-left corner and gets texture coordinate (0, 0), the texture's top-left texel – the
  picture is upright, as in OpenGL. Two lines of the vertex shader therefore change sign so the effects move the
  picture the same way as OpenGL's: chaos `texture.y - cos(time) * strength` and shake `gl_Position.y -= cos(time *
  15.0) * strength`. The offsets need no change (both kernels are symmetric). GLSL 4.50 reserves `sample`: the array is
  `samples`. The else branch writes alpha 1 (`vec4(texture(scene, TexCoords).rgb, 1.0)`): the RGBA texture's alpha is
  below 1 where sprites' transparent parts were drawn, OpenGL's GL_RGB texture has no alpha.

Named points (OpenGL's; from the top-left, 800×600, frame 87, measured on lavapipe): **orange** (396,29), **blue**
(396,141), **sky** (200,250), **mid** (400,300), **hills** (400,450), **paddle** (358,588) – the paddle's left brass end;
**top-paddle** (442,12) – where the confused picture shows the paddle; **beside-paddle** (300,590); **stone** (13,209);
**ball** (496,243) – the ball's centre in frame 87; **edge-row** (100,37) – pixel row 37, which the brick edge at
y = 37.5 crosses at the pixel centres. **Every named point equals OpenGL's in every state, except edge-row before
`render-to-texture`** (Vulkan's top-left rule gives that row to the yellow brick below: 117,117,58; OpenGL's to the
orange one: 146,73,0 – see `levels`). From `render-to-texture` on the whole pictures equal OpenGL's (at most 29
pixels differ by more than 2, none by more than 24): with 4 samples the edge pixels are half one brick, half the other
in both APIs.

**Start picture** (= `particles`' end at 1.45 s): orange = 196,98,0, blue = 39,118,196, sky = 53,44,75, mid = 63,50,80,
hills = 46,52,74, paddle = 214,170,72, top-paddle = 242,121,0, beside-paddle = 30,40,46, stone = 126,126,110, ball =
194,230,181, edge-row = 117,117,58.

## post-shader
- **Task:** Write the post-processing shaders – vertex shader: chaos swirls the texture coordinates with time, confuse mirrors them, shake wobbles the position; fragment shader: chaos = edge detection, confuse = inverted colours, shake = blur, all over 9 samples at `offsets` – and their C++ structs; give `createPipeline` and `LoadShader` the render pass and the sample count, and load the shader as `"postprocessing"` for the window's render pass.
- **Hint:** learnopengl's post_processing.vs / .frag with `pc.` and `kernels.` (and the two sign changes for Vulkan's y, see above). `if (pc.chaos != 0 || pc.shake != 0) for (int i = 0; i < 9; i++) samples[i] = vec3(texture(scene, TexCoords.st + kernels.offsets[i].xy));`. `LoadShader("shaders/post_processing.vert.spv", "shaders/post_processing.frag.spv", "postprocessing", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, renderPass, VK_SAMPLE_COUNT_1_BIT);`
- **When done:** the two shader bodies (above); `struct PostProcessingConstants` and `struct PostProcessingUniforms`
  (above) before `struct UniformBufferObject`; `uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT |
  VK_SHADER_STAGE_FRAGMENT_BIT`; `createPipeline(…, VkBlendFactor dstColorBlendFactor, VkRenderPass pipelineRenderPass,
  VkSampleCountFlagBits rasterizationSamples, VkPipeline& pipeline)` with `multisampling.rasterizationSamples =
  rasterizationSamples;` and `pipelineInfo.renderPass = pipelineRenderPass;`; `LoadShader(…, VkBlendFactor
  dstColorBlendFactor, VkRenderPass pipelineRenderPass, VkSampleCountFlagBits rasterizationSamples)`; in Init the
  postprocessing LoadShader first, the sprite and particle calls with `renderPass, VK_SAMPLE_COUNT_1_BIT`. Three
  pipelines; nothing uses the new one yet: **no visible change** (start picture).

## post-processor
- **Task:** Add learnopengl's PostProcessor as a struct, with `InitRenderData` (the screen quad), `createPostProcessingRenderPass` (a 4-sample colour attachment resolved into the texture) and `InitPostProcessor` (the two images, the render pass, the framebuffer, the quad, the kernels' uniform buffer and the descriptor set); set up the global `Effects` in Init; destroy its objects in `cleanup()`.
- **Hint:** `createImage(width, height, VK_SAMPLE_COUNT_4_BIT, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT | VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT, …)` for the multisampled image, `COLOR_ATTACHMENT | SAMPLED` with 1 sample for the texture; `subpass.pResolveAttachments = &colorAttachmentResolveRef;`; the framebuffer with both views; `createDescriptorSet(effects.UniformBuffer, sizeof(PostProcessingUniforms), effects.Texture.View, textureSampler, effects.Texture.DescriptorSet);`.
- **When done:** `struct PostProcessor` (its state as learnopengl's plus the render state above) in a section
  `// PostProcessor (learnopengl: post_processor.h)`; the members `InitRenderData(PostProcessor& effects)`,
  `createPostProcessingRenderPass(PostProcessor& effects)` and `InitPostProcessor(PostProcessor& effects, VkPipeline
  shader, unsigned int width, unsigned int height)`; `createImage(uint32_t width, uint32_t height,
  VkSampleCountFlagBits numSamples, …)` (the texture loader passes `VK_SAMPLE_COUNT_1_BIT`); `createDescriptorSet(VkBuffer
  buffer, VkDeviceSize range, VkImageView textureImageView, VkSampler sampler, VkDescriptorSet& descriptorSet)` (the
  texture loader passes `uniformBuffer, sizeof(UniformBufferObject)`); `PostProcessor  Effects;`; `InitPostProcessor(Effects,
  GetShader("postprocessing"), game.Width, game.Height);` in Init right after the postprocessing LoadShader; in
  `cleanup()` the quad and kernel buffers, the framebuffer, the render pass and both images. The game still draws to
  the window: **no visible change**.

## render-to-texture
- **Task:** Write `BeginRender` (begin the off-screen pass, cleared black), `EndRender` (end it – the resolve – and begin the window's render pass) and `Render` (the quad with the post pipeline and its options as push constants); in the game's `Render` wrap the drawing in BeginRender / EndRender and then draw the quad with the time; make the sprite and particle pipelines for the off-screen pass with 4 samples, and let `recordCommandBuffer` leave the window's pass to EndRender.
- **Hint:** BeginRender / EndRender: `VkRenderPassBeginInfo` with `effects.RenderPass, effects.Framebuffer` / `effects.WindowRenderPass, effects.WindowFramebuffer` and `vkCmdBeginRenderPass`; EndRender first `vkCmdEndRenderPass(effects.commandBuffer);`. In Render(Game&): `BeginRender(Effects);` … `EndRender(Effects); Render(Effects, static_cast<float>(glfwGetTime()));`. `LoadShader(…, Effects.RenderPass, VK_SAMPLE_COUNT_4_BIT);` for sprite and particle.
- **When done:** the three functions (above) after the PostProcessor struct; `BeginRender(Effects);` before the
  background, `EndRender(Effects);` and `Render(Effects, static_cast<float>(glfwGetTime()));` after the ball, inside `if
  (game.State == GAME_ACTIVE)`; the sprite and particle LoadShader calls with `Effects.RenderPass,
  VK_SAMPLE_COUNT_4_BIT`; in `recordCommandBuffer` no `vkCmdBeginRenderPass` any more (the viewport and scissor stay),
  `Effects.commandBuffer = commandBuffer; Effects.WindowFramebuffer = swapChainFramebuffers[imageIndex];` before
  `Render(Hedgerow);`, and `vkCmdEndRenderPass` after it ends the window's pass. The game now goes through the 4×
  multisampled target and the quad – **almost no visible change**: only edges are antialiased (the sprites' rims and
  pixel rows 37, 112 and 187: edge-row = 132,95,29 instead of 117,117,58 – now the same as OpenGL's); every named point
  else as the start picture. One draw more (the quad), in a second render pass. No validation message.

## confuse
- **Task:** Try the first effect: switch `Confuse` on in Init, after the postprocessor is set up.
- **Hint:** `Effects.Confuse = true;`
- **When done:** `Effects.Confuse = true; // try the effects: …` right after the InitPostProcessor call. **The whole
  picture is upside down and mirrored, its colours inverted** (light sky at the bottom, the bricks at the bottom, the
  paddle at the top): orange = 225,215,209, blue = 209,203,181, sky = 180,199,170, mid = 192,205,175, hills =
  229,176,123, paddle = 23,139,255, top-paddle = 41,85,183 (the inverted paddle), beside-paddle = 27,141,255, stone =
  170,193,165, ball = 179,198,169, edge-row = 225,215,209.

## chaos
- **Task:** Replace the confuse line with the chaos effect.
- **Hint:** `Effects.Chaos = true;` (chaos wins over confuse in the shader anyway, but try one at a time).
- **When done:** `Effects.Chaos = true; // try the effects: …` instead of the confuse line. **Edge detection on a
  picture shifted by (sin(time), cos(time)) × 0.3** (the sampler repeats: learnopengl's Texture2D default REPEAT):
  black wherever the picture is flat, thin bright lines along the bricks' and sprites' edges, the sky's stars as dots:
  orange = 5,5,0, blue = 7,13,13, sky = 0,0,0, mid = 0,0,0, hills = 0,0,0, paddle = 0,0,0, top-paddle = 0,0,0,
  beside-paddle = 0,0,0, stone = 0,0,0, ball = 55,55,45, edge-row = 0,0,0. The picture moves with time (the same way as
  OpenGL's, thanks to the minus in the vertex shader).

## shake
- **Task:** Remove the try-out line again; instead shake the screen when the ball hits a solid block: set `ShakeTime` to 0.05 seconds and `Effects.Shake`, and in `Update` count ShakeTime down and stop the shake when it is over.
- **Hint:** In DoCollisions: `if (!box.IsSolid) box.Destroyed = true; else { ShakeTime = 0.05f; Effects.Shake = true; }`. In Update after the particles: `if (ShakeTime > 0.0f) { ShakeTime -= dt; if (ShakeTime <= 0.0f) Effects.Shake = false; }`. `float ShakeTime = 0.0f;` with the globals.
- **When done:** no `Effects.Chaos`/`Confuse` line in Init; `float ShakeTime = 0.0f;` after `PostProcessor Effects;`;
  the else branch in DoCollisions; the countdown in Update after the particles' Update. The ball hits the stone in
  frame 86: **in frame 87 the picture is blurred and moved by about (−1.4, +2.9) pixels** (down: the minus in the
  vertex shader): paddle = 181,141,61, top-paddle = 231,116,0, ball = 195,231,182, stone = 122,122,106, edge-row =
  173,87,1 (the blurred, shifted edges); flat areas almost unchanged: orange = 198,99,0, blue = 39,119,197, sky =
  52,44,75, mid = 63,50,80, hills = 46,52,74, beside-paddle = 30,40,46. (From frame 88 on the picture equals
  `render-to-texture`'s again.) The whole picture equals OpenGL's (no pixel differs by more than 1).
