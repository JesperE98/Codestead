# Multiple Lights (Vulkan) – a directional light, four point lights and a flashlight (learnopengl "Multiple lights")

Start (prepared from the Light Casters solution): the ten containers, the diffuse map (binding 0) and specular map
(binding 1), shininess 32, the uniform buffer at binding 2, the camera at (0, 0, 3) looking down -z (yaw -90, pitch 0),
both pipelines (`lightingPipeline` now from `shaders/multiple_lights.vert` / `.frag`, `lightCubePipeline` from
`shaders/light_cube.*`). `multiple_lights.vert` is light_casters.vert unchanged. `multiple_lights.frag` is a fresh
skeleton: the two map samplers, `struct Material { float shininess; };`, the block `{ mat4 view; mat4 proj; vec3 viewPos;
Material material; } ubo;`, the inputs, and a `main()` that computes `norm` and `viewDir`, sets
`vec3 result = vec3(0.0);` and has three TODOs (phase 1: directional light, phase 2: point lights, phase 3: spot light)
before `outColor = vec4(result, 1.0);`. In C++ the `Light` struct and the `lightPos` global are gone,
`UniformBufferObject` is `{ view; proj; viewPos; pad1; Material material; }`, `updateUniformBuffer()` sets `viewPos`
and `material.shininess` followed by three TODOs (directional light, point lights 1 to 4, spot light), and a TODO stands
in `recordCommandBuffer()` where the lamps are drawn.

**std140:** each light is a struct in the uniform block, and C++ has the same structs with padding floats so every
member has the shader's offset (a vec3 starts at a multiple of 16 bytes, a float may fill the 4 bytes after a vec3, a
struct's size is a multiple of 16): `DirLight` 64 bytes, `PointLight` 80 bytes (after `position`: `constant`,
`linear`, `quadratic`, then 2 padding floats so `ambient` starts at 32), `SpotLight` 96 bytes. The array
`PointLight pointLights[NR_POINT_LIGHTS]` (GLSL `#define NR_POINT_LIGHTS 4`) is `PointLight pointLights[4]` in C++:
the array stride is the struct size, 80 bytes, in both. The lights are set field by field in `updateUniformBuffer()`
(`ubo.dirLight.direction = …`, `ubo.pointLights[i].position = pointLightPositions[i]` in a loop over the four).

Nothing depends on time. Colours measured on lavapipe; they match the OpenGL version of this chapter (±3; the far
containers differ slightly because OpenGL samples mipmaps). Container 0 faces the camera (front face x ≈ 255..545,
y ≈ 155..445). Named points (the same as in the OpenGL chapter): **centre** (400, 300) = wood of container 0, **frame**
(265, 300) = its left steel frame, **top-frame** (400, 165), **corner** (262, 162), **spot-edge** (330, 230), **c8**
(640, 260), **c7** (600, 70), **c9** (191, 139), **far** (483, 100), **right-border** (797, 160), **background**
(400, 520) and (30, 300) = (26, 26, 26).

Start picture: **all containers black** (0, 0, 0) (no light yet) on the (26, 26, 26) background.

## dir-light
- **Task:** Add the directional light: `struct DirLight { vec3 direction; vec3 ambient; vec3 diffuse; vec3 specular; };`
  in the shader and `DirLight dirLight;` at the end of the block, the prototype `vec3 CalcDirLight(DirLight light, vec3
  normal, vec3 viewDir);` before `main`, learnopengl's function after it (`lightDir = normalize(-light.direction)`,
  diffuse, specular with `ubo.material.shininess`, ambient/diffuse from `diffuseMap`, specular from `specularMap`), and
  phase 1 `vec3 result = CalcDirLight(ubo.dirLight, norm, viewDir);`. In C++ `struct DirLight` (a padding float after
  each vec3), `DirLight dirLight;` at the end of `UniformBufferObject`, and `ubo.dirLight.direction =
  glm::vec3(-0.2f, -1.0f, -0.3f); ambient 0.05, diffuse 0.4, specular 0.5`.
- **Hint:** The function does what the directional light of Light Casters did and returns the sum of the three terms.
- **When done:** the containers dimly lit from above: centre = (24, 16, 8), frame = (24, 25, 26), c8 = (10, 7, 4),
  c7 = (8, 5, 3), far = (9, 6, 3); faces turned up are brighter, c9 = (48, 32, 18).

