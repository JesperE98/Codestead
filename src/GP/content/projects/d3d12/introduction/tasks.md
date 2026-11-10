# introduction – DirectX 12

Start: the finished Hello Triangle program (`main.cpp` + `shaders.hlsl`): a window "LearnDirectX" with an 800×600
client area, cleared to `(0.2, 0.3, 0.3, 1.0)` (RGB 51, 77, 77), with an orange `(1.0, 0.5, 0.2, 1.0)`
(RGB 255, 128, 51) triangle: top (400, 150), bottom right (600, 450), bottom left (200, 450) in client pixels.

## build-run
- **Task:** Press **Build & run** and look at the result: the orange triangle on a dark teal background.
- **Hint:** Nothing to edit. `main.cpp` sets up Direct3D 12 and draws; `shaders.hlsl` holds the two shaders.
- **Observable:** the program builds and runs; the preview shows the orange triangle on the clear colour.
  No code change (edits.txt has the section with zero edits).

## color
- **Task:** Make the triangle green: in `shaders.hlsl`, let `PSMain` return `float4(0.2f, 0.8f, 0.3f, 1.0f)`.
- **Hint:** The pixel shader's return value is the colour of every pixel of the triangle (red, green, blue, alpha, 0 to 1).
- **Observable:** `shaders.hlsl`'s `PSMain` returns `float4(0.2f, 0.8f, 0.3f, 1.0f)`; the triangle is green
  (RGB 51, 204, 77), same position, background unchanged.
