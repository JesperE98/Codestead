# Basic Lighting – tasks (OpenGL)

learnopengl "Basic Lighting": `basic_lighting_diffuse.cpp` (2.1), `basic_lighting_specular.cpp` (2.2) and exercise 1
(`basic_lighting_exercise1.cpp`, the moving light). Files: `main.cpp`, `shader_m.h`, `basic_lighting.vs`,
`basic_lighting.fs` (the lit cube), `light_cube.vs`, `light_cube.fs` (the lamp).

Start (prepared from the Colors solution): the shader files are renamed to `basic_lighting.vs/.fs` (same contents as
`colors.vs/.fs`; `Shader lightingShader("basic_lighting.vs", "basic_lighting.fs");`), and the vertex data is
learnopengl's **36 vertices with position + normal** (6 floats, comment `// positions // normals`). Both VAOs' position
attributes use the stride `6 * sizeof(float)` (the lamp's with learnopengl's comment about the updated stride); the
normal attribute is a TODO. Same camera as Colors (front-left: cameraPos (-3, 0, 3), cameraFront normalize(3.5, 0.4,
-2.2), yaw -32.2, pitch 5.5).

Pixels measured with Mesa (llvmpipe) on copies with `glfwGetTime()` replaced by `1.0`, coordinates from the top left of
the 800×600 window. Named points: **front** (302,370) = centre of the cube's front face (+z, the face on the right),
**front-top-left** (271,320), **highlight** (243,278) = upper-left corner region of the front face where the specular
highlight appears, **left** (163,370) = centre of the left face (−x, never lit by this light), **lamp** (641,195),
**background** (400,300) and (100,100) = 26,26,26 (clear colour 0.1).

Start picture = the Colors result: flat coral cube 255,128,79 everywhere (front, left, highlight), white lamp at
(641,195).

## `ambient`
- **Task:** Replace the flat colour by ambient lighting: in `basic_lighting.fs` compute `ambient = 0.1 * lightColor` and output `ambient * objectColor`.
- **Hint:** `float ambientStrength = 0.1; vec3 ambient = ambientStrength * lightColor; vec3 result = ambient * objectColor; FragColor = vec4(result, 1.0);`
- **When done:** `basic_lighting.fs` has `// ambient`, `float ambientStrength = 0.1;`,
  `vec3 ambient = ambientStrength * lightColor;`, `vec3 result = ambient * objectColor;`,
  `FragColor = vec4(result, 1.0);`. The cube becomes **very dark coral 26,13,8** on every face (front, left,
  highlight); the lamp stays white (it has its own shader).

## `normals`
- **Task:** Feed the normals to the shaders: enable vertex attribute 1 (3 floats after the position), give `basic_lighting.vs` an input `aNormal` and outputs `FragPos` (the world-space position) and `Normal`, and give `basic_lighting.fs` the matching inputs.
- **Hint:** `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));` + `glEnableVertexAttribArray(1);`. In the vertex shader: `FragPos = vec3(model * vec4(aPos, 1.0)); Normal = aNormal; gl_Position = projection * view * vec4(FragPos, 1.0);`
- **When done:** `main.cpp` (cube VAO only): `// normal attribute`, `glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));`,
  `glEnableVertexAttribArray(1);`. `basic_lighting.vs`: `layout (location = 1) in vec3 aNormal;`,
  `out vec3 FragPos; out vec3 Normal;`, the three lines of the hint. `basic_lighting.fs`: `in vec3 Normal;
  in vec3 FragPos;` (not used yet). **No visible change** (dark coral 26,13,8).

## `diffuse`
- **Task:** Add diffuse lighting: a `uniform vec3 lightPos;` in the fragment shader, the light direction `normalize(lightPos - FragPos)`, `diff = max(dot(norm, lightDir), 0.0)`, and `result = (ambient + diffuse) * objectColor`; pass `lightPos` from `main.cpp`.
- **Hint:** Normalize the interpolated normal first: `vec3 norm = normalize(Normal);`. `vec3 diffuse = diff * lightColor;`. In the loop: `lightingShader.setVec3("lightPos", lightPos);`
- **When done:** `basic_lighting.fs` declares `uniform vec3 lightPos;` and has the `// diffuse` block (`norm`,
  `lightDir`, `diff`, `diffuse`), `vec3 result = (ambient + diffuse) * objectColor;`; `main.cpp` calls
  `lightingShader.setVec3("lightPos", lightPos);`. The **front face is lit** (it faces the lamp): front ≈ 202,101,63,
  front-top-left ≈ 198,99,61, highlight ≈ 192,96,59 (it varies smoothly over the face); the **left face stays dark**
  26,13,8 (it faces away from the light: `diff` = 0, only ambient).

