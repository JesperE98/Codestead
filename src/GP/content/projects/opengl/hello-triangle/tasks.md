# Hello Triangle – tasks (OpenGL)

learnopengl "Hello Triangle". Start = `hello-window/solution` plus TODO comments: the two shader sources at the top,
the shader build steps, the vertex data / VAO setup, the draw in the render loop and the clean-up. The start shows the
dark teal window (sRGB 51,76,76) and nothing else; it stays that way until the `draw` task. After `draw` the program is
exactly `introduction/start` (learnopengl's `hello_triangle.cpp`); the solution is learnopengl's
`hello_triangle_indexed.cpp` (the orange rectangle). Tasks follow the order of the tutorial text (vertex input first),
so some tasks also touch the clean-up section at the end of `main`.

## `vertex-buffer`
- **Task:** Put the triangle's three vertices in a `float vertices[]` array and copy them into a vertex buffer object (VBO): `glGenBuffers`, `glBindBuffer(GL_ARRAY_BUFFER, VBO)`, `glBufferData`. Delete the buffer at the end with `glDeleteBuffers`.
- **Hint:** Vertices in normalized device coordinates: left (-0.5, -0.5, 0.0), right (0.5, -0.5, 0.0), top (0.0, 0.5, 0.0). `GL_STATIC_DRAW`: the data is set once and drawn many times.
- **When done:** `float vertices[]` with the 9 floats, `unsigned int VBO; glGenBuffers(1, &VBO);`,
  `glBindBuffer(GL_ARRAY_BUFFER, VBO);`, `glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);`
  and `glDeleteBuffers(1, &VBO);` in the clean-up. Nothing visible changes (still the teal window).

## `vertex-shader`
- **Task:** Write the vertex shader source `vertexShaderSource` (GLSL 330 core, input `layout (location = 0) in vec3 aPos`, `gl_Position = vec4(aPos.x, aPos.y, aPos.z, 1.0)`), then create and compile it and check for compile errors.
- **Hint:** `glCreateShader(GL_VERTEX_SHADER)`, `glShaderSource`, `glCompileShader`; check with `glGetShaderiv(…, GL_COMPILE_STATUS, &success)` and print `glGetShaderInfoLog` on failure.
- **When done:** `const char *vertexShaderSource = "#version 330 core\n" …` at the top; in `main`
  `unsigned int vertexShader = glCreateShader(GL_VERTEX_SHADER);`, `glShaderSource`, `glCompileShader`, and the
  `int success; char infoLog[512];` compile check printing `ERROR::SHADER::VERTEX::COMPILATION_FAILED`. Nothing visible
  changes; no error is printed.

## `fragment-shader`
- **Task:** Write the fragment shader source `fragmentShaderSource` (output `out vec4 FragColor`, orange `vec4(1.0f, 0.5f, 0.2f, 1.0f)`), then create and compile it with the same error check.
- **Hint:** Same steps as the vertex shader with `GL_FRAGMENT_SHADER`; reuse `success` and `infoLog`.
- **When done:** `const char *fragmentShaderSource` (sets `FragColor = vec4(1.0f, 0.5f, 0.2f, 1.0f)`), and in `main`
  `unsigned int fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);` + source + compile + the check printing
  `ERROR::SHADER::FRAGMENT::COMPILATION_FAILED`. Nothing visible changes.

## `shader-program`
- **Task:** Link both shaders into a shader program (`glCreateProgram`, `glAttachShader` ×2, `glLinkProgram`), check for link errors, then delete the two shader objects. Delete the program at the end with `glDeleteProgram`.
- **Hint:** Check with `glGetProgramiv(shaderProgram, GL_LINK_STATUS, &success)` and `glGetProgramInfoLog`. Once linked, the shader objects are no longer needed: `glDeleteShader`.
- **When done:** `unsigned int shaderProgram = glCreateProgram();`, two `glAttachShader`, `glLinkProgram`, the link
  check printing `ERROR::SHADER::PROGRAM::LINKING_FAILED`, `glDeleteShader(vertexShader); glDeleteShader(fragmentShader);`,
  and `glDeleteProgram(shaderProgram);` in the clean-up. Nothing visible changes.

## `vertex-attributes`
- **Task:** Create a vertex array object (VAO), bind it before the VBO, and tell OpenGL how to read the vertex data: `glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0)` and `glEnableVertexAttribArray(0)`. Delete the VAO at the end.
- **Hint:** The core profile needs a bound VAO to draw. Declare it next to the VBO (`unsigned int VBO, VAO;`), `glGenVertexArrays(1, &VAO)` and `glBindVertexArray(VAO)` before binding the VBO. Afterwards you may unbind the VBO and the VAO.
- **When done:** `unsigned int VBO, VAO;`, `glGenVertexArrays(1, &VAO);`, `glBindVertexArray(VAO);` before the
  `glBindBuffer`, then `glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);`,
  `glEnableVertexAttribArray(0);`, `glBindBuffer(GL_ARRAY_BUFFER, 0);`, `glBindVertexArray(0);`, a commented-out
  `//glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);` (wireframe hint) and `glDeleteVertexArrays(1, &VAO);` in the clean-up.
  Nothing visible changes yet.

## `draw`
- **Task:** Draw the triangle in the render loop: `glUseProgram(shaderProgram)`, `glBindVertexArray(VAO)`, `glDrawArrays(GL_TRIANGLES, 0, 3)`.
- **Hint:** Draw after `glClear`, before `glfwSwapBuffers`.
- **When done:** the three calls are in the loop after `glClear`. An **orange triangle** `(1.0, 0.5, 0.2)` (sRGB
  255,128,51) appears on the teal background: corners at pixels (200,450), (600,450), (400,150); the centre pixel is
  orange. The program now equals `introduction/start`.

## `element-buffer`
- **Task:** Prepare a rectangle: replace the vertices with the four corners, add `unsigned int indices[] = { 0, 1, 3, 1, 2, 3 };`, and put the indices in an element buffer object (EBO) bound while the VAO is bound. Delete the EBO at the end.
- **Hint:** Corners: top right (0.5, 0.5), bottom right (0.5, -0.5), bottom left (-0.5, -0.5), top left (-0.5, 0.5), all z = 0. `glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO)` + `glBufferData` after the VBO's data – and don't unbind the EBO while the VAO is bound (the VAO stores it).
- **When done:** 4 vertices, `indices[]`, `unsigned int VBO, VAO, EBO;`, `glGenBuffers(1, &EBO);`,
  `glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);`, `glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);`
  and `glDeleteBuffers(1, &EBO);`. Still drawn with `glDrawArrays(GL_TRIANGLES, 0, 3)`, so the picture changes to the
  first three vertices: an orange **right-angled triangle** with corners at pixels (600,150), (600,450), (200,450)
  (the lower-right half of the rectangle).

## `rectangle`
- **Task:** Draw the rectangle from the indices: replace `glDrawArrays` with `glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0)`.
- **Hint:** 6 indices = 2 triangles; the last argument is the offset into the bound EBO. Try uncommenting the `glPolygonMode(GL_FRONT_AND_BACK, GL_LINE)` line to see the two triangles in wireframe (put it back afterwards).
- **When done:** `glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);` in the loop instead of `glDrawArrays`. An
  **orange rectangle** covering pixels (200,150)–(600,450) on teal (centre and pixel 400,150 orange). Final state.
