# Shaders (Vulkan)

Start: the Hello Triangle program of the introduction (orange triangle on teal, vertex buffer with
`glm::vec3 pos` only). The shaders live in `shaders/shader.vert` and `shaders/shader.frag`. The tasks change a
finished program, so there are no `// TODO:` lines: the edits replace existing code.

Final program (solution): vertex colours in the vertex buffer, the triangle upside down, moved 0.5 to the right by a
push constant, and coloured with its (vertex-buffer) position.

## in-out
- **Task:** Pass a colour from the vertex shader to the fragment shader: in `shader.vert` declare
  `layout(location = 0) out vec4 vertexColor;` and set it to `vec4(0.5, 0.0, 0.0, 1.0)`; in `shader.frag` declare
  `layout(location = 0) in vec4 vertexColor;` and write it to `outColor`.
- **Hint:** An output and an input match by `location` (and type), not by name.
- **When done:** the triangle is dark red RGB (128, 0, 0), same shape and place.

## uniform
- **Task:** Set the colour from the CPU every frame with a push constant: `shader.frag` gets
  `layout(push_constant) uniform PushConstants { vec4 color; } pc;` and writes `outColor = pc.color;` (remove
  `vertexColor` from both shaders); in C++ add `struct PushConstants { glm::vec4 color; };`, a
  `VkPushConstantRange` (fragment stage, offset 0, `sizeof(PushConstants)`) in the pipeline layout, and in
  `recordCommandBuffer()` compute `greenValue = std::sin(time) / 2.0f + 0.5f` from `std::chrono` and call
  `vkCmdPushConstants` with `glm::vec4(0.0f, greenValue, 0.0f, 1.0f)` before the draw. Include `<chrono>` and `<cmath>`.
- **Hint:** Push constants are the Vulkan way to send a few bytes per draw without buffers or descriptors; the
  range in the pipeline layout must cover what the shaders use.
- **When done:** the triangle is green and its brightness pulses over time: green = sin(t)/2 + 0.5 (between 0 and
  255), red and blue 0. Code has `layout(push_constant)`, `pushConstantRangeCount = 1`, `vkCmdPushConstants(...,
  VK_SHADER_STAGE_FRAGMENT_BIT, ...)`.

## vertex-colors
- **Task:** Give every vertex its own colour: add `glm::vec3 color;` to `Vertex` and a second attribute description
  (location 1, `VK_FORMAT_R32G32B32_SFLOAT`, `offsetof(Vertex, color)`); colours red `{1, 0, 0}` (top),
  green `{0, 1, 0}` (bottom right), blue `{0, 0, 1}` (bottom left); `shader.vert` reads
  `layout(location = 1) in vec3 inColor;` and passes it on as `layout(location = 0) out vec3 fragColor;`;
  `shader.frag` writes `outColor = vec4(fragColor, 1.0);`.
- **Hint:** The rasterizer interpolates `fragColor` between the three corners. The colour push constant is still
  pushed by the C++ code but no shader reads it any more – it is reused in the `offset` task.
- **When done:** the learnopengl RGB triangle: red top corner, green bottom-right, blue bottom-left, smooth blend
  (greyish-red in the middle, about RGB (127, 64, 64) at the centre). No animation any more.

## upside-down
- **Task:** Turn the triangle upside down in the vertex shader:
  `gl_Position = vec4(inPosition.x, -inPosition.y, inPosition.z, 1.0);` – and, because the flip mirrors the
  triangle, set `rasterizer.frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE;` in `createGraphicsPipeline()`.
- **Hint:** With back-face culling a mirrored triangle turns its back to us and disappears; try the shader change
  alone first.
- **When done:** the triangle points down: red corner at the bottom centre (400, 450), green top-right (600, 150),
  blue top-left (200, 150). (Shader change without the `frontFace` change: nothing is drawn, only teal.)

## offset
- **Task:** Move the triangle to the right with a push constant `xOffset = 0.5`: `shader.vert` gets
  `layout(push_constant) uniform PushConstants { float xOffset; } pc;` and adds `pc.xOffset` to x; in C++ change
  `PushConstants` to `{ float xOffset; }`, the range's stage to `VK_SHADER_STAGE_VERTEX_BIT`, and push
  `constants.xOffset = 0.5f` (vertex stage) instead of the colour; remove the time code and the `<chrono>`/`<cmath>`
  includes.
- **Hint:** The `stageFlags` of the range and of `vkCmdPushConstants` must include the stage that reads the constant.
- **When done:** the upside-down RGB triangle moved right by a quarter of the window (0.5 in NDC = 200 px): red
  corner at (600, 450), green at (800, 150) (the right edge), blue at (400, 150).

## position-color
- **Task:** Colour the triangle with its position: in `shader.vert` write `fragColor = inPosition;` instead of
  `inColor`.
- **Hint:** Colours below 0 are clamped to 0 – which explains the black corner (learnopengl's exercise 3 question).
- **When done:** same place and shape as after `offset`; colours: bottom corner (vertex (0, -0.5, 0)) black,
  top-left corner (vertex (-0.5, 0.5, 0)) green RGB (0, 128, 0), top-right corner (vertex (0.5, 0.5, 0)) olive
  RGB (128, 128, 0), blended in between.
