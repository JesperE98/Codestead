# DSA – tasks (OpenGL)

learnopengl "Guest Articles / DSA" (direct state access): `src/8.guest/2021/4.dsa/hello_triangle_dsa.cpp` – the indexed
rectangle of "Hello Triangle" with its buffers and vertex array object created and filled through DSA. Files:
`main.cpp` (shaders as embedded strings, like Hello Triangle) and `container.png` (the course's container of the
Textures chapter, used by the last task). The start is the course's `hello-triangle` solution (the orange indexed
rectangle) with two TODO comments and the stb_image include added.

**Screenshot time: 1.0 s** (nothing moves).

**OpenGL version: 4.5 core** (from the `context` task on; learnopengl's demo asks for 4.5): `glCreateBuffers`,
`glNamedBufferStorage`, `glCreateVertexArrays`, `glVertexArrayAttribFormat`, `glCreateTextures`, `glTextureStorage2D`,
`glBindTextureUnit` … are core only in 4.5 (`ARB_direct_state_access`). The course's other code is 3.3. **macOS stops at
OpenGL 4.1, so this chapter's program does not run on a Mac** (the bind-to-edit code of the other chapters does).

**Vulkan / DirectX 12:** DSA is OpenGL's own topic – those APIs never had bind-to-edit: every call names the object it
works on (`vkCmdBindVertexBuffers(cmd, …, &vertexBuffer, …)`, `m_commandList->IASetVertexBuffers(0, 1,
&m_vertexBufferView)`, `vkBindBufferMemory(device, buffer, memory, 0)`, a resource created with its heap). Their `dsa`
chapter has **no tasks**: its project is their `hello-triangle` solution, and their tasks.md says what the chapter
text contrasts (objects always named explicitly, immutable storage ↔ allocating memory once, vertex formats ↔ vertex
input / input layout descriptions, texture units ↔ descriptors).

**Fixed choices (OpenGL):** the rectangle of Hello Triangle (vertices (±0.5, ±0.5, 0), indices 0,1,3 / 1,2,3), orange
`(1.0, 0.5, 0.2)` until the `texture` task, clear (0.2, 0.3, 0.3). learnopengl's names (`vbo`, `ebo`, `vao`) are written
`VBO`, `EBO`, `VAO` as in the course's Hello Triangle. The `texture` task goes a step beyond learnopengl's demo, to the
article's texture section: `container.png` (256×256 RGB) on the rectangle with texture coordinates 0..1, flipped on load
(`stbi_set_flip_vertically_on_load(true)`), immutable storage `GL_RGB8` with all mip levels
(`1 + floor(log2(max(w, h)))` = 9), `GL_REPEAT`, `GL_LINEAR_MIPMAP_LINEAR` / `GL_LINEAR`, bound with `glBindTextureUnit(0,
texture)` (the sampler `texture1` keeps its default unit 0: no `glUniform1i`).

Pixels from the top left of the 800×600 window (Mesa). Named points: **centre** (400,300), **board** (300,220) (a wooden
board of the container), **frame** (400,160) (the container's top frame), **bolt** (218,163) (the top left bolt),
**diagonal** (500,230) (the diagonal brace), **background** (100,100). The rectangle covers x 200..599, y 150..449.

**Start picture:** the orange rectangle: centre, board, frame, bolt, diagonal = 255,128,51; background = 51,76,76.

## `context`
- **Task:** Ask GLFW for an OpenGL 4.5 core context – the version in which direct state access became core.
- **Hint:** `glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4); glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 5);` (GLAD must be generated for 4.5 to load the DSA functions).
- **When done:** `main.cpp`: `GLFW_CONTEXT_VERSION_MAJOR, 4` and `GLFW_CONTEXT_VERSION_MINOR, 5`. **No visible change**
  (same pixels as the start).

## `vertex-buffer`
- **Task:** Create the vertex buffer with DSA: `glCreateBuffers` instead of `glGenBuffers`, and its data with `glNamedBufferStorage` (immutable storage, flags 0: the program never changes it) instead of binding it and calling `glBufferData`.
- **Hint:** `GLuint VBO = 0; glCreateBuffers(1, &VBO); glNamedBufferStorage(VBO, sizeof(vertices), vertices, 0x0);` – no `glBindBuffer` is needed to create or fill it. The VAO setup still binds it to `GL_ARRAY_BUFFER` once for `glVertexAttribPointer`.
- **When done:** `main.cpp`: `glCreateBuffers(1, &VBO);`, `glNamedBufferStorage(VBO, sizeof(vertices), vertices, 0x0);`,
  no `glBufferData(GL_ARRAY_BUFFER, …)` and no `glGenBuffers(1, &VBO)` any more. **No visible change.**

## `element-buffer`
- **Task:** Create the element buffer with DSA too: `glCreateBuffers`, storage with `glNamedBufferStorage` without data but with `GL_DYNAMIC_STORAGE_BIT` (so it may be updated), then upload the indices with `glNamedBufferSubData`.
- **Hint:** `glNamedBufferStorage(EBO, sizeof(indices), nullptr, GL_DYNAMIC_STORAGE_BIT); glNamedBufferSubData(EBO, 0, sizeof(indices), indices);` – without the flag, `glNamedBufferSubData` on immutable storage is an error (`GL_INVALID_OPERATION`).
- **When done:** `main.cpp`: `glCreateBuffers(1, &EBO);`, `glNamedBufferStorage(EBO, sizeof(indices), nullptr,
  GL_DYNAMIC_STORAGE_BIT);`, `glNamedBufferSubData(EBO, 0, sizeof(indices), indices);`, no `glBufferData` and no
  `glGenBuffers` any more. **No visible change.**

## `vertex-array`
- **Task:** Create and describe the vertex array object with DSA: `glCreateVertexArrays`, enable attribute 0, give it its format (three floats at offset 0) and binding point 0, attach the vertex buffer to binding point 0 with the stride, and the element buffer to the VAO – no binding of the VAO or the buffers at setup.
- **Hint:** learnopengl's `glEnableVertexArrayAttrib(VAO, 0); glVertexArrayAttribFormat(VAO, 0, 3, GL_FLOAT, GL_FALSE, 0); glVertexArrayAttribBinding(VAO, 0, 0); glVertexArrayVertexBuffer(VAO, 0, VBO, 0, sizeof(float) * 3); glVertexArrayElementBuffer(VAO, EBO);`. The format (what an attribute is) and the buffer (where it comes from) are now separate.
- **When done:** `main.cpp`: `glCreateVertexArrays(1, &VAO);`, `glEnableVertexArrayAttrib(VAO, 0)`,
  `glVertexArrayAttribFormat(VAO, 0, 3, GL_FLOAT, GL_FALSE, 0)`, `glVertexArrayAttribBinding(VAO, 0, 0)`,
  `glVertexArrayVertexBuffer(VAO, 0, VBO, 0, sizeof(float) * 3)`, `glVertexArrayElementBuffer(VAO, EBO)`; no
  `glGenVertexArrays`, `glBindBuffer`, `glVertexAttribPointer`, `glEnableVertexAttribArray` in the setup any more (the
  render loop still binds the VAO for the draw). = learnopengl's demo. **No visible change.**

## `texture`
- **Task:** Texture the rectangle with `container.png`, created through DSA: add texture coordinates to the vertices as attribute 1 (two floats, 3 floats into each vertex, same binding point, stride 5 floats), create the texture with `glCreateTextures`, set its parameters with `glTextureParameteri`, allocate immutable storage for all mip levels with `glTextureStorage2D`, upload the image with `glTextureSubImage2D`, generate the mipmaps with `glGenerateTextureMipmap`, and bind it for drawing with `glBindTextureUnit`. The shaders pass the texture coordinates on and sample the texture.
- **Hint:** `glVertexArrayAttribFormat(VAO, 1, 2, GL_FLOAT, GL_FALSE, 3 * sizeof(float))` – the last argument is the offset inside a vertex; the stride moves to `glVertexArrayVertexBuffer(VAO, 0, VBO, 0, sizeof(float) * 5)`. `glCreateTextures(GL_TEXTURE_2D, 1, &texture)`, `glTextureStorage2D(texture, levels, GL_RGB8, width, height)` with `levels = 1 + (int)std::floor(std::log2((float)std::max(width, height)))`, `glTextureSubImage2D(texture, 0, 0, 0, width, height, GL_RGB, GL_UNSIGNED_BYTE, data)`; in the loop `glBindTextureUnit(0, texture);`.
- **When done:** `main.cpp`: the shader strings with `layout (location = 1) in vec2 aTexCoord;`, `out vec2 TexCoord;` /
  `in vec2 TexCoord;`, `uniform sampler2D texture1;`, `FragColor = texture(texture1, TexCoord);`; the vertices with
  texture coordinates (1,1), (1,0), (0,0), (0,1); attribute 1 (`glEnableVertexArrayAttrib(VAO, 1)`,
  `glVertexArrayAttribFormat(VAO, 1, 2, GL_FLOAT, GL_FALSE, 3 * sizeof(float))`, `glVertexArrayAttribBinding(VAO, 1,
  0)`), stride `sizeof(float) * 5`; `glCreateTextures(GL_TEXTURE_2D, 1, &texture)`, four `glTextureParameteri`,
  `stbi_set_flip_vertically_on_load(true)`, `stbi_load("container.png", …)`, `glTextureStorage2D(texture, levels,
  GL_RGB8, width, height)`, `glTextureSubImage2D(…)`, `glGenerateTextureMipmap(texture)`; `glBindTextureUnit(0, texture)`
  before the draw; `glDeleteTextures(1, &texture)`. The **container on the rectangle**, upright (the diagonal brace runs
  from bottom left to top right): centre = 92,58,28, board = 133,92,49, frame = 92,58,28, bolt = 190,190,180, diagonal =
  92,58,28, background = 51,76,76. This is the solution.
