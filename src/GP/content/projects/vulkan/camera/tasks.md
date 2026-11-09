# Camera (Vulkan) – lookAt, a circling camera, a free fly camera (learnopengl "Camera")

Start: exactly the result of "Coordinate Systems" (ten depth-tested cubes, every third one rotating; view and
projection in the uniform buffer filled by `updateUniformBuffer()`, the model matrix pushed per draw). All camera
work happens in `updateUniformBuffer()` (the view and projection matrices) plus input code; `recordCommandBuffer()`
does not change.

As in learnopengl, the camera state lives in **globals** at file scope (before the class): `cameraPos`,
`cameraFront`, `cameraUp`, `deltaTime`, `lastFrame`, `firstMouse`, `yaw`, `pitch`, `lastX`, `lastY`, `fov`, and the
GLFW callbacks `mouse_callback` / `scroll_callback` are free functions (GLFW calls plain functions; vulkan-tutorial
would reach members through `glfwSetWindowUserPointer`, not needed here). Keys are read in a member `processInput()`
called in `mainLoop()` after `glfwPollEvents()`; Escape closes the window (needed once the mouse is captured).
`deltaTime` is measured with `glfwGetTime()` in `mainLoop()`, like learnopengl's render loop.

Without input (the simulator, the screenshots) every free-camera step shows the start picture: camera at (0, 0, 3)
looking down -z, the ten cubes. At t = 1 s: centre (400, 300) = (168, 120, 50), (640, 270) = (125, 89, 30), teal
(51, 76, 76) at (100, 500) and (700, 500). Colours measured on lavapipe with the time fixed to 1 s (allow ±3).

Optional (described, not a task): learnopengl ends the chapter with a `Camera` class (camera.h: `Position`, `Front`,
`Up`, `Right`, `WorldUp`, `Yaw`, `Pitch`, `MovementSpeed`, `MouseSensitivity`, `Zoom`, `GetViewMatrix()`,
`ProcessKeyboard()`, `ProcessMouseMovement()`, `ProcessMouseScroll()`). The learner can move the globals and the
callback maths into such a class (a member `Camera camera` of `HelloTriangleApplication`, with
`glfwSetWindowUserPointer` to reach it from the callbacks); the solution keeps the globals.

## look-at
- **Task:** Build the view matrix with `glm::lookAt`: `ubo.view = glm::lookAt(glm::vec3(0.0f, 0.0f, 3.0f),
  glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));` instead of the translation.
- **Hint:** lookAt takes the camera position, the point to look at and the world's up direction.
- **When done:** picture unchanged (a camera at (0, 0, 3) looking at the origin is the same as moving the scene by
  -3 in z). Code has `glm::lookAt(` in `updateUniformBuffer()`.

## circle
- **Task:** Let the camera circle the scene: `float radius = 10.0f;`,
  `float camX = static_cast<float>(std::sin(glfwGetTime()) * radius);`,
  `float camZ = static_cast<float>(std::cos(glfwGetTime()) * radius);`,
  `ubo.view = glm::lookAt(glm::vec3(camX, 0.0f, camZ), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));`.
- **Hint:** The camera stays on a circle of radius 10 around the y axis and always looks at the origin.
- **When done:** all ten cubes small (seen from 10 units away), the view swings around them (one turn per 6.3 s).
  Cube 0 (at the origin) stays in the window centre at any time: (400, 300) ≈ (162, 118, 48). At t = 1 s (camera at
  (8.4, 0, 5.4)) the cubes are within x 340..781, y 100..492; teal at (100, 100), (400, 150), (300, 300),
  (500, 300), (600, 300), (400, 400).

## free-camera
- **Task:** Globals `glm::vec3 cameraPos = glm::vec3(0.0f, 0.0f, 3.0f);`, `cameraFront = (0, 0, -1)`,
  `cameraUp = (0, 1, 0)` (before the class) and `ubo.view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);`
  instead of the circle.
- **Hint:** `cameraPos + cameraFront` is a point straight ahead of the camera, so it looks in the direction
  `cameraFront` wherever it is.
- **When done:** the start picture again, not swinging (the cubes 0, 3, 6, 9 still rotate): centre (400, 300) =
  (168, 120, 50) at t = 1 s, (640, 270) = (125, 89, 30), teal at (100, 500), (700, 500). Code has
  `glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp)`.

## wasd
- **Task:** Move with W/A/S/D at a speed independent of the frame rate: globals `float deltaTime = 0.0f;
  float lastFrame = 0.0f;`; in `mainLoop()` before `glfwPollEvents()`: `float currentFrame =
  static_cast<float>(glfwGetTime()); deltaTime = currentFrame - lastFrame; lastFrame = currentFrame;`; a member
  `processInput()` called after `glfwPollEvents()`: Escape → `glfwSetWindowShouldClose(window, GLFW_TRUE)`;
  `float cameraSpeed = 2.5f * deltaTime;` W: `cameraPos += cameraSpeed * cameraFront;` S: `-=`; A:
  `cameraPos -= glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;` D: `+=`.
- **Hint:** The cross product of front and up points to the right of the camera.
- **When done:** without keys: the same picture as after `free-camera`. Holding W moves the camera forward 2.5 units
  per second (the cubes grow), S back, A left, D right; Escape closes the window.

## mouse-look
- **Task:** Look around with the mouse: globals `bool firstMouse = true; float yaw = -90.0f; float pitch = 0.0f;
  float lastX = WIDTH / 2.0f; float lastY = HEIGHT / 2.0f;`; a free function `mouse_callback(GLFWwindow* window,
  double xposIn, double yposIn)` (learnopengl's: first-mouse fix, offsets × 0.1 sensitivity, y offset reversed, pitch
  clamped to ±89°, `cameraFront = glm::normalize(front)` from yaw/pitch with `std::cos`/`std::sin` of
  `glm::radians`); in `initWindow()` after creating the window `glfwSetCursorPosCallback(window, mouse_callback);` and
  `glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);`.
- **Hint:** Without the `firstMouse` check the first mouse event (the cursor jumping into the window) would turn the
  camera by a large angle.
- **When done:** without mouse movement: the same picture as after `free-camera` (the first callback only sets
  `lastX`/`lastY`; a recomputed `cameraFront` differs from (0, 0, -1) only by rounding). The cursor is hidden and
  captured; moving the mouse turns the camera (right → look right, up → look up, never beyond ±89° pitch).

## zoom
- **Task:** Zoom with the scroll wheel: global `float fov = 45.0f;`; a free function `scroll_callback(GLFWwindow*
  window, double xoffset, double yoffset)` that does `fov -= static_cast<float>(yoffset);` and clamps fov to
  1..45; `glfwSetScrollCallback(window, scroll_callback);` in `initWindow()`; the projection uses
  `glm::radians(fov)` instead of `glm::radians(45.0f)`.
- **Hint:** A smaller field of view shows a smaller part of the scene on the same window: everything looks bigger.
- **When done:** without scrolling: fov 45, the same picture as after `free-camera`. Scrolling up narrows the view
  (zoom in, down to fov 1), scrolling down widens it back to 45 at most.
