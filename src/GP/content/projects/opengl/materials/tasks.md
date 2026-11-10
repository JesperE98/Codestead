# Materials – tasks (OpenGL)

learnopengl "Materials": `materials.cpp` (3.1) with `3.1.materials.vs/.fs`. Files: `main.cpp`, `shader_m.h`,
`materials.vs`, `materials.fs` (the lit cube), `light_cube.vs`, `light_cube.fs` (the lamp).

Start (prepared from the Basic Lighting solution): the shader files are renamed to `materials.vs/.fs` (same contents
as `basic_lighting.vs/.fs`: ambient 0.1, diffuse, specular 0.5 / 32, normal matrix), and the moving-light exercise is
taken out again – the light stays at `lightPos (1.2, 1.0, 2.0)` as in learnopengl. Same front-left camera as Colors.
Uniforms at the start: `objectColor`, `lightColor`, `lightPos`, `viewPos`.

Pixels measured with Mesa (llvmpipe) on copies with `glfwGetTime()` replaced by `1.0`, coordinates from the top left of
the 800×600 window. Named points: **front** (302,370) = centre of the cube's front face, **front-top-left** (271,320),
**highlight** (243,278) = the specular highlight in the upper-left corner of the front face, **left** (163,370) =
centre of the left face (only ambient light reaches it), **lamp** (641,195) = 255,255,255 in every step,
**background** (400,300) and (100,100) = 26,26,26.

Start picture (= Basic Lighting after `specular`): front ≈ 203,102,63, front-top-left ≈ 232,116,72, highlight ≈
255,145,90, left 26,13,8.

## `material`
- **Task:** Describe the surface with a `Material` struct (`vec3 ambient, diffuse, specular; float shininess;`) and a `uniform Material material;` in `materials.fs`, use its fields instead of `objectColor`, the 0.1/0.5 strengths and the 32, and set learnopengl's coral material from `main.cpp`.
- **Hint:** `ambient = lightColor * material.ambient`, `diffuse = lightColor * (diff * material.diffuse)`, `specular = lightColor * (spec * material.specular)` with `pow(…, material.shininess)`, `result = ambient + diffuse + specular`. Set struct fields by name: `lightingShader.setVec3("material.ambient", 1.0f, 0.5f, 0.31f);`, the same for `material.diffuse`, `material.specular` (0.5, 0.5, 0.5) and `lightingShader.setFloat("material.shininess", 32.0f);`.
- **When done:** `materials.fs` has `struct Material { vec3 ambient; vec3 diffuse; vec3 specular; float shininess; };`,
  `uniform Material material;`, no `objectColor`, no `ambientStrength`/`specularStrength`, the three terms as in the
  hint. `main.cpp`: no `objectColor`; `// material properties` with `material.ambient` (1.0, 0.5, 0.31),
  `material.diffuse` (1.0, 0.5, 0.31), `material.specular` (0.5, 0.5, 0.5), `material.shininess` 32.0. The ambient
  light is now at full strength, so the cube is **far too bright**: left face = full coral **255,128,79**, front ≈
  255,217,135, front-top-left ≈ 255,247,166, highlight ≈ 255,255,228 (almost white).

## `light`
- **Task:** Give the light its own intensities: a `Light` struct (`vec3 position; vec3 ambient, diffuse, specular;`) and `uniform Light light;` replace `lightPos` and `lightColor`; set `light.position` = `lightPos`, `light.ambient` (0.2, 0.2, 0.2), `light.diffuse` (0.5, 0.5, 0.5) and `light.specular` (1.0, 1.0, 1.0).
- **Hint:** `ambient = light.ambient * material.ambient`, `lightDir = normalize(light.position - FragPos)`, `diffuse = light.diffuse * (diff * material.diffuse)`, `specular = light.specular * (spec * material.specular)`.
- **When done:** `materials.fs` has `struct Light { vec3 position; vec3 ambient; vec3 diffuse; vec3 specular; };`,
  `uniform Light light;`, no `lightPos`/`lightColor` uniforms. `main.cpp`: `lightingShader.setVec3("light.position", lightPos);`
  and `// light properties` `light.ambient` (0.2), `light.diffuse` (0.5), `light.specular` (1.0); no `lightColor` /
  `lightPos` uniforms. The cube looks **lit normally again**: left ≈ 51,26,16 (0.2 × coral), front ≈ 141,71,45,
  front-top-left ≈ 171,102,76, highlight ≈ 232,165,139 (a whitish highlight: the light's specular is white).

## `light-color`
- **Task:** Let the light's colour change over time: `lightColor = (sin(t * 2.0), sin(t * 0.7), sin(t * 1.3))`, `diffuseColor = lightColor * 0.5`, `ambientColor = diffuseColor * 0.2`, and set them as `light.diffuse` / `light.ambient`.
- **Hint:** `glm::vec3 lightColor; lightColor.x = static_cast<float>(sin(glfwGetTime() * 2.0));` … then `lightingShader.setVec3("light.ambient", ambientColor); lightingShader.setVec3("light.diffuse", diffuseColor);` (the specular stays white).
- **When done:** in the loop, `glm::vec3 lightColor` with `.x = sin(glfwGetTime() * 2.0)`, `.y = sin(… * 0.7)`,
  `.z = sin(… * 1.3)` (each `static_cast<float>`), `glm::vec3 diffuseColor = lightColor * glm::vec3(0.5f);`,
  `glm::vec3 ambientColor = diffuseColor * glm::vec3(0.2f);`, `setVec3("light.ambient", ambientColor)`,
  `setVec3("light.diffuse", diffuseColor)`; `light.specular` stays (1, 1, 1). The cube's **colour changes over
  time**. At t = 1 s lightColor = (0.909, 0.644, 0.964): left ≈ 23,8,8, front ≈ 105,38,35, front-top-left ≈ 135,70,67,
  highlight ≈ 196,133,130 (a dark red-brown cube). The lamp stays white (its shader ignores the light colour).
  Final state (= learnopengl's `materials.cpp`).

Optional exercise of the chapter (not a task): learnopengl's `materials_exercise1` – a **cyan plastic** cube: light
ambient/diffuse/specular all (1, 1, 1), material ambient (0.0, 0.1, 0.06), diffuse (0.0, 0.50980392, 0.50980392),
specular (0.50196078, 0.50196078, 0.50196078), shininess 32 (values from devernay.free.fr's material table).
