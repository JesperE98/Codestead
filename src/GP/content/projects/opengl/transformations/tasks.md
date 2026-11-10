# Transformations – tasks (OpenGL)

learnopengl "Transformations" (`transformations.cpp`, then the chapter's exercises 1 and 2). Files: `main.cpp`,
`shader_s.h` (the `Shader` class of the Shaders chapter), `shader.vs`, `shader.fs`, `container.png`, `awesomeface.png`.

Start: the Textures project after `texture-units` (two textures, `mix(…, 0.2)`, no flip, no repeat, no `mixValue`),
tidied the way learnopengl's `transformations.cpp` is: the unused vertex colours are gone – each vertex is a position and
texture coordinates (5 floats, stride `5 * sizeof(float)`, texture coordinates are attribute **1** now:
`layout (location = 1) in vec2 aTexCoord;`), `shader.fs` no longer declares `ourColor`, and the render loop calls
`ourShader.use();` under `// activate shader` before a `// TODO:` for the transform, then `// render container`
(`glBindVertexArray(VAO); glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);`). The picture is the one after
`texture-units`: the crate with the faint smiley, x 200..600, y 150..450 (pixel coordinates from the top left of the
800×600 window): centre (400,300) ≈ 125,89,30, plank (260,200) ≈ 117,77,42, frame (204,300) ≈ 74,46,22, face
(400,209) ≈ 168,120,50, heart on the right (489,323) ≈ 161,83,54; background teal ≈ 51,76,76.

The transform is a `uniform mat4 transform` in the vertex shader (`gl_Position = transform * vec4(aPos, 1.0);`), set
from C++ with `glGetUniformLocation(ourShader.ID, "transform")` + `glUniformMatrix4fv(transformLoc, 1, GL_FALSE,
glm::value_ptr(transform))` (as learnopengl). GLM rotates counter-clockwise for a positive angle about +z. The
transform works in normalized device coordinates, so a rotated container looks squashed on the 4:3 window – that is
expected (the next chapter fixes it with a projection).

Pixel values were measured with Mesa (llvmpipe) on copies of the projects with `glfwGetTime()` replaced by `1.0`
(the pictures from task 2 on move with time; verify.sh's own screenshot is taken after about 3 s).

## `transform-uniform`
- **Task:** Include GLM and give the vertex shader a `uniform mat4 transform` that multiplies the position. In the render loop build `transform`: rotate 90° about the z axis, then scale by 0.5, and pass it to the shader.
- **Hint:** `#include <glm/glm.hpp>`, `<glm/gtc/matrix_transform.hpp>`, `<glm/gtc/type_ptr.hpp>`. Start from the identity `glm::mat4(1.0f)`, then `glm::rotate(transform, glm::radians(90.0f), glm::vec3(0.0f, 0.0f, 1.0f))` and `glm::scale(transform, glm::vec3(0.5f, 0.5f, 0.5f))`. Set the uniform with `glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(transform));` after `ourShader.use()`.
- **When done:** `main.cpp` includes the three GLM headers after `stb_image.h`; in the loop after `ourShader.use();`:
  `glm::mat4 transform = glm::mat4(1.0f);`, `transform = glm::rotate(transform, glm::radians(90.0f), glm::vec3(0.0f, 0.0f, 1.0f));`,
  `transform = glm::scale(transform, glm::vec3(0.5f, 0.5f, 0.5f));`,
  `unsigned int transformLoc = glGetUniformLocation(ourShader.ID, "transform");`,
  `glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(transform));`. `shader.vs` declares
  `uniform mat4 transform;` and writes `gl_Position = transform * vec4(aPos, 1.0);`. The container is **half as big and
  turned a quarter turn counter-clockwise**: x 300..500, y 225..375, its top now on the left – the brace runs from the
  top-left to the bottom-right corner, the heart is above the face's centre: (415,267) ≈ 158,82,53. Centre (400,300)
  ≈ 125,89,30, frame at (305,300) and (400,230) ≈ 74,46,22, face (440,345) ≈ 179,128,54; background at (250,300) and
  (500,380). Not time-dependent.

## `translate-rotate`
- **Task:** Replace the rotation and scale with learnopengl's transform: first `glm::translate` by (0.5, -0.5, 0.0), then `glm::rotate` by the time (`(float)glfwGetTime()` radians) about the z axis.
- **Hint:** The matrix applies the last call first: the container is rotated about its own centre and then moved to the bottom right.
- **When done:** the two lines are `transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));` and
  `transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));`. The full-size container
  **spins counter-clockwise about its centre at (600,450)** in the bottom-right corner (partly outside the window),
  one turn every 2π s. At t = 1 s (turned 57°): its centre (600,450) ≈ 125,89,30 (the brace crossing is always at the
  centre), face (650,420) ≈ 168,120,50; background at (400,300), (200,150) and (100,500). Robust at any time: (600,450)
  is crate, (200,150) and (100,100) are background.

## `rotate-first`
- **Task:** Exercise 1: swap the two transformation calls – rotate first, then translate – and watch what happens.
- **Hint:** Now the vertices are translated first and then rotated about the origin (the window's centre): the container orbits the centre instead of spinning in place.
- **When done:** `transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));` comes
  before `transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));` (with a comment). The container
  **circles around the window centre** (one of its corners always touches (400,300)), turning with it. At t = 1 s its
  centre is at about (676,255) ≈ 125,89,30, i.e. upper right; (600,280) ≈ 136,91,50 is crate; background at (200,450),
  (100,100) and right at (400,300). At t ≈ 3 s it is in the upper left (centre ≈ (230,130)).

## `second-container`
- **Task:** Exercise 2: after the first draw, draw a second container at the top left (translate by (-0.5, 0.5, 0.0)) that grows and shrinks with `sin(time)`: reset `transform` to the identity, set the new matrix and call `glDrawElements` again.
- **Hint:** `float scaleAmount = static_cast<float>(sin(glfwGetTime()));` and `glm::scale(transform, glm::vec3(scaleAmount, scaleAmount, scaleAmount))`. The uniform keeps its value until you set it again, so upload the new matrix before the second draw.
- **When done:** after the first `glDrawElements`: `transform = glm::mat4(1.0f);`,
  `transform = glm::translate(transform, glm::vec3(-0.5f, 0.5f, 0.0f));`,
  `float scaleAmount = static_cast<float>(sin(glfwGetTime()));`,
  `transform = glm::scale(transform, glm::vec3(scaleAmount, scaleAmount, scaleAmount));`,
  `glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(transform));` and a second
  `glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);` – two draw calls per frame. The orbiting container of
  `rotate-first` stays; a **second, unrotated container centred at (200,150)** pulses: full size × sin(t) (at negative
  values it appears upside down, at 0 it vanishes). At t = 1 s (scale 0.84) it covers about x 32..368, y 24..276:
  centre (200,150) ≈ 125,89,30, (100,60) ≈ 128,85,46, frame (60,150) ≈ 108,73,26; the first container's centre
  (676,255) ≈ 125,89,30; background at (400,300), (200,450) and (600,550). Final state (equals learnopengl's
  `transformations_exercise2.cpp` except for the swapped order of exercise 1).
