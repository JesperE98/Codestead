# Coordinate Systems – tasks (OpenGL)

learnopengl "Coordinate Systems": `coordinate_systems.cpp` (the plane), `coordinate_systems_depth.cpp` (the spinning
cube with depth testing), `coordinate_systems_multiple.cpp` (ten cubes) and exercise 3 (`i % 3 == 0` rotates).
Files: `main.cpp`, `shader_m.h`, `shader.vs`, `shader.fs`, `container.png`, `awesomeface.png`.

Start: the Transformations project with the transform taken out again, so the container lies flat in the middle of
the window as at the start of Transformations (x 200..600, y 150..450; centre (400,300) ≈ 125,89,30, plank (260,200)
≈ 117,77,42, frame (204,300) ≈ 74,46,22, heart (489,323) ≈ 161,83,54; background teal ≈ 51,76,76):
`shader.vs` writes `gl_Position = vec4(aPos, 1.0);`, the render loop has `ourShader.use();` and then
`// TODO: create the model, view and projection matrices and pass them to the shader` before `// render container`
(one `glDrawElements`). New in the start: the shader class is learnopengl's **`shader_m.h`** (`#include "shader_m.h"`) –
the same class with `setVec2/3/4` and `setMat2/3/4` added (`setMat4(name, mat)` = `glUniformMatrix4fv(…, 1,
GL_FALSE, &mat[0][0])`), as learnopengl switches to it in this chapter. The GLM includes stay.

All matrices are uniforms set with `ourShader.setMat4("model" | "view" | "projection", …)` after `ourShader.use()`.
The projection is `glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f)` and the
view `glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f))` throughout. Pixel values were measured with Mesa (llvmpipe)
on copies with `glfwGetTime()` replaced by `1.0` (pixel coordinates from the top left of the 800×600 window).

## `plane`
- **Task:** Give the vertex shader `uniform mat4 model;`, `view` and `projection` and compute `gl_Position = projection * view * model * vec4(aPos, 1.0);`. In the loop create the three matrices – model: rotate -55° about the x axis, view: translate by (0, 0, -3), projection: perspective 45°, 800/600, 0.1, 100 – and pass them with `ourShader.setMat4`.
- **Hint:** Read the multiplication from right to left: model first, projection last. `glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f)`. Moving the camera back is the same as moving the scene forward (-z).
- **When done:** `shader.vs` declares `uniform mat4 model; uniform mat4 view; uniform mat4 projection;` and writes
  `gl_Position = projection * view * model * vec4(aPos, 1.0);`. In the loop: `glm::mat4 model`, `view`, `projection`
  initialised to `glm::mat4(1.0f)`, `model = glm::rotate(model, glm::radians(-55.0f), glm::vec3(1.0f, 0.0f, 0.0f));`,
  `view = glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f));`, `projection = glm::perspective(...)` as above, then
  `ourShader.setMat4("model", model); ourShader.setMat4("view", view); ourShader.setMat4("projection", projection);`.
  The container is a **floor tilted back**: a trapezoid, narrow at the far (top) edge – y 239..380, the top edge
  x ≈ 293..506, the bottom edge x ≈ 261..538. Centre (400,300) ≈ 125,89,30 (brace), (400,250) ≈ 179,128,54, the near
  frame (400,370), (268,375) and (532,375) ≈ 74,46,22; background at (400,200) and (100,100). Not time-dependent.

