# Camera – tasks (OpenGL)

learnopengl "Camera": `camera_circle.cpp`, `camera_keyboard_dt.cpp`, `camera_mouse_zoom.cpp`. Files: `main.cpp`,
`shader_m.h`, `shader.vs`, `shader.fs`, `container.png`, `awesomeface.png` – the same as in Coordinate Systems.

Start = the Coordinate Systems solution unchanged: ten crates, cubes 0, 3, 6, 9 turning (`i % 3 == 0`), per frame
`glm::mat4 view` (translate (0, 0, -3)) and `projection` (perspective 45°, 800/600, 0.1, 100) set with
`ourShader.setMat4`, then one `model` + `glDrawArrays` per cube in the `for` loop. No `// TODO:` lines: every task
changes or extends existing code.

The default picture (the camera at (0, 0, 3) looking down -z) – measured with Mesa (llvmpipe) on a copy with
`glfwGetTime()` replaced by `1.0`, pixel coordinates from the top left of the 800×600 window: cube 0 in the middle
(turned by 25° at t = 1 s, (400,300) ≈ 168,120,50); points that do not depend on time: the small far cube 1 at
(483,100) ≈ 125,89,30, cube 7 at (600,70) ≈ 136,91,50, cube 8 at (640,260) ≈ 125,89,30; background teal ≈ 51,76,76 at
(100,330), (380,80) and (30,560).

The simulator presses no keys and moves no mouse: after `free-camera` the picture must stay this default picture.
learnopengl ends the chapter with a `Camera` class (`camera.h`: `ProcessKeyboard`, `ProcessMouseMovement`,
`ProcessMouseScroll`, `GetViewMatrix`, `Zoom`) that wraps exactly these globals; it is described in the chapter as an
optional refactoring – the project keeps the globals and free functions.

## `look-at`
- **Task:** Build the view matrix with `glm::lookAt` instead of a translation: a camera at (0, 0, 3) looking at the origin, with (0, 1, 0) as up.
- **Hint:** `glm::lookAt(position, target, up)` builds the camera's axes (right, up, direction) and the translation for you.
- **When done:** `view = glm::lookAt(glm::vec3(0.0f, 0.0f, 3.0f), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));`
  replaces `view = glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f));`. It is the same matrix, so **nothing visible
  changes** (identical pixels).

## `circle`
- **Task:** Let the camera circle the scene: `float radius = 10.0f;`, `camX = sin(time) * radius`, `camZ = cos(time) * radius`, and look from (camX, 0, camZ) at the origin.
- **Hint:** `float camX = static_cast<float>(sin(glfwGetTime()) * radius);` (and `cos` for `camZ`), then `glm::lookAt(glm::vec3(camX, 0.0f, camZ), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f))`.
- **When done:** `float radius = 10.0f;`, `float camX = static_cast<float>(sin(glfwGetTime()) * radius);`,
  `float camZ = static_cast<float>(cos(glfwGetTime()) * radius);` and
  `view = glm::lookAt(glm::vec3(camX, 0.0f, camZ), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));`. The
  camera **orbits the scene** at distance 10 (one turn every 2π s), always looking at cube 0, which stays in the centre
  of the window; the crates are now small. At t = 1 s (camera at (8.4, 0, 5.4)) all crates are in the right part of the window,
  x ≈ 339..780, y ≈ 99..491: cube 0 at (400,300) ≈ 165,119,49, crates at (555,285) ≈ 168,120,50, (610,155)
  ≈ 86,55,29 and (715,325) ≈ 78,53,30; the left half is background: (200,300), (100,500), (400,100) ≈ 51,76,76.
  The picture depends on time everywhere except at the centre (always cube 0).

## `free-camera`
- **Task:** Replace the circling camera with a camera you can move: global `cameraPos` (0, 0, 3), `cameraFront` (0, 0, -1) and `cameraUp` (0, 1, 0), and `view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp)`.
- **Hint:** `cameraPos + cameraFront` is a point straight in front of the camera, so the camera keeps looking in the direction of `cameraFront` wherever it moves. Put the globals under the settings, before `main`.
- **When done:** globals `glm::vec3 cameraPos = glm::vec3(0.0f, 0.0f, 3.0f);`,
  `glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);`, `glm::vec3 cameraUp = glm::vec3(0.0f, 1.0f, 0.0f);`; no
  `radius`/`camX`/`camZ` any more; `view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);`. The **default
  picture is back** (identical to the start, see above): the camera stands still at (0, 0, 3) looking down -z.

