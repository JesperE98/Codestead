# Light Casters – tasks (OpenGL)

learnopengl "Light casters": `light_casters_directional.cpp` (5.1), `light_casters_point.cpp` (5.2),
`light_casters_spot.cpp` (5.3) and `light_casters_spot_soft.cpp` (5.4). Files: `main.cpp`, `shader_m.h`,
`light_casters.vs`, `light_casters.fs`, `light_cube.vs`, `light_cube.fs`, `container2.png`, `container2_specular.png`.

Start (prepared from the Lighting Maps solution without the emission exercise): shader files renamed to
`light_casters.vs/.fs` (diffuse + specular map, `Light { position; ambient; diffuse; specular; }`), `matrix.png` no
longer used. New in the start: learnopengl's **ten containers** – `glm::vec3 cubePositions[]` (the ten positions of
Coordinate Systems) and a `for` loop that draws each with `model = translate(cubePositions[i]) · rotate(20° · i about
(1.0, 0.3, 0.5))` (no time-dependent rotation, as in learnopengl), all lit by the point light at `lightPos (1.2, 1, 2)`
with `light.ambient` 0.2, `light.diffuse` 0.5, `light.specular` 1.0, `material.shininess` 64; the lamp is drawn as
before.

**Camera back to learnopengl's (0, 0, 3)** for this chapter and Multiple Lights (the same in every API):
`cameraPos (0, 0, 3)`, `cameraFront (0, 0, -1)`, `yaw = -90.0f`, `pitch = 0.0f` (comment `// camera: back at (0, 0, 3)
looking down -z, so all ten containers are in view`), so the containers are in view and the flashlight (at the camera)
lights container 0 in the centre. The lamp at (1.2, 1, 2) is then **outside the window** (to the right of the
camera); the lamp's draw call is still part of the steps below, but no lamp pixels are visible.

Pixels measured with Mesa (llvmpipe) on copies with `glfwGetTime()` replaced by `1.0` (nothing depends on time),
coordinates from the top left of the 800×600 window. Container 0 faces the camera: its front face is x ≈ 255..545,
y ≈ 155..445 (wood inside a steel frame). Named points: **centre** (400,300) = wood of container 0, **frame** (265,300)
= the left steel frame of container 0, **top-frame** (400,165), **corner** (262,162) = top-left corner of container 0
(outside the flashlight's inner cone), **right-edge** (560,300) = the container just right of container 0, **c8**
(640,260), **c7** (600,70), **c9** (191,139), **far** (483,100) = a far container (top), **background** (400,520) and
(30,300) = 26,26,26.

Start picture: centre ≈ 82,54,28, frame ≈ 76,77,80, top-frame ≈ 86,88,91, c8 ≈ 62,43,23, c7 ≈ 89,59,31, c9 ≈ 88,57,30,
far ≈ 103,67,35 (no attenuation yet: far containers are as bright as near ones).

## `directional`
- **Task:** Turn the light into a directional light: `Light` gets `vec3 direction;` instead of `position`, `lightDir = normalize(-light.direction)`; set `light.direction` to (-0.2, -1.0, -0.3) and shininess 32. A directional light has no position, so comment out the lamp's drawing.
- **Hint:** The direction points from the light towards the scene; the lighting maths wants the direction towards the light, hence the minus. `lightingShader.setVec3("light.direction", -0.2f, -1.0f, -0.3f);`
- **When done:** `light_casters.fs`: `struct Light { // vec3 position; vec3 direction; vec3 ambient; vec3 diffuse; vec3 specular; };`
  and `vec3 lightDir = normalize(-light.direction);`. `main.cpp`: `setVec3("light.direction", -0.2f, -1.0f, -0.3f)`
  instead of `light.position`; `material.shininess` 32.0; the lamp's draw block is commented out (comment: a lamp is
  weird with only a directional light). All containers are lit **from above, the same everywhere**: the front faces
  facing the camera get little light – centre ≈ 51,33,18, frame ≈ 51,52,54, c8 ≈ 30,21,11, c7 ≈ 29,19,10, far ≈ 31,20,11;
  faces turned upwards are brighter, e.g. c9 ≈ 79,53,30.

