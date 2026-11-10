# HDR (Vulkan) – tasks

learnopengl "HDR": `src/5.advanced_lighting/6.hdr`. Files: `main.cpp`, `textures/wood.png`, and in `shaders/` (each
built to `<name>.spv`): `lighting.vert/.frag` (learnopengl's 6.lighting – the tunnel's lighting), `hdr.vert` (complete:
the screen quad) and `hdr.frag` (its `main` is a TODO).

**Fixed choices (the same in every API):**
- **Camera: (0, 0, 5) looking down +z – yaw = +90°** (cameraFront (0, 0, 1), pitch 0, fov 45, 800/600, near 0.1, far
  100; `GLM_FORCE_DEPTH_ZERO_TO_ONE` and `proj[1][1] *= -1` as always). learnopengl's hdr demo starts at (0, 0, 5) with
  its Camera looking down -z; that shows only the tunnel's near end wall (z = -2.5, almost black). The tunnel and its
  bright end (z = 52.5) lie in +z, so the course turns the camera round.
- Scene: one vertex buffer with learnopengl's `renderCube()` cube (vertices 0..35: 2×2×2, position + normal + texcoords,
  v flipped (1 - v) as in the earlier chapters so the image is upright). The tunnel: model = translate(0, 0, 25) ·
  scale(2.5, 2.5, 27.5) – from z = -2.5 to 52.5, ±2.5 in x/y –, drawn in `recordCommandBuffer()` with
  `vkCmdPushConstants` (`struct PushConstants { glm::mat4 model; VkBool32 inverse_normals; }`, vertex stage;
  `inverse_normals = VK_TRUE`: the vertex shader negates the normal so the inside is lit – a GLSL `bool` in a block is 4
  bytes, VkBool32) and `vkCmdDraw(commandBuffer, 36, 1, 0, 0)`. No culling, depth test on, clear (0.1, 0.1, 0.1) (never
  visible: the tunnel fills the window).
