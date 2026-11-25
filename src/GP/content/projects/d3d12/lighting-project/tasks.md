# Project: Opening night – milestones (DirectX 12)

The optional project after *Lighting* (brief: `chapters/<lang>/lighting-project.md`; checks:
`ts/packages/gp-course/src/Checks/TaskChecks.Project.Lighting.ts`). Nothing new is taught: the learner combines light
colours (ambient, diffuse, specular), the light casters of *Multiple lights*, a spotlight with its own position and
direction, time, a colour per lamp and the material's shininess.

Start = `multiple-lights/solution` unchanged (files `main.cpp`, `multiple_lights.hlsl`, `light_cube.hlsl`,
`container2.png`, `container2_specular.png`): the ten containers, the directional light, four white point lights with
their lamps (their own pipeline state, the same root signature), the flashlight at the camera; every light filled in
by `OnUpdate`, the model and normal matrices set as root constants (root parameter 0) in `PopulateCommandList`.

The checks read the uniforms the draws hand their shaders, by the shaders' names (the same in every API):
`dirLight.ambient/diffuse`, `pointLights[i].diffuse`, `spotLight.position/direction`, `viewPos`,
`material.shininess`, and for the lamps (draws whose model matrix scales by under 0.5) any vec3/vec4 value besides the
matrices. The picture is checked where the result is visible: the clear colour, pixels in colours no white light gives
the containers, a lamp drawn in its colour, and the spot changing the picture over time. The camera stays at
(0, 0, 3) looking down -z (no input). Pictures at 1 s with the course's simulator; Direct3D 12 cannot run here – `verify.sh` compiles the code with MinGW against the DirectX headers and the
HLSL with glslang.

## `house-lights`
- **Task:** Clear the window to practically black and switch the directional light off.
- **Hint:** the `clearColor` array (0.01, 0.01, 0.01); the three `dirLight` colours to 0.
- **When done:** `const float clearColor[] = { 0.01f, 0.01f, 0.01f, 1.0f };` and `dirLight.ambient/diffuse/specular` all `XMFLOAT3(0.0f, 0.0f, 0.0f)`. All that is left are the four point lights (still white) and the flashlight on container 0:
  the faces turned away from them go black. Check: every channel of the clear colour ≤ 0.05, the directional light's
  diffuse ≤ 0.1 and ambient ≤ 0.03 (or not there).

## `gels`
- **Task:** Give the point lights colours, at least two of them clearly different.
- **Hint:** a global `XMFLOAT3 pointLightColors[]` after `pointLightPositions`; diffuse and specular the colour, ambient a tenth.
- **When done:** `XMFLOAT3 pointLightColors[]` = blue (0.2, 0.3, 1.0), green (0.2, 1.0, 0.3), pink (1.0, 0.3, 0.8), red (1.0, 0.2, 0.2); each light's ambient `XMStoreFloat3(&…ambient, 0.1f * XMLoadFloat3(&pointLightColors[i]))`, diffuse and specular `pointLightColors[i]`. Light 0 (0.7, 0.2, 2), in front of the cast, washes the front faces blue; red (light 3,
  behind container 0) and pink (light 2, far back) colour the edges and the backs, green (light 1, below on the right)
  the lower faces. Check: two point lights with diffuse colours that are coloured (a channel 0.4 above another) and
  differ by more than 0.3 in a channel, and at least 200 of the check frame's 19,200 pixels green or blue clearly
  above red, or deep red (green under 0.35 of red) – under white light the wood is red > green > blue with green at
  least half of red, and the steel grey.

## `lamp-colours`
- **Task:** Make every lamp show the colour of its own light.
- **Hint:** `XMFLOAT3 color` after the two matrices in `ModelConstants`, the whole layout in `light_cube.hlsl`, root parameter 0 visible to all stages.
- **When done:** `ModelConstants` is `{ XMFLOAT4X4 model; XMFLOAT4X4 normalMatrix; XMFLOAT3 color; }` (35 root constants); `light_cube.hlsl` declares the same three (`normalMatrix` unused, so `color` is at the same offset) and returns `float4(color, 1.0f)`; root parameter 0 is `D3D12_SHADER_VISIBILITY_ALL`; the lamp loop sets `modelConstants.color = pointLightColors[i]`. Only two lamps are in view from the start position: the blue one at the right edge
  of the window (light 0 is a unit in front of the camera) and the far pink one, a few pixels at the upper left. Check:
  under one name, the lamps hand their shaders two coloured, clearly different colours; the name is used in the
  shaders besides its declaration; at least 4 pixels show a lamp's colour (±0.03).

## `follow-spot`
- **Task:** Hang the spotlight above the stage, a couple of units above the camera, aimed down at container 0; a warm white.
- **Hint:** `spotPos` (0, 2, 3), `spotTarget` the origin, direction `XMVector3Normalize(spotTarget - spotPos)`.
- **When done:** in `OnUpdate`: `XMVECTOR spotPos = XMVectorSet(0.0f, 2.0f, 3.0f, 0.0f);`, `XMVECTOR spotTarget = XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f);`, stored with `XMStoreFloat3` as `spotLight.position` and `XMVector3Normalize(spotTarget - spotPos)` as `spotLight.direction`, diffuse and specular (1.0, 0.9, 0.7). The spot lights the whole front of container 0 in warm white. Check: the spot at least
  1 above `viewPos` and more than 1 away from it, its direction pointing down (y < -0.1).

## `sweep`
- **Task:** Let the spot sweep over the star from side to side as the time passes.
- **Hint:** a `static auto startTime`, `time` from `std::chrono`, `spotTarget = XMVectorSet(std::sin(2.0f * time), 0, 0, 0)`.
- **When done:** `static auto startTime = std::chrono::high_resolution_clock::now();`, `float time = …(currentFrame - startTime).count();` and `XMVECTOR spotTarget = XMVectorSet(std::sin(2.0f * time), 0.0f, 0.0f, 0.0f);`. The pool of light swings across container 0 every π seconds: at 1 s it lights the right
  half of the front, at 2.3 s the left. Check: the spot's direction differs between 1 s and 2.3 s, and more than 10
  points of a grid over the window change colour.

## `polish`
- **Task:** Give the material a much higher shininess (64 or more).
- **Hint:** `constantBufferData.material.shininess` 128.
- **When done:** `constantBufferData.material.shininess = 128.0f;`. The highlights on the steel edges get smaller and sharper. Check: `material.shininess`
  ≥ 64.
