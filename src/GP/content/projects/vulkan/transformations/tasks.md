# Transformations (Vulkan) – a transform matrix as a push constant (learnopengl "Transformations")

Start: the program of "Textures" after `texture-units` (container 80 % + face 20 %, `mix(…, 0.2)`, one repeating
sampler, texture coordinates 0..1, no face flip, no `mixValue`), prepared for learnopengl's vertex data:
- `struct Vertex { glm::vec3 pos; glm::vec2 texCoord; }` – the colour attribute is gone (learnopengl's transformation
  examples have positions and texture coordinates only); attribute descriptions: location 0 = `pos`, location 1 =
  `texCoord`. `shader.vert` passes `inTexCoord` on as `layout(location = 0) out vec2 fragTexCoord`, `shader.frag`
  reads it at location 0.
- The vertices are learnopengl's, in its order and with **+y up**: top right `(0.5, 0.5)`, bottom right
  `(0.5, -0.5)`, bottom left `(-0.5, -0.5)`, top left `(-0.5, 0.5)`, indices `{0, 1, 3, 1, 2, 3}`. Texture coordinates
  are learnopengl's with v flipped (top right `{1, 0}`, bottom right `{1, 1}`, bottom left `{0, 1}`, top left `{0, 0}`),
  because learnopengl flips the images when loading them and we do not (in Vulkan v = 0 is the top row).
- Vulkan's clip space y points down, so `shader.vert` flips it: `gl_Position = vec4(inPosition, 1.0);` followed by
  `gl_Position.y = -gl_Position.y;`. With this, every GLM matrix below gives exactly learnopengl's picture (in the
  next chapter the flip moves into the projection matrix, `proj[1][1] *= -1`, like vulkan-tutorial).
- Winding: on screen both triangles (top right → bottom right → top left, bottom right → bottom left → top left) run
  clockwise, so the tutorial's `cullMode = VK_CULL_MODE_BACK_BIT` with `frontFace = VK_FRONT_FACE_CLOCKWISE` keeps
  them. Rotations, translations and a uniform scale (even by a negative factor: in 2D that is a 180° turn) never
  mirror the rectangle, so nothing gets culled in this chapter.
- `// TODO:` lines: `struct PushConstants` (before the class), the push constant range (before
  `pipelineLayoutInfo` in `createGraphicsPipeline()`), the matrix + `vkCmdPushConstants` (in `recordCommandBuffer()`
  between `vkCmdBindDescriptorSets` and `vkCmdDrawIndexed`), and the push constant block in `shader.vert`.

Start picture = the textures picture after `texture-units`: the rectangle covers x 200..600, y 150..450 (800×600
window, y down), upright crate, faint face with the heart right of centre: centre (400, 300) = (125, 89, 30),
frame (74, 46, 22) at (210, 300) and (400, 160), (300, 225) = (168, 120, 50), heart (492, 322) ≈ (156, 81, 53);
teal (51, 76, 76) outside, e.g. (100, 100).

