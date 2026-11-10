# transformations – DirectX 12

learnopengl.com "Transformations" with DirectXMath. learnopengl's `uniform mat4 transform` becomes **root constants**:
16 32-bit values (one 4×4 float matrix) in the root signature, set with `SetGraphicsRoot32BitConstants` before each
draw (the same mechanism as the textures chapter's `MixConstants`). Files: `main.cpp`, `shaders.hlsl`,
`container.png`, `awesomeface.png` (the same as in the textures chapter).

Start = the textures chapter after `texture-units` (two textures through the SRV table, one static WRAP sampler s0,
`lerp(…, …, 0.2f)`, no mirrored face, no repeat, no mix root constant, no key handling), with the per-vertex colour
dropped (it is no longer used: `Vertex` = `XMFLOAT3 position; XMFLOAT2 texCoord;`, input layout `POSITION` at 0 and
`TEXCOORD` at 12, `PSInput` without `color`), as learnopengl's transformations code has no colours. Root signature:
parameter 0 = the SRV table. TODOs: in the root signature block and before `DrawIndexedInstanced` in
`PopulateCommandList`.

**Matrix conventions (important for the checks).** DirectXMath uses row vectors (`v * M`), so a product applies
from **left to right**: learnopengl's `trans = translate(…); trans = rotate(…)` (rotate first, then translate) is
`XMMatrixRotationZ(…) * XMMatrixTranslation(…)`. Each matrix is stored with `XMStoreFloat4x4(&…, XMMatrixTranspose(M))`
and the shader uses `mul(position, transform)` (row vector on the left) – the pairing of Microsoft's samples
(D3D12Bundles: `XMMatrixTranspose(model * view * projection)` + `mul(float4(position, 1.0f), g_mWorldViewProj)`).
HLSL reads the stored floats column by column (column_major), so the shader's `transform` equals DirectXMath's `M`
and `mul(row vector, transform)` = `v * M`. The resulting clip coordinates are exactly learnopengl's (checked
numerically against GLM for every step). **Note for the simulator:** this is transpose + `mul(vector, matrix)`, not
`mul(matrix, vector)`.

Pixel positions are in the 800×600 client area from the top left, at time = 1 s. D3D12 cannot run here: the colours
come from a software model of these exact matrices (perspective-correct, bilinear filtering at pixel centres, one
mip level as in the code, the real PNGs); a GPU may differ by a few units, edges by a pixel. The pictures are the
same as OpenGL's apart from OpenGL's mipmaps. Background = clear colour ≈ (51, 77, 77). Colours of the crate:
face centre / brace ≈ (125, 89, 30), dark frame ≈ (74, 46, 22), light planks ≈ (168, 120, 50) / (179, 128, 54), screws
≈ (152, 152, 144), heart ≈ (161, 83, 54).

Start picture (unchanged from `texture-units`): the crate with the faint face fills (200, 150)–(600, 450); centre
(400, 300) ≈ (125, 89, 30), (300, 225) ≈ (168, 120, 50), (400, 155) ≈ (74, 46, 22) frame, heart on the right at
(492, 325) ≈ (161, 83, 54); outside ≈ (51, 77, 77).

## transform-uniform
- **Task:** Pass a transformation matrix to the vertex shader as root constants: `struct TransformConstants { XMFLOAT4X4 transform; };`, root parameter 1 `rootParameters[1].InitAsConstants(sizeof(TransformConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_VERTEX)` (b0), and in `PopulateCommandList` `XMMATRIX transform = XMMatrixScaling(0.5f, 0.5f, 0.5f) * XMMatrixRotationZ(XMConvertToRadians(90.0f));` stored transposed and set with `SetGraphicsRoot32BitConstants(1, sizeof(TransformConstants) / 4, &transformConstants, 0)`. In `shaders.hlsl`: `cbuffer TransformConstants : register(b0) { float4x4 transform; };` and `result.position = mul(position, transform);`.
- **Hint:** A 4×4 float matrix is 64 bytes = 16 root constants. DirectXMath applies a product from left to right: first scale to half size, then rotate by 90°. `XMMatrixTranspose` before storing, because HLSL reads matrices column by column; then `mul(position, transform)` (position on the left) applies the matrix like `v * M`.
- **Observable:** `struct TransformConstants` with `XMFLOAT4X4 transform`; `rootParameters[2]`, parameter 1 = 16 root constants at b0, vertex visibility; `XMMatrixScaling(0.5…) * XMMatrixRotationZ(XMConvertToRadians(90.0f))`, `XMStoreFloat4x4(…, XMMatrixTranspose(transform))`, `SetGraphicsRoot32BitConstants(1, 16, …, 0)` before the draw; HLSL `cbuffer TransformConstants : register(b0)`, `mul(position, transform)`. Picture: the crate at half size, turned 90° counter-clockwise, in (300, 225)–(500, 375) (200 × 150 pixels); the image's top edge is now on the left: the heart is above the face centre at (417, 265) ≈ (161, 83, 54); the brace runs from top left to bottom right: (350, 262) and (450, 338) ≈ (125, 89, 30), (450, 262) ≈ (179, 128, 54) and (350, 338) ≈ (168, 120, 50) light; a screw at (490, 365) ≈ (152, 152, 144); centre (400, 300) ≈ (125, 89, 30), frame (310, 235) ≈ (74, 46, 22); outside, e.g. (200, 150), ≈ (51, 77, 77).

