# Materials (Vulkan) – a Material and a Light struct in the uniform buffer (learnopengl "Materials")

Start: the result of "Basic Lighting" without the moving light (the lamp stays at `lightPos (1.2, 1.0, 2.0)`), the
cube's shaders renamed `shaders/materials.vert` / `.frag` (`createPipeline("shaders/materials.vert.spv",
"shaders/materials.frag.spv", 2, lightingPipeline)`). Same camera ((-3, 0, 3), the cube's left and front faces and the
lamp in view), same two pipelines, the same uniform buffer at binding 2 (`objectColor`, `lightColor`, `lightPos`,
`viewPos`, each `glm::vec3` followed by a padding `float`).

**std140 in this chapter:** the shader's structs live in the uniform block, so C++ has the same structs. In a uniform
block a `vec3` and a struct both start at a multiple of 16 bytes and a struct's size is rounded up to a multiple of
16: every `glm::vec3` in C++ is followed by a `float` – a member that fits there (`float shininess` after
`specular`) or a padding float (`pad1`…). `Material` is then 48 bytes and `Light` 64 bytes in both languages, and
the C++ struct names and field names are the ones of the shader (`Material material; Light light;` in both blocks).

Colours measured on lavapipe, identical to the OpenGL version of this chapter, pixel for pixel. Named points: left face
L (160, 370), front face F1 (300, 370), F2 (330, 300), F3 (250, 300), highlight H (245, 280), lamp (640, 195) (always
white (255, 255, 255)), background (400, 300) = (26, 26, 26).
- start (= "Basic Lighting" after `specular`): L = (26, 13, 8), F1 = (203, 101, 63), F2 = (237, 118, 73),
  F3 = (255, 130, 80), H = (255, 144, 89).

## material
- **Task:** Describe the surface with a material: in materials.frag `struct Material { vec3 ambient; vec3 diffuse;
  vec3 specular; float shininess; };`, the block becomes `{ mat4 view; mat4 proj; vec3 lightColor; vec3 lightPos;
  vec3 viewPos; Material material; }`, and the lighting uses it: `ambient = ubo.lightColor * ubo.material.ambient`,
  `diffuse = ubo.lightColor * (diff * ubo.material.diffuse)`, `spec = pow(…, ubo.material.shininess)`,
  `specular = ubo.lightColor * (spec * ubo.material.specular)`, `result = ambient + diffuse + specular` (no
  `objectColor` any more). In C++ the same `struct Material` (with `pad1`, `pad2` after `ambient` and `diffuse`),
  `objectColor` removed from `UniformBufferObject` and `Material material;` added at its end, and in
  `updateUniformBuffer()`: `ubo.material.ambient = glm::vec3(1.0f, 0.5f, 0.31f); ubo.material.diffuse =
  glm::vec3(1.0f, 0.5f, 0.31f); ubo.material.specular = glm::vec3(0.5f, 0.5f, 0.5f); ubo.material.shininess = 32.0f;`.
- **Hint:** Each lighting component now has its own colour on the object; the light colour is still white, so the
  ambient part is the whole coral colour – far too bright (the next task fixes that).
- **When done:** the cube much brighter: L = (255, 128, 79) (ambient only, full coral), F1 = (255, 217, 135),
  F2 = (255, 237, 150), F3 = (255, 255, 198), H = (255, 255, 226); lamp white, background (26, 26, 26).

## light
- **Task:** Give the light its own strengths per component: `struct Light { vec3 position; vec3 ambient; vec3 diffuse;
  vec3 specular; };` in the shader, the block becomes `{ mat4 view; mat4 proj; vec3 viewPos; Material material; Light
  light; }`, and the shader uses `ubo.light.ambient`, `ubo.light.position`, `ubo.light.diffuse`,
  `ubo.light.specular` instead of `ubo.lightColor` / `ubo.lightPos`. In C++ the same `struct Light` (a padding float
  after each vec3), `UniformBufferObject { view; proj; viewPos; pad1; Material material; Light light; }` and
  `ubo.light.position = lightPos; ubo.light.ambient = glm::vec3(0.2f); ubo.light.diffuse = glm::vec3(0.5f);
  ubo.light.specular = glm::vec3(1.0f);` (learnopengl's values, written per component).
- **Hint:** A light's ambient part is usually weak, its diffuse part the colour of the light, and its specular part
  full white.
- **When done:** the cube coral again, with a clear highlight: L = (51, 26, 16), F1 = (140, 71, 45),
  F2 = (161, 85, 56), F3 = (201, 134, 108), H = (230, 163, 137); lamp white, background (26, 26, 26).

## light-color
- **Task:** Change the light's colour over time: in `updateUniformBuffer()` `glm::vec3 lightColor;` with
  `lightColor.x = sin(glfwGetTime() * 2.0)`, `.y = sin(glfwGetTime() * 0.7)`, `.z = sin(glfwGetTime() * 1.3)` (as
  floats, `std::sin`), `glm::vec3 diffuseColor = lightColor * glm::vec3(0.5f); glm::vec3 ambientColor = diffuseColor *
  glm::vec3(0.2f);` and `ubo.light.ambient = ambientColor; ubo.light.diffuse = diffuseColor;` (specular stays white).
- **Hint:** The object's colour is the light's colour times the material's: a reddish light makes the coral cube look
  red.
- **When done:** the cube's colour changes over time (time-dependent; the lamp stays white – its shader ignores the
  light colour). At t = 1 s lightColor = (0.91, 0.64, 0.96): L = (23, 8, 8), F1 = (105, 38, 35),
  F2 = (124, 49, 46), F3 = (166, 102, 99), H = (195, 131, 128); lamp (255, 255, 255), background (26, 26, 26).

## Optional (described, not a task)
- learnopengl's exercise: simulate a real-world material from the table at devernay.free.fr (e.g. cyan plastic:
  ambient (0, 0.1, 0.06), diffuse (0, 0.51, 0.51), specular (0.5, 0.5, 0.5), shininess 0.25 × 128) with a white light
  (`ubo.light.ambient = ubo.light.diffuse = ubo.light.specular = glm::vec3(1.0f)`).
