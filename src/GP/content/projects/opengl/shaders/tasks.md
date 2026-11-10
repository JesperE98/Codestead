# Shaders – tasks (OpenGL)

learnopengl "Shaders". Files: `main.cpp`, learnopengl's `shader_s.h` (the `Shader` class: reads the two files,
compiles, links, `use()`, `setBool/setInt/setFloat`), `shader.vs` and `shader.fs`;
`Shader ourShader("shader.vs", "shader.fs");` in `main`. Start: an orange triangle `(1.0, 0.5, 0.2)` with the
corners bottom right (0.5, -0.5), bottom left (-0.5, -0.5), top (0.0, 0.5) = pixels (600,450), (200,450), (400,150),
on teal (51,76,76). The tasks build on each other; the last three are the chapter's exercises, kept cumulatively.
After `vertex-colors` the project is learnopengl's `shaders_class.cpp` + `3.3.shader.vs/.fs`.

## `in-out`
- **Task:** Send a colour from the vertex shader to the fragment shader: `out vec4 vertexColor;` set to `vec4(0.5, 0.0, 0.0, 1.0)` in `shader.vs`, and `in vec4 vertexColor;` used as `FragColor` in `shader.fs`.
- **Hint:** An `out` of the vertex shader connects to an `in` of the fragment shader with the same name and type.
- **When done:** `shader.vs` declares `out vec4 vertexColor;` and sets `vertexColor = vec4(0.5, 0.0, 0.0, 1.0);`;
  `shader.fs` declares `in vec4 vertexColor;` and writes `FragColor = vertexColor;`. The triangle is **dark red**
  (sRGB 128,0,0), same shape.

## `uniform`
- **Task:** Set the colour from C++ with a uniform: `uniform vec4 ourColor;` in `shader.fs` (`FragColor = ourColor;`), and every frame `glUniform4f(glGetUniformLocation(ourShader.ID, "ourColor"), 0.0f, greenValue, 0.0f, 1.0f)` with `greenValue = sin(glfwGetTime()) / 2 + 0.5`.
- **Hint:** Set uniforms after `ourShader.use()` – `glUniform*` changes the active program. `sin` needs `#include <cmath>`. The vertex shader's `vertexColor` output stays but is no longer read.
- **When done:** `shader.fs` has `uniform vec4 ourColor;` and `FragColor = ourColor;`; `main.cpp` includes `<cmath>`
  and in the loop after `ourShader.use();` computes `double timeValue = glfwGetTime();`,
  `float greenValue = static_cast<float>(sin(timeValue) / 2.0 + 0.5);`,
  `int vertexColorLocation = glGetUniformLocation(ourShader.ID, "ourColor");` and calls
  `glUniform4f(vertexColorLocation, 0.0f, greenValue, 0.0f, 1.0f);`. The triangle is **green and pulses** over time:
  colour `(0, sin(t)/2 + 0.5, 0)` – green channel between 0 and 255, red and blue 0 (about 0,143,0 at t = 3 s).

## `vertex-colors`
- **Task:** Give every vertex its own colour – red, green, blue – as a second vertex attribute (location 1) and let the vertex shader pass it on, interpolated. The uniform is no longer needed: remove it.
- **Hint:** Each vertex is now 6 floats (position, colour): stride `6 * sizeof(float)` for both attributes, colour offset `(void*)(3 * sizeof(float))`. Shaders: `layout (location = 1) in vec3 aColor;`, `out vec3 ourColor;` → `in vec3 ourColor;`, `FragColor = vec4(ourColor, 1.0f);`.
- **When done:** vertices have colours (bottom right red, bottom left green, top blue); attribute 0 and attribute 1
  use stride `6 * sizeof(float)`, `glEnableVertexAttribArray(1)`; the uniform lines and `#include <cmath>` are gone;
  `shader.vs` = `aPos`, `aColor`, `out vec3 ourColor`, `ourColor = aColor;`; `shader.fs` = `in vec3 ourColor`,
  `FragColor = vec4(ourColor, 1.0f);`. The **RGB triangle**: red corner at bottom right (600,450), green at bottom
  left (200,450), blue at top (400,150), colours blended in between (centre about 64,64,127).

## `upside-down`
- **Task:** Exercise 1: turn the triangle upside down in the vertex shader.
- **Hint:** Negate the y coordinate: `gl_Position = vec4(aPos.x, -aPos.y, aPos.z, 1.0);`.
- **When done:** `shader.vs` writes `gl_Position = vec4(aPos.x, -aPos.y, aPos.z, 1.0);`. The triangle points down:
  red corner at top right (600,150), green at top left (200,150), blue at the bottom (400,450).

## `offset`
- **Task:** Exercise 2: move the triangle to the right with a uniform `float xOffset` set to `0.5` from C++ (`ourShader.setFloat`).
- **Hint:** In `shader.vs`: `uniform float xOffset;` and add it to x. In the loop, after `ourShader.use();`: `float offset = 0.5f; ourShader.setFloat("xOffset", offset);`.
- **When done:** `shader.vs` has `uniform float xOffset;` and `gl_Position = vec4(aPos.x + xOffset, -aPos.y, aPos.z, 1.0);`;
  `main.cpp` sets it with `ourShader.setFloat("xOffset", offset);` (`offset = 0.5f`) every frame. The upside-down
  RGB triangle moves 0.5 to the right (200 pixels): green corner (400,150), red corner (800,150) at the right edge,
  blue corner (600,450). The window centre (400,300) is now background.

## `position-color`
- **Task:** Exercise 3: output the vertex position as the colour – `out vec3 ourPosition;` with `ourPosition = aPos;` in `shader.vs`, and `FragColor = vec4(ourPosition, 1.0);` in `shader.fs`.
- **Hint:** Comment out the `ourColor` lines instead of deleting them. Negative coordinates become colour 0 (black) – the colour is clamped to 0..1.
- **When done:** `shader.vs` has `out vec3 ourPosition;` / `ourPosition = aPos;` (the `ourColor` lines commented
  out); `shader.fs` has `in vec3 ourPosition;` and `FragColor = vec4(ourPosition, 1.0);`. Same position and shape as
  after `offset`, new colours from the *input* position `aPos`: the corner with aPos (-0.5, -0.5) is **black**
  (pixel 400,150), the corner with aPos (0.5, -0.5) is dark red 0.5,0,0 (top right, 800,150), the corner with
  aPos (0, 0.5) dark green 0,0.5,0 (bottom, 600,450); a large black area near the black corner. Final state.
