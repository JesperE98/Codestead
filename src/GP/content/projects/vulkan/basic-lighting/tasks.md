# Basic Lighting (Vulkan) – ambient, diffuse and specular: the Phong lighting model (learnopengl "Basic Lighting")

Start: the result of "Colors" (coral cube, white lamp, two pipelines made by `createPipeline(...)`), with the cube's
shaders renamed `shaders/basic_lighting.vert` / `.frag` (`createPipeline("shaders/basic_lighting.vert.spv",
"shaders/basic_lighting.frag.spv", 1, lightingPipeline)`), and learnopengl's vertex data with normals:
`struct Vertex { glm::vec3 pos; glm::vec3 normal; }`, `{{-0.5f, -0.5f, -0.5f}, { 0.0f,  0.0f, -1.0f}}` … (the normal
of each face, pointing out). The normal is in the vertex buffer but not described to the pipeline yet
(`getAttributeDescriptions()` returns one attribute; `// TODO` for the second). The third argument of
`createPipeline` is the number of the Vertex's attributes the pipeline's vertex shader reads (the lamp's pipeline
reads only the position, like learnopengl's lamp VAO; describing an attribute the shader does not read makes the
validation layer warn).

The uniform buffer grows in this chapter (`lightPos`, `viewPos`): each `glm::vec3` in `UniformBufferObject` is
followed by a padding `float` (`pad3`, `pad4`), because in a uniform block (std140) a vec3 starts at a multiple of
16 bytes. The fragment shader declares the whole block; the vertex shaders only its first members (the matrices).

