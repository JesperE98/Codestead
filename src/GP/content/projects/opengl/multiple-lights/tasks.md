# Multiple Lights – tasks (OpenGL)

learnopengl "Multiple lights": `multiple_lights.cpp` with `6.multiple_lights.vs/.fs` and `6.light_cube.vs/.fs`. Files:
`main.cpp`, `shader_m.h`, `multiple_lights.vs`, `multiple_lights.fs`, `light_cube.vs`, `light_cube.fs`,
`container2.png`, `container2_specular.png`.

Start (prepared from the Light Casters solution): the ten containers, the diffuse + specular maps, shininess 32, the
camera at (0, 0, 3) looking down -z (comment `// camera: at (0, 0, 3) looking down -z, so all ten containers are in
view`; yaw -90, pitch 0), the lamp's VAO and `lightCubeShader`. The vertex shader is renamed to `multiple_lights.vs`
(unchanged). `multiple_lights.fs` is a fresh skeleton: `struct Material { sampler2D diffuse; sampler2D specular; float shininess; };`,
the inputs, `uniform vec3 viewPos; uniform Material material;`, and a `main()` that computes `norm` and `viewDir`, sets
`vec3 result = vec3(0.0);` and has three TODOs (phase 1: directional light, phase 2: point lights, phase 3: spot light)
before `FragColor = vec4(result, 1.0);`. In `main.cpp` the loop sets only `viewPos` and `material.shininess`, followed
by learnopengl's comment block about setting the uniforms of all lights by hand and three TODOs (directional light,
point lights 1 to 4, spot light); the `lightPos` global is gone; a TODO stands where the lamps are drawn.

Pixels measured with Mesa (llvmpipe) on copies with `glfwGetTime()` replaced by `1.0` (nothing depends on time),
coordinates from the top left of the 800×600 window. Container 0 faces the camera (front face x ≈ 255..545, y ≈
155..445). Named points: **centre** (400,300) = wood of container 0, **frame** (265,300) = its left steel frame,
**top-frame** (400,165), **corner** (262,162), **spot-edge** (330,230) = wood inside the flashlight's soft edge, **c8**
(640,260), **c7** (600,70), **c9** (191,139), **far** (483,100), **right-border** (797,160), **background** (400,520) and
(30,300) = 26,26,26.

Start picture: **all containers black** 0,0,0 (no light yet) on the 26,26,26 background.