## `wasd`
- **Task:** Move the camera with W/A/S/D in `processInput`, at a speed of 2.5 units per second: compute `deltaTime` (time since the last frame) at the start of every frame.
- **Hint:** Globals `float deltaTime = 0.0f; float lastFrame = 0.0f;`; at the top of the loop `float currentFrame = static_cast<float>(glfwGetTime()); deltaTime = currentFrame - lastFrame; lastFrame = currentFrame;`. In `processInput`: `float cameraSpeed = static_cast<float>(2.5 * deltaTime);` – W/S move along `cameraFront`, A/D along `glm::normalize(glm::cross(cameraFront, cameraUp))` (the right vector).
- **When done:** globals `deltaTime` and `lastFrame` (`// timing`); the loop starts with the per-frame time logic;
  `processInput` has `float cameraSpeed = static_cast<float>(2.5 * deltaTime);` and four `glfwGetKey` checks:
  `GLFW_KEY_W` `cameraPos += cameraSpeed * cameraFront;`, `GLFW_KEY_S` `cameraPos -= cameraSpeed * cameraFront;`,
  `GLFW_KEY_A` `cameraPos -= glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;`, `GLFW_KEY_D`
  `cameraPos += …`. Without keys **nothing visible changes** (default picture). Holding W moves the camera forward
  into the scene, S back, A left, D right – the same distance per second at any frame rate.

## `mouse-look`
- **Task:** Look around with the mouse: capture the cursor, register a `mouse_callback` that turns the mouse movement into `yaw`/`pitch` (sensitivity 0.1, pitch limited to ±89°) and sets `cameraFront` from them. Use `firstMouse` so the first event does not make the camera jump.
- **Hint:** Globals `bool firstMouse = true; float yaw = -90.0f; float pitch = 0.0f; float lastX = 800.0f / 2.0f; float lastY = 600.0f / 2.0f;`. `glfwSetCursorPosCallback(window, mouse_callback);` and `glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);`. The y offset is reversed (`lastY - ypos`): screen y goes down. `front.x = cos(glm::radians(yaw)) * cos(glm::radians(pitch)); front.y = sin(glm::radians(pitch)); front.z = sin(glm::radians(yaw)) * cos(glm::radians(pitch));`
- **When done:** declaration `void mouse_callback(GLFWwindow* window, double xpos, double ypos);`; the globals above
  (yaw starts at -90° so the camera looks down -z); after the framebuffer-size callback
  `glfwSetCursorPosCallback(window, mouse_callback);` and `glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);`;
  `mouse_callback` at the end of the file: on the first call it only stores `lastX`/`lastY` (`firstMouse = false`),
  then `xoffset = xpos - lastX`, `yoffset = lastY - ypos`, both × 0.1, `yaw += xoffset; pitch += yoffset;`, pitch
  clamped to [-89, 89], `cameraFront = glm::normalize(front)`. The cursor is hidden and captured. Without mouse
  movement the **default picture stays** (GLFW may report the cursor once when it is captured; thanks to `firstMouse`
  that changes nothing – at most a few pixels differ by 1 from rounding, cameraFront ≈ (0, 0, -1)). Moving the mouse
  turns the camera; W now walks where you look.

## `zoom`
- **Task:** Zoom with the scroll wheel: a global `float fov = 45.0f;` that a `scroll_callback` decreases by the scroll offset, kept between 1 and 45, and use `glm::radians(fov)` in the projection.
- **Hint:** `glfwSetScrollCallback(window, scroll_callback);` – `fov -= (float)yoffset;` then clamp. The projection now changes when you scroll, so it has to be set every frame (it already is).
- **When done:** declaration `void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);`, global
  `float fov = 45.0f;`, `glfwSetScrollCallback(window, scroll_callback);`, the projection is
  `glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f)` (with a comment that it
  changes with fov), and `scroll_callback` subtracts `yoffset` from `fov` and clamps it to [1, 45]. Without scrolling
  fov = 45: **default picture** (as after `mouse-look`). Scrolling up zooms in (smaller fov, bigger crates). Final
  state (= learnopengl's `camera_mouse_zoom.cpp` plus the ten-cube exercise of the previous chapter).