Camera as in "Colors" ((-3, 0, 3), looking at the cube's front and left faces), lamp at `lightPos (1.2, 1.0, 2.0)`.
Nothing depends on time until the last task. Colours measured on lavapipe – identical to the OpenGL version of this
chapter, pixel for pixel. Named points: left face L (160, 370), front face F1 (300, 370), F2 (330, 300), F3 (250, 300),
lamp (640, 195), background (400, 300) = (26, 26, 26).
- start: cube coral (255, 128, 79) at L, F1, F2, F3; lamp white (255, 255, 255).

## ambient
- **Task:** Ambient lighting: in basic_lighting.frag `float ambientStrength = 0.1; vec3 ambient = ambientStrength *
  ubo.lightColor; vec3 result = ambient * ubo.objectColor; outColor = vec4(result, 1.0);`.
- **Hint:** Ambient light is the little light that reaches everything, even with no lamp shining at it.
- **When done:** the whole cube very dark, flat: L = F1 = F2 = F3 = (26, 13, 8) (0.1 × coral); lamp still white.

## normals
- **Task:** Give the vertex shader the normals: `getAttributeDescriptions()` returns 2 attributes,
  `attributeDescriptions[1]` = binding 0, location 1, `VK_FORMAT_R32G32B32_SFLOAT`, `offsetof(Vertex, normal)`;
  the cube's pipeline reads 2 attributes (`createPipeline(…basic_lighting…, 2, lightingPipeline)`). In
  basic_lighting.vert: `layout(location = 1) in vec3 inNormal;`, outputs `layout(location = 0) out vec3 fragPos;`
  and `layout(location = 1) out vec3 fragNormal;` with `fragPos = vec3(pc.model * vec4(inPosition, 1.0));`,
  `fragNormal = inNormal;`, `gl_Position = ubo.proj * ubo.view * vec4(fragPos, 1.0);`. In basic_lighting.frag the
  matching inputs (`layout(location = 0) in vec3 fragPos; layout(location = 1) in vec3 fragNormal;`).
- **Hint:** The lighting is calculated in world space, so the fragment shader needs the world position of each
  fragment (the position after the model matrix only) and the normal.
- **When done:** picture unchanged (the inputs are not used yet): (26, 13, 8) at L, F1, F2, F3.

## diffuse
- **Task:** Diffuse lighting: `vec3 lightPos` in the block (C++: `glm::vec3 lightPos; float pad3;` and
  `ubo.lightPos = lightPos;` in `updateUniformBuffer()`); in the fragment shader `vec3 norm = normalize(fragNormal);
  vec3 lightDir = normalize(ubo.lightPos - fragPos); float diff = max(dot(norm, lightDir), 0.0); vec3 diffuse = diff *
  ubo.lightColor;` and `result = (ambient + diffuse) * ubo.objectColor`.
- **Hint:** The more a face points towards the light (the smaller the angle between normal and light direction), the
  brighter it is; `max(…, 0.0)` keeps faces turned away from going negative.
- **When done:** the front face (facing the lamp) lit, brighter towards the lamp: F1 = (201, 101, 62),
  F2 = (228, 114, 71), F3 = (192, 96, 60), (245, 280) = (192, 96, 60); the left face (turned away from the light)
  stays ambient-only L = (26, 13, 8); lamp white.

## normal-matrix
- **Task:** Transform the normals with the normal matrix: `fragNormal = mat3(transpose(inverse(pc.model))) * inNormal;`.
- **Hint:** The model matrix may rotate and scale the cube, so its normals must turn with it; the transpose of the
  inverse keeps them perpendicular to the faces even with non-uniform scaling (and drops the translation).
- **When done:** picture unchanged (the model matrix of the cube is the identity): F1 = (201, 101, 62),
  F2 = (228, 114, 71), F3 = (192, 96, 60), L = (26, 13, 8).

## specular
- **Task:** Specular lighting: `vec3 viewPos` in the block (C++: `glm::vec3 viewPos; float pad4;`,
  `ubo.viewPos = cameraPos;`); in the fragment shader `float specularStrength = 0.5; vec3 viewDir =
  normalize(ubo.viewPos - fragPos); vec3 reflectDir = reflect(-lightDir, norm); float spec = pow(max(dot(viewDir,
  reflectDir), 0.0), 32); vec3 specular = specularStrength * spec * ubo.lightColor;` and `result = (ambient + diffuse +
  specular) * ubo.objectColor`.
- **Hint:** The highlight appears where the light is reflected towards the eye; 32 is the shininess (the higher, the
  smaller and sharper the highlight).
- **When done:** a highlight in the upper left of the front face (brightest just below the top edge, about
  x 255..275): (245, 280) = (255, 144, 89), (260, 290) = (255, 139, 86), F3 = (255, 130, 80), F2 = (237, 118, 73),
  F1 = (203, 101, 63); L = (26, 13, 8).

## moving-light
- **Task:** Move the light over time (learnopengl's exercise): at the start of `updateUniformBuffer()`
  `lightPos.x = static_cast<float>(1.0 + std::sin(glfwGetTime()) * 2.0); lightPos.y =
  static_cast<float>(std::sin(glfwGetTime() / 2.0) * 1.0);`.
- **Hint:** `updateUniformBuffer()` runs before `recordCommandBuffer()` in `drawFrame()`, so the lamp is drawn where the
  light is.
- **When done:** the lamp and the lighting move (time-dependent). At t = 1 s lightPos = (2.68, 0.48, 2.0): the lamp
  is at about x 677..711, y 289..318 (centre (694, 303) white); the highlight moves to the right edge of the front
  face (357, 324) = (255, 148, 92); (245, 280) = (155, 77, 48), F1 = (196, 98, 61), F2 = (255, 129, 80),
  F3 = (162, 81, 50); L = (26, 13, 8); (640, 195) is background (26, 26, 26) now.

## Optional (described, not tasks)
- learnopengl's other exercises: do the lighting in **view space** (multiply `fragPos` and the normal by the view
  matrix in the vertex shader, and transform `lightPos` by the view matrix; the viewer is then always at (0, 0, 0), so
  `viewPos` is not needed), and **Gouraud shading** (calculate the lighting per vertex in the vertex shader and let the
  rasterizer interpolate the colour: cheaper, but the highlight looks blocky on a cube with so few vertices).
