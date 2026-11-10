# Advanced Lighting – tasks (DirectX 12)

learnopengl.com "Advanced Lighting" (Blinn-Phong): `src/5.advanced_lighting/1.advanced_lighting`. Files: `main.cpp`,
`advanced_lighting.hlsl` (`VSMain` complete: position, normal and texture coordinates, the floor has no model matrix;
`PSMain` with the lighting – the Blinn-Phong branch is a TODO), `wood.png` (the course's floor boards, 256×256 RGB).

Scene (learnopengl's): one vertex buffer with the floor plane (6 vertices: ±10 in x and z at y = -0.5, normal (0, 1, 0),
texture coordinates up to 10 with v flipped – `10 - v`, Direct3D's v = 0 is the image's top – so the wood repeats ten
times through the static sampler's `D3D12_TEXTURE_ADDRESS_MODE_WRAP`), `wood.png` in heap slot 1, one light at the global
`XMFLOAT3 lightPos(0.0f, 0.0f, 0.0f)`, the camera globals at (0, 0, 3) looking down -z (yaw -90, pitch 0, fov 45,
800/600, 0.1, 100 – `XMMatrixLookAtRH` / `XMMatrixPerspectiveFovRH`; WASD / mouse / wheel still work, nothing is needed),
clear (0.1, 0.1, 0.1), depth test on, no culling. `PSMain`: ambient `0.05f * color`, diffuse `max(dot(lightDir, normal),
0.0f) * color`, specular `float3(0.3f, 0.3f, 0.3f) * spec`.

Root signature: parameter 0 = **one 32-bit root constant** (`InitAsConstants(1, 0, 0, D3D12_SHADER_VISIBILITY_PIXEL)`,
the shader's `cbuffer BlinnConstant : register(b0) { bool blinn; };` – an HLSL bool takes 32 bits), parameter 1 = the CBV
table (`cbuffer SceneConstantBuffer : register(b1)`: view, projection, `float3 viewPos`, `float3 lightPos`; C++ pads each
float3 with a float, as HLSL starts `lightPos` on a new 16-byte row), parameter 2 = the SRV table (t0, the wood). The
global `bool blinn` (main.cpp) is sent every frame in `PopulateCommandList` with
`m_commandList->SetGraphicsRoot32BitConstant(0, blinn, 0);` (learnopengl: `shader.setInt("blinn", blinn)`) and picks the
specular model in the shader; learnopengl toggles it with the B key – here the task changes the code.

Pixels in the 800×600 client area from the top left; nothing depends on time. D3D12 cannot run here: the values are the
app's simulator, which follows every state of this chapter, and they match the OpenGL project's Mesa screenshots within
1–2/255 at all named points (the textures have no mipmaps here, so the far floor shimmers a little more). The upper half
is background (the floor ends at z = -10, horizon ≈ y 330); the wood's vertical seam at x ≈ 400 is avoided.
**background** (400,100) = 26,26,26; **far floor** (450,380) ≈ 62,42,26 (no specular there in any state);
**floor-left** (100,500) ≈ 66,46,28; **floor-right** (700,550) ≈ 64,46,31.

**Start picture (Phong, exponent 8):** the lit wood floor with a soft highlight in the middle of the lower half:
**hl-centre** (450,440) ≈ 151,105,66, (350,440) ≈ 138,96,62, **hl-near** (450,470) ≈ 130,103,81, **hl-side-left**
(300,540) ≈ 118,99,83, **hl-side-right** (500,540) ≈ 126,105,87. With exponent 8 the "hard edge" of learnopengl's
comparison image (where the angle between the view and the reflection passes 90° and Phong's specular drops to 0) is
soft; learnopengl's image uses an exponent of 1.0 to make it obvious.

## halfway
- **Task:** Implement Blinn-Phong in the `if (blinn)` branch of `PSMain` – the halfway vector between the light direction and the view direction, `spec` = its dot product with the normal (at least 0) to the power 8.0 – and switch the program to it: `bool blinn = true;`.
- **Hint:** `float3 halfwayDir = normalize(lightDir + viewDir);` then `spec = pow(max(dot(normal, halfwayDir), 0.0f), 8.0f);`. For a surface the light and the viewer both see, the halfway vector is never more than 90° away from the normal, so there is no cut-off. The flag reaches the shader as root constant 0 – nothing else changes in `main.cpp`.
- **When done:** `advanced_lighting.hlsl`: in the `if (blinn)` branch `float3 halfwayDir = normalize(lightDir + viewDir);`
  and `spec = pow(max(dot(normal, halfwayDir), 0.0f), 8.0f);` (the Phong `else` branch stays); `main.cpp`:
  `bool blinn = true;` (still sent with `SetGraphicsRoot32BitConstant(0, blinn, 0)`). The highlight becomes **wider and
  reaches further back**, brighter in the middle and dimmer at the near sides: **hl-centre** (450,440) ≈ 173,127,89 (was
  151,105,66), (350,440) ≈ 161,119,84, **hl-near** (450,470) ≈ 135,108,85, **hl-side-left** (300,540) ≈ 100,81,65 (was
  118,99,83), **hl-side-right** (500,540) ≈ 109,87,69; floor-left ≈ 65,45,28, floor-right (700,550) ≈ 59,41,26; far floor
  and background unchanged.

## shininess
- **Task:** Raise the Blinn-Phong exponent from 8.0 to 32.0 (learnopengl's value).
- **Hint:** The angle between the normal and the halfway vector is smaller than the one between the view and the reflection vector, so Blinn-Phong needs an exponent 2–4 times Phong's for a highlight of about the same size: `spec = pow(max(dot(normal, halfwayDir), 0.0f), 32.0f);`.
- **When done:** `advanced_lighting.hlsl`: `spec = pow(max(dot(normal, halfwayDir), 0.0f), 32.0f);` in the Blinn-Phong
  branch. The highlight becomes **smaller and tighter** (about the size of the start's Phong highlight, centred further
  back): **hl-centre** (450,440) ≈ 146,100,62, (350,440) ≈ 133,91,57, **hl-near** (450,470) ≈ 99,72,49,
  **hl-side-left** (300,540) ≈ 66,47,31, **hl-side-right** (500,540) ≈ 74,53,35, floor-left ≈ 65,44,27, floor-right ≈
  57,39,24; far floor and background unchanged. This is the solution.