## `cube`
- **Task:** Replace the rectangle with learnopengl's cube: 36 vertices (6 faces × 2 triangles × 3 vertices, position + texture coordinates), drop the element buffer (`indices`, `EBO`) and draw with `glDrawArrays(GL_TRIANGLES, 0, 36)`.
- **Hint:** Copy the 36 vertices from the chapter. The vertex layout (5 floats) and the attribute pointers stay the same. Remove `glGenBuffers(1, &EBO)`, the `GL_ELEMENT_ARRAY_BUFFER` binding/upload and `glDeleteBuffers(1, &EBO)`.
- **When done:** `vertices[]` holds 36 × 5 floats (learnopengl's cube, each face with texture coordinates 0..1); no
  `indices` and no `EBO` anywhere; `unsigned int VBO, VAO;`; the loop draws with `glDrawArrays(GL_TRIANGLES, 0, 36);`
  (comment `// render box`). The model still tilts by -55° about x: a **tilted cube, drawn without depth testing**, so
  faces drawn later cover nearer ones – the far face shows through: x ≈ 243..557, y ≈ 138..475; two faces with a
  smiley are visible, one above the other, with their hearts at (450,222) and (465,362) ≈ 161,83,54; frame
  (400,145), (300,250), (500,250) ≈ 74,46,22; (400,300) ≈ 179,128,54; background at (100,100). Not time-dependent.

## `spin`
- **Task:** Let the cube rotate with time: model = rotate by `(float)glfwGetTime()` radians about the axis (0.5, 1.0, 0.0).
- **Hint:** `glm::rotate` normalises the axis for you. Without depth testing the cube looks wrong – some back faces are drawn over the front ones. That is the next task.
- **When done:** `model = glm::rotate(model, (float)glfwGetTime(), glm::vec3(0.5f, 1.0f, 0.0f));` replaces the -55°
  rotation. The cube **turns about a slanted axis** (time-dependent, one turn every 2π s), still with faces in the
  wrong order. At t = 1 s: the content covers x ≈ 216..595, y ≈ 146..509; a back face's heart is visible at (494,240)
  ≈ 161,83,54 and the face at (440,260) ≈ 160,114,46 (both are covered after `depth-test`); (340,270) heart
  ≈ 161,83,54; background at (100,100).

## `depth-test`
- **Task:** Enable depth testing with `glEnable(GL_DEPTH_TEST)` (once, after GLAD is loaded) and clear the depth buffer every frame together with the colour buffer.
- **Hint:** `glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);` – without clearing, the depth values of the last frame would hide this frame's fragments.
- **When done:** `glEnable(GL_DEPTH_TEST);` under `// configure global opengl state` before the shader is built, and
  `glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);` in the loop. The **cube is solid**: only the three near faces
  are visible. At t = 1 s: same outline as after `spin`; (494,240) and (440,260) are now the near frame ≈ 74,46,22,
  hearts at (340,270) ≈ 161,83,54 (left face) and (523,352) ≈ 159,82,54 (right face), (400,300) ≈ 118,77,42; background
  (100,100). Time-dependent (it keeps spinning).

## `ten-cubes`
- **Task:** Draw ten cubes: add learnopengl's `glm::vec3 cubePositions[10]` and, in the loop, for every `i` build a model matrix – translate to `cubePositions[i]`, rotate by `20.0f * i` degrees about (1.0, 0.3, 0.5) – set it and call `glDrawArrays`. View and projection are set once per frame before the loop.
- **Hint:** `for (unsigned int i = 0; i < 10; i++) { glm::mat4 model = glm::mat4(1.0f); model = glm::translate(model, cubePositions[i]); float angle = 20.0f * i; model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f)); ourShader.setMat4("model", model); glDrawArrays(GL_TRIANGLES, 0, 36); }`
- **When done:** `cubePositions[]` after `vertices[]` = (0, 0, 0), (2, 5, -15), (-1.5, -2.2, -2.5), (-3.8, -2, -12.3),
  (2.4, -0.4, -3.5), (-1.7, 3, -7.5), (1.3, -2, -2.5), (1.5, 2, -2.5), (1.5, 0.2, -1.5), (-1.3, 1, -1.5). Per frame:
  `view` (translate (0, 0, -3)) and `projection` set with `setMat4`, no model outside the loop; the `for` loop makes
  **10 draw calls** of 36 vertices, each with its own `model`. **Ten crates** spread over the window, **not moving**
  (no time any more): cube 0 faces the camera flat in the middle, x ≈ 258..546, y ≈ 158..446 – centre (400,300)
  ≈ 125,89,30, its heart (468,325) ≈ 161,83,54, frame corner (540,440) ≈ 74,46,22; other crates at (290,190) ≈ 128,85,46
  (cube 9, upper left), (600,70) ≈ 136,91,50, the small far cube at (483,100) ≈ 125,89,30, (220,395) ≈ 136,93,41; background
  at (100,330), (380,80) and (30,560).

## `rotate-every-third`
- **Task:** Exercise 3: make every 3rd cube (including the first, `i % 3 == 0`) rotate over time – set its angle to `glfwGetTime() * 25.0f` degrees – while the others stay put.
- **Hint:** `if (i % 3 == 0) angle = (float)glfwGetTime() * 25.0f;` after `float angle = 20.0f * i;`.
- **When done:** inside the loop, after `float angle = 20.0f * i;`:
  `if (i % 3 == 0) angle = (float)glfwGetTime() * 25.0f;`. Cubes 0, 3, 6 and 9 turn slowly (25° per second), the other
  six stay as after `ten-cubes`. At t = 1 s cube 0 is turned by 25°: centre (400,300) ≈ 168,120,50, its heart moves to
  (486,355) ≈ 151,80,52, (468,325) ≈ 167,117,53; cube 9 (upper left) at (290,140) ≈ 84,53,26; unchanged: the small far
  cube at (483,100) ≈ 125,89,30; background at (100,330), (380,80) and (300,470). Final state.
