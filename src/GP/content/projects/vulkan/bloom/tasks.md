# Bloom (Vulkan) – tasks

learnopengl "Bloom": `src/5.advanced_lighting/7.bloom`. Files: `main.cpp`, `textures/wood.png`,
`textures/container2.png`, and in `shaders/` (each built to `<name>.spv`): `bloom.vert/.frag` (the scene's lighting),
`light_box.frag` (the light cubes, with `bloom.vert`), `blur.vert` (complete: the screen quad) / `blur.frag` (the
Gaussian blur: its push constants and `main` are TODOs), `bloom_final.vert/.frag` (the screen quad's tone mapping).

**Fixed choices (the same in every API):**
- Camera: (0, 0, 5) looking down -z (yaw -90, pitch 0, fov 45, 800/600, near 0.1, far 100) – learnopengl's. Clear
  (0.0, 0.0, 0.0) in every render pass that clears, depth test on, no culling.
- Scene (learnopengl's bloom.cpp, all with the `renderCube()` cube – vertices 0..35 of the one vertex buffer, 2×2×2,
  v flipped): the floor cube translate(0, -1, 0) · scale(12.5, 0.5, 12.5) with `wood.png`; six boxes with
  `container2.png`: (0, 1.5, 0) scale 0.5; (2, 0, 1) scale 0.5; (-1, -1, 2) rotate 60° about normalize(1, 0, 1) (no
  scale); (0, 2.7, 4) rotate 23° about normalize(1, 0, 1) scale 1.25; (-2, 1, -3) rotate 124° about normalize(1, 0, 1)
  (no scale); (-3, 0, 0) scale 0.5. Both textures loaded as **sRGB** (`loadTexture(…, VK_FORMAT_R8G8B8A8_SRGB, …)`),
  REPEAT (`textureSampler`), one descriptor set per texture (`woodDescriptorSet`, `containerDescriptorSet`: uniform
  buffer at binding 0, texture at binding 1) bound with `vkCmdBindDescriptorSets` before the draws that use it.
- Four lights: the globals `lightPositions` (0, 0.5, 1.5), (-4, 0.5, -3), (3, 0.5, 1), (-0.8, 2.4, -1) and
  `lightColors` (5, 5, 5), (10, 0, 0), (0, 0, 15), (0, 5, 0), copied into the uniform buffer in
  `updateUniformBuffer()` (`glm::vec4 lightPositions[4]; glm::vec4 lightColors[4];` – std140 array elements are 16
  bytes apart –, `glm::vec3 viewPos; float exposure;`). `bloom.frag`: no ambient, diffuse with `1.0 / (distance *
  distance)`, no specular. The light cubes: translate(lightPositions[i]) · scale(0.25) in learnopengl's `for` loop in
  `recordCommandBuffer()`, drawn with `lightPipeline` (`bloom.vert` + `light_box.frag`: `outColor =
  vec4(pc.lightColor, 1.0)`).
- Push constants: `struct PushConstants { glm::mat4 model; glm::vec3 lightColor; }` (+ `VkBool32 horizontal;` from
  the `blur` task) – one range for the vertex **and** fragment stages (the model matrix for `bloom.vert`, the light
  colour for `light_box.frag`, the blur direction for `blur.frag`), so every `vkCmdPushConstants` passes
  `VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`. Push constants are laid out like std430: the vec3 sits
  right after the mat4 (offset 64), the bool after it (offset 76).
- Exposure 1.0 (the global `exposure`, in the uniform buffer), tone mapping as learnopengl's bloom_final.fs: `result =
  vec3(1.0) - exp(-hdrColor * ubo.exposure)`, then `pow(result, vec3(1.0 / 2.2))`.
- **Start** = the hdr chapter's end state with this scene: the scene rendered into one `VK_FORMAT_R16G16B16A16_SFLOAT`
  colour image (`hdrColorImage`) + a depth image (`hdrRenderPass`, `hdrFramebuffer`), then tone-mapped to the window by
  `bloomFinalPipeline` (`bloom_final.frag`, sampler `scene` at binding 1) on the screen quad (vertices 36..41). The
  floating point images are sampled with `colorBufferSampler`: LINEAR, `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`
  (learnopengl: "we clamp to the edge as the blur filter would otherwise sample repeated texture values!").
- What the window shows in the intermediate tasks: after `bright-pass` the final quad samples the **bright image**
  (colour attachment 1) instead of the scene, after `blur` the **blurred bright image** – both through the same
  bloom_final tone mapping + gamma (only the descriptor set bound for the final pass changes: `hdrDescriptorSet` →
  `brightDescriptorSet` → `pingpongDescriptorSets[!horizontal]` → `bloomDescriptorSet`). After `combine` the scene
  plus the blurred bright image, tone-mapped.
- Blur: learnopengl's ping-pong targets (two `VK_FORMAT_R16G16B16A16_SFLOAT` 800×600 images, no depth), `amount = 10`
  render passes starting horizontal, the first one reading the bright image; weights 0.2270270270, 0.1945945946,
  0.1216216216, 0.0540540541, 0.0162162162; texel offset `1.0 / textureSize(image, 0)`. The final pass reads the last
  one written: `pingpongImages[0]` (the result of a vertical pass).
- No input: learnopengl toggles bloom with Space and the exposure with Q/E; there is no `bloom` flag – the `combine`
  task adds the bloom for good.
- The pipeline helper: `createPipeline(vertFile, fragFile, pipelineRenderPass, pipeline)` in the start (from the hdr
  chapter); the `bright-pass` task adds a `colorAttachmentCount` parameter.

**What the camera sees:** the wooden floor in front, the big container (-1, -1, 2) as a large wedge in the lower left
(its wooden face lit from the right by the white light), behind it the container (-3, 0, 0) with a green-lit top, the
container (0, 1.5, 0) at the top centre and (2, 0, 1) on the right; the **white light cube** in the middle above the
centre (x ≈ 348..452, y ≈ 145..250) and the **green light cube** at the top edge (x ≈ 265..320, y 0..55). The red and
blue light cubes are outside the view (left and right); their light colours the floor and the boxes' sides. The
container (0, 2.7, 4) is above the camera, out of view.

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. Every
picture equals the OpenGL chapter's (mean difference ≤ 0.25/255, ≤ 0.13 % of the pixels differ by more than 24 – edges
of the steel frames at grazing angles, where the anisotropic sampler filters slightly differently). Named points:
**white-cube** (400,200), **green-cube** (290,20), **green-glow** (322,20) (just right of the green cube, on the steel
frame of the box behind it), **glow-right** (459,200) and **glow-below** (400,256) (black background just outside the white cube),
**wedge-edge** (420,370) (the big container's steel edge facing the white light), **wedge-wood** (250,300), **box-top**
(400,60) (container (0, 1.5, 0)), **box-right** (675,300) (container (2, 0, 1)), **green-top** (200,150) (the green-lit
top of container (-3, 0, 0)), **floor** (600,450), **floor-near** (400,560), **background** (600,100).

**Start picture:** the scene tone-mapped, no glow – the light cubes have hard edges: white-cube 254,254,254, green-cube
0,254,0, green-glow 144,145,157 (the steel frame of the box behind it), glow-right 0,0,0, glow-below 0,0,0, wedge-edge 205,207,229, wedge-wood
170,122,79, box-top 166,117,71, box-right 169,120,66, green-top 68,114,36, floor 171,129,95, floor-near 47,35,27,
background 0,0,0.

## bright-pass
- **Task:** Give the floating point target a second colour attachment (the bright image) and write into it, from `bloom.frag` and `light_box.frag`, the fragments brighter than 1.0 (`dot(color, vec3(0.2126, 0.7152, 0.0722)) > 1.0`, else black); show the bright image on the screen quad.
- **Hint:** Vulkan's multiple render targets: the render pass gets a second colour attachment like the first (`VkAttachmentDescription brightAttachment = colorAttachment;`), the subpass two colour references (`colorAttachmentCount = 2`, attachments 0 and 1; the depth becomes attachment 2), the framebuffer three image views (`hdrColorImageView, brightColorImageView, hdrDepthImageView`), the pass three clear values. A pipeline needs one blend state per colour attachment: `createPipeline(…, uint32_t colorAttachmentCount, …)` with `std::array<VkPipelineColorBlendAttachmentState, 2>` and `colorBlending.attachmentCount = colorAttachmentCount;` – 2 for the scene's pipelines, 1 for the final one. In the shaders: `layout(location = 1) out vec4 brightColor;` (location n = colour attachment n – learnopengl's `glDrawBuffers`). `brightDescriptorSet` = `createDescriptorSet(brightColorImageView, colorBufferSampler, …)` (pool: 4 sets), bound for the final pass instead of `hdrDescriptorSet`.
- **When done:** `main.cpp`: `brightColorImage` / `brightColorImageMemory` / `brightColorImageView` created in
  `createHdrFramebuffer()` like the colour image (`VK_FORMAT_R16G16B16A16_SFLOAT`, colour attachment + sampled) and
  destroyed in `cleanup()`; `createHdrRenderPass()` with three attachments (`colorAttachment, brightAttachment,
  depthAttachment`), `std::array<VkAttachmentReference, 2> colorAttachmentRefs` (attachments 0 and 1),
  `subpass.colorAttachmentCount = 2`, the depth reference at attachment 2; the framebuffer with three views;
  `createPipeline` with a `colorAttachmentCount` parameter and an array of two blend attachment states
  (`colorBlending.attachmentCount = colorAttachmentCount`), called with 2 for `graphicsPipeline` / `lightPipeline` and 1
  for `bloomFinalPipeline`; `brightDescriptorSet` (pool 4 uniform buffers, 4 samplers, `maxSets = 4`);
  `std::array<VkClearValue, 3> hdrClearValues` (two black colours, depth 1.0); the final pass binds
  `brightDescriptorSet`. `bloom.frag` and `light_box.frag`: `layout(location = 1) out vec4 brightColor;`, `float
  brightness = dot(…, vec3(0.2126, 0.7152, 0.0722));` and `brightColor = vec4(…, 1.0)` if `brightness > 1.0`, else
  `vec4(0.0, 0.0, 0.0, 1.0)`. The window shows **only the bright parts** on black, through the tone mapping: the light
  cubes (white-cube 254,254,254, green-cube 0,254,0; the green cube's brightness is 5 × 0.7152 = 3.6 > 1), the steel
  edge of the big container facing the white light (wedge-edge 205,207,229) and many small dots – the steel rivets of
  the frames where the white light falls on them; everything else black: green-glow, glow-right, glow-below,
  wedge-wood, box-top, box-right, green-top, floor, floor-near, background all 0,0,0. ≈ 23,800 pixels brighter than 8,
  ≈ 13,500 of them white. The edges are still hard.

## blur
- **Task:** Blur the bright image with learnopengl's two-pass Gaussian blur: two floating point ping-pong targets and 10 render passes that draw the screen quad into one target while sampling the other (the first pass samples the bright image), alternating horizontal and vertical; show the blurred image on the screen quad.
- **Hint:** `createBlurRenderPass()`: one `VK_FORMAT_R16G16B16A16_SFLOAT` colour attachment, loadOp `DONT_CARE` (the quad writes every pixel), storeOp STORE, initialLayout UNDEFINED, finalLayout `SHADER_READ_ONLY_OPTIMAL`, no depth, two subpass dependencies (the earlier pass's shader reads before this pass's writes; this pass's writes before the next pass's shader reads). `createPingpongFramebuffers()`: in a `for (unsigned int i = 0; i < 2; i++)` loop an image (colour attachment + sampled), its view and a framebuffer for `blurRenderPass`. `blurPipeline` = `createPipeline("shaders/blur.vert.spv", "shaders/blur.frag.spv", blurRenderPass, 1, …)`. `pingpongDescriptorSets[i]` with `colorBufferSampler` (pool 6 sets). `PushConstants` gets `VkBool32 horizontal;`. In `recordCommandBuffer()` after the scene's pass, learnopengl's loop: `bool horizontal = true, first_iteration = true; unsigned int amount = 10;` and for each pass `vkCmdBeginRenderPass` with `pingpongFramebuffers[horizontal]`, `blurPipeline`, `constants.horizontal = horizontal;` + `vkCmdPushConstants`, the set `first_iteration ? brightDescriptorSet : pingpongDescriptorSets[!horizontal]`, the quad, `vkCmdEndRenderPass`, then `horizontal = !horizontal; if (first_iteration) first_iteration = false;`. The final pass binds `pingpongDescriptorSets[!horizontal]`. `blur.frag`: the push constant block up to `bool horizontal`, and learnopengl's 9-tap loops (`const float weight[5]` – GLSL for Vulkan has no uniform initialisers).
- **When done:** `main.cpp`: `blurRenderPass` (`createBlurRenderPass()`, one colour attachment, `loadOp =
  VK_ATTACHMENT_LOAD_OP_DONT_CARE`, `finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, no depth), `blurPipeline`,
  `VkImage pingpongImages[2]`, `VkDeviceMemory pingpongImageMemories[2]`, `VkImageView pingpongImageViews[2]`,
  `VkFramebuffer pingpongFramebuffers[2]` (`createPingpongFramebuffers()`), `VkDescriptorSet pingpongDescriptorSets[2]`
  (pool 6 / 6, `maxSets = 6`), `VkBool32 horizontal;` in `PushConstants`, everything destroyed in `cleanup()`; in
  `recordCommandBuffer()` the loop of 10 render passes with `blurRenderPass` / `pingpongFramebuffers[horizontal]`,
  `blurPipeline`, the push constants and the descriptor set as above; the final pass binds
  `pingpongDescriptorSets[!horizontal]`. `blur.frag`: `layout(push_constant) uniform PushConstants { mat4 model; vec3
  lightColor; bool horizontal; } pc;`, `vec2 tex_offset = 1.0 / textureSize(image, 0);`, `result =
  texture(image, fragTexCoord).rgb * weight[0]` plus the 4 texels on each side along x (`pc.horizontal`) or y. The window
  shows the **bright parts blurred**: soft glowing edges around the light cubes and the steel edge, the rivets as soft
  dots: white-cube 254,254,254 (its middle stays saturated), green-cube 0,254,0, green-glow 0,220,0 (the green cube's halo), glow-right 200,200,200, glow-below 181,181,181, wedge-edge 179,181,206, the rest still black (wedge-wood, box-top, box-right, green-top, floor,
  floor-near, background 0,0,0). Along row 200 to the right of the white cube: x 457, 459, 461, 463, 465, 467, 469 =
  233, 200, 148, 93, 49, 22, 8 (a smooth fall-off, was a step from 254 to 0). ≈ 50,400 pixels brighter than 8.

## combine
- **Task:** Combine: in `bloom_final.frag` add the blurred bright image (a second texture, `bloomBlur`) to the scene's colour before the tone mapping – the light cubes glow.
- **Hint:** The descriptor set layout gets binding 2 (a combined image sampler for the fragment stage); a new descriptor set `bloomDescriptorSet` with the uniform buffer, the scene (`hdrColorImageView`, binding 1) and the blur's result (`pingpongImageViews[0]` – the 10 passes end there, so the set can be made once at start-up; binding 2) – write a `createBloomDescriptorSet(sceneImageView, bloomBlurImageView, sampler, descriptorSet)` with three descriptor writes. A pool hands out what the layout has for each set: 7 sets now take 7 uniform buffers and **14** samplers (binding 2 stays empty in all but the final set – fine, as long as no shader using those sets reads it). The final pass binds `bloomDescriptorSet`. `bloom_final.frag`: `layout(binding = 2) uniform sampler2D bloomBlur;`, `vec3 bloomColor = texture(bloomBlur, fragTexCoord).rgb; hdrColor += bloomColor; // additive blending`.
- **When done:** `main.cpp`: `bloomBlurLayoutBinding` (binding 2, `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`, fragment
  stage) in `createDescriptorSetLayout()`; pool 7 uniform buffers / 14 samplers, `maxSets = 7`;
  `createBloomDescriptorSet()` (three `VkWriteDescriptorSet`s: binding 0 the uniform buffer, 1 the scene, 2 the blurred
  image) called as `createBloomDescriptorSet(hdrColorImageView, pingpongImageViews[0], colorBufferSampler,
  bloomDescriptorSet)`; the final pass binds `bloomDescriptorSet` (`hdrDescriptorSet` from the start is no longer bound – the scene now
  comes through `bloomDescriptorSet`). `bloom_final.frag`: `layout(binding = 2) uniform
  sampler2D bloomBlur;`, `vec3 bloomColor = texture(bloomBlur, fragTexCoord).rgb;` and `hdrColor += bloomColor;`
  before the tone mapping – learnopengl's bloom_final.fs with bloom always on. The scene is back with **glowing light
  cubes and a glowing steel edge**: white-cube 255,255,255, green-cube 0,255,0, green-glow 144,231,157 (was 144,145,157
  in the start: the green halo added), glow-right 200,200,200, glow-below 181,181,181 (both 0,0,0 in the start), wedge-edge 229,231,246 (was
  205,207,229); where nothing is bright the scene is unchanged: wedge-wood 170,122,79, box-top 166,117,71, box-right
  169,120,66, green-top 68,114,36, floor 171,129,95, floor-near 47,35,27, background 0,0,0. ≈ 28,300 pixels differ from
  the start by more than 2, all in x 140..723, y 0..405. This is the solution.
