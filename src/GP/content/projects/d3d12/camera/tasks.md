# camera – DirectX 12

learnopengl.com "Camera": a look-at view matrix, a camera circling the scene, then a free camera (WASD with
deltaTime, mouse look with yaw/pitch, zoom with the mouse wheel). DirectXMath: `XMMatrixLookAtRH` (= `glm::lookAt`),
`XMMatrixPerspectiveFovRH`, `XMVECTOR` arithmetic (`+`, `-`, `*` with a float, `+=`, `-=`), `XMVector3Cross`,
`XMVector3Normalize`. Input comes through the window's messages: `WM_KEYDOWN` / `WM_KEYUP` (held keys, like the
samples' `OnKeyDown`/`OnKeyUp` + `SimpleCamera`), `WM_MOUSEMOVE`, `WM_MOUSEWHEEL`.

Start = `coordinate-systems/solution` unchanged: ten cubes, every third one turning; `OnUpdate` writes
`view = XMMatrixTranslation(0, 0, -3)` and the 45° projection into the constant buffer, `PopulateCommandList` draws the
cubes. No TODOs: every task changes or adds code at named places.

As learnopengl.com, the camera state is kept in **globals** (`cameraPos`, `cameraFront`, `cameraUp` as `XMVECTOR`,
`keys[256]`, `firstMouse`, `yaw`, `pitch`, `lastX`, `lastY`, `fov`), declared before `class D3D12App`; `OnUpdate`
(a member, run every frame) reads them, `WindowProc` and the free functions `OnMouseMove` / `OnMouseWheel` change
them. Per-frame code: `OnUpdate` (deltaTime, movement, view, projection → constant buffer) and `PopulateCommandList`
(unchanged: time, the ten model matrices, draws). Time = `std::chrono`; `OnUpdate` has its own static clock
(`startTime` in `circle`, then `lastFrame` for deltaTime).

With no input (as in the simulator), the program shows the start picture at every step except `circle`: from
`free-camera` on, `cameraPos` = (0, 0, 3), `cameraFront` = (0, 0, -1), `cameraUp` = (0, 1, 0), `fov` = 45, and
`XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront, cameraUp)` is the same matrix as `XMMatrixTranslation(0, 0, -3)`.

Pixel positions are in the 800×600 client area from the top left, at time = 1 s. D3D12 cannot run here: the colours
come from a software model of these exact matrices (see `coordinate-systems`); a GPU may differ by a few units.
Background ≈ (51, 77, 77).

