# Framebuffers (Vulkan) – drawing into an image of our own, then post-processing it (learnopengl "Framebuffers")

learnopengl `5.1.framebuffers`. Files: `main.cpp`, `shaders/framebuffers.vert` / `.frag` (the scene, built to
`shaders/framebuffers.vert.spv` / `.frag.spv`), `shaders/framebuffers_screen.vert` / `.frag` (the screen quad),
`textures/marble.png`, `textures/metal.png`.

Start: the depth-testing scene of the earlier chapters drawn straight into the window (HelloTriangleApplication, one vertex
buffer – cube vertices 0..35, floor 36..41 –, `loadTexture` / `createTextureSampler` / `createDescriptorSet` helpers, one
descriptor set per texture, `createPipeline(vert, frag, pipeline)`, the model matrix in a push constant, view/projection in
the uniform buffer; camera (0, 0, 3) looking down -z, clear colour (0.1, 0.1, 0.1)). `framebuffers_screen.vert` is complete
(it passes the quad's corners through unchanged), `framebuffers_screen.frag` has a TODO.

Vulkan has no "default framebuffer" to switch away from: what learnopengl calls a framebuffer object is here an **image
of our own** (colour attachment + sampled usage) with a depth image, a **render pass** for them whose colour attachment
ends in `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, and a `VkFramebuffer` that puts them together. `recordCommandBuffer()`
then records **two render passes**: the scene into the offscreen image, then the window's pass that draws one quad with
that image as its texture. Vulkan has no `glCheckFramebufferStatus`: an incomplete framebuffer is an invalid
`vkCreateFramebuffer` call, which the validation layer reports.

Pixels measured on lavapipe, coordinates from the top left of the 800×600 window; nothing depends on time. The same
points as the depth-testing chapter: **background** (400,100) and (30,150); **cube0-centre** (193,300) (a vein),
**cube0-light** (150,250), **cube0-bottom** (193,390); **cube1** (760,250) (its left face at the right edge);
**floor-near** (100,500), (400,560) (a dark stripe), **floor-far** (600,370). Start: background 26,26,26, cube0-centre
141,140,138, cube0-light 208,204,194, cube0-bottom 193,190,182, cube1 163,161,156, floor-near 137,141,147, (400,560)
83,87,93, floor-far 130,134,140. Every picture equals the OpenGL chapter's (sharpen and edge detection: the same, except
that the kernels amplify small texture-filtering differences in the floor's fine pattern).

## offscreen-target
- **Task:** Draw the scene into an offscreen target: add `createOffscreenRenderPass()` (colour attachment
  `VK_FORMAT_R8G8B8A8_UNORM`, loadOp CLEAR, storeOp STORE, finalLayout `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, a depth
  attachment, two subpass dependencies) and `createOffscreenFramebuffer()` (the colour image with
  `VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT`, its view, a depth image and view, the framebuffer),
  create the scene's pipeline for `offscreenRenderPass` (createPipeline gets a `VkRenderPass pipelineRenderPass`
  parameter), and in `recordCommandBuffer()` record the scene in `offscreenRenderPass` / `offscreenFramebuffer` (its own
  clear values: 0.1 grey and depth 1.0), then the window's render pass, cleared to white `{1.0f, 1.0f, 1.0f, 1.0f}`, with
  nothing drawn in it yet. Destroy the new objects in `cleanup()`.
- **Hint:** A pipeline is made for one render pass (with compatible formats), so the scene's pipeline now names
  `offscreenRenderPass`. The final layout makes the render pass itself switch the image to "ready for sampling" when it
  ends; the second dependency makes the next fragment shaders wait for the scene's colour writes.
