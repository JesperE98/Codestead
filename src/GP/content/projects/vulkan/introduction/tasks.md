# Introduction (Vulkan)

Start: the finished Hello Triangle program of this course (vulkan-tutorial.com style, class
`HelloTriangleApplication`): an orange triangle `(1.0, 0.5, 0.2, 1.0)` on the clear colour `(0.2, 0.3, 0.3, 1.0)`.
Files: `main.cpp`, `shaders/shader.vert`, `shaders/shader.frag` (compiled to `shaders/vert.spv` / `shaders/frag.spv`).

## build-run
- **Task:** Press **Build & run** and look at the window.
- **Hint:** Nothing to edit: the program is complete. The window is 800×600 and titled "Vulkan".
- **When done:** the program builds and runs (no edit). The window opens and stays open; teal background
  `(0.2, 0.3, 0.3)` = RGB (51, 76, 76); an orange triangle `(1.0, 0.5, 0.2)` = RGB (255, 128, 51) in the middle
  (top corner at the centre-top, corners at NDC (0, -0.5), (0.5, 0.5), (-0.5, 0.5)). No validation messages.

## color
- **Task:** Make the triangle green: in `shaders/shader.frag` change the colour written to `outColor` to `vec4(0.2, 0.8, 0.3, 1.0)`.
- **Hint:** The fragment shader runs for every pixel of the triangle; `outColor` is its output at location 0.
- **When done:** `shaders/shader.frag` contains `outColor = vec4(0.2, 0.8, 0.3, 1.0);`. Same triangle, now green
  RGB (51, 204, 76) on the same teal background.