## translate-rotate
- **Task:** Make the container spin in the bottom right: compute the time since the first frame with `std::chrono` (`static auto startTime = std::chrono::high_resolution_clock::now();` …) and use `XMMATRIX transform = XMMatrixRotationZ(time) * XMMatrixTranslation(0.5f, -0.5f, 0.0f);` (`#include <chrono>`).
- **Hint:** learnopengl writes `translate` first and `rotate` second, which rotates first; DirectXMath's order is the order the steps happen: rotate (about the rectangle's own centre), then move. The angle is in radians: one turn every 2π ≈ 6.3 s, counter-clockwise.
- **Observable:** `#include <chrono>`; `std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count()`; `XMMatrixRotationZ(time) * XMMatrixTranslation(0.5f, -0.5f, 0.0f)`. Full-size crate centred at (600, 450), turning counter-clockwise, partly outside the window (bottom right). At 1 s (turned 57°): centre (600, 450) ≈ (125, 89, 30), (500, 375) ≈ (179, 128, 54), (700, 525) ≈ (161, 118, 48); covers about x 324–799, y 243–599; window centre (400, 300) and (720, 300) background ≈ (51, 77, 77). Changes with time (the centre (600, 450) stays ≈ (125, 89, 30)).

## rotate-first
- **Task:** Swap the order: `XMMATRIX transform = XMMatrixTranslation(0.5f, -0.5f, 0.0f) * XMMatrixRotationZ(time);`.
- **Hint:** Now the container is moved first and then rotated about the origin – the window's centre – so it circles around it (learnopengl's exercise: `rotate` before `translate` in GLM).
- **Observable:** `XMMatrixTranslation(0.5f, -0.5f, 0.0f) * XMMatrixRotationZ(time)`. The crate circles the window centre counter-clockwise (one round every 6.3 s), always tilted by the same angle as it travels. At 1 s its centre is at (676, 255) ≈ (125, 89, 30) (right of the window centre, a bit above); (600, 300) ≈ (179, 128, 54), (500, 225) ≈ (74, 46, 22) frame; it covers about x 400–799, y 48–461; window centre (400, 300) and the old place (600, 450) are background ≈ (51, 77, 77). At 0 s it starts centred at (600, 450).

## second-container
- **Task:** Draw a second container in the top left: after the first `DrawIndexedInstanced`, `float scaleAmount = std::sin(time);`, `transform = XMMatrixScaling(scaleAmount, scaleAmount, scaleAmount) * XMMatrixTranslation(-0.5f, 0.5f, 0.0f);`, store it, `SetGraphicsRoot32BitConstants` again, and `DrawIndexedInstanced(6, 1, 0, 0, 0)` again (`#include <cmath>`).
- **Hint:** Root constants are recorded into the command list with each draw, so changing them between two draws gives each draw its own matrix (learnopengl sets the uniform again before the second `glDrawElements`). sin(time) goes from -1 to 1: a negative scale turns the crate upside down (by 180°).
- **Observable:** `std::sin(time)`; `XMMatrixScaling(scaleAmount, …) * XMMatrixTranslation(-0.5f, 0.5f, 0.0f)`; a second `SetGraphicsRoot32BitConstants(1, …)` and a second `DrawIndexedInstanced(6, 1, 0, 0, 0)`. Two crates: the circling one (as in `rotate-first`, centre (676, 255) at 1 s) and an upright one centred at (200, 150) that grows and shrinks (size × sin(time)). At 1 s (scale 0.84): (200, 150) ≈ (125, 89, 30), spanning about x 32–368, y 24–276 (frame at (36, 28) and (364, 272) ≈ (74, 46, 22)), heart on the right of its centre, (130, 90) ≈ (168, 120, 50). At times where sin(time) ≈ 0 it vanishes; when negative it is upside down (heart on the left).