- **When done:** the window shows only its clear colour: **every point is white 255,255,255** (the scene is drawn, but
  into the offscreen image, which nothing shows yet). Code: `vkCreateRenderPass(…, &offscreenRenderPass)` with
  `finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, `vkCreateFramebuffer(…, &offscreenFramebuffer)`, two
  `vkCmdBeginRenderPass` in `recordCommandBuffer()` (first with `offscreenRenderPass`), window clear colour white.

## screen-quad
- **Task:** Draw the offscreen image on a quad that covers the window: add learnopengl's `quadVertices` to `vertices`
  (vertices 42..47, z = 0, texture coordinates unchanged), a second pipeline `screenPipeline` from
  `framebuffers_screen.vert/.frag` for the window's `renderPass` **with the depth test off** (createPipeline gets a
  `VkBool32 depthTestEnable` parameter: `VK_TRUE` for the scene, `VK_FALSE` for the quad), a descriptor set
  `createDescriptorSet(offscreenImageView, textureSampler, screenDescriptorSet)` (pool: 3 sets), and in the window's pass
  bind `screenPipeline` and `screenDescriptorSet` and `vkCmdDraw(commandBuffer, 6, 1, 42, 0)`. In
  `framebuffers_screen.frag`: `outColor = vec4(texture(screenTexture, fragTexCoord).rgb, 1.0);`.
- **Hint:** The quad's corners are already in normalized device coordinates. learnopengl's texture coordinates work
  unchanged: Vulkan's window y and an image's v both point down, so the two flips cancel. The viewport, scissor and vertex
  buffer set in the first pass still apply in the second (they are command buffer state).
- **When done:** the scene is back, unchanged: all points as at the start (cube1 (760,250) = 162,160,155).
  Code: `screenPipeline` bound and a draw of 6 vertices from vertex 42 in the window's render pass.

## inversion
- **Task:** In `framebuffers_screen.frag` invert the colours: `outColor = vec4(vec3(1.0 - texture(screenTexture, fragTexCoord)), 1.0);`.
- **Hint:** Every colour channel becomes 1.0 minus itself.
- **When done:** background 229,229,229, cube0-centre 114,115,117, cube0-light 47,51,61, cube0-bottom 62,65,73, cube1
  93,95,100, floor-near 118,114,108, (400,560) 172,168,162, floor-far 125,121,115.

## grayscale
- **Task:** Replace the inversion with learnopengl's weighted grayscale: `average = 0.2126 * r + 0.7152 * g + 0.0722 * b`,
  `outColor = vec4(average, average, average, 1.0)`.
- **Hint:** The human eye is most sensitive to green and least to blue, so green weighs most.
- **When done:** grey values (r = g = b): background 26, cube0-centre 140, cube0-light 204, cube0-bottom 190, cube1 160,
  floor-near 141, (400,560) 87, floor-far 134.

## sharpen
- **Task:** Replace the grayscale with learnopengl's 3×3 kernel: `const float offset = 1.0 / 300.0;`, the nine `offsets`,
  the kernel `-1 -1 -1 / -1 9 -1 / -1 -1 -1`, sample the nine neighbours and sum them weighted.
- **Hint:** In Vulkan v points down in an image, so the row above is `-offset` (the comments of the offsets say so); this
  kernel is symmetric, so the picture is the same either way.
- **When done:** edges and the marble's veins are strongly emphasised: background 26,26,26, cube0-centre 0,0,1 (the vein
  turns black), cube0-light 201,196,191, cube0-bottom 253,249,235, cube1 88,88,94, floor-near 134,138,144, (400,560)
  84,88,94, floor-far 107,111,117. The two bottom rows turn light (≈ 247 at (400,598)) and the two top rows dark (0 at
  (400,0)): at the borders the samples wrap round to the other side of the image (the sampler repeats, like OpenGL's
  default GL_REPEAT).

## blur
- **Task:** Change the kernel to learnopengl's blur: `1 2 1 / 2 4 2 / 1 2 1`, each divided by 16.
- **Hint:** The weights add up to 1, so the brightness stays the same.
- **When done:** a softened picture: background 26,26,26, cube0-centre 155,153,150 (the vein is blurred), cube0-light
  209,205,194, cube0-bottom 188,185,178, cube1 169,167,161, floor-near 137,141,147, (400,560) 83,87,93, floor-far 132,136,142.

## edge-detection
- **Task:** Change the kernel to learnopengl's edge detection: `1 1 1 / 1 -8 1 / 1 1 1`.
- **Hint:** Where all nine samples are equal the sum is 0 (black); only edges stay bright.
- **When done (the solution):** almost everything black, edges bright: background 0,0,0, cube0-centre 159,154,137 (the
  edge of a vein), cube0-light 7,8,3, cube0-bottom 0,0,0, cube1 75,72,61, floor-near 3,3,3, (400,560) 0,0,0, floor-far
  23,23,23; the cubes' outlines and the horizon are white lines; the two top rows are light (≈ 150..165 at (400,0) and
  (400,1)), where the samples wrap round to the floor at the bottom.