Start picture (= coordinate-systems' result): ten crates, about half the window covered, cubes at all four edges; the
first cube in the middle, turned 25° at 1 s: (400, 300) ≈ (168, 120, 50), (440, 330) ≈ (125, 89, 30), (300, 225)
≈ (117, 77, 42); a fixed cube on the right, (600, 300) ≈ (158, 117, 48); (80, 60) background.

Optional, as on learnopengl.com: the camera code can be moved into a `Camera` class (position, front, up, right,
worldUp, yaw, pitch, movementSpeed, mouseSensitivity, zoom; `GetViewMatrix()` returning
`XMMatrixLookAtRH(Position, Position + Front, Up)`, `ProcessKeyboard(direction, deltaTime)`,
`ProcessMouseMovement(xoffset, yoffset)`, `ProcessMouseScroll(yoffset)`, `updateCameraVectors()`). The course's
solution keeps the globals; a learner who writes the class should get the same pictures.

## look-at
- **Task:** Build the view matrix with a look-at matrix: `XMMATRIX view = XMMatrixLookAtRH(XMVectorSet(0.0f, 0.0f, 3.0f, 0.0f), XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f), XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f));` in `OnUpdate`.
- **Hint:** `XMMatrixLookAtRH(eye, focus, up)`: the camera stands at (0, 0, 3), looks at the origin, and +y is up – the same view as moving the scene by -3 in z. RH = right-handed like OpenGL: +z points out of the screen, towards you.
- **Observable:** `XMMatrixLookAtRH(…(0, 0, 3)…, …(0, 0, 0)…, …(0, 1, 0)…)` instead of `XMMatrixTranslation(0.0f, 0.0f, -3.0f)`. Picture unchanged (the start picture).

## circle
- **Task:** Let the camera circle the scene: in `OnUpdate`, the time since the first frame with `std::chrono` (`static auto startTime …`), `float radius = 10.0f; float camX = std::sin(time) * radius; float camZ = std::cos(time) * radius;` and `XMMatrixLookAtRH(XMVectorSet(camX, 0.0f, camZ, 0.0f), XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f), XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f))`.
- **Hint:** (sin t, cos t) · 10 runs around a circle of radius 10 in the xz plane; the camera always looks at the origin. At 0 s it is at (0, 0, 10), in front of the scene.
- **Observable:** `radius = 10.0f`, `camX = std::sin(time) * radius`, `camZ = std::cos(time) * radius`, the look-at with `(camX, 0, camZ)`. The scene is seen from 10 units away, so the cubes are small, and it turns as the camera goes round (one round in 6.3 s). At 1 s the camera is at (8.41, 0, 5.40): the cubes are in the right half, about x 339–779, y 99–490: (400, 300) ≈ (166, 119, 49), (700, 300) ≈ (179, 128, 54), (560, 190) ≈ (74, 46, 22), (600, 450) ≈ (98, 62, 22); the left half is background: (200, 300), (300, 450), (80, 60) ≈ (51, 77, 77). Changes with time.

## free-camera
- **Task:** Give the camera a position and a direction: globals `XMVECTOR cameraPos = XMVectorSet(0.0f, 0.0f, 3.0f, 0.0f);`, `cameraFront = XMVectorSet(0.0f, 0.0f, -1.0f, 0.0f);`, `cameraUp = XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f);` before `class D3D12App`, and in `OnUpdate` (replacing the circle and its time lines) `XMMATRIX view = XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront, cameraUp);`.
- **Hint:** Looking at `cameraPos + cameraFront` means always looking in the direction `cameraFront`, wherever the camera is. These are globals so that the window's message handler can change them later.
- **Observable:** the three globals; `XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront, cameraUp)`; no `camX`/`camZ`. The start picture again (camera at (0, 0, 3) looking down -z): (400, 300) ≈ (168, 120, 50), (600, 300) ≈ (158, 117, 48) at 1 s.

## wasd
- **Task:** Move the camera with W, A, S, D: a global `bool keys[256] = {};`; in `WindowProc` set `keys[static_cast<UINT8>(wParam)] = true;` on `WM_KEYDOWN` (Escape still closes) and `false` on a new `case WM_KEYUP:`; at the start of `OnUpdate` compute `deltaTime` (seconds since the last frame, `static auto lastFrame` with `std::chrono`) and `float cameraSpeed = 2.5f * deltaTime;`, then `if (keys['W']) cameraPos += cameraSpeed * cameraFront;`, `S`: `-=`, `A`: `cameraPos -= XMVector3Normalize(XMVector3Cross(cameraFront, cameraUp)) * cameraSpeed;`, `D`: `+=`.
- **Hint:** `WM_KEYDOWN` arrives when a key goes down (and repeats), `WM_KEYUP` when it is released – so `keys` says which keys are held, like `glfwGetKey`. A letter key's virtual-key code is its capital letter ('W' = 0x57). Speed × deltaTime makes the camera move 2.5 units per second however fast the frames come. The cross product of front and up points to the right.
- **Observable:** `keys[256]`; `WM_KEYDOWN` sets, `WM_KEYUP` clears `keys[wParam]`; `deltaTime` from `currentFrame - lastFrame`; `cameraSpeed = 2.5f * deltaTime`; the four `if (keys['W'/'S'/'A'/'D'])` with `+=`/`-=` on `cameraPos` and `XMVector3Normalize(XMVector3Cross(cameraFront, cameraUp))` for A/D. Without keys: the start picture. Holding W moves forward (into the scene, -z) at 2.5 units/s – after about 1 s the camera reaches (0, 0, 0.5), the first cube's front face, which then fills the window and is passed through; S moves back, A left, D right (the scene slides the other way). Escape still closes the window.

## mouse-look
- **Task:** Turn the camera with the mouse: globals `firstMouse = true`, `yaw = -90.0f`, `pitch = 0.0f`, `lastX = 800.0f / 2.0f`, `lastY = 600.0f / 2.0f`; a function `void OnMouseMove(float xpos, float ypos)` (before `WindowProc`) as learnopengl's `mouse_callback` (first-mouse fix, offsets × 0.1, pitch clamped to ±89°, `cameraFront = XMVector3Normalize(XMVectorSet(cos(yaw)·cos(pitch), sin(pitch), sin(yaw)·cos(pitch), 0))` with `XMConvertToRadians`); in `WindowProc` a `case WM_MOUSEMOVE:` that, while the window is the foreground window, calls `OnMouseMove(GET_X_LPARAM(lParam), GET_Y_LPARAM(lParam))` and captures the cursor by putting it back in the window's centre (`GetClientRect`, `ClientToScreen`, `SetCursorPos`, with `lastX`/`lastY` set to the centre); `ShowCursor(FALSE)` after `ShowWindow`; `#include <windowsx.h>`.
- **Hint:** yaw turns left/right, pitch up/down; yaw = -90° makes the first direction (0, 0, -1). Window y grows downwards, so `yoffset = lastY - ypos`. learnopengl's `GLFW_CURSOR_DISABLED` hides the cursor and never lets it hit an edge; here the cursor is hidden with `ShowCursor(FALSE)` and moved back to the centre after each move – moving `lastX`/`lastY` along so the jump itself does not turn the camera. The first `WM_MOUSEMOVE` can come from anywhere in the window: `firstMouse` starts from there instead of jumping. Only the foreground window captures the cursor, so Alt+Tab frees it.
- **Observable:** the five globals; `OnMouseMove` with `if (firstMouse)`, `sensitivity = 0.1f`, `yaw += xoffset`, `pitch += yoffset`, the ±89 clamps, `cameraFront = XMVector3Normalize(front)`; `case WM_MOUSEMOVE:` with `GetForegroundWindow() == hWnd`, `GET_X_LPARAM`/`GET_Y_LPARAM`, `SetCursorPos`; `ShowCursor(FALSE)`; `#include <windowsx.h>`. Without mouse movement: the start picture (front = (0, 0, -1)). Moving the mouse right turns the view right (the scene slides left), up turns it up; the cursor is invisible over the window and stays inside it while it is active.

## zoom
- **Task:** Zoom with the mouse wheel: a global `float fov = 45.0f;`, a function `void OnMouseWheel(float yoffset)` that does `fov -= yoffset;` and clamps it to 1..45, a `case WM_MOUSEWHEEL:` calling `OnMouseWheel(static_cast<float>(GET_WHEEL_DELTA_WPARAM(wParam)) / WHEEL_DELTA)`, and `XMConvertToRadians(fov)` in the projection in `OnUpdate`.
- **Hint:** One wheel notch is `WHEEL_DELTA` (120) – dividing gives learnopengl's yoffset of 1 per notch; turning the wheel away from you is positive and zooms in (a smaller field of view). The projection is already rebuilt every frame in `OnUpdate`.
- **Observable:** `float fov = 45.0f`; `OnMouseWheel` with `fov -= yoffset` and the clamps to 1.0f and 45.0f; `case WM_MOUSEWHEEL:` with `GET_WHEEL_DELTA_WPARAM(wParam)` / `WHEEL_DELTA`; `XMMatrixPerspectiveFovRH(XMConvertToRadians(fov), …)`. Without the wheel: the start picture. Each notch away from you zooms in by 1°: at fov 20 the middle cube fills most of the window (about 92% covered; (400, 300) ≈ (168, 120, 50), even (80, 60) is crate ≈ (74, 46, 22)); towards you zooms out, at most back to 45°.