- `wood.png` loaded as an **sRGB texture**: `loadTexture("textures/wood.png", VK_FORMAT_R8G8B8A8_SRGB, …)` (the image
  and its view are `_SRGB`: sampling decodes the gamma-encoded colours to linear ones – learnopengl's `GL_SRGB`), REPEAT,
  descriptor set `woodDescriptorSet` (uniform buffer at binding 0, texture at binding 1).
- Four lights (learnopengl's), the globals `const std::vector<glm::vec3> lightPositions` = (0, 0, 49.5), (-1.4, -1.9, 9),
  (0, -1.8, 4), (0.8, -1.7, 6) and `lightColors` = (200, 200, 200), (0.1, 0, 0), (0, 0, 0.2), (0, 0.1, 0), copied in
  `updateUniformBuffer()` (a `for` loop) into the uniform buffer: `glm::vec4 lightPositions[4]; glm::vec4
  lightColors[4];` – **std140: array elements are 16 bytes apart, so vec4s** (only xyz used) –, then `glm::vec3
  viewPos;` + `float pad1;`. `lighting.frag`: no ambient (0.0 × colour), diffuse `ubo.lightColors[i].rgb *
  max(dot(lightDir, normal), 0.0) * color`, attenuation `1.0 / (distance * distance)`, no specular, a loop over 4 lights
  (learnopengl declares 16 and sets 4; the other 12 are zero and add nothing).
- **Start:** the scene drawn straight into the window (the swap chain image, `B8G8R8A8_UNORM`, 8 bits per channel);
  `lighting.frag` gamma-corrects its result itself (`pow(ambient + lighting, vec3(1.0 / 2.2))`, as in the
  gamma-correction chapter). The window stores 0..1, so the far end (values far above 1) clips to plain white.
- No input: learnopengl toggles HDR with Space and changes the exposure with Q/E – the tasks switch the code instead;
  `exposure` is a fixed 1.0.
- The `createPipeline(vertFile, fragFile, pipelineRenderPass, pipeline)` helper takes the render pass the pipeline is
  made for (a pipeline only works in a render pass with the same attachment formats).

**What the camera sees:** the inside of the long wooden tunnel in perspective – the boards of the four walls run
towards the centre – and its far end (z = 52.5) as a small square in the middle of the window (x ≈ 355..445,
y ≈ 255..345), lit by the 200-strength back light 3 units in front of it. The walls get brighter towards the far end
(a glow around the square); near the camera they are very dark, with a faint red tint in the bottom-right corner (the
red light at (-1.4, -1.9, 9) – the window's right side shows the tunnel's -x wall, since the camera looks down +z).
The blue and green lights are too weak to see.

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. Every
picture equals the OpenGL chapter's (mean difference 0.1/255; fewer than 0.1 % of the pixels differ by more than 24 – the
end's top edge and the glow, where the anisotropic sampler filters the steep walls a little differently: end-edge and
glow are up to 11 brighter than OpenGL's). Named points (the same as OpenGL's): **end-centre** (400,300), **end-1**
(370,270), **end-2** (420,280), **end-3** (400,340), **end-edge** (400,255) (the far end's top edge), **glow** (350,300)
(the walls just outside the end square), **wall-near-end** (330,300), **ceiling** (400,100), **floor** (400,560),
**wall-right** (600,300), **floor-left** (100,500), **red-corner** (760,560).

**Start picture:** the far end **clipped to flat white**: end-centre = 255,255,255, end-2 = 255,255,255, end-3 =
255,255,255, end-1 = 255,255,211, end-edge = 255,235,148 (red and green clip, the wood's blue does not); ≈ 2,490 pure
white pixels, ≈ 8,300 pixels with red = 255; ≈ 350 distinct colours in the end square (x 355..444, y 255..344) – the
wood's boards are lost in the white. glow = 158,109,68, wall-near-end = 41,28,18, ceiling = 10,7,4, floor = 9,6,4,
wall-right = 9,7,4, floor-left = 24,15,9, red-corner = 38,14,9.

## float-buffer
- **Task:** Render the scene into an off-screen target whose colour image is a floating-point image (`VK_FORMAT_R16G16B16A16_SFLOAT`, values above 1.0 are kept) with its own depth image, then draw that image on a screen quad into the window with `hdr.frag`, which only gamma-corrects. Move the gamma correction from `lighting.frag` to `hdr.frag`.
- **Hint:** The screen quad: learnopengl's `quadVertices` as 6 vertices (36..41) with texture coordinates unchanged. `createHdrRenderPass()`: like `createRenderPass()` but the colour attachment's format is `VK_FORMAT_R16G16B16A16_SFLOAT`, storeOp STORE, finalLayout `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, plus two subpass dependencies (the last frame's shader reads before this pass writes; this pass's colour writes before the screen quad's reads). `createHdrFramebuffer()`: `createImage(…, VK_FORMAT_R16G16B16A16_SFLOAT, …, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, …)`, a depth image (`findDepthFormat()`), their views, and `vkCreateFramebuffer` with `hdrRenderPass`. The scene's pipeline is now made for `hdrRenderPass`; `hdrPipeline` (hdr.vert / hdr.frag) for the window's `renderPass`. `hdrDescriptorSet` = `createDescriptorSet(hdrColorImageView, textureSampler, …)` (the pool needs 2 sets). In `recordCommandBuffer()`: render pass 1 with `hdrRenderPass` / `hdrFramebuffer` around the tunnel, then render pass 2 (the window) with `hdrPipeline`, `hdrDescriptorSet` and `vkCmdDraw(commandBuffer, 6, 1, 36, 0)`. `lighting.frag` writes `outColor = vec4(ambient + lighting, 1.0);`; `hdr.frag`: `vec3 hdrColor = texture(hdrBuffer, fragTexCoord).rgb; vec3 result = pow(hdrColor, vec3(1.0 / gamma));`.
- **When done:** `main.cpp`: the screen quad (vertices 36..41); the members `hdrRenderPass`, `hdrPipeline`,
  `hdrColorImage` / `hdrColorImageMemory` / `hdrColorImageView`, `hdrDepthImage` / `hdrDepthImageMemory` /
  `hdrDepthImageView`, `hdrFramebuffer`, `hdrDescriptorSet`; `createHdrRenderPass()` (`vkCreateRenderPass(…,
  &hdrRenderPass)`, colour format `VK_FORMAT_R16G16B16A16_SFLOAT`, `finalLayout =
  VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, a depth attachment); `createHdrFramebuffer()` (the colour image with
  `VK_FORMAT_R16G16B16A16_SFLOAT` and `VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT`, the depth image,
  `vkCreateFramebuffer(…, &hdrFramebuffer)`); `createPipeline("shaders/lighting.vert.spv", "shaders/lighting.frag.spv",
  hdrRenderPass, graphicsPipeline)` and `createPipeline("shaders/hdr.vert.spv", "shaders/hdr.frag.spv", renderPass,
  hdrPipeline)`; `createDescriptorSet(hdrColorImageView, textureSampler, hdrDescriptorSet)` (pool: 2 uniform buffers, 2
  samplers, `maxSets = 2`); in `recordCommandBuffer()` two `vkCmdBeginRenderPass` – the first with `hdrRenderPass` /
  `hdrFramebuffer` (clear 0.1 and depth 1.0) around the tunnel's draw, the second with the window's `renderPass`,
  `hdrPipeline`, `hdrDescriptorSet` and `vkCmdDraw(commandBuffer, 6, 1, 36, 0)`; everything destroyed in `cleanup()`.
  `lighting.frag` ends with `outColor = vec4(ambient + lighting, 1.0);` (no `pow`); `hdr.frag` reads `hdrBuffer` and
  writes `pow(hdrColor, vec3(1.0 / gamma))`. **No visible change:** the picture is the start's (every named point as in
  the start, end-centre still 255,255,255; 577 pixels differ by more than 2, all on the dark seams between the boards
  next to the bright end, where the screen quad's linear filter mixes in a little of a much brighter neighbour – those
  values are above 1.0 now) – the image now holds values above 1.0, but nothing maps them into 0..1 yet, so the window
  still clips them. end-edge 255,239,150.

## reinhard
- **Task:** Tone-map the HDR colour with Reinhard before the gamma correction: `hdrColor / (hdrColor + 1.0)` maps 0..∞ into 0..1.
- **Hint:** In `hdr.frag`: `vec3 result = hdrColor / (hdrColor + vec3(1.0));` then `result = pow(result, vec3(1.0 / gamma));`.
- **When done:** `hdr.frag` has `vec3 result = hdrColor / (hdrColor + vec3(1.0));` followed by `result = pow(result,
  vec3(1.0 / gamma));`. **The far end shows its wood again** – no pixel is pure white any more (0 white pixels, 0 with
  red = 255; ≈ 580 distinct colours in the end square): end-centre = 243,231,201, end-1 = 232,209,168, end-2 =
  240,223,188, end-3 = 248,239,216, end-edge = 212,180,133, glow = 138,102,67 (was 158,109,68). The dark rest of the
  tunnel is unchanged (x / (x + 1) ≈ x for small x): wall-near-end 40,28,18, ceiling 10,7,4, floor 9,6,4, wall-right
  9,7,4, floor-left 24,15,9, red-corner 38,14,9. ≈ 11,900 pixels change, all in x 343..456, y 243..356 (the end and its
  glow); the mean red drops from 30.1 to 29.5.

## exposure
- **Task:** Replace Reinhard with learnopengl's exposure tone mapping `1.0 - exp(-hdrColor * exposure)`, with an `exposure` value of 1.0 set from the program through the uniform buffer (keep the Reinhard line as a comment).
- **Hint:** `main.cpp`: a global `float exposure = 1.0f;`; in `UniformBufferObject` the 4 bytes after `viewPos` (`pad1`) become `float exposure;` (std140 puts a float right after a vec3); `ubo.exposure = exposure;` in `updateUniformBuffer()`. `hdr.frag`: the uniform block (binding 0, the same members up to `float exposure`) and `vec3 result = vec3(1.0) - exp(-hdrColor * ubo.exposure);`. The descriptor set layout already makes the uniform buffer visible to the fragment stage, and `hdrDescriptorSet` already has it at binding 0.
- **When done:** `main.cpp`: the global `float exposure = 1.0f;`, `float exposure;` in place of `float pad1;` in
  `UniformBufferObject`, `ubo.exposure = exposure;` in `updateUniformBuffer()`; `hdr.frag`: `layout(binding = 0) uniform
  UniformBufferObject { …; vec3 viewPos; float exposure; } ubo;`, the Reinhard line commented out (`// vec3 result =
  hdrColor / (hdrColor + vec3(1.0));`) and `vec3 result = vec3(1.0) - exp(-hdrColor * ubo.exposure);`, then the gamma
  correction – learnopengl's 6.hdr.fs without the `hdr` toggle. The far end is **brighter than with Reinhard but still
  shows its boards** (no pure white pixel; ≈ 3,700 pixels with red = 255 where the end is brightest; ≈ 570 distinct
  colours in the end square): end-centre = 255,253,226, end-1 = 253,236,183, end-2 = 255,249,209, end-3 = 255,255,243,
  end-edge = 238,199,140, glow = 147,105,67; the dark rest unchanged (wall-near-end 40,28,18, ceiling 10,7,4, floor
  9,6,4, wall-right 9,7,4, floor-left 24,15,9, red-corner 38,14,9). ≈ 10,500 pixels differ from `reinhard`, all in
  x 346..454, y 247..353. This is the solution.
- With exposure 1.0 the result is close to Reinhard; the parameter is the point: a **higher exposure** (e.g. 5.0)
  brightens the dark tunnel walls and lets the far end saturate again – it shows the dark parts; a **lower exposure**
  (e.g. 0.1) darkens the walls to black and brings out the far end's boards – it shows the bright parts. learnopengl
  changes it with Q/E at run time; here try other values for the global `exposure`.
- **Hardware alternative** (not used): an `_SRGB` swap chain format would do the final gamma step for us; the course's
  projects use `B8G8R8A8_UNORM` (see the gamma-correction chapter), so `hdr.frag` does it like learnopengl.