## `normal-matrix`
- **Task:** Transform the normals into world space correctly in `basic_lighting.vs`: `Normal = mat3(transpose(inverse(model))) * aNormal;`
- **Hint:** The normal matrix (the transpose of the inverse of the model matrix's upper-left 3×3) keeps normals perpendicular to the surface even under non-uniform scaling. `inverse` is expensive on the GPU – real programs compute it on the CPU.
- **When done:** `basic_lighting.vs` has `Normal = mat3(transpose(inverse(model))) * aNormal;` instead of
  `Normal = aNormal;`. The cube's model matrix is the identity, so **nothing visible changes** (front ≈ 202,101,63).

## `specular`
- **Task:** Add specular lighting: `uniform vec3 viewPos;`, `specularStrength = 0.5`, the view direction, the reflected light direction, `spec = pow(max(dot(viewDir, reflectDir), 0.0), 32)`, and `result = (ambient + diffuse + specular) * objectColor`; pass the camera position as `viewPos`.
- **Hint:** `vec3 viewDir = normalize(viewPos - FragPos); vec3 reflectDir = reflect(-lightDir, norm);` (`reflect` expects the vector pointing from the light to the fragment). In the loop: `lightingShader.setVec3("viewPos", cameraPos);`
- **When done:** `basic_lighting.fs` declares `uniform vec3 viewPos;` and has the `// specular` block
  (`specularStrength = 0.5`, `viewDir`, `reflectDir`, `spec` with exponent `32`, `specular = specularStrength * spec * lightColor`),
  `vec3 result = (ambient + diffuse + specular) * objectColor;`; `main.cpp`:
  `lightingShader.setVec3("viewPos", cameraPos);`. A **highlight** appears in the upper-left part of the front face:
  highlight (243,278) 192,96,59 → **255,145,90**, front-top-left 198,99,61 → 232,116,72; front centre ≈ 203,102,63
  and the lower right of the face almost unchanged; left face 26,13,8. (= learnopengl's `basic_lighting_specular.cpp`.)

## `moving-light`
- **Task:** Exercise: move the light over time – at the start of each frame's rendering set `lightPos.x = 1.0 + sin(time) * 2.0` and `lightPos.y = sin(time / 2.0) * 1.0`.
- **Hint:** Do it before `lightPos` is used (the lighting uniforms and the lamp's model matrix). `lightPos.x = static_cast<float>(1.0 + sin(glfwGetTime()) * 2.0);`
- **When done:** in the render loop, before `lightingShader.use();`:
  `lightPos.x = static_cast<float>(1.0 + sin(glfwGetTime()) * 2.0);` and
  `lightPos.y = static_cast<float>(sin(glfwGetTime() / 2.0) * 1.0);`. The **lamp moves** (and the lighting on the
  cube with it). At t = 1 s: lightPos = (2.68, 0.48, 2.0), the lamp is at x ≈ 677..711, y ≈ 289..318 (centre (694,304)
  = 255,255,255), the old lamp point (641,195) is background; front ≈ 198,99,61, front-top-left ≈ 182,91,57,
  highlight ≈ 153,77,47 (the highlight moved off that point), left 26,13,8. Time-dependent: the lamp swings between
  x = −1 and 3 (period 2π s).

Optional exercises of the chapter (not tasks): play with the ambient/specular strengths and the shininess; do the
lighting in **view space** (learnopengl's `basic_lighting_exercise2`: pass `view * model` positions and normals and the
view-space light position, `viewDir = normalize(-FragPos)` – the same picture); **Gouraud shading** (exercise 3:
compute the lighting in the vertex shader and interpolate the colour – the highlight becomes blocky, because the cube
has only 4 vertices per face). The next chapter starts again with a fixed light.
