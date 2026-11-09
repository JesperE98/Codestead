# Colors – tasks (OpenGL)

learnopengl "Colors": `colors.cpp` with `1.colors.vs/.fs` and `1.light_cube.vs/.fs`. Files: `main.cpp`,
`shader_m.h`, `colors.vs`, `colors.fs` (the lit object: `lightingShader`), `light_cube.vs`, `light_cube.fs` (the lamp:
`lightCubeShader`). learnopengl numbers its shader files per chapter (`1.colors.vs`); the course drops the numbers.

Start (prepared from the Camera solution): the free camera with its globals, callbacks and `processInput` stays, but
the scene is reduced to what learnopengl starts the lighting part with – **one cube at the origin**, 36 vertices with
**positions only** (`3 * sizeof(float)` stride, one attribute), `unsigned int VBO, cubeVAO;`, no textures any more (no
`stb_image.h`, no texture objects), clear colour **(0.1, 0.1, 0.1)** as in learnopengl's lighting chapters. The shader
program is `Shader lightingShader("colors.vs", "colors.fs");`; per frame `projection` =
`glm::perspective(glm::radians(fov), 800/600, 0.1, 100)`, `view` = `glm::lookAt(cameraPos, cameraPos + cameraFront,
cameraUp)`, `model` = identity, set with `lightingShader.setMat4`. `colors.fs` still writes plain white.
`light_cube.vs` is complete (the same as `colors.vs`); `light_cube.fs` has an empty `main` with a TODO.

**New default camera for the lighting chapters** (the same in every API): learnopengl's lamp at (1.2, 1, 2) is outside
the view of a camera at (0, 0, 3), so the camera starts front-left of the cube:
`cameraPos = glm::vec3(-3.0f, 0.0f, 3.0f)`, `cameraFront = glm::normalize(glm::vec3(3.5f, 0.4f, -2.2f))`, and the
mouse-look globals match it, `yaw = -32.2f`, `pitch = 5.5f` (comment `// camera: look at the cube's lit front and the
lamp from the left`). It sees the cube's front face (+z, on the right, x ≈ 233..357) and its left face (−x, x ≈
99..235), cube y ≈ 265..476, and the lamp (x ≈ 619..664, y ≈ 172..216). Colors, Basic Lighting, Materials and Lighting
Maps keep this camera; Light Casters and Multiple Lights go back to (0, 0, 3).

Pixels were measured with Mesa (llvmpipe) on copies with `glfwGetTime()` replaced by `1.0` (nothing in this chapter
depends on time), coordinates from the top left of the 800×600 window. Named points: **front** (302,370) = centre of
the front face, **left** (163,370) = centre of the left face, **lamp** (641,195), **background** (400,300) and
(100,100) = 26,26,26.

Start picture: a flat **white** cube silhouette (front 255,255,255, left 255,255,255), no lamp (lamp point =
background 26,26,26).

## `object-color`
- **Task:** Colour the cube as learnopengl does: in `colors.fs` declare `uniform vec3 objectColor;` and `uniform vec3 lightColor;` and output `vec4(lightColor * objectColor, 1.0)`; in the render loop set the object's colour to coral (1.0, 0.5, 0.31) and the light's colour to white (1.0, 1.0, 1.0).
- **Hint:** The colour we see is the light's colour multiplied component by component with the object's colour. After `lightingShader.use();`: `lightingShader.setVec3("objectColor", 1.0f, 0.5f, 0.31f);` and `lightingShader.setVec3("lightColor", 1.0f, 1.0f, 1.0f);`.
- **When done:** `colors.fs` has the two uniforms and `FragColor = vec4(lightColor * objectColor, 1.0);`; `main.cpp` calls
  `lightingShader.setVec3("objectColor", 1.0f, 0.5f, 0.31f);` and `lightingShader.setVec3("lightColor", 1.0f, 1.0f, 1.0f);`
  after `lightingShader.use();` every frame. The cube is **flat coral 255,128,79** on every visible face (front and
  left the same colour – no shading yet). Lamp point still background.

## `lamp-shader`
- **Task:** Give the lamp its own shader program: `light_cube.fs` always outputs white (`vec4(1.0)`), and `main.cpp` builds `Shader lightCubeShader("light_cube.vs", "light_cube.fs");` next to `lightingShader`.
- **Hint:** The lamp must stay white whatever we do to the lighting shader later, so it gets a separate program. `light_cube.vs` is already the same as `colors.vs`.
- **When done:** `light_cube.fs`: `FragColor = vec4(1.0);`; `main.cpp`: `Shader lightCubeShader("light_cube.vs", "light_cube.fs");`
  after `lightingShader`. Nothing is drawn with it yet: **no visible change** (coral cube, no lamp).

## `lamp`
- **Task:** Draw the lamp: a global `glm::vec3 lightPos(1.2f, 1.0f, 2.0f);`, a second VAO `lightCubeVAO` that uses the same VBO (position attribute only), and in the loop, after the cube, draw it with `lightCubeShader` – model = translate to `lightPos`, then scale by 0.2.
- **Hint:** `lightCubeShader.use();` then set its `projection` and `view` (the same matrices) and `model = glm::mat4(1.0f); model = glm::translate(model, lightPos); model = glm::scale(model, glm::vec3(0.2f));`, then `glBindVertexArray(lightCubeVAO); glDrawArrays(GL_TRIANGLES, 0, 36);`. Delete the new VAO at the end.
- **When done:** global `// lighting` `glm::vec3 lightPos(1.2f, 1.0f, 2.0f);` (after the timing globals);
  `unsigned int lightCubeVAO;` with `glGenVertexArrays`, `glBindVertexArray(lightCubeVAO)`,
  `glBindBuffer(GL_ARRAY_BUFFER, VBO)`, `glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0)`,
  `glEnableVertexAttribArray(0)`; in the loop after the cube's draw: `lightCubeShader.use()`, `setMat4("projection")`,
  `setMat4("view")`, `model` = translate(lightPos) · scale(0.2), `setMat4("model")`, bind `lightCubeVAO`,
  `glDrawArrays(GL_TRIANGLES, 0, 36)`; `glDeleteVertexArrays(1, &lightCubeVAO);` at the end. A **small white cube**
  appears at the top right: lamp point (641,195) = 255,255,255 (x ≈ 619..664, y ≈ 172..216); the coral cube unchanged.
  Final state (= learnopengl's `colors.cpp` with the course's camera globals).