## point-lights
- **Task:** Add four point lights: `struct PointLight { vec3 position; float constant; float linear; float quadratic;
  vec3 ambient; vec3 diffuse; vec3 specular; };`, `#define NR_POINT_LIGHTS 4`, `PointLight
  pointLights[NR_POINT_LIGHTS];` in the block, `CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3
  viewDir)` with attenuation (prototype + definition), phase 2 `for (int i = 0; i < NR_POINT_LIGHTS; i++) result +=
  CalcPointLight(ubo.pointLights[i], norm, fragPos, viewDir);`. In C++ the global `pointLightPositions` (learnopengl's
  (0.7, 0.2, 2.0), (2.3, -3.3, -4.0), (-4.0, 2.0, -12.0), (0.0, 0.0, -3.0)), `struct PointLight` (with `pad1`, `pad2`
  after `quadratic` and a padding float after each colour), `PointLight pointLights[4];` in `UniformBufferObject`, and a
  loop setting position, ambient 0.05, diffuse 0.8, specular 1.0, constant 1.0, linear 0.09, quadratic 0.032 for each.
- **Hint:** The C++ array must have the same stride as the shader's: with the padding the struct is 80 bytes, a multiple
  of 16, so `sizeof(PointLight)` is the std140 stride.
- **When done:** the scene much brighter, near containers most: centre = (126, 83, 44), frame = (111, 113, 117),
  top-frame = (126, 128, 133), c9 = (110, 73, 39), c7 = (100, 66, 35), c8 = (68, 48, 25), far = (67, 44, 23) (lit by
  the point light at (-4, 2, -12)).

## spot-light
- **Task:** Add the flashlight: `struct SpotLight { vec3 position; vec3 direction; float cutOff; float outerCutOff;
  float constant; float linear; float quadratic; vec3 ambient; vec3 diffuse; vec3 specular; };`, `SpotLight spotLight;`
  in the block, `CalcSpotLight` (attenuation × soft-edge intensity on all three terms; prototype + definition) and
  phase 3 `result += CalcSpotLight(ubo.spotLight, norm, fragPos, viewDir);`. In C++ `struct SpotLight` (`pad1` after
  `position`; `ambient` then starts at 48 bytes; a padding float after each colour), `SpotLight spotLight;` in
  `UniformBufferObject`, and position = `cameraPos`, direction = `cameraFront`, ambient 0, diffuse 1, specular 1,
  constant 1, linear 0.09, quadratic 0.032, `cutOff = glm::cos(glm::radians(12.5f))`, `outerCutOff =
  glm::cos(glm::radians(15.0f))`.
- **Hint:** It is the soft spotlight of Light Casters as a function: `intensity = clamp((theta - light.outerCutOff) /
  epsilon, 0.0, 1.0)`.
- **When done:** a bright disc on container 0: centre = (244, 164, 93), frame = (229, 232, 241), top-frame =
  (244, 247, 255), spot-edge = (201, 134, 72); corner (262, 162) = (111, 112, 116) and the other containers unchanged
  (outside the cone).

## lamps
- **Task:** Draw a lamp at each point light: in `recordCommandBuffer()` after the containers bind `lightCubePipeline`
  and, in a loop over the four `pointLightPositions`, push `model = glm::scale(glm::translate(glm::mat4(1.0f),
  pointLightPositions[i]), glm::vec3(0.2f))` and draw the 36 vertices.
- **Hint:** One `vkCmdBindPipeline` before the loop; in the loop only the model matrix changes (`constants.model =
  model; vkCmdPushConstants(…)`), then `vkCmdDraw`.
- **When done:** 4 more draws with `lightCubePipeline`. With the camera at (0, 0, 3) the lamps are hardly visible:
  lamp 1 (0.7, 0.2, 2.0) shows only as a white sliver at the right border (x 795..799, y 100..233; right-border
  (797, 160) = (26, 26, 26) → (255, 255, 255)), lamp 2 is below the window, lamp 3 hidden behind container 9, lamp 4
  behind container 0. Everything else unchanged (centre (244, 164, 93)). Moving the camera (S to step back, the mouse)
  shows them.

Optional exercise of the chapter (not a task): recreate learnopengl's "desert", "factory", "horror" and "biochemical
lab" atmospheres by changing the clear colour (`clearValues[0].color`) and the lights' colours.
