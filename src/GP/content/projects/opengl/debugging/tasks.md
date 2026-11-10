# Debugging – tasks (OpenGL)

learnopengl "Debugging": `src/7.in_practice/1.debugging`. Files: `main.cpp`, `shader_m.h`, `debugging.vs`,
`debugging.fs`, `wood.png` (the course's own texture).

**Fixed choices (the same in every API – the Vulkan and DirectX 12 projects copy them so the pictures match):**
- Scene: learnopengl's debugging.cpp – one textured cube (36 vertices, position + texcoords; the course's
  counter-clockwise cube from the face-culling chapter, so culling keeps the outside) with `wood.png`, model =
  translate(0, 0, -2.5) · rotate(time × 10° about (1, 1, 1)), projection perspective(45°, 800/600, 0.1, **10.0**),
  **no view matrix** (the camera at the origin looking down -z), depth test on, back-face culling on (CCW front),
  `wood.png` flipped on load, REPEAT, mipmaps, unit 0, sampler `tex`.
- **Clear colour (0.2, 0.3, 0.3)** – a deviation: learnopengl clears to black, but then the first fix (the cube drawn
  black, because its texture is still broken) would be invisible. On teal the black cube shows.
- **The start has two mistakes**, both from learnopengl's demo (it hides them on purpose for the reader to find):
  1. `glTexImage2D(GL_FRAMEBUFFER, …)` – a wrong target: the call fails, the texture never gets an image, so it is
     incomplete and samples as black (0, 0, 0, 1). (Vulkan: the matching mistake is e.g. a missing layout transition or
     descriptor write; DirectX 12: e.g. a missing barrier – each API's writer picks the error its tool reports.)
  2. The `projection` and `tex` uniforms are set **before `shader.use()`**: with no program in use the calls fail, the
     projection stays all zero, every vertex lands on (0, 0, 0, 0) and nothing is drawn.
  The start therefore shows **only the clear colour**.
- Tasks in order: find with glGetError → fix the uniforms (black cube) → find the second error with the debug
  output → fix the texture (wooden cube) → debug the shader's output (texcoords as colour). The solution ends with
  the texcoord view.
- **OpenGL version:** `glDebugMessageCallback` is core OpenGL **4.3**; the `debug-output` task asks GLFW for a 4.3
  core debug context (learnopengl's demo asks for 3.3 + a debug context and relies on its GLAD being generated for 4.5
  with `GL_KHR_debug`). The rest of the course stays on 3.3 core, which every desktop driver has (macOS stops at 4.1, so
  there debug output is not available – glGetError still is). On a 3.3 context the same functions exist when the
  driver exposes `GL_KHR_debug` (most do), but GLAD must then be generated with that extension. The course's GLAD for
  this chapter is 4.3 core (verify.sh: a project that asks for a 4.x context gets a 4.3 GLAD).
- learnopengl also mentions `glObjectLabel` (4.3: name a buffer/texture so messages and tools like RenderDoc show the
  name) and framebuffer completeness checks (`glCheckFramebufferStatus`, used since the framebuffers chapter): explained
  in the text, not tasks.
- Time: the cube turns 10° per second. Pixels below are at **t = 1 s** (10°), measured with Mesa (llvmpipe) running
  with the fixed-time shim (`VERIFY_FIXEDTIME=1 verify.sh …`: glfwGetTime() = frames / 60, stopped at 1 s). Without
  the shim verify.sh's screenshot is at ≈ 3 s (30°). At 10° the cube covers about x 214..602, y 118..512, mostly its
  front face.

Named points (from the top left of the 800×600 window): **centre** (400,300), **top** (400,150), **lower-right**
(560,450) – all on the cube's front face at t = 1 s; **background** (100,100) and **left** (150,300) outside the
cube.

**Start picture:** only the clear colour: every point 51,76,76 (0.2, 0.3, 0.3). Nothing printed.

## `check-error`
- **Task:** Add learnopengl's `glCheckError_` function and the `glCheckError()` macro, and call `glCheckError();` after the texture is loaded and after the uniforms are set.
- **Hint:** `glGetError()` returns one recorded error flag and clears it – call it in a `while (… != GL_NO_ERROR)` loop. Print the error's name with `__FILE__` and `__LINE__`: `#define glCheckError() glCheckError_(__FILE__, __LINE__)`.
- **When done:** `main.cpp` has `GLenum glCheckError_(const char *file, int line)` with the `while ((errorCode =
  glGetError()) != GL_NO_ERROR)` loop and the switch over `GL_INVALID_ENUM`, `GL_INVALID_VALUE`,
  `GL_INVALID_OPERATION`, `GL_STACK_OVERFLOW`, `GL_STACK_UNDERFLOW`, `GL_OUT_OF_MEMORY`,
  `GL_INVALID_FRAMEBUFFER_OPERATION`; `#define glCheckError() glCheckError_(__FILE__, __LINE__)`; `glCheckError();`
  right after `stbi_image_free(data);` and right after `glUniform1i(glGetUniformLocation(shader.ID, "tex"), 0);`.
  **No visible change** (only the clear colour). **The program prints** (Mesa, line numbers of this state's main.cpp):
  ```
  INVALID_ENUM | main.cpp (180)
  INVALID_OPERATION | main.cpp (187)
  ```
  The first comes from `glTexImage2D(GL_FRAMEBUFFER, …)` (GL_INVALID_ENUM = 0x0500); `glGenerateMipmap` then fails too
  (GL_INVALID_OPERATION, zero-size base image), but OpenGL keeps only the **first** error until glGetError reads it,
  so glGetError reports INVALID_ENUM once. The second line is from `glUniformMatrix4fv` with no program in use
  (GL_INVALID_OPERATION = 0x0502; `glUniform1i` fails the same way, again only one flag).

## `use-program`
- **Task:** Fix the error glCheckError reported after the uniforms: make the shader the program in use before setting `projection` and `tex`.
- **Hint:** `glUniform*` changes the uniforms of the program in use – call `shader.use();` before the two calls.
- **When done:** `shader.use();` between `glm::mat4 projection = glm::perspective(…)` and
  `glUniformMatrix4fv(glGetUniformLocation(shader.ID, "projection"), …)`. **The cube appears, all black** (its texture
  is incomplete): centre = 0,0,0, top = 0,0,0, lower-right = 0,0,0; background 51,76,76. Prints only
  `INVALID_ENUM | main.cpp (180)` (the uniform error is gone).

## `debug-output`
- **Task:** Ask GLFW for an OpenGL 4.3 debug context and register learnopengl's `glDebugOutput` callback, so the driver describes each error in words.
- **Hint:** `glfwWindowHint(GLFW_OPENGL_DEBUG_CONTEXT, true);` with version 4.3; after GLAD: if `GL_CONTEXT_FLAGS` has `GL_CONTEXT_FLAG_DEBUG_BIT`, `glEnable(GL_DEBUG_OUTPUT)`, `glEnable(GL_DEBUG_OUTPUT_SYNCHRONOUS)`, `glDebugMessageCallback(glDebugOutput, nullptr)`, `glDebugMessageControl(GL_DONT_CARE, GL_DONT_CARE, GL_DONT_CARE, 0, nullptr, GL_TRUE)`.
- **When done:** `glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4)`, `GLFW_CONTEXT_VERSION_MINOR, 3`,
  `glfwWindowHint(GLFW_OPENGL_DEBUG_CONTEXT, true)`; the function `void APIENTRY glDebugOutput(GLenum source, GLenum
  type, unsigned int id, GLenum severity, GLsizei length, const char *message, const void *userParam)` (learnopengl's,
  printing id/message and the source/type/severity names); after `gladLoadGLLoader`: `glGetIntegerv(GL_CONTEXT_FLAGS,
  &flags)`, `if (flags & GL_CONTEXT_FLAG_DEBUG_BIT)` with `glEnable(GL_DEBUG_OUTPUT)`,
  `glEnable(GL_DEBUG_OUTPUT_SYNCHRONOUS)`, `glDebugMessageCallback(glDebugOutput, nullptr)`,
  `glDebugMessageControl(GL_DONT_CARE, GL_DONT_CARE, GL_DONT_CARE, 0, nullptr, GL_TRUE)`. **No visible change** (the
  black cube). **The program prints** (Mesa 24, llvmpipe – the message texts are the driver's own; NVIDIA/AMD word
  them differently and use other ids):
  ```
  ---------------
  Debug message (1): GL_INVALID_ENUM in glTexImage2D(target=GL_FRAMEBUFFER)
  Source: API
  Type: Error
  Severity: high

  ---------------
  Debug message (1): GL_INVALID_OPERATION in glGenerateMipmap(zero size base image)
  Source: API
  Type: Error
  Severity: high

  INVALID_ENUM | main.cpp (233)
  ```
  The callback names the function and the bad argument, and also shows the follow-up error that glGetError hid.
  (verify.sh reports this state as failed because the program prints "Error" – expected for this in-between state.)
  For reference, had the uniforms not been fixed, Mesa would add `GL_INVALID_OPERATION in glUniformMatrix(program
  not linked)` and `GL_INVALID_OPERATION in glUniform(program not linked)` (id 1, API, Error, high).

## `fix-texture`
- **Task:** Fix the error the debug output names: upload the image to the right target.
- **Hint:** The texture is bound to `GL_TEXTURE_2D`; `GL_FRAMEBUFFER` is not a texture target.
- **When done:** `glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);`.
  **The wooden cube appears** (boards running up the front face, turned 10° at t = 1 s): centre = 186,127,78,
  top = 179,122,75, lower-right = 166,114,69; background 51,76,76. **Nothing is printed** (no error, no debug message).

## `shader-output`
- **Task:** Debug the shader's output: write the texture coordinates as the fragment colour instead of the texture (u as red, v as green) – keep the texture line as a comment.
- **Hint:** In `debugging.fs`: `FragColor = vec4(TexCoords, 0.0, 1.0);`.
- **When done:** `debugging.fs` writes `FragColor = vec4(TexCoords, 0.0, 1.0);` (the texture line commented out).
  **The cube shows a red–green gradient**: black at the face's bottom-left (uv 0,0), red at the bottom-right, green at
  the top-left, yellow at the top-right: centre = 116,141,0, top = 125,244,0, lower-right = 222,18,0; background
  51,76,76. Nothing printed.

## What the simulator must report (for the lead)
- `glGetError()`: a per-context error flag – the **first** failing call since the last glGetError sets it; glGetError
  returns it and clears it (GL_NO_ERROR = 0 when none). Needed: `glTexImage2D` with a target that is not a texture
  target (here GL_FRAMEBUFFER) → GL_INVALID_ENUM, and the call does nothing (texture stays without an image →
  incomplete → black; today the simulator uploads the image anyway); `glGenerateMipmap` on a texture with no base
  image → GL_INVALID_OPERATION; `glUniform*` / `glUniformMatrix*` with no program in use → GL_INVALID_OPERATION (the
  existing `uniformWithoutProgram` note) and the uniform is not set. `glCheckError_`'s output lines
  `"<NAME> | main.cpp (<line>)"` where `<line>` is the line of the `glCheckError();` call.
- Debug output: with `GLFW_OPENGL_DEBUG_CONTEXT` true and a 4.3 context, `glGetIntegerv(GL_CONTEXT_FLAGS)` returns
  `GL_CONTEXT_FLAG_DEBUG_BIT` (2); with `GL_DEBUG_OUTPUT` enabled, every failing call invokes the registered callback
  synchronously with (source GL_DEBUG_SOURCE_API, type GL_DEBUG_TYPE_ERROR, id 1, severity GL_DEBUG_SEVERITY_HIGH,
  Mesa's message): `GL_INVALID_ENUM in glTexImage2D(target=GL_FRAMEBUFFER)`, `GL_INVALID_OPERATION in
  glGenerateMipmap(zero size base image)`, `GL_INVALID_OPERATION in glUniformMatrix(program not linked)`,
  `GL_INVALID_OPERATION in glUniform(program not linked)`. Without the debug hint, `flags` is 0 and nothing is sent.
