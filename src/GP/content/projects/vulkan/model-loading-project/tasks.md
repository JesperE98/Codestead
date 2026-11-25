# Project: The hall of worlds – milestones (Vulkan)

The optional project after *Model Loading* (`chapters/<lang>/model-loading-project.md`). The start is the *Model*
chapter's solution unchanged (`main.cpp`, `shaders/model_loading.vert`, `shaders/model_loading.frag` and `models/` with
`planet.obj`): the lit planet with its ring, camera at (0, 0, 3), drawn with one `vkCmdDrawIndexed` and the model matrix
in the push constants. The milestones draw the same vertex and index buffers several times with model matrices of their
own; the checks (`Checks/TaskChecks.Project.ModelLoading.ts`, the same for every API) look at the picture only.

The finished picture (simulator and lavapipe agree): the turning planet in the middle (x ≈ 280..520), the bronze exhibit
on the left (x ≈ 35..230), the leaning one on the right (x ≈ 575..765), all around y ≈ 300, and the shelf of five small
planets at y ≈ 150..210.

## `make-room`
- **When done:** `glm::vec3 cameraPos = glm::vec3(0.0f, 0.0f, 6.0f);`. Check: drawn at (400, 300), and the drawn run
  through it along the column is under 200 px (270 from the start's camera).

## `exhibits`
- **When done:** in `recordCommandBuffer` after the first `vkCmdDrawIndexed`, twice: a new `model`
  (`translate(∓2.2, 0, 0)`, the left one `rotate(50°, x)`, the right one `rotate(-20°, z)` and `rotate(15°, x)`,
  `scale(0.4)`), `constants.model = model;`, `vkCmdPushConstants` and the same `vkCmdDrawIndexed`. Check: as OpenGL's.

## `turntable`
- **When done:** `model = glm::rotate(model, static_cast<float>(glfwGetTime()) * 0.5f, glm::vec3(0.0f, 1.0f, 0.0f));`
  right after the middle exhibit's `translate`. `recordCommandBuffer` runs every frame, so the matrix follows the time.

## `shelf`
- **When done:** before `vkCmdEndRenderPass`, `for (uint32_t i = 0; i < 5; i++)` with `translate(-4 + 2i, 1.5, -3)`,
  `rotate(15° · i, x)`, `scale(0.2)`, the push constants and the draw.

## `bronze`
- **When done:** `PushConstants` gets `glm::vec3 tint;` after the matrix (std430: offset 64, 76 bytes in all); the push
  constant range's `stageFlags` and every `vkCmdPushConstants` are `VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`;
  `constants.tint` is white for the middle and right exhibits and the shelf, (1.0, 0.6, 0.25) for the left one;
  `model_loading.frag` declares `layout(push_constant) uniform PushConstants { mat4 model; vec3 tint; } pc;` and writes
  `outColor = vec4(result * pc.tint, 1.0);` (the vertex shader's block stays `{ mat4 model; }`). No validation message
  (lavapipe with the Khronos layer). Check: as OpenGL's.
