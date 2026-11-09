# shaders – DirectX 12

Start = `introduction/start`: the orange triangle (corners top (400, 150), bottom right (600, 450), bottom left
(200, 450) in the 800×600 client area) on `(0.2, 0.3, 0.3, 1.0)` (RGB 51, 77, 77). The shaders are in
`shaders.hlsl` (`VSMain`, `PSMain`), compiled at run time by `D3DCompileFromFile`.

Order and what stays: `uniform` sets the colour from the CPU through **root constants** (`cbuffer ColorConstants :
register(b0)`, root parameter 0). `vertex-colors` replaces that colour by per-vertex colours: it removes the
`cbuffer` from `shaders.hlsl` and the pixel shader goes back to `input.color`; the C++ side still sets the (now
unused, harmless) root constants until `offset`, which **reuses the same root parameter** for `xOffset`
(`ColorConstants` becomes `OffsetConstants`, the time code goes). `position-color` finally outputs the position
as the colour, so – like learnopengl's exercise – the vertex colours in the buffer are then unused.
`upside-down` must also turn off back-face culling: flipping y reverses the winding (clockwise → counter-clockwise),
and the default rasterizer state culls counter-clockwise triangles, so the triangle would vanish.

## in-out
- **Task:** Pass a colour from the vertex shader to the pixel shader: add `float4 color : COLOR;` to `PSInput`, set `result.color = float4(0.5f, 0.0f, 0.0f, 1.0f);` in `VSMain`, and `return input.color;` in `PSMain`.
- **Hint:** What the vertex shader writes into `PSInput` arrives, interpolated, in the pixel shader's `input` – matched by the semantic (`COLOR`).
- **Observable:** `PSInput` has `float4 color : COLOR`; `PSMain` returns `input.color`. The triangle is dark red `(0.5, 0.0, 0.0)` (RGB 128, 0, 0).

## uniform
- **Task:** Set the colour from the CPU every frame with root constants: in `shaders.hlsl` `cbuffer ColorConstants : register(b0) { float4 color; };` and `return color;` in `PSMain`; in `main.cpp` `struct ColorConstants { XMFLOAT4 color; };`, a root parameter `rootParameters[0].InitAsConstants(sizeof(ColorConstants) / 4, 0)` in the root signature, and in `PopulateCommandList` the time from `std::chrono` (`#include <chrono>`, `<cmath>`), `greenValue = std::sin(time) / 2.0f + 0.5f` and `SetGraphicsRoot32BitConstants(0, sizeof(ColorConstants) / 4, &colorConstants, 0)`.
- **Hint:** Root constants are 32-bit values stored in the root signature itself; the shader sees them as a constant buffer at register `b0`. Set them after `SetGraphicsRootSignature`, every frame (a reset command list forgets them).
- **Observable:** `cbuffer ColorConstants : register(b0)`, `InitAsConstants`, `SetGraphicsRoot32BitConstants(0, ...)`. The triangle's colour is `(0, g, 0)` with g = sin(t)/2 + 0.5 (t = seconds since the first frame): it pulses between black and green with a period of about 6.3 s; red and blue stay 0. Pixel shader no longer uses `input.color`.

## vertex-colors
- **Task:** Give each vertex its own colour: `XMFLOAT3 color;` in `Vertex`, a second input element `{ "COLOR", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }`, colours in the vertex data (top blue, bottom right red, bottom left green); in `shaders.hlsl` `VSMain(float4 position : POSITION, float4 color : COLOR)` with `result.color = color;`, `PSMain` returns `input.color` again, and remove the `cbuffer ColorConstants`.
- **Hint:** The colour starts 12 bytes into each vertex (after the 3 floats of the position); the stride `sizeof(Vertex)` becomes 24 automatically. Between the corners the colours are interpolated.
- **Observable:** the `COLOR` input element with offset 12, `XMFLOAT3 color` in `Vertex`. The learnopengl RGB triangle: blue at the top (400, 150), red at the bottom right (600, 450), green at the bottom left (200, 450); centre (400, 300) ≈ `(0.25, 0.25, 0.5)` (RGB 64, 64, 128). No more pulsing.

## upside-down
- **Task:** Turn the triangle upside down in the vertex shader: `result.position = float4(position.x, -position.y, position.z, 1.0f);` – and draw both sides: `psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;`.
- **Hint:** Mirroring y also mirrors the order of the corners on screen: the triangle becomes counter-clockwise, a back face, and the default rasterizer state culls back faces.
- **Observable:** `-position.y` in `VSMain`, `CullMode = D3D12_CULL_MODE_NONE`. The triangle points down: blue corner at the bottom (400, 450), red at the top right (600, 150), green at the top left (200, 150); centre (400, 300) still ≈ RGB (64, 64, 128).

## offset
- **Task:** Move the triangle to the right with a value from the CPU: the root constants now carry `xOffset` – `cbuffer OffsetConstants : register(b0) { float xOffset; };` and `position.x + xOffset` in `VSMain`; in `main.cpp` `ColorConstants` becomes `struct OffsetConstants { float xOffset; };` (one 32-bit value), and `PopulateCommandList` sets `offsetConstants.xOffset = 0.5f` with `SetGraphicsRoot32BitConstants(0, sizeof(OffsetConstants) / 4, &offsetConstants, 0)` instead of the colour (the `<chrono>`/`<cmath>` includes and the time code go).
- **Hint:** The same root parameter, now 1 constant. 0.5 in clip space is a quarter of the window's width: 200 pixels.
- **Observable:** `cbuffer OffsetConstants`, `xOffset = 0.5f`, `SetGraphicsRoot32BitConstants(0, 1 value ...)`. The upside-down RGB triangle 200 px to the right: blue (600, 450), red (800, 150) at the right edge, green (400, 150); (400, 300) is now clear colour, (600, 300) ≈ RGB (64, 64, 128).

## position-color
- **Task:** Output the vertex position as the colour: `result.color = position;` in `VSMain`.
- **Hint:** x becomes red, y green, z blue. Negative values are clamped to 0 when the colour is written – which is why one corner is black.
- **Observable:** `result.color = position;`. Same (moved, upside-down) triangle; the colour is the original position (x, y, 0): corner (600, 450) = `(0, 0.5, 0)` green-ish, corner (800, 150) = `(0.5, 0, 0)` dark red, corner (400, 150) black; e.g. (600, 420) ≈ RGB (0, 102, 0), (750, 180) ≈ RGB (96, 0, 0), (600, 300) black. The vertex colours in the buffer are no longer used (as in learnopengl's exercise).