## `point-light`
- **Task:** Back to a point light, now with attenuation: `Light` gets `position` again plus `float constant, linear, quadratic;`, the fragment shader multiplies ambient, diffuse and specular by `1.0 / (constant + linear * d + quadratic * d²)`; set constant 1.0, linear 0.09, quadratic 0.032 (a range of about 50 units) and draw the lamp again.
- **Hint:** `float distance = length(light.position - FragPos);`, `float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));`, then `ambient *= attenuation; diffuse *= attenuation; specular *= attenuation;`. `lightingShader.setFloat("light.constant", 1.0f);` …
- **When done:** `light_casters.fs`: `struct Light { vec3 position; vec3 ambient; vec3 diffuse; vec3 specular; float constant; float linear; float quadratic; };`,
  `lightDir = normalize(light.position - FragPos)`, the `// attenuation` block. `main.cpp`:
  `setVec3("light.position", lightPos)`, `setFloat("light.constant", 1.0f)`, `("light.linear", 0.09f)`,
  `("light.quadratic", 0.032f)`; the lamp block is active again (lamp off-screen with this camera). Near containers
  lit, **far ones fade out**: centre ≈ 61,40,21, frame ≈ 54,54,57, top-frame ≈ 66,67,70, c8 ≈ 40,28,14, c7 ≈ 46,30,16,
  c9 ≈ 50,33,17, far (483,100) ≈ **9,6,3** (almost black). (= learnopengl's `light_casters_point.cpp`.)

## `spotlight`
- **Task:** Make the light a flashlight at the camera: `Light` gets `vec3 direction;` and `float cutOff;`; in the fragment shader compute `theta = dot(lightDir, normalize(-light.direction))` and light the fragment only if `theta > light.cutOff`, otherwise only ambient. Set `light.position` = `cameraPos`, `light.direction` = `cameraFront`, `light.cutOff` = `cos(12.5°)`, ambient 0.1, diffuse 0.8; comment out the lamp again.
- **Hint:** Compare cosines, not angles: `lightingShader.setFloat("light.cutOff", glm::cos(glm::radians(12.5f)));` – a bigger cosine means a smaller angle, hence `>`. Do not attenuate the ambient term inside the cone, or the inside could get darker than the outside.
- **When done:** `light_casters.fs`: `struct Light { vec3 position; vec3 direction; float cutOff; …ambient/diffuse/specular…; constant; linear; quadratic; };`,
  `main()` computes `lightDir` and `theta`, then `if (theta > light.cutOff)` { ambient, diffuse, specular, attenuation
  of diffuse and specular (`// ambient *= attenuation;` commented with learnopengl's reason), `FragColor` } `else`
  { `FragColor = vec4(light.ambient * texture(material.diffuse, TexCoords).rgb, 1.0);` }. `main.cpp`:
  `setVec3("light.position", cameraPos)`, `setVec3("light.direction", cameraFront)`,
  `setFloat("light.cutOff", glm::cos(glm::radians(12.5f)))`, `light.ambient` 0.1, `light.diffuse` 0.8 (with
  learnopengl's comment), the lamp block commented out. A **round, hard-edged spot of light** in the middle of
  container 0, everything else dim: centre ≈ 112,77,47, frame (265,300) ≈ 112,114,118, top-frame ≈ 112,114,118; the
  corner (262,162) ≈ 15,15,16 (outside the circle: ambient only), right-edge ≈ 55,36,19, other containers ≈ 12..15
  (c8 ≈ 12,9,4, c9 ≈ 13,9,5).

## `soft-edges`
- **Task:** Smooth the spotlight's edge: an `outerCutOff` (cos 17.5°) – `intensity = clamp((theta - outerCutOff) / (cutOff - outerCutOff), 0.0, 1.0)` scales diffuse and specular; replace the if/else by this (ambient, diffuse, specular, intensity, attenuation for all three, as in learnopengl's 5.4).
- **Hint:** Inside the inner cone intensity is 1, outside the outer cone 0, in between it fades linearly. `lightingShader.setFloat("light.outerCutOff", glm::cos(glm::radians(17.5f)));`
- **When done:** `light_casters.fs`: `float outerCutOff;` after `cutOff`; `main()` without `if`: ambient, diffuse,
  specular, `// spotlight (soft edges)` (`theta`, `epsilon = light.cutOff - light.outerCutOff`,
  `intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0)`, `diffuse *= intensity; specular *= intensity;`),
  `// attenuation` of all three terms, `result`. `main.cpp`:
  `lightingShader.setFloat("light.outerCutOff", glm::cos(glm::radians(17.5f)));`. The spot's **edge fades softly**:
  centre ≈ 107,75,45, frame ≈ 108,109,113, the corners of container 0 now in the soft zone – (262,162) ≈ 54,55,57,
  (538,162) ≈ 53,54,56 – right-edge ≈ 48,32,17; the other containers almost black (ambient is now attenuated too:
  c8, c7, c9 ≈ 6,4,2, far ≈ 3,2,1). Final state (= learnopengl's `light_casters_spot_soft.cpp`).
