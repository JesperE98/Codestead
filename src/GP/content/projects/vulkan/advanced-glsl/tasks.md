# Advanced GLSL (Vulkan) – built-in variables, interface blocks and a shared uniform buffer (learnopengl "Advanced GLSL")

learnopengl's "Advanced GLSL" chapter and `8.advanced_glsl_ubo`. Files: `main.cpp`, `shaders/advanced_glsl.vert` /
`.frag` (the scene), `shaders/uniform_buffer.vert` (TODOs in start) with `shaders/red.frag`, `green.frag`, `blue.frag`,
`yellow.frag` (one colour each, complete), `textures/marble.png`, `textures/metal.png`.

Start: the depth-testing scene (two marble cubes, the metal floor, camera (0, 0, 3), clear colour 0.1) in the program of
the earlier chapters, with **the face culling chapter's cube** (every face counter-clockwise seen from outside) and
learnopengl's floor (clockwise seen from above). The pipeline culls nothing (`VK_CULL_MODE_NONE`,
`VK_FRONT_FACE_CLOCKWISE`).

Pixels on lavapipe (800×600, from the top left; nothing depends on time), equal to the OpenGL chapter's. Start:
**background** (400,100) and (300,200) = 26,26,26; **cube0-centre** (193,300) = 141,140,138, **cube0-light** (150,250) =
208,204,194, **cube0-left** (110,300) = 209,206,195; **cube1** (760,250) = 163,161,156; **floor-left** (100,500) =
137,141,147, **floor-right** (600,450) = 156,160,166.

## frag-coord
- **Task:** In `advanced_glsl.frag` colour by window position: `if (gl_FragCoord.x < 400)` output red
  `vec4(1.0, 0.0, 0.0, 1.0)`, else green `vec4(0.0, 1.0, 0.0, 1.0)`.
- **Hint:** `gl_FragCoord` is the fragment's position in the window in pixels (x, y) and its depth (z). In Vulkan its
  origin is the top-left corner (OpenGL's is the bottom-left); x is the same in both.
- **When done:** everything drawn (cubes and floor) is red left of x = 400 and green right of it; the background stays
  26,26,26: **cube0-centre** (193,300) = 255,0,0, **floor-left** (100,500) = 255,0,0, **cube1** (760,250) = 0,255,0,
  **floor-right** (600,450) = 0,255,0, (400,100) = 26,26,26.

## front-facing
- **Task:** Texture front and back faces differently: in `createPipeline()` set `frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE`
  and `cullMode = VK_CULL_MODE_FRONT_BIT`; give the descriptor set layout a second combined image sampler at binding 2,
  `createDescriptorSet(textureImageView, backTextureImageView, sampler, descriptorSet)` writes it (a second image info,
  `descriptorWrites[2]`; pool: 4 image descriptors); the cubes' set gets marble (front) and metal (back), the floor's set
  metal for both. In `advanced_glsl.frag` declare `frontTexture` (binding 1) and `backTexture` (binding 2) and output
  `texture(frontTexture, …)` if `gl_FrontFacing`, else `texture(backTexture, …)`.
- **Hint:** `gl_FrontFacing` follows the pipeline's `frontFace`. The cube's faces are counter-clockwise seen from outside,
  and so on screen (the y flip in the projection keeps the picture upright – see the face culling chapter). From outside
  you only ever see front faces, so the front faces are culled: you look into the cubes, at their inside (back) faces.
  The floor is clockwise seen from above, a back face: it is drawn, with metal.
- **When done:** both cubes are open boxes whose insides are metal; the floor and background unchanged: **cube0-centre**
  (193,300) = 138,142,148 (the inside of the back face), **cube0-light** (150,250) = 166,170,176, **cube0-left** (110,300) =
  158,162,168 (the inside of the left face), **cube1** (760,250) = 129,133,139, **floor-left** (100,500) = 137,141,147,
  **floor-right** (600,450) = 156,160,166, background 26,26,26.

## interface-block
- **Task:** Pass the texture coordinates in an interface block: in `advanced_glsl.vert`
  `layout(location = 0) out VS_OUT { vec2 texCoord; } vs_out;` and `vs_out.texCoord = inTexCoord;`, in
  `advanced_glsl.frag` `layout(location = 0) in VS_OUT { vec2 texCoord; } fs_in;` and `fs_in.texCoord`.
- **Hint:** The block's name (`VS_OUT`) must be the same in both shaders, the instance names may differ. Vulkan's GLSL
  matches the stages' outputs and inputs by `location`, so the block gets one.
- **When done:** no visible change: all points as after `front-facing`. Code: `out VS_OUT` / `in VS_OUT` blocks.

## uniform-buffer
- **Task:** learnopengl's four coloured cubes sharing one uniform buffer: in `uniform_buffer.vert` declare the uniform
  block `layout(binding = 0) uniform UniformBufferObject { mat4 view; mat4 proj; } ubo;` and
  `gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);`. Replace `graphicsPipeline` with four pipelines
  `redPipeline`, `greenPipeline`, `bluePipeline`, `yellowPipeline`, each `createPipeline("shaders/uniform_buffer.vert.spv",
  "shaders/<colour>.frag.spv", 1, …)` (createPipeline gets an `attributeCount` parameter: the shaders read only the
  position); culling off again (`VK_CULL_MODE_NONE`); the floor's descriptor set is no longer needed (pool: 1 set). In
  `recordCommandBuffer()` bind `cubeDescriptorSet` once (it holds the uniform buffer at binding 0), then for each cube bind
  its pipeline, push its model matrix and draw the cube: red at (-0.75, 0.75, 0) (top-left), green (0.75, 0.75, 0)
  (top-right), yellow (-0.75, -0.75, 0) (bottom-left), blue (0.75, -0.75, 0) (bottom-right). This scene replaces the marble
  scene; the camera stays at (0, 0, 3).
- **Hint:** OpenGL needs `layout (std140) uniform Matrices`, `glUniformBlockBinding` and `glBindBufferRange` to share one
  buffer between programs. In Vulkan every pipeline already reads the uniform buffer through the descriptor set: pipelines
  with the same pipeline layout share the bound set, so the four pipelines read the same view and projection, written once
  per frame by `updateUniformBuffer()`.
- **When done (the solution):** four cubes in the colours of their shaders on the 26,26,26 background: **red** (200,150) =
  255,0,0, **green** (600,150) = 0,255,0, **yellow** (200,450) = 255,255,0, **blue** (600,450) = 0,0,255; the centre
  (400,300) and (400,100) = 26,26,26.
