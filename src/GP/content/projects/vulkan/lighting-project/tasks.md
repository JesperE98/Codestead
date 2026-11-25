# Project: Opening night – milestones (Vulkan)

The optional project after *Lighting* (brief: `chapters/<lang>/lighting-project.md`; checks:
`ts/packages/gp-course/src/Checks/TaskChecks.Project.Lighting.ts`). Nothing new is taught: the learner combines light
colours (ambient, diffuse, specular), the light casters of *Multiple lights*, a spotlight with its own position and
direction, time, a colour per lamp and the material's shininess.

Start = `multiple-lights/solution` unchanged (files `main.cpp`, `shaders/multiple_lights.vert/.frag`,
`shaders/light_cube.vert/.frag`, `textures/container2.png`, `textures/container2_specular.png`): the ten containers,
the directional light, four white point lights with their lamps (their own pipeline, the same pipeline layout), the
flashlight at the camera; every light filled in by `updateUniformBuffer()`, the model matrices pushed in
`recordCommandBuffer()`.

The checks read the uniforms the draws hand their shaders, by the shaders' names (the same in every API):
`dirLight.ambient/diffuse`, `pointLights[i].diffuse`, `spotLight.position/direction`, `viewPos`,
`material.shininess`, and for the lamps (draws whose model matrix scales by under 0.5) any vec3/vec4 value besides the
matrices. The picture is checked where the result is visible: the clear colour, pixels in colours no white light gives
the containers, a lamp drawn in its colour, and the spot changing the picture over time. The camera stays at
(0, 0, 3) looking down -z (no input). Pictures at 1 s with the course's simulator; the run on lavapipe with `verify.sh` agrees, without validation messages.

## `house-lights`
- **Task:** Clear the window to practically black and switch the directional light off.
- **Hint:** `clearValues[0].color` (0.01, 0.01, 0.01); the three `ubo.dirLight` colours to 0.
- **When done:** `clearValues[0].color = {{0.01f, 0.01f, 0.01f, 1.0f}};` and `ubo.dirLight.ambient/diffuse/specular` all (0, 0, 0). All that is left are the four point lights (still white) and the flashlight on container 0:
  the faces turned away from them go black. Check: every channel of the clear colour ≤ 0.05, the directional light's
  diffuse ≤ 0.1 and ambient ≤ 0.03 (or not there).

## `gels`
- **Task:** Give the point lights colours, at least two of them clearly different.
- **Hint:** a global `pointLightColors` after `pointLightPositions`; in the loop diffuse and specular the colour, ambient a tenth.
- **When done:** `const std::vector<glm::vec3> pointLightColors` = blue (0.2, 0.3, 1.0), green (0.2, 1.0, 0.3), pink (1.0, 0.3, 0.8), red (1.0, 0.2, 0.2); in the loop `ambient = pointLightColors[i] * 0.1f`, `diffuse` and `specular` `pointLightColors[i]`. Light 0 (0.7, 0.2, 2), in front of the cast, washes the front faces blue; red (light 3,
  behind container 0) and pink (light 2, far back) colour the edges and the backs, green (light 1, below on the right)
  the lower faces. Check: two point lights with diffuse colours that are coloured (a channel 0.4 above another) and
  differ by more than 0.3 in a channel, and at least 200 of the check frame's 19,200 pixels green or blue clearly
  above red, or deep red (green under 0.35 of red) – under white light the wood is red > green > blue with green at
  least half of red, and the steel grey.

## `lamp-colours`
- **Task:** Make every lamp show the colour of its own light.
- **Hint:** `glm::vec3 color` after the matrix in `PushConstants` and in a push constant block in `light_cube.frag`; the fragment stage in the range and in both `vkCmdPushConstants`.
- **When done:** `PushConstants` is `{ glm::mat4 model; glm::vec3 color; }` (76 bytes); `light_cube.frag` declares `mat4 model; vec3 color;` and outputs `vec4(pc.color, 1.0)` (the other shaders keep their block with only the matrix, a valid prefix); the range and both `vkCmdPushConstants` use `VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`; the lamp loop sets `constants.color = pointLightColors[i]`. Only two lamps are in view from the start position: the blue one at the right edge
  of the window (light 0 is a unit in front of the camera) and the far pink one, a few pixels at the upper left. Check:
  under one name, the lamps hand their shaders two coloured, clearly different colours; the name is used in the
  shaders besides its declaration; at least 4 pixels show a lamp's colour (±0.03).

## `follow-spot`
- **Task:** Hang the spotlight above the stage, a couple of units above the camera, aimed down at container 0; a warm white.
- **Hint:** `spotPos` (0, 2, 3), `spotTarget` (0, 0, 0), direction `glm::normalize(spotTarget - spotPos)`.
- **When done:** in `updateUniformBuffer()`: `glm::vec3 spotPos = glm::vec3(0.0f, 2.0f, 3.0f);`, `glm::vec3 spotTarget = glm::vec3(0.0f, 0.0f, 0.0f);`, `ubo.spotLight.position = spotPos`, `ubo.spotLight.direction = glm::normalize(spotTarget - spotPos)`, diffuse and specular (1.0, 0.9, 0.7). The spot lights the whole front of container 0 in warm white. Check: the spot at least
  1 above `viewPos` and more than 1 away from it, its direction pointing down (y < -0.1).

## `sweep`
- **Task:** Let the spot sweep over the star from side to side as the time passes.
- **Hint:** `float time = static_cast<float>(glfwGetTime());`, `spotTarget = glm::vec3(std::sin(2.0f * time), 0.0f, 0.0f)`.
- **When done:** `float time = static_cast<float>(glfwGetTime());` and `glm::vec3 spotTarget = glm::vec3(std::sin(2.0f * time), 0.0f, 0.0f);`. The pool of light swings across container 0 every π seconds: at 1 s it lights the right
  half of the front, at 2.3 s the left. Check: the spot's direction differs between 1 s and 2.3 s, and more than 10
  points of a grid over the window change colour.

## `polish`
- **Task:** Give the material a much higher shininess (64 or more).
- **Hint:** `ubo.material.shininess` 128.
- **When done:** `ubo.material.shininess = 128.0f;`. The highlights on the steel edges get smaller and sharper. Check: `material.shininess`
  ≥ 64.
