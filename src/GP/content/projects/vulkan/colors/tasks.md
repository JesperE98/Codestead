# Colors (Vulkan) – a coral cube, a white light and a lamp with its own pipeline (learnopengl "Colors")

Start: the program of "Camera" turned into the lighting scene of learnopengl.com: one cube at the origin (positions
only: `struct Vertex { glm::vec3 pos; }`, learnopengl's 36 vertices), clear colour `(0.1, 0.1, 0.1, 1.0)`, no textures
(the descriptor set holds only the uniform buffer, still at **binding 2**; bindings 0 and 1 come back for the lighting
maps). The camera globals, WASD, mouse look and zoom are kept, but the default camera is
`cameraPos = (-3.0, 0.0, 3.0)`, `cameraFront = glm::normalize(glm::vec3(3.5f, 0.4f, -2.2f))`, `yaw = -32.2`,
`pitch = 5.5` ("look at the cube's lit front and the lamp from the left"), so the cube's left face, its front face
and the lamp are in view. Still one frame in flight, view + projection in the uniform buffer filled by
`updateUniformBuffer()`, the model matrix in a push constant, `glfwGetTime()` as the clock, the depth buffer.

The pipeline code is split for two pipelines: `createPipelineLayout()` (descriptor set layout + the push constant
range, shared by every pipeline) and a helper `createPipeline(const std::string& vertShaderFile, const std::string&
fragShaderFile, VkPipeline& pipeline)` with the fixed functions of before (`cullMode = VK_CULL_MODE_NONE`, depth test
on). `initVulkan()` calls it once per pipeline with the file names as string literals:
`createPipeline("shaders/colors.vert.spv", "shaders/colors.frag.spv", lightingPipeline);`. Shader files are
`shaders/<name>.vert` / `.frag`, built to `shaders/<name>.vert.spv` / `.frag.spv`. `recordCommandBuffer()` binds
`lightingPipeline`, pushes `model = glm::mat4(1.0f)` and draws the 36 vertices.

The start shows a **white** cube (colors.frag writes `vec4(1.0)`) on dark grey. Nothing in this chapter depends on
time. Colours measured on lavapipe (the same as the OpenGL version of this chapter, pixel for pixel):
- start: cube's left face (160, 370) and front face (300, 370) = white (255, 255, 255); background (400, 300),
  (640, 195), (700, 500) = (26, 26, 26).

## object-color
- **Task:** Colour the cube with the light: in `shaders/colors.frag` declare the uniform block
  (`layout(binding = 2) uniform UniformBufferObject { mat4 view; mat4 proj; vec3 objectColor; vec3 lightColor; } ubo;`)
  and write `outColor = vec4(ubo.lightColor * ubo.objectColor, 1.0);`. In C++ add `glm::vec3 objectColor; float pad1;
  glm::vec3 lightColor; float pad2;` to `UniformBufferObject`, let the fragment stage read the buffer
  (`uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`) and set
  `ubo.objectColor = glm::vec3(1.0f, 0.5f, 0.31f); ubo.lightColor = glm::vec3(1.0f, 1.0f, 1.0f);` in
  `updateUniformBuffer()`.
- **Hint:** A uniform block uses the std140 layout: a `vec3` starts at a multiple of 16 bytes (like a `vec4`), so in
  C++ a padding `float` follows each `glm::vec3`. The vertex shaders may keep declaring only the matrices: the first
  members of the same buffer.
- **When done:** the cube is coral: (160, 370) = (300, 370) = (255, 128, 79) (= (1.0, 0.5, 0.31) × white); background
  unchanged (26, 26, 26). Code: `ubo.lightColor * ubo.objectColor` in colors.frag; the struct has `objectColor` and
  `lightColor`.

## lamp-shader
- **Task:** Give the lamp its own shaders and pipeline: in `shaders/light_cube.frag` write
  `outColor = vec4(1.0);`; add a member `VkPipeline lightCubePipeline;`, create it in `initVulkan()` with
  `createPipeline("shaders/light_cube.vert.spv", "shaders/light_cube.frag.spv", lightCubePipeline);` and destroy it in
  `cleanup()` (`vkDestroyPipeline(device, lightCubePipeline, nullptr);`).
- **Hint:** The lamp must stay white whatever the colours in the uniform buffer are: a pipeline of its own with a
  fragment shader that ignores them.
- **When done:** picture unchanged (the pipeline exists but nothing is drawn with it yet): coral cube
  (255, 128, 79) at (160, 370), (300, 370); (640, 195) still background (26, 26, 26).

## lamp
- **Task:** Draw the lamp: a global `glm::vec3 lightPos(1.2f, 1.0f, 2.0f);` and in `recordCommandBuffer()` after
  the cube: `vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, lightCubePipeline);`, `model =
  glm::scale(glm::translate(glm::mat4(1.0f), lightPos), glm::vec3(0.2f))` (learnopengl's three lines), push it
  (`constants.model = model; vkCmdPushConstants(…)`) and `vkCmdDraw` the 36 vertices again.
- **Hint:** The descriptor set, the vertex buffer, the viewport and the scissor stay bound when another pipeline with
  the same layout is bound; only the pipeline and the model matrix change.
- **When done:** a small white cube (the lamp) up and to the right of the coral cube: (640, 195) = (255, 255, 255)
  (lamp spans about x 620..665, y 172..217); the coral cube unchanged (255, 128, 79) at (160, 370), (300, 370);
  background (26, 26, 26) at (400, 300), (700, 500). Two draws: the cube with `lightingPipeline`, the lamp with
  `lightCubePipeline`.