## `dir-light`
- **Task:** Add the directional light: a `DirLight` struct (direction, ambient, diffuse, specular), `uniform DirLight dirLight;`, the function `vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir)` (declared before `main`, defined after it) and `vec3 result = CalcDirLight(dirLight, norm, viewDir);` as phase 1; set learnopengl's values: direction (-0.2, -1.0, -0.3), ambient 0.05, diffuse 0.4, specular 0.5.
- **Hint:** The function does what the directional light of Light Casters did: `lightDir = normalize(-light.direction)`, `diff`, `reflectDir`, `spec` with `material.shininess`, then `ambient`, `diffuse`, `specular` from the two maps, and returns their sum. `lightingShader.setVec3("dirLight.direction", -0.2f, -1.0f, -0.3f);` …
- **When done:** `multiple_lights.fs`: `struct DirLight { vec3 direction; vec3 ambient; vec3 diffuse; vec3 specular; };`
  after `Material`, `uniform DirLight dirLight;` before `uniform Material material;`, `// function prototypes`
  `vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir);`, phase 1 `vec3 result = CalcDirLight(dirLight, norm, viewDir);`,
  and the function body after `main` (learnopengl's). `main.cpp`: `// directional light` with
  `setVec3("dirLight.direction", -0.2f, -1.0f, -0.3f)`, `("dirLight.ambient", 0.05f, 0.05f, 0.05f)`,
  `("dirLight.diffuse", 0.4f, 0.4f, 0.4f)`, `("dirLight.specular", 0.5f, 0.5f, 0.5f)`. The containers are **dimly lit
  from above**: centre ≈ 24,16,8, frame ≈ 24,25,26, c8 ≈ 10,7,4, c7 ≈ 7,5,3, far ≈ 9,6,3; faces turned up are
  brighter, c9 ≈ 48,32,18.

## `point-lights`
- **Task:** Add four point lights: a `PointLight` struct (position, constant, linear, quadratic, ambient, diffuse, specular), `#define NR_POINT_LIGHTS 4`, `uniform PointLight pointLights[NR_POINT_LIGHTS];`, `CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir)` with attenuation, and phase 2 – a loop adding every point light; in `main.cpp` learnopengl's `pointLightPositions` and, for each of the four, position, ambient 0.05, diffuse 0.8, specular 1.0, constant 1.0, linear 0.09, quadratic 0.032.
- **Hint:** Array elements and their fields are set by name: `lightingShader.setVec3("pointLights[0].position", pointLightPositions[0]);`. Positions: (0.7, 0.2, 2.0), (2.3, -3.3, -4.0), (-4.0, 2.0, -12.0), (0.0, 0.0, -3.0).
- **When done:** `multiple_lights.fs`: `struct PointLight { vec3 position; float constant; float linear; float quadratic; vec3 ambient; vec3 diffuse; vec3 specular; };`,
  `#define NR_POINT_LIGHTS 4`, `uniform PointLight pointLights[NR_POINT_LIGHTS];` after `dirLight`, the prototype and
  learnopengl's `CalcPointLight` (diffuse, specular, attenuation applied to all three terms), phase 2
  `for (int i = 0; i < NR_POINT_LIGHTS; i++) result += CalcPointLight(pointLights[i], norm, FragPos, viewDir);`.
  `main.cpp`: `glm::vec3 pointLightPositions[]` (4 entries) after `cubePositions`, and `// point light 1` … `// point light 4`,
  each with 7 setters (`pointLights[i].position/ambient/diffuse/specular/constant/linear/quadratic`). The scene is
  **much brighter**, near containers most: centre ≈ 126,83,44, frame ≈ 111,113,117, top-frame ≈ 126,128,133, c9 ≈
  110,73,39, c7 ≈ 97,64,33, c8 ≈ 69,48,25, far ≈ 66,43,23 (lit by the point light at (-4, 2, -12)).

## `spot-light`
- **Task:** Add the flashlight: a `SpotLight` struct (position, direction, cutOff, outerCutOff, constant, linear, quadratic, ambient, diffuse, specular), `uniform SpotLight spotLight;`, `CalcSpotLight` (attenuation × soft-edge intensity) and phase 3 `result += CalcSpotLight(spotLight, norm, FragPos, viewDir);`; set position = `cameraPos`, direction = `cameraFront`, ambient 0, diffuse 1, specular 1, constant 1, linear 0.09, quadratic 0.032, cutOff cos(12.5°), outerCutOff cos(15°).
- **Hint:** It is the soft spotlight of Light Casters as a function: `intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0)`, and all three terms are multiplied by `attenuation * intensity`.
- **When done:** `multiple_lights.fs`: the `SpotLight` struct before `#define NR_POINT_LIGHTS 4`,
  `uniform SpotLight spotLight;` after `pointLights`, the prototype, phase 3, and learnopengl's `CalcSpotLight` at the
  end. `main.cpp`: `// spotLight` with the ten setters of the task (`spotLight.position` = `cameraPos`,
  `spotLight.direction` = `cameraFront`, `glm::cos(glm::radians(12.5f))`, `glm::cos(glm::radians(15.0f))`). A **bright
  disc on container 0**: centre 126,83,44 → **244,164,93**, frame → 229,232,241, top-frame → 244,247,255, spot-edge
  (330,230) 105,70,37 → 200,135,72; the corner (262,162) ≈ 111,112,116 and the other containers unchanged (outside the
  cone).

## `lamps`
- **Task:** Draw a lamp at each point light: with `lightCubeShader` (projection and view as for the containers), a loop over the four `pointLightPositions`, each a cube scaled by 0.2.
- **Hint:** `model = glm::mat4(1.0f); model = glm::translate(model, pointLightPositions[i]); model = glm::scale(model, glm::vec3(0.2f));` then `lightCubeShader.setMat4("model", model); glDrawArrays(GL_TRIANGLES, 0, 36);` – bind `lightCubeVAO` once before the loop.
- **When done:** after the containers: `// also draw the lamp object(s)`, `lightCubeShader.use()`, `setMat4("projection")`,
  `setMat4("view")`, `glBindVertexArray(lightCubeVAO)`, `for (unsigned int i = 0; i < 4; i++)` with the model of the
  hint and one `glDrawArrays(GL_TRIANGLES, 0, 36)` each. With the camera at (0, 0, 3) the lamps are **hardly visible**:
  lamp 1 (0.7, 0.2, 2.0) shows only as a white sliver at the right border (x 795..799, y ≈ 100..234; right-border
  (797,160) 26,26,26 → 255,255,255), lamp 2 (2.3, -3.3, -4.0) is below the window, lamp 3 (-4, 2, -12) is hidden
  behind container 9, lamp 4 (0, 0, -3) behind container 0. Everything else unchanged (centre 244,164,93). Best
  checked in the code (4 draws with `lightCubeShader`). Moving the camera (S to step back, the mouse) shows them. Final
  state (= learnopengl's `multiple_lights.cpp` with the course's camera globals).

Optional exercise of the chapter (not a task): recreate learnopengl's "desert", "factory", "horror" and "biochemical
lab" atmospheres by changing the clear colour and the lights' colours.