Per-draw values (learnopengl's `transform` uniform) are a **push constant** here: a `mat4` (64 bytes, GLM and GLSL are
both column-major, so the bytes match) recorded into the command buffer before each draw. Time is `glfwGetTime()`
(GLFW's clock, as in learnopengl), read in `recordCommandBuffer()` every frame. Colours measured on lavapipe with the
time fixed to 1 s (allow ±3); screenshots of the real program are taken after about 3 s, so for the animated steps use
the time-independent points.

Final program (solution): the first container orbits the window centre (rotate, then translate – exercise 1), a
second container at the top left grows and shrinks with sin(time) (exercise 2), two `vkCmdDrawIndexed` calls with a
`vkCmdPushConstants` before each.

## transform-uniform
- **Task:** Scale the container by 0.5 and rotate it by 90° with a matrix pushed to the vertex shader: include
  `<glm/gtc/matrix_transform.hpp>`; add `struct PushConstants { glm::mat4 transform; };`; in `createGraphicsPipeline()`
  a `VkPushConstantRange` (stage `VK_SHADER_STAGE_VERTEX_BIT`, offset 0, `sizeof(PushConstants)`) with
  `pushConstantRangeCount = 1; pPushConstantRanges = &pushConstantRange;`; in `recordCommandBuffer()` build
  `glm::mat4 transform = glm::mat4(1.0f);`, `transform = glm::rotate(transform, glm::radians(90.0f), glm::vec3(0.0f, 0.0f, 1.0f));`,
  `transform = glm::scale(transform, glm::vec3(0.5f, 0.5f, 0.5f));` and push it with
  `vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants)`
  before the draw; `shader.vert`: `layout(push_constant) uniform PushConstants { mat4 transform; } pc;` and
  `gl_Position = pc.transform * vec4(inPosition, 1.0);` (the y flip line stays).
- **Hint:** The matrix is applied right to left: first scale, then rotate. A push constant applies to the draws
  recorded after `vkCmdPushConstants`.
- **When done:** the container is half as big (200×150 px, x 300..500, y 225..375) and turned 90° counter-clockwise:
  the brace now runs from top-left to bottom-right and the heart is above-right of the centre: (415, 268) ≈
  (161, 83, 54). Centre (400, 300) = (125, 89, 30); frame (74, 46, 22) at (305, 300), (400, 370) and the corner
  (300, 225); (400, 160) and (100, 100) are teal. Not animated.

## translate-rotate
- **Task:** Replace the rotate/scale lines with
  `transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));` and
  `transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));`.
- **Hint:** Read right to left again: the container is rotated about its own centre first, then moved to the bottom
  right.
- **When done:** a full-size container centred on (600, 450), the centre of the bottom-right quarter (its corners reach
  past the window edges), spinning counter-clockwise, one turn in 2π ≈ 6.3 s. Its centre pixel (600, 450) = (125, 89, 30) at any
  time; (100, 100) and (300, 150) are teal at any time. At t = 1 s: (650, 400) = (168, 120, 50), (500, 450) ≈
  (125, 83, 46), window centre (400, 300) teal.

## rotate-first
- **Task:** Swap the two lines: first `glm::rotate(…, (float)glfwGetTime(), …)`, then `glm::translate(…, (0.5, -0.5, 0))`.
- **Hint:** Now the container is moved first and then rotated about the origin – the window centre.
- **When done:** the container orbits the window centre counter-clockwise (one turn per 6.3 s), turning with the
  orbit; its top-left corner stays on the window centre (400, 300). At t = 1 s its centre is at (676, 255) =
  (125, 89, 30), (700, 150) = (169, 120, 50), (500, 250) ≈ (125, 83, 45); (600, 450), (100, 100) and (400, 300)
  are teal.

## second-container
- **Task:** After the first `vkCmdDrawIndexed`, draw a second container at the top left that scales with time:
  `transform = glm::mat4(1.0f);`, `transform = glm::translate(transform, glm::vec3(-0.5f, 0.5f, 0.0f));`,
  `float scaleAmount = static_cast<float>(std::sin(glfwGetTime()));`,
  `transform = glm::scale(transform, glm::vec3(scaleAmount, scaleAmount, scaleAmount));`, `constants.transform = transform;`,
  a second `vkCmdPushConstants(…)` and a second `vkCmdDrawIndexed(…)`. Include `<cmath>`.
- **Hint:** The draws are recorded in one command buffer; each one uses the push constant values recorded before it.
  A negative scale turns the container upside down (both x and y negated), it does not mirror it.
- **When done:** two containers: the orbiting one as before, plus one centred on (200, 150), upright and as big as
  sin(t) (at t = 1 s: 0.84 × 400×300 ≈ 337×252 px, x 32..368, y 24..276); it shrinks to nothing at t = π and comes
  back upside down. (200, 150) = (125, 89, 30) whenever sin(t) ≠ 0. At t = 1 s: (100, 100) = (168, 120, 50), right
  frame (360, 150) = (74, 46, 22), (676, 255) = (125, 89, 30) (first container), (30, 30) and (600, 450) teal.
